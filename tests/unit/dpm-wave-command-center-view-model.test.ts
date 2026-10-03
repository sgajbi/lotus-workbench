import { describe, expect, it } from "vitest";

import { buildDpmWaveCommandCenterModel } from "../../src/features/workbench/dpm-wave-command-center-view-model";
import type {
  DpmOperationsHandoffSummaryResponse,
  DpmWaveAiPmMemoResponse,
  DpmWaveGatewayResponse,
} from "../../src/features/workbench/types";
import {
  buildDpmAiWorkflowExecution,
  buildDpmAiWorkflowResponse,
} from "../fixtures/dpm-ai-workflow-fixtures";

const waveListResponse: DpmWaveGatewayResponse = {
  correlation_id: "corr-wave-list",
  contract_version: "v1",
  source_service: "lotus-manage",
  upstream_status: 200,
  supportability: {
    source_service: "lotus-manage",
    authority: "lotus-manage:RFC-0041",
    state: "ready",
    reason_codes: ["wave_supportability_ready"],
    blocked_actions: [],
    wave_id: "dwv_001",
    wave_state: "HANDOFF_READY",
    item_count: 1,
    issue_count: 0,
    remediation_owner: "Portfolio Operations",
  },
  data: {
    items: [
      {
        wave_id: "dwv_001",
        state: "HANDOFF_READY",
        trigger_type: "EXPLICIT_PORTFOLIO_LIST",
        as_of_date: "2026-05-03",
        item_count: 1,
        supportability_state: "ready",
        supportability_reason: "wave_supportability_ready",
        aggregate_metrics: { item_count: 1, ready_item_count: 1 },
      },
    ],
  },
};

