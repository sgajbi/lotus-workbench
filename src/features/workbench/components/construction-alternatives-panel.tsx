"use client";

import {
  SectionBlock,
  SemanticBadge,
} from "@/design-system";
import { useClientMounted } from "@/design-system/hooks/use-client-mounted";
import type {
  WorkbenchPortfolio360,
} from "@/features/workbench/types";
import ConstructionAlternativesComparisonCard from "@/features/workbench/components/construction-alternatives-comparison-card";
import ConstructionCommandSummaryCard from "@/features/workbench/components/construction-command-summary-card";
import ConstructionRecommendedActionsCard from "@/features/workbench/components/construction-recommended-actions-card";
import ConstructionSelectedDetailCard from "@/features/workbench/components/construction-selected-detail-card";
import ExecutionAcknowledgementSupportabilityPanel from "@/features/workbench/components/execution-acknowledgement-supportability-panel";
import {
  resolveConstructionEvidenceStatus,
} from "@/features/workbench/construction-alternatives-panel-helpers";

import { useConstructionAlternativesActions } from "@/features/workbench/use-construction-alternatives-actions";

type Props = {
  portfolio: WorkbenchPortfolio360;
};

export default function ConstructionAlternativesPanel({ portfolio }: Props) {
  const interactiveReady = useClientMounted();
  const {
    model,
    portfolioId,
    generatePending,
    selectionPendingId,
    actionMessage,
    actionError,
    executionAcknowledgementResponse,
    executionAcknowledgementLoading,
    executionAcknowledgementError,
    canSelectSelectedAlternative,
    generateAlternatives,
    selectAlternative,
  } = useConstructionAlternativesActions({ portfolio });
  const evidenceStatus = resolveConstructionEvidenceStatus({
    panelState: model.state,
    generatePending,
    actionError,
  });

  return (
    <SectionBlock
      title="Construction Alternatives"
      subtitle="Compare suitable implementation paths before advisor approval."
      className="construction-alternatives-panel"
      interactiveReady={interactiveReady}
      actions={
        <div className="construction-alternatives-badge-row">
          <SemanticBadge tone={evidenceStatus.tone}>
            {evidenceStatus.label}
          </SemanticBadge>
        </div>
      }
    >
      <ConstructionCommandSummaryCard
        model={model}
        portfolioId={portfolioId}
        generatePending={generatePending}
        actionMessage={actionMessage}
        actionError={actionError}
        onGenerateAlternatives={generateAlternatives}
      />

      <ExecutionAcknowledgementSupportabilityPanel
        response={executionAcknowledgementResponse}
        loading={executionAcknowledgementLoading}
        error={executionAcknowledgementError}
      />

      <div className="construction-alternatives-grid">
        <div className="construction-alternatives-primary">
          <ConstructionAlternativesComparisonCard
            model={model}
            selectionPendingId={selectionPendingId}
            onSelectAlternative={selectAlternative}
          />

          <ConstructionSelectedDetailCard
            model={model}
            selectionPendingId={selectionPendingId}
            canSelectSelectedAlternative={canSelectSelectedAlternative}
            onSelectAlternative={selectAlternative}
          />
        </div>

        <ConstructionRecommendedActionsCard
          model={model}
          portfolioId={portfolioId}
          selectionPendingId={selectionPendingId}
          onSelectRecommended={selectAlternative}
        />
      </div>
    </SectionBlock>
  );
}
