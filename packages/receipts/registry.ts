import {
  createPublicClient,
  http,
  defineChain,
  parseAbi,
  encodeFunctionData,
  parseEventLogs,
  keccak256,
  isAddress,
  TransactionReceiptNotFoundError,
  type Hex,
  type PublicClient,
} from "viem";
export const REGISTRY = "0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867" as const;
export const EXPLORER = "https://robinhoodchain.blockscout.com";
const RPC = "https://rpc.mainnet.chain.robinhood.com";
export const RUNTIME_HASH =
  "0xf2a6f8183a49071b20650fe96407a0228d0fef28a9cdacde26ec0f3f6acc0ff2";
export const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { name: "Blockscout", url: EXPLORER } },
});
export const registryAbi = parseAbi([
  "function anchoredAt(bytes32) view returns (uint256)",
  "function anchor(bytes32)",
  "event ReceiptAnchored(bytes32 indexed receiptHash, address indexed author, uint256 timestamp)",
  "error ZeroHash()",
  "error AlreadyAnchored()",
]);
export const registryClient = createPublicClient({
  chain: robinhood,
  transport: http(RPC, { timeout: 12000, retryCount: 0 }),
});
export type WalletProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (name: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (
    name: string,
    listener: (...args: unknown[]) => void,
  ) => void;
};
function validateHash(hash: string): asserts hash is Hex {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash) || /^0x0{64}$/.test(hash))
    throw new Error("Invalid receipt hash.");
}
async function assertRegistry(client: PublicClient) {
  if ((await client.getChainId()) !== 4663)
    throw new Error("RPC is not Robinhood Chain mainnet.");
  const code = await client.getCode({ address: REGISTRY });
  if (!code || keccak256(code) !== RUNTIME_HASH)
    throw new Error(
      "Registry code could not be verified. No transaction was requested.",
    );
}
export async function readAnchor(
  hash: Hex,
  client: PublicClient = registryClient,
) {
  validateHash(hash);
  await assertRegistry(client);
  return client.readContract({
    address: REGISTRY,
    abi: registryAbi,
    functionName: "anchoredAt",
    args: [hash],
  });
}
export async function submissionStatus(
  hash: Hex,
  client: PublicClient = registryClient,
) {
  validateHash(hash);
  try {
    const receipt = await client.getTransactionReceipt({ hash });
    return receipt.status === "reverted" ? "reverted" : "confirmed";
  } catch (error) {
    if (error instanceof TransactionReceiptNotFoundError) return "pending";
    throw error;
  }
}
export async function connectWallet(provider: WalletProvider): Promise<Hex> {
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  if (
    !Array.isArray(accounts) ||
    typeof accounts[0] !== "string" ||
    !isAddress(accounts[0])
  )
    throw new Error("No wallet account available.");
  if ((await provider.request({ method: "eth_chainId" })) !== "0x1237") {
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1237" }],
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 4902) throw error;
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x1237",
            chainName: robinhood.name,
            nativeCurrency: robinhood.nativeCurrency,
            rpcUrls: [RPC],
            blockExplorerUrls: [EXPLORER],
          },
        ],
      });
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1237" }],
      });
    }
  }
  if ((await provider.request({ method: "eth_chainId" })) !== "0x1237")
    throw new Error("Select Robinhood Chain (4663) in MetaMask.");
  return accounts[0] as Hex;
}
async function walletAccount(provider: WalletProvider) {
  if ((await provider.request({ method: "eth_chainId" })) !== "0x1237")
    throw new Error(
      "Wallet network changed. Reconnect to Robinhood Chain (4663).",
    );
  const accounts = await provider.request({ method: "eth_accounts" });
  if (
    !Array.isArray(accounts) ||
    typeof accounts[0] !== "string" ||
    !isAddress(accounts[0])
  )
    throw new Error("Reconnect MetaMask before anchoring.");
  return accounts[0] as Hex;
}
export async function anchorReceipt(
  hash: Hex,
  provider: WalletProvider,
  onSubmitted: (hash: Hex) => void,
  client: PublicClient = registryClient,
) {
  validateHash(hash);
  const account = await walletAccount(provider);
  const existing = await readAnchor(hash, client);
  if (existing > 0n) return { timestamp: existing, alreadyAnchored: true };
  await client.simulateContract({
    address: REGISTRY,
    abi: registryAbi,
    functionName: "anchor",
    args: [hash],
    account,
  });
  if ((await walletAccount(provider)).toLowerCase() !== account.toLowerCase())
    throw new Error("Wallet account changed. Reconnect and retry.");
  // Fixed destination, fixed function, zero native value. Wallet approval is explicit.
  const transaction = await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: account,
        to: REGISTRY,
        chainId: "0x1237",
        value: "0x0",
        data: encodeFunctionData({
          abi: registryAbi,
          functionName: "anchor",
          args: [hash],
        }),
      },
    ],
  });
  if (
    typeof transaction !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(transaction)
  )
    throw new Error(
      "Wallet did not return a transaction hash. Check wallet activity before retrying.",
    );
  const txHash = transaction as Hex;
  onSubmitted(txHash);
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    timeout: 60000,
  });
  if (receipt.status !== "success")
    throw new Error("Anchor transaction reverted. Check the transaction link.");
  const events = parseEventLogs({
    abi: registryAbi,
    eventName: "ReceiptAnchored",
    logs: receipt.logs.filter(
      (log) => log.address.toLowerCase() === REGISTRY.toLowerCase(),
    ),
  });
  const event = events.find(
    (e) =>
      e.args.receiptHash.toLowerCase() === hash.toLowerCase() &&
      e.args.author.toLowerCase() === account.toLowerCase(),
  );
  if (!event)
    throw new Error(
      "Transaction confirmed without the expected registry event. Check the transaction link.",
    );
  return {
    timestamp: event.args.timestamp,
    alreadyAnchored: false,
    txHash,
    author: account,
  };
}
export function walletError(error: unknown) {
  const code = (error as { code?: number })?.code;
  if (code === 4001)
    return "Request cancelled in MetaMask. Nothing was confirmed by SELQEN.";
  if (code === -32002)
    return "A request is already open in MetaMask. Complete or cancel it there.";
  if (error instanceof Error && error.message.length < 220)
    return error.message;
  return "The operation could not finish. Check MetaMask and any transaction link before retrying.";
}
