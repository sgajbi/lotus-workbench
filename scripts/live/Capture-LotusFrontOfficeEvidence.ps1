[CmdletBinding()]
param(
  [string]$PortfolioId = "PB_SG_GLOBAL_BAL_001",
  [string]$BenchmarkCode = "BMK_PB_GLOBAL_BALANCED_60_40",
  [string]$AsOfDate = "2026-04-10",
  [string]$OutputDirectory = "",
  [int]$LogTail = 200,
  [string[]]$ForbiddenEvidencePatterns = @("DEMO_ADV_USD_001"),
  [switch]$SkipScreenshots
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$captureStartedAt = (Get-Date).ToUniversalTime().ToString("o")
$validationSummaryPath = Join-Path $repoRoot "output\playwright\live-canonical\live-validation-summary.json"
$canonicalCallerContextHeaders = @{
  "X-Actor-Id" = "workbench-system"
  "X-Tenant-Id" = "tenant-sg"
  "X-Region" = "APAC"
}

function Assert-CanonicalDemoReadyValidationSummary {
  param(
    [Parameter(Mandatory)][string]$SummaryPath,
    [Parameter(Mandatory)][string]$ExpectedPortfolioId,
    [Parameter(Mandatory)][string]$ExpectedBenchmarkCode,
    [Parameter(Mandatory)][string]$ExpectedAsOfDate,
    [Parameter(Mandatory)][object]$CurrentIdeaVersion
  )

  if (-not (Test-Path -LiteralPath $SummaryPath -PathType Leaf)) {
    throw "Canonical full validation summary is missing: $SummaryPath"
  }
  $summaryBytes = [System.IO.File]::ReadAllBytes($SummaryPath)
  $summary = [System.Text.Encoding]::UTF8.GetString($summaryBytes) | ConvertFrom-Json
  if ($summary.validationProfile -isnot [string] -or $summary.validationProfile -cne 'full') {
    throw 'Observability evidence requires a full-profile canonical validation summary.'
  }
  if (
    $summary.excludedProofs -isnot [System.Object[]] -or
    $summary.excludedProofs.Count -ne 0
  ) {
    throw 'Observability evidence refuses a validation summary with excluded proofs.'
  }
  if (
    $summary.portfolioId -isnot [string] -or
    $summary.portfolioId -cne $ExpectedPortfolioId -or
    $summary.benchmarkCode -isnot [string] -or
    $summary.benchmarkCode -cne $ExpectedBenchmarkCode
  ) {
    throw 'Canonical validation summary does not match the requested portfolio and benchmark.'
  }
  if (
    $summary.canonicalContract.canonicalAsOfDate -isnot [string] -or
    $summary.canonicalContract.canonicalAsOfDate -cne $ExpectedAsOfDate
  ) {
    throw 'Canonical validation summary does not match the requested as-of date.'
  }
  $probe = $summary.ideaCapacityProbe
  if ($null -eq $probe) {
    throw 'Canonical validation summary does not contain Idea integration evidence.'
  }
  $freshProof = (
    $probe.resourcePosture -is [string] -and
    $probe.resourcePosture -ceq 'fresh_authorized_submission' -and
    $probe.capacityWorkloadAccepted -is [bool] -and
    $probe.capacityWorkloadAccepted -eq $true -and
    $probe.retainedAcceptedSubmissionVerified -is [bool] -and
    $probe.retainedAcceptedSubmissionVerified -eq $false -and
    $probe.PSObject.Properties.Name -notcontains 'ownerSourceAuthority' -and
    $probe.PSObject.Properties.Name -notcontains 'ownerSourceEventVersion' -and
    $probe.workloadFileName -is [string] -and
    -not [string]::IsNullOrWhiteSpace($probe.workloadFileName) -and
    $probe.workloadSha256 -is [string] -and
    $probe.workloadSha256 -cmatch '^[a-f0-9]{64}$'
  )
  $ownerSourceEventVersionIsInteger = (
    $null -ne $probe.ownerSourceEventVersion -and
    @(
      [sbyte], [byte], [int16], [uint16], [int32], [uint32], [int64], [uint64]
    ) -contains $probe.ownerSourceEventVersion.GetType()
  )
  $retainedProof = (
    $probe.resourcePosture -is [string] -and
    $probe.resourcePosture -ceq 'retained_accepted_submission' -and
    $probe.capacityWorkloadAccepted -is [bool] -and
    $probe.capacityWorkloadAccepted -eq $false -and
    $probe.retainedAcceptedSubmissionVerified -is [bool] -and
    $probe.retainedAcceptedSubmissionVerified -eq $true -and
    $probe.ownerSourceAuthority -is [string] -and
    $probe.ownerSourceAuthority -ceq 'lotus-advise' -and
    $ownerSourceEventVersionIsInteger -and
    $probe.ownerSourceEventVersion -gt 0 -and
    $probe.ownerSourceEventVersion -le 9007199254740991 -and
    $probe.PSObject.Properties.Name -notcontains 'workloadFileName' -and
    $probe.PSObject.Properties.Name -notcontains 'workloadSha256'
  )
  if (
    $probe.schemaVersion -isnot [string] -or
    $probe.schemaVersion -cne 'lotus-workbench.idea-capacity-probe-evidence.v2' -or
    $probe.repository -isnot [string] -or
    $probe.repository -cne 'lotus-idea' -or
    $probe.proofScope -isnot [string] -or
    $probe.proofScope -cne 'governed_downstream_resource_state' -or
    $probe.claimPosture -isnot [string] -or
    $probe.claimPosture -cne 'selected_resource_state_not_capacity_evidence' -or
    $probe.syntheticResource -isnot [bool] -or
    $probe.syntheticResource -ne $false -or
    $probe.resourceFileName -isnot [string] -or
    [string]::IsNullOrWhiteSpace($probe.resourceFileName) -or
    $probe.posture -isnot [string] -or
    $probe.posture -cne 'accepted_non_certifying' -or
    $probe.presentationBackedResource -isnot [bool] -or
    $probe.presentationBackedResource -ne $true -or
    $probe.integrationProofAccepted -isnot [bool] -or
    $probe.integrationProofAccepted -ne $true -or
    $probe.productionCapacityCertified -isnot [bool] -or
    $probe.productionCapacityCertified -ne $false -or
    $probe.supportedFeaturePromoted -isnot [bool] -or
    $probe.supportedFeaturePromoted -ne $false -or
    $probe.resourceSha256 -isnot [string] -or
    $probe.resourceSha256 -cnotmatch '^[a-f0-9]{64}$' -or
    -not ($freshProof -xor $retainedProof)
  ) {
    throw 'Canonical validation summary does not contain accepted presentation-backed Idea integration evidence.'
  }
  $runtimeProvenance = @{
    commitSha = $CurrentIdeaVersion.build.gitCommitSha
    branch = $CurrentIdeaVersion.build.gitBranch
    runId = $CurrentIdeaVersion.build.ciRunId
  }
  foreach ($field in @('commitSha', 'branch', 'runId')) {
    $probeValue = $probe.$field
    if (
      $runtimeProvenance[$field] -isnot [string] -or
      [string]::IsNullOrWhiteSpace($runtimeProvenance[$field]) -or
      $probeValue -isnot [string] -or
      $probeValue -cne $runtimeProvenance[$field]
    ) {
      throw "Canonical validation summary does not match current Idea runtime $field."
    }
  }
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    $digest = -join ($sha256.ComputeHash($summaryBytes) | ForEach-Object { $_.ToString('x2') })
  } finally {
    $sha256.Dispose()
  }
  return [pscustomobject]@{ Summary = $summary; Sha256 = $digest }
}

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $OutputDirectory = Join-Path $repoRoot "output\observability-live\$timestamp"
}

