import { fetchGatewayAuthorityScope } from "@/app/api/bff/gateway-authority-scope";
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
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const DEFAULT_DEVELOPMENT_AUTHORITY = {
  makerActorId: "advisor_sg_001",
  makerRole: "ADVISOR",
  reviewerActorId: "desk_head_sg_001",
  reviewerRole: "ADVISORY_SUPERVISOR",
  tenantId: "tenant-sg",
  legalEntityCode: "REFERENCE",
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

type CopilotOperation = {
  capability: string;
  principal: "maker" | "reviewer";
  attributionField?: "created_by" | "requested_by";
  scopeSource:
    | { kind: "proposal" }
    | { kind: "evidence_packet" }
    | { kind: "run"; runId: string };
};

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
      bodyText?: string;
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
  const operation = resolveCopilotOperation(
    request.method,
    request.upstreamPath,
  );
  if (!operation) return { status: "not_applicable" };

  stripBrowserSuppliedAuthorityHeaders(headers);
  if (!request.bodyText || containsAuthorityBodyField(request.bodyText)) {
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

  const scope = await resolveAdvisoryCopilotScope({
    operation,
    bodyText: request.bodyText,
    gatewayBaseUrl: request.gatewayBaseUrl,
    ...(context
      ? { developmentContext: context }
      : { gatewayCredential: request.gatewayCredential! }),
  });
  if (!scope) {
    return {
      status: "rejected",
      reason: "advisory_copilot_scope_not_resolved",
    };
  }

  const entitled =
    authorityMode === "authenticated_session"
      ? request.verifiedPrincipal!.portfolioScope.has(scope.portfolioId)
      : context!.portfolioIds.has(scope.portfolioId);
  if (!entitled) {
    return {
      status: "rejected",
      reason: "advisory_copilot_scope_not_entitled",
    };
  }

  if (context) {
    applyDevelopmentHeaders(headers, context, operation);
    headers.set("X-Authorized-Proposal-Id", scope.proposalId);
    headers.set("X-Authorized-Portfolio-Id", scope.portfolioId);
  }
  const bodyText = sanitizeCopilotBodyEnvelope(
    request.bodyText,
    operation.attributionField
      ? {
          field: operation.attributionField,
          actorId: context
            ? context.makerActorId
            : request.verifiedPrincipal!.subject,
        }
      : undefined,
  );
  if (!bodyText) {
    return { status: "rejected", reason: "invalid_advisory_copilot_request" };
  }
  return { status: "applied", mode: authorityMode, bodyText };
}

function resolveCopilotOperation(
  method: string,
  upstreamPath: string,
): CopilotOperation | null {
  if (
    method === "POST" &&
    upstreamPath ===
      "api/v1/advisory-copilot/evidence-packets/from-proposal-version"
  ) {
    return {
      capability: "advisory.policy_evaluation.read",
      principal: "maker",
      attributionField: "created_by",
      scopeSource: { kind: "proposal" },
    };
  }
  if (method === "POST" && upstreamPath === "api/v1/advisory-copilot/actions") {
    return {
      capability: "advisory.copilot.action",
      principal: "maker",
      attributionField: "requested_by",
      scopeSource: { kind: "evidence_packet" },
    };
  }
  const review =
    method === "POST"
      ? /^api\/v1\/advisory-copilot\/actions\/([^/]+)\/reviews$/.exec(
          upstreamPath,
        )
      : null;
  const runId = review ? decodeIdentifier(review[1]) : null;
  return runId
    ? {
        capability: "advisory.copilot.review",
        principal: "reviewer",
        scopeSource: { kind: "run", runId },
      }
    : null;
}

export function resolveAdvisoryCopilotAuthorityMode() {
  return resolveConfiguredAuthorityMode(ADVISORY_COPILOT_AUTH_MODE_ENV);
}

export function resolveAdvisoryCopilotCapability(request: {
  method: string;
  upstreamPath: string;
}): string | undefined {
  return resolveCopilotOperation(request.method, request.upstreamPath)
    ?.capability;
}

function containsAuthorityBodyField(bodyText: string): boolean {
  try {
    return hasAuthorityField(JSON.parse(bodyText));
  } catch {
    return true;
  }
}

function hasAuthorityField(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasAuthorityField);
  return Object.entries(value).some(
    ([key, nestedValue]) =>
      AUTHORITY_BODY_FIELDS.has(key.toLowerCase()) ||
      hasAuthorityField(nestedValue),
  );
}

