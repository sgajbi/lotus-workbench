# Portfolio Review

Portfolio Review is the selected portfolio's daily decision checkpoint. It brings identity,
valuation context, current return measures, source-reported exceptions, a Workbench-composed review
posture, and the next supported handoff into one review. It is not a client profile, recommendation engine, mandate
approval, or trading screen.

## Current Scope

| Screen posture | Current truth |
| --- | --- |
| Canonical route | `/portfolio` |
| Navigation | **Portfolio** in the portfolio review rail; current Home destination |
| Supported scope | One selected portfolio and its current Gateway-backed review evidence |
| Evidence posture | Active; canonical `PB_SG_GLOBAL_BAL_001` coverage exists, while the fresh #649 populated rerun is tracked against the Core runtime blocker in `lotus-core#943` |
| Primary next action | Resolve evidenced exceptions when present or open the owning specialist workflow |

`/`, `/suite`, and `/portfolios` resolve to this canonical screen, and advisory
`client-context` resolves here as a compatibility alias. Those entry paths do not create separate
client, household, suitability, or portfolio-review authority.

## Business Purpose

Portfolio Review helps an advisor or portfolio manager answer: **is this portfolio evidence usable
for today's review, what needs attention, and where should I continue?** It establishes the book,
business date, currency, mandate context, value, cash, returns, readiness, and exception posture
before the user enters Allocation, Positions, Transactions, Cashflow, Performance, Risk, reporting,
or mandate operations.

The screen is deliberately a decision checkpoint rather than a dashboard of every available
metric. Detailed records and analytical methods stay in their owning screens.

## Shared Review Context

The compact **Review portfolio** strip is the single orientation surface for the selected
portfolio name, mandate type, booking centre, business date, and reporting currency. Portfolio
and client references remain available under **Support details**, with copy actions for operational
use. The strip is assembled only from the Gateway-backed portfolio workspace; the route address is
a request and never display evidence on its own.

Portfolio Review does not repeat this identity in its page header, navigation rail, or evidence
rail. A business date may still appear beside a dated value, reporting record, or calculation
because that is evidence lineage rather than another identity summary.

The strip uses the shared productive hierarchy: sentence-case business labels, readable values,
and a single uppercase eyebrow. Partial or unavailable facts keep the same geometry and become
visually quieter, so an advisor can distinguish missing evidence without losing scan position.

## Who Uses This Screen

- **Relationship managers and client advisors** use it after selecting an assigned portfolio to
  prepare a review and choose the relevant specialist handoff.
- **Portfolio managers and investment specialists** use it to confirm the selected mandate,
  valuation scope, reporting posture, exceptions, and adjacent analytical work.
- **Operations and support teams** use source failures, readiness, business date, portfolio
  identity, and evidence context to distinguish a usable review from an incomplete one.
- **Product and demonstration teams** use canonical browser evidence to verify that the visible
  portfolio is Gateway-backed and not a browser fixture.

