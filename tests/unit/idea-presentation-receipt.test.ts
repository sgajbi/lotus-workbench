import { describe, expect, it, vi } from "vitest";

import {
  buildIdeaPresentationReceiptDraft,
  createIdeaPresentationIdempotencyKey,
  digestVisibleCandidateIds,
  matchesIdeaPresentationReceiptEvidence,
  readIdeaPresentationSource,
  type IdeaPresentationReceiptDraft,
  type IdeaPresentationReceiptResponse,
} from "../../src/features/proposals/idea-presentation-receipt";
import type {
  AdvisorIdeaQueueItem,
  AdvisorIdeaReviewQueueData,
} from "../../src/features/proposals/types";

const request: IdeaPresentationReceiptDraft = {
  presentedAtUtc: "2026-08-31T10:15:00.000Z",
  rankAtPresentation: 25,
  visibleCandidateCount: 1,
  queueSnapshotDigest: `sha256:${"a".repeat(64)}`,
  queuePolicyVersion: "idea-deterministic-ranking-v1",
  rankingPolicyVersion: "idle-liquidity-v1",
  candidateMaterialVersion: 2,
  candidateEvidenceVersion: 3,
  sourceRevisionVectorDigest: `sha256:${"b".repeat(64)}`,
  sourceCutPosture: "coherent",
};

function response(
  overrides: Partial<IdeaPresentationReceiptResponse["receipt"]> = {},
): IdeaPresentationReceiptResponse {
  return {
    receipt: {
      ...request,
      tenantId: "tenant-private-bank-sg",
      receiptId: "receipt-idea-025",
      candidateId: "idea-025",
      acceptedAtUtc: "2026-08-31T10:15:00.100000Z",
      acceptanceTimeSource: "server_accepted",
      schemaVersion: "lotus-idea.candidate-presentation-receipt.v2",
      surface: "advisor_review_queue",
      producer: "lotus-workbench",
      ...overrides,
    },
    persistenceDecision: "accepted",
    durableStorageBacked: true,
  };
}

