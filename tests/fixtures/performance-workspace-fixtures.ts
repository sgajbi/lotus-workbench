import type { PerformanceWorkspaceCapabilities } from "../../src/apps/performance/capabilities";
import type {
  WorkbenchPerformanceCapabilities,
  WorkbenchPerformanceAttributionTrend,
  PerformanceComparativeSummary,
  WorkbenchPerformanceWorkspace,
  WorkbenchPerformanceWorkspaceDetails,
  WorkbenchPerformanceWorkspaceSummary,
} from "../../src/features/workbench/types";

export type PerformanceFixtureOptions = {
  unassignedBenchmark?: boolean;
  unavailableSummarySeries?: boolean;
  partialBenchmarkComparison?: boolean;
  aggregateContributionOnly?: boolean;
  unavailableAttribution?: boolean;
  summaryOnlyAttribution?: boolean;
};

export type PerformancePresentationScenario = {
  workspace: WorkbenchPerformanceWorkspace;
  capabilities: PerformanceWorkspaceCapabilities;
  selectedPerformance: PerformanceComparativeSummary;
  selectedBenchmarkCode?: string;
  selectedBenchmarkLabel: string | null;
  hasMoneyWeightedReturn: boolean;
  suspiciousMoneyWeightedReturn: boolean;
};

export type PerformanceReturnPathScenarioData = {
  points: WorkbenchPerformanceWorkspace["net_chart"];
  summary: Pick<
    PerformanceComparativeSummary,
    | "portfolio_return_pct"
    | "benchmark_return_pct"
    | "active_return_pct"
    | "annualized_return_pct"
    | "begin_market_value"
    | "end_market_value"
    | "beginning_cash_flow"
    | "ending_cash_flow"
    | "flow_adjusted_end_market_value"
    | "net_cash_flow"
    | "benchmark_input_mode"
  >;
  benchmark?: string;
  benchmarkOptions: WorkbenchPerformanceWorkspace["benchmark_options"];
  capabilities: PerformanceWorkspaceCapabilities;
};

export function buildPerformanceCapabilities(
  overrides: Partial<PerformanceWorkspaceCapabilities> = {}
): PerformanceWorkspaceCapabilities {
  return {
    summaryKpis: { state: "supported" },
    returnPath: {
      state: "supported",
      earliestAvailableDate: "2026-01-01",
      latestAvailableDate: "2026-02-24",
    },
    benchmarkComparison: {
      state: "supported",
      earliestAvailableDate: "2026-01-01",
      latestAvailableDate: "2026-02-24",
    },
    multiHorizonReturns: {
      state: "supported",
      supportedFrequencies: ["monthly", "quarterly"],
    },
    contributionRanking: {
      state: "supported",
      supportedDimensions: ["asset_class", "sector", "country"],
    },
    attributionDetail: {
      state: "supported",
      supportedDimensions: ["asset_class", "sector", "country", "currency"],
      supportedFrequencies: ["monthly", "quarterly"],
    },
    contributionDetail: {
      state: "supported",
      supportedDimensions: ["asset_class", "sector", "country"],
    },
    evidence: { state: "unavailable", reason: "Evidence contract unavailable." },
    ...overrides,
  };
}

function toContractCapabilities(
  capabilities: PerformanceWorkspaceCapabilities
): WorkbenchPerformanceCapabilities {
  const mapCapability = (capability: PerformanceWorkspaceCapabilities[keyof PerformanceWorkspaceCapabilities]) => ({
    state: capability.state,
    reason: capability.reason,
    coverage_level: capability.coverageLevel,
    fallback_available: capability.fallbackAvailable,
    earliest_available_date: capability.earliestAvailableDate,
    latest_available_date: capability.latestAvailableDate,
    supported_dimensions: capability.supportedDimensions,
    supported_frequencies: capability.supportedFrequencies,
  });

  return {
    summary_kpis: mapCapability(capabilities.summaryKpis),
    return_path: mapCapability(capabilities.returnPath),
    benchmark_comparison: mapCapability(capabilities.benchmarkComparison),
    multi_horizon_returns: mapCapability(capabilities.multiHorizonReturns),
    contribution_ranking: mapCapability(capabilities.contributionRanking),
    attribution_detail: mapCapability(capabilities.attributionDetail),
    contribution_detail: mapCapability(capabilities.contributionDetail),
    evidence: mapCapability(capabilities.evidence),
  };
}

