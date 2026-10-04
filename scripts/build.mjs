import { build as viteBuild } from "vite";
import { build as bundle } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";
await viteBuild({ configFile: "apps/demo-lab/vite.config.ts" });
await viteBuild({
  configFile: false,
  root: "apps/extension",
  base: "./",
  build: { outDir: "../../dist/extension", emptyOutDir: true },
});
await bundle({
  entryPoints: ["apps/extension/background.ts"],
  outfile: "dist/extension/background.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "chrome116",
  minify: true,
});
await bundle({
  entryPoints: ["apps/extension/content.ts"],
  outfile: "dist/extension/content.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome116",
  minify: true,
});
await copyFile("apps/extension/manifest.json", "dist/extension/manifest.json");
await bundle({
  entryPoints: ["apps/extension/provider.ts"],
  outfile: "dist/extension/provider.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome116",
  minify: true,
});
console.log(
  "SELQEN built: dist/extension (Load unpacked), dist/demo-lab (web preview).",
);
