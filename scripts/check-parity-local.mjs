import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import process from "node:process";

const root = process.cwd();
const baseUrl = process.env.AIDO_BASE_URL ?? "http://localhost:5173";
let devServer = null;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child =
      process.platform === "win32"
        ? spawn("cmd.exe", ["/d", "/s", "/c", [command, ...args].join(" ")], {
            cwd: root,
            stdio: "inherit",
            shell: false,
            ...options,
          })
        : spawn(command, args, {
            cwd: root,
            stdio: "inherit",
            shell: false,
            ...options,
          });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

function requestOk(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve((response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 500);
    });

    request.setTimeout(2000, () => {
      request.destroy();
      resolve(false);
    });

    request.on("error", () => resolve(false));
  });
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await requestOk(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}

function startDevServer() {
  devServer =
    process.platform === "win32"
      ? spawn("cmd.exe", ["/d", "/s", "/c", "corepack pnpm --dir artifacts/aido run dev -- --host 127.0.0.1"], {
          cwd: root,
          stdio: "inherit",
          shell: false,
        })
      : spawn("corepack", ["pnpm", "--dir", "artifacts/aido", "run", "dev", "--", "--host", "127.0.0.1"], {
          cwd: root,
          stdio: "inherit",
          shell: false,
        });

  devServer.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`Local dev server exited with code ${code}.`);
    }
  });
}

function stopDevServer() {
  if (!devServer?.pid) return;

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(devServer.pid), "/t", "/f"], {
      stdio: "ignore",
      shell: false,
    });
    return;
  }

  devServer.kill();
}

async function main() {
  const alreadyRunning = await requestOk(baseUrl);
  if (!alreadyRunning) {
    startDevServer();
    if (!(await waitForServer(baseUrl))) {
      console.error(`Timed out waiting for ${baseUrl}`);
      process.exit(1);
    }
  }

  try {
    await run(
      "corepack",
      [
        "pnpm",
        "exec",
        "playwright",
        "test",
        "tests/aido-feature-parity.spec.ts",
        "--project=chromium",
        "--project=mobile-chrome",
      ],
      {
        env: {
          ...process.env,
          AIDO_BASE_URL: baseUrl,
        },
      },
    );
  } finally {
    if (devServer) {
      stopDevServer();
    }
  }
}

main().catch((error) => {
  if (devServer) {
    stopDevServer();
  }
  console.error(error.message);
  process.exit(1);
});
