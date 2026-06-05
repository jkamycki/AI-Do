import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const canonicalOrigin = "https://aidowedding.net";
const renderApiOrigin = "https://ai-do.onrender.com";

const failures = [];
let passed = 0;

function rel(...parts) {
  return path.join(...parts);
}

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

function checkFileExists(file) {
  check(fs.existsSync(path.join(root, file)), `${file} is missing`);
}

function findRewrite(vercelConfig, source) {
  return vercelConfig.rewrites?.find((rewrite) => rewrite.source === source);
}

function checkVercelConfig(file) {
  const config = readJson(file);
  check(config.buildCommand === "pnpm run build", `${file} should run the root build command`);
  check(config.outputDirectory === "dist", `${file} should publish the root dist directory`);
  check(
    findRewrite(config, "/api/(.*)")?.destination === `${renderApiOrigin}/api/$1`,
    `${file} should proxy /api/* to the Render API`,
  );
  check(
    findRewrite(config, "/(.*)")?.destination === "/index.html",
    `${file} should have an SPA fallback rewrite`,
  );
  check(
    config.headers?.some((entry) =>
      entry.headers?.some((header) => header.key === "X-Content-Type-Options" && header.value === "nosniff"),
    ),
    `${file} should include baseline security headers`,
  );
}

function renderEnvValue(renderYaml, key) {
  const match = renderYaml.match(new RegExp(`- key: ${key}\\s+value: ([^\\r\\n]+)`));
  return match?.[1]?.trim();
}

checkFileExists(rel("scripts", "build-aido.mjs"));
checkFileExists(rel("scripts", "check-launch-status.mjs"));
checkFileExists(rel("scripts", "check-android-store.mjs"));
checkFileExists(rel("scripts", "check-account-access.mjs"));
checkFileExists(rel("scripts", "doctor-mobile-preview.mjs"));
checkFileExists(rel("scripts", "doctor-production-auth.mjs"));
checkFileExists(rel("scripts", "doctor-release.mjs"));
checkFileExists(rel("scripts", "set-github-auth-secret.mjs"));
checkFileExists(rel("scripts", "write-release-manifest.mjs"));
checkFileExists(rel(".github", "workflows", "readiness.yml"));
checkFileExists(rel(".github", "workflows", "e2e.yml"));
checkFileExists(rel("docs", "launch-readiness.md"));
checkFileExists(rel("docs", "mobile-preview.md"));
checkFileExists(rel("docs", "production-env.md"));
checkFileExists(rel("docs", "release-handoff.md"));
checkFileExists(rel("docs", "release-completion-report.json"));
checkFileExists(rel("docs", "release-completion-summary.md"));
checkFileExists(rel("docs", "release-manifest.json"));
checkFileExists(rel("docs", "release-notes.md"));
checkFileExists(rel("vercel.json"));
checkFileExists(rel("artifacts", "aido", "vercel.json"));
checkFileExists(rel("render.yaml"));
checkFileExists(rel("artifacts", "aido", ".env.example"));
checkFileExists(rel("artifacts", "api-server", ".env.example"));
checkFileExists(rel("mobile", "app", ".env.example"));
checkFileExists(rel("mobile", "app", "app.json"));
checkFileExists(rel("mobile", "app", "react-native.config.js"));
checkFileExists(rel("mobile", "app", "assets", "icon.png"));
checkFileExists(rel("mobile", "app", "assets", "splash-icon.png"));
checkFileExists(rel("mobile", "app", "STORE_LISTING.md"));
checkFileExists(rel("artifacts", "aido", "public", "site.webmanifest"));
checkFileExists(rel("artifacts", "aido", "public", "web-app-icon-192.png"));
checkFileExists(rel("artifacts", "aido", "public", "web-app-icon-512.png"));
checkFileExists(rel("docs", "release-signoff.example.json"));
checkFileExists(rel("scripts", "check-release-completion.mjs"));
checkFileExists(rel("scripts", "initialize-release-signoff.mjs"));
checkFileExists(rel("scripts", "mark-release-signoff.mjs"));
checkFileExists(rel("scripts", "doctor-release.mjs"));
checkFileExists(rel("scripts", "write-store-submission-pack.mjs"));

