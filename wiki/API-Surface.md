# API Surface

## Current Scope

This page inventories Workbench-owned browser routes and local server routes. Route existence is
not sufficient evidence of supported product capability; shell posture, Gateway backing, tests,
and canonical validation remain authoritative.

| Surface Class             | Authority                                       | Evidence Decision                                                               |
| ------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| Active product navigation | Workbench shell plus Gateway capability posture | May be described as active only when capability and canonical route proof agree |
| Direct workflow route     | Workbench presentation over Gateway contracts   | Must not imply Workbench owns upstream domain decisions                         |
| Compatibility route       | Redirect or bounded legacy entry                | Must remain visibly separate from the primary topology                          |
| `/api/bff/*`              | Internal Workbench bridge                       | Is not a second public or domain-authoritative API                              |

## Product routes

- `/portfolio`
- `/allocation`
- `/book`
- `/portfolios`
- `/intake`
- `/performance`
- `/reports`
- `/data-products`
- `/proposals`
- `/proposals/simulate`
- `/proposals/{proposalId}`
- `/workbench`
- `/workbench/{portfolioId}`
- `/api/bff/*`

## Capability-gated shell navigation

- active product entries:
  `Portfolio`, `Performance`, `Risk`
- disabled entries in the current normalized shell bootstrap contract:
  `Proposal`, `Advisory`

Treat the active shell contract as the source of truth for supported front-office navigation. Do not
promote dormant labels into product ownership just because historical route files still exist.

## Compatibility routes

- `/recommendations`
  renders Advisory Overview by default; `mode=overview` is the explicit equivalent. The overview
  reads the selected portfolio's cursor-bounded Gateway proposal list and keeps the global Advisory
  app entry capability-disabled.
- `/recommendations?mode=cockpit`
  Gateway-backed RFC-0026 advisor cockpit for Advise-owned action items, supportability, meeting
  preparation, tactical house-view impact review, and bounded acknowledgements
- `/recommendations?mode=copilot`
  Gateway-backed RFC-0027 advisory copilot for Advise-owned proposal-version evidence projection,
  action execution, human review posture, unsupported-evidence posture, and blocked
  client-publication boundaries
- `/recommendations?mode=opportunities`
  Gateway-backed Lotus Idea advisor review queue for Idea-owned candidate ranking, source-signal
  evidence, review posture, durable-storage posture, supported-feature promotion posture, and
  source-owned review, feedback, and bounded conversion-intent recording
- `/recommendations?mode=proof`
  Gateway-backed RFC-0028 bank-demo proof surface for Advise-owned scenario and supported-claim
  posture

## Direct advisory proposal routes

- `/proposals`
  direct Gateway-backed advisory proposal queue
- `/proposals/simulate`
  Gateway-backed advisory proposal draft entry backed by `lotus-advise` proposal simulation
- `/proposals/{proposalId}`
  direct Gateway-backed proposal detail with RFC-0023 advisor narrative delivery posture

## Current contract notes

- The shared `/api/bff/*` bridge requests identity encoding and reconstructs each response from the
  bytes Workbench actually returns. Body-bearing responses publish their emitted byte length and
  do not retain stale compression metadata; `HEAD`, `204`, `205`, and `304` remain bodyless.
  End-to-end cache, security, download, range, and source headers are retained, while hop-by-hop
  transport fields are removed. This is transport integrity, not a second business API or source
  authority.
- Portfolio Allocation loads the selected portfolio book through Gateway and requests
  `/api/v1/portfolio/portfolios/{portfolio_id}/allocations` separately for direct or preferred
  look-through coverage. Browser requests use `/api/bff/api/v1/...`; Workbench retains confirmed
  direct evidence when optional expanded coverage cannot be confirmed and never calls Core
  directly.
- Advisory Overview reads Gateway `GET /api/v1/proposals` through the browser's
  `/api/bff/api/v1/proposals` boundary with `portfolio_id`, `limit`, and optional `cursor`. Counts,
  ordering, lifecycle handoffs, and recovery apply only to the returned source window; a retry
  repeats the same query identity and never calls Advise directly.
