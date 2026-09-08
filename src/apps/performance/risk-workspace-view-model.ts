import type {
  WorkbenchPerformanceWorkspace,
  WorkbenchRiskAttributionResponse,
  WorkbenchRiskConcentrationResponse,
  WorkbenchRiskDrawdownResponse,
  WorkbenchRiskDrawdownSummary,
  WorkbenchRiskMetric,
  WorkbenchRiskModuleState,
  WorkbenchRiskRollingResponse,
  WorkbenchRiskSummaryResponse,
} from "@/features/workbench/types";
import {
  formatDateValue,
  formatNumber,
  formatPercent,
} from "@/design-system/utils/financial-formatters";
import { PORTFOLIO_CURRENCY_LABELS } from "@/apps/portfolio/portfolio-terminology";

import {
  buildRiskMandateComparisonViewModel,
  type RiskMandateComparisonViewModel,
} from "./risk-mandate-comparison-view-model";

export type PerformanceRiskState =
  | "loading"
  | "ready"
  | "partial"
  | "empty"
  | "permission_blocked"
  | "unavailable"
  | "error";

export type PerformanceRiskConcentrationIndicator = {
  key: string;
  label: string;
  value: string;
  support: string;
  definition: string;
  tone?: "neutral" | "warn" | "danger";
};

export type PerformanceRiskConcentrationContextRow = {
  key: string;
  label: string;
  value: string;
  definition: string;
  support: string;
};

export type PerformanceRiskContextRow = {
  key: string;
  label: string;
  value: string;
  support: string;
};

export type PerformanceRiskMetricCard = {
  key: string;
  label: string;
  value: string;
  support: string;
  metadata?: string;
  definition?: string;
  state: PerformanceRiskState;
};

export type PerformanceRiskRollingDetailRow = {
  key: string;
  metric: string;
  current: string;
  typical: string;
  range: string;
  interpretation: string;
  currentPositionPct: number | null;
  typicalPositionPct: number | null;
};

export type PerformanceRiskRollingWindow = {
  key: string;
  label: string;
  horizonLabel: string;
  selectedWindowSummary: {
    title: string;
    body: string;
  };
  detailRowInterpretations: PerformanceRiskRollingDetailRow[];
  headlineMetrics: PerformanceRiskMetricCard[];
  detailRows: PerformanceRiskRollingDetailRow[];
  seriesRows: Array<{
    key: string;
    date: string;
    values: Record<string, string>;
  }>;
  seriesMetricKeys: string[];
};

export type PerformanceRiskOverviewItem = {
  key: string;
  label: string;
  value: string;
  support: string;
  tone: "default" | "success" | "warn" | "danger";
};

export type PerformanceRiskViewModel = {
  state: PerformanceRiskState;
  title: string;
  synopsis: string;
  contextItems: Array<{ label: string; value: string }>;
  workspaceOverview: PerformanceRiskOverviewItem[];
  mandateComparison: RiskMandateComparisonViewModel;
  snapshotHeadlineMetrics: PerformanceRiskMetricCard[];
  snapshotSupportingMetrics: PerformanceRiskMetricCard[];
  snapshotContextRows: PerformanceRiskContextRow[];
  concentrationIndicators: PerformanceRiskConcentrationIndicator[];
  concentrationContextRows: PerformanceRiskConcentrationContextRow[];
  drawdownHeadlineMetrics: PerformanceRiskMetricCard[];
  drawdownSupportingMetrics: PerformanceRiskMetricCard[];
  drawdownContextRows: PerformanceRiskContextRow[];
  drawdownEpisodeInterpretation: {
    title: string;
    body: string;
  } | null;
  drawdownEpisodes: Array<{
    key: string;
    episode: string;
    depth: string;
    peakDate: string;
    troughDate: string;
    recoveryDate: string;
    totalDays: string;
    status: string;
  }>;
  drawdownRelativeMetric: {
    label: string;
    value: string;
    support: string;
    state: PerformanceRiskState;
  } | null;
  underwaterSeries: Array<{
    key: string;
    date: string;
    drawdown: string;
  }>;
  underwaterDetailState: "idle" | "loading" | "ready" | "unavailable";
  rollingWindows: PerformanceRiskRollingWindow[];
  rollingDetailState: "idle" | "loading" | "ready" | "unavailable";
  rollingContextRows: PerformanceRiskContextRow[];
  attributionControls: {
    selectedAttributionType: string;
    selectedGroupingDimension: string;
    attributionTypes: Array<{
      key: string;
      label: string;
      disabled: boolean;
      reason?: string | null;
    }>;
    groupingDimensions: Array<{
      key: string;
      label: string;
      disabled: boolean;
      reason?: string | null;
    }>;
  } | null;
  attributionRows: Array<{
    key: string;
    group: string;
    avgWeight: string;
    marginalContribution: string;
    componentContribution: string;
    contributionShare: string;
    contributionShareAbsPct: number | null;
  }>;
  attributionMaxContributionShareAbsPct: number;
  attributionMethodologyRows: PerformanceRiskContextRow[];
  attributionState:
    | "idle"
    | "loading"
    | "ready"
    | "partial"
    | "blocked"
    | "unavailable";
  attributionWarnings: string[];
  supportability: Array<{
    key: string;
    label: string;
    state: WorkbenchRiskModuleState;
    reason?: string | null;
  }>;
  warnings: string[];
  partialFailures: string[];
};

export type BuildPerformanceRiskViewModelOptions = {
  workspace: WorkbenchPerformanceWorkspace;
  period: string;
  detailBasis: string;
  isDetailsPending?: boolean;
  riskSummary?: WorkbenchRiskSummaryResponse | null;
  riskConcentration?: WorkbenchRiskConcentrationResponse | null;
  riskAttribution?: WorkbenchRiskAttributionResponse | null;
  riskDrawdown?: WorkbenchRiskDrawdownResponse | null;
  riskDrawdownDetail?: WorkbenchRiskDrawdownResponse | null;
  riskRolling?: WorkbenchRiskRollingResponse | null;
  riskRollingDetail?: WorkbenchRiskRollingResponse | null;
  isAttributionLoading?: boolean;
  isDrawdownDetailLoading?: boolean;
  isRollingDetailLoading?: boolean;
};

type RiskRollingPayload = NonNullable<WorkbenchRiskRollingResponse["payload"]>;

export function buildPerformanceRiskViewModel({
  workspace,
  period,
  detailBasis,
  isDetailsPending = false,
  riskSummary,
  riskConcentration,
  riskAttribution,
  riskDrawdown,
  riskDrawdownDetail,
  riskRolling,
  riskRollingDetail,
  isAttributionLoading = false,
  isDrawdownDetailLoading = false,
  isRollingDetailLoading = false,
}: BuildPerformanceRiskViewModelOptions): PerformanceRiskViewModel {
  if (isDetailsPending) {
    return buildStateViewModel(workspace, period, detailBasis, "loading");
  }

  const summary =
    riskSummary ??
    buildUnavailableRiskSummary({
      workspace,
      period,
      detailBasis,
      detail: "Risk summary is not available from the Gateway BFF.",
    });
  const concentration =
    riskConcentration ??
    buildUnavailableRiskConcentration({
      workspace,
      period,
      detail: "Risk concentration is not available from the Gateway BFF.",
    });
  const attribution = riskAttribution ?? null;
  const admittedAttribution =
    attribution && isKnownAttributionState(attribution.state) ? attribution : null;
  const drawdown =
    riskDrawdown ??
    buildUnavailableRiskDrawdown({
      workspace,
      period,
      detailBasis,
      detail: "Risk drawdown is not available from the Gateway BFF.",
      includeUnderwaterSeries: false,
    });
  const rolling =
    riskRolling ??
    buildUnavailableRiskRolling({
      workspace,
      period,
      detailBasis,
      detail: "Rolling risk is not available from the Gateway BFF.",
      includeTimeSeries: false,
    });
  const drawdownDetail = riskDrawdownDetail ?? null;
  const rollingDetail = riskRollingDetail ?? null;

  const supportability = [
    ...mapSupportabilityGroup("summary", summary.supportability),
    ...mapSupportabilityGroup("concentration", concentration.supportability),
    ...mapSupportabilityGroup("attribution", admittedAttribution?.supportability ?? []),
    ...mapSupportabilityGroup("drawdown", drawdown.supportability),
    ...mapSupportabilityGroup("rolling", rolling.supportability),
  ];
  const hasPayload = Boolean(
    summary.payload?.periods.length ||
      concentration.payload ||
      admittedAttribution?.payload?.periods.length ||
      drawdown.payload?.periods.length ||
      rolling.payload?.periods.length
  );
  const moduleStates = [summary.state, concentration.state, drawdown.state, rolling.state];
  const isPermissionBlocked = !hasPayload && moduleStates.some((moduleState) => moduleState === "blocked");
  const state = isPermissionBlocked
    ? "permission_blocked"
    : !hasPayload
    ? "unavailable"
    : moduleStates.every((moduleState) => moduleState === "ready")
      ? "ready"
      : "partial";

  return {
    state,
    title:
      state === "permission_blocked"
        ? "Risk access restricted"
        : state === "unavailable"
          ? "Risk unavailable"
          : "Risk",
    synopsis:
      state === "permission_blocked"
        ? "Risk analytics are permission-blocked for this caller context."
        : state === "unavailable"
        ? "Risk is not available for the selected portfolio context."
        : "Portfolio risk is available for the selected performance context.",
    contextItems: buildContextItems(workspace, period, detailBasis, summary.as_of_date),
    workspaceOverview: buildRiskWorkspaceOverview({
      summary,
      concentration,
      drawdown,
      rolling,
      attribution: admittedAttribution,
      supportability,
    }),
    mandateComparison: buildRiskMandateComparisonViewModel({
      portfolioRisk: summary.mandate_comparison,
      concentrationRisk: concentration.mandate_comparison,
    }),
    snapshotHeadlineMetrics: mapSnapshotHeadlineMetrics(summary),
    snapshotSupportingMetrics: mapSnapshotSupportingMetrics(summary),
    snapshotContextRows: mapSnapshotContextRows(summary),
    concentrationIndicators: mapConcentrationIndicators(concentration),
    concentrationContextRows: mapConcentrationContextRows(concentration),
    drawdownHeadlineMetrics: mapDrawdownHeadlineMetrics(drawdown),
    drawdownSupportingMetrics: mapDrawdownSupportingMetrics(drawdown),
    drawdownContextRows: mapDrawdownContextRows(drawdown),
    drawdownEpisodeInterpretation: mapDrawdownEpisodeInterpretation(drawdown),
    drawdownEpisodes: mapDrawdownEpisodes(drawdown),
    drawdownRelativeMetric: mapRelativeDrawdownMetric(drawdown),
    underwaterSeries: mapUnderwaterSeries(drawdownDetail),
    underwaterDetailState: resolveUnderwaterDetailState({
      drawdown,
      drawdownDetail,
      isDrawdownDetailLoading,
    }),
    rollingWindows: mapRollingWindows(rolling, rollingDetail),
    rollingDetailState: resolveRollingDetailState({
      rolling,
      rollingDetail,
      isRollingDetailLoading,
    }),
    rollingContextRows: mapRollingContextRows(rolling),
    attributionControls: mapAttributionControls(admittedAttribution),
    attributionRows: mapAttributionRows(admittedAttribution),
    attributionMaxContributionShareAbsPct: mapAttributionMaxContributionShareAbsPct(admittedAttribution),
    attributionMethodologyRows: mapAttributionMethodologyRows(admittedAttribution),
    attributionState: resolveAttributionState({ attribution, isAttributionLoading }),
    attributionWarnings: admittedAttribution?.warnings ?? [],
    supportability: supportability.map((item) => ({
      key: item.key,
      label: item.label,
      state: item.state,
      reason: item.reason,
    })),
    warnings: [
      ...summary.warnings,
      ...concentration.warnings,
      ...(admittedAttribution?.warnings ?? []),
      ...drawdown.warnings,
      ...rolling.warnings,
    ],
    partialFailures: Array.from(
      new Set([
        ...summary.partial_failures.map((failure) => failure.detail),
        ...concentration.partial_failures.map((failure) => failure.detail),
        ...(admittedAttribution?.partial_failures.map((failure) => failure.detail) ?? []),
        ...drawdown.partial_failures.map((failure) => failure.detail),
        ...rolling.partial_failures.map((failure) => failure.detail),
      ])
    ),
  };
}

