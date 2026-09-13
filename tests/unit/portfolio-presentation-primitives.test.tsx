import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PortfolioCollapsibleModule from "../../src/apps/portfolio/components/portfolio-collapsible-module";
import PortfolioModuleState from "../../src/apps/portfolio/components/portfolio-module-state";
import PortfolioPerformanceSparkline from "../../src/apps/portfolio/components/portfolio-performance-sparkline";

describe("portfolio presentation primitives", () => {
  it("withholds an insufficient sparkline and renders complete source series with their labels", () => {
    const { rerender } = render(
      <PortfolioPerformanceSparkline points={[{ label: "Jan", portfolio_return_pct: 1 }]} />,
    );
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();

    rerender(
      <PortfolioPerformanceSparkline
        benchmarkLabel="Policy benchmark"
        points={[
          { label: "Jan", portfolio_return_pct: -1, benchmark_return_pct: -0.5 },
          { label: "Feb", portfolio_return_pct: 2, benchmark_return_pct: 1 },
        ]}
      />,
    );

    expect(screen.getByRole("figure", { name: "Performance snapshot trend" })).toBeInTheDocument();
    expect(screen.getByText("Portfolio")).toBeInTheDocument();
    expect(screen.getByText("Policy benchmark")).toBeInTheDocument();
    expect(screen.getByText("Jan to Feb")).toBeInTheDocument();
    // Independent scaling: [-1, 2] spans 52 px; -0.5 and 1 sit at 43.33 and 17.33 px.
    const chart = screen.getByRole("img", { name: "Performance snapshot comparison sparkline" });
    expect(Array.from(chart.querySelectorAll("path"), (path) => path.getAttribute("d"))).toEqual([
      "M 0.00 52.00 L 180.00 0.00",
      "M 0.00 43.33 L 180.00 17.33",
    ]);
  });

  it("keeps collapsible module content behind the explicit disclosure control", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <PortfolioCollapsibleModule title="Review detail" subtitle="Source status" expanded={false} onToggle={onToggle}>
        <p>Withheld detail</p>
      </PortfolioCollapsibleModule>,
    );
    expect(screen.queryByText("Withheld detail")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledOnce();

    rerender(
      <PortfolioCollapsibleModule title="Review detail" subtitle="Source status" expanded onToggle={onToggle} compact>
        <p>Withheld detail</p>
      </PortfolioCollapsibleModule>,
    );
    expect(screen.getByText("Withheld detail")).toBeInTheDocument();
  });

  it("renders loading and source-status states without inventing capability", () => {
    const { rerender } = render(
      <PortfolioModuleState variant="loading" title="Loading movements" message="Refreshing source facts." chart rows={3} />,
    );
    expect(screen.getByText("Loading movements")).toBeInTheDocument();

    rerender(
      <PortfolioModuleState
        variant="status"
        state="partial"
        title="Evidence incomplete"
        body="One source record is unavailable."
        hint="Recheck source status."
      />,
    );
    expect(screen.getByText("Evidence incomplete")).toBeInTheDocument();
    expect(screen.getByText("Recheck source status.")).toBeInTheDocument();
  });
});
