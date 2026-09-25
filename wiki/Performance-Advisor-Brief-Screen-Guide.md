# Performance Advisor Brief

Performance Advisor Brief turns source-backed portfolio and performance evidence into a bounded
internal preparation workspace. It helps a client advisor review talking points, key measures,
supportability, risks, and next internal steps before recording a permitted human-review decision.
It does not approve client communication, determine suitability, recommend or place a trade, or
turn generated narrative into source authority.

## Current Scope

| Screen posture | Current truth |
| --- | --- |
| Canonical route | `/performance?portfolioId={portfolio_id}&mode=advisor`; `mode=advisor-brief` remains a compatibility alias |
| Navigation | **Performance** in global navigation, then **Advisor Brief** in the selected-portfolio rail |
| Supported scope | One selected portfolio, one source-confirmed performance context, one internal working brief, and source-allowed review decisions |
| Primary reading order | Brief status, talking points, key source metrics, human review, supportability, risks or exceptions, then adjacent workflow |
| Primary next action | Qualify the narrative against source evidence, record an allowed internal review decision, or return to deeper Performance or Risk evidence |

The current screen is portfolio-scoped. It does not aggregate a household, relationship, advisor
book, team book, or multiple mandates. Advisor Book owns source-backed portfolio selection.

## Business Purpose

The screen helps an advisor answer five bounded preparation questions:

1. What happened in the selected portfolio and benchmark context?
2. Which source measures support each talking point?
3. What evidence, limitations, or exceptions must qualify the discussion?
4. Is the narrative source-recorded, rule-based, AI-assisted, partial, historical, or unavailable?
5. Which internal review decision is currently permitted, and was it recorded by the source?

The design keeps evidence, narrative, review consequence, and workflow posture together so an
advisor can prepare efficiently without confusing working material with approved client content.

## Who Uses This Screen

- **Client advisors and relationship managers** prepare a concise, source-grounded internal
  narrative before a portfolio review or client conversation.
- **Portfolio managers and investment specialists** check whether talking points and suggested
  follow-up are consistent with the published performance and benchmark evidence.
- **Performance, investment operations, and support teams** investigate source limitations,
  incomplete evidence, stale or superseded workflow posture, and failed review recording.
- **Product, control, and supervisory support teams** inspect the explicit review boundary and
  source-recorded audit posture without treating a staff reference as authenticated identity.

These uses do not imply production entitlement, delegated authority, supervisory approval,
client-delivery permission, or bank certification.

## Workflow Position

1. Enter from [Advisor Book](Advisor-Book-Workflow),
   [Portfolio Review](Portfolio-Review-Screen-Guide), Performance Summary, or Performance Analysis
   with one selected portfolio.
2. Confirm the portfolio, reporting window, return basis, frequency, and benchmark in Review
   Context.
3. Review the talking points beside key source measures, supportability, risks, and exceptions.
4. Open **How this was prepared** to distinguish source, rule-based, AI-assisted, review, evidence,
   freshness, and client-use posture.
5. If the source publishes an allowed review decision, enter the required staff reference and
   rationale, inspect its stated consequence, then review and confirm the exact decision.
6. Continue to Performance Analysis, Risk Review, Evidence, Report Centre, or Portfolio Review only
   for the distinct job owned by that screen.

Copying the internal note is a clipboard convenience. It does not persist a review, create a
client communication, order a report, or authorize downstream use.

## Implemented Capabilities

- Presents Gateway-returned talking points, recommended internal actions, risks, exceptions,
  source measures, warnings, and supportability without recalculating portfolio economics.
- Passes the governed review date and reporting currency through both the Advisor Brief read and
  review action. A persisted decision is accepted only under the same coherent source context; an
  unverified, rejected, or unavailable restatement remains visibly in portfolio base currency.
- Keeps AI or rule-based preparation posture separate from output availability, evidence coverage,
  source-recorded human review, freshness, and client-use permission.
