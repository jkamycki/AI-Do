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
const storeListing = readText(rel("mobile", "app", "STORE_LISTING.md"));

check(appJson.expo?.name === "A.I DO", "iOS app name should be A.I DO");
check(appJson.expo?.slug === "aido-wedding", "Expo slug should be stable for EAS builds");
check(appJson.expo?.scheme === "aidowedding", "iOS deep-link scheme should be aidowedding");
check(appJson.expo?.version === "1.0.0", "iOS marketing version should be set");
check(appJson.expo?.ios?.bundleIdentifier === "net.aidowedding.app", "iOS bundle identifier should be net.aidowedding.app");
check(appJson.expo?.ios?.buildNumber === "1", "iOS build number should be set");
check(appJson.expo?.ios?.supportsTablet === true, "iOS should declare tablet support");
check(appJson.expo?.icon === "./assets/icon.png", "iOS should use the production app icon");
check(appJson.expo?.splash?.image === "./assets/splash-icon.png", "iOS splash image should be configured");
check(easJson.cli?.appVersionSource === "remote", "EAS should use remote app versioning");
check(easJson.build?.production?.autoIncrement === true, "EAS production builds should auto-increment");
check(easJson.build?.production?.ios?.simulator === false, "EAS production iOS build should target real devices");
check(easJson.submit?.production !== undefined, "EAS should define a production submit profile");
check(mobilePackage.devDependencies?.["eas-cli"] === "20.0.0", "mobile package should pin eas-cli for iOS builds");
check(mobilePackage.scripts?.["build:ios"] === "eas build --platform ios --profile production", "mobile package should expose build:ios");
check(mobilePackage.scripts?.["build:all"] === "eas build --platform all --profile production", "mobile package should expose build:all");
check(storeListing.includes("## App Name"), "store listing should include app name");
check(storeListing.includes("## Subtitle"), "store listing should include App Store subtitle");
check(storeListing.includes("## Keywords"), "store listing should include App Store keywords");
check(storeListing.includes("https://aidowedding.net/privacy"), "store listing should include privacy URL");
check(storeListing.includes("https://aidowedding.net/help/updates-improvements"), "store listing should include support URL");

checkPng(rel("mobile", "app", "assets", "icon.png"), 1024, 1024, 50_000);

for (const file of iphoneScreenshots) {
  checkPng(rel("mobile", "app", "store", "screenshots", "iphone", file), 1290, 2796, 30_000);
}

if (failures.length > 0) {
  console.error(`iOS store readiness failed with ${failures.length} issue(s):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`iOS store readiness passed (${passed} checks).`);
