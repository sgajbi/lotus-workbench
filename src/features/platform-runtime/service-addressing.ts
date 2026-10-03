const BFF_PROXY_BASE_URL = "/api/bff";
const API_VERSION_PREFIX = "/api/v1";
const DEFAULT_LOTUS_ENVIRONMENT = "dev";
const DISALLOWED_LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
const OWNED_E2E_FIXTURE_GATEWAYS = [
  {
    mode: "playwright-smoke",
    portEnvironmentVariable: "PLAYWRIGHT_E2E_FIXTURE_PORT",
    scenarioEnvironmentVariable: "PLAYWRIGHT_E2E_FIXTURE",
    scenarios: new Set(["source-context"]),
  },
  {
    mode: "performance",
    portEnvironmentVariable: "PERFORMANCE_E2E_FIXTURE_PORT",
    scenarioEnvironmentVariable: "PERFORMANCE_E2E_FIXTURE",
    scenarios: new Set([
      "populated",
      "unavailable",
      "refresh-integrity",
      "trend-integrity",
      "horizon-integrity",
      "analysis-controls",
      "unknown-period",
    ]),
  },
  {
    mode: "report-centre",
    portEnvironmentVariable: "REPORT_CENTRE_E2E_FIXTURE_PORT",
    scenarioEnvironmentVariable: "REPORT_CENTRE_E2E_FIXTURE",
    scenarios: new Set(["state-matrix"]),
  },
  {
    mode: "portfolio",
    portEnvironmentVariable: "PORTFOLIO_E2E_FIXTURE_PORT",
    scenarioEnvironmentVariable: "PORTFOLIO_E2E_FIXTURE",
    scenarios: new Set([
      "cashflow",
      "allocation-recovery",
      "allocation-qualified",
      "income-activity",
      "review-context-states",
      "shell-unavailable",
      "positions-status",
        "transactions-status",
        "transaction-navigation",
    ]),
  },
  {
    mode: "pm-quality",
    portEnvironmentVariable: "PM_QUALITY_E2E_FIXTURE_PORT",
    scenarioEnvironmentVariable: "PM_QUALITY_E2E_FIXTURE",
    scenarios: new Set(["record-selection"]),
  },
  {
    mode: "manage",
    portEnvironmentVariable: "MANAGE_E2E_FIXTURE_PORT",
    scenarioEnvironmentVariable: "MANAGE_E2E_FIXTURE",
    scenarios: new Set([
      "overview",
      "mandate-health",
      "mode-loading",
      "pm-quality",
      "outcome-reviews",
      "portfolio-memory",
      "proof-copilot",
      "rebalance-waves",
    ]),
  },
] as const;

export type ServiceRequestTarget = "server" | "client";
export type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function isOwnedE2eFixtureGateway(
  parsed: URL,
  environment: RuntimeEnvironment,
): boolean {
  const configuredMode = environment.WORKBENCH_E2E_FIXTURE_GATEWAY?.trim();
  const fixture = OWNED_E2E_FIXTURE_GATEWAYS.find(
    (candidate) => candidate.mode === configuredMode,
  );
  if (!fixture) {
    return false;
  }

  const fixturePort = environment[fixture.portEnvironmentVariable]?.trim();
  const fixtureScenario =
    environment[fixture.scenarioEnvironmentVariable]?.trim() ?? "";
  return (
    fixture.scenarios.has(fixtureScenario) &&
    parsed.protocol === "http:" &&
    parsed.hostname === "127.0.0.1" &&
    Boolean(fixturePort) &&
    parsed.port === fixturePort
  );
}

function assertCanonicalGatewayBaseUrl(
  value: string,
  environment: RuntimeEnvironment,
): string {
  const normalized = normalizeBaseUrl(value);
  const parsed = new URL(normalized);
  const hostname = parsed.hostname.trim().toLowerCase();

  if (
    DISALLOWED_LOCAL_HOSTS.has(hostname) &&
    !isOwnedE2eFixtureGateway(parsed, environment)
  ) {
    throw new Error(
      `BFF_BASE_URL must use a canonical Lotus hostname, not local loopback (${hostname}).`,
    );
  }

  return normalized;
}

export function resolveLotusEnvironment(
  environment: RuntimeEnvironment = process.env,
): string {
  const configured = environment.LOTUS_ENVIRONMENT?.trim().toLowerCase();
  return configured && configured.length > 0
    ? configured
    : DEFAULT_LOTUS_ENVIRONMENT;
}

export function resolveGatewayBaseUrl(
  environment: RuntimeEnvironment = process.env,
): string {
  const configured = environment.BFF_BASE_URL?.trim();
  if (configured && configured.length > 0) {
    return assertCanonicalGatewayBaseUrl(configured, environment);
  }

  const lotusEnvironment = resolveLotusEnvironment(environment);
  const protocol = lotusEnvironment === "dev" ? "http" : "https";
  const host =
    lotusEnvironment === "prod" || lotusEnvironment === "production"
      ? "gateway.lotus"
      : `gateway.${lotusEnvironment}.lotus`;
  return assertCanonicalGatewayBaseUrl(`${protocol}://${host}`, environment);
}

export function resolveBffProxyBaseUrl(): string {
  return BFF_PROXY_BASE_URL;
}

export function resolveWorkbenchApiBase(target: ServiceRequestTarget): string {
  if (target === "client") {
    return `${BFF_PROXY_BASE_URL}${API_VERSION_PREFIX}`;
  }
  return `${resolveGatewayBaseUrl()}${API_VERSION_PREFIX}`;
}
