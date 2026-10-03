import { describe, expect, it } from "vitest";

import type { PortfolioWorkspace } from "../../src/apps/portfolio/types";
import {
  buildPortfolioReadinessIndicators,
  filterTransactionsByDrilldown,
  getPositionsNeedingPricing,
  getInvestedAssetWeight,
  getOrderedWorkflowCues,
  buildInitialPortfolioControls,
  buildPortfolioWorkspaceContext,
  derivePortfolioWorkspace,
  getBookReadinessStatus,
  getBookReadinessSupport,
  getReportingFreshnessSupport,
  getBookReadinessTone,
  getNetFlowTone,
  getReadinessTone,
  getRequestedWindowActivityAmount,
  getRequestedWindowActivityCount,
  getYearToDateActivityAmount,
  getYearToDateActivityCount,
  resolveEffectivePeriod,
  resolveTimeWindowStartDate,
} from "../../src/apps/portfolio/view-model";

function buildWorkspace(): PortfolioWorkspace {
  return {
    as_of_date: "2026-02-24",
    portfolio: {
      portfolio_id: "PORT_UI_1001",
      display_name: "Global Balanced",
      client_id: "CIF_1001",
      base_currency: "USD",
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
      market_value_base: 1250000,
      invested_market_value_base: 1145000,
      total_cash_base: 105000,
      cash_weight_pct: 8.4,
      position_count: 12,
      cash_balance_count: 2,
    },
    allocations: [],
    allocation_views: [],
    cash_balances: [],
    top_positions: [],
    positions: [],
    recent_transactions: [
      {
        transaction_id: "TX_OLD",
        transaction_date: "2025-10-01T08:30:00Z",
        transaction_type: "BUY",
        security_id: "EQ_OLD",
        instrument_id: "OLD",
        quantity: 10,
      },
      {
        transaction_id: "TX_RECENT",
        transaction_date: "2026-02-20T08:30:00Z",
        transaction_type: "BUY",
        security_id: "EQ_NEW",
        instrument_id: "NEW",
        quantity: 5,
      },
    ],
    income_summary: null,
    activity_summary: null,
    cashflow_outlook: {
      as_of_date: "2026-02-24",
      range_end_date: "2026-03-05",
      total_net_cashflow_base: -25000,
      projection_days: 10,
      include_projected: true,
      upcoming_points: [
        {
          projection_date: "2026-02-23",
          net_cashflow_base: -15000,
          projected_cumulative_cashflow_base: -15000,
        },
        {
          projection_date: "2026-02-25",
          net_cashflow_base: -5000,
          projected_cumulative_cashflow_base: -20000,
        },
      ],
    },
    performance: null,
    rebalance: null,
    control_capabilities: {
      historical_snapshots: {
        state: "unsupported",
        reason: "Historical as-of review is not available for this portfolio yet.",
        requested_as_of_date: "2026-02-24",
        effective_as_of_date: "2026-02-24",
        earliest_available_as_of_date: "2024-01-01",
        latest_available_as_of_date: "2026-02-24",
        module_capabilities: [],
      },
      reporting_currency_restatement: {
        state: "unsupported",
        reason: "Reporting currency restatement is not available for this portfolio yet.",
        requested_reporting_currency: null,
        effective_reporting_currency: "USD",
        supported_currencies: ["USD"],
        module_capabilities: [],
      },
    },
    readiness: {
      has_positions: false,
      reporting: {
        status: "READY",
        generated_at_utc: "2026-02-24T08:32:00Z",
        row_count: 14,
      },
    },
    operations: null,
    workflow_cues: [],
    warnings: [],
    partial_failures: [],
  };
}

describe("cash-derived invested weight", () => {
  it.each([
    ["positive cash", 900, 90],
    ["zero or no cash", 1000, 100],
    ["negative cash", 1100, 110],
    ["zero invested", 0, 0],
    ["unknown cash valuation", null, null],
    ["omitted invested evidence", undefined, null],
  ] as const)("preserves %s without substituting unknown invested value", (_label, invested, expected) => {
    const workspace = buildWorkspace();
    workspace.summary.market_value_base = 1000;
    workspace.summary.invested_market_value_base = invested;
    if (expected === null) expect(getInvestedAssetWeight(workspace)).toBeNull();
    else expect(getInvestedAssetWeight(workspace)).toBeCloseTo(expected, 10);
    expect(workspace.summary.market_value_base).toBe(1000);
    expect(workspace.summary.invested_market_value_base).toBe(invested);
  });

  it("keeps invested amount independent when the AUM denominator is zero", () => {
    const workspace = buildWorkspace();
    workspace.summary.market_value_base = 0;
    workspace.summary.invested_market_value_base = 100;
    expect(getInvestedAssetWeight(workspace)).toBeNull();
    expect(workspace.summary.invested_market_value_base).toBe(100);
  });
});

