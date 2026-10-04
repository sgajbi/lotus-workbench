import { describe, expect, it } from "vitest";

import {
  buildPerformanceEvidenceAssuranceViewModel as buildAssuranceViewModel,
  type PerformanceEvidenceSelectionContext,
} from "../../src/apps/performance/evidence/performance-evidence-assurance-view-model";
import type { PerformanceEvidenceView } from "../../src/features/workbench/types";
import type { WorkspaceCapability } from "../../src/shell/workspace-capabilities";
import { getPerformanceReturnPathPresentation } from "../../src/apps/performance/components/performance-summary-context-helpers";
import { buildSupportedEvidencePerformanceScenario } from "../fixtures/performance-workspace-fixtures";

const supportedCapability: WorkspaceCapability = {
  state: "supported",
  reason: "Source evidence can be reviewed.",
};

const selectedContext: PerformanceEvidenceSelectionContext = {
  asOfDate: "2026-08-14",
  period: "YTD",
  basis: "NET",
  benchmarkCode: "BMK_PB_GLOBAL_BALANCED_60_40",
  contributionDimension: "asset_class",
  attributionDimension: "asset_class",
};

function buildPerformanceEvidenceAssuranceViewModel(
  capability: WorkspaceCapability,
  sourceEvidence: PerformanceEvidenceView,
  selectionOverrides: Partial<PerformanceEvidenceSelectionContext> = {}
) {
  return buildAssuranceViewModel(capability, sourceEvidence, {
    ...selectedContext,
    ...selectionOverrides,
  });
}

function evidence(overrides: Partial<PerformanceEvidenceView> = {}): PerformanceEvidenceView {
  return {
    state: "supported",
    as_of_date: "2026-08-14",
    period: "YTD",
    basis: "NET",
    benchmark_code: "BMK_PB_GLOBAL_BALANCED_60_40",
    calculation_scope: "performance_workspace",
    source_services: ["lotus-performance"],
    input_freshness: { performance: "fresh", benchmark: "fresh" },
    methodology_references: ["lotus-performance/docs/methodologies"],
    calculation_versions: { gateway_contract: "v1" },
    coverage: { supported_dimensions: ["asset_class"], unsupported_dimensions: [] },
    fallbacks: [],
    limitations: [],
    calculations: [
      {
        calculation_role: "workspace_summary",
        calculation_id: "calc-1",
        analytics_type: "WORKSPACE_SUMMARY",
        execution_status: "complete",
        lineage_status: "complete",
        stage_statuses: [],
        upstream_snapshots: [],
        artifacts: [{ artifact_name: "request.json", url: "/api/v1/evidence/request.json" }],
      },
    ],
    source_supportability: [
      {
        key: "source_calculation",
        state: "supported",
        freshness_bucket: "fresh",
        source_service: "lotus-performance",
      },
    ],
    ...overrides,
  };
}

