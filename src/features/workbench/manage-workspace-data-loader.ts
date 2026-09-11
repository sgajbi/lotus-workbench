import {
  getDpmCampaignApprovalDecisions,
  getDpmCampaignAssignmentActions,
  getDpmCampaignAssignmentTasks,
  getDpmCampaignMakerCheckerControls,
  getDpmCommandCenter,
  getDpmCommandCenterExceptions,
  getDpmMandateByPortfolio,
  getDpmMandateHealth,
  getDpmOutcomeReviews,
  getDpmPmOperatingQualityFairnessAnalysis,
  getDpmPmOperatingQualityReviewAction,
  getDpmPmOperatingQualitySummaryInvocation,
  getDpmPortfolioMemory,
  getDpmProofPack,
  isWorkbenchPermissionBlockedError,
  listDpmCampaignApprovalInbox,
  listDpmCampaignAssignmentPlan,
  listDpmCampaignDefinitions,
  listDpmCampaignDiscovery,
  listDpmCampaignOperatingQueue,
  listDpmCampaignWorkflowAutomation,
  listDpmCampaignWorkflowBoard,
  listDpmPmOperatingQualityFairnessAnalyses,
  listDpmPmOperatingQualityPolicies,
  listDpmPmOperatingQualityReviewActions,
  listDpmPmOperatingQualityScoreRuns,
  listDpmPmOperatingQualitySummaryInvocations,
  listDpmWaves,
  searchDpmPortfolioMemory,
} from "@/features/workbench/api";
import type { WorkbenchRequestTarget } from "@/features/workbench/api-client";
import type { ManageMode } from "@/features/workbench/manage-workspace-navigation";
import { readDpmCampaignDefinitionRecords } from "@/features/workbench/dpm-campaign-source-records";
import {
  proofPackPreloadErrorMessage,
  readDpmFairnessAnalysisId,
  readDpmMandateId,
  readDpmReviewActionId,
  readDpmSummaryInvocationId,
  readPreloadableDpmProofPackId,
  type ManageWorkspaceData,
} from "@/features/workbench/manage-workspace-data";
import type { getPortfolio360 } from "@/features/workbench/workbench-core-api";

export type ManageDataRequirement =
  | "command-center"
  | "active-exceptions"
  | "mandate-health"
  | "rebalance-waves"
  | "campaign-workflow"
  | "portfolio-memory"
  | "outcome-reviews"
  | "outcome-evidence"
  | "pm-quality-score-runs"
  | "pm-quality";

export const MANAGE_SHARED_DATA_REQUIREMENTS = [
  "command-center",
  "active-exceptions",
  "mandate-health",
] as const satisfies readonly ManageDataRequirement[];

export const MANAGE_MODE_DATA_REQUIREMENTS = {
  overview: ["rebalance-waves"],
  mandate: [],
  waves: ["rebalance-waves", "campaign-workflow", "outcome-evidence"],
  construction: [],
  memory: ["portfolio-memory"],
  copilot: ["rebalance-waves", "outcome-evidence", "pm-quality-score-runs"],
  quality: ["pm-quality"],
  reviews: ["outcome-reviews"],
  proof: ["outcome-evidence"],
} as const satisfies Record<ManageMode, readonly ManageDataRequirement[]>;

type PortfolioResponse = Awaited<ReturnType<typeof getPortfolio360>>;
type LoaderContext = {
  portfolioId: string;
  signal?: AbortSignal;
  target: WorkbenchRequestTarget;
};
type DataSliceLoader = (
  context: LoaderContext,
) => Promise<Partial<ManageWorkspaceData>>;
type SourceResult<T> = {
  value: T | null;
  error: string | null;
  accessWithheld: boolean;
};

const DATA_SLICE_LOADERS: Record<ManageDataRequirement, DataSliceLoader> = {
  "command-center": loadCommandCenter,
  "active-exceptions": loadActiveExceptions,
  "mandate-health": loadMandateHealth,
  "rebalance-waves": loadRebalanceWaves,
  "campaign-workflow": loadCampaignWorkflow,
  "portfolio-memory": loadPortfolioMemory,
  "outcome-reviews": loadOutcomeReviews,
  "outcome-evidence": loadOutcomeEvidence,
  "pm-quality-score-runs": loadPmQualityScoreRuns,
  "pm-quality": loadPmQuality,
};

