import { resolveConfiguredAuthorityMode } from "./authority-mode";
import { prepareIdeaExplanationBody } from "./idea-explanation-request-authority";
import type { ResolvedPrincipal } from "./principal-credential";

const DEFAULT_CALLER_CONTEXT_HEADERS = {
  "X-Actor-Id": "workbench-system",
  "X-Caller-Application": "lotus-workbench",
  "X-Tenant-Id": "tenant-sg",
  "X-Region": "APAC",
  "X-Booking-Center-Code": "SG",
  "X-Role": "advisor",
} as const;

const DEFAULT_DPM_CONTEXT = {
  mandateId: "MANDATE_PB_SG_GLOBAL_BAL_001",
  modelPortfolioId: "MODEL_PB_SG_GLOBAL_BAL_DPM",
  bookingCenterCode: "Singapore",
  sourceAsOfDate: "",
  commandCenterTenantId: "default",
  commandCenterPortfolioManagerId: "PM_SG_DPM_001",
  commandCenterBookId: "BOOK_SG_BALANCED_DPM",
  commandCenterAsOfDate: "2026-05-03",
} as const;

const CALLER_CONTEXT_ENV_OVERRIDES: Record<
  keyof typeof DEFAULT_CALLER_CONTEXT_HEADERS,
  string
> = {
  "X-Actor-Id": "WORKBENCH_BFF_ACTOR_ID",
  "X-Caller-Application": "WORKBENCH_BFF_CALLER_APPLICATION",
  "X-Tenant-Id": "WORKBENCH_BFF_TENANT_ID",
  "X-Region": "WORKBENCH_BFF_REGION",
  "X-Booking-Center-Code": "WORKBENCH_BFF_BOOKING_CENTER_CODE",
  "X-Role": "WORKBENCH_BFF_ROLE",
};

const IDEA_CALLER_CONTEXT_ENV_OVERRIDES = {
  subject: "WORKBENCH_IDEA_CALLER_SUBJECT",
  roles: "WORKBENCH_IDEA_CALLER_ROLES",
  tenantIds: "WORKBENCH_IDEA_CALLER_TENANT_IDS",
  bookIds: "WORKBENCH_IDEA_CALLER_BOOK_IDS",
  portfolioIds: "WORKBENCH_IDEA_CALLER_PORTFOLIO_IDS",
  clientIds: "WORKBENCH_IDEA_CALLER_CLIENT_IDS",
} as const;

const DEFAULT_IDEA_CALLER_CONTEXT = {
  subject: "workbench-advisor",
  roles: "advisor",
  tenantIds: "tenant-private-bank-sg",
  bookIds: "book-advisor-001",
  portfolioIds: "PB_SG_GLOBAL_BAL_001",
  clientIds: "client-001",
} as const;

export const SERVER_DERIVED_CALLER_AUTHORITY_HEADERS = [
  "X-Actor-Id",
  "X-Caller-Application",
  "X-Tenant-Id",
  "X-Region",
  "X-Booking-Center-Code",
  "X-Legal-Entity-Code",
  "X-Role",
  "X-Caller-Subject",
  "X-Caller-Roles",
  "X-Caller-Capabilities",
  "X-Caller-Tenant-Ids",
  "X-Caller-Book-Ids",
  "X-Caller-Portfolio-Ids",
  "X-Caller-Client-Ids",
  "X-Capabilities",
  "X-Service-Identity",
  "X-Principal-Status",
  "X-Authorized-Advisor-Id",
  "X-Authorized-Proposal-Id",
  "X-Authorized-Portfolio-Id",
] as const;

export const BFF_PRINCIPAL_SESSION_CONTRACT_POSTURE = {
  schemaVersion: "lotus-platform.bff-principal-session.v1",
  certificationSchemaVersion:
    "lotus-platform.bff-principal-session-certification.v1",
  contractId: "lotus-platform-authenticated-bff-principal-session",
  contractVersion: "1.0.0",
  consumer: "lotus-workbench",
  upstreamService: "lotus-gateway",
  productSafeDenialCode: "AUTHENTICATED_PRINCIPAL_REQUIRED",
  certificationStatus: "not_certified",
  productionIdentityCertified: false,
  supportedFeaturePromoted: false,
  localDevFixtureNonCertifying: true,
} as const;

