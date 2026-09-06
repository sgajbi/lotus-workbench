# RFC-0023: Risk Workspace UX Hardening and Production Readiness

- Status: IMPLEMENTED
- Date: 2026-04-08
- Owners:
  - lotus-workbench maintainers
  - lotus-gateway maintainers
  - lotus-risk maintainers
- Requires Approval From:
  - lotus-workbench maintainers
  - lotus-gateway maintainers
  - lotus-risk maintainers
  - lotus-platform maintainers
- Extends:
  - RFC-0021: UI Architecture Hardening and Design-System Governance
  - RFC-0022: Stateful Risk Workspace and lotus-risk UI Integration

## Summary

RFC-0022 established the bounded architecture for the Risk workspace:

1. `lotus-workbench` owns the UI composition,
2. `lotus-gateway` owns the front-office BFF contracts,
3. `lotus-risk` owns the analytics truth,
4. risk modules are benchmark-aware, supportability-aware, and stateful by design.

That architecture is correct and should remain intact.

What is still missing is the product-quality hardening needed to make the shipped workspace feel
like a premium private-banking risk workstation rather than a stack of analytics cards.

The current implementation is directionally strong, but the first production pass still leaves
material gaps:

1. the page still reads too much like a vertical report,
2. primary and secondary risk modules are not yet differentiated strongly enough,
3. several modules still consume more space than their first-read value justifies,
4. detail and methodology access patterns need tighter standardization,
5. UX quality needs to be backed by stricter live validation across `lotus-risk` and
   `lotus-gateway`,
6. the workspace still needs more production hardening around density, drill-down behavior,
   maintainability, and test quality.

This RFC proposes a focused hardening phase to complete that step.

It is not a decorative redesign RFC.

It is a UX, contract-validation, and production-readiness RFC for the Risk workspace.

## Approval Posture

Approval should be treated as approval for these hard decisions:

1. the Risk workspace must evolve from a module stack into a connected front-office review surface,
2. workspace hierarchy must prioritize executive posture and primary review modules before
   secondary analytical follow-through,
3. heavy analytical detail must move to stable on-demand drill-down surfaces rather than inline
   expansion,
4. methodology and coverage detail must remain available but must not compete with business reading
   on first paint,
5. every UI refinement must remain explicitly backed by validated `lotus-gateway` and `lotus-risk`
   behavior,
6. implementation will proceed through small, auditable slices with meaningful tests and updated
   docs.

Approval should not be treated as approval for:

1. direct browser-to-`lotus-risk` calls,
2. UI-only inventing of unsupported analytics or supportability states,
3. decorative charts or consumer-fintech styling,
4. a second top-level Risk application outside the current Workbench experience,
5. weakening the Gateway BFF boundary in the name of UI speed.

## Why This RFC Is Needed

RFC-0022 delivered the Risk workspace foundation.

That made the next product problem visible:

1. the workspace now has enough real analytical weight that shallow composition is obvious,
2. the current UI can answer many risk questions, but it still takes more reading effort than a
   front-office workflow should require,
3. detail interactions still risk competing with first-line review,
4. production confidence now depends as much on contract validation and operational trust as on
   raw rendering.

The next correct step is not more isolated panel polish.

The next correct step is hardening the whole Risk workspace around:

1. decision-first reading flow,
2. denser and more stable composition,
3. shared drill-down and methodology patterns,
4. stronger API validation discipline,
5. explicit production-readiness closure.

## Current Source Reality

### What RFC-0022 got right

The current workspace already has a strong base:

1. `Risk Snapshot`, `Drawdown`, `Rolling Risk`, `Concentration`, and
   `Historical Risk Attribution` exist as real modules,
2. Gateway-backed stateful contracts already exist for the major module surfaces,
3. the UI already uses the Workbench shared architecture direction established in RFC-0021,
4. supportability and benchmark-aware behavior are already first-class concerns,
5. heavy detail can already be loaded on demand in parts of the experience.

That baseline should be preserved.

### What is still weak

The current workspace still has these problems:

