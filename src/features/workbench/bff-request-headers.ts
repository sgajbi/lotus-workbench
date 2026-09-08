import { prepareAnalyticsUiProxyHeaders } from "@/features/analytics-observability/correlation";
import { isDevelopmentAuthorityEnvironment } from "./authority-mode";
import {
  applyDefaultCallerContextHeaders,
  stripBrowserSuppliedAuthorityHeaders,
} from "./caller-context";

/**
 * Browser request headers that the Workbench BFF deliberately carries to Gateway.
 *
 * Caller identity, entitlements, session material, forwarding aliases, hop-by-hop
 * headers, and browser navigation metadata are intentionally absent. Additions
 * require contract evidence and regression coverage at this trust boundary.
 */
export const FORWARDABLE_BROWSER_GATEWAY_REQUEST_HEADERS = [
  "Accept",
  "Accept-Language",
  "Content-Type",
  "Idempotency-Key",
  "X-Idempotency-Key",
  "If-Match",
  "If-None-Match",
  "If-Modified-Since",
  "If-Unmodified-Since",
  "Range",
  "If-Range",
  "X-Correlation-Id",
  "X-Trace-Id",
  "traceparent",
] as const;

/**
 * Reads the one browser credential that terminates at the Workbench BFF.
 * Keeping this access beside the forwarding allowlist makes the trust boundary
 * explicit: the credential is verified and replaced, never copied upstream.
 */
export function readWorkbenchSessionAuthorization(
  request: Pick<Request, "headers">,
): string | null {
  return request.headers.get("authorization");
}

export function buildGatewayBffRequestHeaders(
  browserHeaders: Headers,
): Headers {
  const gatewayHeaders = new Headers();

  for (const headerName of FORWARDABLE_BROWSER_GATEWAY_REQUEST_HEADERS) {
    const value = browserHeaders.get(headerName);
    if (value !== null) {
      gatewayHeaders.set(headerName, value);
    }
  }

  // Defence in depth: a future allowlist edit cannot silently promote an
  // authority header into the browser-controlled request surface.
  stripBrowserSuppliedAuthorityHeaders(gatewayHeaders);
  if (isDevelopmentAuthorityEnvironment()) {
    applyDefaultCallerContextHeaders(gatewayHeaders);
  }

  // Node Fetch decodes supported content codings before exposing response
  // bytes. Request identity so range offsets and representation metadata stay
  // aligned across the Gateway/BFF boundary.
  gatewayHeaders.set("Accept-Encoding", "identity");

  return prepareAnalyticsUiProxyHeaders(gatewayHeaders);
}
