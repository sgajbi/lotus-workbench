# Validation and CI

Current evidence posture: this page maps implemented Workbench checks to the claims they can
support. PR checks prove merge readiness for the exact branch head; canonical and mainline lanes
remain separate evidence classes and must not be inferred from a green local test or screenshot.

## Evidence Map

Validation depth must match the claim being made. A narrow unit test can prove a local contract,
while integrated product support requires canonical runtime evidence and green repository lanes.

| Change or Claim | Minimum Evidence | Promotion Boundary |
| --- | --- | --- |
| Local route or serializer | Focused behavioral test plus lint/typecheck | Does not certify an upstream or whole-product contract |
| Product UI behavior | Unit/integration coverage, build, and relevant browser smoke | Must remain Gateway-backed and capability-truthful |
| Deterministic fixture business journeys | All registered families through `make test-e2e-fixtures`; exact test identity and zero skips | Proves Workbench behavior against governed fixtures, not canonical source integration |
| Canonical front-office support | `live:validate` evidence for the governed seed and affected panels | Screenshots alone cannot promote support |
| Stateless multi-replica regression | `npm run scale:proof` against the exact production image | Engineering evidence only; does not certify production HA, DR, or bank capacity |
| Merge readiness | Feature Lane and PR Merge Gate | Mainline is not proven until Main Releasability passes |
| Demo evidence | Passing canonical validation plus same-run evidence pack | Diagnostic captures stay separate |

## Lane model

`lotus-workbench` uses:

1. `Remote Feature Lane`
2. `Pull Request Merge Gate`
3. `Main Releasability Gate`
4. `Main Gate Coverage Audit` (scheduled and operator-dispatched control audit)

PR auto-merge uses the repository `LOTUS_AUTOMERGE_TOKEN` secret for rebase auto-merge so the
resulting main update is not suppressed as a default `GITHUB_TOKEN` push. When the secret is absent,
the workflow records a warning and skips queueing auto-merge instead of making a false readiness
claim. A merged-PR dispatcher triggers `main-releasability.yml` for exact-main evidence, and the
dispatcher creates or verifies an immutable `main-releasability-<merge_sha>` tag before supplying
`expected_sha` and the originating PR number. Main Releasability has no automatic `push` trigger:
it rejects a different checkout before the remaining gate chain starts. Its concurrency key uses
the expected merge SHA (or `github.sha` for manual operator dispatch), preventing one revision's
retry from cancelling or masquerading as another revision's evidence.

The daily `Main Gate Coverage Audit` checks two distinct controls. First, it fails when any of the
latest 60 `main` commits has no verdict-bearing Main Releasability run, including intermediate
commits introduced by a multi-commit rebase merge. Second, it compares live `main` branch
protection field by field with `quality/branch_protection_policy.v1.json`, including required
deployment environments that GitHub exposes through its GraphQL branch-protection rule. The repository-native
document check runs in `make lint` before merge; the scheduled live comparison additionally needs
an approved repository secret with `administration:read`. Until that secret is provisioned, the
live step fails closed rather than treating protection as verified. An operator should investigate
reported historical gaps, backfill an exact immutable commit only through the documented command
printed by the audit, and never relabel an unevaluated revision as passed. The zero-approval review
posture is deliberate while Workbench has one accepted developer; strict required checks and
resolved review conversations remain mandatory, and the policy requires one approval plus
CODEOWNERS when a second accepted reviewer exists.

## Local command mapping

- `make check`
  dependency security, lint, typecheck, coverage-backed test gate, build
- `make security`
  fails on any high or critical advisory in the complete runtime and engineering toolchain, and on
  any moderate-or-higher advisory in the browser-delivered production dependency graph. The gate
  runs in the Feature, PR Merge, and Main Releasability lanes. A future exception must be
  time-bounded and documented against a GitHub issue; do not weaken the severity thresholds or use
  `npm audit fix --force` as an unreviewed dependency migration.
