import React, { useState } from "react";
import {
  CheckIcon,
  ExclamationTriangleIcon,
  Cross2Icon,
  DownloadIcon,
  ChevronDownIcon,
  ArrowTopRightIcon,
  InfoCircledIcon,
} from "@radix-ui/react-icons";
import { evaluate } from "../engine";
import {
  policyAt,
  type Snapshot,
  type Intent,
  type Finding,
} from "../engine/types";
import { exportReceipt, receipt } from "../sdk";
export function Brand() {
  return (
    <div className="brand">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path
          d="M25 5H11L5 11v5h14l-4-4h-5l3-3h8ZM7 27h14l6-6v-5H13l4 4h5l-3 3h-8Z"
          fill="currentColor"
        />
      </svg>
      <span>
        SELQEN<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
const money = (n?: string) =>
  n
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(
        Number(n),
      )
    : "—";
const short = (s: string) =>
  s.length > 20 ? `${s.slice(0, 8)}…${s.slice(-6)}` : s;
function StatusIcon({ level }: { level: Finding["level"] }) {
  return level === "pass" ? (
    <CheckIcon />
  ) : level === "blocked" ? (
    <Cross2Icon />
  ) : (
    <ExclamationTriangleIcon />
  );
}
export function Review({
  snapshot,
  intent,
  now,
  busy = false,
  onRefresh,
  compactWarnings = false,
}: {
  snapshot: Snapshot | null;
  intent?: Intent;
  now: number;
  busy?: boolean;
  onRefresh?: () => void;
  compactWarnings?: boolean;
}) {
  const [copy, setCopy] = useState("Copy JSON");
  if (busy)
    return (
      <section className="review-body" aria-live="polite" aria-busy="true">
        <div className="skeleton large" />
        <div className="skeleton" />
        <div className="skeleton" />
        <p>Checking the official registry and token state…</p>
      </section>
    );
  if (!snapshot)
    return (
      <section className="empty">
        <div className="empty-mark">
          <ExclamationTriangleIcon />
        </div>
        <h2>
          Your next trade.
          <br />A clearer picture.
        </h2>
        <p>
          Paste a Stock Token contract below, or open a supported Uniswap token
          page.
        </p>
        <span className="muted">No wallet connection needed.</span>
      </section>
    );
  const r = evaluate(snapshot, intent, policyAt(now));
  const reasons = r.findings.filter((f) => f.level !== "pass");
  const primary =
    reasons.find((f) => f.level === "blocked") ??
    reasons.find(
      (f) => f.code === "PENDING_ACTION" || f.code === "DEVIATION",
    ) ??
    reasons[0];
  const outdated = now >= r.expiresAt;
  const compactPriceNotice =
    compactWarnings &&
    !intent &&
    r.verdict === "warning" &&
    reasons.some((f) => f.code === "ORACLE_STALE") &&
    reasons.every(
      (f) => f.code === "ORACLE_STALE" || f.code === "SOURCE_ERROR",
    );
  return (
    <div className="review-body">
      <div className="asset-heading">
        <span className="asset-monogram">
          {snapshot.symbol?.slice(0, 1) ?? "?"}
        </span>
        <div>
          <strong>{snapshot.symbol ?? "Unknown asset"}</strong>
          <span>{snapshot.name ?? "Contract identity check"}</span>
        </div>
        <span className="chain-label">RH</span>
      </div>
      {compactPriceNotice ? (
        <section className="price-notice" aria-live="polite">
          <div>
            <InfoCircledIcon />
            <h2>Last published price</h2>
          </div>
          <p>
            Updated {new Date(snapshot.oracle!.updatedAt).toLocaleString()}.
            Current price not confirmed.
          </p>
          <span>{r.scope}</span>
        </section>
      ) : (
        <section className={`verdict ${r.verdict}`} aria-live="polite">
          <div className="verdict-label">
            <StatusIcon
              level={
                r.verdict === "verified"
                  ? "pass"
                  : r.verdict === "blocked"
                    ? "blocked"
                    : "warning"
              }
            />
            <span>
              {snapshot.mode === "fixture"
                ? "SIMULATED RESULT"
                : "CURRENT REVIEW"}
            </span>
          </div>
          <h2>{r.title}</h2>
          <p>
            {primary?.detail ??
              "Canonical identity, valuation sources and reported trading state passed the configured checks."}
          </p>
          <div className="coverage">{r.scope}</div>
        </section>
      )}
      {intent && (
        <section className="settlement">
          <div className="section-title">
            <h3>Settlement review</h3>
            <span>USDG</span>
          </div>
          <div className="amount-row">
            <span>Proposed output</span>
            <strong>{money(intent.proposedOutput)}</strong>
          </div>
          <div className="amount-row">
            <span>Indicative reference</span>
            <strong>{money(r.expectedUsdg)}</strong>
          </div>
          {r.deviationPercent && (
            <div className="amount-row delta">
              <span>Difference</span>
              <strong>
                {Number(r.deviationPercent) > 0 ? "+" : ""}
                {Number(r.deviationPercent).toFixed(2)}%
              </strong>
            </div>
          )}
          <p className="fine">
            {snapshot.settlementOracle
              ? "Reference uses the USDG/USD oracle when current."
              : "Reference assumes USDG at $1."}{" "}
            Fees, liquidity and price impact can change execution.
          </p>
        </section>
      )}
      <section className="checks">
        <div className="section-title">
          <h3>What we checked</h3>
          <span>
            {r.findings.filter((f) => f.level === "pass").length} passed
          </span>
        </div>
        {r.findings
          .filter((f) => f.level === "pass")
          .map((f) => (
            <div className="check-pass" key={f.code}>
              <CheckIcon />
              <span>{f.title}</span>
              <span className="check-status">Verified</span>
            </div>
          ))}
        {reasons.map((f) => (
          <details
            className={`reason ${compactPriceNotice && f.code === "ORACLE_STALE" ? "price-info" : f.level}`}
            key={`${f.code}-${f.detail}`}
          >
            <summary>
              {compactPriceNotice && f.code === "ORACLE_STALE" ? (
                <InfoCircledIcon />
              ) : (
                <StatusIcon level={f.level} />
              )}
              <span>
                {compactPriceNotice && f.code === "ORACLE_STALE"
                  ? "Price timestamp and coverage"
                  : f.title}
              </span>
              <ChevronDownIcon />
            </summary>
            <p>{f.detail}</p>
          </details>
        ))}
      </section>
      <details className="evidence">
        <summary>
          Source evidence <ChevronDownIcon />
        </summary>
        <dl>
          <dt>Contract</dt>
          <dd className="contract" title={snapshot.address}>
            {snapshot.address}
          </dd>
          <dt>Network</dt>
          <dd>Robinhood Chain · {snapshot.chainId}</dd>
          <dt>Current multiplier</dt>
          <dd>{snapshot.multiplier ?? "Unavailable"}</dd>
          <dt>Pending multiplier</dt>
          <dd>{snapshot.pendingMultiplier ?? "None reported"}</dd>
          <dt>Source quote time</dt>
          <dd>
            {snapshot.quoteAt && Number.isFinite(snapshot.quoteAt)
              ? new Date(snapshot.quoteAt).toISOString()
              : "Unavailable"}
          </dd>
          <dt>Read at block</dt>
          <dd>
            {snapshot.blockNumber ??
              (snapshot.mode === "fixture" ? "Simulated" : "Unavailable")}
          </dd>
          <dt>Data provenance</dt>
          <dd>
            {snapshot.mode === "fixture"
              ? "Local synthetic scenario"
              : "Robinhood REST + public RPC"}
          </dd>
          {[
            ["Equity oracle", snapshot.oracle],
            ["USDG oracle", snapshot.settlementOracle],
          ].map(([label, feed]) => {
            const oracle = feed as Snapshot["oracle"];
            return oracle ? (
              <React.Fragment key={String(label)}>
                <dt>{String(label)}</dt>
                <dd className="contract">{oracle.address}</dd>
                <dt>USD reference / update time</dt>
                <dd>
                  {oracle.value} · {new Date(oracle.updatedAt).toISOString()}
                </dd>
              </React.Fragment>
            ) : null;
          })}
        </dl>
        {snapshot.mode === "live" && (
          <a
            href={`https://robinhoodchain.blockscout.com/address/${snapshot.address}`}
            target="_blank"
            rel="noreferrer"
          >
            View contract <ArrowTopRightIcon />
          </a>
        )}
      </details>
      <div className="receipt-actions">
        <button
          className="secondary"
          onClick={() => exportReceipt(snapshot, intent, now)}
        >
          <DownloadIcon />
          Export receipt
        </button>
        <button
          className="text-button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                JSON.stringify(receipt(snapshot, intent, now), null, 2),
              );
              setCopy("Copied");
            } catch {
              setCopy("Use export instead");
            }
            setTimeout(() => setCopy("Copy JSON"), 2500);
          }}
        >
          {copy}
        </button>
      </div>
      <div className="review-foot">
        <span>
          {outdated
            ? "Refresh needed"
            : `Checked ${new Date(snapshot.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
        </span>
        {onRefresh && (
          <button className="text-button" onClick={onRefresh}>
            Refresh check
          </button>
        )}
      </div>
    </div>
  );
}
export function AddressForm({
  onCheck,
  busy = false,
  initial = "",
}: {
  onCheck: (address: string) => void;
  busy?: boolean;
  initial?: string;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  return (
    <form
      className="address-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!/^0x[0-9a-fA-F]{40}$/.test(value.trim())) {
          setError("Enter a complete 0x contract address (42 characters).");
          return;
        }
        setError("");
        onCheck(value.trim());
      }}
    >
      <label htmlFor="contract-address">Check a contract</label>
      <div className="input-action">
        <input
          id="contract-address"
          spellCheck={false}
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0x…"
          aria-invalid={!!error}
          aria-describedby={error ? "address-error" : undefined}
        />
        <button disabled={busy} type="submit">
          Check
        </button>
      </div>
      {error && (
        <p id="address-error" className="field-error">
          {error}
        </p>
      )}
      <p className="fine">Robinhood Chain mainnet · chain ID 4663</p>
    </form>
  );
}
export { short, money };
