import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MANAGE_MODE_DATA_REQUIREMENTS,
  MANAGE_SHARED_DATA_REQUIREMENTS,
  loadManageWorkspaceData,
} from "../../src/features/workbench/manage-workspace-data-loader";
import type { ManageMode } from "../../src/features/workbench/manage-workspace-navigation";
import { WorkbenchApiError } from "../../src/features/workbench/api-client";
import { buildManageWorkspaceData } from "./manage-workspace-fixtures";

const apiMocks = vi.hoisted(() => ({
  getDpmCampaignApprovalDecisions: vi.fn(),
  getDpmCampaignAssignmentActions: vi.fn(),
  getDpmCampaignAssignmentTasks: vi.fn(),
  getDpmCampaignMakerCheckerControls: vi.fn(),
  getDpmCommandCenter: vi.fn(),
  getDpmCommandCenterExceptions: vi.fn(),
  getDpmMandateByPortfolio: vi.fn(),
  getDpmMandateHealth: vi.fn(),
  getDpmOutcomeReviews: vi.fn(),
  getDpmPmOperatingQualityFairnessAnalysis: vi.fn(),
  getDpmPmOperatingQualityReviewAction: vi.fn(),
  getDpmPmOperatingQualitySummaryInvocation: vi.fn(),
  getDpmPortfolioMemory: vi.fn(),
  getDpmProofPack: vi.fn(),
  listDpmCampaignApprovalInbox: vi.fn(),
  listDpmCampaignAssignmentPlan: vi.fn(),
  listDpmCampaignDefinitions: vi.fn(),
  listDpmCampaignDiscovery: vi.fn(),
  listDpmCampaignOperatingQueue: vi.fn(),
  listDpmCampaignWorkflowAutomation: vi.fn(),
  listDpmCampaignWorkflowBoard: vi.fn(),
  listDpmPmOperatingQualityFairnessAnalyses: vi.fn(),
  listDpmPmOperatingQualityPolicies: vi.fn(),
  listDpmPmOperatingQualityReviewActions: vi.fn(),
  listDpmPmOperatingQualityScoreRuns: vi.fn(),
  listDpmPmOperatingQualitySummaryInvocations: vi.fn(),
  listDpmWaves: vi.fn(),
  searchDpmPortfolioMemory: vi.fn(),
}));

vi.mock("../../src/features/workbench/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/features/workbench/api")>()),
  ...apiMocks,
}));

const allApiMocks = Object.entries(apiMocks);
const sharedCalls = [
  "getDpmCommandCenter",
  "getDpmCommandCenterExceptions",
  "getDpmMandateByPortfolio",
  "getDpmMandateHealth",
];
const modeCalls: Record<ManageMode, string[]> = {
  overview: ["listDpmWaves"],
  mandate: [],
  waves: [
    "listDpmWaves",
    "listDpmCampaignDefinitions",
    "listDpmCampaignDiscovery",
    "listDpmCampaignOperatingQueue",
    "listDpmCampaignApprovalInbox",
    "listDpmCampaignWorkflowBoard",
    "listDpmCampaignAssignmentPlan",
    "listDpmCampaignWorkflowAutomation",
    "getDpmCampaignApprovalDecisions",
    "getDpmCampaignAssignmentActions",
    "getDpmCampaignAssignmentTasks",
    "getDpmCampaignMakerCheckerControls",
    "getDpmOutcomeReviews",
    "getDpmProofPack",
  ],
  construction: [],
  memory: ["getDpmPortfolioMemory", "searchDpmPortfolioMemory"],
  copilot: [
    "listDpmWaves",
    "getDpmOutcomeReviews",
    "getDpmProofPack",
    "listDpmPmOperatingQualityScoreRuns",
  ],
  quality: [
    "listDpmPmOperatingQualityPolicies",
    "listDpmPmOperatingQualityScoreRuns",
    "listDpmPmOperatingQualityFairnessAnalyses",
    "getDpmPmOperatingQualityFairnessAnalysis",
    "listDpmPmOperatingQualityReviewActions",
    "getDpmPmOperatingQualityReviewAction",
    "listDpmPmOperatingQualitySummaryInvocations",
    "getDpmPmOperatingQualitySummaryInvocation",
  ],
  reviews: ["getDpmOutcomeReviews"],
  proof: ["getDpmOutcomeReviews", "getDpmProofPack"],
};

