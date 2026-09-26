import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const EXPECTED = Object.freeze({
  schemaVersion: "lotus-idea.downstream-capacity-resource.v2",
  repository: "lotus-idea",
  proofScope: "governed_downstream_resource_state",
  claimPosture: "selected_resource_state_not_capacity_evidence",
  syntheticResource: false,
  productionCapacityCertified: false,
  supportedFeaturePromoted: false,
});

const DOWNSTREAM_PATH = /^\/api\/v1\/conversion-intents\/[A-Za-z0-9._:-]{1,200}\/downstream-submissions$/;
const CONVERSION_INTENT_ID = /^[A-Za-z0-9._:-]{1,200}$/;
const UTC_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/;

function parseUtcInstantNanoseconds(value) {
  if (typeof value !== "string") return null;
  const match = UTC_INSTANT.exec(value);
  const timestamp = Date.parse(value);
  if (!match || !Number.isFinite(timestamp)) return null;
  const instant = new Date(timestamp);
  const isExactCalendarInstant =
    instant.getUTCFullYear() === Number(match[1]) &&
    instant.getUTCMonth() + 1 === Number(match[2]) &&
    instant.getUTCDate() === Number(match[3]) &&
    instant.getUTCHours() === Number(match[4]) &&
    instant.getUTCMinutes() === Number(match[5]) &&
    instant.getUTCSeconds() === Number(match[6]);
  if (!isExactCalendarInstant) return null;
  const wholeSecond = Date.parse(`${value.slice(0, 19)}Z`);
  const fractionalNanoseconds = BigInt((match[7] ?? "").padEnd(9, "0"));
  return BigInt(wholeSecond / 1000) * 1_000_000_000n + fractionalNanoseconds;
}

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
  if (
    typeof candidateId !== "string" ||
    candidateId.length === 0 ||
    payload.candidateId !== candidateId
  ) {
    throw new Error("Idea capacity resource does not match the browser candidate");
  }
  const acceptedAtNanoseconds = parseUtcInstantNanoseconds(
    payload.conversionIntentAcceptedAtUtc,
  );
  const generatedAtNanoseconds = parseUtcInstantNanoseconds(payload.generatedAtUtc);
  if (
    typeof payload.conversionIntentId !== "string" ||
    !CONVERSION_INTENT_ID.test(payload.conversionIntentId) ||
    acceptedAtNanoseconds === null ||
    generatedAtNanoseconds === null ||
    acceptedAtNanoseconds > generatedAtNanoseconds
  ) {
    throw new Error("Idea capacity resource identity or acceptance chronology is inconsistent");
  }
  if (payload.resourcePosture === "fresh_authorized_submission") {
    if (
      payload.retainedAcceptedSubmissionVerified !== false ||
      Object.hasOwn(payload, "ownerSourceAuthority") ||
      Object.hasOwn(payload, "ownerSourceEventVersion")
    ) {
      throw new Error("Fresh Idea capacity resource has invalid retained-state posture");
    }
    if (!DOWNSTREAM_PATH.test(payload.downstreamSubmissionPath)) {
      throw new Error("Idea capacity resource has an invalid downstream path");
    }
    if (!payload.downstreamSubmissionPath.includes(`/${payload.conversionIntentId}/`)) {
      throw new Error("Idea capacity resource identity is inconsistent");
    }
    return payload.resourcePosture;
  }
  if (payload.resourcePosture === "retained_accepted_submission") {
    if (
      payload.retainedAcceptedSubmissionVerified !== true ||
      Object.hasOwn(payload, "downstreamSubmissionPath") ||
      payload.ownerSourceAuthority !== "lotus-advise" ||
      !Number.isSafeInteger(payload.ownerSourceEventVersion) ||
      payload.ownerSourceEventVersion <= 0
    ) {
      throw new Error("Retained Idea capacity resource has invalid owner evidence");
    }
    return payload.resourcePosture;
  }
  throw new Error("Idea capacity resource has invalid resourcePosture");
}