- Risk and Impact reads one selected proposal through Gateway
  `GET /api/v1/proposals/{proposal_id}/risk-impact` using the browser's `/api/bff/api/v1/...`
  boundary. The route has no portfolio query parameter; Workbench validates the source-returned
  portfolio against the selected portfolio before rendering. The `proposal-risk-impact.v1`
  projection composes source-owned proposal, current/proposed allocation, risk, workflow-gate,
  capability, and lineage evidence. Workbench never fans this detail read across the worklist and
  does not calculate risk, allocation delta, suitability, mandate compliance, approval, or
  execution posture.
- Risk Review is currently served through `/performance` route mode selection, not a separate
  top-level URL
- Performance Summary composes Gateway
  `/api/v1/workbench/{portfolio_id}/performance/summary`, `/details`, and
  `/horizon-comparison` contracts; browser requests use the internal
  `/api/bff/api/v1/workbench/{portfolio_id}/performance/*` proxy and never call Core or Performance
  services directly
- Performance Analysis consumes the same Gateway `/details` family plus
  `/api/v1/workbench/{portfolio_id}/performance/attribution-trend`; the browser uses
  `/api/bff/api/v1/...` and keeps history retrieval failure distinct from a source-confirmed empty
  response
- Performance Evidence consumes the `evidence_view` projected by the Gateway
  `/api/v1/workbench/{portfolio_id}/performance/{summary,details}` contracts. Source-published
  artifacts remain on returned Gateway evidence or document routes, and the browser uses only the
  `/api/bff/api/v1/...` boundary; Workbench does not call Performance or an archive service directly
- Performance Advisor Brief consumes Gateway
  `/api/v1/workbench/{portfolio_id}/performance/advisor-brief` and records only source-allowed
  internal review decisions through `/performance/advisor-brief/review-actions`; browser requests
  use `/api/bff/api/v1/...`, confirmation precedes the POST, and Workbench admits recorded human
  review only from the returned actor, timestamp, transition count, and review-history evidence
- Risk Review consumes Gateway
  `/api/v1/workbench/{portfolio_id}/risk/{summary,concentration,drawdown,rolling,attribution}`
  through the browser's `/api/bff/api/v1/...` boundary. Lotus Risk owns measures, module state,
  supportability, coverage, methodology, and source controls. Summary and concentration can include
  additive Gateway-owned `mandate_comparison` evidence composed from Manage-owned constraints,
  review policy and lineage plus exact Core/Risk measures. Workbench formats those facts and does
  not calculate limits, headroom, universal severity bands, breach, or all-clear posture. Review
  frequency is nullable source truth; Workbench renders absence as **Not reported**. Summary and
  concentration context alignment is checked on the raw source fields before display formatting.
- Data Product Catalogue is served through `/data-products` and independently consumes Gateway
  `/api/v1/domain-products/catalog`, `/dependency-graph`, and `/trust-certification` through the
  internal `/api/bff/api/v1/domain-products/*` bridge only. Catalogue failure blocks discovery;
  assurance or graph failure leaves confirmed catalogue evidence available and does not authorize
  a browser fallback or direct platform-artifact read.
- internal browser-to-gateway traffic flows through `/api/bff/*`. Static caller context is
  development-only. Five specialized route families have verified source behavior and forward only
  delegated credentials; generic and direct server-rendered paths remain closed in promoted or
  unconfigured environments.
- `/book` consumes `GET /api/v1/advisor-book/portfolios` through the Workbench BFF. The BFF
  replaces browser-supplied actor, tenant, region, booking-centre, role, and capability headers;
  strips browser `Authorization`, browser `Cookie`, proxy authorization, session id, and upstream
  auth identity aliases. Verified posture requires `advisor.book.read`; the configured runtime
  fails closed pending the production grant authority tracked by Workbench #436 and Platform #775.
- `/intake` submits portfolio bundle writes through `/api/bff/api/v1/intake/portfolio-bundle`
  and forwards a bounded `X-Idempotency-Key` so Gateway/Core own safe duplicate-submit replay
  semantics
- `/reports` reads Gateway report-ordering options and recent jobs, submits reviewed
  single-portfolio requests through `/api/v1/reports/portfolio-reviews`, and submits/refreshes an
  explicit portfolio bundle through `/api/v1/report-batches*` only when that exact capability is
  published. Bundle candidates come from the Gateway-backed Advisor Book; the browser does not
  author membership or materialized portfolio authority.
- canonical product proof should use `workbench.dev.lotus`, not ad hoc localhost URLs
- shell navigation support is narrower than the historical route set: `Proposal` and `Advisory`
  are currently disabled even though direct proposal routes now exist for bounded advisory
  workflow entry
