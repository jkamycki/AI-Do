import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const apiEntry = path.resolve("artifacts/api-server/dist/index.mjs");

function run(command, args, options = {}) {
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

if (!existsSync(apiEntry)) {
  console.log("[render:start] API build output missing; building before start.");
  await run("npm", [
    "exec",
    "--yes",
    "pnpm@10.26.1",
    "--",
    "--dir",
    "artifacts/api-server",
    "run",
    "build",
  ]);
}

const server = spawn(process.execPath, ["--enable-source-maps", apiEntry], {
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.kill(signal);
  });
}

server.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