const pkg = readJson(rel("package.json"));
check(pkg.scripts?.build === "node scripts/build-aido.mjs", "package.json build should use scripts/build-aido.mjs");
check(pkg.scripts?.["build:android:release-apk"] === "node scripts/build-android-release-apk.mjs", "package.json should expose build:android:release-apk");
check(pkg.scripts?.["build:android:store-aab"] === "node scripts/build-android-store-aab.mjs", "package.json should expose build:android:store-aab");
check(pkg.scripts?.["auth:production:refresh"] === "node scripts/refresh-production-auth.mjs", "package.json should expose auth:production:refresh");
check(pkg.scripts?.["auth:production:print-secret"] === "node scripts/print-production-auth-secret.mjs", "package.json should expose auth:production:print-secret");
check(
  pkg.scripts?.["auth:production:set-github-secret"] === "node scripts/set-github-auth-secret.mjs",
  "package.json should expose auth:production:set-github-secret",
);
check(pkg.scripts?.["capture:release:screenshots"] === "node scripts/capture-release-screenshots.mjs", "package.json should expose capture:release:screenshots");
check(pkg.scripts?.["capture:release:screenshots:local"] === "node scripts/capture-release-screenshots.mjs --local", "package.json should expose capture:release:screenshots:local");
check(pkg.scripts?.["doctor:accounts"] === "node scripts/check-account-access.mjs", "package.json should expose doctor:accounts");
check(pkg.scripts?.["doctor:mobile:preview"] === "node scripts/doctor-mobile-preview.mjs", "package.json should expose doctor:mobile:preview");
check(pkg.scripts?.["doctor:production:auth"] === "node scripts/doctor-production-auth.mjs", "package.json should expose doctor:production:auth");
check(pkg.scripts?.["doctor:release"] === "node scripts/doctor-release.mjs", "package.json should expose doctor:release");
check(pkg.scripts?.["release:manifest"] === "node scripts/write-release-manifest.mjs", "package.json should expose release:manifest");
check(pkg.scripts?.["release:store-pack"] === "node scripts/write-store-submission-pack.mjs", "package.json should expose release:store-pack");
check(pkg.scripts?.["release:completion-report"] === "node scripts/check-release-completion.mjs --write-report", "package.json should expose release:completion-report");
check(
  pkg.scripts?.["release:completion-summary"] === "node scripts/check-release-completion.mjs --write-report --write-summary",
  "package.json should expose release:completion-summary",
);
check(pkg.scripts?.["release:signoff:init"] === "node scripts/initialize-release-signoff.mjs", "package.json should expose release:signoff:init");
check(pkg.scripts?.["release:signoff:mark"] === "node scripts/mark-release-signoff.mjs", "package.json should expose release:signoff:mark");
check(pkg.scripts?.["release:signoff:reset"] === "node scripts/initialize-release-signoff.mjs --force", "package.json should expose release:signoff:reset");
check(pkg.scripts?.["check:api"] === "corepack pnpm --filter @workspace/api-server run build", "package.json should expose check:api");
check(pkg.scripts?.["check:android:release-apk"] === "node scripts/check-android-release-apk.mjs", "package.json should expose check:android:release-apk");
check(pkg.scripts?.["check:android:store"] === "node scripts/check-android-store.mjs", "package.json should expose check:android:store");
check(pkg.scripts?.["check:android:store-aab"] === "node scripts/check-android-store-aab.mjs", "package.json should expose check:android:store-aab");
check(pkg.scripts?.["check:accounts"] === "node scripts/check-account-access.mjs", "package.json should expose check:accounts");
check(
  pkg.scripts?.["check:all"] ===
    "corepack pnpm run typecheck && corepack pnpm run build && corepack pnpm run check:api && corepack pnpm run check:deploy && corepack pnpm run check:completion-artifacts && corepack pnpm run check:mobile && corepack pnpm run check:release-assets",
  "package.json should expose check:all",
);
check(
  pkg.scripts?.["check:completion-artifacts"] === "node scripts/check-release-completion.mjs --check-report --check-summary",
  "package.json should expose check:completion-artifacts",
);
check(pkg.scripts?.["check:deploy"] === "node scripts/check-deploy-readiness.mjs", "package.json should expose check:deploy");
check(pkg.scripts?.["check:ios:store"] === "node scripts/check-ios-store.mjs", "package.json should expose check:ios:store");
check(
  pkg.scripts?.["check:launch"] === "corepack pnpm run check:all && corepack pnpm run check:mobile:preview && corepack pnpm run check:parity && corepack pnpm run check:store && corepack pnpm run check:production",
  "package.json should expose check:launch",
);
check(
  pkg.scripts?.["check:launch:auth"] === "corepack pnpm run check:launch && corepack pnpm run check:production:auth",
  "package.json should expose check:launch:auth",
);
check(pkg.scripts?.["check:launch:status"] === "node scripts/check-launch-status.mjs", "package.json should expose check:launch:status");
check(pkg.scripts?.["check:complete"] === "node scripts/check-release-completion.mjs", "package.json should expose check:complete");
check(pkg.scripts?.["check:complete:strict"] === "node scripts/check-release-completion.mjs --strict", "package.json should expose check:complete:strict");
check(pkg.scripts?.["check:mobile"] === "node scripts/check-mobile.mjs", "package.json should expose check:mobile");
check(pkg.scripts?.["check:mobile:preview"] === "node scripts/check-mobile-web-preview.mjs", "package.json should expose check:mobile:preview");
check(pkg.scripts?.["check:parity"] === "node scripts/check-parity-local.mjs", "package.json should expose check:parity");
check(pkg.scripts?.["check:production"] === "node scripts/check-production.mjs", "package.json should expose check:production");
check(pkg.scripts?.["check:production:auth"] === "node scripts/check-production-auth.mjs", "package.json should expose check:production:auth");
check(pkg.scripts?.["check:release-manifest"] === "node scripts/write-release-manifest.mjs --check", "package.json should expose check:release-manifest");
check(pkg.scripts?.["check:store-pack"] === "node scripts/write-store-submission-pack.mjs --check", "package.json should expose check:store-pack");
check(
  pkg.scripts?.["check:production:all"] === "corepack pnpm run check:production && corepack pnpm run check:production:auth",
  "package.json should expose check:production:all",
);
check(pkg.scripts?.["check:release-assets"] === "node scripts/check-release-assets.mjs", "package.json should expose check:release-assets");
check(
  pkg.scripts?.["check:store"] === "corepack pnpm run check:android:release-apk && corepack pnpm run check:android:store && corepack pnpm run check:ios:store && corepack pnpm run check:release-assets && corepack pnpm run check:release-manifest && corepack pnpm run check:store-pack",
  "package.json should expose check:store",
);
check(pkg.scripts?.["preview:mobile:web"] === "corepack pnpm --dir mobile/app run web:preview", "package.json should expose preview:mobile:web");

