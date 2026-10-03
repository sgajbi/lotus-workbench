import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getPortfolioCatalog,
  getPortfolioAllocationViews,
  getPortfolioBook,
  getPortfolioProjectedCashflow,
  getRequiredPortfolioBook,
  getPortfolioTransactionLedger,
  getPortfolioWorkspaceDetailedDetails,
  getPortfolioWorkspaceShell,
  getPortfolioWorkspaceSummaryDetails,
  mergePortfolioWorkspace,
} from "../../src/apps/portfolio/api";
import {
  getAnalyticsUiMetricEvents,
  resetAnalyticsUiMetricEvents,
} from "../../src/features/analytics-observability/metrics";
import { buildPortfolioWorkspace } from "../fixtures/portfolio-workspace-component-fixtures";

describe("portfolio api", () => {
  beforeEach(() => {
    vi.stubEnv("LOTUS_ENVIRONMENT", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetAnalyticsUiMetricEvents();
  });

  it("builds a shell workspace without waiting for detail modules", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = input.toString();

        if (url.includes("/workspace")) {
          return jsonResponse({
            as_of_date: "2026-03-28",
            portfolio: {
              portfolio_id: "MANUAL_PB_USD_001",
              display_name: "MANUAL_PB_USD_001",
              client_id: "MANUAL_CIF_001",
              base_currency: "USD",
              booking_center_code: "Singapore",
            },
            profile: {
              status: "ACTIVE",
              portfolio_type: "Advisory",
              risk_exposure: "Moderate Growth",
              investment_time_horizon: "Long Term",
              objective: "Long-term capital appreciation.",
              is_leverage_allowed: false,
              advisor_id: "ADV_1001",
              open_date: "2024-01-15",
              close_date: null,
            },
            summary: {
              assets_under_management_base: 1001550.05,
              invested_market_value_base: 917032.95,
              cash_market_value_base: 84517.1,
              cash_weight_pct: 8.43863,
              position_count: 9,
              cash_balance_count: 2,
            },
            cashflow_outlook: null,
            performance: {
              period: "YTD",
              return_pct: 2.5,
            },
            rebalance: {
              status: "PENDING_REVIEW",
              last_run_at_utc: "2026-03-27T12:00:00Z",
              last_rebalance_run_id: "rr_100",
              supportability: {
                feature_key: "manage.observability.action_register_supportability",
                state: "healthy",
                reason: "action_register_current",
                freshness_bucket: "fresh",
                run_count: 4,
                operation_count: 12,
                workflow_decision_count: 3,
              },
            },
            control_capabilities: {
              historical_snapshots: {
                state: "partial",
                reason: "Most modules honor as_of_date.",
                requested_as_of_date: "2026-03-28",
                effective_as_of_date: "2026-03-28",
                earliest_available_as_of_date: "2024-01-15",
                latest_available_as_of_date: "2026-03-28",
                module_capabilities: [
                  {
                    module: "book",
                    state: "supported",
                    reason: "Book accepts and honors as_of_date directly.",
                  },
                ],
              },
              reporting_currency_restatement: {
                state: "partial",
                reason: "Only some modules honor reporting currency.",
                requested_reporting_currency: null,
                effective_reporting_currency: "USD",
                supported_currencies: ["USD", "SGD"],
                module_capabilities: [
                  {
                    module: "positions",
                    state: "supported",
                    reason: "Positions accept and honor reporting_currency directly.",
                  },
                ],
              },
            },
            reporting: {
              status: "READY",
              generated_at_utc: null,
              row_count: 4,
            },
            operations: {
              business_date: "2026-03-28",
              latest_booked_transaction_date: null,
              latest_booked_position_snapshot_date: null,
              publish_allowed: true,
              controls_blocking: null,
              active_reprocessing_keys: null,
              stale_reprocessing_keys: null,
              failed_valuation_jobs_within_window: null,
              failed_aggregation_jobs_within_window: null,
            },
            workflow_cues: [{ key: "performance", label: "Performance", href: "/performance" }],
            warnings: [],
            partial_failures: [],
          });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const shell = await getPortfolioWorkspaceShell("MANUAL_PB_USD_001");

    expect(shell?.portfolio.portfolio_id).toBe("MANUAL_PB_USD_001");
    expect(shell?.profile).toEqual({
      status: "ACTIVE",
      portfolio_type: "Advisory",
      risk_exposure: "Moderate Growth",
      investment_time_horizon: "Long Term",
      objective: "Long-term capital appreciation.",
      is_leverage_allowed: false,
      advisor_id: "ADV_1001",
      open_date: "2024-01-15",
      close_date: null,
    });
    expect(shell?.allocations).toEqual([]);
    expect(shell?.positions).toEqual([]);
    expect(shell?.recent_transactions).toEqual([]);
    expect(shell?.performance).toEqual({
      period: "YTD",
      return_pct: 2.5,
    });
    expect(shell?.rebalance).toEqual({
      status: "PENDING_REVIEW",
      last_run_at_utc: "2026-03-27T12:00:00Z",
      last_rebalance_run_id: "rr_100",
      supportability: {
        feature_key: "manage.observability.action_register_supportability",
        state: "healthy",
        reason: "action_register_current",
        freshness_bucket: "fresh",
        run_count: 4,
        operation_count: 12,
        workflow_decision_count: 3,
      },
    });
    expect(shell?.control_capabilities?.historical_snapshots.state).toBe("partial");
    expect(shell?.control_capabilities?.reporting_currency_restatement.supported_currencies).toEqual([
      "USD",
      "SGD",
    ]);
    expect(shell?.readiness.reporting).toEqual({
      status: "READY",
      generated_at_utc: null,
      row_count: 4,
    });
    expect(shell?.operations).toEqual({
      business_date: "2026-03-28",
      latest_booked_transaction_date: null,
      latest_booked_position_snapshot_date: null,
      publish_allowed: true,
      controls_blocking: null,
      active_reprocessing_keys: null,
      stale_reprocessing_keys: null,
      failed_valuation_jobs_within_window: null,
      failed_aggregation_jobs_within_window: null,
    });
    expect(shell?.readiness_indicators).toBeUndefined();
    expect(shell?.workflow_actions).toBeUndefined();
    expect(getAnalyticsUiMetricEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric_name: "lotus_workbench_panel_state_total",
          labels: expect.objectContaining({
            route: "workbench.portfolio",
            panel: "portfolio-workspace-shell",
            operation: "portfolio.workspace.shell",
            state: "ready",
            freshness_bucket: "fresh",
            supportability_state: "ready",
          }),
        }),
      ])
    );
    const metricsJson = JSON.stringify(getAnalyticsUiMetricEvents());
    expect(metricsJson).not.toContain("MANUAL_PB_USD_001");
    expect(metricsJson).not.toContain("MANUAL_CIF_001");
    expect(metricsJson).not.toContain("ADV_1001");
  });

  it("keeps tolerant portfolio callers isolated from required evidence reads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("gateway unavailable", { status: 503 }))
    );

    await expect(getPortfolioWorkspaceShell("PB_SG_GLOBAL_BAL_001")).resolves.toBeNull();
    await expect(getPortfolioBook("PB_SG_GLOBAL_BAL_001")).resolves.toBeNull();
    await expect(getRequiredPortfolioBook("PB_SG_GLOBAL_BAL_001")).rejects.toThrow(
      "Portfolio book evidence is unavailable."
    );
  });

  it("sends every date-sensitive proposal-book dimension to Gateway", async () => {
    const fetchSpy = vi.fn(async (_input: string | URL) =>
      jsonResponse({
        as_of_date: "2026-04-10",
        portfolio: {
          portfolio_id: "PB_SG_GLOBAL_BAL_001",
          display_name: "Global Balanced Portfolio",
          client_id: "CIF_001",
          base_currency: "USD",
          booking_center_code: "SGPB",
        },
        summary: {
          assets_under_management_base: 1000,
          invested_market_value_base: 900,
          cash_market_value_base: 100,
          cash_weight_pct: 10,
          position_count: 1,
          cash_balance_count: 1,
        },
        cash_balances: [],
        allocation_views: [],
        top_positions: [],
        positions: [],
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    await getRequiredPortfolioBook("PB_SG_GLOBAL_BAL_001", {
      asOfDate: "2026-04-10",
      reportingCurrency: "USD",
    });

    const requestedUrl = fetchSpy.mock.calls[0]?.[0]?.toString() ?? "";
    expect(requestedUrl).toContain(
      "/portfolio/portfolios/PB_SG_GLOBAL_BAL_001/book?"
    );
    expect(requestedUrl).toContain("as_of_date=2026-04-10");
    expect(requestedUrl).toContain("reporting_currency=USD");
  });

  it("keeps concurrent book reads independent and recontacts the source", async () => {
    const staleBook = {
      positions: [{ security_id: "STALE", instrument_name: "Stale holding", quantity: 1 }],
      top_positions: [],
      allocation_views: [],
    };
    const currentBook = {
      positions: [{ security_id: "CURRENT", instrument_name: "Current holding", quantity: 2 }],
      top_positions: [],
      allocation_views: [],
    };
    let resolveStale: ((response: Response) => void) | undefined;
    let resolveCurrent: ((response: Response) => void) | undefined;
    const fetchSpy = vi
      .fn()
      .mockImplementationOnce(
        async () =>
          await new Promise<Response>((resolve) => {
            resolveStale = resolve;
          })
      )
      .mockImplementationOnce(
        async () =>
          await new Promise<Response>((resolve) => {
            resolveCurrent = resolve;
          })
      )
      .mockResolvedValueOnce(jsonResponse(currentBook));
    vi.stubGlobal("fetch", fetchSpy);
    const params = { asOfDate: "2026-04-10", reportingCurrency: "USD" };

    const staleRequest = getPortfolioBook("PB_SG_GLOBAL_BAL_001", params);
    const currentRequest = getRequiredPortfolioBook("PB_SG_GLOBAL_BAL_001", params);

    resolveCurrent?.(jsonResponse(currentBook));
    expect((await currentRequest).positions[0]?.security_id).toBe("CURRENT");
    resolveStale?.(jsonResponse(staleBook));
    expect((await staleRequest)?.positions[0]?.security_id).toBe("STALE");

    const latest = await getPortfolioBook("PB_SG_GLOBAL_BAL_001", params);
    expect(latest?.positions[0]?.security_id).toBe("CURRENT");
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("keeps shell workspace compatible when gateway omits optional performance fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = input.toString();

        if (url.includes("/workspace")) {
          return jsonResponse({
            as_of_date: "2026-03-28",
            portfolio: {
              portfolio_id: "MANUAL_PB_USD_001",
              display_name: "MANUAL_PB_USD_001",
              client_id: "MANUAL_CIF_001",
              base_currency: "USD",
              booking_center_code: "Singapore",
            },
            profile: {
              status: "ACTIVE",
              portfolio_type: "Advisory",
            },
            summary: {
              assets_under_management_base: 1001550.05,
              invested_market_value_base: 917032.95,
              cash_market_value_base: 84517.1,
              cash_weight_pct: 8.43863,
              position_count: 9,
              cash_balance_count: 2,
            },
            cashflow_outlook: null,
            performance: null,
            rebalance: null,
            control_capabilities: null,
            reporting: {
              status: "READY",
              generated_at_utc: "2026-03-28T08:00:00Z",
              row_count: 4,
            },
            workflow_cues: [],
            warnings: [],
            partial_failures: [],
          });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const shell = await getPortfolioWorkspaceShell("MANUAL_PB_USD_001");

    expect(shell?.performance).toBeNull();
    expect(shell?.rebalance).toBeNull();
    expect(shell?.control_capabilities).toBeNull();
  });

  it("loads summary evidence and source workflow actions without detailed ledger or liquidity slices", async () => {
    const fetchSpy = vi.fn(async (input: string | URL) => {
      const url = input.toString();

      if (url.includes("/book")) {
        return jsonResponse({
          as_of_date: "2026-03-28",
          summary: {
            assets_under_management_base: 982500,
            invested_market_value_base: 900000,
            cash_market_value_base: 82500,
            cash_weight_pct: 8.3969,
            position_count: 3,
            cash_balance_count: 1,
          },
          allocation_views: [
            {
              dimension: "asset_class",
              buckets: [
                {
                  bucket: "Equities",
                  position_count: 3,
                  market_value_base: 349705,
                  weight_pct: 34.92,
                },
              ],
            },
          ],
          top_positions: [
            {
              security_id: "EQ_US_AAPL_MANUAL_001",
              instrument_name: "Apple Inc.",
              asset_class: "Equities",
              quantity: 700,
              market_value_base: 147000,
              weight_pct: 14.67,
            },
          ],
          positions: [
            {
              security_id: "EQ_US_AAPL_MANUAL_001",
              instrument_name: "Apple Inc.",
              asset_class: "Equities",
              quantity: 700,
              market_value_base: 147000,
              market_value_local: 147000,
              weight_pct: 14.67,
            },
          ],
        });
      }

      if (url.includes("/income-summary")) {
        return jsonResponse({
          reporting_currency: "USD",
          window_start_date: "2026-03-01",
          window_end_date: "2026-03-28",
          totals_requested_window: {
            gross: { reporting_currency_amount: 350, transaction_count: 1 },
            withholding_tax: { reporting_currency_amount: 0, transaction_count: 1 },
            other_deductions: { reporting_currency_amount: 0, transaction_count: 1 },
            net: { reporting_currency_amount: 350, transaction_count: 1 },
          },
          totals_year_to_date: {
            gross: { reporting_currency_amount: 350, transaction_count: 1 },
            withholding_tax: { reporting_currency_amount: 0, transaction_count: 1 },
            other_deductions: { reporting_currency_amount: 0, transaction_count: 1 },
            net: { reporting_currency_amount: 350, transaction_count: 1 },
          },
          income_types: [],
        });
      }

      if (url.includes("/activity-summary")) {
        return jsonResponse({
          reporting_currency: "USD",
          window_start_date: "2026-03-01",
          window_end_date: "2026-03-28",
          buckets: [],
        });
      }

      if (url.includes("/workflow")) {
        return jsonResponse({
          actions: [
            {
              sequence: 1,
              title: "Review performance evidence",
              impact: "Confirm incomplete valuation history before client use.",
              target: "Performance review",
              href: "/performance?portfolioId=MANUAL_PB_USD_001",
              cta_label: "Open Performance",
              recommended: true,
            },
          ],
        });
      }

      if (url.includes("/portfolio/portfolios/MANUAL_PB_USD_001/performance-snapshot?")) {
        return jsonResponse({
          period: "EXPLICIT",
          as_of_date: "2026-03-28",
          report_start_date: "2026-03-01",
          report_end_date: "2026-03-28",
          benchmark_code: "BMK_GLOBAL_BALANCED_60_40",
          portfolio_return_pct: 5.12,
          benchmark_return_pct: 4.91,
          excess_return_pct: 0.21,
          warnings: ["Benchmark history contains one delayed market close."],
          partial_failures: [
            {
              source_service: "lotus-performance",
              error_code: "MARKET_DATA_DELAY",
              detail: "One benchmark data point was delayed and backfilled.",
            },
          ],
          sparkline: [
            {
              as_of_date: "2026-03-01",
              portfolio_return_pct: 1.1,
              benchmark_return_pct: 0.9,
              excess_return_pct: 0.2,
            },
            {
              as_of_date: "2026-03-14",
              portfolio_return_pct: 2.9,
              benchmark_return_pct: 2.5,
              excess_return_pct: 0.4,
            },
            {
              as_of_date: "2026-03-28",
              portfolio_return_pct: 5.12,
              benchmark_return_pct: 4.91,
              excess_return_pct: 0.21,
            },
          ],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchSpy);

    const details = await getPortfolioWorkspaceSummaryDetails("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      reportingCurrency: "USD",
      includeProjected: false,
      timeWindow: "30D",
      reportStartDate: "2026-03-01",
      reportEndDate: "2026-03-28",
    });

    expect(details?.allocation_views?.[0].dimension).toBe("asset_class");
    expect(details?.as_of_date).toBe("2026-03-28");
    expect(details?.summary).toEqual({
      market_value_base: 982500,
      invested_market_value_base: 900000,
      total_cash_base: 82500,
      cash_weight_pct: 8.3969,
      position_count: 3,
      cash_balance_count: 1,
    });
    expect(details?.top_positions[0].market_value_base).toBe(147000);
    expect(details?.positions[0].market_value_local).toBe(147000);
    expect(details?.income_summary?.totals_requested_window.net.reporting_currency_amount).toBe(350);
    expect(details?.performance).toMatchObject({
      period: "EXPLICIT",
      report_start_date: "2026-03-01",
      report_end_date: "2026-03-28",
      return_pct: 5.12,
      benchmark_return_pct: 4.91,
      excess_return_pct: 0.21,
      money_weighted_return_pct: null,
      money_weighted_method: null,
      benchmark_code: "BMK_GLOBAL_BALANCED_60_40",
      benchmark_label: null,
      benchmark_return_source: null,
      benchmark_input_mode: null,
      warnings: ["Benchmark history contains one delayed market close."],
      partial_failures: [
        {
          source_service: "lotus-performance",
          error_code: "MARKET_DATA_DELAY",
          detail: "One benchmark data point was delayed and backfilled.",
        },
      ],
      sparkline_points: [
        {
          label: "2026-03-01",
          portfolio_return_pct: 1.1,
          benchmark_return_pct: 0.9,
          active_return_pct: 0.2,
        },
        {
          label: "2026-03-14",
          portfolio_return_pct: 2.9,
          benchmark_return_pct: 2.5,
          active_return_pct: 0.4,
        },
        {
          label: "2026-03-28",
          portfolio_return_pct: 5.12,
          benchmark_return_pct: 4.91,
          active_return_pct: 0.21,
        },
      ],
    });
    expect(details?.readiness_indicators).toBeUndefined();
    expect(details?.insights).toBeUndefined();
    expect(details?.exception_summaries).toBeUndefined();
    expect(details?.workflow_actions?.[0]).toMatchObject({
      title: "Review performance evidence",
      cta_label: "Open Performance",
      recommended: true,
    });

    const requestedUrls = fetchSpy.mock.calls.map((call) => String(call[0]));
    expect(requestedUrls.some((url) => url.includes("/liquidity"))).toBe(false);
    expect(requestedUrls.some((url) => url.includes("/transactions"))).toBe(false);
    expect(requestedUrls.some((url) => url.includes("/readiness"))).toBe(false);
    expect(requestedUrls.some((url) => url.includes("/insights"))).toBe(false);
    expect(
      requestedUrls.some(
        (url) =>
          url.includes("/portfolio/portfolios/MANUAL_PB_USD_001/workflow?") &&
          url.includes("as_of_date=2026-03-28")
      )
    ).toBe(true);
    expect(
      requestedUrls.some(
        (url) =>
          url.includes("/portfolio/portfolios/MANUAL_PB_USD_001/income-summary?") &&
          url.includes("as_of_date=2026-03-28") &&
          url.includes("start_date=2026-03-01") &&
          url.includes("end_date=2026-03-28") &&
          url.includes("reporting_currency=USD")
      )
    ).toBe(true);
    expect(
      requestedUrls.some(
        (url) =>
          url.includes("/portfolio/portfolios/MANUAL_PB_USD_001/activity-summary?") &&
          url.includes("as_of_date=2026-03-28") &&
          url.includes("start_date=2026-03-01") &&
          url.includes("end_date=2026-03-28") &&
          url.includes("reporting_currency=USD")
      )
    ).toBe(true);
    expect(
      requestedUrls.some(
        (url) =>
          url.includes("/portfolio/portfolios/MANUAL_PB_USD_001/book?") &&
          url.includes("as_of_date=2026-03-28") &&
          url.includes("reporting_currency=USD") &&
          url.includes("include_projected=false")
      )
    ).toBe(true);
    expect(
      requestedUrls.some(
        (url) =>
          url.includes("/portfolio/portfolios/MANUAL_PB_USD_001/performance-snapshot?") &&
          url.includes("period=EXPLICIT") &&
          url.includes("report_start_date=2026-03-01") &&
          url.includes("report_end_date=2026-03-28")
      )
    ).toBe(true);
    expect(requestedUrls.some((url) => url.includes("/allocations"))).toBe(false);
    expect(requestedUrls.some((url) => url.includes("/positions"))).toBe(false);
    expect(requestedUrls.some((url) => url.includes("/performance/details"))).toBe(false);
    expect(requestedUrls.some((url) => url.includes("/performance/summary"))).toBe(false);
  });

  it("clears prior dated workflow actions when the selected-date source read fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = input.toString();
        const summaryResponse = portfolioSummaryEvidenceResponse(url);
        if (summaryResponse) {
          return summaryResponse;
        }
        if (url.includes("/workflow")) {
          return new Response("workflow unavailable", { status: 503 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const details = await getPortfolioWorkspaceSummaryDetails("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-29",
      reportingCurrency: "USD",
      includeProjected: false,
      timeWindow: "30D",
      reportStartDate: "2026-03-02",
      reportEndDate: "2026-03-29",
    });
    const priorWorkspace = {
      ...buildPortfolioWorkspace(),
      workflow_actions: [
        {
          sequence: 1,
          title: "Review prior-date evidence",
          impact: "Action belongs to the prior review date.",
          target: "Prior date",
          href: "/performance",
          cta_label: "Open Performance",
          recommended: true,
        },
      ],
    };

    expect(details?.workflow_actions).toEqual([]);
    expect(mergePortfolioWorkspace(priorWorkspace, details ?? {}).workflow_actions).toEqual([]);
  });

  it("omits the summary workflow read when another record-screen loader owns it", async () => {
    const fetchSpy = vi.fn(async (input: string | URL) => {
      const url = input.toString();
      const summaryResponse = portfolioSummaryEvidenceResponse(url);
      if (summaryResponse) {
        return summaryResponse;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchSpy);

    const details = await getPortfolioWorkspaceSummaryDetails("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      reportingCurrency: "USD",
      includeProjected: false,
      timeWindow: "30D",
      reportStartDate: "2026-03-01",
      reportEndDate: "2026-03-28",
      includeWorkflowActions: false,
    });

    expect(details?.workflow_actions).toBeUndefined();
    expect(fetchSpy.mock.calls.some(([input]) => String(input).includes("/workflow"))).toBe(false);
  });

  it.each([
    { positionCount: 0, expectedHasPositions: false },
    { positionCount: 3, expectedHasPositions: true },
  ])(
    "replaces shell holdings readiness atomically from a dated $positionCount-position summary",
    ({ positionCount, expectedHasPositions }) => {
      const workspace = buildPortfolioWorkspace({
        readiness: {
          has_positions: positionCount === 0,
          reporting: {
            status: "READY",
            generated_at_utc: "2026-05-12T00:00:00Z",
            row_count: 11,
          },
        },
      });

      const merged = mergePortfolioWorkspace(workspace, {
        as_of_date: "2026-04-30",
        summary: {
          market_value_base: positionCount === 0 ? 0 : 750000,
          invested_market_value_base: positionCount === 0 ? 0 : 700000,
          total_cash_base: positionCount === 0 ? 0 : 50000,
          cash_weight_pct: positionCount === 0 ? 0 : 6.67,
          position_count: positionCount,
          cash_balance_count: positionCount === 0 ? 0 : 1,
        },
      });

      expect(merged.as_of_date).toBe("2026-04-30");
      expect(merged.summary.position_count).toBe(positionCount);
      expect(merged.readiness.has_positions).toBe(expectedHasPositions);
      expect(merged.readiness.reporting).toEqual(workspace.readiness.reporting);
    }
  );

  it("retains shell holdings readiness when dated summary evidence is incomplete", () => {
    const workspace = buildPortfolioWorkspace({
      readiness: {
        has_positions: true,
        reporting: {
          status: "READY",
          generated_at_utc: "2026-05-12T00:00:00Z",
          row_count: 11,
        },
      },
    });

    const merged = mergePortfolioWorkspace(workspace, {
      performance: null,
    });

    expect(merged.readiness).toEqual(workspace.readiness);
  });

  it("preserves dated book evidence when one standard performance period fails", async () => {
    let mtdAttempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = input.toString();

        if (url.includes("/book")) {
          return jsonResponse({
            as_of_date: "2026-03-28",
            summary: {
              assets_under_management_base: 982500,
              invested_market_value_base: 900000,
              cash_market_value_base: 82500,
              cash_weight_pct: 8.3969,
              position_count: 3,
              cash_balance_count: 1,
            },
            allocation_views: [{ dimension: "asset_class", buckets: [] }],
            top_positions: [],
            positions: [],
          });
        }
        if (url.includes("/income-summary")) {
          return jsonResponse({ reporting_currency: "USD" });
        }
        if (url.includes("/activity-summary")) {
          return jsonResponse({ reporting_currency: "USD", buckets: [] });
        }
        if (url.includes("/performance-snapshot") && url.includes("period=MTD")) {
          mtdAttempts += 1;
          if (mtdAttempts === 1) {
            throw new Error("Gateway connection interrupted");
          }
        }
        if (url.includes("/performance-snapshot")) {
          const period = url.includes("period=MTD")
            ? "MTD"
            : url.includes("period=QTD")
              ? "QTD"
              : url.includes("period=YTD")
                ? "YTD"
                : "EXPLICIT";
          const portfolioReturn =
            period === "MTD" ? 0.8 : period === "QTD" ? 1.2 : period === "YTD" ? 4.5 : 2.4;
          return jsonResponse({
            period,
            as_of_date: "2026-03-28",
            report_start_date: period === "EXPLICIT" ? "2026-03-01" : null,
            report_end_date: "2026-03-28",
            benchmark_code: "BMK_GLOBAL_BALANCED_60_40",
            portfolio_return_pct: portfolioReturn,
            benchmark_return_pct: null,
            excess_return_pct: null,
            warnings: [],
            partial_failures: [],
            sparkline: [],
          });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const details = await getPortfolioWorkspaceSummaryDetails("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      reportingCurrency: "USD",
      includeProjected: false,
      timeWindow: "30D",
      reportStartDate: "2026-03-01",
      reportEndDate: "2026-03-28",
    });

    expect(details?.as_of_date).toBe("2026-03-28");
    expect(details?.summary?.market_value_base).toBe(982500);
    expect(details?.income_summary).toMatchObject({ reporting_currency: "USD" });
    expect(details?.performance?.return_pct).toBe(2.4);
    expect(details?.performance_period_returns).toEqual([
      expect.objectContaining({ period: "MTD", return_pct: null }),
      expect.objectContaining({ period: "QTD", return_pct: 1.2 }),
      expect.objectContaining({ period: "YTD", return_pct: 4.5 }),
    ]);
    expect(details?.supporting_evidence_failures).toEqual([
      {
        evidence_scope: "standard_period_performance",
        period: "MTD",
        source_service: "lotus-gateway",
        title: "MTD performance unavailable",
        detail: "MTD performance evidence could not be retrieved through Gateway. No return is shown.",
      },
    ]);

    const recoveredDetails = await getPortfolioWorkspaceSummaryDetails("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      reportingCurrency: "USD",
      includeProjected: false,
      timeWindow: "30D",
      reportStartDate: "2026-03-01",
      reportEndDate: "2026-03-28",
    });

    expect(mtdAttempts).toBe(2);
    expect(recoveredDetails?.performance_period_returns?.[0]).toMatchObject({
      period: "MTD",
      return_pct: 0.8,
    });
    expect(recoveredDetails?.supporting_evidence_failures).toEqual([]);
  });

  it("withholds a standard-period return whose source window is newer than the review", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = input.toString();

        if (url.includes("/book")) {
          return jsonResponse({
            as_of_date: "2026-03-28",
            summary: {
              assets_under_management_base: 982500,
              invested_market_value_base: 900000,
              cash_market_value_base: 82500,
              cash_weight_pct: 8.3969,
              position_count: 3,
              cash_balance_count: 1,
            },
            allocation_views: [{ dimension: "asset_class", buckets: [] }],
            top_positions: [],
            positions: [],
          });
        }
        if (url.includes("/income-summary")) {
          return jsonResponse({ reporting_currency: "USD" });
        }
        if (url.includes("/activity-summary")) {
          return jsonResponse({ reporting_currency: "USD", buckets: [] });
        }
        if (url.includes("/performance-snapshot")) {
          const period = url.includes("period=MTD")
            ? "MTD"
            : url.includes("period=QTD")
              ? "QTD"
              : url.includes("period=YTD")
                ? "YTD"
                : "EXPLICIT";
          return jsonResponse({
            period,
            as_of_date: "2026-03-28",
            report_start_date: period === "EXPLICIT" ? "2026-03-01" : null,
            report_end_date: period === "QTD" ? "2026-03-31" : "2026-03-28",
            benchmark_code: null,
            portfolio_return_pct: period === "QTD" ? 9.9 : 2.4,
            benchmark_return_pct: null,
            excess_return_pct: null,
            warnings: [],
            partial_failures: [],
            sparkline: [],
          });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const details = await getPortfolioWorkspaceSummaryDetails("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      reportingCurrency: "USD",
      includeProjected: false,
      timeWindow: "30D",
      reportStartDate: "2026-03-01",
      reportEndDate: "2026-03-28",
    });

    expect(details?.performance?.return_pct).toBe(2.4);
    expect(details?.performance_period_returns).toEqual([
      expect.objectContaining({ period: "MTD", return_pct: 2.4 }),
      expect.objectContaining({ period: "QTD", return_pct: null }),
      expect.objectContaining({ period: "YTD", return_pct: 2.4 }),
    ]);
    expect(details?.supporting_evidence_failures).toContainEqual(
      expect.objectContaining({
        evidence_scope: "standard_period_performance",
        period: "QTD",
        title: "QTD performance unavailable",
      }),
    );
  });

  it("reuses a selected standard-period request and reports one limitation", async () => {
    const performanceRequests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = input.toString();

        if (url.includes("/book")) {
          return jsonResponse({
            as_of_date: "2026-03-28",
            summary: {
              assets_under_management_base: 982500,
              invested_market_value_base: 900000,
              cash_market_value_base: 82500,
              cash_weight_pct: 8.3969,
              position_count: 3,
              cash_balance_count: 1,
            },
            allocation_views: [{ dimension: "asset_class", buckets: [] }],
            top_positions: [],
            positions: [],
          });
        }
        if (url.includes("/income-summary")) {
          return jsonResponse({ reporting_currency: "USD" });
        }
        if (url.includes("/activity-summary")) {
          return jsonResponse({ reporting_currency: "USD", buckets: [] });
        }
        if (url.includes("/performance-snapshot")) {
          performanceRequests.push(url);
          if (url.includes("period=MTD")) {
            throw new Error("Gateway connection interrupted");
          }
          const period = url.includes("period=QTD") ? "QTD" : "YTD";
          return jsonResponse({
            period,
            as_of_date: "2026-03-28",
            report_end_date: "2026-03-28",
            benchmark_code: null,
            portfolio_return_pct: period === "QTD" ? 1.2 : 4.5,
            benchmark_return_pct: null,
            excess_return_pct: null,
            warnings: [],
            partial_failures: [],
            sparkline: [],
          });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const details = await getPortfolioWorkspaceSummaryDetails("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      reportingCurrency: "USD",
      includeProjected: false,
      timeWindow: "MTD",
      reportStartDate: "2026-03-01",
      reportEndDate: "2026-03-28",
      usesCustomDateRange: false,
    });

    expect(performanceRequests).toHaveLength(3);
    expect(details?.performance).toBeNull();
    expect(details?.performance_period_returns).toEqual([
      expect.objectContaining({ period: "MTD", return_pct: null }),
      expect.objectContaining({ period: "QTD", return_pct: 1.2 }),
      expect.objectContaining({ period: "YTD", return_pct: 4.5 }),
    ]);
    expect(details?.supporting_evidence_failures).toEqual([
      expect.objectContaining({
        evidence_scope: "standard_period_performance",
        period: "MTD",
        title: "MTD performance unavailable",
      }),
    ]);
  });

  it("preserves source-owned standard-period unavailable, warning, and partial evidence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = input.toString();

        if (url.includes("/book")) {
          return jsonResponse({
            as_of_date: "2026-03-28",
            summary: {
              assets_under_management_base: 982500,
              invested_market_value_base: 900000,
              cash_market_value_base: 82500,
              cash_weight_pct: 8.3969,
              position_count: 3,
              cash_balance_count: 1,
            },
            allocation_views: [{ dimension: "asset_class", buckets: [] }],
            top_positions: [],
            positions: [],
          });
        }
        if (url.includes("/income-summary")) {
          return jsonResponse({ reporting_currency: "USD" });
        }
        if (url.includes("/activity-summary")) {
          return jsonResponse({ reporting_currency: "USD", buckets: [] });
        }
        if (url.includes("/performance-snapshot")) {
          const period = url.includes("period=MTD")
            ? "MTD"
            : url.includes("period=QTD")
              ? "QTD"
              : url.includes("period=YTD")
                ? "YTD"
                : "EXPLICIT";
          return jsonResponse({
            period,
            as_of_date: "2026-03-28",
            report_start_date: period === "EXPLICIT" ? "2026-03-01" : null,
            report_end_date: "2026-03-28",
            benchmark_code: null,
            portfolio_return_pct: period === "MTD" ? null : 1,
            benchmark_return_pct: null,
            excess_return_pct: null,
            unavailable:
              period === "MTD"
                ? {
                    title: "Performance history incomplete",
                    detail: "MTD valuation history is incomplete.",
                    requirements: ["Daily valuations"],
                  }
                : null,
            warnings: period === "QTD" ? ["One benchmark close is delayed."] : [],
            partial_failures:
              period === "YTD"
                ? [
                    {
                      source_service: "lotus-performance",
                      error_code: "BENCHMARK_PARTIAL",
                      detail: "Benchmark-relative return is partial.",
                    },
                  ]
                : [],
            sparkline: [],
          });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const details = await getPortfolioWorkspaceSummaryDetails("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      reportingCurrency: "USD",
      includeProjected: false,
      timeWindow: "30D",
      reportStartDate: "2026-03-01",
      reportEndDate: "2026-03-28",
    });

    expect(details?.performance_period_returns).toEqual([
      expect.objectContaining({
        period: "MTD",
        return_pct: null,
        unavailable: expect.objectContaining({ detail: "MTD valuation history is incomplete." }),
      }),
      expect.objectContaining({
        period: "QTD",
        return_pct: 1,
        warnings: ["One benchmark close is delayed."],
      }),
      expect.objectContaining({
        period: "YTD",
        return_pct: 1,
        partial_failures: [
          expect.objectContaining({
            source_service: "lotus-performance",
            error_code: "BENCHMARK_PARTIAL",
          }),
        ],
      }),
    ]);
    expect(details?.supporting_evidence_failures).toEqual([]);
  });

  it("names unavailable income, activity, and selected-period evidence independently", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = input.toString();

        if (url.includes("/book")) {
          return jsonResponse({
            as_of_date: "2026-03-28",
            summary: {
              assets_under_management_base: 982500,
              invested_market_value_base: 900000,
              cash_market_value_base: 82500,
              cash_weight_pct: 8.3969,
              position_count: 3,
              cash_balance_count: 1,
            },
            allocation_views: [{ dimension: "asset_class", buckets: [] }],
            top_positions: [],
            positions: [],
          });
        }
        if (url.includes("/income-summary")) {
          return new Response(JSON.stringify({ code: "income_unavailable" }), { status: 503 });
        }
        if (url.includes("/activity-summary")) {
          throw new Error("Gateway connection interrupted");
        }
        if (url.includes("/performance-snapshot") && url.includes("period=EXPLICIT")) {
          return new Response(JSON.stringify({ code: "selected_performance_unavailable" }), {
            status: 503,
          });
        }
        if (url.includes("/performance-snapshot")) {
          const period = url.includes("period=MTD")
            ? "MTD"
            : url.includes("period=QTD")
              ? "QTD"
              : "YTD";
          return jsonResponse({
            period,
            as_of_date: "2026-03-28",
            report_end_date: "2026-03-28",
            benchmark_code: null,
            portfolio_return_pct: 1,
            benchmark_return_pct: null,
            excess_return_pct: null,
            warnings: [],
            partial_failures: [],
            sparkline: [],
          });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const details = await getPortfolioWorkspaceSummaryDetails("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      reportingCurrency: "USD",
      includeProjected: false,
      timeWindow: "30D",
      reportStartDate: "2026-03-01",
      reportEndDate: "2026-03-28",
    });

    expect(details?.summary?.market_value_base).toBe(982500);
    expect(details?.performance).toBeNull();
    expect(details?.performance_period_returns?.map((row) => row.return_pct)).toEqual([1, 1, 1]);
    expect(details?.supporting_evidence_failures?.map((failure) => failure.title)).toEqual([
      "Income evidence unavailable",
      "Activity evidence unavailable",
      "Selected-period performance unavailable",
    ]);
  });

  it("preserves gateway unavailable metadata for the performance snapshot module", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = input.toString();

        if (url.includes("/book")) {
          return jsonResponse({
            allocation_views: [{ dimension: "asset_class", buckets: [] }],
            top_positions: [],
            positions: [],
          });
        }

        if (url.includes("/income-summary")) {
          return jsonResponse(null);
        }

        if (url.includes("/activity-summary")) {
          return jsonResponse(null);
        }

        if (url.includes("/portfolio/portfolios/MANUAL_PB_USD_001/performance-snapshot?")) {
          return jsonResponse({
            period: "EXPLICIT",
            as_of_date: "2026-03-28",
            report_start_date: "2026-03-01",
            report_end_date: "2026-03-28",
            benchmark_code: "BMK_GLOBAL_BALANCED_60_40",
            portfolio_return_pct: null,
            benchmark_return_pct: null,
            excess_return_pct: null,
            unavailable: {
              title: "Performance history incomplete",
              detail: "Gateway could not compute a snapshot because valuation history is incomplete.",
              requirements: [
                "daily valuations through the selected end date",
                "cashflow history for the selected period",
              ],
            },
            warnings: ["Performance data is delayed pending backfill."],
            partial_failures: [],
            sparkline: [],
          });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const details = await getPortfolioWorkspaceSummaryDetails("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      reportingCurrency: "USD",
      includeProjected: false,
      timeWindow: "30D",
      reportStartDate: "2026-03-01",
      reportEndDate: "2026-03-28",
    });

    expect(details?.performance).toMatchObject({
      period: "EXPLICIT",
      report_start_date: "2026-03-01",
      report_end_date: "2026-03-28",
      return_pct: null,
      benchmark_return_pct: null,
      excess_return_pct: null,
      unavailable: {
        title: "Performance history incomplete",
        detail: "Gateway could not compute a snapshot because valuation history is incomplete.",
        requirements: [
          "daily valuations through the selected end date",
          "cashflow history for the selected period",
        ],
      },
      warnings: ["Performance data is delayed pending backfill."],
      partial_failures: [],
      sparkline_points: [],
    });
  });

  it("loads detailed ledger and liquidity slices only when detailed modules need them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = input.toString();

        if (url.includes("/liquidity")) {
          return jsonResponse({
            cash_balances: [
              {
                security_id: "CASH_USD",
                instrument_name: "USD Operating Cash",
                currency: "USD",
                quantity: 66122,
                market_value_base: 66122,
                weight_pct: 6.6,
              },
            ],
            cashflow_outlook: {
              as_of_date: "2026-03-28",
              range_end_date: "2026-04-07",
              total_net_cashflow_base: 0,
              projection_days: 10,
              include_projected: true,
              upcoming_points: [],
            },
          });
        }

        if (url.includes("/transactions")) {
          return jsonResponse({
            transactions: [
              {
                transaction_id: "TX_1",
                transaction_date: "2026-03-28T00:00:00Z",
                transaction_type: "BUY",
                security_id: "EQ_US_AAPL_MANUAL_001",
                instrument_id: "EQ_US_AAPL_MANUAL_001",
                quantity: 700,
              },
            ],
          });
        }

        if (url.includes("/readiness")) {
          return jsonResponse({
            indicators: [
              { key: "holdings", label: "Holdings", status: "Ready", href: "#portfolio-insights" },
            ],
            supportability: {
              feature_key: "core.observability.portfolio_supportability",
              state: "degraded",
              reason: "portfolio_supportability_pending",
              freshness_bucket: "fresh",
              ready_domains: 3,
              pending_domains: 1,
              blocked_domains: 0,
              no_activity_domains: 0,
            },
          });
        }

        if (url.includes("/insights")) {
          return jsonResponse({
            insights: [
              {
                key: "cash-above-target",
                title: "Cash exceeds target allocation",
                detail: "Available cash is elevated relative to invested assets.",
                severity: "info",
                href: "#portfolio-insights",
              },
            ],
            exception_summaries: [
              {
                key: "pricing",
                title: "Pricing coverage incomplete",
                detail: "Some holdings lack complete valuation coverage.",
                tone: "warn",
                href: "#portfolio-attention",
              },
            ],
          });
        }

        if (url.includes("/workflow")) {
          return jsonResponse({
            actions: [
              {
                sequence: 1,
                title: "Review performance",
                impact: "Review portfolio return.",
                target: "Target: Performance workflow",
                href: "/performance",
                cta_label: "Performance",
                recommended: true,
              },
            ],
          });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const shell = {
      as_of_date: "2026-03-28",
      portfolio: {
        portfolio_id: "MANUAL_PB_USD_001",
        display_name: "MANUAL_PB_USD_001",
        client_id: "MANUAL_CIF_001",
        base_currency: "USD",
        booking_center_code: "Singapore",
      },
      profile: {
        status: "ACTIVE",
        portfolio_type: "Advisory",
        risk_exposure: "Moderate Growth",
        investment_time_horizon: "Long Term",
        objective: "Long-term capital appreciation.",
        is_leverage_allowed: false,
      },
      summary: {
        market_value_base: 1001550.05,
        invested_market_value_base: 917032.95,
        total_cash_base: 84517.1,
        cash_weight_pct: 8.43863,
        position_count: 9,
        cash_balance_count: 2,
      },
      allocations: [],
      allocation_views: [],
      cash_balances: [],
      top_positions: [],
      positions: [],
      recent_transactions: [],
      income_summary: null,
      activity_summary: null,
      cashflow_outlook: null,
      performance: null,
      rebalance: null,
      readiness: {
        has_positions: true,
        reporting: { status: "READY", generated_at_utc: null, row_count: 4 },
      },
      workflow_cues: [],
      warnings: [],
      partial_failures: [],
    };

    const details = await getPortfolioWorkspaceDetailedDetails("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      startDate: "2026-03-01",
      endDate: "2026-03-28",
    });
    const merged = mergePortfolioWorkspace(shell, details!);

    expect(merged.cash_balances?.[0].market_value_base).toBe(66122);
    expect(merged.recent_transactions[0].transaction_id).toBe("TX_1");
    expect(merged.readiness_indicators?.[0].status).toBe("Ready");
    expect(merged.supportability).toEqual({
      feature_key: "core.observability.portfolio_supportability",
      state: "degraded",
      reason: "portfolio_supportability_pending",
      freshness_bucket: "fresh",
      ready_domains: 3,
      pending_domains: 1,
      blocked_domains: 0,
      no_activity_domains: 0,
    });
    expect(merged.insights?.[0].key).toBe("cash-above-target");
    expect(merged.exception_summaries?.[0].key).toBe("pricing");
    expect(merged.workflow_actions?.[0].title).toBe("Review performance");
    const requestedUrls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map((call) =>
      String(call[0])
    );
    const liquidityRequestUrl = requestedUrls.find((url) => url.includes("/liquidity?")) ?? "";
    const transactionRequestUrl = requestedUrls.find((url) => url.includes("/transactions?")) ?? "";
    const readinessRequestUrl = requestedUrls.find((url) => url.includes("/readiness?")) ?? "";
    const insightsRequestUrl = requestedUrls.find((url) => url.includes("/insights?")) ?? "";
    const workflowRequestUrl = requestedUrls.find((url) => url.includes("/workflow?")) ?? "";
    expect(liquidityRequestUrl).toContain("as_of_date=2026-03-28");
    expect(transactionRequestUrl).toContain("limit=200");
    expect(transactionRequestUrl).toContain("as_of_date=2026-03-28");
    expect(transactionRequestUrl).toContain("start_date=2026-03-01");
    expect(transactionRequestUrl).toContain("end_date=2026-03-28");
    expect(readinessRequestUrl).toContain("as_of_date=2026-03-28");
    expect(insightsRequestUrl).toContain("as_of_date=2026-03-28");
    expect(workflowRequestUrl).toContain("as_of_date=2026-03-28");
    expect(getAnalyticsUiMetricEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric_name: "lotus_workbench_panel_state_total",
          labels: expect.objectContaining({
            route: "workbench.portfolio",
            panel: "portfolio-readiness",
            operation: "portfolio.readiness",
            state: "degraded",
            freshness_bucket: "fresh",
            supportability_state: "action_required",
          }),
        }),
      ])
    );
    const metricsJson = JSON.stringify(getAnalyticsUiMetricEvents());
    expect(metricsJson).not.toContain("MANUAL_PB_USD_001");
    expect(metricsJson).not.toContain("MANUAL_CIF_001");
  });

  it("preserves available transactions when liquidity detail is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = input.toString();
        if (url.includes("/liquidity")) {
          return new Response(null, { status: 503 });
        }
        if (url.includes("/transactions")) {
          return jsonResponse({
            total: 275,
            skip: 0,
            limit: 200,
            transactions: [
              {
                transaction_id: "TX_AVAILABLE",
                transaction_date: "2026-03-28T00:00:00Z",
                transaction_type: "BUY",
                security_id: "EQ_1",
                instrument_id: "EQ_1",
                quantity: 1,
              },
            ],
          });
        }
        if (url.includes("/readiness")) {
          return jsonResponse({ indicators: [] });
        }
        if (url.includes("/insights")) {
          return jsonResponse({ insights: [], exception_summaries: [] });
        }
        return jsonResponse({ actions: [] });
      }),
    );

    const details = await getPortfolioWorkspaceDetailedDetails("MANUAL_PB_USD_001");

    expect(details?.cash_balances).toBeUndefined();
    expect(details?.recent_transactions?.[0].transaction_id).toBe("TX_AVAILABLE");
    expect(details?.transaction_ledger_page).toEqual({
      total: 275,
      skip: 0,
      limit: 200,
    });
    expect(details?.record_data_availability).toEqual({
      liquidity: "unavailable",
      transactions: "ready",
    });
  });

  it("preserves available cash balances when recent activity is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = input.toString();
        if (url.includes("/liquidity")) {
          return jsonResponse({
            cash_balances: [
              {
                security_id: "CASH_USD",
                instrument_name: "USD Operating Cash",
                currency: "USD",
                quantity: 100,
                market_value_base: 100,
                weight_pct: 10,
              },
            ],
            cashflow_outlook: null,
          });
        }
        if (url.includes("/transactions")) {
          throw new Error("Transaction service unavailable");
        }
        if (url.includes("/readiness")) {
          return jsonResponse({ indicators: [] });
        }
        if (url.includes("/insights")) {
          return jsonResponse({ insights: [], exception_summaries: [] });
        }
        return jsonResponse({ actions: [] });
      }),
    );

    const details = await getPortfolioWorkspaceDetailedDetails("MANUAL_PB_USD_001");

    expect(details?.cash_balances?.[0].security_id).toBe("CASH_USD");
    expect(details?.recent_transactions).toBeUndefined();
    expect(details?.record_data_availability).toEqual({
      liquidity: "ready",
      transactions: "unavailable",
    });
  });

  it("requests the transaction ledger with scoped filter parameters", async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse({
        total: 1,
        skip: 0,
        limit: 200,
        transactions: [],
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    await getPortfolioTransactionLedger("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      startDate: "2026-03-01",
      endDate: "2026-03-28",
      transactionType: "BUY",
      componentType: "FX_CONTRACT_OPEN",
      securityId: "EQ_US_AAPL_MANUAL_001",
      linkedTransactionGroupId: "LTG-FX-2026-0001",
      fxContractId: "FXC-2026-0001",
      swapEventId: "FXSWAP-2026-0001",
      nearLegGroupId: "FXSWAP-2026-0001-NEAR",
      farLegGroupId: "FXSWAP-2026-0001-FAR",
      limit: 200,
    });

    expect(fetchSpy.mock.calls.length).toBe(1);
    const requestUrl = String((fetchSpy.mock as { lastCall?: unknown[] }).lastCall?.[0] ?? "");
    expect(requestUrl).toContain("/transactions?");
    expect(requestUrl).toContain("as_of_date=2026-03-28");
    expect(requestUrl).toContain("start_date=2026-03-01");
    expect(requestUrl).toContain("end_date=2026-03-28");
    expect(requestUrl).toContain("transaction_type=BUY");
    expect(requestUrl).toContain("component_type=FX_CONTRACT_OPEN");
    expect(requestUrl).toContain("security_id=EQ_US_AAPL_MANUAL_001");
    expect(requestUrl).toContain("linked_transaction_group_id=LTG-FX-2026-0001");
    expect(requestUrl).toContain("fx_contract_id=FXC-2026-0001");
    expect(requestUrl).toContain("swap_event_id=FXSWAP-2026-0001");
    expect(requestUrl).toContain("near_leg_group_id=FXSWAP-2026-0001-NEAR");
    expect(requestUrl).toContain("far_leg_group_id=FXSWAP-2026-0001-FAR");
  });

  it("requests strategic allocation views with explicit look-through and reporting currency", async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse({
        portfolio_id: "MANUAL_PB_USD_001", as_of_date: "2026-03-28",
        total_market_value_reporting_currency: "0",
        valuation_coverage: { coverage_state: "LOADED_EMPTY", coverage_reason: "no_open_positions",
          snapshot_row_count: 0, expected_open_position_count: 0, valued_position_count: 0, unvalued_position_count: 0 },
        reporting_currency: "USD",
        look_through: {
          requested_mode: "prefer_look_through",
          effective_mode: "prefer_look_through",
          applied: true,
        },
        views: [{ dimension: "region", total_market_value_reporting_currency: "0", buckets: [] }],
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const payload = await getPortfolioAllocationViews("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      reportingCurrency: "USD",
      lookThroughMode: "prefer_look_through",
    });

    expect(payload?.look_through?.effective_mode).toBe("prefer_look_through");
    const requestUrl = String((fetchSpy.mock as { lastCall?: unknown[] }).lastCall?.[0] ?? "");
    expect(requestUrl).toContain("/allocations?");
    expect(requestUrl).toContain("as_of_date=2026-03-28");
    expect(requestUrl).toContain("reporting_currency=USD");
    expect(requestUrl).toContain("look_through_mode=prefer_look_through");
  });

  it.each([
    ["missing views", { code: "unexpected_success_envelope" }],
    ["non-array views", { views: { dimension: "region", buckets: [] } }],
    [
      "malformed buckets",
      { views: [{ dimension: "region", buckets: [{ bucket: "Asia" }] }] },
    ],
  ])("rejects a successful allocation response with %s", async (_case, payload) => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(payload)));

    await expect(
      getPortfolioAllocationViews("MANUAL_PB_USD_001", {
        lookThroughMode: "prefer_look_through",
      }),
    ).resolves.toBeNull();
  });

  it("leaves identical transport reads uncached for Query ownership", async () => {
    const fetchSpy = vi.fn(async (input: string | URL) => {
      const url = input.toString();

      if (url.includes("/transactions")) {
        return jsonResponse({
          total: 1,
          skip: 0,
          limit: 200,
          transactions: [{ transaction_id: "TX_1" }],
        });
      }

      if (url.includes("/book")) {
        return jsonResponse({
          allocation_views: [{ dimension: "asset_class", buckets: [] }],
          top_positions: [],
          positions: [],
        });
      }

      if (url.includes("/income-summary")) {
        return jsonResponse(null);
      }

      if (url.includes("/activity-summary")) {
        return jsonResponse(null);
      }

      if (url.includes("/portfolio/portfolios/MANUAL_PB_USD_001/performance-snapshot?")) {
        return jsonResponse({
          period: "EXPLICIT",
          as_of_date: "2026-03-28",
          report_start_date: "2026-03-01",
          report_end_date: "2026-03-28",
          benchmark_code: null,
          portfolio_return_pct: 2.1,
          benchmark_return_pct: null,
          excess_return_pct: null,
          sparkline: [
            {
              as_of_date: "2026-03-01",
              portfolio_return_pct: 0.8,
              benchmark_return_pct: 0.6,
              excess_return_pct: 0.2,
            },
            {
              as_of_date: "2026-03-14",
              portfolio_return_pct: 1.6,
              benchmark_return_pct: 1.2,
              excess_return_pct: 0.4,
            },
            {
              as_of_date: "2026-03-28",
              portfolio_return_pct: 2.1,
              benchmark_return_pct: 1.7,
              excess_return_pct: 0.4,
            },
          ],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchSpy);

    await getPortfolioTransactionLedger("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      startDate: "2026-03-01",
      endDate: "2026-03-28",
      limit: 200,
    });
    await getPortfolioTransactionLedger("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      startDate: "2026-03-01",
      endDate: "2026-03-28",
      limit: 200,
    });

    await getPortfolioWorkspaceSummaryDetails("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      reportingCurrency: "USD",
      includeProjected: false,
      timeWindow: "30D",
      reportStartDate: "2026-03-01",
      reportEndDate: "2026-03-28",
    });
    await getPortfolioWorkspaceSummaryDetails("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      reportingCurrency: "USD",
      includeProjected: false,
      timeWindow: "30D",
      reportStartDate: "2026-03-01",
      reportEndDate: "2026-03-28",
    });

    const requestedUrls = fetchSpy.mock.calls.map((call) => String(call[0]));
    expect(requestedUrls.filter((url) => url.includes("/transactions")).length).toBe(2);
    expect(
      requestedUrls.filter(
        (url) =>
          url.includes("/book?") &&
          url.includes("as_of_date=2026-03-28") &&
          url.includes("reporting_currency=USD") &&
          url.includes("include_projected=false")
      ).length
    ).toBe(2);
    expect(requestedUrls.filter((url) => url.includes("/allocations")).length).toBe(0);
    expect(requestedUrls.filter((url) => url.includes("/positions")).length).toBe(0);
    expect(
      requestedUrls.filter(
        (url) =>
          url.includes("/income-summary?") &&
          url.includes("as_of_date=2026-03-28") &&
          url.includes("start_date=2026-03-01") &&
          url.includes("end_date=2026-03-28") &&
          url.includes("reporting_currency=USD")
      ).length
    ).toBe(2);
    expect(
      requestedUrls.filter(
        (url) =>
          url.includes("/activity-summary?") &&
          url.includes("as_of_date=2026-03-28") &&
          url.includes("start_date=2026-03-01") &&
          url.includes("end_date=2026-03-28") &&
          url.includes("reporting_currency=USD")
      ).length
    ).toBe(2);
    expect(
      requestedUrls.filter(
        (url) =>
          url.includes("/performance-snapshot?") &&
          url.includes("period=EXPLICIT") &&
          url.includes("report_start_date=2026-03-01") &&
          url.includes("report_end_date=2026-03-28")
      ).length
    ).toBe(2);
    expect(requestedUrls.filter((url) => url.includes("/performance/summary")).length).toBe(0);
    expect(requestedUrls.filter((url) => url.includes("/performance/details")).length).toBe(0);
  });

  it.each(["1Y", "SI"] as const)(
    "admits source performance for the selected %s horizon",
    async (timeWindow) => {
      const requestedPerformancePeriods: string[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input) => {
          const url = new URL(String(input), "http://workbench.test");
          if (url.pathname.endsWith("/book")) {
            return jsonResponse({
              allocation_views: [{ dimension: "asset_class", buckets: [] }],
              top_positions: [],
              positions: [],
            });
          }

          if (url.pathname.endsWith("/income-summary")) {
            return jsonResponse(null);
          }

          if (url.pathname.endsWith("/activity-summary")) {
            return jsonResponse(null);
          }

          if (!url.pathname.endsWith("/performance-snapshot")) {
            throw new Error(`Unexpected fetch: ${url}`);
          }

          const period = url.searchParams.get("period");
          requestedPerformancePeriods.push(period ?? "missing");
          return jsonResponse({
            period,
            as_of_date: "2026-03-28",
            report_end_date: "2026-03-28",
            benchmark_code: "BMK_GLOBAL_BALANCED_60_40",
            portfolio_return_pct: 6.4,
            benchmark_return_pct: 5.8,
            excess_return_pct: 0.6,
            sparkline: [],
            warnings: [],
            partial_failures: [],
          });
        }),
      );

      const workspace = await getPortfolioWorkspaceSummaryDetails("MANUAL_PB_USD_001", {
        asOfDate: "2026-03-28",
        reportingCurrency: "USD",
        includeProjected: false,
        timeWindow,
        reportStartDate: "2025-03-29",
        reportEndDate: "2026-03-28",
        includeWorkflowActions: false,
      });

      expect(requestedPerformancePeriods).toContain(timeWindow);
      expect(workspace?.performance).toMatchObject({
        period: timeWindow,
        report_end_date: "2026-03-28",
        return_pct: 6.4,
      });
      expect(workspace?.supporting_evidence_failures).not.toContainEqual(
        expect.objectContaining({ evidence_scope: "selected_period_performance" }),
      );
    },
  );

  it("withholds a source-authored performance window that differs from the review", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.includes("/book")) {
          return jsonResponse({
            allocation_views: [{ dimension: "asset_class", buckets: [] }],
            top_positions: [],
            positions: [],
          });
        }

        if (url.includes("/income-summary")) {
          return jsonResponse(null);
        }

        if (url.includes("/activity-summary")) {
          return jsonResponse(null);
        }

        if (!url.includes("/performance-snapshot")) {
          throw new Error(`Unexpected fetch: ${url}`);
        }

        return jsonResponse({
          period: "EXPLICIT",
          as_of_date: "2026-03-28",
          report_start_date: "2026-02-15",
          report_end_date: "2026-03-28",
          benchmark_code: "BMK_GLOBAL_BALANCED_60_40",
          portfolio_return_pct: 2.1,
          benchmark_return_pct: 1.7,
          excess_return_pct: 0.4,
          sparkline: [
            {
              as_of_date: "2026-03-01",
              portfolio_return_pct: 0.8,
              benchmark_return_pct: 0.6,
              excess_return_pct: 0.2,
            },
            {
              as_of_date: "2026-03-28",
              portfolio_return_pct: 2.1,
              benchmark_return_pct: 1.7,
              excess_return_pct: 0.4,
            },
          ],
          warnings: [],
          partial_failures: [],
        });
      })
    );

    const workspace = await getPortfolioWorkspaceSummaryDetails("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      reportingCurrency: "USD",
      includeProjected: false,
      timeWindow: "30D",
      reportStartDate: "2026-03-01",
      reportEndDate: "2026-03-28",
    });

    expect(workspace?.performance).toBeNull();
    expect(workspace?.supporting_evidence_failures).toContainEqual(
      expect.objectContaining({
        evidence_scope: "selected_period_performance",
        title: "Selected-period performance unavailable",
      }),
    );
  });

  it("keeps in-flight ledger reads independent for Query ownership", async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse({
        total: 1,
        skip: 0,
        limit: 200,
        transactions: [{ transaction_id: "TX_1" }],
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const firstRequest = getPortfolioTransactionLedger("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      startDate: "2026-03-01",
      endDate: "2026-03-28",
      limit: 200,
    });
    const secondRequest = getPortfolioTransactionLedger("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      startDate: "2026-03-01",
      endDate: "2026-03-28",
      limit: 200,
    });

    const [firstResult, secondResult] = await Promise.all([firstRequest, secondRequest]);
    expect(firstResult).toEqual(secondResult);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("requests projected cashflow with the selected horizon", async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse({
        correlation_id: "corr-cashflow-001",
        contract_version: "v1",
        portfolio_id: "MANUAL_PB_USD_001",
        as_of_date: "2026-03-28",
        cashflow_outlook: {
          as_of_date: "2026-03-28",
          range_end_date: "2026-04-27",
          total_net_cashflow_base: 1250,
          projection_days: 30,
          include_projected: true,
          upcoming_points: [],
        },
        warnings: ["PORTFOLIO_CASHFLOW_DELAYED"],
        partial_failures: [
          {
            source_service: "lotus-core",
            error_code: "PORTFOLIO_CASHFLOW_DELAYED",
            detail: "one input is delayed",
          },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const response = await getPortfolioProjectedCashflow("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      horizonDays: 30,
      includeProjected: true,
    });

    expect(response?.cashflow_outlook?.projection_days).toBe(30);
    expect(response?.correlation_id).toBe("corr-cashflow-001");
    expect(response?.warnings).toEqual(["PORTFOLIO_CASHFLOW_DELAYED"]);
    expect(response?.partial_failures[0].error_code).toBe("PORTFOLIO_CASHFLOW_DELAYED");
    const requestUrl = String((fetchSpy.mock as { lastCall?: unknown[] }).lastCall?.[0] ?? "");
    expect(requestUrl).toContain("/projected-cashflow?");
    expect(requestUrl).toContain("as_of_date=2026-03-28");
    expect(requestUrl).toContain("horizon_days=30");
    expect(requestUrl).toContain("include_projected=true");
  });

  it("bypasses an unavailable projected-cashflow envelope when refresh is requested", async () => {
    const unavailable = {
      correlation_id: "corr-unavailable",
      contract_version: "v1",
      portfolio_id: "MANUAL_PB_USD_001",
      as_of_date: "2026-03-28",
      cashflow_outlook: null,
      warnings: ["PORTFOLIO_CASHFLOW_UNAVAILABLE"],
      partial_failures: [],
    };
    const available = {
      ...unavailable,
      correlation_id: "corr-available",
      cashflow_outlook: {
        as_of_date: "2026-03-28",
        range_end_date: "2026-04-07",
        total_net_cashflow_base: 500,
        projection_days: 10,
        include_projected: true,
        upcoming_points: [],
      },
      warnings: [],
    };
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(unavailable))
      .mockResolvedValueOnce(jsonResponse(available));
    vi.stubGlobal("fetch", fetchSpy);

    const first = await getPortfolioProjectedCashflow("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      horizonDays: 10,
    });
    const refreshed = await getPortfolioProjectedCashflow("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      horizonDays: 10,
    });

    expect(first?.cashflow_outlook).toBeNull();
    expect(refreshed?.correlation_id).toBe("corr-available");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("keeps concurrent projected-cashflow reads independent and recontacts the source", async () => {
    const stale = {
      correlation_id: "corr-stale",
      contract_version: "v1",
      portfolio_id: "MANUAL_PB_USD_001",
      as_of_date: "2026-03-28",
      cashflow_outlook: null,
      warnings: ["PORTFOLIO_CASHFLOW_UNAVAILABLE"],
      partial_failures: [],
    };
    const available = {
      ...stale,
      correlation_id: "corr-available",
      cashflow_outlook: {
        as_of_date: "2026-03-28",
        range_end_date: "2026-04-07",
        total_net_cashflow_base: 500,
        projection_days: 10,
        include_projected: true,
        upcoming_points: [],
      },
      warnings: [],
    };
    let resolveStale: ((response: Response) => void) | undefined;
    let resolveAvailable: ((response: Response) => void) | undefined;
    const fetchSpy = vi
      .fn()
      .mockImplementationOnce(
        async () =>
          await new Promise<Response>((resolve) => {
            resolveStale = resolve;
          })
      )
      .mockImplementationOnce(
        async () =>
          await new Promise<Response>((resolve) => {
            resolveAvailable = resolve;
          })
      )
      .mockResolvedValueOnce(jsonResponse(available));
    vi.stubGlobal("fetch", fetchSpy);

    const staleRequest = getPortfolioProjectedCashflow("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      horizonDays: 10,
    });
    const refreshedRequest = getPortfolioProjectedCashflow("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      horizonDays: 10,
    });

    resolveAvailable?.(jsonResponse(available));
    expect((await refreshedRequest)?.correlation_id).toBe("corr-available");
    resolveStale?.(jsonResponse(stale));
    expect((await staleRequest)?.correlation_id).toBe("corr-stale");

    const latest = await getPortfolioProjectedCashflow("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      horizonDays: 10,
    });
    expect(latest?.correlation_id).toBe("corr-available");
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("passes reporting currency through to detailed liquidity requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.includes("/liquidity")) {
          return jsonResponse({
            cash_balances: [],
            cashflow_outlook: null,
          });
        }
        if (url.includes("/transactions")) {
          return jsonResponse({
            transactions: [],
          });
        }
        if (url.includes("/readiness")) {
          return jsonResponse({ indicators: [] });
        }
        if (url.includes("/insights")) {
          return jsonResponse({ insights: [], exception_summaries: [] });
        }
        if (url.includes("/workflow")) {
          return jsonResponse({ actions: [] });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    await getPortfolioWorkspaceDetailedDetails("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28",
      reportingCurrency: "SGD",
      startDate: "2026-03-01",
      endDate: "2026-03-28",
    });

    const requestedUrls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map((call) =>
      String(call[0])
    );
    const liquidityRequestUrl = requestedUrls.find((url) => url.includes("/liquidity?")) ?? "";
    const transactionRequestUrl = requestedUrls.find((url) => url.includes("/transactions?")) ?? "";
    expect(liquidityRequestUrl).toContain("as_of_date=2026-03-28");
    expect(liquidityRequestUrl).toContain("reporting_currency=SGD");
    expect(transactionRequestUrl).toContain("as_of_date=2026-03-28");
    expect(transactionRequestUrl).toContain("reporting_currency=SGD");
  });

  it("uses the proxied portfolio API base in the browser", async () => {
    const originalWindow = global.window;
    vi.stubGlobal("window", {
      location: { href: "http://localhost:3000/portfolio" },
    });
    const fetchSpy = vi.fn(async () => jsonResponse({ items: [] }));
    vi.stubGlobal("fetch", fetchSpy);

    try {
      await import("../../src/apps/portfolio/api").then(({ getPortfolioCatalog }) =>
        getPortfolioCatalog()
      );
      expect(String((fetchSpy.mock as { lastCall?: unknown[] }).lastCall?.[0] ?? "")).toContain(
        "/api/bff/api/v1/portfolio/portfolios"
      );
    } finally {
      if (originalWindow) {
        vi.stubGlobal("window", originalWindow);
      }
    }
  });

  it("uses the gateway-backed portfolio API base during server rendering", async () => {
    vi.stubEnv("BFF_BASE_URL", "http://gateway.dev.lotus");
    const originalWindow = global.window;
    vi.stubGlobal("window", undefined);
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              portfolio_id: "PB_SG_GLOBAL_BAL_001",
              display_name: "Global Balanced Mandate",
              base_currency: "USD",
              client_id: "CIF_001",
              booking_center_code: "Singapore",
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    try {
      const firstCatalog = await getPortfolioCatalog();
      const refreshedCatalog = await getPortfolioCatalog();

      expect(String((fetchSpy.mock as { lastCall?: unknown[] }).lastCall?.[0] ?? "")).toBe(
        "http://gateway.dev.lotus/api/v1/portfolio/portfolios"
      );
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(firstCatalog).toEqual([]);
      expect(refreshedCatalog).toEqual([
        expect.objectContaining({ portfolio_id: "PB_SG_GLOBAL_BAL_001" }),
      ]);
    } finally {
      if (originalWindow) {
        vi.stubGlobal("window", originalWindow);
      } else {
        vi.unstubAllGlobals();
      }
    }
  });

  it.each([undefined, "uat", "production"])(
    "does not contact Gateway for a server-rendered Portfolio read in %s posture",
    async (environment) => {
      if (environment === undefined) {
        vi.stubEnv("LOTUS_ENVIRONMENT", "");
      } else {
        vi.stubEnv("LOTUS_ENVIRONMENT", environment);
      }
      vi.stubGlobal("window", undefined);
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      await expect(getPortfolioCatalog()).resolves.toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it("does not cache failed portfolio responses", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response("gateway unavailable", { status: 503 }))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              portfolio_id: "PB_SG_GLOBAL_BAL_001",
              display_name: "PB_SG_GLOBAL_BAL_001",
              base_currency: "USD",
              client_id: "CIF_001",
              booking_center_code: "Singapore",
            },
          ],
        })
      );
    vi.stubGlobal("fetch", fetchSpy);

    await expect(getPortfolioCatalog()).resolves.toEqual([]);
    await expect(getPortfolioCatalog()).resolves.toEqual([
      expect.objectContaining({ portfolio_id: "PB_SG_GLOBAL_BAL_001" }),
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("preserves gateway portfolio catalog picker metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          items: [
            {
              portfolio_id: "PF_1001",
              display_name: "Alpha Growth",
              base_currency: "USD",
              client_id: "CIF_1001",
              booking_center_code: "SGPB",
              portfolio_type: "ADVISORY",
              status: "ACTIVE",
            },
          ],
        })
      )
    );

    const items = await getPortfolioCatalog();

    expect(items).toEqual([
      {
        portfolio_id: "PF_1001",
        display_name: "Alpha Growth",
        base_currency: "USD",
        client_id: "CIF_1001",
        booking_center_code: "SGPB",
        portfolio_type: "ADVISORY",
        status: "ACTIVE",
      },
    ]);
  });
});

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function portfolioSummaryEvidenceResponse(url: string): Response | null {
  if (url.includes("/book")) {
    return jsonResponse({
      as_of_date: "2026-03-28",
      summary: {
        assets_under_management_base: 1_000_000,
        invested_market_value_base: 900_000,
        cash_market_value_base: 100_000,
        cash_weight_pct: 10,
        position_count: 1,
        cash_balance_count: 1,
      },
      allocation_views: [{ dimension: "asset_class", buckets: [] }],
      top_positions: [],
      positions: [],
    });
  }
  if (url.includes("/income-summary")) {
    return jsonResponse({ reporting_currency: "USD" });
  }
  if (url.includes("/activity-summary")) {
    return jsonResponse({ reporting_currency: "USD", buckets: [] });
  }
  if (url.includes("/performance-snapshot")) {
    return jsonResponse({
      period: "EXPLICIT",
      as_of_date: "2026-03-28",
      benchmark_code: null,
      portfolio_return_pct: 1,
      benchmark_return_pct: null,
      excess_return_pct: null,
      warnings: [],
      partial_failures: [],
      sparkline: [],
    });
  }
  return null;
}
