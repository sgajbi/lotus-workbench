import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

import HomeAppPage from "@/apps/home/page";
import SuitePage from "@/app/suite/page";
import PerformanceAppPage from "@/apps/performance/page";
import RecommendationsAppPage from "@/apps/recommendations/page";
import ProposalsPage from "@/app/proposals/page";
import { renderWithQueryClient } from "../helpers/query-client-test-harness";

const redirectMock = vi.fn((target: string) => {
  throw new Error(`REDIRECT:${target}`);
});

vi.mock("echarts-for-react", () => ({
  default: ({ style }: { style?: React.CSSProperties }) => (
    <div data-testid="performance-echart" style={style} />
  ),
}));

vi.mock("next/navigation", () => ({
  redirect: (target: string) => redirectMock(target),
  usePathname: () => "/performance",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

vi.mock("@/features/proposals/components/advisory-overview-workspace", () => ({
  default: ({
    reviewContext,
  }: {
    reviewContext: {
      portfolioId: string;
      asOfDate?: string;
      period?: string;
      reportingCurrency?: string;
    };
  }) => (
    <section
      data-testid="advisory-overview-workspace"
      data-as-of={reviewContext.asOfDate}
      data-period={reviewContext.period}
      data-currency={reviewContext.reportingCurrency}
    >
      <h2>Advisory Overview</h2>
      <p>{reviewContext.portfolioId}</p>
    </section>
  ),
}));

vi.mock("@/features/proposals/components/advisory-copilot-workspace", () => ({
  default: ({ portfolioId }: { portfolioId: string }) => (
    <section>
      <h2>Advisory Copilot</h2>
      <p>{portfolioId}</p>
    </section>
  ),
}));

vi.mock(
  "@/features/proposals/components/advisory-opportunities-workspace",
  () => ({
    default: ({ portfolioId }: { portfolioId: string }) => (
      <section>
        <h2>Opportunities And Ideas</h2>
        <p>{portfolioId}</p>
      </section>
    ),
  }),
);

vi.mock("@/features/proposals/components/advisor-cockpit-workspace", () => ({
  default: ({ portfolioId }: { portfolioId: string }) => (
    <section>
      <h2>Advisor Cockpit</h2>
      <p>{portfolioId}</p>
    </section>
  ),
}));

vi.mock("@/features/proposals/components/proposal-lifecycle-workspace", () => ({
  default: ({ portfolioId, mode }: { portfolioId: string; mode: string }) => (
    <section>
      <h2>Proposal Lifecycle Workspace</h2>
      <p>{portfolioId}</p>
      <p>{mode}</p>
    </section>
  ),
}));

vi.mock("@/features/proposals/components/proposal-workspace-shell", () => ({
  default: ({
    title,
    reviewContext,
    workflowContext,
    workflowContextPresentation,
    children,
  }: {
    title: string;
    reviewContext: {
      portfolioId: string;
      asOfDate?: string;
      period?: string;
      reportingCurrency?: string;
    };
    workflowContext?: { sourceLabel: string };
    workflowContextPresentation?: string;
    children: React.ReactNode;
  }) => (
    <section
      data-testid="proposal-workspace-shell"
      data-context-presentation={workflowContextPresentation}
      data-source-label={workflowContext?.sourceLabel}
      data-as-of={reviewContext.asOfDate}
      data-period={reviewContext.period}
      data-currency={reviewContext.reportingCurrency}
    >
      <h1>{title}</h1>
      <p>{reviewContext.portfolioId}</p>
      {children}
    </section>
  ),
}));

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<unknown>) => {
    return function MockDynamicComponent(props: Record<string, unknown>) {
      const [Component, setComponent] = React.useState<React.ComponentType<
        Record<string, unknown>
      > | null>(null);
      React.useEffect(() => {
        loader().then((mod: unknown) => {
          const resolved = (
            mod as { default?: React.ComponentType<Record<string, unknown>> }
          ).default;
          setComponent(resolved ?? null);
        });
      }, []);
      return Component ? React.createElement(Component, props) : null;
    };
  },
}));

