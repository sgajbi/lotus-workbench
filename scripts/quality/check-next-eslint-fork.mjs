import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const NEXT_RULE_NAMES = Object.freeze([
  "google-font-display",
  "google-font-preconnect",
  "inline-script-id",
  "next-script-for-ga",
  "no-assign-module-variable",
  "no-async-client-component",
  "no-before-interactive-script-outside-document",
  "no-css-tags",
  "no-document-import-in-page",
  "no-duplicate-head",
  "no-head-element",
  "no-head-import-in-document",
  "no-html-link-for-pages",
  "no-img-element",
  "no-page-custom-font",
  "no-script-component-in-head",
  "no-styled-jsx-in-document",
  "no-sync-scripts",
  "no-title-in-document-head",
  "no-typos",
  "no-unwanted-polyfillio"
]);
const UPSTREAM_FILE_VECTOR = "deb026e305c96360e141e48f16187c6b165f0635e39507485fe588e03f13bcab";
const LICENSE_HASH = "ee765244e2d59f5234d474f62e0766fa0c8b99af967fdd4c0cb8dcb0c76ea224";
const RESOLVER_HASH = "e32845937457f72c5b011315d318efb2aa34d5060313dbc1062bd20891fce439";
const UPSTREAM_INTEGRITY = "sha512-dAzOqZQCAOgIq5yQpsuMBZcwxK0AtzGqHMQpxNWYLQlvf79rsP3SDwdGPNQC4ySaMSihOQXMO/VXubQ3JWW+3A==";

function requireCondition(valid, message) {
  if (!valid) throw new Error("Next ESLint fork: " + message);
}
function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
function listFiles(root, relative = "") {
  return readdirSync(join(root, relative), { withFileTypes: true }).flatMap((entry) => {
    const path = relative ? relative + "/" + entry.name : entry.name;
    requireCondition(!entry.isSymbolicLink(), "symbolic artifact entry refused: " + path);
    return entry.isDirectory() ? listFiles(root, path) : [path];
  }).sort();
}

export function verifyNextEslintFork(root, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const provenance = JSON.parse(readFileSync(join(root, "UPSTREAM-PROVENANCE.json"), "utf8"));
  const upstream = provenance.upstream;
  requireCondition(provenance.schemaVersion === 1 && provenance.packageIdentity === "@lotus/eslint-plugin-next" &&
    provenance.packageVersion === "15.5.25-lotus.1", "unknown schema/package identity");
  requireCondition(upstream?.name === "@next/eslint-plugin-next" && upstream.version === "15.5.25" &&
    upstream.tarball === "https://registry.npmjs.org/@next/eslint-plugin-next/-/eslint-plugin-next-15.5.25.tgz" &&
    upstream.integrity === UPSTREAM_INTEGRITY && upstream.sourceCommit === "013ee1d2f25326197453d129430a6da83b86426d" &&
    upstream.licenseBlob === "5948ee9bd0de5064423688a2967ab3111c2658ed" &&
    upstream.transpilationReproduced === false, "upstream provenance drift");
  const maintenance = provenance.maintenance;
  requireCondition(/^\d{4}-\d{2}-\d{2}$/.test(today) && maintenance?.owner === "workbench-architecture-maintainers" &&
    maintenance.reviewedOn === "2026-10-04" && maintenance.nextReviewBy === "2026-10-14" &&
    maintenance.supportEndsOn === "2026-10-21" &&
    maintenance.exitTrigger === "fixed-supported-upstream-or-supported-next16-migration" &&
    today <= maintenance.nextReviewBy && maintenance.nextReviewBy < maintenance.supportEndsOn, "owner review expired or drifted");
  requireCondition(provenance.modifiedPath === "dist/utils/get-root-dirs.js" &&
    provenance.licenseSha256 === LICENSE_HASH, "declared modification/license drift");
  const files = provenance.files;
  requireCondition(Array.isArray(files) && files.length === 52, "missing file vector");
  const expectedPaths = [
    "dist/index.js", "dist/index.d.ts",
    ...NEXT_RULE_NAMES.flatMap((name) => ["dist/rules/" + name + ".js", "dist/rules/" + name + ".d.ts"]),
    ...["define-rule", "get-root-dirs", "node-attributes", "url"].flatMap((name) => ["dist/utils/" + name + ".js", "dist/utils/" + name + ".d.ts"]),
  ].sort();
  requireCondition(JSON.stringify(files.map((file) => file.path).sort()) === JSON.stringify(expectedPaths), "duplicate/unknown/missing declared files");
  requireCondition(digest(files.map((file) => file.path + ":" + file.upstreamSha256).join("\n")) === UPSTREAM_FILE_VECTOR, "published file vector drift");
  for (const file of files) {
    const expectedHash = file.path === provenance.modifiedPath ? RESOLVER_HASH : file.upstreamSha256;
    requireCondition(file.sha256 === expectedHash, "declared hash drift: " + file.path);
    const absolute = join(root, file.path);
    requireCondition(lstatSync(absolute).isFile() && digest(readFileSync(absolute)) === expectedHash, "artifact hash mismatch: " + file.path);
  }
  requireCondition(digest(readFileSync(join(root, "LICENSE"))) === LICENSE_HASH, "license mismatch");
  const expectedPackageFiles = [...expectedPaths, "package.json", "LICENSE", "README.md", "UPSTREAM-PROVENANCE.json"].sort();
  requireCondition(JSON.stringify(listFiles(root)) === JSON.stringify(expectedPackageFiles), "unlisted package file");
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  requireCondition(pkg.name === provenance.packageIdentity && pkg.version === provenance.packageVersion &&
    pkg.private === true && pkg.main === "dist/index.js" && pkg.types === "dist/index.d.ts" && pkg.license === "MIT" &&
    Object.keys(pkg.dependencies ?? {}).length === 0 && Object.keys(pkg.devDependencies ?? {}).length === 0 &&
    Object.keys(pkg.scripts ?? {}).length === 0, "package wiring/dependency drift");
  return { rules: NEXT_RULE_NAMES.length, files: files.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = verifyNextEslintFork(resolve("tools/eslint-plugin-next"));
    process.stdout.write("Next ESLint fork provenance passed: " + result.rules + " rules, " + result.files + " files.\n");
  } catch (error) {
    process.stderr.write(error.message + "\n");
    process.exitCode = 1;
  }
}
