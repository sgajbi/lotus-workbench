# Performance Summary

Performance Summary is the selected portfolio's benchmark-aware return review. It gives a client
advisor or portfolio manager one controlled reading path from reporting scope and return basis to
portfolio outcome, benchmark-relative result, multi-horizon context, and the positions or segments
that contributed most. It does not calculate performance in the browser, select an investment
strategy, approve a recommendation, or publish a client report.

## Current Scope

| Screen posture | Current truth |
| --- | --- |
| Canonical route | `/performance?portfolioId={portfolio_id}`; Summary is the default mode, while source-confirmed `asOfDate`, `period`, and `reportingCurrency` remain in the address when supplied by the entering workflow |
| Navigation | **Performance** in the global workspace navigation, then **Performance Overview** in the selected-portfolio rail |
| Supported scope | One Gateway-backed portfolio, one coherent source-confirmed Performance reporting window, review date, reporting-currency state, return basis, frequency, and benchmark selection |
| Primary reading order | Shell review context, one analysis control bar, portfolio and benchmark outcome, Return History, inherited horizon comparison, then contributor leadership |
| Primary next action | Explain the confirmed outcome, investigate a source limitation, continue to Performance Analysis, or prepare an internal Advisor Brief |

The current screen is portfolio-scoped. It does not aggregate a relationship, household, advisor
book, team book, or multiple mandates. Advisor Book owns portfolio selection; changing the selected
portfolio requests a new Workbench context.

## Business Purpose

Performance Summary helps an advisor or portfolio manager answer five bounded questions:

1. What reporting window, basis, frequency, currency, and benchmark define the result?
2. How did the portfolio perform, and what was the benchmark-relative outcome?
3. How did the return develop through the selected window rather than only at the end point?
4. How does the selected outcome compare with other source-supported horizons?
5. Which positions or segments are the leading positive and negative contributors, and is the
   evidence complete enough to explain?

The screen is designed for rapid preparation before a portfolio review or client conversation.
Exact source facts, capability posture, warnings, and limitations take precedence over decorative
scores or browser-authored conclusions.

## Shared Review Context

The shell-owned **Review portfolio** strip confirms portfolio and mandate identity once before the
performance decision flow. Portfolio and client references are available under **Support
details**; mandate type, booking centre, source valuation date, and source reporting currency stay
visible in the compact band. Performance supplies this model from the Gateway-backed Performance
and portfolio-shell responses in parallel and withholds analytical detail when their portfolio or
window identity conflicts.

When Performance cannot apply a carried review date or reporting-currency restatement, the strip
states that limitation without changing the source evidence. `accepted_unverified`, `rejected`, and
`unavailable` currency states remain visibly in portfolio base currency; only a coherent `applied`
state changes the displayed currency. Dated return windows and observations
may repeat their own dates because those dates define the calculation evidence, not portfolio
identity.

## Who Uses This Screen

- **Client advisors and relationship managers** establish a source-backed performance narrative
  before a client or mandate review.
- **Portfolio managers and investment specialists** review absolute and benchmark-relative outcome,
  return path, horizon context, and contributor concentration before deeper attribution analysis.
- **Investment operations and performance support teams** investigate unavailable calculations,
  source limitations, benchmark posture, and reporting-scope mismatches.
- **Product, control, and support teams** distinguish a presentation defect from a Gateway or
  Performance source-contract defect using the visible confirmed context and support evidence.

These uses do not imply production entitlement, client-delivery approval, performance sign-off,
investment suitability, or supervisory authority.

## Workflow Position

1. Enter from [Advisor Book](Advisor-Book-Workflow),
   [Portfolio Review](Portfolio-Review-Screen-Guide), or another selected-portfolio record screen.
2. Confirm the reporting horizon, net or gross basis, observation frequency, and benchmark once in
   the governed analysis bar. Choose **Review window** only when the review requires exact dates;
   reporting currency remains source evidence rather than an unsupported selector.
3. Read portfolio return, benchmark return, active return, annualised or money-weighted measures
   only when the source contract supports them.
4. Review the exact portfolio, benchmark, and active-return evidence for the published periods. A
   single observation is an exact comparison; only two or more observations form a return path.
5. Compare supported horizons and identify leading positive and negative contributors.
6. Continue to Performance Analysis for attribution and contribution diagnostics, Advisor Brief for
   an internal working narrative, Risk Review for downside context, or Evidence for calculation and
   lineage support.