export async function loadManageWorkspaceData(
  portfolio: PortfolioResponse,
  mode: ManageMode,
  options: Readonly<{
    signal?: AbortSignal;
    target?: WorkbenchRequestTarget;
  }> = {},
): Promise<ManageWorkspaceData> {
  const requirements = new Set<ManageDataRequirement>([
    ...MANAGE_SHARED_DATA_REQUIREMENTS,
    ...MANAGE_MODE_DATA_REQUIREMENTS[mode],
  ]);
  const context = {
    portfolioId: portfolio.portfolio.portfolio_id,
    signal: options.signal,
    target: options.target ?? "server",
  };
  const slices = await Promise.all(
    [...requirements].map((requirement) => DATA_SLICE_LOADERS[requirement](context)),
  );

  const data = Object.assign(createEmptyManageWorkspaceData(portfolio), ...slices);
  data.sourceAccessWithheld = slices.some((slice) => slice.sourceAccessWithheld === true);
  return data;
}

async function loadCommandCenter({
  signal,
  target,
}: LoaderContext): Promise<Partial<ManageWorkspaceData>> {
  const result = await readSource(
    () => getDpmCommandCenter({ limit: 25 }, target, signal),
    "Mandate readiness is temporarily unavailable.",
  );
  return {
    commandCenter: result.value,
    commandCenterError: result.error,
    sourceAccessWithheld: result.accessWithheld,
  };
}

async function loadActiveExceptions({
  portfolioId,
  signal,
  target,
}: LoaderContext): Promise<Partial<ManageWorkspaceData>> {
  const result = await readSource(
    () => getDpmCommandCenterExceptions({ portfolioId, state: "ACTIVE", limit: 25 }, target, signal),
    "Mandate attention evidence is temporarily unavailable.",
  );
  return {
    commandCenterExceptions: result.value,
    commandCenterExceptionsError: result.error,
    sourceAccessWithheld: result.accessWithheld,
  };
}

async function loadMandateHealth({
  portfolioId,
  signal,
  target,
}: LoaderContext): Promise<Partial<ManageWorkspaceData>> {
  const mandateResult = await readSource(
    () => getDpmMandateByPortfolio(portfolioId, target, signal),
    "Mandate health evidence is temporarily unavailable.",
  );
  const mandateId = readDpmMandateId(mandateResult.value?.data ?? null);
  if (!mandateId) {
    return {
      mandate: mandateResult.value,
      mandateHealth: null,
      mandateHealthError:
        mandateResult.error ?? "Mandate health evidence is unavailable for this portfolio.",
      sourceAccessWithheld: mandateResult.accessWithheld,
    };
  }

  const healthResult = await readSource(
    () => getDpmMandateHealth(mandateId, target, signal),
    "Mandate health evidence is temporarily unavailable.",
  );
  return {
    mandate: mandateResult.value,
    mandateHealth: healthResult.value,
    mandateHealthError: healthResult.error
      ? "Mandate health evidence is temporarily unavailable."
      : null,
    sourceAccessWithheld:
      mandateResult.accessWithheld || healthResult.accessWithheld,
  };
}

async function loadRebalanceWaves({
  signal,
  target,
}: LoaderContext): Promise<Partial<ManageWorkspaceData>> {
  const result = await readSource(
    () => listDpmWaves({ triggerType: "EXPLICIT_PORTFOLIO_LIST", limit: 10 }, target, signal),
    "DPM wave endpoint unavailable.",
  );
  return {
    waves: result.value,
    wavesError: result.error,
    sourceAccessWithheld: result.accessWithheld,
  };
}

async function loadPortfolioMemory({
  portfolioId,
}: LoaderContext): Promise<Partial<ManageWorkspaceData>> {
  const [memory, search] = await Promise.all([
    readSource(
      () => getDpmPortfolioMemory({ portfolioId, limit: 100 }),
      "Portfolio-memory endpoint unavailable.",
    ),
    readSource(
      () => searchDpmPortfolioMemory({ portfolioIds: [portfolioId], limit: 10, sourceScanLimit: 250 }),
      "Portfolio-memory source-family search endpoint unavailable.",
    ),
  ]);
  return {
    portfolioMemory: memory.value,
    portfolioMemoryError: memory.error,
    portfolioMemorySearch: search.value,
    portfolioMemorySearchError: search.error,
  };
}

