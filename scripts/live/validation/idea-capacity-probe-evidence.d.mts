export interface IdeaCapacityResource {
  schemaVersion: "lotus-idea.downstream-capacity-resource.v1";
  repository: "lotus-idea";
  proofScope: "current_authoritative_downstream_resource";
  claimPosture: "selected_conversion_intent_not_capacity_evidence";
  generatedAtUtc: string;
  commitSha: string;
  branch: string;
  runId: string;
  syntheticResource: false;
  candidateId: string;
  conversionIntentId: string;
  conversionIntentAcceptedAtUtc: string;
  downstreamSubmissionPath: string;
  productionCapacityCertified: false;
  supportedFeaturePromoted: false;
}

export interface IdeaCapacityProbeExpectedProvenance {
  commitSha: string;
  branch: string;
  runId: string;
}

export interface IdeaCapacityResourceExpectation
  extends IdeaCapacityProbeExpectedProvenance {
  candidateId: string;
}

export interface IdeaCapacityProbeEvidence {
  schemaVersion: "lotus-workbench.idea-capacity-probe-evidence.v1";
  posture: "accepted_non_certifying";
  resourceFileName: string;
  resourceSha256: string;
  workloadFileName: string;
  workloadSha256: string;
  repository: "lotus-idea";
  commitSha: string;
  branch: string;
  runId: string;
  proofScope: "current_authoritative_downstream_resource";
  claimPosture: "selected_conversion_intent_not_capacity_evidence";
  syntheticResource: false;
  presentationBackedResource: true;
  capacityWorkloadAccepted: true;
  productionCapacityCertified: false;
  supportedFeaturePromoted: false;
}

export function validateIdeaCapacityResource(
  payload: unknown,
  expected: IdeaCapacityResourceExpectation,
): asserts payload is IdeaCapacityResource;

export function buildIdeaCapacityProbeEvidence(input: {
  resourceBytes: Uint8Array;
  resourceFileName: string;
  payload: IdeaCapacityResource;
  workloadBytes: Uint8Array;
  workloadFileName: string;
}): IdeaCapacityProbeEvidence;

export function validateIdeaCapacityWorkload(
  payload: unknown,
  expected: IdeaCapacityProbeExpectedProvenance,
): void;

export function validateIdeaCapacityProbeEvidence(
  payload: unknown,
): asserts payload is IdeaCapacityProbeEvidence;

export function validateIdeaCapacityProbeEvidenceProvenance(
  payload: IdeaCapacityProbeEvidence | IdeaCapacityResource,
  expected: IdeaCapacityProbeExpectedProvenance,
): void;

export function loadIdeaCapacityProbeEvidence(
  evidencePath: string,
  expectedProvenance?: IdeaCapacityProbeExpectedProvenance,
): Promise<IdeaCapacityProbeEvidence>;

export function validateAndWriteIdeaCapacityProbeEvidence(
  input: {
    resourcePath: string;
    workloadPath: string;
    evidencePath: string;
  } & IdeaCapacityResourceExpectation,
): Promise<IdeaCapacityProbeEvidence>;
