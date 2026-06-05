import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const mobileDir = path.join(root, "mobile", "app");
const authPath = path.join(root, ".auth", "user.json");
const checks = [];

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    stdio: "pipe",
    ...options,
  });
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function add(label, ready, next, detail = "") {
  checks.push({ label, ready: Boolean(ready), next, detail });
}

function productionAuthReady() {
  if (!fs.existsSync(authPath)) {
    return { ready: false, detail: "missing" };
  }

  try {
    const auth = JSON.parse(fs.readFileSync(authPath, "utf8"));
    const hasProductionAuth =
      auth.cookies?.some((cookie) => /(^|\.)aidowedding\.net$/i.test(cookie.domain ?? "")) ||
      auth.origins?.some((origin) => /^https:\/\/aidowedding\.net$/i.test(origin.origin ?? ""));

    return { ready: hasProductionAuth, detail: hasProductionAuth ? "aidowedding.net auth state found" : "wrong domain" };
  } catch (error) {
    return { ready: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

const auth = productionAuthReady();
add(
  "Production signed-in auth state",
  auth.ready,
  "corepack pnpm run auth:production:refresh",
  auth.detail,
);

const ghAuth = run("gh", ["auth", "status"]);
const ghRepo = ghAuth.status === 0 ? run("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]) : null;
add(
  "GitHub CLI login",
  ghAuth.status === 0,
  "gh auth login",
  ghAuth.status === 0 ? "logged in" : "not logged in",
);
add(
  "GitHub repository secret access",
  ghAuth.status === 0 && ghRepo?.status === 0 && Boolean(ghRepo.stdout.trim()),
  "run from the GitHub repo after gh auth login",
  ghRepo?.stdout.trim() || "repo not resolved",
);

const easWhoami = run(npmCommand(), ["exec", "eas", "--", "whoami"], { cwd: mobileDir });
add(
  "EAS CLI login",
  easWhoami.status === 0,
  "corepack pnpm --dir mobile/app exec eas login",
  easWhoami.status === 0 ? easWhoami.stdout.trim() : "not logged in",
);

console.log("A.I. DO Account Access");
console.log("======================");

for (const check of checks) {
  console.log(`${check.ready ? "READY" : "NEEDS LOGIN"} - ${check.label}`);
  if (check.detail) {
    console.log(`  ${check.detail}`);
  }
  if (!check.ready) {
    console.log(`  Next: ${check.next}`);
  }
}

const missing = checks.filter((check) => !check.ready);
console.log("");
console.log(`Account access ready: ${checks.length - missing.length}/${checks.length}`);

if (missing.length > 0) {
  console.log("");
  console.log("Final account-gated commands after login:");
  console.log("- corepack pnpm run auth:production:set-github-secret");
  console.log("- corepack pnpm --dir mobile/app run build:android:store");
  console.log("- corepack pnpm --dir mobile/app run build:ios");
  process.exit(1);
}
