import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = "C:/Users/Kamyc/Documents/AI-Do";
const outDir = path.join(root, "marketing", "portal-screens");
const authState = path.join(root, ".auth", "user.json");
const baseURL = process.env.AIDO_BASE_URL ?? "https://aidowedding.net";

fs.mkdirSync(outDir, { recursive: true });

const pages = [
  { name: "dashboard", url: "/dashboard" },
  { name: "vendors", url: "/vendors" },
  { name: "guests", url: "/guests" },
  { name: "timeline", url: "/timeline" },
  { name: "documents", url: "/documents" },
  { name: "website-editor", url: "/website-editor" },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  storageState: authState,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

const page = await context.newPage();

for (const item of pages) {
  const response = await page.goto(new URL(item.url, baseURL).toString(), { waitUntil: "domcontentloaded" });
  if (!response?.ok()) {
    throw new Error(`${item.name} failed with HTTP ${response?.status() ?? "unknown"}`);
  }

  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1400);
  await page.addStyleTag({
    content: `
      [data-testid="aria-assistant"],
      [aria-label*="Aria" i],
      [class*="support" i],
      [class*="chat" i],
      [class*="fixed"][class*="bottom"][class*="right"] { display: none !important; }
      aside, nav[class*="fixed"], [class*="md:ml-64"] { margin-left: 0 !important; }
      img {
        visibility: hidden !important;
      }
      body { background: #fff7f2 !important; }
    `,
  }).catch(() => {});

  await page.evaluate(() => {
    const replacements = [
      [/Stacy & Rick/g, "Maya & Leo"],
      [/Stacy/g, "Maya"],
      [/Rick/g, "Leo"],
      [/test@aidowedding\.net/gi, "demo@aidowedding.net"],
      [/Test/g, "Demo Couple"],
      [/Chateau LaMer/g, "The Rosewood Hall"],
      [/123 Ses Drive, Babylon, Ny 27520/g, "1200 Garden Lane, Lakeview, CA 94022"],
      [/Hilton Garden Inn/g, "Harbor House Hotel"],
      [/123 East Drewry Lane/g, "450 Harbor Road"],
      [/Magic Mike/g, "Soundwave Events"],
      [/Lori's Flowers/g, "Bloom & Branch Studio"],
      [/Big Picture Photograph(?:y|er)?/g, "Golden Hour Photo Co."],
      [/Riverside Manor/g, "Willow Creek Estate"],
      [/riversidemanor@riverside\.com/gi, "hello@willowcreek.example"],
      [/riversidemanor\.net/gi, "willowcreek.example"],
      [/Playwright Budget Vendor ch[^\\s]*/g, "Demo Budget Vendor"],
      [/Playwright Vendor [^\\s]+/g, "Demo Vendor"],
      [/Playwright Guest [^\\s]+/g, "Demo Guest"],
      [/playwright-[^\\s]+@example\\.com/gi, "demo-guest@example.com"],
      [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "demo@example.com"],
      [/\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "555-0100"],
      [/\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g, "$12,400"],
      [/\b\d+\s*expected guests\b/gi, "120 expected guests"],
      [/\b\d+\s*days to go\b/gi, "240 days to go"],
      [/\b\d+\s*DAYS\b/g, "240 DAYS"],
      [/\b\d+\s*\/\s*\d+\s*rooms booked\b/gi, "12 / 20 rooms booked"],
      [/\b\d+\s*left\b/gi, "8 left"],
      [/Thursday, July 24, 2036/g, "Saturday, June 14, 2027"],
      [/Jul 24, 2036/g, "Jun 14, 2027"],
      [/July 24, 2036/g, "June 14, 2027"],
      [/Babylon, Ny/gi, "Lakeview, CA"],
      [/\b3715\b/g, "240"],
      [/\b2036\b/g, "2027"],
      [/\b200\b/g, "120"],
      [/65,000/g, "35,000"],
      [/52,064/g, "12,400"],
      [/10,600/g, "3,200"],
      [/5\/13/g, "8/16"],
      [/James Hudson/g, "Alex Rivera"],
      [/Nick Smith/g, "Jordan Lee"],
      [/Jane Doe/g, "Taylor Morgan"],
      [/Jane Smith/g, "Casey Brooks"],
      [/Jenny Black/g, "Avery Stone"],
      [/John Smith/g, "Riley Parker"],
      [/Michael Brown/g, "Morgan Reed"],
    ];

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const node of nodes) {
      let value = node.nodeValue ?? "";
      for (const [pattern, replacement] of replacements) {
        value = value.replace(pattern, replacement);
      }
      node.nodeValue = value;
    }

    for (const element of Array.from(document.querySelectorAll("body *"))) {
      const style = window.getComputedStyle(element);
      if (style.position === "fixed" && style.bottom !== "auto" && style.right !== "auto") {
        element.remove();
      }
    }
  });

  const file = path.join(outDir, `${item.name}.png`);
  await page.screenshot({
    path: file,
    fullPage: false,
    clip: { x: 0, y: 0, width: 1185, height: 700 },
  });
  console.log(file);
}

await browser.close();
