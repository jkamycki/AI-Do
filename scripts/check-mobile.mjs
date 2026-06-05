import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const appDir = path.join(root, "mobile", "app");
const failures = [];
let passed = 0;

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function readJson(file) {
  return JSON.parse(readText(file));
}

function parseEnv(file) {
  const env = new Map();
  for (const line of readText(file).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsAt = trimmed.indexOf("=");
    if (equalsAt === -1) continue;
    env.set(trimmed.slice(0, equalsAt), trimmed.slice(equalsAt + 1));
  }
  return env;
}

function fileExists(file) {
  return fs.existsSync(path.join(root, file));
}

function pngDimensions(file) {
  const buffer = fs.readFileSync(path.join(root, file));
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

const mobilePackage = readJson(path.join("mobile", "app", "package.json"));
const appJson = readJson(path.join("mobile", "app", "app.json"));
const easJson = readJson(path.join("mobile", "app", "eas.json"));
const env = parseEnv(path.join("mobile", "app", ".env.example"));
const storeListing = readText(path.join("mobile", "app", "STORE_LISTING.md"));
const reactNativeConfig = readText(path.join("mobile", "app", "react-native.config.js"));
const appSource = readText(path.join("mobile", "app", "App.tsx"));
const icon = pngDimensions(path.join("mobile", "app", "assets", "icon.png"));
const splashIcon = pngDimensions(path.join("mobile", "app", "assets", "splash-icon.png"));

check(mobilePackage.scripts?.typecheck === "tsc --noEmit", "mobile app should expose a typecheck script");
check(mobilePackage.scripts?.web === "expo start --web", "mobile app should expose an Expo web script");
check(mobilePackage.scripts?.["web:preview"] === "expo start --web --port 19006", "mobile app should expose a fixed-port browser preview script");
check(mobilePackage.devDependencies?.["eas-cli"] === "20.0.0", "mobile app should pin eas-cli for reproducible EAS builds");
check(appJson.expo?.scheme === "aidowedding", "mobile app should use the aidowedding deep-link scheme");
check(appJson.expo?.ios?.bundleIdentifier === "net.aidowedding.app", "iOS bundle identifier should be net.aidowedding.app");
check(appJson.expo?.ios?.buildNumber === "1", "iOS build number should be set for store builds");
check(appJson.expo?.android?.package === "net.aidowedding.app", "Android package should be net.aidowedding.app");
check(appJson.expo?.android?.versionCode === 1, "Android versionCode should be set for store builds");
check(appJson.expo?.splash?.image === "./assets/splash-icon.png", "mobile app should declare a splash image");
check(appJson.expo?.splash?.backgroundColor === "#FFF7F2", "mobile splash should use the production background color");
check(icon?.width === 1024 && icon?.height === 1024, "mobile app icon should be 1024x1024 for store release");
check(splashIcon?.width === 512 && splashIcon?.height === 512, "mobile splash icon should be present and square");
check(fileExists(path.join("mobile", "app", "assets", "android-icon-foreground.png")), "Android adaptive foreground icon should exist");
check(fileExists(path.join("mobile", "app", "assets", "android-icon-background.png")), "Android adaptive background icon should exist");
check(fileExists(path.join("mobile", "app", "assets", "android-icon-monochrome.png")), "Android monochrome icon should exist");
check(reactNativeConfig.includes("@solana-mobile/mobile-wallet-adapter-protocol"), "mobile autolinking should exclude the unused Solana native protocol package");
check(reactNativeConfig.includes("android: null"), "mobile Solana autolinking exclusion should disable Android");
check(easJson.build?.production?.android?.buildType === "app-bundle", "EAS production Android build should create an app bundle");
check(easJson.build?.production?.ios?.simulator === false, "EAS production iOS build should target devices");
check(storeListing.includes("## App Name"), "store listing should include an app name");
check(storeListing.includes("## Short Description"), "store listing should include a short description");
check(storeListing.includes("## Full Description"), "store listing should include a full description");
check(storeListing.includes("https://aidowedding.net/privacy"), "store listing should include privacy URL");
check(storeListing.includes("## Screenshot Checklist"), "store listing should include screenshot checklist");
check(storeListing.includes("capture:release:screenshots"), "store listing should document the screenshot capture command");
check(storeListing.includes("capture:release:screenshots:local"), "store listing should document the local screenshot capture command");
check(storeListing.includes("https://aidowedding.net"), "store listing should document the production screenshot domain");
check(!appSource.includes("localhost:5174"), "mobile browser preview should not point sign-in at the stale localhost:5174 website URL");
check(appSource.includes("Use preview account"), "mobile browser preview should expose the local preview account sign-in button");
check(env.has("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY"), "mobile env should include Clerk publishable key");
check(env.get("EXPO_PUBLIC_AIDO_WEB_URL") === "https://aidowedding.net", "mobile env should point at the production website");
check(env.get("EXPO_PUBLIC_AIDO_API_URL") === "https://ai-do.onrender.com", "mobile env should point at the production API");
check(env.has("EXPO_PUBLIC_AIDO_AUTH_TOKEN"), "mobile env should document the optional auth token override");

if (failures.length === 0) {
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", "npm run typecheck"] : ["run", "typecheck"];
  const result = spawnSync(command, args, {
    cwd: appDir,
    stdio: "inherit",
    shell: false,
  });
  check(result.status === 0, "mobile TypeScript typecheck should pass");
}

if (failures.length > 0) {
  console.error(`Mobile readiness failed with ${failures.length} issue(s):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Mobile readiness passed (${passed} checks).`);
