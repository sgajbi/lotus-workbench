"use client";

import { useMemo } from "react";
import {
  ActionButton,
  ScreenStatePanel,
  SectionBlock,
  SemanticBadge,
} from "@/design-system";
import { useClientMounted } from "@/design-system/hooks/use-client-mounted";
import DpmWaveActiveRebalanceSection from "@/features/workbench/components/dpm-wave-active-rebalance-section";
import DpmWaveDecisionSupport from "@/features/workbench/components/dpm-wave-decision-support";
import DpmCampaignDefinitionsSection from "@/features/workbench/components/dpm-campaign-definitions-section";
import DpmWaveProposedChangesSection from "@/features/workbench/components/dpm-wave-proposed-changes-section";
import DpmWaveReadinessSummaryStrip from "@/features/workbench/components/dpm-wave-readiness-summary-strip";
import DpmWaveRecommendedActionsSection from "@/features/workbench/components/dpm-wave-recommended-actions-section";
import type {
  DpmCampaignDefinitionGatewayResponse,
  DpmCampaignWorkflowGatewayResponse,
  DpmWaveGatewayResponse,
} from "@/features/workbench/types";
import {
  buildDpmWaveMetricTiles,
  buildDpmWaveProposedChangeRows,
  buildDpmWaveHeaderModel,
  dpmWaveStatePanelCopy,
  isDpmWaveActionBlocked,
  resolveCampaignWorkflowEvidenceError,
  resolveDpmWaveLifecycleIndex,
} from "@/features/workbench/dpm-wave-command-center-panel-helpers";
import { useDpmWaveCommandCenterActions } from "@/features/workbench/use-dpm-wave-command-center-actions";

type Props = {
  portfolioId: string;
  waveList: DpmWaveGatewayResponse | null;
  campaignDefinitions?: DpmCampaignDefinitionGatewayResponse | null;
  campaignDiscovery?: DpmCampaignDefinitionGatewayResponse | null;
  campaignOperatingQueue?: DpmCampaignWorkflowGatewayResponse | null;
  campaignApprovalInbox?: DpmCampaignWorkflowGatewayResponse | null;
  campaignWorkflowBoard?: DpmCampaignWorkflowGatewayResponse | null;
  campaignAssignmentPlan?: DpmCampaignWorkflowGatewayResponse | null;
  campaignWorkflowAutomation?: DpmCampaignWorkflowGatewayResponse | null;
  campaignSourceReadId: string;
  campaignApprovalDecisions?: DpmCampaignWorkflowGatewayResponse | null;
  campaignAssignmentActions?: DpmCampaignWorkflowGatewayResponse | null;
  campaignAssignmentTasks?: DpmCampaignWorkflowGatewayResponse | null;
  campaignMakerCheckerControls?: DpmCampaignWorkflowGatewayResponse | null;
  campaignDefinitionsError?: string | null;
  campaignDiscoveryError?: string | null;
  campaignWorkflowSummaryError?: string | null;
  campaignWorkflowError?: string | null;
  errorMessage?: string | null;
  mandateType?: string | null;
  portfolioCurrency?: string | null;
};

