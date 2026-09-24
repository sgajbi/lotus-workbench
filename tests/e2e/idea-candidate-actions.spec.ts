import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

const portfolioId = "PB_SG_GLOBAL_BAL_001";
const candidateId = "idea_high_cash_001";
const candidateEvidenceIdentity = {
  evidencePacketId: "evidence_high_cash_001",
  evidenceContentHash: `sha256:${"c".repeat(64)}`,
  sourceRevisionVectorDigest: `sha256:${"b".repeat(64)}`,
};
const explanationEvidenceDirectory = process.env.ISSUE_996_EVIDENCE_DIR
  ? path.resolve(process.env.ISSUE_996_EVIDENCE_DIR)
  : null;
const actionRetryEvidenceDirectory = process.env.ISSUE_1002_EVIDENCE_DIR
  ? path.resolve(process.env.ISSUE_1002_EVIDENCE_DIR)
  : null;
const visibleBasisEvidenceDirectory = process.env.ISSUE_1010_EVIDENCE_DIR
  ? path.resolve(process.env.ISSUE_1010_EVIDENCE_DIR)
  : null;
const notUsefulFeedbackReasons = [
  "not_relevant",
  "already_known",
  "wrong_timing",
  "insufficient_evidence",
  "wrong_priority",
  "duplicate",
  "client_specific_constraint",
] as const;

async function mockIdeaCandidateActions(
  page: import("@playwright/test").Page,
  currentReasonCodes: () => readonly string[] = () => [
    "high_cash_ratio",
    "review_required",
  ],
  currentReviewDecisions: () => ReadonlyArray<Record<string, unknown>> = () => [],
) {
  let presentationReceiptCount = 0;
  await page.route(
    "**/api/bff/api/v1/ideas/review-queues/advisor**",
    async (route) => {
      const requestedBoundary = new URL(
        route.request().url(),
      ).searchParams.get("evaluatedAtUtc");
      expect(requestedBoundary).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      await route.fulfill({
        json: {
          data: {
            policyVersion: "idea-deterministic-ranking-v1",
            evaluatedAtUtc: requestedBoundary,
            durableStorageBacked: true,
            supportedFeaturePromoted: false,
            exclusions: [],
            items: [
              {
                rank: 1,
                score: "82",
                priorityBucket: "high",
                reasonCodes: [...currentReasonCodes()],
                candidate: {
                  candidateId,
                  materialVersion: 1,
                  evidenceVersion: 1,
                  evidencePacketId: candidateEvidenceIdentity.evidencePacketId,
                  scorePolicyVersion: "idle-liquidity-v2",
                  sourceRevisionVectorDigest:
                    candidateEvidenceIdentity.sourceRevisionVectorDigest,
                  sourceCutPosture: "coherent",
                  family: "high_cash",
                  reviewPosture: "advisor_review_required",
                  score: "82",
                  sourceSignalIds: ["signal_high_cash_001"],
                },
              },
            ],
          },
        },
      });
    },
  );
  await page.route(
    `**/api/bff/api/v1/ideas/candidates/${candidateId}`,
    async (route) => {
      await route.fulfill({
        json: {
          data: {
            candidate: {
              candidateId,
              materialVersion: 1,
              evidenceVersion: 1,
              family: "high_cash",
              lifecycleStatus: "generated",
              reviewPosture: "advisor_review_required",
            },
            evidence: {
              ...candidateEvidenceIdentity,
              sourceCutPosture: "coherent",
              supportability: "ready",
              sourceRefs: [{ productId: "idea-source-001" }],
            },
            auditSummary: { eventCount: 1 },
            reviewDecisions: [...currentReviewDecisions()],
            durableStorageBacked: true,
            supportedFeaturePromoted: false,
          },
        },
      });
    },
  );
  await page.route(
    `**/api/bff/api/v1/ideas/candidates/${candidateId}/presentation-receipts`,
    async (route) => {
      const request = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        json: {
          data: {
            receipt: {
              ...request,
              tenantId: "tenant_demo_sg",
              receiptId: `presentation-receipt-${++presentationReceiptCount}`,
              candidateId,
              acceptedAtUtc: "2026-09-24T01:00:01Z",
              acceptanceTimeSource: "server_accepted",
              schemaVersion: "lotus-idea.candidate-presentation-receipt.v2",
              surface: "advisor_review_queue",
              producer: "lotus-workbench",
            },
            persistenceDecision: "accepted",
            durableStorageBacked: true,
          },
        },
      });
    },
  );
}

