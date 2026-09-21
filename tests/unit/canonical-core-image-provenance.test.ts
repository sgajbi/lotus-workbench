import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("canonical Core image provenance", () => {
  it("accepts exact metadata and rejects version/OCI mutations in PowerShell", () => {
    const shell = process.platform === "win32" ? "powershell.exe" : "pwsh";
    const result = spawnSync(
      shell,
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        join(
          process.cwd(),
          "scripts/quality/Test-CanonicalCoreImageProvenance.ps1",
        ),
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('"passed":true');
  });

  it("binds the check to the shipped built Core image before downstream seed", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts/live/Start-LotusFrontOfficeCanonical.ps1"),
      "utf8",
    );
    expect(source).toContain("New-CanonicalCoreBuildEnvironment");
    expect(source).toContain("Assert-CanonicalCoreImageProvenance");
    expect(
      source.indexOf("Assert-CanonicalCoreImageProvenance -RepoPath $coreRepo"),
    ).toBeLessThan(
      source.indexOf("Invoke-CanonicalCoreSeed -IngestOnly"),
    );
  });
});
