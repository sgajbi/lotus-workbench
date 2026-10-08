import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

describe("canonical startup manifest hashing", () => {
  const shells = process.platform === "win32" ? ["powershell.exe", "pwsh"] : ["pwsh"];
  it.each(shells)("executes the actual late gate and hashing controls in %s", (shell) => {
    const result = spawnSync(shell, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
      "scripts/quality/Test-CanonicalSourceManifestHash.ps1"], { cwd: process.cwd(), encoding: "utf8" });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const controls = JSON.parse(result.stdout) as { name: string; passed: boolean }[];
    expect(controls.length).toBeGreaterThanOrEqual(11);
    expect(controls.every((control) => control.passed)).toBe(true);
  }, 30_000);
});

import { CANONICAL_REPOSITORIES, bindMainlineSourceManifestToRuntime, buildMainlineSourceManifest, canonicalRepositoryPath, evaluateRepository, repositoryOriginMatchesName, validateMainlineSourceManifest } from "../../scripts/live/validation/mainline-source-provenance.mjs";

function repositoryNameFromPath(path: string) {
  if (path === "unused") {
    return "lotus-idea";
  }
  if (path.includes("lotus-workbench-mainline")) {
    return "lotus-workbench";
  }
  return path.split(/[\\/]/).at(-1) ?? "lotus-idea";
}

function gitFixture(values: Record<string, string>) {
  return (path: string, args: string[]) => {
    if (args.join(" ") === "config --get remote.origin.url") {
      return values[args.join(" ")] ?? `https://github.com/sgajbi/${repositoryNameFromPath(path)}.git`;
    }
    return values[args.join(" ")] ?? "";
  };
}

function recordingGitFixture(values: Record<string, string>, paths: string[]) {
  return (path: string, args: string[]) => {
    if (args.join(" ") === "fetch origin --prune") {
      paths.push(path);
    }
    if (args.join(" ") === "config --get remote.origin.url") {
      return values[args.join(" ")] ?? `https://github.com/sgajbi/${repositoryNameFromPath(path)}.git`;
    }
    return values[args.join(" ")] ?? "";
  };
}

