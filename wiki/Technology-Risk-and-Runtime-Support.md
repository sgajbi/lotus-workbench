# Technology Risk And Runtime Support

## Current Scope

This page gives bank architecture, cyber, operations, accessibility, and procurement reviewers a
concise view of the Workbench technology baseline. It distinguishes implemented controls from work
that still needs certification under
[`lotus-workbench#612`](https://github.com/sgajbi/lotus-workbench/issues/612).

The current decision is to retain the mature Workbench foundation and make its lifecycle and build
evidence deterministic. This is not a claim that a bank has approved the stack.

## Governed Runtime Baseline

| Concern | Current decision | Evidence posture |
| --- | --- | --- |
| Build and server runtime | Node `22.23.3` Maintenance LTS | Exact declarations and isolated official-image qualification; protected release proof required |
| Package manager | npm `10.9.9`, bundled with the governed Node release | Exact declaration; npm 10 compatibility range for developers |
| Application framework | Next.js `15.5.27` Maintenance LTS | Review by 2026-10-14; upstream maintenance boundary 2026-10-21; #624 compatibility tranche open |
| UI foundation | React `19.1.0` and TypeScript `5.9.3` | Exact manifest and policy reconciliation |
| Production container | Official Debian Bookworm slim Node image | Immutable digest, standalone output, non-root runtime |
| Browser automation | Playwright `1.58.2`, Chromium project | Protected smoke evidence; wider browser certification open |
| Typography delivery | Repo-governed IBM Plex Sans, Cormorant Garamond, and IBM Plex Mono WOFF2 assets through Next local fonts | Same-origin only; SIL OFL texts, upstream release/commit provenance, and SHA-256 checksums enforced |
| Product boundary | Workbench BFF to `lotus-gateway` | Browser owns no financial calculation or durable workflow authority |
| Direct dependency admission | 16 exact stable production dependencies | Blocking regular/optional/required-peer manifest and matching lock-section reconciliation; no current exceptions |
| Scale validation dependency | Official NGINX stable `1.30.3` Alpine `3.23` slim image | Digest-pinned, separately scanned, and used only by the hermetic regression harness |

The versioned source is
[`workbench-runtime-support-policy.v1.json`](https://github.com/sgajbi/lotus-workbench/blob/main/docs/architecture/workbench-runtime-support-policy.v1.json).
The architecture decision is
[`workbench-production-runtime-decision.md`](https://github.com/sgajbi/lotus-workbench/blob/main/docs/architecture/workbench-production-runtime-decision.md).
The direct dependency source is
[`workbench-dependency-risk-inventory.v1.json`](https://github.com/sgajbi/lotus-workbench/blob/main/docs/architecture/workbench-dependency-risk-inventory.v1.json).

The 2026-10-03 substantive review found that Node 22.23.1 predates the
[July security fixes](https://nodejs.org/en/blog/vulnerability/july-2026-security-releases).
The replacement official image is pinned to multi-platform index
`sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c`, with
docker-node source `81f419144a1251854c6d9afb09eaa39928e724e8`. A network-disabled,
read-only qualification confirmed Node 22.23.3/npm 10.9.9, UID 1000 and the existing
PCRE2 security-package version. This is runtime identity evidence, not an image scan or release approval.

`workbench-architecture-maintainers` owns the review and #624's Next 16 compatibility follow-up.
The 2026-10-14 decision deadline precedes Next 15's inferred 2026-10-21 support boundary.
Routing, Gateway authority, SSR/hydration, source qualification and browser/image controls must
survive that migration. If the new runtime fails qualification, stop release; the expired,
security-old Node 22.23.1 baseline is not an accepted production rollback.

[#1110](https://github.com/sgajbi/lotus-workbench/issues/1110) owns removal of GHSA-vfj7-8cjw-p6xm
from the inherited Next ESLint dependency chain through the maintained tool below. The changed
installed graph must pass full audit; image scan/SBOM, protected main and wiki publication remain
required. No review-date extension, supported major line or fixture test waives those controls.

Issue [#1128](https://github.com/sgajbi/lotus-workbench/issues/1128) pins compatible security
patches for Next `15.5.27`, sharp `0.35.5`, postcss-selector-parser `7.1.6`, and
source-map-js `1.2.2`. The source-map override covers both PostCSS and coverage tooling.
The maintained Next ESLint fork keeps its independent upstream `15.5.25` provenance.

Issue [#1130](https://github.com/sgajbi/lotus-workbench/issues/1130) upgrades the runner's exact
`perl-base` package to `5.36.0-7+deb12u4` for the protected image gate's seven fixable
HIGH/CRITICAL findings. The existing fail-closed runner clause keeps the exact PCRE2 pin
and immutable base; it admits these two package upgrades rather than a broad OS upgrade.
Debian's [DLA-4821-1](https://security-tracker.debian.org/tracker/DLA-4821-1) records the Perl fix.

## Governed Typography Delivery

Workbench does not contact a public font service at runtime. The browser receives the governed
WOFF2 files from the same Workbench origin through Next.js local-font output. This removes an
undeclared workstation egress/privacy path, avoids public-network availability changing first
render, and supports a deployment policy that does not require Google Fonts exceptions.

`config/font-assets.json` pins each semantic role to an upstream repository, release tag, immutable
commit, SIL OFL license file, and SHA-256 checksum. `npm run quality:font-assets` rejects missing or
altered assets, ungoverned formats, absent roles, loader drift, or a production-source reference to
`fonts.googleapis.com` or `fonts.gstatic.com`. Narrow repository attributes preserve binary font
bytes and LF-stable publisher-license bytes across Windows and Linux. Optimized-browser proof checks
that font responses
are successful same-origin WOFF2 resources and that desktop and compact Workbench geometry does not
overflow.

This is controlled open-font distribution evidence, not an independent legal opinion or bank
procurement approval. Font replacement remains an issue-backed design, accessibility, payload,
license, fallback, and visual-regression decision.

The operational Workbench face is IBM Plex Sans in static 400, 500, and 600 weights. Issue #829
selected it through a reproducible optimized-browser comparison with pinned Inter 4.1 assets at
1440, 1024, 768, and 519 pixels. Both candidates passed containment and responsive checks; IBM
Plex Sans reduced the operational asset set from 352,240 bytes to 196,820 bytes and used about 5%
less width for the longest tested Portfolio currency value. `npm run test:e2e:typography:compare`
reproduces the comparison. `npm run quality:font-assets` independently protects the production
asset manifest, provenance, license, checksums, loader coverage, and same-origin posture.

## Direct Dependency Architecture

| Boundary | Governed dependencies | Containment and exit posture |
| --- | --- | --- |
| Framework core | Next.js, React, React DOM | Strategic coupling; replacement requires an architecture RFC and staged product migration |
| Design system | MUI, the official MUI Next.js adapter, and Emotion | Business composition stays in Workbench components; the root adapter keeps streamed server styles in the document head; migrate through the design-system facade |
| Server state | TanStack React Query | Query keys, source refresh, and failure rules stay in feature-owned hooks over Gateway contracts |
| Dense records | AG Grid Community and React adapter | Grid registration and behavior stay behind portfolio grid frames and design-system utilities |
| Analytics charts | Apache ECharts and React adapter | Rendering stays behind `WorkbenchECharts`; financial models and labels remain Workbench-owned |
| Forms | React Hook Form and resolvers | Limited to Proposal simulation and paired with repository-owned validation rules |
| Contract validation | Zod | Feature contract modules own schemas and failure posture at external boundaries |

All current entries are `approved_default`, use exact stable versions, and carry MIT or Apache-2.0
package evidence. There are no dependency exceptions in the current inventory. This is engineering
and traceability evidence, not an independent legal opinion or procurement approval.

The governed functional review owner is `workbench-architecture-maintainers`. Evidence locations
must be valid HTTPS URLs with a usable host; prefix-shaped placeholders do not satisfy admission.

## Why This Reduces Bank Technology Risk

1. The stack uses supported, well-documented technologies with broad engineering ecosystems rather
   than experimental framework channels.
2. CI and the production image use the same exact Node patch instead of a moving major-version
   selector.
3. Dependency installation is lockfile-immutable and separate from explicit vulnerability gates.
4. The runtime image is minimal, non-root, health-checked, scanned, and accompanied by a CycloneDX
   SBOM in protected lanes.
5. Domain authority stays in Gateway and source-owning services, limiting browser and application
   server coupling.
6. The policy expires on a fixed date, preventing Maintenance-LTS software from remaining accepted
   by inertia.
7. A new direct production library, including an optional package or non-optional peer installed by
   the production `npm ci`, cannot pass protected lanes until its license, stewardship, stable
   lifecycle, business purpose, architecture containment, exit path, owner, and review date are
   recorded in the same issue-backed change.
8. The root App Router boundary uses MUI's supported server-rendering cache provider; production
   browser proof rejects Emotion styles in the document body, blanket hydration suppression, and
   unexpected console or page errors.
9. Font assets are versioned with the product, checksummed, licensed, and served from the Workbench
   origin; advisor rendering does not depend on a public font endpoint.

## Production And Scaling Posture

Next standalone output, source-owned durable business state, closed runtime-state governance, and
deterministic deployment identity make the Workbench container suitable for a replicated
application tier. `/api/health/live` is process-only; `/api/health/ready` validates build and runtime
configuration without turning a downstream outage into fabricated application success.
Production-image builds require an explicit deployment identity, and readiness rejects a runtime
identity that differs from the value embedded in the immutable build.

The validation balancer's immutable NGINX base requires separate vendor package upgrades:
OpenSSL `libcrypto3`/`libssl3` `3.5.9-r0` and, under #1110, Alpine v3.23 PCRE2 `10.49-r0`.
The protected PR #1112 scan rejected PCRE2 `10.47-r0` for four fixable HIGH findings:
`CVE-2026-103111`, `CVE-2026-86145`, `CVE-2026-89157`, and `CVE-2026-89161`.
[Alpine's fixed package](https://pkgs.alpinelinux.org/package/v3.23/main/x86_64/pcre2)
comes from packaging commit `d3daff575f2cf4da02cba798b41436b60d843444`.
Retire each pin only when the immutable base contains its fixed version; remove the RUN
only after both independent OpenSSL and PCRE2 conditions hold. The balancer remains
subject to the separate blocking fixable HIGH/CRITICAL scan before scale proof.

The hermetic `npm run scale:proof` regression has now demonstrated two identical production-image
replicas behind a no-affinity, least-connections balancer; cross-replica source persistence; bounded
operation while one replica is stopped and removed; changed container identity after disposable
replacement; and distribution after recovery. It records latency, errors, upstream distribution,
image identity, replacement-container identity, concurrent per-phase container CPU and memory, and
the host Node load generator's per-phase CPU and RSS under `output/scale-proof/`.
Protected PR and main lanes run the proof against the same Workbench image they scan. They also
build and separately scan the validation-only NGINX balancer from an immutable official base with
exact vendor-fixed security packages, record the resulting local image identity, and upload the
machine-readable proof.

This is an engineering regression, not capacity or availability certification. Workbench does not
claim production load or soak capacity, high availability, disaster recovery, multi-region
operation, production identity, or a bank-approved deployment topology. The NGINX container is a
validation dependency, not a production orchestration prescription. #612 remains open until those
claims have measured evidence or explicit accepted-risk ownership.

## Deterministic Controls

`npm run quality:runtime-support` fails when the repository drifts across package metadata,
lockfile runtime ranges, exact CI Node versions, container provenance, npm/Playwright declarations,
canonical install commands, explicit Chromium projects, or the review date. It reads active
workflow steps and named Docker stages rather than accepting matching text in comments, unrelated
stages, or superseded instructions. Docker escape continuations retain token adjacency, alternate
parser escape directives fail closed after leading UTF-8 BOM normalization, `RUN` and `COPY` heredoc
payloads remain payload rather than stage instructions, JSON-form operands cannot masquerade as
heredoc operators, and governed stages reject inherited `ONBUILD` triggers and `SHELL` overrides that could reinterpret or
indirectly add commands. `npm run lint` invokes this control, so Feature, PR, Main, and Docker-parity
quality lanes inherit it.

`npm run quality:runtime-state` inventories every detected module-scope mutable holder and fails on
unreviewed server cache, Server Action, Next data-cache, ISR, revalidation, forced-cache, or rolling
deployment identity behavior. The inventory permits only bounded, non-authoritative browser state,
immutable lookup state, idempotent initialization, and per-instance telemetry. Workbench analytics
telemetry has explicit series and diagnostic bounds; fleet aggregation belongs to the platform
metrics stack.

Existing gates also cover dependency vulnerabilities, lint, TypeScript, coverage, production
builds, bundle budgets, Playwright smoke, Docker parity, container vulnerabilities, and SBOM
publication. See [Validation and CI](Validation-and-CI) for the lane evidence map.

`npm run quality:dependency-risk` is the blocking admission control for direct production
dependencies. It reconciles regular, optional, and required-peer manifest declarations to the same
lockfile-root section, resolved lock entry, executable JSON Schema, and inventory; peers explicitly
marked optional remain outside the direct-install set. The exact development-only Ajv
tool executes the complete schema rather than a partial local interpretation. The control rejects
missing or extra entries, duplicate or drifted versions, prerelease status, license ambiguity,
unsupported lifecycle, missing stewardship or security channels, ownerless
purpose/containment/exit posture, expired reviews, prohibited state, and incomplete exceptions.
Transitive dependencies remain governed through the exact lockfile, npm audits, image scan, and
SBOM rather than duplicated as hand-maintained inventory rows.

## Explicit Non-Claims

This baseline does not certify:

1. Firefox, Safari/WebKit, Edge, older managed browsers, or assistive-technology combinations;
2. production load, soak, saturation capacity, high availability, disaster recovery, or
   multi-region operation;
3. production identity, IdP, session, or token-claim integration;
4. independent legal approval of license compatibility or third-party contractual terms;
5. bank architecture, cyber, accessibility, operations, or procurement approval.

## Next Review And Escalation

The runtime policy must be reviewed by 2026-10-14 because Next.js 15 is in Maintenance LTS. The
broader dependency inventory must be reviewed by 2026-11-10; each dependency can carry an earlier
date where its lifecycle requires it. Any security advisory, end-of-support change, critical
dependency abandonment, license change, or browser policy change requires immediate issue-backed
review rather than waiting for the date.

Remaining certification work and acceptance evidence belong on
[`lotus-workbench#612`](https://github.com/sgajbi/lotus-workbench/issues/612), keeping GitHub as the
durable execution record.

## Maintained Development Lint Tool

The development lint package `@lotus/eslint-plugin-next` 15.5.25-lotus.1 is a maintained local fork
under [#1110](https://github.com/sgajbi/lotus-workbench/issues/1110). All 21 published rules and
configurations remain intact; only the directory resolver uses bounded literal filesystem paths.
Globs, malformed settings and oversized inputs fail explicitly. The fast-glob/micromatch/braces
chain is removed rather than waived. This package is not an official upstream patch.

The repo-authored provenance manifest records independently verified npm SHA512, published file
hashes, immutable source/license lineage and the one resolver change. Full upstream transpilation
reproducibility is not claimed. From the Workbench repository root on Windows or POSIX, run
`npm run quality:next-eslint-fork`; full lint runs that guard. The owner is
`workbench-architecture-maintainers`, with review due 2026-10-14 and Next 15 support ending
2026-10-21. A fixed supported upstream artifact or supported Next 16 migration is the exit trigger,
subject to preserved rule behavior and full audit proof. Image scan/SBOM evidence and development
dependency audit are separate controls; protected CI and exact-main acceptance are still required.

## Primary Sources

1. [Node.js release lifecycle](https://nodejs.org/en/about/previous-releases)
2. [Node 22.23.3 and bundled npm](https://nodejs.org/en/download/archive/v22.23.3)
3. [Next.js support policy](https://nextjs.org/support-policy)
4. [Next.js local font documentation](https://nextjs.org/docs/app/api-reference/components/font)
5. [IBM Plex releases](https://github.com/IBM/plex/releases)
6. [Cormorant releases](https://github.com/CatharsisFonts/Cormorant/releases)
7. [Inter 4.1 comparison release](https://github.com/rsms/inter/releases/tag/v4.1)
8. [npm package metadata controls](https://docs.npmjs.com/files/package.json/)
9. [Next.js browser floors](https://nextjs.org/docs/pages/getting-started/installation#supported-browsers)
10. [MDN Baseline scope](https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility)
11. [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
12. [Dockerfile reference](https://docs.docker.com/reference/dockerfile)
13. [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
14. [Lotus platform technology-governance policy](https://github.com/sgajbi/lotus-platform/blob/2868348d289fc685ecf5a218b6c73256ac3a7742/platform-contracts/technology-governance/lotus-technology-governance-policy.v1.json)
15. [OpenSSF dependency selection guidance](https://best.openssf.org/Concise-Guide-for-Developing-More-Secure-Software)
16. [SPDX license expressions](https://spdx.github.io/spdx-spec/v2.3/SPDX-license-expressions/)
17. [NGINX HTTP load-balancing guidance](https://nginx.org/en/docs/http/load_balancing.html)
18. [Official NGINX container image](https://hub.docker.com/_/nginx)
19. [MUI Next.js integration](https://mui.com/material-ui/integrations/nextjs/)
20. [Next.js hydration-error guidance](https://nextjs.org/docs/messages/react-hydration-error)
21. [React hydrateRoot guidance](https://react.dev/reference/react-dom/client/hydrateRoot)
