# Risk Review

Risk Review is the selected portfolio's source-backed downside, concentration, rolling-risk, and
risk-contribution workspace. It gives an advisor or investment specialist exact measures and the
Gateway-owned comparison with approved mandate constraints needed to decide what requires
professional review. It keeps source facts distinct from suitability, remediation, and house-policy
judgement that the current contract does not supply.

## Current Scope

| Screen posture | Current truth |
| --- | --- |
| Canonical route | `/performance?portfolioId={portfolio_id}&mode=risk` |
| Navigation | **Performance** in global navigation, then **Risk Review** in the selected-portfolio rail |
| Availability | Runtime-gated by the selected portfolio's source capability |
| Supported scope | One selected portfolio, source-confirmed reporting window, basis, benchmark, as-of date, and reporting currency |
| Primary reading order | Exact executive evidence, mandate exceptions and evidence gaps, snapshot, drawdown, concentration, rolling risk, historical risk attribution, then supportability |
| Primary next action | Qualify the portfolio discussion, inspect a source limitation or methodology, or continue to an implemented adjacent workspace |

This is a portfolio-level analytical review. It is not an advisor-book risk aggregation, household
risk score, enterprise limit monitor, suitability assessment, or pre-trade control.

## Business Purpose

Risk Review helps a private-banking professional answer seven bounded questions:

1. What source-confirmed volatility, drawdown, largest-position, and coverage evidence is available?
2. What reporting period, basis, benchmark, currency, and as-of date define those measures?
3. How deep was the portfolio's drawdown, and had it recovered by the period end?
4. Where is exposure concentrated by position and issuer, and how complete is issuer coverage?
5. How have rolling measures behaved across the source-supported observation windows?
6. Which source-supported measures are within, outside, undefined, or unavailable against the approved mandate constraints?
7. Which source-supported groups contribute most to total or active risk?

The first scan leads with exact measures and factual source state. Compare source measures with
approved mandate constraints through the Gateway-owned comparison ledger. A source-reported
**Within mandate** or **Outside mandate** state applies only to that named constraint and date; it
is not a suitability conclusion, waiver decision, remediation priority, or portfolio-wide all-clear.

## Who Uses This Screen

- **Client advisors and relationship managers** prepare a bounded explanation of portfolio risk
  before a review or client conversation.
- **Portfolio managers and investment specialists** inspect downside, concentration, rolling
  behavior, and contribution evidence before deciding whether deeper analysis is required.
- **Risk, performance, and investment-operations teams** investigate source limitations,
  observation coverage, benchmark alignment, methodology, and calculation supportability.
- **Product, control, and support teams** distinguish a Workbench presentation defect from a
  Gateway, Performance-context, or Lotus Risk source-contract defect.

These uses do not imply production entitlement, delegated authority, suitability approval,
mandate-waiver authority, investment advice, order approval, or client-publication permission.

## Workflow Position

1. Enter from [Advisor Book](Advisor-Book-Workflow),
   [Portfolio Review](Portfolio-Review-Screen-Guide), or Performance Summary with one selected
   portfolio.
2. Confirm the portfolio, reporting currency, and business-date posture in the shell-owned
   **Review context** strip. Confirm the reporting window, return basis, and benchmark
   in the one shared Performance analysis bar. **Review window** opens the exact-date dialog only
   when a custom review is required; the bar continues to show the last source-confirmed range.
   Risk does not render a second **Risk context** control group or a Frequency selector because the
   governed Risk contracts do not currently accept observation frequency.
3. Read the exact executive measures and the exception-first **Mandate comparison**. Start with
   **Outside mandate**, then unavailable measures, undefined limits, and source evidence gaps before
   reviewing constraints reported **Within mandate**.
4. Review snapshot and drawdown evidence, then position and issuer concentration with coverage and
   methodology.
5. Inspect rolling windows and request available detail only when the analytical question needs it.
6. Select only source-supported attribution type and grouping controls, then review the returned
   contributors and reconciliation evidence.
7. Continue to Performance Evidence, Portfolio Review, Advisor Brief, or Report Centre only where
   that implemented handoff fits the business task.

## Implemented Capabilities

- Reuses the shared source-confirmed Horizon, Basis, Benchmark, and Review window controls from
  Performance. Risk omits Frequency until the governed Risk contracts support it; its modules
  inherit the supported selection once and do not duplicate context or introduce a screen-local
  selector. The exact-date dialog owns draft input; only a source-accepted request updates the
  visible range and inherited Risk context.
