import { z } from "zod";
export const contextSchema = z.object({
  site: z.literal("Uniswap"),
  url: z.string().url(),
  chainId: z.number().int().nullable(),
  tokenAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .nullable(),
  outputAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .nullable(),
  observedAt: z.number(),
  coverage: z.literal("url-only"),
  pageAmounts: z
    .object({
      input: z.string().regex(/^(?:\d{1,40})(?:\.\d{1,36})?$/),
      output: z.string().regex(/^(?:\d{1,40})(?:\.\d{1,36})?$/),
      inputLabel: z.string().max(40),
      outputLabel: z.string().max(40),
      observedAt: z.number(),
    })
    .optional(),
});
export type PageContext = z.infer<typeof contextSchema>;
// Selectors inspected on app.uniswap.org on 2026-09-28. Labels are display
// evidence only; they never establish address identity or amount scaling.
export function readUniswapAmounts(
  doc: Document,
  now = Date.now(),
): PageContext["pageAmounts"] {
  const read = (side: "in" | "out") => {
    const inputs = doc.querySelectorAll<HTMLInputElement>(
      `input[data-testid="amount-input-${side}"]`,
    );
    if (inputs.length !== 1 || !inputs[0].getClientRects().length)
      return undefined;
    const value = inputs[0].value.trim();
    return value.startsWith(".") ? `0${value}` : value;
  };
  const result = contextSchema.shape.pageAmounts.safeParse({
    input: read("in"),
    output: read("out"),
    inputLabel: doc
      .querySelector('[data-testid="choose-input-token-label"]')
      ?.textContent?.trim(),
    outputLabel: doc
      .querySelector('[data-testid="choose-output-token-label"]')
      ?.textContent?.trim(),
    observedAt: now,
  });
  return result.success ? result.data : undefined;
}
const address = (x: string | null) =>
  x && /^0x[0-9a-fA-F]{40}$/.test(x) ? x : null;
export function uniswapContext(
  href: string,
  now = Date.now(),
): PageContext | null {
  const url = new URL(href);
  if (url.protocol !== "https:" || url.hostname !== "app.uniswap.org")
    return null;
  const pieces = url.pathname.split("/").filter(Boolean);
  const chainParam = url.searchParams.get("chain");
  const chainId =
    chainParam === "robinhood" ||
    chainParam === "4663" ||
    pieces.includes("robinhood")
      ? 4663
      : null;
  const tokenAddress =
    address(url.searchParams.get("inputCurrency")) ||
    (pieces[0] === "explore" && pieces[1] === "tokens"
      ? address(pieces[3] ?? null)
      : null);
  const safeQuery = new URLSearchParams();
  for (const key of ["chain", "inputCurrency", "outputCurrency"]) {
    const v = url.searchParams.get(key);
    if (v) safeQuery.set(key, v.slice(0, 100));
  }
  return {
    site: "Uniswap",
    url: `${url.origin}${url.pathname}?${safeQuery}`,
    chainId,
    tokenAddress,
    outputAddress: address(url.searchParams.get("outputCurrency")),
    observedAt: now,
    coverage: "url-only",
  };
}
