# Advisor Cockpit

Advisor Cockpit is the selected portfolio's source-backed operating worklist. It brings the
advisor decision, open review actions, evidence readiness, operating boundaries, and meeting
preparation into one controlled review path. It does not evaluate policy, clear a blocker, approve
a recommendation, publish client material, or initiate an order.

## Current Scope

| Screen posture | Current truth |
| --- | --- |
| Canonical route | `/recommendations?portfolioId={portfolio_id}&mode=cockpit` |
| Navigation | **Advice**, then **Cockpit** in the selected-portfolio workflow selector |
| Availability | Implemented Gateway-backed mode behind the capability-disabled Advisory navigation posture |
| Supported scope | One entitled portfolio and its Advise-owned action, readiness, supportability, and preparation evidence |
| Primary next action | Review the named evidence and record the bounded review acknowledgement when source evidence is confirmed |

The local canonical runtime uses a bounded development principal. The verified source path requires
the signed principal's exact read or acknowledgement capability and selected portfolio scope, then
sends only a delegated Gateway credential. The configured path remains closed while the production
grant authority is absent. This guide does not claim live identity deployment, unrestricted
entitlement, or advisor-book aggregation.

## Business Purpose

Advisor Cockpit helps a client advisor answer four practical questions before a portfolio or client
discussion:

1. Which source-reported review action needs attention now?
2. What evidence, owner, review window, and dependency posture support that action?
3. What is the next business action, and may the advisor record that the review occurred?
4. Is the wider preparation evidence complete enough for internal use, and which downstream uses
   remain blocked?

The reading order is decision first: action posture, action evidence, next business action,
preparation readiness, then bounded support detail. Technical identifiers remain secondary.

## Who Uses This Screen

- **Client advisors and relationship managers** review source-owned priorities and preparation
  evidence before an internal or client-facing discussion.
- **Portfolio managers and advisory specialists** identify the evidence or dependency that an
  advisor must review without treating Workbench as policy authority.
- **Advisory operations and support teams** distinguish a source gap, permission block, partial
  refresh, or presentation defect using the visible supportability posture.
- **Product and control teams** verify that acknowledgements record review only and do not clear
  policy blockers or authorize client use.

These uses do not imply supervisory authority, delegated approval, client-delivery permission,
portfolio ownership, or production identity posture.

## Workflow Position

1. Select a portfolio through Advisor Book or another governed portfolio-selection surface.
2. Open **Advice** and choose **Cockpit**.
3. Confirm the advisor decision and source-reported action counts.
4. Review each action's status, priority, owner, review window, evidence, source gaps,
   dependencies, and next business action.
5. When an action carries a valid proposal reference, open the proposal through the action's
   supported Workbench handoff for deeper lifecycle review.
6. Record an acknowledgement only when the source evidence is current and the action permits it.
7. Confirm preparation readiness and the explicit client-publication, communication, and order
   boundaries.
8. Continue to a source record, proposal workflow, or approved support process when deeper review
   is required.

## Implemented Capabilities

- Loads the operating snapshot, action worklist, preparation packets, and supportability through
  the Workbench BFF and Gateway only.
- Presents source-counted actions in scope, pending-review actions, blocked actions, and high-priority
  actions without recomputing those counts in the browser.
- Preserves action identity, version, family, status, priority, owner, review window, reason,
  evidence, source-gap, dependency, and next-action truth returned by Advise.
- Uses the shared decision-first worklist: compact action rows identify priority, owner, and review
  window once; each action title appears once in the worklist; one selected-action pane holds the
  source action category, complete reason, evidence, constraints, and permitted next action.
- Supports Arrow Up and Arrow Down movement through action rows, Enter transfer into the associated
  decision pane, stable addressable row/detail relationships, and stacked presentation when the
  module no longer owns enough inline width.
- Keeps evidence and the next business action together in the selected pane; repeated card stacks
  and horizontally hidden action fields are not part of the operating path.
- Uses the full advisor work canvas for Cockpit actions and retains the unique source-and-scope
  boundary as a compact inline evidence band instead of an unrelated empty workflow rail.
