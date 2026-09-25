# Report Ordering And Job Invocation Posture

This note records the supported Workbench reporting boundary after issues #449, #458, and the
implemented portfolio-bundle slice of #662.

## Supported Business Workflow

The portfolio-scoped Report Centre is mounted at:

```text
/reports?portfolioId=PB_SG_GLOBAL_BAL_001
```

It supports an advisor or portfolio manager who needs to:

1. review firm-approved report choices for the selected portfolio,
2. set the report date and optional reporting currency,
3. choose supported sections and an output that is currently ready,
4. review the complete request before submission,
5. submit one idempotent portfolio-review request, or apply the same reviewed setup to an explicit
   selection of at least two active portfolios from the source-backed advisor book,
6. monitor recent report-data jobs or every separate portfolio-bundle outcome without treating
   acceptance or completion as archive or client delivery.

Workbench calls only Gateway-backed routes through its same-origin BFF:

- `GET /api/v1/report-ordering/options`
- `POST /api/v1/reports/portfolio-reviews`
- `POST /api/v1/report-batches`
- `GET /api/v1/report-batches/{batch_id}`
- `GET /api/v1/report-jobs`

Portfolio-bundle selection reuses `GET /api/v1/advisor-book/portfolios` through the Workbench BFF.
The browser sends selected portfolio ids as the advisor's reviewed intent; Gateway resolves the
trusted caller again and verifies current book membership and reporting eligibility before Report
materializes separate per-portfolio items. Workbench never describes the bundle as a consolidated
client, household, or book report.

For a single portfolio, Workbench sends the selected report date and reporting currency when it
loads ordering options. If Reporting publishes `ADVISOR_COMMENTARY` as ready, Workbench can submit
only the exact accepted Advisor Brief run returned for that context. Review-required,
context-mismatch, availability-unknown, and not-evaluated states remain distinct and non-selectable.
Changing date or currency clears the prior selection while the source is rechecked; an older or
failed response cannot restore that prior brief as current. Portfolio bundles do not reuse a
single-portfolio accepted brief.

The BFF removes browser-supplied reporting authority headers, derives the development caller role
and portfolio entitlement from server configuration, and rejects unentitled scopes before calling
Gateway. Outside explicit development environments, report ordering fails closed until an
authenticated-principal resolver is available.

## Output And Lifecycle Truth

Output readiness is source-owned and independent by format:

- structured report data can be available while a governed PDF is unavailable,
- an unavailable format remains visible with business-facing support copy,
- `completed` means report data is complete,
- archive, retention, advisor approval, client delivery, and client communication remain separate
  downstream states.

Reports created by advisory or portfolio-management source workflows are shown as workflow-managed
evidence. Workbench does not present them as directly orderable reports.

## Unsupported Browser Controls

Workbench does not expose browser controls for:

- report worker `:run-once` execution,
- browser-defined worker capacity or runtime load,
- candidate provenance or materialized batch membership,
- ad hoc archive-document lookup,
- direct document download,
- client distribution or communication.

The obsolete technical panel, client helpers, response types, metrics, and self-referential tests
were retired under #449 and #458.

## Authority Configuration

Canonical local development uses:

```text
LOTUS_ENVIRONMENT=dev
WORKBENCH_REPORTING_AUTH_MODE=development_configured
WORKBENCH_REPORTING_CALLER_PORTFOLIO_IDS=PB_SG_GLOBAL_BAL_001
WORKBENCH_REPORTING_CALLER_ROLE=client_advisor
WORKBENCH_ADVISOR_BOOK_ACTOR_ID=PM_SG_001
WORKBENCH_ADVISOR_BOOK_ROLE=ADVISOR
```

The complete Report Centre flow uses the same bounded Advisor Book development identity and book
scope, but applies the reporting-specific source role (`client_advisor` by default) for catalogue
discovery, single-report requests, portfolio-bundle requests, history, and status reads. Advisor
Book role vocabulary does not grant report-family eligibility.
Local multi-portfolio proof requires every fixture portfolio to be present in the configured
development entitlement, but that precheck is not final authority. Browser headers never grant
reporting authority, and Gateway re-verifies the source-backed book at submission.

## Service Boundary

No direct `lotus-report`, `lotus-render`, or `lotus-archive` Workbench integration is allowed.
Report catalogue, request acceptance, job lifecycle, render readiness, archive truth, retention,
and delivery state remain owned by their source services and are exposed to Workbench only through
Gateway contracts.

## Validation

Run the focused contract and workflow checks:

```powershell
npm test -- --run tests/unit/report-ordering-contracts.test.ts tests/unit/report-ordering-api.test.ts tests/unit/report-ordering-view-model.test.ts tests/unit/use-report-ordering-workflow.test.tsx tests/integration/report-ordering-workspace.test.tsx tests/integration/reports-page.test.tsx tests/unit/bff-route.test.ts
npm run lint
npm run typecheck
npm run build
npm run test:e2e:reports:states
```

For integrated proof, use the canonical front-office sequence:

```powershell
npm run live:stack:up:validate
npm run live:stack:down
```

Do not capture or publish demo-ready screenshots before canonical API, calculation, and panel
validation pass.
