"use client";

import { useCallback, useLayoutEffect, useMemo } from "react";
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
  const runRecheck = useCallback(
    () => recheckManageOverview(queryClient, queryContext),
    [queryClient, queryContext],
  );
  const {
    actionRef: recheckActionRef,
    refresh: recheckOverview,
    refreshState: recheckState,
    reset: resetRecheck,
  } = useSourceRefreshAction({
    identity: JSON.stringify(queryContext),
    isRefreshing: overviewQuery.fetchStatus === "fetching",
    hasRefreshFailure: overviewQuery.isError,
    onRefresh: runRecheck,
  });
  useLayoutEffect(() => {
    const options = manageOverviewQueryOptions(queryContext);
    const cachedData = queryClient.getQueryData<ManageWorkspaceData>(options.queryKey);
    const incomingAdmissionIsAuthoritative =
      initialData.sourceAccessWithheld === true || isManageOverviewComplete(initialData);
    const cachedAdmissionIsComplete =
      cachedData !== undefined && isManageOverviewComplete(cachedData);

    // A transient server-side source failure is not a newer admission than a complete
    // receipt already held for this exact context. A fresh complete composite, or a
    // fresh access refusal, remains authoritative and must supersede that receipt.
    if (!incomingAdmissionIsAuthoritative && cachedAdmissionIsComplete) {
      // TanStack Query retains a failed recheck alongside its data. The fresh server
      // receipt did not withhold access, so retain the complete evidence while
      // clearing that stale denial rather than requiring another explicit recheck.
      queryClient.setQueryData(options.queryKey, cachedData, {
        updatedAt: queryClient.getQueryState(options.queryKey)?.dataUpdatedAt,
      });
      return;
    }

    // A server-composed Overview is a fresher, authoritative receipt for this exact
    // context. Cancel first so a recheck started before navigation cannot restore
    // older evidence after a server denial or newer server composite is admitted.
    // Reset its local outcome first: this cancellation supersedes the recheck rather
    // than representing a failed source read.
    resetRecheck();
    void queryClient.cancelQueries({ queryKey: options.queryKey, exact: true });
    queryClient.setQueryData(options.queryKey, initialData);
  }, [initialData, queryClient, queryContext, resetRecheck]);

  // Layout admission runs before a browser paint, so a same-key cached composite
  // cannot be shown while an authoritative incoming server receipt replaces it.
  const data = overviewQuery.data ?? initialData;
  const model = useMemo(
    () => buildManageOverviewModel(data, reviewContext),
    [data, reviewContext],
  );
  if (
    data.sourceAccessWithheld ||
    isManageOverviewPermissionError(overviewQuery.error)
  ) {
    return (
      <ManageWorkspaceUnavailable
        detail="Your authenticated role does not currently provide access to this portfolio-management evidence."
        action={
          <ActionButton
            ref={recheckActionRef}
            priority="quiet"
            disabled={recheckState === "pending"}
            onClick={() => void recheckOverview().catch(() => undefined)}
          >
            {recheckState === "pending" ? "Rechecking…" : "Recheck overview"}
          </ActionButton>
        }
      />
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
          {isManageOverviewComplete(data) && overviewQuery.dataUpdatedAt
            ? "Overview recheck failed. The displayed portfolio-management evidence remains from the previous successful check."
            : "Overview recheck failed. No complete portfolio-management evidence has been admitted yet."}
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
