type PerformanceRiskSource = Readonly<{
  portfolio_id: string;
  period: string;
  detail_basis?: string;
  as_of_date: string;
  benchmark_code?: string | null;
  requested_report_start_date?: string | null;
  requested_report_end_date?: string | null;
  state?: string;
  payload?: unknown;
}>;

type RiskPeriod = Readonly<
  { key: string; start_date: string; end_date: string } & Record<
    string,
    unknown
  >
>;

export type PerformanceRiskSourceIdentity = Readonly<{
  portfolioId: string;
  period: string;
  detailBasis?: string;
  asOfDate: string;
  benchmark: string | null;
  reportStartDate?: string;
  reportEndDate?: string;
  attributionType?: string;
  groupingDimension?: string;
  includeUnderwaterSeries?: boolean;
  includeTimeSeries?: boolean;
  windowEvidence?: "periods" | "point_in_time";
}>;

export function isPerformanceRiskSourceCurrent(
  source: PerformanceRiskSource,
  identity: PerformanceRiskSourceIdentity,
): boolean {
  const sourceIdentityMatches =
    source.portfolio_id === identity.portfolioId &&
    source.period === identity.period &&
    (identity.detailBasis === undefined ||
      source.detail_basis === identity.detailBasis) &&
    source.as_of_date === identity.asOfDate &&
    (source.benchmark_code ?? null) === identity.benchmark;
  if (!sourceIdentityMatches) {
    return false;
  }
  if (!hasMatchingRequestedRiskWindowIdentity(source, identity)) {
    return false;
  }
  if (isSourceDeclaredFailureWithoutResults(source)) {
    return true;
  }
  return (
    hasRequestedRiskWindow(source, identity) &&
    hasRequestedRiskAttribution(source, identity) &&
    hasRequestedRiskDetail(source, identity)
  );
}

function isSourceDeclaredFailureWithoutResults(
  source: PerformanceRiskSource,
): boolean {
  const periods = readRiskPeriods(source.payload);
  return (
    (source.state === "unavailable" || source.state === "blocked") &&
    (source.payload == null || periods?.length === 0)
  );
}

function hasRequestedRiskDetail(
  source: PerformanceRiskSource,
  identity: PerformanceRiskSourceIdentity,
): boolean {
  if (
    identity.includeUnderwaterSeries === undefined &&
    identity.includeTimeSeries === undefined
  ) {
    return true;
  }
  const payload = source.payload;
  if (!payload || typeof payload !== "object") {
    return false;
  }
  return (
    hasRequestedBoolean(
      payload,
      "analysis_context",
      "include_underwater_series",
      identity.includeUnderwaterSeries,
    ) &&
    hasRequestedBoolean(
      payload,
      "request_context",
      "include_time_series",
      identity.includeTimeSeries,
    )
  );
}

function hasRequestedBoolean(
  payload: object,
  contextKey: string,
  valueKey: string,
  requested: boolean | undefined,
): boolean {
  if (requested === undefined) {
    return true;
  }
  if (!(contextKey in payload)) {
    return false;
  }
  const context = payload[contextKey as keyof typeof payload];
  return Boolean(
    context &&
    typeof context === "object" &&
    valueKey in context &&
    context[valueKey as keyof typeof context] === requested,
  );
}

function hasRequestedRiskWindow(
  source: PerformanceRiskSource,
  identity: PerformanceRiskSourceIdentity,
): boolean {
  if (identity.windowEvidence === "point_in_time") {
    return hasMatchingPointInTimeExecutionContext(source.payload, identity);
  }
  if (!identity.reportStartDate && !identity.reportEndDate) {
    const periods = readRiskPeriods(source.payload);
    return Boolean(
      periods?.length &&
      periods.every(
        (period) =>
          period.key === identity.period &&
          period.end_date === identity.asOfDate &&
          hasRiskSeriesWithinPeriod(period),
      ),
    );
  }

  const periods = readRiskPeriods(source.payload);
  const hasGovernedRequestedWindow = hasRequestedRiskWindowFields(source);
  return Boolean(
    periods?.length &&
    periods.every(
      (period) =>
        period.key === identity.period &&
        (!identity.reportStartDate ||
          (hasGovernedRequestedWindow
            ? period.start_date >= identity.reportStartDate
            : period.start_date === identity.reportStartDate)) &&
        (!identity.reportEndDate ||
          period.end_date === identity.reportEndDate) &&
        hasRiskSeriesWithinPeriod(period),
    ),
  );
}

