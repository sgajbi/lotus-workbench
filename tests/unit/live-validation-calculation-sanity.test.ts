import {
  assertPerformanceCalculationSanity,
  assertRiskAttributionReconciliation,
  assertRiskCalculationSanity,
  summarizePayloadSourceSupportability,
} from "../../scripts/live/validation/calculation-sanity.mjs";

type TestValidationSummary = {
  calculationChecks: Array<Record<string, unknown>>;
  panelClassifications: Array<Record<string, unknown>>;
  supportabilityChecks: Array<Record<string, unknown>>;
};

function createSummary(): TestValidationSummary {
  return {
    calculationChecks: [],
    panelClassifications: [],
    supportabilityChecks: [],
  };
}

function createClassifier(summary: TestValidationSummary) {
  return (panel: string, state: string, owner: string, evidence: Record<string, unknown>) => {
    summary.panelClassifications.push({ panel, state, owner, ...evidence });
  };
}

function createPartialPerformanceAttribution(rows: Array<Record<string, unknown>>) {
  return {
    status: "partial",
    reason_codes: ["material_residual"],
    reasons: [
      {
        code: "material_residual",
        severity: "warning",
        message: "Attribution residual exceeded the governed materiality threshold.",
        affected_group_count: 0,
      },
    ],
    supportability_evidence: {
      portfolio_only_group_count: 0,
      benchmark_only_group_count: 0,
      unclassified_group_count: 0,
      missing_benchmark_return_count: 0,
      negative_weight_count: 0,
      zero_portfolio_exposure_count: 0,
      currency_attribution_status: "not_requested",
      linking_status: "linked",
    },
    levels: [{ rows }],
  };
}

function createSupportedPerformancePayloads(
  attribution = createPartialPerformanceAttribution([{}, {}])
) {
  return {
    performanceSummary: {
      net_performance: {
        portfolio_return_pct: 9.33,
        benchmark_return_pct: 6.52,
        active_return_pct: 2.81,
      },
      overview: {
        market_value_base: 1_500_000,
        cash_weight_pct: 12.4,
        position_count: 18,
      },
      capabilities: {
        evidence: {
          state: "supported",
          reason: "lineage evidence is complete",
        },
      },
    },
    performanceDetails: {
      net_chart: [{}, {}, {}, {}],
      contribution: {
        levels: [
          {
            rows: [{}, {}, {}, {}],
            total_contribution_pct: 9.33,
          },
        ],
      },
      capabilities: {
        attribution_detail: {
          state: "supported",
          fallback_available: false,
        },
      },
      attribution,
    },
  };
}

