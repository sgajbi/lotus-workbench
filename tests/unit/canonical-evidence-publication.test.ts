import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
const powershell = process.platform === "win32" ? "powershell.exe" : "pwsh";
const modulePath = join(
  process.cwd(),
  "scripts",
  "live",
  "CanonicalEvidencePublication.psm1",
);

function invoke(script: string): string {
  const result = spawnSync(
    powershell,
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("canonical evidence publication", () => {
  it("keeps prior and pending full-profile evidence diagnostic until publication", () => {
    const root = mkdtempSync(join(tmpdir(), "lotus-evidence-publication-"));
    roots.push(root);
    const published = join(root, "live-canonical");
    mkdirSync(published);
    writeFileSync(join(published, "live-validation-summary.json"), "old");

    const publication = JSON.parse(
      invoke(
        `Import-Module '${modulePath}' -Force; ` +
          `$staged = New-CanonicalEvidencePublicationWorkspace -PublishedDirectory '${published}' -Stage; ` +
          `$publishedAbsentBeforePublication = -not (Test-Path -LiteralPath '${published}'); ` +
          `New-Item -ItemType Directory -Path $staged | Out-Null; ` +
          `Set-Content -LiteralPath (Join-Path $staged 'live-validation-summary.json') -Value 'new' -NoNewline; ` +
          `Publish-CanonicalBrowserEvidence -StagedDirectory $staged -PublishedDirectory '${published}'; ` +
          `@{ staged=$staged; publishedAbsentBeforePublication=$publishedAbsentBeforePublication } | ConvertTo-Json -Compress`,
      ),
    );
    const staged = publication.staged as string;
    expect(publication.publishedAbsentBeforePublication).toBe(true);
    expect(staged).toContain("diagnostic-live-canonical-pending-");
    const superseded = readdirSync(root).find((name) =>
      name.startsWith("diagnostic-live-canonical-superseded-"),
    );
    expect(superseded).toBeDefined();
    expect(
      readFileSync(
        join(root, superseded!, "live-validation-summary.json"),
        "utf8",
      ),
    ).toBe("old");

    expect(existsSync(staged)).toBe(false);
    expect(
      readFileSync(join(published, "live-validation-summary.json"), "utf8"),
    ).toBe("new");
  });

  it("refuses to overwrite a destination recreated during the full probe", () => {
    const root = mkdtempSync(join(tmpdir(), "lotus-evidence-publication-"));
    roots.push(root);
    const staged = join(root, "diagnostic-live-canonical-pending-proof");
    const published = join(root, "live-canonical");
    mkdirSync(staged);
    mkdirSync(published);

    expect(() =>
      invoke(
        `Import-Module '${modulePath}' -Force; ` +
          `Publish-CanonicalBrowserEvidence -StagedDirectory '${staged}' -PublishedDirectory '${published}'`,
      ),
    ).toThrow();
    expect(existsSync(staged)).toBe(true);
    expect(existsSync(published)).toBe(true);
  });

  it("keeps client-demo evidence in a distinct diagnostic directory", () => {
    const root = mkdtempSync(join(tmpdir(), "lotus-evidence-publication-"));
    roots.push(root);
    const published = join(root, "live-canonical");
    mkdirSync(published);
    writeFileSync(join(published, "live-validation-summary.json"), "certified");

    const diagnostic = invoke(
      `Import-Module '${modulePath}' -Force; ` +
        `New-CanonicalEvidencePublicationWorkspace -PublishedDirectory '${published}' -Diagnostic`,
    );

    expect(diagnostic).toContain("diagnostic-live-canonical-client-demo-");
    expect(
      readFileSync(join(published, "live-validation-summary.json"), "utf8"),
    ).toBe("certified");
  });
});
