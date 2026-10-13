$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ('lotus-running-validation-' + [guid]::NewGuid().ToString('N'))
$workbench = Join-Path $fixtureRoot 'lotus-workbench'
$live = Join-Path $workbench 'scripts/live'
$platform = Join-Path $fixtureRoot 'lotus-platform/automation'
$evidence = Join-Path $fixtureRoot 'evidence'
$idea = Join-Path $fixtureRoot 'lotus-idea'
$global:runningNativeNode = @(Get-Command node -CommandType Application)[0].Source
$global:runningNativeFixture = Join-Path $PSScriptRoot 'canonical-running-native-fixture.mjs'
$global:runningNativeState = Join-Path $fixtureRoot 'native-state.json'
foreach ($path in @($live, $platform, $evidence, $idea)) { New-Item -ItemType Directory -Path $path -Force | Out-Null }
foreach ($name in @('Validate-LotusFrontOfficeRunning.ps1', 'CanonicalRunningValidation.psm1', 'CanonicalWorkspace.psm1', 'CanonicalIdeaEvidence.psm1', 'CanonicalPortOwnership.psm1', 'CanonicalEvidencePublication.psm1')) {
  Copy-Item -LiteralPath (Join-Path $repoRoot "scripts/live/$name") -Destination $live
}
$adapter = @'
function Enter-CanonicalRuntimeOperation {
  param($ProjectsRoot, $Holder, $WorkbenchRepoPath)
  if ($Holder -cne 'fixture-owner' -or $global:runningCase -eq 'expired-reservation') { throw 'fixture reservation refused' }
  $global:runningOperation = [pscustomobject]@{
    Token = 'fixture-token'; Lock = [IO.File]::Open((Join-Path $ProjectsRoot 'operation.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    Scope = $global:runningScope; Bindings = $global:runningBindings
  }
  return $global:runningOperation
}
function Assert-CanonicalRuntimeOperationFence {
  param($ProjectsRoot, $OperationToken, $Fence)
  if ($OperationToken -cne 'fixture-token' -or -not [object]::ReferenceEquals($Fence, $global:runningOperation.Lock) -or -not $Fence.CanRead) {
    throw 'fixture original fence refused'
  }
  $global:runningFenceChecks++
}
function Invoke-CanonicalReservation {
  param($Action, $ProjectsRoot, $Holder, $OperationToken, $WorkbenchRepoPath)
  if ($Action -cne 'preflight-operation') { throw 'unexpected reservation action' }
  Assert-CanonicalRuntimeOperationFence -ProjectsRoot $ProjectsRoot -OperationToken $OperationToken -Fence $global:runningOperation.Lock
  $global:runningPreflights++
  if ($global:runningCase -eq 'lost-reservation' -and $global:runningPreflights -ge 2) { throw 'fixture reservation changed' }
}
function Exit-CanonicalRuntimeOperation {
  param($Operation, $Outcome)
  $global:runningOutcome = $Outcome
  $Operation.Lock.Dispose()
  if ($global:runningCase -eq 'finish-failure') { throw 'fixture publication failed' }
}
Export-ModuleMember -Function *
'@
[IO.File]::WriteAllText((Join-Path $platform 'CanonicalRuntimeReservation.psm1'), $adapter)
$validator = @'
param($ProjectsRoot, $RuntimeHolder, $WorkbenchRepoPath, $RuntimeOperationToken, $RuntimeOperationFence,
  $PortfolioId, $BenchmarkCode, $StartDate, $AsOfDate, $CanonicalEvidenceDirectory,
  $IdeaCandidateSeedEvidencePath, $ValidationProfile, $MainlineSourceProvenancePath,
  $ExpectedIdeaCommitSha, $ExpectedIdeaBranch, $ExpectedIdeaRunId, $ScreenshotDirectory)
Assert-CanonicalRuntimeOperationFence -ProjectsRoot $ProjectsRoot -OperationToken $RuntimeOperationToken -Fence $RuntimeOperationFence
if ($ValidationProfile -cne 'full' -or -not $MainlineSourceProvenancePath -or
    $ExpectedIdeaCommitSha -cne $global:runningSha -or $ExpectedIdeaBranch -cne 'main' -or
    $ExpectedIdeaRunId -cne $global:runningRunId -or
    $env:LOTUS_IDEA_CAPACITY_TRUSTED_CALLER_CONTEXT -cnotmatch '^canonical-local-running-validation-[0-9a-f]{32}$') {
  throw 'full validator did not receive admitted source/run/context'
}
$global:runningValidatorCalls++
[IO.File]::WriteAllText((Join-Path $ScreenshotDirectory 'fixture-browser-proof.json'), '{"validationProfile":"full"}')
if ($global:runningCase -eq 'validator-throw') { throw 'fixture validator refused' }
if ($global:runningCase -eq 'validator-native-failure') { $global:LASTEXITCODE = 23; return }
if ($global:runningCase -eq 'seed-drift') { [IO.File]::AppendAllText($IdeaCandidateSeedEvidencePath, ' ') }
if ($global:runningCase -eq 'image-drift') { $global:runningContainer.image = 'sha256:' + ('e' * 64) }
if ($global:runningCase -eq 'run-drift') { $global:runningVersion.build.ciRunId = 'canonical-front-office-2026-04-10-' + ('e' * 32) }
$global:LASTEXITCODE = 0
'@
[IO.File]::WriteAllText((Join-Path $live 'Validate-LotusFrontOfficeCanonical.ps1'), $validator)

function global:node {
  if ($args[0] -notlike '*mainline-source-provenance.mjs') { throw 'unexpected native source command' }
  $global:runningSourceCalls++
  if ($global:runningCase -eq 'source-refusal') { $global:LASTEXITCODE = 9; return }
  $outputIndex = [array]::IndexOf($args, '--output')
  $output = $args[$outputIndex + 1]
  if ($global:runningCase -eq 'malformed-source') { [IO.File]::WriteAllText($output, '{'); $global:LASTEXITCODE = 0; return }
  $document = $global:runningManifest | ConvertTo-Json -Depth 10
  if ($global:runningCase -eq 'source-drift' -and $global:runningSourceCalls -gt 1) { $document += ' ' }
  [IO.File]::WriteAllText($output, $document)
  $global:LASTEXITCODE = 0
}
function global:docker {
  $global:runningDockerCalls++
  @{ name = $global:runningCase; container = $global:runningContainer; image = $global:runningImage } |
    ConvertTo-Json -Depth 10 -Compress | Set-Content -LiteralPath $global:runningNativeState -Encoding UTF8
  # A real native executable receives the exact format argument. A function-only
  # mock cannot detect Windows PowerShell 5 stripping its embedded quotes.
  & $global:runningNativeNode $global:runningNativeFixture $global:runningNativeState @args
  $global:LASTEXITCODE = $LASTEXITCODE
}
function global:Invoke-RestMethod {
  param($Uri, $TimeoutSec)
  if ($Uri -in @('http://idea.dev.lotus/version', 'http://127.0.0.1:8330/version')) { return $global:runningVersion }
  if ($Uri -ceq 'http://127.0.0.1:8330/health/ready') { return $global:runningReadiness }
  throw 'unexpected HTTP operation'
}
$contextName = 'LOTUS_IDEA_CAPACITY_TRUSTED_CALLER_CONTEXT'
$originalContext = [Environment]::GetEnvironmentVariable($contextName, 'Process')
$seedPath = Join-Path $evidence 'idea-candidate-seed-evidence.json'
$cases = [Collections.Generic.List[string]]::new()
function Invoke-RunningCase {
  param([string]$Name, [string]$ExpectedError = '', [scriptblock]$Mutate = {}, [string]$Holder = 'fixture-owner', [switch]$PriorContext)
  $global:runningCase = $Name
  $global:runningSha = 'a' * 40
  $global:runningRunId = 'canonical-front-office-2026-04-10-' + ('b' * 32)
  $global:runningManifest = @{
    schemaVersion = 'lotus.canonical-front-office.mainline-source-provenance.v1'; passed = $true
    repositories = @(@{ repository = 'lotus-idea'; passed = $true; branch = 'main'; headSha = $global:runningSha; expectedMainSha = $global:runningSha })
  }
  $global:runningScope = @{ sources = @{ 'lotus-idea' = $global:runningSha } }
  $global:runningContainer = @{
    id = 'c' * 64; image = 'sha256:' + ('d' * 64); running = $true; project = 'lotus-idea'; service = 'lotus-idea'
    checkout = $idea; ports = @{ '8330/tcp' = @(@{ HostIp = '0.0.0.0'; HostPort = '8330' }) }
  }
  $global:runningBindings = @(@{ kind = 'container'; id = $global:runningContainer.id; project = 'lotus-idea'; checkout = $idea; ports = @(8330) })
  $global:runningImage = @{ id = $global:runningContainer.image; labels = @{
    'org.opencontainers.image.revision' = $global:runningSha; 'io.lotus.image.git.branch' = 'main'
    'org.opencontainers.image.source' = 'https://github.com/sgajbi/lotus-idea.git'
    'io.lotus.image.ci.run_id' = $global:runningRunId; 'io.lotus.image.build.id' = "$global:runningSha.$global:runningRunId"
  } }
  $global:runningVersion = @{ service = 'lotus-idea'; build = @{
    gitCommitSha = $global:runningSha; gitBranch = 'main'; ciRunId = $global:runningRunId; imageBuildId = "$global:runningSha.$global:runningRunId"
  } }
  $global:runningReadiness = @{ status = 'ready'; runtimeProfile = 'local'; processLocalRepositoryAllowed = $true; durableWriteRepositoryRequired = $false; configurationBlockers = @() }
  $global:runningSeed = @{
    schemaVersion = 'lotus-workbench.idea-candidate-seed-evidence.v4'; runId = $global:runningRunId
    candidateId = 'idea_low_income_0123456789abcdef'; portfolioId = 'PB_SG_GLOBAL_BAL_001'; asOfDate = '2026-04-10'
    lifecycleStatus = 'ready_for_review'; sourceCutPosture = 'coherent'
    accessScope = @{ tenantId = 'tenant-sg'; bookId = 'BOOK_SG_BALANCED_DPM'; portfolioId = 'PB_SG_GLOBAL_BAL_001'; clientId = 'client-fixture' }
    sourceObservedAtUtc = '2026-10-13T00:00:00.000Z'; evaluatedAtUtc = '2026-10-13T00:00:01.000Z'
    lifecycleObservedAtUtc = '2026-10-13T00:00:02.000Z'; queueEvaluatedAtUtc = '2026-10-13T00:00:03.000Z'
  }
  $global:runningValidatorCalls = 0; $global:runningSourceCalls = 0; $global:runningDockerCalls = 0
  $global:runningFenceChecks = 0; $global:runningPreflights = 0; $global:runningOutcome = ''
  $browserDirectory = Join-Path $evidence "browser-$Name"
  & $Mutate
  $global:runningSeed | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $seedPath -Encoding UTF8
  if ($Name -eq 'missing-seed') { Remove-Item -LiteralPath $seedPath }
  if ($Name -eq 'malformed-seed') { [IO.File]::WriteAllText($seedPath, '{') }
  $expectedContext = if ($PriorContext) { 'synthetic-prior-fixture' } else { $null }
  if ($null -eq $expectedContext) { [Environment]::SetEnvironmentVariable($contextName, [NullString]::Value, 'Process') }
  else { [Environment]::SetEnvironmentVariable($contextName, $expectedContext, 'Process') }
  $caught = ''
  try {
    & (Join-Path $live 'Validate-LotusFrontOfficeRunning.ps1') -ProjectsRoot $fixtureRoot -RuntimeHolder $Holder -CanonicalEvidenceDirectory $evidence -ScreenshotDirectory $browserDirectory | Out-Null
  } catch { $caught = $_.Exception.Message }
  if ($ExpectedError) {
    if (Test-Path -LiteralPath $browserDirectory) { throw "Case $Name published failed browser evidence." }
    if ($caught -notmatch $ExpectedError) { throw "Case $Name expected '$ExpectedError'; observed '$caught'." }
    if ($Name -notin @('validator-throw', 'validator-native-failure', 'source-drift', 'seed-drift', 'image-drift', 'run-drift', 'finish-failure') -and $global:runningValidatorCalls -ne 0) {
      throw "Case $Name reached full validation before admission."
    }
  } elseif ($caught -or $global:runningOutcome -cne 'success' -or $global:runningValidatorCalls -ne 1 -or $global:runningFenceChecks -lt 4) {
    throw "Case $Name failed full nested validation: $caught"
  }
  if (-not $ExpectedError -and -not (Test-Path -LiteralPath (Join-Path $browserDirectory 'fixture-browser-proof.json'))) {
    throw "Case $Name did not publish accepted browser proof."
  }
  $afterContext = [Environment]::GetEnvironmentVariable($contextName, 'Process')
  if ($afterContext -cne $expectedContext -or ($null -eq $expectedContext -and $null -ne $afterContext)) {
    throw "Case $Name leaked or failed to restore transient capability."
  }
  if ($Name -in @('wrong-holder', 'expired-reservation') -and ($global:runningSourceCalls -ne 0 -or $global:runningDockerCalls -ne 0)) {
    throw "Case $Name observed runtime before reservation admission."
  }
  $cases.Add($Name)
}
try {
  $legacyFormats = @(
    '{"id":{{json .Id}},"image":{{json .Image}},"running":{{json .State.Running}},"project":{{json (index .Config.Labels "com.docker.compose.project")}},"service":{{json (index .Config.Labels "com.docker.compose.service")}},"checkout":{{json (index .Config.Labels "com.docker.compose.project.working_dir")}},"ports":{{json .NetworkSettings.Ports}}}',
    '{"id":{{json .Id}},"labels":{{json .Config.Labels}}}'
  )
  $legacyIntact = $true
  foreach ($legacyFormat in $legacyFormats) {
    $received = & $global:runningNativeNode $global:runningNativeFixture echo-format $legacyFormat
    if ($LASTEXITCODE -ne 0) { throw 'Native argument probe failed.' }
    $decoded = ConvertFrom-Json -InputObject ('{"args":' + $received + '}')
    $intact = [bool]($decoded.args.Count -eq 1 -and $decoded.args[0] -ceq $legacyFormat)
    if ($PSVersionTable.PSVersion.Major -eq 5 -and $intact) { throw 'Expected legacy Windows native quote corruption was not reproduced.' }
    $legacyIntact = $legacyIntact -and $intact
  }
  Invoke-RunningCase 'valid-local'
  Invoke-RunningCase 'valid-detached-source' -Mutate { $global:runningManifest.repositories[0].branch = $null }
  Invoke-RunningCase 'valid-test' -PriorContext -Mutate { $global:runningReadiness.runtimeProfile = 'test' }
  Invoke-RunningCase 'wrong-holder' 'reservation refused' -Holder 'foreign-owner'
  Invoke-RunningCase 'expired-reservation' 'reservation refused'
  Invoke-RunningCase 'lost-reservation' 'reservation changed'
  Invoke-RunningCase 'source-refusal' 'mainline source preflight failed'
  Invoke-RunningCase 'malformed-source' 'Invalid|JSON'
  Invoke-RunningCase 'reservation-source' 'source differs' -Mutate { $global:runningScope.sources.'lotus-idea' = 'e' * 40 }
  Invoke-RunningCase 'dirty-source' 'current mainline' -Mutate { $global:runningManifest.passed = $false }
  Invoke-RunningCase 'non-main-source' 'current mainline' -Mutate { $global:runningManifest.repositories[0].branch = 'feature/foreign' }
  Invoke-RunningCase 'wrong-image-source' 'provenance mismatch' -Mutate { $global:runningImage.labels.'org.opencontainers.image.revision' = 'e' * 40 }
  Invoke-RunningCase 'wrong-image-id' 'provenance mismatch' -Mutate { $global:runningImage.id = 'sha256:' + ('e' * 64) }
  Invoke-RunningCase 'wrong-runtime-source' 'provenance mismatch' -Mutate { $global:runningVersion.build.gitCommitSha = 'e' * 40 }
  Invoke-RunningCase 'wrong-runtime-run' 'provenance mismatch' -Mutate { $global:runningImage.labels.'io.lotus.image.ci.run_id' = 'old-run' }
  Invoke-RunningCase 'wrong-seed-run' 'belongs to run' -Mutate { $global:runningSeed.runId = 'prior-run' }
  Invoke-RunningCase 'missing-seed' 'evidence is missing'
  Invoke-RunningCase 'malformed-seed' 'Invalid|JSON'
  Invoke-RunningCase 'wrong-seed-portfolio' 'does not match portfolio' -Mutate { $global:runningSeed.portfolioId = 'foreign' }
  Invoke-RunningCase 'malformed-seed-scope' 'incomplete admitted access scope' -Mutate { $global:runningSeed.accessScope.clientId = '' }
  Invoke-RunningCase 'foreign-checkout' 'exact admitted' -Mutate { $global:runningContainer.checkout = Join-Path $idea 'nested' }
  Invoke-RunningCase 'relative-checkout' 'exact admitted' -Mutate { $global:runningContainer.checkout = 'lotus-idea' }
  Invoke-RunningCase 'wrong-port' 'exact admitted' -Mutate { $global:runningContainer.ports.'8330/tcp'[0].HostPort = '8331' }
  Invoke-RunningCase 'unadmitted-container' 'exact admitted' -Mutate { $global:runningBindings[0].id = 'e' * 64 }
  Invoke-RunningCase 'stopped-container' 'exact admitted' -Mutate { $global:runningContainer.running = $false }
  Invoke-RunningCase 'docker-native-failure' 'cannot inspect Idea'
  foreach ($kind in @('container', 'image')) {
    Invoke-RunningCase "native-failure-$kind" 'cannot inspect'
    foreach ($fault in @('malformed', 'invalid-json', 'truncated', 'extra', 'blank', 'wrong-type', 'wrong-labels')) {
      Invoke-RunningCase "$fault-$kind" 'malformed Idea'
    }
  }
  Invoke-RunningCase 'wrong-running-type' 'malformed Idea' -Mutate { $global:runningContainer.running = 'true' }
  Invoke-RunningCase 'wrong-ports-type' 'malformed Idea' -Mutate { $global:runningContainer.ports = @() }
  Invoke-RunningCase 'wrong-project-type' 'malformed Idea' -Mutate { $global:runningContainer.project = @('lotus-idea') }
  Invoke-RunningCase 'wrong-revision-type' 'malformed Idea' -Mutate { $global:runningImage.labels.'org.opencontainers.image.revision' = @($global:runningSha) }
  foreach ($profile in @('demo', 'staging', 'production')) {
    Invoke-RunningCase "protected-$profile" 'protected profiles are unsupported' -Mutate { $global:runningReadiness.runtimeProfile = $profile }
  }
  Invoke-RunningCase 'denied-local-authority' 'protected profiles are unsupported' -Mutate { $global:runningReadiness.processLocalRepositoryAllowed = $false }
  Invoke-RunningCase 'malformed-local-authority' 'protected profiles are unsupported' -Mutate { $global:runningReadiness.processLocalRepositoryAllowed = 'True' }
  Invoke-RunningCase 'degraded-readiness' 'protected profiles are unsupported' -Mutate { $global:runningReadiness.status = 'degraded' }
  Invoke-RunningCase 'validator-throw' 'fixture validator refused' -PriorContext
  Invoke-RunningCase 'validator-native-failure' 'exit code 23'
  Invoke-RunningCase 'source-drift' 'changed during validation'
  Invoke-RunningCase 'seed-drift' 'changed during validation'
  Invoke-RunningCase 'image-drift' 'provenance mismatch'
  Invoke-RunningCase 'run-drift' 'provenance mismatch'
  Invoke-RunningCase 'finish-failure' 'publication failed'
  foreach ($file in Get-ChildItem -LiteralPath $evidence -File -Recurse) {
    $contents = [IO.File]::ReadAllText($file.FullName)
    if ($contents -match 'canonical-local-running-validation-|synthetic-prior-fixture|TRUSTED_CALLER_CONTEXT|Config.Env') {
      throw 'Capability or environment data entered persisted evidence.'
    }
  }
  @{ contract = 'canonical-running-stack-validation'; passed = $true; cases = @($cases); nativeBoundary = $true; legacyFormatIntact = $legacyIntact; runtimeAcceptance = $false } | ConvertTo-Json -Depth 4 -Compress
} finally {
  if ($null -eq $originalContext) { [Environment]::SetEnvironmentVariable($contextName, [NullString]::Value, 'Process') }
  else { [Environment]::SetEnvironmentVariable($contextName, $originalContext, 'Process') }
  $resolved = [IO.Path]::GetFullPath($fixtureRoot)
  $temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if (-not $resolved.StartsWith($temp, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $resolved) -notlike 'lotus-running-validation-*') {
    throw 'Refusing unexpected fixture cleanup path.'
  }
  Remove-Item -LiteralPath $resolved -Recurse -Force
}
