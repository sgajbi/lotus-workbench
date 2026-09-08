import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET, POST } from "@/app/api/bff/[...path]/route";
import * as configuredPrincipal from "@/features/workbench/configured-bff-principal";
import {
  BFF_PRINCIPAL_SESSION_CONTRACT_POSTURE,
  FORBIDDEN_BROWSER_AUTHORITY_HEADERS,
} from "@/features/workbench/caller-context";

describe("BFF proxy route", () => {
  const originalBffBaseUrl = process.env.BFF_BASE_URL;
  const callerContextEnvKeys = [
    "WORKBENCH_GATEWAY_REQUEST_TIMEOUT_MS",
    "WORKBENCH_BFF_ACTOR_ID",
    "WORKBENCH_BFF_CALLER_APPLICATION",
    "WORKBENCH_BFF_TENANT_ID",
    "WORKBENCH_BFF_REGION",
    "WORKBENCH_BFF_BOOKING_CENTER_CODE",
    "WORKBENCH_BFF_ROLE",
    "WORKBENCH_IDEA_CALLER_SUBJECT",
    "WORKBENCH_IDEA_CALLER_ROLES",
    "WORKBENCH_IDEA_CALLER_TENANT_IDS",
    "WORKBENCH_IDEA_CALLER_BOOK_IDS",
    "WORKBENCH_IDEA_CALLER_PORTFOLIO_IDS",
    "WORKBENCH_IDEA_CALLER_CLIENT_IDS",
    "WORKBENCH_IDEA_AUTH_MODE",
    "WORKBENCH_REPORTING_CALLER_PORTFOLIO_IDS",
    "WORKBENCH_REPORTING_CALLER_ROLE",
    "WORKBENCH_REPORTING_AUTH_MODE",
    "WORKBENCH_ADVISOR_BOOK_AUTH_MODE",
    "WORKBENCH_ADVISOR_BOOK_ACTOR_ID",
    "WORKBENCH_ADVISOR_BOOK_TENANT_ID",
    "WORKBENCH_ADVISOR_BOOK_REGION",
    "WORKBENCH_ADVISOR_BOOK_BOOKING_CENTER_CODE",
    "WORKBENCH_ADVISOR_BOOK_ROLE",
    "WORKBENCH_ADVISOR_COCKPIT_AUTH_MODE",
    "WORKBENCH_ADVISOR_COCKPIT_ACTOR_ID",
    "WORKBENCH_ADVISOR_COCKPIT_TENANT_ID",
    "WORKBENCH_ADVISOR_COCKPIT_REGION",
    "WORKBENCH_ADVISOR_COCKPIT_BOOKING_CENTER_CODE",
    "WORKBENCH_ADVISOR_COCKPIT_LEGAL_ENTITY_CODE",
    "WORKBENCH_ADVISOR_COCKPIT_PRINCIPAL_STATUS",
    "WORKBENCH_ADVISOR_COCKPIT_PORTFOLIO_IDS",
    "WORKBENCH_ADVISORY_COPILOT_AUTH_MODE",
    "WORKBENCH_ADVISORY_COPILOT_ACTOR_ID",
    "WORKBENCH_ADVISORY_COPILOT_TENANT_ID",
    "WORKBENCH_ADVISORY_COPILOT_LEGAL_ENTITY_CODE",
    "WORKBENCH_ADVISORY_COPILOT_ROLE",
    "WORKBENCH_ADVISORY_COPILOT_PRINCIPAL_STATUS",
    "WORKBENCH_ADVISORY_COPILOT_PORTFOLIO_IDS",
    "LOTUS_ENVIRONMENT",
  ] as const;
  const originalCallerContextEnv = Object.fromEntries(
    callerContextEnvKeys.map((key) => [key, process.env[key]]),
  );

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    delete process.env.BFF_BASE_URL;
    for (const key of callerContextEnvKeys) {
      delete process.env[key];
    }
    process.env.LOTUS_ENVIRONMENT = "dev";
  });

  afterEach(() => {
    process.env.BFF_BASE_URL = originalBffBaseUrl;
    for (const key of callerContextEnvKeys) {
      const original = originalCallerContextEnv[key];
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
  });

  it("records the platform BFF principal-session contract posture consumed by Workbench", () => {
    expect(BFF_PRINCIPAL_SESSION_CONTRACT_POSTURE).toEqual({
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
    });
    expect(FORBIDDEN_BROWSER_AUTHORITY_HEADERS).toEqual(
      expect.arrayContaining([
        "X-Actor-Id",
        "X-Caller-Capabilities",
        "X-Caller-Tenant-Ids",
        "X-Caller-Book-Ids",
        "X-Caller-Portfolio-Ids",
        "X-Caller-Client-Ids",
        "X-Capabilities",
        "X-Service-Identity",
        "X-Authorized-Proposal-Id",
        "Authorization",
        "Cookie",
        "Proxy-Authorization",
        "X-Session-Id",
      ]),
    );
  });

  it("denies a verified-posture Idea request before Gateway when principal resolution fails", async () => {
    process.env.LOTUS_ENVIRONMENT = "production";
    const fetchMock = vi.mocked(fetch);
    vi.spyOn(configuredPrincipal, "authorizeConfiguredBffPrincipal").mockResolvedValueOnce({
      status: "denied",
      denialClass: "present_but_unverified",
      httpStatus: 401,
    });

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/bff/api/v1/ideas/review-queues/advisor",
        {
          headers: {
            Authorization: "Bearer signed-but-untrusted",
            "X-Caller-Capabilities": "idea.review.record,manage.write",
            "X-Tenant-Id": "browser-tenant",
          },
        },
      ),
      { params: Promise.resolve({ path: ["api", "v1", "ideas", "review-queues", "advisor"] }) },
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "present_but_unverified",
      status: "rejected",
    });
  });

  it("forwards only a delegated credential after verified Idea admission", async () => {
    process.env.LOTUS_ENVIRONMENT = "production";
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('{"items":[]}', { status: 200 }));
    vi.spyOn(configuredPrincipal, "authorizeConfiguredBffPrincipal").mockResolvedValueOnce({
      status: "admitted",
      principal: {
        issuer: "https://identity.lotus.test",
        audience: ["lotus-workbench-bff"],
        subject: "user:advisor-001",
        tenantId: "tenant-sg",
        principalKind: "user",
        credentialId: "session-001",
        capabilities: new Set(["idea.review.queue.read"]),
        portfolioScope: new Set(["PB_SG_GLOBAL_BAL_001"]),
      },
      gatewayCredential: "delegated.credential.signature",
    });

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/bff/api/v1/ideas/review-queues/advisor",
        {
          headers: {
            Authorization: "Bearer verified-session-credential",
            Cookie: "lotus_session=browser-controlled",
            "X-Actor-Id": "browser-actor",
            "X-Caller-Capabilities": "manage.write",
            "X-Tenant-Id": "browser-tenant",
          },
        },
      ),
      { params: Promise.resolve({ path: ["api", "v1", "ideas", "review-queues", "advisor"] }) },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const upstreamHeaders = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(upstreamHeaders.get("Authorization")).toBe(
      "Bearer delegated.credential.signature",
    );
    expect(upstreamHeaders.get("Cookie")).toBeNull();
    expect(upstreamHeaders.get("X-Actor-Id")).toBeNull();
    expect(upstreamHeaders.get("X-Caller-Capabilities")).toBeNull();
    expect(upstreamHeaders.get("X-Tenant-Id")).toBeNull();
  });

  it("forwards GET requests to the configured upstream without the host header", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        headers: {
          "content-type": "application/json",
          "transfer-encoding": "chunked",
        },
      }),
    );

    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/lookups/portfolios?limit=1",
      {
        method: "GET",
        headers: {
          host: "localhost:3000",
          authorization: "Bearer token",
          "accept-encoding": "gzip",
        },
      },
    );

    const response = await GET(request, {
      params: Promise.resolve({ path: ["api", "v1", "lookups", "portfolios"] }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [upstreamUrl, upstreamInit] = fetchMock.mock.calls[0];
    const parsedUpstreamUrl = new URL(String(upstreamUrl));

    expect(parsedUpstreamUrl.origin).toBe("http://gateway.dev.lotus");
    expect(parsedUpstreamUrl.pathname).toBe("/api/v1/lookups/portfolios");
    expect(parsedUpstreamUrl.search).toBe("?limit=1");
    expect(upstreamInit).toEqual(
      expect.objectContaining({
        method: "GET",
        body: undefined,
        cache: "no-store",
      }),
    );
    const upstreamHeaders = upstreamInit?.headers as Headers;
    expect(upstreamHeaders.get("host")).toBeNull();
    expect(upstreamHeaders.get("authorization")).toBeNull();
    expect(upstreamHeaders.get("accept-encoding")).toBe("identity");
    expect(upstreamHeaders.get("X-Actor-Id")).toBe("workbench-system");
    expect(upstreamHeaders.get("X-Caller-Application")).toBe("lotus-workbench");
    expect(upstreamHeaders.get("X-Tenant-Id")).toBe("tenant-sg");
    expect(upstreamHeaders.get("X-Region")).toBe("APAC");
    expect(upstreamHeaders.get("X-Booking-Center-Code")).toBe("SG");
    expect(upstreamHeaders.get("X-Role")).toBe("advisor");
    expect(upstreamHeaders.get("X-Correlation-Id")).toMatch(
      /^corr-workbench-[0-9a-f]{16}$/,
    );
    expect(upstreamHeaders.get("traceparent")).toMatch(
      /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("transfer-encoding")).toBeNull();
    expect(await response.text()).toBe('{"ok":true}');
  });

  it.each([undefined, "uat", "production"])(
    "rejects a generic BFF request in %s before Gateway authority is available",
    async (environment) => {
      if (environment === undefined) {
        delete process.env.LOTUS_ENVIRONMENT;
      } else {
        process.env.LOTUS_ENVIRONMENT = environment;
      }
      const fetchMock = vi.mocked(fetch);
      const request = new NextRequest(
        "http://localhost:3000/api/bff/api/v1/lookups/portfolios?limit=1",
        {
          method: "GET",
          headers: {
            "X-Actor-Id": "browser-actor",
            "X-Tenant-Id": "browser-tenant",
            "X-Caller-Capabilities": "manage.write",
            Authorization: "Bearer browser-credential",
            Cookie: "lotus_session=browser-session",
          },
        },
      );

      const response = await GET(request, {
        params: Promise.resolve({
          path: ["api", "v1", "lookups", "portfolios"],
        }),
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({
        code: "workbench_authenticated_principal_required",
        status: "rejected",
      });
    },
  );

  it("describes decoded JSON bytes instead of forwarding stale compression metadata", async () => {
    const fetchMock = vi.mocked(fetch);
    const decodedBody = new TextEncoder().encode('{"status":"ready"}');
    fetchMock.mockResolvedValue(
      new Response(decodedBody, {
        status: 200,
        headers: {
          "cache-control": "private, no-store",
          "content-encoding": "gzip",
          "content-length": "47",
          "content-type": "application/json",
          "x-content-type-options": "nosniff",
        },
      }),
    );

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/bff/api/v1/platform/readiness",
      ),
      {
        params: Promise.resolve({
          path: ["api", "v1", "platform", "readiness"],
        }),
      },
    );

    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.get("content-length")).toBe(
      String(decodedBody.byteLength),
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual(
      Array.from(decodedBody),
    );
  });

  it("preserves exact identity-encoded binary download bytes and representation headers", async () => {
    const fetchMock = vi.mocked(fetch);
    const documentBytes = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
    fetchMock.mockResolvedValue(
      new Response(documentBytes, {
        status: 200,
        headers: {
          "cache-control": "private, no-store",
          "content-disposition": 'attachment; filename="review.pdf"',
          "content-encoding": "identity",
          "content-length": "999",
          "content-type": "application/pdf",
        },
      }),
    );

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/bff/api/v1/documents/doc-1/download",
      ),
      {
        params: Promise.resolve({
          path: ["api", "v1", "documents", "doc-1", "download"],
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.get("content-length")).toBe(
      String(documentBytes.byteLength),
    );
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="review.pdf"',
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(documentBytes);
  });

  it.each([204, 205, 304])(
    "keeps upstream %s responses bodyless",
    async (status) => {
      const fetchMock = vi.mocked(fetch);
      const upstreamResponse = new Response(null, {
        status,
        headers: {
          "cache-control": "private, no-store",
          "content-encoding": "gzip",
          "content-length": status === 304 ? "321" : "999",
          etag: '"source-revision-7"',
        },
      });
      const bodyRead = vi.spyOn(upstreamResponse, "arrayBuffer");
      fetchMock.mockResolvedValue(upstreamResponse);

      const response = await GET(
        new NextRequest(
          "http://localhost:3000/api/bff/api/v1/platform/readiness",
        ),
        {
          params: Promise.resolve({
            path: ["api", "v1", "platform", "readiness"],
          }),
        },
      );

      expect(response.status).toBe(status);
      expect(response.body).toBeNull();
      expect(await response.text()).toBe("");
      expect(bodyRead).not.toHaveBeenCalled();
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("etag")).toBe('"source-revision-7"');
      expect(response.headers.get("content-encoding")).toBe(
        status === 304 ? "gzip" : null,
      );
      expect(response.headers.get("content-length")).toBe(
        status === 304 ? "321" : null,
      );
    },
  );

  it("keeps HEAD responses bodyless while preserving representation metadata", async () => {
    const fetchMock = vi.mocked(fetch);
    const upstreamResponse = new Response(null, {
      status: 200,
      headers: {
        "content-length": "321",
        "content-type": "application/pdf",
        etag: '"document-revision-4"',
      },
    });
    const bodyRead = vi.spyOn(upstreamResponse, "arrayBuffer");
    fetchMock.mockResolvedValue(upstreamResponse);

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/bff/api/v1/documents/doc-1/download",
        { method: "HEAD" },
      ),
      {
        params: Promise.resolve({
          path: ["api", "v1", "documents", "doc-1", "download"],
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
    expect(bodyRead).not.toHaveBeenCalled();
    expect(response.headers.get("content-length")).toBe("321");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("etag")).toBe('"document-revision-4"');
  });

  it("preserves supported byte-range semantics while removing hop-by-hop fields", async () => {
    const fetchMock = vi.mocked(fetch);
    const rangeBytes = Uint8Array.from([0x44, 0x46, 0x2d]);
    const upstreamResponse = new Response(rangeBytes, {
      status: 206,
      headers: {
        "accept-ranges": "bytes",
        "cache-control": "private, no-store",
        connection: "keep-alive, x-gateway-hop",
        "content-length": "8",
        "content-range": "bytes 2-4/10",
        "content-type": "application/pdf",
        "keep-alive": "timeout=5",
        "transfer-encoding": "chunked",
        "x-gateway-hop": "remove-me",
        "x-content-type-options": "nosniff",
      },
    });
    fetchMock.mockResolvedValue(upstreamResponse);

    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/documents/doc-1/download",
      {
        headers: { range: "bytes=2-4" },
      },
    );
    expect(request.headers.get("range")).toBe("bytes=2-4");
    const response = await GET(request, {
      params: Promise.resolve({
        path: ["api", "v1", "documents", "doc-1", "download"],
      }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(206);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-range")).toBe("bytes 2-4/10");
    expect(response.headers.get("content-length")).toBe("3");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("connection")).toBeNull();
    expect(response.headers.get("keep-alive")).toBeNull();
    expect(response.headers.get("transfer-encoding")).toBeNull();
    expect(response.headers.get("x-gateway-hop")).toBeNull();
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(rangeBytes);
  });

  it("preserves encoded source identities when forwarding through the BFF", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/dpm/command-center/waves/campaign-definitions/campaign-holdings%2F202605/versions/2026.05%20final",
      { method: "GET" },
    );

    const response = await GET(request, {
      params: Promise.resolve({
        path: [
          "api",
          "v1",
          "dpm",
          "command-center",
          "waves",
          "campaign-definitions",
          "campaign-holdings/202605",
          "versions",
          "2026.05 final",
        ],
      }),
    });

    expect(response.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "http://gateway.dev.lotus/api/v1/dpm/command-center/waves/campaign-definitions/campaign-holdings%2F202605/versions/2026.05%20final",
    );
  });

  it.each([
    ["portfolio", "GET", "api/v1/portfolios/PF_1001/book"],
    ["performance", "GET", "api/v1/workbench/PF_1001/performance/summary"],
    ["risk", "GET", "api/v1/workbench/PF_1001/risk/summary"],
    ["DPM", "GET", "api/v1/dpm/mandates"],
    ["proposals", "GET", "api/v1/proposals"],
    ["advisory workspaces", "GET", "api/v1/advisory-workspaces/PF_1001"],
    ["documents", "GET", "api/v1/documents/doc_1/download"],
    ["intake", "POST", "api/v1/intake/portfolio-bundle"],
    ["lookups", "GET", "api/v1/lookups/portfolios"],
    ["platform", "GET", "api/v1/platform/readiness"],
  ])(
    "rejects browser authority across the %s route family",
    async (_family, method, upstreamPath) => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
      const browserHeaders = new Headers({
        Accept: "application/json",
        "Accept-Language": "en-SG",
        "Content-Type": "application/json",
        "Idempotency-Key": "governed-request-1",
        "If-Match": '"version-2"',
        "X-Correlation-Id": "corr-workbench-bff-boundary-1",
        traceparent: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01",
      });
      for (const headerName of FORBIDDEN_BROWSER_AUTHORITY_HEADERS) {
        browserHeaders.set(headerName, "browser-supplied-authority");
      }
      const body =
        method === "POST"
          ? JSON.stringify({ portfolio_id: "PF_1001" })
          : undefined;
      const request = new NextRequest(
        `http://localhost:3000/api/bff/${upstreamPath}`,
        { method, headers: browserHeaders, body },
      );
      const params = Promise.resolve({ path: upstreamPath.split("/") });

      const response =
        method === "POST"
          ? await POST(request, { params })
          : await GET(request, { params });

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const upstreamHeaders = fetchMock.mock.calls[0][1]?.headers as Headers;
      expect(upstreamHeaders.get("Accept")).toBe("application/json");
      expect(upstreamHeaders.get("Accept-Language")).toBe("en-SG");
      expect(upstreamHeaders.get("Idempotency-Key")).toBe("governed-request-1");
      expect(upstreamHeaders.get("If-Match")).toBe('"version-2"');
      expect(upstreamHeaders.get("X-Correlation-Id")).toBe(
        "corr-workbench-bff-boundary-1",
      );
      expect(upstreamHeaders.get("X-Actor-Id")).toBe("workbench-system");
      expect(upstreamHeaders.get("X-Caller-Application")).toBe(
        "lotus-workbench",
      );
      expect(upstreamHeaders.get("X-Tenant-Id")).toBe("tenant-sg");
      expect(upstreamHeaders.get("X-Region")).toBe("APAC");
      expect(upstreamHeaders.get("X-Booking-Center-Code")).toBe("SG");
      expect(upstreamHeaders.get("X-Role")).toBe("advisor");

      for (const headerName of FORBIDDEN_BROWSER_AUTHORITY_HEADERS) {
        if (
          [
            "X-Actor-Id",
            "X-Caller-Application",
            "X-Tenant-Id",
            "X-Region",
            "X-Booking-Center-Code",
            "X-Role",
          ].includes(headerName)
        ) {
          continue;
        }
        expect(
          upstreamHeaders.get(headerName),
          `${_family}: ${headerName}`,
        ).toBeNull();
      }
    },
  );

  it("forwards mutating request bodies to the upstream", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response('{"accepted":true}', { status: 202 }),
    );

    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/intake/portfolio-bundle",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ body: { portfolio_id: "PORT_1001" } }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({
        path: ["api", "v1", "intake", "portfolio-bundle"],
      }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [upstreamUrl, upstreamInit] = fetchMock.mock.calls[0];
    const parsedUpstreamUrl = new URL(String(upstreamUrl));

    expect(parsedUpstreamUrl.origin).toBe("http://gateway.dev.lotus");
    expect(parsedUpstreamUrl.pathname).toBe("/api/v1/intake/portfolio-bundle");
    expect(upstreamInit).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ body: { portfolio_id: "PORT_1001" } }),
      }),
    );
    expect(response.status).toBe(202);
  });

  it("returns a truthful non-cacheable timeout without retrying the mutation", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValue(
      new DOMException("Gateway timed out", "TimeoutError"),
    );
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/intake/portfolio-bundle",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: { portfolio_id: "PORT_1001" } }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({
        path: ["api", "v1", "intake", "portfolio-bundle"],
      }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(504);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      code: "gateway_request_timed_out",
      status: "unavailable",
    });
  });

  it("keeps a streamed Gateway body timeout inside the bounded failure contract", async () => {
    const fetchMock = vi.mocked(fetch);
    const upstreamResponse = new Response(null, { status: 202 });
    vi.spyOn(upstreamResponse, "arrayBuffer").mockRejectedValue(
      new DOMException("Gateway body timed out", "TimeoutError"),
    );
    fetchMock.mockResolvedValue(upstreamResponse);
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/intake/portfolio-bundle",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: { portfolio_id: "PORT_1001" } }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({
        path: ["api", "v1", "intake", "portfolio-bundle"],
      }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(504);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      code: "gateway_request_timed_out",
      status: "unavailable",
    });
  });

  it("returns a truthful non-cacheable failure for a Gateway network error", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValue(new TypeError("connection refused"));
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/lookups/portfolios",
      { method: "GET" },
    );

    const response = await GET(request, {
      params: Promise.resolve({ path: ["api", "v1", "lookups", "portfolios"] }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      code: "gateway_request_failed",
      status: "unavailable",
    });
  });

  it("derives Idea mutation authority at the BFF instead of trusting browser headers", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));

    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/ideas/candidates/idea_high_cash_001/review-actions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Actor-Id": "spoofed-actor",
          "X-Caller-Application": "spoofed-application",
          "X-Tenant-Id": "spoofed-tenant",
          "X-Region": "spoofed-region",
          "X-Booking-Center-Code": "spoofed-centre",
          "X-Role": "administrator",
          "X-Caller-Subject": "spoofed-subject",
          "X-Caller-Roles": "compliance",
          "X-Caller-Capabilities": "idea.conversion.intent.record",
          "X-Caller-Tenant-Ids": "UNENTITLED_TENANT",
          "X-Caller-Book-Ids": "UNENTITLED_BOOK",
          "X-Caller-Portfolio-Ids": "UNENTITLED_PORTFOLIO",
          "X-Caller-Client-Ids": "UNENTITLED_CLIENT",
          "X-Principal-Status": "SUSPENDED",
          Authorization: "Bearer browser-asserted-authority",
          Cookie: "lotus_session=browser-asserted-cookie",
          "Proxy-Authorization": "Basic browser-proxy-authority",
          "X-Session-Id": "browser-session-id",
        },
        body: JSON.stringify({ action: "approve_for_conversion" }),
      },
    );

    await POST(request, {
      params: Promise.resolve({
        path: [
          "api",
          "v1",
          "ideas",
          "candidates",
          "idea_high_cash_001",
          "review-actions",
        ],
      }),
    });

    const upstreamHeaders = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(upstreamHeaders.get("X-Actor-Id")).toBe("workbench-system");
    expect(upstreamHeaders.get("X-Caller-Application")).toBe("lotus-workbench");
    expect(upstreamHeaders.get("X-Tenant-Id")).toBe("tenant-sg");
    expect(upstreamHeaders.get("X-Region")).toBe("APAC");
    expect(upstreamHeaders.get("X-Booking-Center-Code")).toBe("SG");
    expect(upstreamHeaders.get("X-Role")).toBe("advisor");
    expect(upstreamHeaders.get("X-Caller-Subject")).toBe("workbench-advisor");
    expect(upstreamHeaders.get("X-Caller-Roles")).toBe("advisor");
    expect(upstreamHeaders.get("X-Caller-Capabilities")).toBe(
      "idea.review.record",
    );
    expect(upstreamHeaders.get("X-Caller-Tenant-Ids")).toBe(
      "tenant-private-bank-sg",
    );
    expect(upstreamHeaders.get("X-Caller-Book-Ids")).toBe("book-advisor-001");
    expect(upstreamHeaders.get("X-Caller-Portfolio-Ids")).toBe(
      "PB_SG_GLOBAL_BAL_001",
    );
    expect(upstreamHeaders.get("X-Caller-Client-Ids")).toBe("client-001");
    expect(upstreamHeaders.get("X-Principal-Status")).toBeNull();
    expect(upstreamHeaders.get("Authorization")).toBeNull();
    expect(upstreamHeaders.get("Cookie")).toBeNull();
    expect(upstreamHeaders.get("Proxy-Authorization")).toBeNull();
    expect(upstreamHeaders.get("X-Session-Id")).toBeNull();
  });

  it("derives explicitly configured complete Idea scope at the BFF", async () => {
    process.env.WORKBENCH_IDEA_CALLER_TENANT_IDS = "tenant-ch";
    process.env.WORKBENCH_IDEA_CALLER_BOOK_IDS = "book-rm-ch-007";
    process.env.WORKBENCH_IDEA_CALLER_PORTFOLIO_IDS = "PB_CH_BAL_007";
    process.env.WORKBENCH_IDEA_CALLER_CLIENT_IDS = "client-ch-007";
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));

    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/ideas/candidates/idea_001/feedback",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          feedbackId: "feedback_001",
          taxonomyVersion: "idea-feedback-taxonomy-v1",
          outcome: "useful",
          reason: "relevant",
          recordedAtUtc: "2026-08-31T10:15:00Z",
        }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({
        path: ["api", "v1", "ideas", "candidates", "idea_001", "feedback"],
      }),
    });

    expect(response.status).toBe(200);
    const upstreamHeaders = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(upstreamHeaders.get("X-Caller-Tenant-Ids")).toBe("tenant-ch");
    expect(upstreamHeaders.get("X-Caller-Book-Ids")).toBe("book-rm-ch-007");
    expect(upstreamHeaders.get("X-Caller-Portfolio-Ids")).toBe("PB_CH_BAL_007");
    expect(upstreamHeaders.get("X-Caller-Client-Ids")).toBe("client-ch-007");
    expect(upstreamHeaders.get("X-Caller-Capabilities")).toBe(
      "idea.feedback.record",
    );
  });

  it.each([
    ["ai-explanations", "idea.ai-explanation.generate"],
    ["review-actions", "idea.review.record"],
    ["feedback", "idea.feedback.record"],
    ["conversion-intents", "idea.conversion.intent.record"],
  ])(
    "derives Idea %s capability from the allowlisted BFF route",
    async (routeSuffix, expectedCapability) => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
      const explanationRequestId =
        "idea-explanation-idea_high_cash_001-11111111-1111-4111-8111-111111111111";
      const idempotencyKey =
        routeSuffix === "ai-explanations"
          ? explanationRequestId
          : `idem-${routeSuffix}`;
      const body =
        routeSuffix === "ai-explanations"
          ? {
              requestId: explanationRequestId,
              purpose: "advisor_rationale_draft",
              requestedAtUtc: "2026-09-05T11:30:00Z",
            }
          : { reasonCodes: ["review_required"] };
      const request = new NextRequest(
        `http://localhost:3000/api/bff/api/v1/ideas/candidates/idea_high_cash_001/${routeSuffix}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "Idempotency-Key": idempotencyKey,
            "X-Caller-Capabilities": "idea.admin",
          },
          body: JSON.stringify(body),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({
          path: [
            "api",
            "v1",
            "ideas",
            "candidates",
            "idea_high_cash_001",
            routeSuffix,
          ],
        }),
      });

      expect(response.status).toBe(200);
      const upstreamHeaders = fetchMock.mock.calls[0][1]?.headers as Headers;
      expect(upstreamHeaders.get("X-Caller-Capabilities")).toBe(
        expectedCapability,
      );
      expect(upstreamHeaders.get("Idempotency-Key")).toBe(idempotencyKey);
    },
  );

  it.each([
    {
      name: "an unrecognized field",
      idempotencyKey:
        "idea-explanation-idea_high_cash_001-11111111-1111-4111-8111-111111111111",
      body: {
        requestId:
          "idea-explanation-idea_high_cash_001-11111111-1111-4111-8111-111111111111",
        purpose: "advisor_rationale_draft",
        requestedAtUtc: "2026-09-05T11:30:00Z",
        prompt: "Make this persuasive",
      },
    },
    {
      name: "a caller-selected purpose",
      idempotencyKey:
        "idea-explanation-idea_high_cash_001-11111111-1111-4111-8111-111111111111",
      body: {
        requestId:
          "idea-explanation-idea_high_cash_001-11111111-1111-4111-8111-111111111111",
        purpose: "client_recommendation",
        requestedAtUtc: "2026-09-05T11:30:00Z",
      },
    },
    {
      name: "a mismatched idempotency key",
      idempotencyKey: "different-request",
      body: {
        requestId:
          "idea-explanation-idea_high_cash_001-11111111-1111-4111-8111-111111111111",
        purpose: "advisor_rationale_draft",
        requestedAtUtc: "2026-09-05T11:30:00Z",
      },
    },
    {
      name: "an identity that was not securely generated for the candidate",
      idempotencyKey: "reused-request",
      body: {
        requestId: "reused-request",
        purpose: "advisor_rationale_draft",
        requestedAtUtc: "2026-09-05T11:30:00Z",
      },
    },
    {
      name: "a timestamp without timezone evidence",
      idempotencyKey:
        "idea-explanation-idea_high_cash_001-11111111-1111-4111-8111-111111111111",
      body: {
        requestId:
          "idea-explanation-idea_high_cash_001-11111111-1111-4111-8111-111111111111",
        purpose: "advisor_rationale_draft",
        requestedAtUtc: "2026-09-05T11:30:00",
      },
    },
  ])(
    "rejects Idea explanation authority for $name",
    async ({ idempotencyKey, body }) => {
      const fetchMock = vi.mocked(fetch);
      const request = new NextRequest(
        "http://localhost:3000/api/bff/api/v1/ideas/candidates/idea_high_cash_001/ai-explanations",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(body),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({
          path: [
            "api",
            "v1",
            "ideas",
            "candidates",
            "idea_high_cash_001",
            "ai-explanations",
          ],
        }),
      });

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({
        code: "idea_request_invalid",
        status: "rejected",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("preserves a once-decoded candidate identity when validating an explanation request", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    const requestId =
      "idea-explanation-idea%2F2026-11111111-1111-4111-8111-111111111111";
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/ideas/candidates/idea%252F2026/ai-explanations",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": requestId,
        },
        body: JSON.stringify({
          requestId,
          purpose: "advisor_rationale_draft",
          requestedAtUtc: "2026-09-05T11:30:00Z",
        }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({
        path: [
          "api",
          "v1",
          "ideas",
          "candidates",
          "idea%2F2026",
          "ai-explanations",
        ],
      }),
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const upstreamHeaders = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(upstreamHeaders.get("X-Caller-Capabilities")).toBe(
      "idea.ai-explanation.generate",
    );
  });

  it("injects the single entitled tenant into an exact Idea presentation receipt", async () => {
    process.env.WORKBENCH_IDEA_CALLER_TENANT_IDS = "tenant-private-bank-sg";
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            receipt: { tenantId: "tenant-private-bank-sg" },
            persistenceDecision: "accepted",
          },
        }),
        { status: 201 },
      ),
    );
    const body = {
      presentedAtUtc: "2026-08-31T10:15:00Z",
      rankAtPresentation: 25,
      visibleCandidateCount: 1,
      queueSnapshotDigest: `sha256:${"a".repeat(64)}`,
      queuePolicyVersion: "idea-deterministic-ranking-v1",
      rankingPolicyVersion: "idle-liquidity-v1",
      candidateMaterialVersion: 2,
      candidateEvidenceVersion: 3,
    };
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/ideas/candidates/idea_025/presentation-receipts",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": "presentation-idea-025",
        },
        body: JSON.stringify(body),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({
        path: [
          "api",
          "v1",
          "ideas",
          "candidates",
          "idea_025",
          "presentation-receipts",
        ],
      }),
    });

    expect(response.status).toBe(201);
    const upstreamRequest = fetchMock.mock.calls[0][1];
    const upstreamHeaders = upstreamRequest?.headers as Headers;
    expect(upstreamHeaders.get("X-Caller-Capabilities")).toBe(
      "idea.presentation-receipt.record",
    );
    expect(upstreamHeaders.get("X-Caller-Tenant-Ids")).toBe(
      "tenant-private-bank-sg",
    );
    expect(upstreamHeaders.get("Idempotency-Key")).toBe(
      "presentation-idea-025",
    );
    expect(JSON.parse(String(upstreamRequest?.body))).toEqual({
      ...body,
      tenantId: "tenant-private-bank-sg",
    });
  });

  it("rejects Idea presentation evidence attributed to another tenant", async () => {
    process.env.WORKBENCH_IDEA_CALLER_TENANT_IDS = "tenant-private-bank-sg";
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            receipt: { tenantId: "tenant-other-bank" },
            persistenceDecision: "accepted",
          },
        }),
        { status: 201 },
      ),
    );
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/ideas/candidates/idea_025/presentation-receipts",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          presentedAtUtc: "2026-08-31T10:15:00Z",
          rankAtPresentation: 25,
          visibleCandidateCount: 1,
          queueSnapshotDigest: `sha256:${"a".repeat(64)}`,
          queuePolicyVersion: "idea-deterministic-ranking-v1",
          rankingPolicyVersion: "idle-liquidity-v1",
          candidateMaterialVersion: 2,
          candidateEvidenceVersion: 3,
        }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({
        path: [
          "api",
          "v1",
          "ideas",
          "candidates",
          "idea_025",
          "presentation-receipts",
        ],
      }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      code: "idea_response_authority_mismatch",
      status: "unavailable",
    });
  });

  it.each(["tenantId", "tenant_id"])(
    "rejects browser-owned Idea presentation authority in %s",
    async (tenantField) => {
      const fetchMock = vi.mocked(fetch);
      const request = new NextRequest(
        "http://localhost:3000/api/bff/api/v1/ideas/candidates/idea_001/presentation-receipts",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ [tenantField]: "spoofed-tenant" }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({
          path: [
            "api",
            "v1",
            "ideas",
            "candidates",
            "idea_001",
            "presentation-receipts",
          ],
        }),
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({
        code: "idea_request_invalid",
        status: "rejected",
      });
    },
  );

  it("fails closed when presentation authority resolves more than one tenant", async () => {
    process.env.WORKBENCH_IDEA_CALLER_TENANT_IDS = "tenant-a,tenant-b";
    const fetchMock = vi.mocked(fetch);
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/ideas/candidates/idea_001/presentation-receipts",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({
        path: [
          "api",
          "v1",
          "ideas",
          "candidates",
          "idea_001",
          "presentation-receipts",
        ],
      }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: "idea_authority_configuration_rejected",
      status: "rejected",
    });
  });

  it("requires an authenticated Idea principal outside development before proxying", async () => {
    process.env.LOTUS_ENVIRONMENT = "uat";
    const fetchMock = vi.mocked(fetch);

    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/ideas/review-queues/advisor",
      { method: "GET" },
    );

    const response = await GET(request, {
      params: Promise.resolve({
        path: ["api", "v1", "ideas", "review-queues", "advisor"],
      }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      code: "idea_authenticated_principal_required",
      status: "rejected",
    });
  });

  it("fails closed when the Idea runtime environment is unconfigured", async () => {
    delete process.env.LOTUS_ENVIRONMENT;
    const fetchMock = vi.mocked(fetch);

    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/ideas/review-queues/advisor",
      { method: "GET" },
    );

    const response = await GET(request, {
      params: Promise.resolve({
        path: ["api", "v1", "ideas", "review-queues", "advisor"],
      }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "idea_authenticated_principal_required",
      status: "rejected",
    });
  });

  it("rejects an unallowlisted Idea route before proxying in development", async () => {
    const fetchMock = vi.mocked(fetch);

    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/ideas/unsupported-route",
      { method: "GET" },
    );

    const response = await GET(request, {
      params: Promise.resolve({
        path: ["api", "v1", "ideas", "unsupported-route"],
      }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "idea_route_not_supported",
      status: "rejected",
    });
  });

  it("rejects development-configured Idea authority outside development before proxying", async () => {
    process.env.LOTUS_ENVIRONMENT = "production";
    process.env.WORKBENCH_IDEA_AUTH_MODE = "development_configured";
    const fetchMock = vi.mocked(fetch);

    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/ideas/review-queues/advisor",
      { method: "GET" },
    );

    const response = await GET(request, {
      params: Promise.resolve({
        path: ["api", "v1", "ideas", "review-queues", "advisor"],
      }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: "idea_authority_configuration_rejected",
      status: "rejected",
    });
  });

  it("preserves binary upstream responses for archived document downloads", async () => {
    const fetchMock = vi.mocked(fetch);
    const pdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);
    fetchMock.mockResolvedValue(
      new Response(pdfBytes, {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": "attachment; filename=portfolio-review.pdf",
          "x-document-checksum-algorithm": "sha256",
          "x-document-checksum": "abc123",
        },
      }),
    );

    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/documents/doc_1/download",
      {
        method: "GET",
        headers: {
          "X-Actor-Id": "advisor_1",
          "X-Tenant-Id": "tenant-sg",
          "X-Region": "APAC",
        },
      },
    );

    const response = await GET(request, {
      params: Promise.resolve({
        path: ["api", "v1", "documents", "doc_1", "download"],
      }),
    });

    const [upstreamUrl] = fetchMock.mock.calls[0];
    const upstreamHeaders = fetchMock.mock.calls[0][1]?.headers as Headers;
    const body = new Uint8Array(await response.arrayBuffer());

    expect(String(upstreamUrl)).toBe(
      "http://gateway.dev.lotus/api/v1/documents/doc_1/download",
    );
    expect(upstreamHeaders.get("X-Actor-Id")).toBe("workbench-system");
    expect(upstreamHeaders.get("X-Tenant-Id")).toBe("tenant-sg");
    expect(upstreamHeaders.get("X-Region")).toBe("APAC");
    expect(upstreamHeaders.get("X-Caller-Application")).toBe("lotus-workbench");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("x-document-checksum")).toBe("abc123");
    expect(Array.from(body)).toEqual(Array.from(pdfBytes));
  });

  it("derives advisor-book authority at the BFF instead of trusting browser headers", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('{"items":[]}', { status: 200 }));
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/advisor-book/portfolios?asOfDate=2026-04-10",
      {
        method: "GET",
        headers: {
          "X-Actor-Id": "spoofed-actor",
          "X-Tenant-Id": "spoofed-tenant",
          "X-Region": "spoofed-region",
          "X-Booking-Center-Code": "spoofed-centre",
          "X-Role": "AUDIT",
          "X-Caller-Subject": "spoofed-subject",
          "X-Caller-Roles": "book-administrator",
          "X-Caller-Capabilities": "advisor.book.write",
          "X-Caller-Portfolio-Ids": "UNENTITLED_PORTFOLIO",
          "X-Caller-Client-Ids": "UNENTITLED_CLIENT",
          "X-Caller-Book-Ids": "UNENTITLED_BOOK",
          Authorization: "Bearer browser-asserted-authority",
          Cookie: "lotus_session=browser-asserted-cookie",
        },
      },
    );

    const response = await GET(request, {
      params: Promise.resolve({
        path: ["api", "v1", "advisor-book", "portfolios"],
      }),
    });

    expect(response.status).toBe(200);
    const upstreamHeaders = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(upstreamHeaders.get("X-Actor-Id")).toBe("PM_SG_001");
    expect(upstreamHeaders.get("X-Tenant-Id")).toBe("tenant-sg");
    expect(upstreamHeaders.get("X-Region")).toBe("APAC");
    expect(upstreamHeaders.get("X-Booking-Center-Code")).toBe("Singapore");
    expect(upstreamHeaders.get("X-Role")).toBe("ADVISOR");
    expect(upstreamHeaders.get("X-Caller-Capabilities")).toBe(
      "advisor.book.read",
    );
    expect(upstreamHeaders.get("X-Caller-Subject")).toBeNull();
    expect(upstreamHeaders.get("X-Caller-Roles")).toBeNull();
    expect(upstreamHeaders.get("X-Caller-Portfolio-Ids")).toBeNull();
    expect(upstreamHeaders.get("X-Caller-Client-Ids")).toBeNull();
    expect(upstreamHeaders.get("X-Caller-Book-Ids")).toBeNull();
    expect(upstreamHeaders.get("Authorization")).toBeNull();
    expect(upstreamHeaders.get("Cookie")).toBeNull();
  });

  it("uses explicitly configured development advisor-book identity", async () => {
    process.env.WORKBENCH_ADVISOR_BOOK_ACTOR_ID = "RM_CH_007";
    process.env.WORKBENCH_ADVISOR_BOOK_TENANT_ID = "tenant-ch";
    process.env.WORKBENCH_ADVISOR_BOOK_REGION = "EMEA";
    process.env.WORKBENCH_ADVISOR_BOOK_BOOKING_CENTER_CODE = "Zurich";
    process.env.WORKBENCH_ADVISOR_BOOK_ROLE = "RELATIONSHIP_MANAGER";
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('{"items":[]}', { status: 200 }));

    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/advisor-book/portfolios?asOfDate=2026-04-10",
      { method: "GET" },
    );
    await GET(request, {
      params: Promise.resolve({
        path: ["api", "v1", "advisor-book", "portfolios"],
      }),
    });

    const upstreamHeaders = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(upstreamHeaders.get("X-Actor-Id")).toBe("RM_CH_007");
    expect(upstreamHeaders.get("X-Tenant-Id")).toBe("tenant-ch");
    expect(upstreamHeaders.get("X-Region")).toBe("EMEA");
    expect(upstreamHeaders.get("X-Booking-Center-Code")).toBe("Zurich");
    expect(upstreamHeaders.get("X-Role")).toBe("RELATIONSHIP_MANAGER");
  });

  it("requires an authenticated advisor-book principal outside development", async () => {
    process.env.LOTUS_ENVIRONMENT = "uat";
    const fetchMock = vi.mocked(fetch);
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/advisor-book/portfolios?asOfDate=2026-04-10",
      { method: "GET" },
    );

    const response = await GET(request, {
      params: Promise.resolve({
        path: ["api", "v1", "advisor-book", "portfolios"],
      }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "advisor_book_authenticated_principal_required",
      status: "rejected",
    });
  });

  it("rejects an invalid advisor-book role before proxying", async () => {
    process.env.WORKBENCH_ADVISOR_BOOK_ROLE = "AUDIT";
    const fetchMock = vi.mocked(fetch);
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/advisor-book/portfolios?asOfDate=2026-04-10",
      { method: "GET" },
    );

    const response = await GET(request, {
      params: Promise.resolve({
        path: ["api", "v1", "advisor-book", "portfolios"],
      }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: "advisor_book_authority_configuration_rejected",
      status: "rejected",
    });
  });

  it("derives least-privilege Advisor Cockpit read authority from the configured principal", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('{"items":[]}', { status: 200 }));
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/advisor-cockpit/actions?portfolio_id=PB_SG_GLOBAL_BAL_001&limit=25",
      {
        method: "GET",
        headers: {
          "X-Actor-Id": "spoofed-actor",
          "X-Caller-Application": "spoofed-application",
          "X-Tenant-Id": "spoofed-tenant",
          "X-Region": "spoofed-region",
          "X-Booking-Center-Code": "spoofed-centre",
          "X-Legal-Entity-Code": "spoofed-entity",
          "X-Role": "DESK_HEAD",
          "X-Caller-Capabilities": "advisory.advisor_cockpit.acknowledge",
          "X-Principal-Status": "SUSPENDED",
          "X-Authorized-Advisor-Id": "another-advisor",
          "X-Authorized-Portfolio-Id": "UNENTITLED_PORTFOLIO",
          Authorization: "Bearer browser-asserted-authority",
          Cookie: "lotus_session=browser-asserted-cookie",
        },
      },
    );

    const response = await GET(request, {
      params: Promise.resolve({
        path: ["api", "v1", "advisor-cockpit", "actions"],
      }),
    });

    expect(response.status).toBe(200);
    const [upstreamUrl, upstreamInit] = fetchMock.mock.calls[0];
    expect(String(upstreamUrl)).toBe(
      "http://gateway.dev.lotus/api/v1/advisor-cockpit/actions?portfolio_id=PB_SG_GLOBAL_BAL_001&limit=25",
    );
    const upstreamHeaders = upstreamInit?.headers as Headers;
    expect(upstreamHeaders.get("X-Actor-Id")).toBe("advisor_sg_001");
    expect(upstreamHeaders.get("X-Caller-Application")).toBe("lotus-workbench");
    expect(upstreamHeaders.get("X-Tenant-Id")).toBe("tenant-sg");
    expect(upstreamHeaders.get("X-Region")).toBe("APAC");
    expect(upstreamHeaders.get("X-Booking-Center-Code")).toBe("SG");
    expect(upstreamHeaders.get("X-Legal-Entity-Code")).toBe("SGPB");
    expect(upstreamHeaders.get("X-Role")).toBe("ADVISOR");
    expect(upstreamHeaders.get("X-Caller-Capabilities")).toBe(
      "advisory.advisor_cockpit.read",
    );
    expect(upstreamHeaders.get("X-Principal-Status")).toBe("ACTIVE");
    expect(upstreamHeaders.get("X-Authorized-Advisor-Id")).toBe(
      "advisor_sg_001",
    );
    expect(upstreamHeaders.get("X-Authorized-Portfolio-Id")).toBe(
      "PB_SG_GLOBAL_BAL_001",
    );
    expect(upstreamHeaders.get("Authorization")).toBeNull();
    expect(upstreamHeaders.get("Cookie")).toBeNull();
  });

  it("rejects a report-ordering role outside the source catalogue vocabulary", async () => {
    process.env.WORKBENCH_REPORTING_CALLER_ROLE = "relationship_manager";
    const fetchMock = vi.mocked(fetch);
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/report-ordering/options?scopeType=portfolio&scopeId=PB_SG_GLOBAL_BAL_001",
      { method: "GET" },
    );

    const response = await GET(request, {
      params: Promise.resolve({
        path: ["api", "v1", "report-ordering", "options"],
      }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: "reporting_authority_configuration_rejected",
      status: "rejected",
    });
  });

  it("applies the read capability to Advisor Cockpit object lookup", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('{"data":{}}', { status: 200 }));
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/advisor-cockpit/actions/action_1?portfolio_id=PB_SG_GLOBAL_BAL_001",
      { method: "GET" },
    );

    const response = await GET(request, {
      params: Promise.resolve({
        path: ["api", "v1", "advisor-cockpit", "actions", "action_1"],
      }),
    });

    expect(response.status).toBe(200);
    const upstreamHeaders = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(upstreamHeaders.get("X-Caller-Capabilities")).toBe(
      "advisory.advisor_cockpit.read",
    );
  });

  it("uses acknowledgement-only authority and derives the acknowledging advisor", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('{"data":{}}', { status: 200 }));
    const body = JSON.stringify({
      action_item_version: 3,
      acknowledgement_note: "Reviewed before the client meeting.",
    });
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/advisor-cockpit/actions/action_1/acknowledgements?portfolio_id=PB_SG_GLOBAL_BAL_001",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": "idem-action-1-v3",
          "X-Caller-Capabilities": "advisory.advisor_cockpit.read",
          "X-Authorized-Advisor-Id": "spoofed-advisor",
        },
        body,
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({
        path: [
          "api",
          "v1",
          "advisor-cockpit",
          "actions",
          "action_1",
          "acknowledgements",
        ],
      }),
    });

    expect(response.status).toBe(200);
    const upstreamInit = fetchMock.mock.calls[0][1];
    const upstreamHeaders = upstreamInit?.headers as Headers;
    expect(upstreamInit?.body).toBe(body);
    expect(upstreamHeaders.get("X-Caller-Capabilities")).toBe(
      "advisory.advisor_cockpit.acknowledge",
    );
    expect(upstreamHeaders.get("X-Authorized-Advisor-Id")).toBe(
      "advisor_sg_001",
    );
  });

  it("rejects browser-selected Advisor Cockpit authority in query and body", async () => {
    const fetchMock = vi.mocked(fetch);
    const queryRequest = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/advisor-cockpit/actions?portfolio_id=PB_SG_GLOBAL_BAL_001&advisor_id=another-advisor&role=DESK_HEAD",
      { method: "GET" },
    );
    const queryResponse = await GET(queryRequest, {
      params: Promise.resolve({
        path: ["api", "v1", "advisor-cockpit", "actions"],
      }),
    });
    const bodyRequest = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/advisor-cockpit/actions/action_1/acknowledgements?portfolio_id=PB_SG_GLOBAL_BAL_001",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action_item_version: 1,
          acknowledged_by: "another-advisor",
        }),
      },
    );
    const bodyResponse = await POST(bodyRequest, {
      params: Promise.resolve({
        path: [
          "api",
          "v1",
          "advisor-cockpit",
          "actions",
          "action_1",
          "acknowledgements",
        ],
      }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(queryResponse.status).toBe(422);
    expect(bodyResponse.status).toBe(422);
    await expect(queryResponse.json()).resolves.toEqual({
      code: "advisor_cockpit_invalid_request",
      status: "rejected",
    });
  });

  it("rejects cross-portfolio Advisor Cockpit access before proxying", async () => {
    const fetchMock = vi.mocked(fetch);
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/advisor-cockpit/snapshot?portfolio_id=PB_NOT_ENTITLED",
      { method: "GET" },
    );

    const response = await GET(request, {
      params: Promise.resolve({
        path: ["api", "v1", "advisor-cockpit", "snapshot"],
      }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: "advisor_cockpit_scope_not_entitled",
      status: "rejected",
    });
  });

  it("rejects unsupported Advisor Cockpit routes at the Workbench boundary", async () => {
    const fetchMock = vi.mocked(fetch);
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/advisor-cockpit/house-view-cohorts/evaluate?portfolio_id=PB_SG_GLOBAL_BAL_001",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: {} }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({
        path: [
          "api",
          "v1",
          "advisor-cockpit",
          "house-view-cohorts",
          "evaluate",
        ],
      }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "advisor_cockpit_route_not_supported",
      status: "rejected",
    });
  });

  it("requires an authenticated Advisor Cockpit principal outside development", async () => {
    process.env.LOTUS_ENVIRONMENT = "uat";
    const fetchMock = vi.mocked(fetch);
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/advisor-cockpit/supportability?portfolio_id=PB_SG_GLOBAL_BAL_001",
      { method: "GET" },
    );

    const response = await GET(request, {
      params: Promise.resolve({
        path: ["api", "v1", "advisor-cockpit", "supportability"],
      }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "advisor_cockpit_authenticated_principal_required",
      status: "rejected",
    });
  });

  it("derives Advisory Copilot review authority at the BFF instead of trusting browser headers", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              run: {
                run_id: "copilot_run_1",
                proposal_id: "proposal_sg_structured_note_001",
                portfolio_id: "PB_SG_GLOBAL_BAL_001",
              },
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response('{"data":{}}', { status: 200 }));
    const body = JSON.stringify({
      body: {
        action: "APPROVE_FOR_INTERNAL_USE",
        reason: {
          decision:
            "Reviewed against source evidence for internal advisor use.",
        },
      },
    });
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/advisory-copilot/actions/copilot_run_1/reviews",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": "idem-copilot-review-1",
          "X-Actor-Id": "spoofed-actor",
          "X-Tenant-Id": "spoofed-tenant",
          "X-Legal-Entity-Code": "spoofed-entity",
          "X-Role": "ADVISOR",
          "X-Caller-Capabilities": "advisory.copilot.admin",
          "X-Capabilities": "advisory.copilot.admin",
          "X-Service-Identity": "browser-spoofed-service",
          "X-Principal-Status": "SUSPENDED",
          "X-Authorized-Proposal-Id": "spoofed-proposal",
          "X-Authorized-Portfolio-Id": "UNENTITLED_PORTFOLIO",
          Authorization: "Bearer browser-asserted-authority",
          Cookie: "lotus_session=browser-asserted-cookie",
        },
        body,
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({
        path: [
          "api",
          "v1",
          "advisory-copilot",
          "actions",
          "copilot_run_1",
          "reviews",
        ],
      }),
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [scopeLookupUrl, scopeLookupInit] = fetchMock.mock.calls[0];
    expect(String(scopeLookupUrl)).toBe(
      "http://gateway.dev.lotus/api/v1/advisory-copilot/actions/copilot_run_1",
    );
    expect(scopeLookupInit).toMatchObject({
      method: "GET",
      cache: "no-store",
    });
    const scopeLookupHeaders = scopeLookupInit?.headers as Headers;
    expect(scopeLookupHeaders.get("X-Actor-Id")).toBe("desk_head_sg_001");
    expect(scopeLookupHeaders.get("X-Caller-Capabilities")).toBe(
      "advisory.copilot.read",
    );
    expect(scopeLookupHeaders.get("X-Authorized-Proposal-Id")).toBeNull();
    expect(scopeLookupHeaders.get("X-Authorized-Portfolio-Id")).toBeNull();

    const [upstreamUrl, upstreamInit] = fetchMock.mock.calls[1];
    expect(String(upstreamUrl)).toBe(
      "http://gateway.dev.lotus/api/v1/advisory-copilot/actions/copilot_run_1/reviews",
    );
    expect(upstreamInit?.body).toBe(body);
    const upstreamHeaders = upstreamInit?.headers as Headers;
    expect(upstreamHeaders.get("X-Actor-Id")).toBe("desk_head_sg_001");
    expect(upstreamHeaders.get("X-Caller-Application")).toBe("lotus-workbench");
    expect(upstreamHeaders.get("X-Tenant-Id")).toBe("tenant-sg-001");
    expect(upstreamHeaders.get("X-Region")).toBe("APAC");
    expect(upstreamHeaders.get("X-Booking-Center-Code")).toBe("SG");
    expect(upstreamHeaders.get("X-Legal-Entity-Code")).toBe("PB_SG");
    expect(upstreamHeaders.get("X-Role")).toBe("ADVISORY_SUPERVISOR");
    expect(upstreamHeaders.get("X-Caller-Capabilities")).toBe(
      "advisory.copilot.review",
    );
    expect(upstreamHeaders.get("X-Principal-Status")).toBe("ACTIVE");
    expect(upstreamHeaders.get("X-Authorized-Proposal-Id")).toBe(
      "proposal_sg_structured_note_001",
    );
    expect(upstreamHeaders.get("X-Authorized-Portfolio-Id")).toBe(
      "PB_SG_GLOBAL_BAL_001",
    );
    expect(upstreamHeaders.get("X-Capabilities")).toBeNull();
    expect(upstreamHeaders.get("X-Service-Identity")).toBeNull();
    expect(upstreamHeaders.get("Authorization")).toBeNull();
    expect(upstreamHeaders.get("Cookie")).toBeNull();
  });

  it("rejects Advisory Copilot review when Gateway run scope is outside server entitlement", async () => {
    process.env.WORKBENCH_ADVISORY_COPILOT_PORTFOLIO_IDS =
      "PB_SG_GLOBAL_BAL_001";
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            run: {
              run_id: "copilot_run_1",
              proposal_id: "proposal_sg_structured_note_001",
              portfolio_id: "UNENTITLED_PORTFOLIO",
            },
          },
        }),
        { status: 200 },
      ),
    );

    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/advisory-copilot/actions/copilot_run_1/reviews",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body: {
            action: "APPROVE_FOR_INTERNAL_USE",
            reason: { decision: "Reviewed against source evidence." },
          },
        }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({
        path: [
          "api",
          "v1",
          "advisory-copilot",
          "actions",
          "copilot_run_1",
          "reviews",
        ],
      }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      code: "advisory_copilot_scope_not_entitled",
      status: "rejected",
    });
  });

  it("rejects Advisory Copilot review when Gateway run scope cannot prove proposal and portfolio", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            run: {
              run_id: "copilot_run_1",
              proposal_id: "proposal_sg_structured_note_001",
            },
          },
        }),
        { status: 200 },
      ),
    );

    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/advisory-copilot/actions/copilot_run_1/reviews",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body: {
            action: "APPROVE_FOR_INTERNAL_USE",
            reason: { decision: "Reviewed against source evidence." },
          },
        }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({
        path: [
          "api",
          "v1",
          "advisory-copilot",
          "actions",
          "copilot_run_1",
          "reviews",
        ],
      }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      code: "advisory_copilot_scope_not_resolved",
      status: "rejected",
    });
  });

  it("rejects browser-selected Advisory Copilot reviewer identity before proxying", async () => {
    const fetchMock = vi.mocked(fetch);
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/advisory-copilot/actions/copilot_run_1/reviews",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": "idem-copilot-review-1",
        },
        body: JSON.stringify({
          body: {
            action: "APPROVE_FOR_INTERNAL_USE",
            actor_id: "browser_selected_reviewer",
          },
        }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({
        path: [
          "api",
          "v1",
          "advisory-copilot",
          "actions",
          "copilot_run_1",
          "reviews",
        ],
      }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      code: "advisory_copilot_invalid_request",
      status: "rejected",
    });
  });

  it("derives report-ordering authority at the BFF instead of trusting browser headers", async () => {
    process.env.WORKBENCH_ADVISOR_BOOK_ACTOR_ID = "RM_CH_007";
    process.env.WORKBENCH_ADVISOR_BOOK_TENANT_ID = "tenant-ch";
    process.env.WORKBENCH_ADVISOR_BOOK_REGION = "EMEA";
    process.env.WORKBENCH_ADVISOR_BOOK_BOOKING_CENTER_CODE = "Zurich";
    process.env.WORKBENCH_ADVISOR_BOOK_ROLE = "RELATIONSHIP_MANAGER";
    process.env.WORKBENCH_REPORTING_CALLER_ROLE = "portfolio_manager";
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));

    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/report-ordering/options?scopeType=portfolio&scopeId=PB_SG_GLOBAL_BAL_001",
      {
        method: "GET",
        headers: {
          "X-Actor-Id": "spoofed-actor",
          "X-Tenant-Id": "spoofed-tenant",
          "X-Region": "spoofed-region",
          "X-Role": "audit",
          "X-Caller-Subject": "spoofed-subject",
          "X-Caller-Roles": "reporting-admin",
          "X-Caller-Capabilities": "reporting.approve,reporting.distribute",
          "X-Caller-Portfolio-Ids": "UNENTITLED_PORTFOLIO",
          Authorization: "Bearer browser-asserted-authority",
          Cookie: "lotus_session=browser-asserted-cookie",
        },
      },
    );

    const response = await GET(request, {
      params: Promise.resolve({
        path: ["api", "v1", "report-ordering", "options"],
      }),
    });

    expect(response.status).toBe(200);
    const upstreamHeaders = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(upstreamHeaders.get("X-Actor-Id")).toBe("RM_CH_007");
    expect(upstreamHeaders.get("X-Tenant-Id")).toBe("tenant-ch");
    expect(upstreamHeaders.get("X-Region")).toBe("EMEA");
    expect(upstreamHeaders.get("X-Booking-Center-Code")).toBe("Zurich");
    expect(upstreamHeaders.get("X-Role")).toBe("portfolio_manager");
    expect(upstreamHeaders.get("X-Caller-Subject")).toBeNull();
    expect(upstreamHeaders.get("X-Caller-Roles")).toBeNull();
    expect(upstreamHeaders.get("X-Caller-Capabilities")).toBe(
      "advisor.book.read",
    );
    expect(upstreamHeaders.get("X-Caller-Portfolio-Ids")).toBe(
      "PB_SG_GLOBAL_BAL_001",
    );
    expect(upstreamHeaders.get("Authorization")).toBeNull();
    expect(upstreamHeaders.get("Cookie")).toBeNull();
  });

  it.each([
    {
      route: "report-ordering/options",
      query:
        "scopeType=portfolio&scopeType=portfolio&scopeId=PB_SG_GLOBAL_BAL_001",
    },
    {
      route: "report-ordering/options",
      query:
        "scopeType=portfolio&scopeType=client&scopeId=PB_SG_GLOBAL_BAL_001",
    },
    {
      route: "report-ordering/options",
      query:
        "scopeType=portfolio&scopeId=PB_SG_GLOBAL_BAL_001&scopeId=UNENTITLED_PORTFOLIO",
    },
    {
      route: "report-ordering/options",
      query:
        "scopeType=portfolio&scopeId=UNENTITLED_PORTFOLIO&scopeId=PB_SG_GLOBAL_BAL_001",
    },
    {
      route: "report-ordering/options",
      query:
        "scopeType=portfolio&scopeId=PB_SG_GLOBAL_BAL_001&asOfDate=2026-04-22&asOfDate=2026-04-22",
    },
    {
      route: "report-ordering/options",
      query:
        "scopeType=portfolio&scopeId=PB_SG_GLOBAL_BAL_001&asOfDate=2026-04-22&asOfDate=2026-04-23",
    },
    {
      route: "report-ordering/options",
      query:
        "scopeType=portfolio&scopeId=PB_SG_GLOBAL_BAL_001&reportingCurrency=SGD&reportingCurrency=USD",
    },
    {
      route: "report-jobs",
      query:
        "portfolioId=PB_SG_GLOBAL_BAL_001&portfolioId=PB_SG_GLOBAL_BAL_001&reportType=portfolio_review",
    },
    {
      route: "report-jobs",
      query:
        "portfolioId=PB_SG_GLOBAL_BAL_001&portfolioId=UNENTITLED_PORTFOLIO&reportType=portfolio_review",
    },
    {
      route: "report-jobs",
      query:
        "portfolioId=UNENTITLED_PORTFOLIO&portfolioId=PB_SG_GLOBAL_BAL_001&reportType=portfolio_review",
    },
    {
      route: "report-jobs",
      query:
        "portfolioId=PB_SG_GLOBAL_BAL_001&reportType=portfolio_review&reportType=portfolio_review",
    },
    {
      route: "report-jobs",
      query:
        "portfolioId=PB_SG_GLOBAL_BAL_001&reportType=portfolio_review&reportType=client_statement",
    },
  ])(
    "rejects ambiguous reporting scope before Gateway fetch: $query",
    async ({ route, query }) => {
      const fetchMock = vi.mocked(fetch);
      const request = new NextRequest(
        `http://localhost:3000/api/bff/api/v1/${route}?${query}`,
        { method: "GET" },
      );

      const response = await GET(request, {
        params: Promise.resolve({ path: ["api", "v1", ...route.split("/")] }),
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({
        code: "reporting_invalid_request",
        status: "rejected",
      });
    },
  );

  it("forwards the exact normalized reporting scope admitted by the BFF", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('{"data":[]}', { status: 200 }));
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/report-jobs?limit=10&portfolioId=%20PB_SG_GLOBAL_BAL_001%20&reportType=%20portfolio_review%20",
      { method: "GET" },
    );

    const response = await GET(request, {
      params: Promise.resolve({ path: ["api", "v1", "report-jobs"] }),
    });

    expect(response.status).toBe(200);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "http://gateway.dev.lotus/api/v1/report-jobs?limit=10&portfolioId=PB_SG_GLOBAL_BAL_001&reportType=portfolio_review",
    );
  });

  it("forwards one normalized Advisor Commentary availability context", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('{"data":[]}', { status: 200 }));
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/report-ordering/options?scopeType=portfolio&scopeId=PB_SG_GLOBAL_BAL_001&asOfDate=%202026-04-22%20&reportingCurrency=%20SGD%20",
      { method: "GET" },
    );

    const response = await GET(request, {
      params: Promise.resolve({
        path: ["api", "v1", "report-ordering", "options"],
      }),
    });

    expect(response.status).toBe(200);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "http://gateway.dev.lotus/api/v1/report-ordering/options?scopeType=portfolio&scopeId=PB_SG_GLOBAL_BAL_001&asOfDate=2026-04-22&reportingCurrency=SGD",
    );
  });

  it("rejects a report-ordering portfolio outside the server-configured entitlement", async () => {
    const fetchMock = vi.mocked(fetch);
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/report-ordering/options?scopeType=portfolio&scopeId=UNENTITLED_PORTFOLIO",
      { method: "GET" },
    );

    const response = await GET(request, {
      params: Promise.resolve({
        path: ["api", "v1", "report-ordering", "options"],
      }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      code: "reporting_scope_not_entitled",
      status: "rejected",
    });
  });

  it("rejects a portfolio-review submission outside the configured entitlement", async () => {
    const fetchMock = vi.mocked(fetch);
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/reports/portfolio-reviews",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          portfolio_scope: { portfolio_ids: ["UNENTITLED_PORTFOLIO"] },
          as_of_date: "2026-04-22",
          requested_output_formats: ["json"],
        }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({
        path: ["api", "v1", "reports", "portfolio-reviews"],
      }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
  });

  it("forwards an entitled portfolio-review submission with its body intact", async () => {
    process.env.WORKBENCH_ADVISOR_BOOK_ACTOR_ID = "RM_CH_007";
    process.env.WORKBENCH_ADVISOR_BOOK_TENANT_ID = "tenant-ch";
    process.env.WORKBENCH_ADVISOR_BOOK_REGION = "EMEA";
    process.env.WORKBENCH_ADVISOR_BOOK_BOOKING_CENTER_CODE = "Zurich";
    process.env.WORKBENCH_ADVISOR_BOOK_ROLE = "RELATIONSHIP_MANAGER";
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response('{"status":"accepted"}', { status: 202 }),
    );
    const body = JSON.stringify({
      portfolio_scope: { portfolio_ids: ["PB_SG_GLOBAL_BAL_001"] },
      as_of_date: "2026-04-22",
      requested_output_formats: ["json"],
    });
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/reports/portfolio-reviews",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Role": "audit",
          "X-Caller-Portfolio-Ids": "UNENTITLED_PORTFOLIO",
        },
        body,
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({
        path: ["api", "v1", "reports", "portfolio-reviews"],
      }),
    });

    expect(response.status).toBe(202);
    const [, upstreamInit] = fetchMock.mock.calls[0];
    const upstreamHeaders = upstreamInit?.headers as Headers;
    expect(upstreamInit?.body).toBe(body);
    expect(upstreamHeaders.get("X-Actor-Id")).toBe("RM_CH_007");
    expect(upstreamHeaders.get("X-Tenant-Id")).toBe("tenant-ch");
    expect(upstreamHeaders.get("X-Region")).toBe("EMEA");
    expect(upstreamHeaders.get("X-Booking-Center-Code")).toBe("Zurich");
    expect(upstreamHeaders.get("X-Role")).toBe("client_advisor");
    expect(upstreamHeaders.get("X-Caller-Capabilities")).toBe(
      "advisor.book.read",
    );
    expect(upstreamHeaders.get("X-Caller-Portfolio-Ids")).toBe(
      "PB_SG_GLOBAL_BAL_001",
    );
  });

  it("derives trusted own-book authority for an explicit report batch", async () => {
    process.env.WORKBENCH_REPORTING_CALLER_PORTFOLIO_IDS =
      "PB_SG_GLOBAL_BAL_001,PB_SG_INCOME_002";
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response('{"status":"materialized"}', { status: 202 }),
    );
    const body = JSON.stringify({
      selector_mode: "explicit_portfolio_list",
      portfolio_ids: ["PB_SG_GLOBAL_BAL_001", "PB_SG_INCOME_002"],
      as_of_date: "2026-04-22",
      requested_output_formats: ["pdf"],
    });
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/report-batches",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Caller-Capabilities": "reporting.admin",
          "X-Caller-Portfolio-Ids": "UNENTITLED_PORTFOLIO",
        },
        body,
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ path: ["api", "v1", "report-batches"] }),
    });

    expect(response.status).toBe(202);
    const [, upstreamInit] = fetchMock.mock.calls[0];
    const upstreamHeaders = upstreamInit?.headers as Headers;
    expect(upstreamInit?.body).toBe(body);
    expect(upstreamHeaders.get("X-Actor-Id")).toBe("PM_SG_001");
    expect(upstreamHeaders.get("X-Tenant-Id")).toBe("tenant-sg");
    expect(upstreamHeaders.get("X-Region")).toBe("APAC");
    expect(upstreamHeaders.get("X-Booking-Center-Code")).toBe("Singapore");
    expect(upstreamHeaders.get("X-Role")).toBe("client_advisor");
    expect(upstreamHeaders.get("X-Caller-Capabilities")).toBe(
      "advisor.book.read",
    );
    expect(upstreamHeaders.get("X-Caller-Portfolio-Ids")).toBe(
      "PB_SG_GLOBAL_BAL_001,PB_SG_INCOME_002",
    );
  });

  it("rejects an out-of-book report batch before Gateway submission", async () => {
    const fetchMock = vi.mocked(fetch);
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/report-batches",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          selector_mode: "explicit_portfolio_list",
          portfolio_ids: ["PB_SG_GLOBAL_BAL_001", "UNENTITLED_PORTFOLIO"],
          as_of_date: "2026-04-22",
        }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ path: ["api", "v1", "report-batches"] }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
  });

  it.each([undefined, "advisor_book"])(
    "rejects report batch selector mode %s before Gateway submission",
    async (selectorMode) => {
      const fetchMock = vi.mocked(fetch);
      const requestBody: Record<string, unknown> = {
        portfolio_ids: ["PB_SG_GLOBAL_BAL_001"],
        as_of_date: "2026-04-22",
      };
      if (selectorMode) {
        requestBody.selector_mode = selectorMode;
      }
      const request = new NextRequest(
        "http://localhost:3000/api/bff/api/v1/report-batches",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(requestBody),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ path: ["api", "v1", "report-batches"] }),
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(response.status).toBe(422);
    },
  );

  it("rejects a one-portfolio batch before Gateway submission", async () => {
    const fetchMock = vi.mocked(fetch);
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/report-batches",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          selector_mode: "explicit_portfolio_list",
          portfolio_ids: ["PB_SG_GLOBAL_BAL_001"],
          as_of_date: "2026-04-22",
        }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ path: ["api", "v1", "report-batches"] }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(422);
  });

  it("forwards source-owned report batch status without browser authority", async () => {
    process.env.WORKBENCH_ADVISOR_BOOK_ACTOR_ID = "RM_CH_007";
    process.env.WORKBENCH_ADVISOR_BOOK_TENANT_ID = "tenant-ch";
    process.env.WORKBENCH_ADVISOR_BOOK_REGION = "EMEA";
    process.env.WORKBENCH_ADVISOR_BOOK_BOOKING_CENTER_CODE = "Zurich";
    process.env.WORKBENCH_ADVISOR_BOOK_ROLE = "RELATIONSHIP_MANAGER";
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response('{"status":"running"}', { status: 200 }),
    );
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/report-batches/rbch_1",
      {
        method: "GET",
        headers: { "X-Role": "reporting_admin", Cookie: "spoofed=true" },
      },
    );

    const response = await GET(request, {
      params: Promise.resolve({
        path: ["api", "v1", "report-batches", "rbch_1"],
      }),
    });

    expect(response.status).toBe(200);
    const upstreamHeaders = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(upstreamHeaders.get("X-Actor-Id")).toBe("RM_CH_007");
    expect(upstreamHeaders.get("X-Tenant-Id")).toBe("tenant-ch");
    expect(upstreamHeaders.get("X-Region")).toBe("EMEA");
    expect(upstreamHeaders.get("X-Booking-Center-Code")).toBe("Zurich");
    expect(upstreamHeaders.get("X-Role")).toBe("client_advisor");
    expect(upstreamHeaders.get("X-Caller-Capabilities")).toBe(
      "advisor.book.read",
    );
    expect(upstreamHeaders.get("Cookie")).toBeNull();
  });

  it("requires an authenticated reporting principal outside development", async () => {
    process.env.LOTUS_ENVIRONMENT = "uat";
    const fetchMock = vi.mocked(fetch);
    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/report-jobs?portfolioId=PB_SG_GLOBAL_BAL_001&reportType=portfolio_review",
      { method: "GET" },
    );

    const response = await GET(request, {
      params: Promise.resolve({ path: ["api", "v1", "report-jobs"] }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "reporting_authenticated_principal_required",
      status: "rejected",
    });
  });

  it("uses configured caller context defaults for upstream analytics reads", async () => {
    process.env.WORKBENCH_BFF_ACTOR_ID = "automation-advisor";
    process.env.WORKBENCH_BFF_CALLER_APPLICATION = "lotus-demo-workbench";
    process.env.WORKBENCH_BFF_TENANT_ID = "tenant-demo";
    process.env.WORKBENCH_BFF_REGION = "EMEA";
    process.env.WORKBENCH_BFF_BOOKING_CENTER_CODE = "CH";
    process.env.WORKBENCH_BFF_ROLE = "relationship-manager";
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));

    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/workbench/PF_1001/performance/summary",
      {
        method: "GET",
      },
    );

    await GET(request, {
      params: Promise.resolve({
        path: ["api", "v1", "workbench", "PF_1001", "performance", "summary"],
      }),
    });

    const upstreamHeaders = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(upstreamHeaders.get("X-Actor-Id")).toBe("automation-advisor");
    expect(upstreamHeaders.get("X-Caller-Application")).toBe(
      "lotus-demo-workbench",
    );
    expect(upstreamHeaders.get("X-Tenant-Id")).toBe("tenant-demo");
    expect(upstreamHeaders.get("X-Region")).toBe("EMEA");
    expect(upstreamHeaders.get("X-Booking-Center-Code")).toBe("CH");
    expect(upstreamHeaders.get("X-Role")).toBe("relationship-manager");
  });

  it("preserves valid context and replaces malformed traceparent before proxying", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));

    const request = new NextRequest(
      "http://localhost:3000/api/bff/api/v1/workbench/PF_1001/risk/summary",
      {
        method: "GET",
        headers: {
          "X-Correlation-Id": "corr-workbench-route-1",
          traceparent: "malformed",
        },
      },
    );

    await GET(request, {
      params: Promise.resolve({
        path: ["api", "v1", "workbench", "PF_1001", "risk", "summary"],
      }),
    });

    const upstreamInit = fetchMock.mock.calls[0][1];
    const upstreamHeaders = upstreamInit?.headers as Headers;
    expect(upstreamHeaders.get("X-Correlation-Id")).toBe(
      "corr-workbench-route-1",
    );
    expect(upstreamHeaders.get("traceparent")).not.toBe("malformed");
    expect(upstreamHeaders.get("traceparent")).toMatch(
      /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/,
    );
  });
});