Changing an analytical selection is a read-only request. The visible selection and URL become
current only after the matching summary and detail contracts both confirm the requested context.
Advisor decisions add browser-history entries; source normalization corrects the current entry.
Back and Forward restore the confirmed mode and analytical context without remounting the workspace
or moving focus away from the active rail or source control.

## Implemented Capabilities

- Uses one compact governed analysis bar for Horizon, Basis, Frequency, Benchmark, Review window,
  and Summary-only Return view. Analysis reuses the complete source selection; Risk reuses the
  supported subset without Frequency. Neither mode renders another page-local context.
- Keeps the complete source-confirmed date range visible on the compact **Review window** control.
  Exact-date drafting happens in a focused dialog with source bounds, validation, Cancel, and
  **Apply window** actions across desktop, tablet, and phone layouts. The displayed range and URL
  change only after the source accepts the request; Cancel, Escape, invalid input, or a rejected
  refresh leave the prior confirmed window unchanged and return focus to the initiating control.
- Defaults Return History to the six-column Absolute portfolio-versus-benchmark review. Relative
  and Combined views are available when that analytical question is required; they do not change
  the source selection.
- Makes Horizon Comparison inherit the selected horizon and benchmark. Secondary comparison
  display choices remain under **Adjust comparison display**.
- Keeps four headline return measures across desktop and tablet, two across compact layouts, and
  one only at very narrow widths. Compact Return History scrolls inside its named region while
  Period and Window remain pinned; the page itself does not scroll horizontally.
- Presents source-returned portfolio, benchmark, active, annualised, and money-weighted performance
  only when the selected contract publishes usable evidence.
- Requires an explicit source-catalogue portfolio. A missing, repeated, malformed, or unavailable
  identity produces a business recovery state before analytical reads; Workbench never substitutes
  the canonical demo portfolio or the first catalogue result.
- Passes a carried valuation date and reporting currency through the Workbench BFF to Performance
  summary and detail. Both responses must confirm one coherent requested/effective context before
  the workspace is admitted. Workbench presents the requested currency only when both sources
  publish `applied` with the matching effective currency; unverified, rejected, unavailable, mixed,
  or mismatched evidence remains in portfolio base currency with one explicit limitation.
- Enters the standard `YTD` period when no reporting selection is present; Workbench does not attach
  a portfolio-specific fixed start or end date. Explicit windows are sent only after the URL or
  advisor selection supplies them.
- Supports source-admitted standard or explicit reporting windows, net or gross basis, monthly or
  supported alternative frequency, and available benchmark choices.
- Presents one source-returned observation as a compact exact comparison with period, zero baseline,
  portfolio, benchmark, and active return. It uses a time-series chart only when at least two
  observations make a path supportable.
- Requests a Gateway-owned horizon-comparison contract for side-by-side supported periods.
- Distinguishes no published horizons, one exact horizon, and a true multi-horizon comparison;
  one horizon remains table evidence and is not presented as a comparison graphic.
- Shows leading positive and negative position or segment contributors from confirmed detail data.
- Keeps positive and negative contributor groups visually distinct through component-container
  reflow: the groups compare side by side only when Performance Drivers owns enough width and stack
  without overlap when the surrounding workstation rails reduce its usable canvas.
- Leads Performance Drivers supportability with one advisor-readable coverage conclusion, the
  client-use implication, market-value coverage, weighting basis, reconciliation, and named
  exclusions. Exact source status, reason codes, contracts, economics, snapshots, smoothing, and
  reconciliation remain in the native **Calculation evidence** disclosure.
- Treats absent, inconsistent, or unrecognised source and methodology evidence as **needs review**;
  Workbench never converts an unknown code into a favourable business interpretation.
- Publishes **Contribution coverage is confirmed** only when source limitations and reason codes
  agree, the applicable contribution values reconcile, and market-value coverage is both published
  and at least 95%. Lower coverage remains explicitly partial; absent or invalid coverage needs
  review.
- Preserves capability, warning, partial-failure, benchmark, calculation, and lineage posture
  without manufacturing unavailable analytics.
- Treats a selection change as one atomic decision-context transaction: requested labels, figures,
  and URL are committed together only after the source confirms summary and detail.
