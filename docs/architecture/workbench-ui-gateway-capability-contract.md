# Workbench UI-To-Gateway Capability Contract

## Current Scope

This record defines how Workbench turns typed Gateway responses into truthful presentation states.
It covers UI supportability and capability rendering; it does not transfer domain policy,
calculation, entitlement, workflow, or production-identity authority into the browser.

Current route and endpoint truth is maintained in [API Surface](../../wiki/API-Surface.md), current
product posture in [Supported Features](../../wiki/Supported-Features.md), and source ownership in
[Integrations](../../wiki/Integrations.md). This record owns the architectural rules below rather
than duplicating those inventories.

## Request And Authority Flow

```text
browser selection and business input
  -> Workbench route/view model
  -> /api/bff closed-header boundary
  -> lotus-gateway typed product contract
  -> owning service facts, calculations, policy, workflow, and evidence
  -> Workbench supported/partial/unavailable/hidden presentation
```

The BFF removes browser-supplied authority and applies server-owned caller context before Gateway.
Route-family adapters may narrow authority further. A capability response never creates identity,
entitlement, approval, or execution authority by itself.

## Capability Vocabulary

The shared workspace vocabulary is defined in
[`src/shell/workspace-capabilities.ts`](../../src/shell/workspace-capabilities.ts):

| State | UI obligation |
| --- | --- |
| `supported` | Render the source-backed feature and its available actions |
| `partial` | Keep usable facts visible and name the missing or degraded source dependency |
| `unavailable` | Render a business-safe unavailable state with a recovery or support path |
| `hidden` | Omit the feature only when the current mode or source contract says it is not applicable |

Domain-specific view models may use richer state names such as blocked, unsupported, empty,
access-restricted, undefined-limit, or measure-unavailable. They must preserve the source meaning
and must not collapse distinct failure or policy states into reassuring copy.

## Ownership Rules

Gateway and source services own:

- domain facts, calculations, thresholds, policy, and methodology;
- source readiness, supportability, lineage, freshness, and coverage;
- persisted workflow state, decisions, evidence, reports, and generated-material posture;
- capability and entitlement facts exposed by the supported contract.

Workbench owns:

- route and selected-context preservation;
- typed transport through the BFF;
- view-model mapping from source facts to business-first information hierarchy;
- consistent loading, empty, partial, unavailable, blocked, unsupported, stale, and error states;
- accessible presentation, progressive detail, and supported action affordances.

Workbench must not infer a supported state from data presence alone, invent fallback calculations or
thresholds, silently replace a missing source response, or show action success before persistence
succeeds.

## Current Implementation Pattern

- Shell-level workspace capability is centralised in `src/shell/workspace-capabilities.ts`.
- Performance capability mapping is owned by `src/apps/performance/capabilities.ts` and its typed
  view models.
- Portfolio supportability is composed from the current workspace and domain view models; the
  retired `src/apps/portfolio/capabilities.ts` module is not a current authority.
- Manage, advisory, proposal, reporting, and data-product surfaces use feature-owned typed API and
  view-model modules rather than one browser-wide capability map.
- Shared unavailable and supportability presentation uses design-system primitives rather than
  screen-local fallback markup where applicable.

Performance Evidence is an implemented runtime-gated surface. It renders source calculation,
lineage, coverage, and supporting-record posture when Gateway supplies it, and fails visibly when
that evidence is unavailable. It is not a future placeholder and does not infer missing evidence.

## Failure And Compatibility Rules

1. Additive response fields may be absent; absence must map to a truthful unavailable/not-supplied
   posture unless the contract defines another meaning.
2. A partial source response must retain usable facts and expose the specific gap.
3. Network, parsing, authorization, and source failures must remain distinguishable where the user
   or support action differs.
4. Mutations show success only after the owning service confirms persistence. If the subsequent
   refresh fails, show persisted-but-refresh-failed rather than fabricated freshness.
5. Capability-disabled routes may be directly validated, but ordinary shell promotion remains
   closed until the governing capability changes.
6. Compatibility routes and aliases reuse canonical view and guide ownership; they do not create a
   second business contract.

## Evidence

- `npm run quality:bff-header-boundary` proves the shared BFF ingress pattern is present.
- `npm run quality:screen-docs` reconciles routes, modes, source owners, evidence, and guides.
- Unit and integration tests prove feature-specific mapping and failure behavior.
- Fixture browser families prove deterministic Workbench states against governed fixtures.
- `npm run live:stack:up:validate` is required for an integrated source-backed capability claim.

Historical latency samples or delivery-slice measurements are not a current performance baseline.
Use current run artefacts and source timings when making a performance claim.

## Change Rule

When a source contract or capability changes, update the owning typed API/view model, meaningful
failure-path tests, [Supported Features](../../wiki/Supported-Features.md), the relevant screen
guide, and API/integration documentation in the same issue-backed slice. Do not strengthen product
claims until exact-main and any required canonical evidence exist.
