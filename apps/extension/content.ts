import {
  uniswapContext,
  readUniswapAmounts,
  withSelection,
} from "../../packages/adapters";
import {
  selectionSchema,
  type Selection,
} from "../../packages/adapters/selection";
import { walletObservationSchema } from "../../packages/adapters/wallet";
const lifecycle = new AbortController();
let stopped = false;
let interval: ReturnType<typeof setInterval> | undefined;
function retire() {
  if (stopped) return;
  stopped = true;
  clearInterval(interval);
  interval = undefined;
  lifecycle.abort();
  host.remove();
}
function runtimeAvailable() {
  if (stopped) return false;
  try {
    if (chrome.runtime?.id) return true;
  } catch {
    /* Reloaded extensions invalidate the old content-script runtime. */
  }
  retire();
  return false;
}
function send(message: unknown) {
  if (!runtimeAvailable()) return;
  const failed = (error: unknown) => {
    if (/extension context invalidated/i.test(String(error))) retire();
  };
  // sendMessage can throw synchronously before returning a Promise.
  try {
    void chrome.runtime.sendMessage(message).catch(failed);
  } catch (error) {
    failed(error);
  }
}
let selection: Selection | null = null;
let selectionAt = 0;
window.addEventListener(
  "message",
  (event) => {
    if (
      event.source !== window ||
      event.origin !== location.origin ||
      event.data?.channel !== "selqen-selection-v1"
    )
      return;
    const parsed = selectionSchema.nullable().safeParse(event.data.selection);
    if (parsed.success) {
      selection = parsed.data;
      selectionAt = Date.now();
      observe();
    }
  },
  { signal: lifecycle.signal },
);
window.addEventListener(
  "message",
  (event) => {
    if (
      event.source !== window ||
      event.origin !== location.origin ||
      event.data?.channel !== "selqen-wallet-v1"
    )
      return;
    const parsed = walletObservationSchema.safeParse(event.data.observation);
    if (parsed.success)
      send({
        type: "WALLET_OBSERVED",
        observation: parsed.data,
      });
  },
  { signal: lifecycle.signal },
);
let previous = "";
let previousAmounts = "";
let previousSelection = "";
let lastSent = 0;
let heldAmounts: ReturnType<typeof readUniswapAmounts>;
function observe() {
  if (!runtimeAvailable()) return;
  const currentSelection = Date.now() - selectionAt < 2500 ? selection : null;
  const selectionKey = JSON.stringify(currentSelection);
  const amounts = readUniswapAmounts(document);
  const amountKey = JSON.stringify(
    amounts ? { ...amounts, observedAt: 0 } : null,
  );
  if (
    location.href === previous &&
    amountKey === previousAmounts &&
    selectionKey === previousSelection &&
    Date.now() - lastSent < 5000
  )
    return;
  if (selectionKey !== previousSelection) host.hidden = true;
  previousSelection = selectionKey;
  lastSent = Date.now();
  if (amountKey !== previousAmounts) heldAmounts = amounts;
  previousAmounts = amountKey;
  const navigated = location.href !== previous;
  previous = location.href;
  if (navigated) host.hidden = true;
  let context = uniswapContext(location.href);
  if (context) {
    if (currentSelection) context = withSelection(context, currentSelection);
    context.pageAmounts = heldAmounts;
    send({ type: "CONTEXT", context });
  }
}
const host = document.createElement("div");
host.id = "selqen-advisory";
host.hidden = true;
const root = host.attachShadow({ mode: "closed" });
const style = document.createElement("style");
style.textContent =
  ":host{position:fixed;bottom:20px;right:20px;z-index:2147483647;max-width:320px}section{font:13px/1.5 system-ui;background:#fff2ee;color:#832d26;border:1px solid #cd9488;border-radius:12px;padding:18px;box-shadow:0 8px 24px #18292222}strong{display:block;font-size:15px}p{margin:8px 0 12px}button{cursor:pointer;padding:8px 12px;background:#832d26;color:white;border:0;border-radius:6px;font:inherit}";
const section = document.createElement("section");
section.setAttribute("role", "status");
const title = document.createElement("strong");
title.textContent = "SELQEN · Review before signing";
const description = document.createElement("p");
description.textContent =
  "A hard safety condition needs attention. This warning does not block or inspect your wallet request.";
const button = document.createElement("button");
button.textContent = "Open review";
button.onclick = () => send({ type: "OPEN_PANEL" });
section.append(title, description, button);
root.append(style, section);
document.documentElement.append(host);
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "GUARD_BANNER") host.hidden = !message.visible;
});
function start() {
  if (!runtimeAvailable()) return;
  if (!host.isConnected) document.documentElement.append(host);
  previous = "";
  observe();
  if (stopped) return;
  if (interval) clearInterval(interval);
  interval = setInterval(observe, 750);
}
start();
window.addEventListener(
  "pagehide",
  () => {
    clearInterval(interval);
    interval = undefined;
    host.hidden = true;
  },
  { signal: lifecycle.signal },
);
window.addEventListener(
  "pageshow",
  (event) => {
    if (event.persisted) start();
  },
  { signal: lifecycle.signal },
);