- Shows the oldest admitted summary/detail browser receipt as **Checked** beside the Performance
  title across Summary, Analysis, Adviser Brief, and Evidence. The source-owned business date
  remains **As of**; receipt age
  does not certify valuation recency, market-data freshness, or calculation currency.
- Provides one **Recheck performance** action across those summary/detail-backed modes. It reuses the
  exact governed Query owners, makes one summary and one detail read,
  promotes them only as a coherent composite, and does not navigate the unchanged route. If source
  evidence normalizes an unsupported selection, Workbench replaces the current query-only URL with
  those confirmed controls without another server navigation or a rejected Back-history entry.
- Withholds that receipt and action in Risk Review because its visible measures have independent
  Risk-owned queries; Workbench does not imply those measures were rechecked by the Performance pair.
- Uses browser-history `push` for confirmed advisor mode and source-control decisions, reserves
  `replace` for source normalization, and synchronizes Back and Forward into the mounted client
  without discarding keyboard focus or accepting an obsolete request.
- Keeps the prior source-confirmed result visibly labelled with its original context during a
  refresh or failure and offers an explicit source retry after failure.
- Announces pending and failed refresh states without moving focus, locks conflicting controls
  while confirmation is pending, and reflows the recovery card without page overflow at governed
  tablet and narrow widths.
- Gives Horizon Comparison an independent source state and persistent **Refresh comparison** action:
  a failed request stays distinct from source-confirmed absence, permission denial remains
  fail-closed, and exact retry preserves the advisor's current keyboard task.

## Decisions And Actions

| User decision or action | Required evidence or gate | Persisted business change |
| --- | --- | --- |
| Explain portfolio outcome | Confirmed reporting scope, basis, portfolio return, currency, and available benchmark evidence | None; read-only review |
| Interpret benchmark-relative outcome | Confirmed benchmark identity and source-returned portfolio, benchmark, and active return | None |
| Change reporting selection | Source-supported period or date window, basis, frequency, and benchmark | None; requests new analytics |
| Compare horizons | Usable source-owned horizon-comparison response | None |
| Retry horizon comparison | Explicit recoverable horizon-source failure | None; repeats the exact Gateway request |
| Identify contributor leadership | Confirmed contribution detail and source capability | None; Workbench does not recommend a trade |
| Retry an unconfirmed selection | Explicit failed refresh with retained requested and confirmed contexts | None; re-contacts Gateway and Performance authority |
| Recheck the current Performance evidence | Current portfolio, review window, basis, dimensions, frequency, benchmark, review date, and currency identity | None; re-contacts the exact summary/detail sources once |
| Continue to deeper review | Available selected-portfolio Performance mode | None from Summary |
| Return to an earlier confirmed view | Existing browser-history entry with valid governed context | None; restores the matching source-backed read state |

Viewing, changing controls, or retrying does not create a recommendation, proposal, report order,
client communication, portfolio instruction, trade, order, execution, settlement, or approval.

## Information And Source Authority

