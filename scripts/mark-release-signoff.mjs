import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const signoffPath = path.join(root, "docs", "release-signoff.json");
const templatePath = path.join(root, "docs", "release-signoff.example.json");
const dryRun = process.argv.includes("--dry-run");
const target = process.argv.find((arg) => !arg.startsWith("--") && arg !== process.argv[0] && arg !== process.argv[1]);

const targets = {
  github: {
    flag: "githubAuthSecretUpdated",
    label: "GitHub Actions auth secret",
    validate: validateProductionAuth,
  },
  android: {
    flag: "androidStoreSubmitted",
    label: "Android Google Play submission",
    validate: validateAndroidStoreEvidence,
  },
  ios: {
    flag: "iosStoreSubmitted",
    label: "iOS App Store submission",
    validate: validateIosStoreEvidence,
  },
};

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${path.relative(root, file)} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function ensureSignoff() {
  if (!fs.existsSync(signoffPath)) {
    if (!fs.existsSync(templatePath)) {
      throw new Error("docs/release-signoff.example.json is missing.");
    }
    writeJson(signoffPath, readJson(templatePath));
  }

  const signoff = readJson(signoffPath);
  for (const flag of ["githubAuthSecretUpdated", "androidStoreSubmitted", "iosStoreSubmitted"]) {
    if (typeof signoff[flag] !== "boolean") {
      throw new Error(`docs/release-signoff.json must include boolean flag: ${flag}`);
    }
  }

  return signoff;
}

function runNodeScript(scriptPath, args = []) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    encoding: "utf8",
    shell: false,
    stdio: "pipe",
  });

  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

function validateProductionAuth() {
  const authPath = path.join(root, ".auth", "user.json");
  if (!fs.existsSync(authPath)) {
    throw new Error("Production auth is missing. Run: corepack pnpm run auth:production:refresh");
  }

  const auth = readJson(authPath);
  const hasProductionAuth =
    auth.cookies?.some((cookie) => /(^|\.)aidowedding\.net$/i.test(cookie.domain ?? "")) ||
    auth.origins?.some((origin) => /^https:\/\/aidowedding\.net$/i.test(origin.origin ?? ""));

  if (!hasProductionAuth) {
    throw new Error("Production auth is not for aidowedding.net. Run: corepack pnpm run auth:production:refresh");
  }
}

function validateAndroidStoreEvidence() {
  for (const [script, args] of [
    ["scripts/check-android-store.mjs", []],
    ["scripts/write-release-manifest.mjs", ["--check"]],
    ["scripts/write-store-submission-pack.mjs", ["--check"]],
  ]) {
    const result = runNodeScript(script, args);
    if (!result.ok) {
      throw new Error(result.output || `${script} failed`);
    }
  }
}

function validateIosStoreEvidence() {
  for (const [script, args] of [
    ["scripts/check-ios-store.mjs", []],
    ["scripts/write-release-manifest.mjs", ["--check"]],
    ["scripts/write-store-submission-pack.mjs", ["--check"]],
  ]) {
    const result = runNodeScript(script, args);
    if (!result.ok) {
      throw new Error(result.output || `${script} failed`);
    }
  }
}

if (!target || !targets[target]) {
  console.error("Usage: corepack pnpm run release:signoff:mark -- <github|android|ios> [--dry-run]");
  process.exit(1);
}

try {
  const signoffTarget = targets[target];
  const signoff = ensureSignoff();
  signoffTarget.validate();

  if (!dryRun) {
    signoff[signoffTarget.flag] = true;
    writeJson(signoffPath, signoff);
  }

  console.log(`${dryRun ? "Validated" : "Marked"} ${signoffTarget.label}: ${signoffTarget.flag}`);
  if (!dryRun) {
    console.log("Next: corepack pnpm run check:complete");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