export const FORBIDDEN_BROWSER_AUTHORITY_HEADERS = [
  ...SERVER_DERIVED_CALLER_AUTHORITY_HEADERS,
  "Authorization",
  "Cookie",
  "Proxy-Authorization",
  "X-Forwarded-User",
  "X-Forwarded-Email",
  "X-Auth-Request-User",
  "X-Auth-Request-Email",
  "X-Authenticated-User",
  "X-Authenticated-Email",
  "X-Session-Id",
] as const;

export function stripBrowserSuppliedAuthorityHeaders(headers: Headers) {
  for (const headerName of FORBIDDEN_BROWSER_AUTHORITY_HEADERS) {
    headers.delete(headerName);
  }
}

const REPORTING_CALLER_CONTEXT_ENV_OVERRIDES = {
  portfolioIds: "WORKBENCH_REPORTING_CALLER_PORTFOLIO_IDS",
  role: "WORKBENCH_REPORTING_CALLER_ROLE",
} as const;

const DEFAULT_REPORTING_CALLER_CONTEXT = {
  portfolioIds: "PB_SG_GLOBAL_BAL_001",
  role: "client_advisor",
} as const;

const IDEA_AUTH_MODE_ENV = "WORKBENCH_IDEA_AUTH_MODE";
const REPORTING_AUTH_MODE_ENV = "WORKBENCH_REPORTING_AUTH_MODE";
const ADVISOR_BOOK_READ_CAPABILITY = "advisor.book.read";
const SUPPORTED_ADVISOR_BOOK_ROLES = new Set([
  "ADVISOR",
  "RELATIONSHIP_MANAGER",
  "PORTFOLIO_MANAGER",
]);
const SUPPORTED_REPORTING_ROLES = ["client_advisor", "portfolio_manager"] as const;
type IdeaAuthorityResolution =
  | { status: "not_applicable" }
  | {
      status: "applied";
      mode: "development_configured" | "authenticated_session";
      bodyText?: string;
      presentationReceiptTenantId?: string;
    }
  | {
      status: "rejected";
      reason:
        | "authenticated_principal_required"
        | "development_authority_not_allowed"
        | "invalid_idea_configuration"
        | "invalid_idea_request"
        | "invalid_authority_mode"
        | "unsupported_idea_route";
    };

export type ReportingAuthorityResolution =
  | { status: "not_applicable" }
  | {
      status: "applied";
      mode: "development_configured" | "authenticated_session";
      admittedSearch: string;
    }
  | {
      status: "rejected";
      reason:
        | "authenticated_principal_required"
        | "development_authority_not_allowed"
        | "invalid_authority_mode"
        | "invalid_reporting_configuration"
        | "invalid_reporting_request"
        | "reporting_scope_not_entitled";
    };

function defaultCallerContextValue(
  headerName: keyof typeof DEFAULT_CALLER_CONTEXT_HEADERS
) {
  const configured = process.env[CALLER_CONTEXT_ENV_OVERRIDES[headerName]]?.trim();
  return configured || DEFAULT_CALLER_CONTEXT_HEADERS[headerName];
}

export function resolveDefaultCallerContext() {
  return {
    actorId: defaultCallerContextValue("X-Actor-Id"),
    callerApplication: defaultCallerContextValue("X-Caller-Application"),
    tenantId: defaultCallerContextValue("X-Tenant-Id"),
    region: defaultCallerContextValue("X-Region"),
    bookingCenterCode: defaultCallerContextValue("X-Booking-Center-Code"),
    role: defaultCallerContextValue("X-Role"),
  };
}

export function resolveAdvisorBookDevelopmentContext() {
  const defaults = resolveDefaultCallerContext();
  const identity = resolveDevelopmentCallerIdentity(defaults);
  const role = process.env.WORKBENCH_ADVISOR_BOOK_ROLE?.trim() || "ADVISOR";

  if (!identity || !SUPPORTED_ADVISOR_BOOK_ROLES.has(role)) {
    return null;
  }
  return { ...identity, role };
}

