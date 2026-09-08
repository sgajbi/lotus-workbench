import { describe, expect, it, vi } from "vitest";

import { dispatchMainReleasability } from "../../scripts/dispatch-main-releasability.mjs";

const firstRevision = "1".repeat(40);
const secondRevision = "2".repeat(40);

type CommandResult = { status: number; stdout: string; stderr: string };
type CommandRunner = (command: string, args: string[]) => CommandResult;

function success(stdout = ""): CommandResult {
  return { status: 0, stderr: "", stdout };
}

function createEnvironment(overrides: Record<string, string> = {}) {
  return {
    COMMIT_COUNT: "2",
    GITHUB_REPOSITORY: "sgajbi/lotus-workbench",
    MERGE_COMMIT_SHA: secondRevision,
    PR_NUMBER: "1036",
    ...overrides,
  };
}

function createRunner(overrides: Partial<Record<string, CommandResult>> = {}) {
  return vi.fn<CommandRunner>((command, args) => {
    const identity = `${command} ${args.join(" ")}`;
    if (overrides[identity]) return overrides[identity];
    if (identity === "gh api repos/sgajbi/lotus-workbench") {
      return success(
        JSON.stringify({
          allow_merge_commit: false,
          allow_rebase_merge: true,
          allow_squash_merge: false,
        }),
      );
    }
    if (identity.startsWith("git rev-list ")) return success(`${firstRevision}\n${secondRevision}\n`);
    return success();
  });
}

describe("merged-main releasability dispatch", () => {
  it("dispatches each landed revision in order through main with exact-SHA input", () => {
    const run = createRunner();

    expect(dispatchMainReleasability({ environment: createEnvironment(), run })).toEqual([
      firstRevision,
      secondRevision,
    ]);

    const calls = run.mock.calls.map(([command, args]) => `${command} ${args.join(" ")}`);
    expect(calls.filter((call) => call.startsWith("gh workflow run main-releasability.yml"))).toEqual([
      expect.stringContaining(`--ref main -f expected_sha=${firstRevision}`),
      expect.stringContaining(`--ref main -f expected_sha=${secondRevision}`),
    ]);
    expect(calls.some((call) => call.includes("git/ref"))).toBe(false);
  });

  it.each([
    ["missing merge identity", { MERGE_COMMIT_SHA: "" }],
    ["non-positive commit count", { COMMIT_COUNT: "0" }],
    ["malformed commit count", { COMMIT_COUNT: "2x" }],
    ["unsafe commit count", { COMMIT_COUNT: "9007199254740992" }],
    ["missing pull-request identity", { PR_NUMBER: "" }],
    ["malformed repository identity", { GITHUB_REPOSITORY: "lotus-workbench" }],
  ])("rejects %s before any repository operation", (_name, override) => {
    const run = createRunner();

    expect(() =>
      dispatchMainReleasability({ environment: createEnvironment(override), run }),
    ).toThrow();
    expect(run).not.toHaveBeenCalled();
  });

  it("fails closed when repository merge policy is no longer rebase-only", () => {
    const run = createRunner({
      "gh api repos/sgajbi/lotus-workbench": success(
        JSON.stringify({
          allow_merge_commit: false,
          allow_rebase_merge: true,
          allow_squash_merge: true,
        }),
      ),
    });

    expect(() => dispatchMainReleasability({ environment: createEnvironment(), run })).toThrow(
      "requires rebase-only",
    );
    expect(run.mock.calls.some(([command, args]) => `${command} ${args.join(" ")}`.startsWith("git "))).toBe(false);
  });

  it("fails closed when repository merge policy is not valid JSON", () => {
    const run = createRunner({
      "gh api repos/sgajbi/lotus-workbench": success("not-json"),
    });

    expect(() => dispatchMainReleasability({ environment: createEnvironment(), run })).toThrow(
      "not valid JSON",
    );
  });

  it("rejects revision enumeration shorter than the merged PR commit count", () => {
    const run = createRunner({
      [`git rev-list -n 2 --reverse ${secondRevision}`]: success(`${secondRevision}\n`),
    });

    expect(() => dispatchMainReleasability({ environment: createEnvironment(), run })).toThrow(
      "Expected 2 revisions",
    );
    expect(run.mock.calls.some(([command, args]) => command === "gh" && args.includes("workflow"))).toBe(false);
  });

  it("rejects an enumerated history whose tip is not the merged revision", () => {
    const run = createRunner({
      [`git rev-list -n 2 --reverse ${secondRevision}`]: success(
        `${firstRevision}\n${"3".repeat(40)}\n`,
      ),
    });

    expect(() => dispatchMainReleasability({ environment: createEnvironment(), run })).toThrow(
      "does not match merged PR tip",
    );
    expect(run.mock.calls.some(([command, args]) => command === "gh" && args.includes("workflow"))).toBe(false);
    expect(run.mock.calls.some(([command, args]) => command === "gh" && args.includes("git/refs"))).toBe(false);
  });

  it("refuses a revision that current main does not contain before dispatch", () => {
    const ancestry = `git merge-base --is-ancestor ${firstRevision} HEAD`;
    const run = createRunner({
      [ancestry]: { status: 1, stderr: "not an ancestor", stdout: "" },
    });

    expect(() => dispatchMainReleasability({ environment: createEnvironment(), run })).toThrow(
      "not reachable from current main",
    );
    expect(run.mock.calls.some(([command, args]) => command === "gh" && args.includes("workflow"))).toBe(false);
  });

  it("rejects a malformed enumerated revision before dispatch", () => {
    const run = createRunner({
      [`git rev-list -n 2 --reverse ${secondRevision}`]: success(`not-a-sha\n${secondRevision}\n`),
    });

    expect(() => dispatchMainReleasability({ environment: createEnvironment(), run })).toThrow(
      "invalid commit identity",
    );
    expect(run.mock.calls.some(([command, args]) => command === "gh" && args.includes("git/refs"))).toBe(false);
  });

  it("fails visibly when an exact revision cannot be dispatched", () => {
    const dispatch = `gh workflow run main-releasability.yml --repo sgajbi/lotus-workbench --ref main -f expected_sha=${firstRevision} -f triggering_pr=1036`;
    const run = createRunner({
      [dispatch]: { status: 1, stderr: "workflow dispatch refused", stdout: "" },
    });

    expect(() => dispatchMainReleasability({ environment: createEnvironment(), run })).toThrow(
      `Unable to dispatch main releasability for ${firstRevision}`,
    );
  });
});
