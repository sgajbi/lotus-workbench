import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const EXPECTED = Object.freeze({
  schemaVersion: "lotus-idea.downstream-capacity-resource.v1",
  repository: "lotus-idea",
  proofScope: "current_authoritative_downstream_resource",
  claimPosture: "selected_conversion_intent_not_capacity_evidence",
  syntheticResource: false,
  productionCapacityCertified: false,
  supportedFeaturePromoted: false,
});

const DOWNSTREAM_PATH = /^\/api\/v1\/conversion-intents\/[A-Za-z0-9._:-]{1,200}\/downstream-submissions$/;

export function validateIdeaCapacityResource(
  payload,
  { commitSha, branch, runId, candidateId },
) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Idea capacity resource must be a JSON object");
  }
  for (const [field, expected] of Object.entries(EXPECTED)) {
    if (payload[field] !== expected) {
      throw new Error(`Idea capacity resource has invalid ${field}`);
    }
  }
  for (const [field, expected] of Object.entries({ commitSha, branch, runId })) {
    if (typeof expected !== "string" || expected.length === 0 || payload[field] !== expected) {
      throw new Error(`Idea capacity resource does not match expected ${field}`);
    }
  }
  if (!DOWNSTREAM_PATH.test(payload.downstreamSubmissionPath)) {
    throw new Error("Idea capacity resource has an invalid downstream path");
  }
  if (
    typeof payload.conversionIntentId !== "string" ||
    !payload.downstreamSubmissionPath.includes(`/${payload.conversionIntentId}/`)
  ) {
    throw new Error("Idea capacity resource identity is inconsistent");
  }
  if (
    typeof candidateId !== "string" ||
    candidateId.length === 0 ||
    payload.candidateId !== candidateId
  ) {
    throw new Error("Idea capacity resource does not match the browser candidate");
  }
}

export function buildIdeaCapacityProbeEvidence({
  resourceBytes,
  resourceFileName,
  payload,
  workloadBytes,
  workloadFileName,
}) {
  return {
    schemaVersion: "lotus-workbench.idea-capacity-probe-evidence.v1",
    posture: "accepted_non_certifying",
    resourceFileName,
    resourceSha256: crypto.createHash("sha256").update(resourceBytes).digest("hex"),
    workloadFileName,
    workloadSha256: crypto.createHash("sha256").update(workloadBytes).digest("hex"),
    repository: payload.repository,
    commitSha: payload.commitSha,
    branch: payload.branch,
    runId: payload.runId,
    proofScope: payload.proofScope,
    claimPosture: payload.claimPosture,
    syntheticResource: false,
    presentationBackedResource: true,
    capacityWorkloadAccepted: true,
    productionCapacityCertified: false,
    supportedFeaturePromoted: false,
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
  if (!/^[a-f0-9]{64}$/.test(payload.downstreamCapacityResourceSha256 ?? "")) {
    throw new Error("Idea capacity workload evidence has invalid downstream resource digest");
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

export function validateIdeaCapacityProbeEvidence(payload) {
  const required = {
    schemaVersion: "lotus-workbench.idea-capacity-probe-evidence.v1",
    posture: "accepted_non_certifying",
    repository: "lotus-idea",
    proofScope: "current_authoritative_downstream_resource",
    claimPosture: "selected_conversion_intent_not_capacity_evidence",
    syntheticResource: false,
    presentationBackedResource: true,
    capacityWorkloadAccepted: true,
    productionCapacityCertified: false,
    supportedFeaturePromoted: false,
  };
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Idea capacity probe evidence must be a JSON object");
  }
  for (const [field, expected] of Object.entries(required)) {
    if (payload[field] !== expected) {
      throw new Error(`Idea capacity probe evidence has invalid ${field}`);
    }
  }
  for (const field of [
    "resourceFileName",
    "workloadFileName",
    "commitSha",
    "branch",
    "runId",
  ]) {
    if (typeof payload[field] !== "string" || payload[field].length === 0) {
      throw new Error(`Idea capacity probe evidence is missing ${field}`);
    }
  }
  if (!/^[a-f0-9]{64}$/.test(payload.resourceSha256)) {
    throw new Error("Idea capacity probe evidence has invalid resourceSha256");
  }
  if (!/^[a-f0-9]{64}$/.test(payload.workloadSha256)) {
    throw new Error("Idea capacity probe evidence has invalid workloadSha256");
  }
  const serialized = JSON.stringify(payload);
  for (const forbidden of ["conversionIntentId", "downstreamSubmissionPath", "Authorization"]) {
    if (serialized.includes(forbidden)) {
      throw new Error("Idea capacity probe evidence contains forbidden resource or credential data");
    }
  }
}

export function validateIdeaCapacityProbeEvidenceProvenance(
  payload,
  { commitSha, branch, runId },
) {
  for (const [field, expected] of Object.entries({ commitSha, branch, runId })) {
    if (typeof expected !== "string" || expected.length === 0 || payload[field] !== expected) {
      throw new Error(`Idea capacity probe evidence does not match current ${field}`);
    }
  }
}

export async function loadIdeaCapacityProbeEvidence(evidencePath, expectedProvenance) {
  const payload = JSON.parse(await fs.readFile(evidencePath, "utf8"));
  validateIdeaCapacityProbeEvidence(payload);
  if (expectedProvenance) {
    validateIdeaCapacityProbeEvidenceProvenance(payload, expectedProvenance);
  }
  return payload;
}

export async function validateAndWriteIdeaCapacityProbeEvidence({
  resourcePath,
  workloadPath,
  evidencePath,
  commitSha,
  branch,
  runId,
  candidateId,
}) {
  const resourceBytes = await fs.readFile(resourcePath);
  const payload = JSON.parse(resourceBytes.toString("utf8"));
  validateIdeaCapacityResource(payload, { commitSha, branch, runId, candidateId });
  const workloadBytes = await fs.readFile(workloadPath);
  const workload = JSON.parse(workloadBytes.toString("utf8"));
  validateIdeaCapacityWorkload(workload, { commitSha, branch, runId });
  const resourceSha256 = crypto.createHash("sha256").update(resourceBytes).digest("hex");
  if (workload.downstreamCapacityResourceSha256 !== resourceSha256) {
    throw new Error("Idea capacity workload evidence does not match the selected resource");
  }
  const evidence = buildIdeaCapacityProbeEvidence({
    resourceBytes,
    resourceFileName: path.basename(resourcePath),
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