- `make lint`
  validates the Workbench branch-protection policy document, then runs runtime-support and
  direct-dependency-admission governance, CSS and architecture controls,
  screen-documentation governance, and then the maintained ESLint CLI over the repository root
  with the flat configuration. The CSS gate keeps `src/app/globals.css` as a small import-only
  entrypoint, preserves governed global layer order, and blocks global-style budget growth unless
  the baseline is intentionally updated with issue evidence. It also rejects migrated component
  selector families, including `portfolio-screen-rail`, if they return to a governed global layer.
  Production app source keeps the direct Next, Core Web Vitals, TypeScript, and stable React Hooks
  correctness rules; tests, live validators, scripts, and configuration files are scanned by the
  shared TypeScript/JavaScript policy. Deprecated `next lint` and `eslint-config-next` are not part
  of the governed gate.
- `npm run quality:source-authority`
  is a blocking, contract-driven fitness function for critical Gateway-backed business facts. Risk
  mandate comparison and Advisor Book each declare source identity/state ownership, a domain-local
  adapter, executable rendered-component extraction, stable rendered evidence, and production
  wiring. The gate mutates Gateway-shaped source state, requires that mutation to survive the real
  screen mapping and component DOM, and rejects missing, extra, duplicate, substituted, or
  reassuring browser evidence. A cloned adapter or view-model result is not accepted as render
  proof. The gate fails closed when
  enrollment is empty or drops below two surfaces. Labels, date/number formatting, and other
  presentation-only fields are explicitly outside the control; Workbench must not create a second
  risk or portfolio lifecycle model. Contract and render-proof enrollment must match exactly, and
  each surface proves at least two distinct source identities and two distinct source states.
- `npm run test:coverage`
  runs the complete V8-backed application suite. The function threshold is a monotonic exact-measurement
  ratchet at 93.29% (3,115 of 3,339 functions on 2026-08-30), replacing the former 70% floor without
  weakening line, statement, or branch thresholds. Improve meaningful failure, partial-data,
  recovery, and source-mismatch tests before raising the floor; never add exclusions or shallow
  line-exercise tests to make this gate green.
- `npm run quality:dependency-risk`
  fails closed unless every and only direct production dependency is reconciled across
  regular, optional, or required-peer `package.json` sections, the matching lockfile-root section
  and resolved lock entry, the complete executable JSON Schema, and the versioned technology-risk inventory. It
  rejects mutable or prerelease versions, unapproved or missing SPDX evidence, unsupported
  lifecycle, malformed HTTPS evidence, missing stewardship/security channels, ungoverned review
  ownership, ownerless architecture or exit posture, expired reviews, prohibited state, and
  incomplete or expired exceptions. This is a blocking Workbench control; the referenced Lotus
  platform technology policy remains report-only.
- `npm run quality:product-copy`
  parses productive TypeScript and JSX, rejects transport and engineering language in business
  copy, resolves statically inspectable local `const` references that feed rendered copy, and
  requires both the measured violation inventory and unresolved user-facing expression inventory
  to equal their checked-in baselines exactly. A stable digest of structural paths and enclosing
  declaration identities distinguishes identical copy in different named or positional scopes and prevents one newly opaque path
  replacing a resolved path at the same count. Native `aria-label`
  copy is governed alongside visible copy. Resolution is lexical-scope aware and deliberately
  does not execute code or treat control-state enums as display copy. Standard mutation APIs reached
  through object members retain conservative authority through local aliases, renamed member
  wrappers (including shorthand, renamed, bounded conditional/logical, transparent property-value,
  comma-expression right operand, direct array, variable-initializer, ordinary assignment-RHS, and
  statically named computed captures resolved through their value symbols at the exact value-expression
  program point), and declaration, assignment-form,
  renamed, or nested destructuring. Sequence traversal follows only the value-producing right operand
  while applying earlier in-expression assignments in JavaScript evaluation order. Simple assignment
  expressions contribute their right-hand value. Contained RHS writes precede their enclosing
  assignment, while logical assignments retain the pre-RHS authority used by `&&=`, `||=`, or `??=`
  to decide whether that RHS runs; skipped writes stay excluded and uncertain writes stay conservative.
  Intermediate property,
  computed-property, renamed, member, and assignment-form
  aliases retain the captured owner path. Cycle detection keys authority by symbol and program point,
  allowing proven earlier captures to be revisited while repeated identical states become conservative
  unknowns; dynamic getter returns remain unresolved.
  Opaque values at named user-facing
  properties are measured rather than silently treated as clean.
  Regression, identity substitution, and unused improvement headroom in either inventory fail. Legitimate wealth-management terms or
  identifiers may be admitted only through the exact, review-backed entries in
  `config/product-copy-exceptions.v1.json`; stale, duplicated, broadened, unknown-rule, or
  undocumented exceptions fail the same gate. A broad vocabulary allowlist is not supported.
