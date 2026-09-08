import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(__dirname, "..", "..");
const governedLintCommand =
  "npm run quality:branch-protection && npm run quality:runtime-support && npm run quality:runtime-state && npm run quality:bff-header-boundary && npm run quality:feature-transport && npm run quality:source-authority && npm run quality:dependency-risk && npm run quality:font-assets && npm run quality:product-copy && npm run quality:e2e-scenarios && npm run lint:css-global && npm run lint:risk-architecture && npm run quality:screen-docs && npm run lint:react-compiler && npm run lint:eslint";
const governedTimeoutsByJob = new Map([
  [
    "e2e-smoke",
    {
      nameSuffix: "Fixture-Free Playwright Smoke",
      timeout: 30,
    },
  ],
  [
    "docker-build",
    {
      nameSuffix: "Docker Build And Security",
      timeout: 45,
    },
  ],
  [
    "ci-local-docker",
    {
      nameSuffix: "CI Local Docker Parity",
      timeout: 60,
    },
  ],
]);

function readRepositoryFile(...segments: string[]): string {
  return readFileSync(join(repositoryRoot, ...segments), "utf8");
}

function hasExactLine(source: string, expectedLine: string): boolean {
  return source.split(/\r?\n/).includes(expectedLine);
}

function workflowJobBlock(source: string, jobId: string): string {
  const normalizedSource = source.replaceAll("\r\n", "\n");
  const match = normalizedSource.match(
    new RegExp(`\\n  ${jobId}:\\n(?<block>[\\s\\S]*?)(?=\\n  [a-z0-9-]+:\\n|\\n*$)`),
  );

  return match?.groups?.block ?? "";
}

function expectGovernedJobTimeouts(workflow: string, namePrefix: string): void {
  for (const [jobId, expectation] of governedTimeoutsByJob) {
    const jobBlock = workflowJobBlock(workflow, jobId);

    expect(jobBlock).toContain(`name: ${namePrefix} / ${expectation.nameSuffix}`);
    expect(jobBlock).toContain(`timeout-minutes: ${expectation.timeout}`);
  }
}

function collectLocalNodeScripts(
  scripts: Record<string, string>,
  entrypoint: string,
): string[] {
  const visited = new Set<string>();
  const localScripts = new Set<string>();

  function visit(scriptName: string) {
    if (visited.has(scriptName)) {
      return;
    }
    visited.add(scriptName);

    const command = scripts[scriptName] ?? "";
    for (const match of command.matchAll(/\bnpm run ([\w:-]+)/g)) {
      visit(match[1]);
    }
    for (const match of command.matchAll(/\bnode (scripts\/[^\s;&|]+)/g)) {
      localScripts.add(match[1]);
    }
  }

  visit(entrypoint);
  return [...localScripts].sort();
}

