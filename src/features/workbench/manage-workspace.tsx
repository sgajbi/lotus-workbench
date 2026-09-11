import type { ReactNode } from "react";

import type { PortfolioReviewContext } from "@/apps/portfolio/portfolio-screen-navigation";
import ConstructionAlternativesPanel from "@/features/workbench/components/construction-alternatives-panel";
import ManageMandateHealth from "@/features/workbench/components/manage-mandate-health";
import { readStringFromResponse } from "@/features/workbench/manage-workspace-view-model";
import DpmWaveCommandCenterPanel from "@/features/workbench/components/dpm-wave-command-center-panel";
import DpmCopilotWorkspace from "@/features/workbench/components/dpm-copilot-workspace";
import OutcomeReviewPanel from "@/features/workbench/components/outcome-review-panel";
import PortfolioMemoryPanel from "@/features/workbench/components/portfolio-memory-panel";
import PmOperatingQualityPanel from "@/features/workbench/components/pm-operating-quality-panel";
import ProofPackPanel from "@/features/workbench/components/proof-pack-panel";
import ManageOverviewWorkspace from "@/features/workbench/manage-overview-workspace";
import type { ManageMode } from "@/features/workbench/manage-workspace-navigation";
import {
  readDpmMandateId,
  type ManageWorkspaceData,
} from "@/features/workbench/manage-workspace-data";
import ManageWorkspaceShell from "@/features/workbench/manage-workspace-shell";

export { ManageWorkspaceUnavailable } from "./manage-workspace-unavailable";

export function ManageWorkspace({
  data,
  mode,
  reviewContext,
  sessionId,
}: {
  data: ManageWorkspaceData;
  mode: ManageMode;
  reviewContext: PortfolioReviewContext;
  sessionId?: string;
}) {
  if (mode === "overview") {
    return (
      <ManageOverviewWorkspace
        initialData={data}
        reviewContext={reviewContext}
        sessionId={sessionId}
      />
    );
  }

  const dpmMandateId = readDpmMandateId(data.mandate?.data ?? null);

  return (
    <ManageWorkspaceShell
      data={data}
      mode={mode}
      reviewContext={reviewContext}
    >
      {renderManageMode(mode, data, dpmMandateId)}
    </ManageWorkspaceShell>
  );
}

function renderManageMode(
  mode: ManageMode,
  data: ManageWorkspaceData,
  mandateId: string | null,
): ReactNode {
  switch (mode) {
    case "mandate":
      return <ManageMandateHealth data={data} />;
    case "waves":
      return (
        <>
          <DpmWaveCommandCenterPanel
            portfolioId={data.portfolio.portfolio.portfolio_id}
            mandateType={
              readStringFromResponse(data.mandate, "mandate_type") ??
              readStringFromResponse(data.mandate, "type")
            }
            portfolioCurrency={data.portfolio.portfolio.base_currency}
            waveList={data.waves}
            campaignDefinitions={data.campaignDefinitions}
            campaignDiscovery={data.campaignDiscovery}
            campaignOperatingQueue={data.campaignOperatingQueue}
            campaignApprovalInbox={data.campaignApprovalInbox}
            campaignWorkflowBoard={data.campaignWorkflowBoard}
            campaignAssignmentPlan={data.campaignAssignmentPlan}
            campaignWorkflowAutomation={data.campaignWorkflowAutomation}
            campaignSourceReadId={data.campaignSourceReadId}
            campaignApprovalDecisions={data.campaignApprovalDecisions}
            campaignAssignmentActions={data.campaignAssignmentActions}
            campaignAssignmentTasks={data.campaignAssignmentTasks}
            campaignMakerCheckerControls={data.campaignMakerCheckerControls}
            campaignDefinitionsError={data.campaignDefinitionsError}
            campaignDiscoveryError={data.campaignDiscoveryError}
            campaignWorkflowSummaryError={
              data.campaignOperatingQueueError ??
              data.campaignApprovalInboxError ??
              data.campaignWorkflowBoardError ??
              data.campaignAssignmentPlanError ??
              data.campaignWorkflowAutomationError
            }
            campaignWorkflowError={
              data.campaignApprovalDecisionsError ??
              data.campaignAssignmentActionsError ??
              data.campaignAssignmentTasksError ??
              data.campaignMakerCheckerControlsError
            }
            errorMessage={data.wavesError}
          />
          <ProofPackPanel
            showEmbeddedHeading
            portfolioId={data.portfolio.portfolio.portfolio_id}
            mandateId={mandateId}
            outcomeReviews={data.outcomeReviews}
            rebalanceSnapshot={data.portfolio.rebalance_snapshot}
            initialProofPack={data.proofPack}
            errorMessage={data.proofPackError}
          />
        </>
      );
    case "construction":
      return <ConstructionAlternativesPanel portfolio={data.portfolio} />;
    case "memory":
      return (
        <PortfolioMemoryPanel
          response={data.portfolioMemory}
          searchResponse={data.portfolioMemorySearch}
          errorMessage={data.portfolioMemoryError}
          sourceSearchErrorMessage={data.portfolioMemorySearchError}
        />
      );
    case "copilot":
      return <DpmCopilotWorkspace data={data} mandateId={mandateId} />;
    case "quality":
      return (
        <PmOperatingQualityPanel
          policies={data.pmOperatingQualityPolicies}
          scoreRuns={data.pmOperatingQualityScoreRuns}
          fairnessAnalyses={data.pmOperatingQualityFairnessAnalyses}
          fairnessAnalysisDetail={data.pmOperatingQualityFairnessAnalysisDetail}
          reviewActions={data.pmOperatingQualityReviewActions}
          reviewActionDetail={data.pmOperatingQualityReviewActionDetail}
          summaryInvocations={data.pmOperatingQualitySummaryInvocations}
          summaryInvocationDetail={data.pmOperatingQualitySummaryInvocationDetail}
          policiesError={data.pmOperatingQualityPoliciesError}
          scoreRunsError={data.pmOperatingQualityScoreRunsError}
          fairnessAnalysesError={data.pmOperatingQualityFairnessAnalysesError}
          fairnessAnalysisDetailError={data.pmOperatingQualityFairnessAnalysisDetailError}
          reviewActionsError={data.pmOperatingQualityReviewActionsError}
          reviewActionDetailError={data.pmOperatingQualityReviewActionDetailError}
          summaryInvocationsError={data.pmOperatingQualitySummaryInvocationsError}
          summaryInvocationDetailError={data.pmOperatingQualitySummaryInvocationDetailError}
        />
      );
    case "reviews":
      return (
        <OutcomeReviewPanel
          portfolioId={data.portfolio.portfolio.portfolio_id}
          response={data.outcomeReviews}
          errorMessage={data.outcomeReviewError}
        />
      );
    case "proof":
      return (
        <ProofPackPanel
          portfolioId={data.portfolio.portfolio.portfolio_id}
          mandateId={mandateId}
          outcomeReviews={data.outcomeReviews}
          rebalanceSnapshot={data.portfolio.rebalance_snapshot}
          initialProofPack={data.proofPack}
          errorMessage={data.proofPackError}
        />
      );
    case "overview":
    default:
      return null;
  }
}
