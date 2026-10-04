# Performance Evidence

Performance Evidence is the selected portfolio's calculation-assurance review. It brings the
calculation state, lineage status, published supporting records, coverage limits, input freshness,
and source qualifications for the current performance result into one exception-first workspace.
It does not calculate performance, certify an official return, approve client release, or turn a
technical artifact into business approval.

## Current Scope

| Screen state | Current truth |
| --- | --- |
| Canonical route | `/performance?portfolioId={portfolio_id}&mode=evidence` |
| Navigation | **Performance** in global navigation, then **Evidence** in the selected-portfolio rail |
| Availability | Runtime-gated by the selected portfolio's published evidence capability |
| Supported scope | One portfolio and the current source-confirmed performance context |
| Primary reading order | Review status, review items, calculation coverage, supporting records, then technical support detail |
| Primary next action | Resolve or qualify a named exception, open a published record, or return to Summary |

The mode is read-only. It reflects the reporting window, basis, benchmark, and calculation package
returned for the current Performance workspace; it does not provide a second source-selection or
approval workflow.

## Business Purpose

Performance Evidence helps an advisor, portfolio manager, or performance-control user answer five
bounded questions before relying on a reported result:

1. Is the calculation complete and is its supporting evidence confirmed?
2. Which review items affect the package and what is the practical next step?
3. Which calculated result does each evidence record support?
4. Are input freshness, methodology, coverage, fallback, or source-availability qualifications
   present?
5. Is the package suitable for internal review, or must it remain qualified or unavailable?

The screen is deliberately exception-first. A positive status requires explicit supported states,
at least one calculation, completed calculation evidence, completed lineage evidence, and no
source-reported exception. Missing or unfamiliar states fail closed.

## Who Uses This Screen

- **Client advisors and relationship managers** check whether a performance explanation has
  sufficient calculation support for internal preparation.
- **Portfolio managers and investment specialists** identify the exact calculation or coverage
  limitation that qualifies an analytical conclusion.
- **Performance, investment operations, and control teams** review calculation lifecycle,
  lineage, freshness, methodology, fallback, and supporting records.
- **Product and support teams** use the bounded technical disclosure to route a presentation,
  Gateway-contract, or Performance-source issue without exposing technical codes in the primary
  business scan.

These uses do not imply production entitlement, performance sign-off, regulatory verification,
investment suitability, client-publication authority, or supervisory approval.

## Workflow Position

1. Enter from [Performance Summary](Performance-Summary-Screen-Guide) or
   [Performance Analysis](Performance-Analysis-Screen-Guide) after confirming the selected
   portfolio and reporting context.
2. Read the overall review status and context before opening any record.
3. Review **Control exceptions** in order and follow the named next step; do not treat a visible
   result as fully assured when its package is qualified.
4. Review **Calculation coverage** to distinguish calculation completion from supporting-evidence
   confirmation.
5. Open only source-published records through the Workbench evidence boundary when deeper review is
   required.
6. Expand **Technical support details** only for investigation, then return to Summary, Advisor
   Brief, or Risk Review through the shared workflow rail.

## Implemented Capabilities

- Presents one source-derived review status: **Ready for internal review**, **Needs attention**,
  **Incomplete evidence**, or **Assurance unavailable**.
- Requires explicit supported capability and evidence states, at least one calculation, confirmed
  calculation completion, confirmed lineage evidence, and no exception before showing the ready
  status.
- Keeps calculation coverage, review-item count, and published-record count as separate measures;
  a record count cannot imply calculation completion.
- Converts source-reported incomplete packages, lifecycle failures, pending evidence, stale or
  unknown inputs, source-availability limits, fallbacks, limitations, and unsupported dimensions
  into business review items with an impact and next step.
- Maps only known lifecycle states. Complete becomes **Confirmed**; accepted, queued, running, or
  pending states remain **In progress**; failed, rejected, cancelled, or unavailable states become
  **Needs attention**; absent or unfamiliar values remain **Not reported** or **Not confirmed**.