1. too many equal-weight analytical surfaces,
2. insufficient distinction between first-line review and secondary drill-down,
3. too much vertical sprawl for the amount of first-read signal delivered,
4. panel grammar is improving but not yet standardized strongly enough,
5. detail affordances and methodology access need one shared interaction model,
6. some business copy still reads like a statistics worksheet rather than a front-office review,
7. API validation posture is not yet documented tightly enough as an implementation rule for all
   future slices.

## Problem Statement

The current Risk workspace is no longer blocked by missing analytics.

It is now blocked by incomplete product hardening.

If the current posture remains:

1. advisors will need to read too much page structure before identifying what matters,
2. secondary analytics will continue to compete visually with primary review,
3. the page will remain longer and less stable than necessary,
4. future panel refinements will risk becoming local improvements without a coherent workspace
   grammar,
5. confidence in the UI can drift unless backend validation remains an explicit rule and not only
   a team habit.

That is not acceptable for a front-office risk surface.

## Goals

1. Make the Risk workspace materially more business-first and front-office useful.
2. Make the page denser, more organized, and less report-like.
3. Standardize a shared panel grammar across all risk modules.
4. Separate primary review modules from secondary analytical follow-through clearly.
5. Move heavy detail into stable on-demand drill-down surfaces.
6. Keep methodology and coverage available without consuming permanent page real estate.
7. Strengthen reusable UI patterns and reduce page-local improvisation.
8. Make backend validation across `lotus-risk` and `lotus-gateway` an explicit delivery rule.
9. Raise the test bar for interaction, view-model, request-shape, and supportability behavior.
10. Leave the risk workspace measurably more production-ready than the current baseline.

## Non-Goals

1. Defining new risk analytics formulas in `lotus-workbench`.
2. Bypassing `lotus-gateway` to speed up UI iteration.
3. Building a chart-heavy visual dashboard with decorative graphics.
4. Replacing the bounded architecture from RFC-0022.
5. Rewriting unrelated Workbench surfaces outside the Risk workspace.

## Decision

The Risk workspace will be hardened as one connected front-office review surface with:

1. an executive-first page hierarchy,
2. standardized module grammar,
3. compact primary review modules,
4. quieter secondary analytical modules,
5. one shared methodology-access pattern,
6. one shared analytical-detail drawer pattern,
7. explicit live contract validation expectations across `lotus-risk` and `lotus-gateway`.

The implementation must preserve the bounded architecture from RFC-0022 while materially improving
the quality of the front-office reading flow.

## Product and UX Rules

### 1. Business-first page hierarchy

The workspace must read in this order:

1. context,
2. executive posture,
3. what matters now,
4. primary review modules,
5. secondary analytical follow-through.

### 2. Primary versus secondary module separation

Primary modules:

1. Risk Snapshot
2. Drawdown
3. Concentration

Secondary modules:

1. Rolling Risk
2. Historical Risk Attribution

The workspace should make that distinction obvious through composition, density, and emphasis, not
through ornament.

### 3. Shared panel grammar

Every risk panel should converge on this grammar:

1. panel title,
2. one-line business subtitle,
3. business reading,
4. key metrics,
5. compact decision detail,
6. optional drill-down action,
7. methodology and coverage access.

This does not mean every panel should look identical.

It means every panel should read predictably.

### 4. Detail on demand without layout disruption

Heavy analytical detail must not expand inline inside the main page flow once the hardened pattern is
available.

Required examples:

1. `View rolling series`
2. `View underwater path`

Both must use a shared analytical detail drawer or equivalent responsive surface.

### 5. Methodology on demand

Methodology, coverage, and supportability context remain mandatory for trust, but they should not
consume large persistent blocks inside primary module layouts.

They should be reachable through one shared compact access pattern.

### 6. Business-safe language

Advisor-facing copy must use front-office language such as:

1. risk posture,
2. drawdown posture,
3. concentration posture,
4. recovery,
5. benchmark-relative review,
6. short-window behavior,
7. contributor review,
8. evidence posture.

The UI must avoid engine language, raw technical codes, and model-oriented narration unless those
details are intentionally scoped into supportability or methodology surfaces.

## Architecture Rules

### 1. Gateway remains the only browser-facing risk seam

The correct runtime path remains:

```text
lotus-workbench
  -> lotus-gateway /api/v1/workbench/{portfolioId}/risk/*
    -> lotus-risk /analytics/risk/*
```

