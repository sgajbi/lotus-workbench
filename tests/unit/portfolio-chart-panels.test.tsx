import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PortfolioProjectedCashflowPanel } from "../../src/apps/portfolio/components/portfolio-chart-panels";
import type { PortfolioWorkspace } from "../../src/apps/portfolio/types";

describe("portfolio chart panels", () => {
  it("renders projected cashflow with business labels", () => {
    render(
      <PortfolioProjectedCashflowPanel
        cashflowOutlook={buildCashflowOutlook()}
        baseCurrency="USD"
      />
    );

    expect(
      screen.getByRole("img", {
        name: "Projected cash movement chart in USD; bars show dated net movement and the line shows cumulative movement",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Cash movement chart key")).toHaveTextContent(
      "Bars: dated net movementLine: cumulative movement",
    );
    expect(screen.getByLabelText("Projected cash movement mix")).toHaveTextContent("1 positive movement date");
    expect(screen.getByLabelText("Projected cash movement summary")).toHaveTextContent(
      "Net Projected Movement"
    );
    expect(screen.getByLabelText("Projected cash movement summary")).toHaveTextContent(
      "Largest Negative Movement"
    );
    expect(screen.getByLabelText("Projected cash movement summary")).toHaveTextContent(
      "Positive Net Movement"
    );
    expect(screen.getByLabelText("Projected cash movement summary")).toHaveTextContent(
      "Negative Net Movement"
    );
    expect(screen.queryByText("Ending Cumulative")).not.toBeInTheDocument();
  });
});

function buildCashflowOutlook(): NonNullable<PortfolioWorkspace["cashflow_outlook"]> {
  return {
    as_of_date: "2026-02-24",
    range_end_date: "2026-03-05",
    total_net_cashflow_base: -10000,
    projection_days: 10,
    include_projected: true,
    upcoming_points: [
      {
        projection_date: "2026-02-25",
        net_cashflow_base: -15000,
        projected_cumulative_cashflow_base: -15000,
      },
      {
        projection_date: "2026-02-26",
        net_cashflow_base: 5000,
        projected_cumulative_cashflow_base: -10000,
      },
    ],
  };
}
