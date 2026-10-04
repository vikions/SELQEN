export type SourceMode = "live" | "fixture";
export type Level = "pass" | "warning" | "blocked";
export interface Finding {
  code: string;
  level: Level;
  title: string;
  detail: string;
}
export interface Snapshot {
  mode: SourceMode;
  chainId: number;
  address: string;
  symbol?: string;
  name?: string;
  canonical: boolean | null;
  registryAt: number;
  fetchedAt: number;
  assetStatus?: string;
  bid?: string;
  ask?: string;
  quoteAt?: number;
  halt: boolean | null;
  multiplier?: string;
  pendingMultiplier?: string;
  effectiveAt?: number;
  onchainMultiplier?: string;
  oraclePaused: boolean | null;
  blockNumber?: string;
  oracle?: {
    value: string;
    updatedAt: number;
    maxAgeMs: number;
    address: string;
  };
  settlementOracle?: Snapshot["oracle"];
  tradingCapabilities?: unknown;
  corporateActions?: string[];
  errors: string[];
}
export interface Intent {
  chainId: number;
  tokenAddress: string;
  outputAddress: string;
  amount: string;
  proposedOutput: string;
  source: "manual" | "uniswap-page" | "fixture";
  observedAt: number;
  quoteAt?: number;
  coverage: "quote-only";
  amountUnit: "raw-token";
}
export interface Policy {
  now: number;
  maxQuoteAgeMs: number;
  maxRegistryAgeMs: number;
  deviationPercent: string;
}
export interface Result {
  verdict: "verified" | "warning" | "blocked";
  title: string;
  scope: string;
  findings: Finding[];
  expectedUsd?: string;
  expectedUsdg?: string;
  deviationPercent?: string;
  checkedAt: number;
  expiresAt: number;
}
export const MAINNET = 4663;
export const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
export const AAPL = "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9";
export const sameAddress = (a: string, b: string) =>
  a.toLowerCase() === b.toLowerCase();
export const policyAt = (now: number): Policy => ({
  now,
  maxQuoteAgeMs: 90_000,
  maxRegistryAgeMs: 300_000,
  deviationPercent: "3",
});
