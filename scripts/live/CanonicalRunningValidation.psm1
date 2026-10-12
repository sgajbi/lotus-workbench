Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'CanonicalPortOwnership.psm1')

function Get-CanonicalRunningEvidenceHash {
  param([Parameter(Mandatory)][string]$Path)
  $hasher = [Security.Cryptography.SHA256]::Create()
  try {
    return ([BitConverter]::ToString($hasher.ComputeHash([IO.File]::ReadAllBytes($Path)))).Replace('-', '').ToLowerInvariant()
  } finally { $hasher.Dispose() }
}

function Assert-CanonicalRunningIdeaIdentity {
  param(
    [Parameter(Mandatory)]$Manifest,
    [Parameter(Mandatory)]$Operation,
    [Parameter(Mandatory)]$Container,
    [Parameter(Mandatory)]$Image,
    [Parameter(Mandatory)]$Version,
    [Parameter(Mandatory)]$Readiness,
    [Parameter(Mandatory)]$Seed,
    [Parameter(Mandatory)][string]$IdeaRepoPath
  )

  $source = @($Manifest.repositories | Where-Object { $_.repository -ceq 'lotus-idea' })
  if ($Manifest.schemaVersion -cne 'lotus.canonical-front-office.mainline-source-provenance.v1' -or
      $Manifest.passed -isnot [bool] -or $Manifest.passed -cne $true -or $source.Count -ne 1 -or
      $source[0].passed -cne $true -or $source[0].branch -cne 'main' -or
      $source[0].headSha -cnotmatch '\A[0-9a-f]{40}\z' -or
      $source[0].headSha -cne $source[0].expectedMainSha) {
    throw 'Running validation requires current mainline Idea source evidence.'
  }
  $expectedSha = [string]$source[0].headSha
  if ([string]$Operation.Scope.sources.'lotus-idea' -cne $expectedSha) {
    throw 'Running validation source differs from the admitted reservation.'
  }
  $admitted = @($Operation.Bindings | Where-Object {
    $_.kind -ceq 'container' -and $_.id -ceq $Container.id -and $_.project -ceq 'lotus-idea' -and
    (Test-CanonicalDockerProjectOwnership -Project $_.project -WorkingDirectory $_.checkout `
      -AllowedProjects @('lotus-idea') -AllowedWorkingDirectories @($IdeaRepoPath)) -and
    8330 -in $_.ports
  })
  if ($Container.id -cnotmatch '\A[0-9a-f]{64}\z' -or $Container.running -isnot [bool] -or $Container.running -cne $true -or
      $Container.project -cne 'lotus-idea' -or $Container.service -cne 'lotus-idea' -or
      -not (Test-CanonicalDockerProjectOwnership -Project $Container.project -WorkingDirectory $Container.checkout `
        -AllowedProjects @('lotus-idea') -AllowedWorkingDirectories @($IdeaRepoPath)) -or
      $admitted.Count -ne 1 -or @($Container.ports.'8330/tcp' | Where-Object { $_.HostPort -ceq '8330' }).Count -eq 0) {
    throw 'Running validation requires the exact admitted running Idea API container and port.'
  }
  $labels = $Image.labels
  $runId = [string]$Version.build.ciRunId
  $buildId = "$expectedSha.$runId"
  if ($Container.image -cnotmatch '\Asha256:[0-9a-f]{64}\z' -or $Image.id -cne $Container.image -or
      $labels.'org.opencontainers.image.revision' -cne $expectedSha -or
      $labels.'io.lotus.image.git.branch' -cne 'main' -or
      $labels.'org.opencontainers.image.source' -cne 'https://github.com/sgajbi/lotus-idea.git' -or
      $Version.service -cne 'lotus-idea' -or $Version.build.gitCommitSha -cne $expectedSha -or
      $Version.build.gitBranch -cne 'main' -or
      $runId -cnotmatch '\Acanonical-front-office-\d{4}-\d{2}-\d{2}-[0-9a-f]{32}\z' -or
      $labels.'io.lotus.image.ci.run_id' -cne $runId -or
      $labels.'io.lotus.image.build.id' -cne $buildId -or $Version.build.imageBuildId -cne $buildId -or
      $Seed.runId -cne $runId) {
    throw 'Running validation Idea source, image, runtime run or retained seed provenance mismatch.'
  }
  # Idea owns the local/test caller-authority exemption. A local admission marker
  # cannot replace trusted caller provenance for demo, staging or production.
  if ($Readiness.status -cne 'ready' -or $Readiness.runtimeProfile -cnotin @('local', 'test') -or
      $Readiness.processLocalRepositoryAllowed -isnot [bool] -or $Readiness.processLocalRepositoryAllowed -cne $true -or
      $Readiness.durableWriteRepositoryRequired -isnot [bool] -or $Readiness.durableWriteRepositoryRequired -cne $false -or
      @($Readiness.configurationBlockers).Count -ne 0) {
    throw 'Running validation requires ready Idea local/test caller authority; protected profiles are unsupported.'
  }
  return [pscustomobject]@{
    containerId = $Container.id; imageId = $Image.id; commitSha = $expectedSha
    branch = 'main'; runId = $runId; imageBuildId = $buildId; runtimeProfile = $Readiness.runtimeProfile
  }
}

function Read-CanonicalRunningIdeaIdentity {
  param(
    [Parameter(Mandatory)]$Manifest,
    [Parameter(Mandatory)]$Operation,
    [Parameter(Mandatory)]$Seed,
    [Parameter(Mandatory)][string]$IdeaRepoPath
  )
  # Deliberately select metadata only. Never inspect, emit or persist Config.Env.
  $ids = @(& docker ps --no-trunc -q --filter 'label=com.docker.compose.project=lotus-idea' --filter 'label=com.docker.compose.service=lotus-idea' 2>$null)
  if ($LASTEXITCODE -ne 0 -or $ids.Count -ne 1 -or $ids[0] -cnotmatch '\A[0-9a-f]{64}\z') {
    throw 'Running validation cannot resolve one canonical Idea API container.'
  }
  $containerFormat = '{"id":{{json .Id}},"image":{{json .Image}},"running":{{json .State.Running}},"project":{{json (index .Config.Labels "com.docker.compose.project")}},"service":{{json (index .Config.Labels "com.docker.compose.service")}},"checkout":{{json (index .Config.Labels "com.docker.compose.project.working_dir")}},"ports":{{json .NetworkSettings.Ports}}}'
  $containerJson = & docker inspect --format $containerFormat $ids[0] 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Running validation cannot inspect Idea container metadata.' }
  try { $container = $containerJson | ConvertFrom-Json -ErrorAction Stop }
  catch { throw 'Running validation received malformed Idea container metadata.' }
  $imageJson = & docker image inspect --format '{"id":{{json .Id}},"labels":{{json .Config.Labels}}}' $container.image 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Running validation cannot inspect immutable Idea image metadata.' }
  try { $image = $imageJson | ConvertFrom-Json -ErrorAction Stop }
  catch { throw 'Running validation received malformed Idea image metadata.' }
  $version = Invoke-RestMethod -Uri 'http://127.0.0.1:8330/version' -TimeoutSec 30
  $readiness = Invoke-RestMethod -Uri 'http://127.0.0.1:8330/health/ready' -TimeoutSec 30
  return Assert-CanonicalRunningIdeaIdentity -Manifest $Manifest -Operation $Operation -Seed $Seed `
    -Container $container -Image $image -Version $version -Readiness $readiness -IdeaRepoPath $IdeaRepoPath
}

function Invoke-WithCanonicalRunningCapability {
  param([Parameter(Mandatory)][scriptblock]$Action)
  $name = 'LOTUS_IDEA_CAPACITY_TRUSTED_CALLER_CONTEXT'
  $previous = [Environment]::GetEnvironmentVariable($name, 'Process')
  try {
    [Environment]::SetEnvironmentVariable($name, ('canonical-local-running-validation-' + [guid]::NewGuid().ToString('N')), 'Process')
    & $Action
  } finally {
    if ($null -eq $previous) { [Environment]::SetEnvironmentVariable($name, [NullString]::Value, 'Process') }
    else { [Environment]::SetEnvironmentVariable($name, $previous, 'Process') }
  }
}

Export-ModuleMember -Function Get-CanonicalRunningEvidenceHash, Assert-CanonicalRunningIdeaIdentity, Read-CanonicalRunningIdeaIdentity, Invoke-WithCanonicalRunningCapability
