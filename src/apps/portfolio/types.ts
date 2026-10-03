export type PortfolioCatalogItem = {
  portfolio_id: string;
  display_name: string;
  base_currency: string;
  client_id: string | null;
  booking_center_code: string | null;
  portfolio_type?: string | null;
  status?: string | null;
};

export type PortfolioCatalogResponse = {
  items: PortfolioCatalogItem[];
};

export type PortfolioPartialFailure = {
  source_service: string;
  error_code: string;
  detail: string;
};

export type PortfolioSupportingEvidenceFailure = {
  evidence_scope:
    | "income_summary"
    | "activity_summary"
    | "selected_period_performance"
    | "standard_period_performance";
  period?: "MTD" | "QTD" | "YTD";
  source_service: "lotus-gateway";
  title: string;
  detail: string;
};

export type PortfolioCashflowOutlook = {
  as_of_date: string;
  range_end_date: string;
  total_net_cashflow_base: number;
  projection_days: number;
  include_projected: boolean;
  notes?: string | null;
  upcoming_points: Array<{
    projection_date: string;
    net_cashflow_base: number;
    projected_cumulative_cashflow_base: number;
  }>;
};

export type PortfolioProjectedCashflowResponse = {
  correlation_id: string;
  contract_version: string;
  portfolio_id: string;
  as_of_date: string;
  cashflow_outlook: PortfolioCashflowOutlook | null;
  warnings: string[];
  partial_failures: PortfolioPartialFailure[];
};

export type PortfolioAllocationBucket = {
  asset_class: string;
  position_count: number;
  market_value_base: number | null;
  weight_pct: number | null;
};

export type PortfolioAllocationView = {
  dimension: string;
  total_market_value_reporting_currency?: string | number | null;
  buckets: Array<{
    bucket: string;
    position_count: number;
    market_value_base: number | null;
    weight_pct: number | null;
    market_value_reporting_currency?: string | number | null;
    contributor_count?: number;
    contributors_truncated?: boolean;
    omitted_market_value_reporting_currency?: string | number | null;
    contributors?: Array<{
      contributor_type: "direct_position" | "look_through_component";
      portfolio_id: string;
      security_id: string;
      booked_security_id: string;
      source_snapshot_id: number;
      component_record_id?: number | null;
      market_value_reporting_currency: string | number | null;
      bucket_weight?: string | number | null;
    }>;
  }>;
};

export type PortfolioAllocationValuationCoverage = {
  coverage_state: "COMPLETE" | "MEASURED_ZERO" | "CARRY_FORWARD" | "LOADED_EMPTY" | "PARTIAL" | "UNAVAILABLE";
  coverage_reason: string;
  snapshot_row_count: number;
  expected_open_position_count: number;
  valued_position_count: number;
  unvalued_position_count: number;
};

export type PortfolioAllocationLookThrough = {
  requested_mode: string;
  effective_mode: string;
  applied: boolean;
};

export type PortfolioAllocationSelection = {
  dimension: string;
  bucket: string;
};

export type PortfolioTransactionDrilldownFilter =
  | {
      kind: "activity";
      bucket: string;
      label: string;
    }
  | {
      kind: "security";
      security_id: string;
      label: string;
    }
  | {
      kind: "linked_group";
      linked_transaction_group_id: string;
      label: string;
    }
  | {
      kind: "fx_contract";
      fx_contract_id: string;
      label: string;
    }
  | {
      kind: "swap_event";
      swap_event_id: string;
      label: string;
    }
  | {
      kind: "near_leg_group";
      near_leg_group_id: string;
      label: string;
    }
  | {
      kind: "far_leg_group";
      far_leg_group_id: string;
      label: string;
    };

export type PortfolioTopPosition = {
  security_id: string;
  instrument_name: string;
  asset_class: string | null;
  quantity: number;
  market_value_base: number | null;
  weight_pct: number | null;
};

export type PortfolioWorkflowCue = {
  key: string;
  label: string;
  href: string;
};

export type PortfolioReadinessStatus = "Missing" | "Partial" | "Ready" | "Empty";

export type PortfolioReadinessIndicator = {
  key: "holdings" | "pricing" | "transactions" | "reporting";
  label: string;
  status: PortfolioReadinessStatus;
  href: string;
};

export type PortfolioSupportabilitySummary = {
  feature_key: "core.observability.portfolio_supportability" | string;
  state: string;
  reason: string;
  freshness_bucket: "fresh" | "stale" | "unknown" | string;
  ready_domains: number;
  pending_domains: number;
  blocked_domains: number;
  no_activity_domains: number;
};

