import { resolveConfiguredAuthorityMode } from "@/features/workbench/authority-mode";
import {
  resolveDefaultCallerContext,
  stripBrowserSuppliedAuthorityHeaders,
} from "@/features/workbench/caller-context";
import type { ResolvedPrincipal } from "@/features/workbench/principal-credential";

const ADVISOR_COCKPIT_ROUTE_PREFIX = "api/v1/advisor-cockpit";
const ADVISOR_COCKPIT_AUTH_MODE_ENV = "WORKBENCH_ADVISOR_COCKPIT_AUTH_MODE";
const READ_CAPABILITY = "advisory.advisor_cockpit.read";
const ACKNOWLEDGE_CAPABILITY = "advisory.advisor_cockpit.acknowledge";
const DEFAULT_DEVELOPMENT_AUTHORITY = {
  actorId: "advisor_sg_001",
  legalEntityCode: "SGPB",
  principalStatus: "ACTIVE",
  portfolioIds: "PB_SG_GLOBAL_BAL_001",
} as const;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const AUTHORITY_QUERY_PARAMETERS = new Set([
  "actor_id",
  "advisor_id",
  "authorized_advisor_id",
  "authorized_portfolio_id",
  "booking_center_code",
  "caller_application",
  "caller_capabilities",
  "capabilities",
  "legal_entity_code",
  "principal_status",
  "region",
  "role",
  "tenant_id",
]);
const AUTHORITY_BODY_FIELDS = new Set([
  ...AUTHORITY_QUERY_PARAMETERS,
  "acknowledged_by",
]);

type AdvisorCockpitAuthorityRejection =
  | "authenticated_principal_required"
  | "development_authority_not_allowed"
  | "invalid_authority_mode"
  | "invalid_advisor_cockpit_configuration"
  | "invalid_advisor_cockpit_request"
  | "advisor_cockpit_scope_not_entitled"
  | "unsupported_advisor_cockpit_route";

export type AdvisorCockpitAuthorityResolution =
  | { status: "not_applicable" }
  | {
      status: "applied";
      mode: "development_configured" | "authenticated_session";
    }
  | { status: "rejected"; reason: AdvisorCockpitAuthorityRejection };

export function applyAdvisorCockpitCallerContextHeaders(
  headers: Headers,
  request: {
    method: string;
    upstreamPath: string;
    searchParams: URLSearchParams;
    bodyText?: string;
    verifiedPrincipal?: ResolvedPrincipal;
  },
): AdvisorCockpitAuthorityResolution {
  if (!isAdvisorCockpitPath(request.upstreamPath)) {
    return { status: "not_applicable" };
  }

  stripBrowserSuppliedAuthorityHeaders(headers);

  const capability = resolveAdvisorCockpitCapability(request);
  if (!capability) {
    return { status: "rejected", reason: "unsupported_advisor_cockpit_route" };
  }
  if (hasAuthorityQueryParameter(request.searchParams)) {
    return { status: "rejected", reason: "invalid_advisor_cockpit_request" };
  }
  if (request.bodyText && containsAuthorityBodyField(request.bodyText)) {
    return { status: "rejected", reason: "invalid_advisor_cockpit_request" };
  }

  const submittedPortfolioIds = request.searchParams.getAll("portfolio_id");
  const portfolioId = submittedPortfolioIds[0]?.trim();
  if (
    submittedPortfolioIds.length !== 1 ||
    !portfolioId ||
    !IDENTIFIER_PATTERN.test(portfolioId)
  ) {
    return { status: "rejected", reason: "invalid_advisor_cockpit_request" };
  }

  const authorityMode = resolveAdvisorCockpitAuthorityMode();
  if (
    authorityMode !== "development_configured" &&
    authorityMode !== "authenticated_session"
  ) {
    return { status: "rejected", reason: authorityMode };
  }
  if (authorityMode === "authenticated_session") {
    if (!request.verifiedPrincipal) {
      return { status: "rejected", reason: "authenticated_principal_required" };
    }
    return request.verifiedPrincipal.portfolioScope.has(portfolioId)
      ? { status: "applied", mode: authorityMode }
      : { status: "rejected", reason: "advisor_cockpit_scope_not_entitled" };
  }

  const context = resolveAdvisorCockpitDevelopmentContext();
  if (!context) {
    return {
      status: "rejected",
      reason: "invalid_advisor_cockpit_configuration",
    };
  }
  if (!context.portfolioIds.has(portfolioId)) {
    return { status: "rejected", reason: "advisor_cockpit_scope_not_entitled" };
  }

  headers.set("X-Actor-Id", context.actorId);
  headers.set("X-Caller-Application", context.callerApplication);
  headers.set("X-Tenant-Id", context.tenantId);
  headers.set("X-Region", context.region);
  headers.set("X-Booking-Center-Code", context.bookingCenterCode);
  headers.set("X-Legal-Entity-Code", context.legalEntityCode);
  headers.set("X-Role", "ADVISOR");
  headers.set("X-Caller-Capabilities", capability);
  headers.set("X-Principal-Status", context.principalStatus);
  headers.set("X-Authorized-Advisor-Id", context.actorId);
  headers.set("X-Authorized-Portfolio-Id", portfolioId);

  return { status: "applied", mode: authorityMode };
}

