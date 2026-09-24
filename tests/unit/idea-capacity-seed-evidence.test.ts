import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  buildIdeaCapacitySeedEvidence,
  loadIdeaCapacitySeedEvidence,
  validateAndWriteIdeaCapacitySeedEvidence,
  validateIdeaCapacitySeedEvidence,
  validateIdeaCapacitySeedEvidenceProvenance,
  validateIdeaCapacitySeedManifest,
  validateIdeaCapacityWorkload,
} from "../../scripts/live/validation/idea-capacity-seed-evidence.mjs";

const manifest = {
  schemaVersion: "lotus-idea.downstream-capacity-seed.v1",
  repository: "lotus-idea",
  proofScope: "synthetic_downstream_capacity_resource_seed",
  claimPosture: "seed_only_not_capacity_evidence",
  generatedAtUtc: "2026-07-11T08:00:00Z",
  commitSha: "a".repeat(40),
  branch: "main",
  runId: "canonical-front-office-2026-04-10",
  syntheticResource: true,
  syntheticNamespace: "CAPACITY_SYNTHETIC_PORTFOLIO_001",
  conversionIntentId: "capacity-conversion-0123456789abcdef",
  downstreamSubmissionPath:
    "/api/v1/conversion-intents/capacity-conversion-0123456789abcdef/downstream-submissions",
  productionCapacityCertified: false,
  supportedFeaturePromoted: false,
} as const;

const expected = {
  commitSha: manifest.commitSha,
  branch: manifest.branch,
  runId: manifest.runId,
};
const workload = {
  schemaVersion: "lotus-idea.service-capacity-baseline.v1",
  repository: "lotus-idea",
  proofScope: "source_safe_service_capacity_baseline",
  claimPosture: "report_only_baseline",
  environmentProfile: "test",
  commitSha: manifest.commitSha,
  branch: manifest.branch,
  runId: manifest.runId,
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

describe("Idea capacity seed evidence", () => {
  it("retains provenance and hash without copying resource identity", () => {
    validateIdeaCapacitySeedManifest(manifest, expected);
    const evidence = buildIdeaCapacitySeedEvidence({
      manifestBytes: Buffer.from(JSON.stringify(manifest)),
      manifestFileName: "idea-capacity-seed-manifest.json",
      payload: manifest,
      workloadBytes: Buffer.from(JSON.stringify(workload)),
      workloadFileName: "idea-capacity-seed-workload.json",
    });

    expect(evidence).toMatchObject({
      posture: "accepted_non_certifying",
      commitSha: manifest.commitSha,
      branch: "main",
      syntheticResource: true,
      capacityWorkloadAccepted: true,
      productionCapacityCertified: false,
      supportedFeaturePromoted: false,
      canonicalPortfolioUnaffected: true,
    });
    expect(JSON.stringify(evidence)).not.toContain("conversionIntentId");
    expect(JSON.stringify(evidence)).not.toContain("downstreamSubmissionPath");
    expect(() => validateIdeaCapacitySeedEvidence(evidence)).not.toThrow();
  });

  it("requires one accepted source-safe Idea downstream workload", () => {
    expect(() => validateIdeaCapacityWorkload(workload, expected)).not.toThrow();
    expect(() =>
      validateIdeaCapacityWorkload(
        {
          ...workload,
          scenarios: [
            {
              scenario: "api",
              sampleCount: 0,
              acceptedCount: 0,
              errorCount: 0,
              conflictCount: 0,
            },
            workload.scenarios[0],
            {
              scenario: "source_ingestion",
              sampleCount: 0,
              acceptedCount: 0,
              errorCount: 0,
              conflictCount: 0,
            },
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
    expect(() =>
      validateIdeaCapacityWorkload(
        {
          ...workload,
          scenarios: [
            workload.scenarios[0],
            { ...workload.scenarios[0], acceptedCount: 0, errorCount: 1 },
          ],
        },
        expected,
      ),
    ).toThrow(/exactly one downstream probe/);
  });

  it("rejects evidence from a different runtime or canonical run", () => {
    expect(() => validateIdeaCapacitySeedEvidenceProvenance(manifest, expected)).not.toThrow();
    expect(() =>
      validateIdeaCapacitySeedEvidenceProvenance(manifest, {
        ...expected,
        commitSha: "b".repeat(40),
      }),
    ).toThrow(/current commitSha/);
    expect(() =>
      validateIdeaCapacitySeedEvidenceProvenance(manifest, {
        ...expected,
        branch: "feat/stale-runtime",
      }),
    ).toThrow(/current branch/);
    expect(() =>
      validateIdeaCapacitySeedEvidenceProvenance(manifest, {
        ...expected,
        runId: "canonical-front-office-2026-04-11",
      }),
    ).toThrow(/current runId/);
  });

  it.each([
    ["wrong commit", { commitSha: "b".repeat(40) }],
    ["certification inflation", { productionCapacityCertified: true }],
    ["feature inflation", { supportedFeaturePromoted: true }],
    ["canonical portfolio leakage", { runId: "PB_SG_GLOBAL_BAL_001" }],
    ["canonical tenant leakage", { runId: "tenant-sg" }],
    ["canonical book leakage", { runId: "BOOK_SG_BALANCED_DPM" }],
    [
      "canonical client leakage",
      { runId: "CLIENT_SCOPE_PB_SG_GLOBAL_BAL_001" },
    ],
    ["unapproved path", { downstreamSubmissionPath: "/api/v1/clients/1" }],
    ["unapproved synthetic namespace", { syntheticNamespace: "OTHER_SYNTHETIC_001" }],
  ])("rejects %s", (_name, mutation) => {
    expect(() =>
      validateIdeaCapacitySeedManifest({ ...manifest, ...mutation }, expected),
    ).toThrow();
  });

  it("writes deterministic source-safe evidence atomically", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "idea-capacity-seed-"));
    const manifestPath = path.join(directory, "manifest.json");
    const evidencePath = path.join(directory, "evidence.json");
    const workloadPath = path.join(directory, "workload.json");
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`, "utf8");
    await writeFile(workloadPath, `${JSON.stringify(workload)}\n`, "utf8");

    await validateAndWriteIdeaCapacitySeedEvidence({
      manifestPath,
      workloadPath,
      evidencePath,
      ...expected,
    });

    const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
    expect(evidence.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(evidence.manifestFileName).toBe("manifest.json");
    await expect(loadIdeaCapacitySeedEvidence(evidencePath)).resolves.toEqual(evidence);
  });

  it("rejects downgraded or resource-bearing Workbench evidence", () => {
    const evidence = buildIdeaCapacitySeedEvidence({
      manifestBytes: Buffer.from(JSON.stringify(manifest)),
      manifestFileName: "manifest.json",
      payload: manifest,
      workloadBytes: Buffer.from(JSON.stringify(workload)),
      workloadFileName: "workload.json",
    });
    expect(() =>
      validateIdeaCapacitySeedEvidence({
        ...evidence,
        capacityWorkloadAccepted: false,
      }),
    ).toThrow(/capacityWorkloadAccepted/);
    expect(() =>
      validateIdeaCapacitySeedEvidence({
        ...evidence,
        conversionIntentId: manifest.conversionIntentId,
      }),
    ).toThrow(/forbidden/);
  });
});