function resolveDevelopmentCallerIdentity(defaults = resolveDefaultCallerContext()) {
  const identity = {
    actorId: process.env.WORKBENCH_ADVISOR_BOOK_ACTOR_ID?.trim() || "PM_SG_001",
    callerApplication: defaults.callerApplication,
    tenantId: process.env.WORKBENCH_ADVISOR_BOOK_TENANT_ID?.trim() || defaults.tenantId,
    region: process.env.WORKBENCH_ADVISOR_BOOK_REGION?.trim() || defaults.region,
    bookingCenterCode:
      process.env.WORKBENCH_ADVISOR_BOOK_BOOKING_CENTER_CODE?.trim() || "Singapore",
  };
  return Object.values(identity).some((value) => !value) ? null : identity;
}

function resolveReportingDevelopmentContext() {
  const identity = resolveDevelopmentCallerIdentity();
  const role =
    process.env[REPORTING_CALLER_CONTEXT_ENV_OVERRIDES.role]?.trim() ||
    DEFAULT_REPORTING_CALLER_CONTEXT.role;
  return identity && isSupportedReportingRole(role)
    ? { ...identity, role }
    : null;
}

function isSupportedReportingRole(
  role: string,
): role is (typeof SUPPORTED_REPORTING_ROLES)[number] {
  return (SUPPORTED_REPORTING_ROLES as readonly string[]).includes(role);
}

export function resolveDefaultDpmContext() {
  return {
    mandateId:
      process.env.WORKBENCH_DPM_MANDATE_ID?.trim() ||
      DEFAULT_DPM_CONTEXT.mandateId,
    modelPortfolioId:
      process.env.WORKBENCH_DPM_MODEL_PORTFOLIO_ID?.trim() ||
      DEFAULT_DPM_CONTEXT.modelPortfolioId,
    bookingCenterCode:
      process.env.WORKBENCH_DPM_BOOKING_CENTER_CODE?.trim() ||
      DEFAULT_DPM_CONTEXT.bookingCenterCode,
    sourceAsOfDate:
      process.env.WORKBENCH_DPM_SOURCE_AS_OF_DATE?.trim() ||
      DEFAULT_DPM_CONTEXT.sourceAsOfDate,
    commandCenterTenantId:
      process.env.WORKBENCH_DPM_COMMAND_CENTER_TENANT_ID?.trim() ||
      DEFAULT_DPM_CONTEXT.commandCenterTenantId,
    commandCenterPortfolioManagerId:
      process.env.WORKBENCH_DPM_COMMAND_CENTER_PORTFOLIO_MANAGER_ID?.trim() ||
      DEFAULT_DPM_CONTEXT.commandCenterPortfolioManagerId,
    commandCenterBookId:
      process.env.WORKBENCH_DPM_COMMAND_CENTER_BOOK_ID?.trim() ||
      DEFAULT_DPM_CONTEXT.commandCenterBookId,
    commandCenterAsOfDate:
      process.env.WORKBENCH_DPM_COMMAND_CENTER_AS_OF_DATE?.trim() ||
      DEFAULT_DPM_CONTEXT.commandCenterAsOfDate,
  };
}

export function applyDefaultCallerContextHeaders(headers: Headers) {
  for (const headerName of Object.keys(DEFAULT_CALLER_CONTEXT_HEADERS) as Array<
    keyof typeof DEFAULT_CALLER_CONTEXT_HEADERS
  >) {
    headers.set(headerName, defaultCallerContextValue(headerName));
  }
}