| Business fact or action | Workbench boundary | Source authority |
| --- | --- | --- |
| Portfolio identity, base currency, booking context, and selected mandate | Formats the selected workspace and navigation context | Gateway over Core portfolio contracts |
| Reporting window, return basis, frequency, benchmark options, portfolio return, benchmark return, active return, annualised return, and cash-flow-aware return | Validates and presents the returned contract; does not recalculate performance | Gateway `GET /api/v1/workbench/{portfolio_id}/performance/summary`, composing Core portfolio/reference/benchmark context with Performance analytics |
| Requested and effective review date, requested and effective reporting currency, and currency state | Sends the governed context, admits only coherent summary/detail evidence, and changes the displayed currency only for a matching `applied` state | Gateway summary/details composition over Core and Performance authority |
| Return-path observations and source capability posture | Presents one observation as exact comparison evidence and charts two or more observations without interpolating missing values | Gateway `GET /api/v1/workbench/{portfolio_id}/performance/details` over Performance authority |
| Contribution rows, dimensions, coverage, source-economics and smoothing status, reason codes, contracts, snapshots, attribution support, warnings, and partial failures | Builds decision-focused ranking and a business-first supportability conclusion from the same returned evidence; preserves exact technical values in **Calculation evidence** and fails closed for unknown values | Gateway `GET /api/v1/workbench/{portfolio_id}/performance/details` over Performance authority |
| Zero, one, or multiple horizon observations | Chooses a truthful empty, exact-table, or comparison presentation without manufacturing rows | Gateway `GET /api/v1/workbench/{portfolio_id}/performance/horizon-comparison` over Performance authority |
| Horizon loading, failure, permission block, exact retry, success-only cache, and obsolete-request fencing | Owns browser request state independently from Summary selection confirmation | Workbench over the matching Gateway response |
| Pending, failed, requested, and source-confirmed selection context | Owns the browser transaction state; never relabels retained source data | Workbench over the matching Gateway responses |
| **Checked** age and recheck completion | Shows the oldest admitted summary/detail Query receipt and confirms only a complete exact-context recheck | Workbench browser receipt metadata over the matching Gateway responses; not source business freshness |
| Portfolio, valuation date, period, and reporting-currency navigation context | Parses one atomic governed cross-workspace context, rejects repeated or malformed values, and serializes supported fields once in stable order; record and batch identities remain local to their owning workspaces | Workbench navigation over source-confirmed identities; no new Performance capability is inferred |
| Back and Forward mode or analytical selection | Synchronizes server-confirmed route props into the mounted workspace; complete query identity fences obsolete responses while still-fresh exact Risk evidence remains reusable | Browser history plus matching Gateway responses |
| Retry | Repeats the exact failed selection through the Workbench BFF | Gateway and Performance |

Workbench uses the BFF and Gateway. It does not call Performance or Core directly. Shared contract
detail remains in [API Surface](API-Surface), and ownership flow remains in
[Integrations](Integrations).

## Screen States And Recovery

| State | What the user sees | Recovery posture |
| --- | --- | --- |
| Initial loading | Bounded workspace loading with no fabricated performance result | Wait for the selected portfolio contract |
| Missing or ambiguous portfolio | **Review context needs attention** with no portfolio lookup or analytical request for missing/invalid identity | Return to **My book** and select a source-confirmed portfolio |
| Portfolio not in source catalogue | Explicit no-substitution recovery after the bounded catalogue read; no performance summary is requested | Choose another portfolio from **My book** |
| Applied review context | Review Context, Summary, and detail confirm the same requested/effective date and an applied currency state | Continue with the confirmed analytical scope |
| Currency accepted but not verified | Performance remains in portfolio base currency with one compact restatement limitation | Use base-currency figures only; do not describe them as restated |
| Rejected or unavailable context | Prior confirmed evidence remains under its prior labels, or affected evidence stays unavailable; the exact business limitation remains visible | Retry a supported context or continue with the last confirmed evidence |
| Mixed source context | Summary and detail are not admitted as one workspace | Retry; do not compare or narrate figures from different source contexts |
| Ready | Confirmed scope, headline outcome, return path, horizon context, contributors, and supportability | Continue the review |
| Selection pending | Requested and source-confirmed contexts shown separately; prior figures keep their confirmed labels and controls are locked | Wait for both summary and detail confirmation |
| Selection failed | Persistent **Selection not applied** evidence, HTTP status when known, retained confirmed context, and **Retry selection** | Retry the exact request or use the confirmed view |
| Selection confirmed | Compact **Source analysis updated** or **Source detail updated** acknowledgement naming the resolved analytical context for five seconds; controls, figures, and URL remain the durable truth | Continue the review; no dismissal is required |
| Check time unavailable | **Check time unavailable**; no partial receipt is presented as the composite age | Recheck the complete Performance evidence or use the visible source date and limitations |
| Recheck pending | Prior source-confirmed analytics and receipt remain visible while the exact summary/detail pair is checked | Wait; repeated activation is coalesced and analytical controls remain protected |
| Recheck failed | **Performance evidence could not be rechecked** with the affected source scope and prior confirmed view retained | Retry the complete evidence set; do not describe the retained receipt as newly checked |
| Recheck confirmed | **Performance evidence rechecked** and the composite **Checked** time advances only after both exact reads succeed | Continue the review; source **As of** remains a separate business fact |
| Partial or limited | Usable facts remain visible with named capability, warning, or partial-failure evidence | Qualify the discussion and investigate the named source limitation |
| Source-limited contribution | **Contribution coverage is limited**, named business exclusions, market-value coverage, weighting basis, and reconciliation; exact codes remain secondary | Review the exclusions and calculation evidence before using the driver explanation with a client |
| Unknown or missing contribution evidence | **Contribution evidence needs review** or **Contribution coverage cannot be confirmed** without an invented translation | Open **Calculation evidence**, retain the exact value, and use the approved support path |
| Normalised selection | Workbench explains that the source resolved a different supported analytical option | Use the displayed source-confirmed option |
| Horizon request failed | Persistent **Horizon comparison could not be refreshed**, source response status when known, and **Refresh comparison** | Retry the exact request; do not interpret failure as no data |
| Horizon permission blocked | **Horizon comparison restricted** without restricted detail or stale cached evidence | Use an entitled role or approved support path |
| No published horizons | Source-confirmed statement that no horizon observations were returned | Do not infer portfolio or benchmark outcome |
| One published horizon | Exact table with a visible qualification that comparison requires at least two horizons | Use the returned period as point evidence only |
| One published return observation | Compact exact comparison with period, zero baseline, portfolio, benchmark, and active return; no invented trend or empty chart canvas | Use the observation as point evidence and qualify any path interpretation |
| Return time series | Source-returned portfolio, benchmark, and active observations in the existing chart with exact values available | Explain only the published path and source-supported scope |
| Unavailable | Performance data is absent and the workspace states that the contract did not resolve | Re-establish supported portfolio/source context or follow the approved support process |
| Permission blocked | Explicit access-restricted state without restricted entitlement detail | Use an entitled role or contact platform support |

