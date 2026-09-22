import { createServer, type Server, type ServerResponse } from "node:http";

import type { AdvisorBookResponse } from "../../src/features/advisor-book/contracts";
import { fallbackNormalizedCapabilities } from "../../src/features/platform-capabilities/api";
import {
  buildReportBatchHandle,
  buildReportBatchStatus,
  buildReportJobListResponse,
  buildReportOrderingResponse,
} from "../fixtures/report-ordering-fixtures";

const RECOVERY_PORTFOLIO_ID = "PB_REPORT_RECOVERY_001";

export const REPORT_CENTRE_FIXTURE_PORTFOLIOS = {
  ready: "PB_REPORT_READY_001",
  recovery: RECOVERY_PORTFOLIO_ID,
  restricted: "PB_REPORT_RESTRICTED_001",
  empty: "PB_REPORT_EMPTY_001",
  unknownLifecycle: "PB_REPORT_UNKNOWN_LIFECYCLE_001",
  refreshFailure: "PB_REPORT_REFRESH_FAILURE_001",
} as const;

export type ReportCentreFixtureGateway = {
  close: () => Promise<void>;
  port: number;
};

export async function startReportCentreFixtureGateway({
  port,
}: {
  port: number;
}): Promise<ReportCentreFixtureGateway> {
  let recoveryAttempts = 0;
  let acceptedRequestCount = 0;
  let refreshHistoryAttempts = 0;
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);

    if (requestUrl.pathname === "/api/v1/portfolio/portfolios") {
      sendJson(response, {
        items: Object.values(REPORT_CENTRE_FIXTURE_PORTFOLIOS).map((portfolioId) => ({
          portfolio_id: portfolioId,
          display_name: fixturePortfolioLabel(portfolioId),
          base_currency: "SGD",
          client_id: `CLIENT_${portfolioId}`,
          booking_center_code: "SG",
          portfolio_type: "ADVISORY",
          status: "ACTIVE",
        })),
      });
      return;
    }

    if (requestUrl.pathname === "/api/v1/platform/capabilities") {
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

    if (requestUrl.pathname === "/api/v1/advisor-book/portfolios") {
      sendJson(response, buildAdvisorBookResponse(requestUrl));
      return;
    }

    const workspacePortfolioId = resolveWorkspacePortfolioId(requestUrl.pathname);
    if (workspacePortfolioId) {
      sendJson(response, buildWorkspaceResponse(workspacePortfolioId));
      return;
    }

    if (requestUrl.pathname === "/api/v1/report-ordering/options") {
      const portfolioId = requestUrl.searchParams.get("scopeId") ?? "";
      if (portfolioId === REPORT_CENTRE_FIXTURE_PORTFOLIOS.restricted) {
        sendJson(response, { code: "reporting_scope_not_entitled" }, 403);
        return;
      }
      if (portfolioId === RECOVERY_PORTFOLIO_ID && recoveryAttempts++ === 0) {
        sendJson(response, { code: "report_catalogue_temporarily_unavailable" }, 503);
        return;
      }

      const catalogue = buildReportOrderingResponse();
      for (const section of catalogue.reportFamilies[0].sections) {
        if (section.sectionId !== "ADVISOR_COMMENTARY") {
          (section as Record<string, unknown>).availability = null;
        }
      }
      sendJson(response, {
        ...catalogue,
        scopeSelection: { scopeType: "portfolio", scopeId: portfolioId },
        reportFamilies:
          portfolioId === REPORT_CENTRE_FIXTURE_PORTFOLIOS.empty
            ? []
            : catalogue.reportFamilies,
      });
      return;
    }

    if (requestUrl.pathname === "/api/v1/report-jobs") {
      const portfolioId = requestUrl.searchParams.get("portfolioId") ?? "";
      if (
        portfolioId === REPORT_CENTRE_FIXTURE_PORTFOLIOS.refreshFailure &&
        refreshHistoryAttempts++ > 0
      ) {
        sendJson(response, { code: "report_history_temporarily_unavailable" }, 503);
        return;
      }
      const history = buildReportJobListResponse();
      sendJson(response, {
        ...history,
        appliedFilters: { ...history.appliedFilters, portfolioId },
        items: history.items.map((item) => {
          if (portfolioId === REPORT_CENTRE_FIXTURE_PORTFOLIOS.unknownLifecycle) {
            return { ...item, status: "future_lifecycle", currentStep: "future_step" };
          }
          if (portfolioId === REPORT_CENTRE_FIXTURE_PORTFOLIOS.refreshFailure) {
            return { ...item, status: "queued", currentStep: "queued" };
          }
          return item;
        }),
      });
      return;
    }

    if (
      requestUrl.pathname === "/api/v1/reports/portfolio-reviews" &&
      request.method === "POST"
    ) {
      const idempotencyKey = request.headers["idempotency-key"];
      if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
        sendJson(response, { detail: "A reviewed idempotency key is required." }, 400);
        return;
      }
      acceptedRequestCount += 1;
      const requestReference = `e2e_${acceptedRequestCount}`;
      sendJson(
        response,
        {
          report_request_id: `rrq_${requestReference}`,
          report_job_id: `rjob_${requestReference}`,
          status: "accepted",
          status_url: `/api/v1/report-jobs/rjob_${requestReference}`,
          idempotency_key: idempotencyKey,
        },
        202,
      );
      return;
    }

    if (requestUrl.pathname === "/api/v1/report-batches" && request.method === "POST") {
      const idempotencyKey = request.headers["idempotency-key"];
      if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
        sendJson(response, { detail: "A reviewed idempotency key is required." }, 400);
        return;
      }
      sendJson(
        response,
        { ...buildReportBatchHandle(), idempotency_key: idempotencyKey },
        202,
      );
      return;
    }

    if (requestUrl.pathname === "/api/v1/report-batches/rbch_1" && request.method === "GET") {
      const status = buildReportBatchStatus();
      const portfolioIds = [
        REPORT_CENTRE_FIXTURE_PORTFOLIOS.ready,
        REPORT_CENTRE_FIXTURE_PORTFOLIOS.recovery,
      ];
      sendJson(response, {
        ...status,
        materialized_portfolio_ids: portfolioIds,
        items: status.items.map((item, index) => ({
          ...item,
          portfolio_id: portfolioIds[index],
        })),
      });
      return;
    }

    sendJson(response, { code: "fixture_route_not_found" }, 404);
  });

  await listen(server, port);
  return {
    port,
    close: () => close(server),
  };
}

