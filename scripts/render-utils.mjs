import { existsSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const pnpmVersion = "10.26.1";

export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });
}

export function runPnpm(args, options = {}) {
  return run("npm", ["exec", "--yes", `pnpm@${pnpmVersion}`, "--", ...args], options);
}

export async function ensureWorkspaceInstall() {
  const apiNodeModules = path.resolve("artifacts/api-server/node_modules");
  const rootPnpmStore = path.resolve("node_modules/.pnpm");
  if (existsSync(apiNodeModules) && existsSync(rootPnpmStore)) return;

  console.log("[render] Installing workspace dependencies with pnpm.");
  await runPnpm(["install", "--frozen-lockfile=false", "--prod=false"]);
}

export async function buildApi() {
  await ensureWorkspaceInstall();
  await runPnpm(["--dir", "artifacts/api-server", "run", "build"]);
}

export async function buildFrontend() {
  await ensureWorkspaceInstall();
  await runPnpm(["--dir", "artifacts/aido", "run", "build"]);
}

export async function copyFrontendDist() {
  const source = path.resolve("artifacts/aido/dist");
  const target = path.resolve("dist");
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true });
}
