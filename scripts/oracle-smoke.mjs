import { build } from "esbuild";
import { createPublicClient, http } from "viem";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const catalog = JSON.parse(
  await readFile("packages/robinhood/feeds.json", "utf8"),
);
const { outputFiles } = await build({
  entryPoints: ["packages/robinhood/oracle.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { readEquityOracle } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);
const client = createPublicClient({
  transport: http("https://rpc.mainnet.chain.robinhood.com", {
    timeout: 12000,
    retryCount: 0,
  }),
});
try {
  const chainId = await client.getChainId();
  if (chainId !== 4663) throw new Error("RPC chain mismatch");
  const block = await client.getBlockNumber();
  const results = [];
  for (let i = 0; i < catalog.feeds.length; i += 4) {
    results.push(
      ...(await Promise.all(
        catalog.feeds.slice(i, i + 4).map(async (feed) => {
          try {
            const oracle = await readEquityOracle(
              client,
              feed.tokenAddress,
              chainId,
              block,
            );
            if (!oracle) throw new Error("Mapping missing");
            return {
              symbol: feed.symbol,
              oracle,
              fresh: Date.now() - oracle.updatedAt <= oracle.maxAgeMs,
            };
          } catch (error) {
            process.exitCode = 1;
            return {
              symbol: feed.symbol,
              error: error.shortMessage ?? error.message,
            };
          }
        }),
      )),
    );
  }
  const report = {
    checkedAt: new Date().toISOString(),
    chainId,
    block: block.toString(),
    results,
  };
  await mkdir("output", { recursive: true });
  await writeFile(
    "output/oracle-catalog-live.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error.shortMessage ?? error.message);
  process.exitCode = 1;
}
