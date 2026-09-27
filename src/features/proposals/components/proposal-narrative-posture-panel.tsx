"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button } from "@mui/material";

import {
  createProposalReportRequest,
  getProposalDeliveryEvents,
  getProposalDeliverySummary,
  getProposalNarrativeReviewEvidence,
  reviewProposalNarrative,
} from "../api";
import {
  buildProposalNarrativePostureModel,
  confirmDiscussionPackRefresh,
  confirmNarrativeReviewRefresh,
} from "../proposal-narrative-posture-view-model";
import { formatProposalEvidenceHash } from "../proposal-evidence-formatters";
import { buildProposalActionIdempotencyKey } from "../proposal-workflow-copy";
import { workbenchStrictQueryDefaults } from "@/features/platform-runtime/query-policy";
import {
  SectionBlock,
  SemanticBadge,
  SupportDetails,
  Text,
  WorkbenchStatusStrip,
} from "@/design-system";
import styles from "./proposal-review-panel.module.css";

type Props = {
  proposalId: string;
  currentVersionNo?: number | null;
};

type PendingAction = {
  kind: "refresh" | "report" | "review";
  versionNo: number;
};

type PendingConfirmation =
  | {
      kind: "review";
      result: Awaited<ReturnType<typeof reviewProposalNarrative>>;
      versionNo: number;
    }
  | {
      kind: "report";
      result: Awaited<ReturnType<typeof createProposalReportRequest>>;
      versionNo: number;
    };

type DiscussionPackRefreshInput = Parameters<
  typeof confirmDiscussionPackRefresh
>[0];

const REVIEW_CONFIRMATION_RECOVERY =
  "The review was submitted, but current proposal evidence could not confirm it. Refresh before taking another action.";
const REPORT_CONFIRMATION_RECOVERY =
  "The discussion-pack request was submitted, but current preparation status could not confirm it. Refresh before retrying.";

export default function ProposalNarrativePosturePanel({
  proposalId,
  currentVersionNo,
}: Props) {
  return (
    <ProposalNarrativePosturePanelProposalScope
      key={proposalId}
      proposalId={proposalId}
      currentVersionNo={currentVersionNo}
    />
  );
}

function ProposalNarrativePosturePanelProposalScope({
  proposalId,
  currentVersionNo,
}: Props) {
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  return (
    <ProposalNarrativePosturePanelSession
      key={`${proposalId}:${currentVersionNo ?? "unavailable"}`}
      proposalId={proposalId}
      currentVersionNo={currentVersionNo}
      actionError={actionError}
      actionMessage={actionMessage}
      pendingAction={pendingAction}
      pendingConfirmation={pendingConfirmation}
      onActionErrorChange={setActionError}
      onActionMessageChange={setActionMessage}
      onPendingActionChange={setPendingAction}
      onPendingConfirmationChange={setPendingConfirmation}
    />
  );
}

type SessionProps = Props & {
  actionError: string | null;
  actionMessage: string | null;
  pendingAction: PendingAction | null;
  pendingConfirmation: PendingConfirmation | null;
  onActionErrorChange: (value: string | null) => void;
  onActionMessageChange: (value: string | null) => void;
  onPendingActionChange: (value: PendingAction | null) => void;
  onPendingConfirmationChange: (value: PendingConfirmation | null) => void;
};

