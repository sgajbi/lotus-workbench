import { buildAnalyticsUiCorrelationHeaders } from "@/features/analytics-observability/correlation";
import {
  BFF_PROXY_BASE,
  buildServerGatewayHeaders,
  buildWorkbenchUrl,
  fetchWorkbenchJson,
  fetchWorkbenchMutation,
  fetchWorkbenchResource,
  observeWorkbenchMutation,
  observeWorkbenchResource,
  type WorkbenchRequestTarget
} from "@/features/workbench/api-client";
import type {
  CompositePerformanceGatewayResponse,
  CompositePerformanceInspectionRequest,
  CompositePerformanceTwrRequest,
  WorkbenchAdvisorBriefWorkflowPackRunReviewActionRequest,
  WorkbenchPerformanceAdvisorBrief,
  WorkbenchPerformanceAttributionTrend,
  WorkbenchPerformanceHorizonComparison,
  WorkbenchPerformanceWorkspaceDetails,
  WorkbenchPerformanceWorkspaceSummary
} from "@/features/workbench/types";

function buildPerformanceWorkspaceQuery(params: {
  period: string;
  chartFrequency: string;
  contributionDimension: string;
  attributionDimension: string;
  detailBasis: string;
  benchmark?: string;
  reportStartDate?: string;
  reportEndDate?: string;
  asOfDate?: string;
  reportingCurrency?: string;
}): string {
  const query = new URLSearchParams();
  query.set("period", params.period);
  query.set("chart_frequency", params.chartFrequency);
  query.set("contribution_dimension", params.contributionDimension);
  query.set("attribution_dimension", params.attributionDimension);
  query.set("detail_basis", params.detailBasis);
  if (params.benchmark) {
    query.set("benchmark_code", params.benchmark);
  }
  if (params.reportStartDate) {
    query.set("report_start_date", params.reportStartDate);
  }
  if (params.reportEndDate) {
    query.set("report_end_date", params.reportEndDate);
  }
  if (params.asOfDate) {
    query.set("as_of_date", params.asOfDate);
  }
  if (params.reportingCurrency) {
    query.set("reporting_currency", params.reportingCurrency);
  }
  return query.toString();
}

function buildPerformanceWorkspaceUrl(
  portfolioId: string,
  params: {
    period: string;
    chartFrequency: string;
    contributionDimension: string;
    attributionDimension: string;
    detailBasis: string;
    benchmark?: string;
    reportStartDate?: string;
    reportEndDate?: string;
    asOfDate?: string;
    reportingCurrency?: string;
  },
  pathSuffix: string,
  target: WorkbenchRequestTarget
): string {
  const query = buildPerformanceWorkspaceQuery(params);
  return buildWorkbenchUrl(target, `/workbench/${portfolioId}/performance${pathSuffix}`, query);
}

export async function getWorkbenchPerformanceWorkspaceSummary(
  portfolioId: string,
  params: {
    period: string;
    chartFrequency: string;
    contributionDimension: string;
    attributionDimension: string;
    detailBasis: string;
    benchmark?: string;
    reportStartDate?: string;
    reportEndDate?: string;
    asOfDate?: string;
    reportingCurrency?: string;
  }
): Promise<WorkbenchPerformanceWorkspaceSummary> {
  return await observeWorkbenchResource(
    "performance.workspace.summary",
    async () =>
      await fetchWorkbenchJson<WorkbenchPerformanceWorkspaceSummary>(
        buildPerformanceWorkspaceUrl(portfolioId, params, "/summary", "server"),
        "performance workspace summary",
        { headers: buildServerGatewayHeaders() }
      )
  );
}

