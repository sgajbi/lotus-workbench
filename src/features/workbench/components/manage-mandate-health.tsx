"use client";

import { businessStateLabel } from "@/copy/business-state-copy";
import {
  ActionButton,
  ScreenStatePanel,
  SectionBlock,
  SemanticBadge,
  SourceWindowNavigation,
  useAdmittedSourceSelection,
} from "@/design-system";
import { cx } from "@/design-system/utils/cx";
import { useClientMounted } from "@/design-system/hooks/use-client-mounted";
import { buildDpmCommandCenterPanelModel } from "@/features/workbench/dpm-command-center-view-model";
import {
  clampMandateHealthPercent,
  findMandateHealthRow,
  formatMandateAction,
  formatMandateAttentionObservation,
  formatMandateHealthDimensionLabel,
  formatMandateHealthDisplayDate,
  formatMandateHealthObservation,
  mandateHealthScoreToPercent,
  mandateHealthSummaryStateLabel,
} from "@/features/workbench/manage-mandate-health-helpers";
import { formatBusinessOwner } from "@/features/workbench/manage-actor-presentation";
import {
  buildManageExceptionRowsResult,
  buildMandateHealthDimensionRows,
  filterManageExceptionRowsForMandate,
  formatBusinessMandateType,
  formatBusinessSource,
  readStringFromResponse,
  toneForState,
} from "@/features/workbench/manage-workspace-view-model";
import { useManageExceptionSourceWindow } from "@/features/workbench/use-manage-exception-source-window";
import { MANAGE_WORKFLOW_LABELS } from "@/features/workbench/manage-terminology";

import type {
  MandateHealthRow,
  ManageExceptionRow,
} from "@/features/workbench/manage-workspace-view-model";

import type { ManageWorkspaceData } from "../manage-workspace-data";

import styles from "./manage-mandate-health.module.css";

type Props = {
  data: ManageWorkspaceData;
};

