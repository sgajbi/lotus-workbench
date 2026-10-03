import { cpSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error Repository quality scripts are executable JavaScript modules.
import { verifyNextEslintFork } from "../../scripts/quality/check-next-eslint-fork.mjs";

function candidate(run: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), "lotus-next-provenance-"));
  try { cpSync(resolve("tools/eslint-plugin-next"), root, { recursive: true }); run(root); }
  finally { rmSync(root, { recursive: true, force: true }); }
}
interface Provenance {
  upstream: { integrity: string; sourceCommit: string };
  files: { upstreamSha256: string; sha256: string }[];
  maintenance: { owner: string; nextReviewBy: string };
}
function mutate(root: string, change: (value: Provenance) => void) {
  const file = join(root, "UPSTREAM-PROVENANCE.json");
  const value = JSON.parse(readFileSync(file, "utf8"));
  change(value);
  writeFileSync(file, JSON.stringify(value));
}
const verify = (root: string, today = "2026-10-04") => verifyNextEslintFork(root, { today });
describe("Next tooling provenance guard admission/refusal", () => {
  it("admits the complete declared source on the deadline", () => candidate((root) => {
    expect(verify(root, "2026-10-14")).toEqual({ rules: 21, files: 52 });
  }));
  it.each(["dist/index.js", "dist/rules/no-html-link-for-pages.js", "dist/utils/get-root-dirs.js", "LICENSE"])(
    "refuses changed %s", (file) => candidate((root) => {
      writeFileSync(join(root, file), "tampered");
      expect(() => verify(root)).toThrow(/mismatch/);
    }));
  it("refuses a missing rule", () => candidate((root) => {
    unlinkSync(join(root, "dist/rules/no-img-element.js"));
    expect(() => verify(root)).toThrow();
  }));
  it("refuses an unlisted package file", () => candidate((root) => {
    writeFileSync(join(root, "dist", "unexpected.js"), "extra");
    expect(() => verify(root)).toThrow(/unlisted/);
  }));
  it.each([
    (value: Provenance) => { value.upstream.integrity = "sha512-wrong"; },
    (value: Provenance) => { value.upstream.sourceCommit = "0".repeat(40); },
    (value: Provenance) => { value.files[0].upstreamSha256 = "0".repeat(64); },
    (value: Provenance) => { value.files[0].sha256 = "0".repeat(64); },
    (value: Provenance) => { value.maintenance.owner = ""; },
    (value: Provenance) => { value.maintenance.nextReviewBy = "2026-12-31"; },
    (value: Provenance) => { value.files = []; },
  ])("refuses malformed/drifted provenance %#", (change) => candidate((root) => {
    mutate(root, change);
    expect(() => verify(root)).toThrow();
  }));
  it("refuses expired maintenance", () => candidate((root) => {
    expect(() => verify(root, "2026-10-15")).toThrow(/expired/);
  }));
  it("refuses dependency reintroduction", () => candidate((root) => {
    const file = join(root, "package.json");
    const pkg = JSON.parse(readFileSync(file, "utf8"));
    pkg.dependencies = { "fast-glob": "3.3.1" };
    writeFileSync(file, JSON.stringify(pkg));
    expect(() => verify(root)).toThrow(/dependency/);
  }));
});