export async function getWorkbenchPerformanceWorkspaceDetails(
  portfolioId: string,
  params: {
    period: string;
    chartFrequency: string;
    contributionDimension: string;
    attributionDimension: string;
    detailBasis: string;
    benchmark?: string;
    reportStartDate?: string;
    reportEndDate?: string;
    asOfDate?: string;
    reportingCurrency?: string;
  }
): Promise<WorkbenchPerformanceWorkspaceDetails> {
  return await fetchWorkbenchJson<WorkbenchPerformanceWorkspaceDetails>(
    buildPerformanceWorkspaceUrl(portfolioId, params, "/details", "server"),
    "performance workspace details",
    { headers: buildServerGatewayHeaders() }
  );
}

export async function getWorkbenchPerformanceWorkspaceSummaryClient(
  portfolioId: string,
  params: {
    period: string;
    chartFrequency: string;
    contributionDimension: string;
    attributionDimension: string;
    detailBasis: string;
    benchmark?: string;
    reportStartDate?: string;
    reportEndDate?: string;
    asOfDate?: string;
    reportingCurrency?: string;
  },
  signal?: AbortSignal,
): Promise<WorkbenchPerformanceWorkspaceSummary> {
  return await observeWorkbenchResource(
    "performance.workspace.summary",
    async () =>
      await fetchWorkbenchJson<WorkbenchPerformanceWorkspaceSummary>(
        buildPerformanceWorkspaceUrl(portfolioId, params, "/summary", "client"),
        "performance workspace summary",
        { headers: buildAnalyticsUiCorrelationHeaders(), signal }
      )
  );
}

export async function getWorkbenchPerformanceWorkspaceDetailsClient(
  portfolioId: string,
  params: {
    period: string;
    chartFrequency: string;
    contributionDimension: string;
    attributionDimension: string;
    detailBasis: string;
    benchmark?: string;
    reportStartDate?: string;
    reportEndDate?: string;
    asOfDate?: string;
    reportingCurrency?: string;
  },
  signal?: AbortSignal,
): Promise<WorkbenchPerformanceWorkspaceDetails> {
  return await observeWorkbenchResource(
    "performance.workspace.details",
    async () =>
      await fetchWorkbenchJson<WorkbenchPerformanceWorkspaceDetails>(
        buildPerformanceWorkspaceUrl(portfolioId, params, "/details", "client"),
        "performance workspace details",
        { headers: buildAnalyticsUiCorrelationHeaders(), signal }
      )
  );
}

export async function getWorkbenchPerformanceHorizonComparisonClient(
  portfolioId: string,
  params: {
    period?: string;
    detailBasis: string;
    benchmark?: string;
    chartFrequency?: string;
    reportStartDate?: string;
    reportEndDate?: string;
    asOfDate?: string;
    reportingCurrency?: string;
  }
): Promise<WorkbenchPerformanceHorizonComparison> {
  const query = new URLSearchParams();
  if (params.period) {
    query.set("period", params.period);
  }
  query.set("detail_basis", params.detailBasis);
  query.set("chart_frequency", params.chartFrequency ?? "monthly");
  if (params.benchmark) {
    query.set("benchmark_code", params.benchmark);
  }
  if (params.reportStartDate) {
    query.set("report_start_date", params.reportStartDate);
  }
  if (params.reportEndDate) {
    query.set("report_end_date", params.reportEndDate);
  }
  if (params.asOfDate) {
    query.set("as_of_date", params.asOfDate);
  }
  if (params.reportingCurrency) {
    query.set("reporting_currency", params.reportingCurrency);
  }
  return await observeWorkbenchResource(
    "performance.workspace.horizon-comparison",
    async () =>
      await fetchWorkbenchResource<WorkbenchPerformanceHorizonComparison>(
        "client",
        `/workbench/${portfolioId}/performance/horizon-comparison`,
        "performance horizon comparison",
        query
      )
  );
}

