import { createServer, type Server, type ServerResponse } from "node:http";

import { fallbackNormalizedCapabilities } from "../../src/features/platform-capabilities/api";
import { buildDpmAiWorkflowResponse } from "../fixtures/dpm-ai-workflow-fixtures";

export type ManageFixtureGateway = {
  close: () => Promise<void>;
  getLastLoadedProofPackId: () => string | null;
  getLastProofPackMemoId: () => string | null;
  getRequestPaths: () => string[];
  port: number;
  resetRequestPaths: () => void;
  setMandateHealthExceptionMode: (
    mode: "windows" | "empty" | "unavailable" | "delayed-next",
  ) => void;
  setMandateHealthPortfolioScope: (
    portfolioId: "PB_SG_GLOBAL_BAL_001" | "PB_SG_INCOME_001",
  ) => void;
};

const portfolioId = "PB_SG_GLOBAL_BAL_001";
const mandateId = "MANDATE_PB_SG_GLOBAL_BAL_001";
const secondaryPortfolioId = "PB_SG_INCOME_001";
const secondaryMandateId = "MANDATE_PB_SG_INCOME_001";
const waveId = "dwv_001";
const campaignId = "campaign-holdings-202605";
export const manageProofPackFixtureIds = {
  initial: "proof-pack-server-001",
  published: "proof-pack-published-002",
} as const;

