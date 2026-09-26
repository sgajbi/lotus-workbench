import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  schemaVersion: "lotus-idea.downstream-capacity-resource.v2",
  repository: "lotus-idea",
  proofScope: "governed_downstream_resource_state",
  claimPosture: "selected_resource_state_not_capacity_evidence",
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
  resourcePosture: "fresh_authorized_submission",
  retainedAcceptedSubmissionVerified: false,
  productionCapacityCertified: false,
  supportedFeaturePromoted: false,
} as const;

const retainedResource = {
  schemaVersion: resource.schemaVersion,
  repository: resource.repository,
  proofScope: resource.proofScope,
  claimPosture: resource.claimPosture,
  generatedAtUtc: resource.generatedAtUtc,
  commitSha: resource.commitSha,
  branch: resource.branch,
  runId: resource.runId,
  syntheticResource: resource.syntheticResource,
  candidateId: resource.candidateId,
  conversionIntentId: resource.conversionIntentId,
  conversionIntentAcceptedAtUtc: resource.conversionIntentAcceptedAtUtc,
  resourcePosture: "retained_accepted_submission",
  retainedAcceptedSubmissionVerified: true,
  ownerSourceAuthority: "lotus-advise",
  ownerSourceEventVersion: 1,
  productionCapacityCertified: resource.productionCapacityCertified,
  supportedFeaturePromoted: resource.supportedFeaturePromoted,
} as const;

const expected = {
  commitSha: resource.commitSha,
  branch: resource.branch,
  runId: resource.runId,
  candidateId: resource.candidateId,
};
const serializedResource = `${JSON.stringify(resource)}\n`;
const temporaryDirectories = new Set<string>();