function hasMatchingRequestedRiskWindowIdentity(
  source: PerformanceRiskSource,
  identity: PerformanceRiskSourceIdentity,
): boolean {
  if (!hasRequestedRiskWindowFields(source)) {
    return true;
  }
  return (
    (source.requested_report_start_date ?? null) ===
      (identity.reportStartDate ?? null) &&
    (source.requested_report_end_date ?? null) ===
      (identity.reportEndDate ?? null)
  );
}

function hasRequestedRiskWindowFields(source: PerformanceRiskSource): boolean {
  return (
    Object.prototype.hasOwnProperty.call(
      source,
      "requested_report_start_date",
    ) ||
    Object.prototype.hasOwnProperty.call(source, "requested_report_end_date")
  );
}

function hasRiskSeriesWithinPeriod(period: RiskPeriod): boolean {
  return (
    period.start_date <= period.end_date &&
    hasDatedSeriesWithinPeriod(period.underwater_series, period) &&
    hasRollingSeriesWithinPeriod(period.window_results, period) &&
    hasDrawdownEventsWithinPeriod(period)
  );
}

function isStrictIsoDate(value: string): boolean {
  const match = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/.exec(value);
  if (!match?.groups) return false;
  const year = Number(match.groups.year);
  const month = Number(match.groups.month);
  const day = Number(match.groups.day);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function hasDrawdownEventsWithinPeriod(period: RiskPeriod): boolean {
  return (
    hasDrawdownDateRecord(period.summary, period) &&
    hasDrawdownDateRecord(period.relative_to_benchmark, period) &&
    hasDrawdownEpisodesWithinPeriod(period.episodes, period)
  );
}

function hasDrawdownEpisodesWithinPeriod(
  episodes: unknown,
  period: RiskPeriod,
): boolean {
  if (episodes === undefined) {
    return true;
  }
  return (
    Array.isArray(episodes) &&
    episodes.every((episode) => hasDrawdownDateRecord(episode, period))
  );
}

function hasDrawdownDateRecord(value: unknown, period: RiskPeriod): boolean {
  if (value == null) {
    return true;
  }
  if (typeof value !== "object") {
    return false;
  }
  const record = value as Readonly<Record<string, unknown>>;
  const usesSummaryDates =
    "max_drawdown_peak_date" in record ||
    "max_drawdown_trough_date" in record ||
    "max_drawdown_recovery_date" in record;
  const usesEpisodeDates =
    "peak_date" in record ||
    "trough_date" in record ||
    "recovery_date" in record;
  if (!usesSummaryDates && !usesEpisodeDates) {
    return true;
  }
  const peak = usesSummaryDates
    ? record.max_drawdown_peak_date
    : record.peak_date;
  const trough = usesSummaryDates
    ? record.max_drawdown_trough_date
    : record.trough_date;
  const recovery = usesSummaryDates
    ? record.max_drawdown_recovery_date
    : record.recovery_date;
  return (
    isDateWithinRiskPeriod(peak, period) &&
    isDateWithinRiskPeriod(trough, period) &&
    peak <= trough &&
    (recovery == null ||
      (isDateWithinRiskPeriod(recovery, period) && trough <= recovery))
  );
}

function isDateWithinRiskPeriod(
  value: unknown,
  period: RiskPeriod,
): value is string {
  return (
    typeof value === "string" &&
    isStrictIsoDate(value) &&
    value >= period.start_date &&
    value <= period.end_date
  );
}

function hasDatedSeriesWithinPeriod(
  series: unknown,
  period: RiskPeriod,
): boolean {
  if (series == null) {
    return true;
  }
  if (!Array.isArray(series)) {
    return false;
  }
  let previousDate: string | null = null;
  for (const point of series) {
    if (
      point == null ||
      typeof point !== "object" ||
      !("date" in point) ||
      typeof point.date !== "string" ||
      !isStrictIsoDate(point.date) ||
      point.date < period.start_date ||
      point.date > period.end_date ||
      (previousDate !== null && point.date <= previousDate)
    ) {
      return false;
    }
    previousDate = point.date;
  }
  return true;
}

function hasRollingSeriesWithinPeriod(
  windowResults: unknown,
  period: RiskPeriod,
): boolean {
  if (windowResults == null) {
    return true;
  }
  return (
    Array.isArray(windowResults) &&
    windowResults.every(
      (window) =>
        window != null &&
        typeof window === "object" &&
        hasDatedSeriesWithinPeriod(
          "metric_series" in window ? window.metric_series : null,
          period,
        ),
    )
  );
}

function hasMatchingPointInTimeExecutionContext(
  payload: unknown,
  identity: PerformanceRiskSourceIdentity,
): boolean {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("execution_context" in payload)
  ) {
    return true;
  }
  const executionContext = payload.execution_context;
  if (!executionContext || typeof executionContext !== "object") {
    return false;
  }
  return (
    (!("as_of_date" in executionContext) ||
      executionContext.as_of_date == null ||
      executionContext.as_of_date === identity.asOfDate) &&
    (!("portfolio_id" in executionContext) ||
      executionContext.portfolio_id == null ||
      executionContext.portfolio_id === identity.portfolioId)
  );
}

