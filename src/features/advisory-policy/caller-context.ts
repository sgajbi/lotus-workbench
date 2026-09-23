import { fetchGatewayAuthorityScope } from "@/app/api/bff/gateway-authority-scope";
import { resolveConfiguredAuthorityMode } from "@/features/workbench/authority-mode";
import {
  resolveDefaultCallerContext,
  stripBrowserSuppliedAuthorityHeaders,
} from "@/features/workbench/caller-context";
import type { ResolvedPrincipal } from "@/features/workbench/principal-credential";

const AUTH_MODE_ENV = "WORKBENCH_ADVISORY_POLICY_AUTH_MODE";
const PORTFOLIO_IDS_ENV = "WORKBENCH_ADVISORY_POLICY_PORTFOLIO_IDS";
const READ_CAPABILITY = "advisory.policy_evaluation.read";
const SIGN_OFF_CAPABILITY = "advisory.policy_evaluation.sign_off";
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const DEFAULT_AUTHORITY = {
  readerActorId: "advisor_sg_001",
  readerRole: "ADVISOR",
  checkerActorId: "policy_checker_1",
  checkerRole: "POLICY_CHECKER",
  tenantId: "tenant-sg",
  legalEntityCode: "REFERENCE",
  portfolioIds: "PB_SG_GLOBAL_BAL_001",
} as const;

type PolicyOperation =
  | {
      kind: "read";
      capability: typeof READ_CAPABILITY;
      scopeSource:
        | { kind: "portfolio_query" }
        | { kind: "evaluation"; evaluationId: string };
    }
  | {
      kind: "sign_off";
      capability: typeof SIGN_OFF_CAPABILITY;
      evaluationId: string;
    };

type PolicyAuthorityRejection =
  | "authenticated_principal_required"
  | "development_authority_not_allowed"
  | "invalid_authority_mode"
  | "invalid_advisory_policy_configuration"
  | "invalid_advisory_policy_request"
  | "advisory_policy_scope_not_entitled"
  | "advisory_policy_scope_not_resolved";

export type AdvisoryPolicyAuthorityResolution =
  | { status: "not_applicable" }
  | {
      status: "applied";
      mode: "development_configured" | "authenticated_session";
      bodyText?: string;
    }
  | { status: "rejected"; reason: PolicyAuthorityRejection };

export async function applyAdvisoryPolicyCallerContextHeaders(
  headers: Headers,
  request: {
    method: string;
    upstreamPath: string;
    searchParams: URLSearchParams;
    bodyText?: string;
    gatewayBaseUrl: string;
    verifiedPrincipal?: ResolvedPrincipal;
    gatewayCredential?: string;
  },
): Promise<AdvisoryPolicyAuthorityResolution> {
  const operation = resolveAdvisoryPolicyOperation(request);
  if (!operation) return { status: "not_applicable" };

  stripBrowserSuppliedAuthorityHeaders(headers);
  const authorityMode = resolveAdvisoryPolicyAuthorityMode();
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
      ? resolveDevelopmentContext()
      : null;
  if (authorityMode === "development_configured" && !context) {
    return {
      status: "rejected",
      reason: "invalid_advisory_policy_configuration",
    };
  }

  if (operation.kind === "read") {
    const portfolioId = await resolvePolicyReadPortfolio({
      operation,
      searchParams: request.searchParams,
      gatewayBaseUrl: request.gatewayBaseUrl,
      ...(context
        ? { developmentContext: context }
        : { gatewayCredential: request.gatewayCredential! }),
    });
    if (!portfolioId) {
      return {
        status: "rejected",
        reason:
          operation.scopeSource.kind === "portfolio_query"
            ? "invalid_advisory_policy_request"
            : "advisory_policy_scope_not_resolved",
      };
    }
    const entitled = context
      ? context.portfolioIds.has(portfolioId)
      : request.verifiedPrincipal!.portfolioScope.has(portfolioId);
    if (!entitled) {
      return {
        status: "rejected",
        reason: "advisory_policy_scope_not_entitled",
      };
    }
    if (context) applyReadHeaders(headers, context);
    return { status: "applied", mode: authorityMode };
  }
  if (!request.bodyText || !objectValue(parseJson(request.bodyText))?.body) {
    return { status: "rejected", reason: "invalid_advisory_policy_request" };
  }

  const scope = await resolveEvaluationScope({
    gatewayBaseUrl: request.gatewayBaseUrl,
    evaluationId: operation.evaluationId,
    ...(context
      ? { developmentContext: context }
      : { gatewayCredential: request.gatewayCredential! }),
  });
  if (!scope) {
    return { status: "rejected", reason: "advisory_policy_scope_not_resolved" };
  }
  const entitled = context
    ? context.portfolioIds.has(scope.portfolioId)
    : request.verifiedPrincipal!.portfolioScope.has(scope.portfolioId);
  if (!entitled) {
    return { status: "rejected", reason: "advisory_policy_scope_not_entitled" };
  }

  const admittedActorId = context
    ? context.checkerActorId
    : request.verifiedPrincipal!.subject;
  const rewrittenBody = replaceBodyActor(request.bodyText, admittedActorId);
  if (!rewrittenBody) {
    return { status: "rejected", reason: "invalid_advisory_policy_request" };
  }
  if (context) {
    applyCallerHeaders(headers, context, {
      actorId: context.checkerActorId,
      role: context.checkerRole,
      capability: SIGN_OFF_CAPABILITY,
    });
    headers.set("X-Authorized-Proposal-Id", scope.proposalId);
    headers.set("X-Authorized-Portfolio-Id", scope.portfolioId);
  }
  return { status: "applied", mode: authorityMode, bodyText: rewrittenBody };
}

