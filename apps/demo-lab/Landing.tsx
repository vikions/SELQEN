/* THESIS: Put the extension in the spotlight, with one clear installation path.
 OWN-WORLD: ink canvas, acid-green actions, oversized Geist, a paper review panel.
 STORY: understand the product, try two illustrative states, install or open the lab.
 FIRST VIEWPORT: a short headline left; a browser and inspection panel right.
 FORM: concise extension product page, chosen from the user's reference-led brief.
 All example results are synthetic; no store availability or transaction safety claims. */
import { useState } from "react";
import {
  ArrowRightIcon,
  ArrowTopRightIcon,
  CheckIcon,
  Cross2Icon,
} from "@radix-ui/react-icons";
import { Brand } from "../../packages/ui/Review";
import { fixture } from "../../packages/sdk/fixtures";
import { evaluate } from "../../packages/engine";
import { policyAt } from "../../packages/engine/types";
import "./landing.css";

export default function Landing() {
  const [caseId, setCase] = useState<"canonical" | "impostor">("canonical");
  const now = Date.now();
  const sample = fixture(caseId, now);
  const result = evaluate(sample.snapshot, undefined, policyAt(now));
  const warning = result.verdict === "blocked";
  return (
    <div className="landing">
      <a className="landing-skip" href="#main">
        Skip to content
      </a>
      <header className="landing-header">
        <a href="#" aria-label="SELQEN home" className="landing-logo">
          <Brand />
        </a>
        <nav aria-label="Main navigation">
          <a href="#receipt">
            Receipts <ArrowTopRightIcon />
          </a>
          <a href="#lab">
            Try the demo <ArrowTopRightIcon />
          </a>
          <a href="https://github.com/vikions/SELQEN" className="source-link">
            GitHub <ArrowTopRightIcon />
          </a>
        </nav>
        <a className="landing-nav-cta" href="#install">
          Get SELQEN <ArrowRightIcon />
        </a>
      </header>
      <main id="main" tabIndex={-1}>
        <section className="landing-hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="landing-kicker">Your browser. A clearer view.</p>
            <h1 id="hero-title">
              Know what
              <br />
              you’re <span>signing.</span>
            </h1>
            <p className="hero-description">
              Browser safety layer for
              <br />
              Robinhood Stock Tokens.
            </p>
            <a className="landing-primary" href="#install">
              Get the extension <ArrowRightIcon />
            </a>
            <p className="hero-note">Chrome · Mainnet MVP</p>
          </div>
          <div className="product-stage">
            <div className="browser-scene" aria-hidden="true">
              <div className="browser-toolbar">
                <span className="browser-dots">● ● ●</span>
                <span>app.uniswap.org</span>
                <span>↗</span>
              </div>
              <div className="scene-app">
                <span>Swap</span>
                <span>Robinhood Chain</span>
              </div>
              <div className="scene-trade">
                <span>You sell</span>
                <div>
                  1 <b>AAPL</b>
                </div>
                <span className="scene-down">↓</span>
                <span>You receive</span>
                <div>
                  — <b>USDG</b>
                </div>
              </div>
              <div className="scene-bottom">Your trade, with more context.</div>
            </div>
            <section
              className={`preview-extension ${warning ? "is-warning" : ""}`}
              aria-label="Illustrative SELQEN review"
            >
              <div className="preview-top">
                <Brand />
                <span>Illustrative preview</span>
              </div>
              <div className="preview-asset">
                <div className="asset-letter">A</div>
                <div>
                  <strong>AAPL</strong>
                  <span>Robinhood Chain</span>
                </div>
                <span className="preview-asset-kind">Stock token</span>
              </div>
              <div className="preview-verdict" aria-live="polite">
                <span className="preview-icon">
                  {warning ? <Cross2Icon /> : <CheckIcon />}
                </span>
                <h2>{result.title}</h2>
                <p>
                  {warning
                    ? "Same ticker. Different contract."
                    : "A little clarity before your next move."}
                </p>
              </div>
              <dl className="preview-checks">
                <div>
                  <dt>Token identity</dt>
                  <dd>{warning ? "Not canonical" : "Canonical"}</dd>
                </div>
                <div>
                  <dt>Multiplier</dt>
                  <dd>{warning ? "Not verified" : "Reconciled"}</dd>
                </div>
                <div>
                  <dt>Price reference</dt>
                  <dd>{warning ? "Not verified" : "Checked"}</dd>
                </div>
              </dl>
              <div className="preview-foot">
                Asset review · No transaction inspected
              </div>
            </section>
            <div className="preview-selector">
              <span>Try a different token</span>
              <div role="group" aria-label="Preview scenario">
                <button
                  aria-pressed={!warning}
                  onClick={() => setCase("canonical")}
                >
                  Canonical
                </button>
                <button
                  aria-pressed={warning}
                  onClick={() => setCase("impostor")}
                >
                  Lookalike
                </button>
              </div>
            </div>
          </div>
        </section>
        <div className="landing-scope">
          <p>
            One small extension.
            <br />
            <strong>A better-informed trade.</strong>
          </p>
          <div>
            <span>Check the token.</span>
            <span>Understand the price.</span>
            <span>Keep your wallet.</span>
          </div>
        </div>
        <section
          className="landing-install"
          id="install"
          aria-labelledby="install-title"
        >
          <div>
            <p className="landing-kicker">Make room for clarity.</p>
            <h2 id="install-title">
              Meet your new
              <br />
              side panel.
            </h2>
            <p>
              Install the MVP from source.
              <br />
              Your wallet stays in your hands.
            </p>
          </div>
          <div className="install-action">
            <a
              className="landing-primary"
              href="https://github.com/vikions/SELQEN#install-from-source"
            >
              Install SELQEN <ArrowTopRightIcon />
            </a>
            <span>Chrome 116+ · Developer installation</span>
            <details>
              <summary>How to install</summary>
              <ol>
                <li>
                  Clone the repository and run <code>npm ci</code>, then{" "}
                  <code>npm run build</code>.
                </li>
                <li>
                  Open <code>chrome://extensions</code> and enable Developer
                  mode.
                </li>
                <li>
                  Choose Load unpacked and select <code>dist/extension</code>.
                </li>
              </ol>
            </details>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <p>
          Independent project. Not affiliated with Robinhood.
          <br />
          Advisory checks. No signing or transaction simulation.
        </p>
        <a href="https://github.com/vikions/SELQEN/blob/main/docs/coverage.md">
          Coverage & limitations <ArrowTopRightIcon />
        </a>
      </footer>
    </div>
  );
}
