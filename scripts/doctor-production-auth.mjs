import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const authStatePath = path.join(root, ".auth", "user.json");
const productionOrigin = "https://aidowedding.net";

function readAuthState() {
  if (!fs.existsSync(authStatePath)) {
    return { status: "missing" };
  }

  try {
    const authState = JSON.parse(fs.readFileSync(authStatePath, "utf8"));
    const cookies = Array.isArray(authState.cookies) ? authState.cookies : [];
    const origins = Array.isArray(authState.origins) ? authState.origins : [];
    const productionCookies = cookies.filter((cookie) => /(^|\.)aidowedding\.net$/i.test(cookie.domain ?? ""));
    const productionOrigins = origins.filter((origin) => /^https:\/\/aidowedding\.net$/i.test(origin.origin ?? ""));

    return {
      status: productionCookies.length > 0 || productionOrigins.length > 0 ? "ready" : "wrong-domain",
      cookieCount: cookies.length,
      originCount: origins.length,
      productionCookieCount: productionCookies.length,
      productionOriginCount: productionOrigins.length,
    };
  } catch (error) {
    return {
      status: "invalid",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const state = readAuthState();

console.log("A.I. DO Production Auth Doctor");
console.log("==============================");
console.log(`Auth state path: .auth/user.json`);
console.log(`Production site: ${productionOrigin}`);

if (state.status === "ready") {
  console.log("Status: ready");
  console.log(`Production cookies: ${state.productionCookieCount}`);
  console.log(`Production origins: ${state.productionOriginCount}`);
  console.log("");
  console.log("Next commands:");
  console.log("corepack pnpm run check:production:auth");
  console.log("corepack pnpm run auth:production:set-github-secret");
  console.log("corepack pnpm run auth:production:print-secret # fallback only");
  process.exit(0);
}

if (state.status === "wrong-domain") {
  console.log("Status: needs refresh");
  console.log(`Saved cookies: ${state.cookieCount}`);
  console.log(`Saved origins: ${state.originCount}`);
  console.log("The saved auth state does not belong to aidowedding.net.");
} else if (state.status === "invalid") {
  console.log("Status: invalid");
  console.log(`Error: ${state.error}`);
} else {
  console.log("Status: missing");
  console.log(".auth/user.json has not been created yet.");
}

console.log("");
console.log("Refresh production auth:");
console.log("corepack pnpm run auth:production:refresh");
console.log("");
console.log("After login, run:");
console.log("corepack pnpm run check:launch:auth");
process.exit(1);
