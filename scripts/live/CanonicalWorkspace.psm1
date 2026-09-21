function Resolve-CanonicalWorkspaceRoot {
  [CmdletBinding()]
  param(
    [string]$ProjectsRoot,
    [Parameter(Mandatory = $true)][string]$WorkbenchRepoPath
  )

  $requestedRoot = if (-not [string]::IsNullOrWhiteSpace($ProjectsRoot)) {
    $ProjectsRoot
  } elseif (-not [string]::IsNullOrWhiteSpace($env:LOTUS_WORKSPACE_ROOT)) {
    $env:LOTUS_WORKSPACE_ROOT
  } else {
    Split-Path -Parent $WorkbenchRepoPath
  }
  if (-not (Test-Path -LiteralPath $requestedRoot -PathType Container)) {
    throw "Canonical workspace root does not exist: $requestedRoot"
  }
  $resolvedRoot = (Resolve-Path -LiteralPath $requestedRoot).ProviderPath
  $expectedWorkbench = Join-Path $resolvedRoot 'lotus-workbench'
  if (-not (Test-Path -LiteralPath $expectedWorkbench -PathType Container)) {
    throw "Canonical workspace root has no lotus-workbench checkout: $resolvedRoot"
  }
  $resolvedWorkbench = (Resolve-Path -LiteralPath $expectedWorkbench).ProviderPath
  $workbenchItem = Get-Item -LiteralPath $expectedWorkbench
  if ($workbenchItem.LinkType -and $workbenchItem.Target) {
    $resolvedWorkbench = (Resolve-Path -LiteralPath $workbenchItem.Target).ProviderPath
  }
  $comparison = if ($PSVersionTable.PSEdition -eq 'Desktop' -or $IsWindows) {
    [System.StringComparison]::OrdinalIgnoreCase
  } else {
    [System.StringComparison]::Ordinal
  }
  if (-not [string]::Equals($resolvedWorkbench, $WorkbenchRepoPath, $comparison)) {
    throw "Canonical workspace root selects a different lotus-workbench checkout: $resolvedRoot"
  }
  if (-not (Test-Path -LiteralPath (Join-Path $resolvedRoot 'lotus-platform') -PathType Container)) {
    throw "Canonical workspace root has no lotus-platform checkout: $resolvedRoot"
  }
  return $resolvedRoot
}

Export-ModuleMember -Function Resolve-CanonicalWorkspaceRoot
