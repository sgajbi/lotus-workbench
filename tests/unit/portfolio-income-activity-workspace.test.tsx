import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PortfolioIncomeActivityWorkspace from "../../src/apps/portfolio/components/portfolio-income-activity-workspace";
import type { PortfolioWorkspace } from "../../src/apps/portfolio/types";

describe("PortfolioIncomeActivityWorkspace", () => {
  it("preserves unknown cash weight alongside independently booked cash movements", () => {
    const workspace = buildWorkspace();
    workspace.summary.cash_weight_pct = null;
    render(<PortfolioIncomeActivityWorkspace workspace={workspace} />);
    const movements = screen.getByLabelText("Booked cash movement summary");
    expect(within(movements).getByText("N/A")).toBeInTheDocument();
    expect(within(movements).queryByText("0.00%")).not.toBeInTheDocument();
    expect(within(movements).getByText("73,500 USD")).toBeInTheDocument();
  });
  it("renders a truthful booked-income bridge and signed cash movements", () => {
    render(<PortfolioIncomeActivityWorkspace workspace={buildWorkspace()} />);

    expect(screen.getByText("Booked records only")).toBeInTheDocument();
    expect(screen.getByText(/Future income and projected cash are outside this review/i)).toBeInTheDocument();

    const incomeSummary = screen.getByLabelText("Booked income summary");
    expect(within(incomeSummary).getByText("Gross income")).toBeInTheDocument();
    expect(within(incomeSummary).getByText("12,000 USD")).toBeInTheDocument();
    expect(within(incomeSummary).getByText("Net income")).toBeInTheDocument();
    expect(within(incomeSummary).getByText("10,500 USD")).toBeInTheDocument();

    const incomeTable = screen.getByRole("table", { name: "Booked income by type" });
    expect(within(incomeTable).getByText("Dividend income")).toBeInTheDocument();
    expect(within(incomeTable).getByText("Interest income")).toBeInTheDocument();
    expect(within(incomeTable).getByText("Withholding tax")).toBeInTheDocument();
    expect(within(incomeTable).queryByText("Ready")).not.toBeInTheDocument();

    const movementSummary = screen.getByLabelText("Booked cash movement summary");
    expect(within(movementSummary).getByText("Gross inflows")).toBeInTheDocument();
    expect(within(movementSummary).getByText("100,000 USD")).toBeInTheDocument();
    expect(within(movementSummary).getByText("Gross outflows")).toBeInTheDocument();
    expect(within(movementSummary).getByText("26,500 USD")).toBeInTheDocument();
    expect(within(movementSummary).getByText("Net cash movement")).toBeInTheDocument();
    expect(within(movementSummary).getByText("73,500 USD")).toBeInTheDocument();
    expect(within(movementSummary).getByText("Current cash weight")).toBeInTheDocument();
    expect(within(movementSummary).getByText("4.20%")).toBeInTheDocument();

    const activityTable = screen.getByRole("table", { name: "Booked cash movements by type" });
    expect(within(activityTable).getByText("Subscriptions and transfers in")).toBeInTheDocument();
    expect(within(activityTable).getByText("Withdrawals and transfers out")).toBeInTheDocument();
    expect(within(activityTable).getAllByText("Outflow")).toHaveLength(3);
    expect(within(activityTable).getByText("-25,000 USD")).toBeInTheDocument();
    expect(within(activityTable).getByText("Other activity · Corporate Actions")).toBeInTheDocument();
    expect(within(activityTable).getByText("Excluded from net")).toBeInTheDocument();
    expect(screen.getByText("Classification review")).toBeInTheDocument();
  });

  it("shows independent business states when source summaries are absent", () => {
    const workspace = buildWorkspace();
    const { rerender } = render(
      <PortfolioIncomeActivityWorkspace workspace={{ ...workspace, income_summary: null }} />,
    );

    expect(screen.getByText("No booked income in this window")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Booked cash movements by type" })).toBeInTheDocument();
    expect(screen.queryByText(/Publish classified income events/i)).not.toBeInTheDocument();

    rerender(
      <PortfolioIncomeActivityWorkspace workspace={{ ...workspace, activity_summary: null }} />,
    );

    expect(screen.getByText("No booked cash movements in this window")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Booked income by type" })).toBeInTheDocument();
    expect(screen.queryByText(/Publish source-defined activity buckets/i)).not.toBeInTheDocument();
  });
});

function buildWorkspace(): PortfolioWorkspace {
  return {
    as_of_date: "2026-05-12",
    portfolio: {
      portfolio_id: "PB_SG_GLOBAL_BAL_001",
      display_name: "Global Balanced Mandate",
      client_id: "CIF_SG_000184",
      base_currency: "USD",
      booking_center_code: "SG",
    },
    profile: {
      status: "ACTIVE",
      portfolio_type: "DISCRETIONARY",
      risk_exposure: "BALANCED",
      investment_time_horizon: "LONG_TERM",
      objective: "Growth and income",
      is_leverage_allowed: false,
    },
    summary: {
      market_value_base: 1_000_000,
      invested_market_value_base: 958_000,
      total_cash_base: 42_000,
      cash_weight_pct: 4.2,
      position_count: 12,
      cash_balance_count: 1,
    },
    allocations: [],
    allocation_views: [],
    cash_balances: [],
    top_positions: [],
    positions: [],
    recent_transactions: [],
    income_summary: {
      reporting_currency: "USD",
      window_start_date: "2026-04-12",
      window_end_date: "2026-05-12",
      totals_requested_window: buildIncomePeriod(12_000, 1_200, 300, 10_500, 3),
      totals_year_to_date: buildIncomePeriod(30_000, 3_000, 500, 26_500, 8),
      income_types: [
        {
          income_type: "DIVIDEND",
          requested_window: buildIncomePeriod(8_000, 1_000, 0, 7_000, 2),
          year_to_date: buildIncomePeriod(20_000, 2_500, 0, 17_500, 5),
        },
        {
          income_type: "INTEREST",
          requested_window: buildIncomePeriod(4_000, 200, 300, 3_500, 1),
          year_to_date: buildIncomePeriod(10_000, 500, 500, 9_000, 3),
        },
      ],
    },
    activity_summary: {
      reporting_currency: "USD",
      window_start_date: "2026-04-12",
      window_end_date: "2026-05-12",
      buckets: [
        buildActivityBucket("INFLOWS", 100_000, 150_000, 1),
        buildActivityBucket("OUTFLOWS", 25_000, 40_000, 1),
        buildActivityBucket("FEES", 1_000, 2_500, 1),
        buildActivityBucket("TAXES", 500, 1_500, 2),
        buildActivityBucket("CORPORATE_ACTIONS", 2_000, 3_000, 1),
      ],
    },
    cashflow_outlook: null,
    performance: null,
    rebalance: null,
    control_capabilities: null,
    readiness: {
      has_positions: true,
      reporting: { status: "READY", generated_at_utc: "2026-05-12T00:00:00Z", row_count: 12 },
    },
    workflow_cues: [],
    workflow_actions: [],
    warnings: [],
    partial_failures: [],
  };
}

function buildIncomePeriod(
  gross: number,
  withholdingTax: number,
  otherDeductions: number,
  net: number,
  transactionCount: number,
) {
  return {
    gross: { reporting_currency_amount: gross, transaction_count: transactionCount },
    withholding_tax: {
      reporting_currency_amount: withholdingTax,
      transaction_count: transactionCount,
    },
    other_deductions: {
      reporting_currency_amount: otherDeductions,
      transaction_count: transactionCount,
    },
    net: { reporting_currency_amount: net, transaction_count: transactionCount },
  };
}

function buildActivityBucket(bucket: string, requested: number, yearToDate: number, count: number) {
  return {
    bucket,
    requested_window: { reporting_currency_amount: requested, transaction_count: count },
    year_to_date: { reporting_currency_amount: yearToDate, transaction_count: count },
  };
}
