import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

describe("canonical observability evidence capture", () => {
  it("discovers the governed Core derived-state service and refuses missing or foreign containers", () => {
    const powershell = process.platform === "win32" ? "powershell.exe" : "pwsh";
    const contractPath = join(process.cwd(), "scripts", "quality", "Test-CoreDerivedStateEvidence.ps1");
    const result = spawnSync(
      powershell,
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", contractPath],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('"contract":"core-derived-state-evidence-discovery"');
    expect(result.stdout).toContain('"cases":10');
  });

  it("exposes a repeatable npm command for post-validation evidence capture", () => {
    const packageJson = readFileSync(join(process.cwd(), "package.json"), "utf8");

    expect(packageJson).toContain('"live:evidence"');
    expect(packageJson).toContain("scripts/live/Capture-LotusFrontOfficeEvidence.ps1");
  });

  it("captures live stack evidence across DNS, APIs, metrics, logs, and screenshots", () => {
    const script = readFileSync(
      join(process.cwd(), "scripts", "live", "Capture-LotusFrontOfficeEvidence.ps1"),
      "utf8"
    );
    const screenshotScript = readFileSync(
      join(process.cwd(), "scripts", "live", "capture-observability-screenshots.mjs"),
      "utf8"
    );
    const derivedStateLogScript = readFileSync(
      join(process.cwd(), "scripts", "live", "Capture-CoreDerivedStateLog.ps1"),
      "utf8"
    );

    expect(script).toContain("output\\observability-live");
    expect(script).toContain("observability-evidence-manifest.json");
    expect(script).toContain("live-validation-summary.json");
    expect(script).toContain("requiredBeforeDemo");
    expect(script).toContain("summaryExists");
    expect(script).toContain("docker ps --format");
    expect(script).toContain("dns.json");
    expect(script).toContain("workbench-performance-route");
    expect(script).toContain("performance?portfolioId=$PortfolioId&mode=evidence");
    expect(script).toContain("manage-supportability-summary");
    expect(script).toContain("http://manage.dev.lotus/api/v1/rebalance/supportability/summary");
    expect(script).not.toContain("manage-integration-capabilities");
    expect(script).not.toContain("http://manage.dev.lotus/integration/capabilities");
    expect(script).toContain("http://workbench.dev.lotus/api/metrics");
    expect(script).toContain("http://localhost:9190/api/v1/targets");
    expect(script).toContain("http://localhost:3300/api/health");
    expect(script).toContain("$metricChecks = @()");
    expect(script).toContain("metricChecks = $metricChecks");
    expect(script).toContain("docker logs --since");
    expect(script).toContain("Resolve-CoreDerivedStateContainer.ps1");
    expect(script).toContain("Capture-CoreDerivedStateLog.ps1");
    expect(derivedStateLogScript).toContain("position-timeseries materialization");
    expect(derivedStateLogScript).toContain("portfolio-timeseries aggregation");
    expect(script).not.toContain("lotus-core-app-local-portfolio_aggregation_service-1");
    expect(script).not.toContain("timeseries_generator_service");
    expect(script).toContain("$captureStartedAt");
    expect(script).toContain("ForbiddenEvidencePatterns");
    expect(script).toContain("Assert-EvidenceDoesNotContainForbiddenPatterns");
    expect(script).toContain("DEMO_ADV_USD_001");
    expect(script.indexOf("$screenshotManifest = $null")).toBeLessThan(
      script.indexOf("$logArtifacts = foreach")
    );
    expect(script).toContain("cmd.exe /d /c");
    expect(script).toContain("__VALIDATION_SUMMARY_PATH__");
    expect(script).toContain("lotus-archive-lotus-archive-1");
    expect(script).toContain("lotus-render-lotus-render-1");
    expect(script).toContain("capture-observability-screenshots.mjs");
    expect(script).toContain("__GENERATED_AT__");
    expect(script).not.toContain("- `dns.json`");
    expect(screenshotScript).toContain("prometheus-targets");
    expect(screenshotScript).toContain("grafana-home");
    expect(screenshotScript).toContain("workbench-performance-evidence");
  });

  it("documents the wiki evidence workflow for offline demos and operations", () => {
    const wiki = readFileSync(join(process.cwd(), "wiki", "Observability-Evidence.md"), "utf8");
    const runbook = readFileSync(join(process.cwd(), "wiki", "Operations-Runbook.md"), "utf8");
    const validation = readFileSync(join(process.cwd(), "wiki", "Validation-and-CI.md"), "utf8");
    const sidebar = readFileSync(join(process.cwd(), "wiki", "_Sidebar.md"), "utf8");

    expect(wiki).toContain("npm run live:evidence");
    expect(wiki).toContain("output/observability-live/<timestamp>/");
    expect(wiki).toContain("metrics/workbench-api-metrics.prom");
    expect(wiki).toContain("bounded container log tails");
    expect(wiki).toContain("offline client-demo preparation");
    expect(runbook).toContain("Observability evidence capture");
    expect(validation).toContain("post-validation observability");
    expect(validation).toContain("DpmPortfolioUniverseCandidate:v1");
    expect(validation).toContain("no-caller-portfolio guard");
    expect(sidebar).toContain("Observability-Evidence");
  });
});