function deriveFixtureCapabilities(
  options?: PerformanceFixtureOptions
): PerformanceWorkspaceCapabilities {
  if (options?.unassignedBenchmark && options?.unavailableSummarySeries) {
    return buildPerformanceCapabilities({
      returnPath: {
        state: "unavailable",
        reason: "Published return observations are not available for the selected horizon.",
      },
      benchmarkComparison: {
        state: "unavailable",
        reason: "No benchmark is assigned to this mandate.",
      },
    });
  }
  if (
    options?.partialBenchmarkComparison ||
    options?.aggregateContributionOnly ||
    options?.unavailableAttribution ||
    options?.summaryOnlyAttribution
  ) {
    return buildPerformanceCapabilities({
      ...(options.partialBenchmarkComparison
        ? {
            benchmarkComparison: {
              state: "partial",
              reason: "A benchmark is assigned, but benchmark-relative returns are incomplete.",
              earliestAvailableDate: "2026-01-01",
              latestAvailableDate: "2026-02-24",
            },
          }
        : {}),
      ...(options.aggregateContributionOnly
        ? {
            contributionRanking: {
              state: "partial",
              reason: "Contribution exists, but only aggregate rows are available.",
              coverageLevel: "aggregate",
              fallbackAvailable: true,
            },
            contributionDetail: {
              state: "partial",
              reason: "Contribution exists, but only aggregate rows are available.",
              coverageLevel: "aggregate",
              fallbackAvailable: true,
            },
          }
        : {}),
      ...(options.unavailableAttribution
        ? {
            attributionDetail: {
              state: "unavailable",
              reason: "Attribution detail is not available for the current selection.",
            },
          }
        : {}),
      ...(options.summaryOnlyAttribution
        ? {
            attributionDetail: {
              state: "partial",
              reason:
                "Benchmark-relative attribution is available only at summary level for the current selection.",
              coverageLevel: "summary",
              fallbackAvailable: true,
              supportedDimensions: ["asset_class", "sector", "country", "currency"],
              supportedFrequencies: ["monthly", "quarterly"],
            },
          }
        : {}),
    });
  }
  return buildPerformanceCapabilities();
}