function reviewActionData(
  request: Record<string, unknown>,
  decision: "accepted" | "replayed" = "accepted",
) {
  return {
    reviewDecision: {
      reviewId: request.reviewId,
      candidateId,
      evidencePacketId: request.expectedEvidencePacketId,
      evidenceContentHash: request.expectedEvidenceContentHash,
      sourceRevisionVectorDigest: request.expectedSourceRevisionVectorDigest,
      sourceCutPosture: request.expectedSourceCutPosture,
      candidateMaterialVersion: request.expectedMaterialVersion,
      candidateEvidenceVersion: request.expectedEvidenceVersion,
      reviewChannel: request.reviewChannel,
      presentationReceiptId: request.presentationReceiptId,
      action: request.action,
      resultingPosture: ({
        approve_for_conversion: "approved_for_conversion",
        reject: "rejected",
        no_action: "no_action",
        suppress: "suppressed",
        snooze: "advisor_review_required",
        escalate_to_pm: "pm_review_required",
        escalate_to_compliance: "compliance_review_required",
      } as Record<string, string>)[String(request.action)],
      reasonCodes: request.reasonCodes,
      decidedAtUtc: request.decidedAtUtc,
      acceptedAtUtc: "2026-09-24T01:00:01Z",
      acceptanceTimeSource: "server_accepted",
      grantsDownstreamAuthority: false,
    },
    persistence: { decision },
    durableStorageBacked: true,
    supportedFeaturePromoted: false,
  };
}

function conversionIntentData(
  request: Record<string, unknown>,
  decision: "accepted" | "replayed" = "accepted",
) {
  return {
    conversionIntent: {
      conversionIntentId: request.conversionIntentId,
      candidateId,
      target: request.target,
      reviewId: request.expectedReviewId,
      evidencePacketId: request.expectedEvidencePacketId,
      evidenceContentHash: request.expectedEvidenceContentHash,
      sourceRevisionVectorDigest: request.expectedSourceRevisionVectorDigest,
      sourceCutPosture: request.expectedSourceCutPosture,
      candidateMaterialVersion: request.expectedMaterialVersion,
      candidateEvidenceVersion: request.expectedEvidenceVersion,
      reasonCodes: request.reasonCodes,
      requestedAtUtc: request.requestedAtUtc,
      acceptedAtUtc: "2026-09-24T01:00:02Z",
      acceptanceTimeSource: "server_accepted",
      boundary: "intent_only",
      grantsDownstreamAuthority: false,
    },
    persistence: { decision },
    durableStorageBacked: true,
    supportedFeaturePromoted: false,
  };
}

async function openPresentedCandidate(
  page: import("@playwright/test").Page,
) {
  await presentCurrentCandidate(page, async () => {
    await page.goto(
      `/recommendations?mode=opportunities&portfolioId=${portfolioId}`,
      { waitUntil: "domcontentloaded" },
    );
  });
  await page.getByRole("link", { name: new RegExp(candidateId, "i") }).click();
  await expect(page.getByLabel("Idea candidate advisor actions")).toBeVisible({
    timeout: 30_000,
  });
}