- Presents source-returned realized volatility, max drawdown, largest-position weight and driver,
  and source coverage in a compact executive evidence strip.
- States whether the principal drawdown was recovered before period end or remained below its prior
  peak, using the source-returned recovery flag rather than a browser severity threshold.
- Presents risk snapshot measures, their units, definitions, observation context, and source state.
- Presents exact position and issuer concentration indices, largest position and issuer, top-N
  cumulative weight, issuer coverage, source driver identity, and methodology access.
- Presents Gateway-owned `mandate_comparison` facts from summary and concentration: mandate
  identity and version, risk profile, comparison dates, source state, measure, limit, source
  headroom, basis, reason, review due state, and progressively disclosed lineage.
- Compares the two mandate contexts before presentation formatting. Unequal or one-sided missing
  mandate identity, version, risk profile, comparison date, mandate date, or mandate-health date is
  shown as a different context; a value absent from both reads is shown as insufficient alignment
  evidence. It is never treated as silent agreement.
- Presents drawdown depth, duration, episodes, benchmark-relative context, and an on-demand
  underwater series only when the source contract supports them.
- Presents rolling-risk windows with exact latest, typical, range, coverage, and source-supported
  series detail; it does not extrapolate a missing series.
- Presents source-admitted total- or active-risk attribution controls and contributor evidence. A
  disabled source option stays disabled with its reason.
- Uses magnitude tracks only when Gateway marks attribution evidence **Ready**. **Partial**
  attribution keeps exact contributor values and controls available with an indicative-evidence
  notice, but withholds the visual ranking. An unfamiliar state cannot fall through to Ready.
- Preserves ready, partial, unavailable, blocked, warning, partial-failure, methodology-version,
  cache, and correlation posture from the Gateway/Risk contract family.
- Reuses exact source-admitted Risk evidence for a brief return to the screen through the governed
  Workbench query policy. After that freshness window, the screen checks Gateway again before
  presenting the evidence as current; unavailable, blocked, or mismatched responses are not reused.
- Keeps absent, unavailable, date-misaligned, undefined-limit, and unavailable-measure evidence
  explicit. Workbench does not calculate a missing limit or headroom or infer a portfolio all-clear.
- Reflows the exact evidence and comparison at desktop, tablet, and 519-pixel widths without requiring
  two-dimensional page scrolling.

## Decisions And Actions

| User decision or action | Required evidence or gate | Persisted business change |
| --- | --- | --- |
| Explain current measured risk | Exact source measure, period, as-of date, basis, currency, and usable source state | None; read-only review |
| Discuss drawdown recovery | Source-returned drawdown summary and recovery flag | None |
| Review concentration | Exact position/issuer measures, source-owned mandate comparison, issuer coverage, and methodology | None; read-only review |
| Inspect underwater or rolling detail | Source capability and an explicit detail request | None; read-only request |
| Change rolling window | A source-returned supported window | None; local evidence selection |
| Change attribution type or grouping | A source-admitted enabled control combination | None; requests source analytics |
| Qualify a source-reported mandate exception | Named constraint, source measure, approved limit, state, reason, comparison date, and usable evidence posture | None; remediation and waiver remain outside this screen |

No Risk Review control records advice, approves a mandate exception, creates a proposal, changes a
portfolio, submits an order, publishes a report, or communicates with a client.

## Information And Source Authority

| Business fact or action | Workbench boundary | Source authority |
| --- | --- | --- |
| Selected portfolio, period, basis, benchmark, currency, and as-of context | Reuses the confirmed Performance workspace context and sends it through the BFF | Gateway over Performance context contracts |
| Snapshot measures and observation context | Formats exact measures and source states; does not recalculate or classify them | Gateway `GET /api/v1/workbench/{portfolio_id}/risk/summary` over Lotus Risk |
| Position and issuer concentration, drivers, coverage, enrichment and grouping methodology | Presents exact values and methodology without inventing limits or bands | Gateway `GET /api/v1/workbench/{portfolio_id}/risk/concentration` over Lotus Risk |
| Drawdown summary, episodes, recovery, relative context, and optional underwater series | Requests and presents the source contract; detail is loaded on demand | Gateway `GET /api/v1/workbench/{portfolio_id}/risk/drawdown` over Lotus Risk |
| Rolling metric summaries, coverage, windows, and optional time series | Presents source-supported windows and requests series detail on demand | Gateway `GET /api/v1/workbench/{portfolio_id}/risk/rolling` over Lotus Risk |
| Risk attribution controls, contributors, totals, residuals, and methodology | Enables only source-admitted combinations and preserves source warnings | Gateway `GET /api/v1/workbench/{portfolio_id}/risk/attribution` over Lotus Risk |
| Mandate identity, constraints, measure comparison, headroom, review policy and lineage | Renders exact Gateway facts; never calculates missing limits, headroom, states, or all-clear | Gateway-owned `mandate_comparison` over Manage-owned mandate evidence and exact Core/Risk measures |
| Suitability, client tolerance, house-policy threshold, waiver, remediation priority, and portfolio-wide all-clear | Not supplied and not inferred | Approved advice, control and policy authority outside the current contract |

