import React, { useEffect, useRef, useState } from "react";

import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowTopRightIcon,
  CheckIcon,
  ResetIcon,
  Cross2Icon,
} from "@radix-ui/react-icons";
import { Brand, Review, AddressForm, short } from "../../packages/ui/Review";
import { fixture, scenarios, type Scenario } from "../../packages/sdk/fixtures";
import { evaluate } from "../../packages/engine";
import {
  policyAt,
  AAPL,
  USDG,
  type Snapshot,
  type Intent,
} from "../../packages/engine/types";

import "../../packages/ui/styles.css";
import "./styles.css";
const start = Date.now();
export default function Lab() {
  const [selected, setSelected] = useState<Scenario>("canonical"),
    [base, setBase] = useState(start),
    [now, setNow] = useState(start),
    [mode, setMode] = useState<"fixture" | "live">("fixture"),
    [guard, setGuard] = useState(true),
    [tradeReview, setTradeReview] = useState(false),
    [amount, setAmount] = useState("0.5"),
    [output, setOutput] = useState("105.70"),
    [live, setLive] = useState<Snapshot | null>(null),
    [busy, setBusy] = useState(false),
    [dialog, setDialog] = useState(false),
    [notice, setNotice] = useState("");
  const generation = useRef(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const heading = document.querySelector<HTMLHeadingElement>(".intro h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (dialog) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [dialog]);
  const data = fixture(selected, base),
    snapshot = mode === "fixture" ? data.snapshot : live;
  const intent: Intent | undefined =
    mode === "fixture" && tradeReview
      ? { ...data.intent, amount, proposedOutput: output }
      : undefined;
  const result = snapshot ? evaluate(snapshot, intent, policyAt(now)) : null;
  function choose(id: Scenario) {
    const at = Date.now();
    setSelected(id);
    setBase(at);
    setNow(at);
    setMode("fixture");
    setTradeReview(id === "quote");
    setAmount("0.5");
    setOutput(fixture(id, at).intent.proposedOutput);
    setNotice("");
    setDialog(false);
    generation.current++;
    setBusy(false);
  }
  async function liveCheck(address: string) {
    const id = ++generation.current;
    setBusy(true);
    setLive(null);
    setNotice("");
    try {
      const { checkAsset } = await import("../../packages/robinhood");
      const s = await checkAsset(address, 4663, undefined, import.meta.env.DEV);
      if (id === generation.current) setLive(s);
    } catch {
      if (id === generation.current)
        setNotice("The live check could not finish. Try again.");
    } finally {
      if (id === generation.current) setBusy(false);
    }
  }
  function switchMode(next: "fixture" | "live") {
    generation.current++;
    setBusy(false);
    setMode(next);
    setNotice("");
    setDialog(false);
  }
  function continueDemo() {
    if (guard && result?.verdict === "blocked") setDialog(true);
    else
      setNotice(
        "Review step complete. This local demo does not create or sign a transaction.",
      );
  }
  return (
    <div className="lab">
      <header className="topbar">
        <Brand />
        <nav aria-label="Lab navigation">
          <a href="#">Back to SELQEN</a>
          <a
            href="https://docs.robinhood.com/chain/stock-tokens/"
            target="_blank"
            rel="noreferrer"
          >
            Stock Tokens <ArrowTopRightIcon />
          </a>
        </nav>
        <span className="build-tag">
          Developer preview <span>v0.1</span>
        </span>
      </header>
      <main className="workspace">
        <section className="lab-main">
          <div className="intro">
            <div className="intro-label">
              <span className="status-dot" /> Built for Robinhood Chain
            </div>
            <h1>
              Know what
              <br />
              you're signing<span>.</span>
            </h1>
            <p>
              One clear review, right beside your trade.
              <br />
              Understand the asset, the price, and what needs attention.
            </p>
            <div className="workspace-tabs" aria-label="Data source">
              <button
                aria-pressed={mode === "fixture"}
                onClick={() => switchMode("fixture")}
              >
                Explore scenarios
              </button>
              <button
                aria-pressed={mode === "live"}
                onClick={() => switchMode("live")}
              >
                Check a live token <ArrowTopRightIcon />
              </button>
            </div>
          </div>
          {mode === "fixture" ? (
            <>
              <div className="lab-provenance">
                <strong>LOCAL DEMO</strong>
                <span>Synthetic quotes. No wallet. No real trades.</span>
              </div>
              <div className="scenario-workspace">
                <div className="scenario-list">
                  <h2>Put it to the test</h2>
                  {scenarios.map((s, i) => (
                    <button
                      className={`scenario ${selected === s.id ? "selected" : ""}`}
                      key={s.id}
                      aria-pressed={selected === s.id}
                      onClick={() => choose(s.id)}
                    >
                      <span className="scenario-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <strong>{s.label}</strong>
                        {selected === s.id && <small>{s.description}</small>}
                      </span>
                      <ArrowRightIcon />
                    </button>
                  ))}
                </div>
                <section className="trade-ticket">
                  <div className="ticket-heading">
                    <h2>Example trade</h2>
                    <span>Fixture</span>
                  </div>
                  <label htmlFor="sell-amount">You sell</label>
                  <div className="trade-input">
                    <input
                      id="sell-amount"
                      aria-label="AAPL amount"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        setTradeReview(false);
                        setNotice("");
                      }}
                    />
                    <strong>
                      <span className="token-dot">A</span>AAPL
                    </strong>
                  </div>
                  <span className="address-preview">
                    {short(data.snapshot.address)}
                  </span>
                  <div className="trade-divider">
                    <ArrowDownIcon />
                  </div>
                  <label htmlFor="receive-amount">Proposed receipt</label>
                  <div className="trade-input">
                    <input
                      id="receive-amount"
                      aria-label="USDG output"
                      inputMode="decimal"
                      value={output}
                      onChange={(e) => {
                        setOutput(e.target.value);
                        setTradeReview(false);
                        setNotice("");
                      }}
                    />
                    <strong>
                      <span className="token-dot dollar">$</span>USDG
                    </strong>
                  </div>
                  <span className="address-preview">
                    Robinhood Chain · simulated liquidity
                  </span>
                  <button
                    className="primary-wide"
                    onClick={() => {
                      setTradeReview(true);
                      setNotice("");
                    }}
                  >
                    Review this quote <ArrowRightIcon />
                  </button>
                  <p className="fine">
                    The panel uses the same safety engine as the extension.
                  </p>
                  {tradeReview && (
                    <button
                      className="text-button continue-demo"
                      onClick={continueDemo}
                    >
                      Continue demo review
                    </button>
                  )}
                </section>
              </div>
              <div className="lab-bottom">
                <span>
                  <CheckIcon /> No wallet access or signing
                </span>
                <button
                  className="text-button"
                  onClick={() => choose(selected)}
                >
                  <ResetIcon />
                  Reset scenario clock
                </button>
              </div>
            </>
          ) : (
            <section className="live-workspace">
              <h2>
                Check the address.
                <br />
                Not just the ticker.
              </h2>
              <p>
                Query the official Robinhood registry and read token state from
                the public RPC. Live checks can return incomplete or unavailable
                data.
              </p>
              <AddressForm
                initial={AAPL}
                onCheck={(a) => void liveCheck(a)}
                busy={busy}
              />
              <button
                className="text-button"
                onClick={() => void liveCheck(AAPL)}
              >
                Check canonical AAPL <ArrowRightIcon />
              </button>
              <div className="source-description">
                <h3>Sources, in plain sight</h3>
                <p>
                  Robinhood asset registry, underlying bid/ask, corporate
                  actions and token-contract multiplier. 32 equity/ETF Chainlink
                  references and USDG/USD are connected; coverage varies by
                  token.
                </p>
                <a
                  href={`https://app.uniswap.org/swap?chain=robinhood&inputCurrency=${AAPL}&outputCurrency=${USDG}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open this pair on Uniswap <ArrowTopRightIcon />
                </a>
              </div>
            </section>
          )}
          {notice && (
            <div className="lab-notice" role="status">
              {notice}
            </div>
          )}
          <footer className="lab-footer">
            <span>Browser safety layer for Robinhood Stock Tokens.</span>
            <span>Independent project · Not affiliated with Robinhood</span>
          </footer>
        </section>
        <aside className="panel-column" aria-label="SELQEN review panel">
          <div className="panel-frame-title">
            <span>YOUR REVIEW</span>
            <span>Side panel preview</span>
          </div>
          <div className="panel">
            <header className="panel-header">
              <Brand />
              <p className="tagline">Know what you're signing.</p>
              <div className="mode-switch">
                <button aria-pressed={!guard} onClick={() => setGuard(false)}>
                  Observe
                </button>
                <button aria-pressed={guard} onClick={() => setGuard(true)}>
                  Guard
                </button>
              </div>
            </header>
            <div className={`source-strip ${mode}`}>
              <span>
                {mode === "fixture" ? "LOCAL FIXTURE" : "LIVE SOURCES"}
              </span>
              <span>
                {mode === "fixture"
                  ? "Simulated asset check"
                  : "Robinhood Chain"}
              </span>
            </div>
            <Review
              snapshot={snapshot}
              intent={intent}
              now={now}
              busy={busy}
              onRefresh={() =>
                mode === "fixture"
                  ? choose(selected)
                  : live && void liveCheck(live.address)
              }
            />
            <div className="panel-note">
              {guard
                ? "Guard adds a warning before the local demo continues."
                : "Observe displays information without a demo interruption."}{" "}
              Neither mode signs or modifies transactions.
            </div>
          </div>
        </aside>
      </main>
      <dialog
        ref={dialogRef}
        onCancel={() => setDialog(false)}
        className="guard-dialog"
        aria-labelledby="guard-title"
        aria-describedby="guard-reason"
      >
        <button
          className="dialog-close secondary"
          aria-label="Close warning"
          onClick={() => setDialog(false)}
        >
          <Cross2Icon />
        </button>
        <span className="dialog-kicker">SELQEN GUARD · LOCAL FIXTURE</span>
        <h2 id="guard-title">
          Pause before
          <br />
          you proceed.
        </h2>
        <p id="guard-reason">
          {result?.findings.find((f) => f.level === "blocked")?.detail}
        </p>
        <p className="fine">
          This is a simulated continuation. No wallet request exists.
        </p>
        <div className="dialog-actions">
          <button onClick={() => setDialog(false)}>Back to review</button>
          <button
            className="text-button"
            onClick={() => {
              setDialog(false);
              setNotice(
                "Warning acknowledged for this local fixture. No transaction was signed or sent.",
              );
            }}
          >
            Acknowledge and continue demo
          </button>
        </div>
      </dialog>
    </div>
  );
}
