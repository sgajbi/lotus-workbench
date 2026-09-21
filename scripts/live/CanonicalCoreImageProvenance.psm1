function New-CanonicalCoreBuildEnvironment {
  param(
    [Parameter(Mandatory)][string]$CommitSha,
    [Parameter(Mandatory)][string]$Branch,
    [datetime]$BuiltAtUtc = [datetime]::UtcNow
  )

  if ($CommitSha -cnotmatch '\A[0-9a-f]{40}\z' -or [string]::IsNullOrWhiteSpace($Branch)) {
    throw 'Canonical Core build requires one exact source commit and branch.'
  }
  return @{
    DEMO_DATA_PACK_ENABLED = 'false'
    LOTUS_GIT_COMMIT_SHA = $CommitSha
    LOTUS_GIT_BRANCH = $Branch
    LOTUS_BUILD_TIMESTAMP = $BuiltAtUtc.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    LOTUS_REPO_URL = 'https://github.com/sgajbi/lotus-core'
    LOTUS_IMAGE_VERSION = $CommitSha
  }
}

function Assert-CanonicalCoreImageIdentity {
  param(
    [Parameter(Mandatory)][hashtable]$Expected,
    [Parameter(Mandatory)]$Version,
    [Parameter(Mandatory)]$Labels
  )

  $fields = @{
    git_commit_sha = 'org.opencontainers.image.revision'
    git_branch = 'org.opencontainers.image.ref.name'
    build_timestamp = 'org.opencontainers.image.created'
    repo_url = 'org.opencontainers.image.source'
    image_version = 'org.opencontainers.image.version'
  }
  $expectedFields = @{
    git_commit_sha = $Expected.LOTUS_GIT_COMMIT_SHA
    git_branch = $Expected.LOTUS_GIT_BRANCH
    build_timestamp = $Expected.LOTUS_BUILD_TIMESTAMP
    repo_url = $Expected.LOTUS_REPO_URL
    image_version = $Expected.LOTUS_IMAGE_VERSION
  }
  foreach ($field in $fields.Keys) {
    $expectedValue = [string]$expectedFields[$field]
    $versionRaw = $Version.$field
    $versionValue = if ($versionRaw -is [datetime]) {
      $versionRaw.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    } else { [string]$versionRaw }
    $labelRaw = $Labels.($fields[$field])
    # PowerShell 7 may deserialize an OCI created timestamp as DateTime.
    $labelValue = if ($labelRaw -is [datetime]) {
      $labelRaw.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    } else { [string]$labelRaw }
    if ([string]::IsNullOrWhiteSpace($expectedValue) -or
        $versionValue -cne $expectedValue -or $labelValue -cne $expectedValue) {
      throw "Canonical Core image provenance mismatch for $field."
    }
  }
}

function Assert-CanonicalCoreImageProvenance {
  param(
    [Parameter(Mandatory)][string]$RepoPath,
    [Parameter(Mandatory)][hashtable]$Expected
  )

  Push-Location -LiteralPath $RepoPath
  try {
    $containerIds = @(@(& docker compose ps -q query_service 2>$null) | Where-Object { $_ })
    if ($LASTEXITCODE -ne 0 -or $containerIds.Count -ne 1) {
      throw 'Canonical Core query container identity is unavailable.'
    }
    $imageId = (& docker inspect --format '{{.Image}}' $containerIds[0] 2>$null).Trim()
    if ($LASTEXITCODE -ne 0 -or $imageId -cnotmatch '\Asha256:[0-9a-f]{64}\z') {
      throw 'Canonical Core query image identity is unavailable.'
    }
    $labelsJson = & docker image inspect --format '{{json .Config.Labels}}' $imageId 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Canonical Core image labels are unavailable.' }
    $labels = $labelsJson | ConvertFrom-Json -ErrorAction Stop
    $version = Invoke-RestMethod -Uri 'http://127.0.0.1:8201/version' -TimeoutSec 10
    Assert-CanonicalCoreImageIdentity -Expected $Expected -Version $version -Labels $labels
    Write-Host "Canonical Core query image provenance verified: $($Expected.LOTUS_GIT_COMMIT_SHA), $imageId"
  } finally {
    Pop-Location
  }
}

Export-ModuleMember -Function New-CanonicalCoreBuildEnvironment, Assert-CanonicalCoreImageIdentity, Assert-CanonicalCoreImageProvenance
