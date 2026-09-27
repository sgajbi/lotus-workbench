import { Alert, Button, Divider, FormControlLabel, Switch } from "@mui/material";

import { SemanticBadge, Text } from "@/design-system";
import { formatTimestampValue } from "@/design-system/utils/financial-formatters";
import {
  querySourceAvailability,
  type QuerySourcePosture,
} from "@/features/platform-runtime/query-source-posture";
import type {
  ProposalApprovalRecord,
  ProposalLineageData,
  ProposalVersionData,
  ProposalWorkflowEvent,
} from "../types";
import type { ProposalDetailStageItem } from "../proposal-detail-evidence-view-model";
import { businessEventLabel, proposalStageLabel } from "../proposal-workflow-copy";
import type { ProposalActionSupportEvidence } from "../proposal-action-error";

import detailStyles from "./proposal-detail-view.module.css";
import ProposalActionSupportDetails from "./proposal-action-support-details";

export function ProposalAdvisorActionsPanel({
  currentState,
  stageCopy,
  stageItems,
  actionDisabled,
  actionDisabledReason,
  recoveryActionAvailable,
  recoveryActionPending,
  onRecoverPersistedCommand,
  onSubmitForRiskReview,
  onSubmitForComplianceReview,
  onApproveRisk,
  onApproveCompliance,
  onRecordClientConsent,
}: {
  currentState: string;
  stageCopy: string;
  stageItems: ProposalDetailStageItem[];
  actionDisabled: boolean;
  actionDisabledReason?: string;
  recoveryActionAvailable: boolean;
  recoveryActionPending: boolean;
  onRecoverPersistedCommand: () => void;
  onSubmitForRiskReview: () => void;
  onSubmitForComplianceReview: () => void;
  onApproveRisk: () => void;
  onApproveCompliance: () => void;
  onRecordClientConsent: () => void;
}) {
  return (
    <section className={detailStyles.railPanel}>
      <div className={detailStyles.railPanelHeader}>
        <Text variant="panelTitle">Next action</Text>
        <SemanticBadge tone={currentState === "EXECUTION_READY" ? "success" : "warn"}>
          {proposalStageLabel(currentState)}
        </SemanticBadge>
      </div>
      <Text variant="secondary">{stageCopy}</Text>
      {actionDisabledReason ? (
        <Alert severity="info" sx={{ py: 0, alignItems: "center" }}>
          {actionDisabledReason}
        </Alert>
      ) : null}
      {recoveryActionAvailable ? (
        <Button
          type="button"
          variant="outlined"
          onClick={onRecoverPersistedCommand}
          disabled={recoveryActionPending}
        >
          {recoveryActionPending ? "Rechecking earlier action..." : "Recheck earlier action"}
        </Button>
      ) : null}
      <div className={detailStyles.stageList}>
        {stageItems.map((stage) => (
          <span key={stage.label} className={stage.reached ? detailStyles.stageDone : detailStyles.stagePending}>
            {stage.label}
          </span>
        ))}
      </div>
      <div className={detailStyles.actionStack}>
        {currentState === "DRAFT" ? (
          <>
            <Button type="button" variant="contained" onClick={onSubmitForRiskReview} disabled={actionDisabled}>
              Submit for risk review
            </Button>
            <Button
              type="button"
              variant="outlined"
              onClick={onSubmitForComplianceReview}
              disabled={actionDisabled}
            >
              Submit for compliance review
            </Button>
          </>
        ) : null}
        {currentState === "RISK_REVIEW" ? (
          <Button type="button" variant="contained" onClick={onApproveRisk} disabled={actionDisabled}>
            Approve risk review
          </Button>
        ) : null}
        {currentState === "COMPLIANCE_REVIEW" ? (
          <Button type="button" variant="contained" onClick={onApproveCompliance} disabled={actionDisabled}>
            Approve compliance review
          </Button>
        ) : null}
        {currentState === "AWAITING_CLIENT_CONSENT" ? (
          <Button type="button" variant="contained" onClick={onRecordClientConsent} disabled={actionDisabled}>
            Record client consent
          </Button>
        ) : null}
        {currentState === "EXECUTION_READY" ? (
          <Alert severity="success" sx={{ py: 0, alignItems: "center" }}>
            Proposal is execution ready.
          </Alert>
        ) : null}
      </div>
    </section>
  );
}

