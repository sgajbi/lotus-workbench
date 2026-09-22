# Container metadata describes inventory, never runtime or financial authority.
# Startup already exports this module for its host-port preflight. Reloading it with
# -Force from this nested module removes that public command in PowerShell 5/7.
Import-Module (Join-Path $PSScriptRoot 'CanonicalPortOwnership.psm1')

function Assert-CanonicalComposeAdmission {
  param(
    [Parameter(Mandatory)][string]$RepoPath,
    [Parameter(Mandatory)]$Operation
  )
  if (-not $Operation.Token) { throw 'An admitted runtime operation is required before Compose mutation.' }
  Push-Location $RepoPath
  try {
    # Never echo secret-bearing resolved Compose config.
    $configuration = docker compose config --format json
    if ($LASTEXITCODE -ne 0) { throw "Unable to inspect canonical Compose project (exit $LASTEXITCODE)." }
    $project = ($configuration -join "`n" | ConvertFrom-Json).name
    if (-not $project) { throw 'Canonical Compose project identity is missing.' }
    $identities = @(docker ps -aq --no-trunc --filter "label=com.docker.compose.project=$project")
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect current Compose container identities.' }
    if (-not $identities.Count) { return }
    $containers = docker inspect @identities
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect current Compose checkout identities.' }
    foreach ($container in ($containers -join "`n" | ConvertFrom-Json)) {
      $labels = $container.Config.Labels
      $admitted = @($Operation.Bindings | Where-Object {
        $_.kind -eq 'container' -and $_.id -eq $container.Id -and $_.project -eq $project
      })
      if (-not $admitted.Count -or -not (Test-CanonicalDockerProjectOwnership `
        -Project $labels.'com.docker.compose.project' -WorkingDirectory $labels.'com.docker.compose.project.working_dir' `
        -AllowedProjects @($project) -AllowedWorkingDirectories @($RepoPath))) {
        throw "Compose container identity/checkout changed after admission: $($container.Id)"
      }
    }
  } finally {
    Pop-Location
  }
}

Export-ModuleMember -Function Assert-CanonicalComposeAdmission
