# Advisor Book

Advisor Book is the relationship manager's source-backed starting point for finding an assigned
portfolio and continuing the client-service workflow. It is an own-book portfolio register, not a
client 360, opportunity ranking, household view, or book-AUM dashboard.

## Current Scope

| Screen posture | Current truth |
| --- | --- |
| Canonical route | `/book` |
| Navigation | **My book** in the portfolio context switcher |
| Supported scope | The current governed caller's own-book portfolio membership, subject to the identity boundary below |
| Evidence posture | Gateway/Core membership and provenance are validated; canonical proof remains partial where tenant scope is trusted-context-only |
| Primary next action | Open a returned portfolio in Portfolio Review |

Workbench presents only the book membership returned through Gateway. Its verified source path
requires the signed principal's `advisor.book.read` grant and sends only a delegated Gateway
credential; browser identity and capability headers are discarded. The configured deployment path
still fails closed while the production grant authority is absent. Development configuration is
permitted only in an explicitly development-scoped runtime. This page does not claim live IdP,
grant-store, key-custody, or deployment certification.

## Business Purpose

Advisor Book helps a relationship manager answer a narrow operational question: **which supported
portfolios are assigned to my book, and which portfolio should I review next?** It reduces the time
spent searching across unrelated portfolio records while keeping assignment evidence, business
date, booking-centre scope, and source limitations visible before the user proceeds.

## Who Uses This Screen

- **Relationship managers and advisors** use it to locate an assigned portfolio and start or resume
  a portfolio review.
- **Portfolio and investment specialists** can use the returned assignment and mandate context when
  supporting an advisor, without treating the screen as delegated-book authority.
- **Operations and support teams** use the visible availability, provenance, snapshot, and request
  references to distinguish an empty book from unavailable or insufficiently evidenced source data.
- **Product and demonstration teams** use the governed canonical proof to verify that the screen is
  populated from the supported source contract rather than a browser fallback.

These roles describe screen use, not production entitlements. Workbench does not infer supervisory,
team, delegated, tenant, or booking-centre permissions in the browser.

## Workflow Position

1. Open **My book** from the portfolio context switcher or navigate to `/book`.
2. If the business date is not confirmed, select the calendar date to review. Workbench does not
   request portfolio assignments until that date is valid.
3. Confirm own-book scope, source-confirmed business date, booking centre, and the compact book
   measures. Open **Book scope and operating evidence** only when limitations or support follow-up
   require deeper evidence.
4. Narrow the register using an exact client reference, supported mandate, and requested sort.
5. Confirm the returned range and displayed order before moving between source pages.
6. Read **Checked** to confirm when Workbench last admitted this exact register view. Use
   **Recheck book** when a deliberate source recheck is required; ordinary focus, reconnect, or
   remount does not create another read.
7. Open a portfolio to continue in [Portfolio Review](Portfolio-Review-Screen-Guide).
8. Within another supported portfolio screen, use **Portfolio context** to change portfolio while
   preserving the current business task and supported filters. Workbench requests own-book choices
   only when the switcher is opened.

The screen is an entry and selection step. It does not replace suitability review, proposal
approval, order handling, execution, settlement, reporting, or client communication workflows.

## Implemented Capabilities

- Shows own-book scope, governed as-of date, booking centre, availability reason, and compact book
  measures in the primary path. Assignment provenance and source references remain available in
  one collapsed **Book scope and operating evidence** disclosure.
- Separates filtered-book measures from current-page measures: **matching portfolios** covers the
  filtered result; **portfolios shown**, **clients shown**, and assignment evidence cover the current
  page only. The measures form one horizontal workstation strip at desktop width and reflow without
  page overflow. Client references are not presented as households.
- Applies an exact client-reference filter, a supported mandate filter, sort field, and sort
  direction as one view.
- Shows both requested and displayed order when the source page does not match the requested sort.
- Pages through source results using the returned paging metadata and preserves the governed
  business date when the working view is cleared.
- Shows the browser receipt age for the exact admitted register and provides one explicit recheck.
  The receipt is labelled **Checked** and is distinct from the source business date, evidence
  timestamp, and freshness posture.
- Blocks a missing, malformed, or impossible requested business date before source loading and
  offers one explicit calendar-date recovery control. A returned date that does not match the
  requested source scope is rejected rather than rendered.