describe("dependency security governance", () => {
  it("preserves stable React Hooks linting under the flat ESLint CLI gate", () => {
    const packageJson = JSON.parse(readRepositoryFile("package.json")) as {
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    const eslintConfig = readRepositoryFile("eslint.config.mjs");

    expect(packageJson.scripts?.lint).toBe(governedLintCommand);
    expect(packageJson.scripts?.["quality:font-assets"]).toBe(
      "node scripts/quality/check-font-asset-governance.mjs",
    );
    expect(packageJson.scripts?.["lint:eslint"]).toBe("eslint . --max-warnings=0");
    expect(packageJson.devDependencies?.["eslint-plugin-react-hooks"]).toBe(
      "7.1.1",
    );
    expect(eslintConfig).toContain(
      'import reactHooks from "eslint-plugin-react-hooks";',
    );
    expect(eslintConfig).toContain('"react-hooks": reactHooks');
    expect(eslintConfig).toContain('"react-hooks/rules-of-hooks"');
    expect(eslintConfig).toContain('"react-hooks/exhaustive-deps"');
    expect(eslintConfig).toContain("...stableReactHooksRules");
    expect(eslintConfig).toContain('files: ["src/**/*.{js,jsx,mjs,cjs,ts,tsx}"]');
    expect(eslintConfig).toContain("intentionalUnusedValuePattern");
  });

  it("keeps React Compiler compatibility in the blocking lint chain", () => {
    const packageJson = JSON.parse(readRepositoryFile("package.json")) as {
      scripts?: Record<string, string>;
    };
    const eslintConfig = readRepositoryFile("eslint.config.mjs");
    const compilerConfig = readRepositoryFile("eslint.react-compiler.config.mjs");

    expect(packageJson.scripts?.["lint:react-compiler"]).toBe(
      "eslint src --config eslint.react-compiler.config.mjs --max-warnings=0",
    );
    expect(packageJson.scripts?.lint).toContain("npm run lint:react-compiler");
    expect(eslintConfig).not.toContain("reactHooks.configs.recommended.rules,");
    expect(compilerConfig).toContain('import baseConfig from "./eslint.config.mjs";');
    expect(compilerConfig).toContain('import reactHooks from "eslint-plugin-react-hooks";');
    expect(compilerConfig).toContain("...reactHooks.configs.recommended.rules");
    expect(compilerConfig).toContain('files: ["src/**/*.{js,jsx,mjs,cjs,ts,tsx}"]');
  });

  it("keeps lint scope broad enough for source, tests, scripts, and configuration", () => {
    const packageJson = JSON.parse(readRepositoryFile("package.json")) as {
      scripts?: Record<string, string>;
    };
    const eslintConfig = readRepositoryFile("eslint.config.mjs");
    const nextConfig = readRepositoryFile("next.config.mjs");
    const makefile = readRepositoryFile("Makefile");

    expect(packageJson.scripts?.lint).toBe(governedLintCommand);
    expect(packageJson.scripts?.["lint:eslint"]).toBe("eslint . --max-warnings=0");
    expect(packageJson.scripts?.lint).not.toContain("eslint src");
    expect(makefile).toMatch(/lint:\r?\n\tnpm run lint/);
    expect(makefile).toMatch(/check: security lint typecheck test-coverage build/);
    expect(nextConfig).toContain("ignoreDuringBuilds: true");
    expect(eslintConfig).toContain("NEXT_DEVELOPMENT_DIRECTORY");
    expect(eslintConfig).toContain("NEXT_PRODUCTION_DIRECTORY");
    expect(eslintConfig).toContain("`${NEXT_DEVELOPMENT_DIRECTORY}/**`");
    expect(eslintConfig).toContain("`${NEXT_PRODUCTION_DIRECTORY}/**`");
    expect(eslintConfig).toContain('files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"]');
    expect(eslintConfig).not.toContain('"tests/**"');
    expect(eslintConfig).not.toContain('"scripts/**"');
    expect(eslintConfig).not.toContain('"*.config.*"');
  });

  it("treats undefined JavaScript identifiers as root lint failures", () => {
    const eslintConfig = readRepositoryFile("eslint.config.mjs");

    expect(eslintConfig).toContain('files: ["**/*.{js,jsx,mjs,cjs}"]');
    expect(eslintConfig).toContain('"no-undef": "error"');
    expect(eslintConfig).toContain("sharedJavaScriptRuntimeGlobals");
    expect(eslintConfig).toContain('process: "readonly"');
    expect(eslintConfig).toContain('URLSearchParams: "readonly"');
  });

  it("enforces high-risk toolchain and moderate-risk production audit thresholds", () => {
    const packageJson = JSON.parse(readRepositoryFile("package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["security:audit"]).toBe(
      "npm audit --audit-level=high && npm audit --omit=dev --audit-level=moderate",
    );
  });

  it("pins the patched brace expansion line only beneath its compatible minimatch consumer", () => {
    const packageJson = JSON.parse(readRepositoryFile("package.json")) as {
      overrides?: Record<string, unknown>;
    };
    const packageLock = JSON.parse(readRepositoryFile("package-lock.json")) as {
      packages?: Record<string, { version?: string; integrity?: string }>;
    };

    expect(packageJson.overrides?.minimatch).toEqual({
      "brace-expansion": "5.0.9",
    });
    expect(packageJson.overrides?.["brace-expansion"]).toBeUndefined();
    expect(packageLock.packages?.["node_modules/brace-expansion"]).toMatchObject({
      version: "5.0.9",
      integrity:
        "sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==",
    });
  });

  it("pins the patched nanoid line used by the production PostCSS graph", () => {
    const packageJson = JSON.parse(readRepositoryFile("package.json")) as {
      overrides?: Record<string, unknown>;
    };
    const packageLock = JSON.parse(readRepositoryFile("package-lock.json")) as {
      packages?: Record<string, { version?: string; integrity?: string }>;
    };

    expect(packageJson.overrides?.nanoid).toBe("3.3.18");
    expect(packageLock.packages?.["node_modules/nanoid"]).toMatchObject({
      version: "3.3.18",
      integrity:
        "sha512-DTg4MJbGMWkfi6VZFdNt2/caMbQy4Ou+Op/hJQvGEWcnVfoA1QA+xzRKAzw9jD6+GVOOeYr/mIcuDSdug6F6+w==",
    });
  });

  it("keeps the security gate in local check and protected CI lanes", () => {
    const makefile = readRepositoryFile("Makefile");

    expect(makefile).toMatch(/security:\r?\n\tnpm run security:audit/);
    expect(makefile).toMatch(/check: security lint typecheck test-coverage build/);

    for (const workflowName of [
      "feature-lane.yml",
      "pr-merge-gate.yml",
      "main-releasability.yml",
    ]) {
      const workflow = readRepositoryFile(".github", "workflows", workflowName);

      expect(workflow).toContain("name: Dependency Security Gate");
      expect(workflow).toContain("run: make security");
    }
  });

  it("uses one immutable enterprise LTS base for production and Docker parity", () => {
    const dockerfile = readRepositoryFile("Dockerfile");
    const dockerignore = readRepositoryFile(".dockerignore");
    const ciCompose = readRepositoryFile("docker-compose.ci-local.yml");
    const nextConfig = readRepositoryFile("next.config.mjs");
    const governedBase =
      "node:22.23.1-bookworm-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3";

    expect(dockerfile).toContain(`ARG NODE_BASE_IMAGE=${governedBase}`);
    expect(dockerfile.match(/FROM \$\{NODE_BASE_IMAGE\}/g)).toHaveLength(1);
    expect(dockerfile).toContain("FROM ${NODE_BASE_IMAGE} AS ci-base");
    expect(dockerfile).toContain("FROM ci-base AS deps");
    expect(dockerfile).toContain("FROM ci-base AS builder");
    expect(dockerfile).toContain("FROM ci-base AS runner");
    expect(dockerfile).not.toContain("COPY . .");
    expect(dockerfile).toContain("COPY src ./src");
    expect(nextConfig).toContain('output: "standalone"');
    expect(dockerfile).toContain("/app/.next-build/standalone ./");
    expect(dockerfile).toContain(
      "scripts/config/next-artifact-layout.mjs ./scripts/config/next-artifact-layout.mjs",
    );
    expect(dockerignore).toContain("!scripts/config/next-artifact-layout.mjs");
    expect(dockerfile).not.toContain("npm prune --omit=dev");
    expect(dockerfile).toContain("/usr/local/lib/node_modules/npm");
    expect(dockerfile).toContain("/usr/local/lib/node_modules/corepack");
    expect(dockerfile).toContain("/opt/yarn-v1.22.22");
    expect(dockerfile).toContain('CMD ["node", "server.js"]');
    expect(dockerfile).toContain("USER node");
    expect(dockerfile).not.toContain("node:22-alpine");
    expect(hasExactLine(dockerignore, "*")).toBe(true);
    expect(dockerignore).toContain("!package.json");
    expect(dockerignore).toContain("!package-lock.json");
    expect(dockerignore).toContain("!src/**");
    expect(dockerignore).toContain("!scripts/runtime/workbench-healthcheck.mjs");
    expect(dockerignore).not.toContain("!.env");
    expect(dockerignore).not.toContain("!output");
    expect(ciCompose).toContain("target: ci-base");
    expect(ciCompose).not.toContain("node:22-alpine");
  });

  it("copies every repository-owned build script into the governed Docker context", () => {
    const packageJson = JSON.parse(readRepositoryFile("package.json")) as {
      scripts?: Record<string, string>;
    };
    const dockerfile = readRepositoryFile("Dockerfile");
    const dockerignore = readRepositoryFile(".dockerignore");
    const localBuildScripts = collectLocalNodeScripts(
      packageJson.scripts ?? {},
      "build",
    );

    expect(localBuildScripts.length).toBeGreaterThan(0);
    for (const scriptPath of localBuildScripts) {
      expect(dockerfile).toContain(`COPY ${scriptPath} ./${scriptPath}`);
      expect(hasExactLine(dockerignore, `!${scriptPath}`)).toBe(true);
    }
  });

  it.each(["\n", "\r\n"])(
    "recognizes the Docker build-context deny rule with %j newlines",
    (newline) => {
      const dockerignore = ["# governed deny rule", "*", "!package.json", ""].join(newline);

      expect(hasExactLine(dockerignore, "*")).toBe(true);
    },
  );

  it("keeps runtime health dependency-free and owned by the production image", () => {
    const dockerfile = readRepositoryFile("Dockerfile");
    const compose = readRepositoryFile("docker-compose.yml");
    const healthcheck = readRepositoryFile(
      "scripts",
      "runtime",
      "workbench-healthcheck.mjs",
    );

    expect(dockerfile).toContain(
      "COPY --chown=node:node scripts/runtime/workbench-healthcheck.mjs ./healthcheck.mjs",
    );
    expect(dockerfile).toContain(
      'HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=5 CMD ["node", "healthcheck.mjs"]',
    );
    expect(dockerfile).toContain("ARG WORKBENCH_DEPLOYMENT_ID");
    expect(dockerfile).not.toContain("ARG WORKBENCH_DEPLOYMENT_ID=");
    expect(dockerfile).toContain(
      'RUN test -n "$WORKBENCH_DEPLOYMENT_ID" && npm run build',
    );
    expect(dockerfile.match(/ENV WORKBENCH_DEPLOYMENT_ID=/g)).toHaveLength(2);
    expect(compose).not.toContain("healthcheck:");
    expect(compose).not.toContain("wget");
    expect(compose).not.toContain("curl");
    expect(healthcheck).toContain('import http from "node:http"');
    expect(healthcheck).toContain('host: "127.0.0.1"');
    expect(healthcheck).toContain('path: "/api/health/live"');
    expect(healthcheck).toContain("statusCode < 200 || statusCode >= 400");
    expect(healthcheck).not.toContain("fetch(");
  });

  it("pins the known-safe image scanner and publishes an SBOM in protected lanes", () => {
    const trivyActionCommit =
      "aquasecurity/trivy-action@57a97c7e7821a5776cebc9bb87c984fa69cba8f1";

    for (const workflowName of ["pr-merge-gate.yml", "main-releasability.yml"]) {
      const workflow = readRepositoryFile(".github", "workflows", workflowName);

      expect(workflow.match(new RegExp(trivyActionCommit, "g"))).toHaveLength(3);
      expect(workflow).toContain(
        'docker build --label "com.lotus.repository.checkout=${{ github.workspace }}" --file scripts/scale/Dockerfile.balancer --tag lotus-workbench-scale-balancer:ci-test .',
      );
      expect(workflow).toContain("image-ref: lotus-workbench-scale-balancer:ci-test");
      expect(workflow).toContain(
        "Two-replica replacement and capacity regression proof",
      );
      expect(workflow).toContain("version: v0.69.3");
      expect(workflow).toContain("severity: HIGH,CRITICAL");
      expect(workflow).toContain('exit-code: "1"');
      expect(workflow).toContain("ignore-unfixed: true");
      expect(workflow).toContain("scanners: vuln");
      expect(workflow).toContain("format: cyclonedx");
      expect(workflow).toContain("workbench-image.cdx.json");
      expect(workflow).not.toContain("aquasecurity/trivy-action@master");
      expect(workflow).not.toContain("version: latest");
    }
  });

  it("bounds critical Docker and browser proof jobs in protected lanes", () => {
    for (const [workflowName, jobNamePrefix] of [
      ["pr-merge-gate.yml", "PR Merge Gate"],
      ["main-releasability.yml", "Main Releasability"],
    ] as const) {
      const workflow = readRepositoryFile(".github", "workflows", workflowName);

      expectGovernedJobTimeouts(workflow, jobNamePrefix);
    }
  });

  it.each(["\n", "\r\n"])(
    "extracts every governed workflow job block with %j newlines",
    (newline) => {
      const workflow = [
        "name: Fixture",
        "jobs:",
        ...Array.from(governedTimeoutsByJob, ([jobId, expectation]) => [
          `  ${jobId}:`,
          `    name: Fixture / ${expectation.nameSuffix}`,
          `    timeout-minutes: ${expectation.timeout}`,
          "    runs-on: ubuntu-latest",
        ]).flat(),
        "  unrelated-job:",
        "    name: Fixture / Unrelated",
        "    runs-on: ubuntu-latest",
        "",
      ].join(newline);

      expectGovernedJobTimeouts(workflow, "Fixture");
    },
  );
});