export async function startManageFixtureGateway({
  port,
}: {
  port: number;
}): Promise<ManageFixtureGateway> {
  let mandateHealthExceptionMode:
    | "windows"
    | "empty"
    | "unavailable"
    | "delayed-next" = "windows";
  let activeMandateHealthPortfolioId = portfolioId;
  let lastLoadedProofPackId: string | null = null;
  let lastProofPackMemoId: string | null = null;
  let requestPaths: string[] = [];
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    const path = requestUrl.pathname;
    requestPaths.push(path);

    if (path === "/api/v1/platform/capabilities") {
      sendJson(response, {
        data: {
          consumerSystem: requestUrl.searchParams.get("consumerSystem") ?? "UI",
          tenantId: requestUrl.searchParams.get("tenantId") ?? "default",
          contractVersion: "v1",
          sources: {},
          partialFailure: false,
          errors: [],
          normalized: fallbackNormalizedCapabilities(),
        },
      });
      return;
    }
    const portfolio360Match = path.match(/^\/api\/v1\/workbench\/([^/]+)\/portfolio-360$/);
    if (portfolio360Match) {
      const requestedPortfolioId = portfolio360Match[1];
      if (![portfolioId, secondaryPortfolioId].includes(requestedPortfolioId)) {
        sendJson(response, { code: "fixture_portfolio_not_found" }, 404);
        return;
      }
      sendJson(response, portfolio360(requestedPortfolioId));
      return;
    }
    const mandateByPortfolioMatch = path.match(
      /^\/api\/v1\/dpm\/command-center\/mandates\/by-portfolio\/([^/]+)$/,
    );
    if (mandateByPortfolioMatch) {
      const requestedPortfolioId = mandateByPortfolioMatch[1];
      sendJson(
        response,
        requestedPortfolioId === secondaryPortfolioId
          ? mandateEnvelope(secondaryPortfolioId, secondaryMandateId)
          : mandateEnvelope(),
      );
      return;
    }
    if (
      path === `/api/v1/dpm/command-center/mandates/${mandateId}/health` ||
      path === `/api/v1/dpm/command-center/mandates/${secondaryMandateId}/health`
    ) {
      sendJson(
        response,
        commandEnvelope({ dimensions: [] }, "corr-manage-health"),
      );
      return;
    }
    if (["pm-quality", "mode-loading"].includes(process.env.MANAGE_E2E_FIXTURE ?? "")) {
      const pmQualityResponse = pmQualityFixtureResponse(path);
      if (pmQualityResponse) {
        sendJson(response, pmQualityResponse);
        return;
      }
    }
    if (path === "/api/v1/dpm/command-center/waves") {
      sendJson(response, waveEnvelope());
      return;
    }
    if (path === `/api/v1/dpm/command-center/waves/${waveId}/items`) {
      sendJson(response, waveItemsEnvelope());
      return;
    }
    if (
      path === `/api/v1/dpm/command-center/portfolios/${portfolioId}/memory`
    ) {
      sendJson(response, portfolioMemoryEnvelope());
      return;
    }
    if (path === "/api/v1/dpm/command-center/portfolio-memory/search") {
      sendJson(response, portfolioMemorySearchEnvelope());
      return;
    }
    if (
      path === "/api/v1/dpm/command-center/outcome-reviews" &&
      ["outcome-reviews", "proof-copilot", "mode-loading"].includes(
        process.env.MANAGE_E2E_FIXTURE ?? "",
      )
    ) {
      sendJson(
        response,
        outcomeReviewEnvelope(
          ["proof-copilot", "mode-loading"].includes(
            process.env.MANAGE_E2E_FIXTURE ?? "",
          )
            ? manageProofPackFixtureIds.initial
            : undefined,
        ),
      );
      return;
    }
    const outcomeReviewNarrativeMatch = path.match(
      /^\/api\/v1\/dpm\/command-center\/outcome-reviews\/([^/]+)\/ai-narrative$/,
    );
    if (
      process.env.MANAGE_E2E_FIXTURE === "outcome-reviews" &&
      outcomeReviewNarrativeMatch &&
      request.method === "POST"
    ) {
      const requestedOutcomeReviewId = decodeURIComponent(
        outcomeReviewNarrativeMatch[1],
      );
      if (requestedOutcomeReviewId !== "outcome-review-2026-05-13") {
        sendJson(response, { code: "fixture_outcome_review_not_found" }, 404);
        return;
      }
      sendJson(
        response,
        buildDpmAiWorkflowResponse("outcome-narrative", {
          sourceReference: requestedOutcomeReviewId,
        }),
      );
      return;
    }
    if (
      ["proof-copilot", "mode-loading"].includes(
        process.env.MANAGE_E2E_FIXTURE ?? "",
      ) &&
      path === "/api/v1/dpm/command-center/proof-packs" &&
      request.method === "POST"
    ) {
      sendJson(response, proofPackEnvelope(manageProofPackFixtureIds.published), 201);
      return;
    }
    const proofPackMemoMatch = path.match(
      /^\/api\/v1\/dpm\/command-center\/proof-packs\/([^/]+)\/ai-pm-memo$/,
    );
    if (
      process.env.MANAGE_E2E_FIXTURE === "proof-copilot" &&
      proofPackMemoMatch &&
      request.method === "POST"
    ) {
      lastProofPackMemoId = decodeURIComponent(proofPackMemoMatch[1]);
      if (lastProofPackMemoId !== manageProofPackFixtureIds.published) {
        sendJson(response, { code: "fixture_stale_proof_pack_rejected" }, 409);
        return;
      }
      sendJson(
        response,
        buildDpmAiWorkflowResponse("proof-pack-memo", {
          sourceReference: lastProofPackMemoId,
        }),
      );
      return;
    }
    const proofPackMatch = path.match(
      /^\/api\/v1\/dpm\/command-center\/proof-packs\/([^/]+)$/,
    );
    if (
      ["proof-copilot", "mode-loading"].includes(
        process.env.MANAGE_E2E_FIXTURE ?? "",
      ) &&
      proofPackMatch &&
      request.method === "GET"
    ) {
      const requestedProofPackId = decodeURIComponent(proofPackMatch[1]);
      if (
        requestedProofPackId !== manageProofPackFixtureIds.initial &&
        requestedProofPackId !== manageProofPackFixtureIds.published
      ) {
        sendJson(response, { code: "fixture_proof_pack_not_found" }, 404);
        return;
      }
      lastLoadedProofPackId = requestedProofPackId;
      sendJson(response, proofPackEnvelope(requestedProofPackId));
      return;
    }
    const launchedWaveItemsMatch = path.match(
      /^\/api\/v1\/dpm\/command-center\/waves\/(dwv_campaign_[^/]+)\/items$/,
    );
    if (launchedWaveItemsMatch) {
      const launchedWaveId = launchedWaveItemsMatch[1];
      sendJson(response, {
        ...waveEnvelope(),
        supportability: {
          ...waveEnvelope().supportability,
          wave_id: launchedWaveId,
          wave_state: "CREATED",
          item_count: 0,
        },
        data: { items: [] },
      });
      return;
    }
    if (path === "/api/v1/dpm/command-center") {
      const activeMandateId =
        activeMandateHealthPortfolioId === secondaryPortfolioId
          ? secondaryMandateId
          : mandateId;
      sendJson(
        response,
        commandEnvelope(
          {
            mandate_id: activeMandateId,
            mandate_health_state: "READY",
            data_completeness_state: "READY",
            latest_monitoring_run_status: "COMPLETE",
          },
          "corr-manage-command-center",
        ),
      );
      return;
    }
    if (path === "/api/v1/dpm/command-center/exceptions") {
      if (
        process.env.MANAGE_E2E_FIXTURE === "mandate-health" ||
        process.env.MANAGE_E2E_FIXTURE === "overview"
      ) {
        const cursor = requestUrl.searchParams.get("cursor");
        const requestedPortfolioId = requestUrl.searchParams.get("portfolio_id");
        if (requestedPortfolioId === secondaryPortfolioId) {
          sendJson(response, secondaryMandateExceptionWindow());
          return;
        }
        if (mandateHealthExceptionMode === "unavailable") {
          sendJson(response, { code: "fixture_exception_source_unavailable" }, 503);
          return;
        }
        if (mandateHealthExceptionMode === "empty") {
          sendJson(response, mandateExceptionEmptyWindow());
          return;
        }
        if (
          mandateHealthExceptionMode === "delayed-next" &&
          cursor === "mandate-attention-window-2"
        ) {
          setTimeout(() => {
            if (!response.destroyed) {
              sendJson(response, mandateExceptionWindowTwo());
            }
          }, 750);
          return;
        }
        sendJson(
          response,
          cursor === "mandate-attention-window-2"
            ? mandateExceptionWindowTwo()
            : mandateExceptionWindowOne(),
        );
        return;
      }
      sendJson(
        response,
        commandEnvelope(
          { items: [], next_cursor: null },
          "corr-manage-exceptions",
        ),
      );
      return;
    }
    if (path === "/api/v1/dpm/command-center/waves/campaign-definitions") {
      sendJson(response, campaignEnvelope("corr-manage-campaigns"));
      return;
    }
    if (path === "/api/v1/dpm/command-center/waves/campaign-discovery") {
      sendJson(response, campaignEnvelope("corr-manage-campaign-discovery"));
      return;
    }
    const campaignMatch = path.match(
      /^\/api\/v1\/dpm\/command-center\/waves\/campaign-definitions\/([^/]+)\/versions\/([^/]+)\/(.+)$/,
    );
    if (campaignMatch) {
      const [, requestedCampaignId, campaignVersion, surface] = campaignMatch;
      if (requestedCampaignId !== campaignId) {
        sendJson(response, { code: "fixture_campaign_not_found" }, 404);
        return;
      }
      if (surface === "lifecycle-events") {
        sendJson(response, campaignLifecycleEnvelope(campaignVersion));
        return;
      }
      if (surface === "launch-history") {
        sendJson(response, campaignLaunchHistoryEnvelope(campaignVersion));
        return;
      }
      if (surface === "preview-readiness") {
        sendJson(response, campaignPreviewReadinessEnvelope(campaignVersion));
        return;
      }
      if (surface === "launch-package") {
        sendJson(response, campaignLaunchPackageEnvelope(campaignVersion));
        return;
      }
      if (
        [
          "approval-decisions",
          "assignment-actions",
          "assignment-tasks",
          "maker-checker-controls",
        ].includes(surface)
      ) {
        sendJson(response, campaignWorkflowEvidenceEnvelope(campaignVersion, surface));
        return;
      }
      if (surface === "launch" && request.method === "POST") {
        sendJson(response, campaignLaunchEnvelope(campaignVersion), 201);
        return;
      }
    }
    if (path.startsWith("/api/v1/dpm/command-center")) {
      sendJson(
        response,
        { code: "fixture_optional_surface_unavailable", path },
        503,
      );
      return;
    }

    sendJson(response, { code: "fixture_route_not_found", path }, 404);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  return {
    port,
    close: () => closeServer(server),
    getLastLoadedProofPackId: () => lastLoadedProofPackId,
    getLastProofPackMemoId: () => lastProofPackMemoId,
    getRequestPaths: () => [...requestPaths],
    resetRequestPaths: () => {
      requestPaths = [];
    },
    setMandateHealthExceptionMode: (mode) => {
      mandateHealthExceptionMode = mode;
    },
    setMandateHealthPortfolioScope: (requestedPortfolioId) => {
      activeMandateHealthPortfolioId = requestedPortfolioId;
    },
  };
}

