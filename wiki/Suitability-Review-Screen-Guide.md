# Suitability review

Suitability review is the adviser's portfolio-scoped decision desk for recommendations that require
evidence or control review before a client discussion. It keeps one authoritative suitability
worklist beside one selected review so the adviser can identify the next supported action without
confusing proposal lifecycle activity with suitability workload. Policy evaluations remain the
supporting source records; they do not rename the business workflow.

## Current Scope

| Screen posture      | Current truth                                                                        |
| ------------------- | ------------------------------------------------------------------------------------ |
| Canonical route     | `/proposals?portfolioId={portfolio_id}&mode=suitability`                             |
| Navigation          | Direct bounded route; the global **Proposal** workspace remains capability-disabled  |
| Supported scope     | One selected portfolio, one authoritative suitability worklist, and one selected review |
| Evidence posture    | Gateway-backed evaluation, sign-off package, and policy workflow evidence               |
| Primary next action | Resolve the selected review's source-owned evidence requirement                         |

The **In review** and **Needs action** measures come only from the returned suitability worklist.
They are not proposal-list, whole-book, household, team, or global suitability totals. This route
does not establish production identity, entitlement, policy approval, client publication, or bank
certification.

## Business Purpose

The screen helps an adviser answer five questions in one working context:

1. Which source-owned suitability reviews are waiting for this portfolio?
2. Which review is selected, and do its proposal, portfolio, version, package, and workflow
   identities agree?
3. What approval, disclosure, consent, or evidence requirement blocks the next step?
4. What are the current sign-off, maker-checker, client-publication, and review-SLA postures?
5. Can the adviser request more evidence, or must the source package be rechecked first?

This is a review and evidence-resolution workflow. It does not calculate whether a recommendation
is suitable and does not turn a policy evaluation into an approval decision.

## Who Uses This Screen

- **Client advisers and relationship managers** select the review that needs attention and
  resolve the next supported evidence step before client discussion.
- **Investment and product specialists** review the recorded product-policy posture and supporting
  requirements for the selected proposal.
- **Risk, compliance, and maker-checker reviewers** use the source package and workflow posture for
  orientation; their approval authority remains in the owning service and bank process.
- **Operations and support teams** use portfolio, evaluation, proposal, and version identity to
  locate the affected source record without relying on browser-generated conclusions.

These roles describe intended business use, not authenticated production entitlement.

## Workflow Position

1. Start from a selected portfolio in [Advisor Book](Advisor-Book-Workflow),
   [Advisory Overview](Advisory-Overview-Screen-Guide), or a retained
   [Proposal](Proposal-Detail-Screen-Guide).
2. Confirm the portfolio and source boundary shown above the decision desk.
3. Review the policy-queue counts; do not substitute a proposal-list count.
4. Move through reviews with pointer or Up/Down/Home/End keys.
5. Read the selected review's required next step, source completeness, blocking rules,
   sign-off package, workflow, maker-checker, publication, and SLA posture.
6. Expand **Supporting evidence** only when dependencies, source references, gaps, or blockers are
   needed for the decision.
7. Select **Request more evidence** only when all selected identities agree and the source
   evaluation hash is present in the supporting source record.
8. Open the full proposal when the broader decision record is required; portfolio and Suitability
   origin remain in the link.

## Implemented Capabilities

- Uses the Gateway advisory-policy review queue as the only Suitability review worklist and count
  authority; the generic proposal-list request is not made in this mode.
- Presents an adaptive worklist-and-decision layout: simultaneous panes on desktop and adviser
  tablet, then worklist before decision on compact screens.
- Keeps selection explicit and deterministic across queue reorder, while removed records,
  portfolio changes, and late completions cannot publish evidence for another evaluation.
- Reads evaluation, sign-off package, and workflow detail for the selected review only; it
  never fans those reads across every worklist row.
- Requires portfolio, evaluation, proposal, proposal-version, sign-off-package, and workflow
  identity agreement before enabling the evidence request.
- Shows one dominant next action plus a compact semantic fact strip; deeper dependencies, source
  references, gaps, and blockers remain under progressive disclosure.
- Refreshes the queue and all three selected-evidence reads as one transaction. Success is
  announced only after every source returns and the refreshed identities still agree.
- Keeps earlier evidence visible but explicitly unconfirmed when refresh fails, with an exact
  source retry and focus restoration that does not steal focus after the adviser moves elsewhere.
