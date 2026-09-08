# Report Centre

Report centre is the adviser's controlled workspace for preparing portfolio-review report data.
It supports one selected portfolio or the same approved setup across an explicit selection from
**My book**. A portfolio bundle creates a separate report outcome for each portfolio; it is not a
consolidated client, household, or book report.

## Current Scope

| Screen posture | Current truth |
| --- | --- |
| Canonical route | `/reports?portfolioId={portfolio_id}`; an accepted portfolio bundle is addressable as `/reports?portfolioId={portfolio_id}&batchId={batch_id}` |
| Navigation | **Report centre** in daily work within the shared portfolio context |
| Supported scope | One selected portfolio, or at least two active portfolios explicitly selected from the current source-backed advisor book |
| Evidence posture | Single-portfolio canonical runtime coverage plus production-browser bundle workflow and state-matrix proof; a multi-portfolio canonical seed remains required for certifying live bundle evidence |
| Primary next action | Review the report setup, submit it through Gateway, then monitor source-owned portfolio outcomes |

The portfolio-bundle option appears only when Reporting publishes the exact governed batch
capability and submission path. Development-configured caller context is bounded to explicit local
proof. The verified source path resolves `advisor.book.read` and every request-visible portfolio
against the signed principal, then sends only a delegated Gateway credential. The configured path
fails closed while the production grant authority is absent.

## Business Purpose

Report centre helps an adviser answer three operating questions without moving between technical
service consoles:

1. Which firm-approved report setup is available for this portfolio context?
2. Should the setup be applied to one portfolio or to a deliberate selection from the advisor's
   current book?
3. Which separate portfolio reports completed, remain in progress, or need attention?

The workflow reduces repeated setup for periodic portfolio reviews while retaining per-portfolio
eligibility, lifecycle, failure, and support evidence. It does not combine clients or hide partial
completion behind one bundle-level success label.

## Shared Review Context

The shell-owned **Review portfolio** strip confirms the selected portfolio and reporting context
once before report setup. It uses the same Gateway portfolio-workspace response already required
by Report centre: mandate type, booking centre, business date, and reporting currency stay visible,
while portfolio and client references remain in **Support details**.

Report centre does not repeat portfolio identity in its header or setup banner. A carried review
period that does not filter report ordering is disclosed in the strip. Report dates and currencies
inside a reviewed request remain visible because they are material request terms, not duplicate
navigation context.

The reporting rail is available only after the Gateway workspace confirms the selected portfolio.
A catalogue or route match alone is not sufficient: when the workspace is unavailable or returns
another portfolio, Report centre withholds portfolio-scoped navigation and directs the adviser to
**My book**. If the workspace identity is confirmed but a date, period, or currency control is not
supported, the rail may remain because the source portfolio—not merely the address—is still known.

## Who Uses This Screen

- **Client advisors and relationship managers** prepare a reviewed portfolio report request for a
  client meeting or periodic review and can repeat one setup across selected assigned portfolios.
- **Portfolio managers and investment specialists** use the same source-backed configuration and
  outcome evidence when supporting mandate reviews.
- **Operations and support teams** use the visible request, per-portfolio lifecycle, attempt count,
  and support reference to identify the affected report without treating the browser as the report
  worker or archive.
- **Product and demonstration teams** use the governed route and browser evidence to prove the
  workflow is Gateway-backed and state-complete.

These roles describe supported use, not production entitlement. Workbench does not infer team,
delegated, supervisory, household, or unrestricted book access.

## Workflow Position

1. Start from [Advisor Book](Advisor-Book-Workflow) or an established portfolio context.
2. Open **Report centre** and confirm the selected portfolio, business date, catalogue availability, and
   output readiness.
3. Choose **Selected portfolio** or **Portfolio bundle**. For a bundle, search and select at least
   two active portfolios returned by **My book**.
4. Choose the approved report, a source-supported report date, a published reporting currency,
   sections, and available output. When reviewed Advisor Commentary is available for that exact
   date and currency, select it without entering a system identifier.
5. Select **Review Request** or **Review Portfolio Bundle**. Material changes invalidate the review.
6. Submit the reviewed intent. Workbench shows acceptance only after Gateway accepts the request.
7. For a bundle, review the source-owned completion summary and every separate portfolio outcome.
8. Use **Create another report** only when a new reviewed request is genuinely required.

Client-ready publication, archive release, distribution, and communication are later lifecycle
controls and do not occur on this screen.

## Implemented Capabilities

- Presents Gateway-published report families, configuration fields, section choices, output
  readiness, audience, limitations, and supported submission mode.
