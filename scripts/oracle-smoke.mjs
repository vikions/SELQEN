import { build } from "esbuild";
import { createPublicClient, http } from "viem";
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
  const oracle = await readEquityOracle(
    client,
    "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
    chainId,
    block,
  );
  console.log(
    JSON.stringify({ chainId, block: block.toString(), oracle }, null, 2),
  );
} catch (error) {
  console.error(error.shortMessage ?? error.message);
  process.exitCode = 1;
}
