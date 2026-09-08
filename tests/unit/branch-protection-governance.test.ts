import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = join(__dirname, "..", "..");
const temporaryRoots: string[] = [];

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

function runOfflinePolicy(policy: BranchProtectionPolicy) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "workbench-branch-protection-"));
  temporaryRoots.push(fixtureRoot);
  mkdirSync(join(fixtureRoot, "scripts"));
  mkdirSync(join(fixtureRoot, "quality"));
  cpSync(
    join(repositoryRoot, "scripts", "check_branch_protection_policy.py"),
    join(fixtureRoot, "scripts", "check_branch_protection_policy.py"),
  );
  writeFileSync(
    join(fixtureRoot, "quality", "branch_protection_policy.v1.json"),
    `${JSON.stringify(policy, null, 2)}\n`,
  );

  return spawnSync("python", [join(fixtureRoot, "scripts", "check_branch_protection_policy.py"), "--offline"], {
    encoding: "utf8",
    env: { ...process.env, GITHUB_REPOSITORY: "sgajbi/lotus-workbench" },
  });
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("branch protection governance", () => {
  it("keeps the lifted estate audit implementations byte-identical to their reviewed blobs", () => {
    expect(
      gitBlobSha(readFileSync(join(repositoryRoot, "scripts", "check_branch_protection_policy.py"))),
    ).toBe("1f1276c67b1c6e6b50df11d6917bb46816f3f32e");
    expect(
      gitBlobSha(readFileSync(join(repositoryRoot, "scripts", "audit_main_gate_coverage.py"))),
    ).toBe("ea58e186d4ada25d077e3044b7c1295541f8d126");
  });

  it(
    "accepts the checked-in Workbench policy and its five app-bound merge checks",
    () => {
      const policy = loadPolicy();
      const result = runOfflinePolicy(policy);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Branch-protection policy gate passed");
      expect(policy.expected.required_status_checks.checks).toHaveLength(5);
      expect(
        policy.expected.required_status_checks.checks.every(
          (check) => check.app_id === 15368,
        ),
      ).toBe(true);
    },
    10_000,
  );

  it("rejects a policy with no required checks", () => {
    const policy = loadPolicy();
    policy.expected.required_status_checks.checks = [];

    const result = runOfflinePolicy(policy);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("checks is empty");
  });

  it("rejects removal of the single-developer zero-approval exception", () => {
    const policy = loadPolicy();
    policy.documented_exceptions = [];

    const result = runOfflinePolicy(policy);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("without a documented exception");
  });

  it("refuses to validate a policy copied from another repository", () => {
    const policy = loadPolicy();
    policy.repository = "sgajbi/lotus-gateway";

    const result = runOfflinePolicy(policy);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("policy declares repository");
  });

  it("keeps the daily audit fail-closed without widening the default workflow token", () => {
    const workflow = readFileSync(
      join(repositoryRoot, ".github", "workflows", "main-gate-coverage-audit.yml"),
      "utf8",
    );

    expect(workflow).toContain("python scripts/audit_main_gate_coverage.py --limit 60 --fail-on-gap");
    expect(workflow).toContain("if: ${{ !cancelled() }}");
    expect(workflow).toContain("GH_TOKEN: ${{ secrets.LOTUS_AUTOMERGE_TOKEN }}");
    expect(workflow).not.toContain("continue-on-error");
    expect(workflow).toMatch(/permissions:\r?\n  contents: read\r?\n  actions: read/);
  });

  it("runs policy shape validation in the blocking repository lint chain", () => {
    const packageManifest = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageManifest.scripts["quality:branch-protection"]).toBe(
      "python scripts/check_branch_protection_policy.py --offline",
    );
    expect(packageManifest.scripts.lint).toMatch(/^npm run quality:branch-protection &&/);
  });
});