async function createTemporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryDirectories.add(directory);
  return directory;
}

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
  afterEach(async () => {
    await Promise.all(
      [...temporaryDirectories].map((directory) =>
        rm(directory, { recursive: true, force: true }),
      ),
    );
    temporaryDirectories.clear();
  });

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
      integrationProofAccepted: true,
      resourcePosture: "fresh_authorized_submission",
      capacityWorkloadAccepted: true,
      retainedAcceptedSubmissionVerified: false,
      productionCapacityCertified: false,
      supportedFeaturePromoted: false,
    });
    expect(JSON.stringify(evidence)).not.toContain("conversionIntentId");
    expect(JSON.stringify(evidence)).not.toContain("downstreamSubmissionPath");
    expect(() => validateIdeaCapacityProbeEvidence(evidence)).not.toThrow();
  });

  it("accepts retained owner evidence without creating a workload claim", () => {
    validateIdeaCapacityResource(retainedResource, expected);
    const evidence = buildIdeaCapacityProbeEvidence({
      resourceBytes: Buffer.from(JSON.stringify(retainedResource)),
      resourceFileName: "idea-capacity-resource.json",
      payload: retainedResource,
    });

    expect(evidence).toMatchObject({
      resourcePosture: "retained_accepted_submission",
      integrationProofAccepted: true,
      capacityWorkloadAccepted: false,
      retainedAcceptedSubmissionVerified: true,
      ownerSourceAuthority: "lotus-advise",
      ownerSourceEventVersion: 1,
    });
    expect(evidence).not.toHaveProperty("workloadFileName");
    expect(evidence).not.toHaveProperty("workloadSha256");
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
    ["retained flag on fresh resource", { retainedAcceptedSubmissionVerified: true }],
    ["retained owner on fresh resource", { ownerSourceAuthority: "lotus-advise" }],
    ["retained owner version on fresh resource", { ownerSourceEventVersion: 1 }],
    ["missing candidate", { candidateId: "" }],
    ["different browser candidate", { candidateId: "idea_low_income_0123456789abcdef" }],
  ])("rejects %s", (_name, mutation) => {
    expect(() => validateIdeaCapacityResource({ ...resource, ...mutation }, expected)).toThrow();
  });

  it.each([
    ["missing conversion intent identity", { conversionIntentId: "" }],
    ["non-string conversion intent identity", { conversionIntentId: 123 }],
    ["missing acceptance timestamp", { conversionIntentAcceptedAtUtc: "" }],
    [
      "non-UTC acceptance timestamp",
      { conversionIntentAcceptedAtUtc: "2026-07-11T16:00:00+08:00" },
    ],
    ["invalid acceptance timestamp", { conversionIntentAcceptedAtUtc: "2026-13-40T08:00:00Z" }],
    ["impossible calendar date", { conversionIntentAcceptedAtUtc: "2026-02-30T08:00:00Z" }],
    ["missing resource generation timestamp", { generatedAtUtc: "" }],
    ["acceptance after resource generation", { generatedAtUtc: "2026-07-11T07:59:59Z" }],
    [
      "sub-millisecond acceptance after resource generation",
      {
        conversionIntentAcceptedAtUtc: "2026-07-11T08:00:00.000999Z",
        generatedAtUtc: "2026-07-11T08:00:00.000001Z",
      },
    ],
  ])("rejects retained state with %s", (_name, mutation) => {
    expect(() =>
      validateIdeaCapacityResource({ ...retainedResource, ...mutation }, expected),
    ).toThrow(/identity or acceptance chronology/);
  });

  it.each([
    ["mutation path", { downstreamSubmissionPath: resource.downstreamSubmissionPath }],
    ["missing retained verification", { retainedAcceptedSubmissionVerified: false }],
    ["wrong owner", { ownerSourceAuthority: "lotus-report" }],
    ["invalid owner version", { ownerSourceEventVersion: 0 }],
    ["unsafe owner version", { ownerSourceEventVersion: Number.MAX_SAFE_INTEGER + 1 }],
  ])("rejects retained state with %s", (_name, mutation) => {
    expect(() =>
      validateIdeaCapacityResource({ ...retainedResource, ...mutation }, expected),
    ).toThrow(/owner evidence/);
  });

  it("writes retained evidence without a workload file", async () => {
    const directory = await createTemporaryDirectory("idea-retained-capacity-probe-");
    const resourcePath = path.join(directory, "resource.json");
    const evidencePath = path.join(directory, "evidence.json");
    await writeFile(resourcePath, `${JSON.stringify(retainedResource)}\n`, "utf8");

    await validateAndWriteIdeaCapacityProbeEvidence({
      resourcePath,
      evidencePath,
      ...expected,
    });

    const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
    expect(evidence.resourcePosture).toBe("retained_accepted_submission");
    expect(evidence.capacityWorkloadAccepted).toBe(false);
    expect(evidence).not.toHaveProperty("workloadSha256");
  });

  it("refuses workload evidence for retained accepted state", async () => {
    const directory = await createTemporaryDirectory("idea-retained-with-workload-");
    const resourcePath = path.join(directory, "resource.json");
    const evidencePath = path.join(directory, "evidence.json");
    const workloadPath = path.join(directory, "workload.json");
    await writeFile(resourcePath, `${JSON.stringify(retainedResource)}\n`, "utf8");
    await writeFile(workloadPath, `${JSON.stringify(workload)}\n`, "utf8");

    await expect(
      validateAndWriteIdeaCapacityProbeEvidence({
        resourcePath,
        workloadPath,
        evidencePath,
        ...expected,
      }),
    ).rejects.toThrow(/forbids workload evidence/);
  });

  it("writes deterministic source-safe evidence atomically", async () => {
    const directory = await createTemporaryDirectory("idea-capacity-probe-");
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
    const directory = await createTemporaryDirectory("idea-capacity-probe-mismatch-");
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
    ).toThrow(/workload proof/);
    expect(() =>
      validateIdeaCapacityProbeEvidence({
        ...evidence,
        conversionIntentId: resource.conversionIntentId,
      }),
    ).toThrow(/forbidden/);
    expect(() =>
      validateIdeaCapacityProbeEvidence({
        ...evidence,
        ownerSourceAuthority: "lotus-advise",
        ownerSourceEventVersion: 1,
      }),
    ).toThrow(/workload proof/);

    const retainedEvidence = buildIdeaCapacityProbeEvidence({
      resourceBytes: Buffer.from(JSON.stringify(retainedResource)),
      resourceFileName: "retained-resource.json",
      payload: retainedResource,
    });
    expect(() =>
      validateIdeaCapacityProbeEvidence({
        ...retainedEvidence,
        workloadSha256: "b".repeat(64),
      }),
    ).toThrow(/owner proof/);
    expect(() =>
      validateIdeaCapacityProbeEvidence({
        ...retainedEvidence,
        ownerSourceEventVersion: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toThrow(/owner proof/);
  });
});
