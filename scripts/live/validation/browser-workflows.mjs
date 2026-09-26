import path from "node:path";
import { expect } from "@playwright/test";

import { validateAdvisorBookRenderPageEvidence } from "./advisor-book-proof.mjs";
import { buildRiskMandateSourceRenderRows } from "./risk-mandate-proof.mjs";
import { assertExactSourceRenderProof } from "./source-render-proof.mjs";

const LOW_INCOME_IDEA_CANDIDATE_PATTERN = /^idea_low_income_[0-9a-f]{16}$/;
const SHA256_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const IDEA_SOURCE_CUT_POSTURES = new Set([
  "coherent",
  "coherent_with_declared_tolerance",
  "mixed",
  "partial",
  "unknown",
]);
const ADVISOR_BOOK_BROWSER_PAGE = Object.freeze({
  offset: 0,
  limit: 25,
  sortBy: "portfolio_id",
  sortOrder: "asc",
});

/**
 * Proves the Client Context mandate label is a presentation of the Gateway-owned mandate value.
 * Only case and word-separator presentation differences are permitted; aliases and missing values
 * fail closed.
 *
 * @param {{ sourceValue: string; renderedValue: string }} proof
 * @returns {{ sourceMandate: string; renderedMandate: string }}
 */
export function assertClientContextMandateProof({ sourceValue, renderedValue }) {
  const source = requireClientContextMandateValue(sourceValue, "source");
  const rendered = requireClientContextMandateValue(renderedValue, "rendered");
  const normalize = (value) =>
    value.replaceAll("_", " ").replace(/\s+/gu, " ").toLocaleLowerCase("en");
  if (normalize(rendered) !== normalize(source)) {
    throw new Error(
      `Client Context: Mandate rendered ${rendered}, but Gateway supplied ${source}.`,
    );
  }
  return { sourceMandate: source, renderedMandate: rendered };
}

function requireClientContextMandateValue(value, origin) {
  if (typeof value !== "string" || !value) {
    throw new Error(`Client Context: Mandate returned no ${origin} value.`);
  }
  if (value !== value.trim()) {
    throw new Error(
      `Client Context: Mandate returned ${origin} value with surrounding whitespace.`,
    );
  }
  return value;
}

export async function navigateForBusinessProof(page, route, options) {
  const response = await page.goto(route, {
    ...options,
    waitUntil: "domcontentloaded",
  });
  if (!response) {
    throw new Error(`Canonical browser navigation returned no document response for ${route}.`);
  }
  if (!response.ok()) {
    throw new Error(
      `Canonical browser navigation failed for ${route} with HTTP ${response.status()}.`,
    );
  }
  return response;
}

export async function waitForClientInteractivity(page, selector, timeoutMs) {
  await page.waitForFunction(
    (panelSelector) =>
      globalThis.document
        .querySelector(panelSelector)
        ?.getAttribute("data-client-interactive") === "true",
    selector,
    { timeout: timeoutMs },
  );
}

export async function navigateForInteractiveBusinessProof(
  page,
  route,
  interactiveSelector,
  options,
) {
  const timeoutMs = options?.timeout;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Interactive canonical navigation requires a positive timeout.");
  }
  const response = await navigateForBusinessProof(page, route, options);
  await waitForClientInteractivity(page, interactiveSelector, timeoutMs);
  return response;
}

export function resolveLowIncomeIdeaCandidateId(candidateHref, workbenchBaseUrl) {
  if (!candidateHref) {
    throw new Error("The canonical cash-shortfall candidate link has no href.");
  }

  const candidateId = new URL(candidateHref, workbenchBaseUrl).searchParams.get(
    "candidateId",
  );
  if (!candidateId || !LOW_INCOME_IDEA_CANDIDATE_PATTERN.test(candidateId)) {
    throw new Error(
      `The canonical Idea queue exposed an invalid cash-shortfall candidate id: ${candidateId ?? "missing"}.`,
    );
  }

  return candidateId;
}

export function requireLowIncomeIdeaCandidateId(candidateId) {
  if (!candidateId || !LOW_INCOME_IDEA_CANDIDATE_PATTERN.test(candidateId)) {
    throw new Error(
      `Canonical validation received an invalid current-run cash-shortfall candidate id: ${candidateId ?? "missing"}.`,
    );
  }
  return candidateId;
}

function normalizeAdvisorBriefReviewEvidenceValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hasValidAdvisorBriefReviewTimestamp(value) {
  const timestamp = normalizeAdvisorBriefReviewEvidenceValue(value);
  const match = timestamp?.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|\+00:00)$/,
  );
  if (!timestamp || !match) {
    return false;
  }

  const parsedTimestamp = Date.parse(timestamp);
  if (!Number.isFinite(parsedTimestamp)) {
    return false;
  }

  const parsedDate = new Date(parsedTimestamp);
  const [, year, month, day, hour, minute, second] = match;
  return (
    parsedDate.getUTCFullYear() === Number(year) &&
    parsedDate.getUTCMonth() + 1 === Number(month) &&
    parsedDate.getUTCDate() === Number(day) &&
    parsedDate.getUTCHours() === Number(hour) &&
    parsedDate.getUTCMinutes() === Number(minute) &&
    parsedDate.getUTCSeconds() === Number(second)
  );
}

export async function readAdvisorBriefReviewEvidence(supportabilityRegion) {
  const evidenceRows = supportabilityRegion.getByTestId(
    "advisor-brief-human-review-evidence",
  );
  const rowCount = await evidenceRows.count();
  if (rowCount !== 1) {
    return {
      rowCount,
      reviewState: null,
      supportability: null,
      reviewer: null,
      recordedAt: null,
    };
  }

  const evidenceRow = evidenceRows.first();
  const [reviewState, supportability, reviewer, recordedAt] = await Promise.all([
    evidenceRow.getAttribute("data-review-state"),
    evidenceRow.getAttribute("data-review-supportability"),
    evidenceRow.getAttribute("data-reviewer"),
    evidenceRow.getAttribute("data-recorded-at"),
  ]);
  return { rowCount, reviewState, supportability, reviewer, recordedAt };
}

export function hasAcceptedAdvisorBriefReviewPosture(evidence) {
  return (
    evidence?.rowCount === 1 &&
    normalizeAdvisorBriefReviewEvidenceValue(evidence.reviewState) === "ACCEPTED" &&
    normalizeAdvisorBriefReviewEvidenceValue(evidence.supportability) === "READY" &&
    normalizeAdvisorBriefReviewEvidenceValue(evidence.reviewer) !== null &&
    hasValidAdvisorBriefReviewTimestamp(evidence.recordedAt)
  );
}

export function hasRecordedAdvisorBriefAcceptProof(evidence, expectedReviewer) {
  const reviewer = normalizeAdvisorBriefReviewEvidenceValue(expectedReviewer);
  return (
    hasAcceptedAdvisorBriefReviewPosture(evidence) &&
    reviewer !== null &&
    normalizeAdvisorBriefReviewEvidenceValue(evidence.reviewer) === reviewer
  );
}

export function classifyAdvisorBriefAcceptProofPosture(evidence, expectedReviewer) {
  if (hasRecordedAdvisorBriefAcceptProof(evidence, expectedReviewer)) {
    return "source-confirmed-existing-action";
  }
  if (hasAcceptedAdvisorBriefReviewPosture(evidence)) {
    return "accepted-by-another-reviewer";
  }
  if (
    evidence?.rowCount === 1 &&
    normalizeAdvisorBriefReviewEvidenceValue(evidence.reviewState) === "AWAITING_REVIEW" &&
    normalizeAdvisorBriefReviewEvidenceValue(evidence.supportability) === "ACTION_REQUIRED" &&
    normalizeAdvisorBriefReviewEvidenceValue(evidence.reviewer) === null &&
    normalizeAdvisorBriefReviewEvidenceValue(evidence.recordedAt) === null
  ) {
    return "review-action-available";
  }
  return "review-action-unavailable";
}

const ADVISOR_BRIEF_ACCEPT_SUCCESS_MESSAGE =
  "The brief was accepted for its permitted internal workflow use.";

export async function waitForAdvisorBriefReviewConfirmation(
  reviewRegion,
  { timeoutMs, pollIntervalMs = 250, wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)) },
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const failureFeedback = reviewRegion.getByRole("alert");
    const failureCount = await failureFeedback.count();
    if (failureCount > 1) {
      throw new Error(
        `Adviser brief review action rendered ${failureCount} failure messages; expected at most one.`,
      );
    }
    if (failureCount === 1 && await failureFeedback.isVisible()) {
      const failureMessage = (await failureFeedback.textContent())?.trim();
      throw new Error(
        `Adviser brief review action failed in Workbench: ${failureMessage || "No failure detail was rendered."}`,
      );
    }

    const statusFeedback = reviewRegion.getByRole("status");
    const statusCount = await statusFeedback.count();
    if (statusCount > 1) {
      throw new Error(
        `Adviser brief review action rendered ${statusCount} status messages; expected at most one.`,
      );
    }
    if (statusCount === 1 && await statusFeedback.isVisible()) {
      const statusMessage = (await statusFeedback.textContent())?.trim() ?? "";
      if (statusMessage.includes(ADVISOR_BRIEF_ACCEPT_SUCCESS_MESSAGE)) {
        return;
      }
    }

    await wait(pollIntervalMs);
  }

  throw new Error(
    `Adviser brief review action did not reach source-confirmed success within ${timeoutMs}ms.`,
  );
}

export function classifyRegisteredPanelScreenshotState(panelState, requiredSupportState) {
  return panelState && requiredSupportState && panelState === requiredSupportState
    ? "demo_ready"
    : "truthfully_degraded";
}

export function createBrowserValidationHelpers({
  outputDir,
  summary,
  portfolioId,
  benchmarkCode,
  canonicalAsOfDate,
  timeoutMs,
  panelRegistryById,
}) {
  async function assertListHasItems(locator, description) {
    await expect(locator).toBeVisible({ timeout: timeoutMs });
    const count = await locator.getByRole("listitem").count();
    if (count < 1) {
      throw new Error(`${description} is visible but empty.`);
    }
    summary.uiChecks.push({ description, kind: "list", itemCount: count });
  }

  async function assertTableHasRows(
    locator,
    minimumRows,
    description,
    options = {},
  ) {
    if (options.requireVisible !== false) {
      await expect(locator).toBeVisible({ timeout: timeoutMs });
    } else {
      await expect(locator).toHaveCount(1, { timeout: timeoutMs });
    }
    const count = await locator.locator("tbody tr").count();
    if (count < minimumRows) {
      throw new Error(
        `${description} expected at least ${minimumRows} body rows but found ${count}.`,
      );
    }
    summary.uiChecks.push({ description, kind: "table", rowCount: count });
  }

  async function assertGridHasRows(locator, minimumRows, description) {
    await expect(locator).toBeVisible({ timeout: timeoutMs });
    const rows = locator.locator('[role="row"]:has([role="gridcell"])');
    await expect(rows.first()).toBeVisible({ timeout: timeoutMs });
    const count = await rows.count();
    if (count < minimumRows) {
      throw new Error(
        `${description} expected at least ${minimumRows} rendered rows but found ${count}.`,
      );
    }
    summary.uiChecks.push({ description, kind: "grid", rowCount: count });
  }

  function recordUiCheck(check) {
    summary.uiChecks.push(check);
  }

  async function screenshot(page, name, metadata) {
    const target = path.join(outputDir, name);
    await page.mouse?.move(1, 1);
    await page.keyboard?.press("Escape");
    await page.screenshot({ path: target, fullPage: true });
    summary.screenshots.push({
      name,
      path: target,
      route: metadata.route,
      panel: metadata.panel,
      portfolioId,
      benchmarkCode,
      asOfDate: canonicalAsOfDate,
      state: metadata.state ?? "demo_ready",
    });
  }

  function resolveRegistryRoute(routeTemplate) {
    return routeTemplate
      .replaceAll("{portfolio_id}", portfolioId)
      .replaceAll("{benchmarkCode}", benchmarkCode)
      .replaceAll("{canonicalAsOfDate}", canonicalAsOfDate);
  }

  async function screenshotRegisteredPanel(page, panelId, metadata = {}) {
    const panelSpec = panelRegistryById.get(panelId);
    if (!panelSpec) {
      throw new Error(
        `Screenshot requested for unregistered panel '${panelId}'.`,
      );
    }
    if (!panelSpec.screenshotName) {
      throw new Error(`Panel '${panelId}' has no governed screenshot name.`);
    }
    const panelClassification = summary.panelClassifications?.find(
      (classification) => classification.panel === panelId,
    );
    await screenshot(page, panelSpec.screenshotName, {
      route: metadata.route ?? resolveRegistryRoute(panelSpec.route),
      panel: panelId,
      state:
        metadata.state ??
        classifyRegisteredPanelScreenshotState(
          panelClassification?.state,
          panelSpec.requiredSupportState,
        ),
    });
  }

  async function screenshotAdvisoryJourney(page, name, metadata) {
    await screenshot(page, name, {
      route: metadata.route,
      panel: metadata.panel,
      state: metadata.state,
    });
  }

  return {
    assertGridHasRows,
    assertListHasItems,
    assertTableHasRows,
    recordUiCheck,
    screenshotAdvisoryJourney,
    screenshotRegisteredPanel,
    resolveRegistryRoute,
  };
}

export function classifyAttributionDetailEvidence({
  detailTableCount,
  summaryTableCount,
  partialFallbackCount,
  readyEmptyStateCount,
}) {
  if (detailTableCount > 0) {
    return "detail_rows";
  }
  if (summaryTableCount > 0) {
    return "summary_fallback";
  }
  if (partialFallbackCount > 0) {
    return "governed_partial_fallback";
  }
  if (readyEmptyStateCount > 0) {
    return "ready_empty_state";
  }
  throw new Error(
    "Attribution detail has neither source rows nor a governed fallback state.",
  );
}

export function classifyContributionDetailEvidence({
  positionTableVisible,
  segmentTableVisible,
  governedPartialVisible,
}) {
  const visibleStateCount = [
    positionTableVisible,
    segmentTableVisible,
    governedPartialVisible,
  ].filter(Boolean).length;
  if (visibleStateCount !== 1) {
    throw new Error(
      `Performance contribution detail rendered an invalid or ambiguous source state: positions=${positionTableVisible}, segments=${segmentTableVisible}, partial=${governedPartialVisible}.`,
    );
  }
  if (positionTableVisible) {
    return "position_rows";
  }
  if (segmentTableVisible) {
    return "segment_rows";
  }
  return "governed_partial";
}

async function assertRailModeActive(page, labelPattern, timeoutMs) {
  const railButton = page.getByRole("button", { name: labelPattern }).first();
  await expect(railButton).toBeVisible({ timeout: timeoutMs });
  await expect(railButton).toHaveAttribute("aria-current", "page", {
    timeout: timeoutMs,
  });
}

function tableByExactLabel(page, label) {
  return page.locator(`table[aria-label="${label}"]`);
}

function workbenchPanelByClass(page, className) {
  return page.locator(`article.${className}`).first();
}

function advisoryJourneyRoute({ workbenchBaseUrl, portfolioId, path }) {
  const separator = path.includes("?") ? "&" : "?";
  return `${workbenchBaseUrl}${path}${separator}portfolioId=${encodeURIComponent(portfolioId)}`;
}

export function canonicalIdeaOpportunitiesRoute({
  workbenchBaseUrl,
  portfolioId,
  candidateId,
}) {
  const expectedCandidateId = requireLowIncomeIdeaCandidateId(candidateId);
  return advisoryJourneyRoute({
    workbenchBaseUrl,
    portfolioId,
    path:
      "/recommendations?mode=opportunities" +
      `&candidateId=${encodeURIComponent(expectedCandidateId)}`,
  });
}

