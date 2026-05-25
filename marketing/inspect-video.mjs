import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
const file = "C:/Users/Kamyc/Documents/AI-Do/marketing/aido-60s-saas-demo-voiceover.webm";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent(`<video id="v" src="${pathToFileURL(file).href}" muted></video>`);
const info = await page.evaluate(async () => {
  const v = document.getElementById('v');
  await new Promise((resolve, reject) => { v.onloadedmetadata = resolve; v.onerror = reject; });
  return { duration: v.duration, videoWidth: v.videoWidth, videoHeight: v.videoHeight, audioTracks: v.audioTracks ? v.audioTracks.length : null };
});
console.log(JSON.stringify(info));
await browser.close();
