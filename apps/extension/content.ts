import { uniswapContext, readUniswapAmounts } from "../../packages/adapters";
import { walletObservationSchema } from "../../packages/adapters/wallet";
window.addEventListener("message", (event) => {
  if (
    event.source !== window ||
    event.origin !== location.origin ||
    event.data?.channel !== "selqen-wallet-v1"
  )
    return;
  const parsed = walletObservationSchema.safeParse(event.data.observation);
  if (parsed.success)
    void chrome.runtime
      .sendMessage({
        type: "WALLET_OBSERVED",
        observation: parsed.data,
      })
      .catch(() => {});
});
let previous = "";
let previousAmounts = "";
function observe() {
  const amounts = readUniswapAmounts(document);
  const amountKey = JSON.stringify(
    amounts ? { ...amounts, observedAt: 0 } : null,
  );
  if (location.href === previous && amountKey === previousAmounts) return;
  previousAmounts = amountKey;
  const navigated = location.href !== previous;
  previous = location.href;
  if (navigated) host.hidden = true;
  const context = uniswapContext(location.href);
  if (context) {
    context.pageAmounts = amounts;
    void chrome.runtime
      .sendMessage({ type: "CONTEXT", context })
      .catch(() => {});
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
button.onclick = () => void chrome.runtime.sendMessage({ type: "OPEN_PANEL" });
section.append(title, description, button);
root.append(style, section);
document.documentElement.append(host);
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "GUARD_BANNER") host.hidden = !message.visible;
});
let interval: ReturnType<typeof setInterval> | undefined;
function start() {
  if (!host.isConnected) document.documentElement.append(host);
  previous = "";
  observe();
  if (interval) clearInterval(interval);
  interval = setInterval(observe, 750);
}
start();
window.addEventListener("pagehide", () => {
  clearInterval(interval);
  interval = undefined;
  host.hidden = true;
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) start();
});
