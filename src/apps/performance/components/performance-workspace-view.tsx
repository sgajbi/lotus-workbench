import {
  MainWithSideRailLayout,
  Panel,
  SourceRefreshAction,
  WorkbenchDataAge,
  WorkbenchRefreshStatus,
  WorkbenchPageFrame,
  WorkbenchSectionStack,
} from "@/design-system";
import {
  isPartialCapability,
  isSupportedCapability,
  type WorkspaceCapability,
} from "@/shell/workspace-capabilities";

import {
  getPerformanceWorkspaceCapabilities,
  type PerformanceWorkspaceCapabilities,
} from "../capabilities";
import {
  getPerformanceWorkspaceModeDefinition,
  type PerformanceWorkspaceMode,
} from "../performance-workspace-modes";
import {
  PERFORMANCE_REFRESH_COPY,
  PERFORMANCE_WORKFLOW_LABELS,
} from "../performance-terminology";
import {
  getPerformanceWorkspacePresentation,
} from "../view-model";
import PerformanceAdvisorBriefMode from "./performance-advisor-brief-mode";
import PerformanceAnalysisMode from "./performance-analysis-mode";
import PerformanceAnalyticalUnavailableState from "./performance-analytical-unavailable-state";
import PerformanceEvidenceMode from "./performance-evidence-mode";
import PerformanceRiskMode from "./performance-risk-mode";
import PerformanceSummaryMode from "./performance-summary-mode";
import PerformanceWorkspaceSidePanel from "./performance-workspace-side-panel";
import PortfolioScreenRail from "@/apps/portfolio/components/portfolio-screen-rail";
import type { PortfolioScreenRailModeItem } from "@/apps/portfolio/components/portfolio-screen-rail";
import type { PortfolioScreenNavigationKey } from "@/apps/portfolio/portfolio-screen-navigation";
import type {
  PerformanceWorkspaceControls,
  PerformanceWorkspaceViewProps,
} from "./performance-workspace-types";
import {
  getBenchmarkLabel,
  getPerformanceControlNormalizationNotice,
} from "./performance-workspace-view-helpers";
import styles from "./performance-workspace-view.module.css";

