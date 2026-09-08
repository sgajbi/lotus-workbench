# Advisory Copilot

Advisory Copilot prepares bounded, AI-assisted working material for one selected portfolio's
proposal review. It joins the selected proposal, available review tasks, proposal evidence,
generated material, mandatory human review, and the client-use boundary in one workspace. It does
not approve advice, assess suitability, communicate with a client, or create an order.

## Current Scope

| Screen posture | Current truth |
| --- | --- |
| Canonical route | `/recommendations?portfolioId={portfolio_id}&mode=copilot` |
| Navigation | Implemented validation mode; the global Advisory entry remains capability-disabled |
| Supported scope | One selected portfolio, the first proposal in the bounded returned window, and source-declared review tasks |
| AI boundary | Generated output is internal working material with an output-adjacent **How this was prepared** disclosure |
| Primary next action | Prepare one supported review task, inspect its evidence and limitations, then record internal review only when the returned run permits it |

The verified source path uses one delegated credential for the Gateway-owned proposal/portfolio
scope lookup and the review command, then checks the returned portfolio against the resolved
principal scope. The configured path remains unavailable until a production grant authority is
owned and operated. This is not live identity, client-publication, advice-approval, or bank-readiness
certification; local development identity remains bounded proof only.

## Business Purpose

The screen helps a client adviser, investment specialist, or control reviewer answer five
questions:

1. Which proposal is the AI-assisted review using?
2. Which review tasks are supported for this portfolio and audience?
3. What proposal evidence and evidence gaps underpin the generated material?
4. Does the output still require human review, and has an internal review been recorded?
5. Is the material permitted for client use?

The reading order is adviser decision, preparation status, supported review tasks, proposal
evidence, generated material, human review, and client-use boundary. Exact run, evidence-packet,
hash, workflow, and reviewer references remain inside **How this was prepared** rather than the
primary decision path.

## Who Uses This Screen

- **Client advisers and relationship managers** prepare internal proposal explanations, meeting
  notes, evidence questions, and follow-up points before deciding what requires further review.
- **Compliance reviewers** request a bounded compliance-review summary and inspect cited evidence
  and limitations before recording internal review.
- **Operations support** prepares the supported report and operations handoff summary.
- **Risk, compliance, model-risk, audit, and support teams** inspect preparation, evidence, human
  review, client-use, and lineage facts without treating generated prose as source evidence.

These roles describe product use. Source entitlements and production principal claims remain owned
outside this screen.

## Workflow Position

1. Select one entitled portfolio and open Advisory Copilot.
2. Confirm **Review preparation**, **Client use**, available tasks, and the active proposal.
3. Choose a source-declared review task such as proposal explanation, evidence Q&A, meeting
   preparation, compliance summary, operations handoff, or internal follow-up draft.
4. Select **Prepare review**. Workbench first requests a proposal-version evidence packet and then
   requests the corresponding AI-assisted output; it does not build evidence sections locally.
5. Review proposal evidence, unsupported evidence, generated sections, review guidance, and review
   controls.
6. Open **How this was prepared** to inspect AI preparation, evidence coverage, human review,
   client-use status, limitations, and support references.
7. Select **Record internal review** only when the returned run is explicitly awaiting review.
8. Continue in the owning proposal or specialist workflow for approval, remediation, client
   communication, or implementation.

## Implemented Capabilities

- Reads proposals and Advisory Copilot availability through the Workbench BFF and Gateway; the
  browser does not call Advise or Lotus AI directly.
- Offers only action families declared by the availability response and preserves the returned
  audience for each task.
- Requests a proposal-version evidence packet before requesting generated output.
- Keeps returned evidence sections and unsupported-evidence messages distinct; Workbench does not
  invent missing evidence or reconstruct source sections.
- Shows AI assistance only when output and Lotus AI workflow provenance are both present.
- Separates preparation, output availability, evidence coverage, human review, client use,
  freshness, limitations, and technical support references through the shared disclosure.