export async function getWorkbenchPerformanceAttributionTrendClient(
  portfolioId: string,
  params: {
    period: string;
    chartFrequency: string;
    attributionDimension: string;
    detailBasis: string;
    benchmark?: string;
    reportStartDate?: string;
    reportEndDate?: string;
    asOfDate?: string;
    reportingCurrency?: string;
  }
): Promise<WorkbenchPerformanceAttributionTrend> {
  const query = new URLSearchParams();
  query.set("period", params.period);
  query.set("chart_frequency", params.chartFrequency);
  query.set("attribution_dimension", params.attributionDimension);
  query.set("detail_basis", params.detailBasis);
  if (params.benchmark) {
    query.set("benchmark_code", params.benchmark);
  }
  if (params.reportStartDate) {
    query.set("report_start_date", params.reportStartDate);
  }
  if (params.reportEndDate) {
    query.set("report_end_date", params.reportEndDate);
  }
  if (params.asOfDate) {
    query.set("as_of_date", params.asOfDate);
  }
  if (params.reportingCurrency) {
    query.set("reporting_currency", params.reportingCurrency);
  }
  return await observeWorkbenchResource(
    "performance.workspace.attribution-trend",
    async () =>
      await fetchWorkbenchResource<WorkbenchPerformanceAttributionTrend>(
        "client",
        `/workbench/${portfolioId}/performance/attribution-trend`,
        "performance attribution trend",
        query
      )
  );
}

export async function calculateCompositePerformanceTwrClient(
  payload: CompositePerformanceTwrRequest
): Promise<CompositePerformanceGatewayResponse> {
  return await observeWorkbenchMutation(
    "performance.composites.twr",
    async () =>
      await fetchWorkbenchMutation<CompositePerformanceGatewayResponse>(
        `${BFF_PROXY_BASE}/performance/composites/twr`,
        "composite performance TWR",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      )
  );
}

export async function inspectCompositePerformanceClient(
  payload: CompositePerformanceInspectionRequest
): Promise<CompositePerformanceGatewayResponse> {
  return await observeWorkbenchMutation(
    "performance.composites.inspect",
    async () =>
      await fetchWorkbenchMutation<CompositePerformanceGatewayResponse>(
        `${BFF_PROXY_BASE}/performance/composites/inspect`,
        "composite performance inspection",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      )
  );
}

export async function getWorkbenchPerformanceAdvisorBriefClient(
  portfolioId: string,
  params: {
    period: string;
    chartFrequency: string;
    contributionDimension: string;
    attributionDimension: string;
    detailBasis: string;
    benchmark?: string;
    reportStartDate?: string;
    reportEndDate?: string;
    asOfDate?: string;
    reportingCurrency?: string;
  }
): Promise<WorkbenchPerformanceAdvisorBrief> {
  return await observeWorkbenchResource(
    "performance.workspace.advisor-brief",
    async () =>
      await fetchWorkbenchResource<WorkbenchPerformanceAdvisorBrief>(
        "client",
        `/workbench/${portfolioId}/performance/advisor-brief`,
        "performance advisor brief",
        buildPerformanceWorkspaceQuery(params)
      )
  );
}

export async function postWorkbenchPerformanceAdvisorBriefReviewActionClient(
  portfolioId: string,
  params: {
    period: string;
    chartFrequency: string;
    contributionDimension: string;
    attributionDimension: string;
    detailBasis: string;
    benchmark?: string;
    reportStartDate?: string;
    reportEndDate?: string;
    asOfDate?: string;
    reportingCurrency?: string;
  },
  payload: WorkbenchAdvisorBriefWorkflowPackRunReviewActionRequest
): Promise<WorkbenchPerformanceAdvisorBrief> {
  return await observeWorkbenchMutation(
    "performance.workspace.advisor-brief.review-action",
    async () =>
      await fetchWorkbenchMutation<WorkbenchPerformanceAdvisorBrief>(
        buildWorkbenchUrl(
          "client",
          `/workbench/${portfolioId}/performance/advisor-brief/review-actions`,
          buildPerformanceWorkspaceQuery(params)
        ),
        "performance advisor brief review action",
        {
          method: "POST",
          headers: buildAnalyticsUiCorrelationHeaders({
            "Content-Type": "application/json"
          }),
          body: JSON.stringify(payload)
        }
      )
  );
}
