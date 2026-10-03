import type { ComponentProps } from "react";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProductionDpmWaveCommandCenterPanel from "../../src/features/workbench/components/dpm-wave-command-center-panel";
import {
  approveDpmWave,
  createDpmWave,
  getDpmCampaignDefinitionLaunchHistory,
  getDpmCampaignDefinitionLaunchPackage,
  getDpmCampaignDefinitionLifecycleEvents,
  getDpmCampaignDefinitionPreviewReadiness,
  getDpmWave,
  getDpmWaveItems,
  getDpmWaveProofPackPosture,
  handoffDpmWave,
  launchDpmCampaignDefinition,
  listDpmWaves,
  previewDpmWave,
  requestDpmOperationsHandoffSummary,
  requestDpmWaveAiPmMemo,
  simulateDpmWave,
  sourceCheckDpmWave,
  stageDpmWave,
} from "../../src/features/workbench/dpm-wave-api";
import { buildDpmAiWorkflowResponse } from "../fixtures/dpm-ai-workflow-fixtures";
import { dpmWaveQueryKeys } from "../../src/features/workbench/dpm-wave-query-keys";
import type {
  DpmCampaignDefinitionGatewayResponse,
  DpmWaveGatewayResponse,
} from "../../src/features/workbench/types";
import { renderWithQueryClient } from "../helpers/query-client-test-harness";

function DpmWaveCommandCenterPanel(
  props: Omit<
    ComponentProps<typeof ProductionDpmWaveCommandCenterPanel>,
    "campaignSourceReadId"
  >,
) {
  return (
    <ProductionDpmWaveCommandCenterPanel
      {...props}
      campaignSourceReadId="source-read-default"
    />
  );
}

vi.mock("../../src/features/workbench/dpm-wave-api", () => ({
  approveDpmWave: vi.fn(),
  createDpmWave: vi.fn(),
  getDpmCampaignDefinitionLaunchHistory: vi.fn(),
  getDpmCampaignDefinitionLaunchPackage: vi.fn(),
  getDpmCampaignDefinitionLifecycleEvents: vi.fn(),
  getDpmCampaignDefinitionPreviewReadiness: vi.fn(),
  getDpmWave: vi.fn(),
  getDpmWaveItems: vi.fn(),
  getDpmWaveProofPackPosture: vi.fn(),
  handoffDpmWave: vi.fn(),
  launchDpmCampaignDefinition: vi.fn(),
  listDpmWaves: vi.fn(),
  previewDpmWave: vi.fn(),
  requestDpmOperationsHandoffSummary: vi.fn(),
  requestDpmWaveAiPmMemo: vi.fn(),
  simulateDpmWave: vi.fn(),
  sourceCheckDpmWave: vi.fn(),
  stageDpmWave: vi.fn(),
}));

const waveResponse: DpmWaveGatewayResponse = {
  correlation_id: "corr-wave",
  contract_version: "v1",
  source_service: "lotus-manage",
  upstream_status: 200,
  supportability: {
    source_service: "lotus-manage",
    authority: "lotus-manage:RFC-0041",
    state: "ready",
    reason_codes: [],
    blocked_actions: [],
    wave_id: "dwv_001",
    wave_state: "SIMULATION_READY",
    item_count: 2,
    issue_count: 0,
    remediation_owner: "Portfolio Operations",
  },
  data: {
    items: [
      {
        wave_id: "dwv_001",
        state: "SIMULATION_READY",
        trigger_type: "EXPLICIT_PORTFOLIO_LIST",
        as_of_date: "2026-05-03",
        item_count: 2,
        supportability_state: "ready",
        supportability_reason: "wave_supportability_ready",
        aggregate_metrics: {
          turnover_pct: "4.8%",
          cash_after_pct: "2.1%",
          drift_improvement_pct: "72.4%",
        },
      },
    ],
  },
};

const itemResponse: DpmWaveGatewayResponse = {
  ...waveResponse,
  data: {
    items: [
      {
        wave_item_id: "dwi_1",
        portfolio_id: "PB_SG_GLOBAL_BAL_001",
        state: "SIMULATION_READY",
        source_readiness_state: "READY",
        diagnostics: {
          proposed_changes: [
            {
              security_id: "AAPL US",
              action: "Trim",
              estimated_value: "7,420.00",
              reason: "Equity overweight",
              mandate_impact: "Improves equity band",
              status: "READY",
            },
            {
              security_id: "MSFT US",
              action: "Buy",
              estimated_value: "3,840.50",
              reason: "Target allocation",
              mandate_impact: "Improves benchmark alignment",
              status: "READY",
            },
          ],
        },
      },
    ],
  },
};

