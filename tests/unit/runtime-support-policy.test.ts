import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateRuntimeSupportPolicy } from "../../scripts/quality/check-runtime-support-policy.mjs";

const root = join(__dirname, "..", "..");

function loadEvidence() {
  const policy = JSON.parse(
    readFileSync(
      join(root, "docs/architecture/workbench-runtime-support-policy.v1.json"),
      "utf8"
    )
  );

  return {
    packageJson: JSON.parse(readFileSync(join(root, "package.json"), "utf8")),
    packageLock: JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8")),
    policy,
    dockerfile: readFileSync(join(root, "Dockerfile"), "utf8"),
    makefile: readFileSync(join(root, "Makefile"), "utf8"),
    playwrightConfig: readFileSync(join(root, "playwright.config.ts"), "utf8"),
    livePlaywrightConfig: readFileSync(join(root, "playwright.live.config.ts"), "utf8"),
    workflowSources: Object.fromEntries(
      ["feature-lane.yml", "pr-merge-gate.yml", "main-releasability.yml"].map((name) => {
        const path = `.github/workflows/${name}`;
        return [path, readFileSync(join(root, path), "utf8")];
      })
    ),
    execution: {
      enforceExact: false,
      nodeVersion: "22.15.0",
      npmVersion: "10.9.2",
    },
    today: policy.reviewedOn,
  };
}

