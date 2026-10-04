import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import RiskDrawdownPanel from "../../src/apps/performance/components/risk/risk-drawdown-panel";
import {
  buildFixtureRiskDrawdown,
  buildFixtureRiskSummary,
  buildPerformanceRiskViewModel,
  buildUnavailableRiskDrawdown,
} from "../../src/apps/performance/risk-workspace-view-model";
import {
  buildBenchmarkUnassignedPerformanceScenario,
  buildSupportedPerformanceScenario,
} from "../fixtures/performance-workspace-fixtures";

function buildRiskViewModel({
  benchmarkUnassigned = false,
  includeEpisodes = true,
}: {
  benchmarkUnassigned?: boolean;
  includeEpisodes?: boolean;
} = {}) {
  const scenario = benchmarkUnassigned
    ? buildBenchmarkUnassignedPerformanceScenario()
    : buildSupportedPerformanceScenario();
  const drawdown = buildFixtureRiskDrawdown(scenario.workspace, "YTD", "NET", {
    includeBenchmarkRelative: !benchmarkUnassigned,
  });

  if (!includeEpisodes) {
    const period = drawdown.payload?.periods[0];
    if (period) {
      period.episodes = [];
    }
  }

  return buildPerformanceRiskViewModel({
    workspace: scenario.workspace,
    period: "YTD",
    detailBasis: "NET",
    riskDrawdown: drawdown,
  });
}

