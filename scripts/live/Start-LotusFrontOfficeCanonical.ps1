[CmdletBinding()]
param(
  [string]$ProjectsRoot = "C:\Users\Sandeep\projects",
  [string]$RuntimeHolder = $env:LOTUS_CANONICAL_RUNTIME_HOLDER,
  [string]$WorkbenchRepoPath,
  [string]$PortfolioId = "PB_SG_GLOBAL_BAL_001",
  [string]$BenchmarkCode = "BMK_PB_GLOBAL_BALANCED_60_40",
  [string]$ScreenshotDirectory = "",
  [string]$CanonicalEvidenceDirectory = "",
  [string]$LotusAiEnvFile = ".env.example",
  [int]$SeedWaitSeconds = 900,
  [string[]]$LocalApps = @(),
  [switch]$CleanCoreState,
  [switch]$SkipSeedCleanup,
  [switch]$BuildImages,
  [ValidateSet(1, 2)][int]$BuildConcurrency = 1,
  [switch]$CoreManageOnly,
  [switch]$PortOwnershipPreflightOnly,
  [switch]$RequireMainlineSources,
  [switch]$RunValidation
)

$ErrorActionPreference = "Stop"
$selectedWorkbench = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if ($WorkbenchRepoPath -and [System.IO.Path]::GetFullPath($WorkbenchRepoPath) -ne $selectedWorkbench) {
  throw 'Selected Workbench checkout does not match the executing script.'
}
$WorkbenchRepoPath = $selectedWorkbench
Import-Module (Join-Path $PSScriptRoot "CanonicalPortOwnership.psm1") -Force
Import-Module (Join-Path $PSScriptRoot 'CanonicalComposeAdmission.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'CanonicalBuildPlan.psm1') -Force
$prebuiltRepositories = @{}
$runtimePhases = [System.Collections.ArrayList]::new()
$runtimeTimingId = [guid]::NewGuid().ToString('N')

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
$ingressCaddyfile = Join-Path $platformRepo "platform-stack\\dev-ingress\\Caddyfile.direct-host"
$canonicalContractPath = Join-Path $platformRepo "context\\contracts\\canonical-front-office-demo-data-contract.json"
$canonicalEvidenceRoot = if ([string]::IsNullOrWhiteSpace($CanonicalEvidenceDirectory)) {
  Join-Path $workbenchRepo "output\\canonical-front-office"
} elseif ([System.IO.Path]::IsPathRooted($CanonicalEvidenceDirectory)) {
  $CanonicalEvidenceDirectory
} else {
  Join-Path $workbenchRepo $CanonicalEvidenceDirectory
}
$mainlineSourcePreflightPath = $null
$mainlineSourceRuntimePath = $null
$ideaCapacityEvidenceRoot = $canonicalEvidenceRoot
if ($RequireMainlineSources) {
  $composeUpCommand = "docker compose up -d --build --force-recreate"
} elseif ($BuildImages) {
  $composeUpCommand = "docker compose up -d --build"
} else {
  $composeUpCommand = "docker compose up -d"
}
$localAppSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($item in $LocalApps) {
  foreach ($appName in ($item -split ",")) {
    $trimmed = $appName.Trim()
    if (-not [string]::IsNullOrWhiteSpace($trimmed)) {
      [void]$localAppSet.Add($trimmed)
    }
  }
}
if ($BuildConcurrency -gt 1 -and ($CoreManageOnly -or $localAppSet.Count -gt 0 -or -not ($BuildImages -or $RequireMainlineSources))) {
  throw 'Bounded image builds require a full Docker-backed BuildImages or RequireMainlineSources run.'
}

if ($RequireMainlineSources) {
  if ($CoreManageOnly) {
    throw "RequireMainlineSources requires the complete canonical front-office service set."
  }
  if ($localAppSet.Count -gt 0) {
    throw "RequireMainlineSources cannot be combined with LocalApps; local-app evidence is branch-local by design."
  }
}

function Invoke-MainlineSourceProvenancePreflight {
  $mainlineProvenanceRunId = [guid]::NewGuid().ToString("N")
  $mainlineProvenanceRoot = Join-Path `
    ([System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::LocalApplicationData)) `
    "Lotus\\canonical-front-office\\mainline-source-provenance\\$mainlineProvenanceRunId"
  New-Item -ItemType Directory -Path $mainlineProvenanceRoot -Force | Out-Null
  $scriptPath = Join-Path $workbenchRepo "scripts\\live\\validation\\mainline-source-provenance.mjs"
  $preflightPath = Join-Path $mainlineProvenanceRoot "mainline-source-provenance.json"
  $runtimePath = Join-Path $mainlineProvenanceRoot "mainline-source-provenance-runtime.json"
  & node $scriptPath --projects-root $ProjectsRoot --workbench-repo-path $workbenchRepo --output $preflightPath
  if ($LASTEXITCODE -ne 0) {
    throw "Canonical mainline source provenance preflight failed. No Docker build, seed, or validation was started."
  }

  return [ordered]@{
    EvidenceRoot = $mainlineProvenanceRoot
    ScriptPath = $scriptPath
    PreflightPath = $preflightPath
    RuntimePath = $runtimePath
  }
}

function Invoke-RepoCommand {
  param(
    [string]$RepoPath,
    [string]$Command
  )

  Push-Location $RepoPath
  try {
    $global:LASTEXITCODE = 0
    Invoke-Expression $Command
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed with exit code $LASTEXITCODE in '$RepoPath': $Command"
    }
  } finally {
    Pop-Location
  }
}

