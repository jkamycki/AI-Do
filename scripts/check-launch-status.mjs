import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const productionOrigin = "https://aidowedding.net";
const productionAuthPath = path.join(root, ".auth", "user.json");

const ready = [];
const attention = [];
const manual = [];

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function mark(condition, label, issue) {
  if (condition) {
    ready.push(label);
  } else {
    attention.push(issue);
  }
}

function nodeScriptPasses(scriptPath, args = []) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    encoding: "utf8",
    shell: false,
    stdio: "pipe",
  });

  return result.status === 0;
}

function readProductionAuthState() {
  if (!fs.existsSync(productionAuthPath)) {
    return { status: "missing" };
  }

  try {
    const authState = JSON.parse(fs.readFileSync(productionAuthPath, "utf8"));
    const hasProductionAuth =
      authState.cookies?.some((cookie) => /(^|\.)aidowedding\.net$/i.test(cookie.domain ?? "")) ||
      authState.origins?.some((origin) => /^https:\/\/aidowedding\.net$/i.test(origin.origin ?? ""));

    return { status: hasProductionAuth ? "ready" : "wrong-domain" };
  } catch (error) {
    return { status: "invalid", error: error instanceof Error ? error.message : String(error) };
  }
}

mark(exists("docs/launch-readiness.md"), "Launch readiness guide", "docs/launch-readiness.md is missing");
mark(exists("docs/release-handoff.md"), "Release handoff guide", "docs/release-handoff.md is missing");
mark(exists("docs/mobile-preview.md"), "Mobile browser preview guide", "docs/mobile-preview.md is missing");
mark(exists("docs/production-env.md"), "Production environment guide", "docs/production-env.md is missing");
mark(exists("mobile/app/android/app/build/outputs/apk/release/app-release.apk"), "Android release APK", "Android release APK has not been built");
mark(exists("mobile/app/android/app/build/outputs/bundle/release/app-release.aab"), "Local Android AAB preflight", "Local Android AAB preflight has not been built");
mark(exists("mobile/app/store/screenshots/iphone"), "iPhone store screenshots", "iPhone store screenshots are missing");
mark(exists("marketing/release-screenshots/web"), "Website release screenshots", "Website release screenshots are missing");
mark(exists("mobile/app/STORE_LISTING.md"), "Mobile store listing copy", "mobile/app/STORE_LISTING.md is missing");
mark(
  exists("docs/release-manifest.json") && nodeScriptPasses("scripts/write-release-manifest.mjs", ["--check"]),
  "Release artifact manifest",
  "docs/release-manifest.json is missing or stale; run corepack pnpm run release:manifest",
);
mark(
  exists("docs/store-submission-pack.md") && nodeScriptPasses("scripts/write-store-submission-pack.mjs", ["--check"]),
  "Store submission pack",
  "docs/store-submission-pack.md is missing or stale; run corepack pnpm run release:store-pack",
);
mark(
  exists("docs/release-completion-report.json") &&
    exists("docs/release-completion-summary.md") &&
    nodeScriptPasses("scripts/check-release-completion.mjs", ["--check-report", "--check-summary"]),
  "Completion report and summary",
  "Completion report or summary is missing or stale; run corepack pnpm run release:completion-summary",
);

const auth = readProductionAuthState();
if (auth.status === "ready") {
  ready.push("Production signed-in auth state");
} else if (auth.status === "wrong-domain") {
  manual.push(`Refresh production auth for ${productionOrigin}: corepack pnpm run auth:production:refresh`);
} else if (auth.status === "invalid") {
  manual.push(`Refresh production auth because .auth/user.json is invalid: ${auth.error}`);
} else {
  manual.push(`Create production auth state: corepack pnpm run auth:production:refresh`);
}

manual.push("Run the signed-in launch gate after auth refresh: corepack pnpm run check:launch:auth");
manual.push("Check production auth state anytime: corepack pnpm run doctor:production:auth");
manual.push("Update GitHub secret AIDO_AUTH_STATE_BASE64: corepack pnpm run auth:production:set-github-secret");
manual.push("Deploy website/API through Vercel and Render, then re-run production checks");
manual.push("Submit the EAS Android production artifact to Google Play and complete the EAS/App Store Connect iOS build");

const automatedPercent = attention.length === 0 ? 100 : Math.round((ready.length / (ready.length + attention.length)) * 100);
const productionAuthReady = auth.status === "ready";

console.log("A.I. DO Launch Status");
console.log("=====================");
console.log(`Automated readiness files/assets: ${automatedPercent}%`);
console.log(`Production signed-in auth: ${productionAuthReady ? "ready" : "needs login"}`);
console.log("");

console.log("Ready");
for (const item of ready) {
  console.log(`- ${item}`);
}

if (attention.length > 0) {
  console.log("");
  console.log("Needs Attention");
  for (const item of attention) {
    console.log(`- ${item}`);
  }
}

console.log("");
console.log("Manual Finish Line");
for (const item of manual) {
  console.log(`- ${item}`);
}