function mandateExceptionWindowOne() {
  return commandEnvelope(
    {
      items: [
        {
          exception_id: "mandate-exception-benchmark",
          mandate_id: mandateId,
          monitoring_run_id: "manage-monitoring-2026-05-03",
          source_run_id: "performance-run-2026-05-03",
          correlation_id: "corr-manage-exceptions-window-1-item",
          authority: "lotus-manage:monitoring-exception",
          severity: "HIGH",
          title: "Benchmark mapping requires review",
          source_system: "lotus-performance",
          owner: "Portfolio Management",
          age_hours: 3,
          state: "ACTIVE",
          next_action: "Confirm the benchmark assignment before the next review",
        },
        {
          exception_id: "mandate-exception-price",
          mandate_id: mandateId,
          monitoring_run_id: "manage-monitoring-2026-05-03",
          source_run_id: "valuation-run-2026-05-03",
          correlation_id: "corr-manage-exceptions-window-1-price",
          authority: "lotus-manage:monitoring-exception",
          severity: "MEDIUM",
          title: "Fixed income price requires confirmation",
          source_system: "lotus-core",
          owner: "Investment Operations",
          age_hours: 6,
          state: "ACTIVE",
          next_action: "Confirm the latest validated price",
        },
      ],
      // Overview owns one bounded, complete attention receipt. A continuation
      // cursor is deliberately not fixture-valid here because it must not advance
      // the browser's Checked receipt.
      next_cursor: null,
    },
    "corr-manage-exceptions-window-1",
  );
}

