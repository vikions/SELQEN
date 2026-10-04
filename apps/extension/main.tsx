import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Brand, Review, AddressForm } from "../../packages/ui/Review";
import "../../packages/ui/styles.css";
import "./theme.css";
import { evaluate } from "../../packages/engine";
import {
  policyAt,
  USDG,
  type Snapshot,
  type Intent,
} from "../../packages/engine/types";
import type { PageContext } from "../../packages/adapters";
import {
  walletObservationSchema,
  type WalletObservation,
} from "../../packages/adapters/wallet";
function App() {
  const [wallet, setWallet] = useState<WalletObservation | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [now, setNow] = useState(Date.now()),
    [guard, setGuard] = useState(false),
    [context, setContext] = useState<PageContext | null>(null),
    [tabId, setTabId] = useState<number>(),
    [intent, setIntent] = useState<Intent>(),
    [amount, setAmount] = useState(""),
    [output, setOutput] = useState("");
  const sequence = useRef(0),
    contextKey = useRef(""),
    amountKey = useRef(""),
    lastAddress = useRef("");
  const manualForm = useRef<HTMLDetailsElement>(null);
  async function run(address: string, chainId = 4663) {
    const n = ++sequence.current;
    lastAddress.current = address;
    setAmount("");
    setOutput("");
    setSnapshot(null);
    setIntent(undefined);
    setBusy(true);
    setError("");
    try {
      const r = await chrome.runtime.sendMessage({
        type: "CHECK",
        address,
        chainId,
      });
      if (n !== sequence.current) return;
      if (r?.snapshot) setSnapshot(r.snapshot);
      else setError(r?.error ?? "No response. Retry the check.");
    } catch {
      if (n === sequence.current)
        setError(
          "Extension service unavailable. Reload the extension and try again.",
        );
    } finally {
      if (n === sequence.current) setBusy(false);
    }
  }
  useEffect(() => {
    void chrome.storage.local
      .get("guard")
      .then((r) => setGuard(r.guard === true));
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let alive = true;
    async function sync() {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!alive) return;
      const id = tab?.id;
      setTabId(id);
      const data =
        id === undefined
          ? {}
          : await chrome.storage.session.get([`context:${id}`, `wallet:${id}`]);
      if (!alive) return;
      const observed = walletObservationSchema.safeParse(data[`wallet:${id}`]);
      setWallet(observed.success ? observed.data : null);
      const next = (data[`context:${id}`] ?? null) as PageContext | null;
      const amounts = JSON.stringify([id, next?.url, next?.pageAmounts]);
      if (amounts !== amountKey.current) {
        amountKey.current = amounts;
        setAmount("");
        setOutput("");
        setIntent(undefined);
      }
      setContext(next);
      const key = `${id}:${next?.url ?? ""}`;
      if (key === contextKey.current) return;
      contextKey.current = key;
      sequence.current++;
      setBusy(false);
      setAmount("");
      setOutput("");
      setSnapshot(null);
      setIntent(undefined);
      setError("");
      lastAddress.current = "";
      if (next?.tokenAddress && next.chainId === 4663)
        void run(next.tokenAddress, next.chainId);
    }
    void sync();
    const interval = setInterval(() => void sync(), 1000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);
  const blocked =
    !!snapshot &&
    evaluate(snapshot, intent, policyAt(now)).verdict === "blocked";
  useEffect(() => {
    if (tabId !== undefined)
      void chrome.runtime.sendMessage({
        type: "GUARD_STATUS",
        tabId,
        visible: guard && blocked && !busy,
      });
    return () => {
      if (tabId !== undefined)
        void chrome.runtime
          .sendMessage({ type: "GUARD_STATUS", tabId, visible: false })
          .catch(() => {});
    };
  }, [guard, blocked, busy, tabId]);
  return (
    <main className="panel extension-panel">
      <header className="panel-header">
        <Brand />
        <p className="tagline">Know what you're signing.</p>
        <div className="mode-switch" aria-label="Review mode">
          {[false, true].map((g) => (
            <button
              key={String(g)}
              aria-pressed={guard === g}
              onClick={() => {
                setGuard(g);
                void chrome.storage.local.set({ guard: g });
              }}
            >
              {g ? "Guard" : "Observe"}
            </button>
          ))}
        </div>
      </header>
      <div className="source-strip">
        <span>LIVE SOURCES</span>
        <span>Robinhood Chain</span>
      </div>
      {guard && (
        <div className="guard-note">
          Guard adds page warnings. Your wallet stays in control.
        </div>
      )}
      <div className="context-bar">
        <strong>
          {context
            ? context.chainId === 4663 && context.tokenAddress
              ? "Uniswap · Robinhood Chain"
              : "Choose a Robinhood stock token"
            : "Generic token checker"}
        </strong>
        <p>
          {context
            ? context.chainId === 4663 && context.tokenAddress
              ? "Reviewing the token from this page’s URL."
              : "This URL does not identify a supported stock token. Paste its Robinhood Chain contract address below."
            : "Review any stock-token address against the official Robinhood registry."}
        </p>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {!snapshot && !busy ? (
        <section className="extension-start">
          <span className="start-label">A clearer first step</span>
          <h1>
            Check the token.
            <br />
            <span>Then decide.</span>
          </h1>
          <p>Identity, price and corporate actions — in one review.</p>
          <AddressForm busy={busy} onCheck={(a) => void run(a)} />
          <span className="start-footnote">
            Read-only check · No wallet connection needed
          </span>
        </section>
      ) : (
        <Review
          snapshot={snapshot}
          intent={intent}
          now={now}
          busy={busy}
          onRefresh={
            snapshot
              ? () => void run(lastAddress.current, snapshot.chainId)
              : undefined
          }
        />
      )}
      {context?.pageAmounts && (
        <section className="context-bar" aria-label="Observed page amounts">
          <strong>Amounts from Uniswap</strong>
          <p>
            {context.pageAmounts.input} {context.pageAmounts.inputLabel} →{" "}
            {context.pageAmounts.output} {context.pageAmounts.outputLabel}
          </p>
          <p>
            {now - context.pageAmounts.observedAt > 90_000
              ? "Observation expired. Change or refresh the quote."
              : "Observed on the page. Quote creation time and token-unit scaling are not confirmed."}
          </p>
          {snapshot?.canonical &&
            context.chainId === snapshot.chainId &&
            context.tokenAddress?.toLowerCase() ===
              snapshot.address.toLowerCase() &&
            context.outputAddress?.toLowerCase() === USDG.toLowerCase() &&
            context.pageAmounts.inputLabel === snapshot.symbol &&
            context.pageAmounts.outputLabel === "USDG" &&
            now - context.pageAmounts.observedAt <= 90_000 && (
              <button
                className="secondary"
                onClick={() => {
                  setAmount(context.pageAmounts!.input);
                  setOutput(context.pageAmounts!.output);
                  setIntent(undefined);
                  if (manualForm.current) manualForm.current.open = true;
                }}
              >
                Use as unscaled token amounts
              </button>
            )}
        </section>
      )}
      {context && wallet && (
        <section
          className="context-bar"
          aria-label="Wallet request observation"
        >
          <strong>
            {wallet
              ? "Wallet request observed"
              : "Waiting for a MetaMask request"}
          </strong>
          <p>
            Page-level observation; the page can alter or hide it. This does not
            verify a signature or pause MetaMask.
          </p>
          {wallet && (
            <>
              <p>
                {now - wallet.observedAt > 90_000
                  ? "Previous request — expired"
                  : "Recent request"}{" "}
                · {wallet.method}
              </p>
              <p>
                Request network: {wallet.chainId ?? "unknown"}
                {wallet.chainId !== "4663"
                  ? " — Robinhood Chain not confirmed"
                  : " (Robinhood Chain)"}
              </p>
              <p>
                {wallet.kind === "approval"
                  ? "ERC-20-shaped approval"
                  : wallet.kind === "transfer"
                    ? "ERC-20-shaped transfer"
                    : "Payload not fully decoded"}
              </p>
              {wallet.target && (
                <p>
                  Contract:{" "}
                  <code style={{ overflowWrap: "anywhere" }}>
                    {wallet.target}
                  </code>
                </p>
              )}
              {wallet.spender && (
                <p>
                  {wallet.kind === "approval" ? "Spender" : "Recipient"}:{" "}
                  <code style={{ overflowWrap: "anywhere" }}>
                    {wallet.spender}
                  </code>
                </p>
              )}
              {wallet.amount && (
                <p>
                  Amount in base units:{" "}
                  <code style={{ overflowWrap: "anywhere" }}>
                    {wallet.amount}
                  </code>
                  {wallet.unlimited ? " — unlimited approval" : ""}
                </p>
              )}
              <p>
                Contract identity, spender trust and swap outcome are not
                verified by this decoder.
              </p>
              <details>
                <summary>Request fingerprint</summary>
                <code style={{ overflowWrap: "anywhere" }}>{wallet.hash}</code>
              </details>
            </>
          )}
        </section>
      )}
      {snapshot && (
        <details className="live-form">
          <summary>Check another token</summary>
          <AddressForm busy={busy} onCheck={(a) => void run(a)} />
        </details>
      )}
      {snapshot?.canonical && (
        <details className="live-form" ref={manualForm}>
          <summary>Compare a USDG quote manually</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setIntent({
                chainId: snapshot.chainId,
                tokenAddress: snapshot.address,
                outputAddress: USDG,
                amount,
                proposedOutput: output,
                observedAt: Date.now(),
                source: "manual",
                coverage: "quote-only",
                amountUnit: "raw-token",
              });
            }}
          >
            <label htmlFor="amount">
              {snapshot.symbol} amount (unscaled token units)
            </label>
            <input
              id="amount"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setIntent(undefined);
              }}
              inputMode="decimal"
              required
            />
            <label htmlFor="output">Proposed USDG output</label>
            <input
              id="output"
              value={output}
              onChange={(e) => {
                setOutput(e.target.value);
                setIntent(undefined);
              }}
              inputMode="decimal"
              required
            />
            <button>Review quote</button>
          </form>
        </details>
      )}
      <footer className="panel-note">
        Independent asset and quote review with passive request observation. No
        signing or transaction simulation.
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