async function presentCurrentCandidate(
  page: import("@playwright/test").Page,
  beforePresentation?: () => Promise<void>,
) {
  const presentationAccepted = page.waitForResponse(
    (response) =>
      response.url().endsWith(
        `/api/bff/api/v1/ideas/candidates/${candidateId}/presentation-receipts`,
      ) && response.status() === 201,
  );
  await beforePresentation?.();
  const candidateLink = page.getByRole("link", {
    name: new RegExp(candidateId, "i"),
  });
  await expect(candidateLink).toBeVisible({ timeout: 30_000 });
  await candidateLink.evaluate((element) =>
    element.scrollIntoView({ block: "center", inline: "nearest" }),
  );
  await presentationAccepted;
}

test("blocks review authority on an unpresented candidate deep link", async ({
  page,
}) => {
  await mockIdeaCandidateActions(page);
  let reviewRequestCount = 0;
  await page.route(
    `**/api/bff/api/v1/ideas/candidates/${candidateId}/review-actions`,
    async (route) => {
      reviewRequestCount += 1;
      await route.abort();
    },
  );

  await page.goto(
    `/recommendations?mode=opportunities&portfolioId=${portfolioId}&candidateId=${candidateId}`,
    { waitUntil: "domcontentloaded" },
  );

  await expect(page.getByLabel("Idea candidate advisor actions")).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByRole("button", { name: "Record review" }),
  ).toBeDisabled();
  await expect(
    page.getByText(/Review becomes available after this opportunity is visibly presented/),
  ).toBeVisible();
  expect(reviewRequestCount).toBe(0);
});

