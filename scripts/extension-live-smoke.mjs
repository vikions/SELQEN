import { chromium } from "playwright";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
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
  const catalog = JSON.parse(
    await readFile("packages/robinhood/feeds.json", "utf8"),
  );
  await mkdir("output/playwright", { recursive: true });
  await page.setViewportSize({ width: 400, height: 900 });
  for (const symbol of ["AAPL", "NVDA"]) {
    const token = catalog.feeds.find((f) => f.symbol === symbol);
    if (symbol !== "AAPL")
      await page.getByText("Check another token", { exact: true }).click();
    await page.getByLabel("Check a contract").fill(token.tokenAddress);
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await page
      .locator(".asset-heading strong")
      .filter({ hasText: symbol })
      .waitFor({ timeout: 30000 });
    assert.ok(await page.getByText("Canonical asset", { exact: true }).count());
    assert.ok(
      await page.getByText("Multiplier reconciled", { exact: true }).count(),
    );
    await page.locator(".evidence > summary").click();
    assert.ok(await page.getByText(token.feedAddress, { exact: true }).count());
    await page.locator(".evidence > summary").click();
    await page.screenshot({
      path: `output/playwright/manual-live-${symbol.toLowerCase()}.png`,
      fullPage: true,
    });
    console.log(
      `PASS live ${symbol}: real manual UI check, registry identity, multiplier reconciliation, configured equity feed.`,
      await page.locator(".checks").innerText(),
    );
  }
} finally {
  await context.close();
}