- canonical evidence should be taken from `output/playwright/live-canonical/` after
  `npm run live:validate`
- RFC-0108 observability coverage is implemented for supported Portfolio, Intake, Performance, Risk,
  Reporting, Data Products, and legacy advisor Workbench gateway-backed reads/mutations. The
  coverage registry is code-backed and tested so active product surfaces cannot silently drift
  outside bounded route/panel/operation metrics.
- RFC-0098/RFC-0041 rebalance-wave command-center rendering is implemented on the Manage
  workspace at `/workbench/{portfolioId}?mode=waves` through Gateway
  `/api/v1/dpm/command-center/waves*`. Workbench loads
  the explicit portfolio-list wave queue, previews and creates canonical portfolio waves, opens
  wave detail and item posture, and sends source-check, simulation, approval, staging, handoff,
  proof-posture, supportability, report-input, governed AI PM memo, and governed operations
  handoff summary actions through Gateway. It also loads active Manage-owned
  `BulkReviewCampaignDefinition:v1` campaign definitions from
  `/api/v1/dpm/command-center/waves/campaign-definitions` and renders campaign name, version,
  status, as-of date, candidate count, eligible portfolio type, governance posture, and
  source-backed posture without rendering content hashes or recalculating membership. It also
  loads bounded `BulkReviewCampaignDiscovery:v1` posture from
  `/api/v1/dpm/command-center/waves/campaign-discovery` and renders Manage-owned eligible
  candidate count, expiry posture, governance posture, access purpose, and source-ref posture
  without discovering global campaign cohorts. It opens
  selected campaign lifecycle evidence from
  `/api/v1/dpm/command-center/waves/campaign-definitions/{campaign_id}/versions/{campaign_version}/lifecycle-events`
  as a Manage evidence feed without inferring lifecycle state locally. It exposes bounded
  Gateway-backed retire and supersede controls through
  `/api/v1/dpm/command-center/waves/campaign-definitions/{campaign_id}/versions/{campaign_version}/retire`
  and
  `/api/v1/dpm/command-center/waves/campaign-definitions/{campaign_id}/versions/{campaign_version}/supersede`,
  using the current caller identity, a human business rationale, the exact Manage retirement or
  supersession fields, and an existing active replacement version where applicable. It refreshes
  campaign definitions and exact lifecycle evidence only after an accepted command, and renders
  returned status, exact actor reference beside its readable business role, reason, replacement
  version, correlation id, content hash, reason codes,
  and operating boundaries without browser-owned lifecycle truth. It also opens append-only launch history from
  `/api/v1/dpm/command-center/waves/campaign-definitions/{campaign_id}/versions/{campaign_version}/launch-history`
  and displays Manage-recorded wave id, launched-at time, launched-by business role plus exact
  actor reference, requested as-of date,
  correlation id, idempotency key, count, total count, limit, offset, and operating boundaries
  without recomputing launch state, membership, readiness, idempotency, maker-checker, trade
  approval, order generation, routing, fills, settlement, or OMS execution. It first checks
  Manage-owned campaign preview readiness through
  `/api/v1/dpm/command-center/waves/campaign-definitions/{campaign_id}/versions/{campaign_version}/preview-readiness`
  and renders source-owned supportability, reason codes, blocked actions, source posture, and
  operating boundaries without recalculating readiness. It then checks campaign launch readiness through
  `/api/v1/dpm/command-center/waves/campaign-definitions/{campaign_id}/versions/{campaign_version}/launch-package`
  and exposes
  `/api/v1/dpm/command-center/waves/campaign-definitions/{campaign_id}/versions/{campaign_version}/launch`
  only when the launch package is `READY`, preserving durable wave response and idempotency evidence
  without recalculating membership or readiness. It also renders campaign workflow audit
  posture from
  `/api/v1/dpm/command-center/waves/campaign-operating-queue`,
  `/api/v1/dpm/command-center/waves/campaign-approval-inbox`,
  `/api/v1/dpm/command-center/waves/campaign-workflow-board`,
  `/api/v1/dpm/command-center/waves/campaign-assignment-plan`,
  `/api/v1/dpm/command-center/waves/campaign-workflow-automation`,
  `/api/v1/dpm/command-center/waves/campaign-definitions/{campaign_id}/versions/{campaign_version}/approval-decisions`,
  `/api/v1/dpm/command-center/waves/campaign-definitions/{campaign_id}/versions/{campaign_version}/assignment-actions`,
  `/api/v1/dpm/command-center/waves/campaign-definitions/{campaign_id}/versions/{campaign_version}/assignment-tasks`,
  `/api/v1/dpm/command-center/waves/campaign-definitions/{campaign_id}/versions/{campaign_version}/assignment-tasks/{task_ref}/transitions`,
  and
  `/api/v1/dpm/command-center/waves/campaign-definitions/{campaign_id}/versions/{campaign_version}/maker-checker-controls`,
  preserving source refs, count/page metadata, reason codes, content hashes, task-transition
  posture, and operating boundaries. Selected-campaign workflow controls can record bounded
  Gateway-backed approval-decision, assignment-action, assignment-task, assignment-task
  transition, and maker-checker-control evidence, then refresh the source-owned evidence lists
  and show Gateway-returned correlation/source/upstream/content-hash evidence without browser-owned
  workflow state. All browser-triggered selected-campaign reads, refreshes, and mutations use
  `/api/bff/api/v1/...`; server-side workspace composition can use the canonical Gateway origin.
  Campaign id/version fencing prevents a late result or error from being relabelled under another
  selected campaign. It
  renders manage-owned wave lifecycle, item state, source-readiness state, supportability,
  report-input refs, proof-pack refs, handoff refs, lotus-ai workflow-pack run posture, and
  `external_execution_claimed` posture without direct `lotus-manage` or `lotus-ai` calls, local
  readiness calculation, local report-input construction, prompt construction, memo narrative
  generation, operations handoff-summary generation, campaign membership calculation,
  maker-checker workflow, trade approval, staging, or OMS execution claims.
  Item-selection drawers, dedicated `/dpm/waves` routes, PM-book discovery, global
  campaign discovery, campaign-definition upsert UX, CIO
  workflow, and external OMS execution remain future scope until separately implemented and proven.
