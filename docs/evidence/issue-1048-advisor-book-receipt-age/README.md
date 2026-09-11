# Adviser Book receipt-age evidence

This diagnostic fixture evidence supports Workbench issue #1048. It demonstrates the implemented
Adviser Book presentation against a controlled Gateway-shaped response; it is not canonical
source-runtime certification.

## What the evidence proves

- The exact own-book register keeps a compact result scope, browser **Checked** receipt, and one
  quiet **Recheck book** action together.
- Desktop, tablet, and compact compositions remain readable without horizontal page overflow.
- The browser suite separately proves one initial read, exactly one explicit recheck read, retained
  admitted rows after ordinary recheck failure, and no global-catalogue fallback.

## Artifacts

| Artifact | Viewport | Purpose |
| --- | --- | --- |
| `advisor-book/diagnostic-advisor-book-1440.png` | 1440 × 1000 | Desktop decision-register composition |
| `advisor-book/diagnostic-advisor-book-1024.png` | 1024 × 900 | Compact workstation composition |
| `advisor-book/diagnostic-advisor-book-519.png` | 519 × 844 | Narrow responsive composition |

## Reproduction

From the repository root, use an unoccupied checkout-specific port:

```powershell
$env:PLAYWRIGHT_PORT = '3108'
$env:ISSUE_1048_EVIDENCE_DIR = 'docs/evidence/issue-1048-advisor-book-receipt-age'
npx playwright test tests/e2e/advisor-book-workspace.spec.ts --project=chromium
```

```bash
export PLAYWRIGHT_PORT=3108
export ISSUE_1048_EVIDENCE_DIR=docs/evidence/issue-1048-advisor-book-receipt-age
npx playwright test tests/e2e/advisor-book-workspace.spec.ts --project=chromium
```

The run must report seven passing tests. Do not reuse a server from another checkout when producing
review evidence.