No browser code may call `lotus-risk` directly.

### 2. UI capabilities must remain backend-backed

The Workbench UI must not fabricate:

1. unsupported benchmark-relative states,
2. unsupported active-risk combinations,
3. unsupported coverage semantics,
4. invented calculations based on partial client-side inference.

### 3. Heavy detail stays opt-in

Time-series and other larger analytical payloads should remain lazy-loaded where possible.

Hardening the UI must not regress first-paint latency.

### 4. Shared primitives over page-local hacks

The Risk workspace should converge on reusable patterns such as:

1. `RiskExecutiveOverview`,
2. `RiskWhatMattersNow`,
3. `RiskPanelShell`,
4. `RiskBusinessReading`,
5. `RiskMetricCard`,
6. `RiskMethodologyAccess`,
7. `RiskDetailDrawer`,
8. `RiskPostureChip`,
9. `RiskAnalyticalTable`.

Exact names may evolve, but the reuse requirement does not.

## API Validation and Backend Alignment Rules

For every slice in this RFC, the delivery team must validate both the upstream risk domain service
and the Gateway BFF contract.

That means:

1. call the actual `lotus-risk` endpoint,
2. call the corresponding `lotus-gateway` endpoint,
3. compare units, scaling, nullability, blocked-state semantics, and mapping,
4. ensure Workbench copy and state handling do not overstate backend support.

Mandatory validation concerns include:

1. percentage versus ratio scaling,
2. benchmark-relative interpretation drift,
3. risk-free alignment semantics,
4. unavailable versus blocked versus partial distinctions,
5. omitted or malformed upstream payload behavior,
6. opt-in detail flags and lazy-loading behavior.

## Test Requirements

Meaningful tests only.

Required categories across the implementation:

1. request-shape tests,
2. Gateway mapping tests,
3. supportability and blocked-state tests,
4. business-reading and view-model interpretation tests,
5. UI interaction tests for drill-down and methodology patterns,
6. lazy-loading and cache-boundary tests,
7. no-regression architecture guards,
8. focused integration validation for page composition and module ordering.

Snapshot-only markup tests do not satisfy this RFC on their own.

## Documentation Requirements

Documentation must be updated whenever these change:

1. page hierarchy,
2. drill-down interaction model,
3. methodology-access pattern,
4. supportability semantics,
5. API validation expectations,
6. screenshot capture workflow for visual review evidence.

## Delivery Slices

The implementation should proceed in small, coherent, reviewable slices.

### Slice 1: RFC landing and guardrail baseline

Outcome:

1. land this RFC in `lotus-workbench`,
2. add architecture guards for the hardening direction where missing,
3. document the no-direct-service-call and no-inline-heavy-detail rules explicitly.

Acceptance gate:

1. RFC is reviewable,
2. architecture-guard coverage exists or is strengthened,
3. no user-facing behavior changes are required in this slice.

### Slice 2: Gateway and domain API validation inventory

Outcome:

1. document the risk UI-to-Gateway-to-domain endpoint map,
2. identify request-shape, supportability, and latency-sensitive detail dependencies,
3. add missing contract tests where obvious gaps exist.

Acceptance gate:

1. validation inventory exists,
2. request-shape gaps are closed or tracked explicitly,
3. no speculative UI contract drift remains hidden.

### Slice 3: Shared analytical detail drawer

Outcome:

1. introduce one reusable analytical drill-down drawer,
2. make it responsive, accessible, and suitable for rolling and drawdown detail.

Acceptance gate:

1. drawer exists,
2. tests cover open, close, accessibility, and responsive behavior,
3. main-page layout remains stable.

### Slice 4: Drawdown drill-down migration

Outcome:

1. replace inline underwater expansion with `View underwater path`,
2. preserve lazy loading,
3. keep the main Drawdown panel compact.

Acceptance gate:

1. no inline underwater expansion remains,
2. drawer behavior is validated,
3. drawdown first read stays stable.

### Slice 5: Rolling drill-down migration

Outcome:

1. replace inline rolling-series expansion with `View rolling series`,
2. preserve selected window context,
3. keep time-series detail opt-in.

