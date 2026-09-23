import { createGatewayRequestSignal } from "@/features/platform-runtime/gateway-request-policy";

export async function fetchGatewayAuthorityScope(
  gatewayBaseUrl: string,
  path: string,
  headers: Headers,
): Promise<unknown | null> {
  try {
    const response = await fetch(`${gatewayBaseUrl}${path}`, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: createGatewayRequestSignal(),
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}