const campaignDefinitionsResponse: DpmCampaignDefinitionGatewayResponse = {
  correlation_id: "corr-campaign",
  contract_version: "v1",
  source_service: "lotus-manage",
  upstream_status: 200,
  data: {
    items: [
      {
        campaign_id: "campaign-holdings-202605",
        campaign_version: "2026.05",
        display_name: "Apple and Tesla holdings review",
        status: "ACTIVE",
        as_of_date: "2026-05-10",
        eligible_portfolio_types: ["DISCRETIONARY"],
        candidates: [
          {
            portfolio_id: "PB_SG_GLOBAL_BAL_001",
            portfolio_type: "DISCRETIONARY",
            source_refs: [{ source_type: "PortfolioManagerBookMembership", source_id: "book-1" }],
          },
          {
            portfolio_id: "PB_SG_GLOBAL_INC_002",
            portfolio_type: "DISCRETIONARY",
            source_refs: [{ source_type: "RiskEventAffectedCohort", source_id: "risk-1" }],
          },
        ],
        governance: {
          approval_ref: "BRC-APPROVAL-2026-05",
          approved_by: "cio_ops_committee",
        },
        source_refs: [{ source_type: "BulkReviewCampaignDefinition", source_id: "campaign-plan" }],
        content_hash: "sha256:campaign-definition",
      },
    ],
    limit: 10,
    offset: 0,
    count: 1,
  },
};

const campaignLifecycleResponse: DpmCampaignDefinitionGatewayResponse = {
  correlation_id: "corr-campaign-lifecycle",
  contract_version: "v1",
  source_service: "lotus-manage",
  upstream_status: 200,
  data: {
    campaign_id: "campaign-holdings-202605",
    campaign_version: "2026.05",
    events: [
      {
        event_type: "LAUNCHED",
        occurred_at: "2026-05-14T09:30:00Z",
        actor_id: "pm_sg_1",
        status: "RECORDED",
        reason_code: "campaign_definition_launched",
        wave_id: "dwv_campaign_launch_001",
        requested_as_of_date: "2026-05-10",
        correlation_id: "corr-campaign-launch",
        idempotency_key: "campaign-launch:campaign-holdings-202605:2026.05:abc",
      },
    ],
  },
};

const campaignLaunchHistoryResponse: DpmCampaignDefinitionGatewayResponse = {
  correlation_id: "corr-campaign-launch-history",
  contract_version: "v1",
  source_service: "lotus-manage",
  upstream_status: 200,
  data: {
    product_name: "BulkReviewCampaignDefinitionLaunchHistory",
    campaign_id: "campaign-holdings-202605",
    campaign_version: "2026.05",
    items: [
      {
        wave_id: "dwv_campaign_launch_001",
        launched_at: "2026-05-10T00:00:00Z",
        launched_by: "pm_sg_1",
        requested_as_of_date: "2026-05-10",
        correlation_id: "corr-campaign-launch",
        idempotency_key: "campaign-launch:campaign-holdings-202605:2026.05:abc",
      },
    ],
    limit: 10,
    offset: 0,
    count: 1,
    total_count: 11,
    operating_boundaries: [
      "NO_MAKER_CHECKER_WORKFLOW",
      "NO_TRADE_APPROVAL",
      "NO_ORDER_GENERATION",
      "NO_OMS_EXECUTION_CLAIM",
    ],
  },
};

const campaignDiscoveryResponse: DpmCampaignDefinitionGatewayResponse = {
  correlation_id: "corr-campaign-discovery",
  contract_version: "v1",
  source_service: "lotus-manage",
  upstream_status: 200,
  data: {
    items: [
      {
        product_name: "BulkReviewCampaignDiscovery",
        campaign_id: "campaign-holdings-202605",
        campaign_version: "2026.05",
        campaign_status: "ACTIVE",
        candidate_count: 12,
        eligible_candidate_count: 10,
        governance_status: "APPROVED",
        expiry_state: "ACTIVE",
        access_purpose: "rebalance_review",
        source_ref_count: 4,
      },
    ],
  },
};

const campaignLaunchPackageResponse: DpmCampaignDefinitionGatewayResponse = {
  correlation_id: "corr-campaign-launch-package",
  contract_version: "v1",
  source_service: "lotus-manage",
  upstream_status: 200,
  data: {
    product_name: "BulkReviewCampaignDefinitionLaunchPackage",
    campaign_id: "campaign-holdings-202605",
    campaign_version: "2026.05",
    requested_as_of_date: "2026-05-10",
    actor_id: "pm_sg_1",
    launch_state: "READY",
    reason_codes: [],
    create_headers: {
      "Idempotency-Key": "campaign-launch:campaign-holdings-202605:2026.05:abc",
    },
  },
};

const campaignPreviewReadinessResponse: DpmCampaignDefinitionGatewayResponse = {
  correlation_id: "corr-campaign-preview-readiness",
  contract_version: "v1",
  source_service: "lotus-manage",
  upstream_status: 200,
  data: {
    product_name: "BulkReviewCampaignDefinitionPreviewReadiness",
    product_version: "v1",
    campaign_id: "campaign-holdings-202605",
    campaign_version: "2026.05",
    requested_as_of_date: "2026-05-10",
    actor_id: "pm_sg_1",
    supportability_state: "READY",
    reason_codes: [],
    blocked_actions: [],
    source_refs: [{ source_type: "BulkReviewCampaignDefinition", source_id: "campaign-plan" }],
    operating_boundaries: ["NO_ORDER_GENERATION", "NO_OMS_EXECUTION_CLAIM"],
  },
};

