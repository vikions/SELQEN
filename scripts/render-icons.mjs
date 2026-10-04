// Rasterize SELQEN's own vector mark for Chrome's required PNG icon sizes.
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
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
  const svg = await readFile("apps/extension/public/favicon.svg", "utf8");
  await mkdir("apps/extension/public/icons", { recursive: true });
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const size of [16, 48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`,
    );
    await page.screenshot({
      path: `apps/extension/public/icons/icon${size}.png`,
      omitBackground: true,
    });
  }
} finally {
  await browser.close();
}
