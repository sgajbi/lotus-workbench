import type {
  PortfolioCatalogResponse,
  PortfolioProjectedCashflowResponse,
  PortfolioRecordDataAvailability,
  PortfolioSupportingEvidenceFailure,
  PortfolioWorkspace,
} from "./types";
import { parsePortfolioAllocationResponse, type PortfolioAllocationResponse } from "./portfolio-allocation-contract";
import type { PortfolioTimeWindow } from "./view-model";
import {
  parsePortfolioTransactionRecord,
  PortfolioTransactionRecordError,
  type PortfolioTransactionRecordFailure,
  type PortfolioTransactionRecordResponse,
} from "./portfolio-transaction-record";
import {
  buildPortfolioPerformanceWindowQuery,
  isPortfolioPerformanceWindowCurrent,
} from "./portfolio-performance-window";
import {
  resolveGatewayBaseUrl,
  resolveWorkbenchApiBase,
  type ServiceRequestTarget,
} from "@/features/platform-runtime/service-addressing";
import { buildAnalyticsUiCorrelationHeaders } from "@/features/analytics-observability/correlation";
import { buildServerGatewayHeaders } from "@/features/workbench/api-client";
import {
  WORKBENCH_ANALYTICS_UI_OBSERVED_SURFACES,
  observeWorkbenchAnalyticsRequest,
  type WorkbenchAnalyticsUiObservationContext,
} from "@/features/analytics-observability/metrics";

type PortfolioRequestTarget = ServiceRequestTarget;
type ObservedPortfolioOperation = Extract<
  (typeof WORKBENCH_ANALYTICS_UI_OBSERVED_SURFACES)[number]["operation"],
  `portfolio.${string}`
>;

function resolvePortfolioRequestTarget(): PortfolioRequestTarget {
  return typeof window === "undefined" ? "server" : "client";
}

function observedPortfolioSurface(path: string): WorkbenchAnalyticsUiObservationContext {
  const operation = resolvePortfolioOperation(path);
  return WORKBENCH_ANALYTICS_UI_OBSERVED_SURFACES.find(
    (surface) => surface.operation === operation
  )!;
}

function resolvePortfolioOperation(path: string): ObservedPortfolioOperation {
  if (path.endsWith("/workspace")) {
    return "portfolio.workspace.shell";
  }
  if (path.endsWith("/book")) {
    return "portfolio.book";
  }
  if (path.endsWith("/income-summary")) {
    return "portfolio.income-summary";
  }
  if (path.endsWith("/activity-summary")) {
    return "portfolio.activity-summary";
  }
  if (path.endsWith("/performance-snapshot")) {
    return "portfolio.performance-snapshot";
  }
  if (path.endsWith("/liquidity")) {
    return "portfolio.liquidity";
  }
  if (/\/transactions(?:\/[^/]+)?$/.test(path)) {
    return "portfolio.transactions";
  }
  if (path.endsWith("/readiness")) {
    return "portfolio.readiness";
  }
  if (path.endsWith("/insights")) {
    return "portfolio.insights";
  }
  if (path.endsWith("/workflow")) {
    return "portfolio.workflow";
  }
  if (path.endsWith("/allocations")) {
    return "portfolio.allocations";
  }
  if (path.endsWith("/projected-cashflow")) {
    return "portfolio.projected-cashflow";
  }
  return "portfolio.catalog";
}

type PortfolioWorkspaceSummaryResponse = {
  as_of_date: string;
  portfolio: PortfolioWorkspace["portfolio"];
  profile: PortfolioWorkspace["profile"];
  summary: {
    assets_under_management_base: number;
    invested_market_value_base: number;
    cash_market_value_base: number;
    cash_weight_pct: number;
    position_count: number;
    cash_balance_count: number;
  };
  cashflow_outlook: PortfolioWorkspace["cashflow_outlook"];
  performance: PortfolioWorkspace["performance"];
  rebalance: PortfolioWorkspace["rebalance"];
  control_capabilities?: PortfolioWorkspace["control_capabilities"];
  reporting: PortfolioWorkspace["readiness"]["reporting"];
  operations?: Record<string, unknown> | null;
  workflow_cues: PortfolioWorkspace["workflow_cues"];
  warnings: string[];
  partial_failures: PortfolioWorkspace["partial_failures"];
};