- Treats review as source-recorded only when the returned workflow evidence includes review
  history, a positive transition count, a reviewer reference, and a review timestamp.
- Presents a source-recorded review instant as a readable UTC audit fact only after persistence is
  confirmed. The exact offset-bearing source value remains available on the atomic machine-readable
  review record, never as advisor-facing ISO text; missing, malformed, or unzoned values are **Not
  reported**.
- Presents the bank staff reviewer reference without Lotus AI's technical `review:` actor namespace;
  the raw source actor remains unchanged in the Gateway evidence and only the governed namespace is
  adapted at the Workbench boundary.
- Fails closed when generation provenance, evidence, review audit, allowed action, or output posture
  is missing, malformed, contradictory, stale, or superseded.
- Offers only review decisions currently allowed by the source workflow: accept for internal use,
  reject, request revision, mark as superseded, or withdraw.
- Requires a replacement brief reference for revision and supersession decisions.
- Provides a separate review-before-confirm step showing the selected consequence, staff reference,
  rationale, replacement reference when applicable, and the client-use boundary.
- Shows pending, success, and failure feedback through accessible status regions; success appears
  only after Gateway and Lotus AI return source-owned persistence evidence.
- Retains entered review information after a failed request so the advisor can correct or retry
  without reconstructing the decision.
- Copies only usable internal evidence and prefixes the note with a human-review and no-client-use
  boundary.
- Keeps workflow run, task-flow, handoff, and correlation evidence in a collapsed technical support
  disclosure rather than the primary business scan path.
- Uses feature-owned responsive styling and maintains one dense three-column workstation at wide
  widths with readable reflow and no page overflow at tablet and narrow widths.

## Decisions And Actions

| User decision or action | Required evidence or gate | Persisted business change |
| --- | --- | --- |
| Use a talking point in internal preparation | Usable narrative plus cited source evidence and visible limitations | None |
| Copy internal note | Usable brief evidence | None; writes an explicitly internal working note to the clipboard |
| Accept for internal use | Source allows `ACCEPT`; staff reference and rationale are present; confirmation is completed | Lotus AI records the bounded review transition through Gateway |
| Reject brief | Source allows `REJECT`; staff reference and rationale are present; confirmation is completed | Lotus AI records that the brief must not proceed for the intended internal use |
| Request revision | Source allows `REVISE`; staff reference, rationale, and replacement reference are present | Lotus AI records replacement lineage and review posture through Gateway |
| Mark as superseded | Source allows `SUPERSEDE`; staff reference, rationale, and replacement reference are present | Lotus AI records the current brief as historical evidence linked to its replacement |
| Withdraw brief | Source allows `ABANDON`; staff reference and rationale are present | Lotus AI records withdrawal from further internal workflow use |
| Retry after failure | Prior source failure remains visible and the source still allows the decision | Repeats the bounded Gateway request; no success is assumed locally |

An internal acceptance is not suitability approval, supervisory sign-off, client-publication
permission, a proposal, report order, instruction, trade, order, execution, or settlement event.

## Information And Source Authority

| Business fact or action | Workbench boundary | Source authority |
| --- | --- | --- |
| Portfolio, reporting window, return basis, frequency, benchmark, performance measures, contribution, and attribution support | Presents the Gateway-composed workspace without browser calculation | Gateway over Core portfolio/reference/benchmark context and Performance analytics |
| Talking points, suggested internal actions, risks, exceptions, generation posture, and evidence references | Maps the returned brief into business language and fails contradictory evidence closed | Gateway advisor-brief contract over Performance evidence and Lotus AI workflow output |
| AI-surface and advisory-workflow supportability | Presents separately from the narrative and does not convert absence into readiness | Gateway over Lotus AI and Advise supportability contracts |
| Allowed review decisions and workflow state | Filters to known source actions and shows business consequences | Lotus AI workflow-pack run through Gateway |
| Review staff reference, rationale, replacement lineage, persisted actor, timestamp, and transition history | Collects the reviewed request, posts only after confirmation, and renders the returned evidence | Gateway `POST /api/v1/workbench/{portfolio_id}/performance/advisor-brief/review-actions` over Lotus AI review authority |
| Copy internal note | Formats currently usable screen evidence with an internal-use boundary | Workbench clipboard action; no source mutation |

