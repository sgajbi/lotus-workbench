"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { PortfolioReviewContext } from "@/apps/portfolio/portfolio-screen-navigation";
import {
  ActionButton,
  SemanticBadge,
  useSourceRefreshAction,
  WorkbenchDataAge,
} from "@/design-system";
import ManageOverview from "@/features/workbench/components/manage-overview";
import overviewStyles from "@/features/workbench/components/manage-overview.module.css";
import { buildManageOverviewModel } from "@/features/workbench/manage-overview-model";
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
  const model = useMemo(
    () => buildManageOverviewModel(data, reviewContext),
    [data, reviewContext],
  );
  const runRecheck = useCallback(
    () => recheckManageOverview(queryClient, queryContext),
    [queryClient, queryContext],
  );
  const {
    actionRef: recheckActionRef,
    refresh: recheckOverview,
    refreshState: recheckState,
  } = useSourceRefreshAction({
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
      actions={
        <div className={overviewStyles.receiptActions}>
          <SemanticBadge tone={model.overviewPostureTone} emphasis="strong">
            {model.overviewPostureLabel}
          </SemanticBadge>
          {isManageOverviewComplete(data) && overviewQuery.dataUpdatedAt ? (
            <WorkbenchDataAge updatedAt={overviewQuery.dataUpdatedAt} />
          ) : null}
          <ActionButton
            ref={recheckActionRef}
            priority="quiet"
            disabled={recheckState === "pending"}
            onClick={() => void recheckOverview().catch(() => undefined)}
          >
            {recheckState === "pending" ? "Rechecking…" : "Recheck overview"}
          </ActionButton>
        </div>
      }
    >
      {recheckState === "failed" ? (
        <p className={overviewStyles.recheckFailure} role="status">
          Overview recheck failed. The displayed portfolio-management evidence remains from the
          previous successful check.
        </p>
      ) : null}
      <ManageOverview
        data={data}
        reviewContext={reviewContext}
        model={model}
      />
    </ManageWorkspaceShell>
  );
}
