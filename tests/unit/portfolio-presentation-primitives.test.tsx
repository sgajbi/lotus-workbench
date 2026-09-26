import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PortfolioModuleState from "../../src/apps/portfolio/components/portfolio-module-state";

describe("portfolio presentation primitives", () => {
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
