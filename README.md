# SELQEN

**Know what you're signing.**  
Browser safety layer for Robinhood Stock Tokens.

SELQEN is a Chrome extension MVP for **Robinhood Chain mainnet (4663)**. Open its side panel beside Uniswap to review canonical token identity, corporate-action multipliers, trading state and price references. It reads official sources and explains missing or conflicting evidence before you make a decision in your wallet.

The extension uses real mainnet data. A separate development lab provides clearly labelled synthetic scenarios for demonstrations and regression testing.

## What the MVP does

- **Canonical identity:** resolves chain and contract address through the Robinhood registry instead of trusting a ticker or logo.
- **Corporate-action checks:** reconciles issuer and onchain multipliers, reads pending changes and checks trading halt and oracle pause state.
- **Independent references:** reads address-pinned Chainlink AAPL/USD and USDG/USD feeds, validates answers and timestamps, and compares the adjusted equity reference with issuer prices.
- **USDG quote review:** calculates an indicative settlement reference. Missing USDG oracle data produces an explicit parity-assumption warning; an expired supplied reference blocks comparison.
- **Uniswap amount observation:** displays visible input/output amounts and allows import after confirmation of unscaled token units. Changes invalidate comparison inputs.
- **MetaMask request observation:** displays request network, contract and recognized ERC-20-shaped approval/transfer fields, including unlimited approvals. Unknown payloads remain unverified.
- **Evidence export:** saves unsigned JSON receipts containing asset/quote evidence, policy, timestamps and review scope.

**Observe** presents the review in the panel. **Guard** adds an advisory warning on supported pages when an asset/quote check is blocked. Both modes leave wallet decisions with you.

## Install from source

Requirements: **Node.js 22.17+**, npm and **Chrome 116+**.

```sh
git clone https://github.com/vikions/SELQEN.git
cd SELQEN
npm ci
npm run build
```

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select `dist/extension`.
3. Pin SELQEN and click its icon to open the side panel.
4. Paste a Stock Token contract address, or open the [AAPL/USDG Uniswap page](https://app.uniswap.org/swap?chain=robinhood&inputCurrency=0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9&outputCurrency=0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168).
5. Inspect the verdict and expand **Source evidence** for addresses and timestamps.

After rebuilding, reload the extension and the Uniswap tab. A wallet connection is not required for the standalone asset checker. SELQEN does not require a seed phrase, API key or backend account.

AAPL example: `0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9`. Each check resolves identity from the registry again; this example is not a substitute for live verification.

## Coverage

| Surface | MVP support |
| --- | --- |
| Network | Robinhood Chain mainnet, chain ID 4663 |
| Identity and issuer data | Official registry and supported token-contract interfaces |
| Independent equity oracle | AAPL/USD; other equity mappings are not yet implemented |
| Settlement reference | USDG/USD on Robinhood Chain |
| dApp integration | Uniswap URL context and visible amounts |
| Wallet integration | Passive MetaMask provider request observation |
| Distribution | Unpacked Chrome extension built from source |

SELQEN currently reviews **assets and indicative quotes**, with a separate, untrusted page-level request summary. It does not simulate execution, verify resulting signatures, fully decode Uniswap routers or Permit2, or bind every wallet request to the reviewed quote. Page observations can be spoofed or suppressed. A successful asset check is not approval of a transaction.

Importing page amounts requires confirmation of unscaled token units; automatic proof of scaling is not implemented. Morpho, additional equity feed mappings and smart-contract settlement are outside this release. There is no project-owned onchain deployment.

Source failures remain visible. The extension never substitutes demonstration data for an unavailable live response. Stale prices can prevent a review outside market hours.

## Development and validation

```sh
npm run dev
```

Open **http://127.0.0.1:5173/**. **Explore scenarios** provides six synthetic cases: canonical token, lookalike, corporate action, unfavorable quote, stale price and trading halt. **Check a live token** uses actual sources. The lab's controlled Guard dialog is a demonstration; the extension's Guard is advisory.

```sh
npm run check
```

This runs TypeScript validation, unit/integration tests and both production builds. On **October 4, 2026**, all **41 tests**, typecheck and build passed. The September 28 browser run also verified the unpacked extension with controlled page/provider fixtures; it was not a real MetaMask trade.

For browser acceptance, build first, start `npm run dev` in another terminal, then run:

```sh
npx playwright install chromium
npm run test:browser
```

Tests use a disposable profile. Screenshots are written to `output/playwright`. Set `BROWSER_EXECUTABLE_PATH` if using an existing Chromium installation.

Read-only live checks are separate and depend on external source availability:

```sh
node scripts/extension-live-smoke.mjs
node scripts/oracle-smoke.mjs
```

The extension live-check script currently defaults to a local Windows Chromium path; set `BROWSER_EXECUTABLE_PATH` to your installed browser when needed. September 28 extension-worker checks successfully read AAPL identity, quotes, token state, corporate actions and both oracle feeds. Current user-driven mainnet and MetaMask acceptance checks remain pending.

The optional `npm run test:live` uses Node directly. During September testing, Node API requests returned HTTP 403 while browser/extension requests succeeded. The development lab's Node proxy may encounter the same restriction. The static lab can also be subject to browser CORS rules. The packaged extension reads sources through its worker with explicit host permissions.

## Architecture

| Directory | Responsibility |
| --- | --- |
| `apps/extension` | MV3 worker, page/provider observers and side panel |
| `apps/demo-lab` | Development workbench and labelled scenarios |
| `packages/engine` | Deterministic review rules and decimal arithmetic |
| `packages/robinhood` | Official source validation and contract/feed reads |
| `packages/adapters` | Uniswap context, amounts and wallet request summaries |
| `packages/sdk` | Evidence receipts and isolated fixtures |
| `packages/ui` | Shared review components and styles |

See [coverage and trust boundaries](docs/coverage.md), [product scope](PRODUCT.md) and the [demo walkthrough](docs/demo-script.md). Historical source research is preserved in the [September 18 research report](docs/research-2026-09-18.md).

SELQEN is an independent project and is not affiliated with Robinhood, Uniswap, MetaMask or Chainlink.