- Fails output without AI provenance closed, even when text is returned.
- Enables internal review only for a returned `REVIEW_REQUIRED` run and records the review through
  Gateway before presenting it as complete.
- Keeps client use blocked unless the returned contract explicitly states otherwise; internal
  review is never presented as client approval.
- Maps known availability, review, and client-use states through a typed business-copy authority;
  unknown values remain neutral rather than appearing as formatted source codes.

## Decisions And Actions

| User decision or action | Required evidence or gate | Persisted business change |
| --- | --- | --- |
| Select a review task | Task family is declared for the current scope | None |
| Prepare review | Selected proposal has a version and the task has a declared audience/output intent | Creates a source evidence packet and an AI-assisted run through Gateway |
| Inspect **How this was prepared** | Disclosure model is present | None; expands progressive evidence only |
| Record internal review | Returned run id exists and review state is `REVIEW_REQUIRED` | Records `APPROVE_FOR_INTERNAL_USE` through Gateway |
| Retry after preparation failure | Proposal and task remain available | Creates a new bounded request; the proposal itself remains unchanged |

The screen has no action for suitability approval, compliance waiver, client publication,
communication, proposal state transition, order generation, execution, or settlement.

## Information And Source Authority

| Business fact or action | Workbench presentation | Source authority |
| --- | --- | --- |
| Proposal identity and version | Active proposal and evidence-packet request scope | Gateway over Advise proposal lifecycle |
| Supported review tasks and audience | Closed task cards shown only when declared | Gateway Advisory Copilot availability contract |
| Proposal evidence and evidence gaps | Returned sections and unsupported-evidence statements | Advise evidence projection composed by Gateway |
| Generated sections, guidance, and review controls | Presented without reinterpretation | Lotus AI workflow result composed by Gateway |
| AI preparation and lineage | Shared output-adjacent disclosure and progressive support detail | Returned workflow, packet, run, and hash references |
| Human review | Enabled and presented only from a returned reviewable run and persisted review response | Gateway review endpoint over the owning review record |
| Client-use boundary | Stable business label over the returned client-use state | Source contract; Workbench cannot upgrade it |

## Screen States And Recovery

| State | What the user sees | Recovery posture |
| --- | --- | --- |
| Loading | **Loading Advisory Copilot** | Wait; no fallback task or output is shown |
| Ready | Active proposal, supported tasks, evidence area, human-review area, and client-use boundary | Prepare one review task or continue elsewhere |
| Availability or proposal request failed | Advisory Copilot unavailable; proposal information elsewhere remains unaffected | Retry before preparing generated review material |
| No proposal | No proposal available for the selected portfolio | Create or select a supported proposal first |
| No supported tasks | No AI-assisted review tasks available | Use the standard proposal review workflow |
| No prepared evidence | Proposal evidence area remains explicitly empty | Select a supported review task |
| Preparation failed | The proposal remains unchanged and no success is implied | Retry before relying on generated material |
| Output lacks AI provenance | Output is marked unavailable or partial with an explicit limitation | Restore workflow provenance; do not treat text alone as AI-assisted proof |
| Review required | Generated material remains internal and the review action is available | Review evidence and record internal review when appropriate |
| Review controls not met | Internal-review action remains disabled | Resolve the returned control failure in the owning workflow |
| Internal review failed | Material remains unapproved | Retry the exact review action; do not imply persistence |
| Internal review recorded | Reviewer identity and time are present in the returned review record | Continue internal use only; client use remains separately governed |

## AI And Human-Review Boundary

The compact **How this was prepared** disclosure follows the common Workbench AI contract. It
states whether material is AI-assisted, whether output is available, how much cited evidence is
present, whether human review is required or recorded, whether client use is allowed, and which
limitations remain. Provider, workflow, run, packet, and hash references are secondary diagnostic
evidence. A completed run, hash, or internal review cannot by itself establish accuracy,
suitability, approval, freshness, or client permission.