function resolveAdvisoryCopilotDevelopmentContext() {
  const defaults = resolveDefaultCallerContext();
  const portfolioIds = new Set(
    (
      process.env[ADVISORY_COPILOT_PORTFOLIO_IDS_ENV]?.trim() ||
      DEFAULT_DEVELOPMENT_AUTHORITY.portfolioIds
    )
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const context = {
    makerActorId:
      process.env.WORKBENCH_ADVISORY_COPILOT_MAKER_ACTOR_ID?.trim() ||
      DEFAULT_DEVELOPMENT_AUTHORITY.makerActorId,
    makerRole:
      process.env.WORKBENCH_ADVISORY_COPILOT_MAKER_ROLE?.trim().toUpperCase() ||
      DEFAULT_DEVELOPMENT_AUTHORITY.makerRole,
    reviewerActorId:
      process.env.WORKBENCH_ADVISORY_COPILOT_ACTOR_ID?.trim() ||
      DEFAULT_DEVELOPMENT_AUTHORITY.reviewerActorId,
    reviewerRole:
      process.env.WORKBENCH_ADVISORY_COPILOT_ROLE?.trim().toUpperCase() ||
      DEFAULT_DEVELOPMENT_AUTHORITY.reviewerRole,
    callerApplication: defaults.callerApplication,
    tenantId:
      process.env.WORKBENCH_ADVISORY_COPILOT_TENANT_ID?.trim() ||
      DEFAULT_DEVELOPMENT_AUTHORITY.tenantId,
    region: defaults.region,
    bookingCenterCode: defaults.bookingCenterCode,
    legalEntityCode:
      process.env.WORKBENCH_ADVISORY_COPILOT_LEGAL_ENTITY_CODE?.trim().toUpperCase() ||
      DEFAULT_DEVELOPMENT_AUTHORITY.legalEntityCode,
    principalStatus:
      process.env.WORKBENCH_ADVISORY_COPILOT_PRINCIPAL_STATUS?.trim().toUpperCase() ||
      DEFAULT_DEVELOPMENT_AUTHORITY.principalStatus,
    portfolioIds,
  };

  if (
    Object.entries(context).some(
      ([key, value]) =>
        key !== "portfolioIds" &&
        !IDENTIFIER_PATTERN.test(String(value).trim()),
    ) ||
    context.principalStatus !== "ACTIVE" ||
    portfolioIds.size === 0 ||
    [...portfolioIds].some(
      (portfolioId) => !IDENTIFIER_PATTERN.test(portfolioId),
    )
  ) {
    return null;
  }
  return context;
}

type AdvisoryCopilotDevelopmentContext = NonNullable<
  ReturnType<typeof resolveAdvisoryCopilotDevelopmentContext>
>;
type AdvisoryCopilotScope = {
  proposalId: string;
  portfolioId: string;
  resourceId: string;
};

type AdvisoryCopilotResourceScope = Pick<
  AdvisoryCopilotScope,
  "proposalId" | "portfolioId"
>;

async function resolveAdvisoryCopilotScope({
  operation,
  bodyText,
  developmentContext,
  gatewayCredential,
  gatewayBaseUrl,
}: {
  operation: CopilotOperation;
  bodyText: string;
  developmentContext?: AdvisoryCopilotDevelopmentContext;
  gatewayCredential?: string;
  gatewayBaseUrl: string;
}): Promise<AdvisoryCopilotScope | null> {
  const envelope = objectValue(parseJson(bodyText));
  const body = objectValue(envelope?.body);
  const resourceScope = readResourceScope(envelope?.resource_scope);
  let path: string;
  let expectedResourceId: string;
  if (operation.scopeSource.kind === "proposal") {
    const proposalId = readIdentifier(body?.proposal_id);
    if (!proposalId) return null;
    expectedResourceId = proposalId;
    path = `/api/v1/proposals/${encodeURIComponent(proposalId)}`;
  } else if (operation.scopeSource.kind === "evidence_packet") {
    const packetId = readIdentifier(body?.evidence_packet_id);
    if (!packetId || !resourceScope) return null;
    expectedResourceId = packetId;
    path = `/api/v1/advisory-copilot/evidence-packets/${encodeURIComponent(packetId)}`;
  } else {
    if (!resourceScope) return null;
    expectedResourceId = operation.scopeSource.runId;
    path = `/api/v1/advisory-copilot/actions/${encodeURIComponent(
      operation.scopeSource.runId,
    )}`;
  }

  const lookupHeaders = new Headers({ Accept: "application/json" });
  if (gatewayCredential) {
    lookupHeaders.set("Authorization", `Bearer ${gatewayCredential}`);
  } else if (developmentContext && resourceScope) {
    applyReadHeaders(lookupHeaders, developmentContext);
  }
  if (resourceScope) {
    applyResourceScopeHeaders(lookupHeaders, resourceScope);
  }
  const payload = await fetchGatewayAuthorityScope(
    gatewayBaseUrl,
    path,
    lookupHeaders,
  );
  const scope = extractScopeFromPayload(payload, operation.scopeSource.kind);
  return scope?.resourceId === expectedResourceId &&
    (!resourceScope ||
      (scope.proposalId === resourceScope.proposalId &&
        scope.portfolioId === resourceScope.portfolioId))
    ? scope
    : null;
}

function applyReadHeaders(
  headers: Headers,
  context: AdvisoryCopilotDevelopmentContext,
) {
  applyCallerHeaders(headers, context, {
    actorId: context.reviewerActorId,
    role: context.reviewerRole,
    capability: READ_CAPABILITY,
  });
}

function applyResourceScopeHeaders(
  headers: Headers,
  resourceScope: AdvisoryCopilotResourceScope,
) {
  headers.set("X-Authorized-Proposal-Id", resourceScope.proposalId);
  headers.set("X-Authorized-Portfolio-Id", resourceScope.portfolioId);
}

function applyDevelopmentHeaders(
  headers: Headers,
  context: AdvisoryCopilotDevelopmentContext,
  operation: CopilotOperation,
) {
  const reviewer = operation.principal === "reviewer";
  applyCallerHeaders(headers, context, {
    actorId: reviewer ? context.reviewerActorId : context.makerActorId,
    role: reviewer ? context.reviewerRole : context.makerRole,
    capability: operation.capability,
  });
}

function applyCallerHeaders(
  headers: Headers,
  context: AdvisoryCopilotDevelopmentContext,
  authority: { actorId: string; role: string; capability: string },
) {
  headers.set("X-Actor-Id", authority.actorId);
  headers.set("X-Caller-Application", context.callerApplication);
  headers.set("X-Tenant-Id", context.tenantId);
  headers.set("X-Region", context.region);
  headers.set("X-Booking-Center-Code", context.bookingCenterCode);
  headers.set("X-Legal-Entity-Code", context.legalEntityCode);
  headers.set("X-Role", authority.role);
  headers.set("X-Caller-Capabilities", authority.capability);
  headers.set("X-Principal-Status", context.principalStatus);
}

function extractScopeFromPayload(
  payload: unknown,
  kind: CopilotOperation["scopeSource"]["kind"],
): AdvisoryCopilotScope | null {
  const data = objectValue(objectValue(payload)?.data) ?? objectValue(payload);
  const resource =
    kind === "proposal"
      ? (objectValue(data?.proposal) ?? data)
      : kind === "evidence_packet"
        ? (objectValue(data?.evidence_packet) ?? data)
        : (objectValue(data?.run) ?? data);
  const proposalId = readIdentifier(resource?.proposal_id);
  const portfolioId = readIdentifier(resource?.portfolio_id);
  const resourceId = readIdentifier(
    kind === "proposal"
      ? resource?.proposal_id
      : kind === "evidence_packet"
        ? resource?.evidence_packet_id
        : resource?.run_id,
  );
  return proposalId && portfolioId && resourceId
    ? { proposalId, portfolioId, resourceId }
    : null;
}

function sanitizeCopilotBodyEnvelope(
  bodyText: string,
  attribution?: {
    field: "created_by" | "requested_by";
    actorId: string;
  },
): string | null {
  const envelope = objectValue(parseJson(bodyText));
  const body = objectValue(envelope?.body);
  if (!envelope || !body) return null;
  const { resource_scope: _resourceScope, ...forwardedEnvelope } = envelope;
  return JSON.stringify({
    ...forwardedEnvelope,
    body: attribution
      ? { ...body, [attribution.field]: attribution.actorId }
      : body,
  });
}

function readResourceScope(value: unknown): AdvisoryCopilotResourceScope | null {
  const scope = objectValue(value);
  const proposalId = readIdentifier(scope?.proposal_id);
  const portfolioId = readIdentifier(scope?.portfolio_id);
  return proposalId && portfolioId ? { proposalId, portfolioId } : null;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function decodeIdentifier(value: string): string | null {
  try {
    return readIdentifier(decodeURIComponent(value));
  } catch {
    return null;
  }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readIdentifier(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return IDENTIFIER_PATTERN.test(trimmed) ? trimmed : null;
}