async function loadOutcomeReviews({
  portfolioId,
}: LoaderContext): Promise<Partial<ManageWorkspaceData>> {
  const result = await readSource(
    () => getDpmOutcomeReviews({ portfolioId, limit: 10 }),
    "Outcome review endpoint unavailable.",
  );
  return { outcomeReviews: result.value, outcomeReviewError: result.error };
}

async function loadOutcomeEvidence(
  context: LoaderContext,
): Promise<Partial<ManageWorkspaceData>> {
  const outcomeSlice = await loadOutcomeReviews(context);
  const proofPackId = readPreloadableDpmProofPackId(
    outcomeSlice.outcomeReviews?.data ?? null,
  );
  if (!proofPackId) {
    return outcomeSlice;
  }

  try {
    const proofPack = await getDpmProofPack(proofPackId, "server");
    return { ...outcomeSlice, proofPack, proofPackError: null };
  } catch (error) {
    return {
      ...outcomeSlice,
      proofPack: null,
      proofPackError: proofPackPreloadErrorMessage(error),
    };
  }
}

async function loadCampaignWorkflow(): Promise<Partial<ManageWorkspaceData>> {
  const [definitions, discovery, operatingQueue, approvalInbox, workflowBoard, assignmentPlan, automation] =
    await Promise.all([
      readSource(
        () => listDpmCampaignDefinitions({ campaignStatus: "ACTIVE", limit: 10 }),
        "DPM campaign-definition endpoint unavailable.",
      ),
      readSource(
        () => listDpmCampaignDiscovery({ campaignStatus: "ACTIVE", limit: 10 }),
        "DPM campaign-discovery endpoint unavailable.",
      ),
      readSource(
        () => listDpmCampaignOperatingQueue({ limit: 10 }),
        "DPM campaign operating-queue endpoint unavailable.",
      ),
      readSource(
        () => listDpmCampaignApprovalInbox({ limit: 10 }),
        "DPM campaign approval-inbox endpoint unavailable.",
      ),
      readSource(
        () => listDpmCampaignWorkflowBoard({ limit: 10 }),
        "DPM campaign workflow-board endpoint unavailable.",
      ),
      readSource(
        () => listDpmCampaignAssignmentPlan({ limit: 10 }),
        "DPM campaign assignment-plan endpoint unavailable.",
      ),
      readSource(
        () => listDpmCampaignWorkflowAutomation({ limit: 10 }),
        "DPM campaign workflow-automation endpoint unavailable.",
      ),
    ]);
  const campaign = readFirstDpmCampaignDefinition(definitions.value?.data ?? null);
  const details = campaign
    ? await loadCampaignWorkflowDetails(campaign)
    : emptyCampaignWorkflowDetails();

  return {
    campaignDefinitions: definitions.value,
    campaignDefinitionsError: definitions.error,
    campaignDiscovery: discovery.value,
    campaignDiscoveryError: discovery.error,
    campaignOperatingQueue: operatingQueue.value,
    campaignOperatingQueueError: operatingQueue.error,
    campaignApprovalInbox: approvalInbox.value,
    campaignApprovalInboxError: approvalInbox.error,
    campaignWorkflowBoard: workflowBoard.value,
    campaignWorkflowBoardError: workflowBoard.error,
    campaignAssignmentPlan: assignmentPlan.value,
    campaignAssignmentPlanError: assignmentPlan.error,
    campaignWorkflowAutomation: automation.value,
    campaignWorkflowAutomationError: automation.error,
    ...details,
  };
}

async function loadCampaignWorkflowDetails(campaign: {
  campaignId: string;
  campaignVersion: string;
}): Promise<Partial<ManageWorkspaceData>> {
  const [approvalDecisions, assignmentActions, assignmentTasks, makerCheckerControls] =
    await Promise.all([
      readSource(
        () => getDpmCampaignApprovalDecisions({ ...campaign, limit: 10 }),
        "DPM campaign approval-decision endpoint unavailable.",
      ),
      readSource(
        () => getDpmCampaignAssignmentActions({ ...campaign, limit: 10 }),
        "DPM campaign assignment-action endpoint unavailable.",
      ),
      readSource(
        () => getDpmCampaignAssignmentTasks({ ...campaign, limit: 10 }),
        "DPM campaign assignment-task endpoint unavailable.",
      ),
      readSource(
        () => getDpmCampaignMakerCheckerControls({ ...campaign, limit: 10 }),
        "DPM campaign maker-checker endpoint unavailable.",
      ),
    ]);
  return {
    campaignApprovalDecisions: approvalDecisions.value,
    campaignApprovalDecisionsError: approvalDecisions.error,
    campaignAssignmentActions: assignmentActions.value,
    campaignAssignmentActionsError: assignmentActions.error,
    campaignAssignmentTasks: assignmentTasks.value,
    campaignAssignmentTasksError: assignmentTasks.error,
    campaignMakerCheckerControls: makerCheckerControls.value,
    campaignMakerCheckerControlsError: makerCheckerControls.error,
  };
}