export type PortfolioRebalanceSupportabilitySummary = {
  feature_key: "manage.observability.action_register_supportability" | string;
  state: string;
  reason: string | null;
  freshness_bucket: "fresh" | "stale" | "unknown" | string | null;
  run_count: number | null;
  operation_count: number | null;
  workflow_decision_count: number | null;
};

export type PortfolioExceptionSummary = {
  key: string;
  title: string;
  detail: string;
  tone: "neutral" | "success" | "warn" | "danger";
  href: string;
};

export type PortfolioInsight = {
  key: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  href: string;
};

export type PortfolioWorkflowAction = {
  sequence: number;
  title: string;
  impact: string;
  target: string;
  href: string;
  cta_label: string;
  recommended: boolean;
};

export type PortfolioPositionView = {
  source_record_type?: "position" | "cash_balance";
  security_id: string;
  instrument_name: string;
  asset_class: string | null;
  isin?: string | null;
  currency?: string | null;
  sector?: string | null;
  country_of_risk?: string | null;
  held_since_date?: string | null;
  quantity: number;
  market_price?: number | null;
  cost_basis_base?: number | null;
  cost_basis_local?: number | null;
  market_value_base: number | null;
  market_value_local?: number | null;
  unrealized_gain_loss_base?: number | null;
  unrealized_gain_loss_local?: number | null;
  weight_pct: number | null;
  reprocessing_status?: string | null;
};

export type PortfolioCashBalance = {
  security_id: string;
  instrument_name: string;
  currency?: string | null;
  quantity: number;
  market_value_base?: number | null;
  weight_pct?: number | null;
};

export type PortfolioTransactionView = {
  transaction_id: string;
  transaction_date: string;
  settlement_date?: string | null;
  transaction_type: string;
  component_type?: string | null;
  security_id: string;
  instrument_id: string;
  quantity: number;
  price?: number | null;
  gross_amount?: number | null;
  currency?: string | null;
  net_cost_base?: number | null;
  realized_gain_loss_base?: number | null;
  settlement_status?: string | null;
  source_system?: string | null;
  cash_entry_mode?: string | null;
  economic_event_id?: string | null;
  linked_transaction_group_id?: string | null;
  fx_contract_id?: string | null;
  swap_event_id?: string | null;
  near_leg_group_id?: string | null;
  far_leg_group_id?: string | null;
};

export type PortfolioTransactionLedgerPage = {
  total: number;
  skip: number;
  limit: number;
};

export type PortfolioRecordDataAvailability = {
  positions?: "ready" | "unavailable";
  liquidity?: "ready" | "unavailable";
  transactions?: "ready" | "unavailable";
};

export type PortfolioIncomePeriodSummary = {
  gross: {
    portfolio_currency_amount?: number | null;
    reporting_currency_amount: number;
    transaction_count: number;
  };
  withholding_tax: {
    portfolio_currency_amount?: number | null;
    reporting_currency_amount: number;
    transaction_count: number;
  };
  other_deductions: {
    portfolio_currency_amount?: number | null;
    reporting_currency_amount: number;
    transaction_count: number;
  };
  net: {
    portfolio_currency_amount?: number | null;
    reporting_currency_amount: number;
    transaction_count: number;
  };
};

export type PortfolioIncomeSummaryView = {
  reporting_currency: string;
  window_start_date: string;
  window_end_date: string;
  totals_requested_window: PortfolioIncomePeriodSummary;
  totals_year_to_date: PortfolioIncomePeriodSummary;
  income_types: Array<{
    income_type: string;
    requested_window: PortfolioIncomePeriodSummary;
    year_to_date: PortfolioIncomePeriodSummary;
  }>;
};

export type PortfolioActivitySummaryView = {
  reporting_currency: string;
  window_start_date: string;
  window_end_date: string;
  buckets: Array<{
    bucket: string;
    requested_window: {
      portfolio_currency_amount?: number | null;
      reporting_currency_amount: number;
      transaction_count: number;
    };
    year_to_date: {
      portfolio_currency_amount?: number | null;
      reporting_currency_amount: number;
      transaction_count: number;
    };
  }>;
};