export function buildPerformanceWorkspaceSummary(
  portfolioId = "PF_1001",
  options?: PerformanceFixtureOptions
): WorkbenchPerformanceWorkspaceSummary {
  const capabilities = deriveFixtureCapabilities(options);
  return {
    correlation_id: "corr-performance",
    contract_version: "v1",
    portfolio_id: portfolioId,
    as_of_date: "2026-02-24",
    requested_as_of_date: null,
    effective_as_of_date: "2026-02-24",
    requested_reporting_currency: null,
    effective_reporting_currency: "USD",
    reporting_currency_state: "accepted_unverified",
    period: "YTD",
    report_start_date: "2026-01-01",
    report_end_date: "2026-02-24",
    chart_frequency: "monthly",
    detail_basis: "NET",
    benchmark_code: options?.unassignedBenchmark ? null : "BMK_GLOBAL_BALANCED_60_40",
    benchmark_options: options?.unassignedBenchmark
      ? []
      : [
        {
          benchmark_code: "BMK_GLOBAL_BALANCED_60_40",
          benchmark_name: "Global Balanced 60/40",
          benchmark_currency: "USD",
          benchmark_type: "composite",
          benchmark_family: "multi_asset_strategic",
          benchmark_provider: "LOTUS_DEMO",
          is_assigned: true,
        },
        ],
    capabilities: toContractCapabilities(capabilities),
    evidence_view: {
      state: capabilities.evidence.state,
      as_of_date: "2026-02-24",
      period: "YTD",
      basis: "NET",
      benchmark_code: options?.unassignedBenchmark ? null : "BMK_GLOBAL_BALANCED_60_40",
      calculation_scope: "performance_workspace",
      source_services: ["lotus-performance"],
      input_freshness: {
        performance: "fresh",
        benchmark: options?.unassignedBenchmark ? "unavailable" : "fresh",
      },
      methodology_references: ["lotus-performance/docs/methodologies"],
      calculation_versions: {
        analytics_types: "WORKSPACE_SUMMARY",
        gateway_contract: "v1",
      },
      coverage: {
        supported_dimensions: ["asset_class", "country", "currency", "sector"],
        unsupported_dimensions: ["issuer"],
      },
      fallbacks: [],
      limitations:
        capabilities.evidence.state === "partial"
          ? ["One or more performance calculations still have pending lineage evidence."]
          : [],
      generated_at: null,
      reason: capabilities.evidence.reason ?? null,
      calculations: [
        {
          calculation_role: "workspace_summary",
          calculation_id: "calc-workspace-summary",
          analytics_type: "WORKSPACE_SUMMARY",
          execution_status: "complete",
          execution_mode: "sync",
          lineage_status: capabilities.evidence.state === "supported" ? "complete" : "pending",
          stage_statuses: [],
          upstream_snapshots: [],
          artifacts: [
            {
              artifact_name: "request.json",
              url: `/api/v1/workbench/${portfolioId}/performance/evidence/artifacts/calc-workspace-summary/request.json`,
              content_type: "application/json",
            },
          ],
        },
      ],
    },
    portfolio: {
      portfolio_id: portfolioId,
      client_id: "CIF_1001",
      base_currency: "USD",
      booking_center_code: "SG",
    },
    overview: {
      market_value_base: 1250000,
      cash_weight_pct: 6.8,
      position_count: 18,
    },
    net_performance: {
      metric_basis: "NET",
      portfolio_return_pct: options?.unavailableSummarySeries ? null : 5.42,
      benchmark_return_pct:
        options?.unassignedBenchmark ||
        options?.unavailableSummarySeries ||
        options?.partialBenchmarkComparison
          ? null
          : 4.91,
      active_return_pct:
        options?.unassignedBenchmark ||
        options?.unavailableSummarySeries ||
        options?.partialBenchmarkComparison
          ? null
          : 0.52,
      annualized_return_pct: options?.unavailableSummarySeries ? null : 5.42,
      benchmark_id: options?.unassignedBenchmark ? null : "BMK_GLOBAL_BALANCED_60_40",
      benchmark_return_source: options?.unassignedBenchmark ? null : "calculated",
      benchmark_input_mode: options?.unassignedBenchmark ? null : "stateful",
      benchmark_currency_state: options?.unassignedBenchmark ? null : "fx_decomposed",
      benchmark_calendar_alignment_state: options?.unassignedBenchmark ? null : "aligned",
      benchmark_warning_codes: [],
      benchmark_missing_date_count: 0,
      begin_market_value: 1200000,
      end_market_value: 1250000,
      beginning_cash_flow: 50000,
      ending_cash_flow: -8000,
      flow_adjusted_end_market_value: 1208000,
      net_cash_flow: 42000,
      fees: 0,
    },
    gross_performance: {
      metric_basis: "GROSS",
      portfolio_return_pct: options?.unavailableSummarySeries ? null : 5.88,
      benchmark_return_pct:
        options?.unassignedBenchmark ||
        options?.unavailableSummarySeries ||
        options?.partialBenchmarkComparison
          ? null
          : 5.12,
      active_return_pct:
        options?.unassignedBenchmark ||
        options?.unavailableSummarySeries ||
        options?.partialBenchmarkComparison
          ? null
          : 0.76,
      annualized_return_pct: options?.unavailableSummarySeries ? null : 5.88,
      benchmark_id: options?.unassignedBenchmark ? null : "BMK_GLOBAL_BALANCED_60_40",
      benchmark_return_source: options?.unassignedBenchmark ? null : "calculated",
      benchmark_input_mode: options?.unassignedBenchmark ? null : "stateful",
      benchmark_currency_state: options?.unassignedBenchmark ? null : "fx_decomposed",
      benchmark_calendar_alignment_state: options?.unassignedBenchmark ? null : "aligned",
      benchmark_warning_codes: [],
      benchmark_missing_date_count: 0,
      begin_market_value: 1200000,
      end_market_value: 1250000,
      beginning_cash_flow: 50000,
      ending_cash_flow: -8000,
      flow_adjusted_end_market_value: 1208000,
      net_cash_flow: 42000,
      fees: 0,
    },
    money_weighted_return: {
      money_weighted_return_pct: 5.12,
      annualized_return_pct: 5.12,
      input_mode: "stateful",
      method: "XIRR",
      start_date: "2026-01-01",
      end_date: "2026-02-24",
      begin_market_value: 1200000,
      end_market_value: 1250000,
      beginning_cash_flow: 50000,
      ending_cash_flow: -8000,
      flow_adjusted_end_market_value: 1208000,
      net_cash_flow: 42000,
      fees: 0,
      notes: ["cash-flow aware"],
    },
    warnings: [],
    partial_failures: [],
  };
}

