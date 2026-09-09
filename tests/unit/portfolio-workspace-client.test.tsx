import React, { StrictMode } from "react";
import {
  act,
  render as testingLibraryRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PortfolioWorkspace } from "../../src/apps/portfolio/types";
import PortfolioWorkspaceClient from "../../src/apps/portfolio/components/portfolio-workspace-client";
import {
  buildPortfolioWorkspaceSourceGeneration,
  portfolioQueryKeys,
} from "../../src/apps/portfolio/portfolio-query-keys";
import { buildInitialPortfolioControls } from "../../src/apps/portfolio/view-model";
import {
  getAnalyticsUiMetricEvents,
  resetAnalyticsUiMetricEvents,
} from "../../src/features/analytics-observability/metrics";
import {
  workbenchQueryDefaults,
  workbenchStrictQueryDefaults,
} from "../../src/features/platform-runtime/query-policy";

const getSummaryDetailsMock = vi.fn();
const getShellWorkspaceMock = vi.fn();
const routerPushMock = vi.fn();
const routerReplaceMock = vi.fn();

function render(
  ui: React.ReactNode,
  queryClient = new QueryClient({
    defaultOptions: {
      queries: workbenchStrictQueryDefaults,
    },
  }),
) {
  return {
    ...testingLibraryRender(ui, {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    }),
    queryClient,
  };
}

function workspaceQueryKey(
  workspace: PortfolioWorkspace | null,
  portfolioId = "MANUAL_PB_USD_001",
) {
  return portfolioQueryKeys.workspaceSource(
    portfolioId,
    buildPortfolioWorkspaceSourceGeneration(portfolioId, workspace),
  );
}

vi.mock("next/navigation", () => ({
  usePathname: () => "/portfolio",
  useRouter: () => ({ push: routerPushMock, replace: routerReplaceMock }),
  useSearchParams: () =>
    new URLSearchParams("portfolioId=MANUAL_PB_USD_001&period=30D"),
}));

vi.mock("../../src/apps/portfolio/api", () => ({
  getPortfolioWorkspaceShell: (...args: unknown[]) =>
    getShellWorkspaceMock(...args),
  getPortfolioWorkspaceSummaryDetails: (...args: unknown[]) =>
    getSummaryDetailsMock(...args),
  mergePortfolioWorkspace: (
    current: PortfolioWorkspace,
    details: Partial<PortfolioWorkspace>,
  ) => ({ ...current, ...details }),
}));

vi.mock(
  "../../src/apps/portfolio/components/portfolio-workspace-toolbar",
  () => ({
    default: ({
      controls,
      onControlsChange,
      sourceReceipt,
    }: {
      controls: {
        viewMode: "summary" | "detailed";
        timeWindow: "30D" | "YTD" | "1Y";
        asOfDate: string;
        reportingCurrency: string;
      };
      onControlsChange: (patch: {
        viewMode?: "summary" | "detailed";
        timeWindow?: "30D" | "YTD" | "1Y";
      }) => void;
      sourceReceipt?: {
        checkedAt: number | null;
        isRefreshing: boolean;
        onRefresh: () => Promise<unknown>;
        announcement?: string;
      };
    }) => (
      <div>
        <div data-testid="view-mode">{controls.viewMode}</div>
        <div data-testid="time-window">{controls.timeWindow}</div>
        <div data-testid="as-of-date">{controls.asOfDate}</div>
        <div data-testid="reporting-currency">{controls.reportingCurrency}</div>
        <div data-testid="source-checked-at">
          {sourceReceipt?.checkedAt ?? "unavailable"}
        </div>
        <button
          type="button"
          disabled={sourceReceipt?.isRefreshing}
          onClick={() => void sourceReceipt?.onRefresh()}
        >
          Recheck portfolio
        </button>
        {sourceReceipt?.announcement ? (
          <div role="status">{sourceReceipt.announcement}</div>
        ) : null}
        <button
          type="button"
          onClick={() => onControlsChange({ viewMode: "detailed" })}
        >
          Switch Detailed
        </button>
        <button
          type="button"
          onClick={() => onControlsChange({ timeWindow: "YTD" })}
        >
          Select YTD
        </button>
        <button
          type="button"
          onClick={() => onControlsChange({ timeWindow: "1Y" })}
        >
          Select 1Y
        </button>
      </div>
    ),
  }),
);

vi.mock("../../src/apps/portfolio/components/portfolio-workspace", () => ({
  default: ({
    toolbar,
    workspace,
    workspaceStatus,
  }: {
    toolbar?: React.ReactNode;
    workspace: PortfolioWorkspace | null;
    workspaceStatus?: "loading" | "ready" | "unavailable";
  }) => (
    <div>
      {toolbar}
      <div data-testid="shell-status">{workspaceStatus}</div>
      <div data-testid="portfolio-id">
        {workspace?.portfolio?.portfolio_id ?? "none"}
      </div>
      <div data-testid="market-value">
        {workspace?.summary?.market_value_base ?? "none"}
      </div>
      <div data-testid="position-count">
        {workspace?.positions.length ?? "none"}
      </div>
      <div data-testid="insight-key">
        {workspace?.insights?.[0]?.key ?? "none"}
      </div>
      <div data-testid="exception-key">
        {workspace?.exception_summaries?.[0]?.key ?? "none"}
      </div>
      <div data-testid="workflow-action">
        {workspace?.workflow_actions?.[0]?.title ?? "none"}
      </div>
    </div>
  ),
}));

function buildWorkspace(portfolioId = "MANUAL_PB_USD_001"): PortfolioWorkspace {
  return {
    as_of_date: "2026-03-28",
    portfolio: {
      portfolio_id: portfolioId,
      display_name: portfolioId,
      client_id: `CLIENT_${portfolioId}`,
      base_currency: "USD",
      booking_center_code: "Singapore",
    },
    profile: {
      status: "ACTIVE",
      portfolio_type: "Advisory",
      risk_exposure: "Moderate Growth",
      investment_time_horizon: "Long Term",
      objective: "Long-term capital appreciation.",
      is_leverage_allowed: false,
    },
    summary: {
      market_value_base: 1001550.05,
      invested_market_value_base: 917032.95,
      total_cash_base: 84517.1,
      cash_weight_pct: 8.43863,
      position_count: 9,
      cash_balance_count: 2,
    },
    allocations: [],
    allocation_views: [],
    cash_balances: [],
    top_positions: [],
    positions: [],
    recent_transactions: [],
    income_summary: null,
    activity_summary: null,
    cashflow_outlook: null,
    performance: null,
    rebalance: null,
    readiness: {
      has_positions: true,
      reporting: { status: "READY", generated_at_utc: null, row_count: 4 },
    },
    readiness_indicators: undefined,
    exception_summaries: undefined,
    insights: undefined,
    operations: null,
    workflow_cues: [],
    workflow_actions: undefined,
    warnings: [],
    partial_failures: [],
  };
}

function confirmedDetails<Details extends Record<string, unknown>>(
  details: Details,
  portfolioId = "MANUAL_PB_USD_001",
): Details & { portfolio: PortfolioWorkspace["portfolio"] } {
  return {
    portfolio: buildWorkspace(portfolioId).portfolio,
    ...details,
  };
}