test("records a source-owned Idea review without creating a proposal", async ({
  page,
}) => {
  await mockIdeaCandidateActions(page);
  let recordedRequest:
    { headers: Record<string, string>; body: unknown } | undefined;
  await page.route(
    `**/api/bff/api/v1/ideas/candidates/${candidateId}/review-actions`,
    async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      recordedRequest = {
        headers: route.request().headers(),
        body,
      };
      await route.fulfill({
        json: {
          data: reviewActionData(body),
        },
      });
    },
  );

  await openPresentedCandidate(page);

  await expect(page.getByLabel("Idea candidate advisor actions")).toBeVisible();
  await expect(
    page.getByText(/do not create or approve a proposal, contact a client/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Record review" }).click();

  const reviewStatus = page.getByTestId("idea-action-review-status");
  await expect(reviewStatus).toHaveAttribute(
    "data-action-state",
    "recorded-and-refreshed",
  );
  await expect(reviewStatus).toContainText(
    "Review saved. Opportunity detail and worklist are current.",
  );
  await expect(reviewStatus).toContainText("Approve for conversion review");
  await expect(reviewStatus).toContainText("Cash balance requires review");
  expect(recordedRequest?.headers["idempotency-key"]).toMatch(
    /^ui-idea-review-/,
  );
  expect(recordedRequest?.headers["x-caller-subject"]).toBeUndefined();
  expect(recordedRequest?.headers["x-caller-roles"]).toBeUndefined();
  expect(recordedRequest?.headers["x-caller-portfolio-ids"]).toBeUndefined();
  expect(recordedRequest?.headers["x-caller-capabilities"]).toBeUndefined();
  expect(recordedRequest?.body).toMatchObject({
    action: "approve_for_conversion",
    reasonCodes: ["review_approved_for_conversion", "high_cash_ratio"],
  });
  await expect(
    page.getByRole("link", { name: /Open Proposal Builder/ }),
  ).toBeVisible();
  await expect(page.getByText(/proposal created/i)).toHaveCount(0);
});

test("keeps refreshed Idea action drafts visible and submits the displayed basis", async ({
  page,
}, testInfo) => {
  let currentReasonCodes: readonly string[] = [
    "high_cash_ratio",
    "review_required",
  ];
  let currentReviewDecisions: Array<Record<string, unknown>> = [];
  await mockIdeaCandidateActions(
    page,
    () => currentReasonCodes,
    () => currentReviewDecisions,
  );
  const reviewRequests: Array<Record<string, unknown>> = [];
  const conversionRequests: Array<Record<string, unknown>> = [];
  await page.route(
    `**/api/bff/api/v1/ideas/candidates/${candidateId}/review-actions`,
    async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      reviewRequests.push(body);
      currentReasonCodes = ["concentration_attention"];
      const data = reviewActionData(body);
      currentReviewDecisions = [data.reviewDecision];
      await route.fulfill({
        json: {
          data,
        },
      });
    },
  );
  await page.route(
    `**/api/bff/api/v1/ideas/candidates/${candidateId}/conversion-intents`,
    async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      conversionRequests.push(body);
      await route.fulfill({
        json: {
          data: conversionIntentData(body),
        },
      });
    },
  );

  await openPresentedCandidate(page);

  await expect(page.getByLabel("Review basis")).toHaveValue("high_cash_ratio");
  await page.getByRole("button", { name: "Record review" }).click();

  const firstReviewStatus = page.getByTestId("idea-action-review-status");
  await expect(firstReviewStatus).toHaveAttribute(
    "data-action-state",
    "recorded-and-refreshed",
  );
  await expect(firstReviewStatus).toContainText("Cash balance requires review");
  await expect(page.getByLabel("Review basis")).toHaveValue("high_cash_ratio");
  await expect(page.getByLabel("Conversion basis")).toHaveValue(
    "high_cash_ratio",
  );
  await expect(
    page.getByTestId("idea-review-business-reason-retained-draft"),
  ).toContainText("not in the latest opportunity reasons");
  await expect(
    page.getByTestId("idea-conversion-business-reason-retained-draft"),
  ).toBeVisible();
  await expect(
    page.getByLabel("Review basis").getByRole("option", {
      name: "Retained draft — Cash balance requires review",
    }),
  ).toBeAttached();

  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach("idea-action-visible-retained-basis", {
    body: screenshot,
    contentType: "image/png",
  });
  if (visibleBasisEvidenceDirectory) {
    await mkdir(visibleBasisEvidenceDirectory, { recursive: true });
    await page.screenshot({
      path: path.join(
        visibleBasisEvidenceDirectory,
        "idea-action-visible-retained-basis.png",
      ),
      fullPage: true,
    });
  }

  await page.getByRole("button", { name: "Record intent" }).click();
  const conversionStatus = page.getByTestId("idea-action-conversion-status");
  await expect(conversionStatus).toContainText("Cash balance requires review");
  expect(conversionRequests).toHaveLength(1);
  expect(conversionRequests[0]).toMatchObject({
    reasonCodes: ["review_approved_for_conversion", "high_cash_ratio"],
  });

  await page.getByLabel("Review basis").selectOption("concentration_attention");
  await expect(
    page.getByTestId("idea-conversion-business-reason-retained-draft"),
  ).toBeVisible();
  await expect(
    page.getByTestId("idea-review-business-reason-retained-draft"),
  ).toHaveCount(0);
  await presentCurrentCandidate(page);
  await page.getByRole("button", { name: "Record review" }).click();
  await expect(page.getByTestId("idea-action-review-status")).toContainText(
    "Concentration requires attention",
  );

  expect(reviewRequests).toHaveLength(2);
  expect(reviewRequests[0]).toMatchObject({
    reasonCodes: ["review_approved_for_conversion", "high_cash_ratio"],
  });
  expect(reviewRequests[1]).toMatchObject({
    reasonCodes: ["review_approved_for_conversion", "concentration_attention"],
  });
});