export function buildPerformanceWorkspaceDetails(
  portfolioId = "PF_1001",
  options?: PerformanceFixtureOptions
): WorkbenchPerformanceWorkspaceDetails {
  const capabilities = deriveFixtureCapabilities(options);
  return {
    correlation_id: "corr-performance",
    contract_version: "v1",
    portfolio_id: portfolioId,
    as_of_date: "2026-02-24",
    requested_as_of_date: null,
    effective_as_of_date: "2026-02-24",
    requested_reporting_currency: null,
    effective_reporting_currency: "USD",
    reporting_currency_state: "accepted_unverified",
    period: "YTD",
    report_start_date: "2026-01-01",
    report_end_date: "2026-02-24",
    chart_frequency: "monthly",
    contribution_dimension: "asset_class",
    attribution_dimension: "asset_class",
    detail_basis: "NET",
    segment: "asset_class",
    benchmark_code: options?.unassignedBenchmark ? null : "BMK_GLOBAL_BALANCED_60_40",
    capabilities: toContractCapabilities(capabilities),
    evidence_view: {
      state: capabilities.evidence.state,
      as_of_date: "2026-02-24",
      period: "YTD",
      basis: "NET",
      benchmark_code: options?.unassignedBenchmark ? null : "BMK_GLOBAL_BALANCED_60_40",
      calculation_scope: "performance_workspace",
      source_services: ["lotus-performance"],
      input_freshness: {
        performance: "fresh",
        benchmark: options?.unassignedBenchmark ? "unavailable" : "fresh",
      },
      methodology_references: ["lotus-performance/docs/methodologies"],
      calculation_versions: {
        analytics_types: "WORKSPACE_SUMMARY",
        gateway_contract: "v1",
      },
      coverage: {
        supported_dimensions: ["asset_class", "country", "currency", "sector"],
        unsupported_dimensions: ["issuer"],
      },
      fallbacks: [],
      limitations:
        capabilities.evidence.state === "partial"
          ? ["One or more performance calculations still have pending lineage evidence."]
          : [],
      generated_at: null,
      reason: capabilities.evidence.reason ?? null,
      calculations: [
        {
          calculation_role: "workspace_summary",
          calculation_id: "calc-workspace-summary",
          analytics_type: "WORKSPACE_SUMMARY",
          execution_status: "complete",
          execution_mode: "sync",
          lineage_status: capabilities.evidence.state === "supported" ? "complete" : "pending",
          stage_statuses: [],
          upstream_snapshots: [],
          artifacts: [],
        },
      ],
    },
    net_chart: options?.unavailableSummarySeries
      ? []
      : [
          {
            label: "2026-01",
            frequency: "monthly",
            period_start: "2026-01-01",
            period_end: "2026-01-31",
            portfolio_return_pct: 2.2,
            benchmark_return_pct: options?.partialBenchmarkComparison ? null : 1.9,
            active_return_pct: options?.partialBenchmarkComparison ? null : 0.3,
            cumulative_portfolio_return_pct: 2.2,
            cumulative_benchmark_return_pct: options?.partialBenchmarkComparison ? null : 1.9,
            cumulative_active_return_pct: options?.partialBenchmarkComparison ? null : 0.3,
          },
        ],
    gross_chart: [
      {
        label: "2026-01",
        frequency: "monthly",
        period_start: "2026-01-01",
        period_end: "2026-01-31",
        portfolio_return_pct: 2.4,
        benchmark_return_pct: 2.0,
        active_return_pct: 0.4,
        cumulative_portfolio_return_pct: 2.4,
        cumulative_benchmark_return_pct: 2.0,
        cumulative_active_return_pct: 0.4,
      },
    ],
    contribution: {
      metric_basis: "NET",
      weighting_scheme: "average_weight",
      portfolio_contribution_pct: 5.42,
      total_portfolio_return_pct: 5.42,
      coverage_mv_pct: 98.7,
      portfolio_local_contribution_pct: 4.8,
      portfolio_fx_contribution_pct: 0.62,
      smoothing_evidence: {
        status: "APPLIED",
        reason_codes: ["CARINO_FACTOR_APPLIED"],
        raw_contribution_pct: 5.31,
        final_contribution_pct: 5.42,
        linked_return_pct: 5.42,
        smoothing_residual_pct: 0,
      },
      source_economics_evidence: {
        status: "SOURCE_LIMITED",
        component_detail_status: "LIMITED",
        reason_codes: [
          "LOTUS_CORE_ANALYTICS_INPUTS_USED",
          "COMPONENT_PNL_NOT_SOURCE_AUTHORED",
          "UNSUPPORTED_SOURCE_CASH_FLOW_TYPES_PRESENT",
        ],
        source_contracts: ["PortfolioTimeseriesInput:v1", "PositionTimeseriesInput:v1"],
        available_economics: ["portfolio_market_values", "position_market_values"],
        unsupported_economics: ["income_pnl", "tax_pnl"],
        degraded_economics: ["unsupported_cash_flow_types"],
        source_snapshot_count: 2,
      },
      position_rows: options?.aggregateContributionOnly
        ? []
        : [
            {
              position_id: "AAPL",
              contribution_pct: 1.55,
              weight_avg_pct: 24.1,
              total_return_pct: 8.2,
              local_contribution_pct: 1.18,
              fx_contribution_pct: 0.37,
            },
          ],
      levels: [
        {
          level: 1,
          name: "asset_class",
          total_contribution_pct: 5,
          total_weight_avg_pct: 100,
          total_portfolio_return_pct: 5.42,
          rows: [
            {
              key_label: "Equity",
              contribution_pct: 3.8,
              weight_avg_pct: 61,
              total_return_pct: 7.4,
              local_contribution_pct: 3.4,
              fx_contribution_pct: 0.4,
              is_other: false,
            },
          ],
        },
      ],
    },
    attribution: options?.unavailableAttribution
      ? null
      : {
          status: options?.summaryOnlyAttribution ? "partial" : "valid",
          reason_codes: options?.summaryOnlyAttribution ? ["off_benchmark_exposure"] : [],
          reasons: options?.summaryOnlyAttribution
            ? [
                {
                  code: "off_benchmark_exposure",
                  severity: "warning",
                  message: "Portfolio-only exposure was found in the attribution set.",
                  affected_group_count: 1,
                },
              ]
            : [],
          metric_basis: "NET",
          model: "BF",
          linking: "carino",
          benchmark_id: options?.unassignedBenchmark ? null : "BMK_GLOBAL_BALANCED_60_40",
          benchmark_return_source: options?.unassignedBenchmark ? null : "calculated",
          active_return_pct: 0.52,
          sum_of_effects_pct: 0.5,
          residual_pct: 0.02,
          residual_materiality: {
            classification: options?.summaryOnlyAttribution ? "watch" : "immaterial",
            treatment: options?.summaryOnlyAttribution ? "review" : "no_action",
            absolute_residual_pct: 0.02,
            warning_threshold_pct: 0.001,
            material_threshold_pct: 0.01,
          },
          supportability_evidence: {
            portfolio_only_group_count: options?.summaryOnlyAttribution ? 1 : 0,
            benchmark_only_group_count: 0,
            unclassified_group_count: 0,
            missing_benchmark_return_count: 0,
            negative_weight_count: 0,
            zero_portfolio_exposure_count: 0,
            currency_attribution_status: "not_requested",
            linking_status: "linked",
          },
          levels: [
            {
              dimension: "asset_class",
              allocation_total_pct: 0.18,
              selection_total_pct: 0.24,
              interaction_total_pct: 0.03,
              total_effect_pct: 0.45,
              rows: options?.summaryOnlyAttribution
                ? []
                : [
                    {
                      key_label: "Equity",
                      portfolio_weight_avg_pct: 61,
                      benchmark_weight_avg_pct: 58,
                      portfolio_return_pct: 7.4,
                      benchmark_return_pct: 6.8,
                      allocation_pct: 0.18,
                      selection_pct: 0.24,
                      interaction_pct: 0.03,
                      total_effect_pct: 0.45,
                    },
                  ],
            },
          ],
        },
    warnings: [],
    partial_failures: [],
  };
}

