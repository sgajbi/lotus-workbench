# Rebalance Waves

Rebalance Waves is the selected portfolio's source-backed rebalance review and controlled handoff
workspace. It keeps the current mandate and currency context, source readiness, proposed changes,
blocked actions, evidence posture, and the next permitted step in one decision path. Workbench
does not calculate a rebalance, approve a trade, or report execution.

## Current Scope

| Screen posture | Current truth |
| --- | --- |
| Canonical route | `/workbench/{portfolioId}?mode=waves` |
| Navigation | **Manage**, then **Rebalance Waves** in the selected-portfolio workspace |
| Supported scope | One selected portfolio, the active Manage wave returned through Gateway, and one selected Manage campaign decision at a time |
| Primary reading order | Source context, readiness, active rebalance, proposed changes, optional decision support, then campaign administration |
| Evidence posture | Source proof is separately labelled ready, not opened, not requested, being prepared, needing review, blocked, unavailable, or not reported |

The mode is active in the Manage workspace. Route access is not proof that a wave, approval,
evidence pack, handoff, order, execution, or settlement record exists.

## Business Purpose

The screen helps a portfolio manager answer six practical questions:

1. Which mandate, portfolio currency, and source date govern this rebalance review?
2. Is the active wave sufficiently supported to continue, or do data and mandate issues block it?
3. Which holdings would change, why, and what mandate impact did the source report?
4. Which source-owned action is currently permitted: preview, data check, simulation, approval
   request, staging, handoff preparation, or evidence review?
5. Is optional internal commentary or campaign administration required after the selected
   portfolio decision has been reviewed?
6. For a campaign in scope, which source record needs attention, what is its current readiness,
   and is the next governed task review, governance, lifecycle control, or launch?

The selected rebalance decision leads. AI-assisted material and campaign administration remain
supporting workflows and do not displace the portfolio decision.

## Who Uses This Screen

- **Portfolio managers and discretionary mandate specialists** review readiness, proposed changes,
  blocks, and the next source-permitted handoff.
- **Investment specialists and client advisors** use the source context and proposed-change reasons
  to prepare an internal discussion without treating the screen as an order-management system.
- **Investment operations and portfolio support teams** review staging, handoff, proof, and source
  limitations before following the owning operational process.
- **Control, product, and support teams** distinguish Workbench presentation from Gateway or Manage
  source defects.

These uses do not imply production entitlement, delegated authority, supervisory approval,
client-delivery authority, or execution authority.

## Workflow Position

1. Enter from [Manage Overview](Manage-Overview-Screen-Guide) for the selected portfolio.
2. Confirm the source-reported mandate type, portfolio currency, and as-of date. Missing or governed
   unavailable values render **not reported**; the screen never inserts a model mandate or USD.
3. Review readiness, issue count, blocked actions, and the active wave before using any action.
4. Review the proposed changes, source reasons, and mandate impact.
5. Perform only the enabled Gateway-backed next step and read its explicit pending, success, or
   failure evidence.
6. Prepare optional internal decision support or continue into campaign administration only when
   that broader workflow is relevant.
7. In campaign administration, choose one source record from the keyboard-operable worklist. Review
   its identity, eligible portfolio count, source readiness, governance, and launch posture before
   entering one task mode.
8. Use **Review posture**, **Governance action**, **Lifecycle control**, or **Launch decision**. The
   screen keeps one task visible at a time and places technical lifecycle and replay evidence behind
   named disclosures.
9. Confirm the stated consequence before a retirement, supersession, or launch command. A launch
   confirmation is cleared when Manage returns a durable wave, preventing an immediate accidental
   repeat.
10. Open the proof pack or supported downstream Manage handoff; do not infer execution from staging
   or handoff readiness.

## Implemented Capabilities

- Presents mandate type and portfolio currency from the current Manage/Core-backed workspace
  context, and the wave as-of date from the Manage wave response.
- Keeps the calendar-semantic wave date distinct from exact campaign, lifecycle, launch, review,
  and workflow audit instants. Exact instants require a source offset and render in disclosed UTC;
  absent or ambiguous values fail closed instead of using a fixed date or browser timezone.
