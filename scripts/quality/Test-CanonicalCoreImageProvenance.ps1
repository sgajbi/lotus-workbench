$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '../live/CanonicalCoreImageProvenance.psm1') -Force

$commit = '0123456789abcdef0123456789abcdef01234567'
$expected = New-CanonicalCoreBuildEnvironment -CommitSha $commit -Branch 'main' `
  -BuiltAtUtc ([datetime]'2026-09-21T12:30:00Z')
if ($expected.DEMO_DATA_PACK_ENABLED -cne 'false' -or
    $expected.LOTUS_GIT_COMMIT_SHA -cne $commit -or
    $expected.LOTUS_BUILD_TIMESTAMP -cne '2026-09-21T12:30:00Z' -or
    $expected.LOTUS_IMAGE_VERSION -cne $commit) {
  throw 'Canonical Core build metadata was not bound to exact source.'
}
try {
  New-CanonicalCoreBuildEnvironment -CommitSha 'unknown' -Branch 'main' | Out-Null
  throw 'Unknown source revision was accepted.'
} catch {
  if ($_.Exception.Message -notlike '*requires one exact source commit and branch*') { throw }
}
$version = [pscustomobject]@{
  git_commit_sha = $expected.LOTUS_GIT_COMMIT_SHA
  git_branch = $expected.LOTUS_GIT_BRANCH
  build_timestamp = $expected.LOTUS_BUILD_TIMESTAMP
  repo_url = $expected.LOTUS_REPO_URL
  image_version = $expected.LOTUS_IMAGE_VERSION
}
$labels = [pscustomobject]@{
  'org.opencontainers.image.revision' = $expected.LOTUS_GIT_COMMIT_SHA
  'org.opencontainers.image.ref.name' = $expected.LOTUS_GIT_BRANCH
  'org.opencontainers.image.created' = $expected.LOTUS_BUILD_TIMESTAMP
  'org.opencontainers.image.source' = $expected.LOTUS_REPO_URL
  'org.opencontainers.image.version' = $expected.LOTUS_IMAGE_VERSION
}
Assert-CanonicalCoreImageIdentity -Expected $expected -Version $version -Labels $labels

$version.git_commit_sha = 'unknown'
try {
  Assert-CanonicalCoreImageIdentity -Expected $expected -Version $version -Labels $labels
  throw 'Version-mismatch mutation was accepted.'
} catch {
  if ($_.Exception.Message -notlike '*provenance mismatch for git_commit_sha*') { throw }
}
$version.git_commit_sha = $commit
$labels.'org.opencontainers.image.revision' = 'unknown'
try {
  Assert-CanonicalCoreImageIdentity -Expected $expected -Version $version -Labels $labels
  throw 'OCI-label mutation was accepted.'
} catch {
  if ($_.Exception.Message -notlike '*provenance mismatch for git_commit_sha*') { throw }
}

# Exercise the shipped Docker/HTTP boundary without starting the canonical stack.
$labels.'org.opencontainers.image.revision' = $commit
$global:mockCoreLabels = $labels
$global:mockCoreVersion = $version
function global:docker {
  $command = $args -join ' '
  $global:LASTEXITCODE = 0
  if ($command -eq 'compose ps -q query_service') { return 'core-query-container' }
  if ($command -like 'inspect --format*') { return ('sha256:' + ('a' * 64)) }
  if ($command -like 'image inspect --format*') { return ($global:mockCoreLabels | ConvertTo-Json -Compress) }
  throw "Unexpected Docker provenance command: $command"
}
function global:Invoke-RestMethod {
  param([string]$Uri, [int]$TimeoutSec)
  if ($Uri -cne 'http://127.0.0.1:8201/version' -or $TimeoutSec -ne 10) {
    throw 'Unexpected Core version request.'
  }
  return $global:mockCoreVersion
}
Assert-CanonicalCoreImageProvenance -RepoPath $PSScriptRoot -Expected $expected | Out-Null
$global:mockCoreLabels.'org.opencontainers.image.revision' = 'unknown'
try {
  Assert-CanonicalCoreImageProvenance -RepoPath $PSScriptRoot -Expected $expected | Out-Null
  throw 'Running-image mutation was accepted.'
} catch {
  if ($_.Exception.Message -notlike '*provenance mismatch for git_commit_sha*') { throw }
}

@{ contract = 'canonical-core-image-provenance'; passed = $true } | ConvertTo-Json -Compress