- RFC-0098/RFC-0038 mandate command-center cockpit rendering is implemented on the Manage
  workspace overview and `/workbench/{portfolioId}?mode=mandate` through Gateway
  `/api/v1/dpm/command-center`,
  `/api/v1/dpm/command-center/monitoring/run-once`,
  `/api/v1/dpm/command-center/exceptions`, and
  `/api/v1/dpm/command-center/mandates*`. Workbench renders Manage-owned mandate health, source
  readiness, monitoring posture, active exceptions, exception-specific owners and next steps,
  health dimensions, and progressively disclosed lineage in a selected-item workflow. It renders
  scores only when the source publishes usable values and leaves missing attributes unavailable.
  Exception reads remain cursor-bounded. A non-null `next_cursor` means the returned rows are a
  reviewable source view, not a complete queue; browser continuation requests use
  `/api/bff/api/v1/dpm/command-center/exceptions` with the exact portfolio, mandate, active state,
  limit, and source cursor. A zero-attention statement requires an exhaustive response.
  It does not calculate mandate health, infer PM-book membership or exception priority, reconstruct
  source readiness, merge exceptions, bind aggregate actions to an individual exception, resolve
  exceptions locally, or call `lotus-manage` or `lotus-ai` directly. Demo promotion still requires
  the canonical `PB_SG_GLOBAL_BAL_001` live evidence pack and screenshot review.
- RFC-0098/RFC-0039 construction alternatives rendering is implemented on
  `/workbench/{portfolioId}?mode=construction` through Gateway
  `/api/v1/dpm/command-center/construction/alternative-sets*`. Workbench sends a stateful
  manage/core source selector through Gateway, renders manage-owned alternative ids, methods,
  method statuses, comparison metrics, objective/constraint trace counts, supportability, and
  selected-alternative state, and records PM selection through Gateway. It does not synthesize
  source snapshots, prices, optimizer results, supportability, or selection truth locally.