describe("app route entrypoints", () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it("routes home into the portfolio workspace", () => {
    expect(() => HomeAppPage()).toThrowError("REDIRECT:/portfolio");
    expect(redirectMock).toHaveBeenCalledWith("/portfolio");
  });

  it("routes the retired Suite alias through the canonical Home entry", () => {
    expect(() => SuitePage()).toThrowError("REDIRECT:/portfolio");
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/portfolio");
  });

  it("mounts performance from the app-owned analytics page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = input.toString();
        if (url.includes("/api/v1/lookups/portfolios")) {
          return {
            ok: true,
            json: async () => ({
              items: [{ id: "PORT_1001", label: "PORT_1001" }],
            }),
          } as Response;
        }
        if (url.includes("/api/v1/workbench/PORT_1001/performance?")) {
          throw new Error(
            `Deprecated aggregate performance route used: ${url}`,
          );
        }
        if (url.includes("/api/v1/workbench/PORT_1001/performance/summary?")) {
          return {
            ok: true,
            json: async () => ({
              correlation_id: "corr-performance",
              contract_version: "v1",
              portfolio_id: "PORT_1001",
              as_of_date: "2026-03-26",
              period: "YTD",
              chart_frequency: "monthly",
              contribution_dimension: "asset_class",
              attribution_dimension: "asset_class",
              detail_basis: "NET",
              benchmark_code: null,
              portfolio: {
                portfolio_id: "PORT_1001",
                client_id: null,
                base_currency: "USD",
                booking_center_code: null,
              },
              overview: {
                market_value_base: 1000000,
                cash_weight_pct: 4.5,
                position_count: 12,
              },
              net_performance: {
                metric_basis: "NET",
                portfolio_return_pct: 1.2,
                benchmark_return_pct: null,
                active_return_pct: 0.2,
                annualized_return_pct: 1.2,
                benchmark_id: null,
                benchmark_return_source: null,
              },
              gross_performance: {
                metric_basis: "GROSS",
                portfolio_return_pct: 1.5,
                benchmark_return_pct: null,
                active_return_pct: 0.5,
                annualized_return_pct: 1.5,
                benchmark_id: null,
                benchmark_return_source: null,
              },
              money_weighted_return: {
                money_weighted_return_pct: 1.1,
                annualized_return_pct: 1.1,
                method: "XIRR",
                start_date: "2026-01-01",
                end_date: "2026-03-26",
                notes: [],
              },
              net_chart: [],
              gross_chart: [],
              contribution: null,
              attribution: null,
              warnings: [],
              partial_failures: [],
            }),
          } as Response;
        }
        return { ok: false, json: async () => ({}) } as Response;
      }),
    );

    renderWithQueryClient(
      await PerformanceAppPage({
        searchParams: Promise.resolve({ portfolioId: "PORT_1001" }),
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Performance" }),
    ).toBeInTheDocument();
  });

  it("mounts recommendations as the advisory workspace when portfolio context exists", async () => {
    render(
      await RecommendationsAppPage({
        searchParams: Promise.resolve({
          portfolioId: "PORT_1001",
          asOfDate: "2026-06-30",
          period: "3Y",
          reportingCurrency: "SGD",
        }),
      }),
    );

    expect(
      screen.getAllByRole("heading", { name: "Advisory Overview" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("PORT_1001").length).toBeGreaterThan(0);
    expect(screen.getByTestId("proposal-workspace-shell")).toHaveAttribute(
      "data-as-of",
      "2026-06-30",
    );
    expect(screen.getByTestId("proposal-workspace-shell")).toHaveAttribute(
      "data-context-presentation",
      "inline-boundary",
    );
    expect(screen.getByTestId("advisory-overview-workspace")).toHaveAttribute(
      "data-period",
      "3Y",
    );
    expect(screen.getByTestId("advisory-overview-workspace")).toHaveAttribute(
      "data-currency",
      "SGD",
    );
    expect(
      screen.queryByRole("complementary", { name: "Advisory workspace scope" }),
    ).not.toBeInTheDocument();
  });

  it("requires a source-confirmed portfolio before mounting advisory evidence", async () => {
    render(await RecommendationsAppPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByText("Review context needs attention"),
    ).toBeInTheDocument();
    expect(screen.getByText(/No demo portfolio was substituted/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Select a portfolio from My book" }),
    ).toHaveAttribute("href", "/book");
    expect(
      screen.queryByRole("heading", { name: "Advisory Overview" }),
    ).not.toBeInTheDocument();
  });

  it("rejects ambiguous advisory review context before mounting a workspace", async () => {
    render(
      await RecommendationsAppPage({
        searchParams: Promise.resolve({
          portfolioId: ["PORT_1001", "PORT_2002"],
          asOfDate: "2026-06-30",
        }),
      }),
    );

    expect(screen.getByText(/repeated or unsupported review context/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Advisory Overview" }),
    ).not.toBeInTheDocument();
  });

  it("mounts recommendations ideas mode as a focused advisory screen", async () => {
    render(
      await RecommendationsAppPage({
        searchParams: Promise.resolve({
          portfolioId: "PORT_1001",
          mode: "opportunities",
        }),
      }),
    );

    expect(
      screen.getAllByRole("heading", { name: "Opportunities And Ideas" })
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("PORT_1001").length).toBeGreaterThan(0);
  });

  it("mounts recommendations cockpit mode as a Gateway-backed advisory screen", async () => {
    render(
      await RecommendationsAppPage({
        searchParams: Promise.resolve({
          portfolioId: "PORT_1001",
          mode: "cockpit",
        }),
      }),
    );

    expect(
      screen.getAllByRole("heading", { name: "Advisor Cockpit" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("PORT_1001").length).toBeGreaterThan(0);
    expect(screen.getByTestId("proposal-workspace-shell")).toHaveAttribute(
      "data-context-presentation",
      "inline-boundary",
    );
    expect(screen.getByTestId("proposal-workspace-shell")).toHaveAttribute(
      "data-source-label",
      "Advisor Cockpit source-owned action evidence",
    );
  });

  it("mounts recommendations copilot mode as a Gateway-backed advisory screen", async () => {
    render(
      await RecommendationsAppPage({
        searchParams: Promise.resolve({
          portfolioId: "PORT_1001",
          mode: "copilot",
        }),
      }),
    );

    expect(
      screen.getAllByRole("heading", { name: "Advisory Copilot" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("PORT_1001").length).toBeGreaterThan(0);
  });

  it("mounts proposal lifecycle modes from the proposals route", async () => {
    render(
      await ProposalsPage({
        searchParams: Promise.resolve({
          portfolioId: "PORT_1001",
          mode: "risk-impact",
        }),
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Risk and Impact" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Proposal Lifecycle Workspace" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("PORT_1001").length).toBeGreaterThan(0);
    expect(screen.getByText("risk-impact")).toBeInTheDocument();
  });

  it.each([
    {},
    { portfolioId: ["PORT_1001", "PORT_2002"], mode: "risk-impact" },
  ])(
    "does not mount a proposal queue without one governed portfolio: %o",
    async (searchParams) => {
      render(
        await ProposalsPage({
          searchParams: Promise.resolve(searchParams),
        }),
      );

      expect(
        screen.getByText("Review context needs attention"),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", {
          name: "Proposal Lifecycle Workspace",
        }),
      ).not.toBeInTheDocument();
    },
  );

  it("gives Suitability review the full-width decision desk presentation", async () => {
    render(
      await ProposalsPage({
        searchParams: Promise.resolve({
          portfolioId: "PORT_1001",
          mode: "suitability",
        }),
      }),
    );

    expect(screen.getByTestId("proposal-workspace-shell")).toHaveAttribute(
      "data-context-presentation",
      "inline-boundary",
    );
    expect(screen.getByText("suitability")).toBeInTheDocument();
  });
});
