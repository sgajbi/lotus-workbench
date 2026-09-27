import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PerformanceAttributionTrendPanel from "../../src/apps/performance/components/performance-attribution-trend-panel";
import { lotusThemeTokens } from "../../src/design-system/theme/tokens";
import { WorkbenchApiError } from "../../src/features/workbench/api-client";

const getTrendMock = vi.fn();
const REVIEW_CONTEXT_EVIDENCE = {
  requested_as_of_date: null,
  effective_as_of_date: "2026-03-27",
  requested_reporting_currency: null,
  effective_reporting_currency: "USD",
  reporting_currency_state: "accepted_unverified" as const,
};
const SOURCE_CONTEXT = {
  as_of_date: "2026-03-27",
  ...REVIEW_CONTEXT_EVIDENCE,
};

vi.mock("echarts-for-react", () => ({
  default: ({
    option,
    style,
  }: {
    option?: Record<string, unknown>;
    style?: React.CSSProperties;
  }) => (
    <div
      data-testid="performance-attribution-trend-chart"
      data-option={JSON.stringify(option)}
      style={style}
    />
  ),
}));

vi.mock("../../src/features/workbench/api", () => ({
  getWorkbenchPerformanceAttributionTrendClient: (...args: unknown[]) => getTrendMock(...args),
}));