function Invoke-CanonicalComposeCommand {
  param([string]$RepoPath, [string]$Command)
  Invoke-CanonicalReservation -Action preflight-operation -ProjectsRoot $ProjectsRoot -Holder $RuntimeHolder `
    -WorkbenchRepoPath $workbenchRepo -OperationToken $runtimeOperation.Token -RuntimeMode $runtimeMode | Out-Host
  Assert-CanonicalComposeAdmission -RepoPath $RepoPath -Operation $runtimeOperation
  Invoke-RepoCommand $RepoPath $Command
}

function Test-HttpReady {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 300
  } catch {
    return $false
  }
}

function Get-GitRepositoryIdentity {
  param([string]$RepoPath)

  $commitSha = (& git -C $RepoPath rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($commitSha)) {
    throw "Unable to resolve Git commit for $RepoPath."
  }
  $branch = (& git -C $RepoPath branch --show-current).Trim()
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to resolve Git branch for $RepoPath."
  }
  if ([string]::IsNullOrWhiteSpace($branch)) {
    $originMainCommitSha = (& git -C $RepoPath rev-parse refs/remotes/origin/main).Trim()
    if ($LASTEXITCODE -ne 0 -or $commitSha -ne $originMainCommitSha) {
      throw "Detached Git checkout for $RepoPath is not exactly at origin/main."
    }
    $branch = "main"
  }
  return [ordered]@{ CommitSha = $commitSha; Branch = $branch }
}

function Wait-HttpReady {
  param(
    [string]$Url,
    [string]$Description,
    [int]$TimeoutSeconds = 120
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-HttpReady $Url) {
      return
    }
    Start-Sleep -Seconds 2
  }
  throw "$Description did not become ready at $Url within $TimeoutSeconds seconds."
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
  }
}

function Stop-HostProcessOnPort {
  param(
    [int]$Port,
    [string]$Description
  )

  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if (-not $connections) {
    return
  }

  $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $processIds) {
    if (-not $processId) {
      continue
    }

    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if (-not $process) {
      Write-Host "Skipping stale $Description listener on :$Port (PID $processId) because the process already exited."
      continue
    }
    if ($process -and $process.ProcessName -match "^(com\.docker|docker|vpnkit)") {
      Write-Host "Leaving Docker-owned $Description listener on :$Port (PID $processId) in place."
      continue
    }

    Write-Host "Stopping stale $Description process on :$Port (PID $processId) ..."
    $identity = "$($process.Id):$($process.StartTime.ToUniversalTime().ToString('o'))"
    if (-not @($runtimeOperation.Bindings | Where-Object {
      $_.kind -eq 'host-process' -and $_.id -eq $identity -and $Port -in $_.ports
    }).Count) { throw "Host process identity changed after admission: $identity" }
    Stop-Process -InputObject $process -Force -ErrorAction Stop
  }

  Start-Sleep -Seconds 2
}

function Get-CanonicalRequiredPortPlan {
  param([switch]$CoreManageOnlyMode)

  $plan = [System.Collections.Generic.List[object]]::new()
  foreach ($port in @(2181, 3300, 55432, 8080, 8084, 8085, 8087, 8090, 8200, 8201, 8202, 8209, 8210, 9092, 9093, 9190)) {
    $plan.Add([pscustomobject]@{
      Port = $port
      Description = "lotus-core"
      AllowedDockerProjects = @("lotus-core-app-local")
      AllowedDockerWorkingDirectories = @($coreRepo)
      AllowedContainerNames = @()
      ReplaceableHostProcess = $false
    })
  }

  $plan.Add([pscustomobject]@{
    Port = 8001
    Description = "lotus-manage"
    AllowedDockerProjects = @("lotus-manage")
    AllowedDockerWorkingDirectories = @($manageRepo)
    AllowedContainerNames = @()
    ReplaceableHostProcess = $true
  })
  $plan.Add([pscustomobject]@{
    Port = 80
    Description = "direct ingress"
    AllowedDockerProjects = @()
    AllowedDockerWorkingDirectories = @()
    AllowedContainerNames = @("lotus-direct-dev-ingress")
    ReplaceableHostProcess = $false
  })

  if ($CoreManageOnlyMode) {
    return $plan.ToArray()
  }

  $fullServicePorts = @(
    @{ Port = 5435; Description = "lotus-performance"; Project = "lotus-performance"; Repo = $performanceRepo; Replaceable = $false },
    @{ Port = 8002; Description = "lotus-performance"; Project = "lotus-performance"; Repo = $performanceRepo; Replaceable = $false },
    @{ Port = 8130; Description = "lotus-risk"; Project = "lotus-risk"; Repo = $riskRepo; Replaceable = $false },
    @{ Port = 8140; Description = "lotus-ai"; Project = "lotus-ai"; Repo = $aiRepo; Replaceable = $false },
    @{ Port = 8000; Description = "lotus-advise"; Project = "lotus-advise"; Repo = $adviseRepo; Replaceable = $false },
    @{ Port = 5439; Description = "lotus-report"; Project = "lotus-report"; Repo = $reportRepo; Replaceable = $false },
    @{ Port = 8300; Description = "lotus-report"; Project = "lotus-report"; Repo = $reportRepo; Replaceable = $false },
    @{ Port = 55433; Description = "lotus-idea"; Project = "lotus-idea"; Repo = $ideaRepo; Replaceable = $false },
    @{ Port = 8330; Description = "lotus-idea"; Project = "lotus-idea"; Repo = $ideaRepo; Replaceable = $false },
    @{ Port = 8150; Description = "lotus-archive"; Project = "lotus-archive"; Repo = $archiveRepo; Replaceable = $true },
    @{ Port = 8310; Description = "lotus-render"; Project = "lotus-render"; Repo = $renderRepo; Replaceable = $true },
    @{ Port = 8100; Description = "lotus-gateway"; Project = "lotus-gateway"; Repo = $gatewayRepo; Replaceable = $true },
    @{ Port = 3000; Description = "lotus-workbench"; Project = "lotus-workbench"; Repo = $workbenchRepo; Replaceable = $true }
  )
  foreach ($servicePort in $fullServicePorts) {
    $plan.Add([pscustomobject]@{
      Port = $servicePort.Port
      Description = $servicePort.Description
      AllowedDockerProjects = @($servicePort.Project)
      AllowedDockerWorkingDirectories = @($servicePort.Repo)
      AllowedContainerNames = @()
      ReplaceableHostProcess = $servicePort.Replaceable
    })
  }

  return $plan.ToArray()
}

function Get-DockerPublishedPortOwners {
  $runningContainerIds = @(& docker ps --quiet 2>&1)
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to inspect Docker port ownership before canonical startup. Docker reported: $($runningContainerIds -join ' ')"
  }
  if ($runningContainerIds.Count -eq 0) {
    return
  }

  $inspectionOutput = @(& docker inspect @runningContainerIds 2>&1)
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to inspect running Docker containers before canonical startup."
  }
  # Windows PowerShell 5.1 returns a top-level JSON array as one Object[] value.
  # Do not wrap it in another array or container metadata becomes inaccessible.
  $inspections = ($inspectionOutput -join [Environment]::NewLine) | ConvertFrom-Json
  foreach ($inspection in $inspections) {
    foreach ($bindingProperty in $inspection.HostConfig.PortBindings.PSObject.Properties) {
      foreach ($binding in @($bindingProperty.Value)) {
        if ([string]::IsNullOrWhiteSpace([string]$binding.HostPort)) {
          continue
        }

        $labels = $inspection.Config.Labels
        [pscustomobject]@{
          Port = [int]$binding.HostPort
          Id = [string]$inspection.Id
          Name = ([string]$inspection.Name).TrimStart("/")
          Project = if ($labels) { [string]$labels.'com.docker.compose.project' } else { "" }
          WorkingDirectory = if ($labels) { [string]$labels.'com.docker.compose.project.working_dir' } else { "" }
        }
      }
    }
  }
}

function Test-CanonicalPortOwnership {
  param([switch]$CoreManageOnlyMode)

  $conflicts = [System.Collections.Generic.List[string]]::new()
  $requiredPorts = Get-CanonicalRequiredPortPlan -CoreManageOnlyMode:$CoreManageOnlyMode
  $publishedPortOwners = @(Get-DockerPublishedPortOwners)
  $hostListeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue)
  Write-Host "Checking ownership of $($requiredPorts.Count) canonical host ports before startup ..."

  foreach ($requiredPort in $requiredPorts) {
    $dockerOwners = @($publishedPortOwners | Where-Object { $_.Port -eq $requiredPort.Port })
    if ($dockerOwners.Count -gt 0) {
      foreach ($owner in $dockerOwners) {
        $projectAllowed = Test-CanonicalDockerProjectOwnership `
          -Project $owner.Project `
          -WorkingDirectory $owner.WorkingDirectory `
          -AllowedProjects $requiredPort.AllowedDockerProjects `
          -AllowedWorkingDirectories $requiredPort.AllowedDockerWorkingDirectories
        $containerAllowed = $requiredPort.AllowedContainerNames -contains $owner.Name
        if (-not $projectAllowed -and -not $containerAllowed) {
          $project = if ([string]::IsNullOrWhiteSpace($owner.Project)) { "<none>" } else { $owner.Project }
          $workingDirectory = if ([string]::IsNullOrWhiteSpace($owner.WorkingDirectory)) { "<unknown>" } else { $owner.WorkingDirectory }
          $conflicts.Add(
            ":$($requiredPort.Port) ($($requiredPort.Description)) is published by foreign container '$($owner.Name)' " +
            "[project '$project', working directory '$workingDirectory', id '$($owner.Id.Substring(0, 12))']."
          )
        }
      }
      continue
    }

    $connections = @($hostListeners | Where-Object { $_.LocalPort -eq $requiredPort.Port })
    $processIds = @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
    foreach ($processId in $processIds) {
      if (-not $processId) {
        continue
      }
      $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
      if (-not $process) {
        Write-Host "Ignoring stale $($requiredPort.Description) listener record on :$($requiredPort.Port) because PID $processId already exited."
        continue
      }
      $processName = $process.ProcessName
      $isDockerProcess = $process -and $process.ProcessName -match "^(com\.docker|docker|vpnkit)"
      if ($requiredPort.ReplaceableHostProcess -and -not $isDockerProcess) {
        Write-Host "Canonical startup may replace stale $($requiredPort.Description) listener on :$($requiredPort.Port) (PID $processId, process '$processName')."
        continue
      }
      $conflicts.Add(
        ":$($requiredPort.Port) ($($requiredPort.Description)) is owned by host process '$processName' (PID $processId) " +
        "and cannot be replaced safely."
      )
    }
  }

  if ($conflicts.Count -gt 0) {
    $details = ($conflicts | ForEach-Object { " - $_" }) -join [Environment]::NewLine
    throw (
      "Canonical port preflight failed before hosts, builds, containers, or processes were changed." +
      [Environment]::NewLine + $details + [Environment]::NewLine +
      "Stop or remap the reported owner, then retry. Canonical startup did not stop any foreign container or process."
    )
  }

  Write-Host "Canonical port ownership preflight passed."
}

function Test-LocalApp {
  param([string]$AppName)

  return $localAppSet.Contains($AppName)
}

function Get-CanonicalFrontOfficeDatePolicy {
  if (-not (Test-Path $canonicalContractPath)) {
    throw "Canonical front-office demo data contract not found: $canonicalContractPath"
  }

  $contract = Get-Content -Raw $canonicalContractPath | ConvertFrom-Json
  $asOfDate = [string]$contract.date_policy.canonical_as_of_date
  if ([string]::IsNullOrWhiteSpace($asOfDate)) {
    throw "Canonical front-office demo data contract is missing date_policy.canonical_as_of_date."
  }

  return [ordered]@{
    AsOfDate = $asOfDate
    GeneratedAtUtc = "$($asOfDate)T10:00:00Z"
  }
}

function Invoke-ComposeUp {
  param(
    [string]$RepoPath,
    [hashtable]$Environment = @{},
    [switch]$Build
  )

  $composeCommand = $composeUpCommand
  if ($Build -and $composeCommand -notmatch "(?:^|\s)--build(?:\s|$)") {
    $composeCommand = "$composeCommand --build"
  }
  if ($prebuiltRepositories.ContainsKey($RepoPath)) {
    $identity = Get-GitRepositoryIdentity -RepoPath $RepoPath
    if ($identity.CommitSha -cne $prebuiltRepositories[$RepoPath]) {
      throw 'Prebuilt canonical source changed before startup.'
    }
    $composeCommand = ($composeCommand -replace '\s--build(?=\s|$)', '') + ' --no-build'
  }

  $stage = if ($composeCommand -match '(?:^|\s)--build(?:\s|$)') { 'compose-build-start' } else { 'compose-start' }
  Invoke-CanonicalRuntimePhase -Records $runtimePhases -Name "$stage/$(Split-Path -Leaf $RepoPath)" -Action {
    Invoke-WithProcessEnvironment -Environment $Environment -ScriptBlock {
      Invoke-CanonicalComposeCommand $RepoPath $composeCommand
    }
  }
}

function Get-CanonicalDpmCommandCenterEnvironment {
  if (-not (Test-Path $canonicalContractPath)) {
    throw "Canonical front-office demo data contract not found: $canonicalContractPath"
  }

  $contract = Get-Content -Raw $canonicalContractPath | ConvertFrom-Json
  $context = $contract.dpm_command_center
  $requiredValues = @{
    WORKBENCH_BFF_TENANT_ID = [string]$context.workbench_caller_tenant_id
    WORKBENCH_DPM_COMMAND_CENTER_TENANT_ID = [string]$context.tenant_id
    WORKBENCH_DPM_COMMAND_CENTER_PORTFOLIO_MANAGER_ID = [string]$context.portfolio_manager_id
    WORKBENCH_DPM_COMMAND_CENTER_BOOK_ID = [string]$context.book_id
    WORKBENCH_DPM_COMMAND_CENTER_AS_OF_DATE = [string]$context.command_center_as_of_date
  }
  foreach ($entry in $requiredValues.GetEnumerator()) {
    if ([string]::IsNullOrWhiteSpace($entry.Value)) {
      throw "Canonical front-office demo data contract is missing the DPM value for $($entry.Key)."
    }
  }
  return $requiredValues
}

function Get-DockerWorkbenchEnvironment {
  $environment = $canonicalDpmCommandCenterEnvironment.Clone()
  $environment.BFF_BASE_URL = "http://host.docker.internal:8100"
  $environment.LOTUS_ENVIRONMENT = "dev"
  $environment.WORKBENCH_IDEA_AUTH_MODE = "development_configured"
  return $environment
}

function Invoke-IndependentImageBuilds {
  if ($BuildConcurrency -eq 1) { return } # Preserve the measured serial fallback by default.
  $plan = @()
  foreach ($repo in @($performanceRepo,$riskRepo,$adviseRepo,$reportRepo,$archiveRepo,$renderRepo,$gatewayRepo,$workbenchRepo)) {
    $environment = if ($repo -eq $workbenchRepo) { Get-DockerWorkbenchEnvironment } else { @{} }
    $identity = Get-GitRepositoryIdentity -RepoPath $repo
    $plan += [pscustomobject]@{Name=(Split-Path -Leaf $repo); RepoPath=$repo; CommitSha=$identity.CommitSha; Environment=$environment}
  }
  $assertAdmission = {
    Assert-CanonicalRuntimeOperationFence -ProjectsRoot $ProjectsRoot -OperationToken $runtimeOperation.Token -Fence $runtimeOperation.Lock
    Invoke-CanonicalReservation -Action preflight-operation -ProjectsRoot $ProjectsRoot -Holder $RuntimeHolder `
      -WorkbenchRepoPath $workbenchRepo -OperationToken $runtimeOperation.Token -RuntimeMode $runtimeMode | Out-Null
  }
  $buildReceipt = Join-Path $canonicalEvidenceRoot "build-plan-$([guid]::NewGuid().ToString('N')).json"
  Invoke-CanonicalBuildPlan -Plan $plan -Concurrency $BuildConcurrency -AssertAdmission $assertAdmission -EvidencePath $buildReceipt
  foreach ($entry in $plan) { $prebuiltRepositories[$entry.RepoPath] = $entry.CommitSha }
}

