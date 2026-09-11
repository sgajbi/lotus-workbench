# Manage Overview

Manage Overview is the selected portfolio's exception-led portfolio-management checkpoint. It
helps a portfolio manager establish whether mandate evidence is usable, whether open items need
attention, and which source-owned Manage workspace should be opened next. It does not manufacture
readiness, risk profile, priority, alternatives, or workflow completion in the browser.

## Current Scope

| Screen posture | Current truth |
| --- | --- |
| Canonical route | `/workbench/{portfolioId}`; Overview is the default mode, while explicit `mode=overview` is accepted as an equivalent entry |
| Navigation | **Manage** in the selected-portfolio Workbench rail, then **Overview** in Manage workspace navigation |
| Supported scope | One Gateway-backed portfolio and its current Core and Manage evidence |
| Primary reading order | Left-rail workflow navigation, centre operating posture and measures, decision worklist, selected decision, then distinct source evidence in the right rail |
| Primary next action | Resolve an attention item in Mandate Health or continue to the Manage work area required for the next decision |

The screen is portfolio-scoped. It does not aggregate a portfolio-manager book, household, team,
legal entity, or enterprise queue. Advisor Book owns supported portfolio selection; a different
portfolio starts a new source request.

## Business Purpose

Manage Overview helps a portfolio manager answer four bounded questions before working on the
portfolio:

1. Are mandate-health, data-readiness, rebalance, and attention facts available and usable?
2. What portfolio value, position count, cash weight, and mandate risk profile are currently
   reported?
3. Which active mandate items need attention, who is recorded as owner, and what is the next
   source-supported step?
4. Which Manage work area should be opened to continue the portfolio-management workflow?

Incomplete evidence and active exceptions lead the screen. Navigation follows the decision
posture, so the page operates as a work checkpoint rather than a feature catalogue.

## Shared Review Context

The shell-owned **Review portfolio** strip is the only portfolio-identity summary on Manage. It
combines the exact Gateway-backed portfolio and mandate evidence into portfolio and client
references, mandate type, booking centre, source business date, and source currency. References
remain in **Support details** so the first scan stays business-focused.

Manage does not repeat those facts in the decision rail. Carried advisor review dates, periods, or
currencies that the current Manage contracts cannot apply remain explicit as a compact source-scope
notice. If the route portfolio is not confirmed by the response, Manage exposes no portfolio-scoped
recovery link and directs the user back to **My book**.

## Who Uses This Screen

- **Portfolio managers and discretionary mandate specialists** review operating posture and move
  into mandate, rebalance, construction, memory, quality, outcome-review, or evidence work.
- **Client advisors and investment specialists** use the portfolio context and visible limitations
  to understand whether a mandate discussion is sufficiently supported before deeper review.
- **Investment operations and portfolio support teams** identify missing evidence and source-owned
  attention items without treating the Workbench as the system of record.
- **Product, control, and support teams** distinguish Workbench presentation from Core portfolio or
  Manage workflow-source defects.

These uses do not imply production entitlement, delegated authority, supervisory sign-off,
investment approval, client-delivery authority, or execution authority.

## Workflow Position

1. Enter from Advisor Book, Portfolio Review, or another selected-portfolio surface.
2. Confirm the selected portfolio and the reported portfolio value, positions, cash weight, and
   mandate risk profile.
3. Read **Evidence incomplete**, **Action required**, or **Ready for review** before using the
   remaining posture.
4. Move through the combined decision worklist: returned mandate-attention items lead, followed by
   the selected portfolio's rebalance posture and the supported Manage workflow handoffs.
5. Review the selected item's evidence and one source-supported next action in the adjacent pane.
6. When more attention-source views exist, open
   [Mandate Health](Mandate-Health-Screen-Guide) to continue the bounded investigation.

The overview does not complete a business action. It preserves selected-portfolio context while
handing the user to a focused Manage mode.

## Implemented Capabilities

- Presents Core-owned portfolio value, position count, cash weight, base currency, identity, and
  readable calendar business date through the Workbench BFF and Gateway; raw ISO date text is not
  used as advisor-facing rail copy.
- Keeps calendar business dates distinct from exact workflow and audit instants. Exact instants
  require a source timezone or offset, render through the shared UTC presentation authority, and
  fail closed to **Not reported** when missing or ambiguous; the overview does not invent a fixed
  demonstration date to preserve a favourable workflow posture.
