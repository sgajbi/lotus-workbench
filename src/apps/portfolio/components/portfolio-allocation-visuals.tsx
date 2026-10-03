"use client";

import { type KeyboardEvent } from "react";

import {
  ALLOCATION_COLORS,
  describeAllocationArc,
  compareAllocationValues,
} from "../portfolio-allocation-view-model";
import { formatCurrency, formatPct } from "../formatters";
import type {
  PortfolioAllocationSelection,
  PortfolioAllocationView,
} from "../types";
import styles from "./portfolio-allocation-panel.module.css";

function allocationPercent(value: number | null): string {
  return value === null ? "Unavailable" : formatPct(value);
}

function allocationCurrency(value: number | null, currency: string): string {
  return value === null ? "Unavailable" : formatCurrency(value, currency);
}

function handleInteractiveKeyPress(
  event: KeyboardEvent<Element>,
  onActivate: () => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onActivate();
  }
}

function buildHoldingsActionLabel(
  exposureSummary: string,
  holdingsDrilldownAvailable: boolean,
): string {
  return holdingsDrilldownAvailable
    ? `${exposureSummary}. Review contributing positions.`
    : `${exposureSummary}. Expanded exposure contributor detail is unavailable.`;
}

export function AllocationDonutChart({
  buckets,
  totalWeight,
  hoveredBucket,
  selectedBucket,
  holdingsDrilldownAvailable,
  onHover,
  onSelect,
}: {
  buckets: PortfolioAllocationView["buckets"];
  totalWeight: number | null;
  hoveredBucket: string | null;
  selectedBucket: string | null;
  holdingsDrilldownAvailable: boolean;
  onHover: (bucket: string | null) => void;
  onSelect: (bucket: string) => void;
}) {
  const allocationArcs = buckets.reduce<
    Array<{
      bucket: PortfolioAllocationView["buckets"][number];
      index: number;
      startAngle: number;
      endAngle: number;
      path: string;
    }>
  >((arcs, bucket, index) => {
    const previousArc = arcs[arcs.length - 1];
    const startAngle = previousArc ? previousArc.endAngle : -90;
    const portion =
      totalWeight !== null && totalWeight > 0 && bucket.weight_pct !== null && bucket.weight_pct >= 0
        ? bucket.weight_pct / totalWeight
        : 0;
    const endAngle = startAngle + portion * 360;
    return [
      ...arcs,
      {
        bucket,
        index,
        startAngle,
        endAngle,
        path: describeAllocationArc(110, 110, 86, 58, startAngle, endAngle),
      },
    ];
  }, []);

  return (
    <div
      className="portfolio-allocation-chart"
      role="img"
      aria-label="Allocation donut chart"
    >
      <svg viewBox="0 0 220 220" className="portfolio-allocation-chart-svg">
        <circle
          cx="110"
          cy="110"
          r="58"
          className="portfolio-allocation-chart-track"
        />
        {allocationArcs.map(({ bucket, index, path }) => {
          const isHovered = hoveredBucket === bucket.bucket;
          const isSelected = selectedBucket === bucket.bucket;
          return (
            <path
              key={bucket.bucket}
              d={path}
              fill={ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]}
              role={holdingsDrilldownAvailable ? "button" : undefined}
              tabIndex={holdingsDrilldownAvailable ? 0 : -1}
              aria-disabled={!holdingsDrilldownAvailable}
              aria-label={buildHoldingsActionLabel(
                `${bucket.bucket}: ${allocationPercent(bucket.weight_pct)}`,
                holdingsDrilldownAvailable,
              )}
              className={
                isSelected
                  ? "portfolio-allocation-chart-segment portfolio-allocation-chart-segment-selected"
                  : isHovered
                    ? "portfolio-allocation-chart-segment portfolio-allocation-chart-segment-hovered"
                    : "portfolio-allocation-chart-segment"
              }
              onMouseEnter={() => onHover(bucket.bucket)}
              onMouseLeave={() => onHover(null)}
              onClick={() => {
                if (holdingsDrilldownAvailable) {
                  onSelect(bucket.bucket);
                }
              }}
              onKeyDown={(event) =>
                holdingsDrilldownAvailable
                  ? handleInteractiveKeyPress(event, () => onSelect(bucket.bucket))
                  : undefined
              }
            >
              <title>{`${bucket.bucket}: ${allocationPercent(bucket.weight_pct)}`}</title>
            </path>
          );
        })}
        <circle
          cx="110"
          cy="110"
          r="50"
          className="portfolio-allocation-chart-core"
        />
        <text
          x="110"
          y="104"
          textAnchor="middle"
          className="portfolio-allocation-chart-center-label"
        >
          Exposure
        </text>
        <text
          x="110"
          y="124"
          textAnchor="middle"
          className="portfolio-allocation-chart-center-value"
        >
          {buckets.length} groups
        </text>
      </svg>
    </div>
  );
}

