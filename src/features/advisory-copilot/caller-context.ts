import { createGatewayRequestSignal } from "@/features/platform-runtime/gateway-request-policy";
import { resolveConfiguredAuthorityMode } from "@/features/workbench/authority-mode";
import {
  resolveDefaultCallerContext,
  stripBrowserSuppliedAuthorityHeaders,
} from "@/features/workbench/caller-context";
import type { ResolvedPrincipal } from "@/features/workbench/principal-credential";

const ADVISORY_COPILOT_AUTH_MODE_ENV = "WORKBENCH_ADVISORY_COPILOT_AUTH_MODE";
const ADVISORY_COPILOT_PORTFOLIO_IDS_ENV =
  "WORKBENCH_ADVISORY_COPILOT_PORTFOLIO_IDS";
const READ_CAPABILITY = "advisory.copilot.read";
const REVIEW_CAPABILITY = "advisory.copilot.review";
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const DEFAULT_DEVELOPMENT_REVIEW_AUTHORITY = {
  actorId: "desk_head_sg_001",
  tenantId: "tenant-sg-001",
  legalEntityCode: "PB_SG",
  role: "ADVISORY_SUPERVISOR",
  principalStatus: "ACTIVE",
  portfolioIds: "PB_SG_GLOBAL_BAL_001",
} as const;

const AUTHORITY_BODY_FIELDS = new Set([
  "actor_id",
  "authorized_portfolio_id",
  "authorized_proposal_id",
  "capabilities",
  "legal_entity_code",
  "principal_status",
  "role",
  "tenant_id",
]);

type AdvisoryCopilotAuthorityRejection =
  | "authenticated_principal_required"
  | "development_authority_not_allowed"
  | "invalid_authority_mode"
  | "invalid_advisory_copilot_configuration"
  | "invalid_advisory_copilot_request"
  | "advisory_copilot_scope_not_entitled"
  | "advisory_copilot_scope_not_resolved";

export type AdvisoryCopilotAuthorityResolution =
  | { status: "not_applicable" }
  | {
      status: "applied";
      mode: "development_configured" | "authenticated_session";
    }
  | { status: "rejected"; reason: AdvisoryCopilotAuthorityRejection };

export async function applyAdvisoryCopilotCallerContextHeaders(
  headers: Headers,
  request: {
    method: string;
    upstreamPath: string;
    bodyText?: string;
    gatewayBaseUrl: string;
    verifiedPrincipal?: ResolvedPrincipal;
    gatewayCredential?: string;
  },
): Promise<AdvisoryCopilotAuthorityResolution> {
  if (!isAdvisoryCopilotReviewRoute(request.method, request.upstreamPath)) {
    return { status: "not_applicable" };
  }

  stripBrowserSuppliedAuthorityHeaders(headers);
  if (request.bodyText && containsAuthorityBodyField(request.bodyText)) {
    return { status: "rejected", reason: "invalid_advisory_copilot_request" };
  }

  const authorityMode = resolveAdvisoryCopilotAuthorityMode();
  if (
    authorityMode !== "development_configured" &&
    authorityMode !== "authenticated_session"
  ) {
    return { status: "rejected", reason: authorityMode };
  }
  if (
    authorityMode === "authenticated_session" &&
    (!request.verifiedPrincipal || !request.gatewayCredential)
  ) {
    return { status: "rejected", reason: "authenticated_principal_required" };
  }

  const context =
    authorityMode === "development_configured"
      ? resolveAdvisoryCopilotDevelopmentContext()
      : null;
  if (authorityMode === "development_configured" && !context) {
    return {
      status: "rejected",
      reason: "invalid_advisory_copilot_configuration",
    };
  }

  const scope = await resolveAdvisoryCopilotReviewScope({
    gatewayBaseUrl: request.gatewayBaseUrl,
    upstreamPath: request.upstreamPath,
    ...(context
      ? { developmentContext: context }
      : { gatewayCredential: request.gatewayCredential! }),
  });
  if (!scope) {
    return { status: "rejected", reason: "advisory_copilot_scope_not_resolved" };
  }

  if (authorityMode === "authenticated_session") {
    return request.verifiedPrincipal!.portfolioScope.has(scope.portfolioId)
      ? { status: "applied", mode: authorityMode }
      : { status: "rejected", reason: "advisory_copilot_scope_not_entitled" };
  }

  if (!context) {
    return {
      status: "rejected",
      reason: "invalid_advisory_copilot_configuration",
    };
  }

  if (!context.portfolioIds.has(scope.portfolioId)) {
    return { status: "rejected", reason: "advisory_copilot_scope_not_entitled" };
  }

  applyDevelopmentHeaders(headers, context, REVIEW_CAPABILITY);
  headers.set("X-Authorized-Proposal-Id", scope.proposalId);
  headers.set("X-Authorized-Portfolio-Id", scope.portfolioId);

  return { status: "applied", mode: authorityMode };
}

function isAdvisoryCopilotReviewRoute(method: string, upstreamPath: string): boolean {
  return (
    method === "POST" &&
    /^api\/v1\/advisory-copilot\/actions\/[^/]+\/reviews$/.test(upstreamPath)
  );
}

export function resolveAdvisoryCopilotAuthorityMode() {
  return resolveConfiguredAuthorityMode(ADVISORY_COPILOT_AUTH_MODE_ENV);
}

