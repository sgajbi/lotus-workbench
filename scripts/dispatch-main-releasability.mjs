import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function commandRunner(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? result.error?.message ?? "",
  };
}

function runRequired(run, command, args, context) {
  const result = run(command, args);
  if (result.status !== 0) {
    throw new Error(`${context}: ${result.stderr.trim() || `exit ${result.status}`}`);
  }
  return result.stdout.trim();
}

function readInputs(environment) {
  const mergeCommitSha = environment.MERGE_COMMIT_SHA ?? "";
  const commitCountText = environment.COMMIT_COUNT ?? "";
  const pullRequestNumber = environment.PR_NUMBER ?? "";
  const repository = environment.GITHUB_REPOSITORY ?? "";

  if (!SHA_PATTERN.test(mergeCommitSha)) {
    throw new Error("pull_request.merge_commit_sha must be a full lowercase commit SHA");
  }
  if (!/^[1-9][0-9]*$/.test(commitCountText)) {
    throw new Error(`pull_request.commits must be a positive integer; received '${commitCountText}'`);
  }
  if (!/^[1-9][0-9]*$/.test(pullRequestNumber)) {
    throw new Error(`pull_request.number must be a positive integer; received '${pullRequestNumber}'`);
  }
  if (!REPOSITORY_PATTERN.test(repository)) {
    throw new Error(`GITHUB_REPOSITORY must be owner/name; received '${repository}'`);
  }

  const commitCount = Number(commitCountText);
  if (!Number.isSafeInteger(commitCount)) {
    throw new Error(`pull_request.commits exceeds the supported integer range: '${commitCountText}'`);
  }

  return {
    commitCount,
    mergeCommitSha,
    pullRequestNumber,
    repository,
  };
}

export function dispatchMainReleasability({ environment = process.env, run = commandRunner } = {}) {
  const inputs = readInputs(environment);
  const policyJson = runRequired(
    run,
    "gh",
    ["api", `repos/${inputs.repository}`],
    "Unable to read repository merge policy",
  );
  let policy;
  try {
    policy = JSON.parse(policyJson);
  } catch {
    throw new Error("Repository merge policy response was not valid JSON");
  }
  if (
    policy.allow_squash_merge !== false ||
    policy.allow_merge_commit !== false ||
    policy.allow_rebase_merge !== true
  ) {
    throw new Error("Repository merge methods changed; per-revision dispatch requires rebase-only merging");
  }

  runRequired(run, "git", ["fetch", "origin", "main", "--quiet"], "Unable to fetch current main");
  runRequired(
    run,
    "git",
    ["checkout", "--quiet", "--detach", "FETCH_HEAD"],
    "Unable to inspect current main",
  );
  const revisionOutput = runRequired(
    run,
    "git",
    ["rev-list", "-n", String(inputs.commitCount), "--reverse", inputs.mergeCommitSha],
    "Unable to enumerate merged revisions",
  );
  const revisions = revisionOutput === "" ? [] : revisionOutput.split(/\r?\n/);
  if (revisions.length !== inputs.commitCount) {
    throw new Error(
      `Expected ${inputs.commitCount} revisions for PR #${inputs.pullRequestNumber}, enumerated ${revisions.length}`,
    );
  }
  if (revisions.at(-1) !== inputs.mergeCommitSha) {
    throw new Error(
      `Enumerated tip ${revisions.at(-1) ?? "none"} does not match merged PR tip ${inputs.mergeCommitSha}`,
    );
  }

  for (const revision of revisions) {
    if (!SHA_PATTERN.test(revision)) {
      throw new Error(`Revision enumeration returned an invalid commit identity: '${revision}'`);
    }
    runRequired(
      run,
      "git",
      ["merge-base", "--is-ancestor", revision, "HEAD"],
      `Revision ${revision} is not reachable from current main; refusing to dispatch`,
    );

    runRequired(
      run,
      "gh",
      [
        "workflow",
        "run",
        "main-releasability.yml",
        "--repo",
        inputs.repository,
        "--ref",
        "main",
        "-f",
        `expected_sha=${revision}`,
        "-f",
        `triggering_pr=${inputs.pullRequestNumber}`,
      ],
      `Unable to dispatch main releasability for ${revision}`,
    );
    console.log(`Dispatched main releasability for ${revision} (PR #${inputs.pullRequestNumber})`);
  }

  return revisions;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    dispatchMainReleasability();
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
