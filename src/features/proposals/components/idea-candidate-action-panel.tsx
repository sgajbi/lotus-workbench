"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { Alert } from "@mui/material";
import { useMutation } from "@tanstack/react-query";

import { ActionButton, Text, WorkbenchChoiceGroup } from "@/design-system";

import {
  recordAdvisorIdeaConversionIntent,
  recordAdvisorIdeaFeedback,
  recordAdvisorIdeaReviewAction,
} from "../api";
import { buildIdeaBusinessReasonOptions } from "../idea-action-reasons";
import {
  buildIdeaConversionRequestAuthority,
  buildIdeaReviewRequestAuthority,
  ideaSourceCutAuthorizesConversion,
  readAcceptedIdeaReviewAuthority,
  type AcceptedIdeaReviewAuthority,
  type IdeaCandidateActionAuthority,
} from "../idea-action-authority";
import {
  buildConversionIntent,
  buildReviewIntent,
  conversionRetryDetails,
  formatActionKind,
  hasInlineRetry,
  ideaActionFailureCopy,
  isAmbiguousIdeaActionFailure,
  reviewRetryDetails,
  sameConversionIntent,
  sameReviewIntent,
  withoutRetry,
  withoutRetryKind,
  type IdeaActionKind,
  type IdeaActionSubmission,
  type RetryableIdeaActionSubmission,
  type RetryableSubmissionState,
} from "../idea-action-intent";
import {
  IDEA_FEEDBACK_TAXONOMY_VERSION,
  NOT_USEFUL_REASON_OPTIONS,
  resolveAdvisorIdeaFeedbackReason,
  usefulFeedbackReasonOption,
} from "../idea-feedback";
import type { AdvisorIdeaEvidenceIdentity } from "../idea-ai-explanation-contract";
import type { IdeaPresentationAuthority } from "../use-idea-presentation-receipts";
import type {
  AdvisorIdeaFeedbackOutcome,
  AdvisorIdeaFeedbackReason,
  AdvisorIdeaReasonCode,
  AdvisorIdeaReviewAction,
  AdvisorIdeaReviewActionRequest,
} from "../types";
import styles from "./advisory-opportunities-workspace.module.css";
import IdeaCandidateExplanation from "./idea-candidate-explanation";
import {
  IdeaConversionIntentForm,
  IdeaReviewActionForm,
} from "./idea-candidate-decision-forms";
import { IdeaActionTerms } from "./idea-action-retry-notice";

const FEEDBACK_OUTCOME_OPTIONS = [
  { key: "useful", label: "Useful" },
  { key: "not_useful", label: "Not useful" },
] satisfies Array<{ key: AdvisorIdeaFeedbackOutcome; label: string }>;

export type IdeaActionRefreshResult = {
  sourceRefreshSucceeded: boolean;
  currentQueueCandidatePresent: boolean;
};

