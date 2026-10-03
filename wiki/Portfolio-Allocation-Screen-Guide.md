# Portfolio Allocation

Portfolio Allocation is the selected mandate's exposure-review workspace. It connects source
allocation views to the booked positions that contribute to a direct exposure while keeping
expanded look-through coverage visibly separate. It does not set a target allocation, diagnose a
breach, recommend a rebalance, or authorize execution.

## Current Scope

| Screen posture | Current truth |
| --- | --- |
| Canonical route | `/allocation?portfolioId={portfolio_id}` |
| Navigation | **Allocation** in the selected-portfolio rail |
| Supported scope | One source-backed portfolio; asset class, currency, sector, and region views returned by Gateway |
| Evidence posture | Focused negative-state tests plus optimized-browser recovery proof for `PB_SG_GLOBAL_BAL_001` |
| Primary next action | Inspect a direct exposure's booked contributors, then continue to Positions, Performance, Risk, or Portfolio Review |

The screen follows shared selected-portfolio context. Changing the portfolio requests that
mandate's records and fences late responses from the prior selection; it does not aggregate a
household, relationship, team, or advisor book.

## Business Purpose

Allocation helps a client advisor, portfolio manager, or investment specialist answer four
questions before a portfolio review:

1. How is the selected mandate currently distributed across the available exposure dimensions?
2. Which exposures are largest by source market value and portfolio weight?
3. Which booked positions contribute to a selected direct exposure?
4. Has the source confirmed that expanded exposure is available for this portfolio snapshot?

The reading order is portfolio context, compact mandate measures, exposure dimension, exact ranked
values, source-coverage posture, and contributing positions. This supports a fast whole-portfolio
review without turning a chart into an investment conclusion.

## Who Uses This Screen

- **Client advisors and relationship managers** use it for meeting preparation and to trace a
  direct exposure back to the selected mandate's booked positions.
- **Portfolio managers and investment specialists** compare current source classifications before
  opening the owning analytical or mandate workflow.
- **Operations and support teams** use explicit coverage and degraded states to distinguish usable
  direct records from unconfirmed optional look-through evidence.
- **Product and demonstration teams** use deterministic browser proof to verify that recovery
  recontacts Gateway and that compact layouts preserve exact evidence.

These roles describe business use, not production entitlement or approval authority.

## Workflow Position

1. Select a portfolio in [Advisor Book](Advisor-Book-Workflow) or the shared portfolio switcher.
2. Confirm mandate, client reference, reporting currency, and as-of date.
3. Move among asset class, currency, sector, and region when those source views are available.
4. Compare exact market value, weight, and source-reported position count in the ranked view.
5. Select a direct exposure to inspect its booked contributing positions; clear the filter to return
   to the complete booked inventory.
6. Use expanded exposure only after the source-coverage status confirms it for the current
   snapshot. Open **Source contributors** for retained source lineage. Expanded rows do not filter
   the booked positions grid because component identity is separate from the booked parent.
7. Continue to Positions for position detail, Performance or Risk for source-owned analytics, or
   Portfolio Review for the daily decision checkpoint.

## Implemented Capabilities

- Presents source allocation across asset class, currency, sector, and region without summing
  buckets across unrelated dimensions.
- Offers composition, comparison, and table presentations on layouts where each adds information;
  compact layouts prioritize the exact ranked values and omit a chart that cannot remain legible.
- Shows market value, weight, source position count, reporting currency, and direct or expanded
  exposure mode beside the selected dimension.
- Filters the reusable positions grid from a direct exposure selection, including
  source-returned cash balances where applicable.
- Requests preferred look-through coverage separately and distinguishes checking, available,
  unsupported, and failed source states.
- Retains valid direct allocation when the optional expanded-exposure request fails.
- Keeps **Recheck coverage** mounted, prevents duplicate activation while pending, and preserves
  keyboard focus through successful recovery.
- Preserves source contributor identities and nullable values in **Source contributors**, including
  look-through components and bounded-list counts. Expanded rows do not claim booked contributors.
