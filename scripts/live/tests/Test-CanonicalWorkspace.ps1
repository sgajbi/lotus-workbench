$ErrorActionPreference = 'Stop'
$sourceWorkbench = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).ProviderPath
$module = Join-Path $sourceWorkbench 'scripts/live/CanonicalWorkspace.psm1'
Import-Module $module -Force
$workspace = Join-Path ([System.IO.Path]::GetTempPath()) ("lotus-canonical-workspace-test-" + [guid]::NewGuid().ToString('N'))
$workbench = Join-Path $workspace 'lotus-workbench'
$platform = Join-Path $workspace 'lotus-platform'
$null = New-Item -ItemType Directory -Path $workbench,$platform
$previous = $env:LOTUS_WORKSPACE_ROOT

try {
  $env:LOTUS_WORKSPACE_ROOT = $null
  if ((Resolve-CanonicalWorkspaceRoot -WorkbenchRepoPath $workbench) -ne $workspace) {
    throw 'Sibling checkout inference returned the wrong workspace.'
  }
  $env:LOTUS_WORKSPACE_ROOT = $workbench
  if ((Resolve-CanonicalWorkspaceRoot -ProjectsRoot $workspace -WorkbenchRepoPath $workbench) -ne $workspace) {
    throw 'Explicit workspace did not take precedence over the environment.'
  }
  try {
    Resolve-CanonicalWorkspaceRoot -WorkbenchRepoPath $workbench | Out-Null
    throw 'An invalid environment workspace was accepted.'
  } catch {
    if ($_.Exception.Message -notlike '*no lotus-workbench checkout*') { throw }
  }
  try {
    Resolve-CanonicalWorkspaceRoot -ProjectsRoot (Join-Path $workbench 'missing-root') -WorkbenchRepoPath $workbench | Out-Null
    throw 'A missing workspace was accepted.'
  } catch {
    if ($_.Exception.Message -notlike '*does not exist*') { throw }
  }
  try {
    Resolve-CanonicalWorkspaceRoot -ProjectsRoot $workspace -WorkbenchRepoPath (Join-Path $workspace 'lotus-platform') | Out-Null
    throw 'A different selected checkout was accepted.'
  } catch {
    if ($_.Exception.Message -notlike '*different lotus-workbench checkout*') { throw }
  }
  Remove-Item -LiteralPath $platform
  try {
    Resolve-CanonicalWorkspaceRoot -ProjectsRoot $workspace -WorkbenchRepoPath $workbench | Out-Null
    throw 'A workspace without lotus-platform was accepted.'
  } catch {
    if ($_.Exception.Message -notlike '*no lotus-platform checkout*') { throw }
  }
  Write-Output 'Canonical workspace valid and fail-closed cases passed.'
} finally {
  $env:LOTUS_WORKSPACE_ROOT = $previous
  $resolvedTemporaryRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  $resolvedFixture = [System.IO.Path]::GetFullPath($workspace)
  if (-not $resolvedFixture.StartsWith($resolvedTemporaryRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
      (Split-Path -Leaf $resolvedFixture) -notlike 'lotus-canonical-workspace-test-*') {
    throw 'Refusing to remove an unexpected workspace test fixture.'
  }
  Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
}