export function buildPerformanceWorkspace(
  portfolioId = "PF_1001",
  options?: PerformanceFixtureOptions
): WorkbenchPerformanceWorkspace {
  return {
    ...buildPerformanceWorkspaceSummary(portfolioId, options),
    ...buildPerformanceWorkspaceDetails(portfolioId, options),
  };
}

export function buildPerformancePresentationScenario(options?: {
  portfolioId?: string;
  fixtureOptions?: PerformanceFixtureOptions;
  capabilityOverrides?: Partial<PerformanceWorkspaceCapabilities>;
  workspaceOverrides?: Partial<WorkbenchPerformanceWorkspace>;
  selectedPerformanceOverrides?: Partial<PerformanceComparativeSummary>;
  selectedBenchmarkCode?: string;
  selectedBenchmarkLabel?: string | null;
  hasMoneyWeightedReturn?: boolean;
  suspiciousMoneyWeightedReturn?: boolean;
  useGrossPerformance?: boolean;
}): PerformancePresentationScenario {
  const capabilities = buildPerformanceCapabilities(options?.capabilityOverrides);
  const baseWorkspace = buildPerformanceWorkspace(options?.portfolioId, options?.fixtureOptions);
  const evidenceLimitations =
    capabilities.evidence.state === "partial"
      ? ["One or more performance calculations still have pending lineage evidence."]
      : (baseWorkspace.evidence_view?.limitations ?? []);
  const workspace = {
    ...baseWorkspace,
    capabilities: toContractCapabilities(capabilities),
    evidence_view: baseWorkspace.evidence_view
      ? {
          ...baseWorkspace.evidence_view,
          state: capabilities.evidence.state,
          reason: capabilities.evidence.reason ?? baseWorkspace.evidence_view.reason,
          limitations: evidenceLimitations,
        }
      : null,
    ...options?.workspaceOverrides,
  };

  const baseSelectedPerformance = options?.useGrossPerformance
    ? workspace.gross_performance
    : workspace.net_performance;

  return {
    workspace,
    capabilities,
    selectedPerformance: {
      ...baseSelectedPerformance,
      ...options?.selectedPerformanceOverrides,
    },
    selectedBenchmarkCode:
      options?.selectedBenchmarkCode !== undefined
        ? options.selectedBenchmarkCode
        : workspace.benchmark_code ?? undefined,
    selectedBenchmarkLabel:
      options?.selectedBenchmarkLabel !== undefined
        ? options.selectedBenchmarkLabel
        : workspace.benchmark_code
          ? "Global Balanced 60/40"
          : null,
    hasMoneyWeightedReturn:
      options?.hasMoneyWeightedReturn ?? Boolean(workspace.money_weighted_return),
    suspiciousMoneyWeightedReturn: options?.suspiciousMoneyWeightedReturn ?? false,
  };
}

export function buildSupportedPerformanceScenario() {
  return buildPerformancePresentationScenario();
}

