import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..");
const read = (...path: string[]) => readFileSync(join(root, ...path), "utf8");

describe("Workbench scale-proof governance", () => {
  it("uses two identical hardened Workbench replicas without session affinity", () => {
    const compose = read("docker-compose.scale-proof.yml");
    const nginx = read("scripts", "scale", "nginx.conf");

    expect(compose).toContain("x-workbench: &workbench");
    expect(compose.match(/<<: \*workbench/g)).toHaveLength(2);
    expect(compose).toContain("read_only: true");
    expect(compose).toContain("no-new-privileges:true");
    expect(compose).toContain("cap_drop:");
    expect(nginx).toContain("least_conn;");
    expect(nginx).toContain("proxy_next_upstream_tries 2;");
    expect(nginx).not.toMatch(/ip_hash|sticky|hash\s+\$cookie/i);
    expect(compose).toContain(
      "WORKBENCH_DEPLOYMENT_ID: ${WORKBENCH_DEPLOYMENT_ID:?WORKBENCH_DEPLOYMENT_ID is required}",
    );
  });

  it("pins mature official images and isolates the non-certifying source fixture", () => {
    const compose = read("docker-compose.scale-proof.yml");
    const balancerDockerfile = read("scripts", "scale", "Dockerfile.balancer");
    const fixture = read("scripts", "scale", "gateway-fixture.mjs");

    expect(balancerDockerfile).toContain(
      "nginx:1.30.3-alpine3.23-slim@sha256:d5b51cfc7d55fc7a7bcf4d1d577b9c3738331df56d68f0b1d8ac9795b9470a5a",
    );
    expect(balancerDockerfile).toContain('"libcrypto3=3.5.8-r0"');
    expect(balancerDockerfile).toContain('"libssl3=3.5.8-r0"');
    expect(balancerDockerfile).toContain("USER 101:101");
    expect(balancerDockerfile).not.toContain("3.5.7-r0");
    expect(compose).toContain(
      "image: ${WORKBENCH_SCALE_BALANCER_IMAGE:-lotus-workbench-scale-balancer:scale-proof}",
    );
    expect(compose).toContain(
      "node:22.23.1-bookworm-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3",
    );
    expect(fixture).toContain('request.url === "/api/v1/scale-proof/state"');
    expect(fixture).toContain('request.url === "/api/v1/scale-proof/actions"');
    expect(fixture).not.toMatch(/portfolio|client|advisor|trade|order/i);
  });

  it("fails on distribution, latency, error, persistence, or image-identity drift", () => {
    const runner = read("scripts", "scale", "run-workbench-scale-proof.mjs");
    const packageJson = JSON.parse(read("package.json"));

    expect(packageJson.scripts["scale:proof"]).toBe(
      "node scripts/scale/run-workbench-scale-proof.mjs",
    );
    expect(runner).toContain("Workbench replicas do not use the same immutable image identity");
    expect(runner).toContain("did not distribute requests across two replicas");
    expect(runner).toContain("Persisted source state was lost with a Workbench replica");
    expect(runner).toContain("p95Ms: 1_500");
    expect(runner).toContain("replacementMaxErrorRate: 0.02");
    expect(runner).toContain('compose(["stop", "workbench-a"])');
    expect(runner).toContain('compose(["rm", "-f", "workbench-a"])');
    expect(runner).toContain("assertContainerReplacement");
    expect(runner).toContain("replica_replacement: replicaReplacement");
    expect(runner).toContain('resource_evidence: "captured_concurrently_per_phase"');
    expect(runner).toContain("startContainerResourceMonitor");
    expect(runner).toContain("createLoadGeneratorResourceTracker");
    expect(runner).toContain("Concurrent phase resource evidence");
    expect(runner).toContain("Load-generator evidence covers the host Node process");
    expect(runner).toContain("resources:");
    expect(runner).not.toContain("collectResourceEvidence");
    expect(runner).toContain("engineering_regression_non_certifying");
    expect(runner).toContain("explicit_non_claims");
    expect(runner).toContain("resolveSuccessfulTerminalUpstream");
    expect(runner).toContain("successfulResults");
    expect(runner).toContain("resolveScaleProofDeploymentId");
    expect(runner).toContain('"scripts/scale/Dockerfile.balancer"');
    expect(runner).toContain("WORKBENCH_SCALE_BALANCER_IMAGE: scaleBalancerImage");
    expect(runner).toContain("load_balancer_image_identity: scaleBalancerImageIdentity");

    const pullRequestWorkflow = read(".github", "workflows", "pr-merge-gate.yml");
    const mainWorkflow = read(".github", "workflows", "main-releasability.yml");
    expect(pullRequestWorkflow).toContain("WORKBENCH_DEPLOYMENT_ID: ${{ github.");
    expect(mainWorkflow).toContain(
      "WORKBENCH_DEPLOYMENT_ID: ${{ inputs.expected_sha || github.sha }}",
    );

    for (const workflow of [pullRequestWorkflow, mainWorkflow]) {
      expect(workflow).toContain("SCALE_PROOF_SKIP_BUILD: \"1\"");
      expect(workflow).toContain(
        'docker build --label "com.lotus.repository.checkout=${{ github.workspace }}" --file scripts/scale/Dockerfile.balancer --tag lotus-workbench-scale-balancer:ci-test .',
      );
      expect(workflow).toContain(
        "WORKBENCH_SCALE_BALANCER_IMAGE: lotus-workbench-scale-balancer:ci-test",
      );
    }
  });

  it("keeps buyer and operator documentation aligned to the non-certifying proof", () => {
    const readme = read("README.md");
    const context = read("REPOSITORY-ENGINEERING-CONTEXT.md");
    const technologyRisk = read("wiki", "Technology-Risk-and-Runtime-Support.md");
    const validation = read("wiki", "Validation-and-CI.md");
    const operations = read("wiki", "Operations-Runbook.md");
    const architecture = read("wiki", "Architecture.md");

    for (const document of [readme, context, technologyRisk, validation, operations]) {
      expect(document).toContain("npm run scale:proof");
    }
    expect(readme).toContain("/api/health/live");
    expect(operations).toContain("/api/health/ready");
    expect(technologyRisk).toContain("validation dependency, not a production orchestration");
    expect(technologyRisk).toContain("host Node load generator's per-phase CPU and RSS");
    expect(validation).toContain("engineering_regression_non_certifying");
    expect(validation).toContain("streams container resource samples");
    expect(architecture).toContain("neither requires sticky sessions nor");
  });
});