function buildOperationalWorkspace(): PortfolioWorkspace {
  const workspace = buildWorkspace();
  workspace.positions = [
    {
      security_id: "EQ_1",
      instrument_name: "Apple Inc",
      asset_class: "Equities",
      quantity: 10,
      market_value_base: 1800,
      weight_pct: 0.14,
    },
  ];
  workspace.top_positions = [
    {
      security_id: "EQ_1",
      instrument_name: "Apple Inc",
      asset_class: "Equities",
      quantity: 10,
      market_value_base: 1800,
      weight_pct: 0.14,
    },
  ];
  workspace.allocation_views = [
    {
      dimension: "asset_class",
      buckets: [
        {
          bucket: "Equities",
          position_count: 1,
          market_value_base: 1800,
          weight_pct: 0.14,
        },
      ],
    },
  ];
  workspace.activity_summary = {
    reporting_currency: "USD",
    window_start_date: "2026-01-24",
    window_end_date: "2026-02-24",
    buckets: [
      {
        bucket: "INFLOWS",
        requested_window: {
          reporting_currency_amount: 1000,
          portfolio_currency_amount: 1000,
          transaction_count: 1,
        },
        year_to_date: {
          reporting_currency_amount: 3000,
          portfolio_currency_amount: 3000,
          transaction_count: 3,
        },
      },
      {
        bucket: "FEES",
        requested_window: {
          reporting_currency_amount: -250,
          portfolio_currency_amount: -250,
          transaction_count: 1,
        },
        year_to_date: {
          reporting_currency_amount: -500,
          portfolio_currency_amount: -500,
          transaction_count: 2,
        },
      },
    ],
  };
  workspace.cash_balances = [
    {
      security_id: "CASH_USD",
      instrument_name: "USD Operating Cash",
      quantity: 10000,
      market_value_base: 10000,
      weight_pct: 0.8,
    },
  ];
  workspace.readiness.has_positions = true;
  workspace.operations = {
    publish_allowed: true,
    controls_blocking: false,
    latest_booked_transaction_date: "2026-02-20",
  };
  workspace.workflow_cues = [
    { key: "risk", label: "Risk", href: "/risk" },
    { key: "performance", label: "Performance", href: "/performance" },
  ];
  return workspace;
}

