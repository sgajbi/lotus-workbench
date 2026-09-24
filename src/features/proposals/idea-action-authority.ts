import type { AdvisorIdeaEvidenceIdentity } from "./idea-ai-explanation-contract";
import type { IdeaPresentationAuthority } from "./use-idea-presentation-receipts";
import type {
  AdvisorIdeaCandidateActionData,
  AdvisorIdeaConversionIntentRequest,
  AdvisorIdeaReviewAction,
  AdvisorIdeaReviewActionRequest,
  AdvisorIdeaReviewDecision,
} from "./types";
import {
  compareUtcEvidenceTimestamps,
  isUtcEvidenceTimestamp,
  utcTimestampsIdentifySameInstant,
} from "./utc-evidence";

const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/;
const REVIEW_ACTION_POSTURES = {
  approve_for_conversion: "approved_for_conversion",
  reject: "rejected",
  no_action: "no_action",
  suppress: "suppressed",
  snooze: "advisor_review_required",
  escalate_to_pm: "pm_review_required",
  escalate_to_compliance: "compliance_review_required",
} satisfies Record<AdvisorIdeaReviewAction, string>;

export type IdeaCandidateActionAuthority = {
  candidateId: string;
  expectedMaterialVersion: number;
  expectedEvidenceVersion: number;
  expectedEvidencePacketId: string;
  expectedEvidenceContentHash: `sha256:${string}`;
  expectedSourceRevisionVectorDigest: `sha256:${string}`;
  expectedSourceCutPosture: AdvisorIdeaReviewActionRequest["expectedSourceCutPosture"];
};

export type AcceptedIdeaReviewAuthority = IdeaCandidateActionAuthority & {
  reviewId: string;
  presentationReceiptId: string;
};

export function ideaSourceCutAuthorizesConversion(
  authority: IdeaCandidateActionAuthority | undefined,
): boolean {
  return Boolean(
    authority &&
    (authority.expectedSourceCutPosture === "coherent" ||
      authority.expectedSourceCutPosture ===
        "coherent_with_declared_tolerance"),
  );
}

export function buildIdeaCandidateActionAuthority({
  candidateId,
  detailCandidateId,
  candidateMaterialVersion,
  candidateEvidenceVersion,
  detailCandidateMaterialVersion,
  detailCandidateEvidenceVersion,
  evidenceIdentity,
  detailSourceCutPosture,
  queueEvidencePacketId,
  queueSourceCutPosture,
  queueSourceRevisionVectorDigest,
}: {
  candidateId: string;
  detailCandidateId: unknown;
  candidateMaterialVersion: unknown;
  candidateEvidenceVersion: unknown;
  detailCandidateMaterialVersion: unknown;
  detailCandidateEvidenceVersion: unknown;
  evidenceIdentity?: AdvisorIdeaEvidenceIdentity;
  detailSourceCutPosture: unknown;
  queueEvidencePacketId: unknown;
  queueSourceCutPosture: unknown;
  queueSourceRevisionVectorDigest: unknown;
}): IdeaCandidateActionAuthority | undefined {
  if (
    !candidateId.trim() ||
    detailCandidateId !== candidateId ||
    !isPositiveInteger(candidateMaterialVersion) ||
    !isPositiveInteger(candidateEvidenceVersion) ||
    detailCandidateMaterialVersion !== candidateMaterialVersion ||
    detailCandidateEvidenceVersion !== candidateEvidenceVersion ||
    !evidenceIdentity?.evidencePacketId.trim() ||
    (queueEvidencePacketId !== undefined &&
      queueEvidencePacketId !== evidenceIdentity.evidencePacketId) ||
    !isSha256Digest(evidenceIdentity.evidenceContentHash) ||
    !isSha256Digest(evidenceIdentity.sourceRevisionVectorDigest) ||
    evidenceIdentity.sourceRevisionVectorDigest !==
      queueSourceRevisionVectorDigest ||
    !isSourceCutPosture(queueSourceCutPosture) ||
    detailSourceCutPosture !== queueSourceCutPosture
  ) {
    return undefined;
  }
  return {
    candidateId,
    expectedMaterialVersion: candidateMaterialVersion,
    expectedEvidenceVersion: candidateEvidenceVersion,
    expectedEvidencePacketId: evidenceIdentity.evidencePacketId,
    expectedEvidenceContentHash: evidenceIdentity.evidenceContentHash,
    expectedSourceRevisionVectorDigest:
      evidenceIdentity.sourceRevisionVectorDigest,
    expectedSourceCutPosture: queueSourceCutPosture,
  };
}