export function ProposalEvidenceControlsPanel({
  includeEvidence,
  readControlsDisabled,
  createVersionDisabled,
  onIncludeEvidenceChange,
  versionLookupNo,
  onVersionLookupNoChange,
  onLoadVersion,
  onCreateNextVersion,
  creatingVersion,
  createdVersionNo,
  versionLookup,
  versionActionError,
  versionActionErrorSupportEvidence,
}: {
  includeEvidence: boolean;
  readControlsDisabled: boolean;
  createVersionDisabled: boolean;
  onIncludeEvidenceChange: (value: boolean) => void;
  versionLookupNo: number;
  onVersionLookupNoChange: (value: number) => void;
  onLoadVersion: () => void;
  onCreateNextVersion: () => void;
  creatingVersion: boolean;
  createdVersionNo: number | null;
  versionLookup: ProposalVersionData | null;
  versionActionError: string | null;
  versionActionErrorSupportEvidence: ProposalActionSupportEvidence | null;
}) {
  return (
    <section className={detailStyles.railPanel}>
      <div className={detailStyles.railPanelHeader}>
        <Text variant="panelTitle">Evidence and versions</Text>
      </div>
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={includeEvidence}
            disabled={readControlsDisabled}
            onChange={(event) => onIncludeEvidenceChange(event.target.checked)}
          />
        }
        label="Load full evidence bundle"
      />
      <div className={detailStyles.versionControls}>
        <label>
          <Text variant="dataLabel">Version number</Text>
          <input
            className="input"
            type="number"
            min={1}
            value={versionLookupNo}
            disabled={readControlsDisabled}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              onVersionLookupNoChange(Number.isNaN(next) ? 1 : next);
            }}
          />
        </label>
        <Button type="button" variant="outlined" onClick={onLoadVersion} disabled={readControlsDisabled}>
          Load version
        </Button>
        <Button
          type="button"
          variant="outlined"
          onClick={onCreateNextVersion}
          disabled={creatingVersion || createVersionDisabled}
        >
          {creatingVersion ? "Creating version..." : "Create next version"}
        </Button>
      </div>
      {createdVersionNo ? (
        <Text variant="secondary">Version created successfully: {createdVersionNo}</Text>
      ) : null}
      {versionLookup ? (
        <div className={detailStyles.loadedVersion}>
          <Text variant="cardTitle">Loaded Version {String(versionLookup.version_no ?? versionLookupNo)}</Text>
          <Text variant="metadata">Status at creation: {String(versionLookup.status_at_creation ?? "N/A")}</Text>
          <Text variant="metadata">
            Created at: {formatTimestampValue(versionLookup.created_at, {
              nullDisplay: "Not reported",
            })}
          </Text>
          <Text variant="metadata">Artifact hash: {String(versionLookup.artifact_hash ?? "N/A")}</Text>
        </div>
      ) : null}
      {versionActionError ? (
        <>
          <Alert severity="warning">{versionActionError}</Alert>
          {versionActionErrorSupportEvidence ? (
            <ProposalActionSupportDetails evidence={versionActionErrorSupportEvidence} />
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export function ProposalLineageAuditPanel({
  artifactHash,
  requestHash,
  simulationHash,
  generatedAt,
  lineageVersions,
  sourcePosture,
}: {
  artifactHash?: string;
  requestHash?: string;
  simulationHash?: string;
  generatedAt?: string;
  lineageVersions: NonNullable<ProposalLineageData["versions"]>;
  sourcePosture: QuerySourcePosture;
}) {
  const sourceAvailability = querySourceAvailability(sourcePosture);
  return (
    <section className={detailStyles.railPanel}>
      <Text variant="panelTitle">Lineage and audit</Text>
      <div className={detailStyles.hashList}>
        <div>
          <span>Artifact Hash</span>
          <strong>{artifactHash ?? "Not available"}</strong>
        </div>
        <div>
          <span>Request Hash</span>
          <strong>{requestHash ?? "Not available"}</strong>
        </div>
        <div>
          <span>Simulation Hash</span>
          <strong>{simulationHash ?? "Not available"}</strong>
        </div>
      </div>
      <Text variant="secondary">
        {generatedAt
          ? `Latest artifact generated at ${generatedAt}.`
          : "Evidence metadata is not available in the current Gateway response."}
      </Text>
      {sourceAvailability === "checking" ? (
        <Text variant="secondary">Checking version lineage evidence.</Text>
      ) : sourceAvailability === "unavailable" ? (
        <Text variant="secondary">Version lineage evidence is unavailable.</Text>
      ) : lineageVersions.length ? (
        <div className={detailStyles.timelineList}>
          {lineageVersions.map((version) => (
            <div key={`lineage-${String(version.version_no ?? "na")}`}>
              <strong>Version {String(version.version_no ?? "N/A")}</strong>
              <span>
                {formatTimestampValue(version.created_at, {
                  nullDisplay: "Created time not reported",
                })}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <Text variant="secondary">No lineage metadata returned for this proposal yet.</Text>
      )}
    </section>
  );
}

export function ProposalReviewHistoryPanel({
  workflowEvents,
  hiddenWorkflowEventCount,
  approvals,
  workflowSourcePosture,
  approvalsSourcePosture,
}: {
  workflowEvents: ProposalWorkflowEvent[];
  hiddenWorkflowEventCount: number;
  approvals: ProposalApprovalRecord[];
  workflowSourcePosture: QuerySourcePosture;
  approvalsSourcePosture: QuerySourcePosture;
}) {
  const workflowSourceAvailability = querySourceAvailability(workflowSourcePosture);
  const approvalsSourceAvailability = querySourceAvailability(approvalsSourcePosture);
  return (
    <section className={detailStyles.railPanel}>
      <Text variant="panelTitle">Review history</Text>
      {workflowSourceAvailability === "checking" ? (
        <Text variant="secondary">Checking workflow history.</Text>
      ) : workflowSourceAvailability === "unavailable" ? (
        <Text variant="secondary">Workflow history is unavailable.</Text>
      ) : workflowEvents.length ? (
        <div className={detailStyles.timelineList}>
          {workflowEvents.map((event) => (
            <div key={event.event_id}>
              <strong>{businessEventLabel(event.event_type)}</strong>
              <span>
                {event.from_state ? proposalStageLabel(event.from_state) : "Started"} to{" "}
                {proposalStageLabel(event.to_state)} · {event.actor_id}
              </span>
            </div>
          ))}
          {hiddenWorkflowEventCount > 0 ? (
            <div className={detailStyles.timelineMore}>
              <strong>{hiddenWorkflowEventCount} earlier events retained in Gateway history</strong>
            </div>
          ) : null}
        </div>
      ) : (
        <Text variant="secondary">No workflow events.</Text>
      )}
      <Divider sx={{ my: 1 }} />
      {approvalsSourceAvailability === "checking" ? (
        <Text variant="secondary">Checking approval history.</Text>
      ) : approvalsSourceAvailability === "unavailable" ? (
        <Text variant="secondary">Approval history is unavailable.</Text>
      ) : approvals.length ? (
        <div className={detailStyles.timelineList}>
          {approvals.map((approval) => (
            <div key={approval.approval_id}>
              <strong>{businessEventLabel(approval.approval_type)} review</strong>
              <span>
                {approval.approved ? "Approved" : "Rejected"} by {approval.actor_id}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <Text variant="secondary">No approvals recorded.</Text>
      )}
    </section>
  );
}
