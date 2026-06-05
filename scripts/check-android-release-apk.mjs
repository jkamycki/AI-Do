import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const apkPath = path.join(root, "mobile", "app", "android", "app", "build", "outputs", "apk", "release", "app-release.apk");
const metadataPath = path.join(root, "mobile", "app", "android", "app", "build", "outputs", "apk", "release", "output-metadata.json");
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

check(fs.existsSync(apkPath), "Android release APK should exist");
if (fs.existsSync(apkPath)) {
  const stats = fs.statSync(apkPath);
  check(stats.size > 20_000_000, "Android release APK should be larger than 20 MB");
  check(stats.mtimeMs > Date.now() - 14 * 24 * 60 * 60 * 1000, "Android release APK should be recent");
  check(stats.mtimeMs >= newestSourceMtimeMs(), "Android release APK should be newer than app metadata and icon assets");
}

check(fs.existsSync(metadataPath), "Android release APK metadata should exist");
if (fs.existsSync(metadataPath)) {
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  check(metadata.elements?.some((entry) => entry.outputFile === "app-release.apk"), "Android release metadata should reference app-release.apk");
}

if (failures.length > 0) {
  console.error(`Android release APK check failed with ${failures.length} issue(s):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error("Run: corepack pnpm run build:android:release-apk");
  process.exit(1);
}

console.log(`Android release APK passed (${passed} checks).`);