export function buildBenchmarkUnassignedPerformanceScenario() {
  return buildPerformancePresentationScenario({
    fixtureOptions: {
      unassignedBenchmark: true,
      unavailableSummarySeries: true,
    },
    capabilityOverrides: {
      returnPath: {
        state: "unavailable",
        reason: "Published return observations are not available for the selected horizon.",
      },
      benchmarkComparison: {
        state: "unavailable",
        reason: "No benchmark is assigned to this mandate.",
      },
    },
    workspaceOverrides: {
      money_weighted_return: null,
    },
    selectedPerformanceOverrides: {
      portfolio_return_pct: null,
      benchmark_return_pct: null,
      active_return_pct: null,
      annualized_return_pct: null,
      benchmark_id: null,
      benchmark_return_source: null,
      begin_market_value: null,
      end_market_value: null,
      beginning_cash_flow: null,
      ending_cash_flow: null,
      flow_adjusted_end_market_value: null,
      net_cash_flow: null,
      fees: null,
    },
    selectedBenchmarkCode: undefined,
    selectedBenchmarkLabel: null,
    hasMoneyWeightedReturn: false,
  });
}

export function buildPartialBenchmarkPerformanceScenario() {
  return buildPerformancePresentationScenario({
    fixtureOptions: {
      partialBenchmarkComparison: true,
    },
    capabilityOverrides: {
      benchmarkComparison: {
        state: "partial",
        reason: "A benchmark is assigned, but benchmark-relative returns are incomplete.",
      },
    },
  });
}

export function buildAggregateContributionPerformanceScenario() {
  return buildPerformancePresentationScenario({
    fixtureOptions: {
      aggregateContributionOnly: true,
    },
    capabilityOverrides: {
      contributionRanking: {
        state: "partial",
        reason: "Contribution exists, but only aggregate rows are available.",
      },
      contributionDetail: {
        state: "partial",
        reason: "Contribution exists, but only aggregate rows are available.",
      },
    },
  });
}

export function buildUnavailableContributionPerformanceScenario() {
  return buildPerformancePresentationScenario({
    workspaceOverrides: {
      contribution: null,
    },
    capabilityOverrides: {
      contributionDetail: {
        state: "unavailable",
        reason: "Contribution detail is not available for the current selection.",
      },
    },
  });
}

export function buildNormalizedControlsPerformanceScenario() {
  return buildPerformancePresentationScenario({
    workspaceOverrides: {
      chart_frequency: "monthly",
      contribution_dimension: "asset_class",
      attribution_dimension: "asset_class",
      requested_chart_frequency_supported: false,
      requested_contribution_dimension_supported: false,
      requested_attribution_dimension_supported: false,
      warnings: [
        "PERFORMANCE_CHART_FREQUENCY_NORMALIZED",
        "PERFORMANCE_CONTRIBUTION_DIMENSION_NORMALIZED",
        "PERFORMANCE_ATTRIBUTION_DIMENSION_NORMALIZED",
      ],
    },
  });
}

export function buildUnavailableAttributionPerformanceScenario() {
  return buildPerformancePresentationScenario({
    fixtureOptions: {
      unavailableAttribution: true,
    },
    capabilityOverrides: {
      attributionDetail: {
        state: "unavailable",
        reason: "Attribution detail is not available for the current selection.",
      },
    },
  });
}

export function buildPartialAttributionPerformanceScenario() {
  return buildPerformancePresentationScenario({
    fixtureOptions: {
      summaryOnlyAttribution: true,
    },
    capabilityOverrides: {
      attributionDetail: {
        state: "partial",
        reason:
          "Benchmark-relative attribution is available only at summary level for the current selection.",
        coverageLevel: "summary",
        fallbackAvailable: true,
        supportedDimensions: ["asset_class", "sector", "country", "currency"],
        supportedFrequencies: ["monthly", "quarterly"],
      },
    },
  });
}

export function buildUnavailableEvidencePerformanceScenario() {
  return buildPerformancePresentationScenario({
    capabilityOverrides: {
      evidence: {
        state: "unavailable",
        reason: "Evidence and lineage surfaces are not exposed by the current gateway contract.",
      },
    },
  });
}

export function buildPartialEvidencePerformanceScenario() {
  return buildPerformancePresentationScenario({
    capabilityOverrides: {
      evidence: {
        state: "partial",
        reason: "Lineage artifacts are available, but execution evidence is incomplete.",
      },
    },
  });
}

export function buildSupportedEvidencePerformanceScenario() {
  return buildPerformancePresentationScenario({
    capabilityOverrides: {
      evidence: {
        state: "supported",
        reason: "Execution and lineage evidence can be reviewed for this portfolio.",
      },
    },
  });
}

export function buildCombinedPartialPerformanceScenario() {
  return buildPerformancePresentationScenario({
    fixtureOptions: {
      partialBenchmarkComparison: true,
      aggregateContributionOnly: true,
      unavailableAttribution: true,
    },
    capabilityOverrides: {
      benchmarkComparison: {
        state: "partial",
        reason: "A benchmark is assigned, but benchmark-relative returns are incomplete.",
      },
      contributionRanking: {
        state: "partial",
        reason: "Contribution exists, but only aggregate rows are available.",
      },
      contributionDetail: {
        state: "partial",
        reason: "Contribution exists, but only aggregate rows are available.",
      },
      attributionDetail: {
        state: "unavailable",
        reason: "Attribution detail is not available for the current selection.",
      },
    },
  });
}