test("separates exact Idea retry from an edited advisor intent", async ({
  page,
}, testInfo) => {
  let currentReviewDecisions: Array<Record<string, unknown>> = [];
  await mockIdeaCandidateActions(
    page,
    undefined,
    () => currentReviewDecisions,
  );
  const reviewRequests: Array<{
    headers: Record<string, string>;
    body: Record<string, unknown>;
  }> = [];
  const conversionRequests: Array<{
    headers: Record<string, string>;
    body: Record<string, unknown>;
  }> = [];
  await page.route(
    `**/api/bff/api/v1/ideas/candidates/${candidateId}/review-actions`,
    async (route) => {
      reviewRequests.push({
        headers: route.request().headers(),
        body: route.request().postDataJSON() as Record<string, unknown>,
      });
      if (reviewRequests.length === 1) {
        await route.fulfill({
          status: 504,
          json: {
            title: "Source response not received",
            status: 504,
          },
        });
        return;
      }
      const data = reviewActionData(reviewRequests.at(-1)!.body);
      currentReviewDecisions = [data.reviewDecision];
      await route.fulfill({
        json: {
          data,
        },
      });
    },
  );
  await page.route(
    `**/api/bff/api/v1/ideas/candidates/${candidateId}/conversion-intents`,
    async (route) => {
      conversionRequests.push({
        headers: route.request().headers(),
        body: route.request().postDataJSON() as Record<string, unknown>,
      });
      if (conversionRequests.length === 1) {
        await route.fulfill({
          status: 504,
          json: {
            title: "Source response not received",
            status: 504,
          },
        });
        return;
      }
      await route.fulfill({
        json: {
          data: conversionIntentData(conversionRequests.at(-1)!.body, "replayed"),
        },
      });
    },
  );

  await openPresentedCandidate(page);

  await page.getByRole("button", { name: "Record review" }).click();
  const reviewRecovery = page.getByTestId("idea-review-retry");
  await expect(reviewRecovery).toHaveAttribute(
    "data-action-state",
    "outcome-not-confirmed",
  );
  await expect(reviewRecovery).toContainText("Approve for conversion review");
  await expect(reviewRecovery).toContainText("Cash balance requires review");
  await expect(
    page.getByRole("button", { name: "Change review to record new" }),
  ).toBeDisabled();

  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach("idea-action-exact-retry", {
    body: screenshot,
    contentType: "image/png",
  });
  if (actionRetryEvidenceDirectory) {
    await mkdir(actionRetryEvidenceDirectory, { recursive: true });
    await page.screenshot({
      path: path.join(
        actionRetryEvidenceDirectory,
        "idea-action-exact-retry.png",
      ),
      fullPage: true,
    });
  }

  await page.getByLabel("Review basis").selectOption("review_required");
  await page.getByRole("button", { name: "Record updated review" }).click();
  await expect(page.getByTestId("idea-action-review-status")).toHaveAttribute(
    "data-action-state",
    "recorded-and-refreshed",
  );

  expect(reviewRequests).toHaveLength(2);
  expect(reviewRequests[1].headers["idempotency-key"]).not.toBe(
    reviewRequests[0].headers["idempotency-key"],
  );
  expect(reviewRequests[1].body).toMatchObject({
    action: "approve_for_conversion",
    reasonCodes: ["review_approved_for_conversion", "review_required"],
  });

  await page.getByRole("button", { name: "Record intent" }).click();
  const conversionRecovery = page.getByTestId("idea-conversion-retry");
  await expect(conversionRecovery).toContainText("Advise proposal review");
  await expect(conversionRecovery).toContainText(
    "Cash balance requires review",
  );
  await page.getByLabel("Target workflow").selectOption("manage_review");
  await page.getByLabel("Conversion basis").selectOption("review_required");
  await page
    .getByRole("button", { name: "Retry exact conversion intent" })
    .click();
  const conversionStatus = page.getByTestId("idea-action-conversion-status");
  await expect(conversionStatus).toHaveAttribute(
    "data-action-state",
    "recorded-and-refreshed",
  );
  await expect(conversionStatus).toContainText("Advise proposal review");
  await expect(conversionStatus).toContainText("Cash balance requires review");
  await expect(conversionStatus).toContainText(
    "The form contains unsaved changes.",
  );
  await expect(page.getByLabel("Target workflow")).toHaveValue("manage_review");
  await expect(page.getByLabel("Conversion basis")).toHaveValue(
    "review_required",
  );

  if (actionRetryEvidenceDirectory) {
    await page.screenshot({
      path: path.join(
        actionRetryEvidenceDirectory,
        "idea-action-exact-retry-receipt.png",
      ),
      fullPage: true,
    });
  }

  expect(conversionRequests).toHaveLength(2);
  expect(conversionRequests[1].headers["idempotency-key"]).toBe(
    conversionRequests[0].headers["idempotency-key"],
  );
  expect(conversionRequests[1].body).toEqual(conversionRequests[0].body);
});