describe("Idea presentation receipt contract", () => {
  it("reads exact source-owned rank, policies, and candidate versions", () => {
    expect(
      readIdeaPresentationSource(
        { policyVersion: "queue-v4" },
        {
          rank: 25,
          candidate: {
            candidateId: "idea-025",
            materialVersion: 2,
            evidenceVersion: 3,
            scorePolicyVersion: "ranking-v7",
            sourceRevisionVectorDigest: `sha256:${"b".repeat(64)}`,
            sourceCutPosture: "coherent",
          },
        },
      ),
    ).toEqual({
      candidateId: "idea-025",
      rank: 25,
      queuePolicyVersion: "queue-v4",
      rankingPolicyVersion: "ranking-v7",
      candidateMaterialVersion: 2,
      candidateEvidenceVersion: 3,
      sourceRevisionVectorDigest: `sha256:${"b".repeat(64)}`,
      sourceCutPosture: "coherent",
    });
  });

  it.each([
    [{}, { rank: 1, candidate: { candidateId: "idea-001" } }],
    [
      { policyVersion: "queue-v4" },
      {
        rank: 1,
        candidate: {
          candidateId: "idea-001",
          materialVersion: 1,
          evidenceVersion: 1,
        },
      },
    ],
    [
      { policyVersion: "queue-v4" },
      {
        rank: true,
        candidate: {
          candidateId: "idea-001",
          materialVersion: 1,
          evidenceVersion: 1,
          scorePolicyVersion: "ranking-v7",
        },
      },
    ],
  ])("rejects incomplete or coerced source evidence", (queue, item) => {
    expect(
      readIdeaPresentationSource(
        queue as AdvisorIdeaReviewQueueData,
        item as unknown as AdvisorIdeaQueueItem,
      ),
    ).toBeNull();
  });

  it("builds a rank-25 receipt for one genuinely visible candidate", async () => {
    const draft = await buildIdeaPresentationReceiptDraft({
      presentedAtUtc: request.presentedAtUtc,
      source: {
        candidateId: "idea-025",
        rank: 25,
        queuePolicyVersion: request.queuePolicyVersion,
        rankingPolicyVersion: request.rankingPolicyVersion,
        candidateMaterialVersion: 2,
        candidateEvidenceVersion: 3,
        sourceRevisionVectorDigest: request.sourceRevisionVectorDigest,
        sourceCutPosture: request.sourceCutPosture,
      },
      visibleCandidateIds: ["idea-025"],
    });

    expect(draft).toMatchObject({
      rankAtPresentation: 25,
      visibleCandidateCount: 1,
    });
    expect(draft.queueSnapshotDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("digests the exact ordered visible set", async () => {
    const first = await digestVisibleCandidateIds(["idea-001", "idea-002"]);
    const reordered = await digestVisibleCandidateIds(["idea-002", "idea-001"]);

    expect(first).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(reordered).not.toBe(first);
  });

  it("builds canonical HTTP evidence without secure-context-only APIs", async () => {
    const browserCrypto = globalThis.crypto;
    vi.stubGlobal("crypto", {
      getRandomValues: browserCrypto.getRandomValues.bind(browserCrypto),
    });
    try {
      await expect(digestVisibleCandidateIds(["idea-025"])).resolves.toBe(
        "sha256:d20471a41fce629375cd37b4a92ec884ee06c3ec16ab84444761c655757a65ff",
      );
      expect(createIdeaPresentationIdempotencyKey()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    } finally {
      vi.stubGlobal("crypto", browserCrypto);
    }
  });

  it.each([
    { candidateIds: [] },
    { candidateIds: [""] },
    { candidateIds: ["idea-001", "idea-001"] },
    {
      candidateIds: Array.from(
        { length: 101 },
        (_, index) => `idea-${index + 1}`,
      ),
    },
  ])("rejects an invalid visible candidate set", async ({ candidateIds }) => {
    await expect(digestVisibleCandidateIds(candidateIds)).rejects.toThrow(
      "Visible Idea candidate evidence is incomplete or inconsistent.",
    );
  });

  it.each(["accepted", "replayed"])(
    "accepts exact durable %s source evidence",
    (persistenceDecision) => {
      expect(
        matchesIdeaPresentationReceiptEvidence({
          candidateId: "idea-025",
          request,
          response: { ...response(), persistenceDecision },
        }),
      ).toBe(true);
    },
  );

  it.each([
    ["candidateId", "idea-026"],
    ["presentedAtUtc", "2026-08-31T10:15:00.000001Z"],
    ["rankAtPresentation", 24],
    ["visibleCandidateCount", 2],
    ["queueSnapshotDigest", `sha256:${"b".repeat(64)}`],
    ["queuePolicyVersion", "queue-v5"],
    ["rankingPolicyVersion", "ranking-v8"],
    ["candidateMaterialVersion", 4],
    ["candidateEvidenceVersion", 5],
    ["sourceRevisionVectorDigest", `sha256:${"c".repeat(64)}`],
    ["sourceCutPosture", "mixed"],
    ["acceptanceTimeSource", "client_supplied"],
    ["acceptedAtUtc", "2026-02-30T10:15:00Z"],
    ["surface", "candidate_detail"],
    ["producer", "lotus-gateway"],
  ])("rejects mismatched persisted %s evidence", (field, value) => {
    expect(
      matchesIdeaPresentationReceiptEvidence({
        candidateId: "idea-025",
        request,
        response: response({ [field]: value }),
      }),
    ).toBe(false);
  });

  it("rejects success without durable source proof", () => {
    expect(
      matchesIdeaPresentationReceiptEvidence({
        candidateId: "idea-025",
        request,
        response: { ...response(), durableStorageBacked: false },
      }),
    ).toBe(false);
  });
});