export function buildPerformanceReturnPathScenarioData(
  scenario: PerformancePresentationScenario,
  options?: {
    useGrossPerformance?: boolean;
    capabilities?: PerformanceWorkspaceCapabilities;
  }
): PerformanceReturnPathScenarioData {
  const useGrossPerformance = options?.useGrossPerformance ?? false;
  const summary = useGrossPerformance
    ? scenario.workspace.gross_performance
    : scenario.workspace.net_performance;
  const points = useGrossPerformance
    ? scenario.workspace.gross_chart
    : scenario.workspace.net_chart;

  return {
    points,
    summary: {
      portfolio_return_pct: summary.portfolio_return_pct,
      benchmark_return_pct: summary.benchmark_return_pct,
      active_return_pct: summary.active_return_pct,
      annualized_return_pct: summary.annualized_return_pct,
      begin_market_value: summary.begin_market_value,
      end_market_value: summary.end_market_value,
      beginning_cash_flow: summary.beginning_cash_flow,
      ending_cash_flow: summary.ending_cash_flow,
      flow_adjusted_end_market_value: summary.flow_adjusted_end_market_value,
      net_cash_flow: summary.net_cash_flow,
    },
    benchmark: scenario.workspace.benchmark_code ?? undefined,
    benchmarkOptions: scenario.workspace.benchmark_options ?? [],
    capabilities: options?.capabilities ?? scenario.capabilities,
  };
}

export function buildPerformanceHorizonComparison(portfolioId = "PF_1001") {
  return {
    correlation_id: "corr-performance",
    contract_version: "v1",
    portfolio_id: portfolioId,
    as_of_date: "2026-02-24",
    period: "YTD",
    report_start_date: "2026-01-01",
    report_end_date: "2026-02-24",
    reporting_currency: "USD",
    detail_basis: "NET",
    chart_frequency: "monthly",
    requested_chart_frequency_supported: true,
    benchmark_code: "BMK_GLOBAL_BALANCED_60_40",
    benchmark_options: [
      {
        benchmark_code: "BMK_GLOBAL_BALANCED_60_40",
        benchmark_name: "Global Balanced 60/40",
        is_assigned: true,
      },
    ],
    rows: [
      {
        period: "MTD",
        period_start: "2026-02-01",
        period_end: "2026-02-24",
        begin_market_value: 495000,
        end_market_value: 508870,
        beginning_cash_flow: 6000,
        ending_cash_flow: -1500,
        flow_adjusted_end_market_value: 504370,
        net_cash_flow: 4500,
        fees: -120,
        net_return_pct: 1.2,
        gross_return_pct: 1.22,
        portfolio_return_pct: 1.2,
        benchmark_return_pct: 1.0,
        active_return_pct: 0.2,
        cumulative_net_return_pct: 5.42,
        cumulative_gross_return_pct: 5.88,
        cumulative_benchmark_return_pct: 4.91,
        cumulative_active_return_pct: 0.51,
        annualized_net_return_pct: 1.2,
        annualized_gross_return_pct: 1.22,
        annualized_return_pct: 1.2,
      },
      {
        period: "QTD",
        period_start: "2026-01-01",
        period_end: "2026-02-24",
        begin_market_value: 450000,
        end_market_value: 508870,
        beginning_cash_flow: 26000,
        ending_cash_flow: -3500,
        flow_adjusted_end_market_value: 486370,
        net_cash_flow: 22500,
        fees: -240,
        net_return_pct: 2.8,
        gross_return_pct: 2.84,
        portfolio_return_pct: 2.8,
        benchmark_return_pct: 2.4,
        active_return_pct: 0.4,
        cumulative_net_return_pct: 5.42,
        cumulative_gross_return_pct: 5.88,
        cumulative_benchmark_return_pct: 4.91,
        cumulative_active_return_pct: 0.51,
        annualized_net_return_pct: 2.8,
        annualized_gross_return_pct: 2.84,
        annualized_return_pct: 2.8,
      },
      {
        period: "YTD",
        period_start: "2026-01-01",
        period_end: "2026-02-24",
        begin_market_value: 450000,
        end_market_value: 508870,
        beginning_cash_flow: 26000,
        ending_cash_flow: -3500,
        flow_adjusted_end_market_value: 486370,
        net_cash_flow: 22500,
        fees: -350,
        net_return_pct: 5.42,
        gross_return_pct: 5.88,
        portfolio_return_pct: 5.42,
        benchmark_return_pct: 4.91,
        active_return_pct: 0.51,
        cumulative_net_return_pct: 5.42,
        cumulative_gross_return_pct: 5.88,
        cumulative_benchmark_return_pct: 4.91,
        cumulative_active_return_pct: 0.51,
        annualized_net_return_pct: 5.42,
        annualized_gross_return_pct: 5.88,
        annualized_return_pct: 5.42,
      },
      {
        period: "1Y",
        period_start: "2025-02-25",
        period_end: "2026-02-24",
        begin_market_value: 410000,
        end_market_value: 508870,
        beginning_cash_flow: 48000,
        ending_cash_flow: -7000,
        flow_adjusted_end_market_value: 467870,
        net_cash_flow: 41000,
        fees: -880,
        net_return_pct: 12.1,
        gross_return_pct: 12.74,
        portfolio_return_pct: 12.1,
        benchmark_return_pct: 10.7,
        active_return_pct: 1.4,
        cumulative_net_return_pct: 12.1,
        cumulative_gross_return_pct: 12.74,
        cumulative_benchmark_return_pct: 10.7,
        cumulative_active_return_pct: 1.4,
        annualized_net_return_pct: 12.1,
        annualized_gross_return_pct: 12.74,
        annualized_return_pct: 12.1,
      },
    ],
    warnings: [],
    partial_failures: [],
  };
}

