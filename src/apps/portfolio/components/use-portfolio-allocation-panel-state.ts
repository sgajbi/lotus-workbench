"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  getPortfolioAllocationViews,
  type PortfolioLookThroughMode,
} from "../api";
import {
  ALLOCATION_DIMENSIONS,
  allocationWeightTotal,
  formatAllocationDimensionLabel,
  isDirectLookThroughFallbackConfirmed,
  isExpandedLookThroughSupported,
  normalizeLookThroughMode,
  type AllocationChartType,
  type AllocationDimension,
} from "../portfolio-allocation-view-model";
import type {
  PortfolioAllocationLookThrough,
  PortfolioAllocationSelection,
  PortfolioAllocationView,
  PortfolioAllocationValuationCoverage,
} from "../types";
import type { AllocationExposureMode } from "../portfolio-allocation-drilldown-view-model";

export type AllocationCoverageStatus =
  | "checking"
  | "available"
  | "unsupported"
  | "failed";

export type PortfolioAllocationPanelState = ReturnType<
  typeof usePortfolioAllocationPanelState
>;

type AllocationResolutionState = {
  sourceKey: string;
  directAllocationViews: PortfolioAllocationView[];
  resolvedAllocationViews: PortfolioAllocationView[];
  directValuationCoverage: PortfolioAllocationValuationCoverage | null;
  valuationCoverage: PortfolioAllocationValuationCoverage | null;
  lookThroughRequestedMode: PortfolioLookThroughMode;
  lookThroughEffectiveMode: PortfolioLookThroughMode;
  lookThroughCoverageStatus: AllocationCoverageStatus;
  cachedLookThroughResponse: {
    views: PortfolioAllocationView[];
    lookThrough: PortfolioAllocationLookThrough | null;
    valuationCoverage: PortfolioAllocationValuationCoverage;
  } | null;
};

type ActiveDimensionState = {
  availableDimensionKey: string;
  dimension: AllocationDimension;
};