function isAdvisorCockpitPath(upstreamPath: string): boolean {
  return (
    upstreamPath === ADVISOR_COCKPIT_ROUTE_PREFIX ||
    upstreamPath.startsWith(`${ADVISOR_COCKPIT_ROUTE_PREFIX}/`)
  );
}

export function resolveAdvisorCockpitCapability({
  method,
  upstreamPath,
}: {
  method: string;
  upstreamPath: string;
}): string | undefined {
  if (
    method === "GET" &&
    (upstreamPath === `${ADVISOR_COCKPIT_ROUTE_PREFIX}/actions` ||
      upstreamPath === `${ADVISOR_COCKPIT_ROUTE_PREFIX}/preparation-packets` ||
      upstreamPath === `${ADVISOR_COCKPIT_ROUTE_PREFIX}/snapshot` ||
      upstreamPath === `${ADVISOR_COCKPIT_ROUTE_PREFIX}/supportability` ||
      /^api\/v1\/advisor-cockpit\/actions\/[^/]+$/.test(upstreamPath))
  ) {
    return READ_CAPABILITY;
  }
  if (
    method === "POST" &&
    /^api\/v1\/advisor-cockpit\/actions\/[^/]+\/acknowledgements$/.test(
      upstreamPath,
    )
  ) {
    return ACKNOWLEDGE_CAPABILITY;
  }
  return undefined;
}

export function resolveAdvisorCockpitAuthorityMode() {
  return resolveConfiguredAuthorityMode(ADVISOR_COCKPIT_AUTH_MODE_ENV);
}

function hasAuthorityQueryParameter(searchParams: URLSearchParams): boolean {
  return [...searchParams.keys()].some((key) =>
    AUTHORITY_QUERY_PARAMETERS.has(key.toLowerCase()),
  );
}

function containsAuthorityBodyField(bodyText: string): boolean {
  try {
    return hasAuthorityField(JSON.parse(bodyText));
  } catch {
    return true;
  }
}

function hasAuthorityField(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(hasAuthorityField);
  }
  return Object.entries(value).some(
    ([key, nestedValue]) =>
      AUTHORITY_BODY_FIELDS.has(key.toLowerCase()) || hasAuthorityField(nestedValue),
  );
}

function resolveAdvisorCockpitDevelopmentContext() {
  const defaults = resolveDefaultCallerContext();
  const actorId =
    process.env.WORKBENCH_ADVISOR_COCKPIT_ACTOR_ID?.trim() ||
    DEFAULT_DEVELOPMENT_AUTHORITY.actorId;
  const legalEntityCode =
    process.env.WORKBENCH_ADVISOR_COCKPIT_LEGAL_ENTITY_CODE?.trim() ||
    DEFAULT_DEVELOPMENT_AUTHORITY.legalEntityCode;
  const principalStatus =
    process.env.WORKBENCH_ADVISOR_COCKPIT_PRINCIPAL_STATUS?.trim().toUpperCase() ||
    DEFAULT_DEVELOPMENT_AUTHORITY.principalStatus;
  const portfolioIds = new Set(
    (
      process.env.WORKBENCH_ADVISOR_COCKPIT_PORTFOLIO_IDS?.trim() ||
      DEFAULT_DEVELOPMENT_AUTHORITY.portfolioIds
    )
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const context = {
    actorId,
    callerApplication: defaults.callerApplication,
    tenantId: process.env.WORKBENCH_ADVISOR_COCKPIT_TENANT_ID?.trim() || defaults.tenantId,
    region: process.env.WORKBENCH_ADVISOR_COCKPIT_REGION?.trim() || defaults.region,
    bookingCenterCode:
      process.env.WORKBENCH_ADVISOR_COCKPIT_BOOKING_CENTER_CODE?.trim() ||
      defaults.bookingCenterCode,
    legalEntityCode,
    principalStatus,
    portfolioIds,
  };

  if (
    Object.entries(context).some(
      ([key, value]) =>
        key !== "portfolioIds" && !IDENTIFIER_PATTERN.test(String(value).trim()),
    ) ||
    principalStatus !== "ACTIVE" ||
    portfolioIds.size === 0 ||
    [...portfolioIds].some((portfolioId) => !IDENTIFIER_PATTERN.test(portfolioId))
  ) {
    return null;
  }
  return context;
}