export function buildFixtureRiskSummary(
  workspace: WorkbenchPerformanceWorkspace,
  period: string,
  detailBasis: string
): WorkbenchRiskSummaryResponse {
  const selectedPerformance =
    detailBasis === "GROSS" ? workspace.gross_performance : workspace.net_performance;
  const activeReturn = selectedPerformance.active_return_pct ?? 0;
  const volatility = Math.max(Math.abs(activeReturn) * 1.8, 7.25);
  const trackingError = Math.max(Math.abs(activeReturn) * 0.8, 2.15);

  return {
    correlation_id: "fixture-risk-summary",
    contract_version: "risk-workspace.v1",
    portfolio_id: workspace.portfolio.portfolio_id,
    period,
    detail_basis: requireRiskDetailBasis(detailBasis),
    as_of_date: workspace.as_of_date,
    benchmark_code: workspace.benchmark_code,
    source_service: "lotus-risk",
    state: workspace.benchmark_code ? "partial" : "unavailable",
    payload: {
      periods: [
        {
          key: period,
          label: period,
          start_date: workspace.report_start_date,
          end_date: workspace.report_end_date,
          metrics: [
            metric("VOLATILITY", "Volatility", volatility, "ready"),
            metric("SHARPE", "Sharpe", 0.82, "ready"),
            metric("SORTINO", "Sortino", 1.05, "ready"),
            metric("BETA", "Beta", 0.94, workspace.benchmark_code ? "ready" : "unavailable"),
            metric(
              "TRACKING_ERROR",
              "Tracking Error",
              trackingError,
              workspace.benchmark_code ? "ready" : "unavailable"
            ),
            metric(
              "INFORMATION_RATIO",
              "Information Ratio",
              activeReturn / trackingError,
              workspace.benchmark_code ? "ready" : "unavailable"
            ),
            metric("VAR", "Value at Risk", -1.74, "ready", { expected_shortfall: -2.26 }),
          ],
        },
      ],
    },
    supportability: [
      {
        key: "portfolio_returns",
        label: "Portfolio returns",
        state: "ready",
        source_service: "lotus-risk",
      },
      {
        key: "benchmark_returns",
        label: "Benchmark returns",
        state: workspace.benchmark_code ? "ready" : "unavailable",
        reason: workspace.benchmark_code
          ? null
          : "Benchmark-relative risk requires benchmark context.",
        source_service: "lotus-risk",
      },
      {
        key: "risk_free_series",
        label: "Risk-free series",
        state: "partial",
        reason:
          "Rolling Sharpe is omitted or marked unavailable when the risk-free curve cannot be sourced.",
        source_service: "lotus-risk",
      },
    ],
    warnings: ["RISK_UI_FIXTURE_CONTRACT"],
    partial_failures: [],
    metadata: {
      generated_at: workspace.as_of_date,
      input_mode: "stateful",
      methodology_version: "risk-workspace.fixture.v1",
      cache_status: "bypass",
    },
  };
}

export function buildFixtureRiskConcentration(
  workspace: WorkbenchPerformanceWorkspace,
  period: string
): WorkbenchRiskConcentrationResponse {
  return {
    correlation_id: "fixture-risk-concentration",
    contract_version: "risk-workspace.v1",
    portfolio_id: workspace.portfolio.portfolio_id,
    period,
    as_of_date: workspace.as_of_date,
    benchmark_code: workspace.benchmark_code,
    source_service: "lotus-risk",
    state: "partial",
    payload: {
      portfolio_concentration: { hhi_current: 1260, hhi_proposed: 1260, hhi_delta: 0 },
      single_position_concentration: {
        top_position_weight_current: 0.184,
        top_position_weight_proposed: 0.184,
        top_position_weight_delta: 0,
        top_n_cumulative_weight_current: 0.528,
        top_n_cumulative_weight_proposed: 0.528,
        top_n_cumulative_weight_delta: 0,
        top_n: 10,
        top_position_current: {
          security_id: "FUND_PIMCO_INC",
          security_name: "PIMCO GIS Income Fund",
          weight: 0.184,
        },
        top_position_proposed: {
          security_id: "FUND_PIMCO_INC",
          security_name: "PIMCO GIS Income Fund",
          weight: 0.184,
        },
      },
      issuer_concentration: {
        hhi_current: 1448,
        hhi_proposed: 1448,
        hhi_delta: 0,
        top_issuer_weight_current: 0.214,
        top_issuer_weight_proposed: 0.214,
        top_issuer_weight_delta: 0,
        coverage_status: "partial",
        covered_position_count_current: 8,
        covered_position_count_proposed: 8,
        total_position_count_current: 10,
        total_position_count_proposed: 10,
        uncovered_position_count_current: 2,
        uncovered_position_count_proposed: 2,
        coverage_ratio_current: 0.8,
        coverage_ratio_proposed: 0.8,
        note: "Issuer enrichment is partial in the current stateful risk contract.",
        top_issuer_current: {
          issuer_id: "ISSUER_PIMCO",
          issuer_name: "Pacific Investment Management Company LLC",
          weight: 0.214,
        },
        top_issuer_proposed: {
          issuer_id: "ISSUER_PIMCO",
          issuer_name: "Pacific Investment Management Company LLC",
          weight: 0.214,
        },
      },
      valuation_context: {
        portfolio_currency: workspace.portfolio.base_currency,
        reporting_currency: workspace.portfolio.base_currency,
        position_basis: "market_value_base",
        weight_basis: "total_market_value_base",
      },
      execution_context: {
        as_of_date: workspace.as_of_date,
        portfolio_id: workspace.portfolio.portfolio_id,
        issuer_grouping_level: "ultimate_parent",
        enrichment_policy: "merge_caller_then_core",
        include_cash_positions: true,
        include_zero_quantity_positions: false,
      },
    },
    supportability: [
      {
        key: "portfolio_positions",
        label: "Portfolio positions",
        state: "ready",
        source_service: "lotus-risk",
      },
      {
        key: "issuer_enrichment",
        label: "Issuer enrichment",
        state: "partial",
        reason: "Issuer coverage is partial in the current stateful risk contract.",
        source_service: "lotus-risk",
      },
      {
        key: "issuer_grouping",
        label: "Issuer grouping",
        state: "ready",
        reason: "Ultimate parent grouping with merge caller then core enrichment policy.",
        source_service: "lotus-risk",
      },
      {
        key: "valuation_basis",
        label: "Valuation basis",
        state: "ready",
        reason: "Total market value base in USD/USD context.",
        source_service: "lotus-risk",
      },
    ],
    warnings: ["RISK_CONCENTRATION_FIXTURE_CONTRACT"],
    partial_failures: [],
    metadata: {
      generated_at: workspace.as_of_date,
      input_mode: "stateful",
      methodology_version: "concentration.fixture.v1",
      cache_status: "bypass",
    },
  };
}

export function buildFixtureRiskDrawdown(
  workspace: WorkbenchPerformanceWorkspace,
  period: string,
  detailBasis: string,
  options?: {
    includeUnderwaterSeries?: boolean;
    includeBenchmarkRelative?: boolean;
  }
): WorkbenchRiskDrawdownResponse {
  const includeUnderwaterSeries = options?.includeUnderwaterSeries ?? false;
  const includeBenchmarkRelative = options?.includeBenchmarkRelative ?? Boolean(workspace.benchmark_code);
  return {
    correlation_id: "fixture-risk-drawdown",
    contract_version: "risk-workspace.v1",
    portfolio_id: workspace.portfolio.portfolio_id,
    period,
    detail_basis: requireRiskDetailBasis(detailBasis),
    as_of_date: workspace.as_of_date,
    benchmark_code: workspace.benchmark_code,
    source_service: "lotus-risk",
    state: includeBenchmarkRelative ? "partial" : "partial",
    payload: {
      analysis_context: {
        include_underwater_series: includeUnderwaterSeries,
      },
      periods: [
        {
          key: period,
          label: period,
          start_date: workspace.report_start_date,
          end_date: workspace.report_end_date,
          summary: {
            max_drawdown: -0.124533,
            max_drawdown_peak_date: "2026-01-12",
            max_drawdown_trough_date: "2026-02-03",
            max_drawdown_recovery_date: null,
            is_recovered: false,
            days_to_trough: 16,
            days_to_recovery: null,
            time_under_water_days: 34,
            average_drawdown: -0.041208,
            ulcer_index: 0.053901,
            drawdown_at_risk_95: -0.101552,
            conditional_drawdown_at_risk_95: -0.117884,
          },
          episodes: [
            {
              episode_id: "dd_0001",
              peak_date: "2026-01-12",
              trough_date: "2026-02-03",
              recovery_date: null,
              depth: -0.124533,
              days_to_trough: 16,
              days_to_recovery: null,
              total_days: 34,
              is_recovered: false,
            },
            {
              episode_id: "dd_0002",
              peak_date: "2026-02-12",
              trough_date: "2026-02-13",
              recovery_date: "2026-02-19",
              depth: -0.055,
              days_to_trough: 1,
              days_to_recovery: 4,
              total_days: 7,
              is_recovered: true,
            },
          ],
          relative_to_benchmark: includeBenchmarkRelative
            ? {
                max_drawdown: -0.0821,
                max_drawdown_peak_date: "2026-01-11",
                max_drawdown_trough_date: "2026-02-01",
              }
            : null,
          underwater_series: includeUnderwaterSeries
            ? [
                { date: "2026-01-20", drawdown: -0.0521 },
                { date: "2026-01-21", drawdown: -0.061 },
                { date: "2026-01-22", drawdown: -0.0734 },
              ]
            : null,
          error: null,
        },
      ],
    },
    supportability: [
      {
        key: "portfolio_returns",
        label: "Portfolio returns",
        state: "ready",
        source_service: "lotus-risk",
      },
      {
        key: "benchmark_relative_drawdown",
        label: "Benchmark-relative drawdown",
        state: includeBenchmarkRelative ? "ready" : "partial",
        reason: includeBenchmarkRelative
          ? null
          : "Benchmark-relative drawdown requires benchmark context.",
        source_service: "lotus-risk",
      },
      {
        key: "underwater_series",
        label: "Underwater series",
        state: includeUnderwaterSeries ? "ready" : "partial",
        reason: includeUnderwaterSeries
          ? null
          : "Underwater series is available on demand and is not included in first paint.",
        source_service: "lotus-risk",
      },
    ],
    warnings: includeUnderwaterSeries ? [] : ["RISK_DRAWDOWN_UNDERWATER_DEFERRED"],
    partial_failures: [],
    metadata: {
      generated_at: workspace.as_of_date,
      input_mode: "stateful",
      methodology_version: `drawdown.fixture.${detailBasis.toLowerCase()}.v1`,
      cache_status: "bypass",
    },
  };
}

export function buildFixtureRiskRolling(
  workspace: WorkbenchPerformanceWorkspace,
  period: string,
  detailBasis: string,
  options?: {
    includeTimeSeries?: boolean;
  }
): WorkbenchRiskRollingResponse {
  const includeTimeSeries = options?.includeTimeSeries ?? false;
  const includeBenchmarkMetrics = Boolean(workspace.benchmark_code);
  return {
    correlation_id: "fixture-risk-rolling",
    contract_version: "risk-workspace.v1",
    portfolio_id: workspace.portfolio.portfolio_id,
    period,
    detail_basis: requireRiskDetailBasis(detailBasis),
    as_of_date: workspace.as_of_date,
    benchmark_code: workspace.benchmark_code,
    source_service: "lotus-risk",
    state: includeBenchmarkMetrics ? "partial" : "partial",
    payload: {
      request_context: {
        include_time_series: includeTimeSeries,
      },
      periods: [
        {
          key: period,
          label: period,
          start_date: workspace.report_start_date,
          end_date: workspace.report_end_date,
          series_count: 66,
          window_results: [21, 63, 126, 252].map((windowLength) => ({
            window_length: windowLength,
            metric_summaries: buildFixtureRollingMetricSummaries({
              windowLength,
              includeBenchmarkMetrics,
            }),
            metric_series: includeTimeSeries
              ? buildFixtureRollingSeries({
                  windowLength,
                  includeBenchmarkMetrics,
                  reportStartDate: workspace.report_start_date,
                  reportEndDate: workspace.report_end_date,
                })
              : null,
          })),
          quality_flags: includeBenchmarkMetrics
            ? ["metric:ROLLING_BETA:benchmark_variance_zero"]
            : [],
          error: null,
        },
      ],
    },
    supportability: [
      {
        key: "portfolio_returns",
        label: "Portfolio returns",
        state: "ready",
        source_service: "lotus-risk",
      },
      {
        key: "benchmark_returns",
        label: "Benchmark returns",
        state: includeBenchmarkMetrics ? "ready" : "partial",
        reason: includeBenchmarkMetrics
          ? null
          : "Benchmark-relative rolling metrics require benchmark context.",
        source_service: "lotus-risk",
      },
      {
        key: "risk_free_series",
        label: "Risk-free series",
        state: "partial",
        reason:
          "Rolling Sharpe is omitted or marked unavailable when the risk-free curve cannot be sourced.",
        source_service: "lotus-risk",
      },
      {
        key: "rolling_time_series",
        label: "Rolling time series",
        state: includeTimeSeries ? "ready" : "partial",
        reason: includeTimeSeries
          ? null
          : "Rolling time series is available on demand and is excluded from first paint.",
        source_service: "lotus-risk",
      },
    ],
    warnings: includeTimeSeries ? [] : ["RISK_ROLLING_TIME_SERIES_DEFERRED"],
    partial_failures: [],
    metadata: {
      generated_at: workspace.as_of_date,
      input_mode: "stateful",
      methodology_version: `rolling.fixture.${detailBasis.toLowerCase()}.v1`,
      cache_status: "bypass",
    },
  };
}

