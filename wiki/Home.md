# Lotus Workbench

Lotus Workbench is the decision-oriented front-office interface for the Lotus wealth-management
platform. It brings source-owned portfolio, performance, risk, advisory, portfolio-management,
reporting, and data-product facts into one coherent workstation for relationship managers, client
advisors, portfolio managers, investment specialists, operations teams, and support teams.

## Current Scope And Evidence Posture

This wiki documents implemented Workbench behavior on the current repository mainline. Workbench
consumes business truth through its BFF and `lotus-gateway`; the owning Lotus services remain
authoritative for records, calculations, policy, workflow state, reports, and generated evidence.

A documented route does not by itself establish production identity, entitlement, client delivery,
execution authority, operational certification, or bank acceptance. Capability-disabled and
runtime-gated surfaces are identified explicitly. Use [Supported Features](Supported-Features) for
the authoritative capability posture and [Validation and CI](Validation-and-CI) for what each
evidence class proves.

## Choose Your Path

| Reader | Start here | What you will find |
| --- | --- | --- |
| Advisor or relationship manager | [Advisor Book Workflow](Advisor-Book-Workflow) | Select portfolio context, review priorities, and move into the next supported business task |
| Portfolio manager | [Manage Overview](Manage-Overview-Screen-Guide) | Mandate attention, rebalance, construction, memory, review, operating-quality, and evidence workflows |
| Investment or risk specialist | [Performance Summary](Performance-Summary-Screen-Guide) | Return, benchmark, attribution, contribution, risk, and evidence review |
| Product owner or bank stakeholder | [Overview](Overview) | Current capability, architecture, business boundaries, and technology-risk evidence |
| Operations or support | [Operations Runbook](Operations-Runbook) | Readiness, diagnostics, recovery, escalation, and observable evidence |
| Engineer or reviewer | [Getting Started](Getting-Started) | Local setup, architecture, APIs, quality gates, RFCs, and implementation evidence |

## Business Workflows

- **Advisor book and portfolio records** — [Advisor Book](Advisor-Book-Workflow),
  [Portfolio Review](Portfolio-Review-Screen-Guide), [Allocation](Portfolio-Allocation-Screen-Guide),
  [Positions](Positions-Screen-Guide), [Transactions](Transactions-Screen-Guide),
  [Income and activity](Income-And-Activity-Screen-Guide),
  [Projected cash flow](Projected-Cash-Movement-Screen-Guide), and
  [Portfolio Intake](Portfolio-Intake-Screen-Guide).
- **Performance and risk** — [Performance Summary](Performance-Summary-Screen-Guide),
  [Performance Analysis](Performance-Analysis-Screen-Guide),
  [Risk Review](Risk-Review-Screen-Guide), [Performance Evidence](Performance-Evidence-Screen-Guide),
  and [Performance Advisor Brief](Performance-Advisor-Brief-Screen-Guide).
- **Portfolio management** — [Manage Overview](Manage-Overview-Screen-Guide),
  [Mandate Health](Mandate-Health-Screen-Guide), [Rebalance Waves](Rebalance-Waves-Screen-Guide),
  [Construction Alternatives](Construction-Alternatives-Screen-Guide),
  [Portfolio Memory](Portfolio-Memory-Screen-Guide), [PM Copilot](PM-Copilot-Screen-Guide),
  [PM Operating Quality](PM-Operating-Quality-Screen-Guide),
  [Outcome reviews](Outcome-Reviews-Screen-Guide), and [Evidence Pack](Evidence-Pack-Screen-Guide).
- **Advisory and proposals** — [Advisory Overview](Advisory-Overview-Screen-Guide),
  [Advisor Cockpit](Advisor-Cockpit-Screen-Guide), [Advisory Copilot](Advisory-Copilot-Screen-Guide),
  [Opportunities and Ideas](Opportunities-And-Ideas-Screen-Guide),
  [Proposal Builder](Proposal-Builder-Screen-Guide), [Approval Queue](Approval-Queue-Screen-Guide),
  [Suitability review](Suitability-Review-Screen-Guide),
  [Risk and Impact](Risk-And-Impact-Screen-Guide),
  [Discussion Pack Review](Discussion-Pack-Review-Screen-Guide),
  [Implementation Status](Implementation-Status-Screen-Guide),
  [Proposal Detail](Proposal-Detail-Screen-Guide), and [Bank Demo Proof](Bank-Demo-Proof-Screen-Guide).
- **Reporting and data governance** — [Report centre](Report-Centre-Screen-Guide) and
  [Data Product Catalogue](Data-Product-Catalogue-Screen-Guide).

The [Screen Guide Catalogue](Screen-Guide-Catalogue) is the complete route, mode, availability,
source-authority, and guide inventory.

## Product And Control Reference

- [Product Vocabulary](Product-Vocabulary) — canonical wealth-management language.
- [Architecture](Architecture) — Workbench composition and source-ownership model.
- [API Surface](API-Surface) and [Integrations](Integrations) — Gateway/BFF and service boundaries.
- [Security and Governance](Security-and-Governance) — implemented controls and non-certification.
- [Technology Risk and Runtime Support](Technology-Risk-and-Runtime-Support) — supported stack and
  dependency posture.
- [Roadmap](Roadmap) — current limitations and issue-backed future state.

## Runtime And Delivery

The governed integrated portfolio is `PB_SG_GLOBAL_BAL_001`. Canonical proof follows the
[front-office runtime guide](https://github.com/sgajbi/lotus-workbench/blob/main/docs/operations/canonical-front-office-local-runtime.md):

```powershell
npm run live:stack:up:validate
npm run live:stack:down
```

Canonical evidence is written under `output/playwright/live-canonical/`. Diagnostic screenshots,
fixture runs, and local tests remain narrower evidence and must not be presented as integrated or
production certification.

## Repository Documentation

- [Repository README](https://github.com/sgajbi/lotus-workbench/blob/main/README.md)
- [Documentation map](https://github.com/sgajbi/lotus-workbench/blob/main/docs/README.md)
- [Repository engineering context](https://github.com/sgajbi/lotus-workbench/blob/main/REPOSITORY-ENGINEERING-CONTEXT.md)
- [RFC Index](RFC-Index)