- Keeps valuation coverage separate from optional look-through availability. A valid look-through
  response does not make incomplete valuation ready.

### Valuation qualification

Gateway supplies the Core-owned coverage state, bounded source reason and observed/expected/valued/
unvalued counts. The dedicated allocation response is admitted for the exact portfolio, date and
reporting currency. Book views alone leave valuation coverage **unconfirmed** until that read succeeds.

| Source valuation state | Reading posture |
| --- | --- |
| Complete | Known values and weights remain usable; signed exposure uses comparison rather than unsigned composition |
| Measured zero | Source monetary zero remains zero; a zero denominator leaves weights unavailable |
| Carried forward | Values retain an explicit carry-forward qualification and source reason |
| Partial | Known bucket values can remain, but unknown amounts and all unsupported weights say **Unavailable**; the table replaces geometry |
| Unavailable | Expected-position coverage remains visible even when no snapshot rows or buckets exist |
| Loaded empty | An actual empty source snapshot is distinguished from unavailable valuations |

Unavailable values are not assigned zero for totals, ranking, chart widths, or selection. Unknown
buckets retain identity after known market values, including signed negative values. Direct selection
can inspect booked classification without asserting a measured weight. Recheck and mode changes keep
the displayed views and their source qualification together.
The contributing-positions summary remains **Unavailable** when any retained holding value is
unknown; it does not publish the sum of known rows as a complete total. Genuine zero and signed
holding values remain measurable.

## Decisions And Actions

| User decision or action | Required evidence or gate | Persisted business change |
| --- | --- | --- |
| Change exposure dimension | The source returned that dimension | None; current evidence is rearranged |
| Change presentation | A loaded exposure view and sufficient layout capacity | None; source values do not change |
| Review direct contributors | A direct exposure with booked-position classification | None; the positions grid is filtered locally |
| Show expanded exposure | Source-confirmed preferred look-through response | None; Workbench switches between cached source responses |
| Recheck coverage | Coverage is unresolved, unsupported, or previously confirmed | None; Workbench forces a new Gateway read |
| Change portfolio | A source-backed selection through shared context | None on Allocation; the new mandate is requested |

The screen has no command to change an allocation, approve a breach, create a recommendation,
submit a rebalance, or place an order.

## Information And Source Authority

| Business fact or action | Workbench boundary | Source authority |
| --- | --- | --- |
| Portfolio identity, mandate, client reference, as-of date, currency, portfolio value, and position count | Presented from the selected portfolio book; not reconstructed from filtered rows | Gateway over Core portfolio book and summary records |
| Direct allocation views and buckets | Formatted into dimensions and ranked values without browser recomputation | Core allocation records composed by Gateway |
| Expanded-exposure capability and effective mode | Accepted only from a successful preferred-look-through allocation response | Gateway/Core allocation contract |
| Direct contributing positions | Matches source-booked positions and cash records against the selected direct classification | Workbench projection over Gateway/Core booked records |
| Coverage recheck | Forces a new same-origin BFF request; success is shown only after a valid source response | Gateway read through the Workbench BFF |

Browser and server requests use Gateway; the screen never calls Core directly. Shared contract
detail remains in [API Surface](API-Surface) and ownership flow in [Integrations](Integrations).

## Screen States And Recovery

| State | What the user sees | Recovery posture |
| --- | --- | --- |
| Loading | Shared route loading while selected portfolio records settle | Wait for source evidence; no fallback portfolio is substituted |
| Checking coverage | Direct allocation stays usable and the status names the requested and confirmed contexts | Wait or continue with direct evidence; duplicate recheck is suppressed |
| Ready with expanded exposure | **Source coverage confirmed** and the expanded-exposure control is enabled | Use the confirmed view or return to direct positions |
| Direct positions only | A valid response explicitly does not support expanded exposure for this snapshot | Continue with direct evidence; recheck only when source posture may have changed |
| Coverage failed | Direct allocation remains visible and the status says expanded exposure could not be confirmed | Use **Recheck coverage**; Workbench does not relabel failure as unsupported |
| Source-confirmed empty view | The source supports the selected direct or expanded mode but returns no buckets | Confirm source population; empty coverage is neither unsupported nor presented as an all-clear |
| Expanded contributors unavailable | Expanded values remain readable but exposure rows cannot claim booked contributors | Return to direct positions for contributor review |
| Portfolio records unavailable | A degraded route state replaces the allocation workspace | Restore a valid source-backed portfolio selection through the governed runtime |

