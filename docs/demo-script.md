# SELQEN demo — approximately 2 minutes

1. **0:00–0:15 — Problem.** Show the Uniswap AAPL/USDG page with SELQEN open. Say: “A stock-token ticker does not tell you whether the contract is canonical, whether a corporate action changed its value, or whether the price source is current.”
2. **0:15–0:45 — Real asset review.** Show AAPL identity, multiplier reconciliation, pause/halt state and source evidence. Display oracle update times. Refresh the check. If sources fail or prices are stale, show that outcome honestly; do not replace it with a fixture labelled live.
3. **0:45–1:10 — Quote comparison.** Explain the unscaled token-unit confirmation, then show a USDG comparison and the independent settlement reference when available. Explain that this is a reference, not an executable quote or guaranteed output.
4. **1:10–1:35 — Clearly labelled scenarios.** Open the local demonstration lab at http://127.0.0.1:5173 and identify it as synthetic. Show lookalike token, corporate action or stale-price warnings. Guard is advisory in the extension; the lab's controlled continuation is a demonstration.
5. **1:35–1:50 — Evidence.** Export a receipt and show source mode, contract/network, timestamps and findings. The receipt is unsigned and is not proof of execution.
6. **1:50–2:00 — Scope and next step.** “SELQEN keeps the review beside the trade. Next: full router and Permit2 decoding, transaction binding and wider equity coverage.”

Only show MetaMask request observation as a real-wallet feature if it has actually been exercised in that recording. Otherwise identify the controlled-provider test accurately. No completed purchase, approval or transaction broadcast is needed for this demo.

Before recording: build with `npm run build`; load/reload `dist/extension`; reload the Uniswap tab; start the lab with `npm run dev`. Do not include wallet recovery information, private account data or authentication tokens in the video.
