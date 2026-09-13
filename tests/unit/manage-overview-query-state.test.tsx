import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ManageWorkspace } from "../../src/features/workbench/manage-workspace";
import { loadManageWorkspaceData } from "../../src/features/workbench/manage-workspace-data-loader";
import { getPortfolio360 } from "../../src/features/workbench/workbench-core-api";
import { WorkbenchApiError } from "../../src/features/workbench/api-client";
import type { ManageWorkspaceData } from "../../src/features/workbench/manage-workspace-data";
import { buildManageWorkspaceData } from "./manage-workspace-fixtures";
import Providers from "../../src/app/providers";
import {
  captureAuthorityRequestContext,
  reconcileResponseAuthorityContext,
  resetClientAuthorityContextForTests,
} from "../../src/features/workbench/client-authority-context";

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
    vi.mocked(getPortfolio360).mockResolvedValue(admittedData.portfolio);
    vi.mocked(loadManageWorkspaceData).mockResolvedValue(incompleteData);
    const first = renderWorkspace(admittedData, queryClient);

    await waitFor(() =>
      expect(queryClient.getQueryData(manageOverviewKey(admittedData))).toEqual(admittedData),
    );
    const receiptUpdatedAt = queryClient.getQueryState(
      manageOverviewKey(admittedData),
    )?.dataUpdatedAt;
    expect(receiptUpdatedAt).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Recheck overview" }));
    expect(await screen.findByText(/Overview recheck failed/)).toBeInTheDocument();
    first.unmount();
    renderWorkspace(incompleteData, queryClient);

    expect(screen.getByText("1,250,000.00 USD")).toBeInTheDocument();
    expect(screen.getByText(/^Checked /)).toBeInTheDocument();
    expect(queryClient.getQueryData(manageOverviewKey(incompleteData))).toEqual(admittedData);
    expect(queryClient.getQueryState(manageOverviewKey(incompleteData))?.dataUpdatedAt).toBe(
      receiptUpdatedAt,
    );
    expect(screen.queryByText(/Overview recheck failed/)).not.toBeInTheDocument();
    expect(getPortfolio360).toHaveBeenCalledTimes(1);
    expect(loadManageWorkspaceData).toHaveBeenCalledTimes(1);
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

  it("keeps a refused receipt withheld until a fresh complete admission restores it", async () => {
    const queryClient = createQueryClient();
    const admittedData = buildManageWorkspaceData();
    const incompleteData = buildManageWorkspaceData({
      waves: null,
      wavesError: "Rebalance evidence is temporarily unavailable.",
    });
    const restoredData = buildManageWorkspaceData({
      portfolio: forPortfolio(admittedData, "PF_1001", 2_500_000).portfolio,
    });
    const lateOldPortfolio = deferred<ManageWorkspaceData["portfolio"]>();
    vi.mocked(getPortfolio360)
      .mockRejectedValueOnce(new WorkbenchApiError("portfolio 360", 403))
      .mockImplementationOnce(() => lateOldPortfolio.promise);
    vi.mocked(loadManageWorkspaceData).mockResolvedValue(admittedData);

    const first = renderWorkspace(admittedData, queryClient);
    await waitFor(() =>
      expect(queryClient.getQueryData(manageOverviewKey(admittedData))).toEqual(admittedData),
    );
    const originalReceiptUpdatedAt = queryClient.getQueryState(
      manageOverviewKey(admittedData),
    )?.dataUpdatedAt;
    fireEvent.click(screen.getByRole("button", { name: "Recheck overview" }));
    expect(
      await screen.findByText(
        "Your authenticated role does not currently provide access to this portfolio-management evidence.",
      ),
    ).toBeInTheDocument();
    first.unmount();

    const recovered = renderWorkspace(incompleteData, queryClient);
    expect(
      screen.getByText(
        "Your authenticated role does not currently provide access to this portfolio-management evidence.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("1,250,000.00 USD")).not.toBeInTheDocument();
    expect(queryClient.getQueryState(manageOverviewKey(incompleteData))?.dataUpdatedAt).toBe(
      originalReceiptUpdatedAt,
    );

    fireEvent.click(screen.getByRole("button", { name: "Recheck overview" }));
    await waitFor(() => expect(getPortfolio360).toHaveBeenCalledTimes(2));
    recovered.rerender(
      <Wrapper queryClient={queryClient}>
        <ManageWorkspace
          data={restoredData}
          mode="overview"
          reviewContext={{ portfolioId: "PF_1001" }}
        />
      </Wrapper>,
    );

    expect(screen.getByText("2,500,000.00 USD")).toBeInTheDocument();
    expect(screen.getByText(/^Checked /)).toBeInTheDocument();
    await act(async () => lateOldPortfolio.resolve(admittedData.portfolio));
    expect(screen.getByText("2,500,000.00 USD")).toBeInTheDocument();
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

  it.each(["complete cache", "incomplete cache", "server refusal"] as const)(
    "keeps %s refusal beyond inactive expiry, incomplete remount and failed recovery until complete admission",
    async (refusalOrigin) => {
      const queryClient = createQueryClient();
      const complete = buildManageWorkspaceData();
      const incomplete = buildManageWorkspaceData({ waves: null, wavesError: "Unavailable" });
      const initial = refusalOrigin === "complete cache"
        ? complete
        : refusalOrigin === "incomplete cache"
          ? incomplete
          : { ...incomplete, sourceAccessWithheld: true };
      vi.mocked(getPortfolio360).mockReset();
      vi.mocked(loadManageWorkspaceData).mockReset();
      const first = renderWorkspace(initial, queryClient);
      const key = manageOverviewKey(initial);
      const checkedAt = queryClient.getQueryState(key)!.dataUpdatedAt;
      if (refusalOrigin !== "server refusal") {
        vi.mocked(getPortfolio360).mockRejectedValueOnce(new WorkbenchApiError("portfolio 360", 403));
        fireEvent.click(screen.getByRole("button", { name: "Recheck overview" }));
        await waitFor(expectWithheldOverview);
      }
      // Exercise the former five-minute inactive GC window, not only an
      // immediate remount. Inactivity is not evidence of restored access.
      const readsBeforeRemount = vi.mocked(getPortfolio360).mock.calls.length;
      const compositionsBeforeRemount = vi.mocked(loadManageWorkspaceData).mock.calls.length;
      vi.useFakeTimers();
      try {
        first.unmount();
        await vi.advanceTimersByTimeAsync(300_001);
      } finally {
        vi.useRealTimers();
      }
      renderWorkspace({ ...incomplete }, queryClient);
      expectWithheldOverview();
      expect(queryClient.getQueryState(key)!.dataUpdatedAt).toBe(checkedAt);
      expect(getPortfolio360).toHaveBeenCalledTimes(readsBeforeRemount);
      expect(loadManageWorkspaceData).toHaveBeenCalledTimes(compositionsBeforeRemount);
      fireEvent.focus(window);
      window.dispatchEvent(new Event("online"));
      expect(getPortfolio360).toHaveBeenCalledTimes(readsBeforeRemount);

      for (const failure of ["ordinary", "ordinary", "incomplete"] as const) {
        if (failure === "ordinary") {
          vi.mocked(getPortfolio360).mockRejectedValueOnce(new WorkbenchApiError("portfolio 360", 503));
        } else {
          vi.mocked(getPortfolio360).mockResolvedValueOnce(complete.portfolio);
          vi.mocked(loadManageWorkspaceData).mockResolvedValueOnce(incomplete);
        }
        const recovery = screen.getByRole("button", { name: "Recheck overview" });
        recovery.focus();
        fireEvent.click(recovery);
        await waitFor(() => expect(screen.getByRole("button", { name: "Recheck overview" })).toBeEnabled());
        expectWithheldOverview();
        expect(screen.getByText(/Access has not been restored/)).toBeInTheDocument();
        expect(screen.queryByText(/previous successful check/)).not.toBeInTheDocument();
        expect(queryClient.getQueryState(key)!.dataUpdatedAt).toBe(checkedAt);
        await waitFor(() => expect(screen.getByRole("button", { name: "Recheck overview" })).toHaveFocus());
      }

      const restored = forPortfolio(complete, "PF_1001", 2_500_000);
      vi.mocked(getPortfolio360).mockResolvedValueOnce(restored.portfolio);
      vi.mocked(loadManageWorkspaceData).mockResolvedValueOnce(restored);
      fireEvent.click(screen.getByRole("button", { name: "Recheck overview" }));
      expect(await screen.findByText("2,500,000.00 USD")).toBeInTheDocument();
      expect(screen.getByText(/^Checked /)).toBeInTheDocument();
      expect(screen.queryByText(/Access has not been restored/)).not.toBeInTheDocument();
      expect(queryClient.getQueryState(key)!.dataUpdatedAt).toBeGreaterThan(checkedAt);
    },
  );

  it.each(["complete", "denied"] as const)("does not carry refusal or a late %s completion across the actual principal boundary", async (outcome) => {
    resetClientAuthorityContextForTests();
    acceptPrincipal("a");
    const admitted = buildManageWorkspaceData();
    const restored = forPortfolio(admitted, "PF_1001", 2_500_000);
    const oldPortfolio = deferred<ManageWorkspaceData["portfolio"]>();
    vi.mocked(getPortfolio360).mockReset()
      .mockRejectedValueOnce(new WorkbenchApiError("portfolio 360", 403))
      .mockImplementationOnce(() => oldPortfolio.promise);
    vi.mocked(loadManageWorkspaceData).mockResolvedValue(admitted);
    let queryClient!: QueryClient;
    const principalView = (data: ManageWorkspaceData) => (
      <Providers>
        <QueryClientCapture onClient={(client) => { queryClient = client; }} />
        <ManageWorkspace data={data} mode="overview" reviewContext={{ portfolioId: "PF_1001" }} />
      </Providers>
    );
    const view = render(principalView(admitted));
    try {
      fireEvent.click(screen.getByRole("button", { name: "Recheck overview" }));
      await waitFor(expectWithheldOverview);
      fireEvent.click(screen.getByRole("button", { name: "Recheck overview" }));
      await waitFor(() => expect(getPortfolio360).toHaveBeenCalledTimes(2));
      const previousQuery = queryClient.getQueryCache().find({ queryKey: manageOverviewKey(admitted) });
      act(() => {
        acceptPrincipal("b");
        view.rerender(principalView(restored));
      });
      expect(screen.getByText("2,500,000.00 USD")).toBeInTheDocument();
      expect(screen.getByText(/^Checked /)).toBeInTheDocument();
      expect(queryClient.getQueryCache().find({ queryKey: manageOverviewKey(restored) })).not.toBe(previousQuery);
      await act(async () => {
        if (outcome === "complete") oldPortfolio.resolve(admitted.portfolio);
        else oldPortfolio.reject(new WorkbenchApiError("portfolio 360", 403));
      });
      expect(screen.getByText("2,500,000.00 USD")).toBeInTheDocument();
      expect(screen.queryByText("1,250,000.00 USD")).not.toBeInTheDocument();
      expect(screen.queryByText(/Access has not been restored/)).not.toBeInTheDocument();
      expect(queryClient.getQueryData(manageOverviewKey(restored))).toEqual(restored);
      expect(getPortfolio360).toHaveBeenCalledTimes(2);
    } finally {
      view.unmount();
      resetClientAuthorityContextForTests();
    }
  });

  it("isolates refusal from a different review period and currency for the same portfolio", async () => {
    const queryClient = createQueryClient();
    const denied = buildManageWorkspaceData({ sourceAccessWithheld: true });
    const restored = forPortfolio(buildManageWorkspaceData(), "PF_1001", 2_500_000);
    const view = renderWorkspace(denied, queryClient);
    expectWithheldOverview();
    const readsBefore = vi.mocked(getPortfolio360).mock.calls.length;
    view.rerender(
      <Wrapper queryClient={queryClient}>
        <ManageWorkspace data={restored} mode="overview" reviewContext={{
          portfolioId: "PF_1001", period: "YTD", reportingCurrency: "USD", asOfDate: "2026-05-13",
        }} />
      </Wrapper>,
    );
    expect(screen.getByText("2,500,000.00 USD")).toBeInTheDocument();
    expect(await screen.findByText(/^Checked /)).toBeInTheDocument();
    expect(queryClient.getQueryData(manageOverviewKey(denied))).toEqual(denied);
    expect(getPortfolio360).toHaveBeenCalledTimes(readsBefore);
  });

  it("does not restore a refused context from complete server facts for another portfolio", () => {
    const queryClient = createQueryClient();
    const denied = buildManageWorkspaceData({ sourceAccessWithheld: true });
    const foreign = forPortfolio(buildManageWorkspaceData(), "PF_OTHER", 2_500_000);
    const view = renderWorkspace(denied, queryClient);
    const checkedAt = queryClient.getQueryState(manageOverviewKey(denied))!.dataUpdatedAt;
    view.rerender(
      <Wrapper queryClient={queryClient}>
        <ManageWorkspace data={foreign} mode="overview" reviewContext={{ portfolioId: "PF_1001" }} />
      </Wrapper>,
    );
    expectWithheldOverview();
    expect(screen.queryByText("2,500,000.00 USD")).not.toBeInTheDocument();
    expect(queryClient.getQueryState(manageOverviewKey(denied))!.dataUpdatedAt).toBe(checkedAt);
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

function expectWithheldOverview() {
  expect(screen.getByText(/Your authenticated role does not currently provide access/)).toBeInTheDocument();
  expect(screen.queryByText("1,250,000.00 USD")).not.toBeInTheDocument();
  expect(screen.queryByText(/^Checked /)).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Portfolio operating summary")).not.toBeInTheDocument();
}

function QueryClientCapture({ onClient }: { onClient: (client: QueryClient) => void }) {
  onClient(useQueryClient());
  return null;
}

function acceptPrincipal(character: string) {
  reconcileResponseAuthorityContext(
    new Response("{}", { headers: { "X-Workbench-Authority-Context": character.repeat(64) } }),
    captureAuthorityRequestContext(),
  );
}

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
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((settle, refuse) => {
    resolve = settle;
    reject = refuse;
  });
  return { promise, resolve, reject };
}