A failed refresh never converts prior analytics into the requested context. Retry success commits
summary, detail, controls, and URL together; another failure leaves the confirmed view unchanged.

## Workbench Boundaries

Performance Summary deliberately does not:

- calculate time-weighted, money-weighted, annualised, benchmark, active, contribution, attribution,
  smoothing, fee, currency, or residual economics in the browser,
- substitute zero for a missing metric, infer a benchmark assignment, interpolate a return path, or
  treat a capability flag as calculation evidence,
- turn a contributor ranking into a recommendation, target, suitability conclusion, rebalance,
  transaction, order, execution, or client instruction,
- treat an internal Advisor Brief, screenshot, test fixture, or competitor feature description as
  source authority,
- claim advisor-book aggregation, household performance, composite reporting, official performance
  sign-off, client-ready publication, production entitlement, or bank certification,
- use source codes or implementation topology as a substitute for business interpretation, hide
  exact source or methodology evidence, translate an unknown value optimistically, or derive the
  business and technical layers from different payloads.

Official wealth-platform research informed the integrated decision context, cross-horizon review,
and evidence-first recovery pattern. Lotus does not copy another product's layout, wording, visual
identity, calculations, or unsupported capability, and this guide is not a claim of competitor
superiority.

## Adjacent Handoffs

- [Advisor Book](Advisor-Book-Workflow) owns source-backed own-book portfolio selection.
- [Portfolio Review](Portfolio-Review-Screen-Guide) owns the daily selected-mandate checkpoint.
- Performance Analysis owns detailed attribution, contribution, and benchmark-relative diagnostics.
- Performance Advisor Brief owns the internal working narrative and its separate review controls.
- Risk Review owns downside, concentration, and rolling-risk interpretation.
- Performance Evidence owns calculation, lineage, coverage, and limitation inspection.
- [Report Centre](Report-Centre-Screen-Guide) owns reviewed report ordering and source-owned report
  lifecycle; Summary does not publish a report.
- Performance operations own source calculation repair and official performance-control processes.

## Evidence And Validation

- Focused state tests prove pending, summary failure, detail failure, exact retry, permission block,
  stale-response fencing, atomic source-confirmed commit behavior, period and review-context
  mismatch rejection, request propagation, and base-currency presentation unless restatement is
  coherently applied.
- Shared-component tests prove polite pending and compact source-confirmed announcements, assertive
  failure, exact requested/confirmed context, native retry behavior, and responsive ownership.
  Client tests prove the five-second confirmation lifecycle, identical-input suppression, obsolete
  response fencing, and that an existing stable task keeps focus.
