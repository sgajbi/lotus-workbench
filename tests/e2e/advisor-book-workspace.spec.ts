import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const evidenceDirectory = path.resolve(
  process.env.ISSUE_811_EVIDENCE_DIR ?? path.join("output", "issue-811"),
  "advisor-book",
);

const advisorBookResponse = {
  correlation_id: "corr-advisor-book-e2e",
  contract_version: "v1",
  scope: {
    kind: "own_book",
    label: "My book",
    as_of_date: "2026-04-10",
    booking_center_code: "Singapore",
  },
  page: {
    total_count: 2,
    offset: 0,
    limit: 25,
    returned_count: 2,
    sort_by: "portfolio_id",
    sort_order: "asc",
  },
  items: [
    {
      portfolio_id: "PB_SG_GLOBAL_BAL_001",
      display_name: "Global Balanced Mandate",
      client_id: "CIF_SG_GLOBAL_BAL_001",
      base_currency: "USD",
      booking_center_code: "Singapore",
      mandate_type: "DISCRETIONARY",
      status: "ACTIVE",
      opened_on: "2025-03-31",
      closed_on: null,
      membership_source: "PortfolioManagerBookMembership:v1",
      membership_reference: "portfolio:PB_SG_GLOBAL_BAL_001",
      membership_basis: "legacy_advisor_projection",
    },
    {
      portfolio_id: "PB_SG_INCOME_002",
      display_name: "Income Mandate",
      client_id: "CIF_SG_INCOME_002",
      base_currency: "SGD",
      booking_center_code: "Singapore",
      mandate_type: "ADVISORY",
      status: "ACTIVE",
      opened_on: "2025-04-01",
      closed_on: null,
      membership_source: "PortfolioManagerBookMembership:v1",
      membership_reference: "portfolio:PB_SG_INCOME_002",
      membership_basis: "governed_role_assignment",
    },
  ],
  supportability: {
    state: "degraded",
    reason_code: "advisor_book_legacy_projection",
    tenant_scope: "trusted_context_only",
    limitations: [
      "legacy_advisor_projection",
      "tenant_scope_not_reported",
      "delegated_scope_not_supported",
    ],
  },
  provenance: {
    product_name: "PortfolioManagerBookMembership",
    product_version: "v1",
    generated_at: "2026-04-10T02:00:00Z",
    latest_evidence_timestamp: "2026-04-10T01:59:00Z",
    freshness_status: "CURRENT",
    data_quality_status: "ACCEPTED",
    source_evidence_current: true,
    snapshot_id: "pm_book_membership:e2e",
    content_hash: "sha256:e2e",
    lineage: { source_owner: "lotus-core" },
  },
};

async function mockAdvisorBook(page: Page) {
  await mockShellFallback(page);
  await page.route("**/api/bff/api/v1/advisor-book/portfolios?**", async (route) => {
    await route.fulfill({ json: advisorBookResponse });
  });
}

async function mockShellFallback(page: Page) {
  await page.route("**/api/bff/api/v1/platform/capabilities?**", async (route) => {
    await route.fulfill({ status: 503, json: { code: "shell_bootstrap_unavailable" } });
  });
}

async function assertWorkspaceAvailabilityAffordances(page: Page) {
  const navigation = page.getByRole("navigation", { name: "Workspace Navigation" });
  const switcher = navigation.getByRole("button", { name: /Switch workspace/i });
  if ((await switcher.getAttribute("aria-expanded")) !== "true") {
    await switcher.click();
  }

  await expect(navigation.getByText("Workspace directory")).toBeVisible();
  const enabledWorkspace = navigation.getByRole("link", { name: "Performance" });
  const unavailableWorkspace = navigation.getByTitle(
    "Proposal availability could not be confirmed.",
  );
  await expect(enabledWorkspace).toBeVisible();
  await expect(unavailableWorkspace).toHaveAttribute("aria-disabled", "true");

  const readAffordance = async (locator: typeof enabledWorkspace) =>
    locator.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        borderLeftColor: style.borderLeftColor,
      };
    });

  const unavailableRest = await readAffordance(unavailableWorkspace);
  const enabledRest = await readAffordance(enabledWorkspace);
  await unavailableWorkspace.hover();
  await expect.poll(() => readAffordance(unavailableWorkspace)).toEqual(unavailableRest);
  await enabledWorkspace.hover();
  await expect
    .poll(async () => {
      const enabledHover = await readAffordance(enabledWorkspace);
      return (
        enabledHover.backgroundColor !== enabledRest.backgroundColor ||
        enabledHover.borderLeftColor !== enabledRest.borderLeftColor
      );
    })
    .toBe(true);
}

