import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const aabPath = path.join(root, "mobile", "app", "android", "app", "build", "outputs", "bundle", "release", "app-release.aab");
const packageSourceFiles = [
  path.join(root, "mobile", "app", "App.tsx"),
  path.join(root, "mobile", "app", "app.json"),
  path.join(root, "mobile", "app", "package.json"),
  path.join(root, "mobile", "app", "assets", "icon.png"),
  path.join(root, "mobile", "app", "assets", "android-icon-foreground.png"),
  path.join(root, "mobile", "app", "assets", "android-icon-background.png"),
  path.join(root, "mobile", "app", "assets", "android-icon-monochrome.png"),
];

const failures = [];
let passed = 0;

function check(condition, message) {
  if (condition) {
    passed += 1;
  } else {
    failures.push(message);
  }
}

function newestSourceMtimeMs() {
  return Math.max(...packageSourceFiles.filter((file) => fs.existsSync(file)).map((file) => fs.statSync(file).mtimeMs));
}

check(fs.existsSync(aabPath), "Android store AAB should exist");
if (fs.existsSync(aabPath)) {
  const stats = fs.statSync(aabPath);
  check(stats.size > 20_000_000, "Android store AAB should be larger than 20 MB");
  check(stats.mtimeMs > Date.now() - 14 * 24 * 60 * 60 * 1000, "Android store AAB should be recent");
  check(stats.mtimeMs >= newestSourceMtimeMs(), "Android store AAB should be newer than app metadata and icon assets");
}

if (failures.length > 0) {
  console.error(`Android store AAB check failed with ${failures.length} issue(s):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error("Run: corepack pnpm run build:android:store-aab");
  process.exit(1);
}

console.log(`Android store AAB passed (${passed} checks).`);
