"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AppPageShell } from "@/design-system";
import type { PortfolioWorkspace } from "@/apps/portfolio/types";
import { getWorkbenchApiErrorStatus, isWorkbenchPermissionBlockedError } from "@/features/workbench/api";
import type {
  WorkbenchPerformanceWorkspace,
  WorkbenchPerformanceWorkspaceDetails,
  WorkbenchPerformanceWorkspaceSummary,
} from "@/features/workbench/types";
import { WORKBENCH_QUERY_STALE_TIME_MS } from "@/features/platform-runtime/query-policy";

import { buildPerformanceHref } from "../navigation";
import {
  doPerformanceSummaryAndDetailsShareReviewContext,
  isPerformanceDetailsSourceCurrent,
} from "../performance-source-identity";
import type { PerformanceWorkspaceMode } from "../performance-workspace-modes";
import { assemblePerformanceWorkspace } from "../workspace-assembler";
import { getNormalizedInitialPerformanceDetailControls } from "../performance-detail-control-resolution";
import {
  admitPerformanceQueryData,
  fetchPerformanceWorkspaceRevalidation,
  fetchPerformanceWorkspaceSummary,
  performanceWorkspaceDetailsQueryOptions,
  performanceWorkspaceSummaryQueryOptions,
  resolvePerformanceWorkspaceRevalidationError,
} from "../performance-workspace-query-options";
import {
  performanceWorkspaceQueryKeys,
  type PerformanceWorkspaceQueryContext,
} from "../performance-workspace-query-keys";
import { restorePerformanceSourceControlFocus } from "./performance-source-control-focus";
import PerformanceWorkspaceView from "./performance-workspace-view";
import { buildPerformanceReviewContextStrip } from "../performance-review-context-strip-view-model";
import { buildPerformanceReviewContextNotice } from "../performance-review-context-notice";
import type {
  PerformanceSourceControlFocusTarget,
  PerformanceWorkspaceLoadIssue,
  PerformanceWorkspaceRefreshStatus,
} from "./performance-workspace-types";

type PerformanceWorkspaceClientProps = {
  initialSummary: WorkbenchPerformanceWorkspaceSummary | null;
  initialDetails?: WorkbenchPerformanceWorkspaceDetails | null;
  initialLoadIssue?: PerformanceWorkspaceLoadIssue | null;
  initialPortfolioId: string | null;
  initialPeriod: string;
  initialDetailBasis: string;
  initialContributionDimension: string;
  initialAttributionDimension: string;
  initialChartFrequency: string;
  initialMode?: PerformanceWorkspaceMode;
  initialBenchmark?: string;
  initialAsOfDate?: string;
  initialReportingCurrency?: string;
  initialPortfolioContext?: PortfolioWorkspace | null;
};

type PerformanceControlState = PerformanceWorkspaceQueryContext & {
  sourceAsOfDate?: string;
};

type PerformanceDetailsStatus = "idle" | "loading" | "ready" | "failed";

type PerformanceRefreshScope = "summary" | "details";

type PerformancePendingRefresh = {
  scope: PerformanceRefreshScope;
  requestedControls: PerformanceControlState;
  confirmedControls: PerformanceControlState;
};

type PerformanceRefreshFailure = PerformancePendingRefresh & {
  status?: number;
  retryComposite?: boolean;
};

type ResolvedPerformanceDetails = {
  details: WorkbenchPerformanceWorkspaceDetails;
  controls: PerformanceControlState;
  dataUpdatedAt?: number;
};

export const PERFORMANCE_REFRESH_CONFIRMATION_DURATION_MS = 5_000;

