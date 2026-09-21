import { spawnSync } from "node:child_process";

if (process.platform !== "win32") {
  console.error("Canonical front-office orchestration is supported only on Windows; listener and ingress-host controls require Windows.");
  process.exit(2);
}

const [script, ...args] = process.argv.slice(2);
if (!script || !/^scripts\/live\/[A-Za-z0-9-]+\.ps1$/.test(script)) {
  console.error("Expected a repository-owned scripts/live/*.ps1 entry point.");
  process.exit(2);
}

const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, ...args], {
  stdio: "inherit",
  cwd: process.cwd(),
});
if (result.error) {
  console.error(`Unable to launch Windows PowerShell: ${result.error.message}`);
  process.exit(2);
}
process.exit(result.status ?? 1);
