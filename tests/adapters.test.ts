import { describe, it, expect } from "vitest";
import { uniswapContext } from "../packages/adapters";
import { AAPL, USDG } from "../packages/engine/types";
describe("bounded Uniswap context", () => {
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