export function resolveCanonicalIdeaRestartPlan(lifecycleStatus) {
  if (lifecycleStatus === "ready_for_review") {
    return {
      mutationsAllowed: true,
      reviewRequired: true,
      actions: ["feedback", "review_action", "conversion_intent"],
    };
  }
  if (lifecycleStatus === "reviewed_by_advisor") {
    return {
      mutationsAllowed: true,
      reviewRequired: false,
      actions: ["resume_conversion_intent"],
    };
  }
  if (
    lifecycleStatus === "approved" ||
    lifecycleStatus === "converted_to_proposal"
  ) {
    return {
      mutationsAllowed: false,
      reviewRequired: false,
      actions: [],
    };
  }
  throw new Error(
    "Unsupported canonical Idea restart lifecycle '" +
      String(lifecycleStatus) +
      "'.",
  );
}

export function assertCanonicalIdeaPresentationReceiptEvidence({
  expectedCandidateId,
  expectedSourceLineage,
  idempotencyKey,
  requestBody,
  responseBody,
}) {
  const request = requireCanonicalRecord(
    requestBody,
    "Idea presentation request",
  );
  const responseEnvelope = requireCanonicalRecord(
    responseBody,
    "Idea presentation response",
  );
  const response = requireCanonicalRecord(
    responseEnvelope.data ?? responseEnvelope,
    "Idea presentation response data",
  );
  const receipt = requireCanonicalRecord(
    response.receipt,
    "Idea presentation receipt",
  );
  if (
    Object.hasOwn(request, "tenantId") ||
    Object.hasOwn(request, "tenant_id")
  ) {
    throw new Error(
      "Canonical Workbench presentation request exposed browser-owned tenant scope.",
    );
  }
  if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
    throw new Error(
      "Canonical Workbench presentation request omitted its idempotency key.",
    );
  }
  for (const field of [
    "rankAtPresentation",
    "visibleCandidateCount",
    "candidateMaterialVersion",
    "candidateEvidenceVersion",
  ]) {
    if (!Number.isInteger(request[field]) || request[field] < 1) {
      throw new Error(
        `Canonical Idea presentation request did not preserve positive integer ${field}.`,
      );
    }
  }
  if (!SHA256_DIGEST_PATTERN.test(request.sourceRevisionVectorDigest)) {
    throw new Error(
      "Canonical Idea presentation request carried an invalid sourceRevisionVectorDigest.",
    );
  }
  if (!IDEA_SOURCE_CUT_POSTURES.has(request.sourceCutPosture)) {
    throw new Error(
      "Canonical Idea presentation request carried an invalid sourceCutPosture.",
    );
  }
  const queueLineage = requireCanonicalRecord(
    expectedSourceLineage,
    "Idea queue candidate source lineage",
  );
  if (
    request.sourceRevisionVectorDigest !==
      queueLineage.sourceRevisionVectorDigest ||
    request.sourceCutPosture !== queueLineage.sourceCutPosture
  ) {
    throw new Error(
      "Canonical Idea presentation request did not preserve the rendered queue source lineage.",
    );
  }
  for (const field of [
    "presentedAtUtc",
    "queueSnapshotDigest",
    "queuePolicyVersion",
    "rankingPolicyVersion",
    "sourceRevisionVectorDigest",
    "sourceCutPosture",
  ]) {
    if (typeof request[field] !== "string" || !request[field].trim()) {
      throw new Error(
        `Canonical Idea presentation request omitted ${field}.`,
      );
    }
  }
  for (const field of [
    "rankAtPresentation",
    "visibleCandidateCount",
    "queueSnapshotDigest",
    "queuePolicyVersion",
    "rankingPolicyVersion",
    "candidateMaterialVersion",
    "candidateEvidenceVersion",
    "sourceRevisionVectorDigest",
    "sourceCutPosture",
  ]) {
    if (receipt[field] !== request[field]) {
      throw new Error(
        `Canonical Idea presentation receipt did not preserve ${field}.`,
      );
    }
  }
  const normalizedRequestedAt = normalizeCanonicalUtcTimestamp(
    request.presentedAtUtc,
  );
  if (
    normalizedRequestedAt === null ||
    normalizeCanonicalUtcTimestamp(receipt.presentedAtUtc) !==
      normalizedRequestedAt
  ) {
    throw new Error(
      "Canonical Idea presentation receipt did not preserve presentedAtUtc.",
    );
  }
  if (
    receipt.candidateId !== expectedCandidateId ||
    receipt.schemaVersion !== "lotus-idea.candidate-presentation-receipt.v2" ||
    receipt.surface !== "advisor_review_queue" ||
    receipt.producer !== "lotus-workbench" ||
    typeof receipt.receiptId !== "string" ||
    !receipt.receiptId.trim() ||
    typeof receipt.tenantId !== "string" ||
    !receipt.tenantId.trim() ||
    normalizeCanonicalUtcTimestamp(receipt.acceptedAtUtc) === null ||
    receipt.acceptanceTimeSource !== "server_accepted" ||
    !["accepted", "replayed"].includes(response.persistenceDecision) ||
    response.durableStorageBacked !== true
  ) {
    throw new Error(
      "Canonical Idea presentation response did not prove durable source-owned receipt identity.",
    );
  }
  return {
    candidateId: expectedCandidateId,
    rankAtPresentation: request.rankAtPresentation,
    visibleCandidateCount: request.visibleCandidateCount,
    queuePolicyVersion: request.queuePolicyVersion,
    rankingPolicyVersion: request.rankingPolicyVersion,
    candidateMaterialVersion: request.candidateMaterialVersion,
    candidateEvidenceVersion: request.candidateEvidenceVersion,
    sourceRevisionVectorDigest: request.sourceRevisionVectorDigest,
    sourceCutPosture: request.sourceCutPosture,
    persistenceDecision: response.persistenceDecision,
    durableStorageBacked: true,
    tenantAuthority: "workbench-bff-derived",
  };
}

function normalizeCanonicalUtcTimestamp(value) {
  if (typeof value !== "string") {
    return null;
  }
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/,
  );
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute, second, fraction = ""] = match;
  const numericMonth = Number(month);
  const leapYear =
    Number(year) % 4 === 0 &&
    (Number(year) % 100 !== 0 || Number(year) % 400 === 0);
  const daysInMonth =
    numericMonth === 2
      ? leapYear
        ? 29
        : 28
      : [4, 6, 9, 11].includes(numericMonth)
        ? 30
        : 31;
  if (
    numericMonth < 1 ||
    numericMonth > 12 ||
    Number(day) < 1 ||
    Number(day) > daysInMonth ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59
  ) {
    return null;
  }
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${fraction.replace(/0+$/, "")}Z`;
}

function requireCanonicalRecord(value, description) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${description} was incomplete.`);
  }
  return value;
}

function recordAdvisoryJourneyCheck(summary, payload) {
  summary.advisoryJourneyChecks ??= [];
  summary.advisoryJourneyChecks.push({
    ...payload,
    state: payload.state ?? "ready",
    owner: payload.owner ?? "lotus-workbench",
    gatewayBacked: payload.gatewayBacked ?? true,
  });
}

export function classifyDiscussionPackJourneyEvidence({
  selectedRecordCount,
  emptyStateCount,
}) {
  if (selectedRecordCount === 1 && emptyStateCount === 0) {
    return "ready";
  }
  if (selectedRecordCount === 0 && emptyStateCount === 1) {
    return "empty";
  }
  throw new Error(
    `Discussion pack rendered an ambiguous source state: selected=${selectedRecordCount}, empty=${emptyStateCount}.`,
  );
}

export function classifyAdvisoryJourneyScreenshotState(state) {
  return state === "ready" ? "demo_ready" : "truthfully_degraded";
}

export function buildProposalListSourceRows(value, expectedPortfolioId) {
  if (
    !value ||
    typeof value !== "object" ||
    !value.data ||
    typeof value.data !== "object" ||
    !Array.isArray(value.data.items)
  ) {
    throw new Error("Canonical proposal list response was incomplete.");
  }

  return value.data.items.map((item, index) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.proposal_id !== "string" ||
      !item.proposal_id ||
      typeof item.current_state !== "string" ||
      !item.current_state ||
      item.portfolio_id !== expectedPortfolioId
    ) {
      throw new Error(
        `Canonical proposal list row ${index + 1} did not preserve the requested portfolio, identity, and state.`,
      );
    }
    return {
      source: "proposal-list",
      identity: item.proposal_id,
      state: item.current_state,
    };
  });
}

const WORKSPACE_REVIEW_CONTEXT_QUERY_KEYS = [
  "portfolioId",
  "asOfDate",
  "period",
  "reportingCurrency",
];

export function assertWorkspaceReviewContextPreserved({
  currentHref,
  destinationHref,
}) {
  const currentUrl = new URL(currentHref, "http://workbench.local");
  const destinationUrl = new URL(destinationHref, "http://workbench.local");
  for (const key of WORKSPACE_REVIEW_CONTEXT_QUERY_KEYS) {
    const currentValues = currentUrl.searchParams.getAll(key);
    const destinationValues = destinationUrl.searchParams.getAll(key);
    if (
      currentValues.length !== destinationValues.length ||
      currentValues.some((value, index) => value !== destinationValues[index])
    ) {
      throw new Error(
        `Advisory Overview proposal review link did not preserve governed ${key} context.`,
      );
    }
  }
}

export async function validateAdvisoryOverviewDecisionSurface(
  page,
  { timeoutMs, sourceRows },
) {
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Adviser priorities",
      exact: true,
    }),
  ).toBeVisible({ timeout: timeoutMs });
  await expect(page.getByTestId("advisory-decision-brief")).toBeVisible({
    timeout: timeoutMs,
  });

  const priorityWorklist = page.getByTestId("advisory-priority-worklist");
  await expect(priorityWorklist).toBeVisible({ timeout: timeoutMs });
  await expect(
    priorityWorklist.getByTestId("advisory-source-window-posture"),
  ).toBeVisible({ timeout: timeoutMs });

  const proposalWorklist = priorityWorklist.getByRole("listbox", {
    name: "Advisory proposal decision worklist",
  });
  await expect(proposalWorklist).toBeVisible({ timeout: timeoutMs });
  const proposalOptions = proposalWorklist.getByRole("option");
  const visibleProposalCount = await proposalOptions.count();
  if (visibleProposalCount < 1) {
    throw new Error(
      "Advisory Overview returned no source-backed proposal rows for canonical proof.",
    );
  }
  const renderedSourceRows = await proposalOptions.evaluateAll((elements) =>
    elements.map((element) => ({
      source: element.getAttribute("data-source") ?? "",
      identity: element.getAttribute("data-source-identity") ?? "",
      state: element.getAttribute("data-source-state") ?? "",
    })),
  );
  assertExactSourceRenderProof({
    screen: "Advisory Overview",
    expectedRows: sourceRows,
    renderedRows: renderedSourceRows,
  });

  const selectedProposal = proposalWorklist.locator(
    '[role="option"][aria-selected="true"]',
  );
  await expect(selectedProposal).toHaveCount(1, { timeout: timeoutMs });
  const selectedDecision = page.getByRole("region", {
    name: "Selected advisory proposal",
  });
  await expect(selectedDecision).toBeVisible({ timeout: timeoutMs });

  const selectedDecisionId = await selectedDecision.getAttribute("id");
  const controlledDecisionId = await selectedProposal.getAttribute("aria-controls");
  const selectedSourceIdentity = await selectedProposal.getAttribute(
    "data-source-identity",
  );
  if (
    !selectedDecisionId ||
    !controlledDecisionId ||
    selectedDecisionId !== controlledDecisionId
  ) {
    throw new Error(
      "Advisory Overview selected proposal is not associated with its decision detail.",
    );
  }

  const proposalReference = (
    await selectedDecision
      .locator('dl[aria-label="Selected proposal evidence"] dd')
      .first()
      .textContent()
  )?.trim();
  if (!proposalReference) {
    throw new Error(
      "Advisory Overview selected proposal has no source proposal reference.",
    );
  }
  if (selectedSourceIdentity !== proposalReference) {
    throw new Error(
      "Advisory Overview selected proposal detail does not match its source-render identity.",
    );
  }
  const proposalReviewLink = selectedDecision.getByRole("link", {
    name: "Open proposal review",
  });
  await expect(proposalReviewLink).toBeVisible({ timeout: timeoutMs });
  const proposalHref = await proposalReviewLink.getAttribute("href");
  const expectedProposalPath = `/proposals/${encodeURIComponent(proposalReference)}`;
  if (!proposalHref) {
    throw new Error(
      "Advisory Overview selected proposal detail has no review destination.",
    );
  }
  if (
    new URL(proposalHref, "http://workbench.local").pathname !==
    expectedProposalPath
  ) {
    throw new Error(
      "Advisory Overview selected proposal detail does not link to its source proposal reference.",
    );
  }
  assertWorkspaceReviewContextPreserved({
    currentHref: page.url(),
    destinationHref: proposalHref,
  });

  return {
    evidencePosture: "selected-source-proposal-through-gateway",
    evidence: {
      visibleProposalCount,
      selectedProposalReference: proposalReference,
      selectedDecisionId,
      sourceRowEvidence: sourceRows,
    },
  };
}

