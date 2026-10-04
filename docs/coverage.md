# SELQEN v0.1 coverage and trust boundaries

Mainnet MVP for Robinhood Chain (4663). October 4 release preparation re-ran typecheck, all 41 unit/integration tests and production builds successfully. Live endpoints and real-wallet acceptance are scheduled for after repository publication; the runtime observations below retain their original dates.

## Supported surface

Chrome 116+ MV3 side panel. Manual contract checker works without any page access. A content script is installed only on `https://app.uniswap.org/*`. Explicit `chain=robinhood`, `chain=4663` or `/explore/tokens/robinhood/<address>` identifies page context; an unknown network remains unknown. Wallet network is never inferred from page context.

The extension stores current tab context and the latest bounded request summary in session storage, and the Guard preference in local storage. No keys, wallet response signatures, balances or analytics are collected. Only relevant URL parameters are retained. Tab closure/full navigation clears saved context and requests; SPA navigation invalidates asset reviews. A blocked advisory is informative and cannot enforce a wallet boundary.

## Trust boundaries

- Page context is untrusted. Token identity is independently looked up in the official registry.
- A content script cannot ask the worker to fetch arbitrary URLs or supply a trusted snapshot.
- Check requests are accepted only from extension-owned pages. Only fixed Robinhood API/RPC destinations are used.
- Fixture data is imported only by the lab. The extension bundle does not include the fixture module and has no message that can enable demo mode.
- Registry failure returns unknown identity, never noncanonical. Noncanonical requires a successful registry read without a matching address/chain.
- Critical unknowns remain unknown. API failures do not imply false halt or false pause.
- All onchain token reads share a block number. REST and RPC disagreement causes a failed review.
- Expected values are withheld when blocking snapshot/intent evidence is present. Decimal.js preserves calculation precision; displayed values are rounded for readability, receipts preserve numeric strings.
- Quote-only receipts are unsigned local records, not proof of execution or issuer attestations.

## Current policy

REST quote freshness: 90 seconds. Registry freshness: 5 minutes. Future timestamp tolerance: 5 seconds. Material deviation threshold: 3%. These are explicit MVP policy choices, not Robinhood standards. Off-hours source prices may age out; the application does not relabel them fresh.

USDG identity is fixed to the documented Robinhood mainnet contract. The reader pins AAPL/USD and USDG/USD proxies from the official [Chainlink directory](https://reference-data-directory.vercel.app/feeds-robinhood-mainnet.json), discovered through [Chainlink documentation source](https://github.com/smartcontractkit/documentation/blob/main/src/features/data/chains.ts), checked 2026-09-28. Both feeds use the documented 86400-second heartbeat as a maximum age, without extending it for market closures. Reads validate decimals, description, positive answer, round completeness and nonfuture timestamps at the same block as token state. USDG/USD conversion uses a valid reference; missing data retains an explicit parity warning, stale supplied data blocks. No independent equity mapping is claimed beyond AAPL.

## MetaMask observation and updated evidence — 2026-09-28

MAIN-world EIP-6963 discovery (`io.metamask`) and the legacy `isMetaMask` surface are observed on Uniswap only. These page-level identifiers are not wallet authentication. Only `eth_sendTransaction`, `eth_signTypedData_v4` and `wallet_sendCalls` are allowlisted. Summaries contain method, request/domain network, addresses, decoded base-unit amount where supported, fingerprint and observation time. Raw calldata, typed message contents and wallet responses are not persisted. Unknown calls remain unknown; ERC-20-shaped calldata does not prove token implementation or spender trust. Frozen or otherwise non-writable providers are unsupported. Calls already captured by a dApp before instrumentation may be missed.

The observer forwards the original request immediately and exactly once; it does not wait for review or alter wallet results. The page may spoof or suppress messages. Its summary is separate from the asset/quote verdict and is not included as trusted evidence in the receipt. Complex Uniswap routers, Permit2 permits, recipients, minimum received and batch contents are not fully verified.

- 41 unit/integration tests, TypeScript, production build and browser acceptance passed.
- A controlled EIP-6963 provider verified receiver/argument preservation, one forwarding call and unchanged rejection code 4001 through the real unpacked extension.
- Real extension-worker AAPL check returned canonical identity, issuer quote, matching REST/onchain multiplier, pause/halt state, corporate actions, AAPL oracle and USDG oracle with no source errors.
- Direct Node API requests still return 403; ordinary browser and real extension-worker requests succeeded. This supersedes the earlier claim that live review was blocked in all runtimes.
- Real Uniswap input selectors were inspected. Visible amount extraction and clearing are implemented and verified on controlled DOM. Amount-unit reconciliation and an actual MetaMask signing flow remain unverified. Importing observed amounts requires explicit user confirmation of unscaled token units; changes clear the comparison inputs. No wallet transaction was signed or broadcast.

## Acceptance evidence — 2026-09-21

- TypeScript compilation and 33 unit/integration tests passed.
- Browser acceptance passed desktop/mobile layouts, six scenarios, Guard dialog, invalid input and receipt provenance.
- Actual unpacked artifact loaded in a disposable headless Chromium profile. Worker, panel page, persistence and message validation passed.
- Content script and URL context passed on a controlled, synthetic Uniswap-origin page, including a simulated back/forward lifecycle event.
- No real Uniswap DOM extraction or signing flow was tested. No transaction, wallet connection or deployment occurred.
- Live API smoke check encountered HTTP 403; unavailable-data handling worked. Successful live token RPC and oracle integration are not claimed by this run.

## Remaining product work

1. Check the real MetaMask workflow in the user's browser; do not infer it from controlled-provider tests.
2. Expand address-level equity feed mappings beyond AAPL and evaluate session-aware policy. AAPL and USDG reads are implemented and tested live.
3. Validate a specific real Uniswap trade route, reconcile observed amount units and bind the decoded router payload without changing the transaction.
4. Evaluate a concrete Morpho collateral market after the first integration is stable.
5. Resolve buildathon eligibility; a contract must provide a genuine product guarantee before it is added.