export default function ManageMandateHealth({ data }: Props) {
  const interactiveReady = useClientMounted();
  const commandModel = buildDpmCommandCenterPanelModel({
    commandCenter: data.commandCenter,
    exceptions: data.commandCenterExceptions,
    mandate: data.mandate,
    mandateHealth: data.mandateHealth,
  });
  const exceptionSource = useManageExceptionSourceWindow({
    portfolioId: data.portfolio.portfolio.portfolio_id,
    mandateId: commandModel.mandateId === "N/A" ? null : commandModel.mandateId,
    initialResponse: data.commandCenterExceptions,
    initialError: data.commandCenterExceptionsError,
  });
  const exceptionRowsResult = buildManageExceptionRowsResult(exceptionSource.response);
  const exceptionRows = filterManageExceptionRowsForMandate(
    exceptionRowsResult.rows,
    commandModel.mandateId,
  );
  const hasAvailableExceptionEvidence = exceptionSource.evidencePosture !== "unavailable";
  const healthRows = buildMandateHealthDimensionRows(commandModel);
  const selectionScopeKey = [
    data.portfolio.portfolio.portfolio_id,
    commandModel.mandateId,
    `source-window-${exceptionSource.currentWindow}`,
  ].join("::");
  const [selectedExceptionKey, setSelectedExceptionKey] =
    useAdmittedSourceSelection({
      scopeKey: selectionScopeKey,
      admittedKeys: exceptionRows.map((row) => row.key),
      sourceResolved: !exceptionSource.isLoading,
    });
  const selectedException =
    exceptionRows.find((row) => row.key === selectedExceptionKey) ?? null;
  const mandateType = formatBusinessMandateType(
    readStringFromResponse(data.mandate, "mandate_type") ??
      readStringFromResponse(data.mandate, "type"),
  );
  const riskProfile =
    readStringFromResponse(data.mandate, "risk_profile") ??
    readStringFromResponse(data.mandate, "risk_profile_code") ??
    "Not available";
  const currency =
    readStringFromResponse(data.mandate, "base_currency") ??
    readStringFromResponse(data.mandate, "currency") ??
    data.portfolio.portfolio.base_currency ??
    "Not available";
  const asOfDate =
    readStringFromResponse(data.mandate, "as_of_date") ??
    readStringFromResponse(data.mandate, "as_of") ??
    data.portfolio.as_of_date ??
    "N/A";
  const marketDataRow = findMandateHealthRow(healthRows, ["market", "source", "data"]);
  const benchmarkRow = findMandateHealthRow(healthRows, ["benchmark"]);
  const healthScore = mandateHealthScoreToPercent(commandModel.mandateHealthScore);
  const dataReadinessScore = mandateHealthScoreToPercent(marketDataRow?.score);
  const benchmarkScore = mandateHealthScoreToPercent(benchmarkRow?.score);

  return (
    <SectionBlock
      id="mandate-health-panel"
      title={MANAGE_WORKFLOW_LABELS.mandateReview}
      subtitle="Review mandate posture, select an attention item, and inspect its source-owned next step and evidence."
      className={styles.panel}
      headerClassName={styles.header}
      interactiveReady={interactiveReady}
      actions={
        <SemanticBadge tone={toneForState(commandModel.supportabilityState)}>
          {businessStateLabel(commandModel.supportabilityState)}
        </SemanticBadge>
      }
    >
      <MandateStateNotice
        state={commandModel.state}
        supportabilityState={commandModel.supportabilityState}
        dataCompletenessState={commandModel.dataCompletenessState}
        mandateHealthState={commandModel.mandateHealthState}
        hasSourceError={Boolean(
            data.commandCenterError ||
            !hasAvailableExceptionEvidence ||
            data.mandateHealthError
        )}
      />

      <div className={styles.contextRow} aria-label="Mandate context">
        <span>{mandateType}</span>
        <span>{riskProfile}</span>
        <span>{currency}</span>
        <span>
          {MANAGE_WORKFLOW_LABELS.asOfDate}{" "}
          {asOfDate === "N/A" ? "Not available" : formatMandateHealthDisplayDate(asOfDate)}
        </span>
      </div>

      <div className={styles.summaryGrid} aria-label="Mandate health summary">
        <HealthSummaryCard
          label={MANAGE_WORKFLOW_LABELS.mandateHealth}
          value={businessStateLabel(commandModel.mandateHealthState)}
          detail={formatSourceScoreDetail(healthScore)}
          tone={toneForState(commandModel.mandateHealthState)}
          meter={healthScore}
        />
        <HealthSummaryCard
          label={MANAGE_WORKFLOW_LABELS.dataAvailability}
          value={businessStateLabel(commandModel.dataCompletenessState)}
          detail={formatSourceScoreDetail(dataReadinessScore)}
          tone={toneForState(commandModel.dataCompletenessState)}
          meter={dataReadinessScore}
        />
        <HealthSummaryCard
          label="Benchmark alignment"
          value={mandateHealthSummaryStateLabel(benchmarkRow)}
          detail={formatSourceScoreDetail(benchmarkScore)}
          tone={toneForState(benchmarkRow?.state ?? "N/A")}
          meter={benchmarkScore}
        />
        <HealthSummaryCard
          label="Latest monitoring"
          value={businessStateLabel(commandModel.latestMonitoringRunStatus)}
          detail={
            commandModel.latestMonitoringRunId === "N/A"
              ? "Run not available"
              : `Run ${commandModel.latestMonitoringRunId}`
          }
          tone={toneForState(commandModel.latestMonitoringRunStatus)}
          meter={null}
        />
      </div>

      <div className={styles.reviewWorkspace} data-testid="mandate-health-review-workspace">
        <AttentionReviewQueue
          rows={exceptionRows}
          evidencePosture={exceptionSource.evidencePosture}
          correlationId={exceptionSource.response?.correlation_id ?? null}
          currentWindow={exceptionSource.currentWindow}
          hasPrevious={exceptionSource.hasPrevious}
          hasNext={Boolean(exceptionSource.nextCursor)}
          canNext={exceptionSource.canShowNext}
          isLoading={exceptionSource.isLoading}
          navigationFailure={exceptionSource.navigationFailure}
          rejectedRowCount={exceptionRowsResult.rejectedRowCount}
          selectedKey={selectedException?.key ?? null}
          onSelect={setSelectedExceptionKey}
          onPrevious={() => void exceptionSource.showPrevious()}
          onNext={() => void exceptionSource.showNext()}
          onRetry={() => void exceptionSource.retry()}
        />
        {hasAvailableExceptionEvidence && selectedException ? (
          <SelectedReviewItem
            row={selectedException}
          />
        ) : null}
      </div>

      <HealthDimensionsCard rows={healthRows} />
    </SectionBlock>
  );
}