async function validateAdvisoryJourneyRoute(
  page,
  {
    summary,
    workbenchBaseUrl,
    timeoutMs,
    key,
    title,
    route,
    screenshotName,
    panel,
    owner,
    sourcePosture,
    validate,
    screenshotAdvisoryJourney,
  },
) {
  await navigateForBusinessProof(page, route, { timeout: timeoutMs });
  await expect(
    page.getByRole("heading", { name: title, exact: true }).first(),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  const validation = (await validate()) ?? {};
  const state = validation.state ?? "ready";
  const observedRoute = page.url().replace(workbenchBaseUrl, "");
  await screenshotAdvisoryJourney(page, screenshotName, {
    route: observedRoute,
    panel,
    state: classifyAdvisoryJourneyScreenshotState(state),
  });
  recordAdvisoryJourneyCheck(summary, {
    key,
    title,
    route: observedRoute,
    panel,
    owner,
    sourcePosture,
    state,
    ...(validation.evidencePosture
      ? { evidencePosture: validation.evidencePosture }
      : {}),
    ...(validation.evidence ? { evidence: validation.evidence } : {}),
  });
}

async function validateDiscussionPackJourney(page, timeoutMs) {
  await expect(
    page.getByRole("heading", {
      name: "Client meeting preparation",
      exact: true,
    }),
  ).toBeVisible({ timeout: timeoutMs });

  const selectedRecord = page.getByRole("region", {
    name: "Selected discussion pack review",
  });
  const emptyState = page.getByRole("heading", {
    name: "No discussion packs need review",
    exact: true,
  });
  await expect(selectedRecord.or(emptyState)).toBeVisible({
    timeout: timeoutMs,
  });
  const state = classifyDiscussionPackJourneyEvidence({
    selectedRecordCount: await selectedRecord.count(),
    emptyStateCount: await emptyState.count(),
  });
  if (state === "empty") {
    await expect(
      page.getByText(
        "No proposals in this view are awaiting discussion-pack preparation.",
        { exact: true },
      ),
    ).toBeVisible({ timeout: timeoutMs });
    return {
      state,
      evidencePosture: "source-confirmed-empty-window",
    };
  }

  await expect(
    selectedRecord.getByText("Meeting decision", { exact: true }),
  ).toBeVisible({ timeout: timeoutMs });
  await expect(
    selectedRecord.getByRole("heading", {
      name: "Client-discussion checklist",
      exact: true,
    }),
  ).toBeVisible({ timeout: timeoutMs });
  await expect(
    selectedRecord.getByText(
      "Internal approval does not permit client release.",
      { exact: true },
    ),
  ).toBeVisible({ timeout: timeoutMs });
  await expect(
    selectedRecord.getByRole("button", {
      name: /^(Publish|Deliver|Contact client|Record consent)$/i,
    }),
  ).toHaveCount(0);

  await selectedRecord
    .getByRole("button", { name: "Refresh discussion pack", exact: true })
    .click({ timeout: timeoutMs });
  await expect(
    selectedRecord.getByText("Current version available", { exact: true }),
  ).toBeVisible({ timeout: timeoutMs });

  const supportDetails = selectedRecord.getByText("Support details", {
    exact: true,
  });
  await supportDetails.click({ timeout: timeoutMs });
  await expect(
    selectedRecord.getByText("proposal-discussion-pack-review.v1", {
      exact: true,
    }),
  ).toBeVisible({ timeout: timeoutMs });

  return {
    state,
    evidencePosture: "selected-current-version-through-gateway",
  };
}

export async function validateAdvisoryJourneyScreens(
  page,
  {
    summary,
    workbenchBaseUrl,
    portfolioId,
    canonicalIdeaCandidateId,
    canonicalIdeaCandidateLifecycle,
    portfolioWorkspace,
    timeoutMs,
    screenshotAdvisoryJourney,
    assertGridHasRows,
  },
) {
  const expectedIdeaCandidateId = requireLowIncomeIdeaCandidateId(
    canonicalIdeaCandidateId,
  );
  const restartPlan = resolveCanonicalIdeaRestartPlan(
    canonicalIdeaCandidateLifecycle,
  );
  const ideaMutationsAllowed = restartPlan.mutationsAllowed;
  const ideaReviewRequired = restartPlan.reviewRequired;
  const recommendationsRoute = advisoryJourneyRoute({
    workbenchBaseUrl,
    portfolioId,
    path: "/recommendations",
  });
  const opportunitiesRoute = canonicalIdeaOpportunitiesRoute({
    workbenchBaseUrl,
    portfolioId,
    candidateId: expectedIdeaCandidateId,
  });
  const cockpitRoute = advisoryJourneyRoute({
    workbenchBaseUrl,
    portfolioId,
    path: "/recommendations?mode=cockpit",
  });
  const copilotRoute = advisoryJourneyRoute({
    workbenchBaseUrl,
    portfolioId,
    path: "/recommendations?mode=copilot",
  });
  const portfolioRoute = advisoryJourneyRoute({
    workbenchBaseUrl,
    portfolioId,
    path: "/portfolio",
  });
  const proposalBuilderRoute = advisoryJourneyRoute({
    workbenchBaseUrl,
    portfolioId,
    path: "/proposals/simulate",
  });
  const advisoryOverviewResponsePromise = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === "GET" &&
        url.pathname.endsWith("/api/bff/api/v1/proposals") &&
        url.searchParams.get("portfolio_id") === portfolioId &&
        url.searchParams.get("limit") === "8" &&
        !url.searchParams.has("cursor")
      );
    },
    { timeout: timeoutMs },
  );

  await validateAdvisoryJourneyRoute(page, {
    summary,
    workbenchBaseUrl,
    portfolioId,
    timeoutMs,
    key: "overview",
    title: "Advisory Overview",
    route: recommendationsRoute,
    screenshotName: "advisory-overview-live.png",
    panel: "advisory.overview",
    owner: "lotus-advise",
    sourcePosture: "proposal-list-through-gateway",
    screenshotAdvisoryJourney,
    validate: async () => {
      const advisoryOverviewResponse = await advisoryOverviewResponsePromise;
      if (!advisoryOverviewResponse.ok()) {
        throw new Error(
          `Workbench Advisory Overview proposal request failed with HTTP ${advisoryOverviewResponse.status()}.`,
        );
      }
      const sourceRows = buildProposalListSourceRows(
        await advisoryOverviewResponse.json(),
        portfolioId,
      );
      return validateAdvisoryOverviewDecisionSurface(page, {
        timeoutMs,
        sourceRows,
      });
    },
  });

  await validateAdvisoryJourneyRoute(page, {
    summary,
    workbenchBaseUrl,
    portfolioId,
    timeoutMs,
    key: "client-context",
    title: "Portfolio Review",
    route: portfolioRoute,
    screenshotName: "advisory-client-context-live.png",
    panel: "advisory.client_context",
    owner: "lotus-core",
    sourcePosture: "portfolio-context-through-gateway",
    screenshotAdvisoryJourney,
    validate: async () => {
      await expect(
        page.getByRole("region", { name: "Portfolio decision review" }),
      ).toBeVisible({
        timeout: timeoutMs,
      });
      const reviewContext = page.getByRole("region", { name: "Review context" });
      await expect(reviewContext).toBeVisible({ timeout: timeoutMs });
      const mandateFact = reviewContext
        .getByText("Mandate", { exact: true })
        .locator("..");
      const mandateValue = mandateFact.locator("dd");
      await expect(mandateValue).toBeVisible({
        timeout: timeoutMs,
      });
      await expect(mandateValue).toHaveAttribute("data-confirmed", "true");
      const sourceMandate = portfolioWorkspace?.profile?.portfolio_type;
      const renderedMandate = await mandateValue.textContent();
      const mandateEvidence = assertClientContextMandateProof({
        sourceValue: sourceMandate,
        renderedValue: renderedMandate,
      });
      await expect(
        page.getByRole("heading", { name: "Review Evidence", exact: true }),
      ).toBeVisible({
        timeout: timeoutMs,
      });
      return {
        evidencePosture: "source-confirmed-mandate-through-gateway",
        evidence: mandateEvidence,
      };
    },
  });

  const statefulIdeaJourney = {
    summary,
    workbenchBaseUrl,
    portfolioId,
    timeoutMs,
    key: "opportunities",
    title: "Opportunities And Ideas",
    route: opportunitiesRoute,
    screenshotName: "advisory-opportunities-live.png",
    panel: "advisory.opportunities",
    owner: "lotus-idea",
    sourcePosture: "idea-review-queue-through-gateway",
    expectedIdeaCandidateId,
    mutationsAllowed: ideaMutationsAllowed,
    screenshotAdvisoryJourney,
    validate: async () => {
      await expect(page.getByLabel("Idea candidates")).toBeVisible({
        timeout: timeoutMs,
      });
      const queueProofPosture = page.getByLabel("Idea worklist evidence status");
      await expect(queueProofPosture).toContainText(
        "Policy: idea-deterministic-ranking-v1",
        { timeout: timeoutMs },
      );
      await expect(queueProofPosture).toContainText(
        /Evaluated: \d{4}-\d{2}-\d{2}T/,
        { timeout: timeoutMs },
      );
      await expect(queueProofPosture).toContainText(
        "Durable storage: Backed",
        { timeout: timeoutMs },
      );
      if (!ideaMutationsAllowed) {
        const candidateDetailPanel = page.getByLabel(
          "Idea candidate source-safe detail",
        );
        await expect(candidateDetailPanel).toBeVisible({ timeout: timeoutMs });
        const completedLifecycleLabels = {
          approved: "Approved",
          converted_to_proposal: "Converted To Proposal",
          reviewed_by_advisor: "Reviewed By Advisor",
        };
        const expectedLifecycleLabel =
          completedLifecycleLabels[canonicalIdeaCandidateLifecycle];
        if (!expectedLifecycleLabel) {
          throw new Error(
            `Unsupported read-only Idea lifecycle '${canonicalIdeaCandidateLifecycle}'.`,
          );
        }
        await expect(
          candidateDetailPanel.getByText(
            `Lifecycle: ${expectedLifecycleLabel}`,
            { exact: true },
          ),
        ).toBeVisible({ timeout: timeoutMs });
        await expect(
          candidateDetailPanel.getByText(expectedIdeaCandidateId, {
            exact: true,
          }),
        ).toBeVisible({ timeout: timeoutMs });
        summary.uiChecks.push({
          description: "Lotus Idea completed-candidate restart evidence",
          kind: "idea-completed-candidate-browser-proof",
          route: "/recommendations?mode=opportunities",
          owner: "lotus-idea",
          gatewayBacked: true,
          selectedCandidateId: expectedIdeaCandidateId,
          lifecycleStatus: canonicalIdeaCandidateLifecycle,
          sourceRefresh: "read_only_restart_verification",
          nonClaims: [
            "new_review_action",
            "new_conversion_intent",
            "supported_feature_promotion",
          ],
        });
        return {
          evidencePosture: "completed-candidate-detail-through-gateway",
        };
      }
      let canonicalCandidateId = expectedIdeaCandidateId;
      if (ideaReviewRequired) {
        const candidateGrid = page.getByRole("grid", {
          name: "Idea candidate review queue",
          exact: true,
        });
        await assertGridHasRows(
          candidateGrid,
          1,
          "Idea candidate review queue",
        );
        const canonicalCandidateLink = candidateGrid.getByRole("link", {
          name: `Projected Cash Shortfall - ${expectedIdeaCandidateId}`,
          exact: true,
        });
        await expect(canonicalCandidateLink).toBeVisible({ timeout: timeoutMs });
        canonicalCandidateId = resolveLowIncomeIdeaCandidateId(
          await canonicalCandidateLink.getAttribute("href"),
          workbenchBaseUrl,
        );
        if (canonicalCandidateId !== expectedIdeaCandidateId) {
          throw new Error(
            `Idea queue selected '${canonicalCandidateId}' instead of current-run candidate '${expectedIdeaCandidateId}'.`,
          );
        }
        await canonicalCandidateLink.click();
      }
      await expect(page).toHaveURL(
        new RegExp(
          `candidateId=${encodeURIComponent(canonicalCandidateId)}`,
        ),
        { timeout: timeoutMs },
      );
      const candidateDetailPanel = page.getByLabel(
        "Idea candidate source-safe detail",
      );
      await expect(candidateDetailPanel).toBeVisible({ timeout: timeoutMs });
      await expect(
        candidateDetailPanel.getByText(canonicalCandidateId, {
          exact: true,
        }),
      ).toBeVisible({ timeout: timeoutMs });
      await expect(page.getByText(/Lifecycle: (?!Pending).+/)).toBeVisible({
        timeout: timeoutMs,
      });
      await expect(page.getByText(/Sources: [1-9]\d*/)).toBeVisible({
        timeout: timeoutMs,
      });
      await expect(
        candidateDetailPanel.getByText(/Source refs: (?!None).+/),
      ).toBeVisible({ timeout: timeoutMs });
      await expect(
        candidateDetailPanel.getByText(/Source signals: (?!None).+/),
      ).toBeVisible({ timeout: timeoutMs });
      await expect(
        candidateDetailPanel.getByText(
          /Queue policy: idea-deterministic-ranking-v1/,
        ),
      ).toBeVisible({ timeout: timeoutMs });
      await expect(
        candidateDetailPanel.getByText(/Queue evaluated: \d{4}-\d{2}-\d{2}T/),
      ).toBeVisible({ timeout: timeoutMs });
      const ideaDetailHash = candidateDetailPanel
        .getByText(/Evidence hash: sha256:/)
        .first();
      const ideaDetailHashAvailable = (await ideaDetailHash.count()) > 0;
      await expect(
        page.getByText(
          "Candidate detail is unavailable through Gateway. No raw API response is shown.",
        ),
      ).toHaveCount(0);
      await expect(
        page.getByText("Advisor Decision", { exact: true }),
      ).toBeVisible({ timeout: timeoutMs });
      const actionPanel = page.getByLabel("Idea candidate advisor actions");
      await expect(actionPanel).toBeVisible({ timeout: timeoutMs });

      if (ideaReviewRequired) {
        await actionPanel.getByRole("button", { name: "Record feedback" }).click();
        const feedbackStatus = page.getByTestId("idea-action-feedback-status");
        await expect(feedbackStatus).toBeVisible({ timeout: timeoutMs });
        await expect(feedbackStatus).toHaveAttribute(
          "data-action-state",
          "recorded-and-refreshed",
        );
        await expect(feedbackStatus).toContainText(
          "Feedback saved. Opportunity detail and worklist are current.",
        );

        await expect(
          actionPanel.getByRole("button", { name: "Record review" }),
        ).toBeEnabled({ timeout: timeoutMs });
        await actionPanel.getByRole("button", { name: "Record review" }).click();
        const reviewStatus = page.getByTestId("idea-action-review-status");
        await expect(reviewStatus).toBeVisible({ timeout: timeoutMs });
        await expect(reviewStatus).toHaveAttribute(
          "data-action-state",
          "recorded-and-refreshed",
        );
        await expect(reviewStatus).toContainText(
          "Review saved. Opportunity detail and worklist are current.",
        );
      }

      await expect(
        actionPanel.getByRole("button", { name: "Record intent" }),
      ).toBeEnabled({ timeout: timeoutMs });
      await actionPanel.getByRole("button", { name: "Record intent" }).click();
      const conversionStatus = page.getByTestId(
        "idea-action-conversion-status",
      );
      await expect(conversionStatus).toBeVisible({ timeout: timeoutMs });
      await expect(conversionStatus).toHaveAttribute(
        "data-action-state",
        "recorded-and-refreshed",
      );
      await expect(conversionStatus).toContainText(
        "Conversion intent saved. Opportunity detail and worklist are current.",
      );

      summary.uiChecks.push({
        description:
          "Lotus Idea review-action, feedback, and conversion-intent browser controls",
        kind: "idea-action-control-browser-proof",
        route: "/recommendations?mode=opportunities",
        owner: "lotus-idea",
        gatewayBacked: true,
        selectedCandidateId: canonicalCandidateId,
        canonicalCandidateProof:
          "candidate_id_policy_evaluation_source_signal_and_source_ref_verified",
        sourceHashVerified: ideaDetailHashAvailable,
        sourceHashBoundary: ideaDetailHashAvailable
          ? "Idea detail exposed source hash and browser proof observed it."
          : "Idea detail contract did not expose a source hash; no hash-backed deterministic seed claim is made.",
        sourceRefresh: "verified_after_each_mutation",
        actions: restartPlan.actions,
        nonClaims: [
          "production_identity",
          "supported_feature_promotion",
          "client_publication",
          "suitability_approval",
          "proposal_creation",
          "execution_authority",
        ],
      });
    },
  };

  await validateAdvisoryJourneyRoute(page, {
    summary,
    workbenchBaseUrl,
    portfolioId,
    timeoutMs,
    key: "advisor-cockpit",
    title: "Advisor Cockpit",
    route: cockpitRoute,
    screenshotName: "advisory-advisor-cockpit-live.png",
    panel: "advisory.advisor_cockpit",
    owner: "lotus-advise",
    sourcePosture: "advisor-cockpit-actions-through-gateway",
    screenshotAdvisoryJourney,
    validate: async () => {
      await expect(
        page.getByText("Advisor Decision", { exact: true }),
      ).toBeVisible({
        timeout: timeoutMs,
      });
      await expect(page.getByLabel("Advisor cockpit counts")).toBeVisible({
        timeout: timeoutMs,
      });
      await expect(
        page.getByText("Preparation Readiness", { exact: true }).first(),
      ).toBeVisible({
        timeout: timeoutMs,
      });
      await expect(
        page.getByText("Meeting Preparation", { exact: true }).first(),
      ).toBeVisible({
        timeout: timeoutMs,
      });
      await expect(
        page
          .getByRole("button", { name: /Acknowledge review|Acknowledged/ })
          .first(),
      ).toBeVisible({
        timeout: timeoutMs,
      });
      await expect(page.getByText("CLIENT_READY_PUBLICATION")).toHaveCount(0);
    },
  });

  await validateAdvisoryJourneyRoute(page, {
    summary,
    workbenchBaseUrl,
    portfolioId,
    timeoutMs,
    key: "advisory-copilot",
    title: "Advisory Copilot",
    route: copilotRoute,
    screenshotName: "advisory-advisory-copilot-live.png",
    panel: "advisory.advisory_copilot",
    owner: "lotus-advise",
    sourcePosture: "advisory-copilot-through-gateway",
    screenshotAdvisoryJourney,
    validate: async () => {
      const decisionRegion = page.getByTestId("advisory-copilot-decision");
      await expect(decisionRegion).toBeVisible({ timeout: timeoutMs });
      await expect(
        decisionRegion.getByRole("heading", { level: 2 }),
      ).toBeVisible({ timeout: timeoutMs });
      await expect(decisionRegion).toHaveAttribute(
        "aria-labelledby",
        "advisory-copilot-decision-title",
      );
      await expect(page.getByTestId("advisory-copilot-status")).toBeVisible({
        timeout: timeoutMs,
      });
      await expect(page.getByLabel("Advisory copilot actions")).toBeVisible({
        timeout: timeoutMs,
      });
      await page.getByRole("button", { name: "Prepare review" }).first().click();
      const generatedOutput = page.getByTestId("advisory-copilot-output");
      await expect(generatedOutput).toBeVisible({ timeout: timeoutMs });
      await expect(generatedOutput).toHaveAttribute(
        "data-output-section-count",
        /^[1-9]\d*$/,
      );
      await expect(generatedOutput.getByRole("heading").first()).toBeVisible({
        timeout: timeoutMs,
      });
      const humanReview = page.getByTestId("advisory-copilot-human-review");
      await expect(humanReview).toBeVisible({ timeout: timeoutMs });
      await expect(humanReview).toHaveAttribute(
        "data-review-posture",
        /^(REVIEW_REQUIRED|APPROVED_FOR_INTERNAL_USE)$/,
      );
      const internalReviewButton = page.getByRole("button", {
        name: "Record internal review",
      });
      const reviewReadyDeadline = Date.now() + timeoutMs;
      let reviewState = "pending";
      while (Date.now() < reviewReadyDeadline) {
        if (
          (await humanReview.getAttribute("data-review-posture")) ===
          "APPROVED_FOR_INTERNAL_USE"
        ) {
          reviewState = "approved";
          break;
        }
        if (await internalReviewButton.isEnabled().catch(() => false)) {
          reviewState = "reviewable";
          break;
        }
        await page.waitForTimeout(500);
      }
      if (reviewState === "pending") {
        throw new Error(
          "Advisory copilot review never became reviewable or approved.",
        );
      }
      if (reviewState === "reviewable") {
        await internalReviewButton.click();
      }
      await expect(humanReview).toHaveAttribute(
        "data-review-posture",
        "APPROVED_FOR_INTERNAL_USE",
        { timeout: timeoutMs },
      );
      await expect(page.getByText("workflow_pack", { exact: true })).toHaveCount(0);
      await expect(
        page.getByText("PROPOSAL_EXPLANATION", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByText("CLIENT_READY_PUBLICATION", { exact: true }),
      ).toHaveCount(0);
    },
  });

  await validateAdvisoryJourneyRoute(page, {
    summary,
    workbenchBaseUrl,
    portfolioId,
    timeoutMs,
    key: "proposal-builder",
    title: "Proposal Workspace",
    route: proposalBuilderRoute,
    screenshotName: "advisory-proposal-builder-live.png",
    panel: "advisory.proposal_builder",
    owner: "lotus-advise",
    sourcePosture: "portfolio-book-and-workspace-evaluation-through-gateway",
    screenshotAdvisoryJourney,
    validate: async () => {
      await expect(page.getByText("Create Advisory Proposal")).toBeVisible({
        timeout: timeoutMs,
      });
      await expect(page.getByText("Current Positions")).toBeVisible({
        timeout: timeoutMs,
      });
      await expect(page.getByText("Draft Order Blotter")).toBeVisible({
        timeout: timeoutMs,
      });
      await expect(
        page.getByRole("button", { name: "Evaluate Workspace" }),
      ).toBeVisible({
        timeout: timeoutMs,
      });
      await page
        .getByRole("button", { name: "Evaluate Workspace" })
        .click({ timeout: timeoutMs });
      await expect(
        page.getByRole("status", { name: "Proposal evaluation summary" }),
      ).toContainText("Advise Evaluation Summary", {
        timeout: timeoutMs,
      });
    },
  });

  for (const lifecycle of [
    {
      key: "suitability",
      title: "Suitability review",
      screenshotName: "advisory-suitability-review-live.png",
      panel: "advisory.suitability_review",
      sourcePosture: "proposal-lifecycle-through-gateway",
    },
    {
      key: "risk-impact",
      title: "Risk and Impact",
      screenshotName: "advisory-risk-impact-live.png",
      panel: "advisory.risk_impact",
      sourcePosture: "risk-review-proposals-through-gateway",
    },
    {
      key: "approval-queue",
      title: "Approval Queue",
      screenshotName: "advisory-approval-queue-live.png",
      panel: "advisory.approval_queue",
      sourcePosture: "proposal-approval-queue-through-gateway",
    },
    {
      key: "discussion-pack",
      title: "Discussion pack review",
      screenshotName: "advisory-client-discussion-pack-live.png",
      panel: "advisory.client_discussion_pack",
      sourcePosture: "discussion-pack-posture-through-gateway",
      validateEvidence: async () =>
        await validateDiscussionPackJourney(page, timeoutMs),
    },
    {
      key: "implementation",
      title: "Implementation Status",
      screenshotName: "advisory-implementation-status-live.png",
      panel: "advisory.implementation_status",
      sourcePosture: "implementation-follow-up-through-gateway",
    },
  ]) {
    const route = advisoryJourneyRoute({
      workbenchBaseUrl,
      portfolioId,
      path: `/proposals?mode=${lifecycle.key}`,
    });
    await validateAdvisoryJourneyRoute(page, {
      summary,
      workbenchBaseUrl,
      portfolioId,
      timeoutMs,
      ...lifecycle,
      owner: "lotus-advise",
      route,
      screenshotAdvisoryJourney,
      validate: async () => {
        if (lifecycle.key === "suitability") {
          await expect(page.getByLabel("Suitability review counts")).toBeVisible({
            timeout: timeoutMs,
          });
          await expect(
            page.getByRole("heading", {
              name: "Adviser decision worklist",
              exact: true,
            }),
          ).toBeVisible({ timeout: timeoutMs });
        } else {
          await expect(page.getByLabel("Proposal lifecycle counts")).toBeVisible({
            timeout: timeoutMs,
          });
          await expect(
            page.getByText("Adviser decision", { exact: true }),
          ).toBeVisible({ timeout: timeoutMs });
        }
        return await lifecycle.validateEvidence?.();
      },
    });
  }

  // The caller executes this single-use mutation proof only after every
  // read-only browser check has passed. Returning the prepared journey keeps
  // candidate identity and source assertions bound to this canonical run.
  return statefulIdeaJourney;
}

