import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PerformanceSummaryContributorsSection from "../../src/apps/performance/components/performance-summary-contributors-section";
import type { PerformanceSummaryContributorsSectionProps } from "../../src/apps/performance/components/performance-workspace-types";
import {
  buildAggregateContributionPerformanceScenario,
  buildPerformanceCapabilities,
  buildSupportedPerformanceScenario,
} from "../fixtures/performance-workspace-fixtures";

const supportedCapabilities = buildPerformanceCapabilities();

function buildProps(
  overrides: Partial<PerformanceSummaryContributorsSectionProps> = {}
): PerformanceSummaryContributorsSectionProps {
  const workspace = buildSupportedPerformanceScenario().workspace;
  return {
    workspace,
    capabilities: supportedCapabilities,
    contributorScale: 1.5,
    positivePositionContributors: [
      {
        position_id: "AAPL",
        contribution_pct: 1.5,
        weight_avg_pct: 24,
        total_return_pct: 8,
        local_contribution_pct: 1.1,
        fx_contribution_pct: 0.4,
      },
    ],
    negativePositionContributors: [
      {
        position_id: "TLT",
        contribution_pct: -0.2,
        weight_avg_pct: 8,
        total_return_pct: -2,
        local_contribution_pct: -0.2,
        fx_contribution_pct: 0,
      },
    ],
    topContributors: [
      {
        key_label: "Equity",
        contribution_pct: 3.8,
        weight_avg_pct: 61,
        total_return_pct: 7.4,
        local_contribution_pct: 3.4,
        fx_contribution_pct: 0.4,
        is_other: false,
      },
    ],
    bottomContributors: [
      {
        key_label: "Rates",
        contribution_pct: -0.6,
        weight_avg_pct: 18,
        total_return_pct: -1.9,
        local_contribution_pct: -0.5,
        fx_contribution_pct: -0.1,
        is_other: false,
      },
    ],
    isDetailsPending: false,
    ...overrides,
  };
}

