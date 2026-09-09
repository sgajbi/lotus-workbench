# Workbench Experience Research Ledger

- Status: Active
- Started: 2026-07-17
- Scope: screen-by-screen private-banking product experience decisions
- Audience: product, design, engineering, QA, and regulated front-office reviewers

## 2026-08-30 — Source-governed Report Centre ordering and lifecycle (#795)

### Business workflow question

How should an adviser prepare a repeatable portfolio report without inventing policy in the
browser, losing the source context of the review, or mistaking an unfamiliar processing state for
normal progress?

### Evidence consulted

1. [W3C WCAG error identification](https://www.w3.org/WAI/WCAG21/Understanding/error-identification)
   requires input errors to be identified and described in text, not only summarized elsewhere.
2. [BlackRock Advisor Center 360](https://www.blackrock.com/us/financial-professionals/tools/advisor-center-360)
   positions report generation inside the analysed portfolio context rather than as a detached
   technical job console.
3. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   and its [client-engagement workflow](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/engage-clients-holistically)
   emphasize a connected workflow and consistent language across current and proposed portfolios.
4. [Temenos Wealth Management](https://www.temenos.com/products/wealth-management/) describes a
   configurable adviser workflow, while its
   [wealth-management provider catalogue](https://www.temenos.com/provider_category/wealth-management/)
   distinguishes report creation, production, validation, distribution, and archive stages.
5. [Avaloq data and analytics](https://www.avaloq.com/platform/data-analytics) emphasizes governed,
   consistent data access as a control against manual inconsistency.

### Adopted decisions

1. Keep report preparation embedded in the confirmed portfolio-review context.
2. Source the allowable report date and currencies from the existing portfolio workspace and the
   report-specific fields, sections, outputs, and requirements from the Gateway catalogue.
3. Associate each validation message with its control, focus the first invalid field, and retain a
   concise review summary as secondary orientation.
4. Keep review-before-submit and request lifecycle as distinct business stages. Map only published
   lifecycle states and show unfamiliar states as **Status not reported**.
5. Refresh active request evidence automatically while retaining the last confirmed rows through a
   transient failure with an explicit current-evidence warning.

### Rejected decisions

1. Free-text currency, unbounded dates, browser-owned thresholds, or hidden configuration defaults.
2. A benchmark override when the catalogue publishes only the source-owned default.
3. Preview, template, frequency, scheduling, channel, distribution, or archive controls without a
   supporting source contract.
4. A marketing-card dashboard, technical worker vocabulary, direct Report calls, or competitor
   visual imitation.
5. Treating an unknown lifecycle as preparing, complete, failed, or otherwise reassuring.

### Validation and publication decision

Workbench #795 owns this convergence slice. Contract, form, API, state, hook, integration, and
production-browser tests must prove the governed controls, conditional field, exact lifecycle,
refresh, failure, accessibility, and responsive behavior. The Report Centre guide and repository
context change because supported workflow and recovery truth changed; the wiki must be published
after merge. No Gateway, Report, authentication, entitlement, dependency, or runtime-topology
change is required.

## Mandate Health review continuity: source identity before row position

### Business job

A portfolio manager reviewing a mandate exception must keep the same evidence and next step active
when a refreshed source view changes rank. If the source removes that exception, Workbench must
admit one truthful fallback and then keep it stable; portfolio, mandate, and source-window changes
must never retain evidence from the prior review scope.

### Research inputs

Research was reviewed on 2026-08-24 from current official sources:

1. [React — Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)
   explains that state should be preserved for the same rendered identity and deliberately reset
   when the identity changes.
2. [W3C WAI-ARIA — Listbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)
   distinguishes focus from selection and returns focus to an existing selected option when a
   single-select list receives focus.

### Adopted

1. Reuse `useAdmittedSourceSelection`; do not add a Mandate Health synchronization effect or copy
   its admission logic.
2. Key selection by portfolio, source-confirmed mandate, and cursor-window identity.
3. Preserve a selected source exception across reorder, admit the first source-ranked identity
   only after the prior identity is absent from a resolved response, and retain that fallback
   through later reorder.
4. Prove behavior at the rendered queue and detail pane with mutable source-response regressions.

### Rejected

1. Derive detail as `selected ?? rows[0]` while retaining a stale controlled key: the visible
   record can change without repairing selection authority.
2. Select by row index: source ranking changes would silently change the reviewed evidence.
3. Persist selection across portfolio, mandate, or source-window boundaries.
4. Recalculate ordering, invent exception identity, or add a browser-owned exception action.

### Implementation and validation decision

Workbench #848 is a Workbench-only continuity correction. Gateway/Manage remain authoritative for
exception identity, rank, cursor windows, mandate membership, and business evidence. There is no
visual composition, API, dependency, CSS, authentication, or persisted-action change. Focused
proof covers reorder, removal plus second reorder, portfolio/mandate reset, source-window reset,
keyboard selection, existing partial/unavailable/retry posture, and the established responsive
Mandate Health browser matrix.

## BFF browser-header trust boundary: allowlist before authority

### Business and control job

An advisor action must reach Gateway with the exact business request and support reference, but
never with a browser-selected identity, role, entitlement, session, or upstream credential. A
route-family denylist leaves new Workbench screens exposed by default; a single allowlisted ingress
boundary makes secure behavior reusable as the product surface expands.

### Research inputs

Research was reviewed on 2026-08-24 from current official sources:

1. [Next.js — Building APIs with Next.js](https://nextjs.org/blog/building-apis-with-nextjs)
   describes Route Handlers as a backend-for-frontend boundary that mediates browser access.
2. [Next.js — Data Security](https://nextjs.org/docs/app/guides/data-security) requires security
   checks close to data access and treats client inputs as untrusted.
3. [Next.js — Authentication](https://nextjs.org/docs/app/guides/authentication) separates
   optimistic routing checks from secure authorization at the data boundary.
4. [Next.js — Self-hosting](https://nextjs.org/docs/app/guides/self-hosting) recommends a reverse
   proxy in front of a self-hosted Next.js server for malformed-request and request-limit controls.
5. [W3C Trace Context](https://www.w3.org/TR/trace-context/) defines the bounded `traceparent`
   format carried across service boundaries.

### Adopted

1. Construct a new Gateway `Headers` object from a closed browser allowlist before every
   route-family authority adapter.
2. Carry only content negotiation/type, idempotency, HTTP conditional/range controls, and validated
   correlation/trace context.
3. Write configured caller context only in an explicit development environment, then let explicit
   family adapters narrow it. Promoted and unconfigured environments refuse generic BFF and direct
   server-to-Gateway access until verified principal resolution exists.
4. Combine table-driven behavioral proof across every active BFF family with a repository scanner
   that rejects raw browser-header access or a missing builder.

### Rejected

1. Copy all browser headers and delete known dangerous names: every new authority alias would be
   trusted until separately discovered.
2. Preserve browser `Authorization` for generic routes: production principal resolution is a
   separate server-owned contract under #436, not a passthrough credential.
3. Depend only on the five specialized authority adapters: portfolio, analytics, DPM, document,
   Intake, lookup, and platform routes require the same secure default.
4. Treat this boundary as production authentication or entitlement certification.
5. Preserve static caller configuration as a production fallback: RFC-0109 requires verified
   delegated authority, and an unavailable resolver must stop before Gateway.

### Implementation and validation decision

Workbench #825 owns the closed browser-header allowlist. Workbench #436 owns the subsequent
environment fence and authenticated-principal adoption. Neither change alters screen hierarchy,
Gateway/OpenAPI shape, or supported-feature posture, so rendered evidence is not applicable.
Focused evidence is the exact allowlist contract, non-development zero-upstream-call behavior,
route-family regression coverage, protected review/CI, exact-main validation, wiki parity, and
clean branch restoration.

## Portfolio and Performance review context: source acceptance before presentation (#46)

### Business job

An advisor must be able to choose an available portfolio review date once and carry that context
into Performance without comparing figures from different dates or currencies. A requested
reporting currency must never relabel base-currency figures unless the calculation source proves
that the restatement was applied.

### Research inputs

Research was refreshed on 2026-08-31 from current official sources:

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   for connected portfolio review and advisor workflows rather than detached analytical tools.
2. [IBM Carbon dropdown usage](https://carbondesignsystem.com/components/dropdown/usage/) for concise,
   bounded selection from known business options and explicit disabled-state explanation.
3. [W3C WAI-ARIA listbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/) for predictable
   native selection and keyboard behavior without creating a bespoke composite control.
4. [SAP Fiori filter bar](https://experience.sap.com/fiori-design-web/filter-bar/) for one visible
   review context governing the analytical evidence that follows.

### Adopted

1. Keep review date and reporting currency in the existing governed URL context and pass them
   through the Workbench BFF to every affected Performance read and review action.
2. Keep historical Portfolio Review unavailable, including when the aggregate capability is
   source-supported, until the refresh contract can replace and identity-check every rendered
   workspace-shell module atomically. Keep the date control disabled and retain the
   source-published availability range as evidence; rebalance remains explicitly the latest source
   run.
3. Admit Performance summary and detail only when requested and effective date/currency evidence is
   coherent. Treat `accepted_unverified`, `rejected`, and `unavailable` as base-currency
   presentation states; only `applied` may change the displayed currency.
4. Preserve usable base-currency evidence with one compact business limitation instead of blocking
   the complete workflow or repeating technical diagnostics across panels.
5. Carry the same review context through historical attribution, Advisor Brief reads, and review
   actions so a decision cannot be recorded against a different analytical scope.

### Rejected

1. Browser-side foreign-exchange conversion, inferred historical availability, or fallback dates.
2. Treating an accepted request as proof that restatement occurred.
3. Enabling a partial aggregate capability from module flags when the screen refresh cannot replace
   every carried workspace-shell module atomically.
4. A custom date picker or currency selector when native and existing Workbench controls already
   provide the required keyboard and responsive behavior.
5. Showing mixed summary/detail evidence under one review label or converting a rejected trend
   request into an empty chart.

### Implementation and validation decision

Workbench #46 owns this cross-screen context slice. Gateway and Performance retain calculation,
restatement, effective-date, and capability authority. Focused contract, view-model, component,
integration, and optimized-production browser tests prove request propagation, coherent admission,
base-currency fallback, historical capability gating, and source-state recovery. The Portfolio
Review, Performance Summary, Performance Analysis, and Performance Advisor Brief guides change
because their current capability and support truth changed; wiki source must be published after
merge. Canonical live proof remains separate from deterministic fixture-browser proof.

## Performance review controls: one context, inherited comparison, progressive detail

### Business job

A client advisor or portfolio manager needs to set the analytical question once, then read the
portfolio result, return history, horizon context, attribution, and risk under that same
source-confirmed scope. Repeated selectors, always-open exact dates, and eight default return
columns made the workstation look configurable while increasing the chance of comparing unlike
contexts.

### Research inputs

1. [SAP Fiori Analytical List Page](https://experience.sap.com/fiori-design-web/analytical-list-page/)
   for one filter context governing the analytical content below it.
2. [SAP Fiori Filter Bar](https://experience.sap.com/fiori-design-web/filter-bar/)
   for visible primary filters and progressively disclosed secondary conditions.
3. [IBM Carbon spacing](https://carbondesignsystem.com/elements/spacing/overview/)
   for productive density through a consistent spacing scale rather than smaller type.
4. [Fluent 2 layout](https://fluent2.microsoft.design/layout)
   for responsive hierarchy and content-priority preservation.
5. [W3C WCAG Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
   and [WAI-ARIA radio-group guidance](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)
   for narrow-width reading and honest control semantics.
6. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/products/aladdin-wealth)
   for advisor decision support that connects portfolio analytics to a client conversation.

### Adopted

1. One compact source-selection bar across Summary, Analysis, and Risk.
2. Exact dates and comparison-display overrides as progressive detail.
3. A six-column absolute portfolio-versus-benchmark review as the default, with relative and
   combined views available only when the advisor needs them.
4. Downstream comparison panels inherit the selected horizon and benchmark rather than repeating
   local controls.
5. Four measures across desktop and tablet, two across compact widths, with productive typography
   retained.
6. A named, keyboard-focusable compact comparison region with Period and Window pinned.

### Rejected

1. A false ARIA toolbar: the controls are semantically separate labelled groups and do not
   implement composite-toolbar keyboard behaviour.
2. Always-visible start/end dates: they add noise to standard reporting-period review.
3. Smaller 10–11px type as a density mechanism.
4. A default combined table with cumulative active-return columns: it makes the routine comparison
   wider before the user asks the relative-return question.
5. A screen-local reporting-currency selector: the current Performance contracts do not support a
   caller-controlled currency restatement.

### Implementation and validation

Issue #812 removes the dead duplicate control strip, reuses one typed analysis control model and
request path, applies source selections as one transaction, makes Horizon Comparison inherit the
confirmed context, and extends the shared `AnalyticsTable` contract for governed widths and pinned
columns. Optimized-production browser proof covers 1440, 1024, 768, and 519 pixels with full date
visibility, one control bar, default column truth, keyboard focus, intentional compact table scroll,
and zero page overflow. The reviewed evidence is under
`docs/evidence/issue-812-performance-control-bar/`.

### Review-window dialog focus and recovery follow-up

Research was rechecked for issue #900 on 2026-08-31 against the
[W3C WAI-ARIA modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/),
[W3C modal dialog technique H102](https://www.w3.org/WAI/WCAG21/Techniques/html/H102), and the
[Material UI Dialog API](https://mui.com/material-ui/api/dialog/).

Adopted:

1. Retain MUI's established modal semantics and the existing Workbench dialog composition.
2. Return focus to the initiating **Review window** control when dismissal leaves focus unclaimed,
   while preserving a deliberate focus move made during the exit transition.
3. Bind rejected-refresh Retry to the actual Review window control identity rather than a label for
   a submit button inside the portalled dialog.
4. Release the submitting state immediately when the parent reports that no source refresh was
   dispatched, preserving the last confirmed date range.

Rejected:

1. A custom focus trap or replacement dialog dependency.
2. Unconditional post-transition focus restoration that overwrites the advisor's newer focus.
3. A compatibility alias for the removed in-region **Apply** target.
4. A permanently locked Cancel/Escape path when the requested dates resolve to existing cache keys.

## Advisor workstation build continuity: complete client assets during validation

### Business job

An advisor workstation must remain interactive while engineers validate a release. Missing client
chunks can leave source-backed panels visibly loading without executing their browser lifecycle,
which is operationally indistinguishable from a slow or failed domain service and undermines the
truthfulness of front-office evidence.

### Current-product and professional-standard research

Research was reviewed on 2026-08-24 from official Next.js documentation for custom build
directories, configuration phases, generated TypeScript declarations, and the Next 16 isolated
development-build design. The applicable pattern is explicit artifact ownership between development
and production processes, with generated declarations treated as generated state. The research
informs a compatibility-preserving Next 15 implementation; it is not a framework-upgrade claim.

### Adopted

- Use stable phase-aware `distDir` support in the pinned Next 15.5 runtime: `.next-dev` for the
  interactive host and `.next-build` for production validation.
- Keep both paths in-project, centrally named, and bounded before deletion.
- Prove the rendered page and every referenced client asset throughout the production build, not
  only the compiler exit code.
- Ignore regenerated `next-env.d.ts` and recreate it through `next typegen` before TypeScript.

### Rejected

- Upgrade to Next 16 only to consume `isolatedDevBuild`; #624 owns deliberate framework
  certification.
- Retry missing-chunk builds, stop the shared workstation, or weaken browser assertions.
- Let scripts choose arbitrary output directories or allow cleanup outside the repository.
- Treat server-rendered loading copy as proof that the client lifecycle hydrated.

### Validation and publication decision

Workbench #833 owns the implementation and protected concurrency gate. Issue #836 remains a
separate source-lifecycle tracker until the isolated browser runtime proves whether its Performance
loading symptom survives. The architecture note, repository context, CI wiki, focused tests,
protected review, exact-main validation, wiki publication/parity, issue closure, and clean branch
restoration are required. No Gateway/API/OpenAPI, calculation, authentication, entitlement, or
product-screen behavior changed.

## Discussion pack review: decision-led client meeting preparation

### Business job

A client adviser must prepare one selected proposal discussion without confusing internal
adviser-use content, report production, client consent, or lifecycle position with authority to
publish, deliver, or contact the client. The worklist must remain dense and keyboard-operable while
the selected record presents the meeting rationale, decision memo, disclosures, and client-use
controls in the order needed for the next governed decision.

### Current-product and professional-standard research

Research was refreshed on 2026-08-25 from official sources:

1. [FCA COBS 4.2](https://handbook.fca.org.uk/handbook/COBS/4/2.html) requires client
   communications and financial promotions to be fair, clear, and not misleading.
2. [ESMA MiFID II suitability guidelines](https://www.esma.europa.eu/document/guidelines-certain-aspects-mifid-ii-suitability-requirements)
   reinforce suitability governance across advice and portfolio-management workflows.
3. [FINRA Regulatory Notice 24-09](https://www.finra.org/rules-guidance/notices/24-09) confirms
   that existing supervision and communications obligations apply when firms use generative AI.
4. [SAP Fiori messaging guidance](https://www.sap.com/design-system/fiori-design-web/v1-96/foundations/best-practices/global-patterns/messaging/messaging)
   recommends messages that are local, state-specific, understandable, and actionable.
5. [WCAG 2.2](https://www.w3.org/TR/WCAG22/) governs reflow, status announcements, visible focus,
   and operable targets.

The common applicable pattern is a decision-led proposal-to-meeting journey with source-owned
suitability, narrative, disclosure, and document evidence. The research informs workflow
principles, not competitor imitation or a claim of bank approval.

### Adopted

- Lead with proposal version, meeting decision, unresolved controls, and next action before
  supporting narrative.
- Keep a bounded worklist before one selected decision desk; request selected evidence only.
- Separate adviser narrative, adviser memo, report package, client consent, and client
  release/delivery as five independent source controls.
- Use a full-width selected desk inside the constrained three-rail Workbench canvas and the shared
  grid selector for dense identity-first scanning.
- Put exact support references, capability, and lineage behind progressive **Support details** while
  keeping business decisions and recovery language primary.
- Reconcile the refreshed worklist version with the selected source contract before announcing
  success; preserve explicit failure and focus continuity.
- Use explicit, fail-closed mappings for known source states; preserve exact source values only in
  bounded support evidence.

### Rejected

- Decorative card dashboards, inferred meeting readiness, or client-release actions.
- N+1 evidence reads across the proposal list; invented owner, SLA, priority, client, or whole-book
  totals; and direct browser calls to Advise or Report.
- Treating AI-assisted text as advice, approval, suitability, or client-ready content.
- A new UI framework, page-global CSS, or a one-off selector when a reusable Workbench pattern fits.
- Lifecycle, report-package, or consent wording that could be read as external-use permission.
- A page-local copy change that leaves shared navigation and proposal context with stale wording.

### Implementation and validation

Workbench #749 consumes Gateway #559's `proposal-discussion-pack-review.v1` projection and owns the
selected-record contract and release boundary. Workbench #798 adds one typed discussion-pack copy
authority, explicit enum mappings, aligned shared navigation/context language, decision-first
loading and recovery states, progressive support detail, and focused product-copy regressions.
Optimized production-browser proof covers keyboard selection, truthful refresh settlement,
unsupported-action absence, and zero horizontal overflow at 1440/1280/1024/720/519/390. Canonical
populated proof remains separately governed and must not be inferred from fixture-backed browser
evidence.

## Approval Queue: exception-led selected-record review

### Business job

A client advisor must triage one bounded portfolio proposal window, keep the chosen proposal's
source-supported review posture visible, and enter the full record without losing the originating
portfolio or queue. The queue should reduce record switching while never implying whole-book
completeness, maker-checker approval, client readiness, or execution authority from lifecycle
stage alone.

### Current-product and professional-standard research

Research was reviewed on 2026-08-21 and refreshed on 2026-08-30 from official sources:

1. [BlackRock Aladdin Wealth proposal generation](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/proposal-generation)
   describes one identify, construct, deliver, and implement lifecycle with whole-portfolio,
   suitability, narrative, and implementation evidence.
2. [Avaloq client management](https://www.avaloq.com/platform/client-management) prioritizes
   proposals and compliance items in an integrated advisor workflow while sourcing book facts from
   core banking.
3. [Temenos Wealth Management](https://www.temenos.com/products/wealth-management/) joins
   profiling, risk, compliance, and performance in configurable front-office workflows.
4. [W3C listbox guidance](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/) and
   [keyboard-interface guidance](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
   require a single roving tab stop, standard Arrow/Home/End movement, a clear distinction between
   focus and selection, and predictable movement between composite worklist and decision region.
5. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   emphasizes alerts, targeted advisor nudges, exception-based review, and connected proposal
   lifecycle workflows rather than a generic metric dashboard.

### Adopted

- Use a dense, keyboard-operable single-record worklist with the selected decision context visible
  alongside it at wide desktop widths.
- Keep source stage, version, recorded date, posture, and next action together; open Proposal Detail
  for approval and evidence verification rather than duplicating regulated actions.
- Preserve bounded source-window wording plus portfolio, selected proposal, and lifecycle return
  context in the URL.
- Use Enter to move from a selected row into its decision evidence and Escape to restore focus to
  that exact row; retain split composition while the component has enough capacity and stack in
  the same DOM order when it does not.
- Reuse the shared `WorkbenchWorklist` composition and its container-aware layout instead of a
  queue-only UI stack.

### Rejected

- Decorative proposal cards, optimistic stage timelines, or approval/readiness claims unsupported
  by the selected proposal's owning evidence.
- Invented client, household, owner, priority, materiality, SLA, due-date, or whole-book facts.
- A 920-pixel mobile table, nested actions inside listbox options, unadmitted query identity, or
  another global CSS expansion.

### Implementation and validation

Workbench issue #747 replaces only Approval Queue's raw table with a reusable selected-record
decision workspace, carries portfolio and originating mode into Proposal Detail, and derives the
return portfolio from source detail where available. Focused model/integration proof covers
metadata, keyboard selection, bounded windows, failure states, and source-owned return context;
optimized production-browser proof covers 1440, 1280, 1024, 720, and 390 pixels with no horizontal
overflow. Later Risk Impact, Discussion Pack, and Implementation evidence work remain separate
screen-specific slices.

Workbench issue #809 completes the shared-pattern adoption: Approval Queue consumes
`WorkbenchWorklist`, proposal row presentation has one feature-owned mapping, URL selection is
admitted only from the returned source window, Enter and Escape form a complete focus loop, and
Proposal Detail return restores the admitted selected proposal from the same page-local Gateway
cursor window. Workbench carries the opaque cursor and window ordinal without interpreting
either as business evidence, reconciles browser Back/Forward navigation to that address, and drops
the cursor if source proposal evidence corrects the portfolio identity. Every Proposal Detail
handoff binds the exact proposal being opened, including the source-ranked fallback row. The shared
source-window authority also rejects any cyclic return to a previously visited cursor, permits only
the retained forward window after an advisor steps back, and enforces the governed maximum before
mutating component state or the browser address. The shared
composition uses two columns only when its business lane
has sufficient capacity. Persistent navigation and context rails make the lane stack at 1280
pixels; after those rails reflow at 1024 pixels, the wider main lane supports the split again.
Neither composition changes DOM or business order.

## Proposal Builder: evidence before persistent action

### Business job

A client advisor constructs portfolio changes, reviews the indicative portfolio effect, requests a
source-owned evaluation, and decides whether to retain an advisor-use draft. The long construction
record must keep final controls available without putting them before the holdings, liquidity,
orders, and draft identity that govern the decision.

The reading order is selected portfolio and source boundary, setup measures, source evidence,
portfolio context, positions, cash movements, draft orders, indicative impact, draft identity,
evaluation evidence, and final workflow controls.

### Current-product and professional-standard research

Research was reviewed on 2026-08-21 from official sources:

1. [BlackRock Aladdin Wealth proposal generation](https://www.blackrock.com/aladdin/products/aladdin-wealth)
   describes a connected identify, construct, deliver, and implement journey with whole-portfolio
   analytics and controlled proposal generation.
2. [W3C WCAG 2.2 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
   requires focus order to preserve meaning and operability.
3. [W3C technique C27](https://www.w3.org/WAI/WCAG22/Techniques/css/C27.html) keeps DOM order
   aligned with the meaningful visual sequence.

### Adopted

- Keep construction and evidence before the final action rail in DOM and keyboard order.
- Keep a persistent, subordinate desktop review rail so a long record does not force an advisor to
  scroll back to act.
- Stack the rail after construction at the shared tablet boundary and preserve 44-pixel actions.
- Fence evaluation and handoff as one source-transaction family and announce success only after a
  usable source response.
- Keep evaluation evidence distinct from retained-draft identity and preserve portfolio scope when
  continuing to the queue.
- Reuse Workbench shell, rail-card, action, badge, typography, and semantic-token patterns.

### Rejected

- Actions before evidence in DOM order, a floating mobile overlay, or a permanently fixed footer
  that obscures form content.
- Decorative proposal scores, suitability conclusions, approval posture, client readiness, or
  execution authority not returned by a governed source.
- Browser-created fallback holdings, FX conversion, evaluation success, or proposal identity.
- A one-off global CSS expansion, new UI library, competitor visual imitation, or technical service
  names as the advisor's primary confirmation language.

### Implementation and validation

Workbench issue #745 extracts `ProposalBuilderWorkflowRail`, replaces the disappearing action panel
with the shared workstation side-rail layout, removes the duplicate outer workflow rail, and keeps
source progress, failure, evaluation confirmation, and retained-draft confirmation beside both
fenced actions. Focused integration proof covers order, scope, pending and failure behavior;
optimized production-browser proof covers 1440, 1024, 720, and 390 pixel layouts with no horizontal
overflow. The global Proposal workspace remains capability-disabled.

## Advisory Overview: recoverable proposal prioritisation

### Business job

A client advisor uses Advisory Overview to decide which visible proposal needs attention first,
identify its lifecycle handoff, and open the source record without mistaking one cursor window for
the complete portfolio or advisor book. A source interruption must not force a page reload, hide
retained-earlier status, or imply that the queue is current.

The reading order is selected portfolio, advisor decision, visible-window measures, lifecycle
handoffs, priority worklist, source-window posture, then proposal detail.

### Current-product and professional-standard research

Research was reviewed on 2026-08-21 from official sources:

1. [BlackRock Advisor Center 360](https://www.blackrock.com/us/financial-professionals/tools/advisor-center-360)
   centralises whole-book and portfolio insights so advisors can identify accounts requiring
   attention, prepare meetings, analyse portfolios, and continue into proposals and reports.
2. [Morningstar Direct Advisory Suite](https://www.morningstar.com/business/products/direct-advisory-suite)
   connects research, proposal, planning, and compliance-aware advisory work in one operating flow.
3. [Salesforce Wealth Management](https://www.salesforce.com/financial-services/wealth-management-software/)
   joins client context, alerts, tasks, and action plans to reduce workflow switching.
4. [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
   requires asynchronous outcomes to be programmatically available without moving focus.

### Adopted

- Keep one dense, portfolio-scoped worklist with the highest-priority visible action first.
- Preserve explicit cursor-window scope and route from summary to the owning proposal record.
- Recover in place by recontacting the same Gateway query rather than requiring navigation or
  browser reload.
- Keep the source action mounted and keyboard focus stable while fencing repeat requests.
- Retain earlier evidence only under an explicit unconfirmed posture and announce success only
  after Gateway returns current rows.
- Use one shared Workbench source-refresh primitive instead of another page-local async button.

### Rejected

- Browser-created fallback proposals, book-wide counts, policy thresholds, suitability conclusions,
  approval, client-publication, contact, order, or execution authority.
- A full-page reload as the primary source-recovery path.
- Technical cache, query, refetch, service, or raw-error language in the business scan.
- Disabled-control replacement that drops focus, decorative success banners, card-grid expansion,
  or competitor visual imitation.

### Implementation and validation

Workbench issue #729 introduces the shared `SourceRefreshAction`, applies it to Advisory Overview,
and removes a duplicated optional-source refresh implementation from Data Product Catalogue. The
screen now proves initial unavailable-to-ready, retained-evidence-to-ready, repeated-request
fencing, persistent failure, permission blocking, focus continuity, and 1440/1024/519-pixel
optimized-browser reflow through the Gateway/BFF boundary. The global Advisory app entry remains
capability-disabled; the guide does not promote broader product availability.

## Risk Review: measured evidence before policy judgement

### Business job

A client advisor or portfolio manager uses Risk Review to understand measured downside,
concentration, rolling behavior, and risk contributors for one selected portfolio before deciding
whether a professional or policy review is required. The screen must let the user identify the
measure, period, driver, coverage, methodology, approved constraint, comparison state, and source
limitation quickly without mistaking a browser calculation for mandate or house-policy authority.

The reading order is:

1. exact realized volatility, max drawdown, largest position, and source coverage,
2. source-reported mandate exceptions, unavailable measures, undefined limits, and evidence gaps,
3. snapshot and drawdown evidence,
4. position and issuer concentration with coverage and methodology,
5. rolling-risk and historical-attribution detail on demand,
6. source supportability, warnings, and partial failures.

### Current-product and professional-standard research

Research was reviewed on 2026-08-20 and refreshed on 2026-08-29 from official sources:

1. [BlackRock Aladdin Risk](https://www.blackrock.com/aladdin/platforms/products/aladdin-risk)
   emphasizes context-appropriate models and factors, risk decomposition, and source analytics.
2. [BlackRock Aladdin Wealth Regulation Best Interest](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/regulation-best-interest)
   describes alignment to investment profiles, risk alerts and outliers, and a common risk
   language rather than a universal client-independent browser threshold.
3. [CFA Institute Standard III(C)](https://www.cfainstitute.org/standards/professionals/code-ethics-standards/standards-of-practice-iii-c)
   requires suitability and portfolio-risk judgement to consider written objectives, mandate,
   risk tolerance, constraints, and the total portfolio.
4. [Avaloq Investment Management](https://www.avaloq.com/solutions/investment-management)
   emphasizes a connected front-to-back investment process with monitoring and constraint control.
5. [MSCI Wealth Manager](https://www.msci.com/our-solutions/analytics/wealth-manager)
   presents portfolio risk, exposure and proposal analysis as one decision workflow.
6. [W3C WCAG status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
   requires important state changes to remain programmatically determinable without forcing focus.
7. [W3C accessible names and descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)
   recommends concise visible labels and distinct names when otherwise similar elements have
   different purposes.

### Adopted

- Lead with exact source measures and factual recovered/open and source-coverage evidence.
- Preserve module-level ready, partial, unavailable, and blocked posture from source contracts.
- Lead with source-declared exception and evidence-gap states, then show within-mandate rows.
- Render the Gateway comparison as a compact ledger with aligned measures, limits, source headroom,
  dates and reasons; put lineage behind keyboard-accessible progressive disclosure.
- Preserve absent, unavailable, date-misaligned, undefined-limit, and unavailable-measure states.
- Use dense progressive disclosure for methodology, episodes, series, and attribution detail.
- Validate keyboard semantics, accessible evidence labels, and 1440/1024/519-pixel reflow.
- Give the primary comparison row and its progressive source-evidence section distinct purposes:
  the row names the constraint; the disclosure heading names that constraint's evidence.
- Bind canonical proof to the exact Gateway source family and constraint key rather than display
  copy, while still asserting the rendered state and rejecting missing, extra, or duplicated rows.

### Rejected

- Workbench-authored volatility, drawdown, HHI, position, issuer, or top-N severity thresholds.
- A green all-clear, red breach, or universal acceptable/diversified band without source policy.
- Browser-owned limit, ratio, headroom, breach, review-due, or portfolio all-clear calculations.
- Repeated KPI cards for facts that compare more quickly in one aligned constraint ledger.
- Merely adding a disclaimer while retaining the fabricated scale or accessible classification.
- Copying competitor layout, wording, visual identity, thresholds, or unsupported capability.
- A global text locator whose result changes when the same business term appears in progressive
  evidence, and hiding useful evidence copy merely to make that locator pass.

### Implementation and validation

Workbench issue #723 replaced executive classifications with exact source evidence and removed the
fabricated concentration scale. Issue #875 consumes Gateway's additive mandate-comparison contract
through the existing BFF, projects source facts without arithmetic or policy, and replaces the old
placeholder with an exception-first, responsive constraint ledger. Focused transport, projection,
component, source-authority, keyboard, responsive Playwright, and canonical machine-readable proof
own the implementation. Deterministic fixtures reproduce Gateway's published example contract;
they are regression evidence, not live source authority.

Issue #922 removes the last display-copy dependency from canonical row proof. Each rendered row now
carries one source-and-constraint identity, while progressive disclosure uses a purposeful
`<constraint> evidence` heading. The validator derives its expected rows from the exact Gateway
responses, proves each row is unique and visible, and compares its source, key, and state without
calculating or inferring policy in the browser.

## Portfolio Review

### Business job

A client advisor or portfolio manager opens Portfolio Review to decide whether the selected
portfolio is ready for a client or investment review, what requires attention, and which supported
workflow to enter next. The screen is an orientation and decision surface; allocation analysis,
position investigation, transaction review, performance analysis, and proposal construction remain
dedicated workflows.

The reading order is:

1. selected portfolio, reporting currency, status, and as-of date,
2. value, invested assets, liquidity, and period returns,
3. the highest-priority source-reported exception or insight,
4. readiness, open exceptions, and recommended next step,
5. supporting exception detail and reporting evidence,
6. a drill-down into the relevant workflow.

### Current-product research

Research was reviewed on 2026-07-17 from official product sources:

1. [Addepar for wealth management](https://addepar.com/wealth-management) and
   [Addepar platform overview](https://addepar.com/platform-overview): unified public/private asset
   context, exposure, performance, liquidity, governed access, and a path from portfolio questions
   to decisions.
2. [Morningstar Direct Advisory Suite](https://www.morningstar.com/business/products/direct-advisory-suite)
   and [Morningstar portfolio analytics services](https://developer.morningstar.com/direct-web-services/use-cases/portfolio-analytics-services):
   connected portfolio comparison across risk, performance, and exposure with reporting and
   regulatory workflow context.
3. [Orion Advisor Portal](https://orion.com/advisor-tech/advisor-portal): one advisor workspace for
   client views, proposals, trading, reporting, service requests, and workflow tracking.
4. [Salesforce Financial Services Cloud for wealth management](https://help.salesforce.com/s/articleView?id=sf.fsc_admin_landing_wealth.htm&language=en_US&type=5):
   client and relationship context joined to tasks, action plans, life events, and alerts.
5. [BlackRock Advisor Center 360](https://www.blackrock.com/us/financial-professionals/tools/advisor-center-360):
   account prioritization, concentration and opportunity review, portfolio comparison, risk
   contributors, and report workflows.
6. [Black Diamond Wealth Platform on Schwab Advisor Services](https://advisorservices.schwab.com/provider-solutions/Black-Diamond-Wealth-Platform):
   relationship-level portfolio context with key metrics kept prominent.

These sources inform workflow principles only. Lotus does not copy competitor layout, wording,
visual identity, calculations, or unsupported capabilities.

### Adopted decisions

1. Keep relationship and portfolio identity stable while the user moves from summary to detail.
2. Put a compact financial summary before charts, tables, and operational evidence.
3. Use exception-first disclosure: show the decision and consequence before technical evidence.
4. Place a supported next step beside the insight that motivates it.
5. Use dense rows and compact groups for related facts instead of a mosaic of equally weighted
   cards.
6. Preserve explicit as-of, currency, partial-failure, source, and supportability truth.
7. Keep detailed analytical records on dedicated screens reached through contextual navigation.

### Rejected decisions

1. Arbitrary user-configurable dashboard tiles: they weaken a governed review order and add layout
   complexity before role-specific workflow contracts exist.
2. Browser-owned thresholds, scores, alerts, or compliance interpretations: domain authority belongs
   in the source service and Gateway display contract.
3. Static trust, readiness, evidence, or workflow claims: regulated posture must be source-backed.
4. One page containing every chart and record grid: it increases scan cost and duplicates dedicated
   workflows.
5. Decorative gradients, excessive rounding, large hero marketing copy, and card-per-sentence
   composition: they reduce enterprise density and hierarchy.
6. Raw service names, endpoint vocabulary, catalog status, error codes, and implementation language
   in the main business reading path.

### Slice 1 — source-authoritative decision brief

The Portfolio Review decision brief now uses a reusable `WorkbenchDecisionBrief` pattern. The
portfolio adapter supplies source-owned exceptions, insights, overall readiness, reporting
coverage, and workflow actions in business order. GitHub issue #410 is the implementation and
recheck contract for this slice.

The slice deliberately removes:

1. the browser-created 5% cash review threshold,
2. duplicate presentation of an upstream partial failure when a shaped exception is available,
3. the technical `Catalog live` page status,
4. the page-specific executive-summary component, status wrapper, and unreferenced legacy summary
   layout CSS.

The brief now presents the Gateway-backed `Ready`, `Partial`, or `Not Ready` posture directly. A
populated diagnostic rejected the earlier label-derived percentage because it could render `0%`
beside a source-owned `Partial` posture and could still declare the review ready. Reporting status
and published row count remain separate operational facts; neither is presented as an investment,
suitability, compliance, or client-readiness score.

### Follow-up boundaries

1. Reuse the decision-brief primitive only where another screen has the same state → exception →
   next-action workflow; do not force visual reuse where the business job differs.
2. Split the remaining large Portfolio API and view-model modules in separate behavioral slices
   with characterization and contract tests under GitHub issue #408.
3. Replace static advisory evidence and readiness claims under GitHub issue #407 before presenting
   that rail as production workflow truth.
4. Preserve Gateway source-date authority under `sgajbi/lotus-gateway#494`; Workbench must not
   correct a manufactured or stale source date in the browser.

### Validation record

1. Focused component, view-model, and Portfolio tests: 19 passed before the populated review and
   12 readiness/decision-brief tests passed after the diagnostic correction on 2026-07-17.
2. Full `make check`: passed on 2026-07-17 with 1,214 tests, lint, typecheck, production build,
   90.64% statement coverage, and coverage above the repository thresholds.
3. Governed canonical seed verification passed for `PB_SG_GLOBAL_BAL_001`: 11 positions, 8 valued
   positions, 31 transactions, 2 cash balances, 4 allocation buckets, benchmark and analytics
   horizon through 2026-04-10, and no pending or failed valuation jobs.
4. Populated Portfolio Playwright smoke: 2 passed after the Gateway date correction, including the
   decision review. The diagnostic screenshot is intentionally not demo evidence because the full
   platform validation was blocked by separately filed runtime defects in Core, Manage, Report,
   Idea image provenance, and the canonical platform preflight.
5. Gateway issue #494 was merged as `ff23baf7`. After a targeted Gateway-only rebuild, the live
   default workspace request resolved `as_of_date` to the governed source date `2026-04-10`, with
   11 positions, 2 cash balances, and no partial failures. Workbench does not correct this date in
   the browser.
6. Full canonical platform/demo certification remains pending until the remaining owning issues
   are resolved; no demo-ready screenshot claim is made by this slice.
7. Workbench PR #411 merged to `main` as `497066e` after every feature and PR merge-gate lane
   passed. Issue #410 remains the durable implementation and recheck record.

### Publication decision

No repo wiki change is required for Slice 1. The slice changes composition and removes unsupported
client-side behavior; it does not add or change a supported feature, integration, operator command,
or published runtime contract.

### Slice 2 — exception-first decision proof

Research was revalidated on 2026-08-12 from official sources:

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   describes a whole-portfolio view, exception-based portfolio review, targeted advisor nudges, and
   connected workflows. Those principles support one ranked decision path rather than equal-weight
   dashboard cards.
2. [W3C WCAG 2.2 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html),
   [Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html),
   [Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html),
   and [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) define the keyboard and
   constrained-viewport evidence expected for a usable decision workstation.

These sources inform workflow and quality criteria only. Lotus does not copy competitor layout,
wording, visual identity, calculations, or unsupported capabilities, and this evidence is not a
claim of comparative product superiority.

Adopted under issue #649:

1. Load the already-governed dated Gateway workflow projection in the summary fan-out so the first
   visible action is source-supplied rather than a browser fallback.
2. Keep the primary decision, source limitations, and workflow action ahead of secondary evidence
   and analytical handoffs.
3. Use one visual surface per business module; remove redundant rail-card wrappers instead of
   adding page-specific CSS.
4. Prove responsive behavior across the full 1440-to-519-pixel matrix, including the exact 721/720
   rail transition, rather than validating only desktop and one mobile screenshot.
5. Prove every focusable control has an accessible name, visible and unobscured focus, logical order,
   Enter/Escape recovery, and a complete narrow-screen sequential traversal.
6. Retain screenshots for visual review and machine-readable JSON for deterministic assertions;
   neither substitutes for populated canonical source proof.

Rejected:

1. Browser-authored next actions, completion copy, exception thresholds, or readiness claims.
2. Decorative charts, hero copy, extra cards, or bespoke global styles that do not reduce the time
   from exception to supported action.
3. Hiding source evidence to obtain a cleaner screenshot.
4. Screenshot-only accessibility acceptance or a viewport sample that misses the layout boundary.
5. A new UI dependency or framework for behavior already supported by the established Workbench
   component system.

Focused evidence passes 77 unit tests, TypeScript, touched-file lint, and the seven-viewport
production-browser matrix, including 24-of-24 keyboard traversal at 519 pixels. The fresh populated
canonical rerun remains blocked before Workbench/Gateway readiness by `lotus-core#943`; issue #649
must retain that limitation until source-backed exact-main evidence is rerun. The Portfolio Review
screen guide changes because its summary source contract, workflow-action posture, and validation
procedure changed. Repository and platform context remain unchanged: the established Gateway/BFF
ownership boundary and runtime topology did not change.

## Advisory Workflow Context Rail

### Business job

The advisory context rail helps a relationship manager understand the current proposal queue or
selected advisory record without leaving the active work area. It must answer four questions in
order: what is the current posture, what business action is next, what evidence is blocking that
action, and which approved source supplied the posture. It is not a decorative checklist and does
not create KYC, suitability, approval, client-publication, or execution truth.

### Current-product research

Research was revalidated on 2026-08-04 from official product sources:

1. [Salesforce Financial Services Cloud Action Plans](https://help.salesforce.com/s/articleView?id=sf.fsc_action_plans&language=en_US)
   models business-process tasks with status, priority, completion time, responsibility, target
   record, and reusable dependencies. That supports record-specific tasks rather than generic
   browser-authored checklists.
2. [BlackRock Aladdin Wealth proposal generation](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/proposal-generation)
   separates identify, construct, deliver, and implement stages, places suitability and pre-trade
   checks before downstream order-management execution, and supports proposals at household,
   client, account, or sleeve level.
3. [BlackRock Aladdin Wealth regulation best-interest workflow](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/regulation-best-interest)
   emphasizes recommendation evidence, consistent risk processes, and monitored exceptions rather
   than a presentation-layer readiness assertion.

These sources inform workflow hierarchy and evidence boundaries only. Lotus does not copy their
layout, visual identity, wording, calculations, or unsupported capabilities.

### Adopted decisions

1. Use one typed six-state contract for loading, empty, partial, ready, unavailable, and restricted
   workflow context.
2. Keep the shared shell neutral. The workspace that owns the source query publishes context; the
   shell does not fetch, guess a selected proposal, or choose the first queue row.
3. For queue-level views, show source-returned volume and attention posture, the current business
   decision, recovery guidance, and an explicit instruction to open a proposal for record evidence.
4. For simulation, state that construction has no persisted workflow record until a draft is
   created through the approved service.
5. Use a dense summary-to-exception-to-detail order: status, current posture, next business action,
   blocking evidence, then source and scope disclosure.
6. Preserve permission and source-failure boundaries without cached or fallback workflow claims.

### Rejected decisions

1. Hard-coded review steppers, completion controls, KYC validity, suitability completion,
   evidence-pack progress, or client-readiness labels.
2. A shell-owned fetch layer or implicit selection of the first proposal or policy evaluation.
3. Combining source-specific failures into a healthy-looking generic workflow state.
4. Client approval, delivery, communication, order, OMS, fill, settlement, or execution language
   unless the relevant upstream contract explicitly supplies it.
5. Decorative tabs for evidence, tasks, and audit history when no such record data is present.

### Validation and publication decision

Issue #407 owns implementation and recheck. Focused view-model, component, integration, and route
tests cover the six states, live queue publication, neutral default, simulation boundary, compact
layout, and absence of legacy authority claims. Full repository and protected CI evidence is added
to the issue before closure.

No repo wiki change is required. This slice corrects presentation authority and repository guidance
without changing a supported route, backend contract, operator command, or published capability.

## Allocation Review

### Business job

A client advisor or portfolio manager opens Allocation Review to understand how the selected
portfolio is invested, move across asset-class, currency, sector, and region exposure, and identify
the booked positions that contribute to a direct exposure. The screen explains current composition;
it does not invent a strategic target, benchmark comparison, drift interpretation, suitability
decision, or rebalance recommendation.

The reading order is:

1. portfolio identity, mandate, currency, and source as-of date,
2. assets under management, available exposure views, and position count,
3. the selected exposure dimension and direct or expanded exposure mode,
4. ranked exposure value, weight, and source-reported position count,
5. contributing booked positions for a selected direct exposure,
6. adjacent Portfolio, Position, Mandate, Risk, or Performance workflows where supported.

### Current-product research

Research was reviewed on 2026-07-17 from official product sources:

1. [Morningstar Portfolio X-Ray](https://www.morningstar.com/help-center/portfolio/xray): asset,
   sector, and region views pair portfolio breakdowns with a holdings breakdown that explains how
   each security contributes to an exposure.
2. [BlackRock Portfolio 360](https://www.blackrock.com/portfolio-centre): allocation is one stage
   in a defined, repeatable portfolio-review process designed to turn portfolio data into informed
   action rather than an isolated visualization.
3. [BlackRock Advisor Center 360](https://www.blackrock.com/us/financial-professionals/tools/advisor-center-360):
   portfolio analysis emphasizes actionable holdings-based insights and security-level drivers.
4. [Addepar for institutional allocators](https://addepar.com/institutions/allocators): governed
   total-portfolio analytics keep true look-through exposure distinct across fund and ownership
   structures.

These sources inform workflow principles only. Lotus does not copy competitor layout, wording,
visual identity, calculations, or unsupported capabilities.

### Adopted decisions

1. Pair exposure views with the contributing-holdings result in the same screen flow.
2. Keep direct holdings and expanded exposure explicit; never silently substitute one for the
   other.
3. Use the existing dense Portfolio holdings grid for contributor review, including its search,
   columns, export, keyboard, filter, valuation, and empty-state behavior.
4. Use business-facing visualization choices (`Composition`, `Comparison`, and `Table`) and
   describe the data as exposure rather than chart implementation.
5. Keep the source as-of date, reporting currency, position count, market value, weight, and
   classification visible without recomputing allocation totals in the browser.
6. Treat an unmatched direct filter as an empty contributor result, not as an empty portfolio.

### Rejected decisions

1. Filtering direct booked positions to explain expanded look-through exposure: the booked parent
   and decomposed component are not equivalent.
2. Browser-authored target weights, benchmark weights, drift, concentration thresholds, risk
   interpretation, or rebalance advice: none is present in the current Gateway allocation contract.
3. A cross-dimension total of allocation buckets: the same portfolio is classified repeatedly, so
   the aggregate is a technical count with no stable business interpretation.
4. A one-off contributor table: it would duplicate the supported Portfolio holdings pattern and
   diverge in accessibility, export, empty, valuation, and column behavior.

### Slice 1 — exposure-to-contributing-holdings flow

GitHub issue #413 governs the slice. Allocation selection now filters source portfolio positions by
the selected direct asset class, currency, sector, or region and presents the result through the
reusable holdings grid. The result names the selected exposure, reports the source-row count, and
provides keyboard-accessible clear actions. The unselected state keeps the full booked inventory
visible and explains how to begin contributor review.

Allocation drill-down shaping moved from the broad Portfolio view model into the focused
`portfolio-allocation-drilldown-view-model.ts`. The unused generic holdings drill-down union and
its unconsumed security/status branches were removed. The holdings grid now accepts reusable
business headings and distinguishes an empty filtered result from an empty source book.

Cash balances are source records outside some booked-position payloads, so the contributor view
adds any missing cash balance as a typed cash holding and deduplicates it against booked positions
by source security id. Source-valued cash is not misclassified as an unpriced security merely
because the balance contract has no market-price field. Allocation review state is mounted by
portfolio identity, preventing a client-side portfolio change from carrying a prior book's
selection or exposure mode into the next book.

When expanded look-through is applied, contributor actions are disabled and the booked inventory
is labelled as reference only. Core issue `sgajbi/lotus-core#801` tracks preservation of contributor
and booked-parent lineage during allocation aggregation. Gateway issue
`sgajbi/lotus-gateway#496` tracks publication of that source detail to Workbench. Until both land,
Workbench does not claim an expanded contributor drill-down.

### Slice 2 — source-confirmed coverage and recovery

GitHub issue #727 governs the slice. A second research pass on 2026-08-20 reviewed official
[BlackRock Advisor Center 360](https://www.blackrock.com/us/financial-professionals/tools/advisor-center-360),
[BlackRock Aladdin Wealth asset-allocation guidance](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/insights/asset-allocation),
[Morningstar Portfolio X-Ray](https://portfolio.morningstar.com/rtport/reg/xray_landingpage.aspx),
and [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages).
The adopted workflow moves from whole-portfolio composition into holdings-based investigation,
keeps exact values next to the visual, and makes asynchronous source progress and results available
without moving focus. Lotus does not copy another product's layout, wording, calculations, or
unsupported capabilities.

The prior client state converted any missing preferred-look-through response into a completed
**Direct positions only** conclusion. That made transport, HTTP, and parsing failure
indistinguishable from a valid source response that explicitly did not support expanded exposure.
The replacement state model distinguishes checking, available, unsupported, and failed; treats the
book-provided direct allocation as confirmed evidence; fences superseded portfolio responses; and
forces a fresh source request on recheck. Valid direct evidence remains usable throughout optional
coverage failure.

The recovery control remains mounted and focus-stable, and successful recovery is announced only
after a valid source response. Compact layouts intentionally suppress the chart and its presentation
switcher when the visualization cannot remain informative, preserving the exact ranked market
value, weight, and position evidence instead. The new rules live in an Allocation-owned CSS Module;
eight dead responsive lines were removed from the global legacy layer and the exact global CSS
ratchet was lowered.

Rejected decisions for this slice were a browser-authored unsupported state after request failure,
silently retaining a prior portfolio's response, allowing duplicate retries, suppressing expected
browser errors in validation, showing an unreadable micro-chart on compact screens, and enabling
expanded contributor drill-down before Gateway/Core publish decomposed lineage.

### Slice 1 validation record

1. Focused allocation, record-screen, holdings-grid, and Portfolio view-model coverage: 33 tests
   passed on 2026-07-17.
2. Full `make check` passed after review fixes on 2026-07-17: 285 test files and 1,229 tests passed
   with 90.83% statement coverage, followed by clean lint, TypeScript validation, and a successful
   production build.
3. The populated Playwright smoke pack passed all three Portfolio tests against
   `PB_SG_GLOBAL_BAL_001`. Allocation proof covered keyboard selection of a ranked direct exposure,
   the contributing-holdings result, clear-filter restoration, and the source-backed unavailable
   look-through state. No demo-ready screenshot was published because this run was implementation
   validation rather than a full canonical platform certification.
4. PR #414 merged to `main` as `3fcdefee` after all feature and protected merge-gate lanes passed,
   both review findings were resolved, and the final Codex review reported no major issues. The
   post-merge Main Releasability Gate also passed workflow lint, lint, typecheck, coverage, build,
   Playwright smoke, Docker build, and Dockerized local-CI parity. Issue #413 is closed and codebase
   review item `LWB-R154` is hardened.

### Slice 1 publication decision

No repo wiki change is required for this slice. It completes an existing supported Allocation
screen interaction and documents an unavailable expanded-contributor boundary; it does not change
an operator command, integration contract, supported-feature claim, or published runtime flow.

### Slice 2 validation and publication decision

Focused Allocation, service-addressing, and scenario-runner coverage passed 32 tests. The dedicated
optimized standalone browser journey passed against `PB_SG_GLOBAL_BAL_001` with an initial
unconfirmed response, retained direct evidence, keyboard contributor review, exact two-request
recovery, stable retry focus, confirmed expanded coverage, honest expanded-contributor limitation,
zero browser errors, and zero page overflow at 1440, 1024, and 519 pixels. Reviewed screenshots and
machine proof are generated under `output/playwright/issue-727-allocation-recovery/`. The global CSS
governance gate passes at the lowered 11,976-line and 261,580-normalized-byte limit.

Slice 2 changes business-visible recovery and supported-feature truth, so the repo-local wiki now
includes the complete Portfolio Allocation screen guide, catalogue/navigation entry, concise API
contract note, and supported-feature clarification. Publish those authored pages only after the PR
merges, then verify strict wiki parity.

## Positions Review

### Business job

A client advisor or portfolio manager opens Positions Review to verify the complete booked
inventory at the portfolio as-of date, understand valuation and unrealised profit-and-loss posture,
and move from a holding to its recent booked activity. The screen supports book review and meeting
preparation; it does not infer tax lots, suitability, recommendations, targets, drift, risk,
performance, orders, execution, or settlement authority.

The reading order is:

1. portfolio identity, mandate, currency, and source as-of date,
2. assets under management, invested assets, and cash,
3. complete booked securities and source cash balances,
4. valuation, cost basis, weight, unrealised P&L, currency, status, and identifiers,
5. holding overview, valuation detail, and recent booked activity,
6. the full Transactions ledger when broader activity review is needed.

### Current-product research

Research was reviewed on 2026-07-17 from official product sources:

1. [Morningstar Direct Portfolio Management](https://www.morningstar.com/business/products/direct/portfolio-management-tool):
   holdings analysis connects individual investments, grouping, impact, and portfolio context.
2. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth):
   advisors need a comprehensive whole-portfolio view across holdings and connected workflows.
3. [BlackRock Advisor Center 360](https://www.blackrock.com/us/financial-professionals/tools/advisor-center-360):
   holdings-based analysis should support actionable portfolio insight and meeting preparation
   rather than stop at a static inventory.

These sources inform workflow principles only. Lotus does not copy competitor layout, wording,
visual identity, calculations, or unsupported capabilities.

### Adopted decisions

1. Treat Positions as a point-in-time booked-inventory review governed by the source as-of date.
2. Show AUM, invested assets, and cash as the first-read book composition instead of a generic
   rolling window.
3. Combine booked positions with separate source cash-balance records, deduplicated by source
   security id and typed so valued cash is not misclassified as an unpriced security.
4. Keep the reusable dense holdings grid, including search, user-selected columns, export,
   valuation status, partial valuation posture, and empty states.
5. Make each instrument a named keyboard control and retain whole-row pointer activation for fast
   review.
6. Reuse the Portfolio detail drawer for holding overview, valuation, and recent booked activity;
   explicitly identify the activity as the subset supplied with the current portfolio review and
   link to the full transaction ledger.
7. Move complete-inventory shaping into one shared view model used by Allocation and Positions,
   and extract the drawer controller so record screens do not duplicate lazy-loading behavior.
8. Settle detailed record requests independently and carry securities, liquidity, and activity
   availability into the screen, so an upstream gap cannot be rendered as zero or complete data.

### Rejected decisions

1. A 30-day Positions KPI: holdings are point-in-time records and the generic period was false
   context.
2. Disabled decorative filters and selection checkboxes without a bulk business action: visible
   controls must produce a supported outcome.
3. A page-specific holdings table or drawer: both would duplicate existing Workbench patterns and
   create accessibility, export, and state-handling drift.
4. Calling the workspace activity subset a complete transaction history: the source contract only
   supplies recent transactions with the portfolio review.
5. Browser-authored tax lots, accrued interest, issuer hierarchy, private-asset capital accounts,
   restrictions, suitability, recommendations, risk, performance, trade, order, execution, or
   settlement claims.

### Slice 1 — complete inventory and holding review

GitHub issue #416 governs the slice. `portfolio-booked-holdings-view-model.ts` now owns both the
security-id-deduplicated complete booked inventory and holding-specific recent-activity matching.
Allocation and Positions consume the same inventory rule. `PortfolioPositionsRecordWorkspace`
owns screen-level selection and composes the existing holdings grid with the reusable extracted
detail-drawer controller.

The standalone header now presents source-backed AUM, invested assets, and cash. The grid calls
the inventory **Positions**, counts positions, omits the filter when no
filter exists, and no longer exposes checkbox selection without a bulk workflow. `Show all
columns` replaces the ambiguous `Expand` action and disappears when every column is visible.

Keyboard or pointer activation opens holding overview and valuation detail plus only the recent
transactions whose source security or instrument identifier matches the holding. The activity tab
states its limited lineage and offers the complete Transactions ledger instead of implying that the
workspace subset is exhaustive.

PR review found that the prior detailed-data loader returned no detail object when either liquidity
or transactions was unavailable. The record screen could therefore retain empty shell arrays and
describe missing cash as a complete inventory or missing activity as no recent transactions. The
loader now preserves each independently successful detail slice and publishes explicit securities,
liquidity, and activity availability to the record composition. Positions labels an incomplete
portfolio as **Positions**, presents a business-facing partial state, retains source summary
totals, and uses an unavailable recent-activity state instead of a false empty result.

### Validation record

1. Focused API availability, booked-inventory, Allocation regression, record-screen,
   holdings-grid, drawer, and header coverage passed 61 tests after review fixes on 2026-07-17;
   lint and TypeScript validation also passed.
2. The Portfolio Playwright smoke pack passed all four tests against the populated canonical
   backend stack. Positions proof covered point-in-time KPIs, source cash visibility, identifier
   deduplication, removal of inert controls, keyboard drawer activation, recent-activity lineage,
   and the full-ledger link.
3. Full `make check` passed after review fixes on 2026-07-17: 286 test files and 1,237 tests passed with 90.82%
   statement coverage, followed by clean lint, TypeScript validation, and a successful production
   build.
4. The populated Portfolio Playwright smoke pack passed all four tests again after the review fix,
   proving the Portfolio Review, Income, Allocation, and Positions workflows against the same
   production build path.
5. PR #417 merged to `main` as `d6e33650` after all feature and protected merge-gate lanes passed.
   Codex's final review on `bf30a7e` found no major issues, the earlier availability thread was
   resolved with regression evidence, and issue #416 closed through the merge.
6. Post-merge Main Releasability run `29560225999` passed workflow lint, lint, typecheck, coverage,
   production build, Playwright smoke, Docker image validation, and Dockerized local-CI parity on
   merge SHA `d6e33650`. Codebase review item `LWB-R155` is hardened.

### Publication decision

No repo wiki change is required for this slice. It completes an existing supported Positions
screen using already published Portfolio and Transactions contracts; it does not change an
operator command, integration contract, supported-feature claim, or published runtime flow.

## Transactions Review

### Business job

A client advisor, portfolio manager, or operations reviewer opens Transactions Review to inspect
source-booked activity for a selected period, distinguish transaction-currency economics from
portfolio-currency accounting values, identify entries that need settlement attention, and trace
multi-row booking events across their source identifiers. The screen supports review and evidence
navigation; it does not book, amend, cancel, approve, execute, settle, or reconcile transactions.

The reading order is:

1. portfolio identity, mandate, portfolio currency, and source as-of date,
2. portfolio-wide latest booking date and initial 30-day ledger-entry count,
3. trade and settlement dates, activity type, instrument, quantity, and price,
4. gross amount in transaction currency, net cost and realized P&L in portfolio currency,
5. settlement status and booking-component context,
6. source lineage and related booking-group, FX-contract, or swap-leg activity,
7. previous or next source page when the result exceeds the initial 200 entries.

### Current-product research

Research was reviewed on 2026-07-17 from official product sources:

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth):
   connected advisor workflows depend on a common data foundation rather than disconnected local
   interpretations.
2. [BlackRock Aladdin Operations](https://www.blackrock.com/aladdin/benefits/operations):
   operations users benefit from shared high-quality data and exception-oriented review across the
   investment lifecycle.
3. [Morningstar Direct Advisory Suite integrations](https://www.morningstar.com/business/products/direct-advisory-suite/integrations):
   consistent, accurate connected data is foundational to an advisor workflow.

These sources inform workflow principles only. Lotus does not copy competitor layout, wording,
visual identity, calculations, or unsupported capabilities.

### Adopted decisions

1. Treat the screen as booked-activity review, not as an order ticket or browser-owned ledger.
2. Preserve Gateway monetary semantics explicitly: `gross_amount` remains paired with transaction
   `currency`, while `net_cost_base` and `realized_gain_loss_base` remain paired with portfolio
   base currency. Never add mixed-currency fallback values into one total.
3. Retain Gateway `total`, `skip`, and `limit` metadata, disclose visible ledger coverage, and
   provide source paging beyond the initial 200 entries.
4. Lead with portfolio currency, portfolio-wide latest booking, and an explicitly labeled 30-day
   entry count instead of unrelated AUM, positions, or an ambiguous window KPI. Keep current
   filtered coverage in the grid that owns the active query scope.
5. Count only visible non-settled entries as a review cue and avoid inventing settlement rules or
   severity outside source status.
6. Compose the existing dense portfolio grid, record shell, lazy detail-drawer controller, and
   drawer builder instead of creating page-specific table or overlay patterns.
7. Make row review explicit and connect supported related-event identifiers to server-backed
   linked-group, FX-contract, swap-event, near-leg, and far-leg filters.
8. Reset paging when portfolio, date, type, component, or related-event scope changes.
9. Export local gross, base net cost, and base realized P&L as separate auditable columns.

### Rejected decisions

1. `net_cost_base ?? gross_amount` under transaction currency: this can label a base-currency value
   with the wrong currency.
2. A summed transaction amount KPI: gross, net cost, buys, sells, income, fees, and multiple
   currencies are not one additive business measure.
3. Silently presenting only the first 200 records as the complete result.
4. A no-op `Book first transaction` action: transaction booking belongs to the owning booking
   workflow and is not supported by this screen.
5. An ambiguous `Expand` control, implementation-centric filter labels, or row interaction without
   an accessible, visible review outcome.
6. Browser-authored booking, amendment, cancellation, approval, execution, settlement,
   reconciliation, cost-basis, tax-lot, or exception-severity authority.

### Slice 1 — trustworthy booked activity and lineage review

GitHub issue #419 governs the slice. The detailed portfolio loader now retains Gateway ledger
metadata alongside its initial transaction page. Focused transaction row shaping keeps local and
portfolio-currency values separate, produces explicit export columns, counts visible settlement
attention, and formats complete or paged source coverage without monetary aggregation.

`PortfolioTransactionsRecordWorkspace` owns row selection and related-event scope. It composes the
existing transaction grid with the reusable detail-drawer controller, closes detail before applying
a new server-backed filter, and passes the initial page metadata through to the grid. The grid
resets paging on every scope change, requests `skip` explicitly, preserves returned page metadata,
and exposes previous and next entry controls when source totals require them.

The screen now uses `Booked activity`, `Activity type`, `Booking component`, `Transaction Currency`,
`Net Cost (<portfolio currency>)`, `Settlement Status`, and `Show all columns`. Empty copy directs
the reviewer to verify the period and source-book availability without advertising unsupported
booking. Transaction and position drawers also describe whether a displayed amount is local gross
or portfolio-currency net cost.

### Validation record

1. Focused transaction helper, grid, API, drawer, record-header, record-screen, and record-workspace
   coverage passed after implementation and browser-discovered refinements on 2026-07-17.
2. The populated canonical Portfolio Playwright proof passed against `PB_SG_GLOBAL_BAL_001`. It
   verified 29 entries after widening the period, `73,912.5 EUR` gross versus `80,097.93 USD` net
   cost, transaction-id search across hidden audit columns, visible review action, detail drawer,
   and a two-entry related booking-group drill-down.
3. Full `make check` passed on 2026-07-17: 287 test files and 1,241 tests passed at 90.8% statement
   coverage, followed by clean lint, TypeScript validation, and a successful production build.
4. Strict repository-wiki parity reported zero differences. The initial governed local bring-up
   attempt stopped on an already occupied Core Compose port; only its newly created failed
   containers were removed, and the screen proof used the existing healthy canonical Core/Gateway
   stack with the branch Workbench server.
5. Codex PR review identified that the stable header entry count could be mistaken for the grid's
   mutable filter scope. The header now says `30D Entries`; current coverage remains beside the
   active grid scope. Focused view-model tests, TypeScript, lint, and the populated canonical
   Transactions browser flow passed after the correction.
6. Fresh-head Codex review identified that the settlement cue described loaded-page results as
   visible after quick search. The cue now explicitly says `loaded`, preserving truthful scope
   without duplicating AG Grid's hidden-column search semantics. All 19 portfolio-grid tests,
   TypeScript, lint, and the populated canonical Transactions browser flow passed after the fix.
7. The next fresh-head review identified that an open record or related-event filter could survive
   a portfolio switch. The transaction workspace now follows the Allocation and Positions
   identity-key pattern so both review states are discarded before the new portfolio renders.
   Eight focused workspace/screen tests, TypeScript, lint, and the populated canonical
   Transactions browser flow passed after the correction.
8. PR #420 merged by rebase to `main` as `92478ab1`. Final Codex review on `e0ef19a` found no
   major issues, all feature and protected merge-gate jobs passed, and exact-main Main
   Releasability run `29566612562` passed workflow lint, lint, typecheck, coverage, production
   build, Playwright smoke, Docker build, and Dockerized local-CI parity. The canonical clone was
   synchronized to clean `main`; all eight feature-branch patches were proven equivalent to
   `origin/main` before the merged local branch was removed.

### Publication decision

No repo wiki change is required for this slice. It improves the composition and correctness of an
already supported Transactions screen without changing an operator command, Gateway integration
contract, supported-feature claim, or canonical runtime flow.

## Income and activity review

### Business job

A client adviser or portfolio manager opens Income and activity to understand income that
was booked in the selected reporting window, reconcile gross income to withholding and other
deductions, and distinguish subscriptions from withdrawals, fees, and taxes. The screen supports
book review and meeting preparation; it does not forecast income, project liquidity, provide tax
advice, or authorize cash movement.

The reading order is:

1. portfolio identity, mandate, reporting currency, and source as-of date,
2. requested-window net income and net cash movement,
3. gross income, withholding tax, other deductions, and net income by income type,
4. gross inflows, gross outflows, and net cash movement by canonical activity class,
5. current source cash weight as adjacent portfolio context,
6. the separate Cashflow workspace when projected cash-movement review is required.

### Current-product research

Research was reviewed on 2026-07-17 from official product sources:

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth):
   a connected whole-portfolio experience and common portfolio language help advisors move from
   data to action without disconnected interpretations.
2. [Morningstar ByAllAccounts](https://www.morningstar.com/business/products/byallaccounts):
   transaction-level detail and consolidated cashflow visibility are foundational to reliable
   portfolio cash review.
3. [Morningstar Direct Advisory Suite reports](https://www.morningstar.com/business/products/direct-advisory-suite/reports):
   complex investment information should be presented clearly, interactively, and in a form that
   supports advisor and client conversations.
4. [Addepar sample reports](https://addepar.com/sample-reports) and
   [Addepar investor solutions](https://addepar.com/investors): configurable multi-currency
   reporting should connect aggregate portfolio posture to granular supporting evidence.

These sources inform workflow principles only. Lotus does not copy competitor layout, wording,
visual identity, calculations, forecasts, or unsupported capabilities.

### Adopted decisions

1. Treat Income and activity as a booked-record review and keep forward-looking cash flow in the
   separate Cashflow workspace.
2. Reconcile gross income to withholding, other deductions, and net income rather than showing a
   single unexplained amount.
3. Interpret Gateway activity summary amounts as positive magnitudes and derive cash direction
   from the canonical bucket identity: `INFLOWS` add cash, while `OUTFLOWS`, `FEES`, and `TAXES`
   reduce cash.
4. Keep unknown activity buckets visible but unclassified and exclude them from classified net
   cash movement rather than guessing direction.
5. Separate gross inflows, gross outflows, and classified net movement; never gross-sum all
   activity magnitudes into a value labelled net cashflow.
6. Use one pure screen view model and reusable analytics modules, metric strips, tables, semantic
   badges, and module states instead of page-specific panels.
7. Show booking counts by source row without adding income and tax rows into one ambiguous event
   count.
8. Use business language and explicit reporting-currency/window context throughout.

### Rejected decisions

1. Sign-based direction inference: the Gateway contract returns magnitude values for canonical
   activity buckets, including fees, taxes, and outflows.
2. A generic `Ready` badge inferred from a non-zero event count: booking presence is not source
   readiness or client-report readiness.
3. Hiding gross income, withholding, or other deductions behind a net-only summary.
4. Combining current booked income with forecast distributions or projected liquidity.
5. Browser-authored tax advice, expected income, cash projections, next-best action, transfer,
   payment, order, execution, settlement, or reconciliation authority.
6. Page-specific panels and styling when the shared Workbench analytical patterns already express
   the screen hierarchy.

### Slice 1 — truthful booked income and cash movement

GitHub issue #425 governs the slice. `portfolio-income-activity-view-model.ts` now owns income
reconciliation and canonical cash-direction semantics. The record header reports net income, net
cash movement, and reporting currency without double-counting tax rows as events. The rebuilt
workspace composes shared analytical patterns for a gross-to-net income table and a signed
cash-movement table, carries unknown buckets as explicit unclassified evidence, and distinguishes
booked records from the forward-looking Cashflow workflow.

The slice also removed the unused one-off Income and Activity panels, their test-only exports,
dead chart helpers, and obsolete CSS. Populated visual review exposed a reusable metric-strip
nesting defect when metric cards were wrapped by tooltips; the shared component and its regression
coverage were corrected for every consumer. Cross-screen narrow-navigation and reporting-source
posture findings are tracked separately in #426 and #427.

### Slice 2 — owned certification, dense metric composition, and operating guide

GitHub issue #674 governs the certification tranche. A duplicate search confirmed that #425 owns
the completed business model, #492 the wider CSS-decomposition campaign, and #605 the complete
screen-guide programme; none owned deterministic populated Income proof. The first owned fixture
run exposed a real contract gap in the test boundary: the generic fixture returned only a reporting
currency, so server rendering failed when the required booked-income totals were absent. The new
scenario publishes a complete current Gateway shape for `PB_SG_GLOBAL_BAL_001` and asserts the
gross-to-net bridge, classified cash direction, unknown-bucket exclusion, exact rows, and absence of
raw source codes.

Populated visual review then found that page-local metric CSS declared columns without owning grid
display. Four summary cards therefore stacked into oversized blocks and pushed decision evidence
several screens below the fold. The correction reuses the default responsive
`WorkbenchSummaryMetricStrip`, producing four/four/three/two columns at 1440/1024/768/519 px. The
feature's booked-scope note, classification posture, table width, and directional amount treatment
now live in one colocated CSS Module. Ineffective duplicated metric breakpoints were removed, the
legacy global budget was lowered exactly, and the retired selector prefix cannot return.

Official BlackRock Aladdin Wealth/accounting, Avaloq investment-management, Temenos wealth,
SWIFT securities-flow, and Salesforce financial-history material was reviewed for #674. Lotus
adopts booked-history-first language, gross-to-net explanation, exact supporting rows, factual
classification exceptions, and compact chronological review. It rejects competitor copying,
decorative card mosaics, unsupported forecast or tax authority, direct source calls, and a new UI
framework. The result is evaluated through business usefulness and measurable evidence, not an
unsupported claim of competitor superiority.

The complete Income And Activity guide now explains purpose, roles, workflow position, source
authority, independent module states, recovery, adjacent handoffs, keyboard/table behavior, and
non-goals. Shared API and operations inventories remain linked rather than copied. The governed
screen registry moves from five to six mapped guides and from 31 to 30 exceptions.

### Validation record

1. Focused income/activity view-model, workspace, record-header, record-screen, chart-regression,
   and shared metric-strip coverage passed 23 tests; TypeScript, lint, and `git diff --check`
   passed before full-gate execution.
2. The full `make check` retry passed on 2026-07-17: 288 test files and 1,243 tests passed at
   90.79% statement coverage, followed by clean lint, TypeScript validation, and a successful
   production build. The first run's unrelated Intake timeout passed in isolation and on the full
   retry but remained within 329 ms of its five-second limit; testing-quality issue #428 preserves
   that gate fragility rather than hiding it behind a retry.
3. The populated Portfolio Playwright Income flow passed against `PB_SG_GLOBAL_BAL_001`, proving
   gross-to-net income and signed canonical cash movement, including `-25,356.75 USD` classified
   net movement. It passed both the targeted run and the broader 16-test smoke attempt.
4. Governed canonical validation passed Gateway, Portfolio, Performance, and Manage readiness but
   stopped at Report readiness with HTTP 502. Fresh evidence confirms the existing lotus-report
   #140 schema-migration defect. Diagnostic captures are therefore not demo-ready evidence.
5. The full Playwright pack did not certify as a whole: its initial server launch exceeded the
   120-second budget, and a prestarted retry exposed unrelated mobile-locator and Performance
   supportability failures. Issues #429, #430, and #431 preserve those harness gaps; the server was
   stopped explicitly after diagnosis.
6. Implementation PR #432 merged to `main` as
   `178f7c834c1b88aff4e0a241d1457f61430c7e8c`; exact-main Main Releasability run
   `29578068948` passed on that SHA.
7. Durable closure PR #439 merged to `main` as
   `7e49701bb5ed606c42eca4e4b9b454d7601a05b4`; exact-main Main Releasability run
   `29634061621` passed on that SHA. The two feature branches are absent locally and remotely, the
   repository has one Workbench worktree, and no stash carries Income truth.

### Publication decision

The original #425 slice required no wiki change. Issue #674 does: it closes the explicit #605
Income And Activity guide exception and changes durable CSS ownership and browser-proof truth. The
repo-local guide, registry, catalogue, Home, Sidebar, architecture guidance, repository context,
and review ledger therefore change together. Publish the authored wiki source only after merge and
verify strict source/publication parity before closure.

## Cashflow Review

### Business job

A client advisor or portfolio manager opens Cashflow Review to understand the expected inflows and
outflows already represented by booked and projected settlement events over a selected 10-, 30-,
or 90-day horizon. The screen supports near-term book review and meeting preparation; it does not
publish an opening or ending cash balance, judge liquidity sufficiency, recommend funding actions,
or create cash events.

The reading order is:

1. selected portfolio, mandate, current cash context, reporting currency, and source as-of date,
2. explicit projection horizon and returned projection period,
3. net projected movement, largest inflow, and largest outflow,
4. projection basis, source note, warnings, and partial-failure posture,
5. cumulative projected movement as a path of expected flows rather than a cash-balance forecast,
6. movement dates in the review table and every returned point in the export.

### Current-product research

Research was reviewed on 2026-07-18 from official product sources:

1. [Addepar Navigator](https://addepar.com/product-overview/navigator): cashflow planning benefits
   from explicit time horizons, portfolio context, and an auditable workflow from assumptions to
   review.
2. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth):
   advisors need connected whole-portfolio context and common language when moving from data to
   portfolio decisions.
3. [BlackRock Aladdin Studio](https://www.blackrock.com/aladdin/platforms/products/aladdin-studio):
   analytical workflows should preserve source context, governed inputs, and reproducible evidence
   instead of hiding lineage behind a visualization.
4. [Morningstar Direct portfolio management](https://www.morningstar.com/business/products/direct/portfolio-management):
   portfolio monitoring should connect summary evidence to underlying holdings and cashflow detail
   without conflating analysis with unsupported action.

These sources inform workflow principles only. Lotus does not copy competitor layout, wording,
visual identity, forecasts, calculations, scenario features, or unsupported capabilities.

### Adopted decisions

1. Use explicit 10-, 30-, and 90-day controls and bind every visible result, state, and export to
   the returned horizon.
2. Replace prior-horizon content with a loading or unavailable state while another horizon is
   requested; never relabel stale figures as current.
3. Preserve Gateway correlation, contract version, warnings, partial failures, source as-of date,
   through-date, currency, and projection basis.
4. Describe the contract as projected cash movement. Cumulative movement is the sum of expected
   flows and is not an opening, available, minimum, or ending cash balance.
5. Show summary-to-exception-to-detail: headline movements, source limitations, chart, then the
   movement schedule.
6. Keep zero-only source results explicit as no projected movement; do not fabricate a partial or
   unavailable liquidity posture.
7. Render movement dates in the review table while keeping every returned source point in the
   export and disclosing the difference.
8. Reuse the Workbench choice group, analytical module, module-state, dense table, and
   support-reference patterns instead of introducing Cashflow-only interaction conventions.

### Rejected decisions

1. Treating cumulative projected movement as an ending cash balance or liquidity forecast.
2. Showing a requested horizon label while another horizon's data remains visible.
3. Discarding warning, partial-failure, correlation, contract-version, or source-date evidence in
   the browser adapter.
4. Browser-authored liquidity sufficiency, funding capacity, shortfall, transfer, trade, or
   recommendation logic.
5. Unsupported scenario planning, capital-call or distribution classification, goal sufficiency,
   and client-authored future-event booking.
6. A cycle button with an implicit next period, duplicate screen/header KPIs, or an axis/table row
   for every zero point.

### Slice 1 — horizon-safe projected cash-movement review

GitHub issue #440 governs the slice. A focused projected-cashflow view model owns horizon options,
response snapshots, movement shaping, degradation evidence, source facts, result labels, and export
rows. A horizon-keyed hook owns requests and retries without allowing cross-horizon stale display.
The Portfolio API adapter now preserves the full Gateway response envelope instead of returning only
the outlook.

The screen uses the shared choice-group and analytical-module patterns, shows source scope and
limitations before the chart, removes the unsupported ending-balance tile, reduces zero-heavy chart
markers, and keeps movement-only table rows distinct from complete export coverage. Record header,
navigation, evidence, Income handoff, and supporting metric language now consistently describe
projected movement rather than liquidity sufficiency.

### Validation record

1. Focused API, view-model, hook-driven module, chart, panel, record-screen, evidence, and adjacent
   Income regression coverage passed 50 tests on 2026-07-18; TypeScript and lint also passed after
   the formatter-noise reconciliation.
2. Full `make check` passed on 2026-07-18: all 290 test files passed at 90.76% statement coverage,
   followed by clean lint, TypeScript validation, and a successful production Next.js build.
3. The targeted Cashflow Playwright smoke passed against the available upstream stack. It proved
   the explicit 10D/30D/90D horizon control, projection-scope evidence, removal of false ending
   balance and liquidity-forecast claims, and correct 30-day result identity after a horizon switch.
4. A governed canonical bring-up remains blocked before full platform certification by the existing
   lotus-core #805 seed-cleanup defect; lotus-core PR #806 owns the fix and is in protected checks.
   The targeted browser result is screen-level implementation proof, not a demo-ready platform
   certification or screenshot claim.
5. Protected Workbench GitHub checks, merge, exact-main releasability, and branch cleanup remain
   pending before the slice can be marked hardened.

### Slice 2 — component-owned Cashflow presentation

Research was revalidated on 2026-08-10 against the official Next.js CSS Modules and module-graph
guidance plus W3C SVG accessibility support. The existing #440 workflow decisions remain the
business authority: the extraction does not redesign the source-backed Cashflow task.

Adopted:

1. colocate Cashflow-only summary, chart-mark, projection-scope, source-note, exact-schedule, and
   responsive rules with the two React owners that emit them;
2. retain the named SVG plus exact table/export alternative;
3. keep genuinely shared Portfolio chart geometry and `AnalyticsTable` behavior under their
   existing owners;
4. remove the late app-shell repair, lower the exact global budget, and prevent the retired prefix
   from returning.

Rejected:

1. bulk-moving adjacent shared selectors without a complete consumer/modifier matrix;
2. introducing a new styling dependency or partial cascade-layer migration;
3. changing data hierarchy, chart meaning, or source-contract claims during an ownership refactor;
4. replacing exact table/export evidence with an SVG-only presentation.

Issue #492 owns this tranche. The result changes CSS ownership and assistive terminology from
`cashflow` to the existing business phrase `cash movement`; it does not change Gateway requests,
calculation meaning, visible capability, or operator procedure.

Validation proves the canonical `PB_SG_GLOBAL_BAL_001` Cashflow workflow through the Workbench BFF
against an exact process-owned fixture. The production-browser scenario passes at 1440, 1024, 768,
and 519 px with keyboard horizon selection, returned-horizon identity, exact schedule evidence,
accessible chart and movement summaries, and no page-level horizontal overflow. Desktop and mobile
captures are retained locally under `output/playwright/issue-492-cashflow/`. The complete repository
gate passes 339 files and 1,933 tests at 91.43% statement/line coverage plus the optimized 25-route
production build and portfolio-record bundle budgets.

### Publication decision

No repo wiki change is required for this slice. It changes presentation ownership, recurrence
governance, assistive terminology, and isolated test proof for an existing supported Cashflow screen
without changing a Gateway route, supported-feature claim, operator command, or canonical runtime
flow. The repository engineering context records the reusable component-ownership boundary.

## Responsive Portfolio Review Navigation

### Business job

An advisor working in a split-screen laptop or tablet layout needs the selected portfolio and
current review destination to remain obvious while the chosen workspace starts immediately. The
complete route catalogue remains important, but it should not precede and displace the task unless
the advisor explicitly opens it.

### Interaction research

Research was reviewed on 2026-07-19 from primary design and accessibility sources:

1. [W3C ARIA APG disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
   requires a button that communicates expanded state and supports native Enter/Space activation.
2. [W3C disclosure navigation example](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/)
   keeps ordinary route navigation as semantic links rather than an ARIA menu and documents Escape
   closure with focus restoration as a useful navigation behavior.
3. [Carbon UI shell left-panel guidance](https://carbondesignsystem.com/components/UI-shell-left-panel/usage/)
   treats persistent secondary navigation as a shared product-shell pattern and collapses it when
   the shell becomes narrow.

### Adopted decisions

1. Preserve the dense, persistent Portfolio review rail on desktop.
2. At the existing stacked-shell breakpoint, keep selected portfolio and current business view in
   a compact disclosure before the workspace.
3. Keep one navigation source and semantic links; do not add `menu` / `menuitem` roles.
4. Preserve the active Manage or Performance submode in the compact current-view description.
5. Close on route selection and Escape; restore focus to the disclosure after Escape.
6. Keep the selected workspace heading inside the initial narrow viewport while the disclosure is
   closed.

### Validation record

1. Four focused component tests cover current-view context, `aria-expanded` / `aria-controls`,
   selection closure, Escape focus restoration, and nested mode action behavior.
2. Full `make check` passed 294 test files and 1,311 tests at 90.77% statement coverage, followed by
   clean lint, TypeScript validation, and production build.
3. Production Playwright proof passed at 519 px, 1024 px, and 1366 px. At 519 px, the closed rail
   kept Income and activity inside the initial 900 px viewport; the route list was hidden until
   requested; Escape restored focus; desktop restored the persistent list.
4. Playwright CLI visual review confirmed a compact selected-view panel and an intentional dense
   on-demand route list. Screenshots remain diagnostic local evidence, not canonical demo proof.

### Publication decision

No wiki source change is required. This is responsive behavior and accessibility hardening of the
existing shared navigation, without a new route, capability, integration, or operator command.

## Task-Aware Private Banking Navigation

### Business job

A client advisor needs to move from the whole book to one selected portfolio, complete the current
review task, and reach specialist evidence without scanning the product's complete route inventory
on every screen. Navigation must preserve portfolio and review-date context, distinguish global
workspace switching from local portfolio work, and keep source-disabled capabilities
non-actionable.

### Current-product research

Research was revalidated on 2026-08-15 from official product and design-system sources:

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   emphasizes a connected whole-portfolio experience, exception-based review, and workflow
   continuity. Those principles support stable portfolio context and a short daily-work path rather
   than equal visual priority for every feature.
2. [SAP Fiori launchpad shell bar](https://experience.sap.com/fiori-design-web/launchpad-shell-bar/)
   separates persistent shell orientation from application content and treats product switching as
   a deliberate shell action.
3. [SAP Fiori side navigation](https://experience.sap.com/fiori-design-web/side-navigation/)
   uses hierarchical, collapsible navigation to keep frequent destinations prominent while
   retaining access to deeper application areas.
4. [W3C disclosure navigation](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/)
   retains semantic links, communicates expanded state, and supports Escape closure with focus
   restoration.

These sources inform information architecture and interaction quality only. Lotus does not copy a
competitor's visual identity, wording, entitlement model, calculations, or unsupported features.

### Adopted decisions

1. Keep the top shell quiet: Lotus identity, **My book**, and one capability-backed workspace
   switcher. Do not repeat the portfolio rail as a row of global pills.
2. Keep five daily business domains visible in the selected-portfolio rail: Portfolio review,
   Performance, Advice, Reporting, and Mandate management.
3. Place an active specialist destination once under **Current task**; group the remaining
   specialist destinations by business purpose under **All workspaces**.
4. Show only the current workflow step by default and disclose alternative steps on demand.
5. Preserve the active review date when returning to **My book** and preserve the selected
   portfolio in every local destination.
6. Keep capability-disabled global workspaces visible but non-actionable; availability remains a
   Gateway shell-bootstrap decision, not a browser inference.
7. Use ordinary links plus disclosure buttons. Escape closes nested disclosures and restores focus
   to the initiating control.
8. Reflow the same information architecture at desktop, tablet, and compact widths rather than
   inventing a separate mobile product.

### Rejected decisions

1. A permanently visible flat catalogue of every application and every portfolio screen.
2. Duplicate active destinations in daily work, specialist navigation, and workflow navigation.
3. Browser-authored role, entitlement, notification, search, or workspace-availability state.
4. A page-local select, hamburger implementation, or one-off navigation component for each screen.
5. Decorative gold, oversized cards, or animation without a location, decision, or recovery
   purpose.

### Implementation and validation record

Issue #705 introduces one pure navigation model, one shared portfolio-rail renderer, one shared
workspace-switcher primitive, and review-date-preserving **My book** navigation. Focused component
and model tests protect grouping, active-state de-duplication, disabled capability posture, and
focus restoration. Optimized browser journeys cover Advisory Overview, Performance Summary, and
Report Centre at 1440, 1024, and 519 pixels, including default destination counts, disclosure
behavior, active workflow context, keyboard recovery, and horizontal-overflow checks.

The same visual review identified two independent defects that this navigation slice does not hide:
Performance Drivers desktop overlap is owned by #706, and compact Report Centre lifecycle-table
discoverability is owned by #707. No Lotus-wide skill change is justified: the existing frontend,
issue-discovery, wiki, and review-ledger skills already required the research, source truth,
responsive browser inspection, issue capture, and durable documentation used here.

Follow-up review under #710/#711 applied the same research principles to capability truth. The
workflow disclosure now exists only when at least one alternative has a supported destination or
action, and its **available** count excludes disabled or actionless entries. Disabled alternatives
remain visible only inside a directory that has a real action, preserving capability orientation
without inventing choice. The global menu now uses the neutral **Workspace directory** label for a
mixed enabled/unavailable catalogue, and its component-owned hover selector excludes unavailable
entries. This adopts predictable disclosure and unequivocal action state; it rejects a cosmetic
count, hover-only implication, page-local exception, or browser-authored capability inference.
Focused component tests cover mixed and all-unavailable workflow states. Optimized production
browser proof covers a capability-restricted Performance rail and the Gateway-fallback global
directory at desktop and compact widths, including exact enabled counts, disabled semantics,
computed hover separation, Escape focus restoration, and absence of page overflow.

## Report Ordering

### Business job

A client advisor or portfolio manager needs to prepare an approved portfolio review without
leaving the selected portfolio, understand which output is genuinely available, verify the
business date and contents, submit once, and know whether report data is queued, preparing,
complete, or failed. The advisor must not have to understand report-worker, service, endpoint,
archive, or render implementation details.

### Current-product research

The slice used current official wealth-platform references as workflow evidence, not as a visual
template:

1. [Morningstar Advisor Workstation's portfolio-report workflow](https://advisor.morningstar.com/enterprise/ADV_AWE_QSGwithplanning.pdf)
   starts from a selected client and portfolio before choosing a portfolio report. This supports
   portfolio context as the primary ordering scope.
2. [Morningstar Report Portal](https://www.morningstar.com/business/products/direct/report-portal)
   emphasizes firm-approved templates, business-purpose configuration, benchmark selection,
   compliance-aware control, on-demand access, and usage tracking. This supports a governed
   catalogue and request history rather than a free-form document builder.
3. [Temenos Wealth Front Office](https://www.temenos.com/products/wealth-management/wealth-front-office/)
   frames advisor efficiency around clear interactive dashboards, prioritized actions, and
   portfolio workflows. This supports a dense setup-plus-readiness layout instead of a long
   technical operations panel.
4. [Morningstar's aggregate-report workflow](https://advisor.morningstar.com/enterprise/onboarding/AdvisorWorkstationOnboarding4.pdf)
   shows the value of household and multi-portfolio reporting. Lotus should add book, client, and
   multi-portfolio ordering only when Gateway provides governed eligibility and submission
   contracts; the first slice remains truthfully portfolio-scoped.

### Adopted decisions

1. Mount a dedicated `Reports` destination in the portfolio rail so reporting remains within the
   advisor's selected-portfolio workflow.
2. Treat the Gateway catalogue as the authority for report families, sections, ordering modes,
   audience, release posture, and per-format readiness.
3. Use a dense two-column layout: configuration and request history in the main work area, with a
   sticky review/readiness rail for the decision and lifecycle boundary.
4. Require an explicit review before submission and preserve one idempotency intent across safe
   retry after a failed attempt.
5. Keep structured-data and governed-document readiness independent. Show unavailable PDF output
   with business-facing explanation instead of hiding it or offering a false action.
6. Label completed work as `Report data complete`; archive and client delivery remain visibly
   separate states.
7. Present evidence created by advisory or portfolio-management workflows as workflow-generated,
   not as directly orderable report families.
8. Keep source identifiers inside support disclosures and keep metrics free of portfolio, client,
   report-job, and idempotency identifiers.
9. Preserve a single-column tablet/mobile fallback, keyboard focus, and reduced-motion behavior.

### Rejected decisions

1. Do not expose report-batch materialization, report-worker run-once, capacity, runtime-load, or
   archive-lookup controls to advisors.
2. Do not call `lotus-report`, `lotus-render`, or `lotus-archive` directly.
3. Do not imply that report-data completion means PDF creation, archive, approval, client delivery,
   or client communication.
4. Do not make technical reason codes, service names, endpoint paths, batch ids, or job ids the
   primary language of the screen.
5. Do not add book, client, household, multi-portfolio, scheduled, or bulk ordering controls until
   Gateway publishes supported eligibility and submission behavior for those scopes.
6. Do not construct or store client-ready material in the browser.

### Slice 1 — governed portfolio report request

Issues #449 and #458 add the `/reports` route, reusable report-ordering module, strict source
contracts, Gateway-only client, BFF-owned development authority, business configuration model,
reviewed idempotent submission, recent request history, lifecycle boundary, responsive layout,
and intentional loading, permission, error, empty, blocked, partial, ready, submitting, accepted,
and retry states. The slice also retires the unreachable technical batch panel and obsolete public
browser worker API.

### Validation record

1. Focused contract, BFF, view-model, hook, component, route, API, observability, compatibility,
   and canonical-harness tests pass.
2. Full `make check` passed on 2026-07-18: 293 test files and 1,307 tests passed at 90.76%
   statement coverage, followed by clean lint, TypeScript validation, and production build.
3. Live Gateway catalogue preflight for `PB_SG_GLOBAL_BAL_001` returned eligible portfolio scope,
   the single-portfolio ordering mode, and ready structured-data output while truthfully retaining
   unavailable governed PDF output.
4. The first complete live submission exposed issue #459: Workbench placed unpublished
   `source_surface` provenance in business `options`, and Report correctly rejected it with
   `unsupported_report_configuration`. After removing that key, the same governed request returned
   `202 data_ready`; bounded recent-request history returned `200` and included the accepted job.
5. Canonical portfolio seeding subsequently reached Core analytics, Report, and Gateway return-path
   currentness through `2026-04-10`. Full platform validation then stopped when the governed DPM
   seed hit the existing platform #553 Manage refresh `403`. Platform #582 separately owns central
   Report Centre panel registration. No demo-ready screenshot claim is made until both dependencies
   are resolved and canonical validation passes.

### Publication decision

Repo wiki source changes are required because the supported reporting route, integration boundary,
and unsupported operator controls changed. Publish `wiki/` only after the implementation reaches
`main`, then run strict parity verification.

### Slice 2 — consistent Report Centre readiness

Issue #482 hardens the existing Report Centre so its setup workspace and readiness rail express one
business state. The slice does not add a report family, ordering scope, delivery channel, or source
contract.

#### Interaction research

Research was reviewed on 2026-07-19 against the implemented Gateway catalogue and ordering flow:

1. [Carbon loading guidance](https://carbondesignsystem.com/components/loading/usage/) says loading
   feedback should explain the activity in progress and should not remain after the activity ends.
   The Report Centre therefore derives both visible regions from the same catalogue state.
2. [Carbon status-indicator guidance](https://carbondesignsystem.com/patterns/status-indicator-pattern/)
   recommends consistent, concise labels and restrained semantic color. The readiness rail now uses
   business statuses such as `Restricted`, `Unavailable`, `Accepted`, and `Not accepted` instead of
   interpreting component-local booleans.
3. [Carbon empty-state guidance](https://carbondesignsystem.com/patterns/empty-states-pattern/)
   separates unavailable resources from first-use or no-result states and recommends a useful next
   action only when one exists. Source failures and access restrictions retain a real catalogue
   retry; a genuinely empty approved catalogue does not expose a dead-end ordering action.
4. [SAP Report Center tools](https://help.sap.com/docs/successfactors-platform/report-center/report-center-tools)
   and [report scheduling guidance](https://help.sap.com/docs/SAP_SUCCESSFACTORS_PLATFORM/6ca0eee0540248b2b3ba91eaa1f18423/a1e6de81a25e40f183c35e0f5aaa034c.html)
   distinguish report creation, execution, scheduling, and distribution as separate workflow
   capabilities. Lotus therefore keeps request acceptance separate from archive and client release,
   and does not imply unsupported scheduling or distribution.
5. [WCAG status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
   requires important changes to be programmatically determinable without moving focus. Readiness
   changes use a polite status region, submission rejection uses an alert, and the region excludes
   interactive controls to avoid verbose or repeated announcements.

#### Adopted decisions

1. Build one pure, typed screen-state projection from catalogue, configuration, review, and
   submission truth, and make both the workspace and readiness rail consume it.
2. Make loading, permission restriction, source failure, and an empty approved catalogue terminal
   across both regions; hide request summaries and review or submit actions in those states.
3. Retain a real source retry for catalogue failure or restriction and prove that it issues another
   catalogue request.
4. Preserve workflow-managed report evidence even when no directly orderable report family exists;
   only show the empty state when neither kind is available.
5. Keep a reviewed configuration after submission rejection and offer an explicit
   `Retry Report Request` action; disable review and submit actions while submission is active.
6. Treat request acceptance as the end state for the current reviewed intent while continuing to
   state that report data, archive, client delivery, and communication are separate. A future
   request must begin through an explicit advisor action and a newly reviewed idempotency intent.

#### Rejected decisions

1. Do not present a progress stepper that implies archive, document creation, approval, or client
   delivery stages unsupported by the current contract.
2. Do not use generic labels such as `Review` when the source truth is restricted, unavailable,
   empty, submitting, or accepted.
3. Do not remove the dense readiness rail; it remains the decision summary and client-use boundary
   for a valid configuration.
4. Do not add recipients, email, download, scheduling, bulk ordering, or client-delivery controls
   without Gateway-backed eligibility and commands.
5. Do not display raw source reason codes or technical service states as the primary status.

#### Validation and publication decision

1. Thirty-six focused projection, workspace, workflow, and view-model tests pass, including
   loading, permission, failure and real retry, empty, workflow-managed-only, reviewed, submitting,
   accepted, and not-accepted behavior.
2. Lint and TypeScript validation pass. Full repository, responsive production-browser, protected
   CI, and exact-main evidence remain required before issue closure.
3. No wiki source change is required: this slice corrects state consistency and accessibility for
   the already documented portfolio-scoped reporting capability without changing routes,
   integrations, supported report families, operator commands, or lifecycle boundaries. Repository
   context and review-ledger evidence carry the reusable implementation rule.
4. No Lotus skill change is required. Existing frontend governance already requires aggregate and
   detail state integrity, honest recovery, accessibility, and source-backed controls; the
   deterministic prevention belongs in the repository projection, tests, and local context.

### Slice 3 — bank-buyable portfolio context and Report Centre composition

Issue #490 treats the shared portfolio rail and Report Centre composition as one advisor-workflow
problem. The objective is a quiet, high-trust workstation: ink-navy navigation, restrained warm-gold
selection and action emphasis, a white analytical canvas, compact typography, and dividers before
nested cards. The slice changes presentation and responsive composition only; portfolio identity,
own-book membership, report eligibility, lifecycle state, and client-use boundaries remain
source-backed.

#### Interaction and market research

Research was reviewed on 2026-07-19 against the shared shell and populated Report Centre states:

1. [Carbon global-header guidance](https://carbondesignsystem.com/patterns/global-header/) treats
   global and local navigation as stable shell responsibilities and collapses them deliberately at
   constrained widths. Lotus therefore keeps one semantic route source and one compact disclosure
   instead of rendering a second mobile navigation model.
2. [Carbon 2x grid guidance](https://carbondesignsystem.com/elements/2x-grid/usage/) uses a consistent
   spacing rhythm and explicit breakpoints to preserve hierarchy. Lotus sets measurable rail-height
   and overflow budgets at 768 and 519 px rather than relying on subjective screenshots alone.
3. [Temenos Wealth Front Office](https://www.temenos.com/products/wealth-management/wealth-front-office/)
   positions wealth work around a unified front-office view and advisor workflow. Lotus keeps
   portfolio context, workflow identity, current view, request readiness, and client-use boundary
   together while separating them from unsupported report delivery or operational controls.
4. [WCAG contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
   requires at least 4.5:1 for normal text. The production-browser proof computes the inactive rail
   label contrast against the rendered rail instead of assuming token intent equals rendered output.

#### Adopted decisions

1. Make the application shell—not `.portfolio-page`—the authoritative dark-rail theme scope so every
   consumer receives the same readable foreground, active state, hover, and focus treatment.
2. Keep portfolio switching, own-book navigation, workflow identifier, and current view together in
   one responsive header; use concise visible labels at constrained widths while retaining complete
   accessible names.
3. Remove generic panel inset from the rail because the shared component already owns header and
   navigation spacing. Do not pay two padding budgets for one hierarchy.
4. Consolidate Report Centre readiness and the client-use boundary into one decision panel, and use
   dividers for lifecycle controls rather than four miniature cards.
5. Give terminal Report Centre states a deliberate analytical-canvas treatment with a restrained
   state accent instead of leaving a visually empty main column.
6. Prove desktop recovery, compact empty, tablet restricted, and mobile ready states through the
   optimized production build, including keyboard disclosure closure, focus restoration, horizontal
   overflow, strict compact-height budgets, and computed contrast.

#### Rejected decisions

1. Do not add gradients, glass effects, oversized marketing typography, decorative dashboards, or
   novelty interaction patterns to a daily private-banking workstation.
2. Do not hide portfolio identity, own-book access, readiness, or client-use boundaries merely to
   meet a compact-height target.
3. Do not weaken viewport assertions when a screenshot exposes collision, duplicate inset, or
   hierarchy failure.
4. Do not paste generated Stitch, Figma, or other design-tool code into the product. External tools
   may inform composition; repository components, source contracts, tests, and accessibility remain
   authoritative.
5. Do not bulk-split the global stylesheet in this visual slice. Issue #492 owns incremental CSS
   architecture with representative visual-regression proof.

#### Validation record

1. The optimized production build passed the four-state browser matrix at 1440, 1024, 768, and
   519 px. Recovery, empty, restricted, and ready states remained coherent and action-safe.
2. The browser gate proves at least 4.5:1 rendered contrast for inactive rail text and the portfolio
   switch action, no document-level horizontal overflow, a fully stacked 1024 px shell, a rail below
   100 px at 1024/768, and a mobile rail below 150 px.
3. The mobile disclosure opens by keyboard, closes on Escape, returns focus, and leaves the
   portfolio-context control within its allocated width.
4. Visual review rejected intermediate captures despite partial test success: the 1024 px shell kept
   desktop width caps after stacking, the desktop switcher looked disabled, and the first 519 px
   arrangement collided. The final captures correct those failures rather than weakening budgets.
5. Focused shared-rail, Performance integration, Report Centre state/workflow, addressing, and
   harness proof passed 108 tests; lint, TypeScript, and the 25-route production build passed.

#### Publication decision

No wiki source change is required. This slice corrects shared visual hierarchy, responsive behavior,
and accessibility for already documented routes and capabilities; it changes no supported feature,
integration, source contract, operator command, or runbook. Repository context and both review
ledgers carry the reusable design and implementation rule.

### Slice 4 — outcome-first accepted requests and deliberate repeat ordering

Issue #571 corrects a business-workflow dead end in the portfolio Report Centre. Acceptance was
rendered twice while the full editable configuration remained dominant, and the accepted handle was
retained for the portfolio with no supported way to begin a second request in the same advisor
session. The new composition treats the accepted request as the primary outcome, keeps recent
request history in view, and requires an explicit `Create another report` action before returning to
configuration and creating a new reviewed idempotency intent.

#### Interaction and market research

Research was reviewed on 2026-08-09 against the accepted and repeat-request workflow:

1. [Morningstar Office reporting guidance](https://admainnew.morningstar.com/webhelp/Morningstar/Advisor_Workstation_Office_Edition_Overview.htm)
   places client and portfolio reporting inside the advisor workstation rather than treating each
   request as an isolated technical job. Lotus therefore preserves portfolio context and recent
   request history when one request is accepted.
2. [Morningstar Advisor Workstation onboarding](https://advisor.morningstar.com/enterprise/onboarding/AdvisorWorkstationOnboarding4.pdf)
   describes selecting a client or portfolio, configuring report content, and generating reports as
   a repeatable advisor activity. Lotus ends one reviewed intent without terminally locking future
   requests for the selected portfolio.
3. [Addepar reporting guidance](https://addepar.com/blog/enhanced-reporting-transforms-operations)
   emphasizes repeatable reporting workflows and traceable output. Lotus exposes the accepted
   support reference and portfolio request history while keeping archive and delivery outside the
   ordering claim.
4. [Carbon data-table guidance](https://carbondesignsystem.com/components/data-table/usage/) and
   [Carbon progressive-disclosure guidance](https://preview.carbondesignsystem.com/building-blocks/core/patterns/forms)
   support scan-efficient tables and revealing optional form detail only when it is useful. Optional
   report contents move behind a native disclosure while required content remains truthful.
5. [WCAG 2.2 status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
   and [focus-order guidance](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) require
   programmatic outcome communication and logical focus movement. Lotus publishes one polite
   accepted status and restores focus to configuration only after the advisor starts another request.

#### Adopted decisions

1. Render one authoritative accepted confirmation in the readiness rail and remove duplicate
   success chrome from the main workspace.
2. Replace the editable configuration with recent request history after acceptance so the dominant
   task becomes tracking the outcome, not accidentally changing an already accepted intent.
3. Provide one explicit `Create another report` action. Preserve the valid portfolio configuration,
   clear only the current portfolio's accepted handle and review posture, and require a new review
   before submission.
4. Generate a fresh idempotency key only after the advisor deliberately starts, reviews, and submits
   the next request. Do not rotate intent during render or on acceptance.
5. Summarize selected report contents at scan level and use a keyboard-native disclosure for optional
   section tailoring. Automatically expose the detail when setup is blocked.
6. Keep support correlation available through a quiet disclosure and retain the existing request,
   report-data, archive, and client-delivery boundary.

#### Rejected decisions

1. Do not reset automatically after acceptance; that would obscure the source-owned result and make
   duplicate submission easier.
2. Do not leave the portfolio in a permanent accepted terminal state; advisors legitimately prepare
   more than one governed report over time.
3. Do not add a wizard, toast, second success card, scheduling, recipients, download, archive,
   communication, or client-delivery controls unsupported by current contracts.
4. Do not fabricate accepted posture when the strict Gateway handle is incomplete. The production
   fixture must carry the required request, job, status, status URL, and idempotency evidence.
5. Do not weaken assertions to accommodate stale wording. Browser proof anchors to the stable
   accepted heading, one status region, refreshed tracking posture, focus restoration, and distinct
   source-owned support references.

#### Validation and publication decision

The focused screen-state, workflow, and rendered workspace suites pass 37/37 tests, including
last-request-wins history refresh sequencing and protection against delayed focus restoration. The owned
optimized-production Report Centre matrix passes 16/16 browser journeys, including two sequential
accepted requests at a 720 px constrained/zoom-equivalent viewport, distinct support references,
review reset, focus restoration, and no horizontal overflow. The wiki supported-feature record is
updated because same-session sequential report requests are newly supported; no Gateway, Report,
OpenAPI, runtime runbook, or platform skill change is required.

### Slice 5 — source-backed portfolio bundle workflow

Issue #662 extends Report Centre from repeated single-portfolio setup to one reviewed setup across
an explicit selection from the advisor's current book. The business objective is reduced periodic-
review preparation time with stronger exception visibility, not bulk processing theatre or a
consolidated relationship report.

#### Interaction and market research

Research was reviewed on 2026-08-12 against the merged Gateway batch contract and current Advisor
Book boundary:

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   connects whole-portfolio context, book insight, and scalable advisor workflows. Lotus adopts the
   book-to-selection workflow principle while keeping source membership and each portfolio outcome
   explicit.
2. [BlackRock's manage-business-at-scale guidance](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/manage-business-at-scale)
   describes systematic assessment across an advisor book. Lotus uses one governed setup and a
   compact outcome summary to reduce repetitive work without creating browser-owned rankings or
   eligibility.
3. [Morningstar Advisor Workstation's portfolio report builder](https://advisor.morningstar.com/enterprise/commonscenariossolutionsguide.pdf)
   distinguishes multiple portfolio selection from the separate choice to aggregate or group
   holdings. Lotus therefore labels this capability **Portfolio bundle** and states that it creates
   a separate report for every portfolio.
4. [Morningstar Advisor Workstation](https://www.morningstar.com/en-gb/products/advisor-workstation)
   places client reporting and aggregated account context inside the advisor workflow. Lotus keeps
   Reporting adjacent to My Book and portfolio context, but does not claim household aggregation
   where no governing source contract exists.

These sources inform workflow principles only. Lotus does not copy competitor layout, wording,
visual identity, calculations, or unsupported claims, and does not claim superiority without
measured comparative evidence.

#### Adopted decisions

1. Offer the bundle only when the exact Gateway/Report capability and route are published.
2. Reuse the source-backed Advisor Book rather than accepting free-text portfolio identifiers or a
   global catalogue.
3. Keep selection bounded to the first 100 source-ordered memberships, searchable, keyboard-native,
   and explicit about inactive and degraded memberships.
4. Require two portfolios and include the sorted selection in the reviewed intent so any material
   context change invalidates stale confirmation.
5. Let Gateway re-resolve trusted caller, membership, and reporting eligibility at submission;
   Workbench's development entitlement precheck is never final authority.
6. Summarize portfolio-report count, complete, in-progress, and attention posture, then retain every
   separate portfolio lifecycle, attempt count, failure summary, and support reference.
7. Keep one source-owned refresh loop after acceptance and preserve explicit failure or partial
   completion instead of presenting the batch as universally complete.
8. Reuse the shared ActionButton contract and prove disabled review/submit posture in the rendered
   production build.

#### Rejected decisions

1. No client, household, relationship, or book aggregation is implied by a portfolio bundle.
2. No browser-authored membership, provenance, eligibility, worker capacity, retry policy, archive
   publication, document download, distribution, or communication control is introduced.
3. No local per-portfolio reporting preflight is invented. Until Gateway publishes source-owned
   candidate preflight, Workbench can prove current book membership before review and final
   eligibility only through the accepted/rejected batch response and refreshed item outcomes.
4. No archived-document action is fabricated. Opening an archived output remains outside this slice
   until Gateway exposes a governed, entitled document boundary.
5. No decorative card mosaic, oversized hero, wizard, or novelty interaction replaces the dense
   setup, decision rail, and outcome table.

#### Validation and remaining evidence

The production Report Centre build passes the 17-journey browser matrix at desktop, tablet,
responsive boundary, and mobile widths. The bundle journey selects two source-returned portfolios,
requires review, proves the disabled-to-enabled submit treatment, submits one idempotent Gateway
batch, renders mixed source-owned outcomes, exposes an accessible completion measure, and remains
free of horizontal overflow. Focused contract, API, hook, view-model, integration, BFF, TypeScript,
ESLint, and CSS-governance checks pass. Diagnostic screenshots remain local evidence, not canonical
demo proof.

Issue #662 remains broader than this implemented slice: source-owned per-candidate preflight,
governed archived-document opening, and canonical multi-membership runtime proof require explicit
Gateway/Report and seed support. Those boundaries must remain visible and issue-backed rather than
being simulated in Workbench.

## Portfolio Reporting Source Posture

### Business job

A client advisor or operations user reviewing Portfolio records needs to know whether the current
book can support reporting and whether an actual reporting snapshot exists. Source preparation and
generated client-reporting output are related, but they are not the same business fact.

### Source-contract research

Research was reviewed on 2026-07-19 against the authoritative Gateway contract and implementation:

1. `PortfolioReportingReadiness.status` is explicitly a reporting-readiness posture.
2. Gateway's `build_reporting_readiness` prefers the upstream source-readiness bucket and otherwise
   derives `READY` from non-empty position coverage or `EMPTY` from no positions.
3. Gateway currently supplies workspace position coverage as `row_count`.
4. `generated_at_utc` is optional and explicitly describes the most recent reporting-output
   generation. The current readiness builder does not synthesize it.

The populated `READY`, 11 rows, and no generation timestamp combination therefore means the
reportable book is ready while the reporting snapshot has not been generated. Gateway is not
claiming that a document or snapshot exists; the prior Workbench presentation collapsed those
facts.

### Adopted decisions

1. Derive the reporting source label, explanation, badge, and tone from one typed posture.
2. Reserve `Generated` and the success tone for a ready/complete source with a real generation
   timestamp and non-empty output coverage.
3. Present ready source data without a timestamp as `Reportable book ready` and `Not generated`.
4. Preserve a last-generation date for pending, stale, failed, or unavailable current posture
   without calling the retained output current.
5. Fail unknown source statuses closed as unavailable business posture rather than displaying a
   raw technical value.
6. Apply the same pure builder to Allocation, Positions, Transactions, Income and activity, and
   Cashflow evidence rails.

### Rejected decisions

1. Do not rename Gateway `READY`; it is valid source-readiness truth.
2. Do not treat non-zero `row_count` as proof that reporting output was generated.
3. Do not place a generated/ready snapshot badge beside a missing generation timestamp.
4. Do not invent stale-age thresholds because this contract publishes no governed freshness policy.
5. Do not add a one-off correction to Income and activity; the evidence rail is a shared Portfolio
   pattern.

### Validation record

1. A focused matrix covers generated, source-ready, partial, pending with retained generation,
   empty, stale, failed, unavailable, and unknown fail-closed states.
2. A cross-screen regression proves the same source-ready posture on all five Portfolio record
   screens, and a rendered component regression proves that raw `READY` no longer appears on the
   Reporting Snapshot item.
3. Eighteen focused tests passed; full `make check` then passed 294 files and 1,323 tests at 90.83%
   statement coverage, followed by clean lint, TypeScript validation, and production build.
4. Production browser proof at 1440 x 1000 against a bounded diagnostic Gateway fixture rendered
   `Reportable book ready`, `11 reportable rows available; a reporting snapshot has not been
   generated`, and `Not generated`. The local artifact is
   `output/playwright/diagnostic-reporting-posture-427.png`.
5. The browser artifact is diagnostic, not demo-ready. Populated canonical certification remains
   blocked by the existing platform #553 Manage seed-authority defect.

### Publication decision

No wiki source change is required. This slice corrects the interpretation of an existing Portfolio
evidence field without adding a route, integration, supported capability, or operator command. The
repository context and review ledger carry the reusable source-versus-output rule.

## Advisor Cockpit Business Readiness

### Business job

Before a client discussion, an advisor needs to know whether the evidence required for internal
preparation is available and which client-use boundaries remain. Service identity, RFC proof,
data-product posture, and order-management acronyms are useful support evidence, but they do not
answer those primary business questions.

### Product and source-contract research

Research was reviewed on 2026-07-18 against official product guidance and the current Gateway
contract:

1. [IBM Carbon's status-indicator pattern](https://carbondesignsystem.com/patterns/status-indicator-pattern/)
   requires contextual, descriptive status labels, text in addition to color, an explicit unknown
   state, and the highest-attention posture when underlying states are consolidated.
2. [IBM Carbon's progress-indicator content guidance](https://carbondesignsystem.com/components/progress-indicator/usage/)
   keeps primary labels concise and uses supporting text for additional context.
3. [Salesforce's financial-advisor meeting-preparation guidance](https://help.salesforce.com/s/articleView?id=ind.fsc_agents_finserv_fin_advisor_asst_topic_meeting_prep.htm&language=en_US&type=5)
   centers the advisor job on client context, portfolio evidence, goals, life events, and actionable
   gaps rather than platform implementation identifiers.
4. [Salesforce's advisor-assistance release guidance](https://help.salesforce.com/s/articleView?id=release-notes.rn_einstein_copilot_standard_actions.htm&language=en_US&release=258&type=5)
   includes identifying missing or unavailable information so preparation remains complete and
   honest.
5. Gateway currently publishes four canonical positive proof strings and the exact
   `BLOCKED` client-publication posture, but transports readiness and unsupported capabilities as
   open strings rather than a bounded presentation enum.

### Adopted decisions

1. Answer readiness questions with concise business values: `Available`, `Blocked`, and
   `Not reported` in this source-backed slice.
2. Map only exact values proven for the matching readiness category. Do not infer meaning through
   formatting, substring matching, or a value that belongs to another category.
3. Treat null, unknown, and cross-field values as neutral `Not reported`; they must never become a
   positive posture.
4. Pair every status with category-specific helper text and use color only as a secondary cue.
5. Translate source-owned unsupported capabilities into business operating boundaries such as
   `Client communication unavailable` and `Order workflow unavailable`.
6. Preserve exact source codes in a collapsed `Support details` disclosure for support and audit
   use.
7. Keep action status and priority presentation separate because those fields use different,
   bounded contracts.

### Rejected decisions

1. Do not display `Advise`, `Gateway`, RFC identity, data-product vocabulary, `OMS`, or
   `supportability` in the primary advisor scan path.
2. Do not discard raw source values or replace them with unsupported business claims.
3. Do not show a green summary when any required contributing source is blocked, unavailable, or
   unknown.
4. Do not label ordinary readiness evidence as AI-generated. AI provenance is instance-specific
   and requires an explicit source signal.
5. Do not expand this slice into meeting agendas, advice generation, policy approval, client
   communication, order entry, or execution authority.

### Validation record

1. Presenter tests cover every known category/value pair plus null, unknown, and cross-field
   fail-closed cases.
2. View-model and component tests prove that business statuses and operating boundaries remain in
   the primary scan path while raw values stay hidden until `Support details` is opened.
3. An unknown-source component regression proves five neutral statuses and retains the raw evidence
   only inside the disclosure.
4. Forty-six focused presenter, view-model, navigation, component, and live-workflow tests passed.
5. Exact-head `make check` passed 295 test files and 1,338 tests at 90.84% statement coverage,
   followed by clean lint, TypeScript validation, and production build.
6. A dedicated production Playwright regression passed against a bounded diagnostic fixture. The
   collapsed-primary and expanded-support-detail screenshots prove that technical values are hidden
   from the primary scan path and retained on demand. Visual review also found and removed the last
   `Gateway-backed`, `supportability`, and `source evidence` language from the two cockpit headers.
7. Populated canonical browser certification remains blocked by the existing platform #553
   Manage seed-authority defect; no demo-ready visual claim is made.

### Publication decision

No wiki source change is required. This slice improves the presentation of an existing supported
Advisor Cockpit contract without changing route ownership, source capability, operator commands,
or integration boundaries. Technical capability truth remains correctly documented in the wiki.

## Advisor Own-Book Coverage And Portfolio Context Switching

### Business job

A relationship manager needs to begin from the portfolios actually assigned to their supported
book scope, narrow the list by a known client or mandate, and move between portfolio workflows
without losing the task in progress. The surface must distinguish own-book membership from team,
delegated, supervisor, household, AUM, and attention concepts that the current source does not
publish.

### Current-product research

Research was reviewed on 2026-07-18 from official product sources:

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   connects whole-portfolio insight, advisor workflow, nudges, and business oversight while keeping
   their source and use distinct.
2. [BlackRock householding](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/insights/householding)
   distinguishes account, grouped-account, and total-household context; Lotus therefore labels only
   the own-book scope its source contract confirms.
3. [Morningstar client dashboard](https://www.morningstar.com/business/insights/blog/das-client-dashboard)
   starts from client/group context and continues into account, portfolio, and reporting work,
   supporting a scope-to-record-to-task navigation model.

These sources inform workflow principles only. Lotus does not copy competitor layout, visual
identity, wording, household models, scoring, nudges, or unsupported capabilities.

### Adopted decisions

1. Add one dedicated **My book** landing route over Gateway own-book membership rather than
   relabelling the global portfolio catalogue.
2. Present source scope, date, booking centre, paging, assignment basis, tenant posture,
   limitations, and support evidence explicitly.
3. Use exact client and mandate filters plus deterministic source sorting only where Gateway
   supports them.
4. Reuse a source-backed portfolio context switcher across portfolio workflows and retain the
   current business route and supported query state.
5. Load own-book choices only when the advisor opens portfolio context, avoiding a hidden book
   query on every portfolio screen while keeping the native disclosure keyboard-operable.
6. Restore keyboard focus after switching and collapse filter state that does not belong in the
   destination portfolio workflow.
7. Keep primary language business-facing while retaining source codes and request references in
   support details.
8. Fail closed for permission, contract drift, source unavailability, and unconfirmed current
   portfolio membership; never substitute a global list.

### Rejected decisions

1. Browser-created advisor ownership, team, delegate, supervisor, or household relationships.
2. Locally aggregated book/client AUM, attention ranking, favourites, or recent-client claims.
3. Hard-coded browser authority or acceptance of actor, role, scope, or capability request headers.
4. A permanently expanded long rail or a cosmetic selector over the flat portfolio catalogue.
5. Treating legacy advisor projection or trusted-context tenant scope as governed relationship-role
   or tenant-isolation certification.

### Validation record

Issue #450 governs the slice. Focused contract, API, BFF authority, navigation, view-model, hook,
component, route, degraded-state, keyboard-focus, and responsive browser tests are green. The
production Playwright pack proves desktop and effective 200-percent-zoom widths, keyboard filter
flow, portfolio handoff, and no global-catalogue fallback. Canonical validation now includes the
Gateway advisor-book preflight and `advisor.book_overview` screenshot workflow; demo-ready capture
remains pending governed lotus-platform registry publication. Exact-head `make check` passed on
2026-07-18 with 300 test files, 1,361 tests, 90.86% statement coverage, lint, TypeScript, and the
optimized 25-route production build. The full-gate regression also proves that shared Portfolio and
Performance screens neither require additional router mocks nor load advisor-book data until the
portfolio-context disclosure is opened.

### Publication decision

Wiki truth changes because `/book`, its authority boundary, its supported business workflow, and
its deliberate no-claim scope are new operator-facing product behavior. The repo-authored wiki adds
an Advisor Book Workflow and updates Supported Features, API Surface, Home, and navigation.

## Shell Workspace Availability Language

### Business job

A private banker needs the main workspace navigation to explain why a destination cannot be used
without exposing service names, feature flags, lifecycle codes, or fallback implementation state.
The explanation must remain honest when Workbench does not recognize a future source reason.

### Source-contract inventory

Read-only review on 2026-07-18 found four bounded reason families:

1. Gateway workspace state publishes exact disabled reasons for Portfolio, Performance, Risk,
   Proposal, and Advisory.
2. Gateway publishes exact unavailable or unknown reasons for the Core, Performance, Risk, and
   Advise workspace dependencies.
3. Advise publishes `advisory_ready`, `dependency_degraded`, or `lifecycle_disabled`; the Gateway
   contract seam also covers `policy_review_required`.
4. Workbench fallback descriptors publish exact `disabled_in_fallback` reasons. These are not
   evidence that a capability is disabled; they mean source availability cannot be confirmed.

### Current-product research

1. [Carbon status-indicator guidance](https://carbondesignsystem.com/patterns/status-indicator-pattern/)
   treats the descriptive text label as essential, distinguishes disabled from unknown, and warns
   against relying on color or shape alone.
2. [W3C keyboard-interface guidance](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
   permits `aria-disabled` when an unavailable destination must remain discoverable and calls for
   consistent focus behavior across the navigation pattern.

These sources guide content and accessibility semantics only. Lotus retains its existing visual
system and Gateway-owned capability authority.

### Adopted decisions

1. Map only the exact governed source inventory into business postures; do not format open strings.
2. Distinguish a workspace that is not enabled from one whose required information is temporarily
   unavailable, one awaiting business review, and one whose availability is unconfirmed.
3. Fail closed to `availability could not be confirmed` for unknown, missing, fallback, or
   internally inconsistent reason values.
4. Keep disabled destinations discoverable through the shared navigation primitive and retain
   source reason codes in the Gateway contract rather than the primary banker-facing title.

### Rejected decisions

1. Replacing underscores, lowercasing arbitrary source codes, or matching reason keywords.
2. Translating unavailable or unknown information into entitlement, permission, or service-outage
   claims that the source does not make.
3. Page-specific title patches or removal of disabled destinations solely to hide weak copy.

### Validation record

Issue #454 governs the slice. Twelve focused presenter and shared-navigation tests pass across
known configuration, unavailable-information, review-required, fallback, missing, and unknown-code
states. TypeScript and lint pass. Production browser proof verifies that a fallback-disabled
Proposal destination exposes neutral business copy and no raw `disabled_in_fallback` title.
Exact-head `make check` passed on 2026-07-18 with 300 test files, 1,369 tests, 90.87% statement
coverage, lint, TypeScript, and the optimized 25-route production build.

### Publication decision

No wiki source change is required. The wiki already states that shell navigation follows the
Gateway capability contract; this slice corrects primary navigation language without changing a
route, capability, authority boundary, or operator workflow. The reusable rule is durable in this
research ledger, the codebase review ledger, and repository engineering context.

## Truthful Shell Utilities And Private-Banking Product Context

### Business job

A private banker needs the global shell to provide stable product orientation and only actions that
can complete a supported task. Search, notifications, and banker identity are trusted capability
surfaces: presenting them without source truth encourages sensitive input, false unread urgency,
and mistaken authenticated context.

### Source-contract audit

Read-only review on 2026-07-18 confirmed:

1. Workbench had no search form, query handler, result model, entitlement scope, privacy treatment,
   keyboard result navigation, or task-preserving handoff behind the global search input.
2. No source-owned notification list, unread count, acknowledgement contract, or notification action
   backed the bell and red dot.
3. Gateway caller headers support bounded upstream authorization but do not publish an authenticated
   banker-session display contract or account-menu commands.
4. Workbench #436 and platform #563 already govern the missing authenticated BFF principal/session
   contract. Local development authority is deliberately not a display identity.

### Current-product research

1. [W3C button guidance](https://www.w3.org/WAI/ARIA/apg/patterns/button/) defines a button as a
   control that triggers an action or event and requires an unavailable action to expose disabled
   state rather than behaving as an active no-op.
2. [W3C menu-button guidance](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/) requires the
   trigger to open a menu with explicit popup and expanded state plus keyboard focus behavior.
3. [W3C combobox guidance](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) defines the popup,
   value, suggestion, selection, and keyboard contract required for an interactive search selector.

### Adopted decisions

1. Remove unbacked enabled controls immediately instead of preserving decorative alignment.
2. Keep the existing Lotus brand and add concise, non-interactive `Private Banking Workbench`
   product context in the same lockup.
3. Remove dead icon helpers, control styles, unread treatment, identity styles, and obsolete
   responsive overrides in the same reusable shell slice.
4. Prove absence of search, notifications, unread posture, person name, initials, role, and
   menu-shaped banker controls at unit and production-browser levels.

### Rejected decisions

1. Hard-coded or deployment-configured banker display identity.
2. A disabled search field, notification bell, or profile button retained only to make the header
   look feature-rich.
3. Browser-local client/account/proposal search, fake unread counts, or an account menu without
   authenticated source commands.
4. Treating advisor-book membership as banker identity; `/book` owns portfolio assignment scope.

### Validation record

Issue #451 governs the slice. Thirty-nine focused shell, navigation, and design-system tests pass
with TypeScript and lint. Production browser coverage verifies the product context at desktop and
tablet width and proves the search field, notification action, and hard-coded banker identity are
absent. Exact-head `make check` passed on 2026-07-18 with 300 test files, 1,369 tests, 90.85%
statement coverage, lint, TypeScript, and the optimized 25-route production build.

### Publication decision

No wiki source change is required. Published wiki truth does not claim global search, notifications,
or banker-profile support, and the supported routes and authority boundaries are unchanged. The
product-context and false-affordance rule is durable in this research ledger, the codebase review
ledger, and repository engineering context.

## Deterministic Portfolio Page Identity In Browser Proof

### Validation job

The narrow-layout browser gate must prove that the intended Portfolio page is ready before measuring
horizontal overflow. Its page identity cannot change when a source-backed decision headline happens
to repeat part of the page title, or when source unavailability selects a governed degraded state.

### Current-practice research

The official [Playwright locator guidance](https://playwright.dev/docs/locators) recommends
user-facing role locators with a sufficiently precise accessible name. It documents strict locator
behavior, exact name matching, heading-level constraints, and warns against positional selectors
such as `first()` or `nth()` when a unique semantic contract can identify the intended element.

### Adopted decisions

1. Identify the ready Portfolio page by heading role, exact accessible name, and level one.
2. Keep source-unavailable branches explicit through a bounded set of exact business headings.
3. Reuse named page-identity helpers across the foundation and responsive journeys.
4. Prove strict uniqueness in a browser DOM containing both `Portfolio Review` and the adjacent
   `Portfolio review is ready` decision heading.
5. Measure responsive overflow only after the relevant ready or unavailable identity is visible.

### Rejected decisions

1. Substring heading matches whose result changes with adjacent business copy.
2. `.first()`, `.last()`, or `.nth()` as a way to suppress strict-mode ambiguity.
3. CSS structure, test-only identifiers, retries, or longer timeouts for a semantic identity defect.
4. Removing the degraded-state branch or requiring a live Gateway merely to validate layout.

### Validation record

Issue #430 governs the slice. Lint, TypeScript, and diff hygiene pass. The focused production-browser
run proved the two-heading ready state and the three-route 390 px overflow journey in 7.4 seconds.
The current source-down path rendered the governed `Portfolio context unavailable` identity, all
responsive assertions passed, and launcher cleanup left no listener on port 3000.

### Publication decision

No wiki source change is required. This slice changes browser-test selection semantics, not a
supported product route, business capability, operator command, or published source boundary. The
reusable locator rule is durable in this research ledger and the codebase review ledger.

## Supportability-Aware And Independent Performance Browser Proof

### Validation job

A private-banking Performance screen must remain correct when the source contract is complete,
partial, or unavailable. Browser proof must distinguish UI correctness from source readiness,
retain strong metric and geometry checks when their governed precondition is satisfied, and keep
Analysis, Contribution, and Evidence journeys independently diagnosable.

### Source-contract audit

Read-only review on 2026-07-18 confirmed:

1. the split Performance summary contract publishes exact module capability states and source-owned
   economics before optional detail rows are rendered,
2. return history, horizon comparison, contributor ranking, and evidence can be unavailable while
   the overall Performance workspace remains a truthful supported page,
3. the existing test inferred readiness from page visibility and optional row timing,
4. file-level serial mode skipped every later journey after the first summary failure, and
5. existing pure fixture builders already represented populated and source-limited contracts but
   were not available through a real production-browser/BFF path.

### Current-practice research

1. Official [Playwright isolation guidance](https://playwright.dev/docs/browser-contexts) recommends
   a clean browser context per test so failures and local state do not carry into later journeys.
2. Official [Playwright retry and serial-mode guidance](https://playwright.dev/docs/test-retries)
   states that later tests in a serial group are skipped after a failure and recommends isolated
   tests where possible.
3. Official [Playwright fixture guidance](https://playwright.dev/docs/test-fixtures) treats setup
   and teardown as explicit lifecycle boundaries and keeps each test supplied only with the
   environment it requires.

### Adopted decisions

1. Read the exact summary capability/economic contract using the same explicit selection as the
   browser page and fail closed when capabilities are absent.
2. Assert complete metrics and geometry only when supported modules and required economics satisfy
   the populated precondition.
3. Assert exact unavailable metric, return, horizon, contributor, and evidence behavior when the
   source contract supplies that posture.
4. Run the file in default independent mode: one governed fixture Gateway lifecycle and a fresh
   browser context for every scenario, without serial skip propagation.
5. Reuse the existing Performance contract builders behind an opt-in loopback fixture Gateway;
   route the production Next server through canonical `gateway.dev.lotus` addressing.
6. Publish populated and unavailable repo-native commands with direct child-process ownership,
   bounded ports, signal forwarding, and fail-closed scenario validation.

### Rejected decisions

1. Waiting for optional cash tiles, horizon rows, or contributor rows to infer source readiness.
2. Weakening populated geometry checks so an unavailable contract happens to pass.
3. Treating a truthful unavailable source state as a page failure or requiring a live Gateway for
   deterministic component-layout proof.
4. Serial mode, shared browser pages, positional selectors, retries, or longer timeouts as a remedy
   for contract-state ambiguity.
5. Using fixture responses to certify live upstream Server-Timing propagation.
6. Adding fixture routes, mock switches, or test-only payloads to production application code.

### Validation record

Issue #431 governs the slice. Six focused classifier/launcher unit tests, lint, TypeScript, launcher
syntax, invalid-input rejection, and diff hygiene pass. The repo-native populated command passed five
executed browser journeys with one explicit live-only timing skip in 14.4 seconds. The unavailable
command passed four executed journeys with live-timing and populated-layout preconditions explicitly
skipped in 13.3 seconds. Both scenarios exercised the production Workbench/BFF path and left the
fixture and smoke-server ports clear.

### Publication decision

Wiki source changes are required because two new repository-native operator commands and their
evidence boundaries are now part of the validation workflow. Publish `wiki/Validation-and-CI.md`
after merge, then run strict wiki parity verification.

## Secure Chart Runtime And Dependency Gates

### Validation job

Workbench charts carry investment outcomes, benchmark comparisons, and attribution evidence. The
browser runtime must not retain a known script-injection path, and the engineering toolchain must
not normalize critical or high advisories. A major chart-library upgrade must also preserve the
intentionally dense Workbench visual system rather than silently adopting new defaults.

### Current-practice research

1. The [GitHub-reviewed Apache ECharts advisory](https://github.com/advisories/GHSA-fgmj-fm8m-jvvx)
   identifies a cross-site scripting exposure in ECharts versions before 6.1.0.
2. The official [Apache ECharts 6 upgrade guide](https://echarts.apache.org/handbook/en/basics/release-note/v6-upgrade-guide/)
   says most APIs remain compatible, but the default theme, legend placement, component sizing,
   axis overflow handling, and label inheritance can change. It publishes the `v5` compatibility
   theme for controlled migration.
3. The [GitHub-reviewed Vitest advisory](https://github.com/advisories/GHSA-5xrq-8626-4rwp)
   identifies arbitrary file read and execution before Vitest 3.2.6 when its UI server is exposed.
4. Registry metadata confirms echarts-for-react 3.0.6 accepts ECharts 6, and Vitest plus its V8
   coverage provider publish matching 3.2.7 versions for a bounded patch upgrade.

### Adopted decisions

1. Upgrade ECharts to the first advisory-safe 6.1.0 release and echarts-for-react to 3.0.6.
2. Centralize ECharts rendering in the design system and apply the documented `v5` compatibility
   theme so the security migration does not become an accidental chart redesign.
3. Upgrade Vitest and coverage together to 3.2.7 and allow their compatible dependency ranges to
   resolve patched Vite and esbuild versions.
4. Resolve the remaining js-yaml advisory within its existing compatible range.
5. Enforce two thresholds: no high/critical advisory anywhere in the installed graph, and no
   moderate-or-higher advisory in browser-delivered production dependencies.
6. Run the same policy through `make check`, Feature Lane, PR Merge Gate, and Main Releasability.
7. Treat dependency maturity as a bank-readiness control: prefer established, stable, widely
   understood technology and reject beta, experimental, novelty-driven, or latest-major adoption by
   default. ECharts 6.1.0 is accepted here only because no ECharts 5 release fixes the advisory; its
   new visual features remain unused behind the v5 compatibility boundary.

### Rejected decisions

1. `npm audit fix --force`, an unbounded latest-major toolchain migration, or an unexplained lockfile
   rewrite.
2. Shipping the known production XSS finding because it was classified as moderate.
3. Upgrading ECharts while accepting its new default theme without visual review.
4. A CI-only scanner that developers cannot run through the repository-native command contract.
5. Silent or permanent advisory exceptions without an owner, expiry, and GitHub issue.
6. Technology modernization whose primary justification is novelty, ecosystem fashion, or version
   recency rather than security, supportability, or a proven business requirement.

### Rollback and validation posture

If chart behavior regresses, retain ECharts 6.1.0 and correct the shared compatibility wrapper or
explicit chart options; do not roll back to the vulnerable ECharts 5 line. A deliberate future move
to the ECharts 6 visual theme belongs to a separate design-system issue with baseline screenshots.
Issue #456 owns focused chart contracts, browser proof, accessibility checks, the full repository
gate, Docker proof, protected CI, and exact-main validation.

### Publication decision

Wiki source changes are required because the repository-native and protected dependency-security
policy is operator-facing validation truth. Publish `wiki/Validation-and-CI.md` after merge, then
run strict wiki parity verification.

## Immutable Enterprise Container Runtime And Image Evidence

### Validation job

The production Workbench image must be reproducible, supported, minimally privileged, and auditable.
A green application build does not prove the identity or vulnerability posture of its operating
system, Node runtime, installed production packages, or scanner itself.

### Current-practice research

1. The official [Node release schedule](https://github.com/nodejs/Release) classifies Node 22 as
   Maintenance LTS through 2027-04-30. Maintenance LTS receives critical fixes and security updates;
   Node 26 remains Current and is not selected for this production line.
2. The official [Node Docker image guidance](https://github.com/nodejs/docker-node) documents Debian
   slim as the minimal glibc variant. It says Alpine uses musl, classifies amd64 musl builds as
   experimental, and says other musl architectures are not tested before release.
3. Official [Next 15 output guidance](https://nextjs.org/docs/15/app/api-reference/config/next-config-js/output)
   documents stable output-file tracing and `output: 'standalone'` as the way to deploy only required
   runtime files and selected dependencies through its generated minimal `server.js`.
4. Registry inspection resolved official `node:22.23.1-bookworm-slim` to multi-platform digest
   `sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3`.
5. Aqua Security advisory [GHSA-69fq-xp46-6x23](https://github.com/aquasecurity/trivy/security/advisories/GHSA-69fq-xp46-6x23)
   records a March 2026 compromise of Trivy releases, images, setup actions, and mutable action tags.
   It identifies Trivy 0.69.3 and trivy-action 0.35.0 as known-safe and directs consumers to pin full
   action commit SHAs.
6. GitHub verification confirms immutable trivy-action 0.35.0 commit
   `57a97c7e7821a5776cebc9bb87c984fa69cba8f1` carries a valid signed commit.

### Adopted decisions

1. Keep the mature Node 22 line and move from Alpine/musl to official Debian Bookworm slim/glibc.
2. Pin the exact Node patch and multi-platform image digest once in the Dockerfile; make production
   stages and Dockerized CI inherit that shared target.
3. Use an allowlisted Docker build context containing only package manifests, Next/TypeScript build
   configuration, and application source. Exclude local environment values and all generated or
   non-runtime material by default.
4. Generate stable Next standalone output and copy only its traced runtime plus static assets. Remove
   npm, Corepack, and Yarn after build, then execute the generated minimal server directly as the
   unprivileged image-provided `node` user. The first local scan found two fixable HIGH findings in
   bundled npm, while pruned dependencies still retained Playwright through Next's optional peer and
   occupied 638 MB; both findings justify the traced deployment boundary.
5. Build and scan the exact production image in PR and Main Releasability Docker lanes.
6. Reject fixable high/critical operating-system or library findings and publish a CycloneDX SBOM
   artifact for every protected run.
7. Pin the scanner action to the verified full 0.35.0 commit and request known-safe Trivy 0.69.3
   explicitly. Do not trust mutable tags, `master`, `latest`, or the compromised 0.69.4–0.69.6
   artifacts.
8. Own readiness in the production image with a dependency-free Node probe. Let Compose inherit the
   same health contract so removing package managers and distribution utilities cannot make a
   successfully started service appear unhealthy.

### Rejected decisions

1. Node Current, beta, release-candidate, distroless, custom runtime, or an unrelated framework
   migration in this security slice.
2. Floating `node:22`, `node:22-alpine`, Debian, scanner, action, or latest-version references.
3. Retaining the experimental musl runtime merely because its compressed image is smaller.
4. Copying the full development toolchain into production or running the application as root.
5. Treating an SBOM as a vulnerability gate, or treating a scanner table as sufficient provenance
   without a machine-readable inventory.
6. Suppressing fixable high/critical findings without a time-bounded GitHub issue and explicit owner.
7. Installing `wget`, `curl`, or another runtime utility solely to preserve a Compose-only health
   command after moving to a minimal Debian standalone image.

### Rollback and refresh posture

Do not roll back to floating Alpine images. If the Debian migration exposes a runtime incompatibility,
fix the Docker boundary or revert to the prior exact Node 22 patch on an official Debian slim digest,
then preserve the image scan and SBOM gates. Review the Node patch/digest on a bounded cadence and
complete an issue-backed LTS migration before Node 22 reaches end-of-life.

### Publication decision

Wiki source changes are required because immutable runtime provenance, image vulnerability
enforcement, and SBOM artifacts are protected-lane truth. Publish `wiki/Validation-and-CI.md` after
merge, then run strict wiki parity verification.

## Deterministic Docker Parity Under Shared-Stack Load

### Validation job

Dockerized local CI must provide reproducible Linux parity on the same workstation that may be
running the governed canonical Lotus stack. Container-visible CPU count is not a safe concurrency
budget when databases, brokers, analytics services, and front-office services share that host.
The repository bind mount also must not make developer-local environment values an implicit build
input.

### Current-practice research

Official [Vitest parallelism guidance](https://v3.vitest.dev/guide/parallelism) says test files run
in parallel by default and `maxWorkers` governs the number of simultaneous workers. The guidance
also distinguishes this bounded file parallelism from disabling file parallelism entirely.

### Evidence and adopted decision

One unbounded Docker parity run under shared-stack load passed 302 of 305 files and 1,399 of 1,404
tests but produced one transient tooltip wait miss and four timeouts across three files. The exact
three files then passed all 15 tests in 21.07 seconds in the same image and named-volume environment
once the concurrent full suite ended. Host `make check` passed all 305 files and 1,404 tests.

Set `--maxWorkers=2` only for the Dockerized local lane. This retains file isolation and useful
parallelism while making resource use explicit and conservative. Keep host and protected CI behavior
unchanged so their available execution capacity remains independently visible.

Mask `/app/.env.local` with the tracked, intentionally empty `scripts/testing/ci-empty.env` fixture.
This preserves the productive whole-repository bind mount while making local configuration an
explicit non-input to container lint, typecheck, tests, and build.

### Rejected decisions

1. Increase individual timeouts for tests that are fast in isolation.
2. Disable assertions, use `passWithNoTests`, or ignore failed files.
3. Disable file parallelism globally and hide genuine concurrency behavior.
4. Derive the limit from host core count, which caused the original oversubscription.
5. Read the workstation's `.env.local`, copy its values into CI configuration, or delete/rename the
   developer's file during a validation run.

### Publication decision

Wiki source changes are required because the Docker parity operating envelope is validation truth.
Publish `wiki/Validation-and-CI.md` after merge, then run strict parity verification.

## Source-Authoritative Performance Attribution Totals

### Validation job

The Performance Analysis attribution table must explain the portfolio result using producer-owned
analytical totals. Detail rows are evidence within a selected classification level; they are not a
safe browser-side calculation base because the response can be partial, filtered, rounded, or
shaped differently from the producer's official aggregate.

### Current-practice research

1. The CFA Institute's
   [Portfolio Performance Evaluation curriculum](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/portfolio-performance-evaluation)
   treats attribution as a governed analytical process for explaining active return, including
   allocation, selection, and interaction effects.
2. The CFA Institute Research and Policy Center's
   [Performance Attribution: History and Progress](https://rpc.cfainstitute.org/research/foundation/2019/performance-attribution)
   reinforces that attribution methods and their interpretation depend on the chosen model and
   calculation framework rather than presentation-layer arithmetic.
3. W3C's [table concepts](https://www.w3.org/WAI/tutorials/tables/) and
   [table design tips](https://www.w3.org/WAI/tutorials/tables/tips/) require data tables to expose
   clear row and column relationships. Distinct language is therefore needed for unavailable
   source evidence and for cells that are intentionally non-additive.

### Adopted decisions

1. Preserve `allocation_total_pct`, `selection_total_pct`, `interaction_total_pct`, and
   `total_effect_pct` from the selected source attribution level as the only effect-total authority.
2. Keep local aggregation only for portfolio and benchmark exposure weights, which are presentation
   summaries rather than attribution calculations.
3. Display `Unavailable` when an optional source component total is absent. Keep the em dash for
   portfolio and benchmark return columns whose footer values are intentionally non-additive.
4. Keep the required total-effect contract strict. Gateway issue #506 owns controlled handling of
   malformed producer evidence rather than allowing Workbench to turn a missing value into zero or
   a row-derived substitute.
5. Protect the boundary with adversarial tests whose detail-row sums disagree with source totals,
   plus a structural regression that rejects browser-side effect aggregation.

### Rejected decisions

1. Summing visible detail rows to reconstruct any official attribution effect.
2. Treating missing totals as zero, blank content, or an em dash that is indistinguishable from an
   intentionally non-additive field.
3. Removing the total row and forcing advisors to estimate the portfolio-level explanation.
4. Expanding this correctness slice into a wider visual redesign before the analytical authority is
   trustworthy.

### Publication decision

No wiki source change is required. This slice corrects an existing supported Performance contract
and records its engineering authority in repository context and review ledgers; it does not change
the operator runbook, route catalogue, supported feature set, or validation commands. The PR must
still pass strict wiki parity before merge.

## Follow-Up Brace Expansion Availability Advisory

### Validation job

The Workbench development toolchain must stay audit-clean without replacing mature framework,
lint, or test infrastructure merely because a new transitive advisory appears. Remediation must
patch the exact compatible consumer path and preserve the semantics of unrelated dependency lines.

### Current security research

GitHub's reviewed advisory
[GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895), published to the advisory
database on 2026-08-03, records that the 5.0.8 mitigation for brace expansion did not bound two
intermediate arrays. A small crafted pattern can terminate Node through memory exhaustion, and a
wider padded sequence can block the event loop for minutes. GitHub rates the issue High at CVSS
7.5 and identifies 5.0.9 as the patched 5.x release.

The Workbench lock graph contains one affected node: `minimatch@10.2.6` requests
`brace-expansion@^5.0.8` through the maintained ESLint, TypeScript-ESLint, and test-exclude
toolchain. No production dependency reaches this package.

### Adopted decisions

1. Keep the current stable Next, ESLint, TypeScript-ESLint, Vitest, and coverage-tool versions.
2. Override only `minimatch`'s compatible brace-expansion consumer to exact patched 5.0.9.
3. Preserve the package-lock integrity and add a governance regression for the narrow override.
4. Require both the complete-graph high-severity audit and production-graph moderate-severity audit
   to report zero vulnerabilities before accepting the PR.

### Rejected decisions

1. Audit suppression, allowlisting, or lowering either protected threshold.
2. A global brace-expansion override that could force the 5.x implementation onto incompatible
   older-major consumers.
3. A preview, current-major, or unrelated toolchain upgrade in a transitive patch slice.
4. Treating the development-only path as harmless when it blocks protected CI and can process
   repository-controlled patterns.

### Publication decision

No wiki source change is required. This is a lockfile and dependency-governance correction; it does
not change a supported product capability, operator command, or runtime contract. Issue #519 owns
the remediation and exact-main closure evidence.

## Proposal Workflow Source Truth After Save, Refresh, And Paging

### Workflow objective

Help a client advisor move from proposal construction into a retained advisory record, review
current suitability evidence, and triage a bounded proposal queue without contradictory lifecycle
claims or false book completeness.

### Current workflow research

1. [BlackRock Aladdin Wealth proposal generation](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/proposal-generation)
   separates proposal construction from downstream delivery and implementation while keeping firm
   criteria and suitability checks in the governed workflow.
2. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   emphasizes connected advisor workflows, book insights, next business actions, and
   exception-oriented portfolio review.
3. [Salesforce Financial Services Cloud Action Plans](https://help.salesforce.com/s/articleView?id=sf.fsc_action_plans&language=en_US)
   keeps source task status and responsible action visible through a repeatable business process.
4. [TanStack Query useQuery](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery)
   distinguishes first-load `isLoading` from background `isFetching` and refetch failure with
   retained cached data.
5. [Carbon pagination guidance](https://carbondesignsystem.com/components/pagination/usage/)
   recommends explicit user-controlled pagination when loading all available data would be costly
   or difficult to consume.

### Adopted decisions

1. Promote the simulation workflow rail from construction-only to `Advisor draft saved` only after
   the approved handoff returns a source proposal id.
2. Keep cached policy evidence readable during background refresh, label the rail `Refreshing`, and
   downgrade a failed refresh to partial evidence instead of silently calling the source current.
3. Treat every continuation cursor and every non-initial cursor window as partial queue coverage.
4. Provide explicit previous/next source-window controls backed by the real cursor contract; never
   auto-traverse an unbounded advisor book in the browser.
5. Centralize first-load, background-refresh, unavailable, cached-refresh-failure, and permission
   posture in a reusable query projection and centralize cursor-window navigation in a reusable
   Workbench control.

### Rejected decisions

1. Optimistic persisted status, browser-authored lifecycle stage, suitability outcome, approval
   readiness, client publication, or execution posture.
2. Discarding readable cached evidence during a background refresh or labelling it current before
   the source settles.
3. Treating a zero-row first window, a terminal continuation window, or one visible page as the
   complete proposal queue.
4. Exposing cursor values or transport terminology in advisor-facing copy.
5. Automatically loading every proposal window merely to derive a browser-owned book total.

### Publication decision

No wiki source change is required. Issues #521, #522, and #523 harden the source truth of existing
supported proposal routes without changing their route catalogue, backend ownership, operator
commands, or supported-feature boundary. Repository context records the new paging and refresh
invariants; the PR must still pass strict wiki parity before merge.

## Current-Worktree Browser Proof Isolation

### Validation objective

Prove that local production-browser validation exercises the intended Workbench commit even when a
shared platform stack or another worktree already owns the default listener.

### Current-practice research

Playwright's official
[web server configuration](https://playwright.dev/docs/api/class-testconfig#test-config-web-server)
defines `reuseExistingServer` as permission to use any process already available at the configured
URL. It separately recommends aligning the browser `baseURL` with the web-server URL. A successful
readiness response therefore proves listener availability, not source-worktree provenance.

### Adopted decisions

1. Accept one explicit `PLAYWRIGHT_PORT` in the valid TCP range and apply it consistently to the
   Next production server, Playwright readiness URL, and browser base URL.
2. Disable existing-server reuse whenever the caller selects a port, so a collision fails instead
   of silently exercising an unrelated process.
3. Preserve the convenient default local reuse behavior on port `3000` for deliberate development
   sessions and preserve fail-closed non-reuse behavior in CI.
4. Run exact-commit production proof in an isolated temporary Git worktree when the canonical
   worktree's build output may be in use by a shared listener; remove the temporary worktree after
   validation.

### Rejected decisions

1. Killing or replacing a shared platform listener merely to validate a feature branch.
2. Treating recognizable page content, a successful HTTP response, or a green test against a reused
   listener as proof of the current source commit.
3. Hard-coding a second repository port that can eventually collide in the same way.
4. Allowing malformed, zero, negative, fractional, or out-of-range port values to fall back
   silently to the default.

### Publication decision

The browser-proof command contract changes, so `wiki/Validation-and-CI.md` is updated in the same
PR. After merge, publish the Workbench wiki and verify strict source/publication parity before
closing issue #524.

## Advisor Cockpit Acknowledgement Reconciliation

### Workflow objective

Help a client advisor distinguish a recorded review acknowledgement from the later confirmation of
the action, preparation, and readiness evidence used for the next business decision.

### Current workflow research

1. TanStack Query's official
   [background fetching guidance](https://tanstack.com/query/latest/docs/framework/react/guides/background-fetching-indicators)
   distinguishes initial loading from background fetching and recommends a separate visible
   indicator while retained data remains on screen.
2. TanStack Query's official
   [mutation invalidation guidance](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations)
   confirms that returning and awaiting the invalidation promise keeps the mutation pending until
   the affected queries finish updating.
3. IBM Carbon's
   [inline loading guidance](https://carbondesignsystem.com/components/inline-loading/usage/)
   recommends descriptive active, finished, and error labels for short update operations and
   disabling the associated interaction until processing completes.

### Adopted decisions

1. Compose action, snapshot, preparation, and supportability queries into one Advisor Cockpit
   evidence posture using the shared Workbench query-state projection.
2. Keep previously retrieved evidence readable during confirmation, but replace the settled
   decision and badge with a business-facing `Confirmation in progress` posture until every
   required query settles.
3. Await all four invalidations and keep acknowledgement unavailable during recording,
   confirmation, partial evidence, unavailability, and permission restriction.
4. Preserve cached evidence after an ordinary refresh failure with an explicit partial posture;
   hide all protected cockpit evidence when any required source reports a permission boundary.
5. Prove the composite with independently controlled query completion in integration tests and a
   delayed-response production-browser flow.

### Rejected decisions

1. Optimistically removing or rewriting the source-owned action after acknowledgement.
2. Replacing the whole workspace with a blocking loader during background confirmation.
3. Calling the acknowledgement complete while any required source still has an unsettled response.
4. Re-enabling the action against cached evidence after a failed confirmation.
5. Exposing cache, query-client, refetch, endpoint, or service-topology terminology to advisors.

### Publication decision

No wiki source change is required. Issue #526 corrects the state handling of existing supported
Advisor Cockpit routes without changing the route catalogue, backend ownership, operator commands,
or supported-feature boundary. Repository context records the durable composite-evidence invariant;
the PR must still pass strict wiki parity before merge.

## AI-Assisted Output And Human Review Disclosure

### Business job

An advisor, portfolio manager, or reviewer must decide what prepared a narrative, whether a usable
output exists, what evidence supports it, whether human review is recorded, whether it may be used
with a client, and whether its freshness is known. These are separate decisions; workflow
completion alone answers none of them.

### Current-product research

Research was reviewed on 2026-08-04 from official sources:

1. [Carbon AI label usage](https://carbondesignsystem.com/components/ai-label/usage/) recommends a
   stable, focused marker beside affected output and a consistent path to explainability; the label
   is neither decoration nor an action trigger.
2. [Microsoft HAX guidelines](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/)
   recommend explaining why an output was produced and communicating capability limits while
   guarding against automation bias and over-trust.
3. [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/) requires clear human
   and AI roles, documented limitations, and output interpretation in the operating context.
4. [FINRA's 2026 GenAI oversight report](https://www.finra.org/rules-guidance/guidance/reports/2026-finra-annual-regulatory-oversight-report/gen-ai)
   confirms that supervision, communications, recordkeeping, and fair-dealing obligations continue
   to apply to GenAI-enabled workflows.

### Adopted decisions

1. Use one quiet output-adjacent `How this was prepared` disclosure with visible status text.
2. Separate preparation, availability, evidence, human review, client use, and freshness.
3. Use native `details`/`summary` semantics for reliable keyboard and screen-reader behavior.
4. Fail closed for missing or contradictory provenance; never fabricate task, provider, model,
   source reference, review, freshness, or client permission.
5. Identify deterministic browser-composed narrative as rule-based internal working material.
6. Keep provider, model, run, and evidence identifiers secondary to business posture.

### Rejected decisions

1. A global AI badge or generic `AI powered` claim.
2. Sparkle icons, glow, gradients, or ornamental AI identity.
3. Using the disclosure marker as a regenerate or workflow action.
4. Treating request acceptance or runtime completion as evidence, human review, or client approval.
5. Inferring live generation, review, freshness, or client-use permission from adjacent fields.

### Publication decision

The supported product boundary changes because Performance Advisor Brief and Advisory Copilot now
publish the common disclosure. `wiki/Supported-Features.md` and repository context are updated in
this PR. Remaining DPM workflow-output adoption is tracked by issue #528.

### Availability and evidence follow-up — 2026-08-05

Issues #531 and #532 rechecked the same official Carbon, Microsoft HAX, NIST AI RMF, and FINRA
guidance against the merged component and Performance adapters.

Adopted:

1. Name live, partial, stale, simulation, and unavailable output in compact business language and
   retain Availability as an explicit expanded fact.
2. Count evidence only when a displayed deterministic metric is usable or a published source
   reference remains nonblank after normalization.
3. Treat superseded workflow output as historical, block client use, and show source-published
   replacement lineage beside the limitation and secondary diagnostics.
4. Keep native disclosure semantics and add a three-column intermediate layout before the existing
   narrow single-column layout.

Rejected:

1. Counting array entries, whitespace, duplicate references, or `N/A` display placeholders as
   evidence.
2. Treating a completed and accepted but superseded run as live.
3. Inferring a replacement run, freshness timestamp, confidence score, or approval state that the
   source did not publish.
4. Introducing a Performance-only disclosure variant or ornamental AI styling.

Publication decision: the reusable disclosure contract and visible supported-feature behavior
change, so repository context and `wiki/Supported-Features.md` are updated in the same PR. Publish
the authored wiki after merge and verify strict parity.

### DPM workflow adoption — 2026-08-08

#### Workflow objective and users

Portfolio managers, CIO reviewers, investment-control users, and operations specialists need to
request decision support where the underlying work occurs and then distinguish a recorded request
from available material, supporting evidence, human review, permitted use, and freshness. The
adoption covers proof-pack PM memo, wave PM memo, operations brief, monitoring-exception summary,
outcome-review narrative, and PM operating-quality support summary workflows.

#### Workflow research

The implementation rechecked the shared disclosure research against DPM operating controls and
reviewed these additional official sources:

1. [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/) requires explicit
   human-AI roles, oversight, knowledge limits, and permitted-use boundaries.
2. [FINRA 2026 GenAI oversight](https://www.finra.org/rules-guidance/guidance/reports/2026-finra-annual-regulatory-oversight-report/gen-ai)
   keeps supervision, communications, recordkeeping, and fair-dealing obligations in force for
   AI-enabled workflows.
3. [Singapore PDPC Model AI Governance Framework](https://www.pdpc.gov.sg/help-and-resources/2020/01/model-ai-governance-framework)
   recommends human-centric, explainable decisions, an explicit degree of human involvement, and
   communication that affected users can understand.

#### Adopted decisions

1. Put the request beside its owning workflow and use one shared business result pattern across all
   six families rather than routing every decision through a generic Copilot banner.
2. Normalize each exact Gateway response through a typed family profile while preserving one
   disclosure contract and presentation component.
3. Announce and focus a newly returned result, then expose the native disclosure control for
   keyboard and screen-reader review.
4. Treat acceptance as request posture only. Output availability, evidence, review, client use,
   freshness, supersession, and simulation remain independent source facts and fail closed when
   absent or contradictory.
5. Label persisted PM-quality invocation history as audit evidence only. Without a returned output,
   it reports output unavailable and client use blocked even when the invocation record exists.
6. Keep provider, model, runtime, run, and source identifiers in secondary support details while
   leading with what was requested, what is available, who must review it, and what may happen next.

#### Rejected decisions

1. One `Promise<unknown>` response summarizer or one universal success badge.
2. Treating HTTP acceptance, workflow completion, or invocation persistence as generated material.
3. Inventing citations, confidence, reviewer identity, review time, freshness, or replacement
   lineage in Workbench.
4. Making technical provider, model, endpoint, or run vocabulary the primary operating message.
5. Duplicating six page-specific disclosure cards or storing generated output in browser-owned
   state beyond the bounded returned workflow result.

#### Expected measurable improvement and publication decision

Every supported DPM assistance action now produces the same six independent business facts and a
review-required, fail-closed client-use boundary; the wave memo and operations brief are also
available at their point of work. Table-driven adapter and owning-screen tests prove all six
families plus invocation-only evidence. The supported product and integration boundary changes, so
`wiki/Supported-Features.md`, `wiki/Integrations.md`, repository context, and the codebase review
ledger are updated. Routes, environment variables, API paths, canonical operator commands, and
README onboarding do not change, so no README, API Surface, or runbook update is required. Publish
the authored wiki after merge and verify strict parity.

### DPM mandate review workflow — 2026-08-09

#### Workflow objective and users

Portfolio managers and investment-control users need to move from mandate posture to the exact
source-owned item requiring attention, understand who owns it and what Manage recommends next, and
inspect lineage without scanning duplicate dashboards or relying on Workbench-invented readiness.

#### Research anchors

1. [CFA Institute Standard III(C): Suitability](https://www.cfainstitute.org/standards/professionals/code-ethics-standards/standards-of-practice-iii-c)
   supports periodic review of investor objectives and constraints rather than local suitability
   inference.
2. [ESMA MiFID II Article 25](https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mifid-ii/article-25-assessment-suitability-and)
   anchors periodic portfolio-management review in the client's preferences, objectives, and
   characteristics.
3. [FCA Consumer Duty outcomes monitoring](https://handbook.fca.org.uk/handbook/prin2a/prin2as9)
   links management information to identifying emerging risk and taking accountable action.
4. [Carbon data-table guidance](https://carbondesignsystem.com/components/data-table/usage/)
   supports compact task tables and progressive disclosure for supplementary detail.
5. [WCAG 2.2 reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
   requires content and controls to remain usable without page-level two-dimensional scrolling.

#### Adopted decisions

1. Use one operating sequence: mandate health, attention queue, selected source-owned next step,
   then evidence and version identifiers.
2. Make each exception observation a native button with visible selected state and keyboard
   activation; bind owner, age, source, and next step to that same exception.
3. Render a summary meter only when Manage publishes a usable score. Missing context, ownership,
   action, monitoring, and lineage remain visibly unavailable.
4. Translate known source codes into business language while keeping exception, mandate, run,
   correlation, and authority identifiers under native progressive disclosure.
5. Keep wide operational tables inside labelled scroll containers and prove page reflow at desktop,
   tablet, compact, and effective 200% zoom widths.

#### Rejected decisions

1. Inferring mandate readiness from the number of active exceptions.
2. Hard-coded health percentages, mandate type, risk profile, currency, as-of date, or audit-trail
   availability.
3. Attaching book-level recommended actions to a selected exception without a source relationship.
4. Generating remediation prose such as approval guidance from a reason or action code.
5. Repeating attention, action, latest-review, and health-dimension data as equally weighted card
   stacks or exposing raw reason codes as the primary observation.

#### Expected measurable improvement and publication decision

Focused model, helper, component, integration, and canonical-script tests prove current summary
contract mapping, all supported operating states, keyboard selection, evidence disclosure, removal
of fabricated defaults, and responsive proof. The product boundary and operator proof changed, so
repository context, the canonical runtime runbook, `wiki/Supported-Features.md`,
`wiki/API-Surface.md`, and `wiki/Integrations.md` are updated. README commands, public routes,
environment variables, and platform-wide routing do not change. Publish the authored wiki after
merge and verify strict parity.

## Portfolio Record Route Performance And Resilience

### Business job

Private bankers move repeatedly among Allocation, Positions, Transactions, Cashflow, and Income
during review preparation. Each transition should load the selected business task promptly without
shipping unrelated grids or analytical workspaces, while preserving portfolio identity, source
truth, navigation, evidence, and a clear recovery path.

### Current-practice research

Research was refreshed on 2026-08-09 from official Next.js sources:

1. [Next.js lazy-loading guidance](https://nextjs.org/docs/app/guides/lazy-loading) states that
   deferring Client Components and imported libraries reduces the JavaScript needed to render a
   route, while Server Components are automatically code split.
2. [Next.js package-bundling guidance](https://nextjs.org/docs/pages/guides/package-bundling)
   explains that smaller bundles reduce transfer and JavaScript execution cost and improve Core
   Web Vitals.
3. The stable App Router, Client Component, production-manifest, and `next build` surfaces already
   used by this Next.js 15 application are sufficient; the Next.js 16 experimental analyzer is not
   required for a protected production gate.

### Adopted decisions

1. Keep one server data loader for selected-portfolio resolution and Gateway-backed shell, summary,
   and detailed records.
2. Keep one reusable client shell for business title, portfolio identity, navigation, evidence,
   KPIs, and unavailable posture.
3. Give each record route a task-owned Client entry point so only its workspace and dependencies
   enter the initial graph.
4. Use one layout-stable, screen-reader-announced loading frame and one keyboard-native retry frame
   with business language across all five tasks.
5. Inspect deterministic Next.js production artifacts after every build, report raw initial client
   JavaScript for all five routes, require AG Grid for the three grid tasks, and forbid it for
   Cashflow and Income.

### Rejected decisions

1. Five copied page shells or data-loading implementations.
2. A single client dispatcher that statically imports all business workspaces and branches only
   after hydration.
3. Framework, grid, chart, or backend replacement for a frontend module-graph defect.
4. Next.js 16 experimental bundle analysis in the protected Next.js 15 build.
5. Compression-only evidence, a blank transition region, an indefinite spinner, or technical
   service/error wording in the primary recovery path.

### Expected measurable improvement and publication decision

The production build moved Cashflow First Load JS from 1.31 MB to 988 kB (24.6% reduction) and
Income from 1.31 MB to approximately 980 kB (25.2% reduction). The raw initial-JavaScript report records 3.07 MB
for Cashflow and 3.04 MB for Income, with no AG Grid marker in either initial graph; Allocation,
Positions, and Transactions retain their required grids. Focused tests cover preserved task
behavior, all five loading/error identities, accessible recovery, and budget failures.

This changes frontend architecture and build governance, so repository context, the codebase review
ledger, and `docs/architecture/portfolio-record-route-bundle-governance.md` are updated. It does not
change a supported feature, route, API, operator command, or business procedure, so no README,
runbook, or repo-authored wiki source change is required.

## Idea Advisor Action Business Reasons And Persistence Proof

### Business job

An advisor reviewing an opportunity must record why a review, feedback outcome, or conversion
intent was taken without memorising service codes or typing uncontrolled technical values. The
workstation must confirm the action only when the source system proves it was persisted and the
advisor is looking at refreshed queue and candidate posture.

### Current-practice research

Research was refreshed on 2026-08-09 from authoritative interface guidance:

1. [W3C form-label guidance](https://www.w3.org/WAI/tutorials/forms/labels/) requires explicit,
   programmatic labels so controls remain understandable and operable with assistive technology.
2. [GOV.UK select guidance](https://design-system.service.gov.uk/components/select/) recommends a
   native select when users choose from a short, known set and requires clear label and hint text.
3. [MUI select accessibility guidance](https://mui.com/material-ui/react-select/#accessibility)
   requires the select to be associated with a visible label.

### Adopted decisions

1. Present source candidate reasons that are meaningful decision bases, translated into concise
   private-banking business language; use the governed `review_required` fallback when a candidate
   publishes no usable decision basis.
2. Use a visible, explicitly associated, keyboard-native select for the short candidate-scoped set.
3. Add the source-valid audit reason implied by the selected action; do not ask the advisor to manage
   service taxonomy.
4. Require `accepted` or idempotent `replayed` source persistence before success, then await both
   source queue and candidate-detail refresh.
5. Expose persistence failure, recorded-but-refresh-failed, and recorded-and-refreshed as distinct
   states. Use stable machine-readable state for browser proof and concise product copy for people.

### Rejected decisions

1. Free-text reason entry, because it creates uncontrolled values and failed the closed source
   contract.
2. A 44-option technical enum or autocomplete, because most values are internal scoring, queue, AI,
   or control evidence rather than an advisor's decision basis.
3. A hidden fixed reason, because it would remove advisor context and produce weak audit evidence.
4. Treating any HTTP `2xx` as persistence proof or showing success before queue/detail refresh.
5. Keeping a brittle browser assertion tied only to one full success sentence.

### Expected measurable improvement and publication decision

Focused tests prove exact source-vocabulary alignment, business-option filtering, accessible
selection, deterministic action/audit pairing, accepted source persistence, delayed success until
refresh, explicit failure, exact retry, and stable browser state. This changes a supported workflow,
public validation semantics, operator proof, and repository truth, so repository context, the
codebase review ledger, canonical runtime runbook, and Workbench wiki source are updated. Publish
the authored wiki after merge and verify strict parity.

## Advisor Own-Book Scan Hierarchy And Paged-Scope Truth

### Business job

A relationship manager needs to find one confirmed portfolio assignment quickly, understand
whether each count describes the filtered result or only the current page, and reorder or reset the
working view before continuing into Portfolio Review. The screen must remain useful when the source
publishes only portfolio and client references rather than governed business names.

### Current-product research

Research was refreshed on 2026-08-09 from official product sources:

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   connects Book Insights, business oversight, advisor workflow, and portfolio management while
   keeping their operating purposes distinct.
2. [BlackRock manage business at scale](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/manage-business-at-scale)
   emphasises systematic book monitoring, shared analytics, and action from client-account
   opportunities.
3. [Salesforce Financial Services Cloud for Wealth Management](https://help.salesforce.com/s/articleView?id=sf.fsc_admin_landing_wealth.htm&language=en_US)
   starts advisor workflows from governed customer profiles, groups and relationships, alerts,
   tasks, and action plans.
4. [Morningstar Direct Advisory Suite](https://www.morningstar.com/business/products/direct-advisory-suite)
   connects client and prospect management with portfolio monitoring, planning, proposals,
   research, and reporting.

These sources guide operating hierarchy only. Lotus does not copy competitor layout, visual
identity, wording, scoring, household models, or unsupported capabilities.

### Adopted decisions

1. Keep the portfolio register as the dominant surface and make Portfolio Review the primary row
   handoff.
2. Separate filtered-result portfolio count from portfolios, clients, and assignment evidence shown
   on the current page.
3. Put exact client reference, mandate, sort field, and direction into one keyboard-native toolbar
   with one apply action and a governed-date-preserving clear action.
4. State the exact result range and active view immediately above the register.
5. Present identifiers explicitly as portfolio and client references until a governed source owns
   business names; retain assignment evidence without promoting it over the advisor's scan task.
6. Give the reusable summary metric strip an auto-fitting dense-column default rather than leaving
   every screen to invent its own metric layout.
7. Continue failing closed for permission, contract drift, source failure, and unconfirmed book
   membership without substituting the global catalogue.

### Rejected decisions

1. Browser-created client or portfolio names, identifier-derived names, or hiding identifiers before
   governed business identity exists. Core #930 owns that source contract.
2. Locally aggregated AUM, households, team or delegated scope, attention ranking, recommendations,
   favourites, or next-best action.
3. Treating current-page active or client counts as whole-book measures.
4. Mixed immediate and submitted filters, a fixed hidden sort direction, or page-local reset logic
   that drops the governed business date.
5. A card mosaic, decorative dashboard, or copied competitor composition around a record-finding
   workflow.

### Validation and publication decision

Workbench issue #567 governs the implementation and Core #930 owns future business identity
enrichment. Focused view-model, API, and component tests cover paged-scope measures, reference
labels, descending sorting, one-action apply, clear-view recovery, and source-failure boundaries;
responsive production-browser and full repository evidence remain part of the issue lifecycle.
The supported Advisor Book workflow now exposes sort direction and clear-view behaviour, so
`wiki/Advisor-Book-Workflow.md` is updated and must be published from repo source after merge.

## Canonical Home Entry And Legacy Suite Retirement

### Business job

A private banker should enter one trusted workstation Home, understand the governed scope of their
work, and continue into a supported task. A compatibility URL must not expose a second dashboard
with invented clients, figures, priorities, owners, or role state.

### Current-product research

Research was refreshed on 2026-08-09 from official product sources:

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   connects Book Insights, Advisor Nudges, Whole Portfolio View, Next Best Action, portfolio
   management, and oversight through one platform while keeping their source responsibilities
   distinct.
2. [Morningstar Office overview](https://admainnew.morningstar.com/webhelp/Morningstar/Advisor_Workstation_Office_Edition_Overview.htm)
   starts Home from the advisor's practice, clients, appointments, market context, and investment
   alerts, then moves into account-level portfolio management and reporting.
3. [Salesforce Analytics for Wealth Management](https://help.salesforce.com/s/articleView?id=ind.fsc_use_einstein_financial_services.htm&language=en_US&type=5)
   starts an advisor from their book of business, changes, attention signals, and client-level
   action rather than an ungoverned technical dashboard.

These sources guide workflow hierarchy only. Lotus does not copy competitor layout, visual
identity, wording, ranking, client models, or unsupported capabilities.

### Adopted decisions

1. Maintain one canonical Home composition and make legacy entry paths thin aliases.
2. Require source-owned book, priority, ownership, urgency, and analytics state before rendering a
   business claim.
3. Keep the Home reading order oriented around scope, attention, preparation, and direct task
   handoff once authenticated authority is available.
4. Keep service health, policy identifiers, and support diagnostics in secondary governed evidence
   rather than the primary advisor reading path.
5. Remove unsupported prototype code and its styles instead of polishing a misleading surface.

### Rejected decisions

1. Hard-coded demo clients, portfolios, proposal ids, figures, queues, owners, urgency, or role
   selection in a production route.
2. A card mosaic that repeats navigation without advancing a business task.
3. Locally inferred advisor identity, role, priority, or recommendation.
4. Technical service names, strict-mode flags, policy rule ids, and allowed sections as dominant
   advisor content.
5. Replacing the retired prototype with another unauthenticated Home while #470's source-authority
   dependency remains unresolved.

### Validation and publication decision

Issue #573 owns the bounded removal; #470 continues to own the future authenticated advisor-first
Home, and #140 owns the Gateway-backed DPM command center. Route, source-governance, CSS-ratchet,
and production-browser tests must prove `/suite` follows the canonical Home without an intermediate
fabricated paint at desktop and narrow widths. Because route and supported-surface truth change,
the RFC record, repository context, review ledger, and repo-authored wiki are updated and must be
published from main after merge.

## Review-Controlled Portfolio Intake

### Business job

A portfolio administrator or investment-operations user should prepare one bounded data request,
understand every validation gap, check the exact information that will be published, and see a
source-owned receipt only after the Gateway/Core action succeeds.

### Current-product research

Research was refreshed on 2026-08-09 from official guidance:

1. [Salesforce Financial Services client intake and verification](https://trailhead.salesforce.com/content/learn/modules/customer-onboarding-in-financial-services-cloud/configure-onboarding)
   separates collection from verification, permits prefill only from CRM or integrated source
   context, and emphasizes traceable responses, documents, and repeatable review work.
2. [GOV.UK Check answers](https://design-system.service.gov.uk/patterns/check-answers/) requires a
   review immediately before a small or medium transaction, retained answers when editing, and an
   action-specific submit control; its stated outcomes are higher confidence and lower error rates.
3. [GOV.UK validation recovery](https://design-system.service.gov.uk/patterns/validation/) requires
   errors to say what is wrong and how to fix it while minimizing avoidable rejection through clear
   questions and tolerant input.
4. [IBM progressive disclosure](https://www.ibm.com/docs/en/technical-content?topic=practices-progressive-disclosure)
   recommends exposing only what the current task needs, maintaining a clear trail, and not
   repeating guidance across layers.
5. [IBM Carbon pagination](https://carbondesignsystem.com/components/pagination/usage/) places
   pagination below its related content and keeps items-per-page context, visible range and total,
   current page, total pages, and previous/next navigation explicit; its responsive pattern retains
   range, total, and navigation when space is constrained.
6. [W3C ARIA26](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA26) identifies `aria-current` as
   the machine-readable way to expose the current item in a paginated sequence.
7. [MDN `content-visibility`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/content-visibility)
   documents browser rendering deferral, but it does not provide a user-visible range, location,
   navigation model, or bounded DOM contract by itself.

These sources guide task sequencing and control safety. Lotus does not copy their visual identity,
product data model, compliance decisions, automation, or unsupported source capabilities.

### Adopted decisions

1. Require an explicit task choice and start every manual task blank.
2. Treat portfolio, position, transaction, instrument, price, and file requests independently.
3. State every missing or invalid field/row directly; do not compress safety into a percentage.
4. Hold one exact reviewed payload and idempotency key; invalidate both when material data changes.
5. Parse a selected file into review state without mutation.
6. Accept success only from a validated source envelope with exact counts for every nonempty
   reviewed record family, including business dates, plus bounded correlation/contract evidence.
7. Keep catalog availability secondary to the business form and preserve explicit manual recovery.
8. Use one responsive semantic DOM and route-scoped CSS rather than duplicated desktop/mobile
   rendering branches.
9. Retire a previously parsed file immediately when its replacement starts parsing; keep review
   unavailable until the replacement payload is complete and fence every late source completion.
10. Treat publication click through source outcome as one immutable intent. Keep the reviewed
    details visible, natively disable only publication-affecting controls, expose a concise live
    progress state, and restore the same reviewed intent for exact retry after source failure.
11. Normalize supported manual and file values through one typed domain boundary before validation
    and review. Trim boundary whitespace, canonicalize only governed code forms, and make review,
    idempotency, Gateway publication, and receipt reconciliation consume that same projection.
12. Keep large record families closed until an operator requests detail, project only ten records
    at a time in source order, and give every family independent range, page, and previous/next
    controls. Preserve one complete normalized publication payload: review pagination must never
    truncate, reorder, or repurpose source data.
13. Keep server-rendered task actions natively disabled and expose the chooser as busy until the
    client has committed its interaction handlers. Accept the first ready action without relying
    on a repeated click, timeout, retry loop, or optimistic task state.

### Rejected decisions

1. Production-looking demo defaults, copied rows, first-paint mutation, or automatic submission.
2. Fake wizard steps for independent commands, arbitrary readiness percentages, and static
   pipeline-health claims.
3. Internal UX notes, raw service/catalog posture, or technical response vocabulary as dominant UI.
4. Success from HTTP status or a TypeScript cast without relevant source publication evidence.
5. Claims that publication activates a portfolio or completes valuation, reporting, analytics,
   lineage, or durable ingestion work.
6. Validation against a trimmed copy while reviewing or publishing raw input, input-control-only
   cleanup that file import can bypass, or reliance on undocumented Gateway/Core coercion.
7. Arbitrary file-size limits, infinite scrolling, eager hidden card construction, or
   `content-visibility` as the sole capacity control. These approaches either discard supported
   work, hide location and total scope, or retain an unbounded review structure.

### Validation and publication decision

Workbench #575 owns the UI workflow. #436 continues to own authenticated principal resolution; no
acting identity is invented here. Gateway/Core retain source validation, persistence, replay,
duplicates, lineage, and durable-job authority. Focused domain/API/integration proof and isolated
desktop/narrow browser evidence cover blank first paint, exact validation, review-only submission,
edit invalidation, same-intent retry, blank row creation, file parse-before-publish, replacement-file
retirement, complete source-count proof, focus movement, compact record drilldown, and no overflow.
Issue #579 additionally proves that draft fields, task changes, row operations, file replacement,
edit, and duplicate publication remain unavailable while a source write is unresolved, without
hiding the reviewed request or presenting success before source confirmation.
Issue #581 proves the operational file path above, at, and below the ten-record page boundary. Its
isolated production-browser proof covers desktop, tablet, and narrow viewports; keyboard paging;
bounded rendered-card count; independent family state; exact source order; and one complete
Gateway-envelope publication containing every imported row.
Issue #627 proves the page-readiness boundary from server HTML through the first committed task
transition. Focused optimized-production evidence covers Create Portfolio and Import File at
desktop and 390px, requires native-disabled server actions, accepts one ready click, verifies the
correct editor and no horizontal overflow, and permits no console or page errors. The dedicated
Portfolio Intake screen guide removes the corresponding #605 exception and records the complete
business workflow, source authority, degraded states, boundaries, handoffs, and support posture.
Repository context, historical RFC truth, review ledgers, and Supported Features change in the same
issue and must be published from main after merge.

## Cross-screen exclusive choices and true tabs

### Business job

Advisors and portfolio specialists repeatedly change period, basis, grouping, chart, and review
dimension without leaving the current analytical task. Those controls must be dense and fast while
remaining predictable to keyboard and assistive-technology users. A genuine tab is different: it
navigates among named content panels within one contribution-detail region.

### Standards research

Research was reviewed on 2026-08-10 from primary design-system and accessibility sources:

1. [W3C ARIA APG tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) defines a tab as a control
   associated with a `tabpanel`, with one tab stop and arrow/Home/End navigation.
2. [W3C ARIA APG radio group](https://www.w3.org/WAI/ARIA/apg/patterns/radio/examples/radio/)
   defines one-of-many selection through `radiogroup` / `radio`, roving focus, arrow navigation,
   and checked state.
3. [IBM Carbon content switcher](https://carbondesignsystem.com/components/content-switcher/usage/)
   distinguishes alternate views or filtering of related content from tabs that organize distinct
   content sections.
4. [IBM Carbon tabs](https://carbondesignsystem.com/components/tabs/usage/) reinforces tabs as
   navigation between related content panels and a single keyboard tab stop.

These sources inform semantics and interaction behavior only. Lotus retains its own visual system,
business vocabulary, supported controls, and source-backed workflow boundaries.

### Adopted decisions

1. Period, basis, dimension, grouping, horizon, and visualization choices use the shared
   `WorkbenchChoiceGroup` radio-group contract.
2. Each group has one tab stop; arrow keys wrap across enabled choices; Home and End select the
   first and last enabled choices; disabled choices remain discoverable but cannot activate.
3. Performance contribution detail alone keeps `ModeTabs`, because each choice controls a stable,
   labelled tab panel.
4. Shared interaction presentation is colocated with the design-system primitive; Portfolio and
   Performance own only bounded layout adaptations in feature CSS Modules.
5. Standard density retains a 44-pixel outer target; compact analytical toolbars retain explicit
   focus treatment and keyboard parity while preserving the dense workstation rhythm.

### Rejected decisions

1. Fake `tablist` / `tab` roles for controls that only redraw or filter one analytical surface.
2. A binary use of the choice group; binary states need a governed toggle or switch pattern.
3. Page-local copies of keyboard logic, selected-state CSS, or focus treatment.
4. A new component library or styling framework for an interaction already supported by React,
   semantic HTML, ARIA, and the Workbench token system.
5. Keeping dormant selector families as compatibility CSS after all production consumers have
   migrated.

### Validation and publication decision

Workbench #588 owns the migration. Focused component tests prove radio-group and true-tab semantics,
one tab stop, disabled-choice behavior, and source consumer updates. Portfolio cash-movement and
Performance contribution browser flows carry the representative production proof. This corrects
interaction semantics and CSS ownership without adding a supported business capability or changing
an operator procedure; repo-local wiki source is intentionally unchanged.

## Action-first Advisory Overview

### Business job

A relationship manager should open one portfolio, understand which visible proposal needs attention,
and move that recommendation through review, client discussion, and implementation without scanning
a second catalogue of every Advisory route. When Gateway returns a paginated source window, the
advisor must understand that visible counts and ranking are not complete book totals.

### Current-product research

Research was refreshed on 2026-08-10 from official product and accessibility sources:

1. [BlackRock Aladdin Wealth proposal generation](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/proposal-generation)
   organizes advisory proposal work from Identify through Construct and Deliver to Implement, with
   firm and client criteria, suitability checks, and whole-portfolio analytics embedded in the
   workflow rather than exposed as a route catalogue.
2. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   describes Book Insights, Next Best Action, advisor nudges, and flexible proposal generation as
   connected ways to surface accounts needing timely action and move them toward implementation.
3. [GOV.UK Complete multiple tasks](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/)
   recommends simplifying first, grouping related actions, using task-oriented labels, and exposing
   meaningful status when a journey genuinely spans multiple sessions.
4. [W3C WCAG 2.2 focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
   requires sequential focus to preserve meaning and operability and recommends that focus reinforce
   the reading order implied by the visual layout.

These sources inform workflow hierarchy and interaction semantics only. Lotus retains its own visual
system, source contracts, private-banking language, lifecycle authority, and control boundaries.

### Adopted decisions

1. Make the current advisor decision and source-backed worklist the operating centre of the screen.
2. Keep `PortfolioScreenRail` as the single owner of route navigation; replace the duplicate
   Advisory Journey catalogue with one compact lifecycle posture.
3. Use Identify, Construct, Review & discuss, and Implement as business handoffs. Identify links to
   the source-backed Ideas workspace without inventing a count; the other stages count only mapped
   proposal states visible in the current Gateway window.
4. Request eight proposals per source window, rank only within that window, expose explicit
   previous/next controls, and keep the workflow context partial whenever a continuation or earlier
   window exists.
5. Publish loading, permission, unavailable, refreshing, refresh-failure, empty, partial, and ready
   source posture through existing reusable Workbench state and workflow-context contracts.
6. Remove the redundant portfolio column from the portfolio-scoped table and convert rows into
   labelled review cards at compact width while preserving one semantic table DOM.
7. Keep stable browser evidence contracts on the workspace, lifecycle summary, worklist, and source
   window rather than coupling validation to one complete sentence.

### Rejected decisions

1. A card for every Advisory destination: the persistent rail already owns navigation, and repeating
   it consumes the space needed for real work.
2. A fabricated Identify count, book-wide urgency score, SLA, recommendation, or proposal total:
   the existing Gateway list publishes proposal records and a continuation cursor, not those claims.
3. Treating the current page as the full portfolio or automatically traversing every cursor: both
   hide source scope and can make an incomplete worklist look clear.
4. A desktop-only wide table or duplicated mobile renderer: one semantic table becomes compact cards
   through the feature-owned CSS Module without page-level horizontal overflow.
5. Moving proposal fetching into the shell or silently selecting a row for the context rail: the
   owning screen publishes queue-level posture, while record-specific evidence remains behind an
   explicit proposal selection.

### Validation and publication decision

Workbench #591 owns this bounded screen slice. Focused model and integration tests cover priority
ordering, lifecycle mapping, complete and partial source windows, source failure, and permission
boundaries. Isolated Playwright proof covers 1440, 1024, and 519 pixel widths, explicit cursor
navigation, duplicate-catalogue absence, stable evidence ids, and zero page-level horizontal
overflow, with captures under `output/issue-591/`. The change uses the existing Gateway proposal
contract and does not change supported capability or operator procedure, so repo-local wiki source
is intentionally unchanged.

## Decision-first Proposal Review And Progressive Evidence

### Business job

An advisor reviewing a proposal needs to establish what changed, understand the portfolio impact,
resolve the next governed review step, and prepare an advisor-use narrative or memo without losing
source evidence. Audit and lineage material must remain available, but it should not force the
advisor to read implementation vocabulary or traverse every historical record before making the
current decision.

### Current-product research

Research was refreshed on 2026-08-10 from official product, service-design, and accessibility
sources:

1. [BlackRock Aladdin Wealth proposal generation](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/proposal-generation)
   connects portfolio construction, risk analytics, suitability controls, and proposal delivery in
   one workflow, supporting a decision hierarchy rather than a catalogue of disconnected evidence.
2. [BlackRock governed AI commentary](https://www.blackrock.com/aladdin/discover/blog/ai-enabled-investor)
   frames generated commentary as a governed drafting aid whose traceability and human review must
   remain visible; Lotus therefore keeps narrative and memo work advisor-use and source-evidenced.
3. [GOV.UK Check answers](https://design-system.service.gov.uk/patterns/check-answers/)
   recommends grouping related information, making change paths explicit, and using the review
   screen to help a person confirm the material facts before submission.
4. [WAI-ARIA Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
   provides the keyboard and state model for evidence that remains available without occupying the
   primary decision surface.
5. [WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
   requires important success and error information to be programmatically determinable without
   moving focus, supporting a stable status region after source persistence and refresh.

These sources inform hierarchy, interaction, and evidence presentation only. Gateway and its source
services remain authoritative for proposal state, approvals, lineage, narrative, memo, delivery,
and action persistence.

### Adopted decisions

1. Give proposal identity and lifecycle one owner, followed by the next decision, current posture,
   proposed changes, allocation impact, and review gates.
2. Treat Narrative and Memo as peer review modes using true tabs with stable, mounted tab panels so
   switching modes does not discard in-progress advisor work.
3. Keep version, lineage, replay, and review history available through native progressive
   disclosure instead of permanently expanding technical evidence.
4. Settle primary proposal detail independently from workflow, approval, and lineage reads; retain
   usable source evidence and name each unavailable ancillary source rather than replacing the
   entire screen.
5. Translate source state, event, approval, and actor codes into business-facing vocabulary while
   retaining raw values only in bounded diagnostic or evidence contracts.
6. Announce action success only after Gateway persistence succeeds and detail, workflow, approval,
   and lineage posture refresh coherently from source-owned responses.
7. Use stable semantic evidence (`role="status"` and a durable test id) rather than pinning browser
   proof to a complete sentence that product copy may legitimately refine.

### Rejected decisions

1. A cosmetic copy pass over the existing stacked layout: it would preserve duplicated hierarchy
   and all-or-nothing failure behavior.
2. Hiding audit evidence entirely: bank-operable review needs source traceability even when that
   material is secondary to the advisor decision.
3. Optimistic success after the mutation alone: accepted persistence without refreshed proposal
   posture is insufficient user-visible proof.
4. Inventing client, advisor-role, suitability, approval, client-ready, communication, or execution
   authority in Workbench; the production principal boundary remains governed by #436.
5. Adding a new styling framework, tab library, or Gateway shape when existing Workbench primitives
   and source contracts support the required behavior.

### Validation and publication decision

Workbench #593 owns this bounded slice. Focused unit and integration proof covers business
vocabulary, true-tab semantics, closed-by-default evidence, ancillary-source degradation, action
success after source refresh, safe mutation failure, refresh-failure success suppression,
duplicate-command fencing, and proposal-identity reset. Isolated Playwright proof covers source
partial, source-refreshed success, safe failure, keyboard tab focus, reduced motion, 1440, 768, 640
(a 1280-pixel browser at 200% reflow equivalent), and 519 pixel widths, stable status and disclosure
evidence, the persistent action path, and zero page-level horizontal overflow, with captures under
`output/issue-593/`. The change uses existing Gateway contracts and does not widen authentication,
client-release, or execution authority. Repo-local `wiki/API-Surface.md` changes because the
supported Proposal Detail operating and evidence posture changed; the README remains intentionally
unchanged because repository role, commands, and navigation are unchanged.

## Explicit Suitability Review Selection And Evidence Binding

### Business job

A client advisor, compliance reviewer, or supervisor works through every suitability policy
evaluation that needs attention for the selected portfolio. They must be able to choose a proposal,
confirm exactly which proposal version and evaluation the displayed evidence belongs to, identify
the current blocker and required next step, and request further evidence without acting on a
different record. The screen presents source-owned review evidence; it does not perform suitability
assessment or grant sign-off authority.

### Current-product research

Research was reviewed on 2026-08-10 from official regulatory, product, and design-system sources:

1. [ESMA MiFID II Article 25](https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mifid-ii/article-25-assessment-suitability-and)
   requires suitability to be assessed against the specific client's knowledge and experience,
   financial situation, ability to bear losses, objectives, and risk tolerance. This makes
   recommendation-specific record identity material, not decorative metadata.
2. [FCA COBS 9/9A](https://handbook.fca.org.uk/handbook/COBS/9A.pdf) requires suitability assessment
   and reporting for the recommendation or portfolio management service. Lotus therefore keeps
   evidence visibly bound to one proposal version and one source evaluation.
3. [BlackRock Aladdin Wealth proposal generation](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/proposal-generation)
   places firm and client criteria, suitability and pre-trade checks, and whole-portfolio analytics
   inside the Identify → Construct → Deliver → Implement proposal workflow.
4. [Carbon Data Table usage](https://carbondesignsystem.com/components/data-table/usage/) uses
   explicit single-row selection when a user must act on one record and progressively discloses
   supporting detail.
5. [GOV.UK Task List](https://design-system.service.gov.uk/components/task-list/) pairs each
   actionable task with its status and makes the whole row an operable target, supporting a compact
   worklist before record detail.

These sources inform record selection, information hierarchy, and interaction only. Gateway and
Advise remain authoritative for policy evaluation, rules, requirements, workflow, sign-off,
client-publication posture, and persistence.

### Adopted decisions

1. Use an explicit single-record worklist with visible `Selected` text, selected styling that does
   not depend on colour alone, pointer selection, and roving Arrow Up/Down/Home/End keyboard focus.
2. Preserve an explicit evaluation across source reorder; visibly choose the first available record
   only when no explicit selection exists or the selected record leaves the queue.
3. Scope selected detail caches and mutation feedback by portfolio plus evaluation so a portfolio
   switch or late completion cannot publish a superseded record's posture.
4. Show proposal, proposal version, policy pack, current status, requirements, evidence posture,
   and next action in the worklist; repeat the selected proposal/version once as the detail-pane
   identity boundary.
5. Put the required next step, current policy posture, source evidence, blockers, sign-off package,
   and review SLA before secondary control and audit detail.
6. Keep dependencies, source references, and outstanding gaps available through native progressive
   disclosure.
7. Use a container-safe full-width worklist and evidence pane because the persistent navigation and
   context rail make the centre workspace narrower than the browser viewport.

### Rejected decisions

1. Silent first-row detail and action binding: source reorder can change the acting record without
   advisor intent.
2. A wide six-column queue table followed by a detached evidence panel: it obscures the selected
   relationship and relies on horizontal scanning at compact widths.
3. A two-column master-detail layout chosen only from viewport width: persistent Workbench rails can
   compress the actual content container even on a large desktop.
4. Card-per-fact dashboard composition: it gives every evidence field equal weight and delays the
   business decision.
5. Browser-owned suitability calculation, approval, waiver, client-ready publication, direct
   Advise calls, or production identity work.

### Validation and publication decision

Workbench #595 owns the slice. Focused selector, view-model, and integration proof passes 29 tests,
including selection across reorder and removal, second-record keyboard selection, record-specific
detail/package/workflow calls, record-specific evidence-request payload, late first-record response
abandonment, stale mutation-success suppression, and fail-closed mixed-source identity handling.
TypeScript and focused ESLint pass. An
isolated production-browser test on a dedicated port passes at 1440 and 390 pixels, proves the
second-record action, zero page-level overflow, and attaches desktop/mobile evidence under
`playwright-report/data/`. No Gateway contract changed. `wiki/Supported-Features.md` changes because
the supported Suitability Review operating behavior now includes explicit multi-record selection
and stale-completion fencing; README and operator runbooks remain intentionally unchanged because
repository role, commands, and runtime procedure did not change.

## PM Operating Quality Supervisory Record Context

### Business job

An investment-control supervisor reviews portfolio-manager quality runs, fairness evidence, and
recorded supervisory actions. They must be able to select the exact source record, compare its
business posture, inspect its evidence, and know that the support-summary, remediation, and summary
invocation commands will use that same record. Workbench supports the supervisory workflow; it does
not calculate PM quality, rank portfolio managers, make conduct or HR decisions, or initiate client
communication or investment execution.

### Current-product research

Research was reviewed on 2026-08-10 from official product and design-system sources:

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   describes connected data, centralized risk and oversight, and outlier monitoring across a book
   of business. Lotus therefore keeps source record identity and supervisory posture together.
2. [SAP Fiori worklist](https://experience.sap.com/fiori-design-web/worklist-sap-fiori-elements/)
   separates a task-oriented record worklist from the object page used to inspect and act on one
   selected business object.
3. [Microsoft list/details pattern](https://learn.microsoft.com/windows/apps/develop/ui/controls/list-details)
   keeps selection visible while related detail changes and adapts the composition to narrower
   content regions.
4. [IBM Carbon data-table usage](https://carbondesignsystem.com/components/data-table/usage/)
   requires explicit single selection when an action applies to one row and keeps action scope
   understandable.
5. [Fluent list usage](https://fluent2.microsoft.design/components/web/react/core/list/usage) and
   the [WAI-ARIA listbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/) provide the
   selected-state, roving-focus, Arrow, Home, and End interaction model.

These sources inform workflow, information hierarchy, and interaction only. Gateway and Manage
remain authoritative for quality runs, fairness analyses, review actions, dates, policy posture,
reason codes, source references, and persistence.

### Adopted decisions

1. Put one compact supervisory record context before detail and command areas, with separate
   single-selection worklists for quality runs, fairness reviews, and supervisory actions.
2. Show business identity, status, as-of date, policy or target context, and the action relationship
   on each selectable record; keep the non-colour `Selected` state explicit.
3. Preserve an explicit selection across source reorder and fall back to the first available record
   only when the selected source record leaves the returned collection.
4. Load selected fairness and review detail through Gateway, fence late responses by request
   sequence and exact three-record selection, and suppress superseded completion.
5. Make the selected quality run and review action the only source for support-summary and summary
   invocation commands; make target type choose between the already-selected quality and fairness
   records rather than introducing a fourth id selector.
6. Remove duplicate record ledgers and id dropdowns after the reusable selection surface owns the
   relationship; retain segment and invocation-history tables because they answer different
   business questions.
7. Use a container-safe auto-fitting layout and colocated CSS Module so the centre workspace can
   reflow independently of the browser viewport and without adding global selector debt.

### Rejected decisions

1. Silent first-record projection, because source ordering can change without supervisor intent.
2. A disconnected dropdown-only context, because it hides the selected record's posture and next
   action while separating identity from evidence.
3. Keeping both the new worklist and the old ledgers/id selectors, because two selection models can
   disagree and add dead duplication.
4. A card mosaic or decorative dashboard, because this is a dense oversight workflow with a clear
   record-to-evidence-to-action sequence.
5. Browser-side PM scoring, fairness calculation, ranking, HR or conduct decisions, suitability,
   client contact, orders, OMS, execution, fills, or settlement.

### Validation and publication decision

Workbench #596 owns the slice. Focused selector, command-model, hook, view-model, component, panel,
and Gateway-create integration proof passes 63 tests, including second-record keyboard and pointer
selection, reorder and removal, selected-detail fetching, stale-response fencing, source date
binding, and second-record command payloads. TypeScript, targeted ESLint, CSS governance, diff
integrity, the optimized production build, all 25 routes, and portfolio-record bundle budgets pass.

Isolated production-browser proof against the process-owned PM-quality fixture confirms all three
second records can be selected independently, exactly three listbox options expose selected state,
Arrow Down moves focus and selection together, selected fairness and review detail reads return 200,
review readiness follows `pmq_fair_002`, summary readiness follows `pmq_run_002` and
`pmq_review_002`, and page-level horizontal overflow remains absent at 1440, 1024, and 390 pixels.
The only fixture console error is the deliberately unsupported platform-capabilities preload; the
touched PM-quality requests and React runtime remain successful. Evidence is recorded under
`output/playwright/issue-596-pm-quality/`, including desktop, compact-desktop, and mobile captures.

The supported route and source contracts are unchanged. `wiki/Supported-Features.md` is updated
because the supported operating behavior now includes explicit multi-record supervisory selection,
record-bound detail and commands, and stale-completion fencing. README, runtime runbooks, central
context, and skills remain intentionally unchanged because repository role, startup procedure,
cross-repository ownership, and governed delivery rules did not change. The exact-worktree
`make check` gate passes zero-vulnerability audits, CSS and architecture governance, ESLint,
TypeScript, 343 files and 2,002 tests at 91.57% statement/line coverage, the optimized 25-route
production build, and all portfolio-record bundle budgets. Protected CI, merge, exact-main, and
wiki-publication evidence remain required before closure.

## PM Operating Quality Post-Persistence Record Continuity

### Business job

After recording a fairness review or supervisory action, an investment-control supervisor may need
to compare it with another source record and return to it immediately. The confirmed record must
remain available during the short interval before Manage's canonical list refresh includes it.

### Current-product research

Research was reviewed on 2026-08-10 from official engineering sources:

1. [React state structure](https://react.dev/learn/choosing-the-state-structure) recommends avoiding
   duplicated state that must be synchronized. Workbench therefore keeps the returned source
   response and derives the combined selector projection rather than copying fields into a second
   browser-owned record.
2. [Apollo Client mutation guidance](https://www.apollographql.com/docs/react/data/mutations)
   documents the broader create-mutation problem: a returned entity is not automatically present
   in an already-loaded list. Workbench adopts the identity-based projection principle without
   introducing Apollo or a new cache dependency.

### Adopted decisions

1. Retain every successful Gateway/Manage response by source identity until the owning list carries
   it; never create an optimistic or synthetic PM quality record.
2. Compose selected detail, preview, canonical list, and retained persisted response at the shared
   view-model boundary so both fairness and review-action selectors use one rule.
3. Deduplicate by Manage-owned fairness-analysis or review-action identity.
4. Put retained projections after the canonical list so refreshed source facts supersede them
   without duplicates, then retire every temporary response whose source identity is present;
   preserve exact selected detail when the supervisor is actively inspecting that record.
5. Prove two consecutive persists, select-away, reselect, canonical refresh, and source supersession
   below the browser layer so the lifecycle cannot regress behind a visually plausible selector.

### Rejected decisions

1. Fabricating a browser record from the create request, because source persistence and returned
   facts must be confirmed first.
2. Mutating the parent response object, because it blurs source ownership and creates synchronization
   debt.
3. Adding Apollo, TanStack Query, or another cache framework for this bounded state-composition gap.
4. Clearing the retained response merely because another record is selected, because that recreates
   the observed workflow break.

### Validation and publication decision

Workbench #603 owns the slice. The Gateway contract, supported-feature scope, visual composition,
operator procedure, README, wiki source, central context, and skills do not change. Focused and
aggregate evidence were green before exact-head review: the retention model and hook passed 31
focused tests, and the
exact-worktree `make check` passes 343 files and 2,007 tests at 91.58% statement/line coverage plus
the optimized 25-route build and bundle budgets. Exact-head review then strengthened the model from
one retained response per family to identity-keyed collections. Revised proof passes 32 focused
tests and React Compiler lint. Two refreshed aggregate runs each passed 2,007 of 2,008 tests but hit
the unrelated load-sensitive DPM-wave timeout tracked by #585; its exact test passes three isolated
runs. Fresh protected CI, exact-main proof, issue closure, and branch hygiene remain required before
closure.

## Proposal Detail Identity-Owned Local State

### Business job

When an advisor moves between proposals, every local review mode, disclosure, version lookup,
mutation message, and pending operation must belong to the selected proposal. Returning to a
proposal must not expose a completion message from an earlier mounted workspace, even when the
source operation itself finishes successfully.

### Current-practice research

Research was reviewed on 2026-08-10 from official React guidance:

1. [React `useRef` guidance](https://react.dev/reference/react/useRef) requires components to avoid
   reading or writing refs during render except for predictable initialization. A ref that tracks
   the latest proposal id during render is therefore not a safe identity boundary.
2. [React guidance on avoiding unnecessary Effects](https://react.dev/learn/you-might-not-need-an-effect)
   recommends resetting all state for a changed conceptual entity by giving the inner component a
   key, rather than rendering stale local state and resetting it in an Effect.
3. [React state identity guidance](https://react.dev/learn/preserving-and-resetting-state) explains
   that a changed key creates a distinct component identity and resets the complete descendant
   state tree. This matches Proposal Detail's proposal-owned local state model.

### Adopted decisions

1. Keep the exported `ProposalDetailView` as a small proposal-identity boundary and render the
   stateful workspace with `key={proposalId}`.
2. Let React discard the complete previous workspace atomically instead of coordinating ten local
   setters and three operation refs after render.
3. Preserve the established Gateway query keys and source-owned action confirmation. Keep the
   proposal-scoped source-refresh generation in the application-owned query client above both the
   keyed presentation workspace and detail-route lifetime, so a version persisted for proposal A
   remains the authoritative query generation after A→B→A and Detail→Queue→Detail journeys.
   Keying the presentation workspace does not fabricate success or cancel a persisted source action.
4. Prove A→B→A transitions for both lifecycle actions and version lookups so an old mounted
   instance cannot publish success, error, or loaded-version presentation into a new instance.
5. Synchronize tests to the business-ready control state, not merely the presence of a rendered
   button, and resolve deferred source completions inside React's observable update boundary.

### Rejected decisions

1. Moving the proposal-id ref write into an Effect, because the ref and local state would still
   have separate identity ownership and the first render would still carry the previous workspace.
2. Dispatching one reducer reset from a proposal-id Effect, because it still renders the prior
   proposal's local state before the reset and adds an avoidable cascading render.
3. Keeping per-operation expected-proposal checks as the primary fence, because duplicating identity
   checks across every future local operation is easier to omit than owning identity once at the
   workspace boundary.
4. Changing business copy, layout, Gateway contracts, or source confirmation behavior for a
   compiler/lifecycle correction.
5. Resetting the query refresh generation with presentation state, because React Query can retain
   the superseded generation as fresh for 30 seconds and an A→B→A journey could then render the
   earlier version. Invalidating only the old cache was also rejected because retaining the small
   proposal-scoped generation in the existing application query-cache owner makes the current
   source evidence explicit and avoids an unnecessary return-navigation refetch.

### Validation and publication decision

Workbench #600 owns this slice. Exact-main React Compiler proof reported two errors: a render-time
ref write and a synchronous multi-state Effect reset. The keyed boundary removes both; focused
compiler lint and normal touched-file lint pass, and the Proposal Detail integration suite passes
28/28 with explicit transition, stale-action, stale-version, refreshed-version continuity across
both proposal and route lifetimes,
action-lock, degraded-source, and failure proof and no React `act` warnings.

The visual composition, user-facing language, supported feature set, Gateway/OpenAPI contract,
runtime topology, operator procedure, README, and wiki source are intentionally unchanged. Existing
browser evidence for Proposal Detail remains representative, while protected CI and exact-main
validation remain required before closure. Existing frontend, review-ledger, and PR governance
already require identity fencing and outcome-based asynchronous proof, so no skill or context change
is justified by this bounded correction.

## Global Workspace Orientation

### Business job

A client advisor moving between allocation review, performance analysis, proposal work, and
cross-platform data-product discovery needs the shell to identify the current business workspace
without implying that a platform utility belongs to an unrelated advisory domain.

### Current-product research

Research was reviewed on 2026-08-10 from primary design-system and accessibility sources:

1. [W3C ARIA technique ARIA26](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA26) requires a
   visually identified current page to expose the same state programmatically with
   `aria-current="page"`.
2. [WAI-ARIA 1.3](https://www.w3.org/TR/wai-aria-1.3/#aria-current) defines the current item as one
   item within a related set; it is not a reason to select an unrelated item when the current page
   sits outside that set.
3. [Microsoft Fluent 2 Nav guidance](https://fluent2.microsoft.design/components/web/react/core/nav/usage)
   recommends brief, goal-oriented navigation labels and a selection indicator for the active
   destination, with roll-up only to a real containing category.
4. [Microsoft NavigationView guidance](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/navigationview)
   keeps the selected item synchronized with the current route and permits one selected item or a
   real visible ancestor, rather than a fabricated neighboring destination.

### Adopted decisions

1. Resolve shell context through one typed route authority and let the existing shared
   `WorkspaceTabNav` render its accessible current-page state.
2. Match complete route segments so `/portfolio` may own `/portfolio/...` but cannot claim a
   sibling such as `/portfolio-old`.
3. Map Allocation to the Portfolio workspace and normalize the Performance `advisor-brief` alias
   through the same canonical mode authority used by the screen.
4. Classify Data-Product Discovery as a platform utility with no active advisor workspace. The
   Gateway `shell-bootstrap.v1` contract exposes Portfolio, Performance, Risk, Proposal, and
   Advisory only; the browser must not invent a sixth workspace.
5. Bind the checked-in screen registry to a table-driven route-context test so every route
   entrypoint has an explicit decision and new routes cannot silently fall through to Home.

### Rejected decisions

1. Page-local active-state exceptions, because they duplicate global route policy and drift as new
   routes are added.
2. Highlighting Portfolio or another visible workspace on Data Products merely to avoid an empty
   current state, because that misrepresents product ownership.
3. Adding a Data Products shell descriptor or changing Gateway capability truth without a supported
   backend product contract.
4. Plain string-prefix matching, because it accepts unrelated sibling paths and weakens orientation.
5. A new navigation component or CSS override, because the existing design-system primitive already
   implements the correct semantic and visual current state.

### Validation and publication decision

Workbench #609 owns the slice. Focused route and component proof covers all 21 checked-in route
entrypoints, canonical Performance modes and aliases, sibling-prefix rejection, exactly one current
Allocation workspace, and deliberate no-workspace Data Products posture. Responsive browser proof
passes at 1366 px, 1024 px, and 390 px on an isolated production server. Exact-worktree
`make check` passes zero-vulnerability audits, CSS and architecture governance, the screen-registry
gate, ESLint, TypeScript, 344 test files and 2,050 tests at 91.6% statement/line coverage, the
optimized 25-route production build, and every portfolio-record bundle budget.

No Gateway, OpenAPI, supported-feature, README, wiki-source, operator-runbook, central-context, or
skill change is required. Existing wiki screen descriptions already classify Allocation as a
Portfolio task and Data-Product Discovery as a cross-platform utility; changing them would duplicate
this architecture record rather than correct product truth. Repository engineering context is
updated because the reusable shell route boundary changed. Strict wiki parity remains `DiffCount=0`.

## Runtime Support And Bank Technology-Risk Baseline

### Business and engineering job

Bank architecture, cyber, operations, accessibility, and procurement reviewers need one truthful
runtime baseline that distinguishes implemented supply-chain and deployment controls from future
browser, licensing, capacity, availability, identity, and approval evidence. Engineers and coding
agents need the same boundary to prevent a moving toolchain or fashionable dependency from entering
a production-critical path without review.

### Primary-source research

Research was reviewed on 2026-08-10:

1. [Node.js release lifecycle](https://nodejs.org/en/about/previous-releases) recommends Active or
   Maintenance LTS for production. Node 22 remains maintained through April 2027.
2. [The Node 22.23.1 archive](https://nodejs.org/en/download/archive/v22.23.1) records bundled npm
   `10.9.8`, providing source evidence for CI/container package-manager parity.
3. [Next.js support policy](https://nextjs.org/support-policy) classifies 15.x as Maintenance LTS,
   so retention is currently supportable but must be time-bounded.
4. [npm package metadata guidance](https://docs.npmjs.com/files/package.json/) defines `engines`,
   `devEngines`, and package-manager metadata. These are defense in depth and need repository checks;
   `engines` alone is not a fail-closed enterprise control.
5. [Next.js browser requirements](https://nextjs.org/docs/pages/getting-started/installation#supported-browsers)
   provide framework floors. [MDN Baseline](https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility)
   is useful for web-feature admission but explicitly does not replace accessibility, performance,
   security, device, or assistive-technology testing.

### Adopted decisions

1. Keep the mature current foundation and govern it; do not rewrite or upgrade merely to appear
   modern.
2. Pin protected CI to the same exact Node release as the digest-pinned container and use the npm
   bundled by that official release.
3. Preserve a Node 22/npm 10 developer compatibility range while making the protected build runtime
   exact and machine-checked.
4. Use immutable lockfile installation, exact Playwright, a repository-local browser CLI, and an
   explicit Chromium project.
5. Add an expiring machine-readable support policy to `npm run lint`, backed by tamper tests and
   buyer-facing documentation.
6. Describe standalone/service-owned state as replica-compatible architecture only. Keep browser
   breadth, load, horizontal scale, identity, availability, licensing, and bank approval as explicit
   non-claims until evidence exists.

### Rejected decisions

1. Moving immediately to Node 24 or Next 16, because current releases remain supported and a major
   upgrade without its own compatibility and rollback evidence would add risk rather than reduce it.
2. Treating a major-only CI selector as reproducible, because it can diverge from the container
   patch and bundled package manager.
3. Treating `engines`, `packageManager`, MDN Baseline, or framework browser floors as certification
   on their own.
4. Claiming a scalable production system from standalone packaging alone; measured multi-replica,
   failure, and capacity evidence is still required.
5. Closing #612 after this tranche; dependency inventory, license/admission policy, enterprise
   browser/accessibility proof, resilience decisions, capacity proof, and cross-functional review
   remain material.

### Validation and publication decision

Workbench #612 owns the broader certification and remains open. This first tranche is complete only
after focused tamper tests, TypeScript, lint, full repository gates, protected CI, exact-main proof,
wiki publication, and strict parity pass. The shared front-office runtime is intentionally untouched;
this slice changes build and governance controls rather than product or Gateway behavior.

## Proposal Builder Evaluation Navigation

### Business and engineering job

Client advisors need one coherent proposal-construction workspace: compose draft movements, request
source evaluation, inspect the result, then save a governed draft for downstream review. Navigation
must not imply that an unevaluated draft already has a separate portfolio-impact result.

### Primary-source research

Research was reviewed on 2026-08-11:

1. [BlackRock Aladdin Wealth proposal generation](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/proposal-generation)
   presents one guided journey from identification through construction, delivery, and
   implementation, with analytics and real-time checks inside construction.
2. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   integrates proposal generation, portfolio analytics, and suitability checks within the advisor
   workflow rather than treating an unavailable result as a destination.
3. [WCAG 2.2](https://www.w3.org/TR/WCAG22/) requires predictable navigation and meaningful
   keyboard/focus behavior.
4. [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
   supports announcing a successful asynchronous result without moving focus unexpectedly.

### Adopted decisions

1. Keep draft composition and Gateway/Advise evaluation in one Proposal Builder screen.
2. Render evaluation evidence only after the source call succeeds and announce it as a polite
   status update.
3. Describe a workspace as evaluated only after evaluation succeeds, not merely after creation.
4. Keep saving a governed draft dependent on a returned source proposal identity.
5. Record one canonical Proposal Builder browser check that includes source evaluation instead of
   counting the same route as two screens.

### Rejected decisions

1. A separate `#simulation` destination, because it had no route state, fragment owner, persisted
   run identity, or pre-result business content.
2. A fabricated empty simulation panel, because it would visually imply evidence before Gateway and
   Advise return it.
3. A Gateway or Advise change, because the existing contract already owns the required stateful
   workspace evaluation and handoff truth.

### Validation and publication decision

Workbench #608 owns this bounded correction. Focused proof must cover route taxonomy, evaluation
success and failure, result announcement, screen-registry reconciliation, canonical browser logic,
and desktop/narrow production-browser behavior. Repository context, the runtime runbook, the
business-facing screen catalogue, and the codebase review ledger change in the same slice. The wiki
source therefore requires post-merge publication and strict parity. Workbench #631 separately owns
portfolio-book and workspace-shell unavailable-versus-empty evidence and action gating.

## Proposal Builder Portfolio Evidence Availability and Recovery

### Business and engineering job

An advisor can construct and retain a proposal only when the workstation can distinguish a
confirmed portfolio posture from a source outage. Available or previously loaded holdings remain
valuable for diagnosis and drafting, but they cannot become current decision authority merely
because a browser fallback or manual cash field exists.

### Primary-source research

Research was reviewed on 2026-08-11:

1. [TanStack Query `useQuery` reference](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery)
   distinguishes initial load errors from refetch errors, returns the last successfully resolved
   data, exposes background fetching separately, and cancels a running refetch by default before a
   replacement refetch.
2. [TanStack Query background-fetching guidance](https://tanstack.com/query/v5/docs/framework/react/guides/background-fetching-indicators)
   separates the first hard-loading state from a background refresh indicator while retained data
   remains rendered.
3. [IBM Carbon empty-state guidance](https://carbondesignsystem.com/patterns/empty-states-pattern/)
   treats confirmed absence, first use, and system error as different contextual states and calls
   for plain-language recovery guidance when a related system cannot supply data.
4. [GOV.UK error-message guidance](https://design-system.service.gov.uk/components/error-message/)
   says service capacity or availability is not a field-validation error because the user cannot
   correct it through input.
5. [GOV.UK service-problem guidance](https://design-system.service.gov.uk/patterns/problem-with-the-service-pages/)
   requires clear service-problem copy, an actionable next step, and truthful explanation of what
   previously entered information remains available.
6. [BlackRock Aladdin Wealth proposal generation](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/proposal-generation)
   places portfolio analytics and checks inside a guided proposal-construction workflow, supporting
   evidence recovery in context rather than a disconnected technical-error destination.

### Adopted decisions

1. Use strict readers at this decision boundary while retaining tolerant readers for unrelated
   blank-safe screens; required book reads bypass browser module response reuse so intentional
   refresh reaches the BFF without a breaking global API behavior change.
2. Project both source queries through one pure, typed evidence model that reuses the shared query
   posture vocabulary and admits evaluation only from complete, usable, freshly confirmed data.
3. Keep book and workspace reads parallel so the evidence panel does not introduce a request
   waterfall.
4. Keep available or cached holdings and cash visible during partial failure or refresh failure,
   label their posture, and pause evaluation and handoff until a successful refresh.
5. Treat a returned empty positions array as a confirmed empty book. Never use source failure,
   malformed 2xx data, or `null` as equivalent empty evidence.
6. Allow advisor-entered cash to support an indicative scenario only; label it as manual and never
   use it to authorize a source-backed evaluation.
7. Provide an explicit module-level refresh, a polite status update, and stable machine-readable
   evidence state for browser proof without exposing technical status codes in primary copy.
8. Use the existing React Query, MUI, design-system components, CSS module, and governed tokens;
   this state correction does not justify another dependency or global style rule.
9. Size the dense action and order-entry controls from the centre workspace container rather than
   the browser viewport. Persistent navigation and workflow rails can leave a narrow usable column
   on a wide desktop, so component-owned container queries preserve the business workflow without
   leaking page-specific breakpoints into global CSS.

### Rejected decisions

1. Preserving the old `catch -> null -> []` chain, because it turns dependency failure into a
   credible-looking empty portfolio.
2. Attaching source availability to Portfolio ID, currency, or cash field validation, because the
   advisor cannot correct an upstream outage by editing those values.
3. Clearing cached evidence during refresh or refresh failure, because it discards useful context;
   retained evidence is instead qualified and prevented from authorizing action.
4. Letting one available source silently stand in for both holdings and cash, because a partial
   picture is not a confirmed proposal baseline.
5. Adding another cache library, global state store, polling loop, or Gateway contract solely for
   view-state projection already supported by the current Workbench architecture.
6. Blocking the entire Proposal Builder route when one source fails, because advisors can still
   inspect available context, adjust an indicative draft, and recover in place without fabricated
   decision authority.

### Validation and publication decision

Workbench #631 owns the implementation. Focused proof covers strict and tolerant API behavior,
every evidence state, empty-versus-unavailable semantics, cached refresh failure, explicit recovery,
action admission, and desktop/narrow browser behavior. Browser proof also asserts that the advisor
workflow and draft order blotter remain contained within their centre-workspace panels. Repository
context, research, and the review ledger change in this slice. No wiki source changes: #605 already
owns the dedicated Proposal Builder screen guide, and this correction does not change the screen's
business purpose, navigation, source authority, or supported action set.

## Proposal Builder Date-Consistent Portfolio Evidence

### Business and engineering job

An advisor must construct, evaluate, and retain a proposal against one identifiable portfolio
snapshot. Holdings and available cash can be individually valid yet collectively unsuitable when
they represent different dates, portfolios, or currency bases. Proposal Builder therefore needs to
show the requested advisory date beside the effective source date and withhold decision actions
until the source response matches the selected context.

### Primary-source research

Research was reviewed on 2026-08-11:

1. [TanStack Query query-key guidance](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys)
   requires every variable used by a query function to be included in its query key so differently
   parameterized results are cached independently and changes refetch the correct source data.
2. [BlackRock Aladdin Wealth proposal generation](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/proposal-generation)
   positions whole-portfolio views, portfolio calculations, suitability checks, and detailed
   analytics inside the proposal-construction journey from identification through implementation.
3. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   describes a connected advisor experience built on a common portfolio language and whole-
   portfolio evidence rather than disconnected product-level interpretations.
4. The current Gateway `PortfolioBookResponse` is the internal primary contract: one request accepts
   `as_of_date` and `reporting_currency` and returns portfolio identity, resolved `as_of_date`,
   summary cash, cash balances, allocations, and positions as one aligned book snapshot.

These sources inform query identity, evidence grouping, and workflow admission. Lotus does not copy
another product's layout, visual identity, wording, calculations, or unsupported capabilities.

### Adopted decisions

1. Request one combined Gateway portfolio-book snapshot for holdings and cash instead of merging a
   dated book with the undated workspace shell in the browser.
2. Include portfolio id, advisory as-of date, and selected currency in the query identity and the
   Gateway request.
3. Admit evaluation and handoff only when the returned portfolio id, effective as-of date, and
   portfolio currency match the selected context and both positions and summary cash are usable.
4. Display requested and effective dates as compact business evidence, with a stable machine-
   readable status for browser proof.
5. Keep previously confirmed evidence visible but non-authoritative during refresh or refresh
   failure; isolate differently dated responses by query identity so an older completion cannot
   replace the currently selected evidence.
6. Keep advisor-entered cash available only for indicative drafting when source evidence is
   unavailable; it never authorizes evaluation or handoff.

### Rejected decisions

1. Continuing the workspace-shell cash query, because it cannot be parameterized by the selected
   advisory date and creates two temporal authorities for one decision.
2. Comparing only request parameters while discarding response identity and effective date, because
   transport success does not prove that the resolved source snapshot matches the advisor's choice.
3. Inferring a missing effective date, portfolio id, currency, or cash total in the browser.
4. Clearing cached evidence or showing a blank screen during refresh; qualified evidence is more
   useful while actions remain paused.
5. Adding a new dependency, global state store, or Gateway endpoint when the mature Workbench stack
   and existing combined-book contract already support the required boundary.

### Validation and publication decision

Workbench #638 owns implementation. Focused proof must cover matching context, missing or mismatched
effective context, date changes, older completion ordering, cached refresh failure, source recovery,
and action admission. No wiki source change is required for this slice: the screen catalogue already
records the Proposal Builder route and its Gateway/Core/Advise ownership, while #605 owns the
dedicated business screen guide. Repository context and the codebase review ledger carry the new
one-snapshot source-authority rule without duplicating that technical detail into the catalogue.

## Proposal Builder Semantic Calendar-Date Admission

### Business and engineering job

An advisor must not evaluate or retain a proposal against a date that has the right textual shape
but cannot exist on the calendar. Carried review context and returned portfolio-book evidence are
both external inputs at the Workbench decision boundary. An impossible value must remain visible
as a source-quality exception, never become a confirmed snapshot or be silently rolled into another
day.

### Primary-source research

Research was reviewed on 2026-08-27:

1. [OWASP Input Validation guidance](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
   distinguishes syntactic validation from semantic validation and requires potentially untrusted
   backend feeds to be validated as they enter a workflow. A `YYYY-MM-DD` shape check therefore
   cannot establish that the month and day form a real calendar date.
2. [WCAG 2.2 error identification guidance](https://www.w3.org/WAI/WCAG22/Understanding/error-identification)
   requires descriptive text that identifies what is invalid and supports a corrective next step;
   a generic unavailable badge alone is insufficient.
3. [WCAG 2.2 status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
   requires important state and error changes that do not move focus to remain programmatically
   available to assistive technology.
4. Workbench's `isBusinessDateValue` helper is the internal calendar authority already proven for
   leap years and month lengths. Proposal Builder can reuse it without another dependency, policy,
   or service contract.

### Adopted decisions

1. Use the shared semantic calendar validator for schema admission, source request eligibility,
   source-default adoption, response matching, and portfolio-evidence readiness.
2. Project invalid carried and invalid returned dates as two explicit reasons beneath the existing
   `unavailable` business posture; neither can authorize evaluation, holding-derived draft actions,
   or handoff.
3. Preserve the rejected raw date in the evidence facts and stable machine-readable state while
   the panel heading and body identify whether carried or returned source context is invalid.
4. Keep source refresh available when the returned source date is invalid, because a new source
   response can recover; publish the replacement as busy and lock repeated refresh. Disable that
   false recovery for an invalid carried date, make no implicit undated read, and direct the advisor
   back to portfolio review instead.
5. Adopt source date and source currency defaults atomically across form, cash-flow, and trade
   fields. An invalid source date must not cause another read or partially promote currency.

### Rejected decisions

1. Keeping the shape-only regular expressions in the schema, query, effect, or evidence model.
2. Parsing through JavaScript `Date`, browser date controls, or timezone conversion, because
   rollover or normalization can invent a different advisory date.
3. Silently substituting today's date, the route date, a demonstration date, or the source's nearest
   valid day.
4. Adding a Proposal-only date helper, a new validation dependency, or browser-owned date policy
   when the shared Workbench authority already owns the rule.
5. Changing Gateway or Core contracts for a Workbench admission defect; the existing source field
   remains authoritative when valid and explicitly unavailable when malformed.

### Validation and publication decision

Workbench #821 owns the bounded implementation. Focused model, component, and optimized-browser
proof covers valid leap day, non-leap February, month length, impossible month/day, valid source
defaults, invalid carried context, invalid returned evidence, final-action fencing, and source-
request integrity. The Proposal Builder screen guide and repository context change because the
advisor-visible recovery path and source-admission rule are now more precise; publish the wiki after
merge and verify strict source parity.

## Proposal Builder Indicative Impact Currency Authority

### Business and engineering job

An advisor must be able to distinguish a coherent proposed-portfolio projection from a collection
of individually valid monetary inputs that use different currencies. A source book in SGD, a
proposal requested in USD, an advisor-entered USD cash movement, or a draft order priced in EUR
must not be added together or labelled as though an FX translation occurred. The workstation can
preserve those inputs for drafting and recovery without presenting a false whole-portfolio impact.

### Primary-source research

Research was reviewed on 2026-08-11:

1. [ISO 4217](https://www.iso.org/standard/64758.html) defines the three-letter alphabetic currency
   identity used in banking, trade, and automated systems. A currency label is therefore data
   identity, not visual decoration.
2. [IAS 21](https://www.ifrs.org/issued-standards/list-of-standards/ias-21-the-effects-of-changes-in-foreign-exchange-rates/)
   distinguishes functional, foreign, and presentation currencies and identifies the exchange rate
   and translation effects as substantive accounting concerns. Workbench does not apply that
   reporting standard directly, but adopts the relevant control principle: presentation in another
   currency requires an identified translation basis rather than relabelling.
3. [BlackRock Aladdin Wealth proposal generation](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/proposal-generation)
   places whole-portfolio analytics and checks inside proposal construction and describes a robust
   calculation engine using firm-supplied inputs. This supports keeping source and calculation
   authority behind the approved service boundary.

These sources inform evidence identity and workflow presentation only. Lotus does not copy another
product's layout, visual identity, wording, calculations, or unsupported capabilities.

### Adopted decisions

1. Project one pure, typed currency-admission model before building any combined monetary preview.
2. Keep the source book currency, requested proposal currency, each active cash-movement currency,
   and every active draft-order price currency explicit and machine-testable. A held-position
   reference price is derived from source-owned base-currency market value and quantity; an
   off-book reference price carries an advisor-visible currency field.
3. Render the current indicative totals and allocation table only when every included monetary
   context shares one confirmed ISO-style currency code.
4. When currency contexts differ or are incomplete, keep the source holdings, source cash, manual
   scenario cash, movements, and draft orders visible in their own declared context, but replace the
   combined projection with a business-facing unavailable posture.
5. Preserve evaluation and save admission independently; a read-only display correction cannot
   weaken the source-context gate.
6. Reuse the existing React, TypeScript, MUI, React Query, Zod, and CSS-module architecture. This
   correctness slice requires no dependency, global CSS, Gateway route, runtime, or topology change.

### Rejected decisions

1. Relabelling SGD source values as USD because the advisor selected USD in the form.
2. Applying a browser-owned spot rate, cached rate, static rate, or inferred rate/date/method.
3. Showing mixed monetary totals with a disclaimer; the number remains mathematically incoherent.
4. Clearing source evidence or draft inputs solely because the combined projection is unavailable.
5. Adding a new FX library or service call without a Gateway contract that owns conversion rate,
   date, method, source, and lineage.

### Validation and publication decision

Workbench #642 owns implementation. Focused proof covers matched source evidence, source/request
mismatch, conflicting cash-movement and priced-order currencies, missing or malformed source and
draft currency identity, base-currency price derivation, manual-only drafting, partial evidence,
cached refresh failure, and source recovery. The Proposal Builder browser proof uses stable
preview-currency attributes plus visible business copy. No wiki source change is required: the
screen's purpose, route, source owners, and supported actions remain unchanged, and #605 continues
to own the dedicated Proposal Builder business guide.

## Proposal Builder Additional-Cash Admission

### Business and engineering job

An advisor may want to test how a prospective contribution changes an indicative proposal, but the
assumption must remain distinct from source-owned portfolio cash. Blank and zero are valid business
choices: they mean the proposal uses no additional cash. A negative or malformed amount must remain
visible for correction, block evaluation and draft handoff, and never be silently coerced into a
different value.

### Primary-source research

Research was reviewed on 2026-08-11:

1. [BlackRock Aladdin Wealth proposal generation](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/proposal-generation)
   places whole-portfolio analysis inside proposal construction while retaining robust calculation
   and firm-input authority outside the visual shell. This supports treating additional cash as an
   explicit draft assumption rather than replacing the confirmed portfolio cash balance.
2. [BlackRock Aladdin Wealth market-driven scenarios](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/making-of-a-market-driven-scenario)
   separates scenario assumptions from the portfolio being analysed. The relevant control pattern
   is the distinction between a modelling input and current source truth.
3. [W3C WCAG 2.2 error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html)
   requires detected input errors to be identified and described in text.
4. [W3C form validation guidance](https://www.w3.org/WAI/tutorials/forms/validation/) and the
   [GOV.UK validation pattern](https://design-system.service.gov.uk/patterns/validation/) support
   preserving the entered value, showing a specific recovery message, and associating the error
   with the field.
5. [MUI Text Field guidance](https://mui.com/material-ui/react-text-field/) provides the existing
   accessible error and helper-text mechanism used by Workbench; no replacement component or
   dependency is required.

These sources inform the interaction and authority boundary only. Lotus does not copy another
product's layout, visual identity, wording, calculations, or unsupported capabilities.

### Adopted decisions

1. Use one pure, typed admission model for blank, zero, positive, negative, malformed, and
   out-of-range inputs; admit at most two decimal places, validate exact scaled minor units, and
   cap the range below the floating-point spacing boundary where adjacent cents stop being
   distinguishable. Recheck the completed current/proposed preview against the same boundary so
   source cash, positions, cash movements, or draft orders cannot push an individually admitted
   assumption into an unreliable aggregate. Preserve monetary inputs and cumulative arithmetic as
   integer minor units through the complete preview, then convert only final range-admitted values
   for presentation. Use the same proposal-money boundary for cash-movement field recovery, net
   cash display, preview arithmetic, and submitted decimal strings so no path applies a different
   rounding rule. Preserve the advisor's cash-movement decimal text through admission so
   over-precision cannot disappear during browser number conversion. Admit that precision
   independently of the impact panel's currency or other first blocker, and prepare every
   submitted cash-flow amount before creating a server-side workspace. Apply a documented
   nearest-minor-unit rounding rule only to derived indicative notionals from source-implied prices;
   quantity actions must not be rejected merely because an indicative multiplication produces a
   fractional cent. Reconcile cash from the rounded before/after position-value delta rather than
   rounding the position and trade independently, preserving the self-financing accounting identity
   across successive draft trades. The Zod schema, field recovery, and
   workflow-action gate consume the same model.
2. Treat blank and zero as explicit no-additional-cash assumptions while keeping source portfolio
   cash authoritative. Apply an admitted positive amount to proposed cash and proposed portfolio
   value only; current cash and current portfolio value remain the source-confirmed baseline.
3. Preserve malformed text for correction, provide a specific business recovery message, and keep
   both evaluation and draft handoff unavailable until the value is valid. Withhold the indicative
   projection as well; an invalid assumption must never be modelled or displayed as zero.
4. Use a text input with decimal input mode so wheel events do not change money and the browser does
   not discard malformed advisor input before Workbench can explain it.
5. Retain the governed React, Next.js, TypeScript, MUI, React Hook Form, and Zod boundaries. The
   correction adds no dependency, experimental framework feature, global CSS, Gateway route,
   runtime service, or deployment topology.

### Rejected decisions

1. Requiring a strictly positive amount, because a source-backed proposal does not require a new
   contribution.
2. Converting blank, negative, or malformed text to zero, because that hides operator intent and
   can enable an action with a value the advisor did not enter.
3. Checking only `Number.MAX_SAFE_INTEGER` after decimal conversion, because a large fractional
   amount may already have rounded before that check and even safe minor units can collapse when
   converted back to a large floating-point major-unit value. Admission preserves scaled units
   through the range decision, caps conversion where every adjacent cent remains distinct, and
   withholds any completed aggregate that crosses that boundary. The projection also retains minor
   units during addition and subtraction so cumulative rounding cannot pass a later range check.
4. Using native `type="number"` as the business validator, because it can discard invalid text and
   permits wheel-driven value changes.
5. Sending the assumption as portfolio cash or adding it to Gateway stateful input; the Gateway
   request continues to carry only the source-backed portfolio, date, and mandate identity.
6. Adding a form or money-input dependency for a bounded validation correction that the governed
   stack already supports.
7. Formatting submitted cash movements independently with `toFixed(2)`, because binary rounding
   can disagree with the preview's minor-unit admission and show an advisor a different amount from
   the value sent to the source workflow.

### Validation and publication decision

Workbench #639 owns implementation. Focused proof covers all admission states, aligned button
availability, explicit errors, recovery, positive-assumption impact, unchanged Gateway payload,
successful source-backed evaluation, and desktop/narrow browser behavior. No wiki source change is required: the route,
screen purpose, source owners, supported actions, and operator procedure remain unchanged, while
#605 owns the dedicated Proposal Builder business guide.

## Portfolio Review Selected-Portfolio Recovery

### Business and engineering job

An advisor opening Portfolio Review must be able to tell whether the selected portfolio is still
being confirmed, is ready for review, or is unavailable. A temporary source failure must not create
repeated background traffic, display a terminal failure while confirmation is still running, switch
to another portfolio silently, or offer a Retry control that does not actually contact portfolio
authority.

### Primary-source research

Research was reviewed on 2026-08-12:

1. [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
   requires important loading, outcome, and error changes that do not take focus to be available to
   assistive technology. The relevant pattern is an announced state transition without disrupting
   the advisor's current context.
2. [W3C user-notification guidance](https://www.w3.org/WAI/tutorials/forms/notifications/) calls for
   concise, clear feedback and simple instructions that explain how an error can be resolved.
3. [GOV.UK error-message guidance](https://design-system.service.gov.uk/components/error-message/)
   distinguishes user-correctable input errors from service problems the user cannot fix and directs
   the latter to an explanatory state with useful next-step information.
4. [IBM Carbon notification guidance](https://v10.carbondesignsystem.com/components/notification/usage/)
   recommends concise, in-context, persistent feedback for task or system failures, with an action
   that clearly communicates the available next step.

These sources inform state semantics, accessibility, and recovery copy only. Lotus does not copy
another product's visual identity, layout, wording, or unsupported recovery behavior.

### Adopted decisions

1. Represent automatic selected-shell recovery as a visible loading state and show terminal
   unavailability only after the single request settles.
2. Keep one automatic request per selected portfolio source key. A changed key permits one fresh
   request; an obsolete or unmounted completion cannot publish workspace state or terminal metrics.
3. Keep terminal recovery persistent and in context. **Open My book** is the only action because it
   is the implemented path that re-establishes portfolio selection; no other portfolio is silently
   substituted.
4. Use a stable UI test id plus fixture-owned request count for browser proof. Product copy remains
   supporting evidence rather than the only automation contract.
5. Emit bounded panel-state events for the real automatic attempt and its attached ready or terminal
   outcome. Labels use static route/panel/operation/state vocabulary and never include portfolio,
   client, request, response, or screen content.
6. Reuse `ScreenStatePanel` and the existing Workbench observability contract. The correction adds
   no CSS, dependency, experimental framework feature, Gateway route, runtime service, or topology.

### Rejected decisions

1. Repeated timer or exponential-backoff retries during a persistent source outage.
2. A page-local Retry button without an explicitly implemented source-authority request.
3. Showing the unavailable workspace while the automatic request is still pending.
4. A transient toast as the only failure evidence, or moving focus merely to announce the state.
5. Duplicating the primary recovery action in the side rail or showing unrelated Performance and
   Operations links before the selected portfolio has been confirmed. The side rail may carry
   concise selection or support guidance without competing with the main action.
6. Putting portfolio ids, client ids, response payloads, or other high-cardinality context in metric
   labels.

### Validation and publication decision

Workbench #651 owns implementation. Deterministic promise tests cover the single-attempt limit,
source-key reset, stale completion, unmount, visible loading/terminal states, and lifecycle metrics.
The isolated production-browser fixture proves exactly one server read plus one bounded client
recovery read, stable terminal UI evidence, business copy, and the My-book handoff. The canonical
Portfolio Review screen guide changes because its state/recovery and validation truth changes; no
Gateway, API, OpenAPI, central platform context, or technology-stack claim changes.

## Portfolio Record Production Hydration Reliability

### Business and engineering job

An advisor must receive a stable first render before acting on a portfolio record screen. Server
HTML, client hydration, and source-backed refreshes must not replace the document tree, lose focus,
or hide a runtime error behind a visually correct screen.

### Primary-source research

Research was reviewed on 2026-08-12:

1. [MUI's Next.js integration guidance](https://mui.com/material-ui/integrations/nextjs/) recommends
   `AppRouterCacheProvider` for App Router streaming so generated MUI styles are collected during
   server rendering and appended to the document head instead of the body.
2. [Next.js hydration-error guidance](https://nextjs.org/docs/messages/react-hydration-error)
   identifies incorrect CSS-in-JS configuration as a mismatch cause and requires the initial
   server and client trees to remain equal.
3. [React hydrateRoot guidance](https://react.dev/reference/react-dom/client/hydrateRoot) describes
   `suppressHydrationWarning` as a one-level escape hatch for an unavoidable difference, not a
   document-root rendering policy.

### Adopted decisions

1. Use the stable MUI 7 Next.js adapter at the single root App Router boundary, paired with the
   exact existing Emotion cache line. Keep business screens unaware of the framework adapter.
2. Remove root-level hydration suppression and assert that it cannot return.
3. Treat unexpected browser console errors and uncaught page errors as production-regression
   failures. Retain the route, viewport, keyboard target, and empty failure array as machine-readable
   proof.
4. Make the owned portfolio fixture answer the shell capability contract successfully instead of
   allowlisting its 404. This keeps the browser proof source-backed and exercises the asynchronous
   navigation transition truthfully.
5. Govern both direct dependencies through the blocking dependency-risk inventory, exact lockfile,
   vulnerability audit, and existing MUI/design-system containment boundary.

### Rejected decisions

1. Keeping `suppressHydrationWarning` on `<body>` or applying it to individual portfolio screens.
2. Hiding React error 418, filtering console failures, or accepting a visibly correct screen as
   evidence while the browser replaces server-rendered content.
3. Disabling server rendering for the shell or portfolio records, because that would reduce first
   render quality and avoid rather than correct the integration boundary.
4. Adding screen-local Emotion caches, provider copies, or CSS workarounds.
5. Upgrading Next.js, React, or MUI major versions in a hydration correction; the selected adapter
   is stable and compatible with the governed Next 15, React 19, and MUI 7 foundation.

### Validation and publication decision

Workbench #677 owns implementation. Before correction, optimized standalone HTML placed 16
Emotion style elements inside the document body. After correction, the same structural probe found
three managed styles in the head, zero in the body, and no root suppression flag. Optimized
standalone Playwright proof passes Cashflow at 1440, 1024, 768, and 519 pixels plus Positions at
390 pixels; both routes record empty browser-runtime failure arrays and the compact Positions
navigation retains keyboard focus. No Gateway/API/OpenAPI contract changed. The technology-risk
wiki and repository context change because root rendering and direct dependency truth changed; no
business screen guide changes because screen purpose, source authority, actions, and terminology
remain unchanged.

## Performance Source-Confirmed Selection Integrity

### Business and engineering job

An advisor changing a Performance horizon, reporting basis, frequency, benchmark, or analytical
dimension must be able to distinguish a requested view from the analytics the source has actually
confirmed. A transient source failure must not relabel retained figures, certify a new URL, leave a
detail module loading indefinitely, discard useful prior evidence, or require the advisor to rebuild
the analytical request manually.

### Primary-source research

Research was reviewed on 2026-08-13:

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   describes connected portfolio analytics, common portfolio language, exception-based review, and
   advisor efficiency. The applicable pattern is one coherent decision context with failures treated
   as visible exceptions, not a silent change in the meaning of retained analytics.
2. [BlackRock Aladdin Accounting](https://www.blackrock.com/aladdin/platforms/products/aladdin-accounting)
   emphasizes consistent performance data, quality controls, reconciliation, and controlled returns
   across operating users. This supports binding every displayed measure to an explicit confirmed
   reporting scope.
3. [Morningstar Direct Advisory Suite reporting](https://www.morningstar.com/business/products/direct-advisory-suite/reports)
   presents performance reporting as a clear interactive advisor communication workflow. This
   supports keeping the selected analytical context legible when an interaction cannot be applied.
4. [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
   requires important dynamic state changes to be available to assistive technology without moving
   focus. [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html),
   [focus visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html), and
   [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) inform the
   responsive recovery card and retry control.

These sources inform workflow coherence, evidence integrity, state semantics, and accessibility
only. Lotus does not copy another product's layout, visual identity, wording, calculations, or
unsupported capabilities, and the review does not substantiate a claim of competitor superiority.

### Adopted decisions

1. Keep confirmed controls and analytics in one committed state. Requested controls live in a
   separate typed pending or failed transaction until matching summary and detail responses succeed.
2. Commit resolved summary, resolved detail, normalized controls, cache identity, and URL atomically.
   A summary-changing request does not partially publish if its dependent detail request fails.
3. Retain useful prior analytics during refresh and failure only under their original confirmed
   labels. Name the requested context separately and show source HTTP status only as secondary
   support evidence.
4. Fence obsolete request completion with the existing monotonic sequence; exact retry reuses the
   failed request, while a return to the confirmed selection cancels the pending intent.
5. Fail permission blocks closed, but treat recoverable transport/source failure as a persistent
   in-context exception with a single source retry. Lock conflicting controls while any selection
   transaction is pending.
6. Add one reusable design-system refresh-status component with polite pending semantics, assertive
   failure semantics, stable UI evidence, component-owned CSS, visible focus, a minimum 44-pixel
   retry target, and one-column narrow reflow. No global CSS, dependency, framework, Gateway route,
   runtime service, or deployment topology changes.
7. Prove failure behavior through the real Workbench BFF against an owned contract-valid fixture.
   Require exactly the deliberate 503 and 502 browser signals and reject every additional console
   or page error rather than broadly allowlisting failure noise.

### Rejected decisions

1. Optimistically changing the selected labels or URL before source confirmation.
2. Clearing all prior analytics for every transient failure or substituting zeros, fallback figures,
   another period, or browser-calculated results.
3. Treating summary and detail as independently publishable parts of one user selection when that
   can combine incompatible reporting contexts.
4. Retaining a spinner after details failure, using a transient toast as the only evidence, moving
   focus to announce status, or increasing timeouts to hide the missing recovery state.
5. Letting a general browser-runtime check ignore all failed resources. The owned scenario asserts
   the two expected endpoints and status codes exactly and still fails on any unrelated error.
6. Adding state-management, notification, design-system, or CSS utility dependencies for a bounded
   transaction model that React and the existing Workbench primitives already support.

### Validation and publication decision

Workbench #679 owns implementation and #605 owns complete screen-guide coverage. Focused tests prove
pending, both failure scopes, exact retry, cached success, superseded completion, cancellation, and
permission-blocked behavior. The optimized-production `PB_SG_GLOBAL_BAL_001` journey proves retained
YTD and Asset Class context through deliberate 3Y-summary and Sector-detail failures, atomic retry
success, URL truth, responsive reflow, head-managed styles, and exactly two expected BFF error
signals. The Performance Summary guide, supported-feature truth, codebase review ledger, and
repository context change; Gateway/API/OpenAPI, source calculations, dependencies, and global CSS do
not.

## Performance Analysis Evidence Cardinality And Recovery

### Business and engineering job

An advisor investigating performance drivers must be able to distinguish a real historical pattern
from one observation, valid source-confirmed absence, an access restriction, and a failed source
request. Confirmation of contribution and attribution detail must not silently certify a separate
history request that did not succeed.

### Primary-source research

Research was reviewed on 2026-08-14:

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   describes connected portfolio analytics, common portfolio language, and interactive workflows
   intended to improve advisor efficiency. The applicable pattern is a coherent investigation path
   whose analytical evidence stays connected to the selected portfolio context.
2. [BlackRock Aladdin Accounting](https://www.blackrock.com/aladdin/platforms/products/aladdin-accounting)
   emphasizes consistent performance data, reconciliation, and controlled operating information.
   This supports explicit source state rather than browser-authored success or empty evidence.
3. [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
   requires important dynamic outcomes to be available to assistive technology without taking
   focus; [Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) supports
   retaining the user's recovery control through pending and completion.

These sources inform evidence hierarchy, state semantics, and accessible recovery only. Lotus does
not copy another product's layout, visual identity, wording, calculations, or unsupported
capabilities, and the research does not support a claim of competitor superiority.

### Adopted decisions

1. Give historical attribution its own typed loading, ready, recoverable-error, and
   permission-blocked state rather than deriving posture from the detail transaction.
2. Cache only source-confirmed success and fence obsolete completion with a monotonic request id.
3. Expose a stable machine-readable state and observation count while keeping the visible copy
   business-facing.
4. Require at least two observations for a trend chart. Preserve one observation as exact tabular
   evidence with an explicit no-trend qualification.
5. Keep one recovery action mounted through failure, pending, and success; disable it natively
   while the request is pending, restore focus after the request settles, retry the exact request,
   and disclose source response status as secondary support evidence.
6. Validate the negative path against the real Workbench BFF using one deliberate 503 and reject
   any additional console or page failure.

### Rejected decisions

1. Converting request rejection into a supported response with empty rows or blank source identity.
2. Using generic unavailable copy for both valid absence and transport/source failure.
3. Drawing one observation as a time series or filling missing periods in the browser.
4. Treating the detail confirmation message as proof that independent history succeeded.
5. Moving focus to an alert, removing the retry control during pending, or depending on transient
   toast copy as the automation contract.
6. Adding another state, chart, notification, or CSS dependency for a bounded panel lifecycle.

### Validation and publication decision

Workbench #682 owns implementation and #605 owns guide coverage. Focused tests prove multi-,
single-, zero-, failed, permission-blocked, exact-retry, focus, and stale-request behavior. The
optimized-production `PB_SG_GLOBAL_BAL_001` scenario proves a deliberate 503 remains explicit until
source retry succeeds, then renders one exact observation without a chart at governed narrow
viewports. The complete Performance Analysis guide, API surface, supported-feature truth,
repository context, and codebase review ledger change. Gateway/API/OpenAPI, source calculations,
dependencies, global CSS, runtime topology, advice, trade, approval, and report-publication
authority do not. Workbench #683 and #684 durably own the adjacent false-empty and dead-code patterns.

## Performance Horizon Comparison Evidence Integrity

### Business and engineering job

An advisor comparing return horizons must know whether the source published no horizons, one exact
period, or a real comparison. A Gateway failure or access restriction must never be presented as a
successful empty comparison, and recovery must repeat the exact analytical request without
disrupting the advisor's next task.

### Primary-source research

Research was reviewed on 2026-08-14:

1. [Morningstar Direct portfolio management](https://www.morningstar.com/business/products/direct/portfolio-management-tool)
   connects portfolio comparison and attribution to understanding the effect of holdings and
   allocation decisions. The applicable pattern is exact comparable evidence, not a decorative
   chart when only one period exists.
2. [BlackRock Aladdin Risk](https://www.blackrock.com/aladdin/platforms/products/aladdin-risk)
   describes a comprehensive, integrated view of portfolio risk, performance, attribution, and
   positioning. The applicable pattern is coherent source context across analytical views rather
   than treating a failed module as an empty result.
3. [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
   requires dynamic waiting, result, and error messages to be programmatically available without
   taking focus. [Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) supports
   retaining logical keyboard operation when recovery content changes.

These sources inform evidence hierarchy, state semantics, and accessible recovery only. Lotus does
not copy another product's layout, visual identity, wording, calculations, or unsupported
capabilities, and the research does not substantiate competitor-superiority claims.

### Adopted decisions

1. Reuse one typed, generic source-confirmed resource lifecycle for independently fetched
   Attribution History and Horizon Comparison instead of copying request/cache/retry logic.
2. Cache only successful source responses, fence obsolete UI completion, and revoke the matching
   cache after any permission denial even when that denial is obsolete for the visible selection.
3. Keep failure, permission restriction, source-confirmed absence, one observation, and multiple
   observations machine-readable and visibly distinct.
4. Present one horizon as exact table evidence and reserve comparison graphics for two or more
   published horizons.
5. Keep one quiet **Refresh comparison** action mounted, disable it natively while pending, repeat
   the exact request, and restore focus only if the user has not moved to another task.
6. Prove both negative and recovered states through the Workbench BFF at 1024, 768, and 519 pixels;
   admit only the deliberate 503 and fail on unrelated console or page errors.

### Rejected decisions

1. Fabricating an empty v1 response, blank correlation id, supported flag, dates, benchmark, or
   reporting context in the browser after rejection.
2. Using the same unavailable copy for source-confirmed zero rows and failed retrieval.
3. Rendering one period with visual comparison controls that imply cross-horizon evidence.
4. Adding another page-local cache, toast, state library, CSS utility, or framework dependency.
5. Automatically moving focus to the alert or reclaiming focus after the advisor continues to
   another control.

### Validation and publication decision

Workbench #683 owns implementation. Focused tests prove exact-key caching, zero/single/multiple
cardinality, explicit failure, permission block, exact retry, native pending state, retained focus,
and no forced focus after the user moves on. The optimized-production `PB_SG_GLOBAL_BAL_001`
scenario deliberately receives a 503, proves the error is not described as no data, retries the
same request, and then renders four source observations with no page overflow at 1024, 768, and 519
pixels. Performance Summary, Supported Features, repository context, and the review ledger change.
Gateway/API/OpenAPI, source calculations, dependencies, global CSS, runtime topology, advice,
trade, approval, and report-publication authority do not.

## Self-Contained Performance Analysis Source Controls

### Business and engineering job

An advisor investigating portfolio drivers must be able to change the question's governing
horizon, return basis, review window, observation frequency, and benchmark without leaving the
Analysis workflow. The selection must stay connected to source-confirmed analytics and must not
turn a local control into calculation or benchmark authority.

### Primary-source research

Research was reviewed on 2026-08-14:

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   describes a connected portfolio experience using common portfolio language and interactive
   analysis to improve advisor efficiency. The applicable pattern is keeping portfolio context and
   analysis together during investigation.
2. [BlackRock Aladdin portfolio management](https://www.blackrock.com/institutions/en-us/investment-capabilities/technolgy/aladdin-portfolio-management-software)
   describes interactive analytics across portfolio lenses from a consistent data source. The
   applicable pattern is reusable governing context across views, not duplicated view-local
   request logic.
3. [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
   requires dynamic state to be available without forced focus movement. The applicable pattern is
   a programmatic pending/confirmed status with predictable keyboard continuity.

These sources inform connected workflow, reuse, and accessible state only. Lotus retains its own
visual system, private-banking language, source contracts, and capability boundaries; the research
does not substantiate competitor-superiority claims.

### Adopted decisions

1. Separate horizon, basis, explicit review window, frequency, and benchmark from the return chart
   and render one shared source-selection component in Summary and Analysis.
2. Keep Absolute, Relative, and Combined as Overview-only return-path presentation preferences;
   they do not change source attribution context.
3. Route every governing change through one complete request-shaping path and the existing
   requested/pending/failed/source-confirmed transaction. Keep prior evidence under prior labels
   until controls, Review Context, analytics, and URL can commit together.
4. Keep source capability and benchmark options authoritative; do not create browser defaults or
   calculations.
5. Restore native control focus after source settlement only when the browser moved focus to the
   document and the advisor has not continued elsewhere.
6. Retain compact desktop workstation density while enforcing measured 44px touch targets at the
   narrow breakpoint.
7. Prove direct 3Y and Private Bank Composite selection in Analysis through an owned optimized
   production journey at 1800, 1280, 1024, 768, and 519 pixels.

### Rejected decisions

1. Requiring an Overview round-trip for each Analysis context change.
2. Copying the existing toolbar into Analysis or maintaining two request-shaping paths.
3. Exposing return-view presentation as though it were attribution source context.
4. Optimistically changing controls, Review Context, analytics, or URL before Gateway success.
5. Forcing focus onto status copy, reclaiming focus after the user moves, or weakening focus proof.
6. Increasing all desktop controls to mobile dimensions or adding a new UI, state, notification, or
   CSS dependency for this bounded workflow.

### Validation and publication decision

Workbench #681 owns implementation and #605 retains the wider guide campaign. Focused tests prove
one shared request-shaping path, Overview-only return presentation, Analysis control presence,
pending locks, focus restoration, and no focus theft. The isolated optimized-production
`PB_SG_GLOBAL_BAL_001` journey proves direct horizon and benchmark confirmation without a mode
change, canonical URL and Review Context truth, five governed widths, 44px narrow targets, no
overflow, head-managed styles, and no runtime failures. The Analysis guide, supported-feature
truth, screen registry/catalogue, review ledger, and repository context change. Gateway/API/OpenAPI,
source calculations, dependencies, global CSS, runtime topology, advice, trade, approval, and
report-publication authority do not.

## Render-Pure Portfolio And Report Centre State Ownership

### Business problem

Portfolio and Report Centre state must change atomically with the advisor's selected portfolio and
source date. A screen that briefly renders a previous selection, accepted report posture, or output
intent under a new context can misstate which client work is being reviewed even when a later Effect
corrects it.

### Current-product research

Research was reviewed on 2026-08-14 against the nine exact React Compiler findings:

1. [React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
   explains that resetting state after a prop change in an Effect first renders stale state and
   recommends a keyed inner component when the prop identifies a conceptually different workspace.
2. [React `refs` lint](https://react.dev/reference/eslint-plugin-react-hooks/lints/refs) requires
   render output to use props and state rather than mutable ref values that React does not track.
3. [React `set-state-in-effect` lint](https://react.dev/reference/eslint-plugin-react-hooks/lints/set-state-in-effect)
   rejects synchronous Effect state that forces a cascading render when state can be derived,
   keyed, or changed by the initiating event.

### Adopted decisions

1. Key the Report Centre session by portfolio id, source date, and reporting currency so
   configuration, portfolio-book selection, focus, and workflow state never render across
   conceptual workspaces.
2. Clear selection for an advisor-initiated date change in that event; keep Effects for source
   synchronization and asynchronous lifecycle fencing.
3. Co-locate accepted batch handle, reviewed output formats, source status, and error as one
   portfolio-keyed render state. Refs retain only non-visual async fencing responsibilities.
4. Move invalid Advisor Book page recovery into its reusable source hook and permit one bounded
   retry at the last valid page before publishing ready state.
5. Promote the deterministic zero-finding compiler command into the existing fast blocking lint
   chain with no suppressions or allowlist.

### Rejected decisions

1. Moving the existing reset setters among Effects, because the stale render and cascading update
   remain.
2. Reading accepted output intent from a ref while mirroring only part of the lifecycle in state,
   because render evidence would still have split ownership.
3. Correcting invalid paging only in the Report Centre component, because every other Advisor Book
   consumer would need to rediscover the same source race.
4. Enabling the React Compiler runtime, changing report contracts, or changing business copy as
   part of a render-purity correction.
5. Adding a compiler suppression, source exclusion, or accepted-finding baseline.

### Validation and publication decision

Workbench #688 owns this correction. The exact command moves from nine findings to zero; 73 focused
Portfolio, Advisor Book, workflow, and rendered-workspace tests prove source-key initialization,
bounded paging recovery, accepted output posture, and stale A→B→A completion rejection. The
blocking-lint governance test proves both the compiler entrypoint and its inclusion in `npm run
lint`. Repository context and the review ledger change because state ownership and CI truth changed.
No business feature, visual composition, Gateway/API/OpenAPI contract, CSS, source calculation,
runtime topology, README, or wiki truth changed.

## Data Product Catalogue Resilience And Information Hierarchy

### Business job

Product owners, data stewards, operations teams, support teams, and investment specialists need to
find a governed data product, understand who is accountable for it, and determine whether approved
use, assurance, and downstream-impact evidence support the intended work. A secondary evidence
outage must not erase a still-usable catalogue or encourage a local substitute.

### Current-product research

Research was reviewed on 2026-08-14 from primary enterprise catalogue sources:

1. [Microsoft Purview Unified Catalog](https://learn.microsoft.com/en-us/purview/unified-catalog)
   organizes governed discovery around business context, ownership, health, actions, search, and
   lineage rather than leading with storage paths or service implementation.
2. [Microsoft data-product management guidance](https://learn.microsoft.com/en-in/purview/unified-catalog-data-products-create-manage)
   treats owner, lifecycle, update cadence, purpose, terms of use, and product health as product
   management facts needed for discovery and review.
3. [IBM data-product guidance](https://www.ibm.com/docs/en/watsonx/wdi/saas?topic=data-products)
   describes a catalogue organized around trustworthy, reusable products for a business need,
   with ownership and availability evidence supporting consumption decisions.
4. [TanStack Query `useQuery` reference](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery)
   distinguishes first-load failure from `isRefetchError` and retains the last successful `data`
   after a refetch failure. Cached data presence is therefore not proof that a required refresh
   succeeded.
5. [WCAG 2.2 status-message guidance](https://www.w3.org/WAI/WCAG22/Techniques/failures/F103.html)
   requires dynamic progress, failure, and recovery messages to be programmatically determinable
   without taking focus merely to announce the outcome.

### Adopted decisions

1. Rename the visible surface from the technical **Domain Product Discovery** label to **Data
   Product Catalogue** and lead with governed product identity, accountable source, approved use,
   assurance, and downstream impact.
2. Read catalogue, trust certification, and dependency graph through three independent TanStack
   Query sources. The catalogue is required; optional source failure retains confirmed catalogue
   evidence and never fabricates certification or graph totals.
3. Treat required-catalogue first load, background checking, refetch failure, and confirmation as
   explicit states. Withhold cached catalogue content while its required refresh is checking or has
   failed; `fetchStatus: paused` is still an outstanding check, and cached `data` alone cannot
   retain **Source confirmed** language. Keep initial unavailability distinct from a failed refresh.
4. Keep catalogue, assurance, and dependency refresh controls mounted, suppress duplicate refresh
   activation with `aria-disabled`, and announce checking, failure, and confirmation in stable live
   regions so keyboard focus does not fall back to the document after recovery. The shared
   `ActionButton` primitive owns `aria-disabled` activation suppression plus disabled/hover styling;
   feature handlers retain only their synchronous duplicate-request fence.
5. Preserve earlier source-confirmed optional evidence after refresh failure only when it is
   explicitly labelled earlier evidence. A response that reports trust unavailable remains
   distinct from transport failure and never becomes a zero-certified success.
6. Move every screen selector from legacy global CSS into a feature-owned module, lower the global
   CSS ratchet, and forbid the removed `domain-products-` selector prefix from returning.

### Rejected decisions

1. Keeping one `Promise.all` aggregate, because assurance or graph failure would continue to hide
   a usable catalogue.
2. Catching optional-source failure and returning fabricated empty success payloads, because zero
   relationships or certifications is a business fact that only the source may publish.
3. Rendering raw HTTP status, artifact paths, or Gateway response text, because these do not give
   a business user a safe recovery decision.
4. Adding catalogue editing, access requests, search, AI summaries, or domain-service calls without
   the corresponding source contract and operating authority.
5. Adding another component or styling library; the proven Workbench design system, TanStack Query,
   CSS Modules, Vitest, and Playwright already provide the required production pattern.

### Validation and publication decision

Workbench #693 owns the slice. Focused API and component proof covers independent reads, success,
empty catalogue, blocking catalogue failure, source-reported unavailable assurance, optional-source
failure and recovery, retained earlier evidence, business-safe copy, and focus stability. Isolated
optimized-browser proof covers desktop, tablet, narrow-screen, overflow, deliberate source-error,
recovery, console, and keyboard posture without disturbing the shared stack. The screen registry,
complete business guide, catalogue, API notes, mesh boundary, wiki navigation, and CSS governance
change with the implementation. Gateway contracts and platform-generated artifacts are unchanged.

Workbench #695 owns the late required-cache correction. The always-mounted catalogue source
context now blocks discovery during required refresh and after refetch failure, exposes one real
duplicate-fenced Gateway retry, preserves focus across checking and recovery, and recertifies the
screen only after source success. Focused component proof covers initial failure, cached refetch
failure, repeat activation, recovery, safe copy, and focus. Isolated optimized-browser proof covers
the same path at narrow width with exact expected source-error evidence and no page overflow. The
guide and repository context change because required-source state truth changed; Gateway/API,
OpenAPI, authentication, platform artifacts, and the mature dependency stack do not.

## Performance Advisor Brief Review Workspace

### Business job

Client advisors need to turn a selected portfolio's performance evidence into a concise internal
preparation narrative, understand its limitations, and record a bounded review decision without
confusing generated material with approved client communication. The workflow must reduce meeting
preparation effort while retaining source authority, review consequences, and recovery posture.

### Current-product research

Research was reviewed on 2026-08-14 from primary wealth-platform and accessibility sources:

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   emphasizes a connected wealth ecosystem, whole-portfolio context, book insights, advisor
   nudges, and timely actions. Lotus adopts the integrated evidence-to-action idea only within its
   currently supported single-portfolio contract.
2. [Salesforce Wealth Advisor Client Meeting Preparation](https://help.salesforce.com/s/articleView?id=ind.fsc_agent_financial_advisor_assistance_topic.htm&language=en_US&type=5)
   organizes preparation around gathering and reviewing portfolio performance, client context,
   goals, life events, and pending tasks. Lotus adopts the preparation job and concise hierarchy,
   while not claiming unsupported household, goal, CRM, life-event, or task data.
3. [WCAG 2.2 Error Prevention](https://www.w3.org/TR/WCAG22/#error-prevention-legal-financial-data)
   identifies review, confirmation, and correction as a valid safeguard before consequential data
   submission.
4. [WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
   requires visible action outcomes to be programmatically available without moving focus merely
   to announce them.

### Adopted decisions

1. Keep talking points, exact source measures, supportability, risks, and the internal review
   transaction within one dense selected-portfolio reading path.
2. Separate narrative preparation, output availability, evidence, human review, freshness, and
   client-use permission; no one status is allowed to imply the others.
3. Offer only source-allowed review actions and translate each into a business consequence.
4. Require an explicit review-before-confirm step showing staff reference, rationale, replacement
   reference when applicable, and prohibited downstream uses before any POST.
5. Admit human review only from complete source-returned actor, time, transition-count, and history
   evidence. A terminal state string alone fails closed.
6. Announce pending, success, and failure without stealing focus; publish success only after the
   Gateway/Lotus AI mutation returns and preserve entered values after failure.
7. Keep provider, model, workflow-run, task-flow, handoff, and correlation identifiers in a
   collapsed support disclosure.
8. Move the live feature selector family into one CSS Module, remove dead and duplicate selectors,
   and retain a dense three-column desktop workspace with governed responsive reflow.

### Rejected decisions

1. Treating an AI-generated or rule-based narrative as source authority, human-reviewed content,
   client-ready communication, suitability advice, or a recommendation.
2. Copying competitor navigation, visual identity, wording, household breadth, CRM context, or
   next-best-action claims that Lotus contracts do not support.
3. Posting a review decision on first activation, because the user must inspect its consequence and
   correct the exact record before persistence.
4. Showing success after an optimistic browser update or a terminal state without complete
   source-owned audit evidence.
5. Using a hard-coded reviewer, browser session, or production-identity claim; the staff reference
   is a bounded request field, not authenticated-principal evidence.
6. Leaving technical workflow identifiers in the first scan, adding decorative trust badges, or
   creating another component, styling, state, notification, or AI dependency.
7. Retaining Advisor Brief styling in the legacy global stylesheet or preserving dead selectors
   merely because older tests once referenced them.

### Validation and publication decision

Workbench #697 owns the screen slice and Gateway #547 owns the missing review-audit mapping. Focused
tests prove fail-closed source admission, source-allowed actions, review-before-confirm, no POST
before confirmation, source-confirmed success, explicit failure, retained input, internal-note
boundary, and secondary technical evidence. Isolated optimized-production browser proof uses
`PB_SG_GLOBAL_BAL_001`, exercises the exact confirmation and persistence transaction, asserts
source actor/time/history, no unexpected runtime errors, head-managed styles, and no overflow at
1440, 1024, 720, and 390 pixels. The complete screen guide, source registry, catalogue, API notes,
Supported Features, review ledger, and repository context change. Canonical live proof remains
required after both repository contracts merge. No dependency, calculation, direct source call,
production identity, advice, client publication, trade, report-order, or service-topology authority
changes.

## Performance Evidence Calculation Assurance

### Business job

An advisor, portfolio manager, or performance-control user needs to establish whether the current
performance result has complete calculation and lineage support, identify the exception that
qualifies reliance, and open the relevant source-published record without scanning a technical
payload or mistaking an artifact for approval.

### Current-product research

Research was reviewed on 2026-08-14 from primary industry and standards sources:

1. [BlackRock Aladdin Accounting](https://www.blackrock.com/aladdin/platforms/products/aladdin-accounting)
   describes exception-based processing, automated quality controls, validation, and official
   accounting and performance workflows. Lotus adopts the exception-first operational hierarchy,
   not BlackRock's product identity, breadth, certification, or official-record claims.
2. [GIPS Standards Handbook for Firms](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/)
   requires firms claiming compliance to maintain records supporting reported information and keep
   presentations fair and not misleading. Lotus adopts the separation of result, substantiating
   evidence, and qualification; Workbench does not claim GIPS compliance.
3. [GIPS Tools](https://www.gipsstandards.org/resources/tools/) reinforces that verification,
   policies, procedures, and records are governed disciplines rather than a UI badge. Lotus keeps
   internal-review posture explicitly below verification or certification authority.
4. [WCAG 2.2 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) and
   [Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html) support a
   predictable semantic reading order and native disclosure whose state is programmatically
   available.

### Adopted decisions

1. Replace the raw contract dump with one exception-first business flow: posture, current context,
   calculation coverage, review items, supporting records, then optional technical detail.
2. Require supported capability and package state, at least one calculation, confirmed execution,
   confirmed lineage, and no exception before internal-review readiness. Unknowns fail closed.
3. Keep calculation coverage, review-item count, and supporting-record count independent so one
   positive dimension cannot imply another.
4. Translate only known lifecycle and evidence dimensions; retain raw services, ids, versions,
   stages, snapshots, source reasons, methodology, and routes in one collapsed support disclosure.
5. Keep each exception tied to business impact and an actionable next step without inventing a
   browser-owned refresh, waiver, or approval control.
6. Route every source-published artifact through the returned Workbench/Gateway evidence or
   document boundary and label archives distinctly.
7. Move the selector family to a feature CSS Module, delete its global selectors, lower the exact
   legacy-CSS ratchet, and prohibit the retired prefix from returning.
8. Use native headings, regions, lists, definition lists, and disclosure behavior, with explicit
   keyboard focus proof and responsive overflow proof.

### Rejected decisions

1. Treating `supported`, an empty exception list, a calculation id, a terminal-looking status, or
   an artifact count alone as assurance readiness.
2. Showing raw lifecycle codes, service names, RFC or contract vocabulary, paths, and identifiers
   in the primary business scan.
3. Inventing a control score, confidence percentage, official-performance badge, GIPS claim,
   client-ready flag, audit completion, certification, or regulatory approval.
4. Adding a local retry, evidence upload, rerun, waiver, archive, distribution, report-order,
   client-send, trade, or approval action without owning-source contracts.
5. Adding another state, component, styling, accessibility, or chart library; the existing typed
   React, CSS Module, design-system, Vitest, and Playwright stack is sufficient and proven.
6. Copying a competitor's layout, language, navigation, or visual identity instead of applying the
   bounded exception-control principle to Lotus-owned source truth.

### Business-language convergence refresh (2026-08-30)

Primary-source review refreshed the language boundary without changing the screen's contract or
states:

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   frames advisor productivity through connected whole-portfolio insight. Lotus adopts a concise
   decision-first review hierarchy, not BlackRock's product claims, visual identity, or breadth.
2. [CFA Institute Standard III(D)](https://www.cfainstitute.org/standards/professionals/code-ethics-standards/standards-of-practice-iii-d)
   requires performance information to be fair, accurate, and complete. Lotus keeps qualifications
   visible beside the review decision and does not imply verification, compliance, or client-release
   approval.
3. [WAI-ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) supports the
   existing keyboard-operable collapsed Support detail for implementation evidence that is not part
   of the advisor's first scan.

The refresh adopts **Review status**, **Calculation availability**, **Calculation reference**, and
**Source availability** for advisor-facing decisions. It retains exact source values, identifiers,
and availability checks only inside Support detail. It rejects competitor-style claims, GIPS or
client-approval language, a new component or dependency, and any new browser-owned inference.

The Performance Evidence inventory moved from 14 technical-copy findings to zero. The repository
ratchet moved from 263 to 249 findings while the unresolved-expression count remained 1,720 with
the same identity digest and zero exceptions. The screen's ready, attention, incomplete, and
unavailable states, source authority, routes, calculations, and persistence behavior did not
change.

### Validation and publication decision

Workbench #699 owns the original screen and #798 owns the 2026-08-30 business-language refresh.
Focused model and component tests prove readiness admission,
partial, pending, failed, stale, unknown, fallback, limitation, source-supportability, empty,
artifact, archive, business-language, and technical-containment behavior. Parent integration tests
prove mode composition. An isolated optimized-production browser journey on owned ports proves the
stable assurance state, exception and calculation regions, native disclosure, keyboard focus,
1024/720/390 responsive reflow, and no horizontal page overflow. The canonical validator now
records machine-readable assurance state rather than stale technical copy. The complete screen
guide, API note, source registry, catalogue, navigation, Supported Features, architecture ledger,
and repository context change. Gateway contracts, calculations, dependencies, authentication,
production entitlements, and service topology do not change.

## Performance Drivers Container-Aware Comparison

### Business job

An advisor needs to compare the leading positive and negative contributors without confusing an
empty detractor group with missing data or letting a narrow three-rail workstation collapse labels,
values, and bars into one another. The same module may own substantially different widths at the
same outer viewport, so device classification is not a reliable presentation input.

### Current-product research

Research was reviewed on 2026-08-15 from primary web-platform, accessibility, and enterprise-design
sources:

1. [MDN container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries)
   defines component adaptation from the size of the actual containing block rather than the
   viewport. This matches a reusable analytical module composed beside optional Workbench rails.
2. [WCAG 2.1 Reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow.html) requires content to
   remain available without loss of information or functionality when it reflows and permits
   relocation where needed. Stacking the two intact business groups is preferable to compression
   or overlap.
3. [SAP Fiori analytical cards](https://experience.sap.com/fiori-design-web/analytical-card/)
   recommends concise analytical-card scope and deliberately limited series. Lotus adopts the
   bounded comparison and readable evidence hierarchy, not SAP's layout, styling, product identity,
   or unsupported capabilities.

### Adopted decisions

1. Use one ordered contributor-group structure for balanced and asymmetric source data. Preserve a
   truthful empty group and place the populated group first when only one side has observations.
2. Let Performance Drivers choose one- or two-column group composition from its own inline size.
   A 1440-pixel workstation with both rails may stack while a 1024-pixel shell with more module
   width may compare side by side.
3. Give each contribution bar list its own inline-size container so identity and measure evidence
   stack before their minimum readable widths conflict.
4. Keep exact contribution, weight, return, empty-state, source-economics, and detail-disclosure
   truth unchanged; the browser performs presentation only.
5. Replace CSS-class-coupled browser lookup with stable business-group evidence and assert exact
   rendered separation plus internal and page-level overflow across governed widths.
6. Move both selector families beside their React owners, remove dead global declarations, lower
   the exact CSS ratchet by 178 lines, and prohibit the retired prefixes from returning.

### Rejected decisions

1. Adding a 1440-pixel viewport breakpoint, because the actual failure is the module width inside
   shell composition and the same viewport can provide different content capacity.
2. Hiding the source-confirmed empty group, truncating contributor evidence, shrinking typography,
   or allowing horizontal scrolling inside the primary decision card.
3. Copying another vendor's dashboard composition or adding a new grid, styling, chart, or
   responsive library when stable CSS container queries and existing Workbench primitives suffice.
4. Changing Performance calculations, Gateway mapping, benchmark logic, source status, or detail
   data to make a presentation defect disappear.
5. Treating raw source-economics codes as polished advisor language. Their separate hierarchy gap is
   recorded under Workbench #712 so the layout fix does not suppress source evidence.

### Validation and publication decision

Workbench #706 owns the layout slice. Focused component and page tests prove balanced and asymmetric
structure, populated and empty states, source-value preservation, and detail access. CSS governance
proves no retired selector returns. The optimized-production populated scenario uses
`PB_SG_GLOBAL_BAL_001` and asserts contributor/detractor geometric separation, heading containment,
zero internal overflow, and no page overflow at 1800, 1440, 1024, 768, and 519 pixels. Reviewed
desktop, tablet, and compact evidence is stored under `output/playwright/issue-706-performance-*`.
The Performance Summary guide, architecture wiki, repository context, and review ledger change;
Gateway/API/OpenAPI, calculation, dependency, runtime topology, identity, and authorization truth do
not.

## Performance Contribution Business And Evidence Hierarchy

### Business job

An advisor needs to know whether contribution drivers are complete enough to explain, what is
excluded, and whether additional review is required. Performance support still needs the exact
status, source contracts, reason codes, methodology posture, and reconciliation evidence without
forcing that implementation vocabulary into the advisor's primary scan.

### Current-product research

Research was reviewed on 2026-08-15 from primary regulatory, accessibility, and enterprise-design
sources:

1. [FCA Consumer Duty, PRIN 2A.5](https://handbook.fca.org.uk/handbook/prin2a?timeline=true)
   requires communications to meet information needs, be likely to be understood, and equip
   effective, timely, properly informed decisions. Lotus applies the clear decision hierarchy to
   an internal advisor surface without claiming that this screen alone certifies regulatory
   compliance.
2. [FCA consumer-understanding good practice](https://www.fca.org.uk/publications/good-and-poor-practice/consumer-understanding-good-practice-areas-improvement)
   states that simplification is not merely shorter copy; information must be organised so the user
   can understand and act on what matters, while risks and limitations retain prominence.
3. [SAP Fiori display guidance](https://experience.sap.com/fiori-design-web/explore_group/display/)
   uses progressive disclosure for secondary analytical detail. Lotus adopts the business-first,
   detail-on-demand principle, not SAP's layout, product identity, visual language, or capability.
4. [WCAG 2.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html)
   supports a native disclosure whose state remains programmatically available; keyboard proof
   keeps focus on the disclosure control after expansion.

### Adopted decisions

1. Derive the advisor conclusion and technical evidence from the same Gateway-owned contribution
   object; do not maintain two competing interpretations.
2. Translate `SOURCE_BACKED`, `SOURCE_LIMITED`, and `CALLER_SUPPLIED` into bounded business posture,
   and surface invalid smoothing or absent contribution observations as methodology limitations.
3. Lead with market-value coverage, weighting basis, reconciliation, client-use implication, and
   known exclusions. Preserve every exact source status, reason code, contract, economics field,
   snapshot count, smoothing status, and reconciliation value in **Calculation evidence**.
4. Fail closed when a status or reason code is absent, inconsistent, or unknown. Require declared
   limitations to carry matching reason evidence and require the applicable published contribution
   values to reconcile within the existing 0.005 percentage-point Workbench threshold.
5. Reserve the confirmed posture for published market-value coverage of at least 95%; lower
   coverage remains partial and absent or invalid coverage needs review. The business layer stays
   neutral while exact evidence remains visible for support.
6. Use a native disclosure and a container-aware definition grid: dense two-column evidence when
   the module owns sufficient width, safe one-column evidence in a narrow three-rail workstation or
   compact viewport.
7. Move the live note styling beside its component, lower the exact global-CSS ratchet, and prohibit
   the retired global selector from returning.

### Rejected decisions

1. Hiding raw evidence, converting unknown values to generic success, or replacing the exact reason
   codes with browser-authored prose.
2. Presenting implementation enums, contract identifiers, or service topology as the advisor's
   primary decision language.
3. Claiming client-ready, audited, certified, GIPS-compliant, complete, or suitable status from a
   contribution evidence block.
4. Adding a new component, disclosure, styling, state, or accessibility library when the existing
   typed React, native HTML, CSS Module, Vitest, and Playwright stack owns the requirement.
5. Changing Gateway mapping, Performance methodology, source codes, calculations, identity, or
   entitlement posture to solve a Workbench presentation problem.

### Validation and publication decision

Workbench #712 owns this slice. A focused component matrix proves source-backed, source-limited,
missing-evidence, unknown-code, and invalid-smoothing behavior; parent integration proves the same
hierarchy in Performance Summary. The populated optimized-production journey proves business copy,
native keyboard disclosure, exact source values, focus stability, and internal/page overflow at
1440, 1024, 768, and 519 pixels. Reviewed screenshots are stored under
`output/playwright/issue-712-performance-evidence-*`. The Performance Summary guide, repository
context, review ledger, and CSS governance baseline change. Gateway/API/OpenAPI, calculation,
dependency, authentication, and runtime topology truth do not.

## Compact Operational History And Lifecycle Discoverability

### Business job

An advisor checking a report request on a compact or split-window screen must immediately see what
was requested, the current source-owned lifecycle, when it was requested, and the exact support
reference when operational follow-up is required. The user should not have to discover a hidden
horizontal table gesture before learning whether a client-review report completed or needs action.

### Current-product research

Research was reviewed on 2026-08-15 from standards and official enterprise-product sources:

1. [W3C Design System responsive tables](https://design-system.w3.org/styles/tables.html) preserves
   native table structure when comparison remains primary and requires an overflow wrapper to be
   keyboard-focusable and programmatically named. Lotus retains its semantic workstation table but
   does not force that interaction onto a narrow five-field lifecycle record.
2. [WCAG 2.2 Reflow understanding](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) permits
   two-dimensional scrolling for genuine data tables while still requiring the surrounding page to
   reflow. Lotus proves no page-level horizontal overflow and chooses a linear compact record where
   row comparison is secondary to lifecycle comprehension.
3. [Material Design card guidance](https://m2.material.io/components/cards/android) supports
   expanding mobile card content within the page rather than introducing a second internal scroll
   surface. Lotus adopts native progressive disclosure for the support reference, not Material's
   product styling or identity.
4. [Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth) frames
   advisor technology around efficiency, book insight, next best action, and stronger client
   engagement. Lotus applies that workflow test narrowly: current lifecycle and operational
   follow-up must be visible before decorative detail.

### Adopted decisions

1. Keep the semantic five-column comparison table when the history module owns at least 54rem
   of content width and all lifecycle and support fields fit without clipping.
2. Below that content capacity, render a compact operational record that leads with report identity and
   lifecycle, keeps report date and requested time together, and places the exact support reference
   in a native disclosure.
3. Derive both presentations from the same `ReportRequestRow`; compact layout must not invent,
   reinterpret, or remove source evidence.
4. Make the support disclosure keyboard-operable with stable focus and a measured 44-pixel target.
5. Create a reusable design-system operational-record primitive with component-owned CSS rather
   than adding Report Centre selectors to the global layer.
6. Preserve explicit loading, empty, restricted, and error states in the compact presentation and
   keep the existing recovery actions.
7. Preserve the last source-confirmed rows during background refresh and announce the refresh once
   above both responsive presentations.

### Rejected decisions

1. Silently clipping Lifecycle or Support, hiding a column on mobile, or reducing the text until the
   workstation table happens to fit.
2. Keeping horizontal scroll without a named focusable region and visible affordance.
3. Copying a competitor's visual design, adding a card/table library, or changing the proven React,
   CSS Module, Vitest, and Playwright stack for one responsive workflow.
4. Changing Gateway mapping, Report lifecycle semantics, archive posture, client delivery,
   identity, or authorization to solve a Workbench presentation defect.
5. Generalizing every table into cards. Tables remain correct when cross-row and cross-column
   comparison is the user's primary job.

### Validation and publication decision

Workbench #707 owns this slice. Focused design-system and history-state tests prove one complete row
plus loading, empty, restricted, error, and recovery behavior; the existing Report Centre integration
suite proves the underlying source workflow remains intact. The isolated optimized-production browser
scenario proves the semantic table at a 1024-pixel tablet viewport, the compact record in a
shell-constrained 1201-pixel workstation viewport and at 519 pixels, exact lifecycle and
support access, keyboard disclosure focus, a 44-pixel target, and no page-level overflow. Reviewed
diagnostic captures are stored under `output/playwright/diagnostic-report-centre-request-history-*`.
The Report Centre guide, repository context, research ledger, and review ledger change. No Gateway,
Report, OpenAPI, dependency, global CSS, runtime topology, identity, or entitlement truth changes.

## Governed Same-Origin Typography Delivery

### Business job

An advisor workstation must render its operational hierarchy consistently without a public network
call changing text metrics, delaying first paint, leaking workstation access to an undeclared host,
or polluting source-failure evidence. Brand expression and technical evidence should remain
distinct from the high-legibility business reading face without adding dead payload.

### Current-product research

Research was reviewed on 2026-08-15 from framework and font-publisher primary sources:

1. [Next.js font documentation](https://nextjs.org/docs/app/api-reference/components/font) states
   that `next/font` self-hosts font files, removes browser requests to Google, supports local files,
   CSS variables, preload control, fallback adjustment, and automatic optimization. Lotus uses the
   built-in local path so neither build nor browser availability depends on a font CDN.
2. [Inter v4.1](https://github.com/rsms/inter/releases/tag/v4.1) provides the governed variable
   WOFF2 and SIL OFL license used for operational UI.
3. [Cormorant v4.002](https://github.com/CatharsisFonts/Cormorant/releases/tag/v4.002) provides the
   governed webfont release and SIL OFL license used only for the Lotus wordmark.
4. [IBM Plex](https://github.com/IBM/plex) publishes the governed mono faces and license used for
   technical evidence and identifiers.
5. [MDN `font-display`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40font-face/font-display)
   documents the block and swap periods that make explicit fallback behavior part of first-render
   resilience rather than a purely aesthetic choice.

### Adopted decisions

1. Replace the browser-time Google Fonts CSS import with repository-owned WOFF2 files loaded by
   `next/font/local`; add no new production or development dependency.
2. Preserve the existing semantic roles: Inter for operational reading, Cormorant Garamond 700 for
   the shell wordmark, and IBM Plex Mono 400/500 for technical evidence.
3. Pin upstream repository, tag, immutable commit, SIL OFL text, and SHA-256 for every asset in one
   machine-readable manifest; preserve binary font files and LF-stable license bytes through narrow
   repository attributes so the same hashes hold on Windows and Linux.
4. Preload only Inter and the visible wordmark face. Load the evidence face on use. Delete the
   unused Cormorant 600 face rather than carrying an unconsumed 204,052-byte asset.
5. Remove the late global overrides that collapsed display and mono back to Inter, while preserving
   the intentional Portfolio-local Inter-only scope.
6. Keep `src/app/globals.css` import-only and smaller. Use Next-generated variables under the
   existing semantic typography tokens; replace the remaining direct IBM Plex declaration with
   `var(--font-mono)`.
7. Make font checksum, license, format, role, loader coverage, and forbidden public hosts part of
   the blocking lint chain.
8. Prove the optimized browser receives successful same-origin WOFF2 responses, no Google Fonts
   requests, distinct UI/display/evidence computed families, and no desktop or compact overflow.

### Rejected decisions

1. Retaining the public import, allowlisting Google hosts, suppressing the runtime failure ledger,
   or treating public internet availability as a supported bank workstation dependency.
2. Adding a font package, runtime styling library, new design system, or font CDN when the supported
   framework path and publisher assets satisfy the requirement.
3. Rebranding screens, changing the type scale, or adjusting density to hide metric differences.
4. Shipping every upstream weight or preloading technical faces globally. An available asset is not
   a reason to create dead payload.
5. Converting publisher binaries without a governed transformation and reproducibility contract.

### Validation and publication decision

Workbench #709 owns this slice. Focused governance, layout, and design-token tests prove licensed
asset admission, checksum drift rejection, public-host rejection, root semantic variables, and token
alignment. The optimized 25-route build emits the governed WOFF2 files and retains every bundle
budget. An isolated Chromium journey proves successful same-origin delivery, distinct operational,
brand, and evidence roles, 1440/390 geometry, and zero public font request or page overflow; its
reviewed captures live under the Playwright issue output. The typography architecture, technology
risk wiki, repository context, research ledger, and review ledger change. Gateway/API/OpenAPI,
business workflow, calculation, identity, authorization, dependency, and runtime topology do not.

## Performance Return-Path Evidence Capacity

### Business job

Performance Summary must help an advisor explain the portfolio outcome quickly without implying a
trend that the performance source has not published. A single observation should make the exact
portfolio, benchmark, and active-return comparison immediately legible; a genuine time series must
retain enough analytical depth for path review. The same module must remain useful when workstation
rails, tablet width, or zoom reduce its own canvas independently of the browser viewport.

### Current-product research

Research was reviewed on 2026-08-20 from official product and standards sources:

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/products/aladdin-wealth)
   positions integrated portfolio analytics as advisor decision support. Lotus adopts the
   evidence-first workflow principle, not BlackRock's layout, language, visual identity, or any
   unsupported capability.
2. [Morningstar Direct Advisory Suite](https://www.morningstar.com/products/direct-advisory-suite)
   describes portfolio analysis and reporting as one connected advisor workflow. Lotus uses the
   same business need for concise explainable comparison while retaining its own Gateway and
   Performance source boundaries.
3. [WCAG 2.2 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) requires information and
   functionality to remain available without two-dimensional scrolling at the governed narrow
   presentation. The comparison therefore retains exact text evidence instead of depending on bar
   geometry or color alone.
4. [MDN container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries)
   documents style decisions based on a containing element's available size. This matches a nested
   analytics module whose width changes with Workbench rails even when the outer viewport does not.

### Adopted decisions

1. Treat one return observation as an exact comparison, not a time series: lead with period,
   portfolio return, benchmark return, active return, and a visible zero baseline.
2. Retain the established chart and analytical depth when the source returns two or more
   observations.
3. Remove chart-only controls and the inherited 28.5rem minimum height from point evidence while
   preserving all source-returned values and capability posture.
4. Expose the one-observation region as an accessible named group whose exact text descendants
   remain available to assistive technology; keep decorative bars hidden from that evidence tree.
5. Reflow the nested point comparison from its own inline-size container and prove the full page at
   1440, 1024, 720, and 519 pixels.
6. Move the two live presentation families beside their React owners, delete superseded global
   selectors, lower the exact global-CSS ratchet, and prohibit selector return.

### Rejected decisions

1. Manufacturing additional observations, interpolating a path, or using an oversized empty chart
   to imply analytical history that the source did not publish.
2. Hiding exact values behind hover, relying on color or bar direction alone, or replacing source
   evidence with a browser-authored score or conclusion.
3. Applying page-level overflow suppression or an outer-viewport breakpoint to repair a nested
   module whose true constraint is its own available width.
4. Changing Performance calculations, Gateway/API/OpenAPI contracts, benchmark assignment, or
   return-selection behavior for a presentation-capacity issue.
5. Adding a new chart, styling, or responsive library when the proven React, CSS Module, native HTML,
   Vitest, and Playwright stack owns the requirement.

### Validation and publication decision

Workbench #719 owns the user-facing slice and parent campaign #492 owns the global-CSS reduction.
Focused tests prove one-observation group semantics, exact values, partial evidence, and unchanged
multi-observation chart semantics. The named optimized-production journey proves exact evidence,
zero baseline, no chart-only controls, stable focus through reflow, bounded height, clean browser
runtime, head-managed styles, and zero page overflow at 1440/1024/720/519; reviewed captures live
under `output/playwright/issue-719-performance-return-path-*`. The Performance Summary guide, CSS
governance, repository context, research ledger, and review ledger change. The screen registry and
API Surface already record the correct Gateway/Core/Performance owners and split Summary/Details/
Horizon contract family, so they require no change. Canonical runtime proof is not added because no
source contract, calculation, seed, route, or integrated business transaction changed; protected PR
and exact-main gates remain required.

## Performance Source-Confirmation Lifecycle

### Business job

After an advisor changes the Performance horizon, basis, benchmark, frequency, or analytical
dimension, Workbench must make source settlement clear without turning routine success into a
permanent exception. Failure and recovery require durable evidence; success should return attention
to the portfolio outcome while leaving the resolved controls, figures, and URL as lasting truth.

### Current-product research

Research was reviewed on 2026-08-20 from official accessibility and enterprise-design sources:

1. [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
   requires success and result changes to be programmatically determinable without receiving focus.
2. [SAP Fiori Toast guidance](https://experience.sap.com/fiori-design-web/toast-web-component/)
   describes routine success feedback as short, non-disruptive, and automatically disappearing;
   information needed later belongs in a durable positive state instead.
3. [SAP Fiori UI element states](https://experience.sap.com/fiori-design-web/ui-element-states/)
   distinguishes a short successful-process notification from a positive state the user must retain
   for later use.

### Adopted decisions

1. Preserve the existing source transaction: confirm only after every required Gateway response,
   resolved controls, data, and URL agree; failure, permission denial, partial commit, and obsolete
   completion cannot publish success.
2. Keep pending and failed evidence persistent because the advisor must wait, interpret, or recover.
3. Render confirmed state through the shared refresh-status component as one compact, polite,
   source-context acknowledgement and clear it after five seconds.
4. Keep resolved source controls, analytical figures, and canonical URL as durable confirmation
   after the acknowledgement clears.
5. Preserve the last interacted source selector across a failed request and retry. Restore it only
   when the retry control disappears and focus would otherwise fall to the document; do not move
   focus if the advisor selected another stable task.
6. Suppress confirmation for initial hydration, repeated identical input, mode-only navigation, and
   obsolete completion. A distinct user-requested transaction may confirm once even when an earlier
   source-confirmed response can be reused safely.

### Rejected decisions

1. Keeping a permanent green success panel ahead of the analytical canvas.
2. Adding a toast library, modal, confirmation dialog, or focus transfer into the status message.
3. Clearing pending or failed evidence on a timer, or treating a browser-only transition as source
   persistence.
4. Retaining duplicate requested/source-confirmed definitions after success when the selected
   controls already show the same resolved context.
5. Changing Gateway, Performance calculations, API/OpenAPI contracts, or source ownership for a
   Workbench feedback-lifecycle defect.

### Validation and publication decision

Workbench #721 owns the slice. Focused component, source-control, and transaction-client tests prove
compact polite semantics, source-only settlement, five-second expiry, identical-input suppression,
obsolete-response fencing, and focus non-interference/restoration. The optimized production
refresh-integrity journey proves deliberate summary/detail failure, exact retry, resolved controls
and URL, original-selector focus, compact machine-readable confirmation, expiry, governed narrow
reflow, and bounded browser-error admission. The Performance Summary guide, repository context,
research ledger, and review ledger change. Gateway/API/OpenAPI, calculation, dependency, global CSS,
runtime topology, identity, and entitlement truth do not change.

## Advisory Overview Task-First Responsive Hierarchy

### Business job

A relationship manager should reach the proposal that needs attention before reading orientation
material about the lifecycle. Desktop context can aid parallel scanning, but the same decision,
counts, source-window posture, and next action must not become a second long queue summary when the
layout stacks on a tablet or compact viewport.

### Current-product research

Research was reviewed on 2026-08-21 from official product, enterprise-design, and accessibility
sources:

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   frames advisor nudges, next-best action, opportunity management, and exception-based review as
   mechanisms for acting quickly across client portfolios. Lotus adopts the action-first workflow
   principle, not BlackRock's visual identity, wording, data, or unsupported capabilities.
2. [SAP Fiori responsive design](https://experience.sap.com/fiori-design-web/explore_category/sap-fiori/)
   recommends starting with core mobile functionality, preserving high-priority information, and
   adapting secondary functions and fields by device capacity.
3. [SAP Fiori table and list guidance](https://experience.sap.com/fiori-design-web/explore_group/table-list-tree/)
   keeps the most important fields visible and moves lower-priority fields into responsive
   arrangements rather than forcing unreadable columns or arbitrary duplication.
4. [W3C WCAG 2.2 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) allows content to
   relocate or adjust at narrow widths when information and functionality remain available without
   two-dimensional page scrolling.
5. [W3C C27](https://www.w3.org/WAI/WCAG22/Techniques/css/C27) requires source order to match visual
   order so reading and keyboard focus preserve the same meaningful sequence.

### Adopted decisions

1. Keep the concise advisor decision first and place the proposal worklist immediately after it in
   DOM, visual, and keyboard order.
2. Keep source-window scope inside the worklist so an advisor sees the evidence boundary before
   relying on any row.
3. Reuse the Workbench metric strip after active work, with four measures in one desktop row and
   two compact rows at tablet and 519-pixel widths.
4. Keep lifecycle orientation available after the active queue, using four desktop columns, two
   tablet/standard-phone columns, and one column only below 400 pixels.
5. Add one typed proposal-shell responsive priority. Context remains persistent by default;
   Advisory Overview explicitly marks its duplicated queue posture supplementary.
6. At the shared 1200-pixel shell stacking boundary and below, omit only the supplementary workflow
   panel. Keep source-and-scope
   evidence visible and retain all source recovery, permission, pagination, and partial-window
   behavior.
7. Preserve one semantic table DOM and adapt its cells into compact review records without cloning
   rows or changing source values.

### Rejected decisions

1. Adding more cards, decorative charts, urgency scores, SLAs, client priority, suitability, or
   implementation claims that Gateway and Advise do not publish.
2. Using CSS visual reordering while leaving a conflicting DOM/focus sequence.
3. Hiding the entire evidence rail, source boundary, recovery controls, permission posture, or
   partial-window qualification to shorten the page.
4. Applying a page-specific selector against the shell, changing every proposal screen, or making
   supplementary behavior implicit from route names.
5. Replacing the proven React, CSS Module, semantic HTML, Vitest, and Playwright stack with a new UI
   or responsive library.

### Validation and publication decision

Workbench #731 owns this Workbench-only slice. Focused model, rail, and workspace tests pin default
persistence, explicit supplementary priority, source-boundary retention, and decision → worklist →
measure → lifecycle DOM order. The optimized-production journey measures that rendered order,
metric row geometry, desktop/compact context visibility, keyboard focus, source-boundary visibility,
and page overflow at 1440, 1150, 1024, and 519 pixels. Reviewed evidence is stored under
`output/issue-731/`. The Advisory Overview guide, repository context, research ledger, and review
ledger change. Gateway/API/OpenAPI, source calculation, dependencies, global CSS, runtime topology,
identity, and entitlement truth do not change. Protected PR, exact-main, wiki publication, and
strict parity evidence remain required.

## Advisor Cockpit Decision-First Action Integrity

### Business job

A client advisor should identify the action requiring review, verify its source evidence and
dependency limits, and record only that action's review without horizontal hunting or confusing
another action's transaction state. The same facts and controls must remain usable when the
three-rail workstation reduces the centre canvas or when the workflow moves to a tablet.

### Current-product research

Research was reviewed on 2026-08-21 from official product, enterprise-design, and accessibility
sources:

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   connects advisor nudges, opportunity management, exception-based review, and integrated
   workflows to faster advisor action. Lotus adopts the exception-first workflow principle, not
   BlackRock's layout, language, visual identity, data, or unsupported capability.
2. [SAP Fiori table, list, and tree guidance](https://experience.sap.com/fiori-design-web/explore_group/table-list-tree/)
   treats responsive list items as complete business objects and recommends retaining only the
   fields that support the user's task when capacity changes.
3. [W3C Design System responsive tables](https://design-system.w3.org/styles/tables.html) requires
   a named, keyboard-focusable region when horizontal table scrolling is unavoidable.
4. [W3C WCAG 2.2 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) permits table
   exceptions but still prioritises reflow that avoids two-dimensional page use when information
   and functionality can remain available.

### Adopted decisions

1. Keep one source-backed action row model and one acknowledgement-control policy across both
   presentations; do not maintain a mobile business-logic fork.
2. Use the semantic comparison table only when the action module owns at least 64rem. Below that
   capacity, reuse `OperationalRecordList` so evidence and next business action stay together.
3. Keep the retained comparison table a named, focusable region with caption and scoped headers.
4. Scope recording, confirming, confirmed, partial, and failed feedback to the selected action id.
   Disable conflicting submissions while the source transaction settles but keep every other row's
   own label and evidence intact.
5. Preserve the selected control's focus through persistence and the four-source reconciliation.
6. Use intrinsic grid tracks for Cockpit measures, readiness, preparation, boundaries, and support
   detail so workstation rails—not viewport guesses—determine safe density.
7. Keep restrained navy, neutral evidence, and bounded amber action treatment. The visual thesis is
   a quiet operational record: decision, evidence, next action, then secondary support detail.

### Rejected decisions

1. Keeping an 1120-pixel table that hides Next Action and Review in the normal advisor workstation.
2. Removing fields from compact presentation, forcing page-level horizontal scrolling, or relying
   on a hover-only disclosure.
3. Rendering separate mobile data logic or allowing mutation-wide state to mark every row as the
   selected transaction.
4. Adding urgency scores, recommendations, approvals, client outreach, orders, charts, or other
   business facts not published by Gateway and Advise.
5. Adding a new responsive, table, state-management, or styling dependency when React, CSS Modules,
   native HTML, the design system, Vitest, and Playwright own the requirement.

### Validation and publication decision

Workbench #733 owns action reflow, #734 owns selected-action transaction integrity, and #735 owns
intrinsic Cockpit grid capacity. Focused tests prove one row model, presentation parity, fail-closed
controls, and every selected/non-selected acknowledgement state. The optimized production journey
proves exact evidence and next action, stable focus, exact persisted id, 44-pixel targets,
module-capacity presentation at the exact 64rem boundary and one pixel below, readiness-label
separation, compact measure density, and zero page overflow at 1800, 1440, 1024, and 519 pixels. The
Advisor Cockpit guide, screen registry/catalogue,
repository context, research ledger, and review ledger change. Gateway/API/OpenAPI, Advise contracts,
source calculations, dependencies, global CSS, identity, entitlement, and runtime topology do not
change. Protected PR, exact-main, wiki publication, and strict parity evidence remain required.

## Advisor Cockpit Source Context And Supported Handoffs

### Business job

An advisor should move from a source-owned Cockpit action into the next implemented business
workflow without losing the evidence, owner, review window, or operating boundary that justified
the action. Generic empty context must not consume the workstation canvas or force tablet users to
scroll through an unrelated proposal prompt after completing the action worklist.

### Current-product research

Research was reviewed on 2026-08-21 from official product and accessibility sources:

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   positions book insights, advisor nudges, next-best action, proposal generation, and whole-
   portfolio review as connected advisor workflows. Lotus adopts the connected exception-to-action
   principle, not BlackRock's layout, language, visual identity, data, or unsupported capability.
2. [BlackRock Aladdin Wealth proposal generation](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/proposal-generation)
   connects guided proposal work from identification through implementation while retaining firm
   and client criteria. Lotus exposes only the already implemented proposal-detail handoff.
3. [W3C WCAG 2.2 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
   supports relocating secondary information at narrow widths while keeping information and
   functionality available without two-dimensional page scrolling.
4. [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
   requires programmatically determinable asynchronous feedback without moving focus. Existing
   selected-action acknowledgement feedback remains mounted and scoped to the matching action.

### Adopted decisions

1. Replace Cockpit's neutral `Select a source record` workflow rail with the reusable source-and-
   scope boundary rendered inline before the action workspace, recovering the main decision canvas.
2. Keep action evidence self-contained instead of adding a second selected-action panel that would
   duplicate the complete worklist record and appear after the full screen on compact devices.
3. Preserve and validate `proposal_id` in the action view model, then expose **Open proposal** in
   both table and operational-record presentations through `/proposals/{proposalId}`.
4. Render no navigation for policy-evaluation, memo, report, execution, or malformed proposal
   references because no supported Workbench destination is proven for them.
5. Remove the redundant inner `Advisor Cockpit` heading and dead view-model title so the canonical
   page heading leads directly to source scope, decision, measures, and actions.
6. Reuse existing React, semantic HTML, CSS Modules, design-system primitives, Vitest, and
   Playwright; add no dependency or global CSS.

### Rejected decisions

1. Calling the first action selected without an advisor interaction or adding local selection state
   solely to populate a duplicate context panel.
2. Linking raw source references to guessed routes, direct service URLs, or technical support pages.
3. Hiding the source-and-scope boundary, repeating portfolio/action counts, or moving required
   action evidence behind a disclosure.
4. Adding decorative dashboard cards, inferred urgency, recommendation, approval, suitability,
   publication, delivery, or execution posture not published by the source contract.

### Validation and publication decision

Workbench #736 owns this slice. Focused model, context, route, worklist, and workspace tests prove
valid and invalid handoff behavior, one business model across both presentations, Cockpit-only
inline context, and unchanged proposal-shell defaults. Optimized-production browser proof measures
1800, 1440, 1024, and 519 pixel layouts plus the exact 64rem module boundary, one visible supported
proposal handoff, no generic workflow rail, boundary reading order, focus-stable acknowledgements,
and zero page overflow. Reviewed evidence is stored under `output/issue-736/`. No Gateway/Advise
contract, source calculation, identity, entitlement, dependency, global CSS, or runtime topology
changes. Protected PR, exact-main, wiki publication, and strict parity evidence remain required.

## Proposal Implementation Handoff And Exception Follow-Up

### Business job

An advisor needs one bounded worklist that answers whether a proposal handoff has been requested,
accepted, partially implemented, completed, rejected, cancelled, or expired; whether that evidence
belongs to the current proposal version; what needs follow-up; and what the current source cannot
prove. The screen must remain an advisory reconciliation surface rather than an execution system.

### Current-product research

Research was reviewed on 2026-08-25 from official regulatory, product, industry-protocol, post-trade, and
accessibility sources:

1. [BlackRock Aladdin Wealth proposal generation](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/proposal-generation)
   places implementation after identification, construction, and delivery and hands execution to
   an OMS. Lotus adopts the connected lifecycle and explicit handoff, not competitor layout or
   unsupported OMS capability.
2. [Salesforce Financial Services action plans](https://help.salesforce.com/s/articleView?id=sf.fsc_admin_action_plans_overview.htm&language=en_US&type=5)
   supports explicit task status and accountable handoffs. Lotus rejects owner and deadline fields
   until a source contract supplies them.
3. [FIX Trading Community](https://fixtrading.org/standards/fix-protocol/) separates order and
   execution-report state from advisory proposal state.
4. [Swift settlement and reconciliation](https://www.swift.com/securities/settlement-and-reconciliation)
   confirms settlement is a distinct post-trade chain and cannot be inferred from a handoff event.
5. [WCAG 2.2](https://www.w3.org/TR/WCAG22/) governs reflow, focus order, target size, and
   programmatically determinable asynchronous status.
6. [FCA COBS 11.3.2A](https://handbook.fca.org.uk/handbook/COBS/11/3.html) requires firms to inform
   clients about material difficulty relevant to proper execution. Lotus adopts the principle that
   a material implementation difficulty must be explicit and actionable, without claiming that the
   advisory handoff record is itself an order or execution report.
7. [FCA COBS 11.2A](https://handbook.fca.org.uk/handbook/COBS/11/2A.html) frames order execution in
   the client's best interests. Lotus preserves this as an implementation boundary and does not
   infer execution quality from proposal lifecycle or handoff acceptance.
8. [FINRA's 2024 Regulation Best Interest and Form CRS report](https://www.finra.org/rules-guidance/guidance/reports/2024-finra-annual-regulatory-oversight-report/reg-bi-form-crs)
   reinforces accurate recommendation records, disclosures, and supervisory evidence. Lotus adopts
   accurate business status and optional support evidence, not US-regulatory applicability or an
   unsupported supervisory approval claim.

### Adopted decisions

1. Use a compact selected-record worklist and decision pane; read status only for the selected
   proposal and never fan out across the returned window.
2. Lead with business posture, attention, next action, version correlation, and observation time;
   keep provider, request, event, and correlation identifiers secondary.
3. Distinguish partial evidence and earlier-version evidence instead of omitting missing facts or
   presenting them as current.
4. Announce refresh success only after the source window and exact selected status both succeed and
   reconcile; preserve prior evidence without relabelling it current on failure.
5. Reuse the Proposal lifecycle worklist, selected-record layout, design-system source action,
   semantic badges, CSS Module ownership, and existing React Query stack.
6. Translate every known status, next action, version relationship, event, evidence, and recovery
   state through one exhaustive typed business-copy authority. Preserve raw values only in the
   support disclosure.
7. Order the selected decision as status and material difficulty, key times, proposal-version
   relationship, then next business action. Do not lead with service names, contract names, or
   reconciliation identifiers.
8. Use the existing supplementary-context pattern because the main selected-record panel owns the
   decision. Retain the source-coverage boundary once and remove the duplicate responsive decision
   rail.
9. Reflow against the selected pane's actual inline size with container queries. Visible-overflow
   browser diagnostics must identify the exact rendered element, dimensions, and text when the gate
   fails while excluding only computed 1px clipped accessibility announcements.

### Rejected decisions

1. Deriving execution posture from `EXECUTION_READY` or showing route access as source proof.
2. Inventing owner, assignee, SLA, due date, urgency, priority, or whole-book totals.
3. Treating a provider or external reference as an order, fill, allocation, or settlement record.
4. Treating terminal handoff status as settlement, reconciliation, custody booking, or accounting
   completion.
5. Calling Advise, an OMS, broker, or settlement provider directly from the browser.
6. Adding decorative timelines, KPIs, cards, dependencies, or global CSS without source evidence.
7. Repeating proposal, handoff, version, timestamp, counts, and next action in a secondary rail
   after the main decision panel already provides them.
8. Using generic `source-confirmed`, `Gateway`, contract, provider, request, event, or reason-code
   language in the primary advisor workflow.

### Validation and publication decision

Workbench #750 owns the screen, #798 owns this business-copy and presentation refinement, and
Gateway #560 owns the contract. Six focused files now prove 129 copy, parser, view-model,
integration, non-duplication, fail-closed identity, partial/historical evidence, selected-only read,
permission, and atomic-refresh behaviors. Optimized Playwright proves the BFF request, progressive
support detail, source boundary, focus-stable confirmation, exact visible-overflow diagnostics, and
reflow at 1440, 1280, 1024, 720, 519, and 390 pixels. Reviewed desktop and compact evidence is
generated under `docs/evidence/issue-798-product-copy/implementation-follow-up/`. Fresh canonical
source proof remains blocked by `lotus-advise#482`; the Workbench browser journey does not weaken or
bypass that retained-state conflict. Protected exact-head review/CI, exact-main validation, wiki
publication, strict parity, issue closure, and branch hygiene remain required.

## Manage Overview Exception-Led Decision Flow

### Business job

A portfolio manager needs a rapid selected-mandate checkpoint that distinguishes source-confirmed
operating posture from missing evidence, leads with actionable exceptions, and provides a clear
handoff to the Manage workspace required for the next decision.

### Current-product research

Research was reviewed on 2026-08-22 from official wealth-platform sources:

1. [BlackRock Aladdin Wealth personalized portfolio management](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/personalized-portfolio-management-technology)
   supports connected portfolio-management workflow and evidence-backed portfolio context.
2. [BlackRock Aladdin compliance](https://www.blackrock.com/aladdin/benefits/compliance)
   supports exception-led monitoring and movement from identified issues into review workflow.
3. [BlackRock Aladdin Wealth manage business at scale](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/manage-business-at-scale)
   supports a unified working context across portfolio-management tasks.

Research informed the business hierarchy and workflow principles only. Lotus does not copy a
competitor's layout, wording, branding, calculations, or unsupported capability, and research is
not source authority for product state.

### Adopted decisions

1. Lead with incomplete evidence and active exceptions before secondary navigation.
2. Keep selected-portfolio facts, mandate posture, exception worklist, and next business handoff in
   one reading path.
3. Treat a missing mandate risk profile as **Not reported**, not **Balanced**.
4. Claim zero attention items only from a complete, non-degraded, untruncated source window.
5. Describe Construction Alternatives as **Generated on request** because Overview does not fetch
   or prove an existing alternative set.
6. Require explicit structured portfolio membership before presenting a wave as the selected
   portfolio's rebalance posture; list order and identifier text are not authority.
7. Replace the page-local feature-card mosaic and raw attention table with reusable semantic
   Workbench patterns.

### Rejected decisions

1. Decorative confidence scores, invented readiness, browser priority, or optimistic defaults.
2. Whole-book, household, team, SLA, supervisory, or enterprise queue claims absent from contract.
3. Claiming alternatives, workflow completion, approval, execution, or settlement from route access
   or a favourable badge.
4. Adding a new framework, visualization library, global CSS, or one-off component family for this
   screen.

### Validation and publication decision

Workbench #763 owns this slice. Focused design-system, view-model, and component tests prove the
fail-closed risk profile, bounded attention evidence, business task handoffs, semantic table and
navigation structure, explicit portfolio-to-wave binding, rejection of unscoped waves, and absence
of fabricated alternatives availability. The governed screen
guide and registry document Gateway/Core/Manage authority and remove only the Manage Overview #605
coverage exception. Production-browser route proof, protected CI, exact-main validation, wiki
publication, strict parity, issue closure, and branch hygiene remain required.

## Rebalance Waves Decision-First Source Context

### Business job

A portfolio manager needs to confirm the governing mandate, currency, date, readiness, proposed
changes, blocked actions, and evidence posture before requesting approval or a downstream handoff.
Optional AI commentary and campaign administration should support that decision rather than lead
the screen.

### Current-product research

Research was reviewed on 2026-08-22 from official platform and accessibility sources:

1. [BlackRock Aladdin compliance](https://www.blackrock.com/aladdin/benefits/compliance) describes
   personalized exception dashboards and resolution workflow with responsibility and ageing.
2. [BlackRock Aladdin Wealth personalized portfolio management](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/personalized-portfolio-management-technology)
   describes scaled oversight, exception-led workflow, institutional analytics, and necessary
   checks at the right time with human control.
3. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   describes high-scale rebalancing and exception-based review while respecting portfolio
   preferences and restrictions.
4. [WCAG 2.2](https://www.w3.org/TR/WCAG22/) governs logical reading/focus order, status
   communication, keyboard operation, target size, and reflow.

Research informs hierarchy and interaction principles only. Lotus does not copy competitor layout,
language, branding, calculation, or unsupported capability.

### Adopted decisions

1. Source mandate, currency, and date from the current workspace; use explicit not-reported copy
   for absent or governed-unavailable values.
2. Give each proof state distinct business copy instead of using one optimistic label with changing
   colour.
3. Put selected-wave readiness, active actions, and proposed changes before AI-assisted outputs and
   campaign administration in DOM, keyboard, and visual order.
4. Remove controls that have no supported behavior.
5. Preserve Gateway-only actions, source-owned readiness, selected-wave identity fencing, and
   explicit no-order/no-execution boundaries.

### Rejected decisions

1. Defaulting every mandate to Discretionary Balanced or every portfolio to USD.
2. Treating not-opened, pending, failed, or blocked proof as available evidence.
3. Leading a portfolio decision with AI generation or broad campaign administration.
4. Adding browser-owned filters, priority, readiness, mandate impact, order, execution, or
   settlement state.
5. Adding another component library, global CSS family, or decorative lifecycle visual.

### Validation and publication decision

Workbench #769 owns this slice. Focused model and component tests prove source-context fallbacks,
proof-state language, primary section order, and removal of the no-op control. The complete guide
removes only the Rebalance Waves #605 exception. Process-owned optimized-production browser proof
now covers source context, keyboard focus, proposed-change loading, section order, reflow, and zero
page overflow at 1440, 1024, 720, and 390 pixels. Full gates, protected CI, exact-main validation,
wiki publication/parity, issue closure, and branch hygiene remain required.

## Rebalance Campaign Selected-Record Decision Workflow

### Business job

A portfolio manager or campaign operator needs to scan the governed campaigns in scope, choose one
exact id/version, understand its source and governance posture, and complete one controlled review,
governance, lifecycle, or launch task without mixing evidence between records or mistaking a launch
for trade execution.

### Current-product research

Research was reviewed on 2026-08-22 from official product and accessibility sources:

1. [BlackRock Aladdin compliance](https://www.blackrock.com/aladdin/benefits/compliance) describes
   personalized exception dashboards and resolution workflow with responsibility, comments, and
   ageing. This supports attention-led triage and source-backed workflow evidence.
2. [BlackRock Aladdin Wealth personalized portfolio management](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/personalized-portfolio-management-technology)
   describes scaled oversight, exception-led workflow, institutional analytics, and necessary
   checks at the right time with human control.
3. [Temenos Wealth Front Office](https://www.temenos.com/products/wealth-management/wealth-front-office/)
   describes structured tasks and opportunities, interactive dashboards, prioritized action, and
   automation that retains human intervention.
4. [IBM Carbon data-table guidance](https://carbondesignsystem.com/components/data-table/usage/)
   distinguishes single-record selection and progressive detail from spreadsheet replacement, and
   documents keyboard-tested interaction and density variants.
5. [WCAG 2.2](https://www.w3.org/TR/WCAG22/) governs keyboard operation, focus order, status
   communication, target size, and reflow.

Research informs workflow hierarchy and interaction principles only. Lotus does not copy a
competitor's visual language, brand, calculation, or unsupported capability.

### Adopted decisions

1. Use one compact source worklist and one selected decision pane rather than a wide flat table plus
   every detail panel.
2. Keep source identity, readiness, governance, eligible count, and next action together; refresh
   detail only for the exact selected campaign.
3. Separate review, governance, lifecycle, and launch into one visible task mode at a time, with
   technical trace behind native progressive disclosure.
4. Preserve keyboard selection and focus while source evidence refreshes, and discard late results
   for a prior record.
5. Require human business rationale and consequence acknowledgement for lifecycle and launch
   mutations; show success only from the returned source response.
6. Reuse Workbench decision-workspace, record-selector, metric-strip, badge, action, and state
   patterns. Keep the new layout in a feature CSS Module and remove the superseded table.

### Rejected decisions

1. Copying Aladdin, Temenos, or Carbon visual styling or adding another component library.
2. Treating a campaign catalogue as a spreadsheet or showing all evidence/actions simultaneously.
3. Inventing advisor owner, client/household, SLA, priority, trade, order, fill, settlement, or
   client-contact fields that Manage does not publish.
4. Browser-owned membership, readiness, lifecycle, approval, or maker-checker inference.
5. Direct browser calls to Gateway or Manage, optimistic success, retained consequence confirmation,
   or a generic command body that can drift from the source contract.
6. Leading with AI-generated recommendation; this governed operating task has no supported AI action.

### Validation and publication decision

Workbench #772 and merged Gateway #567 own this slice. Four signed Workbench commits cover typed
contracts, selected-campaign fencing, selected-record UX, and BFF/browser correctness. Focused API,
builder, hook, model, component, and panel proof is green. Process-owned optimized-production
browser proof uses two campaigns and validates BFF-only requests, keyboard selection, selected
identity, focus stability after asynchronous refresh, launch consequence gating, durable-wave
evidence, repeat prevention, clean runtime, 1440/1024/720/390 reflow, and zero page overflow. Full
repository gates, protected review/CI, exact-main validation, wiki publication/parity, issue closure,
and branch hygiene remain required.

## Governed Business-Date And Timestamp Trust

### Business job

An advisor must know which calendar date governs own-book membership and portfolio-management
evidence without mistaking a fixed demonstration date, malformed URL, raw source value, or hidden
timezone conversion for confirmed business truth.

### Current-product research

Research was reviewed on 2026-08-22 from primary standards and public-sector design guidance:

1. [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339.html#section-5.6) defines `full-date`
   independently from `date-time`; an exact time carries `Z` or a numeric offset.
2. [ECMA-402](https://tc39.es/ecma402/2025/#sec-intl-datetimeformat-constructor) makes locale,
   calendar, and timezone explicit `Intl.DateTimeFormat` inputs rather than browser defaults.
3. [Unicode LDML date guidance](https://unicode.org/reports/tr35/tr35-dates.html#Time_Zone_Names)
   states that a clock value without timezone context is incomplete and describes localized zone
   presentation.
4. [GOV.UK date guidance](https://design-system.service.gov.uk/patterns/dates/) supports visible,
   unambiguous calendar-date entry and readable written-date presentation.

These sources define semantics and interaction quality only. They do not replace Gateway/Core
business-date authority, prescribe Lotus branding, or justify a new date library.

### Adopted decisions

1. Treat `YYYY-MM-DD` business dates as validated calendar components; never append a fabricated
   midnight or let host timezone conversion change the day.
2. Require an explicit request date or the bounded local development configuration before loading
   Advisor Book. Missing, malformed, and impossible dates render **Business date not confirmed**
   and make no source request.
3. Give the advisor a labelled native calendar-date recovery control that updates the governed URL
   scope and resets paging before the source request begins.
4. Require the returned Advisor Book scope date to match the requested date exactly; mismatch is a
   source-contract failure, not an alternate successful view.
5. Require timestamps to carry `Z` or an explicit offset, normalize them to UTC, and include
   **UTC** in visible output.
6. Reuse the design-system formatter authority for Advisor Book, Manage context, and Domain Product
   timestamps; remove page-local date formatting and raw ISO presentation.
7. Remove fixed route defaults beyond Advisor Book: Performance Summary enters the source-supported
   `YTD` period unless the URL supplies an explicit window; Proposal Builder starts with the
   advisory date unconfirmed unless the URL supplies a valid calendar date; construction uses the
   returned portfolio date when its bounded DPM development fixture is absent.
8. Treat date-like transaction fields as calendar dates only after the complete source value is
   either a valid business date or an offset-bearing timestamp; reject malformed and unzoned
   strings before extracting calendar components.
9. Keep an unavailable Portfolio Review source context date empty and label its period **Business
   date not confirmed**; never use a historical sentinel date merely to keep range calculation code
   running before the source workspace arrives.

### Rejected decisions

1. A hardcoded production fallback or silent substitution after invalid input.
2. Raw ISO strings as advisor-facing date copy.
3. Parsing a calendar date as midnight UTC, local time, or another instant.
4. Accepting an unzoned timestamp or hiding which clock is shown.
5. Adding Moment, Luxon, date-fns, Temporal polyfills, or another dependency for this bounded rule.
6. Expanding into user-selectable locale preferences, cross-screen context carriage, freshness
   indicators, or backend business-calendar calculations owned by #777, #779, #787, or upstream.

### Validation and publication decision

Workbench #786 owns the slice. Formatter, Advisor Book configuration/API/integration, Domain Product,
and Manage component tests prove valid and impossible dates, no-request fail-closed behavior,
request/response scope agreement, raw-ISO removal, offset-required timestamps, and UTC disclosure.
Optimized-production Playwright must prove invalid-date blocking, explicit recovery, the single BFF
request after recovery, keyboard usability, responsive layout, and zero page overflow. Advisor Book
and Manage wiki guides plus repository context carry the durable policy; protected CI, exact-main
validation, wiki publication/parity, issue closure, and branch hygiene remain required.

### Reopened same-pattern audit — 24 August 2026

The initial slice did not catch a raw Advisor Brief review timestamp and several adjacent
feature-local presentation paths. The issue was reopened and the production tree was re-audited as
one presentation-boundary problem rather than patched only at the reported screen.

Additional primary standards reviewed:

1. [Unicode CLDR date and time patterns](https://unicode.org/reports/tr35/tr35-dates.html) separate
   calendar date, clock time, and timezone presentation so an exact instant is not shown without its
   zone context.
2. [ECMA-402 `Intl.DateTimeFormat`](https://tc39.es/ecma402/2024/#datetimeformat-objects) uses the
   host environment timezone when no explicit `timeZone` is supplied; browser-local defaults are
   therefore unsuitable for stable audit evidence.
3. [WHATWG HTML `time`](https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-time-element)
   separates human-readable content from a machine-readable date/time value.

Adopted:

1. Use the existing design-system formatter as the only production formatting authority; add a
   source-tree governance test that rejects `Intl.DateTimeFormat` and `toLocaleDateString` outside
   that module.
2. Keep calendar-semantic business dates and exact audit instants as separate typed presentation
   decisions. Exact instants require `Z` or an offset, normalize to UTC, and name UTC visibly.
3. Preserve the raw exact source value only in source models or an atomic machine-readable evidence
   attribute. Visible business copy is readable and never exposes ISO transport syntax.
4. Fail closed for missing, malformed, impossible, or unzoned values rather than echoing the input,
   guessing a date kind, or substituting a demonstration date.
5. Prove timezone invariance with the Advisor Brief review transaction in both the default browser
   context and `Asia/Singapore`, including source persistence, reload, exact machine evidence,
   responsive containment, and absence of raw ISO visible text.

Rejected:

1. A one-off Advisor Brief string replacement that leaves the same pattern elsewhere.
2. Browser-local rendering, implicit timezone conversion, or locale-dependent audit semantics.
3. Automatic guessing between a business date and an exact timestamp.
4. A competing per-feature formatter or new date dependency.
5. Treating a fixture-backed screenshot as proof of the canonical Gateway/Lotus AI runtime.

Implementation removes local/raw timestamp presentation across Advisor Brief, DPM campaign and
rebalance workflows, AI preparation, proposal audit/version/implementation evidence, portfolio
memory, outcome review, fairness evidence, report ordering, and Manage workflow helpers. Dead raw
timestamp projections and fixed-date fallbacks were removed where no supported consumer remained.
The diagnostic browser pack is published under
`docs/evidence/issue-786-business-timestamps/`; canonical source-backed validation, protected CI,
review authority, wiki publication, issue closure, and clean-main hygiene remain release gates.

## Governed Review Context And Cross-Workspace Continuity

### Business job

An advisor moving from whole-book selection into portfolio review, performance, advice, reporting,
or mandate management must remain in the same portfolio, valuation date, review period, and
reporting currency. A browser refresh, drill-in, or Back/Forward action must not silently substitute
another book, revive an older source response, or make the advisor reconstruct the review context.

### Current-product research

Research was reviewed on 2026-08-23 from official product and web-platform sources:

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   describes a connected advisor experience using a common portfolio language, whole-portfolio
   views, book insights, next-best actions, and proposal workflows across the advisory lifecycle.
2. [BlackRock Aladdin Wealth householding](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/insights/householding)
   explains why account, group, and household scope matter to aggregate portfolio and risk review.
   Lotus reserves scope identity but does not claim household support before Gateway publishes it.
3. [MDN History API guidance](https://developer.mozilla.org/en-US/docs/Web/API/History_API/Working_with_the_History_API)
   distinguishes a new user-visible history entry from normalization of the current entry.
4. [WCAG 2.2 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) and
   [Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) require a
   predictable keyboard sequence and visible orientation as users move through a workflow.

These sources inform continuity and interaction principles only. Lotus does not copy another
product's layout, wording, visual identity, data model, or unsupported household capability.

### Adopted decisions

1. Use one typed, atomic URL contract for portfolio, valuation date, review period, reporting
   currency, selected record, and report-batch identity instead of page-local parsing and defaults.
2. Fail the complete review context closed when a governed value is repeated, malformed, or
   unsupported; direct the user to **My book** when portfolio selection is absent or unconfirmed.
3. Treat URL identity as a request, never as evidence. Render analytical detail only after the
   Gateway response independently confirms the portfolio and applicable date, period, currency,
   record, or batch identity.
4. Preserve the common review fields through supported cross-workspace links. Clear selected-record
   and batch identity when the destination cannot interpret them rather than leaking local state.
5. Use browser-history `push` for confirmed user choices and `replace` only for source
   normalization. Keep the mounted shell and restore focus to the persistent initiating control.
6. Fence asynchronous results and caches by the complete source identity so an A-to-B-to-A route
   sequence cannot publish an older response under a newer review.
7. Prove the contract with unit round trips and negative input corpora, integration no-call and
   source-mismatch boundaries, and optimized-production Portfolio-to-Performance Back/Forward and
   focus evidence using a non-default source-backed portfolio.

### Rejected decisions

1. A canonical demo, configured, preferred, or first-catalogue portfolio as a hidden route default.
2. Salvaging a valid-looking portfolio from an otherwise ambiguous or malformed address.
3. Treating URL parameters, React state, fixture constants, or the previous screen's payload as
   confirmation of current source evidence.
4. Replacing browser history for user decisions, query-keying a page to force remounts, or moving
   focus to the document body after a workspace transition.
5. Preserving selected record or report batch across a destination that has no supported contract
   for that identity.
6. Inventing household, team, delegated, supervisory, entitlement, or authentication context under
   this navigation contract.

### Validation and publication decision

Workbench #779 owns the slice. The shared contract, shell, Advisor Book, Portfolio and record
screens, Performance, Proposal, Report Centre, Advisory, and Manage integrations carry focused
failure, source-identity, race, history, focus, and no-call proof. The optimized-production browser
journey uses `PB_SG_INCOME_001`, historical date `2026-02-24`, period `1Y`, and currency `USD` to
prove Portfolio to Performance and browser Back without context or focus loss. Full repository
gates, protected review/CI, exact-main validation, wiki publication/parity, issue closure, and
branch hygiene remain required.

## Shell-Owned Review Context And Identity Economy

### Business job

An advisor moving through portfolio review, performance, mandate management, advice, proposal
construction, and reporting must be able to confirm the selected mandate immediately without
re-reading the same identity card in the header, navigation rail, and evidence rail. The shared
context must orient the decision while leaving the first viewport to the work that needs attention.

### Current-product research

Research was reviewed on 2026-08-23 from official design-system and accessibility guidance:

1. [SAP Fiori Object Page](https://experience.sap.com/fiori-design-web/object-page/) and
   [Dynamic Page](https://experience.sap.com/fiori-design-web/dynamic-page-layout/) keep durable
   business-object context in the page header while the content hierarchy remains task-led.
2. [IBM Carbon global header](https://carbondesignsystem.com/patterns/global-header/) separates
   persistent product navigation from page-specific business content.
3. [Fluent 2 toolbar guidance](https://fluent2.microsoft.design/components/web/react/core/toolbar/usage)
   groups related controls and uses bounded overflow rather than an ambiguous wrapped action row.
4. [WCAG 2.2 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) requires content and
   functionality to remain available without page-level two-dimensional scrolling.

These sources inform hierarchy, density, and responsive behavior only. Lotus does not copy another
product's visual identity, introduce a new component library, or infer portfolio evidence from the
browser address.

### Adopted decisions

1. Render one compact semantic `ReviewContextStrip` beneath the persistent product shell and above
   each selected-portfolio task.
2. Show portfolio display name, mandate type, booking centre, business date, and reporting currency
   in the scan path; keep portfolio and client references in a native support disclosure with copy
   actions.
3. Let each route assemble the typed strip model from the Gateway-backed response it already owns;
   Performance may load its supporting portfolio shell in parallel with its primary response.
4. Delete page-header identity pills, selected-portfolio rail blocks, and identity-only right-rail
   cards. Keep right rails for different decision, evidence, and action content.
5. Treat governed Proposal Builder portfolio, date, currency, and mandate context as read-only;
   keep only supported proposal intent editable.
6. Degrade the strip explicitly when supporting context is partial or unavailable. Do not display
   an unconfirmed route identifier or construct portfolio-scoped recovery links from it.
7. Test context ownership by removing the strip from the rendered DOM and proving portfolio,
   client, and booking-centre identity does not remain elsewhere. Permit a date or currency to recur
   only when it is a material term of a dated metric, analytical window, or reviewed report request.
8. When Proposal Builder's lightweight workspace shell is unavailable, reuse an identity-matched
   Gateway portfolio-book response as partial source context for both the strip and construction
   form. Show confirmed facts, mark missing mandate classification, and keep a foreign book response
   outside both display and action authority.
9. Treat that server-owned shell decision as the admission boundary for the client-side portfolio
   evidence query. A later browser refresh may update construction evidence, but cannot enable
   evaluation, handoff, portfolio navigation, or a portfolio-scoped queue link while the strip is
   still unconfirmed.

### Rejected decisions

1. A large KPI-style object header that competes with the first business decision.
2. A permanently tall or page-local identity card on every workspace.
3. An unconditional duplicate portfolio-book call while the workspace shell is healthy,
   URL-derived display truth, or a canonical demo fallback.
4. Silent truncation, page-level horizontal scrolling, or removal of operational references.
5. Duplicating governed context as editable Proposal Builder fields.

### Validation and publication decision

Workbench #814 owns this slice. Shared component, source-model, integration, identity-census,
failure, recovery, responsive, and canonical browser proof must cover Portfolio, Performance,
Manage, Advisory/Proposal, and Report Centre. The six screen guides, repository context, and
codebase review ledger carry the reusable rule. No Gateway/API/OpenAPI, calculation, dependency,
authentication, entitlement, or new UI framework change is required.

## Productive Workbench Typography And Financial Scan Geometry

### Business job

An advisor scanning a portfolio must distinguish the task, evidence grouping, routine labels, and
financial values without decoding decorative type treatments. Long reporting-currency values must
remain comparable at a glance instead of wrapping, breaking inside a number, or colliding with the
next metric. Density must come from hierarchy and reflow, not 11px text, forced uppercase, or
near-black weight on every label.

### Current-product research

Research was reviewed on 2026-08-23 from official design-system, accessibility, and publisher
sources:

1. [IBM Carbon productive type sets](https://carbondesignsystem.com/elements/typography/type-sets/)
   distinguish productive, task-focused interfaces from expressive editorial moments and provide
   a compact hierarchy for data-rich software.
2. [IBM Carbon typography overview](https://carbondesignsystem.com/elements/typography/overview/)
   uses IBM Plex as the product system's open-source type family and treats typography as a
   deliberate hierarchy rather than independent per-component styling.
3. [WCAG 2.2 Text Spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing) requires
   content and function to survive increased line, paragraph, word, and letter spacing without
   loss or overlap.
4. [IBM Plex publisher repository](https://github.com/IBM/plex) provides the released WOFF2 assets
   and SIL Open Font License used by the governed local delivery path.

These sources guide role hierarchy, legibility, and reflow. They do not make Carbon a Workbench
dependency or transfer IBM's product styling to Lotus.

### Adopted decisions

1. Use a restrained productive scale: 24px workspace/page titles, 18px section/panel titles, 14px
   business reading and table cells, 12px routine labels and headers, and 13px supporting copy.
2. Limit operational weights to 400, 500, and 600. Remove local 650–800 weights that attempted to
   create hierarchy through darkness rather than structure.
3. Keep routine labels and table headers in sentence or title case with restrained tracking.
   Reserve uppercase for genuine eyebrows, badges, and source/technical codes.
4. Keep financial values single-line with tabular numerals and normal word breaking; reflow the
   container before allowing a currency value to collide. Portfolio Review uses three columns by
   two rows on wide screens, then two and one columns as capacity narrows.
5. Make the canonical token layer the only semantic type authority. Migrate KPI, Portfolio health,
   Proposal, and record-selector presentation to owned modules rather than adding more late global
   exceptions.
6. Adopt pinned IBM Plex Sans 1.1.0 static 400/500/600 files for the operational UI through the
   existing same-origin Next local-font boundary. Retain Cormorant only for the Lotus wordmark and
   IBM Plex Mono only for technical evidence.
7. Keep the choice reproducible: `npm run test:e2e:typography:compare` renders pinned IBM Plex Sans
   and Inter candidates independently in the same optimized Portfolio Review at 1440, 1024, 768,
   and 519 pixels and fails on family substitution, metric overflow, wrapping, or page overflow.
8. Apply the productive roles to the shared Review Context strip itself: a single uppercase eyebrow,
   sentence-case 12px/500 business labels, 14px/500 confirmed values, 14px/400 unavailable values,
   and a 14px/600 support control. Prove the real component at 1440 and 519 across confirmed,
   partial, and unavailable source states rather than inferring completion from a font-family swap.

Both candidates passed the final geometry assertions. IBM Plex Sans reduced operational WOFF2
bytes from 352,240 to 196,820 and rendered the longest tested AUM/Invested value at 168 pixels
rather than Inter's 177 pixels, approximately 5% narrower. The decision is evidence-backed but
does not claim universal typeface superiority.

### Rejected decisions

1. Blaming the Inter family alone while leaving the late 11px/13px token override, forced
   uppercase, inflated weights, and six-column metric collision intact.
2. Importing another UI framework, runtime font package, public font service, unpinned candidate,
   or browser telemetry to improve typography.
3. Shrinking financial text, enabling arbitrary word breaks, or clipping values to preserve an
   overloaded grid.
4. Treating one screenshot as proof without computed family, weight, size, containment, wrapping,
   responsive-width, and same-origin delivery assertions.

### Validation and publication decision

Workbench #829 owns the slice. Production asset governance, semantic token authority, focused
component tests, the seven-width Portfolio review matrix, independent A/B comparison, same-origin
delivery proof, full repository gates, protected review/CI, exact-main validation, wiki
publication/parity, issue closure, and clean branch/worktree restoration are required. No Gateway,
API/OpenAPI, business calculation, authentication, entitlement, or new runtime dependency changes.

## Decision-First Daily Worklists

### Business job

An advisor or portfolio manager entering a daily operating screen must identify what needs
attention, understand the selected record's evidence and constraints, and reach the next permitted
business action without decoding repeated counts, destinations, card headings, or raw source
references. A dense workstation therefore needs one queue interaction model and a deliberate
separation between business decision evidence and operational support detail.

### Current-product research

Research was reviewed on 2026-08-24 from primary product and standards sources:

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   positions advisor work around Book Insights, next-best actions, risk and oversight alerts, and
   exception-based portfolio review at scale. This supports attention-led worklists rather than
   passive status-card stacks.
2. [BlackRock holistic engagement](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/engage-clients-holistically)
   follows a whole-portfolio understanding, constrained evaluation, proposal, and implementation
   sequence. The selected pane should therefore order context, evidence, constraints, and the next
   permitted action.
3. [Temenos Wealth Front Office](https://www.temenos.com/products/wealth-management/wealth-front-office/)
   emphasizes reusable workflows and interactive dashboards for advisor and portfolio-manager
   efficiency. Lotus keeps source-backed content configurable while standardizing the interaction.
4. [BlackRock on AI-enabled advisor workflows](https://www.blackrock.com/aladdin/discover/blog/ai-enabled-investor)
   describes AI content as governed advisor-reviewed work. Future AI-derived worklist evidence must
   be identified, evidence-linked, and human-reviewed rather than presented as unexplained advice.
5. [WAI-ARIA listbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/) and
   [WCAG 2.2 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) support predictable
   keyboard selection and preservation of content and function when available width narrows.
6. [Avaloq Client Management](https://www.avaloq.com/platform/client-management) describes one
   integrated front-office interface for daily tasks, transactions, relationships, prospects, and
   news. Lotus applies the workflow-coherence principle without copying Avaloq's presentation or
   claiming unsupported cross-domain capability.
7. [IBM Carbon UI shell](https://web-components.carbondesignsystem.com/?path=/story/components-ui-shell--header-base-w-navigation-actions-and-side-nav)
   assigns dependable product movement to side navigation, while contextual panels support the
   current task. This supports one navigation owner and distinct evidence-only secondary rails.

These sources inform workflow order and interaction quality. They do not transfer another
vendor's visual identity, calculations, data, entitlement model, or claims to Lotus.

### Adopted decisions

1. Compose the existing controlled record selector and decision workspace into one
   `WorkbenchWorklist`; keep business row/detail content owned by each feature.
2. Let the list answer **what needs attention and why now**. Let the selected pane answer **what
   evidence and constraints matter, and what action is permitted next**.
3. Preserve Arrow-key row movement, Enter transfer into an associated focusable detail region,
   stable controlled selection, disabled-row posture, and capacity-based stacked reflow.
4. State a count, status, destination, and title once in the primary scan path. Secondary rails may
   carry different scope or support evidence, but not repeat the active queue or navigation.
5. Lead Cockpit with source actions, Manage Overview with attention and rebalance decisions, and
   Advisory Overview with proposal decisions. Combine Advisory stage/readiness into one status.
6. Keep My Book as a comparison register, retain its horizontal metric strip, consolidate repeated
   limitations by business meaning, and move raw source references into one collapsed support
   disclosure.
7. Treat the first decision row below 900 pixels at 1440 as a product defect and protect the
   intended hierarchy with optimized-browser geometry assertions rather than screenshots alone.
8. On Manage, keep workflow destinations in the left rail, operating posture and decisions in the
   centre, and only distinct source-evidence availability in the right rail. On Cockpit, state the
   action title once in the row and disclose its source category and complete reason in the selected
   pane.

### Rejected decisions

1. A new page-specific master/detail component for each surface.
2. Repeating the same destinations in the navigation rail, centre-card grid, and next-actions rail.
3. Keeping both proposal stage and readiness badges when their combination is the business status.
4. Rendering correlation, snapshot, or unknown-source codes as primary advisor content.
5. Calling diagnostic fixtures canonical evidence or weakening geometry assertions to preserve a
   tall layout.
6. Replacing a duplicate right rail with another page-local action menu, KPI stack, or navigation
   treatment that creates a second information owner.

### Validation and publication decision

Workbench #811 owns the reusable pattern and four-screen adoption. Focused model, component,
integration, accessibility, failure/recovery, responsive, exact-occurrence, height, and
optimized-production browser proof is required. Diagnostic screenshots are stored separately from
canonical populated evidence; canonical capture remains blocked by #846. Screen guides, the screen
registry, repository context, and codebase review ledger must ship in the implementation PR. No
Gateway/API/OpenAPI, source calculation, authentication, entitlement, dependency, or runtime
topology change is required.

## Stable Interactive Relationships Across Server Rendering

### Business job

An advisor must be able to open navigation and move from a prioritised worklist row to its selected
decision without a stale or ambiguous control relationship. The same interaction must remain
predictable on a fresh document load, after responsive reflow, and when reusable components share a
screen.

### Current-product research

Research was reviewed on 2026-08-24 from primary framework and accessibility sources:

1. [React `useId`](https://react.dev/reference/react/useId) requires server and client component
   trees to match for generated ids to remain stable.
2. [Next.js issue #84029](https://github.com/vercel/next.js/issues/84029) confirms a
   composition-sensitive React-id hydration defect in the Workbench framework generation and
   records its later-framework resolution.
3. [WAI-ARIA Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) requires the
   disclosure control and disclosed region to retain an explicit relationship.
4. [WCAG H93](https://www.w3.org/WAI/WCAG21/Techniques/html/H93) requires unique page ids so
   assistive-technology relationships do not become ambiguous.

### Adopted decisions

1. Let each business screen name its shared rail or worklist once with a semantic
   `relationshipIdBase`; let the component derive all subordinate relationship ids.
2. Keep relationship ownership independent of render order, sibling composition, and the current
   framework defect so identifiers stay legible in diagnostics and collision-safe in reuse.
3. Prove fresh optimized-production loads on Portfolio Review, Performance, and Manage with a
   reusable browser helper that checks exact targets, controller presence, duplicate ids, and
   browser runtime failures.
4. Retain the server-rendered, keyboard-operable component architecture and the existing Gateway
   source boundaries.

### Rejected decisions

1. `suppressHydrationWarning`, because it hides drift and leaves React attributes stale.
2. Making shared navigation or decision worklists client-only, because it removes useful server
   output and masks the ownership defect.
3. Patching installed framework files, adopting a canary, or mixing the Next.js 16 upgrade from
   #624 into a bounded accessibility regression.
4. Hard-coding one repeated id inside the shared component or weakening browser assertions to copy
   that happens to render today.

### Validation and publication decision

Workbench #855 owns the reusable correction. Unit collision proof, production-caller governance,
focused integration tests, shared-runtime read-only reproduction, optimized production browser
proof, evidence publication, repository context, architecture wiki source, protected review/CI,
exact-main validation, wiki parity, and clean branch/worktree restoration are required. No Gateway,
API/OpenAPI, business calculation, authentication, entitlement, dependency, or runtime topology
change is required.

## Selected Portfolio Value Versus Adviser-Book AUM

### Business job

A client adviser or portfolio manager reviewing one selected portfolio must be able to identify its
current base-currency market value without mistaking that account-level figure for the assets under
management of their wider book, relationship, team, or firm.

### Current-product research

Research was reviewed on 2026-08-24 from primary regulatory, wealth-platform, and service-design
sources:

1. [SEC Form ADV instructions](https://www.sec.gov/files/formadv-instructions.pdf), Item 5.F,
   calculates regulatory assets under management across the securities portfolios for which an
   adviser provides continuous and regular management. It is an adviser aggregate, even though
   current market values of the underlying portfolios contribute to it.
2. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   separates **Book Insights** across an adviser's business from individual **Portfolio
   Management**, while promoting one consistent language of portfolios across the organisation.
3. [GOV.UK writing for user interfaces](https://www.gov.uk/service-manual/design/writing-for-user-interfaces)
   recommends user language, short direct labels, important words first, and sentence case to
   reduce cognitive effort in transactional interfaces.

### Adopted decisions

1. Use **Portfolio value** for the source-backed base-currency market value of one selected
   portfolio across Portfolio Review, record headers, unavailable-state copy, and metric detail.
2. Describe invested-assets and cash weights as a percentage **of portfolio value**.
3. Keep the Gateway `assets_under_management_base` field and `PORTFOLIO_AUM_UNAVAILABLE` reason
   code at the adapter boundary while translating them through one portfolio terminology module.
4. Reserve **AUM** for a future source-backed adviser-book, relationship, or firm aggregate.
5. Protect the boundary with direct component/view-model/drawer assertions and a recursive source
   guard that permits only the two known contract identifiers.

### Rejected decisions

1. Renaming the Gateway field inside Workbench or changing its numeric mapping; the source value is
   correct and this slice does not own the API contract.
2. Summing visible portfolio rows in the browser to manufacture book AUM; paging, currency,
   coverage, entitlement, and zero-versus-unavailable semantics belong to the source contract.
3. Replacing labels independently on each screen without a reusable terminology authority.
4. Treating the correction as evidence that a book-level AUM capability now exists.

### Validation and publication decision

Workbench #797 owns this bounded correction. Focused unit, integration, accessibility-name,
responsive browser, screen-documentation, full repository, protected CI, exact-main, wiki
publication/parity, and clean branch evidence are required. Gateway #573 and Workbench #470 remain
the authority for a future adviser-book aggregate. The broader product glossary and copy-layer
mechanism remain sequenced under #799 and #798.

## Product Vocabulary and Business Language

### Business job

A client adviser or portfolio manager moving between portfolio, performance, suitability,
portfolio-management, and reporting work must encounter one stable business language. Terms must
preserve the source and decision distinctions needed to reconcile a figure, judge readiness, and
take the next permitted action without interpreting implementation vocabulary.

### Current-product research

Research was reviewed on 2026-08-24 from primary standards, regulatory, product, and service-design
sources:

1. [CFA Institute GIPS Standards Handbook for Firms](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/)
   distinguishes time-weighted and money-weighted returns and supports explicit method disclosure
   rather than a bare return label.
2. [FCA COBS 9A suitability rules](https://handbook.fca.org.uk/handbook/COBS/9A/) use suitability
   assessment and suitability-report language for the client-advice workflow. Policy evaluation is
   supporting evidence, not the workflow name.
3. [FCA investment-manager guidance](https://www.fca.org.uk/firms/authorisation/wholesale-markets/investment-managers)
   and the FCA glossary distinguish discretionary management, advisory activity, and execution-only
   transactions. Workbench may render only the service model supplied by its source contract.
4. [SEC Form ADV instructions](https://www.sec.gov/files/formadv-instructions.pdf) define regulatory
   assets under management as an adviser aggregate, supporting portfolio value for one selected
   record and adviser book/AUM only for source-backed aggregate scope.
5. [GOV.UK writing for user interfaces](https://www.gov.uk/service-manual/design/writing-for-user-interfaces)
   recommends user language, short front-loaded labels, and sentence case for transactional UI.
6. [SAP Fiori work-list guidance](https://experience.sap.com/fiori-design-web/v1-50/work-list/)
   treats a worklist as prioritised, processable work. That supports attention item for the user
   queue while retaining source exception as a distinct evidence record.
7. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   separates book-level insights from individual portfolio management and uses consistent
   portfolio language across the adviser workflow.

These sources inform terminology and workflow hierarchy only. They do not transfer another
provider's design, data, entitlement model, calculations, or product claims to Lotus.

Performance implementation was reconfirmed on 2026-08-25 against two primary sources before the
runtime terminology was introduced:

1. [CFA Institute's time-weighted versus money-weighted return guidance](https://rpc.cfainstitute.org/sites/default/files/docs/codes-and-standards/introduction-to-the-gips-standards-for-asset-owners_requirements_online.pdf)
   defines TWR as neutralising external-cash-flow effects and MWR as reflecting their timing and
   size. Lotus therefore presents the two as different methods, never interchangeable figures.
2. [BlackRock Aladdin investment accounting](https://www.blackrock.com/aladdin/platforms/products/aladdin-accounting)
   separates official return production, valuation/performance oversight, and exception-based
   control. Lotus adopts the source-owned, exception-led review principle without claiming Aladdin
   parity, official-return status, or GIPS compliance.

Suitability implementation was reconfirmed on 2026-08-25 against current primary regulatory
guidance before the workflow language was aligned:

1. [FCA COBS 9A.2](https://handbook.fca.org.uk/handbook/COBS/9A/2.html) frames suitability around
   the client's knowledge and experience, financial situation and capacity for loss, investment
   objectives, and risk tolerance. Lotus therefore names the adviser task **Suitability review**;
   it does not imply that the browser itself performs or completes the assessment.
2. [ESMA's 2022 MiFID II suitability guidelines](https://www.esma.europa.eu/sites/default/files/library/esma35-43-3172_final_report_on_mifid_ii_guidelines_on_suitability.pdf)
   reinforce a client-specific, evidence-led assessment and durable controls. Lotus therefore
   keeps the source policy record and its evaluation identity visible as supporting evidence while
   presenting one prioritised review worklist and next permitted action.

Outcome-review implementation was reconfirmed on 2026-08-25 against primary regulatory and
wealth-platform sources before the comparison and handoff language was aligned:

1. [FCA COBS 9A](https://handbook.fca.org.uk/handbook/COBS/9A/) requires client-facing information
   and suitability reporting to remain fair, clear, and not misleading. Lotus therefore does not
   promote a narrow tolerance comparison into a broader mandate-compliance or client-suitability
   conclusion.
2. [Commission Delegated Regulation (EU) 2017/565](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A02017R0565-20191011)
   requires portfolio-management periodic statements to support meaningful comparison with agreed
   objectives or benchmarks. Lotus therefore keeps expected outcome, realised outcome, variance,
   review posture, and evidence availability distinct.
3. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   describes connected portfolio monitoring and outcome-oriented review across the adviser
   workflow. Lotus adopts the connected, exception-led review principle without copying another
   product's layout or claiming unsupported optimisation, entitlement, or decision authority.

### Adopted decisions

1. Maintain one cross-domain meaning authority in
   `docs/documentation/product-vocabulary.md`, with a reader-facing wiki index; keep runtime copy in
   the module that owns the business semantics.
2. Use portfolio for one selected record and adviser book only for the adviser-level population.
3. Use attention item for processable work and exception only for an actual source exception;
   preserve availability, evidence coverage, and review readiness as separate facts.
4. Preserve requested as-of date versus source valuation date and distinguish base, reporting,
   instrument, and transaction currencies. Reporting currency requires explicit source acceptance.
5. Name Time-weighted return (TWR) and Money-weighted return (MWR) at first meaningful use while
   keeping NET/GROSS as a separate fee-basis dimension.
6. Use proposal and Suitability review for the business workflows; policy remains supporting
   evidence. Use instruction, wave, and campaign for increasing rebalance scope.
7. Use UK English, sentence case, business benchmark labels, and progressive support disclosure for
   technical references.
8. Name the Suitability review source boundary as an authoritative policy record, not as
   `Gateway-backed` implementation topology; preserve Gateway and Advise ownership in engineering
   and integration documentation.
9. Present Manage tolerance results as **Within expected tolerance** or **Outside expected
   tolerance** and keep them separate from **Review posture** and source-evidence availability.
10. Label the generated handoff as an **AI-assisted review summary**, state that human review is
    required, and keep it behind the source-returned action gate.
11. Order Outcome reviews around comparison, mandate impact, source evidence, and the next permitted
    action; keep source lineage and support reasons as progressive detail.
12. Align the Advisory overview worklist heading to **Adviser priorities** and make canonical
    browser proof assert that exact accessible heading. This bounded correction is owned by #864;
    it repairs a pre-existing product/validation mismatch without expanding the slice into a blind
    application-wide rename.
13. Keep role-first owner labels in productive summaries, but render **business role · exact actor
    reference** in append-only campaign launch and lifecycle evidence. Unknown actors remain exact
    and missing actors remain explicit; Workbench must not infer an unavailable role. This review
    correction is owned by #866.
14. Present Risk and Impact as **proposal evidence**, **decision readiness**, **Evidence
    available**, **Evidence incomplete**, or **Evidence unavailable**. Degraded states name the
    missing allocation, risk, workflow, or decision-register evidence, retain independently usable
    proposal information, and state the recovery action. Gateway topology, `source-confirmed`,
    auditor posture, and non-inference disclaimers remain in engineering or progressive support
    evidence rather than the adviser decision path. This #798 slice preserves the source-returned
    workflow gate and does not promote evidence availability into approval or client readiness.
15. Present Advisory Copilot as **AI-assisted proposal-review preparation** and show the proposal
    evidence, human-review requirement, and client-use boundary together. Map canonical
    availability, review, and client-use codes through a typed copy authority; use the proposal
    title rather than its source id in the primary status summary; and keep exact workflow, packet,
    run, hash, provider, and model references in the output-adjacent disclosure. Internal review
    remains a persisted source action but cannot upgrade generated material to client-approved
    communication. This bounded #798 copy slice and #605 guide use the existing Carbon, Microsoft
    HAX, NIST AI RMF, and FINRA research rather than introducing a competing AI presentation.
16. Present Advisory Overview as a proposal-prioritisation worklist: name the proposal information,
    decision and next action instead of transport, source-ownership or abstract posture. Adopt
    BlackRock Advisor Center 360's unified portfolio-analysis and client-preparation principle,
    SAP Fiori's recognise-diagnose-resolve message pattern, and WCAG 2.2 status-message semantics.
    A completed refresh is announced as **Update complete** only after the proposal query succeeds;
    earlier proposals remain explicitly available after a failed update. Preserve the exact
    returned creator reference in selected proposal evidence rather than replacing it with the
    unhelpful phrase **Recorded by source**. Reject toast-only confirmation, raw service names,
    fallback proposals, invented freshness, and lifecycle-derived approval claims. This #798 slice
    uses one typed Advisory Overview copy authority and aligns the shared proposal navigation,
    internal-use banner, workflow status and proposal-coverage boundary to the same business
    vocabulary. Gateway/Advise ownership remains in source and support documentation rather than
    productive page copy.
17. Present Proposal Detail narrative work as **recommendation rationale → advisor review →
    discussion pack → delivery record**. This adopts BlackRock Aladdin Wealth's visible
    identify/construct/deliver/implement progression, FCA COBS 9A.2's evidence-led suitability
    obligation, and SEC Regulation Best Interest's written recommendation disclosure boundary.
    Bind review to the active source version, require a reviewer reference and rationale, and admit
    discussion-pack preparation only after refreshed advisor-review evidence agrees with the action
    response. Keep exact policy, hash, reviewer, and delivery-time references in progressive review
    detail. Reject an editable version in the primary workflow, assumed production identity,
    service-topology copy, a premature pack request, client-send controls, and success based only on
    an HTTP response. This #798 slice uses the shared Workbench status strip, Support details, and
    visible-overflow diagnostics without changing Gateway/Advise contracts or production auth.
18. Present Proposal Detail memo work as **memo evidence → advisor review → discussion material →
    record and audience**. This applies BlackRock Aladdin Wealth's connected proposal-to-client
    workflow, FCA COBS 9A's evidence-led suitability boundary, and the existing governed-AI
    human-review rule without copying competitor layouts or claiming unsupported authority. Keep
    the source version read-only, require an explicit advisor reference, gate downstream material
    on the exact retained memo hash, and confirm success only after the required Gateway-backed
    views agree. Generated commentary remains an optional working aid. Reject invented actor
    defaults, permissive unknown states, mutation-only success, raw source failures, client-send
    controls, and any suggestion that a memo or commentary completes suitability, approval,
    delivery, or execution. This #798 slice reuses the Workbench status strip, Support details,
    evidence formatter, and responsive decision-workspace patterns.

### Delivery scope and deferred surfaces

This PR converts the vocabulary authority plus bounded Portfolio review, Positions, Income and
activity, Projected cash flow, Performance, Manage, Suitability review, Report centre, Outcome
review, Adviser priorities, and campaign audit-actor paths covered by focused semantic and rendered tests. It deliberately
does not claim application-wide completion; #799 remains open until the remaining governed concepts
are aligned and proven.

The following observed literals are deferred, not approved exceptions: **Advisor Memo And Evidence
Pack**, **Current Positions**, **Draft Order Blotter**,
**Review Posture**, **Recommended Actions**, and the evidence-rail handoff **Mandate Operations**.
They remain candidate slices under #799, with the
general copy-layer and banned-token enforcement owned by #798. A fixing slice must inspect each
literal in its business context before changing it so that review posture, proposal evidence,
positions, draft instructions, and next actions are not collapsed into cosmetic synonyms.

### Rejected decisions

1. One giant design-system or application-wide string constants file detached from domain meaning.
2. A blind synonym replacement that collapses exception, attention, availability, coverage,
   readiness, or supportability into one status.
3. Calling a base-currency fallback reporting currency, a requested date valuation date, or
   NET/GROSS the return method.
4. Inferring execution-only service, action eligibility, source capability, or calculation method
   from absent data.
5. Renaming API fields, routes, or source identifiers merely to make implementation terms match UI
   copy.
6. Repeating raw benchmark codes, correlation identifiers, reason codes, or service names in the
   primary business path.
7. Renaming a policy evaluation as the adviser workflow, presenting Gateway topology as productive
   UI, or claiming that Workbench assesses suitability, approves sign-off, waives controls, or
   authorises client communication.
8. Translating a tolerance result into **Within mandate**, compliant, suitable, approved,
   client-ready, or execution-complete.
9. Calling a generated workflow action `AI narrative` in the productive path, hiding AI provenance,
   or presenting generated commentary as source evidence or approved advice.
10. Treating a prepared memo, requested discussion material, or generated commentary as client-ready
    communication, suitability approval, delivery evidence, or proposal-lifecycle authority.

### Validation and publication decision

Workbench #799 owns the vocabulary authority and the bounded Portfolio, Performance, Manage, and
Suitability alignment. Each screen slice requires focused semantic and rendered proof before the
next one begins, followed by full repository gates, protected exact-head review, exact-main
validation, and wiki publication/parity. Workbench #798 remains the separate owner of a general
copy-layer and jargon-enforcement mechanism; no competing framework is introduced here.

## 2026-08-28 — CSS Module escape governance and Review Evidence ownership (#805)

### Evidence and decision

Current main had already reduced `manage-workspace.module.css` from the issue's historical 4,059
lines / 708 escapes to 3,818 lines / 664 escapes, but the executable global-CSS ratchet still did
not count `:global(...)` inside CSS Modules. The repository therefore had accurate budgets for
files named as global layers and no equivalent protection against a feature module behaving as an
uncounted global stylesheet.

CSS Modules and Next.js both define module class names as locally scoped by default. MDN's cascade
guidance favours low-weight, deliberately owned selectors over specificity escalation. Workbench
will retain the proven React, Next.js, PostCSS, CSS Modules, and Vitest stack and encode that
boundary directly: discover every module under `src`, allow zero escapes by default, and retain
only exact, no-headroom exceptions for legacy interoperability. This avoids a new styling runtime,
an experimental filesystem API, and a bulk cascade rewrite.

The first migration is the Manage Review Evidence rail because it has one clear React owner and a
small complete selector family. Its four global escape arms move to imported local classes without
changing business content, source authority, information hierarchy, responsive behavior, or the
shared `DefinitionList` contract. The wider Manage module ratchets from 664 to 660 escapes. Future
slices must prove their own owner and rendered boundary; this decision does not authorize a
mechanical split of the remaining stylesheet.

### References

1. [CSS Modules: local scope and explicit dependencies](https://github.com/css-modules/css-modules/blob/master/README.md)
2. [Next.js CSS Modules](https://nextjs.org/docs/13/app/building-your-application/styling/css-modules)
3. [MDN specificity and cascade guidance](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascade/Specificity)

### Validation and publication decision

Workbench #805 owns the escape fitness function and the first Manage migration; #492 remains the
wider global-layer decomposition programme. Repository context, CSS architecture guidance, the
review ledger, and authored Architecture/Development Workflow wiki pages change because the
executable ownership rule changed. No screen guide, Gateway/API/OpenAPI contract, domain model,
calculation, dependency, runtime topology, identity, entitlement, or authentication changes.

## 2026-08-28 — Risk mandate-context truth and exception evidence (#890)

### Business workflow question

When an advisor reviews mandate exceptions, how should Workbench distinguish a genuinely aligned
portfolio-risk and concentration view from contradictory or incomplete source context without
inventing mandate policy in the browser?

### Evidence consulted

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   describes a common risk language, book-level outlier monitoring, alerts, and exception-based
   reviews as the wealth-workstation value pattern.
2. [BlackRock Aladdin Risk](https://www.blackrock.com/aladdin/platforms/products/aladdin-risk)
   emphasizes consistent portfolio risk evidence plus integrated governance, compliance, and
   exception monitoring.
3. [W3C WCAG 2.2 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color)
   requires visible information in addition to colour where colour carries status.
4. [W3C Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
   requires important status changes to be programmatically determinable without taking focus.
5. [FCA risk-warning guidance](https://www.fca.org.uk/firms/risk-warnings-mainstream-investments)
   calls for clear, balanced, non-misleading risk communication that supports understanding.

### Adopted decisions

1. Compare mandate id, version, risk profile, comparison date, mandate date, and mandate-health date
   from the raw source facts before formatting. Display strings are presentation, never identity.
2. Use three explicit cross-source outcomes when both reads are present: **aligned**, **different
   mandate contexts**, and **mandate context insufficient**. A one-sided missing value is a conflict;
   bilateral absence is insufficient evidence.
3. Keep readable status text and stable machine evidence together. Unknown source enums use warning
   posture and explicit unavailable language; they never share within-mandate styling.
4. Preserve a nullable review frequency as **Not reported** while retaining any supplied review
   state and dates. Workbench does not choose a cadence.
5. Make canonical proof source-derived: assert every exact Gateway source family, constraint key,
   and state, and reject duplicate ownership or extra/missing rendered rows.

### Rejected decisions

1. Comparing formatted labels or dates, including two identical fallback strings.
2. Treating missing-on-both as agreement or missing-on-one as an ordinary partial display.
3. Adding a browser precedence rule to hide duplicate constraints; Gateway #677/PR #683 owns the
   composer correction.
4. Hard-coding canonical states such as `within`, `breach`, or `not_defined` independently of the
   exact source payload.
5. Communicating unknown and within-mandate evidence through the same neutral tone, or using colour
   without text.

### Validation and publication decision

Focused proof covers the raw-context field matrix, formatted-date collision, bilateral and
one-sided absence, unknown constraint/review states, nullable cadence, transport preservation,
component status semantics, and source-derived canonical evidence. The Risk guide, API guide,
repository context, and codebase review ledger change because product and operator truth changed.
No Gateway calculation, Workbench CSS, dependency, authentication, entitlement, or runtime
topology change is part of this slice.

## 2026-08-28 — Historical proposal-memo receipt continuity (#889)

### Business workflow question

How should Proposal Detail preserve an already-persisted memo action when its source confirmation
belongs to version 2 but the advisor has legitimately advanced the proposal to version 3?

### Evidence consulted

1. [BlackRock Aladdin Wealth proposal generation](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth/proposal-generation)
   describes proposal work as a guided identify, construct, deliver, and implement lifecycle that
   must scale complex advisor workflows.
2. [GOV.UK confirmation pages](https://design-system.service.gov.uk/patterns/confirmation-pages/)
   treats a confirmation and reference as a durable transaction record and makes the next step
   explicit.
3. [WCAG 2.2 Status Messages](https://www.w3.org/TR/WCAG22/#status-messages) requires asynchronous
   outcomes to be programmatically determinable without taking focus.
4. The Gateway memo contract defines `current_version_no` as the latest immutable proposal version,
   while memo, projection, replay, and lineage items retain their own requested version identities.

### Adopted decisions

1. Reconcile a historical receipt only from its exact proposal version, memo id/hash, projection,
   replay, returned action event, and matching retained-lineage item.
2. Treat a later proposal-wide current version as normal monotonic lifecycle progress. Treat a
   receipt version later than the source current version as impossible and fail closed.
3. Keep complete-but-missing historical lineage distinct from genuine cross-source disagreement.
4. Retain pending receipts and confirmation failure reasons by version. Fence only same-version
   memo work; an earlier receipt remains visible without blocking source-admitted current-version
   work.
5. Keep recovery and success announcements in the typed proposal-memo copy authority with status
   semantics; never infer confirmation from a mutation response or toast.

### Rejected decisions

1. Relabelling the historical receipt as current or substituting version 3 evidence.
2. Discarding the earlier persisted action when the component remounts.
3. Requiring proposal-wide latest-version metadata to equal every nested historical record.
4. Weakening memo hash, event, proposal, requested-version, or complete-lineage validation.
5. Showing generic source-disagreement language for ordinary version progression.

### Validation and publication decision

The change is Workbench-only and does not alter Gateway, Advise, API, calculation, CSS, dependency,
authentication, entitlement, or runtime topology. Failing-first tests reproduce v2 receipt/v3
proposal progression, future-version rejection, and missing historical lineage; rendered tests prove
the earlier recovery remains visible while current-version fields and actions are usable. Proposal
Detail wiki truth, repository context, and the codebase review ledger change and require publication
after merge.

## 2026-08-29 — Asynchronous result focus continuity (#919)

### Business workflow question

When a portfolio manager requests an AI-assisted outcome-review summary, how should the Workbench
make the newly returned review context immediately discoverable without leaving keyboard focus on a
completed action or moving it before source persistence succeeds?

### Evidence consulted

1. [WAI-ARIA keyboard interface guidance](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
   requires predictable focus movement and a visible focus point for keyboard users.
2. [WCAG 2.2 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) permits
   programmatic focus on newly inserted static content when the resulting order preserves meaning
   and operability.
3. [React `useEffect`](https://react.dev/reference/react/useEffect) documents that passive effects
   may run after paint even for interaction-driven updates.
4. [React `useLayoutEffect`](https://react.dev/reference/react/useLayoutEffect) provides the bounded
   pre-paint commit timing required when the visible result and its focus target must appear as one
   coherent update.

### Adopted decisions

1. Keep the focus target on the result heading with `tabIndex=-1`; it is a contextual reading point,
   not an extra stop in ordinary sequential navigation.
2. Move focus only after the Gateway-backed result is accepted and rendered. Pending and failure
   states retain the initiating workflow context.
3. Use the shared result component's layout effect so all current outcome, proof, wave, exception,
   and operating-quality consumers inherit the same commit-synchronous handoff.
4. Prove both the component contract and the optimized Chromium workflow: keyboard activation,
   source-backed response, visible result, and focused result heading.

### Rejected decisions

1. Removing or weakening the focus assertion because isolated runs usually pass.
2. Adding arbitrary timers, retries, polling, or test-only focus calls.
3. Moving focus before source success, to a generic status region, or to `document.body`.
4. Creating a screen-local helper when the existing shared result component owns the behavior.

### Validation and publication decision

Workbench #919 owns this shared accessibility correction. The Outcome reviews guide changes because
keyboard-operating truth changed and therefore requires wiki publication after merge. No Gateway,
Manage, Lotus AI, API, calculation, copy, CSS, dependency, identity, entitlement, or runtime
topology contract changes.

## 2026-08-30 — Review-context business-object composition (#814)

### Business workflow question

How should one shell-owned review header orient an adviser across Portfolio, Performance, Mandate
Management, Advice, and Reporting without spreading short facts across an empty wide card or
hiding important context when space narrows?

### Evidence consulted

1. [SAP Fiori Object Page](https://experience.sap.com/fiori-design-web/object-page/) sizes header
   facets to their content and uses the business-object title as the persistent anchor.
2. [SAP Fiori Dynamic Page](https://experience.sap.com/fiori-design-web/dynamic-page-layout/)
   retains important header information while letting the working content remain the focus and
   adapts the header across large, medium, and small layouts.
3. [IBM Carbon productive typography](https://carbondesignsystem.com/elements/typography/style-strategies/)
   prioritises condensed, consistent task-oriented hierarchy for users completing complex work.
4. The governed Workbench source-state and viewport fixtures measure typography, slot geometry,
   overflow, DOM order, keyboard reachability, and identity ownership rather than relying on a
   screenshot alone.

### Adopted decisions

1. Treat the portfolio name as the dominant business identity and keep the compact source facts
   visually associated with it rather than distributing them into equal fractional tracks.
2. Order facts by decision value: business date, currency, mandate, then booking centre. Preserve
   that order in the DOM so responsive reflow and keyboard reading order agree.
3. Size wide-screen facts to their content with bounded optical gaps. Reflow them below the
   identity at workstation widths and into two stable columns on narrow screens.
4. Wrap portfolio identity and business facts before truncating them. Keep operational identifiers
   in the existing keyboard-accessible **Support details** disclosure.
5. Preserve identical confirmed, partial, and unavailable geometry. State changes alter truthful
   content and the existing source-state accent, not layout structure.
6. Record semantic slot order, bounding boxes, typography, and overflow in browser evidence so
   future visual drift becomes a deterministic regression.

### Rejected decisions

1. Replacing IBM Plex Sans, enlarging the header into an expressive hero, or adding animation.
2. Increasing shadows, borders, badges, or decorative colour to compensate for weak alignment.
3. Truncating the portfolio name, business date, or currency without a reveal path.
4. Implementing a pin/snap header, generic overflow menu, or new component dependency without a
   demonstrated workflow need.
5. Styling or deriving business behavior from the semantic evidence attributes.

### Validation and publication decision

Workbench #814 owns this reusable composition refinement. Component and browser proof covers
source-state parity and the governed 1440/1024/768/721/720/561/519 matrix. Repository context,
architecture wiki, research ledger, and rendered diagnostic evidence change; individual screen
guides do not change because source fields, actions, and workflow ownership are unchanged. No
Gateway, API, calculation, authentication, entitlement, dependency, or runtime topology change is
required.

## 2026-08-31 — Rebalance presentation ownership (#958)

### Business workflow question

How should the Rebalance workspace retain a dense, responsive portfolio-manager decision flow when
an earlier command-centre class system still competes with the current shared primitives and active
feature composition?

### Evidence consulted

1. [Next.js CSS Modules](https://nextjs.org/docs/13/app/building-your-application/styling/css-modules)
   recommends locally scoped component styles when feature-specific presentation is required.
2. [WCAG 2.2 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) requires information
   and functionality to remain available without unnecessary two-dimensional page scrolling.
3. [WCAG 2.2 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) requires
   sequential navigation to preserve meaning and operability as layouts adapt.
4. Current-main consumer mapping showed 38 `dpm-wave-command-center-*` escape arms, 13 unconsumed
   class names, and one shell class duplicating `SectionBlock`/`Panel`, `AnalyticsTable`, and the
   active `rebalance-*` composition.

### Adopted decisions

1. Delete the complete obsolete class family instead of moving dead CSS into a new module.
2. Keep the shared design-system primitives and current Rebalance composition as the only
   presentation authorities.
3. Replace the browser validator's presentation-class locator with the stable
   `rebalance-workspace` product-surface id.
4. Lower the exact escape baseline and forbid the retired prefix so the duplicate authority cannot
   return silently.
5. Preserve Gateway-backed data, actions, DOM order, focus order, and business language unchanged.

### Rejected decisions

1. Copying the legacy family into a CSS Module to make the file location look compliant.
2. Keeping an obsolete class as a compatibility layer for a test locator.
3. Restyling shared panel or table internals through a new feature escape.
4. Introducing CSS-in-JS, a new dependency, cascade-order changes, or a broad Rebalance redesign.

### Validation and publication decision

Workbench #958 owns the bounded deletion and recurrence guard. Component, CSS-governance, and
production-browser proof cover the governed workstation widths, reflow, overflow, and keyboard
order. Architecture context and the research ledger change. No business capability, source
contract, calculation, screen guide, supported-feature statement, or operator workflow changes, so
repo-local wiki source does not change and no wiki publication is required.

## 2026-08-31 — Governed adviser feedback decision transaction (#953)

### Business workflow question

How should an adviser tell the opportunity service whether a candidate helped the client review,
without confusing candidate evidence with the adviser's judgment or turning feedback into an
approval, suppression, conversion, or policy action?

### Evidence consulted

1. [W3C Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html)
   requires visible, descriptive labels and programmatic grouping for related choices without
   cluttering the task with unnecessary instruction.
2. [GOV.UK Radios](https://design-system.service.gov.uk/components/radios/) recommends radios for a
   small mutually exclusive choice, a conditionally revealed related question, and specific inline
   errors when the revealed answer is missing.
3. [WCAG 2.2](https://www.w3.org/TR/WCAG22/) requires input errors to be identified in text and
   asynchronous status to remain programmatically determinable.
4. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/platforms/solutions/aladdin-wealth)
   positions advisor nudges as targeted opportunities that help advisers act quickly across their
   book; feedback should therefore capture whether the opportunity was useful to the client review,
   not expose transport or model vocabulary.
5. Exact Idea main `cdc9fbc0` and Gateway main `22f67430` publish the closed
   `idea-feedback-taxonomy-v1` request and matching persisted-event response contract.

### Adopted decisions

1. Ask the business question first: **Was this opportunity useful?** Reuse the existing compact,
   keyboard-operable `WorkbenchChoiceGroup` for useful/not useful rather than adding another choice
   implementation.
2. Display **Relevant to this client** as the fixed useful reason. Reveal the seven canonical
   not-useful reasons only after **Not useful** is selected, require one explicit choice, and focus
   that field when it is missing.
3. Keep the typed consumer vocabulary and exact response-evidence matcher in one feature module;
   the component renders the contract and does not infer reasons from candidate signals.
4. Preserve the complete request and idempotency key for an unchanged retry. Changing the outcome
   or reason abandons that retry and creates a new submission.
5. Show success only after the returned event matches candidate, feedback identity, taxonomy,
   outcome, reason, and time and the owning queue/detail reads refresh.
6. Use adviser language—opportunity, usefulness, reason, saved, worklist—while keeping service and
   contract identifiers in implementation evidence.

### Rejected decisions

1. Retaining six overloaded outcomes or translating them into the new taxonomy.
2. Reusing candidate signal, ranking, review, or conversion reasons as adviser feedback.
3. Free text, auto-submission, optimistic success, or browser-owned feedback interpretation.
4. A new generic conditional-form abstraction without a second proven workflow consumer.
5. Treating HTTP or persistence status alone as sufficient evidence of the submitted feedback.

### Validation and publication decision

Workbench #953 owns this product correction. Table-driven tests cover all eight reasons, invalid
combinations, exact event evidence, missing-reason focus, retry identity, and refresh-gated success.
The isolated optimized-production browser journey proves the exact Gateway request for all eight
governed reasons, keyboard selection, and compact 820-pixel action-form reflow; canonical runtime
proof follows exact-main merge. The Opportunities and Ideas guide and
repository context change because the business workflow and source contract changed, so wiki
publication is required after merge. No authentication, identity-provider, ranking, learning,
proposal, approval, suppression, conversion, or policy capability is added.

## 2026-08-31 — Adviser opportunity presentation evidence (#954)

### Business workflow question

How should an adviser process a potentially larger source-ranked opportunity queue without an
arbitrary display limit, while Lotus records only candidates genuinely presented for review and
never mistakes fetch, filtering, render buffering, or a hidden browser tab for adviser attention?

### Evidence consulted

1. [SAP Fiori Worklist Floorplan](https://experience.sap.com/fiori-design-web/v1-50/work-list/)
   makes processing items the worklist's primary purpose and supports table filtering plus direct
   navigation to the related business object.
2. [AG Grid DOM Virtualisation](https://www.ag-grid.com/javascript-data-grid/dom-virtualisation/)
   documents viewport-only row rendering and the additional row buffer; buffer membership is
   therefore render optimization, not evidence that a user saw a row.
3. [AG Grid Accessibility](https://www.ag-grid.com/javascript-data-grid/accessibility/) recommends
   deterministic DOM order and disabling row animation, and explains the accessibility/performance
   trade-off between row virtualization, pagination, and rendering every row.
4. [WAI-ARIA Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) defines an interactive
   data grid as a composite keyboard surface with one page-tab stop and directional cell
   navigation; interactive cell content must remain programmatically discoverable.
5. [MDN Intersection Observer API](https://developer.mozilla.org/docs/Web/API/Intersection_Observer_API)
   and [Page Visibility API](https://developer.mozilla.org/docs/Web/API/Page_Visibility_API)
   distinguish asynchronous root intersection from document visibility. Registration or an
   initial non-intersecting callback is not a presentation event.
6. Exact Idea main `4c8c63a5` publishes independent positive global rank and visible-count
   semantics. Gateway #692 owns transparent transport of those facts; Workbench owns only the
   viewing interaction and presentation.

### Adopted decisions

1. Replace the first-12 truncation and plain table with one bounded, filterable AG Grid over the
   complete returned source window. Keep five decision-oriented columns: opportunity, queue
   position, review priority, decision evidence, and next decision.
2. Preserve Idea's global rank even when filtering leaves one visible candidate. Workbench never
   renumbers the queue or inflates visible count; rank 25 with visible count 1 is valid.
3. Observe exact candidate content against the browser viewport at 50% intersection and only while
   the document is visible. Browser intersection applies ancestor clipping from the bounded grid
   scrollport, so neither an off-screen grid nor a render-buffer row can become presentation
   evidence. Clear queued intersection state and disconnect observation when the document becomes
   hidden; foregrounding must produce a fresh browser intersection result rather than replaying
   cached visibility.
4. Coalesce the currently visible set into visual order, hash the exact identity array once, and
   freeze each candidate's UTC observation, source versions, payload, and idempotency key across
   retry.
5. Keep the grid named, deterministic in DOM order, non-animated, and keyboard navigable. Render
   all five columns in the accessibility tree while retaining row virtualization for the bounded
   processing window.
6. Show a compact, non-blocking warning when evidence cannot be recorded. Candidate review remains
   available, success is not implied, and retry resubmits the unchanged observation.
7. Keep tenant authority at the BFF. Browser-owned tenant fields fail before Gateway; Workbench
   accepts persistence only when the returned durable receipt matches every frozen observation
   field, and the BFF rejects a successful receipt attributed to any tenant other than its exact
   server-derived authority.
8. Keep the evidence primitive compatible with the governed HTTP origin. Native Web Crypto digest
   remains preferred, with admitted `@noble/hashes` SHA-256 as the contained fallback; generate the
   UUID-quality idempotency key from `crypto.getRandomValues`, which remains available without a
   secure context. Do not make canonical proof depend on `SubtleCrypto` or `crypto.randomUUID`.
9. Bind unavailable evidence to the source snapshot. Missing rank, policy, or candidate versions
   keep that snapshot unavailable even if an earlier valid receipt finishes later; only a changed,
   valid source snapshot may restore readiness.

### Rejected decisions

1. Treating queue fetch, component mount, AG Grid rendered-row APIs, row-buffer membership, focus,
   or scrolling intent as presentation.
2. Keeping the 12-row cut-off, rendering a long card stack, or creating a separate summary tile for
   facts already present in the worklist.
3. Browser-owned rank, policy, candidate versions, tenant, effectiveness result, or reassuring
   success after a transport-only response.
4. One observer per row, a generic analytics dependency, background-tab recording, or a changed
   payload under the same idempotency key.
5. Pagination for the current bounded source window because it adds processing clicks and divides
   one ranked queue. Revisit this trade-off if assistive-technology testing shows that virtual row
   discovery is inadequate; do not disable accessibility checks to preserve virtualization.

### Validation and publication decision

Workbench #954 owns this bounded workflow and authority correction. Unit tests cover strict source
facts, HTTP-origin digest/idempotency compatibility, exact accepted/replayed and tenant authority
evidence, unavailable-snapshot races, hidden/off-screen/rerender behavior, and unchanged retry. The
focused production-browser test uses 25 candidates to prove that render-buffer
rows do not emit, filtering to global rank 25 records rank 25 with visible count 1, browser tenant
fields remain absent, and a failed write retries with the identical body and idempotency key.
Canonical `PB_SG_GLOBAL_BAL_001` proof follows Gateway #692 exact-main merge. The Opportunities and
Ideas screen guide and repository context change, so repo-local wiki publication is required after
merge. No ranking, suitability, proposal, approval, execution, authentication, or effectiveness
authority is added to Workbench.

## 2026-08-31 — Adviser Brief component-owned presentation (#965)

### Business workflow question

How can the Performance Adviser Brief remain a compact, source-backed review workspace while its
presentation becomes safe to evolve without cross-screen cascade effects or an exceptional global
class-name contract?

### Evidence consulted

1. [Next.js CSS Modules](https://nextjs.org/docs/13/app/building-your-application/styling/css-modules)
   defines locally scoped component styles as the supported App Router composition model.
2. [CSS Modules local scope](https://github.com/css-modules/css-modules/blob/master/docs/local-scope.md)
   binds class identities through an explicit component import instead of the global namespace.
3. [MDN cascade introduction](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascade/Introduction)
   describes specificity and source order as cascade conflict resolution; they should not replace
   a clear feature owner.
4. [BlackRock on AI-enabled advisers](https://www.blackrock.com/aladdin/discover/blog/ai-enabled-investor)
   describes concise, source-grounded insights that advisers review and act on inside a connected
   workflow. Lotus keeps that review boundary and does not turn generated narrative into advice.
5. Current production evidence showed one 825-line file with 167 `:global(...)` escapes and 89
   globally named selectors, while the same colocated component family already owned every real
   consumer and focused state/action coverage.

### Adopted decisions

1. Keep one family-owned CSS Module beside the Adviser Brief components and import its local class
   map from each production owner.
2. Remove all 167 escapes and the exact governance exception in the same slice; zero is the durable
   module default.
3. Preserve the existing decision-first composition, source metrics, evidence, supportability and
   persisted review-action behavior. This is an ownership refactor, not a visual or contract change.
4. Use the existing design-system stage, section, disclosure and status primitives; add only local
   hooks where a feature layout must compose a shared primitive.
5. Prove ready, unavailable, permission, pending, failed and confirmed states with existing focused
   behavior tests, then prove keyboard focus, responsive composition and page-level overflow in an
   optimized browser at 1440, 1024, 768 and 519 CSS pixels.

### Rejected decisions

1. A new styling library, CSS-in-JS runtime or cascade layer.
2. Moving the selector family without removing its global escapes and string-based consumer contract.
3. A generic class-name abstraction or compatibility wrapper without another proven consumer.
4. Changing Adviser Brief hierarchy, business copy, service authority or review behavior inside a
   presentation-ownership slice.

### Validation and publication decision

Workbench #965 owns the migration and is a child of the incremental CSS programme in #492. The
repository CSS gate, focused component/integration tests and optimized-browser evidence form the
regression boundary. Repository context and this research ledger change because the durable
presentation owner changes. The existing Performance Adviser Brief screen guide remains accurate:
business purpose, source contracts, states, actions and operating behavior do not change, so no
repo-local wiki source change is required.

## 2026-08-31 — Component-owned PM AI decision-support result (#967)

### Business workflow question

How can one reusable PM decision-support result remain immediately identifiable, explainable, and
safe to review across Copilot, evidence-pack, rebalance, outcome-review, and operating-quality
workflows without relying on a Manage-wide global selector contract?

### Evidence consulted

1. [Next.js CSS Modules](https://nextjs.org/docs/13/app/building-your-application/styling/css-modules)
   defines locally scoped component styling as the supported collision-resistant model for
   component-level CSS and production code splitting.
2. [Carbon AI label usage](https://carbondesignsystem.com/components/ai-label/usage/) treats AI
   presence as a consistent pathway to explainability, not decoration or an AI-action trigger.
3. [Microsoft HAX guideline 11](https://www.microsoft.com/en-us/haxtoolkit/guideline/make-clear-why-the-system-did-what-it-did/)
   recommends access to an explanation while warning that an explanation can inflate trust and
   encourage over-reliance.
4. Current source and rendered evidence showed one reusable React result owner across six workflow
   consumers, three global class identities, 17 escape arms, and an existing governed
   `AiAssistanceDisclosure` that already exposes source preparation, availability, evidence,
   review, client-use, freshness, limitations, and diagnostics.

### Adopted decisions

1. Move the three result classes and their compact-width definition-list reflow into one colocated,
   zero-escape CSS Module imported directly by `DpmAiWorkflowResult`.
2. Preserve the current business reading order: result state and scope, summary, source material,
   then an expandable preparation/evidence/review/client-use explanation.
3. Keep the existing Workbench explainability primitive rather than importing another design
   system. Its visible source-backed badge and disclosure already supply more useful control
   evidence than a decorative AI marker.
4. Prove live review-required, deterministic simulation, stale, unavailable, partial, and
   contradictory-provenance states at the component boundary. Preserve once-per-source-result
   focus and keyboard disclosure access.
5. Extend the existing source-confirmed PM Copilot transaction to 1440, 1024, 768, and 519 pixels,
   open the disclosure by keyboard, and capture the complete evidence hierarchy without overflow.

### Rejected decisions

1. Adding Carbon, CSS-in-JS, or another component dependency for an ownership migration.
2. Replacing source evidence with a sparkle, generic **AI** badge, browser-generated explanation,
   or reassuring presentation.
3. Moving the disclosure into a compact popover that would hide review limitations and technical
   support evidence or duplicate the governed details primitive.
4. Changing provider selection, workflow output, approval, client-use eligibility, or service
   contracts in a presentation-boundary slice.
5. Bulk-splitting unrelated Copilot cards or the wider Manage stylesheet.

### Validation and publication decision

Workbench #967 is the bounded child of #492. Focused state, ownership, CSS-governance, and
source-confirmed browser proof form the regression boundary. Repository context and this ledger
change because the durable owner and exact CSS ratchet change. PM Copilot business purpose,
contracts, actions, limitations, and operating behavior remain unchanged, so its existing screen
guide remains accurate and repo-local wiki source does not change.

## 2026-09-01 — PM Copilot source-backed decision worklist (#983)

### Business workflow question

How can a portfolio manager compare six source-backed decision-support workflows, understand the
selected input and blocker, and prepare exactly one review-required output without scanning a card
gallery or losing the relationship between the workflow and its result?

### Evidence consulted

1. [BlackRock Aladdin Wealth](https://www.blackrock.com/aladdin/products/aladdin-wealth) describes
   a connected wealth platform that brings portfolio analysis and next actions into the adviser's
   workflow rather than distributing context across separate tools.
2. [BlackRock on AI-enabled advisers](https://www.blackrock.com/aladdin/discover/blog/ai-enabled-investor)
   frames generated material as a first draft for adviser review, not autonomous advice.
3. [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
   requires human oversight to be appropriate to the task and operating context.
4. [FINRA Regulatory Notice 24-09](https://www.finra.org/rules-guidance/notices/24-09) confirms that
   existing supervisory obligations continue to apply when firms use generative AI.
5. Exact Workbench main showed six equal action cards, 10 separate governance/context summaries,
   six simultaneous Prepare controls, 12 `dpm-copilot-*` global escape arms, and source-confirmed
   rendered heights of 2,477/3,635/3,819/4,644 pixels at 1440/1024/768/519.

### Adopted decisions

1. Reuse `WorkbenchWorklist`: source/status queue on the left, selected workflow decision and
   result on the right, with the existing responsive stack at narrower widths.
2. Keep unavailable workflows selectable so the portfolio manager can inspect their exact business
   blocker, but disable Prepare until source evidence supports the action.
3. Show one Prepare control for the selected workflow. The default workflow remains one click;
   another workflow requires deliberate selection before preparation.
4. Keep the result inside the selected workflow decision area and mark the corresponding queue row
   **Prepared**. Do not move generated material above unrelated workflows.
5. Retain one compact availability badge and one operating-boundary line. Review context continues
   to own portfolio and mandate identity; Workbench does not restate them inside Copilot.
6. Move presentation beside the component in a zero-escape CSS Module, delete all 12 Manage escape
   arms, and add a forbidden-prefix fitness rule.
7. Reuse the typed action registry directly as the worklist title authority. Replace technical
   **source-backed** and **posture** expressions with portfolio-evidence and summary language, and
   ratchet the product-copy inventory from 230 to 227 findings.

### Rejected decisions

1. A chat prompt, sparkle treatment, generic AI badge, or browser-written workflow instructions.
2. Browser-owned readiness, ranking, source fallback, provider selection, approval, client-use, or
   execution policy.
3. A new component library or one-off selector/detail implementation when the governed Workbench
   worklist already owns keyboard behavior and responsive composition.
4. Mixing source-state/provider lifecycle work from #894/#895 or wider #791 state-model work into
   this presentation and workflow tranche.

### Validation and publication decision

Workbench #983 is the bounded child of #492. Focused tests prove action/result identity, blocked
selection, source-context fencing, keyboard Arrow/Enter/Escape behavior, local CSS ownership, and
global-prefix retirement. The optimized source-confirmed browser proves six workflows, one Prepare
action, selected-decision-before-result order, responsive composition, and zero page overflow at
1440/1024/768/519. Page height falls to 2,093/2,087/2,840/3,556 pixels, a 15–43% reduction. The PM
Copilot business workflow and reading order changed, so its screen guide changes and repo-local wiki
publication is required after merge. Existing repository context already directs decision queues to
`WorkbenchWorklist`; no context change is needed.

## 2026-09-05 — Governed Idea rationale for advisor review (#996)

### Decision question

How can an adviser understand why an opportunity surfaced without turning generated text into
advice, duplicating Idea policy, or making the candidate workflow depend on AI availability?

### Evidence consulted

1. Exact Gateway main contract `8eb5311c` requires a caller-owned request identity, fixed generation
   purpose, idempotency, explicit served/unavailable status, evaluation verdict, evidence gaps, and
   execution provenance while prohibiting downstream authority.
2. [NIST AI RMF](https://airc.nist.gov/airmf-resources/airmf/3-sec-characteristics/) distinguishes
   role-appropriate explanation from an assurance claim and requires knowledge limits to remain
   visible.
3. [FCA AI approach](https://www.fca.org.uk/news/blogs/ai-financial-services-approach) emphasizes
   accountable, explainable use of AI within existing financial-services controls.

### Adopted decisions

1. Place one optional **Explain this idea** action beside the existing candidate decision controls;
   explanation loading or failure never changes those controls.
2. Render source-grounded claims, exact source references, evidence gaps, and source signals as
   separate information groups. Keep run, verdict, provenance, lineage, and client-use limits in
   the shared `AiAssistanceDisclosure`.
3. Fail closed on mismatched candidate/request identity, non-accepted served output, downstream
   authority, or unsupported-feature promotion. Preserve the exact request and idempotency key only
   for a failed retry.
4. Present an unavailable response's source-authored fallback as deterministic evidence, never as
   AI output. Record bounded opened, served, and unavailable telemetry with the fixed purpose and
   source disposition.
5. Bind current presentation to Idea's exact evidence packet, evidence content hash, and source
   revision-vector digest from refreshed candidate detail. Changed evidence supersedes the earlier
   rationale and fences late responses; unchanged transient retries retain exact request identity.

### Rejected decisions

Prompts, editing, local persistence, direct Idea/AI transport, browser-composed rationale, inferred
confidence, generated next actions, and any reassuring fallback not published by the source.

### Validation and publication decision

Contract, BFF authority, view-model, component, telemetry, retry, failure, and browser tests prove
the implemented boundary, including same-candidate evidence revision, late-response, missing
identity, and exact retry behavior. The Opportunities and Ideas workflow gains a visible capability and its
source/recovery rules change, so the screen guide and repository context change in the same PR and
the wiki must be published after merge.

## 2026-09-05 — Exact Idea action retry versus edited adviser intent (#1002)

### Decision question

How can an adviser recover from an unconfirmed review or conversion response without silently
resubmitting old terms after editing the visible form?

### Evidence consulted

1. The IETF Idempotency-Key draft requires a client not to reuse one key with a different payload.
2. Stripe's low-level error guidance recommends retrying an ambiguous request with the same key and
   parameters so the owner can reconcile the original operation.
3. Carbon's inline-notification pattern keeps actionable recovery beside the affected task, while
   its loading guidance supports disabling related controls during the transaction.
4. WCAG 2.2 status-message guidance requires asynchronous recovery posture to be programmatically
   available without moving focus.
5. Exact Gateway and Idea source confirmed that Gateway forwards payload and key unchanged and Idea
   fingerprints the complete payload: unchanged replay is valid; changed payload under the same key
   is a deterministic conflict.

### Adopted decisions

1. Retain one frozen review or conversion submission only after an ambiguous transport/server
   outcome, and show its exact business terms in an inline status notice.
2. Give exact retry its own explicit action. Reusing it preserves both payload and idempotency key.
3. Treat any material edit as a new adviser intent with a fresh key. Disable the normal form action
   while its visible terms still equal the retained submission so it cannot masquerade as new.
4. Freeze all material action fields while a mutation is pending. Keep review and conversion retry
   state separate and isolate both when the selected candidate remounts.
5. Clear retry authority after deterministic conflict, validation failure, source-confirmed
   success, or saved-but-refresh-failed posture; none of those states justify repeating the write.

### Rejected decisions

Automatic retry, optimistic success, persisting retry state in a browser cache, replacing visible
edited values with retained values on ordinary form submit, or creating a cross-workflow command
abstraction without another proven consumer.

### Validation and publication decision

Pure transition tests and action-panel tests prove response loss, edited review and conversion
terms, delayed completion, candidate remount, deterministic conflict, accepted/replayed persistence,
and saved-but-refresh-failed behavior. The optimized browser journey proves that rendered retained
terms match the dispatched payload/key. The workflow recovery contract changes, so repository
context and the Opportunities and Ideas screen guide change and the wiki must be published. Existing
frontend delivery guidance already defines superseded requests and source-owned recovery authority;
no central skill change is warranted for this bounded product correction.

## 2026-09-06 — BFF response bytes and HTTP metadata integrity (#1003)

### Decision question

How should the Workbench BFF preserve downloads, range responses, cache controls, and bodyless
responses when Node Fetch exposes decoded bytes rather than the upstream transfer representation?

### Evidence consulted

1. [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) defines response content, `HEAD`,
   `204`, `205`, `304`, `Content-Length`, and connection-specific field semantics.
2. The [WHATWG Fetch Standard](https://fetch.spec.whatwg.org/) defines content-coding decoding before
   response bodies are exposed to consumers.
3. [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) use the Web
   Request and Response APIs at this server boundary.

### Adopted decisions

1. Keep one bounded-buffer response owner and request identity encoding from Gateway.
2. For body-bearing responses, remove stale content coding and publish the exact emitted byte count.
3. Keep `HEAD`, `204`, `205`, and `304` bodyless; retain lawful representation metadata for `HEAD`
   and `304`, while removing prohibited content metadata for `204` and `205`.
4. Remove standard and `Connection`-nominated hop-by-hop fields while retaining end-to-end cache,
   security, range, download, and source metadata.

### Rejected decisions

Streaming without measured need; forwarding compression metadata after decoding; constructing a
nominal body for bodyless statuses; or deleting validators, range metadata, and security headers
that remain end-to-end evidence.

### Validation and publication decision

Real `NextRequest`/`NextResponse` route tests cover decoded JSON, identity binary, `HEAD`, `204`,
`205`, `304`, and `206` byte ranges, including dynamic hop-by-hop removal and exact byte/length
agreement. This changes the documented BFF contract, so repository context and the API wiki change;
no screen guide or screenshot is warranted because no visible workflow or layout changes. Existing
frontend delivery guidance already requires one governed transport boundary, so no platform skill
change is justified.

## 2026-09-06 — Visible Idea action draft after source-reason refresh (#1010)

### Decision question

How should review and conversion forms behave when the same candidate's refreshed opportunity
reasons no longer contain the basis already selected by the adviser?

### Evidence consulted

1. The official [React select reference](https://react.dev/reference/react-dom/components/select)
   requires every controlled value to match a rendered option. Without that invariant, browser
   presentation can diverge from React request state.
2. [WCAG 2.2 error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification)
   requires an out-of-set value to be identified in text with a useful correction path rather than
   silently substituted.
3. Current Workbench source shows that the candidate panel intentionally survives queue/detail
   refresh for the same candidate, while frozen retries and saved receipts are separate records of
   exact submitted terms.

### Adopted decisions

1. Keep the adviser-owned draft rather than silently resetting it after a source refresh.
2. When that value is absent from current source suggestions, render the exact closed-vocabulary
   value as **Retained draft** and state that it is not in the latest opportunity reasons.
3. Keep current source bases in the same control for deliberate reselection. Ordinary submission
   always uses the visibly selected value.
4. Keep review and conversion drafts independent. Frozen exact retry continues to use its original
   payload/key, while saved receipts continue to describe persisted terms rather than current form
   state.

### Rejected decisions

Displaying the browser's first option while retaining hidden state; silently selecting the first
new source reason; resetting the whole candidate panel and losing unrelated drafts/receipts; adding
a second reason vocabulary; or changing Gateway/Idea conflict and persistence semantics.

### Validation and publication decision

Real component rerenders cover empty, different, and unchanged reason lists across review and
conversion, including explicit reselection, exact retry, receipts, and candidate isolation. An
optimized-production browser journey proves the request body equals the visible retained/current
basis after Gateway/BFF-backed refresh and records rendered evidence under
`docs/evidence/issue-1010-visible-idea-basis/`. The visible workflow and recovery guidance change,
so repository context and the Opportunities and Ideas wiki guide change and the wiki must be
published after merge. Existing frontend-delivery guidance already requires visible/source truth;
no central skill change is needed for this bounded correction.

## 2026-09-07 — Source-bound Advisor Commentary ordering (#990)

### Decision question

How should Report centre let an adviser include reviewed commentary without making a source-owned
run identifier or evidence binding a manual browser decision?

### Evidence consulted

1. [W3C Forms Tutorial](https://www.w3.org/WAI/tutorials/forms/) and
   [WCAG 2.2 Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification)
   require clear controls and specific, actionable recovery when input cannot be accepted.
2. [W3C supportive forms guidance](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p04-supportive-forms/)
   supports reducing avoidable user entry and preserving useful context.
3. BlackRock's [Aladdin Auto Commentary](https://www.blackrock.com/aladdin/discover/blog/ai-enabled-investor)
   and [Advisor Center 360](https://www.blackrock.com/us/financial-professionals/tools/advisor-center-360)
   place reviewed narrative and reporting inside the adviser workflow rather than behind system-id
   entry.

### Adopted decisions

1. Send the exact report date and currency to Gateway when asking whether commentary is available.
2. Make the source-published accepted brief the only selectable and submitted value; remove manual
   identifier entry.
3. Distinguish accepted, review-required, context-mismatch, unknown, not-evaluated, and checking
   postures with the next valid business action.
4. Clear prior commentary selection on a context change and fence late responses, so old review
   evidence cannot appear current beside revised report terms.

### Rejected decisions

Free-text run identifiers; inferring an accepted brief; treating absent availability as ready;
reusing one portfolio's accepted brief for a portfolio bundle; generic unavailable copy; or keeping
old commentary selected while a changed date or currency is checked.

### Validation and publication decision

Contract, API, view-model, component, and optimized-browser proof cover exact source binding,
distinct unavailable states, absence without manual fallback, context refresh, and late-response
fencing. The visible workflow and support guidance change, so the Report Centre guide and wiki must
publish after merge. Existing frontend governance already requires source authority and race
fencing; no platform skill change is justified.

## 2026-09-09 — Portfolio source-receipt age and governed recheck (#1043)

### Decision question

How should Portfolio Review tell an adviser when its composite evidence was last checked without
misrepresenting that browser receipt as the source business date or a source-certified freshness
assessment?

### Evidence consulted

1. [TanStack Query `useQuery`](https://tanstack.com/query/v4/docs/framework/react/reference/useQuery)
   publishes `dataUpdatedAt` as cache receipt metadata and provides explicit refetching and bounded
   stale-time controls.
2. [Qualtrics dashboard data freshness](https://www.qualtrics.com/support/vocalize/dashboard-data-freshness/)
   distinguishes when data was last checked from the date represented by the underlying business
   records.
3. [Palantir data freshness guidance](https://www.palantir.com/docs/foundry/workshop/widgets-data-freshness)
   uses relative age for recent evidence and an exact timestamp for older evidence, supporting fast
   scanning without hiding precise lineage.
4. [WAI-ARIA status guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
   supports a polite confirmation after an explicit asynchronous action without moving keyboard
   focus.

### Adopted decisions

1. Label browser receipt metadata **Checked**, never **Updated**, **Current**, or **Fresh**.
2. Use the oldest admitted receipt across the workspace shell and dated summary fan-out; if either
   receipt is absent or invalid, show **Check time unavailable**.
3. Show recent receipt age compactly and expose the exact UTC timestamp through the semantic
   `time` element, accessible name, and pointer/focus disclosure.
4. Reuse the existing governed Query owners for **Recheck portfolio**. Announce success only when
   both reads settle successfully and their returned identity still matches the active portfolio,
   source generation, and review controls.
5. Keep the source business date in the existing **As of** control. Receipt age makes no statement
   about valuation recency, upstream collection time, market-close coverage, or source freshness.

### Rejected decisions

A new browser cache; a freshness badge or invented age threshold; a second polling loop; labelling
the receipt **Last updated**; using the newest partial receipt; or allowing one successful read to
claim the whole portfolio was rechecked.

### Validation and publication decision

Pure model tests cover relative, exact, unavailable, future-skew, and composite-receipt behavior.
Component/query tests prove successful and partial-failure rechecks, duplicate-click coalescing,
identity fencing, and truthful announcements. The governed Portfolio browser scenario proves the
date/receipt distinction and exact source request counts, with rendered and machine-readable
evidence under `docs/evidence/issue-1043-portfolio-receipt-age/`. The visible Portfolio Review
workflow changes, so its screen guide and repository context change and the wiki must be published
after merge. Existing frontend governance already requires governed Query ownership, explicit
source posture, and stable status messages; no central skill change is justified.

## 2026-09-09 — Performance summary and detail Query ownership (#791)

### Decision question

How should Performance retain source-confirmed evidence across period and analytical-control
changes without an unbounded component cache or a second response authority?

### Evidence consulted

1. [TanStack Query query-key guidance](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys)
   requires every variable used by a query function that can change returned data to be present in
   its deterministic query key.
2. [TanStack Query `QueryClient`](https://tanstack.com/query/latest/docs/reference/QueryClient)
   defines fresh-cache reuse, stale revalidation, in-flight deduplication, and scoped cancellation.
3. [TanStack Query initial-data reference](https://tanstack.com/query/latest/docs/framework/react/reference/interfaces/QueryOptions)
   treats server-provided initial data as cache data rather than disposable placeholder state.

### Adopted decisions

1. Give summary and detail one hierarchical Query-key family containing every source-changing
   portfolio, window, analytical-basis, dimension, frequency, benchmark, date, and currency input.
2. Admit responses through the existing source-identity checks before Query can reuse them.
3. Bind a detail key to the admitted summary's correlation and effective review context. A newly
   admitted summary therefore cannot silently inherit detail from an earlier source receipt.
4. Use the shared 30-second stale and five-minute retention policy, Query in-flight deduplication,
   and abort propagation. Keep only temporary requested/confirmed interaction state locally.
5. Preserve confirmed evidence through an ordinary refresh failure, but clear it on an authenticated
   permission refusal and fence delayed completions from changing the active review.

### Rejected decisions

An additional cache wrapper; infinite freshness; component-owned response Maps; browser-derived
source revisions; clearing useful confirmed evidence during an ordinary source failure; or adding
visible receipt age before #787 defines the composite Performance presentation.

### Validation and publication decision

Focused contract and component tests prove exact keys, source admission, fresh reuse, stale
revalidation, normalized detail recovery, refresh-failure retention, permission refusal, and
late-response fencing. This changes internal state ownership, not the Performance screen's business
purpose, facts, actions, or visible workflow. Repository context changes; no wiki source change is
required.

## 2026-09-09 — Performance composite receipt age and exact recheck (#787)

### Decision question

How should each summary/detail-backed Performance decision mode expose when its admitted composite was
checked, without presenting browser receipt time as source business freshness or adding another
refresh authority?

### Evidence consulted

1. [TanStack Query Query reference](https://tanstack.com/query/latest/docs/framework/react/reference/classes/Query)
   defines `dataUpdatedAt` as Query cache state and describes in-flight request reuse.
2. [TanStack Query QueryClient reference](https://tanstack.com/query/latest/docs/reference/QueryClient)
   defines exact invalidation, explicit refetching, and the difference between cached and
   source-contacting reads.
3. [WAI ARIA22](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22) recommends a polite status
   announcement for asynchronous completion without moving keyboard focus.
4. The Portfolio Review delivery under #1043 already establishes the Workbench vocabulary:
   browser receipt is **Checked**, source business date remains **As of**, and the oldest required
   receipt governs a composite.

### Adopted decisions

1. Put one quiet receipt/recheck control beside the Performance page title so Summary, Analysis,
   Adviser Brief, and Evidence share it instead of repeating controls per mode. Withhold it in Risk
   Review because that mode owns additional Risk queries whose receipt is not part of this composite.
2. Show the oldest admitted summary/detail `dataUpdatedAt`; if either required receipt is absent,
   invalid, or not admitted, show **Check time unavailable**.
3. Make **Recheck performance** invalidate and fetch the exact composite Query once, then promote
   summary and detail atomically only after both still match the active review context.
4. Keep the prior admitted receipt and analytics when an ordinary recheck fails. Announce success
   only after both reads succeed; preserve the existing permission-blocked and late-result fences.
5. Keep the shared 30-second stale policy for ordinary navigation and avoid a same-route server
   navigation after explicit recheck, which would duplicate the two source reads. When the source
   normalizes an unsupported control, replace the current query-only history entry with the exact
   confirmed selection without an App Router navigation or duplicate server read.

### Rejected decisions

A source-freshness badge; labelling receipt time **Updated**, **Current**, or **Fresh**; using the
newest partial receipt; a polling loop; a page-local clock store; per-mode controls; or treating one
successful endpoint as complete Performance evidence.

### Validation and publication decision

Query and client tests cover fresh composite reuse, forced exact recheck, oldest receipt, partial
failure, retained evidence, same-payload receipt advancement, intent-preserving retry, Risk-mode
exclusion, and success-only confirmation. A populated optimized-browser scenario proves one
summary and one detail read, no idle reads, one control across summary/detail-backed modes,
accessible status,
and rendered evidence under `docs/evidence/issue-787-performance-receipt-age/`. The visible
Performance workflow changes, so the Performance Summary guide and repository context change and
the wiki must be published after merge. Existing frontend governance already owns this pattern; no
central skill change is justified.