- Presents the mandate risk profile only when Manage reports a usable value; absent and governed
  unavailable values such as `UNKNOWN` or `NOT_AVAILABLE` are **Not reported** and make the
  overview incomplete.
- Summarises Manage-owned mandate health, data readiness, rebalance stage, and active attention
  count without replacing missing values with favourable defaults.
- Keeps valid first-source-view attention items visible when more source views exist, labels that
  posture explicitly, and claims zero only when the source evidence is complete, non-degraded, and
  exhaustive.
- Uses the shared decision-first worklist for source-returned mandate attention and the
  selected-portfolio rebalance decision. Each worklist destination appears once in the primary path
  rather than in a second task directory or recent-activity catalogue.
- Keeps compact row identity and posture in the selector while the associated pane shows the
  selected evidence and next permitted action. Arrow-key movement, Enter detail transfer, and
  responsive stacking use the same design-system contract as Advisor Cockpit.
- Keeps active rebalance stage, source readiness, issue count, and support note distinct from order,
  execution, and settlement posture, and presents them only when the wave contract explicitly
  includes the selected portfolio. Response-level wave supportability supplements a selected row
  only when both carry the same source wave identity; row evidence remains authoritative.
- Provides one keyboard-accessible entry for every source-returned mandate attention item, adds an
  explicit evidence-boundary entry when that source window is partial or unavailable, and always
  includes the selected portfolio's rebalance decision. These entries hand off only to Mandate
  Health or Rebalance Waves; the other Manage work areas remain available through Manage
  navigation and are not presented as decision-worklist records.
- Presents portfolio value, positions, cash weight, and risk profile as one compact horizontal
  measure strip ahead of the decision worklist.
- Shows one **Checked** receipt only when the full Overview composite was admitted, and provides one
  **Recheck overview** action that rereads the exact portfolio, command-centre, active-exception,
  mandate, dependent mandate-health, and rebalance-wave sources. Focus, reconnect, and remount do
  not trigger ambient reads.
- Assigns one owner to each information job: the Workbench left rail owns Manage destinations, the
  centre workspace owns operating posture and decisions, and the right rail owns only distinct
  source-evidence availability, monitoring-record, and traceability facts. The evidence rail does
  not restate destinations, attention, data-readiness, or rebalance posture.
- Treats a historical evidence-pack reference separately from a currently usable pack. The rail
  normalizes the same Gateway envelope used by the centre panel: **Available** and **Partially
  available** require a usable pack identity, while **Blocked**, **Not supported**, **Not linked**,
  and **Temporarily unavailable** retain the source supportability boundary. It reports
  **Referenced; not retrieved** only when lineage exists without a current response.
- Shares the current fetched pack across the Manage workspace, so a successful **Load evidence** or
  **Prepare evidence** action updates the centre panel and adjacent evidence rail together without
  requiring a page reload. Stable portfolio identity preserves that confirmed pack across Manage
  mode changes; transport correlation IDs do not reset it. A successful response clears the prior
  preload failure in both regions, while failed actions retain the last confirmed source posture.

## Decisions And Actions

| User decision or action | Required evidence or gate | Persisted business change |
| --- | --- | --- |
| Decide whether the overview is usable | Core portfolio context plus available Manage mandate, health, exception, and wave evidence | None; read-only review |
| Recheck the displayed overview | The same six-read selected-portfolio composite; every response must succeed and remain bound to the active review context | None; advances browser receipt time only after complete admission |
| Treat the attention count as zero | Complete, non-degraded, untruncated active-exception response | None |
| Investigate an attention item | Source-returned item and its next-step link | None from Overview; opens Mandate Health |
| Continue portfolio management | A source-backed mandate-attention, evidence-boundary, or rebalance record in the decision worklist | None from Overview; opens Mandate Health or Rebalance Waves with portfolio context preserved |
| Generate construction alternatives | Not available on Overview | Performed only from Construction Alternatives through its governed Gateway action |

Opening a work area does not create a recommendation, proposal, client communication, report,
portfolio instruction, order, execution, settlement record, or approval.

## Information And Source Authority

