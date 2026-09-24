import { formatTimestampValue } from "@/design-system/utils/financial-formatters";
import { getWorkbenchApiErrorStatus } from "@/features/workbench/api-client";

import {
  buildIdeaActionReasonCodes,
  ideaBusinessReasonLabel,
} from "./idea-action-reasons";
import type {
  AdvisorIdeaConversionIntentRequest,
  AdvisorIdeaFeedbackRequest,
  AdvisorIdeaReasonCode,
  AdvisorIdeaReviewAction,
  AdvisorIdeaReviewActionRequest,
} from "./types";

export type IdeaActionKind = "review" | "feedback" | "conversion";

export type IdeaActionSubmission =
  | {
      kind: "review";
      request: AdvisorIdeaReviewActionRequest;
      idempotencyKey: string;
    }
  | {
      kind: "feedback";
      request: AdvisorIdeaFeedbackRequest;
      idempotencyKey: string;
    }
  | {
      kind: "conversion";
      request: AdvisorIdeaConversionIntentRequest;
      idempotencyKey: string;
    };

export type RetryableIdeaActionSubmission = Extract<
  IdeaActionSubmission,
  { kind: "review" | "conversion" }
>;

export type RetryableSubmissionState = Partial<
  Record<RetryableIdeaActionSubmission["kind"], RetryableIdeaActionSubmission>
>;

export type ReviewIntent = Pick<
  AdvisorIdeaReviewActionRequest,
  "action" | "reasonCodes" | "suppressionReason" | "snoozedUntilUtc"
>;

export type ConversionIntent = Pick<
  AdvisorIdeaConversionIntentRequest,
  "target" | "reasonCodes"
>;

export type IdeaActionRetryDetail = {
  label: string;
  value: string;
};

export const REVIEW_ACTIONS: Array<{
  value: AdvisorIdeaReviewAction;
  label: string;
}> = [
  { value: "approve_for_conversion", label: "Approve for conversion review" },
  { value: "reject", label: "Reject candidate" },
  { value: "no_action", label: "Record no action" },
  { value: "suppress", label: "Suppress candidate" },
  { value: "snooze", label: "Snooze candidate" },
  { value: "escalate_to_pm", label: "Escalate to portfolio management" },
  { value: "escalate_to_compliance", label: "Escalate to compliance" },
];

export function buildReviewIntent({
  reviewAction,
  reviewReason,
  snoozedUntil,
  suppressionReason,
}: {
  reviewAction: AdvisorIdeaReviewAction;
  reviewReason: AdvisorIdeaReasonCode;
  snoozedUntil: string;
  suppressionReason: NonNullable<
    AdvisorIdeaReviewActionRequest["suppressionReason"]
  >;
}): ReviewIntent {
  return {
    action: reviewAction,
    reasonCodes: buildIdeaActionReasonCodes({
      basis: reviewReason,
      kind: "review",
      reviewAction,
    }),
    ...(reviewAction === "suppress" ? { suppressionReason } : {}),
    ...(reviewAction === "snooze" && snoozedUntil
      ? { snoozedUntilUtc: new Date(snoozedUntil).toISOString() }
      : {}),
  };
}

export function buildConversionIntent({
  conversionReason,
  conversionTarget,
}: {
  conversionReason: AdvisorIdeaReasonCode;
  conversionTarget: string;
}): ConversionIntent {
  return {
    target: conversionTarget as AdvisorIdeaConversionIntentRequest["target"],
    reasonCodes: buildIdeaActionReasonCodes({
      basis: conversionReason,
      kind: "conversion",
    }),
  };
}

export function sameReviewIntent(
  request: AdvisorIdeaReviewActionRequest,
  intent: ReviewIntent,
): boolean {
  return (
    request.action === intent.action &&
    sameReasonCodes(request.reasonCodes, intent.reasonCodes) &&
    request.suppressionReason === intent.suppressionReason &&
    request.snoozedUntilUtc === intent.snoozedUntilUtc
  );
}

export function sameConversionIntent(
  request: AdvisorIdeaConversionIntentRequest,
  intent: ConversionIntent,
): boolean {
  return (
    request.target === intent.target &&
    sameReasonCodes(request.reasonCodes, intent.reasonCodes)
  );
}

export function withoutRetry(
  current: RetryableSubmissionState,
  submission: RetryableIdeaActionSubmission,
): RetryableSubmissionState {
  if (current[submission.kind]?.idempotencyKey !== submission.idempotencyKey) {
    return current;
  }
  return withoutRetryKind(current, submission.kind);
}

