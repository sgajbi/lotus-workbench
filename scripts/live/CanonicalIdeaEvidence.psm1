Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$canonicalUtcTimestampPattern = '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'

function ConvertFrom-CanonicalUtcTimestamp {
  param(
    [string]$Value,
    [string]$FieldName
  )

  if ($Value -notmatch $canonicalUtcTimestampPattern) {
    throw "Canonical Lotus Idea candidate seed evidence has invalid $FieldName."
  }
  $parseStyle = (
    [Globalization.DateTimeStyles]::AssumeUniversal -bor
    [Globalization.DateTimeStyles]::AdjustToUniversal
  )
  try {
    return [datetimeoffset]::ParseExact(
      $Value,
      "yyyy-MM-dd'T'HH:mm:ss.fff'Z'",
      [Globalization.CultureInfo]::InvariantCulture,
      $parseStyle
    )
  } catch [FormatException] {
    throw "Canonical Lotus Idea candidate seed evidence has invalid $FieldName."
  }
}

function Read-IdeaCandidateSeedEvidence {
  param(
    [string]$Path,
    [string]$PortfolioId,
    [string]$AsOfDate,
    [scriptblock]$IdeaVersionReader = {
      param([string]$Uri)
      Invoke-RestMethod -Uri $Uri -TimeoutSec 45
    }
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Canonical Lotus Idea candidate seed evidence is missing: $Path"
  }
  $rawEvidence = Get-Content -LiteralPath $Path -Raw
  $convertFromJson = Get-Command ConvertFrom-Json
  if ($convertFromJson.Parameters.ContainsKey("DateKind")) {
    $evidence = $rawEvidence | ConvertFrom-Json -DateKind String
  } else {
    $evidence = $rawEvidence | ConvertFrom-Json
  }
  if ($evidence.schemaVersion -ne "lotus-workbench.idea-candidate-seed-evidence.v3") {
    throw "Canonical Lotus Idea candidate seed evidence has an unsupported schema version."
  }
  if ([string]$evidence.portfolioId -ne $PortfolioId) {
    throw "Canonical Lotus Idea candidate seed evidence does not match portfolio $PortfolioId."
  }
  if ([string]$evidence.asOfDate -ne $AsOfDate) {
    throw "Canonical Lotus Idea candidate seed evidence does not match business date $AsOfDate."
  }
  if ([string]$evidence.candidateId -notmatch '^idea_high_cash_[0-9a-f]{16}$') {
    throw "Canonical Lotus Idea candidate seed evidence has an invalid candidate identity."
  }
  if ([string]$evidence.lifecycleStatus -ne "ready_for_review") {
    throw "Canonical Lotus Idea candidate seed evidence is not ready for advisor review."
  }
  if ([string]::IsNullOrWhiteSpace([string]$evidence.runId)) {
    throw "Canonical Lotus Idea candidate seed evidence has no run identity."
  }
  $accessScope = $evidence.PSObject.Properties["accessScope"].Value
  if ($null -eq $accessScope) {
    throw "Canonical Lotus Idea candidate seed evidence has incomplete admitted access scope."
  }
  foreach ($field in @("tenantId", "bookId", "portfolioId", "clientId")) {
    $scopeProperty = $accessScope.PSObject.Properties[$field]
    if ($null -eq $scopeProperty -or [string]::IsNullOrWhiteSpace([string]$scopeProperty.Value)) {
      throw "Canonical Lotus Idea candidate seed evidence has incomplete admitted access scope."
    }
  }
  if (
    [string]$accessScope.portfolioId -ne [string]$evidence.portfolioId -or
    [string]$accessScope.portfolioId -ne $PortfolioId
  ) {
    throw "Canonical Lotus Idea candidate seed evidence has mismatched admitted portfolio scope."
  }

  $parsedEvidenceTimestamps = @{}
  foreach ($field in @(
      "sourceObservedAtUtc",
      "evaluatedAtUtc",
      "lifecycleObservedAtUtc",
    "queueEvaluatedAtUtc"
    )) {
    $timestampProperty = $evidence.PSObject.Properties[$field]
    if ($null -eq $timestampProperty -or $timestampProperty.Value -isnot [string]) {
      throw "Canonical Lotus Idea candidate seed evidence has invalid $field."
    }
    $canonicalTimestamp = [string]$timestampProperty.Value
    $parsedEvidenceTimestamps[$field] = ConvertFrom-CanonicalUtcTimestamp `
      -Value $canonicalTimestamp `
      -FieldName $field
  }
  if (
    $parsedEvidenceTimestamps.sourceObservedAtUtc -gt $parsedEvidenceTimestamps.evaluatedAtUtc -or
    $parsedEvidenceTimestamps.evaluatedAtUtc -gt $parsedEvidenceTimestamps.lifecycleObservedAtUtc -or
    $parsedEvidenceTimestamps.lifecycleObservedAtUtc -gt $parsedEvidenceTimestamps.queueEvaluatedAtUtc
  ) {
    throw "Canonical Lotus Idea candidate seed evidence has incoherent run chronology."
  }

  $ideaVersion = & $IdeaVersionReader "http://idea.dev.lotus/version"
  $activeIdeaRunId = [string]$ideaVersion.build.ciRunId
  if ([string]::IsNullOrWhiteSpace($activeIdeaRunId)) {
    throw "Active Lotus Idea runtime exposes no build run identity."
  }
  if ([string]$evidence.runId -ne $activeIdeaRunId) {
    throw (
      "Canonical Lotus Idea candidate seed evidence belongs to run '$($evidence.runId)', " +
      "but the active Idea runtime identifies run '$activeIdeaRunId'."
    )
  }
  return $evidence
}

