import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  buildIdeaCapacityProbeEvidence,
  loadIdeaCapacityProbeEvidence,
  validateAndWriteIdeaCapacityProbeEvidence,
  validateIdeaCapacityProbeEvidence,
  validateIdeaCapacityProbeEvidenceProvenance,
  validateIdeaCapacityResource,
  validateIdeaCapacityWorkload,
} from "../../scripts/live/validation/idea-capacity-probe-evidence.mjs";

const resource = {
  schemaVersion: "lotus-idea.downstream-capacity-resource.v1",
  repository: "lotus-idea",
  proofScope: "current_authoritative_downstream_resource",
  claimPosture: "selected_conversion_intent_not_capacity_evidence",
  generatedAtUtc: "2026-07-11T08:00:00Z",
  commitSha: "a".repeat(40),
  branch: "main",
  runId: "canonical-front-office-2026-04-10",
  syntheticResource: false,
  candidateId: "idea_low_income_e9ebd53b16f209b0",
  conversionIntentId: "conversion-intent-0123456789abcdef",
  conversionIntentAcceptedAtUtc: "2026-07-11T08:00:00Z",
  downstreamSubmissionPath:
    "/api/v1/conversion-intents/conversion-intent-0123456789abcdef/downstream-submissions",
  productionCapacityCertified: false,
  supportedFeaturePromoted: false,
} as const;

const expected = {
  commitSha: resource.commitSha,
  branch: resource.branch,
  runId: resource.runId,
  candidateId: resource.candidateId,
};
const serializedResource = `${JSON.stringify(resource)}\n`;
const workload = {
  schemaVersion: "lotus-idea.service-capacity-baseline.v1",
  repository: "lotus-idea",
  proofScope: "source_safe_service_capacity_baseline",
  claimPosture: "report_only_baseline",
  environmentProfile: "test",
  commitSha: resource.commitSha,
  branch: resource.branch,
  runId: resource.runId,
  downstreamCapacityResourceSha256: createHash("sha256")
    .update(serializedResource)
    .digest("hex"),
  scenarios: [
    {
      scenario: "downstream_submission",
      sampleCount: 1,
      acceptedCount: 1,
      errorCount: 0,
      conflictCount: 0,
    },
  ],
  certificationReady: false,
  certificationBlockers: ["load_soak_attestation_missing"],
  supportedFeaturePromoted: false,
};

