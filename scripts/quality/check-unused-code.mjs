import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ISSUE_KINDS = Object.freeze(["files", "exports", "types"]);
const DEFAULT_BASELINE_PATH = "scripts/quality/unused-code-baseline.v1.json";

function requireRecord(value, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
  return value;
}

export function normalizeKnipIssues(report) {
  const normalized = [];
  const root = requireRecord(report, "Knip report");
  if (!Array.isArray(root.issues)) {
    throw new Error("Knip report.issues must be an array.");
  }

  for (const [issueIndex, rawIssue] of root.issues.entries()) {
    const issue = requireRecord(rawIssue, `Knip report.issues[${issueIndex}]`);
    if (typeof issue.file !== "string" || issue.file.trim() === "") {
      throw new Error(`Knip report.issues[${issueIndex}].file must be a non-empty string.`);
    }
    const file = issue.file.replaceAll("\\", "/");
    for (const kind of ISSUE_KINDS) {
      const entries = issue[kind];
      if (!Array.isArray(entries)) {
        throw new Error(`Knip report.issues[${issueIndex}].${kind} must be an array.`);
      }
      for (const [entryIndex, rawEntry] of entries.entries()) {
        const entry = requireRecord(
          rawEntry,
          `Knip report.issues[${issueIndex}].${kind}[${entryIndex}]`,
        );
        if (typeof entry.name !== "string" || entry.name.trim() === "") {
          throw new Error(
            `Knip report.issues[${issueIndex}].${kind}[${entryIndex}].name must be a non-empty string.`,
          );
        }
        normalized.push(`${kind}:${file}:${entry.name}`);
      }
    }
  }

  return [...new Set(normalized)].sort();
}

export function validateUnusedCodeBaseline({ report, baseline }) {
  const root = requireRecord(baseline, "Unused-code baseline");
  if (root.schemaVersion !== "lotus-workbench.unused-code-baseline.v1") {
    throw new Error("Unused-code baseline schemaVersion is unsupported.");
  }
  if (root.tool !== "knip" || root.toolVersion !== "6.38.0") {
    throw new Error("Unused-code baseline must be bound to knip 6.38.0.");
  }
  if (!Number.isInteger(root.findingCount) || root.findingCount < 0) {
    throw new Error("Unused-code baseline.findingCount must be a non-negative integer.");
  }
  if (typeof root.identityDigest !== "string" || !/^[a-f0-9]{64}$/.test(root.identityDigest)) {
    throw new Error("Unused-code baseline.identityDigest must be a lowercase SHA-256 digest.");
  }

  const actual = normalizeKnipIssues(report);
  const identityDigest = createHash("sha256").update(actual.join("\n")).digest("hex");
  if (actual.length !== root.findingCount || identityDigest !== root.identityDigest) {
    const sample = actual.slice(0, 20).map((signature) => `- ${signature}`).join("\n");
    throw new Error(
      `Unused-code governance failed: measured ${actual.length} finding(s) with digest ${identityDigest}; ` +
        `the baseline requires ${root.findingCount} and ${root.identityDigest}. ` +
        "Fix newly unused code, or ratchet scripts/quality/unused-code-baseline.v1.json after reviewed cleanup.\n" +
        `Current inventory sample:\n${sample}`,
    );
  }

  return { count: actual.length, identityDigest };
}

export function runKnipProductionInventory(repoRoot = process.cwd()) {
  const executable = join(repoRoot, "node_modules", "knip", "bin", "knip.js");
  const result = spawnSync(
    process.execPath,
    [
      executable,
      "--production",
      "--no-progress",
      "--reporter",
      "json",
      "--no-exit-code",
      "--include",
      "files,exports,types",
    ],
    { cwd: repoRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Knip inventory failed with exit ${result.status}: ${result.stderr.trim()}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Knip inventory did not return JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function checkUnusedCode({
  repoRoot = process.cwd(),
  baselinePath = DEFAULT_BASELINE_PATH,
} = {}) {
  const baseline = JSON.parse(readFileSync(resolve(repoRoot, baselinePath), "utf8"));
  return validateUnusedCodeBaseline({
    report: runKnipProductionInventory(repoRoot),
    baseline,
  });
}

function main() {
  try {
    const result = checkUnusedCode();
    console.log(
      `Unused-code governance passed: ${result.count} exact production-graph finding(s) match the ratcheting baseline.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
