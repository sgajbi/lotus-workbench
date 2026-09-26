import { describe, expect, it } from "vitest";

type UnusedCodeModule = typeof import("../../scripts/quality/check-unused-code.mjs");

const baselineSignatures = [
  "exports:src/example.ts:unusedValue",
  "files:src/dead.ts:src/dead.ts",
  "types:src/example.ts:UnusedType",
];

const baseline = {
  schemaVersion: "lotus-workbench.unused-code-baseline.v1",
  tool: "knip",
  toolVersion: "6.38.0",
  scope: "production source graph; repository scripts and tests are explicit entry points outside this inventory",
  findingCount: 3,
  identityDigest: "3b752a1ef4f2cc5f29d506fd603115d881b43c31207e3dd2efac3a0ba16bf354",
};

function report(signatures = baselineSignatures) {
  const issues = new Map<string, { file: string; files: { name: string }[]; exports: { name: string }[]; types: { name: string }[] }>();
  for (const signature of signatures) {
    const [kind, file, ...nameParts] = signature.split(":");
    const issue = issues.get(file) ?? { file, files: [], exports: [], types: [] };
    issue[kind as "files" | "exports" | "types"].push({ name: nameParts.join(":") });
    issues.set(file, issue);
  }
  return { issues: [...issues.values()] };
}

describe("unused-code governance", () => {
  it("accepts only the exact sorted production baseline", async () => {
    const { validateUnusedCodeBaseline } = (await import(
      "../../scripts/quality/check-unused-code.mjs"
    )) as UnusedCodeModule;

    expect(validateUnusedCodeBaseline({ report: report(), baseline })).toEqual({
      count: 3,
      identityDigest: baseline.identityDigest,
    });
  });

  it("rejects a newly introduced unused export", async () => {
    const { validateUnusedCodeBaseline } = (await import(
      "../../scripts/quality/check-unused-code.mjs"
    )) as UnusedCodeModule;

    expect(() =>
      validateUnusedCodeBaseline({
        report: report([...baselineSignatures, "exports:src/new.ts:unusedNewValue"]),
        baseline,
      }),
    ).toThrow(/Unused-code governance failed/);
  });

  it("rejects baseline headroom after cleanup", async () => {
    const { validateUnusedCodeBaseline } = (await import(
      "../../scripts/quality/check-unused-code.mjs"
    )) as UnusedCodeModule;

    expect(() =>
      validateUnusedCodeBaseline({
        report: report(baselineSignatures.slice(1)),
        baseline,
      }),
    ).toThrow(/ratchet/);
  });

  it("rejects malformed baseline identity fields", async () => {
    const { validateUnusedCodeBaseline } = (await import(
      "../../scripts/quality/check-unused-code.mjs"
    )) as UnusedCodeModule;

    expect(() =>
      validateUnusedCodeBaseline({
        report: report(),
        baseline: { ...baseline, findingCount: -1 },
      }),
    ).toThrow(/findingCount/);
    expect(() =>
      validateUnusedCodeBaseline({
        report: report(),
        baseline: { ...baseline, identityDigest: "not-a-digest" },
      }),
    ).toThrow(/identityDigest/);
  });
});
