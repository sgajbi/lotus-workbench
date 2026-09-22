import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("canonical Advise source tenant", () => {
  it("accepts source ownership and rejects missing or caller-derived tenant fixtures", () => {
    const shell = process.platform === "win32" ? "powershell.exe" : "pwsh";
    const result = spawnSync(
      shell,
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        join(process.cwd(), "scripts/quality/Test-CanonicalAdviseSourceTenant.ps1"),
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('"passed":true');
  });

  it("binds the source tenant before Docker mutation and uses it for build and start", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts/live/Start-LotusFrontOfficeCanonical.ps1"),
      "utf8",
    );
    expect(source).toContain("Get-CanonicalAdviseEnvironment -ContractPath $canonicalContractPath");
    expect(source).toContain("Invoke-ComposeUp $adviseRepo $canonicalAdviseEnvironment");
    expect(source).toMatch(/\$repo -eq \$adviseRepo\)\s*\{\s*\$canonicalAdviseEnvironment\s*\}/);
    expect(source).toMatch(/\$canonicalAdviseEnvironment = if \(\$CoreManageOnly\)\s*\{\s*@\{\}/);
    expect(source.indexOf("$canonicalAdviseEnvironment = Get-CanonicalAdviseEnvironment")).toBeLessThan(
      source.indexOf("Invoke-ComposeUp $coreRepo $canonicalCoreEnvironment"),
    );
  });
});