describe("RiskDrawdownPanel", () => {
  it.each([
    { depth: 0, recovered: true, days: 0, relativeRecovered: false, relativeDays: 2, value: "No drawdown", duration: "0" },
    { depth: -0.05, recovered: false, days: 2, relativeRecovered: true, relativeDays: 0, value: "Open", duration: "2" },
    { depth: -0.05, recovered: true, days: 2, relativeRecovered: false, relativeDays: 4, value: "Recovered", duration: "2" },
    { depth: -0.05, recovered: null, days: null, relativeRecovered: true, relativeDays: 0, value: "N/A", duration: "N/A" },
    { depth: 0, recovered: false, days: 0, relativeRecovered: true, relativeDays: 0, value: "N/A", duration: "0" },
  ])("renders portfolio recovery $value and duration $duration with matching accessible definitions", (control) => {
    const scenario = buildSupportedPerformanceScenario();
    const response = buildFixtureRiskDrawdown(scenario.workspace, "YTD", "NET");
    Object.assign(response.payload!.periods[0].summary!, { max_drawdown: control.depth, is_recovered: control.recovered, time_under_water_days: control.days });
    if (control.depth === 0 && control.recovered && control.days === 0) {
      Object.assign(response.payload!.periods[0].summary!, { max_drawdown_peak_date: null, max_drawdown_trough_date: null, max_drawdown_recovery_date: null, days_to_trough: 0, days_to_recovery: 0 });
      response.payload!.periods[0].episodes = [];
    }
    Object.assign(response.payload!.periods[0].relative_to_benchmark!, { max_drawdown: -0.07, is_recovered: control.relativeRecovered, time_under_water_days: control.relativeDays });
    const model = buildPerformanceRiskViewModel({ workspace: scenario.workspace, period: "YTD", detailBasis: "NET", riskDrawdown: response });
    render(<RiskDrawdownPanel viewModel={model} onViewUnderwater={() => {}} />);
    const headlines = screen.getByLabelText("Risk drawdown headline metrics");
    const recovery = within(headlines).getByRole("article", { name: `Recovery status: ${control.value}. Whether the portfolio had no drawdown, recovered its worst drawdown, or remained below its peak at period end.` });
    expect(within(recovery).getByText(control.value)).toBeInTheDocument();
    const duration = within(headlines).getByRole("article", { name: `Time under water: ${control.duration}. Number of business days the portfolio remained below its prior peak.` });
    expect(within(duration).getByText(control.duration)).toBeInTheDocument();
    expect(within(headlines).getByRole("article", { name: /Relative max drawdown: -7.00%/ })).toBeInTheDocument();
    expect(screen.queryByText(model.drawdownHeadlineMetrics.find((card) => card.key === "recovery_status")!.support)).not.toBeInTheDocument();
  });

  it("prioritizes front-office drawdown interpretation ahead of episode detail", () => {
    const viewModel = buildRiskViewModel();
    const { container } = render(
      <RiskDrawdownPanel
        viewModel={viewModel}
        onViewUnderwater={() => {}}
      />
    );
    expect(screen.getByRole("heading", { name: "Drawdown" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Drawdown business reading")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Episode review" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Drawdown methodology and coverage" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View underwater path" })).toBeInTheDocument();

    const headlineLabels = Array.from(
      container.querySelectorAll(".performance-risk-drawdown-headline-grid .ui-text-label")
    ).map((node) => node.textContent?.trim());
    expect(headlineLabels).toEqual([
      "Max drawdown",
      "Relative max drawdown",
      "Time under water",
      "Recovery status",
      "Ulcer index",
    ]);
    expect(screen.queryByRole("heading", { name: "Supporting risk measures" })).not.toBeInTheDocument();
    expect(
      screen.queryByText("Shows how persistent and painful the underwater path was, not just how deep it got.")
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Ulcer index: Path-sensitive drawdown measure that reflects both drawdown depth and time spent underwater.",
      })
    ).toBeInTheDocument();

    const episodeSection = screen.getByLabelText("Risk drawdown detail");
    expect(episodeSection).toHaveClass("performance-risk-detail-section-compact");
    expect(
      (episodeSection as HTMLElement).querySelector(".performance-risk-note-card-compact")
    ).toBeNull();
    expect(
      (episodeSection as HTMLElement).querySelector(".performance-risk-analytical-table-compact")
    ).toBeTruthy();
    expect(screen.getByLabelText("Risk drawdown episode table")).toBeInTheDocument();
    expect(screen.queryByLabelText("Risk underwater series table")).not.toBeInTheDocument();
  });

  it("qualifies benchmark-relative interpretation when benchmark context is unavailable", () => {
    const viewModel = buildRiskViewModel({ benchmarkUnassigned: true });
    render(
      <RiskDrawdownPanel
        viewModel={viewModel}
        onViewUnderwater={() => {}}
      />
    );
    const headlineMetrics = screen.getByLabelText("Risk drawdown headline metrics");

    expect(screen.queryByLabelText("Drawdown business reading")).not.toBeInTheDocument();
    expect(within(headlineMetrics).getByText("N/A")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Drawdown methodology and coverage" }));

    const dialog = screen.getByRole("dialog", { name: "Drawdown methodology and coverage" });
    expect(within(dialog).getByText("Relative drawdown is not active for this selection.")).toBeInTheDocument();
  });

  it("renders a controlled interpretation block when no retained episodes exist", () => {
    const viewModel = buildRiskViewModel({ includeEpisodes: false });
    render(
      <RiskDrawdownPanel
        viewModel={viewModel}
        onViewUnderwater={() => {}}
      />
    );

    expect(screen.getByText("No retained drawdown episodes")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The portfolio did experience a loss path, but no episode met the retained episode policy for this window."
      )
    ).toBeInTheDocument();
    const episodeSection = screen.getByLabelText("Risk drawdown detail");
    expect(episodeSection).toHaveClass("performance-risk-detail-section-compact");
    expect(
      (episodeSection as HTMLElement).querySelector(".performance-risk-note-card-compact")
    ).toBeTruthy();
    expect(
      (episodeSection as HTMLElement).querySelector(".performance-risk-drawdown-empty-note")
    ).toBeTruthy();
    expect(screen.queryByLabelText("Risk drawdown episode table")).not.toBeInTheDocument();
    expect(screen.queryByText("No drawdown episodes to review")).not.toBeInTheDocument();
  });

  it("exposes underwater path as a drill-down action instead of inline expansion", () => {
    const viewModel = buildRiskViewModel();
    const onViewUnderwater = vi.fn();

    render(
      <RiskDrawdownPanel viewModel={viewModel} onViewUnderwater={onViewUnderwater} />
    );

    fireEvent.click(screen.getByRole("button", { name: "View underwater path" }));

    expect(onViewUnderwater).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Risk underwater series table")).not.toBeInTheDocument();
  });

  it("renders an explicit partial-state note when upstream drawdown detail is missing", () => {
    const scenario = buildSupportedPerformanceScenario();
    const viewModel = buildPerformanceRiskViewModel({
      workspace: scenario.workspace,
      period: "YTD",
      detailBasis: "NET",
      riskSummary: buildFixtureRiskSummary(scenario.workspace, "YTD", "NET"),
      riskDrawdown: buildUnavailableRiskDrawdown({
        workspace: scenario.workspace,
        period: "YTD",
        detailBasis: "NET",
        detail: "Risk drawdown fetch failed.",
        includeUnderwaterSeries: false,
      }),
    });

    render(<RiskDrawdownPanel viewModel={viewModel} onViewUnderwater={() => {}} />);

    expect(screen.getByText("Drawdown review is partially available")).toBeInTheDocument();
    expect(
      screen.getByText(/Headline measures remain available, but episode review should be treated as incomplete\./i)
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Risk drawdown episode table")).not.toBeInTheDocument();
  });
});
