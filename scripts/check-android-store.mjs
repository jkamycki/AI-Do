import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
let passed = 0;

const iphoneScreenshots = [
  "01-dashboard.png",
  "02-guests.png",
  "03-website-editor.png",
  "04-budget.png",
  "05-vendors.png",
  "06-aria.png",
];

function rel(...parts) {
  return path.join(...parts);
}

function absolute(file) {
  return path.join(root, file);
}

function readText(file) {
  return fs.readFileSync(absolute(file), "utf8");
}

function readJson(file) {
  return JSON.parse(readText(file));
}

function pngDimensions(file) {
  const buffer = fs.readFileSync(absolute(file));
  if (buffer.toString("ascii", 1, 4) !== "PNG") return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function check(condition, message) {
  if (condition) {
    passed += 1;
  } else {
    failures.push(message);
  }
}

function checkPng(file, expectedWidth, expectedHeight, minBytes) {
  const exists = fs.existsSync(absolute(file));
  check(exists, `${file} should exist`);
  if (!exists) return;

  const stats = fs.statSync(absolute(file));
  const dimensions = pngDimensions(file);
  check(dimensions?.width === expectedWidth, `${file} should be ${expectedWidth}px wide`);
  check(dimensions?.height === expectedHeight, `${file} should be ${expectedHeight}px tall`);
  check(stats.size >= minBytes, `${file} should not be blank or tiny`);
}

const mobilePackage = readJson(rel("mobile", "app", "package.json"));
const appJson = readJson(rel("mobile", "app", "app.json"));
const easJson = readJson(rel("mobile", "app", "eas.json"));
const buildGradle = readText(rel("mobile", "app", "android", "app", "build.gradle"));
const storeListing = readText(rel("mobile", "app", "STORE_LISTING.md"));
const releaseNotes = readText(rel("docs", "release-notes.md"));
const releaseHandoff = readText(rel("docs", "release-handoff.md"));
const launchReadiness = readText(rel("docs", "launch-readiness.md"));
const aabPath = rel("mobile", "app", "android", "app", "build", "outputs", "bundle", "release", "app-release.aab");
const packageSourceFiles = [
  rel("mobile", "app", "App.tsx"),
  rel("mobile", "app", "app.json"),
  rel("mobile", "app", "package.json"),
  rel("mobile", "app", "assets", "icon.png"),
  rel("mobile", "app", "assets", "android-icon-foreground.png"),
  rel("mobile", "app", "assets", "android-icon-background.png"),
  rel("mobile", "app", "assets", "android-icon-monochrome.png"),
];

function newestSourceMtimeMs() {
  return Math.max(...packageSourceFiles.filter((file) => fs.existsSync(absolute(file))).map((file) => fs.statSync(absolute(file)).mtimeMs));
}

check(appJson.expo?.name === "A.I DO", "Android app name should be A.I DO");
check(appJson.expo?.slug === "aido-wedding", "Expo slug should be stable for EAS builds");
check(appJson.expo?.scheme === "aidowedding", "Android deep-link scheme should be aidowedding");
check(appJson.expo?.version === "1.0.0", "Android marketing version should be set");
check(appJson.expo?.android?.package === "net.aidowedding.app", "Android package should be net.aidowedding.app");
check(appJson.expo?.android?.versionCode === 1, "Android versionCode should be set");
check(appJson.expo?.android?.adaptiveIcon?.foregroundImage === "./assets/android-icon-foreground.png", "Android adaptive icon foreground should be configured");
check(appJson.expo?.android?.adaptiveIcon?.backgroundImage === "./assets/android-icon-background.png", "Android adaptive icon background should be configured");
check(appJson.expo?.android?.adaptiveIcon?.monochromeImage === "./assets/android-icon-monochrome.png", "Android monochrome icon should be configured");
check(easJson.build?.production?.android?.buildType === "app-bundle", "EAS production Android build should create an app bundle");
check(easJson.build?.production?.autoIncrement === true, "EAS production builds should auto-increment");
check(easJson.submit?.production !== undefined, "EAS should define a production submit profile");
check(mobilePackage.scripts?.["build:android:store"] === "eas build --platform android --profile production", "mobile package should expose build:android:store");
check(
  /release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.debug/.test(buildGradle),
  "Local Gradle release signing should remain documented as debug-signed preflight until a production upload keystore is configured",
);
check(
  releaseHandoff.includes("Use the EAS production Android build artifact for Google Play upload"),
  "release handoff should identify EAS production Android as the Play upload path",
);
check(
  launchReadiness.includes("Local Android AAB preflight"),
  "launch readiness should label the local Android AAB as a preflight artifact",
);
check(storeListing.includes("## App Name"), "store listing should include app name");
check(storeListing.includes("## Short Description"), "store listing should include Google Play short description");
check(storeListing.includes("## Full Description"), "store listing should include Google Play full description");
check(storeListing.includes("## Category"), "store listing should include category");
check(storeListing.includes("Productivity"), "store listing category should be Productivity");
check(storeListing.includes("https://aidowedding.net/privacy"), "store listing should include privacy URL");
check(storeListing.includes("https://aidowedding.net/help/updates-improvements"), "store listing should include support URL");
check(storeListing.includes("docs/release-notes.md"), "store listing should point to release notes");
check(releaseNotes.includes("## Android Release Notes"), "release notes should include Android release notes");
check(releaseNotes.includes("Initial A.I. DO release"), "Android release notes should include initial release copy");

check(fs.existsSync(absolute(aabPath)), "Android store AAB should exist");
if (fs.existsSync(absolute(aabPath))) {
  const stats = fs.statSync(absolute(aabPath));
  check(stats.size > 20_000_000, "Android store AAB should be larger than 20 MB");
  check(stats.mtimeMs > Date.now() - 14 * 24 * 60 * 60 * 1000, "Android store AAB should be recent");
  check(stats.mtimeMs >= newestSourceMtimeMs(), "Android store AAB should be newer than app metadata and icon assets");
}

checkPng(rel("mobile", "app", "assets", "icon.png"), 1024, 1024, 50_000);
checkPng(rel("mobile", "app", "assets", "android-icon-foreground.png"), 1024, 1024, 20_000);
checkPng(rel("mobile", "app", "assets", "android-icon-background.png"), 1024, 1024, 5_000);
checkPng(rel("mobile", "app", "assets", "android-icon-monochrome.png"), 1024, 1024, 5_000);

for (const file of iphoneScreenshots) {
  checkPng(rel("mobile", "app", "store", "screenshots", "iphone", file), 1290, 2796, 30_000);
}

if (failures.length > 0) {
  console.error(`Android store readiness failed with ${failures.length} issue(s):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Android store readiness passed (${passed} checks).`);
console.log("Google Play upload path: corepack pnpm --dir mobile/app run build:android:store");