- RFC-0098/RFC-0040 proof-pack evidence rendering is implemented on `/workbench/{portfolioId}?mode=proof`
  through Gateway `/api/v1/dpm/command-center/proof-packs*`. Workbench renders manage-owned
  proof-pack id, status, content hash, section states, source hashes, Markdown availability,
  report-input readiness, AI-evidence readiness, and Gateway/lotus-ai PM memo workflow-pack
  posture. Browser code may trigger Gateway proof-pack generation from the manage rebalance run
  surfaced by the Gateway Workbench rebalance snapshot, load Gateway-provided Markdown/report/AI
  evidence payload posture, and request the governed PM memo through Gateway; it does not treat RFC-0042
  outcome-review `dpp_*` proof ids or expected-snapshot run ids as RFC-0040 proof-pack ids or
  generation sources. The PM Copilot workspace may display those historical references as lineage,
  but enables a proof-pack memo only when the current Gateway proof-pack response declares its AI
  evidence input available. Reviewable Manage business states such as `PENDING_REVIEW` remain valid
  populated product evidence when proof-pack identity, sections, hashes/lineage, and handoff posture
  are present. It does not rebuild proof-pack sections, compute hashes, synthesize Markdown,
  construct report input, construct AI evidence, construct PM memo prompts, materialize PDF
  reports, or call `lotus-manage`, `lotus-report`, or `lotus-ai` directly.
- RFC40-WTBD-010 portfolio-memory timeline rendering is implemented on
  `/workbench/{portfolioId}?mode=memory` through Gateway
  `/api/v1/dpm/command-center/portfolios/{portfolio_id}/memory` and bounded source-family posture
  through Gateway `/api/v1/dpm/command-center/portfolio-memory/search`. Workbench renders
  manage-owned event order, event type counts, event time, source systems, source refs, artifact
  refs, reason codes, supportability state, source-system/source-type facets, support boundary,
  and content hash. It does not reconstruct timeline nodes from proof-pack, wave, outcome-review,
  report, archive, or AI payloads; direct `lotus-manage` calls, global portfolio-universe
  discovery, source-owner store querying, cross-app source-event search, OMS/fill/settlement
  claims, and client communication workflow remain forbidden. Event drawers, lifecycle export,
  and retention or audit-policy controls remain future scope until separately implemented and
  proven.
- RFC-0043 PM copilot workspace rendering is implemented on
  `/workbench/{portfolioId}?mode=copilot` through existing Gateway BFF routes for proof-pack PM
  memo, wave PM memo, operations handoff summary, monitoring-exception summary, outcome-review
  narrative, and PM operating-quality support summary. Workbench centralizes these review-gated
  workflow-pack requests over Manage-owned evidence and lotus-ai execution posture, but it does
  not construct prompts, persist generated summary text or model responses, rank PMs, infer
  missing source facts, contact clients, approve trades, generate orders, route orders, or claim
  OMS execution.
- RFC-0098/RFC-0041 action-register supportability is rendered on the Manage workspace from
  the Gateway portfolio overview `rebalance_snapshot`. The rebalance status panel shows
  manage-owned status, source support state, freshness, run count, operation count, workflow
  decision count, last-run identity, bounded recent runs, workflow posture, run issue count, and
  reason posture. When Gateway does not provide supportability or recent run detail, Workbench
  renders unknown/N/A or an explicit empty run state instead of implying verified zero activity or
  calculating supportability locally.
- RFC-0098/RFC-0042 post-trade outcome-review rendering is implemented on
  `/workbench/{portfolioId}?mode=reviews` through Gateway `/api/v1/dpm/command-center/outcome-reviews*`.
  Workbench renders Manage-owned review state, expected-versus-realised dimensions, hashes,
  source lineage, source-owner/source-type facets, applied source-lineage filters, support
  boundary, supportability, report-input posture, AI-evidence posture, and
  `client_communication_boundary` posture without calculating those values client-side, querying
  source-owner stores, or creating client communication capability. The panel can request a
  governed outcome-review PDF job by
  loading manage report input through Gateway and then submitting Gateway
  `POST /api/v1/reports/outcome-reviews`; report rendering and archive lifecycle remain owned by
  `lotus-report`, `lotus-render`, and `lotus-archive`. The panel can also request a governed
  AI-assisted outcome-review summary through Gateway
  `POST /api/v1/dpm/command-center/outcome-reviews/{outcome_review_id}/ai-narrative`; evidence
  remains manage-owned, narrative execution remains `lotus-ai` owned, and Workbench shows only
  bounded workflow-pack run posture. Demo promotion still requires the canonical
  `PB_SG_GLOBAL_BAL_001` live evidence pack and screenshot review in the implementation ledger.