function Assert-IdeaQueueSeed {
  param(
    [string]$GatewayBaseUrl,
    [string]$PortfolioId,
    [string]$ExpectedCandidateId,
    [string]$EvaluatedAtUtc,
    [pscustomobject]$AccessScope,
    [scriptblock]$QueueReader = {
      param([string]$Uri, [hashtable]$Headers)
      Invoke-RestMethod -Uri $Uri -Headers $Headers -TimeoutSec 45
    }
  )

  $headers = @{
    "X-Caller-Subject" = "canonical-front-office-validator"
    "X-Caller-Roles" = "advisor"
    "X-Caller-Capabilities" = "idea.review.queue.read,idea.candidate.detail.read"
    "X-Caller-Tenant-Ids" = [string]$AccessScope.tenantId
    "X-Caller-Book-Ids" = [string]$AccessScope.bookId
    "X-Caller-Portfolio-Ids" = [string]$AccessScope.portfolioId
    "X-Caller-Client-Ids" = [string]$AccessScope.clientId
  }
  $encodedEvaluatedAtUtc = [uri]::EscapeDataString($EvaluatedAtUtc)
  $url = "$GatewayBaseUrl/api/v1/ideas/review-queues/advisor?evaluatedAtUtc=$encodedEvaluatedAtUtc"
  $queue = & $QueueReader $url $headers
  if ([datetimeoffset]$queue.evaluatedAtUtc -ne [datetimeoffset]$EvaluatedAtUtc) {
    throw "Gateway Idea review queue did not preserve the canonical evaluatedAtUtc boundary."
  }
  $matchingItems = @($queue.items | Where-Object {
      [string]$_.candidate.candidateId -eq $ExpectedCandidateId
    })
  if ($matchingItems.Count -ne 1) {
    throw (
      "Gateway Idea review queue did not expose current-run candidate '$ExpectedCandidateId' " +
      "exactly once for $PortfolioId. Matches: $($matchingItems.Count)."
    )
  }
  Write-Host "[ok] Gateway Idea review queue contains current-run candidate $ExpectedCandidateId -> $url"
}

Export-ModuleMember -Function Read-IdeaCandidateSeedEvidence, Assert-IdeaQueueSeed
