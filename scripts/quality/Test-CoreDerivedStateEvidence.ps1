$ErrorActionPreference = "Stop"
$resolver = Join-Path (Split-Path -Parent $PSScriptRoot) "live\Resolve-CoreDerivedStateContainer.ps1"
$capture = Join-Path (Split-Path -Parent $PSScriptRoot) "live\Capture-CoreDerivedStateLog.ps1"
$fixtureRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("lotus-derived-state-evidence-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
$composeFile = Join-Path $fixtureRoot "docker-compose.yml"
Set-Content -LiteralPath $composeFile -Value "name: lotus-core-app-local" -Encoding UTF8

$global:derivedEvidenceScenario = "valid"
$global:derivedEvidenceFixtureRoot = $fixtureRoot
$global:derivedLogInvoked = $false
$global:derivedEvidenceSince = "2026-09-21T00:00:00Z"
function docker {
  $global:LASTEXITCODE = 0
  if ($args[0] -eq "compose") {
    if ($args[1] -cne "--project-directory" -or
        $args[2] -cne $global:derivedEvidenceFixtureRoot -or
        $args[3] -cne "-f" -or
        $args[4] -cne (Join-Path $global:derivedEvidenceFixtureRoot "docker-compose.yml") -or
        ($args[5..9] -join " ") -cne "ps --status running -q portfolio_derived_state_service") {
      throw "Resolver did not select the governed Core Compose service."
    }
    if ($global:derivedEvidenceScenario -eq "missing") { return }
    if ($global:derivedEvidenceScenario -eq "replacement") { return "replacement-container-id" }
    return "fixture-container-id"
  }
  if ($args[0] -eq "inspect") {
    $expectedId = if ($global:derivedEvidenceScenario -eq "replacement") { "replacement-container-id" } else { "fixture-container-id" }
    if ($args[1] -cne "--format" -or $args[3] -cne $expectedId) {
      throw "Resolver inspected an unexpected container."
    }
    if ($global:derivedEvidenceScenario -eq "inspect-failure") {
      $global:LASTEXITCODE = 8
      return
    }
    $root = if ($global:derivedEvidenceScenario -eq "foreign") { Join-Path $global:derivedEvidenceFixtureRoot "other-checkout" } else { $global:derivedEvidenceFixtureRoot }
    $service = if ($global:derivedEvidenceScenario -eq "wrong-service") { "query_service" } else { "portfolio_derived_state_service" }
    return (@{
      Id = $expectedId
      Name = "/lotus-core-app-local-portfolio_derived_state_service-1"
      Config = @{
        Labels = @{
          "com.docker.compose.project.working_dir" = $root
          "com.docker.compose.service" = $service
          "com.docker.compose.project" = "lotus-core-app-local"
        }
      }
    } | ConvertTo-Json -Compress -Depth 5)
  }
  if ($args[0] -eq "logs") {
    $global:derivedLogInvoked = $true
    if ($args[1] -cne "--since" -or $args[2] -cne $global:derivedEvidenceSince -or
        $args[3] -cne "--tail" -or $args[5] -cne "fixture-container-id") {
      throw "Capture did not retain its time bound and inspected immutable container ID."
    }
    if ($global:derivedEvidenceScenario -eq "logs-failure") {
      $global:LASTEXITCODE = 8
      return "docker logs failed"
    }
    if ($global:derivedEvidenceScenario -eq "empty" -or
        $global:derivedEvidenceScenario -eq "pre-start-only") { return }
    return "position and portfolio derived-state log evidence"
  }
  throw "Unexpected docker invocation: $($args -join ' ')"
}

function Assert-Refused {
  param([string]$Scenario, [string]$ExpectedMessage, [switch]$CaptureLog)
  $global:derivedEvidenceScenario = $Scenario
  $global:derivedLogInvoked = $false
  try {
    if ($CaptureLog) {
      & $capture -CoreRepoPath $fixtureRoot -LogDirectory $fixtureRoot `
        -ExpectedContainerId "fixture-container-id" -Since $global:derivedEvidenceSince | Out-Null
    } else {
      & $resolver -CoreRepoPath $fixtureRoot | Out-Null
    }
  } catch {
    if ($_.Exception.Message -notlike "*$ExpectedMessage*") { throw }
    if ($Scenario -eq "replacement" -and $global:derivedLogInvoked) {
      throw "Replacement container was read before refusal."
    }
    return
  }
  throw "Core evidence guard accepted invalid scenario: $Scenario"
}

try {
  $resolved = & $resolver -CoreRepoPath $fixtureRoot
  if ($resolved.ContainerId -cne "fixture-container-id" -or
      $resolved.ContainerName -cne "lotus-core-app-local-portfolio_derived_state_service-1") {
    throw "Resolver returned unexpected container identity."
  }
  Assert-Refused -Scenario "missing" -ExpectedMessage "exactly one running"
  Assert-Refused -Scenario "foreign" -ExpectedMessage "another checkout"
  Assert-Refused -Scenario "wrong-service" -ExpectedMessage "not the governed Core"
  Assert-Refused -Scenario "inspect-failure" -ExpectedMessage "inspection failed"
  $global:derivedEvidenceScenario = "valid"
  $artifact = & $capture -CoreRepoPath $fixtureRoot -LogDirectory $fixtureRoot `
    -ExpectedContainerId $resolved.ContainerId -Since $global:derivedEvidenceSince
  if ($artifact.status -cne "captured" -or $artifact.bytes -le 0 -or
      $artifact.containerId -cne $resolved.ContainerId -or
      $artifact.since -cne $global:derivedEvidenceSince -or
      $artifact.responsibilities.Count -ne 2) {
    throw "Valid Core derived-state log was not captured with both responsibilities."
  }
  Assert-Refused -Scenario "empty" -ExpectedMessage "logs are empty" -CaptureLog
  Assert-Refused -Scenario "pre-start-only" -ExpectedMessage "logs are empty" -CaptureLog
  Assert-Refused -Scenario "logs-failure" -ExpectedMessage "logs failed" -CaptureLog
  Assert-Refused -Scenario "replacement" -ExpectedMessage "changed after discovery" -CaptureLog
  Write-Output '{"contract":"core-derived-state-evidence-discovery","passed":true,"cases":10}'
} finally {
  $logFile = Join-Path $fixtureRoot "lotus-core-app-local-portfolio_derived_state_service-1.log"
  if (Test-Path -LiteralPath $logFile) { Remove-Item -LiteralPath $logFile -Force }
  Remove-Item -LiteralPath $composeFile -Force
  Remove-Item -LiteralPath $fixtureRoot
}