export function buildIdeaReviewRequestAuthority(
  authority: IdeaCandidateActionAuthority,
  presentation: IdeaPresentationAuthority | undefined,
):
  | Omit<
      AdvisorIdeaReviewActionRequest,
      | "reviewId"
      | "action"
      | "reasonCodes"
      | "decidedAtUtc"
      | "suppressionReason"
      | "snoozedUntilUtc"
    >
  | undefined {
  if (!matchesPresentationAuthority(authority, presentation)) {
    return undefined;
  }
  return {
    reviewChannel: "workbench",
    presentationReceiptId: presentation.receiptId,
    ...withoutCandidateId(authority),
  };
}

export function readAcceptedIdeaReviewAuthority({
  candidateId,
  request,
  response,
}: {
  candidateId: string;
  request: AdvisorIdeaReviewActionRequest;
  response: AdvisorIdeaCandidateActionData;
}): AcceptedIdeaReviewAuthority | undefined {
  const decision = response.reviewDecision;
  if (
    !matchesIdeaReviewResponse({ candidateId, request, response }) ||
    !decision ||
    decision.resultingPosture !== "approved_for_conversion" ||
    request.action !== "approve_for_conversion"
  ) {
    return undefined;
  }
  return {
    candidateId,
    reviewId: request.reviewId,
    presentationReceiptId: request.presentationReceiptId,
    ...requestAuthority(request),
  };
}

export function readPersistedAcceptedIdeaReviewAuthority({
  authority,
  decisions,
  durableStorageBacked,
}: {
  authority: IdeaCandidateActionAuthority | undefined;
  decisions: AdvisorIdeaReviewDecision[] | undefined;
  durableStorageBacked: boolean;
}): AcceptedIdeaReviewAuthority | undefined {
  if (!authority || !durableStorageBacked) {
    return undefined;
  }
  const matchingDecisions = decisions?.filter(
    (decision) =>
      decision.candidateId === authority.candidateId &&
      decision.reviewChannel === "workbench" &&
      decision.candidateMaterialVersion === authority.expectedMaterialVersion &&
      decision.candidateEvidenceVersion === authority.expectedEvidenceVersion &&
      decision.evidencePacketId === authority.expectedEvidencePacketId &&
      decision.evidenceContentHash === authority.expectedEvidenceContentHash &&
      decision.sourceRevisionVectorDigest ===
        authority.expectedSourceRevisionVectorDigest &&
      decision.sourceCutPosture === authority.expectedSourceCutPosture,
  );
  if (
    !matchingDecisions?.length ||
    matchingDecisions.some(
      (decision) => !isUtcEvidenceTimestamp(decision.acceptedAtUtc),
    )
  ) {
    return undefined;
  }
  const orderedDecisions = matchingDecisions.sort(
    (left, right) =>
      compareUtcEvidenceTimestamps(right.acceptedAtUtc, left.acceptedAtUtc) ??
      0,
  );
  const latest = orderedDecisions[0];
  if (
    orderedDecisions[1] &&
    compareUtcEvidenceTimestamps(
      latest.acceptedAtUtc,
      orderedDecisions[1].acceptedAtUtc,
    ) === 0
  ) {
    return undefined;
  }
  if (
    !latest?.reviewId ||
    !latest.presentationReceiptId ||
    latest.acceptanceTimeSource !== "server_accepted" ||
    latest.grantsDownstreamAuthority !== false ||
    latest.action !== "approve_for_conversion" ||
    latest.resultingPosture !== "approved_for_conversion"
  ) {
    return undefined;
  }
  return {
    ...authority,
    reviewId: latest.reviewId,
    presentationReceiptId: latest.presentationReceiptId,
  };
}

