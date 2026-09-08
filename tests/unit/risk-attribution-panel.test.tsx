import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import RiskAttributionPanel from "../../src/apps/performance/components/risk/risk-attribution-panel";
import {
  buildFixtureRiskAttribution,
  buildPerformanceRiskViewModel,
} from "../../src/apps/performance/risk-workspace-view-model";
import type { WorkbenchRiskAttributionResponse } from "../../src/features/workbench/types";
import { buildSupportedPerformanceScenario } from "../fixtures/performance-workspace-fixtures";

function buildRiskViewModel(
  state: WorkbenchRiskAttributionResponse["state"] = "ready",
) {
  const scenario = buildSupportedPerformanceScenario();
  const attribution = buildFixtureRiskAttribution(
    scenario.workspace,
    "YTD",
    "NET",
  );

  return buildPerformanceRiskViewModel({
    workspace: scenario.workspace,
    period: "YTD",
    detailBasis: "NET",
    riskAttribution: {
      ...attribution,
      state,
    },
  });
}

describe("RiskAttributionPanel", () => {
  it("uses the compact secondary-panel review contract for attribution", () => {
    const viewModel = buildRiskViewModel();
    const onSelectAttribution = vi.fn();
    const { container } = render(
      <RiskAttributionPanel viewModel={viewModel} onSelectAttribution={onSelectAttribution} />
    );

    expect(screen.getByRole("heading", { name: "Historical Risk Attribution" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Historical risk attribution business reading")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Private Credit is the largest visible contributor/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Risk attribution highlights")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Risk attribution detail")).toBeInTheDocument();
    expect(container.querySelector(".performance-risk-detail-section-compact")).toBeTruthy();
    expect(container.querySelector(".performance-risk-analytical-table-compact")).toBeTruthy();
    expect(container.querySelector(".performance-risk-attribution-detail-table")).toBeTruthy();
    expect(container.querySelectorAll(".performance-risk-share-bar")).not.toHaveLength(0);
    expect(container.querySelectorAll(".performance-risk-share-bar-track")).not.toHaveLength(0);
    expect(container.querySelector(".performance-risk-attribution-toolbar")).toBeTruthy();
    expect(screen.getAllByRole("radiogroup")).toHaveLength(2);
    expect(screen.queryByText("Attribution reconciliation")).not.toBeInTheDocument();
    expect(screen.queryByText("Current decomposition lens for contributor review.")).not.toBeInTheDocument();
    expect(screen.queryByText("Largest visible component effect at 5.83%.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Historical Risk Attribution methodology and coverage" })).toBeInTheDocument();
  });

  it.each([
    ["clean proxy", []],
    ["mixed calculation failure", ["One review period has insufficient observations."]],
  ])(
    "keeps exact %s facts but withholds unsupported magnitude tracks",
    (_caseName, warnings) => {
      const viewModel = buildRiskViewModel("partial");
      viewModel.attributionWarnings = warnings;
      const { container } = render(
        <RiskAttributionPanel
          viewModel={viewModel}
          onSelectAttribution={vi.fn()}
        />,
      );

      expect(screen.getByText("Attribution is indicative")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Source evidence is incomplete. When contributor values are available, they are shown without magnitude bars until the source reports the attribution as ready.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(/proxy calculation/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText("Historical risk attribution table")).toHaveTextContent(
        "Technology",
      );
      expect(screen.getByLabelText("Historical risk attribution table")).toHaveTextContent(
        "41.00%",
      );
      expect(container.querySelectorAll(".performance-risk-share-bar")).not.toHaveLength(0);
      expect(container.querySelectorAll(".performance-risk-share-bar-track")).toHaveLength(0);
      expect(screen.queryByText("group_return_series_unavailable")).not.toBeInTheDocument();
      for (const warning of warnings) {
        expect(screen.getByText(warning)).toBeInTheDocument();
      }
    },
  );

  it("does not promise contributor values when partial evidence has no rows", () => {
    const viewModel = buildRiskViewModel("partial");
    viewModel.attributionRows = [];

    render(
      <RiskAttributionPanel viewModel={viewModel} onSelectAttribution={vi.fn()} />,
    );

    expect(
      screen.getByText(
        "Source evidence is incomplete. When contributor values are available, they are shown without magnitude bars until the source reports the attribution as ready.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/values remain visible/i)).not.toBeInTheDocument();
    expect(screen.getByText("No attribution contributors")).toBeInTheDocument();
  });

  it("keeps reconciled sum and evidence posture in the methodology drawer instead of the main panel", () => {
    const viewModel = buildRiskViewModel();

    render(<RiskAttributionPanel viewModel={viewModel} onSelectAttribution={vi.fn()} />);

    expect(screen.queryByText("Reconciled sum")).not.toBeInTheDocument();
    expect(screen.queryByText("Evidence posture")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Historical Risk Attribution methodology and coverage" })
    );

    const dialog = screen.getByRole("dialog", {
      name: "Historical Risk Attribution methodology and coverage",
    });

    expect(within(dialog).getByText("Reconciled sum")).toBeInTheDocument();
    expect(within(dialog).getByText("Evidence posture")).toBeInTheDocument();
  });
});
