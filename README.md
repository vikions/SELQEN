# SELQEN

**Know what you're signing.**

SELQEN is a browser safety layer for **Robinhood Stock Tokens** on **Robinhood Chain**.

It runs as a Chrome extension beside the dApps users already use and turns fragmented asset, pricing, corporate-action and trade-context data into a simple review before the user signs.

**Live app:** https://selqen.vercel.app  
**Source:** https://github.com/vikions/SELQEN

---

## Why SELQEN

A ticker and a swap quote are not enough to safely understand a tokenized stock.

A Stock Token can look familiar while pointing to the wrong contract. Corporate actions can change multipliers. Price sources can become stale or disagree. Trading state can change. A user may be looking at a quote without seeing the evidence behind it.

SELQEN brings those checks into one compact browser-side review.

The goal is simple:

> **Stay in your dApp. Check the asset. Understand the context. Then decide what to sign.**

---

## What SELQEN checks

### Canonical asset identity
SELQEN resolves Stock Tokens by **chain and contract address** against official Robinhood sources instead of trusting a ticker, logo or token name.

### Corporate-action state
It reviews current and pending multiplier data, corporate-action context, trading state and relevant pause conditions.

### Independent price references
SELQEN uses address-pinned Chainlink equity / ETF feeds and USDG/USD references, validates timestamps and compares normalized values with issuer-side data.

The current build includes **32 configured equity / ETF feed mappings**, including assets such as AAPL, NVDA, TSLA, MSFT and AMZN.

### USDG quote review
For Stock Token → USDG flows, SELQEN calculates an independent indicative settlement reference and highlights material differences that deserve review.

### Uniswap context
The extension can observe supported Uniswap page context and visible trade amounts so the review stays beside the transaction the user is already preparing.

### Wallet request context
SELQEN can passively summarize supported MetaMask request shapes, including common ERC-20 approvals and transfers, without taking custody or signing anything.

