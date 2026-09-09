import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PortfolioWorkspaceToolbar from "@/apps/portfolio/components/portfolio-workspace-toolbar";

describe("PortfolioWorkspaceToolbar", () => {
  it("coalesces repeated recheck actions while the same request is pending", async () => {
    let completeRefresh: (() => void) | undefined;
    const onRefresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          completeRefresh = resolve;
        }),
    );

    render(
      <PortfolioWorkspaceToolbar
        controls={{
          asOfDate: "2026-03-29",
          reportingCurrency: "USD",
          viewMode: "summary",
          timeWindow: "30D",
          customStartDate: "",
          customEndDate: "",
          columnMode: "essential",
          hideEmptyModules: false,
          focusExceptions: false,
        }}
        context={{
          selectedAsOfDate: "2026-03-29",
          selectedReportingCurrency: "USD",
          timeWindow: "30D",
          periodLabel: "30D",
          viewMode: "summary",
          columnMode: "essential",
          hideEmptyModules: false,
          focusExceptions: false,
          effectivePeriodStartDate: "2026-03-01",
          effectivePeriodEndDate: "2026-03-29",
          usesCustomDateRange: false,
          hasHistoricalGap: false,
          currencyOptions: ["USD"],
          historicalSnapshotState: "supported",
          historicalSnapshotReason: "Historical portfolio records are supported.",
          supportsHistoricalSnapshots: true,
          reportingCurrencyRestatementState: "supported",
          reportingCurrencyRestatementReason: "Reporting currency is supported.",
          supportsReportingCurrencyRestatement: true,
        }}
        onControlsChange={vi.fn()}
        onExport={vi.fn()}
        quickActions={[]}
        sourceReceipt={{
          checkedAt: Date.now() - 2 * 60_000,
          refreshScope: "PORT_1001|2026-03-29|USD|30D",
          isRefreshing: false,
          onRefresh,
        }}
      />,
    );

    const recheck = screen.getByRole("button", { name: "Recheck portfolio" });
    fireEvent.click(recheck);
    fireEvent.click(recheck);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      completeRefresh?.();
    });
  });

  it("renders only controls that change visible review evidence and exposes source-backed actions", () => {
    const onControlsChange = vi.fn();
    const onExport = vi.fn();

    render(
      <PortfolioWorkspaceToolbar
        controls={{
          asOfDate: "2026-03-29",
          reportingCurrency: "USD",
          viewMode: "detailed",
          timeWindow: "30D",
          customStartDate: "2026-03-01",
          customEndDate: "2026-03-29",
          columnMode: "essential",
          hideEmptyModules: false,
          focusExceptions: false,
        }}
        context={{
          selectedAsOfDate: "2026-03-29",
          selectedReportingCurrency: "USD",
          timeWindow: "30D",
          periodLabel: "30D",
          viewMode: "detailed",
          columnMode: "essential",
          hideEmptyModules: false,
          focusExceptions: false,
          effectivePeriodStartDate: "2026-03-01",
          effectivePeriodEndDate: "2026-03-29",
          usesCustomDateRange: false,
          hasHistoricalGap: false,
          currencyOptions: ["USD", "EUR"],
          historicalSnapshotState: "supported",
          historicalSnapshotReason: "Historical snapshots are fully source-backed.",
          supportsHistoricalSnapshots: true,
          reportingCurrencyRestatementState: "partial",
          reportingCurrencyRestatementReason:
            "Book-style holdings honor reporting currency, but performance snapshot does not.",
          supportsReportingCurrencyRestatement: false,
        }}
        onControlsChange={onControlsChange}
        onExport={onExport}
        quickActions={[
          { key: "review", label: "Review performance", href: "/performance?portfolioId=PORT_1001" },
        ]}
        sourceReceipt={{
          checkedAt: Date.now() - 2 * 60_000,
          refreshScope: "PORT_1001|2026-03-29|USD|30D",
          isRefreshing: false,
          onRefresh: vi.fn().mockResolvedValue(undefined),
        }}
      />
    );

    expect(
      screen.getByText("Portfolio records use the confirmed business date."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/As of 29 Mar 2026\./i)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /Some workflow views keep book currency until full restatement is available\./i
      )
    ).toBeInTheDocument();
    expect(
      screen
        .getByLabelText("Reporting currency")
        .closest(
          "div[title='Book-style holdings honor reporting currency, but performance snapshot does not.']"
        )
    ).not.toBeNull();
    expect(screen.getByText(/Period 30D\./i)).toBeInTheDocument();
    const contextControls = screen.getByRole("group", { name: "Context controls" });
    const periodControls = screen.getByRole("group", { name: "Period controls" });
    expect(contextControls).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "View controls" })).not.toBeInTheDocument();
    expect(periodControls).toBeInTheDocument();
    expect(within(contextControls).getByText("Context")).toHaveClass("workbench-toolbar-group-title");
    expect(within(periodControls).getAllByText("Period")[0]).toHaveClass("workbench-toolbar-group-title");
    expect(screen.getByRole("radiogroup", { name: "Portfolio period presets" }))
      .toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: "Portfolio view navigation" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "YTD" }));
    expect(onControlsChange).toHaveBeenCalledWith({ timeWindow: "YTD" });
    fireEvent.click(screen.getByRole("button", { name: /Export portfolio data/i }));
    expect(onExport).toHaveBeenCalledTimes(1);

    expect(screen.queryByRole("button", { name: /Filters/i })).not.toBeInTheDocument();
    expect(screen.getByText(/^Checked /)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recheck portfolio" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    const actionsMenu = screen.getByRole("menu");
    expect(within(actionsMenu).getByRole("link", { name: "Review performance" })).toHaveAttribute(
      "href",
      "/performance?portfolioId=PORT_1001"
    );
  });

  it("renders gateway historical and reporting capability reasons when controls are not fully supported", () => {
    render(
      <PortfolioWorkspaceToolbar
        controls={{
          asOfDate: "2026-03-29",
          reportingCurrency: "USD",
          viewMode: "summary",
          timeWindow: "30D",
          customStartDate: "",
          customEndDate: "",
          columnMode: "essential",
          hideEmptyModules: false,
          focusExceptions: false,
        }}
        context={{
          selectedAsOfDate: "2026-03-29",
          selectedReportingCurrency: "USD",
          timeWindow: "30D",
          periodLabel: "30D",
          viewMode: "summary",
          columnMode: "essential",
          hideEmptyModules: false,
          focusExceptions: false,
          effectivePeriodStartDate: "2026-03-01",
          effectivePeriodEndDate: "2026-03-29",
          usesCustomDateRange: false,
          hasHistoricalGap: false,
          currencyOptions: ["USD"],
          historicalSnapshotState: "partial",
          historicalSnapshotReason:
            "Most portfolio modules honor as_of_date, but rebalance and performance snapshot still follow separate control semantics.",
          supportsHistoricalSnapshots: false,
          reportingCurrencyRestatementState: "unsupported",
          reportingCurrencyRestatementReason:
            "Workflow, readiness, and performance snapshot do not yet share reporting currency.",
          supportsReportingCurrencyRestatement: false,
        }}
        onControlsChange={vi.fn()}
        onExport={vi.fn()}
        quickActions={[]}
      />
    );

    expect(
      screen.getByText(
        /Historical review is not available across the portfolio record\./i
      )
    ).toBeInTheDocument();
    expect(
      screen
        .getByLabelText("As of")
        .closest(
          "div[title='Most portfolio modules honor as_of_date, but rebalance and performance snapshot still follow separate control semantics.']"
        )
    ).not.toBeNull();
    expect(
      screen.getByText(
        /Some workflow views keep book currency until full restatement is available\./i
      )
    ).toBeInTheDocument();
    expect(
      screen
        .getByLabelText("Reporting currency")
        .closest(
          "div[title='Workflow, readiness, and performance snapshot do not yet share reporting currency.']"
        )
    ).not.toBeNull();
  });

  it("uses the published date range for a supported historical capability", () => {
    const onControlsChange = vi.fn();
    render(
      <PortfolioWorkspaceToolbar
        controls={{
          asOfDate: "2026-03-29",
          reportingCurrency: "USD",
          viewMode: "summary",
          timeWindow: "30D",
          customStartDate: "",
          customEndDate: "",
          columnMode: "essential",
          hideEmptyModules: false,
          focusExceptions: false,
        }}
        context={{
          selectedAsOfDate: "2026-03-29",
          selectedReportingCurrency: "USD",
          timeWindow: "30D",
          periodLabel: "30D",
          viewMode: "summary",
          columnMode: "essential",
          hideEmptyModules: false,
          focusExceptions: false,
          effectivePeriodStartDate: "2026-03-01",
          effectivePeriodEndDate: "2026-03-29",
          usesCustomDateRange: false,
          hasHistoricalGap: true,
          currencyOptions: ["USD"],
          historicalSnapshotState: "supported",
          historicalSnapshotReason: "Historical portfolio records are supported.",
          supportsHistoricalSnapshots: true,
          historicalDateRange: {
            earliest: "2024-01-15",
            latest: "2026-05-12",
          },
          reportingCurrencyRestatementState: "partial",
          reportingCurrencyRestatementReason: "Reporting-currency restatement is not uniform.",
          supportsReportingCurrencyRestatement: false,
        }}
        onControlsChange={onControlsChange}
        onExport={vi.fn()}
        quickActions={[]}
      />
    );

    const dateControl = screen.getByLabelText("As of");
    expect(dateControl).toBeEnabled();
    expect(dateControl).toHaveAttribute("min", "2024-01-15");
    expect(dateControl).toHaveAttribute("max", "2026-05-12");
    expect(
      screen.getByText(
        "Some work areas use the latest available book state."
      )
    ).toBeInTheDocument();

    fireEvent.change(dateControl, { target: { value: "2026-03-28" } });
    expect(onControlsChange).toHaveBeenCalledWith({ asOfDate: "2026-03-28" });
  });
});