- Shows **Open proposal** only when the action carries a valid proposal identity with an existing
  supported Workbench destination; unsupported policy, memo, report, and execution references do
  not become invented links.
- Records a bounded acknowledgement with the action version and an idempotency key.
- Scopes pending, confirmed, partial, and failed acknowledgement feedback to the selected action;
  another action never inherits that transaction state.
- Re-reads snapshot, actions, preparation, and supportability after persistence before treating the
  advisor evidence as settled.
- Shows source-owned readiness, unsupported capability boundaries, and meeting-preparation packets
  without fabricating client-ready content.
- Preserves explicit loading, empty, refreshing, partial, unavailable, and permission-blocked
  posture without fallback worklists.

## Decisions And Actions

| User decision or action | Required evidence or gate | Persisted business change |
| --- | --- | --- |
| Prioritise an advisor review | Source-reported action status, priority, owner, review window, and evidence | None; read-only review |
| Assess preparation readiness | Confirmed supportability and preparation evidence | None |
| Record review acknowledgement | Action permits acknowledgement, all required evidence is confirmed, and no acknowledgement transaction is in progress | Records review acknowledgement only |
| Continue to a deeper record | Available source record or adjacent implemented workflow | None from Cockpit |
| Escalate a source limitation | Explicit source gap, dependency limitation, partial refresh, unavailable state, or permission block | None from Cockpit |

An acknowledgement does not approve policy, waive a finding, clear a blocker, approve suitability,
authorize publication, contact a client, create an order, or claim execution.

## Information And Source Authority

| Business fact or action | Workbench boundary | Source authority |
| --- | --- | --- |
| Selected portfolio and entitlement | BFF verifies the selected portfolio against server-side development entitlement | Gateway over Core portfolio authority |
| Action counts and operating snapshot | Presents source counts without browser reconstruction | Gateway `GET /api/v1/advisor-cockpit/snapshot` over Advise |
| Action identity, status, priority, owner, window, evidence, gaps, dependencies, and next action | Shapes a decision-first worklist; preserves returned values | Gateway `GET /api/v1/advisor-cockpit/actions` over Advise |
| Preparation packets | Presents source-backed internal preparation evidence | Gateway `GET /api/v1/advisor-cockpit/preparation-packets` over Advise |
| Readiness, supportability, and unsupported-use boundaries | Translates source posture into bounded business language | Gateway `GET /api/v1/advisor-cockpit/supportability` over Advise |
| Review acknowledgement | Sends action version and idempotency evidence; strips browser authority | Gateway `POST /api/v1/advisor-cockpit/actions/{action_item_id}/acknowledgements` over Advise |
| Pending and selected-action feedback | Owns browser transaction presentation while source refresh settles | Workbench over the matching Gateway transaction |
| Proposal source handoff | Validates the action's proposal identity and links to the existing proposal-detail route; does not infer lifecycle posture | Workbench over the Gateway/Advise action reference and proposal-detail contract |

Workbench does not call Advise or Core directly. Shared contract detail remains in
[API Surface](API-Surface), and ownership flow remains in [Integrations](Integrations).

## Screen States And Recovery

| State | What the user sees | Recovery posture |
| --- | --- | --- |
| Loading | Bounded loading state without invented priorities | Wait for all required source contracts |
| Ready | Advisor decision, counts, complete actions, readiness, boundaries, and preparation evidence | Continue the review |
| No open actions | Source-confirmed empty action state | Continue to preparation readiness; do not invent urgency |
| Action details unavailable | Source total may remain visible, but missing review details are qualified | Verify source readiness before client discussion |
| Refreshing | Previously confirmed evidence remains readable but is labelled as confirmation in progress; conflicting acknowledgements are locked | Wait for all required refreshes |
| Partial | Usable evidence remains visible with the named unconfirmed source area | Qualify use and investigate the source limitation |
| Acknowledgement recording or confirming | Only the selected action shows transaction feedback and its control retains focus | Wait for source persistence and refresh |
| Acknowledgement failed | Only the selected action says the acknowledgement could not be recorded | Retry only after checking source availability; no success is implied |
| Unavailable | No fallback worklist; explicit source-unavailable state | Restore Gateway/Advise readiness or follow the approved support path |
| Permission blocked | Protected evidence is hidden behind an access-restricted state | Use an entitled role or approved support process |

