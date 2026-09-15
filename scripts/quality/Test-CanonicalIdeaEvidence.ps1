[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Import-Module (Join-Path $repoRoot "scripts\live\CanonicalIdeaEvidence.psm1") -Force

$fixtureRoot = Join-Path `
  ([System.IO.Path]::GetTempPath()) `
  "lotus-workbench-idea-evidence-$([guid]::NewGuid().ToString('N'))"
$fixtureRoot = [System.IO.Path]::GetFullPath($fixtureRoot)
$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
if (-not $fixtureRoot.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to create Idea evidence fixtures outside the temporary directory."
}
New-Item -ItemType Directory -Path $fixtureRoot | Out-Null

$portfolioId = "PB_SG_GLOBAL_BAL_001"
$asOfDate = "2026-04-10"
$candidateId = "idea_high_cash_0123456789abcdef"
$runId = "canonical-front-office-contract-run"
$queueEvaluatedAtUtc = "2026-09-15T00:00:03.000Z"
$script:versionReadCount = 0
$script:queueReadCount = 0
$script:observedQueueHeaders = $null

$versionReader = {
  param([string]$Uri)
  $script:versionReadCount++
  if ($Uri -ne "http://idea.dev.lotus/version") {
    throw "Unexpected Idea version URI: $Uri"
  }
  return @{ build = @{ ciRunId = $runId } }
}

$queueReader = {
  param([string]$Uri, [hashtable]$Headers)
  $script:queueReadCount++
  $script:observedQueueHeaders = $Headers
  if ($Uri -notmatch [regex]::Escape("evaluatedAtUtc=$([uri]::EscapeDataString($queueEvaluatedAtUtc))")) {
    throw "Queue reader did not receive the exact evaluation boundary."
  }
  return @{
    evaluatedAtUtc = $queueEvaluatedAtUtc
    items = @(@{ candidate = @{ candidateId = $candidateId } })
  }
}

function New-CandidateEvidence {
  param([hashtable]$AccessScope)

  return [ordered]@{
    schemaVersion = "lotus-workbench.idea-candidate-seed-evidence.v3"
    runId = $runId
    candidateId = $candidateId
    portfolioId = $portfolioId
    accessScope = $AccessScope
    asOfDate = $asOfDate
    lifecycleStatus = "ready_for_review"
    sourceObservedAtUtc = "2026-09-15T00:00:00.000Z"
    evaluatedAtUtc = "2026-09-15T00:00:01.000Z"
    lifecycleObservedAtUtc = "2026-09-15T00:00:02.000Z"
    queueEvaluatedAtUtc = $queueEvaluatedAtUtc
    queuePolicyVersion = "idea-deterministic-ranking-v1"
  }
}

function Write-CandidateEvidence {
  param(
    [string]$Name,
    [hashtable]$AccessScope
  )

  $path = Join-Path $fixtureRoot "$Name.json"
  New-CandidateEvidence -AccessScope $AccessScope |
    ConvertTo-Json -Depth 6 |
    Set-Content -LiteralPath $path -Encoding utf8
  return $path
}

function Assert-EvidencePathRefusedBeforeIo {
  param(
    [string]$Case,
    [string]$Path,
    [string]$ExpectedMessage
  )

  $versionReadsBefore = $script:versionReadCount
  $queueReadsBefore = $script:queueReadCount
  try {
    $evidence = Read-IdeaCandidateSeedEvidence `
      -Path $path `
      -PortfolioId $portfolioId `
      -AsOfDate $asOfDate `
      -IdeaVersionReader $versionReader
    Assert-IdeaQueueSeed `
      -GatewayBaseUrl "http://gateway.dev.lotus" `
      -PortfolioId $portfolioId `
      -ExpectedCandidateId $evidence.candidateId `
      -EvaluatedAtUtc $evidence.queueEvaluatedAtUtc `
      -AccessScope $evidence.accessScope `
      -QueueReader $queueReader
    throw "Contract case '$Case' unexpectedly reached the queue reader."
  } catch {
    if ($_.Exception.Message -notmatch [regex]::Escape($ExpectedMessage)) {
      throw "Contract case '$Case' returned the wrong refusal: $($_.Exception.Message)"
    }
  }
  if (
    $script:versionReadCount -ne $versionReadsBefore -or
    $script:queueReadCount -ne $queueReadsBefore
  ) {
    throw "Contract case '$Case' performed outbound I/O before refusing invalid scope."
  }
}

function Assert-ScopeRefusedBeforeIo {
  param(
    [string]$Case,
    [hashtable]$AccessScope,
    [string]$ExpectedMessage
  )

  $path = Write-CandidateEvidence -Name $Case -AccessScope $AccessScope
  Assert-EvidencePathRefusedBeforeIo `
    -Case $Case `
    -Path $path `
    -ExpectedMessage $ExpectedMessage
}

try {
  $validScope = @{
    tenantId = "tenant-private-bank-sg"
    bookId = "book-advisor-001"
    portfolioId = $portfolioId
    clientId = "client-001"
  }
  $validPath = Write-CandidateEvidence -Name "valid" -AccessScope $validScope
  $evidence = Read-IdeaCandidateSeedEvidence `
    -Path $validPath `
    -PortfolioId $portfolioId `
    -AsOfDate $asOfDate `
    -IdeaVersionReader $versionReader
  Assert-IdeaQueueSeed `
    -GatewayBaseUrl "http://gateway.dev.lotus" `
    -PortfolioId $portfolioId `
    -ExpectedCandidateId $evidence.candidateId `
    -EvaluatedAtUtc $evidence.queueEvaluatedAtUtc `
    -AccessScope $evidence.accessScope `
    -QueueReader $queueReader

  if ($script:versionReadCount -ne 1 -or $script:queueReadCount -ne 1) {
    throw "Valid evidence did not perform exactly one version read and one queue read."
  }
  $expectedHeaders = @{
    "X-Caller-Tenant-Ids" = $validScope.tenantId
    "X-Caller-Book-Ids" = $validScope.bookId
    "X-Caller-Portfolio-Ids" = $validScope.portfolioId
    "X-Caller-Client-Ids" = $validScope.clientId
  }
  foreach ($header in $expectedHeaders.Keys) {
    if ([string]$script:observedQueueHeaders[$header] -ne [string]$expectedHeaders[$header]) {
      throw "Valid evidence changed outbound header $header."
    }
  }

  Assert-ScopeRefusedBeforeIo `
    -Case "missing-client" `
    -AccessScope @{
      tenantId = $validScope.tenantId
      bookId = $validScope.bookId
      portfolioId = $validScope.portfolioId
    } `
    -ExpectedMessage "incomplete admitted access scope"
  Assert-ScopeRefusedBeforeIo `
    -Case "mismatched-portfolio" `
    -AccessScope @{
      tenantId = $validScope.tenantId
      bookId = $validScope.bookId
      portfolioId = "PB_NOT_ADMITTED"
      clientId = $validScope.clientId
    } `
    -ExpectedMessage "mismatched admitted portfolio scope"

  $invalidTimestampPath = Write-CandidateEvidence `
    -Name "noncanonical-timestamp" `
    -AccessScope $validScope
  $invalidTimestampJson = Get-Content -LiteralPath $invalidTimestampPath -Raw
  $invalidTimestampJson.Replace(
    "2026-09-15T00:00:00.000Z",
    "2026-09-15T00:00:00.000+00:00"
  ) | Set-Content -LiteralPath $invalidTimestampPath -Encoding utf8
  Assert-EvidencePathRefusedBeforeIo `
    -Case "noncanonical-timestamp" `
    -Path $invalidTimestampPath `
    -ExpectedMessage "invalid sourceObservedAtUtc"

  $nestedDecoyPath = Join-Path $fixtureRoot "nested-timestamp-decoy.json"
  $nestedDecoyEvidence = New-CandidateEvidence -AccessScope $validScope
  $nestedDecoyEvidence.sourceObservedAtUtc = 0
  $nestedDecoyEvidence.decoy = @{
    sourceObservedAtUtc = "2026-09-15T00:00:00.000Z"
  }
  $nestedDecoyEvidence |
    ConvertTo-Json -Depth 6 |
    Set-Content -LiteralPath $nestedDecoyPath -Encoding utf8
  Assert-EvidencePathRefusedBeforeIo `
    -Case "nested-timestamp-decoy" `
    -Path $nestedDecoyPath `
    -ExpectedMessage "invalid sourceObservedAtUtc"

  [ordered]@{
    contract = "canonical-idea-evidence-authority"
    validQueueReads = $script:queueReadCount
    invalidCases = @(
      "missing-client",
      "mismatched-portfolio",
      "noncanonical-timestamp",
      "nested-timestamp-decoy"
    )
    exactHeaders = @($expectedHeaders.Keys | Sort-Object)
    passed = $true
  } | ConvertTo-Json -Compress
} finally {
  if (
    (Test-Path -LiteralPath $fixtureRoot) -and
    $fixtureRoot.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)
  ) {
    Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
  }
}
