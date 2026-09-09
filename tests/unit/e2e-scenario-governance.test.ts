import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const checker = resolve(
  process.cwd(),
  "scripts/quality/check-e2e-scenario-governance.mjs",
);
const registryPath = resolve(
  process.cwd(),
  "scripts/testing/e2e-scenario-registry.json",
);
const packagePath = resolve(process.cwd(), "package.json");
const prWorkflowPath = resolve(
  process.cwd(),
  ".github/workflows/pr-merge-gate.yml",
);
const temporaryDirectories: string[] = [];
const GOVERNANCE_PROCESS_TIMEOUT_MS = 12_000;
const GOVERNANCE_TEST_TIMEOUT_MS = 15_000;

interface MutableRegistry {
  families: {
    portfolio: {
      scenarios: {
        cashflow: {
          expected_tests: string[];
        };
      };
    };
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("E2E scenario governance gate", () => {
  it("accepts the complete repository registry", () => {
    const result = runChecker();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("26 scenarios");
    expect(result.stdout).toContain("70 registered executions");
  }, GOVERNANCE_TEST_TIMEOUT_MS);

  it("fails when a registered test no longer exists", () => {
    const registry = readRegistry();
    registry.families.portfolio.scenarios.cashflow.expected_tests[0] =
      "deleted cashflow proof";
    const result = runChecker({ registry: writeTemporaryRegistry(registry) });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("registered test is absent");
    expect(result.stderr).toContain("deleted cashflow proof");
  }, GOVERNANCE_TEST_TIMEOUT_MS);

  it("fails when a fixture-gated test falls outside every registered scenario", () => {
    const registry = readRegistry();
    registry.families.portfolio.scenarios.cashflow.expected_tests =
      registry.families.portfolio.scenarios.cashflow.expected_tests.filter(
        (title: string) =>
          title !==
          "historical review stays unavailable until aggregate evidence can refresh atomically",
      );
    const result = runChecker({ registry: writeTemporaryRegistry(registry) });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("fixture-gated test");
    expect(result.stderr).toContain(
      "historical review stays unavailable until aggregate evidence can refresh atomically",
    );
  }, GOVERNANCE_TEST_TIMEOUT_MS);

  it("fails closed when the source root has no registry", () => {
    const emptyRoot = mkdtempSync(resolve(tmpdir(), "workbench-empty-scenario-root-"));
    temporaryDirectories.push(emptyRoot);
    const result = runChecker({ root: emptyRoot });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Registry does not exist");
  }, GOVERNANCE_TEST_TIMEOUT_MS);

  it("fails when a scenario alias bypasses the registry with a raw grep", () => {
    const packageManifest = JSON.parse(readFileSync(packagePath, "utf8")) as {
      scripts: Record<string, string>;
    };
    packageManifest.scripts["test:e2e:portfolio:cashflow"] += " --grep cashflow";
    const result = runChecker({
      packagePath: writeTemporaryFile("package.json", packageManifest),
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("bypasses registry selection with --grep");
  }, GOVERNANCE_TEST_TIMEOUT_MS);

  it("fails when a protected workflow drops a registered family", () => {
    const workflow = readFileSync(prWorkflowPath, "utf8").replace(
      "family: [portfolio, performance, manage, reports]",
      "family: [portfolio, performance, manage]",
    );
    const result = runChecker({ prWorkflow: writeTemporaryText("workflow.yml", workflow) });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("fixture matrix must cover every registry family exactly once");
  }, GOVERNANCE_TEST_TIMEOUT_MS);

  it("fails when the required browser proof no longer depends on fixture scenarios", () => {
    const workflow = readFileSync(prWorkflowPath, "utf8").replace(
      "needs: [e2e-smoke, e2e-fixture-scenarios]",
      "needs: [e2e-smoke]",
    );
    const result = runChecker({ prWorkflow: writeTemporaryText("workflow.yml", workflow) });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("always-running browser proof gate");
  }, GOVERNANCE_TEST_TIMEOUT_MS);
});

function readRegistry(): MutableRegistry {
  return JSON.parse(readFileSync(registryPath, "utf8")) as MutableRegistry;
}

function writeTemporaryRegistry(registry: unknown): string {
  const directory = mkdtempSync(resolve(tmpdir(), "workbench-scenario-registry-"));
  temporaryDirectories.push(directory);
  const path = resolve(directory, "registry.json");
  writeFileSync(path, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  return path;
}

function writeTemporaryFile(name: string, value: unknown): string {
  return writeTemporaryText(name, `${JSON.stringify(value, null, 2)}\n`);
}

function writeTemporaryText(name: string, value: string): string {
  const directory = mkdtempSync(resolve(tmpdir(), "workbench-scenario-governance-"));
  temporaryDirectories.push(directory);
  const path = resolve(directory, name);
  writeFileSync(path, value, "utf8");
  return path;
}

function runChecker({
  root = process.cwd(),
  registry,
  packagePath,
  prWorkflow,
}: {
  root?: string;
  registry?: string;
  packagePath?: string;
  prWorkflow?: string;
} = {}) {
  const arguments_ = [checker, "--root", root];
  if (registry) {
    arguments_.push("--registry", registry);
  }
  if (packagePath) {
    arguments_.push("--package", packagePath);
  }
  if (prWorkflow) {
    arguments_.push("--pr-workflow", prWorkflow);
  }
  return spawnSync(process.execPath, arguments_, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: GOVERNANCE_PROCESS_TIMEOUT_MS,
  });
}
