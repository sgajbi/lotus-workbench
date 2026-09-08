import { buildAnalyticsUiCorrelationHeaders } from "@/features/analytics-observability/correlation";
import {
  WORKBENCH_ANALYTICS_UI_OBSERVED_SURFACES,
  observeWorkbenchAnalyticsRequest,
  type WorkbenchAnalyticsUiObservationContext,
  type WorkbenchAnalyticsUiObservationOptions,
} from "@/features/analytics-observability/metrics";
import {
  resolveBffProxyBaseUrl,
  resolveWorkbenchApiBase,
  type ServiceRequestTarget,
} from "@/features/platform-runtime/service-addressing";
import { requiresAuthenticatedSessionPrincipal } from "./authority-mode";
import {
  captureActiveAuthorityContext,
  reconcileResponseAuthorityContext,
} from "./client-authority-context";
import { applyDefaultCallerContextHeaders } from "./caller-context";

export const BFF_PROXY_BASE = `${resolveBffProxyBaseUrl()}/api/v1`;

export type WorkbenchRequestTarget = ServiceRequestTarget;

export type WorkbenchObservedOperation =
  (typeof WORKBENCH_ANALYTICS_UI_OBSERVED_SURFACES)[number]["operation"];

export class WorkbenchApiError extends Error {
  readonly status: number;
  readonly requestReference: string | null;

  constructor(errorLabel: string, status: number, requestReference?: string | null) {
    super(`Failed to fetch ${errorLabel} (${status})`);
    this.name = "WorkbenchApiError";
    this.status = status;
    this.requestReference = normalizeRequestReference(requestReference);
  }
}

export type WorkbenchApiErrorEvidence = Readonly<{
  label: "HTTP status";
  value: string;
  requestReference?: string;
}>;

export function getWorkbenchApiErrorStatus(error: unknown): number | null {
  return error instanceof WorkbenchApiError ? error.status : null;
}

export function getWorkbenchApiErrorEvidence(
  error: unknown
): WorkbenchApiErrorEvidence | null {
  const status = getWorkbenchApiErrorStatus(error);
  if (status === null) {
    return null;
  }
  const requestReference =
    error instanceof WorkbenchApiError ? error.requestReference : null;
  return requestReference
    ? { label: "HTTP status", value: String(status), requestReference }
    : { label: "HTTP status", value: String(status) };
}

function normalizeRequestReference(value?: string | null): string | null {
  const normalized = value?.trim() ?? "";
  return /^[A-Za-z0-9._:-]{1,128}$/.test(normalized) ? normalized : null;
}

function responseRequestReference(response: Response): string | null {
  const headers = response.headers;
  if (!headers || typeof headers.get !== "function") {
    return null;
  }
  return normalizeRequestReference(headers.get("X-Correlation-Id"));
}

export function isWorkbenchPermissionBlockedError(error: unknown): boolean {
  const status = getWorkbenchApiErrorStatus(error);
  return status === 401 || status === 403;
}

export async function fetchWorkbenchJson<T>(
  url: string,
  errorLabel: string,
  init?: RequestInit
): Promise<T> {
  const authorityAtDispatch = captureActiveAuthorityContext();
  const response = await fetch(url, { cache: "no-store", ...init });
  reconcileResponseAuthorityContext(response, authorityAtDispatch);
  if (!response.ok) {
    throw new WorkbenchApiError(
      errorLabel,
      response.status,
      responseRequestReference(response)
    );
  }
  return (await response.json()) as T;
}

export async function fetchWorkbenchMutation<T>(
  url: string,
  errorLabel: string,
  init: RequestInit
): Promise<T> {
  const authorityAtDispatch = captureActiveAuthorityContext();
  const response = await fetch(url, { cache: "no-store", ...withJsonMutationHeaders(init) });
  reconcileResponseAuthorityContext(response, authorityAtDispatch);
  if (!response.ok) {
    throw new WorkbenchApiError(
      errorLabel,
      response.status,
      responseRequestReference(response)
    );
  }
  return (await response.json()) as T;
}

function withJsonMutationHeaders(init: RequestInit): RequestInit {
  if (typeof init.body !== "string") {
    return init;
  }

  const headers = init.headers;
  if (headers instanceof Headers) {
    const nextHeaders = new Headers(headers);
    if (!nextHeaders.has("Content-Type")) {
      nextHeaders.set("Content-Type", "application/json");
    }
    return { ...init, headers: nextHeaders };
  }

  if (Array.isArray(headers)) {
    const hasContentType = headers.some(([key]) => key.toLowerCase() === "content-type");
    return {
      ...init,
      headers: hasContentType ? headers : [["Content-Type", "application/json"], ...headers],
    };
  }

  const nextHeaders: Record<string, string> = { ...(headers as Record<string, string> | undefined) };
  const hasContentType = Object.keys(nextHeaders).some((key) => key.toLowerCase() === "content-type");
  if (!hasContentType) {
    nextHeaders["Content-Type"] = "application/json";
  }
  return { ...init, headers: nextHeaders };
}

function observedSurface(
  operation: WorkbenchObservedOperation
): WorkbenchAnalyticsUiObservationContext {
  return WORKBENCH_ANALYTICS_UI_OBSERVED_SURFACES.find(
    (surface) => surface.operation === operation
  )!;
}

export async function observeWorkbenchResource<T>(
  operation: WorkbenchObservedOperation,
  request: () => Promise<T>,
  options?: WorkbenchAnalyticsUiObservationOptions
): Promise<T> {
  return await observeWorkbenchAnalyticsRequest(
    observedSurface(operation),
    request,
    options
  );
}

export async function observeWorkbenchMutation<T>(
  operation: WorkbenchObservedOperation,
  request: () => Promise<T>
): Promise<T> {
  return await observeWorkbenchResource(operation, request, {
    recordPanelHydration: false,
  });
}

export function buildWorkbenchUrl(
  target: WorkbenchRequestTarget,
  path: string,
  query?: URLSearchParams | string
): string {
  const baseUrl = resolveWorkbenchApiBase(target);
  const suffix =
    query instanceof URLSearchParams ? query.toString() : query;
  return suffix ? `${baseUrl}${path}?${suffix}` : `${baseUrl}${path}`;
}

/**
 * Builds server-to-Gateway headers. `initialHeaders` may contribute request
 * metadata such as correlation context, but caller authority is always
 * replaced by the server-owned Workbench context below.
 */
export function buildServerGatewayHeaders(initialHeaders?: HeadersInit): Headers {
  if (requiresAuthenticatedSessionPrincipal()) {
    throw new WorkbenchApiError("authenticated Workbench principal", 401);
  }
  const headers = buildAnalyticsUiCorrelationHeaders(initialHeaders);
  applyDefaultCallerContextHeaders(headers);
  return headers;
}

export async function fetchWorkbenchResource<T>(
  target: WorkbenchRequestTarget,
  path: string,
  errorLabel: string,
  query?: URLSearchParams | string
): Promise<T> {
  return await fetchWorkbenchJson<T>(
    buildWorkbenchUrl(target, path, query),
    errorLabel,
    target === "client"
      ? { headers: buildAnalyticsUiCorrelationHeaders() }
      : { headers: buildServerGatewayHeaders() }
  );
}