checkVercelConfig(rel("vercel.json"));
checkVercelConfig(rel("artifacts", "aido", "vercel.json"));

const frontendEnv = parseEnv(rel("artifacts", "aido", ".env.example"));
check(frontendEnv.get("VITE_API_URL") === renderApiOrigin, "frontend env should point VITE_API_URL at Render");
check(frontendEnv.has("VITE_CLERK_PUBLISHABLE_KEY"), "frontend env should include VITE_CLERK_PUBLISHABLE_KEY");
check(frontendEnv.has("VITE_CLERK_PROXY_URL"), "frontend env should include VITE_CLERK_PROXY_URL");

const backendEnv = parseEnv(rel("artifacts", "api-server", ".env.example"));
for (const key of [
  "PORT",
  "NODE_ENV",
  "FRONTEND_URL",
  "CLERK_SECRET_KEY",
  "CLERK_PUBLISHABLE_KEY",
  "CLERK_WEBHOOK_SECRET",
  "DATABASE_URL",
  "OPENAI_API_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "RESEND_WEBHOOK_SECRET",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "PUBLIC_APP_URL",
  "CLOUDFLARE_INBOUND_SECRET",
]) {
  check(backendEnv.has(key), `backend env should include ${key}`);
}
check(backendEnv.get("FRONTEND_URL") === canonicalOrigin, "backend FRONTEND_URL should use the canonical domain");
check(backendEnv.get("PUBLIC_APP_URL") === canonicalOrigin, "backend PUBLIC_APP_URL should use the canonical domain");

const renderYaml = readText(rel("render.yaml"));
check(renderYaml.includes("healthCheckPath: /api/healthz"), "Render should health-check /api/healthz");
check(renderYaml.includes("pnpm --filter @workspace/api-server run build"), "Render should build the API server package");
check(renderYaml.includes("pnpm --filter @workspace/api-server run start"), "Render should start the API server package");
check(renderEnvValue(renderYaml, "FRONTEND_URL") === canonicalOrigin, "Render FRONTEND_URL should use the canonical domain");
check(renderEnvValue(renderYaml, "PUBLIC_APP_URL") === canonicalOrigin, "Render PUBLIC_APP_URL should use the canonical domain");

