import { createServer, type IncomingMessage, type Server } from 'node:http';

import type {
  PerformanceComparativeSummary,
  WorkbenchPerformanceWorkspace,
  WorkbenchPerformanceAdvisorBrief,
  WorkbenchPerformanceHorizonComparison,
  WorkbenchPerformanceWorkspaceDetails,
  WorkbenchPerformanceWorkspaceSummary,
} from '../../src/features/workbench/types';
import {
  buildPerformanceAttributionTrend,
  buildPerformanceHorizonComparison,
  buildPerformanceWorkspaceDetails,
  buildPerformanceWorkspaceSummary,
} from '../fixtures/performance-workspace-fixtures';
import { fallbackNormalizedCapabilities } from '../../src/features/platform-capabilities/api';
import {
  buildFixtureRiskAttribution,
  buildFixtureRiskConcentration,
  buildFixtureRiskDrawdown,
  buildFixtureRiskRolling,
  buildFixtureRiskSummary,
} from '../../src/apps/performance/risk-workspace-view-model';
import {
  GOVERNED_REVIEW_PORTFOLIO_ID,
  handleGovernedReviewPortfolioRequest,
} from './governed-review-context-fixture';
import {
  buildConcentrationMandateComparisonFixture,
  buildSummaryMandateComparisonFixture,
} from '../fixtures/risk-mandate-comparison-fixtures';

export type PerformanceFixtureGatewayScenario =
  | 'populated'
  | 'unavailable'
  | 'refresh-integrity'
  | 'trend-integrity'
  | 'horizon-integrity'
  | 'analysis-controls'
  | 'unknown-period';

export type PerformanceFixtureGateway = {
  close: () => Promise<void>;
  setRiskAttributionPosture: (
    posture: "ready" | "partial-mixed",
  ) => void;
  port: number;
  requests: {
    summary: number;
    details: number;
    riskSummary: number;
    riskConcentration: number;
    riskDrawdown: number;
    riskRolling: number;
    riskAttribution: number;
  };
};

