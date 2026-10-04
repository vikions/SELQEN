import { z } from "zod";
// Selected application state is page-controlled evidence, never a safety verdict.
export const selectedTokenSchema = z.object({
  address: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .nullable(),
  chainId: z.number().int().positive(),
  symbol: z.string().min(1).max(40),
});
export const selectionSchema = z.object({
  input: selectedTokenSchema.nullable(),
  output: selectedTokenSchema.nullable(),
});
export type Selection = z.infer<typeof selectionSchema>;

// Uniswap's selected-currency component, inspected 2026-10-04. Read only its
// bounded currency props; do not traverse wallet objects or collect app state.
export function readSelectedTokens(doc: Document): Selection | null {
  let present = false;
  const read = (side: "input" | "output") => {
    const buttons = [
      ...doc.querySelectorAll<HTMLElement>(
        `[data-testid="choose-${side}-token"]`,
      ),
    ].filter((e) => e.getClientRects().length);
    if (buttons.length !== 1) return null;
    present = true;
    const el = buttons[0];
    const label = el
      .querySelector(`[data-testid="choose-${side}-token-label"]`)
      ?.textContent?.trim();
    const networks = [
      ...el.querySelectorAll('[data-testid^="network-logo-"]'),
    ].map((e) =>
      Number(e.getAttribute("data-testid")?.replace("network-logo-", "")),
    );
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    if (!key) return null;
    type Fiber = {
      memoizedProps?: { selectedCurrencyInfo?: { currency?: unknown } };
      return?: Fiber;
      alternate?: Fiber;
    };
    const host = (el as unknown as Record<string, Fiber>)[key];
    const candidates = new Map<string, z.infer<typeof selectedTokenSchema>>();
    for (const start of [host, host.alternate]) {
      let fiber = start;
      for (let depth = 0; fiber && depth < 8; depth++, fiber = fiber.return) {
        const currency = fiber.memoizedProps?.selectedCurrencyInfo?.currency as
          | {
              address?: unknown;
              chainId?: unknown;
              symbol?: unknown;
              isNative?: unknown;
            }
          | undefined;
        if (!currency) continue;
        const parsed = selectedTokenSchema.safeParse(
          {
            address: currency.isNative === true ? null : currency.address,
            chainId: currency.chainId,
            symbol: currency.symbol,
          },
          { jitless: true },
        );
        if (
          !parsed.success ||
          parsed.data.symbol !== label ||
          (networks.length && networks.some((n) => n !== parsed.data.chainId))
        )
          continue;
        candidates.set(
          `${parsed.data.chainId}:${parsed.data.address?.toLowerCase() ?? "native"}`,
          parsed.data,
        );
      }
    }
    // Ambiguous current/alternate props must not reuse a previous token verdict.
    return candidates.size === 1 ? [...candidates.values()][0] : null;
  };
  const result = { input: read("input"), output: read("output") };
  return present ? result : null;
}
