import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PortfolioHoldingsGrid from "../../src/apps/portfolio/components/portfolio-holdings-grid";

describe("PortfolioHoldingsGrid empty states", () => {
  it("withholds a selected unvalued holding total instead of publishing measured zero", () => {
    render(<PortfolioHoldingsGrid reviewContext={{ portfolioId: "PB_SG_GLOBAL_BAL_001", asOfDate: "2026-04-10" }}
      positions={[{ security_id: "SEC_1", instrument_name: "Unpriced bond", asset_class: "Fixed Income", quantity: 1, market_value_base: null, weight_pct: null }]}
      baseCurrency="USD" columnMode="expanded" filterLabel="Asset Class: Fixed Income" />);
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.queryByText("0 USD")).not.toBeInTheDocument();
  });
  it("distinguishes an empty exposure result from an empty portfolio", () => {
    const onClearFilter = vi.fn();

    render(
      <PortfolioHoldingsGrid
        reviewContext={{
          portfolioId: "PB_SG_GLOBAL_BAL_001",
          asOfDate: "2026-04-10",
        }}
        positions={[]}
        baseCurrency="USD"
        columnMode="expanded"
        filterLabel="Sector: Technology"
        onClearFilter={onClearFilter}
      />,
    );

    expect(screen.getByText("No contributing positions found")).toBeInTheDocument();
    expect(
      screen.getByText("No booked positions match Sector: Technology."),
    ).toBeInTheDocument();
    expect(screen.queryByText("No positions in this portfolio")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear exposure" }));
    expect(onClearFilter).toHaveBeenCalledOnce();
  });

  it("retains the portfolio onboarding state when the source book is empty", () => {
    render(
      <PortfolioHoldingsGrid
        reviewContext={{
          portfolioId: "PB_SG_GLOBAL_BAL_001",
          asOfDate: "2026-04-10",
        }}
        positions={[]}
        baseCurrency="USD"
        columnMode="essential"
      />,
    );

    expect(screen.getByText("No positions in this portfolio")).toBeInTheDocument();
    expect(screen.queryByText("No contributing positions found")).not.toBeInTheDocument();
  });
});
