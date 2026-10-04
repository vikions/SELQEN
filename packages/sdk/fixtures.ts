import { AAPL, USDG, type Snapshot, type Intent } from "../engine/types";
export const scenarios = [
  {
    id: "canonical",
    label: "Canonical asset",
    description: "The address matches. See exactly what was checked.",
  },
  {
    id: "impostor",
    label: "Same ticker. Different token.",
    description: "A controlled AAPL lookalike fails the address check.",
  },
  {
    id: "corporate",
    label: "Corporate action",
    description: "A scheduled multiplier change needs your attention.",
  },
  {
    id: "quote",
    label: "Unfavorable settlement",
    description: "The proposed USDG output differs from the reference.",
  },
  {
    id: "stale",
    label: "Outdated price",
    description: "A recent page load does not make an old quote current.",
  },
  {
    id: "halt",
    label: "Trading halt",
    description: "The issuer reports a halt. Pause the review.",
  },
] as const;
export type Scenario = (typeof scenarios)[number]["id"];
export function fixture(
  id: Scenario,
  now: number,
): { snapshot: Snapshot; intent: Intent } {
  const snapshot: Snapshot = {
    mode: "fixture",
    chainId: 4663,
    address: AAPL,
    symbol: "AAPL",
    name: "Apple · Robinhood Token",
    canonical: true,
    registryAt: now,
    fetchedAt: now,
    assetStatus: "ASSET_STATUS_ACTIVE",
    bid: "211.30",
    ask: "211.50",
    multiplier: "1.002",
    onchainMultiplier: "1.002",
    quoteAt: now - 4000,
    halt: false,
    oraclePaused: false,
    oracle: {
      value: "211.8228",
      updatedAt: now - 6000,
      maxAgeMs: 90_000,
      address: "LOCAL_FIXTURE_NOT_A_FEED",
    },
    errors: [],
  };
  const intent: Intent = {
    chainId: 4663,
    tokenAddress: AAPL,
    outputAddress: USDG,
    amount: "0.5",
    proposedOutput: "105.70",
    source: "fixture",
    observedAt: now,
    quoteAt: now - 4000,
    coverage: "quote-only",
    amountUnit: "raw-token",
  };
  if (id === "impostor") {
    snapshot.address = "0x000000000000000000000000000000000000dead";
    snapshot.canonical = false;
    intent.tokenAddress = snapshot.address;
  }
  if (id === "corporate") {
    snapshot.pendingMultiplier = "4.008";
    snapshot.effectiveAt = now + 3_600_000;
  }
  if (id === "quote") intent.proposedOutput = "99.48";
  if (id === "stale") snapshot.quoteAt = now - 600_000;
  if (id === "halt") snapshot.halt = true;
  return { snapshot, intent };
}
