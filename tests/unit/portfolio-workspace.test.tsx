import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PortfolioWorkspaceView from "../../src/apps/portfolio/components/portfolio-workspace";
import PortfolioSummaryHeaderSection from "../../src/apps/portfolio/components/portfolio-summary-header-section";
import { buildPortfolioWorkspace, buildPortfolioWorkspaceContext } from "../fixtures/portfolio-workspace-component-fixtures";

describe("PortfolioWorkspaceView", () => {
  it.each([
    ["unknown cash", null, null, null, "N/A", "N/A", "N/A"],
    ["positive cash", 100, 10, 900, "100 USD", "10.00%", "90.00%"],
    ["measured zero", 0, 0, 1000, "0 USD", "0.00%", "100.00%"],
    ["negative cash", -100, -10, 1100, "-100 USD", "-10.00%", "110.00%"],
  ] as const)("renders %s summary without hiding independent portfolio value", (_label, cash, weight, invested, cashDisplay, cashWeightDisplay, investedWeightDisplay) => {
    const workspace = buildPortfolioWorkspace();
    workspace.summary = { ...workspace.summary, market_value_base: 1000, total_cash_base: cash, cash_weight_pct: weight, invested_market_value_base: invested };
    render(<PortfolioSummaryHeaderSection workspace={workspace} onOpenMetricDrawer={() => {}} />);
    const metrics = screen.getByRole("group", { name: "Portfolio key metrics" });
    const cashTile = within(metrics).getByText("Cash").closest(".portfolio-summary-band-item")!;
    const investedTile = within(metrics).getByText("Invested assets").closest(".portfolio-summary-band-item")!;
    const valueTile = within(metrics).getByText("Portfolio value").closest(".portfolio-summary-band-item")!;
    expect(valueTile).toHaveTextContent("1,000 USD");
    expect(cashTile).toHaveTextContent(cashDisplay);
    expect(cashTile).toHaveTextContent(cashWeightDisplay);
    expect(investedTile).toHaveTextContent(investedWeightDisplay);
    if (invested === null) {
      expect(investedTile).not.toHaveTextContent("0.00%");
      expect(cashTile).not.toHaveTextContent("0 USD");
    }
  });

  it("keeps a visible My Book recovery action when selected portfolio context is unavailable", () => {
    render(
      <PortfolioWorkspaceView
        workspace={null}
        context={buildPortfolioWorkspaceContext()}
      />
    );

    expect(screen.getByText("Selected portfolio unavailable")).toBeInTheDocument();
    expect(screen.getByTestId("portfolio-shell-unavailable")).toHaveTextContent(
      "no other portfolio has been substituted",
    );
    expect(screen.getAllByRole("link", { name: "Open My book" })).not.toHaveLength(0);
    for (const link of screen.getAllByRole("link", { name: "Open My book" })) {
      expect(link).toHaveAttribute("href", "/book");
    }
    expect(screen.getByRole("status")).toHaveTextContent(
      "The selected portfolio is unavailable",
    );
  });

  it("shows source confirmation as loading before terminal recovery actions", () => {
    render(
      <PortfolioWorkspaceView
        workspace={null}
        workspaceStatus="loading"
        context={buildPortfolioWorkspaceContext()}
      />,
    );

    expect(screen.getByText("Preparing portfolio review")).toBeInTheDocument();
    expect(screen.getByText("Confirming the selected portfolio.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open My book" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("portfolio-shell-unavailable")).not.toBeInTheDocument();
  });
});