- `npm run lint:css-global`
  validates `src/app/globals.css`, `src/styles/global/*`, and
  `scripts/quality/css-global-governance-baseline.json` against the documented CSS layer model in
  `docs/architecture/css-layer-governance.md`, including exact size ratchets and forbidden migrated
  selector prefixes.
- `npm run lint:react-compiler`
  runs the broader `eslint-plugin-react-hooks` recommended rule set against `src/`. It is a blocking
  step in `npm run lint`, so `make lint`, `make check`, Feature Lane, PR Merge Gate, and Main
  Releasability all enforce it. This proves conformance to the checked rule set; it does not enable
  or certify the React Compiler runtime.
- `make build`
  runs `next build` after the repository-owned lint and typecheck gates in `make check`. Workbench
  does not rely on Next's duplicate build-time ESLint integration as the lint authority.
- `make test-e2e`
  Playwright smoke validation. The launcher retains the Next production cache, performs a fresh
  production build, stages generated `.next-build/static` assets beside the generated standalone
  output, and runs `.next-build/standalone/server.js` directly, matching the production-image
  entrypoint. It
  allows up to four minutes for build and server readiness and owns the direct server child so
  cancellation cannot leave a shell-owned listener behind. Set
  `PLAYWRIGHT_REUSE_VALIDATED_BUILD=1` only immediately after a successful production build in the
  same worktree; the launcher fails closed when `.next-build/BUILD_ID` is absent. When port `3000`
  belongs to a shared stack or another worktree, set `PLAYWRIGHT_PORT=<free-port>`. An explicit port
  binds the production server, readiness probe, and browser base URL to that listener and disables
  existing-server reuse, so the proof cannot silently exercise a stale Workbench build.
- `make test-e2e-fixtures`
  executes every registered Portfolio, Performance, Manage, and Reports fixture scenario against
  an isolated optimized Workbench and fixture Gateway. The registry owns exact scenario and test
  identity; missing, unexpected, duplicate, failed, timed-out, interrupted, skipped, and zero-test
  outcomes fail closed. Protected PR and main lanes run the same four-family matrix and always
  retain JSON and Markdown family summaries. Use
  `node scripts/testing/run-e2e-fixture-family.mjs --family <family>` for a focused local family.
  The existing required `PR Merge Gate / Playwright Smoke` context is an always-running aggregate:
  it fails unless fixture-free smoke and every matrix family succeed. This evidence does not
  replace canonical live validation.