function resolveWorkspacePortfolioId(pathname: string): string | null {
  const match = pathname.match(/^\/api\/v1\/portfolio\/portfolios\/([^/]+)\/workspace$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function fixturePortfolioLabel(portfolioId: string): string {
  const suffix = portfolioId.replace("PB_REPORT_", "").replace("_001", "").toLowerCase();
  return `Report Centre ${suffix} mandate`;
}

function buildAdvisorBookResponse(requestUrl: URL): AdvisorBookResponse {
  const asOfDate = requestUrl.searchParams.get("asOfDate") ?? "2026-04-10";
  const items = Object.values(REPORT_CENTRE_FIXTURE_PORTFOLIOS).map((portfolioId) => ({
    portfolio_id: portfolioId,
    display_name: fixturePortfolioLabel(portfolioId),
    client_id: `CLIENT_${portfolioId}`,
    base_currency: "SGD",
    booking_center_code: "SG",
    mandate_type: "ADVISORY",
    status: "ACTIVE",
    opened_on: "2024-01-01",
    closed_on: null,
    membership_source: "PortfolioManagerBookMembership:v1" as const,
    membership_reference: `MEMBERSHIP_${portfolioId}`,
    membership_basis: "governed_role_assignment" as const,
  }));

  return {
    correlation_id: "corr_report_centre_advisor_book",
    contract_version: "v1",
    scope: {
      kind: "own_book",
      label: "My book",
      as_of_date: asOfDate,
      booking_center_code: "SG",
    },
    page: {
      total_count: items.length,
      offset: 0,
      limit: 100,
      returned_count: items.length,
      sort_by: "client_id",
      sort_order: "asc",
    },
    items,
    supportability: {
      state: "ready",
      reason_code: "advisor_book_ready",
      tenant_scope: "source_confirmed",
      limitations: [],
    },
    provenance: {
      product_name: "PortfolioManagerBookMembership",
      product_version: "v1",
      generated_at: `${asOfDate}T12:00:00Z`,
      latest_evidence_timestamp: `${asOfDate}T11:55:00Z`,
      freshness_status: "current",
      data_quality_status: "complete",
      source_evidence_current: true,
      snapshot_id: `snapshot_${asOfDate}`,
      content_hash: `sha256:advisor-book-${asOfDate}`,
      lineage: { source: "report-centre-state-matrix-fixture" },
    },
  };
}

function buildWorkspaceResponse(portfolioId: string) {
  return {
    as_of_date: "2026-04-22",
    portfolio: {
      portfolio_id: portfolioId,
      display_name: fixturePortfolioLabel(portfolioId),
      client_id: `CLIENT_${portfolioId}`,
      base_currency: "SGD",
      booking_center_code: "SG",
    },
    profile: {
      status: "ACTIVE",
      portfolio_type: "ADVISORY",
      risk_exposure: "MODERATE",
      investment_time_horizon: "LONG_TERM",
      objective: "GROWTH",
      is_leverage_allowed: false,
      open_date: "2024-01-01",
    },
    summary: {
      assets_under_management_base: 12_500_000,
      invested_market_value_base: 11_500_000,
      cash_market_value_base: 1_000_000,
      cash_weight_pct: 8,
      position_count: 18,
      cash_balance_count: 2,
    },
    reporting: { status: "READY", generated_at_utc: null, row_count: 18 },
    cashflow_outlook: null,
    performance: null,
    rebalance: null,
    control_capabilities: {
      historical_snapshots: {
        state: "supported",
        reason: "Historical report dates are source-confirmed.",
        requested_as_of_date: "2026-04-22",
        effective_as_of_date: "2026-04-22",
        earliest_available_as_of_date: "2026-04-01",
        latest_available_as_of_date: "2026-04-22",
        module_capabilities: [],
      },
      reporting_currency_restatement: {
        state: "supported",
        reason: "Reporting currencies are source-confirmed.",
        requested_reporting_currency: "SGD",
        effective_reporting_currency: "SGD",
        supported_currencies: ["SGD", "USD"],
        module_capabilities: [],
      },
    },
    workflow_cues: [],
    warnings: [],
    partial_failures: [],
  };
}

function sendJson(response: ServerResponse, body: unknown, status = 200) {
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