Workbench uses the internal BFF and Gateway. It does not call Core, Performance, Advise, or Lotus AI
directly. Shared contract detail remains in [API Surface](API-Surface), and ownership flow remains in
[Integrations](Integrations).

## Screen States And Recovery

| State | What the user sees | Recovery posture |
| --- | --- | --- |
| Loading | Bounded Advisor Brief loading with no fabricated narrative or review success | Wait for the selected-portfolio contract |
| Ready, awaiting review | Talking points, source measures, supportability, limitations, and source-allowed decisions | Review evidence, then prepare one permitted decision |
| Rule-based fallback | Internal working narrative explicitly identified as Workbench-composed and not a source-published AI run | Use only as qualified internal preparation; source review controls remain unavailable |
| Partial or limited | Usable evidence retained with named warnings, partial failures, or unavailable preparation dimensions | Qualify the discussion and investigate the named source |
| Currency accepted but not verified | Brief measures remain in portfolio base currency with one explicit restatement limitation | Use the base-currency evidence only; do not describe the brief as restated |
| Review context changed | Prior brief or action result is not admitted under the newly requested date/currency context | Reload the matching brief before recording a decision |
| Review confirmation | Exact decision consequence, staff reference, rationale, optional replacement, and prohibited downstream uses | Confirm or return to editing |
| Recording review | Controls remain unavailable while the exact source request is pending; polite status feedback is announced | Wait for Gateway and Lotus AI completion |
| Review recorded | Source-returned decision posture plus actor, readable UTC timestamp, transition count, and review-history evidence; focus remains on the source-confirmed status | Continue only within the displayed internal boundary |
| Review failed | Persistent assertive failure feedback; entered decision information remains available | Correct the input or retry through the same control |
| Permission blocked | Business-safe restricted posture without entitlement internals or stale success | Use an entitled approved path or contact platform support |
| No allowed decision | Source workflow publishes no current action; no local action is invented | Inspect the recorded state and technical support disclosure |
| Superseded or revised | Current brief is historical and replacement lineage is shown when source-published | Open the replacement through its governed workflow; do not use the historical brief as current |
| Unavailable | Narrative or required evidence cannot be admitted and client use remains blocked | Re-establish supported portfolio/source context or follow the approved support process |

A terminal-looking workflow state without complete source review audit evidence does not become a
human-reviewed success. It remains unavailable or review-required until the source contract proves
the actor, time, history, and transition.

## Workbench Boundaries

Performance Advisor Brief deliberately does not:

- calculate return, contribution, attribution, benchmark, risk, suitability, tax, fee, currency, or
  portfolio economics in the browser,
- invent evidence references, reviewer identity, review time, review history, freshness, allowed
  action, replacement lineage, or client-use permission,
- treat generated, rule-based, copied, accepted-for-internal-use, or source-reviewed material as
  approved client communication,
- publish a report, contact a client, change a proposal, rebalance a mandate, create an instruction,
  place an order, record execution, or settle a transaction,
- claim household or advisor-book briefing, production identity, supervisory approval, independent
  model validation, bank acceptance, or competitor superiority,
- expose provider, model, service, run, task, or correlation identifiers as the primary language of
  the advisor workflow.

Official wealth-platform and accessibility research informed the evidence-to-decision hierarchy,
meeting-preparation context, review-before-confirm pattern, and non-focus-stealing status feedback.
Lotus does not copy another product's visual identity, wording, calculations, or unsupported
capability.

## Adjacent Handoffs

- [Advisor Book](Advisor-Book-Workflow) owns own-book portfolio selection.
- [Portfolio Review](Portfolio-Review-Screen-Guide) owns the selected-mandate daily checkpoint.
- [Performance Summary](Performance-Summary-Screen-Guide) owns benchmark-aware headline outcome and
  return-path review.
