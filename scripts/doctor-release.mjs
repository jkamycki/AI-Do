import { spawnSync } from "node:child_process";
import process from "node:process";

const root = process.cwd();

function runNodeScript(label, scriptPath, { allowFailure = false } = {}) {
  console.log("");
  console.log(label);
  console.log("-".repeat(label.length));

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });

  const status = result.status ?? 1;
  if (status !== 0 && !allowFailure) {
    process.exit(status);
  }

  return status;
}

function runScript(label, script, { allowFailure = false } = {}) {
  console.log("");
  console.log(label);
  console.log("-".repeat(label.length));

  const result =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", `corepack pnpm run ${script}`], {
          cwd: root,
          stdio: "inherit",
          shell: false,
        })
      : spawnSync("corepack", ["pnpm", "run", script], {
          cwd: root,
          stdio: "inherit",
          shell: false,
        });

  const status = result.status ?? 1;
  if (status !== 0 && !allowFailure) {
    process.exit(status);
  }

  return status;
}

console.log("A.I. DO Release Doctor");
console.log("======================");

runScript("Launch Status", "check:launch:status");
runScript("Completion Dashboard", "check:complete");
runScript("Mobile Preview", "doctor:mobile:preview");
const authStatus = runNodeScript("Production Auth", "scripts/doctor-production-auth.mjs", { allowFailure: true });
const accountStatus = runNodeScript("Account Access", "scripts/check-account-access.mjs", { allowFailure: true });

console.log("");
console.log("Summary");
console.log("-------");
console.log("Automated launch assets, public production smoke, and mobile preview are ready.");

if (authStatus === 0) {
  console.log("Production signed-in auth is ready.");
} else {
  console.log("Production signed-in auth still needs a real aidowedding.net login.");
  console.log("Next: corepack pnpm run auth:production:refresh");
}

if (accountStatus === 0) {
  console.log("GitHub and EAS account access are ready.");
  console.log("Next: run the final secret/build commands, then corepack pnpm run check:complete:strict.");
} else {
  console.log("GitHub/EAS account access still needs login before the final account-gated commands.");
  console.log("Next: corepack pnpm run check:accounts");
}