test("records every adviser-selected governed feedback reason through Gateway", async ({
  page,
}) => {
  await mockIdeaCandidateActions(page);
  const recordedRequests: Array<{
    headers: Record<string, string>;
    body: Record<string, string>;
  }> = [];
  await page.route(
    `**/api/bff/api/v1/ideas/candidates/${candidateId}/feedback`,
    async (route) => {
      const body = route.request().postDataJSON() as Record<string, string>;
      recordedRequests.push({ headers: route.request().headers(), body });
      await route.fulfill({
        json: {
          data: {
            feedbackEvent: {
              ...body,
              candidateId,
              evidencePacketId: "evidence_high_cash_001",
              actorRole: "advisor",
            },
            persistence: { decision: "accepted" },
            durableStorageBacked: true,
            supportedFeaturePromoted: false,
          },
        },
      });
    },
  );

  await openPresentedCandidate(page);

  await expect(page.getByTestId("idea-feedback-reason-summary")).toContainText(
    "Relevant to this client",
  );
  await expect(page.getByLabel("Why was it not useful?")).toHaveCount(0);
  const usefulChoice = page.getByRole("radio", {
    name: "Useful",
    exact: true,
  });
  const notUsefulChoice = page.getByRole("radio", {
    name: "Not useful",
    exact: true,
  });
  await usefulChoice.focus();
  await usefulChoice.press("ArrowRight");
  await expect(notUsefulChoice).toBeFocused();
  await expect(notUsefulChoice).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Why was it not useful?")).toBeVisible();
  await notUsefulChoice.press("ArrowLeft");
  await expect(usefulChoice).toBeFocused();
  await expect(usefulChoice).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Why was it not useful?")).toHaveCount(0);
  await page.getByRole("button", { name: "Record feedback" }).click();

  const status = page.getByTestId("idea-action-feedback-status");
  await expect(status).toHaveAttribute(
    "data-action-state",
    "recorded-and-refreshed",
  );
  await expect(status).toContainText(
    "Feedback saved. Opportunity detail and worklist are current.",
  );
  expect(recordedRequests[0]).toMatchObject({
    headers: { "idempotency-key": expect.stringMatching(/^ui-idea-feedback-/) },
    body: {
      feedbackId: expect.stringMatching(/^ui-idea-feedback-/),
      taxonomyVersion: "idea-feedback-taxonomy-v1",
      outcome: "useful",
      reason: "relevant",
      recordedAtUtc: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    },
  });

  await page.getByRole("radio", { name: "Not useful" }).click();
  const reasonSelect = page.getByLabel("Why was it not useful?");
  await expect(reasonSelect).toBeVisible();
  expect(
    await reasonSelect
      .locator("option")
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value),
      ),
  ).toEqual(["", ...notUsefulFeedbackReasons]);

  for (const [index, reason] of notUsefulFeedbackReasons.entries()) {
    await reasonSelect.selectOption(reason);
    await page.getByRole("button", { name: "Record feedback" }).click();
    await expect.poll(() => recordedRequests.length).toBe(index + 2);
    await expect(status).toHaveAttribute(
      "data-action-state",
      "recorded-and-refreshed",
    );
    const request = recordedRequests[index + 1]!;
    expect(request.headers["idempotency-key"]).toMatch(/^ui-idea-feedback-/);
    expect(request.body).toEqual({
      feedbackId: expect.stringMatching(/^ui-idea-feedback-/),
      taxonomyVersion: "idea-feedback-taxonomy-v1",
      outcome: "not_useful",
      reason,
      recordedAtUtc: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    expect(request.body).not.toHaveProperty("reasonCodes");
  }

  expect(
    new Set(recordedRequests.map(({ headers }) => headers["idempotency-key"]))
      .size,
  ).toBe(recordedRequests.length);
  expect(recordedRequests).toHaveLength(1 + notUsefulFeedbackReasons.length);

  await page.setViewportSize({ width: 820, height: 1_180 });
  const reviewForm = page
    .getByRole("heading", { name: "Record review" })
    .locator("..");
  const feedbackForm = page
    .getByRole("heading", { name: "Record feedback" })
    .locator("..");
  const conversionForm = page
    .getByRole("heading", { name: "Record conversion intent" })
    .locator("..");
  const [reviewBox, feedbackBox, conversionBox] = await Promise.all([
    reviewForm.boundingBox(),
    feedbackForm.boundingBox(),
    conversionForm.boundingBox(),
  ]);
  expect(reviewBox).not.toBeNull();
  expect(feedbackBox).not.toBeNull();
  expect(conversionBox).not.toBeNull();
  expect(feedbackBox!.x).toBeCloseTo(reviewBox!.x, 0);
  expect(conversionBox!.x).toBeCloseTo(reviewBox!.x, 0);
  expect(feedbackBox!.y).toBeGreaterThanOrEqual(
    reviewBox!.y + reviewBox!.height,
  );
  expect(conversionBox!.y).toBeGreaterThanOrEqual(
    feedbackBox!.y + feedbackBox!.height,
  );
});

