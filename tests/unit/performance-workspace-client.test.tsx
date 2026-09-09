import React from "react";
import type { QueryClient } from "@tanstack/react-query";
import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  WorkbenchPerformanceWorkspaceDetails,
  WorkbenchPerformanceWorkspaceSummary,
  WorkbenchPerformanceWorkspace,
} from "../../src/features/workbench/types";
import PerformanceWorkspaceClient, {
  PERFORMANCE_REFRESH_CONFIRMATION_DURATION_MS,
} from "../../src/apps/performance/components/performance-workspace-client";
import type { PerformanceSourceControlFocusTarget } from "../../src/apps/performance/components/performance-workspace-types";
import {
  buildPerformanceWorkspaceDetails,
  buildPerformanceWorkspaceSummary,
} from "../fixtures/performance-workspace-fixtures";
import { renderWithQueryClient } from "../helpers/query-client-test-harness";
import {
  performanceWorkspaceDetailsQueryOptions,
  performanceWorkspaceSummaryQueryOptions,
} from "../../src/apps/performance/performance-workspace-query-options";
import { WORKBENCH_QUERY_STALE_TIME_MS } from "../../src/features/platform-runtime/query-policy";

const replaceMock = vi.fn();
const pushMock = vi.fn();
const getSummaryClientMock = vi.fn();
const getDetailsClientMock = vi.fn();
const restoreFocusMock = vi.fn();
const requestResultMock = vi.fn();
const DEFAULT_PORTFOLIO_RETURN = String(
  buildPerformanceWorkspaceSummary().net_performance.portfolio_return_pct
);

function render(ui: React.ReactElement) {
  return renderWithQueryClient(ui);
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
}));

vi.mock("../../src/features/workbench/api", () => ({
  getWorkbenchPerformanceWorkspaceSummaryClient: (...args: unknown[]) =>
    getSummaryClientMock(...args),
  getWorkbenchPerformanceWorkspaceDetailsClient: (...args: unknown[]) =>
    getDetailsClientMock(...args),
  getWorkbenchApiErrorStatus: (error: unknown) =>
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status: number }).status)
      : null,
  isWorkbenchPermissionBlockedError: (error: unknown) =>
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    [401, 403].includes(Number((error as { status: number }).status)),
}));

vi.mock("../../src/apps/performance/components/performance-source-control-focus", () => ({
  restorePerformanceSourceControlFocus: (...args: unknown[]) => restoreFocusMock(...args),
}));

vi.mock("../../src/apps/performance/components/performance-workspace-view", () => ({
  default: ({
    workspace,
    mode,
    onModeChange,
    period,
    onRequestChange,
    isUpdating,
    isDetailsPending,
    refreshStatus,
    sourceReceipt,
    onRetryRefresh,
    loadIssue,
  }: {
    workspace: WorkbenchPerformanceWorkspace | null;
    mode: string;
    onModeChange?: (mode: "summary" | "analysis" | "advisor" | "risk" | "evidence") => void;
    period: string;
    onRequestChange?: (
      patch: {
        period?: string;
        detailBasis?: string;
        contributionDimension?: string;
        attributionDimension?: string;
        chartFrequency?: string;
        benchmark?: string;
        reportStartDate?: string;
        reportEndDate?: string;
      },
      focusTarget?: PerformanceSourceControlFocusTarget
    ) => Promise<boolean>;
    isUpdating?: boolean;
    isDetailsPending?: boolean;
    refreshStatus?: {
      kind: "pending" | "confirmed" | "failed";
      intent?: "selection" | "recheck";
      scope: "summary" | "details";
      requestedContext: string;
      confirmedContext: string;
      status?: number;
    } | null;
    sourceReceipt?: {
      checkedAt: number | null;
      canRecheck: boolean;
      onRefresh: () => Promise<unknown>;
    };
    onRetryRefresh?: () => void;
    loadIssue?: { state: string; status?: number } | null;
  }) => (
    <div>
      <div data-testid="mode">{mode}</div>
      <div data-testid="period">{period}</div>
      <div data-testid="return">
        {workspace?.net_performance.portfolio_return_pct ?? "none"}
      </div>
      <div data-testid="chart-points">{workspace?.net_chart.length ?? 0}</div>
      <div data-testid="evidence-state">{workspace?.evidence_view?.state ?? "none"}</div>
      <div data-testid="capability-evidence">{workspace?.capabilities?.evidence.state ?? "none"}</div>
      <div data-testid="evidence-artifact">
        {workspace?.evidence_view?.calculations[0]?.artifacts[0]?.artifact_name ?? "none"}
      </div>
      <div data-testid="evidence-stage">
        {workspace?.evidence_view?.calculations[0]?.stage_statuses[0]?.status ?? "none"}
      </div>
      <div data-testid="evidence-upstream">
        {workspace?.evidence_view?.calculations[0]?.upstream_snapshots[0]?.source_identifier ??
          "none"}
      </div>
      <div data-testid="evidence-source-state">
        {workspace?.evidence_view?.source_supportability?.[0]?.state ?? "none"}
      </div>
      <div data-testid="updating">{String(Boolean(isUpdating))}</div>
      <div data-testid="details-pending">{String(Boolean(isDetailsPending))}</div>
      <div data-testid="refresh-kind">{refreshStatus?.kind ?? "none"}</div>
      <div data-testid="refresh-intent">{refreshStatus?.intent ?? "selection"}</div>
      <div data-testid="refresh-scope">{refreshStatus?.scope ?? "none"}</div>
      <div data-testid="refresh-requested">{refreshStatus?.requestedContext ?? "none"}</div>
      <div data-testid="refresh-confirmed">{refreshStatus?.confirmedContext ?? "none"}</div>
      <div data-testid="load-issue">{loadIssue?.state ?? "none"}</div>
      <div data-testid="source-checked-at">{sourceReceipt?.checkedAt ?? "unavailable"}</div>
      <button type="button" onClick={() => onRequestChange?.({ period: "3Y" })}>
        Switch 3Y
      </button>
      <button
        type="button"
        onClick={() => onRequestChange?.({ period: "3Y", chartFrequency: "weekly" })}
      >
        Switch 3Y weekly
      </button>
      <button
        type="button"
        onClick={() =>
          onRequestChange?.(
            { period: "3Y" },
            { kind: "choice", groupLabel: "Horizon", optionLabel: "3Y" }
          )
        }
      >
        Switch 3Y with focus target
      </button>
      <button type="button" onClick={() => onRequestChange?.({ period: "YTD" })}>
        Switch YTD
      </button>
      <button
        type="button"
        onClick={() => {
          const request = onRequestChange?.({ period });
          if (request) {
            void request.then((result) => requestResultMock(result));
          }
        }}
      >
        Repeat confirmed selection
      </button>
      <button
        type="button"
        onClick={() =>
          onRequestChange?.(
            {
              period: "EXPLICIT",
              reportStartDate: "2026-02-01",
              reportEndDate: "2026-03-31",
            },
            { kind: "window" },
          )
        }
      >
        Switch review window
      </button>
      <button
        type="button"
        onClick={() => onRequestChange?.({ contributionDimension: "sector" })}
      >
        Switch Contribution Segment
      </button>
      <button type="button" onClick={() => onModeChange?.("analysis")}>
        Switch Analysis Mode
      </button>
      <button type="button" onClick={() => onModeChange?.("advisor")}>
        Switch Adviser Brief Mode
      </button>
      <button type="button" onClick={() => onModeChange?.("evidence")}>
        Switch Evidence Mode
      </button>
      <button type="button" onClick={() => onModeChange?.("risk")}>
        Switch Risk Mode
      </button>
      <button type="button" onClick={() => onRetryRefresh?.()}>
        Retry Selection
      </button>
      {sourceReceipt?.canRecheck ? (
        <button type="button" onClick={() => void sourceReceipt.onRefresh()}>
          Recheck performance
        </button>
      ) : null}
    </div>
  ),
}));

function buildSummary(
  overrides: Partial<WorkbenchPerformanceWorkspaceSummary> = {}
): WorkbenchPerformanceWorkspaceSummary {
  return {
    ...buildPerformanceWorkspaceSummary(),
    ...overrides,
  };
}

function buildDetails(
  overrides: Partial<WorkbenchPerformanceWorkspaceDetails> = {}
): WorkbenchPerformanceWorkspaceDetails {
  return {
    ...buildPerformanceWorkspaceDetails(),
    ...overrides,
  };
}

const defaultQueryContext = {
  portfolioId: "PF_1001",
  period: "YTD",
  detailBasis: "NET",
  contributionDimension: "asset_class",
  attributionDimension: "asset_class",
  chartFrequency: "monthly",
  benchmark: "BMK_GLOBAL_BALANCED_60_40",
};

function buildDefaultClientProps(
  initialSummary = buildSummary(),
  initialDetails = buildDetails(),
): React.ComponentProps<typeof PerformanceWorkspaceClient> {
  return {
    initialSummary,
    initialDetails,
    initialPortfolioId: defaultQueryContext.portfolioId,
    initialPeriod: defaultQueryContext.period,
    initialDetailBasis: defaultQueryContext.detailBasis,
    initialContributionDimension: defaultQueryContext.contributionDimension,
    initialAttributionDimension: defaultQueryContext.attributionDimension,
    initialChartFrequency: defaultQueryContext.chartFrequency,
    initialBenchmark: defaultQueryContext.benchmark,
  };
}

function ageRetainedPerformanceComposite(
  queryClient: QueryClient,
  summary: WorkbenchPerformanceWorkspaceSummary,
  details: WorkbenchPerformanceWorkspaceDetails,
) {
  const staleUpdatedAt = Date.now() - WORKBENCH_QUERY_STALE_TIME_MS - 1;
  queryClient.setQueryData(
    performanceWorkspaceSummaryQueryOptions(defaultQueryContext).queryKey,
    summary,
    { updatedAt: staleUpdatedAt },
  );
  queryClient.setQueryData(
    performanceWorkspaceDetailsQueryOptions(defaultQueryContext, summary).queryKey,
    details,
    { updatedAt: staleUpdatedAt },
  );
}

