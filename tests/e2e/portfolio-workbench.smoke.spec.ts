import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { test, expect } from '@playwright/test';
import {
  measureGrid,
} from './workbench-smoke-helpers';
import {
  collectReviewContextLayoutEvidence,
  collectReviewContextOwnershipEvidence,
  collectReviewContextTypographyEvidence,
  collectFocusableDomOrder,
  measureViewportEvidence,
  traverseSequentialKeyboardFocus,
} from './workbench-accessibility-evidence';
import { observeBrowserRuntimeFailures } from './browser-runtime-reliability';
import { expectWorkbenchRelationshipIntegrity } from './workbench-relationship-evidence';
import {
  startPortfolioFixtureGateway,
  type PortfolioFixtureScenario,
  type PortfolioFixtureGateway,
} from './portfolio-fixture-gateway';

test.describe.configure({ mode: 'default' });

let fixtureGateway: PortfolioFixtureGateway | null = null;

test.beforeAll(async () => {
  const scenario = process.env.PORTFOLIO_E2E_FIXTURE;
  if (
    scenario !== 'cashflow' &&
    scenario !== 'allocation-recovery' &&
    scenario !== 'income-activity' &&
    scenario !== 'review-context-states' &&
    scenario !== 'shell-unavailable' &&
    scenario !== 'positions-status' &&
    scenario !== 'transactions-status' &&
    scenario !== 'transaction-navigation'
  ) {
    return;
  }
  const port = Number(process.env.PORTFOLIO_E2E_FIXTURE_PORT ?? '18120');
  const expectedGateway = `http://127.0.0.1:${port}`;
  if (
    process.env.BFF_BASE_URL !== expectedGateway ||
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY !== 'portfolio'
  ) {
    throw new Error(`Portfolio fixture proof requires the owned gateway at ${expectedGateway}.`);
  }
  fixtureGateway = await startPortfolioFixtureGateway({
    port,
    scenario: scenario as PortfolioFixtureScenario,
  });
});
test.afterAll(async () => {
  await fixtureGateway?.close();
  fixtureGateway = null;
});

async function resolveSmokePortfolioId(request: import('@playwright/test').APIRequestContext) {
  const response = await request.get('/api/bff/api/v1/portfolio/portfolios', {
    timeout: 30000,
  });
  if (!response.ok()) {
    return null;
  }
  const payload = (await response.json()) as {
    items?: Array<{ portfolio_id: string }>;
  };
  const portfolioIds = payload.items?.map((item) => item.portfolio_id) ?? [];
  return (
    portfolioIds.find((candidate) => candidate === 'PB_SG_GLOBAL_BAL_001') ??
    portfolioIds.find((candidate) => candidate === 'DEMO_ADV_USD_001') ??
    portfolioIds[0]
  );
}

async function openPortfolioReview(
  page: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext
) {
  const portfolioId = await resolveSmokePortfolioId(request);
  if (!portfolioId) {
    await page.goto('/portfolio', {
      waitUntil: 'domcontentloaded',
    });
    return { portfolioId: null, available: false };
  }

  await page.goto(`/portfolio?portfolioId=${portfolioId}`, {
    waitUntil: 'domcontentloaded',
  });

  const unavailableHeading = page.getByRole('heading', { name: /^Portfolio unavailable$/i });
  const unavailableVisible = await unavailableHeading.isVisible().catch(() => false);
  if (unavailableVisible) {
    return { portfolioId, available: false };
  }

  await expect(page.getByRole('heading', { name: /^Portfolio Review$/i })).toBeVisible({ timeout: 15000 });

  return { portfolioId, available: true };
}