A visible acknowledgement confirmation is published only after persistence succeeds. The broader
Cockpit remains partial until every required source refresh settles.

## Workbench Boundaries

Advisor Cockpit deliberately does not:

- evaluate policy, suitability, KYC, mandate compliance, or tactical house-view membership,
- approve, waive, sign off, or clear a policy or workflow blocker,
- infer client-publication readiness from internal preparation evidence,
- generate advice, client communication, a proposal, an order, routing instructions, execution,
  fills, settlement, or OMS state,
- accept browser-selected advisor, role, capability, tenant, legal entity, entitlement, or
  production principal authority,
- aggregate an advisor, team, household, or multi-portfolio book,
- replace source reason codes, versions, ids, or dependency posture with browser-authored truth.
- manufacture navigation for source-reference types that have no supported Workbench destination.

Official wealth-platform and enterprise-design research informed the exception-first workflow and
capacity-aware presentation. Lotus does not copy another product's layout, language, visual
identity, data, or unsupported capability.

## Adjacent Handoffs

- [Advisor Book](Advisor-Book-Workflow) owns source-backed own-book portfolio selection.
- [Advisory Overview](Advisory-Overview-Screen-Guide) owns proposal pipeline orientation and active
  proposal review.
- Proposal detail owns source-backed proposal lifecycle review when a Cockpit action provides the
  supported proposal handoff.
- Opportunities and Ideas owns Idea-backed opportunity triage when that capability is available.
- Proposal workflows own suitability, risk impact, approval posture, client discussion packs, and
  implementation tracking within their supported boundaries.
- Advise and advisory operations own policy evaluation, blocker resolution, and source-data repair.

## Evidence And Validation

- Focused view-model and readiness-presentation tests prove business-language projection,
  fail-closed source posture, totals-versus-detail qualification, and operating boundaries.
- `tests/unit/advisor-cockpit-action-worklist.test.tsx` proves one worklist and associated
  selected-decision region, keyboard selection and detail transfer, exact selected-action feedback,
  progressive category and reason detail, failure posture, fail-closed action controls, and absence
  of category or reason-title restatement in each row.
- `tests/e2e/advisor-cockpit-business-readiness.spec.ts` proves source-backed rendering, selected
  action persistence, reconciliation, focus stability, 44-pixel minimum action targets,
  worklist/detail association and responsive stacking, one visible valid proposal handoff,
  absence of fabricated reference routes, inline source boundary, removal of duplicate generic
  context and repeated action titles, compact measure density, the first decision row above 900
  pixels at 1440, and zero page overflow at 1800, 1440, 1024, and 519 pixels.
- Canonical validation uses `PB_SG_GLOBAL_BAL_001`, verifies the Gateway contract family and
  idempotent acknowledgement, and captures the governed Advisor Cockpit screenshot only after
  source validation passes.
- Protected PR checks, exact-main releasability, wiki publication, and strict parity remain release
  controls.

Use [Validation and CI](Validation-and-CI) and [Operations Runbook](Operations-Runbook) for the
governed validation sequence.

## First Support Step

Record the selected portfolio, visible advisor decision, action title, and whether the screen says
**Confirmation in progress**, **Action details unavailable**, **Partial**, **Unavailable**, or
**Access restricted**. For an acknowledgement failure, record the action id, version, correlation
evidence, and response status without copying client data or raw payloads. Then check the Cockpit
Gateway routes and Advise readiness through the approved operations path; do not recreate the
action or mark it acknowledged in the browser.

## Related Documentation

- [Supported Features](Supported-Features)
- [API Surface](API-Surface)
- [Integrations](Integrations)
- [Validation and CI](Validation-and-CI)
- [Operations Runbook](Operations-Runbook)
- [Technology Risk and Runtime Support](Technology-Risk-and-Runtime-Support)
- [Screen Guide Catalogue](Screen-Guide-Catalogue)
