import { inspectWalletRequest } from "../../packages/adapters/wallet";
type Provider = {
  isMetaMask?: boolean;
  chainId?: string;
  request: (...args: unknown[]) => unknown;
};
const wrapped = new WeakSet<object>();
function attach(provider: Provider | undefined) {
  if (
    !provider ||
    typeof provider.request !== "function" ||
    wrapped.has(provider)
  )
    return;
  try {
    const original = provider.request;
    provider.request = function (...args: unknown[]) {
      try {
        const observation = inspectWalletRequest(args[0], provider.chainId);
        if (observation)
          window.postMessage(
            { channel: "selqen-wallet-v1", observation },
            location.origin,
          );
      } catch {
        /* Observation must never prevent the wallet request. */
      }
      return Reflect.apply(original, this, args);
    };
    wrapped.add(provider);
  } catch {
    /* Frozen providers are unsupported; never override their descriptors. */
  }
}
window.addEventListener("eip6963:announceProvider", (event) => {
  const detail = (event as CustomEvent).detail;
  if (detail?.info?.rdns === "io.metamask") attach(detail.provider);
});
function legacy() {
  const provider = (window as Window & { ethereum?: Provider }).ethereum;
  if (provider?.isMetaMask) attach(provider);
}
window.addEventListener("ethereum#initialized", legacy);
legacy();
window.dispatchEvent(new Event("eip6963:requestProvider"));
