import { describe, expect, it } from "vitest";
import { evaluate } from "../packages/engine/index";
import {
  AAPL,
  USDG,
  policyAt,
  type Snapshot,
  type Intent,
} from "../packages/engine/types";
const now = 1_800_000_000_000;
const valid = (): Snapshot => ({
  mode: "fixture",
  chainId: 4663,
  address: AAPL,
  symbol: "AAPL",
  canonical: true,
  registryAt: now,
  fetchedAt: now,
  assetStatus: "ASSET_STATUS_ACTIVE",
  bid: "200",
  ask: "201",
  quoteAt: now,
  halt: false,
  multiplier: "1.25",
  onchainMultiplier: "1.25",
  oraclePaused: false,
  oracle: {
    value: "250",
    updatedAt: now,
    maxAgeMs: 60_000,
    address: "fixture",
  },
  errors: [],
});
const intent = (): Intent => ({
  chainId: 4663,
  tokenAddress: AAPL,
  outputAddress: USDG,
  amount: "2",
  proposedOutput: "500",
  source: "fixture",
  observedAt: now,
  quoteAt: now,
  coverage: "quote-only",
  amountUnit: "raw-token",
});
describe("fail-closed safety evaluation", () => {
  it("converts settlement using USDG/USD and rejects a stale reference", () => {
    const s = valid();
    s.settlementOracle = {
      value: "0.5",
      updatedAt: now,
      maxAgeMs: 60000,
      address: "fixture",
    };
    const result = evaluate(s, intent(), policyAt(now));
    expect(result.expectedUsdg).toBe("1000");
    expect(result.deviationPercent).toBe("-50");
    expect(result.findings.some((f) => f.code === "USDG_PARITY")).toBe(false);
    s.settlementOracle.updatedAt -= 60001;
    expect(evaluate(s, intent(), policyAt(now)).expectedUsdg).toBeUndefined();
  });
  it("normalizes a reference once, without implying transaction safety", () => {
    const r = evaluate(valid(), intent(), policyAt(now));
    expect(r.expectedUsd).toBe("500");
    expect(r.verdict).toBe("warning");
    expect(r.findings.some((f) => f.code === "SIGNATURE_NOT_INSPECTED")).toBe(
      true,
    );
  });
  it("rejects a matching ticker without canonical provenance", () => {
    const s = valid();
    s.canonical = false;
    expect(evaluate(s, undefined, policyAt(now)).verdict).toBe("blocked");
  });
  it.each([undefined, "0", "-1", "NaN", "Infinity", "abc"])(
    "rejects invalid multiplier %s",
    (m) => {
      const s = valid();
      s.multiplier = m;
      expect(evaluate(s, undefined, policyAt(now)).verdict).toBe("blocked");
    },
  );
  it("never greenlights unavailable registry", () => {
    const s = valid();
    s.canonical = null;
    expect(evaluate(s, undefined, policyAt(now)).verdict).toBe("blocked");
  });
  it("rejects missing halt or oracle-pause state", () => {
    const s = valid();
    s.halt = null;
    s.oraclePaused = null;
    expect(evaluate(s, undefined, policyAt(now)).verdict).toBe("blocked");
  });
  it("rejects a wrong-chain or wrong-token intent", () => {
    for (const i of [
      { ...intent(), chainId: 46630 },
      { ...intent(), tokenAddress: USDG },
    ])
      expect(evaluate(valid(), i, policyAt(now)).verdict).toBe("blocked");
  });
  it("expires source quotes independently of fetch time", () => {
    const s = valid();
    s.quoteAt = now - 91_000;
    expect(evaluate(s, intent(), policyAt(now)).verdict).toBe("blocked");
  });
  it("rejects future timestamps", () => {
    const s = valid();
    s.quoteAt = now + 60_000;
    expect(evaluate(s, undefined, policyAt(now)).verdict).toBe("blocked");
  });
  it("checks a paused oracle even with a fresh answer", () => {
    const s = valid();
    s.oraclePaused = true;
    expect(evaluate(s, undefined, policyAt(now)).verdict).toBe("blocked");
  });
  it("rejects multiplier disagreement", () => {
    const s = valid();
    s.onchainMultiplier = "1";
    expect(evaluate(s, undefined, policyAt(now)).verdict).toBe("blocked");
  });
  it("does not invent an independent oracle check", () => {
    const s = valid();
    delete s.oracle;
    expect(evaluate(s, undefined, policyAt(now)).verdict).toBe("warning");
  });
  it("flags a pending action and blocks quotes across its transition", () => {
    const s = valid();
    s.pendingMultiplier = "5";
    s.effectiveAt = now - 1000;
    const i = { ...intent(), quoteAt: now - 2000 };
    expect(
      evaluate(s, i, policyAt(now)).findings.some(
        (f) => f.code === "MULTIPLIER_TRANSITION" && f.level === "blocked",
      ),
    ).toBe(true);
  });
  it("does not compute settlement from unsupported output token", () => {
    const i = { ...intent(), outputAddress: AAPL };
    const r = evaluate(valid(), i, policyAt(now));
    expect(r.expectedUsdg).toBeUndefined();
    expect(r.verdict).toBe("blocked");
  });
  it("preserves precision for small token quantities", () => {
    const i = {
      ...intent(),
      amount: "0.000000000000000001",
      proposedOutput: "0.00000000000000025",
    };
    expect(evaluate(valid(), i, policyAt(now)).expectedUsd).toBe(
      "0.00000000000000025",
    );
  });
  it("recognizes adverse quote deviation", () => {
    const i = { ...intent(), proposedOutput: "450" };
    expect(evaluate(valid(), i, policyAt(now)).deviationPercent).toBe("-10");
  });
  it("withholds a reference when price evidence is stale", () => {
    const s = valid();
    s.quoteAt = now - 120_000;
    expect(evaluate(s, intent(), policyAt(now)).expectedUsdg).toBeUndefined();
  });
  it("does not call unknown status active", () => {
    const s = valid();
    s.assetStatus = "NEW_UNKNOWN_STATUS";
    expect(evaluate(s, undefined, policyAt(now)).verdict).toBe("blocked");
  });
});
