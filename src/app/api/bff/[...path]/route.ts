import { NextRequest, NextResponse } from "next/server";
import {
  applyAdvisoryCopilotCallerContextHeaders,
  resolveAdvisoryCopilotAuthorityMode,
  resolveAdvisoryCopilotCapability,
} from "@/features/advisory-copilot/caller-context";
import {
  applyAdvisorBookCallerContextHeaders,
  resolveAdvisorBookAuthorityMode,
  resolveAdvisorBookRouteCapability,
} from "@/features/advisor-book/caller-context";
import {
  applyAdvisorCockpitCallerContextHeaders,
  resolveAdvisorCockpitAuthorityMode,
  resolveAdvisorCockpitCapability,
} from "@/features/advisor-cockpit/caller-context";
import {
  createGatewayRequestSignal,
  isGatewayRequestTimeout,
} from "@/features/platform-runtime/gateway-request-policy";
import { resolveGatewayBaseUrl } from "@/features/platform-runtime/service-addressing";
import {
  applyIdeaRouteCallerContextHeaders,
  applyReportOrderingRouteCallerContextHeaders,
  matchesIdeaPresentationReceiptTenantAuthority,
  resolveIdeaAuthorityMode,
  resolveIdeaRouteCapability,
  resolveReportingAuthorityMode,
  resolveReportingRequestedPortfolioIds,
  resolveReportingRouteCapability,
} from "@/features/workbench/caller-context";
import { requiresAuthenticatedSessionPrincipal } from "@/features/workbench/authority-mode";
import { buildGatewayBffRequestHeaders } from "@/features/workbench/bff-request-headers";
import { readGatewayBffResponse } from "@/features/workbench/bff-response";
import { authorizeConfiguredBffPrincipal } from "@/features/workbench/configured-bff-principal";
import type { ResolvedPrincipal } from "@/features/workbench/principal-credential";

const BFF_PATH_PREFIX = "/api/bff/";

