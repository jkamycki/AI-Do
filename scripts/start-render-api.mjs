import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { buildApi } from "./render-utils.mjs";

const apiEntry = path.resolve("artifacts/api-server/dist/index.mjs");

if (!existsSync(apiEntry)) {
  console.log("[render:start] API build output missing; building before start.");
  await buildApi();
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