- Opens a source-returned portfolio in Portfolio Review using task-preserving navigation.
- Keeps legacy assignment, stale evidence, trusted-context-only tenant scope, and other returned
  limitations available instead of manufacturing confidence in the browser. Repeated unknown
  limitations are consolidated into one business limitation with an occurrence count; exact raw
  reason, snapshot, and correlation references remain in the collapsed support detail only.

## Decisions And Actions

| User decision or action | Required evidence or gate | Persisted business change |
| --- | --- | --- |
| Select the business date | Enter a valid calendar date, then choose **Review book** | None; this establishes the source request scope and resets paging |
| Apply a book view | Enter supported filters and sorting, then choose **Apply view** | None; this requests a new source-backed view |
| Clear the working view | Choose **Clear view** | None; filters and sorting reset while the governed date remains |
| Move between result pages | Use **Previous** or **Next** when source paging permits | None; Workbench requests the selected source page |
| Recheck the current register | Choose **Recheck book** beside the exact receipt age | None; one source read revalidates the unchanged view |
| Retry unavailable evidence | Choose **Retry** after an explicit error or permission state | None; Workbench re-contacts the same source boundary |
| Open a portfolio | Select a portfolio returned in the current own-book page | None on Advisor Book; the task continues in Portfolio Review |

The screen exposes no approval, recommendation, communication, order, execution, settlement, or
assignment-maintenance command. A displayed row is evidence of returned membership, not authority
to perform an unrelated regulated action.

## Information And Source Authority

| Business fact or action | Workbench boundary | Source authority |
| --- | --- | --- |
| Own-book membership, filters, sorting, and paging | Requested through the same-origin BFF; Workbench validates the exact `v1` response and does not reconstruct membership | Gateway `GET /api/v1/advisor-book/portfolios` over Core `PortfolioManagerBookMembership:v1` |
| Portfolio reference, client reference, mandate, currency, lifecycle, and assignment basis | Presented from validated response fields; no household, AUM, or attention score is derived | Core membership contract through Gateway |
| Requested and returned business date | Workbench validates a real calendar date before loading and requires exact request/response agreement; it does not create an instant or substitute a constant | Explicit user/development request scope and Gateway/Core returned scope |
| Booking centre, source service, snapshot, correlation, evidence currency, support state, and reason codes | Shown as operating evidence and limitations; no browser-side readiness calculation | Gateway/Core provenance and supportability fields |
| Caller and tenant boundary | Browser-supplied identity, tenant, region, booking-centre, role, and capability headers are removed by the BFF | Governed runtime context; production principal remains owned by Workbench #436 |

Shared endpoint and ownership detail remains in [API Surface](API-Surface) and
[Integrations](Integrations).

## Screen States And Recovery

| State | What the user sees | Recovery posture |
| --- | --- | --- |
| Business date not confirmed | No assignment request, no substituted date, and a labelled calendar-date control | Select a valid business date; paging resets before Workbench contacts the BFF |
| Loading | A dedicated book-loading state while the source request is outstanding | Wait for the governed response; no global portfolio list is substituted |
| Ready | Scope, evidence, measures, filters, register, paging, and operating boundaries | Review source scope before opening a portfolio |
| Empty book | Source-confirmed empty posture for the requested own-book scope | Confirm date and operating scope; Retry only if the source posture suggests recovery |
| Filtered empty | No rows for the applied client-reference or mandate view | Clear or revise the working view; this is not presented as an unavailable book |
| Degraded or partial | Returned limitation and reason are visible with the available evidence | Use only the evidenced fields; follow the first support step if the decision needs missing authority |
| Permission blocked | An explicit access state; no portfolio catalogue fallback | Verify the governed caller posture; do not use browser headers to bypass it |
| Error or unavailable | An explicit source failure with a Retry control | Retry once to re-contact the source; escalate with the displayed HTTP status if it persists |
| Recheck failed | The last admitted register and its unchanged **Checked** receipt remain visible with a compact failure message | Continue using the explicitly dated prior check, or recheck once when the source is available; a permission refusal removes the rows |

An initial failure never substitutes a global portfolio catalogue. After a successful check,
Workbench can retain the exact register in governed Query state. An ordinary recheck failure keeps
that admitted evidence visibly tied to its earlier receipt; an authenticated permission refusal
removes it. Workbench never describes browser receipt time as source freshness.