async function proxy(request: NextRequest, params: { path: string[] }) {
  const upstreamPath = params.path.join("/");
  const encodedUpstreamPath = request.nextUrl.pathname.slice(
    BFF_PATH_PREFIX.length,
  );
  const gatewayBaseUrl = resolveGatewayBaseUrl();

  const headers = buildGatewayBffRequestHeaders(request.headers);
  let requestBody =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();
  let verifiedPrincipal: ResolvedPrincipal | undefined;
  let verifiedGatewayCredential: string | undefined;
  if (request.headers.has("authorization")) {
    const ideaCapability =
      resolveIdeaAuthorityMode() === "authenticated_session"
        ? resolveIdeaRouteCapability({ method: request.method, upstreamPath })
        : undefined;
    const advisorBookCapability =
      resolveAdvisorBookAuthorityMode() === "authenticated_session"
        ? resolveAdvisorBookRouteCapability({ method: request.method, upstreamPath })
        : undefined;
    const advisorCockpitCapability =
      resolveAdvisorCockpitAuthorityMode() === "authenticated_session"
        ? resolveAdvisorCockpitCapability({ method: request.method, upstreamPath })
        : undefined;
    const reportingCapability =
      resolveReportingAuthorityMode() === "authenticated_session"
        ? resolveReportingRouteCapability({ method: request.method, upstreamPath })
        : undefined;
    const advisoryCopilotCapability =
      resolveAdvisoryCopilotAuthorityMode() === "authenticated_session"
        ? resolveAdvisoryCopilotCapability({ method: request.method, upstreamPath })
        : undefined;
    const requiredCapability =
      ideaCapability ??
      advisorBookCapability ??
      advisorCockpitCapability ??
      reportingCapability ??
      advisoryCopilotCapability;
    if (requiredCapability) {
      const requestedPortfolioIds = reportingCapability
        ? resolveReportingRequestedPortfolioIds({
            upstreamPath,
            searchParams: request.nextUrl.searchParams,
            bodyText: requestBody,
          })
        : advisorCockpitCapability
          ? request.nextUrl.searchParams
              .getAll("portfolio_id")
              .map((portfolioId) => portfolioId.trim())
              .filter(Boolean)
          : [];
      const principalAuthority = await authorizeConfiguredBffPrincipal(
        request.headers.get("authorization"),
        { requiredCapabilities: [requiredCapability], requestedPortfolioIds },
      );
      if (principalAuthority.status === "denied") {
        return NextResponse.json(
          { code: principalAuthority.denialClass, status: "rejected" },
          {
            status: principalAuthority.httpStatus,
            headers: { "cache-control": "no-store" },
          },
        );
      }
      verifiedPrincipal = principalAuthority.principal;
      verifiedGatewayCredential = principalAuthority.gatewayCredential;
    }
  }
  const advisorBookAuthority = applyAdvisorBookCallerContextHeaders(headers, {
    method: request.method,
    upstreamPath,
    verifiedPrincipal,
  });
  if (advisorBookAuthority.status === "rejected") {
    const rejection = advisorBookAuthorityRejection(
      advisorBookAuthority.reason,
    );
    return NextResponse.json(
      { code: rejection.code, status: "rejected" },
      { status: rejection.status, headers: { "cache-control": "no-store" } },
    );
  }
  const ideaAuthority = applyIdeaRouteCallerContextHeaders(headers, {
    method: request.method,
    upstreamPath,
    bodyText: requestBody,
    verifiedPrincipal,
  });
  if (ideaAuthority.status === "rejected") {
    const rejection = ideaAuthorityRejection(ideaAuthority.reason);
    return NextResponse.json(
      {
        code: rejection.code,
        status: "rejected",
      },
      {
        status: rejection.status,
        headers: { "cache-control": "no-store" },
      },
    );
  }
  if (ideaAuthority.status === "applied") {
    requestBody = ideaAuthority.bodyText;
  }
  const advisorCockpitAuthority = applyAdvisorCockpitCallerContextHeaders(
    headers,
    {
      method: request.method,
      upstreamPath,
      searchParams: request.nextUrl.searchParams,
      bodyText: requestBody,
      verifiedPrincipal,
    },
  );
  if (advisorCockpitAuthority.status === "rejected") {
    const rejection = advisorCockpitAuthorityRejection(
      advisorCockpitAuthority.reason,
    );
    return NextResponse.json(
      { code: rejection.code, status: "rejected" },
      { status: rejection.status, headers: { "cache-control": "no-store" } },
    );
  }
  const advisoryCopilotAuthority =
    await applyAdvisoryCopilotCallerContextHeaders(headers, {
      method: request.method,
      upstreamPath,
      bodyText: requestBody,
      gatewayBaseUrl,
      verifiedPrincipal,
      gatewayCredential: verifiedGatewayCredential,
    });
  if (advisoryCopilotAuthority.status === "rejected") {
    const rejection = advisoryCopilotAuthorityRejection(
      advisoryCopilotAuthority.reason,
    );
    return NextResponse.json(
      { code: rejection.code, status: "rejected" },
      { status: rejection.status, headers: { "cache-control": "no-store" } },
    );
  }
  const reportingAuthority = applyReportOrderingRouteCallerContextHeaders(
    headers,
    {
      method: request.method,
      upstreamPath,
      searchParams: request.nextUrl.searchParams,
      bodyText: requestBody,
      verifiedPrincipal,
    },
  );
  if (reportingAuthority.status === "rejected") {
    const rejection = reportingAuthorityRejection(reportingAuthority.reason);
    return NextResponse.json(
      {
        code: rejection.code,
        status: "rejected",
      },
      { status: rejection.status, headers: { "cache-control": "no-store" } },
    );
  }
  if (requiresAuthenticatedSessionPrincipal() && !verifiedPrincipal) {
    return NextResponse.json(
      {
        code: "workbench_authenticated_principal_required",
        status: "rejected",
      },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
  if (verifiedGatewayCredential) {
    headers.set("Authorization", `Bearer ${verifiedGatewayCredential}`);
  }
  const upstreamSearch =
    reportingAuthority.status === "applied"
      ? reportingAuthority.admittedSearch
        ? `?${reportingAuthority.admittedSearch}`
        : ""
      : request.nextUrl.search;
  const url = `${gatewayBaseUrl}/${encodedUpstreamPath}${upstreamSearch}`;
  let response: Response;
  let responseBody: ArrayBuffer | null;
  let responseHeaders: Headers;
  try {
    response = await fetch(url, {
      method: request.method,
      headers,
      body: requestBody,
      cache: "no-store",
      signal: createGatewayRequestSignal(),
    });
    ({ body: responseBody, headers: responseHeaders } =
      await readGatewayBffResponse(response, request.method));
  } catch (error) {
    const timedOut = isGatewayRequestTimeout(error);
    return NextResponse.json(
      {
        code: timedOut ? "gateway_request_timed_out" : "gateway_request_failed",
        status: "unavailable",
      },
      {
        status: timedOut ? 504 : 502,
        headers: { "cache-control": "no-store" },
      },
    );
  }

  if (
    response.ok &&
    ideaAuthority.status === "applied" &&
    ideaAuthority.presentationReceiptTenantId &&
    (responseBody === null ||
      !matchesIdeaPresentationReceiptTenantAuthority(
        new TextDecoder().decode(responseBody),
        ideaAuthority.presentationReceiptTenantId,
      ))
  ) {
    return NextResponse.json(
      {
        code: "idea_response_authority_mismatch",
        status: "unavailable",
      },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }

  return new NextResponse(responseBody, {
    status: response.status,
    headers: responseHeaders,
  });
}

function ideaAuthorityRejection(
  reason: Exclude<
    ReturnType<typeof applyIdeaRouteCallerContextHeaders>,
    { status: "not_applicable" } | { status: "applied" }
  >["reason"],
): { code: string; status: number } {
  switch (reason) {
    case "authenticated_principal_required":
      return { code: "idea_authenticated_principal_required", status: 401 };
    case "unsupported_idea_route":
      return { code: "idea_route_not_supported", status: 404 };
    case "invalid_idea_request":
      return { code: "idea_request_invalid", status: 422 };
    case "development_authority_not_allowed":
    case "invalid_authority_mode":
    case "invalid_idea_configuration":
      return { code: "idea_authority_configuration_rejected", status: 500 };
  }
}

function advisorCockpitAuthorityRejection(
  reason: Exclude<
    ReturnType<typeof applyAdvisorCockpitCallerContextHeaders>,
    { status: "not_applicable" } | { status: "applied" }
  >["reason"],
): { code: string; status: number } {
  switch (reason) {
    case "authenticated_principal_required":
      return {
        code: "advisor_cockpit_authenticated_principal_required",
        status: 401,
      };
    case "advisor_cockpit_scope_not_entitled":
      return { code: "advisor_cockpit_scope_not_entitled", status: 403 };
    case "invalid_advisor_cockpit_request":
      return { code: "advisor_cockpit_invalid_request", status: 422 };
    case "unsupported_advisor_cockpit_route":
      return { code: "advisor_cockpit_route_not_supported", status: 404 };
    case "development_authority_not_allowed":
    case "invalid_authority_mode":
    case "invalid_advisor_cockpit_configuration":
      return {
        code: "advisor_cockpit_authority_configuration_rejected",
        status: 500,
      };
  }
}

function advisorBookAuthorityRejection(
  reason: Exclude<
    ReturnType<typeof applyAdvisorBookCallerContextHeaders>,
    { status: "not_applicable" } | { status: "applied" }
  >["reason"],
): { code: string; status: number } {
  switch (reason) {
    case "authenticated_principal_required":
      return {
        code: "advisor_book_authenticated_principal_required",
        status: 401,
      };
    case "development_authority_not_allowed":
    case "invalid_authority_mode":
    case "invalid_advisor_book_configuration":
      return {
        code: "advisor_book_authority_configuration_rejected",
        status: 500,
      };
  }
}

function advisoryCopilotAuthorityRejection(
  reason: Exclude<
    Awaited<ReturnType<typeof applyAdvisoryCopilotCallerContextHeaders>>,
    { status: "not_applicable" } | { status: "applied" }
  >["reason"],
): { code: string; status: number } {
  switch (reason) {
    case "authenticated_principal_required":
      return {
        code: "advisory_copilot_authenticated_principal_required",
        status: 401,
      };
    case "invalid_advisory_copilot_request":
      return { code: "advisory_copilot_invalid_request", status: 422 };
    case "advisory_copilot_scope_not_entitled":
      return { code: "advisory_copilot_scope_not_entitled", status: 403 };
    case "advisory_copilot_scope_not_resolved":
      return { code: "advisory_copilot_scope_not_resolved", status: 502 };
    case "development_authority_not_allowed":
    case "invalid_authority_mode":
    case "invalid_advisory_copilot_configuration":
      return {
        code: "advisory_copilot_authority_configuration_rejected",
        status: 500,
      };
  }
}

function reportingAuthorityRejection(
  reason: Exclude<
    ReturnType<typeof applyReportOrderingRouteCallerContextHeaders>,
    { status: "not_applicable" } | { status: "applied" }
  >["reason"],
): { code: string; status: number } {
  switch (reason) {
    case "authenticated_principal_required":
      return {
        code: "reporting_authenticated_principal_required",
        status: 401,
      };
    case "reporting_scope_not_entitled":
      return { code: "reporting_scope_not_entitled", status: 403 };
    case "invalid_reporting_request":
      return { code: "reporting_invalid_request", status: 422 };
    case "development_authority_not_allowed":
    case "invalid_authority_mode":
    case "invalid_reporting_configuration":
      return {
        code: "reporting_authority_configuration_rejected",
        status: 500,
      };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, await params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, await params);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, await params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, await params);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, await params);
}
