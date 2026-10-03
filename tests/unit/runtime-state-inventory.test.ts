import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import {
  scanRuntimeStateHolders,
  scanRuntimeStateSource,
  validateRuntimeStateInventory,
} from "../../scripts/quality/check-runtime-state-inventory.mjs";

const root = join(__dirname, "..", "..");
// This repository-wide scanner runs in its own CI phase before parallel
// application coverage. Keep a bounded timeout so performance regressions stay
// visible without letting worker contention suppress all architecture checks.
const BASELINE_SCAN_TIMEOUT_MS = 30_000;

function loadBaselineEvidence() {
  const discoveredStateHolders = scanRuntimeStateHolders({ root });
  const sourceFiles = Object.fromEntries(
    discoveredStateHolders
      .map(({ file }) => file)
      .filter((file, index, files) => files.indexOf(file) === index)
      .map((file) => [file, readFileSync(join(root, file), "utf8")]),
  );
  return {
    inventory: JSON.parse(
      readFileSync(
        join(root, "docs/architecture/workbench-runtime-state-inventory.v1.json"),
        "utf8",
      ),
    ),
    schema: JSON.parse(
      readFileSync(
        join(root, "docs/architecture/workbench-runtime-state-inventory.v1.schema.json"),
        "utf8",
      ),
    ),
    sourceFiles,
    nextConfig: readFileSync(join(root, "next.config.mjs"), "utf8"),
    discoveredStateHolders,
    today: "2026-08-10",
  };
}

let baselineEvidence: ReturnType<typeof loadBaselineEvidence>;

beforeAll(() => {
  baselineEvidence = loadBaselineEvidence();
}, BASELINE_SCAN_TIMEOUT_MS);

function loadEvidence() {
  return structuredClone(baselineEvidence);
}

