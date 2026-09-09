import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

interface ScenarioDefinition {
  fixture_value: string;
  spec: string;
  expected_tests: string[];
  focuses?: Record<string, string[]>;
}

interface ScenarioFamily {
  fixture_owner: string;
  fixture_environment: string;
  fixture_port_environment: string;
  workbench_port_environment: string;
  default_fixture_port: number;
  default_workbench_port: number;
  scenarios: Record<string, ScenarioDefinition>;
}

interface ScenarioRegistry {
  schema_version: string;
  families: Record<string, ScenarioFamily>;
}

const registry = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "scripts/testing/e2e-scenario-registry.json"),
    "utf8",
  ),
) as ScenarioRegistry;

describe("E2E fixture scenario registry", () => {
  it("owns the four governed browser-proof families and 26 unique scenarios", () => {
    expect(registry.schema_version).toBe("1.0.0");
    expect(Object.keys(registry.families)).toEqual([
      "portfolio",
      "performance",
      "manage",
      "reports",
    ]);
    expect(
      Object.values(registry.families).reduce(
        (total, family) => total + Object.keys(family.scenarios).length,
        0,
      ),
    ).toBe(26);
  });

  it("requires a non-empty, duplicate-free exact test set for every scenario", () => {
    for (const [familyName, family] of Object.entries(registry.families)) {
      expect(family.fixture_owner, familyName).not.toBe("");
      expect(family.fixture_environment, familyName).toMatch(/_E2E_FIXTURE$/);
      expect(family.default_fixture_port, familyName).toBeGreaterThanOrEqual(1024);
      expect(family.default_workbench_port, familyName).toBeGreaterThanOrEqual(1024);
      expect(family.default_fixture_port, familyName).not.toBe(
        family.default_workbench_port,
      );

      for (const [scenarioName, scenario] of Object.entries(family.scenarios)) {
        expect(scenario.fixture_value, `${familyName}/${scenarioName}`).not.toBe("");
        expect(scenario.spec, `${familyName}/${scenarioName}`).toMatch(
          /^tests\/e2e\/.+\.spec\.ts$/,
        );
        expect(scenario.expected_tests.length, `${familyName}/${scenarioName}`).toBeGreaterThan(0);
        expect(
          new Set(scenario.expected_tests).size,
          `${familyName}/${scenarioName}`,
        ).toBe(scenario.expected_tests.length);

        for (const [focusName, focusedTests] of Object.entries(
          scenario.focuses ?? {},
        )) {
          expect(focusedTests.length, `${familyName}/${scenarioName}/${focusName}`).toBeGreaterThan(0);
          expect(
            focusedTests.every((title) => scenario.expected_tests.includes(title)),
            `${familyName}/${scenarioName}/${focusName}`,
          ).toBe(true);
        }
      }
    }
  });

  it("registers the fail-closed historical-review assertion as cashflow proof", () => {
    const cashflow = registry.families.portfolio.scenarios.cashflow.expected_tests;
    expect(cashflow).toContain(
      "historical review stays unavailable until aggregate evidence can refresh atomically",
    );
  });

  it("banks the measured fixture execution baseline per family", () => {
    const expectedExecutions = Object.fromEntries(
      Object.entries(registry.families).map(([familyName, family]) => [
        familyName,
        Object.values(family.scenarios).reduce(
          (total, scenario) => total + scenario.expected_tests.length,
          0,
        ),
      ]),
    );

    expect(expectedExecutions).toEqual({
      portfolio: 15,
      performance: 27,
      manage: 8,
      reports: 20,
    });
  });
});
