"""Audit which commits on main the Main Releasability Gate actually evaluated.

The gate is dispatched per merged pull request; this repository merges by
rebase, so a pull request holding N commits puts N on main and every one of
them must have a gate run - a commit that was never head becomes the deployed
tree on rollback and bisect. A run that is never created is not a failure, so
nothing else reports the loss; this audit does.

Fail-closed by design (a watchdog that can pass while verifying nothing is
the same liveness defect it exists to catch):

- a missing ``gh`` binary is a failure under ``--fail-on-gap``, never a skip;
- a commit whose run listing cannot be fetched (rate limit, token scope,
  transient API failure) is UNKNOWN, and unknown commits fail the audit under
  ``--fail-on-gap`` - they are unverified, not implicitly fine;
- only runs that reached a verdict (success or failure) count as evaluation:
  a run cancelled seconds after dispatch evaluated nothing. In-progress runs
  count as pending (unknown), not as coverage.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from typing import Any

WORKFLOW = "main-releasability.yml"
REPOSITORY = "sgajbi/lotus-workbench"
_RUNS_PER_PAGE = 100
_VERDICT_CONCLUSIONS = {"success", "failure"}


def _git(*args: str) -> list[str]:
    completed = subprocess.run(
        ["git", *args],
        check=True,
        capture_output=True,
        text=True,
    )
    return [line for line in completed.stdout.splitlines() if line.strip()]


def _run_conclusions(sha: str) -> list[str] | None:
    """Conclusions of every gate run for one commit, or None when unknowable."""

    completed = subprocess.run(
        [
            "gh",
            "run",
            "list",
            "--workflow",
            WORKFLOW,
            "--commit",
            sha,
            "--json",
            "conclusion,status",
        ],
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        return None
    try:
        runs = json.loads(completed.stdout or "[]")
    except json.JSONDecodeError:
        return None
    return [str(run.get("conclusion") or run.get("status") or "") for run in runs]


def _previous_successful_coverage_head() -> str | None:
    """Return the newest main head whose coverage-audit job succeeded."""

    page = 1
    while True:
        completed = subprocess.run(
            [
                "gh",
                "api",
                "--method",
                "GET",
                f"repos/{REPOSITORY}/actions/runs",
                "-f",
                "branch=main",
                "-f",
                f"per_page={_RUNS_PER_PAGE}",
                "-f",
                f"page={page}",
            ],
            capture_output=True,
            text=True,
        )
        if completed.returncode != 0:
            raise RuntimeError(f"could not list coverage-audit runs page {page}")
        try:
            payload: dict[str, Any] = json.loads(completed.stdout or "{}")
        except json.JSONDecodeError as error:
            raise RuntimeError(
                f"coverage-audit run listing page {page} was not valid JSON"
            ) from error
        runs = payload.get("workflow_runs")
        if not isinstance(runs, list):
            raise RuntimeError(f"coverage-audit run listing page {page} has no run list")
        for run in runs:
            if not isinstance(run, dict):
                raise RuntimeError("coverage-audit run listing contains an invalid run")
            if run.get("path") != ".github/workflows/main-gate-coverage-audit.yml":
                continue
            database_id = run.get("id")
            if not isinstance(database_id, int):
                raise RuntimeError("coverage-audit run listing has no usable database ID")
            viewed = subprocess.run(
                ["gh", "run", "view", str(database_id), "--json", "jobs"],
                capture_output=True,
                text=True,
            )
            if viewed.returncode != 0:
                raise RuntimeError(f"could not inspect coverage-audit run {database_id}")
            try:
                details: dict[str, Any] = json.loads(viewed.stdout or "{}")
            except json.JSONDecodeError as error:
                raise RuntimeError(
                    f"coverage-audit run {database_id} details were not valid JSON"
                ) from error
            coverage_succeeded = any(
                isinstance(job, dict)
                and job.get("name") == "Audit / Every Main Commit Has A Gate Verdict"
                and job.get("conclusion") == "success"
                for job in details.get("jobs", [])
            )
            if coverage_succeeded:
                head = run.get("head_sha")
                if not isinstance(head, str) or not head.strip():
                    raise RuntimeError(
                        f"successful coverage-audit run {database_id} has no usable head SHA"
                    )
                return head
        if len(runs) < _RUNS_PER_PAGE:
            return None
        page += 1


def _is_ancestor(checkpoint: str) -> bool:
    completed = subprocess.run(
        ["git", "merge-base", "--is-ancestor", checkpoint, "origin/main"],
        capture_output=True,
        text=True,
    )
    return completed.returncode == 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--baseline",
        help="first-run checkpoint already proven by a Main Releasability verdict",
    )
    parser.add_argument(
        "--checkpoint",
        help="explicit checkpoint override for a bounded operator diagnostic",
    )
    parser.add_argument(
        "--fail-on-gap",
        action="store_true",
        help=(
            "exit non-zero when a commit has no verdict-bearing releasability run "
            "OR when any commit could not be verified (unknown fails closed)"
        ),
    )
    arguments = parser.parse_args()

    if shutil.which("gh") is None:
        print("gh is not available; cannot ask which commits the gate evaluated.")
        return 1 if arguments.fail_on_gap else 0

    try:
        checkpoint = (
            arguments.checkpoint or _previous_successful_coverage_head() or arguments.baseline
        )
    except RuntimeError as error:
        print(f"UNKNOWN  previous audit checkpoint ({error})")
        return 1 if arguments.fail_on_gap else 0
    if not checkpoint:
        print("UNKNOWN  no successful prior audit or explicit first-run baseline exists")
        return 1 if arguments.fail_on_gap else 0
    if not _is_ancestor(checkpoint):
        print(
            f"UNKNOWN  checkpoint {checkpoint} is not an ancestor of origin/main; "
            "refusing to skip rewritten or unrelated history"
        )
        return 1 if arguments.fail_on_gap else 0

    commits = _git(
        "log",
        "--reverse",
        "--format=%H %h %s",
        f"{checkpoint}..origin/main",
    )
    ungated: list[str] = []
    unknown: list[str] = []

    for entry in commits:
        sha, short, subject = entry.split(" ", 2)
        conclusions = _run_conclusions(sha)
        if conclusions is None:
            unknown.append(short)
            print(f"UNKNOWN  {short}  (run listing could not be fetched)")
            continue
        verdicts = [conclusion for conclusion in conclusions if conclusion in _VERDICT_CONCLUSIONS]
        if verdicts:
            continue
        if conclusions:
            # Runs exist but none reached a verdict (cancelled / in progress):
            # not proven ungated, but not verified either.
            unknown.append(short)
            print(f"UNKNOWN  {short}  (runs exist without a verdict: {sorted(set(conclusions))})")
            continue
        ungated.append(f"{short}  {subject[:70]}")
        print(f"UNGATED  {short}  {subject[:70]}")

    print(
        f"\naudited {len(commits)} commit(s) after checkpoint {checkpoint}; "
        f"{len(ungated)} with no verdict-bearing {WORKFLOW} run; "
        f"{len(unknown)} unverifiable."
    )
    if ungated:
        print(
            "\nBackfill one with:\n"
            "  gh api repos/OWNER/REPO/git/refs "
            "-f ref=refs/tags/main-releasability-SHA -f sha=SHA\n"
            "  gh workflow run main-releasability.yml --ref main-releasability-SHA "
            "-f expected_sha=SHA -f triggering_pr=backfill\n"
        )
    if arguments.fail_on_gap and (ungated or unknown):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
