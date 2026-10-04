import { z } from "zod";
import { checkAsset } from "../../packages/robinhood";
import { contextSchema } from "../../packages/adapters";
import { walletObservationSchema } from "../../packages/adapters/wallet";
const request = z.object({
  type: z.literal("CHECK"),
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  chainId: z.number().int(),
});
chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.storage.session.remove([`context:${tabId}`, `wallet:${tabId}`]);
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === "loading")
    void chrome.storage.session.remove([`context:${tabId}`, `wallet:${tabId}`]);
});
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  const trusted =
    sender.id === chrome.runtime.id &&
    sender.url?.startsWith(chrome.runtime.getURL(""));
  if (
    message?.type === "WALLET_OBSERVED" &&
    sender.id === chrome.runtime.id &&
    sender.frameId === 0 &&
    sender.tab?.id !== undefined &&
    sender.url?.startsWith("https://app.uniswap.org/")
  ) {
    const parsed = walletObservationSchema.safeParse(message.observation);
    if (parsed.success)
      void chrome.storage.session.set({
        [`wallet:${sender.tab.id}`]: { ...parsed.data, observedAt: Date.now() },
      });
    return;
  }
  if (
    message?.type === "CONTEXT" &&
    sender.id === chrome.runtime.id &&
    sender.tab?.id !== undefined &&
    sender.url?.startsWith("https://app.uniswap.org/")
  ) {
    const parsed = contextSchema.safeParse(message.context);
    if (
      parsed.success &&
      new URL(parsed.data.url).hostname === "app.uniswap.org"
    ) {
      void chrome.storage.session.set({
        [`context:${sender.tab.id}`]: parsed.data,
      });
    }
    return;
  }
  if (
    message?.type === "OPEN_PANEL" &&
    sender.id === chrome.runtime.id &&
    sender.tab?.id !== undefined &&
    sender.url?.startsWith("https://app.uniswap.org/")
  ) {
    void chrome.sidePanel.open({ tabId: sender.tab.id });
    return;
  }
  if (trusted && message?.type === "CHECK") {
    const parsed = request.safeParse(message);
    if (!parsed.success) {
      reply({ error: "Invalid check request." });
      return;
    }
    checkAsset(parsed.data.address, parsed.data.chainId)
      .then((snapshot) => reply({ snapshot }))
      .catch(() => reply({ error: "The check could not finish. Retry." }));
    return true;
  }
  if (trusted && message?.type === "GUARD_STATUS") {
    // Only extension-owned panels can request a banner; the page cannot mark itself safe.
    const tabId = Number(message.tabId);
    if (Number.isInteger(tabId) && typeof message.visible === "boolean")
      void chrome.tabs
        .sendMessage(tabId, { type: "GUARD_BANNER", visible: message.visible })
        .catch(() => {});
  }
});