function ProposalNarrativePosturePanelSession({
  proposalId,
  currentVersionNo,
  actionError,
  actionMessage,
  pendingAction,
  pendingConfirmation,
  onActionErrorChange: setActionError,
  onActionMessageChange: setActionMessage,
  onPendingActionChange,
  onPendingConfirmationChange,
}: SessionProps) {
  const versionNo = currentVersionNo ?? null;
  const [reviewedBy, setReviewedBy] = useState("");
  const [reviewReason, setReviewReason] = useState("");

  const summaryQuery = useQuery({
    queryKey: ["proposal-delivery-summary", proposalId],
    queryFn: async () => await getProposalDeliverySummary(proposalId),
    ...workbenchStrictQueryDefaults,
  });
  const eventsQuery = useQuery({
    queryKey: ["proposal-delivery-events", proposalId],
    queryFn: async () => await getProposalDeliveryEvents(proposalId),
    ...workbenchStrictQueryDefaults,
  });
  const narrativeReviewQuery = useQuery({
    queryKey: ["proposal-narrative-review-evidence", proposalId, versionNo],
    queryFn: async () => {
      if (versionNo === null) {
        return null;
      }
      return await getProposalNarrativeReviewEvidence(proposalId, versionNo);
    },
    enabled: versionNo !== null,
    ...workbenchStrictQueryDefaults,
  });

  const posture = useMemo(
    () =>
      buildProposalNarrativePostureModel({
        proposalId,
        versionNo,
        review: narrativeReviewQuery.data,
        summary: summaryQuery.data,
        events: eventsQuery.data,
      }),
    [
      eventsQuery.data,
      narrativeReviewQuery.data,
      proposalId,
      summaryQuery.data,
      versionNo,
    ],
  );

  const canSubmit =
    versionNo !== null &&
    reviewedBy.trim().length > 0 &&
    reviewReason.trim().length > 0;

  function confirmCurrentDiscussionPack(
    report: DiscussionPackRefreshInput["report"],
    confirmationVersionNo: number,
    summary: DiscussionPackRefreshInput["summary"],
    events: DiscussionPackRefreshInput["events"],
  ) {
    confirmDiscussionPackRefresh({
      proposalId,
      versionNo: confirmationVersionNo,
      report,
      summary,
      events,
    });
  }

  async function handleApproveNarrative() {
    if (
      versionNo === null ||
      reviewedBy.trim().length === 0 ||
      reviewReason.trim().length === 0
    ) {
      return;
    }
    onPendingActionChange({ kind: "review", versionNo });
    setActionError(null);
    setActionMessage(null);
    let reviewRecorded = false;
    try {
      const data = await reviewProposalNarrative(
        proposalId,
        versionNo,
        {
          action: "APPROVE",
          reviewed_by: reviewedBy.trim(),
          reason: reviewReason.trim(),
          client_ready_release_requested: false,
        },
        buildProposalActionIdempotencyKey(
          proposalId,
          `narrative-review-${versionNo}`,
        ),
      );
      reviewRecorded = true;
      onPendingConfirmationChange({ kind: "review", result: data, versionNo });
      const narrativeRefresh = narrativeReviewQuery.refetch();
      void Promise.allSettled([
        summaryQuery.refetch(),
        eventsQuery.refetch(),
      ]);
      const narrativeResult = await narrativeRefresh;
      if (narrativeResult.error) {
        throw new Error("REFRESH_UNAVAILABLE");
      }
      confirmNarrativeReviewRefresh({
        proposalId,
        versionNo,
        review: data,
        refreshedReview: narrativeResult.data ?? undefined,
      });
      onPendingConfirmationChange(null);
      setReviewReason("");
      setActionMessage(
        `Advisor review confirmed for proposal version ${versionNo}.`,
      );
    } catch {
      setActionError(
        reviewRecorded
          ? REVIEW_CONFIRMATION_RECOVERY
          : "Advisor review was not recorded. Recheck the rationale and reviewer reference, then try again.",
      );
    } finally {
      onPendingActionChange(null);
    }
  }

  async function handleRequestReport() {
    if (
      versionNo === null ||
      !posture.canRequestDiscussionPack ||
      reviewedBy.trim().length === 0
    ) {
      return;
    }
    onPendingActionChange({ kind: "report", versionNo });
    setActionError(null);
    setActionMessage(null);
    let requestRecorded = false;
    try {
      const data = await createProposalReportRequest(proposalId, {
        report_type: "PORTFOLIO_REVIEW",
        requested_by: reviewedBy.trim(),
        related_version_no: versionNo,
        include_execution_summary: true,
        include_reviewed_narrative: true,
      });
      requestRecorded = true;
      onPendingConfirmationChange({ kind: "report", result: data, versionNo });
      const [summaryResult, eventsResult] = await Promise.all([
        summaryQuery.refetch(),
        eventsQuery.refetch(),
      ]);
      if (summaryResult.error || eventsResult.error) {
        throw new Error("REFRESH_UNAVAILABLE");
      }
      confirmCurrentDiscussionPack(
        data,
        versionNo,
        summaryResult.data,
        eventsResult.data,
      );
      onPendingConfirmationChange(null);
      setActionMessage(
        `Discussion-pack request confirmed for proposal version ${versionNo}.`,
      );
    } catch {
      setActionError(
        requestRecorded
          ? REPORT_CONFIRMATION_RECOVERY
          : "The discussion-pack request was not recorded. Confirm the reviewed rationale and reviewer reference, then try again.",
      );
    } finally {
      onPendingActionChange(null);
    }
  }

  async function handleRefreshConfirmation() {
    if (pendingConfirmation === null) {
      return;
    }

    onPendingActionChange({
      kind: "refresh",
      versionNo: pendingConfirmation.versionNo,
    });
    setActionError(null);
    setActionMessage(null);
    try {
      if (pendingConfirmation.kind === "review") {
        const refreshedReview =
          pendingConfirmation.versionNo === versionNo
            ? await narrativeReviewQuery.refetch().then((result) => {
                if (result.error) {
                  throw new Error("REFRESH_UNAVAILABLE");
                }
                return result.data;
              })
            : await getProposalNarrativeReviewEvidence(
                proposalId,
                pendingConfirmation.versionNo,
              );
        confirmNarrativeReviewRefresh({
          proposalId,
          versionNo: pendingConfirmation.versionNo,
          review: pendingConfirmation.result,
          refreshedReview: refreshedReview ?? undefined,
        });
        void Promise.allSettled([
          summaryQuery.refetch(),
          eventsQuery.refetch(),
        ]);
        setReviewReason("");
        setActionMessage(
          `Advisor review confirmed for proposal version ${pendingConfirmation.versionNo}.`,
        );
      } else {
        const [summaryResult, eventsResult] = await Promise.all([
          summaryQuery.refetch(),
          eventsQuery.refetch(),
        ]);
        if (summaryResult.error || eventsResult.error) {
          throw new Error("REFRESH_UNAVAILABLE");
        }
        confirmCurrentDiscussionPack(
          pendingConfirmation.result,
          pendingConfirmation.versionNo,
          summaryResult.data,
          eventsResult.data,
        );
        setActionMessage(
          `Discussion-pack request confirmed for proposal version ${pendingConfirmation.versionNo}.`,
        );
      }
      onPendingConfirmationChange(null);
    } catch {
      setActionError(
        pendingConfirmation.kind === "review"
          ? REVIEW_CONFIRMATION_RECOVERY
          : REPORT_CONFIRMATION_RECOVERY,
      );
    } finally {
      onPendingActionChange(null);
    }
  }

  return (
    <SectionBlock
      id="proposal-narrative-review"
      className={styles.panel}
      title="Narrative review and discussion pack"
      subtitle="Confirm the recommendation rationale, record advisor review, then request client-discussion material."
      actions={
        <SemanticBadge tone={posture.reviewTone}>
          {posture.reviewState}
        </SemanticBadge>
      }
    >
      {summaryQuery.error || eventsQuery.error || narrativeReviewQuery.error ? (
        <Alert severity="warning">
          Current discussion-pack or delivery status is unavailable. Existing
          proposal evidence remains visible, but no new action will be confirmed
          until the record refreshes.
        </Alert>
      ) : null}
      {actionError ||
      (pendingConfirmation !== null &&
        (pendingAction === null || pendingAction.kind === "refresh")) ? (
        <Alert
          severity="warning"
          role="alert"
          action={
            pendingConfirmation ? (
              <Button
                color="inherit"
                size="small"
                disabled={pendingAction !== null}
                onClick={() => void handleRefreshConfirmation()}
              >
                {pendingAction?.kind === "refresh"
                  ? "Refreshing…"
                  : "Refresh record"}
              </Button>
            ) : undefined
          }
        >
          {actionError ??
            (pendingConfirmation?.kind === "review"
              ? REVIEW_CONFIRMATION_RECOVERY
              : REPORT_CONFIRMATION_RECOVERY)}
        </Alert>
      ) : null}
      {actionMessage ? (
        <Alert
          severity="success"
          role="status"
          data-testid="proposal-narrative-action-status"
        >
          {actionMessage}
        </Alert>
      ) : null}

      <WorkbenchStatusStrip
        label="Narrative review workflow"
        items={posture.workflowItems}
        className={styles.workflow}
        gridClassName={styles.workflowGrid}
        itemClassName={styles.workflowItem}
        itemLabelClassName={styles.workflowLabel}
        itemBodyClassName={styles.workflowBody}
        itemChipClassName={styles.workflowChip}
        itemSupportClassName={styles.workflowSupport}
      />

      <section
        className={styles.nextAction}
        aria-labelledby="narrative-next-action-title"
      >
        <Text variant="eyebrow">Next action</Text>
        <Text variant="cardTitle" as="h3" id="narrative-next-action-title">
          {posture.nextActionTitle}
        </Text>
        <Text variant="secondary">{posture.nextActionDetail}</Text>
      </section>

      <label className={styles.rationaleField}>
        <Text variant="dataLabel">Advisor review rationale</Text>
        <textarea
          className="textarea"
          rows={3}
          value={reviewReason}
          onChange={(event) => setReviewReason(event.target.value)}
          placeholder="Explain why the recommendation is appropriate for advisor use."
        />
      </label>

      <SupportDetails
        summary="Review record details"
        context={`Version ${versionNo ?? "not available"} · ${reviewedBy ? "reviewer reference entered" : "reviewer reference required"}`}
      >
        <div className={styles.recordGrid}>
          <div className={styles.readOnlyRecord}>
            <Text variant="dataLabel">Current proposal version</Text>
            <Text variant="body">{versionNo ?? "Not available"}</Text>
          </div>
          <label className={styles.reviewerField}>
            <Text variant="dataLabel">Reviewer reference</Text>
            <input
              className="input"
              value={reviewedBy}
              onChange={(event) => setReviewedBy(event.target.value)}
              placeholder="Enter the advisor or reviewer reference"
              autoComplete="off"
            />
          </label>
        </div>
        <dl className={styles.supportFacts}>
          <div>
            <dt>Rationale evidence</dt>
            <dd>{formatProposalEvidenceHash(posture.sourceNarrativeHash)}</dd>
          </div>
          <div>
            <dt>Review policy</dt>
            <dd>{posture.policyVersion ?? "Not reported"}</dd>
          </div>
          <div>
            <dt>Latest delivery activity</dt>
            <dd>{posture.latestEventTime ?? "Not recorded"}</dd>
          </div>
        </dl>
      </SupportDetails>

      <div className={styles.actionArea}>
        <div className={styles.actionRow}>
          <Button
            type="button"
            variant="contained"
            disabled={
              !canSubmit ||
              pendingAction !== null ||
              pendingConfirmation !== null
            }
            onClick={() => void handleApproveNarrative()}
          >
            {pendingAction?.kind === "review"
              ? "Recording review…"
              : "Record advisor review"}
          </Button>
          <Button
            type="button"
            variant="outlined"
            disabled={
              pendingAction !== null ||
              pendingConfirmation !== null ||
              !posture.canRequestDiscussionPack ||
              reviewedBy.trim().length === 0 ||
              versionNo === null
            }
            onClick={() => void handleRequestReport()}
          >
            {pendingAction?.kind === "report"
              ? "Requesting discussion pack…"
              : "Request discussion pack"}
          </Button>
        </div>
        <Text variant="metadata" className={styles.actionSupport}>
          A discussion pack becomes available only after this proposal version
          has confirmed advisor-review evidence. Client release, document
          delivery and implementation remain separate controlled steps.
        </Text>
      </div>
    </SectionBlock>
  );
}