describe("DPM wave command-center view model", () => {
  describe("source supportability admission", () => {
    const cases = [
      ["ready", "READY", "ready"],
      [" \tReAdY\n", "READY", "ready"],
      ["blocked", "BLOCKED", "blocked"],
      [" \tBlOcKeD\n", "BLOCKED", "blocked"],
      ["degraded", "DEGRADED", "partial"],
      ["partial", "PARTIAL", "partial"],
      ["unknown", "UNKNOWN", "partial"],
      ["unavailable", "UNAVAILABLE", "partial"],
      ["unsupported", "UNSUPPORTED", "partial"],
      ["future_state", "FUTURE_STATE", "partial"],
      ["complete", "COMPLETE", "partial"],
      ["", "UNKNOWN", "partial"],
      [" \t\n", "UNKNOWN", "partial"],
      [undefined, "UNKNOWN", "partial"],
    ] as const;

    for (const shape of ["selected", "list", "items", "empty"] as const) {
      it.each(cases)(`admits %j for the ${shape} source without losing qualification`, (state, normalized, expected) => {
        const response: DpmWaveGatewayResponse = {
          ...waveListResponse,
          supportability: {
            ...waveListResponse.supportability,
            reason_codes: ["source_reason"],
            blocked_actions: ["simulate", "approve"],
          },
          data: shape === "selected"
            ? { wave: { wave_id: "dwv_001", state: "SIMULATION_READY" } }
            : shape === "items"
              ? { items: [{ wave_item_id: "dwi_001", portfolio_id: "PORTFOLIO_001" }] }
              : shape === "empty" ? {} : waveListResponse.data,
        };
        if (state === undefined) {
          Reflect.deleteProperty(response.supportability, "state");
        } else {
          response.supportability.state = state;
        }
        const model = buildDpmWaveCommandCenterModel({
          selectedWaveId: "dwv_001",
          waveList: shape === "list" || shape === "empty" ? response : null,
          waveDetail: shape === "selected" ? response : null,
          waveDetailSourceWaveId: "dwv_001",
          waveItems: shape === "items" ? response : null,
          waveItemsSourceWaveId: "dwv_001",
        });

        expect(model.state).toBe(shape === "empty" && expected === "ready" ? "empty" : expected);
        expect(model.supportabilityState).toBe(normalized);
        expect(model.reasonCodes).toEqual(["source_reason"]);
        expect(model.blockedActions).toEqual(["simulate", "approve"]);
        expect(model.selectedWaveId).toBe("dwv_001");
        expect(response.supportability.state).toBe(state);
      });
    }

    it("does not borrow foreign selected supportability into an admitted list", () => {
      const model = buildDpmWaveCommandCenterModel({
        waveList: waveListResponse,
        selectedWaveId: "dwv_001",
        waveDetailSourceWaveId: "foreign-wave",
        waveDetail: {
          ...waveListResponse,
          supportability: {
            ...waveListResponse.supportability,
            state: "blocked",
            reason_codes: ["foreign_reason"],
            blocked_actions: ["approve"],
          },
          data: { wave: { wave_id: "dwv_001", state: "BLOCKED" } },
        },
      });

      expect(model.state).toBe("ready");
      expect(model.supportabilityState).toBe("READY");
      expect(model.reasonCodes).toEqual(waveListResponse.supportability.reason_codes);
      expect(model.blockedActions).toEqual([]);
    });
  });

  it("keeps issue count unknown without source wave evidence", () => {
    const model = buildDpmWaveCommandCenterModel({ waveList: null });

    expect(model.selectedWaveIssueCount).toBe("N/A");
  });

  it("preserves manage wave supportability, item, proof-pack, and handoff truth", () => {
    const waveDetail: DpmWaveGatewayResponse = {
      ...waveListResponse,
      data: {
        wave: {
          wave_id: "dwv_001",
          state: "HANDOFF_READY",
          aggregate_metrics: {
            item_count: 1,
            ready_item_count: 1,
            blocked_item_count: 0,
          },
          proof_pack_posture: {
            proof_pack_refs: [
              {
                proof_pack_id: "ppack_1",
                wave_item_id: "dwi_1",
                proof_pack_state: "READY",
                content_hash: "sha256:proof",
              },
            ],
            handoff_refs: [
              {
                handoff_ref_id: "dwh_1",
                item_ids: ["dwi_1"],
                content_hash: "sha256:handoff",
              },
            ],
            external_execution_claimed: false,
          },
        },
      },
    };
    const model = buildDpmWaveCommandCenterModel({
      waveList: waveListResponse,
      waveDetail,
      waveProofPack: waveDetail,
      waveItems: {
        ...waveListResponse,
        data: {
          items: [
            {
              wave_item_id: "dwi_1",
              portfolio_id: "PB_SG_GLOBAL_BAL_001",
              state: "HANDOFF_READY",
              source_readiness_state: "READY",
              selected_alternative_id: "alt_1",
              proof_pack_id: "ppack_1",
              handoff_ref_id: "dwh_1",
              reason_codes: ["READY_FOR_HANDOFF"],
              diagnostics: {
                proposed_changes: [
                  {
                    security_id: "EQ_1",
                    action: "Buy",
                    estimated_value: "2000.0",
                    currency: "SGD",
                    reason: "Align",
                    reason_code: "DRIFT_REBALANCE",
                  },
                ],
              },
            },
          ],
        },
      },
    });

    expect(model.state).toBe("ready");
    expect(model.selectedWaveId).toBe("dwv_001");
    expect(model.selectedWaveState).toBe("HANDOFF_READY");
    expect(model.metricRows.map((row) => row.key)).toContain("ready_item_count");
    expect(model.itemRows[0]).toMatchObject({
      waveItemId: "dwi_1",
      portfolioId: "PB_SG_GLOBAL_BAL_001",
      security: "EQ_1",
      proposedAction: "Buy",
      estimatedValue: "2000.0",
      reason: "Align",
      reasonCodes: "DRIFT_REBALANCE",
      proofPackId: "ppack_1",
      handoffRef: "dwh_1",
    });
    expect(model.proofPackRows[0].value).toContain("sha256:proof");
    expect(model.handoffRows[0].label).toBe("dwh_1");
    expect(model.externalExecutionClaimed).toBe("No");
    expect(model.proofPackStatus).toBe("READY");
  });

  it("preserves source-owned proof-pack supportability without inferring readiness", () => {
    const model = buildDpmWaveCommandCenterModel({
      waveList: waveListResponse,
      waveProofPackSourceWaveId: "dwv_001",
      waveProofPack: {
        ...waveListResponse,
        supportability: {
          ...waveListResponse.supportability,
          state: "blocked",
          reason_codes: ["proof_pack_evidence_incomplete"],
          blocked_actions: ["open_proof_pack"],
        },
        data: {
          wave: {
            wave_id: "dwv_001",
            state: "HANDOFF_READY",
            proof_pack_posture: {
              proof_pack_refs: [{ proof_pack_id: "ppack_1" }],
            },
          },
        },
      },
    });

    expect(model.proofPackRows).toHaveLength(1);
    expect(model.proofPackStatus).toBe("BLOCKED");
  });

  it("prefers the exact proof-pack read over older general wave posture", () => {
    const olderWaveDetail: DpmWaveGatewayResponse = {
      ...waveListResponse,
      data: {
        wave: {
          wave_id: "dwv_001",
          state: "HANDOFF_READY",
          proof_pack_posture: {
            proof_pack_refs: [{ proof_pack_id: "ppack_old" }],
            handoff_refs: [{ handoff_ref_id: "handoff_old" }],
            external_execution_claimed: true,
          },
        },
      },
    };
    const exactProofPack: DpmWaveGatewayResponse = {
      ...waveListResponse,
      data: {
        wave: {
          wave_id: "dwv_001",
          state: "HANDOFF_READY",
          proof_pack_posture: {
            proof_pack_refs: [{ proof_pack_id: "ppack_current" }],
            handoff_refs: [{ handoff_ref_id: "handoff_current" }],
            external_execution_claimed: false,
          },
        },
      },
    };

    const model = buildDpmWaveCommandCenterModel({
      waveList: waveListResponse,
      waveDetail: olderWaveDetail,
      waveDetailSourceWaveId: "dwv_001",
      waveProofPack: exactProofPack,
      waveProofPackSourceWaveId: "dwv_001",
    });

    expect(model.proofPackRows[0]?.label).toBe("ppack_current");
    expect(model.handoffRows[0]?.label).toBe("handoff_current");
    expect(model.externalExecutionClaimed).toBe("No");
  });

  it("keeps proof-pack posture not requested before source evidence is loaded", () => {
    const model = buildDpmWaveCommandCenterModel({ waveList: waveListResponse });

    expect(model.proofPackStatus).toBe("NOT_REQUESTED");
  });

  it("binds the decision date to the selected wave and prefers selected action detail", () => {
    const multiWaveList: DpmWaveGatewayResponse = {
      ...waveListResponse,
      supportability: {
        ...waveListResponse.supportability,
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
    };

    expect(
      buildDpmWaveCommandCenterModel({ waveList: multiWaveList }).selectedWaveAsOfDate,
    ).toBe("2026-05-09");

    expect(
      buildDpmWaveCommandCenterModel({
        waveList: multiWaveList,
        actionResponse: {
          ...waveListResponse,
          supportability: {
            ...waveListResponse.supportability,
            wave_id: "dwv_002",
          },
          data: {
            wave: {
              wave_id: "dwv_002",
              state: "SIMULATION_READY",
              as_of_date: "2026-05-10",
            },
          },
        },
      }).selectedWaveAsOfDate,
    ).toBe("2026-05-10");
  });

  it("surfaces report-input and AI PM memo posture without deriving execution truth", () => {
    const aiMemoResponse: DpmWaveAiPmMemoResponse = {
      correlation_id: "corr-wave-ai-memo",
      contract_version: "v1",
      source_service: "lotus-ai",
      evidence_source_service: "lotus-manage",
      manage_upstream_status: 200,
      ai_upstream_status: 200,
      supportability: waveListResponse.supportability,
      wave_report_input: {
        wave_id: "dwv_001",
        report_input_ref: "report-input:dwv_001",
      },
      memo_request: {
        requested_outputs: ["wave_pm_memo", "approval_checklist"],
        audience: ["portfolio_manager", "investment_control"],
      },
      data: buildDpmAiWorkflowExecution("wave-memo", {
        runId: "wf_run_wave_memo_001",
      }),
    };

    const model = buildDpmWaveCommandCenterModel({
      waveList: waveListResponse,
      waveReportInput: {
        ...waveListResponse,
        data: {
          wave_id: "dwv_001",
          evidence_ref: {
            ref_id: "dwv_001:dpm_wave_report_input",
          },
        },
      },
      waveAiMemo: aiMemoResponse,
    });

    expect(model.reportInputStatus).toBe("READY");
    expect(model.reportInputRef).toBe("dwv_001:dpm_wave_report_input");
    expect(model.aiMemoStatus).toBe("AWAITING_REVIEW");
    expect(model.aiMemoRunId).toBe("wf_run_wave_memo_001");
    expect(model.externalExecutionClaimed).toBe("N/A");
  });

  it("surfaces operations handoff summary posture as support-only workflow-pack truth", () => {
    const operationsSummary: DpmOperationsHandoffSummaryResponse = {
      correlation_id: "corr-ops-summary",
      contract_version: "v1",
      source_service: "lotus-ai",
      evidence_source_service: "lotus-manage",
      manage_upstream_status: 200,
      ai_upstream_status: 200,
      supportability: waveListResponse.supportability,
      wave_report_input: {
        wave_id: "dwv_001",
        report_input_ref: "report-input:dwv_001",
      },
      handoff_summary_request: {
        requested_outputs: ["operations_summary", "blocking_conditions"],
        audience: ["operations", "portfolio_manager"],
      },
      data: buildDpmAiWorkflowExecution("operations-handoff", {
        runId: "wf_run_ops_summary_001",
      }),
    };

    const model = buildDpmWaveCommandCenterModel({
      waveList: waveListResponse,
      operationsHandoffSummary: operationsSummary,
    });

    expect(model.operationsHandoffSummaryStatus).toBe("AWAITING_REVIEW");
    expect(model.operationsHandoffSummaryRunId).toBe("wf_run_ops_summary_001");
    expect(model.aiMemoStatus).toBe("NOT_REQUESTED");
  });

  it("rejects memo and operations posture returned for another wave", () => {
    const mismatchedMemo = {
      ...buildDpmAiWorkflowResponse("wave-memo"),
      supportability: waveListResponse.supportability,
      wave_report_input: {
        wave_id: "dwv_002",
        report_input_ref: "report-input:dwv_002",
      },
      memo_request: { requested_outputs: ["wave_pm_memo"] },
    } as DpmWaveAiPmMemoResponse;
    const mismatchedOperations = {
      ...buildDpmAiWorkflowResponse("operations-handoff"),
      supportability: waveListResponse.supportability,
      wave_report_input: {
        wave_id: "dwv_002",
        report_input_ref: "report-input:dwv_002",
      },
      handoff_summary_request: {
        requested_outputs: ["operations_summary"],
      },
    } as DpmOperationsHandoffSummaryResponse;

    const model = buildDpmWaveCommandCenterModel({
      waveList: waveListResponse,
      waveAiMemo: mismatchedMemo,
      operationsHandoffSummary: mismatchedOperations,
    });

    expect(model.aiMemoStatus).toBe("NOT_REQUESTED");
    expect(model.aiMemoRunId).toBe("N/A");
    expect(model.operationsHandoffSummaryStatus).toBe("NOT_REQUESTED");
    expect(model.operationsHandoffSummaryRunId).toBe("N/A");
    expect(model.reportInputRef).toBe("N/A");
  });

  it("does not project workflow posture when the returned wave identity is missing", () => {
    const memoWithoutWaveIdentity = {
      ...buildDpmAiWorkflowResponse("wave-memo"),
      supportability: waveListResponse.supportability,
      wave_report_input: {},
      memo_request: { requested_outputs: ["wave_pm_memo"] },
    } as DpmWaveAiPmMemoResponse;
    const operationsWithoutWaveIdentity = {
      ...buildDpmAiWorkflowResponse("operations-handoff"),
      supportability: waveListResponse.supportability,
      wave_report_input: {},
      handoff_summary_request: {
        requested_outputs: ["operations_summary"],
      },
    } as DpmOperationsHandoffSummaryResponse;

    const model = buildDpmWaveCommandCenterModel({
      waveList: waveListResponse,
      waveAiMemo: memoWithoutWaveIdentity,
      operationsHandoffSummary: operationsWithoutWaveIdentity,
    });

    expect(model.aiMemoStatus).toBe("UNAVAILABLE");
    expect(model.aiMemoRunId).toBe("N/A");
    expect(model.operationsHandoffSummaryStatus).toBe("UNAVAILABLE");
    expect(model.operationsHandoffSummaryRunId).toBe("N/A");
    expect(model.reportInputRef).toBe("N/A");
  });

  it("fails closed when workflow-pack detail is absent at runtime", () => {
    const malformedMemo = { data: {} } as unknown as DpmWaveAiPmMemoResponse;
    const malformedOperations = {
      data: {},
    } as unknown as DpmOperationsHandoffSummaryResponse;

    const model = buildDpmWaveCommandCenterModel({
      waveList: waveListResponse,
      waveAiMemo: malformedMemo,
      operationsHandoffSummary: malformedOperations,
    });

    expect(model.aiMemoStatus).toBe("UNAVAILABLE");
    expect(model.aiMemoRunId).toBe("N/A");
    expect(model.operationsHandoffSummaryStatus).toBe("UNAVAILABLE");
    expect(model.operationsHandoffSummaryRunId).toBe("N/A");
  });

  it("surfaces manage-owned campaign lifecycle events without deriving campaign state", () => {
    const model = buildDpmWaveCommandCenterModel({
      waveList: waveListResponse,
      campaignLifecycleEvents: {
        correlation_id: "corr-campaign-lifecycle",
        contract_version: "v1",
        source_service: "lotus-manage",
        upstream_status: 200,
        data: {
          campaign_id: "campaign-holdings-202605",
          campaign_version: "2026.05",
          events: [
            {
              event_type: "CAMPAIGN_DEFINITION_CREATED",
              occurred_at: "2026-05-14T09:30:00Z",
              actor_id: "pm_sg_1",
              status: "RECORDED",
              reason_code: "source_backed_candidate_set",
            },
          ],
        },
      },
    });

    expect(model.campaignLifecycleRows).toEqual([
      {
        key: "CAMPAIGN_DEFINITION_CREATED:2026-05-14T09:30:00Z",
        eventType: "Campaign Definition Created",
        occurredAt: "14 May 2026, 09:30 UTC",
        actor: "pm_sg_1",
        status: "RECORDED",
        reason: "source_backed_candidate_set",
        waveId: "N/A",
        requestedAsOfDate: "Not reported",
        correlationId: "N/A",
        idempotencyKey: "N/A",
      },
    ]);
  });

  it("enriches campaign rows from manage-owned campaign discovery without calculating membership", () => {
    const model = buildDpmWaveCommandCenterModel({
      waveList: waveListResponse,
      campaignDefinitions: {
        correlation_id: "corr-campaign-definitions",
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
              candidates: [{ portfolio_id: "PB_SG_GLOBAL_BAL_001" }],
            },
          ],
        },
      },
      campaignDiscovery: {
        correlation_id: "corr-campaign-discovery",
        contract_version: "v1",
        source_service: "lotus-manage",
        upstream_status: 200,
        data: {
          items: [
            {
              product_name: "BulkReviewCampaignDiscovery",
              product_version: "v1",
              campaign_id: "campaign-holdings-202605",
              campaign_version: "2026.05",
              campaign_status: "ACTIVE",
              candidate_count: 12,
              eligible_candidate_count: 10,
              governance_status: "APPROVED",
              expiry_state: "ACTIVE",
              access_purpose: "rebalance_review",
              source_ref_count: 4,
              supportability_state: "READY",
              applied_filters: {
                as_of_date: "2026-05-10",
                eligible_portfolio_types: ["DISCRETIONARY"],
              },
              operating_boundaries: ["NO_ORDER_GENERATION", "NO_OMS_EXECUTION_CLAIM"],
            },
          ],
        },
      },
    });

    expect(model.campaignRows[0]).toMatchObject({
      campaignId: "campaign-holdings-202605",
      candidateCount: "12",
      eligibleCandidateCount: "10",
      governanceState: "APPROVED",
      expiryState: "ACTIVE",
      accessPurpose: "rebalance_review",
      sourcePosture: "Source-backed",
      candidateSourceProduct: "BulkReviewCampaignDiscovery:v1",
      candidateSelectionBasis: "N/A",
      candidateSourceReadiness: "READY",
      candidateFilters: "As Of Date: 2026-05-10; Eligible Portfolio Types: DISCRETIONARY",
      candidateWarnings: "N/A",
      lineageRefCount: "4",
      nextAction: "Review launch readiness and any source-owned blockers.",
      operatingBoundaries: "NO_ORDER_GENERATION, NO_OMS_EXECUTION_CLAIM, NO_CLIENT_CONTACT_WORKFLOW",
    });
  });

  it("uses source-backed candidate lineage as the campaign source product when present", () => {
    const model = buildDpmWaveCommandCenterModel({
      waveList: waveListResponse,
      campaignDefinitions: {
        correlation_id: "corr-campaign-definitions",
        contract_version: "v1",
        source_service: "lotus-manage",
        upstream_status: 200,
        data: {
          items: [
            {
              product_name: "BulkReviewCampaignDefinition",
              product_version: "v1",
              campaign_id: "campaign-core-universe-202605",
              campaign_version: "2026.05",
              display_name: "Core universe campaign",
              status: "ACTIVE",
              as_of_date: "2026-05-03",
              eligible_portfolio_types: ["DISCRETIONARY"],
              candidates: [
                {
                  portfolio_id: "PB_SG_GLOBAL_BAL_001",
                  portfolio_type: "DISCRETIONARY",
                  source_refs: [
                    {
                      source_system: "lotus-core",
                      source_type: "DpmPortfolioUniverseCandidate",
                      source_id: "PB_SG_GLOBAL_BAL_001:2026-05-03",
                      source_version: "v1",
                      supportability_state: "READY",
                      selection_basis: {
                        basis_type: "EFFECTIVE_DISCRETIONARY_MANDATE_BINDING",
                        source_table: "portfolio_mandate_bindings",
                        included_when: [
                          "mandate_type=discretionary",
                          "effective_from<=as_of_date",
                        ],
                        downstream_boundary:
                          "Candidate membership is not relationship householding.",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      campaignDiscovery: {
        correlation_id: "corr-campaign-discovery",
        contract_version: "v1",
        source_service: "lotus-manage",
        upstream_status: 200,
        data: {
          items: [
            {
              product_name: "BulkReviewCampaignDiscovery",
              product_version: "v1",
              campaign_id: "campaign-core-universe-202605",
              campaign_version: "2026.05",
              supportability_state: "READY",
              source_ref_count: 1,
              universe_posture: {
                operating_boundaries: ["NO_ORDER_GENERATION", "NO_SOURCE_FACT_RECALCULATION"],
              },
            },
          ],
        },
      },
    });

    expect(model.campaignRows[0].candidateSourceProduct).toBe("DpmPortfolioUniverseCandidate:v1");
    expect(model.campaignRows[0].candidateSelectionBasis).toBe(
      "Effective Discretionary Mandate Binding; Source: portfolio_mandate_bindings; Predicates: mandate_type=discretionary, effective_from<=as_of_date"
    );
    expect(model.campaignRows[0].operatingBoundaries).toBe(
      "NO_ORDER_GENERATION, NO_SOURCE_FACT_RECALCULATION, NO_OMS_EXECUTION_CLAIM, NO_CLIENT_CONTACT_WORKFLOW"
    );
  });

  it("normalizes candidate lineage source product versions without using Manage wrapper refs", () => {
    const model = buildDpmWaveCommandCenterModel({
      waveList: waveListResponse,
      campaignDefinitions: {
        correlation_id: "corr-campaign-definitions",
        contract_version: "v1",
        source_service: "lotus-manage",
        upstream_status: 200,
        data: {
          items: [
            {
              product_name: "BulkReviewCampaignDefinition",
              product_version: "v1",
              campaign_id: "campaign-core-universe-202605",
              campaign_version: "2026.05",
              display_name: "Core universe campaign",
              status: "ACTIVE",
              as_of_date: "2026-05-03",
              candidates: [
                {
                  portfolio_id: "PB_SG_GLOBAL_BAL_001",
                  source_refs: [
                    {
                      source_system: "lotus-manage",
                      source_type: "BulkReviewCampaignDefinition",
                      source_version: "v1",
                    },
                    {
                      source_system: "lotus-core",
                      source_type: "DpmPortfolioUniverseCandidate:v1",
                      source_version: "v1",
                      source_id: "PB_SG_GLOBAL_BAL_001:2026-05-03",
                      supportability_state: "READY",
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      campaignDiscovery: {
        correlation_id: "corr-campaign-discovery",
        contract_version: "v1",
        source_service: "lotus-manage",
        upstream_status: 200,
        data: {
          items: [
            {
              product_name: "BulkReviewCampaignDiscovery",
              product_version: "v1",
              campaign_id: "campaign-core-universe-202605",
              campaign_version: "2026.05",
              supportability_state: "READY",
              source_ref_count: 2,
            },
          ],
        },
      },
    });

    expect(model.campaignRows[0].candidateSourceProduct).toBe("DpmPortfolioUniverseCandidate:v1");
  });

  it("preserves Manage-owned campaign preview readiness without deriving readiness", () => {
    const model = buildDpmWaveCommandCenterModel({
      waveList: waveListResponse,
      campaignPreviewReadiness: {
        correlation_id: "corr-campaign-preview-readiness",
        contract_version: "v1",
        source_service: "lotus-manage",
        upstream_status: 200,
        data: {
          product_name: "BulkReviewCampaignDefinitionPreviewReadiness",
          supportability_state: "BLOCKED",
          requested_as_of_date: "2026-05-10",
          actor_id: "pm_sg_1",
          reason_codes: ["campaign_definition_actor_not_entitled"],
          blocked_actions: ["preview_wave", "create_wave"],
          source_refs: [{ source_type: "BulkReviewCampaignDefinition", source_id: "campaign-plan" }],
          operating_boundaries: ["NO_ORDER_GENERATION", "NO_OMS_EXECUTION_CLAIM"],
        },
      },
    });

    expect(model.campaignPreviewReadinessPosture).toEqual({
      state: "BLOCKED",
      reason: "campaign_definition_actor_not_entitled",
      requestedAsOfDate: "10 May 2026",
      actor: "pm_sg_1",
      blockedActions: ["preview_wave", "create_wave"],
      operatingBoundaries: ["NO_ORDER_GENERATION", "NO_OMS_EXECUTION_CLAIM"],
      sourcePosture: "1 source reference",
    });
    expect(model.campaignLaunchPosture.canLaunch).toBe(false);
  });

  it("uses manage-owned launch package readiness without deriving launch state", () => {
    const model = buildDpmWaveCommandCenterModel({
      waveList: waveListResponse,
      campaignLaunchPackage: {
        correlation_id: "corr-campaign-launch-package",
        contract_version: "v1",
        source_service: "lotus-manage",
        upstream_status: 200,
        data: {
          product_name: "BulkReviewCampaignDefinitionLaunchPackage",
          launch_state: "READY",
          requested_as_of_date: "2026-05-10",
          actor_id: "pm_sg_1",
          reason_codes: [],
          create_headers: {
            "Idempotency-Key": "campaign-launch:campaign-holdings-202605:2026.05:abc",
          },
        },
      },
      campaignLaunchResponse: {
        ...waveListResponse,
        upstream_status: 201,
        data: {
          wave: {
            wave_id: "dwv_campaign_launch_001",
            state: "CREATED",
            trigger_type: "BULK_REVIEW_CAMPAIGN",
          },
        },
      },
    });

    expect(model.campaignLaunchPosture).toEqual({
      state: "READY",
      canLaunch: true,
      reason: "Ready",
      requestedAsOfDate: "10 May 2026",
      actor: "pm_sg_1",
      launchedWaveId: "dwv_campaign_launch_001",
      idempotencyEvidence: "campaign-launch:campaign-holdings-202605:2026.05:abc",
    });
  });

  it("preserves Manage-owned campaign workflow audit evidence without deriving task state", () => {
    const model = buildDpmWaveCommandCenterModel({
      waveList: waveListResponse,
      campaignOperatingQueue: {
        correlation_id: "corr-operating-queue",
        contract_version: "v1",
        source_service: "lotus-manage",
        upstream_status: 200,
        supportability: {
          source_service: "lotus-manage",
          authority: "lotus-manage:campaign-workflow",
          state: "READY",
          reason_codes: ["MANAGE_SOURCE_BACKED"],
          blocked_actions: [],
          count: 1,
          total_count: 1,
          content_hash: "sha256:queue",
        },
        data: {
          items: [
            {
              task_ref: "task_001",
              source_refs: [{ source_type: "BulkReviewCampaignAssignmentTask" }],
            },
          ],
          count: 1,
          total_count: 1,
          limit: 10,
          offset: 0,
          operating_boundaries: ["NO_ORDER_GENERATION", "NO_OMS_EXECUTION_CLAIM"],
        },
      },
      campaignAssignmentTasks: {
        correlation_id: "corr-assignment-tasks",
        contract_version: "v1",
        source_service: "lotus-manage",
        upstream_status: 200,
        data: {
          items: [
            {
              task_ref: "task_001",
              status: "WAITING_FOR_REVIEW",
              actor_id: "pm_sg_1",
              recorded_at: "2026-05-21T08:00:00Z",
              reason_codes: ["TASK_RECORDED"],
              source_refs: [{ source_type: "BulkReviewCampaignAssignmentTask" }],
              content_hash: "sha256:task",
              operating_boundaries: ["NO_CLIENT_CONTACT_WORKFLOW", "NO_EXTERNAL_WORKFLOW_ORCHESTRATION"],
              transitions: [
                {
                  transition_type: "ASSIGNED_FOR_REVIEW",
                  from_status: "OPEN",
                  to_status: "WAITING_FOR_REVIEW",
                },
              ],
              raw_rationale: "Do not render raw rationale",
              reviewer_notes: "Do not render reviewer notes",
              oms_order_id: "Do not render OMS claims",
            },
          ],
        },
      },
    });

    expect(model.campaignWorkflowSummaryRows[0]).toMatchObject({
      surface: "Operating Queue",
      state: "READY",
      itemCount: "1",
      sourceRefs: "1",
      contentHash: "sha256:queue",
      operatingBoundaries: "NO_ORDER_GENERATION, NO_OMS_EXECUTION_CLAIM",
    });
    expect(model.campaignWorkflowEvidenceRows[0]).toMatchObject({
      evidenceType: "Assignment Task",
      evidenceRef: "task_001",
      status: "WAITING_FOR_REVIEW",
      actor: "pm_sg_1",
      recordedAt: "21 May 2026, 08:00 UTC",
      reasonCodes: "TASK_RECORDED",
      sourceRefs: "1",
      contentHash: "sha256:task",
      transitionPosture: "ASSIGNED_FOR_REVIEW: OPEN to WAITING_FOR_REVIEW",
    });
    const renderedRows = JSON.stringify(model.campaignWorkflowEvidenceRows);
    expect(renderedRows).not.toContain("raw rationale");
    expect(renderedRows).not.toContain("reviewer notes");
    expect(renderedRows).not.toContain("OMS");
  });

  it("fails DPM audit timestamps closed when source zone evidence is missing or malformed", () => {
    const model = buildDpmWaveCommandCenterModel({
      waveList: waveListResponse,
      campaignLifecycleEvents: {
        correlation_id: "corr-campaign-lifecycle",
        contract_version: "v1",
        source_service: "lotus-manage",
        upstream_status: 200,
        data: {
          events: [
            {
              event_id: "event-unzoned",
              event_type: "CAMPAIGN_DEFINITION_CREATED",
              occurred_at: "2026-05-14T09:30:00",
            },
          ],
        },
      },
      campaignAssignmentTasks: {
        correlation_id: "corr-assignment-tasks",
        contract_version: "v1",
        source_service: "lotus-manage",
        upstream_status: 200,
        data: {
          items: [
            {
              task_ref: "task-invalid-time",
              recorded_at: "not-a-timestamp",
            },
          ],
        },
      },
    });

    expect(model.campaignLifecycleRows[0]?.occurredAt).toBe("Not reported");
    expect(model.campaignWorkflowEvidenceRows[0]?.recordedAt).toBe("Not reported");
  });

  it("preserves launched lifecycle events and append-only launch history", () => {
    const model = buildDpmWaveCommandCenterModel({
      waveList: waveListResponse,
      campaignLifecycleEvents: {
        correlation_id: "corr-campaign-lifecycle",
        contract_version: "v1",
        source_service: "lotus-manage",
        upstream_status: 200,
        data: {
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
      },
      campaignLaunchHistory: {
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
          total_count: 2,
          operating_boundaries: ["NO_ORDER_GENERATION", "NO_OMS_EXECUTION_CLAIM"],
        },
      },
    });

    expect(model.campaignLifecycleRows[0]).toMatchObject({
      eventType: "Launched",
      waveId: "dwv_campaign_launch_001",
      requestedAsOfDate: "10 May 2026",
      correlationId: "corr-campaign-launch",
      idempotencyKey: "campaign-launch:campaign-holdings-202605:2026.05:abc",
    });
    expect(model.campaignLaunchHistoryRows[0]).toEqual({
      key: "dwv_campaign_launch_001:2026-05-10T00:00:00Z:2026-05-10:campaign-launch:campaign-holdings-202605:2026.05:abc",
      waveId: "dwv_campaign_launch_001",
      actor: "pm_sg_1",
      launchedAt: "10 May 2026, 00:00 UTC",
      requestedAsOfDate: "10 May 2026",
      correlationId: "corr-campaign-launch",
      idempotencyKey: "campaign-launch:campaign-holdings-202605:2026.05:abc",
    });
    expect(model.campaignLaunchHistoryPage).toMatchObject({
      productName: "BulkReviewCampaignDefinitionLaunchHistory",
      campaignId: "campaign-holdings-202605",
      campaignVersion: "2026.05",
      count: 1,
      totalCount: 2,
      limit: 10,
      offset: 0,
      operatingBoundaries: ["NO_ORDER_GENERATION", "NO_OMS_EXECUTION_CLAIM"],
      hasNextPage: true,
      hasPreviousPage: false,
    });
  });

  it("does not infer readiness from a present wave when manage supportability is blocked", () => {
    const model = buildDpmWaveCommandCenterModel({
      waveList: {
        ...waveListResponse,
        supportability: {
          ...waveListResponse.supportability,
          state: "blocked",
          reason_codes: ["wave_blocked_items"],
          blocked_actions: ["simulate", "approve"],
          issue_count: 2,
        },
      },
    });

    expect(model.state).toBe("blocked");
    expect(model.supportabilityState).toBe("BLOCKED");
    expect(model.blockedActions).toEqual(["simulate", "approve"]);
    expect(model.selectedWaveIssueCount).toBe("2");
  });
});
