function assertFiniteNumber(value, description) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${description} expected a finite number but received ${String(value)}.`);
  }
  return value;
}

function assertNumberInRange(value, minimum, maximum, description) {
  const numericValue = assertFiniteNumber(value, description);
  if (numericValue < minimum || numericValue > maximum) {
    throw new Error(
      `${description} expected ${minimum} <= value <= ${maximum} but received ${numericValue}.`
    );
  }
  return numericValue;
}

function assertArrayHasLength(value, minimumLength, description) {
  if (!Array.isArray(value) || value.length < minimumLength) {
    throw new Error(
      `${description} expected at least ${minimumLength} rows but found ${
        Array.isArray(value) ? value.length : "non-array"
      }.`
    );
  }
  return value;
}

const FLOATING_POINT_RECONCILIATION_ULPS = 8;

export function assertRiskAttributionReconciliation(attributionSet) {
  const totalValue = assertFiniteNumber(
    attributionSet.total_value,
    "Historical risk total value"
  );
  const reconciledSum = assertFiniteNumber(
    attributionSet.reconciled_sum,
    "Historical risk reconciled sum"
  );
  const residual = assertFiniteNumber(
    attributionSet.residual,
    "Historical risk residual"
  );
  if (!Array.isArray(attributionSet.quality_flags)) {
    throw new Error("Historical risk quality flags expected an array.");
  }

  const expectedResidual = totalValue - reconciledSum;
  const comparisonScale = Math.max(
    1,
    Math.abs(totalValue),
    Math.abs(reconciledSum),
    Math.abs(residual)
  );
  const comparisonTolerance =
    Number.EPSILON * comparisonScale * FLOATING_POINT_RECONCILIATION_ULPS;
  const reconciliationError = Math.abs(expectedResidual - residual);
  if (reconciliationError > comparisonTolerance) {
    throw new Error(
      "Historical risk attribution is internally inconsistent: " +
        `total ${totalValue} - reconciled ${reconciledSum} = ${expectedResidual}, ` +
        `but source residual is ${residual}.`
    );
  }

  return {
    totalValue,
    reconciledSum,
    residual,
    residualAbs: Math.abs(residual),
    residualShareOfTotal:
      totalValue === 0 ? (residual === 0 ? 0 : null) : Math.abs(residual / totalValue),
    reconciliationError,
    comparisonTolerance,
    qualityFlags: [...attributionSet.quality_flags],
  };
}

function recordCalculationCheck(summary, description, evidence) {
  summary.calculationChecks.push({ description, ...evidence });
}

function readSourceSupportabilityItems(...payloads) {
  return payloads.flatMap((payload) => [
    ...(Array.isArray(payload?.source_supportability) ? payload.source_supportability : []),
    ...(Array.isArray(payload?.evidence_view?.source_supportability)
      ? payload.evidence_view.source_supportability
      : []),
    ...(Array.isArray(payload?.supportability) ? payload.supportability : []),
    ...readContributionSourceEconomicsItems(payload),
  ]);
}

function readContributionSourceEconomicsItems(payload) {
  const sourceEconomicsEvidence = payload?.contribution?.source_economics_evidence;
  if (!sourceEconomicsEvidence || typeof sourceEconomicsEvidence !== "object") {
    return [];
  }

  return [
    {
      source_service: deriveContributionSourceEconomicsOwner(sourceEconomicsEvidence),
      operation: "performance.contribution.source_economics",
      state: sourceEconomicsEvidence.status,
      freshness_bucket:
        typeof sourceEconomicsEvidence.source_snapshot_count === "number" &&
        sourceEconomicsEvidence.source_snapshot_count > 0
          ? "fresh"
          : "unknown",
    },
  ];
}

function deriveContributionSourceEconomicsOwner(sourceEconomicsEvidence) {
  if (typeof sourceEconomicsEvidence.source_owner === "string" && sourceEconomicsEvidence.source_owner) {
    return sourceEconomicsEvidence.source_owner;
  }

  const sourceContracts = Array.isArray(sourceEconomicsEvidence.source_contracts)
    ? sourceEconomicsEvidence.source_contracts
    : [];
  if (
    sourceContracts.some(
      (contract) =>
        typeof contract === "string" &&
        (contract.includes("PortfolioTimeseriesInput") || contract.includes("PositionTimeseriesInput"))
    )
  ) {
    return "lotus-core";
  }

  return "lotus-performance";
}

function normalizeSupportabilityState(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (["ready", "supported", "ok", "complete", "source_backed", "caller_supplied"].includes(normalized)) {
    return "ready";
  }
  if (["partial", "stale", "source_limited"].includes(normalized)) {
    return "partial";
  }
  if (["blocked", "degraded", "unavailable", "unsupported", "action_required"].includes(normalized)) {
    return "action_required";
  }
  return "unknown";
}

function normalizeFreshnessState(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (["current", "fresh"].includes(normalized)) {
    return "fresh";
  }
  if (["expired", "stale"].includes(normalized)) {
    return "stale";
  }
  return "unknown";
}

function summarizeSourceSupportability(items) {
  let staleCount = 0;
  let partialCount = 0;
  let actionRequiredCount = 0;
  let unconfirmedCount = 0;
  let itemCount = 0;
  const services = new Set();

  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }
    itemCount += 1;
    const sourceService =
      typeof item.source_service === "string" ? item.source_service.trim() : "";
    const calculationReference =
      typeof item.operation === "string" && item.operation.trim()
        ? item.operation.trim()
        : typeof item.key === "string"
          ? item.key.trim()
          : "";
    const identityConfirmed = Boolean(sourceService && calculationReference);
    if (sourceService) {
      services.add(sourceService);
    }
    const freshnessState = normalizeFreshnessState(item.freshness_bucket);
    if (freshnessState === "stale") {
      staleCount += 1;
    }
    const normalizedState = normalizeSupportabilityState(item.state ?? item.supportability_state);
    if (normalizedState === "partial") {
      partialCount += 1;
    }
    if (normalizedState === "action_required") {
      actionRequiredCount += 1;
    }
    if (
      !identityConfirmed ||
      normalizedState === "unknown" ||
      freshnessState === "unknown"
    ) {
      unconfirmedCount += 1;
    }
  }

  return {
    itemCount,
    services: [...services].sort(),
    staleCount,
    partialCount,
    actionRequiredCount,
    unconfirmedCount,
    state:
      actionRequiredCount > 0
        ? "action_required"
        : partialCount > 0 || staleCount > 0 || unconfirmedCount > 0
          ? "partial"
          : itemCount > 0
            ? "ready"
            : "unknown",
  };
}

function recordSourceSupportabilityCheck(summary, panel, owner, items) {
  const supportability = summarizeSourceSupportability(items);
  summary.supportabilityChecks.push({
    panel,
    owner,
    source: "gateway.source_supportability",
    ...supportability,
  });
  return supportability;
}

function resolveReadyPanelStateFromSupportability(panel, supportability) {
  if (supportability.state === "action_required") {
    throw new Error(
      `${panel} source supportability requires action and cannot be certified as ready.`
    );
  }
  return supportability.state === "ready" ? "ready" : "partial";
}

export function assertPerformanceCalculationSanity({
  summary,
  performanceSummary,
  performanceDetails,
  recordPanelClassification,
}) {
  const netPerformance = performanceSummary?.net_performance ?? {};
  const overview = performanceSummary?.overview ?? {};
  const contributionLevel = performanceDetails?.contribution?.levels?.[0];
  const attributionCapability = performanceDetails?.capabilities?.attribution_detail ?? {};
  const attributionLevel = performanceDetails?.attribution?.levels?.[0];

  const portfolioReturn = assertNumberInRange(
    netPerformance.portfolio_return_pct,
    -100,
    200,
    "Net portfolio return"
  );
  const benchmarkReturn = assertNumberInRange(
    netPerformance.benchmark_return_pct,
    -100,
    100,
    "Benchmark return"
  );
  const activeReturn = assertNumberInRange(
    netPerformance.active_return_pct,
    -200,
    200,
    "Active return"
  );
  const activeDifference = Math.abs(activeReturn - (portfolioReturn - benchmarkReturn));
  if (activeDifference > 0.01) {
    throw new Error(
      `Active return is not reconciled: active=${activeReturn}, portfolio=${portfolioReturn}, benchmark=${benchmarkReturn}.`
    );
  }

  assertNumberInRange(overview.market_value_base, 1, 100_000_000, "Portfolio market value");
  assertNumberInRange(overview.cash_weight_pct, -5, 100, "Cash weight");
  assertNumberInRange(overview.position_count, 10, 100, "Position count");
  assertArrayHasLength(performanceDetails?.net_chart, 4, "Performance return path observations");
  const contributionRows = assertArrayHasLength(
    contributionLevel?.rows,
    4,
    "Performance contribution rows"
  );
  const contributionTotal = assertFiniteNumber(
    contributionLevel.total_contribution_pct,
    "Contribution total"
  );
  if (Math.abs(contributionTotal - portfolioReturn) > 0.02) {
    throw new Error(
      `Contribution total does not reconcile with net portfolio return: contribution=${contributionTotal}, return=${portfolioReturn}.`
    );
  }

  const attributionRows = Array.isArray(attributionLevel?.rows) ? attributionLevel.rows.length : 0;
  const attributionFallback =
    attributionCapability.state === "partial" && attributionCapability.fallback_available === true;
  if (attributionCapability.state === "supported" && attributionRows < 1) {
    throw new Error("Attribution detail is supported but returned no rows.");
  }
  if (!attributionFallback && attributionCapability.state !== "supported") {
    throw new Error(
      `Attribution detail is ${String(attributionCapability.state)} without a governed fallback.`
    );
  }

  recordCalculationCheck(summary, "Performance calculation sanity", {
    portfolioReturnPct: portfolioReturn,
    benchmarkReturnPct: benchmarkReturn,
    activeReturnPct: activeReturn,
    contributionRows: contributionRows.length,
    attributionState: attributionCapability.state,
    attributionRows,
  });
  const performanceSupportability = recordSourceSupportabilityCheck(
    summary,
    "performance.summary",
    "lotus-gateway",
    readSourceSupportabilityItems(performanceSummary, performanceDetails)
  );
  const performancePanelState = resolveReadyPanelStateFromSupportability(
    "Performance",
    performanceSupportability
  );

  recordPanelClassification("performance.summary", performancePanelState, "lotus-performance", {
    returnPathRows: performanceDetails.net_chart.length,
    sourceSupportabilityState: performanceSupportability.state,
    sourceSupportabilityItems: performanceSupportability.itemCount,
    reason:
      performancePanelState === "partial"
        ? "Gateway source supportability is not fully confirmed for the active performance selection."
        : null,
  });
  recordPanelClassification(
    "performance.analysis.contribution",
    performancePanelState,
    "lotus-performance",
    {
      contributionRows: contributionRows.length,
      sourceSupportabilityState: performanceSupportability.state,
      reason:
        performancePanelState === "partial"
          ? "Gateway source supportability is not fully confirmed for the active performance selection."
          : null,
    }
  );
  recordPanelClassification(
    "performance.analysis.attribution",
    "partial",
    "lotus-performance",
    {
      attributionState: attributionCapability.state,
      attributionRows,
      fallbackAvailable: attributionCapability.fallback_available === true,
    }
  );
  const evidenceCapabilityState = performanceSummary?.capabilities?.evidence?.state ?? "unavailable";
  recordPanelClassification("performance.evidence", "partial", "lotus-gateway", {
    capabilityState: evidenceCapabilityState,
    reason: performanceSummary?.capabilities?.evidence?.reason ?? null,
  });
}

export function assertRiskCalculationSanity({
  summary,
  riskSummary,
  concentration,
  drawdown,
  rolling,
  attribution,
  recordPanelClassification,
}) {
  const riskPeriod = assertArrayHasLength(riskSummary?.payload?.periods, 1, "Risk periods")[0];
  const metrics = assertArrayHasLength(riskPeriod.metrics, 6, "Risk summary metrics");
  const readyMetrics = metrics.filter((metric) => metric?.state === "ready");
  if (readyMetrics.length < 6) {
    throw new Error(`Risk summary expected at least 6 ready metrics but found ${readyMetrics.length}.`);
  }
  assertNumberInRange(riskPeriod.portfolio_observation_count, 60, 400, "Risk observations");
  assertNumberInRange(
    riskPeriod.aligned_benchmark_observation_count,
    60,
    400,
    "Aligned benchmark observations"
  );
  if (riskPeriod.benchmark_context?.aligned !== true) {
    throw new Error("Risk benchmark context is not aligned.");
  }

  const concentrationPayload = concentration?.payload ?? {};
  assertNumberInRange(
    concentrationPayload.portfolio_concentration?.hhi_current,
    1,
    10_000,
    "Portfolio concentration HHI"
  );
  assertNumberInRange(
    concentrationPayload.issuer_concentration?.coverage_ratio_current,
    0.95,
    1,
    "Issuer concentration coverage ratio"
  );
  assertNumberInRange(
    concentrationPayload.single_position_concentration?.top_n_cumulative_weight_current,
    0.5,
    1.01,
    "Top positions cumulative weight"
  );

  const drawdownPeriod = assertArrayHasLength(drawdown?.payload?.periods, 1, "Drawdown periods")[0];
  assertNumberInRange(
    drawdownPeriod.portfolio_observation_count,
    60,
    400,
    "Drawdown observation count"
  );
  assertNumberInRange(
    drawdownPeriod.relative_to_benchmark?.time_under_water_days,
    1,
    366,
    "Relative drawdown time under water"
  );
  assertArrayHasLength(drawdownPeriod.underwater_series, 60, "Drawdown underwater series");

  const rollingPeriod = assertArrayHasLength(rolling?.payload?.periods, 1, "Rolling risk periods")[0];
  assertNumberInRange(rollingPeriod.window_count_emitted, 4, 4, "Rolling risk window count");
  const rollingWindows = assertArrayHasLength(
    rollingPeriod.window_results,
    4,
    "Rolling risk window results"
  );
  let rollingWindowsWithLatestVolatility = 0;
  for (const windowResult of rollingPeriod.window_results) {
    const volatility = windowResult?.metric_summaries?.ROLLING_VOLATILITY;
    if (!volatility || typeof volatility !== "object") {
      throw new Error(
        `Rolling risk window ${String(windowResult?.window_length)} has no volatility summary.`
      );
    }
    if (typeof volatility.latest === "number") {
      rollingWindowsWithLatestVolatility += 1;
    }
  }
  if (rollingWindowsWithLatestVolatility < 2) {
    throw new Error(
      `Rolling risk expected at least 2 computable windows but found ${rollingWindowsWithLatestVolatility}.`
    );
  }

  const attributionPeriod = assertArrayHasLength(
    attribution?.payload?.periods,
    1,
    "Historical risk attribution periods"
  )[0];
  const attributionSet = assertArrayHasLength(
    attributionPeriod.attribution_sets,
    1,
    "Historical risk attribution sets"
  )[0];
  const contributors = assertArrayHasLength(
    attributionSet.contributors,
    5,
    "Historical risk attribution contributors"
  );
  const attributionReconciliation = assertRiskAttributionReconciliation(attributionSet);

  recordCalculationCheck(summary, "Risk calculation sanity", {
    readyMetricCount: readyMetrics.length,
    observationCount: riskPeriod.portfolio_observation_count,
    concentrationHhi: concentrationPayload.portfolio_concentration?.hhi_current,
    rollingWindowCount: rollingPeriod.window_count_emitted,
    rollingWindowResultCount: rollingWindows.length,
    rollingWindowsWithLatestVolatility,
    attributionContributorCount: contributors.length,
    attributionTotalValue: attributionReconciliation.totalValue,
    attributionReconciledSum: attributionReconciliation.reconciledSum,
    attributionResidual: attributionReconciliation.residual,
    attributionResidualAbs: attributionReconciliation.residualAbs,
    attributionResidualShareOfTotal: attributionReconciliation.residualShareOfTotal,
    attributionReconciliationError: attributionReconciliation.reconciliationError,
    attributionComparisonTolerance: attributionReconciliation.comparisonTolerance,
    attributionQualityFlags: attributionReconciliation.qualityFlags,
  });
  const riskSupportability = recordSourceSupportabilityCheck(
    summary,
    "performance.risk.snapshot",
    "lotus-gateway",
    readSourceSupportabilityItems(riskSummary, concentration, drawdown, rolling, attribution)
  );

  recordPanelClassification("performance.risk.snapshot", "ready", "lotus-risk", {
    readyMetricCount: readyMetrics.length,
    sourceSupportabilityState: riskSupportability.state,
    sourceSupportabilityItems: riskSupportability.itemCount,
  });
  recordPanelClassification("performance.risk.concentration", "ready", "lotus-risk", {
    issuerCoverageRatio: concentrationPayload.issuer_concentration?.coverage_ratio_current,
  });
  recordPanelClassification("performance.risk.drawdown", "ready", "lotus-risk", {
    underwaterSeriesRows: drawdownPeriod.underwater_series.length,
  });
  recordPanelClassification("performance.risk.rolling", "ready", "lotus-risk", {
    windowCount: rollingPeriod.window_count_emitted,
    computableWindows: rollingWindowsWithLatestVolatility,
  });
  recordPanelClassification("performance.risk.historical_attribution", "ready", "lotus-risk", {
    contributorRows: contributors.length,
    residual: attributionReconciliation.residual,
    residualShareOfTotal: attributionReconciliation.residualShareOfTotal,
    qualityFlags: attributionReconciliation.qualityFlags,
  });
}