- Labels known calculation roles and evidence dimensions in business language without inventing a
  calculation purpose for unknown source values.
- Opens source-published input, lineage, or archived evidence records through the returned
  Workbench/Gateway route. Workbench does not synthesize an artifact.
- Presents source generation instants through the shared readable UTC audit-time authority. A
  missing, malformed, or unzoned value is **Not reported**; raw ISO transport text is retained only
  in source evidence and never promoted into the business scan path.
- Keeps services, calculation identifiers, versions, raw lifecycle states, source reasons,
  upstream snapshots, artifact routes, fallbacks, limitations, and methodology references inside
  one collapsed **Technical support details** disclosure.
- Uses semantic regions, headings, definition lists, native disclosure behavior, visible keyboard
  focus, and feature-owned responsive CSS with no page-level horizontal overflow at desktop,
  tablet, narrow, or phone widths.

## Source-Owned Performance History

**Performance history** keeps each supplied qualification with its matching calculation reference
and role. It shows **Complete history**, **Partial history**, **History unknown**, **History not
reported**, or **History not confirmed** independently of completed execution or fresh inputs.
The requested window, effective window, calculation window basis and missing observation count
remain visible. Expand **Technical support details** for covered bounds, source calendar basis,
missing-date sample, reason codes, calculation reference, result period keys and metric basis.

| Worked source example | What the reviewer sees | Interpretation |
| --- | --- | --- |
| Requested 10 Jan 2025–09 Jan 2026; effective/covered 05–09 Jan 2026; partial; available window; 360 missing natural-day observations; published return 5.0% | Partial history, requested and effective windows, Available observations, 360 missing observations; source reasons and reference in support detail | The existing return display retains the source's 5.0%. It is not a return computed from complete one-year observations. Workbench does not estimate the missing observations or recalculate the figure. |
| Complete business-weekday history requested 03–09 Jan 2026; effective 05–09 Jan; covered 01–12 Jan; zero missing observations | Complete history; all three source windows retain their different bounds; Business weekdays in support detail | Covered observations may extend beyond the request. Weekend boundaries can differ from effective observation dates. Workbench does not derive its own calendar or require the three windows to be identical. |
| Unknown history with null effective/covered bounds | History unknown and effective window Not reported | Completed execution does not establish complete history or fabricate dates. |
| Optional absent/legacy history | History not reported | Existing calculation evidence remains reviewable; there is no new historical completeness claim. |
| Malformed history, unmatched calculation reference/role, or mismatched metric basis | History not confirmed and a qualification review item | The history is not attributed to a different calculation; obtain matching source evidence. |
| Complete status with effective dates outside the requested window, effective dates outside supplied covered bounds, or a no-observations/gap reason | History not confirmed; no complete-history badge | Effective observations must lie within the requested and covered windows. Explicit zero missing observations cannot override contradictory source reasons. Wider covered bounds and legitimate calendar, exclusion or baseline differences remain permitted. |
| Two calculations or divergent entries for one calculation | Separate history entries and separate support references | A complete peer cannot hide partial or unknown history. |

History describes the **aggregate calculation window**. Result period keys identify source results;
they do not certify independent history for every period. Natural days or business weekdays are
source calendar bases, not venue holiday or bank-calendar attestation. Source figures, missing
counts, samples and reasons remain source-owned. Workbench performs only bounded validation and
presentation; it supplies no financial calculation or historical completeness engine.
Source-coherence checks compare published bounds and reasons only. They do not count required days,
infer which dates should be observations, or require requested, covered and effective windows to be
equal. Unknown history can legitimately contain supplied observations wholly outside the request
when its effective window is null and its reason reports no observations in the requested window.

The worked examples are covered by the owning view-model and rendered component tests. They are
controlled source-contract examples, not fresh producer or canonical/live consumer certification.
Joined Gateway-to-Workbench live acceptance requires separately allocated runtime evidence.

