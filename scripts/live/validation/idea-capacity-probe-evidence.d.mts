export interface IdeaCapacityProbeExpectedProvenance {
  commitSha: string;
  branch: string;
  runId: string;
}

export interface IdeaCapacityResourceExpectation
  extends IdeaCapacityProbeExpectedProvenance {
  candidateId: string;
}

interface IdeaCapacityResourceBase extends IdeaCapacityProbeExpectedProvenance {
  schemaVersion: "lotus-idea.downstream-capacity-resource.v2";
  repository: "lotus-idea";
  proofScope: "governed_downstream_resource_state";
  claimPosture: "selected_resource_state_not_capacity_evidence";
  generatedAtUtc: string;
  syntheticResource: false;
  candidateId: string;
  conversionIntentId: string;
  conversionIntentAcceptedAtUtc: string;
  productionCapacityCertified: false;
  supportedFeaturePromoted: false;
}

export interface FreshIdeaCapacityResource extends IdeaCapacityResourceBase {
  resourcePosture: "fresh_authorized_submission";
  downstreamSubmissionPath: string;
  retainedAcceptedSubmissionVerified: false;
}

export interface RetainedIdeaCapacityResource extends IdeaCapacityResourceBase {
  resourcePosture: "retained_accepted_submission";
  retainedAcceptedSubmissionVerified: true;
  ownerSourceAuthority: "lotus-advise";
  ownerSourceEventVersion: number;
}

export type IdeaCapacityResource =
  | FreshIdeaCapacityResource
  | RetainedIdeaCapacityResource;

interface IdeaCapacityProbeEvidenceBase extends IdeaCapacityProbeExpectedProvenance {
  schemaVersion: "lotus-workbench.idea-capacity-probe-evidence.v2";
  posture: "accepted_non_certifying";
  resourceFileName: string;
  resourceSha256: string;
  repository: "lotus-idea";
  proofScope: "governed_downstream_resource_state";
  claimPosture: "selected_resource_state_not_capacity_evidence";
  syntheticResource: false;
  presentationBackedResource: true;
  integrationProofAccepted: true;
  productionCapacityCertified: false;
  supportedFeaturePromoted: false;
}

export interface FreshIdeaCapacityProbeEvidence extends IdeaCapacityProbeEvidenceBase {
  resourcePosture: "fresh_authorized_submission";
  workloadFileName: string;
  workloadSha256: string;
  capacityWorkloadAccepted: true;
  retainedAcceptedSubmissionVerified: false;
}

export interface RetainedIdeaCapacityProbeEvidence extends IdeaCapacityProbeEvidenceBase {
  resourcePosture: "retained_accepted_submission";
  capacityWorkloadAccepted: false;
  retainedAcceptedSubmissionVerified: true;
  ownerSourceAuthority: "lotus-advise";
  ownerSourceEventVersion: number;
}

export type IdeaCapacityProbeEvidence =
  | FreshIdeaCapacityProbeEvidence
  | RetainedIdeaCapacityProbeEvidence;

export function validateIdeaCapacityResource(
  payload: unknown,
  expected: IdeaCapacityResourceExpectation,
): "fresh_authorized_submission" | "retained_accepted_submission";

export function buildIdeaCapacityProbeEvidence(input: {
  resourceBytes: Uint8Array;
  resourceFileName: string;
  payload: IdeaCapacityResource;
  workloadBytes?: Uint8Array;
  workloadFileName?: string;
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
    workloadPath?: string;
    evidencePath: string;
  } & IdeaCapacityResourceExpectation,
): Promise<IdeaCapacityProbeEvidence>;