export function matchesIdeaReviewResponse({
  candidateId,
  request,
  response,
}: {
  candidateId: string;
  request: AdvisorIdeaReviewActionRequest;
  response: AdvisorIdeaCandidateActionData;
}): boolean {
  const decision = response.reviewDecision;
  return Boolean(
    isAcceptedPersistence(response) &&
    decision &&
    decision.candidateId === candidateId &&
    decision.reviewId === request.reviewId &&
    decision.action === request.action &&
    decision.resultingPosture === REVIEW_ACTION_POSTURES[request.action] &&
    decision.reviewChannel === request.reviewChannel &&
    decision.presentationReceiptId === request.presentationReceiptId &&
    decision.candidateMaterialVersion === request.expectedMaterialVersion &&
    decision.candidateEvidenceVersion === request.expectedEvidenceVersion &&
    decision.evidencePacketId === request.expectedEvidencePacketId &&
    decision.evidenceContentHash === request.expectedEvidenceContentHash &&
    decision.sourceRevisionVectorDigest ===
      request.expectedSourceRevisionVectorDigest &&
    decision.sourceCutPosture === request.expectedSourceCutPosture &&
    sameStrings(decision.reasonCodes, request.reasonCodes) &&
    sameInstant(decision.decidedAtUtc, request.decidedAtUtc) &&
    isUtcEvidenceTimestamp(decision.acceptedAtUtc) &&
    decision.acceptanceTimeSource === "server_accepted" &&
    decision.grantsDownstreamAuthority === false,
  );
}

export function buildIdeaConversionRequestAuthority(
  current: IdeaCandidateActionAuthority | undefined,
  review: AcceptedIdeaReviewAuthority | undefined,
  presentation: IdeaPresentationAuthority | undefined,
):
  | Pick<
      AdvisorIdeaConversionIntentRequest,
      | "expectedReviewId"
      | "expectedMaterialVersion"
      | "expectedEvidenceVersion"
      | "expectedEvidencePacketId"
      | "expectedEvidenceContentHash"
      | "expectedSourceRevisionVectorDigest"
      | "expectedSourceCutPosture"
    >
  | undefined {
  if (
    !current ||
    !review ||
    !ideaSourceCutAuthorizesConversion(current) ||
    !sameEvidenceAuthority(current, review) ||
    !matchesPresentationAuthority(current, presentation)
  ) {
    return undefined;
  }
  return {
    expectedReviewId: review.reviewId,
    ...withoutCandidateId(current),
  };
}

function matchesPresentationAuthority(
  authority: IdeaCandidateActionAuthority,
  presentation: IdeaPresentationAuthority | undefined,
): presentation is IdeaPresentationAuthority {
  return Boolean(
    presentation &&
    presentation.candidateId === authority.candidateId &&
    presentation.evidencePacketId === authority.expectedEvidencePacketId &&
    presentation.candidateMaterialVersion ===
      authority.expectedMaterialVersion &&
    presentation.candidateEvidenceVersion ===
      authority.expectedEvidenceVersion &&
    presentation.sourceRevisionVectorDigest ===
      authority.expectedSourceRevisionVectorDigest &&
    presentation.sourceCutPosture === authority.expectedSourceCutPosture &&
    presentation.receiptId.trim(),
  );
}