describe("PerformanceWorkspaceClient", () => {
  afterEach(() => {
    vi.useRealTimers();
    replaceMock.mockReset();
    pushMock.mockReset();
    getSummaryClientMock.mockReset();
    getDetailsClientMock.mockReset();
    restoreFocusMock.mockReset();
    requestResultMock.mockReset();
  });

  it("shows the oldest admitted receipt in Evidence and rechecks the exact composite", async () => {
    const initialSummary = buildSummary();
    const initialDetails = buildDetails();
    getSummaryClientMock.mockResolvedValueOnce(initialSummary);
    getDetailsClientMock.mockResolvedValueOnce(initialDetails);

    render(
      <PerformanceWorkspaceClient
        {...buildDefaultClientProps(initialSummary, initialDetails)}
        initialMode="evidence"
      />,
    );

    const initialCheckedAt = Number(screen.getByTestId("source-checked-at").textContent);
    expect(initialCheckedAt).toBeGreaterThan(0);
    expect(getSummaryClientMock).not.toHaveBeenCalled();
    expect(getDetailsClientMock).not.toHaveBeenCalled();

    screen.getByRole("button", { name: "Recheck performance" }).click();

    await waitFor(() => {
      expect(getSummaryClientMock).toHaveBeenCalledTimes(1);
      expect(getDetailsClientMock).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("confirmed");
      expect(screen.getByTestId("refresh-intent")).toHaveTextContent("recheck");
    });
    expect(Number(screen.getByTestId("source-checked-at").textContent)).toBeGreaterThanOrEqual(
      initialCheckedAt,
    );
  });

  it("does not present a summary-detail receipt as the age of independently owned Risk evidence", () => {
    const initialSummary = buildSummary();
    const initialDetails = buildDetails();

    render(
      <PerformanceWorkspaceClient
        {...buildDefaultClientProps(initialSummary, initialDetails)}
        initialMode="risk"
      />,
    );

    expect(screen.getByTestId("source-checked-at")).toHaveTextContent("unavailable");
    expect(getSummaryClientMock).not.toHaveBeenCalled();
    expect(getDetailsClientMock).not.toHaveBeenCalled();
  });

  it.each(["summary", "analysis"] as const)(
    "does not present a summary-detail receipt as whole-page %s evidence",
    (initialMode) => {
      render(
        <PerformanceWorkspaceClient
          {...buildDefaultClientProps()}
          initialMode={initialMode}
        />,
      );

      expect(screen.getByTestId("source-checked-at")).toHaveTextContent("unavailable");
      expect(getSummaryClientMock).not.toHaveBeenCalled();
      expect(getDetailsClientMock).not.toHaveBeenCalled();
    },
  );

  it("does not present a summary-detail receipt as the age of the independently queried adviser brief", () => {
    const initialSummary = buildSummary();
    const initialDetails = buildDetails();

    render(
      <PerformanceWorkspaceClient
        {...buildDefaultClientProps(initialSummary, initialDetails)}
        initialMode="advisor"
      />,
    );

    expect(screen.getByTestId("source-checked-at")).toHaveTextContent("unavailable");
    expect(getSummaryClientMock).not.toHaveBeenCalled();
    expect(getDetailsClientMock).not.toHaveBeenCalled();
  });

  it("does not confirm a recheck after the adviser moves to an independently sourced mode", async () => {
    const initialSummary = buildSummary();
    const initialDetails = buildDetails();
    let resolveSummary!: (summary: WorkbenchPerformanceWorkspaceSummary) => void;
    const summaryRequest = new Promise<WorkbenchPerformanceWorkspaceSummary>((resolve) => {
      resolveSummary = resolve;
    });
    getSummaryClientMock.mockReturnValueOnce(summaryRequest);
    getDetailsClientMock.mockResolvedValueOnce(initialDetails);

    const result = render(
      <PerformanceWorkspaceClient
        {...buildDefaultClientProps(initialSummary, initialDetails)}
        initialMode="evidence"
      />,
    );

    screen.getByRole("button", { name: "Recheck performance" }).click();
    await waitFor(() => expect(getSummaryClientMock).toHaveBeenCalledTimes(1));
    result.rerender(
      <PerformanceWorkspaceClient
        {...buildDefaultClientProps(initialSummary, initialDetails)}
        initialMode="risk"
      />,
    );
    await waitFor(() => expect(screen.getByTestId("mode")).toHaveTextContent("risk"));
    expect(screen.getByTestId("source-checked-at")).toHaveTextContent("unavailable");
    expect(screen.getByTestId("refresh-kind")).toHaveTextContent("none");
    expect(screen.getByTestId("updating")).toHaveTextContent("false");

    await act(async () => resolveSummary(initialSummary));

    await waitFor(() => expect(screen.getByTestId("refresh-kind")).toHaveTextContent("none"));
    expect(getDetailsClientMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("source-checked-at")).toHaveTextContent("unavailable");
  });

  it("does not restore an obsolete recheck after an Evidence mode round trip", async () => {
    const initialSummary = buildSummary();
    const initialDetails = buildDetails();
    let resolveSummary!: (summary: WorkbenchPerformanceWorkspaceSummary) => void;
    const summaryRequest = new Promise<WorkbenchPerformanceWorkspaceSummary>((resolve) => {
      resolveSummary = resolve;
    });
    getSummaryClientMock.mockReturnValueOnce(summaryRequest);
    getDetailsClientMock.mockResolvedValueOnce(initialDetails);

    const result = render(
      <PerformanceWorkspaceClient
        {...buildDefaultClientProps(initialSummary, initialDetails)}
        initialMode="evidence"
      />,
    );
    const initialCheckedAt = screen.getByTestId("source-checked-at").textContent;

    screen.getByRole("button", { name: "Recheck performance" }).click();
    await waitFor(() => expect(getSummaryClientMock).toHaveBeenCalledTimes(1));
    result.rerender(
      <PerformanceWorkspaceClient
        {...buildDefaultClientProps(initialSummary, initialDetails)}
        initialMode="risk"
      />,
    );
    await waitFor(() => expect(screen.getByTestId("mode")).toHaveTextContent("risk"));
    result.rerender(
      <PerformanceWorkspaceClient
        {...buildDefaultClientProps(initialSummary, initialDetails)}
        initialMode="evidence"
      />,
    );
    await waitFor(() => expect(screen.getByTestId("mode")).toHaveTextContent("evidence"));

    await act(async () => resolveSummary(initialSummary));

    await waitFor(() => expect(screen.getByTestId("refresh-kind")).toHaveTextContent("none"));
    expect(screen.getByTestId("source-checked-at")).toHaveTextContent(initialCheckedAt!);
    expect(getSummaryClientMock).toHaveBeenCalledTimes(1);
    expect(getDetailsClientMock).toHaveBeenCalledTimes(1);
  });

  it("withholds the Evidence recheck action while a selection refresh is active", async () => {
    let resolveSummary!: (summary: WorkbenchPerformanceWorkspaceSummary) => void;
    const summaryRequest = new Promise<WorkbenchPerformanceWorkspaceSummary>((resolve) => {
      resolveSummary = resolve;
    });
    getSummaryClientMock.mockReturnValueOnce(summaryRequest);
    getDetailsClientMock.mockResolvedValueOnce(buildDetails());

    render(<PerformanceWorkspaceClient {...buildDefaultClientProps()} />);
    screen.getByRole("button", { name: "Switch 3Y" }).click();
    await waitFor(() => expect(getSummaryClientMock).toHaveBeenCalledTimes(1));
    await act(async () => screen.getByRole("button", { name: "Switch Evidence Mode" }).click());

    expect(screen.getByTestId("mode")).toHaveTextContent("evidence");
    expect(screen.getByTestId("refresh-intent")).toHaveTextContent("selection");
    expect(screen.queryByRole("button", { name: /recheck/i })).not.toBeInTheDocument();

    await act(async () => resolveSummary(buildSummary({ period: "3Y" })));
  });

  it("clears a failed Evidence recheck and its retry when the adviser changes mode", async () => {
    getSummaryClientMock.mockRejectedValueOnce({ status: 502 });

    render(
      <PerformanceWorkspaceClient
        {...buildDefaultClientProps()}
        initialMode="evidence"
      />,
    );

    screen.getByRole("button", { name: "Recheck performance" }).click();
    await waitFor(() => expect(screen.getByTestId("refresh-kind")).toHaveTextContent("failed"));

    await act(async () => screen.getByRole("button", { name: "Switch Risk Mode" }).click());
    await waitFor(() => {
      expect(screen.getByTestId("mode")).toHaveTextContent("risk");
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("none");
      expect(screen.getByTestId("updating")).toHaveTextContent("false");
    });

    screen.getByRole("button", { name: "Retry Selection" }).click();
    expect(getSummaryClientMock).toHaveBeenCalledTimes(1);
    expect(getDetailsClientMock).not.toHaveBeenCalled();
  });

  it("revokes retained evidence when an obsolete recheck completes with a permission denial", async () => {
    let rejectSummary!: (error: unknown) => void;
    const summaryRequest = new Promise<WorkbenchPerformanceWorkspaceSummary>((_, reject) => {
      rejectSummary = reject;
    });
    getSummaryClientMock.mockReturnValueOnce(summaryRequest);

    const result = render(
      <PerformanceWorkspaceClient
        {...buildDefaultClientProps()}
        initialMode="evidence"
      />,
    );

    screen.getByRole("button", { name: "Recheck performance" }).click();
    await waitFor(() => expect(getSummaryClientMock).toHaveBeenCalledTimes(1));
    await act(async () => screen.getByRole("button", { name: "Switch Risk Mode" }).click());
    await waitFor(() => expect(screen.getByTestId("mode")).toHaveTextContent("risk"));

    await act(async () => rejectSummary(Object.assign(new Error("Forbidden"), { status: 403 })));

    await waitFor(() => {
      expect(screen.getByTestId("load-issue")).toHaveTextContent("permission_blocked");
      expect(screen.getByTestId("return")).toHaveTextContent("none");
    });
    expect(
      result.queryClient.getQueryData(
        performanceWorkspaceSummaryQueryOptions(defaultQueryContext).queryKey,
      ),
    ).toBeUndefined();
  });

  it("does not apply an obsolete permission denial to a newly selected portfolio", async () => {
    let rejectSummary!: (error: unknown) => void;
    const summaryRequest = new Promise<WorkbenchPerformanceWorkspaceSummary>((_, reject) => {
      rejectSummary = reject;
    });
    getSummaryClientMock.mockReturnValueOnce(summaryRequest);

    const result = render(
      <PerformanceWorkspaceClient
        {...buildDefaultClientProps()}
        initialMode="evidence"
      />,
    );
    screen.getByRole("button", { name: "Recheck performance" }).click();
    await waitFor(() => expect(getSummaryClientMock).toHaveBeenCalledTimes(1));

    const nextSummary = buildSummary({
      portfolio_id: "PF_2002",
      net_performance: {
        ...buildSummary().net_performance,
        portfolio_return_pct: 8.2,
      },
    });
    result.rerender(
      <PerformanceWorkspaceClient
        {...buildDefaultClientProps(
          nextSummary,
          buildDetails({ portfolio_id: "PF_2002" }),
        )}
        initialPortfolioId="PF_2002"
        initialMode="evidence"
      />,
    );
    await waitFor(() => expect(screen.getByTestId("return")).toHaveTextContent("8.2"));

    await act(async () => rejectSummary(Object.assign(new Error("Forbidden"), { status: 403 })));

    await waitFor(() => expect(screen.getByTestId("load-issue")).toHaveTextContent("none"));
    expect(screen.getByTestId("return")).toHaveTextContent("8.2");
  });

  it("retains the prior receipt and withholds success when composite recheck fails", async () => {
    const initialSummary = buildSummary();
    const initialDetails = buildDetails();
    getSummaryClientMock.mockResolvedValueOnce(initialSummary);
    getDetailsClientMock.mockRejectedValueOnce({ status: 502 });

    render(
      <PerformanceWorkspaceClient
        {...buildDefaultClientProps(initialSummary, initialDetails)}
        initialMode="evidence"
      />,
    );
    const initialCheckedAt = screen.getByTestId("source-checked-at").textContent;

    screen.getByRole("button", { name: "Recheck performance" }).click();

    await waitFor(() => {
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("failed");
      expect(screen.getByTestId("refresh-scope")).toHaveTextContent("details");
    });
    expect(screen.getByTestId("source-checked-at")).toHaveTextContent(initialCheckedAt!);
    expect(getSummaryClientMock).toHaveBeenCalledTimes(1);
    expect(getDetailsClientMock).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Recheck performance" })).not.toBeInTheDocument();
  });

  it("retries a failed recheck with the same intent and without unchanged-route navigation", async () => {
    const initialSummary = buildSummary();
    const initialDetails = buildDetails();
    getSummaryClientMock.mockResolvedValue(initialSummary);
    getDetailsClientMock
      .mockRejectedValueOnce({ status: 502 })
      .mockResolvedValueOnce(initialDetails);

    render(
      <PerformanceWorkspaceClient
        {...buildDefaultClientProps(initialSummary, initialDetails)}
        initialMode="evidence"
      />,
    );

    screen.getByRole("button", { name: "Recheck performance" }).click();
    await waitFor(() => {
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("failed");
      expect(screen.getByTestId("refresh-intent")).toHaveTextContent("recheck");
    });

    screen.getByRole("button", { name: "Retry Selection" }).click();
    await waitFor(() => {
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("confirmed");
      expect(screen.getByTestId("refresh-intent")).toHaveTextContent("recheck");
    });

    expect(getSummaryClientMock).toHaveBeenCalledTimes(2);
    expect(getDetailsClientMock).toHaveBeenCalledTimes(2);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("synchronizes the route when recheck source evidence normalizes analytical controls", async () => {
    const initialSummary = buildSummary();
    const initialDetails = buildDetails();
    getSummaryClientMock.mockResolvedValue(initialSummary);
    getDetailsClientMock.mockResolvedValue(
      buildDetails({
        contribution_dimension: "sector",
        requested_contribution_dimension_supported: false,
      }),
    );

    const replaceState = vi.spyOn(window.history, "replaceState");
    render(
      <PerformanceWorkspaceClient
        {...buildDefaultClientProps(initialSummary, initialDetails)}
        initialMode="evidence"
      />,
    );

    screen.getByRole("button", { name: "Recheck performance" }).click();

    await waitFor(() => {
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("confirmed");
      expect(screen.getByTestId("refresh-intent")).toHaveTextContent("recheck");
    });
    expect(replaceState).toHaveBeenCalledWith(
      window.history.state,
      "",
      "/performance?portfolioId=PF_1001&period=YTD&mode=evidence&detailBasis=NET&contributionDimension=sector&attributionDimension=asset_class&chartFrequency=monthly&benchmark=BMK_GLOBAL_BALANCED_60_40",
    );
    expect(pushMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
    replaceState.mockRestore();
  });

  it("revalidates retained summary and detail evidence when the workspace remounts after stale time", async () => {
    const initialSummary = buildSummary();
    const initialDetails = buildDetails();
    const props = buildDefaultClientProps(initialSummary, initialDetails);
    const firstMount = renderWithQueryClient(
      <PerformanceWorkspaceClient {...props} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("return")).toHaveTextContent(DEFAULT_PORTFOLIO_RETURN);
    });
    expect(getSummaryClientMock).not.toHaveBeenCalled();
    expect(getDetailsClientMock).not.toHaveBeenCalled();
    firstMount.unmount();

    ageRetainedPerformanceComposite(
      firstMount.queryClient,
      initialSummary,
      initialDetails,
    );

    const refreshedSummary = buildSummary({
      correlation_id: "corr-performance-refreshed",
      net_performance: {
        ...initialSummary.net_performance,
        portfolio_return_pct: 2.4,
      },
    });
    getSummaryClientMock.mockResolvedValueOnce(refreshedSummary);
    getDetailsClientMock.mockResolvedValueOnce(buildDetails());

    renderWithQueryClient(
      <PerformanceWorkspaceClient {...props} />,
      firstMount.queryClient,
    );

    await waitFor(() => {
      expect(getSummaryClientMock).toHaveBeenCalledTimes(1);
      expect(getDetailsClientMock).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("return")).toHaveTextContent("2.4");
    });
  });

  it("retains the coherent composite when remount detail revalidation fails", async () => {
    const initialSummary = buildSummary();
    const initialDetails = buildDetails();
    const props = buildDefaultClientProps(initialSummary, initialDetails);
    const firstMount = renderWithQueryClient(
      <PerformanceWorkspaceClient {...props} />,
    );
    await screen.findByTestId("return");
    firstMount.unmount();
    ageRetainedPerformanceComposite(
      firstMount.queryClient,
      initialSummary,
      initialDetails,
    );
    getSummaryClientMock.mockResolvedValueOnce(
      buildSummary({
        correlation_id: "corr-performance-refreshed",
        net_performance: {
          ...initialSummary.net_performance,
          portfolio_return_pct: 2.4,
        },
      }),
    );
    getDetailsClientMock.mockRejectedValueOnce(
      new Error("Performance detail unavailable"),
    );

    renderWithQueryClient(
      <PerformanceWorkspaceClient {...props} />,
      firstMount.queryClient,
    );

    await waitFor(() => {
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("failed");
      expect(screen.getByTestId("refresh-scope")).toHaveTextContent("details");
    });
    expect(screen.getByTestId("return")).toHaveTextContent(DEFAULT_PORTFOLIO_RETURN);
    expect(screen.getByTestId("chart-points")).toHaveTextContent("1");

    getSummaryClientMock.mockResolvedValueOnce(
      buildSummary({
        correlation_id: "corr-performance-recovered",
        net_performance: {
          ...initialSummary.net_performance,
          portfolio_return_pct: 3.1,
        },
      }),
    );
    getDetailsClientMock.mockResolvedValueOnce(buildDetails());
    screen.getByRole("button", { name: "Retry Selection" }).click();

    await waitFor(() => {
      expect(getSummaryClientMock).toHaveBeenCalledTimes(2);
      expect(getDetailsClientMock).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("confirmed");
      expect(screen.getByTestId("return")).toHaveTextContent("3.1");
    });
  });

  it("retries the failed summary before confirming remount recovery", async () => {
    const initialSummary = buildSummary();
    const initialDetails = buildDetails();
    const props = buildDefaultClientProps(initialSummary, initialDetails);
    const firstMount = renderWithQueryClient(
      <PerformanceWorkspaceClient {...props} />,
    );
    await screen.findByTestId("return");
    firstMount.unmount();
    ageRetainedPerformanceComposite(
      firstMount.queryClient,
      initialSummary,
      initialDetails,
    );
    const refreshedSummary = buildSummary({
      correlation_id: "corr-performance-recovered",
      net_performance: {
        ...initialSummary.net_performance,
        portfolio_return_pct: 2.4,
      },
    });
    getSummaryClientMock
      .mockRejectedValueOnce(new Error("Performance summary unavailable"))
      .mockResolvedValueOnce(refreshedSummary);
    getDetailsClientMock.mockResolvedValueOnce(buildDetails());

    renderWithQueryClient(
      <PerformanceWorkspaceClient {...props} />,
      firstMount.queryClient,
    );
    await waitFor(() => {
      expect(screen.getByTestId("refresh-scope")).toHaveTextContent("summary");
    });
    expect(getSummaryClientMock).toHaveBeenCalledTimes(1);
    expect(getDetailsClientMock).not.toHaveBeenCalled();

    screen.getByRole("button", { name: "Retry Selection" }).click();

    await waitFor(() => {
      expect(getSummaryClientMock).toHaveBeenCalledTimes(2);
      expect(getDetailsClientMock).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("confirmed");
      expect(screen.getByTestId("return")).toHaveTextContent("2.4");
    });
  });

  it("withholds stale initial detail and rehydrates it from the confirmed source identity", async () => {
    getDetailsClientMock.mockResolvedValueOnce(buildDetails());

    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary()}
        initialDetails={buildDetails({ portfolio_id: "PF_OTHER" })}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await waitFor(() => {
      expect(getDetailsClientMock).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("chart-points")).toHaveTextContent("1");
      expect(screen.getByTestId("details-pending")).toHaveTextContent("false");
    });
  });

  it("withholds mixed-currency initial detail until it matches the summary context", async () => {
    const summary = buildSummary({
      requested_as_of_date: "2026-02-24",
      effective_as_of_date: "2026-02-24",
      requested_reporting_currency: "SGD",
      effective_reporting_currency: "USD",
      reporting_currency_state: "unavailable",
    });
    const mixedDetails = buildDetails({
      requested_as_of_date: "2026-02-24",
      effective_as_of_date: "2026-02-24",
      requested_reporting_currency: "SGD",
      effective_reporting_currency: "SGD",
      reporting_currency_state: "accepted_unverified",
    });
    getDetailsClientMock.mockResolvedValueOnce(
      buildDetails({
        requested_as_of_date: "2026-02-24",
        effective_as_of_date: "2026-02-24",
        requested_reporting_currency: "SGD",
        effective_reporting_currency: "USD",
        reporting_currency_state: "unavailable",
      }),
    );

    render(
      <PerformanceWorkspaceClient
        initialSummary={summary}
        initialDetails={mixedDetails}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
        initialAsOfDate="2026-02-24"
        initialReportingCurrency="SGD"
      />
    );

    await waitFor(() => {
      expect(getDetailsClientMock).toHaveBeenCalledWith(
        "PF_1001",
        expect.objectContaining({
          asOfDate: "2026-02-24",
          reportingCurrency: "SGD",
        }),
        expect.any(AbortSignal),
      );
      expect(screen.getByTestId("chart-points")).toHaveTextContent("1");
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("none");
    });
  });

  it("recomputes the business limitation when refreshed source context changes", async () => {
    const rejectedContext = {
      requested_as_of_date: "2026-02-24",
      effective_as_of_date: "2026-02-24",
      requested_reporting_currency: "EUR",
      effective_reporting_currency: "USD",
      reporting_currency_state: "rejected" as const,
    };
    const appliedContext = {
      period: "3Y",
      report_start_date: "2023-03-28",
      requested_as_of_date: "2026-02-24",
      effective_as_of_date: "2026-02-24",
      requested_reporting_currency: "EUR",
      effective_reporting_currency: "EUR",
      reporting_currency_state: "applied" as const,
    };
    getSummaryClientMock.mockResolvedValueOnce(buildSummary(appliedContext));
    getDetailsClientMock.mockResolvedValueOnce(buildDetails(appliedContext));

    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary(rejectedContext)}
        initialDetails={buildDetails(rejectedContext)}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
        initialAsOfDate="2026-02-24"
        initialReportingCurrency="EUR"
      />
    );

    expect(
      screen.getByText(/requested EUR restatement was not accepted/i),
    ).toBeInTheDocument();

    await act(async () => {
      screen.getByRole("button", { name: "Switch 3Y" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("confirmed");
      expect(
        screen.queryByText(/requested EUR restatement was not accepted/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Performance remains in portfolio base currency/i),
      ).not.toBeInTheDocument();
    });
  });

  it("rehydrates initial detail when its explicit bounds do not match the confirmed summary", async () => {
    const explicitWindow = {
      period: "EXPLICIT",
      report_start_date: "2026-01-01",
      report_end_date: "2026-02-24",
    };
    getDetailsClientMock.mockResolvedValueOnce(buildDetails(explicitWindow));

    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary(explicitWindow)}
        initialDetails={buildDetails({
          ...explicitWindow,
          report_start_date: "2025-12-01",
        })}
        initialPortfolioId="PF_1001"
        initialPeriod="EXPLICIT"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await waitFor(() => {
      expect(getDetailsClientMock).toHaveBeenCalledWith(
        "PF_1001",
        expect.objectContaining({
          period: "EXPLICIT",
          reportStartDate: "2026-01-01",
          reportEndDate: "2026-02-24",
        }),
        expect.any(AbortSignal),
      );
      expect(screen.getByTestId("chart-points")).toHaveTextContent("1");
      expect(screen.getByTestId("details-pending")).toHaveTextContent("false");
    });
  });

  it("rejects analytical detail whose effective valuation date is internally inconsistent", async () => {
    getDetailsClientMock.mockResolvedValueOnce(
      buildDetails({ as_of_date: "2026-02-23" }),
    );

    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary()}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("chart-points")).toHaveTextContent("0");
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("failed");
      expect(screen.getByTestId("details-pending")).toHaveTextContent("false");
    });
    expect(getDetailsClientMock).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("synchronizes browser-history mode props without remounting focused workspace controls", async () => {
    const props = {
      initialSummary: buildSummary(),
      initialDetails: buildDetails(),
      initialPortfolioId: "PF_1001",
      initialPeriod: "YTD",
      initialDetailBasis: "NET",
      initialContributionDimension: "asset_class",
      initialAttributionDimension: "asset_class",
      initialChartFrequency: "monthly",
      initialBenchmark: "BMK_GLOBAL_BALANCED_60_40",
    } as const;
    const { rerender } = render(
      <PerformanceWorkspaceClient {...props} initialMode="summary" />
    );
    const stableControl = screen.getByRole("button", { name: "Switch Analysis Mode" });
    stableControl.focus();

    rerender(<PerformanceWorkspaceClient {...props} initialMode="analysis" />);

    await waitFor(() => {
      expect(screen.getByTestId("mode")).toHaveTextContent("analysis");
    });
    expect(document.activeElement).toBe(stableControl);
    expect(pushMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();

    rerender(<PerformanceWorkspaceClient {...props} initialMode="summary" />);

    await waitFor(() => {
      expect(screen.getByTestId("mode")).toHaveTextContent("summary");
    });
    expect(document.activeElement).toBe(stableControl);
  });

  it("atomically synchronizes source-confirmed route props across browser history", async () => {
    const stableProps = {
      initialPortfolioId: "PF_1001",
      initialDetailBasis: "NET",
      initialContributionDimension: "asset_class",
      initialAttributionDimension: "asset_class",
      initialChartFrequency: "monthly",
      initialBenchmark: "BMK_GLOBAL_BALANCED_60_40",
    } as const;
    const ytdSummary = buildSummary();
    const ytdDetails = buildDetails();
    const threeYearSummary = buildSummary({
      period: "3Y",
      report_start_date: "2023-02-25",
      net_performance: {
        ...ytdSummary.net_performance,
        portfolio_return_pct: 18.4,
      },
    });
    const threeYearDetails = buildDetails({
      period: "3Y",
      report_start_date: "2023-02-25",
    });
    const refreshedYtdSummary = buildSummary({
      net_performance: {
        ...ytdSummary.net_performance,
        portfolio_return_pct: 7.1,
      },
    });
    const refreshedYtdDetails = buildDetails();
    const { queryClient, rerender } = render(
      <PerformanceWorkspaceClient
        {...stableProps}
        initialSummary={ytdSummary}
        initialDetails={ytdDetails}
        initialPeriod="YTD"
      />
    );
    const stableControl = screen.getByRole("button", { name: "Switch Analysis Mode" });
    stableControl.focus();

    rerender(
      <PerformanceWorkspaceClient
        {...stableProps}
        initialSummary={threeYearSummary}
        initialDetails={threeYearDetails}
        initialPeriod="3Y"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("period")).toHaveTextContent("3Y");
      expect(screen.getByTestId("return")).toHaveTextContent("18.4");
    });
    expect(document.activeElement).toBe(stableControl);

    rerender(
      <PerformanceWorkspaceClient
        {...stableProps}
        initialSummary={refreshedYtdSummary}
        initialDetails={refreshedYtdDetails}
        initialPeriod="YTD"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("period")).toHaveTextContent("YTD");
      expect(screen.getByTestId("return")).toHaveTextContent("7.1");
    });
    expect(
      queryClient.getQueryData(
        performanceWorkspaceSummaryQueryOptions(defaultQueryContext).queryKey,
      ),
    ).toEqual(refreshedYtdSummary);
    expect(document.activeElement).toBe(stableControl);
    expect(pushMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("admits newer source evidence when the refreshed route controls are unchanged", async () => {
    const initialSummary = buildSummary();
    const refreshedSummary = buildSummary({
      correlation_id: "corr-performance-route-refresh",
      net_performance: {
        ...initialSummary.net_performance,
        portfolio_return_pct: 7.1,
      },
    });
    const props = buildDefaultClientProps(initialSummary, buildDetails());
    const { queryClient, rerender } = render(
      <PerformanceWorkspaceClient {...props} />,
    );

    expect(screen.getByTestId("return")).toHaveTextContent(DEFAULT_PORTFOLIO_RETURN);
    getDetailsClientMock.mockResolvedValueOnce(
      buildDetails({ correlation_id: "corr-performance-route-refresh" }),
    );

    rerender(
      <PerformanceWorkspaceClient
        {...props}
        initialSummary={refreshedSummary}
        initialDetails={null}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("return")).toHaveTextContent("7.1");
    });
    expect(
      queryClient.getQueryData(
        performanceWorkspaceSummaryQueryOptions(defaultQueryContext).queryKey,
      ),
    ).toEqual(refreshedSummary);
    expect(getSummaryClientMock).not.toHaveBeenCalled();
    expect(getDetailsClientMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces a refreshed route load failure instead of presenting retained cache", async () => {
    const props = buildDefaultClientProps(buildSummary(), buildDetails());
    const { rerender } = render(<PerformanceWorkspaceClient {...props} />);

    expect(screen.getByTestId("return")).toHaveTextContent(DEFAULT_PORTFOLIO_RETURN);

    rerender(
      <PerformanceWorkspaceClient
        {...props}
        initialSummary={null}
        initialDetails={null}
        initialLoadIssue={{ state: "unavailable", status: 502 }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("load-issue")).toHaveTextContent("unavailable");
      expect(screen.getByTestId("return")).toHaveTextContent("none");
    });
    expect(getSummaryClientMock).not.toHaveBeenCalled();
    expect(getDetailsClientMock).not.toHaveBeenCalled();
  });

  it("fences a cancelled same-control hydration from the refreshed route revision", async () => {
    let rejectSupersededDetails!: (reason: Error) => void;
    const supersededDetails = new Promise<WorkbenchPerformanceWorkspaceDetails>(
      (_resolve, reject) => {
        rejectSupersededDetails = reject;
      },
    );
    const initialSummary = buildSummary();
    const refreshedSummary = buildSummary({
      correlation_id: "corr-performance-current-route",
      net_performance: {
        ...initialSummary.net_performance,
        portfolio_return_pct: 7.1,
      },
    });
    getDetailsClientMock
      .mockImplementationOnce(() => supersededDetails)
      .mockResolvedValueOnce(
        buildDetails({ correlation_id: "corr-performance-current-route" }),
      );
    const props = {
      ...buildDefaultClientProps(initialSummary),
      initialDetails: null,
    };
    const { rerender } = render(<PerformanceWorkspaceClient {...props} />);

    await waitFor(() => {
      expect(getDetailsClientMock).toHaveBeenCalledTimes(1);
    });
    rerender(
      <PerformanceWorkspaceClient
        {...props}
        initialSummary={refreshedSummary}
        initialDetails={null}
      />,
    );

    await waitFor(() => {
      expect(getDetailsClientMock).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("return")).toHaveTextContent("7.1");
      expect(screen.getByTestId("chart-points")).toHaveTextContent("1");
    });

    await act(async () => {
      rejectSupersededDetails(new Error("Superseded detail request failed"));
      await Promise.resolve();
    });
    expect(screen.getByTestId("refresh-kind")).toHaveTextContent("none");
    expect(screen.getByTestId("return")).toHaveTextContent("7.1");
  });

  it("keeps a route load failure authoritative over cancelled hydration", async () => {
    let rejectSupersededDetails!: (reason: { status: number }) => void;
    const supersededDetails = new Promise<WorkbenchPerformanceWorkspaceDetails>(
      (_resolve, reject) => {
        rejectSupersededDetails = reject;
      },
    );
    getDetailsClientMock.mockImplementationOnce(() => supersededDetails);
    const props = {
      ...buildDefaultClientProps(buildSummary()),
      initialDetails: null,
    };
    const { rerender } = render(<PerformanceWorkspaceClient {...props} />);

    await waitFor(() => {
      expect(getDetailsClientMock).toHaveBeenCalledTimes(1);
    });
    rerender(
      <PerformanceWorkspaceClient
        {...props}
        initialSummary={null}
        initialLoadIssue={{ state: "unavailable", status: 502 }}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("load-issue")).toHaveTextContent("unavailable");
      expect(screen.getByTestId("return")).toHaveTextContent("none");
    });

    await act(async () => {
      rejectSupersededDetails({ status: 403 });
      await Promise.resolve();
    });
    expect(getDetailsClientMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("load-issue")).toHaveTextContent("unavailable");
    expect(screen.getByTestId("return")).toHaveTextContent("none");
  });

  it("reports that an already-confirmed request did not dispatch a refresh", async () => {
    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary()}
        initialDetails={buildDetails()}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await act(async () => {
      screen.getByRole("button", { name: "Repeat confirmed selection" }).click();
    });

    await waitFor(() => expect(requestResultMock).toHaveBeenCalledWith(false));
    expect(getSummaryClientMock).not.toHaveBeenCalled();
    expect(getDetailsClientMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("restores Retry focus to Review window after a rejected explicit-window refresh", async () => {
    const failedRequest = Object.assign(new Error("Performance summary unavailable"), {
      status: 503,
    });
    const explicitSummary = buildSummary({
      period: "EXPLICIT",
      report_start_date: "2026-02-01",
      report_end_date: "2026-03-31",
    });
    const explicitDetailsBaseline = buildDetails();
    const explicitDetails = buildDetails({
      period: "EXPLICIT",
      report_start_date: "2026-02-01",
      report_end_date: "2026-03-31",
      net_chart: explicitDetailsBaseline.net_chart.map((point) => ({
        ...point,
        period_start: "2026-02-01",
        period_end: "2026-02-28",
      })),
      gross_chart: explicitDetailsBaseline.gross_chart.map((point) => ({
        ...point,
        period_start: "2026-02-01",
        period_end: "2026-02-28",
      })),
    });
    getSummaryClientMock
      .mockRejectedValueOnce(failedRequest)
      .mockResolvedValueOnce(explicitSummary);
    getDetailsClientMock.mockResolvedValueOnce(explicitDetails);

    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary()}
        initialDetails={buildDetails()}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await act(async () => {
      screen.getByRole("button", { name: "Switch review window" }).click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("failed");
    });
    expect(restoreFocusMock).not.toHaveBeenCalled();

    await act(async () => {
      screen.getByRole("button", { name: "Retry Selection" }).click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("confirmed");
      expect(screen.getByTestId("period")).toHaveTextContent("EXPLICIT");
    });
    expect(restoreFocusMock).toHaveBeenLastCalledWith({ kind: "window" });
  });

  it("does not reuse an earlier selector target for a targetless retry", async () => {
    const detailFailure = Object.assign(new Error("Performance details unavailable"), {
      status: 502,
    });
    getSummaryClientMock.mockResolvedValueOnce(
      buildSummary({ period: "3Y", report_start_date: "2023-03-28" })
    );
    getDetailsClientMock
      .mockResolvedValueOnce(buildDetails({ period: "3Y", report_start_date: "2023-03-28" }))
      .mockRejectedValueOnce(detailFailure)
      .mockResolvedValueOnce(
        buildDetails({
          period: "3Y",
          report_start_date: "2023-03-28",
          contribution_dimension: "sector",
        })
      );

    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary()}
        initialDetails={buildDetails()}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await act(async () => {
      screen.getByRole("button", { name: "Switch 3Y with focus target" }).click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("confirmed");
    });
    expect(restoreFocusMock).toHaveBeenCalledWith({
      kind: "choice",
      groupLabel: "Horizon",
      optionLabel: "3Y",
    });
    restoreFocusMock.mockClear();

    await act(async () => {
      screen.getByRole("button", { name: "Switch Contribution Segment" }).click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("failed");
    });

    await act(async () => {
      screen.getByRole("button", { name: "Retry Selection" }).click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("confirmed");
    });
    expect(restoreFocusMock).not.toHaveBeenCalled();
  });

  it("expires one source-confirmed acknowledgement without stealing focus or replaying identical input", async () => {
    vi.useFakeTimers();
    getSummaryClientMock.mockResolvedValueOnce(
      buildSummary({
        period: "3Y",
        report_start_date: "2023-03-28",
      }),
    );
    getDetailsClientMock.mockResolvedValueOnce(
      buildDetails({
        period: "3Y",
        report_start_date: "2023-03-28",
      }),
    );

    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary()}
        initialDetails={buildDetails()}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />,
    );

    const sourceControl = screen.getByRole("button", { name: "Switch 3Y" });
    await act(async () => {
      sourceControl.focus();
      sourceControl.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("refresh-kind")).toHaveTextContent("confirmed");
    expect(screen.getByTestId("refresh-confirmed")).toHaveTextContent("3Y");
    expect(sourceControl).toHaveFocus();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PERFORMANCE_REFRESH_CONFIRMATION_DURATION_MS - 1);
    });
    expect(screen.getByTestId("refresh-kind")).toHaveTextContent("confirmed");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByTestId("refresh-kind")).toHaveTextContent("none");
    expect(sourceControl).toHaveFocus();

    await act(async () => {
      sourceControl.click();
      await Promise.resolve();
    });
    expect(screen.getByTestId("refresh-kind")).toHaveTextContent("none");
    expect(getSummaryClientMock).toHaveBeenCalledTimes(1);
    expect(getDetailsClientMock).toHaveBeenCalledTimes(1);
  });

  it("reuses cached summary and detail responses when switching back to a previously loaded control state", async () => {
    const threeYearSummary = buildSummary({
      period: "3Y",
      report_start_date: "2023-03-28",
      net_performance: {
        ...buildSummary().net_performance,
        portfolio_return_pct: 18.4,
      },
    });
    const threeYearDetails = buildDetails({
      period: "3Y",
      report_start_date: "2023-03-28",
      net_chart: [
        {
          ...buildDetails().net_chart[0],
          label: "2026-03",
          cumulative_portfolio_return_pct: 18.4,
        },
      ],
    });

    getDetailsClientMock
      .mockResolvedValueOnce(buildDetails())
      .mockResolvedValueOnce(threeYearDetails);
    getSummaryClientMock.mockResolvedValueOnce(threeYearSummary);

    const result = render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary()}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("chart-points")).toHaveTextContent("1");
    });

    expect(screen.getByTestId("return")).toHaveTextContent(DEFAULT_PORTFOLIO_RETURN);

    await act(async () => {
      screen.getByRole("button", { name: "Switch 3Y" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("period")).toHaveTextContent("3Y");
      expect(screen.getByTestId("return")).toHaveTextContent("18.4");
    });

    const threeYearContext = {
      ...defaultQueryContext,
      period: "3Y",
      reportStartDate: "2023-03-28",
    };
    const summaryKey = performanceWorkspaceSummaryQueryOptions(threeYearContext).queryKey;
    const detailsKey = performanceWorkspaceDetailsQueryOptions(
      threeYearContext,
      threeYearSummary,
    ).queryKey;
    const summaryReceiptTime = result.queryClient.getQueryState(summaryKey)?.dataUpdatedAt;
    const detailsReceiptTime = result.queryClient.getQueryState(detailsKey)?.dataUpdatedAt;
    expect(summaryReceiptTime).toBeTypeOf("number");
    expect(detailsReceiptTime).toBeTypeOf("number");

    expect(getSummaryClientMock).toHaveBeenCalledTimes(1);
    expect(getDetailsClientMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      screen.getByRole("button", { name: "Switch YTD" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("period")).toHaveTextContent("YTD");
      expect(screen.getByTestId("return")).toHaveTextContent(DEFAULT_PORTFOLIO_RETURN);
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    await act(async () => {
      screen.getByRole("button", { name: "Switch 3Y" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("period")).toHaveTextContent("3Y");
      expect(screen.getByTestId("return")).toHaveTextContent("18.4");
    });

    expect(getSummaryClientMock).toHaveBeenCalledTimes(1);
    expect(getDetailsClientMock).toHaveBeenCalledTimes(2);
    expect(result.queryClient.getQueryState(summaryKey)?.dataUpdatedAt).toBe(
      summaryReceiptTime,
    );
    expect(result.queryClient.getQueryState(detailsKey)?.dataUpdatedAt).toBe(
      detailsReceiptTime,
    );
  });

  it("refreshes detail when a stale cached summary requires a new source read", async () => {
    const cachedSummary = buildSummary({
      period: "3Y",
      report_start_date: "2023-03-28",
    });
    const cachedDetails = buildDetails({
      period: "3Y",
      report_start_date: "2023-03-28",
    });
    const refreshedSummary = buildSummary({
      period: "3Y",
      report_start_date: "2023-03-28",
      net_performance: {
        ...cachedSummary.net_performance,
        portfolio_return_pct: 19.1,
      },
    });
    const refreshedDetails = buildDetails({
      period: "3Y",
      report_start_date: "2023-03-28",
    });
    getSummaryClientMock.mockResolvedValueOnce(refreshedSummary);
    getDetailsClientMock.mockResolvedValueOnce(refreshedDetails);
    const result = render(
      <PerformanceWorkspaceClient {...buildDefaultClientProps()} />,
    );
    const threeYearContext = {
      ...defaultQueryContext,
      period: "3Y",
      reportStartDate: "2023-03-28",
    };
    result.queryClient.setQueryData(
      performanceWorkspaceSummaryQueryOptions(threeYearContext).queryKey,
      cachedSummary,
      { updatedAt: Date.now() - WORKBENCH_QUERY_STALE_TIME_MS - 1 },
    );
    result.queryClient.setQueryData(
      performanceWorkspaceDetailsQueryOptions(
        threeYearContext,
        cachedSummary,
      ).queryKey,
      cachedDetails,
      { updatedAt: Date.now() },
    );

    screen.getByRole("button", { name: "Switch 3Y" }).click();

    await waitFor(() => {
      expect(screen.getByTestId("return")).toHaveTextContent("19.1");
      expect(screen.getByTestId("chart-points")).toHaveTextContent("1");
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("confirmed");
    });
    expect(getSummaryClientMock).toHaveBeenCalledTimes(1);
    expect(getDetailsClientMock).toHaveBeenCalledTimes(1);
  });

  it("does not replace a confirmed composite with its client-navigation route echo", async () => {
    const confirmedSummary = buildSummary({
      period: "3Y",
      report_start_date: "2023-03-28",
      correlation_id: "corr-performance-client-confirmed",
      net_performance: {
        ...buildSummary().net_performance,
        portfolio_return_pct: 18.4,
      },
    });
    const confirmedDetails = buildDetails({
      period: "3Y",
      report_start_date: "2023-03-28",
      correlation_id: "corr-performance-client-confirmed",
    });
    getSummaryClientMock.mockResolvedValueOnce(confirmedSummary);
    getDetailsClientMock.mockResolvedValueOnce(confirmedDetails);
    const props = buildDefaultClientProps();
    const { rerender } = render(<PerformanceWorkspaceClient {...props} />);

    screen.getByRole("button", { name: "Switch 3Y" }).click();
    await waitFor(() => {
      expect(screen.getByTestId("return")).toHaveTextContent("18.4");
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("confirmed");
    });

    const routeEchoSummary = buildSummary({
      period: "3Y",
      report_start_date: "2023-03-28",
      correlation_id: "corr-performance-route-echo",
      net_performance: {
        ...buildSummary().net_performance,
        portfolio_return_pct: 18.5,
      },
    });
    rerender(
      <PerformanceWorkspaceClient
        {...props}
        initialSummary={routeEchoSummary}
        initialDetails={null}
        initialPeriod="3Y"
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("return")).toHaveTextContent("18.4");
    });
    expect(getSummaryClientMock).toHaveBeenCalledTimes(1);
    expect(getDetailsClientMock).toHaveBeenCalledTimes(1);

    const refreshedRouteSummary = buildSummary({
      period: "3Y",
      report_start_date: "2023-03-28",
      correlation_id: "corr-performance-route-refresh-after-echo",
      net_performance: {
        ...buildSummary().net_performance,
        portfolio_return_pct: 20.2,
      },
    });
    getDetailsClientMock.mockResolvedValueOnce(
      buildDetails({
        period: "3Y",
        report_start_date: "2023-03-28",
        correlation_id: "corr-performance-route-refresh-after-echo",
      }),
    );
    rerender(
      <PerformanceWorkspaceClient
        {...props}
        initialSummary={refreshedRouteSummary}
        initialDetails={null}
        initialPeriod="3Y"
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("return")).toHaveTextContent("20.2");
      expect(getDetailsClientMock).toHaveBeenCalledTimes(2);
    });
    expect(getSummaryClientMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces a failed client-navigation route echo instead of retained evidence", async () => {
    const confirmedSummary = buildSummary({
      period: "3Y",
      report_start_date: "2023-03-28",
      correlation_id: "corr-performance-client-confirmed",
      net_performance: {
        ...buildSummary().net_performance,
        portfolio_return_pct: 18.4,
      },
    });
    getSummaryClientMock.mockResolvedValueOnce(confirmedSummary);
    getDetailsClientMock.mockResolvedValueOnce(
      buildDetails({
        period: "3Y",
        report_start_date: "2023-03-28",
        correlation_id: "corr-performance-client-confirmed",
      }),
    );
    const props = buildDefaultClientProps();
    const { rerender } = render(<PerformanceWorkspaceClient {...props} />);

    screen.getByRole("button", { name: "Switch 3Y" }).click();
    await waitFor(() => {
      expect(screen.getByTestId("return")).toHaveTextContent("18.4");
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("confirmed");
    });

    rerender(
      <PerformanceWorkspaceClient
        {...props}
        initialSummary={null}
        initialDetails={null}
        initialLoadIssue={{ state: "unavailable", status: 502 }}
        initialPeriod="3Y"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("load-issue")).toHaveTextContent("unavailable");
      expect(screen.getByTestId("return")).toHaveTextContent("none");
    });
    expect(getSummaryClientMock).toHaveBeenCalledTimes(1);
    expect(getDetailsClientMock).toHaveBeenCalledTimes(1);
  });

  it("preserves source receipt time when a normalized summary is admitted under confirmed controls", async () => {
    const normalizedSummary = buildSummary({
      period: "3Y",
      report_start_date: "2023-03-28",
      requested_chart_frequency_supported: false,
      net_performance: {
        ...buildSummary().net_performance,
        portfolio_return_pct: 2.2,
      },
    });
    getSummaryClientMock.mockResolvedValueOnce(normalizedSummary);
    getDetailsClientMock
      .mockRejectedValueOnce(new Error("Performance detail unavailable"))
      .mockResolvedValueOnce(
        buildDetails({ period: "3Y", report_start_date: "2023-03-28" }),
      );
    const result = render(
      <PerformanceWorkspaceClient {...buildDefaultClientProps()} />,
    );

    screen.getByRole("button", { name: "Switch 3Y weekly" }).click();
    await waitFor(() => {
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("failed");
    });
    const requestedSummaryKey = performanceWorkspaceSummaryQueryOptions({
      ...defaultQueryContext,
      period: "3Y",
      chartFrequency: "weekly",
    }).queryKey;
    const sourceReceiptTime = result.queryClient.getQueryState(
      requestedSummaryKey,
    )?.dataUpdatedAt;
    expect(sourceReceiptTime).toBeTypeOf("number");

    await new Promise((resolve) => setTimeout(resolve, 5));
    screen.getByRole("button", { name: "Retry Selection" }).click();

    await waitFor(() => {
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("confirmed");
      expect(screen.getByTestId("return")).toHaveTextContent("2.2");
    });
    expect(getSummaryClientMock).toHaveBeenCalledTimes(1);
    expect(getDetailsClientMock).toHaveBeenCalledTimes(2);
    expect(
      result.queryClient.getQueryState(
        performanceWorkspaceSummaryQueryOptions({
          ...defaultQueryContext,
          period: "3Y",
        }).queryKey,
      )?.dataUpdatedAt,
    ).toBe(sourceReceiptTime);
  });

  it("uses server-provided initial details without an immediate client refetch", async () => {
    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary()}
        initialDetails={buildDetails()}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("chart-points")).toHaveTextContent("1");
      expect(screen.getByTestId("details-pending")).toHaveTextContent("false");
    });

    expect(getDetailsClientMock).not.toHaveBeenCalled();
    expect(getSummaryClientMock).not.toHaveBeenCalled();
  });

  it("preserves backend-owned capabilities and evidence when assembling summary and details", async () => {
    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary({
          capabilities: {
            ...buildSummary().capabilities!,
            evidence: { state: "partial", reason: "Lineage artifacts are available." },
          },
          evidence_view: {
            state: "partial",
            reason: "Lineage artifacts are available.",
            calculations: [
              {
                calculation_role: "workspace_summary",
                calculation_id: "calc-workspace-summary",
                analytics_type: "WORKSPACE_SUMMARY",
                execution_status: "complete",
                execution_mode: "sync",
                lineage_status: "pending",
                stage_statuses: [
                  {
                    stage_name: "lineage_materialization",
                    status: "pending",
                    completed_at_utc: null,
                  },
                ],
                upstream_snapshots: [
                  {
                    upstream_endpoint: "portfolio_timeseries",
                    source_identifier: "PF_1001",
                    as_of_date: "2026-02-24",
                    retrieval_status: "200",
                  },
                ],
                artifacts: [
                  {
                    artifact_name: "request.json",
                    url: "/api/v1/workbench/PF_1001/performance/evidence/artifacts/calc-workspace-summary/request.json",
                    content_type: "application/json",
                  },
                ],
              },
            ],
          },
        })}
        initialDetails={buildDetails({
          capabilities: {
            ...buildDetails().capabilities!,
            evidence: { state: "supported", reason: "Evidence contract available." },
          },
          evidence_view: {
            state: "supported",
            reason: "Evidence contract available.",
            source_supportability: [
              {
                key: "source_calculation",
                state: "partial",
                freshness_bucket: "stale",
                source_service: "lotus-performance",
                reason: "Source data window is stale.",
              },
            ],
            calculations: [
              {
                calculation_role: "workspace_summary",
                calculation_id: "calc-workspace-summary",
                analytics_type: "WORKSPACE_SUMMARY",
                execution_status: "complete",
                execution_mode: "sync",
                lineage_status: "complete",
                stage_statuses: [
                  {
                    stage_name: "lineage_materialization",
                    status: "complete",
                    completed_at_utc: "2026-02-24T08:15:00Z",
                  },
                ],
                upstream_snapshots: [
                  {
                    upstream_endpoint: "portfolio_timeseries",
                    source_identifier: "PF_1001",
                    as_of_date: "2026-02-24",
                    retrieval_status: "200",
                  },
                ],
                artifacts: [
                  {
                    artifact_name: "request.json",
                    url: "/api/v1/workbench/PF_1001/performance/evidence/artifacts/calc-workspace-summary/request.json",
                    content_type: "application/json",
                  },
                ],
              },
            ],
          },
        })}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("evidence-state")).toHaveTextContent("supported");
      expect(screen.getByTestId("capability-evidence")).toHaveTextContent("supported");
      expect(screen.getByTestId("evidence-artifact")).toHaveTextContent("request.json");
      expect(screen.getByTestId("evidence-stage")).toHaveTextContent("complete");
      expect(screen.getByTestId("evidence-upstream")).toHaveTextContent("PF_1001");
      expect(screen.getByTestId("evidence-source-state")).toHaveTextContent("partial");
    });
  });

  it("treats summary-only first paint as detail-pending and hydrates details after mount", async () => {
    let resolveDetails:
      | ((value: WorkbenchPerformanceWorkspaceDetails) => void)
      | null = null;
    const detailsPromise = new Promise<WorkbenchPerformanceWorkspaceDetails>((resolve) => {
      resolveDetails = resolve;
    });
    getDetailsClientMock.mockImplementationOnce(() => detailsPromise);

    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary()}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("return")).toHaveTextContent(DEFAULT_PORTFOLIO_RETURN);
      expect(screen.getByTestId("details-pending")).toHaveTextContent("true");
    });

    expect(getDetailsClientMock).toHaveBeenCalledTimes(1);
    expect(getSummaryClientMock).not.toHaveBeenCalled();

    await act(async () => {
      resolveDetails?.(buildDetails());
      await detailsPromise;
    });

    await waitFor(() => {
      expect(screen.getByTestId("chart-points")).toHaveTextContent("1");
      expect(screen.getByTestId("details-pending")).toHaveTextContent("false");
    });
  });

  it("normalizes stale initial detail dimensions during first client hydration", async () => {
    const baseDetails = buildDetails();
    const degradedInitialDetails = buildDetails({
      contribution_dimension: "country",
      attribution_dimension: "country",
      segment: "country",
      net_chart: [],
      contribution: {
        ...baseDetails.contribution!,
        position_rows: [],
      },
      attribution: null,
      partial_failures: [
        {
          source_service: "lotus-performance",
          error_code: "HTTP_422",
          detail: "Benchmark component missing classification label for country.",
        },
      ],
      capabilities: {
        ...baseDetails.capabilities!,
        return_path: {
          ...baseDetails.capabilities!.return_path,
          state: "unavailable",
          reason: "Published return observations are not available for the selected horizon.",
        },
        contribution_ranking: {
          ...baseDetails.capabilities!.contribution_ranking,
          state: "partial",
          reason: "Contribution exists, but only aggregate rows are available.",
        },
        attribution_detail: {
          ...baseDetails.capabilities!.attribution_detail,
          state: "unavailable",
          reason: "Attribution detail is not available for the current selection.",
        },
      },
    });
    const normalizedDetails = buildDetails();

    getDetailsClientMock
      .mockResolvedValueOnce(degradedInitialDetails)
      .mockResolvedValueOnce(normalizedDetails);

    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary()}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="country"
        initialAttributionDimension="country"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("chart-points")).toHaveTextContent("1");
      expect(screen.getByTestId("details-pending")).toHaveTextContent("false");
    });

    expect(getDetailsClientMock).toHaveBeenCalledTimes(2);
    expect(getDetailsClientMock.mock.calls[0]?.[1]).toMatchObject({
      contributionDimension: "country",
      attributionDimension: "country",
    });
    expect(getDetailsClientMock.mock.calls[1]?.[1]).toMatchObject({
      contributionDimension: "asset_class",
      attributionDimension: "asset_class",
    });
    expect(replaceMock).toHaveBeenCalledWith(
      "/performance?portfolioId=PF_1001&period=YTD&detailBasis=NET&contributionDimension=asset_class&attributionDimension=asset_class&chartFrequency=monthly&benchmark=BMK_GLOBAL_BALANCED_60_40",
      { scroll: false }
    );
  });

  it("normalizes stale initial control params to the server-resolved detail controls", async () => {
    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary({
          chart_frequency: "monthly",
        })}
        initialDetails={buildDetails({
          contribution_dimension: "asset_class",
          attribution_dimension: "asset_class",
          chart_frequency: "monthly",
          requested_contribution_dimension_supported: false,
          requested_attribution_dimension_supported: false,
          requested_chart_frequency_supported: false,
        })}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="currency"
        initialAttributionDimension="issuer"
        initialChartFrequency="weekly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(
        "/performance?portfolioId=PF_1001&period=YTD&detailBasis=NET&contributionDimension=asset_class&attributionDimension=asset_class&chartFrequency=monthly&benchmark=BMK_GLOBAL_BALANCED_60_40",
        { scroll: false }
      );
    });
    expect(getDetailsClientMock).not.toHaveBeenCalled();
    expect(getSummaryClientMock).not.toHaveBeenCalled();
  });

  it("ignores stale responses when a newer interaction finishes later", async () => {
    let resolveThreeYearSummary:
      | ((value: WorkbenchPerformanceWorkspaceSummary) => void)
      | null = null;
    let resolveThreeYearDetails:
      | ((value: WorkbenchPerformanceWorkspaceDetails) => void)
      | null = null;
    const threeYearSummaryPromise = new Promise<WorkbenchPerformanceWorkspaceSummary>(
      (resolve) => {
        resolveThreeYearSummary = resolve;
      }
    );
    const threeYearDetailsPromise = new Promise<WorkbenchPerformanceWorkspaceDetails>(
      (resolve) => {
        resolveThreeYearDetails = resolve;
      }
    );

    getDetailsClientMock
      .mockResolvedValueOnce(buildDetails())
      .mockImplementationOnce(() => threeYearDetailsPromise);
    getSummaryClientMock
      .mockImplementationOnce(() => threeYearSummaryPromise)
      .mockResolvedValueOnce(buildSummary());

    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary()}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("chart-points")).toHaveTextContent("1");
    });

    await act(async () => {
      screen.getByRole("button", { name: "Switch 3Y" }).click();
    });

    await act(async () => {
      screen.getByRole("button", { name: "Switch YTD" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("period")).toHaveTextContent("YTD");
      expect(screen.getByTestId("return")).toHaveTextContent(DEFAULT_PORTFOLIO_RETURN);
    });

    await act(async () => {
      resolveThreeYearSummary?.(
        buildSummary({
          period: "3Y",
          report_start_date: "2023-03-28",
          net_performance: {
            ...buildSummary().net_performance,
            portfolio_return_pct: 18.4,
          },
        })
      );
      resolveThreeYearDetails?.(
        buildDetails({
          period: "3Y",
          report_start_date: "2023-03-28",
        })
      );
      await Promise.all([threeYearSummaryPromise, threeYearDetailsPromise]);
    });

    expect(screen.getByTestId("period")).toHaveTextContent("YTD");
    expect(screen.getByTestId("return")).toHaveTextContent(DEFAULT_PORTFOLIO_RETURN);
    expect(screen.getByTestId("refresh-kind")).toHaveTextContent("none");
  });

  it("refreshes only the details contract for analytic-only control changes", async () => {
    getDetailsClientMock
      .mockResolvedValueOnce(buildDetails())
      .mockResolvedValueOnce(
        buildDetails({
          contribution_dimension: "sector",
          segment: "sector",
        })
      );

    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary()}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("chart-points")).toHaveTextContent("1");
    });

    await act(async () => {
      screen.getByRole("button", { name: "Switch Contribution Segment" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("details-pending")).toHaveTextContent("false");
    });

    expect(getSummaryClientMock).not.toHaveBeenCalled();
    expect(getDetailsClientMock).toHaveBeenCalledTimes(2);
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("preserves the previous analytical canvas while new details are loading", async () => {
    let resolveThreeYearSummary:
      | ((value: WorkbenchPerformanceWorkspaceSummary) => void)
      | null = null;
    let resolveThreeYearDetails:
      | ((value: WorkbenchPerformanceWorkspaceDetails) => void)
      | null = null;

    const threeYearSummaryPromise = new Promise<WorkbenchPerformanceWorkspaceSummary>((resolve) => {
      resolveThreeYearSummary = resolve;
    });
    const threeYearDetailsPromise = new Promise<WorkbenchPerformanceWorkspaceDetails>((resolve) => {
      resolveThreeYearDetails = resolve;
    });

    getDetailsClientMock
      .mockResolvedValueOnce(buildDetails())
      .mockImplementationOnce(() => threeYearDetailsPromise);
    getSummaryClientMock.mockImplementationOnce(() => threeYearSummaryPromise);

    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary()}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("chart-points")).toHaveTextContent("1");
    });

    await act(async () => {
      screen.getByRole("button", { name: "Switch 3Y" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("period")).toHaveTextContent("YTD");
      expect(screen.getByTestId("return")).toHaveTextContent(DEFAULT_PORTFOLIO_RETURN);
      expect(screen.getByTestId("chart-points")).toHaveTextContent("1");
      expect(screen.getByTestId("details-pending")).toHaveTextContent("true");
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("pending");
      expect(screen.getByTestId("refresh-requested")).toHaveTextContent("3Y");
      expect(screen.getByTestId("refresh-confirmed")).toHaveTextContent("YTD");
    });

    await act(async () => {
      screen.getByRole("button", { name: "Switch 3Y" }).click();
    });
    expect(getSummaryClientMock).toHaveBeenCalledTimes(1);
    expect(getDetailsClientMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveThreeYearSummary?.(
        buildSummary({
          period: "3Y",
          report_start_date: "2023-03-28",
          net_performance: {
            ...buildSummary().net_performance,
            portfolio_return_pct: 18.4,
          },
        })
      );
      resolveThreeYearDetails?.(
        buildDetails({
          period: "3Y",
          report_start_date: "2023-03-28",
          net_chart: [
            {
              ...buildDetails().net_chart[0],
              label: "2026-03",
              cumulative_portfolio_return_pct: 18.4,
            },
          ],
        })
      );
      await Promise.all([threeYearSummaryPromise, threeYearDetailsPromise]);
    });

    await waitFor(() => {
      expect(screen.getByTestId("return")).toHaveTextContent("18.4");
      expect(screen.getByTestId("details-pending")).toHaveTextContent("false");
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("confirmed");
      expect(screen.getByTestId("refresh-confirmed")).toHaveTextContent("3Y");
    });

    await act(async () => {
      screen.getByRole("button", { name: "Switch Analysis Mode" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("mode")).toHaveTextContent("analysis");
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("none");
    });
  });

  it("retains source-confirmed summary labels after a rejected selection and commits a successful retry atomically", async () => {
    const failedRequest = Object.assign(new Error("Performance summary unavailable"), {
      status: 503,
    });
    const threeYearSummary = buildSummary({
      period: "3Y",
      report_start_date: "2023-03-28",
      net_performance: {
        ...buildSummary().net_performance,
        portfolio_return_pct: 18.4,
      },
    });
    const threeYearDetails = buildDetails({
      period: "3Y",
      report_start_date: "2023-03-28",
      net_chart: [
        {
          ...buildDetails().net_chart[0],
          label: "2026-03",
          cumulative_portfolio_return_pct: 18.4,
        },
      ],
    });

    getSummaryClientMock
      .mockRejectedValueOnce(failedRequest)
      .mockResolvedValueOnce(threeYearSummary);
    getDetailsClientMock.mockResolvedValueOnce(threeYearDetails);

    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary()}
        initialDetails={buildDetails()}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await act(async () => {
      screen.getByRole("button", { name: "Switch 3Y" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("failed");
      expect(screen.getByTestId("refresh-scope")).toHaveTextContent("summary");
      expect(screen.getByTestId("refresh-requested")).toHaveTextContent("3Y");
      expect(screen.getByTestId("refresh-confirmed")).toHaveTextContent("YTD");
      expect(screen.getByTestId("period")).toHaveTextContent("YTD");
      expect(screen.getByTestId("return")).toHaveTextContent(DEFAULT_PORTFOLIO_RETURN);
      expect(screen.getByTestId("details-pending")).toHaveTextContent("false");
    });
    expect(replaceMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();

    await act(async () => {
      screen.getByRole("button", { name: "Retry Selection" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("period")).toHaveTextContent("3Y");
      expect(screen.getByTestId("return")).toHaveTextContent("18.4");
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("confirmed");
      expect(screen.getByTestId("refresh-confirmed")).toHaveTextContent("3Y");
      expect(screen.getByTestId("details-pending")).toHaveTextContent("false");
    });
    expect(pushMock).toHaveBeenLastCalledWith(
      "/performance?portfolioId=PF_1001&period=3Y&detailBasis=NET&contributionDimension=asset_class&attributionDimension=asset_class&chartFrequency=monthly&benchmark=BMK_GLOBAL_BALANCED_60_40",
      { scroll: false }
    );
  });

  it("rejects and does not cache a summary that confirms a different period", async () => {
    const threeYearSummary = buildSummary({
      period: "3Y",
      report_start_date: "2023-03-28",
    });
    const threeYearDetails = buildDetails({
      period: "3Y",
      report_start_date: "2023-03-28",
    });
    getSummaryClientMock
      .mockResolvedValueOnce(buildSummary({ period: "YTD" }))
      .mockResolvedValueOnce(threeYearSummary);
    getDetailsClientMock.mockResolvedValueOnce(threeYearDetails);

    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary()}
        initialDetails={buildDetails()}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await act(async () => {
      screen.getByRole("button", { name: "Switch 3Y" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("failed");
      expect(screen.getByTestId("refresh-scope")).toHaveTextContent("summary");
      expect(screen.getByTestId("period")).toHaveTextContent("YTD");
    });
    expect(getDetailsClientMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();

    await act(async () => {
      screen.getByRole("button", { name: "Retry Selection" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("confirmed");
      expect(screen.getByTestId("period")).toHaveTextContent("3Y");
    });
    expect(getSummaryClientMock).toHaveBeenCalledTimes(2);
    expect(getDetailsClientMock).toHaveBeenCalledTimes(1);
  });

  it("keeps confirmed analytical detail after a rejected dimension change instead of loading forever", async () => {
    const failedRequest = Object.assign(new Error("Performance details unavailable"), {
      status: 502,
    });
    getDetailsClientMock
      .mockRejectedValueOnce(failedRequest)
      .mockResolvedValueOnce(
        buildDetails({
          contribution_dimension: "sector",
          segment: "sector",
        })
      );

    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary()}
        initialDetails={buildDetails()}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await act(async () => {
      screen.getByRole("button", { name: "Switch Contribution Segment" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("failed");
      expect(screen.getByTestId("refresh-scope")).toHaveTextContent("details");
      expect(screen.getByTestId("refresh-requested")).toHaveTextContent(
        "Sector contribution"
      );
      expect(screen.getByTestId("details-pending")).toHaveTextContent("false");
      expect(screen.getByTestId("chart-points")).toHaveTextContent("1");
    });
    expect(getSummaryClientMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();

    await act(async () => {
      screen.getByRole("button", { name: "Retry Selection" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("confirmed");
      expect(screen.getByTestId("refresh-requested")).toHaveTextContent("Sector contribution");
      expect(screen.getByTestId("refresh-confirmed")).toHaveTextContent("Sector contribution");
      expect(screen.getByTestId("details-pending")).toHaveTextContent("false");
    });
    expect(getDetailsClientMock).toHaveBeenCalledTimes(2);
    expect(pushMock).toHaveBeenLastCalledWith(
      "/performance?portfolioId=PF_1001&period=YTD&detailBasis=NET&contributionDimension=sector&attributionDimension=asset_class&chartFrequency=monthly&benchmark=BMK_GLOBAL_BALANCED_60_40",
      { scroll: false }
    );
  });

  it("distinguishes an advisor request from the source-normalized analytical context", async () => {
    getDetailsClientMock.mockResolvedValueOnce(
      buildDetails({
        contribution_dimension: "asset_class",
        requested_contribution_dimension_supported: false,
      })
    );

    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary()}
        initialDetails={buildDetails()}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await act(async () => {
      screen.getByRole("button", { name: "Switch Contribution Segment" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("confirmed");
      expect(screen.getByTestId("refresh-requested")).toHaveTextContent("Sector contribution");
      expect(screen.getByTestId("refresh-confirmed")).toHaveTextContent(
        "Asset Class contribution"
      );
    });
    expect(pushMock).toHaveBeenLastCalledWith(
      "/performance?portfolioId=PF_1001&period=YTD&detailBasis=NET&contributionDimension=asset_class&attributionDimension=asset_class&chartFrequency=monthly&benchmark=BMK_GLOBAL_BALANCED_60_40",
      { scroll: false }
    );
  });

  it("keeps the latest workspace mode in the URL when a slow refresh completes", async () => {
    let resolveThreeYearSummary:
      | ((value: WorkbenchPerformanceWorkspaceSummary) => void)
      | null = null;
    let resolveThreeYearDetails:
      | ((value: WorkbenchPerformanceWorkspaceDetails) => void)
      | null = null;
    const threeYearSummaryPromise = new Promise<WorkbenchPerformanceWorkspaceSummary>((resolve) => {
      resolveThreeYearSummary = resolve;
    });
    const threeYearDetailsPromise = new Promise<WorkbenchPerformanceWorkspaceDetails>((resolve) => {
      resolveThreeYearDetails = resolve;
    });
    getSummaryClientMock.mockImplementationOnce(() => threeYearSummaryPromise);
    getDetailsClientMock.mockImplementationOnce(() => threeYearDetailsPromise);

    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary()}
        initialDetails={buildDetails()}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await act(async () => {
      screen.getByRole("button", { name: "Switch 3Y" }).click();
      screen.getByRole("button", { name: "Switch Analysis Mode" }).click();
    });

    await act(async () => {
      resolveThreeYearSummary?.(
        buildSummary({
          period: "3Y",
          report_start_date: "2023-03-28",
        })
      );
      resolveThreeYearDetails?.(
        buildDetails({
          period: "3Y",
          report_start_date: "2023-03-28",
        })
      );
      await Promise.all([threeYearSummaryPromise, threeYearDetailsPromise]);
    });

    await waitFor(() => {
      expect(screen.getByTestId("mode")).toHaveTextContent("analysis");
      expect(screen.getByTestId("period")).toHaveTextContent("3Y");
    });
    expect(pushMock).toHaveBeenLastCalledWith(
      "/performance?portfolioId=PF_1001&period=3Y&mode=analysis&detailBasis=NET&contributionDimension=asset_class&attributionDimension=asset_class&chartFrequency=monthly&benchmark=BMK_GLOBAL_BALANCED_60_40",
      { scroll: false }
    );
  });

  it("fails closed when a refreshed performance selection becomes permission-blocked", async () => {
    getSummaryClientMock.mockRejectedValueOnce(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );

    const result = render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary()}
        initialDetails={buildDetails()}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await act(async () => {
      screen.getByRole("button", { name: "Switch 3Y" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("return")).toHaveTextContent("none");
      expect(screen.getByTestId("load-issue")).toHaveTextContent("permission_blocked");
      expect(screen.getByTestId("refresh-kind")).toHaveTextContent("none");
      expect(
        result.queryClient.getQueryData(
          performanceWorkspaceSummaryQueryOptions(defaultQueryContext).queryKey,
        ),
      ).toBeUndefined();
      expect(
        result.queryClient.getQueryData(
          performanceWorkspaceDetailsQueryOptions(
            defaultQueryContext,
            buildSummary(),
          ).queryKey,
        ),
      ).toBeUndefined();
    });

    const restoredSummary = buildSummary({
      period: "3Y",
      report_start_date: "2023-03-28",
      net_performance: {
        ...buildSummary().net_performance,
        portfolio_return_pct: 18.4,
      },
    });
    result.rerender(
      <PerformanceWorkspaceClient
        {...buildDefaultClientProps(
          restoredSummary,
          buildDetails({ period: "3Y", report_start_date: "2023-03-28" }),
        )}
        initialPeriod="3Y"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("load-issue")).toHaveTextContent("none");
      expect(screen.getByTestId("period")).toHaveTextContent("3Y");
      expect(screen.getByTestId("return")).toHaveTextContent("18.4");
    });
    expect(
      result.queryClient.getQueryData(
        performanceWorkspaceSummaryQueryOptions({
          ...defaultQueryContext,
          period: "3Y",
        }).queryKey,
      ),
    ).toBe(restoredSummary);
  });

  it("updates the route immediately for mode switches without refetching summary or details", async () => {
    render(
      <PerformanceWorkspaceClient
        initialSummary={buildSummary()}
        initialDetails={buildDetails()}
        initialPortfolioId="PF_1001"
        initialPeriod="YTD"
        initialDetailBasis="NET"
        initialContributionDimension="asset_class"
        initialAttributionDimension="asset_class"
        initialChartFrequency="monthly"
        initialBenchmark="BMK_GLOBAL_BALANCED_60_40"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("mode")).toHaveTextContent("summary");
      expect(screen.getByTestId("details-pending")).toHaveTextContent("false");
    });

    await act(async () => {
      screen.getByRole("button", { name: "Switch Analysis Mode" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("mode")).toHaveTextContent("analysis");
    });

    expect(pushMock).toHaveBeenLastCalledWith(
      "/performance?portfolioId=PF_1001&period=YTD&mode=analysis&detailBasis=NET&contributionDimension=asset_class&attributionDimension=asset_class&chartFrequency=monthly&benchmark=BMK_GLOBAL_BALANCED_60_40",
      { scroll: false }
    );
    expect(getSummaryClientMock).not.toHaveBeenCalled();
    expect(getDetailsClientMock).not.toHaveBeenCalled();

    await act(async () => {
      screen.getByRole("button", { name: "Switch Risk Mode" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("mode")).toHaveTextContent("risk");
    });

    expect(pushMock).toHaveBeenLastCalledWith(
      "/performance?portfolioId=PF_1001&period=YTD&mode=risk&detailBasis=NET&contributionDimension=asset_class&attributionDimension=asset_class&chartFrequency=monthly&benchmark=BMK_GLOBAL_BALANCED_60_40",
      { scroll: false }
    );
    expect(getSummaryClientMock).not.toHaveBeenCalled();
    expect(getDetailsClientMock).not.toHaveBeenCalled();
  });
});
