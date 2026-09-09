import { queryOptions, skipToken } from "@tanstack/react-query";

import {
  getWorkbenchPerformanceWorkspaceDetailsClient,
  getWorkbenchPerformanceWorkspaceSummaryClient,
} from "@/features/workbench/api";
import type {
  WorkbenchPerformanceWorkspaceDetails,
  WorkbenchPerformanceWorkspaceSummary,
} from "@/features/workbench/types";
import { workbenchStrictQueryDefaults } from "@/features/platform-runtime/query-policy";

import {
  doPerformanceSummaryAndDetailsShareReviewContext,
  isPerformanceDetailsSourceCurrent,
  isPerformanceSummarySourceCurrent,
} from "./performance-source-identity";
import {
  performanceWorkspaceQueryKeys,
  type PerformanceWorkspaceQueryContext,
} from "./performance-workspace-query-keys";

type PerformanceQueryInitialData<Response> = Readonly<{
  initialData?: Response;
}>;

export function performanceWorkspaceSummaryQueryOptions(
  context: PerformanceWorkspaceQueryContext | null,
  initial?: PerformanceQueryInitialData<WorkbenchPerformanceWorkspaceSummary>,
) {
  return queryOptions({
    ...workbenchStrictQueryDefaults,
    queryKey: context
      ? performanceWorkspaceQueryKeys.summary(context)
      : performanceWorkspaceQueryKeys.unavailable("summary"),
    queryFn: context
      ? async ({ signal }) =>
          requireCurrentPerformanceSummary(
            await getWorkbenchPerformanceWorkspaceSummaryClient(
              context.portfolioId,
              buildPerformanceWorkspaceRequest(context),
              signal,
            ),
            context,
          )
      : skipToken,
    enabled: false,
    initialData: initial?.initialData,
  });
}

export function performanceWorkspaceDetailsQueryOptions(
  context: PerformanceWorkspaceQueryContext | null,
  summary: WorkbenchPerformanceWorkspaceSummary | null,
  initial?: PerformanceQueryInitialData<WorkbenchPerformanceWorkspaceDetails>,
) {
  return queryOptions({
    ...workbenchStrictQueryDefaults,
    queryKey:
      context && summary
        ? performanceWorkspaceQueryKeys.details(context, {
            correlationId: summary.correlation_id,
            effectiveAsOfDate: summary.effective_as_of_date,
            effectiveReportingCurrency: summary.effective_reporting_currency,
          })
        : performanceWorkspaceQueryKeys.unavailable("details"),
    queryFn:
      context && summary
        ? async ({ signal }) =>
            requireCurrentPerformanceDetails(
              await getWorkbenchPerformanceWorkspaceDetailsClient(
                context.portfolioId,
                buildPerformanceWorkspaceRequest(context),
                signal,
              ),
              context,
              summary,
            )
        : skipToken,
    enabled: false,
    initialData: initial?.initialData,
  });
}

export function requireCurrentPerformanceDetails(
  details: WorkbenchPerformanceWorkspaceDetails,
  context: PerformanceWorkspaceQueryContext,
  summary: WorkbenchPerformanceWorkspaceSummary,
): WorkbenchPerformanceWorkspaceDetails {
  if (
    !isPerformanceDetailsSourceCurrent(details, buildSourceIdentity(context)) ||
    !doPerformanceSummaryAndDetailsShareReviewContext(summary, details)
  ) {
    throw new Error("Performance analytical detail did not confirm the requested source identity.");
  }
  return details;
}

export function requireCurrentPerformanceSummary(
  summary: WorkbenchPerformanceWorkspaceSummary,
  context: PerformanceWorkspaceQueryContext,
): WorkbenchPerformanceWorkspaceSummary {
  if (!isPerformanceSummarySourceCurrent(summary, buildSourceIdentity(context))) {
    throw new Error("Performance summary did not confirm the requested source identity.");
  }
  return summary;
}

function buildPerformanceWorkspaceRequest(context: PerformanceWorkspaceQueryContext) {
  return {
    period: context.period,
    chartFrequency: context.chartFrequency,
    contributionDimension: context.contributionDimension,
    attributionDimension: context.attributionDimension,
    detailBasis: context.detailBasis,
    benchmark: context.benchmark,
    reportStartDate: context.reportStartDate,
    reportEndDate: context.reportEndDate,
    asOfDate: context.reviewAsOfDate,
    reportingCurrency: context.reviewReportingCurrency,
  };
}

function buildSourceIdentity(context: PerformanceWorkspaceQueryContext) {
  return {
    portfolioId: context.portfolioId,
    period: context.period,
    reportStartDate: context.reportStartDate,
    reportEndDate: context.reportEndDate,
    asOfDate: context.reviewAsOfDate,
    reportingCurrency: context.reviewReportingCurrency,
    detailBasis: context.detailBasis,
    contributionDimension: context.contributionDimension,
    attributionDimension: context.attributionDimension,
    chartFrequency: context.chartFrequency,
    benchmark: context.benchmark,
  };
}
