import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const signoffPath = path.join(root, "docs", "release-signoff.json");
const templatePath = path.join(root, "docs", "release-signoff.example.json");
const force = process.argv.includes("--force");

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${path.relative(root, file)} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertBooleanFlags(signoff, label) {
  const requiredFlags = ["githubAuthSecretUpdated", "androidStoreSubmitted", "iosStoreSubmitted"];
  const missing = requiredFlags.filter((flag) => typeof signoff[flag] !== "boolean");

  if (missing.length > 0) {
    throw new Error(`${label} must include boolean flags: ${missing.join(", ")}`);
  }
}

if (!fs.existsSync(templatePath)) {
  throw new Error("docs/release-signoff.example.json is missing.");
}

const template = readJson(templatePath);
assertBooleanFlags(template, "docs/release-signoff.example.json");

if (fs.existsSync(signoffPath) && !force) {
  const signoff = readJson(signoffPath);
  assertBooleanFlags(signoff, "docs/release-signoff.json");
  console.log("Release signoff file already exists and is valid:");
  console.log("docs/release-signoff.json");
  console.log("");
  console.log("Update flags to true only after the matching account/store step is complete.");
  process.exit(0);
}

fs.mkdirSync(path.dirname(signoffPath), { recursive: true });
fs.writeFileSync(signoffPath, `${JSON.stringify(template, null, 2)}\n`);

console.log(`${force ? "Reset" : "Created"} release signoff file:`);
console.log("docs/release-signoff.json");
console.log("");
console.log("Keep flags false until each manual step is actually complete.");
console.log("Then run: corepack pnpm run check:complete:strict");
