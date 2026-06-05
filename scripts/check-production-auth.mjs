import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const authStatePath = path.join(root, ".auth", "user.json");

if (!fs.existsSync(authStatePath)) {
  console.error(
    "Production auth smoke requires .auth/user.json. Refresh it with Playwright codegen against https://aidowedding.net.",
  );
  console.error("Run: corepack pnpm run auth:production:refresh");
  process.exit(1);
}

const authState = JSON.parse(fs.readFileSync(authStatePath, "utf8"));
const hasProductionAuth =
  authState.cookies?.some((cookie) => /(^|\.)aidowedding\.net$/i.test(cookie.domain ?? "")) ||
  authState.origins?.some((origin) => /^https:\/\/aidowedding\.net$/i.test(origin.origin ?? ""));

if (!hasProductionAuth) {
  console.error(
    "Production auth smoke requires .auth/user.json saved from https://aidowedding.net, but the current auth state is not for the production domain.",
  );
  console.error("Refresh it with: corepack pnpm run auth:production:refresh");
  process.exit(1);
}

const playwrightArgs = [
  "pnpm",
  "exec",
  "playwright",
  "test",
  "tests/aido-smoke.spec.ts",
  "--project=chromium",
  "--project=mobile-chrome",
  "--grep",
  "authenticated",
];

const env = {
  ...process.env,
  AIDO_BASE_URL: "https://aidowedding.net",
};

const result =
  process.platform === "win32"
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", "corepack pnpm exec playwright test tests/aido-smoke.spec.ts --project=chromium --project=mobile-chrome --grep authenticated"], {
        cwd: root,
        env,
        stdio: "inherit",
        shell: false,
      })
    : spawnSync("corepack", playwrightArgs, {
        cwd: root,
        env,
        stdio: "inherit",
        shell: false,
      });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Production authenticated smoke passed.");