- RFC-0023 advisor proposal narrative posture is implemented on `/proposals/{proposalId}` through
  Gateway proposal endpoints. Workbench records advisor-use narrative review with
  `POST /api/v1/proposals/{proposal_id}/versions/{version_no}/narrative/review`, requests reviewed
  narrative report packaging with `POST /api/v1/proposals/{proposal_id}/report-requests`, and
  confirms persisted review identity, actor, time, state, and narrative hash from
  `GET /api/v1/proposals/{proposal_id}/versions/{version_no}/narrative`. Delivery posture remains a
  separate read from `GET /api/v1/proposals/{proposal_id}/delivery-summary` and
  `GET /api/v1/proposals/{proposal_id}/delivery-events`; those delivery contracts are not treated
  as narrative-review authority. The panel displays explicit not-reviewed,
  not-requested, no-report, and no-event states when Gateway has not materialized evidence. It does
  not generate narrative, infer client-ready release, render documents, archive artifacts, contact
  clients, or call `lotus-advise`, `lotus-report`, `lotus-render`, or `lotus-archive` directly.
- Delivery history is admitted only when its count equals the complete returned list, event
  identities are unique, timestamps are chronological, every record matches the active proposal
  version, and `latest_event` matches the final record. Post-action discussion-pack confirmation
  also requires the latest `REPORT_REQUESTED` record to carry the exact action
  `reason.report_request_id`; a 2xx response or unrelated delivery activity is not success proof.
  Canonical validation creates a Gateway-backed proposal with an advisor-review
  `narrative_request`, records advisor-use review, requests reviewed report packaging, and captures
  `proposal-narrative-posture-live.png` under the governed Workbench proof bundle.
- Approval Queue reads one cursor-bounded `GET /api/v1/proposals` window through the Workbench BFF.
  For the selected proposal only, it composes
  `GET /api/v1/proposals/{proposal_id}?include_evidence=true`,
  `/workflow-events`, `/approvals`, and `/lineage` as one maker-checker evidence set. The browser
  does not fan these record reads across the visible worklist or infer approval from list state.
- Suitability review does not read the generic proposal list. It reads the portfolio-scoped
  advisory-policy review queue through `/api/bff/api/v1/advisory-policy-evaluations/review-queue`,
  then reads evaluation, sign-off-package, and workflow evidence for the selected evaluation only.
  Manual refresh repeats that exact four-read set and confirms success only after the selected
  portfolio, evaluation, proposal, version, package, and workflow identities agree. A bounded
  evidence request posts through the same Gateway family with the source evaluation hash and an
  idempotency key; it is not policy approval or client-publication authority.
- Proposal Detail presents one decision-first review workspace over the existing Gateway contracts:
  identity and lifecycle lead to the next action, proposed changes, allocation impact, and review
  gates; Narrative and Memo are peer advisor-review modes; and version, lineage, replay, and review
  history remain available through progressive disclosure. Primary detail settles independently
  from workflow, approval, and lineage reads so available source evidence remains usable with an
  explicit partial-state message. Stable proposal-scoped Query identities own those reads; lifecycle
  and version commands invalidate and refetch the exact detail, workflow, approval, and lineage
  records instead of creating revision-suffixed cache entries. A lifecycle mutation is announced as
  successful only when its Gateway response identifies the selected proposal and resulting posture,
  then those owning reads refresh to the same source truth. Version creation additionally requires a
  returned and refreshed version newer than the pre-command version. Read-only historical lookup does
  not join the persisted-command lock. This
  presentation does not add client-release, approval, communication, or execution authority.
- Implementation Status reads one selected record from
  `GET /api/v1/proposals/{proposal_id}/execution-status` with discriminator
  `proposal-implementation-status.v1`, always through browser path `/api/bff/api/v1/...`. The
  response describes advisory handoff and reconciliation only. It is not a mutation contract and
  provides no order, fill, allocation, settlement, custody-booking, or accounting authority.
- Discussion Pack Review reads one selected record from
  `GET /api/v1/proposals/{proposal_id}/discussion-pack-review?portfolio_id={portfolio_id}&version_no={version_no}`
  with discriminator `proposal-discussion-pack-review.v1`, always through browser path
  `/api/bff/api/v1/...`. Gateway composes Advise narrative, memo, disclosure, approval/consent,
  and Report package evidence. Workbench keeps internal advisor review separate from client
  release, publication, delivery, communication, and lifecycle mutation.
