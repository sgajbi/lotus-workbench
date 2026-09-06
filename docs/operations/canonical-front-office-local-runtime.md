# Canonical Front-Office Local Runtime

This runbook defines the repeatable local operator flow for bringing up the front-office Lotus
stack, seeding governed portfolio data, and validating that the supported Workbench screens and
panels render live data through canonical hostnames.

## Scope

This flow covers the local experience for:

- `lotus-core`
- `lotus-performance`
- `lotus-risk`
- `lotus-ai`
- `lotus-advise`
- `lotus-manage`
- `lotus-report`
- `lotus-archive`
- `lotus-render`
- `lotus-idea`
- `lotus-gateway`
- `lotus-workbench`
- direct ingress via `*.dev.lotus`

Reference seeded portfolio:

- portfolio: `PB_SG_GLOBAL_BAL_001`
- benchmark: `BMK_PB_GLOBAL_BALANCED_60_40`

## Canonical local prerequisites

Required canonical host mappings on the host:

```txt
127.0.0.1 workbench.dev.lotus
127.0.0.1 gateway.dev.lotus
127.0.0.1 performance.dev.lotus
127.0.0.1 risk.dev.lotus
127.0.0.1 advise.dev.lotus
127.0.0.1 manage.dev.lotus
127.0.0.1 report.dev.lotus
127.0.0.1 archive.dev.lotus
127.0.0.1 render.dev.lotus
127.0.0.1 idea.dev.lotus
127.0.0.1 core-query.dev.lotus
127.0.0.1 core-control.dev.lotus
127.0.0.1 core-ingestion.dev.lotus
127.0.0.1 ai.dev.lotus
```

Important:

- The canonical host block should be managed from `lotus-platform`, not edited ad hoc.
- `ai.dev.lotus` must be present if you want full canonical hostname validation for direct AI
  probing.
- Workbench already enforces canonical BFF addressing. `BFF_BASE_URL` must not use `localhost`,
  `127.0.0.1`, or `0.0.0.0`.

Preview the managed hosts block:

```powershell
powershell -ExecutionPolicy Bypass -File ..\\..\\lotus-platform\\automation\\Sync-Dev-Ingress-Hosts.ps1
```

Apply the managed hosts block from an elevated shell:

```powershell
powershell -ExecutionPolicy Bypass -File ..\\..\\lotus-platform\\automation\\Sync-Dev-Ingress-Hosts.ps1 -Apply
```

If elevation is not available, the script stages a merged preview under `lotus-platform/output/hosts-preview/`
so the exact required block can still be reviewed and applied manually.

Direct Administrator fallback:

```powershell
powershell -ExecutionPolicy Bypass -Command "Add-Content -Path 'C:\Windows\System32\drivers\etc\hosts' -Value \"`n127.0.0.1 workbench.dev.lotus`n127.0.0.1 gateway.dev.lotus`n127.0.0.1 performance.dev.lotus`n127.0.0.1 risk.dev.lotus`n127.0.0.1 advise.dev.lotus`n127.0.0.1 manage.dev.lotus`n127.0.0.1 report.dev.lotus`n127.0.0.1 archive.dev.lotus`n127.0.0.1 render.dev.lotus`n127.0.0.1 idea.dev.lotus`n127.0.0.1 core-query.dev.lotus`n127.0.0.1 core-control.dev.lotus`n127.0.0.1 core-ingestion.dev.lotus`n127.0.0.1 ai.dev.lotus\""
```

Workbench local environment:

```txt
BFF_BASE_URL=http://gateway.dev.lotus
LOTUS_ENVIRONMENT=dev
WORKBENCH_IDEA_AUTH_MODE=development_configured
WORKBENCH_IDEA_CALLER_SUBJECT=workbench-advisor
WORKBENCH_IDEA_CALLER_ROLES=advisor
WORKBENCH_IDEA_CALLER_TENANT_IDS=tenant-private-bank-sg
WORKBENCH_IDEA_CALLER_BOOK_IDS=book-advisor-001
WORKBENCH_IDEA_CALLER_PORTFOLIO_IDS=PB_SG_GLOBAL_BAL_001
WORKBENCH_IDEA_CALLER_CLIENT_IDS=client-001
```

The Idea values are a complete local-development caller fixture for Lotus Idea BFF routes, not an
identity-provider integration. Workbench derives the subject, role, tenant, book, portfolio, and
client scope after discarding browser authority; Docker forwards the same configurable defaults.
They are rejected outside `dev`, `development`, `local`, or `test`;
an unset environment and all other environments require an authenticated principal and the BFF returns `401` before calling
Gateway until the session/claims resolver tracked in platform issue #563 and Workbench issue #436
is delivered.

For `-LocalApps workbench`, this value must win over any stale `.env.local` entry. If Workbench
BFF routes return `500` and the local dev log shows `ECONNREFUSED` against `127.0.0.1:8111` or
`localhost:8111`, restart the Workbench dev server with `BFF_BASE_URL=http://gateway.dev.lotus` or
correct `.env.local` before collecting evidence. Canonical proof must travel through the governed
`gateway.dev.lotus` ingress boundary.

## Canonical bring-up

From `lotus-workbench`:

```powershell
$workspaceRoot = (Resolve-Path (Join-Path $PWD '..')).Path
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/live/Start-LotusFrontOfficeCanonical.ps1 -ProjectsRoot $workspaceRoot
```