async function loadPmQualityScoreRuns(): Promise<Partial<ManageWorkspaceData>> {
  const result = await readSource(
    () => listDpmPmOperatingQualityScoreRuns({ limit: 10 }),
    "PM operating quality score-run endpoint unavailable.",
  );
  return {
    pmOperatingQualityScoreRuns: result.value,
    pmOperatingQualityScoreRunsError: result.error,
  };
}

async function loadPmQuality(): Promise<Partial<ManageWorkspaceData>> {
  const [policies, scoreRuns, fairnessAnalyses, reviewActions, summaryInvocations] =
    await Promise.all([
      readSource(
        () => listDpmPmOperatingQualityPolicies({ limit: 10 }),
        "PM operating quality policy endpoint unavailable.",
      ),
      readSource(
        () => listDpmPmOperatingQualityScoreRuns({ limit: 10 }),
        "PM operating quality score-run endpoint unavailable.",
      ),
      readSource(
        () => listDpmPmOperatingQualityFairnessAnalyses({ limit: 10 }),
        "PM operating quality fairness-analysis list endpoint unavailable.",
      ),
      readSource(
        () => listDpmPmOperatingQualityReviewActions({ limit: 10 }),
        "PM operating quality review-action list endpoint unavailable.",
      ),
      readSource(
        () => listDpmPmOperatingQualitySummaryInvocations({ limit: 10 }),
        "PM operating quality summary-invocation list endpoint unavailable.",
      ),
    ]);
  const [fairnessDetail, reviewActionDetail, summaryInvocationDetail] = await Promise.all([
    loadOptionalDetail(
      readDpmFairnessAnalysisId(fairnessAnalyses.value?.data ?? null),
      getDpmPmOperatingQualityFairnessAnalysis,
      "PM operating quality fairness-analysis detail endpoint unavailable.",
    ),
    loadOptionalDetail(
      readDpmReviewActionId(reviewActions.value?.data ?? null),
      getDpmPmOperatingQualityReviewAction,
      "PM operating quality review-action detail endpoint unavailable.",
    ),
    loadOptionalDetail(
      readDpmSummaryInvocationId(summaryInvocations.value?.data ?? null),
      getDpmPmOperatingQualitySummaryInvocation,
      "PM operating quality summary-invocation detail endpoint unavailable.",
    ),
  ]);

  return {
    pmOperatingQualityPolicies: policies.value,
    pmOperatingQualityPoliciesError: policies.error,
    pmOperatingQualityScoreRuns: scoreRuns.value,
    pmOperatingQualityScoreRunsError: scoreRuns.error,
    pmOperatingQualityFairnessAnalyses: fairnessAnalyses.value,
    pmOperatingQualityFairnessAnalysesError: fairnessAnalyses.error,
    pmOperatingQualityFairnessAnalysisDetail: fairnessDetail.value,
    pmOperatingQualityFairnessAnalysisDetailError: fairnessDetail.error,
    pmOperatingQualityReviewActions: reviewActions.value,
    pmOperatingQualityReviewActionsError: reviewActions.error,
    pmOperatingQualityReviewActionDetail: reviewActionDetail.value,
    pmOperatingQualityReviewActionDetailError: reviewActionDetail.error,
    pmOperatingQualitySummaryInvocations: summaryInvocations.value,
    pmOperatingQualitySummaryInvocationsError: summaryInvocations.error,
    pmOperatingQualitySummaryInvocationDetail: summaryInvocationDetail.value,
    pmOperatingQualitySummaryInvocationDetailError: summaryInvocationDetail.error,
  };
}