test("supports a keyboard-complete own-book review and portfolio handoff", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  let advisorBookRequestCount = 0;
  await mockShellFallback(page);
  await page.route("**/api/bff/api/v1/advisor-book/portfolios?**", async (route) => {
    advisorBookRequestCount += 1;
    await route.fulfill({ json: advisorBookResponse });
  });
  await page.goto("/book?asOfDate=2026-04-10", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Private Banking Workbench", { exact: true })).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Notifications" })).toHaveCount(0);
  await expect(page.getByText("Jordan Davis", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "My book", exact: true })).toBeVisible();
  await expect(page.getByText("Available with limitations")).toBeVisible();
  const summaryStrip = page.getByLabel("Current book view");
  await expect(summaryStrip).toBeVisible();
  expect(
    await summaryStrip.evaluate((element) =>
      getComputedStyle(element)
        .gridTemplateColumns.split(" ")
        .filter((track) => track !== "0px").length,
    ),
  ).toBe(4);
  expect((await summaryStrip.boundingBox())?.height).toBeLessThan(150);
  await expect(page.getByRole("table", { name: "Portfolios in my book" })).toBeVisible();
  await expect(page.getByText(/Checked (just now|\d+ (second|minute)s? ago)/i)).toBeVisible();
  expect(advisorBookRequestCount).toBe(1);
  await page.getByRole("button", { name: "Recheck book" }).click();
  await expect.poll(() => advisorBookRequestCount).toBe(2);
  await expect(page.getByRole("button", { name: "Recheck book" })).toBeEnabled();
  const sourceRows = page.locator('[data-advisor-book-row="portfolio"]');
  await expect(sourceRows).toHaveCount(advisorBookResponse.items.length);
  for (const sourceItem of advisorBookResponse.items) {
    const sourceRow = page.locator(
      `[data-advisor-book-row="portfolio"][data-portfolio-id="${sourceItem.portfolio_id}"]`,
    );
    await expect(sourceRow).toHaveCount(1);
    await expect(sourceRow).toHaveAttribute("data-lifecycle-state", sourceItem.status);
  }
  const supportDisclosure = page.locator("details").filter({
    hasText: "Book scope and operating evidence",
  });
  await expect(supportDisclosure).not.toHaveAttribute("open", "");
  await expect(page.getByText("Own book only")).toBeHidden();
  await expect(page.getByText("Legacy assignment evidence")).toBeHidden();
  await expect(page.getByText("advisor_book_legacy_projection", { exact: true })).toBeHidden();
  await supportDisclosure.getByText("Book scope and operating evidence").click();
  await expect(supportDisclosure).toHaveAttribute("open", "");
  await expect(page.getByText("Own book only")).toBeVisible();
  await expect(page.getByText("Legacy assignment evidence")).toBeVisible();
  await expect(page.getByText("advisor_book_legacy_projection", { exact: true })).toBeVisible();
  await supportDisclosure.getByText("Book scope and operating evidence").click();
  await expect(supportDisclosure).not.toHaveAttribute("open", "");
  await expect(page.getByText(/team book|household|AUM|attention rank/i)).toHaveCount(0);

  const firstPortfolioRow = page
    .getByRole("table", { name: "Portfolios in my book" })
    .getByRole("row")
    .nth(1);
  expect((await firstPortfolioRow.boundingBox())?.y).toBeLessThan(900);
  await mkdir(evidenceDirectory, { recursive: true });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(0, 0);
  await page.screenshot({
    path: path.join(evidenceDirectory, "advisor-book-1440.png"),
    fullPage: true,
    animations: "disabled",
  });

  const workspaceSwitcher = page.getByRole("button", {
    name: "Switch workspace. Current workspace Portfolio",
  });
  await workspaceSwitcher.focus();
  await page.keyboard.press("Enter");
  await expect(workspaceSwitcher).toHaveAttribute("aria-expanded", "true");
  await assertWorkspaceAvailabilityAffordances(page);
  const unavailableProposal = page.getByTitle(
    "Proposal availability could not be confirmed.",
  );
  await expect(unavailableProposal).toContainText("Proposal");
  await expect(unavailableProposal).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator('[title*="disabled_in_fallback"]')).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(workspaceSwitcher).toHaveAttribute("aria-expanded", "false");
  await expect(workspaceSwitcher).toBeFocused();

  await page.getByRole("textbox", { name: "Client reference" }).focus();
  await page.keyboard.type("CIF_SG_GLOBAL_BAL_001");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("combobox", { name: "Mandate" })).toBeFocused();
  await page.getByRole("combobox", { name: "Sort direction" }).selectOption("desc");
  await page.getByRole("button", { name: "Apply view" }).click();
  await expect(page).toHaveURL(/clientId=CIF_SG_GLOBAL_BAL_001/);
  await expect(page).toHaveURL(/sortOrder=desc/);
  await expect(page.getByRole("button", { name: "Clear view" })).toBeVisible();
  await expect(
    page.getByText(
      /Displayed order: Portfolio reference, ascending · Requested order: Portfolio reference, descending/i,
    ),
  ).toBeVisible();

  await expect(
    page.getByRole("link", { name: "Global Balanced Mandate" }),
  ).toHaveAttribute(
    "href",
    "/portfolio?portfolioId=PB_SG_GLOBAL_BAL_001&asOfDate=2026-04-10",
  );
});

