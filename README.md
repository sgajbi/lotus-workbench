# Lotus Workbench

Lotus Workbench is the primary front-office product interface for the Lotus wealth-management
platform. It gives relationship managers, client advisers, portfolio managers, investment
specialists, operations teams, and support teams one decision-oriented view of source-owned
portfolio, performance, risk, advisory, portfolio-management, reporting, and data-product facts.

Workbench is a presentation and workflow client. It does not own portfolio books and records,
analytics calculations, mandate policy, advisory decisions, report production, or AI-generated
evidence. Those responsibilities remain with the relevant Lotus services and are consumed through
`lotus-gateway` and the Workbench backend-for-frontend (BFF).

## Current Product Scope

| Business area | Current Workbench role | Primary source authority |
| --- | --- | --- |
| Adviser book | Select an entitled portfolio and preserve the business review date | Gateway and Core |
| Portfolio review | Review value, allocation, holdings, activity, income, liquidity, and intake readiness | Gateway and Core |
| Performance and risk | Interpret returns, benchmark-relative results, contributors, risk, evidence, and adviser briefing | Gateway, Performance, Risk, Advise, and Lotus AI |
| Portfolio management | Review mandate attention, rebalance waves, construction alternatives, portfolio memory, operating quality, outcomes, and evidence packs | Gateway and Manage, with bounded Report and Lotus AI handoffs |
| Advisory and proposals | Review opportunities, suitability, risk impact, discussion material, approvals, and implementation posture | Gateway, Idea, Advise, Risk, Report, and Lotus AI |
| Report centre | Order approved portfolio reports and monitor source-owned report-data jobs | Gateway and Report |
| Data products | Discover ownership, approved use, dependencies, and live assurance | Gateway, lotus-platform, and domain services |

Some advisory and proposal surfaces are implemented for bounded validation while their top-level
shell capability remains disabled. Implemented routes do not imply production entitlement,
client-publication authority, order execution, or bank certification. See
[Supported Features](wiki/Supported-Features.md) for the authoritative capability posture and the
[Screen Guide Catalogue](wiki/Screen-Guide-Catalogue.md) for every active route and mode.

## Architecture And Boundaries

```text
Browser
  -> Next.js Workbench route
  -> /api/bff (closed browser-header boundary and server-owned caller context)
  -> lotus-gateway (product contract and policy projection)
  -> owning Lotus service (business facts, calculations, workflow state, evidence)
```

Key ownership areas:

- `src/app/` — Next.js route mounting and BFF endpoints.
- `src/apps/` — product-surface composition.
- `src/features/` — bounded feature contracts, view models, and workflows.
- `src/design-system/` — reusable workstation primitives and presentation tokens.
- `src/shell/` — navigation and application context.
- `tests/` — unit, integration, contract, and browser regression evidence.
- `docs/` — engineering decisions, standards, RFCs, operations, and evidence.
- `wiki/` — canonical authored business, product, support, and operator guidance.

Detailed architecture, component responsibilities, data flow, and source boundaries are maintained
in the [product architecture blueprint](docs/documentation/product-architecture-blueprint.md),
[Architecture wiki](wiki/Architecture.md), [API Surface](wiki/API-Surface.md), and
[Integrations](wiki/Integrations.md).

## Quick Start

Prerequisites and supported runtime versions are governed in
[Getting Started](wiki/Getting-Started.md) and
[Technology Risk and Runtime Support](wiki/Technology-Risk-and-Runtime-Support.md).

```bash
make install
make run
```

Local product endpoints:

- Workbench: `http://workbench.dev.lotus`
- Gateway: `http://gateway.dev.lotus`

Set `BFF_BASE_URL=http://gateway.dev.lotus` for the normal local Gateway boundary. The local caller
fixture is development-only and is not production identity evidence. Production principal/session
resolution remains tracked by
[Workbench #436](https://github.com/sgajbi/lotus-workbench/issues/436) and
[lotus-platform #563](https://github.com/sgajbi/lotus-platform/issues/563).

For a populated integrated run, use the governed front-office flow and canonical portfolio
`PB_SG_GLOBAL_BAL_001` from Windows PowerShell:

```powershell
$workspaceRoot = (Resolve-Path (Join-Path $PWD '..')).Path
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/live/Start-LotusFrontOfficeCanonical.ps1 -ProjectsRoot $workspaceRoot
npm run live:validate
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/live/Stop-LotusFrontOfficeCanonical.ps1 -ProjectsRoot $workspaceRoot
```

The canonical runner is not currently supported from Bash or Unix PowerShell because its workspace
discovery and nested commands remain Windows-specific. Workbench
[#1020](https://github.com/sgajbi/lotus-workbench/issues/1020) owns that portability gap.

The complete configuration inventory, preflight behavior, failure recovery, and evidence locations
are owned by the
[canonical front-office runtime guide](docs/operations/canonical-front-office-local-runtime.md).

## Quality Gates

```bash
make check
make test-e2e
make test-e2e-fixtures
make ci-local-docker
```

For the bounded, non-certifying two-replica engineering regression:

```bash
npm run scale:proof
npm run scale:proof:down
```

Workbench exposes `/api/health/live` and `/api/health/ready` for container orchestration and
operator diagnosis. The scale proof exercises distribution, latency, error, persistence, resource,
and replica-replacement controls; it is not production capacity or resilience certification.

`make check` covers dependency/security policy, lint and architecture controls, React correctness,
screen-documentation governance, type safety, coverage-backed tests, and a production build. The
fixture gate proves deterministic Workbench behavior; `npm run live:validate` is required for an
integrated source-backed product claim. Neither a local screenshot nor fixture proof alone certifies
production readiness.

Use [Validation and CI](wiki/Validation-and-CI.md) for the exact lane/evidence map and
[Development Workflow](wiki/Development-Workflow.md) for branch, documentation, and review rules.

## Operations And Support

- [Operations Runbook](wiki/Operations-Runbook.md) — readiness, startup, recovery, and escalation.
- [Observability Evidence](wiki/Observability-Evidence.md) — correlation, telemetry, and evidence.
- [Troubleshooting](wiki/Troubleshooting.md) — symptom-led diagnosis.
- [Security and Governance](wiki/Security-and-Governance.md) — implemented controls and explicit
  non-certification boundaries.

## Documentation

Start with the [documentation map](docs/README.md), which routes business, product, engineering,
operations, governance, and reviewer audiences to the authoritative material.

- [Wiki Home](wiki/Home.md) — audience-oriented product and operating entry point.
- [Screen Guide Catalogue](wiki/Screen-Guide-Catalogue.md) — purpose, workflow, source authority,
  states, boundaries, evidence, and support guidance for every active screen and mode.
- [Product Vocabulary](wiki/Product-Vocabulary.md) — canonical private-banking language.
- [RFC Index](docs/rfcs/README.md) — repository-owned decisions and delivery posture.
- [Repository Engineering Context](REPOSITORY-ENGINEERING-CONTEXT.md) — agent and engineering truth.

Repo-local `wiki/` is the authored source of truth. The GitHub wiki is a published copy and must be
synchronized through the governed Lotus wiki automation rather than edited independently.
