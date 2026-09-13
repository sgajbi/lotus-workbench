import { type QueryClient, queryOptions } from "@tanstack/react-query";

import type { PortfolioReviewContext } from "@/apps/portfolio/portfolio-screen-navigation";
import { workbenchStrictQueryDefaults } from "@/features/platform-runtime/query-policy";
import { isWorkbenchPermissionBlockedError } from "@/features/workbench/api-client";
import { loadManageWorkspaceData } from "@/features/workbench/manage-workspace-data-loader";
import {
  readDpmMandateId,
  type ManageWorkspaceData,
} from "@/features/workbench/manage-workspace-data";
import { getPortfolio360 } from "@/features/workbench/workbench-core-api";

export type ManageOverviewQueryContext = Readonly<{
  portfolioId: string;
  sessionId?: string;
  asOfDate?: string;
  period?: PortfolioReviewContext["period"];
  reportingCurrency?: string;
}>;

export class ManageOverviewSourceError extends Error {
  constructor(
    readonly partialData: ManageWorkspaceData | null,
    readonly accessWithheld: boolean,
  ) {
    super(
      accessWithheld
        ? "Manage overview access is not available."
        : "Manage overview evidence is incomplete.",
    );
    this.name = "ManageOverviewSourceError";
  }
}

const manageOverviewQueryRoot = ["manage", "overview"] as const;

export const manageOverviewQueryKeys = {
  all: manageOverviewQueryRoot,
  composite(context: ManageOverviewQueryContext) {
    return [
      ...manageOverviewQueryRoot,
      "composite",
      {
        portfolioId: context.portfolioId,
        sessionId: context.sessionId ?? null,
        asOfDate: context.asOfDate ?? null,
        period: context.period ?? null,
        reportingCurrency: context.reportingCurrency ?? null,
      },
    ] as const;
  },
};

export function manageOverviewQueryOptions(
  context: ManageOverviewQueryContext,
  initialData?: ManageWorkspaceData,
) {
  return queryOptions({
    ...workbenchStrictQueryDefaults,
    queryKey: manageOverviewQueryKeys.composite(context),
    queryFn: ({ signal }) => fetchManageOverview(context, signal),
    enabled: false,
    initialData,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retryOnMount: false,
  });
}

export async function recheckManageOverview(
  queryClient: QueryClient,
  context: ManageOverviewQueryContext,
) {
  const options = manageOverviewQueryOptions(context);
  await queryClient.invalidateQueries({
    queryKey: options.queryKey,
    exact: true,
    refetchType: "none",
  });
  return await queryClient.fetchQuery(options);
}

export function isManageOverviewComplete(data: ManageWorkspaceData): boolean {
  return Boolean(
    !data.sourceAccessWithheld &&
      isManageOverviewSource(data.commandCenter) &&
      !data.commandCenterError &&
      isManageOverviewSource(data.commandCenterExceptions) &&
      !data.commandCenterExceptionsError &&
      isManageOverviewSource(data.mandate) &&
      hasManageMandateIdentity(data.mandate) &&
      isManageOverviewSource(data.mandateHealth) &&
      !data.mandateHealthError &&
      isManageOverviewSource(data.waves) &&
      !data.wavesError,
  );
}

function isManageOverviewSource(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }
  const supportability = value.supportability;
  return (
    hasNonBlankString(value.correlation_id) &&
    hasNonBlankString(value.contract_version) &&
    hasNonBlankString(value.source_service) &&
    typeof value.upstream_status === "number" &&
    Number.isInteger(value.upstream_status) &&
    value.upstream_status >= 200 &&
    value.upstream_status < 300 &&
    isRecord(value.data) &&
    isRecord(supportability) &&
    supportability.source_service === value.source_service &&
    hasNonBlankString(supportability.authority) &&
    hasNonBlankString(supportability.state)
  );
}

function hasManageMandateIdentity(mandate: Record<string, unknown>): boolean {
  const mandateData = mandate.data;
  if (!isRecord(mandateData)) {
    return false;
  }
  return readDpmMandateId(mandateData) !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isManageOverviewPermissionError(error: unknown): boolean {
  return error instanceof ManageOverviewSourceError && error.accessWithheld;
}

async function fetchManageOverview(
  context: ManageOverviewQueryContext,
  signal: AbortSignal,
): Promise<ManageWorkspaceData> {
  let portfolio;
  try {
    portfolio = await getPortfolio360(
      context.portfolioId,
      context.sessionId,
      "client",
      signal,
    );
  } catch (error) {
    throw new ManageOverviewSourceError(
      null,
      isWorkbenchPermissionBlockedError(error),
    );
  }

  if (portfolio.portfolio.portfolio_id !== context.portfolioId) {
    throw new ManageOverviewSourceError(null, false);
  }

  const data = await loadManageWorkspaceData(portfolio, "overview", {
    signal,
    target: "client",
  });
  if (!isManageOverviewComplete(data)) {
    throw new ManageOverviewSourceError(
      data,
      data.sourceAccessWithheld === true,
    );
  }
  return data;
}
