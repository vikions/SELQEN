import { readSelectedTokens } from "../../packages/adapters/selection";
let timer: ReturnType<typeof setInterval> | undefined;
function observe() {
  try {
    window.postMessage(
      {
        channel: "selqen-selection-v1",
        selection: readSelectedTokens(document),
      },
      location.origin,
    );
  } catch {
    window.postMessage(
      { channel: "selqen-selection-v1", selection: null },
      location.origin,
    );
  }
}
function start() {
  if (timer) clearInterval(timer);
  observe();
  timer = setInterval(observe, 750);
}
start();
window.addEventListener("pagehide", () => {
  clearInterval(timer);
  timer = undefined;
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) start();
});
