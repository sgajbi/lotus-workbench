import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import {
  buildPerformanceSmokePagePath,
  classifyPerformanceSummaryPosture,
  loadPerformanceSmokeSummary,
  type PerformanceSummaryPosture,
} from './performance-workbench-supportability';
import {
  startPerformanceFixtureGateway,
  type PerformanceFixtureGateway,
  type PerformanceFixtureGatewayScenario,
} from './performance-fixture-gateway';
import {
  measureElement,
  measureTableFrame,
  parseServerTimingDuration,
  parseServerTimingMetrics,
} from './workbench-smoke-helpers';
import { observeBrowserRuntimeFailures } from './browser-runtime-reliability';
import { expectWorkbenchRelationshipIntegrity } from './workbench-relationship-evidence';
import {
  GOVERNED_REVIEW_AS_OF_DATE,
  GOVERNED_REVIEW_CURRENCY,
  GOVERNED_REVIEW_PERIOD,
  GOVERNED_REVIEW_PORTFOLIO_ID,
} from './governed-review-context-fixture';

test.describe.configure({ mode: 'default' });

let fixtureGateway: PerformanceFixtureGateway | null = null;

test.beforeAll(async () => {
  const scenario = process.env.PERFORMANCE_E2E_FIXTURE;
  if (
    scenario !== 'populated' &&
    scenario !== 'unavailable' &&
    scenario !== 'refresh-integrity' &&
    scenario !== 'trend-integrity' &&
    scenario !== 'horizon-integrity' &&
    scenario !== 'analysis-controls' &&
    scenario !== 'unknown-period'
  ) {
    return;
  }
  const port = Number(process.env.PERFORMANCE_E2E_FIXTURE_PORT ?? '18100');
  const expectedGateway = `http://127.0.0.1:${port}`;
  if (
    process.env.BFF_BASE_URL !== expectedGateway ||
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY !== 'performance'
  ) {
    throw new Error(
      `Performance fixture proof requires the owned gateway at ${expectedGateway}.`,
    );
  }
  fixtureGateway = await startPerformanceFixtureGateway({
    port,
    scenario: scenario as PerformanceFixtureGatewayScenario,
  });
});

test.afterAll(async () => {
  await fixtureGateway?.close();
  fixtureGateway = null;
});

async function resolveSmokePortfolioId(request: APIRequestContext) {
  const response = await request.get('/api/bff/api/v1/lookups/portfolios?limit=8', {
    timeout: 30000,
  });
  if (!response.ok()) {
    return null;
  }
  const payload = (await response.json()) as {
    items?: Array<{ id: string }>;
  };
  const portfolioIds = payload.items?.map((item) => item.id) ?? [];
  return (
    portfolioIds.find((candidate) => candidate === 'PB_SG_GLOBAL_BAL_001') ??
    portfolioIds.find((candidate) => candidate === 'DEMO_ADV_USD_001') ??
    portfolioIds[0]
  );
}

async function openPerformanceWorkbench(
  page: Page,
  request: APIRequestContext
) {
  const portfolioId = await resolveSmokePortfolioId(request);
  if (!portfolioId) {
    await page.goto('/performance', {
      waitUntil: 'domcontentloaded',
    });
    return { portfolioId: null, available: false };
  }

  await page.goto(buildPerformanceSmokePagePath(portfolioId), {
    waitUntil: 'domcontentloaded',
  });

  const workbenchHeading = page.getByRole('heading', { name: /^Performance$/i });
  const unavailableHeading = page.getByRole('heading', {
    name: /^Performance data unavailable$/i,
  });

  if ((await workbenchHeading.count()) === 0 && (await unavailableHeading.count()) > 0) {
    await page.reload({ waitUntil: 'domcontentloaded' });
  }

  const unavailableVisible = await unavailableHeading.isVisible().catch(() => false);
  if (unavailableVisible) {
    return { portfolioId, available: false };
  }

  await expect(workbenchHeading).toBeVisible({ timeout: 30000 });
  if ((page.viewportSize()?.width ?? 1440) <= 1200) {
    await expect(
      page.getByRole('button', { name: /^Current view Performance overview/i }),
    ).toBeVisible({ timeout: 30000 });
  } else {
    await expect(
      page
        .getByLabel('Performance surface navigation')
        .getByRole('button', { name: /^Performance overview$/i }),
    ).toBeVisible({ timeout: 30000 });
  }
  return { portfolioId, available: true };
}

function expectGovernedPerformanceContext(
  url: string,
  expected: {
    portfolioId: string;
    asOfDate: string;
    period: string;
    reportingCurrency: string;
    mode?: string;
  },
  pathname = '/performance',
) {
  const currentUrl = new URL(url);
  expect(currentUrl.pathname).toBe(pathname);
  expect(currentUrl.searchParams.get('portfolioId')).toBe(expected.portfolioId);
  expect(currentUrl.searchParams.get('asOfDate')).toBe(expected.asOfDate);
  expect(currentUrl.searchParams.get('period')).toBe(expected.period);
  expect(currentUrl.searchParams.get('reportingCurrency')).toBe(
    expected.reportingCurrency,
  );
  expect(currentUrl.searchParams.get('mode')).toBe(expected.mode ?? null);
}

async function expectContributorGroupsToRemainSeparate(page: Page) {
  const contributors = page.getByTestId('performance-contributor-group-contributors');
  const detractors = page.getByTestId('performance-contributor-group-detractors');
  const contributorsHeading = contributors.getByText('Top Contributors', { exact: true });
  const detractorsHeading = detractors.getByText('Top Detractors', { exact: true });

  await expect(contributors).toBeVisible();
  await expect(detractors).toBeVisible();

  const [contributorsBox, detractorsBox, contributorsHeadingBox, detractorsHeadingBox] =
    await Promise.all([
      contributors.boundingBox(),
      detractors.boundingBox(),
      contributorsHeading.boundingBox(),
      detractorsHeading.boundingBox(),
    ]);

  expect(contributorsBox).not.toBeNull();
  expect(detractorsBox).not.toBeNull();
  expect(contributorsHeadingBox).not.toBeNull();
  expect(detractorsHeadingBox).not.toBeNull();
  if (!contributorsBox || !detractorsBox || !contributorsHeadingBox || !detractorsHeadingBox) {
    throw new Error('Performance contributor group geometry was not available.');
  }

  const tolerance = 1;
  const contributorRight = contributorsBox.x + contributorsBox.width;
  const detractorRight = detractorsBox.x + detractorsBox.width;
  const contributorBottom = contributorsBox.y + contributorsBox.height;
  const detractorBottom = detractorsBox.y + detractorsBox.height;
  const horizontallySeparated =
    contributorRight <= detractorsBox.x + tolerance ||
    detractorRight <= contributorsBox.x + tolerance;
  const verticallySeparated =
    contributorBottom <= detractorsBox.y + tolerance ||
    detractorBottom <= contributorsBox.y + tolerance;

  expect(horizontallySeparated || verticallySeparated).toBe(true);

  for (const [group, groupBox, headingBox] of [
    [contributors, contributorsBox, contributorsHeadingBox],
    [detractors, detractorsBox, detractorsHeadingBox],
  ] as const) {
    const overflow = await group.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(overflow.scrollWidth - overflow.clientWidth).toBeLessThanOrEqual(tolerance);
    expect(headingBox.x).toBeGreaterThanOrEqual(groupBox.x - tolerance);
    expect(headingBox.x + headingBox.width).toBeLessThanOrEqual(
      groupBox.x + groupBox.width + tolerance,
    );
  }
}

async function openPerformanceWorkflowStep(
  page: Page,
  name: string | RegExp,
): Promise<Locator> {
  const navigation = page.getByLabel('Performance surface navigation');
  const compactCurrentView = page.getByRole('button', {
    name: /^Current view /i,
  });
  if (
    !(await navigation.isVisible().catch(() => false)) &&
    (await compactCurrentView.isVisible().catch(() => false))
  ) {
    await compactCurrentView.click();
    await expect(navigation).toBeVisible();
  }
  const control = navigation.getByRole('button', { name });
  if (await control.isVisible().catch(() => false)) {
    return control;
  }

  const changeStep = navigation.getByRole('button', {
    name: /Change workflow step/i,
  });
  await expect(changeStep).toBeVisible();
  if ((await changeStep.getAttribute('aria-expanded')) !== 'true') {
    await changeStep.click();
  }
  await expect(control).toBeVisible();
  return control;
}

function getExecutiveMetric(executiveStrip: Locator, label: string): Locator {
  return executiveStrip.getByText(label, { exact: true }).locator('..');
}

async function expectExecutiveMetric(
  executiveStrip: Locator,
  label: string,
  reported: boolean,
): Promise<void> {
  const metric = getExecutiveMetric(executiveStrip, label);
  await expect(metric).toBeVisible();
  if (reported) {
    await expect(metric).not.toContainText(/N\/A|Unavailable/);
    return;
  }
  await expect(metric).toContainText(/N\/A|Unavailable/);
}

async function loadSummaryPosture(
  request: APIRequestContext,
  portfolioId: string,
): Promise<PerformanceSummaryPosture> {
  return classifyPerformanceSummaryPosture(
    await loadPerformanceSmokeSummary(request, portfolioId),
  );
}

