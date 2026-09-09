export type PerformanceWorkspaceQueryContext = Readonly<{
  portfolioId: string;
  period: string;
  detailBasis: string;
  contributionDimension: string;
  attributionDimension: string;
  chartFrequency: string;
  benchmark?: string;
  reportStartDate?: string;
  reportEndDate?: string;
  reviewAsOfDate?: string;
  reviewReportingCurrency?: string;
}>;

type PerformanceSummaryEvidenceIdentity = Readonly<{
  correlationId: string;
  effectiveAsOfDate: string;
  effectiveReportingCurrency: string | null;
}>;

function normalizedContext(context: PerformanceWorkspaceQueryContext) {
  const isExplicitWindow = context.period === "EXPLICIT";
  return {
    period: context.period,
    detailBasis: context.detailBasis,
    contributionDimension: context.contributionDimension,
    attributionDimension: context.attributionDimension,
    chartFrequency: context.chartFrequency,
    benchmark: context.benchmark ?? null,
    reportStartDate: isExplicitWindow ? context.reportStartDate ?? null : null,
    reportEndDate: isExplicitWindow ? context.reportEndDate ?? null : null,
    reviewAsOfDate: context.reviewAsOfDate ?? null,
    reviewReportingCurrency: context.reviewReportingCurrency ?? null,
  };
}

export const performanceWorkspaceQueryKeys = {
  all: ["performance", "workspace"] as const,
  unavailable: (resource: "summary" | "details") =>
    [...performanceWorkspaceQueryKeys.all, "unavailable", resource] as const,
  portfolio: (portfolioId: string) =>
    [...performanceWorkspaceQueryKeys.all, portfolioId] as const,
  summaryResponse: (context: PerformanceWorkspaceQueryContext) =>
    [
      ...performanceWorkspaceQueryKeys.portfolio(context.portfolioId),
      "summary",
      normalizedContext(context),
    ] as const,
  details: (
    context: PerformanceWorkspaceQueryContext,
    summaryEvidence: PerformanceSummaryEvidenceIdentity,
  ) =>
    [
      ...performanceWorkspaceQueryKeys.portfolio(context.portfolioId),
      "details",
      normalizedContext(context),
      { summaryEvidence },
    ] as const,
};
