import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const writeReport = process.argv.includes("--write-report");
const writeSummary = process.argv.includes("--write-summary");
const checkReport = process.argv.includes("--check-report");
const checkSummary = process.argv.includes("--check-summary");
const productionOrigin = "https://aidowedding.net";
const apiOrigin = "https://ai-do.onrender.com";
const authStatePath = path.join(root, ".auth", "user.json");
const signoffPath = path.join(root, "docs", "release-signoff.json");
const signoffExamplePath = path.join(root, "docs", "release-signoff.example.json");
const completionReportPath = path.join(root, "docs", "release-completion-report.json");
const completionSummaryPath = path.join(root, "docs", "release-completion-summary.md");
const timeoutMs = 12_000;

const items = [];

function absolute(file) {
  return path.join(root, file);
}

function exists(file) {
  return fs.existsSync(absolute(file));
}

function add(group, label, ready, next) {
  items.push({ group, label, ready: Boolean(ready), next });
}

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;

  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return {
      __invalid: error instanceof Error ? error.message : String(error),
    };
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

function escapeMarkdownTableCell(value) {
  return String(value).replaceAll("|", "\\|");
}

function normalizeReportForCheck(report) {
  return {
    ...report,
    generatedAt: "<ignored>",
  };
}

function checkFileCurrent(filePath, expected, staleMessage) {
  if (!fs.existsSync(filePath)) {
    console.error(`${path.relative(root, filePath).replaceAll("\\", "/")} is missing.`);
    process.exit(1);
  }

  const current = fs.readFileSync(filePath, "utf8");
  if (current !== expected) {
    console.error(staleMessage);
    process.exit(1);
  }
}