| Business fact or action | Workbench boundary | Source authority |
| --- | --- | --- |
| Portfolio identity, base currency, business date, market value, positions, and cash weight | Formats the selected portfolio context through the governed calendar-date authority; does not recalculate portfolio accounting or convert the date into an instant | Gateway over Core portfolio contracts |
| Mandate risk profile, health, data readiness, and monitoring posture | Maps source values into business labels and fails closed for missing evidence | Gateway over Manage mandate and command-centre contracts |
| Active attention items, owner, severity, age, and next step | Limits presentation to the current returned window and never infers a whole-book queue | Gateway over Manage exception contracts |
| Rebalance stage, source readiness, issue count, and support note | Presents source-owned wave posture without execution claims | Gateway over Manage rebalance-wave contracts |
| Manage workflow navigation | Builds portfolio-preserving Workbench routes to implemented modes once in the shell-owned left rail | Workbench over the registered Manage navigation |
| Evidence-pack, monitoring-record, and traceability availability | Derives bounded presentation facts from the already returned source evidence; does not create another operating-status authority | Workbench over Gateway-returned Core and Manage evidence |
| **Checked** receipt and recheck state | Owns Query identity, cancellation, complete-composite admission, and browser receipt time; does not derive business freshness | Workbench client state over the six Gateway-backed reads above |

Workbench uses the BFF and Gateway. It does not call Core or Manage directly. Shared contract detail
remains in [API Surface](API-Surface), and ownership flow remains in
[Integrations](Integrations).

## Screen States And Recovery

| State | What the user sees | Recovery posture |
| --- | --- | --- |
| Initial loading | Bounded selected-portfolio loading; no fabricated portfolio-management result | Wait for Gateway responses |
| Ready for review | Required overview evidence is present and no active attention item is reported | Continue to the required work area; this is not approval or all-clear authority |
| Action required | Source evidence is usable and one or more active attention items are reported | Review the worklist and open Mandate Health |
| Evidence incomplete | One or more named overview facts or source surfaces are missing or failed | Use the named partial-state list and open the relevant focused mode when available |
| Rechecking | Existing admitted evidence remains visible while the exact six-read composite is requested once | Wait for completion; repeated submission is disabled |
| Recheck failed | Prior admitted evidence and receipt remain visible with an explicit failure message | Use **Recheck overview** again; no failed or partial replacement is promoted |
| Attention evidence unavailable | No zero-attention conclusion; the worklist explains the missing evidence | Re-establish the source response or follow the support path |
| Partial source view | Returned items remain visible as **N shown**, with the bounded source view and unconfirmed total stated explicitly | Open Mandate Health to review the available evidence; continue through source views when pagination is available |
| Empty attention worklist | Source-confirmed statement that the current window has no active items | Continue the review without inferring enterprise-wide absence |
| Missing or unavailable risk profile | **Not reported** plus a named incomplete surface | Review the Manage mandate source; do not assume a balanced profile or treat an unavailable sentinel as evidence |
| Wave supportability identity mismatch | Row-confirmed evidence only; unmatched response-level state, counts, readiness, and reason are not borrowed | Open Rebalance Waves and reconcile the source wave identity |
| No portfolio-scoped wave | **Not available**, **Wave: Not reported**, and no borrowed item or issue count | Open Rebalance Waves for the broader source worklist; do not infer membership from an identifier |
| Portfolio unavailable | Manage workspace unavailable state with supported Portfolio or Performance handoff | Confirm the portfolio context, then follow the approved support process |
| Permission blocked | The owning source request fails closed; restricted evidence is not rendered as current | Use an entitled role or approved support path |

The initial route supplies one server-composed Overview. TanStack Query owns that exact hydrated
composite in the browser. **Recheck overview** is the only screen-local source transaction: it
contacts all six required BFF paths once and advances **Checked** only when every response is
admitted for the active portfolio and review context. An ordinary failure retains the previous
admitted evidence and receipt with an explicit failure state; a permission refusal withholds the
evidence. Delayed results cannot cross portfolio or review-context boundaries.

## Workbench Boundaries

Manage Overview deliberately does not:

- calculate portfolio value, cash weight, mandate health, data readiness, risk profile, exception
  severity, owner, age, priority, rebalance state, or source supportability,
- default a missing mandate risk profile to **Balanced** or convert absent evidence into a positive
  state,
- claim construction alternatives are available before the governed generation action succeeds,
- infer selected-portfolio wave membership from a wave id, trigger id, list position, or another
  unstructured identifier,