export async function validateCanonicalIdeaJourney(page, preparedJourney) {
  const expectedIdeaCandidateId = requireLowIncomeIdeaCandidateId(
    preparedJourney.expectedIdeaCandidateId,
  );
  const candidateDetailResponsePromise = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === "GET" &&
        url.pathname.endsWith(
          `/api/bff/api/v1/ideas/candidates/${encodeURIComponent(expectedIdeaCandidateId)}`,
        )
      );
    },
    { timeout: preparedJourney.timeoutMs },
  );
  const presentationReceiptResponsePromise = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === "POST" &&
        url.pathname.endsWith(
          `/api/bff/api/v1/ideas/candidates/${encodeURIComponent(expectedIdeaCandidateId)}/presentation-receipts`,
        )
      );
    },
    { timeout: preparedJourney.timeoutMs },
  );
  await validateAdvisoryJourneyRoute(page, preparedJourney);
  const candidateDetailResponse = await candidateDetailResponsePromise;
  if (!candidateDetailResponse.ok()) {
    throw new Error(
      `Workbench Idea candidate detail request failed with HTTP ${candidateDetailResponse.status()}.`,
    );
  }
  const detailEnvelope = requireCanonicalRecord(
    await candidateDetailResponse.json(),
    "Idea candidate detail response",
  );
  const detail = requireCanonicalRecord(
    detailEnvelope.data ?? detailEnvelope,
    "Idea candidate detail response data",
  );
  const detailCandidate = requireCanonicalRecord(
    detail.candidate,
    "Idea candidate detail identity",
  );
  if (detailCandidate.candidateId !== expectedIdeaCandidateId) {
    throw new Error("Canonical Idea candidate detail changed candidate identity.");
  }
  const detailEvidence = requireCanonicalRecord(
    detail.evidence,
    "Idea candidate detail evidence",
  );
  const presentationReceiptResponse = await presentationReceiptResponsePromise;
  if (!presentationReceiptResponse.ok()) {
    throw new Error(
      `Workbench Idea presentation receipt failed with HTTP ${presentationReceiptResponse.status()}.`,
    );
  }
  const presentationEvidence = assertCanonicalIdeaPresentationReceiptEvidence({
    expectedCandidateId: expectedIdeaCandidateId,
    expectedSourceLineage: {
      sourceRevisionVectorDigest: detailEvidence.sourceRevisionVectorDigest,
      sourceCutPosture: detailEvidence.sourceCutPosture,
    },
    idempotencyKey: await presentationReceiptResponse
      .request()
      .headerValue("idempotency-key"),
    requestBody: presentationReceiptResponse.request().postDataJSON(),
    responseBody: await presentationReceiptResponse.json(),
  });
  preparedJourney.summary.uiChecks.push({
    description: "Source-owned Idea candidate presentation receipt",
    kind: "idea-presentation-receipt-browser-proof",
    route: "/recommendations?mode=opportunities",
    owner: "lotus-idea",
    gatewayBacked: true,
    evidence: presentationEvidence,
    nonClaims: [
      "browser_tenant_authority",
      "effectiveness_outcome",
      "supported_feature_promotion",
    ],
  });
}

export async function validateCompletedCanonicalIdeaJourney(
  page,
  preparedJourney,
) {
  if (preparedJourney.mutationsAllowed) {
    throw new Error(
      "Completed Idea journey validation refuses a mutation-enabled candidate.",
    );
  }
  await validateAdvisoryJourneyRoute(page, preparedJourney);
}

