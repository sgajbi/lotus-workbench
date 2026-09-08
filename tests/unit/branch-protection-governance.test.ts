import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { validateBranchProtectionPolicy } from "../../scripts/quality/check-branch-protection-policy-document.mjs";

const repositoryRoot = join(__dirname, "..", "..");
type BranchProtectionPolicy = {
  repository: string;
  review_authority: {
    review_lead: string;
    mergeable_meaning: string;
    escalation: string;
  };
  expected: {
    required_status_checks: { strict: boolean; checks: Array<{ context: string; app_id: number | null }> };
    required_deployments: { present: boolean; environments: string[] };
    required_pull_request_reviews: {
      present: boolean;
      dismiss_stale_reviews: boolean;
      require_code_owner_reviews: boolean;
      require_last_push_approval: boolean;
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

  it("rejects the retired unbound status-check contexts field", () => {
    const policy = loadPolicy() as BranchProtectionPolicy & {
      expected: {
        required_status_checks: BranchProtectionPolicy["expected"]["required_status_checks"] & {
          contexts?: string[];
        };
      };
    };
    policy.expected.required_status_checks.contexts = ["PR Merge Gate / Workflow Lint"];

    expect(validateBranchProtectionPolicy(policy)).toEqual(
      expect.arrayContaining([expect.stringContaining("contexts is retired")]),
    );
  });

  it("accepts an exception documenting an omitted required context", () => {
    const policy = loadPolicy();
    policy.documented_exceptions.push({
      field: "required_status_checks.checks",
      value: "PR Merge Gate / Deliberately Omitted Control",
      reason: "temporary owner migration",
      compensating_controls: "manual exact-head verification",
      retires_when: "the owning workflow is app-bound",
    });

    expect(validateBranchProtectionPolicy(policy)).toEqual([]);
  });

  it("retires an omitted-context exception when that context becomes required", () => {
    const policy = loadPolicy();
    const context = "PR Merge Gate / Deliberately Omitted Control";
    policy.expected.required_status_checks.checks.push({ context, app_id: 15368 });
    policy.documented_exceptions.push({
      field: "required_status_checks.checks",
      value: context,
      reason: "temporary owner migration",
      compensating_controls: "manual exact-head verification",
      retires_when: "the owning workflow is app-bound",
    });

    expect(validateBranchProtectionPolicy(policy)).toEqual(
      expect.arrayContaining([expect.stringContaining("value does not match")]),
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

  it("rejects a reordered array exception that the live validator would reject", () => {
    const policy = loadPolicy();
    policy.expected.required_deployments = {
      present: true,
      environments: ["production-primary", "production-secondary"],
    };
    policy.documented_exceptions.push({
      field: "required_deployments.environments",
      value: ["production-secondary", "production-primary"],
      reason: "ordered deployment evidence is pending",
      compensating_controls: "manual environment verification",
      retires_when: "both environments are governed",
    });

    expect(validateBranchProtectionPolicy(policy)).toEqual(
      expect.arrayContaining([expect.stringContaining("value does not match")]),
    );
  });

  it("rejects a documented exception for a strong policy value", () => {
    const policy = loadPolicy();
    policy.documented_exceptions.push({
      field: "enforce_admins",
      value: true,
      reason: "not a weakness",
      compensating_controls: "none",
      retires_when: "never",
    });

    expect(validateBranchProtectionPolicy(policy)).toEqual(
      expect.arrayContaining([expect.stringContaining("does not describe its registered weak posture")]),
    );
  });

  it("rejects an exception bound to an unaudited invented field", () => {
    const policy = loadPolicy() as BranchProtectionPolicy & {
      expected: Record<string, unknown>;
    };
    policy.expected.invented_control = false;
    policy.documented_exceptions.push({
      field: "invented_control",
      value: false,
      reason: "not measured",
      compensating_controls: "none",
      retires_when: "never",
    });

    expect(validateBranchProtectionPolicy(policy)).toEqual(
      expect.arrayContaining([expect.stringContaining("unaudited field")]),
    );
  });

  it("rejects an exception for a non-GitHub review-bypass category", () => {
    const policy = loadPolicy() as BranchProtectionPolicy & {
      expected: {
        required_pull_request_reviews: {
          bypass_pull_request_allowances: Record<string, string[]>;
        };
      };
    };
    policy.expected.required_pull_request_reviews.bypass_pull_request_allowances.administrators = [
      "operations",
    ];
    policy.documented_exceptions.push({
      field: "required_pull_request_reviews.bypass_pull_request_allowances.administrators",
      value: ["operations"],
      reason: "not a GitHub protection category",
      compensating_controls: "none",
      retires_when: "immediately",
    });

    expect(validateBranchProtectionPolicy(policy)).toEqual(
      expect.arrayContaining([expect.stringContaining("unaudited field")]),
    );
  });

  it("rejects an unsupported review-bypass category without an exception", () => {
    const policy = loadPolicy() as BranchProtectionPolicy & {
      expected: {
        required_pull_request_reviews: {
          bypass_pull_request_allowances: Record<string, string[]>;
        };
      };
    };
    policy.expected.required_pull_request_reviews.bypass_pull_request_allowances.administrators = [
      "operations",
    ];

    expect(validateBranchProtectionPolicy(policy)).toEqual(
      expect.arrayContaining([expect.stringContaining("unsupported category")]),
    );
  });

  it("rejects a stale exception for an already pinned required check", () => {
    const policy = loadPolicy();
    const check = policy.expected.required_status_checks.checks[0];
    policy.documented_exceptions.push({
      field: `required_status_checks.checks.app_id:${check.context}`,
      value: check.app_id,
      reason: "the check is already pinned",
      compensating_controls: "none",
      retires_when: "immediately",
    });

    expect(validateBranchProtectionPolicy(policy)).toEqual(
      expect.arrayContaining([expect.stringContaining("unpinned null binding")]),
    );
  });

  it("rejects a stale exception for an empty review-bypass allowance", () => {
    const policy = loadPolicy();
    policy.documented_exceptions.push({
      field: "required_pull_request_reviews.bypass_pull_request_allowances.users",
      value: [],
      reason: "no active bypass",
      compensating_controls: "none",
      retires_when: "immediately",
    });

    expect(validateBranchProtectionPolicy(policy)).toEqual(
      expect.arrayContaining([expect.stringContaining("no active review bypass")]),
    );
  });

  it("rejects nested review exceptions while pull-request reviews are absent", () => {
    const policy = loadPolicy();
    policy.expected.required_pull_request_reviews.present = false;
    policy.expected.required_pull_request_reviews.require_code_owner_reviews = false;
    policy.documented_exceptions = [
      {
        field: "required_pull_request_reviews.present",
        value: false,
        reason: "review block absent for test",
        compensating_controls: "manual review",
        retires_when: "review block restored",
      },
      {
        field: "required_pull_request_reviews.require_code_owner_reviews",
        value: false,
        reason: "nested control cannot be observed",
        compensating_controls: "manual review",
        retires_when: "review block restored",
      },
    ];

    expect(validateBranchProtectionPolicy(policy)).toEqual(
      expect.arrayContaining([expect.stringContaining("present is not true")]),
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

  it.each([
    ["users", [123, "operator"], "non-empty strings"],
    ["teams", ["risk-review", " "], "non-empty strings"],
    ["apps", ["release-control", "release-control"], "duplicates"],
  ] as const)("rejects invalid %s review-bypass principals", (category, principals, message) => {
    const policy = loadPolicy();
    const field = `required_pull_request_reviews.bypass_pull_request_allowances.${category}`;
    policy.expected.required_pull_request_reviews.bypass_pull_request_allowances[category] =
      [...principals] as unknown as string[];
    policy.documented_exceptions.push({
      field,
      value: [...principals],
      reason: "test exception",
      compensating_controls: "test control",
      retires_when: "test retirement",
    });

    expect(validateBranchProtectionPolicy(policy)).toEqual(
      expect.arrayContaining([expect.stringContaining(message)]),
    );
  });

  it("refuses to validate a policy copied from another repository", () => {
    const policy = loadPolicy();
    policy.repository = "sgajbi/lotus-gateway";

    expect(validateBranchProtectionPolicy(policy)).toEqual(
      expect.arrayContaining([expect.stringContaining("repository must identify")]),
    );
  });

  it.each(["review_lead", "mergeable_meaning", "escalation"] as const)(
    "rejects missing review authority %s before merge",
    (field) => {
      const policy = loadPolicy();
      policy.review_authority[field] = " ";

      expect(validateBranchProtectionPolicy(policy)).toEqual(
        expect.arrayContaining([expect.stringContaining(`review_authority.${field}`)]),
      );
    },
  );

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
    const auditSource = readFileSync(
      join(repositoryRoot, "scripts", "audit_main_gate_coverage.py"),
      "utf8",
    );
    expect(auditSource).toContain('"branch=main"');
    expect(auditSource).toContain('run.get("path") != ".github/workflows/main-gate-coverage-audit.yml"');
    expect(auditSource).toContain("page += 1");
    expect(auditSource).not.toContain('"--limit"');
    expect(auditSource).toContain('_EXACT_RUN_TITLE_PREFIX = "Main Releasability · "');
    expect(auditSource).toContain("def _releasability_run_identity(");
    expect(auditSource).toContain("tested_sha=tested_sha");
    expect(auditSource).toContain("workflow_definition_sha=workflow_definition_sha");
    expect(auditSource).toContain('head_branch != "main"');
    expect(auditSource).toContain('legacy_ref = f"main-releasability-{workflow_definition_sha}"');
    expect(auditSource).toContain(`f"repos/{REPOSITORY}/actions/workflows/{WORKFLOW}/runs"`);
    expect(auditSource).toContain("@lru_cache(maxsize=1)");
    expect(auditSource).toContain('database_id = run.get("id")');
    expect(auditSource.match(/encoding="utf-8"/g)).toHaveLength(6);
    expect(auditSource).toContain('job.get("name") == "Audit / Every Main Commit Has A Gate Verdict"');
    expect(auditSource).toContain('job.get("name") == "Main Releasability / Exact Revision Assertion"');
    expect(workflow).toContain("coverage-audit:");
    expect(workflow).toContain("protection-audit:");
    expect(workflow).not.toContain("if: ${{ !cancelled() }}");
    expect(workflow).toContain("GH_TOKEN: ${{ secrets.LOTUS_AUTOMERGE_TOKEN }}");
    expect(workflow).toMatch(
      /node scripts\/quality\/check-branch-protection-policy-document\.mjs\r?\n\s+python scripts\/check_branch_protection_policy\.py/,
    );
    expect(workflow).not.toContain("continue-on-error");
    expect(workflow).toMatch(/permissions:\r?\n  contents: read\r?\n  actions: read/);
  });

  it("binds REST evidence to tested source independently from workflow provenance", () => {
    const testedSha = "a".repeat(40);
    const workflowSha = "b".repeat(40);
    const python = `
import importlib.util
import json
import subprocess
from pathlib import Path

path = Path("scripts/audit_main_gate_coverage.py").resolve()
spec = importlib.util.spec_from_file_location("main_gate_audit", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
exact_run = {
    "id": 321,
    "head_sha": "${workflowSha}",
    "head_branch": "main",
    "display_title": "Main Releasability · ${testedSha}",
    "conclusion": "success",
    "status": "completed",
}
module._releasability_runs = lambda: [exact_run]
module._is_ancestor = lambda sha: True
assertion_conclusion = ["success"]

def inspect_run(arguments, **kwargs):
    assert arguments == ["gh", "run", "view", "321", "--json", "jobs"]
    assert kwargs["encoding"] == "utf-8"
    payload = {"jobs": [{
        "name": "Main Releasability / Exact Revision Assertion",
        "conclusion": assertion_conclusion[0],
    }]}
    return subprocess.CompletedProcess(arguments, 0, json.dumps(payload), "")

module.subprocess.run = inspect_run
assert module._run_conclusions("${testedSha}") == ["success"]
assert module._run_conclusions("${workflowSha}") == []
assertion_conclusion[0] = "failure"
assert module._run_conclusions("${testedSha}") == ["exact revision assertion failure"]
assertion_conclusion[0] = "skipped"
assert module._run_conclusions("${testedSha}") == ["exact revision assertion skipped"]

exact_identity = module._releasability_run_identity(exact_run)
assert exact_identity.tested_sha == "${testedSha}"
assert exact_identity.workflow_definition_sha == "${workflowSha}"
assert module._releasability_run_identity({**exact_run, "display_title": "Main Releasability · short"}) is None
assert module._releasability_run_identity({**exact_run, "head_branch": None}) is None

legacy_run = {
    **exact_run,
    "head_sha": "${testedSha}",
    "head_branch": "main-releasability-${testedSha}",
    "display_title": "Main Releasability Gate",
}
legacy_identity = module._releasability_run_identity(legacy_run)
assert legacy_identity.tested_sha == "${testedSha}"
assert legacy_identity.workflow_definition_sha == "${testedSha}"
`;
    const result = spawnSync("python", ["-c", python], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    });

    expect(result.status, result.stderr).toBe(0);
  }, 15_000);

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
