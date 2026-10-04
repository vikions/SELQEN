// Maintainer tool: pin official token identities to the official feed directory.
// Runtime never chooses a feed from a user-supplied ticker.
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createPublicClient, http, parseAbi } from "viem";
const registryUrl = "https://api.robinhood.com/rhj/assets";
const directoryUrl =
  "https://reference-data-directory.vercel.app/feeds-robinhood-mainnet.json";
const fallback = path.join(
  process.env.LOCALAPPDATA ?? "",
  "ms-playwright/chromium-1228/chrome-win64/chrome.exe",
);
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE_PATH ??
    (existsSync(chromium.executablePath())
      ? chromium.executablePath()
      : fallback),
  headless: true,
});
try {
  const page = await browser.newPage();
  const read = async (url) => {
    const response = await page.goto(url);
    if (!response?.ok()) throw new Error(`${url}: HTTP ${response?.status()}`);
    return JSON.parse(await page.locator("body").innerText());
  };
  const registry = await read(registryUrl);
  const directory = await read(directoryUrl);
  const feeds = [];
  for (const entry of directory.filter((f) =>
    /^Robinhood .+ \/ USD$/.test(f.name),
  )) {
    const symbol = entry.docs.baseAsset;
    if (
      entry.name !== `Robinhood ${symbol} / USD` ||
      entry.decimals !== 8 ||
      Number(entry.heartbeat) !== 86400
    )
      throw new Error(`Unexpected metadata: ${entry.name}`);
    const assets = registry.assets.filter((a) => a.tokenSymbol === symbol);
    if (assets.length !== 1)
      throw new Error(`Ambiguous or missing registry identity: ${symbol}`);
    const deployments = assets[0].deployments.filter((d) => d.chainId === 4663);
    if (deployments.length !== 1)
      throw new Error(`Ambiguous or missing deployment: ${symbol}`);
    const tokenAddress = deployments[0].contractAddress;
    const feedAddress = entry.proxyAddress;
    if (
      ![tokenAddress, feedAddress].every((a) => /^0x[0-9a-fA-F]{40}$/.test(a))
    )
      throw new Error(`Invalid address: ${symbol}`);
    feeds.push({
      symbol,
      assetId: assets[0].id,
      chainId: 4663,
      tokenAddress,
      feedAddress,
      description: entry.name,
      decimals: 8,
      heartbeatSeconds: 86400,
    });
  }
  if (!feeds.length) throw new Error("Empty catalogue");
  for (const key of ["symbol", "tokenAddress", "feedAddress"])
    if (new Set(feeds.map((f) => f[key].toLowerCase())).size !== feeds.length)
      throw new Error(`Duplicate ${key}`);
  feeds.sort((a, b) => a.symbol.localeCompare(b.symbol));
  const rpcUrl = "https://rpc.mainnet.chain.robinhood.com";
  const client = createPublicClient({
    transport: http(rpcUrl, { timeout: 12000, retryCount: 0 }),
  });
  if ((await client.getChainId()) !== 4663)
    throw new Error("RPC chain mismatch");
  const blockNumber = await client.getBlockNumber();
  const abi = parseAbi(["function description() view returns (string)"]);
  for (let i = 0; i < feeds.length; i += 4) {
    await Promise.all(
      feeds.slice(i, i + 4).map(async (feed) => {
        const description = await client.readContract({
          address: feed.feedAddress,
          abi,
          blockNumber,
          functionName: "description",
        });
        // Directory display names and deployed descriptions use two conventions.
        if (![feed.description, `RH${feed.symbol} / USD`].includes(description))
          throw new Error(
            `Unexpected deployed description: ${feed.symbol}: ${description}`,
          );
        feed.description = description;
      }),
    );
  }
  await writeFile(
    "packages/robinhood/feeds.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        registryUrl,
        directoryUrl,
        rpcUrl,
        descriptionBlock: blockNumber.toString(),
        feeds,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      registryAssets: registry.assets.length,
      mappedFeeds: feeds.length,
      symbols: feeds.map((f) => f.symbol),
    }),
  );
} finally {
  await browser.close();
}
