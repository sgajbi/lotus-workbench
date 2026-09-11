import {
  fetchWorkbenchResource,
  observeWorkbenchResource,
  type WorkbenchRequestTarget,
} from "@/features/workbench/api-client";
import type {
  WorkbenchAnalytics,
  WorkbenchOverview,
  WorkbenchPortfolio360,
  WorkbenchReportingSnapshot,
} from "@/features/workbench/types";

export async function getWorkbenchOverview(portfolioId: string): Promise<WorkbenchOverview> {
  return await observeWorkbenchResource(
    "workbench.overview",
    async () =>
      await fetchWorkbenchResource<WorkbenchOverview>(
        "server",
        `/workbench/${portfolioId}/overview`,
        "overview"
      )
  );
}

export async function getPortfolio360(
  portfolioId: string,
  sessionId?: string,
  target: WorkbenchRequestTarget = "server",
  signal?: AbortSignal,
): Promise<WorkbenchPortfolio360> {
  const query = sessionId
    ? new URLSearchParams({ session_id: sessionId })
    : undefined;
  return await observeWorkbenchResource(
    "workbench.portfolio-360",
    async () =>
      await fetchWorkbenchResource<WorkbenchPortfolio360>(
        target,
        `/workbench/${portfolioId}/portfolio-360`,
        "portfolio 360",
        query,
        { signal },
      )
  );
}

export async function getWorkbenchAnalytics(
  portfolioId: string,
  params: {
    period: string;
    groupBy: string;
    benchmark?: string;
    sessionId?: string;
  }
): Promise<WorkbenchAnalytics> {
  const query = new URLSearchParams();
  query.set("period", params.period);
  query.set("group_by", params.groupBy);
  if (params.benchmark) {
    query.set("benchmark_code", params.benchmark);
  }
  if (params.sessionId) {
    query.set("session_id", params.sessionId);
  }
  return await observeWorkbenchResource(
    "workbench.analytics",
    async () =>
      await fetchWorkbenchResource<WorkbenchAnalytics>(
        "server",
        `/workbench/${portfolioId}/analytics`,
        "workbench analytics",
        query
      )
  );
}

export async function getReportingSnapshot(
  portfolioId: string,
  asOfDate: string
): Promise<WorkbenchReportingSnapshot> {
  const query = new URLSearchParams();
  query.set("asOfDate", asOfDate);
  return await observeWorkbenchResource(
    "workbench.reporting-snapshot",
    async () =>
      await fetchWorkbenchResource<WorkbenchReportingSnapshot>(
        "server",
        `/reports/${portfolioId}/snapshot`,
        "reporting snapshot",
        query
      )
  );
}
