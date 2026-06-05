import process from "node:process";

const webOrigin = "https://aidowedding.net";
const apiOrigin = "https://ai-do.onrender.com";
const timeoutMs = 20_000;

const failures = [];
let passed = 0;

function check(condition, message) {
  if (condition) {
    passed += 1;
  } else {
    failures.push(message);
  }
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "AIDO-production-smoke/1.0",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkHtmlRoute(path, label) {
  const url = `${webOrigin}${path}`;
  try {
    const response = await fetchWithTimeout(url);
    const body = await response.text();
    check(response.ok, `${label} should return 2xx (${response.status})`);
    check(
      response.headers.get("content-type")?.includes("text/html"),
      `${label} should return HTML`,
    );
    check(body.includes('<div id="root">'), `${label} should include the app root`);
    check(!body.includes("404: NOT_FOUND"), `${label} should not be Vercel 404`);
  } catch (error) {
    failures.push(`${label} failed to load: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function checkHealth(url, label) {
  try {
    const response = await fetchWithTimeout(url);
    const body = await response.text();
    let payload = {};
    try {
      payload = JSON.parse(body);
    } catch {}
    check(response.ok, `${label} should return 2xx (${response.status})`);
    check(payload.status === "ok", `${label} should return {"status":"ok"}`);
  } catch (error) {
    failures.push(`${label} failed to load: ${error instanceof Error ? error.message : String(error)}`);
  }
}

for (const [path, label] of [
  ["/", "marketing home"],
  ["/wedding-website-builder", "website builder marketing"],
  ["/wedding-photo-qr-code", "photo QR marketing"],
  ["/for-vendors", "vendor marketing"],
  ["/privacy", "privacy page"],
  ["/terms", "terms page"],
  ["/security", "security page"],
  ["/vendors", "mobile vendors tab"],
  ["/aria", "mobile add tab"],
  ["/checklist", "mobile checklist tab"],
  ["/settings", "mobile more tab"],
]) {
  await checkHtmlRoute(path, label);
}

await checkHealth(`${webOrigin}/api/healthz`, "Vercel API rewrite health");
await checkHealth(`${apiOrigin}/api/healthz`, "Render API direct health");

if (failures.length > 0) {
  console.error(`Production smoke failed with ${failures.length} issue(s):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Production smoke passed (${passed} checks).`);
