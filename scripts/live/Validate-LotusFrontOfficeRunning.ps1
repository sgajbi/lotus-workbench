[CmdletBinding()]
param(
  [string]$ProjectsRoot,
  [string]$RuntimeHolder = $env:LOTUS_CANONICAL_RUNTIME_HOLDER,
  [string]$WorkbenchRepoPath,
  [string]$PortfolioId = 'PB_SG_GLOBAL_BAL_001',
  [string]$BenchmarkCode = 'BMK_PB_GLOBAL_BALANCED_60_40',
  [string]$StartDate = '2025-03-31',
  [string]$AsOfDate = '2026-04-10',
  [string]$ScreenshotDirectory = '',
  [string]$CanonicalEvidenceDirectory = '',
  [string]$IdeaCandidateSeedEvidencePath = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if ($WorkbenchRepoPath -and [IO.Path]::GetFullPath($WorkbenchRepoPath) -ne $repoRoot) {
  throw 'Selected Workbench checkout does not match the executing script.'
}
$WorkbenchRepoPath = $repoRoot
Import-Module (Join-Path $PSScriptRoot 'CanonicalWorkspace.psm1') -Force
$ProjectsRoot = Resolve-CanonicalWorkspaceRoot -ProjectsRoot $ProjectsRoot -WorkbenchRepoPath $repoRoot
Import-Module (Join-Path $ProjectsRoot 'lotus-platform/automation/CanonicalRuntimeReservation.psm1')
Import-Module (Join-Path $PSScriptRoot 'CanonicalRunningValidation.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'CanonicalIdeaEvidence.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'CanonicalEvidencePublication.psm1') -Force

$operation = Enter-CanonicalRuntimeOperation -ProjectsRoot $ProjectsRoot -Holder $RuntimeHolder -WorkbenchRepoPath $repoRoot
$outcome = 'failure'
$receipt = $null
$receiptPath = ''
try {
  Invoke-CanonicalReservation -Action preflight-operation -ProjectsRoot $ProjectsRoot -Holder $RuntimeHolder `
    -OperationToken $operation.Token -WorkbenchRepoPath $repoRoot | Out-Null
  $evidenceRoot = if (-not $CanonicalEvidenceDirectory) { Join-Path $repoRoot 'output/canonical-front-office' }
    elseif ([IO.Path]::IsPathRooted($CanonicalEvidenceDirectory)) { $CanonicalEvidenceDirectory }
    else { Join-Path $repoRoot $CanonicalEvidenceDirectory }
  $seedPath = if ($IdeaCandidateSeedEvidencePath) { $IdeaCandidateSeedEvidencePath }
    else { Join-Path $evidenceRoot 'idea-candidate-seed-evidence.json' }
  $runRoot = Join-Path $evidenceRoot ('running-validation-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $runRoot -Force | Out-Null
  $sourceScript = Join-Path $PSScriptRoot 'validation/mainline-source-provenance.mjs'
  $sourcePath = Join-Path $runRoot 'mainline-source-provenance.json'
  $receipt = [ordered]@{
    schemaVersion = 'lotus-workbench.running-stack-validation.v1'
    status = 'failure'; phase = 'source-preflight'; validationProfile = 'full'; excludedProofs = @()
    evidenceClass = 'local_runtime_validation'; startedAtUtc = [DateTime]::UtcNow.ToString('o')
    sourceManifestPath = $sourcePath; sourceManifestSha256 = $null
    retainedSeedPath = $seedPath; retainedSeedSha256 = $null; idea = $null
  }
  $receiptPath = Join-Path $runRoot 'running-stack-validation.json'
  $receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $receiptPath -Encoding UTF8
  & node $sourceScript --projects-root $ProjectsRoot --workbench-repo-path $repoRoot --output $sourcePath
  if ($LASTEXITCODE -ne 0) { throw 'Running validation current mainline source preflight failed.' }
  $manifest = Get-Content -LiteralPath $sourcePath -Raw | ConvertFrom-Json
  $sourceHash = Get-CanonicalRunningEvidenceHash -Path $sourcePath
  $receipt.sourceManifestSha256 = $sourceHash
  $receipt.phase = 'retained-seed-preflight'
  $seed = Read-IdeaCandidateSeedEvidence -Path $seedPath -PortfolioId $PortfolioId -AsOfDate $AsOfDate
  $seedHash = Get-CanonicalRunningEvidenceHash -Path $seedPath
  $receipt.retainedSeedSha256 = $seedHash
  $receipt.phase = 'idea-runtime-preflight'
  $identity = Read-CanonicalRunningIdeaIdentity -Manifest $manifest -Operation $operation -Seed $seed `
    -IdeaRepoPath (Join-Path $ProjectsRoot 'lotus-idea')
  $receipt.idea = $identity
  $publishedBrowserDirectory = if (-not $ScreenshotDirectory) { Join-Path $repoRoot 'output/playwright/live-canonical' }
    elseif ([IO.Path]::IsPathRooted($ScreenshotDirectory)) { $ScreenshotDirectory }
    else { Join-Path $repoRoot $ScreenshotDirectory }
  $stagedBrowserDirectory = New-CanonicalEvidencePublicationWorkspace -PublishedDirectory $publishedBrowserDirectory -Stage
  $validationArguments = @{
    ProjectsRoot = $ProjectsRoot; RuntimeHolder = $RuntimeHolder; WorkbenchRepoPath = $repoRoot
    RuntimeOperationToken = $operation.Token; RuntimeOperationFence = $operation.Lock
    PortfolioId = $PortfolioId; BenchmarkCode = $BenchmarkCode; StartDate = $StartDate; AsOfDate = $AsOfDate
    CanonicalEvidenceDirectory = $evidenceRoot; IdeaCandidateSeedEvidencePath = $seedPath
    ValidationProfile = 'full'; MainlineSourceProvenancePath = $sourcePath
    ExpectedIdeaCommitSha = $identity.commitSha; ExpectedIdeaBranch = $identity.branch; ExpectedIdeaRunId = $identity.runId
    ScreenshotDirectory = $stagedBrowserDirectory
  }
  Assert-CanonicalRuntimeOperationFence -ProjectsRoot $ProjectsRoot -OperationToken $operation.Token -Fence $operation.Lock
  Invoke-CanonicalReservation -Action preflight-operation -ProjectsRoot $ProjectsRoot -Holder $RuntimeHolder `
    -OperationToken $operation.Token -WorkbenchRepoPath $repoRoot | Out-Null
  $receipt.phase = 'full-validation'
  Invoke-WithCanonicalRunningCapability -Action {
    & (Join-Path $PSScriptRoot 'Validate-LotusFrontOfficeCanonical.ps1') @validationArguments
    if ($LASTEXITCODE -ne 0) { throw "Running full canonical validation failed with exit code $LASTEXITCODE." }
  }
  $receipt.phase = 'post-validation-preflight'
  $afterSourcePath = Join-Path $runRoot 'mainline-source-provenance-after.json'
  & node $sourceScript --projects-root $ProjectsRoot --workbench-repo-path $repoRoot --output $afterSourcePath
  if ($LASTEXITCODE -ne 0 -or (Get-CanonicalRunningEvidenceHash -Path $afterSourcePath) -cne $sourceHash -or
      (Get-CanonicalRunningEvidenceHash -Path $seedPath) -cne $seedHash) {
    throw 'Running validation source or retained seed evidence changed during validation.'
  }
  $afterIdentity = Read-CanonicalRunningIdeaIdentity -Manifest $manifest -Operation $operation -Seed $seed `
    -IdeaRepoPath (Join-Path $ProjectsRoot 'lotus-idea')
  if (($afterIdentity | ConvertTo-Json -Compress) -cne ($identity | ConvertTo-Json -Compress)) {
    throw 'Running validation Idea runtime changed during validation.'
  }
  Assert-CanonicalRuntimeOperationFence -ProjectsRoot $ProjectsRoot -OperationToken $operation.Token -Fence $operation.Lock
  Invoke-CanonicalReservation -Action preflight-operation -ProjectsRoot $ProjectsRoot -Holder $RuntimeHolder `
    -OperationToken $operation.Token -WorkbenchRepoPath $repoRoot | Out-Null
  $outcome = 'success'
} finally {
  try {
    if ($receipt) {
      $receipt.endedAtUtc = [DateTime]::UtcNow.ToString('o')
      $receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $receiptPath -Encoding UTF8
    }
  } catch {
    $outcome = 'failure'
    throw
  } finally {
    Exit-CanonicalRuntimeOperation -Operation $operation -Outcome $outcome
  }
}
# Success is durable only after Platform has published the operation outcome.
Publish-CanonicalBrowserEvidence -StagedDirectory $stagedBrowserDirectory -PublishedDirectory $publishedBrowserDirectory
$receipt.status = 'success'
$receipt.phase = 'complete'
$receipt.endedAtUtc = [DateTime]::UtcNow.ToString('o')
$receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath "$receiptPath.pending" -Encoding UTF8
Move-Item -LiteralPath "$receiptPath.pending" -Destination $receiptPath -Force
Write-Host "Running-stack full validation evidence: $receiptPath"
