import { spawnSync } from "node:child_process";
import { join } from "node:path";

const powershell = process.platform === "win32" ? "powershell.exe" : "pwsh";
const contractPath = join(
  process.cwd(),
  "scripts",
  "quality",
  "Test-CanonicalPortOwnership.ps1",
);
const result = spawnSync(
  powershell,
  ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", contractPath],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(
    `Unable to execute canonical port-ownership contracts with ${powershell}: ${result.error.message}`,
  );
  process.exit(1);
}

if (result.status !== 0) process.exit(result.status ?? 1);
const reservation = spawnSync(powershell, [
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
  join(process.cwd(), "scripts", "quality", "Test-CanonicalRuntimeReservation.ps1"),
], { stdio: "inherit" });
if (reservation.error) console.error(reservation.error.message);
if (reservation.status !== 0) process.exit(reservation.status ?? 1);
const builds = spawnSync(powershell, [
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
  join(process.cwd(), "scripts", "quality", "Test-CanonicalBuildPlan.ps1"),
], { stdio: "inherit" });
if (builds.error) console.error(builds.error.message);
process.exit(builds.status ?? 1);