## Workbench Boundaries

This slice deliberately does not claim, infer, or calculate:

- team, delegated, supervisor, household, or grouped-client coverage,
- independent tenant or production identity authority,
- book, household, or client AUM,
- attention ranking, favourites, or opportunity priority,
- suitability, recommendation, proposal approval, or mandate-change authority,
- client communication, report publication, order creation, execution, fills, or settlement.

Technology certification, resilience, scalability, dependency support, and explicit non-claims are
owned centrally in [Technology Risk and Runtime Support](Technology-Risk-and-Runtime-Support); this
guide does not turn a supported screen into a claim of bank approval or production readiness.

## Adjacent Handoffs

- [Portfolio Review](Portfolio-Review-Screen-Guide) is the supported next step after portfolio
  selection.
- The portfolio context switcher can preserve the current task when moving between supported
  Portfolio, Allocation, Positions, Transactions, Income, Cashflow, Performance, Risk, Proposal,
  Advisory, Reports, and Manage surfaces.
- Redirects and compatibility routes reuse their canonical screen guides. They do not create a
  second Advisor Book workflow or source of truth.

## Evidence And Validation

- Focused unit and integration coverage validates the strict Advisor Book contract, business-date
  admission and source-scope agreement, state model, filters, paging, task-preserving navigation,
  permission handling, exact Query identity, remount/focus/reconnect suppression, abort propagation,
  late-response fencing, explicit recheck, retained-evidence failure, and absence of a global fallback.
- `tests/e2e/advisor-book-workspace.spec.ts` proves compact desktop measures, one collapsed support
  disclosure, raw-reference exclusion from the primary path, explicit open/close behavior, the
  first portfolio decision row above 900 pixels at 1440, 1024/720/519 reflow, exact receipt and
  recheck request counts, retained-register failure, and date recovery without a fabricated request.
- `docs/evidence/issue-811-decision-worklists/advisor-book/` contains reviewed diagnostic desktop,
  tablet, and compact decision-first screenshots. They are not canonical runtime proof.
- `scripts/live/validation/browser-workflows.mjs` derives every expected portfolio identity and
  lifecycle state from the validated Gateway response, then requires exact rendered parity through
  the shared source-render proof. Missing, extra, duplicate, malformed, or mismatched rows fail.
- Canonical proof uses `PB_SG_GLOBAL_BAL_001` and requires exactly one canonical portfolio,
  `PortfolioManagerBookMembership:v1`, a governed role-assignment basis, current accepted snapshot
  and content evidence, the exact business-date scope, complete internally consistent paging, and
  `portfolio_party_role_assignments` / `role_type` lineage.
- Legacy projection, duplicate membership, stale evidence, incomplete paging, or unrelated
  degradation fails closed. Trusted-context-only tenant scope is recorded as the separately owned
  [Core #798](https://github.com/sgajbi/lotus-core/issues/798) limitation, so
  `advisor.book_overview` remains `partial` even when membership is ready.
- `advisor-book-overview-live.png` is captured only after API and panel checks pass. The screenshot
  is demonstration evidence, not readiness proof; the governed platform panel registry must also
  contain the panel, tracked by
  [lotus-platform #583](https://github.com/sgajbi/lotus-platform/issues/583).

Use [Validation and CI](Validation-and-CI) and [Operations Runbook](Operations-Runbook) for the
governed validation and recovery commands.

## First Support Step

Read the visible state without copying client references or response payloads into a support
channel. Ready or degraded evidence can include data-currency posture and a source correlation
reference; the current failed-request panel exposes the HTTP status only. Retry once. If the state
persists, record the business date, booking-centre scope, state classification, and exactly the
status or correlation reference that is visible, then follow
[Operations Runbook](Operations-Runbook). Do not describe an HTTP status as a request identifier,
and do not attempt recovery by adding browser identity or tenant headers.

## Related Documentation

- [Screen Guide Catalogue](Screen-Guide-Catalogue)
- [Portfolio Review](Portfolio-Review-Screen-Guide)
- [Supported Features](Supported-Features)
- [API Surface](API-Surface)
- [Integrations](Integrations)
- [Validation and CI](Validation-and-CI)
- [Operations Runbook](Operations-Runbook)
- [Security and Governance](Security-and-Governance)
- [Technology Risk and Runtime Support](Technology-Risk-and-Runtime-Support)
