# Risk Workspace Supportability

This note defines the operational supportability posture for the Workbench `Performance > Risk`
mode implemented under RFC-0022.

## Supported v1 modules

The Risk workspace is backed only by Gateway BFF routes over canonical `lotus-risk` stateful APIs.

| Module | Gateway route | First paint behavior | Detail behavior |
| --- | --- | --- | --- |
| Risk Snapshot | `GET /api/v1/workbench/{portfolioId}/risk/summary` | loaded on first paint | no secondary detail fetch |
| Concentration | `GET /api/v1/workbench/{portfolioId}/risk/concentration` | loaded on first paint with portfolio HHI, issuer HHI, top-driver identities, current/proposed comparisons, and coverage controls | simulation deltas only with explicit `sessionId` |
| Drawdown | `GET /api/v1/workbench/{portfolioId}/risk/drawdown` | summary and worst episodes on first paint | underwater series only when explicitly expanded |
| Rolling Risk | `GET /api/v1/workbench/{portfolioId}/risk/rolling` | rolling summaries on first paint | time series only when explicitly expanded |
| Historical Risk Attribution | `GET /api/v1/workbench/{portfolioId}/risk/attribution` | lazy-loaded after the shell renders | grouping and attribution selector changes refetch only the attribution module |

## Risk workspace reading order

The Risk page is a front-office review workflow, not a flat analytics stack.

The default reading order is:

1. portfolio context
2. executive overview band
3. what matters now
4. Risk Snapshot
5. Drawdown
6. Concentration
7. Rolling Risk
8. Historical Risk Attribution

`Risk Snapshot`, `Drawdown`, and `Concentration` are the primary first-line review modules.
`Rolling Risk` and `Historical Risk Attribution` remain contract-backed, but they are positioned as
secondary analytical follow-through after the current book, path, and concentration posture are
understood.

The workspace composition is intentionally split into:

1. an executive briefing band,
2. a primary review group for current risk, path, and concentration,
3. a secondary analysis group for rolling behaviour and attribution drill-down.

## Methodology and coverage access pattern

Coverage, methodology, and supportability details remain available for every risk module, but they
no longer sit as always-visible blocks in the main review flow.

The implemented interaction pattern is:

1. a compact `Methodology & coverage` action in each panel header,
2. an on-demand right-side context drawer,
3. compact labeled rows with value plus one-line explanation,
4. business-safe wording only, with no raw technical flags exposed to the front office.

This keeps the page focused on business reading, key metrics, and next actions on first paint while
preserving auditability and supportability detail on demand for:

1. Risk Snapshot
2. Drawdown
3. Concentration
4. Rolling Risk
5. Historical Risk Attribution

## Analytical drill-down pattern

Drawdown and Rolling Risk keep heavy detail off the main page and expose it only through the shared
analytical detail drawer.

Implemented behavior:

1. `View underwater path` opens a drawdown detail drawer and lazy-loads underwater series only on
   demand.
2. `View rolling series` opens a rolling detail drawer and lazy-loads time-series rolling metrics
   only on demand.
3. The selected rolling window is preserved when the rolling drawer opens.
4. Opening either drill-down must not reflow the page or push other modules down the screen.

This keeps first paint dense and decision-oriented while preserving path and series auditability for
deeper advisor review.

## Risk Snapshot first-read contract

Risk Snapshot is the executive first-read module for the Risk workspace.

The UI must answer three questions within the first viewport:

1. what the current portfolio risk posture is,
2. whether benchmark-relative measures are reliable enough to use,
3. what the front office should review next.

The first metric row is reserved for:

1. `Volatility`
2. `Sharpe`
3. `Beta`
4. `Tracking Error`

Secondary measures such as `Information Ratio`, `Sortino`, and `Value at Risk` remain
contract-backed, but they belong below the headline row as supporting interpretation rather than
the first executive read.

## Drawdown first-read contract

Drawdown is the front-office loss-path review module for the Risk workspace.

The UI must answer three questions within the first viewport:

1. whether realized drawdown was contained or severe,
2. whether benchmark-relative drawdown is relevant enough to use,
3. whether the book recovered or remains underwater.

The first metric row is reserved for:

1. `Max Drawdown`
2. `Relative Max Drawdown`
3. `Time Under Water`
4. `Recovery Status`

`Ulcer Index` remains contract-backed, but it sits below the headline row as a supporting
path-severity measure. Episode detail is interpretive first and tabular second: a retained-episode
table is shown only as supporting evidence after the business reading explains what to review.

## Rolling Risk first-read contract

Rolling Risk is the front-office windowed behaviour review module for the Risk workspace.

The UI must answer three questions within the first viewport:

1. whether the current short-window behaviour is calm, elevated, or unstable,
2. whether the current window looks unusual versus its own recent history,
3. whether benchmark and risk-free alignment are good enough to trust the dependent measures.

