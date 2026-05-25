import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = path.resolve("C:/Users/Kamyc/Documents/AI-Do");
const htmlPath = path.join(root, "marketing", "aido-60s-demo.html");
const outputDir = path.join(root, "marketing", "rendered-video");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: {
    dir: outputDir,
    size: { width: 1280, height: 720 },
  },
});

const page = await context.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
await page.waitForFunction(() => window.__AIDO_VIDEO_DONE__ === true, null, { timeout: 70000 });
await page.close();
await context.close();
await browser.close();

console.log(outputDir);
