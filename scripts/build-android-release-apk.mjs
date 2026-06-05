import { spawnSync } from "node:child_process";
import process from "node:process";
import path from "node:path";

const root = process.cwd();
const appDir = path.join(root, "mobile", "app");

const result =
  process.platform === "win32"
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", "build-release-apk.bat"], {
        cwd: appDir,
        stdio: "inherit",
        shell: false,
      })
    : spawnSync("./build-release-apk.bat", {
        cwd: appDir,
        stdio: "inherit",
        shell: true,
      });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const check = spawnSync(process.execPath, [path.join(root, "scripts", "check-android-release-apk.mjs")], {
  cwd: root,
  stdio: "inherit",
  shell: false,
});

process.exit(check.status ?? 0);