describe("runtime support policy", () => {
  it("keeps package, container, workflow, framework, and browser posture aligned", () => {
    expect(validateRuntimeSupportPolicy(loadEvidence())).toEqual([]);
  });

  it("rejects package and container runtime drift", () => {
    const evidence = loadEvidence();
    evidence.packageJson.engines.node = ">=24 <25";
    evidence.dockerfile = evidence.dockerfile.replace("node:22.23.1", "node:24.1.0");

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Node engines range"),
        expect.stringContaining("container base image"),
      ])
    );
  });

  describe.each([
    ["LF", "\n"],
    ["CRLF", "\r\n"],
  ])("%s Dockerfile fixture", (_lineEndingName, lineEnding) => {
    it.each([
      [
        "a mutable deployment-id default",
        (dockerfile: string) =>
          dockerfile.replace(
            /^ARG WORKBENCH_DEPLOYMENT_ID\r?\n/m,
            `ARG WORKBENCH_DEPLOYMENT_ID=local-development${lineEnding}`,
          ),
        "without a default",
      ],
      [
        "a builder that does not fail closed",
        (dockerfile: string) =>
          dockerfile.replace(
            'RUN test -n "$WORKBENCH_DEPLOYMENT_ID" && npm run build',
            "RUN npm run build",
          ),
        "builder must require",
      ],
      [
        "a runner that drops deployment identity",
        (dockerfile: string) =>
          dockerfile.replace(
            /FROM ci-base AS runner\r?\nWORKDIR \/app\r?\nARG WORKBENCH_DEPLOYMENT_ID\r?\n/,
            `FROM ci-base AS runner${lineEnding}WORKDIR /app${lineEnding}`,
          ),
        "runner must retain",
      ],
    ])("rejects %s", (_name, mutate, expectedFailure) => {
      const evidence = loadEvidence();
      evidence.dockerfile = evidence.dockerfile.replace(/\r?\n/g, lineEnding);
      const originalDockerfile = evidence.dockerfile;
      evidence.dockerfile = mutate(evidence.dockerfile);

      expect(evidence.dockerfile).not.toBe(originalDockerfile);
      expect(validateRuntimeSupportPolicy(evidence)).toEqual(
        expect.arrayContaining([expect.stringContaining(expectedFailure)]),
      );
    });
  });

  it("rejects CI runtime and non-root container drift", () => {
    const evidence = loadEvidence();
    evidence.workflowSources[".github/workflows/feature-lane.yml"] += [
      "",
      "  unsupported-runtime-proof:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: actions/setup-node@v6",
      '        with: { node-version: "22" }',
    ].join("\n");
    evidence.dockerfile = evidence.dockerfile.replace("USER node", "USER root");

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("feature-lane.yml must use Node 22.23.1"),
        expect.stringContaining("execute as node"),
      ])
    );
  });

  it("binds the exact runtime selector to each setup-node step", () => {
    const evidence = loadEvidence();
    const workflow = evidence.workflowSources[".github/workflows/feature-lane.yml"];
    evidence.workflowSources[".github/workflows/feature-lane.yml"] = workflow
      .replace(
        "      - uses: actions/checkout@v6",
        [
          "      - uses: actions/checkout@v6",
          "        with:",
          '          node-version: "22.23.1"',
        ].join("\n")
      )
      .replace(
        /(- uses: actions\/setup-node@v6\r?\n\s+with:\r?\n)\s+node-version: "22\.23\.1"\r?\n/,
        "$1"
      );

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("feature-lane.yml must use Node 22.23.1"),
      ])
    );
  });

  it.each(["if: false", "continue-on-error: true"])(
    "rejects a setup-node step governed by %s",
    (control) => {
      const evidence = loadEvidence();
      evidence.workflowSources[".github/workflows/feature-lane.yml"] = evidence.workflowSources[
        ".github/workflows/feature-lane.yml"
      ].replace(
        "      - uses: actions/setup-node@v6",
        `      - uses: actions/setup-node@v6\n        ${control}`
      );

      expect(validateRuntimeSupportPolicy(evidence)).toEqual(
        expect.arrayContaining([
          expect.stringContaining("feature-lane.yml must use Node 22.23.1"),
        ])
      );
    }
  );

  it("rejects setup-node inside a conditional job", () => {
    const evidence = loadEvidence();
    evidence.workflowSources[".github/workflows/feature-lane.yml"] = evidence.workflowSources[
      ".github/workflows/feature-lane.yml"
    ].replace(/  quality-gate:\r?\n/, "  quality-gate:\n    if: false\n");

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("feature-lane.yml must use Node 22.23.1"),
      ])
    );
  });

  it("requires governed Node setup in every job that executes repository Node commands", () => {
    const evidence = loadEvidence();
    evidence.workflowSources[".github/workflows/pr-merge-gate.yml"] = evidence.workflowSources[
      ".github/workflows/pr-merge-gate.yml"
    ].replace(
      /      - uses: actions\/setup-node@v6\r?\n        with:\r?\n          node-version: "22\.23\.1"\r?\n          cache: "npm"\r?\n/,
      ""
    );

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("before repository Node commands in every Node-executing job"),
      ])
    );
  });

  it("ignores commented workflow selectors", () => {
    const evidence = loadEvidence();
    evidence.workflowSources[".github/workflows/feature-lane.yml"] = evidence.workflowSources[
      ".github/workflows/feature-lane.yml"
    ].replace('          node-version: "22.23.1"', '          # node-version: "22.23.1"');

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("feature-lane.yml must use Node 22.23.1"),
      ])
    );
  });

  it("fails closed when a workflow cannot be parsed", () => {
    const evidence = loadEvidence();
    evidence.workflowSources[".github/workflows/feature-lane.yml"] = "jobs:\n  quality: [";

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("feature-lane.yml must be valid YAML"),
      ])
    );
  });

  it("rejects the wrong executing CI toolchain", () => {
    const evidence = loadEvidence();
    evidence.execution = {
      enforceExact: true,
      nodeVersion: "22.22.0",
      npmVersion: "10.9.2",
    };

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("executing Node version"),
        expect.stringContaining("executing npm version"),
      ])
    );
  });

  it("rejects lockfile, install, and browser-tool drift", () => {
    const evidence = loadEvidence();
    evidence.packageLock.packages[""].engines.node = ">=24 <25";
    evidence.packageJson.devDependencies["@playwright/test"] = "^1.58.2";
    evidence.packageJson.devDependencies.yaml = "^2.9.0";
    evidence.packageLock.packages[""].devDependencies.yaml = "^2.9.0";
    evidence.makefile = evidence.makefile.replace(
      "\tnpm ci --no-audit --no-fund",
      "\tnpm install"
    );
    evidence.workflowSources[".github/workflows/pr-merge-gate.yml"] = evidence.workflowSources[
      ".github/workflows/pr-merge-gate.yml"
    ].replace(
      "node node_modules/playwright/cli.js install chromium",
      "npx playwright install chromium"
    );

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("lockfile Node engines range"),
        expect.stringContaining("Playwright version"),
        expect.stringContaining("workflow YAML parser version"),
        expect.stringContaining("lockfile workflow YAML parser version"),
        expect.stringContaining("immutable npm ci"),
        expect.stringContaining("repository-locked CLI"),
      ])
    );
  });

  it("rejects an implicit browser family or mutable container install", () => {
    const evidence = loadEvidence();
    evidence.playwrightConfig = evidence.playwrightConfig.replace(
      'projects: [{ name: "chromium", use: { browserName: "chromium" } }],',
      ""
    );
    evidence.dockerfile = evidence.dockerfile.replace(
      "RUN npm ci --no-audit --no-fund",
      "RUN npm install"
    );

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("governed Chromium browser project"),
        expect.stringContaining("dependency install across all stages"),
      ])
    );
  });

  it("binds browser proof to the Playwright default export", () => {
    const deadDeclaration = loadEvidence();
    deadDeclaration.playwrightConfig = [
      'import { defineConfig } from "@playwright/test";',
      'const unused = defineConfig({ projects: [{ name: "chromium", use: { browserName: "chromium" } }] });',
      "export default {};",
    ].join("\n");
    const localImpostor = loadEvidence();
    localImpostor.playwrightConfig = [
      "const defineConfig = (value: unknown) => value;",
      'export default defineConfig({ projects: [{ name: "chromium", use: { browserName: "chromium" } }] });',
    ].join("\n");
    const overridingSpread = loadEvidence();
    overridingSpread.playwrightConfig = [
      'import { defineConfig } from "@playwright/test";',
      "const replacement = { projects: [] };",
      "export default defineConfig({",
      '  projects: [{ name: "chromium", use: { browserName: "chromium" } }],',
      "  ...replacement,",
      "});",
    ].join("\n");

    expect(validateRuntimeSupportPolicy(deadDeclaration)).toEqual(
      expect.arrayContaining([expect.stringContaining("governed Chromium browser project")])
    );
    expect(validateRuntimeSupportPolicy(localImpostor)).toEqual(
      expect.arrayContaining([expect.stringContaining("governed Chromium browser project")])
    );
    expect(validateRuntimeSupportPolicy(overridingSpread)).toEqual(
      expect.arrayContaining([expect.stringContaining("governed Chromium browser project")])
    );
  });

  it("supports a default-exported top-level Playwright configuration declaration", () => {
    const evidence = loadEvidence();
    evidence.playwrightConfig = evidence.playwrightConfig
      .replace("export default defineConfig({", "const config = defineConfig({")
      .replace(/\}\);\s*$/, "});\n\nexport default config;\n");

    expect(validateRuntimeSupportPolicy(evidence)).toEqual([]);
  });

  it("ignores commented browser-project and browser-install evidence", () => {
    const configEvidence = loadEvidence();
    configEvidence.playwrightConfig = configEvidence.playwrightConfig.replace(
      '  projects: [{ name: "chromium", use: { browserName: "chromium" } }],',
      '  // projects: [{ name: "chromium", use: { browserName: "chromium" } }],'
    );
    const workflowEvidence = loadEvidence();
    workflowEvidence.workflowSources[".github/workflows/pr-merge-gate.yml"] =
      workflowEvidence.workflowSources[".github/workflows/pr-merge-gate.yml"].replace(
        "        run: node node_modules/playwright/cli.js install chromium",
        "        # run: node node_modules/playwright/cli.js install chromium"
      );

    expect(validateRuntimeSupportPolicy(configEvidence)).toEqual(
      expect.arrayContaining([expect.stringContaining("governed Chromium browser project")])
    );
    expect(validateRuntimeSupportPolicy(workflowEvidence)).toEqual(
      expect.arrayContaining([expect.stringContaining("repository-locked CLI")])
    );
  });

  it("rejects conditional or competing browser-install evidence", () => {
    const conditionalEvidence = loadEvidence();
    conditionalEvidence.workflowSources[".github/workflows/pr-merge-gate.yml"] =
      conditionalEvidence.workflowSources[".github/workflows/pr-merge-gate.yml"].replace(
        "        run: node node_modules/playwright/cli.js install chromium",
        [
          "        if: false",
          "        run: node node_modules/playwright/cli.js install chromium",
        ].join("\n")
      );
    const competingEvidence = loadEvidence();
    competingEvidence.workflowSources[".github/workflows/pr-merge-gate.yml"] =
      competingEvidence.workflowSources[".github/workflows/pr-merge-gate.yml"].replace(
        "      - name: Run Playwright Smoke",
        [
          "      - name: Mutable browser install",
          "        run: npx playwright install chromium",
          "      - name: Run Playwright Smoke",
        ].join("\n")
      );
    const conditionalJobEvidence = loadEvidence();
    conditionalJobEvidence.workflowSources[".github/workflows/pr-merge-gate.yml"] =
      conditionalJobEvidence.workflowSources[".github/workflows/pr-merge-gate.yml"].replace(
        /  e2e-smoke:\r?\n    name: PR Merge Gate \/ Fixture-Free Playwright Smoke/,
        [
          "  e2e-smoke:",
          "    if: false",
          "    name: PR Merge Gate / Fixture-Free Playwright Smoke",
        ].join("\n")
      );
    const ignoredFailure = loadEvidence();
    ignoredFailure.workflowSources[".github/workflows/pr-merge-gate.yml"] =
      ignoredFailure.workflowSources[".github/workflows/pr-merge-gate.yml"].replace(
        "        run: node node_modules/playwright/cli.js install chromium",
        [
          "        continue-on-error: true",
          "        run: node node_modules/playwright/cli.js install chromium",
        ].join("\n")
      );

    expect(validateRuntimeSupportPolicy(conditionalEvidence)).toEqual(
      expect.arrayContaining([expect.stringContaining("same unconditional job")])
    );
    expect(validateRuntimeSupportPolicy(competingEvidence)).toEqual(
      expect.arrayContaining([expect.stringContaining("same unconditional job")])
    );
    expect(validateRuntimeSupportPolicy(conditionalJobEvidence)).toEqual(
      expect.arrayContaining([expect.stringContaining("same unconditional job")])
    );
    expect(validateRuntimeSupportPolicy(ignoredFailure)).toEqual(
      expect.arrayContaining([expect.stringContaining("same unconditional job")])
    );
  });

  it("binds each browser install to its proof job and execution order", () => {
    const lateInstall = loadEvidence();
    lateInstall.workflowSources[".github/workflows/pr-merge-gate.yml"] =
      lateInstall.workflowSources[".github/workflows/pr-merge-gate.yml"]
        .replace(
          /      - name: Install Playwright Browsers\r?\n        run: node node_modules\/playwright\/cli\.js install chromium\r?\n/,
          "",
        )
        .replace(
          "        run: make test-e2e",
          [
            "        run: make test-e2e",
            "      - name: Install Playwright Browsers",
            "        run: node node_modules/playwright/cli.js install chromium",
          ].join("\n"),
        );
    const wrongJob = loadEvidence();
    wrongJob.workflowSources[".github/workflows/pr-merge-gate.yml"] = wrongJob.workflowSources[
      ".github/workflows/pr-merge-gate.yml"
    ]
      .replace(
        /      - name: Install Playwright Browsers\r?\n        run: node node_modules\/playwright\/cli\.js install chromium\r?\n/,
        ""
      )
      .replace(
        "      - uses: actions/checkout@v6",
        [
          "      - uses: actions/checkout@v6",
          "      - name: Install Playwright Browsers",
          "        run: node node_modules/playwright/cli.js install chromium",
        ].join("\n")
      );

    expect(validateRuntimeSupportPolicy(lateInstall)).toEqual(
      expect.arrayContaining([expect.stringContaining("before browser proof runs")])
    );
    expect(validateRuntimeSupportPolicy(wrongJob)).toEqual(
      expect.arrayContaining([expect.stringContaining("same unconditional job")])
    );
  });

  it.each([
    [
      "step",
      "        run: node node_modules/playwright/cli.js install chromium",
      [
        "        shell: cat {0}",
        "        run: node node_modules/playwright/cli.js install chromium",
      ].join("\n"),
    ],
    [
      "job",
      /(  e2e-smoke:\r?\n    name: PR Merge Gate \/ Fixture-Free Playwright Smoke\r?\n    needs: \[quality-gate\]\r?\n    runs-on: ubuntu-latest\r?\n    timeout-minutes: 30)/,
      [
        "$1",
        "    defaults:",
        "      run:",
        "        shell: cat {0}",
      ].join("\n"),
    ],
    [
      "workflow",
      "jobs:",
      ["defaults:", "  run:", "    shell: cat {0}", "jobs:"].join("\n"),
    ],
  ])("rejects a non-executing %s-level smoke shell", (_scope, target, replacement) => {
    const evidence = loadEvidence();
    evidence.workflowSources[".github/workflows/pr-merge-gate.yml"] = evidence.workflowSources[
      ".github/workflows/pr-merge-gate.yml"
    ].replace(target, replacement);

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([expect.stringContaining("governed executing shell")])
    );
  });

  it.each(["bash", "sh"])("accepts the governed explicit %s smoke shell", (shell) => {
    const evidence = loadEvidence();
    evidence.workflowSources[".github/workflows/pr-merge-gate.yml"] = evidence.workflowSources[
      ".github/workflows/pr-merge-gate.yml"
    ].replace(
      "        run: node node_modules/playwright/cli.js install chromium",
      [
        `        shell: ${shell}`,
        "        run: node node_modules/playwright/cli.js install chromium",
      ].join("\n")
    );

    expect(validateRuntimeSupportPolicy(evidence)).toEqual([]);
  });

  it("ignores commented container base-image evidence", () => {
    const evidence = loadEvidence();
    evidence.dockerfile = evidence.dockerfile.replace(
      "ARG NODE_BASE_IMAGE=",
      "# ARG NODE_BASE_IMAGE="
    );

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([expect.stringContaining("container base image")])
    );
  });

  it("binds every governed stage to the actual immutable base stage", () => {
    const deadArgument = loadEvidence();
    deadArgument.dockerfile = deadArgument.dockerfile.replace(
      "FROM ${NODE_BASE_IMAGE} AS ci-base",
      "FROM node:24.1.0-bookworm-slim AS ci-base"
    );
    const detachedBuilder = loadEvidence();
    detachedBuilder.dockerfile = detachedBuilder.dockerfile.replace(
      "FROM ci-base AS builder",
      "FROM node:24.1.0-bookworm-slim AS builder"
    );

    expect(validateRuntimeSupportPolicy(deadArgument)).toEqual(
      expect.arrayContaining([expect.stringContaining("consumes ${NODE_BASE_IMAGE}")])
    );
    expect(validateRuntimeSupportPolicy(detachedBuilder)).toEqual(
      expect.arrayContaining([expect.stringContaining("builder stage must descend")])
    );
  });

  it("binds immutable installation to the named dependency stage", () => {
    const wrongStage = loadEvidence();
    wrongStage.dockerfile = wrongStage.dockerfile
      .replace("RUN npm ci --no-audit --no-fund", "RUN npm install")
      .replace(
        "FROM ci-base AS builder",
        "FROM ci-base AS builder\nRUN npm ci --no-audit --no-fund"
      );
    const commentedEvidence = loadEvidence();
    commentedEvidence.dockerfile = commentedEvidence.dockerfile.replace(
      "RUN npm ci --no-audit --no-fund",
      "RUN npm install\n# RUN npm ci --no-audit --no-fund"
    );

    expect(validateRuntimeSupportPolicy(wrongStage)).toEqual(
      expect.arrayContaining([expect.stringContaining("exactly one dependency install")])
    );
    expect(validateRuntimeSupportPolicy(commentedEvidence)).toEqual(
      expect.arrayContaining([expect.stringContaining("exactly one dependency install")])
    );
  });

  it("rejects competing installs and a builder detached from governed dependencies", () => {
    const hiddenInstall = loadEvidence();
    hiddenInstall.dockerfile = hiddenInstall.dockerfile.replace(
      "RUN npm ci --no-audit --no-fund",
      "RUN npm ci --no-audit --no-fund\nRUN cd /app && npm install"
    );
    const detachedBuilder = loadEvidence();
    detachedBuilder.dockerfile = detachedBuilder.dockerfile.replace(
      "COPY --from=deps /app/node_modules ./node_modules",
      "COPY --from=ci-base /app/node_modules ./node_modules"
    );
    const flaggedInstall = loadEvidence();
    flaggedInstall.dockerfile = flaggedInstall.dockerfile.replace(
      "RUN npm ci --no-audit --no-fund",
      "RUN npm ci --no-audit --no-fund\nRUN npm --prefix /app install"
    );
    const detachedRunner = loadEvidence();
    detachedRunner.dockerfile = detachedRunner.dockerfile.replace(
      "COPY --chown=node:node --from=builder /app/.next-build/standalone ./",
      "COPY --chown=node:node --from=ci-base /app/.next-build/standalone ./"
    );
    const overwrittenDependencies = loadEvidence();
    overwrittenDependencies.dockerfile = overwrittenDependencies.dockerfile.replace(
      "COPY --from=deps /app/node_modules ./node_modules",
      [
        "COPY --from=deps /app/node_modules ./node_modules",
        "COPY --from=ci-base /app/node_modules ./node_modules",
      ].join("\n")
    );
    const overwrittenRunner = loadEvidence();
    overwrittenRunner.dockerfile = overwrittenRunner.dockerfile.replace(
      "COPY --chown=node:node --from=builder /app/.next-build/standalone ./",
      [
        "COPY --chown=node:node --from=builder /app/.next-build/standalone ./",
        "COPY --from=deps /app/.next-build/standalone ./",
      ].join("\n")
    );

    expect(validateRuntimeSupportPolicy(hiddenInstall)).toEqual(
      expect.arrayContaining([expect.stringContaining("exactly one dependency install")])
    );
    expect(validateRuntimeSupportPolicy(detachedBuilder)).toEqual(
      expect.arrayContaining([expect.stringContaining("consume the governed deps")])
    );
    expect(validateRuntimeSupportPolicy(flaggedInstall)).toEqual(
      expect.arrayContaining([expect.stringContaining("exactly one dependency install")])
    );
    expect(validateRuntimeSupportPolicy(detachedRunner)).toEqual(
      expect.arrayContaining([expect.stringContaining("governed builder standalone")])
    );
    expect(validateRuntimeSupportPolicy(overwrittenDependencies)).toEqual(
      expect.arrayContaining([expect.stringContaining("only cross-stage copy")])
    );
    expect(validateRuntimeSupportPolicy(overwrittenRunner)).toEqual(
      expect.arrayContaining([expect.stringContaining("only the governed builder")])
    );
  });

  it.each([
    'RUN ["npm", "install"]',
    'RUN ["/usr/local/bin/npm", "--prefix", "/app", "i"]',
    'RUN ["node", "/usr/local/lib/node_modules/npm/bin/npm-cli.js", "install"]',
  ])("rejects an exec-form mutable install: %s", (instruction) => {
    const evidence = loadEvidence();
    evidence.dockerfile = evidence.dockerfile.replace(
      "RUN npm ci --no-audit --no-fund",
      `RUN npm ci --no-audit --no-fund\n${instruction}`
    );

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([expect.stringContaining("exactly one dependency install")])
    );
  });

  it.each([
    `RUN sh -c 'npm install'`,
    'RUN sh -c "npm install"',
    "RUN (npm install)",
  ])("rejects a quoted or grouped shell-form mutable install: %s", (instruction) => {
    const evidence = loadEvidence();
    evidence.dockerfile = evidence.dockerfile.replace(
      "RUN npm ci --no-audit --no-fund",
      `RUN npm ci --no-audit --no-fund\n${instruction}`
    );

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([expect.stringContaining("exactly one dependency install")])
    );
  });

  it.each([
    "RUN <<EOF\nnpm install\nEOF",
    "RUN <<'SETUP'\nnpm --prefix /app install\nSETUP",
    "RUN <<-EOF\n\tnpm i\n\tEOF",
  ])("rejects a mutable install inside a Docker RUN heredoc: %s", (instruction) => {
    const evidence = loadEvidence();
    evidence.dockerfile = evidence.dockerfile.replace(
      "RUN npm ci --no-audit --no-fund",
      `RUN npm ci --no-audit --no-fund\n${instruction}`
    );

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([expect.stringContaining("exactly one dependency install")])
    );
  });

  it.each([
    "RUN npx --yes yarn install",
    "RUN corepack yarn install",
    "RUN cd /app && yarn install",
    "RUN pnpm install",
    'RUN ["npx", "--yes", "yarn", "install"]',
    'RUN ["/usr/local/bin/pnpm", "install"]',
  ])("rejects an alternative package-manager entrypoint: %s", (instruction) => {
    const evidence = loadEvidence();
    evidence.dockerfile = evidence.dockerfile.replace(
      "RUN npm ci --no-audit --no-fund",
      `RUN npm ci --no-audit --no-fund\n${instruction}`
    );

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([expect.stringContaining("exactly one dependency install")])
    );
  });

  it("preserves token adjacency across Docker escape continuations", () => {
    const competingInstall = loadEvidence();
    competingInstall.dockerfile = competingInstall.dockerfile.replace(
      "RUN npm ci --no-audit --no-fund",
      "RUN npm ci --no-audit --no-fund\nRUN np\\\nm install express"
    );
    const validCanonicalInstall = loadEvidence();
    validCanonicalInstall.dockerfile = validCanonicalInstall.dockerfile.replace(
      "RUN npm ci --no-audit --no-fund",
      "RUN npm ci \\\n  --no-audit \\\n  --no-fund"
    );

    expect(validateRuntimeSupportPolicy(competingInstall)).toEqual(
      expect.arrayContaining([expect.stringContaining("exactly one dependency install")])
    );
    expect(validateRuntimeSupportPolicy(validCanonicalInstall)).toEqual([]);
  });

  it.each([
    { prefix: "", sourceShape: "plain" },
    { prefix: "\uFEFF", sourceShape: "UTF-8 BOM-prefixed" },
  ])(
    "rejects a $sourceShape Docker parser directive that changes the escape character",
    ({ prefix }) => {
      const evidence = loadEvidence();
      evidence.dockerfile = [
        `${prefix}# escape=\``,
        evidence.dockerfile
          .replace(/\\(?=\r?$)/gm, "`")
          .replace(
            "RUN npm ci --no-audit --no-fund",
            "RUN npm ci --no-audit --no-fund\nRUN np`\nm install express"
          ),
      ].join("\n");

      expect(validateRuntimeSupportPolicy(evidence)).toEqual(
        expect.arrayContaining([expect.stringContaining("default backslash escape character")])
      );
    }
  );

  it("accepts an explicit default Docker escape parser directive", () => {
    const evidence = loadEvidence();
    evidence.dockerfile = `# escape=\\\n${evidence.dockerfile}`;

    expect(validateRuntimeSupportPolicy(evidence)).toEqual([]);
  });

  it("accepts a UTF-8 BOM under the default Docker escape semantics", () => {
    const evidence = loadEvidence();
    evidence.dockerfile = `\uFEFF${evidence.dockerfile}`;

    expect(validateRuntimeSupportPolicy(evidence)).toEqual([]);
  });

  it.each([
    ['SHELL ["echo"]', "SHELL overrides"],
    ["ONBUILD RUN npm install express", "ONBUILD triggers"],
  ])("rejects governed-stage Docker execution modifier: %s", (instruction, expectedFailure) => {
    const evidence = loadEvidence();
    evidence.dockerfile = evidence.dockerfile.replace(
      "FROM ${NODE_BASE_IMAGE} AS ci-base",
      `FROM \${NODE_BASE_IMAGE} AS ci-base\n${instruction}`
    );

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([expect.stringContaining(expectedFailure)])
    );
  });

  it("does not treat COPY heredoc payloads as Docker instructions", () => {
    const evidence = loadEvidence();
    evidence.dockerfile = evidence.dockerfile.replace(
      'RUN test -n "$WORKBENCH_DEPLOYMENT_ID" && npm run build',
      [
        "COPY <<'EOF' /tmp/policy-example",
        'SHELL ["bash"]',
        "ONBUILD RUN npm install express",
        "EOF",
        'RUN test -n "$WORKBENCH_DEPLOYMENT_ID" && npm run build',
      ].join("\n")
    );

    expect(validateRuntimeSupportPolicy(evidence)).toEqual([]);
  });

  it("does not treat a JSON COPY filename as a heredoc operator", () => {
    const evidence = loadEvidence();
    evidence.dockerfile = evidence.dockerfile.replace(
      'RUN test -n "$WORKBENCH_DEPLOYMENT_ID" && npm run build',
      [
        `COPY ["<<'RUN npm run build'", "/tmp/policy-example"]`,
        "RUN npm install express",
        'RUN test -n "$WORKBENCH_DEPLOYMENT_ID" && npm run build',
      ].join("\n")
    );

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([expect.stringContaining("exactly one dependency install")])
    );
  });

  it.each([
    "add",
    "i",
    "in",
    "ins",
    "inst",
    "insta",
    "instal",
    "isnt",
    "isnta",
    "isntal",
    "isntall",
  ])("rejects npm's mutable install alias %s in any Docker stage", (installAlias) => {
    const evidence = loadEvidence();
    evidence.dockerfile = evidence.dockerfile.replace(
      "RUN npm ci --no-audit --no-fund",
      `RUN npm ci --no-audit --no-fund\nRUN npm --prefix /app ${installAlias}`
    );

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([expect.stringContaining("exactly one dependency install")])
    );
  });

  it("requires the final effective runner user to remain governed and non-root", () => {
    const evidence = loadEvidence();
    evidence.dockerfile += "\nUSER root\n";

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([expect.stringContaining("final effective user")])
    );
  });

  it.each([
    'CMD ["sleep", "infinity"]',
    'ENTRYPOINT ["sleep", "infinity"]',
  ])("requires the runner to launch the standalone server without override: %s", (instruction) => {
    const evidence = loadEvidence();
    evidence.dockerfile += `\n${instruction}\n`;

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([expect.stringContaining("launch only the standalone server")])
    );
  });

  it("binds the production healthcheck and package-manager removal to effective runner instructions", () => {
    const healthcheckOverride = loadEvidence();
    healthcheckOverride.dockerfile += "\nHEALTHCHECK NONE\n";
    const healthcheckOverwrite = loadEvidence();
    healthcheckOverwrite.dockerfile = healthcheckOverwrite.dockerfile.replace(
      "COPY --chown=node:node scripts/runtime/workbench-healthcheck.mjs ./healthcheck.mjs",
      [
        "COPY --chown=node:node scripts/runtime/workbench-healthcheck.mjs ./healthcheck.mjs",
        "COPY scripts/quality/clean-next-build-artifacts.mjs ./healthcheck.mjs",
      ].join("\n")
    );
    const retainedPackageManagers = loadEvidence();
    retainedPackageManagers.dockerfile = retainedPackageManagers.dockerfile.replace(
      /RUN rm -rf[\s\S]*?\/opt\/yarn-v1\.22\.22/,
      "RUN true"
    );
    const unpinnedPcre2SecurityUpdate = loadEvidence();
    unpinnedPcre2SecurityUpdate.dockerfile = unpinnedPcre2SecurityUpdate.dockerfile.replace(
      "libpcre2-8-0=10.42-1+deb12u1",
      "libpcre2-8-0"
    );

    expect(validateRuntimeSupportPolicy(healthcheckOverride)).toEqual(
      expect.arrayContaining([expect.stringContaining("dependency-free Node healthcheck")])
    );
    expect(validateRuntimeSupportPolicy(healthcheckOverwrite)).toEqual(
      expect.arrayContaining([expect.stringContaining("dependency-free Node healthcheck")])
    );
    expect(validateRuntimeSupportPolicy(retainedPackageManagers)).toEqual(
      expect.arrayContaining([expect.stringContaining("pinned PCRE2 security update")])
    );
    expect(validateRuntimeSupportPolicy(unpinnedPcre2SecurityUpdate)).toEqual(
      expect.arrayContaining([expect.stringContaining("pinned PCRE2 security update")])
    );
  });

  it("requires the governed runner to be the image-producing final stage", () => {
    const evidence = loadEvidence();
    evidence.dockerfile += "\nFROM ci-base AS diagnostic\nUSER root\n";

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([expect.stringContaining("final Docker stage")])
    );
  });

  it("rejects missing or duplicate governed Docker stages", () => {
    const missingDeps = loadEvidence();
    missingDeps.dockerfile = missingDeps.dockerfile.replace(
      "FROM ci-base AS deps",
      "FROM ci-base AS dependency-cache"
    );
    const duplicateRunner = loadEvidence();
    duplicateRunner.dockerfile += "\nFROM ci-base AS runner\nUSER node\n";

    expect(validateRuntimeSupportPolicy(missingDeps)).toEqual(
      expect.arrayContaining([expect.stringContaining('exactly one Docker stage named "deps"')])
    );
    expect(validateRuntimeSupportPolicy(duplicateRunner)).toEqual(
      expect.arrayContaining([expect.stringContaining('exactly one Docker stage named "runner"')])
    );
  });

  it("rejects expired review and premature certification claims", () => {
    const evidence = loadEvidence();
    evidence.policy.browserPolicy.certificationStatus = "bank-certified";
    evidence.policy.scalingPolicy.certificationStatus = "production-certified";
    evidence.policy.explicitNonClaims = [];
    evidence.policy.reviewedOn = "2026-09-04";
    evidence.policy.nextReviewBy = "2026-09-15";
    evidence.today = "2026-09-16";

    expect(validateRuntimeSupportPolicy(evidence)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("review expired"),
        expect.stringContaining("Browser certification"),
        expect.stringContaining("Scaling certification"),
        expect.stringContaining("cross-browser-bank-certification"),
        expect.stringContaining("load-or-soak-certification"),
        expect.stringContaining("horizontal-scale-certification"),
        expect.stringContaining("production-identity-certification"),
      ])
    );
  });

  it("rejects missing or malformed lifecycle dates", () => {
    const missingDeadline = loadEvidence();
    Reflect.deleteProperty(missingDeadline.policy, "nextReviewBy");
    const invalidReviewDate = loadEvidence();
    invalidReviewDate.policy.reviewedOn = "2026-02-30";

    expect(validateRuntimeSupportPolicy(missingDeadline)).toEqual(
      expect.arrayContaining([expect.stringContaining("nextReviewBy must be a real ISO")])
    );
    expect(validateRuntimeSupportPolicy(invalidReviewDate)).toEqual(
      expect.arrayContaining([expect.stringContaining("reviewedOn must be a real ISO")])
    );
  });

  it("rejects future or inverted lifecycle dates", () => {
    const futureReview = loadEvidence();
    futureReview.policy.reviewedOn = futureReview.policy.nextReviewBy;
    const invertedReview = loadEvidence();
    invertedReview.policy.reviewedOn = "9999-12-31";

    expect(validateRuntimeSupportPolicy(futureReview)).toEqual(
      expect.arrayContaining([expect.stringContaining("cannot be in the future")])
    );
    expect(validateRuntimeSupportPolicy(invertedReview)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("reviewedOn must not be later than nextReviewBy"),
      ])
    );
  });
});
