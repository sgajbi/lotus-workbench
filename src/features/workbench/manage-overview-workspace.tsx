"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { PortfolioReviewContext } from "@/apps/portfolio/portfolio-screen-navigation";
import { useSourceRefreshAction } from "@/design-system";
import ManageOverview from "@/features/workbench/components/manage-overview";
import {
  isManageOverviewComplete,
  isManageOverviewPermissionError,
  manageOverviewQueryOptions,
  recheckManageOverview,
} from "@/features/workbench/manage-overview-query-options";
import type { ManageWorkspaceData } from "@/features/workbench/manage-workspace-data";
import ManageWorkspaceShell from "@/features/workbench/manage-workspace-shell";

import { ManageWorkspaceUnavailable } from "./manage-workspace-unavailable";

export default function ManageOverviewWorkspace({
  initialData,
  reviewContext,
  sessionId,
}: {
  initialData: ManageWorkspaceData;
  reviewContext: PortfolioReviewContext;
  sessionId?: string;
}) {
  const queryClient = useQueryClient();
  const queryContext = useMemo(
    () => ({
      portfolioId: reviewContext.portfolioId,
      sessionId,
      asOfDate: reviewContext.asOfDate,
      period: reviewContext.period,
      reportingCurrency: reviewContext.reportingCurrency,
    }),
    [
      reviewContext.asOfDate,
      reviewContext.period,
      reviewContext.portfolioId,
      reviewContext.reportingCurrency,
      sessionId,
    ],
  );
  const overviewQuery = useQuery(
    manageOverviewQueryOptions(queryContext, initialData),
  );
  const data = overviewQuery.data ?? initialData;
  const runRecheck = useCallback(
    () => recheckManageOverview(queryClient, queryContext),
    [queryClient, queryContext],
  );
  const recheck = useSourceRefreshAction({
    identity: JSON.stringify(queryContext),
    isRefreshing: overviewQuery.fetchStatus === "fetching",
    hasRefreshFailure: overviewQuery.isError,
    onRefresh: runRecheck,
  });

  if (
    data.sourceAccessWithheld ||
    isManageOverviewPermissionError(overviewQuery.error)
  ) {
    return (
      <ManageWorkspaceUnavailable detail="Your authenticated role does not currently provide access to this portfolio-management evidence." />
    );
  }

  return (
    <ManageWorkspaceShell
      data={data}
      mode="overview"
      reviewContext={reviewContext}
    >
      <ManageOverview
        data={data}
        reviewContext={reviewContext}
        checkedAt={
          isManageOverviewComplete(data) ? overviewQuery.dataUpdatedAt : null
        }
        actionRef={recheck.actionRef}
        recheckState={recheck.refreshState}
        onRecheck={recheck.refresh}
      />
    </ManageWorkspaceShell>
  );
}
