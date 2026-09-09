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

type PerformanceWorkspaceRevalidationScope = "summary" | "details";

class PerformanceWorkspaceRevalidationError extends Error {
  constructor(
    readonly scope: PerformanceWorkspaceRevalidationScope,
    readonly sourceError: unknown,
  ) {
    super(`Performance ${scope} revalidation failed.`, { cause: sourceError });
    this.name = "PerformanceWorkspaceRevalidationError";
  }
}

export function performanceWorkspaceSummaryQueryOptions(
  context: PerformanceWorkspaceQueryContext | null,
  initial?: PerformanceQueryInitialData<WorkbenchPerformanceWorkspaceSummary>,
) {
  return queryOptions({
    ...workbenchStrictQueryDefaults,
    queryKey: context
      ? performanceWorkspaceQueryKeys.summaryResponse(context)
      : performanceWorkspaceQueryKeys.unavailable("summary"),
    queryFn: context
      ? ({ signal }) => fetchCurrentPerformanceSummary(context, signal)
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
        ? ({ signal }) => fetchCurrentPerformanceDetails(context, summary, signal)
        : skipToken,
    enabled: false,
    initialData: initial?.initialData,
  });
}

export function performanceWorkspaceRevalidationQueryOptions(
  context: PerformanceWorkspaceQueryContext,
) {
  return queryOptions({
    ...workbenchStrictQueryDefaults,
    queryKey: performanceWorkspaceQueryKeys.revalidation(context),
    queryFn: async ({ signal }) => {
      let summary: WorkbenchPerformanceWorkspaceSummary;
      try {
        summary = await fetchCurrentPerformanceSummary(context, signal);
      } catch (error) {
        throw new PerformanceWorkspaceRevalidationError("summary", error);
      }
      let details: WorkbenchPerformanceWorkspaceDetails;
      try {
        details = await fetchCurrentPerformanceDetails(context, summary, signal);
      } catch (error) {
        throw new PerformanceWorkspaceRevalidationError("details", error);
      }
      return { summary, details };
    },
  });
}

export function resolvePerformanceWorkspaceRevalidationError(error: unknown) {
  return error instanceof PerformanceWorkspaceRevalidationError
    ? { scope: error.scope, sourceError: error.sourceError }
    : { scope: "details" as const, sourceError: error };
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

async function fetchCurrentPerformanceSummary(
  context: PerformanceWorkspaceQueryContext,
  signal: AbortSignal,
) {
  return requireCurrentPerformanceSummary(
    await getWorkbenchPerformanceWorkspaceSummaryClient(
      context.portfolioId,
      buildPerformanceWorkspaceRequest(context),
      signal,
    ),
    context,
  );
}

async function fetchCurrentPerformanceDetails(
  context: PerformanceWorkspaceQueryContext,
  summary: WorkbenchPerformanceWorkspaceSummary,
  signal: AbortSignal,
) {
  return requireCurrentPerformanceDetails(
    await getWorkbenchPerformanceWorkspaceDetailsClient(
      context.portfolioId,
      buildPerformanceWorkspaceRequest(context),
      signal,
    ),
    context,
    summary,
  );
}
