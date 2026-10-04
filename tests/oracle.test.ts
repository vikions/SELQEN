import { expect, it, vi } from "vitest";
import type { PublicClient } from "viem";
import { normalizeRound, readEquityOracle } from "../packages/robinhood/oracle";
import catalog from "../packages/robinhood/feeds.json";
const now = 1_800_000_000_000;
const time = BigInt(now / 1000);
it("selects NVDA by canonical address on the correct chain, at the requested block", async () => {
  const nvda = catalog.feeds.find((f) => f.symbol === "NVDA")!;
  const updated = BigInt(Math.floor(Date.now() / 1000) - 1);
  const readContract = vi.fn(
    async ({ functionName }: { functionName: string }) =>
      functionName === "decimals"
        ? 8
        : functionName === "description"
          ? "RHNVDA / USD"
          : [2n, 18000000000n, updated, updated, 2n],
  );
  const client = { readContract } as unknown as PublicClient;
  const oracle = await readEquityOracle(
    client,
    nvda.tokenAddress.toLowerCase(),
    4663,
    42n,
  );
  expect(oracle).toMatchObject({ value: "180", address: nvda.feedAddress });
  for (const [call] of readContract.mock.calls)
    expect(call).toMatchObject({ address: nvda.feedAddress, blockNumber: 42n });
  readContract.mockClear();
  expect(
    await readEquityOracle(client, nvda.tokenAddress, 1, 42n),
  ).toBeUndefined();
  expect(
    await readEquityOracle(
      client,
      "0x1111111111111111111111111111111111111111",
      4663,
      42n,
    ),
  ).toBeUndefined();
  expect(readContract).not.toHaveBeenCalled();
});
it("rejects a mismatched onchain feed description", async () => {
  const nvda = catalog.feeds.find((f) => f.symbol === "NVDA")!;
  const client = {
    readContract: async ({ functionName }: { functionName: string }) =>
      functionName === "decimals"
        ? 8
        : functionName === "description"
          ? "Robinhood AAPL / USD"
          : [2n, 1n, 1n, 1n, 2n],
  } as unknown as PublicClient;
  await expect(
    readEquityOracle(client, nvda.tokenAddress, 4663, 42n),
  ).rejects.toThrow("description mismatch");
});
it("retains adjusted feed value and actual update time", () => {
  expect(
    normalizeRound([2n, 12345678901n, time, time, 2n], 8, now),
  ).toMatchObject({
    value: "123.45678901",
    updatedAt: now,
    maxAgeMs: 86400000,
  });
});
it("rejects invalid rounds, decimals and future timestamps", () => {
  for (const round of [
    [0n, 1n, time, time, 0n],
    [2n, 0n, time, time, 2n],
    [2n, 1n, time, time, 1n],
    [2n, 1n, time, time + 1n, 2n],
    [2n, 1n, time, time - 1n, 2n],
  ] as const)
    expect(() => normalizeRound(round, 8, now)).toThrow();
  expect(() => normalizeRound([2n, 1n, time, time, 2n], 18, now)).toThrow();
});
