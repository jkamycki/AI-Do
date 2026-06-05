import { chromium } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import net from "node:net";
import process from "node:process";

const root = process.cwd();
const previewUrl = "http://127.0.0.1:19006";
const previewPort = 19006;
let previewServer = null;

function runPreviewServer() {
  previewServer =
    process.platform === "win32"
      ? spawn("cmd.exe", ["/d", "/s", "/c", "corepack pnpm run preview:mobile:web"], {
          cwd: root,
          stdio: "inherit",
          shell: false,
        })
      : spawn("corepack", ["pnpm", "run", "preview:mobile:web"], {
          cwd: root,
          stdio: "inherit",
          shell: false,
        });
}

function stopPreviewServer() {
  if (!previewServer?.pid) return;

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(previewServer.pid), "/t", "/f"], {
      stdio: "ignore",
      shell: false,
    });
    return;
  }

  previewServer.kill();
}

function requestOk(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve((response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 500);
    });

    request.setTimeout(3000, () => {
      request.destroy();
      resolve(false);
    });

    request.on("error", () => resolve(false));
  });
}

function portIsOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port }, () => {
      socket.destroy();
      resolve(true);
    });

    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });

    socket.on("error", () => resolve(false));
  });
}

async function waitForPreview() {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (await requestOk(previewUrl)) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}

async function main() {
  const alreadyRunning = await requestOk(previewUrl);
  const portOccupied = alreadyRunning ? true : await portIsOpen(previewPort);
  if (!alreadyRunning && !portOccupied) {
    runPreviewServer();
  }

  if (!(await waitForPreview())) {
    throw new Error(`Timed out waiting for ${previewUrl}`);
  }

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    await context.addInitScript(() => {
      window.localStorage?.clear();
      window.sessionStorage?.clear();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.route("**/api/pricing/public", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ enabled: false }),
      });
    });

    await page.goto(previewUrl, { waitUntil: "commit", timeout: 30_000 });
    await page.getByText("Sign in to your wedding hub").waitFor({ timeout: 30_000 });

    const bodyText = await page.locator("body").innerText();
    for (const expected of [
      "WELCOME BACK",
      "Sign in to your wedding hub",
      "Use your A.I DO account",
      "Sign up",
      "Use preview account",
    ]) {
      if (!bodyText.includes(expected)) {
        throw new Error(`Mobile preview is missing expected text: ${expected}`);
      }
    }

    await page.getByText("Use preview account", { exact: true }).click();
    await page.getByText("Wedding Progress").waitFor({ timeout: 30_000 });

    const homeText = await page.locator("body").innerText();
    for (const expected of ["Wedding Progress", "Guest Hub", "Budget Summary", "Website"]) {
      if (!homeText.includes(expected)) {
        throw new Error(`Mobile app home is missing expected text: ${expected}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Mobile preview browser errors: ${errors.join("; ")}`);
    }
  } finally {
    await browser.close();
    stopPreviewServer();
  }

  console.log("Mobile app browser preview passed.");
}

main().catch((error) => {
  stopPreviewServer();
  console.error(error.message);
  process.exit(1);
});