- RFC-0024 advisor memo and evidence-pack posture is implemented on `/proposals/{proposalId}`
  through Gateway proposal memo endpoints. Workbench can create or replay an advisor-use memo with
  `POST /api/v1/proposals/{proposal_id}/versions/{version_no}/memo`, record advisor-use review with
  `POST /api/v1/proposals/{proposal_id}/versions/{version_no}/memo/review`, project memo posture
  with `GET /api/v1/proposals/{proposal_id}/versions/{version_no}/memo/projection`, request
  advisor-use report-package posture with
  `POST /api/v1/proposals/{proposal_id}/versions/{version_no}/memo/report-package`, request
  non-authoritative commentary with
  `POST /api/v1/proposals/{proposal_id}/versions/{version_no}/memo/ai-commentary`, and display
  lineage/replay posture from `GET /api/v1/proposals/{proposal_id}/memos/lineage` and
  `GET /api/v1/proposals/{proposal_id}/versions/{version_no}/memo/replay-evidence`. Workbench
  does not infer memo facts, promote client-ready release, render documents, synthesize archive
  references, treat commentary as authoritative evidence, contact clients, or call source services
  directly. Canonical validation captures `proposal-memo-evidence-pack-live.png` under the governed
  Workbench proof bundle.
- RFC-0026 advisor cockpit operating workflow is implemented on
  `/recommendations?mode=cockpit` through Gateway advisor cockpit endpoints. Workbench reads
  action items from `GET /api/v1/advisor-cockpit/actions`, the operating snapshot from
  `GET /api/v1/advisor-cockpit/snapshot`, preparation packets from
  `GET /api/v1/advisor-cockpit/preparation-packets`, supportability from
  `GET /api/v1/advisor-cockpit/supportability`, and records bounded advisor acknowledgement
  through `POST /api/v1/advisor-cockpit/actions/{action_item_id}/acknowledgements` with the
  source action-item version and idempotency key. The browser sends no advisor or role query and
  no acknowledging actor in the body. The Workbench BFF replaces browser authority, verifies the
  selected portfolio against server-side entitlement, derives advisor identity from its actor,
  and projects only `advisory.advisor_cockpit.read` or
  `advisory.advisor_cockpit.acknowledge` for the exact allowlisted route. Other Cockpit routes and
  authority escalation fail before Gateway. This configured principal is development-only; UAT
  and production remain closed until the authenticated-session contract is implemented.
  Canonical automation seeds source-backed
  tactical house-view evidence through
  `POST /api/v1/advisor-cockpit/house-view-cohorts/evaluate` before requiring the
  `HOUSE_VIEW_IMPACT_REVIEW` action family. Workbench does not reconstruct policy
  semantics, clear source blockers, approve or waive findings, infer client-ready publication,
  infer tactical house-view membership, contact clients, generate orders, route orders, or call
  `lotus-advise` directly. Canonical validation records `ADVISOR_COCKPIT_ACTION_ACKNOWLEDGED`,
  proves the dedicated preparation-packet route, treats already acknowledged source actions as
  replay evidence on repeated runs, and captures `advisory-advisor-cockpit-live.png`.
- Lotus Idea opportunity triage is implemented on `/recommendations?mode=opportunities` through
  Gateway Idea endpoints. Workbench reads `GET /api/v1/ideas/review-queues/advisor`; its BFF discards
  browser-supplied Idea authority headers and applies its configured subject, role, route capability,
  and portfolio entitlement only in the explicit development fixture mode (`dev`, `development`,
  `local`, or `test`). An unset or other environment requires a verified, currently granted session
  principal and fails closed before Gateway when admission cannot be established. Only allowlisted queue, candidate-detail,
  review-action, feedback, and conversion-intent routes can traverse the BFF; other Idea paths are
  rejected before Gateway. It is limited to canonical `PB_SG_GLOBAL_BAL_001` until
  authenticated portfolio entitlement is available. It renders Idea-owned rank, score, priority,
  review posture, source-signal ids, reason codes, durable-storage posture, policy version, and
  `supportedFeaturePromoted=false`, and links to `GET /api/v1/ideas/candidates/{candidate_id}` for
  source-safe detail. The detail panel records typed review actions, feedback, and bounded conversion
  intents through `POST /api/v1/ideas/candidates/{candidate_id}/review-actions`, `/feedback`, and
  `/conversion-intents`, respectively, with server-derived Workbench BFF authority and idempotency.
  A transient failure can retry only with the exact original action payload and idempotency key.
  These are
  source-owned audit records: they do not create a proposal, grant downstream authority, or promote
  Lotus Idea as a supported feature before canonical browser proof, data-product certification, and
  `lotus-idea` supported-feature evidence exist.