The design follows the existing Workbench research record for Carbon AI disclosure, Microsoft HAX,
NIST AI RMF, and FINRA GenAI oversight: identify affected output, explain preparation and limits,
make the human role explicit, and guard against automation bias. Lotus does not claim regulatory
approval or copy another product's visual identity.

## Responsive And Accessible Use

- The task cards and evidence tiles use document semantics and stack into one column at compact
  widths without changing reading or action order.
- Buttons retain explicit pending labels and disable competing review actions while their request
  is in flight.
- Status uses text as well as tone; client-use and review boundaries do not depend on colour.
- **How this was prepared** uses native disclosure semantics for keyboard and assistive-technology
  access.
- Alerts remain adjacent to the failed preparation or review transaction and do not expose raw
  service errors.

## Adjacent Handoffs

| When the adviser needs to | Continue in | Handoff boundary |
| --- | --- | --- |
| Review proposal terms, suitability evidence, or lifecycle posture | **Proposal Detail** | Advisory Copilot does not approve or change the proposal |
| Compare alternatives or prepare a new recommendation | **Proposal Builder** | Simulation and recommendation ownership remain with the advisory workflow |
| Investigate performance or risk evidence cited by the proposal | **Performance** or **Risk** | Specialist analytics remain source-owned and are not recalculated here |
| Resolve mandate, restriction, or operating-control concerns | **Mandate Management** | Copilot cannot waive or amend mandate controls |
| Prepare a governed client document after approval | **Reporting** | Internal generated material is not a client-ready report |

Carry the selected portfolio and proposal context through the Workbench shell. Reconfirm source
context after recovery or a portfolio change; never carry an unconfirmed route identifier into an
adjacent action.

## Workbench Boundaries

Advisory Copilot deliberately does not:

- build proposal evidence, prompts, guardrails, policy conclusions, or model lineage in the browser,
- infer a supported review task, audience, review state, or client-use permission,
- treat generated material as source evidence, approved advice, a suitability assessment, or a
  client-ready communication,
- record an internal review without a returned reviewable run and successful persisted response,
- call Advise or Lotus AI directly,
- establish production identity, entitlement, retention, supervision, model-risk approval, or
  bank-wide AI governance.

## Evidence And Validation

- `tests/unit/advisory-copilot-copy.test.ts` proves AI/human/client boundaries, business-state
  mapping, fail-closed unknown values, and recovery copy.
- `tests/unit/advisory-copilot-view-model.test.ts` proves evidence/provenance separation, exact
  support-state presentation, human-review authority, client-use mapping, and missing-provenance
  failure behavior.
- `tests/integration/advisory-copilot-workspace.test.tsx` proves source-declared task/audience use,
  evidence-packet-first execution, no local evidence construction, guardrail rejection, internal
  review persistence, and the absence of raw support codes.
- `tests/unit/advisory-copilot-proof.test.ts` and
  `scripts/live/validation/browser-workflows.mjs` cover canonical availability, evidence, run, and
  review proof for `PB_SG_GLOBAL_BAL_001`.
- Protected PR, exact-main, wiki publication, and strict parity remain required before the guide is
  treated as released product truth.

## First Support Step

Confirm the selected portfolio, active proposal, chosen review task, and visible client-use state.
Retry the failed preparation or review once without changing scope. If it still fails, record the
proposal version, evidence-packet reference, run reference, review state, and approved correlation
reference from **How this was prepared**. Do not copy client content or generated material into
support channels, bypass Gateway, fabricate a successful review, or enable client use locally.

## Related Documentation

- [Advisory Overview](Advisory-Overview-Screen-Guide)
- [Advisor Cockpit](Advisor-Cockpit-Screen-Guide)
- [Proposal Detail](Proposal-Detail-Screen-Guide)
- [Product Vocabulary](Product-Vocabulary)
- [Supported Features](Supported-Features)
- [API Surface](API-Surface)
- [Integrations](Integrations)
- [Security and Governance](Security-and-Governance)
- [Validation and CI](Validation-and-CI)
- [Operations Runbook](Operations-Runbook)
