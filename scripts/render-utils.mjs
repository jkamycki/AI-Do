import { cp, mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

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

export async function installApi() {
  await run("npm", ["install", "--include=dev", "--prefix", "artifacts/api-server"]);
}

export async function installFrontend() {
  await run("npm", ["install", "--include=dev", "--prefix", "artifacts/aido"]);
}

export async function buildApi() {
  await installApi();
  await run("npm", ["run", "build", "--prefix", "artifacts/api-server"]);
}

export async function buildFrontend() {
  await installFrontend();
  await run("npm", ["run", "build", "--prefix", "artifacts/aido"]);
}

export async function copyFrontendDist() {
  const source = path.resolve("artifacts/aido/dist");
  const target = path.resolve("dist");
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true });
}