export async function startPerformanceFixtureGateway({
  port,
  scenario,
}: {
  port: number;
  scenario: PerformanceFixtureGatewayScenario;
}): Promise<PerformanceFixtureGateway> {
  let summaryRefreshFailuresRemaining = scenario === 'refresh-integrity' ? 1 : 0;
  let detailsRefreshFailuresRemaining = scenario === 'refresh-integrity' ? 1 : 0;
  let trendRefreshFailuresRemaining = scenario === 'trend-integrity' ? 1 : 0;
  let horizonRefreshFailuresRemaining = scenario === 'horizon-integrity' ? 1 : 0;
  let riskAttributionPosture: "ready" | "partial-mixed" = "ready";
  const requests = {
    summary: 0,
    details: 0,
    riskSummary: 0,
    riskConcentration: 0,
    riskDrawdown: 0,
    riskRolling: 0,
    riskAttribution: 0,
  };
  const reviewedAdvisorBriefs = new Map<string, WorkbenchPerformanceAdvisorBrief>();
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
    const portfolioId = resolvePortfolioId(requestUrl.pathname);

    if (requestUrl.pathname === '/api/v1/lookups/portfolios') {
      sendJson(response, {
        items: [
          {
            id: 'PB_SG_GLOBAL_BAL_001',
            label: 'Global Balanced Mandate',
          },
          {
            id: GOVERNED_REVIEW_PORTFOLIO_ID,
            label: 'Income Preservation Mandate',
          },
        ],
      });
      return;
    }

    if (requestUrl.pathname === '/api/v1/platform/capabilities') {
      sendJson(response, {
        data: {
          consumerSystem: requestUrl.searchParams.get('consumerSystem') ?? 'UI',
          tenantId: requestUrl.searchParams.get('tenantId') ?? 'default',
          contractVersion: 'v1',
          sources: {},
          partialFailure: false,
          errors: [],
          normalized: fallbackNormalizedCapabilities(),
        },
      });
      return;
    }

    if (handleGovernedReviewPortfolioRequest(requestUrl, response)) {
      return;
    }

    if (!portfolioId) {
      sendJson(response, { code: 'fixture_route_not_found' }, 404);
      return;
    }

    if (requestUrl.pathname.endsWith('/performance/summary')) {
      requests.summary += 1;
      if (requestUrl.searchParams.get('period') === '3Y' && summaryRefreshFailuresRemaining > 0) {
        summaryRefreshFailuresRemaining -= 1;
        sendJson(response, { code: 'performance_summary_temporarily_unavailable' }, 503);
        return;
      }
      const summaryResponse = buildSummaryResponse(portfolioId, scenario, requestUrl);
      const sendSummary = () =>
        sendJson(
          response,
          summaryResponse,
          200,
          'perf-reference;dur=1, perf-benchmark;dur=1, perf-summary;dur=1',
        );
      if (scenario === 'analysis-controls' && isChangedSourceSelection(requestUrl)) {
        setTimeout(sendSummary, 250);
      } else {
        sendSummary();
      }
      return;
    }
    if (requestUrl.pathname.endsWith('/performance/details')) {
      requests.details += 1;
      if (
        requestUrl.searchParams.get('contribution_dimension') === 'sector' &&
        detailsRefreshFailuresRemaining > 0
      ) {
        detailsRefreshFailuresRemaining -= 1;
        sendJson(response, { code: 'performance_details_temporarily_unavailable' }, 502);
        return;
      }
      const detailsResponse = buildDetailsResponse(portfolioId, scenario, requestUrl);
      const sendDetails = () =>
        sendJson(
          response,
          detailsResponse,
          200,
          'perf-reference;dur=1, perf-benchmark;dur=1, perf-summary;dur=1',
        );
      if (scenario === 'analysis-controls' && isChangedSourceSelection(requestUrl)) {
        setTimeout(sendDetails, 250);
      } else {
        sendDetails();
      }
      return;
    }
    if (requestUrl.pathname.endsWith('/performance/horizon-comparison')) {
      if (horizonRefreshFailuresRemaining > 0) {
        horizonRefreshFailuresRemaining -= 1;
        sendJson(response, { code: 'performance_horizon_comparison_temporarily_unavailable' }, 503);
        return;
      }
      const horizon = applyRequestedHorizonContext(
        buildPerformanceHorizonComparison(portfolioId),
        requestUrl,
      );
      if (scenario === 'horizon-integrity') {
        setTimeout(() => {
          sendJson(
            response,
            horizon,
            200,
            'perf-reference;dur=1, perf-benchmark;dur=1, perf-horizon;dur=1',
          );
        }, 250);
        return;
      }
      sendJson(
        response,
        scenario !== 'unavailable'
          ? horizon
          : {
              ...horizon,
              benchmark_code: null,
              benchmark_options: [],
              rows: [],
            },
        200,
        'perf-reference;dur=1, perf-benchmark;dur=1, perf-horizon;dur=1',
      );
      return;
    }
    if (requestUrl.pathname.endsWith('/performance/attribution-trend')) {
      if (trendRefreshFailuresRemaining > 0) {
        trendRefreshFailuresRemaining -= 1;
        sendJson(response, { code: 'performance_attribution_trend_temporarily_unavailable' }, 503);
        return;
      }
      if (scenario === 'trend-integrity') {
        setTimeout(() => {
          sendJson(
            response,
            applyRequestedPerformanceReviewContext(
              buildPerformanceAttributionTrend(portfolioId),
              requestUrl,
            ),
            200,
            'perf-reference;dur=1, perf-benchmark;dur=1, perf-attribution;dur=1',
          );
        }, 250);
        return;
      }
      sendJson(
        response,
        applyRequestedPerformanceReviewContext(
          scenario === 'unavailable'
            ? {
                ...buildPerformanceAttributionTrend(portfolioId),
                benchmark_code: null,
              }
            : buildPerformanceAttributionTrend(portfolioId),
          requestUrl,
        ),
        200,
        'perf-reference;dur=1, perf-benchmark;dur=1, perf-attribution;dur=1',
      );
      return;
    }
    if (requestUrl.pathname.endsWith('/performance/advisor-brief')) {
      sendJson(
        response,
        applyRequestedPerformanceReviewContext(
          reviewedAdvisorBriefs.get(portfolioId) ??
            (scenario === 'unavailable'
              ? {
                  ...buildAdvisorBriefResponse(portfolioId),
                  benchmark_code: null,
                }
              : buildAdvisorBriefResponse(portfolioId)),
          requestUrl,
        ),
      );
      return;
    }
    if (requestUrl.pathname.endsWith('/risk/summary')) {
      requests.riskSummary += 1;
      const workspace = buildRiskFixtureWorkspace(portfolioId);
      sendJson(response, {
        ...buildFixtureRiskSummary(
          workspace,
          requestUrl.searchParams.get('period') ?? 'YTD',
          requestUrl.searchParams.get('detail_basis') ?? 'NET',
        ),
        mandate_comparison: buildSummaryMandateComparisonFixture(),
      });
      return;
    }
    if (requestUrl.pathname.endsWith('/risk/concentration')) {
      requests.riskConcentration += 1;
      const workspace = buildRiskFixtureWorkspace(portfolioId);
      sendJson(response, {
        ...buildFixtureRiskConcentration(
          workspace,
          requestUrl.searchParams.get('period') ?? 'YTD',
        ),
        mandate_comparison: buildConcentrationMandateComparisonFixture(),
      });
      return;
    }
    if (requestUrl.pathname.endsWith('/risk/drawdown')) {
      requests.riskDrawdown += 1;
      const workspace = buildRiskFixtureWorkspace(portfolioId);
      sendJson(
        response,
        buildFixtureRiskDrawdown(
          workspace,
          requestUrl.searchParams.get('period') ?? 'YTD',
          requestUrl.searchParams.get('detail_basis') ?? 'NET',
          {
            includeUnderwaterSeries:
              requestUrl.searchParams.get('include_underwater_series') === 'true',
          },
        ),
      );
      return;
    }
    if (requestUrl.pathname.endsWith('/risk/rolling')) {
      requests.riskRolling += 1;
      const workspace = buildRiskFixtureWorkspace(portfolioId);
      sendJson(
        response,
        buildFixtureRiskRolling(
          workspace,
          requestUrl.searchParams.get('period') ?? 'YTD',
          requestUrl.searchParams.get('detail_basis') ?? 'NET',
          {
            includeTimeSeries:
              requestUrl.searchParams.get('include_time_series') === 'true',
          },
        ),
      );
      return;
    }
    if (requestUrl.pathname.endsWith('/risk/attribution')) {
      requests.riskAttribution += 1;
      const workspace = buildRiskFixtureWorkspace(portfolioId);
      const attribution = buildFixtureRiskAttribution(
        workspace,
        requestUrl.searchParams.get('period') ?? 'YTD',
        requestUrl.searchParams.get('detail_basis') ?? 'NET',
        {
          attributionType:
            requestUrl.searchParams.get('attribution_type') === 'ACTIVE_RISK'
              ? 'ACTIVE_RISK'
              : 'TOTAL_RISK',
          groupingDimension: resolveRiskGroupingDimension(
            requestUrl.searchParams.get('grouping_dimension'),
          ),
        },
      );
      sendJson(
        response,
        riskAttributionPosture === 'partial-mixed'
          ? {
              ...attribution,
              state: 'partial',
              warnings: [
                'One review period has insufficient observations; available contributor values remain qualified.',
              ],
              partial_failures: [
                {
                  source_service: 'lotus-risk',
                  error_code: 'insufficient_observations',
                  detail: 'One review period has insufficient observations.',
                },
              ],
            }
          : attribution,
      );
      return;
    }
    if (
      request.method === 'POST' &&
      requestUrl.pathname.endsWith('/performance/advisor-brief/review-actions')
    ) {
      void readJsonBody(request).then((body) => {
        const reviewedBy = typeof body.reviewed_by === 'string' ? body.reviewed_by : '';
        const actionType = body.action_type;
        if (!reviewedBy || actionType !== 'ACCEPT') {
          sendJson(response, { code: 'invalid_fixture_review_action' }, 422);
          return;
        }
        const reviewedBrief = applyRequestedPerformanceReviewContext(
          buildReviewedAdvisorBriefResponse(portfolioId, reviewedBy),
          requestUrl,
        );
        reviewedAdvisorBriefs.set(portfolioId, reviewedBrief);
        sendJson(response, reviewedBrief);
      });
      return;
    }

    sendJson(response, { code: 'fixture_route_not_found' }, 404);
  });

  await listen(server, port);
  return {
    port,
    requests,
    setRiskAttributionPosture: (posture) => {
      riskAttributionPosture = posture;
    },
    close: () => close(server),
  };
}
function buildRiskFixtureWorkspace(portfolioId: string): WorkbenchPerformanceWorkspace {
  const summary = buildPerformanceWorkspaceSummary(portfolioId);
  return {
    ...summary,
    contribution_dimension: 'asset_class',
    attribution_dimension: 'asset_class',
    net_chart: [],
    gross_chart: [],
    contribution: null,
    attribution: null,
  };
}