- Bounds the report date to the source-confirmed portfolio history and offers only reporting
  currencies published for the active workspace; unsupported free-text values never enter a
  reviewed request.
- Renders catalogue-published conditional fields only for the selected report sections and includes
  their exact reviewed values in the submission. Workbench does not invent configuration fields,
  requirements, or defaults.
- Presents Advisor Commentary only when Reporting confirms an accepted Advisor Brief for the
  selected report date and currency. The exact accepted run is source-bound and not editable;
  changing either term clears the selection until refreshed availability returns.
- Preserves the current selected-portfolio workflow for one reviewed, idempotent portfolio-review
  request and recent report-data job history.
- Presents each exact request instant as readable, disclosed UTC while keeping the selected report
  date as a calendar business term. Missing, malformed, or unzoned request instants are **Not
  reported** and raw ISO values are not shown in either the comparison table or compact record.
- Offers portfolio-bundle ordering only when the exact batch capability and route are published.
- Loads up to the first 100 source-ordered Advisor Book memberships for the business date, supports
  search by client, mandate, portfolio, or booking centre, and disables inactive portfolios.
- Requires at least two explicit selections. The current portfolio is included only when it is
  source-confirmed; Workbench does not turn a global catalogue into book membership.
- Incorporates the sorted portfolio selection into the reviewed submission intent, so membership,
  date, report, output, section, or currency changes require a fresh review.
- Submits one stable idempotency key for an unchanged reviewed intent and relies on Gateway to
  verify current membership and report eligibility again.
- Admits a single-report acceptance only when its echoed idempotency key matches the exact reviewed
  intent and its Gateway status reference names the returned report job. A malformed or mismatched
  receipt remains **Report request not accepted**, preserves the reviewed setup for exact retry,
  and never publishes a support reference.
- Refreshes source-owned batch posture after acceptance and presents portfolio-report count,
  complete, in-progress, and attention measures plus each portfolio's lifecycle, attempts, and
  support reference.
- Rehydrates an addressed `batchId` from the exact Gateway batch-status contract without submitting
  another request. Workbench publishes the addressed outcomes only when the source batch identity,
  selected portfolio, review date, and any published reporting currency agree with the active
  review context; a mismatch fails closed.
- Presents recent request history as a comparison table when the module owns at least 54rem of
  content width, then as compact operational records below that capacity. This follows the module,
  not the browser viewport, so three-rail advisor layouts do not force a clipped table. Both presentations use the same
  source-backed row: report identity, report date, requested time, lifecycle, lifecycle explanation,
  and support reference are never removed for compact screens.
- Keeps the compact support reference behind a native keyboard and touch disclosure with a
  44-pixel target. The linear record avoids a nested horizontal hunt while the workstation table
  retains column comparison where there is sufficient width.
- Keeps previously source-confirmed requests visible during a background refresh and announces the
  refresh once above both presentations. Active single-portfolio requests refresh automatically;
  a transient refresh failure retains the last confirmed rows and states that current posture is
  unavailable.
- Maps only the exact Report lifecycle vocabulary. Missing or unfamiliar lifecycle and step values
  appear as **Status not reported** rather than being folded into a reassuring preparing state.
- Keeps loading, empty, restricted, degraded, unavailable, rejected, retryable, terminal, and
  partially complete states explicit.

## Decisions And Actions

| User decision or action | Required evidence or gate | Persisted business change |
| --- | --- | --- |
| Choose one portfolio or a bundle | Gateway-published submission capability; bundle also requires Advisor Book evidence | None; this changes the working setup |
| Select bundle portfolios | Active source-returned membership for the current business date | None; Gateway re-verifies on submission |
| Review the request | A valid source-supported date and currency, report, output, sections, required conditional fields, and eligible scope | None; Workbench records the exact browser intent as reviewed |
| Submit the request | The current intent must still match the reviewed intent | Gateway records the idempotent report request or batch |
| Refresh request or portfolio outcomes | A submitted request or accepted batch handle | None; Workbench re-reads source-owned lifecycle truth; active single requests also refresh on the governed cadence |
| Return to an addressed portfolio bundle | A valid `batchId` whose Gateway status agrees with the selected portfolio, review date, and any published reporting currency | None; Workbench re-reads the existing source batch and never resubmits it |
| Create another report | A prior request has been accepted | None until the new request is separately reviewed and submitted |

The browser never converts a failed submission into accepted posture and never presents a
bundle-level acceptance as proof that every portfolio report completed. The completion measure
counts only source-confirmed successful portfolio reports; retryable, terminal, and cancelled
outcomes remain separate and never inflate completion.

## Information And Source Authority

