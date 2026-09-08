import { NextRequest, NextResponse } from "next/server";
import {
  applyAdvisoryCopilotCallerContextHeaders,
} from "@/features/advisory-copilot/caller-context";
import {
  applyAdvisorBookCallerContextHeaders,
} from "@/features/advisor-book/caller-context";
import {
  applyAdvisorCockpitCallerContextHeaders,
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
} from "@/features/workbench/caller-context";
import { requiresAuthenticatedSessionPrincipal } from "@/features/workbench/authority-mode";
import { WORKBENCH_AUTHORITY_CONTEXT_HEADER } from "@/features/workbench/authority-context-contract";
import { buildGatewayBffRequestHeaders } from "@/features/workbench/bff-request-headers";
import { readGatewayBffResponse } from "@/features/workbench/bff-response";
import {
  advisoryCopilotAuthorityRejection,
  advisorBookAuthorityRejection,
  advisorCockpitAuthorityRejection,
  ideaAuthorityRejection,
  reportingAuthorityRejection,
} from "@/features/workbench/bff-authority-rejections";
import { authorizeConfiguredBffPrincipal } from "@/features/workbench/configured-bff-principal";
import type { ResolvedPrincipal } from "@/features/workbench/principal-credential";
import { derivePrincipalAuthorityContext } from "@/features/workbench/principal-authority-context";
import { resolveVerifiedBffRouteRequirement } from "@/features/workbench/verified-bff-route";

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
    const routeRequirement = resolveVerifiedBffRouteRequirement({
      method: request.method,
      upstreamPath,
      searchParams: request.nextUrl.searchParams,
      bodyText: requestBody,
    });
    if (routeRequirement) {
      const principalAuthority = await authorizeConfiguredBffPrincipal(
        request.headers.get("authorization"),
        routeRequirement,
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

  if (verifiedPrincipal) {
    responseHeaders.set(
      WORKBENCH_AUTHORITY_CONTEXT_HEADER,
      derivePrincipalAuthorityContext(verifiedPrincipal),
    );
  }

  return new NextResponse(responseBody, {
    status: response.status,
    headers: responseHeaders,
  });
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