export default function PerformanceWorkspaceClient({
  initialSummary,
  initialDetails,
  initialLoadIssue,
  initialPortfolioId,
  initialPeriod,
  initialDetailBasis,
  initialContributionDimension,
  initialAttributionDimension,
  initialChartFrequency,
  initialMode = "summary",
  initialBenchmark,
  initialAsOfDate,
  initialReportingCurrency,
  initialPortfolioContext = null,
}: PerformanceWorkspaceClientProps) {
  const router = useRouter();
  const sourceConfirmedInitialDetails = useMemo(
    () =>
      initialDetails &&
      initialSummary &&
      isPerformanceDetailsSourceCurrent(initialDetails, {
        portfolioId: initialSummary.portfolio_id,
        period: initialSummary.period,
        reportStartDate: initialSummary.report_start_date ?? undefined,
        reportEndDate: initialSummary.report_end_date ?? undefined,
        asOfDate: initialAsOfDate,
        reportingCurrency: initialReportingCurrency,
        detailBasis: initialDetailBasis,
        contributionDimension: initialContributionDimension,
        attributionDimension: initialAttributionDimension,
        chartFrequency: initialChartFrequency,
        benchmark: initialBenchmark,
      }) &&
      doPerformanceSummaryAndDetailsShareReviewContext(initialSummary, initialDetails)
        ? initialDetails
        : null,
    [
      initialAsOfDate,
      initialAttributionDimension,
      initialBenchmark,
      initialChartFrequency,
      initialContributionDimension,
      initialDetailBasis,
      initialDetails,
      initialReportingCurrency,
      initialSummary,
    ],
  );
  const initialControls = useMemo<PerformanceControlState | null>(
    () =>
      initialPortfolioId
        ? resolveInitialControls({
            initialPortfolioId,
            initialPeriod,
            initialDetailBasis,
            initialContributionDimension,
            initialAttributionDimension,
            initialChartFrequency,
            initialBenchmark,
            initialAsOfDate,
            initialReportingCurrency,
            initialSummary,
            initialDetails: sourceConfirmedInitialDetails,
          })
        : null,
    [
      initialAttributionDimension,
      initialAsOfDate,
      initialBenchmark,
      initialChartFrequency,
      initialContributionDimension,
      initialDetailBasis,
      initialPeriod,
      initialPortfolioId,
      initialReportingCurrency,
      initialSummary,
      sourceConfirmedInitialDetails,
    ]
  );
  const [loadIssue, setLoadIssue] = useState<PerformanceWorkspaceLoadIssue | null>(
    initialSummary ? null : initialLoadIssue ?? null
  );
  const [mode, setMode] = useState<PerformanceWorkspaceMode>(initialMode);
  const modeRef = useRef<PerformanceWorkspaceMode>(initialMode);
  const [controls, setControls] = useState<PerformanceControlState | null>(
    initialControls
  );
  const [pendingRefresh, setPendingRefresh] = useState<PerformancePendingRefresh | null>(null);
  const [refreshFailure, setRefreshFailure] = useState<PerformanceRefreshFailure | null>(null);
  const [refreshConfirmation, setRefreshConfirmation] = useState<PerformancePendingRefresh | null>(
    null
  );
  const initialDataAdmissionEnabledRef = useRef(true);
  const activeRefreshTokenRef = useRef<symbol | null>(null);
  const activeHydrationTokenRef = useRef<symbol | null>(null);
  const pendingRouteEchoKeyRef = useRef<string | null>(null);
  const automaticHydrationIdentityRef = useRef<string | null>(null);
  const lastSourceControlFocusTargetRef = useRef<PerformanceSourceControlFocusTarget | null>(null);
  const initialRouteControlsKey = useMemo(
    () =>
      initialControls ? buildPerformanceControlsHref(initialControls) : null,
    [initialControls],
  );
  const acceptedRouteControlsKeyRef = useRef(initialRouteControlsKey);
  const acceptedRouteEvidenceRef = useRef({
    controlsKey: initialRouteControlsKey,
    summaryResponse: initialSummary,
    details: sourceConfirmedInitialDetails,
    loadIssueState: initialLoadIssue?.state ?? null,
    loadIssueStatus: initialLoadIssue?.status ?? null,
  });
  const currentControlsIdentityRef = useRef(
    controls ? buildControlQueryIdentity(controls) : null,
  );
  currentControlsIdentityRef.current = controls
    ? buildControlQueryIdentity(controls)
    : null;
  const queryClient = useQueryClient();
  const controlsMatchServerPreload = Boolean(
    initialDataAdmissionEnabledRef.current &&
    controls &&
      initialRouteControlsKey &&
      buildPerformanceControlsHref(controls) === initialRouteControlsKey,
  );
  const summaryQuery = useQuery(
    performanceWorkspaceSummaryQueryOptions(controls, {
      initialData: controlsMatchServerPreload ? initialSummary ?? undefined : undefined,
    }),
  );
  const currentSummary = loadIssue
    ? null
    : summaryQuery.data ?? null;
  const detailsQuery = useQuery(
    performanceWorkspaceDetailsQueryOptions(controls, currentSummary, {
      initialData: controlsMatchServerPreload
        ? sourceConfirmedInitialDetails ?? undefined
        : undefined,
    }),
  );
  const currentDetails = loadIssue
    ? null
    : detailsQuery.data ?? null;
  const detailsStatus: PerformanceDetailsStatus = currentDetails
    ? "ready"
    : detailsQuery.fetchStatus === "fetching"
      ? "loading"
      : refreshFailure
        ? "failed"
        : "idle";

  useEffect(() => {
    if (!initialControls || !initialRouteControlsKey) {
      return;
    }

    const acceptedEvidence = acceptedRouteEvidenceRef.current;
    if (
      acceptedEvidence.controlsKey === initialRouteControlsKey &&
      acceptedEvidence.summaryResponse === initialSummary &&
      acceptedEvidence.details === sourceConfirmedInitialDetails &&
      acceptedEvidence.loadIssueState === (initialLoadIssue?.state ?? null) &&
      acceptedEvidence.loadIssueStatus === (initialLoadIssue?.status ?? null)
    ) {
      return;
    }

    const routeEvidence = {
      controlsKey: initialRouteControlsKey,
      summaryResponse: initialSummary,
      details: sourceConfirmedInitialDetails,
      loadIssueState: initialLoadIssue?.state ?? null,
      loadIssueStatus: initialLoadIssue?.status ?? null,
    };
    const isConfirmedNavigationEcho = Boolean(
      initialSummary &&
      controls &&
      pendingRouteEchoKeyRef.current === initialRouteControlsKey &&
      buildPerformanceControlsHref(controls) === initialRouteControlsKey,
    );
    pendingRouteEchoKeyRef.current = null;
    if (isConfirmedNavigationEcho) {
      acceptedRouteControlsKeyRef.current = initialRouteControlsKey;
      acceptedRouteEvidenceRef.current = routeEvidence;
      return;
    }

    acceptedRouteControlsKeyRef.current = initialRouteControlsKey;
    acceptedRouteEvidenceRef.current = routeEvidence;
    activeRefreshTokenRef.current = null;
    activeHydrationTokenRef.current = null;
    automaticHydrationIdentityRef.current = null;
    void queryClient.cancelQueries({ queryKey: performanceWorkspaceQueryKeys.all });
    initialDataAdmissionEnabledRef.current = true;
    if (initialSummary) {
      const routeReceiptTime = Date.now();
      queryClient.setQueryData(
        performanceWorkspaceSummaryQueryOptions(initialControls).queryKey,
        initialSummary,
        { updatedAt: routeReceiptTime },
      );
      if (sourceConfirmedInitialDetails) {
        queryClient.setQueryData(
          performanceWorkspaceDetailsQueryOptions(
            initialControls,
            initialSummary,
          ).queryKey,
          sourceConfirmedInitialDetails,
          { updatedAt: routeReceiptTime },
        );
      }
    }
    setControls(initialControls);
    setLoadIssue(initialSummary ? null : initialLoadIssue ?? null);
    setPendingRefresh(null);
    setRefreshFailure(null);
    setRefreshConfirmation(null);
  }, [
    controls,
    initialControls,
    initialLoadIssue,
    initialRouteControlsKey,
    initialSummary,
    queryClient,
    sourceConfirmedInitialDetails,
  ]);

  useEffect(() => {
    if (modeRef.current === initialMode) {
      return;
    }
    modeRef.current = initialMode;
    setMode(initialMode);
    setRefreshConfirmation(null);
  }, [initialMode]);

  const workspace = useMemo<WorkbenchPerformanceWorkspace | null>(() => {
    if (!currentSummary) {
      return null;
    }
    return assemblePerformanceWorkspace(currentSummary, currentDetails);
  }, [currentDetails, currentSummary]);
  const isUpdating = pendingRefresh !== null;
  const isDetailsPending =
    Boolean(currentSummary) &&
    (pendingRefresh !== null || detailsStatus === "idle" || detailsStatus === "loading");
  const refreshStatus = buildRefreshStatus(
    pendingRefresh,
    refreshFailure,
    refreshConfirmation
  );

  useEffect(() => {
    if (!refreshConfirmation) {
      return;
    }

    const confirmation = refreshConfirmation;
    const timeoutId = window.setTimeout(() => {
      setRefreshConfirmation((currentConfirmation) =>
        currentConfirmation === confirmation ? null : currentConfirmation
      );
    }, PERFORMANCE_REFRESH_CONFIRMATION_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [refreshConfirmation]);

  useEffect(() => {
    if (!initialControls || !initialPortfolioId) {
      return;
    }
    const requestedControls: PerformanceControlState = {
      portfolioId: initialPortfolioId,
      period: initialPeriod,
      detailBasis: initialDetailBasis,
      contributionDimension: initialContributionDimension,
      attributionDimension: initialAttributionDimension,
      chartFrequency: initialChartFrequency,
      benchmark: initialBenchmark,
      sourceAsOfDate: initialSummary?.as_of_date,
      reviewAsOfDate: initialAsOfDate,
      reviewReportingCurrency: initialReportingCurrency,
      reportStartDate: initialSummary?.report_start_date,
      reportEndDate: initialSummary?.report_end_date,
    };
    if (
      buildPerformanceControlsHref(requestedControls) ===
      buildPerformanceControlsHref(initialControls)
    ) {
      return;
    }
    startTransition(() => {
      pendingRouteEchoKeyRef.current = buildPerformanceControlsHref(initialControls);
      router.replace(buildPerformanceControlsHref(initialControls, mode), { scroll: false });
    });
  }, [
    initialAttributionDimension,
    initialAsOfDate,
    initialBenchmark,
    initialChartFrequency,
    initialContributionDimension,
    initialControls,
    initialDetailBasis,
    initialPeriod,
    initialPortfolioId,
    initialReportingCurrency,
    initialSummary?.as_of_date,
    initialSummary?.report_end_date,
    initialSummary?.report_start_date,
    mode,
    router,
  ]);

  const resolveDetailsForControls = useCallback(async (
    nextControls: PerformanceControlState,
    summaryEvidence: WorkbenchPerformanceWorkspaceSummary,
    options: { allowInitialFallback?: boolean; forceSourceRead?: boolean } = {}
  ): Promise<ResolvedPerformanceDetails> => {
    let sourceOptions = performanceWorkspaceDetailsQueryOptions(
      nextControls,
      summaryEvidence,
    );
    if (options.forceSourceRead) {
      await queryClient.invalidateQueries({
        queryKey: sourceOptions.queryKey,
        exact: true,
        refetchType: "none",
      });
    }
    let resolvedDetails = await queryClient.fetchQuery(sourceOptions);
    let resolvedControls = buildResolvedDetailControls(nextControls, resolvedDetails);

    if (options.allowInitialFallback) {
      const normalizedInitialControls = getNormalizedInitialPerformanceDetailControls(
        resolvedDetails,
        {
          contributionDimension: nextControls.contributionDimension,
          attributionDimension: nextControls.attributionDimension,
        }
      );
      const requiresInitialFallback =
        normalizedInitialControls.contributionDimension !==
          resolvedDetails.contribution_dimension ||
        normalizedInitialControls.attributionDimension !==
          resolvedDetails.attribution_dimension;

      if (requiresInitialFallback) {
        resolvedControls = {
          ...resolvedControls,
          contributionDimension: normalizedInitialControls.contributionDimension,
          attributionDimension: normalizedInitialControls.attributionDimension,
        };
        sourceOptions = performanceWorkspaceDetailsQueryOptions(
          resolvedControls,
          summaryEvidence,
        );
        if (options.forceSourceRead) {
          await queryClient.invalidateQueries({
            queryKey: sourceOptions.queryKey,
            exact: true,
            refetchType: "none",
          });
        }
        resolvedDetails = await queryClient.fetchQuery(sourceOptions);
      }
    }

    const dataUpdatedAt = queryClient.getQueryState(sourceOptions.queryKey)?.dataUpdatedAt;
    admitPerformanceQueryData(
      queryClient,
      performanceWorkspaceDetailsQueryOptions(resolvedControls, summaryEvidence).queryKey,
      resolvedDetails,
      dataUpdatedAt,
    );
    return {
      details: resolvedDetails,
      controls: resolvedControls,
      dataUpdatedAt,
    };
  }, [queryClient]);

  async function handleRequestChange(
    patch: Partial<PerformanceControlState>,
    focusTarget?: PerformanceSourceControlFocusTarget
  ) {
    if (!controls) {
      return false;
    }
    const nextControls = applyPerformanceControlPatch(controls, patch);
    if (
      buildPerformanceControlsHref(nextControls) ===
      buildPerformanceControlsHref(controls)
    ) {
      if (activeRefreshTokenRef.current !== null) {
        activeRefreshTokenRef.current = null;
        await queryClient.cancelQueries({
          queryKey: performanceWorkspaceQueryKeys.portfolio(controls.portfolioId),
        });
        setPendingRefresh(null);
        setRefreshFailure(null);
        setRefreshConfirmation(null);
      }
      return false;
    }
    const sameSummary = !shouldRefreshSummary(controls, nextControls);
    const sameDetails =
      buildControlQueryIdentity(nextControls) === buildControlQueryIdentity(controls);
    if (activeRefreshTokenRef.current !== null && sameSummary && sameDetails) {
      activeRefreshTokenRef.current = null;
      await queryClient.cancelQueries({
        queryKey: performanceWorkspaceQueryKeys.portfolio(controls.portfolioId),
      });
      setPendingRefresh(null);
      setRefreshFailure(null);
      setRefreshConfirmation(null);
      return false;
    }
    if (pendingRefresh) {
      const repeatsPendingRequest =
        buildControlQueryIdentity(nextControls) ===
        buildControlQueryIdentity(pendingRefresh.requestedControls);
      if (repeatsPendingRequest) {
        return false;
      }
      if (sameSummary && sameDetails) {
        activeRefreshTokenRef.current = null;
        await queryClient.cancelQueries({
          queryKey: performanceWorkspaceQueryKeys.portfolio(controls.portfolioId),
        });
        setPendingRefresh(null);
        setRefreshFailure(null);
        setRefreshConfirmation(null);
        return false;
      }
    }
    if (sameSummary && sameDetails && !refreshFailure) {
      return false;
    }

    lastSourceControlFocusTargetRef.current = focusTarget ?? null;
    await runRefresh(nextControls, controls, { focusTarget });
    return true;
  }

  async function runRefresh(
    requestedControls: PerformanceControlState,
    confirmedControls: PerformanceControlState,
    options: {
      focusTarget?: PerformanceSourceControlFocusTarget;
      forceScope?: PerformanceRefreshScope;
      stageComposite?: boolean;
    } = {}
  ) {
    const refreshesSummary =
      options.forceScope === "summary" ||
      shouldRefreshSummary(confirmedControls, requestedControls);
    const initialScope: PerformanceRefreshScope = refreshesSummary ? "summary" : "details";
    const refreshToken = Symbol("performance-workspace-refresh");
    activeRefreshTokenRef.current = refreshToken;
    activeHydrationTokenRef.current = null;
    await queryClient.cancelQueries({
      queryKey: performanceWorkspaceQueryKeys.portfolio(requestedControls.portfolioId),
    });
    if (activeRefreshTokenRef.current !== refreshToken) {
      return;
    }
    setRefreshFailure(null);
    setRefreshConfirmation(null);
    setPendingRefresh({
      scope: initialScope,
      requestedControls,
      confirmedControls,
    });

    let failureScope = initialScope;
    let stagedCompositeRequest = false;
    try {
      let resolvedSummary = currentSummary;
      let summaryDataUpdatedAt = currentSummary
        ? queryClient.getQueryState(
            performanceWorkspaceSummaryQueryOptions(confirmedControls).queryKey,
          )?.dataUpdatedAt
        : undefined;
      let forceDetailSourceRead = false;
      let detailRequestControls = requestedControls;
      let stagedDetails: ResolvedPerformanceDetails | null = null;

      if (options.stageComposite) {
        stagedCompositeRequest = true;
        const revalidated = await fetchPerformanceWorkspaceRevalidation(
          queryClient,
          requestedControls,
        );
        resolvedSummary = revalidated.data.summary;
        summaryDataUpdatedAt = revalidated.dataUpdatedAt;
        stagedDetails = {
          controls: buildResolvedDetailControls(
            requestedControls,
            revalidated.data.details,
          ),
          details: revalidated.data.details,
          dataUpdatedAt: revalidated.dataUpdatedAt,
        };
      } else if (refreshesSummary) {
        const requestedSummaryKey = performanceWorkspaceSummaryQueryOptions(
          requestedControls,
        ).queryKey;
        forceDetailSourceRead = !isPerformanceQueryFresh(
          queryClient.getQueryState(requestedSummaryKey),
        );
        const summary = await fetchPerformanceWorkspaceSummary(
          queryClient,
          requestedControls,
        );
        resolvedSummary = summary.data;
        summaryDataUpdatedAt = summary.dataUpdatedAt;
        detailRequestControls = buildResolvedSummaryControls(requestedControls, resolvedSummary);
      }

      if (!resolvedSummary) {
        throw new Error("Performance summary is unavailable for the selected controls.");
      }

      failureScope = "details";
      const resolvedDetails =
        stagedDetails ??
        (await resolveDetailsForControls(detailRequestControls, resolvedSummary, {
          forceSourceRead: forceDetailSourceRead,
        }));
      if (activeRefreshTokenRef.current !== refreshToken) {
        return;
      }

      admitPerformanceQueryData(
        queryClient,
        performanceWorkspaceSummaryQueryOptions(resolvedDetails.controls).queryKey,
        resolvedSummary,
        summaryDataUpdatedAt,
      );
      admitPerformanceQueryData(
        queryClient,
        performanceWorkspaceDetailsQueryOptions(
          resolvedDetails.controls,
          resolvedSummary,
        ).queryKey,
        resolvedDetails.details,
        resolvedDetails.dataUpdatedAt,
      );
      setControls(resolvedDetails.controls);
      setLoadIssue(null);
      setRefreshFailure(null);
      setRefreshConfirmation({
        scope: initialScope,
        requestedControls,
        confirmedControls: resolvedDetails.controls,
      });
      acceptedRouteControlsKeyRef.current = buildPerformanceControlsHref(
        resolvedDetails.controls,
      );
      pendingRouteEchoKeyRef.current = buildPerformanceControlsHref(
        resolvedDetails.controls,
      );
      startTransition(() => {
        router.push(buildPerformanceControlsHref(resolvedDetails.controls, modeRef.current), {
          scroll: false,
        });
      });
      if (options.focusTarget) {
        restorePerformanceSourceControlFocus(options.focusTarget);
      }
    } catch (error) {
      if (activeRefreshTokenRef.current !== refreshToken) {
        return;
      }

      const refreshError = stagedCompositeRequest
        ? resolvePerformanceWorkspaceRevalidationError(error)
        : { scope: failureScope, sourceError: error };

      if (isWorkbenchPermissionBlockedError(refreshError.sourceError)) {
        initialDataAdmissionEnabledRef.current = false;
        queryClient.removeQueries({
          queryKey: performanceWorkspaceQueryKeys.portfolio(confirmedControls.portfolioId),
        });
        setRefreshFailure(null);
        setLoadIssue({
          state: "permission_blocked",
          status: getWorkbenchApiErrorStatus(refreshError.sourceError) ?? undefined,
        });
      } else {
        setRefreshFailure({
          scope: refreshError.scope,
          requestedControls,
          confirmedControls,
          status: getWorkbenchApiErrorStatus(refreshError.sourceError) ?? undefined,
          retryComposite: stagedCompositeRequest,
        });
      }
    } finally {
      if (activeRefreshTokenRef.current === refreshToken) {
        activeRefreshTokenRef.current = null;
        setPendingRefresh(null);
      }
    }
  }

  useEffect(() => {
    const routeLoadFailed = initialSummary === null && initialLoadIssue != null;
    if (
      !controls ||
      !currentSummary ||
      routeLoadFailed ||
      activeRefreshTokenRef.current !== null
    ) {
      if (routeLoadFailed) {
        activeHydrationTokenRef.current = null;
      }
      return;
    }

    const summaryOptions = performanceWorkspaceSummaryQueryOptions(controls);
    const detailsOptions = performanceWorkspaceDetailsQueryOptions(
      controls,
      currentSummary,
    );
    const controlsIdentity = buildControlQueryIdentity(controls);
    const hydrationIdentity = JSON.stringify(detailsOptions.queryKey);
    if (automaticHydrationIdentityRef.current === hydrationIdentity) {
      return;
    }
    automaticHydrationIdentityRef.current = hydrationIdentity;
    if (
      currentDetails &&
      isPerformanceQueryFresh(queryClient.getQueryState(summaryOptions.queryKey)) &&
      isPerformanceQueryFresh(queryClient.getQueryState(detailsOptions.queryKey))
    ) {
      return;
    }
    const hydrationToken = Symbol("performance-workspace-hydration");
    activeHydrationTokenRef.current = hydrationToken;
    let failureScope: PerformanceRefreshScope = "summary";
    const hydrationRequest = currentDetails
      ? fetchPerformanceWorkspaceRevalidation(queryClient, controls).then(
          ({ data, dataUpdatedAt }) => ({
            resolvedSummary: data.summary,
            summaryDataUpdatedAt: dataUpdatedAt,
            resolvedDetails: {
              controls: buildResolvedDetailControls(controls, data.details),
              details: data.details,
              dataUpdatedAt,
            },
          }),
        )
      : fetchPerformanceWorkspaceSummary(queryClient, controls).then((summary) => {
          failureScope = "details";
          return resolveDetailsForControls(controls, summary.data, {
            allowInitialFallback: true,
          }).then((resolvedDetails) => ({
            resolvedDetails,
            resolvedSummary: summary.data,
            summaryDataUpdatedAt: summary.dataUpdatedAt,
          }));
        });
    void hydrationRequest
      .then(({ resolvedDetails, resolvedSummary, summaryDataUpdatedAt }) => {
        if (
          activeHydrationTokenRef.current !== hydrationToken ||
          activeRefreshTokenRef.current !== null ||
          currentControlsIdentityRef.current !== controlsIdentity
        ) {
          return;
        }
        activeHydrationTokenRef.current = null;
        automaticHydrationIdentityRef.current = JSON.stringify(
          performanceWorkspaceDetailsQueryOptions(
            resolvedDetails.controls,
            resolvedSummary,
          ).queryKey,
        );
        admitPerformanceQueryData(
          queryClient,
          performanceWorkspaceSummaryQueryOptions(resolvedDetails.controls).queryKey,
          resolvedSummary,
          summaryDataUpdatedAt,
        );
        admitPerformanceQueryData(
          queryClient,
          performanceWorkspaceDetailsQueryOptions(
            resolvedDetails.controls,
            resolvedSummary,
          ).queryKey,
          resolvedDetails.details,
          resolvedDetails.dataUpdatedAt,
        );
        setControls(resolvedDetails.controls);
        if (
          buildPerformanceControlsHref(resolvedDetails.controls) !==
          buildPerformanceControlsHref(controls)
        ) {
          acceptedRouteControlsKeyRef.current = buildPerformanceControlsHref(
            resolvedDetails.controls,
          );
          pendingRouteEchoKeyRef.current = buildPerformanceControlsHref(
            resolvedDetails.controls,
          );
          startTransition(() => {
            router.replace(
              buildPerformanceControlsHref(resolvedDetails.controls, modeRef.current),
              {
                scroll: false,
              }
            );
          });
        }
      })
      .catch((error: unknown) => {
        if (
          activeHydrationTokenRef.current !== hydrationToken ||
          activeRefreshTokenRef.current !== null ||
          currentControlsIdentityRef.current !== controlsIdentity
        ) {
          return;
        }
        activeHydrationTokenRef.current = null;
        const revalidationError = currentDetails
          ? resolvePerformanceWorkspaceRevalidationError(error)
          : { scope: failureScope, sourceError: error };
        if (isWorkbenchPermissionBlockedError(revalidationError.sourceError)) {
          initialDataAdmissionEnabledRef.current = false;
          queryClient.removeQueries({
            queryKey: performanceWorkspaceQueryKeys.portfolio(controls.portfolioId),
          });
          setLoadIssue({
            state: "permission_blocked",
            status:
              getWorkbenchApiErrorStatus(revalidationError.sourceError) ?? undefined,
          });
          return;
        }
        setRefreshFailure({
          scope: revalidationError.scope,
          requestedControls: controls,
          confirmedControls: controls,
          status:
            getWorkbenchApiErrorStatus(revalidationError.sourceError) ?? undefined,
          retryComposite: currentDetails !== null,
        });
      });
  }, [
    controls,
    currentDetails,
    initialLoadIssue,
    initialSummary,
    queryClient,
    resolveDetailsForControls,
    router,
    currentSummary,
  ]);

  const currentContextNotice = buildPerformanceReviewContextNotice({
    requestedAsOfDate: controls?.reviewAsOfDate ?? initialAsOfDate,
    requestedReportingCurrency:
      controls?.reviewReportingCurrency ?? initialReportingCurrency,
    source: currentSummary,
  });
  const shellContextNotice = currentContextNotice
    ? {
        label: currentContextNotice.title,
        message: currentContextNotice.body,
        tone: "attention" as const,
      }
    : null;

  return (
    <AppPageShell
      pageKey="performance"
      className="performance-page portfolio-page"
      reviewContext={buildPerformanceReviewContextStrip({
        workspace: workspace ?? currentSummary,
        portfolioContext: initialPortfolioContext,
        notice: shellContextNotice,
        currencyPresentation:
          mode === "risk" ? "portfolio_base" : "source_confirmed",
      })}
    >
      <PerformanceWorkspaceView
      workspace={workspace}
      loadIssue={loadIssue}
      refreshStatus={refreshStatus}
      mode={mode}
      period={controls?.period ?? initialPeriod}
      detailBasis={controls?.detailBasis ?? initialDetailBasis}
      contributionDimension={controls?.contributionDimension ?? initialContributionDimension}
      attributionDimension={controls?.attributionDimension ?? initialAttributionDimension}
      chartFrequency={controls?.chartFrequency ?? initialChartFrequency}
      benchmark={controls?.benchmark}
      onModeChange={(nextMode) => {
        setRefreshConfirmation(null);
        modeRef.current = nextMode;
        setMode(nextMode);
        if (!controls) {
          return;
        }
        pendingRouteEchoKeyRef.current = buildPerformanceControlsHref(controls);
        startTransition(() => {
          router.push(buildPerformanceControlsHref(controls, nextMode), {
            scroll: false,
          });
        });
      }}
      onRequestChange={handleRequestChange}
      onRetryRefresh={() => {
        if (!refreshFailure || !controls) {
          return;
        }
        void runRefresh(refreshFailure.requestedControls, controls, {
          focusTarget: lastSourceControlFocusTargetRef.current ?? undefined,
          forceScope: refreshFailure.retryComposite
            ? "summary"
            : refreshFailure.scope,
          stageComposite: refreshFailure.retryComposite,
        });
      }}
      isUpdating={isUpdating}
      isDetailsPending={isDetailsPending}
      />
    </AppPageShell>
  );
}

function isPerformanceQueryFresh(
  state:
    | Readonly<{ data: unknown; dataUpdatedAt: number; isInvalidated: boolean }>
    | undefined,
) {
  return Boolean(
    state?.data !== undefined &&
      !state.isInvalidated &&
      Date.now() - state.dataUpdatedAt < WORKBENCH_QUERY_STALE_TIME_MS,
  );
}

function applyPerformanceControlPatch(
  controls: PerformanceControlState,
  patch: Partial<PerformanceControlState>
): PerformanceControlState {
  const normalizedPatch = { ...patch };
  if (patch.period && patch.period !== "EXPLICIT") {
    normalizedPatch.reportStartDate = undefined;
    normalizedPatch.reportEndDate = undefined;
  }
  return {
    ...controls,
    ...normalizedPatch,
  };
}

function buildResolvedSummaryControls(
  requestedControls: PerformanceControlState,
  resolvedSummary: WorkbenchPerformanceWorkspaceSummary
): PerformanceControlState {
  return {
    ...requestedControls,
    period: resolvedSummary.period,
    detailBasis: resolvedSummary.detail_basis,
    chartFrequency: resolvedSummary.chart_frequency,
    benchmark: resolvedSummary.benchmark_code ?? undefined,
    reportStartDate: resolvedSummary.report_start_date,
    reportEndDate: resolvedSummary.report_end_date,
    sourceAsOfDate: resolvedSummary.effective_as_of_date,
  };
}

function buildResolvedDetailControls(
  requestedControls: PerformanceControlState,
  resolvedDetails: WorkbenchPerformanceWorkspaceDetails
): PerformanceControlState {
  return {
    ...requestedControls,
    contributionDimension: resolvedDetails.contribution_dimension,
    attributionDimension: resolvedDetails.attribution_dimension,
    detailBasis: resolvedDetails.detail_basis,
    chartFrequency: resolvedDetails.chart_frequency,
    benchmark: resolvedDetails.benchmark_code ?? requestedControls.benchmark,
    reportStartDate: resolvedDetails.report_start_date,
    reportEndDate: resolvedDetails.report_end_date,
    sourceAsOfDate: resolvedDetails.effective_as_of_date,
  };
}

function buildPerformanceControlsHref(
  controls: PerformanceControlState,
  mode?: PerformanceWorkspaceMode,
): string {
  return buildPerformanceHref({
    portfolioId: controls.portfolioId,
    asOfDate: controls.reviewAsOfDate,
    period: controls.period,
    reportingCurrency: controls.reviewReportingCurrency,
    mode,
    detailBasis: controls.detailBasis,
    contributionDimension: controls.contributionDimension,
    attributionDimension: controls.attributionDimension,
    chartFrequency: controls.chartFrequency,
    benchmark: controls.benchmark,
    reportStartDate: controls.reportStartDate,
    reportEndDate: controls.reportEndDate,
  });
}

function buildRefreshStatus(
  pendingRefresh: PerformancePendingRefresh | null,
  refreshFailure: PerformanceRefreshFailure | null,
  refreshConfirmation: PerformancePendingRefresh | null
): PerformanceWorkspaceRefreshStatus | null {
  const refresh = pendingRefresh ?? refreshFailure ?? refreshConfirmation;
  if (!refresh) {
    return null;
  }

  return {
    kind: pendingRefresh ? "pending" : refreshFailure ? "failed" : "confirmed",
    scope: refresh.scope,
    requestedContext: describeRequestedContext(
      refresh.confirmedControls,
      refresh.requestedControls,
      refresh.scope
    ),
    confirmedContext: describeConfirmedContext(
      refresh.confirmedControls,
      refresh.scope
    ),
    status: refreshFailure?.status,
  };
}

function describeRequestedContext(
  confirmedControls: PerformanceControlState,
  requestedControls: PerformanceControlState,
  scope?: PerformanceRefreshScope
): string {
  const changedContext: string[] = [];
  if (
    requestedControls.period !== confirmedControls.period ||
    requestedControls.reportStartDate !== confirmedControls.reportStartDate ||
    requestedControls.reportEndDate !== confirmedControls.reportEndDate
  ) {
    changedContext.push(describeWindow(requestedControls));
  }
  if (requestedControls.detailBasis !== confirmedControls.detailBasis) {
    changedContext.push(`${formatControlLabel(requestedControls.detailBasis)} returns`);
  }
  if (requestedControls.chartFrequency !== confirmedControls.chartFrequency) {
    changedContext.push(`${formatControlLabel(requestedControls.chartFrequency)} observations`);
  }
  if (requestedControls.benchmark !== confirmedControls.benchmark) {
    changedContext.push(
      requestedControls.benchmark
        ? `Benchmark ${formatControlLabel(requestedControls.benchmark)}`
        : "No benchmark"
    );
  }
  if (requestedControls.contributionDimension !== confirmedControls.contributionDimension) {
    changedContext.push(
      `${formatControlLabel(requestedControls.contributionDimension)} contribution`
    );
  }
  if (requestedControls.attributionDimension !== confirmedControls.attributionDimension) {
    changedContext.push(
      `${formatControlLabel(requestedControls.attributionDimension)} attribution`
    );
  }
  return changedContext.join(" · ") || describeConfirmedContext(requestedControls, scope);
}

function describeConfirmedContext(
  controls: PerformanceControlState,
  scope?: PerformanceRefreshScope
): string {
  const context = [
    describeWindow(controls),
    `${formatControlLabel(controls.detailBasis)} returns`,
    `${formatControlLabel(controls.chartFrequency)} observations`,
  ];
  if (scope === "summary" && controls.benchmark) {
    context.push(`Benchmark ${formatControlLabel(controls.benchmark)}`);
  }
  if (scope === "details") {
    context.push(`${formatControlLabel(controls.contributionDimension)} contribution`);
    context.push(`${formatControlLabel(controls.attributionDimension)} attribution`);
  }
  return context.join(" · ");
}

function describeWindow(controls: PerformanceControlState): string {
  if (controls.period === "EXPLICIT" && controls.reportStartDate && controls.reportEndDate) {
    return `${controls.reportStartDate} to ${controls.reportEndDate}`;
  }
  return formatControlLabel(controls.period);
}

function formatControlLabel(value: string): string {
  return value
    .trim()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) =>
      part.length <= 4 && part === part.toUpperCase()
        ? part
        : `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`
    )
    .join(" ");
}

