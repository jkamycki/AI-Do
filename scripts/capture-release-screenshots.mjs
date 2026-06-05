import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const root = process.cwd();
const isLocalMode = process.argv.includes("--local");
const baseURL = process.env.AIDO_BASE_URL ?? (isLocalMode ? "http://localhost:5173" : "https://aidowedding.net");
const authState = path.join(root, ".auth", "user.json");
const webOutDir = path.join(root, "marketing", "release-screenshots", "web");
const mobileOutDir = path.join(root, "mobile", "app", "store", "screenshots", "iphone");

if (!fs.existsSync(authState)) {
  console.error("Missing .auth/user.json. Run Playwright codegen against https://aidowedding.net before capturing signed-in screenshots.");
  process.exit(1);
}

const authStateJson = JSON.parse(fs.readFileSync(authState, "utf8"));
const baseHost = new URL(baseURL).hostname;
const hasMatchingAuth =
  authStateJson.cookies?.some((cookie) => cookie.domain?.replace(/^\./, "") === baseHost) ||
  authStateJson.origins?.some((origin) => {
    try {
      return new URL(origin.origin ?? "").hostname === baseHost;
    } catch {
      return false;
    }
  });

if (!hasMatchingAuth) {
  console.error(`Release screenshots require .auth/user.json saved from ${baseURL}.`);
  console.error(`Refresh it with: npx.cmd playwright codegen --save-storage=.auth/user.json ${baseURL}`);
  process.exit(1);
}

if (!isLocalMode && baseHost !== "aidowedding.net") {
  console.error("Production release screenshots must target https://aidowedding.net. Use --local for localhost drafts.");
  process.exit(1);
}

fs.mkdirSync(webOutDir, { recursive: true });
fs.mkdirSync(mobileOutDir, { recursive: true });

const publicScreens = [
  { name: "01-home-desktop", path: "/" },
  { name: "02-website-builder-desktop", path: "/wedding-website-builder" },
  { name: "03-photo-qr-desktop", path: "/wedding-photo-qr-code" },
  { name: "04-vendors-desktop", path: "/for-vendors" },
];

const mobileScreens = [
  { name: "01-dashboard", path: "/dashboard", expected: /dashboard|budget|guest|vendor|plan on the go/i },
  { name: "02-guests", path: "/guests", expected: /guest|rsvp|save the date|invitation/i },
  { name: "03-website-editor", path: "/website-editor", expected: /website|publish|preview|rsvp|photo/i },
  { name: "04-budget", path: "/budget", expected: /budget|vendor expenses|payment|remaining/i },
  { name: "05-vendors", path: "/vendors", expected: /vendor|message|contact|payment|contract/i },
  { name: "06-aria", path: "/aria", expected: /aria|assistant|ask|message/i },
];

function absoluteUrl(route) {
  return new URL(route, baseURL).toString();
}

async function waitForPage(page, label) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1_200);
  const text = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  if (/something went wrong|internal server error|404: NOT_FOUND/i.test(text)) {
    throw new Error(`${label} loaded with an error state`);
  }
}

async function scrubPage(page) {
  await page.addStyleTag({
    content: `
      [data-testid="aria-assistant"],
      [aria-label*="support" i],
      [class*="support" i],
      [class*="chat" i],
      [class*="fixed"][class*="bottom"][class*="right"] {
        display: none !important;
      }
      img[src*="images.unsplash.com"],
      img[src*="/api/storage/"],
      img[src*="/api/website/"],
      video {
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
      [/Playwright Budget Vendor ch[^\s]*/g, "Demo Budget Vendor"],
      [/Playwright Vendor [^\s]+/g, "Demo Vendor"],
      [/Playwright Guest [^\s]+/g, "Demo Guest"],
      [/playwright-[^\s]+@example\.com/gi, "demo-guest@example.com"],
      [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "demo@example.com"],
      [/\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "555-0100"],
      [/\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g, "$12,400"],
      [/\b\d+\s*expected guests\b/gi, "120 expected guests"],
      [/\b\d+\s*days to go\b/gi, "240 days to go"],
      [/\b\d+\s*DAYS\b/g, "240 DAYS"],
      [/Thursday, July 24, 2036/g, "Saturday, June 14, 2027"],
      [/Jul 24, 2036/g, "Jun 14, 2027"],
      [/July 24, 2036/g, "June 14, 2027"],
      [/Babylon, Ny/gi, "Lakeview, CA"],
      [/\b2036\b/g, "2027"],
      [/\b3715\b/g, "240"],
      [/65,000/g, "35,000"],
      [/52,064/g, "12,400"],
      [/10,600/g, "3,200"],
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
  });
}

async function capture(page, route, file, label, expected) {
  const response = await page.goto(absoluteUrl(route), { waitUntil: "domcontentloaded" });
  if (!response?.ok()) {
    throw new Error(`${label} failed with HTTP ${response?.status() ?? "unknown"}`);
  }
  await waitForPage(page, label);
  if (expected) {
    const currentPath = new URL(page.url()).pathname;
    if (currentPath === "/" || /sign-in|sign-up/i.test(currentPath)) {
      throw new Error(`${label} did not remain on an authenticated app route; final URL was ${page.url()}`);
    }
    const text = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    if (!expected.test(text)) {
      throw new Error(`${label} did not include expected authenticated content`);
    }
  }
  await scrubPage(page);
  await page.screenshot({ path: file, fullPage: false });
  console.log(file);
}

const browser = await chromium.launch({ headless: true });

const publicContext = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});
const publicPage = await publicContext.newPage();
for (const item of publicScreens) {
  await capture(publicPage, item.path, path.join(webOutDir, `${item.name}.png`), item.name);
}
await publicContext.close();

const mobileContext = await browser.newContext({
  storageState: authState,
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const mobilePage = await mobileContext.newPage();
for (const item of mobileScreens) {
  await capture(mobilePage, item.path, path.join(mobileOutDir, `${item.name}.png`), item.name, item.expected);
}
await mobileContext.close();

await browser.close();
