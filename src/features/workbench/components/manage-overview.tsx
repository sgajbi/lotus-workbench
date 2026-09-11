import type { RefObject } from "react";

import type { PortfolioReviewContext } from "@/apps/portfolio/portfolio-screen-navigation";

import {
  ActionButton,
  ScreenStatePanel,
  SectionBlock,
  SemanticBadge,
  WorkbenchDataAge,
  WorkbenchSummaryMetricStrip,
} from "@/design-system";
import type { SourceRefreshState } from "@/design-system";
import type { ManageWorkspaceData } from "@/features/workbench/manage-workspace-data";
import { buildManageOverviewModel } from "@/features/workbench/manage-overview-model";
import { MANAGE_WORKFLOW_LABELS } from "@/features/workbench/manage-terminology";

import ManageOverviewDecisionWorklist from "./manage-overview-decision-worklist";
import styles from "./manage-overview.module.css";

export default function ManageOverview({
  data,
  reviewContext,
  checkedAt = null,
  actionRef,
  recheckState = null,
  onRecheck,
}: {
  data: ManageWorkspaceData;
  reviewContext: PortfolioReviewContext;
  checkedAt?: number | null;
  actionRef?: RefObject<HTMLButtonElement | null>;
  recheckState?: SourceRefreshState | null;
  onRecheck?: () => Promise<unknown>;
}) {
  const model = buildManageOverviewModel(data, reviewContext);

  return (
    <SectionBlock
      title={MANAGE_WORKFLOW_LABELS.portfolioManagementDecisions}
      subtitle="Review mandate readiness, resolve open attention items, and continue the selected rebalance workflow."
      className="manage-overview-panel"
      actions={
        <div className={styles.receiptActions}>
          <SemanticBadge tone={model.overviewPostureTone} emphasis="strong">
            {model.overviewPostureLabel}
          </SemanticBadge>
          {checkedAt ? <WorkbenchDataAge updatedAt={checkedAt} /> : null}
          {onRecheck ? (
            <ActionButton
              ref={actionRef}
              priority="quiet"
              disabled={recheckState === "pending"}
              onClick={() => void onRecheck().catch(() => undefined)}
            >
              {recheckState === "pending" ? "Rechecking…" : "Recheck overview"}
            </ActionButton>
          ) : null}
        </div>
      }
    >
      {recheckState === "failed" ? (
        <p className={styles.recheckFailure} role="status">
          Overview recheck failed. The displayed portfolio-management evidence remains from the
          previous successful check.
        </p>
      ) : null}

      <PortfolioOperatingSummary summary={model.portfolioSummary} />

      <WorkbenchSummaryMetricStrip
        ariaLabel="Operating posture"
        layout="custom"
        className={styles.postureStrip}
        itemClassName={styles.postureItem}
        items={model.postureItems.map((item) => ({
          key: item.key,
          label: item.label,
          value: <SemanticBadge tone={item.tone}>{item.value}</SemanticBadge>,
          support: item.support,
        }))}
      />

      <ManageOverviewDecisionWorklist
        selectionScopeKey={reviewContext.portfolioId}
        decisions={model.decisionItems}
      />

      {model.blockedSurfaces.length ? (
        <ScreenStatePanel
          kind="partial"
          surface="portfolio"
          title="Some portfolio-management evidence needs attention"
          body={`Areas to review: ${model.blockedSurfaces.join(", ")}.`}
        />
      ) : null}
    </SectionBlock>
  );
}

function PortfolioOperatingSummary({
  summary,
}: {
  summary: ReturnType<typeof buildManageOverviewModel>["portfolioSummary"];
}) {
  return (
    <dl className={styles.portfolioSummary} aria-label="Portfolio operating summary">
      <div>
        <dt>Portfolio value</dt>
        <dd className={styles.financialValue}>
          {summary.marketValue} {summary.currency}
        </dd>
      </div>
      <div>
        <dt>Positions</dt>
        <dd>{summary.positionCount}</dd>
      </div>
      <div>
        <dt>Cash weight</dt>
        <dd>{summary.cashWeight}</dd>
      </div>
      <div>
        <dt>Risk profile</dt>
        <dd>{summary.riskProfile}</dd>
      </div>
    </dl>
  );
}