export function AllocationBarChart({
  buckets,
  hoveredBucket,
  selectedBucket,
  holdingsDrilldownAvailable,
  onHover,
  onSelect,
}: {
  buckets: PortfolioAllocationView["buckets"];
  hoveredBucket: string | null;
  selectedBucket: string | null;
  holdingsDrilldownAvailable: boolean;
  onHover: (bucket: string | null) => void;
  onSelect: (bucket: string) => void;
}) {
  const maxWeight = Math.max(
    ...buckets.flatMap((bucket) => bucket.weight_pct === null ? [] : [Math.abs(bucket.weight_pct)]),
    0,
  );

  return (
    <div
      className="portfolio-allocation-chart portfolio-allocation-bar-chart"
      aria-label="Allocation bar chart"
    >
      {buckets.map((bucket, index) => {
        const width = bucket.weight_pct === null ? null : maxWeight > 0
          ? `${(Math.abs(bucket.weight_pct) / maxWeight) * 100}%` : "0%";
        const isHovered = hoveredBucket === bucket.bucket;
        const isSelected = selectedBucket === bucket.bucket;
        return (
          <button
            key={bucket.bucket}
            type="button"
            disabled={!holdingsDrilldownAvailable}
            aria-label={buildHoldingsActionLabel(
              `${bucket.bucket}: ${allocationPercent(bucket.weight_pct)}`,
              holdingsDrilldownAvailable,
            )}
            title={`${bucket.bucket}: ${allocationPercent(bucket.weight_pct)}`}
            className={
              isSelected
                ? "portfolio-allocation-bar-row portfolio-allocation-bar-row-selected"
                : isHovered
                  ? "portfolio-allocation-bar-row portfolio-allocation-bar-row-hovered"
                  : "portfolio-allocation-bar-row"
            }
            onMouseEnter={() => onHover(bucket.bucket)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onSelect(bucket.bucket)}
          >
            <span className="portfolio-allocation-bar-label">
              {bucket.bucket}
            </span>
            <span className="portfolio-allocation-bar-track">
              {width !== null ? <span
                className="portfolio-allocation-bar-fill"
                style={{
                  width,
                  backgroundColor:
                    ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
                }}
              /> : null}
            </span>
            <span className="portfolio-allocation-bar-value">
              {allocationPercent(bucket.weight_pct)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function AllocationTableChart({
  buckets,
  hoveredBucket,
  selectedBucket,
  holdingsDrilldownAvailable,
  onHover,
  onSelect,
}: {
  buckets: PortfolioAllocationView["buckets"];
  hoveredBucket: string | null;
  selectedBucket: string | null;
  holdingsDrilldownAvailable: boolean;
  onHover: (bucket: string | null) => void;
  onSelect: (bucket: string) => void;
}) {
  return (
    <div
      className="portfolio-allocation-chart portfolio-allocation-table-chart"
      aria-label="Allocation table chart"
    >
      {buckets.map((bucket, index) => {
        const isHovered = hoveredBucket === bucket.bucket;
        const isSelected = selectedBucket === bucket.bucket;
        return (
          <button
            key={bucket.bucket}
            type="button"
            disabled={!holdingsDrilldownAvailable}
            aria-label={buildHoldingsActionLabel(
              `${bucket.bucket}: ${allocationPercent(bucket.weight_pct)}`,
              holdingsDrilldownAvailable,
            )}
            title={`${bucket.bucket}: ${allocationPercent(bucket.weight_pct)}`}
            className={
              isSelected
                ? "portfolio-allocation-table-row portfolio-allocation-table-row-selected"
                : isHovered
                  ? "portfolio-allocation-table-row portfolio-allocation-table-row-hovered"
                  : "portfolio-allocation-table-row"
            }
            onMouseEnter={() => onHover(bucket.bucket)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onSelect(bucket.bucket)}
          >
            <span
              className="portfolio-allocation-table-dot"
              style={{
                backgroundColor:
                  ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
              }}
            />
            <span>{bucket.bucket}</span>
            <span>{allocationPercent(bucket.weight_pct)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function AllocationRankedList({
  activeDimension,
  buckets,
  baseCurrency,
  hoveredBucket,
  selectedBucket,
  holdingsDrilldownAvailable,
  onHover,
  onSelect,
}: {
  activeDimension: PortfolioAllocationSelection["dimension"];
  buckets: PortfolioAllocationView["buckets"];
  baseCurrency: string;
  hoveredBucket: string | null;
  selectedBucket: string | null;
  holdingsDrilldownAvailable: boolean;
  onHover: (bucket: string | null) => void;
  onSelect: (bucket: string) => void;
}) {
  return (
    <div className={`portfolio-allocation-ranked ${styles.ranked}`}>
      <div className="portfolio-allocation-ranked-header">
        <span>Dimension</span>
        <span className="portfolio-allocation-ranked-number">
          Market Value
        </span>
        <span className="portfolio-allocation-ranked-number">Weight</span>
        <span className="portfolio-allocation-ranked-number">Positions</span>
      </div>
      <div className="portfolio-allocation-ranked-body">
        {buckets
          .slice()
          .sort(
            (left, right) =>
              compareAllocationValues(left.market_value_base, right.market_value_base),
          )
          .map((bucket, index) => {
            const isHovered = hoveredBucket === bucket.bucket;
            const isSelected = selectedBucket === bucket.bucket;
            return (
              <button
                key={`${activeDimension}-${bucket.bucket}`}
                type="button"
                disabled={!holdingsDrilldownAvailable}
                aria-label={buildHoldingsActionLabel(
                  `${bucket.bucket}: ${allocationCurrency(bucket.market_value_base, baseCurrency)}, ${allocationPercent(bucket.weight_pct)}, ${bucket.position_count} positions`,
                  holdingsDrilldownAvailable,
                )}
                title={`${bucket.bucket}: ${allocationPercent(bucket.weight_pct)}`}
                className={
                  isSelected
                    ? "portfolio-allocation-ranked-row portfolio-allocation-ranked-row-selected"
                    : isHovered
                      ? "portfolio-allocation-ranked-row portfolio-allocation-ranked-row-hovered"
                      : "portfolio-allocation-ranked-row"
                }
                onMouseEnter={() => onHover(bucket.bucket)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onSelect(bucket.bucket)}
              >
                <span className="portfolio-allocation-ranked-dimension">
                  <i
                    aria-hidden="true"
                    style={{
                      backgroundColor:
                        ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
                    }}
                  />
                  {bucket.bucket}
                </span>
                <span className="portfolio-allocation-ranked-number">
                  {allocationCurrency(bucket.market_value_base, baseCurrency)}
                </span>
                <span className="portfolio-allocation-ranked-number">
                  {allocationPercent(bucket.weight_pct)}
                </span>
                <span className="portfolio-allocation-ranked-number">
                  {bucket.position_count}
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}

export function AllocationEmptyState({
  dimensionLabel,
}: {
  dimensionLabel: string;
}) {
  return (
    <div className="portfolio-allocation-empty">
      <div className="portfolio-allocation-empty-chart" aria-hidden="true">
        <div className="portfolio-allocation-empty-ring" />
      </div>
      <div className="portfolio-allocation-empty-copy">
        <strong>{dimensionLabel} allocation is not available yet</strong>
        <p className="muted">
          This dimension requires funded positions with current valuations before
          a reliable composition view can be shown.
        </p>
        <p className="muted">
          Book positions and publish prices to generate allocation views.
        </p>
      </div>
    </div>
  );
}
