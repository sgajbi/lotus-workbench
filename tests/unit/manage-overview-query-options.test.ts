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
      { signal: expect.any(AbortSignal), target: "client" },
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
  });
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}
