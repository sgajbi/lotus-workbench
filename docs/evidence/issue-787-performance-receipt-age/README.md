# Performance receipt-age evidence

This evidence pack proves the bounded Performance tranche of #787 against the owned populated
fixture journey. It does not certify upstream valuation or market-data freshness.

## Business invariant

The Performance header shows the oldest admitted summary/detail browser receipt as **Checked** and
offers one **Recheck performance** action across all decision modes. An explicit recheck performs
exactly one summary read and one detail read, confirms success only after both remain coherent with
the active review context, and leaves the source-owned **As of** date distinct.

## Artifacts

- `performance-receipt-age.json` records the exact before/after fixture request counts, receipt
  label, portfolio, and unchanged route.
- `performance-receipt-age-desktop.png` is the optimized-browser rendered proof for reviewer UX
  inspection.

## Reproduction

From the `lotus-workbench` repository root:

```powershell
$env:PERFORMANCE_E2E_EVIDENCE_DIR = "docs/evidence/issue-787-performance-receipt-age"
npm run test:e2e:performance:receipt-age
```

The governed runner owns isolated Workbench and fixture-Gateway ports and does not reuse or stop the
shared canonical runtime.