const readinessWorkflow = readText(rel(".github", "workflows", "readiness.yml"));
const e2eWorkflow = readText(rel(".github", "workflows", "e2e.yml"));
check(readinessWorkflow.includes("name: Readiness"), "Readiness workflow should be named");
check(readinessWorkflow.includes("pull_request:"), "Readiness workflow should run on pull requests");
check(readinessWorkflow.includes("pnpm/action-setup@v4"), "Readiness workflow should set up pnpm");
check(readinessWorkflow.includes("actions/setup-node@v4"), "Readiness workflow should set up Node");
check(readinessWorkflow.includes("pnpm install --frozen-lockfile"), "Readiness workflow should install frozen dependencies");
check(readinessWorkflow.includes("pnpm run check:launch:status"), "Readiness workflow should print launch status");
check(readinessWorkflow.includes("pnpm run check:complete"), "Readiness workflow should print the completion dashboard");
check(readinessWorkflow.includes("pnpm run release:completion-summary"), "Readiness workflow should write the completion report and summary");
check(readinessWorkflow.includes("pnpm run check:all"), "Readiness workflow should run check:all");
check(readinessWorkflow.includes("pnpm exec playwright install --with-deps chromium"), "Readiness workflow should install Chromium");
check(readinessWorkflow.includes("pnpm run check:mobile:preview"), "Readiness workflow should run the mobile app browser preview smoke");
check(readinessWorkflow.includes("pnpm run check:parity"), "Readiness workflow should run website/app parity");
check(readinessWorkflow.includes("release-collateral"), "Readiness workflow should upload release collateral");
check(readinessWorkflow.includes("docs/store-submission-pack.md"), "Readiness workflow should upload the store submission pack");
check(readinessWorkflow.includes("docs/release-manifest.json"), "Readiness workflow should upload the release manifest");
check(readinessWorkflow.includes("docs/release-completion-report.json"), "Readiness workflow should upload the completion report");
check(readinessWorkflow.includes("docs/release-completion-summary.md"), "Readiness workflow should upload the completion summary");
check(readinessWorkflow.includes("mobile/app/store/screenshots/iphone/"), "Readiness workflow should upload iPhone store screenshots");
check(readinessWorkflow.includes("marketing/release-screenshots/web/"), "Readiness workflow should upload website release screenshots");
check(readinessWorkflow.includes("readiness-playwright-report"), "Readiness workflow should upload Playwright reports");
check(e2eWorkflow.includes("AIDO_BASE_URL: https://aidowedding.net"), "E2E workflow should target the production site");
check(e2eWorkflow.includes("AIDO_AUTH_STATE_BASE64"), "E2E workflow should use the production auth secret");
check(e2eWorkflow.includes("base64 --decode > .auth/user.json"), "E2E workflow should restore Playwright auth state");
check(e2eWorkflow.includes("pnpm run doctor:production:auth"), "E2E workflow should verify decoded production auth state");
check(e2eWorkflow.includes("pnpm run check:production"), "E2E workflow should run public production smoke before signed-in tests");
check(e2eWorkflow.includes("pnpm run test:e2e:ci"), "E2E workflow should run non-mutating workflow tests by default");