- Records a bounded **request more evidence** decision through Gateway with an idempotency key and
  the source evaluation hash.
- Preserves portfolio and `fromMode=suitability` context when opening Proposal Detail.
- Uses business language instead of raw policy constants, endpoint names, or source payload field
  names.

## Decisions And Actions

| User decision or action    | Required evidence or gate                                   | Persisted business change                                           |
| -------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| Select a suitability review | Review is present in the current suitability worklist       | None; changes browser decision context only                         |
| Refresh source evidence     | Current portfolio and selected source-record identity       | None; replaces visible posture only after compound source agreement |
| Request more evidence      | Exact source identity agreement plus source evaluation hash | Records a bounded evidence-review request through Gateway           |
| Open full proposal         | Selected proposal identity and supported detail route       | None; opens the governed proposal record                            |
| Expand supporting evidence | Selected source package is available                        | None; reveals dependencies, references, gaps, and blockers          |

The evidence request does not approve a recommendation, waive a policy finding, complete sign-off,
authorize client publication, create an order, or instruct execution.

## Information And Source Authority

| Business fact or action                                                | Workbench boundary                                                         | Source authority                                   |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| Evaluations in review                                                  | Parsed and counted only from the portfolio-scoped queue response           | Gateway over Advise policy-review contracts        |
| Proposal, portfolio, version, policy pack, and evaluation status       | Presented from the selected queue record and evaluation detail             | Advise through Gateway                             |
| Approval, disclosure, consent, and source-evidence requirements        | Translated into private-banking workflow language without changing meaning | Advise policy evaluation through Gateway           |
| Sign-off package and source lineage posture                            | Shown only when selected source identities agree                           | Advise sign-off package through Gateway            |
| Workflow, maker-checker, client-publication, blockers, and SLA posture | Presented as source state, not browser approval                            | Advise policy workflow through Gateway             |
| Selected suitability review                                            | Adviser interaction state fenced by portfolio and evaluation identity      | Workbench interaction state; not a source mutation |
| Request more evidence                                                  | Submitted with idempotency and the source evaluation hash                  | Advise persistence through Gateway                 |

Shared contract details remain in [API Surface](API-Surface) and [Integrations](Integrations).
Workbench never calls Advise directly.

## Screen States And Recovery

| State                        | What the user sees                                                             | Recovery posture                                                    |
| ---------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Loading                      | Suitability reviews are being retrieved                                        | Wait; no proposal-list fallback or empty claim is shown             |
| Ready                        | One policy worklist, coherent counts, and one source-aligned selected decision | Resolve the named evidence step or open the full proposal           |
| Empty                        | The authoritative source returned no pending reviews for the portfolio          | Continue when a new source review enters the worklist               |
| Selected evidence checking   | Worklist remains visible while evaluation, package, and workflow settle        | Wait; no action is enabled from partial identity                    |
| Partial or identity conflict | The conflicting selected evidence is named and the request action is withheld  | Recheck the exact policy identity and supporting sources            |
| Refreshing                   | Earlier evidence remains visible under its confirmed context                   | Wait for the queue and three selected reads to complete             |
| Refresh failed               | Earlier evidence remains visible but is marked unconfirmed                     | Retry the exact suitability source set                              |
| Permission blocked           | Policy details and cached selected facts remain hidden                         | Use the bank's access process; no browser bypass is offered         |
| Unavailable                  | No fallback evaluation or inferred policy posture is shown                     | Retry through Gateway after source recovery                         |
| Mutation pending             | The request control is disabled and recording is announced                     | Wait; do not submit a second request                                |
| Mutation failed              | Failure is announced explicitly and no success posture is shown                | Retry only after confirming the selected review remains current     |
| Mutation confirmed           | Confirmation appears only after Gateway persistence succeeds                   | Continue with the refreshed source posture                          |

## Workbench Boundaries

Suitability review deliberately does not:

- calculate suitability, target-market eligibility, mandate compliance, risk tolerance, loss
  capacity, knowledge, or experience;
- approve or waive policy findings, record policy sign-off approval, or bypass maker-checker;
- infer client consent, client readiness, client publication, communication, order, execution,
  settlement, custody, or accounting state;
- invent client, household, assignee, urgency, due-date, priority, or whole-book facts;
- use proposal lifecycle state as a substitute for policy evaluation evidence;
- expose source hashes, raw reason codes, or technical payload fields as adviser conclusions;
- establish production identity, entitlement, unrestricted Proposal navigation, bank approval, or
  competitor superiority.