function hasRequestedRiskAttribution(
  source: PerformanceRiskSource,
  identity: PerformanceRiskSourceIdentity,
): boolean {
  if (!identity.attributionType && !identity.groupingDimension) {
    return true;
  }
  if (!identity.attributionType || !identity.groupingDimension) {
    return false;
  }

  const payload = source.payload;
  if (!payload || typeof payload !== "object" || !("controls" in payload)) {
    return false;
  }
  const controls = payload.controls;
  if (
    !controls ||
    typeof controls !== "object" ||
    !("selected_attribution_type" in controls) ||
    controls.selected_attribution_type !== identity.attributionType ||
    !("selected_grouping_dimension" in controls) ||
    controls.selected_grouping_dimension !== identity.groupingDimension
  ) {
    return false;
  }

  if (!("periods" in payload) || !Array.isArray(payload.periods)) {
    return false;
  }
  return payload.periods.every(
    (period) =>
      period &&
      typeof period === "object" &&
      "attribution_sets" in period &&
      Array.isArray(period.attribution_sets) &&
      period.attribution_sets.length > 0 &&
      period.attribution_sets.every(
        (set: unknown) =>
          set &&
          typeof set === "object" &&
          "attribution_type" in set &&
          set.attribution_type === identity.attributionType &&
          "grouping_dimension" in set &&
          set.grouping_dimension === identity.groupingDimension,
      ),
  );
}

function readRiskPeriods(payload: unknown): ReadonlyArray<RiskPeriod> | null {
  if (!payload || typeof payload !== "object" || !("periods" in payload)) {
    return null;
  }
  const periods = payload.periods;
  if (!Array.isArray(periods)) {
    return null;
  }
  return periods.every(
    (period) =>
      period &&
      typeof period === "object" &&
      "start_date" in period &&
      typeof period.start_date === "string" &&
      isStrictIsoDate(period.start_date) &&
      "key" in period &&
      typeof period.key === "string" &&
      "end_date" in period &&
      typeof period.end_date === "string" &&
      isStrictIsoDate(period.end_date),
  )
    ? periods
    : null;
}

export function requireCurrentPerformanceRiskSource<
  Source extends PerformanceRiskSource,
>(source: Source, identity: PerformanceRiskSourceIdentity): Source {
  if (!isPerformanceRiskSourceCurrent(source, identity)) {
    throw new TypeError(
      "Risk evidence does not confirm the requested source identity.",
    );
  }
  return source;
}
