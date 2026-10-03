"use client";

import {
  ActionButton,
  WorkbenchChoiceGroup,
  WorkbenchRefreshStatus,
  WorkbenchSummaryToolbar,
} from "@/design-system";

import {
  ALLOCATION_CHART_TYPES,
  ALLOCATION_DIMENSIONS,
} from "../portfolio-allocation-view-model";
import type {
  PortfolioAllocationSelection,
  PortfolioAllocationView,
} from "../types";
import type { AllocationExposureMode } from "../portfolio-allocation-drilldown-view-model";
import {
  AllocationBarChart,
  AllocationDonutChart,
  AllocationEmptyState,
  AllocationRankedList,
  AllocationTableChart,
} from "./portfolio-allocation-visuals";
import {
  type AllocationCoverageStatus,
  usePortfolioAllocationPanelState,
} from "./use-portfolio-allocation-panel-state";
import styles from "./portfolio-allocation-panel.module.css";

export default function PortfolioAllocationPanel({
  portfolioId,
  allocationViews,
  baseCurrency,
  asOfDate,
  reportingCurrency,
  selectedAllocation,
  onSelectionChange,
  onExposureModeChange,
}: {
  portfolioId: string;
  allocationViews: PortfolioAllocationView[];
  baseCurrency: string;
  asOfDate: string;
  reportingCurrency: string;
  selectedAllocation: PortfolioAllocationSelection | null;
  onSelectionChange: (selection: PortfolioAllocationSelection | null) => void;
  onExposureModeChange?: (mode: AllocationExposureMode) => void;
}) {
  const allocationState = usePortfolioAllocationPanelState({
    portfolioId,
    allocationViews,
    asOfDate,
    reportingCurrency,
    selectedAllocation,
    onSelectionChange,
    onExposureModeChange,
  });
  const {
    viewsByDimension,
    activeDimension,
    activeDimensionLabel,
    buckets,
    totalWeight,
    valuationCoverage,
    chartType,
    setChartType,
    hoveredBucket,
    setHoveredBucket,
    selectedBucket,
    lookThroughRequestedMode,
    lookThroughLabel,
    lookThroughCoverageStatus,
    lookThroughSupported,
    lookThroughBusy,
    holdingsDrilldownAvailable,
    changeDimension,
    selectBucket,
    toggleLookThrough,
    recheckLookThroughCoverage,
  } = allocationState;
  const weightsKnown = valuationCoverage !== null && totalWeight !== null;
  const signed = buckets.some((bucket) => bucket.weight_pct !== null && bucket.weight_pct < 0);
  const effectiveChart = !weightsKnown ? "table" : chartType === "donut" && signed ? "bar" : chartType;

  return (
    <div className={`portfolio-allocation-panel ${styles.root}`}>
      <WorkbenchSummaryToolbar className="portfolio-allocation-toolbar">
        <WorkbenchChoiceGroup
          value={activeDimension}
          onChange={changeDimension}
          options={ALLOCATION_DIMENSIONS.map((dimension) => {
            const isAvailable = viewsByDimension.has(dimension.key);
            return {
              key: dimension.key,
              label: dimension.label,
              disabled: !isAvailable,
              title: isAvailable
                ? dimension.label
                : `${dimension.label} allocation coverage unavailable`,
            };
          })}
          ariaLabel="Allocation dimensions"
        />

        <div className="portfolio-allocation-toolbar-actions">
          <WorkbenchChoiceGroup
            value={chartType}
            onChange={setChartType}
            options={ALLOCATION_CHART_TYPES.map((option) => ({
              key: option.key,
              label: option.label,
            }))}
            ariaLabel="Allocation chart types"
            className={styles.chartSwitcher}
          />

          <button
            type="button"
            className="portfolio-allocation-toggle"
            disabled={!lookThroughSupported || lookThroughBusy}
            aria-disabled={!lookThroughSupported || lookThroughBusy}
            aria-pressed={lookThroughRequestedMode === "prefer_look_through"}
            aria-label={
              lookThroughSupported
                ? lookThroughRequestedMode === "prefer_look_through"
                  ? "Show direct positions"
                  : "Show expanded exposure"
                : lookThroughCoverageStatus === "failed"
                  ? "Expanded exposure coverage could not be confirmed"
                  : lookThroughCoverageStatus === "unsupported"
                    ? "Expanded exposure unavailable for current portfolio snapshot"
                    : "Checking expanded exposure coverage"
            }
            title={
              lookThroughSupported
                ? `Current allocation mode: ${lookThroughLabel}`
                : lookThroughCoverageStatus === "failed"
                  ? "Expanded exposure coverage could not be confirmed"
                  : lookThroughCoverageStatus === "unsupported"
                    ? "Expanded exposure is not available for the current portfolio snapshot"
                    : "Checking expanded exposure coverage"
            }
            onClick={toggleLookThrough}
          >
            {lookThroughRequestedMode === "prefer_look_through"
              ? "Expanded exposure"
              : "Direct positions"}
          </button>

          <ActionButton
            priority="quiet"
            aria-disabled={lookThroughBusy}
            aria-label="Recheck exposure coverage"
            onClick={() => {
              void recheckLookThroughCoverage();
            }}
          >
            {lookThroughBusy ? "Checking…" : "Recheck coverage"}
          </ActionButton>
        </div>
      </WorkbenchSummaryToolbar>

      <AllocationCoverageStatus status={lookThroughCoverageStatus} />
      <div role="status" aria-label="Allocation valuation coverage">
        <strong>{valuationCoverage ? {
          COMPLETE: "Allocation valuation is complete",
          MEASURED_ZERO: "Allocation values are measured zero",
          CARRY_FORWARD: "Allocation valuation is carried forward",
          LOADED_EMPTY: "Allocation source snapshot is empty",
          PARTIAL: "Allocation valuation is partial",
          UNAVAILABLE: "Allocation valuation is unavailable",
        }[valuationCoverage.coverage_state] : "Allocation valuation coverage is unconfirmed"}</strong>
        {valuationCoverage ? <p className="muted">
          {valuationCoverage.valued_position_count} of {valuationCoverage.expected_open_position_count} expected positions valued;
          {" "}{valuationCoverage.snapshot_row_count} snapshot rows; {valuationCoverage.unvalued_position_count} unvalued.
          {" "}Source reason: {valuationCoverage.coverage_reason}.
        </p> : null}
        {!weightsKnown && buckets.length ? <p className="muted">Weights are unavailable. Exposure identities and source values remain visible in the table.</p> : null}
        {signed ? <p className="muted">Comparison tracks show magnitude; signed weights remain explicit. Composition requires non-negative weights.</p> : null}
      </div>

      <div
        className="portfolio-analytics-canvas portfolio-allocation-card"
        role="region"
        aria-label={`${activeDimensionLabel} allocation view`}
      >
        <div className="portfolio-analytical-utility-header">
          <span>Portfolio exposure</span>
          <strong>{`${activeDimensionLabel} • ${buckets.length} exposures • ${lookThroughLabel}`}</strong>
        </div>
        {buckets.length ? (
          <div className={`portfolio-allocation-body ${styles.body}`}>
            <div className={`portfolio-allocation-visual ${styles.visual}`}>
              {effectiveChart === "donut" ? (
                <AllocationDonutChart
                  buckets={buckets}
                  totalWeight={totalWeight}
                  hoveredBucket={hoveredBucket}
                  selectedBucket={selectedBucket}
                  holdingsDrilldownAvailable={holdingsDrilldownAvailable}
                  onHover={setHoveredBucket}
                  onSelect={selectBucket}
                />
              ) : null}
              {effectiveChart === "bar" ? (
                <AllocationBarChart
                  buckets={buckets}
                  hoveredBucket={hoveredBucket}
                  selectedBucket={selectedBucket}
                  holdingsDrilldownAvailable={holdingsDrilldownAvailable}
                  onHover={setHoveredBucket}
                  onSelect={selectBucket}
                />
              ) : null}
              {effectiveChart === "table" ? (
                <AllocationTableChart
                  buckets={buckets}
                  hoveredBucket={hoveredBucket}
                  selectedBucket={selectedBucket}
                  holdingsDrilldownAvailable={holdingsDrilldownAvailable}
                  onHover={setHoveredBucket}
                  onSelect={selectBucket}
                />
              ) : null}
            </div>

            <AllocationRankedList
              activeDimension={activeDimension}
              buckets={buckets}
              baseCurrency={baseCurrency}
              hoveredBucket={hoveredBucket}
              selectedBucket={selectedBucket}
              holdingsDrilldownAvailable={holdingsDrilldownAvailable}
              onHover={setHoveredBucket}
              onSelect={selectBucket}
            />
          </div>
        ) : (
          valuationCoverage?.coverage_state === "LOADED_EMPTY" ? <p>No open positions in the source snapshot.</p>
            : <AllocationEmptyState dimensionLabel={activeDimensionLabel} />
        )}
        {buckets.some((bucket) => bucket.contributors?.length) ? <details>
          <summary>Source contributors</summary>
          {buckets.map((bucket) => <div key={bucket.bucket}>
            <strong>{bucket.bucket}</strong>
            <ul>{bucket.contributors?.map((item, index) => <li key={`${item.source_snapshot_id}-${item.component_record_id ?? "direct"}-${index}`}>
              {item.security_id} ({item.booked_security_id}; {item.contributor_type === "direct_position" ? "direct position" : "look-through component"}):
              {" "}{item.market_value_reporting_currency === null ? "Unavailable" : `${item.market_value_reporting_currency} ${reportingCurrency}`}
            </li>)}</ul>
            {bucket.contributors_truncated ? <p>Source contributor list is bounded: {bucket.contributors?.length} of {bucket.contributor_count} shown.</p> : null}
          </div>)}
        </details> : null}
      </div>
    </div>
  );
}

function AllocationCoverageStatus({ status }: { status: AllocationCoverageStatus }) {
  if (status === "checking") {
    return (
      <WorkbenchRefreshStatus
        kind="pending"
        eyebrow="Exposure coverage"
        title="Checking expanded exposure"
        message="Direct allocation remains available while source coverage is confirmed."
        requestedContext="Expanded exposure"
        confirmedContext="Direct positions"
      />
    );
  }

  if (status === "failed") {
    return (
      <WorkbenchRefreshStatus
        kind="failed"
        eyebrow="Exposure coverage"
        title="Expanded exposure could not be confirmed"
        message="Direct allocation remains available. Recheck source coverage before using expanded exposure."
        requestedContext="Expanded exposure"
        confirmedContext="Direct positions"
      />
    );
  }

  return (
    <WorkbenchRefreshStatus
      kind="confirmed"
      eyebrow="Exposure coverage"
      title={status === "available" ? "Source coverage confirmed" : "Direct positions only"}
      confirmedContext={
        status === "available"
          ? "Expanded exposure is available for this portfolio snapshot"
          : "Expanded exposure is not available for this portfolio snapshot"
      }
    />
  );
}