export function usePortfolioAllocationPanelState({
  portfolioId,
  allocationViews,
  asOfDate,
  reportingCurrency,
  selectedAllocation,
  onSelectionChange,
  onExposureModeChange,
}: {
  portfolioId: string;
  allocationViews: PortfolioAllocationView[];
  asOfDate: string;
  reportingCurrency: string;
  selectedAllocation: PortfolioAllocationSelection | null;
  onSelectionChange: (selection: PortfolioAllocationSelection | null) => void;
  onExposureModeChange?: (mode: AllocationExposureMode) => void;
}) {
  const allocationSourceKey = useMemo(
    () =>
      JSON.stringify({
        portfolioId,
        asOfDate,
        reportingCurrency,
        allocationViews,
      }),
    [allocationViews, asOfDate, portfolioId, reportingCurrency],
  );
  const [allocationState, setAllocationState] =
    useState<AllocationResolutionState>(() =>
      buildInitialAllocationResolutionState(allocationSourceKey, allocationViews),
    );
  const coverageRequestSequence = useRef(0);
  const selectedAllocationRef = useRef(selectedAllocation);
  useEffect(() => {
    selectedAllocationRef.current = selectedAllocation;
  }, [selectedAllocation]);
  const activeAllocationState =
    allocationState.sourceKey === allocationSourceKey
      ? allocationState
      : buildInitialAllocationResolutionState(allocationSourceKey, allocationViews);
  const [chartType, setChartType] = useState<AllocationChartType>("donut");
  const [hoveredBucket, setHoveredBucket] = useState<string | null>(null);

  const viewsByDimension = useMemo(() => {
    return new Map(
      activeAllocationState.resolvedAllocationViews.map((view) => [view.dimension, view]),
    );
  }, [activeAllocationState.resolvedAllocationViews]);

  const firstAvailableDimension =
    ALLOCATION_DIMENSIONS.find((dimension) =>
      viewsByDimension.has(dimension.key),
    )?.key ?? "asset_class";
  const availableDimensionKey = Array.from(viewsByDimension.keys()).sort().join("|");
  const [activeDimensionState, setActiveDimensionState] =
    useState<ActiveDimensionState>({
      availableDimensionKey,
      dimension: firstAvailableDimension,
    });
  const activeDimension =
    activeDimensionState.availableDimensionKey === availableDimensionKey &&
    viewsByDimension.has(activeDimensionState.dimension)
      ? activeDimensionState.dimension
      : firstAvailableDimension;

  useEffect(() => {
    let cancelled = false;
    const requestSequence = ++coverageRequestSequence.current;

    void getPortfolioAllocationViews(portfolioId, {
      asOfDate,
      reportingCurrency,
      lookThroughMode: "prefer_look_through",
    }).then(async (response) => {
      if (cancelled || requestSequence !== coverageRequestSequence.current) return;
      const directResponse = response && isExpandedLookThroughSupported(response.look_through ?? null)
        ? await getPortfolioAllocationViews(portfolioId, { asOfDate, reportingCurrency, lookThroughMode: "direct_only" })
        : null;
      if (cancelled || requestSequence !== coverageRequestSequence.current) {
        return;
      }
      const currentSelection = selectedAllocationRef.current;
      const nextDirectAllocationViews = resolveDirectAllocationViews(
        allocationViews,
        response,
        directResponse,
      );
      if (
        currentSelection &&
        !includesAllocationSelection(nextDirectAllocationViews, currentSelection)
      ) {
        onSelectionChange(null);
      }
      setAllocationState((current) =>
        applyLookThroughCoverageResponse(
          current.sourceKey === allocationSourceKey
            ? current
            : buildInitialAllocationResolutionState(allocationSourceKey, allocationViews),
          response,
          directResponse,
        ),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [
    allocationSourceKey,
    allocationViews,
    asOfDate,
    onSelectionChange,
    portfolioId,
    reportingCurrency,
  ]);

  const activeView = viewsByDimension.get(activeDimension) ?? null;
  const buckets = activeView?.buckets ?? [];
  const activeDimensionLabel = formatAllocationDimensionLabel(activeDimension);
  const totalWeight = allocationWeightTotal(buckets);
  const activeHoveredBucket = buckets.some(
    (bucket) => bucket.bucket === hoveredBucket,
  )
    ? hoveredBucket
    : null;
  const selectedBucket =
    selectedAllocation?.dimension === activeDimension &&
    buckets.some((bucket) => bucket.bucket === selectedAllocation.bucket)
      ? selectedAllocation.bucket
      : null;
  const lookThroughLabel =
    activeAllocationState.lookThroughRequestedMode === "prefer_look_through" &&
    activeAllocationState.lookThroughEffectiveMode === "prefer_look_through"
      ? "Expanded exposure"
      : "Direct positions";
  const exposureMode: AllocationExposureMode =
    lookThroughLabel === "Expanded exposure" ? "expanded" : "direct";

  useEffect(() => {
    onExposureModeChange?.(exposureMode);
  }, [exposureMode, onExposureModeChange]);

  function changeDimension(nextDimension: AllocationDimension) {
    setActiveDimensionState({
      availableDimensionKey,
      dimension: nextDimension,
    });
    setHoveredBucket(null);
    onSelectionChange(null);
  }

  function selectBucket(bucket: string) {
    if (exposureMode === "expanded") {
      return;
    }
    onSelectionChange(
      selectedBucket === bucket
        ? null
        : { dimension: activeDimension, bucket },
    );
  }

  function toggleLookThrough() {
    if (
      activeAllocationState.lookThroughCoverageStatus !== "available" ||
      !activeAllocationState.cachedLookThroughResponse
    ) {
      return;
    }

    setHoveredBucket(null);
    onSelectionChange(null);
    setAllocationState((current) => {
      if (current.sourceKey !== allocationSourceKey) {
        return current;
      }
      const showExpanded = current.lookThroughRequestedMode === "direct_only";
      return {
        ...current,
        resolvedAllocationViews: showExpanded
          ? current.cachedLookThroughResponse?.views ?? current.directAllocationViews
          : current.directAllocationViews,
        valuationCoverage: showExpanded
          ? current.cachedLookThroughResponse?.valuationCoverage ?? null
          : current.directValuationCoverage,
        lookThroughRequestedMode: showExpanded
          ? "prefer_look_through"
          : "direct_only",
        lookThroughEffectiveMode: showExpanded
          ? normalizeLookThroughMode(
              current.cachedLookThroughResponse?.lookThrough?.effective_mode,
              "prefer_look_through",
            )
          : "direct_only",
      };
    });
  }

  async function recheckLookThroughCoverage() {
    const requestSequence = ++coverageRequestSequence.current;
    setHoveredBucket(null);
    setAllocationState((current) =>
      current.sourceKey === allocationSourceKey
        ? {
            ...current,
            resolvedAllocationViews: current.directAllocationViews,
            valuationCoverage: current.directValuationCoverage,
            lookThroughRequestedMode: "direct_only",
            lookThroughEffectiveMode: "direct_only",
            lookThroughCoverageStatus: "checking",
          }
        : current,
    );

    const response = await getPortfolioAllocationViews(portfolioId, {
      asOfDate,
      reportingCurrency,
      lookThroughMode: "prefer_look_through",
    });
    const directResponse = response && isExpandedLookThroughSupported(response.look_through ?? null)
      ? await getPortfolioAllocationViews(portfolioId, { asOfDate, reportingCurrency, lookThroughMode: "direct_only" })
      : null;
    if (requestSequence !== coverageRequestSequence.current) {
      return;
    }
    const currentSelection = selectedAllocationRef.current;
    const nextDirectAllocationViews = resolveDirectAllocationViews(
      activeAllocationState.directAllocationViews,
      response,
      directResponse,
    );
    if (
      currentSelection &&
      !includesAllocationSelection(nextDirectAllocationViews, currentSelection)
    ) {
      onSelectionChange(null);
    }
    setAllocationState((current) =>
      current.sourceKey === allocationSourceKey
        ? applyLookThroughCoverageResponse(current, response, directResponse)
        : current,
    );
  }

  return {
    viewsByDimension,
    activeDimension,
    activeDimensionLabel,
    buckets,
    totalWeight,
    valuationCoverage: activeAllocationState.valuationCoverage,
    chartType,
    setChartType,
    hoveredBucket: activeHoveredBucket,
    setHoveredBucket,
    selectedBucket,
    lookThroughRequestedMode: activeAllocationState.lookThroughRequestedMode,
    lookThroughLabel,
    lookThroughCoverageStatus: activeAllocationState.lookThroughCoverageStatus,
    lookThroughSupported:
      activeAllocationState.lookThroughCoverageStatus === "available",
    lookThroughBusy:
      activeAllocationState.lookThroughCoverageStatus === "checking",
    holdingsDrilldownAvailable: exposureMode === "direct",
    changeDimension,
    selectBucket,
    toggleLookThrough,
    recheckLookThroughCoverage,
  };
}

function buildInitialAllocationResolutionState(
  sourceKey: string,
  allocationViews: PortfolioAllocationView[],
): AllocationResolutionState {
  return {
    sourceKey,
    directAllocationViews: allocationViews,
    resolvedAllocationViews: allocationViews,
    directValuationCoverage: null,
    valuationCoverage: null,
    lookThroughRequestedMode: "direct_only",
    lookThroughEffectiveMode: "direct_only",
    lookThroughCoverageStatus: "checking",
    cachedLookThroughResponse: null,
  };
}

function applyLookThroughCoverageResponse(
  current: AllocationResolutionState,
  response: {
    views: PortfolioAllocationView[];
    look_through?: PortfolioAllocationLookThrough | null;
    valuation_coverage: PortfolioAllocationValuationCoverage;
  } | null,
  directResponse?: { views: PortfolioAllocationView[]; valuation_coverage: PortfolioAllocationValuationCoverage; look_through?: PortfolioAllocationLookThrough | null } | null,
): AllocationResolutionState {
  if (!response) {
    return {
      ...current,
      lookThroughCoverageStatus: "failed",
    };
  }

  const supportsExpandedLookThrough = isExpandedLookThroughSupported(
    response.look_through ?? null,
  );
  const admittedDirect = directResponse?.look_through?.effective_mode === "direct_only" && !directResponse.look_through.applied
    ? directResponse : null;
  if (!supportsExpandedLookThrough) {
    if (!isDirectLookThroughFallbackConfirmed(response.look_through ?? null)) {
      return {
        ...current,
        lookThroughCoverageStatus: "failed",
      };
    }
    const directAllocationViews = resolveDirectAllocationViews(
      current.directAllocationViews,
      response,
    );
    return {
      ...current,
      directAllocationViews,
      resolvedAllocationViews: directAllocationViews,
      directValuationCoverage: response.valuation_coverage,
      valuationCoverage: response.valuation_coverage,
      lookThroughRequestedMode: "direct_only",
      lookThroughEffectiveMode: "direct_only",
      lookThroughCoverageStatus: "unsupported",
      cachedLookThroughResponse: null,
    };
  }

  return {
    ...current,
    directAllocationViews: admittedDirect?.views ?? current.directAllocationViews,
    resolvedAllocationViews: admittedDirect?.views ?? current.directAllocationViews,
    directValuationCoverage: admittedDirect?.valuation_coverage ?? current.directValuationCoverage,
    valuationCoverage: admittedDirect?.valuation_coverage ?? current.directValuationCoverage,
    lookThroughCoverageStatus: "available",
    cachedLookThroughResponse: {
      views: response.views,
      lookThrough: response.look_through ?? null,
      valuationCoverage: response.valuation_coverage,
    },
  };
}

function resolveDirectAllocationViews(
  currentDirectAllocationViews: PortfolioAllocationView[],
  response: {
    views: PortfolioAllocationView[];
    look_through?: PortfolioAllocationLookThrough | null;
  } | null,
  directResponse?: { views: PortfolioAllocationView[]; look_through?: PortfolioAllocationLookThrough | null } | null,
): PortfolioAllocationView[] {
  if (directResponse?.look_through?.effective_mode === "direct_only" && !directResponse.look_through.applied) return directResponse.views;
  if (
    !response ||
    !isDirectLookThroughFallbackConfirmed(response.look_through ?? null)
  ) {
    return currentDirectAllocationViews;
  }
  return response.views;
}

function includesAllocationSelection(
  views: PortfolioAllocationView[],
  selection: PortfolioAllocationSelection,
): boolean {
  return views.some(
    (view) =>
      view.dimension === selection.dimension &&
      view.buckets.some((bucket) => bucket.bucket === selection.bucket),
  );
}
