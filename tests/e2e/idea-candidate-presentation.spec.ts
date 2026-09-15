import { expect, test, type Page, type Route } from "@playwright/test";

const portfolioId = "PB_SG_GLOBAL_BAL_001";
const candidateCount = 25;
const targetCandidateId = "idea_candidate_025";

type RecordedPresentation = {
  body: Record<string, unknown>;
  candidateId: string;
  idempotencyKey: string | undefined;
};

function candidateId(rank: number): string {
  return `idea_candidate_${String(rank).padStart(3, "0")}`;
}

function requestedQueueBoundary(route: Route): string {
  const boundary = new URL(route.request().url()).searchParams.get(
    "evaluatedAtUtc",
  );
  if (!boundary) {
    throw new Error("Idea queue request omitted evaluatedAtUtc");
  }
  expect(boundary).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  return boundary;
}

async function mockIdeaQueue(page: Page) {
  await page.route(
    "**/api/bff/api/v1/ideas/review-queues/advisor**",
    async (route) => {
      const requestedBoundary = requestedQueueBoundary(route);
      await route.fulfill({
        json: {
          data: {
            policyVersion: "idea-deterministic-ranking-v1",
            evaluatedAtUtc: requestedBoundary,
            durableStorageBacked: true,
            supportedFeaturePromoted: false,
            exclusions: [],
            items: Array.from({ length: candidateCount }, (_, index) => {
              const rank = index + 1;
              return {
                rank,
                score: String(101 - rank),
                priorityBucket: rank <= 5 ? "high" : "standard",
                reasonCodes: ["portfolio_review_due"],
                candidate: {
                  candidateId: candidateId(rank),
                  materialVersion: 3,
                  evidenceVersion: 7,
                  scorePolicyVersion: "idle-liquidity-v1",
                  sourceRevisionVectorDigest: `sha256:${"b".repeat(64)}`,
                  sourceCutPosture: "coherent",
                  family: "liquidity_review",
                  reviewPosture: "advisor_review_required",
                  score: String(101 - rank),
                  sourceSignalIds: [`signal_${rank}`],
                },
              };
            }),
          },
        },
      });
    },
  );
}