function Invoke-WithProcessEnvironment {
  param(
    [hashtable]$Environment,
    [scriptblock]$ScriptBlock
  )

  $previousValues = @{}
  foreach ($key in $Environment.Keys) {
    $previousValues[$key] = [Environment]::GetEnvironmentVariable($key, "Process")
    [Environment]::SetEnvironmentVariable($key, $Environment[$key], "Process")
  }

  try {
    & $ScriptBlock
  } finally {
    foreach ($key in $Environment.Keys) {
      [Environment]::SetEnvironmentVariable($key, $previousValues[$key], "Process")
    }
  }
}

function Start-LocalUvicornService {
  param(
    [string]$RepoPath,
    [string]$ServiceName,
    [string]$AppModule,
    [int]$Port
  )

  Stop-HostProcessOnPort -Port $Port -Description $ServiceName

  $python = if (Test-Path (Join-Path $RepoPath ".venv\\Scripts\\python.exe")) {
    Join-Path $RepoPath ".venv\\Scripts\\python.exe"
  } else {
    "C:\\Python313\\python.exe"
  }
  $out = Join-Path $RepoPath "$ServiceName-$Port.dev.out.log"
  $err = Join-Path $RepoPath "$ServiceName-$Port.dev.err.log"
  if (Test-Path $out) { Remove-Item $out -Force }
  if (Test-Path $err) { Remove-Item $err -Force }

  $previousPythonPath = $env:PYTHONPATH
  $env:PYTHONPATH = "$(Join-Path $RepoPath "src");$RepoPath"
  try {
    Start-Process -FilePath $python `
      -ArgumentList "-m","uvicorn",$AppModule,"--app-dir","src","--host","0.0.0.0","--port","$Port" `
      -WorkingDirectory $RepoPath `
      -RedirectStandardOutput $out `
      -RedirectStandardError $err `
      -WindowStyle Hidden | Out-Null
  } finally {
    $env:PYTHONPATH = $previousPythonPath
  }

  Start-Sleep -Seconds 5
  if (-not (Test-HttpReady "http://127.0.0.1:$Port/health/ready")) {
    throw "$ServiceName local startup failed readiness on port $Port."
  }
}

function Start-WorkbenchDevServer {
  Stop-HostProcessOnPort -Port 3000 -Description "Workbench"
  Write-Host "Starting Workbench local dev server on :3000 ..."
  $out = Join-Path $workbenchRepo "workbench-3000.dev.out.log"
  $err = Join-Path $workbenchRepo "workbench-3000.dev.err.log"
  if (Test-Path $out) { Remove-Item $out -Force }
  if (Test-Path $err) { Remove-Item $err -Force }
  $workbenchEnvironment = $canonicalDpmCommandCenterEnvironment.Clone()
  $workbenchEnvironment.BFF_BASE_URL = "http://gateway.dev.lotus"
  $workbenchEnvironment.LOTUS_ENVIRONMENT = "dev"
  $workbenchEnvironment.WORKBENCH_IDEA_AUTH_MODE = "development_configured"
  $workbenchEnvironment.NEXT_TELEMETRY_DISABLED = "1"
  Invoke-WithProcessEnvironment -Environment $workbenchEnvironment -ScriptBlock {
    Start-Process -FilePath "npm.cmd" `
      -ArgumentList "run","dev","--","--hostname","0.0.0.0","--port","3000" `
      -WorkingDirectory $workbenchRepo `
      -RedirectStandardOutput $out `
      -RedirectStandardError $err `
      -WindowStyle Hidden | Out-Null
  }
  Start-Sleep -Seconds 10
}

