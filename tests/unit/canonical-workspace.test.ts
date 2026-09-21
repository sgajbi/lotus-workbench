import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("canonical workspace resolution", () => {
  it("rejects an invalid launcher target before invoking PowerShell", () => {
    const launcher = join(process.cwd(), "scripts/live/run-canonical-powershell.mjs");
    const source = readFileSync(launcher, "utf8");
    expect(source).toContain('process.platform !== "win32"');
    expect(source).toContain("supported only on Windows");
    if (process.platform === "win32") {
      const result = spawnSync(process.execPath, [launcher, "../outside.ps1"], {
        cwd: process.cwd(), encoding: "utf8",
      });
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("repository-owned scripts/live/*.ps1");
    }
  });

  it("accepts a sibling checkout and fails closed on root mutations", () => {
    const shell = process.platform === "win32" ? "powershell.exe" : "pwsh";
    const result = spawnSync(
      shell,
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        join(process.cwd(), "scripts/live/tests/Test-CanonicalWorkspace.ps1"),
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain(
      "Canonical workspace valid and fail-closed cases passed.",
    );
  });
});