export function buildIdeaCapacityProbeEvidence({
  resourceBytes,
  resourceFileName,
  payload,
  workloadBytes,
  workloadFileName,
}) {
  const evidence = {
    schemaVersion: "lotus-workbench.idea-capacity-probe-evidence.v2",
    posture: "accepted_non_certifying",
    resourceFileName,
    resourceSha256: crypto.createHash("sha256").update(resourceBytes).digest("hex"),
    repository: payload.repository,
    commitSha: payload.commitSha,
    branch: payload.branch,
    runId: payload.runId,
    proofScope: payload.proofScope,
    claimPosture: payload.claimPosture,
    resourcePosture: payload.resourcePosture,
    syntheticResource: false,
    presentationBackedResource: true,
    integrationProofAccepted: true,
    capacityWorkloadAccepted: payload.resourcePosture === "fresh_authorized_submission",
    retainedAcceptedSubmissionVerified:
      payload.resourcePosture === "retained_accepted_submission",
    productionCapacityCertified: false,
    supportedFeaturePromoted: false,
  };
  if (payload.resourcePosture === "fresh_authorized_submission") {
    if (!workloadBytes || !workloadFileName) {
      throw new Error("Fresh Idea capacity evidence requires workload evidence");
    }
    evidence.workloadFileName = workloadFileName;
    evidence.workloadSha256 = crypto.createHash("sha256").update(workloadBytes).digest("hex");
  } else {
    evidence.ownerSourceAuthority = payload.ownerSourceAuthority;
    evidence.ownerSourceEventVersion = payload.ownerSourceEventVersion;
  }
  return evidence;
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
    schemaVersion: "lotus-workbench.idea-capacity-probe-evidence.v2",
    posture: "accepted_non_certifying",
    repository: "lotus-idea",
    proofScope: "governed_downstream_resource_state",
    claimPosture: "selected_resource_state_not_capacity_evidence",
    syntheticResource: false,
    presentationBackedResource: true,
    integrationProofAccepted: true,
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
  for (const field of ["resourceFileName", "commitSha", "branch", "runId"]) {
    if (typeof payload[field] !== "string" || payload[field].length === 0) {
      throw new Error(`Idea capacity probe evidence is missing ${field}`);
    }
  }
  if (!/^[a-f0-9]{64}$/.test(payload.resourceSha256)) {
    throw new Error("Idea capacity probe evidence has invalid resourceSha256");
  }
  if (payload.resourcePosture === "fresh_authorized_submission") {
    if (
      payload.capacityWorkloadAccepted !== true ||
      payload.retainedAcceptedSubmissionVerified !== false ||
      Object.hasOwn(payload, "ownerSourceAuthority") ||
      Object.hasOwn(payload, "ownerSourceEventVersion") ||
      typeof payload.workloadFileName !== "string" ||
      payload.workloadFileName.length === 0 ||
      !/^[a-f0-9]{64}$/.test(payload.workloadSha256)
    ) {
      throw new Error("Fresh Idea capacity probe evidence has invalid workload proof");
    }
  } else if (payload.resourcePosture === "retained_accepted_submission") {
    if (
      payload.capacityWorkloadAccepted !== false ||
      payload.retainedAcceptedSubmissionVerified !== true ||
      Object.hasOwn(payload, "workloadFileName") ||
      Object.hasOwn(payload, "workloadSha256") ||
      payload.ownerSourceAuthority !== "lotus-advise" ||
      !Number.isSafeInteger(payload.ownerSourceEventVersion) ||
      payload.ownerSourceEventVersion <= 0
    ) {
      throw new Error("Retained Idea capacity probe evidence has invalid owner proof");
    }
  } else {
    throw new Error("Idea capacity probe evidence has invalid resourcePosture");
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
  const resourcePosture = validateIdeaCapacityResource(payload, {
    commitSha,
    branch,
    runId,
    candidateId,
  });
  const resourceSha256 = crypto.createHash("sha256").update(resourceBytes).digest("hex");
  let workloadBytes;
  let workloadFileName;
  if (resourcePosture === "fresh_authorized_submission") {
    if (!workloadPath) {
      throw new Error("Fresh Idea capacity resource requires workload evidence");
    }
    workloadBytes = await fs.readFile(workloadPath);
    workloadFileName = path.basename(workloadPath);
    const workload = JSON.parse(workloadBytes.toString("utf8"));
    validateIdeaCapacityWorkload(workload, { commitSha, branch, runId });
    if (workload.downstreamCapacityResourceSha256 !== resourceSha256) {
      throw new Error("Idea capacity workload evidence does not match the selected resource");
    }
  } else if (workloadPath) {
    throw new Error("Retained Idea capacity resource forbids workload evidence");
  }
  const evidence = buildIdeaCapacityProbeEvidence({
    resourceBytes,
    resourceFileName: path.basename(resourcePath),
    payload,
    workloadBytes,
    workloadFileName,
  });
  await fs.mkdir(path.dirname(evidencePath), { recursive: true });
  const temporaryPath = `${evidencePath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, evidencePath);
  return evidence;
}