- The owned optimized-production browser journey uses `PB_SG_GLOBAL_BAL_001`; it deliberately
  receives a 503 for a 3Y summary and a 502 for Sector detail, proves YTD and Asset Class remain
  source-confirmed, retries each request, proves focus returns to the original source selector only
  when the retry action would otherwise leave focus nowhere, and then proves 3Y and Sector become
  current together with the URL. The final confirmation clears while the resolved controls, data,
  and URL remain current.
- The browser proof admits only the two deliberate BFF error signals, rejects any other console or
  page error, keeps Emotion styles head-managed, and verifies no page overflow at 1024, 768, and
  519 pixels.
- A separate optimized-production `PB_SG_GLOBAL_BAL_001` journey deliberately receives a 503 from
  Horizon Comparison, proves failure is not rendered as source-confirmed absence, retries the exact
  selection with stable focus, and then proves four published horizons. It validates failure and
  recovered layout at 1024, 768, and 519 pixels with no page overflow and exactly one admitted BFF
  error.
- The existing populated and unavailable Performance scenarios remain the regression proof for
  complete and degraded source contracts. Canonical live validation remains the release evidence
  for the governed front-office stack.
- The populated optimized-production history journey proves that portfolio, valuation date, period,
  reporting currency, and Analysis mode survive user selection, Back, and Forward. It also proves
  3Y returns to YTD and forward to 3Y from source-confirmed responses, keeps focus on the visible
  desktop workflow or horizon control, retains head-managed styles, and admits no browser errors.
- The populated asymmetric-contributor scenario proves that one source-populated group and one
  source-confirmed empty group never overlap. It asserts rendered group separation and zero
  internal horizontal overflow at 1800, 1440, 1024, 768, and 519 pixels; reviewed evidence under
  `output/playwright/issue-706-performance-*` confirms stacked three-rail workstation and compact
  layouts plus a dense two-column tablet layout when the module itself has sufficient width.
- The contribution-evidence state matrix proves source-backed, source-limited, missing,
  unrecognised-code, and invalid-smoothing postures. The populated optimized-production journey
  proves the business conclusion is primary, keyboard access keeps focus on the native disclosure,
  exact codes remain available, and the open evidence grid has no internal or page overflow at
  1440, 1024, 768, and 519 pixels. Reviewed evidence is stored under
  `output/playwright/issue-712-performance-evidence-*`.
- `npm run test:e2e:performance:return-path-density` proves the one-observation comparison in the
  optimized standalone production server at 1440, 1024, 720, and 519 pixels. It asserts exact
  portfolio, benchmark, and active-return semantics; a visible zero baseline; no chart-only
  controls; stable keyboard focus during reflow; bounded evidence capacity; zero page overflow;
  clean browser runtime; and head-managed styles. Reviewed evidence is stored under
  `output/playwright/issue-719-performance-return-path-*`. Focused component tests separately prove
  that two or more observations retain the existing time-series chart contract.
- Protected PR checks, exact-main releasability, wiki publication, and strict parity remain release
  controls.

Use [Validation and CI](Validation-and-CI) and [Operations Runbook](Operations-Runbook) for the
governed validation sequence.

## First Support Step

Confirm the selected portfolio, visible reporting window, net or gross basis, observation
frequency, benchmark, and whether the screen says **Updating source analysis**, **Selection not
applied**, **Horizon comparison could not be refreshed**, **Partial**, **Unavailable**, or **Access
restricted**. If Performance Drivers says its contribution coverage is limited, unavailable, or
needs review, open **Calculation evidence** and record the source status, source contracts,
unsupported or degraded economics, smoothing status, and reconciliation without rewording the
exact codes. If a failed-selection card is present, record its requested context,
source-confirmed context, and HTTP status. For Horizon Comparison, record the selected period,
basis, frequency, and benchmark. Do not copy client data or raw payloads into an unapproved
channel; retry once through the matching in-context control.

## Related Documentation

- [Screen Guide Catalogue](Screen-Guide-Catalogue)
- [Advisor Book](Advisor-Book-Workflow)
- [Portfolio Review](Portfolio-Review-Screen-Guide)
- [Report Centre](Report-Centre-Screen-Guide)
- [Supported Features](Supported-Features)
- [API Surface](API-Surface)
- [Integrations](Integrations)
- [Validation and CI](Validation-and-CI)
- [Operations Runbook](Operations-Runbook)
- [Technology Risk and Runtime Support](Technology-Risk-and-Runtime-Support)
