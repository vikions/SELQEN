import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AAPL } from "../packages/engine/types";
import { checkAsset } from "../packages/robinhood";
const mocks = vi.hoisted(() => ({ chain: 4663, failRpc: false }));
vi.mock("viem", async (importOriginal) => ({
  ...(await importOriginal<typeof import("viem")>()),
  createPublicClient: () => ({
    getChainId: async () => mocks.chain,
    getBlockNumber: async () => 100n,
    readContract: async ({
      functionName,
      address,
    }: {
      functionName: string;
      address: string;
    }) => {
      if (mocks.failRpc) throw new Error("offline");
      if (functionName === "decimals") return 8;
      if (functionName === "description")
        return address.toLowerCase().startsWith("0x6b22")
          ? "Robinhood AAPL / USD"
          : "USDG / USD";
      if (functionName === "latestRoundData") {
        const time = BigInt(Math.floor(Date.now() / 1000));
        return [
          2n,
          address.toLowerCase().startsWith("0x6b22")
            ? 20000000000n
            : 100000000n,
          time,
          time,
          2n,
        ];
      }
      return functionName === "oraclePaused"
        ? false
        : functionName === "effectiveAt"
          ? 0n
          : 1000000000000000000n;
    },
  }),
}));
const deployment = { contractAddress: AAPL, chainId: 4663 };
const asset = {
  id: "fixture-uid",
  tokenSymbol: "AAPL",
  tokenName: "Fixture Apple",
  deployments: [deployment],
  currentMultiplier: "1.000000000000000000",
  pendingMultiplier: "",
  status: "ASSET_STATUS_ACTIVE",
  tradingCapabilities: {
    market: {
      whole: "TRADING_STATUS_TRADABLE",
      fractional: "TRADING_STATUS_TRADABLE",
    },
  },
};
beforeEach(() => {
  mocks.chain = 4663;
  mocks.failRpc = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.endsWith("/assets")
              ? { assets: [asset] }
              : url.includes("/prices/")
                ? {
                    quotes: [
                      {
                        tokenSymbol: "AAPL",
                        deployments: [deployment],
                        bid: "200",
                        ask: "201",
                        currency: "USD",
                        isTradingHalt: false,
                        generatedAt: new Date().toISOString(),
                      },
                    ],
                  }
                : { corpActions: [] },
          ),
          { status: 200 },
        ),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());
describe("official source boundary", () => {
  it("normalizes registry, token state and independently read feeds", async () => {
    const s = await checkAsset(AAPL);
    expect(s.canonical).toBe(true);
    expect(s.onchainMultiplier).toBe("1");
    expect(s.oraclePaused).toBe(false);
    expect(s.oracle?.value).toBe("200");
    expect(s.settlementOracle?.value).toBe("1");
    expect(s.tradingCapabilities).toEqual(asset.tradingCapabilities);
  });
  it("does not fetch prices for a noncanonical address", async () => {
    const s = await checkAsset("0x000000000000000000000000000000000000dead");
    expect(s.canonical).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("fails closed on RPC network mismatch", async () => {
    mocks.chain = 1;
    const s = await checkAsset(AAPL);
    expect(s.oraclePaused).toBeNull();
    expect(s.onchainMultiplier).toBeUndefined();
  });
  it("reports HTTP failure without fabricating identity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("denied", { status: 403 })),
    );
    const s = await checkAsset(AAPL);
    expect(s.canonical).toBeNull();
    expect(s.errors[0]).toContain("HTTP 403");
  });
  it("fails closed on malformed registry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ assets: [{ ...asset, currentMultiplier: null }] }),
          ),
      ),
    );
    const s = await checkAsset(AAPL);
    expect(s.canonical).toBeNull();
  });
  it("leaves critical contract state unknown after RPC failure", async () => {
    mocks.failRpc = true;
    const s = await checkAsset(AAPL);
    expect(s.oraclePaused).toBeNull();
    expect(s.halt).toBe(false);
  });
  it("does not reach the network for a wrong-chain input", async () => {
    const s = await checkAsset(AAPL, 46630);
    expect(s.canonical).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
