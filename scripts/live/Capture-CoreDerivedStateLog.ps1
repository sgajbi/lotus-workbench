[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$CoreRepoPath,
  [Parameter(Mandatory = $true)]
  [string]$LogDirectory,
  [Parameter(Mandatory = $true)]
  [string]$ExpectedContainerId,
  [Parameter(Mandatory = $true)]
  [string]$Since,
  [int]$Tail = 200
)

$ErrorActionPreference = "Stop"
$identity = & (Join-Path $PSScriptRoot "Resolve-CoreDerivedStateContainer.ps1") -CoreRepoPath $CoreRepoPath
if ($identity.ContainerId -cne $ExpectedContainerId) {
  throw "Core derived-state container changed after discovery; refusing stale evidence."
}

$safeName = ($identity.ContainerName -replace "[^A-Za-z0-9_.-]", "-").Trim("-")
$target = Join-Path $LogDirectory "$safeName.log"
& docker logs --since $Since --tail $Tail $identity.ContainerId *> $target
if ($LASTEXITCODE -ne 0) {
  throw "Required Core derived-state logs failed for inspected container ID with exit code $LASTEXITCODE."
}
$bytes = (Get-Item -LiteralPath $target).Length
if ($bytes -le 0) {
  throw "Required Core derived-state logs are empty for inspected container ID."
}

Write-Output ([pscustomobject]@{
  container = $identity.ContainerName
  containerId = $identity.ContainerId
  path = $target
  tail = $Tail
  since = $Since
  status = "captured"
  bytes = $bytes
  capturedAt = (Get-Date).ToString("o")
  responsibilities = @(
    "position-timeseries materialization",
    "portfolio-timeseries aggregation"
  )
})