test("renders a governed idea rationale with distinct evidence limits", async ({
  page,
}, testInfo) => {
  await mockIdeaCandidateActions(page);
  let recordedRequest:
    { body: Record<string, string>; idempotencyKey?: string } | undefined;
  await page.route(
    `**/api/bff/api/v1/ideas/candidates/${candidateId}/ai-explanations`,
    async (route) => {
      const body = route.request().postDataJSON() as Record<string, string>;
      recordedRequest = {
        body,
        idempotencyKey: route.request().headers()["idempotency-key"],
      };
      await route.fulfill({
        json: {
          status: "EXPLANATION_SERVED",
          disposition: "executed",
          lotusAiRunId: "run-browser-001",
          lotusAiRuntimeExecutionConfirmed: true,
          evaluationVerdict: "accepted",
          explanation: {
            requestId: body.requestId,
            candidateId,
            posture: "ready_for_advisor_review",
            verifierOutcome: "passed",
            explanationText: "Cash weight is above the policy threshold.",
            fallbackUsed: false,
            fallbackReason: null,
            grantsDownstreamAuthority: false,
            supportedFeaturePromoted: false,
            executionProvenancePosture: "unattested_local_test_fixture",
            aiLineageRecorded: true,
            verifiedOutput: {
              groundedClaims: [
                {
                  claimId: "claim-browser-001",
                  claimText: "Cash weight is above the policy threshold.",
                  sourceRefs: [
                    {
                      productId: "portfolio-state-v1",
                      sourceSystem: "portfolio-record",
                      productVersion: "v1",
                      asOfDate: "2026-06-21",
                      freshness: "current",
                      dataQualityStatus: "complete",
                    },
                  ],
                },
              ],
            },
            redactedEvidence: {
              ...candidateEvidenceIdentity,
              reasonCodes: ["high_cash_ratio"],
              unsupportedReasons: ["benchmark_evidence_missing"],
              scorePolicyVersion: "idle-liquidity-v2",
              sourceRefs: [],
            },
          },
        },
      });
    },
  );

  await openPresentedCandidate(page);
  await page.getByRole("button", { name: "Explain this idea" }).click();

  const explanation = page.getByTestId("idea-candidate-explanation");
  await expect(explanation).toHaveAttribute("data-explanation-state", "served");
  await expect(explanation.getByText("Grounded rationale")).toBeVisible();
  await expect(
    explanation.getByText("Benchmark Evidence Missing"),
  ).toBeVisible();
  await expect(explanation.getByText("High Cash Ratio")).toBeVisible();
  await expect(explanation.getByText("run-browser-001")).toBeAttached();
  await expect(
    explanation.getByText(/not verified production provenance/i),
  ).toBeAttached();
  expect(recordedRequest?.body).toMatchObject({
    requestId: expect.stringMatching(/^idea-explanation-/),
    purpose: "advisor_rationale_draft",
    requestedAtUtc: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
  });
  expect(recordedRequest?.idempotencyKey).toBe(recordedRequest?.body.requestId);
  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach("idea-governed-rationale", {
    body: screenshot,
    contentType: "image/png",
  });
  if (explanationEvidenceDirectory) {
    await mkdir(explanationEvidenceDirectory, { recursive: true });
    await page.screenshot({
      path: path.join(
        explanationEvidenceDirectory,
        "idea-governed-rationale.png",
      ),
      fullPage: true,
    });
  }
});

