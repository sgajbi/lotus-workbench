"use client";

import { useEffect, useMemo, useRef } from "react";
import type { EChartsOption } from "echarts";

import { AnalyticsTable, ActionButton, ScreenStatePanel, WorkbenchChartShell, WorkbenchECharts, WorkbenchSummaryMetricStrip } from "@/design-system";
import { lotusThemeTokens } from "@/design-system/theme/tokens";
import { formatLabel } from "../formatters";
import { buildPerformanceAttributionTrendTableModel } from "./performance-analytics-table-models";
import type { PerformanceWorkspaceRequestPatch } from "./performance-workspace-types";
import { getAttributionTrendUnavailableBody, getAttributionTrendSummaryItems } from "./performance-attribution-presentations";
import { usePerformanceAttributionTrend } from "./use-performance-attribution-trend";
import styles from "./performance-attribution-trend-panel.module.css";
import type { PerformanceReviewContextSource } from "../performance-review-context";

type Props = {
  portfolioId: string;
  period: string;
  chartFrequency: string;
  attributionDimension: string;
  detailBasis: string;
  benchmark?: string;
  reportStartDate?: string;
  reportEndDate?: string;
  asOfDate?: string;
  reportingCurrency?: string;
  sourceContext: PerformanceReviewContextSource;
  onRequestChange?: (patch: PerformanceWorkspaceRequestPatch) => void;
};

const ATTRIBUTION_TREND_COLORS = {
  allocation: lotusThemeTokens.color.chart.categorical.allocation,
  selection: lotusThemeTokens.color.chart.categorical.selection,
  interaction: lotusThemeTokens.color.chart.categorical.interaction,
  total: lotusThemeTokens.color.chart.categorical.total,
};

const ATTRIBUTION_CHART_TEXT = {
  legendSize: Number.parseFloat(lotusThemeTokens.typography.size.textSm),
  axisSize: Number.parseFloat(lotusThemeTokens.typography.size.textXs),
  legendWeight: lotusThemeTokens.typography.variant.cardTitle.weight,
  axisWeight: lotusThemeTokens.typography.variant.dataLabel.weight,
  tooltipPadding: [Number.parseInt(lotusThemeTokens.spacing.step3, 10), Number.parseInt(lotusThemeTokens.spacing.step4, 10)] as [number, number],
};

