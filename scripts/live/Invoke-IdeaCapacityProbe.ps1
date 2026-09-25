[CmdletBinding()]
param(
  [string]$ProjectsRoot = "",
  [string]$IdeaBaseUrl = "http://127.0.0.1:8330",
  [Parameter(Mandatory = $true)][string]$CandidateEvidencePath,
  [Parameter(Mandatory = $true)][string]$RunId,
  [Parameter(Mandatory = $true)][string]$ExpectedCommitSha,
  [Parameter(Mandatory = $true)][string]$ExpectedBranch,
  [Parameter(Mandatory = $true)][string]$ExpectedCandidateId,
  [Parameter(Mandatory = $true)][string]$EvidenceDirectory
)

$ErrorActionPreference = "Stop"
$selectedWorkbench = (Resolve-Path (Join-Path $PSScriptRoot '../..')).ProviderPath
Import-Module (Join-Path $PSScriptRoot 'CanonicalWorkspace.psm1') -Force
$ProjectsRoot = Resolve-CanonicalWorkspaceRoot -ProjectsRoot $ProjectsRoot -WorkbenchRepoPath $selectedWorkbench
$ideaRepo = Join-Path $ProjectsRoot "lotus-idea"
$workbenchRepo = Join-Path $ProjectsRoot "lotus-workbench"
$python = Join-Path $ideaRepo ".venv\Scripts\python.exe"
$selectorScript = Join-Path $ideaRepo "scripts\select_downstream_capacity_resource.py"
$workloadScript = Join-Path $ideaRepo "scripts\run_service_capacity_workload.py"
$evidencePath = Join-Path $EvidenceDirectory "idea-capacity-probe-evidence.json"
$rawArtifactDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("lotus-workbench-idea-capacity-" + [guid]::NewGuid().ToString("N"))
$resourcePath = Join-Path $rawArtifactDirectory "idea-capacity-resource.json"
$workloadPath = Join-Path $rawArtifactDirectory "idea-capacity-probe-workload.json"

foreach ($requiredPath in @($python, $selectorScript, $workloadScript, $CandidateEvidencePath)) {
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "Required Lotus Idea capacity-probe input was not found: $requiredPath"
  }
}

$candidateEvidence = Get-Content -LiteralPath $CandidateEvidencePath -Raw | ConvertFrom-Json
if ([string]$candidateEvidence.schemaVersion -ne 'lotus-workbench.idea-candidate-seed-evidence.v4') {
  throw 'Lotus Idea capacity probe requires current canonical candidate evidence v4.'
}
$candidateId = [string]$candidateEvidence.candidateId
if ($candidateId -ne $ExpectedCandidateId) {
  throw 'Canonical candidate evidence does not match the expected browser candidate.'
}
$scope = $candidateEvidence.accessScope
$requiredCandidateValues = @(
  $candidateId,
  [string]$scope.tenantId,
  [string]$scope.bookId,
  [string]$scope.portfolioId,
  [string]$scope.clientId
)
if ($requiredCandidateValues.Where({ [string]::IsNullOrWhiteSpace($_) }).Count -gt 0) {
  throw 'Canonical candidate evidence is incomplete for the Idea capacity probe.'
}
$version = Invoke-RestMethod -Uri "$IdeaBaseUrl/version" -TimeoutSec 30
$commitSha = [string]$version.build.gitCommitSha
$branch = [string]$version.build.gitBranch
$runtimeRunId = [string]$version.build.ciRunId
if ([string]::IsNullOrWhiteSpace($commitSha) -or [string]::IsNullOrWhiteSpace($branch) -or [string]::IsNullOrWhiteSpace($runtimeRunId)) {
  throw "Lotus Idea /version did not expose commit, branch, and run provenance."
}
$provenanceMismatches = @()
if ($commitSha -ne $ExpectedCommitSha) { $provenanceMismatches += "commit" }
if ($branch -ne $ExpectedBranch) { $provenanceMismatches += "branch" }
if ($runtimeRunId -ne $RunId) { $provenanceMismatches += "run" }
if ($provenanceMismatches.Count -gt 0) {
  throw "Lotus Idea runtime provenance does not match the expected source identity: $($provenanceMismatches -join ', ')."
}

New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $rawArtifactDirectory -Force | Out-Null
try {
  $selectorArguments = @(
    $selectorScript,
    "--base-url", $IdeaBaseUrl,
    "--candidate-id", $candidateId,
    "--tenant-id", [string]$scope.tenantId,
    "--book-id", [string]$scope.bookId,
    "--portfolio-id", [string]$scope.portfolioId,
    "--client-id", [string]$scope.clientId,
    "--commit-sha", $commitSha,
    "--branch", $branch,
    "--run-id", $RunId,
    "--output", $resourcePath
  )
  & $python @selectorArguments
  if ($LASTEXITCODE -ne 0) {
    throw "Lotus Idea capacity resource selection failed with exit code $LASTEXITCODE."
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
    "--downstream-capacity-resource", $resourcePath,
    "--caller-tenant-id", [string]$scope.tenantId,
    "--caller-book-id", [string]$scope.bookId,
    "--caller-portfolio-id", [string]$scope.portfolioId,
    "--caller-client-id", [string]$scope.clientId,
    "--output", $workloadPath
  )
  & $python @workloadArguments
  if ($LASTEXITCODE -ne 0) {
    throw "Lotus Idea capacity probe was not accepted; workload exited $LASTEXITCODE."
  }

  $validator = Join-Path $workbenchRepo "scripts\live\Validate-IdeaCapacityProbeEvidence.mjs"
  & node $validator `
    --resource $resourcePath `
    --workload $workloadPath `
    --output $evidencePath `
    --commit-sha $commitSha `
    --branch $branch `
    --run-id $RunId `
    --candidate-id $ExpectedCandidateId
  if ($LASTEXITCODE -ne 0) {
    throw "Workbench Idea capacity probe evidence validation failed with exit code $LASTEXITCODE."
  }
} finally {
  Remove-Item -LiteralPath $rawArtifactDirectory -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Validated presentation-backed Lotus Idea capacity probe evidence: $evidencePath"
