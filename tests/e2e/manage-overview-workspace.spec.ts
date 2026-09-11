import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { observeBrowserRuntimeFailures } from "./browser-runtime-reliability";
import {
  startManageFixtureGateway,
  type ManageFixtureGateway,
} from "./manage-fixture-gateway";
import { expectWorkbenchRelationshipIntegrity } from "./workbench-relationship-evidence";

test.describe.configure({ mode: "serial" });

const portfolioId = "PB_SG_GLOBAL_BAL_001";
const evidenceRoot =
  process.env.MANAGE_OVERVIEW_EVIDENCE_DIR ??
  process.env.ISSUE_811_EVIDENCE_DIR;
const evidenceDirectory = evidenceRoot
  ? path.resolve(evidenceRoot, "manage-overview")
  : null;
let fixtureGateway: ManageFixtureGateway | null = null;

test.beforeAll(async () => {
  if (process.env.MANAGE_E2E_FIXTURE !== "overview") {
    return;
  }
  const port = Number(process.env.MANAGE_E2E_FIXTURE_PORT ?? "18150");
  const expectedGateway = `http://127.0.0.1:${port}`;
  if (
    process.env.BFF_BASE_URL !== expectedGateway ||
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY !== "manage"
  ) {
    throw new Error(
      `Manage fixture proof requires the owned gateway at ${expectedGateway}.`,
    );
  }
  fixtureGateway = await startManageFixtureGateway({ port });
});

test.afterAll(async () => {
  await fixtureGateway?.close();
  fixtureGateway = null;
});

