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
      $source[0].passed -cne $true -or ($null -ne $source[0].branch -and $source[0].branch -cne 'main') -or
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

function ConvertFrom-CanonicalMetadataRecords {
  param([AllowEmptyCollection()][object[]]$Lines, [int]$Count, [string]$Kind)
  try {
    if ($Lines.Count -ne $Count -or @($Lines | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -ne 0) {
      throw 'Unexpected metadata record count.'
    }
    # A property wrapper preserves scalar types, nulls and nested arrays on both
    # shells. Decode records independently; one line cannot supply two fields.
    $records = New-Object object[] $Count
    for ($index = 0; $index -lt $Count; $index++) {
      $record = ConvertFrom-Json -InputObject ('{"value":' + $Lines[$index] + '}') -ErrorAction Stop
      if (@($record.PSObject.Properties).Count -ne 1) { throw 'Unexpected metadata fields.' }
      $records[$index] = $record.value
    }
    return ,$records
  } catch { throw "Running validation received malformed Idea $Kind metadata." }
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
  # Go raw-string label keys avoid double quotes stripped by Windows PowerShell 5.
  # JSON strings escape embedded newlines, so each selected value is one record.
  $containerFormat = '{{json .Id}}{{println}}{{json .Image}}{{println}}{{json .State.Running}}{{println}}{{json (index .Config.Labels `com.docker.compose.project`)}}{{println}}{{json (index .Config.Labels `com.docker.compose.service`)}}{{println}}{{json (index .Config.Labels `com.docker.compose.project.working_dir`)}}{{println}}{{json .NetworkSettings.Ports}}'
  $containerLines = @(& docker inspect --format $containerFormat $ids[0] 2>$null)
  if ($LASTEXITCODE -ne 0) { throw 'Running validation cannot inspect Idea container metadata.' }
  try {
    $fields = ConvertFrom-CanonicalMetadataRecords -Lines $containerLines -Count 7 -Kind 'container'
    if ($fields[0] -isnot [string] -or $fields[1] -isnot [string] -or $fields[2] -isnot [bool] -or
        $fields[3] -isnot [string] -or $fields[4] -isnot [string] -or $fields[5] -isnot [string] -or
        $null -eq $fields[6] -or $fields[6].GetType() -ne [System.Management.Automation.PSCustomObject]) { throw 'Invalid container field types.' }
    $container = [pscustomobject]@{
      id = $fields[0]; image = $fields[1]; running = $fields[2]
      project = $fields[3]; service = $fields[4]; checkout = $fields[5]; ports = $fields[6]
    }
  }
  catch { throw 'Running validation received malformed Idea container metadata.' }
  $imageLines = @(& docker image inspect --format '{{json .Id}}{{println}}{{json .Config.Labels}}' $container.image 2>$null)
  if ($LASTEXITCODE -ne 0) { throw 'Running validation cannot inspect immutable Idea image metadata.' }
  try {
    $fields = ConvertFrom-CanonicalMetadataRecords -Lines $imageLines -Count 2 -Kind 'image'
    if ($fields[0] -isnot [string] -or $null -eq $fields[1] -or
        $fields[1].GetType() -ne [System.Management.Automation.PSCustomObject]) { throw 'Invalid image field types.' }
    foreach ($label in @('org.opencontainers.image.revision', 'io.lotus.image.git.branch',
        'org.opencontainers.image.source', 'io.lotus.image.ci.run_id', 'io.lotus.image.build.id')) {
      if ($fields[1].$label -isnot [string]) { throw 'Invalid image label types.' }
    }
    $image = [pscustomobject]@{ id = $fields[0]; labels = $fields[1] }
  }
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
