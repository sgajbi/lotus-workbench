import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PerformanceContributionContextNote from "@/apps/performance/components/performance-contribution-context-note";
import type { ContributionSummaryView } from "@/features/workbench/types";

function buildContribution(
  overrides: Partial<ContributionSummaryView> = {},
): ContributionSummaryView {
  return {
    metric_basis: "NET",
    weighting_scheme: "AVERAGE_WEIGHT",
    portfolio_contribution_pct: 5.42,
    total_portfolio_return_pct: 5.42,
    coverage_mv_pct: 98.7,
    portfolio_local_contribution_pct: 4.8,
    portfolio_fx_contribution_pct: 0.62,
    position_rows: [],
    levels: [],
    smoothing_evidence: {
      status: "APPLIED",
      reason_codes: [
        "CARINO_FACTOR_APPLIED",
        "SMOOTHED_CONTRIBUTION_RECONCILES",
      ],
      raw_contribution_pct: 5.31,
      final_contribution_pct: 5.42,
      linked_return_pct: 5.42,
      smoothing_residual_pct: 0,
    },
    source_economics_evidence: {
      status: "SOURCE_LIMITED",
      component_detail_status: "LIMITED",
      reason_codes: [
        "LOTUS_CORE_ANALYTICS_INPUTS_USED",
        "COMPONENT_PNL_NOT_SOURCE_AUTHORED",
      ],
      source_contracts: [
        "PortfolioTimeseriesInput:v1",
        "PositionTimeseriesInput:v1",
      ],
      available_economics: [
        "portfolio_market_values",
        "position_market_values",
      ],
      unsupported_economics: ["income_pnl", "tax_pnl"],
      degraded_economics: [],
      source_snapshot_count: 2,
    },
    ...overrides,
  };
}

function buildSourceBackedEvidence(contribution: ContributionSummaryView) {
  return {
    ...contribution.source_economics_evidence!,
    status: "SOURCE_BACKED",
    component_detail_status: "COMPLETE",
    reason_codes: [
      "LOTUS_CORE_ANALYTICS_INPUTS_USED",
      "UPSTREAM_SNAPSHOT_LINEAGE_AVAILABLE",
    ],
    unsupported_economics: [],
    degraded_economics: [],
  };
}

function openCalculationEvidence() {
  fireEvent.click(screen.getByText("Calculation evidence"));
  return screen.getByLabelText("Contribution calculation evidence");
}

function expectEvidenceValue(
  evidence: HTMLElement,
  label: string,
  value: string,
) {
  const term = within(evidence).getByText(label);
  expect(term.nextElementSibling).toHaveTextContent(value);
}