### Evidence receipts
Reviews can be exported as compact JSON receipts containing the asset, network, sources, timestamps, checks and verdict context.
Live receipts can optionally be registered on Robinhood Chain through the [receipt page](https://selqen.vercel.app/#receipt). The extension downloads the report; the website hashes its exact bytes locally and asks MetaMask to submit only that hash. Registration costs gas and does not validate the report or make a trade safe.

---

## Observe and Guard

SELQEN has two user modes:

- **Observe** — shows the review and evidence beside the dApp.
- **Guard** — adds a stronger advisory warning when a supported check finds a blocking or high-risk condition.

SELQEN does **not** hold funds, request seed phrases or store private keys. The extension observes wallet requests; optional receipt registration on the website requires a separate transaction confirmed by the user in MetaMask.

The user always remains in control.

---

## Demo experience

The hackathon MVP is a real **Chrome Manifest V3 extension** loaded locally in Developer Mode.

A typical demo flow:

1. Open SELQEN beside a supported Robinhood Chain dApp.
2. Review a canonical Robinhood Stock Token.
3. Compare it with a non-canonical lookalike token.
4. Inspect multiplier / corporate-action state.
5. Review an indicative Stock Token → USDG valuation.
6. See a clear verdict and source evidence directly in the browser side panel.

SELQEN also includes a clearly labelled demo lab for deterministic scenarios such as:

- canonical token
- lookalike / non-canonical token
- pending corporate action
- stale price
- trading halt
- unfavorable quote

Synthetic scenarios are always separated from live-source checks.

---

## Install from source

Requirements:

- Node.js 22.17+
- npm
- Chrome 116+

```bash
git clone https://github.com/vikions/SELQEN.git
cd SELQEN
npm ci
npm run build
```

Then:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `dist/extension`
5. Pin SELQEN and open the side panel

You can then paste a Robinhood Stock Token contract address into the checker or use SELQEN beside a supported dApp flow.

No backend account, API key or wallet secret is required.

---

## Architecture

SELQEN is structured as a small TypeScript monorepo:

| Path | Responsibility |
| --- | --- |
| `apps/extension` | Chrome MV3 worker, page observers and side panel |
| `apps/demo-lab` | Public landing experience and labelled demo scenarios |
| `packages/engine` | Deterministic review logic and valuation rules |
| `packages/robinhood` | Robinhood source validation and onchain reads |
| `packages/adapters` | dApp and wallet-context adapters |
| `packages/sdk` | Review orchestration and evidence receipts |
| `packages/receipts` | Exact-file hashing and pinned Robinhood Chain receipt registration |
| `packages/ui` | Shared interface components |
| `tests` | Unit and integration coverage |

Core stack:

**TypeScript · React · Vite · Chrome MV3 · viem · Decimal.js · Zod · Vitest · Playwright**

---

## Validation

The release is built around explicit evidence rather than silent fallbacks.

```bash
npm run check
```

This runs:

- TypeScript validation
- unit / integration tests
- production builds

The project also includes browser and live-source smoke checks for the unpacked extension.

Live-source failures stay visible to the user instead of being replaced with synthetic data.

---

## Product principles

SELQEN is designed around four rules:

1. **Contract identity beats ticker identity.**
2. **Corporate actions are part of valuation, not an edge case.**
3. **Missing evidence must stay missing — never silently become “safe”.**
4. **Security context belongs beside the trade, not in a separate dashboard.**

---

## Built for Robinhood Chain

SELQEN is purpose-built around the Stock Token model on **Robinhood Chain mainnet (chain ID 4663)**.

Robinhood Stock Token identity, issuer data, multiplier state, trading context and USDG settlement references are core product inputs — not a generic chain label added to an existing wallet-security product.

---

## Status

SELQEN is a working hackathon MVP with:

- a live public landing page
- a real unpacked Chrome extension
- Robinhood Chain mainnet data
- canonical Stock Token checks
- multi-asset equity / ETF reference coverage
- corporate-action and multiplier review
- USDG settlement references
- Uniswap context support
- MetaMask request observation
- exportable evidence receipts
- deterministic demo scenarios
- automated test coverage

The current focus is expanding supported transaction context and dApp coverage while keeping the extension lightweight and transparent.

---

## Receipt registry contract

`contracts/src/SelqenReceiptRegistry.sol` anchors a receipt's `bytes32` hash and records its first block timestamp and submitting address.
It proves that a hash was submitted; it does not validate receipt contents, authorship of the underlying receipt, or trade safety. Anyone can submit a hash first.
No admin, upgradeability or custody. **Deployed on Robinhood Chain mainnet (4663): [0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867](https://robinhoodchain.blockscout.com/address/0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867).**
Use **Anchor receipt** on a live review, import the downloaded JSON at [SELQEN Receipts](https://selqen.vercel.app/#receipt), connect MetaMask and confirm **Anchor hash**. No wallet is needed to check an existing record. Keep the original file: any byte change produces a different Keccak-256 hash. Fixtures are not accepted. No secrets or new environment variables are needed for this UI.
Requires Foundry; on Windows without it, from the repository root run `npm install --prefix output/foundry --no-save --package-lock=false --ignore-scripts @foundry-rs/forge-win32-amd64@1.7.1`.
Set `RH_RPC_URL=https://rpc.mainnet.chain.robinhood.com` and `PRIVATE_KEY` locally (see `contracts/.env.example`); the deployer needs ETH on chain 4663.
Test from the repo root: `forge test --root contracts` (or use the local `output/foundry/node_modules/@foundry-rs/forge-win32-amd64/bin/forge.exe`).
Deploy from the repo root: `forge script --root contracts script/Deploy.s.sol:Deploy --rpc-url robinhood --broadcast`; `run()` returns the registry address and refuses any chain except 4663.
Deployment [transaction](https://robinhoodchain.blockscout.com/tx/0x94b6de0bbbdc5bec69afadbff2aed6f8895018e9a601350518452b81742b440f) succeeded at block **82306146**; deployed runtime bytecode matches the local compiled contract.
Network reference: [official Robinhood deployment guide](https://docs.robinhood.com/chain/deploy-smart-contracts/). Source-code verification on the explorer is a separate step.

## Disclaimer

SELQEN is an independent project and is not affiliated with Robinhood, Uniswap, MetaMask, Chainlink or Paxos.

SELQEN provides informational safety context. It does not provide investment advice, custody assets or guarantee transaction outcomes.
