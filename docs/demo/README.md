# Governed Workbench Demonstration

Workbench demonstrations use the canonical front-office runtime and the governed portfolio
`PB_SG_GLOBAL_BAL_001`. The prior `DEMO_ADV_USD_001` walkthrough and manual approval-chain script
were retired because they no longer matched the current proposal workflow, source evidence, or
canonical dataset.

## Evidence Gate

Do not begin a review-ready demonstration from manually assembled services or stale screenshots.
Bring up and validate the governed stack first:

```powershell
npm run live:stack:up:validate
```

Only after API, calculation, contract, and panel validation succeeds should review-ready evidence
be captured. Diagnostic captures must use a `diagnostic-` prefix and remain separate from demo
evidence. Teardown when the session is complete:

```bash
npm run live:stack:down
```

The [canonical runtime guide](../operations/canonical-front-office-local-runtime.md) owns service
heads, configuration, startup, validation, evidence locations, recovery, and teardown.

## Business Walkthrough

Use the [Screen Guide Catalogue](../../wiki/Screen-Guide-Catalogue.md) to choose a workflow and
follow the guide for the exact source authority, screen states, actions, and unsupported boundary.
A typical review follows this order:

1. **Adviser book and portfolio context** — select `PB_SG_GLOBAL_BAL_001` and retain the governed
   business date.
2. **Portfolio review** — assess value, allocation, holdings, activity, income, liquidity, and
   source readiness before opening specialist analysis.
3. **Performance and risk** — review benchmark-relative return, contribution, attribution, risk,
   evidence, and human-reviewed adviser briefing.
4. **Portfolio management** — move from mandate attention into rebalance, construction, memory,
   outcome, operating-quality, or evidence-pack work only where source posture supports it.
5. **Advisory and reporting** — review source-owned opportunities or proposals and request only the
   reports and bounded actions exposed by the relevant guide.

Do not demonstrate a capability-disabled route as production-enabled, treat generated material as
approved advice, claim a report-input handoff is report generation, or present a recorded
conversion intent as a proposal or order.

## Evidence Interpretation

- `output/playwright/live-canonical/` contains canonical validation artefacts for the current run.
- `docs/evidence/` contains historical issue-scoped diagnostic or reviewer packs; it is not the
  current canonical evidence source.
- Fixture Playwright runs prove deterministic Workbench behaviour against governed fixtures, not
  live source integration.
- A successful local demonstration does not certify production identity, entitlement, resilience,
  capacity, disaster recovery, regulatory compliance, or bank acceptance.