function MandateStateNotice({
  state,
  supportabilityState,
  dataCompletenessState,
  mandateHealthState,
  hasSourceError,
}: {
  state: ReturnType<typeof buildDpmCommandCenterPanelModel>["state"];
  supportabilityState: string;
  dataCompletenessState: string;
  mandateHealthState: string;
  hasSourceError: boolean;
}) {
  const hasPartialEvidence = [dataCompletenessState, mandateHealthState].some((value) => {
    const normalized = value.trim();
    return (
      !normalized ||
      normalized === "N/A" ||
      /PARTIAL|DEGRADED|STALE|UNKNOWN/i.test(normalized)
    );
  });
  if (state === "complete" && !hasSourceError && !hasPartialEvidence) {
    return null;
  }
  if (state === "empty") {
    return (
      <ScreenStatePanel
        kind="empty"
        surface="portfolio"
        title="No mandate monitoring records"
        body="Manage returned no mandate monitoring records for the selected portfolio."
      />
    );
  }
  if (state === "unsupported") {
    if (supportabilityState.toUpperCase() !== "BLOCKED") {
      return (
        <ScreenStatePanel
          kind="unavailable"
          surface="portfolio"
          title="Mandate monitoring is not supported"
          body="The current service contract does not publish mandate monitoring for this portfolio."
        />
      );
    }
    return (
      <ScreenStatePanel
        kind="permission_blocked"
        surface="portfolio"
        title="Mandate monitoring is not available for this access context"
        body="Your current access or the supported service contract does not permit this mandate monitoring view."
      />
    );
  }
  if (state === "unavailable") {
    return (
      <ScreenStatePanel
        kind="unavailable"
        surface="portfolio"
        title="Mandate monitoring is unavailable"
        body="The Gateway could not load mandate monitoring. Portfolio context remains available while the service recovers."
      />
    );
  }
  return (
      <ScreenStatePanel
        kind="partial"
        surface="portfolio"
        title="Mandate review evidence is incomplete"
        body="Some mandate monitoring evidence is stale, degraded, or unavailable. Available source-owned results remain visible below."
    />
  );
}

function HealthSummaryCard({
  label,
  value,
  detail,
  tone,
  meter,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "default" | "success" | "warn" | "danger";
  meter: number | null;
}) {
  return (
    <div className={cx(styles.healthCard, tone !== "default" && styles[tone])}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      {meter === null ? null : (
        <div
          className={styles.meter}
          role="img"
          aria-label={`Source score ${clampMandateHealthPercent(meter)} out of 100`}
        >
          <span style={{ width: `${clampMandateHealthPercent(meter)}%` }} />
        </div>
      )}
    </div>
  );
}