export function buildFixtureRiskAttribution(
  workspace: WorkbenchPerformanceWorkspace,
  period: string,
  detailBasis: string,
  options?: {
    attributionType?: "TOTAL_RISK" | "ACTIVE_RISK";
    groupingDimension?: "POSITION" | "SECTOR" | "ASSET_CLASS" | "ISSUER";
  }
): WorkbenchRiskAttributionResponse {
  const attributionType = options?.attributionType ?? "TOTAL_RISK";
  const groupingDimension = options?.groupingDimension ?? "SECTOR";
  const activeRiskReady = Boolean(workspace.benchmark_code);
  const issuerBlocked = attributionType === "ACTIVE_RISK" && groupingDimension === "ISSUER";
  const blockedWithoutBenchmark = attributionType === "ACTIVE_RISK" && !workspace.benchmark_code;
  const state = issuerBlocked || blockedWithoutBenchmark ? "blocked" : "ready";
  const contributors =
    groupingDimension === "ASSET_CLASS"
      ? [
          {
            group_key: "EQUITY",
            group_label: "Equity",
            weight_average: 0.62,
            marginal_contribution: 0.018,
            component_contribution: 0.016,
            percent_contribution: 0.47,
          },
          {
            group_key: "FIXED_INCOME",
            group_label: "Fixed Income",
            weight_average: 0.24,
            marginal_contribution: 0.011,
            component_contribution: 0.009,
            percent_contribution: 0.26,
          },
        ]
      : [
          {
            group_key: "SECTOR_TECH",
            group_label: "Technology",
            weight_average: 0.41,
            marginal_contribution: 0.019,
            component_contribution: 0.017,
            percent_contribution: 0.41,
          },
          {
            group_key: "SECTOR_HEALTH",
            group_label: "Healthcare",
            weight_average: 0.18,
            marginal_contribution: 0.008,
            component_contribution: 0.006,
            percent_contribution: 0.15,
          },
        ];
  const supportability: NonNullable<WorkbenchRiskAttributionResponse["supportability"]> = [
    {
      key: "portfolio_returns",
      label: "Portfolio returns",
      state: "ready",
      source_service: "lotus-risk",
    },
    {
      key: "exposure_history",
      label: "Exposure history",
      state: "ready",
      source_service: "lotus-core",
    },
    ...(attributionType === "ACTIVE_RISK"
      ? [
          {
            key: "benchmark_returns",
            label: "Benchmark returns",
            state: workspace.benchmark_code ? ("ready" as const) : ("blocked" as const),
            reason: workspace.benchmark_code ? null : "Active risk requires benchmark context.",
            source_service: "lotus-performance",
          },
          {
            key: "benchmark_exposure_context",
            label: "Benchmark exposure context",
            state:
              groupingDimension === "ISSUER"
                ? ("blocked" as const)
                : workspace.benchmark_code
                  ? ("ready" as const)
                  : ("blocked" as const),
            reason:
              groupingDimension === "ISSUER"
                ? "Issuer benchmark exposure semantics are not available."
                : workspace.benchmark_code
                  ? null
                  : "Active risk requires benchmark context.",
            source_service: "lotus-performance",
          },
        ]
      : [
          {
            key: "benchmark_exposure_context",
            label: "Benchmark exposure context",
            state: groupingDimension === "ISSUER" ? ("partial" as const) : ("ready" as const),
            reason:
              groupingDimension === "ISSUER"
                ? "Issuer benchmark exposure semantics remain unavailable for active-risk decomposition."
                : null,
            source_service: "lotus-performance",
          },
        ]),
  ];

  return {
    correlation_id: "fixture-risk-attribution",
    contract_version: "risk-workspace.v1",
    portfolio_id: workspace.portfolio.portfolio_id,
    period,
    detail_basis: requireRiskDetailBasis(detailBasis),
    as_of_date: workspace.as_of_date,
    benchmark_code: workspace.benchmark_code,
    source_service: "lotus-risk",
    state,
    payload: {
      controls: {
        attribution_types: [
          { key: "TOTAL_RISK", label: "Total Risk", state: "ready", reason: null },
          {
            key: "ACTIVE_RISK",
            label: "Active Risk",
            state: activeRiskReady ? "ready" : "blocked",
            reason: activeRiskReady ? null : "Active risk requires benchmark context.",
          },
        ],
        grouping_dimensions: [
          {
            key: "POSITION",
            label: "Position",
            state: "ready",
            reason: null,
            supported_attribution_types: activeRiskReady
              ? ["TOTAL_RISK", "ACTIVE_RISK"]
              : ["TOTAL_RISK"],
          },
          {
            key: "SECTOR",
            label: "Sector",
            state: "ready",
            reason: null,
            supported_attribution_types: activeRiskReady
              ? ["TOTAL_RISK", "ACTIVE_RISK"]
              : ["TOTAL_RISK"],
          },
          {
            key: "ASSET_CLASS",
            label: "Asset Class",
            state: "ready",
            reason: null,
            supported_attribution_types: activeRiskReady
              ? ["TOTAL_RISK", "ACTIVE_RISK"]
              : ["TOTAL_RISK"],
          },
          {
            key: "ISSUER",
            label: "Issuer",
            state: attributionType === "TOTAL_RISK" ? "partial" : "blocked",
            reason:
              attributionType === "TOTAL_RISK"
                ? "Issuer is supported for total risk only."
                : "Active risk by issuer remains unavailable until benchmark issuer exposure semantics are approved.",
            supported_attribution_types: ["TOTAL_RISK"],
          },
        ],
        selected_attribution_type: attributionType,
        selected_grouping_dimension: groupingDimension,
      },
      periods:
        state === "ready"
          ? [
              {
                key: period,
                label: period,
                start_date: workspace.report_start_date,
                end_date: workspace.report_end_date,
                attribution_sets: [
                  {
                    attribution_type: attributionType,
                    metric: attributionType === "ACTIVE_RISK" ? "TRACKING_ERROR" : "VOLATILITY",
                    grouping_dimension: groupingDimension,
                    total_value: attributionType === "ACTIVE_RISK" ? 0.034 : 0.121,
                    reconciled_sum: attributionType === "ACTIVE_RISK" ? 0.033 : 0.119,
                    residual: attributionType === "ACTIVE_RISK" ? 0.001 : 0.002,
                    contributors,
                    quality_flags: [],
                  },
                ],
                error: null,
              },
            ]
          : [],
      methodology_context: {
        covariance_method: "EMPIRICAL",
        annualization_basis: 252,
        requested_attribution_types: [attributionType],
        requested_metrics: [attributionType === "ACTIVE_RISK" ? "TRACKING_ERROR" : "VOLATILITY"],
        requested_grouping_dimensions: [groupingDimension],
        min_observations_policy: "STRICT",
        stateful_active_risk_supported_grouping_dimensions: [
          "POSITION",
          "SECTOR",
          "ASSET_CLASS",
        ],
        stateful_active_risk_gated_grouping_dimensions: ["ISSUER"],
        stateful_active_risk_gate_reason: "benchmark issuer exposure semantics unavailable",
      },
    },
    supportability,
    warnings: state === "ready" ? [] : ["RISK_ATTRIBUTION_BLOCKED"],
    partial_failures: [],
    metadata: {
      generated_at: workspace.as_of_date,
      input_mode: "stateful",
      methodology_version: `historical_attribution.fixture.${detailBasis.toLowerCase()}.v1`,
      cache_status: "bypass",
    },
  };
}

export function buildUnavailableRiskSummary({
  workspace,
  period,
  detailBasis,
  detail,
  permissionBlocked = false,
}: {
  workspace: WorkbenchPerformanceWorkspace;
  period: string;
  detailBasis: string;
  detail: string;
  permissionBlocked?: boolean;
}): WorkbenchRiskSummaryResponse {
  const state = permissionBlocked ? "blocked" : "unavailable";
  const warning = permissionBlocked ? "RISK_SUMMARY_PERMISSION_BLOCKED" : "RISK_SUMMARY_UNAVAILABLE";
  return {
    correlation_id: "risk-summary-unavailable",
    contract_version: "risk-workspace.v1",
    portfolio_id: workspace.portfolio.portfolio_id,
    period,
    detail_basis: requireRiskDetailBasis(detailBasis),
    as_of_date: workspace.as_of_date,
    benchmark_code: workspace.benchmark_code,
    source_service: "lotus-risk",
    state,
    payload: null,
    supportability: [
      {
        key: "risk_summary",
        label: "Risk summary",
        state,
        reason: `${detail} (${detailBasis} basis)`,
        source_service: "lotus-risk",
      },
    ],
    warnings: [warning],
    partial_failures: [
      { source_service: "risk", error_code: warning, detail },
    ],
    metadata: {
      generated_at: workspace.as_of_date,
      input_mode: "stateful",
      cache_status: "miss",
    },
  };
}

export function buildUnavailableRiskConcentration({
  workspace,
  period,
  detail,
  permissionBlocked = false,
}: {
  workspace: WorkbenchPerformanceWorkspace;
  period: string;
  detail: string;
  permissionBlocked?: boolean;
}): WorkbenchRiskConcentrationResponse {
  const state = permissionBlocked ? "blocked" : "unavailable";
  const warning = permissionBlocked
    ? "RISK_CONCENTRATION_PERMISSION_BLOCKED"
    : "RISK_CONCENTRATION_UNAVAILABLE";
  return {
    correlation_id: "risk-concentration-unavailable",
    contract_version: "risk-workspace.v1",
    portfolio_id: workspace.portfolio.portfolio_id,
    period,
    as_of_date: workspace.as_of_date,
    benchmark_code: workspace.benchmark_code,
    source_service: "lotus-risk",
    state,
    payload: null,
    supportability: [
      {
        key: "risk_concentration",
        label: "Risk concentration",
        state,
        reason: detail,
        source_service: "lotus-risk",
      },
    ],
    warnings: [warning],
    partial_failures: [
      { source_service: "risk", error_code: warning, detail },
    ],
    metadata: {
      generated_at: workspace.as_of_date,
      input_mode: "stateful",
      cache_status: "miss",
    },
  };
}

export function buildUnavailableRiskDrawdown({
  workspace,
  period,
  detailBasis,
  detail,
  includeUnderwaterSeries,
  permissionBlocked = false,
}: {
  workspace: WorkbenchPerformanceWorkspace;
  period: string;
  detailBasis: string;
  detail: string;
  includeUnderwaterSeries: boolean;
  permissionBlocked?: boolean;
}): WorkbenchRiskDrawdownResponse {
  const state = permissionBlocked ? "blocked" : "unavailable";
  const warning = permissionBlocked ? "RISK_DRAWDOWN_PERMISSION_BLOCKED" : "RISK_DRAWDOWN_UNAVAILABLE";
  return {
    correlation_id: "risk-drawdown-unavailable",
    contract_version: "risk-workspace.v1",
    portfolio_id: workspace.portfolio.portfolio_id,
    period,
    detail_basis: requireRiskDetailBasis(detailBasis),
    as_of_date: workspace.as_of_date,
    benchmark_code: workspace.benchmark_code,
    source_service: "lotus-risk",
    state,
    payload: null,
    supportability: [
      {
        key: "risk_drawdown",
        label: includeUnderwaterSeries ? "Risk drawdown detail" : "Risk drawdown",
        state,
        reason: `${detail} (${detailBasis} basis)`,
        source_service: "lotus-risk",
      },
    ],
    warnings: [warning],
    partial_failures: [
      { source_service: "risk", error_code: warning, detail },
    ],
    metadata: {
      generated_at: workspace.as_of_date,
      input_mode: "stateful",
      cache_status: "miss",
    },
  };
}

export function buildUnavailableRiskRolling({
  workspace,
  period,
  detailBasis,
  detail,
  includeTimeSeries,
  permissionBlocked = false,
}: {
  workspace: WorkbenchPerformanceWorkspace;
  period: string;
  detailBasis: string;
  detail: string;
  includeTimeSeries: boolean;
  permissionBlocked?: boolean;
}): WorkbenchRiskRollingResponse {
  const state = permissionBlocked ? "blocked" : "unavailable";
  const warning = permissionBlocked ? "RISK_ROLLING_PERMISSION_BLOCKED" : "RISK_ROLLING_UNAVAILABLE";
  return {
    correlation_id: "risk-rolling-unavailable",
    contract_version: "risk-workspace.v1",
    portfolio_id: workspace.portfolio.portfolio_id,
    period,
    detail_basis: requireRiskDetailBasis(detailBasis),
    as_of_date: workspace.as_of_date,
    benchmark_code: workspace.benchmark_code,
    source_service: "lotus-risk",
    state,
    payload: null,
    supportability: [
      {
        key: "risk_rolling",
        label: includeTimeSeries ? "Rolling risk detail" : "Rolling risk",
        state,
        reason: `${detail} (${detailBasis} basis)`,
        source_service: "lotus-risk",
      },
    ],
    warnings: [warning],
    partial_failures: [
      { source_service: "risk", error_code: warning, detail },
    ],
    metadata: {
      generated_at: workspace.as_of_date,
      input_mode: "stateful",
      cache_status: "miss",
    },
  };
}

