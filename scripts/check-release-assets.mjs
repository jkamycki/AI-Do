import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
let passed = 0;

const webScreenshots = [
  "01-home-desktop.png",
  "02-website-builder-desktop.png",
  "03-photo-qr-desktop.png",
  "04-vendors-desktop.png",
];

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

const storeListing = readText(rel("mobile", "app", "STORE_LISTING.md"));
const releaseNotes = readText(rel("docs", "release-notes.md"));
check(storeListing.includes("## Screenshot Checklist"), "store listing should include screenshot checklist");
check(storeListing.includes("capture:release:screenshots"), "store listing should include screenshot capture command");
check(storeListing.includes("capture:release:screenshots:local"), "store listing should include local screenshot capture command");
check(storeListing.includes("docs/release-notes.md"), "store listing should point to release notes");
check(releaseNotes.includes("## Website Launch Notes"), "release notes should include website launch notes");
check(releaseNotes.includes("## Android Release Notes"), "release notes should include Android release notes");
check(releaseNotes.includes("## iOS Release Notes"), "release notes should include iOS release notes");
check(releaseNotes.includes("## Support Response"), "release notes should include launch-week support response");

const manifest = readJson(rel("artifacts", "aido", "public", "site.webmanifest"));
check(manifest.name === "A.I DO Wedding Planner", "web manifest should use the production app name");
check(manifest.icons?.length >= 2, "web manifest should include app icons");

checkPng(rel("mobile", "app", "assets", "icon.png"), 1024, 1024, 50_000);
checkPng(rel("artifacts", "aido", "public", "web-app-icon-192.png"), 192, 192, 5_000);
checkPng(rel("artifacts", "aido", "public", "web-app-icon-512.png"), 512, 512, 20_000);

for (const file of webScreenshots) {
  checkPng(rel("marketing", "release-screenshots", "web", file), 1440, 1100, 30_000);
}

for (const file of iphoneScreenshots) {
  checkPng(rel("mobile", "app", "store", "screenshots", "iphone", file), 1290, 2796, 30_000);
}

if (failures.length > 0) {
  console.error(`Release assets failed with ${failures.length} issue(s):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Release assets passed (${passed} checks).`);
