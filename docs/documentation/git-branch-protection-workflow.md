# Git Workflow With Protected `main`

This repository follows protected branch rules on `main`.

## Rules

- Never push directly to `main`.
- Create a feature branch for all changes.
- Open PRs to `main`.
- Merge only after CI is green.

## Daily Flow

```bash
git checkout main
git pull origin main
git checkout -b feat/<short-change-name>
make check
git add .
git commit -m "type: short summary"
git push -u origin feat/<short-change-name>
gh pr create --fill --base main --head feat/<short-change-name>
gh pr checks <PR_NUMBER> --watch
gh pr merge <PR_NUMBER> --rebase --auto --delete-branch
git checkout main
git pull origin main
```

## Auto-Merge Actor And Mainline Proof

The repository auto-merge helper queues rebase auto-merge with `LOTUS_AUTOMERGE_TOKEN`, not the
default `GITHUB_TOKEN`. This keeps the merged main update eligible for downstream workflow
dispatch. If `LOTUS_AUTOMERGE_TOKEN` is not configured, the helper emits a warning and leaves merge
ownership to an authorized human or release actor.

After a PR merges to `main`, `.github/workflows/merged-pr-main-releasability.yml` enumerates the
first-parent interval from the accepted PR base to its merged tip, checks that interval against the
accepted commit count, and dispatches
`main-releasability.yml` once per revision. Each dispatch starts from the existing `main` ref and
passes the exact expected SHA plus originating PR number. Every gate job checks out that expected
SHA. The stable run title identifies tested source; the run head separately records the workflow
definition used for that test. The coverage audit accepts the pairing only after the exact-revision
assertion succeeds and both identities remain on `main`. The dispatcher needs
read-only repository contents plus workflow-dispatch permission; it refuses missing commit metadata,
an unbounded or count-mismatched interval, or revisions that are not
reachable from current `main`.

The gate has no automatic `push` trigger and rejects a different checkout before Workflow Lint and
the quality chain start. Concurrency is revision-aware and never cancels an in-flight evidence run:
it keys on the expected SHA, with `github.sha` used only for an operator dispatch without one.
