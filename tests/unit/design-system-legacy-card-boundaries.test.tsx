import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/features/domain-products/domain-product-discovery-client", () => ({
  default: () => <div data-testid="domain-product-discovery" />,
}));

import DataProductsPage from "../../src/app/data-products/page";
import ChartCard from "../../src/design-system/components/chart-card";
import DataGridCard from "../../src/design-system/components/data-grid-card";
import FilterBar from "../../src/design-system/components/filter-bar";

describe("legacy design-system card boundaries", () => {
  it("renders the data-product route through its owned discovery client", () => {
    render(<DataProductsPage />);

    expect(screen.getByTestId("domain-product-discovery")).toBeInTheDocument();
  });

  it("keeps chart and data-grid content inside their module cards", () => {
    render(
      <>
        <ChartCard title="Risk concentration" subtitle="Current source facts" actions={<button>Export</button>}>
          <p>Chart evidence</p>
        </ChartCard>
        <DataGridCard>
          <p>Grid evidence</p>
        </DataGridCard>
      </>,
    );

    expect(screen.getByText("Risk concentration")).toBeInTheDocument();
    expect(screen.getByText("Current source facts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByText("Chart evidence")).toBeInTheDocument();
    expect(screen.getByText("Grid evidence")).toBeInTheDocument();
    const chartCard = screen.getByText("Chart evidence").closest(".panel-shell");
    const gridCard = screen.getByText("Grid evidence").closest(".panel-shell");
    expect(chartCard).toContainElement(screen.getByText("Risk concentration"));
    expect(chartCard).toContainElement(screen.getByRole("button", { name: "Export" }));
    expect(chartCard).not.toContainElement(screen.getByText("Grid evidence"));
    expect(gridCard).toContainElement(screen.getByText("Grid evidence"));
    expect(gridCard).not.toBe(chartCard);
  });

  it("preserves filter-group semantics with and without an owned class", () => {
    const { rerender } = render(
      <FilterBar>
        <button>Apply filter</button>
      </FilterBar>,
    );

    expect(screen.getByRole("group", { name: "Active filters" })).toHaveClass("filter-bar");
    rerender(
      <FilterBar className="portfolio-filters">
        <button>Apply filter</button>
      </FilterBar>,
    );
    expect(screen.getByRole("group", { name: "Active filters" })).toHaveClass(
      "filter-bar",
      "portfolio-filters",
    );
  });
});