export default function PerformanceWorkspaceView({
  workspace,
  loadIssue,
  refreshStatus,
  sourceReceipt,
  mode,
  period,
  detailBasis,
  contributionDimension,
  attributionDimension,
  chartFrequency,
  benchmark,
  onModeChange,
  onRequestChange,
  onRetryRefresh,
  isUpdating = false,
  isDetailsPending = false,
}: PerformanceWorkspaceViewProps) {
  const presentation = workspace ? getPerformanceWorkspacePresentation(workspace) : null;
  const capabilities = workspace ? getPerformanceWorkspaceCapabilities(workspace) : null;
  const modeDefinition = getPerformanceWorkspaceModeDefinition(mode);
  const workspaceTitle = modeDefinition.workspaceTitle;
  const unavailableCopy = getWorkspaceUnavailableCopy(loadIssue, workspaceTitle, modeDefinition.label);
  const railPortfolioId = workspace?.portfolio.portfolio_id ?? "Portfolio pending";
  const activeWorkbenchScreen = getActiveWorkbenchScreen(mode);
  const selectedBenchmarkCode = workspace?.benchmark_code ?? benchmark ?? undefined;
  const selectedBenchmarkLabel = workspace
    ? getBenchmarkLabel(workspace, selectedBenchmarkCode)
    : undefined;
  const selectedPerformance =
    workspace && detailBasis === "GROSS" ? workspace.gross_performance : workspace?.net_performance;
  const controlNormalizationNotice = workspace
    ? getPerformanceControlNormalizationNotice(workspace)
    : null;
  const performanceRailModeItems = buildPerformanceRailModeItems({
    mode,
    capabilities,
    isDetailsPending,
    onModeChange,
  });
  const controls: PerformanceWorkspaceControls = {
    period,
    detailBasis,
    contributionDimension,
    attributionDimension,
    chartFrequency,
    benchmark,
    onRequestChange,
    isUpdating,
    isDetailsPending,
  };
  const sourceReceiptAction = sourceReceipt ? (
    <div className={styles.sourceReceipt}>
      <WorkbenchDataAge updatedAt={sourceReceipt.checkedAt} />
      {sourceReceipt.canRecheck ? (
        <SourceRefreshAction
          refreshScope={sourceReceipt.refreshScope}
          idleLabel={PERFORMANCE_REFRESH_COPY.recheckAction}
          busyLabel={PERFORMANCE_REFRESH_COPY.recheckingAction}
          isRefreshing={sourceReceipt.isRefreshing}
          onRefresh={sourceReceipt.onRefresh}
        />
      ) : null}
    </div>
  ) : undefined;

  const modePanel = !workspace ? null : mode === "summary" ? (
    <PerformanceSummaryMode
      workspace={workspace}
      {...controls}
      capabilities={capabilities!}
      selectedBenchmarkCode={selectedBenchmarkCode}
      selectedBenchmarkLabel={selectedBenchmarkLabel}
      selectedPerformance={selectedPerformance}
      primaryDriver={presentation?.primaryDriver ?? null}
      hasMoneyWeightedReturn={presentation?.hasMoneyWeightedReturn ?? false}
      suspiciousMoneyWeightedReturn={presentation?.suspiciousMoneyWeightedReturn ?? false}
      contributorScale={presentation?.contributorScale ?? 0.01}
      positivePositionContributors={presentation?.positivePositionContributors ?? []}
      negativePositionContributors={presentation?.negativePositionContributors ?? []}
      topContributors={presentation?.topContributors ?? []}
      bottomContributors={presentation?.bottomContributors ?? []}
    />
  ) : mode === "analysis" ? (
    <PerformanceAnalysisMode
      workspace={workspace}
      {...controls}
      capabilities={capabilities!}
    />
  ) : mode === "advisor" ? (
    <PerformanceAdvisorBriefMode
      workspace={workspace}
      {...controls}
      capabilities={capabilities!}
      onSelectMode={onModeChange}
    />
  ) : mode === "risk" ? (
    <PerformanceRiskMode
      workspace={workspace}
      {...controls}
      capabilities={capabilities!}
    />
  ) : (
    <PerformanceEvidenceMode
      capability={capabilities!.evidence}
      evidenceView={workspace.evidence_view ?? null}
      selection={{
        asOfDate: workspace.as_of_date,
        period: workspace.period,
        reportStartDate: workspace.report_start_date,
        reportEndDate: workspace.report_end_date,
        basis: workspace.detail_basis,
        benchmarkCode: workspace.benchmark_code,
        contributionDimension: workspace.contribution_dimension,
        attributionDimension: workspace.attribution_dimension,
      }}
    />
  );

  return (
    <MainWithSideRailLayout
      className="performance-layout portfolio-page"
      railClassName="performance-rail-shell"
      mainClassName="performance-main"
      sideClassName="performance-side performance-side-wide"
      sideDensity="comfortable"
      rail={
        <PortfolioScreenRail
          portfolioId={railPortfolioId}
          activeScreen={activeWorkbenchScreen}
          relationshipIdBase="performance-workspace-rail"
          modeItems={performanceRailModeItems}
          modeNavigationLabel="Performance surface navigation"
        />
      }
      main={
        !workspace ? (
            <WorkbenchPageFrame
            className={`performance-page-frame performance-page-frame-${mode}`}
            bodyClassName="performance-page-frame-body"
            title={workspaceTitle}
            actions={sourceReceiptAction}
          >
            <WorkbenchSectionStack className="performance-page-sections">
              <Panel className="performance-page-unavailable-shell">
                <PerformanceAnalyticalUnavailableState
                  ariaLabel={unavailableCopy.ariaLabel}
                  status={unavailableCopy.status}
                  title={unavailableCopy.title}
                  body={unavailableCopy.body}
                  hint={unavailableCopy.hint}
                  contextItems={unavailableCopy.contextItems}
                  availableItems={[
                    {
                      label: "Shell",
                      value: "Workspace navigation and route context remain available.",
                    },
                  ]}
                />
              </Panel>
            </WorkbenchSectionStack>
          </WorkbenchPageFrame>
        ) : (
          <WorkbenchPageFrame
            className={`performance-page-frame performance-page-frame-${mode}`}
            bodyClassName="performance-page-frame-body"
            title={workspaceTitle}
            actions={sourceReceiptAction}
          >
            <WorkbenchSectionStack className="performance-page-sections">
              {refreshStatus ? (
                refreshStatus.kind === "confirmed" ? (
                  <WorkbenchRefreshStatus
                    kind="confirmed"
                    eyebrow={getRefreshStatusEyebrow(refreshStatus)}
                    title={getRefreshStatusTitle(refreshStatus)}
                    confirmedContext={refreshStatus.confirmedContext}
                    className="performance-refresh-status"
                  />
                ) : (
                  <WorkbenchRefreshStatus
                    kind={refreshStatus.kind}
                    eyebrow={getRefreshStatusEyebrow(refreshStatus)}
                    title={getRefreshStatusTitle(refreshStatus)}
                    message={getRefreshStatusMessage(refreshStatus)}
                    requestedContext={refreshStatus.requestedContext}
                    confirmedContext={refreshStatus.confirmedContext}
                    onRetry={refreshStatus.kind === "failed" ? onRetryRefresh : undefined}
                    retrying={false}
                    retryLabel={
                      refreshStatus.intent === "recheck"
                        ? PERFORMANCE_REFRESH_COPY.retryAction
                        : undefined
                    }
                    retryText={
                      refreshStatus.intent === "recheck"
                        ? PERFORMANCE_REFRESH_COPY.retryAction
                        : undefined
                    }
                    className="performance-refresh-status"
                  />
                )
              ) : null}
              {controlNormalizationNotice ? (
                <div
                  className="performance-control-normalization-note"
                  role="status"
                  aria-label="Performance control normalization"
                >
                  <p className="performance-control-normalization-note-title">
                    {controlNormalizationNotice.title}
                  </p>
                  <p className="performance-control-normalization-note-message">
                    {controlNormalizationNotice.message}
                  </p>
                </div>
              ) : null}
              {modePanel}
            </WorkbenchSectionStack>
          </WorkbenchPageFrame>
        )
      }
      side={
        <PerformanceWorkspaceSidePanel
          workspace={workspace}
          mode={mode}
          capabilities={capabilities}
          onModeChange={onModeChange}
        />
      }
    />
  );
}