- turn a low exception count or positive badge into mandate compliance, suitability, approval,
  supervisory sign-off, investment recommendation, or client-readiness authority,
- claim book, team, household, or enterprise-wide totals from a selected-portfolio source window,
- create client communication, portfolio instructions, trades, orders, executions, allocations,
  settlement, reconciliation, or custody records.

Official wealth-platform research informed the exception-led hierarchy, connected workflow, and
source-evidence pattern. Lotus does not copy another product's layout, wording, visual identity, or
unsupported capability, and this guide is not a claim of competitor superiority.

## Adjacent Handoffs

- [Advisor Book](Advisor-Book-Workflow) owns supported own-book portfolio selection.
- [Portfolio Review](Portfolio-Review-Screen-Guide) owns the daily selected-portfolio checkpoint.
- [Mandate Health](Mandate-Health-Screen-Guide) owns detailed mandate evidence, cursor-bounded
  attention review, and selected-item investigation.
- Rebalance Waves owns source-backed wave, campaign, readiness, and evidence workflow.
- Construction Alternatives owns governed generation and comparison of supported alternatives.
- Portfolio Memory owns source-recorded decisions and operating events.
- PM Operating Quality owns Manage-governed policy, score-run, fairness, and review evidence.
- [Outcome reviews](Outcome-Reviews-Screen-Guide) and Evidence Pack own selected outcome and proof
  evidence.

## Evidence And Validation

- `tests/unit/manage-overview-model.test.ts` proves missing risk profile, complete zero-attention
  posture, active-attention hierarchy, source-unavailable posture, explicit portfolio-to-wave
  membership, rejection of an unscoped first wave, business record grammar, and
  portfolio-preserving mandate and rebalance routes.
- `tests/unit/manage-workspace-components.test.tsx` proves the combined decision worklist,
  selected-detail evidence, business-formatted date context, single-stated destinations,
  incomplete-evidence state, and absence of a fabricated alternatives-available claim.
- `tests/unit/workbench-worklist.test.tsx` proves the shared worklist's row/detail relationship,
  Arrow-key selection, Enter detail transfer, disabled-row posture, and controlled selection.
- `tests/unit/manage-overview-responsive-css.test.ts` proves that posture, value, evidence, and task
  layouts reflow from available content width instead of assuming a full-page viewport, and that
  superseded context-rail and rail-action selectors cannot return.
- `tests/e2e/manage-overview-workspace.spec.ts` proves the optimized production route at 1440,
  1024, 768, and 519 pixels, including the source-backed decision model, one occurrence per
  destination, one occurrence per operating-posture fact, distinct right-rail evidence, list/detail
  keyboard flow, responsive stacking, first decision row above 900 pixels, zero page overflow, and
  a desktop height no greater than 1,200 pixels—at least 40% shorter than the approximately
  2,000-pixel baseline.
- Optimized-production diagnostic browser proof on `PB_SG_GLOBAL_BAL_001` verified 1440, 1024,
  720, and 390 pixel viewports without page overflow; centre-rail evidence remained within its
  parent boundary, and a task-directory link retained a visible two-pixel focus outline. The source
  returned partial Manage evidence, so the artifacts under `output/playwright/issue-763/` are
  diagnostic evidence and are not canonical demo-readiness screenshots.
- Protected PR checks, exact-main releasability, wiki publication, and strict parity remain release
  controls.

Use [Validation and CI](Validation-and-CI) and [Operations Runbook](Operations-Runbook) for the
governed validation sequence.

## First Support Step

Confirm the selected portfolio and whether the headline says **Evidence incomplete**, **Action
required**, **Ready for review**, or the whole Manage workspace is unavailable. Record the named
incomplete area and HTTP status when shown, but do not copy client data or raw payloads into an
unapproved channel. If attention evidence is unavailable, do not report zero items; verify the
Gateway and Manage source response through the approved runbook.

## Related Documentation

- [Screen Guide Catalogue](Screen-Guide-Catalogue)
- [Advisor Book](Advisor-Book-Workflow)
- [Portfolio Review](Portfolio-Review-Screen-Guide)
- [Supported Features](Supported-Features)
- [API Surface](API-Surface)
- [Integrations](Integrations)
- [Validation and CI](Validation-and-CI)
- [Operations Runbook](Operations-Runbook)
- [Technology Risk and Runtime Support](Technology-Risk-and-Runtime-Support)