function mandateExceptionWindowTwo() {
  return commandEnvelope(
    {
      items: [
        {
          exception_id: "mandate-exception-concentration",
          mandate_id: mandateId,
          monitoring_run_id: "manage-monitoring-2026-05-03",
          source_run_id: "risk-run-2026-05-03",
          correlation_id: "corr-manage-exceptions-window-2-item",
          authority: "lotus-manage:monitoring-exception",
          severity: "HIGH",
          title: "Concentration threshold requires review",
          source_system: "lotus-risk",
          owner: "Portfolio Management",
          age_hours: 1,
          state: "ACTIVE",
          next_action: "Review concentration exposure and agree the response",
        },
      ],
      next_cursor: null,
    },
    "corr-manage-exceptions-window-2",
  );
}

function mandateExceptionEmptyWindow() {
  return commandEnvelope(
    { items: [], next_cursor: null },
    "corr-manage-exceptions-empty",
  );
}

function secondaryMandateExceptionWindow() {
  return commandEnvelope(
    {
      items: [
        {
          exception_id: "secondary-mandate-exception-income",
          mandate_id: secondaryMandateId,
          monitoring_run_id: "manage-monitoring-income-2026-05-03",
          source_run_id: "income-run-2026-05-03",
          correlation_id: "corr-manage-exceptions-secondary-item",
          authority: "lotus-manage:monitoring-exception",
          severity: "MEDIUM",
          title: "Income distribution threshold requires review",
          source_system: "lotus-manage",
          owner: "Portfolio Management",
          age_hours: 2,
          state: "ACTIVE",
          next_action: "Review the distribution threshold",
        },
      ],
      next_cursor: null,
    },
    "corr-manage-exceptions-secondary",
  );
}

function portfolio360(requestedPortfolioId = portfolioId) {
  return {
    correlation_id: "corr-manage-portfolio",
    contract_version: "v1",
    as_of_date: "2026-05-03",
    portfolio: {
      portfolio_id: requestedPortfolioId,
      client_id:
        requestedPortfolioId === secondaryPortfolioId
          ? "CLIENT_SG_INCOME_001"
          : "CLIENT_SG_001",
      base_currency: "SGD",
      booking_center_code: "SG",
    },
    overview: {
      market_value_base: 12_500_000,
      cash_weight_pct: 6,
      position_count: 18,
    },
    performance_snapshot: null,
    rebalance_snapshot:
      process.env.MANAGE_E2E_FIXTURE === "proof-copilot"
        ? {
            status: "READY",
            last_rebalance_run_id: "rebalance-run-2026-05-03",
            last_run_at_utc: "2026-05-03T09:00:00Z",
            recent_runs: [
              {
                rebalance_run_id: "rebalance-run-2026-05-03",
                status: "READY",
                created_at_utc: "2026-05-03T09:00:00Z",
                error_code: null,
                workflow_state: "REVIEW_READY",
              },
            ],
          }
        : null,
    current_positions: [],
    projected_positions: [],
    projected_summary: null,
    active_session_id: null,
    warnings: [],
    partial_failures: [],
  };
}

function mandateEnvelope(
  requestedPortfolioId = portfolioId,
  requestedMandateId = mandateId,
) {
  return commandEnvelope(
    {
      mandate: {
        mandate_id: requestedMandateId,
        portfolio_id: requestedPortfolioId,
        mandate_type:
          requestedPortfolioId === secondaryPortfolioId
            ? "DPM_INCOME"
            : "DPM_GLOBAL_BALANCED",
        base_currency: "SGD",
        risk_profile: "BALANCED",
        as_of_date: "2026-05-03",
      },
    },
    "corr-manage-mandate",
  );
}

function commandEnvelope(data: Record<string, unknown>, correlationId: string) {
  return {
    correlation_id: correlationId,
    contract_version: "v1",
    source_service: "lotus-manage",
    upstream_status: 200,
    supportability: {
      source_service: "lotus-manage",
      authority: "lotus-manage:RFC-0038",
      state: "SUPPORTED",
      data_completeness_state: "READY",
      partial_readiness_reasons: [],
      source_run_id: "manage-run-001",
      remediation_owner: null,
    },
    data,
  };
}

