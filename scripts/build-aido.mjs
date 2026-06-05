import { cp, mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(root, "artifacts", "aido");
const appDist = path.join(appDir, "dist");
const rootDist = path.join(root, "dist");

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = process.platform === "win32" ? spawn("cmd.exe", ["/d", "/s", "/c", [command, ...args].join(" ")], {
      cwd: root,
      stdio: "inherit",
      shell: false,
      ...options,
    }) : spawn(command, args, {
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

await run("corepack", ["pnpm", "run", "build"], { cwd: appDir });
await rm(rootDist, { recursive: true, force: true });
await mkdir(rootDist, { recursive: true });
await cp(appDist, rootDist, { recursive: true });

console.log(`Copied ${path.relative(root, appDist)} to ${path.relative(root, rootDist)}`);
