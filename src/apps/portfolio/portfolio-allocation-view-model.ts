import type { PortfolioLookThroughMode } from "./api";
import type { PortfolioAllocationLookThrough, PortfolioAllocationView } from "./types";

export function allocationWeightTotal(buckets: PortfolioAllocationView["buckets"]): number | null {
  if (!buckets.length || buckets.some((b) => b.weight_pct === null)) return null;
  return buckets.reduce((sum, b) => sum + b.weight_pct!, 0);
}

export function compareAllocationValues(left: number | null, right: number | null): number {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return right - left;
}

export const ALLOCATION_DIMENSIONS = [
  { key: "asset_class", label: "Asset Class" },
  { key: "currency", label: "Currency" },
  { key: "sector", label: "Sector" },
  { key: "region", label: "Region" },
] as const;

export const ALLOCATION_CHART_TYPES = [
  { key: "donut", label: "Composition" },
  { key: "bar", label: "Comparison" },
  { key: "table", label: "Table" },
] as const;

export const ALLOCATION_COLORS = [
  "#1d4ed8",
  "#0f766e",
  "#7c3aed",
  "#c2410c",
  "#475569",
  "#0f766e",
] as const;

export type AllocationChartType =
  (typeof ALLOCATION_CHART_TYPES)[number]["key"];
export type AllocationDimension = (typeof ALLOCATION_DIMENSIONS)[number]["key"];

export function formatAllocationDimensionLabel(value: string): string {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function normalizeLookThroughMode(
  value: string | null | undefined,
  fallback: PortfolioLookThroughMode = "direct_only",
): PortfolioLookThroughMode {
  return value === "prefer_look_through" ? "prefer_look_through" : fallback;
}

export function isExpandedLookThroughSupported(
  lookThrough: PortfolioAllocationLookThrough | null,
): boolean {
  if (!lookThrough) {
    return false;
  }
  return (
    lookThrough.requested_mode === "prefer_look_through" &&
    lookThrough.effective_mode === "prefer_look_through" &&
    lookThrough.applied
  );
}

export function isDirectLookThroughFallbackConfirmed(
  lookThrough: PortfolioAllocationLookThrough | null,
): boolean {
  return (
    lookThrough?.requested_mode === "prefer_look_through" &&
    lookThrough.effective_mode === "direct_only" &&
    !lookThrough.applied
  );
}

export function describeAllocationArc(
  x: number,
  y: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  const startOuter = polarToCartesian(x, y, outerRadius, endAngle);
  const endOuter = polarToCartesian(x, y, outerRadius, startAngle);
  const startInner = polarToCartesian(x, y, innerRadius, endAngle);
  const endInner = polarToCartesian(x, y, innerRadius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M",
    startOuter.x,
    startOuter.y,
    "A",
    outerRadius,
    outerRadius,
    0,
    largeArcFlag,
    0,
    endOuter.x,
    endOuter.y,
    "L",
    endInner.x,
    endInner.y,
    "A",
    innerRadius,
    innerRadius,
    0,
    largeArcFlag,
    1,
    startInner.x,
    startInner.y,
    "Z",
  ].join(" ");
}

export function roundSvgCoordinate(value: number): number {
  return Number(value.toFixed(4));
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: roundSvgCoordinate(centerX + radius * Math.cos(angleInRadians)),
    y: roundSvgCoordinate(centerY + radius * Math.sin(angleInRadians)),
  };
}