const launchReadiness = readText(rel("docs", "launch-readiness.md"));
const mobilePreview = readText(rel("docs", "mobile-preview.md"));
const productionEnv = readText(rel("docs", "production-env.md"));
const releaseHandoff = readText(rel("docs", "release-handoff.md"));
const releaseManifest = readJson(rel("docs", "release-manifest.json"));
const releaseNotes = readText(rel("docs", "release-notes.md"));
const storeSubmissionPack = readText(rel("docs", "store-submission-pack.md"));
const releaseDoctor = readText(rel("scripts", "doctor-release.mjs"));
const accountAccess = readText(rel("scripts", "check-account-access.mjs"));
const launchStatus = readText(rel("scripts", "check-launch-status.mjs"));
const releaseCompletion = readText(rel("scripts", "check-release-completion.mjs"));
const signoffInitializer = readText(rel("scripts", "initialize-release-signoff.mjs"));
const signoffMarker = readText(rel("scripts", "mark-release-signoff.mjs"));
const githubSecretSetter = readText(rel("scripts", "set-github-auth-secret.mjs"));
const storePackWriter = readText(rel("scripts", "write-store-submission-pack.mjs"));
check(releaseDoctor.includes("check:complete"), "Release doctor should include the completion dashboard");
check(releaseDoctor.includes("Completion Dashboard"), "Release doctor should label the completion dashboard section");
check(releaseDoctor.includes("check-account-access.mjs"), "Release doctor should include account access checks");
check(accountAccess.includes("gh"), "Account access check should inspect GitHub CLI");
check(accountAccess.includes("eas"), "Account access check should inspect EAS CLI");
check(accountAccess.includes("A.I. DO Account Access"), "Account access check should print a clear heading");
check(accountAccess.includes("auth:production:set-github-secret"), "Account access check should point to the GitHub secret helper");
check(accountAccess.includes("build:android:store"), "Account access check should point to the Android EAS production build");
check(accountAccess.includes("build:ios"), "Account access check should point to the iOS EAS production build");
check(accountAccess.includes("aidowedding.net"), "Account access check should validate production auth domain");
check(launchStatus.includes("Store submission pack"), "Launch status should include the store submission pack");
check(launchStatus.includes("write-release-manifest.mjs"), "Launch status should verify the release manifest is current");
check(launchStatus.includes("write-store-submission-pack.mjs"), "Launch status should verify the store submission pack is current");
check(launchStatus.includes("Completion report and summary"), "Launch status should include completion report and summary freshness");
check(launchStatus.includes("check-release-completion.mjs"), "Launch status should verify completion report and summary freshness");
check(launchStatus.includes("release:completion-summary"), "Launch status should point to the completion summary generator");
check(releaseCompletion.includes("--write-report"), "Completion dashboard should support writing a JSON report");
check(releaseCompletion.includes("--write-summary"), "Completion dashboard should support writing a Markdown summary");
check(releaseCompletion.includes("--check-report"), "Completion dashboard should support checking the JSON report");
check(releaseCompletion.includes("--check-summary"), "Completion dashboard should support checking the Markdown summary");
check(releaseCompletion.includes("docs/release-completion-report.json"), "Completion dashboard should write the release completion report");
check(releaseCompletion.includes("docs/release-completion-summary.md"), "Completion dashboard should write the release completion summary");
check(releaseCompletion.includes("ready-to-submit"), "Completion dashboard should label the ready-to-submit target");
check(releaseCompletion.includes("app-store acceptance is post-completion"), "Completion dashboard should separate store acceptance from completion percent");
check(releaseCompletion.includes("GITHUB_STEP_SUMMARY"), "Completion dashboard should append the GitHub Actions step summary");
check(releaseCompletion.includes("Completion report is stale"), "Completion dashboard should fail stale report checks");
check(releaseCompletion.includes("Completion summary is stale"), "Completion dashboard should fail stale summary checks");
check(releaseCompletion.includes("generatedAt"), "Completion report should include a generated timestamp");
check(releaseCompletion.includes("remaining: remaining.map"), "Completion report should include remaining work");
check(releaseCompletion.includes("Store submission pack"), "Completion dashboard should include the store submission pack");
check(releaseCompletion.includes("releaseManifestCurrent"), "Completion dashboard should track release manifest freshness");
check(releaseCompletion.includes("storeSubmissionPackCurrent"), "Completion dashboard should track store pack freshness");
check(releaseCompletion.includes("GitHub Actions auth secret ready to set"), "Completion dashboard should count GitHub secret readiness instead of secret update signoff");
check(releaseCompletion.includes("Android ready for Google Play production build"), "Completion dashboard should count Android ready-to-submit evidence");
check(releaseCompletion.includes("iOS ready for EAS/App Store Connect production build"), "Completion dashboard should count iOS ready-to-submit evidence");
check(releaseCompletion.includes("check-android-store.mjs"), "Completion dashboard should verify Android store readiness");
check(releaseCompletion.includes("check-ios-store.mjs"), "Completion dashboard should verify iOS store readiness");
check(signoffInitializer.includes("githubAuthSecretUpdated"), "Signoff initializer should validate the GitHub secret flag");
check(signoffInitializer.includes("androidStoreSubmitted"), "Signoff initializer should validate the Android submission flag");
check(signoffInitializer.includes("iosStoreSubmitted"), "Signoff initializer should validate the iOS submission flag");
check(signoffMarker.includes("--dry-run"), "Signoff marker should support dry-run validation");
check(signoffMarker.includes("validateProductionAuth"), "Signoff marker should validate production auth before GitHub signoff");
check(signoffMarker.includes("check-android-store.mjs"), "Signoff marker should validate Android store evidence");
check(signoffMarker.includes("check-ios-store.mjs"), "Signoff marker should validate iOS store evidence");
check(signoffMarker.includes("write-store-submission-pack.mjs"), "Signoff marker should validate store pack freshness");
check(githubSecretSetter.includes("AIDO_AUTH_STATE_BASE64"), "GitHub secret setter should update the production auth secret");
check(githubSecretSetter.includes("gh"), "GitHub secret setter should use GitHub CLI");
check(githubSecretSetter.includes("stdio: [\"pipe\", \"pipe\", \"pipe\"]"), "GitHub secret setter should pass the secret through stdin");
check(storePackWriter.includes("docs/release-manifest.json"), "Store pack writer should read the release manifest");
check(storePackWriter.includes("docs/store-submission-pack.md"), "Store pack writer should write the store submission pack");
check(storePackWriter.includes("release-collateral"), "Store pack writer should explain GitHub release collateral contents");
check(storePackWriter.includes("Android APK/AAB files are local build outputs"), "Store pack writer should explain Android build output handling");
check(storePackWriter.includes("corepack pnpm run release:signoff:mark -- github"), "Store pack writer should include the GitHub signoff marker command");
check(storePackWriter.includes("corepack pnpm run release:signoff:mark -- android"), "Store pack writer should include the Android signoff marker command");
check(storePackWriter.includes("corepack pnpm run release:signoff:mark -- ios"), "Store pack writer should include the iOS signoff marker command");
check(storePackWriter.includes("--dry-run"), "Store pack writer should document signoff dry-runs");
check(launchReadiness.includes("docs/release-handoff.md"), "Launch readiness should point to the release handoff");
check(launchReadiness.includes("docs/mobile-preview.md"), "Launch readiness should point to the mobile preview guide");
check(launchReadiness.includes("corepack pnpm run doctor:release"), "Launch readiness should include the release doctor command");
check(launchReadiness.includes("corepack pnpm run check:accounts"), "Launch readiness should include the account access check");
check(launchReadiness.includes("corepack pnpm --dir mobile/app exec eas login"), "Launch readiness should include the EAS login command");
check(launchReadiness.includes("completion"), "Launch readiness should say the release doctor includes completion status");
check(launchReadiness.includes("corepack pnpm run check:launch:status"), "Launch readiness should include the launch status command");
check(launchReadiness.includes("corepack pnpm run check:complete"), "Launch readiness should include the completion dashboard command");
check(launchReadiness.includes("corepack pnpm run release:completion-report"), "Launch readiness should include the completion report command");
check(launchReadiness.includes("corepack pnpm run release:completion-summary"), "Launch readiness should include the completion summary command");
check(launchReadiness.includes("corepack pnpm run check:completion-artifacts"), "Launch readiness should include the completion artifact check command");
check(launchReadiness.includes("GitHub Actions"), "Launch readiness should mention GitHub Actions visibility");
check(launchReadiness.includes("Readiness workflow"), "Launch readiness should mention the Readiness workflow");
check(launchReadiness.includes("release-collateral"), "Launch readiness should mention the release collateral artifact");
check(launchReadiness.includes("docs/release-completion-report.json"), "Launch readiness should point to the release completion report");
check(launchReadiness.includes("docs/release-completion-summary.md"), "Launch readiness should point to the release completion summary");
check(launchReadiness.includes("ready-to-submit completion dashboard"), "Launch readiness should describe ready-to-submit completion");
check(launchReadiness.includes("corepack pnpm run release:signoff:init"), "Launch readiness should include the post-submission signoff initializer command");
check(launchReadiness.includes("corepack pnpm run release:signoff:mark"), "Launch readiness should include the signoff marker command");
check(launchReadiness.includes("corepack pnpm run auth:production:set-github-secret"), "Launch readiness should include the GitHub secret setter command");
check(launchReadiness.includes("corepack pnpm run check:android:store"), "Launch readiness should include the Android store check");
check(launchReadiness.includes("corepack pnpm run release:store-pack"), "Launch readiness should include the store pack command");
check(launchReadiness.includes("docs/store-submission-pack.md"), "Launch readiness should point to the store submission pack");
check(launchReadiness.includes("docs/release-signoff.example.json"), "Launch readiness should point to the release signoff template");
check(launchReadiness.includes("docs/release-signoff.json"), "Launch readiness should point to the release signoff file");
check(mobilePreview.includes("corepack pnpm run preview:mobile:web"), "Mobile preview guide should include the root preview command");
check(mobilePreview.includes("corepack pnpm run check:mobile:preview"), "Mobile preview guide should include the browser preview smoke check");
check(mobilePreview.includes("http://localhost:19006"), "Mobile preview guide should include the Expo web URL");
check(mobilePreview.includes("not the Vite website"), "Mobile preview guide should distinguish mobile app from website preview");
check(mobilePreview.includes("localhost:5174/sign-in"), "Mobile preview guide should warn against the stale localhost:5174 sign-in URL");
check(mobilePreview.includes("Use preview account"), "Mobile preview guide should explain the preview account button");
check(mobilePreview.includes("corepack pnpm run doctor:mobile:preview"), "Mobile preview guide should include the preview doctor command");
check(productionEnv.includes("VITE_API_URL=https://ai-do.onrender.com"), "Production env doc should include Vercel API URL");
check(productionEnv.includes("FRONTEND_URL=https://aidowedding.net"), "Production env doc should include Render frontend URL");
check(productionEnv.includes("PUBLIC_APP_URL=https://aidowedding.net"), "Production env doc should include public app URL");
check(productionEnv.includes("EXPO_PUBLIC_AIDO_WEB_URL=https://aidowedding.net"), "Production env doc should include mobile website URL");
check(productionEnv.includes("EXPO_PUBLIC_AIDO_API_URL=https://ai-do.onrender.com"), "Production env doc should include mobile API URL");
check(productionEnv.includes("Do not set `EXPO_PUBLIC_AIDO_AUTH_TOKEN`"), "Production env doc should warn against production auth token override");
check(productionEnv.includes("corepack pnpm run check:production:auth"), "Production env doc should include signed-in production verification");
check(releaseHandoff.includes("docs/production-env.md"), "Release handoff should point to the production env checklist");
check(releaseHandoff.includes("corepack pnpm run doctor:release"), "Release handoff should include the release doctor");
check(releaseHandoff.includes("completion dashboard"), "Release handoff should explain the release doctor includes the completion dashboard");
check(releaseHandoff.includes("corepack pnpm run check:launch"), "Release handoff should include the non-auth launch gate");
check(releaseHandoff.includes("corepack pnpm run check:android:store"), "Release handoff should include the Android store check");
check(releaseHandoff.includes("corepack pnpm run check:launch:status"), "Release handoff should include the launch status command");
check(releaseHandoff.includes("corepack pnpm run check:complete"), "Release handoff should include the completion dashboard command");
check(releaseHandoff.includes("corepack pnpm run check:accounts"), "Release handoff should include the account access check");
check(releaseHandoff.includes("corepack pnpm run release:completion-report"), "Release handoff should include the completion report command");
check(releaseHandoff.includes("corepack pnpm run release:completion-summary"), "Release handoff should include the completion summary command");
check(releaseHandoff.includes("corepack pnpm run check:completion-artifacts"), "Release handoff should include the completion artifact check command");
check(releaseHandoff.includes("GitHub Actions Readiness workflow"), "Release handoff should mention CI completion dashboard visibility");
check(releaseHandoff.includes("release-collateral"), "Release handoff should mention the release collateral artifact");
check(releaseHandoff.includes("docs/release-completion-report.json"), "Release handoff should point to the release completion report");
check(releaseHandoff.includes("docs/release-completion-summary.md"), "Release handoff should point to the release completion summary");
check(releaseHandoff.includes("corepack pnpm run check:complete:strict"), "Release handoff should include the strict completion command");
check(releaseHandoff.includes("counts readiness to submit"), "Release handoff should explain ready-to-submit completion");
check(releaseHandoff.includes("post-submission signoff"), "Release handoff should explain post-submission signoff tracking");
check(releaseHandoff.includes("corepack pnpm run release:signoff:init"), "Release handoff should include the signoff initializer command");
check(releaseHandoff.includes("corepack pnpm run release:signoff:mark -- github"), "Release handoff should include the GitHub signoff marker command");
check(releaseHandoff.includes("corepack pnpm run release:signoff:mark -- android"), "Release handoff should include the Android signoff marker command");
check(releaseHandoff.includes("corepack pnpm run release:signoff:mark -- ios"), "Release handoff should include the iOS signoff marker command");
check(releaseHandoff.includes("--dry-run"), "Release handoff should document signoff dry-runs");
check(releaseHandoff.includes("corepack pnpm run auth:production:refresh"), "Release handoff should include production auth refresh");
check(releaseHandoff.includes("corepack pnpm run doctor:production:auth"), "Release handoff should include the production auth doctor");
check(releaseHandoff.includes("E2E workflow"), "Release handoff should mention E2E workflow auth validation");
check(releaseHandoff.includes("corepack pnpm run auth:production:print-secret"), "Release handoff should include the GitHub auth secret helper");
check(releaseHandoff.includes("corepack pnpm run auth:production:set-github-secret"), "Release handoff should include the GitHub auth secret setter");
check(releaseHandoff.includes("AIDO_AUTH_STATE_BASE64"), "Release handoff should mention the GitHub auth secret name");
check(releaseHandoff.includes("corepack pnpm run check:launch:auth"), "Release handoff should include the signed-in launch gate");
check(releaseHandoff.includes("https://aidowedding.net"), "Release handoff should include the canonical website domain");
check(releaseHandoff.includes("https://ai-do.onrender.com"), "Release handoff should include the production API origin");
check(releaseHandoff.includes("app-release.aab"), "Release handoff should include the Android store bundle path");
check(releaseHandoff.includes("corepack pnpm --dir mobile/app run build:ios"), "Release handoff should include the iOS EAS build command");
check(releaseHandoff.includes("corepack pnpm --dir mobile/app exec eas login"), "Release handoff should include the EAS login command");
check(releaseHandoff.includes("docs/release-notes.md"), "Release handoff should point to release notes");
check(releaseHandoff.includes("docs/release-manifest.json"), "Release handoff should point to the release manifest");
check(releaseHandoff.includes("corepack pnpm run release:store-pack"), "Release handoff should include the store pack command");
check(releaseHandoff.includes("docs/store-submission-pack.md"), "Release handoff should point to the store submission pack");
check(releaseHandoff.includes("docs/release-signoff.example.json"), "Release handoff should point to the release signoff template");
check(releaseHandoff.includes("docs/release-signoff.json"), "Release handoff should point to the release signoff file");
check(releaseHandoff.includes("githubAuthSecretUpdated"), "Release handoff should include the GitHub secret signoff flag");
check(releaseHandoff.includes("androidStoreSubmitted"), "Release handoff should include the Android store signoff flag");
check(releaseHandoff.includes("iosStoreSubmitted"), "Release handoff should include the iOS store signoff flag");
check(releaseHandoff.includes("corepack pnpm run release:manifest"), "Release handoff should include the release manifest command");
check(releaseManifest.canonicalWebsite === canonicalOrigin, "Release manifest should include the canonical website");
check(releaseManifest.productionApi === renderApiOrigin, "Release manifest should include the production API");
check(releaseManifest.entries?.some((entry) => entry.path === "mobile/app/android/app/build/outputs/bundle/release/app-release.aab"), "Release manifest should include the Android store AAB");
check(releaseManifest.entries?.some((entry) => entry.path === "mobile/app/STORE_LISTING.md"), "Release manifest should include the store listing");
check(releaseManifest.entries?.some((entry) => entry.path === "mobile/app/assets/icon.png"), "Release manifest should include the mobile app icon");
check(releaseManifest.entries?.some((entry) => entry.path === "mobile/app/assets/android-icon-foreground.png"), "Release manifest should include the Android adaptive foreground icon");
check(releaseManifest.entries?.some((entry) => entry.path === "mobile/app/assets/android-icon-background.png"), "Release manifest should include the Android adaptive background icon");
check(releaseManifest.entries?.some((entry) => entry.path === "mobile/app/assets/android-icon-monochrome.png"), "Release manifest should include the Android adaptive monochrome icon");
check(releaseManifest.entries?.some((entry) => entry.path === "artifacts/aido/public/site.webmanifest"), "Release manifest should include the website manifest");
check(releaseManifest.entries?.some((entry) => entry.path === "artifacts/aido/public/web-app-icon-192.png"), "Release manifest should include the website 192px app icon");
check(releaseManifest.entries?.some((entry) => entry.path === "artifacts/aido/public/web-app-icon-512.png"), "Release manifest should include the website 512px app icon");
check(storeSubmissionPack.includes("A.I. DO Store Submission Pack"), "Store submission pack should have the expected title");
check(storeSubmissionPack.includes("app-release.aab"), "Store submission pack should include the Android AAB");
check(storeSubmissionPack.includes("mobile/app/STORE_LISTING.md"), "Store submission pack should include store listing copy");
check(storeSubmissionPack.includes("mobile/app/store/screenshots/iphone/01-dashboard.png"), "Store submission pack should include iPhone screenshots");
check(storeSubmissionPack.includes("docs/release-notes.md"), "Store submission pack should include release notes");
check(storeSubmissionPack.includes("release-collateral"), "Store submission pack should explain GitHub release collateral contents");
check(storeSubmissionPack.includes("Android APK/AAB files are local build outputs"), "Store submission pack should explain Android build output handling");
check(storeSubmissionPack.includes("corepack pnpm run release:signoff:mark -- github"), "Store submission pack should include the GitHub signoff marker command");
check(storeSubmissionPack.includes("corepack pnpm run release:signoff:mark -- android"), "Store submission pack should include the Android signoff marker command");
check(storeSubmissionPack.includes("corepack pnpm run release:signoff:mark -- ios"), "Store submission pack should include the iOS signoff marker command");
check(storeSubmissionPack.includes("--dry-run"), "Store submission pack should document signoff dry-runs");
check(releaseNotes.includes("A.I. DO is live"), "Release notes should include launch update copy");
check(releaseNotes.includes("Initial A.I. DO release"), "Release notes should include store release copy");