For RFC/mainline certification, add `-RequireMainlineSources`. It fetches each canonical sibling
without changing its worktree and fails before Docker, seeding, or screenshots unless every
participant is clean and exactly at `origin/main`. Certification startup forces Docker image builds
and container recreation, then regenerates source provenance after startup and fails if it changed.
The live validator also binds Lotus Idea's `/version` commit and branch to that manifest before it
records mainline-source certification posture. It writes source-safe preflight and runtime
provenance and Idea capacity-seed artifacts to a per-run Local AppData directory outside every
checked source worktree, so the second preflight cannot reject its own generated files. Normal and `-LocalApps` runs remain
development evidence and must never be presented as mainline certification.

When another agent owns the shared `lotus-workbench` checkout, platform automation may call the
same preflight with `--workbench-repo-path` pointing at a clean isolated Workbench mainline worktree.
The preflight must evaluate that supplied Workbench path while continuing to evaluate all other
canonical repositories from the governed projects root.

That script performs:

1. preflight every host port required by the selected canonical mode
2. preview the canonical hosts block from `lotus-platform`
3. `docker compose up -d` for `lotus-core` with `DEMO_DATA_PACK_ENABLED=false`
4. `docker compose up -d` for `lotus-performance`, `lotus-risk`, `lotus-ai`, `lotus-advise`, `lotus-manage`, `lotus-report`, and `lotus-idea`
5. seed the governed Lotus Idea advisor queue through `lotus-idea` using a deterministic canonical high-cash candidate for `PB_SG_GLOBAL_BAL_001`, then progress that exact candidate through Idea's public lifecycle API to source-confirmed review readiness
6. start `lotus-archive` and `lotus-render`
7. direct ingress restart on port `80` using `lotus-platform/platform-stack/dev-ingress/Caddyfile.direct-host`
8. canonical `lotus-gateway` exposure on port `8100`
9. governed `lotus-core` seed for `PB_SG_GLOBAL_BAL_001`
10. governed DPM command-center seed through `lotus-platform`
11. create an isolated Lotus Idea downstream-capacity resource and run one report-only downstream-submission probe
12. `docker compose up -d` for `lotus-workbench` on port `3000`