async function acceptPresentationReceipt(
  route: Route,
  presentation: RecordedPresentation,
) {
  await route.fulfill({
    json: {
      data: {
        receipt: {
          ...presentation.body,
          candidateId: presentation.candidateId,
          tenantId: "tenant-sg-private-bank",
          receiptId: `receipt-${presentation.candidateId}`,
          acceptedAtUtc: "2026-08-31T10:15:00.100000Z",
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
}

test("records only presented Idea rows and retries the same failed evidence", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1 });
  await page.addInitScript(() => {
    const getRandomValues = globalThis.crypto.getRandomValues.bind(
      globalThis.crypto,
    );
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: Object.freeze({ getRandomValues }),
    });
  });
  await mockIdeaQueue(page);
  const presentations: RecordedPresentation[] = [];
  let targetFailureReturned = false;
  await page.route(
    "**/api/bff/api/v1/ideas/candidates/*/presentation-receipts",
    async (route) => {
      const segments = new URL(route.request().url()).pathname.split("/");
      const presentedCandidateId = segments.at(-2)!;
      const presentation = {
        body: route.request().postDataJSON() as Record<string, unknown>,
        candidateId: presentedCandidateId,
        idempotencyKey: route.request().headers()["idempotency-key"],
      };
      presentations.push(presentation);
      if (
        presentedCandidateId === targetCandidateId &&
        !targetFailureReturned
      ) {
        targetFailureReturned = true;
        await route.fulfill({
          status: 503,
          json: { detail: "Presentation evidence store is unavailable." },
        });
        return;
      }
      await acceptPresentationReceipt(route, presentation);
    },
  );

  await page.goto(
    `/recommendations?mode=opportunities&portfolioId=${portfolioId}`,
    { waitUntil: "domcontentloaded" },
  );
  await expect(
    page.evaluate(() => ({
      getRandomValues: typeof globalThis.crypto.getRandomValues,
      randomUUID: typeof globalThis.crypto.randomUUID,
      subtle: typeof globalThis.crypto.subtle,
    })),
  ).resolves.toEqual({
    getRandomValues: "function",
    randomUUID: "undefined",
    subtle: "undefined",
  });

  const grid = page.getByRole("grid", {
    name: "Idea candidate review queue",
    exact: true,
  });
  await expect(grid).toBeAttached();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(presentations).toHaveLength(0);

  await page.setViewportSize({ width: 1280, height: 900 });
  await grid.scrollIntoViewIfNeeded();
  await expect(grid).toBeVisible();
  await expect(grid).toBeInViewport();
  const gridContainer = page.locator("[data-receipt-state]");
  await expect.poll(() => presentations.length).toBeGreaterThan(0);
  await expect(gridContainer).toHaveAttribute("data-receipt-state", "ready");

  const renderedCandidates = grid.locator("[data-idea-presentation-candidate]");
  expect(await renderedCandidates.count()).toBeLessThan(candidateCount);
  const centreRows = grid.locator('.ag-center-cols-container [role="row"]');
  const firstQueuePositionCell = centreRows
    .first()
    .getByRole("gridcell")
    .first();
  const secondQueuePositionCell = centreRows
    .nth(1)
    .getByRole("gridcell")
    .first();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const presentationsBeforeKeyboardNavigation = structuredClone(presentations);
  await firstQueuePositionCell.click();
  await firstQueuePositionCell.press("ArrowDown");
  await expect(secondQueuePositionCell).toBeFocused();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(presentations).toEqual(presentationsBeforeKeyboardNavigation);
  expect(
    presentations.some(({ candidateId: id }) => id === targetCandidateId),
  ).toBe(false);

  const filter = page.getByRole("searchbox", { name: "Find an opportunity" });
  const settledPresentationCount = presentations.length;
  await filter.fill("no matching opportunity");
  await expect(renderedCandidates).toHaveCount(0);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(presentations).toHaveLength(settledPresentationCount);

  await filter.fill("Portfolio Review Due");
  await expect(renderedCandidates.first()).toBeVisible();
  await filter.fill("Advisor Review Required");
  await expect(renderedCandidates.first()).toBeVisible();
  await filter.fill("76");
  await expect(
    grid.getByRole("link", {
      name: `Liquidity Review - ${targetCandidateId}`,
      exact: true,
    }),
  ).toBeVisible();

  await filter.fill(targetCandidateId);
  await expect(
    grid.getByRole("link", {
      name: `Liquidity Review - ${targetCandidateId}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect
    .poll(
      () =>
        presentations.filter(({ candidateId: id }) => id === targetCandidateId)
          .length,
    )
    .toBe(1);
  await expect(
    page.getByText(
      "Opportunity visibility could not be recorded. Review remains available.",
    ),
  ).toBeVisible();

  const firstTargetAttempt = presentations.find(
    ({ candidateId: id }) => id === targetCandidateId,
  )!;
  expect(firstTargetAttempt.idempotencyKey).toBeTruthy();
  expect(firstTargetAttempt.body).toMatchObject({
    rankAtPresentation: 25,
    visibleCandidateCount: 1,
    queuePolicyVersion: "idea-deterministic-ranking-v1",
    rankingPolicyVersion: "idle-liquidity-v1",
    candidateMaterialVersion: 3,
    candidateEvidenceVersion: 7,
  });
  expect(firstTargetAttempt.body).not.toHaveProperty("tenantId");
  expect(firstTargetAttempt.body).not.toHaveProperty("tenant_id");

  await page.getByRole("button", { name: "Retry recording" }).click();
  await expect
    .poll(
      () =>
        presentations.filter(({ candidateId: id }) => id === targetCandidateId)
          .length,
    )
    .toBe(2);
  const secondTargetAttempt = presentations.filter(
    ({ candidateId: id }) => id === targetCandidateId,
  )[1]!;
  expect(secondTargetAttempt.idempotencyKey).toBe(
    firstTargetAttempt.idempotencyKey,
  );
  expect(secondTargetAttempt.body).toEqual(firstTargetAttempt.body);
  await expect(gridContainer).toHaveAttribute("data-receipt-state", "ready");
  await expect(
    page.getByText(
      "Opportunity visibility could not be recorded. Review remains available.",
    ),
  ).toHaveCount(0);

  await filter.fill("");
  const queuePositionHeader = grid.getByRole("columnheader", {
    name: "Queue position",
  });
  await queuePositionHeader.click();
  await expect(queuePositionHeader).toHaveAttribute("aria-sort", "ascending");
  await queuePositionHeader.click();
  await expect(queuePositionHeader).toHaveAttribute("aria-sort", "descending");
  await expect(firstQueuePositionCell.locator("strong")).toHaveText("25");
});

test("searches the complete rendered queue-position value", async ({ page }) => {
  const unrankedCandidateId = "idea_candidate_unranked";
  await page.route(
    "**/api/bff/api/v1/ideas/review-queues/advisor**",
    async (route) => {
      const requestedBoundary = requestedQueueBoundary(route);
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
                score: "74.5",
                priorityBucket: "standard",
                reasonCodes: ["portfolio_review_due"],
                candidate: {
                  candidateId: unrankedCandidateId,
                  materialVersion: 3,
                  evidenceVersion: 7,
                  scorePolicyVersion: "idle-liquidity-v1",
                  family: "liquidity_review",
                  reviewPosture: "advisor_review_required",
                  score: "74.5",
                  sourceSignalIds: ["signal_unranked"],
                },
              },
            ],
          },
        },
      });
    },
  );

  await page.goto(
    `/recommendations?mode=opportunities&portfolioId=${portfolioId}`,
    { waitUntil: "domcontentloaded" },
  );
  const grid = page.getByRole("grid", {
    name: "Idea candidate review queue",
    exact: true,
  });
  const candidate = grid.getByRole("link", {
    name: `Liquidity Review - ${unrankedCandidateId}`,
    exact: true,
  });
  const filter = page.getByRole("searchbox", { name: "Find an opportunity" });
  await expect(candidate).toBeVisible();

  await filter.fill("no matching opportunity");
  await expect(candidate).toHaveCount(0);
  await filter.fill("Unranked");
  await expect(candidate).toBeVisible();
  await filter.fill("74.5");
  await expect(candidate).toBeVisible();
});
