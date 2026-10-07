import { describe, it, expect, vi } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  keccak256,
  TransactionReceiptNotFoundError,
  type Hex,
  type PublicClient,
} from "viem";
import { parseReceiptFile, MAX_RECEIPT_BYTES } from "../packages/receipts";
import {
  anchorReceipt,
  connectWallet,
  readAnchor,
  submissionStatus,
  registryAbi,
  REGISTRY,
  RUNTIME_HASH,
  type WalletProvider,
} from "../packages/receipts/registry";
import fixture from "./fixtures/registry.json";
import { fixture as reviewFixture } from "../packages/sdk/fixtures";
import { receipt } from "../packages/sdk";

const hash = `0x${"ab".repeat(32)}` as Hex;
const transaction = `0x${"cd".repeat(32)}` as Hex;
const account = "0x2222222222222222222222222222222222222222";
const time = 1791374400n;
const bytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value));
function setup() {
  const log = {
    address: REGISTRY,
    topics: encodeEventTopics({
      abi: registryAbi,
      eventName: "ReceiptAnchored",
      args: { receiptHash: hash, author: account },
    }),
    data: encodeAbiParameters([{ type: "uint256" }], [time]),
  };
  const rpc = {
    getChainId: vi.fn().mockResolvedValue(4663),
    getCode: vi.fn().mockResolvedValue(fixture.runtime),
    readContract: vi.fn().mockResolvedValue(0n),
    simulateContract: vi.fn().mockResolvedValue({}),
    waitForTransactionReceipt: vi
      .fn()
      .mockResolvedValue({ status: "success", logs: [log] }),
    getTransactionReceipt: vi.fn().mockResolvedValue({ status: "reverted" }),
  };
  const request = vi.fn(async ({ method }: { method: string }) => {
    if (method === "eth_chainId") return "0x1237";
    if (method === "eth_accounts" || method === "eth_requestAccounts")
      return [account];
    if (method === "eth_sendTransaction") return transaction;
    throw new Error(`Unexpected wallet request: ${method}`);
  });
  return {
    rpc,
    client: rpc as unknown as PublicClient,
    provider: { request } as WalletProvider,
    request,
    log,
  };
}
describe("receipt file identity", () => {
  it("accepts the SDK export shape for a live review", () => {
    const now = Date.parse("2026-10-07T12:00:00.000Z");
    const snapshot = {
      ...reviewFixture("canonical", now).snapshot,
      mode: "live" as const,
    };
    expect(
      parseReceiptFile(bytes(receipt(snapshot, undefined, now))).data.snapshot,
    ).toMatchObject({ mode: "live", chainId: 4663 });
  });
  it("hashes original bytes, preserves unknown evidence and changes with whitespace", () => {
    const original = bytes(fixture.receipt);
    const parsed = parseReceiptFile(original);
    expect(parsed.hash).toBe(keccak256(original));
    expect(parsed.text).toContain("Controlled test input");
    expect(
      parseReceiptFile(
        new TextEncoder().encode(JSON.stringify(fixture.receipt, null, 2)),
      ).hash,
    ).not.toBe(parsed.hash);
  });
  it.each([
    { ...fixture.receipt, mode: "fixture" },
    {
      ...fixture.receipt,
      snapshot: { ...fixture.receipt.snapshot, mode: "fixture" },
    },
    {
      ...fixture.receipt,
      snapshot: { ...fixture.receipt.snapshot, chainId: 1 },
    },
    { ...fixture.receipt, schemaVersion: 2 },
    { ...fixture.receipt, createdAt: "not a date" },
  ])("rejects incompatible or synthetic receipts", (value) =>
    expect(() => parseReceiptFile(bytes(value))).toThrow("live receipt"),
  );
  it("rejects malformed UTF-8, malformed JSON and oversized files", () => {
    for (const data of [
      new Uint8Array([255]),
      new TextEncoder().encode("{"),
      new Uint8Array(MAX_RECEIPT_BYTES + 1),
      new Uint8Array(),
    ])
      expect(() => parseReceiptFile(data)).toThrow();
  });
});
describe("pinned receipt registry", () => {
  it("pins the deployed runtime and refuses another RPC chain or contract", async () => {
    expect(keccak256(fixture.runtime as Hex)).toBe(RUNTIME_HASH);
    const { rpc, client } = setup();
    rpc.getChainId.mockResolvedValueOnce(1);
    await expect(readAnchor(hash, client)).rejects.toThrow("mainnet");
    rpc.getCode.mockResolvedValueOnce("0x6000");
    await expect(readAnchor(hash, client)).rejects.toThrow("code");
    expect(rpc.readContract).not.toHaveBeenCalled();
  });
  it("rejects zero hashes before accessing wallet or RPC", async () => {
    const { client, provider, request, rpc } = setup();
    await expect(
      anchorReceipt(`0x${"0".repeat(64)}`, provider, vi.fn(), client),
    ).rejects.toThrow("Invalid");
    expect(request).not.toHaveBeenCalled();
    expect(rpc.getChainId).not.toHaveBeenCalled();
  });
  it("skips a duplicate without simulation or wallet transaction", async () => {
    const { client, rpc, provider, request } = setup();
    rpc.readContract.mockResolvedValue(time);
    expect(await anchorReceipt(hash, provider, vi.fn(), client)).toEqual({
      timestamp: time,
      alreadyAnchored: true,
    });
    expect(rpc.simulateContract).not.toHaveBeenCalled();
    expect(request.mock.calls.map(([args]) => args.method)).not.toContain(
      "eth_sendTransaction",
    );
  });
  it("sends only anchor(hash) to the pinned contract with zero ETH and confirms its event", async () => {
    const { client, rpc, provider, request } = setup();
    const submitted = vi.fn();
    expect(
      await anchorReceipt(hash, provider, submitted, client),
    ).toMatchObject({
      timestamp: time,
      alreadyAnchored: false,
      txHash: transaction,
      author: account,
    });
    expect(request).toHaveBeenCalledWith({
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
    expect(rpc.simulateContract).toHaveBeenCalledWith({
      address: REGISTRY,
      abi: registryAbi,
      functionName: "anchor",
      args: [hash],
      account,
    });
    expect(submitted).toHaveBeenCalledWith(transaction);
  });
  it("refuses account or network changes before sending", async () => {
    for (const change of ["account", "chain"]) {
      const { client, rpc, provider, request } = setup();
      rpc.simulateContract.mockImplementationOnce(async () => {
        request.mockImplementation(async ({ method }) =>
          method === "eth_chainId"
            ? change === "chain"
              ? "0x1"
              : "0x1237"
            : ["0x3333333333333333333333333333333333333333"],
        );
      });
      await expect(
        anchorReceipt(hash, provider, vi.fn(), client),
      ).rejects.toThrow("changed");
      expect(request.mock.calls.map(([args]) => args.method)).not.toContain(
        "eth_sendTransaction",
      );
    }
  });
  it("preserves rejection and never claims registration after cancellation", async () => {
    const { client, rpc, provider, request } = setup();
    request.mockImplementation(async ({ method }) => {
      if (method === "eth_sendTransaction") throw { code: 4001 };
      return method === "eth_chainId" ? "0x1237" : [account];
    });
    const submitted = vi.fn();
    await expect(
      anchorReceipt(hash, provider, submitted, client),
    ).rejects.toEqual({ code: 4001 });
    expect(submitted).not.toHaveBeenCalled();
    expect(rpc.waitForTransactionReceipt).not.toHaveBeenCalled();
  });
  it.each(["reverted", "missing event", "other contract", "other author"])(
    "refuses false confirmation: %s",
    async (condition) => {
      const { client, rpc, provider, log } = setup();
      const wrongAuthor = {
        ...log,
        topics: encodeEventTopics({
          abi: registryAbi,
          eventName: "ReceiptAnchored",
          args: {
            receiptHash: hash,
            author: "0x3333333333333333333333333333333333333333",
          },
        }),
      };
      rpc.waitForTransactionReceipt.mockResolvedValue({
        status: condition === "reverted" ? "reverted" : "success",
        logs:
          condition === "missing event"
            ? []
            : condition === "other contract"
              ? [{ ...log, address: account }]
              : condition === "other author"
                ? [wrongAuthor]
                : [log],
      });
      await expect(
        anchorReceipt(hash, provider, vi.fn(), client),
      ).rejects.toThrow(
        condition === "reverted" ? "reverted" : "expected registry event",
      );
    },
  );
  it("distinguishes a reverted submission from a missing pending receipt", async () => {
    const { client, rpc } = setup();
    expect(await submissionStatus(transaction, client)).toBe("reverted");
    rpc.getTransactionReceipt.mockRejectedValueOnce(
      new TransactionReceiptNotFoundError({ hash: transaction }),
    );
    expect(await submissionStatus(transaction, client)).toBe("pending");
    rpc.getTransactionReceipt.mockRejectedValueOnce(
      new Error("RPC unavailable"),
    );
    await expect(submissionStatus(transaction, client)).rejects.toThrow(
      "RPC unavailable",
    );
  });
  it("adds and switches an unknown Robinhood Chain without sending a transaction", async () => {
    const methods: string[] = [];
    let chain = "0x1";
    let first = true;
    const provider: WalletProvider = {
      request: async ({ method, params }) => {
        methods.push(method);
        if (method === "eth_requestAccounts") return [account];
        if (method === "eth_chainId") return chain;
        if (method === "wallet_switchEthereumChain") {
          if (first) {
            first = false;
            throw { code: 4902 };
          }
          chain = "0x1237";
          return null;
        }
        expect(method).toBe("wallet_addEthereumChain");
        expect(params?.[0]).toMatchObject({ chainId: "0x1237" });
        return null;
      },
    };
    expect(await connectWallet(provider)).toBe(account);
    expect(methods).toContain("wallet_addEthereumChain");
    expect(methods).not.toContain("eth_sendTransaction");
  });
});
