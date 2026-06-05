import http from "node:http";

const targets = [
  {
    label: "Website dev server",
    url: "http://localhost:5173",
    expected: "Vite website",
  },
  {
    label: "Stale website sign-in URL",
    url: "http://localhost:5174/sign-in",
    expected: "Not used for mobile preview",
  },
  {
    label: "Expo mobile app preview",
    url: "http://localhost:19006",
    expected: "Mobile app preview",
  },
];

function requestStatus(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve({
        ok: (response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 500,
        statusCode: response.statusCode ?? 0,
      });
    });

    request.setTimeout(3000, () => {
      request.destroy();
      resolve({ ok: false, statusCode: 0 });
    });

    request.on("error", () => resolve({ ok: false, statusCode: 0 }));
  });
}

console.log("A.I. DO Mobile Preview Doctor");
console.log("=============================");

let mobilePreviewOk = false;

for (const target of targets) {
  const status = await requestStatus(target.url);
  const state = status.ok ? `reachable (${status.statusCode})` : "not reachable";
  console.log(`- ${target.label}: ${state}`);
  console.log(`  ${target.url}`);
  console.log(`  ${target.expected}`);
  if (target.url === "http://localhost:19006") {
    mobilePreviewOk = status.ok;
  }
}

console.log("");
console.log("Use this URL for the mobile app preview:");
console.log("http://localhost:19006");
console.log("");
console.log("Do not use this stale URL for the mobile app preview:");
console.log("http://localhost:5174/sign-in");

if (!mobilePreviewOk) {
  console.log("");
  console.log("Start the mobile preview with:");
  console.log("corepack pnpm run preview:mobile:web");
  process.exit(1);
}
