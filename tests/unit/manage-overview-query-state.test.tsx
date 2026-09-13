import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ManageWorkspace } from "../../src/features/workbench/manage-workspace";
import { loadManageWorkspaceData } from "../../src/features/workbench/manage-workspace-data-loader";
import { getPortfolio360 } from "../../src/features/workbench/workbench-core-api";
import { WorkbenchApiError } from "../../src/features/workbench/api-client";
import type { ManageWorkspaceData } from "../../src/features/workbench/manage-workspace-data";
import { buildManageWorkspaceData } from "./manage-workspace-fixtures";

vi.mock("../../src/features/workbench/manage-workspace-data-loader", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/features/workbench/manage-workspace-data-loader")>()),
  loadManageWorkspaceData: vi.fn(),
}));

vi.mock("../../src/features/workbench/workbench-core-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/features/workbench/workbench-core-api")>()),
  getPortfolio360: vi.fn(),
}));

describe("Manage Overview governed receipt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates without an ambient read and performs one explicit composite recheck", async () => {
    const data = buildManageWorkspaceData();
    const queryClient = createQueryClient();
    vi.mocked(getPortfolio360).mockResolvedValue(data.portfolio);
    vi.mocked(loadManageWorkspaceData).mockResolvedValue(data);

    renderWorkspace(data, queryClient);

    expect(screen.getByText(/^Checked /)).toBeInTheDocument();
    expect(getPortfolio360).not.toHaveBeenCalled();
    expect(loadManageWorkspaceData).not.toHaveBeenCalled();

    fireEvent.focus(window);
    window.dispatchEvent(new Event("online"));
    expect(getPortfolio360).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Recheck overview" }));

    await waitFor(() => expect(getPortfolio360).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Recheck overview" })).toBeEnabled(),
    );
    expect(loadManageWorkspaceData).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Overview recheck failed/)).not.toBeInTheDocument();
  });

  it("does not reread a successful composite when remounted with the same QueryClient", () => {
    const data = buildManageWorkspaceData();
    const queryClient = createQueryClient();
    const first = renderWorkspace(data, queryClient);

    first.unmount();
    renderWorkspace(data, queryClient);

    expect(getPortfolio360).not.toHaveBeenCalled();
    expect(loadManageWorkspaceData).not.toHaveBeenCalled();
    expect(screen.getByText(/^Checked /)).toBeInTheDocument();
  });

  it("admits a fresh same-key server refusal instead of retained permitted evidence", async () => {
    const queryClient = createQueryClient();
    const admittedData = buildManageWorkspaceData();
    const refusal = buildManageWorkspaceData({ sourceAccessWithheld: true });
    const first = renderWorkspace(admittedData, queryClient);

    await waitFor(() =>
      expect(queryClient.getQueryData(manageOverviewKey(admittedData))).toEqual(admittedData),
    );
    first.unmount();
    renderWorkspace(refusal, queryClient);

    expect(
      screen.getByText(
        "Your authenticated role does not currently provide access to this portfolio-management evidence.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("1,250,000.00 USD")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(queryClient.getQueryData(manageOverviewKey(refusal))).toEqual(refusal),
    );
    expect(getPortfolio360).not.toHaveBeenCalled();
    expect(loadManageWorkspaceData).not.toHaveBeenCalled();
  });

  it("admits fresh same-key facts and fences an older concurrent recheck", async () => {
    const queryClient = createQueryClient();
    const admittedData = buildManageWorkspaceData();
    const newerData = buildManageWorkspaceData({
      portfolio: forPortfolio(admittedData, "PF_1001", 2_500_000).portfolio,
    });
    const delayedPortfolio = deferred<ManageWorkspaceData["portfolio"]>();
    vi.mocked(getPortfolio360).mockImplementationOnce(() => delayedPortfolio.promise);
    vi.mocked(loadManageWorkspaceData).mockResolvedValue(admittedData);

    const view = renderWorkspace(admittedData, queryClient);
    await waitFor(() =>
      expect(queryClient.getQueryData(manageOverviewKey(admittedData))).toEqual(admittedData),
    );
    fireEvent.click(screen.getByRole("button", { name: "Recheck overview" }));
    await waitFor(() => expect(getPortfolio360).toHaveBeenCalledTimes(1));

    view.rerender(
      <Wrapper queryClient={queryClient}>
        <ManageWorkspace
          data={newerData}
          mode="overview"
          reviewContext={{ portfolioId: newerData.portfolio.portfolio.portfolio_id }}
        />
      </Wrapper>,
    );

    expect(screen.getByText("2,500,000.00 USD")).toBeInTheDocument();
    await waitFor(() =>
      expect(queryClient.getQueryData(manageOverviewKey(newerData))).toEqual(newerData),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Recheck overview" })).toBeEnabled(),
    );
    expect(screen.queryByText(/Overview recheck failed/)).not.toBeInTheDocument();
    await act(async () => delayedPortfolio.resolve(admittedData.portfolio));
    expect(screen.getByText("2,500,000.00 USD")).toBeInTheDocument();
    expect(screen.queryByText("1,250,000.00 USD")).not.toBeInTheDocument();
  });

  it("retains a complete same-key receipt when a fresh server composite is incomplete", async () => {
    const queryClient = createQueryClient();
    const admittedData = buildManageWorkspaceData();
    const incompleteData = buildManageWorkspaceData({
      waves: null,
      wavesError: "Rebalance evidence is temporarily unavailable.",
    });
    const first = renderWorkspace(admittedData, queryClient);

    await waitFor(() =>
      expect(queryClient.getQueryData(manageOverviewKey(admittedData))).toEqual(admittedData),
    );
    first.unmount();
    renderWorkspace(incompleteData, queryClient);

    expect(screen.getByText("1,250,000.00 USD")).toBeInTheDocument();
    expect(screen.getByText(/^Checked /)).toBeInTheDocument();
    expect(queryClient.getQueryData(manageOverviewKey(incompleteData))).toEqual(admittedData);
    expect(getPortfolio360).not.toHaveBeenCalled();
    expect(loadManageWorkspaceData).not.toHaveBeenCalled();
  });

  it("retains admitted evidence after an ordinary failed recheck", async () => {
    const data = buildManageWorkspaceData();
    vi.mocked(getPortfolio360).mockResolvedValue(data.portfolio);
    vi.mocked(loadManageWorkspaceData).mockResolvedValue(
      buildManageWorkspaceData({
        waves: null,
        wavesError: "Rebalance evidence is temporarily unavailable.",
      }),
    );

    renderWorkspace(data, createQueryClient());
    fireEvent.click(screen.getByRole("button", { name: "Recheck overview" }));

    expect(await screen.findByText(/Overview recheck failed/)).toBeInTheDocument();
    expect(screen.getByText("1,250,000.00 USD")).toBeInTheDocument();
    expect(screen.getByText(/^Checked /)).toBeInTheDocument();
  });

  it("rejects malformed successful source data without replacing a complete receipt", async () => {
    const data = buildManageWorkspaceData();
    const malformedData = buildManageWorkspaceData({
      commandCenterExceptions: {} as ManageWorkspaceData["commandCenterExceptions"],
    });
    vi.mocked(getPortfolio360).mockResolvedValue(data.portfolio);
    vi.mocked(loadManageWorkspaceData).mockResolvedValue(malformedData);

    renderWorkspace(data, createQueryClient());
    fireEvent.click(screen.getByRole("button", { name: "Recheck overview" }));

    expect(await screen.findByText(/Overview recheck failed/)).toHaveTextContent(
      "The displayed portfolio-management evidence remains from the previous successful check.",
    );
    expect(screen.getByText("1,250,000.00 USD")).toBeInTheDocument();
    expect(screen.getByText(/^Checked /)).toBeInTheDocument();
  });

  it("withholds retained evidence when an explicit recheck is refused", async () => {
    const data = buildManageWorkspaceData();
    vi.mocked(getPortfolio360).mockRejectedValue(
      new WorkbenchApiError("portfolio 360", 403),
    );

    renderWorkspace(data, createQueryClient());
    fireEvent.click(screen.getByRole("button", { name: "Recheck overview" }));

    expect(
      await screen.findByText(
        "Your authenticated role does not currently provide access to this portfolio-management evidence.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("1,250,000.00 USD")).not.toBeInTheDocument();
  });

  it("fences a delayed old-portfolio completion from the active review context", async () => {
    const queryClient = createQueryClient();
    const firstData = buildManageWorkspaceData();
    const secondData = forPortfolio(buildManageWorkspaceData(), "PF_2002", 2_500_000);
    const oldPortfolio = deferred<ManageWorkspaceData["portfolio"]>();
    vi.mocked(getPortfolio360).mockImplementationOnce(() => oldPortfolio.promise);
    vi.mocked(loadManageWorkspaceData).mockResolvedValue(firstData);

    const rendered = renderWorkspace(firstData, queryClient);
    fireEvent.click(screen.getByRole("button", { name: "Recheck overview" }));
    rendered.rerender(
      <Wrapper queryClient={queryClient}>
        <ManageWorkspace
          data={secondData}
          mode="overview"
          reviewContext={{ portfolioId: "PF_2002" }}
        />
      </Wrapper>,
    );

    expect(screen.getByText("2,500,000.00 USD")).toBeInTheDocument();
    await act(async () => oldPortfolio.resolve(firstData.portfolio));
    expect(screen.getByText("2,500,000.00 USD")).toBeInTheDocument();
    expect(screen.queryByText("1,250,000.00 USD")).not.toBeInTheDocument();
  });

  it("withholds a receipt when the initial visible composite is incomplete", () => {
    renderWorkspace(
      buildManageWorkspaceData({ mandateHealth: null, mandateHealthError: null }),
      createQueryClient(),
    );

    expect(screen.getByText("Evidence incomplete")).toBeInTheDocument();
    expect(screen.queryByText(/^Checked /)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recheck overview" })).toBeEnabled();
  });

  it("does not claim a prior successful check until a complete composite was admitted", async () => {
    const incompleteData = buildManageWorkspaceData({
      mandateHealth: null,
      mandateHealthError: null,
    });
    vi.mocked(getPortfolio360).mockResolvedValue(incompleteData.portfolio);
    vi.mocked(loadManageWorkspaceData).mockResolvedValueOnce(incompleteData);

    renderWorkspace(incompleteData, createQueryClient());
    fireEvent.click(screen.getByRole("button", { name: "Recheck overview" }));

    expect(await screen.findByText(/Overview recheck failed/)).toHaveTextContent(
      "No complete portfolio-management evidence has been admitted yet.",
    );
    expect(screen.queryByText(/previous successful check/)).not.toBeInTheDocument();
  });

  it("recognises a later successful recovery before retaining it after another failure", async () => {
    const incompleteData = buildManageWorkspaceData({
      mandateHealth: null,
      mandateHealthError: null,
    });
    const recoveredData = buildManageWorkspaceData();
    vi.mocked(getPortfolio360).mockResolvedValue(recoveredData.portfolio);
    vi.mocked(loadManageWorkspaceData)
      .mockResolvedValueOnce(incompleteData)
      .mockResolvedValueOnce(recoveredData)
      .mockResolvedValueOnce(incompleteData);

    renderWorkspace(incompleteData, createQueryClient());
    const recheck = screen.getByRole("button", { name: "Recheck overview" });
    fireEvent.click(recheck);
    expect(await screen.findByText(/Overview recheck failed/)).toHaveTextContent(
      "No complete portfolio-management evidence has been admitted yet.",
    );

    fireEvent.click(recheck);
    await waitFor(() => expect(screen.getByText(/^Checked /)).toBeInTheDocument());

    fireEvent.click(recheck);
    expect(await screen.findByText(/Overview recheck failed/)).toHaveTextContent(
      "The displayed portfolio-management evidence remains from the previous successful check.",
    );
  });
});

function renderWorkspace(data: ManageWorkspaceData, queryClient: QueryClient) {
  return render(
    <Wrapper queryClient={queryClient}>
      <ManageWorkspace
        data={data}
        mode="overview"
        reviewContext={{ portfolioId: data.portfolio.portfolio.portfolio_id }}
      />
    </Wrapper>,
  );
}

function Wrapper({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: ReactNode;
}) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function forPortfolio(
  data: ManageWorkspaceData,
  portfolioId: string,
  marketValue: number,
): ManageWorkspaceData {
  return {
    ...data,
    portfolio: {
      ...data.portfolio,
      portfolio: { ...data.portfolio.portfolio, portfolio_id: portfolioId },
      overview: { ...data.portfolio.overview, market_value_base: marketValue },
    },
  };
}

function manageOverviewKey(data: ManageWorkspaceData) {
  return [
    "manage",
    "overview",
    "composite",
    {
      portfolioId: data.portfolio.portfolio.portfolio_id,
      sessionId: null,
      asOfDate: null,
      period: null,
      reportingCurrency: null,
    },
  ];
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}