- RFC-0027 advisory copilot is implemented on `/recommendations?mode=copilot` through Gateway
  advisory copilot endpoints. Workbench requests proposal-version source projection through
  `POST /api/v1/advisory-copilot/evidence-packets/from-proposal-version`, runs bounded advisor-use
  actions through `POST /api/v1/advisory-copilot/actions`, records internal review through
  `POST /api/v1/advisory-copilot/actions/{run_id}/reviews`, and reads supportability from
  `GET /api/v1/advisory-copilot/supportability`. Workbench does not construct evidence sections,
  prompts, guardrails, AI/model lineage, review state, policy semantics, client-ready publication,
  external client communication, orders, fills, settlement, or OMS posture locally. Canonical
  validation records `ADVISORY_COPILOT_CANONICAL_PROOF_CREATED`, proves all six first-wave action
  families, internal review posture, client-ready guardrail rejection, proposal-version run
  lineage, and captures `advisory-advisory-copilot-live.png`.
- RFC-0028 bank-demo proof is implemented on `/recommendations?mode=proof` through Gateway
  bank-demo proof endpoints. Workbench reads the scenario contract from
  `GET /api/v1/advisory/bank-demo-proof/scenario-contract` and the supported-claim register from
  `GET /api/v1/advisory/bank-demo-proof/supported-claim-register`. It renders source-owned claim
  posture and publication boundaries only; it does not construct proof packs, classify claims
  locally, promote client-ready publication, approve sign-off, contact clients, generate orders,
  route orders, or claim OMS/fill/settlement truth. Canonical validation verifies the Gateway
  contracts and captures `advisory-bank-demo-proof-live.png`.

## Route examples

Portfolio:

```txt
http://workbench.dev.lotus/portfolio
```

Performance:

```txt
http://workbench.dev.lotus/performance?portfolioId=PB_SG_GLOBAL_BAL_001
```

The Performance return-path panel consumes Gateway-published MWR supportability fields and exposes
reason-code drill-downs for non-ordinary MWR posture, including XIRR fallback, approximation, no-root
and multiple-root solver states. Workbench displays the emitted Gateway contract and does not
recalculate MWR or infer reason codes client-side.

Performance risk mode:

```txt
http://workbench.dev.lotus/performance?portfolioId=PB_SG_GLOBAL_BAL_001&mode=risk
```

Data products:

```txt
http://workbench.dev.lotus/data-products
```

Workbench Manage overview:

```txt
http://workbench.dev.lotus/workbench/PB_SG_GLOBAL_BAL_001
```

Workbench Manage focused sub-surfaces:

```txt
http://workbench.dev.lotus/workbench/PB_SG_GLOBAL_BAL_001?mode=mandate
http://workbench.dev.lotus/workbench/PB_SG_GLOBAL_BAL_001?mode=waves
http://workbench.dev.lotus/workbench/PB_SG_GLOBAL_BAL_001?mode=construction
http://workbench.dev.lotus/workbench/PB_SG_GLOBAL_BAL_001?mode=memory
http://workbench.dev.lotus/workbench/PB_SG_GLOBAL_BAL_001?mode=reviews
http://workbench.dev.lotus/workbench/PB_SG_GLOBAL_BAL_001?mode=proof
```

Capability-gated navigation truth:

```txt
Active: Portfolio, Performance, Risk
Disabled: Proposal, Advisory
```

Compatibility recommendation redirect:

```txt
http://workbench.dev.lotus/recommendations?portfolioId=PB_SG_GLOBAL_BAL_001
```

Advisor cockpit:

```txt
http://workbench.dev.lotus/recommendations?portfolioId=PB_SG_GLOBAL_BAL_001&mode=cockpit
```

Proposal route posture:

```txt
/proposals -> Gateway-backed proposal queue
/proposals/{proposalId} -> Gateway-backed proposal detail and advisor narrative delivery posture
/proposals/simulate?portfolioId=PB_SG_GLOBAL_BAL_001 -> Gateway-backed advisory proposal simulation
```

These examples keep the active-versus-legacy route posture explicit.
