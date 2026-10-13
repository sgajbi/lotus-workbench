import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("canonical running-stack full validation", () => {
  const shells = process.platform === "win32" ? ["powershell.exe", "pwsh"] : ["pwsh"];
  for (const shell of shells) {
    it(`preserves authority, refusal and cleanup through the shipped entry in ${shell}`, () => {
      const result = spawnSync(shell, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
        join(process.cwd(), "scripts/quality/Test-CanonicalRunningValidation.ps1")],
      { cwd: process.cwd(), encoding: "utf8" });
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      expect(result.stdout).toContain('"contract":"canonical-running-stack-validation"');
      expect(result.stdout).toContain('"passed":true');
      expect(result.stdout).toContain('"runtimeAcceptance":false');
      expect(result.stdout).toContain('"nativeBoundary":true');
      if (shell === "powershell.exe") {
        expect(result.stdout).toContain('"legacyFormatIntact":false');
      }
    }, 60_000);
  }

  it("exposes a separate supported entry and retains direct full-profile refusal", () => {
    const scripts = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).scripts;
    expect(scripts["live:validate:running"]).toBe(
      "node scripts/live/run-canonical-powershell.mjs scripts/live/Validate-LotusFrontOfficeRunning.ps1",
    );
    const validator = readFileSync(join(process.cwd(), "scripts/live/Validate-LotusFrontOfficeCanonical.ps1"), "utf8");
    expect(validator).toContain("Full canonical validation requires the ephemeral Idea capacity capability");
  });
});
