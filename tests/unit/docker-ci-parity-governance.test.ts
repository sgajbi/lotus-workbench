import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

function readRepositoryFile(...segments: string[]): string {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

interface ComposeWorkflowJob {
  env?: Record<string, string>;
  steps?: Array<{ if?: string; run?: string }>;
}

interface ComposeWorkflow {
  jobs?: Record<string, ComposeWorkflowJob>;
}

describe("Docker CI parity governance", () => {
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

  it("keeps audit tools in the CI-only stage rather than the production runtime", () => {
    const dockerfile = readRepositoryFile("Dockerfile");
    const compose = readRepositoryFile("docker-compose.ci-local.yml");
    const ciTools = dockerfile.slice(
      dockerfile.indexOf("FROM ci-base AS ci-tools"),
      dockerfile.indexOf("FROM ci-base AS deps"),
    );
    const runner = dockerfile.slice(dockerfile.indexOf("FROM ci-base AS runner"));

    expect(compose).toContain("target: ci-tools");
    expect(ciTools).toContain(
      "apt-get install --no-install-recommends --yes git python-is-python3 python3",
    );
    expect(runner).not.toContain("apt-get");
    expect(runner).not.toContain("python3");
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
