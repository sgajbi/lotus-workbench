import { describe, expect, it } from "vitest";

import {
  buildIdeaCandidateActionAuthority,
  buildIdeaConversionRequestAuthority,
  buildIdeaReviewRequestAuthority,
  matchesIdeaConversionResponse,
  matchesIdeaReviewResponse,
  readAcceptedIdeaReviewAuthority,
  readPersistedAcceptedIdeaReviewAuthority,
} from "../../src/features/proposals/idea-action-authority";
import type {
  AdvisorIdeaConversionIntentRequest,
  AdvisorIdeaReviewActionRequest,
} from "../../src/features/proposals/types";

const digestB = `sha256:${"b".repeat(64)}` as const;
const digestC = `sha256:${"c".repeat(64)}` as const;
const candidateAuthority = {
  candidateId: "idea-001",
  expectedMaterialVersion: 2,
  expectedEvidenceVersion: 3,
  expectedEvidencePacketId: "packet-001",
  expectedEvidenceContentHash: digestC,
  expectedSourceRevisionVectorDigest: digestB,
  expectedSourceCutPosture: "coherent" as const,
};
const presentationAuthority = {
  candidateId: "idea-001",
  evidencePacketId: "packet-001",
  receiptId: "receipt-001",
  candidateMaterialVersion: 2,
  candidateEvidenceVersion: 3,
  sourceRevisionVectorDigest: digestB,
  sourceCutPosture: "coherent" as const,
};

function reviewRequest(): AdvisorIdeaReviewActionRequest {
  return {
    reviewId: "review-001",
    action: "approve_for_conversion",
    reasonCodes: ["review_approved_for_conversion", "high_cash_ratio"],
    decidedAtUtc: "2026-09-24T01:00:00Z",
    reviewChannel: "workbench",
    presentationReceiptId: "receipt-001",
    expectedMaterialVersion: 2,
    expectedEvidenceVersion: 3,
    expectedEvidencePacketId: "packet-001",
    expectedEvidenceContentHash: digestC,
    expectedSourceRevisionVectorDigest: digestB,
    expectedSourceCutPosture: "coherent",
  };
}