Workbench calls these contracts through its same-origin BFF and Gateway. It does not call Lotus Risk
or Performance directly. Shared contract detail remains in [API Surface](API-Surface), and service
ownership remains in [Integrations](Integrations).

## Screen States And Recovery

| State | What the user sees | Recovery posture |
| --- | --- | --- |
| Loading | Bounded Risk loading state without synthetic measures | Wait for the selected source context |
| Ready | Exact evidence, methodology access, and source-owned mandate comparison | Review exceptions and evidence gaps before within-mandate rows |
| Comparison not supplied | Existing Risk evidence remains visible with an explicit additive-contract boundary | Confirm Gateway version/source support; do not infer limits or state |
| Comparison unavailable or partial | Source reason, date alignment, available rows, and missing evidence remain visible | Qualify use and inspect lineage/supportability |
| Different mandate contexts | Portfolio-risk and concentration evidence remain separate with an explicit context warning | Do not combine the rows into one conclusion; inspect source identity and dates |
| Mandate context insufficient | Available rows remain visible, but the screen states that source alignment is unproven | Review the missing mandate facts before relying on the comparison |
| Limit not defined | Source measure remains visible with no fabricated threshold or headroom | Confirm the approved mandate outside Workbench if the decision requires it |
| Measure unavailable | Approved limit and source reason remain visible without a fabricated value | Investigate the named source measure before deciding |
| Review state or cadence unavailable | Supplied review dates remain visible; unknown state is warning evidence and absent cadence is **Not reported** | Confirm review policy with the mandate authority; do not infer a schedule |
| Partial | Usable modules remain visible with named source limitations, warnings, and partial failures | Qualify any discussion and inspect the affected module |
| Attribution partial | Exact contributor values and supported controls remain visible; an indicative-evidence notice replaces unsupported magnitude tracks | Use the figures as qualified evidence and inspect the accompanying source notes |
| Unavailable | Risk source evidence is not available for the selected context | Confirm portfolio/context and use the approved support path |
| Access restricted | Explicit permission-blocked posture without restricted data | Use an entitled role or approved access-support process |
| Deferred detail idle | Headline evidence remains visible; no unrequested detail is fabricated | Request detail only when needed |
| Deferred detail loading | The requested underwater or rolling series is pending | Keep the current headline evidence; do not infer the result |
| Deferred detail unavailable | Exact detail is absent while the parent source evidence remains qualified | Continue with available facts or investigate source supportability |
| Attribution blocked or unavailable | Source controls and reason remain explicit; no contributor rows are fabricated | Choose a supported source option or follow support guidance |

Module-level source states remain independent. One partial or unavailable module does not turn
another source-confirmed module into a synthetic success or erase its exact evidence.

## Workbench Boundaries

Risk Review deliberately does not:

- classify risk as contained, moderate, elevated, high, severe, acceptable, or diversified from
  Workbench-authored numeric thresholds,
- define a mandate limit, calculate headroom, override a source breach, or infer client risk
  tolerance, capacity for loss, suitability, house alert policy, waiver, remediation priority, or
  portfolio-wide all-clear,
- calculate volatility, tracking error, drawdown, concentration, rolling metrics, covariance,
  attribution, benchmark alignment, or residuals in the browser,
- convert a missing measure to zero, colour an exact value as a warning solely because of a local
  threshold, or turn a source failure into an empty success,
- recommend a rebalance, security sale, hedge, proposal, order, execution, settlement, report
  publication, or client communication,
- claim advisor-book, household, team, enterprise-limit, stress-scenario, or pre-trade coverage
  that the current contracts do not publish.