describe("PerformanceContributionContextNote", () => {
  it("leads with a confirmed advisor posture and keeps exact source evidence secondary", () => {
    render(
      <PerformanceContributionContextNote
        contribution={buildContribution({
          coverage_mv_pct: 100,
          source_economics_evidence: {
            status: "SOURCE_BACKED",
            reason_codes: [
              "LOTUS_CORE_ANALYTICS_INPUTS_USED",
              "UPSTREAM_SNAPSHOT_LINEAGE_AVAILABLE",
            ],
            source_contracts: [
              "PortfolioTimeseriesInput:v1",
              "PositionTimeseriesInput:v1",
            ],
            available_economics: [
              "portfolio_market_values",
              "position_market_values",
            ],
            unsupported_economics: [],
            degraded_economics: [],
            source_snapshot_count: 2,
          },
        })}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "confirmed");
    expect(note).toHaveTextContent("Contribution coverage is confirmed");
    expect(note).toHaveTextContent("100.00% of market value covered");
    expect(note).toHaveTextContent("Reconciles to return");
    expect(
      screen.getByText("Calculation evidence").closest("details"),
    ).not.toHaveAttribute("open");

    const evidence = openCalculationEvidence();
    expect(within(evidence).getByText("SOURCE_BACKED")).toBeInTheDocument();
    expect(
      within(evidence).getByText("UPSTREAM_SNAPSHOT_LINEAGE_AVAILABLE", {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(
      within(evidence).getByText(
        "PortfolioTimeseriesInput:v1, PositionTimeseriesInput:v1",
      ),
    ).toBeInTheDocument();
  });

  it("translates source-limited economics into client-use guidance without hiding exact codes", () => {
    render(
      <PerformanceContributionContextNote contribution={buildContribution()} />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "limited");
    expect(note).toHaveTextContent("Contribution coverage is limited");
    expect(note).toHaveTextContent(
      "Review the stated exclusions before using the explanation with a client.",
    );
    expect(note).toHaveTextContent(
      "Not source-authored: income effects and tax effects.",
    );
    expect(note).toHaveTextContent("98.70% of market value covered");
    expect(note).toHaveTextContent("Average-weight basis");

    const evidence = openCalculationEvidence();
    expect(within(evidence).getByText("SOURCE_LIMITED")).toBeInTheDocument();
    expect(
      within(evidence).getByText(
        "LOTUS_CORE_ANALYTICS_INPUTS_USED, COMPONENT_PNL_NOT_SOURCE_AUTHORED",
      ),
    ).toBeInTheDocument();
    expect(
      within(evidence).getByText("income_pnl, tax_pnl"),
    ).toBeInTheDocument();
    expect(within(evidence).getByText("APPLIED")).toBeInTheDocument();
  });

  it("confirms source-backed contribution while disclosing limited optional component detail", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          source_economics_evidence: {
            ...contribution.source_economics_evidence!,
            status: "SOURCE_BACKED",
            component_detail_status: "LIMITED",
            reason_codes: [
              "LOTUS_CORE_ANALYTICS_INPUTS_USED",
              "UPSTREAM_SNAPSHOT_LINEAGE_AVAILABLE",
              "COMPONENT_PNL_NOT_SOURCE_AUTHORED",
            ],
          },
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "confirmed");
    expect(note).toHaveTextContent("Contribution calculation is supported");
    expect(note).toHaveTextContent("Not source-authored:");
    expectEvidenceValue(
      openCalculationEvidence(),
      "Component detail",
      "LIMITED",
    );
  });

  it.each(["unknown_economics", "fx_contribution"])(
    "rejects source-backed component detail with an unsupported limitation mapping: %s",
    (unsupportedEconomic) => {
      const contribution = buildContribution();
      render(
        <PerformanceContributionContextNote
          contribution={{
            ...contribution,
            source_economics_evidence: {
              ...contribution.source_economics_evidence!,
              status: "SOURCE_BACKED",
              component_detail_status: "LIMITED",
              reason_codes: [
                "LOTUS_CORE_ANALYTICS_INPUTS_USED",
                "UPSTREAM_SNAPSHOT_LINEAGE_AVAILABLE",
                "COMPONENT_PNL_NOT_SOURCE_AUTHORED",
              ],
              unsupported_economics: [unsupportedEconomic],
            },
          }}
        />,
      );

      const note = screen.getByTestId("performance-contribution-evidence");
      expect(note).toHaveAttribute("data-tone", "review");
      expect(note).toHaveTextContent("Contribution evidence is inconsistent");
    },
  );

  it("rejects source-limited evidence when declared limitations have no reason evidence", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          source_economics_evidence: {
            ...contribution.source_economics_evidence!,
            reason_codes: [],
          },
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution evidence is inconsistent");
    expect(note).not.toHaveTextContent("Contribution coverage is limited");
  });

  it("rejects source-limited component exclusions reported as complete detail", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          source_economics_evidence: {
            ...contribution.source_economics_evidence!,
            component_detail_status: "COMPLETE",
          },
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution evidence is inconsistent");
  });

  it("allows complete component detail with an unrelated currency-contribution exclusion", () => {
    const contribution = buildContribution({
      source_economics_evidence: {
        status: "SOURCE_LIMITED",
        component_detail_status: "COMPLETE",
        reason_codes: ["LOTUS_CORE_ANALYTICS_INPUTS_USED", "MISSING_FX"],
        source_contracts: [
          "PortfolioTimeseriesInput:v1",
          "PositionTimeseriesInput:v1",
        ],
        available_economics: ["local_contribution"],
        unsupported_economics: ["fx_contribution"],
        degraded_economics: [],
        source_snapshot_count: 2,
      },
    });
    render(<PerformanceContributionContextNote contribution={contribution} />);

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "limited");
    expect(note).toHaveTextContent("Contribution coverage is limited");
  });

  it("rejects degraded component availability reported as complete detail", () => {
    const contribution = buildContribution({
      source_economics_evidence: {
        status: "SOURCE_LIMITED",
        component_detail_status: "COMPLETE",
        reason_codes: [
          "LOTUS_CORE_ANALYTICS_INPUTS_USED",
          "PERFORMANCE_COMPONENT_ECONOMICS_UNAVAILABLE",
        ],
        source_contracts: [
          "PortfolioTimeseriesInput:v1",
          "PositionTimeseriesInput:v1",
        ],
        available_economics: [
          "portfolio_market_values",
          "position_market_values",
        ],
        unsupported_economics: [],
        degraded_economics: ["performance_component_economics_unavailable"],
        source_snapshot_count: 2,
      },
    });
    render(<PerformanceContributionContextNote contribution={contribution} />);

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution evidence is inconsistent");
  });

  it("does not confirm source-backed evidence when market-value coverage is absent", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          coverage_mv_pct: null,
          source_economics_evidence: buildSourceBackedEvidence(contribution),
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution coverage cannot be confirmed");
    expect(note).toHaveTextContent("Market-value coverage not published");
  });

  it("keeps source-backed evidence limited below high market-value coverage", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          coverage_mv_pct: 82.5,
          source_economics_evidence: buildSourceBackedEvidence(contribution),
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "limited");
    expect(note).toHaveTextContent(
      "Contribution market-value coverage is limited",
    );
    expect(note).toHaveTextContent("82.50% of market value covered");
    expect(note).not.toHaveTextContent("Contribution coverage is confirmed");
  });

  it("does not round sub-threshold market-value coverage into the confirmed range", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          coverage_mv_pct: 94.999,
          source_economics_evidence: buildSourceBackedEvidence(contribution),
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "limited");
    expect(note).toHaveTextContent("<95.00% of market value covered");
    expectEvidenceValue(
      openCalculationEvidence(),
      "Market-value coverage",
      "94.999%",
    );
  });

  it("keeps source-limited evidence review-only when market-value coverage is absent", () => {
    render(
      <PerformanceContributionContextNote
        contribution={buildContribution({ coverage_mv_pct: null })}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution coverage cannot be confirmed");
    expect(note).toHaveTextContent("Market-value coverage not published");
  });

  it("keeps invalid source-limited market-value coverage out of client-use guidance", () => {
    render(
      <PerformanceContributionContextNote
        contribution={buildContribution({ coverage_mv_pct: 108 })}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution coverage cannot be confirmed");
    expect(note).toHaveTextContent("Market-value coverage needs review");
    expect(note).not.toHaveTextContent("108.00% of market value covered");
  });

  it("fails closed when a future reason code is not recognized and preserves it verbatim", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          source_economics_evidence: {
            ...contribution.source_economics_evidence!,
            reason_codes: ["FUTURE_SOURCE_EVIDENCE_CODE"],
          },
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution evidence needs review");
    expect(note).toHaveTextContent(
      "Some published evidence is not recognized by this Workbench version.",
    );

    expect(
      within(openCalculationEvidence()).getByText(
        "FUTURE_SOURCE_EVIDENCE_CODE",
      ),
    ).toBeInTheDocument();
  });

  it("fails closed and exposes an empty source reason-code entry", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          source_economics_evidence: {
            ...buildSourceBackedEvidence(contribution),
            reason_codes: [
              "LOTUS_CORE_ANALYTICS_INPUTS_USED",
              "UPSTREAM_SNAPSHOT_LINEAGE_AVAILABLE",
              "",
            ],
          },
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution evidence needs review");
    expect(note).not.toHaveTextContent("Contribution coverage is confirmed");
    expectEvidenceValue(
      openCalculationEvidence(),
      "Source reason codes",
      "LOTUS_CORE_ANALYTICS_INPUTS_USED, UPSTREAM_SNAPSHOT_LINEAGE_AVAILABLE, [empty value]",
    );
  });

  it("rejects a noncanonical source-status spelling instead of silently promoting it", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          source_economics_evidence: {
            ...buildSourceBackedEvidence(contribution),
            status: "source_backed",
          },
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution evidence needs review");
    expect(note).not.toHaveTextContent("Contribution coverage is confirmed");
    expectEvidenceValue(
      openCalculationEvidence(),
      "Source status",
      "source_backed",
    );
  });

  it("rejects padded smoothing status evidence instead of silently canonicalizing it", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          smoothing_evidence: {
            ...contribution.smoothing_evidence!,
            status: " APPLIED ",
          },
          source_economics_evidence: buildSourceBackedEvidence(contribution),
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution evidence needs review");
    expect(note).not.toHaveTextContent("Contribution coverage is confirmed");
    expectEvidenceValue(
      openCalculationEvidence(),
      "Smoothing status",
      "[padded value] APPLIED",
    );
  });

  it("keeps an empty source status explicit while treating the evidence as incomplete", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          source_economics_evidence: {
            ...buildSourceBackedEvidence(contribution),
            status: "",
          },
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent(
      "Contribution calculation evidence is incomplete",
    );
    expectEvidenceValue(
      openCalculationEvidence(),
      "Source status",
      "[empty value]",
    );
  });

  it("rejects a limitation reason that does not explain the declared unsupported economics", () => {
    const contribution = buildContribution({
      source_economics_evidence: {
        status: "SOURCE_LIMITED",
        reason_codes: ["LOTUS_CORE_ANALYTICS_INPUTS_USED", "MISSING_FX"],
        source_contracts: [
          "PortfolioTimeseriesInput:v1",
          "PositionTimeseriesInput:v1",
        ],
        available_economics: [
          "portfolio_market_values",
          "position_market_values",
        ],
        unsupported_economics: ["income_pnl"],
        degraded_economics: [],
        source_snapshot_count: 2,
      },
    });
    render(<PerformanceContributionContextNote contribution={contribution} />);

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution evidence is inconsistent");
    expect(note).not.toHaveTextContent("Contribution coverage is limited");
  });

  it("accepts the matching currency limitation reason for unavailable currency contribution", () => {
    const contribution = buildContribution({
      source_economics_evidence: {
        status: "SOURCE_LIMITED",
        reason_codes: ["LOTUS_CORE_ANALYTICS_INPUTS_USED", "MISSING_FX"],
        source_contracts: [
          "PortfolioTimeseriesInput:v1",
          "PositionTimeseriesInput:v1",
        ],
        available_economics: ["local_contribution"],
        unsupported_economics: ["fx_contribution"],
        degraded_economics: [],
        source_snapshot_count: 2,
      },
    });
    render(<PerformanceContributionContextNote contribution={contribution} />);

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "limited");
    expect(note).toHaveTextContent("Contribution coverage is limited");
    expect(note).toHaveTextContent(
      "Not source-authored: currency contribution.",
    );
  });

  it("rejects economics declared as both available and unsupported", () => {
    const contribution = buildContribution({
      source_economics_evidence: {
        status: "SOURCE_LIMITED",
        reason_codes: ["LOTUS_CORE_ANALYTICS_INPUTS_USED", "MISSING_FX"],
        source_contracts: [
          "PortfolioTimeseriesInput:v1",
          "PositionTimeseriesInput:v1",
        ],
        available_economics: ["local_contribution", "fx_contribution"],
        unsupported_economics: ["fx_contribution"],
        degraded_economics: [],
        source_snapshot_count: 2,
      },
    });
    render(<PerformanceContributionContextNote contribution={contribution} />);

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution evidence is inconsistent");
    expect(note).not.toHaveTextContent("Contribution coverage is limited");
  });

  it.each([
    [
      "local_contribution",
      {
        portfolio_local_contribution_pct: null,
        portfolio_fx_contribution_pct: 0.62,
      },
    ],
    [
      "fx_contribution",
      {
        portfolio_local_contribution_pct: 4.8,
        portfolio_fx_contribution_pct: null,
      },
    ],
  ] as const)(
    "rejects %s availability when no corresponding value is published",
    (availableEconomics, contributionTotals) => {
      const contribution = buildContribution({
        ...contributionTotals,
        coverage_mv_pct: 100,
        position_rows: [
          {
            position_id: "POS-1",
            contribution_pct: 1,
            weight_avg_pct: 20,
            total_return_pct: 5,
            local_contribution_pct: null,
            fx_contribution_pct: null,
          },
        ],
        levels: [
          {
            level: 1,
            name: "Asset class",
            rows: [
              {
                key_label: "Equity",
                contribution_pct: 1,
                weight_avg_pct: 20,
                total_return_pct: 5,
                local_contribution_pct: null,
                fx_contribution_pct: null,
                is_other: false,
              },
            ],
            total_contribution_pct: 1,
          },
        ],
        source_economics_evidence: {
          ...buildSourceBackedEvidence(buildContribution()),
          available_economics: [availableEconomics],
        },
      });
      render(
        <PerformanceContributionContextNote contribution={contribution} />,
      );

      const note = screen.getByTestId("performance-contribution-evidence");
      expect(note).toHaveAttribute("data-tone", "review");
      expect(note).toHaveTextContent("Contribution evidence is inconsistent");
      expect(note).not.toHaveTextContent("Contribution coverage is confirmed");
    },
  );

  it("accepts declared local contribution when a corresponding level value is published", () => {
    const contribution = buildContribution({
      coverage_mv_pct: 100,
      portfolio_local_contribution_pct: null,
      levels: [
        {
          level: 1,
          name: "Asset class",
          rows: [
            {
              key_label: "Equity",
              contribution_pct: 4.8,
              weight_avg_pct: 80,
              total_return_pct: 6,
              local_contribution_pct: 4.8,
              fx_contribution_pct: null,
              is_other: false,
            },
          ],
          total_contribution_pct: 4.8,
        },
      ],
      source_economics_evidence: {
        ...buildSourceBackedEvidence(buildContribution()),
        available_economics: ["local_contribution"],
      },
    });
    render(<PerformanceContributionContextNote contribution={contribution} />);

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "confirmed");
    expect(note).toHaveTextContent("Contribution coverage is confirmed");
  });

  it("rejects execution-only lineage as fully source-backed evidence", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          source_economics_evidence: {
            ...buildSourceBackedEvidence(contribution),
            reason_codes: [
              "LOTUS_CORE_ANALYTICS_INPUTS_USED",
              "UPSTREAM_SNAPSHOT_LINEAGE_AVAILABLE_VIA_EXECUTION_ONLY",
            ],
          },
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution evidence is inconsistent");
    expect(note).not.toHaveTextContent("Contribution coverage is confirmed");
  });

  it("accepts execution-only lineage only with its source-limited degradation", () => {
    const contribution = buildContribution({
      source_economics_evidence: {
        status: "SOURCE_LIMITED",
        reason_codes: [
          "LOTUS_CORE_ANALYTICS_INPUTS_USED",
          "UPSTREAM_SNAPSHOT_LINEAGE_AVAILABLE_VIA_EXECUTION_ONLY",
        ],
        source_contracts: [
          "PortfolioTimeseriesInput:v1",
          "PositionTimeseriesInput:v1",
        ],
        available_economics: [
          "portfolio_market_values",
          "position_market_values",
        ],
        unsupported_economics: [],
        degraded_economics: ["upstream_snapshot_lineage_not_embedded"],
        source_snapshot_count: 0,
      },
    });
    render(<PerformanceContributionContextNote contribution={contribution} />);

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "limited");
    expect(note).toHaveTextContent("Contribution coverage is limited");
    expect(note).toHaveTextContent(
      "Source lineage is available through the calculation execution record.",
    );
  });

  it("prioritizes caller-supplied provenance review over a smoothing limitation", () => {
    const contribution = buildContribution({
      smoothing_evidence: {
        status: "INVALID_DOMAIN_FALLBACK",
        reason_codes: ["CARINO_INVALID_DAILY_LOG_DOMAIN"],
        raw_contribution_pct: 5.31,
        final_contribution_pct: 5.42,
        linked_return_pct: 5.42,
        smoothing_residual_pct: 0,
      },
      source_economics_evidence: {
        status: "CALLER_SUPPLIED",
        reason_codes: ["STATELESS_CALLER_SUPPLIED_SOURCE_ECONOMICS"],
        source_contracts: [],
        available_economics: [],
        unsupported_economics: [],
        degraded_economics: [],
        source_snapshot_count: 0,
      },
    });
    render(<PerformanceContributionContextNote contribution={contribution} />);

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution inputs need confirmation");
    expect(note).not.toHaveTextContent(
      "Contribution evidence has a methodology limitation",
    );
  });

  it("rejects a source-backed status that carries a limiting source reason", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          source_economics_evidence: {
            ...contribution.source_economics_evidence!,
            status: "SOURCE_BACKED",
            reason_codes: [
              "LOTUS_CORE_ANALYTICS_INPUTS_USED",
              "UPSTREAM_SNAPSHOT_LINEAGE_AVAILABLE",
              "MISSING_FX",
            ],
            unsupported_economics: [],
          },
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution evidence is inconsistent");
    expect(note).toHaveTextContent("Currency source economics are incomplete");
    expect(note).not.toHaveTextContent("Contribution coverage is confirmed");
  });

  it("requires source-backed lineage evidence before confirming coverage", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          source_economics_evidence: {
            ...contribution.source_economics_evidence!,
            status: "SOURCE_BACKED",
            reason_codes: [],
            unsupported_economics: [],
          },
        }}
      />,
    );

    expect(
      screen.getByTestId("performance-contribution-evidence"),
    ).toHaveTextContent("Contribution evidence is inconsistent");
  });

  it("requires source-backed lineage to agree with a positive snapshot count", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          source_economics_evidence: {
            ...buildSourceBackedEvidence(contribution),
            source_snapshot_count: 0,
          },
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution evidence is inconsistent");
    expect(note).not.toHaveTextContent("Contribution coverage is confirmed");
  });

  it("requires source-backed evidence to identify contracts and available economics", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          source_economics_evidence: {
            ...buildSourceBackedEvidence(contribution),
            source_contracts: [],
            available_economics: [],
          },
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution evidence is inconsistent");
    expect(note).not.toHaveTextContent("Contribution coverage is confirmed");
  });

  it("rejects smoothing reason codes that contradict the published smoothing status", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          smoothing_evidence: {
            ...contribution.smoothing_evidence!,
            status: "APPLIED",
            reason_codes: ["CARINO_INVALID_DAILY_LOG_DOMAIN"],
          },
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution evidence is inconsistent");
    expect(note).not.toHaveTextContent("Contribution coverage is confirmed");
  });

  it("rejects source-backed evidence when final contribution does not reconcile to return", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          smoothing_evidence: {
            ...contribution.smoothing_evidence!,
            final_contribution_pct: 4.91,
          },
          source_economics_evidence: buildSourceBackedEvidence(contribution),
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution reconciliation needs review");
    expect(note).not.toHaveTextContent("Contribution coverage is confirmed");
    const decision = screen.getByText(
      "Contribution reconciliation needs review",
    ).parentElement;
    expect(decision).toHaveTextContent("Calculation values do not reconcile");
    expect(decision).not.toHaveTextContent("Reconciles to return");

    const evidence = openCalculationEvidence();
    expectEvidenceValue(evidence, "Raw contribution", "5.31%");
    expectEvidenceValue(evidence, "Final contribution", "4.91%");
    expectEvidenceValue(evidence, "Linked return", "5.42%");
    expectEvidenceValue(evidence, "Smoothing residual", "0%");
  });

  it("rejects source-backed evidence when required reconciliation amounts are absent", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          smoothing_evidence: {
            ...contribution.smoothing_evidence!,
            final_contribution_pct: null,
          },
          source_economics_evidence: buildSourceBackedEvidence(contribution),
        }}
      />,
    );

    expect(
      screen.getByTestId("performance-contribution-evidence"),
    ).toHaveTextContent("Contribution reconciliation needs review");
    expectEvidenceValue(
      openCalculationEvidence(),
      "Final contribution",
      "Not published",
    );
  });

  it("rejects a changed raw contribution when smoothing was not requested", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          smoothing_evidence: {
            ...contribution.smoothing_evidence!,
            status: "NOT_REQUESTED",
            reason_codes: ["SMOOTHING_NOT_REQUESTED"],
            raw_contribution_pct: 4,
          },
          source_economics_evidence: buildSourceBackedEvidence(contribution),
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution reconciliation needs review");
    expectEvidenceValue(openCalculationEvidence(), "Raw contribution", "4%");
  });

  it("rejects residual reason codes when smoothing was not requested", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          smoothing_evidence: {
            ...contribution.smoothing_evidence!,
            status: "NOT_REQUESTED",
            reason_codes: [
              "SMOOTHING_NOT_REQUESTED",
              "RAW_CONTRIBUTION_DIFFERS_FROM_LINKED_RETURN",
            ],
            raw_contribution_pct: 5.42,
          },
          source_economics_evidence: buildSourceBackedEvidence(contribution),
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution evidence is inconsistent");
    expect(note).not.toHaveTextContent("Contribution coverage is confirmed");
  });

  it("rejects source-backed evidence with a material published smoothing residual", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          smoothing_evidence: {
            ...contribution.smoothing_evidence!,
            smoothing_residual_pct: 0.25,
          },
          source_economics_evidence: buildSourceBackedEvidence(contribution),
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution reconciliation needs review");
    expect(note).not.toHaveTextContent("Contribution coverage is confirmed");
    expectEvidenceValue(
      openCalculationEvidence(),
      "Smoothing residual",
      "0.25%",
    );
  });

  it("rejects source-backed evidence when the top-level contribution has a material return gap", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          portfolio_contribution_pct: 5.1,
          source_economics_evidence: buildSourceBackedEvidence(contribution),
        }}
      />,
    );

    expect(
      screen.getByTestId("performance-contribution-evidence"),
    ).toHaveTextContent("Contribution reconciliation needs review");
    const evidence = openCalculationEvidence();
    expectEvidenceValue(evidence, "Portfolio contribution", "5.1%");
    expectEvidenceValue(evidence, "Portfolio TWR", "5.42%");
  });

  it("keeps missing evidence explicit instead of implying source completeness", () => {
    render(
      <PerformanceContributionContextNote
        contribution={buildContribution({
          smoothing_evidence: null,
          source_economics_evidence: null,
        })}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution coverage cannot be confirmed");
    expect(note).toHaveTextContent(
      "Lotus did not receive governed portfolio evidence",
    );

    const evidence = openCalculationEvidence();
    expect(
      within(evidence).getAllByText("Not published").length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      within(evidence).getAllByText("None published").length,
    ).toBeGreaterThanOrEqual(4);
  });

  it("does not confirm client use when source evidence exists without smoothing evidence", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          smoothing_evidence: null,
          source_economics_evidence: buildSourceBackedEvidence(contribution),
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent(
      "Contribution calculation evidence is incomplete",
    );
    expect(note).not.toHaveTextContent("Contribution coverage is confirmed");
    expectEvidenceValue(
      openCalculationEvidence(),
      "Smoothing status",
      "Not published",
    );
  });

  it("preserves an unfamiliar weighting basis in calculation evidence", () => {
    render(
      <PerformanceContributionContextNote
        contribution={buildContribution({
          weighting_scheme: "FUTURE_WEIGHTING_BASIS",
        })}
      />,
    );

    expect(
      screen.getByTestId("performance-contribution-evidence"),
    ).toHaveTextContent("Weighting basis published in calculation evidence");
    expect(
      within(openCalculationEvidence()).getByText("FUTURE_WEIGHTING_BASIS"),
    ).toBeInTheDocument();
  });

  it("promotes a source-confirmed smoothing fallback into the advisor limitation", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          smoothing_evidence: {
            ...contribution.smoothing_evidence!,
            status: "INVALID_DOMAIN_FALLBACK",
            reason_codes: ["CARINO_INVALID_DAILY_LOG_DOMAIN"],
          },
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "limited");
    expect(note).toHaveTextContent(
      "Contribution evidence has a methodology limitation",
    );
    expect(note).toHaveTextContent(
      "standard multi-period smoothing method could not be applied",
    );

    const evidence = openCalculationEvidence();
    expect(
      within(evidence).getByText("INVALID_DOMAIN_FALLBACK"),
    ).toBeInTheDocument();
    expect(
      within(evidence).getByText("CARINO_INVALID_DAILY_LOG_DOMAIN"),
    ).toBeInTheDocument();
  });

  it("rejects smoothing fallback guidance when its numeric evidence is incomplete", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          smoothing_evidence: {
            ...contribution.smoothing_evidence!,
            status: "INVALID_DOMAIN_FALLBACK",
            reason_codes: ["CARINO_INVALID_DAILY_LOG_DOMAIN"],
            final_contribution_pct: null,
          },
          source_economics_evidence: buildSourceBackedEvidence(contribution),
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution reconciliation needs review");
    expect(note).not.toHaveTextContent(
      "Contribution evidence has a methodology limitation",
    );
    expectEvidenceValue(
      openCalculationEvidence(),
      "Final contribution",
      "Not published",
    );
  });

  it("rejects source-limited evidence with neither snapshots nor execution-only lineage", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          source_economics_evidence: {
            ...contribution.source_economics_evidence!,
            source_snapshot_count: 0,
          },
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution evidence is inconsistent");
    expect(note).not.toHaveTextContent("Contribution coverage is limited");
  });

  it("rejects a no-contribution-rows status when ranked rows are present", () => {
    const contribution = buildContribution();
    render(
      <PerformanceContributionContextNote
        contribution={{
          ...contribution,
          position_rows: [
            {
              position_id: "POSITION_1",
              contribution_pct: 1.2,
              weight_avg_pct: 20,
              total_return_pct: 6,
              local_contribution_pct: 1,
              fx_contribution_pct: 0.2,
            },
          ],
          smoothing_evidence: {
            ...contribution.smoothing_evidence!,
            status: "NO_CONTRIBUTION_ROWS",
            reason_codes: ["NO_CONTRIBUTION_ROWS"],
          },
          source_economics_evidence: buildSourceBackedEvidence(contribution),
        }}
      />,
    );

    const note = screen.getByTestId("performance-contribution-evidence");
    expect(note).toHaveAttribute("data-tone", "review");
    expect(note).toHaveTextContent("Contribution evidence is inconsistent");
    expect(note).not.toHaveTextContent(
      "Contribution observations are unavailable",
    );
  });
});
