import { describe, expect, it } from "vitest";

import {
  buildConversionIntent,
  buildReviewIntent,
  ideaActionFailureCopy,
  isAmbiguousIdeaActionFailure,
  reviewRetryDetails,
  sameConversionIntent,
  sameReviewIntent,
  withoutRetry,
  withoutRetryKind,
  type RetryableSubmissionState,
} from "../../src/features/proposals/idea-action-intent";
import { WorkbenchApiError } from "../../src/features/workbench/api-client";

const REVIEW_AUTHORITY = {
  reviewChannel: "workbench" as const,
  expectedMaterialVersion: 1,
  expectedEvidenceVersion: 1,
  expectedEvidencePacketId: "evidence-001",
  expectedEvidenceContentHash: `sha256:${"c".repeat(64)}` as const,
  expectedSourceRevisionVectorDigest: `sha256:${"b".repeat(64)}` as const,
  expectedSourceCutPosture: "coherent" as const,
  presentationReceiptId: "receipt-001",
};
const CONVERSION_AUTHORITY = {
  expectedReviewId: "review-001",
  expectedMaterialVersion: 1,
  expectedEvidenceVersion: 1,
  expectedEvidencePacketId: "evidence-001",
  expectedEvidenceContentHash: `sha256:${"c".repeat(64)}` as const,
  expectedSourceRevisionVectorDigest: `sha256:${"b".repeat(64)}` as const,
  expectedSourceCutPosture: "coherent" as const,
};

describe("Idea action intent", () => {
  it("compares review terms independently of request and decision identity", () => {
    const intent = buildReviewIntent({
      reviewAction: "snooze",
      reviewReason: "high_cash_ratio",
      snoozedUntil: "2026-09-08T10:30",
      suppressionReason: "manual_suppression",
    });

    expect(
      sameReviewIntent(
        {
          reviewId: "review-001",
          decidedAtUtc: "2026-09-06T01:00:00Z",
          ...REVIEW_AUTHORITY,
          ...intent,
        },
        intent,
      ),
    ).toBe(true);
    expect(
      sameReviewIntent(
        {
          reviewId: "review-001",
          decidedAtUtc: "2026-09-06T01:00:00Z",
          ...REVIEW_AUTHORITY,
          ...intent,
          snoozedUntilUtc: "2026-09-09T02:30:00.000Z",
        },
        intent,
      ),
    ).toBe(false);
  });

  it("detects changed conversion target or business basis", () => {
    const intent = buildConversionIntent({
      conversionReason: "high_cash_ratio",
      conversionTarget: "advise_proposal",
    });
    const request = {
      conversionIntentId: "conversion-001",
      requestedAtUtc: "2026-09-06T01:00:00Z",
      ...CONVERSION_AUTHORITY,
      ...intent,
    };

    expect(sameConversionIntent(request, intent)).toBe(true);
    expect(
      sameConversionIntent(request, {
        ...intent,
        target: "manage_review",
      }),
    ).toBe(false);
    expect(
      sameConversionIntent(request, {
        ...intent,
        reasonCodes: ["review_approved_for_conversion", "review_required"],
      }),
    ).toBe(false);
  });

  it("clears only the exact retained retry identity", () => {
    const retained = {
      kind: "review" as const,
      idempotencyKey: "idem-review-001",
      request: {
        reviewId: "review-001",
        action: "reject" as const,
        reasonCodes: ["review_rejected" as const, "high_cash_ratio" as const],
        decidedAtUtc: "2026-09-06T01:00:00Z",
        ...REVIEW_AUTHORITY,
      },
    };
    const state: RetryableSubmissionState = { review: retained };

    expect(withoutRetry(state, retained)).toEqual({});
    expect(
      withoutRetry(state, { ...retained, idempotencyKey: "idem-review-002" }),
    ).toBe(state);
    expect(withoutRetryKind(state, "conversion")).toBe(state);
  });

  it("retains indeterminate transport outcomes for exact replay", () => {
    expect(isAmbiguousIdeaActionFailure(new Error("connection lost"))).toBe(
      true,
    );
    expect(
      isAmbiguousIdeaActionFailure(new WorkbenchApiError("source", 503)),
    ).toBe(true);
    for (const status of [408, 429]) {
      expect(
        isAmbiguousIdeaActionFailure(new WorkbenchApiError("source", status)),
      ).toBe(true);
    }
    for (const status of [400, 401, 403, 409, 422]) {
      expect(
        isAmbiguousIdeaActionFailure(new WorkbenchApiError("source", status)),
      ).toBe(false);
    }
  });

  it.each([
    [403, "not available for your current access"],
    [409, "opportunity or an earlier request changed"],
    [422, "could not accept this review"],
  ])("keeps review failure %s actionable", (status, expected) => {
    expect(
      ideaActionFailureCopy(new WorkbenchApiError("review", status), "review"),
    ).toContain(expected);
  });

  it("renders exact suppression terms in the retained review summary", () => {
    const details = reviewRetryDetails({
      reviewId: "review-001",
      action: "suppress",
      reasonCodes: ["review_suppressed", "high_cash_ratio"],
      suppressionReason: "unsupported_evidence",
      decidedAtUtc: "2026-09-06T01:00:00Z",
      ...REVIEW_AUTHORITY,
    });

    expect(details).toEqual([
      { label: "Review action", value: "Suppress candidate" },
      { label: "Review basis", value: "Cash balance requires review" },
      { label: "Suppression reason", value: "Unsupported evidence" },
    ]);
  });

  it("resolves a persisted basis from the closed vocabulary after queue context changes", () => {
    const details = reviewRetryDetails({
      reviewId: "review-001",
      action: "approve_for_conversion",
      reasonCodes: ["review_approved_for_conversion", "high_cash_ratio"],
      decidedAtUtc: "2026-09-06T01:00:00Z",
      ...REVIEW_AUTHORITY,
    });

    expect(details).toContainEqual({
      label: "Review basis",
      value: "Cash balance requires review",
    });
  });
});
