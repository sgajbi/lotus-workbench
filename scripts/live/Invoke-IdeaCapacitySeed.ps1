[CmdletBinding()]
param(
  [string]$ProjectsRoot = "",
  [string]$IdeaBaseUrl = "http://127.0.0.1:8330",
  [Parameter(Mandatory = $true)][string]$AsOfDate,
  [Parameter(Mandatory = $true)][string]$SeededAtUtc,
  [Parameter(Mandatory = $true)][string]$RunId,
  [Parameter(Mandatory = $true)][string]$ExpectedCommitSha,
  [Parameter(Mandatory = $true)][string]$ExpectedBranch,
  [Parameter(Mandatory = $true)][string]$EvidenceDirectory
)

$ErrorActionPreference = "Stop"
$selectedWorkbench = (Resolve-Path (Join-Path $PSScriptRoot '../..')).ProviderPath
Import-Module (Join-Path $PSScriptRoot 'CanonicalWorkspace.psm1') -Force
$ProjectsRoot = Resolve-CanonicalWorkspaceRoot -ProjectsRoot $ProjectsRoot -WorkbenchRepoPath $selectedWorkbench
$ideaRepo = Join-Path $ProjectsRoot "lotus-idea"
$workbenchRepo = Join-Path $ProjectsRoot "lotus-workbench"
$python = Join-Path $ideaRepo ".venv\Scripts\python.exe"
$seedScript = Join-Path $ideaRepo "scripts\seed_downstream_capacity_resource.py"
$workloadScript = Join-Path $ideaRepo "scripts\run_service_capacity_workload.py"
$evidencePath = Join-Path $EvidenceDirectory "idea-capacity-seed-evidence.json"
$rawArtifactDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("lotus-workbench-idea-capacity-" + [guid]::NewGuid().ToString("N"))
$manifestPath = Join-Path $rawArtifactDirectory "idea-capacity-seed-manifest.json"
$workloadPath = Join-Path $rawArtifactDirectory "idea-capacity-seed-workload.json"

if (-not (Test-Path $python)) {
  throw "Lotus Idea repository Python was not found: $python"
}
if (-not (Test-Path $seedScript)) {
  throw "Lotus Idea capacity seed producer was not found: $seedScript"
}
if (-not (Test-Path $workloadScript)) {
  throw "Lotus Idea capacity workload runner was not found: $workloadScript"
}

$version = Invoke-RestMethod -Uri "$IdeaBaseUrl/version" -TimeoutSec 30
$commitSha = [string]$version.build.gitCommitSha
$branch = [string]$version.build.gitBranch
$runtimeRunId = [string]$version.build.ciRunId
if ([string]::IsNullOrWhiteSpace($commitSha) -or [string]::IsNullOrWhiteSpace($branch) -or [string]::IsNullOrWhiteSpace($runtimeRunId)) {
  throw "Lotus Idea /version did not expose commit, branch, and run provenance."
}
$provenanceMismatches = @()
if ($commitSha -ne $ExpectedCommitSha) {
  $provenanceMismatches += "commit"
}
if ($branch -ne $ExpectedBranch) {
  $provenanceMismatches += "branch"
}
if ($runtimeRunId -ne $RunId) {
  $provenanceMismatches += "run"
}
if ($provenanceMismatches.Count -gt 0) {
  throw "Lotus Idea runtime provenance does not match the expected source identity: $($provenanceMismatches -join ', '). The targeted Idea build did not produce the requested identity."
}

New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $rawArtifactDirectory -Force | Out-Null
try {
$seedArguments = @(
  $seedScript,
  "--base-url", $IdeaBaseUrl,
  "--as-of-date", $AsOfDate,
  "--seeded-at-utc", $SeededAtUtc,
  "--commit-sha", $commitSha,
  "--branch", $branch,
  "--run-id", $RunId,
  "--confirmation", "SEED_SYNTHETIC_LOTUS_IDEA_CAPACITY_RESOURCE",
  "--output", $manifestPath
)
& $python @seedArguments
if ($LASTEXITCODE -ne 0) {
  throw "Lotus Idea capacity seed producer failed with exit code $LASTEXITCODE."
}

$workloadArguments = @(
  $workloadScript,
  "--base-url", $IdeaBaseUrl,
  "--environment-profile", "test",
  "--scenario", "downstream_submission",
  "--request-count", "1",
  "--concurrency", "1",
  "--allow-mutating-workflows",
  "--commit-sha", $commitSha,
  "--branch", $branch,
  "--run-id", $RunId,
  "--downstream-capacity-seed", $manifestPath,
  "--output", $workloadPath
)
& $python @workloadArguments
if ($LASTEXITCODE -ne 0) {
  throw "Lotus Idea capacity workload acceptance failed with exit code $LASTEXITCODE."
}

$validator = Join-Path $workbenchRepo "scripts\live\Validate-IdeaCapacitySeedEvidence.mjs"
& node $validator `
  --manifest $manifestPath `
  --workload $workloadPath `
  --output $evidencePath `
  --commit-sha $commitSha `
  --branch $branch `
  --run-id $RunId
if ($LASTEXITCODE -ne 0) {
  throw "Workbench Idea capacity seed evidence validation failed with exit code $LASTEXITCODE."
}
}
finally {
  Remove-Item -LiteralPath $rawArtifactDirectory -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Validated isolated Lotus Idea capacity seed evidence: $evidencePath"