function AttentionReviewQueue({
  rows,
  evidencePosture,
  correlationId,
  currentWindow,
  hasPrevious,
  hasNext,
  canNext,
  isLoading,
  navigationFailure,
  rejectedRowCount,
  selectedKey,
  onSelect,
  onPrevious,
  onNext,
  onRetry,
}: {
  rows: ManageExceptionRow[];
  evidencePosture: "complete" | "partial" | "unavailable";
  correlationId: string | null;
  currentWindow: number;
  hasPrevious: boolean;
  hasNext: boolean;
  canNext: boolean;
  isLoading: boolean;
  navigationFailure: {
    direction: "next" | "previous";
    permissionBlocked: boolean;
  } | null;
  rejectedRowCount: number;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onRetry: () => void;
}) {
  const hasAvailableEvidence = evidencePosture !== "unavailable";
  return (
    <section
      className={cx("manage-overview-table-card", styles.attentionCard)}
      aria-labelledby="mandate-attention-heading"
      data-source-window={currentWindow}
      data-source-posture={evidencePosture}
      data-source-correlation-id={correlationId ?? undefined}
    >
      <div className="manage-overview-card-header">
        <div>
          <span>Mandate monitoring</span>
          <h3 id="mandate-attention-heading">
            {MANAGE_WORKFLOW_LABELS.attentionItems}
          </h3>
        </div>
        <strong>
          {evidencePosture === "complete"
            ? rows.length
              ? `${rows.length} open`
              : "No open items"
            : evidencePosture === "partial"
              ? `${rows.length} in this view`
              : "Evidence unavailable"}
        </strong>
      </div>
      {navigationFailure ? (
        <ScreenStatePanel
          kind={navigationFailure.permissionBlocked ? "permission_blocked" : "partial"}
          surface="portfolio"
          title={
            navigationFailure.permissionBlocked
              ? "The requested attention-item view is not available for this access context"
              : `The ${navigationFailure.direction} attention-item view could not be loaded`
          }
          body="The last confirmed source window remains visible. No queue position or completion state has been inferred."
          action={
            <ActionButton priority="secondary" aria-disabled={isLoading} onClick={onRetry}>
              {isLoading ? "Retrying source view" : "Retry source view"}
            </ActionButton>
          }
        />
      ) : null}
      {rejectedRowCount > 0 ? (
        <ScreenStatePanel
          kind="partial"
          surface="portfolio"
          title={`${rejectedRowCount} source ${rejectedRowCount === 1 ? "record could" : "records could"} not be identified`}
          body="Manage returned attention evidence without a source-owned exception identifier. Confirmed records remain reviewable, but no complete or zero-attention conclusion has been inferred."
        />
      ) : evidencePosture === "unavailable" ? (
        <ScreenStatePanel
          kind="partial"
          surface="portfolio"
          title="Attention items are temporarily unavailable"
          body="The mandate summary remains visible, but the source exception queue could not be confirmed. No zero-attention conclusion has been inferred."
        />
      ) : evidencePosture === "partial" && !navigationFailure && hasNext ? (
        <ScreenStatePanel
          kind="partial"
          surface="portfolio"
          title="More attention items are available"
          body={`Source window ${currentWindow} is reviewable but does not represent the complete attention queue. Continue through the source views before drawing a whole-queue conclusion.`}
        />
      ) : evidencePosture === "partial" && !navigationFailure ? (
        <ScreenStatePanel
          kind="partial"
          surface="portfolio"
          title="Attention-item evidence is incomplete"
          body="The available records can be reviewed, but the complete attention list has not been confirmed. Review each item shown and refresh before concluding that no further action is required."
        />
      ) : null}
      {hasAvailableEvidence && rows.length ? (
        <div
          className={styles.tableScroll}
          tabIndex={0}
          aria-label="Mandate attention items"
        >
          <table className={cx("manage-overview-table", styles.attentionTable)}>
            <thead>
              <tr>
                <th>Observation</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  className={row.key === selectedKey ? styles.selectedRow : undefined}
                  key={row.key}
                >
                  <td className={styles.observationCell}>
                    <button
                      type="button"
                      className={styles.observationButton}
                      aria-pressed={row.key === selectedKey}
                      onClick={() => onSelect(row.key)}
                    >
                      {formatMandateAttentionObservation(row)}
                    </button>
                  </td>
                  <td>
                    <SemanticBadge tone={toneForState(row.severity)}>
                      {businessStateLabel(row.severity)}
                    </SemanticBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : evidencePosture === "complete" ? (
        <ScreenStatePanel
          kind="empty"
          surface="portfolio"
          title="No open attention items"
          body="Manage returned no open mandate exceptions for this portfolio."
        />
      ) : evidencePosture === "partial" && rejectedRowCount === 0 ? (
        <ScreenStatePanel
          kind="partial"
          surface="portfolio"
          title="No selected-mandate items in this source view"
          body="Continue through the available source views. This partial view does not support a zero-attention conclusion."
        />
      ) : null}
      {hasAvailableEvidence ? (
        <SourceWindowNavigation
          ariaLabel="Mandate attention source views"
          currentWindow={currentWindow}
          hasPrevious={hasPrevious}
          hasNext={hasNext}
          canNext={canNext}
          isLoading={isLoading}
          itemLabel="attention items"
          viewLabel="Attention-item source view"
          onPrevious={onPrevious}
          onNext={onNext}
        />
      ) : null}
    </section>
  );
}

function SelectedReviewItem({
  row,
}: {
  row: ManageExceptionRow;
}) {
  return (
    <aside
      className={styles.reviewDetail}
      aria-label="Selected mandate review item"
      aria-live="polite"
    >
      <div className="manage-overview-card-header">
        <div>
          <span>Selected review item</span>
          <h3>{formatMandateAttentionObservation(row)}</h3>
        </div>
        <SemanticBadge tone={toneForState(row.severity)}>
          {businessStateLabel(row.severity)}
        </SemanticBadge>
      </div>
      <div className={styles.reviewDetailBody}>
        <dl className={styles.reviewFacts}>
          <div>
            <dt>Workflow status</dt>
            <dd>{businessStateLabel(row.state)}</dd>
          </div>
          <div>
            <dt>Accountable owner</dt>
            <dd>{formatBusinessOwner(row.owner)}</dd>
          </div>
          <div>
            <dt>Open for</dt>
            <dd>{row.age === "N/A" ? "Not available" : row.age}</dd>
          </div>
          <div>
            <dt>Evidence source</dt>
            <dd>{formatBusinessSource(row.source)}</dd>
          </div>
        </dl>
        <div className={styles.nextStep}>
          <span>Source-owned next step</span>
          <strong>{formatMandateAction(row.nextAction)}</strong>
        </div>
        <details className={styles.technicalEvidence}>
          <summary>Evidence and technical identifiers</summary>
          <dl>
            <div>
              <dt>Exception ID</dt>
              <dd>{row.key}</dd>
            </div>
            <div>
              <dt>Mandate ID</dt>
              <dd>{businessIdentifier(row.mandateId)}</dd>
            </div>
            <div>
              <dt>Monitoring run</dt>
              <dd>{businessIdentifier(row.monitoringRunId)}</dd>
            </div>
            <div>
              <dt>Source run</dt>
              <dd>{businessIdentifier(row.sourceRunId)}</dd>
            </div>
            <div>
              <dt>Exception correlation</dt>
              <dd>{businessIdentifier(row.correlationId)}</dd>
            </div>
            <div>
              <dt>Exception authority</dt>
              <dd>{businessIdentifier(row.authority)}</dd>
            </div>
          </dl>
        </details>
      </div>
    </aside>
  );
}

function HealthDimensionsCard({ rows }: { rows: MandateHealthRow[] }) {
  return (
    <section
      className={cx("manage-overview-table-card", styles.dimensionsCard)}
      aria-labelledby="mandate-dimensions-heading"
    >
      <div className="manage-overview-card-header">
        <div>
          <span>Source-owned mandate evidence</span>
          <h3 id="mandate-dimensions-heading">
            {MANAGE_WORKFLOW_LABELS.mandateHealthDimensions}
          </h3>
        </div>
      </div>
      <div
        className={styles.tableScroll}
        tabIndex={0}
        aria-label="Mandate health dimensions"
      >
        <table className="manage-overview-table">
          <thead>
            <tr>
              <th>Dimension</th>
              <th>Source score</th>
              <th>Status</th>
              <th>Source observation</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.key}>
                  <td>{formatMandateHealthDimensionLabel(row.dimension)}</td>
                  <td>{formatSourceScore(mandateHealthScoreToPercent(row.score))}</td>
                  <td>
                    <SemanticBadge tone={toneForState(row.state)}>
                      {businessStateLabel(row.state)}
                    </SemanticBadge>
                  </td>
                  <td>{formatMandateHealthObservation(row.reasons)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>No mandate health dimensions are available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatSourceScoreDetail(score: number | null): string {
  return score === null ? "Score not available" : `Source score ${formatSourceScore(score)}`;
}

function formatSourceScore(score: number | null): string {
  return score === null ? "Not available" : `${clampMandateHealthPercent(score)}/100`;
}

function businessIdentifier(value: string | null | undefined): string {
  return !value || value === "N/A" ? "Not available" : value;
}