function waveEnvelope() {
  return {
    correlation_id: "corr-manage-wave",
    contract_version: "v1",
    source_service: "lotus-manage",
    upstream_status: 200,
    supportability: {
      source_service: "lotus-manage",
      authority: "lotus-manage:RFC-0041",
      state: "READY",
      reason_codes: [],
      blocked_actions: [],
      wave_id: waveId,
      wave_state: "SIMULATION_READY",
      item_count: 2,
      issue_count: 0,
      remediation_owner: "Portfolio Operations",
    },
    data: {
      items: [
        {
          wave_id: waveId,
          portfolio_ids: [portfolioId],
          state: "SIMULATION_READY",
          trigger_type: "EXPLICIT_PORTFOLIO_LIST",
          as_of_date: "2026-05-03",
          item_count: 2,
          issue_count: 0,
          supportability_state: "READY",
          supportability_reason: "WAVE_SUPPORTABILITY_READY",
          aggregate_metrics: {
            turnover_pct: "4.8%",
            cash_after_pct: "2.1%",
            drift_improvement_pct: "72.4%",
            issue_count: 0,
          },
        },
      ],
    },
  };
}

function waveItemsEnvelope() {
  return {
    ...waveEnvelope(),
    correlation_id: "corr-manage-wave-items",
    data: {
      items: [
        {
          wave_item_id: "dwi_001",
          portfolio_id: portfolioId,
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
}

function portfolioMemoryEnvelope() {
  return {
    ...commandEnvelope(
      {
      portfolio_id: portfolioId,
      events: [
        {
          event_id: "memory:outcome-review:or_1",
          event_type: "OUTCOME_REVIEW_CREATED",
          event_time: "2026-05-07T10:05:00Z",
          title: "Post-rebalance outcome review is ready.",
          supportability_state: "READY",
          source_refs: [
            { source_system: "lotus-manage", source_id: "or_1" },
          ],
          artifact_refs: [
            { artifact_type: "outcome_review", artifact_id: "or_1" },
          ],
          reason_codes: ["OUTCOME_REVIEW_READY"],
        },
        {
          event_id: "memory:mandate-health:mh_1",
          event_type: "MANDATE_HEALTH_SNAPSHOT",
          event_time: "2026-05-06T09:15:00Z",
          title: "Daily mandate readiness check completed.",
          supportability_state: "READY",
          source_refs: [
            { source_system: "lotus-manage", source_id: "mh_1" },
          ],
          artifact_refs: [],
          reason_codes: ["MANDATE_HEALTH_READY"],
        },
      ],
      },
      "corr-manage-portfolio-memory",
    ),
    supportability: {
      source_service: "lotus-manage",
      authority: "lotus-manage:portfolio-memory",
      state: "READY",
      event_count: 2,
      event_type_counts: {
        OUTCOME_REVIEW_CREATED: 1,
        MANDATE_HEALTH_SNAPSHOT: 1,
      },
      source_systems: ["lotus-manage"],
      source_system_counts: { "lotus-manage": 2 },
      source_type_counts: {
        "PortfolioOutcomeReview:v1": 1,
        "MandateHealthSnapshot:v1": 1,
      },
      reason_codes: ["MEMORY_READY"],
      blocked_actions: [],
    },
  };
}

function portfolioMemorySearchEnvelope() {
  return {
    ...commandEnvelope(
      {
        support_boundary: {
          manage_persisted_lineage_only: true,
          source_owner_store_query: false,
        },
        items: [],
      },
      "corr-manage-portfolio-memory-search",
    ),
    supportability: {
      source_service: "lotus-manage",
      authority: "lotus-manage:portfolio-memory",
      state: "READY",
      event_count: 2,
      event_type_counts: {
        OUTCOME_REVIEW_CREATED: 1,
        MANDATE_HEALTH_SNAPSHOT: 1,
      },
      source_systems: ["lotus-manage", "lotus-performance"],
      source_system_counts: {
        "lotus-manage": 1,
        "lotus-performance": 1,
      },
      source_type_counts: {
        "PortfolioOutcomeReview:v1": 1,
        "MandateHealthSnapshot:v1": 1,
      },
      reason_codes: ["PERSISTED_LINEAGE_SEARCH_ONLY"],
    },
  };
}

function outcomeReviewEnvelope(proofPackId = "proof-pack-2026-05-13") {
  return {
    correlation_id: "corr-manage-outcome-reviews",
    contract_version: "v1",
    source_service: "lotus-manage",
    upstream_status: 200,
    supportability: {
      source_service: "lotus-manage",
      authority: "lotus-manage:RFC-0042",
      state: "READY",
      reason_codes: ["READY_FOR_REPORT_INPUT"],
      blocked_actions: [],
      remediation_owner: "Portfolio Management",
      applied_filters: { portfolio_id: portfolioId },
      source_owner_counts: {
        "lotus-manage": 1,
        "lotus-performance": 1,
      },
      source_type_counts: {
        outcome_review: 1,
        performance_result: 1,
      },
      support_boundary: {
        result_scope: "selected_portfolio",
        review_order: "source_ranked",
      },
    },
    data: {
      items: [
        {
          outcome_review_id: "outcome-review-2026-05-13",
          state: "READY",
          overall_outcome: "READY_WITHIN_TOLERANCE",
          portfolio_id: portfolioId,
          rebalance_run_id: "rebalance-run-2026-05-03",
          wave_id: waveId,
          proof_pack_id: proofPackId,
          expected_snapshot: {
            source_hashes: {
              expected: "sha256:expected-review-snapshot",
            },
          },
          realized_snapshot: {
            source_hashes: {
              realized: "sha256:realised-review-snapshot",
            },
          },
          retain_until: "2033-05-13",
          created_at: "2026-05-13T09:35:00Z",
          updated_at: "2026-05-13T10:05:00Z",
          review_window: {
            start: "2026-05-01",
            end: "2026-05-13",
          },
          variance_summary: { drift_improvement_pct: 72.4 },
          supportability: {
            explanation:
              "Outcome comparison is ready for portfolio-manager review; client communication remains outside this screen.",
          },
          dimension_results: [
            {
              dimension: "ALLOCATION_DRIFT",
              expected: { value: 4.2, unit: "%" },
              realized: { value: 1.2, unit: "%" },
              variance: { value: -3.0, unit: "percentage points" },
              state: "WITHIN_TOLERANCE",
              explanation:
                "Realised allocation drift improved from 4.2% to 1.2% against the review expectation.",
            },
            {
              dimension: "CASH_WEIGHT",
              expected: { value: 3.0, unit: "%" },
              realized: { value: 3.2, unit: "%" },
              variance: { value: 0.2, unit: "percentage points" },
              state: "WITHIN_TOLERANCE",
              explanation:
                "Realised cash weight remains within the expected review tolerance.",
            },
          ],
          source_lineage: [
            {
              source_service: "lotus-manage",
              source_type: "outcome_review",
              source_ref: "manage-outcome-review-2026-05-13",
              freshness_bucket: "current",
              content_hash: "sha256:manage-outcome-review",
            },
            {
              source_service: "lotus-performance",
              source_type: "performance_result",
              source_ref: "performance-result-2026-05-13",
              freshness_bucket: "current",
              content_hash: "sha256:performance-result",
            },
          ],
          client_communication_boundary: {
            boundary_id: "DPM_OUTCOME_CLIENT_COMMUNICATION_BOUNDARY",
            supportability_state: "BLOCKED",
            source_system: "lotus-manage",
            source_product_name: "DpmPostTradeOutcomeReview",
            source_product_version: "v1",
            client_communication_projected: false,
            client_approval_projected: false,
            reason_code: "OUTCOME_CLIENT_COMMUNICATION_NOT_SUPPORTED",
            blocked_capabilities: [
              "client_approval",
              "client_contact",
              "client_message_generation",
              "delivery_confirmation",
            ],
            required_owner: "Client Communications",
            required_source_product: "ClientCommunicationRecord:v1",
            summary:
              "Client communication and approval remain in the owning client-communication workflow.",
            content_hash: "sha256:client-communication-boundary",
          },
        },
      ],
    },
  };
}

function proofPackEnvelope(proofPackId: string) {
  return {
    correlation_id: `corr-${proofPackId}`,
    contract_version: "v1",
    source_service: "lotus-manage",
    upstream_status: 200,
    supportability: {
      source_service: "lotus-manage",
      authority: "lotus-manage:RFC-0040",
      state: "READY",
      proof_pack_id: proofPackId,
      reason_codes: ["PROOF_PACK_READY"],
      markdown_available: true,
      report_input_available: true,
      ai_evidence_input_available: true,
    },
    data: {
      proof_pack: {
        proof_pack_id: proofPackId,
        portfolio_id: portfolioId,
        mandate_id: mandateId,
        rebalance_run_id: "rebalance-run-2026-05-03",
        as_of_date: "2026-05-13",
        sections: [
          {
            section: "mandate_alignment",
            state: "READY",
            finding: "Mandate evidence is ready for portfolio-manager review.",
          },
        ],
      },
    },
  };
}

function campaignEnvelope(correlationId: string) {
  return {
    correlation_id: correlationId,
    contract_version: "v1",
    source_service: "lotus-manage",
    upstream_status: 200,
    data: {
      items: [
        campaignDefinition("2026.05", "Asia growth holdings review", "2026-05-10", 12),
        campaignDefinition("2026.06", "Singapore balanced mandate refresh", "2026-06-10", 7),
      ],
      limit: 10,
      offset: 0,
      count: 2,
    },
  };
}

function pmQualityFixtureResponse(path: string): Record<string, unknown> | null {
  const base = (data: Record<string, unknown>, correlationId: string, count: number) => ({
    correlation_id: correlationId,
    contract_version: "v1",
    source_service: "lotus-manage",
    upstream_status: 200,
    supportability: {
      source_service: "lotus-manage",
      authority: "lotus-manage:RFC-0042/PM_OPERATING_QUALITY",
      state: "READY",
      reason_codes: ["PM_QUALITY_READY"],
      blocked_actions: [],
      policy_id: "pmq_sg_dpm",
      policy_version: "2026.05",
      count,
    },
    data,
  });

  if (path === "/api/v1/dpm/command-center/pm-operating-quality/policies") {
    return base(
      {
        policies: [
          {
            policy_id: "pmq_sg_dpm",
            policy_version: "2026.05",
            enabled: true,
            state: "READY",
            as_of_date: "2026-05-13",
          },
        ],
      },
      "corr-pmq-policies-fixture",
      1,
    );
  }
  if (path === "/api/v1/dpm/command-center/pm-operating-quality/score-runs") {
    const scoreRuns = getPmQualityFixtureScoreRuns();
    return base(
      {
        score_runs: scoreRuns,
        fairness_segments: [
          {
            segment_id: "mandate_balanced",
            segment_type: "MANDATE_TYPE",
            display_name: "Balanced DPM Mandates",
            score_run_ids: ["pmq_run_001"],
            source_refs: scoreRuns[0].source_refs,
          },
          {
            segment_id: "mandate_income",
            segment_type: "MANDATE_TYPE",
            display_name: "Income DPM Mandates",
            score_run_ids: ["pmq_run_002"],
            source_refs: scoreRuns[1].source_refs,
          },
        ],
      },
      "corr-pmq-score-runs-fixture",
      scoreRuns.length,
    );
  }
  if (path === "/api/v1/dpm/command-center/pm-operating-quality/fairness-analyses") {
    return base({ fairness_analyses: [] }, "corr-pmq-fairness-fixture", 0);
  }
  if (path === "/api/v1/dpm/command-center/pm-operating-quality/review-actions") {
    return base({ review_actions: [] }, "corr-pmq-review-actions-fixture", 0);
  }
  if (path === "/api/v1/dpm/command-center/pm-operating-quality/summary-invocations") {
    return base({ summary_invocations: [] }, "corr-pmq-summaries-fixture", 0);
  }
  return null;
}

export function getPmQualityFixtureScoreRuns() {
  return [
    pmQualityScoreRun({
      scoreRunId: "pmq_run_001",
      pmId: "PM_SG_001",
      bookId: "PM_BOOK_SG_BALANCED",
      score: "90.00",
      state: "READY",
      reasonCodes: ["PM_QUALITY_READY"],
    }),
    pmQualityScoreRun({
      scoreRunId: "pmq_run_002",
      pmId: "PM_SG_002",
      bookId: "PM_BOOK_SG_INCOME",
      score: "86.50",
      state: "PENDING_REVIEW",
      reasonCodes: ["PM_QUALITY_PENDING_REVIEW"],
    }),
  ];
}

function pmQualityScoreRun({
  scoreRunId,
  pmId,
  bookId,
  score,
  state,
  reasonCodes,
}: {
  scoreRunId: string;
  pmId: string;
  bookId: string;
  score: string;
  state: string;
  reasonCodes: string[];
}) {
  return {
    score_run_id: scoreRunId,
    pm_id: pmId,
    book_id: bookId,
    policy_id: "pmq_sg_dpm",
    policy_version: "2026.05",
    state,
    score,
    as_of_date: "2026-05-13",
    content_hash: `sha256:${scoreRunId}`,
    reason_codes: reasonCodes,
    forbidden_uses: ["protected_class_inference", "autonomous_pm_ranking"],
    source_refs: [
      {
        source_system: "lotus-manage",
        source_product: "PmOperatingQualityScoreRun",
        source_id: scoreRunId,
      },
    ],
  };
}

function campaignDefinition(
  campaignVersion: string,
  displayName: string,
  asOfDate: string,
  candidateCount: number,
) {
  return {
    product_name: "BulkReviewCampaignDiscovery",
    campaign_id: campaignId,
    campaign_version: campaignVersion,
    display_name: displayName,
    status: "ACTIVE",
    campaign_status: "ACTIVE",
    as_of_date: asOfDate,
    eligible_portfolio_types: ["DISCRETIONARY"],
    candidate_count: candidateCount,
    eligible_candidate_count: candidateCount - 1,
    governance_status: "APPROVED",
    expiry_state: "ACTIVE",
    access_purpose: "rebalance_review",
    source_ref_count: 2,
    candidates: [
      {
        portfolio_id: portfolioId,
        portfolio_type: "DISCRETIONARY",
        source_refs: [
          { source_type: "PortfolioManagerBookMembership", source_id: "book-sg-1" },
        ],
      },
    ],
    governance: {
      approval_ref: `BRC-APPROVAL-${campaignVersion}`,
      approved_by: "investment_control_sg",
    },
    source_refs: [
      { source_type: "BulkReviewCampaignDefinition", source_id: `${campaignId}:${campaignVersion}` },
    ],
  };
}

function campaignLifecycleEnvelope(campaignVersion: string) {
  return commandEnvelope(
    {
      campaign_id: campaignId,
      campaign_version: campaignVersion,
      events: [
        {
          event_type: "ACTIVATED",
          occurred_at: "2026-05-14T09:30:00Z",
          actor_id: "portfolio_manager_sg",
          status: "RECORDED",
          reason_code: "campaign_definition_activated",
          correlation_id: `corr-campaign-${campaignVersion}`,
        },
      ],
    },
    `corr-campaign-lifecycle-${campaignVersion}`,
  );
}

function campaignLaunchHistoryEnvelope(campaignVersion: string) {
  return commandEnvelope(
    {
      product_name: "BulkReviewCampaignDefinitionLaunchHistory",
      campaign_id: campaignId,
      campaign_version: campaignVersion,
      items: [],
      limit: 10,
      offset: 0,
      count: 0,
      total_count: 0,
      operating_boundaries: ["NO_ORDER_GENERATION", "NO_OMS_EXECUTION_CLAIM"],
    },
    `corr-campaign-launch-history-${campaignVersion}`,
  );
}

function campaignPreviewReadinessEnvelope(campaignVersion: string) {
  return commandEnvelope(
    {
      product_name: "BulkReviewCampaignDefinitionPreviewReadiness",
      campaign_id: campaignId,
      campaign_version: campaignVersion,
      requested_as_of_date: campaignVersion === "2026.06" ? "2026-06-10" : "2026-05-10",
      actor_id: "portfolio_manager_sg",
      supportability_state: "READY",
      reason_codes: [],
      blocked_actions: [],
      operating_boundaries: ["NO_ORDER_GENERATION", "NO_OMS_EXECUTION_CLAIM"],
    },
    `corr-campaign-preview-${campaignVersion}`,
  );
}

function campaignLaunchPackageEnvelope(campaignVersion: string) {
  return commandEnvelope(
    {
      product_name: "BulkReviewCampaignDefinitionLaunchPackage",
      campaign_id: campaignId,
      campaign_version: campaignVersion,
      requested_as_of_date: campaignVersion === "2026.06" ? "2026-06-10" : "2026-05-10",
      actor_id: "portfolio_manager_sg",
      launch_state: "READY",
      reason_codes: [],
      create_headers: {
        "Idempotency-Key": `campaign-launch:${campaignId}:${campaignVersion}:fixture`,
      },
    },
    `corr-campaign-launch-package-${campaignVersion}`,
  );
}

function campaignWorkflowEvidenceEnvelope(campaignVersion: string, surface: string) {
  return commandEnvelope(
    {
      items: [
        {
          campaign_id: campaignId,
          campaign_version: campaignVersion,
          evidence_ref: `${surface}:${campaignVersion}`,
          status: "SUPPORTABLE",
          content_hash: `sha256:${surface}:${campaignVersion}`,
          reason_codes: [],
        },
      ],
      count: 1,
      total_count: 1,
      limit: 10,
      offset: 0,
    },
    `corr-campaign-${surface}-${campaignVersion}`,
  );
}

function campaignLaunchEnvelope(campaignVersion: string) {
  return {
    ...waveEnvelope(),
    correlation_id: `corr-campaign-launch-${campaignVersion}`,
    upstream_status: 201,
    supportability: {
      ...waveEnvelope().supportability,
      wave_id: `dwv_campaign_${campaignVersion.replace(".", "_")}`,
      wave_state: "CREATED",
    },
    data: {
      wave: {
        wave_id: `dwv_campaign_${campaignVersion.replace(".", "_")}`,
        state: "CREATED",
        trigger_type: "BULK_REVIEW_CAMPAIGN",
      },
      durable: true,
    },
  };
}

function sendJson(response: ServerResponse, payload: unknown, status = 200) {
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