export function buildUnavailableRiskAttribution({
  workspace,
  period,
  detailBasis,
  detail,
}: {
  workspace: WorkbenchPerformanceWorkspace;
  period: string;
  detailBasis: string;
  detail: string;
}): WorkbenchRiskAttributionResponse {
  return {
    correlation_id: "risk-attribution-unavailable",
    contract_version: "risk-workspace.v1",
    portfolio_id: workspace.portfolio.portfolio_id,
    period,
    detail_basis: requireRiskDetailBasis(detailBasis),
    as_of_date: workspace.as_of_date,
    benchmark_code: workspace.benchmark_code,
    source_service: "lotus-risk",
    state: "unavailable",
    payload: null,
    supportability: [
      {
        key: "risk_attribution",
        label: "Historical risk attribution",
        state: "unavailable",
        reason: detail,
        source_service: "lotus-risk",
      },
    ],
    warnings: ["RISK_ATTRIBUTION_UNAVAILABLE"],
    partial_failures: [
      { source_service: "risk", error_code: "RISK_ATTRIBUTION_UNAVAILABLE", detail },
    ],
    metadata: {
      generated_at: workspace.as_of_date,
      input_mode: "stateful",
      cache_status: "miss",
    },
  };
}

function requireRiskDetailBasis(value: string): "NET" | "GROSS" {
  if (value === "NET" || value === "GROSS") {
    return value;
  }
  throw new TypeError("Risk detail basis must be NET or GROSS.");
}

function buildStateViewModel(
  workspace: WorkbenchPerformanceWorkspace,
  period: string,
  detailBasis: string,
  state: PerformanceRiskState
): PerformanceRiskViewModel {
  const asOfDate = workspace.as_of_date;
  const title =
    state === "loading"
      ? "Loading risk"
      : state === "unavailable"
        ? "Risk unavailable"
        : "Risk not available";

  return {
    state,
    title,
    synopsis:
      state === "loading"
        ? "Risk snapshot and concentration modules are loading from the Gateway BFF contract."
        : "Risk is not available for the selected portfolio context.",
    contextItems: buildContextItems(workspace, period, detailBasis, asOfDate),
    workspaceOverview: [],
    mandateComparison: buildRiskMandateComparisonViewModel({
      portfolioRisk: null,
      concentrationRisk: null,
    }),
    snapshotHeadlineMetrics: [],
    snapshotSupportingMetrics: [],
    snapshotContextRows: [],
    concentrationIndicators: [],
    concentrationContextRows: [],
    drawdownHeadlineMetrics: [],
    drawdownSupportingMetrics: [],
    drawdownContextRows: [],
    drawdownEpisodeInterpretation: null,
    drawdownEpisodes: [],
    drawdownRelativeMetric: null,
    underwaterSeries: [],
    underwaterDetailState: "idle",
    rollingWindows: [],
    rollingDetailState: "idle",
    rollingContextRows: [],
    attributionControls: null,
    attributionRows: [],
    attributionMaxContributionShareAbsPct: 0,
    attributionMethodologyRows: [],
    attributionState: "idle",
    attributionWarnings: [],
    supportability: [
      {
        key: "risk_bff",
        label: "Risk service",
        state: state === "loading" ? "partial" : "unavailable",
        reason:
          state === "loading"
            ? "Gateway risk contract is loading."
            : "Gateway risk response is not available.",
      },
    ],
    warnings: state === "loading" ? [] : ["RISK_WORKSPACE_UNAVAILABLE"],
    partialFailures: [],
  };
}

function buildContextItems(
  workspace: WorkbenchPerformanceWorkspace,
  period: string,
  detailBasis: string,
  asOfDate: string
) {
  return [
    { label: "Portfolio", value: workspace.portfolio.portfolio_id },
    { label: "Period", value: period },
    { label: "Basis", value: detailBasis },
    { label: "Benchmark", value: workspace.benchmark_code ?? "Unassigned" },
    { label: "As of", value: formatDateValue(asOfDate) },
  ];
}

function buildRiskWorkspaceOverview({
  summary,
  concentration,
  drawdown,
  rolling,
  attribution,
  supportability,
}: {
  summary: WorkbenchRiskSummaryResponse;
  concentration: WorkbenchRiskConcentrationResponse;
  drawdown: WorkbenchRiskDrawdownResponse;
  rolling: WorkbenchRiskRollingResponse;
  attribution: WorkbenchRiskAttributionResponse | null;
  supportability: Array<{
    key: string;
    label: string;
    state: WorkbenchRiskModuleState;
    reason?: string | null;
  }>;
}): PerformanceRiskOverviewItem[] {
  const supportabilityPosture = resolveRiskEvidencePosture(supportability, [
    summary.state,
    concentration.state,
    drawdown.state,
    rolling.state,
    attribution?.state ?? "unavailable",
  ]);

  return [
    {
      key: "realized_volatility",
      label: "Realised volatility",
      ...resolveRiskSnapshotOverview(summary),
    },
    {
      key: "max_drawdown",
      label: "Max drawdown",
      ...resolveDrawdownOverviewEvidence(drawdown),
    },
    {
      key: "largest_position",
      label: "Largest position",
      ...resolveConcentrationOverviewEvidence(concentration),
    },
    {
      key: "source_coverage",
      label: "Source coverage",
      value: supportabilityPosture.label,
      support: supportabilityPosture.support,
      tone: supportabilityPosture.tone,
    },
  ];
}

function resolveRiskSnapshotOverview(response: WorkbenchRiskSummaryResponse): Pick<
  PerformanceRiskOverviewItem,
  "value" | "support" | "tone"
> {
  const period = response.payload?.periods[0];
  if (!period) {
    return {
      value: "Unavailable",
      support: "No source-confirmed volatility measure is available.",
      tone: "warn",
    };
  }

  const volatility = period.metrics.find((metric) => metric.key === "VOLATILITY");
  if (
    !volatility ||
    typeof volatility.value !== "number" ||
    volatility.state === "unavailable" ||
    volatility.state === "blocked"
  ) {
    return {
      value: "Unavailable",
      support: volatility?.reason ?? "No source-confirmed volatility measure is available.",
      tone: "warn",
    };
  }

  return {
    value: formatPercent(volatility.value),
    support:
      volatility.state === "partial"
        ? `${period.label}: ${volatility.reason ?? "Source coverage is partial for this annualised measure."}`
        : `${period.label} annualised source measure`,
    tone: volatility.state === "partial" ? "warn" : "default",
  };
}

function resolveDrawdownOverviewEvidence(response: WorkbenchRiskDrawdownResponse): Pick<
  PerformanceRiskOverviewItem,
  "value" | "support" | "tone"
> {
  const period = response.payload?.periods[0];
  const summary = period?.summary;
  const sourceEvidence = response.supportability.find((item) => item.key === "portfolio_returns");
  const sourceState = sourceEvidence?.state ?? response.state;
  if (
    !summary ||
    typeof summary.max_drawdown !== "number" ||
    sourceState === "blocked" ||
    sourceState === "unavailable"
  ) {
    return {
      value: "Unavailable",
      support: sourceEvidence?.reason ?? "No source-confirmed drawdown measure is available.",
      tone: "warn",
    };
  }
  const recoverySupport = summary.is_recovered
    ? "Recovered before period end"
    : "Still below the prior peak at period end";
  return {
    value: formatRiskPercentValue(summary.max_drawdown),
    support:
      sourceState === "partial"
        ? `${recoverySupport}. ${sourceEvidence?.reason ?? "Source coverage is partial for this drawdown measure."}`
        : recoverySupport,
    tone: sourceState === "partial" ? "warn" : "default",
  };
}

function resolveConcentrationOverviewEvidence(
  response: WorkbenchRiskConcentrationResponse,
): Pick<PerformanceRiskOverviewItem, "value" | "support" | "tone"> {
  const concentration = response.payload?.single_position_concentration;
  const sourceEvidence = response.supportability.find((item) => item.key === "portfolio_positions");
  const sourceState = sourceEvidence?.state ?? response.state;
  if (
    !concentration ||
    sourceState === "blocked" ||
    sourceState === "unavailable"
  ) {
    return {
      value: "Unavailable",
      support: sourceEvidence?.reason ?? "No source-confirmed largest position is available.",
      tone: "warn",
    };
  }

  const driver =
    concentration.top_position_current.security_name ??
    concentration.top_position_current.security_id ??
    "Source-identified holding";
  return {
    value: formatRiskPercentValue(concentration.top_position_weight_current),
    support:
      sourceState === "partial"
        ? `${driver}. ${sourceEvidence?.reason ?? "Source coverage is partial for this largest-position measure."}`
        : driver,
    tone: sourceState === "partial" ? "warn" : "default",
  };
}

function resolveRiskEvidencePosture(
  supportability: Array<{
    key: string;
    label: string;
    state: WorkbenchRiskModuleState;
    reason?: string | null;
  }>,
  moduleStates: WorkbenchRiskModuleState[]
) {
  const blockedOrUnavailable = supportability.filter(
    (item) => item.state === "blocked" || item.state === "unavailable"
  );
  const partial = supportability.filter((item) => item.state === "partial");

  if (!supportability.length || moduleStates.every((state) => state === "unavailable")) {
    return {
      label: "Unavailable",
      support: "Gateway evidence is not available for the selected risk review.",
      tone: "danger" as const,
    };
  }
  if (
    !blockedOrUnavailable.length &&
    !partial.length &&
    moduleStates.every((state) => state === "ready")
  ) {
    return {
      label: "Ready",
      support: "Cross-panel evidence is complete enough for first-line review.",
      tone: "success" as const,
    };
  }
  return {
    label: "Partial",
    support:
      blockedOrUnavailable[0]?.reason ??
      partial[0]?.reason ??
      "Some supporting evidence should be qualified on first review.",
    tone: "warn" as const,
  };
}

function metric(
  key: string,
  label: string,
  value: number | null,
  state: WorkbenchRiskModuleState,
  details?: Record<string, unknown>
): WorkbenchRiskMetric {
  return { key, label, value, state, details };
}

const SNAPSHOT_HEADLINE_METRIC_KEYS = ["VOLATILITY", "SHARPE", "BETA", "TRACKING_ERROR"] as const;
const SNAPSHOT_SUPPORTING_METRIC_KEYS = ["INFORMATION_RATIO", "SORTINO", "VAR"] as const;
const SNAPSHOT_METRIC_LABELS: Readonly<Record<string, string>> = {
  VOLATILITY: "Volatility",
  SHARPE: "Sharpe",
  BETA: "Beta",
  TRACKING_ERROR: "Tracking error",
  INFORMATION_RATIO: "Information ratio",
  SORTINO: "Sortino",
  VAR: "Value at risk",
};

function mapSnapshotHeadlineMetrics(
  response: WorkbenchRiskSummaryResponse
): PerformanceRiskMetricCard[] {
  return partitionSnapshotMetricCards(response).headline;
}

function mapSnapshotSupportingMetrics(
  response: WorkbenchRiskSummaryResponse
): PerformanceRiskMetricCard[] {
  return partitionSnapshotMetricCards(response).supporting;
}

function partitionSnapshotMetricCards(response: WorkbenchRiskSummaryResponse): {
  headline: PerformanceRiskMetricCard[];
  supporting: PerformanceRiskMetricCard[];
} {
  const metrics = response.payload?.periods[0]?.metrics ?? [];
  const metricCards = metrics.map(mapSnapshotMetricCard);
  const byKey = new Map(metricCards.map((metricCard) => [metricCard.key, metricCard]));

  const headline = SNAPSHOT_HEADLINE_METRIC_KEYS.map((key) => byKey.get(key)).filter(
    (metric): metric is PerformanceRiskMetricCard => Boolean(metric)
  );
  const supportingPriority = SNAPSHOT_SUPPORTING_METRIC_KEYS.map((key) => byKey.get(key)).filter(
    (metric): metric is PerformanceRiskMetricCard => Boolean(metric)
  );
  const supportingRemainder = metricCards.filter(
    (metric) =>
      !SNAPSHOT_HEADLINE_METRIC_KEYS.includes(metric.key as (typeof SNAPSHOT_HEADLINE_METRIC_KEYS)[number]) &&
      !SNAPSHOT_SUPPORTING_METRIC_KEYS.includes(metric.key as (typeof SNAPSHOT_SUPPORTING_METRIC_KEYS)[number])
  );

  return {
    headline,
    supporting: [...supportingPriority, ...supportingRemainder],
  };
}

function mapSnapshotMetricCard(item: WorkbenchRiskMetric): PerformanceRiskMetricCard {
  return {
    key: item.key,
    label: SNAPSHOT_METRIC_LABELS[item.key] ?? item.label,
    value: item.state === "ready" || item.state === "partial" ? formatRiskMetric(item) : "N/A",
    support: describeSnapshotMetric(item),
    definition: defineSnapshotMetric(item),
    state: resolveMetricState(item.state),
  };
}

