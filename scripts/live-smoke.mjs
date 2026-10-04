import { build } from "esbuild";
const { outputFiles } = await build({
  entryPoints: ["packages/robinhood/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { checkAsset } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);
const s = await checkAsset("0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9");
console.log(JSON.stringify(s, null, 2));
if (s.canonical !== true) process.exitCode = 1;