export default function PerformanceAttributionTrendPanel({
  portfolioId,
  period,
  chartFrequency,
  attributionDimension,
  detailBasis,
  benchmark,
  reportStartDate,
  reportEndDate,
  asOfDate,
  reportingCurrency,
  sourceContext,
  onRequestChange,
}: Props) {
  const request = useMemo(
    () => ({
      portfolioId,
      period,
      chartFrequency,
      attributionDimension,
      detailBasis,
      benchmark,
      reportStartDate,
      reportEndDate,
      asOfDate,
      reportingCurrency,
    }),
    [asOfDate, attributionDimension, benchmark, chartFrequency, detailBasis, period, portfolioId, reportEndDate, reportStartDate, reportingCurrency],
  );
  const { state, refresh, requestKey } = usePerformanceAttributionTrend(request, sourceContext);
  const refreshButtonRef = useRef<HTMLButtonElement>(null);
  const restoreRefreshFocusRequestKeyRef = useRef<string | null>(null);
  const trend = state.status === "ready" ? state.trend : null;
  const rows = trend?.rows ?? null;
  const isSingleObservation = rows?.length === 1;
  const isMultiObservation = (rows?.length ?? 0) > 1;
  const evidenceState =
    state.status === "ready" ? (isMultiObservation ? "multi-observation" : isSingleObservation ? "single-observation" : "empty") : state.status;

  const chartOption = useMemo<EChartsOption | null>(() => {
    if (!isMultiObservation || !rows) {
      return null;
    }

    return {
      animation: false,
      color: [ATTRIBUTION_TREND_COLORS.allocation, ATTRIBUTION_TREND_COLORS.selection, ATTRIBUTION_TREND_COLORS.interaction, ATTRIBUTION_TREND_COLORS.total],
      grid: {
        left: 54,
        right: 24,
        top: 20,
        bottom: 48,
        containLabel: true,
      },
      legend: {
        bottom: 6,
        left: "center",
        itemWidth: 18,
        itemHeight: 8,
        itemGap: 16,
        textStyle: {
          color: lotusThemeTokens.color.chart.chrome.axis,
          fontSize: ATTRIBUTION_CHART_TEXT.legendSize,
          fontWeight: ATTRIBUTION_CHART_TEXT.legendWeight,
        },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        borderColor: lotusThemeTokens.color.chart.chrome.tooltipBorder,
        backgroundColor: lotusThemeTokens.color.chart.chrome.tooltipBackground,
        padding: ATTRIBUTION_CHART_TEXT.tooltipPadding,
        textStyle: {
          color: lotusThemeTokens.color.text.primary,
          fontSize: ATTRIBUTION_CHART_TEXT.legendSize,
          fontWeight: ATTRIBUTION_CHART_TEXT.legendWeight,
        },
        valueFormatter: (value: unknown) => (typeof value === "number" ? `${value.toFixed(2)}%` : ""),
      },
      xAxis: {
        type: "category",
        data: rows.map((row) => row.period_label),
        axisLine: { lineStyle: { color: lotusThemeTokens.color.chart.chrome.grid } },
        axisTick: { show: false },
        axisLabel: {
          color: lotusThemeTokens.color.chart.chrome.axis,
          fontSize: ATTRIBUTION_CHART_TEXT.axisSize,
          fontWeight: ATTRIBUTION_CHART_TEXT.axisWeight,
        },
      },
      yAxis: [
        {
          type: "value",
          axisLabel: {
            color: lotusThemeTokens.color.chart.chrome.axis,
            formatter: (value: number) => `${value}%`,
          },
          splitLine: {
            lineStyle: {
              color: lotusThemeTokens.color.chart.chrome.grid,
            },
          },
        },
      ],
      series: [
        {
          name: "Allocation",
          type: "bar",
          stack: "effects",
          data: rows.map((row) => row.allocation_pct),
          barWidth: 14,
          itemStyle: {
            borderColor: lotusThemeTokens.color.chart.categorical.allocation,
            borderWidth: 1,
          },
        },
        {
          name: "Selection",
          type: "bar",
          stack: "effects",
          data: rows.map((row) => row.selection_pct),
          barWidth: 14,
          itemStyle: {
            borderColor: lotusThemeTokens.color.chart.categorical.selection,
            borderWidth: 1,
          },
        },
        {
          name: "Interaction",
          type: "bar",
          stack: "effects",
          data: rows.map((row) => row.interaction_pct),
          barWidth: 14,
          itemStyle: {
            borderColor: lotusThemeTokens.color.chart.categorical.interaction,
            borderWidth: 1,
          },
        },
        {
          name: "Cumulative effect",
          type: "line",
          data: rows.map((row) => row.cumulative_total_effect_pct),
          smooth: false,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: {
            width: 3,
            color: ATTRIBUTION_TREND_COLORS.total,
            cap: "round",
            join: "round",
          },
        },
      ],
    };
  }, [isMultiObservation, rows]);

  const tableModel = useMemo(() => buildPerformanceAttributionTrendTableModel({ rows: rows ?? [] }), [rows]);
  const metricItems = useMemo(() => getAttributionTrendSummaryItems(trend), [trend]);
  const normalizationMessages: string[] = [];
  if (trend?.requested_chart_frequency_supported === false) {
    normalizationMessages.push(`frequency reset to ${formatLabel(trend.chart_frequency)}`);
  }
  if (trend?.requested_attribution_dimension_supported === false) {
    normalizationMessages.push(`segment reset to ${formatLabel(trend.attribution_dimension)}`);
  }

  useEffect(() => {
    if (!trend || !onRequestChange) {
      return;
    }

    const patch: PerformanceWorkspaceRequestPatch = {};
    if (trend.requested_chart_frequency_supported === false && trend.chart_frequency !== chartFrequency) {
      patch.chartFrequency = trend.chart_frequency;
    }
    if (trend.requested_attribution_dimension_supported === false && trend.attribution_dimension !== attributionDimension) {
      patch.attributionDimension = trend.attribution_dimension;
    }

    if (Object.keys(patch).length > 0) {
      onRequestChange(patch);
    }
  }, [attributionDimension, chartFrequency, onRequestChange, trend]);

  useEffect(() => {
    if (
      restoreRefreshFocusRequestKeyRef.current &&
      restoreRefreshFocusRequestKeyRef.current !== requestKey
    ) {
      restoreRefreshFocusRequestKeyRef.current = null;
    }

    if (state.status === "loading" || !restoreRefreshFocusRequestKeyRef.current) {
      return;
    }

    const activeElement = document.activeElement;
    const shouldRestore =
      restoreRefreshFocusRequestKeyRef.current === requestKey &&
      (activeElement === document.body || activeElement === refreshButtonRef.current);
    restoreRefreshFocusRequestKeyRef.current = null;
    if (shouldRestore) {
      refreshButtonRef.current?.focus();
    }
  }, [requestKey, state.status]);

  return (
    <WorkbenchChartShell
      title={isSingleObservation ? "Attribution Observation" : "Attribution Over Time"}
      className="performance-analysis-module performance-analysis-trend-shell performance-workspace-panel"
      actions={
        <div className={styles.actions}>
          <span className={`performance-analysis-shell-action ${styles.frequency}`}>{trend?.chart_frequency ?? chartFrequency}</span>
          <ActionButton
            ref={refreshButtonRef}
            priority="quiet"
            className={styles.refresh}
            disabled={state.status === "loading" || state.status === "permission_blocked"}
            onClick={() => {
              restoreRefreshFocusRequestKeyRef.current =
                document.activeElement === refreshButtonRef.current ? requestKey : null;
              refresh();
            }}
          >
            {state.status === "loading" ? "Refreshing…" : state.status === "permission_blocked" ? "History restricted" : "Refresh history"}
          </ActionButton>
        </div>
      }
      metricStrip={
        metricItems.length ? (
          <WorkbenchSummaryMetricStrip
            layout="custom"
            className="performance-analysis-metric-strip"
            ariaLabel="Attribution trend summary strip"
            items={metricItems}
          />
        ) : undefined
      }
    >
      <div className={styles.evidence} data-testid="attribution-trend-evidence" data-state={evidenceState} data-observation-count={rows?.length ?? 0}>
        {normalizationMessages.length > 0 ? (
          <div className="performance-control-normalization-note" role="status" aria-label="Attribution trend normalization">
            <p className="performance-control-normalization-note-title">Selection adjusted</p>
            <p className="performance-control-normalization-note-message">
              Unsupported controls were replaced with supported defaults: {normalizationMessages.join(" • ")}.
            </p>
          </div>
        ) : null}
        {state.status === "loading" ? (
          <ScreenStatePanel kind="loading" title="Loading attribution trend" body="Loading attribution effect trend." surface="analysis" />
        ) : state.status === "permission_blocked" ? (
          <div role="alert" aria-live="assertive" aria-atomic="true">
            <ScreenStatePanel
              kind="permission_blocked"
              title="Attribution history restricted"
              body="Your current access does not permit this attribution-history request. Other source-confirmed performance detail remains available."
              hint={state.httpStatus ? `Source response ${state.httpStatus}.` : undefined}
              surface="analysis"
            />
          </div>
        ) : state.status === "context_mismatch" ? (
          <div role="alert" aria-live="assertive" aria-atomic="true">
            <ScreenStatePanel
              kind="unavailable"
              title="Attribution history does not match this review"
              body="The source response did not confirm the selected portfolio, period, analytical basis, dimensions, benchmark, frequency, or review window. No attribution history has been presented."
              hint="Refresh the performance review before relying on attribution history."
              surface="analysis"
            />
          </div>
        ) : state.status === "error" ? (
          <div role="alert" aria-live="assertive" aria-atomic="true">
            <ScreenStatePanel
              kind="error"
              title="Attribution history could not be refreshed"
              body="The source request did not complete. The selected performance detail remains available, but attribution history is not confirmed."
              hint={
                state.httpStatus
                  ? `Source response ${state.httpStatus}. Use Refresh history to retry this exact selection.`
                  : "Use Refresh history to retry this exact selection."
              }
              surface="analysis"
            />
          </div>
        ) : chartOption ? (
          <>
            <div className="performance-chart-library-frame" role="img" aria-label="Attribution over time chart">
              <WorkbenchECharts option={chartOption} style={{ width: "100%", height: "344px" }} opts={{ renderer: "svg" }} notMerge lazyUpdate />
            </div>
            <AnalyticsTable
              ariaLabel="Attribution trend table"
              columns={tableModel.columns}
              rows={tableModel.rows}
              density="compact"
              variant="analysis"
              className="performance-analysis-table performance-attribution-trend-table"
            />
          </>
        ) : isSingleObservation ? (
          <section className={styles.singleObservation} aria-label="Single published attribution observation">
            <div className={styles.singleObservationNotice}>
              <strong>One published observation</strong>
              <span>
                {rows?.[0]?.period_label ?? "Selected period"} is available as exact evidence. A time trend requires at least two published observations.
              </span>
            </div>
            <AnalyticsTable
              ariaLabel="Attribution observation table"
              columns={tableModel.columns}
              rows={tableModel.rows}
              density="compact"
              variant="analysis"
              className="performance-analysis-table performance-attribution-trend-table"
            />
          </section>
        ) : (
          <ScreenStatePanel kind="unavailable" title="Attribution trend unavailable" body={getAttributionTrendUnavailableBody(trend)} surface="analysis" />
        )}
      </div>
    </WorkbenchChartShell>
  );
}