function mapSnapshotContextRows(
  response: WorkbenchRiskSummaryResponse
): PerformanceRiskContextRow[] {
  const period = response.payload?.periods[0];
  if (!period) {
    return [];
  }
  return [
    {
      key: "portfolio_observations",
      label: "Portfolio observations",
      value: formatInteger(period.portfolio_observation_count),
      support: "Return observations backing the realised risk reading.",
    },
    {
      key: "benchmark_observations",
      label: "Benchmark observations",
      value: formatInteger(period.benchmark_observation_count),
      support:
        period.benchmark_context?.reason === "APPLIED"
          ? `${formatInteger(period.aligned_benchmark_observation_count)} aligned observations used for beta, tracking error, and information ratio.`
          : period.benchmark_context?.reason
            ? `Relative risk is currently ${formatEnumLabel(period.benchmark_context.reason)?.toLowerCase()}.`
            : "Relative risk is not being applied for this selection.",
    },
    {
      key: "benchmark_context",
      label: "Benchmark context",
      value: formatEnumLabel(period.benchmark_context?.reason) ?? "Not requested",
      support:
        period.benchmark_context?.requested_metrics?.length
          ? `Requested relative measures: ${period.benchmark_context.requested_metrics.join(", ")}.`
          : "No benchmark-relative measures requested.",
    },
  ];
}

function describeSnapshotMetric(metric: WorkbenchRiskMetric): string {
  if (metric.state !== "ready") {
    if (
      metric.key === "BETA" ||
      metric.key === "TRACKING_ERROR" ||
      metric.key === "INFORMATION_RATIO"
    ) {
      return metric.reason ?? "Benchmark-relative risk requires benchmark context.";
    }
    return metric.reason ?? "Not available for the current portfolio context.";
  }

  switch (metric.key) {
    case "VOLATILITY":
      return "Overall realised risk level of the portfolio over the selected period.";
    case "SHARPE":
      return "Return earned for each unit of total risk taken.";
    case "BETA":
      return "Sensitivity of the portfolio to benchmark market moves.";
    case "TRACKING_ERROR":
      return "Amount of active risk taken relative to the benchmark.";
    case "INFORMATION_RATIO":
      return "Efficiency of active risk taken versus the benchmark.";
    case "SORTINO":
      return "Return earned per unit of downside volatility.";
    case "VAR": {
      const expectedShortfall = formatRiskExpectedShortfall(metric.details);
      return expectedShortfall
        ? `Estimated downside at the configured confidence level. Expected shortfall ${expectedShortfall}.`
        : "Estimated downside at the configured confidence level.";
    }
    default:
      return metric.reason ?? "Risk measure available for the selected portfolio context.";
  }
}

function defineSnapshotMetric(metric: WorkbenchRiskMetric): string {
  switch (metric.key) {
    case "VOLATILITY":
      return "Annualised realised volatility of portfolio returns over the selected period.";
    case "SHARPE":
      return "Portfolio excess return per unit of realised volatility.";
    case "BETA":
      return "Sensitivity of portfolio returns relative to the assigned benchmark.";
    case "TRACKING_ERROR":
      return "Realised standard deviation of active returns versus the benchmark.";
    case "INFORMATION_RATIO":
      return "Active return earned per unit of tracking error.";
    case "SORTINO":
      return "Return delivered per unit of downside volatility.";
    case "VAR":
      return "Value at risk estimates the configured downside threshold over the selected horizon and confidence level.";
    default:
      return metric.reason ?? "Risk measure definition unavailable.";
  }
}

function formatRiskExpectedShortfall(details: Record<string, unknown> | null | undefined): string | null {
  const expectedShortfall = details?.expected_shortfall;
  return typeof expectedShortfall === "number"
    ? formatRiskPercentValue(expectedShortfall)
    : null;
}

function mapConcentrationIndicators(
  response: WorkbenchRiskConcentrationResponse
): PerformanceRiskConcentrationIndicator[] {
  const payload = response.payload;
  if (!payload) {
    return [];
  }
  const coverageTone = resolveConcentrationIndicatorTone(response.supportability);
  return [
    {
      key: "portfolio_hhi",
      label: "Portfolio concentration index",
      value: formatNumber(payload.portfolio_concentration.hhi_current, { maximumFractionDigits: 0 }),
      support: "Position-level concentration across the live book",
      definition:
        "Herfindahl-Hirschman Index for the current portfolio. Higher values indicate exposure concentrated in fewer holdings.",
    },
    {
      key: "issuer_hhi",
      label: "Issuer concentration index",
      value: formatNumber(payload.issuer_concentration.hhi_current, { maximumFractionDigits: 0 }),
      support: "Issuer-level concentration after grouping",
      definition:
        "Concentration index after holdings are grouped at issuer level using the configured enrichment and grouping policy.",
      tone: coverageTone,
    },
    {
      key: "top_position_weight",
      label: "Largest position weight",
      value: formatRiskPercentValue(payload.single_position_concentration.top_position_weight_current),
      support: "Weight of the largest single holding",
      definition: "Weight of the single largest holding in the current portfolio.",
      tone: "neutral",
    },
    {
      key: "top_issuer_weight",
      label: "Largest issuer weight",
      value: formatRiskPercentValue(payload.issuer_concentration.top_issuer_weight_current),
      support: "Aggregated exposure to the largest issuer group",
      definition: "Combined weight of all holdings mapped to the largest issuer group.",
      tone: coverageTone,
    },
    {
      key: "top_n_cumulative",
      label: `Top ${payload.single_position_concentration.top_n} weight`,
      value: formatRiskPercentValue(
        payload.single_position_concentration.top_n_cumulative_weight_current
      ),
      support: "Cumulative weight of the 10 largest holdings",
      definition: "Cumulative portfolio weight of the 10 largest holdings.",
      tone: "neutral",
    },
  ];
}

function mapConcentrationContextRows(
  response: WorkbenchRiskConcentrationResponse
): PerformanceRiskConcentrationContextRow[] {
  const payload = response.payload;
  if (!payload) {
    return [];
  }
  const executionContext = payload.execution_context;
  const valuationContext = payload.valuation_context;
  const currentTopPosition = payload.single_position_concentration.top_position_current;
  const proposedTopPosition = payload.single_position_concentration.top_position_proposed;
  return [
    {
      key: "top_position_methodology",
      label: "Top position methodology",
      value: "TOP_POSITION_WEIGHT",
      definition:
        "Source-owned concentration methodology from lotus-risk ConcentrationRiskReport:v1.",
      support:
        "Gateway and Workbench render returned top-position weights and drivers without recalculating them.",
    },
    {
      key: "top_position_driver",
      label: "Top position driver",
      value: formatConcentrationPositionDriverLabel(currentTopPosition),
      definition:
        "Current largest-position driver returned by the source concentration report.",
      support: buildTopPositionDriverSupport({
        currentDriver: currentTopPosition,
        proposedDriver: proposedTopPosition,
        delta: payload.single_position_concentration.top_position_weight_delta,
      }),
    },
    {
      key: "issuer_coverage",
      label: "Issuer coverage",
      value: formatRiskPercentValue(payload.issuer_concentration.coverage_ratio_current),
      definition:
        "Share of positions with issuer mapping sufficient for issuer-level concentration analysis.",
      support: `${payload.issuer_concentration.covered_position_count_current}/${payload.issuer_concentration.total_position_count_current} positions mapped for issuer analysis`,
    },
    {
      key: "grouping_level",
      label: "Grouping level",
      value: formatEnumLabel(executionContext?.issuer_grouping_level) ?? "N/A",
      definition: "Issuer grouping level used to aggregate exposures for concentration review.",
      support: "Aggregation level used for issuer groups",
    },
    {
      key: "enrichment_policy",
      label: "Enrichment policy",
      value: formatEnumLabel(executionContext?.enrichment_policy) ?? "N/A",
      definition:
        "Policy used to combine caller-supplied mapping and core enrichment when forming issuer groups.",
      support: "Caller and core mapping merge posture",
    },
    {
      key: "weight_basis",
      label: "Weight basis",
      value: formatEnumLabel(valuationContext?.weight_basis) ?? "N/A",
      definition: "Portfolio denominator used to calculate concentration weights.",
      support: "Denominator used for weight calculations",
    },
    {
      key: "reporting_currency",
      label: PORTFOLIO_CURRENCY_LABELS.reporting,
      value: valuationContext?.reporting_currency ?? "N/A",
      definition: "Reporting currency used for the current concentration review.",
      support: buildConcentrationCurrencySupport(
        valuationContext?.reporting_currency,
        valuationContext?.portfolio_currency,
      ),
    },
  ];
}

function buildConcentrationCurrencySupport(
  reportingCurrency?: string | null,
  baseCurrency?: string | null,
): string {
  if (!baseCurrency) {
    return `${PORTFOLIO_CURRENCY_LABELS.base} not reported by the source`;
  }
  if (!reportingCurrency) {
    return `${PORTFOLIO_CURRENCY_LABELS.base} ${baseCurrency}; reporting currency not reported by the source`;
  }
  return reportingCurrency === baseCurrency
    ? `Same as ${PORTFOLIO_CURRENCY_LABELS.base.toLowerCase()} (${baseCurrency})`
    : `${PORTFOLIO_CURRENCY_LABELS.base} ${baseCurrency}`;
}

function formatConcentrationPositionDriverLabel(driver: {
  security_id?: string | null;
  security_name?: string | null;
}) {
  return driver.security_name ?? driver.security_id ?? "N/A";
}

function buildTopPositionDriverSupport({
  currentDriver,
  proposedDriver,
  delta,
}: {
  currentDriver: {
    security_id?: string | null;
    security_name?: string | null;
    weight: number;
  };
  proposedDriver: {
    security_id?: string | null;
    security_name?: string | null;
    weight: number;
  };
  delta: number;
}) {
  const currentLabel = formatConcentrationPositionDriverLabel(currentDriver);
  const proposedLabel = formatConcentrationPositionDriverLabel(proposedDriver);
  return `Current ${currentLabel} ${formatRiskPercentValue(
    currentDriver.weight
  )}; proposed ${proposedLabel} ${formatRiskPercentValue(
    proposedDriver.weight
  )}; source delta ${formatSignedRiskPercentValue(delta)}.`;
}

function mapDrawdownHeadlineMetrics(
  response: WorkbenchRiskDrawdownResponse
): PerformanceRiskMetricCard[] {
  const period = response.payload?.periods[0];
  const summary = period?.summary;
  if (!period || !summary) {
    return [];
  }
  const relative = period.relative_to_benchmark;
  const recoveryStatus =
    relative?.is_recovered === true
      ? "Recovered"
      : relative?.is_recovered === false
        ? "Open"
        : summary.is_recovered === true
          ? "Recovered"
          : summary.is_recovered === false
            ? "Open"
            : "N/A";
  return [
    {
      key: "max_drawdown",
      label: "Max drawdown",
      value: formatDrawdownPercent(summary.max_drawdown),
      support: describeDrawdownHeadlineMetric("max_drawdown", response, period),
      definition: "Largest realised peak-to-trough decline over the selected window.",
      state: resolveModuleState(response.state),
    },
    {
      key: "relative_max_drawdown",
      label: "Relative max drawdown",
      value: relative ? formatDrawdownPercent(relative.max_drawdown) : "N/A",
      support: describeDrawdownHeadlineMetric("relative_max_drawdown", response, period),
      definition:
        "Largest drawdown in active performance versus the benchmark over the selected window.",
      state: relative ? resolveModuleState(response.state) : "unavailable",
    },
    {
      key: "time_under_water_days",
      label: "Time under water",
      value: formatInteger(relative?.time_under_water_days ?? summary.time_under_water_days),
      support: describeDrawdownHeadlineMetric("time_under_water_days", response, period),
      definition: "Number of business days the portfolio remained below its prior peak.",
      state: resolveModuleState(response.state),
    },
    {
      key: "recovery_status",
      label: "Recovery status",
      value: recoveryStatus,
      support: describeDrawdownHeadlineMetric("recovery_status", response, period),
      definition: "Whether the worst drawdown had recovered by the end of the selected window.",
      state: resolveModuleState(response.state),
    },
  ];
}

function mapDrawdownSupportingMetrics(
  response: WorkbenchRiskDrawdownResponse
): PerformanceRiskMetricCard[] {
  const summary = response.payload?.periods[0]?.summary;
  if (!summary) {
    return [];
  }

  return [
    {
      key: "ulcer_index",
      label: "Ulcer index",
      value: formatDrawdownPercent(summary.ulcer_index),
      support: "Shows how persistent and painful the underwater path was, not just how deep it got.",
      definition:
        "Path-sensitive drawdown measure that reflects both drawdown depth and time spent underwater.",
      state: resolveModuleState(response.state),
    },
  ];
}

function mapDrawdownContextRows(
  response: WorkbenchRiskDrawdownResponse
): PerformanceRiskContextRow[] {
  const period = response.payload?.periods[0];
  const analysisContext = response.payload?.analysis_context;
  if (!period) {
    return [];
  }
  return [
    {
      key: "portfolio_observations",
      label: "Portfolio observations",
      value: formatInteger(period.portfolio_observation_count),
      support: "Observation count supporting the realised loss-path review.",
    },
    {
      key: "benchmark_relative_review",
      label: "Benchmark-relative review",
      value: formatEnumLabel(period.relative_to_benchmark_context?.reason) ?? "Not requested",
      support:
        period.relative_to_benchmark_context?.applied
          ? `${formatInteger(period.relative_to_benchmark_context.aligned_observation_count)} aligned observations support relative drawdown.`
          : "Relative drawdown is not active for this selection.",
    },
    {
      key: "duration_unit",
      label: "Duration unit",
      value: formatEnumLabel(analysisContext?.duration_unit) ?? "Business Days",
      support: "Unit used for time-under-water and episode duration.",
    },
  ];
}