These roles describe business use, not production entitlement. Authenticated principal and
portfolio-entitlement work remains governed by
[Workbench #436](https://github.com/sgajbi/lotus-workbench/issues/436).

## Workflow Position

1. Start from [Advisor Book](Advisor-Book-Workflow) or an already selected portfolio context.
2. Confirm portfolio, client reference, booking centre, mandate status, base currency, and as-of
   date before comparing figures.
3. Review portfolio value, invested assets, cash, and source-returned MTD, QTD, and YTD net returns.
4. Read **Review focus** before the secondary evidence. Workbench composes this focus from the
   loaded source facts and keeps source limitations visible when they affect the review.
5. Review **Source Limitations** and the evidence rail when the decision depends on reporting,
   valuation, benchmark, or source coverage. Healthy reviews do not repeat all-clear readiness and
   exception panels.
6. Continue to the owning record, analytics, reporting, advisory, or mandate workflow. Returning to
   Portfolio Review does not record completion, approval, or client communication.

The broader sequence across Allocation, Positions, Transactions, Income, and Cashflow remains in
[Portfolio Review Workflow](Portfolio-Review-Workflow).

## Implemented Capabilities

- Shows the selected portfolio name or mandate label, portfolio and client references, booking
  centre, lifecycle status, base currency, and governed as-of date.
- Presents source-backed portfolio value, invested assets, cash, cash weight, and MTD/QTD/YTD net
  returns.
- Keeps those six scan metrics in a deliberate three-by-two desktop composition, reflowing to two
  and then one column before any reporting-currency value can collide or wrap. Productive 12px
  labels, 14px reading text, and 18px compact metrics preserve density without reducing legibility.
- Opens supporting drawers for Portfolio value, Invested assets, and Cash evidence without turning
  those drawers into recommendations.
- Presents one primary review focus with reporting coverage and only the open-exception evidence
  that exists. The current summary screen loads the workspace shell, dated book/summary details,
  performance snapshots, and the bounded Gateway `/workflow` projection for the selected portfolio
  and review date; it does not request the detailed `/insights` record slice. Its review label is a
  Workbench presentation projection over loaded source facts, not a source-owned action, approval,
  recommendation, or mandate decision. A recommended next step appears only when that Gateway
  workflow response supplies one. A missing or failed workflow response leaves the action area
  absent; the screen does not fabricate a completion action.
- Keeps workspace-shell failures, source-owned performance warnings and partial failures, and
  supporting-request outages visible instead of treating them as zero or clear. A failed income,
  activity, selected-period, MTD, QTD, or YTD request does not discard successfully returned dated
  book evidence; the affected analytical scope is named and its unavailable return remains blank.
  Successful MTD, QTD, or YTD responses that carry source-owned unavailable, warning, or partial
  evidence are qualified in the same way rather than being treated as healthy merely because the
  request returned successfully.
- Exposes period, reporting-currency, export, and additional-workflow controls only within current
  source capability. Historical Portfolio Review remains unavailable, including when the aggregate
  capability is source-supported, because the current refresh cannot replace and identity-check
  every rendered workspace-shell module atomically. The date control therefore remains disabled;
  the published availability range is retained as source evidence for a future complete refresh.
  The acceptance boundary is that a complete dated book summary replaces totals, valuation date, and position-coverage readiness together before historical review can be enabled.
  Rebalance remains labelled as the latest source run.
  Reporting-currency selection remains disabled until the aggregate restatement
  capability is supported. Record filters stay on the record screens where their effect is visible; Portfolio
  Review does not imply that a record filter restates whole-portfolio measures or readiness. When
  a complete dated book summary is returned, its totals, valuation date, and position-coverage
  readiness replace the latest-book evidence together; reporting posture remains separately
  source-owned.
- Shows when the complete displayed Portfolio Review evidence was last **Checked**. This is the
  oldest admitted Workbench receipt across the workspace shell and dated summary evidence, not the
  source business date or a claim that upstream records are fresh. The exact UTC receipt remains
  available from the timestamp. **Recheck portfolio** recontacts both governed reads and confirms
  success only while their returned identity still matches the displayed portfolio and controls.
- Shows book context, available benchmark label/code, reporting coverage, actual valuation date,
  and only the evidence sources present in the loaded workspace. A missing benchmark is labelled
  **Not supplied** rather than implying an assignment. The rail is orientation and evidence
  context, not proof of source assignment or downstream readiness.
- Exports the current Workbench review projection as a local JSON file. Export does not create a
  report, archive record, approval, communication, or source-side business event.

Portfolio Review deliberately excludes record-oriented filters because their results are not
visible in this decision checkpoint. Use Positions or Transactions for filtered record review;
headline portfolio measures remain whole-portfolio source facts.

## Decisions And Actions

| User decision or action | Required evidence or gate | Persisted business change |
| --- | --- | --- |
| Judge whether the review is usable | Portfolio identity, as-of scope, readiness, reporting, and exception evidence | None |
| Change period | Select a supported 7D, 30D, MTD, QTD, YTD, 1Y, or since-inception view | None; Workbench requests the relevant supporting performance evidence |
| Recheck portfolio evidence | A complete current shell and dated summary are displayed | None; Workbench recontacts both reads and confirms only an exact-current result |
| Change as-of date or reporting currency | The workspace capability must explicitly support that control | None; unsupported controls remain disabled |
| Open a metric drawer | Select Portfolio value, Invested assets, or Cash | None; this reveals supporting evidence only |
| Open a source-supplied next step | The dated Gateway workflow response must contain a supported action target | None on Portfolio Review; the user enters the owning workflow |
| Export the review projection | A selected source-backed workspace must be present | A local JSON download only |
| Continue to Performance, Risk, Advisor Brief, Evidence, Reports, or Mandate Operations | Select an implemented adjacent workflow for the same portfolio | None on Portfolio Review |
| Change portfolio | Select source-backed portfolio context through the shared switcher | None; the destination re-requests the selected portfolio |

Portfolio Review exposes no mutation that marks a review complete and does not present a completion
command unless an owning source workflow supplies a supported next action.

## Information And Source Authority

| Business fact or action | Workbench boundary | Source authority |
| --- | --- | --- |
| Portfolio catalogue and selected portfolio | Requested through the Workbench BFF; Workbench does not substitute an unrelated global book when selection is unavailable | Gateway portfolio APIs over Core portfolio identity |
| Portfolio identity, profile, portfolio value, invested assets, cash, readiness inputs, and partial failures | Gateway workspace response is shaped for the review; Workbench formats but does not recalculate the underlying source facts | Core portfolio state composed by Gateway |
| Overall review label | Workbench deterministically projects the review posture from source-returned position coverage, reporting status, publication permission, blocking controls, and visible source/supporting-evidence limitations. Reporting `READY` and `COMPLETE` use one canonical resolved-state mapping | Workbench presentation classification; not source-owned readiness, approval, or suitability authority |
| Review focus and next step | Source partial failures remain evidenced when present; the summary fan-out requests the selected portfolio's dated Gateway `/workflow` contract and shows a next step only when that response supplies one | Gateway workflow action over source-owned portfolio context; Workbench orders and labels the handoff but does not persist approval or invent an action |
| Positions, allocation, income, activity, and supporting book detail | Loaded through Gateway portfolio book and summary-detail contracts; record screens remain their owning presentation | Core portfolio book and transaction sources through Gateway |
| MTD, QTD, YTD, selected-period return, and available benchmark label/code | Requested through Gateway performance-snapshot contracts; missing return evidence remains unavailable and a generic benchmark fallback is not treated as identity evidence | Performance calculation authority composed by Gateway |
| Reporting coverage and generation posture | Rendered as readiness evidence; row count is not treated as a generation timestamp or publication event | Core source-readiness evidence composed by Gateway; not a Report service publication event |
| Performance unavailable, warning, and partial evidence | Promoted from the selected snapshot and each MTD/QTD/YTD response into the decision brief and **Source Limitations** so a usable book cannot be presented with an unqualified healthy analytical posture. When the selected window is itself MTD, QTD, or YTD, one shared response produces one limitation | Performance-owned evidence composed by Gateway; Workbench does not invent severity or a return |
| Supporting request availability | Workbench records the exact income, activity, selected-period, MTD, QTD, or YTD request scope that could not be retrieved through Gateway; independently returned book and performance evidence remains usable | Workbench transport observation over Gateway requests; not a source calculation or fallback result |
| Rebalance and supportability payload | Successful data is retained in the shell response but not consumed by the current Portfolio Review components; Manage failures carried in `partial_failures` are rendered as **Monitoring** exceptions | Manage owns the conditional failure evidence, not a visible healthy rebalance or supportability posture |
| Review Evidence source list | Includes Portfolio book and only the Performance, Cashflow, or Reporting evidence actually present in the loaded workspace | Workbench orientation over loaded contracts; not calculation lineage or supportability certification |
| Export | Browser serializes the confirmed current Workbench projection | Workbench local action; no source-side report or archive authority |

Browser requests use the same-origin BFF and server composition uses the governed Gateway endpoint;
neither path calls Core, Performance, Report, or Manage directly. Source ownership in the catalogue
describes facts actually presented on this screen; retained but unrendered payload fields do not
become visible evidence merely because the shell contract contains them.
Shared endpoint detail remains in [API Surface](API-Surface) and ownership flow in
[Integrations](Integrations).

## Screen States And Recovery

| State | What the user sees | Recovery posture |
| --- | --- | --- |
| Initial load | Server-backed page loading, followed by a bounded toolbar placeholder until client controls mount | Wait for portfolio and workspace evidence; no fabricated summary is shown |
| Ready | Identity, metrics, one review focus, controls, evidence, and handoffs without repeated all-clear panels | Use the review focus and source evidence before continuing |
| Rechecking | Existing admitted evidence remains visible while the shell and dated summary are re-requested; the action remains busy | Wait for the exact-current outcome; repeated activation does not create duplicate work |
| Recheck failed | Available evidence and the source-specific failure remain visible; no success message is announced | Use only the still-qualified evidence or recheck deliberately after the source recovers |
| No selectable portfolio | **Portfolio context unavailable** and **Selection unavailable**; no global portfolio list is substituted | Open **My book** to re-establish source-backed portfolio membership |
| Selected portfolio confirmation | **Preparing portfolio review** remains visible while one automatic request confirms the selected portfolio and current review evidence | Wait for the bounded request; recovery actions are not shown before the outcome is known |
| Selected portfolio unavailable | After the single automatic request settles without a confirmed portfolio review, **Selected portfolio unavailable** explains that no other portfolio was substituted | Open **My book** to choose an available portfolio; there is no background request loop or unimplemented page-local Retry |
| Partial or degraded | Available book facts remain visible with the affected source or supporting analytical scope in **Source Limitations**; a ready book is qualified to **Partial** when a selected or standard-period response is unavailable, warned, partial, or not retrievable | Use the dated book evidence that remains visible; do not use an unavailable return and open the owning specialist screen if the analytical scope is required |
| Warning without partial failure | The source warning is visible as qualified performance evidence and prevents an unqualified ready posture | Review the exact warning and use only the evidenced return/benchmark scope |
| Historical or unsupported scope | Historical Portfolio Review remains unavailable even when the aggregate capability is source-supported because every rendered workspace-shell module cannot yet be refreshed and identity-checked atomically. The date control stays disabled and the published range remains evidence only. Rebalance remains the latest source run. Unsupported currency restatement stays disabled with the source reason | Keep the effective source scope; do not relabel latest evidence as historical or restated |
| Empty supporting detail | Source-backed zero or unavailable supporting detail remains distinct from the portfolio headline | Open the owning record screen before concluding that activity or exposure is absent |
| Permission blocked | Portfolio Review has no dedicated authenticated-principal permission panel today; a failed catalogue or workspace read remains unavailable | Do not add browser authority headers; follow #436 and the operations runbook |
| Error | Catalogue or workspace failures fail closed to unavailable context; partial source failures remain visible within an otherwise usable review | Re-enter through **My book** or retry the owning specialist screen; escalate if the same scope persists |

The screen does not promise a universal Retry button. Recovery text names only controls that
currently re-contact source authority. Bounded operational events distinguish the automatic
attempt from its attached ready or terminal outcome without carrying portfolio or client identity.

## Workbench Boundaries

Portfolio Review does not:

- calculate portfolio valuation, performance, benchmark return, reporting coverage, mandate breach,
  risk, suitability, or priority in the browser. Workbench does project the disclosed overall review
  label from exact source-returned readiness inputs;
- aggregate households, external assets, delegated books, or a relationship manager's whole book;
- recommend a trade, rebalance, product, proposal, or client action;
- approve a mandate, suitability outcome, proposal, report, or client communication;
- create orders, route execution, claim fills, settle transactions, or reconcile custody;
- create a governed report, archive artifact, evidence pack, or client delivery from local export;
- infer production identity or entitlement from a visible portfolio reference.

Technology certification, resilience, scalability, dependency support, and explicit non-claims are
owned in [Technology Risk and Runtime Support](Technology-Risk-and-Runtime-Support). This guide does
not claim bank approval, procurement acceptance, production identity, HA/DR, or capacity
certification.

## Adjacent Handoffs

- [Advisor Book](Advisor-Book-Workflow) owns source-backed book selection.
- [Portfolio Review Workflow](Portfolio-Review-Workflow) explains Allocation, Positions,
  Transactions, Income, and Cashflow as a connected record-review sequence.
- **Performance**, **Risk**, **Advisor Brief**, and **Evidence** retain the selected portfolio and
  pass available benchmark context to their owning modes.
- **Reports** opens the portfolio-scoped Report Centre; Portfolio Review export is not a report
  order.
- **Mandate Operations** opens the selected Manage workspace; Portfolio Review does not perform
  operational actions itself.
- **Source Catalog** opens Data-Product Discovery for ownership and trust evidence; catalogue
  presence does not prove a business workflow ready.

Compatibility routes and aliases reuse this guide and must not fork the business workflow.

## Evidence And Validation

- Component and view-model tests cover portfolio identity/KPIs, decision-brief readiness and
  attention, exceptions, evidence/benchmark handoffs, toolbar capability behavior, API fan-out,
  one attempt per source key, stale completion/unmount safety, and bounded recovery telemetry.
- `tests/e2e/portfolio-workbench.smoke.spec.ts` covers populated Portfolio behavior and record-screen
  handoffs; `scripts/live/validation/browser-workflows.mjs` owns canonical browser proof.
- `npm run test:e2e:portfolio:review-matrix` exercises the same decision flow at 1440, 1024, 768,
  721, 720, 561, and 519 CSS pixels. It proves no page-level horizontal overflow, the intentional
  rail transition at 720 pixels, named focusable controls, Enter/Escape focus restoration, and a
  complete 24-of-24 sequential keyboard traversal at the narrowest supported viewport. It writes
  machine-readable accessibility evidence beside diagnostic screenshots; neither artifact replaces
  populated canonical source proof.
- `npm run test:e2e:typography:compare` renders pinned IBM Plex Sans and Inter candidates against
  the same optimized Portfolio Review at 1440, 1024, 768, and 519 pixels. It records computed
  family, size, weight, metric width, containment, single-line posture, and page overflow; #829
  selected IBM Plex Sans only after both candidates passed the business-screen geometry gate.
- `tests/unit/typography-token-authority.test.ts` prevents the legacy global layer from reclaiming
  semantic type authority, blocks inflated weights and routine uppercase labels on migrated
  surfaces, and protects the responsive Portfolio health-strip composition.
- `npm run test:e2e:portfolio:review-context-typography` proves confirmed, partial, and unavailable
  Review Context typography at 1440 and 519 pixels with computed roles and zero page overflow.
- Canonical validation selects `PB_SG_GLOBAL_BAL_001`, verifies the exact Portfolio Review heading
  and **Review Evidence** landmark, and captures `portfolio-summary-live.png` only after API and
  panel checks pass.
- Runtime evidence must preserve canonical contract identity, source business date, portfolio
  identity, benchmark/evidence posture, and declared limitations. A screenshot alone is not
  readiness, production, or bank-certification proof.
- Focused tests prove the single healthy decision hierarchy, conditional source limitations,
  conditional evidence sources, absent-benchmark language, visible-date integrity, removal of
  misleading summary filters, visible loading-to-terminal transitions, and the finite selected-shell
  request lifecycle. An isolated production-browser fixture proves one server read plus one client
  recovery read, the stable terminal state, non-substitution copy, and the **Open My book** handoff.
- Focused mixed-success tests prove a failed standard-period request leaves dated book, income,
  selected-period, and other standard-period evidence usable; the failed return remains blank,
  recovery clears the limitation, and source-owned performance warnings qualify the review.
- Focused API and component proof verifies that the summary path requests the dated Gateway workflow
  contract, renders a returned next action before secondary evidence handoffs, renders one surface
  per business module rather than nested rail cards, and reserves no empty action region when the
  workflow response is absent or fails.
- Source-to-render historical proof first verifies that a missing dated summary keeps current totals
  labelled with their actual valuation date, then changes the same populated book to a dated
  zero-position portfolio and verifies that selected review date, source valuation date, zero
  portfolio value, and qualified portfolio readiness change together without altering separately
  sourced reporting posture.
- The current #649 populated canonical rerun is blocked before Workbench/Gateway readiness by
  `lotus-core#943`, where a stale ZooKeeper `/brokers/ids/1` owner prevents the Core Kafka broker
  from restarting after an interrupted/recreated local runtime. This is an explicit infrastructure
  blocker, not permission to replace source data with a browser fixture or weaken readiness checks.

Use [Validation and CI](Validation-and-CI) and [Operations Runbook](Operations-Runbook) for the
governed commands and evidence locations.

## First Support Step

Confirm the selected portfolio, visible as-of date, base/reporting currency, readiness state,
reporting coverage, and exact limitation shown on screen. Record whether the limitation affects the
book or only income, activity, selected-period, MTD, QTD, or YTD supporting evidence. Do not paste
client or portfolio identifiers, exported JSON, or raw response payloads into a support channel. If
portfolio context is unavailable, open **My book** once to re-establish source-backed selection. If
the same scope remains unavailable or partial, follow [Operations Runbook](Operations-Runbook) and
record only the business-date scope, state classification, affected work area, and a displayed
correlation or support reference when its semantics are explicitly labelled.

## Related Documentation

- [Screen Guide Catalogue](Screen-Guide-Catalogue)
- [Advisor Book](Advisor-Book-Workflow)
- [Portfolio Review Workflow](Portfolio-Review-Workflow)
- [Supported Features](Supported-Features)
- [API Surface](API-Surface)
- [Integrations](Integrations)
- [Validation and CI](Validation-and-CI)
- [Operations Runbook](Operations-Runbook)
- [Security and Governance](Security-and-Governance)
- [Technology Risk and Runtime Support](Technology-Risk-and-Runtime-Support)
