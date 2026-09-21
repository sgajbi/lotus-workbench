$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '../live/CanonicalCoreImageProvenance.psm1') -Force

# The launcher reads this shipped helper before and after a built Core image.
$startScript = Join-Path $PSScriptRoot '../live/Start-LotusFrontOfficeCanonical.ps1'
$tokens = $null; $parseErrors = $null
$startAst = [Management.Automation.Language.Parser]::ParseFile($startScript, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw 'Canonical launcher did not parse.' }
$identityHelper = $startAst.Find({
  param($node)
  $node -is [Management.Automation.Language.FunctionDefinitionAst] -and
  $node.Name -eq 'Get-GitRepositoryIdentity'
}, $true)
if (-not $identityHelper) { throw 'Canonical source identity guard is missing.' }
. ([scriptblock]::Create($identityHelper.Extent.Text))
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ('lotus-core-provenance-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
try {
  & git -C $fixtureRoot init -q
  if ($LASTEXITCODE -ne 0) { throw 'Source fixture Git init failed.' }
  & git -C $fixtureRoot config user.name 'Lotus Source Fixture'
  & git -C $fixtureRoot config user.email 'fixture@example.invalid'
  $trackedFile = Join-Path $fixtureRoot 'source.txt'
  'accepted source' | Set-Content -LiteralPath $trackedFile
  & git -C $fixtureRoot add source.txt
  & git -C $fixtureRoot -c commit.gpgsign=false commit -qm 'seed source fixture'
  if ($LASTEXITCODE -ne 0) { throw 'Source fixture Git commit failed.' }
  $cleanIdentity = Get-GitRepositoryIdentity -RepoPath $fixtureRoot -RequireCleanPrebuiltSource
  if ($cleanIdentity.CommitSha -cnotmatch '\A[0-9a-f]{40}\z') { throw 'Clean source identity was not accepted.' }
  'untracked mutation' | Set-Content -LiteralPath (Join-Path $fixtureRoot 'new-source.txt')
  try {
    Get-GitRepositoryIdentity -RepoPath $fixtureRoot -RequireCleanPrebuiltSource | Out-Null
    throw 'Untracked source mutation was accepted.'
  } catch {
    if ($_.Exception.Message -notlike '*not clean before startup*') { throw }
  }
  Remove-Item -LiteralPath (Join-Path $fixtureRoot 'new-source.txt')
  'tracked mutation' | Set-Content -LiteralPath $trackedFile
  try {
    Get-GitRepositoryIdentity -RepoPath $fixtureRoot -RequireCleanPrebuiltSource | Out-Null
    throw 'Tracked source mutation was accepted.'
  } catch {
    if ($_.Exception.Message -notlike '*not clean before startup*') { throw }
  }
} finally {
  $resolvedFixture = [IO.Path]::GetFullPath($fixtureRoot)
  $resolvedTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if (-not $resolvedFixture.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase) -or
      -not (Split-Path -Leaf $resolvedFixture).StartsWith('lotus-core-provenance-')) {
    throw 'Refusing to remove an unexpected source fixture path.'
  }
  Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
}

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