export function applyIdeaRouteCallerContextHeaders(
  headers: Headers,
  request: {
    method: string;
    upstreamPath: string;
    bodyText?: string;
    verifiedPrincipal?: ResolvedPrincipal;
  },
): IdeaAuthorityResolution {
  if (!request.upstreamPath.startsWith("api/v1/ideas/")) {
    return { status: "not_applicable" };
  }

  stripBrowserSuppliedAuthorityHeaders(headers);

  const capability = resolveIdeaRouteCapability(request);
  if (!capability) {
    return { status: "rejected", reason: "unsupported_idea_route" };
  }

  const authorityMode = resolveIdeaAuthorityMode();
  if (
    authorityMode !== "development_configured" &&
    authorityMode !== "authenticated_session"
  ) {
    return { status: "rejected", reason: authorityMode };
  }
  if (authorityMode === "authenticated_session" && !request.verifiedPrincipal) {
    return { status: "rejected", reason: "authenticated_principal_required" };
  }

  const tenantIds = request.verifiedPrincipal
    ? [request.verifiedPrincipal.tenantId]
    : configuredIdeaCallerTenantIds();
  const preparedBody = prepareIdeaRouteBody(
    request,
    tenantIds,
    headers.get("Idempotency-Key"),
  );
  if (preparedBody.status === "rejected") {
    return preparedBody;
  }

  if (authorityMode === "authenticated_session") {
    return {
      status: "applied",
      mode: authorityMode,
      bodyText: preparedBody.bodyText,
      presentationReceiptTenantId: preparedBody.presentationReceiptTenantId,
    };
  }

  const defaultContext = resolveDefaultCallerContext();
  headers.set("X-Actor-Id", defaultContext.actorId);
  headers.set("X-Caller-Application", defaultContext.callerApplication);
  headers.set("X-Tenant-Id", defaultContext.tenantId);
  headers.set("X-Region", defaultContext.region);
  headers.set("X-Booking-Center-Code", defaultContext.bookingCenterCode);
  headers.set("X-Role", defaultContext.role);
  headers.set("X-Caller-Subject", configuredIdeaCallerSubject());
  headers.set(
    "X-Caller-Roles",
    process.env[IDEA_CALLER_CONTEXT_ENV_OVERRIDES.roles]?.trim() ||
      DEFAULT_IDEA_CALLER_CONTEXT.roles,
  );
  headers.set("X-Caller-Capabilities", capability);
  headers.set("X-Caller-Tenant-Ids", tenantIds.join(","));
  headers.set(
    "X-Caller-Book-Ids",
    process.env[IDEA_CALLER_CONTEXT_ENV_OVERRIDES.bookIds]?.trim() ||
      DEFAULT_IDEA_CALLER_CONTEXT.bookIds,
  );
  headers.set(
    "X-Caller-Portfolio-Ids",
    process.env[IDEA_CALLER_CONTEXT_ENV_OVERRIDES.portfolioIds]?.trim() ||
      DEFAULT_IDEA_CALLER_CONTEXT.portfolioIds,
  );
  headers.set(
    "X-Caller-Client-Ids",
    process.env[IDEA_CALLER_CONTEXT_ENV_OVERRIDES.clientIds]?.trim() ||
      DEFAULT_IDEA_CALLER_CONTEXT.clientIds,
  );

  return {
    status: "applied",
    mode: authorityMode,
    bodyText: preparedBody.bodyText,
    presentationReceiptTenantId: preparedBody.presentationReceiptTenantId,
  };
}

function configuredIdeaCallerTenantIds(): string[] {
  const configured =
    process.env[IDEA_CALLER_CONTEXT_ENV_OVERRIDES.tenantIds]?.trim() ||
    DEFAULT_IDEA_CALLER_CONTEXT.tenantIds;
  return [...new Set(configured.split(",").map((tenantId) => tenantId.trim()).filter(Boolean))];
}

function prepareIdeaRouteBody(
  request: { method: string; upstreamPath: string; bodyText?: string },
  tenantIds: string[],
  idempotencyKey: string | null,
):
  | {
      status: "ready";
      bodyText?: string;
      presentationReceiptTenantId?: string;
    }
  | { status: "rejected"; reason: "invalid_idea_configuration" | "invalid_idea_request" } {
  const explanationMatch = request.upstreamPath.match(
    /^api\/v1\/ideas\/candidates\/([^/]+)\/ai-explanations$/,
  );
  if (request.method === "POST" && explanationMatch) {
    return prepareIdeaExplanationBody(
      request.bodyText,
      explanationMatch[1],
      idempotencyKey,
    );
  }
  const isPresentationReceipt =
    request.method === "POST" &&
    /^api\/v1\/ideas\/candidates\/[^/]+\/presentation-receipts$/.test(
      request.upstreamPath,
    );
  if (!isPresentationReceipt) {
    return { status: "ready", bodyText: request.bodyText };
  }
  if (tenantIds.length !== 1) {
    return { status: "rejected", reason: "invalid_idea_configuration" };
  }
  if (!request.bodyText) {
    return { status: "rejected", reason: "invalid_idea_request" };
  }
  try {
    const body = JSON.parse(request.bodyText) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { status: "rejected", reason: "invalid_idea_request" };
    }
    const requestFields = body as Record<string, unknown>;
    if ("tenantId" in requestFields || "tenant_id" in requestFields) {
      return { status: "rejected", reason: "invalid_idea_request" };
    }
    return {
      status: "ready",
      bodyText: JSON.stringify({ ...requestFields, tenantId: tenantIds[0] }),
      presentationReceiptTenantId: tenantIds[0],
    };
  } catch {
    return { status: "rejected", reason: "invalid_idea_request" };
  }
}

