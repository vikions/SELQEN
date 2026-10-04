import { expect, it } from "vitest";
import { normalizeRound } from "../packages/robinhood/oracle";
const now = 1_800_000_000_000;
const time = BigInt(now / 1000);
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