test.describe('Performance workbench smoke', () => {
  test('split performance endpoints expose server timing to the live browser', async ({ page, request }) => {
    test.skip(
      Boolean(process.env.PERFORMANCE_E2E_FIXTURE),
      'Fixture-backed UI proof does not certify live upstream Server-Timing propagation.',
    );
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1800, height: 1400 });
    const session = await openPerformanceWorkbench(page, request);
    test.skip(!session.available || !session.portfolioId, 'Performance upstream unavailable in standalone smoke environment.');
    const portfolioId = session.portfolioId;

    const fetchWithTiming = async (path: string) => {
      const response = await request.get(`http://127.0.0.1:3000${path}`, {
        headers: { 'cache-control': 'no-store' },
        timeout: 60000,
      });
      return {
        status: response.status(),
        serverTiming: response.headers()['server-timing'] ?? null,
      };
    };

    const [summary, details, horizon, attribution] = await Promise.all([
      fetchWithTiming(
        `/api/bff/api/v1/workbench/${portfolioId}/performance/summary?period=EXPLICIT&chart_frequency=monthly&contribution_dimension=asset_class&attribution_dimension=asset_class&detail_basis=NET&report_start_date=2026-01-01&report_end_date=2026-03-30`
      ),
      fetchWithTiming(
        `/api/bff/api/v1/workbench/${portfolioId}/performance/details?period=EXPLICIT&chart_frequency=monthly&contribution_dimension=asset_class&attribution_dimension=asset_class&detail_basis=NET&report_start_date=2026-01-01&report_end_date=2026-03-30`
      ),
      fetchWithTiming(
        `/api/bff/api/v1/workbench/${portfolioId}/performance/horizon-comparison?detail_basis=NET&chart_frequency=monthly`
      ),
      fetchWithTiming(
        `/api/bff/api/v1/workbench/${portfolioId}/performance/attribution-trend?period=EXPLICIT&chart_frequency=monthly&attribution_dimension=asset_class&detail_basis=NET&report_start_date=2026-01-01&report_end_date=2026-03-30`
      ),
    ]);
    const endpointResults = { summary, details, horizon, attribution };

    expect(endpointResults.summary.status).toBe(200);
    expect(endpointResults.details.status).toBe(200);
    expect(endpointResults.horizon.status).toBe(200);
    expect(endpointResults.attribution.status).toBe(200);

    const summaryMetrics = parseServerTimingMetrics(endpointResults.summary.serverTiming);
    const detailsMetrics = parseServerTimingMetrics(endpointResults.details.serverTiming);
    const horizonMetrics = parseServerTimingMetrics(endpointResults.horizon.serverTiming);
    const attributionMetrics = parseServerTimingMetrics(
      endpointResults.attribution.serverTiming
    );

    expect(parseServerTimingDuration(endpointResults.summary.serverTiming)).toBeGreaterThanOrEqual(
      0
    );
    expect(parseServerTimingDuration(endpointResults.details.serverTiming)).toBeGreaterThanOrEqual(
      0
    );
    expect(parseServerTimingDuration(endpointResults.horizon.serverTiming)).toBeGreaterThanOrEqual(
      0
    );
    expect(
      parseServerTimingDuration(endpointResults.attribution.serverTiming)
    ).toBeGreaterThanOrEqual(0);

    expect(summaryMetrics.get('perf-reference')).toBeGreaterThanOrEqual(0);
    expect(summaryMetrics.get('perf-benchmark')).toBeGreaterThanOrEqual(0);
    expect(summaryMetrics.get('perf-summary')).toBeGreaterThanOrEqual(0);

    expect(detailsMetrics.get('perf-reference')).toBeGreaterThanOrEqual(0);
    expect(detailsMetrics.get('perf-benchmark')).toBeGreaterThanOrEqual(0);
    expect(detailsMetrics.get('perf-summary')).toBeGreaterThanOrEqual(0);

    expect(horizonMetrics.get('perf-reference')).toBeGreaterThanOrEqual(0);
    expect(horizonMetrics.get('perf-benchmark')).toBeGreaterThanOrEqual(0);
    expect(horizonMetrics.get('perf-horizon')).toBeGreaterThanOrEqual(0);

    expect(attributionMetrics.get('perf-reference')).toBeGreaterThanOrEqual(0);
    expect(attributionMetrics.get('perf-benchmark')).toBeGreaterThanOrEqual(0);
    expect(attributionMetrics.get('perf-attribution')).toBeGreaterThanOrEqual(0);
  });

  test('summary renders the source supportability posture truthfully', async ({ page, request }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1800, height: 1400 });
    const session = await openPerformanceWorkbench(page, request);
    if (!session.available || !session.portfolioId) {
      test.skip(true, 'Performance upstream unavailable in standalone smoke environment.');
      return;
    }
    const posture = await loadSummaryPosture(request, session.portfolioId);
    const executiveStrip = page.getByLabel('Executive return strip');

    if (posture.capabilities.summary === 'unavailable') {
      await expect(executiveStrip).toHaveCount(0);
    } else {
      await expectExecutiveMetric(
        executiveStrip,
        'Opening market value',
        posture.metrics.openingMarketValue,
      );
      await expectExecutiveMetric(executiveStrip, 'Net cash flow', posture.metrics.netFlow);
      await expectExecutiveMetric(
        executiveStrip,
        'Flow-adjusted market value',
        posture.metrics.flowAdjustedMarketValue,
      );
      await expect(executiveStrip.getByText('Ending market value', { exact: true })).toHaveCount(
        posture.metrics.endingMarketValue ? 1 : 0,
      );
      await expect(executiveStrip.getByText('Opening cash flow', { exact: true })).toHaveCount(
        posture.metrics.openingCash ? 1 : 0,
      );
      await expect(executiveStrip.getByText('Closing cash flow', { exact: true })).toHaveCount(
        posture.metrics.closingCash ? 1 : 0,
      );
    }

    const returnDecisionReadout = page.getByLabel('Return decision readout');
    if (
      posture.capabilities.summary === 'unavailable' ||
      posture.capabilities.returnPath !== 'supported'
    ) {
      await expect(returnDecisionReadout).toHaveCount(0);
      if (posture.capabilities.summary !== 'unavailable') {
        const benchmarkEvidence = getExecutiveMetric(executiveStrip, 'Benchmark evidence');
        if (posture.benchmarkAssigned) {
          await expect(benchmarkEvidence).toContainText('Unavailable');
        } else {
          await expect(benchmarkEvidence).toHaveCount(0);
        }
        await expect(getExecutiveMetric(executiveStrip, 'Money-weighted return (MWR)')).toContainText(
          posture.metrics.moneyWeightedReturn ? /Money-weighted return \(MWR\)/ : /Unavailable/,
        );
      }
    } else {
      await expect(returnDecisionReadout).toBeVisible({ timeout: 15_000 });
      const moneyWeightedReturn = returnDecisionReadout
        .getByText('Money-weighted return (MWR)', { exact: true })
        .locator('..');
      await expect(moneyWeightedReturn).toContainText(
        posture.metrics.moneyWeightedReturn ? /Money-weighted return \(MWR\)/ : /Unavailable/,
      );
    }

    if (posture.capabilities.returnPath === 'supported') {
      await expect(
        page.getByLabel(/Time-weighted return path · Net of fees (?:chart|single observation comparison)/),
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.getByLabel('Time-weighted return path · Net of fees unavailable')).toHaveCount(0);
    } else {
      await expect(page.getByLabel('Time-weighted return path · Net of fees unavailable')).toBeVisible({
        timeout: 30_000,
      });
    }

    await expect(page.getByRole('heading', { name: /^Horizon Comparison$/i })).toBeVisible({
      timeout: 15_000,
    });
    const horizonEvidence = page.getByTestId('horizon-comparison-evidence');
    await expect(horizonEvidence).toBeVisible({ timeout: 15_000 });
    if (posture.capabilities.horizon === 'supported') {
      await expect(page.getByLabel('Horizon comparison unavailable state')).toHaveCount(0);
    } else {
      await expect(horizonEvidence).toHaveAttribute('data-state', /^(empty|unavailable)$/);
      const horizonState = await horizonEvidence.getAttribute('data-state');
      if (horizonState === 'empty') {
        await expect(horizonEvidence).toContainText('No published horizon comparison');
      } else {
        await expect(page.getByLabel('Horizon comparison unavailable state')).toBeVisible();
      }
    }

    await expect(page.getByRole('heading', { name: /^Performance Drivers$/i })).toBeVisible({
      timeout: 15_000,
    });
    if (posture.capabilities.contributors === 'supported') {
      await expect(page.getByLabel('Contributor ranking unavailable state')).toHaveCount(0);
    } else {
      await expect(page.getByLabel('Contributor ranking unavailable state')).toBeVisible();
    }

    await expect(page.locator('.performance-analysis-stage')).toHaveCount(0);
    await expect(page.getByTestId('performance-evidence-assurance')).toHaveCount(0);
    const workspaceRail = page.getByLabel('Performance surface navigation');
    await expect(
      workspaceRail.getByRole('button', { name: /^Performance overview$/i }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.getByLabel('Trust and completeness strip')).toHaveCount(0);
  });

  test('capability-restricted workflow navigation keeps availability claims truthful', async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const session = await openPerformanceWorkbench(page, request);
    if (!session.available || !session.portfolioId) {
      test.skip(true, 'Performance upstream unavailable in standalone smoke environment.');
      return;
    }

    for (const viewport of [
      { width: 1024, height: 900 },
      { width: 519, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      const compactDisclosure = page.getByRole('button', { name: /Current view/i });
      if (await compactDisclosure.isVisible().catch(() => false)) {
        await compactDisclosure.click();
      }

      const navigation = page.getByLabel('Performance surface navigation');
      await expect(navigation).toBeVisible();
      const changeWorkflow = navigation.getByRole('button', {
        name: /Change workflow step/i,
      });
      await expect(changeWorkflow).toBeVisible();
      await changeWorkflow.click();

      const directory = navigation.getByTestId('workbench-workflow-directory');
      const unavailableSteps = directory.locator('button:disabled');
      const unavailableCount = await unavailableSteps.count();
      if (unavailableCount === 0) {
        test.skip(true, 'Capability-restricted workflow proof requires an unavailable mode.');
        return;
      }

      const actionableCount = await directory.locator('a[href], button:not(:disabled)').count();
      await expect(changeWorkflow).toContainText(
        `${actionableCount} ${actionableCount === 1 ? 'available step' : 'available steps'}`,
      );
      expect(actionableCount).toBeGreaterThan(0);
      expect(unavailableCount).toBeGreaterThan(0);
      await expect(unavailableSteps.first()).toContainText('Unavailable');

      const focusTarget = directory.locator('a[href], button:not(:disabled)').first();
      await focusTarget.focus();
      await page.keyboard.press('Escape');
      await expect(changeWorkflow).toBeFocused();
      await expect(directory).toBeHidden();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);

      if (await compactDisclosure.isVisible().catch(() => false)) {
        await compactDisclosure.click();
      }
    }
  });

  test('populated summary preserves its metric and layout contract', async ({ page, request }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1800, height: 1400 });
    const session = await openPerformanceWorkbench(page, request);
    if (!session.available || !session.portfolioId) {
      test.skip(true, 'Performance upstream unavailable in standalone smoke environment.');
      return;
    }
    const posture = await loadSummaryPosture(request, session.portfolioId);
    test.skip(
      !posture.populated,
      'Populated layout proof requires supported source modules and complete source economics.',
    );

    const executiveStrip = page.getByLabel('Executive return strip');
    for (const label of [
      'Opening market value',
      'Net cash flow',
      'Opening cash flow',
      'Closing cash flow',
      'Flow-adjusted market value',
      'Ending market value',
    ]) {
      await expect(getExecutiveMetric(executiveStrip, label)).toBeVisible();
      await expect(getExecutiveMetric(executiveStrip, label)).not.toContainText(/N\/A|Unavailable/);
    }

    await expect(
      page.getByLabel(/Time-weighted return path · Net of fees (?:chart|single observation comparison)/),
    ).toBeVisible({ timeout: 30_000 });
    const returnDecisionReadout = page.getByLabel('Return decision readout');
    await expect(returnDecisionReadout).toBeVisible({ timeout: 15_000 });
    await expect(returnDecisionReadout).toContainText('Portfolio TWR');
    await expect(returnDecisionReadout).toContainText('Benchmark TWR');
    await expect(returnDecisionReadout).toContainText('Active return');
    await expect(returnDecisionReadout).toContainText('Money-weighted return (MWR)');

    const horizonModule = page
      .getByRole('heading', { name: /^Horizon Comparison$/i })
      .locator('xpath=ancestor::*[contains(@class, "performance-summary-driver-section")][1]');
    const driversModule = page
      .getByRole('heading', { name: /^Performance Drivers$/i })
      .locator('xpath=ancestor::*[contains(@class, "performance-summary-driver-section")][1]');
    const [horizonBox, driversBox] = await Promise.all([
      horizonModule.boundingBox(),
      driversModule.boundingBox(),
    ]);
    expect(horizonBox?.width ?? 0).toBeGreaterThan(500);
    expect(driversBox?.width ?? 0).toBeGreaterThan(420);
    expect(Math.abs((horizonBox?.y ?? 0) - (driversBox?.y ?? 9999))).toBeLessThanOrEqual(24);

    const firstHorizonRow = horizonModule.locator('.performance-horizon-matrix-row').first();
    await expect(firstHorizonRow).toBeVisible({ timeout: 15_000 });
    const firstHorizonPeriod = firstHorizonRow.locator('.performance-horizon-matrix-period');
    const firstHorizonSupport = firstHorizonRow.locator('.performance-horizon-matrix-support');
    const [rowBox, periodBox, supportBox] = await Promise.all([
      firstHorizonRow.boundingBox(),
      firstHorizonPeriod.boundingBox(),
      firstHorizonSupport.boundingBox(),
    ]);
    expect(periodBox?.width ?? 0).toBeGreaterThan(0);
    expect(supportBox?.width ?? 0).toBeGreaterThan(0);
    expect((supportBox?.x ?? 0) + (supportBox?.width ?? 0)).toBeLessThanOrEqual(
      (rowBox?.x ?? horizonBox?.x ?? 0) + (rowBox?.width ?? horizonBox?.width ?? 0) + 1,
    );

    await expectContributorGroupsToRemainSeparate(page);

    const contributionEvidenceNote = page.getByTestId('performance-contribution-evidence');
    await expect(contributionEvidenceNote).toBeVisible();
    await expect(contributionEvidenceNote).toContainText('Contribution coverage is limited');
    await expect(contributionEvidenceNote).toContainText(
      'Not source-authored: income effects and tax effects.',
    );
    const calculationEvidenceSummary = contributionEvidenceNote
      .locator('summary')
      .filter({ hasText: 'Calculation evidence' });
    const calculationEvidenceDisclosure = calculationEvidenceSummary.locator('xpath=ancestor::details[1]');
    await expect(calculationEvidenceDisclosure).not.toHaveAttribute('open');
    await calculationEvidenceSummary.focus();
    await page.keyboard.press('Enter');
    await expect(calculationEvidenceSummary).toBeFocused();
    await expect(calculationEvidenceDisclosure).toHaveAttribute('open');
    const calculationEvidence = contributionEvidenceNote.getByLabel(
      'Contribution calculation evidence',
    );
    await expect(calculationEvidence).toContainText('SOURCE_LIMITED');
    await expect(calculationEvidence).toContainText('APPLIED');
    await expect(calculationEvidence).toContainText(
      'LOTUS_CORE_ANALYTICS_INPUTS_USED, COMPONENT_PNL_NOT_SOURCE_AUTHORED',
    );

    const chartMetrics = await measureElement(page.locator('.performance-chart-stage'));
    expect(chartMetrics.height).toBeLessThanOrEqual(1300);
    expect(chartMetrics.width).toBeGreaterThan(900);

    const comparisonContext = page.getByLabel('Horizon comparison display context');
    await expect(comparisonContext).toContainText('Uses analysis selection');
    await expect(comparisonContext).toContainText('Net basis · Absolute return view');
    const comparisonDisplay = page.getByText('Adjust comparison display');
    await comparisonDisplay.focus();
    await page.keyboard.press('Enter');
    const comparisonDisclosure = comparisonDisplay.locator('xpath=ancestor::details[1]');
    const evidenceColumns = page.getByLabel('Evidence columns');
    await expect(evidenceColumns).toBeVisible();
    await evidenceColumns.focus();
    await expect(evidenceColumns).toBeFocused();
    await evidenceColumns.selectOption('returns');
    await expect(evidenceColumns).toHaveValue('returns');
    expect(
      await evidenceColumns.evaluate(
        (element) =>
          getComputedStyle(element.closest('.MuiInputBase-root') ?? element).outlineStyle,
      ),
    ).not.toBe('none');

    for (const width of [1440, 1024, 768, 519]) {
      await page.setViewportSize({ width, height: 1000 });
      await comparisonContext.scrollIntoViewIfNeeded();
      await expect(comparisonContext).toBeVisible();
      const disclosureBox = await comparisonDisclosure.boundingBox();
      expect(disclosureBox).not.toBeNull();
      for (const comparisonControl of [
        page.getByLabel('Evidence columns'),
        page.getByLabel('Basis comparison'),
        page.getByLabel('Return comparison'),
      ]) {
        const controlBox = await comparisonControl.boundingBox();
        expect(controlBox).not.toBeNull();
        expect(controlBox!.x).toBeGreaterThanOrEqual(disclosureBox!.x - 1);
        expect(controlBox!.x + controlBox!.width).toBeLessThanOrEqual(
          disclosureBox!.x + disclosureBox!.width + 1,
        );
      }
      await driversModule.scrollIntoViewIfNeeded();
      await expectContributorGroupsToRemainSeparate(page);
      await expect(calculationEvidenceSummary).toBeVisible();
      await expect(calculationEvidence).toBeVisible();
      const evidenceOverflow = await calculationEvidence.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(evidenceOverflow.scrollWidth - evidenceOverflow.clientWidth).toBeLessThanOrEqual(1);
      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(layout.scrollWidth - layout.clientWidth).toBeLessThanOrEqual(2);
    }
  });

  test('performance review uses one governed control bar and a decision-first return table', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      process.env.PERFORMANCE_E2E_FIXTURE !== 'populated',
      'This deterministic control-bar proof requires the populated performance fixture.',
    );
    test.setTimeout(120_000);
    const runtime = observeBrowserRuntimeFailures(page);
    const geometryEvidence: Array<Record<string, unknown>> = [];

    for (const viewport of [
      { name: 'desktop', width: 1440, height: 1000 },
      { name: 'compact-desktop', width: 1024, height: 1000 },
      { name: 'tablet', width: 768, height: 1100 },
      { name: 'compact-tablet', width: 561, height: 1000 },
      { name: 'compact', width: 519, height: 1000 },
      { name: 'phone', width: 390, height: 844 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const session = await openPerformanceWorkbench(page, request);
      expect(session.available).toBe(true);

      const controlBars = page.locator('[data-performance-analysis-control-bar="true"]');
      await expect(controlBars).toHaveCount(1);
      const controlBar = controlBars.first();
      await expect(controlBar).toBeVisible();
      const controlBarBounds = await controlBar.boundingBox();
      const returnPathStage = page.locator(
        '.performance-chart-library-frame[data-layout="single-observation"], .performance-chart-library-frame[data-layout="time-series"]',
      ).first();
      await expect(returnPathStage).toBeVisible();
      const returnPathBounds = await returnPathStage.boundingBox();
      const initialPageGeometry = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        scrollY: window.scrollY,
      }));
      geometryEvidence.push({
        viewport,
        controlBar: controlBarBounds,
        returnPathStage: returnPathBounds,
        page: initialPageGeometry,
      });
      if (viewport.width === 1440) {
        expect(
          controlBarBounds?.height ?? Number.POSITIVE_INFINITY,
          'desktop default control-bar height',
        ).toBeLessThanOrEqual(190);
        expect(
          returnPathBounds?.y ?? Number.POSITIVE_INFINITY,
          'desktop return-path stage top',
        ).toBeLessThanOrEqual(700);
      }
      await expect(page.getByRole('radio', { name: 'Absolute' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(await controlBar.locator('[data-workbench-choice-group]').count()).toBeLessThanOrEqual(
        3,
      );
      const metricRows = await page
        .locator('[data-return-metric]')
        .evaluateAll((metrics) => [
          ...new Set(metrics.map((metric) => Math.round(metric.getBoundingClientRect().y))),
        ]);
      expect(metricRows).toHaveLength(viewport.width > 640 ? 1 : 2);

      const customWindow = controlBar.locator('[data-performance-window-control="true"]');
      await expect(customWindow).toHaveAttribute('aria-haspopup', 'dialog');
      await expect(customWindow).toHaveAttribute('aria-expanded', 'false');
      await expect(customWindow).toContainText('Review window');
      await expect(customWindow).toContainText(/\d{1,2} \w{3} \d{4}/);
      const urlBeforeDialog = page.url();
      await customWindow.click();
      await expect(customWindow).toHaveAttribute('aria-expanded', 'true');
      const customWindowDialog = page.getByRole('dialog', {
        name: 'Choose a custom review window',
      });
      await expect(customWindowDialog).toBeVisible();
      await expect(
        customWindowDialog.getByRole('textbox', { name: 'From', exact: true }),
      ).toBeFocused();

      for (const label of ['From', 'To']) {
        const dateInput = customWindowDialog.getByRole('textbox', { name: label, exact: true });
        await expect(dateInput).toBeVisible();
        const bounds = await dateInput.boundingBox();
        expect(bounds?.width ?? 0, `${viewport.name} ${label} width`).toBeGreaterThanOrEqual(140);
        expect(bounds?.x ?? -1, `${viewport.name} ${label} left edge`).toBeGreaterThanOrEqual(0);
        expect(
          (bounds?.x ?? 0) + (bounds?.width ?? 0),
          `${viewport.name} ${label} right edge`,
        ).toBeLessThanOrEqual(viewport.width + 1);
      }
      if (viewport.width <= 420) {
        const dialogBounds = await customWindowDialog.boundingBox();
        expect(dialogBounds?.x ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
        expect(dialogBounds?.width ?? 0).toBeGreaterThanOrEqual(viewport.width - 2);
      }

      await page.screenshot({
        path: `output/playwright/issue-812-performance-window-dialog-${viewport.name}.png`,
        fullPage: false,
        animations: 'disabled',
      });

      if (viewport.width === 1440) {
        const refreshStatus = page.getByTestId('workbench-refresh-status');
        await customWindowDialog.getByRole('button', { name: 'Apply window' }).click();
        await expect(refreshStatus).toHaveAttribute('data-state', 'confirmed');
        await expect(customWindowDialog).not.toBeVisible();
        await expect(customWindow).toBeFocused();
        await expect.poll(() => new URL(page.url()).searchParams.get('period')).toBe('EXPLICIT');
      } else {
        await page.keyboard.press('Escape');
        await expect(customWindowDialog).not.toBeVisible();
        await expect(customWindow).toBeFocused();
        expect(page.url()).toBe(urlBeforeDialog);
      }
      await controlBar.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `output/playwright/issue-812-performance-control-bar-${viewport.name}.png`,
        fullPage: false,
        animations: 'disabled',
      });

      const historySummary = page.getByText('Return history', { exact: true });
      await historySummary.scrollIntoViewIfNeeded();
      await historySummary.click();
      const historyRegion = page.getByRole('region', { name: 'Return history columns' });
      await expect(historyRegion).toBeVisible();
      await expect(historyRegion).toHaveAttribute('tabindex', '0');

      const historyTable = page.getByRole('table', { name: 'Return path observation table' });
      for (const heading of [
        'Period',
        'Window',
        'Portfolio TWR',
        'Benchmark TWR',
        'Cumulative portfolio TWR',
        'Cumulative benchmark TWR',
      ]) {
        await expect(
          historyTable.getByRole('columnheader', { name: heading, exact: true }),
        ).toBeAttached();
      }
      await expect(historyTable.getByRole('columnheader', { name: 'Active return' })).toHaveCount(0);
      await expect(
        historyTable.getByRole('columnheader', { name: 'Cumulative active return' }),
      ).toHaveCount(0);

      const historyGeometry = await historyRegion.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      const historyOverflow = historyGeometry.scrollWidth - historyGeometry.clientWidth;
      if (historyOverflow <= 1) {
        expect(
          historyOverflow,
          `${viewport.name} return-history overflow`,
        ).toBeLessThanOrEqual(1);
      } else {
        expect(
          viewport.width,
          `${viewport.name} may use the governed compact table scroll`,
        ).toBeLessThanOrEqual(561);
        expect(historyGeometry.scrollWidth).toBeGreaterThan(historyGeometry.clientWidth);
        await historyRegion.evaluate((element) => {
          element.scrollLeft = element.scrollWidth;
        });
        const pinnedHeadings = await historyTable
          .getByRole('columnheader')
          .evaluateAll((headings) =>
            headings.slice(0, 2).map((heading) => ({
              position: getComputedStyle(heading).position,
              left: getComputedStyle(heading).left,
            })),
          );
        expect(pinnedHeadings).toEqual([
          { position: 'sticky', left: '0px' },
          { position: 'sticky', left: '76px' },
        ]);
        const pinnedBodyCells = await historyTable
          .locator('tbody tr:first-child td')
          .evaluateAll((cells) =>
            cells.slice(0, 2).map((cell) => ({
              position: getComputedStyle(cell).position,
              backgroundColor: getComputedStyle(cell).backgroundColor,
            })),
          );
        expect(pinnedBodyCells).toEqual([
          { position: 'sticky', backgroundColor: 'rgb(255, 255, 255)' },
          { position: 'sticky', backgroundColor: 'rgb(255, 255, 255)' },
        ]);
      }

      const pageGeometry = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(pageGeometry.scrollWidth - pageGeometry.clientWidth).toBeLessThanOrEqual(2);
      await page.screenshot({
        path: `output/playwright/issue-812-return-history-${viewport.name}.png`,
        fullPage: false,
        animations: 'disabled',
      });
    }

    await testInfo.attach('performance-control-bar-geometry', {
      body: Buffer.from(JSON.stringify(geometryEvidence, null, 2)),
      contentType: 'application/json',
    });
    const evidenceDirectory = process.env.PERFORMANCE_E2E_EVIDENCE_DIR?.trim();
    if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true });
      await writeFile(
        resolve(evidenceDirectory, 'performance-control-bar-geometry.json'),
        `${JSON.stringify({
          proofType: 'deterministic populated Workbench fixture',
          evidenceBoundary: 'Browser interaction and layout proof; not canonical live-source evidence.',
          geometry: geometryEvidence,
        }, null, 2)}\n`,
        'utf8',
      );
    }

    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPerformanceWorkbench(page, request);
    const analysisStep = await openPerformanceWorkflowStep(page, /^Performance analysis/i);
    await analysisStep.click();
    await expect(page.locator('[data-performance-analysis-control-bar="true"]')).toHaveCount(1);

    const riskStep = await openPerformanceWorkflowStep(page, /^Risk review/i);
    await riskStep.click();
    await expect(page.locator('[data-performance-analysis-control-bar="true"]')).toHaveCount(1);
    await expect(page.getByText('Risk context', { exact: true })).toHaveCount(0);

    await runtime.assertStylesAreHeadManaged();
    expect(runtime.snapshot()).toEqual([]);
  });

  test('single-observation Return Path stays compact, semantic, and responsive', async ({
    page,
    request,
  }) => {
    test.skip(
      process.env.PERFORMANCE_E2E_FIXTURE !== 'populated',
      'This deterministic layout proof requires the populated performance fixture.',
    );
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 1100 });
    const runtime = observeBrowserRuntimeFailures(page);
    const session = await openPerformanceWorkbench(page, request);
    expect(session.available).toBe(true);

    const returnPath = page.getByRole('group', {
      name: 'Time-weighted return path · Net of fees single observation comparison',
    });
    const comparison = returnPath.getByLabel('Single observation comparison');
    await expect(returnPath).toHaveAttribute('data-layout', 'single-observation');
    await expect(comparison).toBeVisible({ timeout: 30_000 });
    const combinedReturnView = page
      .getByRole('radiogroup', { name: 'Return view' })
      .getByRole('radio', { name: 'Combined' });
    if ((await combinedReturnView.getAttribute('aria-checked')) !== 'true') {
      await combinedReturnView.click();
    }
    await expect(combinedReturnView).toHaveAttribute('aria-checked', 'true');
    await expect(comparison).toContainText('Single published observation');
    await expect(comparison).toContainText('2026-01');
    await expect(comparison).toContainText('Portfolio');
    await expect(comparison).toContainText('+2.2%');
    await expect(comparison).toContainText('Benchmark');
    await expect(comparison).toContainText('+1.9%');
    await expect(comparison).toContainText('Active');
    await expect(comparison).toContainText('+0.3%');
    await expect(comparison.getByText('0%', { exact: true })).toBeVisible();
    await expect(returnPath.locator('a, button, input, select, textarea')).toHaveCount(0);

    await combinedReturnView.focus();
    await expect(combinedReturnView).toBeFocused();

    for (const width of [1440, 1024, 720, 519]) {
      await page.setViewportSize({ width, height: 1100 });
      await returnPath.scrollIntoViewIfNeeded();
      await expect(returnPath).toBeVisible();
      await expect(combinedReturnView).toBeFocused();

      const [returnPathBox, comparisonBox] = await Promise.all([
        returnPath.boundingBox(),
        comparison.boundingBox(),
      ]);
      expect(returnPathBox).not.toBeNull();
      expect(comparisonBox).not.toBeNull();
      if (!returnPathBox || !comparisonBox) {
        throw new Error('Return-path layout geometry was not available.');
      }

      const unusedBottomCapacity =
        returnPathBox.y + returnPathBox.height - (comparisonBox.y + comparisonBox.height);
      expect(unusedBottomCapacity).toBeLessThanOrEqual(8);

      if (width === 1440) {
        const retiredTimeSeriesCapacity = await page.evaluate(
          () => Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 28.5,
        );
        expect(returnPathBox.height).toBeLessThan(retiredTimeSeriesCapacity * 0.75);

        const horizonHeading = page.getByRole('heading', { name: /^Horizon Comparison$/i });
        const horizonBox = await horizonHeading.boundingBox();
        expect(horizonBox).not.toBeNull();
        expect((horizonBox?.y ?? 0) - (returnPathBox.y + returnPathBox.height)).toBeLessThan(
          retiredTimeSeriesCapacity,
        );
      }

      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(layout.scrollWidth - layout.clientWidth).toBeLessThanOrEqual(2);

      await page.screenshot({
        path: `output/playwright/issue-719-performance-return-path-${width}.png`,
        fullPage: false,
      });
    }

    await runtime.assertStylesAreHeadManaged();
    expect(runtime.snapshot()).toEqual([]);
  });

  test('task-aware navigation keeps Performance work available without catalogue overload', async ({
    page,
    request,
  }) => {
    test.skip(
      process.env.PERFORMANCE_E2E_FIXTURE !== 'populated',
      'This deterministic navigation proof requires the populated performance fixture.',
    );
    test.setTimeout(90_000);
    const runtime = observeBrowserRuntimeFailures(page);

    for (const viewport of [
      { name: 'desktop', width: 1440, height: 1000 },
      { name: 'tablet', width: 1024, height: 1100 },
      { name: 'compact', width: 519, height: 1000 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const session = await openPerformanceWorkbench(page, request);
      expect(session.available).toBe(true);

      const navigation = page.getByRole('navigation', {
        name: 'Workbench screen navigation',
      });
      await expectWorkbenchRelationshipIntegrity(page, [
        'performance-workspace-rail-navigation',
        'performance-workspace-rail-workspace-directory',
        'performance-workspace-rail-workflow-directory',
      ]);
      const compactNavigation = viewport.width <= 1200;
      const currentView = page.getByRole('button', {
        name: /Current view Performance/i,
      });
      if (compactNavigation) {
        await expect(navigation).not.toBeVisible();
        await currentView.click();
      }
      await expect(navigation).toBeVisible();
      await expect(navigation).toHaveAttribute('data-default-destination-count', '6');
      await expect(
        navigation
          .getByRole('group', { name: 'Primary workspaces' })
          .getByRole('link', { name: /Performance Returns and attribution/i }),
      ).toHaveAttribute('aria-current', 'page');
      await expect(
        navigation
          .getByRole('group', { name: 'Performance surface navigation' })
          .getByRole('button', { name: 'Performance overview' }),
      ).toHaveAttribute('aria-current', 'page');
      await expect(
        navigation.getByRole('button', { name: 'Performance analysis' }),
      ).toHaveCount(0);

      const allWorkspaces = navigation.getByRole('button', {
        name: /All workspaces/i,
      });
      await allWorkspaces.click();
      const positions = navigation.getByRole('link', {
        name: /Positions Valuation and profit or loss/i,
      });
      await expect(positions).toBeVisible();
      await expect(
        navigation.getByRole('link', { name: /Risk Exposure and risk review/i }),
      ).toBeVisible();
      await positions.focus();
      await page.keyboard.press('Escape');
      await expect(allWorkspaces).toBeFocused();
      await expect(positions).toHaveCount(0);

      const changeWorkflow = navigation.getByRole('button', {
        name: /Change workflow step/i,
      });
      await changeWorkflow.click();
      const analysis = navigation.getByRole('button', {
        name: 'Performance analysis',
      });
      await expect(analysis).toBeVisible();
      await analysis.focus();
      await page.keyboard.press('Escape');
      await expect(changeWorkflow).toBeFocused();
      await expect(analysis).toHaveCount(0);

      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(layout.scrollWidth - layout.clientWidth).toBeLessThanOrEqual(2);
      await page.screenshot({
        path: `output/playwright/issue-705-performance-navigation-${viewport.name}.png`,
        fullPage: true,
        animations: 'disabled',
      });

      if (compactNavigation) {
        await page.keyboard.press('Escape');
        await expect(currentView).toBeFocused();
        await expect(navigation).not.toBeVisible();
      }
    }
    await runtime.assertStylesAreHeadManaged();
    runtime.assertClean();
  });

  test('review context and focus survive Performance mode Back and Forward navigation', async ({
    page,
    request,
  }) => {
    test.skip(
      process.env.PERFORMANCE_E2E_FIXTURE !== 'populated',
      'This deterministic history proof requires the populated performance fixture.',
    );
    test.setTimeout(90_000);
    const runtime = observeBrowserRuntimeFailures(page);
    const portfolioId = await resolveSmokePortfolioId(request);
    expect(portfolioId).not.toBeNull();
    const summary = await loadPerformanceSmokeSummary(request, portfolioId!);
    const reviewUrl = new URL(
      buildPerformanceSmokePagePath(portfolioId!),
      'http://workbench.local',
    );
    reviewUrl.searchParams.set('asOfDate', summary.as_of_date);
    reviewUrl.searchParams.set('reportingCurrency', summary.portfolio.base_currency);

    await page.goto(`${reviewUrl.pathname}${reviewUrl.search}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByRole('heading', { name: /^Performance$/i })).toBeVisible({
      timeout: 30_000,
    });

    const navigation = page.getByRole('navigation', {
      name: 'Workbench screen navigation',
    });
    const changeWorkflow = navigation.getByRole('button', {
      name: /Change workflow step/i,
    });
    await changeWorkflow.click();
    const analysis = navigation.getByRole('button', {
      name: 'Performance analysis',
    });
    await analysis.focus();
    await analysis.click();

    await expect(changeWorkflow).toBeFocused();
    await expect(
      navigation.getByRole('button', { name: 'Performance analysis' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('analysis');
    expectGovernedPerformanceContext(page.url(), {
      portfolioId: portfolioId!,
      asOfDate: summary.as_of_date,
      period: 'YTD',
      reportingCurrency: summary.portfolio.base_currency,
      mode: 'analysis',
    });

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(changeWorkflow).toBeFocused();
    await expect(
      navigation.getByRole('button', { name: 'Performance overview' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBeNull();
    expectGovernedPerformanceContext(page.url(), {
      portfolioId: portfolioId!,
      asOfDate: summary.as_of_date,
      period: 'YTD',
      reportingCurrency: summary.portfolio.base_currency,
    });

    await page.goForward({ waitUntil: 'domcontentloaded' });
    await expect(changeWorkflow).toBeFocused();
    await expect(
      navigation.getByRole('button', { name: 'Performance analysis' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('analysis');
    expectGovernedPerformanceContext(page.url(), {
      portfolioId: portfolioId!,
      asOfDate: summary.as_of_date,
      period: 'YTD',
      reportingCurrency: summary.portfolio.base_currency,
      mode: 'analysis',
    });

    const sourceSelection = page.getByRole('group', {
      name: 'Performance analysis source selection',
    });
    const threeYearHorizon = sourceSelection.getByRole('radio', { name: '3Y' });
    await threeYearHorizon.focus();
    await threeYearHorizon.click();
    await expect(threeYearHorizon).toHaveAttribute('aria-checked', 'true');
    await expect(threeYearHorizon).toBeFocused();
    await expect.poll(() => new URL(page.url()).searchParams.get('period')).toBe('3Y');
    expectGovernedPerformanceContext(page.url(), {
      portfolioId: portfolioId!,
      asOfDate: summary.as_of_date,
      period: '3Y',
      reportingCurrency: summary.portfolio.base_currency,
      mode: 'analysis',
    });

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(sourceSelection.getByRole('radio', { name: 'YTD' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(threeYearHorizon).toBeFocused();
    await expect.poll(() => new URL(page.url()).searchParams.get('period')).toBe('YTD');
    expectGovernedPerformanceContext(page.url(), {
      portfolioId: portfolioId!,
      asOfDate: summary.as_of_date,
      period: 'YTD',
      reportingCurrency: summary.portfolio.base_currency,
      mode: 'analysis',
    });

    await page.goForward({ waitUntil: 'domcontentloaded' });
    await expect(threeYearHorizon).toHaveAttribute('aria-checked', 'true');
    await expect(threeYearHorizon).toBeFocused();
    await expect.poll(() => new URL(page.url()).searchParams.get('period')).toBe('3Y');
    expectGovernedPerformanceContext(page.url(), {
      portfolioId: portfolioId!,
      asOfDate: summary.as_of_date,
      period: '3Y',
      reportingCurrency: summary.portfolio.base_currency,
      mode: 'analysis',
    });

    await runtime.assertStylesAreHeadManaged();
    expect(runtime.snapshot()).toEqual([]);
  });

  test('review context is source-confirmed across Performance decision modes', async ({
    page,
    request,
  }) => {
    test.skip(
      process.env.PERFORMANCE_E2E_FIXTURE !== 'populated',
      'This deterministic source-context proof requires the populated performance fixture.',
    );
    test.setTimeout(90_000);
    const runtime = observeBrowserRuntimeFailures(page);
    const portfolioId = await resolveSmokePortfolioId(request);
    expect(portfolioId).not.toBeNull();
    const observedPerformanceRequests: string[] = [];
    page.on('request', (browserRequest) => {
      const url = browserRequest.url();
      if (url.includes(`/workbench/${portfolioId}/performance/`)) {
        observedPerformanceRequests.push(url);
      }
    });
    const reviewDate = '2026-02-23';
    const reportingCurrency = 'SGD';
    const reviewUrl = new URL(
      buildPerformanceSmokePagePath(portfolioId!),
      'http://workbench.local',
    );
    reviewUrl.searchParams.set('asOfDate', reviewDate);
    reviewUrl.searchParams.set('reportingCurrency', reportingCurrency);

    await page.goto(`${reviewUrl.pathname}${reviewUrl.search}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByRole('heading', { name: /^Performance$/i })).toBeVisible({
      timeout: 30_000,
    });
    const reviewContext = page.getByTestId('review-context-strip');
    await expect(reviewContext).toContainText('23 Feb 2026');
    await expect(reviewContext).toContainText('Base currency');
    await expect(reviewContext).toContainText('USD');
    await expect(
      reviewContext.getByText(
        /Performance remains in portfolio base currency USD because restatement to SGD has not been verified/i,
      ),
    ).toBeVisible();

    const analysisStep = await openPerformanceWorkflowStep(
      page,
      /^Performance analysis/i,
    );
    await analysisStep.click();
    const attributionEvidence = page.getByTestId('attribution-trend-evidence');
    await expect(attributionEvidence).toBeVisible();
    await expect(attributionEvidence).toHaveAttribute('data-state', 'single-observation');

    const adviserBriefStep = await openPerformanceWorkflowStep(page, /^Adviser brief/i);
    await adviserBriefStep.click();
    await expect(page.getByRole('heading', { name: 'Performance adviser brief' })).toBeVisible();
    await expect(page.getByLabel('Adviser brief toolbar')).toContainText('Ready');

    expect(new URL(page.url()).searchParams.get('asOfDate')).toBe(reviewDate);
    expect(new URL(page.url()).searchParams.get('reportingCurrency')).toBe(reportingCurrency);

    for (const path of [
      '/performance/details',
      '/performance/attribution-trend',
      '/performance/advisor-brief',
    ]) {
      expect(
        observedPerformanceRequests.some((url) => {
          const requestUrl = new URL(url);
          return (
            requestUrl.pathname.endsWith(path) &&
            requestUrl.searchParams.get('as_of_date') === reviewDate &&
            requestUrl.searchParams.get('reporting_currency') === reportingCurrency
          );
        }),
      ).toBe(true);
    }

    await runtime.assertStylesAreHeadManaged();
    expect(runtime.snapshot()).toEqual([]);
  });

  test('governed review context survives Portfolio to Performance and browser Back', async ({
    page,
  }) => {
    test.skip(
      process.env.PERFORMANCE_E2E_FIXTURE !== 'populated',
      'This deterministic cross-workspace proof requires the populated performance fixture.',
    );
    test.setTimeout(90_000);
    const runtime = observeBrowserRuntimeFailures(page);
    const reviewContext = {
      portfolioId: GOVERNED_REVIEW_PORTFOLIO_ID,
      asOfDate: GOVERNED_REVIEW_AS_OF_DATE,
      period: GOVERNED_REVIEW_PERIOD,
      reportingCurrency: GOVERNED_REVIEW_CURRENCY,
    };
    const portfolioUrl = new URL('/portfolio', 'http://workbench.local');
    Object.entries(reviewContext).forEach(([key, value]) => {
      portfolioUrl.searchParams.set(key, value);
    });

    await page.goto(`${portfolioUrl.pathname}${portfolioUrl.search}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByRole('heading', { name: /^Portfolio Review$/i })).toBeVisible({
      timeout: 30_000,
    });
    expectGovernedPerformanceContext(page.url(), reviewContext, '/portfolio');

    const workspaceNavigation = page.getByRole('navigation', {
      name: 'Workspace Navigation',
    });
    const workspaceTrigger = workspaceNavigation.getByRole('button', {
      name: 'Switch workspace. Current workspace Portfolio',
    });
    await workspaceTrigger.click();
    const performanceLink = workspaceNavigation.getByRole('link', {
      name: 'Performance',
    });
    await performanceLink.focus();
    await performanceLink.click();

    await expect(page.getByRole('heading', { name: /^Performance$/i })).toBeVisible({
      timeout: 30_000,
    });
    expectGovernedPerformanceContext(page.url(), reviewContext);
    await expect(
      page
        .getByRole('navigation', { name: 'Workspace Navigation' })
        .getByRole('button', {
          name: 'Switch workspace. Current workspace Performance',
        }),
    ).toBeFocused();

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /^Portfolio Review$/i })).toBeVisible({
      timeout: 30_000,
    });
    expectGovernedPerformanceContext(page.url(), reviewContext, '/portfolio');
    await expect(
      page
        .getByRole('navigation', { name: 'Workspace Navigation' })
        .getByRole('button', {
          name: 'Switch workspace. Current workspace Portfolio',
        }),
    ).toBeFocused();

    await runtime.assertStylesAreHeadManaged();
    expect(runtime.snapshot()).toEqual([]);
  });

  test('Risk Review renders Gateway mandate evidence without browser-owned policy', async ({
    page,
    request,
  }) => {
    test.skip(
      process.env.PERFORMANCE_E2E_FIXTURE !== 'populated',
      'This deterministic Risk Review proof requires the populated performance fixture.',
    );
    test.setTimeout(120_000);
    const runtime = observeBrowserRuntimeFailures(page);

    for (const viewport of [
      { name: 'desktop', width: 1440, height: 1000 },
      { name: 'tablet', width: 1024, height: 1100 },
      { name: 'compact', width: 519, height: 1000 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const session = await openPerformanceWorkbench(page, request);
      expect(session.available).toBe(true);

      const riskStep = await openPerformanceWorkflowStep(page, /^Risk review/i);
      await riskStep.click();
      await expect(page).toHaveURL(/(?:\?|&)mode=risk(?:&|$)/);
      await expect(
        page.getByRole('combobox', { name: 'Frequency' }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('group', {
          name: 'Risk analysis source selection',
          exact: true,
        }),
      ).toHaveAttribute('data-performance-frequency-control', 'hidden');

      const executiveEvidence = page.getByRole('region', {
        name: 'Risk executive overview',
      });
      await expect(executiveEvidence).toBeVisible();
      await expect(executiveEvidence).toContainText('Realised volatility');
      await expect(executiveEvidence).toContainText('7.25%');
      await expect(executiveEvidence).toContainText('Max drawdown');
      await expect(executiveEvidence).toContainText('-12.45%');
      await expect(executiveEvidence).toContainText('Largest position');
      await expect(executiveEvidence).toContainText('18.40%');
      await expect(executiveEvidence).toContainText('PIMCO GIS Income Fund');
      await expect(executiveEvidence).toContainText('Source coverage');

      const mandateComparison = page.getByTestId('risk-mandate-comparison');
      await expect(mandateComparison).toHaveAttribute('data-mandate-availability', 'supplied');
      await expect(mandateComparison).toContainText('MANDATE_PB_SG_GLOBAL_BAL_001');
      await expect(mandateComparison).toContainText('Source evidence supplied');
      const cashConstraint = page.getByTestId(
        'risk-mandate-constraint-summary-cash_band',
      );
      await expect(cashConstraint).toHaveCount(1);
      await expect(cashConstraint).toContainText('Cash allocation');
      await expect(cashConstraint).toHaveAttribute('data-mandate-state', 'within');
      await expect(mandateComparison).toContainText('Within mandate');
      await expect(mandateComparison).toContainText('Tracking error');
      await expect(mandateComparison).toContainText('Limit not defined');
      await expect(mandateComparison).toContainText('Largest issuer exposure');
      await expect(mandateComparison).toContainText('Outside mandate');
      await expect(mandateComparison).toContainText('21.07%');
      await expect(mandateComparison).toContainText('Maximum 20.00%');
      await expect(mandateComparison).toContainText('−1.07 pp');
      const breachRow = mandateComparison.locator('[data-mandate-state="breach"]');
      await expect(breachRow).toContainText('Largest issuer exposure');
      await expect(
        executiveEvidence.getByText(
          /^(Contained|Moderate|Elevated|High|Severe|Acceptable|Diversified)$/,
        ),
      ).toHaveCount(0);
      await expect(
        page.getByRole('heading', { name: 'Concentration', exact: true }),
      ).toBeVisible();
      await expect(
        page.locator('.performance-risk-share-bar-track').first(),
      ).toBeVisible();

      if (viewport.name === 'desktop') {
        const sourceEvidence = mandateComparison
          .locator('summary')
          .filter({ hasText: 'Source evidence and lineage' })
          .first();
        await sourceEvidence.focus();
        await expect(sourceEvidence).toBeFocused();
        await sourceEvidence.press('Enter');
        await expect(
          mandateComparison.getByRole('heading', {
            name: 'Cash allocation evidence',
            exact: true,
          }),
        ).toBeVisible();
        await expect(mandateComparison).toContainText('DiscretionaryMandateBinding v1');
        await expect(mandateComparison).toContainText('cash_weight');
      }

      const mandateLedgerGeometry = await mandateComparison
        .locator('[role="table"]')
        .first()
        .evaluate((table) => {
          const tableRect = table.getBoundingClientRect();
          const tolerance = 1;
          const clippedCells = Array.from(table.querySelectorAll('[role="cell"]'))
            .filter((cell) => {
              const cellRect = cell.getBoundingClientRect();
              return (
                cellRect.left < tableRect.left - tolerance ||
                cellRect.right > tableRect.right + tolerance
              );
            })
            .map((cell) => cell.textContent?.trim() ?? 'unnamed cell');

          return {
            clientWidth: table.clientWidth,
            scrollWidth: table.scrollWidth,
            clippedCells,
          };
        });
      expect(
        mandateLedgerGeometry.scrollWidth - mandateLedgerGeometry.clientWidth,
        `${viewport.name} mandate ledger overflow`,
      ).toBeLessThanOrEqual(1);
      expect(
        mandateLedgerGeometry.clippedCells,
        `${viewport.name} mandate evidence clipped by its pane`,
      ).toEqual([]);

      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(layout.scrollWidth - layout.clientWidth).toBeLessThanOrEqual(2);
      await page.screenshot({
        path: `output/playwright/risk-mandate-comparison-${viewport.name}.png`,
        fullPage: false,
        animations: 'disabled',
      });
    }

    expect(fixtureGateway).not.toBeNull();
    fixtureGateway?.setRiskAttributionPosture('partial-mixed');
    try {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      const attributionTable = page.getByLabel('Historical risk attribution table');
      await expect(page.getByText('Attribution is indicative')).toBeVisible();
      await expect(attributionTable).toContainText('Technology');
      await expect(attributionTable).toContainText('41.00%');
      await expect(
        attributionTable.locator('.performance-risk-share-bar-track'),
      ).toHaveCount(0);
      await expect(
        page.getByRole('radiogroup', { name: 'Risk attribution type' }),
      ).toBeVisible();
      await expect(
        page
          .getByLabel('Risk attribution detail')
          .getByText(
            'One review period has insufficient observations; available contributor values remain qualified.',
            { exact: true },
          ),
      ).toBeVisible();
      await page.screenshot({
        path: 'output/playwright/risk-attribution-partial-evidence.png',
        fullPage: true,
        animations: 'disabled',
      });
    } finally {
      fixtureGateway?.setRiskAttributionPosture('ready');
    }

    await runtime.assertStylesAreHeadManaged();
    expect(runtime.snapshot()).toEqual([]);
  });

  test('Risk revisit reuses fresh Gateway evidence without parallel cache reads', async ({
    page,
    request,
  }) => {
    test.skip(
      process.env.PERFORMANCE_E2E_FIXTURE !== 'populated',
      'This deterministic Risk revisit proof requires the populated performance fixture.',
    );
    test.setTimeout(90_000);
    const runtime = observeBrowserRuntimeFailures(page);
    const session = await openPerformanceWorkbench(page, request);
    expect(session.available).toBe(true);
    expect(fixtureGateway).not.toBeNull();
    const baseline = readPrimaryRiskRequestCounts();
    const firstRiskRead = incrementRiskRequestCounts(baseline);

    await (await openPerformanceWorkflowStep(page, /^Risk review/i)).click();
    await expect(
      page.getByRole('region', { name: 'Risk executive overview' }),
    ).toBeVisible();
    await expect.poll(() => readPrimaryRiskRequestCounts()).toEqual(firstRiskRead);

    await (await openPerformanceWorkflowStep(page, /^Performance overview/i)).click();
    await expect(page.getByLabel('Executive return strip')).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBeNull();
    await (await openPerformanceWorkflowStep(page, /^Risk review/i)).click();
    await expect(
      page.getByRole('region', { name: 'Risk executive overview' }),
    ).toBeVisible();

    expect(readPrimaryRiskRequestCounts()).toEqual(firstRiskRead);
    await runtime.assertStylesAreHeadManaged();
    expect(runtime.snapshot()).toEqual([]);
  });

  test('refresh failure keeps source-confirmed performance context and recovers without stale labels', async ({
    page,
    request,
  }) => {
    test.skip(
      process.env.PERFORMANCE_E2E_FIXTURE !== 'refresh-integrity',
      'This deterministic journey requires the refresh-integrity fixture.',
    );
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 1100 });
    const runtime = observeBrowserRuntimeFailures(page);
    const session = await openPerformanceWorkbench(page, request);
    expect(session.available).toBe(true);

    const horizon = page.getByRole('radiogroup', { name: 'Horizon' });
    await expect(horizon.getByRole('radio', { name: 'YTD' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    const requestedHorizon = horizon.getByRole('radio', { name: '3Y' });
    await requestedHorizon.click();

    const summaryFailure = page.getByTestId('workbench-refresh-status');
    await expect(summaryFailure).toContainText('Performance selection could not be confirmed');
    await expect(summaryFailure).toContainText('Requested3Y');
    await expect(summaryFailure).toContainText('Source-confirmedYTD · NET returns');
    await expect(summaryFailure).toContainText('HTTP 503');
    await expect(requestedHorizon).toBeFocused();
    await expect(horizon.getByRole('radio', { name: 'YTD' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(new URL(page.url()).searchParams.get('period')).toBe('YTD');

    const summaryRetry = summaryFailure.getByRole('button', {
      name: 'Retry performance selection',
    });
    await summaryRetry.focus();
    await expect(summaryRetry).toBeFocused();
    await summaryRetry.click();
    const summaryConfirmation = page.getByTestId('workbench-refresh-status');
    await expect(summaryConfirmation).toHaveAttribute('data-state', 'confirmed');
    await expect(summaryConfirmation).toContainText('Performance selection confirmed');
    await expect(horizon.getByRole('radio', { name: '3Y' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect.poll(() => new URL(page.url()).searchParams.get('period')).toBe('3Y');
    await expect(requestedHorizon).toBeFocused();

    const analysisTab = await openPerformanceWorkflowStep(
      page,
      /^Performance analysis/i,
    );
    const analysisNavigation = page.waitForResponse(
      (response) =>
        response.url().includes('/performance?') &&
        response.url().includes('mode=analysis') &&
        response.headers()['content-type']?.includes('text/x-component') === true,
      { timeout: 30_000 },
    );
    await Promise.all([analysisNavigation, analysisTab.click()]);
    await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('analysis');
    const performanceDrivers = page.locator('#performance-drivers');
    await performanceDrivers.scrollIntoViewIfNeeded();
    await expect(performanceDrivers).toBeVisible({ timeout: 30_000 });
    const contributionSegment = page.getByRole('combobox', {
      name: 'Contribution Segment',
    });
    await expect(contributionSegment).toBeVisible({ timeout: 30_000 });
    await contributionSegment.click();
    await page.getByRole('option', { name: 'Sector' }).click();

    const detailsFailure = page.getByTestId('workbench-refresh-status');
    await expect(detailsFailure).toContainText(
      'Contribution and attribution detail could not be confirmed',
    );
    await expect(detailsFailure).toContainText('RequestedSector contribution');
    await expect(detailsFailure).toContainText('HTTP 502');
    await expect(contributionSegment).toBeFocused();
    await expect(contributionSegment).toContainText('Asset Class');
    await detailsFailure.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: 'output/playwright/issue-679-performance-refresh-failure-desktop.png',
      fullPage: false,
    });

    for (const width of [1024, 768, 519]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(detailsFailure).toBeVisible();
      await detailsFailure.scrollIntoViewIfNeeded();
      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(layout.scrollWidth - layout.clientWidth).toBeLessThanOrEqual(2);
      if (width === 519) {
        await page.screenshot({
          path: 'output/playwright/issue-679-performance-refresh-failure-narrow.png',
          fullPage: false,
        });
      }
    }

    const detailRetry = detailsFailure.getByRole('button', {
      name: 'Retry performance selection',
    });
    await detailRetry.focus();
    await expect(detailRetry).toBeFocused();
    await detailRetry.click();
    await expect(detailsFailure).toHaveAttribute('data-state', 'confirmed');
    await expect(detailsFailure).toContainText('Contribution and attribution detail confirmed');
    await expect(contributionSegment).toContainText('Sector');
    await expect.poll(
      () => new URL(page.url()).searchParams.get('contributionDimension'),
    ).toBe('sector');
    await expect(contributionSegment).toBeFocused();
    await detailsFailure.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: 'output/playwright/issue-679-performance-refresh-confirmed-narrow.png',
      fullPage: false,
    });
    await expect(detailsFailure).toHaveCount(0, { timeout: 7_000 });
    await runtime.assertStylesAreHeadManaged();
    const expectedFailureSignals = runtime.snapshot();
    expect(
      expectedFailureSignals,
      'The failure journey must emit only the two deliberately exercised BFF errors.',
    ).toHaveLength(2);
    expect(expectedFailureSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'console',
          message: expect.stringContaining('503 (Service Unavailable)'),
          url: expect.stringContaining('/performance/summary?period=3Y'),
        }),
        expect.objectContaining({
          source: 'console',
          message: expect.stringContaining('502 (Bad Gateway)'),
          url: expect.stringContaining(
            '/performance/details?period=3Y&chart_frequency=monthly&contribution_dimension=sector',
          ),
        }),
      ]),
    );
  });

  test('analysis mode renders live attribution analytics', async ({ page, request }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1800, height: 1400 });
    const session = await openPerformanceWorkbench(page, request);
    test.skip(!session.available, 'Performance upstream unavailable in standalone smoke environment.');

    const analysisTab = await openPerformanceWorkflowStep(
      page,
      /^Performance analysis/i,
    );
    await analysisTab.click();
    await expect(analysisTab).toHaveAttribute('aria-current', 'page');

    const analysisStage = page.locator('.performance-analysis-stage');
    await expect(analysisStage).toBeVisible({ timeout: 15000 });

    const trendEvidence = page.getByTestId('attribution-trend-evidence');
    await expect(trendEvidence).toBeVisible({ timeout: 15_000 });
    await expect(trendEvidence).not.toHaveAttribute('data-state', 'loading');
    const trendEvidenceState = await trendEvidence.getAttribute('data-state');
    expect(['single-observation', 'multi-observation']).toContain(trendEvidenceState);
    await expect(
      page.getByRole('heading', { name: /^Attribution Detail$/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole('heading', { name: /^Performance Drivers$/i })
    ).toBeVisible({ timeout: 15000 });

    const trendShell = page.locator('.performance-analysis-trend-shell');
    await expect(trendShell).toBeVisible();
    await expect(page.getByLabel('Attribution trend summary strip')).toBeVisible({
      timeout: 30000,
    });
    if (trendEvidenceState === 'single-observation') {
      await expect(page.getByRole('heading', { name: 'Attribution Observation' })).toBeVisible();
      await expect(trendEvidence).toHaveAttribute('data-observation-count', '1');
      await expect(page.getByLabel('Attribution observation table')).toBeVisible();
      await expect(page.getByRole('img', { name: 'Attribution over time chart' })).toHaveCount(0);
    } else {
      await expect(page.getByRole('heading', { name: 'Attribution Over Time' })).toBeVisible();
      await expect(page.getByRole('img', { name: 'Attribution over time chart' })).toBeVisible();
      await expect(page.getByLabel('Attribution trend table')).toBeVisible();
    }
    const attributionTrendStrip = page.getByLabel('Attribution trend summary strip');
    await expect(attributionTrendStrip.getByText('Total effect', { exact: true })).toBeVisible();
    await expect(attributionTrendStrip.getByText('Cumulative effect', { exact: true })).toBeVisible();

    await expect(page.getByLabel('Top Effects panel')).toHaveCount(0);
    await expect(page.getByLabel('Attribution Detail panel')).toHaveCount(0);
    await expect(page.getByText('Top Active Effects')).toHaveCount(0);
    const attributionUnavailableState = page.getByText('Attribution detail unavailable');
    if (await attributionUnavailableState.isVisible().catch(() => false)) {
      await expect(attributionUnavailableState).toBeVisible();
      await expect(page.getByLabel(/Asset Class attribution table/i)).toHaveCount(0);
      await expect(page.getByLabel(/Asset Class attribution totals/i)).toHaveCount(0);
    } else {
      await expect(page.getByRole('heading', { name: /^Attribution Detail$/i })).toBeVisible();
      const missingAttributionLevels = page.getByText(
        'Attribution detail is marked available, but no segment attribution levels were returned for the current selection.'
      );
      await expect(
        page
          .getByLabel(/Asset Class attribution table/i)
          .or(page.getByLabel(/Asset Class attribution totals/i))
          .or(missingAttributionLevels)
      ).toBeVisible({ timeout: 30000 });
      const breakdownDetailCount = await page.getByLabel(/Asset Class attribution table/i).count();
      const breakdownSummaryCount = await page.getByLabel(/Asset Class attribution totals/i).count();
      if (breakdownDetailCount + breakdownSummaryCount === 0) {
        await expect(missingAttributionLevels).toBeVisible();
      } else if (breakdownSummaryCount > 0) {
        await expect(page.getByText('Attribution Summary')).toBeVisible();
      }
    }

    const trendMetrics = await measureElement(trendShell);
    expect(trendMetrics.height).toBeLessThanOrEqual(900);
    expect(trendMetrics.width).toBeGreaterThan(800);
  });

  test('Analysis source controls confirm horizon and benchmark without a mode change', async ({
    page,
    request,
  }) => {
    test.skip(
      process.env.PERFORMANCE_E2E_FIXTURE !== 'analysis-controls',
      'This deterministic journey requires the analysis-controls fixture.',
    );
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1800, height: 1200 });
    const runtime = observeBrowserRuntimeFailures(page);
    const session = await openPerformanceWorkbench(page, request);
    expect(session.available).toBe(true);

    const analysisTab = await openPerformanceWorkflowStep(
      page,
      /^Performance analysis/i,
    );
    await analysisTab.click();
    await expect(analysisTab).toHaveAttribute('aria-current', 'page');

    const sourceSelection = page.getByRole('group', {
      name: 'Performance analysis source selection',
    });
    await expect(sourceSelection).toBeVisible();
    await expect(page.getByRole('group', { name: 'Return-path presentation' })).toHaveCount(0);
    await expect(page.getByRole('radiogroup', { name: 'Return view' })).toHaveCount(0);

    const threeYearHorizon = sourceSelection.getByRole('radio', { name: '3Y' });
    await threeYearHorizon.focus();
    await expect(threeYearHorizon).toBeFocused();
    await threeYearHorizon.click();

    const refreshStatus = page.getByTestId('workbench-refresh-status');
    await expect(refreshStatus).toHaveAttribute('data-state', 'pending');
    await expect(refreshStatus).toContainText('Confirming the selected performance view');
    await expect(sourceSelection.getByRole('radio', { name: 'YTD' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(refreshStatus).toHaveAttribute('data-state', 'confirmed');
    await expect(threeYearHorizon).toHaveAttribute('aria-checked', 'true');
    await expect(threeYearHorizon).toBeFocused();
    await expect.poll(() => new URL(page.url()).searchParams.get('period')).toBe('3Y');
    await expect(analysisTab).toHaveAttribute('aria-current', 'page');

    const benchmark = sourceSelection.getByLabel('Benchmark');
    await benchmark.focus();
    await benchmark.selectOption('BMK_PRIVATE_BANK');
    await expect(refreshStatus).toHaveAttribute('data-state', 'pending');
    await expect(benchmark).toBeDisabled();
    await expect(refreshStatus).toHaveAttribute('data-state', 'confirmed');
    await expect(benchmark).toHaveValue('BMK_PRIVATE_BANK');
    await expect(benchmark).toBeFocused();
    await expect.poll(() => new URL(page.url()).searchParams.get('benchmark')).toBe(
      'BMK_PRIVATE_BANK',
    );
    await expect(benchmark.locator('option:checked')).toHaveText(
      'Private Bank Composite • USD • Composite'
    );
    await expect(analysisTab).toHaveAttribute('aria-current', 'page');

    for (const width of [1800, 1280, 1024, 768, 519]) {
      await page.setViewportSize({ width, height: 1000 });
      await sourceSelection.scrollIntoViewIfNeeded();
      await expect(sourceSelection).toBeVisible();
      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(layout.scrollWidth - layout.clientWidth).toBeLessThanOrEqual(2);
    }

    // MUI makes the page content inert while the modal is open, so a role locator rooted in the
    // source-selection group correctly leaves the accessibility tree. Keep inspecting the same
    // source-backed trigger through its stable DOM contract while independently proving the dialog.
    const customWindow = page.locator(
      '[data-performance-source-control-region="true"][aria-label="Performance analysis source selection"] [data-performance-window-control="true"]'
    );
    for (const [name, touchTarget] of [
      ['3Y horizon', threeYearHorizon],
      ['Benchmark', benchmark],
      ['Review window', customWindow],
    ] as const) {
      const bounds = await touchTarget.boundingBox();
      expect(bounds?.height, `${name} touch target height`).toBeGreaterThanOrEqual(44);
    }
    await expect(customWindow).toHaveAttribute('aria-expanded', 'false');
    await customWindow.click();
    await expect(customWindow).toHaveAttribute('aria-expanded', 'true');
    const reviewWindowDialog = page.getByRole('dialog', {
      name: 'Choose a custom review window',
    });
    const applyButton = reviewWindowDialog.getByRole('button', { name: 'Apply window' });
    await expect(applyButton).toBeVisible();
    expect((await applyButton.boundingBox())?.height, 'Apply touch target height').toBeGreaterThanOrEqual(
      44
    );

    await page.screenshot({
      path: 'output/playwright/issue-681-performance-analysis-controls-narrow.png',
      fullPage: false,
    });
    await runtime.assertStylesAreHeadManaged();
    expect(runtime.snapshot()).toEqual([]);
  });

  test('attribution history failure remains explicit until source retry succeeds', async ({
    page,
    request,
  }) => {
    test.skip(
      process.env.PERFORMANCE_E2E_FIXTURE !== 'trend-integrity',
      'This deterministic journey requires the trend-integrity fixture.',
    );
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 1100 });
    const runtime = observeBrowserRuntimeFailures(page);
    const session = await openPerformanceWorkbench(page, request);
    expect(session.available).toBe(true);

    const analysisTab = await openPerformanceWorkflowStep(
      page,
      /^Performance analysis/i,
    );
    await analysisTab.click();

    const evidence = page.getByTestId('attribution-trend-evidence');
    await expect(evidence).toHaveAttribute('data-state', 'error', { timeout: 30_000 });
    await expect(evidence.getByRole('alert')).toContainText(
      'Attribution history could not be refreshed',
    );
    await expect(evidence).toContainText('Source response 503');
    await expect(evidence).not.toContainText('Attribution trend unavailable');

    const refresh = page.getByRole('button', { name: 'Refresh history' });
    await refresh.focus();
    await expect(refresh).toBeFocused();
    await refresh.click();
    await expect(page.getByRole('button', { name: 'Refreshing…' })).toBeDisabled();
    await expect(evidence).toHaveAttribute('data-state', 'single-observation');
    await expect(evidence).toHaveAttribute('data-observation-count', '1');
    await expect(page.getByRole('button', { name: 'Refresh history' })).toBeFocused();
    await expect(page.getByRole('heading', { name: 'Attribution Observation' })).toBeVisible();
    await expect(page.getByLabel('Attribution observation table')).toBeVisible();
    await expect(page.getByText('One published observation')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Attribution over time chart' })).toHaveCount(0);

    for (const width of [1024, 768, 519]) {
      await page.setViewportSize({ width, height: 1000 });
      await evidence.scrollIntoViewIfNeeded();
      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(layout.scrollWidth - layout.clientWidth).toBeLessThanOrEqual(2);
    }

    await page.screenshot({
      path: 'output/playwright/issue-682-attribution-observation-narrow.png',
      fullPage: false,
    });
    await runtime.assertStylesAreHeadManaged();
    expect(runtime.snapshot()).toEqual([
      expect.objectContaining({
        source: 'console',
        message: expect.stringContaining('503 (Service Unavailable)'),
        url: expect.stringContaining('/performance/attribution-trend?'),
      }),
    ]);
  });

  test('horizon comparison failure remains explicit until exact source retry succeeds', async ({
    page,
    request,
  }) => {
    test.skip(
      process.env.PERFORMANCE_E2E_FIXTURE !== 'horizon-integrity',
      'This deterministic journey requires the horizon-integrity fixture.',
    );
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 1100 });
    const runtime = observeBrowserRuntimeFailures(page);
    const session = await openPerformanceWorkbench(page, request);
    expect(session.available).toBe(true);

    const evidence = page.getByTestId('horizon-comparison-evidence');
    await expect(evidence).toHaveAttribute('data-state', 'error', { timeout: 30_000 });
    await expect(evidence.getByRole('alert')).toContainText(
      'Horizon comparison could not be refreshed',
    );
    await expect(evidence).toContainText('Source response 503');
    await expect(evidence).not.toContainText('No published horizon comparison');

    for (const width of [1024, 768, 519]) {
      await page.setViewportSize({ width, height: 1000 });
      await evidence.scrollIntoViewIfNeeded();
      await expect(evidence).toBeVisible();
      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(layout.scrollWidth - layout.clientWidth).toBeLessThanOrEqual(2);
    }
    await page.screenshot({
      path: 'output/playwright/issue-683-horizon-comparison-failure-narrow.png',
      fullPage: false,
    });

    const refresh = page.getByRole('button', { name: 'Refresh comparison' });
    await refresh.focus();
    await expect(refresh).toBeFocused();
    await refresh.click();
    await expect(page.getByRole('button', { name: 'Refreshing…' })).toBeDisabled();
    await expect(evidence).toHaveAttribute('data-state', 'multi-observation');
    await expect(evidence).toHaveAttribute('data-observation-count', '4');
    await expect(page.getByRole('button', { name: 'Refresh comparison' })).toBeFocused();
    await expect(page.getByLabel('Multi-horizon returns')).toBeVisible();
    await expect(page.getByLabel('Horizon comparison display context')).toContainText(
      'Uses analysis selection',
    );
    await expect(page.getByText('Adjust comparison display')).toBeVisible();

    for (const width of [1024, 768, 519]) {
      await page.setViewportSize({ width, height: 1000 });
      await evidence.scrollIntoViewIfNeeded();
      await expect(evidence).toBeVisible();
      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(layout.scrollWidth - layout.clientWidth).toBeLessThanOrEqual(2);
    }

    await page.screenshot({
      path: 'output/playwright/issue-683-horizon-comparison-recovered-narrow.png',
      fullPage: false,
    });
    await runtime.assertStylesAreHeadManaged();
    expect(runtime.snapshot()).toEqual([
      expect.objectContaining({
        source: 'console',
        message: expect.stringContaining('503 (Service Unavailable)'),
        url: expect.stringContaining('/performance/horizon-comparison?'),
      }),
    ]);
  });

  test('advisor brief discloses AI, evidence, review, and client-use posture accessibly', async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1280, height: 1000 });
    const session = await openPerformanceWorkbench(page, request);
    test.skip(!session.available, 'Performance upstream unavailable in standalone smoke environment.');

    const advisorTab = await openPerformanceWorkflowStep(page, /^Adviser brief/i);
    await advisorTab.click();
    await expect(advisorTab).toHaveAttribute('aria-current', 'page');

    const disclosure = page.locator('details').filter({ hasText: 'How this was prepared' });
    const disclosureSummary = disclosure.locator('summary');
    await expect(disclosureSummary).toContainText('Live output • review required');
    await expect(disclosureSummary).toContainText('Performance adviser brief');

    await disclosureSummary.focus();
    await page.keyboard.press('Enter');
    await expect(disclosure).toHaveAttribute('open', '');
    await expect(disclosure).toContainText('Prepared with AI assistance');
    await expect(disclosure).toContainText('Availability');
    await expect(disclosure).toContainText('Current output is available');
    await expect(disclosure).toContainText('Source evidence attached');
    await expect(disclosure).toContainText('Human review required');
    await expect(disclosure).toContainText('Not approved for client use');
    await expect(disclosure).toContainText('Freshness not reported');
    await expect(page.getByLabel('Adviser talking points')).toContainText(
      'Portfolio outperformed its benchmark',
    );
    await expect(page.getByText('Client Talking Points')).toHaveCount(0);

    await page.screenshot({
      path: 'output/playwright/diagnostic-ai-assistance-disclosure-532-desktop.png',
      fullPage: true,
    });

    await page.setViewportSize({ width: 720, height: 1000 });
    await expect(disclosure).toHaveAttribute('open', '');

    const overflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(overflow.scrollWidth - overflow.clientWidth).toBeLessThanOrEqual(2);

    await page.screenshot({
      path: 'output/playwright/diagnostic-ai-assistance-disclosure-532-narrow.png',
      fullPage: true,
    });
  });

  test('Advisor Brief review transaction requires confirmation and renders source-recorded proof', async ({
    browser,
    page,
    request,
  }) => {
    test.skip(
      process.env.PERFORMANCE_E2E_FIXTURE !== 'populated' ||
        process.env.WORKBENCH_E2E_FIXTURE_GATEWAY !== 'performance',
      'This mutating journey requires the process-owned populated Performance fixture.',
    );
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 1100 });
    const runtime = observeBrowserRuntimeFailures(page);
    const session = await openPerformanceWorkbench(page, request);
    expect(session.available).toBe(true);

    await (await openPerformanceWorkflowStep(page, /^Adviser brief/i)).click();

    const review = page.getByLabel('Adviser brief human review');
    await expect(review).toBeVisible();
    await review.getByLabel('Review decision').selectOption('ACCEPT');
    await review.getByLabel(/Reviewer reference/).fill('advisor_e2e');
    await review
      .getByLabel('Review rationale')
      .fill('Source evidence and narrative are suitable for permitted internal use.');
    const reviewRequests: string[] = [];
    page.on('request', (browserRequest) => {
      if (browserRequest.url().includes('/performance/advisor-brief/review-actions')) {
        reviewRequests.push(browserRequest.method());
      }
    });

    await review.getByRole('button', { name: 'Review decision' }).click();
    await expect(review.getByRole('button', { name: 'Confirm acceptance' })).toBeFocused();
    expect(reviewRequests).toEqual([]);
    await expect(review).toContainText('It does not approve client communication');

    await review.getByRole('button', { name: 'Confirm acceptance' }).click();
    await expect(review).toContainText(
      'The brief was accepted for its permitted internal workflow use.',
    );
    await expect(review.getByRole('status')).toBeFocused();
    await expect(review).toContainText('No further review decision is currently available');
    expect(reviewRequests).toEqual(['POST']);

    await page.reload();
    await expect(review).toContainText('Accepted for internal use');
    await expect(review).toContainText('No further review decision is currently available');
    await expect(review.getByLabel('Review decision')).toHaveCount(0);
    expect(reviewRequests).toEqual(['POST']);

    const disclosure = page.locator('details').filter({ hasText: 'How this was prepared' });
    await disclosure.locator('summary').click();
    await expect(disclosure).toContainText('Human review recorded');
    await expect(disclosure).toContainText('advisor_e2e');
    await expect(disclosure).toContainText('21 Apr 2026, 03:22 UTC');
    await expect(disclosure).not.toContainText('2026-04-21T03:22:00Z');
    await expect(disclosure).toContainText('Not approved for client use');

    const reviewEvidence = page.getByTestId('advisor-brief-human-review-evidence');
    await expect(reviewEvidence).toContainText('Recorded 21 Apr 2026, 03:22 UTC');
    await expect(reviewEvidence).toHaveAttribute(
      'data-recorded-at',
      '2026-04-21T03:22:00Z',
    );
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await reviewEvidence.scrollIntoViewIfNeeded();
    await reviewEvidence.screenshot({
      path: 'output/playwright/issue-965-human-review-evidence-1440.png',
      animations: 'disabled',
    });

    const singaporeContext = await browser.newContext({
      baseURL: new URL(page.url()).origin,
      timezoneId: 'Asia/Singapore',
      viewport: { width: 1440, height: 1100 },
    });
    try {
      const singaporePage = await singaporeContext.newPage();
      const singaporeSession = await openPerformanceWorkbench(singaporePage, request);
      expect(singaporeSession.available).toBe(true);
      await (await openPerformanceWorkflowStep(singaporePage, /^Adviser brief/i)).click();

      const singaporeEvidence = singaporePage.getByTestId(
        'advisor-brief-human-review-evidence',
      );
      await expect(singaporeEvidence).toContainText('Recorded 21 Apr 2026, 03:22 UTC');
      await expect(singaporeEvidence).toHaveAttribute(
        'data-recorded-at',
        '2026-04-21T03:22:00Z',
      );
      await expect(singaporeEvidence).not.toContainText('11:22');
    } finally {
      await singaporeContext.close();
    }

    const supportDetails = page.locator('details').filter({
      hasText: 'Source support details',
    });
    await expect(supportDetails).not.toHaveAttribute('open', '');

    for (const width of [1440, 1024, 768, 519]) {
      await page.setViewportSize({ width, height: 1000 });
      await review.scrollIntoViewIfNeeded();
      await expect(review).toBeVisible();
      const overflow = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(overflow.scrollWidth - overflow.clientWidth).toBeLessThanOrEqual(2);
      await page.evaluate(() => window.scrollTo({ top: 0 }));
      await page.screenshot({
        path: `output/playwright/issue-965-adviser-brief-css-ownership-${width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    }

    await runtime.assertStylesAreHeadManaged();
    expect(runtime.snapshot()).toEqual([]);
  });

  test('analysis contribution module renders live position detail cleanly', async ({ page, request }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1800, height: 1400 });
    const session = await openPerformanceWorkbench(page, request);
    test.skip(!session.available, 'Performance upstream unavailable in standalone smoke environment.');

    const analysisTab = await openPerformanceWorkflowStep(
      page,
      /^Performance analysis/i,
    );
    await expect(analysisTab).toBeVisible();
    await analysisTab.click();
    await expect(analysisTab).toHaveAttribute('aria-current', 'page');

    const contributionModule = page.locator('#performance-drivers');
    await expect(contributionModule).toBeVisible({ timeout: 15000 });
    await contributionModule.scrollIntoViewIfNeeded();
    await expect(
      contributionModule.getByRole('heading', { name: /^Performance Drivers$/i })
    ).toBeVisible();
    await expect(contributionModule.getByLabel('Top / Bottom Contributors panel')).toHaveCount(0);
    await expect(contributionModule.getByLabel('Contribution Detail panel')).toHaveCount(0);
    await expect(contributionModule.getByText('Top / Bottom Contributors')).toHaveCount(0);
    await expect(contributionModule.getByText('Contributor Ranking')).toHaveCount(0);
    const missingContributionDetail = contributionModule.getByText(
      'Contribution detail is marked available, but no position or segment contribution rows were returned for the current selection.'
    );
    const positionContributionTable = contributionModule.getByLabel('Position contribution table');
    const segmentContributionTable = contributionModule.getByLabel(/Asset Class contribution table/i);
    await expect.poll(
      async () =>
        (await positionContributionTable.isVisible()) ||
        (await segmentContributionTable.isVisible()) ||
        (await missingContributionDetail.isVisible()),
      { timeout: 30000 },
    ).toBe(true);
    if (await missingContributionDetail.isVisible()) {
      await expect(missingContributionDetail).toBeVisible();
      return;
    }
    if (await segmentContributionTable.isVisible()) {
      await expect(segmentContributionTable).toBeVisible();
      const aggregateFrame = await measureTableFrame(
        segmentContributionTable.locator('..')
      );
      expect(aggregateFrame.scrollWidth - aggregateFrame.clientWidth).toBeLessThanOrEqual(12);
      return;
    }
    await expect(positionContributionTable).toBeVisible();
    await expect(contributionModule.getByRole('tab', { name: /^Positions/i })).toBeVisible();
    await expect(segmentContributionTable).not.toBeVisible();
    await expect(
      contributionModule
        .getByRole('tab', { name: /^Positions/i })
    ).toHaveAttribute('aria-selected', 'true');
    const segmentSummaryTab = contributionModule.getByRole('tab', { name: /^Segment Summary/i });
    await expect(segmentSummaryTab).toHaveAttribute('aria-selected', 'false');
    const positionsTab = contributionModule.getByRole('tab', { name: /^Positions/i });
    const positionPanel = contributionModule.getByRole('tabpanel');
    await expect(positionsTab).toHaveAttribute('aria-controls', await positionPanel.getAttribute('id') ?? '');
    await expect(positionPanel).toHaveAttribute('aria-labelledby', await positionsTab.getAttribute('id') ?? '');

    const positionHeaders = await contributionModule
      .locator('table[aria-label="Position contribution table"] thead th')
      .allTextContents();
    expect(positionHeaders.slice(0, 4)).toEqual([
      'Position',
      'Contribution',
      'Average weight',
      'TWR',
    ]);
    const positionRows = contributionModule.locator(
      'table[aria-label="Position contribution table"] tbody tr'
    );
    await expect(positionRows.first()).toBeVisible();
    expect(await positionRows.count()).toBeGreaterThan(0);

    const positionFrame = await measureTableFrame(
      contributionModule.getByLabel('Position contribution table').locator('..')
    );
    expect(positionFrame.scrollWidth - positionFrame.clientWidth).toBeLessThanOrEqual(12);

    if (await segmentSummaryTab.isDisabled()) {
      await expect(segmentSummaryTab).toBeDisabled();
      await expect(positionsTab).toHaveAttribute('aria-selected', 'true');
      await expect(positionPanel).toBeVisible();
    } else {
      await positionsTab.focus();
      await page.keyboard.press('ArrowRight');
      await expect(segmentSummaryTab).toHaveAttribute('aria-selected', 'true');
      await expect(segmentSummaryTab).toBeFocused();
      await expect(positionContributionTable).not.toBeVisible();
      await expect(segmentContributionTable).toBeVisible();
      await expect(contributionModule.getByText('Equity')).toBeVisible();
      await expect(
        contributionModule.locator('table[aria-label*="Asset Class contribution"] tbody tr').first(),
      ).toBeVisible();

      const aggregateFrame = await measureTableFrame(
        segmentContributionTable.locator('..')
      );
      expect(aggregateFrame.scrollWidth - aggregateFrame.clientWidth).toBeLessThanOrEqual(12);
    }

    const moduleMetrics = await measureElement(contributionModule);
    expect(moduleMetrics.width).toBeGreaterThan(1000);
    expect(moduleMetrics.height).toBeLessThan(1200);
  });

  test('evidence mode proves exception-first calculation assurance', async ({ page, request }, testInfo) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1800, height: 1400 });
    const session = await openPerformanceWorkbench(page, request);
    if (!session.available || !session.portfolioId) {
      test.skip(true, 'Performance upstream unavailable in standalone smoke environment.');
      return;
    }
    const posture = await loadSummaryPosture(request, session.portfolioId);

    const evidenceTab = await openPerformanceWorkflowStep(page, /^Evidence/i);
    if (posture.capabilities.evidence === 'unavailable') {
      await expect(evidenceTab).toBeDisabled();
      await expect(evidenceTab).toContainText('Unavailable');
      await expect(page.getByTestId('performance-evidence-assurance')).toHaveCount(0);
      return;
    }
    await expect(evidenceTab).toBeEnabled();
    await evidenceTab.click();
    await expect(evidenceTab).toHaveAttribute('aria-current', 'page');
    const assurance = page.getByTestId('performance-evidence-assurance');
    await expect(assurance).toBeVisible({ timeout: 15000 });
    await expect(assurance).toHaveAttribute(
      'data-assurance-state',
      /^(ready|attention|incomplete|unavailable)$/,
    );
    await expect(page.getByRole('heading', { name: /^Calculation assurance$/i })).toBeVisible();
    await expect(assurance.getByRole('heading', { name: /^Control exceptions$/i })).toBeVisible();
    await expect(assurance.getByRole('heading', { name: /^Calculation coverage$/i })).toBeVisible();

    const supportDetails = assurance.locator('details').filter({
      hasText: 'Technical support details',
    });
    const supportSummary = supportDetails.locator('summary');
    await expect(supportDetails).not.toHaveAttribute('open', '');
    await expect(assurance.getByText('lotus-performance', { exact: true })).not.toBeVisible();

    await supportSummary.focus();
    await page.keyboard.press('Enter');
    await expect(supportDetails).toHaveAttribute('open', '');
    await expect(supportSummary).toBeFocused();
    await expect(assurance.getByText('lotus-performance', { exact: true })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(supportDetails).not.toHaveAttribute('open', '');
    await expect(supportSummary).toBeFocused();

    for (const viewport of [
      { width: 1024, height: 1100 },
      { width: 720, height: 1100 },
      { width: 390, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(assurance).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
      await testInfo.attach(`calculation-assurance-${viewport.width}px`, {
        body: await page.screenshot({ animations: 'disabled', fullPage: true }),
        contentType: 'image/png',
      });
    }
  });

  test('unfamiliar source-confirmed period fails closed before analytical detail', async ({ page, request }) => {
    test.skip(
      process.env.PERFORMANCE_E2E_FIXTURE !== 'unknown-period',
      'Unknown-period proof requires the owned malformed-period fixture.',
    );
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1280, height: 900 });
    const portfolioId = await resolveSmokePortfolioId(request);
    expect(portfolioId).toBeTruthy();
    await page.goto(buildPerformanceSmokePagePath(portfolioId!), {
      waitUntil: 'domcontentloaded',
    });

    await expect(
      page.getByRole('heading', { name: 'Review context needs attention', exact: true })
    ).toBeVisible({ timeout: 30000 });
    await expect(
      page.getByText(
        'The selected portfolio or performance period is not confirmed by the source response. No analytical detail was requested.',
        { exact: true }
      )
    ).toBeVisible();
    await expect(page.getByLabel('Performance surface navigation')).toHaveCount(0);
    await expect(page.getByTestId('performance-evidence-assurance')).toHaveCount(0);
    expect(fixtureGateway?.requests.summary).toBeGreaterThan(0);
    expect(fixtureGateway?.requests.details).toBe(0);
  });
});

function readPrimaryRiskRequestCounts() {
  const requests = fixtureGateway?.requests;
  return {
    summary: requests?.riskSummary ?? 0,
    concentration: requests?.riskConcentration ?? 0,
    drawdown: requests?.riskDrawdown ?? 0,
    rolling: requests?.riskRolling ?? 0,
    attribution: requests?.riskAttribution ?? 0,
  };
}

function incrementRiskRequestCounts(
  counts: ReturnType<typeof readPrimaryRiskRequestCounts>,
) {
  return Object.fromEntries(
    Object.entries(counts).map(([name, count]) => [name, count + 1]),
  );
}
