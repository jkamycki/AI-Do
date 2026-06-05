import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const manifestPath = path.join(root, "docs", "release-manifest.json");
const packPath = path.join(root, "docs", "store-submission-pack.md");
const checkOnly = process.argv.includes("--check");

const categoryTitles = new Map([
  ["android", "Android Uploads"],
  ["ios-screenshots", "iOS Screenshots"],
  ["store-copy", "Store Copy"],
  ["app-icons", "App And Web Icons"],
  ["website-screenshots", "Website Launch Screenshots"],
]);

const categoryOrder = ["android", "ios-screenshots", "store-copy", "app-icons", "website-screenshots"];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeMarkdown(value) {
  return String(value).replaceAll("|", "\\|");
}

if (!fs.existsSync(manifestPath)) {
  console.error("Release manifest is missing. Run: corepack pnpm run release:manifest");
  process.exit(1);
}

const manifest = readJson(manifestPath);
const entries = Array.isArray(manifest.entries) ? manifest.entries : [];

const lines = [
  "# A.I. DO Store Submission Pack",
  "",
  "Generated from `docs/release-manifest.json`.",
  "",
  "## Final Checks",
  "",
  "- Run `corepack pnpm run check:store` before uploading store assets.",
  "- Run `corepack pnpm run check:launch:auth` after production auth is refreshed.",
  "- Run `corepack pnpm run check:complete:strict` to confirm the release is ready to submit.",
  "",
  "## Destinations",
  "",
  `- Canonical website: ${manifest.canonicalWebsite}`,
  `- Production API: ${manifest.productionApi}`,
  "- Google Play production build: `corepack pnpm --dir mobile/app run build:android:store`",
  "- Local Android AAB preflight: `mobile/app/android/app/build/outputs/bundle/release/app-release.aab`",
  "- iOS build command: `corepack pnpm --dir mobile/app run build:ios`",
  "",
  "## Artifact Sources",
  "",
  "- The GitHub `release-collateral` artifact contains docs, store copy, screenshots, and icons.",
  "- Android APK/AAB files are local build outputs for install and packaging preflight.",
  "- Use the EAS production Android build artifact for Google Play upload. Do not upload the local Gradle AAB unless it was signed with the production upload key.",
  "",
  "## Post-Submission Signoff",
  "",
  "- These signoffs are for handoff tracking after the ready-to-submit completion score reaches 100%.",
  "- After the production auth GitHub secret is updated, run `corepack pnpm run release:signoff:mark -- github`.",
  "- After Google Play accepts the Android upload, run `corepack pnpm run release:signoff:mark -- android`.",
  "- After App Store Connect submission is complete, run `corepack pnpm run release:signoff:mark -- ios`.",
  "- Add `--dry-run` to any signoff command to validate evidence without changing `docs/release-signoff.json`.",
  "",
  "## Artifacts",
  "",
];

for (const category of categoryOrder) {
  const categoryEntries = entries.filter((entry) => entry.category === category);
  if (categoryEntries.length === 0) continue;

  lines.push(`### ${categoryTitles.get(category) ?? category}`, "");
  lines.push("| Label | Path | Size | SHA-256 |");
  lines.push("| --- | --- | ---: | --- |");

  for (const entry of categoryEntries) {
    lines.push(
      `| ${escapeMarkdown(entry.label)} | \`${escapeMarkdown(entry.path)}\` | ${formatBytes(entry.bytes)} | \`${entry.sha256}\` |`,
    );
  }

  lines.push("");
}

const next = `${lines.join("\n").trimEnd()}\n`;

if (checkOnly) {
  if (!fs.existsSync(packPath)) {
    console.error("Store submission pack is missing. Run: corepack pnpm run release:store-pack");
    process.exit(1);
  }

  const current = fs.readFileSync(packPath, "utf8");
  if (current !== next) {
    console.error("Store submission pack is stale. Run: corepack pnpm run release:store-pack");
    process.exit(1);
  }

  console.log("Store submission pack is current.");
} else {
  fs.writeFileSync(packPath, next);
  console.log("Wrote docs/store-submission-pack.md");
}