function mapDrawdownEpisodeInterpretation(
  response: WorkbenchRiskDrawdownResponse
): { title: string; body: string } | null {
  const period = response.payload?.periods[0];
  const summary = period?.summary;
  const episodes = period?.episodes ?? [];
  if (!period || !summary) {
    return null;
  }

  if (!episodes.length) {
    return {
      title: "No retained drawdown episodes",
      body:
        typeof summary.max_drawdown === "number" && summary.max_drawdown < 0
          ? "The portfolio did experience a loss path, but no episode met the retained episode policy for this window."
          : "The selected window did not produce a retained peak-to-trough loss interval, which indicates drawdown remained controlled over this review period.",
    };
  }
  return null;
}

function mapDrawdownEpisodes(response: WorkbenchRiskDrawdownResponse) {
  const episodes = response.payload?.periods[0]?.episodes ?? [];
  return episodes.map((episode) => ({
    key: episode.episode_id,
    episode: episode.episode_id.toUpperCase(),
    depth: formatDrawdownPercent(episode.depth),
    peakDate: formatDateValue(episode.peak_date),
    troughDate: formatDateValue(episode.trough_date),
    recoveryDate: episode.recovery_date ? formatDateValue(episode.recovery_date) : "Open",
    totalDays: formatInteger(episode.total_days),
    status: episode.is_recovered ? "Recovered" : "Open",
  }));
}

function mapRelativeDrawdownMetric(response: WorkbenchRiskDrawdownResponse) {
  const relative = response.payload?.periods[0]?.relative_to_benchmark;
  const supportability = response.supportability.find(
    (item) => item.key === "benchmark_relative_drawdown"
  );
  if (!relative && !supportability) {
    return null;
  }
  return {
    label: "Relative max drawdown",
    value: relative ? formatDrawdownPercent(relative.max_drawdown) : "N/A",
    support:
      supportability?.reason ??
      (relative
        ? `${formatDateValue(relative.max_drawdown_peak_date ?? "")} to ${formatDateValue(
            relative.max_drawdown_trough_date ?? ""
          )}`
        : "Benchmark-relative drawdown not available."),
    state: resolveMetricState(supportability?.state ?? "unavailable"),
  };
}

function mapUnderwaterSeries(response: WorkbenchRiskDrawdownResponse | null) {
  const points = response?.payload?.periods[0]?.underwater_series ?? [];
  return points.map((point) => ({
    key: `${point.date}-${point.drawdown}`,
    date: formatDateValue(point.date),
    drawdown: formatDrawdownPercent(point.drawdown),
  }));
}

function resolveUnderwaterDetailState({
  drawdown,
  drawdownDetail,
  isDrawdownDetailLoading,
}: {
  drawdown: WorkbenchRiskDrawdownResponse;
  drawdownDetail: WorkbenchRiskDrawdownResponse | null;
  isDrawdownDetailLoading: boolean;
}): "idle" | "loading" | "ready" | "unavailable" {
  if (isDrawdownDetailLoading) {
    return "loading";
  }
  if (drawdownDetail?.payload?.periods[0]?.underwater_series?.length) {
    return "ready";
  }
  if (drawdownDetail?.state === "unavailable") {
    return "unavailable";
  }
  const supportability = drawdown.supportability.find((item) => item.key === "underwater_series");
  return supportability?.state === "unavailable" ? "unavailable" : "idle";
}

function mapRollingWindows(
  rolling: WorkbenchRiskRollingResponse,
  rollingDetail: WorkbenchRiskRollingResponse | null
): PerformanceRiskRollingWindow[] {
  const summaryWindows = rolling.payload?.periods[0]?.window_results ?? [];
  const detailWindows = new Map(
    (rollingDetail?.payload?.periods[0]?.window_results ?? []).map((window) => [
      window.window_length,
      window,
    ])
  );

  return summaryWindows.map((window) => {
    const detailWindow = detailWindows.get(window.window_length) ?? null;
    const metricKeys = orderRollingMetricKeys(
      Array.from(
        new Set([
          ...Object.keys(window.metric_summaries),
          ...Object.keys(detailWindow?.metric_summaries ?? {}),
        ])
      )
    );
    const headlineMetricInterpretations = metricKeys.map((metricKey) => {
      const summary = window.metric_summaries[metricKey];
      return {
        key: `${window.window_length}-${metricKey}`,
        label: resolveRollingMetricLabel(metricKey),
        value: formatRollingMetricSummaryValue(metricKey, summary?.latest ?? null),
        support: buildRollingHeadlineInterpretation(metricKey, summary),
        metadata: buildRollingMetricMetadata(metricKey, summary),
        definition: describeRollingMetric(metricKey),
        state: summary ? ("ready" as PerformanceRiskState) : ("unavailable" as PerformanceRiskState),
      };
    });
    const detailRowInterpretations = metricKeys
      .map((metricKey) => {
        const summary = window.metric_summaries[metricKey];
        return {
          key: `${window.window_length}-${metricKey}`,
          metric: resolveRollingMetricLabel(metricKey),
          current: formatRollingMetricSummaryValue(metricKey, summary?.latest ?? null),
          typical: formatRollingMetricSummaryValue(metricKey, summary?.average ?? null),
          range: buildRollingObservedRange(metricKey, summary),
          interpretation: buildRollingDetailInterpretation(metricKey, summary),
          currentPositionPct: mapRollingRangePosition(summary?.latest ?? null, summary),
          typicalPositionPct: mapRollingRangePosition(summary?.average ?? null, summary),
        };
      })
      .filter((row) => shouldDisplayRollingMetricRow(row.metric, row.current));
    return {
      key: String(window.window_length),
      label: buildRollingWindowLabel(window.window_length),
      horizonLabel: resolveRollingWindowHorizonLabel(window.window_length),
      selectedWindowSummary: buildRollingWindowReview(window.window_length, window.metric_summaries),
      detailRowInterpretations,
      headlineMetrics: headlineMetricInterpretations,
      detailRows: detailRowInterpretations,
      seriesRows: mapRollingSeriesRows(detailWindow?.metric_series ?? []),
      seriesMetricKeys: metricKeys,
    };
  });
}

function resolveRollingDetailState({
  rolling,
  rollingDetail,
  isRollingDetailLoading,
}: {
  rolling: WorkbenchRiskRollingResponse;
  rollingDetail: WorkbenchRiskRollingResponse | null;
  isRollingDetailLoading: boolean;
}): "idle" | "loading" | "ready" | "unavailable" {
  if (isRollingDetailLoading) {
    return "loading";
  }
  if (
    rollingDetail?.payload?.periods[0]?.window_results?.some(
      (window) => (window.metric_series?.length ?? 0) > 0
    )
  ) {
    return "ready";
  }
  if (rollingDetail?.state === "unavailable") {
    return "unavailable";
  }
  const supportability = rolling.supportability.find((item) => item.key === "rolling_time_series");
  return supportability?.state === "unavailable" ? "unavailable" : "idle";
}

function mapRollingSeriesRows(
  series: RiskRollingPayload["periods"][number]["window_results"][number]["metric_series"]
) {
  return (series ?? []).map((point) => ({
    key: point.date,
    date: formatDateValue(point.date),
    values: Object.fromEntries(
      Object.entries(point.metric_values).map(([metricKey, value]) => [
        metricKey,
        formatRollingMetricSummaryValue(metricKey, value),
      ])
    ),
  }));
}

function buildRollingWindowLabel(windowLength: number) {
  return `${windowLength}D`;
}

function resolveRollingWindowHorizonLabel(windowLength: number) {
  if (windowLength <= 21) {
    return "Short window";
  }
  if (windowLength <= 63) {
    return "Near-term window";
  }
  if (windowLength <= 126) {
    return "Medium window";
  }
  return "Annual window";
}

function resolveRollingMetricLabel(metricKey: string) {
  switch (metricKey) {
    case "ROLLING_VOLATILITY":
      return "Volatility";
    case "ROLLING_MAX_DRAWDOWN":
      return "Max drawdown";
    case "ROLLING_SHARPE":
      return "Sharpe";
    case "ROLLING_BETA":
      return "Beta";
    case "ROLLING_TRACKING_ERROR":
      return "Tracking error";
    case "ROLLING_INFORMATION_RATIO":
      return "Information ratio";
    default:
      return metricKey.replaceAll("_", " ");
  }
}

function formatRiskMetric(metric: WorkbenchRiskMetric) {
  if (typeof metric.value !== "number") {
    return "N/A";
  }
  if (["VOLATILITY", "TRACKING_ERROR", "VAR"].includes(metric.key)) {
    return formatPercent(metric.value);
  }
  return formatNumber(metric.value, { maximumFractionDigits: 2 });
}

function formatDrawdownPercent(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "N/A";
  }
  return formatPercent(value * 100);
}

function formatRiskPercentValue(
  value: number | null | undefined,
  {
    nullDisplay = "N/A",
    minimumFractionDigits = 2,
    maximumFractionDigits = minimumFractionDigits,
  }: {
    nullDisplay?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {}
) {
  if (typeof value !== "number") {
    return nullDisplay;
  }
  const normalizedValue = Math.abs(value) <= 1 ? value * 100 : value;
  return formatPercent(normalizedValue, {
    nullDisplay,
    minimumFractionDigits,
    maximumFractionDigits,
  });
}

function formatSignedRiskPercentValue(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "N/A";
  }
  const formatted = formatRiskPercentValue(value);
  return value > 0 ? `+${formatted}` : formatted;
}

function describeDrawdownHeadlineMetric(
  key: "max_drawdown" | "relative_max_drawdown" | "time_under_water_days" | "recovery_status",
  response: WorkbenchRiskDrawdownResponse,
  period: NonNullable<WorkbenchRiskDrawdownResponse["payload"]>["periods"][number]
): string {
  const summary = period.summary;
  const relative = period.relative_to_benchmark;
  if (!summary) {
    return "Drawdown summary unavailable.";
  }
  switch (key) {
    case "max_drawdown":
      return buildDrawdownDateRange(summary);
    case "relative_max_drawdown":
      return relative
        ? buildRelativeDrawdownDateRange(relative)
        : response.supportability.find((item) => item.key === "benchmark_relative_drawdown")?.reason ??
            "Benchmark-relative review unavailable.";
    case "time_under_water_days":
      return "Business days the portfolio remained below its prior peak.";
    case "recovery_status":
      return summary.is_recovered
        ? "Worst drawdown recovered before period end."
        : "Worst drawdown was still open at period end.";
  }
}

function buildRelativeDrawdownDateRange(
  relative: NonNullable<WorkbenchRiskDrawdownResponse["payload"]>["periods"][number]["relative_to_benchmark"]
) {
  if (!relative?.max_drawdown_peak_date || !relative.max_drawdown_trough_date) {
    return "Benchmark-relative timing unavailable";
  }
  return `${formatDateValue(relative.max_drawdown_peak_date)} to ${formatDateValue(
    relative.max_drawdown_trough_date
  )}`;
}

function mapRollingContextRows(
  response: WorkbenchRiskRollingResponse
): PerformanceRiskContextRow[] {
  const period = response.payload?.periods[0];
  const requestContext = response.payload?.request_context;
  if (!period) {
    return [];
  }
  const rows: PerformanceRiskContextRow[] = [
    {
      key: "window_coverage",
      label: "Window set",
      value: `${formatInteger(period.window_count_emitted)} / ${formatInteger(period.window_count_requested)}`,
      support: `${(period.window_lengths_emitted ?? []).join(", ")} day windows emitted.`,
    },
    {
      key: "benchmark_dependency",
      label: "Benchmark alignment",
      value: formatEnumLabel(period.benchmark_context?.reason) ?? "Not requested",
      support:
        period.benchmark_context?.requested
          ? "Aligned benchmark observations support beta and tracking error review."
          : "Benchmark-relative review is not active for this request.",
    },
    {
      key: "risk_free_dependency",
      label: "Risk-free alignment",
      value: formatEnumLabel(period.risk_free_context?.reason) ?? "Not requested",
      support:
        period.risk_free_context?.requested
          ? "Aligned risk-free observations support Sharpe review."
          : "Sharpe review is not active for this request.",
    },
    {
      key: "rolling_methodology",
      label: "Methodology",
      value: `${formatInteger(requestContext?.annualization_basis)} / ${formatEnumLabel(requestContext?.min_observations_policy) ?? "Strict"}`,
      support: `${formatEnumLabel(requestContext?.alignment_policy) ?? "Inner Join"} alignment policy.`,
    },
  ];

  const notes = new Map<
    string,
    PerformanceRiskContextRow
  >();

  for (const flag of period.quality_flags ?? []) {
    if (flag === "metric:ROLLING_BETA:benchmark_variance_zero") {
      notes.set(flag, {
        key: flag,
        label: "Benchmark-relative review",
        value: "Qualified",
        support:
          "Benchmark variance was limited in one emitted window, so beta may be less informative for that horizon.",
      });
      continue;
    }

    notes.set(flag, {
      key: flag,
      label: "Window caution",
      value: "Qualified",
      support: "Some rolling measures may be less informative for the selected horizon.",
    });
  }

  if (period.benchmark_context?.requested && period.benchmark_context.reason !== "APPLIED") {
    notes.set("benchmark_alignment", {
      key: "benchmark_alignment",
      label: "Benchmark-relative review",
      value: "Qualified",
      support:
        "Benchmark alignment is not fully ready across the selected horizon, so beta and tracking error should be read with caution.",
    });
  }

  if (period.risk_free_context?.requested && period.risk_free_context.reason !== "APPLIED") {
    notes.set("risk_free_alignment", {
      key: "risk_free_alignment",
      label: "Sharpe review",
      value: "Qualified",
      support:
        "Risk-free alignment is not fully ready across the selected horizon, so Sharpe should be treated as supporting context.",
    });
  }

  return [...rows, ...notes.values()];
}

