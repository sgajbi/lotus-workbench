import { type QueryClient, queryOptions } from "@tanstack/react-query";

import type { PortfolioReviewContext } from "@/apps/portfolio/portfolio-screen-navigation";
import { workbenchStrictQueryDefaults } from "@/features/platform-runtime/query-policy";
import { isWorkbenchPermissionBlockedError } from "@/features/workbench/api-client";
import { loadManageWorkspaceData } from "@/features/workbench/manage-workspace-data-loader";
import {
  readDpmMandateId,
  type ManageWorkspaceData,
} from "@/features/workbench/manage-workspace-data";
import { getManageExceptionEvidencePosture } from "@/features/workbench/manage-workspace-view-model";
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
      hasManageCommandCenterPayload(data.commandCenter) &&
      !data.commandCenterError &&
      isManageOverviewSource(data.commandCenterExceptions) &&
      hasCompleteManageExceptionEvidence(data) &&
      isManageOverviewSource(data.mandate) &&
      hasManageMandateIdentity(data.mandate) &&
      isManageOverviewSource(data.mandateHealth) &&
      hasManageMandateHealthPayload(data.mandateHealth) &&
      !data.mandateHealthError &&
      isManageOverviewSource(data.waves) &&
      hasManageWavePayload(data.waves) &&
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
    isConfirmedSupportabilityState(supportability.state)
  );
}

function hasManageCommandCenterPayload(value: unknown): boolean {
  const data = readSourceData(value);
  if (!data) {
    return false;
  }
  if (readDpmMandateId(data) !== null) {
    return true;
  }
  const summary = data.summary;
  return (
    isRecord(summary) &&
    (isConfirmedDataCompletenessState(summary.data_completeness_state) ||
      typeof summary.active_exception_count === "number")
  );
}

function hasCompleteManageExceptionEvidence(data: ManageWorkspaceData): boolean {
  return (
    getManageExceptionEvidencePosture(
      data.commandCenterExceptions,
      data.commandCenterExceptionsError,
    ) === "complete"
  );
}

function hasManageMandateIdentity(mandate: Record<string, unknown>): boolean {
  const mandateData = readSourceData(mandate);
  return mandateData !== null && readDpmMandateId(mandateData) !== null;
}

function hasManageMandateHealthPayload(value: unknown): boolean {
  const data = readSourceData(value);
  return Boolean(
    data &&
      (Array.isArray(data.dimensions) ||
        hasNonBlankString(data.health_state) ||
        typeof data.health_score === "number"),
  );
}

function hasManageWavePayload(value: unknown): boolean {
  const data = readSourceData(value);
  return data !== null && Array.isArray(data.items);
}

function readSourceData(value: unknown): Record<string, unknown> | null {
  return isRecord(value) && isRecord(value.data) ? value.data : null;
}

function isConfirmedSupportabilityState(value: unknown): boolean {
  return (
    hasNonBlankString(value) &&
    ["COMPLETE", "READY", "SUPPORTED"].includes(value.trim().toUpperCase())
  );
}

function isConfirmedDataCompletenessState(value: unknown): boolean {
  return (
    hasNonBlankString(value) &&
    ["COMPLETE", "READY", "SUPPORTED"].includes(value.trim().toUpperCase())
  );
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
    asOfDate: context.asOfDate,
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
