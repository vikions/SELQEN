import { evaluate } from "../engine";
import { policyAt, type Snapshot, type Intent } from "../engine/types";
export function receipt(snapshot: Snapshot, intent?: Intent, now = Date.now()) {
  return {
    product: "SELQEN",
    schemaVersion: 1,
    policyVersion: "0.1",
    mode: snapshot.mode,
    createdAt: new Date(now).toISOString(),
    statement:
      "Local analysis record. Not a signed attestation or authorization to trade.",
    policy: policyAt(now),
    snapshot,
    intent: intent ?? null,
    result: evaluate(snapshot, intent, policyAt(now)),
  };
}
export function exportReceipt(
  snapshot: Snapshot,
  intent?: Intent,
  now = Date.now(),
) {
  downloadReceipt(
    JSON.stringify(receipt(snapshot, intent, now), null, 2),
    `selqen-${snapshot.mode}-${now}.json`,
  );
}
export function downloadReceipt(
  data: string,
  filename = "selqen-receipt.json",
) {
  const url = URL.createObjectURL(
    new Blob([data], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