describe("Idea capacity probe evidence", () => {
  it("retains provenance and hashes without copying resource identity", () => {
    validateIdeaCapacityResource(resource, expected);
    const evidence = buildIdeaCapacityProbeEvidence({
      resourceBytes: Buffer.from(JSON.stringify(resource)),
      resourceFileName: "idea-capacity-resource.json",
      payload: resource,
      workloadBytes: Buffer.from(JSON.stringify(workload)),
      workloadFileName: "idea-capacity-probe-workload.json",
    });

    expect(evidence).toMatchObject({
      posture: "accepted_non_certifying",
      commitSha: resource.commitSha,
      branch: "main",
      syntheticResource: false,
      presentationBackedResource: true,
      capacityWorkloadAccepted: true,
      productionCapacityCertified: false,
      supportedFeaturePromoted: false,
    });
    expect(JSON.stringify(evidence)).not.toContain("conversionIntentId");
    expect(JSON.stringify(evidence)).not.toContain("downstreamSubmissionPath");
    expect(() => validateIdeaCapacityProbeEvidence(evidence)).not.toThrow();
  });

  it("requires one accepted source-safe Idea downstream workload", () => {
    expect(() => validateIdeaCapacityWorkload(workload, expected)).not.toThrow();
    expect(() =>
      validateIdeaCapacityWorkload(
        {
          ...workload,
          scenarios: [
            { scenario: "api", sampleCount: 0, acceptedCount: 0, errorCount: 0 },
            workload.scenarios[0],
          ],
        },
        expected,
      ),
    ).not.toThrow();
    expect(() =>
      validateIdeaCapacityWorkload(
        {
          ...workload,
          scenarios: [{ ...workload.scenarios[0], acceptedCount: 0, errorCount: 1 }],
        },
        expected,
      ),
    ).toThrow(/exactly one downstream probe/);
  });

  it("rejects evidence from a different runtime or canonical run", () => {
    expect(() => validateIdeaCapacityProbeEvidenceProvenance(resource, expected)).not.toThrow();
    expect(() =>
      validateIdeaCapacityProbeEvidenceProvenance(resource, {
        ...expected,
        commitSha: "b".repeat(40),
      }),
    ).toThrow(/current commitSha/);
    expect(() =>
      validateIdeaCapacityProbeEvidenceProvenance(resource, {
        ...expected,
        branch: "feat/stale-runtime",
      }),
    ).toThrow(/current branch/);
    expect(() =>
      validateIdeaCapacityProbeEvidenceProvenance(resource, {
        ...expected,
        runId: "canonical-front-office-2026-04-11",
      }),
    ).toThrow(/current runId/);
  });

  it.each([
    ["wrong commit", { commitSha: "b".repeat(40) }],
    ["certification inflation", { productionCapacityCertified: true }],
    ["feature inflation", { supportedFeaturePromoted: true }],
    ["synthetic resource", { syntheticResource: true }],
    ["unapproved path", { downstreamSubmissionPath: "/api/v1/clients/1" }],
    ["missing candidate", { candidateId: "" }],
    ["different browser candidate", { candidateId: "idea_low_income_0123456789abcdef" }],
  ])("rejects %s", (_name, mutation) => {
    expect(() => validateIdeaCapacityResource({ ...resource, ...mutation }, expected)).toThrow();
  });

  it("writes deterministic source-safe evidence atomically", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "idea-capacity-probe-"));
    const resourcePath = path.join(directory, "resource.json");
    const evidencePath = path.join(directory, "evidence.json");
    const workloadPath = path.join(directory, "workload.json");
    await writeFile(resourcePath, serializedResource, "utf8");
    await writeFile(workloadPath, `${JSON.stringify(workload)}\n`, "utf8");

    await validateAndWriteIdeaCapacityProbeEvidence({
      resourcePath,
      workloadPath,
      evidencePath,
      ...expected,
    });

    const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
    expect(evidence.resourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(evidence.resourceFileName).toBe("resource.json");
    await expect(loadIdeaCapacityProbeEvidence(evidencePath)).resolves.toEqual(evidence);
  });

  it("rejects workload evidence produced from another selected resource", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "idea-capacity-probe-mismatch-"));
    const resourcePath = path.join(directory, "resource.json");
    const evidencePath = path.join(directory, "evidence.json");
    const workloadPath = path.join(directory, "workload.json");
    await writeFile(resourcePath, serializedResource, "utf8");
    await writeFile(
      workloadPath,
      `${JSON.stringify({ ...workload, downstreamCapacityResourceSha256: "b".repeat(64) })}\n`,
      "utf8",
    );

    await expect(
      validateAndWriteIdeaCapacityProbeEvidence({
        resourcePath,
        workloadPath,
        evidencePath,
        ...expected,
      }),
    ).rejects.toThrow(/does not match the selected resource/);
  });

  it("rejects downgraded or resource-bearing Workbench evidence", () => {
    const evidence = buildIdeaCapacityProbeEvidence({
      resourceBytes: Buffer.from(JSON.stringify(resource)),
      resourceFileName: "resource.json",
      payload: resource,
      workloadBytes: Buffer.from(JSON.stringify(workload)),
      workloadFileName: "workload.json",
    });
    expect(() =>
      validateIdeaCapacityProbeEvidence({
        ...evidence,
        capacityWorkloadAccepted: false,
      }),
    ).toThrow(/capacityWorkloadAccepted/);
    expect(() =>
      validateIdeaCapacityProbeEvidence({
        ...evidence,
        conversionIntentId: resource.conversionIntentId,
      }),
    ).toThrow(/forbidden/);
  });
});