export function matchesIdeaPresentationReceiptTenantAuthority(
  bodyText: string,
  expectedTenantId: string,
): boolean {
  try {
    const body = JSON.parse(bodyText) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return false;
    }
    const envelope = body as Record<string, unknown>;
    const payload =
      envelope.data &&
      typeof envelope.data === "object" &&
      !Array.isArray(envelope.data)
        ? (envelope.data as Record<string, unknown>)
        : envelope;
    const receipt = payload.receipt;
    return Boolean(
      receipt &&
        typeof receipt === "object" &&
        !Array.isArray(receipt) &&
        (receipt as Record<string, unknown>).tenantId === expectedTenantId,
    );
  } catch {
    return false;
  }
}

function configuredIdeaCallerSubject(): string {
  return (
    process.env[IDEA_CALLER_CONTEXT_ENV_OVERRIDES.subject]?.trim() ||
    DEFAULT_IDEA_CALLER_CONTEXT.subject
  );
}

export function applyReportOrderingRouteCallerContextHeaders(
  headers: Headers,
  request: {
    method: string;
    upstreamPath: string;
    searchParams: URLSearchParams;
    bodyText?: string;
    verifiedPrincipal?: ResolvedPrincipal;
  },
): ReportingAuthorityResolution {
  if (!isReportOrderingWorkspaceRoute(request.method, request.upstreamPath)) {
    return { status: "not_applicable" };
  }

  stripBrowserSuppliedAuthorityHeaders(headers);

  const authorityMode = resolveReportingAuthorityMode();
  if (
    authorityMode !== "development_configured" &&
    authorityMode !== "authenticated_session"
  ) {
    return { status: "rejected", reason: authorityMode };
  }

  const portfolioIds = request.verifiedPrincipal
    ? [...request.verifiedPrincipal.portfolioScope]
    : configuredReportingPortfolioIds();
  if (portfolioIds.length === 0) {
    return authorityMode === "authenticated_session"
      ? { status: "rejected", reason: "reporting_scope_not_entitled" }
      : { status: "rejected", reason: "invalid_reporting_configuration" };
  }

  const requestPosture = validateReportingWorkspaceRequest(request, new Set(portfolioIds));
  if (requestPosture.status === "rejected") {
    return requestPosture;
  }

  if (authorityMode === "authenticated_session") {
    return request.verifiedPrincipal
      ? {
          status: "applied",
          mode: authorityMode,
          admittedSearch: requestPosture.admittedSearch,
        }
      : { status: "rejected", reason: "authenticated_principal_required" };
  }

  const context = resolveReportingDevelopmentContext();
  if (!context) {
    return { status: "rejected", reason: "invalid_reporting_configuration" };
  }
  headers.set("X-Actor-Id", context.actorId);
  headers.set("X-Caller-Application", context.callerApplication);
  headers.set("X-Tenant-Id", context.tenantId);
  headers.set("X-Region", context.region);
  headers.set("X-Booking-Center-Code", context.bookingCenterCode);
  headers.set("X-Role", context.role);
  headers.set("X-Caller-Portfolio-Ids", portfolioIds.join(","));
  headers.set("X-Caller-Capabilities", ADVISOR_BOOK_READ_CAPABILITY);

  return {
    status: "applied",
    mode: authorityMode,
    admittedSearch: requestPosture.admittedSearch,
  };
}

export function resolveIdeaAuthorityMode():
  | "development_configured"
  | "authenticated_session"
  | "development_authority_not_allowed"
  | "invalid_authority_mode" {
  return resolveConfiguredAuthorityMode(IDEA_AUTH_MODE_ENV);
}

export function resolveReportingAuthorityMode() {
  return resolveConfiguredAuthorityMode(REPORTING_AUTH_MODE_ENV);
}

