[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$CoreRepoPath
)

$ErrorActionPreference = "Stop"
$coreRoot = (Resolve-Path -LiteralPath $CoreRepoPath).Path
$composeFile = Join-Path $coreRoot "docker-compose.yml"
if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) {
  throw "Core Compose file is unavailable: $composeFile"
}

$containerIds = @(
  & docker compose --project-directory $coreRoot -f $composeFile ps --status running -q portfolio_derived_state_service
)
if ($LASTEXITCODE -ne 0) {
  throw "Core derived-state Compose service discovery failed with exit code $LASTEXITCODE."
}
$containerIds = @($containerIds | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
if ($containerIds.Count -ne 1) {
  throw "Expected exactly one running Core portfolio_derived_state_service container; found $($containerIds.Count)."
}

$inspectionJson = & docker inspect --format '{{json .}}' $containerIds[0]
if ($LASTEXITCODE -ne 0) {
  throw "Core derived-state container inspection failed with exit code $LASTEXITCODE."
}
$inspection = $inspectionJson | ConvertFrom-Json
$inspectedId = [string]$inspection.Id
$labels = $inspection.Config.Labels
$labelledRoot = [string]$labels.'com.docker.compose.project.working_dir'
$service = [string]$labels.'com.docker.compose.service'
$project = [string]$labels.'com.docker.compose.project'
$containerName = ([string]$inspection.Name).TrimStart('/')
if ([string]::IsNullOrWhiteSpace($labelledRoot) -or
    [string]::IsNullOrWhiteSpace($inspectedId) -or
    -not $inspectedId.StartsWith($containerIds[0], [StringComparison]::Ordinal) -or
    [string]::IsNullOrWhiteSpace($containerName) -or
    $service -cne "portfolio_derived_state_service" -or
    $project -cne "lotus-core-app-local") {
  throw "Discovered container is not the governed Core derived-state Compose service (service=$service, project=$project, name=$containerName, working_dir=$labelledRoot)."
}

$labelledRoot = [System.IO.Path]::GetFullPath($labelledRoot).TrimEnd('\', '/')
$expectedRoot = [System.IO.Path]::GetFullPath($coreRoot).TrimEnd('\', '/')
$pathComparison = if ([System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform(
  [System.Runtime.InteropServices.OSPlatform]::Windows
)) { [StringComparison]::OrdinalIgnoreCase } else { [StringComparison]::Ordinal }
if (-not [string]::Equals($labelledRoot, $expectedRoot, $pathComparison)) {
  throw "Core derived-state container belongs to another checkout: $labelledRoot"
}

Write-Output ([pscustomobject]@{
  ContainerId = $inspectedId
  ContainerName = $containerName
})