$currentIdeaVersion = Invoke-RestMethod -Uri "http://127.0.0.1:8330/version" -TimeoutSec 30
$validatedSummaryEvidence = Assert-CanonicalDemoReadyValidationSummary `
  -SummaryPath $validationSummaryPath `
  -ExpectedPortfolioId $PortfolioId `
  -ExpectedBenchmarkCode $BenchmarkCode `
  -ExpectedAsOfDate $AsOfDate `
  -CurrentIdeaVersion $currentIdeaVersion
$validatedSummary = $validatedSummaryEvidence.Summary
$validationSummarySha256 = $validatedSummaryEvidence.Sha256

$apiDirectory = Join-Path $OutputDirectory "api"
$logDirectory = Join-Path $OutputDirectory "logs"
$metricsDirectory = Join-Path $OutputDirectory "metrics"
$screenshotsDirectory = Join-Path $OutputDirectory "screenshots"

foreach ($directory in @($OutputDirectory, $apiDirectory, $logDirectory, $metricsDirectory, $screenshotsDirectory)) {
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
}

function ConvertTo-SafeFileName {
  param([string]$Value)

  return ($Value -replace "[^A-Za-z0-9_.-]", "-").Trim("-")
}

function Resolve-ArtifactPath {
  param([string]$RelativePath)

  return Join-Path $OutputDirectory $RelativePath
}

function Write-HttpArtifact {
  param(
    [string]$Name,
    [string]$Url,
    [string]$RelativePath,
    [hashtable]$Headers = @{}
  )

  $target = Resolve-ArtifactPath $RelativePath
  $record = [ordered]@{
    name = $Name
    url = $Url
    path = $target
    status = "unknown"
    capturedAt = (Get-Date).ToString("o")
  }

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 45 -Headers $Headers
    $contentType = ($response.Headers["Content-Type"] -join ",")
    Set-Content -Path $target -Value $response.Content -Encoding UTF8
    $record.status = $response.StatusCode
    $record.contentType = $contentType
    $record.bytes = (Get-Item $target).Length
  } catch {
    $record.status = "error"
    $record.error = $_.Exception.Message
    Set-Content -Path $target -Value $record.error -Encoding UTF8
  }

  return [pscustomobject]$record
}

function Write-ContainerLogArtifact {
  param(
    [string]$ContainerName,
    [int]$Tail,
    [string]$Since
  )

  $safeName = ConvertTo-SafeFileName $ContainerName
  $target = Join-Path $logDirectory "$safeName.log"
  $record = [ordered]@{
    container = $ContainerName
    path = $target
    tail = $Tail
    since = $Since
    status = "unknown"
    capturedAt = (Get-Date).ToString("o")
  }

  $exists = docker ps --format "{{.Names}}" | Where-Object { $_ -eq $ContainerName }
  if (-not $exists) {
    $record.status = "missing"
    Set-Content -Path $target -Value "Container not running: $ContainerName" -Encoding UTF8
    return [pscustomobject]$record
  }

  try {
    $cmdTarget = $target.Replace('"', '\"')
    & cmd.exe /d /c "docker logs --since ""$Since"" --tail $Tail $ContainerName > ""$cmdTarget"" 2>&1"
    if ($LASTEXITCODE -ne 0) {
      $record.status = "error"
      $record.error = "docker logs exited with code $LASTEXITCODE"
    } else {
      $record.status = "captured"
    }
    $record.bytes = (Get-Item $target).Length
  } catch {
    $record.status = "error"
    $record.error = $_.Exception.Message
    Set-Content -Path $target -Value $record.error -Encoding UTF8
  }

  return [pscustomobject]$record
}

function Assert-EvidenceDoesNotContainForbiddenPatterns {
  param(
    [string]$RootDirectory,
    [string[]]$Patterns
  )

  foreach ($pattern in $Patterns) {
    if ([string]::IsNullOrWhiteSpace($pattern)) {
      continue
    }

    $matches = Get-ChildItem -Path $RootDirectory -Recurse -File |
      Where-Object { $_.FullName -notlike "*\observability-evidence-manifest.json" } |
      Select-String -Pattern $pattern -SimpleMatch -List
    if ($matches) {
      $relativeMatches = $matches |
        Select-Object -First 10 |
        ForEach-Object { $_.Path.Replace("$RootDirectory\", "") }
      throw "Evidence pack contains forbidden pattern '$pattern' in: $($relativeMatches -join ', ')"
    }
  }
}

$canonicalHosts = @(
  "workbench.dev.lotus",
  "gateway.dev.lotus",
  "manage.dev.lotus",
  "report.dev.lotus",
  "archive.dev.lotus",
  "render.dev.lotus",
  "performance.dev.lotus",
  "risk.dev.lotus",
  "advise.dev.lotus",
  "ai.dev.lotus",
  "core-query.dev.lotus",
  "core-control.dev.lotus",
  "core-ingestion.dev.lotus"
)

$dns = foreach ($hostName in $canonicalHosts) {
  try {
    $resolved = Resolve-DnsName -Name $hostName -ErrorAction Stop | Select-Object -First 1
    [pscustomobject]@{
      host = $hostName
      status = "ok"
      address = $resolved.IPAddress
    }
  } catch {
    [pscustomobject]@{
      host = $hostName
      status = "error"
      error = $_.Exception.Message
    }
  }
}

$dns | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $OutputDirectory "dns.json") -Encoding UTF8

docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" |
  Set-Content -Path (Join-Path $OutputDirectory "docker-ps.txt") -Encoding UTF8

docker ps --format "{{json .}}" |
  ForEach-Object { if (-not [string]::IsNullOrWhiteSpace($_)) { $_ | ConvertFrom-Json } } |
  ConvertTo-Json -Depth 8 |
  Set-Content -Path (Join-Path $OutputDirectory "docker-ps.json") -Encoding UTF8

$apiChecks = @()
$apiChecks += Write-HttpArtifact "gateway-ready" "http://gateway.dev.lotus/health/ready" "api\gateway-ready.json"
$apiChecks += Write-HttpArtifact "workbench-performance-route" "http://workbench.dev.lotus/performance?portfolioId=$PortfolioId&mode=evidence&benchmark=$BenchmarkCode" "api\workbench-performance-route.html"
$apiChecks += Write-HttpArtifact "manage-ready" "http://manage.dev.lotus/health/ready" "api\manage-ready.json"
$apiChecks += Write-HttpArtifact "report-ready" "http://report.dev.lotus/health/ready" "api\report-ready.json"
$apiChecks += Write-HttpArtifact "archive-ready" "http://archive.dev.lotus/health/ready" "api\archive-ready.json"
$apiChecks += Write-HttpArtifact "render-ready" "http://render.dev.lotus/health/ready" "api\render-ready.json"
$apiChecks += Write-HttpArtifact "gateway-platform-capabilities" "http://gateway.dev.lotus/api/v1/platform/capabilities" "api\gateway-platform-capabilities.json" -Headers $canonicalCallerContextHeaders
$apiChecks += Write-HttpArtifact "gateway-workbench-overview" "http://gateway.dev.lotus/api/v1/workbench/$PortfolioId/overview" "api\gateway-workbench-overview.json" -Headers $canonicalCallerContextHeaders
$apiChecks += Write-HttpArtifact "gateway-performance-summary" "http://gateway.dev.lotus/api/v1/workbench/$PortfolioId/performance/summary?period=YTD&chart_frequency=monthly&detail_basis=NET&contribution_dimension=asset_class&attribution_dimension=asset_class&benchmark_code=$BenchmarkCode&report_end_date=$AsOfDate" "api\gateway-performance-summary.json" -Headers $canonicalCallerContextHeaders
$apiChecks += Write-HttpArtifact "gateway-risk-summary" "http://gateway.dev.lotus/api/v1/workbench/$PortfolioId/risk/summary?period=YTD&detail_basis=NET&benchmark_code=$BenchmarkCode&as_of_date=$AsOfDate" "api\gateway-risk-summary.json" -Headers $canonicalCallerContextHeaders
$apiChecks += Write-HttpArtifact "gateway-advisor-brief" "http://gateway.dev.lotus/api/v1/workbench/$PortfolioId/performance/advisor-brief?period=YTD&chart_frequency=monthly&detail_basis=NET&contribution_dimension=asset_class&attribution_dimension=asset_class&benchmark_code=$BenchmarkCode&report_end_date=$AsOfDate" "api\gateway-advisor-brief.json" -Headers $canonicalCallerContextHeaders
$apiChecks += Write-HttpArtifact "manage-supportability-summary" "http://manage.dev.lotus/api/v1/rebalance/supportability/summary" "api\manage-supportability-summary.json"
$apiChecks += Write-HttpArtifact "report-integration-capabilities" "http://report.dev.lotus/integration/capabilities?consumerSystem=lotus-gateway&tenantId=default" "api\report-integration-capabilities.json"

$metricChecks = @()
$metricChecks += Write-HttpArtifact "workbench-prometheus-metrics" "http://workbench.dev.lotus/api/metrics" "metrics\workbench-api-metrics.prom"
$metricChecks += Write-HttpArtifact "prometheus-targets" "http://localhost:9190/api/v1/targets" "metrics\prometheus-targets.json"
$metricChecks += Write-HttpArtifact "prometheus-up-query" "http://localhost:9190/api/v1/query?query=up" "metrics\prometheus-up-query.json"
$metricChecks += Write-HttpArtifact "grafana-health" "http://localhost:3300/api/health" "metrics\grafana-health.json"

$containers = @(
  "lotus-workbench-lotus-workbench-1",
  "lotus-gateway-lotus-gateway-1",
  "lotus-manage-lotus-manage-1",
  "lotus-report",
  "lotus-archive-lotus-archive-1",
  "lotus-render-lotus-render-1",
  "lotus-risk-lotus-risk-1",
  "performance-analytics",
  "lotus-ai-lotus-ai-1",
  "lotus-core-app-local-query_control_plane_service-1",
  "lotus-core-app-local-valuation_orchestrator_service-1",
  "lotus-core-app-local-prometheus-1",
  "lotus-core-app-local-grafana-1"
)
$coreRepoPath = Join-Path (Split-Path -Parent $repoRoot) "lotus-core"
$derivedStateIdentity = & (Join-Path $PSScriptRoot "Resolve-CoreDerivedStateContainer.ps1") -CoreRepoPath $coreRepoPath

$screenshotManifest = $null
if (-not $SkipScreenshots) {
  $screenshotScript = Join-Path $PSScriptRoot "capture-observability-screenshots.mjs"
  & node $screenshotScript --output-dir $OutputDirectory --portfolio-id $PortfolioId
  if ($LASTEXITCODE -ne 0) {
    throw "Observability screenshot capture failed with exit code $LASTEXITCODE."
  }
  $screenshotManifestPath = Join-Path $OutputDirectory "screenshots-manifest.json"
  if (Test-Path $screenshotManifestPath) {
    $screenshotManifest = Get-Content $screenshotManifestPath -Raw | ConvertFrom-Json
  }
}

$logArtifacts = foreach ($container in $containers) {
  Write-ContainerLogArtifact -ContainerName $container -Tail $LogTail -Since $captureStartedAt
}
$derivedStateLog = & (Join-Path $PSScriptRoot "Capture-CoreDerivedStateLog.ps1") `
  -CoreRepoPath $coreRepoPath -LogDirectory $logDirectory `
  -ExpectedContainerId $derivedStateIdentity.ContainerId -Since $captureStartedAt -Tail $LogTail
$logArtifacts = @($logArtifacts) + @($derivedStateLog)

$manifest = [ordered]@{
  generatedAt = (Get-Date).ToString("o")
  portfolioId = $PortfolioId
  benchmarkCode = $BenchmarkCode
  outputDirectory = $OutputDirectory
  dns = $dns
  validation = [ordered]@{
    requiredBeforeDemo = $true
    summaryPath = $validationSummaryPath
    summaryExists = $true
    summaryAccepted = $true
    summarySha256 = $validationSummarySha256
    profile = $validatedSummary.validationProfile
    capacityEvidenceStatus = $validatedSummary.ideaCapacityProbe.posture
  }
  apiChecks = $apiChecks
  metricChecks = $metricChecks
  logArtifacts = $logArtifacts
  screenshots = $screenshotManifest
  notes = @(
    "Artifacts under output/ are local evidence and should not be committed by default.",
    "Run npm run live:stack:up:validate before treating screenshots as demo-ready; this manifest records whether the latest full validation summary was present at capture time.",
    "Use this pack to demonstrate readiness, API behavior, metrics, logs, and dashboard investigation posture."
  )
}

$manifestPath = Join-Path $OutputDirectory "observability-evidence-manifest.json"
$manifest | ConvertTo-Json -Depth 12 | Set-Content -Path $manifestPath -Encoding UTF8

Assert-EvidenceDoesNotContainForbiddenPatterns -RootDirectory $OutputDirectory -Patterns $ForbiddenEvidencePatterns

$readme = @'
# Lotus Front-Office Observability Evidence

- Generated: __GENERATED_AT__
- Portfolio: __PORTFOLIO_ID__
- Benchmark: __BENCHMARK_CODE__
- Manifest: __MANIFEST_PATH__
- Paired validation summary: __VALIDATION_SUMMARY_PATH__

## Contents

- dns.json: canonical hostname resolution evidence
- docker-ps.txt and docker-ps.json: live container inventory and health status
- api/: readiness, capability, and representative Gateway API outputs
- metrics/: Workbench Prometheus metrics plus Prometheus/Grafana API samples
- logs/: bounded container log tails for investigation walkthroughs
- screenshots/: Workbench, Prometheus, and Grafana screenshots when screenshot capture is enabled

## Operator Notes

Run npm run live:stack:up:validate before using screenshots as demo-ready evidence. This evidence pack is
for operational investigation and non-functional capability demonstration; it complements the
canonical live validation summary rather than replacing it. Metric and dashboard HTTP samples are
stored under metrics/ and indexed separately from application API checks in the manifest.
'@

$readme = $readme.
  Replace("__GENERATED_AT__", $manifest.generatedAt).
  Replace("__PORTFOLIO_ID__", $PortfolioId).
  Replace("__BENCHMARK_CODE__", $BenchmarkCode).
  Replace("__MANIFEST_PATH__", $manifestPath).
  Replace("__VALIDATION_SUMMARY_PATH__", $validationSummaryPath)

Set-Content -Path (Join-Path $OutputDirectory "README.md") -Value $readme -Encoding UTF8

Write-Host "Observability evidence captured: $OutputDirectory"
Write-Host "Manifest: $manifestPath"