export async function validatePortfolioPanels(
  page,
  {
    workbenchBaseUrl,
    portfolioId,
    timeoutMs,
    screenshotRegisteredPanel,
  },
) {
  await navigateForBusinessProof(page, `${workbenchBaseUrl}/portfolio?portfolioId=${portfolioId}`, {
    timeout: timeoutMs,
  });
  await expect(
    page.getByRole("heading", { name: "Portfolio Review", exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    page.getByRole("region", { name: "Portfolio decision review" }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  const reviewContext = page.getByRole("region", { name: "Review context" });
  const reviewContextStrip = page.getByTestId("review-context-strip");
  await expect(reviewContext).toBeVisible({ timeout: timeoutMs });
  await expect(reviewContextStrip.locator("strong").first()).toHaveText(
    portfolioId,
    { timeout: timeoutMs },
  );
  await expect(
    reviewContext.getByText("Mandate", { exact: true }),
  ).toBeVisible({ timeout: timeoutMs });
  await expect(
    reviewContext.getByText("Business date", { exact: true }),
  ).toBeVisible({ timeout: timeoutMs });
  await expect(page.getByText("MTD return", { exact: true })).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(page.getByText("QTD return", { exact: true })).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(page.getByText("YTD return", { exact: true })).toBeVisible({
    timeout: timeoutMs,
  });
  const decisionReview = page.getByRole("region", {
    name: "Portfolio decision review",
  });
  await expect(
    decisionReview.locator(".workbench-decision-brief-primary h3"),
  ).toBeVisible({ timeout: timeoutMs });
  await expect(
    decisionReview.getByText("Portfolio readiness", { exact: true }),
  ).toBeVisible({ timeout: timeoutMs });
  await expect(
    decisionReview.getByLabel(/^Status (Ready|Partial|Unavailable)$/),
  ).toBeVisible({ timeout: timeoutMs });
  await expect(
    decisionReview.getByText("Reporting coverage", { exact: true }),
  ).toBeVisible({ timeout: timeoutMs });
  await expect(
    page.getByRole("heading", { name: "Review Evidence", exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    page.getByRole("heading", { name: "Performance Snapshot", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Summary" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Detailed" })).toHaveCount(0);
  await screenshotRegisteredPanel(page, "portfolio.summary");
}

export function buildReportCentreProofPosture(pdfOutputReady) {
  if (pdfOutputReady) {
    return {
      panelState: "partial",
      outputFormat: "pdf",
      pdfOutputState: "ready",
      reason:
        "Structured report data and governed PDF creation are available for advisor review; archive retention and client delivery remain separate controls.",
    };
  }

  return {
    panelState: "partial",
    outputFormat: "json",
    pdfOutputState: "unavailable",
    reason:
      "Structured report data is available while governed PDF creation remains unavailable; archive retention and client delivery remain separate controls.",
  };
}

export async function validateReportCentrePanel(
  page,
  {
    workbenchBaseUrl,
    portfolioId,
    timeoutMs,
    assertListHasItems,
    assertTableHasRows,
  },
) {
  await navigateForBusinessProof(page, `${workbenchBaseUrl}/reports?portfolioId=${portfolioId}`, {
    timeout: timeoutMs,
  });
  await expect(
    page.getByRole("heading", { name: "Report centre", exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(page.getByRole("heading", { name: "Approved report", exact: true })).toBeVisible({
    timeout: timeoutMs,
  });
  const structuredDataRadio = page.getByRole("radio", {
    name: /Structured data package/,
  });
  const governedPdfRadio = page.getByRole("radio", {
    name: /Governed PDF document/,
  });
  await expect(structuredDataRadio).toBeVisible({ timeout: timeoutMs });
  await expect(governedPdfRadio).toBeVisible({ timeout: timeoutMs });
  const reportCentreProof = buildReportCentreProofPosture(
    !(await governedPdfRadio.isDisabled()),
  );

  if (reportCentreProof.pdfOutputState === "ready") {
    await governedPdfRadio.check({ timeout: timeoutMs });
    await expect(governedPdfRadio).toBeChecked({ timeout: timeoutMs });
    await expect(
      page.getByText("Governed document creation is available."),
    ).toBeVisible({ timeout: timeoutMs });
  } else {
    await expect(structuredDataRadio).toBeChecked({ timeout: timeoutMs });
    await expect(governedPdfRadio).toBeDisabled({ timeout: timeoutMs });
    await expect(
      page.getByText(/PDF creation is temporarily unavailable/),
    ).toBeVisible({ timeout: timeoutMs });
  }
  await expect(page.getByText("Review before any client use")).toBeVisible({
    timeout: timeoutMs,
  });

  await page.getByRole("button", { name: "Review Request" }).click({
    timeout: timeoutMs,
  });
  const submitButton = page.getByRole("button", {
    name: "Submit Report Request",
  });
  await expect(submitButton).toBeEnabled({ timeout: timeoutMs });
  await submitButton.click({ timeout: timeoutMs });
  const requestReadiness = page.getByRole("region", {
    name: "Report request readiness",
  });
  await expect(
    requestReadiness.getByRole("heading", {
      name: "Report request accepted",
      exact: true,
    }),
  ).toBeVisible({ timeout: timeoutMs });
  await expect(requestReadiness.getByRole("status")).toContainText(
    "Reporting recorded the request.",
    { timeout: timeoutMs },
  );
  await expect(
    page.getByRole("button", { name: "Submit Report Request" }),
  ).toHaveCount(0);
  const requestHistoryTable = tableByExactLabel(
    page,
    "Recent portfolio report requests",
  );
  if (await requestHistoryTable.isVisible()) {
    await assertTableHasRows(
      requestHistoryTable,
      1,
      "Recent portfolio report requests",
    );
  } else {
    await assertListHasItems(
      page.getByRole("list", {
        name: "Recent portfolio report request details",
      }),
      "Recent portfolio report request details",
    );
  }
  return reportCentreProof;
}

export async function validateAdvisorBookPanel(
  page,
  {
    summary,
    workbenchBaseUrl,
    portfolioId,
    canonicalAsOfDate,
    timeoutMs,
    assertTableHasRows,
    screenshotRegisteredPanel,
  },
) {
  const advisorBookPageResponsePromise = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === "GET" &&
        url.pathname.endsWith("/api/bff/api/v1/advisor-book/portfolios") &&
        url.searchParams.get("asOfDate") === canonicalAsOfDate &&
        url.searchParams.get("offset") === String(ADVISOR_BOOK_BROWSER_PAGE.offset) &&
        url.searchParams.get("limit") === String(ADVISOR_BOOK_BROWSER_PAGE.limit) &&
        url.searchParams.get("sortBy") === ADVISOR_BOOK_BROWSER_PAGE.sortBy &&
        url.searchParams.get("sortOrder") === ADVISOR_BOOK_BROWSER_PAGE.sortOrder
      );
    },
    { timeout: timeoutMs },
  );
  await navigateForBusinessProof(page, `${workbenchBaseUrl}/book?asOfDate=${canonicalAsOfDate}`, {
    timeout: timeoutMs,
  });
  const advisorBookPageResponse = await advisorBookPageResponsePromise;
  if (!advisorBookPageResponse.ok()) {
    throw new Error(
      `Workbench Advisor Book page request failed with HTTP ${advisorBookPageResponse.status()}.`,
    );
  }
  const advisorBookPage = validateAdvisorBookRenderPageEvidence(
    await advisorBookPageResponse.json(),
    {
      expectedAsOfDate: canonicalAsOfDate,
      expectedOffset: ADVISOR_BOOK_BROWSER_PAGE.offset,
      expectedLimit: ADVISOR_BOOK_BROWSER_PAGE.limit,
      expectedSortBy: ADVISOR_BOOK_BROWSER_PAGE.sortBy,
      expectedSortOrder: ADVISOR_BOOK_BROWSER_PAGE.sortOrder,
    },
  );
  await expect(page.getByRole("heading", { name: "My book", exact: true })).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(page.getByText("Own book", { exact: true })).toBeVisible({
    timeout: timeoutMs,
  });
  const bookTable = tableByExactLabel(page, "Portfolios in my book");
  await assertTableHasRows(bookTable, 1, "Portfolios in my book");
  const expectedBookRows = advisorBookPage.sourceRows;
  const renderedBookRows = bookTable.locator('[data-advisor-book-row="portfolio"]');
  await expect(renderedBookRows).toHaveCount(expectedBookRows.length, {
    timeout: timeoutMs,
  });
  for (let index = 0; index < expectedBookRows.length; index += 1) {
    await expect(renderedBookRows.nth(index)).toBeVisible({ timeout: timeoutMs });
  }
  const renderedBookEvidence = await renderedBookRows.evaluateAll((elements) =>
    elements.map((element) => ({
      source: "advisor-book",
      identity: element.getAttribute("data-portfolio-id") ?? "",
      state: element.getAttribute("data-lifecycle-state") ?? "",
    })),
  );
  assertExactSourceRenderProof({
    screen: "Advisor Book",
    expectedRows: expectedBookRows,
    renderedRows: renderedBookEvidence,
  });
  summary.uiChecks.push({
    description: "Exact Gateway-owned Advisor Book rows",
    kind: "advisor-book-source-render-proof",
    portfolioId,
    sourcePageEvidence: {
      asOfDate: advisorBookPage.asOfDate,
      totalCount: advisorBookPage.totalCount,
      offset: advisorBookPage.offset,
      limit: advisorBookPage.limit,
      returnedCount: advisorBookPage.returnedCount,
      sortBy: advisorBookPage.sortBy,
      sortOrder: advisorBookPage.sortOrder,
    },
    sourceRowEvidence: expectedBookRows,
    browserPolicyCalculation: "none",
  });
  const canonicalPortfolioLink = bookTable
    .locator(`a[href*="portfolioId=${encodeURIComponent(portfolioId)}"]`)
    .first();
  await expect(canonicalPortfolioLink).toBeVisible({ timeout: timeoutMs });
  const operatingEvidence = page.getByTestId("advisor-book-operating-evidence");
  await expect(operatingEvidence).toBeVisible({ timeout: timeoutMs });
  await expect(operatingEvidence).not.toHaveAttribute("open", "");
  await operatingEvidence.locator("summary").click();
  await expect(operatingEvidence).toHaveAttribute("open", "");
  await expect(
    operatingEvidence.getByRole("heading", {
      name: "Operating boundaries",
      exact: true,
    }),
  ).toBeVisible({ timeout: timeoutMs });
  await expect(
    operatingEvidence.getByRole("heading", {
      name: "Support references",
      exact: true,
    }),
  ).toBeVisible({ timeout: timeoutMs });
  await screenshotRegisteredPanel(page, "advisor.book_overview");
}

export async function validatePerformanceSummaryPanel(
  page,
  {
    workbenchBaseUrl,
    portfolioId,
    benchmarkCode,
    canonicalStartDate,
    canonicalAsOfDate,
    timeoutMs,
    assertTableHasRows,
    screenshotRegisteredPanel,
  },
) {
  await navigateForBusinessProof(page,
    `${workbenchBaseUrl}/performance?portfolioId=${portfolioId}&period=EXPLICIT&detailBasis=NET&benchmark=${benchmarkCode}&reportStartDate=${canonicalStartDate}&reportEndDate=${canonicalAsOfDate}`,
    {
      timeout: timeoutMs,
    },
  );
  await expect(
    page.getByRole("heading", { name: "Performance", exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await assertRailModeActive(page, /^Performance overview/, timeoutMs);
  await expect(
    page.getByRole("heading", {
      name: "Time-weighted return path · Net of fees",
      exact: true,
    }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    page.getByRole("heading", { name: "Performance Drivers", exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  const returnHistoryTitle = page.getByText("Return history", { exact: true });
  await expect(returnHistoryTitle).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(returnHistoryTitle.locator("..")).toContainText(
    /\d+\s+periods?/i,
    { timeout: timeoutMs },
  );
  await assertTableHasRows(
    tableByExactLabel(page, "Return path observation table"),
    4,
    "Return path observation table",
    { requireVisible: false },
  );
  await screenshotRegisteredPanel(page, "performance.summary");
}

export async function validatePerformanceAnalysisPanel(
  page,
  {
    workbenchBaseUrl,
    portfolioId,
    benchmarkCode,
    canonicalStartDate,
    canonicalAsOfDate,
    timeoutMs,
    assertTableHasRows,
    recordUiCheck,
    screenshotRegisteredPanel,
  },
) {
  await navigateForBusinessProof(page,
    `${workbenchBaseUrl}/performance?portfolioId=${portfolioId}&mode=analysis&period=EXPLICIT&detailBasis=NET&contributionDimension=asset_class&attributionDimension=asset_class&benchmark=${benchmarkCode}&reportStartDate=${canonicalStartDate}&reportEndDate=${canonicalAsOfDate}`,
    { timeout: timeoutMs },
  );
  await assertRailModeActive(page, /^Performance analysis/, timeoutMs);
  const attributionTrendEvidence = page.getByTestId("attribution-trend-evidence");
  await expect(attributionTrendEvidence).toBeVisible({ timeout: timeoutMs });
  await expect(attributionTrendEvidence).not.toHaveAttribute(
    "data-state",
    "loading",
    { timeout: timeoutMs },
  );
  let attributionTrendPosture = await attributionTrendEvidence.getAttribute("data-state");
  if (attributionTrendPosture === "error") {
    await expect(
      attributionTrendEvidence.getByText(
        "Attribution history could not be refreshed",
        { exact: true },
      ),
    ).toBeVisible({ timeout: timeoutMs });
    await page.getByRole("button", { name: "Refresh history" }).click({
      timeout: timeoutMs,
    });
    await expect
      .poll(
        () => attributionTrendEvidence.getAttribute("data-state"),
        { timeout: timeoutMs },
      )
      .toMatch(/^(multi-observation|single-observation)$/);
    attributionTrendPosture = await attributionTrendEvidence.getAttribute("data-state");
    recordUiCheck({
      description: "Attribution history exact-selection recovery",
      kind: "source-retry",
      posture: attributionTrendPosture,
    });
  }
  if (attributionTrendPosture === "multi-observation") {
    await expect(
      page.getByRole("heading", { name: "Attribution Over Time", exact: true }),
    ).toBeVisible({ timeout: timeoutMs });
    await expect(
      page.getByRole("img", { name: "Attribution over time chart", exact: true }),
    ).toBeVisible({ timeout: timeoutMs });
    await assertTableHasRows(
      page.locator('table[aria-label="Attribution trend table"]'),
      2,
      "Attribution trend table",
    );
  } else if (attributionTrendPosture === "single-observation") {
    await expect(attributionTrendEvidence).toHaveAttribute("data-observation-count", "1");
    await expect(
      page.getByRole("heading", { name: "Attribution Observation", exact: true }),
    ).toBeVisible({ timeout: timeoutMs });
    await assertTableHasRows(
      page.locator('table[aria-label="Attribution observation table"]'),
      1,
      "Attribution observation table",
    );
  } else {
    throw new Error(
      `Performance analysis attribution history must be source-confirmed evidence, received ${attributionTrendPosture ?? "missing"}.`,
    );
  }
  recordUiCheck({
    description: "Attribution history evidence",
    kind: "supportability",
    posture: attributionTrendPosture,
  });
  await expect(
    page.getByRole("heading", { name: "Attribution Detail", exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    page.getByRole("heading", { name: "Performance Drivers", exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  const attributionDetailTable = tableByExactLabel(
    page,
    "Asset Class attribution table",
  );
  const attributionSummaryTable = tableByExactLabel(
    page,
    "Asset Class attribution totals",
  );
  const partialFallbackHeading = page.getByRole("heading", {
    name: "Attribution detail is partial",
    exact: true,
  });
  const readyEmptyState = page.getByText(
    "Attribution detail is marked available, but no segment attribution levels were returned for the current selection.",
    { exact: true },
  );
  const attributionEvidence = classifyAttributionDetailEvidence({
    detailTableCount: await attributionDetailTable.count(),
    summaryTableCount: await attributionSummaryTable.count(),
    partialFallbackCount: await partialFallbackHeading.count(),
    readyEmptyStateCount: await readyEmptyState.count(),
  });
  if (attributionEvidence === "detail_rows") {
    await assertTableHasRows(attributionDetailTable, 1, "Attribution detail table");
  } else if (attributionEvidence === "summary_fallback") {
    await assertTableHasRows(attributionSummaryTable, 1, "Attribution summary fallback table");
  } else if (attributionEvidence === "governed_partial_fallback") {
    await expect(partialFallbackHeading).toBeVisible({ timeout: timeoutMs });
  } else {
    await expect(readyEmptyState).toBeVisible({ timeout: timeoutMs });
  }
  recordUiCheck({
    description: "Attribution detail evidence",
    kind: "supportability",
    posture: attributionEvidence,
  });
  const performanceDriversPanel = page.locator("#performance-drivers").first();
  await expect(performanceDriversPanel).toBeVisible({ timeout: timeoutMs });
  await performanceDriversPanel.scrollIntoViewIfNeeded();
  const positionContributionTable = performanceDriversPanel.locator(
    'table[aria-label="Position contribution table"]',
  );
  const segmentContributionTable = performanceDriversPanel.locator(
    'table[aria-label="Asset Class contribution table"]',
  );
  const governedContributionPartial = performanceDriversPanel.getByText(
    "Contribution detail is marked available, but no position or segment contribution rows were returned for the current selection.",
    { exact: true },
  );
  let contributionEvidence = null;
  await expect
    .poll(
      async () => {
        try {
          contributionEvidence = classifyContributionDetailEvidence({
            positionTableVisible: await positionContributionTable.isVisible(),
            segmentTableVisible: await segmentContributionTable.isVisible(),
            governedPartialVisible: await governedContributionPartial.isVisible(),
          });
          return true;
        } catch {
          return false;
        }
      },
      { timeout: timeoutMs },
    )
    .toBe(true);
  const positionsTab = performanceDriversPanel.getByRole("tab", {
    name: /^Positions/i,
  });
  const segmentSummaryTab = performanceDriversPanel.getByRole("tab", {
    name: /^Segment Summary/i,
  });
  if (contributionEvidence === "position_rows") {
    await expect(positionsTab).toBeVisible({ timeout: timeoutMs });
    await expect(positionsTab).toHaveAttribute("aria-selected", "true");
    await assertTableHasRows(
      positionContributionTable,
      1,
      "Position contribution detail table",
    );
    if (
      (await segmentSummaryTab.count()) > 0 &&
      (await segmentSummaryTab.isEnabled())
    ) {
      await segmentSummaryTab.scrollIntoViewIfNeeded();
      await segmentSummaryTab.click({ timeout: timeoutMs });
      await assertTableHasRows(
        segmentContributionTable,
        1,
        "Segment contribution detail table",
      );
    }
  } else if (contributionEvidence === "segment_rows") {
    await expect(segmentSummaryTab).toBeVisible({ timeout: timeoutMs });
    await expect(segmentSummaryTab).toHaveAttribute("aria-selected", "true");
    await assertTableHasRows(
      segmentContributionTable,
      1,
      "Segment contribution detail table",
    );
  } else {
    await expect(governedContributionPartial).toBeVisible({ timeout: timeoutMs });
  }
  recordUiCheck({
    description: "Contribution detail evidence",
    kind: "supportability",
    posture: contributionEvidence,
  });
  await screenshotRegisteredPanel(page, "performance.analysis.contribution");
}

export async function validateAdvisorBriefPanel(
  page,
  {
    summary,
    workbenchBaseUrl,
    portfolioId,
    benchmarkCode,
    canonicalStartDate,
    canonicalAsOfDate,
    timeoutMs,
    screenshotRegisteredPanel,
    performAcceptReviewActionProof = false,
  },
) {
  const buildAdvisorBriefRoute = ({ detailBasis, chartFrequency }) =>
    `${workbenchBaseUrl}/performance?portfolioId=${portfolioId}&mode=advisor&period=EXPLICIT&detailBasis=${detailBasis}&chartFrequency=${chartFrequency}&benchmark=${benchmarkCode}&reportStartDate=${canonicalStartDate}&reportEndDate=${canonicalAsOfDate}`;
  let proofQuery = { detailBasis: "NET", chartFrequency: "monthly" };
  await navigateForBusinessProof(page,
    buildAdvisorBriefRoute(proofQuery),
    { timeout: timeoutMs },
  );
  await assertRailModeActive(page, /^Adviser brief/, timeoutMs);
  await expect(
    page.getByRole("heading", { name: "Performance adviser brief", exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    page.getByRole("heading", { name: "Adviser talking points", exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    page.getByRole("heading", { name: "Key source metrics", exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  const sourceMetricButtons = await page
    .getByRole("region", { name: "Source metrics", exact: true })
    .getByRole("button")
    .count();
  if (sourceMetricButtons < 3) {
    throw new Error(
      `Adviser brief source metrics expected at least 3 metric buttons but found ${sourceMetricButtons}.`,
    );
  }
  summary.uiChecks.push({
    description: "Adviser brief source metrics",
    kind: "buttons",
    buttonCount: sourceMetricButtons,
  });
  await screenshotRegisteredPanel(page, "performance.advisor_brief");

  if (performAcceptReviewActionProof) {
    let reviewRegion = page.getByLabel("Adviser brief human review", { exact: true });
    let supportabilityRegion = page.getByLabel(
      "Adviser brief supportability",
      { exact: true },
    );
    await expect(reviewRegion).toBeVisible({ timeout: timeoutMs });
    await expect(supportabilityRegion).toBeVisible({ timeout: timeoutMs });
    const expectedReviewer = "live.validator.ui";
    let reviewEvidence = await readAdvisorBriefReviewEvidence(
      supportabilityRegion,
    );
    let proofPosture = classifyAdvisorBriefAcceptProofPosture(
      reviewEvidence,
      expectedReviewer,
    );
    if (
      proofPosture === "accepted-by-another-reviewer" ||
      proofPosture === "review-action-unavailable"
    ) {
      proofQuery = { detailBasis: "GROSS", chartFrequency: "quarterly" };
      await navigateForBusinessProof(page, buildAdvisorBriefRoute(proofQuery), {
        timeout: timeoutMs,
      });
      await assertRailModeActive(page, /^Adviser brief/, timeoutMs);
      reviewRegion = page.getByLabel("Adviser brief human review", { exact: true });
      supportabilityRegion = page.getByLabel("Adviser brief supportability", {
        exact: true,
      });
      await expect(reviewRegion).toBeVisible({ timeout: timeoutMs });
      await expect(supportabilityRegion).toBeVisible({ timeout: timeoutMs });
      reviewEvidence = await readAdvisorBriefReviewEvidence(
        supportabilityRegion,
      );
      proofPosture = classifyAdvisorBriefAcceptProofPosture(
        reviewEvidence,
        expectedReviewer,
      );
      if (
        proofPosture === "accepted-by-another-reviewer" ||
        proofPosture === "review-action-unavailable"
      ) {
        throw new Error(
          `Adviser brief browser ACCEPT proof could not reserve an actionable GROSS fallback run (posture: ${proofPosture}).`,
        );
      }
    }
    const existingRecordedAccept =
      proofPosture === "source-confirmed-existing-action";
    if (!existingRecordedAccept) {
      const reviewDecision = reviewRegion.getByLabel("Review decision");
      await expect(reviewDecision).toBeVisible({ timeout: timeoutMs });
      await reviewDecision.selectOption("ACCEPT");
      await reviewRegion
        .getByLabel("Reviewer reference")
        .fill(expectedReviewer);
      await reviewRegion
        .getByLabel("Review rationale")
        .fill(
          "Live canonical validator proving the Workbench ACCEPT review path.",
        );
      await reviewRegion
        .getByRole("button", { name: "Review decision", exact: true })
        .click();
      const confirmAcceptance = reviewRegion.getByRole("button", {
        name: "Confirm acceptance",
        exact: true,
      });
      await expect(confirmAcceptance).toBeVisible({ timeout: timeoutMs });
      await confirmAcceptance.click();
      await waitForAdvisorBriefReviewConfirmation(reviewRegion, { timeoutMs });
    }
    await expect
      .poll(
        async () =>
          hasRecordedAdvisorBriefAcceptProof(
            await readAdvisorBriefReviewEvidence(supportabilityRegion),
            expectedReviewer,
          ),
        {
          timeout: timeoutMs,
        },
      )
      .toBe(true);
    const recordedReviewEvidence = await readAdvisorBriefReviewEvidence(
      supportabilityRegion,
    );
    const reviewEvidenceRow = supportabilityRegion.getByTestId(
      "advisor-brief-human-review-evidence",
    );
    await expect(reviewEvidenceRow).toHaveAttribute(
      "data-reviewer",
      expectedReviewer,
      { timeout: timeoutMs },
    );
    summary.uiChecks.push({
      description: "Adviser brief ACCEPT review action",
      kind: "workflow-pack-review-action",
      actionType: "ACCEPT",
      state: "accepted",
      proofSource: existingRecordedAccept
        ? "source-confirmed-existing-action"
        : "workbench-review-action",
      detailBasis: proofQuery.detailBasis,
      chartFrequency: proofQuery.chartFrequency,
      reviewState: recordedReviewEvidence.reviewState,
      supportability: recordedReviewEvidence.supportability,
      reviewer: recordedReviewEvidence.reviewer,
      recordedAt: recordedReviewEvidence.recordedAt,
    });
    return proofQuery;
  }

  return null;
}

export async function validateProposalNarrativePosturePanel(
  page,
  {
    summary,
    workbenchBaseUrl,
    proposalId,
    timeoutMs,
    screenshotRegisteredPanel,
  },
) {
  await navigateForBusinessProof(page,
    `${workbenchBaseUrl}/proposals/${encodeURIComponent(proposalId)}`,
    {
      timeout: timeoutMs,
    },
  );
  await expect(
    page.getByRole("heading", { name: new RegExp(`Proposal ${proposalId}`) }),
  ).toBeVisible({
    timeout: timeoutMs,
  });

  await page.getByRole("tab", { name: "Narrative review" }).click();
  const narrativePanel = page.locator("#proposal-narrative-review");
  await expect(narrativePanel).toBeVisible({ timeout: timeoutMs });
  await expect(
    narrativePanel.getByRole("heading", {
      name: "Narrative review and discussion pack",
      exact: true,
    }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(narrativePanel.getByLabel("Narrative review workflow")).toBeVisible({
    timeout: timeoutMs,
  });
  const reviewDetails = narrativePanel.locator("details").filter({
    hasText: "Review record details",
  });
  if ((await reviewDetails.getAttribute("open")) === null) {
    await reviewDetails.locator("summary").click();
  }
  await narrativePanel
    .getByRole("textbox", { name: "Reviewer reference" })
    .fill("canonical_front_office_validator");
  await narrativePanel
    .getByRole("textbox", { name: "Advisor review rationale" })
    .fill(
      "Live canonical validator approved this advisor-use narrative from Gateway evidence.",
    );
  await narrativePanel
    .getByRole("button", { name: "Record advisor review" })
    .click();
  await expect(
    narrativePanel.getByTestId("proposal-narrative-action-status"),
  ).toContainText("Advisor review confirmed", { timeout: timeoutMs });
  const requestDiscussionPack = narrativePanel.getByRole("button", {
    name: "Request discussion pack",
  });
  let discussionPackState = "source-confirmed-existing-discussion-pack";
  if (await requestDiscussionPack.isEnabled()) {
    await requestDiscussionPack.click();
    await expect(
      narrativePanel.getByTestId("proposal-narrative-action-status"),
    ).toContainText("Discussion-pack request confirmed", { timeout: timeoutMs });
    discussionPackState = "source-confirmed-discussion-pack-request";
  }
  await expect(
    narrativePanel.getByText(/^sha256:/).first(),
  ).toBeVisible({
    timeout: timeoutMs,
  });

  summary.uiChecks.push({
    description: "Proposal narrative posture review and report package",
    kind: "proposal-narrative-posture",
    proposalId,
    reviewState: "source-confirmed-advisor-use",
    reportPackageState: discussionPackState,
  });
  await screenshotRegisteredPanel(page, "proposal.narrative_posture", {
    route: `/proposals/${proposalId}`,
  });
}

export async function validateProposalMemoEvidencePackPanel(
  page,
  {
    summary,
    workbenchBaseUrl,
    proposalId,
    proposalVersionNo,
    timeoutMs,
    screenshotRegisteredPanel,
  },
) {
  await navigateForBusinessProof(page,
    `${workbenchBaseUrl}/proposals/${encodeURIComponent(proposalId)}`,
    {
      timeout: timeoutMs,
    },
  );
  await expect(
    page.getByRole("heading", { name: new RegExp(`Proposal ${proposalId}`) }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await page.getByRole("tab", { name: "Memo & evidence pack" }).click();
  const memoPanel = page.locator("#proposal-memo-evidence-pack");
  await expect(memoPanel).toBeVisible({ timeout: timeoutMs });
  await expect(
    memoPanel.getByRole("heading", {
      name: "Advisor memo and evidence pack",
      exact: true,
    }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  const memoSourceState = memoPanel.getByTestId("proposal-memo-source-state");
  await expect(memoSourceState).toHaveAttribute(
    "data-source-state",
    /^(not-prepared|ready)$/,
    { timeout: timeoutMs },
  );
  const initialSourceState = await memoSourceState.getAttribute("data-source-state");
  await expect(memoPanel.getByLabel("Advisor memo workflow")).toBeVisible({
    timeout: timeoutMs,
  });
  const memoDetails = memoPanel.locator("details").first();
  if ((await memoDetails.getAttribute("open")) === null) {
    await memoDetails.locator("summary").click();
  }
  if (proposalVersionNo) {
    await expect(
      memoDetails
        .getByText("Current proposal version", { exact: true })
        .locator(".."),
    ).toContainText(String(proposalVersionNo), { timeout: timeoutMs });
  }
  await memoPanel
    .getByRole("textbox", { name: "Advisor or reviewer reference" })
    .fill("canonical_front_office_validator");

  const actionsPerformed = [];
  const prepareMemo = memoPanel.getByRole("button", { name: "Prepare advisor memo" });
  if ((await prepareMemo.count()) > 0) {
    await prepareMemo.click();
    await expect(memoPanel.getByTestId("proposal-memo-action-status")).toContainText(
      "Advisor memo confirmed",
      { timeout: timeoutMs },
    );
    actionsPerformed.push("memo-prepared");
  }
  const recordReview = memoPanel.getByRole("button", { name: "Record advisor review" });
  if ((await recordReview.count()) > 0) {
    await memoPanel.getByRole("textbox", { name: "Advisor review rationale" }).fill(
      "Canonical front-office validation confirmed the retained memo evidence for advisor use.",
    );
    await recordReview.click();
    await expect(memoPanel.getByTestId("proposal-memo-action-status")).toContainText(
      "Advisor review confirmed",
      { timeout: timeoutMs },
    );
    actionsPerformed.push("advisor-review-confirmed");
  }
  const requestMaterial = memoPanel.getByRole("button", { name: "Request discussion material" });
  if ((await requestMaterial.count()) > 0) {
    await requestMaterial.click();
    await expect(memoPanel.getByTestId("proposal-memo-action-status")).toContainText(
      "Discussion material confirmed",
      { timeout: timeoutMs },
    );
    actionsPerformed.push("discussion-material-confirmed");
  }
  const requestCommentary = memoPanel.getByRole("button", { name: "Request advisor commentary" });
  if ((await requestCommentary.count()) > 0) {
    await requestCommentary.click();
    await expect(memoPanel.getByTestId("proposal-memo-action-status")).toContainText(
      "Advisor commentary confirmed",
      { timeout: timeoutMs },
    );
    actionsPerformed.push("advisor-commentary-confirmed");
  }
  await expect(memoPanel.getByText("Evidence aligned").first()).toBeVisible({
    timeout: timeoutMs,
  });
  if ((await memoDetails.getAttribute("open")) === null) {
    await memoDetails.locator("summary").click();
  }
  await expect(memoDetails.getByText(/^sha256:/).first()).toBeVisible({
    timeout: timeoutMs,
  });

  summary.uiChecks.push({
    description:
      "Proposal memo evidence-pack advisor-use review and support posture",
    kind: "proposal-memo-evidence-pack",
    proposalId,
    versionNo: proposalVersionNo,
    initialSourceState,
    reviewState: "source-confirmed-advisor-use",
    actionsPerformed,
    clientReadyRelease: "not-requested",
  });
  await screenshotRegisteredPanel(page, "proposal.memo_evidence_pack", {
    route: `/proposals/${proposalId}`,
  });
}

export async function validateBankDemoProofPanel(
  page,
  { summary, workbenchBaseUrl, portfolioId, timeoutMs, screenshotRegisteredPanel },
) {
  await navigateForBusinessProof(page,
    `${workbenchBaseUrl}/recommendations?portfolioId=${encodeURIComponent(portfolioId)}&mode=proof`,
    {
      timeout: timeoutMs,
    },
  );
  await expect(
    page.getByRole("heading", { name: "Bank Demo Proof", exact: true }).first(),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(page.getByLabel("Bank demo proof summary")).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(page.getByLabel("Bank demo scenario steps")).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(page.getByLabel("Supported claim register")).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(page.getByText("Client Publication")).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(page.getByText("Blocked").first()).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    page.getByText("Client-ready publication is blocked").first(),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(page.getByText("Unsupported").first()).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    page.getByRole("button", { name: /approve|publish|client-ready/i }),
  ).toHaveCount(0);
  await expect(page.getByText("CLIENT_READY_PUBLICATION")).toHaveCount(0);
  await expect(page.getByText("OMS_ORDER_LIFECYCLE")).toHaveCount(0);

  summary.uiChecks.push({
    description: "RFC-0028 bank demo proof supported-claim surface",
    kind: "bank-demo-proof",
    portfolioId,
    route: `/recommendations?portfolioId=${encodeURIComponent(portfolioId)}&mode=proof`,
    clientReadyPublication: "blocked",
    sourcePosture: "scenario-and-claims-through-gateway",
  });
  await screenshotRegisteredPanel(page, "advisory.bank_demo_proof", {
    route: `/recommendations?portfolioId=${encodeURIComponent(portfolioId)}&mode=proof`,
  });
}

export async function validateRiskPanel(
  page,
  {
    summary,
    workbenchBaseUrl,
    portfolioId,
    benchmarkCode,
    canonicalStartDate,
    canonicalAsOfDate,
    mandateComparisons,
    timeoutMs,
    assertTableHasRows,
    screenshotRegisteredPanel,
  },
) {
  await navigateForBusinessProof(page,
    `${workbenchBaseUrl}/performance?portfolioId=${portfolioId}&mode=risk&period=EXPLICIT&detailBasis=NET&benchmark=${benchmarkCode}&reportStartDate=${canonicalStartDate}&reportEndDate=${canonicalAsOfDate}`,
    { timeout: timeoutMs },
  );
  await assertRailModeActive(page, /^Risk review/, timeoutMs);
  await expect(
    page.getByRole("heading", { name: "Risk snapshot", exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    page.getByRole("heading", { name: "Drawdown", exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    page.getByRole("heading", { name: "Concentration", exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    page.getByRole("heading", { name: "Rolling Risk", exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    page.getByRole("heading", {
      name: "Historical Risk Attribution",
      exact: true,
    }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await assertTableHasRows(
    tableByExactLabel(page, "Historical risk attribution table"),
    5,
    "Historical risk attribution table",
  );

  const executiveEvidence = page.getByRole("region", {
    name: "Risk executive overview",
  });
  await expect(executiveEvidence).toBeVisible({ timeout: timeoutMs });
  for (const label of [
    "Realised volatility",
    "Max drawdown",
    "Largest position",
    "Source coverage",
  ]) {
    await expect(executiveEvidence.getByText(label, { exact: true })).toBeVisible({
      timeout: timeoutMs,
    });
  }
  const mandateComparison = page.getByTestId("risk-mandate-comparison");
  await expect(mandateComparison).toBeVisible({ timeout: timeoutMs });
  await expect(mandateComparison).toHaveAttribute(
    "data-mandate-availability",
    "supplied",
    { timeout: timeoutMs },
  );
  await expect(mandateComparison).toHaveAttribute(
    "data-mandate-context-posture",
    "aligned",
    { timeout: timeoutMs },
  );
  await expect(mandateComparison.getByText("Source evidence supplied", { exact: true })).toBeVisible({
    timeout: timeoutMs,
  });
  const expectedMandateStates = buildRiskMandateSourceRenderRows(mandateComparisons);
  const constraintRows = mandateComparison.locator("[data-mandate-constraint]");
  await expect(constraintRows).toHaveCount(expectedMandateStates.length, {
    timeout: timeoutMs,
  });
  const renderedMandateStates = await constraintRows.evaluateAll((elements) =>
    elements.map((element) => ({
      source: element.getAttribute("data-mandate-constraint-source") ?? "",
      identity: element.getAttribute("data-mandate-constraint") ?? "",
      state: element.getAttribute("data-mandate-state") ?? "",
    })),
  );
  assertExactSourceRenderProof({
    screen: "Risk review",
    expectedRows: expectedMandateStates,
    renderedRows: renderedMandateStates,
  });
  const mandateStates = [];
  for (const expected of expectedMandateStates) {
    const rendered = mandateComparison.getByTestId(
      `risk-mandate-constraint-${expected.source}-${expected.identity}`,
    );
    await expect(rendered).toHaveCount(1, { timeout: timeoutMs });
    await expect(rendered).toBeVisible({ timeout: timeoutMs });
    await expect(rendered).toHaveAttribute(
      "data-mandate-constraint-source",
      expected.source,
      { timeout: timeoutMs },
    );
    await expect(rendered).toHaveAttribute(
      "data-mandate-constraint",
      expected.identity,
      { timeout: timeoutMs },
    );
    await expect(rendered).toHaveAttribute(
      "data-mandate-state",
      expected.state,
      { timeout: timeoutMs },
    );
    mandateStates.push(expected);
  }
  summary.uiChecks.push({
    description: "Gateway-owned Risk mandate comparison",
    kind: "risk-mandate-comparison",
    portfolioId,
    availability: "supplied",
    contextPosture: "aligned",
    sourceStates: [...new Set(mandateStates.map((row) => row.state))].sort(),
    sourceConstraintEvidence: mandateStates,
    browserPolicyCalculation: "none",
  });
  for (const retiredClassification of [
    "Contained",
    "Moderate",
    "Elevated",
    "High",
    "Severe",
    "Acceptable",
    "Diversified",
  ]) {
    await expect(
      executiveEvidence.getByText(retiredClassification, { exact: true }),
    ).toHaveCount(0);
  }

  const originalViewport = page.viewportSize() ?? { width: 1440, height: 1000 };
  for (const width of [1440, 1024, 519]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(executiveEvidence).toBeVisible({ timeout: timeoutMs });
    await expect(mandateComparison).toBeVisible({ timeout: timeoutMs });
    const pageReflows = await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.document.documentElement.clientWidth + 1,
    );
    if (!pageReflows) {
      throw new Error(`Risk review creates page-level horizontal scrolling at ${width}px.`);
    }
  }
  await page.setViewportSize(originalViewport);
  await screenshotRegisteredPanel(page, "performance.risk.snapshot");
}

export function classifyPerformanceEvidenceScreenshotState(assuranceState) {
  return assuranceState === "ready" ? "demo_ready" : "truthfully_degraded";
}

export async function validateEvidencePanel(
  page,
  {
    summary,
    workbenchBaseUrl,
    portfolioId,
    benchmarkCode,
    canonicalStartDate,
    canonicalAsOfDate,
    timeoutMs,
    screenshotRegisteredPanel,
  },
) {
  await navigateForBusinessProof(page,
    `${workbenchBaseUrl}/performance?portfolioId=${portfolioId}&mode=evidence&period=EXPLICIT&detailBasis=NET&benchmark=${benchmarkCode}&reportStartDate=${canonicalStartDate}&reportEndDate=${canonicalAsOfDate}`,
    { timeout: timeoutMs },
  );
  await assertRailModeActive(page, /^Evidence/, timeoutMs);
  await expect(
    page.getByRole("heading", { name: "Calculation assurance", exact: true }),
  ).toBeVisible({ timeout: timeoutMs });
  const assuranceWorkspace = page.getByTestId("performance-evidence-assurance");
  let screenshotState = "truthfully_degraded";
  if (await assuranceWorkspace.count()) {
    await expect(assuranceWorkspace).toBeVisible({ timeout: timeoutMs });
    await expect(assuranceWorkspace).toHaveAttribute(
      "data-assurance-state",
      /^(ready|attention|incomplete|unavailable)$/,
    );
    await expect(
      assuranceWorkspace.getByRole("heading", {
        name: "Control exceptions",
        exact: true,
      }),
    ).toBeVisible({ timeout: timeoutMs });
    await expect(
      assuranceWorkspace.getByRole("heading", {
        name: "Calculation coverage",
        exact: true,
      }),
    ).toBeVisible({ timeout: timeoutMs });
    const assuranceState = await assuranceWorkspace.getAttribute("data-assurance-state");
    summary.uiChecks.push({
      description: "Calculation assurance source posture",
      kind: "assurance-workspace",
      state: assuranceState,
    });
    screenshotState = classifyPerformanceEvidenceScreenshotState(assuranceState);
  } else {
    await expect(
      page.getByRole("heading", { name: /Assurance (evidence incomplete|unavailable)/ }),
    ).toBeVisible({
      timeout: timeoutMs,
    });
    summary.uiChecks.push({
      description: "Calculation assurance source posture",
      kind: "assurance-workspace",
      state: "degraded",
    });
  }
  await screenshotRegisteredPanel(page, "performance.evidence", {
    state: screenshotState,
  });
}

export function buildOutcomeReviewSourceEvidenceProof(sourceReview) {
  if (
    !sourceReview ||
    typeof sourceReview !== "object" ||
    Array.isArray(sourceReview)
  ) {
    throw new Error(
      "Canonical Outcome Review proof requires one Gateway source record.",
    );
  }

  const isSourceHash = (value) =>
    typeof value === "string" && /^sha256:.+$/u.test(value.trim());
  const outcomeReviewId = sourceReview.outcome_review_id;
  if (typeof outcomeReviewId !== "string" || !outcomeReviewId.trim()) {
    throw new Error(
      "Canonical Outcome Review proof requires a source-owned outcome review identity.",
    );
  }
  const expectedHash = sourceReview.expected_snapshot?.source_hashes?.expected;
  const realizedHash = sourceReview.realized_snapshot?.source_hashes?.realized;
  const proofPackAvailable =
    typeof sourceReview.proof_pack_id === "string" &&
    sourceReview.proof_pack_id.trim().length > 0;
  const lineageAvailable =
    Array.isArray(sourceReview.source_lineage) &&
    sourceReview.source_lineage.length > 0;
  const readyEvidenceCount = [
    isSourceHash(expectedHash),
    isSourceHash(realizedHash),
    proofPackAvailable,
    lineageAvailable,
  ].filter(Boolean).length;

  return {
    outcomeReviewId: outcomeReviewId.trim(),
    expectedSnapshotHash: isSourceHash(expectedHash)
      ? expectedHash.trim()
      : "N/A",
    realizedSnapshotHash: isSourceHash(realizedHash)
      ? realizedHash.trim()
      : "N/A",
    expectedAvailability: isSourceHash(expectedHash)
      ? "Available"
      : "Not available",
    realizedAvailability: isSourceHash(realizedHash)
      ? "Available"
      : "Not available",
    proofPackAvailability: proofPackAvailable
      ? "Available"
      : "Not available",
    sourceEvidenceStatus:
      readyEvidenceCount >= 3
        ? "Available"
        : readyEvidenceCount > 0
          ? "Partial"
          : "Not available",
  };
}

export async function validateOutcomeReviewPanel(
  page,
  {
    workbenchBaseUrl,
    portfolioId,
    sourceReview,
    timeoutMs,
    assertTableHasRows,
    screenshotRegisteredPanel,
  },
) {
  await navigateForBusinessProof(page, `${workbenchBaseUrl}/workbench/${portfolioId}?mode=reviews`, {
    timeout: timeoutMs,
  });
  const outcomeReviewPanel = page.locator("article#outcome-review-panel");
  await expect(
    outcomeReviewPanel.getByRole("heading", {
      name: "Outcome comparison",
      exact: true,
    }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  const sourceEvidence = buildOutcomeReviewSourceEvidenceProof(sourceReview);
  const selectedReview = outcomeReviewPanel.getByTestId(
    "selected-outcome-review-detail",
  );
  await expect(selectedReview).toHaveAttribute(
    "data-outcome-review-id",
    sourceEvidence.outcomeReviewId,
    { timeout: timeoutMs },
  );
  await expect(selectedReview).toHaveAttribute(
    "data-expected-snapshot-hash",
    sourceEvidence.expectedSnapshotHash,
    { timeout: timeoutMs },
  );
  await expect(selectedReview).toHaveAttribute(
    "data-realized-snapshot-hash",
    sourceEvidence.realizedSnapshotHash,
    { timeout: timeoutMs },
  );
  const evidenceAvailability = outcomeReviewPanel.getByLabel(
    "Outcome review evidence availability",
  );
  for (const [label, state] of [
    ["Expected outcome", sourceEvidence.expectedAvailability],
    ["Realised outcome", sourceEvidence.realizedAvailability],
    ["Evidence pack", sourceEvidence.proofPackAvailability],
    ["Source evidence", sourceEvidence.sourceEvidenceStatus],
  ]) {
    await expect(
      evidenceAvailability.getByText(`${label} ${state}`, { exact: true }),
    ).toBeVisible({ timeout: timeoutMs });
  }
  await assertTableHasRows(
    tableByExactLabel(page, "Outcome reviews"),
    1,
    "Outcome reviews",
  );
  await assertTableHasRows(
    tableByExactLabel(page, "Outcome review dimensions"),
    1,
    "Outcome review dimensions",
  );
  await expect(
    outcomeReviewPanel.getByRole("heading", {
      name: "Selected review detail",
      exact: true,
    }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    outcomeReviewPanel.getByText("Evidence availability", { exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    outcomeReviewPanel.getByRole("button", { name: "Request report" }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    outcomeReviewPanel.getByRole("button", {
      name: /Prepare AI-assisted review summary/,
    }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await screenshotRegisteredPanel(page, "dpm.outcome_review");
}

export async function validateDpmCommandCenterPanel(
  page,
  {
    workbenchBaseUrl,
    portfolioId,
    timeoutMs,
    screenshotRegisteredPanel,
  },
) {
  await navigateForInteractiveBusinessProof(
    page,
    `${workbenchBaseUrl}/workbench/${portfolioId}?mode=mandate`,
    "article#mandate-health-panel",
    { timeout: timeoutMs },
  );
  await expect(
    page.getByRole("heading", { name: "Mandate Health", exact: true }).first(),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  const mandatePanel = page.locator("article#mandate-health-panel");
  await expect(
    mandatePanel.getByRole("heading", { name: "Mandate review", exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(mandatePanel.getByText("Mandate health", { exact: true })).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    mandatePanel
      .getByLabel("Mandate health summary")
      .getByText("Data availability", { exact: true }),
  ).toBeVisible({ timeout: timeoutMs });
  await expect(
    mandatePanel.getByRole("heading", { name: "Attention items", exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    mandatePanel.getByRole("heading", { name: "Mandate health dimensions", exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });

  const attentionItems = mandatePanel.getByLabel("Mandate attention items");
  const attentionButtons = attentionItems.getByRole("button");
  const attentionCount = await attentionButtons.count();
  if (attentionCount < 1) {
    throw new Error("DPM mandate review expected at least one source-owned attention item.");
  }
  const selectedIndex = attentionCount > 1 ? 1 : 0;
  const selectedAttention = attentionButtons.nth(selectedIndex);
  await selectedAttention.focus();
  await selectedAttention.press("Enter");
  await expect(selectedAttention).toHaveAttribute("aria-pressed", "true", {
    timeout: timeoutMs,
  });

  const selectedReview = mandatePanel.getByLabel("Selected mandate review item");
  await expect(selectedReview.getByText("Source-owned next step")).toBeVisible({
    timeout: timeoutMs,
  });
  await selectedReview.getByText("Evidence and technical identifiers").click();
  await expect(selectedReview.getByText("Exception ID")).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(mandatePanel.getByText("DPM_SOURCE_STALE", { exact: true })).toHaveCount(0);
  await expect(
    mandatePanel.getByText("SOURCE_RISK_HEALTH_ATTENTION", { exact: true }),
  ).toHaveCount(0);
  await expect(
    mandatePanel.getByText("Source Risk Health Attention", { exact: true }),
  ).toHaveCount(0);
  await expect(
    mandatePanel.getByText("Advisor review recommended before rebalance approval.", {
      exact: true,
    }),
  ).toHaveCount(0);

  const originalViewport = page.viewportSize() ?? { width: 1440, height: 1000 };
  for (const width of [1024, 768, 720, 519]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(mandatePanel).toBeVisible({ timeout: timeoutMs });
    const pageReflows = await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.document.documentElement.clientWidth + 1,
    );
    if (!pageReflows) {
      throw new Error(`DPM mandate review creates page-level horizontal scrolling at ${width}px.`);
    }
  }
  await page.setViewportSize(originalViewport);
  await screenshotRegisteredPanel(page, "dpm.command_center");
}

export async function validateDpmWaveCommandCenterPanel(
  page,
  { workbenchBaseUrl, portfolioId, timeoutMs, screenshotRegisteredPanel },
) {
  await navigateForInteractiveBusinessProof(
    page,
    `${workbenchBaseUrl}/workbench/${portfolioId}?mode=waves`,
    "#rebalance-workspace",
    { timeout: timeoutMs },
  );
  const wavePanel = page.locator("#rebalance-workspace");
  await expect(
    wavePanel.getByRole("heading", { name: "Rebalance", exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  const readinessStrip = wavePanel.getByLabel("Rebalance readiness");
  await expect(readinessStrip.getByText("Rebalance Status")).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(readinessStrip.getByText("Approval Readiness")).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    wavePanel.getByRole("heading", {
      name: "Active Rebalance",
      exact: true,
    }),
  ).toBeVisible({ timeout: timeoutMs });
  await expect(wavePanel.getByText("Recommended Actions")).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    wavePanel.getByRole("heading", { name: "Proposed Changes", exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  const candidateSourceReview = page
    .locator(".rebalance-campaign-evidence")
    .filter({ hasText: "Candidate Source Review" })
    .first();
  await expect(candidateSourceReview).toBeVisible({ timeout: timeoutMs });
  for (const label of [
    "Source Product",
    "Selection Basis",
    "Readiness",
    "Candidates",
    "Eligible",
    "Filters",
    "Warnings",
    "Lineage Refs",
    "Next Action",
    "Boundaries",
  ]) {
    await expect(
      candidateSourceReview.getByText(label, { exact: true }),
    ).toBeVisible({
      timeout: timeoutMs,
    });
  }
  await expect(
    candidateSourceReview.getByText("DpmPortfolioUniverseCandidate:v1", {
      exact: true,
    }),
  ).toBeVisible({ timeout: timeoutMs });
  await expect(
    candidateSourceReview.getByText("Effective Discretionary Mandate Binding"),
  ).toBeVisible({ timeout: timeoutMs });
  await expect(
    candidateSourceReview.getByText("portfolio_mandate_bindings"),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    candidateSourceReview.getByText("mandate_type=discretionary"),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    candidateSourceReview.getByText(
      "Review launch readiness and any source-owned blockers.",
      { exact: true },
    ),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    candidateSourceReview.getByText("NO_ORDER_GENERATION"),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    candidateSourceReview.getByText("NO_OMS_EXECUTION_CLAIM"),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    candidateSourceReview.getByText("NO_CLIENT_CONTACT_WORKFLOW"),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    candidateSourceReview.getByRole("button", { name: /oms/i }),
  ).toHaveCount(0);
  await expect(
    candidateSourceReview.getByRole("button", { name: /client/i }),
  ).toHaveCount(0);
  await expect(
    candidateSourceReview.getByRole("button", { name: /order/i }),
  ).toHaveCount(0);
  for (const actionName of [
    "Preview",
    "Create Rebalance",
    "Review Data",
    "Simulate",
    "Request Approval",
    "Stage",
    "Prepare Handoff",
    "Open Evidence Pack",
    "Load Changes",
  ]) {
    await expect(
      wavePanel.getByRole("button", { name: actionName, exact: true }),
    ).toBeVisible({
      timeout: timeoutMs,
    });
  }
  await wavePanel.getByRole("button", { name: "Preview", exact: true }).click({
    timeout: timeoutMs,
  });
  await expect(wavePanel.getByText("Preview completed.")).toBeVisible({
    timeout: timeoutMs,
  });
  await wavePanel.getByRole("button", { name: "Create Rebalance" }).click({
    timeout: timeoutMs,
  });
  await expect(wavePanel.getByText("Create rebalance completed.")).toBeVisible({
    timeout: timeoutMs,
  });
  await wavePanel.getByRole("button", { name: "Load Changes" }).click({
    timeout: timeoutMs,
  });
  await expect(
    wavePanel.getByText("Load proposed changes completed."),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await screenshotRegisteredPanel(page, "dpm.wave_command_center");
}

export async function validatePortfolioMemoryPanel(
  page,
  {
    workbenchBaseUrl,
    portfolioId,
    timeoutMs,
    assertTableHasRows,
    screenshotRegisteredPanel,
  },
) {
  await navigateForBusinessProof(page, `${workbenchBaseUrl}/workbench/${portfolioId}?mode=memory`, {
    timeout: timeoutMs,
  });
  const memoryPanel = page.locator("article#portfolio-memory-panel");
  await expect(
    memoryPanel.getByRole("heading", {
      name: "Portfolio Memory",
      exact: true,
    }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(memoryPanel.getByText("Audit trail available")).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(memoryPanel.getByText("Historical Event Log")).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(memoryPanel.getByText("Recommended Actions")).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(memoryPanel.getByText("Support Snapshot")).toBeVisible({
    timeout: timeoutMs,
  });
  await assertTableHasRows(
    tableByExactLabel(page, "Portfolio memory event timeline"),
    1,
    "Portfolio memory event timeline",
  );
  await screenshotRegisteredPanel(page, "dpm.portfolio_memory");
}

export async function validateConstructionAlternativesPanel(
  page,
  { workbenchBaseUrl, portfolioId, timeoutMs, screenshotRegisteredPanel },
) {
  await navigateForInteractiveBusinessProof(page,
    `${workbenchBaseUrl}/workbench/${portfolioId}?mode=construction`,
    ".construction-alternatives-panel",
    {
      timeout: timeoutMs,
    },
  );
  const constructionPanel = workbenchPanelByClass(
    page,
    "construction-alternatives-panel",
  );
  const constructionHeader = constructionPanel.getByRole("group", {
    name: "Construction Alternatives section header",
  });
  await expect(
    constructionPanel.getByRole("heading", {
      name: "Construction Alternatives",
      exact: true,
    }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    constructionPanel.getByRole("button", { name: "Generate alternatives" }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    constructionHeader.getByLabel("Status Not generated"),
  ).toBeVisible({ timeout: timeoutMs });
  await constructionPanel
    .getByRole("button", { name: "Generate alternatives" })
    .click({
      timeout: timeoutMs,
    });
  await expect(
    constructionPanel.getByText(
      "Construction alternatives generated from mandate data.",
    ),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    constructionHeader.getByLabel("Status Evidence available"),
  ).toBeVisible({ timeout: timeoutMs });
  await expect(
    constructionPanel.getByText("Alternatives Comparison"),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  const constructionSummary = constructionPanel.locator(
    ".construction-alternatives-summary",
  );
  await expect(
    constructionSummary.getByText("Recommended Path", { exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await screenshotRegisteredPanel(page, "dpm.construction_alternatives");
}

export async function validatePmOperatingQualityPanel(
  page,
  {
    workbenchBaseUrl,
    portfolioId,
    timeoutMs,
    expectedEvidence,
    screenshotRegisteredPanel,
  },
) {
  await navigateForBusinessProof(page, `${workbenchBaseUrl}/workbench/${portfolioId}?mode=quality`, {
    timeout: timeoutMs,
  });
  const qualityPanel = page.locator("article#pm-operating-quality-panel");
  await expect(
    qualityPanel.getByRole("heading", {
      name: "PM Operating Quality",
      exact: true,
    }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  const qualityStatusStrip = qualityPanel.getByTestId("pm-operating-quality-source-evidence");
  for (const label of [
    "Policy",
    "Selected Quality Run",
    "Selected Fairness Review",
    "Summary Invocation",
    "Authority",
  ]) {
    await expect(
      qualityStatusStrip.getByText(label, { exact: true }),
    ).toBeVisible({
      timeout: timeoutMs,
    });
  }
  const sourceEvidence = qualityPanel.getByTestId(
    "pm-operating-quality-source-evidence",
  );
  await expect(sourceEvidence).toHaveAttribute("data-panel-state", "ready", {
    timeout: timeoutMs,
  });
  await expect(sourceEvidence).toHaveAttribute("data-attention-state", "clear", {
    timeout: timeoutMs,
  });
  await expect(sourceEvidence).toHaveAttribute(
    "data-source-service",
    "lotus-manage",
    { timeout: timeoutMs },
  );
  await expect(sourceEvidence).toHaveAttribute(
    "data-authority",
    /^lotus-manage:/,
    { timeout: timeoutMs },
  );
  await expect(sourceEvidence).toHaveAttribute(
    "data-score-run-id",
    expectedEvidence.scoreRunId,
    { timeout: timeoutMs },
  );
  await expect(sourceEvidence).toHaveAttribute(
    "data-fairness-analysis-id",
    expectedEvidence.fairnessAnalysisId,
    { timeout: timeoutMs },
  );
  await expect(sourceEvidence).toHaveAttribute(
    "data-score-run-state",
    expectedEvidence.scoreRunState,
    { timeout: timeoutMs },
  );
  await expect(sourceEvidence).toHaveAttribute(
    "data-fairness-analysis-state",
    expectedEvidence.fairnessAnalysisState,
    { timeout: timeoutMs },
  );
  await expect(
    page.getByLabel("PM operating quality summary generation status"),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    page.getByLabel("PM operating quality summary-invocation control"),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    page.getByLabel("PM operating quality summary-invocation readiness"),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    qualityPanel.getByText("Summary Invocation Detail", { exact: true }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    page.getByLabel("PM operating quality summary invocations"),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await screenshotRegisteredPanel(page, "dpm.pm_operating_quality");
}

export async function validateDpmCopilotWorkspace(
  page,
  { workbenchBaseUrl, portfolioId, timeoutMs, screenshotRegisteredPanel },
) {
  await navigateForBusinessProof(page, `${workbenchBaseUrl}/workbench/${portfolioId}?mode=copilot`, {
    timeout: timeoutMs,
  });
  const copilotWorkspace = page.locator("#pm-copilot-workspace");
  await expect(
    page.getByRole("heading", {
      name: "PM Copilot",
      exact: true,
      level: 1,
    }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    copilotWorkspace.getByRole("heading", {
      name: "Decision-support workflows",
      exact: true,
    }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(page.getByLabel("Portfolio manager copilot status")).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(copilotWorkspace.getByRole("listbox", {
    name: "Portfolio manager decision-support workflows",
  })).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(copilotWorkspace.getByRole("option")).toHaveCount(6);
  await expect(copilotWorkspace.getByRole("region", {
    name: "Selected decision-support workflow",
  })).toBeVisible({
    timeout: timeoutMs,
  });
  const operatingBoundaries = copilotWorkspace.getByLabel("Operating boundaries");
  await expect(operatingBoundaries).toContainText("Human review required");
  await expect(operatingBoundaries).toContainText("Internal decision support only");
  await expect(operatingBoundaries).toContainText(
    "Portfolio manager and investment control retain decision authority",
  );
  await expect(operatingBoundaries).toContainText(
    "client communication and order execution are not supported",
  );
  await expect(copilotWorkspace.getByRole("button", {
    name: /^(Prepare .+|.+ unavailable: .+)$/,
  })).toHaveCount(1);
  await screenshotRegisteredPanel(page, "dpm.copilot_workspace");
}

export async function validateProofPackPanel(
  page,
  {
    workbenchBaseUrl,
    portfolioId,
    timeoutMs,
    assertTableHasRows,
    screenshotRegisteredPanel,
  },
) {
  await navigateForInteractiveBusinessProof(
    page,
    `${workbenchBaseUrl}/workbench/${portfolioId}?mode=proof`,
    "#evidence-pack-panel",
    { timeout: timeoutMs },
  );
  const proofPackPanel = page.locator("#evidence-pack-panel");
  await expect(
    page.getByRole("heading", {
      name: "Evidence Pack",
      level: 1,
      exact: true,
    }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  await expect(
    proofPackPanel.getByRole("button", {
      name: "Prepare evidence",
      exact: true,
    }),
  ).toBeVisible({
    timeout: timeoutMs,
  });
  const prepareEvidenceButton = proofPackPanel.getByRole("button", {
    name: "Prepare evidence",
    exact: true,
  });
  await expect(prepareEvidenceButton).toBeEnabled({ timeout: timeoutMs });
  const generationResponsePromise = page.waitForResponse(
    (response) => {
      const request = response.request();
      const pathname = new URL(response.url()).pathname;
      return (
        request.method() === "POST" &&
        pathname.endsWith("/api/bff/api/v1/dpm/command-center/proof-packs")
      );
    },
    { timeout: timeoutMs },
  );
  await prepareEvidenceButton.click({ timeout: timeoutMs });
  const generationResponse = await generationResponsePromise.catch((error) => {
    throw new Error(
      "Prepare evidence did not emit the expected Workbench proof-pack response after client hydration.",
      { cause: error },
    );
  });
  if (!generationResponse.ok()) {
    throw new Error(
      `Evidence-pack generation failed through Workbench BFF with HTTP ${generationResponse.status()}.`,
    );
  }
  const sourceProof = buildPreparedProofPackSourceProof(
    await generationResponse.json(),
  );
  await expect(proofPackPanel.getByText("Evidence pack prepared.")).toBeVisible(
    {
      timeout: timeoutMs,
    },
  );
  for (const state of [
    "Summary Available",
    "Report Available",
    "Memo Available",
  ]) {
    await expect(
      proofPackPanel.getByText(state, { exact: true }),
    ).toBeVisible({ timeout: timeoutMs });
  }
  const advisorMemoButton = proofPackPanel
    .getByRole("button", { name: /^Open advisor memo/ })
    .first();
  await expect(advisorMemoButton).toBeEnabled({ timeout: timeoutMs });
  const memoResponsePromise = page.waitForResponse(
    (response) => {
      const request = response.request();
      return (
        request.method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/ai-pm-memo")
      );
    },
    { timeout: timeoutMs },
  );
  await advisorMemoButton.click({ timeout: timeoutMs });
  const memoResponse = await memoResponsePromise.catch((error) => {
    throw new Error(
      "Open advisor memo did not emit the expected Workbench AI memo response.",
      { cause: error },
    );
  });
  if (!memoResponse.ok()) {
    throw new Error(
      `Evidence Pack decision memo failed through Workbench BFF with HTTP ${memoResponse.status()}.`,
    );
  }
  buildProofPackMemoSourceProof(
    await memoResponse.json(),
    sourceProof.proofPackId,
  );
  await expect(
    proofPackPanel.getByRole("heading", {
      name: "Portfolio decision memo",
      exact: true,
    }),
  ).toBeVisible({ timeout: timeoutMs });
  const evidenceAreas = tableByExactLabel(page, "Evidence areas");
  await assertTableHasRows(
    evidenceAreas,
    sourceProof.sectionCount,
    "Evidence areas",
  );
  const renderedSectionCount = await evidenceAreas.locator("tbody tr").count();
  if (renderedSectionCount !== sourceProof.sectionCount) {
    throw new Error(
      `Evidence Pack rendered ${renderedSectionCount} areas, but Gateway returned ${sourceProof.sectionCount}.`,
    );
  }
  await screenshotRegisteredPanel(page, "dpm.proof_pack");
}

export function buildPreparedProofPackSourceProof(sourceResponse) {
  if (
    !sourceResponse ||
    typeof sourceResponse !== "object" ||
    Array.isArray(sourceResponse)
  ) {
    throw new Error(
      "Canonical Evidence Pack proof requires one Gateway response record.",
    );
  }

  if (sourceResponse.source_service !== "lotus-manage") {
    throw new Error(
      "Canonical Evidence Pack generation did not return lotus-manage source authority.",
    );
  }

  const proofPack = sourceResponse.data?.proof_pack;
  const proofPackId = proofPack?.proof_pack_id;
  const supportability = sourceResponse.supportability;
  if (typeof proofPackId !== "string" || proofPackId.trim().length === 0) {
    throw new Error(
      "Canonical Evidence Pack generation returned no proof-pack identity.",
    );
  }
  if (supportability?.proof_pack_id !== proofPackId) {
    throw new Error(
      "Canonical Evidence Pack generation returned mismatched source and supportability identity.",
    );
  }

  const sections = proofPack?.sections;
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error(
      "Canonical Evidence Pack generation returned no reviewable evidence areas.",
    );
  }
  for (const [field, label] of [
    ["markdown_available", "summary"],
    ["report_input_available", "report"],
    ["ai_evidence_input_available", "memo"],
  ]) {
    if (supportability?.[field] !== true) {
      throw new Error(
        `Canonical Evidence Pack generation did not prove ${label} availability.`,
      );
    }
  }

  return {
    proofPackId,
    sectionCount: sections.length,
  };
}

export function buildProofPackMemoSourceProof(
  sourceResponse,
  expectedProofPackId,
) {
  if (
    !sourceResponse ||
    typeof sourceResponse !== "object" ||
    Array.isArray(sourceResponse)
  ) {
    throw new Error(
      "Canonical Evidence Pack memo proof requires one Gateway response record.",
    );
  }
  if (
    sourceResponse.source_service !== "lotus-ai" ||
    sourceResponse.evidence_source_service !== "lotus-manage"
  ) {
    throw new Error(
      "Canonical Evidence Pack memo did not preserve AI and evidence source authority.",
    );
  }

  const sourceProofPackIds = [
    sourceResponse.supportability?.proof_pack_id,
    sourceResponse.ai_evidence_input?.proof_pack_id,
    sourceResponse.data?.execution?.result?.structured_output?.proof_pack_id,
  ];
  if (
    typeof expectedProofPackId !== "string" ||
    expectedProofPackId.length === 0 ||
    sourceProofPackIds.some((proofPackId) => proofPackId !== expectedProofPackId)
  ) {
    throw new Error(
      "Canonical Evidence Pack memo was not bound to the prepared proof-pack identity.",
    );
  }

  const workflowPackRunId = sourceResponse.data?.workflow_pack_run?.run_id;
  if (
    typeof workflowPackRunId !== "string" ||
    workflowPackRunId.trim().length === 0
  ) {
    throw new Error(
      "Canonical Evidence Pack memo returned no workflow-pack run identity.",
    );
  }

  return { proofPackId: expectedProofPackId, workflowPackRunId };
}
