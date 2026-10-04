import { z } from "zod";
import { decodeFunctionData, keccak256, parseAbi, toBytes } from "viem";

const address = z.string().regex(/^0x[\da-fA-F]{40}$/);
export const walletObservationSchema = z.object({
  method: z.enum([
    "eth_sendTransaction",
    "eth_signTypedData_v4",
    "wallet_sendCalls",
  ]),
  kind: z.enum(["approval", "transfer", "typed-data", "unknown"]),
  chainId: z.string().max(32).nullable(),
  target: address.optional(),
  spender: address.optional(),
  amount: z
    .string()
    .regex(/^\d{1,78}$/)
    .optional(),
  unlimited: z.boolean().optional(),
  hash: z.string().regex(/^0x[\da-f]{64}$/),
  observedAt: z.number().int().positive(),
});
export type WalletObservation = z.infer<typeof walletObservationSchema>;
const erc20 = parseAbi([
  "function approve(address spender, uint256 amount)",
  "function transfer(address to, uint256 amount)",
]);
const record = (v: unknown): Record<string, unknown> | undefined =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
function chain(v: unknown): string | null {
  try {
    if (
      typeof v !== "string" ||
      !/^(0x[\da-fA-F]+|\d+)$/.test(v) ||
      v.length > 32
    )
      return null;
    return BigInt(v).toString();
  } catch {
    return null;
  }
}

// Only allowlisted request arguments are read. Wallet results/signatures and
// account lists are never observed or stored. Page evidence remains untrusted.
export function inspectWalletRequest(
  args: unknown,
  providerChain?: unknown,
): WalletObservation | null {
  try {
    const request = record(args);
    const method = walletObservationSchema.shape.method.safeParse(
      request?.method,
    );
    if (!method.success || !Array.isArray(request?.params)) return null;
    const params = request.params;
    const serialized = JSON.stringify({ method: method.data, params });
    if (serialized.length > 32768) return null;
    const result: WalletObservation = {
      method: method.data,
      kind: "unknown",
      chainId: chain(providerChain),
      hash: keccak256(toBytes(serialized)),
      observedAt: Date.now(),
    };
    if (method.data === "eth_sendTransaction" && params.length === 1) {
      const tx = record(params[0]);
      if (!tx) return result;
      if (tx.chainId !== undefined) result.chainId = chain(tx.chainId);
      const target = address.safeParse(tx.to);
      if (target.success) result.target = target.data;
      // Native value, malformed data or unknown selectors cannot be labelled ERC20.
      if (
        !target.success ||
        (tx.value !== undefined && chain(tx.value) !== "0") ||
        typeof tx.data !== "string" ||
        !/^0x[\da-fA-F]{136}$/.test(tx.data)
      )
        return result;
      try {
        const decoded = decodeFunctionData({
          abi: erc20,
          data: tx.data as `0x${string}`,
        });
        result.kind =
          decoded.functionName === "approve" ? "approval" : "transfer";
        result.spender = decoded.args[0];
        result.amount = decoded.args[1].toString();
        result.unlimited =
          decoded.functionName === "approve" &&
          decoded.args[1] === (1n << 256n) - 1n;
      } catch {
        /* unknown contract call */
      }
    } else if (method.data === "eth_signTypedData_v4") {
      result.kind = "typed-data";
      const raw = params[1];
      const typed = record(typeof raw === "string" ? JSON.parse(raw) : raw);
      const domain = record(typed?.domain);
      result.chainId = chain(
        typeof domain?.chainId === "number" &&
          Number.isSafeInteger(domain.chainId)
          ? String(domain.chainId)
          : domain?.chainId,
      );
      const target = address.safeParse(domain?.verifyingContract);
      if (target.success) result.target = target.data;
    } else if (method.data === "wallet_sendCalls") {
      result.chainId = chain(record(params[0])?.chainId);
    }
    return walletObservationSchema.parse(result);
  } catch {
    return null;
  }
}