| Business fact or action | Workbench boundary | Source authority |
| --- | --- | --- |
| Approved report choices, fields, sections, outputs, and submission modes | Validated and presented through the Workbench BFF | Gateway over Lotus Report catalogue and capability contracts |
| Earliest and latest report dates, active reporting currency, and supported currencies | Reused from the confirmed portfolio workspace; presented as bounded controls rather than browser policy | Gateway portfolio-workspace contract over source-owned portfolio context |
| Conditional configuration values | Collected only when a published catalogue field applies to a selected section; submitted without browser-created aliases or defaults | Gateway over Lotus Report catalogue and request contracts |
| Reviewed Advisor Commentary | Shows accepted, review-required, context-mismatch, unknown, checking, and not-evaluated posture; submits only the exact accepted run for the active date and currency | Gateway over Lotus Report and Lotus AI review evidence |
| Advisor-book portfolio membership, active status, mandate, client reference, currency, and booking centre | Read through the Workbench BFF for selection; not reconstructed from the global portfolio catalogue | Gateway over Core `PortfolioManagerBookMembership:v1` |
| Single-portfolio report request and acceptance | Submitted only after exact intent review; accepted only when the returned key and job/status identity bind the receipt to that reviewed request | Gateway and Lotus Report portfolio-review contract |
| Portfolio-bundle handle, materialized portfolios, item lifecycle, attempts, failure summary, and support reference | Submitted, rehydrated, and refreshed through the BFF; no lifecycle is calculated from browser timers and no URL address is treated as source proof | Gateway and Lotus Report batch contracts |
| Recent single-portfolio report-data job history | Presented from the source response without implying archive or delivery | Gateway and Lotus Report job contract |
| Caller role and portfolio scope | Browser authority is removed; verified posture resolves the signed principal and exact request scope, while development posture remains server-configured | Workbench principal resolver and Gateway delegated authorization boundary |

Shared endpoint and ownership detail remains in [API Surface](API-Surface) and
[Integrations](Integrations).

## Screen States And Recovery

| State | What the user sees | Recovery posture |
| --- | --- | --- |
| Loading | Dedicated catalogue, book, job, or outcome loading evidence | Wait for the source response; no fallback catalogue or fabricated result is substituted |
| Ready | Approved choices, scope, complete request summary, review gate, and enabled actions | Confirm the portfolio/date context before review |
| Commentary review required | Advisor Commentary remains visible but cannot be selected | Open **Advisor Brief**, complete its governed review, then return and recheck availability |
| Commentary context mismatch | An accepted brief exists for a different date or currency; it is not reused | Review an Advisor Brief for the selected report context, or deliberately restore the matching report terms |
| Commentary availability unknown or not evaluated | No absence or readiness claim is made and the section remains non-selectable | Choose **Recheck availability**; do not type or infer a run identifier |
| Commentary availability refreshing | The prior commentary selection and run are cleared while the changed date/currency is checked | Wait for current source evidence; late responses for the previous context cannot become current |
| Compact request history | One record per request with lifecycle first, both dates visible, and support detail on demand | Open **Support reference** with keyboard or touch; no request field is omitted from the comparison table |
| Empty catalogue | A source-confirmed absence of orderable reports | Do not submit; follow the first support step if reports are expected |
| Empty or filtered book | No assigned portfolios, or no portfolios matching the current search | Revise the search; an empty own book cannot be replaced with the global portfolio list |
| Restricted | A source or caller boundary prevents ordering | Verify governed role and scope; do not add browser headers to bypass it |
| Degraded or partial | Available evidence remains visible with source limitations | Use only evidenced portfolios and outputs; Gateway still fails closed on unverifiable membership |
| Submission not accepted | An explicit failure with the reviewed setup retained for controlled retry | Retry only the unchanged reviewed intent or correct the setup and review again |
| Acceptance receipt mismatch | **Report request not accepted**, with no returned job or support reference promoted into the workspace | Retry the unchanged reviewed request; persistent mismatch is a Gateway/Report contract incident |
| Status not reported | The request remains visible, but no known lifecycle or step is asserted | Refresh the source evidence; do not treat the request as preparing, complete, or failed until Report publishes a recognized state |
| Single-request refresh unavailable | The last source-confirmed request rows remain visible with an explicit current-evidence warning | Choose **Refresh** to check again. Recognized active requests otherwise follow bounded automatic refresh; terminal or unreported requests do not |
| Partially complete bundle | Separate complete, in-progress, retryable, and terminal portfolio outcomes | Refresh outcomes; use the affected item's support reference if it remains unresolved |
| Addressed bundle loading | The selected portfolio context remains visible while Workbench reads the exact Gateway batch | Wait for source confirmation; Workbench does not reconstruct outcomes from the URL or submit a replacement request |
| Addressed bundle mismatch or unavailable | Explicit **Portfolio bundle could not be restored** evidence with no batch outcomes published | Return to the report setup or retry the exact source read after confirming the portfolio, review date, and currency context |
| Outcome refresh unavailable | The accepted batch and its last source-confirmed output support posture remain visible, while current item posture is marked unavailable | Choose **Try Again** or **Refresh outcomes**; newer explicit source evidence replaces the retained posture, but absent evidence never implies support or completion |
| Portfolio context changed | The prior portfolio's pending catalogue, history, submission, and outcome results cannot publish into the new workspace | Continue in the selected portfolio context; return deliberately if the prior workflow still needs attention |