function shouldRefreshSummary(
  currentControls: PerformanceControlState,
  nextControls: PerformanceControlState
): boolean {
  return (
    currentControls.portfolioId !== nextControls.portfolioId ||
    currentControls.period !== nextControls.period ||
    currentControls.benchmark !== nextControls.benchmark ||
    currentControls.reportStartDate !== nextControls.reportStartDate ||
    currentControls.reportEndDate !== nextControls.reportEndDate ||
    currentControls.reviewAsOfDate !== nextControls.reviewAsOfDate ||
    currentControls.reviewReportingCurrency !== nextControls.reviewReportingCurrency
  );
}

function buildControlQueryIdentity(controls: PerformanceControlState): string {
  return JSON.stringify(performanceWorkspaceQueryKeys.summaryResponse(controls));
}

function resolveInitialControls({
  initialPortfolioId,
  initialPeriod,
  initialDetailBasis,
  initialContributionDimension,
  initialAttributionDimension,
  initialChartFrequency,
  initialBenchmark,
  initialAsOfDate,
  initialReportingCurrency,
  initialSummary,
  initialDetails,
}: {
  initialPortfolioId: string;
  initialPeriod: string;
  initialDetailBasis: string;
  initialContributionDimension: string;
  initialAttributionDimension: string;
  initialChartFrequency: string;
  initialBenchmark?: string;
  initialAsOfDate?: string;
  initialReportingCurrency?: string;
  initialSummary: WorkbenchPerformanceWorkspaceSummary | null;
  initialDetails?: WorkbenchPerformanceWorkspaceDetails | null;
}): PerformanceControlState {
  return {
    portfolioId: initialPortfolioId,
    period: initialSummary?.period ?? initialPeriod,
    detailBasis: initialDetails?.detail_basis ?? initialSummary?.detail_basis ?? initialDetailBasis,
    contributionDimension:
      initialDetails?.contribution_dimension ?? initialContributionDimension,
    attributionDimension:
      initialDetails?.attribution_dimension ?? initialAttributionDimension,
    chartFrequency: initialDetails?.chart_frequency ?? initialSummary?.chart_frequency ?? initialChartFrequency,
    benchmark:
      initialDetails?.benchmark_code ??
      initialSummary?.benchmark_code ??
      initialBenchmark,
    reportStartDate: initialDetails?.report_start_date ?? initialSummary?.report_start_date,
    reportEndDate: initialDetails?.report_end_date ?? initialSummary?.report_end_date,
    sourceAsOfDate:
      initialDetails?.effective_as_of_date ?? initialSummary?.effective_as_of_date,
    reviewAsOfDate: initialAsOfDate,
    reviewReportingCurrency: initialReportingCurrency,
  };
}
