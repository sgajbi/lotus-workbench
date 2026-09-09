import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  admitPerformanceQueryData,
  fetchPerformanceWorkspaceRevalidation,
  performanceWorkspaceDetailsQueryOptions,
  performanceWorkspaceSummaryQueryOptions,
} from "../../src/apps/performance/performance-workspace-query-options";
import { performanceWorkspaceQueryKeys } from "../../src/apps/performance/performance-workspace-query-keys";
import { WORKBENCH_QUERY_STALE_TIME_MS } from "../../src/features/platform-runtime/query-policy";
import {
  buildPerformanceWorkspaceDetails,
  buildPerformanceWorkspaceSummary,
} from "../fixtures/performance-workspace-fixtures";

const getSummaryClientMock = vi.fn();
const getDetailsClientMock = vi.fn();

vi.mock("../../src/features/workbench/api", () => ({
  getWorkbenchPerformanceWorkspaceSummaryClient: (...args: unknown[]) =>
    getSummaryClientMock(...args),
  getWorkbenchPerformanceWorkspaceDetailsClient: (...args: unknown[]) =>
    getDetailsClientMock(...args),
}));

const context = {
  portfolioId: "PF_1001",
  period: "YTD",
  detailBasis: "NET",
  contributionDimension: "asset_class",
  attributionDimension: "asset_class",
  chartFrequency: "monthly",
  benchmark: "BMK_GLOBAL_BALANCED_60_40",
  reviewAsOfDate: "2026-02-24",
  reviewReportingCurrency: "USD",
};

