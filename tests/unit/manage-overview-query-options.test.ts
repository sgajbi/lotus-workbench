import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  isManageOverviewComplete,
  ManageOverviewSourceError,
  manageOverviewQueryKeys,
  manageOverviewQueryOptions,
  recheckManageOverview,
} from "../../src/features/workbench/manage-overview-query-options";
import { loadManageWorkspaceData } from "../../src/features/workbench/manage-workspace-data-loader";
import { getPortfolio360 } from "../../src/features/workbench/workbench-core-api";
import { WorkbenchApiError } from "../../src/features/workbench/api-client";
import type { ManageWorkspaceData } from "../../src/features/workbench/manage-workspace-data";
import { buildManageWorkspaceData } from "./manage-workspace-fixtures";

vi.mock("../../src/features/workbench/manage-workspace-data-loader", () => ({
  loadManageWorkspaceData: vi.fn(),
}));

vi.mock("../../src/features/workbench/workbench-core-api", () => ({
  getPortfolio360: vi.fn(),
}));

const context = {
  portfolioId: "PF_1001",
  sessionId: "session-1",
  asOfDate: "2026-05-13",
  period: "YTD" as const,
  reportingCurrency: "USD",
};

describe("Manage Overview query ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const data = buildManageWorkspaceData();
    vi.mocked(getPortfolio360).mockResolvedValue(data.portfolio);
    vi.mocked(loadManageWorkspaceData).mockResolvedValue(data);
  });

  it("keys the composite by the complete review identity and disables ambient rereads", () => {
    const options = manageOverviewQueryOptions(context, buildManageWorkspaceData());

    expect(options.queryKey).toEqual([
      "manage",
      "overview",
      "composite",
      {
        portfolioId: "PF_1001",
        sessionId: "session-1",
        asOfDate: "2026-05-13",
        period: "YTD",
        reportingCurrency: "USD",
      },
    ]);
    expect(options.enabled).toBe(false);
    expect(options.refetchOnMount).toBe(false);
    expect(options.refetchOnReconnect).toBe(false);
    expect(options.refetchOnWindowFocus).toBe(false);
    expect(options.retryOnMount).toBe(false);
  });

  it("performs one exact composite recheck and forwards client target plus cancellation", async () => {
    const queryClient = createQueryClient();

    await recheckManageOverview(queryClient, context);

    expect(getPortfolio360).toHaveBeenCalledTimes(1);
    expect(getPortfolio360).toHaveBeenCalledWith(
      "PF_1001",
      "session-1",
      "client",
      expect.any(AbortSignal),
    );
    expect(loadManageWorkspaceData).toHaveBeenCalledTimes(1);
    expect(loadManageWorkspaceData).toHaveBeenCalledWith(
      expect.objectContaining({ portfolio: expect.objectContaining({ portfolio_id: "PF_1001" }) }),
      "overview",
      {
        asOfDate: "2026-05-13",
        signal: expect.any(AbortSignal),
        target: "client",
      },
    );
  });

  it("retains the last complete composite when a later source read is incomplete", async () => {
    const queryClient = createQueryClient();
    const admitted = buildManageWorkspaceData();
    vi.mocked(loadManageWorkspaceData)
      .mockResolvedValueOnce(admitted)
      .mockResolvedValueOnce(
        buildManageWorkspaceData({
          waves: null,
          wavesError: "Rebalance evidence is temporarily unavailable.",
        }),
      );

    await recheckManageOverview(queryClient, context);
    await expect(recheckManageOverview(queryClient, context)).rejects.toBeInstanceOf(
      ManageOverviewSourceError,
    );

    expect(
      queryClient.getQueryData(manageOverviewQueryKeys.composite(context)),
    ).toBe(admitted);
    expect(getPortfolio360).toHaveBeenCalledTimes(2);
    expect(loadManageWorkspaceData).toHaveBeenCalledTimes(2);
  });

  it("fails closed when portfolio identity or permission authority is not confirmed", async () => {
    const queryClient = createQueryClient();
    const mismatched = buildManageWorkspaceData().portfolio;
    vi.mocked(getPortfolio360)
      .mockResolvedValueOnce({
        ...mismatched,
        portfolio: { ...mismatched.portfolio, portfolio_id: "PF_OTHER" },
      })
      .mockRejectedValueOnce(new WorkbenchApiError("portfolio 360", 403));

    await expect(recheckManageOverview(queryClient, context)).rejects.toMatchObject({
      accessWithheld: false,
    });
    await expect(recheckManageOverview(queryClient, context)).rejects.toMatchObject({
      accessWithheld: true,
    });
    expect(loadManageWorkspaceData).not.toHaveBeenCalled();
  });

  it("retains Query-owned refusal and its old receipt through repeated ordinary and incomplete failures", async () => {
    const queryClient = createQueryClient();
    const key = manageOverviewQueryKeys.composite(context);
    const admitted = buildManageWorkspaceData();
    queryClient.setQueryData(key, admitted, { updatedAt: 1_000 });
    vi.mocked(getPortfolio360).mockRejectedValueOnce(new WorkbenchApiError("portfolio 360", 403));
    await expect(recheckManageOverview(queryClient, context)).rejects.toMatchObject({ accessWithheld: true });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      vi.mocked(getPortfolio360).mockRejectedValueOnce(new WorkbenchApiError("portfolio 360", 503));
      await expect(recheckManageOverview(queryClient, context)).rejects.toMatchObject({ accessWithheld: false });
      expect(queryClient.getQueryData(key)).toEqual({ ...admitted, sourceAccessWithheld: true });
      expect(queryClient.getQueryState(key)!.dataUpdatedAt).toBe(1_000);
    }
    vi.mocked(loadManageWorkspaceData).mockResolvedValueOnce({ ...admitted, waves: null });
    await expect(recheckManageOverview(queryClient, context)).rejects.toMatchObject({ accessWithheld: false });
    expect(queryClient.getQueryData(key)).toEqual({ ...admitted, sourceAccessWithheld: true });
    expect(queryClient.getQueryState(key)!.dataUpdatedAt).toBe(1_000);
    await recheckManageOverview(queryClient, context);
    expect(queryClient.getQueryData(key)).toEqual(admitted);
    expect(queryClient.getQueryState(key)!.dataUpdatedAt).toBeGreaterThan(1_000);
  });

  it.each(["complete", "denied"] as const)("fences a late %s result after cancellation and replacement of the same Query", async (outcome) => {
    const queryClient = createQueryClient();
    const key = manageOverviewQueryKeys.composite(context);
    const data = buildManageWorkspaceData();
    queryClient.setQueryData(key, data);
    let complete!: (data: ManageWorkspaceData["portfolio"]) => void;
    let deny!: (error: Error) => void;
    vi.mocked(getPortfolio360).mockImplementationOnce(() => new Promise((resolve, reject) => {
      complete = resolve;
      deny = reject;
    }));
    const oldRequest = recheckManageOverview(queryClient, context).catch(() => undefined);
    await vi.waitFor(() => expect(getPortfolio360).toHaveBeenCalledTimes(1));
    await queryClient.cancelQueries({ queryKey: key, exact: true });
    queryClient.removeQueries({ queryKey: key, exact: true });
    const replacement = { ...data, sourceAccessWithheld: outcome === "complete" };
    queryClient.setQueryData(key, replacement, { updatedAt: 2_000 });
    if (outcome === "complete") complete(data.portfolio);
    else deny(new WorkbenchApiError("portfolio 360", 403));
    await oldRequest;
    // Flush the ignored transport completion as well as Query's cancellation promise.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(queryClient.getQueryState(key)!.fetchStatus).toBe("idle");
    expect(queryClient.getQueryData(key)).toEqual(replacement);
    expect(queryClient.getQueryState(key)!.dataUpdatedAt).toBe(2_000);
  });

  it("does not classify a partial or permission-withheld composite as checked", () => {
    expect(isManageOverviewComplete(buildManageWorkspaceData())).toBe(true);
    expect(
      isManageOverviewComplete(
        buildManageWorkspaceData({ mandateHealth: null, mandateHealthError: null }),
      ),
    ).toBe(false);
    expect(
      isManageOverviewComplete(
        buildManageWorkspaceData({ sourceAccessWithheld: true }),
      ),
    ).toBe(false);
    const complete = buildManageWorkspaceData();
    expect(
      isManageOverviewComplete(
        buildManageWorkspaceData({
          commandCenter: {
            ...complete.commandCenter!,
            data: {},
          } as ManageWorkspaceData["commandCenter"],
        }),
      ),
    ).toBe(false);
    expect(
      isManageOverviewComplete(
        buildManageWorkspaceData({
          commandCenterExceptions: {
            ...complete.commandCenterExceptions!,
            supportability: {
              ...complete.commandCenterExceptions!.supportability,
              state: "PARTIAL",
            },
            data: {
              ...complete.commandCenterExceptions!.data,
              next_cursor: "next-page",
            },
          },
        }),
      ),
    ).toBe(false);
    for (const dataCompletenessState of ["PARTIAL", "DEGRADED"]) {
      expect(
        isManageOverviewComplete(
          buildManageWorkspaceData({
            commandCenter: {
              ...complete.commandCenter!,
              data: {
                ...complete.commandCenter!.data,
                summary: {
                  active_exception_count: 2,
                  data_completeness_state: dataCompletenessState,
                },
              },
            },
          }),
        ),
      ).toBe(false);
    }
    for (const dataCompletenessState of ["PARTIAL", "DEGRADED"]) {
      expect(
        isManageOverviewComplete(
          buildManageWorkspaceData({
            commandCenter: {
              ...complete.commandCenter!,
              supportability: {
                ...complete.commandCenter!.supportability,
                data_completeness_state: dataCompletenessState,
              },
              data: {
                ...complete.commandCenter!.data,
                mandate_id: "mandate_001",
              },
            } as ManageWorkspaceData["commandCenter"],
          }),
        ),
      ).toBe(false);
    }
    expect(
      isManageOverviewComplete(
        buildManageWorkspaceData({
          mandateHealth: {
            ...complete.mandateHealth!,
            data: { dimensions: [] },
          } as ManageWorkspaceData["mandateHealth"],
        }),
      ),
    ).toBe(false);
    expect(
      isManageOverviewComplete(
        buildManageWorkspaceData({
          waves: {
            ...complete.waves!,
            data: {
              ...complete.waves!.data,
              total_count: 2,
            },
          } as ManageWorkspaceData["waves"],
        }),
      ),
    ).toBe(false);
    expect(
      isManageOverviewComplete(
        buildManageWorkspaceData({
          commandCenter: {
            ...complete.commandCenter!,
            data: { mandate_id: "mandate_001" },
          } as ManageWorkspaceData["commandCenter"],
        }),
      ),
    ).toBe(false);
    expect(
      isManageOverviewComplete(
        buildManageWorkspaceData({
          mandateHealth: {
            ...complete.mandateHealth!,
            data: { mandate_id: "mandate_other", health_state: "READY" },
          } as ManageWorkspaceData["mandateHealth"],
        }),
      ),
    ).toBe(false);
    expect(
      isManageOverviewComplete(
        buildManageWorkspaceData({
          waves: {
            ...complete.waves!,
            data: {
              ...complete.waves!.data,
              items: [
                {
                  ...(complete.waves!.data.items as Array<Record<string, unknown>>)[0],
                  as_of_date: "2026-05-12",
                },
              ],
            },
          } as ManageWorkspaceData["waves"],
        }),
        context,
      ),
    ).toBe(false);
  });
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}
