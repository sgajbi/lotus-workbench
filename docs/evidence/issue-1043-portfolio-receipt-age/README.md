# Portfolio receipt age and recheck evidence

This pack proves the bounded Workbench #1043 Portfolio Review change against the owned fixture
Gateway for canonical portfolio `PB_SG_GLOBAL_BAL_001`.

## Business proof

- **As of** remains a date-only source business control.
- **Checked** is a separate Workbench receipt timestamp with exact UTC disclosure.
- **Recheck portfolio** recontacts the workspace shell and the complete dated summary fan-out.
- Success is announced only after both governed Query owners return exact-current evidence.
- A failed required read preserves its distinct failure and never announces successful recheck.

## Evidence

- [Rendered toolbar](portfolio-receipt-age.png)
- [Machine-readable receipt proof](portfolio-receipt-age-evidence.json)
- [Machine-readable revisit proof](portfolio-query-freshness-evidence.json)

Generate the pack from the repository root:

```powershell
$env:PORTFOLIO_E2E_EVIDENCE_DIR = "docs/evidence/issue-1043-portfolio-receipt-age"
npm run test:e2e:portfolio:query-freshness
```

The scenario must report two executed tests and zero skipped tests. The JSON receipt proof records
the source business date, exact receipt timestamp, and before/after request counts; the screenshot
is reviewer evidence, not a substitute for those assertions.