describe("Manage workspace mode data loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const [, mock] of allApiMocks) {
      mock.mockResolvedValue(response({ items: [] }));
    }
    apiMocks.getDpmMandateByPortfolio.mockResolvedValue(
      response({ mandate_id: "MANDATE_PB_SG_GLOBAL_BAL_001" }),
    );
    apiMocks.getDpmOutcomeReviews.mockResolvedValue(
      response({ proof_pack_id: "proof-pack-001", items: [] }),
    );
    apiMocks.listDpmCampaignDefinitions.mockResolvedValue(
      response({
        items: [{ campaign_id: "campaign-001", campaign_version: "v1" }],
      }),
    );
    apiMocks.listDpmPmOperatingQualityFairnessAnalyses.mockResolvedValue(
      response({ items: [{ fairness_analysis_id: "fairness-001" }] }),
    );
    apiMocks.listDpmPmOperatingQualityReviewActions.mockResolvedValue(
      response({ items: [{ review_action_id: "review-action-001" }] }),
    );
    apiMocks.listDpmPmOperatingQualitySummaryInvocations.mockResolvedValue(
      response({ items: [{ summary_invocation_id: "summary-001" }] }),
    );
  });

  it("declares every mode against a small shared source set", () => {
    expect(MANAGE_SHARED_DATA_REQUIREMENTS).toEqual([
      "command-center",
      "active-exceptions",
      "mandate-health",
    ]);
    expect(Object.keys(MANAGE_MODE_DATA_REQUIREMENTS)).toEqual([
      "overview",
      "mandate",
      "waves",
      "construction",
      "memory",
      "copilot",
      "quality",
      "reviews",
      "proof",
    ]);
  });

  it.each(Object.keys(modeCalls) as ManageMode[])(
    "%s loads only its declared Gateway source family",
    async (mode) => {
      const portfolio = buildManageWorkspaceData().portfolio;

      await loadManageWorkspaceData(portfolio, mode);

      const expectedCalls = new Set([...sharedCalls, ...modeCalls[mode]]);
      for (const [name, mock] of allApiMocks) {
        expect(mock, name).toHaveBeenCalledTimes(expectedCalls.has(name) ? 1 : 0);
      }
    },
  );

  it("keeps one mode's source failure explicit without loading unrelated modes", async () => {
    apiMocks.listDpmWaves.mockRejectedValueOnce(new Error("Rebalance source timed out"));

    const data = await loadManageWorkspaceData(
      buildManageWorkspaceData().portfolio,
      "overview",
    );

    expect(data.waves).toBeNull();
    expect(data.wavesError).toBe("Rebalance source timed out");
    expect(apiMocks.listDpmPmOperatingQualityPolicies).not.toHaveBeenCalled();
    expect(apiMocks.getDpmPortfolioMemory).not.toHaveBeenCalled();
  });

  it("loads the exact Overview source set through the client boundary with one shared signal", async () => {
    const signal = new AbortController().signal;

    await loadManageWorkspaceData(
      buildManageWorkspaceData().portfolio,
      "overview",
      { signal, target: "client" },
    );

    expect(apiMocks.getDpmCommandCenter).toHaveBeenCalledWith(
      { limit: 25 },
      "client",
      signal,
    );
    expect(apiMocks.getDpmCommandCenterExceptions).toHaveBeenCalledWith(
      { portfolioId: "PF_1001", state: "ACTIVE", limit: 25 },
      "client",
      signal,
    );
    expect(apiMocks.getDpmMandateByPortfolio).toHaveBeenCalledWith(
      "PF_1001",
      "client",
      signal,
    );
    expect(apiMocks.getDpmMandateHealth).toHaveBeenCalledWith(
      "MANDATE_PB_SG_GLOBAL_BAL_001",
      "client",
      signal,
    );
    expect(apiMocks.listDpmWaves).toHaveBeenCalledWith(
      { triggerType: "EXPLICIT_PORTFOLIO_LIST", limit: 10 },
      "client",
      signal,
    );
  });

  it("preserves a permission refusal across the composed Overview result", async () => {
    apiMocks.getDpmCommandCenterExceptions.mockRejectedValueOnce(
      new WorkbenchApiError("DPM command-center exceptions", 403),
    );

    const data = await loadManageWorkspaceData(
      buildManageWorkspaceData().portfolio,
      "overview",
    );

    expect(data.sourceAccessWithheld).toBe(true);
    expect(data.commandCenterExceptions).toBeNull();
    expect(data.commandCenterExceptionsError).toContain("403");
  });

  it("keeps mandate-health transport detail out of the business surface", async () => {
    apiMocks.getDpmMandateHealth.mockRejectedValueOnce(
      new Error("connect ECONNREFUSED manage-internal:8100"),
    );

    const data = await loadManageWorkspaceData(
      buildManageWorkspaceData().portfolio,
      "mandate",
    );

    expect(data.mandateHealth).toBeNull();
    expect(data.mandateHealthError).toBe(
      "Mandate health evidence is temporarily unavailable.",
    );
  });

  it("identifies each server workflow read so client recovery cannot survive a later read", async () => {
    const portfolio = buildManageWorkspaceData().portfolio;

    const first = await loadManageWorkspaceData(portfolio, "waves");
    const second = await loadManageWorkspaceData(portfolio, "waves");

    expect(first.campaignSourceReadId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(second.campaignSourceReadId).not.toBe(
      first.campaignSourceReadId,
    );
  });
});

function response(data: Record<string, unknown>) {
  return {
    correlation_id: "corr-mode-loader",
    contract_version: "v1",
    source_service: "lotus-manage",
    upstream_status: 200,
    data,
  };
}
