import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { parseDockerfile } from "../../scripts/quality/runtime-support-source-evidence.mjs";

function localToolPathClosed(source: string): boolean {
  const stages = parseDockerfile(source).stages as {
    name: string;
    instructions: { keyword: string; argument: string }[];
  }[];
  const deps = stages.find((stage) => stage.name === "deps")?.instructions ?? [];
  const installIndex = deps.findIndex((entry) => entry.keyword === "RUN" && entry.argument === "npm ci --no-audit --no-fund");
  const copyIndex = deps.findIndex((entry) => entry.keyword === "COPY" && entry.argument === "tools/eslint-plugin-next ./tools/eslint-plugin-next");
  const builder = stages.find((stage) => stage.name === "builder")?.instructions ?? [];
  return copyIndex >= 0 && installIndex > copyIndex && builder.some((entry) =>
    entry.keyword === "COPY" && entry.argument === "tools/eslint-plugin-next ./tools/eslint-plugin-next");
}

function readRepositoryFile(...segments: string[]): string {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8").replaceAll("\r\n", "\n");
}

interface ComposeWorkflowJob {
  env?: Record<string, string>;
  steps?: Array<{ if?: string; run?: string }>;
}

interface ComposeWorkflow {
  jobs?: Record<string, ComposeWorkflowJob>;
}

describe("Docker CI parity governance", () => {
  it("closes the local npm package link before install and in the builder", () => {
    const source = readRepositoryFile("Dockerfile");
    expect(localToolPathClosed(source)).toBe(true);
    expect(localToolPathClosed(source.replace("COPY tools/eslint-plugin-next ./tools/eslint-plugin-next\n", ""))).toBe(false);
    const builderOffset = source.indexOf("FROM ci-base AS builder");
    expect(localToolPathClosed(source.slice(0, builderOffset) + source.slice(builderOffset).replace("COPY tools/eslint-plugin-next ./tools/eslint-plugin-next\n", ""))).toBe(false);
    expect(localToolPathClosed(source.replace("COPY tools/eslint-plugin-next ./tools/eslint-plugin-next\n", "# COPY tools/eslint-plugin-next ./tools/eslint-plugin-next\n"))).toBe(false);
  });
  it("admits only the maintained package subtree into the explicit Docker context", () => {
    const ignore = readRepositoryFile(".dockerignore");
    expect(ignore).toContain("!tools/\ntools/*\n!tools/eslint-plugin-next/\ntools/eslint-plugin-next/*");
    for (const path of ["package.json", "LICENSE", "README.md", "UPSTREAM-PROVENANCE.json", "dist/"])
      expect(ignore).toContain("!tools/eslint-plugin-next/" + path);
    expect(ignore).toContain("!tools/eslint-plugin-next/dist/**");
    expect(ignore).not.toContain("!tools/**");
  });
  it("bounds Vitest workers without weakening assertions or individual timeouts", () => {
    const compose = readRepositoryFile("docker-compose.ci-local.yml");
    const packageJson = JSON.parse(readRepositoryFile("package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(compose).toContain("npm run test -- --maxWorkers=2");
    expect(compose).toContain("npm run lint");
    expect(packageJson.scripts?.lint).toContain("npm run lint:css-global");
    expect(compose).not.toContain("--passWithNoTests");
    expect(compose).not.toContain("--testTimeout");
    expect(compose).not.toContain("--no-file-parallelism");
  });

  it("keeps executable audit tools in the CI-only stage while allowing only the pinned runtime security update", () => {
    const dockerfile = readRepositoryFile("Dockerfile");
    const compose = readRepositoryFile("docker-compose.ci-local.yml");
    const ciTools = dockerfile.slice(
      dockerfile.indexOf("FROM ci-base AS ci-tools"),
      dockerfile.indexOf("FROM ci-base AS deps"),
    );
    const runner = dockerfile.slice(dockerfile.indexOf("FROM ci-base AS runner"));

    expect(compose).toContain("target: ci-tools");
    expect(dockerfile).toContain(
      "ARG POWERSHELL_BASE_IMAGE=mcr.microsoft.com/powershell:7.5-debian-12@sha256:7ab5bd5ca6f95a3351fa0c6a1205237d57048c94542355aab55519a0861a9b25",
    );
    expect(dockerfile).toContain("FROM ${POWERSHELL_BASE_IMAGE} AS powershell");
    expect(ciTools).toContain(
      "COPY --from=powershell /opt/microsoft/powershell/7 /opt/microsoft/powershell/7",
    );
    expect(ciTools).toContain(
      "apt-get install --no-install-recommends --yes git libicu72 libssl3 python-is-python3 python3",
    );
    expect(ciTools).toContain(
      "ln -s /opt/microsoft/powershell/7/pwsh /usr/local/bin/pwsh",
    );
    expect(runner).toContain(
      "apt-get install --no-install-recommends --only-upgrade --yes libpcre2-8-0=10.42-1+deb12u2 perl-base=5.36.0-7+deb12u4",
    );
    expect(runner).not.toContain("apt-get install --no-install-recommends --yes git");
    expect(runner).not.toContain("python3");
    expect(runner).not.toContain("pwsh");
  });

  it("masks developer-local environment values with a tracked empty fixture", () => {
    const compose = readRepositoryFile("docker-compose.ci-local.yml");
    const ciEnvironment = readRepositoryFile("scripts", "testing", "ci-empty.env");

    expect(compose).toContain(
      "./scripts/testing/ci-empty.env:/app/.env.local:ro",
    );
    expect(ciEnvironment).toContain("Intentionally empty");
    expect(ciEnvironment).not.toContain("=");
  });

  it.each(["pr-merge-gate.yml", "main-releasability.yml"])(
    "isolates every Compose-backed %s job by workflow run and attempt",
    (workflowName) => {
      const workflow = parseYaml(
        readRepositoryFile(".github", "workflows", workflowName),
      ) as ComposeWorkflow;
      const scaleRunner = readRepositoryFile(
        "scripts",
        "scale",
        "run-workbench-scale-proof.mjs",
      );
      const scaleProof = workflow.jobs?.["docker-build"];
      const dockerParity = workflow.jobs?.["ci-local-docker"];

      expect(scaleProof?.env?.COMPOSE_PROJECT_NAME).toBe(
        "lotus-workbench-scale-${{ github.run_id }}-${{ github.run_attempt }}",
      );
      expect(dockerParity?.env?.COMPOSE_PROJECT_NAME).toBe(
        "lotus-workbench-parity-${{ github.run_id }}-${{ github.run_attempt }}",
      );
      expect(scaleProof?.env?.COMPOSE_PROJECT_NAME).not.toBe(
        dockerParity?.env?.COMPOSE_PROJECT_NAME,
      );
      expect(scaleRunner).toContain("} finally {");
      expect(scaleRunner).toContain(
        'compose(["down", "-v", "--remove-orphans"], { allowFailure: true });',
      );
      expect(dockerParity?.steps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            if: "always()",
            run: "make ci-local-docker-down",
          }),
        ]),
      );
    },
  );
});
