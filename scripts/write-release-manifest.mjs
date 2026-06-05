import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const manifestPath = path.join(root, "docs", "release-manifest.json");
const checkOnly = process.argv.includes("--check");

const releaseFiles = [
  {
    category: "android",
    label: "Release APK",
    path: "mobile/app/android/app/build/outputs/apk/release/app-release.apk",
  },
  {
    category: "android",
    label: "Local Android AAB preflight",
    path: "mobile/app/android/app/build/outputs/bundle/release/app-release.aab",
  },
  {
    category: "store-copy",
    label: "Mobile store listing",
    path: "mobile/app/STORE_LISTING.md",
  },
  {
    category: "store-copy",
    label: "Release notes",
    path: "docs/release-notes.md",
  },
  {
    category: "app-icons",
    label: "Mobile app icon",
    path: "mobile/app/assets/icon.png",
  },
  {
    category: "app-icons",
    label: "Android adaptive foreground",
    path: "mobile/app/assets/android-icon-foreground.png",
  },
  {
    category: "app-icons",
    label: "Android adaptive background",
    path: "mobile/app/assets/android-icon-background.png",
  },
  {
    category: "app-icons",
    label: "Android adaptive monochrome",
    path: "mobile/app/assets/android-icon-monochrome.png",
  },
  {
    category: "app-icons",
    label: "Website PWA icon 192",
    path: "artifacts/aido/public/web-app-icon-192.png",
  },
  {
    category: "app-icons",
    label: "Website PWA icon 512",
    path: "artifacts/aido/public/web-app-icon-512.png",
  },
  {
    category: "app-icons",
    label: "Website manifest",
    path: "artifacts/aido/public/site.webmanifest",
  },
  ...["01-dashboard.png", "02-guests.png", "03-website-editor.png", "04-budget.png", "05-vendors.png", "06-aria.png"].map(
    (file) => ({
      category: "ios-screenshots",
      label: file,
      path: `mobile/app/store/screenshots/iphone/${file}`,
    }),
  ),
  ...["01-home-desktop.png", "02-website-builder-desktop.png", "03-photo-qr-desktop.png", "04-vendors-desktop.png"].map(
    (file) => ({
      category: "website-screenshots",
      label: file,
      path: `marketing/release-screenshots/web/${file}`,
    }),
  ),
];

function absolute(file) {
  return path.join(root, file);
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(absolute(file))).digest("hex");
}

function fileEntry(item) {
  if (!fs.existsSync(absolute(item.path))) {
    throw new Error(`Release manifest file is missing: ${item.path}`);
  }

  const stats = fs.statSync(absolute(item.path));
  return {
    category: item.category,
    label: item.label,
    path: item.path.replaceAll("\\", "/"),
    bytes: stats.size,
    sha256: sha256(item.path),
  };
}

const manifest = {
  name: "A.I. DO release manifest",
  canonicalWebsite: "https://aidowedding.net",
  productionApi: "https://ai-do.onrender.com",
  entries: releaseFiles.map(fileEntry),
};

const next = `${JSON.stringify(manifest, null, 2)}\n`;

if (checkOnly) {
  if (!fs.existsSync(manifestPath)) {
    console.error("Release manifest is missing. Run: corepack pnpm run release:manifest");
    process.exit(1);
  }

  const current = fs.readFileSync(manifestPath, "utf8");
  if (current !== next) {
    console.error("Release manifest is stale. Run: corepack pnpm run release:manifest");
    process.exit(1);
  }

  console.log(`Release manifest is current (${manifest.entries.length} files).`);
} else {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, next);
  console.log(`Wrote docs/release-manifest.json (${manifest.entries.length} files).`);
}
