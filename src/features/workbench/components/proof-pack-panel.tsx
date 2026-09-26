"use client";

import { SectionBlock } from "@/design-system";
import { useClientMounted } from "@/design-system/hooks/use-client-mounted";
import DpmAiWorkflowResult from "@/features/workbench/components/dpm-ai-workflow-result";
import ProofPackSummary from "@/features/workbench/components/proof-pack-summary";
import ProofPackWorkspace from "@/features/workbench/components/proof-pack-workspace";
import type {
  DpmOutcomeReviewGatewayResponse,
  DpmProofPackGatewayResponse,
  WorkbenchOverview,
} from "@/features/workbench/types";
import { deriveProofPackContext } from "@/features/workbench/proof-pack-view-model";
import { useProofPackActions } from "@/features/workbench/use-proof-pack-actions";
import { useManageProofPackState } from "@/features/workbench/manage-proof-pack-state";
import styles from "./proof-pack.module.css";

type Props = {
  showEmbeddedHeading?: boolean;
  portfolioId: string;
  mandateId?: string | null;
  outcomeReviews: DpmOutcomeReviewGatewayResponse | null;
  rebalanceSnapshot?: WorkbenchOverview["rebalance_snapshot"] | null;
  initialProofPack: DpmProofPackGatewayResponse | null;
  errorMessage?: string | null;
};

export default function ProofPackPanel({
  showEmbeddedHeading = false,
  portfolioId,
  mandateId,
  outcomeReviews,
  rebalanceSnapshot,
  initialProofPack,
  errorMessage,
}: Props) {
  const interactiveReady = useClientMounted();
  const sharedProofPack = useManageProofPackState();
  const resolvedErrorMessage = sharedProofPack?.proofPack ? null : errorMessage;
  const context = deriveProofPackContext(outcomeReviews, rebalanceSnapshot ?? null);
  const {
    model,
    proofPackId,
    rebalanceRunId,
    pendingAction,
    actionError,
    handoffStatus,
    aiMemoOutcome,
    markdown,
    generateProofPack,
    loadProofPack,
    loadMarkdown,
    loadReportInput,
    requestAiPmMemo,
  } = useProofPackActions({
    initialProofPack: sharedProofPack?.proofPack ?? initialProofPack,
    contextProofPackId: context.proofPackId,
    contextRebalanceRunId: context.rebalanceRunId,
    contextMandateId: context.mandateId,
    mandateId,
    onProofPackChange: sharedProofPack?.publishProofPack,
  });

  return (
    <SectionBlock
      id="evidence-pack-panel"
      className={styles.panel}
      interactiveReady={interactiveReady}
    >
      {showEmbeddedHeading ? (
        <h2 className={styles.embeddedHeading}>Evidence Pack</h2>
      ) : null}
      <ProofPackSummary
        model={model}
        portfolioId={portfolioId}
        proofPackId={proofPackId}
        rebalanceRunId={rebalanceRunId}
        pendingAction={pendingAction}
        actionError={actionError}
        handoffStatus={handoffStatus}
        errorMessage={resolvedErrorMessage}
        onGenerateProofPack={generateProofPack}
        onLoadProofPack={loadProofPack}
      />

      {aiMemoOutcome ? (
        <DpmAiWorkflowResult
          outcome={aiMemoOutcome}
          ariaLabel="Evidence-pack decision memo result"
          eyebrow="Portfolio decision support"
          focusOnMount
        />
      ) : null}

      {model.state !== "unavailable" ? (
        <ProofPackWorkspace
          model={model}
          portfolioId={portfolioId}
          proofPackId={proofPackId}
          pendingAction={pendingAction}
          onRequestAiPmMemo={requestAiPmMemo}
          onLoadReportInput={loadReportInput}
          onLoadMarkdown={loadMarkdown}
        />
      ) : null}

      {markdown ? (
        <pre className={styles.markdownPreview} aria-label="Evidence pack summary preview">
          {markdown}
        </pre>
      ) : null}
    </SectionBlock>
  );
}
