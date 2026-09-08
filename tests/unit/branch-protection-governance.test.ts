import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateBranchProtectionPolicy } from "../../scripts/quality/check-branch-protection-policy-document.mjs";

const repositoryRoot = join(__dirname, "..", "..");
function gitBlobSha(source: Buffer): string {
  const header = Buffer.from(`blob ${source.byteLength}\0`, "utf8");
  return createHash("sha1").update(header).update(source).digest("hex");
}

type BranchProtectionPolicy = {
  repository: string;
  expected: {
    required_status_checks: { checks: Array<{ context: string; app_id: number }> };
    required_pull_request_reviews: { required_approving_review_count: number };
  };
  documented_exceptions: Array<Record<string, unknown>>;
};

function loadPolicy(): BranchProtectionPolicy {
  return JSON.parse(
    readFileSync(join(repositoryRoot, "quality", "branch_protection_policy.v1.json"), "utf8"),
  ) as BranchProtectionPolicy;
}

describe("branch protection governance", () => {
  it("keeps the lifted estate audit implementations byte-identical to their reviewed blobs", () => {
    expect(
      gitBlobSha(readFileSync(join(repositoryRoot, "scripts", "check_branch_protection_policy.py"))),
    ).toBe("1f1276c67b1c6e6b50df11d6917bb46816f3f32e");
    expect(
      gitBlobSha(readFileSync(join(repositoryRoot, "scripts", "audit_main_gate_coverage.py"))),
    ).toBe("ea58e186d4ada25d077e3044b7c1295541f8d126");
  });

  it("accepts the checked-in Workbench policy and its five app-bound merge checks", () => {
    const policy = loadPolicy();

    expect(validateBranchProtectionPolicy(policy)).toEqual([]);
    expect(policy.expected.required_status_checks.checks).toHaveLength(5);
    expect(
      policy.expected.required_status_checks.checks.every((check) => check.app_id === 15368),
    ).toBe(true);
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

  it.each(["users", "teams", "apps"] as const)(
    "rejects an undocumented %s review bypass",
    (category) => {
      const policy = loadPolicy() as BranchProtectionPolicy & {
        expected: {
          required_pull_request_reviews: {
            bypass_pull_request_allowances: Record<"users" | "teams" | "apps", string[]>;
          };
        };
      };
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

    expect(workflow).toContain("python scripts/audit_main_gate_coverage.py --limit 60 --fail-on-gap");
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