describe("canonical mainline source provenance", () => {
  it("accepts a clean main checkout and an exact detached main SHA", () => {
    const runGit = gitFixture({ "fetch origin --prune": "", "status --porcelain": "", "rev-parse HEAD": "abc", "rev-parse refs/remotes/origin/main": "abc", "branch --show-current": "" });
    expect(evaluateRepository({ name: "lotus-idea", path: "unused", runGit })).toMatchObject({ passed: true, reason: "aligned_with_origin_main", branch: null });
  });

  it("fails closed for dirty, diverged, and non-main source checkouts", () => {
    const base = { "fetch origin --prune": "", "rev-parse HEAD": "abc", "rev-parse refs/remotes/origin/main": "abc", "branch --show-current": "feature/proof" };
    expect(evaluateRepository({ name: "lotus-idea", path: "unused", runGit: gitFixture({ ...base, "status --porcelain": " M docs/runbook.md" }) }).reason).toBe("dirty_worktree");
    expect(evaluateRepository({ name: "lotus-idea", path: "unused", runGit: gitFixture({ ...base, "status --porcelain": "", "rev-parse HEAD": "old" }) }).reason).toBe("head_not_origin_main");
    expect(evaluateRepository({ name: "lotus-idea", path: "unused", runGit: gitFixture({ ...base, "status --porcelain": "" }) }).reason).toBe("non_main_branch");
  });

  it("records every canonical participant without source paths or dirty filenames", () => {
    const manifest = buildMainlineSourceManifest("C:/projects", gitFixture({ "fetch origin --prune": "", "status --porcelain": "", "rev-parse HEAD": "abc", "rev-parse refs/remotes/origin/main": "abc", "branch --show-current": "main" }));
    expect(manifest).toMatchObject({ schemaVersion: "lotus.canonical-front-office.mainline-source-provenance.v1", passed: true });
    expect(manifest.repositories.map((repository) => repository.repository)).toContain("lotus-idea");
    expect(manifest.repositories.map((repository) => repository.repository)).toContain("lotus-platform");
    expect(JSON.stringify(manifest)).not.toContain("C:/projects");
  });

  it("uses the supplied Workbench repository path for isolated mainline preflight", () => {
    expect(canonicalRepositoryPath({
      name: "lotus-workbench",
      projectsRoot: "C:/projects",
      workbenchRepoPath: "C:/projects/_qa_worktrees/lotus-workbench-mainline",
    })).toBe("C:/projects/_qa_worktrees/lotus-workbench-mainline");
    expect(canonicalRepositoryPath({
      name: "lotus-idea",
      projectsRoot: "C:/projects",
      workbenchRepoPath: "C:/projects/_qa_worktrees/lotus-workbench-mainline",
    })).toMatch(/lotus-idea$/);
  });

  it("accepts only paths whose Git origin matches the evaluated canonical repository", () => {
    expect(repositoryOriginMatchesName({
      name: "lotus-workbench",
      originUrl: "https://github.com/sgajbi/lotus-workbench.git",
    })).toBe(true);
    expect(repositoryOriginMatchesName({
      name: "lotus-workbench",
      originUrl: "git@github.com:sgajbi/lotus-workbench.git",
    })).toBe(true);
    expect(repositoryOriginMatchesName({
      name: "lotus-workbench",
      originUrl: "ssh://git@github.com/sgajbi/lotus-workbench.git",
    })).toBe(true);
    expect(repositoryOriginMatchesName({
      name: "lotus-workbench",
      originUrl: "https://github.com/sgajbi/lotus-idea.git",
    })).toBe(false);
    expect(repositoryOriginMatchesName({
      name: "lotus-workbench",
      originUrl: "https://github.com/attacker/lotus-workbench.git",
    })).toBe(false);
    expect(repositoryOriginMatchesName({
      name: "lotus-workbench",
      originUrl: "git@evil.example:other/lotus-workbench.git",
    })).toBe(false);
  });

  it("evaluates lotus-workbench from the isolated path while preserving sibling repo paths", () => {
    const paths: string[] = [];
    const manifest = buildMainlineSourceManifest("C:/projects", recordingGitFixture({
      "fetch origin --prune": "",
      "status --porcelain": "",
      "rev-parse HEAD": "abc",
      "rev-parse refs/remotes/origin/main": "abc",
      "branch --show-current": "main",
    }, paths), { workbenchRepoPath: "C:/projects/_qa_worktrees/lotus-workbench-mainline" });

    expect(manifest.passed).toBe(true);
    expect(paths).toContain("C:/projects/_qa_worktrees/lotus-workbench-mainline");
    expect(paths.some((path) => /lotus-idea$/.test(path))).toBe(true);
    expect(paths.some((path) => /lotus-workbench$/.test(path))).toBe(false);
  });

  it("rejects an isolated Workbench override that points at another clean Lotus repository", () => {
    const runGit = (path: string, args: string[]) => {
      if (args.join(" ") === "config --get remote.origin.url") {
        return `https://github.com/sgajbi/${repositoryNameFromPath(path)}.git`;
      }
      return gitFixture({
        "fetch origin --prune": "",
        "status --porcelain": "",
        "rev-parse HEAD": "abc",
        "rev-parse refs/remotes/origin/main": "abc",
        "branch --show-current": "main",
      })(path, args);
    };
    const manifest = buildMainlineSourceManifest("C:/projects", runGit, { workbenchRepoPath: "C:/projects/lotus-idea" });

    expect(manifest.passed).toBe(false);
    expect(manifest.repositories.find((repository) => repository.repository === "lotus-workbench")).toMatchObject({
      passed: false,
      reason: "repository_identity_mismatch",
    });
  });

  it("rejects incomplete, failed, or arbitrary manifests before certification is asserted", () => {
    const validManifest = buildMainlineSourceManifest("C:/projects", gitFixture({ "fetch origin --prune": "", "status --porcelain": "", "rev-parse HEAD": "abc", "rev-parse refs/remotes/origin/main": "abc", "branch --show-current": "main" }));
    expect(validateMainlineSourceManifest(validManifest)).toBe(validManifest);
    expect(() => validateMainlineSourceManifest({ ...validManifest, repositories: validManifest.repositories.slice(1) })).toThrow("complete canonical participant set");
    expect(() => validateMainlineSourceManifest({ ...validManifest, passed: false })).toThrow("passing canonical certification preflight");
    expect(CANONICAL_REPOSITORIES).toContain("lotus-platform");
  });

  it("binds the Idea runtime version to the passing source manifest", () => {
    const manifest = buildMainlineSourceManifest("C:/projects", gitFixture({ "fetch origin --prune": "", "status --porcelain": "", "rev-parse HEAD": "abc", "rev-parse refs/remotes/origin/main": "abc", "branch --show-current": "main" }));
    expect(bindMainlineSourceManifestToRuntime(manifest, { repository: "lotus-idea", commitSha: "abc", branch: "main" })).toMatchObject({ repository: "lotus-idea", expectedMainSha: "abc" });
    expect(() => bindMainlineSourceManifestToRuntime(manifest, { repository: "lotus-idea", commitSha: "branch-built", branch: "main" })).toThrow("Runtime provenance does not match");
    expect(() => bindMainlineSourceManifestToRuntime(manifest, { repository: "lotus-idea", commitSha: "abc", branch: "feature/proof" })).toThrow("Runtime provenance does not match");
  });
});
