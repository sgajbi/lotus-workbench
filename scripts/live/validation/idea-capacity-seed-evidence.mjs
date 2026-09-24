import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const EXPECTED = Object.freeze({
  schemaVersion: "lotus-idea.downstream-capacity-seed.v1",
  repository: "lotus-idea",
  proofScope: "synthetic_downstream_capacity_resource_seed",
  claimPosture: "seed_only_not_capacity_evidence",
  syntheticResource: true,
  productionCapacityCertified: false,
  supportedFeaturePromoted: false,
});

const DOWNSTREAM_PATH = /^\/api\/v1\/conversion-intents\/capacity-conversion-[a-f0-9]{16}\/downstream-submissions$/;
const SYNTHETIC_NAMESPACE = "CAPACITY_SYNTHETIC_PORTFOLIO_001";

export function validateIdeaCapacitySeedManifest(
  payload,
  { commitSha, branch, runId },
) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Idea capacity seed manifest must be a JSON object");
  }
  for (const [field, expected] of Object.entries(EXPECTED)) {
    if (payload[field] !== expected) {
      throw new Error(`Idea capacity seed manifest has invalid ${field}`);
    }
  }
  for (const [field, expected] of Object.entries({ commitSha, branch, runId })) {
    if (typeof expected !== "string" || expected.length === 0 || payload[field] !== expected) {
      throw new Error(`Idea capacity seed manifest does not match expected ${field}`);
    }
  }
  if (!DOWNSTREAM_PATH.test(payload.downstreamSubmissionPath)) {
    throw new Error("Idea capacity seed manifest has an invalid downstream path");
  }
  if (
    typeof payload.conversionIntentId !== "string" ||
    !payload.downstreamSubmissionPath.includes(`/${payload.conversionIntentId}/`)
  ) {
    throw new Error("Idea capacity seed manifest resource identity is inconsistent");
  }
  if (payload.syntheticNamespace !== SYNTHETIC_NAMESPACE) {
    throw new Error("Idea capacity seed manifest does not use the isolated synthetic namespace");
  }
  const serialized = JSON.stringify(payload);
  for (const forbidden of [
    "PB_SG_GLOBAL_BAL_001",
    "CLIENT_SCOPE_PB_SG_GLOBAL_BAL_001",
    "tenant-sg",
    "BOOK_SG_BALANCED_DPM",
    "client-001",
    "tenant-private-bank-sg",
    "book-advisor-001",
  ]) {
    if (serialized.includes(forbidden)) {
      throw new Error("Idea capacity seed manifest contains canonical or client-scoped identity");
    }
  }
}

export function buildIdeaCapacitySeedEvidence({
  manifestBytes,
  manifestFileName,
  payload,
  workloadBytes,
  workloadFileName,
}) {
  return {
    schemaVersion: "lotus-workbench.idea-capacity-seed-evidence.v1",
    posture: "accepted_non_certifying",
    manifestFileName,
    manifestSha256: crypto.createHash("sha256").update(manifestBytes).digest("hex"),
    workloadFileName,
    workloadSha256: crypto.createHash("sha256").update(workloadBytes).digest("hex"),
    repository: payload.repository,
    commitSha: payload.commitSha,
    branch: payload.branch,
    runId: payload.runId,
    proofScope: payload.proofScope,
    claimPosture: payload.claimPosture,
    syntheticResource: true,
    capacityWorkloadAccepted: true,
    productionCapacityCertified: false,
    supportedFeaturePromoted: false,
    canonicalPortfolioUnaffected: true,
  };
}