test("Manage Overview keeps the portfolio decision first without repeated destinations", async ({
  page,
}, testInfo) => {
  test.skip(!fixtureGateway, "Owned Manage fixture is not active.");
  test.setTimeout(180_000);
  const runtime = observeBrowserRuntimeFailures(page);

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 900 },
    { width: 768, height: 900 },
    { width: 519, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`/workbench/${portfolioId}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    await expect(
      page.getByRole("heading", { name: "Portfolio management decisions" }),
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("review-context-strip")).toHaveAttribute(
      "data-source-state",
      "confirmed",
    );
    await expect(page.getByLabel("Portfolio operating summary")).toContainText(
      "12,500,000.00 SGD",
    );
    await expect(page.getByText(/^Checked /)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Recheck overview" }),
    ).toBeVisible();
    await expect(page.getByLabel("Manage source evidence")).toBeVisible();
    await expect(page.getByText("Data availability", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Rebalance status", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Open attention items", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Next Actions", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Open PM Quality", exact: true }),
    ).toHaveCount(0);
    await expectWorkbenchRelationshipIntegrity(page, [
      "manage-workspace-rail-navigation",
      "manage-workspace-rail-workspace-directory",
      "manage-workspace-rail-workflow-directory",
      "manage-overview-decision-worklist-decision",
    ]);

    if (viewport.width === 1440) {
      fixtureGateway?.resetRequestPaths();
      await page.getByRole("button", { name: "Recheck overview" }).click();
      await expect(
        page.getByRole("button", { name: "Recheck overview" }),
      ).toBeEnabled();
      const paths = fixtureGateway?.getRequestPaths() ?? [];
      for (const expectedPath of [
        `/api/v1/workbench/${portfolioId}/portfolio-360`,
        "/api/v1/dpm/command-center",
        "/api/v1/dpm/command-center/exceptions",
        `/api/v1/dpm/command-center/mandates/by-portfolio/${portfolioId}`,
        `/api/v1/dpm/command-center/mandates/MANDATE_${portfolioId}/health`,
        "/api/v1/dpm/command-center/waves",
      ]) {
        expect(
          paths.filter((path) => path === expectedPath),
          `${expectedPath} should be read exactly once by one Overview recheck.`,
        ).toHaveLength(1);
      }
    }

    const compactDisclosure = page
      .getByTestId("portfolio-screen-rail-header")
      .getByRole("button", { name: /Current view/ });
    const workflowDisclosure = page.getByRole("button", {
      name: /Change workflow step/,
    });
    const openedCompactNavigation = (await workflowDisclosure.count()) === 0;
    if (openedCompactNavigation) {
      await compactDisclosure.click();
    }
    await expect(workflowDisclosure).toHaveCount(1);
    await workflowDisclosure.click();
    const workflowDirectory = page.getByTestId("workbench-workflow-directory");
    await expect(workflowDirectory.getByRole("link")).toHaveCount(8);
    await expect(
      workflowDirectory.getByRole("link", { name: /PM Quality/ }),
    ).toHaveCount(1);
    await workflowDisclosure.click();
    await expect(workflowDirectory).toBeHidden();
    if (openedCompactNavigation) {
      await compactDisclosure.click();
    }

    const worklist = page.getByRole("listbox", {
      name: "Portfolio-management decision worklist",
    });
    const decision = page.getByRole("region", {
      name: "Selected portfolio-management decision",
    });
    const firstOption = worklist.getByRole("option").first();
    const decisionId = await decision.getAttribute("id");
    expect(decisionId).not.toBeNull();
    await expect(worklist.getByRole("option")).toHaveCount(4);
    await expect(firstOption).toHaveAttribute("aria-selected", "true");
    await expect(firstOption).toHaveAttribute("aria-controls", decisionId!);
    await expect(
      page.getByText("Benchmark mapping requires review", { exact: true }),
    ).toHaveCount(1);
    await expect(
      decision.getByRole("heading", {
        name: "Confirm the benchmark assignment before the next review",
      }),
    ).toBeVisible();

    await firstOption.focus();
    await expect(firstOption).toBeFocused();
    await firstOption.press("ArrowDown");
    const secondOption = worklist.getByRole("option").nth(1);
    await expect(secondOption).toBeFocused();
    await expect(secondOption).toHaveAttribute("aria-selected", "true");
    await secondOption.press("Home");
    await expect(firstOption).toBeFocused();
    await firstOption.press("Enter");
    await expect(decision).toBeFocused();

    await expect(
      page.getByRole("heading", { name: "Continue Portfolio Management" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Manage work areas" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Recent Operating Activity" }),
    ).toHaveCount(0);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(() => window.scrollY === 0);

    const geometry = await page.evaluate(() => {
      const firstRow = document.querySelector<HTMLElement>(
        '[aria-label="Portfolio-management decision worklist"] [role="option"]',
      );
      const worklistRegion = document.querySelector<HTMLElement>(
        '[aria-label="Portfolio-management decision worklist"]',
      );
      const decisionRegion = document.querySelector<HTMLElement>(
        '[aria-label="Selected portfolio-management decision"]',
      );
      const overviewPanel = document.querySelector<HTMLElement>(
        ".manage-overview-panel",
      );
      if (!firstRow || !worklistRegion || !decisionRegion || !overviewPanel) {
        throw new Error("Manage decision-workspace geometry is unavailable.");
      }
      return {
        firstRowTop: firstRow.getBoundingClientRect().top,
        worklistBottom: worklistRegion.getBoundingClientRect().bottom,
        decisionTop: decisionRegion.getBoundingClientRect().top,
        worklistRight: worklistRegion.getBoundingClientRect().right,
        decisionRight: decisionRegion.getBoundingClientRect().right,
        decisionLeft: decisionRegion.getBoundingClientRect().left,
        overviewRight: overviewPanel.getBoundingClientRect().right,
        documentHeight: document.documentElement.scrollHeight,
        clientWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
      };
    });

    expect(
      geometry.documentWidth,
      `Manage Overview has page-level horizontal overflow at ${viewport.width}px.`,
    ).toBeLessThanOrEqual(geometry.clientWidth);
    if (viewport.width === 1440) {
      expect(geometry.firstRowTop).toBeLessThan(900);
      expect(geometry.decisionTop).toBeLessThan(900);
      expect(geometry.decisionLeft).toBeGreaterThanOrEqual(geometry.worklistRight);
      expect(
        geometry.documentHeight,
        "Manage Overview must remain at least 40% shorter than the 2,000px baseline capture.",
      ).toBeLessThanOrEqual(1200);
    }
    expect(geometry.decisionRight).toBeLessThanOrEqual(geometry.overviewRight);
    if (viewport.width === 519) {
      expect(geometry.decisionTop).toBeGreaterThanOrEqual(geometry.worklistBottom);
    }

    await page.mouse.move(0, 0);
    if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true });
      await page.screenshot({
        path: path.join(evidenceDirectory, `manage-overview-${viewport.width}.png`),
        fullPage: true,
      });
    }
    await testInfo.attach(`manage-overview-${viewport.width}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  }

  await runtime.assertStylesAreHeadManaged();
  runtime.assertClean();
});