describe("PerformanceSummaryContributorsSection", () => {
  it("renders positive and negative ranked contributors when position ranking exists", () => {
    render(<PerformanceSummaryContributorsSection {...buildProps()} />);

    expect(screen.getByText("Performance Drivers")).toBeInTheDocument();
    expect(screen.getByText("YTD Contribution Ranking")).toBeInTheDocument();
    expect(document.querySelector(".performance-summary-driver-module.workbench-chart-shell")).toBeTruthy();
    expect(screen.getByTestId("performance-contributor-groups")).toHaveAttribute(
      "data-layout",
      "balanced",
    );
    expect(screen.getByTestId("performance-contributor-group-contributors")).toHaveAttribute(
      "data-group-state",
      "populated",
    );
    expect(screen.getByTestId("performance-contributor-group-detractors")).toHaveAttribute(
      "data-group-state",
      "populated",
    );
    expect(screen.getByLabelText("Top Contributors impact bars")).toHaveTextContent("AAPL");
    expect(screen.getByLabelText("Top Detractors impact bars")).toHaveTextContent("TLT");
    expect(screen.queryAllByText("Contribution to active return")).toHaveLength(0);
    expect(screen.getByText("Instrument detail")).toBeInTheDocument();
    expect(screen.queryByText(/positions/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText("Open the full instrument-level contribution breakdown in one ranked table.")
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Contributor driver strip")).not.toBeInTheDocument();
    const contributionEvidenceNote = screen.getByRole("note");
    expect(contributionEvidenceNote).toHaveTextContent("Contribution coverage is limited");
    expect(contributionEvidenceNote).toHaveTextContent(
      "Not source-authored: income effects and tax effects."
    );
    fireEvent.click(within(contributionEvidenceNote).getByText("Calculation evidence"));
    const calculationEvidence = within(contributionEvidenceNote).getByLabelText(
      "Contribution calculation evidence"
    );
    expect(within(calculationEvidence).getByText("SOURCE_LIMITED")).toBeInTheDocument();
    expect(within(calculationEvidence).getByText("LIMITED")).toBeInTheDocument();
    expect(within(calculationEvidence).getByText("APPLIED")).toBeInTheDocument();
    expect(within(calculationEvidence).getByText(
      "LOTUS_CORE_ANALYTICS_INPUTS_USED, COMPONENT_PNL_NOT_SOURCE_AUTHORED, UNSUPPORTED_SOURCE_CASH_FLOW_TYPES_PRESENT"
    )).toBeInTheDocument();
    expect(screen.queryByText("Avg. Weight 24.00%")).not.toBeInTheDocument();
    expect(screen.queryByText("Avg. Weight 8.00%")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Instrument detail"));

    const contributorsTable = screen.getByLabelText("Contributor instrument detail table");
    expect(contributorsTable).toBeInTheDocument();
    expect(
      contributorsTable.closest(".performance-contributors-table.analytics-table-variant-observation")
    ).toBeTruthy();
    expect(within(contributorsTable).getByText("Direction")).toBeInTheDocument();
    expect(within(contributorsTable).getByText("Instrument")).toBeInTheDocument();
    expect(within(contributorsTable).getByText("Contribution")).toBeInTheDocument();
    expect(within(contributorsTable).getByText("Weight")).toBeInTheDocument();
    expect(within(contributorsTable).getByText("Return")).toBeInTheDocument();
    expect(within(contributorsTable).getByText("Contributor")).toBeInTheDocument();
    expect(within(contributorsTable).getByText("Detractor")).toBeInTheDocument();
    expect(within(contributorsTable).getByText("AAPL")).toBeInTheDocument();
    expect(within(contributorsTable).getByText("TLT")).toBeInTheDocument();
    expect(within(contributorsTable).getByText("1.50%")).toBeInTheDocument();
    expect(within(contributorsTable).getByText("24.00%")).toBeInTheDocument();
    expect(within(contributorsTable).getAllByText("8.00%")).toHaveLength(2);
    expect(within(contributorsTable).getByText("-0.20%")).toBeInTheDocument();
    expect(within(contributorsTable).getByText("-2.00%")).toBeInTheDocument();
  });

  it("rebalances the ranked contributor grid when only contributors are populated", () => {
    render(
      <PerformanceSummaryContributorsSection
        {...buildProps({
          negativePositionContributors: [],
        })}
      />
    );

    const groups = screen.getByTestId("performance-contributor-groups");
    const contributors = screen.getByTestId("performance-contributor-group-contributors");
    const detractors = screen.getByTestId("performance-contributor-group-detractors");
    expect(groups).toHaveAttribute("data-layout", "asymmetric");
    expect(contributors).toHaveAttribute("data-group-state", "populated");
    expect(detractors).toHaveAttribute("data-group-state", "empty");
    expect(groups.children[0]).toBe(contributors);
    expect(groups.children[1]).toBe(detractors);
    expect(screen.getByText("No detracting positions are exposed for the selected period.")).toBeInTheDocument();
    expect(groups.parentElement?.querySelector(".performance-contributors-table-disclosure")).toBeTruthy();
  });

  it("renders a useful fallback when contribution detail is unavailable", () => {
    render(
      <PerformanceSummaryContributorsSection
        {...buildProps({
          capabilities: {
            ...supportedCapabilities,
            contributionRanking: {
              state: "unavailable",
              reason: "Contributor ranking is not available for the current selection.",
            },
          },
          positivePositionContributors: [],
          negativePositionContributors: [],
        })}
      />
    );

    expect(screen.getByText("Contributor ranking unavailable")).toBeInTheDocument();
    expect(screen.getByText("Contributor ranking is not available for the current selection.")).toBeInTheDocument();
    expect(screen.getByLabelText("Contributor ranking unavailable state")).toBeInTheDocument();
    expect(screen.queryByText("Still available")).not.toBeInTheDocument();
    expect(screen.queryByText("Needs source support")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Aggregate contributor summary")).not.toBeInTheDocument();
  });

  it("renders contributor and detractor cards from aggregate rows when only aggregate contributor support exists", () => {
    const scenario = buildAggregateContributionPerformanceScenario();

    render(
      <PerformanceSummaryContributorsSection
        {...buildProps({
          capabilities: scenario.capabilities,
          positivePositionContributors: [],
          negativePositionContributors: [],
          topContributors: scenario.workspace.contribution?.levels?.[0]?.rows ?? [],
          bottomContributors: [],
        })}
      />
    );

    expect(screen.getByLabelText("Top Contributors impact bars")).toHaveTextContent("Equity");
    expect(screen.getByLabelText("Top Detractors impact bars")).toHaveTextContent(
      "No detracting segment contributors are exposed for the selected period."
    );
    expect(screen.getByText("Segment detail")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Segment detail"));
    const aggregateTable = screen.getByLabelText("Contributor instrument detail table");
    expect(aggregateTable).toBeInTheDocument();
    expect(within(aggregateTable).getByText("Equity")).toBeInTheDocument();
    expect(within(aggregateTable).getByText("Contribution")).toBeInTheDocument();
    expect(screen.queryByText("AAPL")).not.toBeInTheDocument();
  });

  it("renders a structured loading state while contributor details are still resolving", () => {
    render(
      <PerformanceSummaryContributorsSection
        {...buildProps({
          isDetailsPending: true,
          capabilities: {
            ...supportedCapabilities,
            contributionRanking: {
              state: "unavailable",
              reason: "Contribution ranking is still loading.",
            },
          },
          positivePositionContributors: [],
          negativePositionContributors: [],
          topContributors: [],
          bottomContributors: [],
        })}
      />
    );

    const loadingState = screen.getByRole("status");
    expect(loadingState).toHaveTextContent("Loading performance drivers");
    expect(loadingState).toHaveTextContent("Loading contribution ranking.");
  });
});