const campaignLaunchResponse: DpmWaveGatewayResponse = {
  ...waveResponse,
  correlation_id: "corr-campaign-launch",
  upstream_status: 201,
  supportability: {
    ...waveResponse.supportability,
    state: "ready",
    wave_id: "dwv_campaign_launch_001",
    wave_state: "CREATED",
  },
  data: {
    wave: {
      wave_id: "dwv_campaign_launch_001",
      state: "CREATED",
      trigger_type: "BULK_REVIEW_CAMPAIGN",
    },
    durable: true,
  },
};

describe("DpmWaveCommandCenterPanel", () => {
  beforeEach(() => {
    vi.mocked(listDpmWaves).mockResolvedValue(waveResponse);
    vi.mocked(getDpmWave).mockResolvedValue(waveResponse);
    vi.mocked(getDpmWaveItems).mockResolvedValue(itemResponse);
    vi.mocked(getDpmCampaignDefinitionLifecycleEvents).mockResolvedValue(campaignLifecycleResponse);
    vi.mocked(getDpmCampaignDefinitionLaunchHistory).mockResolvedValue(campaignLaunchHistoryResponse);
    vi.mocked(getDpmCampaignDefinitionPreviewReadiness).mockResolvedValue(campaignPreviewReadinessResponse);
    vi.mocked(getDpmCampaignDefinitionLaunchPackage).mockResolvedValue(campaignLaunchPackageResponse);
    vi.mocked(launchDpmCampaignDefinition).mockResolvedValue(campaignLaunchResponse);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each(["unavailable", "unsupported", "future_state", "unknown", "", " \t\n"])(
    "withholds approval readiness for unconfirmed source %j",
    async (state) => {
      const response: DpmWaveGatewayResponse = {
        ...waveResponse,
        supportability: { ...waveResponse.supportability, state },
      };
      vi.mocked(getDpmWave).mockResolvedValue(response);
      vi.mocked(getDpmWaveItems).mockResolvedValue({
        ...itemResponse,
        supportability: response.supportability,
      });
      renderWithQueryClient(
        <DpmWaveCommandCenterPanel portfolioId="PORTFOLIO_001" waveList={response} />,
      );
      await waitFor(() => expect(getDpmWaveItems).toHaveBeenCalledWith("dwv_001"));

      const approval = screen.getByRole("button", { name: "Request Approval" });
      await waitFor(() => expect(approval).toBeDisabled());
      expect(within(screen.getByLabelText("Rebalance readiness")).queryByText("Ready", { exact: true })).not.toBeInTheDocument();
      expect(screen.queryByText("Approval can proceed after advisor review.")).not.toBeInTheDocument();
      fireEvent.click(approval);
      expect(approveDpmWave).not.toHaveBeenCalled();
    },
  );

  it("does not advertise approval readiness for an empty source despite a retained wave identity", async () => {
    const response: DpmWaveGatewayResponse = { ...waveResponse, data: {} };
    vi.mocked(getDpmWave).mockResolvedValue(response);
    vi.mocked(getDpmWaveItems).mockResolvedValue({ ...itemResponse, data: {} });
    renderWithQueryClient(
      <DpmWaveCommandCenterPanel portfolioId="PORTFOLIO_001" waveList={response} />,
    );
    await waitFor(() => expect(getDpmWaveItems).toHaveBeenCalledWith("dwv_001"));
    const approval = screen.getByRole("button", { name: "Request Approval" });
    expect(approval).toBeDisabled();
    expect(screen.queryByText("Approval can proceed after advisor review.")).not.toBeInTheDocument();
    fireEvent.click(approval);
    expect(approveDpmWave).not.toHaveBeenCalled();
  });

  it("withholds approval readiness when no source response is available", () => {
    renderWithQueryClient(
      <DpmWaveCommandCenterPanel portfolioId="PORTFOLIO_001" waveList={null} />,
    );
    expect(screen.getByRole("button", { name: "Request Approval" })).toBeDisabled();
    expect(within(screen.getByLabelText("Rebalance readiness")).queryByText("Ready", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Approval can proceed after advisor review.")).not.toBeInTheDocument();
    expect(approveDpmWave).not.toHaveBeenCalled();
  });

  it("preserves the normalized ready approval control through the existing action boundary", async () => {
    const response: DpmWaveGatewayResponse = {
      ...waveResponse,
      supportability: { ...waveResponse.supportability, state: " \tReAdY\n" },
    };
    vi.mocked(getDpmWave).mockResolvedValue(response);
    vi.mocked(approveDpmWave).mockResolvedValue(response);
    renderWithQueryClient(
      <DpmWaveCommandCenterPanel portfolioId="PORTFOLIO_001" waveList={response} />,
    );
    await waitFor(() => expect(getDpmWaveItems).toHaveBeenCalledWith("dwv_001"));
    const approval = screen.getByRole("button", { name: "Request Approval" });
    await waitFor(() => expect(approval).toBeEnabled());
    expect(screen.getByText("Approval can proceed after advisor review.")).toBeInTheDocument();
    fireEvent.click(approval);
    await waitFor(() => expect(approveDpmWave).toHaveBeenCalledWith("dwv_001"));
  });

  it("renders the business-facing rebalance workspace with implementation-backed proposed changes", async () => {
    renderWithQueryClient(
      <DpmWaveCommandCenterPanel
        portfolioId="PB_SG_GLOBAL_BAL_001"
        mandateType="DPM_GLOBAL_BALANCED"
        portfolioCurrency="SGD"
        waveList={waveResponse}
        campaignDefinitions={campaignDefinitionsResponse}
        campaignDiscovery={campaignDiscoveryResponse}
      />,
    );

    const workspace = screen.getByRole("heading", { name: "Rebalance" }).closest("article");
    expect(workspace).toHaveAttribute("id", "rebalance-workspace");
    expect(workspace).toHaveClass("rebalance-workspace");
    expect(workspace).not.toHaveClass("dpm-wave-command-center-panel");
    expect(screen.getByText("Proposed rebalance, advisor review, and approval readiness.")).toBeInTheDocument();
    expect(screen.getByLabelText("Rebalance source context")).toHaveTextContent(
      "Discretionary Global BalancedSGDAs of 03 May 2026Evidence not requested",
    );
    expect(screen.queryByText("Discretionary Balanced")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filter" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Ready to simulate").length).toBeGreaterThan(0);
    expect(screen.getByText("72.4%")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Active Rebalance" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Campaign administration" })).toBeInTheDocument();
    expect(screen.getAllByText("Apple and Tesla holdings review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("10").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Candidate Source Review" })).toBeInTheDocument();
    expect(screen.getByText("Source-backed")).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Campaign administration modes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review posture" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("heading", { name: "Campaign launch decision" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recommended Actions" })).toBeInTheDocument();

    const activeRebalance = screen.getByRole("heading", { name: "Active Rebalance" });
    const proposedChanges = screen.getByRole("heading", { name: "Proposed Changes" });
    const decisionSupport = screen.getByRole("heading", { name: "Decision support" });
    const campaignDefinitions = screen.getByRole("heading", { name: "Campaign administration" });
    expect(activeRebalance.compareDocumentPosition(proposedChanges)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(proposedChanges.compareDocumentPosition(decisionSupport)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(decisionSupport.compareDocumentPosition(campaignDefinitions)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    const table = screen.getByRole("table", { name: "Proposed rebalance changes" });
    expect(await within(table).findByText("AAPL US")).toBeInTheDocument();
    expect(within(table).getByText("Trim")).toBeInTheDocument();
    expect(within(table).getByText("Equity overweight")).toBeInTheDocument();
    expect(within(table).getByText("MSFT US")).toBeInTheDocument();
    expect(screen.queryByText("lotus-manage")).not.toBeInTheDocument();
    expect(screen.queryByText("corr-wave")).not.toBeInTheDocument();
    expect(screen.queryByText("corr-campaign-discovery")).not.toBeInTheDocument();
    expect(screen.queryByText("sha256:campaign-definition")).not.toBeInTheDocument();
  });

  it("loads read-only campaign lifecycle evidence through the Gateway helper", async () => {
    renderWithQueryClient(
      <DpmWaveCommandCenterPanel
        portfolioId="PB_SG_GLOBAL_BAL_001"
        waveList={waveResponse}
        campaignDefinitions={campaignDefinitionsResponse}
      />,
    );

    await waitFor(() =>
      expect(getDpmCampaignDefinitionLifecycleEvents).toHaveBeenCalledWith({
        campaignId: "campaign-holdings-202605",
        campaignVersion: "2026.05",
      }),
    );

    fireEvent.click(screen.getByText("Lifecycle history and technical trace"));

    const table = await screen.findByRole("table", {
      name: "Rebalance campaign lifecycle evidence",
    });
    expect(within(table).getByText("Launched")).toBeInTheDocument();
    expect(within(table).getByText("14 May 2026, 09:30 UTC")).toBeInTheDocument();
    expect(within(table).queryByText("2026-05-14T09:30:00Z")).not.toBeInTheDocument();
    expect(within(table).getByText("Portfolio Manager · pm_sg_1")).toBeInTheDocument();
    expect(within(table).getByText("dwv_campaign_launch_001")).toBeInTheDocument();
    expect(within(table).getByText("10 May 2026")).toBeInTheDocument();
    expect(within(table).getByText("campaign_definition_launched")).toBeInTheDocument();
    expect(within(table).getByText("corr-campaign-launch")).toBeInTheDocument();
    expect(
      within(table).getByText("campaign-launch:campaign-holdings-202605:2026.05:abc"),
    ).toBeInTheDocument();
    expect(screen.queryByText("corr-campaign-lifecycle")).not.toBeInTheDocument();
  });

  it("loads append-only campaign launch history through the Gateway helper", async () => {
    renderWithQueryClient(
      <DpmWaveCommandCenterPanel
        portfolioId="PB_SG_GLOBAL_BAL_001"
        waveList={waveResponse}
        campaignDefinitions={campaignDefinitionsResponse}
      />,
    );

    await waitFor(() =>
      expect(getDpmCampaignDefinitionLaunchHistory).toHaveBeenCalledWith({
        campaignId: "campaign-holdings-202605",
        campaignVersion: "2026.05",
        limit: 10,
        offset: 0,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Launch decision" }));
    fireEvent.click(screen.getByText("Launch history and replay evidence"));

    const table = await screen.findByRole("table", { name: "Rebalance campaign launch history" });
    expect(within(table).getByText("dwv_campaign_launch_001")).toBeInTheDocument();
    expect(within(table).getByText("Portfolio Manager · pm_sg_1")).toBeInTheDocument();
    expect(within(table).getByText("10 May 2026, 00:00 UTC")).toBeInTheDocument();
    expect(within(table).queryByText("2026-05-10T00:00:00Z")).not.toBeInTheDocument();
    expect(within(table).getByText("corr-campaign-launch")).toBeInTheDocument();
    expect(
      within(table).getByText("campaign-launch:campaign-holdings-202605:2026.05:abc"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No maker-checker workflow, No trade approval, No order generation, No execution claim",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(getDpmCampaignDefinitionLaunchHistory).toHaveBeenLastCalledWith({
        campaignId: "campaign-holdings-202605",
        campaignVersion: "2026.05",
        limit: 10,
        offset: 10,
      }),
    );
    expect(screen.queryByText("corr-campaign-launch-history")).not.toBeInTheDocument();
  });

  it("renders an empty campaign launch-history page without execution claims", async () => {
    vi.mocked(getDpmCampaignDefinitionLaunchHistory).mockResolvedValueOnce({
      ...campaignLaunchHistoryResponse,
      data: {
        ...campaignLaunchHistoryResponse.data,
        items: [],
        count: 0,
        total_count: 0,
        operating_boundaries: ["NO_ORDER_GENERATION", "NO_OMS_EXECUTION_CLAIM"],
      },
    });

    renderWithQueryClient(
      <DpmWaveCommandCenterPanel
        portfolioId="PB_SG_GLOBAL_BAL_001"
        waveList={waveResponse}
        campaignDefinitions={campaignDefinitionsResponse}
      />,
    );

    await waitFor(() => expect(getDpmCampaignDefinitionLaunchHistory).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Launch decision" }));
    fireEvent.click(screen.getByText("Launch history and replay evidence"));

    expect(screen.getByText("No launch records")).toBeInTheDocument();
    expect(screen.getByText("0 of 0")).toBeInTheDocument();
    expect(screen.queryByText("1-0 of 0")).not.toBeInTheDocument();
    expect(screen.getAllByText("No order generation, No execution claim").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("enables campaign launch only after Manage launch readiness is ready", async () => {
    renderWithQueryClient(
      <DpmWaveCommandCenterPanel
        portfolioId="PB_SG_GLOBAL_BAL_001"
        waveList={waveResponse}
        campaignDefinitions={campaignDefinitionsResponse}
      />,
    );

    await waitFor(() =>
      expect(getDpmCampaignDefinitionPreviewReadiness).toHaveBeenCalledWith({
        campaignId: "campaign-holdings-202605",
        campaignVersion: "2026.05",
        requestedAsOfDate: "2026-05-10",
      }),
    );
    await waitFor(() =>
      expect(getDpmCampaignDefinitionLaunchPackage).toHaveBeenCalledWith({
        campaignId: "campaign-holdings-202605",
        campaignVersion: "2026.05",
        requestedAsOfDate: "2026-05-10",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Launch decision" }));
    expect((await screen.findAllByText("Ready")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("No order generation, No execution claim").length).toBeGreaterThan(0);
    const launchButton = screen.getByRole("button", { name: "Launch rebalance wave" });
    expect(launchButton).toBeDisabled();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /I reviewed the source readiness.*one governed rebalance wave.*does not approve trades or send orders/i,
      }),
    );
    fireEvent.click(launchButton);

    await waitFor(() =>
      expect(launchDpmCampaignDefinition).toHaveBeenCalledWith({
        campaignId: "campaign-holdings-202605",
        campaignVersion: "2026.05",
        requestedAsOfDate: "2026-05-10",
      }),
    );

    expect((await screen.findAllByText("dwv_campaign_launch_001")).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("campaign-launch:campaign-holdings-202605:2026.05:abc").length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Launch rebalance wave" })).toBeDisabled();
    expect(
      screen.getAllByText("corr-campaign-launch").every((element) => element.closest("details") !== null),
    ).toBe(true);
  });

  it("renders blocked campaign preview readiness and keeps launch unavailable", async () => {
    vi.mocked(getDpmCampaignDefinitionPreviewReadiness).mockResolvedValue({
      ...campaignPreviewReadinessResponse,
      data: {
        ...campaignPreviewReadinessResponse.data,
        supportability_state: "BLOCKED",
        reason_codes: ["campaign_definition_actor_not_entitled"],
        blocked_actions: ["preview_wave", "create_wave"],
      },
    });

    renderWithQueryClient(
      <DpmWaveCommandCenterPanel
        portfolioId="PB_SG_GLOBAL_BAL_001"
        waveList={waveResponse}
        campaignDefinitions={campaignDefinitionsResponse}
      />,
    );

    await waitFor(() => expect(getDpmCampaignDefinitionPreviewReadiness).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Launch decision" }));
    expect((await screen.findAllByText("Permission required")).length).toBeGreaterThan(0);
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(
      await screen.findByText("Preview rebalance wave, Create rebalance wave"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Launch rebalance wave" })).toBeDisabled();
    expect(getDpmCampaignDefinitionLaunchPackage).not.toHaveBeenCalled();
    expect(launchDpmCampaignDefinition).not.toHaveBeenCalled();
  });

  it("routes bounded workflow actions through Gateway helpers", async () => {
    vi.mocked(previewDpmWave).mockResolvedValue(waveResponse);
    vi.mocked(createDpmWave).mockResolvedValue(waveResponse);
    vi.mocked(sourceCheckDpmWave).mockResolvedValue(waveResponse);
    vi.mocked(simulateDpmWave).mockResolvedValue(waveResponse);
    vi.mocked(approveDpmWave).mockResolvedValue(waveResponse);
    vi.mocked(stageDpmWave).mockResolvedValue(waveResponse);
    vi.mocked(handoffDpmWave).mockResolvedValue(waveResponse);
    vi.mocked(getDpmWaveProofPackPosture).mockResolvedValue(waveResponse);

    renderWithQueryClient(
      <DpmWaveCommandCenterPanel
        portfolioId="PB_SG_GLOBAL_BAL_001"
        waveList={waveResponse}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    await waitFor(() =>
      expect(previewDpmWave).toHaveBeenCalledWith({ portfolioId: "PB_SG_GLOBAL_BAL_001" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Create Rebalance" }));
    await waitFor(() =>
      expect(createDpmWave).toHaveBeenCalledWith({ portfolioId: "PB_SG_GLOBAL_BAL_001" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Load Changes" }));
    await waitFor(() => expect(getDpmWaveItems).toHaveBeenCalledWith("dwv_001"));

    fireEvent.click(screen.getByRole("button", { name: "Review Data" }));
    await waitFor(() => expect(sourceCheckDpmWave).toHaveBeenCalledWith("dwv_001"));

    fireEvent.click(screen.getByRole("button", { name: "Simulate" }));
    await waitFor(() => expect(simulateDpmWave).toHaveBeenCalledWith("dwv_001"));

    fireEvent.click(screen.getByRole("button", { name: "Request Approval" }));
    await waitFor(() => expect(approveDpmWave).toHaveBeenCalledWith("dwv_001"));

    fireEvent.click(screen.getByRole("button", { name: "Stage" }));
    await waitFor(() => expect(stageDpmWave).toHaveBeenCalledWith("dwv_001"));

    fireEvent.click(screen.getByRole("button", { name: "Prepare Handoff" }));
    await waitFor(() => expect(handoffDpmWave).toHaveBeenCalledWith("dwv_001"));

    fireEvent.click(screen.getByRole("button", { name: "Open Evidence Pack" }));
    await waitFor(() => expect(getDpmWaveProofPackPosture).toHaveBeenCalledWith("dwv_001"));
  });

  it("renders source context for the selected wave rather than the first list row", async () => {
    renderWithQueryClient(
      <DpmWaveCommandCenterPanel
        portfolioId="PB_SG_GLOBAL_BAL_001"
        waveList={{
          ...waveResponse,
          supportability: {
            ...waveResponse.supportability,
            wave_id: "dwv_002",
          },
          data: {
            items: [
              {
                wave_id: "dwv_001",
                state: "CREATED",
                as_of_date: "2026-05-01",
              },
              {
                wave_id: "dwv_002",
                state: "SIMULATION_READY",
                as_of_date: "2026-05-09",
              },
            ],
          },
        }}
      />,
    );

    await waitFor(() => expect(getDpmWaveItems).toHaveBeenCalledWith("dwv_002"));
    await waitFor(() =>
      expect(screen.getByLabelText("Rebalance source context")).toHaveTextContent(
        "As of 09 May 2026",
      ),
    );
    expect(screen.getByLabelText("Rebalance source context")).not.toHaveTextContent(
      "As of 01 May 2026",
    );
  });

  it("keeps blocked source evidence visibly blocked after the proof-pack response loads", async () => {
    vi.mocked(getDpmWaveProofPackPosture).mockResolvedValue({
      ...waveResponse,
      supportability: {
        ...waveResponse.supportability,
        state: "blocked",
        reason_codes: ["proof_pack_evidence_incomplete"],
        blocked_actions: ["open_proof_pack"],
      },
      data: {
        wave: {
          wave_id: "dwv_001",
          state: "SIMULATION_READY",
          proof_pack_posture: {
            proof_pack_refs: [{ proof_pack_id: "ppack_1" }],
          },
        },
      },
    });

    renderWithQueryClient(
      <DpmWaveCommandCenterPanel
        portfolioId="PB_SG_GLOBAL_BAL_001"
        waveList={waveResponse}
      />,
    );

    expect(screen.getByLabelText("Rebalance source context")).toHaveTextContent(
      "Evidence not requested",
    );
    fireEvent.click(screen.getByRole("button", { name: "Open Evidence Pack" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Rebalance source context")).toHaveTextContent(
        "Evidence blocked",
      ),
    );
    expect(screen.queryByText("Evidence ready")).not.toBeInTheDocument();
  });

  it("prepares governed PM and operations decision support in the rebalance workflow", async () => {
    vi.mocked(requestDpmWaveAiPmMemo).mockResolvedValue({
      ...buildDpmAiWorkflowResponse("wave-memo"),
      supportability: waveResponse.supportability,
      wave_report_input: { wave_id: "dwv_001" },
      memo_request: { requested_outputs: ["wave_pm_memo"] },
    });
    vi.mocked(requestDpmOperationsHandoffSummary).mockResolvedValue({
      ...buildDpmAiWorkflowResponse("operations-handoff"),
      supportability: waveResponse.supportability,
      wave_report_input: { wave_id: "dwv_001" },
      handoff_summary_request: { requested_outputs: ["operations_summary"] },
    });

    renderWithQueryClient(
      <DpmWaveCommandCenterPanel
        portfolioId="PB_SG_GLOBAL_BAL_001"
        waveList={waveResponse}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Prepare rebalance PM memo" }));
    await waitFor(() => expect(requestDpmWaveAiPmMemo).toHaveBeenCalledWith("dwv_001"));
    const memoHeading = await screen.findByRole("heading", {
      name: "Rebalance wave review memo",
    });
    expect(memoHeading).toHaveFocus();
    expect(screen.getByLabelText("Status Live output • review required")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Prepare rebalance operations brief" }),
    );
    await waitFor(() =>
      expect(requestDpmOperationsHandoffSummary).toHaveBeenCalledWith("dwv_001"),
    );
    const operationsHeading = await screen.findByRole("heading", {
      name: "Operations handoff summary",
    });
    expect(operationsHeading).toHaveFocus();
    expect(screen.getAllByText("Awaiting review").length).toBeGreaterThanOrEqual(2);
  });

  it("never carries decision support from one rebalance wave into another", async () => {
    const nextWaveResponse: DpmWaveGatewayResponse = {
      ...waveResponse,
      correlation_id: "corr-wave-002",
      supportability: {
        ...waveResponse.supportability,
        wave_id: "dwv_002",
        wave_state: "CREATED",
      },
      data: {
        wave: {
          wave_id: "dwv_002",
          state: "CREATED",
          trigger_type: "EXPLICIT_PORTFOLIO_LIST",
        },
      },
    };
    vi.mocked(requestDpmWaveAiPmMemo).mockResolvedValue({
      ...buildDpmAiWorkflowResponse("wave-memo"),
      supportability: waveResponse.supportability,
      wave_report_input: { wave_id: "dwv_001" },
      memo_request: { requested_outputs: ["wave_pm_memo"] },
    });
    vi.mocked(requestDpmOperationsHandoffSummary).mockResolvedValue({
      ...buildDpmAiWorkflowResponse("operations-handoff"),
      supportability: waveResponse.supportability,
      wave_report_input: { wave_id: "dwv_001" },
      handoff_summary_request: { requested_outputs: ["operations_summary"] },
    });
    vi.mocked(createDpmWave).mockResolvedValue(nextWaveResponse);
    vi.mocked(getDpmWave).mockImplementation(async (waveId) =>
      waveId === "dwv_002" ? nextWaveResponse : waveResponse,
    );
    vi.mocked(getDpmWaveItems).mockImplementation(async (waveId) =>
      waveId === "dwv_002"
        ? {
            ...itemResponse,
            supportability: {
              ...itemResponse.supportability,
              wave_id: "dwv_002",
              wave_state: "CREATED",
            },
          }
        : itemResponse,
    );

    renderWithQueryClient(
      <DpmWaveCommandCenterPanel
        portfolioId="PB_SG_GLOBAL_BAL_001"
        waveList={waveResponse}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Prepare rebalance PM memo" }));
    await screen.findByRole("heading", { name: "Rebalance wave review memo" });
    fireEvent.click(
      screen.getByRole("button", { name: "Prepare rebalance operations brief" }),
    );
    await screen.findByRole("heading", { name: "Operations handoff summary" });

    fireEvent.click(screen.getByRole("button", { name: "Create Rebalance" }));
    await waitFor(() => expect(getDpmWaveItems).toHaveBeenCalledWith("dwv_002"));

    expect(
      screen.queryByRole("heading", { name: "Operations handoff summary" }),
    ).not.toBeInTheDocument();
    const decisionSupport = screen
      .getByRole("heading", { name: "Decision support" })
      .closest("section");
    expect(decisionSupport).not.toBeNull();
    expect(within(decisionSupport!).getAllByText("Not requested")).toHaveLength(2);
  });

  it("offers exact source confirmation retry after a retained detail failure", async () => {
    const retainedWaveResponse: DpmWaveGatewayResponse = {
      ...waveResponse,
      correlation_id: "corr-wave-002",
      supportability: {
        ...waveResponse.supportability,
        wave_id: "dwv_002",
        wave_state: "CREATED",
      },
      data: {
        wave: {
          wave_id: "dwv_002",
          state: "CREATED",
          trigger_type: "EXPLICIT_PORTFOLIO_LIST",
        },
      },
    };
    vi.mocked(createDpmWave).mockResolvedValue(retainedWaveResponse);
    vi.mocked(getDpmWave).mockResolvedValueOnce(retainedWaveResponse);
    vi.mocked(getDpmWaveItems).mockResolvedValue({
      ...itemResponse,
      supportability: {
        ...itemResponse.supportability,
        wave_id: "dwv_002",
        wave_state: "CREATED",
      },
    });
    const rendered = renderWithQueryClient(
      <DpmWaveCommandCenterPanel
        portfolioId="PB_SG_GLOBAL_BAL_001"
        waveList={waveResponse}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create Rebalance" }));
    await waitFor(() => expect(getDpmWave).toHaveBeenCalledTimes(1));

    vi.mocked(getDpmWave).mockRejectedValueOnce(new Error("Gateway detail unavailable"));
    await rendered.queryClient.invalidateQueries({
      queryKey: dpmWaveQueryKeys.wave("dwv_002"),
      exact: true,
      refetchType: "none",
    });

    const retry = await screen.findByRole("button", {
      name: "Retry source confirmation",
    });
    expect(screen.getByText("Gateway detail unavailable")).toBeInTheDocument();
    vi.mocked(getDpmWave).mockResolvedValueOnce(retainedWaveResponse);
    fireEvent.click(retry);

    await waitFor(() => expect(getDpmWave).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Retry source confirmation" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("keeps accepted-create recovery visible until list reconciliation succeeds", async () => {
    const retainedWaveResponse: DpmWaveGatewayResponse = {
      ...waveResponse,
      correlation_id: "corr-wave-002",
      supportability: {
        ...waveResponse.supportability,
        wave_id: "dwv_002",
        wave_state: "CREATED",
      },
      data: {
        wave: {
          wave_id: "dwv_002",
          state: "CREATED",
          trigger_type: "EXPLICIT_PORTFOLIO_LIST",
        },
      },
    };
    vi.mocked(createDpmWave).mockResolvedValue(retainedWaveResponse);
    vi.mocked(getDpmWave).mockResolvedValue(retainedWaveResponse);
    vi.mocked(getDpmWaveItems).mockResolvedValue({
      ...itemResponse,
      supportability: {
        ...itemResponse.supportability,
        wave_id: "dwv_002",
        wave_state: "CREATED",
      },
    });
    vi.mocked(listDpmWaves)
      .mockRejectedValueOnce(new Error("Rebalance list unavailable"))
      .mockResolvedValueOnce(retainedWaveResponse);
    renderWithQueryClient(
      <DpmWaveCommandCenterPanel
        portfolioId="PB_SG_GLOBAL_BAL_001"
        waveList={waveResponse}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create Rebalance" }));

    expect(
      await screen.findByText(/Create rebalance was accepted.*Rebalance list unavailable/i),
    ).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: "Retry source confirmation" });
    fireEvent.click(retry);

    await waitFor(() => expect(listDpmWaves).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Retry source confirmation" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("does not carry an in-flight workflow posture or error into another wave", async () => {
    let rejectMemo!: (reason?: unknown) => void;
    const memoRequest = new Promise<
      Awaited<ReturnType<typeof requestDpmWaveAiPmMemo>>
    >((_, reject) => {
      rejectMemo = reject;
    });
    vi.mocked(requestDpmWaveAiPmMemo).mockReturnValue(memoRequest);
    const nextWaveList: DpmWaveGatewayResponse = {
      ...waveResponse,
      correlation_id: "corr-wave-002",
      supportability: {
        ...waveResponse.supportability,
        wave_id: "dwv_002",
        wave_state: "CREATED",
      },
      data: {
        items: [
          {
            wave_id: "dwv_002",
            state: "CREATED",
            trigger_type: "EXPLICIT_PORTFOLIO_LIST",
            as_of_date: "2026-05-04",
            item_count: 0,
            supportability_state: "ready",
          },
        ],
      },
    };

    const { rerender } = renderWithQueryClient(
      <DpmWaveCommandCenterPanel
        portfolioId="PB_SG_GLOBAL_BAL_001"
        waveList={waveResponse}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Prepare rebalance PM memo" }));
    await screen.findByText("Preparing PM memo");

    rerender(
      <DpmWaveCommandCenterPanel
        portfolioId="PB_SG_GLOBAL_BAL_001"
        waveList={nextWaveList}
      />,
    );

    const nextWaveMemo = screen.getByRole("button", {
      name: "Prepare rebalance PM memo",
    });
    expect(nextWaveMemo).toBeEnabled();
    expect(nextWaveMemo).toHaveTextContent("Prepare PM memo");

    await act(async () => {
      rejectMemo(new Error("Wave A memo request failed."));
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.queryByText("Wave A memo request failed.")).not.toBeInTheDocument();
      expect(nextWaveMemo).toBeEnabled();
    });
  });

  it("does not enable approval when mandate attention items block the workflow", async () => {
    renderWithQueryClient(
      <DpmWaveCommandCenterPanel
        portfolioId="PB_SG_GLOBAL_BAL_001"
        waveList={{
          ...waveResponse,
          supportability: {
            ...waveResponse.supportability,
            state: "blocked",
            reason_codes: ["MANDATE_ATTENTION_REQUIRED"],
            blocked_actions: ["approve"],
            issue_count: 1,
          },
        }}
      />,
    );

    await screen.findByText("AAPL US");

    expect(screen.getByRole("button", { name: "Request Approval" })).toBeDisabled();
    expect(screen.getByText("Resolve mandate attention items before approval.")).toBeInTheDocument();
  });
});