export function resolveAdvisoryCopilotCapability({
  method,
  upstreamPath,
}: {
  method: string;
  upstreamPath: string;
}): string | undefined {
  return isAdvisoryCopilotReviewRoute(method, upstreamPath)
    ? REVIEW_CAPABILITY
    : undefined;
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

function resolveAdvisoryCopilotDevelopmentContext() {
  const defaults = resolveDefaultCallerContext();
  const portfolioIds = new Set(
    (
      process.env[ADVISORY_COPILOT_PORTFOLIO_IDS_ENV]?.trim() ||
      DEFAULT_DEVELOPMENT_REVIEW_AUTHORITY.portfolioIds
    )
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const context = {
    actorId:
      process.env.WORKBENCH_ADVISORY_COPILOT_ACTOR_ID?.trim() ||
      DEFAULT_DEVELOPMENT_REVIEW_AUTHORITY.actorId,
    callerApplication: defaults.callerApplication,
    tenantId:
      process.env.WORKBENCH_ADVISORY_COPILOT_TENANT_ID?.trim() ||
      DEFAULT_DEVELOPMENT_REVIEW_AUTHORITY.tenantId,
    region: defaults.region,
    bookingCenterCode: defaults.bookingCenterCode,
    legalEntityCode:
      process.env.WORKBENCH_ADVISORY_COPILOT_LEGAL_ENTITY_CODE?.trim() ||
      DEFAULT_DEVELOPMENT_REVIEW_AUTHORITY.legalEntityCode,
    role:
      process.env.WORKBENCH_ADVISORY_COPILOT_ROLE?.trim() ||
      DEFAULT_DEVELOPMENT_REVIEW_AUTHORITY.role,
    principalStatus:
      process.env.WORKBENCH_ADVISORY_COPILOT_PRINCIPAL_STATUS?.trim().toUpperCase() ||
      DEFAULT_DEVELOPMENT_REVIEW_AUTHORITY.principalStatus,
    portfolioIds,
  };

  if (
    Object.entries(context).some(
      ([key, value]) =>
        key !== "portfolioIds" && !IDENTIFIER_PATTERN.test(String(value).trim()),
    ) ||
    context.principalStatus !== "ACTIVE" ||
    portfolioIds.size === 0 ||
    [...portfolioIds].some((portfolioId) => !IDENTIFIER_PATTERN.test(portfolioId))
  ) {
    return null;
  }
  return {
    ...context,
    legalEntityCode: context.legalEntityCode.toUpperCase(),
    role: context.role.toUpperCase(),
  };
}

type AdvisoryCopilotDevelopmentContext = NonNullable<
  ReturnType<typeof resolveAdvisoryCopilotDevelopmentContext>
>;

type AdvisoryCopilotReviewScope = {
  proposalId: string;
  portfolioId: string;
};

async function resolveAdvisoryCopilotReviewScope({
  developmentContext,
  gatewayCredential,
  gatewayBaseUrl,
  upstreamPath,
}: {
  developmentContext?: AdvisoryCopilotDevelopmentContext;
  gatewayCredential?: string;
  gatewayBaseUrl: string;
  upstreamPath: string;
}): Promise<AdvisoryCopilotReviewScope | null> {
  const runId = extractReviewRunId(upstreamPath);
  if (!runId) {
    return null;
  }

  const headers = new Headers();
  headers.set("Accept", "application/json");
  if (gatewayCredential) {
    headers.set("Authorization", `Bearer ${gatewayCredential}`);
  } else if (developmentContext) {
    applyDevelopmentHeaders(headers, developmentContext, READ_CAPABILITY);
  } else {
    return null;
  }

  try {
    const response = await fetch(
      `${gatewayBaseUrl}/api/v1/advisory-copilot/actions/${encodeURIComponent(runId)}`,
      {
        method: "GET",
        headers,
        cache: "no-store",
        signal: createGatewayRequestSignal(),
      },
    );
    if (!response.ok) {
      return null;
    }
    return extractReviewScopeFromPayload(await response.json());
  } catch {
    return null;
  }
}

function applyDevelopmentHeaders(
  headers: Headers,
  context: AdvisoryCopilotDevelopmentContext,
  capability: string,
) {
  headers.set("X-Actor-Id", context.actorId);
  headers.set("X-Caller-Application", context.callerApplication);
  headers.set("X-Tenant-Id", context.tenantId);
  headers.set("X-Region", context.region);
  headers.set("X-Booking-Center-Code", context.bookingCenterCode);
  headers.set("X-Legal-Entity-Code", context.legalEntityCode);
  headers.set("X-Role", context.role);
  headers.set("X-Caller-Capabilities", capability);
  headers.set("X-Principal-Status", context.principalStatus);
}

function extractReviewRunId(upstreamPath: string): string | null {
  const match = /^api\/v1\/advisory-copilot\/actions\/([^/]+)\/reviews$/.exec(
    upstreamPath,
  );
  if (!match) {
    return null;
  }
  try {
    const runId = decodeURIComponent(match[1]);
    return IDENTIFIER_PATTERN.test(runId) ? runId : null;
  } catch {
    return null;
  }
}

function extractReviewScopeFromPayload(
  payload: unknown,
): AdvisoryCopilotReviewScope | null {
  const data = objectValue(objectValue(payload)?.data) ?? objectValue(payload);
  const run = objectValue(data?.run) ?? data;
  const proposalId = readIdentifier(run?.proposal_id);
  const portfolioId = readIdentifier(run?.portfolio_id);
  return proposalId && portfolioId ? { proposalId, portfolioId } : null;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readIdentifier(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return IDENTIFIER_PATTERN.test(trimmed) ? trimmed : null;
}
