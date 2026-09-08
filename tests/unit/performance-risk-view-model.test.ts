import { describe, expect, it } from "vitest";

import {
  buildFixtureRiskAttribution,
  buildFixtureRiskConcentration,
  buildFixtureRiskDrawdown,
  buildFixtureRiskRolling,
  buildFixtureRiskSummary,
  buildPerformanceRiskViewModel,
} from "../../src/apps/performance/risk-workspace-view-model";
import type { WorkbenchRiskAttributionResponse } from "../../src/features/workbench/types";
import { buildBenchmarkUnassignedPerformanceScenario, buildSupportedPerformanceScenario } from "../fixtures/performance-workspace-fixtures";

describe("buildPerformanceRiskViewModel", () => {
  it("builds a stateful contract-shaped risk view model with supportability evidence", () => {
    const scenario = buildSupportedPerformanceScenario();

    const viewModel = buildPerformanceRiskViewModel({
      workspace: scenario.workspace,
      period: "YTD",
      detailBasis: "NET",
      riskSummary: buildFixtureRiskSummary(scenario.workspace, "YTD", "NET"),
      riskConcentration: buildFixtureRiskConcentration(scenario.workspace, "YTD"),
      riskAttribution: buildFixtureRiskAttribution(scenario.workspace, "YTD", "NET"),
      riskDrawdown: buildFixtureRiskDrawdown(scenario.workspace, "YTD", "NET"),
      riskRolling: buildFixtureRiskRolling(scenario.workspace, "YTD", "NET"),
    });

    expect(viewModel.state).toBe("partial");
    expect(viewModel.title).toBe("Risk");
    expect(viewModel.workspaceOverview).toEqual([
      expect.objectContaining({
        label: "Realised volatility",
        value: "7.25%",
        support: "YTD annualised source measure",
        tone: "default",
      }),
      expect.objectContaining({
        label: "Max drawdown",
        value: "-12.45%",
        support: "Still below the prior peak at period end",
        tone: "default",
      }),
      expect.objectContaining({
        label: "Largest position",
        value: "18.40%",
        support: "PIMCO GIS Income Fund",
        tone: "default",
      }),
      expect.objectContaining({ label: "Source coverage", value: "Partial" }),
    ]);
    expect(viewModel.snapshotHeadlineMetrics.map((metric) => metric.label)).toEqual([
      "Volatility",
      "Sharpe",
      "Beta",
      "Tracking error",
    ]);
    expect(viewModel.snapshotSupportingMetrics.map((metric) => metric.label)).toEqual([
      "Information ratio",
      "Sortino",
      "Value at risk",
    ]);
    expect(viewModel.snapshotContextRows[0]).toMatchObject({
      label: "Portfolio observations",
    });
    expect(viewModel.concentrationIndicators.map((metric) => metric.label)).toEqual([
      "Portfolio concentration index",
      "Issuer concentration index",
      "Largest position weight",
      "Largest issuer weight",
      "Top 10 weight",
    ]);
    expect(viewModel.concentrationIndicators).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Largest position weight", tone: "neutral" }),
        expect.objectContaining({ label: "Largest issuer weight", tone: "warn" }),
        expect.objectContaining({ label: "Top 10 weight", tone: "neutral" }),
      ]),
    );
    expect(JSON.stringify(viewModel.workspaceOverview)).not.toMatch(
      /Contained|Moderate|Elevated|High|Severe|Acceptable|Diversified/,
    );
    expect(viewModel.concentrationContextRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Top position methodology",
          value: "TOP_POSITION_WEIGHT",
          support:
            "Gateway and Workbench render returned top-position weights and drivers without recalculating them.",
        }),
        expect.objectContaining({
          label: "Top position driver",
          value: "PIMCO GIS Income Fund",
          support:
            "Current PIMCO GIS Income Fund 18.40%; proposed PIMCO GIS Income Fund 18.40%; source delta 0.00%.",
        }),
        expect.objectContaining({
          label: "Issuer coverage",
        }),
        expect.objectContaining({
          label: "Reporting currency",
          value: "USD",
          support: "Same as base currency (USD)",
        }),
      ])
    );
    expect(viewModel.supportability.map((item) => item.key)).toEqual([
      "summary:portfolio_returns",
      "summary:benchmark_returns",
      "summary:risk_free_series",
      "concentration:portfolio_positions",
      "concentration:issuer_enrichment",
      "concentration:issuer_grouping",
      "concentration:valuation_basis",
      "attribution:portfolio_returns",
      "attribution:exposure_history",
      "attribution:benchmark_exposure_context",
      "drawdown:portfolio_returns",
      "drawdown:benchmark_relative_drawdown",
      "drawdown:underwater_series",
      "rolling:portfolio_returns",
      "rolling:benchmark_returns",
      "rolling:risk_free_series",
      "rolling:rolling_time_series",
    ]);
    expect(viewModel.drawdownHeadlineMetrics.map((metric) => metric.label)).toEqual([
      "Max drawdown",
      "Relative max drawdown",
      "Time under water",
      "Recovery status",
    ]);
    expect(viewModel.drawdownSupportingMetrics.map((metric) => metric.label)).toEqual([
      "Ulcer index",
    ]);
    expect(viewModel.drawdownEpisodeInterpretation).toBeNull();
    expect(viewModel.drawdownContextRows[0]).toMatchObject({
      label: "Portfolio observations",
    });
    expect(viewModel.drawdownEpisodes[0]).toMatchObject({
      episode: "DD_0001",
      depth: "-12.45%",
      status: "Open",
    });
    expect(viewModel.rollingWindows[0]).toMatchObject({
      label: "21D",
      horizonLabel: "Short window",
    });
    expect(viewModel.rollingContextRows[0]).toMatchObject({
      label: "Window set",
    });
    expect(
      viewModel.supportability.find((item) => item.key === "rolling:risk_free_series")
    ).toMatchObject({
      state: "partial",
      reason:
        "Rolling Sharpe is omitted or marked unavailable when the risk-free curve cannot be sourced.",
    });
    expect(viewModel.rollingContextRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Benchmark-relative review",
          value: "Qualified",
        }),
      ])
    );
    expect(viewModel.rollingWindows[0]?.headlineMetrics.map((metric) => metric.label)).toContain(
      "Volatility"
    );
    expect(viewModel.rollingWindows[0]?.headlineMetrics[0]).toMatchObject({
      label: "Volatility",
      support: "Above typical but still in range",
    });
    expect(viewModel.rollingWindows[0]?.selectedWindowSummary).toMatchObject({
      title: "21D selected-window review",
    });
    expect(viewModel.rollingWindows[0]?.selectedWindowSummary.body).toContain(
      "Current volatility is 11.32%, above the recent typical."
    );
    expect(viewModel.rollingWindows[0]?.detailRowInterpretations[0]).toMatchObject({
      metric: "Volatility",
      interpretation: "Current reading is above typical but still in range.",
    });
    expect(viewModel.attributionControls?.selectedAttributionType).toBe("TOTAL_RISK");
    expect(viewModel.attributionMethodologyRows[0]).toMatchObject({
      label: "Reconciled sum",
    });
    expect(viewModel.attributionRows[0]).toMatchObject({
      group: "Technology",
    });
  });

  it.each([
    {
      reportingCurrency: "SGD",
      baseCurrency: "USD",
      expectedValue: "SGD",
      expectedSupport: "Base currency USD",
    },
    {
      reportingCurrency: null,
      baseCurrency: "USD",
      expectedValue: "N/A",
      expectedSupport: "Base currency USD; reporting currency not reported by the source",
    },
    {
      reportingCurrency: "SGD",
      baseCurrency: null,
      expectedValue: "SGD",
      expectedSupport: "Base currency not reported by the source",
    },
  ])(
    "keeps reporting and base currency evidence distinct for $expectedSupport",
    ({ reportingCurrency, baseCurrency, expectedValue, expectedSupport }) => {
      const scenario = buildSupportedPerformanceScenario();
      const concentration = buildFixtureRiskConcentration(scenario.workspace, "YTD");
      const valuationContext = concentration.payload?.valuation_context;
      if (!valuationContext) {
        throw new Error("Expected the fixture to publish valuation context.");
      }
      valuationContext.reporting_currency = reportingCurrency;
      valuationContext.portfolio_currency = baseCurrency;

      const viewModel = buildPerformanceRiskViewModel({
        workspace: scenario.workspace,
        period: "YTD",
        detailBasis: "NET",
        riskSummary: buildFixtureRiskSummary(scenario.workspace, "YTD", "NET"),
        riskConcentration: concentration,
        riskAttribution: buildFixtureRiskAttribution(scenario.workspace, "YTD", "NET"),
        riskDrawdown: buildFixtureRiskDrawdown(scenario.workspace, "YTD", "NET"),
        riskRolling: buildFixtureRiskRolling(scenario.workspace, "YTD", "NET"),
      });

      expect(
        viewModel.concentrationContextRows.find((row) => row.key === "reporting_currency"),
      ).toMatchObject({
        label: "Reporting currency",
        value: expectedValue,
        support: expectedSupport,
      });
    },
  );

  it("does not imply benchmark-relative risk is ready when benchmark context is absent", () => {
    const scenario = buildBenchmarkUnassignedPerformanceScenario();

    const viewModel = buildPerformanceRiskViewModel({
      workspace: scenario.workspace,
      period: "YTD",
      detailBasis: "NET",
      riskSummary: buildFixtureRiskSummary(scenario.workspace, "YTD", "NET"),
      riskConcentration: buildFixtureRiskConcentration(scenario.workspace, "YTD"),
      riskAttribution: buildFixtureRiskAttribution(scenario.workspace, "YTD", "NET", {
        attributionType: "ACTIVE_RISK",
        groupingDimension: "SECTOR",
      }),
      riskDrawdown: buildFixtureRiskDrawdown(scenario.workspace, "YTD", "NET", {
        includeBenchmarkRelative: false,
      }),
      riskRolling: buildFixtureRiskRolling(scenario.workspace, "YTD", "NET"),
    });

    expect(viewModel.state).toBe("partial");
    expect(
      viewModel.supportability.find((item) => item.key === "summary:benchmark_returns")
    ).toMatchObject({
      state: "unavailable",
      reason: "Benchmark-relative risk requires benchmark context.",
    });
    expect(viewModel.drawdownRelativeMetric).toMatchObject({
      value: "N/A",
      support: "Benchmark-relative drawdown requires benchmark context.",
    });
    expect(viewModel.snapshotHeadlineMetrics.find((metric) => metric.key === "BETA")).toMatchObject({
      value: "N/A",
      support: "Benchmark-relative risk requires benchmark context.",
      state: "unavailable",
    });
    expect(viewModel.rollingContextRows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Benchmark-relative review",
          value: "Qualified",
        }),
      ])
    );
    expect(viewModel.attributionControls?.attributionTypes[1]).toMatchObject({
      key: "ACTIVE_RISK",
      disabled: true,
    });
  });

  it("treats a source metric without a numeric volatility value as unavailable", () => {
    const scenario = buildSupportedPerformanceScenario();
    const riskSummary = buildFixtureRiskSummary(scenario.workspace, "YTD", "NET");
    const volatility = riskSummary.payload?.periods[0]?.metrics.find(
      (metric) => metric.key === "VOLATILITY",
    );
    if (!volatility) {
      throw new Error("Expected the fixture to publish a volatility metric.");
    }
    volatility.value = null;
    volatility.reason = "The source did not return a numeric volatility measure.";

    const viewModel = buildPerformanceRiskViewModel({
      workspace: scenario.workspace,
      period: "YTD",
      detailBasis: "NET",
      riskSummary,
      riskConcentration: buildFixtureRiskConcentration(scenario.workspace, "YTD"),
      riskAttribution: buildFixtureRiskAttribution(scenario.workspace, "YTD", "NET"),
      riskDrawdown: buildFixtureRiskDrawdown(scenario.workspace, "YTD", "NET"),
      riskRolling: buildFixtureRiskRolling(scenario.workspace, "YTD", "NET"),
    });

    expect(viewModel.workspaceOverview[0]).toMatchObject({
      label: "Realised volatility",
      value: "Unavailable",
      support: "The source did not return a numeric volatility measure.",
      tone: "warn",
    });
  });

  it("preserves percentage-point units for low source volatility values", () => {
    const scenario = buildSupportedPerformanceScenario();
    const riskSummary = buildFixtureRiskSummary(scenario.workspace, "YTD", "NET");
    const volatility = riskSummary.payload?.periods[0]?.metrics.find(
      (metric) => metric.key === "VOLATILITY",
    );
    if (!volatility) {
      throw new Error("Expected the fixture to publish a volatility metric.");
    }
    volatility.value = 0.75;

    const viewModel = buildPerformanceRiskViewModel({
      workspace: scenario.workspace,
      period: "YTD",
      detailBasis: "NET",
      riskSummary,
      riskConcentration: buildFixtureRiskConcentration(scenario.workspace, "YTD"),
      riskAttribution: buildFixtureRiskAttribution(scenario.workspace, "YTD", "NET"),
      riskDrawdown: buildFixtureRiskDrawdown(scenario.workspace, "YTD", "NET"),
      riskRolling: buildFixtureRiskRolling(scenario.workspace, "YTD", "NET"),
    });

    expect(viewModel.workspaceOverview[0]).toMatchObject({
      label: "Realised volatility",
      value: "0.75%",
      support: "YTD annualised source measure",
    });
  });

  it("preserves the source qualification for partial volatility evidence", () => {
    const scenario = buildSupportedPerformanceScenario();
    const riskSummary = buildFixtureRiskSummary(scenario.workspace, "YTD", "NET");
    const volatility = riskSummary.payload?.periods[0]?.metrics.find(
      (metric) => metric.key === "VOLATILITY",
    );
    if (!volatility) {
      throw new Error("Expected the fixture to publish a volatility metric.");
    }
    volatility.state = "partial";
    volatility.reason = "The source returned incomplete daily observations.";

    const viewModel = buildPerformanceRiskViewModel({
      workspace: scenario.workspace,
      period: "YTD",
      detailBasis: "NET",
      riskSummary,
      riskConcentration: buildFixtureRiskConcentration(scenario.workspace, "YTD"),
      riskAttribution: buildFixtureRiskAttribution(scenario.workspace, "YTD", "NET"),
      riskDrawdown: buildFixtureRiskDrawdown(scenario.workspace, "YTD", "NET"),
      riskRolling: buildFixtureRiskRolling(scenario.workspace, "YTD", "NET"),
    });

    expect(viewModel.workspaceOverview[0]).toMatchObject({
      label: "Realised volatility",
      value: "7.25%",
      support: "YTD: The source returned incomplete daily observations.",
      tone: "warn",
    });
  });

  it("qualifies partial drawdown and largest-position evidence at the owning source", () => {
    const scenario = buildSupportedPerformanceScenario();
    const riskDrawdown = buildFixtureRiskDrawdown(scenario.workspace, "YTD", "NET");
    const drawdownEvidence = riskDrawdown.supportability.find(
      (item) => item.key === "portfolio_returns",
    );
    if (!drawdownEvidence) {
      throw new Error("Expected the fixture to publish drawdown source evidence.");
    }
    drawdownEvidence.state = "partial";
    drawdownEvidence.reason = "The source returned an incomplete return history.";

    const riskConcentration = buildFixtureRiskConcentration(scenario.workspace, "YTD");
    const positionEvidence = riskConcentration.supportability.find(
      (item) => item.key === "portfolio_positions",
    );
    if (!positionEvidence) {
      throw new Error("Expected the fixture to publish position source evidence.");
    }
    positionEvidence.state = "partial";
    positionEvidence.reason = "The source returned incomplete booked-position coverage.";

    const viewModel = buildPerformanceRiskViewModel({
      workspace: scenario.workspace,
      period: "YTD",
      detailBasis: "NET",
      riskSummary: buildFixtureRiskSummary(scenario.workspace, "YTD", "NET"),
      riskConcentration,
      riskAttribution: buildFixtureRiskAttribution(scenario.workspace, "YTD", "NET"),
      riskDrawdown,
      riskRolling: buildFixtureRiskRolling(scenario.workspace, "YTD", "NET"),
    });

    expect(viewModel.workspaceOverview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Max drawdown",
          value: "-12.45%",
          support:
            "Still below the prior peak at period end. The source returned an incomplete return history.",
          tone: "warn",
        }),
        expect.objectContaining({
          label: "Largest position",
          value: "18.40%",
          support:
            "PIMCO GIS Income Fund. The source returned incomplete booked-position coverage.",
          tone: "warn",
        }),
      ]),
    );
  });

  it("returns a loading state without fabricated metrics while details are pending", () => {
    const scenario = buildSupportedPerformanceScenario();

    const viewModel = buildPerformanceRiskViewModel({
      workspace: scenario.workspace,
      period: "YTD",
      detailBasis: "NET",
      isDetailsPending: true,
    });

    expect(viewModel.state).toBe("loading");
    expect(viewModel.workspaceOverview).toEqual([]);
    expect(viewModel.snapshotHeadlineMetrics).toEqual([]);
    expect(viewModel.snapshotSupportingMetrics).toEqual([]);
    expect(viewModel.concentrationIndicators).toEqual([]);
    expect(viewModel.rollingWindows).toEqual([]);
    expect(viewModel.supportability).toEqual([
      expect.objectContaining({ key: "risk_bff", state: "partial" }),
    ]);
  });

  it("only surfaces underwater series after detail-on-demand fetch returns", () => {
    const scenario = buildSupportedPerformanceScenario();

    const viewModel = buildPerformanceRiskViewModel({
      workspace: scenario.workspace,
      period: "YTD",
      detailBasis: "NET",
      riskSummary: buildFixtureRiskSummary(scenario.workspace, "YTD", "NET"),
      riskConcentration: buildFixtureRiskConcentration(scenario.workspace, "YTD"),
      riskDrawdown: buildFixtureRiskDrawdown(scenario.workspace, "YTD", "NET"),
      riskDrawdownDetail: buildFixtureRiskDrawdown(scenario.workspace, "YTD", "NET", {
        includeUnderwaterSeries: true,
      }),
      riskRolling: buildFixtureRiskRolling(scenario.workspace, "YTD", "NET"),
    });

    expect(viewModel.underwaterDetailState).toBe("ready");
    expect(viewModel.underwaterSeries).toHaveLength(3);
    expect(viewModel.underwaterSeries[0]).toMatchObject({
      date: "20 Jan 2026",
      drawdown: "-5.21%",
    });
  });

  it("only surfaces rolling series after detail-on-demand fetch returns", () => {
    const scenario = buildSupportedPerformanceScenario();

    const viewModel = buildPerformanceRiskViewModel({
      workspace: scenario.workspace,
      period: "YTD",
      detailBasis: "NET",
      riskSummary: buildFixtureRiskSummary(scenario.workspace, "YTD", "NET"),
      riskConcentration: buildFixtureRiskConcentration(scenario.workspace, "YTD"),
      riskAttribution: buildFixtureRiskAttribution(scenario.workspace, "YTD", "NET", {
        attributionType: "ACTIVE_RISK",
        groupingDimension: "ISSUER",
      }),
      riskDrawdown: buildFixtureRiskDrawdown(scenario.workspace, "YTD", "NET"),
      riskRolling: buildFixtureRiskRolling(scenario.workspace, "YTD", "NET"),
      riskRollingDetail: buildFixtureRiskRolling(scenario.workspace, "YTD", "NET", {
        includeTimeSeries: true,
      }),
    });

    expect(viewModel.rollingDetailState).toBe("ready");
    expect(viewModel.rollingWindows[0]?.seriesRows).toHaveLength(3);
    expect(viewModel.rollingWindows[0]?.seriesRows[0]).toMatchObject({
      date: "01 Jan 2026",
    });
    expect(viewModel.rollingWindows[0]?.seriesRows[0]?.values.ROLLING_VOLATILITY).toMatch(
      /%$/
    );
    expect(viewModel.attributionState).toBe("blocked");
  });

  it("normalizes attribution percentages when upstream returns already-scaled percentage values", () => {
    const scenario = buildSupportedPerformanceScenario();
    const attribution = buildFixtureRiskAttribution(scenario.workspace, "YTD", "NET");

    attribution.payload?.periods[0]?.attribution_sets[0]?.contributors.splice(0, 1, {
      ...(attribution.payload?.periods[0]?.attribution_sets[0]?.contributors[0] ?? {
        group_key: "cash",
        group_label: "Cash",
        weight_average: 0.0002,
        marginal_contribution: 83.5946,
        component_contribution: 0.0184,
        percent_contribution: 0.1956,
      }),
      marginal_contribution: 83.5946,
      component_contribution: 0.0184,
      percent_contribution: 0.1956,
    });

    const viewModel = buildPerformanceRiskViewModel({
      workspace: scenario.workspace,
      period: "YTD",
      detailBasis: "NET",
      riskSummary: buildFixtureRiskSummary(scenario.workspace, "YTD", "NET"),
      riskConcentration: buildFixtureRiskConcentration(scenario.workspace, "YTD"),
      riskAttribution: attribution,
      riskDrawdown: buildFixtureRiskDrawdown(scenario.workspace, "YTD", "NET"),
      riskRolling: buildFixtureRiskRolling(scenario.workspace, "YTD", "NET"),
    });

    expect(viewModel.attributionRows[0]).toMatchObject({
      marginalContribution: "83.59%",
      componentContribution: "1.84%",
      contributionShare: "19.56%",
    });
  });

  it.each([
    {
      sourceState: "ready",
      expectedState: "ready",
      expectedRows: 2,
      expectedScale: 41,
      expectedMethodologyRows: 6,
    },
    {
      sourceState: "partial",
      expectedState: "partial",
      expectedRows: 2,
      expectedScale: 0,
      expectedMethodologyRows: 6,
    },
    {
      sourceState: "unavailable",
      expectedState: "unavailable",
      expectedRows: 0,
      expectedScale: 0,
      expectedMethodologyRows: 0,
    },
    {
      sourceState: "blocked",
      expectedState: "blocked",
      expectedRows: 0,
      expectedScale: 0,
      expectedMethodologyRows: 0,
    },
    {
      sourceState: "unexpected",
      expectedState: "unavailable",
      expectedRows: 0,
      expectedScale: 0,
      expectedMethodologyRows: 0,
    },
  ])(
    "maps $sourceState attribution without promoting unsupported evidence",
    ({
      sourceState,
      expectedState,
      expectedRows,
      expectedScale,
      expectedMethodologyRows,
    }) => {
      const scenario = buildSupportedPerformanceScenario();
      const attribution = {
        ...buildFixtureRiskAttribution(scenario.workspace, "YTD", "NET"),
        state: sourceState,
      } as WorkbenchRiskAttributionResponse;

      const viewModel = buildPerformanceRiskViewModel({
        workspace: scenario.workspace,
        period: "YTD",
        detailBasis: "NET",
        riskAttribution: attribution,
      });

      expect(viewModel.attributionState).toBe(expectedState);
      expect(viewModel.attributionRows).toHaveLength(expectedRows);
      expect(viewModel.attributionMaxContributionShareAbsPct).toBe(expectedScale);
      expect(viewModel.attributionMethodologyRows).toHaveLength(expectedMethodologyRows);
    },
  );

  it("keeps a partial source qualification in the methodology posture", () => {
    const scenario = buildSupportedPerformanceScenario();
    const attribution = {
      ...buildFixtureRiskAttribution(scenario.workspace, "YTD", "NET"),
      state: "partial",
    } satisfies WorkbenchRiskAttributionResponse;
    const selectedSet = attribution.payload?.periods[0]?.attribution_sets[0];
    if (!selectedSet) {
      throw new Error("Expected fixture attribution set.");
    }
    selectedSet.residual = 0.0005;

    const viewModel = buildPerformanceRiskViewModel({
      workspace: scenario.workspace,
      period: "YTD",
      detailBasis: "NET",
      riskAttribution: attribution,
    });

    expect(viewModel.attributionMethodologyRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Evidence posture",
          value: "Qualified",
          support: "Review the source qualifications before using this decomposition externally.",
        }),
      ]),
    );
  });

  it("discards every attribution-derived projection for an unknown source state", () => {
    const scenario = buildSupportedPerformanceScenario();
    const attribution = {
      ...buildFixtureRiskAttribution(scenario.workspace, "YTD", "NET"),
      state: "unexpected",
      supportability: [
        {
          key: "unadmitted_attribution_evidence",
          label: "Unadmitted attribution evidence",
          state: "ready",
          source_service: "lotus-risk",
        },
      ],
      warnings: ["UNADMITTED_ATTRIBUTION_WARNING"],
      partial_failures: [
        {
          source_service: "lotus-risk",
          error_code: "unadmitted_attribution_failure",
          detail: "Unadmitted attribution failure detail",
        },
      ],
    } as unknown as WorkbenchRiskAttributionResponse;

    const viewModel = buildPerformanceRiskViewModel({
      workspace: scenario.workspace,
      period: "YTD",
      detailBasis: "NET",
      riskAttribution: attribution,
    });

    expect(viewModel.attributionState).toBe("unavailable");
    expect(viewModel.attributionControls).toBeNull();
    expect(viewModel.attributionRows).toEqual([]);
    expect(viewModel.attributionMethodologyRows).toEqual([]);
    expect(viewModel.attributionWarnings).toEqual([]);
    expect(viewModel.supportability).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "attribution_unadmitted_attribution_evidence" }),
      ]),
    );
    expect(viewModel.warnings).not.toContain("UNADMITTED_ATTRIBUTION_WARNING");
    expect(viewModel.partialFailures).not.toContain("Unadmitted attribution failure detail");
    expect(viewModel.workspaceOverview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Source coverage", value: "Unavailable" }),
      ]),
    );
  });
});