function buildRollingWindowReview(
  windowLength: number,
  summaries: RiskRollingPayload["periods"][number]["window_results"][number]["metric_summaries"]
): { title: string; body: string } {
  const reviewSentences = [
    buildRollingWindowReviewSentence("ROLLING_VOLATILITY", summaries.ROLLING_VOLATILITY),
    buildRollingWindowReviewSentence("ROLLING_TRACKING_ERROR", summaries.ROLLING_TRACKING_ERROR),
    buildRollingWindowReviewSentence("ROLLING_BETA", summaries.ROLLING_BETA),
    buildRollingWindowReviewSentence("ROLLING_MAX_DRAWDOWN", summaries.ROLLING_MAX_DRAWDOWN),
  ].filter(Boolean);
  return {
    title: `${buildRollingWindowLabel(windowLength)} selected-window review`,
    body:
      reviewSentences.slice(0, 3).join(" ") ||
      "Selected-window rolling diagnostics are not available for this horizon.",
  };
}

function buildRollingObservedRange(
  metricKey: string,
  summary:
    | RiskRollingPayload["periods"][number]["window_results"][number]["metric_summaries"][string]
    | undefined
) {
  if (!summary) {
    return "N/A";
  }
  return `${formatRollingMetricSummaryValue(metricKey, summary.p05)} to ${formatRollingMetricSummaryValue(metricKey, summary.p95)}`;
}

function mapRollingRangePosition(
  value: number | null | undefined,
  summary:
    | RiskRollingPayload["periods"][number]["window_results"][number]["metric_summaries"][string]
    | undefined
) {
  if (
    typeof value !== "number" ||
    typeof summary?.p05 !== "number" ||
    typeof summary?.p95 !== "number" ||
    summary.p05 === summary.p95
  ) {
    return null;
  }

  const min = Math.min(summary.p05, summary.p95);
  const max = Math.max(summary.p05, summary.p95);
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function buildRollingDetailInterpretation(
  metricKey: string,
  summary:
    | RiskRollingPayload["periods"][number]["window_results"][number]["metric_summaries"][string]
    | undefined
) {
  if (!summary) {
    return "Not returned for this window.";
  }
  if (isRollingRatioMetric(metricKey) && isRollingRatioUnstable(summary.latest)) {
    return "Current ratio is numerically unstable on this window.";
  }

  const latest = summary.latest;
  const average = summary.average;
  const p05 = summary.p05;
  const p95 = summary.p95;

  if (metricKey === "ROLLING_MAX_DRAWDOWN") {
    if (typeof latest !== "number") {
      return "Current drawdown reading unavailable.";
    }
    if (latest === 0) {
      return "No realised drawdown is showing in the current rolling window.";
    }
    if (typeof p05 === "number" && latest <= p05) {
      return "Current loss path is worse than the recent rolling norm.";
    }
    if (typeof p95 === "number" && latest >= p95) {
      return "Current loss path is shallower than recent rolling history.";
    }
    if (typeof average === "number" && latest < average) {
      return "Current loss path is modestly deeper than typical for this window.";
    }
    return "Current loss path is in line with recent rolling history.";
  }

  if (metricKey === "ROLLING_BETA") {
    if (typeof latest !== "number") {
      return "Current market sensitivity unavailable.";
    }
    if (latest < 0) {
      return "Recent market sensitivity is negative versus the longer-run norm.";
    }
    if (latest > 1.2) {
      return "Recent market sensitivity is running above benchmark pace.";
    }
    if (latest < 0.8) {
      return "Recent market sensitivity is running below benchmark pace.";
    }
    return "Recent market sensitivity is close to benchmark pace.";
  }

  if (typeof latest !== "number") {
    return "Current reading unavailable.";
  }
  if (typeof p95 === "number" && latest > p95) {
    return metricKey === "ROLLING_TRACKING_ERROR"
      ? "Current active risk is above the recent observed range."
      : "Current reading is above the recent observed range.";
  }
  if (typeof p05 === "number" && latest < p05) {
    return metricKey === "ROLLING_TRACKING_ERROR"
      ? "Current active risk is below the recent observed range."
      : "Current reading is below the recent observed range.";
  }
  if (typeof average === "number" && latest > average) {
    return metricKey === "ROLLING_TRACKING_ERROR"
      ? "Current active risk is above typical but still in range."
      : "Current reading is above typical but still in range.";
  }
  if (typeof average === "number" && latest < average) {
    return metricKey === "ROLLING_TRACKING_ERROR"
      ? "Current active risk is below typical and remains contained."
      : "Current reading is below typical and remains contained.";
  }
  return metricKey === "ROLLING_TRACKING_ERROR"
    ? "Current active risk is in line with recent rolling history."
    : "Current reading is in line with recent rolling history.";
}

function describeRollingMetric(metricKey: string) {
  switch (metricKey) {
    case "ROLLING_VOLATILITY":
      return "Observed variability of portfolio returns over the selected rolling window.";
    case "ROLLING_TRACKING_ERROR":
      return "Observed active risk versus the benchmark over the selected rolling window.";
    case "ROLLING_BETA":
      return "Sensitivity of portfolio returns to benchmark market moves over the selected rolling window.";
    case "ROLLING_MAX_DRAWDOWN":
      return "Worst peak-to-trough loss observed within the selected rolling window.";
    case "ROLLING_SHARPE":
      return "Excess return earned per unit of risk over the selected rolling window.";
    case "ROLLING_INFORMATION_RATIO":
      return "Active return earned per unit of tracking error over the selected rolling window.";
    default:
      return undefined;
  }
}

function buildRollingHeadlineInterpretation(
  metricKey: string,
  summary:
    | RiskRollingPayload["periods"][number]["window_results"][number]["metric_summaries"][string]
    | undefined
) {
  if (!summary) {
    return "Not returned for this rolling request.";
  }
  if (isRollingRatioMetric(metricKey) && isRollingRatioUnstable(summary.latest)) {
    return "Current ratio is numerically unstable on this window.";
  }
  if (metricKey === "ROLLING_MAX_DRAWDOWN" && summary.latest === 0) {
    return "No current rolling drawdown is showing";
  }
  if (metricKey === "ROLLING_BETA" && typeof summary.latest === "number" && summary.latest < 0) {
    return "Recent market sensitivity turned negative";
  }
  if (metricKey === "ROLLING_BETA") {
    if (
      typeof summary.latest === "number" &&
      typeof summary.average === "number" &&
      Math.abs(summary.latest - summary.average) >= 0.2
    ) {
      return "Market sensitivity changed meaningfully";
    }
    return "In line with recent market sensitivity";
  }
  if (typeof summary.latest === "number" && typeof summary.p95 === "number" && summary.latest > summary.p95) {
    return "Above recent typical range";
  }
  if (typeof summary.latest === "number" && typeof summary.p05 === "number" && summary.latest < summary.p05) {
    return "Below recent typical range";
  }
  if (typeof summary.latest === "number" && typeof summary.average === "number" && summary.latest > summary.average) {
    return "Above typical but still in range";
  }
  if (typeof summary.latest === "number" && typeof summary.average === "number" && summary.latest < summary.average) {
    return "Below typical and still contained";
  }
  if (metricKey === "ROLLING_MAX_DRAWDOWN") {
    return "In line with recent drawdown history";
  }
  return "In line with recent history";
}

function buildRollingMetricMetadata(
  metricKey: string,
  summary:
    | RiskRollingPayload["periods"][number]["window_results"][number]["metric_summaries"][string]
    | undefined
) {
  if (!summary) {
    return undefined;
  }
  return `Typical ${formatRollingMetricSummaryValue(metricKey, summary.average)} • Range ${buildRollingObservedRange(metricKey, summary)}`;
}

function buildRollingWindowReviewSentence(
  metricKey: string,
  summary:
    | RiskRollingPayload["periods"][number]["window_results"][number]["metric_summaries"][string]
    | undefined
) {
  if (!summary || typeof summary.latest !== "number") {
    return null;
  }

  switch (metricKey) {
    case "ROLLING_VOLATILITY":
      return `Current volatility is ${formatRollingMetricSummaryValue(metricKey, summary.latest)}, ${describeRollingVersusTypical(summary, "well below the recent typical", "above the recent typical", "close to the recent typical")}.`;
    case "ROLLING_TRACKING_ERROR":
      return `Tracking error is ${formatRollingMetricSummaryValue(metricKey, summary.latest)}, ${describeRollingVersusTypical(summary, "below the recent normal range", "above the recent normal range", "close to the recent norm")}.`;
    case "ROLLING_BETA":
      if (summary.latest < 0) {
        return "Beta is negative in the current window, which may indicate a short-term change in market sensitivity.";
      }
      return `Beta is ${formatRollingMetricSummaryValue(metricKey, summary.latest)} and ${describeRollingVersusTypical(summary, "below the recent norm", "above the recent norm", "close to the recent norm")}.`;
    case "ROLLING_MAX_DRAWDOWN":
      return summary.latest === 0
        ? "No current rolling drawdown is showing."
        : `Current rolling drawdown is ${formatRollingMetricSummaryValue(metricKey, summary.latest)} and ${describeRollingVersusTypical(summary, "deeper than the recent norm", "shallower than the recent norm", "in line with the recent norm")}.`;
    default:
      return null;
  }
}

function describeRollingVersusTypical(
  summary:
    | RiskRollingPayload["periods"][number]["window_results"][number]["metric_summaries"][string]
    | undefined,
  belowText: string,
  aboveText: string,
  inlineText: string
) {
  if (!summary || typeof summary.latest !== "number") {
    return "not available";
  }
  if (typeof summary.p05 === "number" && summary.latest < summary.p05) {
    return belowText;
  }
  if (typeof summary.p95 === "number" && summary.latest > summary.p95) {
    return aboveText;
  }
  if (typeof summary.average === "number" && summary.latest < summary.average) {
    return belowText;
  }
  if (typeof summary.average === "number" && summary.latest > summary.average) {
    return aboveText;
  }
  return inlineText;
}

function resolveConcentrationIndicatorTone(
  supportability: WorkbenchRiskConcentrationResponse["supportability"]
) {
  const issuerCoverage = supportability.find((item) => item.key === "issuer_enrichment");
  if (issuerCoverage?.state === "partial" || issuerCoverage?.state === "blocked") {
    return "warn" as const;
  }
  if (issuerCoverage?.state === "unavailable") {
    return "danger" as const;
  }
  return "neutral" as const;
}

function formatEnumLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatInteger(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "N/A";
  }
  return formatNumber(value, { maximumFractionDigits: 0 });
}

function formatRollingMetricSummaryValue(metricKey: string, value: number | null | undefined) {
  if (typeof value !== "number") {
    return "N/A";
  }
  if (isRollingRatioMetric(metricKey) && isRollingRatioUnstable(value)) {
    return "Unstable";
  }
  if (
    metricKey === "ROLLING_VOLATILITY" ||
    metricKey === "ROLLING_MAX_DRAWDOWN" ||
    metricKey === "ROLLING_TRACKING_ERROR"
  ) {
    return formatPercent(value * 100);
  }
  return formatNumber(value, { maximumFractionDigits: 2 });
}