- `npm run test:next-artifact-isolation`
  starts a branch-owned development host and proves its page plus every rendered client asset stay
  available while a clean production build regenerates `.next-build`. Development owns
  `.next-dev`; production validation owns `.next-build`. The protected PR browser lane runs this
  proof and reuses only its validated build for Playwright. Local machine-readable evidence is
  written to `output/next-artifact-isolation.json`. See
  [Next.js Artifact Isolation](https://github.com/sgajbi/lotus-workbench/blob/main/docs/architecture/next-artifact-isolation.md).
- `npm run test:e2e:performance:populated`
  deterministic production-browser proof for complete Performance economics, supported modules,
  evidence navigation, contribution detail, and desktop layout. The isolated fixture Gateway uses
  existing governed contract builders; its live-only Server-Timing check is explicitly skipped.
- `npm run test:e2e:performance:unavailable`
  deterministic production-browser proof for source-owned unavailable return, benchmark, horizon,
  contribution, metric, and evidence postures. Populated-only geometry and live-only timing checks
  are explicitly skipped instead of weakening their preconditions.
- `npm run test:e2e:performance:return-path-density`
  optimized-production proof that a single source-returned observation is a compact exact
  portfolio/benchmark/active comparison rather than a fabricated time series. It validates
  semantic evidence, keyboard-focus stability, component-capacity reflow, bounded height, browser
  runtime cleanliness, and page overflow at 1440, 1024, 720, and 519 pixels.
- `npm run test:e2e:typography:compare`
  isolated optimized-production comparison of pinned IBM Plex Sans and Inter candidate assets on
  Portfolio Review at 1440, 1024, 768, and 519 pixels. It records computed family, semantic size
  and weight, metric text width, card containment, single-line financial posture, and page overflow.
  The harness verifies candidate checksums and injects each family independently; it is design
  decision evidence, while `npm run quality:font-assets` remains the production supply-chain gate.
- `make ci-local-docker`
  Docker parity built from the same immutable Node 22 Maintenance LTS Debian Bookworm slim base as
  the production image; Vitest is capped at two workers so the lane remains deterministic while the
  governed canonical stack shares the developer workstation, and workstation `.env.local` is masked
  by a tracked empty read-only fixture
- `npm run scale:proof`
  hermetic engineering regression with two identical production-image replicas behind a
  digest-pinned stable NGINX least-connections balancer. It requires no affinity, records distribution
  across both replicas, persists and re-reads source-owned state across replicas, stops and recovers
  one replica, enforces error and p95 thresholds, captures p99, streams container resource samples
  during each workload phase, records the host Node load generator for the same phase, and writes
  JSON plus Markdown under `output/scale-proof/`. It is not production topology, load/soak, HA, DR,
  multi-region, identity, or bank-capacity certification.
  Successful replica distribution uses the terminal address from each balancer attempt chain; a
  failed first attempt retried through the same healthy replica cannot satisfy the two-replica gate.
- `npm run live:validate`
  canonical integrated product validation
- `npm run live:stack:up:validate`
  one-command canonical stack bring-up and validation; this rebuilds Docker-backed service images
  so Gateway, Advise, Manage, and Workbench proof reflects the current checked-out sources
  The startup preflight accepts only expected canonical Docker owners after normalizing host paths,
  and the core seed runs with the shared `portfolio_common` library on `PYTHONPATH` instead of
  depending on workstation-global Python packages.
- `npm run live:stack:preflight`
  non-mutating audit of current canonical host-port ownership; approved Compose project/path pairs
  pass, while wrong-project, missing, relative, malformed, and foreign ownership fails before any
  runtime state changes
- `npm run test:runtime-ownership`
  executable contract for canonical, repeated-separator, case, trailing-separator, parent-segment,
  relative, malformed, and foreign Compose working-directory decisions; enforced in feature, PR,
  and main quality lanes
- `npm run live:validate:construction`
  focused RFC-0039 construction alternatives proof against the running canonical stack
- `npm run live:evidence`
  post-validation observability, logging, metrics, API, and dashboard evidence capture
- `npm audit --json`
  detailed dependency advisory evidence for the Workbench runtime and test toolchain; the enforced
  `make security` policy additionally keeps the production graph free of moderate-or-higher
  findings

## What the gates protect

- versioned runtime-support reconciliation across package metadata, lockfile engines, exact CI
  Node, bundled npm, the digest-pinned container, canonical immutable install commands, exact
  Playwright, explicit Chromium projects, and the mandatory review date
- real app-surface coverage across the active product paths
- browser smoke for supported front-office flows
- exact, zero-skip deterministic browser coverage for every registered fixture scenario family
- Docker parity for production-like runtime assumptions
- executable canonical Compose ownership and reused-stack safety
- canonical seeded-data validation for integrated product proof
- repeatable canonical mutations whose deterministic idempotency keys bind the exact route resource
  and normalized request body; retained evidence from an earlier run must not force database cleanup
  or permit a source-owned conflict to be hidden
- dependency posture for browser-delivered code and the Node-based build/test toolchain
- immutable official Node LTS/glibc runtime provenance, unprivileged execution, production-only
  standalone traced runtime dependencies, no runtime package-manager toolchain, fixable
  high/critical image enforcement, and downloadable CycloneDX SBOM evidence
- image-owned, dependency-free Node readiness that `docker compose` inherits after development
  tools and package managers are removed; no runtime `wget` or `curl` dependency is required
- allowlisted production build context that excludes local environment values, generated evidence,
  test assets, documentation, caches, and logs from the image builder
- full-SHA scanner-action pinning and an explicitly safe Trivy binary version; mutable scanner tags
  are prohibited because the Trivy ecosystem was compromised in March 2026
- GitHub Actions JavaScript action runtime posture, using Node 24-capable action majors for
  checkout, setup-node, and artifact upload so CI warnings do not hide product-surface failures
- the exact Workbench production image and the validation-only NGINX image built from its
  digest-pinned official base plus exact vendor-fixed security packages are separately scanned for
  fixable high/critical findings before the protected Docker lane runs the scale proof; the
  resulting local image identities and machine-readable proof are retained as PR or exact-main
  evidence

## Evidence posture

- canonical browser validation writes screenshots and structured summary output under
  `output/playwright/live-canonical/`
- `live-validation-summary.json` includes a `supportabilityMatrix` with registered/classified
  panel counts, required and observed supportability states, owning services, non-ready panel
  evidence, and missing-panel checks; review this matrix before accepting screenshots as
  demo-ready evidence
- `live-validation-summary.json` also includes `rfc3643FeatureCoverage`, which maps implemented
  RFC-0036 through RFC-0043 front-office features to live API, workflow-pack, seeded entity, and
  panel evidence. Adjacent proposal evidence, including RFC-0024 proposal memo/evidence-pack
  validation, is marked as `auditScope=adjacent-front-office` and counted separately so it cannot
  inflate RFC36-43 completion counts or fail the RFC36-43 assertion by itself. Adjacent gaps remain
  visible through the aggregate and adjacent gap counts. RFC-0041 coverage includes the governed
  multi-portfolio explicit-list wave preview from the canonical contract. RFC-0037 coverage includes
  bounded Core `DpmPortfolioUniverseCandidate:v1` candidate-source preview and the required rejection
  of mixed Core-discovery/manual-portfolio requests. Treat remaining scenario-expansion notes as open
  validation depth, not as implemented product claims.
- construction alternatives live proof writes focused machine-readable evidence and a panel
  screenshot under `output/rfc39-wtbd002-construction-lab/construction-live/`
- DPM PM operating-quality live proof creates and re-reads Manage-backed score-run,
  fairness-analysis, supervisory review-action, and summary-invocation evidence through Gateway
  before the panel is classified as ready
- RFC-0024 advisory journey route proof is recorded in `advisoryJourneyChecks` with screenshots for
  Advisory Overview, Client Context, Opportunities and Ideas, Proposal Builder, Proposal
  Simulation, Suitability review, Risk and Impact, Approval Queue, Discussion Pack Review, and
  Implementation Status. This is route evidence over existing Gateway-backed screens, not a new
  client-ready, communication, execution, or backend capability claim.
- The focused Implementation Status Playwright proof is stronger than that route check: it verifies
  selected proposal/version posture, Gateway/BFF request, currentness, lineage, progressive support
  detail, the unsupported order/fill/settlement boundary, compound refresh confirmation, focus
  continuity, non-duplicated supplementary context, exact visible-overflow diagnostics, and
  1440/1280/1024/720/519/390 reflow. It generates reviewed desktop and compact images under
  `docs/evidence/issue-798-product-copy/implementation-follow-up/`. Canonical readiness still
  requires fresh source-backed runtime evidence; a screenshot alone is not contract proof.
- The focused Proposal Detail narrative proof verifies that the current source version is fixed in
  the review flow, reviewer reference and rationale are required, **Request discussion pack** stays
  unavailable until refreshed advisor-review evidence agrees, success is withheld after persistence
  or refresh failure, raw source errors remain hidden, and the selected workspace contains every
  visible element at 1440/768/640/519 pixels. It writes reviewed desktop and compact images under
  `docs/evidence/issue-798-product-copy/narrative-review/`; the browser uses an isolated
  checkout-specific port and does not disturb the canonical runtime.
- The Proposal Detail lifecycle regression verifies that one persisted command produces one exact
  confirmation read for detail, workflow, approvals, and lineage before the business success state
  appears. Component proof rejects response/source identity mismatch, non-advancing version replay,
  source mismatch, duplicate commands, orphaned revision caches, failed confirmation, and late
  prior-workspace completions; read-only historical lookup remains independent from the persisted
  command lock.
- The focused Proposal Detail memo proof verifies explicit advisor identity, current-version memo
  evidence, exact review and package prerequisites, source-aligned success, persistence and refresh
  failure, optional non-authoritative commentary, stable canonical selectors, keyboard operation,
  and 1440/768/640/519 zero-overflow reflow. It writes reviewed evidence under
  `docs/evidence/issue-798-product-copy/memo-evidence-pack/`. Canonical automation performs only
  source-admitted missing steps and records the actions actually confirmed after refreshed reads.
- RFC-0025 Suitability review policy-queue proof must use the Gateway-backed advisory policy
  review queue, selected evaluation, sign-off package, workflow posture, and bounded
  request-more-evidence decision route. The live validator seeds this from the governed
  `RFC25_SG_STRUCTURED_NOTE_PENDING_REVIEW` scenario in the canonical front-office demo-data
  contract, then records `POLICY_EVALUATION_PENDING_REVIEW_CREATED` in `workflowPackChecks`.
  It must verify that Workbench renders source-owned policy posture in advisor language without
  claiming local suitability calculation, policy approval, waiver authority, sign-off completion, or
  client-ready publication.
- Lotus Idea opportunity proof must use Gateway `/api/v1/ideas/review-queues/advisor` and the
  active portfolio as caller entitlement scope. The panel is not a supported-feature promotion until
  canonical browser validation proves populated Workbench rendering, source-safe candidate detail
  access, review-action, feedback, and bounded conversion-intent controls through Gateway, source
  persistence with an accepted/replayed receipt, and queue/detail refresh after each mutation.
  Browser proof requires the stable action status test id and `recorded-and-refreshed` state; product
  copy remains supporting evidence and may evolve without weakening persistence or refresh proof.
  It also proves no reranking, no auto-proposal creation, no suitability
  authority, no execution authority, and no client-publication claims.
  The canonical Lotus Idea seed takes its business as-of date from the platform demo-data contract,
  then captures source observation, evaluation, lifecycle, and queue times after Idea readiness.
  Queue reads always carry the explicit current-run evaluation boundary; neither slow image startup
  nor Idea's example-time default can silently empty the adviser queue. Startup records those ordered
  UTC timestamps and the exact review-ready candidate in
  `output/canonical-front-office/idea-candidate-seed-evidence.json`. Validation reuses the recorded
  queue boundary through Gateway, proves the candidate exactly once, and matches the artifact's run
  ID to the active Idea `/version` build identity. A broad title match, stale artifact, older
  unconverted candidate, or incoherent clock cannot stand in for current-run evidence.
- RFC or mainline certification runs must invoke the canonical startup script with
  `-RequireMainlineSources`. The preflight writes a source-safe provenance manifest and fails
  before Docker, seeding, or screenshots when any canonical participant is dirty or not exactly at
  `origin/main`. Certification startup forces image builds and container recreation, compares
  preflight and post-start source manifests, and binds Lotus Idea runtime `/version` provenance
  before recording the mainline-source posture. Its manifests and Idea capacity-seed evidence are written to a per-run Local AppData
  directory outside checked source worktrees, so generated evidence cannot make the source preflight
  appear dirty. Standard and `-LocalApps` runtime runs remain branch-local development evidence.
  When the shared Workbench checkout is owned by another agent, platform automation may pass an
  isolated Workbench mainline checkout to the same preflight. The override must still identify a
  `lotus-workbench` Git origin, be clean, and point exactly at `origin/main`; a clean checkout of
  another Lotus repository is rejected instead of being labeled as Workbench proof.
- Lotus Idea capacity integration proof must use Idea-owned seed and workload automation after Idea
  and Advise readiness. The validator matches Idea `/version` to the checked-out commit, branch,
  and fresh canonical run identity. Canonical startup therefore rebuilds only the Idea Compose
  project before this proof; a prior reusable Idea image is never relabelled or accepted as the
  current run, and unrelated services are not rebuilt solely for Idea provenance. The proof
  requires the isolated `CAPACITY_SYNTHETIC_PORTFOLIO_001` namespace and accepts exactly one
  report-only downstream-submission probe. Workbench evidence retains artifact paths, SHA-256
  digests, and provenance but excludes conversion-intent identifiers, downstream paths, and
  credentials. Canonical startup binds one per-run local trusted-caller marker to the Idea runtime
  and capacity seed process, while Idea must still send complete synthetic entitlement scope through
  its public API policy for every governed mutation. This is local/dev proof wiring only; it is not
  a production identity provider, session/token-claims authority, endpoint-policy bypass, load,
  soak, production capacity, or feature-support certification.
- RFC-0028 bank-demo proof validation must read the Gateway-backed scenario contract and
  supported-claim register, verify the governed scenario id, proof marker, and claim postures, and
  render `/recommendations?mode=proof` as `advisory.bank_demo_proof`. The screenshot is accepted
  only when Workbench shows blocked client-publication posture without local claim promotion,
  approval, client communication, order, fill, settlement, or OMS claims.
- observability evidence capture writes local non-functional proof packs under
  `output/observability-live/<timestamp>/`
- scale proof writes non-certifying JSON and Markdown evidence under `output/scale-proof/`; accept
  it only when `result=passed`, `certification_posture=engineering_regression_non_certifying`, both
  replicas served baseline and recovery traffic, the removed replica was replaced by a different
  container identity, source persistence survived replica loss, and the explicit non-claims remain
  present
- final visual review should use canonical validated captures, not pre-validation diagnostics

## Canonical live validation coverage

The governed front-office validation flow checks the seeded `PB_SG_GLOBAL_BAL_001` runtime across:

- portfolio summary and detailed surfaces
- performance summary and analysis surfaces
- advisor-brief and risk modes inside the performance experience
- RFC-0024 advisory journey routes and proposal memo/evidence-pack posture through Gateway-backed
  Workbench screens
- RFC-0028 bank-demo proof scenario and supported-claim posture through Gateway-backed Workbench
  screens
- evidence-oriented product validation paths that are part of the current governed runtime
- DPM outcome review, proof pack, command center, portfolio memory, rebalance-wave command center,
  Core candidate-source wave preview/no-caller-portfolio guard, construction alternatives,
  PM operating quality, and PM copilot workspace

When validating active Workbench source changes, use the governed local-app bring-up
`npm run live:stack:up:workbench-local` so `workbench.dev.lotus` serves the current branch while
Gateway and backend Lotus apps remain on the canonical stack. Docker-backed Workbench evidence is
valid for released images, but it must not be used to prove newly changed Workbench panels.
For one-command proof, `npm run live:stack:up:validate` rebuilds Docker-backed service images before
validation. Stale containers can hide new Gateway or Advise routes, render old panel text, and turn
the live validator into evidence for the wrong runtime build. Governed Workbench Compose and
protected CI builds also stamp the exact checkout on the image so Platform cleanup can distinguish
an owned residual image from another checkout. The
[canonical runtime guide](https://github.com/sgajbi/lotus-workbench/blob/main/docs/operations/canonical-front-office-local-runtime.md)
owns the command and fail-closed behavior.
