import { sha256 } from "@noble/hashes/sha2.js";

import type {
  AdvisorIdeaQueueItem,
  AdvisorIdeaReviewQueueData,
} from "./types";
import {
  isUtcEvidenceTimestamp,
  utcTimestampsIdentifySameInstant,
} from "./utc-evidence";

export type IdeaPresentationReceiptDraft = {
  presentedAtUtc: string;
  rankAtPresentation: number;
  visibleCandidateCount: number;
  queueSnapshotDigest: `sha256:${string}`;
  queuePolicyVersion: string;
  rankingPolicyVersion: string;
  candidateMaterialVersion: number;
  candidateEvidenceVersion: number;
  sourceRevisionVectorDigest: `sha256:${string}`;
  sourceCutPosture:
    | "coherent"
    | "coherent_with_declared_tolerance"
    | "mixed"
    | "partial"
    | "unknown";
};

export type IdeaPresentationSource = {
  candidateId: string;
  rank: number;
  queuePolicyVersion: string;
  rankingPolicyVersion: string;
  candidateMaterialVersion: number;
  candidateEvidenceVersion: number;
  sourceRevisionVectorDigest: `sha256:${string}`;
  sourceCutPosture: IdeaPresentationReceiptDraft["sourceCutPosture"];
};

export type IdeaPresentationReceiptResponse = {
  receipt?: IdeaPresentationReceiptDraft & {
    tenantId?: string;
    receiptId?: string;
    candidateId?: string;
    acceptedAtUtc?: string;
    acceptanceTimeSource?: string;
    schemaVersion?: string;
    surface?: string;
    producer?: string;
  };
  persistenceDecision?: string;
  durableStorageBacked?: boolean;
  effectivenessMeasurementStatus?: string;
  certificationStatus?: string;
  certificationBlockers?: string[];
  supportedFeaturePromoted?: boolean;
};

export function readIdeaPresentationSource(
  queue: AdvisorIdeaReviewQueueData,
  item: AdvisorIdeaQueueItem,
): IdeaPresentationSource | null {
  const candidate = item.candidate;
  if (
    !candidate?.candidateId?.trim() ||
    !isPositiveInteger(item.rank) ||
    !queue.policyVersion?.trim() ||
    !candidate.scorePolicyVersion?.trim() ||
    !isPositiveInteger(candidate.materialVersion) ||
    !isPositiveInteger(candidate.evidenceVersion) ||
    !isSha256Digest(candidate.sourceRevisionVectorDigest) ||
    !isSourceCutPosture(candidate.sourceCutPosture)
  ) {
    return null;
  }
  return {
    candidateId: candidate.candidateId,
    rank: item.rank,
    queuePolicyVersion: queue.policyVersion,
    rankingPolicyVersion: candidate.scorePolicyVersion,
    candidateMaterialVersion: candidate.materialVersion,
    candidateEvidenceVersion: candidate.evidenceVersion,
    sourceRevisionVectorDigest: candidate.sourceRevisionVectorDigest,
    sourceCutPosture: candidate.sourceCutPosture,
  };
}

export async function buildIdeaPresentationReceiptDraft({
  presentedAtUtc,
  source,
  visibleCandidateIds,
}: {
  presentedAtUtc: string;
  source: IdeaPresentationSource;
  visibleCandidateIds: string[];
}): Promise<IdeaPresentationReceiptDraft> {
  requireVisibleCandidateSet(visibleCandidateIds, source.candidateId);
  return {
    presentedAtUtc,
    rankAtPresentation: source.rank,
    visibleCandidateCount: visibleCandidateIds.length,
    queueSnapshotDigest: await digestVisibleCandidateIds(visibleCandidateIds),
    queuePolicyVersion: source.queuePolicyVersion,
    rankingPolicyVersion: source.rankingPolicyVersion,
    candidateMaterialVersion: source.candidateMaterialVersion,
    candidateEvidenceVersion: source.candidateEvidenceVersion,
    sourceRevisionVectorDigest: source.sourceRevisionVectorDigest,
    sourceCutPosture: source.sourceCutPosture,
  };
}

