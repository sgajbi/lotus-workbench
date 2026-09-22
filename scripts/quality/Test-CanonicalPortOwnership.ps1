[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$modulePath = Join-Path $repoRoot "scripts\live\CanonicalPortOwnership.psm1"
Import-Module $modulePath -Force

function Assert-OwnershipDecision {
  param(
    [string]$Case,
    [bool]$Expected,
    [bool]$Actual
  )

  if ($Expected -ne $Actual) {
    throw "Ownership contract '$Case' expected $Expected but returned $Actual."
  }

  return [ordered]@{
    case = $Case
    expected = $Expected
    actual = $Actual
  }
}

$separator = [System.IO.Path]::DirectorySeparatorChar
$contractRoot = Join-Path ([System.IO.Path]::GetTempPath()) "Lotus Runtime Ownership"
$canonicalPath = Join-Path $contractRoot "lotus-manage"
$repeatedSeparatorPath = $canonicalPath.Replace(
  $separator.ToString(),
  "$separator$separator"
)
$caseVariantPath = if ($canonicalPath -ceq $canonicalPath.ToUpperInvariant()) {
  $canonicalPath.ToLowerInvariant()
} else {
  $canonicalPath.ToUpperInvariant()
}
$trailingSeparatorPath = "$canonicalPath$separator"
$parentSegmentPath = Join-Path (Join-Path $canonicalPath "runtime-child") ".."
$foreignPath = Join-Path $contractRoot "foreign-checkout"
$malformedPath = "$canonicalPath$([char]0)foreign"
$relativePath = Join-Path ".." "lotus-manage"
$allowedProjects = @("lotus-manage")
$allowedWorkingDirectories = @($canonicalPath)

function Test-Owner {
  param(
    [string]$Project = "lotus-manage",
    [AllowEmptyString()]
    [string]$WorkingDirectory = $canonicalPath,
    [string[]]$Projects = $allowedProjects,
    [string[]]$WorkingDirectories = $allowedWorkingDirectories
  )

  return Test-CanonicalDockerProjectOwnership `
    -Project $Project `
    -WorkingDirectory $WorkingDirectory `
    -AllowedProjects $Projects `
    -AllowedWorkingDirectories $WorkingDirectories
}

$results = @(
  Assert-OwnershipDecision -Case "canonical path" -Expected $true -Actual (Test-Owner)
  Assert-OwnershipDecision -Case "repeated separators" -Expected $true -Actual (Test-Owner -WorkingDirectory $repeatedSeparatorPath)
  Assert-OwnershipDecision -Case "case difference" -Expected $true -Actual (Test-Owner -WorkingDirectory $caseVariantPath)
  Assert-OwnershipDecision -Case "trailing separator" -Expected $true -Actual (Test-Owner -WorkingDirectory $trailingSeparatorPath)
  Assert-OwnershipDecision -Case "parent segment" -Expected $true -Actual (Test-Owner -WorkingDirectory $parentSegmentPath)
  Assert-OwnershipDecision -Case "foreign directory" -Expected $false -Actual (Test-Owner -WorkingDirectory $foreignPath)
  Assert-OwnershipDecision -Case "wrong project" -Expected $false -Actual (Test-Owner -Project "foreign-project")
  Assert-OwnershipDecision -Case "missing project" -Expected $false -Actual (Test-Owner -Project "")
  Assert-OwnershipDecision -Case "missing working directory" -Expected $false -Actual (Test-Owner -WorkingDirectory "")
  Assert-OwnershipDecision -Case "relative owner path" -Expected $false -Actual (Test-Owner -WorkingDirectory $relativePath)
  Assert-OwnershipDecision -Case "malformed owner path" -Expected $false -Actual (Test-Owner -WorkingDirectory $malformedPath)
  Assert-OwnershipDecision `
    -Case "relative allowlisted path" `
    -Expected $false `
    -Actual (Test-Owner -WorkingDirectories @($relativePath))
  Assert-OwnershipDecision `
    -Case "malformed allowlisted path" `
    -Expected $false `
    -Actual (Test-Owner -WorkingDirectories @($malformedPath))
)

# Startup imports this module before Compose admission. Reloading the latter must not
# remove the exported ownership command when a prior canonical container owns a port.
Import-Module (Join-Path $repoRoot "scripts\live\CanonicalComposeAdmission.psm1") -Force
if (-not (Get-Command Assert-CanonicalComposeAdmission -ErrorAction SilentlyContinue)) {
  throw "Compose admission command was not exported after startup module imports."
}
$results += Assert-OwnershipDecision -Case "canonical path after Compose admission import" -Expected $true -Actual (Test-Owner)
$results += Assert-OwnershipDecision -Case "foreign path after Compose admission import" -Expected $false -Actual (Test-Owner -WorkingDirectory $foreignPath)
$results += Assert-OwnershipDecision -Case "wrong project after Compose admission import" -Expected $false -Actual (Test-Owner -Project "foreign-project")

[ordered]@{
  contract = "canonical-compose-port-ownership"
  implementation = $modulePath
  platform = [System.Environment]::OSVersion.Platform.ToString()
  powershell = $PSVersionTable.PSVersion.ToString()
  cases = $results
  passed = $true
} | ConvertTo-Json -Depth 5
