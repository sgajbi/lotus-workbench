import { describe, expect, it } from "vitest";

import {
  allocationWeightTotal,
  compareAllocationValues,
  ALLOCATION_CHART_TYPES,
  ALLOCATION_COLORS,
  ALLOCATION_DIMENSIONS,
  describeAllocationArc,
  formatAllocationDimensionLabel,
  isDirectLookThroughFallbackConfirmed,
  isExpandedLookThroughSupported,
  normalizeLookThroughMode,
  roundSvgCoordinate,
} from "../../src/apps/portfolio/portfolio-allocation-view-model";

describe("portfolio allocation view model", () => {
  it("withholds totals with any unknown weight and retains signed totals", () => {
    const buckets = [120, -20].map((weight_pct, index) => ({ bucket: String(index), position_count: 1, market_value_base: weight_pct, weight_pct }));
    expect(allocationWeightTotal(buckets)).toBe(100);
    expect(allocationWeightTotal([{ ...buckets[0], weight_pct: null }, buckets[1]])).toBeNull();
    expect(allocationWeightTotal([{ ...buckets[0], weight_pct: 0 }])).toBe(0);
    expect(allocationWeightTotal([])).toBeNull();
  });
  it("keeps unknown amounts after known zero and negative values without substituting zero", () => {
    const values = [null, -20, 0, 120, null];
    expect(values.sort(compareAllocationValues)).toEqual([120, 0, -20, null, null]);
  });
  it("keeps supported dimensions and chart types explicit", () => {
    expect(ALLOCATION_DIMENSIONS.map((dimension) => dimension.key)).toEqual([
      "asset_class",
      "currency",
      "sector",
      "region",
    ]);
    expect(ALLOCATION_CHART_TYPES.map((chartType) => chartType.key)).toEqual([
      "donut",
      "bar",
      "table",
    ]);
    expect(ALLOCATION_COLORS.length).toBeGreaterThanOrEqual(5);
  });

  it("formats allocation dimension labels from contract keys", () => {
    expect(formatAllocationDimensionLabel("asset_class")).toBe("Asset Class");
    expect(formatAllocationDimensionLabel("custom_segment")).toBe(
      "Custom Segment",
    );
  });

  it("normalizes look-through mode and support posture", () => {
    expect(normalizeLookThroughMode("prefer_look_through")).toBe(
      "prefer_look_through",
    );
    expect(normalizeLookThroughMode("unknown", "prefer_look_through")).toBe(
      "prefer_look_through",
    );
    expect(normalizeLookThroughMode(null)).toBe("direct_only");

    expect(isExpandedLookThroughSupported(null)).toBe(false);
    expect(
      isExpandedLookThroughSupported({
        requested_mode: "prefer_look_through",
        effective_mode: "direct_only",
        applied: false,
      }),
    ).toBe(false);
    expect(
      isExpandedLookThroughSupported({
        requested_mode: "prefer_look_through",
        effective_mode: "prefer_look_through",
        applied: false,
      }),
    ).toBe(false);
    expect(
      isExpandedLookThroughSupported({
        requested_mode: "prefer_look_through",
        effective_mode: "direct_only",
        applied: true,
      }),
    ).toBe(false);
    expect(
      isExpandedLookThroughSupported({
        requested_mode: "prefer_look_through",
        effective_mode: "prefer_look_through",
        applied: true,
      }),
    ).toBe(true);
    expect(
      isExpandedLookThroughSupported({
        requested_mode: "direct_only",
        effective_mode: "prefer_look_through",
        applied: true,
      }),
    ).toBe(false);

    expect(isDirectLookThroughFallbackConfirmed(null)).toBe(false);
    expect(
      isDirectLookThroughFallbackConfirmed({
        requested_mode: "prefer_look_through",
        effective_mode: "direct_only",
        applied: false,
      }),
    ).toBe(true);
    expect(
      isDirectLookThroughFallbackConfirmed({
        requested_mode: "direct_only",
        effective_mode: "direct_only",
        applied: false,
      }),
    ).toBe(false);
  });

  it("builds deterministic allocation donut arc geometry", () => {
    expect(roundSvgCoordinate(1.23456)).toBe(1.2346);
    expect(describeAllocationArc(110, 110, 86, 58, -90, 90)).toBe(
      "M 196 110 A 86 86 0 0 0 24 110 L 52 110 A 58 58 0 0 1 168 110 Z",
    );
    expect(describeAllocationArc(110, 110, 86, 58, -90, 300)).toContain(
      "A 86 86 0 1 0",
    );
  });
});
