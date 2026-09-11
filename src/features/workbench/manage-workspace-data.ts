import {
  getDpmCommandCenter,
  getDpmCommandCenterExceptions,
  getDpmCampaignApprovalDecisions,
  getDpmCampaignAssignmentActions,
  getDpmCampaignAssignmentTasks,
  getDpmCampaignMakerCheckerControls,
  getDpmMandateByPortfolio,
  getDpmMandateHealth,
  getDpmOutcomeReviews,
  getDpmPmOperatingQualityFairnessAnalysis,
  getDpmPmOperatingQualityReviewAction,
  getDpmPmOperatingQualitySummaryInvocation,
  getDpmPortfolioMemory,
  getDpmProofPack,
  getWorkbenchApiErrorStatus,
  listDpmCampaignDefinitions,
  listDpmCampaignDiscovery,
  listDpmCampaignApprovalInbox,
  listDpmCampaignAssignmentPlan,
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
import { getPortfolio360 } from "@/features/workbench/workbench-core-api";

export type ManageWorkspaceData = {
  sourceAccessWithheld?: boolean;
  portfolio: Awaited<ReturnType<typeof getPortfolio360>>;
  commandCenter: Awaited<ReturnType<typeof getDpmCommandCenter>> | null;
  commandCenterExceptions: Awaited<ReturnType<typeof getDpmCommandCenterExceptions>> | null;
  commandCenterExceptionsError: string | null;
  mandate: Awaited<ReturnType<typeof getDpmMandateByPortfolio>> | null;
  mandateHealth: Awaited<ReturnType<typeof getDpmMandateHealth>> | null;
  mandateHealthError: string | null;
  commandCenterError: string | null;
  portfolioMemory: Awaited<ReturnType<typeof getDpmPortfolioMemory>> | null;
  portfolioMemorySearch: Awaited<ReturnType<typeof searchDpmPortfolioMemory>> | null;
  portfolioMemoryError: string | null;
  portfolioMemorySearchError: string | null;
  pmOperatingQualityPolicies: Awaited<ReturnType<typeof listDpmPmOperatingQualityPolicies>> | null;
  pmOperatingQualityPoliciesError: string | null;
  pmOperatingQualityScoreRuns: Awaited<ReturnType<typeof listDpmPmOperatingQualityScoreRuns>> | null;
  pmOperatingQualityScoreRunsError: string | null;
  pmOperatingQualityFairnessAnalyses: Awaited<
    ReturnType<typeof listDpmPmOperatingQualityFairnessAnalyses>
  > | null;
  pmOperatingQualityFairnessAnalysesError: string | null;
  pmOperatingQualityFairnessAnalysisDetail: Awaited<
    ReturnType<typeof getDpmPmOperatingQualityFairnessAnalysis>
  > | null;
  pmOperatingQualityFairnessAnalysisDetailError: string | null;
  pmOperatingQualityReviewActions: Awaited<
    ReturnType<typeof listDpmPmOperatingQualityReviewActions>
  > | null;
  pmOperatingQualityReviewActionDetail: Awaited<
    ReturnType<typeof getDpmPmOperatingQualityReviewAction>
  > | null;
  pmOperatingQualityReviewActionsError: string | null;
  pmOperatingQualityReviewActionDetailError: string | null;
  pmOperatingQualitySummaryInvocations: Awaited<
    ReturnType<typeof listDpmPmOperatingQualitySummaryInvocations>
  > | null;
  pmOperatingQualitySummaryInvocationDetail: Awaited<
    ReturnType<typeof getDpmPmOperatingQualitySummaryInvocation>
  > | null;
  pmOperatingQualitySummaryInvocationsError: string | null;
  pmOperatingQualitySummaryInvocationDetailError: string | null;
  waves: Awaited<ReturnType<typeof listDpmWaves>> | null;
  wavesError: string | null;
  campaignDefinitions: Awaited<ReturnType<typeof listDpmCampaignDefinitions>> | null;
  campaignDefinitionsError: string | null;
  campaignDiscovery: Awaited<ReturnType<typeof listDpmCampaignDiscovery>> | null;
  campaignDiscoveryError: string | null;
  campaignOperatingQueue: Awaited<ReturnType<typeof listDpmCampaignOperatingQueue>> | null;
  campaignOperatingQueueError: string | null;
  campaignApprovalInbox: Awaited<ReturnType<typeof listDpmCampaignApprovalInbox>> | null;
  campaignApprovalInboxError: string | null;
  campaignWorkflowBoard: Awaited<ReturnType<typeof listDpmCampaignWorkflowBoard>> | null;
  campaignWorkflowBoardError: string | null;
  campaignAssignmentPlan: Awaited<ReturnType<typeof listDpmCampaignAssignmentPlan>> | null;
  campaignAssignmentPlanError: string | null;
  campaignWorkflowAutomation: Awaited<ReturnType<typeof listDpmCampaignWorkflowAutomation>> | null;
  campaignWorkflowAutomationError: string | null;
  campaignSourceReadId: string;
  campaignApprovalDecisions: Awaited<ReturnType<typeof getDpmCampaignApprovalDecisions>> | null;
  campaignApprovalDecisionsError: string | null;
  campaignAssignmentActions: Awaited<ReturnType<typeof getDpmCampaignAssignmentActions>> | null;
  campaignAssignmentActionsError: string | null;
  campaignAssignmentTasks: Awaited<ReturnType<typeof getDpmCampaignAssignmentTasks>> | null;
  campaignAssignmentTasksError: string | null;
  campaignMakerCheckerControls: Awaited<ReturnType<typeof getDpmCampaignMakerCheckerControls>> | null;
  campaignMakerCheckerControlsError: string | null;
  outcomeReviews: Awaited<ReturnType<typeof getDpmOutcomeReviews>> | null;
  outcomeReviewError: string | null;
  proofPack: Awaited<ReturnType<typeof getDpmProofPack>> | null;
  proofPackError: string | null;
};

export function readDpmSummaryInvocationId(data: Record<string, unknown> | null): string | null {
  if (!data) {
    return null;
  }
  if (
    typeof data.summary_invocation_id === "string" &&
    data.summary_invocation_id.trim().length > 0
  ) {
    return data.summary_invocation_id;
  }
  const summaryInvocation = data.summary_invocation;
  if (
    summaryInvocation &&
    typeof summaryInvocation === "object" &&
    !Array.isArray(summaryInvocation)
  ) {
    const summaryInvocationId = (summaryInvocation as Record<string, unknown>)
      .summary_invocation_id;
    if (typeof summaryInvocationId === "string" && summaryInvocationId.trim().length > 0) {
      return summaryInvocationId;
    }
  }
  const items = Array.isArray(data.summary_invocations)
    ? data.summary_invocations
    : Array.isArray(data.items)
      ? data.items
      : [];
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const summaryInvocationId = (item as Record<string, unknown>).summary_invocation_id;
    if (typeof summaryInvocationId === "string" && summaryInvocationId.trim().length > 0) {
      return summaryInvocationId;
    }
  }
  return null;
}