Acceptance gate:

1. no inline rolling expansion remains,
2. selected-window continuity is preserved,
3. heavy detail remains lazy-loaded.

### Slice 6: Shared methodology and coverage access

Outcome:

1. move persistent methodology blocks into a shared on-demand access pattern,
2. preserve trust and auditability while reducing page clutter.

Acceptance gate:

1. methodology access is standardized,
2. information is preserved,
3. primary module layouts gain space and focus.

### Slice 7: Module densification and business-language hardening

Outcome:

1. Risk Snapshot, Drawdown, Concentration, Rolling Risk, and Historical Risk Attribution become
   denser and more business-oriented,
2. primary and secondary modules are differentiated more clearly.

Acceptance gate:

1. each module reads faster,
2. visual hierarchy is clearer,
3. view-model interpretations carry business-safe language.

### Slice 8: Workspace hierarchy hardening

Outcome:

1. the page feels like a premium risk workstation rather than a long report,
2. overview, primary review, and secondary review areas are intentionally composed.

Acceptance gate:

1. first screen answers posture and next-review questions quickly,
2. page rhythm is clearer,
3. secondary analytics no longer compete with first-line review.

### Slice 9: Query, latency, and production hardening

Outcome:

1. fetching, caching, invalidation, and module isolation are tightened,
2. the workspace becomes more resilient under live usage.

Acceptance gate:

1. heavy detail remains opt-in,
2. unrelated modules do not refetch unnecessarily,
3. query boundaries are explicit and tested.

### Slice 10: Documentation closeout and visual evidence

Outcome:

1. update runbooks and supportability docs,
2. capture final screenshots for review,
3. close out the RFC only after the live validation and local gates are green.

Acceptance gate:

1. docs match implementation reality,
2. screenshots are captured to
   `<temp-dir>/lotus-risk-module-shots`, where `<temp-dir>` is a caller-selected temporary
   directory outside the repository,
3. screenshot artifacts remain outside git.

## Success Criteria

This RFC succeeds when:

1. the Risk workspace feels materially more like a front-office risk workstation than a report,
2. primary versus secondary modules are obvious at a glance,
3. heavy detail and methodology no longer distort main-page composition,
4. all shipped UI states remain backed by validated Gateway and domain behavior,
5. the code becomes more modular, reusable, and reviewable,
6. the test suite proves business behavior and interaction quality rather than only rendering,
7. the workspace is faster to scan and easier to operate without losing trust.

## Risks

1. local UI polish could drift ahead of verified backend semantics,
2. denser layouts could become cluttered if panel grammar is not disciplined,
3. shared patterns could become overly generic if not kept explicit,
4. detail drawers could regress accessibility if treated as ad hoc modals,
5. production hardening could stall if documentation and validation are deferred until the end.

## Mitigations

1. keep validation against both `lotus-risk` and `lotus-gateway` mandatory for each risk slice,
2. keep slices small and bounded,
3. prefer explicit reusable components over abstraction-heavy shells,
4. keep first-read business content separate from drill-down detail,
5. update docs and tests in the same slice whenever behavior changes.

## Definition of Done

RFC-0023 should be marked `IMPLEMENTED` only when all of the following are true:

1. the Risk workspace has a clearly differentiated executive overview, primary review, and
   secondary analytical follow-through,
2. shared drill-down and methodology-access patterns are in place across the workspace,
3. rolling-series and underwater-path detail no longer expand inline inside the page flow,
4. all major panels use the hardened business-first panel grammar,
5. API validation across `lotus-risk` and `lotus-gateway` is documented and evidenced,
6. meaningful tests cover the shipped interaction and supportability behavior,
7. docs describe the final interaction model and operator validation expectations,
8. screenshots are captured to the required temp path and are excluded from git.

## Approval Requested

Approve this RFC if the team agrees that:

1. the next step for the Risk workspace is hardening, not architectural reset,
2. front-office usefulness depends on stronger hierarchy, denser composition, and standardized
   drill-down behavior,
3. methodology and supportability should remain available but move off the primary page surface,
4. every UI refinement must continue to be grounded in explicit Gateway-to-domain validation,
5. the implementation should proceed through the slice discipline and quality bar defined here.