describe("Idea action authority", () => {
  it("builds authority only when queue, detail, and presentation identify one source state", () => {
    expect(
      buildIdeaCandidateActionAuthority({
        candidateId: "idea-001",
        detailCandidateId: "idea-001",
        candidateMaterialVersion: 2,
        candidateEvidenceVersion: 3,
        detailCandidateMaterialVersion: 2,
        detailCandidateEvidenceVersion: 3,
        evidenceIdentity: {
          evidencePacketId: "packet-001",
          evidenceContentHash: digestC,
          sourceRevisionVectorDigest: digestB,
        },
        detailSourceCutPosture: "coherent",
        queueEvidencePacketId: "packet-001",
        queueSourceCutPosture: "coherent",
        queueSourceRevisionVectorDigest: digestB,
      }),
    ).toEqual(candidateAuthority);
    expect(
      buildIdeaCandidateActionAuthority({
        candidateId: "idea-001",
        detailCandidateId: "idea-other",
        candidateMaterialVersion: 2,
        candidateEvidenceVersion: 3,
        detailCandidateMaterialVersion: 2,
        detailCandidateEvidenceVersion: 3,
        evidenceIdentity: {
          evidencePacketId: "packet-001",
          evidenceContentHash: digestC,
          sourceRevisionVectorDigest: digestB,
        },
        detailSourceCutPosture: "coherent",
        queueEvidencePacketId: "packet-001",
        queueSourceCutPosture: "coherent",
        queueSourceRevisionVectorDigest: digestB,
      }),
    ).toBeUndefined();
    expect(
      buildIdeaCandidateActionAuthority({
        candidateId: "idea-001",
        detailCandidateId: "idea-001",
        candidateMaterialVersion: 2,
        candidateEvidenceVersion: 3,
        detailCandidateMaterialVersion: 2,
        detailCandidateEvidenceVersion: 3,
        evidenceIdentity: {
          evidencePacketId: "packet-002",
          evidenceContentHash: digestC,
          sourceRevisionVectorDigest: digestB,
        },
        detailSourceCutPosture: "coherent",
        queueEvidencePacketId: "packet-001",
        queueSourceCutPosture: "coherent",
        queueSourceRevisionVectorDigest: digestB,
      }),
    ).toBeUndefined();
    expect(
      buildIdeaReviewRequestAuthority(candidateAuthority, {
        ...presentationAuthority,
        candidateEvidenceVersion: 4,
      }),
    ).toBeUndefined();
    expect(
      buildIdeaReviewRequestAuthority(candidateAuthority, {
        ...presentationAuthority,
        evidencePacketId: "packet-restated",
      }),
    ).toBeUndefined();
  });

  it.each([
    ["approve_for_conversion", "approved_for_conversion"],
    ["reject", "rejected"],
    ["no_action", "no_action"],
    ["suppress", "suppressed"],
    ["snooze", "advisor_review_required"],
    ["escalate_to_pm", "pm_review_required"],
    ["escalate_to_compliance", "compliance_review_required"],
  ] as const)(
    "accepts only the authoritative %s to %s posture transition",
    (action, resultingPosture) => {
      const request = { ...reviewRequest(), action };
      const response = {
        reviewDecision: {
          reviewId: request.reviewId,
          candidateId: "idea-001",
          evidencePacketId: request.expectedEvidencePacketId,
          evidenceContentHash: request.expectedEvidenceContentHash,
          sourceRevisionVectorDigest:
            request.expectedSourceRevisionVectorDigest,
          sourceCutPosture: request.expectedSourceCutPosture,
          candidateMaterialVersion: request.expectedMaterialVersion,
          candidateEvidenceVersion: request.expectedEvidenceVersion,
          reviewChannel: request.reviewChannel,
          presentationReceiptId: request.presentationReceiptId,
          action: request.action,
          resultingPosture,
          reasonCodes: request.reasonCodes,
          decidedAtUtc: request.decidedAtUtc,
          acceptedAtUtc: "2026-09-24T01:00:01Z",
          acceptanceTimeSource: "server_accepted",
          grantsDownstreamAuthority: false,
        },
        persistence: { decision: "accepted" },
        durableStorageBacked: true,
      };

      expect(
        matchesIdeaReviewResponse({
          candidateId: "idea-001",
          request,
          response,
        }),
      ).toBe(true);
      expect(
        matchesIdeaReviewResponse({
          candidateId: "idea-001",
          request,
          response: {
            ...response,
            reviewDecision: {
              ...response.reviewDecision,
              resultingPosture: "contradictory_posture",
            },
          },
        }),
      ).toBe(false);
      expect(
        matchesIdeaReviewResponse({
          candidateId: "idea-001",
          request,
          response: {
            ...response,
            reviewDecision: {
              ...response.reviewDecision,
              acceptedAtUtc: "2026-02-30T01:00:01Z",
            },
          },
        }),
      ).toBe(false);
    },
  );

  it("accepts exact approved review evidence and rejects a source restatement", () => {
    const request = reviewRequest();
    const response = {
      reviewDecision: {
        reviewId: request.reviewId,
        candidateId: "idea-001",
        evidencePacketId: request.expectedEvidencePacketId,
        evidenceContentHash: request.expectedEvidenceContentHash,
        sourceRevisionVectorDigest: request.expectedSourceRevisionVectorDigest,
        sourceCutPosture: request.expectedSourceCutPosture,
        candidateMaterialVersion: request.expectedMaterialVersion,
        candidateEvidenceVersion: request.expectedEvidenceVersion,
        reviewChannel: request.reviewChannel,
        presentationReceiptId: request.presentationReceiptId,
        action: request.action,
        resultingPosture: "approved_for_conversion",
        reasonCodes: request.reasonCodes,
        decidedAtUtc: request.decidedAtUtc,
        acceptedAtUtc: "2026-09-24T01:00:01Z",
        acceptanceTimeSource: "server_accepted",
        grantsDownstreamAuthority: false,
      },
      persistence: { decision: "accepted" },
      durableStorageBacked: true,
    };
    const review = readAcceptedIdeaReviewAuthority({
      candidateId: "idea-001",
      request,
      response,
    });
    expect(review?.reviewId).toBe("review-001");
    expect(
      buildIdeaConversionRequestAuthority(
        { ...candidateAuthority, expectedEvidenceVersion: 4 },
        review,
      ),
    ).toBeUndefined();
  });

  it("requires a current presentation except for the exact completed review handoff", () => {
    const review = {
      ...candidateAuthority,
      reviewId: "review-001",
      presentationReceiptId: "receipt-prior-snapshot",
    };

    expect(
      buildIdeaConversionRequestAuthority(candidateAuthority, review),
    ).toBeUndefined();

    expect(
      buildIdeaConversionRequestAuthority(candidateAuthority, review, {
        presentation: presentationAuthority,
      }),
    ).toMatchObject({ expectedReviewId: "review-001" });

    expect(
      buildIdeaConversionRequestAuthority(candidateAuthority, review, {
        completedReviewHandoff: review,
      }),
    ).toMatchObject({ expectedReviewId: "review-001" });

    expect(
      buildIdeaConversionRequestAuthority(candidateAuthority, review, {
        completedReviewHandoff: { ...review, reviewId: "review-other" },
      }),
    ).toBeUndefined();

    expect(
      buildIdeaConversionRequestAuthority(
        { ...candidateAuthority, expectedEvidenceVersion: 4 },
        review,
      ),
    ).toBeUndefined();

    const nonAuthoritative = {
      ...candidateAuthority,
      expectedSourceCutPosture: "unknown" as const,
    };
    expect(
      buildIdeaConversionRequestAuthority(
        nonAuthoritative,
        { ...review, expectedSourceCutPosture: "unknown" },
        {
          completedReviewHandoff: {
            ...review,
            expectedSourceCutPosture: "unknown",
          },
        },
      ),
    ).toBeUndefined();
  });

  it("restores only a durable approved review for the exact current evidence tuple", () => {
    const decision = {
      reviewId: "review-persisted",
      candidateId: "idea-001",
      evidencePacketId: "packet-001",
      evidenceContentHash: digestC,
      sourceRevisionVectorDigest: digestB,
      sourceCutPosture: "coherent",
      candidateMaterialVersion: 2,
      candidateEvidenceVersion: 3,
      reviewChannel: "workbench",
      presentationReceiptId: "receipt-persisted",
      action: "approve_for_conversion",
      resultingPosture: "approved_for_conversion",
      acceptedAtUtc: "2026-09-24T01:00:01Z",
      acceptanceTimeSource: "server_accepted",
      grantsDownstreamAuthority: false,
    };

    expect(
      readPersistedAcceptedIdeaReviewAuthority({
        authority: candidateAuthority,
        decisions: [decision],
        durableStorageBacked: true,
      }),
    ).toEqual({
      ...candidateAuthority,
      reviewId: "review-persisted",
      presentationReceiptId: "receipt-persisted",
    });
    expect(
      readPersistedAcceptedIdeaReviewAuthority({
        authority: candidateAuthority,
        decisions: [{ ...decision, candidateEvidenceVersion: 4 }],
        durableStorageBacked: true,
      }),
    ).toBeUndefined();
    expect(
      readPersistedAcceptedIdeaReviewAuthority({
        authority: candidateAuthority,
        decisions: [
          decision,
          {
            ...decision,
            reviewId: "review-newer-rejection",
            presentationReceiptId: null,
            action: "reject",
            resultingPosture: "rejected",
            acceptedAtUtc: "2026-09-24T01:01:01Z",
          },
        ],
        durableStorageBacked: true,
      }),
    ).toBeUndefined();
    expect(
      readPersistedAcceptedIdeaReviewAuthority({
        authority: candidateAuthority,
        decisions: [
          { ...decision, acceptedAtUtc: "2026-09-24T01:00:01.100000Z" },
          {
            ...decision,
            reviewId: "review-microsecond-newer-rejection",
            presentationReceiptId: null,
            action: "reject",
            resultingPosture: "rejected",
            acceptedAtUtc: "2026-09-24T01:00:01.100001Z",
          },
        ],
        durableStorageBacked: true,
      }),
    ).toBeUndefined();
    expect(
      readPersistedAcceptedIdeaReviewAuthority({
        authority: candidateAuthority,
        decisions: [{ ...decision, acceptedAtUtc: "2026-02-30T01:00:01Z" }],
        durableStorageBacked: true,
      }),
    ).toBeUndefined();
    expect(
      readPersistedAcceptedIdeaReviewAuthority({
        authority: candidateAuthority,
        decisions: [decision],
        durableStorageBacked: false,
      }),
    ).toBeUndefined();
  });

  it("requires conversion success to echo the exact review and evidence tuple", () => {
    const { candidateId: _authorityCandidateId, ...evidenceAuthority } =
      candidateAuthority;
    const request: AdvisorIdeaConversionIntentRequest = {
      conversionIntentId: "conversion-001",
      target: "advise_proposal",
      reasonCodes: ["review_approved_for_conversion", "high_cash_ratio"],
      requestedAtUtc: "2026-09-24T01:01:00Z",
      expectedReviewId: "review-001",
      ...evidenceAuthority,
    };
    const response = {
      conversionIntent: {
        conversionIntentId: request.conversionIntentId,
        candidateId: "idea-001",
        target: request.target,
        reviewId: request.expectedReviewId,
        evidencePacketId: request.expectedEvidencePacketId,
        evidenceContentHash: request.expectedEvidenceContentHash,
        sourceRevisionVectorDigest: request.expectedSourceRevisionVectorDigest,
        sourceCutPosture: request.expectedSourceCutPosture,
        candidateMaterialVersion: request.expectedMaterialVersion,
        candidateEvidenceVersion: request.expectedEvidenceVersion,
        reasonCodes: request.reasonCodes,
        requestedAtUtc: request.requestedAtUtc,
        acceptedAtUtc: "2026-09-24T01:01:01Z",
        acceptanceTimeSource: "server_accepted",
        boundary: "intent_only",
        grantsDownstreamAuthority: false,
      },
      persistence: { decision: "replayed" },
      durableStorageBacked: true,
    };
    expect(
      matchesIdeaConversionResponse({
        candidateId: "idea-001",
        request,
        response,
      }),
    ).toBe(true);
    expect(
      matchesIdeaConversionResponse({
        candidateId: "idea-001",
        request,
        response: {
          ...response,
          conversionIntent: {
            ...response.conversionIntent,
            reviewId: "review-stale",
          },
        },
      }),
    ).toBe(false);
    expect(
      matchesIdeaConversionResponse({
        candidateId: "idea-001",
        request,
        response: {
          ...response,
          conversionIntent: {
            ...response.conversionIntent,
            acceptedAtUtc: "2026-02-30T01:01:01Z",
          },
        },
      }),
    ).toBe(false);
  });
});