describe("performance workspace query ownership", () => {
  afterEach(() => {
    vi.useRealTimers();
    getSummaryClientMock.mockReset();
    getDetailsClientMock.mockReset();
  });

  it("keys every request variable and removes irrelevant dates outside an explicit window", () => {
    const base = performanceWorkspaceQueryKeys.summaryResponse({
      ...context,
      reportStartDate: "2026-01-01",
      reportEndDate: "2026-02-24",
    });
    const differentContribution = performanceWorkspaceQueryKeys.summaryResponse({
      ...context,
      contributionDimension: "sector",
    });

    expect(base).toEqual(performanceWorkspaceQueryKeys.summaryResponse(context));
    expect(differentContribution).not.toEqual(base);
    expect(
      performanceWorkspaceQueryKeys.summaryResponse({
        ...context,
        period: "EXPLICIT",
        reportStartDate: "2026-01-01",
        reportEndDate: "2026-02-24",
      }),
    ).not.toEqual(base);
  });

  it("reuses a fresh admitted summary and does not dispatch duplicate owner work", async () => {
    const summary = {
      ...buildPerformanceWorkspaceSummary(),
      requested_as_of_date: "2026-02-24",
      requested_reporting_currency: "USD",
      effective_reporting_currency: "USD",
      reporting_currency_state: "applied" as const,
    };
    getSummaryClientMock.mockResolvedValue(summary);
    const queryClient = new QueryClient();
    const options = performanceWorkspaceSummaryQueryOptions(context);

    await expect(queryClient.fetchQuery(options)).resolves.toBe(summary);
    await expect(queryClient.fetchQuery(options)).resolves.toBe(summary);

    expect(getSummaryClientMock).toHaveBeenCalledTimes(1);
    expect(getSummaryClientMock.mock.calls[0]?.[2]).toBeInstanceOf(AbortSignal);
  });

  it("revalidates an admitted summary after the governed stale window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T10:00:00Z"));
    const summary = {
      ...buildPerformanceWorkspaceSummary(),
      requested_as_of_date: "2026-02-24",
      requested_reporting_currency: "USD",
      effective_reporting_currency: "USD",
      reporting_currency_state: "applied" as const,
    };
    getSummaryClientMock.mockResolvedValue(summary);
    const queryClient = new QueryClient();
    const options = performanceWorkspaceSummaryQueryOptions(context);

    await queryClient.fetchQuery(options);
    vi.setSystemTime(
      new Date(Date.now() + WORKBENCH_QUERY_STALE_TIME_MS + 1),
    );
    await queryClient.fetchQuery(options);

    expect(getSummaryClientMock).toHaveBeenCalledTimes(2);
  });

  it("reuses a fresh composite until an explicit source recheck invalidates it", async () => {
    const summary = {
      ...buildPerformanceWorkspaceSummary(),
      requested_as_of_date: "2026-02-24",
      requested_reporting_currency: "USD",
      effective_reporting_currency: "USD",
      reporting_currency_state: "applied" as const,
    };
    const details = {
      ...buildPerformanceWorkspaceDetails(),
      requested_as_of_date: "2026-02-24",
      requested_reporting_currency: "USD",
      effective_reporting_currency: "USD",
      reporting_currency_state: "applied" as const,
    };
    getSummaryClientMock.mockResolvedValue(summary);
    getDetailsClientMock.mockResolvedValue(details);
    const queryClient = new QueryClient();

    await fetchPerformanceWorkspaceRevalidation(queryClient, context);
    await fetchPerformanceWorkspaceRevalidation(queryClient, context);
    expect(getSummaryClientMock).toHaveBeenCalledTimes(1);
    expect(getDetailsClientMock).toHaveBeenCalledTimes(1);

    await fetchPerformanceWorkspaceRevalidation(queryClient, context, {
      forceSourceRead: true,
    });
    expect(getSummaryClientMock).toHaveBeenCalledTimes(2);
    expect(getDetailsClientMock).toHaveBeenCalledTimes(2);
  });

  it("advances an explicit recheck receipt when structural sharing retains the payload", () => {
    const queryClient = new QueryClient();
    const summary = buildPerformanceWorkspaceSummary();
    const queryKey = performanceWorkspaceSummaryQueryOptions(context).queryKey;
    const firstReceipt = Date.parse("2026-09-09T10:00:00Z");
    const secondReceipt = Date.parse("2026-09-09T10:05:00Z");
    queryClient.setQueryData(queryKey, summary, { updatedAt: firstReceipt });

    admitPerformanceQueryData(
      queryClient,
      queryKey,
      summary,
      secondReceipt,
      { advanceReceipt: true },
    );

    expect(queryClient.getQueryData(queryKey)).toBe(summary);
    expect(queryClient.getQueryState(queryKey)?.dataUpdatedAt).toBe(secondReceipt);
  });

  it("refuses mismatched summary evidence before it becomes reusable cache data", async () => {
    getSummaryClientMock.mockResolvedValue(
      { ...buildPerformanceWorkspaceSummary(), portfolio_id: "PF_OTHER" },
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const options = performanceWorkspaceSummaryQueryOptions(context);

    await expect(queryClient.fetchQuery(options)).rejects.toThrow(
      "Performance summary did not confirm the requested source identity.",
    );
    expect(queryClient.getQueryData(options.queryKey)).toBeUndefined();
  });

  it("binds detail reuse to the admitted summary evidence identity", () => {
    const summary = {
      ...buildPerformanceWorkspaceSummary(),
      requested_as_of_date: "2026-02-24",
      requested_reporting_currency: "USD",
      effective_reporting_currency: "USD",
      reporting_currency_state: "applied" as const,
    };
    const first = performanceWorkspaceDetailsQueryOptions(context, summary).queryKey;
    const refreshed = performanceWorkspaceDetailsQueryOptions(context, {
      ...summary,
      correlation_id: "corr-refreshed-summary",
    }).queryKey;

    expect(refreshed).not.toEqual(first);
  });

  it("refuses detail evidence that is incoherent with the admitted summary", async () => {
    const summary = {
      ...buildPerformanceWorkspaceSummary(),
      requested_as_of_date: "2026-02-24",
      requested_reporting_currency: "USD",
      effective_reporting_currency: "USD",
      reporting_currency_state: "applied" as const,
    };
    getDetailsClientMock.mockResolvedValue(
      {
        ...buildPerformanceWorkspaceDetails(),
        requested_as_of_date: "2026-02-24",
        requested_reporting_currency: "EUR",
        effective_reporting_currency: "EUR",
        reporting_currency_state: "applied" as const,
      },
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const options = performanceWorkspaceDetailsQueryOptions(context, summary);

    await expect(queryClient.fetchQuery(options)).rejects.toThrow(
      "Performance analytical detail did not confirm the requested source identity.",
    );
    expect(queryClient.getQueryData(options.queryKey)).toBeUndefined();
  });
});