test("keeps the admitted book visible when an explicit recheck fails", async ({ page }) => {
  let advisorBookRequestCount = 0;
  await mockShellFallback(page);
  await page.route("**/api/bff/api/v1/advisor-book/portfolios?**", async (route) => {
    advisorBookRequestCount += 1;
    if (advisorBookRequestCount === 1) {
      await route.fulfill({ json: advisorBookResponse });
      return;
    }
    await route.fulfill({
      status: 502,
      json: { code: "advisor_book_source_unavailable" },
    });
  });
  await page.goto("/book?asOfDate=2026-04-10", { waitUntil: "domcontentloaded" });

  const table = page.getByRole("table", { name: "Portfolios in my book" });
  await expect(table).toBeVisible();
  await page.getByRole("button", { name: "Recheck book" }).click();

  await expect(page.getByText(/Book recheck failed/i)).toBeVisible();
  await expect(table).toBeVisible();
  await expect(table.locator('[data-advisor-book-row="portfolio"]')).toHaveCount(
    advisorBookResponse.items.length,
  );
  expect(advisorBookRequestCount).toBe(2);
});

for (const viewport of [
  { name: "1024", width: 1024, height: 900 },
  { name: "519", width: 519, height: 844 },
]) {
  test(`keeps My book dense and progressive at ${viewport.name}px`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mockAdvisorBook(page);
    await page.goto("/book?asOfDate=2026-04-10", { waitUntil: "domcontentloaded" });

    const summaryStrip = page.getByLabel("Current book view");
    const supportDisclosure = page.locator("details").filter({
      hasText: "Book scope and operating evidence",
    });
    await expect(summaryStrip).toBeVisible();
    await expect(page.getByRole("table", { name: "Portfolios in my book" })).toBeVisible();
    await expect(supportDisclosure).not.toHaveAttribute("open", "");
    await expect(page.getByText("advisor_book_legacy_projection", { exact: true })).toBeHidden();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);

    await mkdir(evidenceDirectory, { recursive: true });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: path.join(evidenceDirectory, `advisor-book-${viewport.name}.png`),
      fullPage: true,
      animations: "disabled",
    });
  });
}

test("keeps the book usable at tablet and effective 200 percent zoom width", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 1000 });
  await mockAdvisorBook(page);
  await page.goto("/book?asOfDate=2026-04-10", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Private Banking Workbench", { exact: true })).toBeVisible();
  await expect(page.getByRole("table", { name: "Portfolios in my book" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Client reference" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Mandate" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Sort by" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Sort direction" })).toBeVisible();
  await assertWorkspaceAvailabilityAffordances(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("fails visibly without falling back to a global portfolio catalogue", async ({ page }) => {
  await mockShellFallback(page);
  await page.route("**/api/bff/api/v1/advisor-book/portfolios?**", async (route) => {
    await route.fulfill({ status: 502, json: { code: "advisor_book_source_unavailable" } });
  });
  await page.goto("/book?asOfDate=2026-04-10", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Your book could not be loaded")).toBeVisible();
  await expect(page.getByText(/No broader portfolio list has been substituted/i)).toBeVisible();
  await expect(page.getByText(/HTTP status 502/i)).toBeVisible();
  await expect(page.getByText(/Reference 502/i)).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Portfolios in my book" })).toHaveCount(0);
});

test("fails closed on an invalid business date and recovers through explicit selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let advisorBookRequestCount = 0;
  await mockShellFallback(page);
  await page.route("**/api/bff/api/v1/advisor-book/portfolios?**", async (route) => {
    advisorBookRequestCount += 1;
    await route.fulfill({ json: advisorBookResponse });
  });

  await page.goto("/book?asOfDate=not-a-date", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Business date not confirmed")).toBeVisible();
  await expect(page.getByText(/Portfolio assignments have not been requested/i)).toBeVisible();
  const businessDate = page.getByLabel("Business date", { exact: true });
  const reviewBook = page.getByRole("button", { name: "Review book" });
  await expect(businessDate).toBeVisible();
  expect(advisorBookRequestCount).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);

  await businessDate.focus();
  await businessDate.fill("2026-04-10");
  for (let index = 0; index < 5; index += 1) {
    if (await reviewBook.evaluate((element) => document.activeElement === element)) {
      break;
    }
    await page.keyboard.press("Tab");
  }
  await expect(reviewBook).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/asOfDate=2026-04-10/);
  await expect(page.getByText("Available with limitations")).toBeVisible();
  expect(advisorBookRequestCount).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