export default function IdeaCandidateActionPanel({
  actionAuthority,
  candidateId,
  candidateReasonCodes,
  currentQueueCandidatePresent = true,
  evidenceIdentity,
  persistedAcceptedReviewAuthority,
  portfolioId,
  presentationAuthority,
  onRecorded,
}: {
  actionAuthority?: IdeaCandidateActionAuthority;
  candidateId: string;
  candidateReasonCodes: readonly string[];
  currentQueueCandidatePresent?: boolean;
  evidenceIdentity?: AdvisorIdeaEvidenceIdentity;
  persistedAcceptedReviewAuthority?: AcceptedIdeaReviewAuthority;
  portfolioId: string;
  presentationAuthority?: IdeaPresentationAuthority;
  onRecorded: () => Promise<boolean | IdeaActionRefreshResult>;
}) {
  const feedbackRetryableSubmission = useRef<
    Extract<IdeaActionSubmission, { kind: "feedback" }> | undefined
  >(undefined);
  const [retryableSubmissions, setRetryableSubmissions] =
    useState<RetryableSubmissionState>({});
  const feedbackReasonRef = useRef<HTMLSelectElement>(null);
  const [reviewAction, setReviewAction] = useState<AdvisorIdeaReviewAction>(
    "approve_for_conversion",
  );
  const businessReasonOptions = useMemo(
    () => buildIdeaBusinessReasonOptions(candidateReasonCodes),
    [candidateReasonCodes],
  );
  const defaultBusinessReason = businessReasonOptions[0].value;
  const [reviewReason, setReviewReason] = useState<AdvisorIdeaReasonCode>(
    defaultBusinessReason,
  );
  const [suppressionReason, setSuppressionReason] =
    useState<NonNullable<AdvisorIdeaReviewActionRequest["suppressionReason"]>>(
      "manual_suppression",
    );
  const [snoozedUntil, setSnoozedUntil] = useState("");
  const [feedbackOutcome, setFeedbackOutcome] =
    useState<AdvisorIdeaFeedbackOutcome>("useful");
  const [feedbackReason, setFeedbackReason] = useState<
    AdvisorIdeaFeedbackReason | ""
  >("relevant");
  const [conversionTarget, setConversionTarget] = useState("advise_proposal");
  const [conversionReason, setConversionReason] =
    useState<AdvisorIdeaReasonCode>(defaultBusinessReason);
  const [validationMessage, setValidationMessage] = useState<string>();
  const [feedbackValidationMessage, setFeedbackValidationMessage] =
    useState<string>();
  const [latestRecordedSubmission, setLatestRecordedSubmission] =
    useState<IdeaActionSubmission>();
  const [completedReviewHandoff, setCompletedReviewHandoff] =
    useState<AcceptedIdeaReviewAuthority>();
  const [sourceRefreshFailed, setSourceRefreshFailed] = useState(false);

  const currentReviewIntent = buildReviewIntent({
    reviewAction,
    reviewReason,
    snoozedUntil,
    suppressionReason,
  });
  const currentConversionIntent = buildConversionIntent({
    conversionReason,
    conversionTarget,
  });
  const reviewRequestAuthority =
    !sourceRefreshFailed && actionAuthority
      ? buildIdeaReviewRequestAuthority(actionAuthority, presentationAuthority)
      : undefined;
  const conversionApprovalReady =
    Boolean(reviewRequestAuthority) &&
    ideaSourceCutAuthorizesConversion(actionAuthority);
  const conversionRequestAuthority = sourceRefreshFailed
    ? undefined
    : buildIdeaConversionRequestAuthority(
        actionAuthority,
        persistedAcceptedReviewAuthority,
        {
          presentation: currentQueueCandidatePresent
            ? presentationAuthority
            : undefined,
          completedReviewHandoff: !currentQueueCandidatePresent
            ? completedReviewHandoff
            : undefined,
        },
      );
  const retryableReview =
    retryableSubmissions.review?.kind === "review"
      ? retryableSubmissions.review
      : undefined;
  const retryableConversion =
    retryableSubmissions.conversion?.kind === "conversion"
      ? retryableSubmissions.conversion
      : undefined;
  const reviewIntentChanged = Boolean(
    retryableReview &&
    !sameReviewIntent(retryableReview.request, currentReviewIntent),
  );
  const conversionIntentChanged = Boolean(
    retryableConversion &&
    !sameConversionIntent(retryableConversion.request, currentConversionIntent),
  );
  const recordedDraftDiffers = Boolean(
    latestRecordedSubmission?.kind === "review"
      ? !sameReviewIntent(latestRecordedSubmission.request, currentReviewIntent)
      : latestRecordedSubmission?.kind === "conversion"
        ? !sameConversionIntent(
            latestRecordedSubmission.request,
            currentConversionIntent,
          )
        : false,
  );
  const latestRecordedDetails =
    latestRecordedSubmission?.kind === "review"
      ? reviewRetryDetails(latestRecordedSubmission.request)
      : latestRecordedSubmission?.kind === "conversion"
        ? conversionRetryDetails(latestRecordedSubmission.request)
        : [];

  const actionMutation = useMutation({
    mutationFn: async (submission: IdeaActionSubmission) => {
      if (submission.kind === "review") {
        return await recordAdvisorIdeaReviewAction({
          candidateId,
          portfolioId,
          idempotencyKey: submission.idempotencyKey,
          request: submission.request,
        });
      }
      if (submission.kind === "feedback") {
        return await recordAdvisorIdeaFeedback({
          candidateId,
          portfolioId,
          idempotencyKey: submission.idempotencyKey,
          request: submission.request,
        });
      }
      return await recordAdvisorIdeaConversionIntent({
        candidateId,
        portfolioId,
        idempotencyKey: submission.idempotencyKey,
        request: submission.request,
      });
    },
    onError: (error, submission) => {
      if (submission.kind === "feedback") {
        feedbackRetryableSubmission.current = submission;
        return;
      }
      if (!isAmbiguousIdeaActionFailure(error)) {
        setRetryableSubmissions((current) => withoutRetry(current, submission));
        return;
      }
      setRetryableSubmissions((current) => ({
        ...current,
        [submission.kind]: submission,
      }));
    },
    onSuccess: async (result, submission) => {
      if (submission.kind === "feedback") {
        feedbackRetryableSubmission.current = undefined;
      } else {
        setRetryableSubmissions((current) => withoutRetry(current, submission));
      }
      const refreshResult = await onRecorded();
      const sourceRefreshSucceeded =
        typeof refreshResult === "boolean"
          ? refreshResult
          : refreshResult.sourceRefreshSucceeded;
      if (submission.kind === "review") {
        setCompletedReviewHandoff(
          typeof refreshResult !== "boolean" &&
            refreshResult.sourceRefreshSucceeded &&
            !refreshResult.currentQueueCandidatePresent
            ? readAcceptedIdeaReviewAuthority({
                candidateId,
                request: submission.request,
                response: result,
              })
            : undefined,
        );
      } else if (submission.kind === "conversion") {
        setCompletedReviewHandoff(undefined);
      }
      setLatestRecordedSubmission(submission);
      setSourceRefreshFailed(!sourceRefreshSucceeded);
    },
  });

  function recordSubmission(submission: IdeaActionSubmission) {
    setLatestRecordedSubmission(undefined);
    if (submission.kind === "feedback" && feedbackRetryableSubmission.current) {
      actionMutation.mutate(feedbackRetryableSubmission.current);
      return;
    }
    if (submission.kind === "feedback") {
      feedbackRetryableSubmission.current = submission;
    } else {
      setRetryableSubmissions((current) =>
        withoutRetryKind(current, submission.kind),
      );
    }
    actionMutation.mutate(submission);
  }

  function retryExactSubmission(submission: RetryableIdeaActionSubmission) {
    setLatestRecordedSubmission(undefined);
    if (
      submission.kind === "review" &&
      !matchesCurrentReviewAuthority(submission.request, reviewRequestAuthority)
    ) {
      setValidationMessage(
        "The opportunity evidence changed. Refresh its visible presentation before recording this review.",
      );
      return;
    }
    if (
      submission.kind === "conversion" &&
      !matchesCurrentConversionAuthority(
        submission.request,
        conversionRequestAuthority,
      )
    ) {
      setValidationMessage(
        "The approved review or opportunity evidence changed. Record a current approved review before retrying conversion.",
      );
      return;
    }
    actionMutation.mutate(submission);
  }

  function newIdempotencyKey(kind: IdeaActionKind): string {
    const entropy =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : String(Date.now());
    return `ui-idea-${kind}-${candidateId}-${entropy}`;
  }

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewRequestAuthority) {
      setValidationMessage(
        "Wait for the visible opportunity receipt and current source evidence before recording a review.",
      );
      return;
    }
    if (reviewAction === "approve_for_conversion" && !conversionApprovalReady) {
      setValidationMessage(
        "Conversion approval requires a coherent authoritative Core source cut. Choose another review action or wait for current source evidence.",
      );
      return;
    }
    if (retryableReview && !reviewIntentChanged) {
      setValidationMessage(
        "Retry the exact unconfirmed review, or change its terms before recording a new review.",
      );
      return;
    }
    if (reviewAction === "snooze" && !snoozedUntil) {
      setValidationMessage(
        "Provide a snooze-until time before recording a snooze.",
      );
      return;
    }
    setValidationMessage(undefined);
    recordSubmission({
      kind: "review",
      idempotencyKey: newIdempotencyKey("review"),
      request: {
        reviewId: `ui-idea-review-${candidateId}-${Date.now()}`,
        ...currentReviewIntent,
        ...reviewRequestAuthority,
        decidedAtUtc: new Date().toISOString(),
      },
    });
  }

  function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = resolveAdvisorIdeaFeedbackReason(
      feedbackOutcome,
      feedbackReason,
    );
    if (!reason) {
      setFeedbackValidationMessage(
        "Select the reason this opportunity was not useful.",
      );
      feedbackReasonRef.current?.focus();
      return;
    }
    setFeedbackValidationMessage(undefined);
    setValidationMessage(undefined);
    recordSubmission({
      kind: "feedback",
      idempotencyKey: newIdempotencyKey("feedback"),
      request: {
        feedbackId: `ui-idea-feedback-${candidateId}-${Date.now()}`,
        taxonomyVersion: IDEA_FEEDBACK_TAXONOMY_VERSION,
        outcome: feedbackOutcome,
        reason,
        recordedAtUtc: new Date().toISOString(),
      },
    });
  }

  function changeFeedbackOutcome(outcome: AdvisorIdeaFeedbackOutcome) {
    clearFeedbackRetry();
    setFeedbackOutcome(outcome);
    setFeedbackReason(outcome === "useful" ? "relevant" : "");
  }

  function changeFeedbackReason(reason: AdvisorIdeaFeedbackReason) {
    clearFeedbackRetry();
    setFeedbackReason(reason);
  }

  function clearFeedbackRetry() {
    feedbackRetryableSubmission.current = undefined;
    setFeedbackValidationMessage(undefined);
    if (actionMutation.variables?.kind === "feedback") {
      actionMutation.reset();
    }
  }

  function submitConversion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!conversionRequestAuthority) {
      setValidationMessage(
        "Approve this exact opportunity review before recording a conversion intent.",
      );
      return;
    }
    if (retryableConversion && !conversionIntentChanged) {
      setValidationMessage(
        "Retry the exact unconfirmed conversion intent, or change its terms before recording a new intent.",
      );
      return;
    }
    setValidationMessage(undefined);
    recordSubmission({
      kind: "conversion",
      idempotencyKey: newIdempotencyKey("conversion"),
      request: {
        conversionIntentId: `ui-idea-conversion-${candidateId}-${Date.now()}`,
        ...currentConversionIntent,
        ...conversionRequestAuthority,
        requestedAtUtc: new Date().toISOString(),
      },
    });
  }

  return (
    <section
      className={styles.actionPanel}
      aria-label="Idea candidate advisor actions"
    >
      <div>
        <Text variant="microLabel">Advisor Actions</Text>
        <Text variant="secondary">
          Record a review decision, usefulness feedback, or a request to
          continue in another workflow. These records do not create or approve a
          proposal, contact a client, or place an order.
        </Text>
      </div>
      <IdeaCandidateExplanation
        candidateId={candidateId}
        evidenceIdentity={evidenceIdentity}
        portfolioId={portfolioId}
      />
      <div className={styles.actionForms}>
        <IdeaReviewActionForm
          businessReasonOptions={businessReasonOptions}
          conversionApprovalReady={conversionApprovalReady}
          intentChanged={reviewIntentChanged}
          isPending={actionMutation.isPending}
          onActionChange={setReviewAction}
          onReasonChange={setReviewReason}
          onRetry={retryExactSubmission}
          onSnoozedUntilChange={setSnoozedUntil}
          onSubmit={submitReview}
          onSuppressionReasonChange={setSuppressionReason}
          pendingKind={actionMutation.variables?.kind}
          retryableSubmission={retryableReview}
          sourceAuthorityReady={Boolean(reviewRequestAuthority)}
          reviewAction={reviewAction}
          reviewReason={reviewReason}
          snoozedUntil={snoozedUntil}
          suppressionReason={suppressionReason}
        />

        <form
          className={styles.actionForm}
          noValidate
          onSubmit={submitFeedback}
        >
          <h4>Record feedback</h4>
          <fieldset
            className={styles.feedbackOutcomeGroup}
            aria-describedby="idea-feedback-outcome-hint"
          >
            <legend>Was this opportunity useful?</legend>
            <span id="idea-feedback-outcome-hint" className={styles.fieldHint}>
              Record how well it supported your client review.
            </span>
            <WorkbenchChoiceGroup
              value={feedbackOutcome}
              onChange={changeFeedbackOutcome}
              options={FEEDBACK_OUTCOME_OPTIONS.map((option) => ({
                ...option,
                disabled: actionMutation.isPending,
              }))}
              ariaLabel="Feedback usefulness"
              density="compact"
            />
          </fieldset>
          {feedbackOutcome === "useful" ? (
            <div
              className={styles.feedbackReasonSummary}
              data-testid="idea-feedback-reason-summary"
            >
              <span>Reason</span>
              <strong>{usefulFeedbackReasonOption().label}</strong>
            </div>
          ) : (
            <div className={styles.actionField}>
              <label htmlFor="idea-feedback-reason">
                Why was it not useful?
              </label>
              <select
                ref={feedbackReasonRef}
                id="idea-feedback-reason"
                value={feedbackReason}
                disabled={actionMutation.isPending}
                required
                aria-invalid={feedbackValidationMessage ? true : undefined}
                aria-describedby={
                  feedbackValidationMessage
                    ? "idea-feedback-reason-error idea-feedback-reason-hint"
                    : "idea-feedback-reason-hint"
                }
                onChange={(event) =>
                  changeFeedbackReason(
                    event.target.value as AdvisorIdeaFeedbackReason,
                  )
                }
              >
                <option value="">Select a reason</option>
                {NOT_USEFUL_REASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span id="idea-feedback-reason-hint" className={styles.fieldHint}>
                Choose the reason that best reflects this client review.
              </span>
              {feedbackValidationMessage ? (
                <span
                  id="idea-feedback-reason-error"
                  className={styles.fieldError}
                  role="alert"
                >
                  {feedbackValidationMessage}
                </span>
              ) : null}
            </div>
          )}
          <ActionButton
            priority="secondary"
            type="submit"
            disabled={actionMutation.isPending}
          >
            {actionMutation.isPending &&
            actionMutation.variables?.kind === "feedback"
              ? "Recording..."
              : "Record feedback"}
          </ActionButton>
        </form>

        <IdeaConversionIntentForm
          businessReasonOptions={businessReasonOptions}
          conversionReason={conversionReason}
          conversionTarget={conversionTarget}
          intentChanged={conversionIntentChanged}
          isPending={actionMutation.isPending}
          onReasonChange={setConversionReason}
          onRetry={retryExactSubmission}
          onSubmit={submitConversion}
          onTargetChange={setConversionTarget}
          pendingKind={actionMutation.variables?.kind}
          retryableSubmission={retryableConversion}
          sourceAuthorityReady={Boolean(conversionRequestAuthority)}
        />
      </div>
      <Text variant="secondary">
        Feedback helps improve the relevance and timing of future opportunities.
        It does not approve, suppress, convert, or change policy for this
        opportunity.
      </Text>
      {validationMessage ? (
        <Alert severity="warning">{validationMessage}</Alert>
      ) : null}
      {actionMutation.error &&
      !hasInlineRetry(
        actionMutation.variables,
        retryableReview,
        retryableConversion,
      ) ? (
        <Alert
          severity="warning"
          role="status"
          aria-atomic="true"
          data-testid="idea-action-error"
          data-action-state="not-recorded"
        >
          {ideaActionFailureCopy(
            actionMutation.error,
            actionMutation.variables?.kind,
          )}
        </Alert>
      ) : null}
      {latestRecordedSubmission && sourceRefreshFailed ? (
        <Alert
          severity="warning"
          aria-live="polite"
          data-testid={`idea-action-${latestRecordedSubmission.kind}-status`}
          data-action-state="recorded-refresh-failed"
        >
          <strong id="idea-action-recorded-refresh-failed-title">
            {formatActionKind(latestRecordedSubmission.kind)} was saved, but the
            latest opportunity detail and worklist could not be loaded.
          </strong>{" "}
          Review the refreshed record before taking another action.
          {latestRecordedDetails.length > 0 ? (
            <IdeaActionTerms
              details={latestRecordedDetails}
              labelledBy="idea-action-recorded-refresh-failed-title"
            />
          ) : null}
          {recordedDraftDiffers ? (
            <p>The form contains unsaved changes.</p>
          ) : null}
        </Alert>
      ) : null}
      {latestRecordedSubmission && !sourceRefreshFailed ? (
        <Alert
          severity="success"
          aria-live="polite"
          data-testid={`idea-action-${latestRecordedSubmission.kind}-status`}
          data-action-state="recorded-and-refreshed"
        >
          <strong id="idea-action-recorded-title">
            {formatActionKind(latestRecordedSubmission.kind)} saved.
          </strong>{" "}
          Opportunity detail and worklist are current.
          {latestRecordedDetails.length > 0 ? (
            <IdeaActionTerms
              details={latestRecordedDetails}
              labelledBy="idea-action-recorded-title"
            />
          ) : null}
          {recordedDraftDiffers ? (
            <p>The form contains unsaved changes.</p>
          ) : null}
        </Alert>
      ) : null}
    </section>
  );
}