describe("portfolio view model", () => {
  it("keeps absent source context free of a fabricated business date", () => {
    const controls = buildInitialPortfolioControls(null);

    expect(controls.asOfDate).toBe("");
    expect(buildPortfolioWorkspaceContext(null, controls)).toEqual(
      expect.objectContaining({
        selectedAsOfDate: "",
        periodLabel: "Business date not confirmed",
        effectivePeriodStartDate: "",
        effectivePeriodEndDate: "",
      }),
    );
  });

  it("resolves time windows against the selected as-of date", () => {
    expect(resolveTimeWindowStartDate("2026-02-24", "7D", "2024-01-01")).toBe("2026-02-17");
    expect(resolveTimeWindowStartDate("2026-02-24", "30D", "2024-01-01")).toBe("2026-01-25");
    expect(resolveTimeWindowStartDate("2026-02-24", "MTD", "2024-01-01")).toBe("2026-02-01");
    expect(resolveTimeWindowStartDate("2026-05-24", "QTD", "2024-01-01")).toBe("2026-04-01");
    expect(resolveTimeWindowStartDate("2026-02-24", "YTD", "2024-01-01")).toBe("2026-01-01");
    expect(resolveTimeWindowStartDate("2026-02-24", "1Y", "2024-01-01")).toBe("2025-02-25");
    expect(resolveTimeWindowStartDate("2026-02-24", "SI", "2024-01-01")).toBe("2024-01-01");
  });

  it("uses gateway reporting-currency capability metadata instead of local heuristics", () => {
    const workspace = buildOperationalWorkspace();
    workspace.control_capabilities = {
      ...workspace.control_capabilities!,
      reporting_currency_restatement: {
        state: "supported",
        reason: "Gateway confirms reporting-currency restatement across the workspace.",
        requested_reporting_currency: "SGD",
        effective_reporting_currency: "SGD",
        supported_currencies: ["USD", "SGD"],
        module_capabilities: [],
      },
    };

    const context = buildPortfolioWorkspaceContext(workspace, {
      ...buildInitialPortfolioControls(workspace),
      reportingCurrency: "SGD",
    });

    expect(context.currencyOptions).toEqual(["USD", "SGD"]);
    expect(context.selectedReportingCurrency).toBe("SGD");
    expect(context.reportingCurrencyRestatementState).toBe("supported");
    expect(context.reportingCurrencyRestatementReason).toBe(
      "Gateway confirms reporting-currency restatement across the workspace."
    );
    expect(context.supportsReportingCurrencyRestatement).toBe(true);
  });

  it("derives an effective custom period in detailed mode", () => {
    expect(
      resolveEffectivePeriod("2026-02-24", "30D", "2024-01-01", "2026-02-01", "2026-02-20")
    ).toEqual({
      startDate: "2026-02-01",
      endDate: "2026-02-20",
      isCustomRange: true,
      label: "Custom",
    });
  });

  it("filters transactions and forecast points to the selected context", () => {
    const workspace = buildWorkspace();
    const controls = {
      ...buildInitialPortfolioControls(workspace),
      timeWindow: "30D" as const,
      asOfDate: "2026-02-24",
    };

    const derived = derivePortfolioWorkspace(workspace, controls);

    expect(derived?.recent_transactions).toHaveLength(1);
    expect(derived?.recent_transactions[0].transaction_id).toBe("TX_RECENT");
    expect(derived?.cashflow_outlook?.upcoming_points).toHaveLength(1);
    expect(derived?.cashflow_outlook?.upcoming_points[0].projection_date).toBe("2026-02-25");
  });

  it("supports transaction drill-down filters and pricing review", () => {
    const workspace = buildOperationalWorkspace();
    workspace.positions = [
      {
        security_id: "EQ_1",
        instrument_name: "Apple Inc",
        asset_class: "Equities",
        sector: "Technology",
        country_of_risk: "United States",
        quantity: 10,
        market_price: 180,
        market_value_base: 1800,
        weight_pct: 0.14,
      },
      {
        security_id: "FI_1",
        instrument_name: "Gov Bond",
        asset_class: "Fixed Income",
        sector: "Government",
        country_of_risk: "United States",
        quantity: 4,
        market_price: null,
        market_value_base: null,
        weight_pct: 0,
      },
    ];
    workspace.recent_transactions = [
      {
        transaction_id: "TX_FUND",
        transaction_date: "2026-02-19T08:30:00Z",
        transaction_type: "SUBSCRIPTION",
        component_type: "CASH",
        security_id: "CASH_USD",
        instrument_id: "USD",
        quantity: 1,
        net_cost_base: 100000,
      },
      {
        transaction_id: "TX_BUY",
        transaction_date: "2026-02-20T08:30:00Z",
        transaction_type: "BUY",
        component_type: "TRADE",
        linked_transaction_group_id: "LTG-FX-2026-0001",
        fx_contract_id: "FXC-2026-0001",
        swap_event_id: "FXSWAP-2026-0001",
        near_leg_group_id: "FXSWAP-2026-0001-NEAR",
        far_leg_group_id: "FXSWAP-2026-0001-FAR",
        security_id: "EQ_1",
        instrument_id: "AAPL",
        quantity: 10,
        net_cost_base: -1800,
      },
    ];

    expect(
      filterTransactionsByDrilldown(workspace.recent_transactions, {
        kind: "activity",
        bucket: "INFLOWS",
        label: "Filtered by activity: Inflows",
      })
    ).toHaveLength(1);
    expect(
      filterTransactionsByDrilldown(workspace.recent_transactions, {
        kind: "security",
        security_id: "EQ_1",
        label: "Filtered by security: Apple Inc",
      })[0].transaction_id
    ).toBe("TX_BUY");
    expect(
      filterTransactionsByDrilldown(workspace.recent_transactions, {
        kind: "linked_group",
        linked_transaction_group_id: "LTG-FX-2026-0001",
        label: "Filtered by transaction group: LTG-FX-2026-0001",
      })[0].transaction_id
    ).toBe("TX_BUY");
    expect(
      filterTransactionsByDrilldown(workspace.recent_transactions, {
        kind: "fx_contract",
        fx_contract_id: "FXC-2026-0001",
        label: "Filtered by FX contract: FXC-2026-0001",
      })[0].transaction_id
    ).toBe("TX_BUY");
    expect(
      filterTransactionsByDrilldown(workspace.recent_transactions, {
        kind: "swap_event",
        swap_event_id: "FXSWAP-2026-0001",
        label: "Filtered by swap event: FXSWAP-2026-0001",
      })[0].transaction_id
    ).toBe("TX_BUY");
    expect(
      filterTransactionsByDrilldown(workspace.recent_transactions, {
        kind: "near_leg_group",
        near_leg_group_id: "FXSWAP-2026-0001-NEAR",
        label: "Filtered by near-leg group: FXSWAP-2026-0001-NEAR",
      })[0].transaction_id
    ).toBe("TX_BUY");
    expect(
      filterTransactionsByDrilldown(workspace.recent_transactions, {
        kind: "far_leg_group",
        far_leg_group_id: "FXSWAP-2026-0001-FAR",
        label: "Filtered by far-leg group: FXSWAP-2026-0001-FAR",
      })[0].transaction_id
    ).toBe("TX_BUY");
    expect(getPositionsNeedingPricing(workspace)[0].security_id).toBe("FI_1");
  });

  it("builds a clamped context for unsupported historical snapshots", () => {
    const workspace = buildWorkspace();
    const context = buildPortfolioWorkspaceContext(workspace, {
      ...buildInitialPortfolioControls(workspace),
      asOfDate: "2027-01-01",
    });

    expect(context.selectedAsOfDate).toBe("2026-02-24");
    expect(context.hasHistoricalGap).toBe(false);
    expect(context.currencyOptions).toEqual(["USD"]);
    expect(context.periodLabel).toBe("30D");
    expect(context.effectivePeriodStartDate).toBe("2026-01-25");
    expect(context.effectivePeriodEndDate).toBe("2026-02-24");
    expect(context.historicalSnapshotState).toBe("unsupported");
    expect(context.historicalSnapshotReason).toBe(
      "Historical as-of review is not available for this portfolio yet."
    );
    expect(context.supportsHistoricalSnapshots).toBe(false);
    expect(context.reportingCurrencyRestatementState).toBe("unsupported");
    expect(context.supportsReportingCurrencyRestatement).toBe(false);
  });

  it("keeps historical selection disabled until every rendered module can refresh", () => {
    const workspace = buildWorkspace();
    workspace.control_capabilities = {
      ...workspace.control_capabilities!,
      historical_snapshots: {
        state: "supported",
        reason: "Gateway confirms historical snapshot support across the workspace.",
        requested_as_of_date: "2025-06-01",
        effective_as_of_date: "2025-06-01",
        earliest_available_as_of_date: "2025-01-01",
        latest_available_as_of_date: "2026-02-24",
        module_capabilities: [],
      },
    };

    const context = buildPortfolioWorkspaceContext(workspace, {
      ...buildInitialPortfolioControls(workspace),
      asOfDate: "2025-06-01",
    });

    expect(context.historicalSnapshotState).toBe("supported");
    expect(context.historicalSnapshotReason).toBe(
      "Gateway confirms historical snapshot support across the workspace."
    );
    expect(context.supportsHistoricalSnapshots).toBe(false);
    expect(context.selectedAsOfDate).toBe("2025-06-01");
    expect(context.hasHistoricalGap).toBe(true);
  });

  it("derives portfolio readiness, activity, and workflow models", () => {
    const workspace = buildOperationalWorkspace();

    expect(getRequestedWindowActivityAmount(workspace)).toBe(750);
    expect(getYearToDateActivityAmount(workspace)).toBe(2500);
    expect(getRequestedWindowActivityCount(workspace)).toBe(2);
    expect(getYearToDateActivityCount(workspace)).toBe(5);
    expect(getNetFlowTone(workspace)).toBe("success");
    expect(getBookReadinessStatus(workspace)).toBe("Ready");
    expect(getBookReadinessSupport(workspace)).toBe(
      "Generated 24 Feb 2026, 08:32 UTC • 14 report rows",
    );
    expect(getBookReadinessTone(workspace)).toBe("success");

    expect(buildPortfolioReadinessIndicators(workspace)).toEqual([
      { key: "holdings", label: "Positions", status: "Ready", href: `/positions?portfolioId=${workspace.portfolio.portfolio_id}` },
      { key: "pricing", label: "Pricing", status: "Ready", href: "#portfolio-attention" },
      { key: "transactions", label: "Transactions", status: "Ready", href: `/transactions?portfolioId=${workspace.portfolio.portfolio_id}` },
      { key: "reporting", label: "Reporting", status: "Ready", href: "#portfolio-health" },
    ]);

    expect(getOrderedWorkflowCues(workspace)).toEqual([
      {
        key: "performance",
        label: "Performance",
        href: "/performance",
      },
      {
        key: "risk",
        label: "Risk",
        href: "/risk",
      },
    ]);
  });

  it("does not raise false funding or transaction exceptions when summary evidence exists", () => {
    const workspace = buildOperationalWorkspace();
    workspace.cash_balances = [];
    workspace.recent_transactions = [];

    expect(buildPortfolioReadinessIndicators(workspace)).toEqual([
      { key: "holdings", label: "Positions", status: "Ready", href: `/positions?portfolioId=${workspace.portfolio.portfolio_id}` },
      { key: "pricing", label: "Pricing", status: "Ready", href: "#portfolio-attention" },
      { key: "transactions", label: "Transactions", status: "Ready", href: `/transactions?portfolioId=${workspace.portfolio.portfolio_id}` },
      { key: "reporting", label: "Reporting", status: "Ready", href: "#portfolio-health" },
    ]);
  });

  it("derives the empty-portfolio onboarding sequence", () => {
    const workspace = buildWorkspace();
    workspace.recent_transactions = [];
    workspace.summary.position_count = 0;
    workspace.summary.cash_balance_count = 0;
    workspace.summary.total_cash_base = 0;
    workspace.summary.cash_weight_pct = 0;
    workspace.cash_balances = [];
    workspace.activity_summary = null;
    workspace.readiness.reporting.status = "EMPTY";
    workspace.readiness.reporting.row_count = 0;

    expect(getOrderedWorkflowCues(workspace)).toEqual([]);
    expect(buildPortfolioReadinessIndicators(workspace).map((indicator) => indicator.status)).toEqual([
      "Missing",
      "Missing",
      "Missing",
      "Empty",
    ]);
    expect(getReadinessTone("Missing")).toBe("danger");
    expect(getReadinessTone("Empty")).toBe("warn");
  });

  it("formats reporting freshness support from published row evidence", () => {
    const workspace = buildWorkspace();

    expect(getReportingFreshnessSupport(workspace)).toBe(
      "Generated 24 Feb 2026, 08:32 UTC • 14 report rows",
    );
    expect(getBookReadinessSupport(workspace)).toBe(
      "Generated 24 Feb 2026, 08:32 UTC • 14 report rows",
    );

    workspace.readiness.reporting.generated_at_utc = null;
    expect(getReportingFreshnessSupport(workspace)).toBe("14 report rows published");

    workspace.readiness.reporting.status = "PENDING";
    expect(getReportingFreshnessSupport(workspace)).toBe("14 report rows published");

    workspace.readiness.reporting.status = "EMPTY";
    workspace.readiness.reporting.row_count = 0;
    expect(getReportingFreshnessSupport(workspace)).toBe("No published report rows");
  });

  it("prioritizes operational control and booking support in book readiness messaging", () => {
    const workspace = buildWorkspace();
    workspace.readiness.reporting.status = "PENDING";
    workspace.readiness.reporting.row_count = 0;
    workspace.operations = {
      publish_allowed: false,
      controls_blocking: true,
      latest_booked_transaction_date: "2026-02-20",
    };

    expect(getBookReadinessSupport(workspace)).toBe("Blocking controls active");

    workspace.operations.controls_blocking = false;
    expect(getBookReadinessSupport(workspace)).toBe("Publication currently blocked");

    workspace.operations.publish_allowed = null;
    workspace.readiness.has_positions = true;
    expect(getBookReadinessSupport(workspace)).toBe("Latest booking 20 Feb 2026");
  });

});