- Presents source-owned wave lifecycle, item and issue counts, supportability, reason codes,
  blocked actions, source readiness, and remediation posture.
- Loads the active wave's proposed changes and shows security, proposed action, source-estimated
  value, source reason, mandate impact, and status in a compact analytical table.
- Sends preview, create, source-check, simulation, approval-request, staging, handoff-preparation,
  proof-posture, report-input, and evidence requests through the Workbench BFF and Gateway.
- Keeps selected-wave responses fenced to their source wave identity so older detail and AI
  responses cannot be relabelled as current.
- Maps evidence posture into truthful business copy instead of using colour to call every state
  available.
- Offers governed AI-assisted PM memo and operations-brief preparation only after the selected
  rebalance decision and proposed changes in document order.
- Presents active campaign definitions as a reusable selected-record decision workspace rather than
  a page-local table. The compact worklist retains campaign identity and source triage; the decision
  pane refreshes only the selected campaign's lifecycle, launch, workflow, and readiness evidence.
- Keeps every selected-campaign response, pending state, and error fenced to campaign id and version,
  so a late response for Campaign A cannot appear under Campaign B.
- Presents the Manage service-posture value `ATTENTION` as **Needs attention** while preserving the
  source enum in every submitted command. The business label does not rewrite the Gateway or Manage
  contract.
- Labels the operating, approval, assignment, and review queue summary as book-wide and keeps it
  outside the selected-campaign pane; only id/version-filtered evidence appears under that identity.
- Separates review, governance, lifecycle, and launch tasks; uses progressive disclosure for technical
  trace; requires a human business rationale and explicit consequence acknowledgement for supported
  lifecycle and launch mutations.
- Routes browser-triggered campaign reads, refreshes, and commands through the same-origin Workbench
  BFF. Server composition may contact Gateway server-side; the browser never contacts Manage or a
  Gateway hostname directly.
- Removes unsupported controls rather than rendering a no-op affordance; the proposed-change table
  has no browser-only filter.

## Decisions And Actions

| Decision or action | Required source gate | Persisted effect |
| --- | --- | --- |
| Treat the active wave as ready | Matching Manage wave identity and explicitly confirmed `READY` supportability | None; read-only review |
| Load proposed changes | A selected source wave and no conflicting request in progress | Re-contacts Gateway for source items; no portfolio mutation |
| Run source check or simulation | Action not blocked by the returned wave contract | Manage records the returned workflow progression |
| Request approval | Ready panel and no source-reported issue, reason, or approval block | Manage records an approval request; Workbench does not approve it |
| Stage or prepare handoff | The exact source action is enabled | Manage records staging or handoff posture; no order or execution is claimed |
| Open evidence | A selected wave and supported proof action | Reads or requests source-owned evidence posture |
| Prepare PM memo or operations brief | Selected wave plus governed AI workflow availability | Creates an internal review-gated workflow-pack result, not client communication |
| Review a campaign | Selected campaign id and version | Refreshes only that record's source evidence; no mutation |
| Record a governance action | Exact selected campaign plus the typed action fields and business rationale | Manage owns the approval, assignment, task, transition, or maker-checker evidence |
| Retire or supersede a campaign | Exact selected campaign, source-supported replacement where applicable, business rationale, and explicit consequence confirmation | Manage records the lifecycle change; Workbench refreshes definitions and exact lifecycle evidence |
| Launch a campaign | Selected campaign, Manage-returned `READY` launch package, and explicit consequence confirmation | Manage owns the durable campaign event and returned wave identity; the confirmation resets after success |

Wave supportability confirms readiness only when the source explicitly returns `ready`, ignoring
letter case and surrounding whitespace. `blocked` stays blocked. Degraded, partial, unknown,
unavailable, unsupported, unfamiliar, missing, and blank values remain qualified as partial; a wave
record or populated list cannot make them ready. An empty response also retains that non-ready
qualification. A confirmed-ready response with no wave or rows is empty; an absent source response
is unavailable. Source reasons, blocked actions, and selected-wave identity checks are preserved.
Approval readiness and **Request Approval** remain withheld for partial, blocked, empty, or
unavailable panels, in addition to the existing source issue, reason, and action gates.