const mobileEnv = parseEnv(rel("mobile", "app", ".env.example"));
const mobileAppJson = readJson(rel("mobile", "app", "app.json"));
const mobilePackage = readJson(rel("mobile", "app", "package.json"));
const webManifest = readJson(rel("artifacts", "aido", "public", "site.webmanifest"));
const webIcon192 = pngDimensions(rel("artifacts", "aido", "public", "web-app-icon-192.png"));
const webIcon512 = pngDimensions(rel("artifacts", "aido", "public", "web-app-icon-512.png"));
check(mobileEnv.get("EXPO_PUBLIC_AIDO_WEB_URL") === canonicalOrigin, "mobile env should point at the canonical website");
check(mobileEnv.get("EXPO_PUBLIC_AIDO_API_URL") === renderApiOrigin, "mobile env should point at the Render API");
check(mobileEnv.has("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY"), "mobile env should include EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY");
check(mobileAppJson.expo?.ios?.bundleIdentifier === "net.aidowedding.app", "mobile iOS bundle identifier should be stable");
check(mobileAppJson.expo?.android?.package === "net.aidowedding.app", "mobile Android package should be stable");
check(mobileAppJson.expo?.ios?.buildNumber === "1", "mobile iOS build number should be set");
check(mobileAppJson.expo?.android?.versionCode === 1, "mobile Android versionCode should be set");
check(mobileAppJson.expo?.splash?.image === "./assets/splash-icon.png", "mobile splash image should be configured");
check(mobilePackage.devDependencies?.["eas-cli"] === "20.0.0", "mobile package should pin eas-cli for store builds");
check(webManifest.name === "A.I DO Wedding Planner", "web manifest should have the production app name");
check(webManifest.start_url === "/dashboard", "web manifest should start at the signed-in dashboard");
check(webManifest.display === "standalone", "web manifest should enable standalone display");
check(webManifest.icons?.some((icon) => icon.src === "/web-app-icon-192.png" && icon.sizes === "192x192"), "web manifest should include a 192px icon");
check(webManifest.icons?.some((icon) => icon.src === "/web-app-icon-512.png" && icon.sizes === "512x512"), "web manifest should include a 512px icon");
check(webIcon192?.width === 192 && webIcon192?.height === 192, "web 192px app icon should be 192x192");
check(webIcon512?.width === 512 && webIcon512?.height === 512, "web 512px app icon should be 512x512");

if (failures.length > 0) {
  console.error(`Deploy readiness failed with ${failures.length} issue(s):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Deploy readiness passed (${passed} checks).`);
