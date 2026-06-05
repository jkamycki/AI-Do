import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const authStatePath = path.join(root, ".auth", "user.json");

function fail(message) {
  console.error(message);
  console.error("Run: corepack pnpm run auth:production:refresh");
  process.exit(1);
}

if (!fs.existsSync(authStatePath)) {
  fail("AIDO_AUTH_STATE_BASE64 requires .auth/user.json saved from https://aidowedding.net.");
}

const authStateText = fs.readFileSync(authStatePath, "utf8");
const authState = JSON.parse(authStateText);
const hasProductionAuth =
  authState.cookies?.some((cookie) => /(^|\.)aidowedding\.net$/i.test(cookie.domain ?? "")) ||
  authState.origins?.some((origin) => /^https:\/\/aidowedding\.net$/i.test(origin.origin ?? ""));

if (!hasProductionAuth) {
  fail("The current .auth/user.json is not for https://aidowedding.net.");
}

console.log("GitHub Actions secret name:");
console.log("AIDO_AUTH_STATE_BASE64");
console.log("");
console.log("GitHub Actions secret value:");
console.log(Buffer.from(authStateText, "utf8").toString("base64"));
console.log("");
console.log("Keep this value private. Replace it after refreshing production auth.");