export function resolveAdvisoryPolicyAuthorityMode() {
  return resolveConfiguredAuthorityMode(AUTH_MODE_ENV);
}

export function resolveAdvisoryPolicyCapability(request: {
  method: string;
  upstreamPath: string;
}): string | undefined {
  return resolveAdvisoryPolicyOperation(request)?.capability;
}

function resolveAdvisoryPolicyOperation(request: {
  method: string;
  upstreamPath: string;
}): PolicyOperation | null {
  if (
    request.method === "GET" &&
    request.upstreamPath === "api/v1/advisory-policy-evaluations/review-queue"
  ) {
    return {
      kind: "read",
      capability: READ_CAPABILITY,
      scopeSource: { kind: "portfolio_query" },
    };
  }
  const readEvaluation =
    request.method === "GET"
      ? /^api\/v1\/advisory-policy-evaluations\/([^/]+)(?:\/(?:workflow|sign-off-package))?$/.exec(
          request.upstreamPath,
        )
      : null;
  const readEvaluationId = readEvaluation
    ? decodeIdentifier(readEvaluation[1])
    : null;
  if (readEvaluationId) {
    return {
      kind: "read",
      capability: READ_CAPABILITY,
      scopeSource: { kind: "evaluation", evaluationId: readEvaluationId },
    };
  }
  const signOff =
    request.method === "POST"
      ? /^api\/v1\/advisory-policy-evaluations\/([^/]+)\/sign-off-decisions$/.exec(
          request.upstreamPath,
        )
      : null;
  const evaluationId = signOff ? decodeIdentifier(signOff[1]) : null;
  return evaluationId
    ? { kind: "sign_off", capability: SIGN_OFF_CAPABILITY, evaluationId }
    : null;
}

