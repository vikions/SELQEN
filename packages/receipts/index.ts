import { z } from "zod";
import { keccak256, type Hex } from "viem";

export const MAX_RECEIPT_BYTES = 1_048_576;
const schema = z.object({
  product: z.literal("SELQEN"),
  schemaVersion: z.literal(1),
  mode: z.literal("live"),
  createdAt: z.string().datetime(),
  snapshot: z.object({
    mode: z.literal("live"),
    chainId: z.literal(4663),
    address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    symbol: z.string().max(40).optional(),
  }),
  result: z.object({ verdict: z.enum(["verified", "warning", "blocked"]) }),
});
export type ReceiptFile = {
  hash: Hex;
  text: string;
  bytes: number;
  data: z.infer<typeof schema>;
};
// Hash the exact UTF-8 file bytes, including whitespace. Never regenerate dates.
export function parseReceiptFile(bytes: Uint8Array): ReceiptFile {
  if (!bytes.length || bytes.length > MAX_RECEIPT_BYTES)
    throw new Error("Choose a receipt JSON file smaller than 1 MB.");
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const data = schema.parse(JSON.parse(text));
    return { hash: keccak256(bytes), text, bytes: bytes.length, data };
  } catch {
    throw new Error(
      "Choose an exported SELQEN live receipt for Robinhood Chain (4663). Demo fixtures are not accepted.",
    );
  }
}