export function resolveReportingRouteCapability({
  method,
  upstreamPath,
}: {
  method: string;
  upstreamPath: string;
}): string | undefined {
  return isReportOrderingWorkspaceRoute(method, upstreamPath)
    ? ADVISOR_BOOK_READ_CAPABILITY
    : undefined;
}

export function resolveReportingRequestedPortfolioIds(request: {
  upstreamPath: string;
  searchParams: URLSearchParams;
  bodyText?: string;
}): string[] {
  if (request.upstreamPath === "api/v1/report-ordering/options") {
    return request.searchParams.getAll("scopeId").map((value) => value.trim()).filter(Boolean);
  }
  if (request.upstreamPath === "api/v1/report-jobs") {
    return request.searchParams
      .getAll("portfolioId")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return request.upstreamPath === "api/v1/report-batches"
    ? (readBatchPortfolioIds(request.bodyText) ?? [])
    : (readSubmittedPortfolioIds(request.bodyText) ?? []);
}

function isReportOrderingWorkspaceRoute(method: string, upstreamPath: string): boolean {
  return (
    (method === "GET" && upstreamPath === "api/v1/report-ordering/options") ||
    (method === "POST" && upstreamPath === "api/v1/reports/portfolio-reviews") ||
    (method === "GET" && upstreamPath === "api/v1/report-jobs") ||
    (method === "POST" && upstreamPath === "api/v1/report-batches") ||
    (method === "GET" && /^api\/v1\/report-batches\/[^/]+$/.test(upstreamPath))
  );
}

function configuredReportingPortfolioIds(): string[] {
  const configured =
    process.env[REPORTING_CALLER_CONTEXT_ENV_OVERRIDES.portfolioIds]?.trim() ||
    DEFAULT_REPORTING_CALLER_CONTEXT.portfolioIds;
  return [...new Set(configured.split(",").map((item) => item.trim()).filter(Boolean))];
}

function validateReportingWorkspaceRequest(
  request: {
    method: string;
    upstreamPath: string;
    searchParams: URLSearchParams;
    bodyText?: string;
  },
  entitledPortfolioIds: ReadonlySet<string>,
):
  | { status: "ready"; admittedSearch: string }
  | {
      status: "rejected";
      reason: "invalid_reporting_request" | "reporting_scope_not_entitled";
    } {
  if (request.upstreamPath === "api/v1/report-ordering/options") {
    const scopeType = readSingleQueryValue(request.searchParams, "scopeType");
    const scopeId = readSingleQueryValue(request.searchParams, "scopeId");
    const asOfDates = request.searchParams.getAll("asOfDate");
    const reportingCurrencies = request.searchParams.getAll("reportingCurrency");
    if (
      scopeType !== "portfolio" ||
      !scopeId ||
      asOfDates.length > 1 ||
      reportingCurrencies.length > 1 ||
      (asOfDates.length === 1 && !asOfDates[0]?.trim()) ||
      (reportingCurrencies.length === 1 && !reportingCurrencies[0]?.trim())
    ) {
      return { status: "rejected", reason: "invalid_reporting_request" };
    }
    if (!entitledPortfolioIds.has(scopeId)) {
      return { status: "rejected", reason: "reporting_scope_not_entitled" };
    }
    return {
      status: "ready",
      admittedSearch: replaceQueryValues(request.searchParams, {
        scopeType,
        scopeId,
        ...(asOfDates.length === 1 ? { asOfDate: asOfDates[0].trim() } : {}),
        ...(reportingCurrencies.length === 1
          ? { reportingCurrency: reportingCurrencies[0].trim() }
          : {}),
      }),
    };
  }

  if (request.upstreamPath === "api/v1/report-jobs") {
    const portfolioId = readSingleQueryValue(request.searchParams, "portfolioId");
    const reportType = readSingleQueryValue(request.searchParams, "reportType");
    if (!portfolioId || reportType !== "portfolio_review") {
      return { status: "rejected", reason: "invalid_reporting_request" };
    }
    if (!entitledPortfolioIds.has(portfolioId)) {
      return { status: "rejected", reason: "reporting_scope_not_entitled" };
    }
    return {
      status: "ready",
      admittedSearch: replaceQueryValues(request.searchParams, {
        portfolioId,
        reportType,
      }),
    };
  }

  if (
    request.method === "GET" &&
    /^api\/v1\/report-batches\/[^/]+$/.test(request.upstreamPath)
  ) {
    return { status: "ready", admittedSearch: request.searchParams.toString() };
  }

  const submittedPortfolioIds =
    request.upstreamPath === "api/v1/report-batches"
      ? readBatchPortfolioIds(request.bodyText)
      : readSubmittedPortfolioIds(request.bodyText);
  const exactlyOnePortfolio = request.upstreamPath !== "api/v1/report-batches";
  if (!submittedPortfolioIds || (exactlyOnePortfolio && submittedPortfolioIds.length !== 1)) {
    return { status: "rejected", reason: "invalid_reporting_request" };
  }
  return submittedPortfolioIds.every((portfolioId) => entitledPortfolioIds.has(portfolioId))
    ? { status: "ready", admittedSearch: request.searchParams.toString() }
    : { status: "rejected", reason: "reporting_scope_not_entitled" };
}

function readSingleQueryValue(searchParams: URLSearchParams, key: string): string | null {
  const values = searchParams.getAll(key);
  if (values.length !== 1) {
    return null;
  }
  return values[0]?.trim() || null;
}

function replaceQueryValues(
  searchParams: URLSearchParams,
  admittedValues: Readonly<Record<string, string>>,
): string {
  const admittedSearchParams = new URLSearchParams(searchParams);
  for (const [key, value] of Object.entries(admittedValues)) {
    admittedSearchParams.delete(key);
    admittedSearchParams.append(key, value);
  }
  return admittedSearchParams.toString();
}

function readBatchPortfolioIds(bodyText: string | undefined): string[] | null {
  if (!bodyText) {
    return null;
  }
  try {
    const body = JSON.parse(bodyText) as Record<string, unknown>;
    if (body.selector_mode !== "explicit_portfolio_list") {
      return null;
    }
    const portfolioIds = body.portfolio_ids;
    if (
      !Array.isArray(portfolioIds) ||
      portfolioIds.length < 2 ||
      portfolioIds.some((portfolioId) => typeof portfolioId !== "string" || !portfolioId.trim())
    ) {
      return null;
    }
    const normalized = portfolioIds.map((portfolioId) => String(portfolioId).trim());
    return new Set(normalized).size === normalized.length ? normalized : null;
  } catch {
    return null;
  }
}

function readSubmittedPortfolioIds(bodyText: string | undefined): string[] | null {
  if (!bodyText) {
    return null;
  }
  try {
    const body = JSON.parse(bodyText) as Record<string, unknown>;
    const portfolioScope = body.portfolio_scope;
    if (!portfolioScope || typeof portfolioScope !== "object" || Array.isArray(portfolioScope)) {
      return null;
    }
    const portfolioIds = (portfolioScope as Record<string, unknown>).portfolio_ids;
    if (
      !Array.isArray(portfolioIds) ||
      portfolioIds.some((portfolioId) => typeof portfolioId !== "string" || !portfolioId.trim())
    ) {
      return null;
    }
    return portfolioIds.map((portfolioId) => String(portfolioId).trim());
  } catch {
    return null;
  }
}

export function resolveIdeaRouteCapability({
  method,
  upstreamPath,
}: {
  method: string;
  upstreamPath: string;
}): string | undefined {
  if (
    method === "GET" &&
    upstreamPath === "api/v1/ideas/review-queues/advisor"
  ) {
    return "idea.review.queue.read";
  }

  if (
    method === "GET" &&
    /^api\/v1\/ideas\/candidates\/[^/]+$/.test(upstreamPath)
  ) {
    return "idea.candidate.detail.read";
  }

  const actionCapability = {
    "ai-explanations": "idea.ai-explanation.generate",
    "review-actions": "idea.review.record",
    feedback: "idea.feedback.record",
    "conversion-intents": "idea.conversion.intent.record",
    "presentation-receipts": "idea.presentation-receipt.record",
  } as const;
  const actionMatch = upstreamPath.match(
    /^api\/v1\/ideas\/candidates\/[^/]+\/(ai-explanations|review-actions|feedback|conversion-intents|presentation-receipts)$/,
  );
  return method === "POST" && actionMatch
    ? actionCapability[actionMatch[1] as keyof typeof actionCapability]
    : undefined;
}