describe("live validation calculation sanity helpers", () => {
  it("keeps transient source-limited performance evidence out of ready validation", () => {
    const partial = summarizePayloadSourceSupportability({
      evidence_view: {
        source_supportability: [
          {
            source_service: "lotus-performance",
            operation: "performance.contribution",
            state: "supported",
            freshness_bucket: "current",
          },
        ],
      },
      contribution: {
        source_economics_evidence: {
          source_owner: "lotus-core",
          status: "SOURCE_LIMITED",
          source_snapshot_count: 1,
        },
      },
    });
    const ready = summarizePayloadSourceSupportability({
      evidence_view: {
        source_supportability: [
          {
            source_service: "lotus-performance",
            operation: "performance.contribution",
            state: "supported",
            freshness_bucket: "current",
          },
        ],
      },
      contribution: {
        source_economics_evidence: {
          source_owner: "lotus-core",
          status: "SOURCE_BACKED",
          source_snapshot_count: 1,
        },
      },
    });

    expect(partial.state).toBe("partial");
    expect(ready.state).toBe("ready");
  });

  it("accepts reconciled performance payloads and records governed panel classifications", () => {
    const summary = createSummary();

    assertPerformanceCalculationSanity({
      summary,
      recordPanelClassification: createClassifier(summary),
      performanceSummary: {
        net_performance: {
          portfolio_return_pct: 9.33,
          benchmark_return_pct: 6.52,
          active_return_pct: 2.81,
        },
        overview: {
          market_value_base: 1_500_000,
          cash_weight_pct: 12.4,
          position_count: 18,
        },
        capabilities: {
          evidence: {
            state: "partial",
            reason: "lineage evidence remains partial",
          },
        },
        evidence_view: {
          source_supportability: [
            {
              source_service: "lotus-performance",
              operation: "performance.twr",
              state: "ready",
              freshness_bucket: "fresh",
            },
          ],
        },
      },
      performanceDetails: {
        net_chart: [{}, {}, {}, {}],
        contribution: {
          source_economics_evidence: {
            status: "SOURCE_LIMITED",
            source_contracts: ["PortfolioTimeseriesInput:v1", "PositionTimeseriesInput:v1"],
            source_snapshot_count: 4,
          },
          levels: [
            {
              rows: [{}, {}, {}, {}],
              total_contribution_pct: 9.33,
            },
          ],
        },
        capabilities: {
          attribution_detail: {
            state: "partial",
            fallback_available: true,
          },
        },
        attribution: createPartialPerformanceAttribution([]),
        evidence_view: {
          source_supportability: [
            {
              source_service: "lotus-performance",
              operation: "performance.attribution",
              state: "partial",
              freshness_bucket: "stale",
            },
          ],
        },
      },
    });

    expect(summary.calculationChecks).toHaveLength(1);
    expect(summary.panelClassifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ panel: "performance.summary", state: "partial" }),
        expect.objectContaining({
          panel: "performance.analysis.contribution",
          state: "partial",
        }),
        expect.objectContaining({
          panel: "performance.analysis.attribution",
          state: "partial",
          attributionStatus: "partial",
          reasonCodes: ["material_residual"],
          supportabilityEvidence: expect.objectContaining({ linking_status: "linked" }),
        }),
        expect.objectContaining({ panel: "performance.evidence", state: "partial" }),
      ])
    );
    expect(summary.supportabilityChecks).toEqual([
      expect.objectContaining({
        panel: "performance.summary",
        owner: "lotus-gateway",
        source: "gateway.source_supportability",
        state: "partial",
        itemCount: 3,
        staleCount: 1,
        partialCount: 2,
        services: ["lotus-core", "lotus-performance"],
      }),
    ]);
  });

  it("keeps composite performance panels partial when component capabilities are supported", () => {
    const summary = createSummary();

    assertPerformanceCalculationSanity({
      summary,
      recordPanelClassification: createClassifier(summary),
      ...createSupportedPerformancePayloads(),
    });

    expect(summary.panelClassifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          panel: "performance.analysis.attribution",
          state: "partial",
          attributionState: "supported",
        }),
        expect.objectContaining({
          panel: "performance.evidence",
          state: "partial",
          capabilityState: "supported",
        }),
      ])
    );
  });

  it.each([
    ["source status", "status", "Canonical attribution supportability must remain partial"],
    ["reason codes", "reason_codes", "Partial attribution omitted source-owned reason codes"],
    [
      "supportability evidence",
      "supportability_evidence",
      "Partial attribution omitted source-owned supportability evidence",
    ],
  ])("rejects partial attribution without %s", (_label, missingField, expectedError) => {
    const summary = createSummary();
    const payloads = createSupportedPerformancePayloads(
      createPartialPerformanceAttribution([{}])
    );
    const attribution = payloads.performanceDetails.attribution;
    delete attribution[missingField as keyof typeof attribution];

    expect(() =>
      assertPerformanceCalculationSanity({
        summary,
        recordPanelClassification: createClassifier(summary),
        ...payloads,
      }),
    ).toThrow(expectedError);
  });

  it("rejects a non-empty but malformed attribution supportability object", () => {
    const summary = createSummary();
    const payloads = createSupportedPerformancePayloads(
      createPartialPerformanceAttribution([{}])
    );
    const malformedAttribution = {
      ...payloads.performanceDetails.attribution,
      supportability_evidence: { unexpected: true },
    };

    expect(() =>
      assertPerformanceCalculationSanity({
        summary,
        recordPanelClassification: createClassifier(summary),
        ...payloads,
        performanceDetails: {
          ...payloads.performanceDetails,
          attribution: malformedAttribution,
        },
      }),
    ).toThrow(
      "Partial attribution supportability evidence has invalid portfolio_only_group_count",
    );
  });

  it("rejects mixed valid and malformed attribution reason codes", () => {
    const summary = createSummary();
    const payloads = createSupportedPerformancePayloads(
      createPartialPerformanceAttribution([{}])
    );
    const malformedAttribution = {
      ...payloads.performanceDetails.attribution,
      reason_codes: [42, "material_residual"],
    };

    expect(() =>
      assertPerformanceCalculationSanity({
        summary,
        recordPanelClassification: createClassifier(summary),
        ...payloads,
        performanceDetails: {
          ...payloads.performanceDetails,
          attribution: malformedAttribution,
        },
      }),
    ).toThrow("Partial attribution omitted source-owned reason codes.");
  });

  it("fails performance attribution when governed fallback is missing", () => {
    const summary = createSummary();

    expect(() =>
      assertPerformanceCalculationSanity({
        summary,
        recordPanelClassification: createClassifier(summary),
        performanceSummary: {
          net_performance: {
            portfolio_return_pct: 9.33,
            benchmark_return_pct: 6.52,
            active_return_pct: 2.81,
          },
          overview: {
            market_value_base: 1_500_000,
            cash_weight_pct: 12.4,
            position_count: 18,
          },
        },
        performanceDetails: {
          net_chart: [{}, {}, {}, {}],
          contribution: {
            levels: [
              {
                rows: [{}, {}, {}, {}],
                total_contribution_pct: 9.33,
              },
            ],
          },
          capabilities: {
            attribution_detail: {
              state: "partial",
              fallback_available: false,
            },
          },
          attribution: createPartialPerformanceAttribution([]),
        },
      })
    ).toThrow("Attribution detail is partial without a governed fallback.");
  });

  it("accepts ready risk payloads and records all risk panel classifications", () => {
    const summary = createSummary();

    assertRiskCalculationSanity({
      summary,
      recordPanelClassification: createClassifier(summary),
      riskSummary: {
        payload: {
          periods: [
            {
              metrics: Array.from({ length: 6 }, () => ({ state: "ready" })),
              portfolio_observation_count: 120,
              aligned_benchmark_observation_count: 120,
              benchmark_context: { aligned: true },
            },
          ],
        },
        supportability: [
          {
            key: "portfolio_returns",
            label: "Portfolio returns",
            source_service: "lotus-risk",
            operation: "risk.summary",
            state: "ready",
            freshness_bucket: "fresh",
          },
        ],
      },
      concentration: {
        source_supportability: [
          {
            source_service: "lotus-risk",
            operation: "risk.concentration",
            state: "ready",
            freshness_bucket: "fresh",
          },
        ],
        payload: {
          portfolio_concentration: { hhi_current: 1356 },
          issuer_concentration: { coverage_ratio_current: 0.99 },
          single_position_concentration: { top_n_cumulative_weight_current: 0.992 },
        },
      },
      drawdown: {
        source_supportability: [
          {
            source_service: "lotus-risk",
            operation: "risk.drawdown",
            state: "ready",
            freshness_bucket: "fresh",
          },
        ],
        payload: {
          periods: [
            {
              portfolio_observation_count: 120,
              relative_to_benchmark: { time_under_water_days: 81 },
              underwater_series: Array.from({ length: 60 }, () => ({})),
            },
          ],
        },
      },
      rolling: {
        source_supportability: [
          {
            source_service: "lotus-risk",
            operation: "risk.rolling",
            state: "ready",
            freshness_bucket: "fresh",
          },
        ],
        payload: {
          periods: [
            {
              window_count_emitted: 4,
              window_results: [
                { window_length: 21, metric_summaries: { ROLLING_VOLATILITY: { latest: 0.02 } } },
                { window_length: 63, metric_summaries: { ROLLING_VOLATILITY: { latest: 0.04 } } },
                { window_length: 126, metric_summaries: { ROLLING_VOLATILITY: {} } },
                { window_length: 252, metric_summaries: { ROLLING_VOLATILITY: {} } },
              ],
            },
          ],
        },
      },
      attribution: {
        source_supportability: [
          {
            source_service: "lotus-risk",
            operation: "risk.attribution",
            state: "ready",
            freshness_bucket: "fresh",
          },
        ],
        payload: {
          periods: [
            {
              attribution_sets: [
                {
                  contributors: [{}, {}, {}, {}, {}],
                  total_value: 0.026056961137819173,
                  reconciled_sum: 0.026077651902779688,
                  residual: -0.000020690764960515362,
                  quality_flags: [],
                },
              ],
            },
          ],
        },
      },
    });

    expect(summary.calculationChecks).toHaveLength(1);
    expect(summary.calculationChecks[0]).toEqual(
      expect.objectContaining({
        attributionTotalValue: 0.026056961137819173,
        attributionReconciledSum: 0.026077651902779688,
        attributionResidual: -0.000020690764960515362,
        attributionResidualShareOfTotal: expect.any(Number),
        attributionQualityFlags: [],
      })
    );
    expect(summary.panelClassifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ panel: "performance.risk.snapshot", state: "ready" }),
        expect.objectContaining({ panel: "performance.risk.concentration", state: "ready" }),
        expect.objectContaining({ panel: "performance.risk.drawdown", state: "ready" }),
        expect.objectContaining({ panel: "performance.risk.rolling", state: "ready" }),
        expect.objectContaining({
          panel: "performance.risk.historical_attribution",
          state: "ready",
        }),
      ])
    );
    expect(summary.supportabilityChecks).toEqual([
      expect.objectContaining({
        panel: "performance.risk.snapshot",
        owner: "lotus-gateway",
        source: "gateway.source_supportability",
        state: "ready",
        itemCount: 5,
        services: ["lotus-risk"],
      }),
    ]);
  });

  it.each([
    ["missing freshness", { state: "ready" }],
    ["unknown supportability", { state: "unexpected", freshness_bucket: "fresh" }],
    [
      "missing source identity",
      {
        source_service: undefined,
        operation: undefined,
        key: undefined,
        state: "ready",
        freshness_bucket: "fresh",
      },
    ],
  ])("fails source supportability closed for %s", (_label, sourceSupportability) => {
    const summary = createSummary();

    assertPerformanceCalculationSanity({
      summary,
      recordPanelClassification: createClassifier(summary),
      performanceSummary: {
        net_performance: {
          portfolio_return_pct: 9.33,
          benchmark_return_pct: 6.52,
          active_return_pct: 2.81,
        },
        overview: {
          market_value_base: 1_500_000,
          cash_weight_pct: 12.4,
          position_count: 18,
        },
        evidence_view: {
          source_supportability: [
            {
              source_service: "lotus-performance",
              operation: "performance.twr",
              ...sourceSupportability,
            },
          ],
        },
      },
      performanceDetails: {
        net_chart: [{}, {}, {}, {}],
        contribution: {
          levels: [
            {
              rows: [{}, {}, {}, {}],
              total_contribution_pct: 9.33,
            },
          ],
        },
        capabilities: {
          attribution_detail: {
            state: "supported",
            fallback_available: false,
          },
        },
        attribution: createPartialPerformanceAttribution([{}]),
      },
    });

    expect(summary.supportabilityChecks).toContainEqual(
      expect.objectContaining({
        panel: "performance.summary",
        state: "partial",
        itemCount: 1,
        unconfirmedCount: 1,
      })
    );
    expect(summary.panelClassifications).toContainEqual(
      expect.objectContaining({
        panel: "performance.summary",
        state: "partial",
        sourceSupportabilityState: "partial",
      })
    );
  });

  it("rejects performance certification when source supportability requires action", () => {
    const summary = createSummary();

    expect(() =>
      assertPerformanceCalculationSanity({
        summary,
        recordPanelClassification: createClassifier(summary),
        performanceSummary: {
          net_performance: {
            portfolio_return_pct: 9.33,
            benchmark_return_pct: 6.52,
            active_return_pct: 2.81,
          },
          overview: {
            market_value_base: 1_500_000,
            cash_weight_pct: 12.4,
            position_count: 18,
          },
          evidence_view: {
            source_supportability: [
              {
                source_service: "lotus-performance",
                operation: "performance.twr",
                state: "blocked",
                freshness_bucket: "fresh",
              },
            ],
          },
        },
        performanceDetails: {
          net_chart: Array.from({ length: 24 }, () => ({})),
          contribution: {
            levels: [
              {
                rows: [{}, {}, {}, {}],
                total_contribution_pct: 9.33,
              },
            ],
          },
          capabilities: {
            attribution_detail: {
              state: "supported",
              fallback_available: false,
            },
          },
          attribution: createPartialPerformanceAttribution([{}]),
        },
      })
    ).toThrow("Performance source supportability requires action and cannot be certified as ready.");
    expect(summary.panelClassifications).toHaveLength(0);
  });

  it.each([
    {
      label: "the canonical live negative residual",
      total_value: 0.026056961137819173,
      reconciled_sum: 0.026077651902779688,
      residual: -0.000020690764960515362,
    },
    {
      label: "a positive residual",
      total_value: 0.2,
      reconciled_sum: 0.199,
      residual: 0.0010000000000000009,
    },
    {
      label: "a zero total and residual",
      total_value: 0,
      reconciled_sum: 0,
      residual: 0,
    },
  ])("accepts $label when source reconciliation is internally consistent", (attributionSet) => {
    const evidence = assertRiskAttributionReconciliation({
      ...attributionSet,
      quality_flags: [],
    });

    expect(evidence.residual).toBe(attributionSet.residual);
    expect(evidence.reconciliationError).toBeLessThanOrEqual(evidence.comparisonTolerance);
  });

  it("rejects a source residual that does not equal total less reconciled sum", () => {
    expect(() =>
      assertRiskAttributionReconciliation({
        total_value: 0.2,
        reconciled_sum: 0.199,
        residual: 0.002,
        quality_flags: [],
      })
    ).toThrow(
      "Historical risk attribution is internally inconsistent: total 0.2 - reconciled 0.199"
    );
  });

  it.each([
    ["total value", { total_value: Number.NaN, reconciled_sum: 0.1, residual: 0 }],
    ["reconciled sum", { total_value: 0.1, reconciled_sum: Number.POSITIVE_INFINITY, residual: 0 }],
    ["residual", { total_value: 0.1, reconciled_sum: 0.1, residual: undefined }],
  ])("rejects a missing or non-finite historical risk %s", (_label, attributionSet) => {
    expect(() =>
      assertRiskAttributionReconciliation({
        ...attributionSet,
        quality_flags: [],
      })
    ).toThrow(/expected a finite number/);
  });

  it("rejects missing source quality flags instead of manufacturing an empty set", () => {
    expect(() =>
      assertRiskAttributionReconciliation({
        total_value: 0.1,
        reconciled_sum: 0.1,
        residual: 0,
      })
    ).toThrow("Historical risk quality flags expected an array.");
  });
});