- [Performance Analysis](Performance-Analysis-Screen-Guide) owns contribution, attribution, and
  historical diagnostics.
- Risk Review owns downside and concentration interpretation; Performance Evidence owns calculation
  and lineage inspection.
- [Report Centre](Report-Centre-Screen-Guide) owns reviewed report ordering and report lifecycle;
  Advisor Brief does not create or publish a report.
- Lotus AI owns workflow-pack output and review history; Gateway owns Workbench-facing composition
  and contract enforcement.

## Evidence And Validation

- Focused view-model tests prove generation, evidence, human-review, client-use, stale,
  superseded, fallback, malformed-audit, and source limitation admission.
- Focused component tests prove source-allowed action filtering, required staff reference and
  rationale, replacement requirement, review-before-confirm, no request before confirmation,
  source-confirmed success, explicit failure, retained input, copy boundary, and technical-detail
  disclosure.
- Review-context tests prove that the brief read and review action carry the same date/currency
  request and that success is admitted only under coherent returned context.
- The owned optimized-production Playwright journey uses `PB_SG_GLOBAL_BAL_001`, proves no review
  request occurs before confirmation, verifies confirmation focus and exactly one POST, renders the
  source actor/time/history only after success, rejects unexpected browser failures, and verifies no
  page overflow at 1440, 1024, 720, and 390 pixels.
- The same journey reloads the persisted review and opens a second `Asia/Singapore` browser context
  to prove the visible audit instant remains `21 Apr 2026, 03:22 UTC`, the exact source value remains
  available to machine proof, and browser timezone cannot change the business disclosure. The
  diagnostic evidence pack is
  [Issue #786 Business Timestamp Evidence](https://github.com/sgajbi/lotus-workbench/tree/main/docs/evidence/issue-786-business-timestamps).
- Canonical ACCEPT validation reads review state, supportability, reviewer, and recorded time from
  exactly one machine-readable record on the same visible **Human Review** row. It rejects missing,
  duplicate, malformed, non-ready, or wrong-reviewer evidence instead of parsing flattened panel
  text or treating a success message alone as persistence proof. It also fails immediately when the
  review region exposes an explicit source-confirmation alert instead of waiting for success until
  the general browser timeout expires.
- Gateway #547 adds the source-audit mapping and focused success/malformed-evidence tests required
  for Workbench to distinguish recorded human review from a terminal state string.
- Canonical `npm run live:stack:up:validate` remains the release evidence for the governed front-office
  stack; a screenshot or fixture alone is not readiness, identity, entitlement, or client-use proof.
- Protected PR checks, exact-main releasability, wiki publication, and strict parity remain release
  controls.

Use [Validation and CI](Validation-and-CI) and [Operations Runbook](Operations-Runbook) for the
governed validation sequence.

## First Support Step

Confirm the selected portfolio, reporting window, basis, benchmark, visible preparation posture,
and current review state. If recording failed, keep the entered decision visible and record the
business-safe failure state; do not paste client data, narrative content, reviewer details, or raw
payloads into an unapproved channel. Retry once through the in-screen action, then use the approved
support path with the collapsed technical reference only when required.

## Related Documentation

- [Screen Guide Catalogue](Screen-Guide-Catalogue)
- [Performance Summary](Performance-Summary-Screen-Guide)
- [Performance Analysis](Performance-Analysis-Screen-Guide)
- [Advisor Book](Advisor-Book-Workflow)
- [Portfolio Review](Portfolio-Review-Screen-Guide)
- [Report Centre](Report-Centre-Screen-Guide)
- [Supported Features](Supported-Features)
- [API Surface](API-Surface)
- [Integrations](Integrations)
- [Validation and CI](Validation-and-CI)
- [Operations Runbook](Operations-Runbook)
- [Technology Risk and Runtime Support](Technology-Risk-and-Runtime-Support)