## Workbench Boundaries

Portfolio Allocation deliberately does not:

- calculate or infer target weights, benchmark weights, drift, mandate compliance, concentration
  thresholds, suitability, tax consequences, risk severity, or recommendation posture,
- equate a booked parent position with decomposed expanded-exposure contributors,
- recalculate portfolio value, currency conversion, or source position counts,
- persist portfolio changes, create proposals, rebalance, trade, route orders, or claim execution,
- treat a screenshot, chart, or successful browser render as bank approval or competitor
  superiority.

The adopted pattern combines whole-portfolio composition with position-based drill-down, informed
by official BlackRock Advisor Center 360, BlackRock Aladdin Wealth, and Morningstar Portfolio X-Ray
workflow research. Lotus uses the workflow principle, not another product's visual identity,
wording, calculations, or unsupported capability.

## Adjacent Handoffs

- [Advisor Book](Advisor-Book-Workflow) establishes own-book portfolio context.
- [Portfolio Review](Portfolio-Review-Screen-Guide) is the daily mandate decision checkpoint.
- [Positions](Positions-Screen-Guide) owns the complete booked inventory and position detail.
- Performance Summary and Risk Review own source-calculated analytical interpretation.
- Mandate Operations owns mandate state; Report Centre owns governed report requests.

## Evidence And Validation

- `tests/unit/portfolio-allocation-panel.test.tsx` proves available, unsupported, failed, retry,
  focus-stable, keyboard, empty, and superseded-response behavior.
- `tests/unit/portfolio-api.test.ts` proves uncached BFF transport and explicit source recheck
  semantics; application-level reuse belongs to the governed Query client rather than this API
  adapter.
- `tests/unit/portfolio-allocation-qualified.test.tsx` covers source qualification, malformed source
  rejection, unknown versus measured zero, signed comparison and carry-forward controls.
- The `allocation-qualified` browser scenario exercises all six coverage states through the actual
  BFF and browser with a deterministic Gateway double. This is bounded consumer proof; it does not
  certify live Core ingestion, production authority or the full canonical journey. Its screenshots
  are diagnostic evidence until canonical API, calculation and panel validation succeeds.
- `tests/e2e/portfolio-workbench.smoke.spec.ts` proves the optimized-production journey with
  `PB_SG_GLOBAL_BAL_001`: retained direct evidence, keyboard contributor review, forced source
  recheck, confirmed recovery, compact exact-value priority, zero page overflow, and clean browser
  runtime.
- `output/playwright/issue-727-allocation-recovery/` contains generated machine-readable proof and
  reviewed wide/compact screenshots. These are branch evidence, not readiness certification.
- Use [Validation and CI](Validation-and-CI) and [Operations Runbook](Operations-Runbook) for the
  governed local and exact-main sequence.

## First Support Step

Confirm the selected portfolio, as-of date, reporting currency, and whether direct allocation is
still visible. Use **Recheck coverage** once. If coverage remains unconfirmed, preserve the direct
evidence, record the affected dimension and approved support reference, and inspect the owning
Gateway/Core runtime without copying client identifiers or payloads into a support channel. Do not
call Core directly or force the expanded state in the browser.

## Related Documentation

- [Screen Guide Catalogue](Screen-Guide-Catalogue)
- [Portfolio Review Workflow](Portfolio-Review-Workflow)
- [Supported Features](Supported-Features)
- [API Surface](API-Surface)
- [Integrations](Integrations)
- [Validation and CI](Validation-and-CI)
- [Operations Runbook](Operations-Runbook)
- [Technology Risk and Runtime Support](Technology-Risk-and-Runtime-Support)