Pending actions disable conflicting controls. Success is shown only from the returned source
response. If persistence succeeds but the evidence refresh fails, Workbench preserves the recorded
action evidence, reports the read failure separately, blocks a duplicate lifecycle action, and offers
a read-only source-evidence reload instead of claiming that the mutation failed.

## Information And Source Authority

| Business fact or action | Workbench boundary | Source authority |
| --- | --- | --- |
| Portfolio identity and currency | Presents selected workspace context without conversion or accounting calculation | Gateway over Core portfolio context |
| Mandate type | Presents the current mandate field or **Mandate not reported** | Gateway over Manage mandate context |
| Wave lifecycle, readiness, blocks, counts, and proposed changes | Validates, formats, and identity-fences Gateway responses | Manage through Gateway wave contracts |
| Preview, source check, simulation, approval request, staging, and handoff | Sends bounded commands through the BFF; does not infer success | Manage through Gateway command contracts |
| Proof pack and report-input posture | Maps exact returned evidence state to business copy | Manage and Report through Gateway |
| PM memo and operations brief | Shows AI-assistance disclosure and returned source references | Manage and Lotus AI through Gateway workflow-pack contracts |
| Campaign definition and discovery worklist | Presents source records without inventing total-book priority, ownership, or SLA | Manage through Gateway campaign contracts |
| Selected lifecycle, launch, approval, assignment, task, and maker-checker evidence | Fetches the selected id/version through `/api/bff/api/v1/...`; identity-fences pending, result, and error state | Manage through Gateway selected-campaign contracts |
| Campaign service posture | Presents `ATTENTION` as **Needs attention** and submits the unchanged source enum | Manage through Gateway campaign workflow contracts |
| Campaign lifecycle, governance, and launch commands | Sends the exact typed body through the BFF, waits for source persistence, then refreshes selected evidence | Manage through Gateway mutation contracts |

The browser calls only `/api/bff/api/v1/...`. Shared endpoint detail is documented in
[API Surface](API-Surface), and source ownership is documented in [Integrations](Integrations).

## Screen States And Recovery

| State | User-visible posture | Recovery |
| --- | --- | --- |
| Initial loading | Manage workspace loading; no default mandate, currency, wave, or readiness | Wait for the Gateway response |
| Ready | Source context, active wave, and permitted actions are visible | Continue with the required review |
| Partial or degraded | Named readiness limitations remain visible with available source evidence | Resolve the named input or repeat the exact supported action |
| Blocked | Approval or another action is disabled with source reason posture | Resolve the source-owned attention item; do not bypass the gate |
| Empty | No active rebalance proposal is available for the selected context | Confirm portfolio and source window before creating or previewing a wave |
| Unavailable | Rebalance data cannot be loaded; portfolio context remains outside the result | Verify Gateway and Manage, then reload the route |
| Permission blocked | Restricted evidence and actions fail closed | Use an approved access path; do not copy evidence into a fallback |
| Evidence not opened or not requested | No proof result is claimed | Open or request evidence if the action is supported |
| Evidence being prepared | An exact source request is pending | Wait; conflicting actions remain disabled |
| Evidence needs review, blocked, or unavailable | The badge names the non-ready state | Review the returned reason and owning source before proceeding |
| Action failure | Business-safe error remains near the decision flow | Retry the same source action only after checking the context |
| Campaign action recorded, evidence refresh failed | Recorded source evidence remains visible and the refresh failure is separate | Use **Reload lifecycle evidence** or **Reload governance evidence**; do not repeat the mutation |
| Campaign selection changes during refresh | New selection remains authoritative; late prior-record evidence is discarded | Continue with the selected campaign; repeat the source read only if its own state needs attention |
| Successful campaign launch | Durable wave identity is shown and launch acknowledgement resets | Review the returned wave; do not repeat the command unless a new governed launch is intended |

Reloading the route re-contacts the Workbench BFF. A screenshot or favourable badge does not
replace the machine-readable response.

## Workbench Boundaries

Rebalance Waves deliberately does not:

