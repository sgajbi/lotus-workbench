import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildGatewayBffRequestHeaders,
  FORWARDABLE_BROWSER_GATEWAY_REQUEST_HEADERS,
  readWorkbenchSessionAuthorization,
} from "@/features/workbench/bff-request-headers";
import { FORBIDDEN_BROWSER_AUTHORITY_HEADERS } from "@/features/workbench/caller-context";

const validTraceparent =
  "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01";

describe("Gateway BFF request-header boundary", () => {
  const originalEnvironment = process.env.LOTUS_ENVIRONMENT;

  beforeEach(() => {
    process.env.LOTUS_ENVIRONMENT = "test";
  });

  afterEach(() => {
    if (originalEnvironment === undefined) {
      delete process.env.LOTUS_ENVIRONMENT;
    } else {
      process.env.LOTUS_ENVIRONMENT = originalEnvironment;
    }
  });

  it("terminates the browser session credential without forwarding it", () => {
    const request = new Request("https://workbench.test/api/bff/portfolio", {
      headers: { Authorization: "Bearer signed-session" },
    });

    expect(readWorkbenchSessionAuthorization(request)).toBe("Bearer signed-session");
    expect(buildGatewayBffRequestHeaders(request.headers).get("Authorization")).toBeNull();
  });

  it("forwards only the governed browser header allowlist", () => {
    const browserHeaders = new Headers({
      Accept: "application/json, application/pdf",
      "Accept-Encoding": "gzip, br",
      "Accept-Language": "en-SG,en;q=0.9",
      "Content-Type": "application/json",
      "Idempotency-Key": "proposal-submit-1",
      "X-Idempotency-Key": "intake-submit-1",
      "If-Match": '"version-2"',
      "If-None-Match": '"version-1"',
      "If-Modified-Since": "Sun, 23 Aug 2026 00:00:00 GMT",
      "If-Unmodified-Since": "Sun, 23 Aug 2026 00:00:00 GMT",
      Range: "bytes=0-1023",
      "If-Range": '"archive-version-3"',
      "X-Correlation-Id": "corr-workbench-document-download-1",
      "X-Trace-Id": "0123456789abcdef0123456789abcdef",
      traceparent: validTraceparent,
      Origin: "https://attacker.example",
      Referer: "https://attacker.example/portfolio",
      "User-Agent": "attacker-controlled-agent",
    });

    const gatewayHeaders = buildGatewayBffRequestHeaders(browserHeaders);

    for (const headerName of FORWARDABLE_BROWSER_GATEWAY_REQUEST_HEADERS) {
      expect(gatewayHeaders.get(headerName), headerName).toBe(
        browserHeaders.get(headerName),
      );
    }
    expect(gatewayHeaders.get("Accept-Encoding")).toBe("identity");
    expect(gatewayHeaders.get("Origin")).toBeNull();
    expect(gatewayHeaders.get("Referer")).toBeNull();
    expect(gatewayHeaders.get("User-Agent")).toBeNull();
  });

  it("replaces browser authority with server-derived defaults", () => {
    const browserHeaders = new Headers();
    for (const headerName of FORBIDDEN_BROWSER_AUTHORITY_HEADERS) {
      browserHeaders.set(headerName, "browser-supplied-authority");
    }

    const gatewayHeaders = buildGatewayBffRequestHeaders(browserHeaders);

    expect(gatewayHeaders.get("X-Actor-Id")).toBe("workbench-system");
    expect(gatewayHeaders.get("X-Caller-Application")).toBe("lotus-workbench");
    expect(gatewayHeaders.get("X-Tenant-Id")).toBe("tenant-sg");
    expect(gatewayHeaders.get("X-Region")).toBe("APAC");
    expect(gatewayHeaders.get("X-Booking-Center-Code")).toBe("SG");
    expect(gatewayHeaders.get("X-Role")).toBe("advisor");

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
      expect(gatewayHeaders.get(headerName), headerName).toBeNull();
    }
  });

  it.each([undefined, "uat", "production"])(
    "does not replace stripped browser authority in %s posture",
    (environment) => {
      if (environment === undefined) {
        delete process.env.LOTUS_ENVIRONMENT;
      } else {
        process.env.LOTUS_ENVIRONMENT = environment;
      }
      const browserHeaders = new Headers();
      for (const headerName of FORBIDDEN_BROWSER_AUTHORITY_HEADERS) {
        browserHeaders.set(headerName, "browser-supplied-authority");
      }

      const gatewayHeaders = buildGatewayBffRequestHeaders(browserHeaders);

      for (const headerName of FORBIDDEN_BROWSER_AUTHORITY_HEADERS) {
        expect(gatewayHeaders.get(headerName), headerName).toBeNull();
      }
    },
  );
});