export type PortfolioBookResponse = {
  as_of_date: string;
  portfolio: PortfolioWorkspace["portfolio"];
  summary: {
    assets_under_management_base: number;
    invested_market_value_base: number;
    cash_market_value_base: number;
    cash_weight_pct: number;
    position_count: number;
    cash_balance_count: number;
  };
  cash_balances: NonNullable<PortfolioWorkspace["cash_balances"]>;
  allocation_views: NonNullable<PortfolioWorkspace["allocation_views"]>;
  top_positions: PortfolioWorkspace["top_positions"];
  positions: PortfolioWorkspace["positions"];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type PortfolioLiquidityResponse = {
  cash_balances: NonNullable<PortfolioWorkspace["cash_balances"]>;
  cashflow_outlook: PortfolioWorkspace["cashflow_outlook"];
};

type PortfolioTransactionLedgerResponse = {
  total?: number;
  skip?: number;
  limit?: number;
  transactions: PortfolioWorkspace["recent_transactions"];
};

export type PortfolioLookThroughMode = "direct_only" | "prefer_look_through";

type PortfolioIncomeSummaryResponse = NonNullable<PortfolioWorkspace["income_summary"]>;

type PortfolioActivitySummaryResponse = NonNullable<PortfolioWorkspace["activity_summary"]>;

type PortfolioReadinessResponse = {
  indicators: NonNullable<PortfolioWorkspace["readiness_indicators"]>;
  supportability?: PortfolioWorkspace["supportability"];
};

type PortfolioWorkflowResponse = {
  actions: NonNullable<PortfolioWorkspace["workflow_actions"]>;
};

type PortfolioInsightsResponse = {
  insights: NonNullable<PortfolioWorkspace["insights"]>;
  exception_summaries: NonNullable<PortfolioWorkspace["exception_summaries"]>;
};

type PortfolioWorkspaceSummaryDetails = Pick<
  PortfolioWorkspace,
  | "portfolio"
  | "allocations"
  | "allocation_views"
  | "top_positions"
  | "positions"
  | "income_summary"
  | "activity_summary"
  | "performance"
  | "performance_period_returns"
  | "supporting_evidence_failures"
  | "readiness_indicators"
  | "exception_summaries"
  | "insights"
  | "workflow_actions"
> &
  Partial<Pick<PortfolioWorkspace, "as_of_date" | "summary">>;

type PortfolioPerformanceSnapshotResponse = {
  period: string;
  as_of_date: string;
  report_start_date?: string | null;
  report_end_date?: string | null;
  benchmark_code: string | null;
  portfolio_return_pct: number | null;
  benchmark_return_pct: number | null;
  excess_return_pct: number | null;
  sparkline: Array<{
    as_of_date: string;
    portfolio_return_pct: number | null;
    benchmark_return_pct?: number | null;
    excess_return_pct?: number | null;
  }>;
  unavailable?: {
    title: string;
    detail: string;
    requirements: string[];
  } | null;
  warnings?: string[];
  partial_failures?: PortfolioWorkspace["partial_failures"];
};

type PortfolioWorkspaceDetailedDetails = Partial<
  Pick<
    PortfolioWorkspace,
    | "cash_balances"
    | "recent_transactions"
    | "transaction_ledger_page"
    | "cashflow_outlook"
    | "readiness_indicators"
    | "supportability"
    | "exception_summaries"
    | "insights"
    | "workflow_actions"
  >
> & {
  record_data_availability: Pick<
    PortfolioRecordDataAvailability,
    "liquidity" | "transactions"
  >;
};

export async function getPortfolioCatalog(): Promise<PortfolioCatalogResponse["items"]> {
  try {
    const payload = await fetchPortfolioJson<PortfolioCatalogResponse>(
      resolvePortfolioRequestTarget(),
      "/portfolio/portfolios"
    );
    if (!payload) {
      return [];
    }
    return payload.items ?? [];
  } catch {
    return [];
  }
}

export async function getPortfolioWorkspaceShell(
  portfolioId: string,
  options: { signal?: AbortSignal } = {},
): Promise<PortfolioWorkspace | null> {
  try {
    return await fetchPortfolioWorkspaceShell(portfolioId, options);
  } catch {
    return null;
  }
}

export async function getPortfolioBook(
  portfolioId: string,
  params: {
    asOfDate?: string;
    reportingCurrency?: string;
  } = {}
): Promise<PortfolioBookResponse | null> {
  try {
    return await fetchPortfolioBook(portfolioId, params);
  } catch {
    return null;
  }
}

export async function getRequiredPortfolioBook(
  portfolioId: string,
  params: {
    asOfDate?: string;
    reportingCurrency?: string;
  } = {}
): Promise<PortfolioBookResponse> {
  const book = await fetchPortfolioBook(portfolioId, {
    ...params,
  });
  if (!book) {
    throw new Error("Portfolio book evidence is unavailable.");
  }
  return book;
}

async function fetchPortfolioWorkspaceShell(
  portfolioId: string,
  options: { signal?: AbortSignal } = {},
): Promise<PortfolioWorkspace | null> {
  const summaryPayload = await fetchPortfolioJson<PortfolioWorkspaceSummaryResponse>(
    resolvePortfolioRequestTarget(),
    `/portfolio/portfolios/${encodeURIComponent(portfolioId)}/workspace`,
    { signal: options.signal }
  );
  if (!summaryPayload) {
    return null;
  }

  return {
    as_of_date: summaryPayload.as_of_date,
    portfolio: summaryPayload.portfolio,
    profile: summaryPayload.profile,
    summary: {
      market_value_base: summaryPayload.summary.assets_under_management_base,
      invested_market_value_base: summaryPayload.summary.invested_market_value_base,
      total_cash_base: summaryPayload.summary.cash_market_value_base,
      cash_weight_pct: summaryPayload.summary.cash_weight_pct,
      position_count: summaryPayload.summary.position_count,
      cash_balance_count: summaryPayload.summary.cash_balance_count,
    },
    allocations: [],
    allocation_views: [],
    cash_balances: [],
    top_positions: [],
    positions: [],
    recent_transactions: [],
    income_summary: null,
    activity_summary: null,
    cashflow_outlook: summaryPayload.cashflow_outlook,
    performance: summaryPayload.performance,
    rebalance: summaryPayload.rebalance,
    control_capabilities: summaryPayload.control_capabilities ?? null,
    readiness: {
      has_positions: summaryPayload.summary.position_count > 0,
      reporting: summaryPayload.reporting,
    },
    readiness_indicators: undefined,
    supportability: undefined,
    workflow_cues: summaryPayload.workflow_cues,
    workflow_actions: undefined,
    warnings: summaryPayload.warnings,
    partial_failures: summaryPayload.partial_failures,
    operations: summaryPayload.operations ?? null,
  };
}

async function fetchPortfolioBook(
  portfolioId: string,
  params: {
    asOfDate?: string;
    reportingCurrency?: string;
  }
): Promise<PortfolioBookResponse | null> {
  const bookQuery = new URLSearchParams();
  if (params.asOfDate) {
    bookQuery.set("as_of_date", params.asOfDate);
  }
  if (params.reportingCurrency) {
    bookQuery.set("reporting_currency", params.reportingCurrency);
  }
  return await fetchPortfolioJson<PortfolioBookResponse>(
    resolvePortfolioRequestTarget(),
    `/portfolio/portfolios/${encodeURIComponent(portfolioId)}/book`,
    { query: bookQuery }
  );
}

export async function getPortfolioWorkspaceSummaryDetails(
  portfolioId: string,
  params: {
    asOfDate?: string;
    reportingCurrency?: string;
    includeProjected?: boolean;
    timeWindow: PortfolioTimeWindow;
    reportStartDate: string;
    reportEndDate: string;
    usesCustomDateRange?: boolean;
    includeWorkflowActions?: boolean;
  },
  options: { signal?: AbortSignal } = {},
): Promise<PortfolioWorkspaceSummaryDetails | null> {
  try {
    const performanceQuery = buildPortfolioPerformanceWindowQuery(params);
    const bookQuery = buildPortfolioBookQuery(params);
    const summaryQuery = buildPortfolioSummaryWindowQuery(params);
    const workflowQuery = new URLSearchParams();
    if (params.asOfDate) {
      workflowQuery.set("as_of_date", params.asOfDate);
    }
    const performancePeriods = ["MTD", "QTD", "YTD"] as const;
    const performancePeriodQueries = performancePeriods.map((timeWindow) =>
      buildPortfolioPerformanceWindowQuery({
        ...params,
        timeWindow,
        usesCustomDateRange: false,
      })
    );
    const portfolioPath = `/portfolio/portfolios/${encodeURIComponent(portfolioId)}`;
    const performancePath = `${portfolioPath}/performance-snapshot`;
    const standardPerformanceRequests = performancePeriodQueries.map((query) =>
      fetchPortfolioJson<PortfolioPerformanceSnapshotResponse>(
        resolvePortfolioRequestTarget(),
        performancePath,
        { query, signal: options.signal }
      )
    );
    const selectedStandardPeriodIndex = params.usesCustomDateRange
      ? -1
      : performancePeriods.indexOf(params.timeWindow as (typeof performancePeriods)[number]);
    const selectedPerformanceRequest = selectedStandardPeriodIndex >= 0
      ? standardPerformanceRequests[selectedStandardPeriodIndex]
      : fetchPortfolioJson<PortfolioPerformanceSnapshotResponse>(
          resolvePortfolioRequestTarget(),
          performancePath,
          { query: performanceQuery, signal: options.signal }
        );
    const includeWorkflowActions = params.includeWorkflowActions !== false;
    const workflowRequest = includeWorkflowActions
      ? fetchPortfolioJson<PortfolioWorkflowResponse>(
          resolvePortfolioRequestTarget(),
          `${portfolioPath}/workflow`,
          { query: workflowQuery, signal: options.signal }
        )
      : Promise.resolve(null);
    const [summaryResults, workflowResults] = await Promise.all([
      Promise.allSettled([
        fetchPortfolioJson<PortfolioBookResponse>(
          resolvePortfolioRequestTarget(),
          `${portfolioPath}/book`,
          { query: bookQuery, signal: options.signal }
        ),
        fetchPortfolioJson<PortfolioIncomeSummaryResponse>(
          resolvePortfolioRequestTarget(),
          `${portfolioPath}/income-summary`,
          { query: summaryQuery, signal: options.signal }
        ),
        fetchPortfolioJson<PortfolioActivitySummaryResponse>(
          resolvePortfolioRequestTarget(),
          `${portfolioPath}/activity-summary`,
          { query: summaryQuery, signal: options.signal }
        ),
        selectedPerformanceRequest,
        ...standardPerformanceRequests,
      ]),
      Promise.allSettled([workflowRequest]),
    ]);
    const [
      bookResult,
      incomeResult,
      activityResult,
      performanceResult,
      mtdPerformanceResult,
      qtdPerformanceResult,
      ytdPerformanceResult,
    ] = summaryResults;
    const [workflowResult] = workflowResults;

    const bookPayload = settledPortfolioPayload(bookResult);

    if (!bookPayload) {
      return null;
    }
    const incomePayload = settledPortfolioPayload(incomeResult);
    const activityPayload = settledPortfolioPayload(activityResult);
    const rawPerformancePayload = settledPortfolioPayload(performanceResult);
    const rawPeriodPerformancePayloads = [
      settledPortfolioPayload(mtdPerformanceResult),
      settledPortfolioPayload(qtdPerformanceResult),
      settledPortfolioPayload(ytdPerformanceResult),
    ];
    const periodPerformancePayloads = rawPeriodPerformancePayloads.map((payload, index) =>
      payload &&
      isPortfolioPerformanceWindowCurrent(payload, {
        ...params,
        timeWindow: performancePeriods[index],
        usesCustomDateRange: false,
      })
        ? payload
        : null,
    );
    const performancePayload =
      selectedStandardPeriodIndex >= 0
        ? periodPerformancePayloads[selectedStandardPeriodIndex]
        : rawPerformancePayload &&
            isPortfolioPerformanceWindowCurrent(rawPerformancePayload, params)
          ? rawPerformancePayload
          : null;
    const workflowPayload = settledPortfolioPayload(workflowResult);
    const supportingEvidenceFailures = [
      buildSupportingEvidenceFailure(incomePayload, "income_summary"),
      buildSupportingEvidenceFailure(activityPayload, "activity_summary"),
      selectedStandardPeriodIndex < 0
        ? buildSupportingEvidenceFailure(performancePayload, "selected_period_performance")
        : null,
      ...periodPerformancePayloads.map((payload, index) =>
        buildSupportingEvidenceFailure(
          payload,
          "standard_period_performance",
          performancePeriods[index]
        )
      ),
    ].filter((failure): failure is PortfolioSupportingEvidenceFailure => failure !== null);
    const allocationView =
      bookPayload.allocation_views.find((view) => view.dimension === "asset_class") ??
      bookPayload.allocation_views[0];
    const datedSummary = mapPortfolioBookSummary(bookPayload);

    return {
      portfolio: bookPayload.portfolio,
      ...datedSummary,
      allocations: (allocationView?.buckets ?? []).map((bucket) => ({
        asset_class: bucket.bucket,
        position_count: bucket.position_count,
        market_value_base: bucket.market_value_base,
        weight_pct: bucket.weight_pct,
      })),
      allocation_views: bookPayload.allocation_views,
      top_positions: bookPayload.top_positions,
      positions: bookPayload.positions,
      income_summary: incomePayload,
      activity_summary: activityPayload,
      performance: mapPortfolioPerformanceSnapshot(performancePayload),
      performance_period_returns: periodPerformancePayloads.map((payload, index) =>
        mapPortfolioPerformancePeriodReturn(performancePeriods[index], payload)
      ),
      ...(includeWorkflowActions
        ? { workflow_actions: workflowPayload?.actions ?? [] }
        : {}),
      supporting_evidence_failures: supportingEvidenceFailures,
    };
  } catch {
    return null;
  }
}

function mapPortfolioBookSummary(
  payload: PortfolioBookResponse
): Pick<PortfolioWorkspace, "as_of_date" | "summary"> | Record<string, never> {
  // Do not combine dated holdings with undated totals. Older tolerant fixtures and
  // transitional Gateway responses may omit either field; the existing shell
  // summary then remains visibly qualified by its own valuation date.
  if (!payload.as_of_date || !payload.summary) {
    return {};
  }

  return {
    as_of_date: payload.as_of_date,
    summary: {
      market_value_base: payload.summary.assets_under_management_base,
      invested_market_value_base: payload.summary.invested_market_value_base,
      total_cash_base: payload.summary.cash_market_value_base,
      cash_weight_pct: payload.summary.cash_weight_pct,
      position_count: payload.summary.position_count,
      cash_balance_count: payload.summary.cash_balance_count,
    },
  };
}

function buildSupportingEvidenceFailure(
  payload: unknown | null,
  evidenceScope: PortfolioSupportingEvidenceFailure["evidence_scope"],
  period?: "MTD" | "QTD" | "YTD"
): PortfolioSupportingEvidenceFailure | null {
  if (payload !== null) {
    return null;
  }

  if (evidenceScope === "income_summary") {
    return {
      evidence_scope: evidenceScope,
      source_service: "lotus-gateway",
      title: "Income evidence unavailable",
      detail: "Income evidence could not be retrieved through Gateway for this review period.",
    };
  }
  if (evidenceScope === "activity_summary") {
    return {
      evidence_scope: evidenceScope,
      source_service: "lotus-gateway",
      title: "Activity evidence unavailable",
      detail: "Portfolio activity evidence could not be retrieved through Gateway for this review period.",
    };
  }
  if (evidenceScope === "selected_period_performance") {
    return {
      evidence_scope: evidenceScope,
      source_service: "lotus-gateway",
      title: "Selected-period performance unavailable",
      detail: "Performance evidence could not be retrieved through Gateway for the selected review period. No return is shown.",
    };
  }

  return {
    evidence_scope: evidenceScope,
    period,
    source_service: "lotus-gateway",
    title: `${period} performance unavailable`,
    detail: `${period} performance evidence could not be retrieved through Gateway. No return is shown.`,
  };
}

export async function getPortfolioWorkspaceDetailedDetails(
  portfolioId: string,
  params: {
    asOfDate?: string;
    reportingCurrency?: string;
    startDate?: string;
    endDate?: string;
  } = {}
): Promise<PortfolioWorkspaceDetailedDetails | null> {
  try {
    const transactionSearchParams = new URLSearchParams();
    transactionSearchParams.set("limit", "200");
    const sharedSearchParams = new URLSearchParams();
    const liquiditySearchParams = new URLSearchParams();
    if (params.asOfDate) {
      transactionSearchParams.set("as_of_date", params.asOfDate);
      sharedSearchParams.set("as_of_date", params.asOfDate);
      liquiditySearchParams.set("as_of_date", params.asOfDate);
    }
    if (params.reportingCurrency) {
      liquiditySearchParams.set("reporting_currency", params.reportingCurrency);
      transactionSearchParams.set("reporting_currency", params.reportingCurrency);
    }
    if (params.startDate) {
      transactionSearchParams.set("start_date", params.startDate);
    }
    if (params.endDate) {
      transactionSearchParams.set("end_date", params.endDate);
    }
    const [
      liquidityResult,
      transactionsResult,
      readinessResult,
      insightsResult,
      workflowResult,
    ] = await Promise.allSettled([
      fetchPortfolioJson<PortfolioLiquidityResponse>(
        resolvePortfolioRequestTarget(),
        `/portfolio/portfolios/${encodeURIComponent(portfolioId)}/liquidity`,
        { query: liquiditySearchParams }
      ),
      fetchPortfolioJson<PortfolioTransactionLedgerResponse>(
        resolvePortfolioRequestTarget(),
        `/portfolio/portfolios/${encodeURIComponent(portfolioId)}/transactions`,
        { query: transactionSearchParams }
      ),
      fetchPortfolioJson<PortfolioReadinessResponse>(
        resolvePortfolioRequestTarget(),
        `/portfolio/portfolios/${encodeURIComponent(portfolioId)}/readiness`,
        { query: sharedSearchParams }
      ),
      fetchPortfolioJson<PortfolioInsightsResponse>(
        resolvePortfolioRequestTarget(),
        `/portfolio/portfolios/${encodeURIComponent(portfolioId)}/insights`,
        { query: sharedSearchParams }
      ),
      fetchPortfolioJson<PortfolioWorkflowResponse>(
        resolvePortfolioRequestTarget(),
        `/portfolio/portfolios/${encodeURIComponent(portfolioId)}/workflow`,
        { query: sharedSearchParams }
      ),
    ]);

    const liquidityPayload = settledPortfolioPayload(liquidityResult);
    const transactionsPayload = settledPortfolioPayload(transactionsResult);
    const readinessPayload = settledPortfolioPayload(readinessResult);
    const insightsPayload = settledPortfolioPayload(insightsResult);
    const workflowPayload = settledPortfolioPayload(workflowResult);

    return {
      ...(liquidityPayload
        ? {
            cash_balances: liquidityPayload.cash_balances,
            cashflow_outlook: liquidityPayload.cashflow_outlook,
          }
        : {}),
      ...(transactionsPayload
        ? {
            recent_transactions: transactionsPayload.transactions,
            transaction_ledger_page: {
              total: transactionsPayload.total ?? transactionsPayload.transactions.length,
              skip: transactionsPayload.skip ?? 0,
              limit: transactionsPayload.limit ?? transactionsPayload.transactions.length,
            },
          }
        : {}),
      ...(readinessPayload
        ? {
            readiness_indicators: readinessPayload.indicators,
            supportability: readinessPayload.supportability,
          }
        : {}),
      ...(insightsPayload
        ? {
            exception_summaries: insightsPayload.exception_summaries,
            insights: insightsPayload.insights,
          }
        : {}),
      workflow_actions: workflowPayload?.actions ?? [],
      record_data_availability: {
        liquidity: liquidityPayload ? "ready" : "unavailable",
        transactions: transactionsPayload ? "ready" : "unavailable",
      },
    };
  } catch {
    return null;
  }
}

export async function getPortfolioTransactionLedger(
  portfolioId: string,
  params: {
    asOfDate?: string;
    startDate?: string;
    endDate?: string;
    transactionType?: string;
    componentType?: string;
    securityId?: string;
    linkedTransactionGroupId?: string;
    fxContractId?: string;
    swapEventId?: string;
    nearLegGroupId?: string;
    farLegGroupId?: string;
    limit?: number;
    skip?: number;
  } = {}
): Promise<PortfolioTransactionLedgerResponse | null> {
  try {
    const searchParams = new URLSearchParams();
    searchParams.set("limit", String(params.limit ?? 200));
    searchParams.set("skip", String(params.skip ?? 0));

    if (params.asOfDate) {
      searchParams.set("as_of_date", params.asOfDate);
    }
    if (params.startDate) {
      searchParams.set("start_date", params.startDate);
    }
    if (params.endDate) {
      searchParams.set("end_date", params.endDate);
    }
    if (params.transactionType && params.transactionType !== "ALL") {
      searchParams.set("transaction_type", params.transactionType);
    }
    if (params.componentType && params.componentType !== "ALL") {
      searchParams.set("component_type", params.componentType);
    }
    if (params.securityId) {
      searchParams.set("security_id", params.securityId);
    }
    if (params.linkedTransactionGroupId) {
      searchParams.set("linked_transaction_group_id", params.linkedTransactionGroupId);
    }
    if (params.fxContractId) {
      searchParams.set("fx_contract_id", params.fxContractId);
    }
    if (params.swapEventId) {
      searchParams.set("swap_event_id", params.swapEventId);
    }
    if (params.nearLegGroupId) {
      searchParams.set("near_leg_group_id", params.nearLegGroupId);
    }
    if (params.farLegGroupId) {
      searchParams.set("far_leg_group_id", params.farLegGroupId);
    }

    return await fetchPortfolioJson<PortfolioTransactionLedgerResponse>(
      resolvePortfolioRequestTarget(),
      `/portfolio/portfolios/${encodeURIComponent(portfolioId)}/transactions`,
      { query: searchParams }
    );
  } catch {
    return null;
  }
}

export async function getPortfolioTransactionRecord(
  portfolioId: string,
  transactionId: string,
  params: {
    asOfDate: string;
    reportingCurrency: string;
    signal?: AbortSignal;
  },
): Promise<PortfolioTransactionRecordResponse> {
  const target = resolvePortfolioRequestTarget();
  const path = `/portfolio/portfolios/${encodeURIComponent(portfolioId)}/transactions/${encodeURIComponent(transactionId)}`;
  const query = new URLSearchParams({
    as_of_date: params.asOfDate,
    include_projected: "false",
    reporting_currency: params.reportingCurrency,
  });
  const url = buildPortfolioApiUrl(target, path, query);

  return await observeWorkbenchAnalyticsRequest(
    observedPortfolioSurface(path),
    async () => {
      const response = await fetch(url, {
        cache: "no-store",
        headers: buildPortfolioRequestHeaders(target),
        signal: params.signal,
      });
      if (!response.ok) {
        throw new PortfolioTransactionRecordError(
          await resolveTransactionRecordFailure(response, params.signal),
        );
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        params.signal?.throwIfAborted();
        payload = null;
      }
      return parsePortfolioTransactionRecord(payload, {
        portfolioId,
        transactionId,
      });
    },
  );
}

async function resolveTransactionRecordFailure(
  response: Response,
  signal?: AbortSignal,
): Promise<PortfolioTransactionRecordFailure> {
  let code: unknown;
  try {
    const body = (await response.json()) as unknown;
    code = isRecord(body) && isRecord(body.detail) ? body.detail.code : undefined;
  } catch {
    signal?.throwIfAborted();
    code = undefined;
  }
  const failures: Record<string, PortfolioTransactionRecordFailure> = {
    portfolio_transaction_not_found: "not_found",
    portfolio_transaction_access_denied: "access_denied",
    portfolio_transaction_request_invalid: "invalid_request",
    portfolio_transaction_source_unavailable: "source_unavailable",
    portfolio_transaction_source_contract_invalid: "source_contract_invalid",
    portfolio_transaction_record_identity_mismatch: "identity_mismatch",
  };
  if (typeof code === "string" && failures[code]) {
    return failures[code];
  }
  if (response.status === 404) return "not_found";
  if (response.status === 401 || response.status === 403) return "access_denied";
  if (response.status === 400 || response.status === 422) return "invalid_request";
  if (response.status >= 500) return "source_unavailable";
  return "unavailable";
}

export async function getPortfolioAllocationViews(
  portfolioId: string,
  params: {
    asOfDate?: string;
    reportingCurrency?: string;
    lookThroughMode?: PortfolioLookThroughMode;
  } = {}
): Promise<PortfolioAllocationResponse | null> {
  try {
    const searchParams = new URLSearchParams();
    if (params.asOfDate) {
      searchParams.set("as_of_date", params.asOfDate);
    }
    if (params.reportingCurrency) {
      searchParams.set("reporting_currency", params.reportingCurrency);
    }
    searchParams.set("look_through_mode", params.lookThroughMode ?? "direct_only");

    const payload = await fetchPortfolioJson<unknown>(
      resolvePortfolioRequestTarget(),
      `/portfolio/portfolios/${encodeURIComponent(portfolioId)}/allocations`,
      { query: searchParams }
    );
    return parsePortfolioAllocationResponse(payload, { portfolioId, ...params });
  } catch {
    return null;
  }
}

export async function getPortfolioProjectedCashflow(
  portfolioId: string,
  params: {
    asOfDate?: string;
    horizonDays?: number;
    includeProjected?: boolean;
  } = {}
): Promise<PortfolioProjectedCashflowResponse | null> {
  try {
    const searchParams = new URLSearchParams();
    if (params.asOfDate) {
      searchParams.set("as_of_date", params.asOfDate);
    }
    if (params.horizonDays) {
      searchParams.set("horizon_days", String(params.horizonDays));
    }
    if (params.includeProjected !== undefined) {
      searchParams.set("include_projected", String(params.includeProjected));
    }

    const payload = await fetchPortfolioJson<PortfolioProjectedCashflowResponse>(
      resolvePortfolioRequestTarget(),
      `/portfolio/portfolios/${encodeURIComponent(portfolioId)}/projected-cashflow`,
      { query: searchParams }
    );
    if (!payload) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function mergePortfolioWorkspace(
  workspace: PortfolioWorkspace,
  details: Partial<PortfolioWorkspace>
): PortfolioWorkspace {
  const recordDataAvailability =
    workspace.record_data_availability || details.record_data_availability
      ? {
          ...workspace.record_data_availability,
          ...details.record_data_availability,
        }
      : undefined;
  const readiness = {
    ...workspace.readiness,
    ...details.readiness,
    ...(details.summary
      ? { has_positions: details.summary.position_count > 0 }
      : {}),
  };

  return {
    ...workspace,
    ...details,
    cashflow_outlook: details.cashflow_outlook ?? workspace.cashflow_outlook,
    readiness,
    record_data_availability: recordDataAvailability,
  };
}

function settledPortfolioPayload<T>(result: PromiseSettledResult<T | null>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

function buildPortfolioBookQuery(params: {
  asOfDate?: string;
  reportingCurrency?: string;
  includeProjected?: boolean;
}) {
  const query = new URLSearchParams();

  if (params.asOfDate) {
    query.set("as_of_date", params.asOfDate);
  }
  if (params.reportingCurrency) {
    query.set("reporting_currency", params.reportingCurrency);
  }
  query.set("include_projected", String(params.includeProjected ?? false));

  return query;
}

function buildPortfolioSummaryWindowQuery(params: {
  asOfDate?: string;
  reportingCurrency?: string;
  reportStartDate: string;
  reportEndDate: string;
}): URLSearchParams {
  const query = new URLSearchParams();

  if (params.asOfDate) {
    query.set("as_of_date", params.asOfDate);
  }
  if (params.reportingCurrency) {
    query.set("reporting_currency", params.reportingCurrency);
  }
  query.set("start_date", params.reportStartDate);
  query.set("end_date", params.reportEndDate);

  return query;
}

function mapPortfolioPerformanceSnapshot(
  payload: PortfolioPerformanceSnapshotResponse | null
): PortfolioWorkspace["performance"] {
  if (!payload) {
    return null;
  }

  const reportStartDate = payload.sparkline[0]?.as_of_date ?? null;
  return {
    period: payload.period,
    report_start_date: payload.report_start_date ?? reportStartDate,
    report_end_date: payload.report_end_date ?? payload.as_of_date,
    return_pct: payload.portfolio_return_pct,
    money_weighted_return_pct: null,
    money_weighted_method: null,
    benchmark_code: payload.benchmark_code,
    benchmark_label: null,
    benchmark_return_pct: payload.benchmark_return_pct,
    benchmark_return_source: null,
    benchmark_input_mode: null,
    excess_return_pct: payload.excess_return_pct,
    sparkline_points: payload.sparkline.map((point) => ({
      label: point.as_of_date,
      portfolio_return_pct: point.portfolio_return_pct,
      benchmark_return_pct: point.benchmark_return_pct ?? null,
      active_return_pct: point.excess_return_pct ?? null,
    })),
    unavailable: payload.unavailable ?? null,
    warnings: payload.warnings ?? [],
    partial_failures: payload.partial_failures ?? [],
  };
}

function mapPortfolioPerformancePeriodReturn(
  period: "MTD" | "QTD" | "YTD",
  payload: PortfolioPerformanceSnapshotResponse | null
): NonNullable<PortfolioWorkspace["performance_period_returns"]>[number] {
  return {
    period,
    return_pct: payload?.portfolio_return_pct ?? null,
    benchmark_return_pct: payload?.benchmark_return_pct ?? null,
    excess_return_pct: payload?.excess_return_pct ?? null,
    unavailable: payload?.unavailable ?? null,
    warnings: payload?.warnings ?? [],
    partial_failures: payload?.partial_failures ?? [],
  };
}

function buildPortfolioApiUrl(
  target: PortfolioRequestTarget,
  path: string,
  query?: URLSearchParams
): string {
  const baseUrl = resolveBffBaseUrlForTarget(target);
  const suffix = query?.toString();
  return suffix ? `${baseUrl}/api/v1${path}?${suffix}` : `${baseUrl}/api/v1${path}`;
}

function resolveBffBaseUrlForTarget(target: PortfolioRequestTarget): string {
  if (target === "client") {
    return resolveWorkbenchApiBase("client").replace(/\/api\/v1$/, "");
  }
  return resolveGatewayBaseUrl();
}

function buildPortfolioRequestHeaders(target: PortfolioRequestTarget): Headers {
  return target === "client"
    ? buildAnalyticsUiCorrelationHeaders()
    : buildServerGatewayHeaders();
}

async function fetchPortfolioJson<T>(
  target: PortfolioRequestTarget,
  path: string,
  options: {
    query?: URLSearchParams;
    signal?: AbortSignal;
  } = {}
): Promise<T | null> {
  const url = buildPortfolioApiUrl(target, path, options.query);
  return await observeWorkbenchAnalyticsRequest(
    observedPortfolioSurface(path),
    async () => {
      const response = await fetch(url, {
        cache: "no-store",
        headers: buildPortfolioRequestHeaders(target),
        signal: options.signal,
      });
      if (!response.ok) {
        return null;
      }

      return (await response.json()) as T;
    }
  );
}