function Resolve-LotusAiEnvFile {
  param([string]$EnvFile)

  if ([string]::IsNullOrWhiteSpace($EnvFile)) {
    return ""
  }

  $resolved = if ([System.IO.Path]::IsPathRooted($EnvFile)) {
    $EnvFile
  } else {
    Join-Path $aiRepo $EnvFile
  }
  if (-not (Test-Path $resolved)) {
    throw "Lotus AI env file not found: $resolved"
  }
  return $resolved
}

function Start-CanonicalAi {
  param([string]$EnvFile)
  $resolved = Resolve-LotusAiEnvFile -EnvFile $EnvFile
  $environment = @{}
  if ($resolved) { $environment.LOTUS_AI_ENV_FILE = $resolved }
  Invoke-ComposeUp $aiRepo $environment
}

function Start-CanonicalManage {
  $localManageEnvironment = @{
    LOTUS_MANAGE_HOST_PORT = "8001"
    DPM_CAP_INPUT_MODE_PORTFOLIO_ID_ENABLED = "true"
    DPM_STATEFUL_CORE_SOURCING_ENABLED = "true"
    DPM_WORKFLOW_ENABLED = "true"
    DPM_CORE_BASE_URL = "http://core-control.dev.lotus"
    DPM_CORE_QUERY_BASE_URL = "http://core-query.dev.lotus"
  }
  $dockerManageEnvironment = $localManageEnvironment.Clone()
  $dockerManageEnvironment["DPM_CORE_BASE_URL"] = "http://host.docker.internal:8202"
  $dockerManageEnvironment["DPM_CORE_QUERY_BASE_URL"] = "http://host.docker.internal:8201"

  if (Test-LocalApp "manage") {
    Invoke-CanonicalComposeCommand $manageRepo "docker compose down --remove-orphans"
    Write-Host "Starting canonical lotus-manage locally on :8001 ..."
    Invoke-WithProcessEnvironment -Environment $localManageEnvironment -ScriptBlock {
      & (Join-Path $manageRepo "scripts\\Start-CanonicalManage.ps1") -Port 8001
    }
    if ($LASTEXITCODE -ne 0) {
      throw "Canonical lotus-manage local startup failed with exit code $LASTEXITCODE."
    }
    return
  }

  Stop-HostProcessOnPort -Port 8001 -Description "lotus-manage"
  Invoke-ComposeUp $manageRepo $dockerManageEnvironment
}