export default function DpmWaveCommandCenterPanel({
  portfolioId,
  waveList,
  campaignDefinitions = null,
  campaignDiscovery = null,
  campaignOperatingQueue = null,
  campaignApprovalInbox = null,
  campaignWorkflowBoard = null,
  campaignAssignmentPlan = null,
  campaignWorkflowAutomation = null,
  campaignSourceReadId,
  campaignApprovalDecisions = null,
  campaignAssignmentActions = null,
  campaignAssignmentTasks = null,
  campaignMakerCheckerControls = null,
  campaignDefinitionsError = null,
  campaignDiscoveryError = null,
  campaignWorkflowSummaryError = null,
  campaignWorkflowError = null,
  errorMessage = null,
  mandateType = null,
  portfolioCurrency = null,
}: Props) {
  const interactiveReady = useClientMounted();
  const {
    model,
    selectedCampaign,
    selectedCampaignKey,
    pendingAction,
    pendingCampaignLifecycleKey,
    pendingCampaignLaunchHistoryKey,
    pendingCampaignPreviewReadinessKey,
    pendingCampaignLaunchPackageKey,
    pendingCampaignLaunchKey,
    pendingCampaignWorkflowEvidenceKey,
    pendingCampaignLifecycleCommand,
    pendingCampaignWorkflowCommand,
    pendingCampaignCommand,
    actionError,
    sourceConfirmationRetryAvailable,
    campaignLifecycleError,
    campaignLaunchHistoryError,
    campaignPreviewReadinessError,
    campaignLaunchError,
    campaignLifecycleCommandError,
    campaignWorkflowCommandError,
    campaignWorkflowEvidenceError,
    campaignWorkflowEvidenceResolved,
    campaignLifecycleCommandEvidence,
    campaignWorkflowCommandEvidence,
    actionMessage,
    aiWorkflowOutcome,
    previewRebalance,
    createRebalance,
    loadProposedChanges,
    reviewDataReadiness,
    runSimulation,
    requestApproval,
    stageRebalance,
    prepareHandoff,
    openEvidencePack,
    requestWaveMemo,
    requestOperationsBrief,
    retrySourceConfirmation,
    selectCampaign,
    loadCampaignLifecycle,
    loadCampaignLaunchHistory,
    checkCampaignLaunchReadiness,
    launchCampaign,
    loadCampaignWorkflowEvidence,
    recordCampaignLifecycleCommand,
    recordCampaignWorkflowCommand,
  } = useDpmWaveCommandCenterActions({
    portfolioId,
    waveList,
    campaignDefinitions,
    campaignDiscovery,
    campaignOperatingQueue,
    campaignApprovalInbox,
    campaignWorkflowBoard,
    campaignAssignmentPlan,
    campaignWorkflowAutomation,
    campaignSourceReadId,
    campaignApprovalDecisions,
    campaignAssignmentActions,
    campaignAssignmentTasks,
    campaignMakerCheckerControls,
  });
  const selectedWaveId = model.selectedWaveId;
  const lifecycleIndex = resolveDpmWaveLifecycleIndex(model.selectedWaveState);
  const approvalBlocked =
    isDpmWaveActionBlocked(model.blockedActions, "approve") ||
    Number.parseInt(model.selectedWaveIssueCount.replaceAll(",", ""), 10) > 0 ||
    model.reasonCodes.length > 0 ||
    model.state === "blocked" ||
    model.state === "partial";
  const stagingBlocked = isDpmWaveActionBlocked(model.blockedActions, "stage");
  const handoffBlocked = isDpmWaveActionBlocked(model.blockedActions, "handoff");
  const stateCopy = dpmWaveStatePanelCopy(model.state, portfolioId);
  const shouldShowStatePanel =
    Boolean(errorMessage) ||
    Boolean(actionError) ||
    model.state === "empty" ||
    model.state === "partial" ||
    model.state === "blocked" ||
    model.state === "unavailable";
  const proposedRows = useMemo(() => buildDpmWaveProposedChangeRows(model.itemRows), [model.itemRows]);
  const metricTiles = buildDpmWaveMetricTiles(
    model.metricRows,
    model.selectedWaveItemCount,
    model.selectedWaveIssueCount
  );
  const header = buildDpmWaveHeaderModel({
    mandateType,
    portfolioCurrency,
    asOfDate: model.selectedWaveAsOfDate,
    proofState: model.proofPackStatus,
  });

  return (
    <SectionBlock
      id="rebalance-workspace"
      title="Rebalance"
      subtitle="Proposed rebalance, advisor review, and approval readiness."
      className="rebalance-workspace"
      interactiveReady={interactiveReady}
      actions={
        <div className="rebalance-context-row" aria-label="Rebalance source context">
          <span>{header.mandateLabel}</span>
          <span>{header.currencyLabel}</span>
          <span>{header.asOfLabel}</span>
          <SemanticBadge tone={header.proof.tone}>{header.proof.label}</SemanticBadge>
        </div>
      }
    >
      {shouldShowStatePanel ? (
        <ScreenStatePanel
          kind={errorMessage || actionError ? "partial" : stateCopy.kind}
          surface="portfolio"
          title={errorMessage || actionError ? "Rebalance data needs attention" : stateCopy.title}
          body={errorMessage ?? actionError ?? stateCopy.body}
          action={
            sourceConfirmationRetryAvailable ? (
              <ActionButton onClick={retrySourceConfirmation}>
                Retry source confirmation
              </ActionButton>
            ) : undefined
          }
        />
      ) : null}

      <DpmWaveReadinessSummaryStrip
        selectedWaveState={model.selectedWaveState}
        approvalBlocked={approvalBlocked}
        selectedWaveItemCount={model.selectedWaveItemCount}
        metricRows={model.metricRows}
      />

      <div className="rebalance-main-grid">
        <DpmWaveActiveRebalanceSection
          selectedWaveId={selectedWaveId}
          selectedWaveState={model.selectedWaveState}
          lifecycleIndex={lifecycleIndex}
          approvalBlocked={approvalBlocked}
          stagingBlocked={stagingBlocked}
          handoffBlocked={handoffBlocked}
          metricTiles={metricTiles}
          pendingAction={pendingAction}
          actionMessage={actionMessage}
          onPreview={previewRebalance}
          onCreate={createRebalance}
          onReviewData={reviewDataReadiness}
          onSimulate={runSimulation}
          onRequestApproval={requestApproval}
          onStage={stageRebalance}
          onPrepareHandoff={prepareHandoff}
          onOpenEvidencePack={openEvidencePack}
        />

        <DpmWaveRecommendedActionsSection approvalBlocked={approvalBlocked} />
      </div>

      <DpmWaveProposedChangesSection
        rows={proposedRows}
        selectedWaveId={selectedWaveId}
        pendingAction={pendingAction}
        onLoadProposedChanges={loadProposedChanges}
      />

      <DpmWaveDecisionSupport
        waveId={selectedWaveId}
        memoStatus={model.aiMemoStatus}
        operationsStatus={model.operationsHandoffSummaryStatus}
        pendingAction={pendingAction}
        outcome={aiWorkflowOutcome}
        onRequestMemo={requestWaveMemo}
        onRequestOperationsBrief={requestOperationsBrief}
      />

      <DpmCampaignDefinitionsSection
        rows={model.campaignRows}
        lifecycleRows={model.campaignLifecycleRows}
        launchHistoryRows={model.campaignLaunchHistoryRows}
        launchHistoryPage={model.campaignLaunchHistoryPage}
        previewReadinessPosture={model.campaignPreviewReadinessPosture}
        launchPosture={model.campaignLaunchPosture}
        workflowSummaryRows={model.campaignWorkflowSummaryRows}
        workflowSummaryError={campaignWorkflowSummaryError}
        workflowEvidenceRows={model.campaignWorkflowEvidenceRows}
        lifecycleError={campaignLifecycleError}
        launchHistoryError={campaignLaunchHistoryError}
        previewReadinessError={campaignPreviewReadinessError}
        launchError={campaignLaunchError}
        workflowError={resolveCampaignWorkflowEvidenceError({
          initialError: campaignWorkflowError,
          refreshError: campaignWorkflowEvidenceError,
          refreshResolved: campaignWorkflowEvidenceResolved,
        })}
        pendingLifecycleKey={pendingCampaignLifecycleKey}
        pendingLaunchHistoryKey={pendingCampaignLaunchHistoryKey}
        pendingPreviewReadinessKey={pendingCampaignPreviewReadinessKey}
        pendingLaunchPackageKey={pendingCampaignLaunchPackageKey}
        pendingLaunchKey={pendingCampaignLaunchKey}
        pendingWorkflowEvidenceKey={pendingCampaignWorkflowEvidenceKey}
        pendingLifecycleCommand={pendingCampaignLifecycleCommand}
        pendingWorkflowCommand={pendingCampaignWorkflowCommand}
        commandPending={pendingCampaignCommand}
        lifecycleCommandError={campaignLifecycleCommandError}
        lifecycleCommandEvidence={campaignLifecycleCommandEvidence}
        workflowCommandError={campaignWorkflowCommandError}
        workflowCommandEvidence={campaignWorkflowCommandEvidence}
        selectedCampaign={selectedCampaign}
        selectedCampaignKey={selectedCampaignKey}
        errorMessage={campaignDefinitionsError ?? campaignDiscoveryError}
        onSelectCampaign={selectCampaign}
        onLoadLifecycle={loadCampaignLifecycle}
        onLoadLaunchHistory={loadCampaignLaunchHistory}
        onCheckLaunchReadiness={checkCampaignLaunchReadiness}
        onLoadWorkflowEvidence={loadCampaignWorkflowEvidence}
        onLaunchCampaign={launchCampaign}
        onRecordLifecycleCommand={recordCampaignLifecycleCommand}
        onRecordWorkflowCommand={recordCampaignWorkflowCommand}
      />
    </SectionBlock>
  );
}