function resolveRiskGroupingDimension(
  value: string | null,
): 'POSITION' | 'SECTOR' | 'ASSET_CLASS' | 'ISSUER' {
  if (value === 'POSITION' || value === 'ASSET_CLASS' || value === 'ISSUER') {
    return value;
  }
  return 'SECTOR';
}

function buildReviewedAdvisorBriefResponse(
  portfolioId: string,
  reviewedBy: string,
): WorkbenchPerformanceAdvisorBrief {
  const brief = buildAdvisorBriefResponse(portfolioId);
  return {
    ...brief,
    correlation_id: 'corr-advisor-brief-review-e2e',
    workflow_pack_run: {
      ...brief.workflow_pack_run!,
      review_state: 'ACCEPTED',
      latest_review_event_at: '2026-04-21T03:22:00Z',
      latest_review_actor: reviewedBy,
      review_transition_count: 1,
      has_review_history: true,
      allowed_review_actions: [],
      supportability_status: 'READY',
      review_pending: false,
      current_summary_note: 'Review decision recorded for permitted internal workflow use.',
      findings: [],
    },
    workflow_pack_task_flow: {
      ...brief.workflow_pack_task_flow!,
      flow_status: 'COMPLETED',
      current_step_id: null,
      review_states: {
        packrun_advisor_brief_e2e: 'ACCEPTED',
      },
      supportability_status: 'READY',
      handoff_refs: [
        {
          handoff_id: 'taskflow_advisor_brief_e2e_handoff_packrun_advisor_brief_e2e',
          owner_service: 'lotus-gateway',
          status: 'READY_FOR_HANDOFF',
          domain_ref: null,
        },
      ],
      updated_at: '2026-04-21T03:22:00Z',
    },
  };
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

function buildAdvisorBriefResponse(portfolioId: string): WorkbenchPerformanceAdvisorBrief {
  return {
    correlation_id: 'corr-advisor-brief-e2e',
    contract_version: 'v1',
    portfolio_id: portfolioId,
    portfolio: {
      portfolio_id: portfolioId,
      client_id: 'CIF_1001',
      base_currency: 'USD',
      booking_center_code: 'SG',
    },
    as_of_date: '2026-02-24',
    requested_as_of_date: null,
    effective_as_of_date: '2026-02-24',
    requested_reporting_currency: null,
    effective_reporting_currency: 'USD',
    reporting_currency_state: 'accepted_unverified',
    period: 'YTD',
    report_start_date: '2026-01-01',
    report_end_date: '2026-02-24',
    detail_basis: 'NET',
    chart_frequency: 'monthly',
    contribution_dimension: 'asset_class',
    attribution_dimension: 'asset_class',
    benchmark_code: 'BMK_GLOBAL_BALANCED_60_40',
    status: 'ready',
    summary: 'Source-grounded performance narrative is ready for advisor review.',
    talking_points: [
      {
        headline: 'Portfolio outperformed its benchmark over the selected period.',
        detail: 'Active return was positive on a net basis.',
        tone: 'positive',
        evidence_refs: [
          {
            metric_label: 'Active Return',
            metric_value: '0.51%',
            source_surface: 'performance.return_path',
            target_mode: 'summary',
            route: `/performance?portfolioId=${portfolioId}`,
          },
        ],
      },
    ],
    recommended_actions: [],
    risks_and_exceptions: [],
    source_metrics: [
      {
        label: 'Active Return',
        value: '0.51%',
        support_label: 'YTD Net',
        target_mode: 'summary',
        route: `/performance?portfolioId=${portfolioId}`,
        state: 'ready',
      },
    ],
    supportability: [{ label: 'Advisor Brief', value: 'Ready', tone: 'success' }],
    workflow_pack_run: {
      run_id: 'packrun_advisor_brief_e2e',
      runtime_state: 'COMPLETED',
      review_state: 'AWAITING_REVIEW',
      allowed_review_actions: ['ACCEPT', 'REJECT'],
      supportability_status: 'ACTION_REQUIRED',
      review_pending: true,
      superseded: false,
      workflow_authority_owner: 'lotus-gateway',
      current_summary_note: 'Human review is required before downstream use.',
      replacement_run_id: null,
      findings: [],
    },
    workflow_pack_task_flow: {
      task_flow_id: 'taskflow_advisor_brief_e2e',
      workflow_pack_id: 'advisor_brief.pack',
      version: 'v1',
      flow_status: 'WAITING_FOR_REVIEW',
      current_step_id: 'generate_advisor_brief',
      run_refs: ['packrun_advisor_brief_e2e'],
      review_states: {
        packrun_advisor_brief_e2e: 'AWAITING_REVIEW',
      },
      supportability_status: 'ACTION_REQUIRED',
      replacement_lineage: [],
      handoff_refs: [],
      updated_at: '2026-04-21T03:00:00Z',
    },
    ai_audit: {
      task_id: 'explain.v1',
      provider_mode: 'local_openai_compatible',
      provider_id: 'text.local',
      model_id: 'qwen3:8b',
      generated_at: '2026-02-24T00:00:00Z',
      stubbed: false,
    },
    ai_evidence: {
      source_refs: [
        `lotus-gateway:workbench:${portfolioId}:performance-summary:YTD`,
        'lotus-ai:task:explain.v1',
      ],
    },
    warnings: [],
    partial_failures: [],
  };
}

function buildSummaryResponse(
  portfolioId: string,
  scenario: PerformanceFixtureGatewayScenario,
  requestUrl: URL,
): WorkbenchPerformanceWorkspaceSummary {
  const summary = buildPerformanceWorkspaceSummary(
    portfolioId,
    scenario === 'unavailable'
      ? { unassignedBenchmark: true, unavailableSummarySeries: true }
      : undefined,
  );
  if (scenario !== 'unavailable') {
    const response = applyRequestedSummaryContext(
      {
        ...summary,
        benchmark_options: buildFixtureBenchmarkOptions(summary.benchmark_options),
        capabilities: buildPopulatedCapabilities(summary.capabilities),
        evidence_view: summary.evidence_view
          ? { ...summary.evidence_view, state: 'supported', reason: null }
          : null,
      },
      requestUrl,
    );
    return scenario === 'unknown-period' ? publishUnknownPeriod(response) : response;
  }
  return applyRequestedSummaryContext(
    {
      ...summary,
      capabilities: buildUnavailableCapabilities(summary.capabilities),
      money_weighted_return: null,
      net_performance: clearPerformanceEconomics(summary.net_performance),
      gross_performance: clearPerformanceEconomics(summary.gross_performance),
    },
    requestUrl,
  );
}

function buildDetailsResponse(
  portfolioId: string,
  scenario: PerformanceFixtureGatewayScenario,
  requestUrl: URL,
): WorkbenchPerformanceWorkspaceDetails {
  const details = buildPerformanceWorkspaceDetails(
    portfolioId,
    scenario === 'unavailable'
      ? { unassignedBenchmark: true, unavailableSummarySeries: true }
      : undefined,
  );
  if (scenario !== 'unavailable') {
    const response = applyRequestedDetailContext(
      {
        ...details,
        capabilities: buildPopulatedCapabilities(details.capabilities),
        evidence_view: details.evidence_view
          ? { ...details.evidence_view, state: 'supported', reason: null }
          : null,
      },
      requestUrl,
    );
    return scenario === 'unknown-period' ? publishUnknownPeriod(response) : response;
  }
  return applyRequestedDetailContext(
    {
      ...details,
      capabilities: buildUnavailableCapabilities(details.capabilities),
      net_chart: [],
      gross_chart: [],
      contribution: null,
    },
    requestUrl,
  );
}

function publishUnknownPeriod<
  T extends WorkbenchPerformanceWorkspaceSummary | WorkbenchPerformanceWorkspaceDetails,
>(workspace: T): T {
  return {
    ...workspace,
    period: 'FUTURE',
    evidence_view: workspace.evidence_view
      ? { ...workspace.evidence_view, period: 'FUTURE' }
      : null,
  };
}

function applyRequestedSummaryContext(
  summary: WorkbenchPerformanceWorkspaceSummary,
  requestUrl: URL,
): WorkbenchPerformanceWorkspaceSummary {
  const period = requestUrl.searchParams.get('period') ?? summary.period;
  const benchmarkCode = requestUrl.searchParams.get('benchmark_code') ?? summary.benchmark_code;
  return applyRequestedPerformanceReviewContext(
    {
      ...summary,
      period,
      benchmark_code: benchmarkCode,
      report_start_date: period === '3Y' ? '2023-03-28' : summary.report_start_date,
    },
    requestUrl,
  );
}

function applyRequestedDetailContext(
  details: WorkbenchPerformanceWorkspaceDetails,
  requestUrl: URL,
): WorkbenchPerformanceWorkspaceDetails {
  const period = requestUrl.searchParams.get('period') ?? details.period;
  const contributionDimension =
    requestUrl.searchParams.get('contribution_dimension') ?? details.contribution_dimension;
  const attributionDimension =
    requestUrl.searchParams.get('attribution_dimension') ?? details.attribution_dimension;
  const benchmarkCode = requestUrl.searchParams.get('benchmark_code') ?? details.benchmark_code;
  return applyRequestedPerformanceReviewContext(
    {
      ...details,
      period,
      benchmark_code: benchmarkCode,
      report_start_date: period === '3Y' ? '2023-03-28' : details.report_start_date,
      contribution_dimension: contributionDimension,
      attribution_dimension: attributionDimension,
      segment: contributionDimension,
    },
    requestUrl,
  );
}

function applyRequestedPerformanceReviewContext<
  Response extends {
    as_of_date: string;
    period?: string;
    report_start_date?: string | null;
    report_end_date?: string | null;
    detail_basis?: string;
    contribution_dimension?: string;
    attribution_dimension?: string;
    chart_frequency?: string;
    benchmark_code?: string | null;
    portfolio?: { base_currency?: string };
  },
>(response: Response, requestUrl: URL) {
  const requestedAsOfDate = requestUrl.searchParams.get('as_of_date');
  const requestedPeriod = requestUrl.searchParams.get('period') ?? response.period;
  const requestedReportStartDate = requestUrl.searchParams.get('report_start_date');
  const requestedReportEndDate = requestUrl.searchParams.get('report_end_date');
  const requestedReportingCurrency = requestUrl.searchParams.get('reporting_currency');
  const effectiveAsOfDate = requestedAsOfDate ?? response.as_of_date;
  return {
    ...response,
    period: requestedPeriod,
    report_start_date: requestedReportStartDate ?? response.report_start_date,
    report_end_date:
      requestedReportEndDate ??
      (requestedAsOfDate && requestedPeriod !== 'EXPLICIT'
        ? effectiveAsOfDate
        : response.report_end_date),
    detail_basis:
      requestUrl.searchParams.get('detail_basis') ?? response.detail_basis,
    contribution_dimension:
      requestUrl.searchParams.get('contribution_dimension') ??
      response.contribution_dimension,
    attribution_dimension:
      requestUrl.searchParams.get('attribution_dimension') ??
      response.attribution_dimension,
    chart_frequency:
      requestUrl.searchParams.get('chart_frequency') ?? response.chart_frequency,
    benchmark_code:
      requestUrl.searchParams.get('benchmark_code') ?? response.benchmark_code,
    as_of_date: effectiveAsOfDate,
    requested_as_of_date: requestedAsOfDate,
    effective_as_of_date: effectiveAsOfDate,
    requested_reporting_currency: requestedReportingCurrency,
    effective_reporting_currency:
      requestedReportingCurrency ?? response.portfolio?.base_currency ?? 'USD',
    reporting_currency_state: 'accepted_unverified' as const,
  };
}

function applyRequestedHorizonContext(
  response: WorkbenchPerformanceHorizonComparison,
  requestUrl: URL,
): WorkbenchPerformanceHorizonComparison {
  const contextualResponse = applyRequestedPerformanceReviewContext(response, requestUrl);
  return {
    ...contextualResponse,
    reporting_currency:
      requestUrl.searchParams.get('reporting_currency') ??
      response.reporting_currency,
    rows: response.rows.map((row) => ({
      ...row,
      period_end: contextualResponse.report_end_date,
    })),
  };
}

function buildFixtureBenchmarkOptions(
  options: WorkbenchPerformanceWorkspaceSummary['benchmark_options'],
) {
  return [
    ...(options ?? []),
    {
      benchmark_code: 'BMK_PRIVATE_BANK',
      benchmark_name: 'Private Bank Composite',
      benchmark_currency: 'USD',
      benchmark_type: 'composite',
      benchmark_family: 'private_bank_reference',
      benchmark_provider: 'LOTUS_DEMO',
      is_assigned: false,
    },
  ];
}

function isChangedSourceSelection(requestUrl: URL) {
  return (
    requestUrl.searchParams.get('period') === '3Y' ||
    requestUrl.searchParams.get('benchmark_code') === 'BMK_PRIVATE_BANK'
  );
}

function buildPopulatedCapabilities(
  capabilities: WorkbenchPerformanceWorkspaceSummary['capabilities'],
): NonNullable<WorkbenchPerformanceWorkspaceSummary['capabilities']> {
  if (!capabilities) {
    throw new Error('Performance fixture requires explicit module capabilities.');
  }
  return {
    ...capabilities,
    evidence: {
      state: 'supported',
      reason: 'Calculation and lineage evidence is available for the populated fixture.',
    },
  };
}

function buildUnavailableCapabilities(
  capabilities: WorkbenchPerformanceWorkspaceSummary['capabilities'],
): NonNullable<WorkbenchPerformanceWorkspaceSummary['capabilities']> {
  if (!capabilities) {
    throw new Error('Performance fixture requires explicit module capabilities.');
  }
  return {
    ...capabilities,
    return_path: {
      state: 'unavailable',
      reason: 'Published return observations are unavailable for the governed fixture window.',
    },
    benchmark_comparison: {
      state: 'unavailable',
      reason: 'No benchmark is assigned to the governed fixture mandate.',
    },
    multi_horizon_returns: {
      state: 'unavailable',
      reason: 'Horizon returns are unavailable for the governed fixture mandate.',
    },
    contribution_ranking: {
      state: 'unavailable',
      reason: 'Contribution ranking is unavailable for the governed fixture mandate.',
    },
  };
}

function clearPerformanceEconomics(
  performance: PerformanceComparativeSummary,
): PerformanceComparativeSummary {
  return {
    ...performance,
    begin_market_value: null,
    end_market_value: null,
    beginning_cash_flow: null,
    ending_cash_flow: null,
    flow_adjusted_end_market_value: null,
    net_cash_flow: null,
  };
}

function resolvePortfolioId(pathname: string): string | null {
  const match = pathname.match(
    /^\/api\/v1\/workbench\/([^/]+)\/(?:performance|risk)\//,
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function sendJson(
  response: import('node:http').ServerResponse,
  body: unknown,
  status = 200,
  serverTiming?: string,
): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json');
  response.setHeader('cache-control', 'no-store');
  if (serverTiming) {
    response.setHeader('server-timing', serverTiming);
  }
  response.end(JSON.stringify(body));
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