function buildFixtureRollingMetricSummaries({
  windowLength,
  includeBenchmarkMetrics,
}: {
  windowLength: number;
  includeBenchmarkMetrics: boolean;
}) {
  const volatilityBase = 0.109 + windowLength / 5000;
  const maxDrawdownBase = -0.017 - windowLength / 5000;
  const summaries: Record<
    string,
    {
      latest: number | null;
      average: number | null;
      minimum: number | null;
      maximum: number | null;
      p05: number | null;
      p50: number | null;
      p95: number | null;
    }
  > = {
    ROLLING_VOLATILITY: {
      latest: volatilityBase,
      average: volatilityBase - 0.008,
      minimum: volatilityBase - 0.026,
      maximum: volatilityBase + 0.021,
      p05: volatilityBase - 0.02,
      p50: volatilityBase - 0.004,
      p95: volatilityBase + 0.018,
    },
    ROLLING_MAX_DRAWDOWN: {
      latest: maxDrawdownBase,
      average: maxDrawdownBase + 0.005,
      minimum: maxDrawdownBase - 0.02,
      maximum: maxDrawdownBase + 0.011,
      p05: maxDrawdownBase - 0.016,
      p50: maxDrawdownBase + 0.003,
      p95: maxDrawdownBase + 0.009,
    },
    ROLLING_SHARPE: {
      latest: 0.74 + windowLength / 1000,
      average: 0.68 + windowLength / 1000,
      minimum: 0.31 + windowLength / 1200,
      maximum: 1.14 + windowLength / 900,
      p05: 0.42 + windowLength / 1200,
      p50: 0.71 + windowLength / 1000,
      p95: 1.02 + windowLength / 900,
    },
  };
  if (includeBenchmarkMetrics) {
    summaries.ROLLING_BETA = {
      latest: 0.91 + windowLength / 5000,
      average: 0.88 + windowLength / 5000,
      minimum: 0.74,
      maximum: 1.08,
      p05: 0.78,
      p50: 0.89,
      p95: 1.02,
    };
    summaries.ROLLING_TRACKING_ERROR = {
      latest: 0.024 + windowLength / 10000,
      average: 0.022 + windowLength / 10000,
      minimum: 0.015,
      maximum: 0.034,
      p05: 0.017,
      p50: 0.022,
      p95: 0.031,
    };
    summaries.ROLLING_INFORMATION_RATIO = {
      latest: 0.29 + windowLength / 2000,
      average: 0.24 + windowLength / 2000,
      minimum: -0.08,
      maximum: 0.61,
      p05: 0.01,
      p50: 0.27,
      p95: 0.55,
    };
  }
  return summaries;
}

function buildFixtureRollingSeries({
  windowLength,
  includeBenchmarkMetrics,
  reportStartDate,
  reportEndDate,
}: {
  windowLength: number;
  includeBenchmarkMetrics: boolean;
  reportStartDate: string;
  reportEndDate: string;
}) {
  const startTime = Date.parse(`${reportStartDate}T00:00:00Z`);
  const endTime = Date.parse(`${reportEndDate}T00:00:00Z`);
  const middleDate = new Date(
    startTime + Math.floor((endTime - startTime) / 2),
  )
    .toISOString()
    .slice(0, 10);
  const dates = [reportStartDate, middleDate, reportEndDate];
  return [
    {
      date: dates[0],
      metric_values: buildFixtureRollingSeriesMetricValues({
        windowLength,
        includeBenchmarkMetrics,
        volatility: 0.112 + windowLength / 5200,
        maxDrawdown: -0.018 - windowLength / 5200,
      }),
    },
    {
      date: dates[1],
      metric_values: buildFixtureRollingSeriesMetricValues({
        windowLength,
        includeBenchmarkMetrics,
        volatility: 0.118 + windowLength / 5200,
        maxDrawdown: -0.022 - windowLength / 5200,
      }),
    },
    {
      date: dates[2],
      metric_values: buildFixtureRollingSeriesMetricValues({
        windowLength,
        includeBenchmarkMetrics,
        volatility: 0.121 + windowLength / 5200,
        maxDrawdown: -0.028 - windowLength / 5200,
      }),
    },
  ];
}

function buildFixtureRollingSeriesMetricValues({
  windowLength,
  includeBenchmarkMetrics,
  volatility,
  maxDrawdown,
}: {
  windowLength: number;
  includeBenchmarkMetrics: boolean;
  volatility: number;
  maxDrawdown: number;
}) {
  const values: Record<string, number> = {
    ROLLING_VOLATILITY: volatility,
    ROLLING_MAX_DRAWDOWN: maxDrawdown,
    ROLLING_SHARPE: 0.67 + windowLength / 1100,
  };
  if (includeBenchmarkMetrics) {
    values.ROLLING_BETA = 0.9 + windowLength / 5200;
    values.ROLLING_TRACKING_ERROR = 0.023 + windowLength / 11000;
    values.ROLLING_INFORMATION_RATIO = 0.25 + windowLength / 2200;
  }
  return values;
}

function buildDrawdownDateRange(summary: WorkbenchRiskDrawdownSummary) {
  if (!summary.max_drawdown_peak_date || !summary.max_drawdown_trough_date) {
    return "Peak/trough timing unavailable";
  }
  return `${formatDateValue(summary.max_drawdown_peak_date)} to ${formatDateValue(
    summary.max_drawdown_trough_date
  )}`;
}

function resolveModuleState(state: WorkbenchRiskModuleState): PerformanceRiskState {
  if (state === "ready" || state === "partial" || state === "unavailable") {
    return state;
  }
  return "unavailable";
}

function resolveMetricState(state: WorkbenchRiskModuleState): PerformanceRiskState {
  return resolveModuleState(state);
}

function mapSupportabilityGroup(
  group: "summary" | "concentration" | "attribution" | "drawdown" | "rolling",
  items: PerformanceRiskViewModel["supportability"]
) {
  return items.map((item) => ({
    ...item,
    key: `${group}:${item.key}`,
  }));
}

function mapAttributionControls(response: WorkbenchRiskAttributionResponse | null) {
  if (
    !response?.payload ||
    (response.state !== "ready" &&
      response.state !== "partial" &&
      response.state !== "blocked")
  ) {
    return null;
  }
  return {
    selectedAttributionType: response.payload.controls.selected_attribution_type,
    selectedGroupingDimension: response.payload.controls.selected_grouping_dimension,
    attributionTypes: response.payload.controls.attribution_types.map((option) => ({
      key: option.key,
      label: option.label,
      disabled: option.state !== "ready",
      reason: option.reason,
    })),
    groupingDimensions: response.payload.controls.grouping_dimensions.map((option) => ({
      key: option.key,
      label: option.label,
      disabled: option.state === "blocked" || option.state === "unavailable",
      reason: option.reason,
    })),
  };
}

function mapAttributionRows(response: WorkbenchRiskAttributionResponse | null) {
  if (
    !response ||
    (response.state !== "ready" && response.state !== "partial")
  ) {
    return [];
  }
  const selectedSet = response?.payload?.periods[0]?.attribution_sets[0];
  if (!selectedSet) {
    return [];
  }
  return [...selectedSet.contributors]
    .sort(
      (left, right) =>
        Math.abs(right.component_contribution ?? 0) - Math.abs(left.component_contribution ?? 0)
    )
    .map((contributor) => ({
      key: contributor.group_key,
      group: normalizeAttributionGroupLabel(contributor.group_label),
      avgWeight: formatRiskPercentValue(contributor.weight_average),
      marginalContribution: formatRiskPercentValue(contributor.marginal_contribution),
      componentContribution: formatRiskPercentValue(contributor.component_contribution),
      contributionShare: formatRiskPercentValue(contributor.percent_contribution),
      contributionShareAbsPct:
        typeof contributor.percent_contribution === "number"
          ? Math.abs(contributor.percent_contribution * 100)
          : null,
    }));
}

function mapAttributionMaxContributionShareAbsPct(response: WorkbenchRiskAttributionResponse | null) {
  if (response?.state !== "ready") {
    return 0;
  }
  const selectedSet = response?.payload?.periods[0]?.attribution_sets[0];
  if (!selectedSet) {
    return 0;
  }

  return selectedSet.contributors.reduce((maxValue, contributor) => {
    const nextValue =
      typeof contributor.percent_contribution === "number"
        ? Math.abs(contributor.percent_contribution * 100)
        : 0;
    return Math.max(maxValue, nextValue);
  }, 0);
}

function resolveAttributionEvidencePosture(
  response: WorkbenchRiskAttributionResponse,
  residual: number | null | undefined
) {
  const hasQualifiedSupportability = response.supportability.some(
    (item) => item.state !== "ready"
  );
  const residualAbs = Math.abs(residual ?? 0);

  if (response.state === "partial" && residualAbs >= 0.001) {
    return {
      value: "Review",
      support:
        "Source evidence is incomplete and a residual remains visible, so the decomposition should be checked before escalation.",
      metadata: `Residual ${formatRiskPercentValue(residual)}`,
    };
  }
  if (response.state === "partial") {
    return {
      value: "Qualified",
      support: "Review the source qualifications before using this decomposition externally.",
      metadata: "Attribution evidence is incomplete",
    };
  }
  if (hasQualifiedSupportability) {
    return {
      value: "Qualified",
      support: "Supportability should be reviewed before using this decomposition externally.",
      metadata: "Upstream supportability is not fully ready",
    };
  }
  if (residualAbs >= 0.001) {
    return {
      value: "Review",
      support: "Residual remains visible, so the decomposition should be checked before escalation.",
      metadata: `Residual ${formatRiskPercentValue(residual)}`,
    };
  }
  return {
    value: "Reliable",
    support: "Residual is controlled and the current decomposition is suitable for front-office review.",
    metadata: `Residual ${formatRiskPercentValue(residual)}`,
  };
}

function mapAttributionMethodologyRows(
  response: WorkbenchRiskAttributionResponse | null
): PerformanceRiskContextRow[] {
  if (
    !response ||
    (response.state !== "ready" && response.state !== "partial")
  ) {
    return [];
  }
  const methodologyContext = response?.payload?.methodology_context;
  const selectedSet = response?.payload?.periods[0]?.attribution_sets[0];
  if (!methodologyContext) {
    return [];
  }
  const evidencePosture = selectedSet
    ? resolveAttributionEvidencePosture(response as WorkbenchRiskAttributionResponse, selectedSet.residual)
    : null;
  return [
    ...(selectedSet
      ? [
          {
            key: "reconciled_sum",
            label: "Reconciled sum",
            value: formatRiskPercentValue(selectedSet.reconciled_sum),
            support: `Reported total ${formatRiskPercentValue(
              selectedSet.total_value
            )} with residual ${formatRiskPercentValue(selectedSet.residual)}.`,
          },
          {
            key: "evidence_posture",
            label: "Evidence posture",
            value: evidencePosture?.value ?? "N/A",
            support: evidencePosture?.support ?? "Attribution evidence posture is not available.",
          },
        ]
      : []),
    {
      key: "covariance_method",
      label: "Covariance method",
      value: formatEnumLabel(methodologyContext.covariance_method) ?? "N/A",
      support: "Attribution covariance convention",
    },
    {
      key: "annualization_basis",
      label: "Annualisation basis",
      value: formatInteger(methodologyContext.annualization_basis),
      support: "Periods used for annualised attribution metrics",
    },
    {
      key: "requested_metric",
      label: "Attribution lens",
      value: methodologyContext.requested_metrics?.join(", ") ?? "N/A",
      support: methodologyContext.requested_grouping_dimensions?.join(", ") ?? "No grouping selected",
    },
    {
      key: "active_risk_support",
      label: "Active-risk support",
      value:
        methodologyContext.stateful_active_risk_supported_grouping_dimensions?.join(", ") ?? "N/A",
      support:
        methodologyContext.stateful_active_risk_gate_reason ??
        "Supported grouping dimensions for active-risk decomposition",
    },
  ];
}

function isRollingRatioMetric(metricKey: string) {
  return metricKey === "ROLLING_SHARPE" || metricKey === "ROLLING_INFORMATION_RATIO";
}

function isRollingRatioUnstable(value: number | null | undefined) {
  return typeof value === "number" && Math.abs(value) >= 25;
}

function orderRollingMetricKeys(metricKeys: string[]) {
  const priority = [
    "ROLLING_VOLATILITY",
    "ROLLING_TRACKING_ERROR",
    "ROLLING_BETA",
    "ROLLING_MAX_DRAWDOWN",
    "ROLLING_SHARPE",
    "ROLLING_INFORMATION_RATIO",
  ];
  return [...metricKeys].sort((left, right) => {
    const leftIndex = priority.indexOf(left);
    const rightIndex = priority.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right);
    }
    if (leftIndex === -1) {
      return 1;
    }
    if (rightIndex === -1) {
      return -1;
    }
    return leftIndex - rightIndex;
  });
}

function shouldDisplayRollingMetricRow(metricLabel: string, latestValue: string) {
  if ((metricLabel === "Sharpe" || metricLabel === "Information ratio") && latestValue === "Unstable") {
    return false;
  }
  return true;
}

function normalizeAttributionGroupLabel(label: string) {
  return label === "UNKNOWN" ? "Unclassified" : label;
}

function resolveAttributionState({
  attribution,
  isAttributionLoading,
}: {
  attribution: WorkbenchRiskAttributionResponse | null;
  isAttributionLoading: boolean;
}): "idle" | "loading" | "ready" | "partial" | "blocked" | "unavailable" {
  if (isAttributionLoading) {
    return "loading";
  }
  if (!attribution) {
    return "idle";
  }
  switch (attribution.state) {
    case "ready":
      return "ready";
    case "partial":
      return "partial";
    case "blocked":
      return "blocked";
    case "unavailable":
      return "unavailable";
    default:
      return "unavailable";
  }
}

function isKnownAttributionState(state: unknown): state is WorkbenchRiskAttributionResponse["state"] {
  return state === "ready" || state === "partial" || state === "blocked" || state === "unavailable";
}