## Adjacent Handoffs

| Direction          | Adjacent workspace                                                    | Context preserved                                       |
| ------------------ | --------------------------------------------------------------------- | ------------------------------------------------------- |
| Inbound            | Advisor Book, Advisory Overview, Proposal Builder, or Proposal Detail | Selected portfolio                                      |
| Outbound           | Proposal Detail through **Open full proposal**                        | Proposal, portfolio, and Suitability review origin      |
| Related lifecycle  | [Risk and Impact](Risk-And-Impact-Screen-Guide)                       | Portfolio only; Risk proves its own selected evidence   |
| Client preparation | [Discussion Pack Review](Discussion-Pack-Review-Screen-Guide)         | Portfolio only; release controls remain independent     |
| Later handoff      | [Implementation Status](Implementation-Status-Screen-Guide)           | Portfolio only; execution evidence remains source-owned |

## Current-Product Research

The implemented direction was reviewed on 2026-08-22 against current official or primary product
guidance:

- [ESMA MiFID II Article 25](https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mifid-ii/article-25-assessment-suitability-and)
  anchors suitability in recommendation-specific client objectives, risk, loss capacity,
  knowledge, and experience rather than generic workflow completion.
- [ESMA suitability Q&A](https://www.esma.europa.eu/publications-data/questions-answers/1765)
  supports individualized explanations instead of generic tick-box evidence.
- [Avaloq Investment Management](https://www.avaloq.com/platform/investment-management) emphasizes
  shared investment truth and risk checks through the advisory lifecycle.
- [Temenos Wealth Management](https://www.temenos.com/products/wealth-management/) emphasizes
  actionable front-office workflows across profiling, risk, compliance, and advice.
- [Addepar for Wealth Management](https://addepar.com/wealth-management) emphasizes trusted data
  and moving from insight to action inside the user's flow of work.
- [Carbon data-table guidance](https://carbondesignsystem.com/components/data-table/usage/) informed
  explicit record selection, task density, and progressive disclosure.

Lotus adopts these workflow principles without copying another product's layout or promoting local
browser logic into source authority. This research is not a claim of competitor superiority.

## Evidence And Validation

- `tests/unit/proposal-policy-review-view-model.test.ts` proves business projection,
  context-preserving links, deterministic initial selection, empty, partial, and identity posture.
- `tests/unit/proposal-workflow-context-view-model.test.ts` proves the policy queue owns Suitability
  counts, recovery language, restrictions, and selected evidence conflict posture.
- `tests/unit/workbench-decision-workspace.test.tsx` proves the reusable worklist-and-decision
  structure and logical source order.
- `tests/integration/proposal-lifecycle-workspace.test.tsx` proves no proposal-list request, no
  duplicate lifecycle table, selected-only reads, count authority, keyboard selection, permission
  fencing, stale-result fencing, mutation success/failure, compound refresh, and focus restoration.
- `tests/e2e/proposal-workflow-context.spec.ts` runs against an optimized production Workbench and
  proves 1440px desktop, 1024px tablet, and 390px mobile composition, keyboard selection,
  source-count consistency, context-preserving drill-in, persisted action feedback, and no page
  overflow.
- Canonical populated validation remains governed separately through `npm run live:stack:up:validate` and
  `PB_SG_GLOBAL_BAL_001`; an optimized-browser screenshot is not production, identity,
  entitlement, bank-readiness, or client-use proof.

Use [Validation and CI](Validation-and-CI) for protected and exact-main evidence.

## First Support Step

Read the visible source state and selected proposal/evaluation identity, then use **Refresh source
evidence** once without changing selection. If the failure persists, record only the portfolio id,
evaluation id, proposal id, version, displayed state, and support reference. Do not copy client
details or payloads into support channels, bypass Gateway, or inject browser identity headers.

## Related Documentation

- [Screen Guide Catalogue](Screen-Guide-Catalogue)
- [Supported Features](Supported-Features)
- [API Surface](API-Surface)
- [Integrations](Integrations)
- [Approval Queue](Approval-Queue-Screen-Guide)
- [Proposal Detail](Proposal-Detail-Screen-Guide)
- [Validation and CI](Validation-and-CI)
- [Operations Runbook](Operations-Runbook)
- [Security and Governance](Security-and-Governance)