function matchesCurrentReviewAuthority(
  request: AdvisorIdeaReviewActionRequest,
  authority: ReturnType<typeof buildIdeaReviewRequestAuthority>,
): boolean {
  return Boolean(
    authority &&
    request.reviewChannel === authority.reviewChannel &&
    request.presentationReceiptId === authority.presentationReceiptId &&
    request.expectedMaterialVersion === authority.expectedMaterialVersion &&
    request.expectedEvidenceVersion === authority.expectedEvidenceVersion &&
    request.expectedEvidencePacketId === authority.expectedEvidencePacketId &&
    request.expectedEvidenceContentHash ===
      authority.expectedEvidenceContentHash &&
    request.expectedSourceRevisionVectorDigest ===
      authority.expectedSourceRevisionVectorDigest &&
    request.expectedSourceCutPosture === authority.expectedSourceCutPosture,
  );
}

function matchesCurrentConversionAuthority(
  request: import("../types").AdvisorIdeaConversionIntentRequest,
  authority: ReturnType<typeof buildIdeaConversionRequestAuthority>,
): boolean {
  return Boolean(
    authority &&
    request.expectedReviewId === authority.expectedReviewId &&
    request.expectedMaterialVersion === authority.expectedMaterialVersion &&
    request.expectedEvidenceVersion === authority.expectedEvidenceVersion &&
    request.expectedEvidencePacketId === authority.expectedEvidencePacketId &&
    request.expectedEvidenceContentHash ===
      authority.expectedEvidenceContentHash &&
    request.expectedSourceRevisionVectorDigest ===
      authority.expectedSourceRevisionVectorDigest &&
    request.expectedSourceCutPosture === authority.expectedSourceCutPosture,
  );
}