function getRefreshStatusTitle(
  refreshStatus: NonNullable<PerformanceWorkspaceViewProps["refreshStatus"]>
) {
  if (refreshStatus.intent === "recheck") {
    if (refreshStatus.kind === "pending") {
      return PERFORMANCE_REFRESH_COPY.recheck.pending.title;
    }
    if (refreshStatus.kind === "confirmed") {
      return PERFORMANCE_REFRESH_COPY.recheck.confirmed.title;
    }
    return PERFORMANCE_REFRESH_COPY.recheck.failed.title;
  }

  if (refreshStatus.kind === "pending") {
    return refreshStatus.scope === "summary"
      ? "Confirming the selected performance view"
      : "Confirming contribution and attribution detail";
  }

  if (refreshStatus.kind === "confirmed") {
    return refreshStatus.scope === "summary"
      ? "Performance selection confirmed"
      : "Contribution and attribution detail confirmed";
  }

  return refreshStatus.scope === "summary"
    ? "Performance selection could not be confirmed"
    : "Contribution and attribution detail could not be confirmed";
}

function getRefreshStatusEyebrow(
  refreshStatus: NonNullable<PerformanceWorkspaceViewProps["refreshStatus"]>
) {
  if (refreshStatus.intent === "recheck") {
    return refreshStatus.kind === "pending"
      ? PERFORMANCE_REFRESH_COPY.recheck.pending.eyebrow
      : refreshStatus.kind === "confirmed"
        ? PERFORMANCE_REFRESH_COPY.recheck.confirmed.eyebrow
        : PERFORMANCE_REFRESH_COPY.recheck.failed.eyebrow;
  }

  if (refreshStatus.kind === "failed") {
    return "Selection not applied";
  }

  if (refreshStatus.scope === "summary") {
    return refreshStatus.kind === "pending"
      ? "Updating source analysis"
      : "Source analysis updated";
  }

  return refreshStatus.kind === "pending"
    ? "Updating source detail"
    : "Source detail updated";
}

function getRefreshStatusMessage(
  refreshStatus: NonNullable<PerformanceWorkspaceViewProps["refreshStatus"]>
) {
  if (refreshStatus.intent === "recheck") {
    if (refreshStatus.kind === "pending") {
      return PERFORMANCE_REFRESH_COPY.recheck.pending.message;
    }
    return PERFORMANCE_REFRESH_COPY.recheck.failed.message;
  }

  if (refreshStatus.kind === "pending") {
    return "The source-confirmed view remains labelled with its original context until the requested selection is available.";
  }

  const supportSuffix = refreshStatus.status
    ? ` Source request returned HTTP ${refreshStatus.status}.`
    : "";
  return `The requested selection was not applied. The last source-confirmed performance view remains in place.${supportSuffix}`;
}