export async function buildIdeaPresentationReceiptDrafts({
  presentedAtUtc,
  sources,
  visibleCandidateIds,
}: {
  presentedAtUtc: string;
  sources: ReadonlyMap<string, IdeaPresentationSource>;
  visibleCandidateIds: string[];
}): Promise<Array<{ candidateId: string; request: IdeaPresentationReceiptDraft }>> {
  requireVisibleCandidateSet(visibleCandidateIds);
  const digest = await digestVisibleCandidateIds(visibleCandidateIds);
  return visibleCandidateIds.map((candidateId) => {
    const source = sources.get(candidateId);
    if (!source) {
      throw new Error("Visible Idea candidate source evidence is unavailable.");
    }
    return {
      candidateId,
      request: {
        presentedAtUtc,
        rankAtPresentation: source.rank,
        visibleCandidateCount: visibleCandidateIds.length,
        queueSnapshotDigest: digest,
        queuePolicyVersion: source.queuePolicyVersion,
        rankingPolicyVersion: source.rankingPolicyVersion,
        candidateMaterialVersion: source.candidateMaterialVersion,
        candidateEvidenceVersion: source.candidateEvidenceVersion,
        sourceRevisionVectorDigest: source.sourceRevisionVectorDigest,
        sourceCutPosture: source.sourceCutPosture,
      },
    };
  });
}

export async function digestVisibleCandidateIds(
  candidateIds: string[],
): Promise<`sha256:${string}`> {
  requireVisibleCandidateSet(candidateIds);
  const bytes = new TextEncoder().encode(JSON.stringify(candidateIds));
  const digest = globalThis.crypto?.subtle
    ? new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes))
    : sha256(bytes);
  const hex = Array.from(digest, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `sha256:${hex}`;
}

export function createIdeaPresentationIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error("Secure random values are unavailable in this browser.");
  }
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10).join(""),
  ].join("-");
}

export function matchesIdeaPresentationReceiptEvidence({
  candidateId,
  request,
  response,
}: {
  candidateId: string;
  request: IdeaPresentationReceiptDraft;
  response: IdeaPresentationReceiptResponse;
}): boolean {
  const receipt = response.receipt;
  return Boolean(
    receipt &&
      (response.persistenceDecision === "accepted" ||
        response.persistenceDecision === "replayed") &&
      response.durableStorageBacked === true &&
      receipt.candidateId === candidateId &&
      isUtcEvidenceTimestamp(receipt.acceptedAtUtc) &&
      receipt.acceptanceTimeSource === "server_accepted" &&
      receipt.schemaVersion === "lotus-idea.candidate-presentation-receipt.v2" &&
      receipt.surface === "advisor_review_queue" &&
      receipt.producer === "lotus-workbench" &&
      receipt.receiptId?.trim() &&
      receipt.tenantId?.trim() &&
      presentationFieldsMatch(receipt, request),
  );
}

function presentationFieldsMatch(
  receipt: IdeaPresentationReceiptDraft,
  request: IdeaPresentationReceiptDraft,
): boolean {
  return (
    utcTimestampsIdentifySameInstant(
      receipt.presentedAtUtc,
      request.presentedAtUtc,
    ) &&
    receipt.rankAtPresentation === request.rankAtPresentation &&
    receipt.visibleCandidateCount === request.visibleCandidateCount &&
    receipt.queueSnapshotDigest === request.queueSnapshotDigest &&
    receipt.queuePolicyVersion === request.queuePolicyVersion &&
    receipt.rankingPolicyVersion === request.rankingPolicyVersion &&
    receipt.candidateMaterialVersion === request.candidateMaterialVersion &&
    receipt.candidateEvidenceVersion === request.candidateEvidenceVersion &&
    receipt.sourceRevisionVectorDigest === request.sourceRevisionVectorDigest &&
    receipt.sourceCutPosture === request.sourceCutPosture
  );
}

function requireVisibleCandidateSet(
  candidateIds: string[],
  requiredCandidateId?: string,
): void {
  if (
    candidateIds.length < 1 ||
    candidateIds.length > 100 ||
    candidateIds.some((candidateId) => !candidateId.trim()) ||
    new Set(candidateIds).size !== candidateIds.length ||
    (requiredCandidateId !== undefined && !candidateIds.includes(requiredCandidateId))
  ) {
    throw new Error("Visible Idea candidate evidence is incomplete or inconsistent.");
  }
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isSha256Digest(value: unknown): value is `sha256:${string}` {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

function isSourceCutPosture(
  value: unknown,
): value is IdeaPresentationReceiptDraft["sourceCutPosture"] {
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
