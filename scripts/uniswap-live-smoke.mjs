// Read-only integration acceptance using real Uniswap and official data sources.
import { chromium } from "playwright";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const catalog = JSON.parse(
  await readFile("packages/robinhood/feeds.json", "utf8"),
);
const extension = path.resolve("dist/extension");
const context = await chromium.launchPersistentContext(
  await mkdtemp(path.join(os.tmpdir(), "selqen-uniswap-")),
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
await mkdir("output/playwright", { recursive: true });
let debugPage;
try {
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker"));
  const panel = await context.newPage();
  await panel.setViewportSize({ width: 400, height: 900 });
  await panel.goto(
    `chrome-extension://${new URL(worker.url()).hostname}/index.html`,
  );
  const dapp = await context.newPage();
  debugPage = dapp;
  dapp.on("pageerror", (error) => console.log("DAPP ERROR", error.message));
  const results = [];
  for (const [symbol, side] of [
    ["AAPL", "input"],
    ["NVDA", "output"],
  ]) {
    const token = catalog.feeds.find((f) => f.symbol === symbol).tokenAddress;
    const usdg = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
    await dapp.goto(
      `https://app.uniswap.org/swap?chain=robinhood&inputCurrency=${side === "input" ? token : usdg}&outputCurrency=${side === "output" ? token : usdg}`,
      { waitUntil: "domcontentloaded" },
    );
    console.log("Opened", symbol);
    const selectedLabel = dapp
      .locator(`[data-testid="choose-${side}-token-label"]`)
      .filter({ hasText: symbol });
    try {
      await selectedLabel.waitFor({ timeout: 15000 });
    } catch {
      console.log(
        "Selecting by contract through the real token picker",
        symbol,
      );
      await dapp.locator(`[data-testid="choose-${side}-token"]`).click();
      await dapp.locator('[data-testid="explore-search-input"]').fill(token);
      await dapp
        .locator(`[data-testid="token-option-4663-${symbol}"]`)
        .click({ timeout: 30000 });
      await selectedLabel.waitFor({ timeout: 30000 });
    }
    console.log("Selected", symbol);
    console.log(
      "BRIDGE",
      await dapp.evaluate(
        () =>
          new Promise((resolve) => {
            const listener = (event) => {
              if (event.data?.channel === "selqen-selection-v1") {
                removeEventListener("message", listener);
                resolve(event.data);
              }
            };
            addEventListener("message", listener);
            setTimeout(() => {
              removeEventListener("message", listener);
              resolve("No selection heartbeat");
            }, 2000);
          }),
      ),
    );
    // Reproduce stale URL: selection must come from the real rendered controls.
    await dapp.evaluate(() =>
      history.replaceState(
        null,
        "",
        "/swap?chain=mainnet&inputCurrency=NATIVE",
      ),
    );
    await dapp.bringToFront();
    try {
      await panel
        .locator(".asset-heading strong")
        .filter({ hasText: symbol })
        .waitFor({ timeout: 30000 });
    } catch (error) {
      console.log("PANEL", await panel.locator("body").innerText());
      console.log(
        "STORAGE",
        await worker.evaluate(() => chrome.storage.session.get(null)),
      );
      console.log(
        "TABS",
        await worker.evaluate(() =>
          chrome.tabs.query({ active: true, currentWindow: true }),
        ),
      );
      await panel.screenshot({
        path: "output/playwright/live-failure.png",
        fullPage: true,
      });
      throw error;
    }
    await panel.getByRole("heading", { name: "What we checked" }).waitFor();
    assert.ok(
      await panel.getByText("Canonical asset", { exact: true }).count(),
    );
    assert.ok(
      await panel.getByText("Multiplier reconciled", { exact: true }).count(),
    );
    await panel.locator(".evidence").evaluate((el) => {
      el.open = true;
    });
    assert.ok(
      await panel
        .getByText(catalog.feeds.find((f) => f.symbol === symbol).feedAddress, {
          exact: true,
        })
        .count(),
    );
    await panel.locator(".evidence").evaluate((el) => {
      el.open = false;
    });
    await panel.screenshot({
      path: `output/playwright/live-${symbol.toLowerCase()}.png`,
      fullPage: true,
    });
    const saved = await worker.evaluate(async () =>
      Object.values(await chrome.storage.session.get(null)).filter(
        (c) => c?.site === "Uniswap",
      ),
    );
    assert.ok(
      saved.some(
        (c) =>
          c.coverage === "page-state" &&
          c.selection?.[side]?.address.toLowerCase() === token.toLowerCase(),
      ),
    );
    const text = await panel.locator(".checks").innerText();
    results.push({ symbol, side, checks: text });
    console.log(
      `PASS ${symbol}: real ${side} selection despite stale URL, canonical identity, multiplier, equity oracle, visible checklist.`,
    );
  }
  await writeFile(
    "output/uniswap-live.json",
    JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2),
  );
} catch (error) {
  if (debugPage) {
    console.log(
      "DAPP",
      (await debugPage.locator("body").innerText()).slice(0, 2500),
    );
    await debugPage.screenshot({
      path: "output/playwright/uniswap-failure.png",
    });
  }
  throw error;
} finally {
  await context.close();
}
