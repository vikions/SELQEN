// Controlled wallet/RPC tests. This script cannot submit a mainnet transaction.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  parseAbi,
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  keccak256,
} from "viem";
const fixture = JSON.parse(
  await readFile("tests/fixtures/registry.json", "utf8"),
);
const REGISTRY = "0x51bfB2A08E7680786eD54a00eE4d915Bab6B3867";
const account = "0x2222222222222222222222222222222222222222";
const tx = `0x${"cd".repeat(32)}`;
const block = `0x${"ef".repeat(32)}`;
const abi = parseAbi([
  "function anchor(bytes32)",
  "event ReceiptAnchored(bytes32 indexed receiptHash,address indexed author,uint256 timestamp)",
]);
const file = Buffer.from(JSON.stringify(fixture.receipt, null, 2));
const hash = keccak256(file);
const timestamp = 1791374400n;
const site = process.env.SELQEN_BASE_URL ?? "http://127.0.0.1:5173/";
const origin = new URL(site).origin;
assert.ok(["http:", "https:"].includes(new URL(site).protocol));
const fallback = path.join(
  process.env.LOCALAPPDATA ?? "",
  "ms-playwright/chromium-1228/chrome-win64/chrome.exe",
);
const executablePath =
  process.env.BROWSER_EXECUTABLE_PATH ??
  (existsSync(chromium.executablePath())
    ? chromium.executablePath()
    : fallback);
await mkdir("output/playwright", { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let anchored = false;
  let reverted = false;
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    assert.equal(
      url.hostname,
      "rpc.mainnet.chain.robinhood.com",
      "Unexpected external request",
    );
    const request = route.request().postDataJSON();
    const handle = ({ id, method }) => {
      let result;
      if (method === "eth_chainId") result = "0x1237";
      else if (method === "eth_getCode") result = fixture.runtime;
      else if (method === "eth_call")
        result = encodeAbiParameters(
          [{ type: "uint256" }],
          [anchored ? timestamp : 0n],
        );
      else if (method === "eth_blockNumber") result = "0x123";
      else if (method === "eth_getTransactionReceipt") {
        anchored = !reverted;
        result = {
          transactionHash: tx,
          transactionIndex: "0x0",
          blockHash: block,
          blockNumber: "0x123",
          from: account,
          to: REGISTRY,
          cumulativeGasUsed: "0x10000",
          gasUsed: "0x10000",
          effectiveGasPrice: "0x1",
          contractAddress: null,
          status: reverted ? "0x0" : "0x1",
          type: "0x2",
          logsBloom: `0x${"00".repeat(256)}`,
          logs: reverted
            ? []
            : [
                {
                  address: REGISTRY,
                  topics: encodeEventTopics({
                    abi,
                    eventName: "ReceiptAnchored",
                    args: { receiptHash: hash, author: account },
                  }),
                  data: encodeAbiParameters([{ type: "uint256" }], [timestamp]),
                  transactionHash: tx,
                  transactionIndex: "0x0",
                  blockHash: block,
                  blockNumber: "0x123",
                  logIndex: "0x0",
                  removed: false,
                },
              ],
        };
      } else throw new Error(`Unexpected RPC method ${method}`);
      return { jsonrpc: "2.0", id, result };
    };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        Array.isArray(request) ? request.map(handle) : handle(request),
      ),
    });
  });
  await page.addInitScript(
    ({ account, tx }) => {
      window.walletCalls = [];
      window.allowAnchor = false;
      window.ethereum = {
        isMetaMask: true,
        request: async (args) => {
          window.walletCalls.push(args);
          if (args.method === "eth_chainId") return "0x1237";
          if (
            args.method === "eth_requestAccounts" ||
            args.method === "eth_accounts"
          )
            return [account];
          if (args.method === "eth_sendTransaction") {
            if (!window.allowAnchor) throw { code: 4001 };
            return tx;
          }
          throw new Error(`Unexpected wallet method ${args.method}`);
        },
      };
    },
    { account, tx },
  );
  await page.goto(`${site}#receipt`);
  await page.getByRole("heading", { name: /Keep a record/ }).waitFor();
  await page.screenshot({
    path: "output/playwright/receipt-desktop.png",
    fullPage: true,
  });
  assert.deepEqual(await page.evaluate(() => window.walletCalls), []);
  const input = page.getByLabel("SELQEN live receipt", { exact: false });
  await input.setInputFiles({
    name: "fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ ...fixture.receipt, mode: "fixture" }),
    ),
  });
  await page
    .getByRole("alert")
    .filter({ hasText: "Demo fixtures are not accepted" })
    .waitFor();
  await input.setInputFiles({
    name: "controlled-test.json",
    mimeType: "application/json",
    buffer: file,
  });
  await page
    .getByText("This file hash has not been registered yet.", { exact: true })
    .waitFor();
  assert.deepEqual(await page.evaluate(() => window.walletCalls), []);
  await page.getByRole("button", { name: /Connect MetaMask/ }).click();
  await page.getByRole("button", { name: /Anchor hash/ }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Request cancelled" })
    .waitFor();
  assert.equal(anchored, false);
  await page.evaluate(() => {
    window.allowAnchor = true;
  });
  await page.getByRole("button", { name: /Anchor hash/ }).click();
  await page
    .getByText(
      "Receipt hash registered. The transaction and event were confirmed.",
      { exact: true },
    )
    .waitFor();
  const sends = await page.evaluate(() =>
    window.walletCalls.filter((c) => c.method === "eth_sendTransaction"),
  );
  assert.equal(sends.length, 2); // First attempt was explicitly cancelled.
  assert.deepEqual(sends[1].params, [
    {
      from: account,
      to: REGISTRY,
      chainId: "0x1237",
      value: "0x0",
      data: encodeFunctionData({ abi, functionName: "anchor", args: [hash] }),
    },
  ]);
  assert.equal(
    await page.getByRole("button", { name: /Anchor hash/ }).count(),
    0,
  );
  await page.reload();
  await input.setInputFiles({
    name: "controlled-test.json",
    mimeType: "application/json",
    buffer: file,
  });
  await page
    .getByText("This exact file is registered on Robinhood Chain.", {
      exact: true,
    })
    .waitFor();
  assert.deepEqual(await page.evaluate(() => window.walletCalls), []);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "output/playwright/receipt-mobile-controlled.png",
    fullPage: true,
  });
  // A reverted tx can be retried, but an unknown or pending tx stays protected.
  anchored = false;
  reverted = true;
  await page.reload();
  await input.setInputFiles({
    name: "controlled-test.json",
    mimeType: "application/json",
    buffer: file,
  });
  await page
    .getByRole("alert")
    .filter({ hasText: "Previous transaction reverted" })
    .waitFor();
  await page.getByRole("button", { name: /Connect MetaMask/ }).click();
  await page.evaluate(() => {
    window.allowAnchor = true;
    Storage.prototype.setItem = function () {
      throw new Error("Storage disabled for test");
    };
  });
  await page.getByRole("button", { name: /Anchor hash/ }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Anchor transaction reverted" })
    .waitFor();
  await page.getByRole("link", { name: /View anchor transaction/ }).waitFor();
  await page.getByRole("button", { name: "Check registration" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Previous transaction reverted" })
    .waitFor();
  await page.getByRole("button", { name: /Anchor hash/ }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: controlled receipt browser flow: local hash, no auto wallet calls, fixture rejection, cancellation, exact zero-value tx, event confirmation, duplicate avoidance, revert recovery, storage failure, mobile layout. No live transactions.",
  );
} finally {
  await browser.close();
}