Official CFA and wealth-platform research informed the separation of measured evidence from
client-specific and policy judgement. Lotus does not copy another product's layout, wording,
visual identity, thresholds, calculations, or unsupported capability. This guide is not a claim of
bank approval or competitor superiority.

## Adjacent Handoffs

- [Advisor Book](Advisor-Book-Workflow) owns source-backed portfolio selection across the advisor's
  book.
- [Portfolio Review](Portfolio-Review-Screen-Guide) owns the selected mandate's daily review and
  source-reported attention posture.
- [Performance Summary](Performance-Summary-Screen-Guide) owns return and benchmark-relative
  outcome.
- [Performance Analysis](Performance-Analysis-Screen-Guide) owns deeper performance attribution
  and contribution diagnostics.
- [Performance Evidence](Performance-Evidence-Screen-Guide) owns calculation and lineage assurance
  for the selected Performance context.
- [Performance Advisor Brief](Performance-Advisor-Brief-Screen-Guide) owns a separately reviewed
  internal working narrative.
- [Report Centre](Report-Centre-Screen-Guide) owns reviewed report ordering and source lifecycle;
  Risk Review does not publish a report.

## Evidence And Validation

- Focused view-model tests prove exact volatility, max drawdown, largest-position, source-coverage,
  partial-coverage, unavailable, and blocked states without browser-authored severity labels.
- Component and projection tests prove every source comparison state, exact measure, limit,
  source headroom, review timing, date alignment, lineage, additive-field absence, and unavailable
  comparison without browser-owned policy.
- A raw-context field matrix proves that display formatting cannot hide differences; bilateral
  absence, one-sided absence, unknown review/constraint states, and nullable cadence are all
  independently covered.
- Attribution state tests cover ready, partial proxy, mixed partial failure, unavailable, blocked,
  and unfamiliar runtime values. Browser proof requires ready magnitude tracks and partial exact
  values to coexist without a magnitude track.
- A deterministic source-authority guard prohibits retired threshold helpers and policy placeholders
  from returning and requires stable comparison evidence attributes.
- The primary constraint row carries a stable source-and-key identity; progressive disclosure uses
  a distinct constraint-evidence heading such as **Cash allocation evidence**. Business copy remains readable while canonical
  proof cannot become ambiguous when the same constraint is discussed in its evidence detail.
- CSS governance removes the retired concentration-scale and side-stack selectors, prohibits their
  return, and lowers the exact legacy-global size ratchet.
- Canonical browser validation uses `PB_SG_GLOBAL_BAL_001`, confirms all five Risk modules,
  populated attribution evidence, and an aligned mandate context. It derives every expected
  constraint family, key, and state from the exact Gateway summary and concentration responses,
  addresses each rendered row by source family and constraint key, rejects duplicate source
  ownership and extra, missing, duplicated, or state-mismatched rendered rows, records
  machine-readable comparison proof through the same exact source-render harness used by Advisor
  Book, rejects retired first-scan classifications, and proves page reflow at 1440, 1024, and 519
  pixels. Risk retains its own mandate vocabulary and source adapter.
- Canonical screenshots remain evidence only after API and calculation validation pass; a
  screenshot alone is not source, entitlement, mandate, identity, suitability, or readiness proof.
- Protected PR checks, exact-main releasability, wiki publication, strict parity, and clean branch
  hygiene remain release controls.

Use [Validation and CI](Validation-and-CI) and [Operations Runbook](Operations-Runbook) for the
governed validation sequence.

## First Support Step

Record the selected portfolio, period, basis, benchmark, reporting currency, as-of date, and which
module or mandate comparison says **Partial**, **Unavailable**, **Dates differ**, **Different
mandate contexts**, **Mandate context insufficient**, **Limit not defined**, **Measure
unavailable**, **Review state unavailable**, or **Access restricted**. Open source evidence and lineage,
record the correlation id and source reason without copying client data or raw payloads into an
unapproved channel, and do not invent a missing threshold, headroom, breach, or all-clear.

## Related Documentation

- [Screen Guide Catalogue](Screen-Guide-Catalogue)
- [Supported Features](Supported-Features)
- [API Surface](API-Surface)
- [Integrations](Integrations)
- [Validation and CI](Validation-and-CI)
- [Operations Runbook](Operations-Runbook)
- [Technology Risk and Runtime Support](Technology-Risk-and-Runtime-Support)
