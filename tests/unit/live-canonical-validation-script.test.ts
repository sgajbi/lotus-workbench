import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const REPORT_CENTRE_CLASSIFICATION_PATTERN =
  /"reporting\.report_centre",\r?\n\s+reportCentreProof\.panelState,\r?\n\s+"lotus-report",/;

function normalizeSourceNewlines(source: string): string {
  return source.replace(/\r\n?/g, "\n");
}

function readNormalizedSource(...pathSegments: string[]): string {
  return normalizeSourceNewlines(
    readFileSync(join(process.cwd(), ...pathSegments), "utf8"),
  );
}
const OWNERSHIP_MODULE = readFileSync(
  join(
    process.cwd(),
    "scripts",
    "live",
    "CanonicalPortOwnership.psm1",
  ),
  "utf8",
);
const OWNERSHIP_CONTRACT = readFileSync(
  join(
    process.cwd(),
    "scripts",
    "quality",
    "Test-CanonicalPortOwnership.ps1",
  ),
  "utf8",
);
const BROWSER_WORKFLOW_MODULE = readNormalizedSource(
  "scripts",
  "live",
  "validation",
  "browser-workflows.mjs",
);

describe("canonical live validation script", () => {
  it("executes canonical Idea evidence authority acceptance and refusal cases", () => {
    const powershell = process.platform === "win32" ? "powershell.exe" : "pwsh";
    const contractPath = join(
      process.cwd(),
      "scripts",
      "quality",
      "Test-CanonicalIdeaEvidence.ps1",
    );
    const result = spawnSync(
      powershell,
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", contractPath],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('"contract":"canonical-idea-evidence-authority"');
    expect(result.stdout).toContain('"passed":true');
  });

  it("binds literal heading proof to exact accessible names", () => {
    const literalHeadingOptions = [
      ...BROWSER_WORKFLOW_MODULE.matchAll(
        /getByRole\("heading",\s*\{([^}]*)\}\)/g,
      ),
    ]
      .map((match) => match[1])
      .filter((options) => /name:\s*"[^"]+"/.test(options));
    const nonExactHeadingNames = literalHeadingOptions
      .filter((options) => !/exact:\s*true/.test(options))
      .map((options) => options.match(/name:\s*"([^"]+)"/)?.[1]);

    expect(literalHeadingOptions.length).toBeGreaterThan(0);
    expect(nonExactHeadingNames).toEqual([]);
  });

  it("keeps canonical PM Copilot proof aligned to the shipped business hierarchy", () => {
    const componentSource = readNormalizedSource(
      "src",
      "features",
      "workbench",
      "components",
      "dpm-copilot-workspace.tsx",
    );
    const screenRegistry = JSON.parse(
      readNormalizedSource(
        "docs",
        "documentation",
        "workbench-screen-registry.v1.json",
      ),
    ) as {
      surfaces: Array<{ id: string; businessName: string }>;
    };
    const workflowStart = BROWSER_WORKFLOW_MODULE.indexOf(
      "export async function validateDpmCopilotWorkspace",
    );
    const workflowEnd = BROWSER_WORKFLOW_MODULE.indexOf(
      "export async function validateProofPackPanel",
      workflowStart,
    );
    const workflowSource = BROWSER_WORKFLOW_MODULE.slice(workflowStart, workflowEnd);
    const sectionTitle = componentSource.match(
      /<SectionBlock\s+title="([^"]+)"\s+subtitle=/,
    )?.[1];
    const businessName = screenRegistry.surfaces.find(
      (surface) => surface.id === "pm-copilot",
    )?.businessName;

    expect(workflowStart).toBeGreaterThanOrEqual(0);
    expect(workflowEnd).toBeGreaterThan(workflowStart);
    expect(businessName).toBe("PM Copilot");
    expect(sectionTitle).toBe("Decision-support workflows");
    expect(workflowSource).toContain(
      `name: "${businessName}",\n      exact: true,\n      level: 1,`,
    );
    expect(workflowSource).toContain(
      `name: "${sectionTitle}",\n      exact: true,`,
    );
    expect(workflowSource).not.toContain("PM Copilot Workspace");
    for (const businessControl of [
      "Portfolio manager copilot status",
      "Portfolio manager decision-support workflows",
      "Selected decision-support workflow",
      "Human review required",
      "Internal decision support only",
      "Operating boundaries",
    ]) {
      expect(componentSource).toContain(businessControl);
      expect(workflowSource).toContain(businessControl);
    }
    for (const operatingBoundary of [
      "Portfolio manager and investment control retain decision authority",
      "client communication and order execution are not supported",
    ]) {
      expect(workflowSource).toContain(operatingBoundary);
    }
    for (const retiredTechnicalCopy of [
      "Gateway only",
      "No prompt storage",
      "Evidence Owner",
      "Workflow Owner",
      "Forbidden Uses",
    ]) {
      expect(workflowSource).not.toContain(retiredTechnicalCopy);
    }
  });

  it("proves the shipped Advisory Overview decision surface instead of its retired summary", () => {
    const browserWorkflowModule = readNormalizedSource(
      "scripts",
      "live",
      "validation",
      "browser-workflows.mjs",
    );
    const decisionProofStart = browserWorkflowModule.indexOf(
      "export async function validateAdvisoryOverviewDecisionSurface",
    );
    const decisionProofEnd = browserWorkflowModule.indexOf(
      "async function validateAdvisoryJourneyRoute",
      decisionProofStart,
    );
    const overviewJourneyStart = browserWorkflowModule.indexOf(
      'key: "overview"',
    );
    const overviewJourneyEnd = browserWorkflowModule.indexOf(
      'key: "client-context"',
      overviewJourneyStart,
    );
    const decisionSurfaceProof = browserWorkflowModule.slice(
      decisionProofStart,
      decisionProofEnd,
    );
    const overviewJourney = browserWorkflowModule.slice(
      overviewJourneyStart,
      overviewJourneyEnd,
    );

    expect(decisionProofStart).toBeGreaterThanOrEqual(0);
    expect(decisionProofEnd).toBeGreaterThan(decisionProofStart);
    expect(overviewJourneyStart).toBeGreaterThanOrEqual(0);
    expect(overviewJourneyEnd).toBeGreaterThan(overviewJourneyStart);
    expect(browserWorkflowModule).not.toContain("Advisory overview summary");
    expect(overviewJourney).toContain("await advisoryOverviewResponsePromise");
    expect(overviewJourney).toContain("buildProposalListSourceRows(");
    expect(overviewJourney).toContain(
      "return validateAdvisoryOverviewDecisionSurface(page, {",
    );
    for (const stableEvidence of [
      'name: "Adviser priorities"',
      'getByTestId("advisory-decision-brief")',
      'getByTestId("advisory-priority-worklist")',
      'getByTestId("advisory-source-window-posture")',
      'name: "Advisory proposal decision worklist"',
      'name: "Selected advisory proposal"',
      'aria-selected="true"',
      'getAttribute("aria-controls")',
      'getAttribute("data-source-identity")',
      'name: "Open proposal review"',
      "proposalOptions.evaluateAll",
      "assertExactSourceRenderProof({",
      "assertWorkspaceReviewContextPreserved({",
      "currentHref: page.url()",
    ]) {
      expect(decisionSurfaceProof).toContain(stableEvidence);
    }
    expect(decisionSurfaceProof).not.toContain(
      'locator(\'[data-source-render-row="proposal-list"]\')',
    );
    expect(decisionSurfaceProof).toContain(
      "selected-source-proposal-through-gateway",
    );
    expect(browserWorkflowModule).toContain(
      "validation.evidence ? { evidence: validation.evidence } : {}",
    );
    expect(browserWorkflowModule).toContain(
      'url.pathname.endsWith("/api/bff/api/v1/proposals")',
    );
    expect(browserWorkflowModule).toContain(
      'url.searchParams.get("portfolio_id") === portfolioId',
    );
  });

  it("passes exact Gateway mandate evidence to the Risk browser proof", () => {
    const script = readNormalizedSource(
      "scripts",
      "live",
      "validate-canonical-workbench-live.mjs",
    );
    const riskInvocation = script.match(
      /await validateRiskPanel\(page, \{\n([\s\S]*?)\n    \}\);/,
    )?.[1];
    const summaryInvocation = script.match(
      /await validatePerformanceSummaryPanel\(page, \{\n([\s\S]*?)\n    \}\);/,
    )?.[1];

    expect(riskInvocation).toContain("mandateComparisons: {");
    expect(riskInvocation).toContain(
      "summary: riskSummary.mandate_comparison",
    );
    expect(riskInvocation).toContain(
      "concentration: riskConcentration.mandate_comparison",
    );
    expect(summaryInvocation).not.toContain("mandateComparisons");
  });

  it("binds the Client Context mandate label to the fetched Gateway workspace", () => {
    const script = readNormalizedSource(
      "scripts",
      "live",
      "validate-canonical-workbench-live.mjs",
    );
    const browserWorkflow = readNormalizedSource(
      "scripts",
      "live",
      "validation",
      "browser-workflows.mjs",
    );
    const advisoryJourneyInvocation = script.match(
      /await validateAdvisoryJourneyScreens\(page, \{\n([\s\S]*?)\n    \}\);/,
    )?.[1];

    expect(advisoryJourneyInvocation).toContain("portfolioWorkspace,");
    expect(browserWorkflow).toContain(
      "const sourceMandate = portfolioWorkspace?.profile?.portfolio_type;",
    );
    expect(browserWorkflow).toContain("assertClientContextMandateProof({");
    expect(browserWorkflow).toContain(
      'evidencePosture: "source-confirmed-mandate-through-gateway"',
    );
    expect(browserWorkflow).toContain("evidence: mandateEvidence");
    expect(browserWorkflow).not.toContain(
      "await expect(mandateValue).not.toHaveText",
    );
  });

  it("seeds PM operating quality in the governed Workbench caller tenant", () => {
    const script = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validate-canonical-workbench-live.mjs",
      ),
      "utf8",
    );
    expect(script).toContain(
      "tenant_id: dpmCommandCenterDefaults.workbenchCallerTenantId",
    );
    expect(script).toContain("enabled: true");
    expect(script).toContain("weights: [");
    expect(script).toContain("governance_approval: {");
    expect(script).toContain("source_refs: [outcomeDisciplineSourceRef]");
    expect(script).toContain("source_refs: [sourceQualitySourceRef]");
    expect(script).not.toContain("indicator_weights:");
    expect(script).not.toContain("governance_evidence:");
  });

  it.each(["\n", "\r\n"])(
    "recognizes the report-panel classification with %j newlines",
    (newline) => {
      const classification = [
        '"reporting.report_centre",',
        "      reportCentreProof.panelState,",
        '      "lotus-report",',
      ].join(newline);

      expect(classification).toMatch(REPORT_CENTRE_CLASSIFICATION_PATTERN);
    },
  );

  it.each(["\n", "\r\n"])(
    "normalizes source text with %j newlines before source-order proof",
    (newline) => {
      expect(normalizeSourceNewlines(["first", "second"].join(newline))).toBe(
        "first\nsecond",
      );
    },
  );

  it.each(["\n", "\r\n"])(
    "recognizes PM source-evidence ownership with %j newlines",
    (newline) => {
      const sourceEvidenceBinding = [
        "const sourceEvidence = qualityPanel.getByTestId(",
        '    "pm-operating-quality-source-evidence",',
        ");",
      ].join(newline);

      expect(normalizeSourceNewlines(sourceEvidenceBinding)).toContain(
        'qualityPanel.getByTestId(\n    "pm-operating-quality-source-evidence"',
      );
    },
  );

  it("rejects unknown switches before live entry-point side effects", () => {
    for (const scriptName of [
      "Start-LotusFrontOfficeCanonical.ps1",
      "Stop-LotusFrontOfficeCanonical.ps1",
      "Validate-LotusFrontOfficeCanonical.ps1",
      "Capture-LotusFrontOfficeEvidence.ps1",
      "Invoke-IdeaCapacitySeed.ps1",
    ]) {
      const script = readFileSync(
        join(process.cwd(), "scripts", "live", scriptName),
        "utf8",
      );

      expect(script).toMatch(/^\[CmdletBinding\(\)\]\r?\nparam\(/);
    }
  });

  it("propagates browser validation failures to the caller", () => {
    const script = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "Validate-LotusFrontOfficeCanonical.ps1",
      ),
      "utf8",
    );

    expect(script).toContain("$validatorArguments = @(");
    expect(script).toContain(
      '"$repoRoot\\\\scripts\\\\live\\\\validate-canonical-workbench-live.mjs"',
    );
    expect(script).toContain("& node @validatorArguments");
    expect(script).toContain("Push-Location $repoRoot");
    expect(script).toContain("Pop-Location");
    expect(script).toContain("if ($LASTEXITCODE -ne 0)");
    expect(script).toContain("Canonical Workbench browser validation failed");
    expect(script).toContain("[string]$ScreenshotDirectory");
    expect(script).toContain('[string]$StartDate = "2025-03-31"');
    expect(script).toContain("period=EXPLICIT");
    expect(script).toContain("report_start_date=$StartDate");
    expect(script).toContain('"--start-date"');
    expect(script).toContain('"--output-dir"');
    expect(script).toContain("[int]$Attempts = 8");
    expect(script).toContain("retrying ($attempt/$Attempts)");
    expect(script).toContain("after $Attempts attempts");
    expect(script).toContain(
      "http://manage.dev.lotus/api/v1/rebalance/supportability/summary",
    );
    expect(script).toContain("lotus-manage supportability summary");
    expect(script).not.toContain(
      "http://manage.dev.lotus/integration/capabilities",
    );
  });

  it("documents stable live-validation artifact ownership", () => {
    const runbook = readFileSync(
      join(
        process.cwd(),
        "docs",
        "operations",
        "canonical-front-office-local-runtime.md",
      ),
      "utf8",
    );

    expect(runbook).toContain(
      "runs the browser validator from the `lotus-workbench` repository root",
    );
    expect(runbook).toContain(
      "Browser validation failures must fail the PowerShell command",
    );
    expect(runbook).toContain("recorded as source-supportability evidence");
    expect(runbook).toContain("historical action-register freshness");
    expect(runbook).toContain("-CleanCoreState");
    expect(runbook).toContain("1000`-portfolio load scenario");
    expect(runbook).toContain(
      "Docker is the default for every canonical front-office app",
    );
    expect(runbook).toContain("-LocalApps workbench,gateway,manage");
    expect(runbook).toContain("live:stack:up:workbench-local");
    expect(runbook).toContain("live:stack:up:core-manage");
    expect(runbook).toContain("core seed in ingest-only mode");
    expect(runbook).toContain("Use it only for API-level RFC proof");
    expect(runbook).toContain("GET /api/v1/rebalance/supportability/summary");
  });

  it("uses strategic lotus-manage supportability during live proof without stale capability probes", () => {
    const validationScript = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "Validate-LotusFrontOfficeCanonical.ps1",
      ),
      "utf8",
    );
    const browserValidator = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validate-canonical-workbench-live.mjs",
      ),
      "utf8",
    );

    for (const script of [validationScript, browserValidator]) {
      expect(script).toContain(
        "http://manage.dev.lotus/api/v1/rebalance/supportability/summary",
      );
      expect(script).toContain("lotus-manage supportability summary");
      expect(script).not.toContain(
        "http://manage.dev.lotus/integration/capabilities",
      );
      expect(script).not.toContain("lotus-manage integration capabilities");
    }

    expect(browserValidator).toContain("readSupportabilityState");
    expect(browserValidator).toContain("summary.sourceSupportability");
    expect(browserValidator).toContain(
      "lotus-manage supportability summary returned no bounded supportability state",
    );
    expect(browserValidator).not.toContain(
      "lotus-manage supportability summary returned non-ready supportability",
    );
    expect(browserValidator).toContain(
      "DPM rebalance-wave preview did not return ready manage supportability",
    );
    expect(browserValidator).toContain(
      "DPM rebalance-wave multi-portfolio preview",
    );
    expect(browserValidator).toContain(
      "multiPortfolioWaveScenario.minimumPortfolioCount",
    );
    expect(browserValidator).toContain(
      "DPM Core candidate-source wave preview",
    );
    expect(browserValidator).toContain("CORE_DPM_PORTFOLIO_UNIVERSE");
    expect(browserValidator).toContain(
      "postDpmCommandCenterJsonExpectingStatus",
    );
    expect(browserValidator).toContain("dpm-core-candidate-source-preview");
    expect(browserValidator).toContain(
      "coreCandidateSourceInvalidRequestRejected",
    );
    expect(browserValidator).toContain("supportedPortfolioMemoryStates");
    expect(browserValidator).toContain('"degraded"');
    expect(browserValidator).toContain(
      "DPM portfolio memory did not return populated manage supportability",
    );
    expect(browserValidator).toContain("gatewayModuleHealth.lotus_manage");
    expect(browserValidator).toContain("/api/v1/dpm/command-center?");
    expect(browserValidator).toContain("DPM command-center summary");
    expect(browserValidator).toContain(
      "/api/v1/dpm/command-center/exceptions?",
    );
    expect(browserValidator).toContain(
      "/api/v1/dpm/command-center/mandates/by-portfolio/",
    );
    expect(browserValidator).toContain(
      "fetchOptionalDpmCommandCenterJson",
    );
    expect(browserValidator).toContain('status: "seed_gap"');
    expect(browserValidator).toContain(
      "/api/v1/dpm/command-center/mandates/${encodeURIComponent(mandateId)}/health",
    );
    expect(browserValidator).not.toContain("gatewayManageFeatures");
  });

  it("starts the governed seed with the canonical RFC-0075 as-of date", () => {
    const script = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "Start-LotusFrontOfficeCanonical.ps1",
      ),
      "utf8",
    );

    expect(script).toContain("[int]$SeedWaitSeconds = 900");
    expect(script).toContain('[string]$LotusAiEnvFile = ".env.example"');
    expect(script).toContain("[string[]]$LocalApps = @()");
    expect(script).toContain("[switch]$SkipSeedCleanup");
    expect(script).toContain("function Test-LocalApp");
    expect(script).toContain("function Invoke-ComposeUp");
    expect(script).toContain("function Get-CanonicalDpmCommandCenterEnvironment");
    expect(script).toContain("$requiredValues = @{");
    expect(script).not.toContain("$requiredValues = [ordered]@{");
    expect(script).toContain(
      "WORKBENCH_BFF_TENANT_ID = [string]$context.workbench_caller_tenant_id",
    );
    expect(script).toContain("WORKBENCH_DPM_COMMAND_CENTER_TENANT_ID");
    expect(script).toContain("WORKBENCH_DPM_COMMAND_CENTER_PORTFOLIO_MANAGER_ID");
    expect(script).toContain("WORKBENCH_DPM_COMMAND_CENTER_BOOK_ID");
    expect(script).toContain("WORKBENCH_DPM_COMMAND_CENTER_AS_OF_DATE");
    expect(script).toContain(
      "$canonicalDpmCommandCenterEnvironment = Get-CanonicalDpmCommandCenterEnvironment",
    );
    expect(script).toContain(
      "$workbenchEnvironment = $canonicalDpmCommandCenterEnvironment.Clone()",
    );
    expect(script).toContain(
      "$environment = $canonicalDpmCommandCenterEnvironment.Clone()",
    );
    expect(script).toContain("$dockerWorkbenchEnvironment = Get-DockerWorkbenchEnvironment");
    expect(script).toContain("[switch]$Build");
    expect(script).toContain(
      '$composeCommand -notmatch "(?:^|\\s)--build(?:\\s|$)"',
    );
    expect(script).toContain('$composeCommand = "$composeCommand --build"');
    expect(script).toContain("function Start-LocalUvicornService");
    expect(script).toContain("function Start-CanonicalManage");
    expect(script).toContain("function Start-DirectIngress");
    expect(script).toContain("function Invoke-CanonicalCoreSeed");
    expect(script).toContain('Join-Path $coreRepo "src\\libs\\portfolio-common"');
    expect(script).toContain(
      "PYTHONPATH = ($corePythonPathEntries -join [System.IO.Path]::PathSeparator)",
    );
    expect(script).toContain("function Invoke-DpmCommandCenterSeed");
    expect(script).toContain("Using lotus-ai env file for canonical proof");
    expect(script).toContain("[switch]$CleanCoreState");
    expect(script).toContain("[switch]$CoreManageOnly");
    expect(script).toContain("[switch]$PortOwnershipPreflightOnly");
    expect(script).toContain("Core/manage proof mode enabled");
    expect(script).toContain(
      "$canonicalCoreEnvironment = New-CanonicalCoreBuildEnvironment",
    );
    expect(script).toContain("if ($BuildImages -or $RequireMainlineSources) {");
    expect(
      readNormalizedSource("scripts", "live", "CanonicalCoreImageProvenance.psm1"),
    ).toContain("DEMO_DATA_PACK_ENABLED = 'false'");
    expect(script).toContain(
      "Starting lotus-core with auxiliary demo data pack disabled for canonical PB seed isolation.",
    );
    expect(script).toContain("param([switch]$IngestOnly)");
    expect(script).toContain("--ingest-only");
    expect(script).toContain("$global:LASTEXITCODE = 0");
    expect(script).toContain("Command failed with exit code $LASTEXITCODE");
    expect(script).toContain(
      "Resetting lotus-core Docker state before canonical reseed",
    );
    expect(script).toContain("docker compose down -v --remove-orphans");
    expect(script).toContain("function Stop-HostProcessOnPort");
    expect(script).toContain("function Get-CanonicalRequiredPortPlan");
    expect(script).toContain("function Get-DockerPublishedPortOwners");
    expect(script).toContain("function Test-CanonicalPortOwnership");
    expect(script).not.toContain('C:\\Users\\Sandeep\\projects",');
    expect(script).toContain("Resolve-CanonicalWorkspaceRoot -ProjectsRoot $ProjectsRoot");
    expect(script).toContain(
      'Import-Module (Join-Path $PSScriptRoot "CanonicalPortOwnership.psm1") -Force',
    );
    expect(script).toContain(
      "Test-CanonicalDockerProjectOwnership",
    );
    expect(script).toContain(
      "Canonical port ownership preflight passed.",
    );
    expect(OWNERSHIP_MODULE).toContain(
      "function ConvertTo-CanonicalHostPathKey",
    );
    expect(OWNERSHIP_MODULE).toContain(
      "function Test-CanonicalDockerProjectOwnership",
    );
    expect(OWNERSHIP_MODULE).toContain("[System.IO.Path]::GetFullPath($Path)");
    expect(OWNERSHIP_MODULE).toContain(
      "[System.IO.Path]::IsPathRooted($Path)",
    );
    expect(OWNERSHIP_MODULE).toContain("$isDriveAbsolute");
    expect(OWNERSHIP_MODULE).toContain("$isUncAbsolute");
    expect(OWNERSHIP_MODULE).toContain("$AllowedProjects -icontains $Project");
    expect(OWNERSHIP_MODULE).toContain("$allowedPathKey -ieq $ownerPathKey");
    expect(OWNERSHIP_MODULE).toContain("catch {");
    expect(OWNERSHIP_MODULE).toMatch(/catch \{\r?\n\s+return ""/);
    expect(OWNERSHIP_CONTRACT).toContain('Case "repeated separators"');
    expect(OWNERSHIP_CONTRACT).toContain('Case "case difference"');
    expect(OWNERSHIP_CONTRACT).toContain('Case "trailing separator"');
    expect(OWNERSHIP_CONTRACT).toContain('Case "parent segment"');
    expect(OWNERSHIP_CONTRACT).toContain('Case "foreign directory"');
    expect(OWNERSHIP_CONTRACT).toContain('Case "relative owner path"');
    expect(OWNERSHIP_CONTRACT).toContain('Case "malformed owner path"');
    expect(script).toContain(
      "Canonical port preflight failed before hosts, builds, containers, or processes were changed.",
    );
    expect(script).toContain(
      "Canonical startup did not stop any foreign container or process.",
    );
    expect(script).toContain('AllowedDockerProjects = @("lotus-core-app-local")');
    expect(script).toContain("AllowedDockerWorkingDirectories = @($coreRepo)");
    expect(script).toContain('AllowedContainerNames = @("lotus-direct-dev-ingress")');
    expect(script).toContain("if ($CoreManageOnlyMode)");
    expect(script).toContain(
      "Test-CanonicalPortOwnership -CoreManageOnlyMode:$CoreManageOnly",
    );
    expect(
      script.indexOf(
        "Test-CanonicalPortOwnership -CoreManageOnlyMode:$CoreManageOnly",
      ),
    ).toBeLessThan(
      script.indexOf(
        "Previewing managed canonical hosts block from lotus-platform",
      ),
    );
    expect(
      script.indexOf("if ($PortOwnershipPreflightOnly)"),
    ).toBeLessThan(
      script.lastIndexOf("Invoke-MainlineSourceProvenancePreflight"),
    );
    expect(
      script.indexOf(
        "Test-CanonicalPortOwnership -CoreManageOnlyMode:$CoreManageOnly",
      ),
    ).toBeLessThan(
      script.lastIndexOf("Invoke-MainlineSourceProvenancePreflight"),
    );
    expect(script).toContain("Stopping stale $Description process on :$Port");
    expect(script).toContain(
      "Leaving Docker-owned $Description listener on :$Port",
    );
    expect(script).toContain(
      "$workbenchEnvironment.BFF_BASE_URL = \"http://gateway.dev.lotus\"",
    );
    expect(script).toContain('$workbenchEnvironment.LOTUS_ENVIRONMENT = "dev"');
    expect(script).toContain(
      '$workbenchEnvironment.WORKBENCH_IDEA_AUTH_MODE = "development_configured"',
    );
    expect(script).toContain('$workbenchEnvironment.NEXT_TELEMETRY_DISABLED = "1"');
    expect(script).toContain(
      "Invoke-WithProcessEnvironment -Environment $workbenchEnvironment",
    );
    expect(script).toContain('Test-LocalApp "workbench"');
    expect(script).toContain("function Invoke-WithProcessEnvironment");
    expect(script).toContain("$localManageEnvironment = @{");
    expect(script).toContain('LOTUS_MANAGE_HOST_PORT = "8001"');
    expect(script).toContain(
      'DPM_CAP_INPUT_MODE_PORTFOLIO_ID_ENABLED = "true"',
    );
    expect(script).toContain('DPM_STATEFUL_CORE_SOURCING_ENABLED = "true"');
    expect(script).toContain(
      'DPM_CORE_BASE_URL = "http://core-control.dev.lotus"',
    );
    expect(script).toContain(
      'DPM_CORE_QUERY_BASE_URL = "http://core-query.dev.lotus"',
    );
    expect(script).toContain(
      '$dockerManageEnvironment["DPM_CORE_BASE_URL"] = "http://host.docker.internal:8202"',
    );
    expect(script).toContain(
      '$dockerManageEnvironment["DPM_CORE_QUERY_BASE_URL"] = "http://host.docker.internal:8201"',
    );
    expect(script).toContain(
      "Invoke-WithProcessEnvironment -Environment $localManageEnvironment",
    );
    expect(script).toContain(
      "Invoke-ComposeUp $manageRepo $dockerManageEnvironment",
    );
    expect(script).toContain('BFF_BASE_URL = "http://host.docker.internal:8100"');
    expect(script).toContain('LOTUS_ENVIRONMENT = "dev"');
    expect(script).toContain('WORKBENCH_IDEA_AUTH_MODE = "development_configured"');
    expect(script).not.toContain("Workbench already responding on :3000");
    expect(script).toContain("--portfolio-id $PortfolioId");
    expect(script).toContain("--end-date 2026-04-10");
    expect(script).toContain("--benchmark-start-date 2025-01-06");
    expect(script).toContain("--wait-seconds $SeedWaitSeconds");
    expect(script).toContain('$seedCommand = "$seedCommand --skip-cleanup"');
    expect(script).toContain("Join-Path $platformRepo 'automation/Invoke-DpmCommandCenterSeed.ps1'");
    expect(script).toContain("-RuntimeHolder $RuntimeHolder -RuntimeOperationToken $runtimeOperation.Token -RuntimeOperationFence $runtimeOperation.Lock");
    expect(script).toContain(
      "Seeding governed DPM command-center and action-register evidence",
    );
    expect(script).toContain("[string]$ScreenshotDirectory");
    expect(script).toContain("ScreenshotDirectory = $ScreenshotDirectory");
    expect(script).toContain("function Invoke-CanonicalIdeaCapacitySeed");
    expect(script).toContain("Invoke-CanonicalIdeaCapacitySeed");
    expect(script).toContain("function Wait-HttpReady");
    expect(script).toContain(
      'Wait-HttpReady -Url "http://127.0.0.1:8000/health/ready" -Description "lotus-advise"',
    );
    expect(script).toContain("output\\\\canonical-front-office");
    expect(script).toContain("function Get-GitRepositoryIdentity");
    expect(script).toContain("LOTUS_IDEA_BUILD_GIT_COMMIT_SHA");
    expect(script).toContain("LOTUS_IDEA_BUILD_GIT_BRANCH");
    expect(script).toContain("[guid]::NewGuid().ToString('N')");
    expect(script).toContain("-RunId $ideaCanonicalRunId");
    expect(script).toContain(
      "Invoke-ComposeUp $ideaRepo $ideaBuildEnvironment -Build",
    );
    expect(script).not.toContain("Invoke-ComposeUp $performanceRepo -Build");
    expect(script).not.toContain("Invoke-ComposeUp $riskRepo -Build");
    expect(script).not.toContain("Invoke-ComposeUp $reportRepo -Build");
    expect(script.indexOf("if ($CoreManageOnly)")).toBeLessThan(
      script.indexOf("$ideaSourceIdentity = Get-GitRepositoryIdentity -RepoPath $ideaRepo"),
    );
  });

  it("covers the complete front-office Docker app set in canonical automation", () => {
    const startScript = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "Start-LotusFrontOfficeCanonical.ps1",
      ),
      "utf8",
    );
    const stopScript = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "Stop-LotusFrontOfficeCanonical.ps1",
      ),
      "utf8",
    );
    const validationScript = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "Validate-LotusFrontOfficeCanonical.ps1",
      ),
      "utf8",
    );
    const ideaEvidenceModule = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "CanonicalIdeaEvidence.psm1",
      ),
      "utf8",
    );
    const browserValidator = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validate-canonical-workbench-live.mjs",
      ),
      "utf8",
    );
    const packageJson = readFileSync(
      join(process.cwd(), "package.json"),
      "utf8",
    );

    for (const service of [
      "lotus-archive",
      "lotus-render",
      "lotus-idea",
      "lotus-gateway",
    ]) {
      expect(startScript).toContain(service);
      expect(stopScript).toContain(service);
    }
    for (const script of [startScript, stopScript]) {
      expect(script).toContain('$workbenchRepo = $WorkbenchRepoPath');
      expect(script).toContain("$selectedWorkbench = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path");
      expect(script).toContain("-WorkbenchRepoPath $workbenchRepo");
      expect(script).toContain("Selected Workbench checkout does not match the executing script.");
    }
    expect(stopScript).toContain(
      "Stop-ListenersOnPorts @($runtimeOperation.Scope.ports)",
    );
    expect(stopScript).toContain("Leaving Docker-owned listener");
    expect(validationScript).toContain(
      'Test-CanonicalHost "archive.dev.lotus"',
    );
    expect(validationScript).toContain('Test-CanonicalHost "render.dev.lotus"');
    expect(validationScript).toContain(
      'Test-Endpoint "http://archive.dev.lotus/health/ready"',
    );
    expect(validationScript).toContain(
      'Test-Endpoint "http://render.dev.lotus/health/ready"',
    );
    expect(validationScript).toContain('Test-CanonicalHost "idea.dev.lotus"');
    expect(validationScript).toContain(
      'Test-Endpoint "http://idea.dev.lotus/health/ready"',
    );
    expect(validationScript).toContain("idea-capacity-seed-evidence.json");
    expect(validationScript).toContain('"--idea-capacity-seed-evidence"');
    expect(validationScript).toContain("idea-candidate-seed-evidence.json");
    expect(validationScript).toContain('"--idea-candidate-id"');
    expect(startScript).toContain("function Invoke-CanonicalIdeaSeed");
    expect(startScript).toContain("Get-CanonicalFrontOfficeDatePolicy");
    expect(startScript).toContain('"invoke-idea-candidate-lifecycle-seed.mjs"');
    expect(startScript).toContain("--candidate-id $candidateId");
    expect(startScript).toContain("--observed-at-utc $lifecycleObservedAtUtc");
    expect(startScript).toContain(
      '$evaluatedAtUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")',
    );
    const ideaSeedStart = startScript.indexOf("function Invoke-CanonicalIdeaSeed");
    const ideaReadyBoundary = startScript.indexOf(
      'throw "lotus-idea did not become ready before canonical advisor queue seed."',
      ideaSeedStart,
    );
    const liveSourceClock = startScript.indexOf(
      '$sourceObservedAtUtc = (Get-Date).ToUniversalTime()',
      ideaSeedStart,
    );
    expect(liveSourceClock).toBeGreaterThan(ideaReadyBoundary);
    expect(startScript.indexOf("$evaluatedAtUtc =", liveSourceClock)).toBeGreaterThan(
      liveSourceClock,
    );
    expect(startScript.indexOf("$lifecycleObservedAtUtc =", liveSourceClock)).toBeGreaterThan(
      startScript.indexOf("$evaluatedAtUtc =", liveSourceClock),
    );
    expect(startScript.indexOf("$queueEvaluatedAtUtc =", liveSourceClock)).toBeGreaterThan(
      startScript.indexOf("$lifecycleObservedAtUtc =", liveSourceClock),
    );
    expect(startScript).toContain("evaluatedAtUtc = $evaluatedAtUtc");
    expect(startScript).toContain(
      'review-queues/advisor?evaluatedAtUtc=$encodedEvaluatedAtUtc',
    );
    expect(startScript).toContain(
      "[datetimeoffset]$queue.evaluatedAtUtc -ne [datetimeoffset]$queueEvaluatedAtUtc",
    );
    expect(startScript).toContain("asOfDate = $asOfDate");
    expect(ideaEvidenceModule).toContain(
      "candidate seed evidence does not match business date $AsOfDate",
    );
    const utcTimestampPattern = ideaEvidenceModule.match(
      /\$canonicalUtcTimestampPattern = '([^']+)'/,
    )?.[1];
    expect(utcTimestampPattern).toBeDefined();
    const utcTimestampContract = new RegExp(utcTimestampPattern!);
    expect(utcTimestampContract.test("2026-09-07T05:03:19.594Z")).toBe(true);
    for (const invalidTimestamp of [
      "2026-09-07T05:03:19.594",
      "2026-09-07T05:03:19.594+00:00",
      "2026-09-07 05:03:19.594Z",
      "09/07/2026 05:03:19Z",
    ]) {
      expect(utcTimestampContract.test(invalidTimestamp)).toBe(false);
    }
    expect(ideaEvidenceModule).toContain(
      "$Value -notmatch $canonicalUtcTimestampPattern",
    );
    expect(ideaEvidenceModule).toContain("[datetimeoffset]::ParseExact(");
    expect(ideaEvidenceModule).toContain('ConvertFrom-Json -DateKind String');
    expect(ideaEvidenceModule).toContain(
      '$timestampProperty = $evidence.PSObject.Properties[$field]',
    );
    expect(validationScript).toContain(
      "-EvaluatedAtUtc $ideaCandidateSeedEvidence.queueEvaluatedAtUtc",
    );
    expect(startScript).toContain("--tenant-id $payload.accessScope.tenantId");
    expect(startScript).toContain("--book-id $payload.accessScope.bookId");
    expect(startScript).toContain("--portfolio-id $payload.accessScope.portfolioId");
    expect(startScript).toContain("--client-id $payload.accessScope.clientId");
    expect(startScript).toContain(
      '"X-Caller-Tenant-Ids" = $payload.accessScope.tenantId',
    );
    expect(startScript).toContain(
      '"X-Caller-Book-Ids" = $payload.accessScope.bookId',
    );
    expect(startScript).toContain(
      '"X-Caller-Portfolio-Ids" = $payload.accessScope.portfolioId',
    );
    expect(startScript).toContain(
      '"X-Caller-Client-Ids" = $payload.accessScope.clientId',
    );
    expect(startScript).toContain(
      'throw "Canonical Lotus Idea lifecycle preparation failed with exit code $LASTEXITCODE."',
    );
    expect(startScript).toContain("function Get-CanonicalTextSha256");
    expect(startScript).toContain(
      '$sourceObservationIdentity = "$ProductId|$PortfolioId|$asOfDate|$ideaCanonicalRunId"',
    );
    expect(startScript).toContain(
      'contentHash = "sha256:$(Get-CanonicalTextSha256 -Value $sourceObservationIdentity)"',
    );
    expect(startScript).toContain(
      '"Idempotency-Key" = "canonical-idea-high-cash:$($PortfolioId):$ideaCanonicalRunId"',
    );
    expect(ideaEvidenceModule).toContain("function Assert-IdeaQueueSeed");
    expect(ideaEvidenceModule).toContain("function Read-IdeaCandidateSeedEvidence");
    expect(startScript).toContain(
      'schemaVersion = "lotus-workbench.idea-candidate-seed-evidence.v3"',
    );
    expect(ideaEvidenceModule).toContain(
      '$evidence.schemaVersion -ne "lotus-workbench.idea-candidate-seed-evidence.v3"',
    );
    expect(startScript).toContain(
      "tenantId = [string]$payload.accessScope.tenantId",
    );
    expect(startScript).toContain(
      "bookId = [string]$payload.accessScope.bookId",
    );
    expect(startScript).toContain(
      "portfolioId = [string]$payload.accessScope.portfolioId",
    );
    expect(startScript).toContain(
      "clientId = [string]$payload.accessScope.clientId",
    );
    expect(ideaEvidenceModule).toContain(
      'foreach ($field in @("tenantId", "bookId", "portfolioId", "clientId"))',
    );
    expect(ideaEvidenceModule).toContain(
      'throw "Canonical Lotus Idea candidate seed evidence has incomplete admitted access scope."',
    );
    expect(ideaEvidenceModule).toContain(
      'throw "Canonical Lotus Idea candidate seed evidence has mismatched admitted portfolio scope."',
    );
    expect(ideaEvidenceModule).toContain(
      '"X-Caller-Tenant-Ids" = [string]$AccessScope.tenantId',
    );
    expect(ideaEvidenceModule).toContain(
      '"X-Caller-Book-Ids" = [string]$AccessScope.bookId',
    );
    expect(ideaEvidenceModule).toContain(
      '"X-Caller-Portfolio-Ids" = [string]$AccessScope.portfolioId',
    );
    expect(ideaEvidenceModule).toContain(
      '"X-Caller-Client-Ids" = [string]$AccessScope.clientId',
    );
    expect(validationScript).toContain(
      "-AccessScope $ideaCandidateSeedEvidence.accessScope",
    );
    expect(ideaEvidenceModule).not.toContain("tenant-private-bank-sg");
    expect(ideaEvidenceModule).not.toContain("book-advisor-001");
    expect(ideaEvidenceModule).not.toContain("client-001");
    expect(ideaEvidenceModule).toContain(
      '$activeIdeaRunId = [string]$ideaVersion.build.ciRunId',
    );
    expect(ideaEvidenceModule).toContain(
      "but the active Idea runtime identifies run '$activeIdeaRunId'",
    );
    expect(ideaEvidenceModule).toContain("current-run candidate");
    expect(startScript).toContain("idea-candidate-seed-evidence.json");
    expect(startScript).toContain("$seededQueueItems.Count -ne 1");
    expect(browserValidator).toContain(
      'checkDns(summary, "archive.dev.lotus")',
    );
    expect(browserValidator).toContain('checkDns(summary, "render.dev.lotus")');
    expect(packageJson).toContain('"live:stack:up:workbench-local"');
    expect(packageJson).toContain('"live:stack:up:core-manage"');
    expect(packageJson).toContain(
      '"live:stack:up:validate": "node scripts/live/run-canonical-powershell.mjs scripts/live/Start-LotusFrontOfficeCanonical.ps1 -RunValidation -BuildImages"',
    );
    expect(startScript).toContain("[switch]$RequireMainlineSources");
    expect(startScript).toContain("mainline-source-provenance.mjs");
    expect(startScript).toContain("--workbench-repo-path $workbenchRepo");
    expect(startScript.match(/--workbench-repo-path \$workbenchRepo/g)?.length).toBe(2);
    expect(startScript).toContain("No Docker build, seed, or validation was started");
    expect(startScript).toContain("docker compose up -d --build --force-recreate");
    expect(startScript).toContain("mainline-source-provenance-runtime.json");
    expect(startScript).toContain("SpecialFolder]::LocalApplicationData");
    expect(startScript).toContain("mainlineProvenanceRoot");
    expect(startScript).toContain(
      "$ideaCapacityEvidenceRoot = $mainlineProvenance.EvidenceRoot",
    );
    expect(startScript).toContain("IdeaCapacitySeedEvidencePath");
    expect(startScript).toContain("Get-FileHash -Algorithm SHA256");
    expect(startScript).toContain("MainlineSourceProvenancePath");
    expect(validationScript).toContain("IdeaCapacitySeedEvidencePath");
    expect(validationScript).toContain("--mainline-source-provenance");
    expect(browserValidator).toContain("mainlineSourceProvenance");
    expect(browserValidator).toContain("bindMainlineSourceManifestToRuntime");
    expect(browserValidator).toContain("repository: \"lotus-idea\"");
  });

  it("forwards canonical DPM context through the Docker Workbench boundary", () => {
    const compose = readFileSync(
      join(process.cwd(), "docker-compose.yml"),
      "utf8",
    );

    for (const variable of [
      "WORKBENCH_BFF_TENANT_ID",
      "WORKBENCH_DPM_COMMAND_CENTER_TENANT_ID",
      "WORKBENCH_DPM_COMMAND_CENTER_PORTFOLIO_MANAGER_ID",
      "WORKBENCH_DPM_COMMAND_CENTER_BOOK_ID",
      "WORKBENCH_DPM_COMMAND_CENTER_AS_OF_DATE",
    ]) {
      expect(compose).toContain(`- ${variable}=\${${variable}:-`);
    }
  });

  it("forwards complete canonical Idea caller scope through the Docker boundary", () => {
    const compose = readFileSync(
      join(process.cwd(), "docker-compose.yml"),
      "utf8",
    );

    for (const [variable, fallback] of [
      ["WORKBENCH_IDEA_CALLER_SUBJECT", "workbench-advisor"],
      ["WORKBENCH_IDEA_CALLER_ROLES", "advisor"],
      ["WORKBENCH_IDEA_CALLER_TENANT_IDS", "tenant-private-bank-sg"],
      ["WORKBENCH_IDEA_CALLER_BOOK_IDS", "book-advisor-001"],
      ["WORKBENCH_IDEA_CALLER_PORTFOLIO_IDS", "PB_SG_GLOBAL_BAL_001"],
      ["WORKBENCH_IDEA_CALLER_CLIENT_IDS", "client-001"],
    ] as const) {
      expect(compose).toContain(`- ${variable}=\${${variable}:-${fallback}}`);
    }
  });

  it("requires the exact canonical PM quality records to be ready", () => {
    const script = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validate-canonical-workbench-live.mjs",
      ),
      "utf8",
    );

    expect(script).toContain("extractPmQualityScoreRunState");
    expect(script).toContain("extractPmQualityFairnessAnalysisState");
    expect(script).toContain("const sendPmQualityJson");
    expect(script).toContain(
      '"X-Tenant-Id": dpmCommandCenterDefaults.workbenchCallerTenantId',
    );
    expect(script).toContain(
      "tenant_id: dpmCommandCenterDefaults.workbenchCallerTenantId",
    );
    expect(script).toContain(
      "tenantId: dpmCommandCenterDefaults.workbenchCallerTenantId",
    );
    expect(script).toContain('scoreRunState !== "READY"');
    expect(script).toContain('fairnessAnalysisState !== "READY"');
    expect(script).toContain("scoreRunState,");
    expect(script).toContain("fairnessAnalysisState,");
  });

  it("binds every DPM command-center probe to the governed Workbench caller tenant", () => {
    const script = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validate-canonical-workbench-live.mjs",
      ),
      "utf8",
    );

    expect(script).toContain(
      '"X-Tenant-Id": dpmCommandCenterDefaults.workbenchCallerTenantId',
    );
    expect(script).toContain(
      "const outcomeReviews = await fetchDpmCommandCenterJson(",
    );
    expect(script).toContain("function sendDpmCommandCenterJson");
    expect(script).toContain("function fetchDpmCommandCenterJson");
    expect(script).toContain("function postDpmCommandCenterJson");
    expect(script).toContain(
      "function postDpmCommandCenterJsonExpectingStatus",
    );
    for (const rawProbe of [
      "fetchJson",
      "fetchJsonUntil",
      "fetchText",
      "postJson",
      "postJsonExpectingStatus",
      "sendJson",
      "sendJsonExpectingStatus",
    ]) {
      const rawDpmCallPattern = new RegExp(
        `\\b${rawProbe}\\(\\s*summary,\\s*\`\\$\\{gatewayBaseUrl\\}/api/v1/dpm/command-center`,
        "u",
      );
      expect(
        `${rawProbe}(summary, \`\${gatewayBaseUrl}/api/v1/dpm/command-center/outcome-reviews\`)`,
      ).toMatch(rawDpmCallPattern);
      expect(script).not.toMatch(rawDpmCallPattern);
    }
    const dpmUrlAliases = [
      ...script.matchAll(
        /const\s+(\w+)\s*=\s*`\$\{gatewayBaseUrl\}\/api\/v1\/dpm\/command-center/gu,
      ),
    ].map((match) => match[1]);
    expect(dpmUrlAliases).toEqual(["pmQualityBaseUrl"]);

    const pmQualitySeamStart = script.indexOf("const sendPmQualityJson");
    const pmQualitySeamEnd = script.indexOf(
      "const scoreRunRequest",
      pmQualitySeamStart,
    );
    expect(pmQualitySeamStart).toBeGreaterThanOrEqual(0);
    expect(pmQualitySeamEnd).toBeGreaterThan(pmQualitySeamStart);
    const pmQualitySeam = script.slice(pmQualitySeamStart, pmQualitySeamEnd);
    expect(pmQualitySeam).toContain(
      "sendDpmCommandCenterJson(url, description",
    );
    expect(pmQualitySeam).not.toContain("sendJson(");

    const governedSeamStart = script.indexOf(
      "const dpmCommandCenterCallerHeaders",
    );
    const governedSeamEnd = script.indexOf(
      "async function run()",
      governedSeamStart,
    );
    const governedSeam = script.slice(governedSeamStart, governedSeamEnd);
    expect(governedSeam).toContain("function sendDpmCommandCenterJson");
    expect(governedSeam).toContain("return sendJson(summary, url");
    expect(governedSeam).toContain(
      "headers: dpmCommandCenterCallerHeaders",
    );
    expect(script).not.toContain("fetchOptionalJson");
  });

  it("delegates isolated Idea capacity seeding without exposing credentials or client state", () => {
    const script = readFileSync(
      join(process.cwd(), "scripts", "live", "Invoke-IdeaCapacitySeed.ps1"),
      "utf8",
    );

    expect(script).toContain('Invoke-RestMethod -Uri "$IdeaBaseUrl/version"');
    expect(script).toContain("ExpectedCommitSha");
    expect(script).toContain("ExpectedBranch");
    expect(script).toContain("$version.build.ciRunId");
    expect(script).toContain("$commitSha -ne $ExpectedCommitSha");
    expect(script).toContain("$branch -ne $ExpectedBranch");
    expect(script).toContain("$runtimeRunId -ne $RunId");
    expect(script).toContain('$provenanceMismatches += "commit"');
    expect(script).toContain('$provenanceMismatches += "branch"');
    expect(script).toContain('$provenanceMismatches += "run"');
    expect(script).toContain("targeted Idea build did not produce");
    expect(script).toContain("runtime provenance does not match");
    expect(script).toContain("seed_downstream_capacity_resource.py");
    expect(script).toContain("run_service_capacity_workload.py");
    expect(script).toContain('"--scenario", "downstream_submission"');
    expect(script).toContain('"--request-count", "1"');
    expect(script).toContain('"--allow-mutating-workflows"');
    expect(script).toContain("SEED_SYNTHETIC_LOTUS_IDEA_CAPACITY_RESOURCE");
    expect(script).toContain("Validate-IdeaCapacitySeedEvidence.mjs");
    expect(script).toContain("[System.IO.Path]::GetTempPath()");
    expect(script).toContain("Remove-Item -LiteralPath $rawArtifactDirectory");
    expect(script).not.toContain("PB_SG_GLOBAL_BAL_001");
    expect(script).not.toContain("client-001");
    expect(script).not.toContain("LOTUS_IDEA_CAPACITY_AUTHORIZATION");
    expect(script).not.toContain("LOTUS_IDEA_CAPACITY_TRUSTED_CALLER_CONTEXT");

    const startScript = readFileSync(
      join(process.cwd(), "scripts", "live", "Start-LotusFrontOfficeCanonical.ps1"),
      "utf8",
    );
    expect(startScript).toContain(
      "$followUpValidationCommand = if ($ValidationProfile -eq 'client-demo') {",
    );
    expect(startScript).toContain(
      "'npm run live:validate -- -ValidationProfile client-demo'",
    );
    expect(startScript).toContain(
      'Write-Host "Run \'$followUpValidationCommand\' from lotus-workbench when you want end-to-end validation."',
    );
    expect(startScript).toContain(
      '$ideaCapacityTrustedCallerContext = "canonical-local-idea-capacity-seed-$([guid]::NewGuid().ToString(\'N\'))"',
    );
    expect(startScript).toContain("LOTUS_IDEA_TRUSTED_CALLER_CONTEXT_TOKEN");
    expect(startScript).toContain("LOTUS_IDEA_CAPACITY_TRUSTED_CALLER_CONTEXT");
    expect(startScript).toContain("Invoke-WithProcessEnvironment");
    const capacitySeed = startScript.slice(
      startScript.indexOf("function Invoke-CanonicalIdeaCapacitySeed"),
      startScript.indexOf(
        "Import-Module (Join-Path $platformRepo",
        startScript.indexOf("function Invoke-CanonicalIdeaCapacitySeed"),
      ),
    );
    expect(capacitySeed).toContain("-AsOfDate $datePolicy.AsOfDate");
    expect(capacitySeed).toContain("-SeededAtUtc $capacityObservedAtUtc");
    expect(capacitySeed).not.toContain("-SeededAtUtc $datePolicy.GeneratedAtUtc");
    expect(startScript).not.toContain('GeneratedAtUtc = "$($asOfDate)T10:00:00Z"');
    const readyIndex = capacitySeed.indexOf(
      'Wait-HttpReady -Url "http://127.0.0.1:8000/health/ready"',
    );
    const clockIndex = capacitySeed.indexOf(
      "$capacityObservedAtUtc = (Get-Date).ToUniversalTime()",
    );
    const seedIndex = capacitySeed.indexOf("-SeededAtUtc $capacityObservedAtUtc");
    expect(readyIndex).toBeGreaterThanOrEqual(0);
    expect(clockIndex).toBeGreaterThan(readyIndex);
    expect(seedIndex).toBeGreaterThan(clockIndex);
  });

  it("asserts canonical performance and risk calculation sanity", () => {
    const script = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validate-canonical-workbench-live.mjs",
      ),
      "utf8",
    );
    expect(script).toContain("`${ideaBaseUrl}/version`");
    expect(script).toContain("runId: ideaVersion?.build?.ciRunId");
    const calculationModule = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validation",
        "calculation-sanity.mjs",
      ),
      "utf8",
    );
    const browserWorkflows = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validation",
        "browser-workflows.mjs",
      ),
      "utf8",
    );
    const advisoryPolicyProof = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validation",
        "advisory-policy-proof.mjs",
      ),
      "utf8",
    );
    const advisorCockpitProof = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validation",
        "advisor-cockpit-proof.mjs",
      ),
      "utf8",
    );
    const advisoryCopilotProof = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validation",
        "advisory-copilot-proof.mjs",
      ),
      "utf8",
    );
    const contractModule = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validation",
        "contract-metadata.mjs",
      ),
      "utf8",
    );
    const payloadUtils = readFileSync(
      join(process.cwd(), "scripts", "live", "validation", "payload-utils.mjs"),
      "utf8",
    );

    expect(script).toContain("assertPerformanceCalculationSanity");
    expect(script).toContain("assertRiskCalculationSanity");
    expect(script).toContain("/performance/details?");
    expect(script).toContain("Performance details contribution readiness");
    expect(script).toContain("contribution_detail state is");
    expect(script).toContain('rows=${Array.isArray(rows) ? rows.length : "non-array"}');
    expect(script).toContain("/risk/concentration?");
    expect(script).toContain("/risk/drawdown?");
    expect(script).toContain("/risk/rolling?");
    expect(script).toContain("/risk/attribution?");
    expect(script).toContain('from "./validation/workflow-pack-proof.mjs"');
    expect(script).toContain("validateAdvisorBriefWorkflowPackReviewChain");
    expect(script).toContain("workflowPackChecks.push");
    expect(script).toContain("validateAdvisoryJourneyScreens");
    expect(script).toContain("validateProposalNarrativePosturePanel");
    expect(script).toContain("validateProposalMemoEvidencePackPanel");
    expect(browserWorkflows).toContain(
      'getByTestId("proposal-memo-source-state")',
    );
    expect(browserWorkflows).toContain('"data-source-state"');
    expect(browserWorkflows).toContain("not-prepared|ready");
    expect(browserWorkflows).toContain('"ready"');
    expect(browserWorkflows).toContain("initialSourceState");
    expect(script).toContain("validateBankDemoProofPanel");
    expect(script).toContain("RFC-0028 bank demo supported-claim register");
    expect(script).toContain('from "./validation/advisory-policy-proof.mjs"');
    expect(script).toContain('from "./validation/advisor-cockpit-proof.mjs"');
    expect(script).toContain('from "./validation/advisor-book-proof.mjs"');
    expect(script).toContain("validateCanonicalAdvisorBookEvidence");
    expect(script).toContain("summary.advisorBookChecks.push");
    expect(script).toContain('from "./validation/advisory-copilot-proof.mjs"');
    expect(script).toContain("validateCanonicalAdvisoryCopilot");
    expect(script).toContain("Create proposal narrative canonical proof");
    expect(advisoryPolicyProof).toContain(
      "Create advisory policy evaluation canonical proof",
    );
    expect(advisoryPolicyProof).toContain(
      "Advisory policy review queue canonical proof",
    );
    expect(advisoryPolicyProof).toContain("workbench-canonical-policy-checker");
    expect(advisoryPolicyProof).toContain("portfolio_id=");
    expect(advisoryPolicyProof).toContain(
      "POLICY_EVALUATION_PENDING_REVIEW_CREATED",
    );
    expect(advisoryPolicyProof).toContain(
      "POLICY_PACK_VERSION_ALREADY_ACTIVE_IMMUTABLE",
    );
    expect(advisoryPolicyProof).toContain('status: "already_active"');
    expect(advisorCockpitProof).toContain(
      "Advisor cockpit canonical action list",
    );
    expect(advisorCockpitProof).toContain(
      "Advisor cockpit canonical operating snapshot",
    );
    expect(advisorCockpitProof).toContain(
      "Advisor cockpit canonical preparation packets",
    );
    expect(advisorCockpitProof).toContain(
      "/api/v1/advisor-cockpit/preparation-packets",
    );
    expect(advisorCockpitProof).toContain(
      "/api/v1/advisor-cockpit/house-view-cohorts/evaluate",
    );
    expect(contractModule).toContain("HOUSE_VIEW_IMPACT_REVIEW");
    expect(advisorCockpitProof).toContain(
      "Advisor cockpit canonical acknowledgement",
    );
    expect(advisorCockpitProof).toContain(
      "ADVISOR_COCKPIT_ACTION_ACKNOWLEDGED",
    );
    expect(advisorCockpitProof).toContain("expectedSupportabilityPosture");
    expect(advisorCockpitProof).toContain("expectedWorkbenchPosture");
    expect(advisorCockpitProof).toContain("expectedMinPreparationPackets");
    expect(advisoryCopilotProof).toContain(
      "Advisory copilot canonical supportability",
    );
    expect(advisoryCopilotProof).toContain(
      "Advisory copilot ${action.family} source evidence packet",
    );
    expect(advisoryCopilotProof).toContain(
      "Advisory copilot client-ready guardrail rejection",
    );
    expect(advisoryCopilotProof).toContain(
      "ADVISORY_COPILOT_CANONICAL_PROOF_CREATED",
    );
    expect(advisoryCopilotProof).toContain(
      "CLIENT_READY_PUBLICATION_FORBIDDEN",
    );
    expect(advisoryCopilotProof).toContain("wb-copilot-run");
    expect(advisoryCopilotProof).toContain("wb-copilot-review");
    expect(advisoryCopilotProof).toContain('"X-Caller-Capabilities": "advisory.copilot.review"');
    expect(advisoryCopilotProof).toContain('"X-Authorized-Proposal-Id": proposalId');
    expect(advisoryCopilotProof).toContain('"X-Authorized-Portfolio-Id": portfolioId');
    expect(advisoryCopilotProof).not.toContain('actor_id: "desk_head_sg_001"');
    expect(advisoryCopilotProof).toContain(
      "/api/v1/advisory-copilot/evidence-packets/from-proposal-version",
    );
    expect(contractModule).toContain("expectedActionFamilies");
    expect(contractModule).toContain("advisoryCopilot");
    expect(contractModule).toContain("RFC27_ADVISORY_COPILOT_CANONICAL");
    expect(advisorCockpitProof).toContain("wb-advisor-cockpit-ack");
    expect(payloadUtils).toContain('import { createHash } from "node:crypto"');
    expect(payloadUtils).toContain("buildPayloadScopedIdempotencyKey");
    expect(script).toContain("buildPayloadScopedIdempotencyKey");
    expect(script).toContain("proposalCreateIdempotencyKey");
    expect(advisoryPolicyProof).toContain("wb-policy-evaluation");
    expect(script).toContain("proofPackIdempotencyKey");
    expect(script).toContain("proposal.narrative_posture");
    expect(script).toContain("proposal.memo_evidence_pack");
    expect(script).toContain("advisory.advisor_cockpit");
    expect(script).toContain("advisory.advisory_copilot");
    expect(script).toContain("advisory.bank_demo_proof");
    expect(browserWorkflows).toContain(
      'page.locator("#proposal-narrative-review")',
    );
    expect(browserWorkflows).toContain(
      'getByTestId("proposal-narrative-action-status")',
    );
    expect(browserWorkflows).toContain("source-confirmed-advisor-use");
    expect(browserWorkflows).not.toContain(
      'locator("article.proposal-narrative-posture-panel")',
    );
    expect(calculationModule).toContain("calculationChecks");
    expect(calculationModule).toContain(
      "Contribution total does not reconcile with net portfolio return",
    );
    expect(calculationModule).toContain(
      "Historical risk attribution residual is too high",
    );
  });

  it("surfaces governed canonical contract metadata in live validation evidence", () => {
    const script = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validate-canonical-workbench-live.mjs",
      ),
      "utf8",
    );
    const contractModule = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validation",
        "contract-metadata.mjs",
      ),
      "utf8",
    );
    const runbook = readFileSync(
      join(
        process.cwd(),
        "docs",
        "operations",
        "canonical-front-office-local-runtime.md",
      ),
      "utf8",
    );

    expect(script).toContain('from "./validation/contract-metadata.mjs"');
    expect(script).toContain("loadCanonicalContractMetadata");
    expect(script).toContain("canonicalContract");
    expect(contractModule).toContain("DEFAULT_CANONICAL_CONTRACT");
    expect(contractModule).toContain(
      "canonical-front-office-demo-data-contract.json",
    );
    expect(contractModule).toContain("multiPortfolioWaveScenario");
    expect(contractModule).toContain(
      "RFC41_MULTI_PORTFOLIO_EXPLICIT_LIST_CANONICAL",
    );
    expect(contractModule).toContain("LOTUS_PLATFORM_REPO");
    expect(contractModule).toContain('sourcePath: "deterministic-fallback"');
    expect(runbook).toContain("contract identity and version");
    expect(runbook).toContain("RFC-0076");
  });

  it("loads the governed RFC-0077 panel registry for panel ownership and screenshot policy", () => {
    const script = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validate-canonical-workbench-live.mjs",
      ),
      "utf8",
    );
    const contractModule = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validation",
        "contract-metadata.mjs",
      ),
      "utf8",
    );
    const panelGovernanceModule = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validation",
        "panel-governance.mjs",
      ),
      "utf8",
    );
    const browserWorkflowModule = readNormalizedSource(
      "scripts",
      "live",
      "validation",
      "browser-workflows.mjs",
    );
    const runbook = readFileSync(
      join(
        process.cwd(),
        "docs",
        "operations",
        "canonical-front-office-local-runtime.md",
      ),
      "utf8",
    );

    expect(script).toContain('from "./validation/contract-metadata.mjs"');
    expect(script).toContain("loadWorkbenchPanelRegistryMetadata");
    expect(panelGovernanceModule).toContain("panelRegistryById");
    expect(contractModule).toContain("DEFAULT_PANEL_REGISTRY");
    expect(contractModule).toContain("workbench-panel-registry.json");
    expect(contractModule).toContain("requiredSupportState");
    expect(contractModule).toContain("owningService");
    expect(panelGovernanceModule).toContain("Panel classification");
    expect(contractModule).toContain("allowedStates");
    expect(script).toContain("validateReportCentrePanel");
    expect(script).toContain('"reporting.report_centre"');
    expect(browserWorkflowModule).not.toContain(
      'screenshotRegisteredPanel(page, "reporting.report_centre")',
    );
    expect(browserWorkflowModule).toContain('name: "Submit Report Request"');
    expect(browserWorkflowModule).toContain("Report request accepted");
    expect(browserWorkflowModule).not.toContain('name: "Request Accepted"');
    expect(script).not.toContain("assertRegionHasButtons");
    expect(runbook).toContain("RFC-0077");
    expect(runbook).toContain("panel registry");
  });

  it("fails when governed panel ownership or supportability drifts from the registry", () => {
    const script = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validate-canonical-workbench-live.mjs",
      ),
      "utf8",
    );
    const calculationModule = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validation",
        "calculation-sanity.mjs",
      ),
      "utf8",
    );
    const panelGovernanceModule = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validation",
        "panel-governance.mjs",
      ),
      "utf8",
    );

    expect(panelGovernanceModule).toContain("supportabilityChecks");
    expect(script).toContain("createPanelGovernance");
    expect(panelGovernanceModule).toContain(
      "assertPanelSupportabilityAlignment",
    );
    expect(panelGovernanceModule).toContain("reported owner");
    expect(panelGovernanceModule).toContain("registry owner");
    expect(panelGovernanceModule).toContain("requiredSupportState");
    expect(panelGovernanceModule).toContain("ownerFollowUpRfc");
    expect(script).toContain("lotus-performance");
    expect(calculationModule).toContain("performance.evidence");
  });

  it("records explicit panel support classifications for demo evidence", () => {
    const script = normalizeSourceNewlines(
      readFileSync(
        join(
          process.cwd(),
          "scripts",
          "live",
          "validate-canonical-workbench-live.mjs",
        ),
        "utf8",
      ),
    );
    const calculationModule = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validation",
        "calculation-sanity.mjs",
      ),
      "utf8",
    );
    const panelGovernanceModule = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validation",
        "panel-governance.mjs",
      ),
      "utf8",
    );

    expect(panelGovernanceModule).toContain("panelClassifications");
    expect(script).toContain("createPanelGovernance");
    expect(panelGovernanceModule).toContain("recordPanelClassification");
    expect(panelGovernanceModule).toContain("assertNoUnsupportedBlankPanels");
    expect(script).toContain("portfolio.summary");
    expect(script).toContain("advisor.book_overview");
    expect(script).toContain("Gateway advisor own-book membership");
    const reportWorkflowIndex = script.indexOf(
      "await validateReportCentrePanel(page",
    );
    const reportClassificationIndex = script.indexOf(
      '"reporting.report_centre"',
      reportWorkflowIndex,
    );
    const reportScreenshotIndex = script.indexOf(
      'await browserHelpers.screenshotRegisteredPanel(\n      page,\n      "reporting.report_centre",',
      reportClassificationIndex,
    );
    const finalAlignmentIndex = script.lastIndexOf(
      "panelGovernance.assertPanelSupportabilityAlignment()",
    );
    expect(reportWorkflowIndex).toBeGreaterThan(-1);
    expect(reportClassificationIndex).toBeGreaterThan(reportWorkflowIndex);
    expect(reportScreenshotIndex).toBeGreaterThan(reportClassificationIndex);
    expect(finalAlignmentIndex).toBeGreaterThan(reportClassificationIndex);
    expect(script).toContain(
      "const reportCentreProof = await validateReportCentrePanel(page",
    );
    expect(script).toContain(
      "outputFormat: reportCentreProof.outputFormat",
    );
    expect(script).toContain(
      "pdfOutputState: reportCentreProof.pdfOutputState",
    );
    expect(script).toContain("reason: reportCentreProof.reason");
    expect(
      script.slice(reportClassificationIndex, finalAlignmentIndex),
    ).toMatch(REPORT_CENTRE_CLASSIFICATION_PATTERN);
    expect(calculationModule).toContain("performance.analysis.attribution");
    expect(calculationModule).toContain("performance.evidence");
    expect(calculationModule).toContain(
      "performance.risk.historical_attribution",
    );
    expect(calculationModule).toContain("performance.risk.snapshot");
    expect(panelGovernanceModule).toContain("supported_blank");
  });

  it("records demo screenshot evidence with registry-governed names, routes, and absolute paths", () => {
    const script = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validate-canonical-workbench-live.mjs",
      ),
      "utf8",
    );
    const contractModule = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validation",
        "contract-metadata.mjs",
      ),
      "utf8",
    );
    const evidenceWriter = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validation",
        "evidence-summary-writer.mjs",
      ),
      "utf8",
    );
    const rfcFeatureCoverageModule = readFileSync(
      join(
        process.cwd(),
        "scripts",
        "live",
        "validation",
        "rfc36-43-feature-coverage.mjs",
      ),
      "utf8",
    );
    const browserWorkflowModule = readNormalizedSource(
      "scripts",
      "live",
      "validation",
      "browser-workflows.mjs",
    );
    const runbook = readFileSync(
      join(
        process.cwd(),
        "docs",
        "operations",
        "canonical-front-office-local-runtime.md",
      ),
      "utf8",
    );

    expect(script).toContain("canonicalStartDate");
    expect(script).toContain("canonicalAsOfDate");
    expect(script).toContain("report_start_date: extra.reportStartDate ?? canonicalStartDate");
    expect(browserWorkflowModule).toContain("reportStartDate=${canonicalStartDate}");
    expect(script).toContain("createBrowserValidationHelpers");
    expect(script).toContain("validatePortfolioMemoryPanel");
    expect(script).toContain("validateConstructionAlternativesPanel");
    expect(script).toContain("validatePmOperatingQualityPanel");
    expect(script).toContain("validateDpmCopilotWorkspace");
    expect(browserWorkflowModule).toContain("validateDpmCommandCenterPanel");
    expect(browserWorkflowModule).toContain(
      'page.locator("article#mandate-health-panel")',
    );
    expect(browserWorkflowModule).not.toContain(
      'workbenchPanelByClass(page, "manage-mandate-panel")',
    );
    expect(browserWorkflowModule).toContain(
      'name: "Portfolio Memory",\n      exact: true',
    );
    expect(browserWorkflowModule).toContain("Portfolio memory event timeline");
    expect(browserWorkflowModule).toContain("Historical Event Log");
    expect(browserWorkflowModule).toContain("Support Snapshot");
    expect(browserWorkflowModule).toContain(
      'page.locator("article#portfolio-memory-panel")',
    );
    expect(browserWorkflowModule).toContain(
      'screenshotRegisteredPanel(page, "dpm.portfolio_memory")',
    );
    expect(browserWorkflowModule).toContain(
      'name: "Active Rebalance",\n      exact: true',
    );
    expect(script).toContain("DPM portfolio memory");
    expect(script).toContain("/memory?limit=100");
    expect(script).toContain(
      "DPM portfolio memory returned no manage-owned timeline events.",
    );
    expect(script).toContain('"dpm.portfolio_memory"');
    expect(script).toContain('"dpm.construction_alternatives"');
    expect(script).toContain('"dpm.pm_operating_quality"');
    expect(script).toContain("ensureCanonicalPmOperatingQualityEvidence");
    expect(script).toContain("DPM PM operating-quality score-run create");
    expect(script).toContain(
      "DPM PM operating-quality fairness-analysis create",
    );
    expect(script).toContain("DPM PM operating-quality review-action create");
    expect(script).toContain(
      "DPM PM operating-quality summary-invocation create",
    );
    expect(script).toContain("pm_quality_summary.pack");
    expect(script).toContain(
      "summaryInvocationId: pmOperatingQualityEvidence.summaryInvocationId",
    );
    expect(script).toContain("expectedEvidence: pmOperatingQualityEvidence");
    expect(script).toContain('"dpm.copilot_workspace"');
    expect(browserWorkflowModule).toContain(
      "Construction alternatives generated from mandate data.",
    );
    expect(browserWorkflowModule).toContain(
      "construction-alternatives-summary",
    );
    expect(browserWorkflowModule).toContain(
      'getByText("Recommended Path", { exact: true })',
    );
    expect(browserWorkflowModule).toContain(
      'screenshotRegisteredPanel(page, "dpm.construction_alternatives")',
    );
    expect(browserWorkflowModule).toContain(
      "PM operating quality summary generation status",
    );
    expect(browserWorkflowModule).toContain(
      'qualityPanel.getByTestId(\n    "pm-operating-quality-source-evidence"',
    );
    expect(browserWorkflowModule).toContain('"data-score-run-id"');
    expect(browserWorkflowModule).toContain('"data-fairness-analysis-id"');
    expect(browserWorkflowModule).toContain(
      'getByText("Summary Invocation Detail", { exact: true })',
    );
    expect(browserWorkflowModule).toContain(
      "PM operating quality summary invocations",
    );
    expect(browserWorkflowModule).toContain(
      'screenshotRegisteredPanel(page, "dpm.pm_operating_quality")',
    );
    expect(browserWorkflowModule).toContain("Portfolio manager copilot status");
    expect(browserWorkflowModule).toContain(
      'screenshotRegisteredPanel(page, "dpm.copilot_workspace")',
    );
    expect(contractModule).toContain("dpm-construction-alternatives-live.png");
    expect(contractModule).toContain("dpm-pm-operating-quality-live.png");
    expect(contractModule).toContain("dpm-copilot-workspace-live.png");
    expect(browserWorkflowModule).toContain("Mandate Health");
    expect(script).toContain("classifyCommandCenterPanelState");
    expect(script).toContain(
      "DPM command-center summary did not return canonical populated posture",
    );
    expect(script).toContain("supportabilityState: readSupportabilityState");
    expect(script).toContain("buildRfc3643FeatureCoverage");
    expect(script).toContain("assertRfc3643FeatureCoverage");
    expect(script).toContain("summary.rfc3643FeatureCoverage");
    expect(rfcFeatureCoverageModule).toContain("scenarioExpansionNeeded");
    expect(rfcFeatureCoverageModule).toContain("multiPortfolioWavePreview");
    expect(rfcFeatureCoverageModule).toContain("coreCandidateSourcePreview");
    expect(rfcFeatureCoverageModule).toContain(
      "bounded Core DPM candidate-source preview",
    );
    expect(rfcFeatureCoverageModule).toContain(
      "single-portfolio and multi-portfolio explicit-list waves",
    );
    expect(browserWorkflowModule).toContain("Candidate Source Review");
    expect(browserWorkflowModule).toContain("DpmPortfolioUniverseCandidate:v1");
    expect(browserWorkflowModule).toContain("Selection Basis");
    expect(browserWorkflowModule).toContain(
      "Effective Discretionary Mandate Binding",
    );
    expect(browserWorkflowModule).toContain("portfolio_mandate_bindings");
    expect(browserWorkflowModule).toContain("mandate_type=discretionary");
    expect(browserWorkflowModule).toContain(
      "Review launch readiness and any source-owned blockers.",
    );
    expect(browserWorkflowModule).toContain("NO_ORDER_GENERATION");
    expect(browserWorkflowModule).toContain("NO_OMS_EXECUTION_CLAIM");
    expect(browserWorkflowModule).toContain("NO_CLIENT_CONTACT_WORKFLOW");
    expect(browserWorkflowModule).toContain(
      'getByRole("button", { name: /oms/i })',
    );
    expect(browserWorkflowModule).toContain(
      'getByRole("button", { name: /client/i })',
    );
    expect(browserWorkflowModule).toContain(
      'getByRole("button", { name: /order/i })',
    );
    expect(runbook).toContain("DpmPortfolioUniverseCandidate:v1");
    expect(runbook).toContain(
      "candidate-source preview/no-caller-portfolio guard",
    );
    expect(browserWorkflowModule).toContain("Mandate review");
    expect(browserWorkflowModule).toContain("Mandate attention items");
    expect(browserWorkflowModule).toContain("Source-owned next step");
    expect(browserWorkflowModule).toContain("Attention items");
    expect(browserWorkflowModule).toContain("Mandate health dimensions");
    expect(browserWorkflowModule).toContain("aria-pressed");
    expect(browserWorkflowModule).toContain("[1024, 768, 720, 519]");
    expect(browserWorkflowModule).toContain("page-level horizontal scrolling");
    expect(script).toContain("Generate DPM proof-pack evidence");
    expect(script).toContain("workbench-proof-pack");
    expect(script).toContain("workbench-proof-pack-operator");
    expect(script).toContain(
      "Workbench PM generated proof pack from Gateway-backed rebalance run.",
    );
    expect(script).toContain("extractWorkbenchRebalanceRunId");
    expect(script).toContain("isReviewableProofPackState");
    expect(script).toContain("recordMapCount");
    expect(script).toContain("sourceEvidenceCount");
    expect(script).toContain("extractWorkflowPackRunId");
    expect(script).toContain("PENDING_REVIEW");
    expect(script).toContain(
      "DPM proof-pack evidence returned no reviewable proof-pack sections.",
    );
    expect(script).toContain('normalized === "BLOCKED"');
    expect(script).toContain("DPM proof-pack AI PM memo");
    expect(script).toContain("/ai-pm-memo");
    expect(script).toContain(
      "DPM proof-pack AI PM memo did not return lotus-ai source authority.",
    );
    expect(script).toContain(
      "DPM proof-pack AI PM memo returned no workflow-pack run reference.",
    );
    expect(script).toContain("DPM rebalance-wave report input");
    expect(script).toContain(
      "DPM rebalance-wave report input returned no report input evidence ref.",
    );
    expect(script).toContain("DPM rebalance-wave AI PM memo");
    expect(script).toContain("DPM rebalance-wave create");
    expect(script).toContain(
      "DPM rebalance-wave create returned no manage-owned wave id.",
    );
    expect(script).toContain(
      "DPM rebalance-wave AI PM memo did not return lotus-ai source authority.",
    );
    expect(script).toContain(
      "DPM rebalance-wave AI PM memo returned no workflow-pack run reference.",
    );
    expect(script).toContain(
      "Gateway workbench overview returned no manage rebalance-run reference",
    );
    expect(script).toContain('source_type: "REBALANCE_RUN"');
    expect(browserWorkflowModule).toContain("screenshotRegisteredPanel");
    expect(browserWorkflowModule).toContain("validateAdvisorBookPanel");
    expect(script).toMatch(/validateAdvisorBookPanel\(page, \{\s+summary,\s+workbenchBaseUrl,/);
    expect(script).not.toMatch(
      /validateAdvisorBookPanel\(page, \{\s+summary,\s+advisorBook,/,
    );
    expect(browserWorkflowModule).toContain(
      'screenshotRegisteredPanel(page, "advisor.book_overview")',
    );
    expect(contractModule).toContain("advisor-book-overview-live.png");
    expect(browserWorkflowModule).toContain("Evidence pack prepared.");
    expect(browserWorkflowModule).toContain(
      "buildPreparedProofPackSourceProof",
    );
    expect(browserWorkflowModule).toContain("buildProofPackMemoSourceProof");
    expect(browserWorkflowModule).toContain(
      'pathname.endsWith("/api/bff/api/v1/dpm/command-center/proof-packs")',
    );
    expect(browserWorkflowModule).toContain(
      'proofPackPanel.getByText(state, { exact: true })',
    );
    expect(browserWorkflowModule).toContain(
      "renderedSectionCount !== sourceProof.sectionCount",
    );
    expect(browserWorkflowModule).toContain("Open advisor memo");
    expect(browserWorkflowModule).toContain(
      'name: "Portfolio decision memo"',
    );
    expect(browserWorkflowModule).toContain("resolveRegistryRoute");
    expect(browserWorkflowModule).toContain("assertRailModeActive");
    expect(browserWorkflowModule).toContain("tableByExactLabel");
    expect(browserWorkflowModule).toContain("workbenchPanelByClass");
    expect(browserWorkflowModule).toContain(
      'getByLabel("Mandate health summary")',
    );
    expect(browserWorkflowModule).toContain(
      'page.locator("article#pm-operating-quality-panel")',
    );
    expect(browserWorkflowModule).toContain(
      'getByTestId("pm-operating-quality-source-evidence")',
    );
    expect(browserWorkflowModule).not.toContain(
      'locator(".pm-quality-status-strip")',
    );
    expect(browserWorkflowModule).toContain("outcome-review-panel");
    expect(browserWorkflowModule).toContain(
      "buildOutcomeReviewSourceEvidenceProof(sourceReview)",
    );
    expect(browserWorkflowModule).toMatch(
      /getByTestId\(\s*"selected-outcome-review-detail",?\s*\)/u,
    );
    for (const attribute of [
      "data-outcome-review-id",
      "data-expected-snapshot-hash",
      "data-realized-snapshot-hash",
    ]) {
      expect(browserWorkflowModule).toContain(attribute);
    }
    expect(script).toContain("sourceReview: outcomeReviewItems[0]");
    expect(browserWorkflowModule).toContain("#evidence-pack-panel");
    expect(browserWorkflowModule).toMatch(
      /page\.getByRole\("heading", \{[\s\S]{0,100}name: "Evidence Pack",[\s\S]{0,50}level: 1,[\s\S]{0,50}exact: true/u,
    );
    expect(browserWorkflowModule).not.toMatch(
      /proofPackPanel\.getByRole\("heading", \{[\s\S]{0,100}name: "Evidence Pack"/u,
    );
    expect(browserWorkflowModule).toContain("requireVisible");
    expect(browserWorkflowModule).toContain("Return history");
    expect(browserWorkflowModule).toContain(
      'page.getByText("Return history", { exact: true })',
    );
    expect(browserWorkflowModule).toContain(
      'returnHistoryTitle.locator("..")).toContainText',
    );
    expect(browserWorkflowModule).toContain(
      'name: "Report centre", exact: true',
    );
    expect(browserWorkflowModule).toMatch(
      /getByRole\("heading", \{[\s\S]{0,80}level: 2,[\s\S]{0,80}name: "Adviser priorities",[\s\S]{0,40}exact: true/,
    );
    expect(browserWorkflowModule).not.toContain("Priority Advisory Actions");
    for (const label of ["MTD return", "QTD return", "YTD return"]) {
      expect(browserWorkflowModule).toContain(
        `page.getByText("${label}", { exact: true })`,
      );
    }
    expect(browserWorkflowModule).toContain(
      'name: "Time-weighted return path · Net of fees"',
    );
    expect(browserWorkflowModule).toContain(
      'name: "Outcome comparison"',
    );
    expect(browserWorkflowModule).toContain(
      'name: "Selected review detail"',
    );
    expect(browserWorkflowModule).toContain(
      'outcomeReviewPanel.getByText("Evidence availability", { exact: true })',
    );
    expect(browserWorkflowModule).toContain(
      'name: /Prepare AI-assisted review summary/',
    );
    for (const label of [
      "Adviser talking points",
      "Key source metrics",
      "Mandate review",
      "Attention items",
      "Mandate health dimensions",
    ]) {
      expect(browserWorkflowModule).toMatch(
        new RegExp(`name: "${label}",[\\s\\S]{0,40}exact: true`),
      );
    }
    expect(browserWorkflowModule).toContain(
      '.getByRole("region", { name: "Source metrics", exact: true })',
    );
    expect(browserWorkflowModule).toContain("performAcceptReviewActionProof");
    expect(browserWorkflowModule).toContain("Adviser brief human review");
    expect(browserWorkflowModule).toContain('selectOption("ACCEPT")');
    expect(browserWorkflowModule).toContain("Review decision");
    expect(browserWorkflowModule).toContain("Confirm acceptance");
    expect(browserWorkflowModule).not.toContain("Advisor brief review actions");
    expect(browserWorkflowModule).not.toContain("not-currently-allowed");
    const advisorBriefBrowserProofIndex = script.indexOf(
      "await validateAdvisorBriefPanel(page",
    );
    const advisorBriefApiProofIndex = script.indexOf(
      "await validateAdvisorBriefWorkflowPackReviewChain",
    );
    expect(advisorBriefBrowserProofIndex).toBeGreaterThan(-1);
    expect(advisorBriefApiProofIndex).toBeGreaterThan(advisorBriefBrowserProofIndex);
    expect(script).toContain('preRecordedAcceptReviewer: "live.validator.ui"');
    expect(script).toContain("advisorBriefAcceptProofQuery?.detailBasis");
    expect(script).toContain("advisorBriefAcceptProofQuery?.chartFrequency");
    expect(browserWorkflowModule).toContain("Adviser talking points");
    expect(browserWorkflowModule).not.toContain("Client Talking Points");
    expect(browserWorkflowModule).toContain(
      "hasAcceptedAdvisorBriefReviewPosture",
    );
    expect(browserWorkflowModule).toContain(
      '"advisor-brief-human-review-evidence"',
    );
    expect(browserWorkflowModule).toContain(
      'getAttribute("data-review-state")',
    );
    expect(browserWorkflowModule).toContain(
      'getAttribute("data-review-supportability")',
    );
    expect(browserWorkflowModule).toContain(
      'getAttribute("data-reviewer")',
    );
    expect(browserWorkflowModule).toContain(
      'getAttribute("data-recorded-at")',
    );
    expect(browserWorkflowModule).not.toContain(
      "supportabilityRegion.textContent()",
    );
    expect(browserWorkflowModule).not.toContain(
      'text.includes("Supportability ACTION REQUIRED")',
    );
    expect(browserWorkflowModule).toContain('"Portfolio Review"');
    expect(browserWorkflowModule).toContain('"Portfolio decision review"');
    expect(browserWorkflowModule).toContain(
      '".workbench-decision-brief-primary h3"',
    );
    expect(browserWorkflowModule).toContain('"Portfolio readiness"');
    expect(browserWorkflowModule).toContain('"Reporting coverage"');
    expect(browserWorkflowModule).not.toContain(
      '"No priority attention items for the selected view."',
    );
    expect(browserWorkflowModule).toContain('"Performance Snapshot"');
    expect(browserWorkflowModule).toContain('"Summary"');
    expect(browserWorkflowModule).toContain('"Detailed"');
    expect(browserWorkflowModule).toContain(".toHaveCount(0)");
    expect(browserWorkflowModule).toContain("/^Performance overview/");
    expect(browserWorkflowModule).toContain("/^Performance analysis/");
    expect(browserWorkflowModule).toContain('"Asset Class attribution table"');
    const performanceAnalysisCall = script.slice(
      script.indexOf("await validatePerformanceAnalysisPanel"),
      script.indexOf("await validateAdvisorBriefPanel"),
    );
    expect(performanceAnalysisCall).toContain(
      "recordUiCheck: browserHelpers.recordUiCheck",
    );
    expect(browserWorkflowModule).toContain(
      "Attribution detail is marked available, but no segment attribution levels were returned for the current selection.",
    );
    expect(browserWorkflowModule).not.toContain(
      'getByRole("group", { name: "Post-Trade Outcome Review"',
    );
    expect(browserWorkflowModule).not.toContain(
      'getByRole("group", { name: "Proof-Pack Evidence"',
    );
    expect(contractModule).toContain('panelId: "performance.risk.snapshot"');
    expect(contractModule).toContain('panelId: "proposal.narrative_posture"');
    expect(contractModule).toContain('panelId: "proposal.memo_evidence_pack"');
    expect(contractModule).toContain('panelId: "advisory.advisor_cockpit"');
    expect(contractModule).toContain('panelId: "advisory.bank_demo_proof"');
    expect(contractModule).toContain(
      "RFC28_BANK_DEMO_CLIENT_READY_PROOF_CANONICAL",
    );
    expect(contractModule).toContain("expectedSupportabilityPosture");
    expect(contractModule).toContain("expectedWorkbenchPosture");
    expect(contractModule).toContain("expectedMinPreparationPackets");
    expect(contractModule).toContain("advisoryProposalScenarios");
    expect(contractModule).toContain("RFC25_SG_STRUCTURED_NOTE_PENDING_REVIEW");
    expect(contractModule).toContain(
      'screenshotName: "performance-risk-live.png"',
    );
    expect(contractModule).toContain(
      'screenshotName: "proposal-narrative-posture-live.png"',
    );
    expect(contractModule).toContain(
      'screenshotName: "proposal-memo-evidence-pack-live.png"',
    );
    expect(contractModule).toContain(
      'screenshotName: "advisory-advisor-cockpit-live.png"',
    );
    expect(contractModule).toContain(
      'screenshotName: "advisory-bank-demo-proof-live.png"',
    );
    expect(browserWorkflowModule).toContain(
      "Proposal narrative posture review and report package",
    );
    expect(browserWorkflowModule).toContain(
      "Proposal memo evidence-pack advisor-use review and support posture",
    );
    expect(browserWorkflowModule).toContain(
      "RFC-0028 bank demo proof supported-claim surface",
    );
    expect(browserWorkflowModule).toContain("advisoryJourneyChecks");
    expect(browserWorkflowModule).toContain("advisory-overview-live.png");
    expect(browserWorkflowModule).toContain("advisory-client-context-live.png");
    expect(browserWorkflowModule).toContain("advisory-opportunities-live.png");
    expect(browserWorkflowModule).toContain("const observedRoute = page.url()");
    expect(browserWorkflowModule).toContain("route: observedRoute");
    expect(browserWorkflowModule).toContain("idea-review-queue-through-gateway");
    expect(browserWorkflowModule).toContain(
      "resolveHighCashIdeaCandidateId",
    );
    expect(browserWorkflowModule).toContain("requireHighCashIdeaCandidateId");
    expect(browserWorkflowModule).toContain(
      "name: `High Cash - ${expectedIdeaCandidateId}`",
    );
    expect(browserWorkflowModule).not.toContain("idea_high_cash_001");
    expect(browserWorkflowModule).toContain('getByLabel("Idea candidates")');
    expect(browserWorkflowModule).toContain("Idea candidate review queue");
    expect(browserWorkflowModule).toContain("assertGridHasRows");
    expect(browserWorkflowModule).toContain('page.getByRole("grid"');
    expect(browserWorkflowModule).toContain(
      "assertCanonicalIdeaPresentationReceiptEvidence",
    );
    expect(browserWorkflowModule).toContain(
      "idea-presentation-receipt-browser-proof",
    );
    expect(browserWorkflowModule).toContain("canonicalCandidateLink");
    expect(browserWorkflowModule).toContain(
      "candidateId=${encodeURIComponent(canonicalCandidateId)}",
    );
    expect(browserWorkflowModule).not.toContain(
      'candidateTable.locator("tbody tr a").first().click()',
    );
    expect(browserWorkflowModule).toContain("Idea candidate source-safe detail");
    expect(browserWorkflowModule).toContain(
      "selectedCandidateId: canonicalCandidateId",
    );
    expect(browserWorkflowModule).toContain(
      "canonicalCandidateProof:",
    );
    expect(browserWorkflowModule).toContain(
      "candidate_id_policy_evaluation_source_signal_and_source_ref_verified",
    );
    expect(browserWorkflowModule).toContain("sourceHashVerified");
    expect(browserWorkflowModule).toContain("sourceHashBoundary");
    expect(browserWorkflowModule).not.toContain("deterministicSeededCandidate");
    expect(browserWorkflowModule).toContain("Lifecycle: (?!Pending)");
    expect(browserWorkflowModule).toContain("Sources: [1-9]");
    expect(browserWorkflowModule).toContain("Source refs: (?!None)");
    expect(browserWorkflowModule).toContain("Source signals: (?!None)");
    expect(browserWorkflowModule).toContain(
      "Queue policy: idea-deterministic-ranking-v1",
    );
    expect(browserWorkflowModule).toContain("Queue evaluated:");
    expect(browserWorkflowModule).toContain("Candidate detail is unavailable through Gateway");
    expect(browserWorkflowModule).toContain(
      "Lotus Idea review-action, feedback, and conversion-intent browser controls",
    );
    expect(browserWorkflowModule).toContain('name: "Record feedback"');
    expect(browserWorkflowModule).toContain('name: "Record review"');
    expect(browserWorkflowModule).toContain('name: "Record intent"');
    expect(browserWorkflowModule).toContain("idea-action-feedback-status");
    expect(browserWorkflowModule).toContain("idea-action-review-status");
    expect(browserWorkflowModule).toContain("idea-action-conversion-status");
    expect(browserWorkflowModule).toContain("recorded-and-refreshed");
    expect(browserWorkflowModule).toContain(
      "sourceRefresh: \"verified_after_each_mutation\"",
    );
    expect(browserWorkflowModule).toContain("\"supported_feature_promotion\"");
    expect(browserWorkflowModule).toContain("\"execution_authority\"");
    expect(browserWorkflowModule).toContain(
      "advisory-advisor-cockpit-live.png",
    );
    expect(browserWorkflowModule).toContain(
      "advisory-advisory-copilot-live.png",
    );
    expect(browserWorkflowModule).toContain(
      "advisory-copilot-through-gateway",
    );
    expect(browserWorkflowModule).toContain(
      'getByTestId("advisory-copilot-decision")',
    );
    expect(browserWorkflowModule).toContain(
      'decisionRegion.getByRole("heading", { level: 2 })',
    );
    expect(browserWorkflowModule).toContain(
      '"advisory-copilot-decision-title"',
    );
    expect(browserWorkflowModule).toContain(
      'getByTestId("advisory-copilot-status")',
    );
    expect(browserWorkflowModule).toContain(
      'getByTestId("advisory-copilot-output")',
    );
    expect(browserWorkflowModule).toContain("data-output-section-count");
    expect(browserWorkflowModule).toContain(
      'getByTestId("advisory-copilot-human-review")',
    );
    expect(browserWorkflowModule).toContain("data-review-posture");
    expect(browserWorkflowModule).not.toContain(
      'getByText("Source Evidence", { exact: true })',
    );
    expect(browserWorkflowModule).toContain("return statefulIdeaJourney;");
    expect(browserWorkflowModule).toContain(
      "export async function validateCanonicalIdeaJourney",
    );
    const readOnlyJourneyIndex = script.indexOf(
      "const preparedIdeaJourney = await validateAdvisoryJourneyScreens",
    );
    const finalReadOnlyPanelIndex = script.indexOf(
      "await validateDpmCopilotWorkspace",
    );
    const statefulIdeaIndex = script.indexOf(
      "await validateCanonicalIdeaJourney(page, preparedIdeaJourney);",
    );
    expect(readOnlyJourneyIndex).toBeGreaterThanOrEqual(0);
    expect(finalReadOnlyPanelIndex).toBeGreaterThan(readOnlyJourneyIndex);
    expect(statefulIdeaIndex).toBeGreaterThan(finalReadOnlyPanelIndex);
    expect(browserWorkflowModule).toContain("Record internal review");
    expect(browserWorkflowModule).toContain(
      '"APPROVED_FOR_INTERNAL_USE",',
    );
    expect(browserWorkflowModule).not.toContain("Approved For Internal Use");
    expect(browserWorkflowModule).toContain(
      'getByText("PROPOSAL_EXPLANATION", { exact: true })',
    );
    expect(browserWorkflowModule).toContain(
      'getByText("CLIENT_READY_PUBLICATION", { exact: true })',
    );
    expect(browserWorkflowModule).toContain('reviewState = "approved"');
    expect(browserWorkflowModule).toContain('reviewState = "reviewable"');
    expect(browserWorkflowModule).toContain(
      "advisory-proposal-builder-live.png",
    );
    expect(browserWorkflowModule).not.toContain(
      "advisory-proposal-simulation-live.png",
    );
    expect(browserWorkflowModule).not.toContain("#simulation");
    expect(browserWorkflowModule).toContain(
      "advisory-suitability-review-live.png",
    );
    expect(browserWorkflowModule).toContain("advisory-risk-impact-live.png");
    expect(browserWorkflowModule).toContain("advisory-approval-queue-live.png");
    expect(browserWorkflowModule).toContain("Discussion pack review");
    expect(browserWorkflowModule).toContain("Client meeting preparation");
    expect(browserWorkflowModule).toContain("Client-discussion checklist");
    expect(browserWorkflowModule).toContain("Refresh discussion pack");
    expect(browserWorkflowModule).toContain("Current version available");
    expect(browserWorkflowModule).toContain(
      "proposal-discussion-pack-review.v1",
    );
    expect(browserWorkflowModule).toContain(
      "source-confirmed-empty-window",
    );
    expect(browserWorkflowModule).toContain(
      "selected-current-version-through-gateway",
    );
    expect(browserWorkflowModule).toContain(
      "advisory-client-discussion-pack-live.png",
    );
    expect(browserWorkflowModule).toContain(
      "advisory-implementation-status-live.png",
    );
    expect(browserWorkflowModule).toContain(
      "portfolio-book-and-workspace-evaluation-through-gateway",
    );
    expect(browserWorkflowModule).toContain(
      "advisor-cockpit-actions-through-gateway",
    );
    expect(browserWorkflowModule).toContain("Proposal lifecycle counts");
    expect(browserWorkflowModule).toContain('title: "Risk and Impact"');
    expect(browserWorkflowModule).toContain("Suitability review counts");
    expect(browserWorkflowModule).toContain("Adviser decision worklist");
    expect(runbook).toContain("advisoryJourneyChecks");
    expect(runbook).toContain(
      "Advisory Overview, Client Context, Advisor Cockpit, Opportunities and Ideas",
    );
    expect(runbook).toContain("they do not promote new backend capability");
    expect(runbook).toContain("records review-action, feedback, and bounded");
    expect(runbook).toContain("does not expose conversion-intent identifiers");
    expect(browserWorkflowModule).toContain("Record advisor review");
    expect(browserWorkflowModule).toContain("Request discussion pack");
    expect(browserWorkflowModule).toContain("Advisor review confirmed");
    expect(browserWorkflowModule).toContain(
      "Discussion-pack request confirmed",
    );
    expect(browserWorkflowModule).toContain("Prepare advisor memo");
    expect(browserWorkflowModule).toContain("Advisor memo confirmed");
    expect(browserWorkflowModule).toContain("Record advisor review");
    expect(browserWorkflowModule).toContain("Request discussion material");
    expect(browserWorkflowModule).toContain("Request advisor commentary");
    expect(browserWorkflowModule).toContain("Evidence aligned");
    expect(browserWorkflowModule).toContain("source-confirmed-advisor-use");
    expect(browserWorkflowModule).toContain("panel: panelId");
    expect(browserWorkflowModule).toContain(
      'return assuranceState === "ready" ? "demo_ready" : "truthfully_degraded"',
    );
    expect(browserWorkflowModule).toContain(
      "screenshotState = classifyPerformanceEvidenceScreenshotState(assuranceState)",
    );
    expect(browserWorkflowModule).toContain("state: screenshotState");
    expect(browserWorkflowModule).toContain("path: target");
    expect(evidenceWriter).toContain("SHOT-INDEX.md");
    expect(script).toContain("writeShotIndex");
    expect(runbook).toContain("ScreenshotDirectory");
    expect(runbook).toContain("structured screenshot evidence");
    expect(runbook).toContain("SHOT-INDEX.md");
    expect(runbook).toContain("workflowPackChecks");
    expect(runbook).toContain("supportabilityMatrix");
    expect(runbook).toContain("registered versus classified panel counts");
    expect(runbook).toContain("ACCEPT`, `REVISE`, and");
  });
});