export function readPreloadableDpmProofPackId(data: Record<string, unknown> | null): string | null {
  if (!data) {
    return null;
  }
  if (typeof data.proof_pack_id === "string" && data.proof_pack_id.trim().length > 0) {
    return data.proof_pack_id;
  }
  return null;
}

export function proofPackPreloadErrorMessage(error: unknown): string | null {
  const status = getWorkbenchApiErrorStatus(error);
  if (status === 404) {
    return null;
  }
  return "Evidence pack preload is temporarily unavailable. Prepare evidence to generate the current review pack.";
}

export function readDpmReviewActionId(data: Record<string, unknown> | null): string | null {
  if (!data) {
    return null;
  }
  if (typeof data.review_action_id === "string" && data.review_action_id.trim().length > 0) {
    return data.review_action_id;
  }
  const reviewAction = data.review_action;
  if (reviewAction && typeof reviewAction === "object" && !Array.isArray(reviewAction)) {
    const reviewActionId = (reviewAction as Record<string, unknown>).review_action_id;
    if (typeof reviewActionId === "string" && reviewActionId.trim().length > 0) {
      return reviewActionId;
    }
  }
  const items = Array.isArray(data.review_actions)
    ? data.review_actions
    : Array.isArray(data.items)
      ? data.items
      : [];
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const reviewActionId = (item as Record<string, unknown>).review_action_id;
    if (typeof reviewActionId === "string" && reviewActionId.trim().length > 0) {
      return reviewActionId;
    }
  }
  return null;
}

export function readDpmMandateId(data: Record<string, unknown> | null): string | null {
  if (!data) {
    return null;
  }
  if (typeof data.mandate_id === "string" && data.mandate_id.trim().length > 0) {
    return data.mandate_id;
  }
  const mandate = data.mandate;
  if (mandate && typeof mandate === "object" && !Array.isArray(mandate)) {
    const mandateId = (mandate as Record<string, unknown>).mandate_id;
    return typeof mandateId === "string" && mandateId.trim().length > 0 ? mandateId : null;
  }
  return null;
}

export function readDpmProofPackId(data: Record<string, unknown> | null): string | null {
  if (!data) {
    return null;
  }
  if (typeof data.proof_pack_id === "string" && data.proof_pack_id.trim().length > 0) {
    return data.proof_pack_id;
  }
  const items = Array.isArray(data.items) ? data.items : [];
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const proofPackId = (item as Record<string, unknown>).proof_pack_id;
    if (typeof proofPackId === "string" && proofPackId.trim().length > 0) {
      return proofPackId;
    }
  }
  return null;
}

export function readDpmFairnessAnalysisId(data: Record<string, unknown> | null): string | null {
  if (!data) {
    return null;
  }
  if (
    typeof data.fairness_analysis_id === "string" &&
    data.fairness_analysis_id.trim().length > 0
  ) {
    return data.fairness_analysis_id;
  }
  const fairnessAnalysis = data.fairness_analysis;
  if (
    fairnessAnalysis &&
    typeof fairnessAnalysis === "object" &&
    !Array.isArray(fairnessAnalysis)
  ) {
    const fairnessAnalysisId = (fairnessAnalysis as Record<string, unknown>).fairness_analysis_id;
    if (typeof fairnessAnalysisId === "string" && fairnessAnalysisId.trim().length > 0) {
      return fairnessAnalysisId;
    }
  }
  const items = Array.isArray(data.fairness_analyses)
    ? data.fairness_analyses
    : Array.isArray(data.items)
      ? data.items
      : [];
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const fairnessAnalysisId = (item as Record<string, unknown>).fairness_analysis_id;
    if (typeof fairnessAnalysisId === "string" && fairnessAnalysisId.trim().length > 0) {
      return fairnessAnalysisId;
    }
  }
  return null;
}
