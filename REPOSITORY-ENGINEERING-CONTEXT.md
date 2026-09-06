# Repository Engineering Context

This is the concise repository-local entry for `lotus-workbench`. It records current ownership,
architecture, invariants, task routes, and completion evidence. Product guidance lives in the
[documentation map](docs/README.md); active delivery state lives in GitHub issues, especially
[#781](https://github.com/sgajbi/lotus-workbench/issues/781).

Start with `AGENTS.md`, the Lotus Quickstart, this file, and the Lotus Skill Routing Map. If a
sibling `lotus-platform` checkout is unavailable, use the canonical links under [Cross-Links](#cross-links).

## Repository Role

`lotus-workbench` is the primary front-office product interface for the Lotus ecosystem. It gives
relationship managers, advisers, portfolio managers, investment specialists, operations teams,
and support teams a decision-oriented view of governed portfolio, performance, risk, advisory,
portfolio-management, reporting, and data-product facts.

Workbench is a presentation and workflow client. It consumes product contracts through
`lotus-gateway`; it does not own portfolio records, calculations, mandate policy, advice, report
production, or AI evidence.

## Business And Domain Responsibility

Workbench owns information hierarchy and navigation, compact decision views and drill-downs,
truthful loading and degraded states, accessible responsive interaction, consistent business
language, and client orchestration of source-authorized reads and commands.

The owning Lotus service remains authoritative for every business fact, calculation, permission,
workflow state, evidence identity, and policy decision. Workbench may format and arrange source
facts; it must not invent reassuring defaults, thresholds, authority, or successful outcomes.

## Current-State Summary

- The production application is Next.js 15 with React 19 and TypeScript. MUI, TanStack Query,
  AG Grid, ECharts, React Hook Form, Zod, Vitest, and Playwright are admitted through the governed
  dependency inventory.
- Portfolio and Performance/Risk source reads use root-owned TanStack Query state with complete
  business-context keys, explicit source admission, and bounded freshness policy.
- The browser calls same-origin `/api/bff/**` routes. Those routes strip browser-supplied authority
  and forward only the closed server-owned caller context to Gateway.
- The current server caller context is a bounded local/development posture, not production identity.
  Authenticated actor, tenant, entitlement, expiry, and revocation authority remain owned by
  [#436](https://github.com/sgajbi/lotus-workbench/issues/436) with Platform #563/#775.
- Active routes, modes, source owners, screen guides, and evidence expectations are registered in
  `docs/documentation/workbench-screen-registry.v1.json` and enforced by `quality:screen-docs`.
- Repo-local `wiki/` is the authored business and operator source; the GitHub wiki is its published
  copy.
- Supported, bounded, and unavailable product capabilities are stated in
  [Supported Features](wiki/Supported-Features.md). A rendered route does not imply production
  entitlement, client publication, order execution, or bank certification.

## Architecture And Module Map

```text
Browser
  -> Next.js route and feature composition
  -> same-origin /api/bff
  -> lotus-gateway product contract
  -> owning Lotus service
```

| Area | Responsibility |
| --- | --- |
| `src/app/` | App Router pages, layouts, providers, health endpoints, and BFF route handlers |
| `src/apps/portfolio/` | Portfolio review composition, records, exact transaction detail, and source projections |
| `src/apps/performance/` | Performance, attribution, risk, evidence, and adviser-brief composition |
| `src/apps/recommendations/` | Recommendations route composition |
| `src/features/advisor-book/` | Adviser-book selection and source-returned book posture |
| `src/features/report-ordering/` | Report Centre contracts, ordering, receipts, history, and screen state |
| `src/features/workbench/` | Manage and advisory workflow contracts, view models, and commands |
| `src/features/intake/` | Portfolio intake workflow and source-bound receipts |
| `src/features/domain-products/` | Governed data-product discovery and trust posture |
| `src/design-system/` | Reusable workstation primitives, financial formatters, tokens, and source-state controls |
| `src/shell/` | Navigation, review context, application registry, and shared framing |
| `src/copy/` | Typed productive copy shared by a workflow |
| `scripts/quality/` | Blocking architecture, authority, dependency, CSS, copy, and documentation gates |
| `scripts/testing/` | Deterministic browser-scenario orchestration |
| `scripts/live/` | Canonical front-office runtime, validation, and evidence capture |
| `tests/` | Unit, contract, fixture-browser, live-browser, and regression evidence |
| `docs/` | Deep architecture, procedures, standards, RFCs, and evidence |
| `wiki/` | Business, product, operator, support, and screen guidance |

Detailed ownership is in the
[product architecture blueprint](docs/documentation/product-architecture-blueprint.md). API and
cross-service boundaries are in [API Surface](wiki/API-Surface.md),
[Integrations](wiki/Integrations.md), and the
[Workbench/Gateway capability contract](docs/architecture/workbench-ui-gateway-capability-contract.md).

## Runtime And Integration Boundaries

### Gateway and authority

- Product/source reads and commands use the governed Workbench JSON transport through the
  same-origin `/api/bff/**` boundary. Browser experience telemetry separately posts bounded events
  to the same-origin `/api/metrics/events` ingest; telemetry is never business or source authority.
  See [Observability Evidence](wiki/Observability-Evidence.md) for that contract.
  Feature clients use the governed transport for BFF calls.
  `WorkbenchApiError` is the client authority for HTTP status. Do not parse status from text or
  render transport exceptions as adviser copy.
- Every BFF request enters Gateway through `buildGatewayBffRequestHeaders`. Browser authorization,
  cookies, forwarding aliases, roles, capabilities, service identity, and tenant scope are not
  trusted inputs.
- A BFF that narrows query scope must reject missing or repeated required values and forward the
  exact admitted representation. Gateway remains the final object-authorization authority.
- The BFF describes emitted bytes: it requests identity encoding, removes hop-by-hop and stale
  transfer metadata, and preserves governed end-to-end headers. Streaming needs an explicit
  timeout, cancellation, range, and backpressure design.
- `quality:bff-header-boundary` and `quality:feature-transport` are migration guards, not proof of
  production identity or completion of every historical transport migration.

### Source truth and client state

- Query keys include every dimension that can change source truth. Context confirmation invalidates
  the full affected family; delayed results must not cross portfolio, record, date, currency,
  projection, or other business-context boundaries.
- Portfolio and Performance/Risk use governed TanStack Query ownership. Do not restore module-level
  response Maps, inflight registries, token caches, or mirrored server state.
- A source response is displayable only after schema and identity admission. Missing, malformed,
  partial, stale, unsupported, blocked, and conflicting evidence remain distinct.
- A source mutation is not success by itself. User-visible confirmation requires the exact receipt
  and the owning refreshed read or replay evidence required by that workflow.
- Exact transaction detail uses Gateway's exact-record endpoint. It performs one automatic read per
  QueryClient hydration, including failed state, and disables retry on mount, focus, reconnect,
  and remount. The visible **Retry transaction** action is the only recovery read. Successful 2xx
  bodies require JSON, schema, and exact portfolio/transaction identity agreement; cancellation is
  not converted into a source failure.

### Product-specific authority

- Position and settlement posture use their shared portfolio view models. Grid, summary, evidence,
  drawer, and export must not duplicate or reinterpret the projection.
- Risk Review renders exact Gateway/Risk measures and Gateway-composed Manage mandate comparison.
  Workbench never calculates thresholds, headroom, breaches, all-clear states, or fallback policy.
- Idea explanations are source-bound to the displayed candidate evidence identity. Explanation
  loading or failure never changes review, feedback, conversion, or other candidate actions.
- Report ordering accepts only receipts bound to the exact submitted request and preserves the
  difference between an accepted order and a failed history refresh.
- Selected portfolio identity is presented once through `ReviewContextStrip`; URL values are
  requests until source-confirmed.
- Decision queues use `WorkbenchWorklist` and source-admitted selection where the primary task is to
  choose a record and act. Do not repeat the worklist, metrics, navigation, or active decision in a
  secondary rail.

### Presentation ownership

- Global CSS owns foundation, tokens, reset, shell, and genuinely shared primitives. Feature
  presentation belongs beside its component. Do not add `:global` escapes or duplicate selectors
  to bypass ownership.
- Use `src/design-system/utils/financial-formatters.ts` for monetary, percentage, ratio, and date
  presentation. Preserve units, bases, effective dates, and unavailable states.
- `docs/documentation/product-vocabulary.md` owns productive cross-domain language. Runtime terms
  remain in their domain modules; contract identifiers belong at adapters and support detail.
- Use UK English and sentence case. Reserve **portfolio value** for one selected portfolio and
  **AUM** for a source-backed adviser-book, relationship, or firm aggregate.
- AI-assisted content uses the shared disclosure and preserves provenance, evaluation, fallback,
  evidence gaps, and non-authoritative posture exactly as supplied.

### Runtime and support

- The governed local path is the Workbench canonical front-office runtime, not the Platform
  infrastructure-only stack. Use portfolio `PB_SG_GLOBAL_BAL_001` for canonical populated proof.
- `/api/health/live` and `/api/health/ready` support orchestration and diagnosis.
- Correlation id, request id, HTTP status, and support reference are distinct. Expose a support
  reference only when its semantics and operator queryability are proven.
- Local fixture, canonical local, protected-environment, and production evidence are different
  assurance levels. State the level explicitly.

## Repo-Native Commands

Run commands from the `lotus-workbench` repository root. Supported versions are Node 22 and npm 10.
Commands through container parity are directly runnable in PowerShell, Bash, and CI shells. The
`Makefile` exposes equivalent shortcuts where Make is installed; it is not a Windows development
prerequisite. Canonical front-office orchestration is currently supported only from Windows
PowerShell: its nested commands and workspace discovery are not yet portable to Unix. Track that
bounded implementation gap in #1020; do not present a top-level `pwsh` invocation as working proof.
For the canonical commands below, first set
`$workspaceRoot = (Resolve-Path (Join-Path $PWD '..')).Path` from the repository root. This resolves
the documented sibling-checkout layout without relying on the scripts' personal default.

| Purpose | Command |
| --- | --- |
| Install | `npm ci --no-audit --no-fund` |
| Develop | `npm run dev` |
| Lint and architecture gates | `npm run lint` |
| Type safety | `npm run typecheck` |
| Unit tests | `npm test` |
| Coverage gate | `npm run test:coverage` |
| Production build | `npm run build` |
| Local core quality gate | Run `npm run security:audit`, `npm run lint`, `npm run typecheck`, `npm run test:coverage`, and `npm run build` in order (`make check` shortcut) |
| Install the governed browser | `node node_modules/playwright/cli.js install chromium` (once after `npm ci`, and again when the Playwright version changes) |
| Browser smoke | `npm run test:e2e` |
| Deterministic fixture families | `npm run test:e2e:fixtures` |
| Container parity | `docker compose -f docker-compose.ci-local.yml up --build --abort-on-container-exit --exit-code-from ci-local ci-local` |
| Container parity teardown | `docker compose -f docker-compose.ci-local.yml down -v --remove-orphans` |
| Scale regression | `npm run scale:proof` then `npm run scale:proof:down` |
| Canonical stack (Windows PowerShell) | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/live/Start-LotusFrontOfficeCanonical.ps1 -ProjectsRoot $workspaceRoot` |
| Canonical validation (Windows PowerShell) | `npm run live:validate` |
| Canonical teardown (Windows PowerShell) | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/live/Stop-LotusFrontOfficeCanonical.ps1 -ProjectsRoot $workspaceRoot` |

Use the narrowest focused test during development, then run repository-native gates proportionate
to the change. The local core quality gate is not full PR parity; protected CI also proves runtime
ownership, isolated Next.js artifacts, browser and fixture scenarios, image security, scale, and
container parity. [Development Workflow](wiki/Development-Workflow.md),
[Validation and CI](wiki/Validation-and-CI.md), and the
[canonical runtime guide](docs/operations/canonical-front-office-local-runtime.md) own details.

## Validation And CI Expectations

A Workbench change is not complete because it renders or because CI is green. Evidence must prove
the business behavior, source boundary, degraded state, and applicable interaction path.

1. Run focused behavioral tests for changed contracts and failure modes.
2. Run `npm run lint`, `npm run typecheck`, relevant tests, and `npm run build`.
3. Use Playwright for user-visible workflows, keyboard behavior, responsive composition, and
   navigation history where applicable.
4. Use canonical source-backed validation only after API and calculation checks pass.
5. Keep the PR at one root cause, use small signed commits, and address blocking review on the
   latest implementation head.
6. Merge through repository policy, validate exact `main`, publish changed wiki source, verify
   parity, and reconcile branches/worktrees without code loss.

Blocking gates cover BFF and feature transport, source-to-render authority, runtime-state and
dependency inventories, CSS and Risk architecture, product copy, screen documentation, E2E
scenarios, ESLint, React Compiler rules, TypeScript, meaningful coverage, build, security,
container parity, browser smoke, and fixture scenarios.

Preserve these current documentation contracts when editing their owners:

- Manage mandate health is presented **as one selected review-item workflow**. Summary meters render
  only when Manage publishes a usable score; Workbench **does not calculate mandate health** or
  **infer readiness or priority from exception count**.
- Review context is owned in `src/shell/review-context.ts`, which **invalidates the complete context before source reads**.
  Use browser-history `push` for confirmed user decisions, without query-key remounts or focus loss.
- Runtime terms remain in their owning domain modules; productive vocabulary is in
  `docs/documentation/product-vocabulary.md`.
- `npm run scale:proof` remains the discoverable two-replica regression command.

## Standards And RFCs That Govern This Repository

Consult deeper sources only when the task crosses their subject:

| Task | Authority and reason |
| --- | --- |
| Any implementation | `AGENTS.md` and the Lotus Skill Routing Map select mandatory controls and delivery skill |
| UI or workflow | [Frontend delivery governance](https://github.com/sgajbi/lotus-platform/tree/main/codex/skills/lotus-frontend-delivery-governance) defines product, accessibility, source-truth, and evidence expectations |
| BFF or integration | [Capability contract](docs/architecture/workbench-ui-gateway-capability-contract.md), [API Surface](wiki/API-Surface.md), and [Integrations](wiki/Integrations.md) define ownership |
| Business language | [Product vocabulary](docs/documentation/product-vocabulary.md) owns terminology |
| Screen behavior | [Screen Guide Catalogue](wiki/Screen-Guide-Catalogue.md) routes to the canonical guide |
| Runtime or QA | [Canonical runtime guide](docs/operations/canonical-front-office-local-runtime.md) defines the governed path |
| CI or fitness function | [Validation and CI](wiki/Validation-and-CI.md) and Platform CI governance define enforcement |
| Architecture or dependency | [Architecture index](docs/architecture/README.md) and dependency-risk inventory define admission |
| Repository decision | [RFC Index](docs/rfcs/README.md) locates current and historical decisions |
| Documentation | [Documentation map](docs/README.md) and Platform documentation layering define authority |

The broad Lotus Engineering Context is deeper reading for cross-repository architecture or shared
policy; it is not the default first read for a bounded Workbench change.

## Known Constraints And Implementation Notes

- Production principal/session resolution is not implemented; browser headers, local caller
  fixtures, and canonical local QA are not production attribution.
- Some top-level advisory/proposal capabilities remain bounded or disabled. Check Supported Features
  before claiming availability.
- `quality:feature-transport` has a closed baseline for historical raw-fetch owners pending #791;
  do not add another instance or describe the baseline as approval.
- Product-copy scanning is transitional. Apply its current gate, but do not expand it into runtime
  evaluation; #872 owns replacement after simpler authority covers the behavior.
- Global presentation cleanup under #492 is selected only for real workflow, hierarchy, or deletion benefit.
- The absolute path in `auto:refresh:pas` is a runtime configuration defect owned by #913, not a
  documented portability convention.
- Verify dynamic imports, route registries, exports, tests, saved recovery work, and supported
  consumers before declaring code dead. Remove proven dead code only within the bounded issue.
- Active work, blockers, PRs, SHAs, and execution chronology belong in GitHub, not this file.

## Context Maintenance Rule

Update this file when repository ownership, architecture, integration boundaries, canonical
commands, validation expectations, dominant patterns, or material rollout posture changes. Keep it
concise; route detail to its purpose-owned document and execution state to GitHub.

## Cross-Links

Local sibling paths use `<workspace-root>` for the directory containing Lotus repositories:

1. `<workspace-root>/lotus-platform/context/LOTUS-QUICKSTART-CONTEXT.md`
2. `<workspace-root>/lotus-platform/context/LOTUS-ENGINEERING-CONTEXT.md`
3. `<workspace-root>/lotus-platform/context/CONTEXT-REFERENCE-MAP.md`
4. `<workspace-root>/lotus-platform/context/LOTUS-SKILL-ROUTING-MAP.md`
5. `<workspace-root>/lotus-platform/context/Repository-Engineering-Context-Contract.md`

Without a sibling checkout, use:

1. [Lotus Quickstart](https://github.com/sgajbi/lotus-platform/blob/main/context/LOTUS-QUICKSTART-CONTEXT.md)
2. [Lotus Engineering Context](https://github.com/sgajbi/lotus-platform/blob/main/context/LOTUS-ENGINEERING-CONTEXT.md)
3. [Context Reference Map](https://github.com/sgajbi/lotus-platform/blob/main/context/CONTEXT-REFERENCE-MAP.md)
4. [Skill Routing Map](https://github.com/sgajbi/lotus-platform/blob/main/context/LOTUS-SKILL-ROUTING-MAP.md)
5. [Repository Context Contract](https://github.com/sgajbi/lotus-platform/blob/main/context/Repository-Engineering-Context-Contract.md)
