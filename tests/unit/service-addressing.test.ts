import { afterEach, describe, expect, it } from "vitest";

import {
  resolveBffProxyBaseUrl,
  resolveGatewayBaseUrl,
  resolveWorkbenchApiBase,
} from "@/features/platform-runtime/service-addressing";

describe("service addressing", () => {
  const originalBffBaseUrl = process.env.BFF_BASE_URL;
  const originalEnvironment = process.env.LOTUS_ENVIRONMENT;
  const originalFixtureGateway = process.env.WORKBENCH_E2E_FIXTURE_GATEWAY;
  const originalFixtureScenario = process.env.PERFORMANCE_E2E_FIXTURE;
  const originalFixturePort = process.env.PERFORMANCE_E2E_FIXTURE_PORT;
  const originalReportCentreFixtureScenario =
    process.env.REPORT_CENTRE_E2E_FIXTURE;
  const originalReportCentreFixturePort =
    process.env.REPORT_CENTRE_E2E_FIXTURE_PORT;
  const originalPortfolioFixtureScenario = process.env.PORTFOLIO_E2E_FIXTURE;
  const originalPortfolioFixturePort = process.env.PORTFOLIO_E2E_FIXTURE_PORT;
  const originalPmQualityFixtureScenario = process.env.PM_QUALITY_E2E_FIXTURE;
  const originalPmQualityFixturePort = process.env.PM_QUALITY_E2E_FIXTURE_PORT;
  const originalManageFixtureScenario = process.env.MANAGE_E2E_FIXTURE;
  const originalManageFixturePort = process.env.MANAGE_E2E_FIXTURE_PORT;
  const originalPlaywrightFixtureScenario = process.env.PLAYWRIGHT_E2E_FIXTURE;
  const originalPlaywrightFixturePort = process.env.PLAYWRIGHT_E2E_FIXTURE_PORT;

  afterEach(() => {
    process.env.BFF_BASE_URL = originalBffBaseUrl;
    process.env.LOTUS_ENVIRONMENT = originalEnvironment;
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = originalFixtureGateway;
    process.env.PERFORMANCE_E2E_FIXTURE = originalFixtureScenario;
    process.env.PERFORMANCE_E2E_FIXTURE_PORT = originalFixturePort;
    process.env.REPORT_CENTRE_E2E_FIXTURE = originalReportCentreFixtureScenario;
    process.env.REPORT_CENTRE_E2E_FIXTURE_PORT =
      originalReportCentreFixturePort;
    process.env.PORTFOLIO_E2E_FIXTURE = originalPortfolioFixtureScenario;
    process.env.PORTFOLIO_E2E_FIXTURE_PORT = originalPortfolioFixturePort;
    process.env.PM_QUALITY_E2E_FIXTURE = originalPmQualityFixtureScenario;
    process.env.PM_QUALITY_E2E_FIXTURE_PORT = originalPmQualityFixturePort;
    process.env.MANAGE_E2E_FIXTURE = originalManageFixtureScenario;
    process.env.MANAGE_E2E_FIXTURE_PORT = originalManageFixturePort;
    process.env.PLAYWRIGHT_E2E_FIXTURE = originalPlaywrightFixtureScenario;
    process.env.PLAYWRIGHT_E2E_FIXTURE_PORT = originalPlaywrightFixturePort;
  });

  it("uses the explicit BFF base URL when configured", () => {
    process.env.BFF_BASE_URL = "https://gateway.custom.example/";
    process.env.LOTUS_ENVIRONMENT = "uat";

    expect(resolveGatewayBaseUrl()).toBe("https://gateway.custom.example");
    expect(resolveWorkbenchApiBase("server")).toBe(
      "https://gateway.custom.example/api/v1",
    );
  });

  it("defaults server-side gateway resolution to the canonical dev hostname", () => {
    delete process.env.BFF_BASE_URL;
    delete process.env.LOTUS_ENVIRONMENT;

    expect(resolveGatewayBaseUrl()).toBe("http://gateway.dev.lotus");
    expect(resolveWorkbenchApiBase("server")).toBe(
      "http://gateway.dev.lotus/api/v1",
    );
  });

  it("switches to environment-scoped hostnames for non-dev environments", () => {
    delete process.env.BFF_BASE_URL;
    process.env.LOTUS_ENVIRONMENT = "uat";

    expect(resolveGatewayBaseUrl()).toBe("https://gateway.uat.lotus");
  });

  it("rejects local loopback BFF overrides", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:8000/";

    expect(() => resolveGatewayBaseUrl()).toThrow(
      "BFF_BASE_URL must use a canonical Lotus hostname, not local loopback",
    );
  });

  it("allows only the exact process-owned Playwright source fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18160/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "playwright-smoke";
    process.env.PLAYWRIGHT_E2E_FIXTURE = "source-context";
    process.env.PLAYWRIGHT_E2E_FIXTURE_PORT = "18160";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18160");
  });

  it("rejects a Playwright source fixture whose scenario is not governed", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18160/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "playwright-smoke";
    process.env.PLAYWRIGHT_E2E_FIXTURE = "proposal-success";
    process.env.PLAYWRIGHT_E2E_FIXTURE_PORT = "18160";

    expect(() => resolveGatewayBaseUrl()).toThrow(
      "BFF_BASE_URL must use a canonical Lotus hostname, not local loopback",
    );
  });

  it("allows only the exact process-owned Performance fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18100/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "performance";
    process.env.PERFORMANCE_E2E_FIXTURE = "populated";
    process.env.PERFORMANCE_E2E_FIXTURE_PORT = "18100";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18100");
  });

  it("allows the exact process-owned Performance refresh-integrity fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18100/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "performance";
    process.env.PERFORMANCE_E2E_FIXTURE = "refresh-integrity";
    process.env.PERFORMANCE_E2E_FIXTURE_PORT = "18100";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18100");
  });

  it("allows the exact process-owned Performance trend-integrity fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18100/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "performance";
    process.env.PERFORMANCE_E2E_FIXTURE = "trend-integrity";
    process.env.PERFORMANCE_E2E_FIXTURE_PORT = "18100";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18100");
  });

  it("allows the exact process-owned Performance horizon-integrity fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18100/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "performance";
    process.env.PERFORMANCE_E2E_FIXTURE = "horizon-integrity";
    process.env.PERFORMANCE_E2E_FIXTURE_PORT = "18100";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18100");
  });

  it("allows the exact process-owned Performance analysis-controls fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18100/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "performance";
    process.env.PERFORMANCE_E2E_FIXTURE = "analysis-controls";
    process.env.PERFORMANCE_E2E_FIXTURE_PORT = "18100";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18100");
  });

  it("allows the exact process-owned Performance unknown-period fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18100/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "performance";
    process.env.PERFORMANCE_E2E_FIXTURE = "unknown-period";
    process.env.PERFORMANCE_E2E_FIXTURE_PORT = "18100";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18100");
  });

  it("allows only the exact process-owned Report Centre fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18101/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "report-centre";
    process.env.REPORT_CENTRE_E2E_FIXTURE = "state-matrix";
    process.env.REPORT_CENTRE_E2E_FIXTURE_PORT = "18101";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18101");
  });

  it("allows only the exact process-owned Portfolio cashflow fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18120/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "portfolio";
    process.env.PORTFOLIO_E2E_FIXTURE = "cashflow";
    process.env.PORTFOLIO_E2E_FIXTURE_PORT = "18120";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18120");
  });

  it.each(["allocation-recovery", "allocation-qualified"])("allows only the exact process-owned Portfolio %s fixture loopback", (scenario) => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18120/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "portfolio";
    process.env.PORTFOLIO_E2E_FIXTURE = scenario;
    process.env.PORTFOLIO_E2E_FIXTURE_PORT = "18120";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18120");
  });

  it.each([
    ["http://127.0.0.1:18121", "portfolio", "allocation-qualified"],
    ["http://127.0.0.1:18120", "", "allocation-qualified"],
    ["http://127.0.0.1:18120", "portfolio", "allocation-qualified-unknown"],
  ])("refuses qualified-allocation fixture admission outside the exact owned tuple", (url, owner, scenario) => {
    process.env.BFF_BASE_URL = url;
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = owner;
    process.env.PORTFOLIO_E2E_FIXTURE = scenario;
    process.env.PORTFOLIO_E2E_FIXTURE_PORT = "18120";
    expect(() => resolveGatewayBaseUrl()).toThrow("must use a canonical Lotus hostname");
  });

  it("allows only the exact process-owned Portfolio income-activity fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18120/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "portfolio";
    process.env.PORTFOLIO_E2E_FIXTURE = "income-activity";
    process.env.PORTFOLIO_E2E_FIXTURE_PORT = "18120";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18120");
  });

  it("allows only the exact process-owned Portfolio review-context state fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18120/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "portfolio";
    process.env.PORTFOLIO_E2E_FIXTURE = "review-context-states";
    process.env.PORTFOLIO_E2E_FIXTURE_PORT = "18120";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18120");
  });

  it("allows only the exact process-owned Portfolio shell-unavailable fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18120/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "portfolio";
    process.env.PORTFOLIO_E2E_FIXTURE = "shell-unavailable";
    process.env.PORTFOLIO_E2E_FIXTURE_PORT = "18120";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18120");
  });

  it("allows only the exact process-owned Portfolio positions-status fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18120/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "portfolio";
    process.env.PORTFOLIO_E2E_FIXTURE = "positions-status";
    process.env.PORTFOLIO_E2E_FIXTURE_PORT = "18120";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18120");
  });

  it("allows only the exact process-owned Portfolio transactions-status fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18120/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "portfolio";
    process.env.PORTFOLIO_E2E_FIXTURE = "transactions-status";
    process.env.PORTFOLIO_E2E_FIXTURE_PORT = "18120";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18120");
  });

  it("allows only the exact process-owned Portfolio transaction-navigation fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18120/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "portfolio";
    process.env.PORTFOLIO_E2E_FIXTURE = "transaction-navigation";
    process.env.PORTFOLIO_E2E_FIXTURE_PORT = "18120";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18120");
  });

  it("allows only the exact process-owned PM quality record-selection fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18140/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "pm-quality";
    process.env.PM_QUALITY_E2E_FIXTURE = "record-selection";
    process.env.PM_QUALITY_E2E_FIXTURE_PORT = "18140";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18140");
  });

  it("allows only the exact process-owned Manage rebalance-waves fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18150/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "manage";
    process.env.MANAGE_E2E_FIXTURE = "rebalance-waves";
    process.env.MANAGE_E2E_FIXTURE_PORT = "18150";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18150");
  });

  it("allows only the exact process-owned Manage mandate-health fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18150/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "manage";
    process.env.MANAGE_E2E_FIXTURE = "mandate-health";
    process.env.MANAGE_E2E_FIXTURE_PORT = "18150";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18150");
  });

  it("allows only the exact process-owned Manage PM quality fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18150/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "manage";
    process.env.MANAGE_E2E_FIXTURE = "pm-quality";
    process.env.MANAGE_E2E_FIXTURE_PORT = "18150";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18150");
  });

  it("allows only the exact process-owned Manage mode-loading fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18150/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "manage";
    process.env.MANAGE_E2E_FIXTURE = "mode-loading";
    process.env.MANAGE_E2E_FIXTURE_PORT = "18150";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18150");
  });

  it("allows only the exact process-owned Manage overview fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18150/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "manage";
    process.env.MANAGE_E2E_FIXTURE = "overview";
    process.env.MANAGE_E2E_FIXTURE_PORT = "18150";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18150");
  });

  it("allows only the exact process-owned Manage Portfolio Memory fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18150/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "manage";
    process.env.MANAGE_E2E_FIXTURE = "portfolio-memory";
    process.env.MANAGE_E2E_FIXTURE_PORT = "18150";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18150");
  });

  it("allows only the exact process-owned Manage outcome-reviews fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18179/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "manage";
    process.env.MANAGE_E2E_FIXTURE = "outcome-reviews";
    process.env.MANAGE_E2E_FIXTURE_PORT = "18179";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18179");
  });

  it("allows only the exact process-owned Manage proof-copilot fixture loopback", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18179/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "manage";
    process.env.MANAGE_E2E_FIXTURE = "proof-copilot";
    process.env.MANAGE_E2E_FIXTURE_PORT = "18179";

    expect(resolveGatewayBaseUrl()).toBe("http://127.0.0.1:18179");
  });

  it("rejects a Manage fixture URL whose scenario is not governed", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18150/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "manage";
    process.env.MANAGE_E2E_FIXTURE = "ungoverned-overview";
    process.env.MANAGE_E2E_FIXTURE_PORT = "18150";

    expect(() => resolveGatewayBaseUrl()).toThrow(
      "BFF_BASE_URL must use a canonical Lotus hostname, not local loopback",
    );
  });

  it("rejects a PM quality fixture URL whose scenario is not governed", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18140/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "pm-quality";
    process.env.PM_QUALITY_E2E_FIXTURE = "summary-generation";
    process.env.PM_QUALITY_E2E_FIXTURE_PORT = "18140";

    expect(() => resolveGatewayBaseUrl()).toThrow(
      "BFF_BASE_URL must use a canonical Lotus hostname, not local loopback",
    );
  });

  it("rejects a Portfolio fixture URL whose scenario is not governed", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18120/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "portfolio";
    process.env.PORTFOLIO_E2E_FIXTURE = "overview";
    process.env.PORTFOLIO_E2E_FIXTURE_PORT = "18120";

    expect(() => resolveGatewayBaseUrl()).toThrow(
      "BFF_BASE_URL must use a canonical Lotus hostname, not local loopback",
    );
  });

  it("rejects a Report Centre fixture URL whose port is not owned by the scenario", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18102/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "report-centre";
    process.env.REPORT_CENTRE_E2E_FIXTURE = "state-matrix";
    process.env.REPORT_CENTRE_E2E_FIXTURE_PORT = "18101";

    expect(() => resolveGatewayBaseUrl()).toThrow(
      "BFF_BASE_URL must use a canonical Lotus hostname, not local loopback",
    );
  });

  it("rejects a loopback fixture URL whose port is not owned by the scenario", () => {
    process.env.BFF_BASE_URL = "http://127.0.0.1:18101/";
    process.env.WORKBENCH_E2E_FIXTURE_GATEWAY = "performance";
    process.env.PERFORMANCE_E2E_FIXTURE = "unavailable";
    process.env.PERFORMANCE_E2E_FIXTURE_PORT = "18100";

    expect(() => resolveGatewayBaseUrl()).toThrow(
      "BFF_BASE_URL must use a canonical Lotus hostname, not local loopback",
    );
  });

  it("uses the proxy path for client-side requests", () => {
    expect(resolveBffProxyBaseUrl()).toBe("/api/bff");
    expect(resolveWorkbenchApiBase("client")).toBe("/api/bff/api/v1");
  });
});