describe("PerformanceAttributionTrendPanel", () => {
  afterEach(() => {
    getTrendMock.mockReset();
  });

  it("renders the attribution-over-time chart from the dedicated trend contract", async () => {
    getTrendMock.mockResolvedValue({
      correlation_id: "corr-performance",
      contract_version: "v1",
      portfolio_id: "PF_1001",
      as_of_date: "2026-03-27",
      ...REVIEW_CONTEXT_EVIDENCE,
      period: "YTD",
      report_start_date: "2026-01-01",
      report_end_date: "2026-03-27",
      chart_frequency: "monthly",
      detail_basis: "NET",
      attribution_dimension: "asset_class",
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
        },
        {
          period_label: "2026-02",
          period_start: "2026-02-01",
          period_end: "2026-02-28",
          frequency: "monthly",
          allocation_pct: 0.09,
          selection_pct: 0.04,
          interaction_pct: -0.01,
          total_effect_pct: 0.12,
          cumulative_total_effect_pct: 0.34,
          active_return_pct: 0.13,
          residual_pct: 0.01,
        },
      ],
      warnings: [],
      partial_failures: [],
    });

    render(
      <PerformanceAttributionTrendPanel
        portfolioId="PF_1001"
        period="YTD"
        chartFrequency="monthly"
        attributionDimension="asset_class"
        detailBasis="NET"
        benchmark="BMK_GLOBAL_BALANCED_60_40"
        reportStartDate="2026-01-01"
        reportEndDate="2026-03-27"
        sourceContext={SOURCE_CONTEXT}
      />,
    );

    expect(screen.getByText("Loading attribution effect trend.")).toBeInTheDocument();
    expect(
      document.querySelector(".performance-analysis-state-panel-loading .workbench-loading-state"),
    ).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Attribution over time chart" })).toBeInTheDocument();
    });

    expect(
      document.querySelector(".performance-analysis-trend-shell.workbench-chart-shell"),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Attribution trend context")).not.toBeInTheDocument();
    const trendSummaryStrip = screen.getByLabelText("Attribution trend summary strip");
    expect(trendSummaryStrip).toBeInTheDocument();
    expect(within(trendSummaryStrip).getByText("Total effect")).toBeInTheDocument();
    expect(within(trendSummaryStrip).getByText("Cumulative effect")).toBeInTheDocument();
    expect(within(trendSummaryStrip).queryByText("Active return")).not.toBeInTheDocument();
    expect(within(trendSummaryStrip).queryByText("Residual")).not.toBeInTheDocument();
    expect(screen.getByTestId("performance-attribution-trend-chart")).toBeInTheDocument();
    const chartOption = JSON.parse(
      screen.getByTestId("performance-attribution-trend-chart").getAttribute("data-option") ?? "{}",
    ) as {
      series?: Array<{
        barWidth?: number;
        smooth?: boolean;
        symbol?: string;
        symbolSize?: number;
        lineStyle?: { cap?: string; join?: string };
      }>;
      tooltip?: {
        backgroundColor?: string;
        textStyle?: { color?: string };
      };
      color?: string[];
    };
    expect(chartOption.series?.[0]?.barWidth).toBe(14);
    expect(chartOption.series?.[3]?.smooth).toBe(false);
    expect(chartOption.series?.[3]?.symbol).toBe("circle");
    expect(chartOption.series?.[3]?.symbolSize).toBe(6);
    expect(chartOption.series?.[3]?.lineStyle).toMatchObject({
      cap: "round",
      join: "round",
    });
    expect(chartOption.color).toEqual([
      lotusThemeTokens.color.chart.categorical.allocation,
      lotusThemeTokens.color.chart.categorical.selection,
      lotusThemeTokens.color.chart.categorical.interaction,
      lotusThemeTokens.color.chart.categorical.total,
    ]);
    expect(chartOption.tooltip?.backgroundColor).toBe(
      lotusThemeTokens.color.chart.chrome.tooltipBackground,
    );
    expect(chartOption.tooltip?.textStyle?.color).toBe(
      lotusThemeTokens.color.text.primary,
    );
    const trendTable = screen.getByLabelText("Attribution trend table");
    expect(within(trendTable).getByText("Allocation")).toBeInTheDocument();
    expect(within(trendTable).getByText("Selection")).toBeInTheDocument();
    expect(within(trendTable).getByText("Interaction")).toBeInTheDocument();
    expect(within(trendTable).getByText("Cumulative effect")).toBeInTheDocument();
    expect(within(trendTable).getByText("Residual")).toBeInTheDocument();
    expect(within(trendTable).getByText("2026-01")).toBeInTheDocument();
    expect(within(trendTable).getByText("2026-02")).toBeInTheDocument();
    expect(getTrendMock).toHaveBeenCalledWith("PF_1001", {
      period: "YTD",
      chartFrequency: "monthly",
      attributionDimension: "asset_class",
      detailBasis: "NET",
      benchmark: "BMK_GLOBAL_BALANCED_60_40",
      reportStartDate: "2026-01-01",
      reportEndDate: "2026-03-27",
    });
  });

  it("renders a shared unavailable panel when the trend contract returns no rows", async () => {
    getTrendMock.mockResolvedValue({
      correlation_id: "corr-performance",
      contract_version: "v1",
      portfolio_id: "PF_1001",
      as_of_date: "2026-03-27",
      ...REVIEW_CONTEXT_EVIDENCE,
      period: "YTD",
      report_start_date: "2026-01-01",
      report_end_date: "2026-03-27",
      chart_frequency: "monthly",
      detail_basis: "NET",
      attribution_dimension: "asset_class",
      benchmark_code: null,
      rows: [],
      warnings: [],
      partial_failures: [],
    });

    render(
      <PerformanceAttributionTrendPanel
        portfolioId="PF_1001"
        period="YTD"
        chartFrequency="monthly"
        attributionDimension="asset_class"
        detailBasis="NET"
        sourceContext={SOURCE_CONTEXT}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Attribution trend unavailable")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Attribution trend is not available for the current selection."),
    ).toBeInTheDocument();
    expect(
      document.querySelector(".performance-analysis-state-panel-unavailable .module-state-panel"),
    ).toBeTruthy();
  });

  it.each([
    {
      state: "rejected" as const,
      expected:
        "Attribution history remains unavailable because the requested SGD restatement was not accepted. Source evidence remains in USD.",
    },
    {
      state: "accepted_unverified" as const,
      expected:
        "Attribution history is unavailable for this selection. The requested SGD restatement is not source-verified, so no restated history has been inferred.",
    },
    {
      state: "unavailable" as const,
      expected:
        "Attribution history is unavailable because reporting-currency evidence for SGD could not be confirmed.",
    },
  ])("keeps $state currency evidence explicit when no trend rows are supplied", async ({
    state,
    expected,
  }) => {
    getTrendMock.mockResolvedValue({
      ...buildTrendContract(),
      requested_reporting_currency: "SGD",
      effective_reporting_currency: "USD",
      reporting_currency_state: state,
      rows: [],
    });

    render(
      <PerformanceAttributionTrendPanel
        {...buildProps({
          sourceContext: {
            ...SOURCE_CONTEXT,
            requested_reporting_currency: "SGD",
            reporting_currency_state: state,
          },
        })}
        reportingCurrency="SGD"
      />,
    );

    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  it("renders one published observation without implying a time trend", async () => {
    getTrendMock.mockResolvedValue(buildTrendContract());

    render(<PerformanceAttributionTrendPanel {...buildProps()} />);

    expect(
      await screen.findByRole("heading", { name: "Attribution Observation" }),
    ).toBeInTheDocument();
    expect(screen.getByText("One published observation")).toBeInTheDocument();
    expect(
      screen.getByText(/A time trend requires at least two published observations/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Attribution observation table")).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: "Attribution over time chart" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Attribution trend table")).not.toBeInTheDocument();
  });

  it("withholds internally valid history that differs from the workspace context", async () => {
    getTrendMock.mockResolvedValue(buildTrendContract());

    render(
      <PerformanceAttributionTrendPanel
        {...buildProps({
          sourceContext: {
            ...SOURCE_CONTEXT,
            as_of_date: "2026-03-26",
            effective_as_of_date: "2026-03-26",
          },
        })}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Attribution history does not match this review",
    );
    expect(screen.queryByLabelText("Attribution observation table")).not.toBeInTheDocument();
  });

  it("keeps request failure distinct from source-confirmed absence and retries the exact selection", async () => {
    getTrendMock
      .mockRejectedValueOnce(new WorkbenchApiError("performance attribution trend", 503))
      .mockResolvedValueOnce(buildTrendContract());

    render(<PerformanceAttributionTrendPanel {...buildProps()} />);

    const failure = await screen.findByRole("alert");
    expect(failure).toHaveTextContent("Attribution history could not be refreshed");
    expect(failure).toHaveTextContent("Source response 503");
    expect(screen.queryByText("Attribution trend unavailable")).not.toBeInTheDocument();

    const refresh = screen.getByRole("button", { name: "Refresh history" });
    refresh.focus();
    fireEvent.click(refresh);

    expect(screen.getByRole("button", { name: "Refreshing…" })).toBeDisabled();
    expect(
      await screen.findByRole("heading", { name: "Attribution Observation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh history" })).toHaveFocus();
    expect(getTrendMock).toHaveBeenCalledTimes(2);
    expect(getTrendMock.mock.calls[1]).toEqual(getTrendMock.mock.calls[0]);
  });

  it("fails permission blocks closed without exposing a retry", async () => {
    getTrendMock.mockRejectedValue(new WorkbenchApiError("performance attribution trend", 403));

    render(<PerformanceAttributionTrendPanel {...buildProps()} />);

    const failure = await screen.findByRole("alert");
    expect(failure).toHaveTextContent("Attribution history restricted");
    expect(failure).toHaveTextContent("Source response 403");
    expect(screen.queryByRole("button", { name: "Refresh history" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "History restricted" })).toBeDisabled();
  });

  it("consumes a manual refresh once and reuses its confirmed cache after returning to the selection", async () => {
    getTrendMock.mockResolvedValue(buildTrendContract());

    const { rerender } = render(<PerformanceAttributionTrendPanel {...buildProps()} />);

    await screen.findByRole("heading", { name: "Attribution Observation" });
    fireEvent.click(screen.getByRole("button", { name: "Refresh history" }));
    await waitFor(() => expect(getTrendMock).toHaveBeenCalledTimes(2));

    rerender(<PerformanceAttributionTrendPanel {...buildProps({ period: "3M" })} />);
    await waitFor(() => expect(getTrendMock).toHaveBeenCalledTimes(3));

    rerender(<PerformanceAttributionTrendPanel {...buildProps()} />);
    await screen.findByRole("heading", { name: "Attribution Observation" });
    await waitFor(() => expect(getTrendMock).toHaveBeenCalledTimes(3));
  });

  it("purges confirmed cached history when a later refresh is permission-blocked", async () => {
    getTrendMock
      .mockResolvedValueOnce(buildTrendContract())
      .mockRejectedValueOnce(new WorkbenchApiError("performance attribution trend", 403))
      .mockResolvedValueOnce(buildTrendContract({ period: "3M" }))
      .mockRejectedValueOnce(new WorkbenchApiError("performance attribution trend", 403));

    const { rerender } = render(<PerformanceAttributionTrendPanel {...buildProps()} />);

    await screen.findByRole("heading", { name: "Attribution Observation" });
    fireEvent.click(screen.getByRole("button", { name: "Refresh history" }));
    await screen.findByText("Attribution history restricted");

    rerender(<PerformanceAttributionTrendPanel {...buildProps({ period: "3M" })} />);
    await screen.findByRole("heading", { name: "Attribution Observation" });

    rerender(<PerformanceAttributionTrendPanel {...buildProps()} />);
    await screen.findByText("Attribution history restricted");
    expect(getTrendMock).toHaveBeenCalledTimes(4);
  });

  it("purges cached history when an obsolete refresh is permission-blocked", async () => {
    let rejectObsoleteRefresh!: (error: Error) => void;
    getTrendMock
      .mockResolvedValueOnce(buildTrendContract())
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          rejectObsoleteRefresh = reject;
        }),
      )
      .mockResolvedValueOnce(buildTrendContract({ period: "3M" }))
      .mockRejectedValueOnce(new WorkbenchApiError("performance attribution trend", 403));

    const { rerender } = render(<PerformanceAttributionTrendPanel {...buildProps()} />);

    await screen.findByRole("heading", { name: "Attribution Observation" });
    fireEvent.click(screen.getByRole("button", { name: "Refresh history" }));
    await waitFor(() => expect(getTrendMock).toHaveBeenCalledTimes(2));

    rerender(<PerformanceAttributionTrendPanel {...buildProps({ period: "3M" })} />);
    await screen.findByRole("heading", { name: "Attribution Observation" });
    await act(async () => {
      rejectObsoleteRefresh(new WorkbenchApiError("performance attribution trend", 403));
      await Promise.resolve();
    });

    rerender(<PerformanceAttributionTrendPanel {...buildProps()} />);
    await screen.findByText("Attribution history restricted");
    expect(getTrendMock).toHaveBeenCalledTimes(4);
  });

  it("does not restore refresh focus after the user moves to another control", async () => {
    let resolveRetry: ((value: ReturnType<typeof buildTrendContract>) => void) | undefined;
    getTrendMock
      .mockRejectedValueOnce(new WorkbenchApiError("performance attribution trend", 503))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRetry = resolve;
          }),
      );

    render(
      <>
        <PerformanceAttributionTrendPanel {...buildProps()} />
        <button type="button">Continue review</button>
      </>,
    );

    const refresh = await screen.findByRole("button", { name: "Refresh history" });
    refresh.focus();
    fireEvent.click(refresh);
    const continueReview = screen.getByRole("button", { name: "Continue review" });
    continueReview.focus();
    resolveRetry?.(buildTrendContract());

    await screen.findByRole("heading", { name: "Attribution Observation" });
    expect(continueReview).toHaveFocus();
  });

  it("does not let an obsolete request replace newer trend evidence", async () => {
    let resolveObsolete!: (value: ReturnType<typeof buildTrendContract>) => void;
    getTrendMock
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveObsolete = resolve;
        }),
      )
      .mockResolvedValueOnce(
        buildTrendContract({
          period: "1Y",
          rows: [
            {
              ...buildTrendContract().rows[0],
              period_label: "Current evidence",
            },
          ],
        }),
      );

    const { rerender } = render(<PerformanceAttributionTrendPanel {...buildProps()} />);
    rerender(<PerformanceAttributionTrendPanel {...buildProps({ period: "1Y" })} />);

    expect(await screen.findByText("Current evidence")).toBeInTheDocument();
    resolveObsolete(
      buildTrendContract({
        rows: [
          {
            ...buildTrendContract().rows[0],
            period_label: "Obsolete evidence",
          },
        ],
      }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Obsolete evidence")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Current evidence")).toBeInTheDocument();
  });

  it("withholds attribution history from a different analytical scope", async () => {
    getTrendMock.mockResolvedValue(buildTrendContract({ period: "1Y" }));

    render(<PerformanceAttributionTrendPanel {...buildProps()} />);

    expect(
      await screen.findByText("Attribution history does not match this review"),
    ).toBeInTheDocument();
    expect(screen.queryByText("2026-01")).not.toBeInTheDocument();
  });

  it("withholds attribution history containing a stale observation window", async () => {
    const trend = buildTrendContract();
    getTrendMock.mockResolvedValue({
      ...trend,
      rows: trend.rows.map((row, index) =>
        index === 0 ? { ...row, period_start: "2025-12-01" } : row,
      ),
    });

    render(<PerformanceAttributionTrendPanel {...buildProps()} />);

    expect(
      await screen.findByText("Attribution history does not match this review"),
    ).toBeInTheDocument();
    expect(screen.queryByText("2026-01")).not.toBeInTheDocument();
  });

  it("reloads attribution history when the confirmed source context changes", async () => {
    const requestedContext = {
      ...SOURCE_CONTEXT,
      requested_reporting_currency: "SGD",
      effective_reporting_currency: "USD",
    };
    const appliedContext = {
      ...requestedContext,
      effective_reporting_currency: "SGD",
      reporting_currency_state: "applied" as const,
    };
    getTrendMock
      .mockResolvedValueOnce(
        buildTrendContract({
          requested_reporting_currency: "SGD",
          effective_reporting_currency: "USD",
        }),
      )
      .mockResolvedValueOnce(
        buildTrendContract({
          requested_reporting_currency: "SGD",
          effective_reporting_currency: "SGD",
          reporting_currency_state: "applied",
          rows: [
            {
              ...buildTrendContract().rows[0],
              period_label: "Applied context evidence",
            },
          ],
        }),
      );

    const { rerender } = render(
      <PerformanceAttributionTrendPanel
        {...buildProps({
          reportingCurrency: "SGD",
          sourceContext: requestedContext,
        })}
      />,
    );
    await screen.findByText("2026-01");

    rerender(
      <PerformanceAttributionTrendPanel
        {...buildProps({
          reportingCurrency: "SGD",
          sourceContext: appliedContext,
        })}
      />,
    );

    expect(await screen.findByText("Applied context evidence")).toBeInTheDocument();
    expect(getTrendMock).toHaveBeenCalledTimes(2);
  });

  it("shows a normalization notice when the trend endpoint adjusts unsupported controls", async () => {
    getTrendMock.mockResolvedValue({
      correlation_id: "corr-performance",
      contract_version: "v1",
      portfolio_id: "PF_1001",
      as_of_date: "2026-03-27",
      ...REVIEW_CONTEXT_EVIDENCE,
      period: "YTD",
      report_start_date: "2026-01-01",
      report_end_date: "2026-03-27",
      chart_frequency: "monthly",
      detail_basis: "NET",
      attribution_dimension: "asset_class",
      requested_chart_frequency_supported: false,
      requested_attribution_dimension_supported: false,
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
        },
      ],
      warnings: [
        "PERFORMANCE_ATTRIBUTION_TREND_CHART_FREQUENCY_NORMALIZED",
        "PERFORMANCE_ATTRIBUTION_TREND_DIMENSION_NORMALIZED",
      ],
      partial_failures: [],
    });

    render(
      <PerformanceAttributionTrendPanel
        portfolioId="PF_1001"
        period="YTD"
        chartFrequency="weekly"
        attributionDimension="issuer"
        detailBasis="NET"
        benchmark="BMK_GLOBAL_BALANCED_60_40"
        reportStartDate="2026-01-01"
        reportEndDate="2026-03-27"
        sourceContext={SOURCE_CONTEXT}
      />,
    );

    const notice = await screen.findByRole("status", {
      name: "Attribution trend normalization",
    });
    expect(notice).toHaveTextContent("Selection adjusted");
    expect(notice).toHaveTextContent("frequency reset to Monthly");
    expect(notice).toHaveTextContent("segment reset to Asset Class");
  });

  it("pushes resolved trend controls back through the shared request handler", async () => {
    const onRequestChange = vi.fn();
    getTrendMock.mockResolvedValue({
      correlation_id: "corr-performance",
      contract_version: "v1",
      portfolio_id: "PF_1001",
      as_of_date: "2026-03-27",
      ...REVIEW_CONTEXT_EVIDENCE,
      period: "YTD",
      report_start_date: "2026-01-01",
      report_end_date: "2026-03-27",
      chart_frequency: "monthly",
      detail_basis: "NET",
      attribution_dimension: "asset_class",
      requested_chart_frequency_supported: false,
      requested_attribution_dimension_supported: false,
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
        },
      ],
      warnings: [],
      partial_failures: [],
    });

    render(
      <PerformanceAttributionTrendPanel
        portfolioId="PF_1001"
        period="YTD"
        chartFrequency="weekly"
        attributionDimension="issuer"
        detailBasis="NET"
        benchmark="BMK_GLOBAL_BALANCED_60_40"
        reportStartDate="2026-01-01"
        reportEndDate="2026-03-27"
        sourceContext={SOURCE_CONTEXT}
        onRequestChange={onRequestChange}
      />,
    );

    await waitFor(() => {
      expect(onRequestChange).toHaveBeenCalledWith({
        chartFrequency: "monthly",
        attributionDimension: "asset_class",
      });
    });
  });
});

function buildProps(
  overrides: Partial<React.ComponentProps<typeof PerformanceAttributionTrendPanel>> = {},
) {
  return {
    portfolioId: "PF_1001",
    period: "YTD",
    chartFrequency: "monthly",
    attributionDimension: "asset_class",
    detailBasis: "NET",
    benchmark: "BMK_GLOBAL_BALANCED_60_40",
    reportStartDate: "2026-01-01",
    reportEndDate: "2026-03-27",
    sourceContext: SOURCE_CONTEXT,
    ...overrides,
  };
}

function buildTrendContract(overrides: Partial<Awaited<ReturnType<typeof getTrendMock>>> = {}) {
  return {
    correlation_id: "corr-performance",
    contract_version: "v1",
    portfolio_id: "PF_1001",
    as_of_date: "2026-03-27",
    ...REVIEW_CONTEXT_EVIDENCE,
    period: "YTD",
    report_start_date: "2026-01-01",
    report_end_date: "2026-03-27",
    chart_frequency: "monthly",
    detail_basis: "NET",
    attribution_dimension: "asset_class",
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
      },
    ],
    warnings: [],
    partial_failures: [],
    ...overrides,
  };
}