export type PortfolioWorkspace = {
  as_of_date: string;
  portfolio: {
    portfolio_id: string;
    display_name: string;
    client_id: string | null;
    base_currency: string;
    booking_center_code: string | null;
  };
  profile: {
    status: string | null;
    portfolio_type: string | null;
    risk_exposure: string | null;
    investment_time_horizon: string | null;
    objective: string | null;
    is_leverage_allowed: boolean | null;
    advisor_id?: string | null;
    open_date?: string | null;
    close_date?: string | null;
  };
  summary: {
    market_value_base: number;
    invested_market_value_base?: number | null;
    total_cash_base: number | null;
    cash_weight_pct: number | null;
    position_count: number;
    cash_balance_count?: number;
  };
  allocations: PortfolioAllocationBucket[];
  allocation_views?: PortfolioAllocationView[];
  cash_balances?: PortfolioCashBalance[];
  top_positions: PortfolioTopPosition[];
  positions: PortfolioPositionView[];
  recent_transactions: PortfolioTransactionView[];
  transaction_ledger_page?: PortfolioTransactionLedgerPage;
  record_data_availability?: PortfolioRecordDataAvailability;
  income_summary?: PortfolioIncomeSummaryView | null;
  activity_summary?: PortfolioActivitySummaryView | null;
  cashflow_outlook: PortfolioCashflowOutlook | null;
  performance: {
    period: string;
    report_start_date?: string | null;
    report_end_date?: string | null;
    return_pct: number | null;
    money_weighted_return_pct?: number | null;
    money_weighted_method?: string | null;
    benchmark_code?: string | null;
    benchmark_label?: string | null;
    benchmark_return_pct?: number | null;
    benchmark_return_source?: string | null;
    benchmark_input_mode?: string | null;
    excess_return_pct?: number | null;
    sparkline_points?: Array<{
      label: string;
      portfolio_return_pct: number | null;
      benchmark_return_pct?: number | null;
      active_return_pct?: number | null;
    }> | null;
    unavailable?: {
      title: string;
      detail: string;
      requirements: string[];
    } | null;
    warnings?: string[];
    partial_failures?: Array<{
      source_service: string;
      error_code: string;
      detail: string;
    }>;
  } | null;
  performance_period_returns?: Array<{
    period: "MTD" | "QTD" | "YTD";
    return_pct: number | null;
    benchmark_return_pct?: number | null;
    excess_return_pct?: number | null;
    unavailable?: {
      title: string;
      detail: string;
      requirements: string[];
    } | null;
    warnings?: string[];
    partial_failures?: PortfolioPartialFailure[];
  }>;
  supporting_evidence_failures?: PortfolioSupportingEvidenceFailure[];
  rebalance: {
    status: string;
    last_run_at_utc: string | null;
    last_rebalance_run_id: string | null;
    supportability?: PortfolioRebalanceSupportabilitySummary | null;
  } | null;
  control_capabilities?: {
    historical_snapshots: {
      state: "supported" | "partial" | "unsupported";
      reason: string;
      requested_as_of_date: string;
      effective_as_of_date: string;
      earliest_available_as_of_date?: string | null;
      latest_available_as_of_date?: string | null;
      module_capabilities: Array<{
        module: string;
        state: "supported" | "partial" | "unsupported";
        reason: string;
      }>;
    };
    reporting_currency_restatement: {
      state: "supported" | "partial" | "unsupported";
      reason: string;
      requested_reporting_currency?: string | null;
      effective_reporting_currency: string;
      supported_currencies: string[];
      module_capabilities: Array<{
        module: string;
        state: "supported" | "partial" | "unsupported";
        reason: string;
      }>;
    };
  } | null;
  readiness: {
    has_positions: boolean;
    reporting: {
      status: string;
      generated_at_utc: string | null;
      row_count: number;
    };
  };
  readiness_indicators?: PortfolioReadinessIndicator[];
  supportability?: PortfolioSupportabilitySummary | null;
  exception_summaries?: PortfolioExceptionSummary[];
  insights?: PortfolioInsight[];
  operations?: {
    business_date?: string | null;
    latest_booked_transaction_date?: string | null;
    latest_booked_position_snapshot_date?: string | null;
    publish_allowed?: boolean | null;
    controls_blocking?: boolean | null;
    active_reprocessing_keys?: number | null;
    stale_reprocessing_keys?: number | null;
    failed_valuation_jobs_within_window?: number | null;
    failed_aggregation_jobs_within_window?: number | null;
  } | null;
  workflow_cues: PortfolioWorkflowCue[];
  workflow_actions?: PortfolioWorkflowAction[];
  warnings: string[];
  partial_failures: PortfolioPartialFailure[];
};
