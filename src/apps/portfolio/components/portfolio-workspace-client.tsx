"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  isCancelledError,
  type QueryClient,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  getOldestWorkbenchReceiptTime,
  WorkbenchRefreshStatus,
  WorkbenchToolbarPlaceholder,
} from "@/design-system";
import { useClientMounted } from "@/design-system/hooks/use-client-mounted";
import { formatBusinessDateValue } from "@/design-system/utils/financial-formatters";
import { getWorkbenchQueryRevalidationInterval } from "@/features/platform-runtime/query-policy";

import {
  getPortfolioWorkspaceShell,
  getPortfolioWorkspaceSummaryDetails,
  mergePortfolioWorkspace,
} from "../api";
import { recordPortfolioShellRecoveryLifecycle } from "../portfolio-shell-recovery-observability";
import { isPortfolioWorkspaceIdentityConfirmed } from "../portfolio-selection";
import { PORTFOLIO_CURRENCY_LABELS } from "../portfolio-terminology";
import {
  applyPortfolioControlPatch,
  buildPortfolioReviewHref,
  hasPortfolioSourceControlOverride,
  isPortfolioReviewResponseCurrent,
  restorePortfolioSourceControls,
} from "../portfolio-workspace-controls";
import { buildPortfolioSummaryDetailsRequest } from "../portfolio-workspace-client-view-model";
import {
  buildPortfolioWorkspaceSourceGeneration,
  portfolioQueryKeys,
} from "../portfolio-query-keys";
import type { PortfolioCatalogResponse, PortfolioWorkspace } from "../types";
import {
  buildInitialPortfolioControls,
  buildPortfolioExportPayload,
  buildPortfolioWorkspaceContext,
  derivePortfolioWorkspace,
  getOrderedWorkflowCues,
  type PortfolioWorkspaceControls,
} from "../view-model";
import PortfolioUnavailableWorkspace from "./portfolio-unavailable-workspace";
import PortfolioPageLayout from "./portfolio-page-layout";
import { buildPortfolioReviewContextStrip } from "../portfolio-review-context-strip-view-model";
import { buildUnavailableReviewContextStrip } from "@/shell/review-context-strip-view-model";
import PortfolioWorkspaceToolbar from "./portfolio-workspace-toolbar";
import PortfolioWorkspaceView from "./portfolio-workspace";

type WorkspaceStateDraft = {
  sourceKey: string;
  workspace: PortfolioWorkspace | null;
};

type ShellGenerationDraft = {
  sourceKey: string;
  activeGeneration: string;
};

type PortfolioControlStateDraft = {
  sourceKey: string;
  controls: PortfolioWorkspaceControls;
};

type PortfolioControlTransition = {
  sourceKey: string;
  status: "pending" | "confirmed" | "failed";
  requestedControls: PortfolioWorkspaceControls;
};

type PortfolioRefreshAnnouncement = {
  scope: string;
  message: string;
};

async function queryPortfolioWorkspaceShell(
  portfolioId: string,
  signal: AbortSignal,
) {
  const shellWorkspace = await getPortfolioWorkspaceShell(portfolioId, {
    signal,
  });
  signal.throwIfAborted();
  if (!isPortfolioWorkspaceIdentityConfirmed(shellWorkspace, portfolioId)) {
    throw new Error("Portfolio overview is unavailable.");
  }
  return shellWorkspace;
}

async function queryPortfolioWorkspaceSummaryDetails(
  portfolioId: string,
  params: Parameters<typeof getPortfolioWorkspaceSummaryDetails>[1],
  controls: Pick<
    PortfolioWorkspaceControls,
    "asOfDate" | "reportingCurrency" | "timeWindow"
  >,
  signal: AbortSignal,
) {
  const details = await getPortfolioWorkspaceSummaryDetails(
    portfolioId,
    params,
    { signal },
  );
  signal.throwIfAborted();
  if (
    !isPortfolioReviewResponseCurrent(details, controls, params, portfolioId)
  ) {
    throw new Error("Portfolio review detail is unavailable.");
  }
  return details;
}

