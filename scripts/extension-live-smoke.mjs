import { chromium } from "playwright";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const extension = path.resolve("dist/extension");
const context = await chromium.launchPersistentContext(
  await mkdtemp(path.join(os.tmpdir(), "selqen-live-")),
  {
    executablePath:
      process.env.BROWSER_EXECUTABLE_PATH ??
      path.join(
        process.env.LOCALAPPDATA,
        "ms-playwright/chromium-1228/chrome-win64/chrome.exe",
      ),
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  },
);
try {
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker"));
  const page = await context.newPage();
  await page.goto(
    `chrome-extension://${new URL(worker.url()).hostname}/index.html`,
  );
  const response = await page.evaluate(() =>
    chrome.runtime.sendMessage({
      type: "CHECK",
      address: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
      chainId: 4663,
    }),
  );
  console.log(JSON.stringify(response, null, 2));
  if (response?.snapshot?.canonical !== true) process.exitCode = 1;
} finally {
  await context.close();
}