const PERFORMANCE_SURFACE_ITEMS: Array<{
  mode: PerformanceWorkspaceMode;
  label: string;
  detail: string;
  capabilityKey?: keyof PerformanceWorkspaceCapabilities;
}> = [
  { mode: "summary", label: PERFORMANCE_WORKFLOW_LABELS.overview, detail: "Return path summary" },
  {
    mode: "analysis",
    label: PERFORMANCE_WORKFLOW_LABELS.analysis,
    detail: "Attribution and diagnostics",
    capabilityKey: "attributionDetail",
  },
  { mode: "advisor", label: PERFORMANCE_WORKFLOW_LABELS.adviserBrief, detail: "Internal working narrative" },
  {
    mode: "risk",
    label: PERFORMANCE_WORKFLOW_LABELS.riskReview,
    detail: "Drawdown and concentration",
    capabilityKey: "returnPath",
  },
  { mode: "evidence", label: "Evidence", detail: "Lineage and calculations", capabilityKey: "evidence" },
];

function buildPerformanceRailModeItems({
  mode,
  capabilities,
  isDetailsPending,
  onModeChange,
}: {
  mode: PerformanceWorkspaceViewProps["mode"];
  capabilities: PerformanceWorkspaceCapabilities | null;
  isDetailsPending: boolean;
  onModeChange: PerformanceWorkspaceViewProps["onModeChange"];
}): PortfolioScreenRailModeItem[] {
  return PERFORMANCE_SURFACE_ITEMS.map((item) => {
    const capability = item.capabilityKey ? capabilities?.[item.capabilityKey] : null;
    const isPendingAnalysisAvailability =
      item.mode === "analysis" && isDetailsPending && capability?.state === "unavailable";
    const disabled =
      capability && !isPendingAnalysisAvailability ? !isInteractiveCapability(capability) : false;

    return {
      key: item.mode,
      label: item.label,
      detail: item.detail,
      active: mode === item.mode,
      disabled,
      status: isPendingAnalysisAvailability
        ? "Loading"
        : capability
          ? getCapabilityLabel(capability)
          : undefined,
      title: isPendingAnalysisAvailability
        ? "Analysis availability is loading."
        : disabled
          ? capability?.reason
          : getPerformanceWorkspaceModeDefinition(item.mode).intro?.description,
      onSelect: () => onModeChange(item.mode),
    };
  });
}

function isInteractiveCapability(capability: WorkspaceCapability) {
  return isSupportedCapability(capability) || isPartialCapability(capability);
}

function getCapabilityLabel(capability: WorkspaceCapability) {
  if (capability.state === "supported") {
    return "Ready";
  }
  if (capability.state === "partial") {
    return "Partial";
  }
  return "Unavailable";
}

function getActiveWorkbenchScreen(
  mode: PerformanceWorkspaceViewProps["mode"]
): PortfolioScreenNavigationKey {
  if (mode === "risk") {
    return "risk";
  }
  if (mode === "advisor") {
    return "advisory";
  }
  return "performance";
}

function getWorkspaceUnavailableCopy(
  loadIssue: PerformanceWorkspaceViewProps["loadIssue"],
  workspaceTitle: string,
  modeLabel: string
) {
  if (loadIssue?.state === "permission_blocked") {
    return {
      ariaLabel: "Performance workspace access restricted",
      status: "permission_blocked" as const,
      title: "Access restricted",
      body:
        "The selected analytics workspace is permission-blocked for this caller context.",
      hint:
        "Use an entitled front-office role or contact platform support to verify the caller-context policy. Restricted entitlement details are intentionally not shown in the browser.",
      contextItems: [
        { label: "Surface", value: workspaceTitle },
        { label: "Mode", value: modeLabel },
        { label: "HTTP status", value: String(loadIssue.status ?? "401/403") },
      ],
    };
  }

  return {
    ariaLabel: "Performance workspace unavailable",
    status: "unavailable" as const,
    title: "Performance data unavailable",
    body: "The selected portfolio could not be loaded from the performance workspace contract.",
    hint:
      "The performance workspace contract must resolve successfully before benchmark-aware return, contribution, and risk surfaces can render.",
    contextItems: [
      { label: "Surface", value: workspaceTitle },
      { label: "Mode", value: modeLabel },
    ],
  };
}