export function matchesIdeaConversionResponse({
  candidateId,
  request,
  response,
}: {
  candidateId: string;
  request: AdvisorIdeaConversionIntentRequest;
  response: AdvisorIdeaCandidateActionData;
}): boolean {
  const intent = response.conversionIntent;
  return Boolean(
    isAcceptedPersistence(response) &&
    intent &&
    intent.candidateId === candidateId &&
    intent.conversionIntentId === request.conversionIntentId &&
    intent.target === request.target &&
    intent.reviewId === request.expectedReviewId &&
    intent.candidateMaterialVersion === request.expectedMaterialVersion &&
    intent.candidateEvidenceVersion === request.expectedEvidenceVersion &&
    intent.evidencePacketId === request.expectedEvidencePacketId &&
    intent.evidenceContentHash === request.expectedEvidenceContentHash &&
    intent.sourceRevisionVectorDigest ===
      request.expectedSourceRevisionVectorDigest &&
    intent.sourceCutPosture === request.expectedSourceCutPosture &&
    sameStrings(intent.reasonCodes, request.reasonCodes) &&
    sameInstant(intent.requestedAtUtc, request.requestedAtUtc) &&
    isUtcEvidenceTimestamp(intent.acceptedAtUtc) &&
    intent.acceptanceTimeSource === "server_accepted" &&
    intent.boundary === "intent_only" &&
    intent.grantsDownstreamAuthority === false,
  );
}

function requestAuthority(
  request: AdvisorIdeaReviewActionRequest,
): Omit<IdeaCandidateActionAuthority, "candidateId"> {
  return {
    expectedMaterialVersion: request.expectedMaterialVersion,
    expectedEvidenceVersion: request.expectedEvidenceVersion,
    expectedEvidencePacketId: request.expectedEvidencePacketId,
    expectedEvidenceContentHash: request.expectedEvidenceContentHash,
    expectedSourceRevisionVectorDigest:
      request.expectedSourceRevisionVectorDigest,
    expectedSourceCutPosture: request.expectedSourceCutPosture,
  };
}

function withoutCandidateId(
  authority: IdeaCandidateActionAuthority,
): Omit<IdeaCandidateActionAuthority, "candidateId"> {
  const { candidateId: _candidateId, ...evidence } = authority;
  return evidence;
}

function sameEvidenceAuthority(
  left: IdeaCandidateActionAuthority,
  right: IdeaCandidateActionAuthority,
): boolean {
  return (
    left.candidateId === right.candidateId &&
    left.expectedMaterialVersion === right.expectedMaterialVersion &&
    left.expectedEvidenceVersion === right.expectedEvidenceVersion &&
    left.expectedEvidencePacketId === right.expectedEvidencePacketId &&
    left.expectedEvidenceContentHash === right.expectedEvidenceContentHash &&
    left.expectedSourceRevisionVectorDigest ===
      right.expectedSourceRevisionVectorDigest &&
    left.expectedSourceCutPosture === right.expectedSourceCutPosture
  );
}

function isAcceptedPersistence(
  response: AdvisorIdeaCandidateActionData,
): boolean {
  return (
    response.durableStorageBacked === true &&
    (response.persistence?.decision === "accepted" ||
      response.persistence?.decision === "replayed")
  );
}

function sameStrings(left: string[] | undefined, right: string[]): boolean {
  return Boolean(
    left &&
    left.length === right.length &&
    left.every((value, index) => value === right[index]),
  );
}

export function sameInstant(left: string | undefined, right: string): boolean {
  return utcTimestampsIdentifySameInstant(left, right);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isSha256Digest(value: unknown): value is `sha256:${string}` {
  return typeof value === "string" && SHA256_DIGEST.test(value);
}

function isSourceCutPosture(
  value: unknown,
): value is AdvisorIdeaReviewActionRequest["expectedSourceCutPosture"] {
  return (
    typeof value === "string" &&
    [
      "coherent",
      "coherent_with_declared_tolerance",
      "mixed",
      "partial",
      "unknown",
    ].includes(value)
  );
}