describe("buildPerformanceEvidenceAssuranceViewModel", () => {
  function historySource(history: unknown, overrides: Record<string, unknown> = {}) {
    return evidence({ source_supportability: [{
      key: "source_calculation", state: "supported", freshness_bucket: "fresh",
      source_service: "lotus-performance", calculation_role: "workspace_summary",
      calculation_id: "calc-1", period_keys: ["1Y"], metric_basis: "NET",
      history_coverage: history, ...overrides,
    } as NonNullable<PerformanceEvidenceView["source_supportability"]>[number]] });
  }
  const partialHistory = {
    status: "partial", calculation_basis: "available_window",
    requested_start_date: "2025-01-10", requested_end_date: "2026-01-09",
    covered_start_date: "2026-01-05", covered_end_date: "2026-01-09",
    effective_start_date: "2026-01-05", effective_end_date: "2026-01-09",
    calendar_basis: "natural_days", missing_required_observation_count: 360,
    missing_required_observation_dates_sample: ["2025-01-10"],
    reason_codes: ["leading_history_missing"],
  };

  it("presents source-owned available-window history without changing source figures", () => {
    const payload = buildSupportedEvidencePerformanceScenario();
    payload.workspace.net_performance.portfolio_return_pct = 5.0;
    payload.workspace.evidence_view = historySource(partialHistory);
    const before = JSON.stringify(payload);
    const view = buildPerformanceEvidenceAssuranceViewModel(supportedCapability, payload.workspace.evidence_view);
    expect(view.history).toHaveLength(1);
    expect(view.history[0]).toMatchObject({
      title: "Portfolio performance summary history", status: "Partial history", tone: "warn",
      rows: expect.arrayContaining([
        { label: "Requested window", value: "10 Jan 2025 – 09 Jan 2026" },
        { label: "Effective window", value: "05 Jan 2026 – 09 Jan 2026" },
        { label: "Calculation window", value: "Available observations" },
        { label: "Missing observations", value: "360" },
      ]),
    });
    expect(view.state).toBe("incomplete");
    expect(JSON.stringify(payload)).toBe(before);
    expect(payload.workspace.net_performance.portfolio_return_pct).toBe(5.0);
    expect(getPerformanceReturnPathPresentation({
      summary: payload.workspace.net_performance, capabilities: payload.capabilities, reportingCurrency: "USD",
    }).portfolioReturnValue).toBe("5.00%");
    expect(view.supportGroups.flatMap(({ rows }) => rows)).toEqual(expect.arrayContaining([
      { label: "Calculation reference", value: "calc-1" },
      { label: "Result periods", value: "1Y" },
      { label: "Covered window", value: "05 Jan 2026 – 09 Jan 2026" },
      { label: "Observation calendar", value: "Natural days; venue calendar not attested" },
      { label: "Missing date sample", value: "10 Jan 2025" },
      { label: "History reason codes", value: "leading_history_missing" },
    ]));
  });

  it.each(["leading_history_missing", "interior_history_missing", "trailing_history_missing"])(
    "retains source gap reason %s without estimating history", (reason) => {
      const view = buildPerformanceEvidenceAssuranceViewModel(supportedCapability,
        historySource({ ...partialHistory, reason_codes: [reason] }));
      expect(view.history[0].status).toBe("Partial history");
      expect(view.supportGroups.flatMap(({ rows }) => rows)).toContainEqual({ label: "History reason codes", value: reason });
    });

  it("keeps complete and unknown histories distinct from execution completion", () => {
    const complete = { ...partialHistory, status: "complete", calculation_basis: "requested_window",
      covered_start_date: "2025-01-10", effective_start_date: "2025-01-10",
      missing_required_observation_count: 0, missing_required_observation_dates_sample: [],
      reason_codes: ["covered_window_matches_requested_window"] };
    const known = buildPerformanceEvidenceAssuranceViewModel(supportedCapability, historySource(complete));
    expect(known.history[0].status).toBe("Complete history");
    expect(known.state).toBe("ready");
    const unknown = buildPerformanceEvidenceAssuranceViewModel(supportedCapability,
      historySource({ ...partialHistory, status: "unknown", covered_start_date: null, covered_end_date: null,
        effective_start_date: null, effective_end_date: null }));
    expect(unknown.history[0].status).toBe("History unknown");
    expect(unknown.history[0].rows).toContainEqual({ label: "Effective window", value: "Not reported" });
    expect(unknown.state).toBe("incomplete");
  });

  it.each([null, undefined])("never turns absent/legacy history %s into completeness", (history) => {
    const view = buildPerformanceEvidenceAssuranceViewModel(supportedCapability, historySource(history));
    expect(view.history[0].status).toBe("History not reported");
    expect(view.history[0].tone).not.toBe("success");
  });

  it.each([
    { covered_start_date: "2020-01-01", covered_end_date: "2020-01-02", effective_start_date: "2020-01-01", effective_end_date: "2020-01-02" },
    { reason_codes: ["no_observations_in_requested_window"] },
    { effective_start_date: "2026-01-10", effective_end_date: "2026-01-11" },
    { covered_start_date: "2026-01-05", covered_end_date: "2026-01-09" },
    { reason_codes: ["interior_history_missing"] },
    { reason_codes: ["venue_calendar_not_attested"] },
  ])("refuses contradictory complete history %# without a complete badge", (contradiction) => {
    const view = buildPerformanceEvidenceAssuranceViewModel(supportedCapability, historySource({
      ...partialHistory, status: "complete", calculation_basis: "requested_window",
      covered_start_date: "2025-01-10", covered_end_date: "2026-01-09",
      effective_start_date: "2025-01-10", effective_end_date: "2026-01-09",
      missing_required_observation_count: 0, missing_required_observation_dates_sample: [],
      reason_codes: ["covered_window_matches_requested_window"], ...contradiction,
    }));
    expect(view.history[0].status).toBe("History not confirmed");
    expect(view.history[0].tone).toBe("warn");
    expect(view.history[0].rows).toEqual([]);
    expect(view.state).not.toBe("ready");
    expect(view.exceptions).toContainEqual(expect.objectContaining({ key: "performance-history-qualified" }));
  });

  it("preserves complete business-weekday coverage with wider observations and a weekend request", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(supportedCapability, historySource({
      ...partialHistory, status: "complete", calculation_basis: "requested_window", calendar_basis: "business_weekdays",
      requested_start_date: "2026-01-03", requested_end_date: "2026-01-09",
      covered_start_date: "2026-01-01", covered_end_date: "2026-01-12",
      effective_start_date: "2026-01-05", effective_end_date: "2026-01-09",
      missing_required_observation_count: 0, missing_required_observation_dates_sample: [],
      reason_codes: ["covered_window_matches_requested_window", "explicit_ignored_dates_applied", "beginning_market_value_baseline_applied"],
    }));
    expect(view.history[0].status).toBe("Complete history");
    expect(view.history[0].rows).toContainEqual({ label: "Requested window", value: "03 Jan 2026 – 09 Jan 2026" });
    expect(view.history[0].rows).toContainEqual({ label: "Effective window", value: "05 Jan 2026 – 09 Jan 2026" });
    expect(view.supportGroups.flatMap(({ rows }) => rows)).toContainEqual({ label: "Covered window", value: "01 Jan 2026 – 12 Jan 2026" });
    expect(view.state).toBe("ready");
  });

  it("retains unknown history with wholly disjoint supplied observations and no effective observations", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(supportedCapability, historySource({
      ...partialHistory, status: "unknown", covered_start_date: "2020-01-01", covered_end_date: "2020-01-02",
      effective_start_date: null, effective_end_date: null, missing_required_observation_count: 365,
      reason_codes: ["no_observations_in_requested_window"],
    }));
    expect(view.history[0].status).toBe("History unknown");
    expect(view.history[0].rows).toContainEqual({ label: "Effective window", value: "Not reported" });
    expect(view.supportGroups.flatMap(({ rows }) => rows)).toContainEqual({ label: "Covered window", value: "01 Jan 2020 – 02 Jan 2020" });
    expect(view.state).toBe("incomplete");
  });

  it.each([
    {}, { ...partialHistory, status: "COMPLETE" },
    { ...partialHistory, status: ["complete"] },
    { ...partialHistory, missing_required_observation_count: -1 },
    { ...partialHistory, missing_required_observation_count: "360" },
    { ...partialHistory, requested_start_date: "2025-02-30" },
    { ...partialHistory, calendar_basis: "bank_attested" },
    { ...partialHistory, reason_codes: ["invented_reason"] },
    { ...partialHistory, missing_required_observation_dates_sample: ["bad-date"] },
    { ...partialHistory, missing_required_observation_dates_sample: ["2020-01-01"] },
    { ...partialHistory, missing_required_observation_count: 1, missing_required_observation_dates_sample: ["2025-01-10", "2025-01-11"] },
    { ...partialHistory, status: "complete" },
  ])("refuses malformed or contradictory history %#", (history) => {
    const view = buildPerformanceEvidenceAssuranceViewModel(supportedCapability, historySource(history));
    expect(view.history[0].status).toBe("History not confirmed");
    expect(view.state).not.toBe("ready");
    expect(view.history[0].rows).toEqual([]);
  });

  it.each([{ calculation_id: "other" }, { calculation_role: "workspace_details" }, { metric_basis: "GROSS" }, { source_service: "other" }])(
    "does not attach qualification to mismatched identity or basis %j", (identity) => {
      const view = buildPerformanceEvidenceAssuranceViewModel(supportedCapability, historySource(partialHistory, identity));
      expect(view.history[0].status).toBe("History not confirmed");
      expect(view.history[0].rows).toEqual([]);
      expect(view.state).not.toBe("ready");
    });

  it("retains divergent history entries even for the same calculation", () => {
    const source = historySource(partialHistory);
    source.source_supportability!.push({ ...source.source_supportability![0],
      history_coverage: { ...partialHistory, status: "unknown" } } as NonNullable<PerformanceEvidenceView["source_supportability"]>[number]);
    const view = buildPerformanceEvidenceAssuranceViewModel(supportedCapability, source);
    expect(view.history.map(({ status }) => status)).toEqual(["Partial history", "History unknown"]);
    expect(new Set(view.history.map(({ key }) => key)).size).toBe(2);
  });

  it("does not bind empty roles or malformed basis even when both sides are unconfirmed", () => {
    const emptyRole = historySource(partialHistory, { calculation_role: "" });
    emptyRole.calculations[0].calculation_role = "";
    const malformedBasis = historySource(partialHistory, { metric_basis: 0 });
    malformedBasis.basis = "";
    for (const source of [emptyRole, malformedBasis]) {
      const view = buildPerformanceEvidenceAssuranceViewModel(supportedCapability, source);
      expect(view.history[0].status).toBe("History not confirmed");
      expect(view.history[0].rows).toEqual([]);
    }
  });

  it("presents evidence-generation instants in disclosed UTC and fails closed without a zone", () => {
    const ready = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({ generated_at: "2026-08-14T16:20:00+08:00" }),
    );
    const unzoned = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({ generated_at: "2026-08-14T16:20:00" }),
    );

    expect(ready.supportGroups.flatMap(({ rows }) => rows)).toContainEqual({
      label: "Generated at",
      value: "14 Aug 2026, 08:20 UTC",
    });
    expect(unzoned.supportGroups.flatMap(({ rows }) => rows)).toContainEqual({
      label: "Generated at",
      value: "Not reported",
    });
  });

  it("admits source-confirmed evidence only for internal review", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(supportedCapability, evidence());

    expect(view.state).toBe("ready");
    expect(view.posture).toBe("Ready for internal review");
    expect(view.summary).toContain("does not constitute client-release or regulatory approval");
    expect(view.metrics).toEqual([
      expect.objectContaining({ label: "Calculation coverage", value: "1 of 1" }),
      expect.objectContaining({ label: "Review items", value: "0" }),
      expect.objectContaining({ label: "Supporting records", value: "1" }),
  ]);
    expect(view.calculations[0]).toMatchObject({
      title: "Portfolio performance summary",
      calculationStatus: "Confirmed",
      evidenceStatus: "Confirmed",
      evidenceCount: 1,
    });
    expect(view.calculations[0].records[0]).toMatchObject({
      label: "Calculation input record",
      href: "/api/bff/api/v1/evidence/request.json",
    });
    expect(view.context).toContainEqual({ label: "Benchmark", value: "Assigned" });
  });

  it("distinguishes explicit review windows that share an end date", () => {
    const explicitEvidence = evidence({
      period: "EXPLICIT",
      report_start_date: "2026-01-01",
      report_end_date: "2026-08-14",
    });
    const matchingSelection = {
      period: "EXPLICIT",
      reportStartDate: "2026-01-01",
      reportEndDate: "2026-08-14",
    };

    expect(
      buildPerformanceEvidenceAssuranceViewModel(
        supportedCapability,
        explicitEvidence,
        matchingSelection
      ).state
    ).toBe("ready");

    const mismatched = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      explicitEvidence,
      { ...matchingSelection, reportStartDate: "2026-02-01" }
    );
    const mismatch = mismatched.exceptions.find(
      (exception) => exception.key === "selection-context-mismatch"
    );

    expect(mismatched.state).toBe("attention");
    expect(mismatch).toMatchObject({ tone: "danger" });
    expect(mismatch?.detail).toContain("review start date");
    expect(mismatch?.detail).not.toContain("2026-01-01");
    expect(mismatch?.detail).not.toContain("2026-02-01");
  });

  it("fails closed when source evidence omits explicit review-window boundaries", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({ period: "EXPLICIT" }),
      {
        period: "EXPLICIT",
        reportStartDate: "2026-01-01",
        reportEndDate: "2026-08-14",
      }
    );

    expect(view.state).toBe("attention");
    expect(view.exceptions).toContainEqual(
      expect.objectContaining({
        key: "explicit-review-window-unconfirmed",
        title: "Explicit review window not confirmed",
        tone: "danger",
      })
    );
  });

  it("fails closed when matching source and workspace periods are unrecognized", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({ period: "FUTURE" }),
      { period: "future" }
    );

    expect(view.state).toBe("attention");
    expect(view.posture).toBe("Needs attention");
    expect(view.exceptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "review-period-unrecognized",
          title: "Review period not supported",
          tone: "danger",
        }),
        expect.objectContaining({
          key: "active-review-period-unrecognized",
          title: "Selected review period not supported",
          tone: "danger",
        }),
      ])
    );
    expect(view.exceptions).not.toContainEqual(
      expect.objectContaining({ key: "selection-context-mismatch" })
    );
  });

  it("fails closed when an unrecognized source period differs from the active selection", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({ period: "FUTURE" })
    );

    expect(view.state).toBe("attention");
    expect(view.exceptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "review-period-unrecognized", tone: "danger" }),
        expect.objectContaining({ key: "selection-context-mismatch", tone: "danger" }),
      ])
    );
  });

  it.each([null, undefined, ""])(
    "fails closed without throwing when the active workspace period is %s",
    (period) => {
      const view = buildPerformanceEvidenceAssuranceViewModel(
        supportedCapability,
        evidence(),
        { period }
      );

      expect(view.state).toBe("attention");
      expect(view.exceptions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "active-review-period-missing",
            title: "Selected review period not confirmed",
            tone: "danger",
          }),
          expect.objectContaining({ key: "selection-context-mismatch", tone: "danger" }),
        ])
      );
    }
  );

  it.each(["MTD", "QTD", "YTD", "1Y", "3Y", "5Y", "SI"])(
    "admits matching canonical %s period evidence",
    (period) => {
      const view = buildPerformanceEvidenceAssuranceViewModel(
        supportedCapability,
        evidence({ period }),
        { period: period.toLowerCase() }
      );

      expect(view.state).toBe("ready");
      expect(view.exceptions).not.toContainEqual(
        expect.objectContaining({ key: expect.stringContaining("period") })
      );
    }
  );

  it("admits a matching mixed-case explicit period with complete boundaries", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({
        period: "eXpLiCiT",
        report_start_date: "2026-01-01",
        report_end_date: "2026-08-14",
      }),
      {
        period: "explicit",
        reportStartDate: "2026-01-01",
        reportEndDate: "2026-08-14",
      }
    );

    expect(view.state).toBe("ready");
    expect(view.exceptions).toHaveLength(0);
  });

  it("fails closed when the source publishes no calculations", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({ calculations: [] })
    );

    expect(view.state).toBe("incomplete");
    expect(view.posture).toBe("Incomplete evidence");
    expect(view.metrics[0].value).toBe("0 of 0");
    expect(view.exceptions).toContainEqual(
      expect.objectContaining({ title: "Calculation evidence not reported", tone: "warn" })
    );
    expect(view.metrics).toContainEqual(
      expect.objectContaining({ label: "Review items", value: "1" })
    );
  });

  it("preserves attention precedence when calculations are absent", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({ calculations: [], input_freshness: { performance: "stale" } })
    );

    expect(view.state).toBe("attention");
    expect(view.posture).toBe("Needs attention");
    expect(view.exceptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Calculation evidence not reported", tone: "warn" }),
        expect.objectContaining({ title: "Performance input evidence is not current", tone: "danger" }),
      ])
    );
  });

  it("makes pending calculation and lineage states explicit", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      { state: "partial", reason: "Evidence is pending." },
      evidence({
        state: "partial",
        calculations: [
          {
            ...evidence().calculations[0],
            execution_status: "running",
            lineage_status: "pending",
            artifacts: [],
          },
        ],
      })
    );

    expect(view.state).toBe("incomplete");
    expect(view.exceptions.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        "Evidence package incomplete",
        "Portfolio performance summary still in progress",
        "Portfolio performance summary evidence still being prepared",
      ])
    );
    expect(view.calculations[0]).toMatchObject({
      calculationStatus: "In progress",
      evidenceStatus: "In progress",
    });
  });

  it("escalates failed calculations and stale inputs as attention required", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({
        input_freshness: { performance: "stale" },
        calculations: [
          {
            ...evidence().calculations[0],
            execution_status: "failed",
            lineage_status: "unavailable",
          },
        ],
      })
    );

    expect(view.state).toBe("attention");
    expect(view.posture).toBe("Needs attention");
    expect(view.exceptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Portfolio performance summary did not complete", tone: "danger" }),
        expect.objectContaining({ title: "Portfolio performance summary evidence unavailable", tone: "danger" }),
        expect.objectContaining({ title: "Performance input evidence is not current", tone: "danger" }),
      ])
    );
  });

  it.each([
    ["failed", "attention", "Portfolio performance summary stage did not complete", "danger", "Needs attention", "danger"],
    ["running", "incomplete", "Portfolio performance summary stage still in progress", "warn", "In progress", "warn"],
    ["unexpected", "incomplete", "Portfolio performance summary stage status not reported", "warn", "Not confirmed", "default"],
  ] as const)(
    "fails closed when a published calculation stage is %s",
    (
      stageStatus,
      expectedState,
      expectedTitle,
      expectedTone,
      expectedCalculationStatus,
      expectedCalculationTone
    ) => {
      const source = evidence();
      source.calculations[0].stage_statuses = [
        {
          stage_name: "internal_stage_code",
          status: stageStatus,
        },
      ];

      const view = buildPerformanceEvidenceAssuranceViewModel(supportedCapability, source);

      expect(view.state).toBe(expectedState);
      expect(view.exceptions).toContainEqual(
        expect.objectContaining({ title: expectedTitle, tone: expectedTone })
      );
      expect(view.calculations[0]).toMatchObject({
        calculationStatus: expectedCalculationStatus,
        calculationTone: expectedCalculationTone,
      });
      expect(view.metrics).toContainEqual(
        expect.objectContaining({ label: "Calculation coverage", value: "0 of 1" })
      );
      expect(JSON.stringify(view.exceptions)).not.toContain("internal_stage_code");
      expect(JSON.stringify(view.supportGroups)).toContain("internal_stage_code");
    }
  );

  it("identifies each affected calculation in lifecycle review items", () => {
    const summaryCalculation = {
      ...evidence().calculations[0],
      calculation_id: "calc-summary",
      calculation_role: "workspace_summary",
      execution_status: "failed",
    };
    const detailCalculation = {
      ...evidence().calculations[0],
      calculation_id: "calc-details",
      calculation_role: "workspace_details",
      execution_status: "failed",
    };

    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({ calculations: [summaryCalculation, detailCalculation] })
    );

    expect(view.exceptions.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        "Portfolio performance summary did not complete",
        "Performance analysis detail did not complete",
      ])
    );
    expect(JSON.stringify(view.exceptions)).not.toContain("calc-summary");
    expect(JSON.stringify(view.exceptions)).not.toContain("calc-details");
  });

  it.each([
    ["500", "attention", "Portfolio performance summary upstream evidence 1 unavailable", "danger", "Needs attention", "danger"],
    ["processing", "incomplete", "Portfolio performance summary upstream evidence 1 retrieval in progress", "warn", "In progress", "warn"],
    ["unexpected", "incomplete", "Portfolio performance summary upstream evidence 1 status not confirmed", "warn", "Not confirmed", "default"],
  ] as const)(
    "fails closed when upstream retrieval reports %s",
    (
      retrievalStatus,
      expectedState,
      expectedTitle,
      expectedTone,
      expectedEvidenceStatus,
      expectedEvidenceTone
    ) => {
      const source = evidence();
      source.calculations[0].upstream_snapshots = [
        {
          upstream_endpoint: "/internal/source/path",
          source_identifier: "internal-source-id",
          as_of_date: "2026-08-14",
          retrieval_status: retrievalStatus,
        },
      ];

      const view = buildPerformanceEvidenceAssuranceViewModel(supportedCapability, source);

      expect(view.state).toBe(expectedState);
      expect(view.exceptions).toContainEqual(
        expect.objectContaining({ title: expectedTitle, tone: expectedTone })
      );
      expect(view.calculations[0]).toMatchObject({
        evidenceStatus: expectedEvidenceStatus,
        evidenceTone: expectedEvidenceTone,
      });
      expect(view.metrics).toContainEqual(
        expect.objectContaining({ label: "Calculation coverage", value: "0 of 1" })
      );
      expect(JSON.stringify(view.exceptions)).not.toContain("/internal/source/path");
      expect(JSON.stringify(view.exceptions)).not.toContain("internal-source-id");
      expect(JSON.stringify(view.supportGroups)).toContain("internal-source-id");
    }
  );

  it("accepts an explicitly successful upstream retrieval", () => {
    const source = evidence();
    source.calculations[0].upstream_snapshots = [
      {
        upstream_endpoint: "/internal/source/path",
        source_identifier: "internal-source-id",
        as_of_date: "2026-08-14",
        retrieval_status: "200",
      },
    ];

    const view = buildPerformanceEvidenceAssuranceViewModel(supportedCapability, source);

    expect(view.state).toBe("ready");
    expect(view.exceptions).toHaveLength(0);
  });

  it("excludes successful retrievals with incomplete upstream context from confirmed coverage", () => {
    const source = evidence();
    source.calculations[0].upstream_snapshots = [
      {
        upstream_endpoint: "/internal/source/path",
        source_identifier: "",
        as_of_date: "2026-08-14",
        retrieval_status: "200",
      },
    ];

    const view = buildPerformanceEvidenceAssuranceViewModel(supportedCapability, source);

    expect(view.state).toBe("incomplete");
    expect(view.calculations[0]).toMatchObject({
      evidenceStatus: "Not confirmed",
      evidenceTone: "default",
    });
    expect(view.metrics).toContainEqual(
      expect.objectContaining({ label: "Calculation coverage", value: "0 of 1" })
    );
    expect(view.exceptions).toContainEqual(
      expect.objectContaining({
        title: "Portfolio performance summary upstream evidence 1 context not confirmed",
        tone: "warn",
      })
    );
    expect(JSON.stringify(view.exceptions)).not.toContain("/internal/source/path");
  });

  it("qualifies fallbacks, limitations, unsupported coverage, and partial source supportability", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({
        fallbacks: ["fallback_internal_code"],
        limitations: ["Source data window limited"],
        coverage: { supported_dimensions: ["asset_class"], unsupported_dimensions: ["issuer"] },
        source_supportability: [
          { key: "source_calculation", state: "partial", reason: "source_internal_reason" },
        ],
      })
    );

    expect(view.state).toBe("incomplete");
    expect(view.exceptions.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        "Alternate calculation path applied",
        "Source limitation applies",
        "Evidence coverage is limited",
        "Calculation available with limitations",
      ])
    );
    expect(view.exceptions.map((item) => item.detail).join(" ")).not.toContain(
      "fallback_internal_code"
    );
    expect(view.supportGroups.flatMap((group) => group.rows).map((row) => row.value)).toEqual(
      expect.arrayContaining([
        "fallback_internal_code",
        "Source data window limited",
        "source_internal_reason",
      ])
    );
  });

  it("fails closed when source coverage omits the selected analytical dimensions", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({
        coverage: {
          supported_dimensions: ["asset_class"],
          unsupported_dimensions: [],
        },
      }),
      {
        contributionDimension: "issuer",
        attributionDimension: "country",
      }
    );

    expect(view.state).toBe("incomplete");
    expect(view.exceptions).toContainEqual(
      expect.objectContaining({
        key: "selected-dimension-coverage-unconfirmed",
        title: "Selected analytical coverage not confirmed",
        tone: "warn",
      })
    );
    expect(
      view.exceptions.find(
        (exception) => exception.key === "selected-dimension-coverage-unconfirmed"
      )?.detail
    ).toContain("Issuer, Country");
  });

  it("accepts ready source aliases but gives stale freshness precedence", () => {
    const ready = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({
        source_supportability: [
          {
            key: "source_calculation",
            state: "ready",
            freshness_bucket: "fresh",
            source_service: "lotus-performance",
          },
        ],
      })
    );
    const stale = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({
        source_supportability: [
          {
            operation: "performance.attribution",
            state: "supported",
            freshness_bucket: "stale",
            source_service: "lotus-performance",
            reason: "Source data window is stale.",
          },
        ],
      })
    );

    expect(ready.state).toBe("ready");
    expect(stale.state).toBe("attention");
    expect(stale.exceptions).toContainEqual(
      expect.objectContaining({
        title: "Source calculation evidence is not current",
        tone: "danger",
      })
    );
    const supportRows = stale.supportGroups.flatMap((group) => group.rows);
    expect(supportRows).toEqual(
      expect.arrayContaining([
        { label: "Source 1", value: "lotus-performance" },
        { label: "Source 1 freshness", value: "stale" },
        { label: "Source 1 reason", value: "Source data window is stale." },
        { label: "Source 1 reference", value: "performance.attribution" },
      ])
    );
  });

  it("rejects anonymous ready source-supportability assessments", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({
        source_supportability: [
          {
            state: "ready",
            freshness_bucket: "fresh",
          },
        ],
      })
    );

    expect(view.state).toBe("incomplete");
    expect(view.posture).toBe("Incomplete evidence");
    expect(view.exceptions).toContainEqual(
      expect.objectContaining({
        key: "source-supportability-identity-0",
        title: "Calculation reference not confirmed",
        tone: "warn",
      })
    );
    expect(view.supportGroups.flatMap((group) => group.rows)).toEqual(
      expect.arrayContaining([
        { label: "Source 1", value: "Not reported" },
        { label: "Source 1 reference", value: "Not reported" },
      ])
    );
  });

  it.each([
    ["missing", undefined],
    ["unknown", "unknown"],
  ] as const)("fails closed when ready source freshness is %s", (_label, freshnessBucket) => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({
        source_supportability: [
          {
            key: "source_calculation",
            state: "supported",
            freshness_bucket: freshnessBucket,
            source_service: "lotus-performance",
          },
        ],
      })
    );

    expect(view.state).toBe("incomplete");
    expect(view.exceptions).toContainEqual(
      expect.objectContaining({
        title: "Source calculation freshness not confirmed",
        tone: "warn",
      })
    );
  });

  it("reports an explicit exception when the evidence package is unavailable", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({ state: "unavailable", reason: "Evidence source unavailable." })
    );

    expect(view.state).toBe("unavailable");
    expect(view.metrics).toContainEqual(
      expect.objectContaining({ label: "Review items", value: "1" })
    );
    expect(view.exceptions).toContainEqual(
      expect.objectContaining({ title: "Evidence package unavailable", tone: "danger" })
    );
  });

  it("maps malformed and unknown source states to neutral incomplete posture", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({
        state: "mystery_state",
        input_freshness: { performance: "mystery_freshness" },
        calculations: [
          {
            ...evidence().calculations[0],
            calculation_role: "new_unmapped_role",
            execution_status: "mystery_execution",
            lineage_status: null,
          },
        ],
      })
    );

    expect(view.state).toBe("incomplete");
    expect(view.posture).toBe("Incomplete evidence");
    expect(view.calculations[0]).toMatchObject({
      title: "Additional performance calculation 1",
      calculationStatus: "Not confirmed",
      evidenceStatus: "Not confirmed",
    });
    expect(view.exceptions.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        "Assurance status not reported",
        "Performance input freshness not confirmed",
        "Additional performance calculation 1 status not reported",
        "Additional performance calculation 1 evidence not confirmed",
      ])
    );
  });

  it.each([
    ["reporting date", { as_of_date: null }, "Reporting date not confirmed"],
    ["review period", { period: null }, "Review period not confirmed"],
    ["return basis", { basis: "unrecognised" }, "Return basis not confirmed"],
  ] as const)("fails closed when %s is not confirmed", (_label, overrides, title) => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence(overrides)
    );

    expect(view.state).toBe("incomplete");
    expect(view.exceptions).toContainEqual(expect.objectContaining({ title, tone: "warn" }));
  });

  it.each([
    ["missing", null],
    ["different", "portfolio_report"],
  ])("fails closed when calculation assurance scope is %s", (_label, calculationScope) => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({ calculation_scope: calculationScope })
    );

    expect(view.state).toBe("attention");
    expect(view.posture).toBe("Needs attention");
    expect(view.exceptions).toContainEqual(
      expect.objectContaining({
        title: "Calculation assurance scope not confirmed",
        tone: "danger",
      })
    );
    expect(JSON.stringify(view.exceptions)).not.toContain("portfolio_report");
  });

  it("fails closed when source-owned calculation provenance is incomplete", () => {
    const calculation = evidence().calculations[0];
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({
        source_services: [],
        calculation_versions: {},
        calculations: [
          {
            ...calculation,
            calculation_id: "",
            calculation_role: "",
            upstream_snapshots: [
              {
                upstream_endpoint: "",
                source_identifier: "",
                as_of_date: "",
                retrieval_status: "200",
              },
            ],
          },
        ],
      })
    );

    expect(view.state).toBe("incomplete");
    expect(view.exceptions.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        "Evidence source not confirmed",
        "Calculation version not confirmed",
        "Additional performance calculation 1 reference not confirmed",
        "Additional performance calculation 1 purpose not confirmed",
        "Additional performance calculation 1 upstream evidence 1 context not confirmed",
      ])
    );
  });

  it("keeps an unrecognized calculation role explicitly unconfirmed", () => {
    const calculation = evidence().calculations[0];
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({
        calculations: [{ ...calculation, calculation_role: "new_unmapped_role" }],
      })
    );

    expect(view.state).toBe("incomplete");
    expect(view.exceptions).toContainEqual(
      expect.objectContaining({
        title: "Additional performance calculation 1 purpose not confirmed",
        tone: "warn",
      })
    );
    expect(view.calculations[0]).toMatchObject({
      title: "Additional performance calculation 1",
      purpose: "Business purpose not confirmed by the source.",
      calculationStatus: "Not confirmed",
      calculationTone: "default",
    });
    expect(JSON.stringify({ exceptions: view.exceptions, calculations: view.calculations })).not.toContain(
      "new_unmapped_role"
    );
    expect(JSON.stringify(view.supportGroups)).toContain("new_unmapped_role");
  });

  it("rejects evidence that does not match the active source-confirmed selection", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({
        as_of_date: "2026-08-13",
        period: "1Y",
        basis: "GROSS",
        benchmark_code: "BMK_OTHER",
      })
    );

    expect(view.state).toBe("attention");
    expect(view.exceptions).toContainEqual(
      expect.objectContaining({
        title: "Evidence context does not match the active selection",
        detail: expect.stringContaining("reporting date, review period, return basis, benchmark assignment"),
        tone: "danger",
      })
    );
    expect(JSON.stringify(view.exceptions)).not.toContain("BMK_OTHER");
  });

  it("fails closed when the source omits input freshness evidence", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({ input_freshness: null })
    );

    expect(view.state).toBe("incomplete");
    expect(view.exceptions).toContainEqual(
      expect.objectContaining({ title: "Input freshness not confirmed", tone: "warn" })
    );
  });

  it("requires freshness for an assigned benchmark", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({ input_freshness: { performance: "fresh" } })
    );

    expect(view.state).toBe("incomplete");
    expect(view.exceptions).toContainEqual(
      expect.objectContaining({ title: "Benchmark input freshness not confirmed", tone: "warn" })
    );
  });

  it("identifies each selected input with qualified freshness", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({ input_freshness: { performance: "stale", benchmark: "unknown" } })
    );

    expect(view.exceptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Performance input evidence is not current" }),
        expect.objectContaining({ title: "Benchmark input freshness not confirmed" }),
      ])
    );
  });

  it("escalates an explicitly unavailable selected input", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({ input_freshness: { performance: "fresh", benchmark: "unavailable" } })
    );

    expect(view.state).toBe("attention");
    expect(view.exceptions).toContainEqual(
      expect.objectContaining({ title: "Benchmark input unavailable", tone: "danger" })
    );
  });

  it("does not require benchmark freshness when no benchmark is assigned", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({
        benchmark_code: null,
        input_freshness: { performance: "fresh", benchmark: "unavailable" },
      }),
      { benchmarkCode: null }
    );

    expect(view.state).toBe("ready");
    expect(view.context).toContainEqual({ label: "Benchmark", value: "Not assigned" });
  });

  it("preserves danger severity for duplicate source operations", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence({
        source_supportability: [
          {
            operation: "performance.attribution",
            source_service: "lotus-performance",
            state: "partial",
            freshness_bucket: "fresh",
          },
          {
            operation: "performance.attribution",
            source_service: "lotus-performance",
            state: "blocked",
            freshness_bucket: "fresh",
          },
        ],
      })
    );

    expect(view.state).toBe("attention");
    expect(view.exceptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Calculation available with limitations",
          tone: "warn",
        }),
        expect.objectContaining({ title: "Source calculation unavailable", tone: "danger" }),
      ])
    );
  });

  it.each(["", "new_source_state"])(
    "does not claim calculation availability for the unrecognised %j state",
    (state) => {
      const view = buildPerformanceEvidenceAssuranceViewModel(
        supportedCapability,
        evidence({
          source_supportability: [
            {
              operation: "performance.summary",
              source_service: "lotus-performance",
              state,
              freshness_bucket: "fresh",
            },
          ],
        })
      );

      expect(view.state).toBe("incomplete");
      expect(view.exceptions).toContainEqual(
        expect.objectContaining({
          title: "Calculation availability not confirmed",
          detail: "The calculation availability state is not recognised.",
          tone: "warn",
        })
      );
      expect(view.exceptions).not.toContainEqual(
        expect.objectContaining({ title: "Calculation available with limitations" })
      );
    }
  );

  it.each([
    ["coverage", { coverage: null }, "Evidence coverage not confirmed"],
    [
      "calculation availability",
      { source_supportability: [] as NonNullable<PerformanceEvidenceView["source_supportability"]> },
      "Calculation availability not confirmed",
    ],
    [
      "methodology",
      { methodology_references: [] as string[] },
      "Methodology reference not confirmed",
    ],
    [
      "supporting records",
      {
        calculations: [
          { ...evidence().calculations[0], artifacts: [] },
        ] as PerformanceEvidenceView["calculations"],
      },
      "Portfolio performance summary supporting records not published",
    ],
  ] as const)("fails closed when %s evidence is absent", (_label, overrides, title) => {
    const view = buildPerformanceEvidenceAssuranceViewModel(
      supportedCapability,
      evidence(overrides)
    );

    expect(view.state).toBe("incomplete");
    expect(view.exceptions).toContainEqual(
      expect.objectContaining({ title, tone: "warn" })
    );
  });

  it("keeps raw identifiers and technical vocabulary in support groups only", () => {
    const view = buildPerformanceEvidenceAssuranceViewModel(supportedCapability, evidence());
    const primaryText = JSON.stringify({
      posture: view.posture,
      summary: view.summary,
      context: view.context,
      exceptions: view.exceptions,
      calculations: view.calculations.map((calculation) => ({
        title: calculation.title,
        purpose: calculation.purpose,
        calculationStatus: calculation.calculationStatus,
        evidenceStatus: calculation.evidenceStatus,
        records: calculation.records.map((record) => ({
          label: record.label,
          support: record.support,
        })),
      })),
    });
    const supportText = JSON.stringify(view.supportGroups);

    expect(primaryText).not.toContain("lotus-performance");
    expect(primaryText).not.toContain("calc-1");
    expect(primaryText).not.toContain("WORKSPACE_SUMMARY");
    expect(primaryText).not.toContain("gateway_contract");
    expect(primaryText).not.toContain("BMK_PB_GLOBAL_BALANCED_60_40");
    expect(supportText).toContain("lotus-performance");
    expect(supportText).toContain("calc-1");
    expect(supportText).toContain("WORKSPACE_SUMMARY");
    expect(supportText).toContain("gateway_contract");
    expect(supportText).toContain("BMK_PB_GLOBAL_BALANCED_60_40");
  });

  it("preserves the governed archived-document download route", () => {
    const source = evidence();
    source.calculations[0].artifacts = [
      {
        artifact_name: "portfolio-review.pdf",
        url: "/api/v1/documents/doc-1/download",
        archive_document_id: "doc-1",
        archive_document_download_url: "/api/bff/api/v1/documents/doc-1/download",
      },
    ];

    const view = buildPerformanceEvidenceAssuranceViewModel(supportedCapability, source);
    expect(view.calculations[0].records[0]).toMatchObject({
      label: "Archived evidence document",
      href: "/api/bff/api/v1/documents/doc-1/download",
    });
  });

  it("fails closed when a supporting record is outside the governed Workbench boundary", () => {
    const source = evidence();
    source.calculations[0].artifacts = [
      {
        artifact_name: "request.json",
        url: "javascript:alert('unsafe')",
      },
    ];

    const view = buildPerformanceEvidenceAssuranceViewModel(supportedCapability, source);

    expect(view.state).toBe("attention");
    expect(view.calculations[0].records[0]).toMatchObject({
      label: "Calculation input record",
      href: null,
    });
    expect(view.calculations[0]).toMatchObject({
      evidenceStatus: "Needs attention",
      evidenceTone: "danger",
    });
    expect(view.metrics).toContainEqual(
      expect.objectContaining({ label: "Calculation coverage", value: "0 of 1" })
    );
    expect(view.exceptions).toContainEqual(
      expect.objectContaining({
        title: "Portfolio performance summary supporting record 1 route unavailable",
        tone: "danger",
      })
    );
  });

  it("does not confirm evidence coverage when no supporting record is published", () => {
    const source = evidence();
    source.calculations[0].artifacts = [];

    const view = buildPerformanceEvidenceAssuranceViewModel(supportedCapability, source);

    expect(view.calculations[0]).toMatchObject({
      evidenceStatus: "Not confirmed",
      evidenceTone: "default",
      evidenceCount: 0,
    });
    expect(view.metrics).toContainEqual(
      expect.objectContaining({ label: "Calculation coverage", value: "0 of 1" })
    );
  });
});