describe("PortfolioWorkspaceClient", () => {
  afterEach(() => {
    onlineManager.setOnline(true);
    getShellWorkspaceMock.mockReset();
    getSummaryDetailsMock.mockReset();
    routerPushMock.mockReset();
    resetAnalyticsUiMetricEvents();
    window.localStorage.clear();
  });

  it("shows the oldest admitted receipt and rechecks both exact Portfolio sources", async () => {
    const workspace = buildWorkspace();
    getSummaryDetailsMock.mockResolvedValue(
      confirmedDetails({
        as_of_date: workspace.as_of_date,
        positions: [],
      }),
    );
    getShellWorkspaceMock.mockResolvedValue(workspace);

    render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={workspace}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("source-checked-at")).not.toHaveTextContent(
        "unavailable",
      ),
    );
    const firstCheckedAt = Number(screen.getByTestId("source-checked-at").textContent);
    expect(firstCheckedAt).toBeGreaterThan(0);
    expect(getShellWorkspaceMock).not.toHaveBeenCalled();

    await act(async () => {
      screen.getByRole("button", { name: "Recheck portfolio" }).click();
    });

    await waitFor(() => expect(getShellWorkspaceMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Portfolio evidence rechecked.",
    );
    expect(
      Number(screen.getByTestId("source-checked-at").textContent),
    ).toBeGreaterThanOrEqual(firstCheckedAt);
  });

  it("does not claim a successful recheck when one current source fails", async () => {
    const workspace = buildWorkspace();
    getSummaryDetailsMock
      .mockResolvedValueOnce(
        confirmedDetails({
          as_of_date: workspace.as_of_date,
          positions: [],
        }),
      )
      .mockResolvedValueOnce(null);
    getShellWorkspaceMock.mockResolvedValue(workspace);

    render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={workspace}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("source-checked-at")).not.toHaveTextContent(
        "unavailable",
      ),
    );
    await act(async () => {
      screen.getByRole("button", { name: "Recheck portfolio" }).click();
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Portfolio detail could not be refreshed",
    );
    expect(screen.queryByText("Portfolio evidence rechecked.")).not.toBeInTheDocument();
    expect(getShellWorkspaceMock).toHaveBeenCalledTimes(1);
    expect(getSummaryDetailsMock).toHaveBeenCalledTimes(2);
  });

  it("commits a review period and URL only after source detail is confirmed", async () => {
    getSummaryDetailsMock.mockResolvedValue({ positions: [] });
    render(
      <PortfolioWorkspaceClient
        portfolios={[
          {
            portfolio_id: "MANUAL_PB_USD_001",
            display_name: "Manual portfolio",
            base_currency: "USD",
            client_id: "MANUAL_CIF_001",
            booking_center_code: "Singapore",
          },
        ]}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={buildWorkspace()}
      />,
    );
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1));
    routerPushMock.mockReset();

    let confirmDetails:
      ((value: Partial<PortfolioWorkspace>) => void) | undefined;
    getSummaryDetailsMock.mockReturnValueOnce(
      new Promise((resolve) => {
        confirmDetails = resolve;
      }),
    );
    await act(async () => {
      screen.getByRole("button", { name: "Select YTD" }).click();
    });

    expect(screen.getByTestId("time-window")).toHaveTextContent("30D");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Confirming review context",
    );
    expect(routerPushMock).not.toHaveBeenCalled();

    await act(async () => {
      confirmDetails?.(
        confirmedDetails({ as_of_date: "2026-03-28", positions: [] }),
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("time-window")).toHaveTextContent("YTD");
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Review context confirmed",
    );
    expect(routerPushMock).toHaveBeenCalledWith(
      "/portfolio?portfolioId=MANUAL_PB_USD_001&asOfDate=2026-03-28&period=YTD&reportingCurrency=USD",
      { scroll: false },
    );
  });

  it("keeps the confirmed context and commits only after a successful retry", async () => {
    getSummaryDetailsMock
      .mockResolvedValueOnce({ positions: [] })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        confirmedDetails({
          as_of_date: "2026-03-28",
          positions: [],
        }),
      );
    render(
      <PortfolioWorkspaceClient
        portfolios={[
          {
            portfolio_id: "MANUAL_PB_USD_001",
            display_name: "Manual portfolio",
            base_currency: "USD",
            client_id: "MANUAL_CIF_001",
            booking_center_code: "Singapore",
          },
        ]}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={buildWorkspace()}
      />,
    );
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      screen.getByRole("button", { name: "Select YTD" }).click();
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Review context was not changed",
    );
    expect(screen.getByTestId("time-window")).toHaveTextContent("30D");
    const retry = screen.getByRole("button", {
      name: "Retry portfolio review context",
    });
    expect(retry).toBeEnabled();
    expect(routerPushMock).not.toHaveBeenCalled();

    await act(async () => {
      retry.click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("time-window")).toHaveTextContent("YTD");
    });
    expect(routerPushMock).toHaveBeenCalledTimes(1);
  });

  it("commits only the latest review-context request", async () => {
    getSummaryDetailsMock.mockResolvedValueOnce({ positions: [] });
    render(
      <PortfolioWorkspaceClient
        portfolios={[
          {
            portfolio_id: "MANUAL_PB_USD_001",
            display_name: "Manual portfolio",
            base_currency: "USD",
            client_id: "MANUAL_CIF_001",
            booking_center_code: "Singapore",
          },
        ]}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={buildWorkspace()}
      />,
    );
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1));

    let confirmYtd: ((value: Partial<PortfolioWorkspace>) => void) | undefined;
    let confirmOneYear:
      ((value: Partial<PortfolioWorkspace>) => void) | undefined;
    getSummaryDetailsMock
      .mockReturnValueOnce(
        new Promise((resolve) => {
          confirmYtd = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          confirmOneYear = resolve;
        }),
      );

    await act(async () => {
      screen.getByRole("button", { name: "Select YTD" }).click();
    });
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(2));
    await act(async () => {
      screen.getByRole("button", { name: "Select 1Y" }).click();
    });
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(3));
    await act(async () => {
      confirmOneYear?.(
        confirmedDetails({ as_of_date: "2026-03-28", positions: [] }),
      );
    });
    await waitFor(() =>
      expect(screen.getByTestId("time-window")).toHaveTextContent("1Y"),
    );

    await act(async () => {
      confirmYtd?.(
        confirmedDetails({ as_of_date: "2026-03-28", positions: [] }),
      );
    });
    expect(screen.getByTestId("time-window")).toHaveTextContent("1Y");
    expect(routerPushMock).toHaveBeenCalledTimes(1);
    expect(routerPushMock).toHaveBeenCalledWith(
      expect.stringContaining("period=1Y"),
      { scroll: false },
    );
  });

  it("cancels a pending context confirmation when the workspace is handed off", async () => {
    getSummaryDetailsMock.mockResolvedValueOnce({ positions: [] });
    const visit = render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={buildWorkspace()}
      />,
    );
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1));

    let completeConfirmation:
      ((value: Partial<PortfolioWorkspace>) => void) | undefined;
    getSummaryDetailsMock.mockReturnValueOnce(
      new Promise((resolve) => {
        completeConfirmation = resolve;
      }),
    );
    await act(async () => {
      screen.getByRole("button", { name: "Select YTD" }).click();
    });
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(2));

    visit.unmount();
    await act(async () => {
      completeConfirmation?.(
        confirmedDetails({ as_of_date: "2026-03-28", positions: [] }),
      );
      await Promise.resolve();
    });

    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it("rejects control confirmation completed against an older shell generation", async () => {
    getSummaryDetailsMock.mockResolvedValueOnce({ positions: [] });
    const { queryClient } = render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={buildWorkspace()}
      />,
    );
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1));
    routerPushMock.mockReset();

    let confirmOldGeneration:
      ((value: Partial<PortfolioWorkspace>) => void) | undefined;
    getSummaryDetailsMock
      .mockReturnValueOnce(
        new Promise((resolve) => {
          confirmOldGeneration = resolve;
        }),
      )
      .mockResolvedValue(
        confirmedDetails({
          as_of_date: "2026-03-28",
          positions: [],
        }),
      );

    await act(async () => {
      screen.getByRole("button", { name: "Select YTD" }).click();
    });
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(2));

    const refreshedShell = {
      ...buildWorkspace(),
      summary: {
        ...buildWorkspace().summary,
        market_value_base: 2000000.25,
      },
    } satisfies PortfolioWorkspace;
    await act(async () => {
      queryClient.setQueryData(
        workspaceQueryKey(buildWorkspace()),
        refreshedShell,
      );
    });
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(3));

    await act(async () => {
      confirmOldGeneration?.(
        confirmedDetails({ as_of_date: "2026-03-28", positions: [] }),
      );
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Review context was not changed",
    );
    expect(screen.getByTestId("time-window")).toHaveTextContent("30D");
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it("does not commit an in-flight control request after portfolio identity changes", async () => {
    getSummaryDetailsMock.mockResolvedValueOnce({ positions: [] });
    const firstWorkspace = buildWorkspace("MANUAL_PB_USD_001");
    const { rerender } = render(
      <PortfolioWorkspaceClient
        portfolios={[
          {
            portfolio_id: "MANUAL_PB_USD_001",
            display_name: "First portfolio",
            base_currency: "USD",
            client_id: "MANUAL_CIF_001",
            booking_center_code: "Singapore",
          },
        ]}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={firstWorkspace}
      />,
    );
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1));

    let confirmFirstPortfolio:
      ((value: Partial<PortfolioWorkspace>) => void) | undefined;
    getSummaryDetailsMock.mockReturnValueOnce(
      new Promise((resolve) => {
        confirmFirstPortfolio = resolve;
      }),
    );
    await act(async () => {
      screen.getByRole("button", { name: "Select YTD" }).click();
    });

    const secondWorkspace = buildWorkspace("MANUAL_PB_USD_002");
    getSummaryDetailsMock.mockResolvedValueOnce({ positions: [] });
    rerender(
      <PortfolioWorkspaceClient
        portfolios={[
          {
            portfolio_id: "MANUAL_PB_USD_002",
            display_name: "Second portfolio",
            base_currency: "USD",
            client_id: "MANUAL_CIF_002",
            booking_center_code: "Singapore",
          },
        ]}
        selectedPortfolioId="MANUAL_PB_USD_002"
        initialWorkspace={secondWorkspace}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("portfolio-id")).toHaveTextContent(
        "MANUAL_PB_USD_002",
      );
    });

    await act(async () => {
      confirmFirstPortfolio?.(
        confirmedDetails({
          as_of_date: "2026-03-28",
          positions: [],
        }),
      );
    });

    expect(screen.getByTestId("portfolio-id")).toHaveTextContent(
      "MANUAL_PB_USD_002",
    );
    expect(screen.getByTestId("time-window")).toHaveTextContent("30D");
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it("does not duplicate summary fetches in strict mode and preserves explicit detail changes", async () => {
    getShellWorkspaceMock.mockResolvedValue(buildWorkspace());
    getSummaryDetailsMock.mockResolvedValue(
      confirmedDetails({
        positions: [{ security_id: "EQ_1" }],
        top_positions: [],
        allocations: [],
        allocation_views: [],
        income_summary: null,
        activity_summary: null,
      }),
    );
    render(
      <StrictMode>
        <PortfolioWorkspaceClient
          portfolios={[
            {
              portfolio_id: "MANUAL_PB_USD_001",
              display_name: "MANUAL_PB_USD_001",
              base_currency: "USD",
              client_id: "MANUAL_CIF_001",
              booking_center_code: "Singapore",
            },
          ]}
          selectedPortfolioId="MANUAL_PB_USD_001"
          initialWorkspace={buildWorkspace()}
        />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("portfolio-id")).toHaveTextContent(
        "MANUAL_PB_USD_001",
      );
    });

    expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1);
    expect(getSummaryDetailsMock).toHaveBeenCalledWith(
      "MANUAL_PB_USD_001",
      {
        asOfDate: "2026-03-28",
        reportingCurrency: "USD",
        includeProjected: false,
        timeWindow: "30D",
        reportStartDate: "2026-02-26",
        reportEndDate: "2026-03-28",
        usesCustomDateRange: false,
      },
      expect.objectContaining({ signal: expect.any(Object) }),
    );

    await act(async () => {
      screen.getByRole("button", { name: "Switch Detailed" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("view-mode")).toHaveTextContent("detailed");
    });

    expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1);
  });

  it("reuses fresh Portfolio detail truth when the workspace is revisited", async () => {
    getSummaryDetailsMock.mockResolvedValue(
      confirmedDetails({
        as_of_date: "2026-03-28",
        positions: [{ security_id: "EQ_1" }],
      }),
    );
    const portfolio = {
      portfolio_id: "MANUAL_PB_USD_001",
      display_name: "MANUAL_PB_USD_001",
      base_currency: "USD",
      client_id: "MANUAL_CIF_001",
      booking_center_code: "Singapore",
    };
    const firstVisit = render(
      <PortfolioWorkspaceClient
        portfolios={[portfolio]}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={buildWorkspace()}
      />,
    );
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1));
    firstVisit.unmount();

    render(
      <PortfolioWorkspaceClient
        portfolios={[portfolio]}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={buildWorkspace()}
      />,
      firstVisit.queryClient,
    );

    await waitFor(() => {
      expect(screen.getByTestId("position-count")).toHaveTextContent("1");
    });
    expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1);
  });

  it("promotes a newer server shell over cached Portfolio truth on revisit", async () => {
    getSummaryDetailsMock.mockResolvedValue(
      confirmedDetails({ as_of_date: "2026-03-28", positions: [] }),
    );
    const portfolio = buildPortfolioCatalog("MANUAL_PB_USD_001")[0]!;
    const firstVisit = render(
      <PortfolioWorkspaceClient
        portfolios={[portfolio]}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={buildWorkspace()}
      />,
    );
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1));
    firstVisit.unmount();

    const newerServerWorkspace = {
      ...buildWorkspace(),
      as_of_date: "2026-03-29",
      summary: {
        ...buildWorkspace().summary,
        market_value_base: 2000000.25,
      },
    } satisfies PortfolioWorkspace;
    render(
      <PortfolioWorkspaceClient
        portfolios={[portfolio]}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={newerServerWorkspace}
      />,
      firstVisit.queryClient,
    );

    await waitFor(() => {
      expect(screen.getByTestId("market-value")).toHaveTextContent(
        "2000000.25",
      );
    });
    expect(screen.getByTestId("review-context-strip")).toHaveTextContent(
      "29 Mar 2026",
    );
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(2));
  });

  it("retains a cached Portfolio overview and exposes a failed stale shell refresh", async () => {
    const portfolio = {
      portfolio_id: "MANUAL_PB_USD_001",
      display_name: "MANUAL_PB_USD_001",
      base_currency: "USD",
      client_id: "MANUAL_CIF_001",
      booking_center_code: "Singapore",
    };
    const firstVisit = render(
      <PortfolioWorkspaceClient
        portfolios={[portfolio]}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={buildWorkspace()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("portfolio-id")).toHaveTextContent(
        "MANUAL_PB_USD_001",
      );
    });
    firstVisit.unmount();
    let failRecovery: ((value: null) => void) | undefined;
    getShellWorkspaceMock.mockReturnValueOnce(
      new Promise((resolve) => {
        failRecovery = resolve;
      }),
    );
    getSummaryDetailsMock.mockImplementation(
      (_portfolioId: string, params: { asOfDate?: string }) =>
        Promise.resolve(
          confirmedDetails({
            as_of_date: params.asOfDate,
            positions: [],
          }),
        ),
    );
    onlineManager.setOnline(false);

    render(
      <PortfolioWorkspaceClient
        portfolios={[portfolio]}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={null}
      />,
      firstVisit.queryClient,
    );

    expect(
      await screen.findByText("Confirming current portfolio overview"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("shell-status")).toHaveTextContent("loading");
    expect(screen.getByTestId("market-value")).toHaveTextContent("none");
    expect(getShellWorkspaceMock).not.toHaveBeenCalled();

    onlineManager.setOnline(true);
    await waitFor(() => {
      expect(getShellWorkspaceMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      failRecovery?.(null);
    });

    await waitFor(() => {
      expect(
        firstVisit.queryClient.getQueryState(workspaceQueryKey(null))?.status,
      ).toBe("error");
    });
    await waitFor(() => {
      expect(screen.getByTestId("shell-status")).toHaveTextContent("ready");
    });
    expect(screen.getByTestId("portfolio-id")).toHaveTextContent(
      "MANUAL_PB_USD_001",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Portfolio overview could not be refreshed",
    );
    expect(
      within(screen.getByRole("alert")).getByRole("button", {
        name: "Retry portfolio overview refresh",
      }),
    ).toBeEnabled();

    const refreshedWorkspace = {
      ...buildWorkspace(),
      as_of_date: "2026-03-29",
      summary: {
        ...buildWorkspace().summary,
        market_value_base: 2000000.25,
      },
      warnings: ["valuation_source_refreshed"],
    } satisfies PortfolioWorkspace;
    getShellWorkspaceMock.mockResolvedValueOnce(refreshedWorkspace);
    await act(async () => {
      within(screen.getByRole("alert"))
        .getByRole("button", { name: "Retry portfolio overview refresh" })
        .click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("market-value")).toHaveTextContent(
        "2000000.25",
      );
    });
    expect(screen.getByTestId("review-context-strip")).toHaveTextContent(
      "29 Mar 2026",
    );
    expect(
      firstVisit.queryClient.getQueryState(workspaceQueryKey(null))?.status,
    ).toBe("success");
    expect(
      screen.queryByText("Portfolio overview could not be refreshed"),
    ).not.toBeInTheDocument();
  });

  it("discloses when a scheduled Portfolio refresh is paused offline", async () => {
    const initialWorkspace = buildWorkspace();
    getSummaryDetailsMock.mockResolvedValue(
      confirmedDetails({
        as_of_date: initialWorkspace.as_of_date,
        positions: [],
      }),
    );
    const view = render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={initialWorkspace}
      />,
    );
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1));
    onlineManager.setOnline(false);

    await act(async () => {
      await view.queryClient.invalidateQueries({
        queryKey: workspaceQueryKey(initialWorkspace),
        exact: true,
      });
    });

    await waitFor(() => {
      expect(
        view.queryClient.getQueryState(workspaceQueryKey(initialWorkspace))
          ?.fetchStatus,
      ).toBe("paused");
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Portfolio refresh is waiting for connectivity",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "it may be out of date",
    );
    expect(screen.getByTestId("shell-status")).toHaveTextContent("ready");
    await waitFor(() => {
      expect(screen.getByTestId("market-value")).toHaveTextContent(
        "1001550.05",
      );
    });
    expect(getShellWorkspaceMock).not.toHaveBeenCalled();

    let resolveShellRefresh:
      ((value: PortfolioWorkspace | null) => void) | undefined;
    getShellWorkspaceMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveShellRefresh = resolve;
      }),
    );
    onlineManager.setOnline(true);

    await waitFor(() => expect(getShellWorkspaceMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Refreshing portfolio overview",
    );
    expect(screen.getByRole("status")).toHaveTextContent("prior evidence");
    expect(screen.getByTestId("market-value")).toHaveTextContent(
      "1001550.05",
    );

    await act(async () => {
      resolveShellRefresh?.(initialWorkspace);
    });
    await waitFor(() => {
      expect(
        screen.queryByText("Refreshing portfolio overview"),
      ).not.toBeInTheDocument();
    });
  });

  it("reconciles a same-generation server snapshot over retained Query error state", async () => {
    const initialWorkspace = buildWorkspace();
    const queryClient = new QueryClient({
      defaultOptions: { queries: workbenchStrictQueryDefaults },
    });
    const queryKey = workspaceQueryKey(initialWorkspace);
    const staleTimestamp = Date.now() - 60_000;
    queryClient.setQueryData(queryKey, initialWorkspace, {
      updatedAt: staleTimestamp,
    });
    await expect(
      queryClient.fetchQuery({
        queryKey,
        staleTime: 0,
        retry: false,
        queryFn: async () => {
          throw new Error("Earlier Gateway failure");
        },
      }),
    ).rejects.toThrow("Earlier Gateway failure");
    expect(queryClient.getQueryState(queryKey)?.status).toBe("error");
    getSummaryDetailsMock.mockResolvedValue(
      confirmedDetails({
        as_of_date: "2026-03-28",
        summary: initialWorkspace.summary,
        positions: [],
      }),
    );

    const view = render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={initialWorkspace}
      />,
      queryClient,
    );

    await waitFor(() => {
      expect(queryClient.getQueryState(queryKey)?.status).toBe("success");
    });
    expect(queryClient.getQueryState(queryKey)!.dataUpdatedAt).toBeGreaterThan(
      staleTimestamp,
    );
    await waitFor(() => {
      expect(screen.getByTestId("market-value")).toHaveTextContent(
        "1001550.05",
      );
    });
    expect(
      screen.queryByText("Portfolio overview could not be refreshed"),
    ).not.toBeInTheDocument();
    expect(getShellWorkspaceMock).not.toHaveBeenCalled();

    await expect(
      queryClient.fetchQuery({
        queryKey,
        staleTime: 0,
        retry: false,
        queryFn: async () => {
          throw new Error("Later Gateway failure");
        },
      }),
    ).rejects.toThrow("Later Gateway failure");
    expect(queryClient.getQueryState(queryKey)?.status).toBe("error");
    const refreshedServerSnapshot = { ...initialWorkspace };

    view.rerender(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={refreshedServerSnapshot}
      />,
    );

    await waitFor(() => {
      expect(queryClient.getQueryState(queryKey)?.status).toBe("success");
    });
    expect(queryClient.getQueryData(queryKey)).toBe(refreshedServerSnapshot);
    expect(
      screen.queryByText("Portfolio overview could not be refreshed"),
    ).not.toBeInTheDocument();
    expect(getShellWorkspaceMock).not.toHaveBeenCalled();
  });

  it("discloses when first Portfolio detail confirmation is paused offline", async () => {
    const initialWorkspace = buildWorkspace();
    getSummaryDetailsMock.mockResolvedValue(
      confirmedDetails({
        as_of_date: "2026-03-20",
        positions: [],
      }),
    );
    onlineManager.setOnline(false);

    render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={initialWorkspace}
        initialControls={{
          ...buildInitialPortfolioControls(initialWorkspace),
          asOfDate: "2026-03-20",
          timeWindow: "YTD",
        }}
      />,
    );

    expect(
      await screen.findByText("Portfolio detail is waiting for connectivity"),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Positions and analysis remain withheld",
    );
    expect(
      screen.queryByText("Confirming review context"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("shell-status")).toHaveTextContent("loading");
    expect(screen.getByTestId("market-value")).toHaveTextContent("none");
    expect(getSummaryDetailsMock).not.toHaveBeenCalled();

    onlineManager.setOnline(true);

    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.getByTestId("shell-status")).toHaveTextContent("ready");
    });
    expect(
      screen.queryByText("Portfolio detail is waiting for connectivity"),
    ).not.toBeInTheDocument();
  });

  it("discloses when a scheduled Portfolio detail refresh is paused offline", async () => {
    const initialWorkspace = buildWorkspace();
    const confirmedDetail = confirmedDetails({
      as_of_date: "2026-03-28",
      summary: {
        ...initialWorkspace.summary,
        market_value_base: 2000000.25,
      },
      positions: [{ security_id: "EQ_1" }],
    });
    let resolveDetailRefresh:
      ((value: typeof confirmedDetail | null) => void) | undefined;
    getSummaryDetailsMock
      .mockResolvedValueOnce(confirmedDetail)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveDetailRefresh = resolve;
        }),
      );
    const view = render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={initialWorkspace}
      />,
    );
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.getByTestId("market-value")).toHaveTextContent(
        "2000000.25",
      );
    });
    const summaryQuery = view.queryClient
      .getQueryCache()
      .findAll({
        queryKey: portfolioQueryKeys.summaryDetailsRoot(
          "MANUAL_PB_USD_001",
        ),
      })
      .find(
        (query) => query.getObserversCount() > 0 && query.state.data !== undefined,
      );
    expect(summaryQuery).toBeDefined();
    onlineManager.setOnline(false);

    await act(async () => {
      await view.queryClient.invalidateQueries({
        queryKey: summaryQuery!.queryKey,
        exact: true,
      });
    });

    await waitFor(() => {
      expect(
        view.queryClient.getQueryState(summaryQuery!.queryKey)?.fetchStatus,
      ).toBe("paused");
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Portfolio detail refresh is waiting for connectivity",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "they may be out of date",
    );
    expect(screen.getByTestId("shell-status")).toHaveTextContent("ready");
    expect(screen.getByTestId("market-value")).toHaveTextContent(
      "2000000.25",
    );
    expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1);

    onlineManager.setOnline(true);

    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Refreshing portfolio detail",
    );
    expect(screen.getByRole("status")).toHaveTextContent("prior evidence");
    expect(screen.getByTestId("market-value")).toHaveTextContent(
      "2000000.25",
    );

    await act(async () => {
      resolveDetailRefresh?.(confirmedDetail);
    });
    await waitFor(() => {
      expect(
        screen.queryByText("Refreshing portfolio detail"),
      ).not.toBeInTheDocument();
    });
  });

  it("keeps an overview refresh failure visible while detail refreshes", async () => {
    const initialWorkspace = buildWorkspace();
    const confirmedDetail = confirmedDetails({
      as_of_date: "2026-03-28",
      positions: [],
    });
    let resolveDetailRefresh:
      ((value: typeof confirmedDetail | null) => void) | undefined;
    getSummaryDetailsMock
      .mockResolvedValueOnce(confirmedDetail)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveDetailRefresh = resolve;
        }),
      );
    getShellWorkspaceMock
      .mockResolvedValueOnce(initialWorkspace)
      .mockResolvedValueOnce(null);
    const view = render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={null}
      />,
    );
    await waitFor(() => expect(getShellWorkspaceMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await view.queryClient.invalidateQueries({
        queryKey: workspaceQueryKey(initialWorkspace),
        exact: true,
      });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Portfolio overview could not be refreshed",
    );
    const detailQuery = view.queryClient
      .getQueryCache()
      .findAll({
        queryKey: portfolioQueryKeys.summaryDetailsRoot(
          "MANUAL_PB_USD_001",
        ),
      })
      .find((query) => query.getObserversCount() > 0);
    expect(detailQuery).toBeDefined();

    await act(async () => {
      void view.queryClient.invalidateQueries({
        queryKey: detailQuery!.queryKey,
        exact: true,
      });
    });
    await waitFor(() => {
      expect(
        view.queryClient.getQueryState(detailQuery!.queryKey)?.fetchStatus,
      ).toBe("fetching");
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Portfolio overview could not be refreshed",
    );
    expect(
      screen.queryByText("Refreshing portfolio detail"),
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveDetailRefresh?.(null);
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Portfolio overview and detail could not be refreshed",
    );
    const retryBoth = within(screen.getByRole("alert")).getByRole("button", {
      name: "Retry portfolio overview and detail refresh",
    });
    expect(retryBoth).toHaveTextContent("Retry both");

    getShellWorkspaceMock.mockResolvedValueOnce(initialWorkspace);
    getSummaryDetailsMock.mockResolvedValueOnce(confirmedDetail);
    await act(async () => {
      retryBoth.click();
    });
    await waitFor(() => expect(getShellWorkspaceMock).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(3));
    await waitFor(() => {
      expect(
        screen.queryByText(
          "Portfolio overview and detail could not be refreshed",
        ),
      ).not.toBeInTheDocument();
    });
  });

  it("keeps a detail refresh failure visible while the overview refreshes", async () => {
    const initialWorkspace = buildWorkspace();
    const confirmedDetail = confirmedDetails({
      as_of_date: "2026-03-28",
      positions: [],
    });
    getSummaryDetailsMock
      .mockResolvedValueOnce(confirmedDetail)
      .mockResolvedValueOnce(null);
    let resolveShellRefresh:
      ((value: PortfolioWorkspace | null) => void) | undefined;
    getShellWorkspaceMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveShellRefresh = resolve;
      }),
    );
    const view = render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={initialWorkspace}
      />,
    );
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1));
    const detailQuery = view.queryClient
      .getQueryCache()
      .findAll({
        queryKey: portfolioQueryKeys.summaryDetailsRoot(
          "MANUAL_PB_USD_001",
        ),
      })
      .find((query) => query.getObserversCount() > 0);
    expect(detailQuery).toBeDefined();

    await act(async () => {
      await view.queryClient.invalidateQueries({
        queryKey: detailQuery!.queryKey,
        exact: true,
      });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Portfolio detail could not be refreshed",
    );

    await act(async () => {
      void view.queryClient.invalidateQueries({
        queryKey: workspaceQueryKey(initialWorkspace),
        exact: true,
      });
    });
    await waitFor(() => {
      expect(
        view.queryClient.getQueryState(workspaceQueryKey(initialWorkspace))
          ?.fetchStatus,
      ).toBe("fetching");
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Portfolio detail could not be refreshed",
    );
    expect(
      screen.queryByText("Refreshing portfolio overview"),
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveShellRefresh?.(initialWorkspace);
    });
  });

  it("stores a refreshed shell under its returned generation and restores the authoritative server generation on revisit", async () => {
    const initialWorkspace = buildWorkspace();
    const refreshedWorkspace = {
      ...initialWorkspace,
      as_of_date: "2026-03-29",
      summary: {
        ...initialWorkspace.summary,
        market_value_base: 2000000.25,
      },
    } satisfies PortfolioWorkspace;
    getSummaryDetailsMock.mockImplementation(
      (_portfolioId: string, params: { asOfDate?: string }) =>
        Promise.resolve(
          confirmedDetails({
            as_of_date: params.asOfDate,
            positions: [],
          }),
        ),
    );
    getShellWorkspaceMock.mockResolvedValueOnce(refreshedWorkspace);
    const firstVisit = render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={initialWorkspace}
      />,
    );
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await firstVisit.queryClient.invalidateQueries({
        queryKey: workspaceQueryKey(initialWorkspace),
        exact: true,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("market-value")).toHaveTextContent(
        "2000000.25",
      );
    });
    expect(
      firstVisit.queryClient.getQueryData(
        workspaceQueryKey(refreshedWorkspace),
      ),
    ).toEqual(refreshedWorkspace);
    expect(
      firstVisit.queryClient
        .getQueryCache()
        .find({
          queryKey: workspaceQueryKey(refreshedWorkspace),
          exact: true,
        })
        ?.getObserversCount(),
    ).toBe(1);

    firstVisit.unmount();
    expect(
      firstVisit.queryClient.getQueryData(workspaceQueryKey(initialWorkspace)),
    ).toEqual(initialWorkspace);
    const initialGenerationState = firstVisit.queryClient.getQueryState(
      workspaceQueryKey(initialWorkspace),
    );
    const refreshedGenerationState = firstVisit.queryClient.getQueryState(
      workspaceQueryKey(refreshedWorkspace),
    );
    expect(refreshedGenerationState!.dataUpdatedAt).toBeGreaterThan(
      initialGenerationState!.dataUpdatedAt,
    );

    getShellWorkspaceMock.mockResolvedValueOnce(null);
    const recoveryVisit = render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={null}
      />,
      firstVisit.queryClient,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Portfolio overview could not be refreshed",
    );
    expect(screen.getByTestId("market-value")).toHaveTextContent(
      "2000000.25",
    );
    expect(screen.getByTestId("review-context-strip")).toHaveTextContent(
      "29 Mar 2026",
    );
    recoveryVisit.unmount();

    render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={initialWorkspace}
      />,
      firstVisit.queryClient,
    );

    await waitFor(() => {
      expect(screen.getByTestId("market-value")).toHaveTextContent(
        "1001550.05",
      );
    });
    expect(screen.getByTestId("review-context-strip")).toHaveTextContent(
      "28 Mar 2026",
    );
  });

  it("keeps confirmed Portfolio detail visible when a stale refresh is unavailable", async () => {
    getSummaryDetailsMock.mockResolvedValueOnce(
      confirmedDetails({
        as_of_date: "2026-03-28",
        summary: {
          ...buildWorkspace().summary,
          market_value_base: 2000000.25,
        },
        positions: [{ security_id: "EQ_1" }],
      }),
    );
    const { queryClient } = render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={buildWorkspace()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("market-value")).toHaveTextContent(
        "2000000.25",
      );
    });
    const [detailQuery] = queryClient.getQueryCache().findAll({
      queryKey: portfolioQueryKeys.summaryDetailsRoot("MANUAL_PB_USD_001"),
    });
    expect(detailQuery).toBeDefined();
    const queryKey = detailQuery!.queryKey;
    const confirmedDetail = queryClient.getQueryData(queryKey);
    getSummaryDetailsMock.mockResolvedValueOnce(null);

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey, exact: true });
    });

    await waitFor(() => {
      expect(queryClient.getQueryState(queryKey)?.status).toBe("error");
    });
    expect(queryClient.getQueryData(queryKey)).toEqual(confirmedDetail);
    expect(screen.getByTestId("market-value")).toHaveTextContent("2000000.25");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Portfolio detail could not be refreshed",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The previous portfolio view remains active while the refresh is retried.",
    );
    expect(
      within(screen.getByRole("alert")).getByRole("button", {
        name: "Retry portfolio detail refresh",
      }),
    ).toBeEnabled();
  });

  it("surfaces unavailable detail for the first read of a refreshed shell generation", async () => {
    const initialWorkspace = buildWorkspace();
    getSummaryDetailsMock
      .mockResolvedValueOnce(
        confirmedDetails({
          as_of_date: initialWorkspace.as_of_date,
          positions: [{ security_id: "EQ_1" }],
        }),
      );
    const refreshedShell = {
      ...initialWorkspace,
      as_of_date: "2026-03-29",
      summary: {
        ...initialWorkspace.summary,
        market_value_base: 2000000.25,
      },
    } satisfies PortfolioWorkspace;
    getShellWorkspaceMock.mockResolvedValueOnce(refreshedShell);
    const { queryClient } = render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={initialWorkspace}
      />,
    );
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1));

    let failNewGeneration: ((value: null) => void) | undefined;
    getSummaryDetailsMock.mockReturnValueOnce(
      new Promise((resolve) => {
        failNewGeneration = resolve;
      }),
    );

    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: workspaceQueryKey(initialWorkspace),
        exact: true,
      });
    });

    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText("Refreshing portfolio detail"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("shell-status")).toHaveTextContent("loading");
    expect(screen.getByTestId("market-value")).toHaveTextContent("none");

    await act(async () => {
      failNewGeneration?.(null);
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Portfolio detail is unavailable",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "positions and analysis could not be confirmed",
    );
    expect(screen.getByTestId("market-value")).toHaveTextContent("2000000.25");
    expect(
      within(screen.getByRole("alert")).getByRole("button", {
        name: "Retry portfolio detail refresh",
      }),
    ).toBeEnabled();
  });

  it("rejects mismatched stale detail before it replaces confirmed Portfolio truth", async () => {
    getSummaryDetailsMock.mockResolvedValueOnce(
      confirmedDetails({
        as_of_date: "2026-03-28",
        summary: {
          ...buildWorkspace().summary,
          market_value_base: 2000000.25,
        },
        positions: [{ security_id: "EQ_1" }],
      }),
    );
    const { queryClient } = render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={buildWorkspace()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("market-value")).toHaveTextContent(
        "2000000.25",
      );
    });
    const [detailQuery] = queryClient.getQueryCache().findAll({
      queryKey: portfolioQueryKeys.summaryDetailsRoot("MANUAL_PB_USD_001"),
    });
    expect(detailQuery).toBeDefined();
    const queryKey = detailQuery!.queryKey;
    const confirmedDetail = queryClient.getQueryData(queryKey);
    getSummaryDetailsMock.mockResolvedValueOnce(
      confirmedDetails({
        as_of_date: "2026-03-20",
        summary: {
          ...buildWorkspace().summary,
          market_value_base: 3000000.5,
        },
        positions: [{ security_id: "EQ_2" }],
      }),
    );

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey, exact: true });
    });

    await waitFor(() => {
      expect(queryClient.getQueryState(queryKey)?.status).toBe("error");
    });
    expect(queryClient.getQueryData(queryKey)).toEqual(confirmedDetail);
    expect(screen.getByTestId("market-value")).toHaveTextContent("2000000.25");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Portfolio detail could not be refreshed",
    );
  });

  it("prioritizes current control work over an earlier confirmation or refresh failure", async () => {
    const initialDetail = confirmedDetails({
      as_of_date: "2026-03-28",
      positions: [{ security_id: "EQ_1" }],
    });
    const ytdDetail = confirmedDetails({
      as_of_date: "2026-03-28",
      positions: [{ security_id: "EQ_2" }],
    });
    getSummaryDetailsMock
      .mockResolvedValueOnce(initialDetail)
      .mockResolvedValueOnce(ytdDetail)
      .mockResolvedValueOnce(null);
    const { queryClient } = render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={buildWorkspace()}
      />,
    );

    await waitFor(() => {
      expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      screen.getByRole("button", { name: "Select YTD" }).click();
    });
    await waitFor(() => {
      expect(screen.getByText("Review context confirmed")).toBeInTheDocument();
    });
    const ytdQuery = queryClient
      .getQueryCache()
      .findAll({
        queryKey: portfolioQueryKeys.summaryDetailsRoot("MANUAL_PB_USD_001"),
      })
      .find(({ queryKey }) => {
        const context = queryKey[queryKey.length - 1] as {
          timeWindow?: string;
        };
        return context.timeWindow === "YTD";
      });
    expect(ytdQuery).toBeDefined();
    const confirmedYtdDetail = queryClient.getQueryData(ytdQuery!.queryKey);

    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: ytdQuery!.queryKey,
        exact: true,
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryState(ytdQuery!.queryKey)?.status).toBe(
        "error",
      );
    });
    expect(queryClient.getQueryData(ytdQuery!.queryKey)).toEqual(
      confirmedYtdDetail,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Portfolio detail could not be refreshed",
    );
    expect(
      screen.queryByText("Review context confirmed"),
    ).not.toBeInTheDocument();

    let resolveOneYearDetail:
      ((value: Partial<PortfolioWorkspace> | null) => void) | undefined;
    getSummaryDetailsMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOneYearDetail = resolve;
      }),
    );
    await act(async () => {
      screen.getByRole("button", { name: "Select 1Y" }).click();
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Confirming review context",
    );
    expect(
      screen.queryByText("Portfolio detail could not be refreshed"),
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveOneYearDetail?.(null);
    });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Review context was not changed",
      );
    });
    expect(
      within(screen.getByRole("alert")).getByRole("button", {
        name: "Retry portfolio review context",
      }),
    ).toBeEnabled();
    expect(
      screen.queryByText("Portfolio detail could not be refreshed"),
    ).not.toBeInTheDocument();
  });

  it("restores source-confirmed controls when automatic detail rejects URL-derived context", async () => {
    const initialWorkspace = buildWorkspace();
    getSummaryDetailsMock.mockResolvedValue(
      confirmedDetails({
        as_of_date: initialWorkspace.as_of_date,
        summary: {
          ...initialWorkspace.summary,
          market_value_base: 2000000.25,
        },
      }),
    );

    render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={initialWorkspace}
        initialControls={{
          ...buildInitialPortfolioControls(initialWorkspace),
          asOfDate: "2026-03-20",
          timeWindow: "YTD",
        }}
      />,
    );

    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1));
    expect(getSummaryDetailsMock).toHaveBeenCalledWith(
      "MANUAL_PB_USD_001",
      expect.objectContaining({ asOfDate: "2026-03-20" }),
      expect.objectContaining({ signal: expect.any(Object) }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Review context was not changed",
    );
    expect(screen.getByTestId("time-window")).toHaveTextContent("30D");
    expect(routerReplaceMock).toHaveBeenCalledWith(
      "/portfolio?portfolioId=MANUAL_PB_USD_001&asOfDate=2026-03-28&period=30D&reportingCurrency=USD",
      { scroll: false },
    );
    await waitFor(() => {
      expect(getSummaryDetailsMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByTestId("market-value")).toHaveTextContent(
        "2000000.25",
      );
    });
    expect(screen.getByTestId("review-context-strip")).toHaveTextContent(
      "28 Mar 2026",
    );
    expect(screen.getByTestId("review-context-strip")).not.toHaveTextContent(
      "20 Mar 2026",
    );
    expect(getSummaryDetailsMock).toHaveBeenLastCalledWith(
      "MANUAL_PB_USD_001",
      expect.objectContaining({ asOfDate: "2026-03-28", timeWindow: "30D" }),
      expect.objectContaining({ signal: expect.any(Object) }),
    );
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it("restores source-confirmed controls when automatic detail is unavailable", async () => {
    const initialWorkspace = buildWorkspace();
    getSummaryDetailsMock.mockResolvedValue(null);

    render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={initialWorkspace}
        initialControls={{
          ...buildInitialPortfolioControls(initialWorkspace),
          asOfDate: "2026-03-20",
          timeWindow: "YTD",
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Review context was not changed",
      );
    });
    expect(screen.getByTestId("time-window")).toHaveTextContent("30D");
    expect(routerReplaceMock).toHaveBeenCalledWith(
      "/portfolio?portfolioId=MANUAL_PB_USD_001&asOfDate=2026-03-28&period=30D&reportingCurrency=USD",
      { scroll: false },
    );
    await waitFor(() => {
      expect(getSummaryDetailsMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByTestId("market-value")).toHaveTextContent(
        "1001550.05",
      );
    });
    expect(getSummaryDetailsMock).toHaveBeenLastCalledWith(
      "MANUAL_PB_USD_001",
      expect.objectContaining({ asOfDate: "2026-03-28", timeWindow: "30D" }),
      expect.objectContaining({ signal: expect.any(Object) }),
    );
  });

  it("withholds the current shell while source proof for URL-derived context is pending", async () => {
    const initialWorkspace = buildWorkspace();
    initialWorkspace.control_capabilities = {
      historical_snapshots: {
        state: "supported",
        reason: "available",
        requested_as_of_date: initialWorkspace.as_of_date,
        effective_as_of_date: initialWorkspace.as_of_date,
        module_capabilities: [],
      },
      reporting_currency_restatement: {
        state: "supported",
        reason: "available",
        requested_reporting_currency: "SGD",
        effective_reporting_currency: "USD",
        supported_currencies: ["USD", "SGD"],
        module_capabilities: [],
      },
    };
    getSummaryDetailsMock.mockReturnValue(new Promise(() => undefined));

    render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={initialWorkspace}
        initialControls={{
          ...buildInitialPortfolioControls(initialWorkspace),
          asOfDate: "2026-03-20",
          reportingCurrency: "SGD",
        }}
      />,
    );

    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1));
    const strip = screen.getByTestId("review-context-strip");
    expect(screen.getByTestId("shell-status")).toHaveTextContent("loading");
    expect(screen.getByTestId("market-value")).toHaveTextContent("none");
    expect(screen.getByTestId("portfolio-id")).toHaveTextContent("none");
    expect(strip).toHaveTextContent("Business dateNot confirmed");
    expect(strip).not.toHaveTextContent("28 Mar 2026");
    expect(strip).not.toHaveTextContent("20 Mar 2026");
    expect(
      within(strip).getByText("Base currency").parentElement,
    ).toHaveTextContent("Not confirmed");
  });

  it("promotes an alternate currency only after source detail confirms it", async () => {
    const initialWorkspace = buildWorkspace();
    initialWorkspace.control_capabilities = {
      historical_snapshots: {
        state: "supported",
        reason: "available",
        requested_as_of_date: initialWorkspace.as_of_date,
        effective_as_of_date: initialWorkspace.as_of_date,
        module_capabilities: [],
      },
      reporting_currency_restatement: {
        state: "supported",
        reason: "available",
        requested_reporting_currency: null,
        effective_reporting_currency: "USD",
        supported_currencies: ["USD", "SGD"],
        module_capabilities: [],
      },
    };
    getSummaryDetailsMock.mockResolvedValue(
      confirmedDetails({
        as_of_date: initialWorkspace.as_of_date,
        income_summary: { reporting_currency: "SGD" },
        activity_summary: { reporting_currency: "SGD" },
        positions: [],
      }),
    );

    render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={initialWorkspace}
        initialControls={{
          ...buildInitialPortfolioControls(initialWorkspace),
          reportingCurrency: "SGD",
        }}
      />,
    );

    const strip = screen.getByTestId("review-context-strip");
    await waitFor(() => {
      expect(
        within(strip).getByText("Reporting currency").parentElement,
      ).toHaveTextContent("SGD");
    });
    expect(within(strip).queryByText("Base currency")).not.toBeInTheDocument();
  });

  it("renders default 30D holdings after the source confirms its EXPLICIT window", async () => {
    const initialWorkspace = buildWorkspace();
    getSummaryDetailsMock.mockResolvedValue(
      confirmedDetails({
        as_of_date: initialWorkspace.as_of_date,
        positions: [{ security_id: "EQ_1" }],
        performance: {
          period: "EXPLICIT",
          report_start_date: "2026-02-26",
          report_end_date: "2026-03-28",
        },
      }),
    );

    render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={initialWorkspace}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("position-count")).toHaveTextContent("1");
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("adopts a changed server-rendered workspace snapshot even when summary request parameters are unchanged", async () => {
    const firstDetailsRequest: {
      resolve: ((value: Partial<PortfolioWorkspace>) => void) | null;
    } = { resolve: null };
    getShellWorkspaceMock.mockResolvedValue(buildWorkspace());
    getSummaryDetailsMock
      .mockReturnValueOnce(
        new Promise((resolve) => {
          firstDetailsRequest.resolve = resolve;
        }),
      )
      .mockResolvedValueOnce({
        positions: [],
        top_positions: [],
        allocations: [],
        allocation_views: [],
        income_summary: null,
        activity_summary: null,
      });

    const initialWorkspace = buildWorkspace();
    const refreshedWorkspace = {
      ...buildWorkspace(),
      summary: {
        ...initialWorkspace.summary,
        market_value_base: 2000000.25,
      },
      readiness: {
        ...initialWorkspace.readiness,
        reporting: {
          status: "READY",
          generated_at_utc: "2026-03-28T12:30:00Z",
          row_count: 4,
        },
      },
      warnings: ["valuation_source_refreshed"],
    } satisfies PortfolioWorkspace;

    const { rerender } = render(
      <PortfolioWorkspaceClient
        portfolios={[
          {
            portfolio_id: "MANUAL_PB_USD_001",
            display_name: "MANUAL_PB_USD_001",
            base_currency: "USD",
            client_id: "MANUAL_CIF_001",
            booking_center_code: "Singapore",
          },
        ]}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={initialWorkspace}
      />,
    );

    await waitFor(() => {
      expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1);
    });

    rerender(
      <PortfolioWorkspaceClient
        portfolios={[
          {
            portfolio_id: "MANUAL_PB_USD_001",
            display_name: "MANUAL_PB_USD_001",
            base_currency: "USD",
            client_id: "MANUAL_CIF_001",
            booking_center_code: "Singapore",
          },
        ]}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={refreshedWorkspace}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("market-value")).toHaveTextContent(
        "2000000.25",
      );
    });
    await waitFor(() => {
      expect(getSummaryDetailsMock).toHaveBeenCalledTimes(2);
    });

    firstDetailsRequest.resolve?.({
      summary: {
        ...initialWorkspace.summary,
        market_value_base: 1001550.05,
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("market-value")).toHaveTextContent(
        "2000000.25",
      );
    });
  });

  it("preserves confirmed review controls while synchronizing a newer shell generation", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: workbenchStrictQueryDefaults },
    });
    const initialWorkspace = buildWorkspace();
    initialWorkspace.control_capabilities = {
      historical_snapshots: {
        state: "supported",
        reason: "available",
        requested_as_of_date: initialWorkspace.as_of_date,
        effective_as_of_date: initialWorkspace.as_of_date,
        module_capabilities: [],
      },
      reporting_currency_restatement: {
        state: "supported",
        reason: "available",
        requested_reporting_currency: null,
        effective_reporting_currency: "USD",
        supported_currencies: ["USD", "SGD"],
        module_capabilities: [],
      },
    };
    const synchronizedShell = {
      ...initialWorkspace,
      summary: {
        ...initialWorkspace.summary,
        market_value_base: 2000000.25,
      },
    } satisfies PortfolioWorkspace;
    queryClient.setQueryData(
      workspaceQueryKey(initialWorkspace),
      synchronizedShell,
    );
    getSummaryDetailsMock.mockResolvedValue(
      confirmedDetails({
        as_of_date: "2026-03-20",
        positions: [],
      }),
    );
    const initialControls = {
      ...buildInitialPortfolioControls(initialWorkspace),
      asOfDate: "2026-03-20",
      reportingCurrency: "SGD",
      timeWindow: "YTD" as const,
    };

    render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={initialWorkspace}
        initialControls={initialControls}
      />,
      queryClient,
    );

    await waitFor(() => {
      expect(screen.getByTestId("market-value")).toHaveTextContent(
        "2000000.25",
      );
    });
    expect(screen.getByTestId("as-of-date")).toHaveTextContent("2026-03-20");
    expect(screen.getByTestId("reporting-currency")).toHaveTextContent("SGD");
    expect(screen.getByTestId("time-window")).toHaveTextContent("YTD");
    expect(getSummaryDetailsMock).toHaveBeenCalledWith(
      "MANUAL_PB_USD_001",
      expect.objectContaining({
        asOfDate: "2026-03-20",
        reportingCurrency: "SGD",
      }),
      expect.objectContaining({ signal: expect.any(Object) }),
    );
  });

  it("reconfirms non-default controls when the shell generation advances", async () => {
    const initialWorkspace = buildWorkspace();
    getSummaryDetailsMock
      .mockResolvedValueOnce(
        confirmedDetails({
          as_of_date: initialWorkspace.as_of_date,
          positions: [],
        }),
      )
      .mockResolvedValueOnce(
        confirmedDetails({
          as_of_date: initialWorkspace.as_of_date,
          positions: [],
        }),
      );
    const { queryClient } = render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={initialWorkspace}
      />,
    );
    await waitFor(() => expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      screen.getByRole("button", { name: "Select YTD" }).click();
    });
    expect(
      await screen.findByText("Review context confirmed"),
    ).toBeInTheDocument();

    let confirmNewGeneration:
      ((value: Partial<PortfolioWorkspace>) => void) | undefined;
    getSummaryDetailsMock.mockReturnValueOnce(
      new Promise((resolve) => {
        confirmNewGeneration = resolve;
      }),
    );
    const refreshedShell = {
      ...initialWorkspace,
      summary: {
        ...initialWorkspace.summary,
        market_value_base: 2000000.25,
      },
    } satisfies PortfolioWorkspace;
    getShellWorkspaceMock.mockResolvedValueOnce(refreshedShell);
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: workspaceQueryKey(initialWorkspace),
        exact: true,
      });
    });

    expect(
      await screen.findByText("Confirming review context"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Review context confirmed"),
    ).not.toBeInTheDocument();

    await act(async () => {
      confirmNewGeneration?.(
        confirmedDetails({
          as_of_date: initialWorkspace.as_of_date,
          positions: [],
        }),
      );
    });
    expect(
      await screen.findByText("Review context confirmed"),
    ).toBeInTheDocument();
  });

  it("recovers by fetching the portfolio shell when the server-rendered shell is unavailable", async () => {
    const recoveredWorkspace = buildWorkspace();

    getShellWorkspaceMock.mockResolvedValue(recoveredWorkspace);
    getSummaryDetailsMock.mockResolvedValue({
      positions: [{ security_id: "EQ_1" }],
      top_positions: [],
      allocations: [],
      allocation_views: [],
      income_summary: null,
      activity_summary: null,
    });
    render(
      <StrictMode>
        <PortfolioWorkspaceClient
          portfolios={[
            {
              portfolio_id: "MANUAL_PB_USD_001",
              display_name: "MANUAL_PB_USD_001",
              base_currency: "USD",
              client_id: "MANUAL_CIF_001",
              booking_center_code: "Singapore",
            },
          ]}
          selectedPortfolioId="MANUAL_PB_USD_001"
          initialWorkspace={null}
        />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("portfolio-id")).toHaveTextContent(
        "MANUAL_PB_USD_001",
      );
    });

    expect(getShellWorkspaceMock).toHaveBeenCalledTimes(1);
    expect(getShellWorkspaceMock).toHaveBeenCalledWith(
      "MANUAL_PB_USD_001",
      expect.objectContaining({ signal: expect.any(Object) }),
    );
    await waitFor(() => {
      expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1);
    });
    expect(getSummaryDetailsMock).toHaveBeenCalledWith(
      "MANUAL_PB_USD_001",
      {
        asOfDate: "2026-03-28",
        reportingCurrency: "USD",
        includeProjected: false,
        timeWindow: "30D",
        reportStartDate: "2026-02-26",
        reportEndDate: "2026-03-28",
        usesCustomDateRange: false,
      },
      expect.objectContaining({ signal: expect.any(Object) }),
    );
  });

  it("withholds a foreign server-rendered shell and never publishes its identity", async () => {
    getShellWorkspaceMock.mockResolvedValue(null);

    render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={buildWorkspace("PB_FOREIGN_001")}
        initialControls={buildInitialPortfolioControls(
          buildWorkspace("PB_FOREIGN_001"),
        )}
      />,
    );

    expect(screen.getByTestId("portfolio-id")).toHaveTextContent("none");
    expect(screen.queryByText("PB_FOREIGN_001")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("shell-status")).toHaveTextContent(
        "unavailable",
      );
    });
    expect(getShellWorkspaceMock).toHaveBeenCalledWith(
      "MANUAL_PB_USD_001",
      expect.objectContaining({ signal: expect.any(Object) }),
    );
    expect(getSummaryDetailsMock).not.toHaveBeenCalled();
  });

  it("rejects a foreign recovery shell before requesting or rendering details", async () => {
    getShellWorkspaceMock.mockResolvedValue(buildWorkspace("PB_FOREIGN_001"));

    render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("MANUAL_PB_USD_001")}
        selectedPortfolioId="MANUAL_PB_USD_001"
        initialWorkspace={null}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("shell-status")).toHaveTextContent(
        "unavailable",
      );
    });
    expect(screen.getByTestId("portfolio-id")).toHaveTextContent("none");
    expect(screen.queryByText("PB_FOREIGN_001")).not.toBeInTheDocument();
    expect(getSummaryDetailsMock).not.toHaveBeenCalled();
  });

  it("stops after one unavailable shell request instead of retrying continuously", async () => {
    let resolveShell: ((value: PortfolioWorkspace | null) => void) | undefined;
    getShellWorkspaceMock.mockReturnValue(
      new Promise((resolve) => {
        resolveShell = resolve;
      }),
    );
    getSummaryDetailsMock.mockResolvedValue(null);

    const retryingQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          ...workbenchQueryDefaults,
          retry: 1,
          retryDelay: 0,
        },
      },
    });

    render(
      <StrictMode>
        <PortfolioWorkspaceClient
          portfolios={[
            {
              portfolio_id: "MANUAL_PB_USD_001",
              display_name: "MANUAL_PB_USD_001",
              base_currency: "USD",
              client_id: "MANUAL_CIF_001",
              booking_center_code: "Singapore",
            },
          ]}
          selectedPortfolioId="MANUAL_PB_USD_001"
          initialWorkspace={null}
        />
      </StrictMode>,
      retryingQueryClient,
    );

    await waitFor(() => {
      expect(getShellWorkspaceMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId("shell-status")).toHaveTextContent("loading");

    await act(async () => {
      resolveShell?.(null);
    });

    await waitFor(() => {
      expect(screen.getByTestId("shell-status")).toHaveTextContent(
        "unavailable",
      );
    });
    expect(getShellWorkspaceMock).toHaveBeenCalledTimes(1);
    expect(getSummaryDetailsMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("portfolio-id")).toHaveTextContent("none");
    expect(getShellRecoveryStates()).toEqual(["loading", "error"]);
  });

  it("permits one fresh automatic attempt when the selected portfolio source key changes", async () => {
    const shellResolvers = new Map<
      string,
      (value: PortfolioWorkspace | null) => void
    >();
    getShellWorkspaceMock.mockImplementation(
      (portfolioId: string) =>
        new Promise<PortfolioWorkspace | null>((resolve) => {
          shellResolvers.set(portfolioId, resolve);
        }),
    );
    getSummaryDetailsMock.mockResolvedValue({
      positions: [],
      top_positions: [],
      allocations: [],
      allocation_views: [],
      income_summary: null,
      activity_summary: null,
    });

    const { rerender } = render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("PORTFOLIO_A")}
        selectedPortfolioId="PORTFOLIO_A"
        initialWorkspace={null}
      />,
    );

    await waitFor(() => {
      expect(getShellWorkspaceMock).toHaveBeenCalledWith(
        "PORTFOLIO_A",
        expect.objectContaining({ signal: expect.any(Object) }),
      );
    });

    rerender(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("PORTFOLIO_B")}
        selectedPortfolioId="PORTFOLIO_B"
        initialWorkspace={null}
      />,
    );

    await waitFor(() => {
      expect(getShellWorkspaceMock).toHaveBeenCalledWith(
        "PORTFOLIO_B",
        expect.objectContaining({ signal: expect.any(Object) }),
      );
    });
    expect(getShellWorkspaceMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("shell-status")).toHaveTextContent("loading");

    await act(async () => {
      shellResolvers.get("PORTFOLIO_A")?.(buildWorkspace("PORTFOLIO_A"));
    });
    expect(screen.getByTestId("portfolio-id")).toHaveTextContent("none");
    expect(getSummaryDetailsMock).not.toHaveBeenCalled();

    await act(async () => {
      shellResolvers.get("PORTFOLIO_B")?.(buildWorkspace("PORTFOLIO_B"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("portfolio-id")).toHaveTextContent(
        "PORTFOLIO_B",
      );
    });
    await waitFor(() => {
      expect(getSummaryDetailsMock).toHaveBeenCalledTimes(1);
    });
    expect(getSummaryDetailsMock).toHaveBeenCalledWith(
      "PORTFOLIO_B",
      expect.any(Object),
      expect.objectContaining({ signal: expect.any(Object) }),
    );
    expect(getShellRecoveryStates()).toEqual(["loading", "loading", "ready"]);
  });

  it("does not publish terminal state or details after an in-flight recovery is unmounted", async () => {
    let resolveShell: ((value: PortfolioWorkspace | null) => void) | undefined;
    getShellWorkspaceMock.mockReturnValue(
      new Promise((resolve) => {
        resolveShell = resolve;
      }),
    );

    const { unmount } = render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("PORTFOLIO_A")}
        selectedPortfolioId="PORTFOLIO_A"
        initialWorkspace={null}
      />,
    );

    await waitFor(() => {
      expect(getShellWorkspaceMock).toHaveBeenCalledTimes(1);
    });
    unmount();

    await act(async () => {
      resolveShell?.(buildWorkspace("PORTFOLIO_A"));
    });

    expect(getSummaryDetailsMock).not.toHaveBeenCalled();
    expect(getShellRecoveryStates()).toEqual(["loading"]);
  });

  it("does not leave the workspace loading when no selected portfolio can be resolved", () => {
    render(
      <PortfolioWorkspaceClient
        portfolios={buildPortfolioCatalog("PORTFOLIO_A")}
        selectedPortfolioId={null}
        initialWorkspace={null}
      />,
    );

    expect(screen.getByTestId("shell-status")).toHaveTextContent("unavailable");
    expect(getShellWorkspaceMock).not.toHaveBeenCalled();
    expect(getShellRecoveryStates()).toEqual([]);
  });
});

function buildPortfolioCatalog(portfolioId: string) {
  return [
    {
      portfolio_id: portfolioId,
      display_name: portfolioId,
      base_currency: "USD",
      client_id: `CLIENT_${portfolioId}`,
      booking_center_code: "Singapore",
    },
  ];
}

function getShellRecoveryStates() {
  return getAnalyticsUiMetricEvents()
    .filter(
      (event) =>
        event.labels.operation === "portfolio.workspace.shell.recovery",
    )
    .map((event) => event.labels.state);
}