function resolveDevelopmentContext() {
  const defaults = resolveDefaultCallerContext();
  const portfolioIds = new Set(
    (process.env[PORTFOLIO_IDS_ENV]?.trim() || DEFAULT_AUTHORITY.portfolioIds)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const context = {
    readerActorId:
      process.env.WORKBENCH_ADVISORY_POLICY_READER_ACTOR_ID?.trim() ||
      DEFAULT_AUTHORITY.readerActorId,
    readerRole:
      process.env.WORKBENCH_ADVISORY_POLICY_READER_ROLE?.trim().toUpperCase() ||
      DEFAULT_AUTHORITY.readerRole,
    checkerActorId:
      process.env.WORKBENCH_ADVISORY_POLICY_CHECKER_ACTOR_ID?.trim() ||
      DEFAULT_AUTHORITY.checkerActorId,
    checkerRole:
      process.env.WORKBENCH_ADVISORY_POLICY_CHECKER_ROLE?.trim().toUpperCase() ||
      DEFAULT_AUTHORITY.checkerRole,
    callerApplication: defaults.callerApplication,
    tenantId:
      process.env.WORKBENCH_ADVISORY_POLICY_TENANT_ID?.trim() ||
      DEFAULT_AUTHORITY.tenantId,
    region: defaults.region,
    bookingCenterCode: defaults.bookingCenterCode,
    legalEntityCode:
      process.env.WORKBENCH_ADVISORY_POLICY_LEGAL_ENTITY_CODE?.trim().toUpperCase() ||
      DEFAULT_AUTHORITY.legalEntityCode,
    portfolioIds,
  };
  const scalarValues = Object.entries(context).filter(
    ([key]) => key !== "portfolioIds",
  );
  return scalarValues.some(
    ([, value]) => !IDENTIFIER_PATTERN.test(String(value)),
  ) ||
    portfolioIds.size === 0 ||
    [...portfolioIds].some((value) => !IDENTIFIER_PATTERN.test(value))
    ? null
    : context;
}

type DevelopmentContext = NonNullable<
  ReturnType<typeof resolveDevelopmentContext>
>;
type EvaluationScope = { proposalId: string; portfolioId: string };

async function resolvePolicyReadPortfolio({
  operation,
  searchParams,
  gatewayBaseUrl,
  developmentContext,
  gatewayCredential,
}: {
  operation: Extract<PolicyOperation, { kind: "read" }>;
  searchParams: URLSearchParams;
  gatewayBaseUrl: string;
  developmentContext?: DevelopmentContext;
  gatewayCredential?: string;
}): Promise<string | null> {
  if (operation.scopeSource.kind === "portfolio_query") {
    const portfolioIds = searchParams.getAll("portfolio_id");
    return portfolioIds.length === 1 ? readIdentifier(portfolioIds[0]) : null;
  }
  const scope = await resolveEvaluationScope({
    gatewayBaseUrl,
    evaluationId: operation.scopeSource.evaluationId,
    ...(developmentContext
      ? { developmentContext }
      : { gatewayCredential: gatewayCredential! }),
  });
  return scope?.portfolioId ?? null;
}

async function resolveEvaluationScope({
  gatewayBaseUrl,
  evaluationId,
  developmentContext,
  gatewayCredential,
}: {
  gatewayBaseUrl: string;
  evaluationId: string;
  developmentContext?: DevelopmentContext;
  gatewayCredential?: string;
}): Promise<EvaluationScope | null> {
  const headers = new Headers({ Accept: "application/json" });
  if (gatewayCredential) {
    headers.set("Authorization", `Bearer ${gatewayCredential}`);
  } else if (developmentContext) {
    applyReadHeaders(headers, developmentContext);
  }
  const payload = await fetchGatewayAuthorityScope(
    gatewayBaseUrl,
    `/api/v1/advisory-policy-evaluations/${encodeURIComponent(evaluationId)}`,
    headers,
  );
  const scope = extractEvaluationScope(payload);
  return scope?.evaluationId === evaluationId ? scope : null;
}

function applyReadHeaders(headers: Headers, context: DevelopmentContext) {
  applyCallerHeaders(headers, context, {
    actorId: context.readerActorId,
    role: context.readerRole,
    capability: READ_CAPABILITY,
  });
}

function applyCallerHeaders(
  headers: Headers,
  context: DevelopmentContext,
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
}

function extractEvaluationScope(
  payload: unknown,
): (EvaluationScope & { evaluationId: string }) | null {
  const data = objectValue(objectValue(payload)?.data) ?? objectValue(payload);
  const evaluation = objectValue(data?.evaluation) ?? data;
  const proposalId = readIdentifier(evaluation?.proposal_id);
  const portfolioId = readIdentifier(evaluation?.portfolio_id);
  const evaluationId = readIdentifier(evaluation?.evaluation_id);
  return proposalId && portfolioId && evaluationId
    ? { proposalId, portfolioId, evaluationId }
    : null;
}

function replaceBodyActor(bodyText: string, actorId: string): string | null {
  const envelope = objectValue(parseJson(bodyText));
  const body = objectValue(envelope?.body);
  if (!envelope || !body) return null;
  return JSON.stringify({ ...envelope, body: { ...body, actor_id: actorId } });
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
  const cleaned = value.trim();
  return IDENTIFIER_PATTERN.test(cleaned) ? cleaned : null;
}