export function withoutRetryKind(
  current: RetryableSubmissionState,
  kind: RetryableIdeaActionSubmission["kind"],
): RetryableSubmissionState {
  if (!current[kind]) {
    return current;
  }
  const next = { ...current };
  delete next[kind];
  return next;
}

export function isAmbiguousIdeaActionFailure(error: unknown): boolean {
  const status = getWorkbenchApiErrorStatus(error);
  return status == null || status === 408 || status === 429 || status >= 500;
}

export function hasInlineRetry(
  failedSubmission: IdeaActionSubmission | undefined,
  review: RetryableIdeaActionSubmission | undefined,
  conversion: RetryableIdeaActionSubmission | undefined,
): boolean {
  if (!failedSubmission || failedSubmission.kind === "feedback") {
    return false;
  }
  const retry = failedSubmission.kind === "review" ? review : conversion;
  return retry?.idempotencyKey === failedSubmission.idempotencyKey;
}

export function reviewRetryDetails(
  request: AdvisorIdeaReviewActionRequest,
): IdeaActionRetryDetail[] {
  const details: IdeaActionRetryDetail[] = [
    {
      label: "Review action",
      value:
        REVIEW_ACTIONS.find((option) => option.value === request.action)
          ?.label ?? request.action,
    },
    {
      label: "Review basis",
      value: ideaBusinessReasonLabel(request.reasonCodes),
    },
  ];
  if (request.suppressionReason) {
    details.push({
      label: "Suppression reason",
      value: formatCodeLabel(request.suppressionReason),
    });
  }
  if (request.snoozedUntilUtc) {
    details.push({
      label: "Snooze until",
      value: formatTimestampValue(request.snoozedUntilUtc, {
        nullDisplay: request.snoozedUntilUtc,
      }),
    });
  }
  return details;
}

export function conversionRetryDetails(
  request: AdvisorIdeaConversionIntentRequest,
): IdeaActionRetryDetail[] {
  const targetLabels: Record<
    AdvisorIdeaConversionIntentRequest["target"],
    string
  > = {
    advise_proposal: "Advise proposal review",
    manage_review: "Manage review",
    report_evidence: "Report evidence review",
  };
  return [
    { label: "Target workflow", value: targetLabels[request.target] },
    {
      label: "Conversion basis",
      value: ideaBusinessReasonLabel(request.reasonCodes),
    },
  ];
}

export function ideaActionFailureCopy(
  error: unknown,
  actionKind: IdeaActionKind | undefined,
): string {
  if (actionKind !== "feedback") {
    const label = actionKind === "conversion" ? "conversion intent" : "review";
    const status = getWorkbenchApiErrorStatus(error);
    if (status === 401 || status === 403) {
      return `This ${label} is not available for your current access. No ${label} was shown as saved.`;
    }
    if (status === 409) {
      return `The source rejected this ${label} because the opportunity or an earlier request changed. Refresh before recording another ${label}.`;
    }
    if (status === 400 || status === 422) {
      return `The source could not accept this ${label}. Review its terms before recording it again.`;
    }
    return `We could not confirm whether this ${label} was saved. The displayed opportunity remains unchanged.`;
  }

  const status = getWorkbenchApiErrorStatus(error);
  if (status === 401 || status === 403) {
    return "Feedback is not available for your current access. No feedback was saved.";
  }
  if (status === 409) {
    return "The opportunity changed or conflicts with existing feedback. Refresh it before recording new feedback; no feedback was shown as saved.";
  }
  if (status === 502 || status === 503 || status === 504) {
    return "The feedback service is unavailable. Your exact selection is retained for retry, and no feedback was shown as saved.";
  }
  return "Workbench could not verify the saved feedback against source evidence. Your exact selection is retained for retry, and the opportunity remains unchanged.";
}

export function formatActionKind(kind: IdeaActionKind): string {
  if (kind === "conversion") {
    return "Conversion intent";
  }
  return `${kind.slice(0, 1).toUpperCase()}${kind.slice(1)}`;
}

function sameReasonCodes(
  left: readonly AdvisorIdeaReasonCode[],
  right: readonly AdvisorIdeaReasonCode[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function formatCodeLabel(value: string): string {
  const label = value.replaceAll("_", " ");
  return `${label.slice(0, 1).toUpperCase()}${label.slice(1)}`;
}