async function expectProductiveReviewContextTypography(
  page: import('@playwright/test').Page,
  sourceState: 'confirmed' | 'partial' | 'unavailable'
) {
  const typography = await collectReviewContextTypographyEvidence(page);
  expect(typography).toMatchObject({
    eyebrow: {
      fontSize: '12px',
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    factLabel: {
      fontSize: '12px',
      fontWeight: '500',
      textTransform: 'none',
    },
    factValue: {
      fontSize: '14px',
      fontWeight: sourceState === 'unavailable' ? '400' : '500',
      textTransform: 'none',
    },
    supportControl: {
      fontSize: '14px',
      fontWeight: '600',
      textTransform: 'none',
    },
  });
  expect(
    Object.values(typography).every(({ fontFamily }) =>
      fontFamily.includes('IBM Plex Sans')
    )
  ).toBe(true);
  return typography;
}

function expectReviewContextLayout(
  layout: Awaited<ReturnType<typeof collectReviewContextLayoutEvidence>>,
  viewportWidth: number
) {
  expect(layout.domOrder).toEqual([
    'portfolio-name',
    'business-date',
    'currency',
    'mandate',
    'booking-centre',
    'support-details',
  ]);
  expect(layout.slots.every((slot) => slot.slot.length > 0)).toBe(true);
  expect(
    layout.slots.every(
      (slot) =>
        slot.scrollWidth <= slot.clientWidth + 1 &&
        slot.scrollHeight <= slot.clientHeight + 1
    )
  ).toBe(true);

  const slots = Object.fromEntries(layout.slots.map((slot) => [slot.slot, slot]));
  const businessDate = slots['business-date'];
  const currency = slots.currency;
  const mandate = slots.mandate;
  const bookingCentre = slots['booking-centre'];

  if (!businessDate || !currency || !mandate || !bookingCentre) {
    throw new Error('Review Context business slots are incomplete.');
  }

  if (viewportWidth >= 1200) {
    const facts = [businessDate, currency, mandate, bookingCentre];
    expect(new Set(facts.map((slot) => slot.top)).size).toBe(1);
    for (let index = 1; index < facts.length; index += 1) {
      const horizontalGap = facts[index].left - facts[index - 1].right;
      expect(horizontalGap).toBeGreaterThanOrEqual(16);
      expect(horizontalGap).toBeLessThanOrEqual(48);
    }
  }

  if (viewportWidth <= 760 && viewportWidth > 360) {
    expect(businessDate.top).toBe(currency.top);
    expect(mandate.top).toBe(bookingCentre.top);
    expect(mandate.top).toBeGreaterThan(businessDate.top);
  }
}

async function openIncomePortfolio(
  page: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext
) {
  const portfolioId = await resolveSmokePortfolioId(request);
  if (!portfolioId) {
    await page.goto('/income', { waitUntil: 'domcontentloaded' });
    return { portfolioId: null, available: false };
  }

  await page.goto(`/income?portfolioId=${portfolioId}`, { waitUntil: 'domcontentloaded' });
  const unavailableHeading = page.getByRole('heading', { name: /^Portfolio records unavailable$/i });
  const unavailableVisible = await unavailableHeading.isVisible().catch(() => false);
  if (unavailableVisible) {
    return { portfolioId, available: false };
  }

  await expect(page.getByRole('heading', { name: 'Income and activity', exact: true })).toBeVisible({
    timeout: 15000,
  });
  return { portfolioId, available: true };
}

async function openAllocationPortfolio(
  page: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext
) {
  const portfolioId = await resolveSmokePortfolioId(request);
  if (!portfolioId) {
    await page.goto('/allocation', { waitUntil: 'domcontentloaded' });
    return { portfolioId: null, available: false };
  }

  await page.goto(`/allocation?portfolioId=${portfolioId}`, { waitUntil: 'domcontentloaded' });
  const unavailableHeading = page.getByRole('heading', { name: /^Portfolio records unavailable$/i });
  const unavailableVisible = await unavailableHeading.isVisible().catch(() => false);
  if (unavailableVisible) {
    return { portfolioId, available: false };
  }

  await expect(page.getByRole('heading', { name: /^Allocation$/i })).toBeVisible({
    timeout: 15000,
  });
  return { portfolioId, available: true };
}

async function openPositionsPortfolio(
  page: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext
) {
  const portfolioId = await resolveSmokePortfolioId(request);
  if (!portfolioId) {
    await page.goto('/positions', { waitUntil: 'domcontentloaded' });
    return { portfolioId: null, available: false };
  }

  await page.goto(`/positions?portfolioId=${portfolioId}`, { waitUntil: 'domcontentloaded' });
  const unavailableHeading = page.getByRole('heading', { name: /^Portfolio records unavailable$/i });
  const unavailableVisible = await unavailableHeading.isVisible().catch(() => false);
  if (unavailableVisible) {
    return { portfolioId, available: false };
  }

  await expect(page.getByRole('heading', { name: /^Positions$/i })).toBeVisible({
    timeout: 15000,
  });
  return { portfolioId, available: true };
}

async function openTransactionsPortfolio(
  page: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext
) {
  const portfolioId = await resolveSmokePortfolioId(request);
  if (!portfolioId) {
    await page.goto('/transactions', { waitUntil: 'domcontentloaded' });
    return { portfolioId: null, available: false };
  }

  await page.goto(`/transactions?portfolioId=${portfolioId}`, {
    waitUntil: 'domcontentloaded',
  });
  const unavailableHeading = page.getByRole('heading', { name: /^Portfolio records unavailable$/i });
  const unavailableVisible = await unavailableHeading.isVisible().catch(() => false);
  if (unavailableVisible) {
    return { portfolioId, available: false };
  }

  await expect(page.getByRole('heading', { name: /^Transactions$/i })).toBeVisible({
    timeout: 15000,
  });
  return { portfolioId, available: true };
}

async function openCashflowPortfolio(
  page: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext
) {
  const portfolioId = await resolveSmokePortfolioId(request);
  if (!portfolioId) {
    await page.goto('/cashflow', { waitUntil: 'domcontentloaded' });
    return { portfolioId: null, available: false };
  }

  await page.goto(`/cashflow?portfolioId=${portfolioId}`, {
    waitUntil: 'domcontentloaded',
  });
  const unavailableHeading = page.getByRole('heading', { name: /^Portfolio records unavailable$/i });
  const unavailableVisible = await unavailableHeading.isVisible().catch(() => false);
  if (unavailableVisible) {
    return { portfolioId, available: false };
  }

  await expect(page.getByRole('heading', { name: /^Projected cash flow$/i })).toBeVisible({
    timeout: 15000,
  });
  return { portfolioId, available: true };
}

test.describe('Portfolio workbench smoke', () => {
  test('review context keeps productive typography across source states', async ({ page }) => {
    test.skip(
      process.env.PORTFOLIO_E2E_FIXTURE !== 'review-context-states',
      'Review Context state proof requires the owned partial-context fixture.'
    );
    const evidenceDirectory = process.env.PORTFOLIO_E2E_EVIDENCE_DIR;
    const evidence = [];

    for (const sourceState of ['confirmed', 'partial', 'unavailable'] as const) {
      if (sourceState !== 'unavailable') {
        fixtureGateway?.setReviewContextSourceState(sourceState);
      }
      const portfolioId =
        sourceState === 'unavailable' ? 'PB_CONTEXT_NOT_AVAILABLE' : 'PB_SG_GLOBAL_BAL_001';

      for (const viewport of [
        { width: 1440, height: 1000 },
        { width: 1024, height: 1000 },
        { width: 768, height: 1024 },
        { width: 519, height: 900 },
      ]) {
        await page.setViewportSize(viewport);
        await page.goto(`/portfolio?portfolioId=${portfolioId}`, {
          waitUntil: 'domcontentloaded',
        });
        const reviewContext = page.getByTestId('review-context-strip');
        await expect(reviewContext).toBeVisible({ timeout: 15_000 });
        await expect(reviewContext).toHaveAttribute('data-source-state', sourceState);
        if (sourceState === 'confirmed') {
          await expect(reviewContext.locator('dd[data-confirmed="false"]')).toHaveCount(0);
        } else {
          await expect(reviewContext.locator('dd[data-confirmed="false"]').first()).toHaveText(
            'Not confirmed'
          );
        }
        const typography = await expectProductiveReviewContextTypography(page, sourceState);
        const layout = await collectReviewContextLayoutEvidence(page);
        expectReviewContextLayout(layout, viewport.width);
        const measurements = await measureViewportEvidence(page);
        expect(measurements.document.scrollWidth).toBeLessThanOrEqual(
          measurements.document.clientWidth + 1
        );

        evidence.push({ sourceState, viewport, typography, layout, measurements });
        if (evidenceDirectory) {
          await mkdir(evidenceDirectory, { recursive: true });
          await reviewContext.screenshot({
            path: resolve(
              evidenceDirectory,
              `diagnostic-${sourceState}-review-context-${viewport.width}.png`
            ),
          });
        }
      }
    }

    for (const viewportWidth of [1440, 1024, 768, 519]) {
      const stateEvidence = evidence.filter(({ viewport }) => viewport.width === viewportWidth);
      expect(stateEvidence).toHaveLength(3);
      const confirmedEvidence = stateEvidence.find(
        ({ sourceState }) => sourceState === 'confirmed'
      );
      if (!confirmedEvidence) {
        throw new Error(`Confirmed Review Context evidence is missing at ${viewportWidth}px.`);
      }
      const confirmedRows = confirmedEvidence.layout.slots.map((slot) => ({
        slot: slot.slot,
        relativeTop: slot.top - confirmedEvidence.layout.strip.top,
      }));

      for (const state of stateEvidence) {
        expect(state.layout.domOrder).toEqual(confirmedEvidence.layout.domOrder);
        expect(state.layout.strip.height).toBe(confirmedEvidence.layout.strip.height);
        expect(
          state.layout.slots.map((slot) => ({
            slot: slot.slot,
            relativeTop: slot.top - state.layout.strip.top,
          }))
        ).toEqual(confirmedRows);
      }
    }

    if (evidenceDirectory) {
      await writeFile(
        resolve(evidenceDirectory, 'review-context-typography-states.json'),
        `${JSON.stringify({ proofType: 'owned source-state fixture', evidence }, null, 2)}\n`,
        'utf8'
      );
    }
  });

  test('selected shell failure reaches one truthful terminal recovery state', async ({
    page,
  }) => {
    test.skip(
      process.env.PORTFOLIO_E2E_FIXTURE !== 'shell-unavailable',
      'Selected-shell failure proof requires the owned unavailable fixture.'
    );
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(`/portfolio?portfolioId=PB_SG_GLOBAL_BAL_001`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.getByTestId('portfolio-shell-unavailable')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('heading', { name: 'Selected portfolio unavailable' })).toBeVisible();
    await expect(page.getByText(/no other portfolio has been substituted/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open My book' }).first()).toHaveAttribute(
      'href',
      '/book'
    );
    await expect(page.getByText('Preparing portfolio review')).toHaveCount(0);

    await expect
      .poll(() => fixtureGateway?.getWorkspaceRequestCount(), {
        message: 'one server read and one bounded client recovery read should reach the fixture',
      })
      .toBe(2);
    await page.waitForTimeout(300);
    expect(fixtureGateway?.getWorkspaceRequestCount()).toBe(2);

    const evidenceDirectory = process.env.PORTFOLIO_E2E_EVIDENCE_DIR;
    if (evidenceDirectory) {
      await page.screenshot({
        path: `${evidenceDirectory}/selected-shell-unavailable.png`,
        fullPage: true,
      });
    }
  });

  test('record navigation preserves one selected portfolio across all five business tasks', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1800, height: 1400 });
    const session = await openPositionsPortfolio(page, request);
    test.skip(!session.available, 'Portfolio records upstream unavailable in standalone smoke environment.');

    const destinations = [
      { label: 'Allocation', route: '/allocation', heading: /^Allocation$/i },
      { label: 'Transactions', route: '/transactions', heading: /^Transactions$/i },
      { label: 'Income', route: '/income', heading: /^Income and activity$/ },
      { label: 'Projected cash flow', route: '/cashflow', heading: /^Projected cash flow$/i },
      { label: 'Positions', route: '/positions', heading: /^Positions$/i },
    ];

    for (const destination of destinations) {
      await page
        .getByRole('navigation', { name: 'Workbench screen navigation' })
        .getByRole('link', { name: new RegExp(`^${destination.label}`) })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`${destination.route}\\?portfolioId=${session.portfolioId}$`)
      );
      await expect(page.getByRole('heading', { name: destination.heading }).first()).toBeVisible();
      await expect(page.getByText(session.portfolioId!, { exact: true }).first()).toBeVisible();
    }
  });

  test('record recovery preserves confirmed portfolio context while withholding unsupported controls', async ({
    page,
  }) => {
    test.skip(
      process.env.PORTFOLIO_E2E_FIXTURE !== 'cashflow',
      'Confirmed record-recovery proof requires the owned populated portfolio fixture.',
    );
    await page.setViewportSize({ width: 1440, height: 1000 });

    const destinations = [
      { route: '/allocation', heading: /^Allocation$/i },
      { route: '/positions', heading: /^Positions$/i },
      { route: '/transactions', heading: /^Transactions$/i },
      { route: '/income', heading: /^Income and activity$/ },
      { route: '/cashflow', heading: /^Projected cash flow$/i },
    ];

    for (const destination of destinations) {
      await page.goto(
        `${destination.route}?portfolioId=PB_SG_GLOBAL_BAL_001&period=5Y`,
        { waitUntil: 'domcontentloaded' },
      );

      await expect(
        page.getByRole('heading', { name: destination.heading }).first(),
      ).toBeVisible();
      const reviewContext = page.getByRole('region', { name: 'Review context' });
      await expect(reviewContext).toHaveAttribute('data-source-state', 'confirmed');
      await expect(reviewContext).toContainText('Global Balanced Mandate');
      await expect(reviewContext).toContainText('CLIENT_SG_001');
      await expect(reviewContext).not.toContainText('Portfolio not confirmed');
      await expect(
        page.getByText(
          'The selected date, period, or reporting currency is not supported for these portfolio records.',
        ),
      ).toBeVisible();
      await expect(page.getByTestId('portfolio-screen-rail')).toBeVisible();
      await expect(page.locator('.portfolio-record-key-figures')).toHaveCount(0);
    }
  });

  test('portfolio review stays decision-focused and keeps detail work on dedicated screens', async ({ page, request }) => {
    test.setTimeout(90_000);
    const browserRuntime = observeBrowserRuntimeFailures(page);
    await page.setViewportSize({ width: 1800, height: 1400 });
    const session = await openPortfolioReview(page, request);
    test.skip(!session.available, 'Portfolio workspace upstream unavailable in standalone smoke environment.');

    await expect(page.getByText('MTD return')).toBeVisible();
    await expect(page.getByText('QTD return')).toBeVisible();
    await expect(page.getByText('YTD return')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Portfolio decision review' })).toBeVisible();
    await expect(page.getByLabel('As of')).toBeVisible();
    const allWorkspaces = page.getByRole('button', { name: /All workspaces/i });
    await expect(allWorkspaces).toHaveAttribute('aria-expanded', 'false');
    await allWorkspaces.click();
    await expect(allWorkspaces).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('link', { name: /Income and activity/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(allWorkspaces).toBeFocused();
    await expect(page.getByRole('button', { name: /^Filters/i })).toHaveCount(0);

    if (process.env.PORTFOLIO_E2E_FIXTURE === 'cashflow') {
      await expect(
        page.getByRole('button', { name: 'Portfolio value: 12,500,000 USD' }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Performance evidence is qualified' })
      ).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Source Limitations' })).toBeVisible();
      await expect(page.getByText('MTD performance unavailable')).toBeVisible();
      await expect(
        page.getByText('MTD valuation history is incomplete; no return is shown.')
      ).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Portfolio review is ready' })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Recommended Actions' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Open Performance' })).toBeVisible();
      await expect(page.getByText('BMK_GLOBAL_BALANCED_60_40', { exact: true })).toBeVisible();
    }

    await expect(page.getByRole('heading', { name: /Asset Allocation/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Ranked positions/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Cashflow Forecast/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Liquidity and Projected Cash/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Performance Snapshot/i })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /^Summary$/i })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /^Detailed$/i })).toHaveCount(0);
    await expect(page.locator('.portfolio-paired-analytics-grid')).toHaveCount(0);
    await expect(page.locator('.portfolio-paired-analytics-grid-detailed')).toHaveCount(0);
    await expect(page.locator('.portfolio-data-grid')).toHaveCount(0);
    await expect(page.getByLabel('Income summary')).toHaveCount(0);
    await expect(page.getByLabel('Activity summary')).toHaveCount(0);
    await expect(page.getByLabel(/Projected cashflow chart in /i)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /^Holdings$/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /^Transactions$/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Projected Cashflow/i })).toHaveCount(0);

    const summaryModuleMetrics = await measureGrid(page.locator('.portfolio-summary-cluster').first());
    expect(summaryModuleMetrics.width).toBeGreaterThan(900);

    const viewportEvidence = [];
    const evidenceDirectory = process.env.PORTFOLIO_E2E_EVIDENCE_DIR;
    const capturesIssue649Evidence =
      process.env.PORTFOLIO_E2E_PROOF_SCENARIO === 'review-matrix' && Boolean(evidenceDirectory);

    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 1024, height: 1000 },
      { width: 768, height: 1024 },
      { width: 721, height: 1000 },
      { width: 720, height: 1000 },
      { width: 561, height: 900 },
      { width: 519, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(page.getByRole('heading', { name: /^Portfolio Review$/i })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Portfolio decision review' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Export portfolio data/i })).toBeVisible();
      const reviewContext = page.getByTestId('review-context-strip');
      await expect(reviewContext).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Book Context' })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Review Evidence' })).toBeVisible();
      await expect(reviewContext.getByText(session.portfolioId!, { exact: true })).toHaveCount(1);
      const businessDateValue = (
        await reviewContext
          .locator('dt')
          .filter({ hasText: 'Business date' })
          .locator('xpath=following-sibling::dd[1]')
          .textContent()
      )?.trim();
      expect(businessDateValue).toBeTruthy();
      const identityOwnership = await collectReviewContextOwnershipEvidence(page, [
        session.portfolioId!,
        'CLIENT_SG_001',
        'Singapore',
        businessDateValue!,
      ]);
      expect(identityOwnership.every((fact) => fact.presentInReviewContext)).toBe(true);
      expect(identityOwnership.every((fact) => !fact.presentOutsideReviewContext)).toBe(true);
      const typography = await expectProductiveReviewContextTypography(page, 'confirmed');
      const reviewContextLayout = await collectReviewContextLayoutEvidence(page);
      expectReviewContextLayout(reviewContextLayout, viewport.width);
      await expect(reviewContext.getByText('Business date', { exact: true })).toBeVisible();
      await expect(reviewContext.getByText('Base currency', { exact: true })).toBeVisible();
      await expect(reviewContext.getByText('Reporting currency', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Valuation date', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Benchmark', { exact: true })).toBeVisible();
      await expectWorkbenchRelationshipIntegrity(page, [
        'portfolio-review-workspace-rail-navigation',
        'portfolio-review-workspace-rail-workspace-directory',
      ]);

      const measurements = await measureViewportEvidence(page);
      expect(measurements.document.scrollWidth).toBeLessThanOrEqual(
        measurements.document.clientWidth + 1
      );

      const railHeader = page.getByTestId('portfolio-screen-rail-header');
      const railHeaderRegions = await railHeader.evaluate((element) =>
        Array.from(element.children, (child) => {
          const bounds = child.getBoundingClientRect();
          const style = getComputedStyle(child);
          return {
            display: style.display,
            fits: child.scrollWidth <= child.clientWidth + 1,
            left: Math.round(bounds.left),
            top: Math.round(bounds.top),
          };
        })
      );
      expect(railHeaderRegions.filter((region) => region.display !== 'none').every((region) => region.fits)).toBe(true);

      if (viewport.width <= 1200) {
        const visibleHeaderRegions = railHeaderRegions.filter((region) => region.display !== 'none');
        expect(visibleHeaderRegions).toHaveLength(2);
        if (viewport.width <= 720) {
          expect(visibleHeaderRegions[0].top).toBeLessThan(visibleHeaderRegions[1].top);
        } else {
          expect(visibleHeaderRegions[0].left).toBeLessThan(visibleHeaderRegions[1].left);
        }

        const disclosure = page.getByRole('button', { name: /Current view Portfolio review/i });
        await disclosure.focus();
        const focusIndicator = await disclosure.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            outlineStyle: style.outlineStyle,
            outlineWidth: style.outlineWidth,
          };
        });
        expect(focusIndicator.outlineStyle).not.toBe('none');
        expect(focusIndicator.outlineWidth).not.toBe('0px');
        await page.keyboard.press('Enter');
        await expect(
          page.getByRole('navigation', { name: 'Workbench screen navigation' })
        ).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(disclosure).toBeFocused();
      }

      const focusableDomOrder = await collectFocusableDomOrder(page.locator('body'));
      expect(focusableDomOrder.length).toBeGreaterThan(8);
      expect(focusableDomOrder.every((element) => element.name.length > 0)).toBe(true);

      let keyboardEvidence = null;
      if (viewport.width === 519) {
        keyboardEvidence = await traverseSequentialKeyboardFocus(page, focusableDomOrder.length);
        expect(keyboardEvidence).toHaveLength(focusableDomOrder.length);
        expect(keyboardEvidence.every((element) => element.focusVisible)).toBe(true);
        expect(keyboardEvidence.every((element) => element.notObscured)).toBe(true);
        expect(keyboardEvidence.every((element) => element.withinViewport)).toBe(true);

        const primaryActionIndex = keyboardEvidence.findIndex(
          (element) => element.name === 'Open Performance'
        );
        const adjacentPerformanceIndex = keyboardEvidence.findIndex(
          (element, index) => index > primaryActionIndex && element.name === 'Performance'
        );
        expect(primaryActionIndex).toBeGreaterThan(-1);
        expect(adjacentPerformanceIndex).toBeGreaterThan(primaryActionIndex);
      }

      viewportEvidence.push({
        scenario: process.env.PORTFOLIO_E2E_FIXTURE ?? 'canonical',
        portfolioId: session.portfolioId,
        measurements,
        railHeaderRegions,
        reviewContextOwnership: identityOwnership,
        reviewContextTypography: typography,
        reviewContextLayout,
        focusableDomOrder,
        keyboardEvidence,
      });

      if (capturesIssue649Evidence && evidenceDirectory) {
        // Keyboard traversal can leave the pointer over a metric after the page scrolls.
        // Reset both pointer and focus so rendered evidence represents the neutral
        // workstation state instead of capturing a transient native tooltip.
        await page.mouse.move(0, 0);
        await page.evaluate(() => {
          (document.activeElement as HTMLElement | null)?.blur();
          window.scrollTo(0, 0);
        });
        await mkdir(evidenceDirectory, { recursive: true });
        await page.screenshot({
          path: resolve(
            evidenceDirectory,
            `diagnostic-degraded-portfolio-review-${viewport.width}.png`
          ),
          fullPage: true,
        });
        await page.getByTestId("review-context-strip").screenshot({
          path: resolve(
            evidenceDirectory,
            `diagnostic-degraded-review-context-${viewport.width}.png`
          ),
        });
      }
    }

    if (capturesIssue649Evidence && evidenceDirectory) {
      await writeFile(
        resolve(evidenceDirectory, 'portfolio-review-accessibility-evidence.json'),
        `${JSON.stringify(
          {
            generatedAtUtc: new Date().toISOString(),
            proofType: 'owned degraded-state fixture',
            decision: 'Performance evidence remains qualified and the source-owned action precedes adjacent workflows.',
            viewports: viewportEvidence,
          },
          null,
          2
        )}\n`,
        'utf8'
      );
    }
    await browserRuntime.assertStylesAreHeadManaged();
    browserRuntime.assertClean();
  });

  test('portfolio revisit reuses fresh detail truth and an open review revalidates after stale time', async ({
    page,
    request,
  }) => {
    test.skip(
      process.env.PORTFOLIO_E2E_PROOF_SCENARIO !== 'query-freshness',
      'Portfolio Query freshness proof requires the governed owned-fixture scenario.'
    );
    test.setTimeout(75_000);
    const performanceRequests: string[] = [];
    page.on('request', (browserRequest) => {
      const url = browserRequest.url();
      if (
        url.includes('/api/bff/api/v1/portfolio/portfolios/') &&
        url.includes('/performance-snapshot')
      ) {
        performanceRequests.push(url);
      }
    });

    const session = await openPortfolioReview(page, request);
    expect(session).toEqual({ portfolioId: 'PB_SG_GLOBAL_BAL_001', available: true });
    await expect(page.getByText('MTD return')).toBeVisible();
    await expect.poll(() => performanceRequests.length).toBeGreaterThan(0);
    const initialRequestCount = performanceRequests.length;

    await page.waitForTimeout(20_000);
    await page.getByRole('link', { name: 'Open Performance' }).click();
    await expect(page).toHaveURL(/\/performance\?/);
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /^Portfolio Review$/i })).toBeVisible();
    await expect(page.getByText('MTD return')).toBeVisible();
    expect(performanceRequests).toHaveLength(initialRequestCount);

    await expect
      .poll(() => performanceRequests.length, { timeout: 12_000 })
      .toBe(initialRequestCount * 2);
    const openWorkspaceRevalidationRequestCount = performanceRequests.length;

    await page.getByRole('link', { name: 'Open Performance' }).click();
    await expect(page).toHaveURL(/\/performance\?/);
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /^Portfolio Review$/i })).toBeVisible();
    await expect(page.getByText('MTD return')).toBeVisible();
    expect(performanceRequests).toHaveLength(openWorkspaceRevalidationRequestCount);

    const evidenceDirectory = process.env.PORTFOLIO_E2E_EVIDENCE_DIR;
    if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true });
      await writeFile(
        resolve(evidenceDirectory, 'portfolio-query-freshness-evidence.json'),
        `${JSON.stringify(
          {
            generatedAtUtc: new Date().toISOString(),
            portfolioId: session.portfolioId,
            governedStaleTimeMs: 30_000,
            freshRevisitAtApproximateAgeMs: 20_000,
            initialDetailRequestCount: initialRequestCount,
            freshRevisitDetailRequestCount: initialRequestCount,
            openWorkspaceRevalidationRequestCount,
            postRevalidationRevisitRequestCount: performanceRequests.length,
            observedPath: 'performance-snapshot',
          },
          null,
          2
        )}\n`,
        'utf8'
      );
    }
  });

  test('portfolio receipt age stays separate from business date and explicit recheck reaches both sources', async ({
    page,
    request,
  }) => {
    test.skip(
      process.env.PORTFOLIO_E2E_PROOF_SCENARIO !== 'query-freshness',
      'Portfolio receipt-age proof requires the governed owned-fixture scenario.'
    );
    test.setTimeout(45_000);
    const shellRequests: string[] = [];
    const performanceRequests: string[] = [];
    page.on('request', (browserRequest) => {
      const url = browserRequest.url();
      if (url.includes('/api/bff/api/v1/portfolio/portfolios/') && url.includes('/workspace')) {
        shellRequests.push(url);
      }
      if (
        url.includes('/api/bff/api/v1/portfolio/portfolios/') &&
        url.includes('/performance-snapshot')
      ) {
        performanceRequests.push(url);
      }
    });

    const session = await openPortfolioReview(page, request);
    expect(session).toEqual({ portfolioId: 'PB_SG_GLOBAL_BAL_001', available: true });
    await expect(page.getByText('MTD return')).toBeVisible();
    const receiptTime = page.locator('.portfolio-workspace-toolbar time[datetime]');
    await expect(receiptTime).toContainText(/^Checked /);
    const businessDate = await page.getByLabel('As of').inputValue();
    expect(businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await receiptTime.getAttribute('datetime')).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
    const receiptDisclosureId = await receiptTime.getAttribute('aria-describedby');
    expect(receiptDisclosureId).toBeTruthy();
    const exactReceiptDisclosure = page.locator(`#${receiptDisclosureId}`);
    await expect(exactReceiptDisclosure).toContainText(/^Exact check time: .* UTC$/);
    await receiptTime.focus();
    await expect(exactReceiptDisclosure).toBeVisible();

    const initialPerformanceRequestCount = performanceRequests.length;
    const recheck = page.getByRole('button', { name: 'Recheck portfolio' });
    await expect(recheck).toBeEnabled();
    await recheck.click();

    await expect.poll(() => shellRequests.length).toBe(1);
    await expect
      .poll(() => performanceRequests.length)
      .toBe(initialPerformanceRequestCount * 2);
    await expect(page.getByText('Portfolio evidence rechecked.', { exact: true })).toBeVisible();
    await expect(receiptTime).toHaveText('Checked just now');

    const evidenceDirectory = process.env.PORTFOLIO_E2E_EVIDENCE_DIR;
    if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true });
      await page.locator('.portfolio-workspace-toolbar').screenshot({
        path: resolve(evidenceDirectory, 'portfolio-receipt-age.png'),
      });
      await writeFile(
        resolve(evidenceDirectory, 'portfolio-receipt-age-evidence.json'),
        `${JSON.stringify(
          {
            generatedAtUtc: new Date().toISOString(),
            portfolioId: session.portfolioId,
            businessDate,
            receiptDateTime: await receiptTime.getAttribute('datetime'),
            receiptExactDisclosure: await exactReceiptDisclosure.textContent(),
            shellRequestsAfterRecheck: shellRequests.length,
            detailPerformanceRequestsBeforeRecheck: initialPerformanceRequestCount,
            detailPerformanceRequestsAfterRecheck: performanceRequests.length,
          },
          null,
          2
        )}\n`,
        'utf8'
      );
    }
  });

  test('historical review stays unavailable until aggregate evidence can refresh atomically', async ({
    page,
    request,
  }) => {
    test.skip(
      process.env.PORTFOLIO_E2E_FIXTURE !== 'cashflow',
      'Historical source-to-render proof requires the owned portfolio fixture.'
    );
    await page.setViewportSize({ width: 1280, height: 1000 });
    const session = await openPortfolioReview(page, request);
    test.skip(!session.available, 'Portfolio workspace upstream unavailable in standalone smoke environment.');

    await expect(
      page.getByRole('button', { name: 'Portfolio value: 12,500,000 USD' }),
    ).toBeVisible();
    const historicalReview = page.getByLabel('As of');
    await expect(historicalReview).toBeDisabled();
    await expect(historicalReview).toHaveValue('2026-04-10');
    await expect(historicalReview.locator('xpath=ancestor::*[@title][1]')).toHaveAttribute(
      'title',
      'Book evidence is available for governed historical review dates.',
    );
    await expect(page.getByTestId('review-context-strip')).toContainText('10 Apr 2026');
    await expect(page.getByTestId('workbench-refresh-status')).toHaveCount(0);
    await expect(page.getByText('Review date', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Valuation date', { exact: true })).toHaveCount(0);
  });

  test('income route renders the dedicated income and activity workspace', async ({ page, request }) => {
    await page.setViewportSize({ width: 1800, height: 1400 });
    const session = await openIncomePortfolio(page, request);
    test.skip(!session.available, 'Portfolio income upstream unavailable in standalone smoke environment.');

    await expect(page.getByText('Booked income', { exact: true })).toBeVisible();
    await expect(page.getByText('Booked cash movements', { exact: true })).toBeVisible();
    await expect(page.getByTestId('income-activity-workspace')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Booked income by type' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Booked cash movements by type' })).toBeVisible();
    await expect(page.getByText('Current cash weight')).toBeVisible();
    await expect(page.getByText('Booked records only')).toBeVisible();
    await expect(page.getByText('Net cash movement').first()).toBeVisible();
    await expect(
      page.getByRole('table', { name: 'Booked income by type' }).getByText('Ready')
    ).toHaveCount(0);

    const incomeMetricStrip = await measureGrid(page.getByLabel('Booked income summary'));
    expect(incomeMetricStrip.childCount).toBe(4);
    expect(incomeMetricStrip.width).toBeGreaterThan(900);
  });

  test('income and activity keeps booked cash evidence truthful across governed viewports', async ({
    page,
    request,
  }) => {
    test.skip(
      process.env.PORTFOLIO_E2E_PROOF_SCENARIO !== 'income-activity',
      'This deterministic booked-cash review runs only in its owned proof scenario.',
    );
    await page.setViewportSize({ width: 1440, height: 1100 });
    const session = await openIncomePortfolio(page, request);
    expect(session).toEqual({ portfolioId: 'PB_SG_GLOBAL_BAL_001', available: true });

    await expect(page.getByText('Booked records only')).toBeVisible();
    const incomeSummary = page.getByLabel('Booked income summary');
    await expect(incomeSummary.getByText('12,000 USD', { exact: true })).toBeVisible();
    await expect(incomeSummary.getByText('1,500 USD', { exact: true })).toBeVisible();
    await expect(incomeSummary.getByText('10,500 USD', { exact: true })).toBeVisible();
    await expect(incomeSummary.getByText('26,500 USD', { exact: true })).toBeVisible();

    const incomeTable = page.getByRole('table', { name: 'Booked income by type' });
    await expect(incomeTable.getByText('Dividend income', { exact: true })).toBeVisible();
    await expect(incomeTable.getByText('Interest income', { exact: true })).toBeVisible();

    const movementSummary = page.getByLabel('Booked cash movement summary');
    await expect(movementSummary.getByText('100,000 USD', { exact: true })).toBeVisible();
    await expect(movementSummary.getByText('26,500 USD', { exact: true })).toBeVisible();
    await expect(movementSummary.getByText('73,500 USD', { exact: true })).toBeVisible();
    await expect(movementSummary.getByText('6.00%', { exact: true })).toBeVisible();

    const movementTable = page.getByRole('table', { name: 'Booked cash movements by type' });
    await expect(movementTable.getByText('Subscriptions and transfers in')).toBeVisible();
    await expect(movementTable.getByText('Withdrawals and transfers out')).toBeVisible();
    await expect(movementTable.getByText('-25,000 USD', { exact: true })).toBeVisible();
    await expect(movementTable.getByText('Other activity · Corporate Actions')).toBeVisible();
    await expect(movementTable.getByText('Excluded from net')).toBeVisible();
    await expect(page.getByText('Classification review')).toBeVisible();
    for (const sourceCode of ['INFLOWS', 'OUTFLOWS', 'FEES', 'TAXES', 'CORPORATE_ACTIONS']) {
      await expect(page.getByText(sourceCode, { exact: true })).toHaveCount(0);
    }

    const evidenceDirectory = process.env.PORTFOLIO_E2E_EVIDENCE_DIR;
    if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true });
      await page.screenshot({
        path: resolve(evidenceDirectory, 'diagnostic-income-activity-booked-cash.png'),
        fullPage: true,
      });
    }

    const viewportEvidence = [];
    for (const viewport of [
      { width: 1440, height: 1100, expectedMetricColumns: 4 },
      { width: 1024, height: 1000, expectedMetricColumns: 4 },
      { width: 768, height: 1024, expectedMetricColumns: 3 },
      { width: 519, height: 900, expectedMetricColumns: 2 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(
        page.getByRole('heading', { name: 'Income and activity', exact: true }),
      ).toBeVisible();
      await expect(page.getByRole('table', { name: 'Booked income by type' })).toBeVisible();
      await expect(page.getByRole('table', { name: 'Booked cash movements by type' })).toBeVisible();
      for (const metricStrip of [incomeSummary, movementSummary]) {
        const metricLayout = await measureGrid(metricStrip);
        expect(metricLayout.childCount).toBe(4);
        expect(metricLayout.columns.split(' ').filter(Boolean)).toHaveLength(
          viewport.expectedMetricColumns,
        );
        expect(metricLayout.childWidths.every((width) => width > 100)).toBe(true);
      }
      const measurements = await measureViewportEvidence(page);
      expect(measurements.document.scrollWidth).toBeLessThanOrEqual(
        measurements.document.clientWidth + 1,
      );

      let keyboardEvidence = null;
      if (viewport.width === 519) {
        const focusableDomOrder = await collectFocusableDomOrder(page.locator('body'));
        expect(focusableDomOrder.length).toBeGreaterThan(8);
        expect(focusableDomOrder.every((element) => element.name.length > 0)).toBe(true);

        keyboardEvidence = await traverseSequentialKeyboardFocus(page, focusableDomOrder.length);
        // Chromium includes horizontally scrollable table regions in sequential focus even though
        // they are not matched by the explicit focusable-selector inventory.
        expect(keyboardEvidence.length).toBeGreaterThanOrEqual(focusableDomOrder.length);
        expect(keyboardEvidence.every((element) => element.name.length > 0)).toBe(true);
        expect(keyboardEvidence.every((element) => element.focusVisible)).toBe(true);
        expect(keyboardEvidence.every((element) => element.notObscured)).toBe(true);
        expect(keyboardEvidence.every((element) => element.withinViewport)).toBe(true);
      }

      viewportEvidence.push({ viewport, measurements, keyboardEvidence });
    }

    await page.setViewportSize({ width: 1440, height: 1100 });
    if (evidenceDirectory) {
      await writeFile(
        resolve(evidenceDirectory, 'income-activity-proof.json'),
        `${JSON.stringify(
          {
            portfolioId: session.portfolioId,
            reportingCurrency: 'USD',
            grossIncome: 12_000,
            netIncome: 10_500,
            classifiedNetMovement: 73_500,
            excludedMovement: 2_000,
            rawSourceCodesVisible: false,
            viewports: viewportEvidence,
          },
          null,
          2,
        )}\n`,
        'utf8',
      );
    }
  });

  test("cashflow route keeps projection identity and movement semantics explicit", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const browserRuntime = observeBrowserRuntimeFailures(page);
    await page.setViewportSize({ width: 1280, height: 1000 });
    const session = await openCashflowPortfolio(page, request);
    test.skip(
      !session.available,
      "Portfolio cashflow upstream unavailable in standalone smoke environment.",
    );

    await expect(
      page.getByRole("heading", { name: /^Projected cash flow$/i }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Projected cash movement summary"),
    ).toBeVisible();
    await expect(page.getByLabel("Projected cashflow summary")).toHaveCount(0);
    await expect(
      page.getByRole("img", {
        name: /Projected cash movement chart in USD; bars show dated net movement and the line shows cumulative movement/i,
      }),
    ).toBeVisible();
    await expect(page.getByRole("radio", { name: "10D" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getByRole("radio", { name: "30D" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "90D" })).toBeVisible();
    await expect(page.getByLabel("Projection scope")).toContainText(
      "Projection as of",
    );
    await expect(page.getByLabel("Projection scope")).toContainText(
      "Projection basis",
    );
    await expect(page.getByText("Ending Cumulative")).toHaveCount(0);
    await expect(page.getByText(/liquidity forecast/i)).toHaveCount(0);

    await page.getByRole("radio", { name: "10D" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "30D" })).toBeFocused();
    await expect(
      page.getByText(
        /30-day projection(?: returned for a 30-day request)? · /i,
      ),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("radio", { name: "30D" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getByText(/10-day projection · /i)).toHaveCount(0);
    const projectionEvidence = page
      .locator(".portfolio-record-source-item")
      .filter({ hasText: "Projection Basis" });
    await expect(projectionEvidence).toContainText("30 days");
    await expect(projectionEvidence).toContainText("2 positive movement dates and 1 negative movement date");
    await expect(projectionEvidence).not.toContainText("10 days");
    await expect(
      page.getByText("Cash Position", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Reporting Snapshot", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByLabel("Cash movement chart key")).toContainText(
      "Bars: dated net movementLine: cumulative movement",
    );

    const projectionHorizon = page.getByRole("radiogroup", {
      name: "Projection horizon",
    });
    const movementSummary = page.getByLabel("Projected cash movement summary");
    const scrollableSchedule = page.getByRole("region", {
      name: "Projected cash movement schedule, horizontally scrollable",
    });
    const evidenceDirectory = process.env.PORTFOLIO_E2E_EVIDENCE_DIR;
    const viewportEvidence: Array<{
      width: number;
      metricColumns: number;
      pageOverflow: number;
      scheduleOverflow: number;
      scheduleFocusable: boolean;
    }> = [];
    for (const width of [1440, 1024, 768, 519]) {
      await page.setViewportSize({ width, height: 1000 });
      await projectionHorizon.scrollIntoViewIfNeeded();
      await expect(projectionHorizon).toBeVisible();
      await expect(
        page.getByLabel("Projected cash movement summary"),
      ).toBeVisible();
      await expect(
        page.getByRole("table", { name: "Projected cash movement schedule" }),
      ).toBeVisible();
      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(layout.scrollWidth - layout.clientWidth).toBeLessThanOrEqual(2);
      const metricColumns = await movementSummary.evaluate(
        (element) =>
          getComputedStyle(element)
            .gridTemplateColumns.split(" ")
            .filter(Boolean).length,
      );
      expect(metricColumns).toBe(width === 1440 ? 4 : 2);
      await scrollableSchedule.focus();
      await expect(scrollableSchedule).toBeFocused();
      const scheduleLayout = await scrollableSchedule.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      if (width === 519) {
        expect(scheduleLayout.scrollWidth).toBeGreaterThan(
          scheduleLayout.clientWidth,
        );
        await expect(
          page.getByText(
            "Swipe, or focus the schedule and use the arrow keys, to compare every column.",
          ),
        ).toBeVisible();
      }
      viewportEvidence.push({
        width,
        metricColumns,
        pageOverflow: layout.scrollWidth - layout.clientWidth,
        scheduleOverflow:
          scheduleLayout.scrollWidth - scheduleLayout.clientWidth,
        scheduleFocusable: await scrollableSchedule.evaluate(
          (element) => document.activeElement === element,
        ),
      });
      if (evidenceDirectory && (width === 1440 || width === 519)) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${evidenceDirectory}/cashflow-${width}px.png`,
          fullPage: true,
        });
      }
    }
    const browserRuntimeFailures = browserRuntime.snapshot();
    if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true });
      await writeFile(
        resolve(evidenceDirectory, "cashflow-proof.json"),
        `${JSON.stringify(
          {
            portfolioId: session.portfolioId,
            selectedHorizonDays: 30,
            projectionPointCount: 3,
            positiveNetMovementCount: 2,
            negativeNetMovementCount: 1,
            evidenceRailHorizonDays: 30,
            chartSemantics: {
              bars: "dated net movement",
              line: "cumulative movement",
            },
            hydrationProof: {
              routes: ["/cashflow"],
              browserRuntimeFailures,
            },
            viewportEvidence,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
    }
    await browserRuntime.assertStylesAreHeadManaged();
    browserRuntime.assertClean();
  });

  test('allocation route connects direct exposures to contributing booked holdings', async ({ page, request }) => {
    await page.setViewportSize({ width: 1800, height: 1400 });
    const session = await openAllocationPortfolio(page, request);
    test.skip(!session.available, 'Portfolio allocation upstream unavailable in standalone smoke environment.');

    await expect(page.getByText('Portfolio exposure', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Positions$/i })).toBeVisible();
    await expect(page.getByText('Exposure Views')).toBeVisible();
    await expect(page.getByText('Target allocation', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Allocation drift', { exact: true })).toHaveCount(0);

    const firstDirectExposure = page.locator('.portfolio-allocation-ranked-row').first();
    await expect(firstDirectExposure).toBeEnabled();
    await firstDirectExposure.focus();
    await firstDirectExposure.press('Enter');

    await expect(page.getByRole('heading', { name: /^Contributing positions$/i })).toBeVisible();
    await expect(page.locator('.portfolio-grid-toolbar-copy')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Clear filter$/i })).toBeVisible();

    await page.getByRole('button', { name: /^Clear filter$/i }).click();
    await expect(page.getByRole('heading', { name: /^Positions$/i })).toBeVisible();

    const showExpandedExposure = page.getByRole('button', { name: 'Show expanded exposure' });
    const unsupportedExposure = page.getByRole('button', {
      name: 'Expanded exposure unavailable for current portfolio snapshot',
    });
    const failedExposure = page.getByRole('button', {
      name: 'Expanded exposure coverage could not be confirmed',
    });
    const getCoverageState = async (): Promise<
      'checking' | 'available' | 'unsupported' | 'failed'
    > => {
      if ((await showExpandedExposure.count()) > 0) {
        return 'available';
      }
      if ((await unsupportedExposure.count()) > 0) {
        return 'unsupported';
      }
      if ((await failedExposure.count()) > 0) {
        return 'failed';
      }
      return 'checking';
    };
    await expect.poll(getCoverageState).not.toBe('checking');
    const coverageState = await getCoverageState();

    if (coverageState === 'available') {
      await expect(showExpandedExposure).toBeEnabled();
      await showExpandedExposure.click();
      await expect(page.getByRole('button', { name: 'Show direct positions' })).toContainText(
        'Expanded exposure',
      );
      await expect(page.locator('.portfolio-allocation-ranked-row').first()).toBeDisabled();
      await expect(
        page.getByText(/Expanded exposure contributors require source-backed look-through detail/i),
      ).toBeVisible();
    } else if (coverageState === 'unsupported') {
      await expect(unsupportedExposure).toBeDisabled();
      await expect(page.getByText('Direct positions only', { exact: true })).toBeVisible();
    } else {
      await expect(failedExposure).toBeDisabled();
      await expect(
        page.getByText('Expanded exposure could not be confirmed', { exact: true }),
      ).toBeVisible();
    }
  });

  test('allocation keeps direct evidence usable and recovers expanded exposure coverage', async ({
    page,
    request,
  }) => {
    test.skip(
      process.env.PORTFOLIO_E2E_FIXTURE !== 'allocation-recovery',
      'Owned Allocation recovery fixture is required.',
    );
    const browserRuntime = observeBrowserRuntimeFailures(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const session = await openAllocationPortfolio(page, request);
    expect(session.available).toBe(true);

    await expect(page.getByText('Expanded exposure could not be confirmed')).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: 'Expanded exposure coverage could not be confirmed',
      }),
    ).toBeDisabled();
    await expect(page.getByText('7,000,000 USD', { exact: true })).toBeVisible();
    await expect.poll(() => fixtureGateway?.getAllocationRequestCount()).toBe(1);

    const firstDirectExposure = page.locator('.portfolio-allocation-ranked-row').first();
    await firstDirectExposure.focus();
    await firstDirectExposure.press('Enter');
    await expect(page.getByRole('heading', { name: /^Contributing positions$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Clear filter$/i })).toBeVisible();
    await page.getByRole('button', { name: /^Clear filter$/i }).click();

    const recheckCoverage = page.getByRole('button', { name: 'Recheck exposure coverage' });
    await recheckCoverage.focus();
    await recheckCoverage.click();
    await expect(recheckCoverage).toBeFocused();
    await expect(recheckCoverage).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByText('Checking expanded exposure', { exact: true })).toBeVisible();
    await expect(page.getByText('Source coverage confirmed', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Expanded exposure is available for this portfolio snapshot', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(recheckCoverage).toBeFocused();
    await expect(recheckCoverage).toHaveAttribute('aria-disabled', 'false');
    await expect.poll(() => fixtureGateway?.getAllocationRequestCount()).toBe(2);
    const retryFocusStable = await recheckCoverage.evaluate(
      (element) => document.activeElement === element,
    );

    await page.getByRole('button', { name: 'Show expanded exposure' }).click();
    await expect(page.getByRole('button', { name: 'Show direct positions' })).toBeVisible();
    await expect(page.getByText('Region • 3 exposures • Expanded exposure')).toBeVisible();
    await expect(page.locator('.portfolio-allocation-ranked-row').first()).toBeDisabled();
    await expect(
      page.getByText(/Expanded exposure contributors require source-backed look-through detail/i),
    ).toBeVisible();

    const evidenceDirectory = process.env.PORTFOLIO_E2E_EVIDENCE_DIR;
    const viewportEvidence = [];
    let compactChartSuppressed = false;
    let railConstrainedChartSuppressed = false;
    let compactExactValuesVisible = false;
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 1220, height: 1000 },
      { width: 1024, height: 1000 },
      { width: 519, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(page.getByRole('heading', { name: /^Allocation$/i })).toBeVisible();
      await expect(page.getByText('Source coverage confirmed', { exact: true })).toBeVisible();
      const measurements = await measureViewportEvidence(page);
      expect(measurements.document.scrollWidth).toBeLessThanOrEqual(
        measurements.document.clientWidth + 1,
      );
      const allocationPanelInlineSize = await page
        .locator('.portfolio-allocation-panel')
        .evaluate((element) => element.getBoundingClientRect().width);
      const chartSuppressed = await page
        .locator('[class*="portfolio-allocation-panel_visual"]')
        .evaluate((element) => getComputedStyle(element).display === 'none');
      const allocationBodyColumnCount = await page
        .locator('[class*="portfolio-allocation-panel_body"]')
        .evaluate(
          (element) =>
            getComputedStyle(element).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
        );
      if (viewport.width === 1220) {
        expect(allocationPanelInlineSize).toBeLessThanOrEqual(640);
        expect(chartSuppressed).toBe(true);
        expect(allocationBodyColumnCount).toBe(1);
        railConstrainedChartSuppressed = chartSuppressed;
      }
      if (viewport.width === 1024) {
        expect(allocationPanelInlineSize).toBeGreaterThan(640);
        expect(chartSuppressed).toBe(false);
        expect(allocationBodyColumnCount).toBe(2);
      }
      if (viewport.width === 519) {
        compactChartSuppressed = chartSuppressed;
        compactExactValuesVisible = await page
          .getByText('7,250,000 USD', { exact: true })
          .isVisible();
        expect(compactChartSuppressed).toBe(true);
        expect(compactExactValuesVisible).toBe(true);
        expect(allocationBodyColumnCount).toBe(1);
      }
      viewportEvidence.push({
        viewport,
        allocationPanelInlineSize,
        chartSuppressed,
        allocationBodyColumnCount,
        measurements,
      });

      if (evidenceDirectory && (viewport.width === 1440 || viewport.width === 519)) {
        await mkdir(evidenceDirectory, { recursive: true });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: resolve(evidenceDirectory, `allocation-recovered-${viewport.width}px.png`),
          fullPage: true,
        });
      }
    }

    const browserRuntimeFailures = browserRuntime.snapshot();
    if (evidenceDirectory) {
      await writeFile(
        resolve(evidenceDirectory, 'allocation-recovery-proof.json'),
        `${JSON.stringify(
          {
            portfolioId: session.portfolioId,
            initialCoverageState: 'failed',
            retainedEvidence: 'direct holdings',
            recoveredCoverageState: 'expanded exposure available',
            allocationRequestCount: fixtureGateway?.getAllocationRequestCount(),
            retryFocusStable,
            expandedContributorDetail: 'unavailable',
            compactChartSuppressed,
            railConstrainedChartSuppressed,
            compactExactValuesVisible,
            viewportEvidence,
            browserRuntimeFailures,
          },
          null,
          2,
        )}\n`,
        'utf8',
      );
    }
    await browserRuntime.assertStylesAreHeadManaged();
    browserRuntime.assertClean();
  });

  test('positions route exposes complete booked holdings and keyboard review', async ({ page, request }) => {
    await page.setViewportSize({ width: 1800, height: 1400 });
    const session = await openPositionsPortfolio(page, request);
    test.skip(!session.available, 'Portfolio positions upstream unavailable in standalone smoke environment.');

    const headerKpis = page.getByRole('region', { name: 'Positions key figures' });
    await expect(headerKpis.getByText('Invested', { exact: true })).toBeVisible();
    await expect(headerKpis.getByText('Cash', { exact: true })).toBeVisible();
    await expect(headerKpis.getByText('Window', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /^Positions$/i })).toBeVisible();
    await expect(page.getByLabel('Portfolio holdings grid')).toBeVisible();
    await expect(page.getByRole('button', { name: /Filter holdings/i })).toHaveCount(0);
    await expect(page.locator('.ag-selection-checkbox, .ag-header-select-all')).toHaveCount(0);

    const reviewActions = page.locator('.portfolio-instrument-review');
    await expect(reviewActions.first()).toBeVisible();
    expect(await reviewActions.count()).toBeGreaterThan(1);
    const holdingIdentifiers = await page.locator('.portfolio-instrument-cell span').allTextContents();
    expect(new Set(holdingIdentifiers).size).toBe(holdingIdentifiers.length);
    await expect(
      page.locator('.portfolio-instrument-review').filter({ hasText: /Cash/i }).first()
    ).toBeVisible();

    await reviewActions.first().focus();
    await reviewActions.first().press('Enter');
    await expect(page.locator('.portfolio-detail-drawer')).toBeVisible();
    await page.getByRole('tab', { name: /^Recent Activity$/i }).click();
    await expect(
      page.getByText(/Recent booked activity supplied with the portfolio review as of/i)
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /^Open transactions$/i })).toHaveAttribute(
      'href',
      new RegExp(`/transactions\\?portfolioId=${session.portfolioId}`)
    );
  });

  test('positions keep source status truthful across screen, export, and evidence', async ({ page, request }) => {
    test.skip(
      process.env.PORTFOLIO_E2E_PROOF_SCENARIO !== 'positions-status',
      'This deterministic source-status matrix runs only in its owned proof scenario.',
    );
    await page.setViewportSize({ width: 1440, height: 1100 });
    const session = await openPositionsPortfolio(page, request);
    expect(session).toEqual({ portfolioId: 'PB_SG_GLOBAL_BAL_001', available: true });

    const positionStates = page.locator('.portfolio-position-status');
    await expect(positionStates).toHaveCount(5);
    const displayedStates = await positionStates.allTextContents();
    expect(displayedStates).toEqual([
      'Current',
      'Review required',
      'Review required',
      'Not reported',
      'Not applicable',
    ]);
    await expect(page.getByText('STALE_PRICE', { exact: true })).toHaveCount(0);
    await expect(page.getByText('FUTURE_SOURCE_STATE', { exact: true })).toHaveCount(0);

    const readinessCard = page
      .locator('.portfolio-record-evidence-card')
      .filter({ hasText: 'Data Readiness' });
    await expect(readinessCard.getByText('Partial', { exact: true })).toBeVisible();
    const statusEvidence = page
      .locator('.portfolio-record-source-item')
      .filter({ hasText: 'Position Status' });
    await expect(statusEvidence.getByText('Review required', { exact: true })).toBeVisible();
    await expect(
      statusEvidence.getByText(
        '2 positions require review; 1 position status not reported; 1 source key stale; 1 position status current',
        { exact: true },
      ),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export positions' }).click();
    const download = await downloadPromise;
    const downloadedPath = await download.path();
    expect(downloadedPath).not.toBeNull();
    const csv = await readFile(downloadedPath!, 'utf8');
    expect(csv).toContain('Current');
    expect(csv).toContain('Review required');
    expect(csv).toContain('Not reported');
    expect(csv).toContain('Not applicable');
    expect(csv).not.toContain('STALE_PRICE');
    expect(csv).not.toContain('FUTURE_SOURCE_STATE');

    for (const width of [1024, 768, 519]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(page.getByRole('heading', { name: /^Positions$/i })).toBeVisible();
      await expect(page.getByText('Review required', { exact: true }).first()).toBeVisible();
      const pageWidth = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(pageWidth.scrollWidth - pageWidth.clientWidth).toBeLessThanOrEqual(2);
    }

    await page.setViewportSize({ width: 1440, height: 1100 });

    const evidenceDirectory = process.env.PORTFOLIO_E2E_EVIDENCE_DIR;
    if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true });
      await page.screenshot({
        path: resolve(evidenceDirectory, 'diagnostic-positions-status-matrix.png'),
        fullPage: true,
      });
      await writeFile(
        resolve(evidenceDirectory, 'positions-status-proof.json'),
        `${JSON.stringify(
          {
            portfolioId: session.portfolioId,
            overallReadiness: 'Partial',
            displayedStates,
            csvStates: ['Current', 'Review required', 'Not reported', 'Not applicable'],
            rawSourceCodesVisible: false,
          },
          null,
          2,
        )}\n`,
        'utf8',
      );
    }
  });

  test('portfolio record routes hydrate without browser runtime errors', async ({ page, request }) => {
    test.skip(
      process.env.PORTFOLIO_E2E_FIXTURE !== 'cashflow',
      'Hydration proof requires the owned populated portfolio fixture.',
    );
    const browserRuntime = observeBrowserRuntimeFailures(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const session = await openPositionsPortfolio(page, request);
    test.skip(
      !session.available,
      'Portfolio positions upstream unavailable in standalone smoke environment.',
    );

    await expect(page.getByRole('heading', { name: /^Positions$/i })).toBeVisible();
    const compactNavigation = page
      .getByTestId('portfolio-screen-rail')
      .getByRole('button', { name: /Current view Positions/i });
    await compactNavigation.focus();
    await expect(compactNavigation).toBeFocused();

    const browserRuntimeFailures = browserRuntime.snapshot();
    const evidenceDirectory = process.env.PORTFOLIO_E2E_EVIDENCE_DIR;
    if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true });
      await writeFile(
        resolve(evidenceDirectory, 'portfolio-record-hydration-proof.json'),
        `${JSON.stringify(
          {
            portfolioId: session.portfolioId,
            routes: ['/positions'],
            viewport: { width: 390, height: 844 },
            keyboardTarget: 'Current view Positions',
            browserRuntimeFailures,
          },
          null,
          2,
        )}\n`,
        'utf8',
      );
    }
    await browserRuntime.assertStylesAreHeadManaged();
    browserRuntime.assertClean();
  });

  test('transactions keep settlement applicability truthful across screen, detail, export, and evidence', async ({ page, request }) => {
    test.skip(
      process.env.PORTFOLIO_E2E_PROOF_SCENARIO !== 'transactions-status',
      'This deterministic settlement-applicability matrix runs only in its owned proof scenario.',
    );
    await page.setViewportSize({ width: 1440, height: 1100 });
    const session = await openTransactionsPortfolio(page, request);
    expect(session).toEqual({ portfolioId: 'PB_SG_GLOBAL_BAL_001', available: true });

    const settlementStates = page.locator('.portfolio-position-status');
    await expect(settlementStates).toHaveCount(4);
    const displayedStates = await settlementStates.allTextContents();
    expect(displayedStates).toEqual([
      'Settled',
      'Review required',
      'Not reported',
      'Not applicable',
    ]);
    await expect(page.getByText('FUTURE_SOURCE_STATE', { exact: true })).toHaveCount(0);
    await expect(
      page.getByText(
        '1 settlement status requires review; 1 settlement status not reported; 1 settlement status settled; 1 ledger entry not applicable',
        { exact: true },
      ).first(),
    ).toBeVisible();

    const settlementEvidence = page
      .locator('.portfolio-record-source-item')
      .filter({ hasText: 'Settlement' });
    await expect(settlementEvidence.getByText('Review required', { exact: true })).toBeVisible();
    await expect(
      settlementEvidence.getByText(
        '1 settlement status requires review; 1 settlement status not reported; 1 settlement status settled; 1 ledger entry not applicable',
        { exact: true },
      ),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Review transaction TX_NOT_REPORTED' }).click();
    const drawer = page.locator('.portfolio-detail-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('Settlement status', { exact: true }).first()).toBeVisible();
    await expect(drawer.getByText('Not reported', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: /Close/i }).first().click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export transactions' }).click();
    const download = await downloadPromise;
    const downloadedPath = await download.path();
    expect(downloadedPath).not.toBeNull();
    const csv = await readFile(downloadedPath!, 'utf8');
    expect(csv).toContain('Settlement Status');
    for (const state of displayedStates) {
      expect(csv).toContain(state);
    }
    expect(csv).not.toContain('FUTURE_SOURCE_STATE');

    for (const width of [1024, 768, 519]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(page.getByRole('heading', { name: /^Transactions$/i })).toBeVisible();
      await expect(page.getByText('Review required', { exact: true }).first()).toBeVisible();
      const pageWidth = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(pageWidth.scrollWidth - pageWidth.clientWidth).toBeLessThanOrEqual(2);
    }

    await page.setViewportSize({ width: 1440, height: 1100 });
    const evidenceDirectory = process.env.PORTFOLIO_E2E_EVIDENCE_DIR;
    if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true });
      await page.screenshot({
        path: resolve(evidenceDirectory, 'diagnostic-transactions-settlement-matrix.png'),
        fullPage: true,
      });
      await writeFile(
        resolve(evidenceDirectory, 'transactions-settlement-proof.json'),
        `${JSON.stringify(
          {
            portfolioId: session.portfolioId,
            displayedStates,
            settlementEvidence: 'Review required',
            rawSourceCodesVisible: false,
            csvUsesBusinessStates: true,
          },
          null,
          2,
        )}\n`,
        'utf8',
      );
    }
  });

  test('transactions route preserves currency semantics and opens related booked activity', async ({ page, request }) => {
    await page.setViewportSize({ width: 1800, height: 1400 });
    const session = await openTransactionsPortfolio(page, request);
    test.skip(!session.available, 'Portfolio transactions upstream unavailable in standalone smoke environment.');

    const headerKpis = page.getByRole('region', { name: 'Transactions key figures' });
    await expect(headerKpis.getByText('Portfolio Currency', { exact: true })).toBeVisible();
    await expect(headerKpis.getByText('Latest Booking', { exact: true })).toBeVisible();
    await expect(headerKpis.getByText('30D Entries', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Booked activity$/i })).toBeVisible();
    await expect(page.getByLabel('Portfolio transactions grid')).toBeVisible();
    await expect(page.getByText('Gross Amount', { exact: true })).toBeVisible();
    await expect(page.getByText('Net Cost (USD)', { exact: true })).toBeVisible();
    await expect(page.getByText('Settlement Status', { exact: true })).toBeVisible();
    await expect(page.getByText(/settlement status/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /^Book first transaction$/i })).toHaveCount(0);

    await page.getByLabel('Transaction start date').fill('2025-04-01');
    await page.getByLabel('Search transactions').fill('SIEMENS-2031');
    await expect(page.getByText('73,912.5 EUR', { exact: true })).toBeVisible();
    await expect(page.getByText('80,097.93 USD', { exact: true })).toBeVisible();

    await page.getByLabel('Search transactions').fill('TXN-INT-UST-001');
    await page.getByRole('button', { name: /^Review transaction TXN-INT-UST-001$/i }).click();
    await expect(page.locator('.portfolio-detail-drawer')).toBeVisible();
    await page.getByRole('tab', { name: /^Related Activity$/i }).click();
    await expect(page.getByRole('button', { name: /^Open Related Group Transactions$/i })).toBeVisible();
    await page.getByRole('button', { name: /^Open Related Group Transactions$/i }).click();

    await expect(page.getByText(/Related booking group LTG-PB_SG_GLOBAL_BAL_001-INT-UST-001/i)).toBeVisible();
    await expect(page.getByText('2 matching transactions in the selected period', { exact: true })).toBeVisible();
  });

  test('transaction deep links survive reload and browser history beyond the first ledger page', async ({ page, request }) => {
    test.skip(
      process.env.PORTFOLIO_E2E_PROOF_SCENARIO !== 'transaction-navigation',
      'Requires the exact-transaction navigation fixture.',
    );
    const portfolioId = await resolveSmokePortfolioId(request);
    expect(portfolioId).toBe('PB_SG_GLOBAL_BAL_001');

    for (const viewport of [
      { width: 1600, height: 1000 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(
        `/transactions?portfolioId=${portfolioId}&asOfDate=2026-04-10&period=30D&reportingCurrency=USD`,
        { waitUntil: 'domcontentloaded' },
      );
      await expect(page.getByRole('button', { name: 'Next entries' })).toBeEnabled();
      await page.getByRole('button', { name: 'Next entries' }).click();
      await expect(
        page
          .getByLabel('Transaction ledger pages')
          .getByText('201–201 of 201 ledger entries', { exact: true }),
      ).toBeVisible({ timeout: 15_000 });
      const reviewButton = page.getByRole('button', { name: 'Review transaction TX_PAGE_201' });
      await expect(reviewButton).toBeVisible({ timeout: 15_000 });
      await reviewButton.click();
      await expect(page).toHaveURL(/selectedRecordId=TX_PAGE_201/);
      await expect(page.getByRole('heading', { name: 'Sell' })).toBeVisible();

      await page.getByRole('button', { name: 'Close' }).click();
      await expect(page).not.toHaveURL(/selectedRecordId=/);
      await expect(reviewButton).toBeFocused();
      await reviewButton.click();
      await expect(page).toHaveURL(/selectedRecordId=TX_PAGE_201/);

      const exactRequests: string[] = [];
      const recordExactRequest = (request: import('@playwright/test').Request) => {
        if (request.url().includes('/transactions/TX_PAGE_201')) {
          exactRequests.push(request.url());
        }
      };
      page.on('request', recordExactRequest);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Sell' })).toBeVisible();
      await expect(page.getByText('TX_PAGE_201', { exact: true })).toBeVisible();
      expect(exactRequests).toHaveLength(1);
      expect(exactRequests[0]).toContain(
        'as_of_date=2026-04-10&include_projected=false&reporting_currency=USD',
      );
      page.off('request', recordExactRequest);

      await page.goBack({ waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveURL(/selectedRecordId=/);
      await expect(page.locator('.portfolio-detail-drawer')).toHaveCount(0);
      await page.goForward({ waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/selectedRecordId=TX_PAGE_201/);
      await expect(page.getByText('TX_PAGE_201', { exact: true })).toBeVisible();
    }
  });

  test('record selection changes the address without a server navigation', async ({ page, request }) => {
    test.skip(
      process.env.PORTFOLIO_E2E_PROOF_SCENARIO !== 'transaction-navigation',
      'Requires the exact-transaction navigation fixture.',
    );
    // Opening and closing a record is a client-side change: the page already holds
    // the record. Routing it through `router.push` made the address bar wait on an
    // RSC round-trip, and under load that wait outlasted the assertion window --
    // #1031, where Close left `selectedRecordId` in the URL for the full 5 seconds.
    // Counting RSC navigations states that mechanism directly, so this fails loudly
    // if selection ever goes back through the server, rather than only when a
    // machine happens to be slow enough to expose it.
    const portfolioId = await resolveSmokePortfolioId(request);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(
      `/transactions?portfolioId=${portfolioId}&asOfDate=2026-04-10&period=30D&reportingCurrency=USD`,
      { waitUntil: 'domcontentloaded' },
    );
    await expect(page.getByRole('button', { name: 'Next entries' })).toBeEnabled();
    await page.getByRole('button', { name: 'Next entries' }).click();
    await expect(
      page
        .getByLabel('Transaction ledger pages')
        .getByText('201–201 of 201 ledger entries', { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    let serverNavigations = 0;
    await page.route('**/*', async (route) => {
      const pending = route.request();
      if (pending.url().includes('_rsc=') || (pending.headers()['rsc'] ?? '') === '1') {
        serverNavigations += 1;
      }
      await route.continue();
    });

    const reviewButton = page.getByRole('button', { name: 'Review transaction TX_PAGE_201' });
    await expect(reviewButton).toBeVisible({ timeout: 15_000 });
    await reviewButton.click();
    await expect(page).toHaveURL(/selectedRecordId=TX_PAGE_201/, { timeout: 2_000 });
    await expect(page.getByRole('heading', { name: 'Sell' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page).not.toHaveURL(/selectedRecordId=/, { timeout: 2_000 });
    await expect(reviewButton).toBeFocused();

    expect(serverNavigations).toBe(0);
  });


});
