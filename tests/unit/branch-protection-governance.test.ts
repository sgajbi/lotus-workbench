import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateBranchProtectionPolicy } from "../../scripts/quality/check-branch-protection-policy-document.mjs";

const repositoryRoot = join(__dirname, "..", "..");
type BranchProtectionPolicy = {
  repository: string;
  expected: {
    required_status_checks: { strict: boolean; checks: Array<{ context: string; app_id: number | null }> };
    required_deployments: { present: boolean; environments: string[] };
    required_pull_request_reviews: {
      present: boolean;
      dismiss_stale_reviews: boolean;
      required_approving_review_count: number;
      bypass_pull_request_allowances: Record<"users" | "teams" | "apps", string[]>;
    };
  };
  documented_exceptions: Array<Record<string, unknown>>;
};

function loadPolicy(): BranchProtectionPolicy {
  return JSON.parse(
    readFileSync(join(repositoryRoot, "quality", "branch_protection_policy.v1.json"), "utf8"),
  ) as BranchProtectionPolicy;
}

describe("branch protection governance", () => {
  it("accepts the checked-in Workbench policy and its five app-bound merge checks", () => {
    const policy = loadPolicy();

    expect(validateBranchProtectionPolicy(policy)).toEqual([]);
    expect(policy.expected.required_status_checks.checks).toHaveLength(5);
    expect(
      policy.expected.required_status_checks.checks.every((check) => check.app_id === 15368),
    ).toBe(true);
    expect(policy.expected.required_deployments).toEqual({ present: false, environments: [] });
  });

  it("rejects a policy with no required checks", () => {
    const policy = loadPolicy();
    policy.expected.required_status_checks.checks = [];

    expect(validateBranchProtectionPolicy(policy)).toEqual(
      expect.arrayContaining([expect.stringContaining("non-empty list")]),
    );
  });

  it("rejects removal of the single-developer zero-approval exception", () => {
    const policy = loadPolicy();
    policy.documented_exceptions = [];

    expect(validateBranchProtectionPolicy(policy)).toEqual(
      expect.arrayContaining([expect.stringContaining("must have a documented exception")]),
    );
  });

  it.each([
    ["enforce_admins", false],
    ["required_linear_history", false],
    ["allow_force_pushes", true],
    ["allow_deletions", true],
    ["required_conversation_resolution", false],
  ] as const)("rejects undocumented weak posture %s=%s", (field, value) => {
    const policy = loadPolicy() as BranchProtectionPolicy & {
      expected: Record<string, unknown>;
    };
    policy.expected[field] = value;

    expect(validateBranchProtectionPolicy(policy)).toEqual(
      expect.arrayContaining([expect.stringContaining(`weak posture expected.${field}`)]),
    );
  });

  it("rejects an undocumented non-strict status-check policy", () => {
    const policy = loadPolicy();
    policy.expected.required_status_checks.strict = false;

    expect(validateBranchProtectionPolicy(policy)).toEqual(
      expect.arrayContaining([expect.stringContaining("required_status_checks.strict")]),
    );
  });

  it.each(["present", "dismiss_stale_reviews"] as const)(
    "rejects undocumented weak review posture %s=false",
    (field) => {
      const policy = loadPolicy();
      policy.expected.required_pull_request_reviews[field] = false;

      expect(validateBranchProtectionPolicy(policy)).toEqual(
        expect.arrayContaining([
          expect.stringContaining(`required_pull_request_reviews.${field}`),
        ]),
      );
    },
  );

  it("rejects an unpinned required check without a documented exception", () => {
    const policy = loadPolicy();
    policy.expected.required_status_checks.checks[0].app_id = null;

    expect(validateBranchProtectionPolicy(policy)).toEqual(
      expect.arrayContaining([expect.stringContaining("app_id null must have a documented exception")]),
    );
  });

  it("rejects an inconsistent required-deployment declaration", () => {
    const policy = loadPolicy();
    policy.expected.required_deployments = { present: false, environments: ["production"] };

    expect(validateBranchProtectionPolicy(policy)).toEqual(
      expect.arrayContaining([expect.stringContaining("present must match")]),
    );
  });

  it.each(["users", "teams", "apps"] as const)(
    "rejects an undocumented %s review bypass",
    (category) => {
      const policy = loadPolicy();
      policy.expected.required_pull_request_reviews.bypass_pull_request_allowances[category] = [
        "unreviewed-principal",
      ];

      expect(validateBranchProtectionPolicy(policy)).toEqual(
        expect.arrayContaining([expect.stringContaining(`non-empty required_pull_request_reviews.bypass_pull_request_allowances.${category}`)]),
      );
    },
  );

  it("refuses to validate a policy copied from another repository", () => {
    const policy = loadPolicy();
    policy.repository = "sgajbi/lotus-gateway";

    expect(validateBranchProtectionPolicy(policy)).toEqual(
      expect.arrayContaining([expect.stringContaining("repository must identify")]),
    );
  });

  it.each(["", "release", 42])(
    "refuses to redirect the protection audit away from main with %j",
    (protectedBranch) => {
      const policy = loadPolicy() as BranchProtectionPolicy & { protected_branch: unknown };
      policy.protected_branch = protectedBranch;

      expect(validateBranchProtectionPolicy(policy)).toEqual(
        expect.arrayContaining([expect.stringContaining("protected_branch must be main")]),
      );
    },
  );

  it("keeps the daily audit fail-closed without widening the default workflow token", () => {
    const workflow = readFileSync(
      join(repositoryRoot, ".github", "workflows", "main-gate-coverage-audit.yml"),
      "utf8",
    );

    expect(workflow).toMatch(
      /python scripts\/audit_main_gate_coverage\.py \\\r?\n\s+--baseline 43f9335b8ca5e903a0fab848b248d54132db0ad6 \\\r?\n\s+--fail-on-gap/,
    );
    expect(workflow).not.toContain("--limit");
    expect(workflow).toContain("if: ${{ !cancelled() }}");
    expect(workflow).toContain("GH_TOKEN: ${{ secrets.LOTUS_AUTOMERGE_TOKEN }}");
    expect(workflow).toMatch(
      /node scripts\/quality\/check-branch-protection-policy-document\.mjs\r?\n\s+python scripts\/check_branch_protection_policy\.py/,
    );
    expect(workflow).not.toContain("continue-on-error");
    expect(workflow).toMatch(/permissions:\r?\n  contents: read\r?\n  actions: read/);
  });

  it("runs policy shape validation in the blocking repository lint chain", () => {
    const packageManifest = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageManifest.scripts["quality:branch-protection"]).toBe(
      "node scripts/quality/check-branch-protection-policy-document.mjs",
    );
    expect(packageManifest.scripts.lint).toMatch(/^npm run quality:branch-protection &&/);
  });
});
