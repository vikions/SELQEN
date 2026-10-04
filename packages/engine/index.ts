import Decimal from "decimal.js";
import {
  MAINNET,
  USDG,
  sameAddress,
  type Snapshot,
  type Intent,
  type Policy,
  type Result,
  type Finding,
} from "./types";
Decimal.set({ precision: 60, toExpNeg: -60, toExpPos: 60 });
const positive = (x?: string): Decimal | undefined => {
  try {
    if (!x || !/^\d+(\.\d+)?$/.test(x)) return;
    const n = new Decimal(x);
    return n.isFinite() && n.gt(0) ? n : undefined;
  } catch {
    return;
  }
};
export function evaluate(
  s: Snapshot,
  intent: Intent | undefined,
  p: Policy,
): Result {
  const findings: Finding[] = [];
  const add = (
    code: string,
    level: Finding["level"],
    title: string,
    detail: string,
  ) => findings.push({ code, level, title, detail });
  const fresh = (t: number | undefined, age: number) =>
    t !== undefined &&
    Number.isFinite(t) &&
    t <= p.now + 5_000 &&
    p.now - t <= age;
  if (s.chainId !== MAINNET)
    add(
      "WRONG_CHAIN",
      "blocked",
      "Wrong network",
      "This checker verifies Robinhood Chain mainnet (4663). Testnet assets use a separate registry.",
    );
  if (s.canonical !== true)
    add(
      "CANONICAL",
      "blocked",
      s.canonical === false ? "Unverified asset" : "Registry unavailable",
      s.canonical === false
        ? "This address is not in the official Robinhood Stock Token registry. A matching ticker does not establish identity."
        : "Canonical identity could not be established. Refresh before relying on this check.",
    );
  else if (!fresh(s.registryAt, p.maxRegistryAgeMs))
    add(
      "REGISTRY_STALE",
      "blocked",
      "Registry check expired",
      "Refresh the official registry before continuing.",
    );
  else
    add(
      "CANONICAL",
      "pass",
      "Canonical asset",
      "Address and chain match the official Robinhood registry.",
    );
  if (s.canonical === true) {
    if (s.assetStatus !== "ASSET_STATUS_ACTIVE")
      add(
        "ASSET_STATUS",
        "blocked",
        "Asset status unavailable or inactive",
        "The issuer has not confirmed an active asset in this snapshot.",
      );
    if (s.halt !== false)
      add(
        "HALT",
        "blocked",
        s.halt ? "Trading halt reported" : "Trading state unavailable",
        "A current, explicit no-halt response is required for valuation review.",
      );
    else
      add(
        "HALT",
        "pass",
        "No trading halt reported",
        "Issuer halt status only; this does not guarantee that a DEX trade can execute.",
      );
    if (!fresh(s.quoteAt, p.maxQuoteAgeMs))
      add(
        "QUOTE_STALE",
        "blocked",
        "Price is not current",
        "The underlying quote is missing, expired or future-dated. Closed markets may retain the last quote; it is not a live settlement reference.",
      );
    if (s.oraclePaused !== false)
      add(
        "ORACLE_PAUSED",
        "blocked",
        s.oraclePaused ? "Oracle paused" : "Oracle pause state unavailable",
        "A corporate-action pause or unknown state means the displayed price cannot be trusted for this review.",
      );
  }
  const multiplier = positive(s.multiplier),
    bid = positive(s.bid),
    ask = positive(s.ask),
    onchain = positive(s.onchainMultiplier);
  if (s.canonical === true) {
    if (!multiplier || !bid || !ask || bid.gt(ask))
      add(
        "INVALID_PRICE",
        "blocked",
        "Valuation data is invalid",
        "Positive bid, ask and multiplier are required, with bid no greater than ask.",
      );
    if (!onchain)
      add(
        "MULTIPLIER_UNAVAILABLE",
        "blocked",
        "Onchain multiplier unavailable",
        "The REST multiplier could not be checked against the token contract.",
      );
    else if (multiplier && !onchain.eq(multiplier))
      add(
        "MULTIPLIER_MISMATCH",
        "blocked",
        "Multiplier sources disagree",
        "Refresh both sources. A corporate-action update may be in progress.",
      );
    else if (multiplier)
      add(
        "MULTIPLIER",
        "pass",
        "Multiplier reconciled",
        "Underlying bid/ask is adjusted once. The token contract agrees with the issuer metadata.",
      );
    if (s.pendingMultiplier) {
      if (
        !positive(s.pendingMultiplier) ||
        !s.effectiveAt ||
        !Number.isFinite(s.effectiveAt)
      )
        add(
          "PENDING_INVALID",
          "blocked",
          "Incomplete corporate-action data",
          "A pending multiplier needs a valid effective time.",
        );
      else {
        add(
          "PENDING_ACTION",
          "warning",
          "Corporate action pending",
          `Multiplier changes from ${s.multiplier} to ${s.pendingMultiplier} at ${new Date(s.effectiveAt).toISOString()}. Refresh quotes around this change.`,
        );
        if (
          p.now >= s.effectiveAt ||
          (intent?.quoteAt !== undefined &&
            intent.quoteAt < s.effectiveAt &&
            p.now >= s.effectiveAt)
        )
          add(
            "MULTIPLIER_TRANSITION",
            "blocked",
            "Multiplier transition requires refresh",
            "A scheduled change has reached its effective time. Acquire a coherent price and multiplier snapshot before review.",
          );
      }
    }
    if (!s.oracle)
      add(
        "ORACLE_UNAVAILABLE",
        "warning",
        "Independent oracle not checked",
        "No verified Chainlink feed result is available. Canonical identity and REST data do not complete price verification.",
      );
    else if (
      !positive(s.oracle.value) ||
      !Number.isFinite(s.oracle.updatedAt) ||
      s.oracle.updatedAt <= 0 ||
      s.oracle.updatedAt > p.now + 5_000
    )
      add(
        "ORACLE_INVALID",
        "blocked",
        "Invalid oracle reference",
        "The oracle answer or its timestamp is invalid.",
      );
    else if (!fresh(s.oracle.updatedAt, s.oracle.maxAgeMs))
      add(
        "ORACLE_STALE",
        intent ? "blocked" : "warning",
        "Current oracle price unavailable",
        `Last oracle update: ${new Date(s.oracle.updatedAt).toISOString()}. Equity feeds may retain their last price outside trading sessions. This price is not being treated as current or used to validate a trade.`,
      );
    else if (multiplier && bid && ask) {
      const v = new Decimal(s.oracle.value),
        lo = bid.mul(multiplier).mul("0.97"),
        hi = ask.mul(multiplier).mul("1.03");
      if (v.lt(lo) || v.gt(hi))
        add(
          "ORACLE_DISAGREEMENT",
          "blocked",
          "Price sources disagree",
          "The adjusted REST range and independent oracle differ materially.",
        );
      else
        add(
          "ORACLE",
          "pass",
          "Oracle reference agrees",
          "The multiplier-adjusted oracle is within the configured reference tolerance.",
        );
    }
  }
  let expectedUsd: string | undefined,
    expectedUsdg: string | undefined,
    deviationPercent: string | undefined;
  if (intent) {
    const settlementPrice = positive(s.settlementOracle?.value);
    if (
      s.settlementOracle &&
      (!settlementPrice ||
        !fresh(s.settlementOracle.updatedAt, s.settlementOracle.maxAgeMs))
    )
      add(
        "SETTLEMENT_ORACLE_STALE",
        "blocked",
        "USDG reference is not current",
        "The USDG oracle answer is invalid or outside its freshness window. Refresh before comparison.",
      );
    if (
      !fresh(intent.observedAt, p.maxQuoteAgeMs) ||
      (intent.quoteAt !== undefined && !fresh(intent.quoteAt, p.maxQuoteAgeMs))
    )
      add(
        "INTENT_STALE",
        "blocked",
        "Trade review expired",
        "Refresh the proposed amounts before reviewing them.",
      );
    if (
      intent.chainId !== s.chainId ||
      !sameAddress(intent.tokenAddress, s.address)
    )
      add(
        "INTENT_MISMATCH",
        "blocked",
        "Trade context changed",
        "The quote does not describe the verified token and chain.",
      );
    const amount = positive(intent.amount),
      out = positive(intent.proposedOutput);
    if (!amount || !out)
      add(
        "AMOUNT_INVALID",
        "blocked",
        "Enter valid trade amounts",
        "Both token amount and proposed settlement must be positive decimal values.",
      );
    if (!sameAddress(intent.outputAddress, USDG))
      add(
        "OUTPUT_UNSUPPORTED",
        "blocked",
        "Settlement asset not supported",
        "This MVP compares only the verified Robinhood mainnet USDG contract.",
      );
    else if (
      amount &&
      out &&
      multiplier &&
      bid &&
      s.canonical === true &&
      !findings.some((f) => f.level === "blocked")
    ) {
      expectedUsd = amount.mul(multiplier).mul(bid).toFixed();
      expectedUsdg = new Decimal(expectedUsd)
        .div(settlementPrice ?? 1)
        .toFixed();
      deviationPercent = out.div(expectedUsdg).minus(1).mul(100).toFixed();
      if (settlementPrice)
        add(
          "USDG_ORACLE",
          "pass",
          "USDG market reference checked",
          "The indicative USD value is converted using the independently read USDG/USD oracle.",
        );
      else
        add(
          "USDG_PARITY",
          "warning",
          "USDG parity assumption",
          "The indicative USDG reference assumes 1 USDG = 1 USD. A live USDG/USD market reference has not been verified.",
        );
      if (new Decimal(deviationPercent).abs().gte(p.deviationPercent))
        add(
          "DEVIATION",
          "warning",
          "Settlement differs from reference",
          `Proposed output differs by ${new Decimal(deviationPercent).toFixed(2)}%. Liquidity, fees and price impact may explain the difference.`,
        );
    }
    if (intent.quoteAt === undefined)
      add(
        "QUOTE_TIME_UNKNOWN",
        "warning",
        "Quote creation time unknown",
        "Page observation time is not a quote timestamp. Corporate-action timing cannot be fully checked.",
      );
    add(
      "SIGNATURE_NOT_INSPECTED",
      "warning",
      "Signature not inspected",
      "This is a quote review. Wallet calldata, allowances, recipient and minimum received have not been verified.",
    );
  }
  for (const error of s.errors)
    add("SOURCE_ERROR", "warning", "Source limitation", error);
  const verdict = findings.some((f) => f.level === "blocked")
    ? "blocked"
    : findings.some((f) => f.level === "warning")
      ? "warning"
      : "verified";
  return {
    verdict,
    title:
      verdict === "blocked"
        ? "Do not sign yet"
        : verdict === "warning"
          ? !intent && findings.some((f) => f.code === "ORACLE_STALE")
            ? "Price check incomplete"
            : "Review required"
          : "Asset checks passed",
    scope: intent
      ? "Quote review · signature not inspected"
      : "Asset review · no transaction inspected",
    findings,
    expectedUsd,
    expectedUsdg,
    deviationPercent,
    checkedAt: p.now,
    expiresAt: Math.min(
      s.quoteAt !== undefined ? s.quoteAt + p.maxQuoteAgeMs : p.now,
      s.registryAt + p.maxRegistryAgeMs,
      intent ? intent.observedAt + p.maxQuoteAgeMs : Infinity,
      s.oracle ? s.oracle.updatedAt + s.oracle.maxAgeMs : Infinity,
      intent && s.settlementOracle
        ? s.settlementOracle.updatedAt + s.settlementOracle.maxAgeMs
        : Infinity,
    ),
  };
}
