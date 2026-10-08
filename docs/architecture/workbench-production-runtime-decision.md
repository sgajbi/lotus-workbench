# Workbench Production Runtime And Support Boundary

## Decision status

- Status: accepted baseline; technology-risk certification remains incomplete
- Owner: `lotus-workbench`
- Governed issue: [#612](https://github.com/sgajbi/lotus-workbench/issues/612)
- Reviewed: 2026-10-03
- Next review: 2026-10-14
- Machine-readable policy:
  [`workbench-runtime-support-policy.v1.json`](workbench-runtime-support-policy.v1.json)

This decision records the implemented Workbench runtime boundary and the evidence that can be
claimed today. It is not a statement that a bank has certified the product, and it does not close
the wider dependency, licensing, browser, capacity, identity, availability, or disaster-recovery
work owned by #612.

## Decision

Workbench will use a conservative, supported web application stack with one exact build and CI
runtime, a minimal immutable production container, and a Gateway-first product boundary:

1. Node `22.23.3` and its bundled npm `10.9.9` are the exact CI and container build toolchain.
2. Developers may use the governed Node 22/npm 10 compatibility range; protected CI proves the
   exact release used to produce deployable evidence.
3. Next.js `15.5.27` remains temporarily accepted while it is in Maintenance LTS. Its support
   posture must be reviewed by 2026-10-14. Its two-year upstream maintenance boundary is
   2026-10-21; a major upgrade requires its own compatibility evidence under #624.
4. React `19.1.0` and TypeScript `5.9.3` remain exact-version application foundations.
5. The production image uses the digest-pinned official Debian Bookworm slim Node image, Next
   standalone output, the unprivileged `node` user, and no runtime package-manager toolchain.
6. Workbench owns interaction and presentation. Gateway and the source services continue to own
   financial calculations, persisted workflow state, permissions, and business decisions.
7. Browser automation is explicitly Chromium-only in this tranche. Framework browser floors and
   MDN Baseline are admission guidance, not substitutes for the future enterprise browser and
   assistive-technology matrix.

## Why this stack is retained

Issue [#1128](https://github.com/sgajbi/lotus-workbench/issues/1128) applies compatible security
patches: Next `15.5.27`, sharp `0.35.5`, postcss-selector-parser `7.1.6`, and
source-map-js `1.2.2`. The source-map override fixes both the PostCSS and coverage-tool paths.
The maintained Next ESLint fork retains its independent upstream `15.5.25` provenance.

The 2026-10-03 review checked the primary [Node release schedule](https://nodejs.org/en/about/previous-releases),
[July security release](https://nodejs.org/en/blog/vulnerability/july-2026-security-releases),
[22.23.3 release](https://github.com/nodejs/node/releases/tag/v22.23.3), and
[Next support policy](https://nextjs.org/support-policy). The previous Node 22.23.1 pin predates
the July fixes. The new official Bookworm slim image uses multi-platform index
`sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c`, from
docker-node commit `81f419144a1251854c6d9afb09eaa39928e724e8`. An isolated read-only,
network-disabled qualification ran Node 22.23.3/npm 10.9.9 as UID 1000 and observed
PCRE2 `10.42-1+deb12u1` in the original base qualification. Issue #1126 refreshes
the final runner's exact PCRE2 upgrade to `10.42-1+deb12u2` for CVE-2026-103111;
the immutable base and existing fail-closed upgrade clause remain.

The accountable review owner is `workbench-architecture-maintainers`. Runtime-state ownership and
manifest/lock/source parity remain enforced by the existing validators. Next 15 is Maintenance
LTS, with two years measured from its initial 2024-10-21 release. The owner must complete or
reassess #624's Next 16 compatibility tranche by 2026-10-14 and before the 2026-10-21 boundary.
That tranche must preserve Gateway authority, routing, source qualification, SSR/hydration,
browser controls and image security evidence; a version bump alone is insufficient.

Issue #1110 tracks removal of the inherited Next ESLint / fast-glob / micromatch / braces chain
and GHSA-vfj7-8cjw-p6xm through the maintained development tool below. Full-graph security must be
proved against the changed installed lockfile; production-only audit does not replace that gate.
This support review grants no security exception or release approval. Exact-candidate image
scanning, SBOM, protected main and wider
browser, capacity, identity or bank certification remain separate evidence requirements.

Rollback must retain artifact and deployment identity. The expired, security-old Node 22.23.1
baseline is not an approved production fallback. If the new patch fails qualification, stop
release and keep the relevant gate red until a supported replacement is proven.

The current foundation is composed of mature, documented technologies with large engineering
ecosystems and supported release channels. Retaining it avoids novelty risk and an unnecessary
rewrite while allowing technology-risk evidence to be made deterministic.

That observation is not sufficient procurement evidence by itself. The versioned
[`workbench-dependency-risk-inventory.v1.json`](workbench-dependency-risk-inventory.v1.json) now
records license, stewardship, security channel, lifecycle, criticality, containment,
replaceability, and review ownership for every direct production dependency, including optional
installs and required peers. Its repository-owned validator uses the mature, development-only Ajv engine to
execute the complete JSON Schema and blocks unregistered, misclassified, or unsupported dependency
changes. Review evidence is assigned to the governed functional owner
`workbench-architecture-maintainers`, while HTTPS evidence must use a syntactically valid DNS name
or IP address. #612 remains open for independent bank architecture, cyber, legal, procurement,
accessibility, operations, and measured-scale review.

## Runtime topology and trust boundary

```mermaid
flowchart LR
  Browser[Advisor browser] --> Workbench[Stateless-compatible Next.js container]
  Workbench --> BFF[Same-origin BFF routes]
  BFF --> Gateway[lotus-gateway product boundary]
  Gateway --> Sources[Source-owning Lotus services]
  Sources --> Stores[Service-owned durable state]
```

The browser may keep bounded interaction and query-cache state. It is not the authority for
portfolio calculations, entitlements, approvals, execution, or durable workflow state. Workbench
server routes proxy governed requests to Gateway and must fail closed when required source or
authority evidence is unavailable.

The standalone container does not intentionally own durable business state. This makes the
application tier compatible with replica-based deployment, but it does not prove horizontal-scale
capacity, high availability, failover, session behavior, or production identity. Those claims
require measured multi-replica and failure evidence after the production identity boundary exists.

## Reproducibility and supply-chain controls

The first #612 tranche enforces:

1. exact Node parity across protected workflows and the digest-pinned container;
2. exact npm and Playwright declarations with a lockfile-root runtime contract;
3. immutable `npm ci --no-audit --no-fund` installation, with security auditing retained as a
   separate fail-closed gate;
4. repository-locked Playwright CLI invocation and an explicit Chromium project;
5. exact Next, React, and TypeScript reconciliation against the versioned policy;
6. non-root container execution and exact base-image provenance;
7. parsed active GitHub workflow steps, named Docker-stage ownership, and the runner's final
   effective user, so comments, wrong-stage commands, and superseded directives cannot satisfy the
   control; and
8. a review-expiry check and explicit browser, capacity, horizontal-scale, and identity non-claims.

The existing protected lanes continue to enforce dependency audit, lint, strict TypeScript,
coverage, production build, browser smoke, Docker parity, production-image vulnerability scanning,
and CycloneDX SBOM generation.

## Support and upgrade rule

Production-critical framework or runtime changes require an issue-backed compatibility slice. The
slice must record the support or security reason, primary-source lifecycle evidence, focused
regressions, rollback posture, and exact-main proof. Beta, release-candidate, experimental, or
novelty-driven dependencies are not admitted to a production critical path without an explicit
technology-risk exception.

Node, npm, Next.js, browser floors, and the container digest must be reviewed no later than the
policy's `nextReviewBy` date. The repository gate fails after that date so lifecycle review cannot
silently become stale.

## Adopted And Rejected Enforcement Patterns

Adopted under [#616](https://github.com/sgajbi/lotus-workbench/issues/616):

1. parse workflow YAML into jobs and steps, then bind each exact Node selector and Playwright
   browser-install command to its active step;
2. declare the parser as an exact, lock-backed, development-only quality dependency rather than
   relying on its incidental presence below another tool;
3. read active Dockerfile instructions by named stage and evaluate the final `USER` directive in
   the production runner stage; and
4. preserve token adjacency when Docker escape continuations remove newlines, require the default
   backslash parser escape after normalizing Docker's supported leading UTF-8 BOM, consume `RUN` and
   `COPY` heredoc payloads without interpreting their contents as stage instructions, distinguish
   JSON-form operands from heredoc syntax through one shared parser, and reject
   `ONBUILD` triggers plus `SHELL` overrides throughout
   the governed stage chain; and
5. retain focused mutations for commented, missing, duplicate, wrong-stage, indirect,
   reinterpreted, and superseded proof.

Rejected:

1. global regular-expression counts or string-presence checks, because inactive comments and
   unrelated stages can satisfy them;
2. adding workflow or Docker parsing to the Workbench runtime bundle, because these controls belong
   only to development and CI; and
3. a broad new Docker parsing dependency for the bounded `FROM`, `RUN`, `USER`, `ONBUILD`, `SHELL`,
   and continuation invariants, which would enlarge the quality-tool supply chain without improving
   the governed evidence needed here.

## Maintained development lint tool

Issue [#1110](https://github.com/sgajbi/lotus-workbench/issues/1110) owns the bounded
`@lotus/eslint-plugin-next` 15.5.25-lotus.1 local development package. It retains all 21 published
Next 15.5.25 rules and configurations, replacing only the root-directory resolver with bounded
literal-path lookup. Unsupported globs, malformed values and excessive input fail explicitly.
This removes the resolver's fast-glob/micromatch/braces dependency rather than suppressing its
advisory or removing lint rules. It is an owned fork, not an upstream security release.

`tools/eslint-plugin-next/UPSTREAM-PROVENANCE.json` binds the independently verified npm tarball
SHA512, 52 published-file hashes, immutable release lineage, complete MIT notice and one changed
resolver. Reproducible upstream transpilation is not claimed. From the repository root on Windows
or POSIX, run `npm run quality:next-eslint-fork`; full lint runs this fail-closed provenance and
maintenance guard. Behavioral controls cover all 21 rule ASTs, pages/app links and literal-root
admission/refusal. Production inventory remains scoped to direct runtime dependencies; this
development tool is governed separately by its provenance and full dependency audit.

The accountable owner is `workbench-architecture-maintainers`, with the current implementation
owner responsible for updates. Review upstream advisories before each update and by 2026-10-14;
the guard refuses expired reviews. Next 15 support still ends 2026-10-21. Return to a fixed
supported upstream plugin or supported Next 16 migration only after rule parity and full audit
proof. Protected CI, exact-main acceptance and wiki publication remain delivery requirements.

## Evidence sources

1. [Node.js release lifecycle](https://nodejs.org/en/about/previous-releases)
2. [Node 22.23.3 archive and bundled npm version](https://nodejs.org/en/download/archive/v22.23.3)
3. [Next.js support policy](https://nextjs.org/support-policy)
4. [npm package metadata and `devEngines`](https://docs.npmjs.com/files/package.json/)
5. [Next.js supported browser floors](https://nextjs.org/docs/pages/getting-started/installation#supported-browsers)
6. [MDN Baseline compatibility scope](https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility)
7. [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
8. [Dockerfile instruction semantics](https://docs.docker.com/reference/dockerfile)
9. [Docker multi-stage build semantics](https://docs.docker.com/build/building/multi-stage/)

## Open certification work

The following remain open under #612 and must not be inferred from this decision:

1. independent legal and procurement approval of dependency licenses and third-party terms;
2. enterprise Edge, Firefox, Safari/WebKit, assistive-technology, and managed-browser evidence;
3. documented timeout, retry, cache, graceful-degradation, rollback, and observability decisions;
4. measured Workbench/Gateway load, soak, multi-replica, and failure-isolation evidence;
5. production identity, availability, disaster recovery, and bank architecture/procurement approval.