describe("runtime state inventory", () => {
  it("reconciles every module-scope state holder and current framework posture", () => {
    expect(validateRuntimeStateInventory(loadEvidence())).toEqual([]);
  });

  it("rejects an unreviewed process-local cache", () => {
    const evidence = loadEvidence();
    evidence.discoveredStateHolders.push({
      file: "src/features/example.ts",
      symbol: "businessCache",
    });

    expect(validateRuntimeStateInventory(evidence)).toContain(
      "unreviewed module-scope runtime state src/features/example.ts:businessCache",
    );
  });

  it.each([
    ["property assignment", "const cache = {}; cache.portfolio = result;", "cache"],
    ["element assignment", "const cache = {}; cache[key] = result;", "cache"],
    ["array mutation", "const entries = []; entries.push(result);", "entries"],
    ["custom cache mutation", "const cache = createCache(); cache.set(key, result);", "cache"],
    ["Object mutation", "const cache = {}; Object.assign(cache, result);", "cache"],
    ["nested property increment", "const metrics = { counts: {} }; metrics.counts[key]++;", "metrics"],
  ])("discovers const-backed runtime state through %s", (_name, source, symbol) => {
    expect(
      scanRuntimeStateSource({ source, file: "src/features/example.ts" }),
    ).toContainEqual({ file: "src/features/example.ts", symbol });
  });

  it("does not classify read-only const objects and arrays as mutable state", () => {
    expect(
      scanRuntimeStateSource({
        source: "const labels = ['Ready']; const copy = labels.map((label) => label);",
        file: "src/features/example.ts",
      }),
    ).toEqual([]);
  });

  it.each([
    [
      "function-local variable",
      "const cache = Object.freeze({}); function update() { const cache = []; cache.push('local'); }",
    ],
    [
      "function parameter",
      "const cache = Object.freeze({}); function update(cache) { cache.push('local'); }",
    ],
    [
      "catch binding",
      "const cache = Object.freeze({}); try { update(); } catch (cache) { cache.push('local'); }",
    ],
    [
      "block-local function declaration",
      "const cache = Object.freeze({}); { function cache() {} cache.entries = []; }",
    ],
  ])("does not attribute a shadowed %s mutation to module state", (_name, source) => {
    expect(
      scanRuntimeStateSource({ source, file: "src/features/example.ts" }),
    ).toEqual([]);
  });

  it("still detects a module mutation from inside a nested lexical scope", () => {
    expect(
      scanRuntimeStateSource({
        source:
          "const cache = Object.freeze({ entries: [] }); function update() { cache.entries.push('module'); }",
        file: "src/features/example.ts",
      }),
    ).toContainEqual({ file: "src/features/example.ts", symbol: "cache" });
  });

  it.each([
    [
      "direct local alias",
      "const cache = Object.freeze({}); function update() { const ref = cache; ref.value = 1; }",
    ],
    [
      "chained property alias",
      "const cache = Object.freeze({ entries: [] }); function update() { const entries = cache.entries; const ref = entries; ref.push('module'); }",
    ],
  ])("detects a module mutation through a %s", (_name, source) => {
    expect(
      scanRuntimeStateSource({ source, file: "src/features/example.ts" }),
    ).toContainEqual({ file: "src/features/example.ts", symbol: "cache" });
  });

  it("does not follow a shadowed local alias to a same-named module binding", () => {
    expect(
      scanRuntimeStateSource({
        source:
          "const cache = Object.freeze({}); function update() { const cache = {}; const ref = cache; ref.value = 1; }",
        file: "src/features/example.ts",
      }),
    ).toEqual([]);
  });

  it("invalidates a local alias when its binding is reassigned", () => {
    expect(
      scanRuntimeStateSource({
        source:
          "const cache = Object.freeze({}); function update() { let ref = cache; ref = {}; ref.value = 1; }",
        file: "src/features/example.ts",
      }),
    ).toEqual([]);
  });

  it("does not treat local alias increment as mutation of its prior referent", () => {
    expect(
      scanRuntimeStateSource({
        source:
          "const count = 1; function update() { let localCount = count; localCount++; }",
        file: "src/features/example.ts",
      }),
    ).toEqual([]);
  });

  it("retains module mutation evidence that occurs before local alias reassignment", () => {
    expect(
      scanRuntimeStateSource({
        source:
          "const cache = Object.freeze({}); function update() { let ref = cache; ref.value = 1; ref = {}; }",
        file: "src/features/example.ts",
      }),
    ).toContainEqual({ file: "src/features/example.ts", symbol: "cache" });
  });

  it("conservatively retains a module alias across conditional reassignment", () => {
    expect(
      scanRuntimeStateSource({
        source:
          "const cache = Object.freeze({}); function update(reset) { let ref = cache; if (reset) { ref = {}; } ref.value = 1; }",
        file: "src/features/example.ts",
      }),
    ).toContainEqual({ file: "src/features/example.ts", symbol: "cache" });
  });

  it.each([
    [
      "conditional initializer",
      "const cache = Object.freeze({}); function update(useCache) { const ref = useCache ? cache : {}; ref.value = 1; }",
    ],
    [
      "short-circuit reassignment",
      "const cache = Object.freeze({}); function update(useCache) { let ref = {}; ref = useCache && cache; ref.value = 1; }",
    ],
  ])("follows module aliases through a %s", (_name, source) => {
    expect(
      scanRuntimeStateSource({ source, file: "src/features/example.ts" }),
    ).toContainEqual({ file: "src/features/example.ts", symbol: "cache" });
  });

  it.each([
    [
      "arrow getter",
      "const cache = createCache(); const getCache = () => cache; getCache().set('key', 'value');",
    ],
    [
      "function getter",
      "const cache = createCache(); function getCache() { return cache; } getCache().set('key', 'value');",
    ],
  ])("traces state mutation through a %s", (_name, source) => {
    expect(
      scanRuntimeStateSource({ source, file: "src/features/example.ts" }),
    ).toContainEqual({ file: "src/features/example.ts", symbol: "cache" });
  });

  it("skips bodyless overload signatures and inspects their implementation", () => {
    expect(
      scanRuntimeStateSource({
        source:
          "const cache = createCache(); function getCache(key: string): object; function getCache(): object { return cache; } getCache().set('key', 'value');",
        file: "src/features/example.ts",
      }),
    ).toContainEqual({ file: "src/features/example.ts", symbol: "cache" });
  });

  it("discovers a mutated imported singleton binding", () => {
    expect(
      scanRuntimeStateSource({
        source: "import { cache as sharedCache } from './state'; sharedCache.set('key', 'value');",
        file: "src/features/example.ts",
      }),
    ).toContainEqual({
      file: "src/features/example.ts",
      symbol: "sharedCache",
    });
  });

  it("does not classify a type-only import as runtime state", () => {
    expect(
      scanRuntimeStateSource({
        source: "import type { Cache } from './state'; type LocalCache = Cache;",
        file: "src/features/example.ts",
      }),
    ).toEqual([]);
  });

  it("discovers mutated module state introduced through nested destructuring", () => {
    expect(
      scanRuntimeStateSource({
        source:
          "const { stores: { cache }, entries: [firstEntry] } = createStores(); cache.set('key', firstEntry);",
        file: "src/features/example.ts",
      }),
    ).toContainEqual({ file: "src/features/example.ts", symbol: "cache" });
  });

  it.each([
    [
      "function object",
      "function handler() {} handler.cache = {};",
      "handler",
    ],
    [
      "class object",
      "class Cache {} Cache.entries = new Map();",
      "Cache",
    ],
    [
      "class static field",
      "class Cache { static entries = new Map(); }",
      "Cache",
    ],
    [
      "class-expression static field",
      "const Cache = class { static entries = []; static add(value) { this.entries.push(value); } };",
      "Cache",
    ],
    [
      "readonly static array",
      "class Cache { static readonly entries: string[] = []; }",
      "Cache",
    ],
    [
      "readonly static object",
      "class Cache { static readonly entries = { count: 0 }; }",
      "Cache",
    ],
  ])("discovers process-local state held on a module %s", (_name, source, symbol) => {
    expect(
      scanRuntimeStateSource({ source, file: "src/features/example.ts" }),
    ).toContainEqual({ file: "src/features/example.ts", symbol });
  });

  it.each([
    [
      "object destructuring",
      "const cache = Object.freeze({ entries: [] }); function update() { const { entries } = cache; entries.push('value'); }",
    ],
    [
      "array destructuring",
      "const cache = Object.freeze({ entries: [[]] }); function update() { const [entries] = cache.entries; entries.push('value'); }",
    ],
  ])("traces a local alias created through %s", (_name, source) => {
    expect(
      scanRuntimeStateSource({ source, file: "src/features/example.ts" }),
    ).toContainEqual({ file: "src/features/example.ts", symbol: "cache" });
  });

  it("does not trace a destructured local value to a shadowed module binding", () => {
    expect(
      scanRuntimeStateSource({
        source:
          "const cache = Object.freeze({}); function update() { const local = { entries: [] }; const { entries } = local; entries.push('value'); }",
        file: "src/features/example.ts",
      }),
    ).toEqual([]);
  });

  it.each([
    [
      "object destructuring assignment",
      "const cache = Object.freeze({ entries: [] }); function update() { let ref; ({ entries: ref } = cache); ref.push('value'); }",
    ],
    [
      "array destructuring assignment",
      "const cache = Object.freeze({ entries: [[]] }); function update() { let ref; [ref] = cache.entries; ref.push('value'); }",
    ],
  ])("traces a local alias created through %s", (_name, source) => {
    expect(
      scanRuntimeStateSource({ source, file: "src/features/example.ts" }),
    ).toContainEqual({ file: "src/features/example.ts", symbol: "cache" });
  });

  it("does not classify a static method or readonly primitive as mutable state", () => {
    expect(
      scanRuntimeStateSource({
        source:
          "class Formatter { static readonly label = 'Ready'; static format() { return Formatter.label; } }",
        file: "src/features/example.ts",
      }),
    ).toEqual([]);
  });

  it("does not classify a benign class expression as mutable state", () => {
    expect(
      scanRuntimeStateSource({
        source:
          "const Formatter = class { static readonly label = 'Ready'; static format() { return Formatter.label; } };",
        file: "src/features/example.ts",
      }),
    ).toEqual([]);
  });

  it("does not classify a frozen readonly static object as mutable state", () => {
    expect(
      scanRuntimeStateSource({
        source:
          "class Formatter { static readonly labels = Object.freeze({ ready: 'Ready' }); }",
        file: "src/features/example.ts",
      }),
    ).toEqual([]);
  });

  it("rejects a stale declaration that could hide dead state guidance", () => {
    const evidence = loadEvidence();
    evidence.discoveredStateHolders = evidence.discoveredStateHolders.filter(
      ({ symbol }) => symbol !== "rowSequence",
    );

    expect(validateRuntimeStateInventory(evidence)).toContain(
      "stale runtime state declaration src/features/intake/draft.ts:rowSequence",
    );
  });

  it.each([
    ["Server Actions", '"use server";'],
    ["Next data cache", "unstable_cache(() => sourceRead())"],
    ["on-demand revalidation", 'revalidateTag("portfolio")'],
    ["explicit fetch cache", 'fetch(url, { cache: "force-cache" })'],
    ["route segment revalidation", "export const revalidate = 60;"],
    ["static route segment", 'export const dynamic = "force-static";'],
    ["route segment fetch cache", 'export const fetchCache = "force-cache";'],
  ])("rejects unreviewed %s", (_name, addition) => {
    const evidence = loadEvidence();
    evidence.sourceFiles["src/apps/portfolio/api.ts"] += `\n${addition}\n`;

    expect(validateRuntimeStateInventory(evidence)).toEqual(
      expect.arrayContaining([expect.stringContaining("unreviewed")]),
    );
  });

  it("rejects server use of any declared browser response cache", () => {
    const evidence = loadEvidence();
    evidence.inventory.stateHolders.push({
      id: "example-browser-response-cache",
      file: "src/features/example-cache.ts",
      symbols: ["responseCache"],
      classification: "browser_guarded_cache",
      purpose: "Test-only browser response reuse.",
      bounds: "One bounded browser realm.",
      replicaBehavior: "Independent browser-local cache.",
      businessAuthority: false,
      sessionAuthority: false,
    });
    evidence.discoveredStateHolders.push({
      file: "src/features/example-cache.ts",
      symbol: "responseCache",
    });
    evidence.sourceFiles["src/features/example-cache.ts"] =
      "const responseCache = createCache(); responseCache.set('key', 'value');";

    expect(validateRuntimeStateInventory(evidence)).toContain(
      "browser-guarded cache example-browser-response-cache must fail closed outside the client target",
    );
  });

  it("keeps Portfolio source freshness free of module-owned mutable caches", () => {
    expect(
      baselineEvidence.discoveredStateHolders.filter(({ file }) =>
        [
          "src/apps/portfolio/api.ts",
          "src/apps/portfolio/components/portfolio-workspace-client.tsx",
        ].includes(file),
      ),
    ).toEqual([]);
  });

  it("rejects removal of rolling deployment identity protection", () => {
    const evidence = loadEvidence();
    evidence.nextConfig = evidence.nextConfig
      .replace(/const deploymentId =[\s\S]*?;\r?\n\r?\n/, "")
      .replace(/^\s*deploymentId,\r?\n/m, "");

    expect(validateRuntimeStateInventory(evidence)).toContain(
      "Next configuration must bind deploymentId and embedded build identity to WORKBENCH_DEPLOYMENT_ID for rolling-version protection",
    );
  });

  it("rejects expired state review and remediation exceptions", () => {
    const evidence = loadEvidence();
    evidence.inventory.nextReviewBy = "2026-09-30";
    evidence.inventory.stateHolders[0].temporaryException = {
      issue: 619,
      expiresOn: "2026-09-15",
      requiredRemediation: "Remove the test exception.",
    };
    evidence.today = "2026-10-01";

    expect(validateRuntimeStateInventory(evidence)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("inventory review expired"),
        expect.stringContaining("performance-rolling-measure-lookup expired"),
      ]),
    );
  });

  it("executes the complete schema before semantic checks", () => {
    const evidence = loadEvidence();
    evidence.inventory.stateHolders[0].businessAuthority = true;

    expect(validateRuntimeStateInventory(evidence)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("runtime state schema"),
        expect.stringContaining("must be equal to constant"),
      ]),
    );
  });
});
