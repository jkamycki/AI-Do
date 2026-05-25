import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = "C:/Users/Kamyc/Documents/AI-Do";
const outDir = path.join(root, "marketing", "landing-preview-recording");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 720 } },
});

const page = await context.newPage();
await page.goto("https://aidowedding.net/#preview", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.locator("#preview").scrollIntoViewIfNeeded();
await page.waitForTimeout(800);

await page.evaluate(() => {
  const preview = document.querySelector("#preview");
  const videoFrame = preview?.querySelector(".aspect-\\[9\\/16\\], .sm\\:aspect-video") || preview;
  document.body.innerHTML = "";
  document.documentElement.style.margin = "0";
  document.documentElement.style.padding = "0";
  document.body.style.margin = "0";
  document.body.style.padding = "0";
  document.body.style.background = "#fff7f2";
  if (videoFrame) {
    const wrapper = document.createElement("div");
    wrapper.style.width = "100vw";
    wrapper.style.height = "100vh";
    wrapper.style.overflow = "hidden";
    wrapper.style.background = "#fff7f2";
    wrapper.appendChild(videoFrame);
    document.body.appendChild(wrapper);
    const el = videoFrame;
    el.style.width = "100vw";
    el.style.height = "100vh";
    el.style.borderRadius = "0";
    el.style.maxWidth = "none";
  }
});

await page.waitForTimeout(66_000);
const video = page.video();
await page.close();
await context.close();
await browser.close();

const videoPath = await video?.path();
if (!videoPath) throw new Error("No landing preview video was recorded.");

const destination = path.join(root, "marketing", "aido-landing-page-preview.webm");
fs.copyFileSync(videoPath, destination);
console.log(destination);
