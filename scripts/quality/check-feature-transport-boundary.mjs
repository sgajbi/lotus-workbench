import { readFileSync, readdirSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const RAW_FETCH_PATTERN = /\bfetch\s*\(/g;

export const RAW_FEATURE_TRANSPORT_BASELINE = Object.freeze({
  "src/features/analytics-observability/metrics.ts": 1,
  "src/features/domain-products/api.ts": 1,
  "src/features/intake/api.ts": 1,
  "src/features/intake/lookups-api.ts": 1,
  "src/features/platform-capabilities/api.ts": 1,
  "src/features/workbench/api-client.ts": 2,
});

function defaultRepoRoot() {
  return resolve(fileURLToPath(new URL("../..", import.meta.url)));
}

function isMainModule() {
  return (
    Boolean(process.argv[1]) &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  );
}

function collectSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const entryPath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        return collectSourceFiles(entryPath);
      }
      return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [entryPath] : [];
    });
}

function countRawFetches(contents) {
  return [...contents.matchAll(RAW_FETCH_PATTERN)].length;
}

export function findFeatureTransportBoundaryViolations({
  repoRoot = defaultRepoRoot(),
  sourceRoot = resolve(repoRoot, "src", "features"),
  baseline = RAW_FEATURE_TRANSPORT_BASELINE,
} = {}) {
  const observed = new Map(
    collectSourceFiles(sourceRoot)
      .map((filePath) => [
        relative(repoRoot, filePath).replaceAll("\\", "/"),
        countRawFetches(readFileSync(filePath, "utf8")),
      ])
      .filter(([, count]) => count > 0),
  );
  const files = new Set([...Object.keys(baseline), ...observed.keys()]);

  return [...files].sort().flatMap((file) => {
    const expected = baseline[file] ?? 0;
    const actual = observed.get(file) ?? 0;
    if (actual === expected) {
      return [];
    }
    return [{ file, expected, actual }];
  });
}

export function validateFeatureTransportBoundary(options) {
  const violations = findFeatureTransportBoundaryViolations(options);
  if (violations.length === 0) {
    return;
  }

  const detail = violations
    .map(
      ({ file, expected, actual }) =>
        `- ${file}: expected ${expected} raw fetch call(s), observed ${actual}`,
    )
    .join("\n");
  throw new Error(
    `Feature transport boundary violations:\n${detail}\n` +
      "Use the governed Workbench transport. If an existing exception was removed, ratchet the baseline in the same change.",
  );
}

if (isMainModule()) {
  validateFeatureTransportBoundary();
  console.log("Feature transport boundary gate passed.");
}