## Workbench Boundaries

Report centre deliberately does not:

- create a consolidated client, household, relationship, or advisor-book report,
- infer book membership, eligibility, approval, suitability, or delivery authority,
- execute a report worker or let the browser define capacity, leases, retry policy, or materialized
  membership,
- render or download a governed PDF unless a future source contract explicitly supports it,
- publish to an archive, apply retention, release to a client, send a communication, or create an
  order,
- treat report-data completion as advisor approval, client readiness, archive publication, or
  delivery.

Technology certification, scalability, resilience, and dependency support remain centralized in
[Technology Risk and Runtime Support](Technology-Risk-and-Runtime-Support). This guide records
implemented behavior; it is not a claim of bank approval or competitor superiority.

## Adjacent Handoffs

- [Advisor Book](Advisor-Book-Workflow) supplies the source-backed own-book starting point.
- [Portfolio Review](Portfolio-Review-Screen-Guide) provides the selected mandate and attention
  context before report preparation.
- Performance, Risk, and Manage provide source analysis or workflow evidence that may inform a
  review; Report centre does not recalculate their figures.
- Archive, advisor approval, client delivery, and communication stop at an explicit boundary until
  separately supported service contracts and screens exist.

## Evidence And Validation

- Contract, API, form-model, view-model, state, hook, BFF-route, and integration tests cover single and bundle
  success and failure paths, explicit review, idempotency, authority stripping, selection fencing,
  exact single-report receipt binding, malformed receipt rejection, same-key replay, accepted-order
  continuity during history-refresh failure,
  governed date and currency controls, conditional catalogue fields, field-associated errors and
  focus, exact lifecycle mapping, retained-evidence refresh, outcome refresh, direct-address
  rehydration, identity mismatch, Back/Forward stale-response fencing, no-resubmission, and
  unsupported-action absence.
- `tests/e2e/report-centre-state.smoke.spec.ts` runs against a production Workbench build and proves
  recovery, restricted, empty, accepted, multi-portfolio outcome, keyboard, responsive-boundary,
  mobile, contrast, and horizontal-overflow posture. It directly proves recent-request lifecycle
  and support access at 1024 and 519 pixels, keyboard disclosure focus, a 44-pixel compact target,
  and no page-level horizontal overflow.
- Diagnostic browser captures are written under `output/playwright/`; they are not demo-readiness
  evidence.
- Focused contract and browser proof covers every Advisor Commentary availability reason, exact
  accepted-run submission, absence without manual fallback, date/currency refresh, and late-response
  fencing.
- Canonical front-office validation uses `PB_SG_GLOBAL_BAL_001` for selected-portfolio reporting.
  Certifying the bundle in the canonical runtime also requires at least two source-confirmed
  memberships for the governed caller and business date.
- Use [Validation and CI](Validation-and-CI) and [Operations Runbook](Operations-Runbook) for the
  governed local and exact-main validation sequence.

## First Support Step

Read the visible state and affected lifecycle without copying client references, portfolio ids, or
payloads into a support channel. Retry one source read. If the state persists, record the business
date, single-or-bundle scope, lifecycle classification, item attempt count, and only the displayed
support reference, then follow [Operations Runbook](Operations-Runbook). Do not force recovery with
browser identity headers, direct service calls, worker controls, or a second changed submission.

## Related Documentation

- [Screen Guide Catalogue](Screen-Guide-Catalogue)
- [Advisor Book](Advisor-Book-Workflow)
- [Portfolio Review](Portfolio-Review-Screen-Guide)
- [Supported Features](Supported-Features)
- [API Surface](API-Surface)
- [Integrations](Integrations)
- [Validation and CI](Validation-and-CI)
- [Operations Runbook](Operations-Runbook)
- [Security and Governance](Security-and-Governance)
- [Technology Risk and Runtime Support](Technology-Risk-and-Runtime-Support)