## Decisions And Actions

| User decision or action | Required evidence or gate | Persisted business change |
| --- | --- | --- |
| Treat the package as ready for internal review | Explicit supported capability and evidence states, at least one calculation, completed calculation and lineage evidence, and no source exception | None; read-only review |
| Qualify a performance explanation | Named incomplete, freshness, lifecycle, coverage, fallback, limitation, or source-availability item | None |
| Investigate a calculation | A source-published calculation record or bounded support detail | None |
| Open supporting evidence | A source-returned artifact or approved archive download route | None; opening the record does not approve it |
| Continue to another Performance mode | Available selected-portfolio mode in the shared rail | None from Evidence |

The screen has no local approve, certify, waive, refresh, upload, archive, report-order, client-send,
trade, or execution action.

## Information And Source Authority

| Business fact or action | Workbench boundary | Source authority |
| --- | --- | --- |
| Portfolio, reporting window, return basis, and benchmark context | Presents the current source-confirmed Performance workspace context; unfamiliar source or active-workspace period codes fail closed instead of becoming review-ready | Gateway Performance summary and detail contracts; Workbench owns only its supported period vocabulary |
| Evidence capability and package state | Admits only explicit states and fails closed on missing or unfamiliar values | Gateway over Performance authority |
| Calculation lifecycle, execution mode, stage status, and calculation reason | Maps known values to bounded business status; does not infer completion | Performance evidence projected through Gateway |
| Lineage, input freshness, upstream snapshots, methodology, coverage, fallback, limitation, and source availability | Prioritises exceptions and keeps raw values in support detail | Performance evidence projected through Gateway |
| Calculation history, requested/covered/effective windows, missing observations, calendar and calculation basis | Binds each supplied qualification to matching calculation role/id and basis; retains absent, malformed and divergent evidence without recomputing it | Performance history qualification projected through Gateway; aggregate calculation window only |
| Published evidence record and archive route | Labels and opens the returned Workbench/Gateway route | Gateway evidence or document boundary over the source-published reference |
| Business status, ordered exception presentation, and disclosure state | Pure presentation derived from the returned package | Workbench over source-owned evidence; not a new assurance authority |

The browser uses the Workbench BFF and Gateway. It does not call Performance, Core, Risk, Report, or
Archive services directly. Shared endpoint detail remains in [API Surface](API-Surface), and the
ownership flow remains in [Integrations](Integrations).

## Screen States And Recovery

| State | What the user sees | Recovery |
| --- | --- | --- |
| Initial loading | The parent Performance workspace loading state; no fabricated assurance result | Wait for the selected portfolio contracts |
| Ready | **Ready for internal review**, zero review items, and confirmed calculation plus evidence status | Continue internal review; this is not client-release approval |
| Needs attention | A failed, stale, rejected, cancelled, or unavailable source condition and the affected next step | Obtain refreshed source evidence before relying on the affected result |
| Incomplete evidence | Pending, partial, unknown, limited, fallback, unsupported-coverage, or unconfirmed evidence remains visible and qualified | Keep the result within internal review and investigate the named item |
| No calculation evidence | Explicit zero-calculation state; the package is not treated as assured | Ask Performance support to publish calculation-level evidence |
| No supporting record | The calculation remains visible with an explicit absence of published records | Do not infer that an artifact exists |
| Assurance unavailable | The capability or package is unavailable, hidden, or unusable | Re-establish supported source context or follow the approved support path |
| Permission blocked | The parent Performance workspace fails closed without restricted data | Use an entitled role or approved support path |
| Technical detail collapsed | Business status remains visible; raw identifiers and routes stay out of the first scan | Expand only for support investigation; keyboard focus stays on the disclosure control |

Evidence has no screen-local retry action. A support response must not promise one. Re-contacting the
source currently occurs through the Performance workspace reload or an approved operational
support path.

## Workbench Boundaries

Performance Evidence deliberately does not:

