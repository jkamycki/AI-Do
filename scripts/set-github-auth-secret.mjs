import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const authPath = path.join(root, ".auth", "user.json");
const secretName = "AIDO_AUTH_STATE_BASE64";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    ...options,
  });
}

if (!fs.existsSync(authPath)) {
  fail("Production auth is missing. Run: corepack pnpm run auth:production:refresh");
}

let auth;
try {
  auth = JSON.parse(fs.readFileSync(authPath, "utf8"));
} catch (error) {
  fail(`.auth/user.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
}

const hasProductionAuth =
  auth.cookies?.some((cookie) => /(^|\.)aidowedding\.net$/i.test(cookie.domain ?? "")) ||
  auth.origins?.some((origin) => /^https:\/\/aidowedding\.net$/i.test(origin.origin ?? ""));

if (!hasProductionAuth) {
  fail("Production auth is not for aidowedding.net. Run: corepack pnpm run auth:production:refresh");
}

const ghAuth = run("gh", ["auth", "status"], { stdio: "pipe" });
if (ghAuth.status !== 0) {
  fail("GitHub CLI is not logged in. Run: gh auth login");
}

const repo = run("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], { stdio: "pipe" });
if (repo.status !== 0 || !repo.stdout.trim()) {
  fail("Could not resolve the GitHub repository. Run this from a repo with an origin remote, or set the secret manually.");
}

const secretValue = Buffer.from(fs.readFileSync(authPath)).toString("base64");
const setSecret = run("gh", ["secret", "set", secretName], {
  input: secretValue,
  stdio: ["pipe", "pipe", "pipe"],
});

if (setSecret.status !== 0) {
  fail((setSecret.stderr || setSecret.stdout || `Failed to set ${secretName}`).trim());
}

console.log(`Updated GitHub Actions secret ${secretName} for ${repo.stdout.trim()}.`);
console.log("Next: corepack pnpm run release:signoff:mark -- github");