function Start-DirectIngress {
  Write-Host "Ensuring direct ingress container is running..."
  Remove-ContainerIfPresent "lotus-direct-dev-ingress"
  docker run -d --name lotus-direct-dev-ingress -p 80:80 -v "${ingressCaddyfile}:/etc/caddy/Caddyfile" caddy:2.8.4 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Canonical direct-ingress startup failed with exit code $LASTEXITCODE." }
}

function Invoke-CanonicalCoreSeed {
  param([switch]$IngestOnly)

  $seedCommand = "python tools/front_office_portfolio_seed.py --portfolio-id $PortfolioId --start-date 2025-03-31 --end-date 2026-04-10 --benchmark-start-date 2025-01-06 --wait-seconds $SeedWaitSeconds"
  if ($IngestOnly) {
    $seedCommand = "$seedCommand --ingest-only"
  }
  if ($SkipSeedCleanup) {
    $seedCommand = "$seedCommand --skip-cleanup"
  }

  Write-Host "Seeding governed front-office portfolio data for $PortfolioId ..."
  $corePythonPathEntries = @(
    $coreRepo,
    (Join-Path $coreRepo "src\libs\portfolio-common")
  )
  if (-not [string]::IsNullOrWhiteSpace($env:PYTHONPATH)) {
    $corePythonPathEntries += $env:PYTHONPATH
  }
  Invoke-WithProcessEnvironment -Environment @{
    PYTHONPATH = ($corePythonPathEntries -join [System.IO.Path]::PathSeparator)
  } -ScriptBlock {
    Invoke-RepoCommand $coreRepo $seedCommand
  }
}

function Invoke-DpmCommandCenterSeed {
  Write-Host "Seeding governed DPM command-center and action-register evidence for $PortfolioId ..."
  & (Join-Path $platformRepo 'automation/Invoke-DpmCommandCenterSeed.ps1') `
    -PortfolioId $PortfolioId -ProjectsRoot $ProjectsRoot -WorkbenchRepoPath $workbenchRepo `
    -RuntimeHolder $RuntimeHolder -RuntimeOperationToken $runtimeOperation.Token -RuntimeOperationFence $runtimeOperation.Lock -RuntimeMode $runtimeMode
  if ($LASTEXITCODE -ne 0) { throw "Canonical nested DPM seed failed with exit code $LASTEXITCODE." }
}