test("keeps independently authorized actions available with deterministic evidence when AI is unavailable", async ({
  page,
}, testInfo) => {
  await mockIdeaCandidateActions(page);
  await page.route(
    `**/api/bff/api/v1/ideas/candidates/${candidateId}/ai-explanations`,
    async (route) => {
      const body = route.request().postDataJSON() as Record<string, string>;
      await route.fulfill({
        json: {
          status: "EXPLANATION_UNAVAILABLE",
          disposition: "runtime_unavailable",
          lotusAiRunId: null,
          lotusAiRuntimeExecutionConfirmed: false,
          evaluationVerdict: "not_evaluated",
          explanation: {
            requestId: body.requestId,
            candidateId,
            posture: "fallback_only",
            verifierOutcome: "not_run",
            explanationText:
              "Cash remains above the source policy threshold for advisor review.",
            fallbackUsed: true,
            fallbackReason: "ai_unavailable",
            grantsDownstreamAuthority: false,
            supportedFeaturePromoted: false,
            executionProvenancePosture: "runtime_unavailable",
            aiLineageRecorded: false,
            redactedEvidence: {
              ...candidateEvidenceIdentity,
              reasonCodes: ["high_cash_ratio"],
              unsupportedReasons: ["runtime_unavailable"],
              scorePolicyVersion: "idle-liquidity-v2",
              sourceRefs: [],
            },
          },
        },
      });
    },
  );

  await openPresentedCandidate(page);
  await page.getByRole("button", { name: "Explain this idea" }).click();

  const explanation = page.getByTestId("idea-candidate-explanation");
  await expect(explanation).toHaveAttribute(
    "data-explanation-state",
    "unavailable",
  );
  await expect(
    explanation.getByText("Deterministic evidence summary"),
  ).toBeVisible();
  await expect(
    explanation.getByText(
      "Cash remains above the source policy threshold for advisor review.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record review" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Record feedback" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Record intent" }),
  ).toBeDisabled();
  await expect(
    page.getByText(/Conversion becomes available after an approved review/),
  ).toBeVisible();
  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach("idea-deterministic-fallback", {
    body: screenshot,
    contentType: "image/png",
  });
  if (explanationEvidenceDirectory) {
    await mkdir(explanationEvidenceDirectory, { recursive: true });
    await page.screenshot({
      path: path.join(
        explanationEvidenceDirectory,
        "idea-deterministic-fallback.png",
      ),
      fullPage: true,
    });
  }
});
