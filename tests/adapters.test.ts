import { describe, it, expect } from "vitest";
import {
  uniswapContext,
  withSelection,
  reviewTarget,
} from "../packages/adapters";
import { AAPL, USDG } from "../packages/engine/types";
describe("bounded Uniswap context", () => {
  it("uses selected token addresses even when the URL still identifies Ethereum", () => {
    const c = withSelection(
      uniswapContext(
        "https://app.uniswap.org/swap?chain=mainnet&inputCurrency=NATIVE",
      )!,
      {
        input: { address: AAPL, chainId: 4663, symbol: "AAPL" },
        output: { address: USDG, chainId: 4663, symbol: "USDG" },
      },
    );
    expect(reviewTarget(c)).toEqual({ address: AAPL, chainId: 4663 });
    expect(c.coverage).toBe("page-state");
  });
  it("reviews the buy-side stock and clears it when selection becomes ambiguous", () => {
    const url = uniswapContext(
      `https://app.uniswap.org/swap?chain=robinhood&inputCurrency=${USDG}&outputCurrency=${AAPL}`,
    )!;
    expect(reviewTarget(url)).toEqual({ address: AAPL, chainId: 4663 });
    expect(
      reviewTarget(withSelection(url, { input: null, output: null })),
    ).toBeNull();
    expect(
      reviewTarget(
        withSelection(url, {
          input: { address: AAPL, chainId: 1, symbol: "AAPL" },
          output: null,
        }),
      ),
    ).toEqual({ address: AAPL, chainId: 1 });
  });
  it("rejects lookalike hosts", () =>
    expect(
      uniswapContext("https://app.uniswap.org.evil.test/swap"),
    ).toBeNull());
  it("does not infer chain from a ticker", () =>
    expect(
      uniswapContext("https://app.uniswap.org/swap?inputCurrency=AAPL")
        ?.chainId,
    ).toBeNull());
  it("extracts address identity from explicit URL parameters", () => {
    const c = uniswapContext(
      `https://app.uniswap.org/swap?chain=robinhood&inputCurrency=${AAPL}&outputCurrency=${USDG}`,
    );
    expect(c?.tokenAddress).toBe(AAPL);
    expect(c?.chainId).toBe(4663);
    expect(c?.coverage).toBe("url-only");
  });
  it("does not mistake pool id for token address", () =>
    expect(
      uniswapContext(`https://app.uniswap.org/explore/pools/robinhood/${AAPL}`)
        ?.tokenAddress,
    ).toBeNull());
});
