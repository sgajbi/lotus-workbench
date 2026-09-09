import type {
  ContributionPositionView,
  ContributionRowView,
  WorkbenchPerformanceWorkspace,
} from "@/features/workbench/types";

import type { PerformanceWorkspaceCapabilities } from "../capabilities";
import type { PerformanceWorkspaceMode } from "../performance-workspace-modes";

export type PerformanceWorkspaceLoadIssueState = "permission_blocked" | "unavailable";

export type PerformanceWorkspaceLoadIssue = {
  state: PerformanceWorkspaceLoadIssueState;
  status?: number;
};

export type PerformanceWorkspaceRefreshStatus = {
  kind: "pending" | "confirmed" | "failed";
  intent?: "selection" | "recheck";
  scope: "summary" | "details";
  requestedContext: string;
  confirmedContext: string;
  status?: number;
};

export type PerformanceSourceReceipt = {
  checkedAt: number | null;
  refreshScope: string;
  isRefreshing: boolean;
  onRefresh: () => Promise<unknown>;
};

export type PerformanceWorkspaceRequestPatch = {
  portfolioId?: string;
  period?: string;
  detailBasis?: string;
  contributionDimension?: string;
  attributionDimension?: string;
  chartFrequency?: string;
  benchmark?: string;
  reportStartDate?: string;
  reportEndDate?: string;
};

export type PerformanceSourceControlFocusTarget =
  | { kind: "choice"; groupLabel: "Horizon" | "Basis"; optionLabel: string }
  | {
      kind: "field";
      fieldLabel: "Frequency" | "Benchmark" | "Contribution Segment" | "Attribution Segment";
    }
  | { kind: "window" };

export type PerformanceWorkspaceControls = {
  period: string;
  detailBasis: string;
  contributionDimension: string;
  attributionDimension: string;
  chartFrequency: string;
  benchmark?: string;
  onRequestChange?: (
    patch: PerformanceWorkspaceRequestPatch,
    focusTarget?: PerformanceSourceControlFocusTarget
  ) => Promise<boolean>;
  isUpdating: boolean;
  isDetailsPending: boolean;
};

export type PerformanceSummaryModeProps = PerformanceWorkspaceControls & {
  workspace: WorkbenchPerformanceWorkspace;
  capabilities: PerformanceWorkspaceCapabilities;
  selectedBenchmarkCode?: string;
  selectedBenchmarkLabel?: string | null;
  selectedPerformance:
    | WorkbenchPerformanceWorkspace["net_performance"]
    | WorkbenchPerformanceWorkspace["gross_performance"]
    | undefined;
  primaryDriver: ContributionRowView | null;
  hasMoneyWeightedReturn: boolean;
  suspiciousMoneyWeightedReturn: boolean;
  contributorScale: number;
  positivePositionContributors: ContributionPositionView[];
  negativePositionContributors: ContributionPositionView[];
  topContributors: ContributionRowView[];
  bottomContributors: ContributionRowView[];
};

export type PerformanceControlNormalizationHandler = (
  patch: Pick<
    PerformanceWorkspaceRequestPatch,
    "chartFrequency" | "attributionDimension"
  >
) => void;

export type PerformanceSummaryHeaderSectionProps = Pick<
  PerformanceSummaryModeProps,
  | "workspace"
  | "detailBasis"
  | "capabilities"
  | "selectedBenchmarkCode"
  | "selectedBenchmarkLabel"
  | "selectedPerformance"
  | "hasMoneyWeightedReturn"
  | "suspiciousMoneyWeightedReturn"
>;

export type PerformanceSummaryContributorsSectionProps = Pick<
  PerformanceSummaryModeProps,
  | "workspace"
  | "capabilities"
  | "contributorScale"
  | "positivePositionContributors"
  | "negativePositionContributors"
  | "topContributors"
  | "bottomContributors"
  | "isDetailsPending"
>;

export type PerformanceAnalysisModeProps = PerformanceWorkspaceControls & {
  workspace: WorkbenchPerformanceWorkspace;
  capabilities: PerformanceWorkspaceCapabilities;
};

export type PerformanceAnalysisAttributionSectionProps = Pick<
  PerformanceAnalysisModeProps,
  | "workspace"
  | "attributionDimension"
  | "onRequestChange"
  | "isUpdating"
  | "isDetailsPending"
  | "capabilities"
>;

export type PerformanceAdvisorBriefModeProps = PerformanceWorkspaceControls & {
  workspace: WorkbenchPerformanceWorkspace;
  capabilities: PerformanceWorkspaceCapabilities;
  onSelectMode: (mode: PerformanceWorkspaceMode) => void;
};

export type PerformanceRiskModeProps = PerformanceWorkspaceControls & {
  workspace: WorkbenchPerformanceWorkspace;
  capabilities: PerformanceWorkspaceCapabilities;
};

export type PerformanceWorkspaceViewProps = {
  workspace: WorkbenchPerformanceWorkspace | null;
  loadIssue?: PerformanceWorkspaceLoadIssue | null;
  refreshStatus?: PerformanceWorkspaceRefreshStatus | null;
  sourceReceipt?: PerformanceSourceReceipt;
  mode: PerformanceWorkspaceMode;
  period: string;
  detailBasis: string;
  contributionDimension: string;
  attributionDimension: string;
  chartFrequency: string;
  benchmark?: string;
  onModeChange: (mode: PerformanceWorkspaceMode) => void;
  onRequestChange?: (
    patch: PerformanceWorkspaceRequestPatch,
    focusTarget?: PerformanceSourceControlFocusTarget
  ) => Promise<boolean>;
  onRetryRefresh?: () => void;
  isUpdating?: boolean;
  isDetailsPending?: boolean;
};

export type PerformanceWorkspaceModeState = PerformanceWorkspaceMode;
