"use client";

import {
  ActionLink,
  SemanticBadge,
  Text,
  WorkbenchRailCard,
} from "@/design-system";

import {
  buildPortfolioRecordEvidenceRailViewModel,
  type PortfolioRecordCashflowProjection,
  type PortfolioRecordSourcePosture,
} from "../portfolio-record-evidence-view-model";
import type { PortfolioRecordScreenKind } from "../portfolio-record-screen-view-model";
import type { PortfolioWorkspace } from "../types";

export default function PortfolioRecordEvidenceRail({
  screen,
  workspace,
  cashflowProjection,
}: {
  screen: PortfolioRecordScreenKind;
  workspace: PortfolioWorkspace;
  cashflowProjection?: PortfolioRecordCashflowProjection;
}) {
  const viewModel = buildPortfolioRecordEvidenceRailViewModel({
    screen,
    workspace,
    cashflowProjection,
  });

  return (
    <div
      className="portfolio-record-evidence-rail"
      aria-label="Portfolio record data governance"
    >
      <WorkbenchRailCard className="portfolio-record-evidence-card">
        <div className="portfolio-record-evidence-header">
          <div>
            <Text variant="dataLabel">Review Evidence</Text>
            <Text variant="cardTitle">Data Readiness</Text>
          </div>
          <SemanticBadge tone={viewModel.status.tone}>
            {viewModel.status.label}
          </SemanticBadge>
        </div>
        <div className="portfolio-record-evidence-context">
          {viewModel.facts.map((fact) => (
            <EvidenceFact
              key={fact.label}
              label={fact.label}
              value={fact.value}
            />
          ))}
        </div>
      </WorkbenchRailCard>

      <WorkbenchRailCard className="portfolio-record-evidence-card">
        <Text variant="dataLabel">Source Coverage</Text>
        <div className="portfolio-record-source-list">
          {viewModel.sourcePostureItems.map((item) => (
            <SourcePosture key={item.label} {...item} />
          ))}
        </div>
      </WorkbenchRailCard>

      <WorkbenchRailCard className="portfolio-record-evidence-card">
        <Text variant="dataLabel">Adjacent Workflows</Text>
        <div className="portfolio-record-evidence-actions">
          {viewModel.adjacentWorkflows.map((workflow) => (
            <ActionLink key={workflow.href} href={workflow.href}>
              {workflow.label}
            </ActionLink>
          ))}
        </div>
      </WorkbenchRailCard>
    </div>
  );
}

function EvidenceFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="portfolio-record-evidence-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SourcePosture({
  label,
  source,
  detail,
  status,
  tone,
}: PortfolioRecordSourcePosture) {
  return (
    <div className="portfolio-record-source-item">
      <div className="portfolio-record-source-copy">
        <span>{label}</span>
        <strong>{source}</strong>
        <p>{detail}</p>
      </div>
      <SemanticBadge tone={tone}>{status}</SemanticBadge>
    </div>
  );
}