function Get-CanonicalTextSha256 {
  param([Parameter(Mandatory = $true)][string]$Value)

  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
    return ([System.BitConverter]::ToString($sha256.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant()
  }
  finally {
    $sha256.Dispose()
  }
}

function Invoke-CanonicalIdeaSeed {
  $ideaBaseUrl = "http://127.0.0.1:8330"
  $datePolicy = Get-CanonicalFrontOfficeDatePolicy
  $asOfDate = $datePolicy.AsOfDate
  $deadline = (Get-Date).AddSeconds(120)
  while ((Get-Date) -lt $deadline) {
    if (Test-HttpReady "$ideaBaseUrl/health/ready") {
      break
    }
    Start-Sleep -Seconds 2
  }
  if (-not (Test-HttpReady "$ideaBaseUrl/health/ready")) {
    throw "lotus-idea did not become ready before canonical advisor queue seed."
  }
  # Capture source and evaluation time only after the service is ready. Image-build
  # duration must not age current-run source evidence or candidate evaluation.
  $sourceObservedAtUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
  $evaluatedAtUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

  $sourceRef = {
    param([string]$ProductId)
    $sourceObservationIdentity = "$ProductId|$PortfolioId|$asOfDate|$ideaCanonicalRunId"
    return @{
      productId = $ProductId
      sourceSystem = "lotus-core"
      productVersion = "v1"
      route = "/source/$ProductId"
      asOfDate = $asOfDate
      generatedAtUtc = $sourceObservedAtUtc
      contentHash = "sha256:$(Get-CanonicalTextSha256 -Value $sourceObservationIdentity)"
      dataQualityStatus = "complete"
      freshness = "current"
    }
  }

  $payload = @{
    asOfDate = $asOfDate
    evaluatedAtUtc = $evaluatedAtUtc
    sourceReportedCashWeight = "0.18"
    sourceEvidence = @{
      portfolioStateRef = & $sourceRef "lotus-core:PortfolioStateSnapshot:v1"
      holdingsRef = & $sourceRef "lotus-core:HoldingsAsOf:v1"
      cashMovementRef = & $sourceRef "lotus-core:PortfolioCashMovementSummary:v1"
      cashflowProjectionRef = & $sourceRef "lotus-core:PortfolioCashflowProjection:v1"
    }
    accessScope = @{
      tenantId = "tenant-private-bank-sg"
      bookId = "book-advisor-001"
      portfolioId = $PortfolioId
      clientId = "client-001"
    }
    entitlementAllowed = $true
  }
  $headers = @{
    "X-Caller-Subject" = "canonical-front-office-seed"
    "X-Caller-Capabilities" = "idea.candidate.persist"
    "X-Correlation-Id" = "corr-canonical-idea-seed"
    "Idempotency-Key" = "canonical-idea-high-cash:$($PortfolioId):$ideaCanonicalRunId"
  }

  Write-Host "Seeding governed Lotus Idea advisor queue candidate for $PortfolioId ..."
  $response = Invoke-RestMethod `
    -Method Post `
    -Uri "$ideaBaseUrl/api/v1/idea-signals/high-cash/evaluate-and-persist" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body ($payload | ConvertTo-Json -Depth 12)

  $decision = $response.persistence.decision
  # lotus-idea's autonomous signal-ingestion worker may have already persisted the
  # candidate from the seeded Core data; the manual seed then reconciles against the
  # existing business aggregate and evidence_refreshed / material_version_created are
  # persisted outcomes of that reconciliation, not failures (owner vocabulary:
  # lotus-idea src/app/domain/persistence_models.py CandidatePersistenceDecision).
  # recurrent_condition_reopened is deliberately NOT accepted: it means a candidate a
  # PREVIOUS run drove to a terminal status was reopened, so certifying it as
  # current-run evidence would launder stale identity through the run-id stamp.
  $persistedDecisions = @(
    "accepted",
    "replayed",
    "duplicate_candidate",
    "evidence_refreshed",
    "material_version_created"
  )
  if ($decision -eq "recurrent_condition_reopened") {
    throw ("Canonical Lotus Idea seed reopened a terminal candidate from an earlier " +
      "run; the persisted Idea volume holds prior-run lifecycle state. Re-run with " +
      "clean Idea volumes so the canonical evidence is provably current-run.")
  }
  if ($decision -notin $persistedDecisions) {
    throw "Canonical Lotus Idea seed did not persist an advisor queue candidate. Decision: $decision"
  }
  $candidateId = [string]$response.persistence.candidateId
  if ([string]::IsNullOrWhiteSpace($candidateId)) {
    throw "Canonical Lotus Idea seed returned no persisted candidate identity."
  }

  $lifecycleObservedAtUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
  & node (Join-Path $PSScriptRoot "invoke-idea-candidate-lifecycle-seed.mjs") `
    --idea-base-url $ideaBaseUrl `
    --candidate-id $candidateId `
    --observed-at-utc $lifecycleObservedAtUtc `
    --tenant-id $payload.accessScope.tenantId `
    --book-id $payload.accessScope.bookId `
    --portfolio-id $payload.accessScope.portfolioId `
    --client-id $payload.accessScope.clientId
  if ($LASTEXITCODE -ne 0) {
    throw "Canonical Lotus Idea lifecycle preparation failed with exit code $LASTEXITCODE."
  }

  $queueHeaders = @{
    "X-Caller-Subject" = "canonical-front-office-validator"
    "X-Caller-Roles" = "advisor"
    "X-Caller-Capabilities" = "idea.review.queue.read"
    "X-Caller-Tenant-Ids" = $payload.accessScope.tenantId
    "X-Caller-Book-Ids" = $payload.accessScope.bookId
    "X-Caller-Portfolio-Ids" = $payload.accessScope.portfolioId
    "X-Caller-Client-Ids" = $payload.accessScope.clientId
  }
  $queueEvaluatedAtUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
  $encodedEvaluatedAtUtc = [uri]::EscapeDataString($queueEvaluatedAtUtc)
  $queue = Invoke-RestMethod `
    -Uri "$ideaBaseUrl/api/v1/review-queues/advisor?evaluatedAtUtc=$encodedEvaluatedAtUtc" `
    -Headers $queueHeaders
  if ([datetimeoffset]$queue.evaluatedAtUtc -ne [datetimeoffset]$queueEvaluatedAtUtc) {
    throw "Canonical Lotus Idea advisor queue did not preserve the requested evaluation boundary."
  }
  $seededQueueItems = @($queue.items | Where-Object {
      [string]$_.candidate.candidateId -eq $candidateId
    })
  if ($seededQueueItems.Count -ne 1) {
    throw (
      "Canonical Lotus Idea advisor queue did not return the current run candidate " +
      "'$candidateId' exactly once. Matches: $($seededQueueItems.Count)."
    )
  }

  New-Item -ItemType Directory -Force -Path $canonicalEvidenceRoot | Out-Null
  $candidateEvidence = [ordered]@{
    schemaVersion = "lotus-workbench.idea-candidate-seed-evidence.v3"
    runId = $ideaCanonicalRunId
    candidateId = $candidateId
    portfolioId = $PortfolioId
    accessScope = [ordered]@{
      tenantId = [string]$payload.accessScope.tenantId
      bookId = [string]$payload.accessScope.bookId
      portfolioId = [string]$payload.accessScope.portfolioId
      clientId = [string]$payload.accessScope.clientId
    }
    asOfDate = $asOfDate
    lifecycleStatus = "ready_for_review"
    sourceObservedAtUtc = $sourceObservedAtUtc
    evaluatedAtUtc = $evaluatedAtUtc
    lifecycleObservedAtUtc = $lifecycleObservedAtUtc
    queueEvaluatedAtUtc = $queueEvaluatedAtUtc
    queuePolicyVersion = [string]$queue.policyVersion
  }
  $candidateEvidencePath = Join-Path $canonicalEvidenceRoot "idea-candidate-seed-evidence.json"
  $candidateEvidence | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $candidateEvidencePath -Encoding utf8
  Write-Host "Recorded current-run Lotus Idea candidate evidence: $candidateEvidencePath"
}

function Invoke-CanonicalIdeaCapacitySeed {
  $datePolicy = Get-CanonicalFrontOfficeDatePolicy
  Wait-HttpReady -Url "http://127.0.0.1:8330/health/ready" -Description "lotus-idea"
  Wait-HttpReady -Url "http://127.0.0.1:8000/health/ready" -Description "lotus-advise"

  Write-Host "Seeding isolated Lotus Idea downstream-capacity evidence ..."
  Invoke-WithProcessEnvironment `
    -Environment @{ LOTUS_IDEA_CAPACITY_TRUSTED_CALLER_CONTEXT = $ideaCapacityTrustedCallerContext } `
    -ScriptBlock {
      & (Join-Path $workbenchRepo "scripts\\live\\Invoke-IdeaCapacitySeed.ps1") `
        -ProjectsRoot $ProjectsRoot `
        -IdeaBaseUrl "http://127.0.0.1:8330" `
        -AsOfDate $datePolicy.AsOfDate `
        -SeededAtUtc $datePolicy.GeneratedAtUtc `
        -RunId $ideaCanonicalRunId `
        -ExpectedCommitSha $ideaSourceIdentity.CommitSha `
        -ExpectedBranch $ideaSourceIdentity.Branch `
        -EvidenceDirectory $ideaCapacityEvidenceRoot
    }
  if ($LASTEXITCODE -ne 0) {
    throw "Canonical Lotus Idea capacity seed failed with exit code $LASTEXITCODE."
  }
}

Import-Module (Join-Path $platformRepo 'automation/CanonicalRuntimeReservation.psm1') -Force
$runtimeMode = if ($CoreManageOnly) { 'core-manage' } else { 'full' }
if ($PortOwnershipPreflightOnly) {
  Invoke-CanonicalReservation -Action preflight -ProjectsRoot $ProjectsRoot -Holder $RuntimeHolder -WorkbenchRepoPath $workbenchRepo -RuntimeMode $runtimeMode | Out-Host
  Test-CanonicalPortOwnership -CoreManageOnlyMode:$CoreManageOnly
  Write-Host (
    "Canonical port ownership preflight passed. " +
    "No hosts, builds, containers, processes, seeds, or validation state were changed."
  )
  return
}
$runtimeOperation = Enter-CanonicalRuntimeOperation -ProjectsRoot $ProjectsRoot -Holder $RuntimeHolder -WorkbenchRepoPath $workbenchRepo -RuntimeMode $runtimeMode
$runtimeOutcome = 'failure'
try {
Test-CanonicalPortOwnership -CoreManageOnlyMode:$CoreManageOnly
$admissionRepositories = if ($CoreManageOnly) { @($coreRepo,$manageRepo) } else {
  @($coreRepo,$performanceRepo,$riskRepo,$aiRepo,$adviseRepo,$manageRepo,
    $reportRepo,$archiveRepo,$renderRepo,$ideaRepo,$gatewayRepo,$workbenchRepo)
}
foreach ($repo in $admissionRepositories) {
  Assert-CanonicalComposeAdmission -RepoPath $repo -Operation $runtimeOperation
}
if ($RequireMainlineSources) {
  $mainlineProvenance = Invoke-MainlineSourceProvenancePreflight
  $ideaCapacityEvidenceRoot = $mainlineProvenance.EvidenceRoot
  $provenanceScript = $mainlineProvenance.ScriptPath
  $mainlineSourcePreflightPath = $mainlineProvenance.PreflightPath
  $mainlineSourceRuntimePath = $mainlineProvenance.RuntimePath
}

Write-Host "Previewing managed canonical hosts block from lotus-platform ..."
Invoke-RepoCommand $platformRepo "powershell -ExecutionPolicy Bypass -File automation\\Sync-Dev-Ingress-Hosts.ps1"
$canonicalDpmCommandCenterEnvironment = Get-CanonicalDpmCommandCenterEnvironment

if ($CleanCoreState) {
  Write-Host "Resetting lotus-core Docker state before canonical reseed ..."
  Invoke-CanonicalComposeCommand $coreRepo "docker compose down -v --remove-orphans"
}

if ($localAppSet.Count -gt 0) {
  Write-Host "Local app overrides: $(($localAppSet | Sort-Object) -join ', ')"
}

Write-Host "Starting Docker-backed canonical services..."
$canonicalCoreEnvironment = @{
  DEMO_DATA_PACK_ENABLED = "false"
}
Write-Host "Starting lotus-core with auxiliary demo data pack disabled for canonical PB seed isolation."
Invoke-ComposeUp $coreRepo $canonicalCoreEnvironment

if ($CoreManageOnly) {
  Write-Host "Core/manage proof mode enabled; skipping non-essential front-office services."
  Start-CanonicalManage
  Start-DirectIngress
  Invoke-CanonicalCoreSeed -IngestOnly
  Write-Host ""
  Write-Host "Canonical core/manage proof stack is up."
  Write-Host "  Core query:   http://core-query.dev.lotus"
  Write-Host "  Core control: http://core-control.dev.lotus"
  Write-Host "  Manage:       http://manage.dev.lotus"
  Write-Host ""
  Write-Host "Run the core and manage API validators for RFC-087/RFC-0036 proof."
  $runtimeOutcome = 'success'
  return
}

$ideaSourceIdentity = Get-GitRepositoryIdentity -RepoPath $ideaRepo
$ideaDatePolicy = Get-CanonicalFrontOfficeDatePolicy
$ideaCanonicalRunId = "canonical-front-office-$($ideaDatePolicy.AsOfDate)-$([guid]::NewGuid().ToString('N'))"
$ideaCapacityTrustedCallerContext = "canonical-local-idea-capacity-seed-$([guid]::NewGuid().ToString('N'))"
$ideaBuildTimestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$ideaBuildEnvironment = @{
  LOTUS_IDEA_BUILD_GIT_COMMIT_SHA = $ideaSourceIdentity.CommitSha
  LOTUS_IDEA_BUILD_GIT_BRANCH = $ideaSourceIdentity.Branch
  LOTUS_IDEA_BUILD_TIMESTAMP = $ideaBuildTimestamp
  LOTUS_IDEA_BUILD_REPO_URL = "https://github.com/sgajbi/lotus-idea.git"
  LOTUS_IDEA_BUILD_RUN_ID = $ideaCanonicalRunId
  LOTUS_IDEA_BUILD_IMAGE_ID = "$($ideaSourceIdentity.CommitSha).$ideaCanonicalRunId"
  LOTUS_IDEA_BUILD_SERVICE_VERSION = "0.1.0"
  LOTUS_IDEA_TRUSTED_CALLER_CONTEXT_TOKEN = $ideaCapacityTrustedCallerContext
}
$resolvedLotusAiEnvFile = Resolve-LotusAiEnvFile -EnvFile $LotusAiEnvFile
Write-Host "Using lotus-ai env file for canonical proof: $resolvedLotusAiEnvFile"

Invoke-CanonicalRuntimePhase -Records $runtimePhases -Name 'independent-image-builds' -Action { Invoke-IndependentImageBuilds }
Invoke-ComposeUp $performanceRepo
Invoke-ComposeUp $riskRepo
Start-CanonicalAi -EnvFile $resolvedLotusAiEnvFile
Invoke-ComposeUp $adviseRepo

Start-CanonicalManage

Invoke-ComposeUp $reportRepo
# The capacity proof binds to a fresh per-startup run id embedded in Idea's image metadata.
# Rebuild only the Idea Compose project so reusable images cannot retain a prior run id.
Invoke-ComposeUp $ideaRepo $ideaBuildEnvironment -Build
Invoke-CanonicalRuntimePhase -Records $runtimePhases -Name 'idea-readiness-queue-seed' -Action { Invoke-CanonicalIdeaSeed }

if (Test-LocalApp "archive") {
  Invoke-CanonicalComposeCommand $archiveRepo "docker compose down --remove-orphans"
  Write-Host "Starting canonical lotus-archive locally on :8150 ..."
  Start-LocalUvicornService -RepoPath $archiveRepo -ServiceName "lotus-archive" -AppModule "app.main:app" -Port 8150
} else {
  Stop-HostProcessOnPort -Port 8150 -Description "lotus-archive"
  Invoke-ComposeUp $archiveRepo
}

if (Test-LocalApp "render") {
  Invoke-CanonicalComposeCommand $renderRepo "docker compose down --remove-orphans"
  Write-Host "Starting canonical lotus-render locally on :8310 ..."
  Start-LocalUvicornService -RepoPath $renderRepo -ServiceName "lotus-render" -AppModule "app.main:app" -Port 8310
} else {
  Stop-HostProcessOnPort -Port 8310 -Description "lotus-render"
  Invoke-ComposeUp $renderRepo
}

Start-DirectIngress

if (Test-LocalApp "gateway") {
  Invoke-CanonicalComposeCommand $gatewayRepo "docker compose down --remove-orphans"
  Write-Host "Starting canonical Gateway locally on :8100 ..."
  & (Join-Path $gatewayRepo "scripts\\Start-CanonicalGateway.ps1") -Port 8100
  if ($LASTEXITCODE -ne 0) {
    throw "Canonical Gateway local startup failed with exit code $LASTEXITCODE."
  }
} else {
  Stop-HostProcessOnPort -Port 8100 -Description "Gateway"
  Invoke-ComposeUp $gatewayRepo
}

Invoke-CanonicalRuntimePhase -Records $runtimePhases -Name 'core-seed-materialization' -Action { Invoke-CanonicalCoreSeed }
Invoke-CanonicalRuntimePhase -Records $runtimePhases -Name 'dpm-seed' -Action { Invoke-DpmCommandCenterSeed }
Invoke-CanonicalRuntimePhase -Records $runtimePhases -Name 'idea-capacity-seed' -Action { Invoke-CanonicalIdeaCapacitySeed }

if (Test-LocalApp "workbench") {
  Invoke-CanonicalComposeCommand $workbenchRepo "docker compose down --remove-orphans"
  Start-WorkbenchDevServer
} else {
  Stop-HostProcessOnPort -Port 3000 -Description "Workbench"
  $dockerWorkbenchEnvironment = Get-DockerWorkbenchEnvironment
  Invoke-ComposeUp $workbenchRepo $dockerWorkbenchEnvironment
}

if (-not $RunValidation) {
  if (-not [string]::IsNullOrWhiteSpace($ScreenshotDirectory)) {
    Write-Warning "ScreenshotDirectory is ignored unless -RunValidation is also supplied."
  }

  Write-Host ""
  Write-Host "Canonical front-office stack is up."
  Write-Host "  Workbench: http://workbench.dev.lotus"
  Write-Host "  Gateway:   http://gateway.dev.lotus"
  Write-Host "  Manage:    http://manage.dev.lotus"
  Write-Host "  Idea:      http://idea.dev.lotus"
  Write-Host "  Archive:   http://archive.dev.lotus"
  Write-Host "  Render:    http://render.dev.lotus"
  Write-Host ""
  Write-Host "Run 'npm run live:validate' from lotus-workbench when you want end-to-end validation."
  $runtimeOutcome = 'success'
  return
}

if ($RequireMainlineSources) {
  & node $provenanceScript --projects-root $ProjectsRoot --workbench-repo-path $workbenchRepo --output $mainlineSourceRuntimePath
  if ($LASTEXITCODE -ne 0) {
    throw "Canonical mainline source provenance changed during Docker startup. Validation was not started."
  }
  $preflightHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $mainlineSourcePreflightPath).Hash
  $runtimeHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $mainlineSourceRuntimePath).Hash
  if ($preflightHash -ne $runtimeHash) {
    throw "Canonical mainline sources changed during Docker startup. Validation was not started."
  }
}

Write-Host "Running canonical live validation ..."
$validationArguments = @{
  ProjectsRoot = $ProjectsRoot
  RuntimeHolder = $RuntimeHolder
  WorkbenchRepoPath = $workbenchRepo
  RuntimeOperationToken = $runtimeOperation.Token
  RuntimeOperationFence = $runtimeOperation.Lock
  PortfolioId = $PortfolioId
  BenchmarkCode = $BenchmarkCode
  CanonicalEvidenceDirectory = $canonicalEvidenceRoot
}
if (-not [string]::IsNullOrWhiteSpace($ScreenshotDirectory)) {
  $validationArguments.ScreenshotDirectory = $ScreenshotDirectory
}
if ($RequireMainlineSources) {
  $validationArguments.MainlineSourceProvenancePath = $mainlineSourceRuntimePath
  $validationArguments.IdeaCapacitySeedEvidencePath = Join-Path $ideaCapacityEvidenceRoot "idea-capacity-seed-evidence.json"
}
Invoke-CanonicalRuntimePhase -Records $runtimePhases -Name 'api-calculation-browser-validation' -Action {
  & (Join-Path $workbenchRepo "scripts\\live\\Validate-LotusFrontOfficeCanonical.ps1") @validationArguments
  if ($LASTEXITCODE -ne 0) { throw "Canonical validation failed with exit code $LASTEXITCODE." }
}
$runtimeOutcome = 'success'
} finally {
  try {
    New-Item -ItemType Directory -Force -Path $canonicalEvidenceRoot | Out-Null
    @{schema='lotus-workbench.canonical-runtime-phases.v1'; status=$runtimeOutcome; build_concurrency=$BuildConcurrency; phases=$runtimePhases} |
      ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $canonicalEvidenceRoot "runtime-phases-$runtimeTimingId.json") -Encoding UTF8
  } catch {
    $runtimeOutcome = 'failure'
    throw
  } finally {
    Exit-CanonicalRuntimeOperation -Operation $runtimeOperation -Outcome $runtimeOutcome
  }
}
