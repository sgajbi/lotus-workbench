[CmdletBinding()]
param(
  [string]$ProjectsRoot = "C:\Users\Sandeep\projects",
  [string]$RuntimeHolder = $env:LOTUS_CANONICAL_RUNTIME_HOLDER,
  [string]$WorkbenchRepoPath,
  [switch]$KeepReservation,
  [switch]$RemoveVolumes,
  [switch]$RemoveImages
)

$ErrorActionPreference = "Stop"
$selectedWorkbench = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if ($WorkbenchRepoPath -and [System.IO.Path]::GetFullPath($WorkbenchRepoPath) -ne $selectedWorkbench) {
  throw 'Selected Workbench checkout does not match the executing script.'
}
$WorkbenchRepoPath = $selectedWorkbench

$coreRepo = Join-Path $ProjectsRoot "lotus-core"
$performanceRepo = Join-Path $ProjectsRoot "lotus-performance"
$riskRepo = Join-Path $ProjectsRoot "lotus-risk"
$aiRepo = Join-Path $ProjectsRoot "lotus-ai"
$adviseRepo = Join-Path $ProjectsRoot "lotus-advise"
$manageRepo = Join-Path $ProjectsRoot "lotus-manage"
$reportRepo = Join-Path $ProjectsRoot "lotus-report"
$archiveRepo = Join-Path $ProjectsRoot "lotus-archive"
$renderRepo = Join-Path $ProjectsRoot "lotus-render"
$ideaRepo = Join-Path $ProjectsRoot "lotus-idea"
$gatewayRepo = Join-Path $ProjectsRoot "lotus-gateway"
$workbenchRepo = $WorkbenchRepoPath
$platformRepo = Join-Path $ProjectsRoot "lotus-platform"
Import-Module (Join-Path $platformRepo 'automation/CanonicalRuntimeReservation.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'CanonicalComposeAdmission.psm1') -Force

function Invoke-RepoCommand {
  param(
    [string]$RepoPath,
    [string]$Command
  )

  Push-Location $RepoPath
  try {
    Assert-CanonicalComposeAdmission -RepoPath $RepoPath -Operation $runtimeOperation
    Invoke-Expression $Command
    if ($LASTEXITCODE -ne 0) { throw "Canonical teardown command failed (exit $LASTEXITCODE): $Command" }
  } finally {
    Pop-Location
  }
}

function Stop-ListenersOnPorts {
  param([int[]]$Ports)

  $owningProcesses = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in $Ports } |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($processId in $owningProcesses) {
    try {
      $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
      if (-not $process) { continue } # The observed listener already exited; nothing to kill.
      if ($process -and $process.ProcessName -match "^(com\.docker|docker|vpnkit)") {
        Write-Host "Leaving Docker-owned listener $processId ($($process.ProcessName)) in place"
        continue
      }
      $identity = "$($process.Id):$($process.StartTime.ToUniversalTime().ToString('o'))"
      if (-not @($runtimeOperation.Bindings | Where-Object {
        $_.kind -eq 'host-process' -and $_.id -eq $identity
      }).Count) { throw "Host process identity changed after admission: $identity" }
      Stop-Process -InputObject $process -Force -ErrorAction Stop
      Write-Host "Stopped host process $processId"
    } catch {
      throw ("Unable to stop admitted host process {0}: {1}" -f $processId, $_.Exception.Message)
    }
  }
}

function Remove-ContainerIfPresent {
  param([string]$Name)

  $existing = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq $Name }
  if ($existing) {
    $identity = docker inspect --format '{{.Id}}' $Name
    if ($LASTEXITCODE -ne 0 -or -not @($runtimeOperation.Bindings | Where-Object {
      $_.kind -eq 'container' -and $_.id -eq $identity
    }).Count) { throw "Container identity is not admitted: $Name" }
    docker rm -f $identity | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Admitted container removal failed: $identity" }
    Write-Host "Removed container $Name"
  }
}

$operationAction = if ($KeepReservation) { 'change' } else { 'teardown' }
$runtimeOperation = Enter-CanonicalRuntimeOperation -ProjectsRoot $ProjectsRoot -Holder $RuntimeHolder -Action $operationAction -WorkbenchRepoPath $workbenchRepo
$runtimeOutcome = 'failure'
try {
Write-Host "Stopping canonical host processes..."
Stop-ListenersOnPorts @($runtimeOperation.Scope.ports)

Write-Host "Stopping direct ingress..."
Remove-ContainerIfPresent "lotus-direct-dev-ingress"

Write-Host "Stopping Docker-backed Lotus services..."
$downCommand = "docker compose down --remove-orphans"
if ($RemoveVolumes) {
  $downCommand = "$downCommand -v"
}
if ($RemoveImages) {
  $downCommand = "$downCommand --rmi local"
}
$sourceNames = @($runtimeOperation.Scope.sources.PSObject.Properties.Name)
$partialScope = $sourceNames.Count -eq 4 -and @('lotus-core','lotus-manage','lotus-workbench','lotus-platform' | Where-Object { $_ -notin $sourceNames }).Count -eq 0
$teardownRepositories = if ($partialScope) { @($coreRepo,$manageRepo) } else {
  @($coreRepo,$performanceRepo,$riskRepo,$aiRepo,$adviseRepo,$manageRepo,$reportRepo,
    $archiveRepo,$renderRepo,$ideaRepo,$gatewayRepo,$workbenchRepo)
}
foreach ($repo in $teardownRepositories) { Invoke-RepoCommand $repo $downCommand }

Write-Host "Canonical front-office local runtime stopped."
$runtimeOutcome = 'success'
} finally {
  Exit-CanonicalRuntimeOperation -Operation $runtimeOperation -Outcome $runtimeOutcome
}