export function buildPerformanceHorizonComparisonForScenario(
  scenario: PerformancePresentationScenario,
  portfolioId = scenario.workspace.portfolio.portfolio_id
) {
  const base = buildPerformanceHorizonComparison(portfolioId);
  const benchmarkAssigned = Boolean(scenario.workspace.benchmark_code);
  const hasReturnHistory =
    scenario.capabilities.returnPath.state === "supported" &&
    (scenario.workspace.net_chart?.length ?? 0) > 0;
  const hasRelativeComparison =
    benchmarkAssigned && scenario.capabilities.benchmarkComparison.state === "supported";

  if (!hasReturnHistory) {
    return {
      ...base,
      portfolio_id: portfolioId,
      benchmark_code: scenario.workspace.benchmark_code ?? null,
      benchmark_options: scenario.workspace.benchmark_options ?? [],
      rows: [],
    };
  }

  return {
    ...base,
    portfolio_id: portfolioId,
    benchmark_code: scenario.workspace.benchmark_code ?? null,
    benchmark_options: scenario.workspace.benchmark_options ?? [],
    rows: base.rows.map((row) => ({
      ...row,
      benchmark_return_pct: hasRelativeComparison ? row.benchmark_return_pct : null,
      active_return_pct: hasRelativeComparison ? row.active_return_pct : null,
    })),
  };
}

export function buildPerformanceAttributionTrend(
  portfolioIdOrOverrides: string | Partial<WorkbenchPerformanceAttributionTrend> = "PF_1001",
  overrides: Partial<WorkbenchPerformanceAttributionTrend> = {}
): WorkbenchPerformanceAttributionTrend {
  const portfolioId =
    typeof portfolioIdOrOverrides === "string" ? portfolioIdOrOverrides : "PF_1001";
  const trendOverrides =
    typeof portfolioIdOrOverrides === "string" ? overrides : portfolioIdOrOverrides;

  return {
    correlation_id: "corr-performance",
    contract_version: "v1",
    portfolio_id: portfolioId,
    as_of_date: "2026-02-24",
    requested_as_of_date: null,
    effective_as_of_date: "2026-02-24",
    requested_reporting_currency: null,
    effective_reporting_currency: "USD",
    reporting_currency_state: "accepted_unverified",
    period: "YTD",
    report_start_date: "2026-01-01",
    report_end_date: "2026-02-24",
    chart_frequency: "monthly",
    detail_basis: "NET",
    attribution_dimension: "asset_class",
    requested_chart_frequency_supported: true,
    requested_attribution_dimension_supported: true,
    benchmark_code: "BMK_GLOBAL_BALANCED_60_40",
    rows: [
      {
        period_label: "2026-01",
        period_start: "2026-01-01",
        period_end: "2026-01-31",
        frequency: "monthly",
        allocation_pct: 0.12,
        selection_pct: 0.08,
        interaction_pct: 0.02,
        total_effect_pct: 0.22,
        cumulative_total_effect_pct: 0.22,
        active_return_pct: 0.22,
        residual_pct: 0,
        status: "valid",
        reason_codes: [],
        residual_materiality: {
          classification: "immaterial",
          treatment: "no_action",
          absolute_residual_pct: 0,
          warning_threshold_pct: 0.001,
          material_threshold_pct: 0.01,
        },
        supportability_evidence: {
          portfolio_only_group_count: 0,
          benchmark_only_group_count: 0,
          unclassified_group_count: 0,
          missing_benchmark_return_count: 0,
          negative_weight_count: 0,
          zero_portfolio_exposure_count: 0,
          currency_attribution_status: "not_requested",
          linking_status: "linked",
        },
      },
    ],
    warnings: [],
    partial_failures: [],
    ...trendOverrides,
  };
}
