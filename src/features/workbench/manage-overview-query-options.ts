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

export function isManageOverviewComplete(
  data: ManageWorkspaceData,
  context?: ManageOverviewQueryContext,
): boolean {
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
      hasConsistentManageMandateIdentity(data) &&
      isManageOverviewSource(data.waves) &&
      hasManageWavePayload(data.waves, context?.asOfDate) &&
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
  const summary = data.summary;
  const declaredCompletenessStates = [
    data.data_completeness_state,
    isRecord(summary) ? summary.data_completeness_state : null,
    readSourceSupportability(value)?.data_completeness_state,
  ].filter(hasNonBlankString);
  // An explicitly published source posture is authoritative, even when the
  // envelope also carries mandate identity. Count fallback is only for legacy
  // contracts that publish no completeness posture at all.
  if (
    declaredCompletenessStates.length > 0 &&
    !declaredCompletenessStates.every(isConfirmedDataCompletenessState)
  ) {
    return false;
  }
  if (readDpmMandateId(data) !== null && declaredCompletenessStates.length > 0) {
    return true;
  }
  if (!isRecord(summary)) {
    return false;
  }
  return typeof summary.active_exception_count === "number";
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
      (hasNonEmptyRecordArray(data.dimensions) ||
        hasNonBlankString(data.health_state) ||
        (typeof data.health_score === "number" && Number.isFinite(data.health_score))),
  );
}

function hasConsistentManageMandateIdentity(data: ManageWorkspaceData): boolean {
  const mandateIds = [
    readDpmMandateId(readSourceData(data.mandate)),
    readDpmMandateId(readSourceData(data.mandateHealth)),
    readDpmMandateId(readSourceData(data.commandCenter)),
  ].filter((mandateId): mandateId is string => mandateId !== null);
  return mandateIds.length > 0 && new Set(mandateIds).size === 1;
}

function hasManageWavePayload(value: unknown, asOfDate?: string): boolean {
  const data = readSourceData(value);
  return Boolean(
    data &&
      Array.isArray(data.items) &&
      typeof data.total_count === "number" &&
      Number.isInteger(data.total_count) &&
      data.total_count >= 0 &&
      data.total_count === data.items.length &&
      (data.next_cursor === null || data.next_cursor === undefined) &&
      (!hasNonBlankString(asOfDate) ||
        data.items.every(
          (item) => isRecord(item) && item.as_of_date === asOfDate,
        )),
  );
}

function readSourceData(value: unknown): Record<string, unknown> | null {
  return isRecord(value) && isRecord(value.data) ? value.data : null;
}

function readSourceSupportability(value: unknown): Record<string, unknown> | null {
  return isRecord(value) && isRecord(value.supportability) ? value.supportability : null;
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

function hasNonEmptyRecordArray(value: unknown): boolean {
  return Array.isArray(value) && value.some(isRecord);
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
  if (!isManageOverviewComplete(data, context)) {
    throw new ManageOverviewSourceError(
      data,
      data.sourceAccessWithheld === true,
    );
  }
  return data;
}