- calculate proposed trades, portfolio weights, risk, tax, turnover, cash, mandate impact,
  suitability, compliance, priority, readiness, or campaign membership,
- substitute a hard-coded mandate, currency, date, evidence state, owner, reason, or action,
- treat source check, simulation, approval request, staging, or handoff as approval or execution,
- generate orders, route trades, acknowledge fills, settle transactions, book custody records, or
  reconcile accounting,
- publish client communication or use an internal AI-assisted memo as approved advice,
- infer a selected-portfolio wave from an identifier string or another unstructured field,
- call Manage, Core, Report, Lotus AI, an OMS, broker, custodian, or settlement provider directly.

Official platform research informed the exception-first hierarchy and human-control pattern. Lotus
does not copy another product's layout, language, brand, calculation, or unsupported feature, and
this guide is not a claim of competitor superiority.

## Adjacent Handoffs

- [Manage Overview](Manage-Overview-Screen-Guide) is the selected-portfolio operating checkpoint.
- Mandate Health owns detailed mandate evidence and attention review.
- Construction Alternatives owns governed alternative generation and comparison.
- Portfolio Memory owns source-recorded decisions and operating events.
- [Outcome reviews](Outcome-Reviews-Screen-Guide) owns expected-versus-realised evidence.
- Evidence Pack owns the broader selected-portfolio proof record.
- [Report Centre](Report-Centre-Screen-Guide) owns supported report ordering; this screen does not
  publish a client report.

## Evidence And Validation

- `tests/unit/dpm-wave-command-center-panel-helpers.test.ts` proves non-USD context, unavailable
  sentinels, source dates, and every governed proof label/tone.
- `tests/unit/dpm-wave-command-center-panel.test.tsx` proves decision-first document order, no
  hard-coded context, no no-op Filter control, existing action gates, selected-wave fencing, and
  Gateway-backed campaign workflows.
- `tests/unit/dpm-campaign-definitions-section.test.tsx`,
  `tests/unit/use-dpm-wave-command-center-actions.test.ts`, and `tests/unit/workbench-api.test.ts`
  prove the shared selected-record workspace, one-task-at-a-time controls, typed command bodies,
  campaign-identity fencing, book-wide versus selected-record scope, same-origin BFF routing,
  persistence-versus-refresh truth, read-only recovery, repeat prevention, confirmation reset, and
  explicit failure.
- `tests/integration/workbench-page.test.tsx` and
  `tests/unit/manage-workspace-components.test.tsx` prove selected-portfolio Manage composition.
- `scripts/live/validation/browser-workflows.mjs` owns canonical populated Manage browser proof for
  `PB_SG_GLOBAL_BAL_001`; a route screenshot alone is not source-readiness evidence.
- `tests/e2e/manage-rebalance-workspace.spec.ts` proves the optimized-production source context,
  primary section order, proposed-change read, two-record keyboard selection, focus stability after
  asynchronous evidence refresh, selected campaign identity, launch consequence gating, durable
  launch response, repeat prevention, 1440/1024/720/390 reflow, clean browser runtime, and zero
  page-level horizontal overflow against a process-owned Gateway fixture.
- Protected PR checks, exact-main releasability, production-browser reflow, wiki publication, and
  strict parity remain release controls.

Use [Validation and CI](Validation-and-CI) and [Operations Runbook](Operations-Runbook) for the
governed validation sequence.

## First Support Step

Confirm the selected portfolio, mandate label, currency, wave identity, and evidence badge. Record
the first business-safe failure and correlation evidence through the approved support channel,
without copying client payloads. If the context says **not reported**, verify Gateway/Core or
Gateway/Manage source publication; do not substitute USD, a default mandate, or a positive badge.

## Related Documentation

- [Screen Guide Catalogue](Screen-Guide-Catalogue)
- [Manage Overview](Manage-Overview-Screen-Guide)
- [Supported Features](Supported-Features)
- [API Surface](API-Surface)
- [Integrations](Integrations)
- [Validation and CI](Validation-and-CI)
- [Operations Runbook](Operations-Runbook)
- [Technology Risk and Runtime Support](Technology-Risk-and-Runtime-Support)
