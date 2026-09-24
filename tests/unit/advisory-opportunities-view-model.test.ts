import { describe, expect, it } from "vitest";

import { buildAdvisoryOpportunitiesModel } from "../../src/features/proposals/advisory-opportunities-view-model";
import type { AdvisorIdeaReviewQueueData } from "../../src/features/proposals/types";

describe("buildAdvisoryOpportunitiesModel", () => {
  it("uses Lotus Idea queue candidates as advisor opportunity candidates", () => {
    const queue: AdvisorIdeaReviewQueueData = {
      policyVersion: "idea-deterministic-ranking-v1",
      evaluatedAtUtc: "2026-06-21T10:10:00Z",
      durableStorageBacked: true,
      supportedFeaturePromoted: false,
      exclusions: [{ candidateId: "idea_excluded" }],
      items: [
        {
          rank: 1,
          score: "82",
          priorityBucket: "high",
          reasonCodes: ["high_cash_ratio", "review_required"],
          candidate: {
            candidateId: "idea_high_cash_001",
            family: "high_cash",
            reviewPosture: "advisor_review_required",
            score: "82",
            sourceSignalIds: ["signal_high_cash_001"],
          },
        },
      ],
    };

    const model = buildAdvisoryOpportunitiesModel({
      portfolioId: "PB_SG_GLOBAL_BAL_001",
      queue,
    });

    expect(model.candidateCount).toBe(1);
    expect(model.excludedCount).toBe(1);
    expect(model.durableStorageBacked).toBe(true);
    expect(model.supportedFeaturePromoted).toBe(false);
    expect(model.recommendedAction).toMatch(/Review source evidence/);
    expect(model.rows).toEqual([
      expect.objectContaining({
        candidateId: "idea_high_cash_001",
        title: "Excess Cash - idea_high_cash_001",
        rank: 1,
        priority: "High",
        reviewPosture: "Advisor Review Required",
        sourceSignals: "signal_high_cash_001",
        reasonCodes: "High Cash Ratio, Review Required",
        href:
          "/recommendations?mode=opportunities&portfolioId=PB_SG_GLOBAL_BAL_001" +
          "&candidateId=idea_high_cash_001",
      }),
    ]);
  });

  it("presents the low-income signal as an advisor-facing cash shortfall", () => {
    const model = buildAdvisoryOpportunitiesModel({
      portfolioId: "PB_SG_GLOBAL_BAL_001",
      queue: {
        items: [
          {
            rank: 1,
            candidate: {
              candidateId: "idea_low_income_0123456789abcdef",
              family: "low_income",
            },
          },
        ],
      },
    });

    expect(model.rows[0]?.title).toBe(
      "Projected Cash Shortfall - idea_low_income_0123456789abcdef",
    );
  });

  it("preserves Idea queue positions as numeric grid sort values", () => {
    const model = buildAdvisoryOpportunitiesModel({
      portfolioId: "PB_SG_GLOBAL_BAL_001",
      queue: {
        items: [
          { rank: 10, candidate: { candidateId: "idea-010" } },
          { rank: 2, candidate: { candidateId: "idea-002" } },
          { candidate: { candidateId: "idea-unranked" } },
        ],
      },
    });

    expect(model.rows.map(({ rank }) => rank)).toEqual([10, 2, null]);
    expect(
      model.rows
        .map(({ rank }) => rank)
        .filter((rank): rank is number => rank !== null)
        .sort((left, right) => left - right),
    ).toEqual([2, 10]);
  });

  it("keeps an empty idea queue action-oriented", () => {
    const model = buildAdvisoryOpportunitiesModel({
      portfolioId: "PB_SG_GLOBAL_BAL_001",
      queue: {
        items: [],
        exclusions: [],
        supportedFeaturePromoted: false,
      },
    });

    expect(model.candidateCount).toBe(0);
    expect(model.rows).toEqual([]);
    expect(model.recommendedAction).toMatch(/No Idea-owned candidates/);
  });

  it("keeps the complete source queue available through the virtualized worklist", () => {
    const items = Array.from({ length: 13 }, (_, index) => ({
      rank: index + 1,
      candidate: {
        candidateId: `idea_high_cash_${String(index + 1).padStart(3, "0")}`,
        family: "high_cash",
      },
    }));
    const selectedCandidateId = "idea_high_cash_013";

    const model = buildAdvisoryOpportunitiesModel({
      portfolioId: "PB_SG_GLOBAL_BAL_001",
      queue: { items },
      selectedCandidateId,
    });

    expect(model.rows).toHaveLength(13);
    expect(model.rows.at(-1)?.candidateId).toBe(selectedCandidateId);
    expect(
      model.rows.filter((row) => row.candidateId === selectedCandidateId),
    ).toHaveLength(1);
    expect(
      model.rows.some((row) => row.candidateId === "idea_high_cash_012"),
    ).toBe(true);
  });

  it("does not synthesize a selected candidate absent from the source queue", () => {
    const model = buildAdvisoryOpportunitiesModel({
      portfolioId: "PB_SG_GLOBAL_BAL_001",
      queue: {
        items: [
          {
            rank: 1,
            candidate: {
              candidateId: "idea_high_cash_001",
              family: "high_cash",
            },
          },
        ],
      },
      selectedCandidateId: "idea_high_cash_missing",
    });

    expect(model.rows.map((row) => row.candidateId)).toEqual([
      "idea_high_cash_001",
    ]);
  });
});