async function loadOptionalDetail<T>(
  id: string | null,
  load: (id: string) => Promise<T>,
  fallback: string,
): Promise<SourceResult<T>> {
  return id
    ? readSource(() => load(id), fallback)
    : { value: null, error: null, accessWithheld: false };
}

async function readSource<T>(
  load: () => Promise<T>,
  fallback: string,
): Promise<SourceResult<T>> {
  try {
    return { value: await load(), error: null, accessWithheld: false };
  } catch (error) {
    return {
      value: null,
      error: error instanceof Error ? error.message : fallback,
      accessWithheld: isWorkbenchPermissionBlockedError(error),
    };
  }
}

function readFirstDpmCampaignDefinition(
  data: Record<string, unknown> | null,
): { campaignId: string; campaignVersion: string } | null {
  if (!data) {
    return null;
  }
  const records = readDpmCampaignDefinitionRecords(data);
  for (const record of records) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      continue;
    }
    const campaignId = (record as Record<string, unknown>).campaign_id;
    const campaignVersion = (record as Record<string, unknown>).campaign_version;
    if (
      typeof campaignId === "string" &&
      campaignId.trim().length > 0 &&
      typeof campaignVersion === "string" &&
      campaignVersion.trim().length > 0
    ) {
      return { campaignId, campaignVersion };
    }
  }
  return null;
}

function emptyCampaignWorkflowDetails(): Partial<ManageWorkspaceData> {
  return {
    campaignApprovalDecisions: null,
    campaignApprovalDecisionsError: null,
    campaignAssignmentActions: null,
    campaignAssignmentActionsError: null,
    campaignAssignmentTasks: null,
    campaignAssignmentTasksError: null,
    campaignMakerCheckerControls: null,
    campaignMakerCheckerControlsError: null,
  };
}

function createEmptyManageWorkspaceData(portfolio: PortfolioResponse): ManageWorkspaceData {
  return {
    sourceAccessWithheld: false,
    portfolio,
    commandCenter: null,
    commandCenterError: null,
    commandCenterExceptions: null,
    commandCenterExceptionsError: null,
    mandate: null,
    mandateHealth: null,
    mandateHealthError: null,
    portfolioMemory: null,
    portfolioMemoryError: null,
    portfolioMemorySearch: null,
    portfolioMemorySearchError: null,
    pmOperatingQualityPolicies: null,
    pmOperatingQualityPoliciesError: null,
    pmOperatingQualityScoreRuns: null,
    pmOperatingQualityScoreRunsError: null,
    pmOperatingQualityFairnessAnalyses: null,
    pmOperatingQualityFairnessAnalysesError: null,
    pmOperatingQualityFairnessAnalysisDetail: null,
    pmOperatingQualityFairnessAnalysisDetailError: null,
    pmOperatingQualityReviewActions: null,
    pmOperatingQualityReviewActionsError: null,
    pmOperatingQualityReviewActionDetail: null,
    pmOperatingQualityReviewActionDetailError: null,
    pmOperatingQualitySummaryInvocations: null,
    pmOperatingQualitySummaryInvocationsError: null,
    pmOperatingQualitySummaryInvocationDetail: null,
    pmOperatingQualitySummaryInvocationDetailError: null,
    waves: null,
    wavesError: null,
    campaignDefinitions: null,
    campaignDefinitionsError: null,
    campaignDiscovery: null,
    campaignDiscoveryError: null,
    campaignOperatingQueue: null,
    campaignOperatingQueueError: null,
    campaignApprovalInbox: null,
    campaignApprovalInboxError: null,
    campaignWorkflowBoard: null,
    campaignWorkflowBoardError: null,
    campaignAssignmentPlan: null,
    campaignAssignmentPlanError: null,
    campaignWorkflowAutomation: null,
    campaignWorkflowAutomationError: null,
    campaignSourceReadId: crypto.randomUUID(),
    campaignApprovalDecisions: null,
    campaignApprovalDecisionsError: null,
    campaignAssignmentActions: null,
    campaignAssignmentActionsError: null,
    campaignAssignmentTasks: null,
    campaignAssignmentTasksError: null,
    campaignMakerCheckerControls: null,
    campaignMakerCheckerControlsError: null,
    outcomeReviews: null,
    outcomeReviewError: null,
    proofPack: null,
    proofPackError: null,
  };
}
