import { describe, expect, it } from "vitest";

import {
  PERFORMANCE_REFRESH_COPY,
  getPerformanceFeeBasisLabel,
  getPerformanceReturnPathTitle,
  normalizePerformanceActionLabel,
  normalizePerformanceMetricLabel,
  PERFORMANCE_ACTION_LABELS,
  PERFORMANCE_CONTEXT_LABELS,
  PERFORMANCE_EVIDENCE_LABELS,
  PERFORMANCE_ECONOMICS_LABELS,
  PERFORMANCE_FEE_BASIS_LABELS,
  PERFORMANCE_RETURN_DEFINITIONS,
  PERFORMANCE_RETURN_LABELS,
  PERFORMANCE_RETURN_TABLE_LABELS,
  PERFORMANCE_WORKFLOW_LABELS,
} from "../../src/apps/performance/performance-terminology";

describe("performance terminology", () => {
  it("keeps return methodology separate from fee basis", () => {
    expect(PERFORMANCE_RETURN_LABELS).toEqual({
      timeWeightedReturn: "Time-weighted return (TWR)",
      portfolioTwr: "Portfolio TWR",
      benchmarkTwr: "Benchmark TWR",
      activeReturn: "Active return",
      moneyWeightedReturn: "Money-weighted return (MWR)",
    });
    expect(PERFORMANCE_FEE_BASIS_LABELS).toEqual({
      net: "Net of fees",
      gross: "Gross of fees",
      unavailable: "Fee basis not confirmed",
    });
  });

  it.each([
    ["NET", "Net of fees"],
    [" net ", "Net of fees"],
    ["GROSS", "Gross of fees"],
    ["gross", "Gross of fees"],
    ["", "Fee basis not confirmed"],
    ["unknown", "Fee basis not confirmed"],
  ])("maps source fee basis %s without treating it as a return method", (basis, expected) => {
    expect(getPerformanceFeeBasisLabel(basis)).toBe(expected);
  });

  it("builds a method-first return-path title", () => {
    expect(getPerformanceReturnPathTitle("NET")).toBe(
      "Time-weighted return path · Net of fees",
    );
    expect(getPerformanceReturnPathTitle("GROSS")).toBe(
      "Time-weighted return path · Gross of fees",
    );
  });

  it("defines TWR and MWR as different source-owned methods", () => {
    expect(PERFORMANCE_RETURN_DEFINITIONS.timeWeightedReturn).toContain(
      "removing the effect of the timing and size of external cash flows",
    );
    expect(PERFORMANCE_RETURN_DEFINITIONS.moneyWeightedReturn).toContain(
      "reflects the timing and size of external cash flows",
    );
  });

  it("provides compact table labels without losing method or economics meaning", () => {
    expect(PERFORMANCE_RETURN_TABLE_LABELS).toMatchObject({
      segmentTwr: "TWR",
      netTwr: "Net TWR",
      grossTwr: "Gross TWR",
      annualisedNetTwr: "Annualised net TWR",
      annualisedGrossTwr: "Annualised gross TWR",
    });
    expect(PERFORMANCE_ECONOMICS_LABELS).toEqual({
      openingMarketValue: "Opening market value",
      endingMarketValue: "Ending market value",
      flowAdjustedMarketValue: "Flow-adjusted market value",
      openingCashFlow: "Opening cash flow",
      closingCashFlow: "Closing cash flow",
      netCashFlow: "Net cash flow",
    });
  });

  it.each([
    ["Portfolio Return", "Portfolio TWR"],
    [" benchmark return ", "Benchmark TWR"],
    ["ACTIVE RETURN", "Active return"],
    ["MWR", "Money-weighted return (MWR)"],
    ["Ending MV", "Ending market value"],
    ["Net Flow", "Net cash flow"],
    ["HHI Current", "HHI Current"],
  ])("normalizes known source label %s while preserving unknown evidence", (source, expected) => {
    expect(normalizePerformanceMetricLabel(source)).toBe(expected);
  });

  it.each([
    ["Open Return Path", "Open return path"],
    [" review contribution ", "Review contribution"],
    ["Draft Advisor Brief", "Draft adviser brief"],
    ["Review Risk Surface", "Review risk"],
    ["Return to Summary", "Return to performance overview"],
    ["Open risk", "Open risk"],
  ])("normalizes known action label %s while preserving unknown actions", (source, expected) => {
    expect(normalizePerformanceActionLabel(source)).toBe(expected);
  });

  it("owns the canonical Performance workflow actions", () => {
    expect(PERFORMANCE_ACTION_LABELS).toEqual({
      openReturnPath: "Open return path",
      reviewContribution: "Review contribution",
      inspectAttribution: "Inspect attribution",
      openAnalysis: "Open analysis",
      draftAdviserBrief: "Draft adviser brief",
      openAdviserBrief: "Open adviser brief",
      reviewRisk: "Review risk",
      returnToOverview: "Return to performance overview",
    });
  });

  it("owns consistent workflow and review-context language", () => {
    expect(PERFORMANCE_REFRESH_COPY).toMatchObject({
      recheckAction: "Recheck performance",
      recheckingAction: "Rechecking…",
      retryAction: "Recheck performance evidence",
      recheck: {
        pending: { title: "Rechecking performance evidence" },
        confirmed: { title: "Performance evidence rechecked" },
        failed: { title: "Performance evidence could not be rechecked" },
      },
    });
    expect(PERFORMANCE_EVIDENCE_LABELS).toEqual({
      needsAttention: "Needs attention",
    });
    expect(PERFORMANCE_WORKFLOW_LABELS).toEqual({
      overview: "Performance overview",
      analysis: "Performance analysis",
      adviserBrief: "Adviser brief",
      riskReview: "Risk review",
    });
    expect(PERFORMANCE_CONTEXT_LABELS).toEqual({
      reviewWindow: "Review window",
      feeBasis: "Fee basis",
      asOfDate: "As-of date",
    });
  });
});