function productionAuthStatus() {
  const state = readJsonIfExists(authStatePath);
  if (!state) return { ready: false, next: "Run corepack pnpm run auth:production:refresh" };
  if (state.__invalid) return { ready: false, next: `Refresh production auth; .auth/user.json is invalid: ${state.__invalid}` };

  const hasProductionAuth =
    state.cookies?.some((cookie) => /(^|\.)aidowedding\.net$/i.test(cookie.domain ?? "")) ||
    state.origins?.some((origin) => /^https:\/\/aidowedding\.net$/i.test(origin.origin ?? ""));

  return {
    ready: hasProductionAuth,
    next: hasProductionAuth ? "" : "Run corepack pnpm run auth:production:refresh",
  };
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "AIDO-release-completion/1.0",
      },
    });
    return {
      ok: response.ok,
      contentType: response.headers.get("content-type") ?? "",
      text: await response.text(),
      status: response.status,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function productionSmokeStatus() {
  try {
    const [website, api] = await Promise.all([
      fetchText(`${productionOrigin}/`),
      fetchText(`${apiOrigin}/api/healthz`),
    ]);
    let apiPayload = {};
    try {
      apiPayload = JSON.parse(api.text);
    } catch {}

    const ready =
      website.ok &&
      website.contentType.includes("text/html") &&
      website.text.includes('<div id="root">') &&
      api.ok &&
      apiPayload.status === "ok";

    return {
      ready,
      next: ready ? "" : "Run corepack pnpm run check:production after deployment",
    };
  } catch (error) {
    return {
      ready: false,
      next: `Run corepack pnpm run check:production; production smoke failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

const androidAabReady = exists("mobile/app/android/app/build/outputs/bundle/release/app-release.aab");
const releaseManifestCurrent = exists("docs/release-manifest.json") && nodeScriptPasses("scripts/write-release-manifest.mjs", ["--check"]);
const storeSubmissionPackCurrent = exists("docs/store-submission-pack.md") && nodeScriptPasses("scripts/write-store-submission-pack.mjs", ["--check"]);

add("Automated", "Launch readiness guide", exists("docs/launch-readiness.md"), "Restore docs/launch-readiness.md");
add("Automated", "Release handoff guide", exists("docs/release-handoff.md"), "Restore docs/release-handoff.md");
add("Automated", "Mobile preview guide", exists("docs/mobile-preview.md"), "Restore docs/mobile-preview.md");
add("Automated", "Production environment guide", exists("docs/production-env.md"), "Restore docs/production-env.md");
add(
  "Automated",
  "Android release APK",
  exists("mobile/app/android/app/build/outputs/apk/release/app-release.apk"),
  "Run corepack pnpm run build:android:release-apk",
);
add(
  "Automated",
  "Local Android AAB preflight",
  androidAabReady,
  "Run corepack pnpm run build:android:store-aab",
);
add("Automated", "iPhone store screenshots", exists("mobile/app/store/screenshots/iphone"), "Run corepack pnpm run capture:release:screenshots");
add("Automated", "Website release screenshots", exists("marketing/release-screenshots/web"), "Run corepack pnpm run capture:release:screenshots");
add("Automated", "Mobile store listing copy", exists("mobile/app/STORE_LISTING.md"), "Restore mobile/app/STORE_LISTING.md");
add("Automated", "Release artifact manifest", releaseManifestCurrent, "Run corepack pnpm run release:manifest");
add("Automated", "Store submission pack", storeSubmissionPackCurrent, "Run corepack pnpm run release:store-pack");
add("Automated", "Release signoff template", exists("docs/release-signoff.example.json"), "Restore docs/release-signoff.example.json");

const manifest = readJsonIfExists(absolute("docs/release-manifest.json"));
add(
  "Automated",
  "Release manifest tracks package, screenshot, and icon files",
  Array.isArray(manifest?.entries) && manifest.entries.length >= 21,
  "Run corepack pnpm run release:manifest",
);

const productionSmoke = await productionSmokeStatus();

const auth = productionAuthStatus();
const githubSecretHelperReady = auth.ready && exists("scripts/set-github-auth-secret.mjs");
const androidStoreReady = nodeScriptPasses("scripts/check-android-store.mjs");
const iosStoreReady = nodeScriptPasses("scripts/check-ios-store.mjs");

add("Production", "Public website and API smoke", productionSmoke.ready, productionSmoke.next);
add("Production", "Signed-in production auth state", auth.ready, auth.next);
add(
  "Production",
  "GitHub Actions auth secret ready to set",
  githubSecretHelperReady,
  auth.ready ? "Restore scripts/set-github-auth-secret.mjs" : auth.next,
);

add(
  "Store",
  "Android ready for Google Play production build",
  androidStoreReady,
  "Run corepack pnpm run check:android:store",
);
add(
  "Store",
  "iOS ready for EAS/App Store Connect production build",
  iosStoreReady,
  "Run corepack pnpm run check:ios:store",
);

const ready = items.filter((item) => item.ready);
const remaining = items.filter((item) => !item.ready);
const percent = Math.round((ready.length / items.length) * 100);
const groups = [...new Set(items.map((item) => item.group))];
const groupSummaries = Object.fromEntries(
  groups.map((group) => {
    const groupItems = items.filter((item) => item.group === group);
    const groupReady = groupItems.filter((item) => item.ready).length;
    return [
      group,
      {
        ready: groupReady,
        total: groupItems.length,
        percent: Math.round((groupReady / groupItems.length) * 100),
      },
    ];
  }),
);
const completionReport = {
  generatedAt: new Date().toISOString(),
  target: "ready-to-submit",
  note: "100% means the website and mobile app are ready to submit; app-store acceptance and post-submission signoff are tracked separately.",
  overall: {
    percent,
    ready: ready.length,
    total: items.length,
  },
  groups: groupSummaries,
  signoffFile: fs.existsSync(signoffPath) ? "docs/release-signoff.json" : null,
  ready: ready.map((item) => ({ group: item.group, label: item.label })),
  remaining: remaining.map((item) => ({ group: item.group, label: item.label, next: item.next })),
};

const completionSummary = [
  "# A.I. DO Ready-To-Submit Completion",
  "",
  "100% means the website and mobile app are ready to submit. App-store acceptance and post-submission signoff are tracked separately.",
  "",
  `Overall completion: **${percent}%** (${ready.length}/${items.length})`,
  "",
  "| Area | Ready | Total | Percent |",
  "| --- | ---: | ---: | ---: |",
  ...Object.entries(groupSummaries).map(
    ([group, summary]) =>
      `| ${escapeMarkdownTableCell(group)} | ${summary.ready} | ${summary.total} | ${summary.percent}% |`,
  ),
  "",
  "## Remaining",
  "",
  ...(remaining.length > 0
    ? remaining.map((item) => `- **${item.label}**: ${item.next}`)
    : ["- No remaining release items."]
  ),
  "",
].join("\n");

if (writeReport) {
  fs.mkdirSync(path.dirname(completionReportPath), { recursive: true });
  fs.writeFileSync(completionReportPath, `${JSON.stringify(completionReport, null, 2)}\n`);
}

if (writeSummary) {
  fs.mkdirSync(path.dirname(completionSummaryPath), { recursive: true });
  fs.writeFileSync(completionSummaryPath, `${completionSummary.trimEnd()}\n`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${completionSummary.trimEnd()}\n`);
  }
}

if (checkReport) {
  const currentReport = readJsonIfExists(completionReportPath);
  if (!currentReport || currentReport.__invalid) {
    console.error(
      currentReport?.__invalid
        ? `docs/release-completion-report.json is invalid: ${currentReport.__invalid}`
        : "docs/release-completion-report.json is missing.",
    );
    process.exit(1);
  }

  if (Number.isNaN(Date.parse(currentReport.generatedAt))) {
    console.error("docs/release-completion-report.json has an invalid generatedAt timestamp.");
    process.exit(1);
  }

  const expected = JSON.stringify(normalizeReportForCheck(completionReport), null, 2);
  const current = JSON.stringify(normalizeReportForCheck(currentReport), null, 2);
  if (current !== expected) {
    console.error("Completion report is stale. Run: corepack pnpm run release:completion-summary");
    process.exit(1);
  }
}

if (checkSummary) {
  checkFileCurrent(
    completionSummaryPath,
    `${completionSummary.trimEnd()}\n`,
    "Completion summary is stale. Run: corepack pnpm run release:completion-summary",
  );
}

console.log("A.I. DO Completion Dashboard");
console.log("============================");
console.log("Target: ready to submit; app-store acceptance is post-completion signoff.");
console.log(`Overall completion: ${percent}% (${ready.length}/${items.length})`);
console.log(`Post-submission signoff file: ${fs.existsSync(signoffPath) ? "docs/release-signoff.json" : "not created yet"}`);
if (!fs.existsSync(signoffPath)) {
  console.log(`Post-submission signoff template: ${path.relative(root, signoffExamplePath).replaceAll("\\", "/")}`);
  console.log("Create post-submission signoff file: corepack pnpm run release:signoff:init");
}
console.log("");

for (const group of groups) {
  const groupItems = items.filter((item) => item.group === group);
  const groupReady = groupItems.filter((item) => item.ready).length;
  console.log(`${group}: ${groupReady}/${groupItems.length}`);
}

if (ready.length > 0) {
  console.log("");
  console.log("Ready");
  for (const item of ready) {
    console.log(`- ${item.label}`);
  }
}

if (remaining.length > 0) {
  console.log("");
  console.log("Remaining");
  for (const item of remaining) {
    console.log(`- ${item.label}: ${item.next}`);
  }
}

if (writeReport) {
  console.log("");
  console.log("Report");
  console.log(`- docs/release-completion-report.json`);
}

if (writeSummary) {
  console.log("");
  console.log("Summary");
  console.log(`- docs/release-completion-summary.md`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    console.log("- GitHub Actions step summary updated");
  }
}

if (strict && remaining.length > 0) {
  process.exit(1);
}