Docker is the default for every canonical front-office app. The startup flow replaces stale local
listeners on canonical app ports before Docker startup, while leaving Docker-owned listeners in
place. This avoids stale local dev servers blocking Docker without terminating Docker port proxies.
Before changing host previews, building images, or starting and stopping processes, the startup
flow verifies the complete mode-specific port plan. Existing containers from the expected canonical
Compose projects are reusable. A foreign Docker project or an unsafe host listener fails startup
with the port, container or process, Compose project, and working-directory provenance needed to
resolve the conflict. The preflight never stops a foreign owner.
Port-owner comparisons normalize host paths before comparing Docker Compose working-directory
labels, so an existing canonical container is not misclassified because one path uses redundant
separators. The reusable predicate uses [.NET `Path.GetFullPath`](https://learn.microsoft.com/en-us/dotnet/api/system.io.path.getfullpath)
and PowerShell's explicit case-insensitive comparison semantics. Invalid or missing project/path
evidence never matches an allowlist entry, and relative labels are rejected instead of being
resolved against the launcher's mutable current directory.

Audit the current port owners without changing hosts, builds, containers, processes, seeds, or
validation state:

```powershell
npm run live:stack:preflight
```

The executable path/ownership contract used by the feature, PR, and main quality lanes is:

```powershell
npm run test:runtime-ownership
```

It covers canonical, repeated-separator, case, trailing-separator, parent-segment, wrong-project,
missing, relative, malformed, and genuinely foreign path decisions. Core portfolio seeding is also
invoked with the repository root and `src/libs/portfolio-common` on `PYTHONPATH`; missing
shared-library imports are startup defects, not grounds to bypass canonical source readiness.
The governed `lotus-core` startup explicitly sets `DEMO_DATA_PACK_ENABLED=false`; the broad
app-local demo pack remains available for diagnostics, but it is not part of canonical
`PB_SG_GLOBAL_BAL_001` seeding or evidence collection.
The Lotus Idea advisor-queue seed reads the governed canonical as-of date from
`lotus-platform/context/contracts/canonical-front-office-demo-data-contract.json` instead of
duplicating date literals in Workbench automation. If the platform contract is missing the date
policy, canonical startup fails closed before seeding Idea evidence.
Each canonical startup run binds the synthetic source observation and persistence idempotency key
to that run's provenance identity. The resulting candidate is fresh for the browser journey, while
a retry inside the same run remains idempotent. This prevents a previously converted candidate from
being reused as though it were still in the advisor queue. The seed reads candidate detail with the
complete canonical entitlement scope before and after each Idea-owned lifecycle transition. It
advances only the required next state, treats an already source-confirmed state within the same run
as idempotent replay evidence, and fails on gaps, mismatched identity, or a state outside the
seedable path. Workbench does not calculate or bypass Idea lifecycle policy.
After the source queue returns that candidate exactly once, startup records
`output/canonical-front-office/idea-candidate-seed-evidence.json`. Validation rejects a missing,
mismatched, or non-reviewable artifact, proves Gateway exposes the same current-run candidate, and
rejects evidence whose run identity differs from the active Idea `/version` build identity before
targeting that exact queue row. Earlier unconverted canonical candidates or stale artifacts
therefore cannot make the browser select an arbitrary row or fabricate continuity with the current
run.

Canonical startup binds the server-owned BFF header and PM Operating Quality seed to the governed
Workbench caller tenant. Command-centre reads retain their separate platform-contract query tenant,
portfolio-manager book, and command-centre date. A missing value fails startup; the validator must
not create caller-scoped evidence in one tenant while the screen reads another.

### Lotus Idea capacity evidence

Canonical startup delegates capacity-resource construction and workload execution to
`lotus-idea`. Workbench only coordinates readiness and verifies the returned evidence. The flow:

1. rebuilds only the Idea Compose project with the checked-out commit, branch, and fresh canonical
   run identity; unrelated services continue to use the normal reusable-image posture,
2. waits for the exact Idea source revision and the Advise realization dependency,
3. verifies Idea `/version` commit, branch, and run metadata against the requested identity,
4. invokes the Idea-owned synthetic seed and service-capacity workload runners,
5. accepts exactly one successful `downstream_submission` probe in the `test` profile, and
6. records source artifact paths, SHA-256 digests, and provenance in
   `output/canonical-front-office/idea-capacity-seed-evidence.json`.

Capacity evidence uses the isolated `CAPACITY_SYNTHETIC_PORTFOLIO_001` namespace. It must not reuse
`PB_SG_GLOBAL_BAL_001`, expose the generated conversion-intent identifier or downstream path, or
persist credentials in evidence. This is deterministic seed and integration-readiness proof only;
it is not load or soak evidence, capacity certification, or supported-feature promotion.

The capacity seed is still exercised through Lotus Idea's public API policy. Canonical startup
creates one per-run local trusted-caller marker, passes it to the Idea runtime as
`LOTUS_IDEA_TRUSTED_CALLER_CONTEXT_TOKEN`, and forwards the same marker to the seed process as
`LOTUS_IDEA_CAPACITY_TRUSTED_CALLER_CONTEXT`. The Idea seed process must also send complete
synthetic tenant, book, portfolio, client, role, and capability scope headers for each governed
mutation. This is local/dev proof wiring only; it is not a production identity provider,
session/token-claims authority, or endpoint-policy bypass.

For active RFC or UI development, pass `-LocalApps` with a comma-separated app list. Local apps use
the same canonical hostnames and public ports as Docker-backed apps, so live evidence remains
comparable:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/live/Start-LotusFrontOfficeCanonical.ps1 -ProjectsRoot $workspaceRoot -LocalApps workbench
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/live/Start-LotusFrontOfficeCanonical.ps1 -ProjectsRoot $workspaceRoot -LocalApps workbench,gateway,manage
```

Workbench-focused development can also use:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/live/Start-LotusFrontOfficeCanonical.ps1 -ProjectsRoot $workspaceRoot -LocalApps workbench
```

The `npm run live:stack:up:workbench-local` convenience alias is retained for the current default
checkout location. It does not forward `-ProjectsRoot`; use the explicit command above for a
portable sibling-checkout layout.

Core/manage RFC proof can use a narrower governed bring-up path:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/live/Start-LotusFrontOfficeCanonical.ps1 -ProjectsRoot $workspaceRoot -CoreManageOnly
```

The matching `npm run live:stack:up:core-manage` convenience alias has the same default-location
constraint. It is not the portable operator command.

This mode still uses the canonical hosts block, starts Docker-backed `lotus-core`, starts
`lotus-manage` on the canonical coexistence port `8001`, restarts direct ingress, and runs the
governed `PB_SG_GLOBAL_BAL_001` core seed in ingest-only mode. It intentionally skips `lotus-performance`,
`lotus-risk`, `lotus-ai`, `lotus-advise`, `lotus-report`, `lotus-archive`, `lotus-render`,
`lotus-idea`, `lotus-gateway`, and `lotus-workbench`. Use it only for API-level RFC proof where the evidence
target is core source-data products plus manage APIs, not populated Workbench screenshots or
gateway-mediated product flows.

When the proof depends on local `lotus-manage` or `lotus-core` code that has changed since the
last Docker image build, use the build variant so the evidence cannot accidentally validate a stale
container image:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/live/Start-LotusFrontOfficeCanonical.ps1 -ProjectsRoot $workspaceRoot -CoreManageOnly -BuildImages
```

The core/manage proof mode starts Docker-backed `lotus-manage` with the explicit stateful sourcing
posture required by the validator:

- `DPM_CAP_INPUT_MODE_PORTFOLIO_ID_ENABLED=true`
- `DPM_STATEFUL_CORE_SOURCING_ENABLED=true`
- `DPM_CORE_BASE_URL=http://host.docker.internal:8202` and
  `DPM_CORE_QUERY_BASE_URL=http://host.docker.internal:8201` for Docker-backed manage

Local manage overrides use the canonical host URL `http://core-control.dev.lotus` for the same
source-data authority. This keeps capability truth aligned with the proof target: stateful mode
should be advertised only when the managed core source path is actually configured.

The command exits after the stack is usable. It does not block on browser validation.
Non-zero seed or upstream startup failures must fail the PowerShell command; a partial bring-up is
not considered success.

Use this path when you want to bring the product up quickly, inspect it manually, or restart the
runtime without waiting for the full validation lane to finish.

The canonical bring-up script also accepts `-SeedWaitSeconds` when the governed seed needs a longer
drain window than the default `900` seconds.

When validating after Workbench source changes or after a merge that changed Workbench routes,
panels, labels, or live-validation scripts, refresh the Workbench runtime before accepting evidence.
Use either the source-backed local app path:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/live/Start-LotusFrontOfficeCanonical.ps1 -ProjectsRoot $workspaceRoot -LocalApps workbench
```

or rebuild the Docker-backed Workbench image when proving the containerized runtime:

```powershell
docker compose up -d --build
```

from `lotus-workbench` while the canonical backend stack is running. Compose resolves the repository
root and records it on the resulting image as `com.lotus.repository.checkout`. This immutable image
label lets Platform cleanup prove a residual Workbench image belongs to this exact checkout after
the container has gone; a missing, sibling, or nested-worktree path remains a blocking ownership
conflict. Protected direct Docker builds apply the same label from `github.workspace`; do not build
governed Workbench images through an unlabelled ad hoc command.

A stale Workbench container can
render old panel labels and create false live-validation failures or, worse, false proof against an
older UI. Diagnostic screenshots taken before this refresh must stay separate from demo-ready
evidence.

The canonical bring-up script accepts `-LotusAiEnvFile` to make the `lotus-ai` provider posture
explicit for proof runs. It defaults to `.env.example` for deterministic provider-disabled
front-office proof, even when the local `lotus-ai/.env` requests a live or local provider. Use
`canonical-stub.env.example` when the proof target includes RFC-0023/RFC-0024 workflow-pack
execution through `lotus-advise` and no local model server is intentionally running. Use the
repo-local `.env` only when the required live provider dependency, such as the `local-llm` Ollama
compose profile and model, is intentionally running.

When a prior local RFC-086 load/performance run has left stale `lotus-core` Kafka or Postgres
state behind, use `-CleanCoreState` on the startup script to run `docker compose down -v
--remove-orphans` in `lotus-core` before the canonical rebuild and reseed. This reset is explicit
because routine front-office bring-up only seeds the governed `PB_SG_GLOBAL_BAL_001` portfolio and
does not include the separate `1000`-portfolio load scenario.

## Canonical bring-up with validation

From `lotus-workbench`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/live/Start-LotusFrontOfficeCanonical.ps1 -ProjectsRoot $workspaceRoot -RunValidation -BuildImages
```

This runs the same bring-up flow and then executes the end-to-end validation lane once the stack
is live. The npm entrypoint passes `-BuildImages` so one-command validation proves the current
checked-out Docker-backed service sources rather than a previously built Gateway, Advise, Manage,
or Workbench image.

## One-command teardown

To stop the canonical local stack cleanly:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/live/Stop-LotusFrontOfficeCanonical.ps1 -ProjectsRoot $workspaceRoot
```

That script:

1. stops canonical host processes on `3000`, `8001`, `8100`, `8111`, `8150`, and `8310` while preserving Docker-owned listeners
2. removes direct ingress if it is present
3. runs `docker compose down` for `lotus-core`, `lotus-performance`, `lotus-risk`, `lotus-ai`, `lotus-advise`, `lotus-manage`, `lotus-report`, `lotus-archive`, `lotus-render`, `lotus-gateway`, and `lotus-workbench`

## Canonical validation

To validate an already-running canonical stack:

```powershell
npm run live:validate
```

This is the preferred operator path after the canonical bring-up command because it keeps service startup
separate from readiness, browser, and screenshot evidence gathering.

To write demo screenshots to a temporary directory outside the repository from Windows
PowerShell:

```powershell
$screenshotDirectory = Join-Path ([IO.Path]::GetTempPath()) "lotus-risk-module-shots"
powershell -ExecutionPolicy Bypass -File scripts/live/Validate-LotusFrontOfficeCanonical.ps1 `
  -ScreenshotDirectory $screenshotDirectory
```

Canonical orchestration is currently supported only from Windows PowerShell. A top-level `pwsh`
invocation on Unix is not a supported alternative because startup still contains Windows workspace
defaults and nested `powershell` calls; #1020 owns that implementation gap. Set
`$screenshotDirectory` to another caller-owned path when evidence must be retained elsewhere.

Validation layers:

1. canonical hostname resolution
2. direct backend readiness and capability checks for:
   - `lotus-manage`
   - `lotus-report`
   - `lotus-archive`
   - `lotus-render`
   - `lotus-manage` action-register supportability summary through
     `GET /api/v1/rebalance/supportability/summary`
3. Gateway and Workbench route readiness
4. live Gateway contracts for:
   - portfolio workspace
   - platform capabilities
   - workbench overview
   - performance summary
   - performance details
   - risk summary
   - risk concentration
   - risk drawdown
   - risk rolling
   - risk attribution
   - advisor brief
   - advisor-brief workflow-pack review actions for `ACCEPT`, `REVISE`, and `SUPERSEDE`
   - proposal creation with advisor-review narrative request
   - proposal narrative review and reviewed report-package request
   - portfolio report-ordering catalogue, reviewed single-portfolio request, and report-data job
     history through Gateway
   - advisor own-book membership, scope, assignment basis, tenant posture, and canonical portfolio
     inclusion through Gateway
   - RFC-0026 advisor cockpit tactical house-view cohort seed, action list, preparation packets,
     snapshot, supportability, and idempotent acknowledgement
   - RFC-0028 bank-demo proof scenario and supported-claim register through Gateway
5. browser-level validation for populated UI on:
   - Advisor own-book coverage and portfolio handoff
   - Portfolio summary
   - Portfolio detailed
   - Portfolio Report Centre, including independent structured-data/PDF readiness, explicit review,
     accepted request, recent history, and client-release boundary
   - Performance summary
   - Performance analysis
   - Performance advisor brief
   - Proposal narrative posture
   - Advisor cockpit
   - Bank demo proof
   - Performance risk
   - Performance evidence
   - DPM outcome review
   - DPM proof pack
   - DPM command center
   - DPM portfolio memory
   - DPM rebalance-wave command center
   - DPM Core candidate-source wave preview and no-caller-portfolio guard
   - DPM construction alternatives
   - DPM PM operating quality
   - DPM PM copilot workspace

Screenshots are written to:

```txt
output/playwright/live-canonical/
```

When `-ScreenshotDirectory` is supplied, screenshots and the live validation summary are written to
that directory instead. The summary records structured screenshot evidence for each capture:
stable file name, absolute path, route, panel identifier, portfolio ID, benchmark ID, as-of date,
and demo readiness state. The validator also writes `SHOT-INDEX.md` in the screenshot directory so
demo reviewers can quickly identify the captured product surfaces.

The machine-readable summary also records `workflowPackChecks` for the advisor-brief live path and
RFC-0023 proposal narrative proof. Advisor-brief checks prove initial workflow-pack run visibility
plus bounded `ACCEPT`, `REVISE`, and `SUPERSEDE` review transitions with replacement lineage
through the live `lotus-workbench` -> `lotus-gateway` -> `lotus-ai` contract chain. The browser
reads ACCEPT state, supportability, reviewer, and recorded time from exactly one stable evidence
record on the visible **Human Review** row. Missing, duplicate, malformed, non-ready, or
wrong-reviewer records fail closed; the validator does not infer persistence from flattened panel
text. Proposal
narrative checks prove Gateway-backed proposal creation with an advisor-review narrative request,
Workbench advisor-use narrative review confirmed from the authoritative current-version narrative
read, reviewed report-package request, source narrative hash visibility, and screenshot evidence
for `proposal.narrative_posture`. Delivery summary is validated separately and is not used as
narrative-review authority. Proposal memo checks prove
the RFC-0024 memo/evidence-pack surface can create or replay an advisor-use memo, record advisor-use
review, request memo report-package posture, request non-authoritative commentary, preserve replay
hash visibility, and capture governed screenshot evidence for `proposal.memo_evidence_pack`.
Report Centre checks prove the Gateway-owned catalogue renders for the canonical portfolio and
observe each output's source-owned readiness. When governed PDF creation is unavailable, structured
report data remains selected and PDF stays disabled. When governed PDF creation is ready, the
validator selects it and proves the reviewed request can be submitted. Both paths prove advisor
review gates submission, one request is accepted, recent report-data history is populated, and
archive retention and client delivery remain separate controls. The governed panel identifier is
`reporting.report_centre`; central platform registration is tracked in `lotus-platform#582`.
Advisor-book checks prove exactly one canonical portfolio belongs to the configured manager's
Gateway own-book response through Core `PortfolioManagerBookMembership:v1` with
`membership_basis=governed_role_assignment`. Before browser capture, the validator requires current
accepted provenance, snapshot/content identity, and `portfolio_party_role_assignments` / `role_type`
lineage, requires the returned scope date to match the requested canonical business date, and
rejects legacy projection evidence. It accepts a degraded aggregate only when the sole
degradation is the tenant-source-confirmation gap owned by `lotus-core#798`, and records that
boundary in machine-readable evidence. The `/book` handoff never falls back to the global portfolio
catalogue. The governed panel identifier is `advisor.book_overview`; its central platform registry
entry must be present before `advisor-book-overview-live.png` can be treated as demo-ready evidence.
Central registration is tracked in `lotus-platform#583`.
RFC-0025 policy checks now use the governed
`advisory_proposal_scenarios.policy_evaluation` block in
`lotus-platform/context/contracts/canonical-front-office-demo-data-contract.json` to activate the
Singapore private-banking policy pack, create a structured-note `PENDING_REVIEW` policy evaluation
through Gateway, verify the review queue, workflow, sign-off package, blocked client-ready posture,
and a bounded request-more-evidence decision, and then render the Suitability review route from the
same source-owned queue. The validator records this as
`POLICY_EVALUATION_PENDING_REVIEW_CREATED` so reviewers can distinguish real policy evidence from a
route-only screenshot.
Every RFC-0025 mutation binds its deterministic idempotency key to both the normalized request body
and the exact route resource: policy-pack id/version, proposal id/version, or policy-evaluation id.
An exact replay therefore keeps the same key, while a later canonical run that creates a new
proposal/version cannot collide with retained evidence from an earlier run. Do not replace this
contract with random keys, database cleanup, or conflict swallowing; repeatability must preserve
source-owned replay and conflict semantics.
RFC-0026 advisor cockpit checks then read the Gateway-backed cockpit action list, dedicated
house-view cohort seed, preparation-packet route, operating snapshot, and supportability posture for the same portfolio,
record an idempotent advisor acknowledgement, preserve blocked client-publication posture, and render
`/recommendations?mode=cockpit` as `advisory.advisor_cockpit`. The proof records
`ADVISOR_COCKPIT_ACTION_ACKNOWLEDGED`; it does not clear source-owned blockers, approve policy
findings, contact clients, generate orders, or claim OMS execution.
On repeated runs against a stack where the same source-owned action is already acknowledged, the
validator treats the returned acknowledgement state as replay evidence and skips a second
acknowledgement write rather than forcing a conflicting idempotency key.
The validator also records `advisoryJourneyChecks` for the front-office advisory route sequence:
Advisory Overview, Client Context, Advisor Cockpit, Opportunities and Ideas, Proposal Builder,
Suitability review, Risk and Impact, Approval Queue, Discussion pack review, and Implementation
Status. The Proposal Builder check evaluates its draft through Gateway and Advise before capturing
the same screen; evaluation is a source-backed result state, not a separately addressable screen.
These journey checks are route-level evidence over existing Gateway-backed Workbench screens;
they do not promote new backend capability, client-ready release, client communication, execution,
or product support. Discussion pack review records a populated screen as ready only after the
selected `proposal-discussion-pack-review.v1` projection renders, a source refresh reconciles the
current version, the client-release boundary remains visible, and unsupported external-use actions
remain absent. A source-confirmed empty worklist is recorded as empty and truthfully degraded rather
than demo-ready. Implementation Status becomes source proof only when validation also confirms the
selected proposal and version against `proposal-implementation-status.v1`, its evidence posture,
lineage, source observation, and explicit unsupported order/fill/settlement capability. A route
screenshot alone remains navigation evidence.
For Opportunities and Ideas, the browser proof now goes beyond read-path rendering: it opens
source-safe Idea candidate detail and records review-action, feedback, and bounded
conversion-intent controls through the Workbench BFF/Gateway path, verifying source-owned queue and
detail refresh after each mutation. Each mutation must return an accepted/replayed source
persistence receipt before Workbench can show success. The browser checks a stable action status id
with `data-action-state=recorded-and-refreshed` and retains business copy as supporting evidence;
it does not depend on one full sentence. The proof also requires the named virtualized opportunity
grid to contain source rows and captures its automatic presentation-receipt write. That receipt
must preserve the candidate identity, Idea global rank, independently observed visible count,
queue/ranking policies, candidate versions, and exact request evidence; tenant scope must appear
only in the returned BFF/Gateway/Idea receipt, never in the browser request, and must match the
single tenant injected by the Workbench BFF. The canonical HTTP origin must also produce the exact
SHA-256 visible-set digest without depending on secure-context-only `SubtleCrypto` or
`Crypto.randomUUID`. The machine-readable summary records that durable source evidence and only
bounded action-control posture and non-claim boundaries. It
does not expose conversion-intent identifiers, create proposals, grant suitability or execution
authority, certify production identity, or promote Lotus Idea as a supported feature.
RFC-0028 bank-demo proof checks read Gateway-backed scenario and supported-claim contracts,
validate the governed scenario id, proof marker, and claim postures, then render
`/recommendations?mode=proof` as `advisory.bank_demo_proof`. The proof captures
`advisory-bank-demo-proof-live.png` only after the source contracts load and the UI shows blocked
client-publication posture without approval, client communication, order, fill, settlement, or OMS
claims.

For DPM PM operating quality, validation creates and re-reads Manage-backed evidence through
Gateway under the governed Workbench caller tenant before classifying the panel as ready: score
run, source-defined fairness analysis,
bounded supervisory review action, and governed summary invocation. The browser proof then checks
that the selected quality-run and fairness-review ids match those persisted through Gateway, that
the source and authority remain Manage-owned, that source states are present, and that the screen
has no active failure posture. It also checks the persisted summary-invocation detail and list
surface. This prevents a false ready claim when the PM quality endpoints are reachable but the
canonical stack has no persisted operating-quality evidence, and avoids coupling proof to mutable
business labels.

For bounded RFC37-WTBD-004 candidate-source proof, validation now previews a
`BULK_REVIEW_CAMPAIGN` wave through Gateway with
`campaign_candidate_source=CORE_DPM_PORTFOLIO_UNIVERSE`, requires lotus-core
`DpmPortfolioUniverseCandidate:v1` source refs and at least one candidate item, and separately
proves that a mixed Core-discovery/manual-portfolio request is rejected. This validates the
implemented source-consumer guard without claiming relationship householding, global portfolio
universe ownership, PM ranking, client communication workflow, OMS, fills, settlement, or
execution.

Machine-readable validation evidence is written to:

```txt
output/playwright/live-canonical/live-validation-summary.json
```

After validation passes, capture the companion operations and non-functional evidence pack:

```powershell
npm run live:evidence
```

This writes a timestamped pack under:

```txt
output/observability-live/<timestamp>/
```

The pack includes canonical DNS resolution, container inventory, readiness and representative API
outputs, Workbench Prometheus metrics, Prometheus/Grafana API samples, bounded container log tails,
and screenshots for Workbench evidence views plus Prometheus/Grafana entrypoints. Use this for
offline demo preparation and operational investigation documentation. It complements
`live-validation-summary.json`; it does not replace the governed validation pass. The manifest
records the validation summary path and whether it existed at capture time, and it separates
application API checks from metrics and dashboard HTTP samples so reviewers can audit the evidence
without guessing the directory layout.

Before presenting a pack, review `observability-evidence-manifest.json` and the captured Gateway
overview for warnings or partial failures. Manage supportability must return HTTP `200`; a freshly
started stack may report `supportability.state=empty` when no management actions have been
recorded, but an HTTP `503` indicates the Postgres-backed supportability store is not ready and the
pack is diagnostic only.

For RFC-0108 performance evidence review, pair the screenshots with bounded logs and timing
signals:

- Workbench BFF logs should show the performance BFF route and elapsed timing for summary,
  details, attribution trend, and related split endpoints.
- Gateway and performance logs should preserve `correlation_id`, `request_id`, and `trace_id`
  through `analytics_ui.gateway`, fanout, audit, and compute events.
- Gateway payloads may truthfully classify evidence lineage as partial when lineage materialization
  is pending or a lineage manifest is absent. In that state Workbench must show the Evidence panel
  as `PARTIAL`/`PENDING` rather than treating the route as fully certified.
- Use repeated lineage `404` entries as investigation evidence only when the canonical performance
  route, calculation outputs, and validation summary are otherwise green.

The machine-readable summary also records the governed canonical contract identity and version from
`lotus-platform/context/contracts/canonical-front-office-demo-data-contract.json`. If the
platform contract file is unavailable, the validator emits a deterministic fallback that still
identifies the run as governed by `RFC-0076`, instead of silently dropping contract provenance.

The validator also loads the governed panel registry from
`lotus-platform/context/contracts/workbench-panel-registry.json`. That registry controls the
expected panel identifiers, allowed panel states, and screenshot ownership under `RFC-0077`, so
new panel work must extend the registry instead of introducing ad hoc validator metadata.

The validator implementation is intentionally modular under `scripts/live/validation/`:
contract metadata, probe behavior, calculation sanity, browser workflows, and panel-governance
rules are separated so future changes extend the correct boundary instead of re-growing a single
monolithic validation script.

The validation script runs the browser validator from the `lotus-workbench` repository root so
these artifact paths are stable even when `lotus-platform` or another orchestrator calls the
script. Browser validation failures must fail the PowerShell command. The Manage action-register
supportability summary is recorded as source-supportability evidence, including stale state and
reason when present; DPM panel proof is gated by the command-center, wave, outcome-review, proof-pack,
portfolio-memory, construction-alternatives, PM operating-quality, and PM copilot workspace contracts
instead of failing on unrelated historical action-register freshness.

When validating active Workbench source changes without rebuilding the whole stack, use the
`Start-LotusFrontOfficeCanonical.ps1 -ProjectsRoot $workspaceRoot -LocalApps workbench` command
above before collecting final browser proof.
That path keeps the canonical backend stack but serves Workbench from the current branch, avoiding
stale Docker image evidence for newly added panels or selectors. Both default startup paths rebuild
the Idea Compose project automatically because its capacity evidence embeds a fresh per-run identity;
they do not rebuild unrelated services for that reason. If Gateway, Advise, Manage, Core, or another
source service changed, use the `-RunValidation -BuildImages` bring-up command above before
accepting live proof.

The DPM mandate command-center panel is screenshot-ready only when Gateway returns a canonical
populated `READY` supportability posture. Partial, degraded, blocked, and empty command-center
supportability must not collapse into a false ready panel. Do not treat partial screenshot output
as successful evidence. The browser proof selects a source-owned attention item with the keyboard,
opens its evidence identifiers, rejects raw primary reason-code and fabricated-remediation language,
and verifies page-level reflow at 1024, 768, 720 (effective 200% zoom for a 1440-pixel workspace),
and 519 pixels. Wide operational tables may scroll inside their labelled table container; the page
must not introduce horizontal scrolling.

The summary includes `calculationChecks` for canonical performance and risk sanity. These checks
assert numeric ranges, contribution reconciliation, governed attribution fallback posture, risk
observation coverage, concentration coverage, rolling-window availability, and historical risk
attribution residuals before screenshots are accepted as demo evidence.

The summary also includes `supportabilityChecks` for Gateway-backed source supportability evidence.
For performance and risk payloads, the validator records the bounded source service set, item count,
stale count, partial count, action-required count, and aggregate supportability state derived from
Gateway `source_supportability` arrays. Stale source supportability takes precedence over fresh
source supportability so browser proof cannot mask upstream freshness degradation.

The summary also includes `panelClassifications` for the product surfaces validated during the run.
Panels must be classified as `ready`, `partial`, `unavailable`, or another explicit governed state.
The validator fails if a supported panel is recorded as blank without a governed empty, partial, or
unavailable posture.
The summary also includes a `supportabilityMatrix` with registered versus classified panel counts,
required and observed supportability-state counts, owning-service counts, non-ready panel evidence,
and missing-panel evidence. Reviewers should inspect this matrix before accepting screenshots as
demo-ready proof, because it shows whether the run covered both ready panels and governed bounded
partial/degraded states.

The summary also includes `rfc3643FeatureCoverage`, a feature-by-feature evidence matrix for the
implemented RFC-0036 through RFC-0043 front-office product paths. Each row maps the RFC feature to
the API, workflow-pack, seeded entity, and Workbench panel evidence that made the feature
demo-ready. Rows that support adjacent front-office proposal proof, such as RFC-0024 proposal
memo/evidence-pack validation, are marked with `auditScope=adjacent-front-office` and counted
separately from the RFC36-43 feature totals. RFC36-43 validation fails only on rows with
`auditScope=rfc36-43`; adjacent proof gaps remain visible through the aggregate and adjacent gap
counts without being treated as RFC36-43 implementation regressions. The matrix is not a blanket future-scope
certification: it records the current scenario scope, now including the governed RFC-0041
multi-portfolio explicit-list wave preview from the canonical contract and the RFC-0037 bounded
Core `DpmPortfolioUniverseCandidate:v1` candidate-source preview/no-caller-portfolio guard and
source-owned mandate-binding selection-basis evidence. Broader
source-owner cohort products remain listed as scenario expansion until their source products and
downstream realization are proven.

## Gateway startup rule

Canonical local Gateway startup must use the governed script when `gateway` is listed in
`-LocalApps`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/Start-CanonicalGateway.ps1 -Port 8100
```

Do not start the local Gateway with a bare:

```powershell
python -m uvicorn app.main:app --port 8100
```

without `--app-dir src`.

Failure mode:

- `/health/ready` returns `200`
- canonical Workbench data routes return `404`
- the wrong installed `app` package was loaded instead of the current repository checkout

The canonical Gateway start script fixes this by always launching:

```powershell
python -m uvicorn app.main:app --app-dir src --host 0.0.0.0 --port 8100
```

## lotus-manage coexistence rule

`lotus-advise` and `lotus-manage` both default to host port `8000` if started naively.

To keep the ecosystem up together:

- `lotus-advise` remains on `8000`
- Docker-backed `lotus-manage` publishes container port `8000` to host port `8001` through
  `LOTUS_MANAGE_HOST_PORT=8001`
- local override `lotus-manage` also runs on `8001`
- direct ingress maps `http://manage.dev.lotus` to `host.docker.internal:8001`

Use:

```powershell
powershell -ExecutionPolicy Bypass -File ..\\..\\lotus-manage\\scripts\\Start-CanonicalManage.ps1 -Port 8001
```

## What the browser validator checks

For `PB_SG_GLOBAL_BAL_001`, the validator confirms:

- Advisor Book:
  - complete own-book source membership and paging evidence is valid
  - rendered portfolio identities and lifecycle states exactly match every Gateway row
  - missing, extra, duplicated, malformed, or state-mismatched rendered rows fail the proof
- Portfolio summary:
  - portfolio shell renders
  - top holdings chart contains ranked rows
  - allocation donut renders
- Portfolio detailed:
  - detailed mode opens
  - `Transactions` loads
  - `Projected Cashflow` loads
  - the transactions grid shell renders
  - the projected cashflow summary renders
- Performance summary:
  - `Net Return Path` loads
  - `Performance Drivers` loads
  - return path table has data rows
- Performance analysis:
  - `Attribution Over Time` renders
  - `Attribution Detail` table is populated
  - `Performance Drivers` table is populated
  - contribution rows reconcile to the net portfolio return
  - attribution detail is populated or carries a governed partial fallback
- Advisor Brief:
  - talking points render
  - source metrics render
  - source evidence actions render
  - the Workbench `Accept Brief` action records a bounded review transition through the live
    gateway and lotus-ai path
  - the returned Lotus AI actor `review:<staff-reference>` remains intact in source evidence while
    Workbench presents and validates the corresponding business staff reference
  - an explicit review failure alert stops the browser proof immediately; success still requires
    the refreshed atomic Human Review evidence to report `ACCEPTED`, `READY`, the expected reviewer,
    and a valid UTC event time
- Risk:
  - `Risk Snapshot`
  - `Drawdown`
  - `Concentration`
  - `Rolling Risk`
  - `Historical Risk Attribution`
  - attribution table is populated
  - summary metrics have sufficient observations and ready benchmark-relative metrics
  - concentration has issuer coverage and top-exposure evidence
  - drawdown has underwater-series evidence
  - rolling risk has all configured windows and enough computable windows for the current horizon
  - historical attribution contributors reconcile with a negligible residual
  - rendered mandate-constraint identities and states exactly match the complete summary and
    concentration Gateway evidence without a browser-owned state list
- Evidence:
  - Evidence mode opens
  - evidence support strip or truthful degraded state renders

Exact row proof uses `scripts/live/validation/source-render-proof.mjs`. Screen adapters retain
domain meaning and DOM extraction; the shared helper compares only source, identity, and state. Do
not replace a source adapter with a generic field mapper or change expected evidence merely to make
canonical validation pass.

## Current local limitation

If `ai.dev.lotus` is not mapped in the host DNS/hosts file, direct canonical probing of the AI
service from the host will fail even if:

- the `lotus-ai` container is healthy
- the Gateway advisor-brief route still succeeds through its configured runtime path

The validator warns about missing `ai.dev.lotus` hostname resolution so this gap is visible instead
of silently ignored.