export default function PortfolioWorkspaceClient({
  portfolios,
  selectedPortfolioId,
  initialWorkspace,
  initialControls,
}: {
  portfolios: PortfolioCatalogResponse["items"];
  selectedPortfolioId: string | null;
  initialWorkspace: PortfolioWorkspace | null;
  initialControls?: PortfolioWorkspaceControls;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const pushRoute = router.push;
  const replaceRoute = router.replace;
  const searchParams = useSearchParams();
  const searchParamsString = searchParams?.toString() ?? "";
  const queryClient = useQueryClient();
  const confirmedInitialWorkspace = isPortfolioWorkspaceIdentityConfirmed(
    initialWorkspace,
    selectedPortfolioId,
  )
    ? initialWorkspace
    : null;
  const initialWorkspaceSourceKey = useMemo(
    () =>
      buildPortfolioWorkspaceSourceGeneration(
        selectedPortfolioId,
        confirmedInitialWorkspace,
      ),
    [confirmedInitialWorkspace, selectedPortfolioId],
  );
  const [shellGenerationDraft, setShellGenerationDraft] =
    useState<ShellGenerationDraft>({
      sourceKey: initialWorkspaceSourceKey,
      activeGeneration: initialWorkspaceSourceKey,
    });
  const activeShellGeneration =
    shellGenerationDraft.sourceKey === initialWorkspaceSourceKey
      ? shellGenerationDraft.activeGeneration
      : initialWorkspaceSourceKey;
  const setActiveShellGeneration = useCallback(
    (activeGeneration: string) => {
      if (selectedPortfolioId) {
        queryClient.setQueryData(
          portfolioQueryKeys.activeShellGeneration(selectedPortfolioId),
          activeGeneration,
        );
      }
      setShellGenerationDraft({
        sourceKey: initialWorkspaceSourceKey,
        activeGeneration,
      });
    },
    [initialWorkspaceSourceKey, queryClient, selectedPortfolioId],
  );
  useEffect(() => {
    if (selectedPortfolioId) {
      queryClient.setQueryData(
        portfolioQueryKeys.activeShellGeneration(selectedPortfolioId),
        activeShellGeneration,
      );
    }
  }, [activeShellGeneration, queryClient, selectedPortfolioId]);
  const initialControlValues = useMemo(
    () =>
      confirmedInitialWorkspace && initialControls
        ? initialControls
        : buildInitialPortfolioControls(confirmedInitialWorkspace),
    [confirmedInitialWorkspace, initialControls],
  );
  const [controlDraft, setControlDraft] = useState<PortfolioControlStateDraft>({
    sourceKey: initialWorkspaceSourceKey,
    controls: initialControlValues,
  });
  const controls =
    controlDraft.sourceKey === initialWorkspaceSourceKey
      ? controlDraft.controls
      : initialControlValues;
  const setControls = useCallback(
    (
      next:
        | PortfolioWorkspaceControls
        | ((current: PortfolioWorkspaceControls) => PortfolioWorkspaceControls),
    ) => {
      setControlDraft((current) => {
        const currentControls =
          current.sourceKey === initialWorkspaceSourceKey
            ? current.controls
            : initialControlValues;
        return {
          sourceKey: initialWorkspaceSourceKey,
          controls: typeof next === "function" ? next(currentControls) : next,
        };
      });
    },
    [initialControlValues, initialWorkspaceSourceKey],
  );
  const [workspaceDraft, setWorkspaceDraft] = useState<WorkspaceStateDraft>({
    sourceKey: initialWorkspaceSourceKey,
    workspace: confirmedInitialWorkspace,
  });
  const workspaceState =
    workspaceDraft.sourceKey === initialWorkspaceSourceKey
      ? workspaceDraft.workspace
      : confirmedInitialWorkspace;
  const workspaceSourceGeneration = useMemo(
    () =>
      buildPortfolioWorkspaceSourceGeneration(
        selectedPortfolioId,
        workspaceState,
      ),
    [selectedPortfolioId, workspaceState],
  );
  const setWorkspaceState = useCallback(
    (
      next:
        | PortfolioWorkspace
        | null
        | ((current: PortfolioWorkspace | null) => PortfolioWorkspace | null),
    ) => {
      setWorkspaceDraft((current) => {
        const currentWorkspace =
          current.sourceKey === initialWorkspaceSourceKey
            ? current.workspace
            : confirmedInitialWorkspace;
        return {
          sourceKey: initialWorkspaceSourceKey,
          workspace: typeof next === "function" ? next(currentWorkspace) : next,
        };
      });
    },
    [confirmedInitialWorkspace, initialWorkspaceSourceKey],
  );
  const interactiveReady = useClientMounted();
  const [controlTransition, setControlTransition] =
    useState<PortfolioControlTransition | null>(null);
  const [refreshAnnouncement, setRefreshAnnouncement] =
    useState<PortfolioRefreshAnnouncement | null>(null);
  const initialControlTransition = useMemo<PortfolioControlTransition | null>(
    () =>
      confirmedInitialWorkspace &&
      hasPortfolioSourceControlOverride(
        initialControlValues,
        confirmedInitialWorkspace,
      )
        ? {
            sourceKey: initialWorkspaceSourceKey,
            status: "pending",
            requestedControls: initialControlValues,
          }
        : null,
    [
      confirmedInitialWorkspace,
      initialControlValues,
      initialWorkspaceSourceKey,
    ],
  );
  const activeControlTransition =
    controlTransition?.sourceKey === initialWorkspaceSourceKey
      ? controlTransition
      : initialControlTransition;
  const awaitsInitialSourceConfirmation =
    activeControlTransition?.status === "pending" &&
    Boolean(
      confirmedInitialWorkspace &&
      hasPortfolioSourceControlOverride(
        activeControlTransition.requestedControls,
        confirmedInitialWorkspace,
      ),
    );
  const context = useMemo(
    () => buildPortfolioWorkspaceContext(workspaceState, controls),
    [controls, workspaceState],
  );
  const activeGenerationShell = useMemo(
    () =>
      workspaceState &&
      buildPortfolioWorkspaceSourceGeneration(
        selectedPortfolioId,
        workspaceState,
      ) === activeShellGeneration
        ? workspaceState
        : undefined,
    [activeShellGeneration, selectedPortfolioId, workspaceState],
  );
  const shellQueryKey = useMemo(
    () =>
      portfolioQueryKeys.workspaceSource(
        selectedPortfolioId ?? "unselected",
        activeShellGeneration,
      ),
    [activeShellGeneration, selectedPortfolioId],
  );
  const retainedShellAfterServerFailure = useMemo(
    () =>
      activeGenerationShell ||
      activeShellGeneration !== initialWorkspaceSourceKey ||
      !selectedPortfolioId
        ? undefined
        : findLatestConfirmedPortfolioShell(queryClient, selectedPortfolioId),
    [
      activeGenerationShell,
      activeShellGeneration,
      initialWorkspaceSourceKey,
      queryClient,
      selectedPortfolioId,
    ],
  );
  const cachedShellStateForServerReconciliation =
    confirmedInitialWorkspace &&
    activeShellGeneration === initialWorkspaceSourceKey
      ? queryClient.getQueryState<PortfolioWorkspace>(shellQueryKey)
      : undefined;
  const cachedShellForServerReconciliation =
    cachedShellStateForServerReconciliation?.data;
  const serverSnapshotReconciliationPending = Boolean(
    confirmedInitialWorkspace &&
    cachedShellForServerReconciliation &&
    buildPortfolioWorkspaceSourceGeneration(
      selectedPortfolioId,
      cachedShellForServerReconciliation,
    ) === initialWorkspaceSourceKey &&
    (cachedShellForServerReconciliation !== confirmedInitialWorkspace ||
      cachedShellStateForServerReconciliation?.status !== "success"),
  );
  const shellQuery = useQuery({
    queryKey: shellQueryKey,
    enabled: Boolean(selectedPortfolioId),
    retry: false,
    structuralSharing: false,
    refetchInterval: ({ state }) =>
      getWorkbenchQueryRevalidationInterval(
        state.dataUpdatedAt,
        state.status,
        state.fetchStatus,
      ),
    refetchOnMount: serverSnapshotReconciliationPending
      ? false
      : activeShellGeneration === initialWorkspaceSourceKey &&
          !confirmedInitialWorkspace
        ? "always"
        : true,
    initialData: activeGenerationShell ?? retainedShellAfterServerFailure,
    initialDataUpdatedAt:
      activeGenerationShell || !retainedShellAfterServerFailure
        ? undefined
        : 0,
    queryFn: async ({ signal }) => {
      recordPortfolioShellRecoveryLifecycle("automatic_attempt");
      try {
        const shellWorkspace = await queryPortfolioWorkspaceShell(
          selectedPortfolioId!,
          signal,
        );
        recordPortfolioShellRecoveryLifecycle("ready");
        return shellWorkspace;
      } catch (error) {
        if (!signal.aborted) {
          recordPortfolioShellRecoveryLifecycle("unavailable");
        }
        throw error;
      }
    },
  });
  useEffect(() => {
    if (
      !serverSnapshotReconciliationPending ||
      !confirmedInitialWorkspace ||
      activeShellGeneration !== initialWorkspaceSourceKey
    ) {
      return;
    }
    queryClient.setQueryData(shellQueryKey, confirmedInitialWorkspace, {
      updatedAt: Math.max(
        Date.now(),
        (cachedShellStateForServerReconciliation?.dataUpdatedAt ?? 0) + 1,
      ),
    });
  }, [
    activeShellGeneration,
    cachedShellStateForServerReconciliation?.dataUpdatedAt,
    confirmedInitialWorkspace,
    initialWorkspaceSourceKey,
    queryClient,
    serverSnapshotReconciliationPending,
    shellQueryKey,
  ]);
  const awaitsShellSourceConfirmation = Boolean(
    !confirmedInitialWorkspace &&
    activeShellGeneration === initialWorkspaceSourceKey &&
    (shellQuery.isFetching || shellQuery.fetchStatus === "paused"),
  );
  const shellRefreshPaused = Boolean(
    shellQuery.data &&
    shellQuery.fetchStatus === "paused" &&
    !serverSnapshotReconciliationPending &&
    !awaitsShellSourceConfirmation,
  );
  const shellRefreshInFlight = Boolean(
    shellQuery.data &&
    shellQuery.fetchStatus === "fetching" &&
    !serverSnapshotReconciliationPending &&
    !awaitsShellSourceConfirmation,
  );
  const activeShellRequestStatus = !selectedPortfolioId
    ? "idle"
    : awaitsShellSourceConfirmation || shellQuery.isPending
      ? "loading"
      : isPortfolioWorkspaceIdentityConfirmed(
          shellQuery.data,
          selectedPortfolioId,
        )
      ? "loaded"
      : "unavailable";

  useEffect(
    () => () => {
      if (activeGenerationShell) {
        const currentShellState =
          queryClient.getQueryState<PortfolioWorkspace>(shellQueryKey);
        const cachedGeneration = buildPortfolioWorkspaceSourceGeneration(
          selectedPortfolioId,
          currentShellState?.data ?? null,
        );
        if (cachedGeneration !== activeShellGeneration) {
          queryClient.setQueryData(shellQueryKey, activeGenerationShell, {
            updatedAt: Math.max(
              0,
              (currentShellState?.dataUpdatedAt ?? 1) - 1,
            ),
          });
        }
      }
    }, [
      activeGenerationShell,
      activeShellGeneration,
      queryClient,
      selectedPortfolioId,
      shellQueryKey,
    ],
  );

  useEffect(() => {
    const shellWorkspace = shellQuery.data;
    const serverSnapshotChanged =
      workspaceDraft.sourceKey !== initialWorkspaceSourceKey;
    if (
      !serverSnapshotChanged &&
      (awaitsShellSourceConfirmation ||
        !shellWorkspace ||
        workspaceState === shellWorkspace ||
        !isPortfolioWorkspaceIdentityConfirmed(
          shellWorkspace,
          selectedPortfolioId,
        ))
    ) {
      return;
    }

    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) {
        return;
      }
      if (serverSnapshotChanged) {
        if (selectedPortfolioId && confirmedInitialWorkspace) {
          queryClient.setQueryData(shellQueryKey, confirmedInitialWorkspace);
        }
        setActiveShellGeneration(initialWorkspaceSourceKey);
        setWorkspaceState(confirmedInitialWorkspace);
        return;
      }
      if (
        !shellWorkspace ||
        !selectedPortfolioId ||
        !isPortfolioWorkspaceIdentityConfirmed(
          shellWorkspace,
          selectedPortfolioId,
        ) ||
        queryClient.getQueryData(shellQueryKey) !== shellWorkspace
      ) {
        return;
      }
      const refreshedSourceGeneration =
        buildPortfolioWorkspaceSourceGeneration(
          selectedPortfolioId,
          shellWorkspace,
        );
      if (
        !shellQuery.isError &&
        refreshedSourceGeneration !== activeShellGeneration
      ) {
        queryClient.setQueryData(
          portfolioQueryKeys.workspaceSource(
            selectedPortfolioId,
            refreshedSourceGeneration,
          ),
          shellWorkspace,
          { updatedAt: shellQuery.dataUpdatedAt },
        );
        setActiveShellGeneration(refreshedSourceGeneration);
      }
      setControls((current) => {
        if (
          workspaceState &&
          hasPortfolioSourceControlOverride(current, workspaceState)
        ) {
          return current;
        }
        const defaults = buildInitialPortfolioControls(shellWorkspace);
        return {
          ...defaults,
          timeWindow: current.timeWindow,
        };
      });
      setWorkspaceState(shellWorkspace);
    });
    return () => {
      cancelled = true;
    };
  }, [
    activeShellGeneration,
    awaitsShellSourceConfirmation,
    confirmedInitialWorkspace,
    initialWorkspaceSourceKey,
    queryClient,
    selectedPortfolioId,
    setActiveShellGeneration,
    setControls,
    setWorkspaceState,
    shellQueryKey,
    shellQuery.data,
    shellQuery.dataUpdatedAt,
    shellQuery.isError,
    workspaceDraft.sourceKey,
    workspaceState,
  ]);

  const summaryRequest = useMemo(
    () =>
      selectedPortfolioId && workspaceState
        ? buildPortfolioSummaryDetailsRequest(selectedPortfolioId, context)
        : null,
    [context, selectedPortfolioId, workspaceState],
  );
  const summaryQueryKey = useMemo(
    () =>
      summaryRequest
        ? portfolioQueryKeys.summaryDetails(
            selectedPortfolioId!,
            workspaceSourceGeneration,
            summaryRequest.params,
          )
        : [...portfolioQueryKeys.all, "summary-details", "unselected"],
    [selectedPortfolioId, summaryRequest, workspaceSourceGeneration],
  );
  const summaryQuery = useQuery({
    queryKey: summaryQueryKey,
    enabled: Boolean(selectedPortfolioId && workspaceState && summaryRequest),
    refetchInterval: ({ state }) =>
      getWorkbenchQueryRevalidationInterval(
        state.dataUpdatedAt,
        state.status,
        state.fetchStatus,
      ),
    queryFn: ({ signal }) =>
      queryPortfolioWorkspaceSummaryDetails(
        selectedPortfolioId!,
        summaryRequest!.params,
        controls,
        signal,
      ),
  });
  useEffect(() => {
    if (!selectedPortfolioId) {
      return;
    }

    const intentKey = portfolioQueryKeys.reviewContextIntent();
    queryClient.setQueryData(intentKey, `${initialWorkspaceSourceKey}|idle`);
    return () => {
      queryClient.setQueryData(
        intentKey,
        `${initialWorkspaceSourceKey}|inactive`,
      );
      void queryClient.cancelQueries({
        queryKey: portfolioQueryKeys.summaryDetailsRoot(selectedPortfolioId),
      });
    };
  }, [initialWorkspaceSourceKey, queryClient, selectedPortfolioId]);
  const summaryResponseIsCurrent = Boolean(
    summaryRequest &&
    selectedPortfolioId &&
    isPortfolioReviewResponseCurrent(
      summaryQuery.data ?? null,
      controls,
      summaryRequest.params,
      selectedPortfolioId,
    ),
  );
  const resolvedWorkspaceState = useMemo(
    () =>
      workspaceState && summaryResponseIsCurrent
        ? mergePortfolioWorkspace(workspaceState, summaryQuery.data!)
        : workspaceState,
    [summaryQuery.data, summaryResponseIsCurrent, workspaceState],
  );

  useEffect(() => {
    if (
      (!summaryQuery.isSuccess && !summaryQuery.isError) ||
      !summaryRequest ||
      !selectedPortfolioId ||
      !workspaceState
    ) {
      return;
    }

    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) {
        return;
      }
      const sourceOverrideRequested = hasPortfolioSourceControlOverride(
        controls,
        workspaceState,
      );
      if (summaryResponseIsCurrent) {
        if (sourceOverrideRequested) {
          setControlTransition({
            sourceKey: initialWorkspaceSourceKey,
            status: "confirmed",
            requestedControls: controls,
          });
        }
        return;
      }

      const requestedControls = controls;
      if (sourceOverrideRequested) {
        const confirmedControls = restorePortfolioSourceControls(
          controls,
          workspaceState,
        );
        setControls(confirmedControls);
        replaceRoute(
          buildPortfolioReviewHref({
            pathname,
            searchParams: new URLSearchParams(searchParamsString),
            portfolioId: selectedPortfolioId,
            controls: confirmedControls,
          }),
          { scroll: false },
        );
        setControlTransition({
          sourceKey: initialWorkspaceSourceKey,
          status: "failed",
          requestedControls,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    controls,
    initialWorkspaceSourceKey,
    pathname,
    replaceRoute,
    searchParamsString,
    selectedPortfolioId,
    setControls,
    summaryQuery.data,
    summaryQuery.dataUpdatedAt,
    summaryQuery.isError,
    summaryQuery.isSuccess,
    summaryRequest,
    summaryResponseIsCurrent,
    workspaceState,
  ]);

  const detailGenerationPending = Boolean(
    workspaceState && summaryRequest && summaryQuery.isPending,
  );
  const detailSourceConfirmationPaused = Boolean(
    detailGenerationPending && summaryQuery.fetchStatus === "paused",
  );
  const detailRefreshPaused = Boolean(
    summaryQuery.data &&
    summaryQuery.fetchStatus === "paused" &&
    !detailGenerationPending,
  );
  const detailRefreshInFlight = Boolean(
    summaryQuery.data &&
    summaryQuery.fetchStatus === "fetching" &&
    !detailGenerationPending,
  );
  const workspace = useMemo(
    () =>
      awaitsInitialSourceConfirmation || detailGenerationPending
        ? null
        : derivePortfolioWorkspace(resolvedWorkspaceState, controls),
    [
      awaitsInitialSourceConfirmation,
      controls,
      detailGenerationPending,
      resolvedWorkspaceState,
    ],
  );
  const refreshScope = `${selectedPortfolioId ?? "unselected"}|${workspaceSourceGeneration}|${summaryRequest?.key ?? "no-detail"}`;
  const portfolioCheckedAt =
    shellQuery.data &&
    summaryResponseIsCurrent &&
    shellQuery.dataUpdatedAt > 0 &&
    summaryQuery.dataUpdatedAt > 0
      ? getOldestWorkbenchReceiptTime(
          shellQuery.dataUpdatedAt,
          summaryQuery.dataUpdatedAt,
        )
      : null;

  async function recheckPortfolio() {
    if (!selectedPortfolioId || !summaryRequest) {
      return;
    }
    const requestedScope = refreshScope;
    const requestedGeneration = workspaceSourceGeneration;
    const [shellResult, detailResult] = await Promise.all([
      shellQuery.refetch(),
      summaryQuery.refetch(),
    ]);
    const returnedShellGeneration = buildPortfolioWorkspaceSourceGeneration(
      selectedPortfolioId,
      shellResult.data ?? null,
    );
    if (
      shellResult.isSuccess &&
      detailResult.isSuccess &&
      returnedShellGeneration === requestedGeneration &&
      isPortfolioReviewResponseCurrent(
        detailResult.data ?? null,
        controls,
        summaryRequest.params,
        selectedPortfolioId,
      )
    ) {
      setRefreshAnnouncement({
        scope: requestedScope,
        message: "Portfolio evidence rechecked.",
      });
    }
  }

  function handleControlsChange(patch: Partial<PortfolioWorkspaceControls>) {
    const nextControls = applyPortfolioControlPatch(controls, patch);
    if (!requiresSourceConfirmation(patch)) {
      setControls(nextControls);
      return;
    }

    void confirmPortfolioControls(nextControls);
  }

  async function confirmPortfolioControls(
    requestedControls: PortfolioWorkspaceControls,
  ) {
    if (!selectedPortfolioId || !workspaceState) {
      return;
    }

    const requestedContext = buildPortfolioWorkspaceContext(
      workspaceState,
      requestedControls,
    );
    const request = buildPortfolioSummaryDetailsRequest(
      selectedPortfolioId,
      requestedContext,
    );
    const queryKey = portfolioQueryKeys.summaryDetails(
      selectedPortfolioId,
      workspaceSourceGeneration,
      request.params,
    );
    const intent = `${workspaceSourceGeneration}|${request.key}`;
    const intentKey = portfolioQueryKeys.reviewContextIntent();
    queryClient.setQueryData(intentKey, intent);
    setControlTransition({
      sourceKey: initialWorkspaceSourceKey,
      status: "pending",
      requestedControls,
    });

    await queryClient.cancelQueries({
      queryKey: portfolioQueryKeys.summaryDetailsRoot(selectedPortfolioId),
    });
    if (queryClient.getQueryData(intentKey) !== intent) {
      return;
    }
    await queryClient.invalidateQueries({ queryKey, exact: true });
    let details: Awaited<
      ReturnType<typeof getPortfolioWorkspaceSummaryDetails>
    >;
    try {
      details = await queryClient.fetchQuery({
        queryKey,
        queryFn: ({ signal }) =>
          queryPortfolioWorkspaceSummaryDetails(
            selectedPortfolioId,
            request.params,
            requestedControls,
            signal,
          ),
      });
    } catch (error) {
      if (isCancelledError(error)) {
        return;
      }
      if (queryClient.getQueryData(intentKey) !== intent) {
        return;
      }
      setControlTransition({
        sourceKey: initialWorkspaceSourceKey,
        status: "failed",
        requestedControls,
      });
      return;
    }
    if (queryClient.getQueryData(intentKey) !== intent) {
      return;
    }

    const currentActiveShellGeneration =
      queryClient.getQueryData<string>(
        portfolioQueryKeys.activeShellGeneration(selectedPortfolioId),
      ) ?? activeShellGeneration;
    if (currentActiveShellGeneration !== workspaceSourceGeneration) {
      setControlTransition({
        sourceKey: initialWorkspaceSourceKey,
        status: "failed",
        requestedControls,
      });
      return;
    }

    const currentShell = queryClient.getQueryData<PortfolioWorkspace>(
      portfolioQueryKeys.workspaceSource(
        selectedPortfolioId,
        currentActiveShellGeneration,
      ),
    );
    if (
      buildPortfolioWorkspaceSourceGeneration(
        selectedPortfolioId,
        currentShell ?? null,
      ) !== workspaceSourceGeneration
    ) {
      setControlTransition({
        sourceKey: initialWorkspaceSourceKey,
        status: "failed",
        requestedControls,
      });
      return;
    }

    if (
      !isPortfolioReviewResponseCurrent(
        details,
        requestedControls,
        request.params,
        selectedPortfolioId,
      )
    ) {
      setControlTransition({
        sourceKey: initialWorkspaceSourceKey,
        status: "failed",
        requestedControls,
      });
      return;
    }

    setControls(requestedControls);
    pushRoute(
      buildPortfolioReviewHref({
        pathname,
        searchParams: new URLSearchParams(searchParamsString),
        portfolioId: selectedPortfolioId,
        controls: requestedControls,
      }),
      { scroll: false },
    );
    setControlTransition({
      sourceKey: initialWorkspaceSourceKey,
      status: "confirmed",
      requestedControls,
    });
  }

  function handleExport() {
    const payload = buildPortfolioExportPayload(workspace, context);
    if (!payload || !workspace) {
      return;
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = `${workspace.portfolio.portfolio_id}-${context.selectedAsOfDate}.json`;
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
  }

  const sourceGenerationConfirmationPending = Boolean(
    summaryQuery.isPending &&
    workspaceState &&
    hasPortfolioSourceControlOverride(controls, workspaceState),
  );
  const visibleControlTransition: PortfolioControlTransition | null =
    sourceGenerationConfirmationPending
      ? {
          sourceKey: initialWorkspaceSourceKey,
          status: "pending",
          requestedControls: controls,
        }
      : activeControlTransition;
  const acceptedReportingCurrency =
    workspace &&
    visibleControlTransition?.status === "confirmed" &&
    visibleControlTransition.requestedControls.reportingCurrency !==
      workspace.portfolio.base_currency
      ? visibleControlTransition.requestedControls.reportingCurrency
      : undefined;
  const controlTransitionStatus = visibleControlTransition ? (
    <PortfolioControlTransitionStatus
      transition={visibleControlTransition}
      confirmedControls={controls}
      onRetry={() =>
        void confirmPortfolioControls(
          visibleControlTransition.requestedControls,
        )
      }
    />
  ) : null;
  const controlTransitionRequiresAction =
    visibleControlTransition?.status === "pending" ||
    visibleControlTransition?.status === "failed";
  const portfolioRefreshStatus = detailSourceConfirmationPaused ? (
    <WorkbenchRefreshStatus
      kind="pending"
      eyebrow="Portfolio review"
      title="Portfolio detail is waiting for connectivity"
      message="Positions and analysis remain withheld until connectivity returns and the current portfolio detail is confirmed."
      requestedContext={formatPortfolioControlContext(controls)}
      confirmedContext={formatPortfolioControlContext(controls)}
    />
  ) : controlTransitionRequiresAction ? (
    controlTransitionStatus
  ) : awaitsShellSourceConfirmation && shellQuery.data ? (
    <WorkbenchRefreshStatus
      kind="pending"
      eyebrow="Portfolio review"
      title="Confirming current portfolio overview"
      message="Previously viewed portfolio facts remain withheld until the current overview is confirmed."
      requestedContext={`${shellQuery.data.portfolio.display_name} · Current overview`}
      confirmedContext={formatPortfolioControlContext(
        buildInitialPortfolioControls(shellQuery.data),
      )}
    />
  ) : summaryQuery.isError &&
    workspaceState &&
    !serverSnapshotReconciliationPending &&
    shellQuery.isRefetchError &&
    shellQuery.data ? (
    <WorkbenchRefreshStatus
      kind="failed"
      eyebrow="Portfolio review"
      title="Portfolio overview and detail could not be refreshed"
      message="The previous portfolio view remains active while both source reads are retried."
      confirmedContext={formatPortfolioControlContext(controls)}
      onRetry={() => {
        void Promise.all([shellQuery.refetch(), summaryQuery.refetch()]);
      }}
      retrying={shellQuery.isFetching || summaryQuery.isFetching}
      retryLabel="Retry portfolio overview and detail refresh"
      retryText="Retry both"
    />
  ) : summaryQuery.isError && workspaceState ? (
    <WorkbenchRefreshStatus
      kind="failed"
      eyebrow="Portfolio review"
      title={
        summaryQuery.data
          ? "Portfolio detail could not be refreshed"
          : "Portfolio detail is unavailable"
      }
      message={
        summaryQuery.data
          ? "The previous portfolio view remains active while the refresh is retried."
          : "The portfolio overview remains visible, but positions and analysis could not be confirmed."
      }
      confirmedContext={formatPortfolioControlContext(controls)}
      onRetry={() => void summaryQuery.refetch()}
      retrying={summaryQuery.isFetching}
      retryLabel="Retry portfolio detail refresh"
    />
  ) : !serverSnapshotReconciliationPending &&
    shellQuery.isRefetchError &&
    shellQuery.data ? (
    <WorkbenchRefreshStatus
      kind="failed"
      eyebrow="Portfolio review"
      title="Portfolio overview could not be refreshed"
      message="The previous portfolio view remains active while the refresh is retried."
      confirmedContext={formatPortfolioControlContext(controls)}
      onRetry={() => void shellQuery.refetch()}
      retrying={shellQuery.isFetching}
      retryLabel="Retry portfolio overview refresh"
    />
  ) : shellRefreshPaused && shellQuery.data ? (
    <WorkbenchRefreshStatus
      kind="pending"
      eyebrow="Portfolio review"
      title="Portfolio refresh is waiting for connectivity"
      message="The last confirmed portfolio view remains visible, but it may be out of date until connectivity returns and the refresh completes."
      requestedContext={formatPortfolioControlContext(controls)}
      confirmedContext={formatPortfolioControlContext(controls)}
    />
  ) : shellRefreshInFlight ? (
    <WorkbenchRefreshStatus
      kind="pending"
      eyebrow="Portfolio review"
      title="Refreshing portfolio overview"
      message="The previously retrieved portfolio overview remains visible as prior evidence until updated figures arrive."
      requestedContext={formatPortfolioControlContext(controls)}
      confirmedContext={formatPortfolioControlContext(controls)}
    />
  ) : detailRefreshPaused ? (
    <WorkbenchRefreshStatus
      kind="pending"
      eyebrow="Portfolio review"
      title="Portfolio detail refresh is waiting for connectivity"
      message="The last confirmed positions and analysis remain visible, but they may be out of date until connectivity returns and the refresh completes."
      requestedContext={formatPortfolioControlContext(controls)}
      confirmedContext={formatPortfolioControlContext(controls)}
    />
  ) : detailRefreshInFlight ? (
    <WorkbenchRefreshStatus
      kind="pending"
      eyebrow="Portfolio review"
      title="Refreshing portfolio detail"
      message="The previously retrieved positions and analysis remain visible as prior evidence until updated figures arrive."
      requestedContext={formatPortfolioControlContext(controls)}
      confirmedContext={formatPortfolioControlContext(controls)}
    />
  ) : detailGenerationPending ? (
    <WorkbenchRefreshStatus
      kind="pending"
      eyebrow="Portfolio review"
      title="Refreshing portfolio detail"
      message="Positions and analysis are being confirmed for the latest portfolio overview."
      requestedContext={formatPortfolioControlContext(controls)}
      confirmedContext={formatPortfolioControlContext(controls)}
    />
  ) : (
    controlTransitionStatus
  );

  return (
    <PortfolioPageLayout
      reviewContext={
        workspace
          ? buildPortfolioReviewContextStrip(workspace, {
              acceptedReportingCurrency,
            })
          : buildUnavailableReviewContextStrip()
      }
    >
      {!portfolios.length ? (
        <PortfolioUnavailableWorkspace />
      ) : (
        <PortfolioWorkspaceView
          workspace={workspace}
          workspaceStatus={
            workspace
              ? "ready"
              : awaitsInitialSourceConfirmation ||
                  detailGenerationPending ||
                  (selectedPortfolioId &&
                    (activeShellRequestStatus === "idle" ||
                      activeShellRequestStatus === "loading"))
                ? "loading"
                : "unavailable"
          }
          context={context}
          toolbar={
            !interactiveReady ? (
              <div className="workbench-toolbar-placeholder-stack">
                <WorkbenchToolbarPlaceholder
                  className="portfolio-workspace-toolbar"
                  contextMessage="Loading portfolio controls…"
                  fields={[
                    { key: "as-of", label: "As of" },
                    {
                      key: "reporting-currency",
                      label: PORTFOLIO_CURRENCY_LABELS.reporting,
                    },
                    { key: "period", label: "Period", width: "period" },
                  ]}
                />
              </div>
            ) : (
              <>
                <PortfolioWorkspaceToolbar
                  controls={controls}
                  context={context}
                  onControlsChange={handleControlsChange}
                  onExport={handleExport}
                  quickActions={
                    resolvedWorkspaceState
                      ? getOrderedWorkflowCues(resolvedWorkspaceState)
                      : []
                  }
                  sourceReceipt={{
                    checkedAt: portfolioCheckedAt,
                    refreshScope,
                    isRefreshing:
                      shellQuery.isFetching || summaryQuery.isFetching,
                    onRefresh: recheckPortfolio,
                    announcement:
                      refreshAnnouncement?.scope === refreshScope
                        ? refreshAnnouncement.message
                        : undefined,
                  }}
                  contextChangePending={
                    activeControlTransition?.status === "pending"
                  }
                />
                {portfolioRefreshStatus}
              </>
            )
          }
        />
      )}
    </PortfolioPageLayout>
  );
}

function PortfolioControlTransitionStatus({
  transition,
  confirmedControls,
  onRetry,
}: {
  transition: PortfolioControlTransition;
  confirmedControls: PortfolioWorkspaceControls;
  onRetry: () => void;
}) {
  const requestedContext = formatPortfolioControlContext(
    transition.requestedControls,
  );

  const confirmedContext = formatPortfolioControlContext(confirmedControls);

  if (transition.status === "pending") {
    return (
      <WorkbenchRefreshStatus
        kind="pending"
        eyebrow="Portfolio review context"
        title="Confirming review context"
        message="Source-backed portfolio detail is being refreshed before the view changes."
        requestedContext={requestedContext}
        confirmedContext={confirmedContext}
      />
    );
  }

  if (transition.status === "failed") {
    return (
      <WorkbenchRefreshStatus
        kind="failed"
        eyebrow="Portfolio review context"
        title="Review context was not changed"
        message="Portfolio detail could not be confirmed. The previous review context remains active."
        requestedContext={requestedContext}
        confirmedContext={confirmedContext}
        onRetry={onRetry}
        retryLabel="Retry portfolio review context"
      />
    );
  }

  return (
    <WorkbenchRefreshStatus
      kind="confirmed"
      eyebrow="Portfolio review context"
      title="Review context confirmed"
      confirmedContext={confirmedContext}
    />
  );
}

function requiresSourceConfirmation(
  patch: Partial<PortfolioWorkspaceControls>,
): boolean {
  return [
    patch.asOfDate,
    patch.reportingCurrency,
    patch.timeWindow,
    patch.customStartDate,
    patch.customEndDate,
  ].some((value) => value !== undefined);
}

function formatPortfolioControlContext(
  controls: PortfolioWorkspaceControls,
): string {
  return `${formatBusinessDateValue(controls.asOfDate)} · ${controls.timeWindow} · ${controls.reportingCurrency}`;
}

function findLatestConfirmedPortfolioShell(
  queryClient: QueryClient,
  portfolioId: string,
): PortfolioWorkspace | undefined {
  const shellQueries = queryClient
    .getQueryCache()
    .findAll({ queryKey: portfolioQueryKeys.workspaceRoot(portfolioId) })
    .filter((query) => query.queryKey[3] === "shell")
    .sort(
      (left, right) => right.state.dataUpdatedAt - left.state.dataUpdatedAt,
    );

  for (const query of shellQueries) {
    const workspace = query.state.data as PortfolioWorkspace | undefined;
    if (isPortfolioWorkspaceIdentityConfirmed(workspace, portfolioId)) {
      return workspace;
    }
  }
  return undefined;
}
