import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile, mkdtemp } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
const fallback = path.join(
  process.env.LOCALAPPDATA ?? "",
  "ms-playwright/chromium-1228/chrome-win64/chrome.exe",
);
const executablePath =
  process.env.BROWSER_EXECUTABLE_PATH ??
  (existsSync(chromium.executablePath())
    ? chromium.executablePath()
    : fallback);
const out = "output/playwright";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("heading", { name: /Know what/ }).waitFor();
  await page.getByRole("button", { name: "Lookalike", exact: true }).click();
  await page.getByRole("heading", { name: "Do not sign yet" }).waitFor();
  await page.getByRole("button", { name: "Canonical", exact: true }).click();
  await page.screenshot({ path: `${out}/landing-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("link", { name: "Get the extension", exact: true })
    .click();
  await page.getByText("How to install", { exact: true }).click();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: `${out}/landing-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("link", { name: /Try the demo/ }).click();
  await page.getByRole("heading", { name: "Asset checks passed" }).waitFor();
  await page.screenshot({ path: `${out}/desktop.png`, fullPage: true });
  await page.getByRole("button", { name: /02 Same ticker/ }).click();
  await page.getByRole("heading", { name: "Do not sign yet" }).waitFor();
  await page.getByRole("button", { name: "Review this quote" }).click();
  await page.getByRole("button", { name: "Continue demo review" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Pause before you proceed.",
  });
  await dialog.waitFor();
  await page.getByRole("button", { name: "Back to review" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: /03 Corporate action/ }).click();
  await page.getByRole("heading", { name: "Review required" }).waitFor();
  assert.match(
    await page.locator(".verdict").innerText(),
    /Multiplier changes/,
  );
  await page.getByRole("button", { name: /04 Unfavorable settlement/ }).click();
  await page
    .getByText("Settlement differs from reference", { exact: true })
    .waitFor();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export receipt" }).click();
  const downloaded = await download;
  const receipt = JSON.parse(await readFile(await downloaded.path(), "utf8"));
  assert.equal(receipt.mode, "fixture");
  assert.equal(receipt.result.verdict, "warning");
  assert.ok(
    receipt.result.findings.some((f) => f.code === "SIGNATURE_NOT_INSPECTED"),
  );
  await page.getByRole("button", { name: /05 Outdated price/ }).click();
  await page.getByRole("heading", { name: "Do not sign yet" }).waitFor();
  await page.getByRole("button", { name: "Review this quote" }).click();
  assert.equal(
    await page.locator(".amount-row").nth(1).locator("strong").innerText(),
    "—",
  );
  await page.getByRole("button", { name: /06 Trading halt/ }).click();
  await page.getByText("Trading halt reported", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/mobile.png`, fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.getByRole("button", { name: "Check a live token" }).click();
  await page.getByLabel("Check a contract").fill("AAPL");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page
    .getByText("Enter a complete 0x contract address (42 characters).")
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: desktop, mobile, six scenarios, guard dialog, receipt provenance, invalid input, no page errors.",
  );
} finally {
  await browser.close();
}

// Load the real unpacked artifact in a fresh disposable browser profile.
const profile = await mkdtemp(path.join(os.tmpdir(), "selqen-extension-test-"));
const extension = path.resolve("dist/extension");
const context = await chromium.launchPersistentContext(profile, {
  executablePath,
  headless: true,
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
  ],
});
try {
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker", { timeout: 15000 }));
  const id = new URL(worker.url()).hostname;
  const page = await context.newPage();
  await page.setViewportSize({ width: 380, height: 900 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`chrome-extension://${id}/index.html`);
  await page.getByText("Generic token checker", { exact: true }).waitFor();
  await page.getByLabel("Check a contract").fill("oops");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page
    .getByText("Enter a complete 0x contract address (42 characters).")
    .waitFor();
  const invalid = await page.evaluate(() =>
    chrome.runtime.sendMessage({
      type: "CHECK",
      address: "invalid",
      chainId: 4663,
    }),
  );
  assert.equal(invalid.error, "Invalid check request.");
  await page.getByRole("button", { name: "Guard", exact: true }).click();
  assert.equal(
    await page.evaluate(
      async () => (await chrome.storage.local.get("guard")).guard,
    ),
    true,
  );
  await page.screenshot({ path: `${out}/extension.png`, fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  // Explicitly synthetic Uniswap page; tests adapter plumbing, not live dApp compatibility.
  await context.route("https://app.uniswap.org/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>SELQEN adapter test fixture</title><h1>Controlled Uniswap URL fixture</h1>",
    }),
  );
  const dapp = await context.newPage();
  await dapp.goto(
    "https://app.uniswap.org/swap?chain=robinhood&inputCurrency=0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
  );
  await dapp.waitForSelector("#selqen-advisory", { state: "attached" });
  const providerResult = await dapp.evaluate(async () => {
    const calls = [];
    const provider = {
      chainId: "0x1237",
      request: function (args) {
        if (this !== provider) throw new Error("Provider receiver changed");
        calls.push(args);
        return Promise.reject(
          Object.assign(new Error("Controlled user rejection"), { code: 4001 }),
        );
      },
    };
    dispatchEvent(
      new CustomEvent("eip6963:announceProvider", {
        detail: {
          info: { rdns: "io.metamask" },
          provider,
        },
      }),
    );
    const args = {
      method: "eth_sendTransaction",
      params: [
        {
          to: "0x1111111111111111111111111111111111111111",
          data:
            "0x095ea7b3" + "2".repeat(40).padStart(64, "0") + "f".repeat(64),
        },
      ],
    };
    let code;
    try {
      await provider.request(args);
    } catch (e) {
      code = e.code;
    }
    return { code, count: calls.length, unchanged: calls[0] === args };
  });
  assert.deepEqual(providerResult, { code: 4001, count: 1, unchanged: true });
  await worker.evaluate(async () => {
    for (let i = 0; i < 50; i++) {
      const entries = Object.entries(await chrome.storage.session.get(null));
      if (
        entries.some(
          ([key, value]) =>
            key.startsWith("wallet:") &&
            value.kind === "approval" &&
            value.unlimited &&
            value.chainId === "4663",
        )
      )
        return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(
      "Observed approval did not reach extension session storage",
    );
  });
  console.log(
    "PASS: MAIN-world EIP-6963 observation, exact forwarding, rejection preservation, isolated bridge and worker storage (controlled provider).",
  );
  await dapp.evaluate(() => {
    const controls = document.createElement("section");
    controls.innerHTML =
      '<input data-testid="amount-input-in" value="1.25"><input data-testid="amount-input-out" value="425"><span data-testid="choose-input-token-label">AAPL</span><span data-testid="choose-output-token-label">USDG</span>';
    document.body.append(controls);
  });
  await worker.evaluate(async () => {
    for (let i = 0; i < 50; i++) {
      const entries = Object.values(await chrome.storage.session.get(null));
      if (
        entries.some(
          (value) =>
            value.pageAmounts?.input === "1.25" &&
            value.pageAmounts?.output === "425",
        )
      )
        return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Visible amounts were not observed");
  });
  await dapp.bringToFront();
  await page.getByText("Wallet request observed", { exact: true }).waitFor();
  await page.getByText("Amounts from Uniswap", { exact: true }).waitFor();
  await page.screenshot({
    path: `${out}/extension-observation.png`,
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  await dapp.locator('[data-testid="amount-input-out"]').fill("");
  await worker.evaluate(async () => {
    for (let i = 0; i < 50; i++) {
      const entries = Object.values(await chrome.storage.session.get(null));
      if (
        entries.some((value) => value.site === "Uniswap" && !value.pageAmounts)
      )
        return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Cleared quote retained stale amounts");
  });
  console.log(
    "PASS: visible page amount extraction and clearing stale amounts (controlled DOM).",
  );
  const contexts = await worker.evaluate(async () =>
    Object.values(await chrome.storage.session.get(null)),
  );
  assert.ok(
    contexts.some(
      (c) =>
        c.site === "Uniswap" &&
        c.chainId === 4663 &&
        c.tokenAddress === "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
    ),
  );
  await dapp.evaluate(() => {
    dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  await dapp.waitForSelector("#selqen-advisory", { state: "attached" });
  console.log(
    "PASS: isolated content script and URL context messaging on a synthetic Uniswap-origin page.",
  );
  console.log(
    "PASS: unpacked MV3 service worker, side-panel page, persistent mode, message validation, 380px layout.",
  );
} finally {
  await context.close();
}
