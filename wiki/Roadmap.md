# Workbench Roadmap

## Current Scope

Workbench is an active front-office product client with implementation-backed portfolio,
performance, risk, portfolio-management, reporting, data-product, and bounded advisory/proposal
surfaces. Portfolio and Performance are the most mature shell-promoted workspaces. Several direct
advisory and proposal routes are implemented for bounded validation while their top-level shell
capability remains disabled.

This page records future state only where an open GitHub issue owns it. Current capability truth is
maintained in [Supported Features](Supported-Features); the complete implemented route and mode
inventory is in the [Screen Guide Catalogue](Screen-Guide-Catalogue).

## Prioritised Delivery Themes

| Theme | Current limitation | Durable owner |
| --- | --- | --- |
| Production principal and session | Verified session/delegation source behavior exists for five specialized BFF families and fails closed elsewhere; live grant authority, IdP, managed keys, Gateway enforcement, and deployment certification remain | [#436](https://github.com/sgajbi/lotus-workbench/issues/436) and [lotus-platform #775](https://github.com/sgajbi/lotus-platform/issues/775) |
| Capability promotion | Implemented advisory/proposal routes do not yet imply unrestricted shell access or production entitlement | Capability-specific issues and [Supported Features](Supported-Features) |
| CSS ownership | Legacy global selectors and CSS Module escapes still require incremental, evidenced migration | [#492](https://github.com/sgajbi/lotus-workbench/issues/492) |
| Evidence retention | Repository-retained rendered packs need enforceable size, replacement, and retirement policy | [#830](https://github.com/sgajbi/lotus-workbench/issues/830) |
| Source-truth wording | Remaining technical, reassuring, or over-authoritative product copy must be replaced with business language that matches the contract | [#798](https://github.com/sgajbi/lotus-workbench/issues/798) |
| Product architecture convergence | Navigation, route ownership, design-system reuse, and source-service boundaries continue to converge without big-bang replacement | [#781](https://github.com/sgajbi/lotus-workbench/issues/781) and issue-backed screen slices |

## Intentional Boundaries

- Workbench will not duplicate portfolio records, analytics calculations, mandate policy, report
  generation, or AI authority owned by backend services.
- A capability-disabled or runtime-gated screen is not a roadmap mock-up, but neither is it a
  production promotion claim.
- Construction, evidence-pack, rebalance, outcome-review, and operating-quality surfaces already
  render bounded Gateway/Manage facts. Future work must deepen source contracts and evidence where
  issues require it rather than re-announcing those screens as unimplemented.
- External execution, client publication, production identity, resilience certification, and bank
  acceptance remain unsupported until their owning contracts, controls, and validation evidence
  are implemented.

## Roadmap Governance

New future-state statements require an owning GitHub issue with evidence, impact, acceptance
criteria, and a validation condition. When work merges, update [Supported Features](Supported-Features)
and the relevant screen guide before removing it from this page. Historical aspirations must not
remain after current implementation or product direction supersedes them.
