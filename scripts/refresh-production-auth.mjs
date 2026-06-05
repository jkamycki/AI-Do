import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const authDir = path.join(root, ".auth");
const authStatePath = path.join(authDir, "user.json");

fs.mkdirSync(authDir, { recursive: true });

const args = [
  "pnpm",
  "exec",
  "playwright",
  "codegen",
  "--save-storage=.auth/user.json",
  "https://aidowedding.net",
];

const result =
  process.platform === "win32"
    ? spawnSync(
        "cmd.exe",
        ["/d", "/s", "/c", "corepack pnpm exec playwright codegen --save-storage=.auth/user.json https://aidowedding.net"],
        {
          cwd: root,
          stdio: "inherit",
          shell: false,
        },
      )
    : spawnSync("corepack", args, {
        cwd: root,
        stdio: "inherit",
        shell: false,
      });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (!fs.existsSync(authStatePath)) {
  console.error("Playwright codegen finished, but .auth/user.json was not created.");
  process.exit(1);
}

const authState = JSON.parse(fs.readFileSync(authStatePath, "utf8"));
const hasProductionAuth =
  authState.cookies?.some((cookie) => /(^|\.)aidowedding\.net$/i.test(cookie.domain ?? "")) ||
  authState.origins?.some((origin) => /^https:\/\/aidowedding\.net$/i.test(origin.origin ?? ""));

if (!hasProductionAuth) {
  console.error("Auth state was saved, but it does not contain aidowedding.net session data.");
  console.error("Log in at https://aidowedding.net before closing the Playwright window.");
  process.exit(1);
}

console.log("Production auth state saved to .auth/user.json.");
console.log("Next: corepack pnpm run check:launch:auth");
console.log("Then: corepack pnpm run auth:production:print-secret");