export function validateIdeaCapacityWorkload(payload, { commitSha, branch, runId }) {
  const required = {
    schemaVersion: "lotus-idea.service-capacity-baseline.v1",
    repository: "lotus-idea",
    proofScope: "source_safe_service_capacity_baseline",
    claimPosture: "report_only_baseline",
    environmentProfile: "test",
    commitSha,
    branch,
    runId,
    certificationReady: false,
    supportedFeaturePromoted: false,
  };
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Idea capacity workload evidence must be a JSON object");
  }
  for (const [field, expected] of Object.entries(required)) {
    if (payload[field] !== expected) {
      throw new Error(`Idea capacity workload evidence has invalid ${field}`);
    }
  }
  const scenarios = Array.isArray(payload.scenarios) ? payload.scenarios : [];
  const downstreamScenarios = scenarios.filter(
    (scenario) => scenario?.scenario === "downstream_submission",
  );
  const downstream = downstreamScenarios[0];
  if (
    downstreamScenarios.length !== 1 ||
    !downstream ||
    downstream.scenario !== "downstream_submission" ||
    downstream.sampleCount !== 1 ||
    downstream.acceptedCount !== 1 ||
    downstream.errorCount !== 0 ||
    downstream.conflictCount !== 0
  ) {
    throw new Error("Idea capacity workload did not accept exactly one downstream probe");
  }
}

export function validateIdeaCapacitySeedEvidence(payload) {
  const required = {
    schemaVersion: "lotus-workbench.idea-capacity-seed-evidence.v1",
    posture: "accepted_non_certifying",
    repository: "lotus-idea",
    proofScope: "synthetic_downstream_capacity_resource_seed",
    claimPosture: "seed_only_not_capacity_evidence",
    syntheticResource: true,
    capacityWorkloadAccepted: true,
    productionCapacityCertified: false,
    supportedFeaturePromoted: false,
    canonicalPortfolioUnaffected: true,
  };
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Idea capacity seed evidence must be a JSON object");
  }
  for (const [field, expected] of Object.entries(required)) {
    if (payload[field] !== expected) {
      throw new Error(`Idea capacity seed evidence has invalid ${field}`);
    }
  }
  for (const field of [
    "manifestFileName",
    "workloadFileName",
    "commitSha",
    "branch",
    "runId",
  ]) {
    if (typeof payload[field] !== "string" || payload[field].length === 0) {
      throw new Error(`Idea capacity seed evidence is missing ${field}`);
    }
  }
  if (!/^[a-f0-9]{64}$/.test(payload.manifestSha256)) {
    throw new Error("Idea capacity seed evidence has invalid manifestSha256");
  }
  if (!/^[a-f0-9]{64}$/.test(payload.workloadSha256)) {
    throw new Error("Idea capacity seed evidence has invalid workloadSha256");
  }
  const serialized = JSON.stringify(payload);
  for (const forbidden of ["conversionIntentId", "downstreamSubmissionPath", "Authorization"]) {
    if (serialized.includes(forbidden)) {
      throw new Error("Idea capacity seed evidence contains forbidden resource or credential data");
    }
  }
}

export function validateIdeaCapacitySeedEvidenceProvenance(
  payload,
  { commitSha, branch, runId },
) {
  for (const [field, expected] of Object.entries({ commitSha, branch, runId })) {
    if (typeof expected !== "string" || expected.length === 0 || payload[field] !== expected) {
      throw new Error(`Idea capacity seed evidence does not match current ${field}`);
    }
  }
}

export async function loadIdeaCapacitySeedEvidence(evidencePath, expectedProvenance) {
  const payload = JSON.parse(await fs.readFile(evidencePath, "utf8"));
  validateIdeaCapacitySeedEvidence(payload);
  if (expectedProvenance) {
    validateIdeaCapacitySeedEvidenceProvenance(payload, expectedProvenance);
  }
  return payload;
}

export async function validateAndWriteIdeaCapacitySeedEvidence({
  manifestPath,
  workloadPath,
  evidencePath,
  commitSha,
  branch,
  runId,
}) {
  const manifestBytes = await fs.readFile(manifestPath);
  const payload = JSON.parse(manifestBytes.toString("utf8"));
  validateIdeaCapacitySeedManifest(payload, { commitSha, branch, runId });
  const workloadBytes = await fs.readFile(workloadPath);
  const workload = JSON.parse(workloadBytes.toString("utf8"));
  validateIdeaCapacityWorkload(workload, { commitSha, branch, runId });
  const evidence = buildIdeaCapacitySeedEvidence({
    manifestBytes,
    manifestFileName: path.basename(manifestPath),
    payload,
    workloadBytes,
    workloadFileName: path.basename(workloadPath),
  });
  await fs.mkdir(path.dirname(evidencePath), { recursive: true });
  const temporaryPath = `${evidencePath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, evidencePath);
  return evidence;
}