The first metric row is reserved for the selected rolling window:

1. `Volatility`
2. `Tracking Error`
3. `Beta`
4. `Max Drawdown`

The selected window detail must compare current, typical, and observed range using concise
interpretation rather than raw statistical copy. The next review action should point the user to the
next most relevant window, typically `63D` after the `21D` first read. Raw quality flags are not
advisor-facing: Gateway and Workbench must map them to business-safe supportability notes such as
qualified benchmark-relative review or limited benchmark variance in an emitted window.

## Stateful-only rule

Workbench does not surface stateless risk execution.

Allowed execution modes:

1. `stateful` for summary, drawdown, rolling, and attribution.
2. `stateful` or `simulation` for concentration, where simulation requires an explicit sandbox
   session.

Blocked behaviors:

1. direct browser calls to `lotus-risk`,
2. stateless payload authoring in the UI,
3. free-form return-series upload,
4. browser-visible service hostnames outside Gateway.

## Active-risk attribution support matrix

The implemented active-risk support matrix is:

| Attribution type | Grouping | State |
| --- | --- | --- |
| `TOTAL_RISK` | `POSITION` | ready |
| `TOTAL_RISK` | `SECTOR` | ready |
| `TOTAL_RISK` | `ASSET_CLASS` | ready |
| `TOTAL_RISK` | `ISSUER` | ready |
| `ACTIVE_RISK` | `POSITION` | ready |
| `ACTIVE_RISK` | `SECTOR` | ready |
| `ACTIVE_RISK` | `ASSET_CLASS` | ready |
| `ACTIVE_RISK` | `ISSUER` | blocked |

`ACTIVE_RISK + ISSUER` remains blocked until upstream benchmark issuer exposure semantics exist.

These values describe whether a control combination can be requested. They do not certify the
readiness of a returned decomposition.

## Attribution evidence presentation

Gateway owns the Workbench attribution state. Workbench preserves its four-state vocabulary:
`ready`, `partial`, `unavailable`, and `blocked`.

- `ready` contributor evidence may use a magnitude track alongside the exact contribution share.
- `partial` contributor evidence keeps supported text values and controls visible, adds a qualified
  evidence notice, and withholds magnitude tracks. This applies both to a clean proxy result and to
  a proxy result carrying a higher-priority calculation limitation.
- `unavailable` and `blocked` states do not render contributor rows.
- an unrecognized runtime state follows the unavailable path; it is never promoted to ready.

The presentation gate uses the state, not a reason code or degraded-metric count. Risk may preserve
a more actionable failure reason ahead of the structural proxy limitation, so absence of one named
reason is not readiness evidence. Workbench does not recalculate the contribution, infer a missing
group return, or assume contribution share equals portfolio weight.

## Supportability states

Every risk module returns explicit supportability items normalized to:

1. `ready`
2. `partial`
3. `unavailable`
4. `blocked`

The UI must render the upstream reason text when a state is not `ready`.

## Concentration contract posture

The concentration workspace uses a Gateway-normalized contract rather than exposing upstream
`lotus-risk` block names directly.

Current payload blocks:

1. `portfolio_concentration`
   - portfolio-level HHI current / proposed / delta
2. `single_position_concentration`
   - source-owned `TOP_POSITION_WEIGHT` current / proposed / delta fields from
     `ConcentrationRiskReport:v1`
   - top-`n` cumulative weights
   - named current / proposed top-position drivers
3. `issuer_concentration`
   - issuer HHI current / proposed / delta
   - named current / proposed top-issuer drivers
   - coverage ratios and uncovered counts
4. `valuation_context`
   - portfolio and reporting currency
   - position / weight basis
5. `execution_context`
   - issuer grouping level
   - enrichment policy
   - cash / zero-quantity inclusion posture

This gives the front office three explicit answers on first paint:

1. how concentrated the live book is,
2. which position and issuer are driving that concentration,
3. how trustworthy the issuer concentration view is.

Workbench may format the source-owned top-position weights and driver names for display, but it
must not recalculate `TOP_POSITION_WEIGHT`, infer the largest position locally, or override the
current/proposed driver identities returned through Gateway.

## Cache and refresh posture

Gateway owns bounded caching for repeated identical risk requests.

Rules:

1. cache keys include portfolio, period, basis, benchmark, as-of date, reporting currency, and
   session context where relevant,
2. heavy detail payloads are not fetched on first paint,
3. module refreshes stay isolated to the module that owns the query,
4. a failed heavy module must not blank the rest of Risk mode.

## Legacy compatibility posture

The old workbench analytics `risk_proxy` field is removed from the production contract.

Implications:

1. `src/app/workbench/[portfolioId]` links to the live Risk workspace instead of reading a legacy
   HHI value,
2. concentration analytics belong to the dedicated Risk BFF contract,
3. `/analytics/workbench/risk-proxy` remains removed and must not be reintroduced.
