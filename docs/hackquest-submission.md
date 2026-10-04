# SELQEN — submission draft

## Project name
SELQEN

## Tagline
Know what you're signing.

## One-line description
Browser safety layer for Robinhood Stock Tokens.

## Short pitch
SELQEN is a browser extension that helps people review Robinhood Stock Tokens alongside Uniswap. It checks official token identity, corporate-action multipliers, trading state and available Chainlink price references, then explains missing evidence and inconsistencies before the user decides what to do in their wallet.

## Problem
Tokenized stocks introduce information that a token ticker and swap quote cannot explain on their own: canonical issuer contracts, corporate-action multipliers, trading halts, oracle pauses and aging equity prices. Users need those checks where they trade, without adopting another wallet or transferring custody.

## What we built
A Chrome Manifest V3 side panel with a read-only source client, deterministic review engine, Uniswap page adapter, passive MetaMask request observer and exportable JSON evidence. The extension checks Robinhood Chain mainnet, resolves tokens by chain and contract address, compares issuer and onchain multiplier data, and uses address-pinned AAPL/USD and USDG/USD Chainlink feeds. Other equity oracle mappings are not yet implemented.

Visible Uniswap amounts can populate the comparison form after the user confirms unscaled token units. The observer recognizes ERC-20-shaped approvals/transfers and displays network, contract, spender, amount and unlimited approvals. Unknown requests remain explicitly unverified. Observe and Guard modes provide information and advisory warnings; neither modifies or prevents wallet requests.

## Why Robinhood Chain and USDG
Robinhood Stock Token metadata and contract state are core inputs, rather than a network label added to a generic demo. The first supported equity reference is AAPL on Robinhood Chain mainnet (4663). USDG settlement comparisons use a validated USDG/USD reference when available and disclose a parity assumption when it is unavailable.

## Technical stack
TypeScript, React, Chrome MV3, Vite, viem, Decimal.js, Zod, Vitest and Playwright. Robinhood official REST endpoints and public RPC; Chainlink equity and settlement references. No backend account, signing key or custodial component is required by the extension.

## Validation and limits
See [coverage.md](coverage.md) for test evidence and trust boundaries. September 28 live browser checks successfully read AAPL registry, quote, multiplier, trading state, corporate actions and both oracle references. Those observations are historical, not a promise of current source availability.

Page observations can be spoofed or suppressed; they are not a wallet security boundary. Full Uniswap router/Permit2 decoding, quote-to-request binding, automatic proof of page amount scaling and a real user-driven MetaMask end-to-end flow remain incomplete. We do not claim transaction simulation, execution guarantees, signature verification or complete protection from malicious pages. No smart contract has been deployed.

## Submission fields still needed
- Source repository URL: https://github.com/vikions/SELQEN — repository created; initial source push pending.
- Demo video URL: record using [demo-script.md](demo-script.md), then provide the actual upload URL.
- Hosted demo URL, if required: not deployed. Local lab and unpacked extension are available.
- Team members/contact details: user-provided.
- Deployment address: none. Do not insert an existing third-party token/feed address as a SELQEN deployment.
- Registration/draft status and eligibility clarification: pending.

## Eligibility question (draft; not sent)
SELQEN is a read-only browser extension that integrates Robinhood Chain mainnet contracts, official Stock Token APIs and Chainlink feeds, including USDG settlement references. It does not deploy its own smart contract or execute transactions. Does this integration satisfy your deployment requirement, or is a project-owned onchain deployment mandatory?

Official event rules checked October 4: https://www.hackquest.io/hackathons/Arbitrum-Open-House-Singapore-Online-Buildathon