- calculate or recalculate time-weighted, money-weighted, annualised, benchmark, active,
  contribution, attribution, fee, currency, or risk measures;
- infer success from a terminal-looking string, an artifact count, a correlation identifier, an
  empty exception list, or a visible performance result;
- construct lineage, methodology, freshness, source supportability, calculation stages, upstream
  snapshots, evidence artifacts, or archive metadata;
- certify GIPS compliance, official books and records, audit completion, regulatory approval,
  valuation approval, performance sign-off, or client-release readiness;
- approve, waive, amend, rerun, upload, archive, distribute, or delete evidence;
- create advice, suitability decisions, proposals, reports, communications, trades, orders,
  executions, fills, settlement, or reconciliation;
- use raw technical values as primary business status or call another Lotus domain service from the
  browser.

## Adjacent Handoffs

- [Performance Summary](Performance-Summary-Screen-Guide) owns headline return, benchmark-relative
  outcome, return path, horizon comparison, and contributor leadership.
- [Performance Analysis](Performance-Analysis-Screen-Guide) owns contribution, attribution, and
  historical analytical detail.
- [Performance Advisor Brief](Performance-Advisor-Brief-Screen-Guide) owns source-backed internal
  preparation and bounded human review; Evidence does not approve that narrative.
- Risk Review owns downside and concentration context when its source capability is available.
- [Portfolio Review](Portfolio-Review-Screen-Guide) returns to the selected mandate's broader review
  flow.

## Evidence And Validation

- Pure state projection and fail-closed mappings:
  `tests/unit/performance-evidence-assurance-view-model.test.ts`.
- Typed business-copy ownership and prohibited technical-language protection:
  `tests/unit/performance-evidence-copy.test.ts`.
- Business hierarchy, artifact routes, technical-detail containment, and honest empty/degraded
  states: `tests/unit/performance-evidence-mode.test.tsx`.
- Parent Performance composition and unavailable-mode behavior:
  `tests/integration/performance-analytics-page.test.tsx`.
- Optimized-production browser proof:
  `npm run test:e2e:performance:evidence-assurance`, backed by
  `tests/e2e/performance-workbench.smoke.spec.ts`.
- Malformed-period browser proof:
  `npm run test:e2e:performance:evidence-period-assurance`, proving that matching unfamiliar source
  and workspace periods remain **Needs attention** and cannot become demo-ready.
- Canonical browser validation uses `PB_SG_GLOBAL_BAL_001` through
  `scripts/live/validation/browser-workflows.mjs` and records the machine-readable
  `data-assurance-state` plus the evidence-panel screenshot.

The browser proof covers source-derived review status, exception and calculation regions, closed-by-default
technical detail, keyboard operation, focus stability, and no horizontal page overflow at 1024,
720, and 390 pixels. A fixture, test, or screenshot alone is not production entitlement,
calculation certification, bank approval, GIPS verification, or client-use proof. This design is
informed by industry exception-control and substantiating-record principles; it is not a claim of
competitor superiority.

## First Support Step

Record the selected portfolio, reporting window, return basis, benchmark, visible review status,
and first named review item without copying client-identifying payloads. If technical investigation
is authorised, expand **Technical support details** and capture the calculation identifier, source
reason, and relevant correlation evidence. Then follow [Troubleshooting](Troubleshooting) or the
[Operations Runbook](Operations-Runbook). Do not label a missing record as source failure unless the
source package reports that failure.

## Related Documentation

- [Supported Features](Supported-Features)
- [API Surface](API-Surface)
- [Integrations](Integrations)
- [Performance Summary](Performance-Summary-Screen-Guide)
- [Performance Analysis](Performance-Analysis-Screen-Guide)
- [Performance Advisor Brief](Performance-Advisor-Brief-Screen-Guide)
- [Validation and CI](Validation-and-CI)
- [Operations Runbook](Operations-Runbook)
- [Technology Risk and Runtime Support](Technology-Risk-and-Runtime-Support)
