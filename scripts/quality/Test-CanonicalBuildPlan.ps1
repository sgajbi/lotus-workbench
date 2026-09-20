[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Import-Module (Join-Path $repoRoot 'scripts/live/CanonicalBuildPlan.psm1') -Force
$fixture = Join-Path ([IO.Path]::GetTempPath()) "lotus-build-plan-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $fixture | Out-Null
$oldPath = $env:PATH
$oldMarker = $env:LOTUS_BUILD_PROOF_SCOPE
$fence = $null
try {
  $probe = @'
import json, os, pathlib, sys, time
if sys.argv[1:3] == ['compose', 'config']:
    env = pathlib.Path('.env')
    deployment = env.read_text() if env.exists() else 'baseline'
    print(json.dumps(dict(name=pathlib.Path.cwd().name, services=dict(app=dict(environment=dict(deployment=deployment))))))
    sys.exit(0)
root = pathlib.Path(os.environ['LOTUS_BUILD_PROOF_OUTPUT'])
name = pathlib.Path.cwd().name
record = dict(pid=os.getpid(), scope=os.environ['LOTUS_BUILD_PROOF_SCOPE'],
              parallel=os.environ['COMPOSE_PARALLEL_LIMIT'], start=time.time(),
              working_directory=os.environ.get('PWD'))
sys.stderr.write('controlled native build progress\n')
path = root / (name + '.json')
path.write_text(json.dumps(record))
if os.environ.get('LOTUS_BUILD_PROOF_BARRIER') == '2' and name in ('a', 'b'):
    deadline = time.monotonic() + 30
    while not all((root / (peer + '.json')).exists() for peer in ('a', 'b')):
        if time.monotonic() > deadline:
            raise RuntimeError('Second bounded child never entered the build barrier')
        time.sleep(0.05)
time.sleep(float(os.environ.get('LOTUS_BUILD_PROOF_SLEEP', '1')))
record['end'] = time.time()
path.write_text(json.dumps(record))
sys.exit(int(os.environ.get('LOTUS_BUILD_PROOF_EXIT', '0')))
'@
  [IO.File]::WriteAllText((Join-Path $fixture 'probe.py'), $probe)
  $docker = '& python (Join-Path $env:LOTUS_BUILD_PROOF_FIXTURE ''probe.py'') @args; exit $LASTEXITCODE'
  [IO.File]::WriteAllText((Join-Path $fixture 'docker.ps1'), $docker)
  $env:PATH = "$fixture$([IO.Path]::PathSeparator)$oldPath"
  $env:LOTUS_BUILD_PROOF_SCOPE = 'parent-unchanged'
  $oldFixture=$env:LOTUS_BUILD_PROOF_FIXTURE
  $env:LOTUS_BUILD_PROOF_FIXTURE=$fixture
  $fencePath = Join-Path $fixture 'parent.lock'
  $fence = [IO.File]::Open($fencePath, 'OpenOrCreate', 'ReadWrite', 'None')
  $repositories = @()
  foreach ($name in @('a','b','c')) {
    $path = Join-Path $fixture $name
    New-Item -ItemType Directory -Path $path | Out-Null
    & git -C $path init -q
    [IO.File]::WriteAllText((Join-Path $path 'compose.yaml'), 'services: {}')
    [IO.File]::WriteAllText((Join-Path $path '.gitignore'), [IO.File]::ReadAllText((Join-Path $repoRoot '.gitignore')))
    & git -C $path add compose.yaml .gitignore
    & git -C $path -c user.name=Fixture -c user.email=fixture@example.invalid -c commit.gpgsign=false commit -qm fixture
    if ($LASTEXITCODE -ne 0) { throw 'Fixture Git creation failed.' }
    New-Item -ItemType Directory -Path (Join-Path $path 'output/playwright') -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $path 'output/playwright/ignored-log.txt'), 'Ignored evidence is not untracked source.')
    $repositories += @{Name=$name; RepoPath=$path; CommitSha=(& git -C $path rev-parse HEAD).Trim()}
  }
  foreach ($scenario in @('serial','bounded','failure','completed-sibling','completed-before-refusal','expired','interrupted','source-drift','untracked-before','untracked-during','config-before','config-during','source-during')) {
    $script:sourceMutationDone=$false
    $output = Join-Path $fixture $scenario
    New-Item -ItemType Directory -Path $output | Out-Null
    $plan = foreach ($repository in $repositories) {
      $entry = $repository.Clone()
      $entry.Environment = @{
        LOTUS_BUILD_PROOF_FIXTURE=$fixture; LOTUS_BUILD_PROOF_OUTPUT=$output
        LOTUS_BUILD_PROOF_SCOPE=$entry.Name; LOTUS_BUILD_PROOF_EXIT='0'; LOTUS_BUILD_PROOF_SLEEP='1'
      }
      if ($scenario -eq 'failure') {
        if ($entry.Name -eq 'a') { $entry.Environment.LOTUS_BUILD_PROOF_EXIT='23' }
        else { $entry.Environment.LOTUS_BUILD_PROOF_SLEEP='30' }
      }
      if ($scenario -eq 'completed-sibling' -and $entry.Name -eq 'a') { $entry.Environment.LOTUS_BUILD_PROOF_EXIT='23' }
      if ($scenario -in @('expired','interrupted')) { $entry.Environment.LOTUS_BUILD_PROOF_SLEEP='30' }
      if ($scenario -eq 'bounded') { $entry.Environment.LOTUS_BUILD_PROOF_BARRIER='2' }
      if ($scenario -in @('source-during','untracked-during','config-during')) { $entry.Environment.LOTUS_BUILD_PROOF_SLEEP=$(if ($entry.Name -eq 'a') {'3'} else {'30'}) }
      if ($scenario -eq 'source-drift' -and $entry.Name -eq 'a') { $entry.CommitSha = '0' * 40 }
      $entry.ComposeFingerprint=Get-CanonicalComposeFingerprint -RepoPath $entry.RepoPath -Environment $entry.Environment
      [pscustomobject]$entry
    }
    $configPath=Join-Path $repositories[0].RepoPath '.env'
    if ($scenario -eq 'config-before') { [IO.File]::WriteAllText($configPath,'private-config-change') }
    $untrackedPath=Join-Path $repositories[0].RepoPath 'src/app/new-route/page.tsx'
    if ($scenario -eq 'untracked-before') {
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $untrackedPath) | Out-Null
      [IO.File]::WriteAllText($untrackedPath, 'export default function Page() { return null; }')
    }
    $admission = {
      if (-not $fence.CanRead) { throw 'Parent fence was lost.' }
      $contended = $false
      try { $other = [IO.File]::Open($fencePath, 'Open', 'ReadWrite', 'None'); $other.Dispose() }
      catch [IO.IOException] { $contended = $true }
      if (-not $contended) { throw 'Parent fence was not exclusive.' }
      if ($scenario -in @('completed-sibling','completed-before-refusal') -and
          (Test-Path -LiteralPath (Join-Path $output 'a.json')) -and (Test-Path -LiteralPath (Join-Path $output 'b.json'))) {
        # Force both real children terminal before the scheduler collects either result.
        $children = @(Get-Job)
        $children | Wait-Job -Timeout 20 | Out-Null
        if (@($children | Where-Object State -notin @('Completed','Failed')).Count) { throw 'Fixture children did not terminate.' }
        if ($scenario -eq 'completed-before-refusal') { throw 'CONTROLLED_ADMISSION_EXPIRED' }
      }
      if ($scenario -eq 'expired' -and @(Get-ChildItem -LiteralPath $output -Filter '*.json').Count) { throw 'CONTROLLED_ADMISSION_EXPIRED' }
      if ($scenario -eq 'interrupted' -and @(Get-ChildItem -LiteralPath $output -Filter '*.json').Count) { throw 'CONTROLLED_ADMISSION_INTERRUPTED' }
      if ($scenario -eq 'source-during' -and -not $script:sourceMutationDone -and (Test-Path -LiteralPath (Join-Path $output 'a.json'))) {
        & git -C $repositories[0].RepoPath -c user.name=Fixture -c user.email=fixture@example.invalid -c commit.gpgsign=false commit --allow-empty -qm changed-during-build
        if ($LASTEXITCODE -ne 0) { throw 'Fixture source mutation failed.' }
        $script:sourceMutationDone=$true
      }
      if ($scenario -eq 'untracked-during' -and -not $script:sourceMutationDone -and (Test-Path -LiteralPath (Join-Path $output 'a.json'))) {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $untrackedPath) | Out-Null
        [IO.File]::WriteAllText($untrackedPath, 'export default function Page() { return null; }')
        $script:sourceMutationDone=$true
      }
      if ($scenario -eq 'config-during' -and -not $script:sourceMutationDone -and (Test-Path -LiteralPath (Join-Path $output 'a.json'))) {
        [IO.File]::WriteAllText($configPath,'private-config-change')
        $script:sourceMutationDone=$true
      }
    }
    $receipt = Join-Path $output 'receipt.json'
    $failed = $false
    try {
      $concurrency = if ($scenario -eq 'serial') { 1 } else { 2 }
      Invoke-CanonicalBuildPlan -Plan $plan -Concurrency $concurrency -PollMilliseconds 100 -AssertAdmission $admission -EvidencePath $receipt
    } catch {
      $failed = $true
      $expectedReason = switch ($scenario) {
        'expired' { 'CONTROLLED_ADMISSION_EXPIRED' }
        'completed-before-refusal' { 'CONTROLLED_ADMISSION_EXPIRED' }
        'interrupted' { 'CONTROLLED_ADMISSION_INTERRUPTED' }
        default { 'Canonical image build failed:' }
      }
      if ($_.Exception.Message -notmatch [regex]::Escape($expectedReason)) { throw }
    }
    $expectedFailure = $scenario -in @('failure','completed-sibling','completed-before-refusal','expired','interrupted','source-drift','untracked-before','untracked-during','config-before','config-during','source-during')
    if ($failed -ne $expectedFailure) { throw "Unexpected build verdict: $scenario" }
    $evidence = Get-Content -Raw -LiteralPath $receipt | ConvertFrom-Json
    if ((Get-Content -Raw -LiteralPath $receipt) -match 'private-config-change') { throw 'Compose input leaked into receipt.' }
    if (($evidence.status -eq 'failed') -ne $expectedFailure) { throw 'False evidence verdict.' }
    if (@($evidence.builds | Where-Object { $_.status -eq 'running' -or -not $_.ended_at_utc }).Count) { throw 'Build receipt has unjoined work.' }
    if ($scenario -in @('completed-sibling','completed-before-refusal')) {
      $expectedA = if ($scenario -eq 'completed-sibling') { 'failed' } else { 'succeeded' }
      if ($evidence.builds[0].status -ne $expectedA -or $evidence.builds[1].status -ne 'succeeded' -or
          $evidence.not_started -notcontains 'c') { throw "Completed child outcome lost: $scenario" }
    }
    $observations = @(Get-ChildItem -LiteralPath $output -Filter '*.json' | Where-Object Name -ne 'receipt.json' | ForEach-Object { Get-Content -Raw $_.FullName | ConvertFrom-Json })
    foreach ($observation in $observations) {
      if ($observation.parallel -ne '1' -or $observation.scope -notin @('a','b','c')) { throw 'Child environment leaked.' }
      if ($observation.working_directory -ne (Join-Path $fixture $observation.scope)) { throw 'Child checkout provenance leaked.' }
      if (Get-Process -Id $observation.pid -ErrorAction SilentlyContinue) { throw 'Child remains live after scheduler returned.' }
    }
    if (-not $expectedFailure) {
      if ($observations.Count -ne 3) { throw 'Build barrier returned before all work.' }
      $events = @($observations | ForEach-Object { @{at=$_.start; delta=1}; @{at=$_.end; delta=-1} } | Sort-Object { $_.at })
      $active = 0; $peak = 0
      foreach ($event in $events) { $active += $event.delta; $peak = [Math]::Max($peak,$active) }
      if ($peak -ne $concurrency -or $active -ne 0) { throw 'Concurrency bound or joining is false.' }
    } elseif ($observations.Count -gt 2) { throw 'Failure scheduled a dependent build.' }
    if ($env:LOTUS_BUILD_PROOF_SCOPE -ne 'parent-unchanged' -or -not $fence.CanRead) { throw 'Parent state changed.' }
    if ($scenario -eq 'untracked-before' -and (Test-Path -LiteralPath (Join-Path $output 'a.json'))) { throw 'Untracked source reached native build.' }
    if ($scenario -in @('untracked-before','untracked-during')) { [IO.File]::Delete($untrackedPath) }
    if ($scenario -eq 'config-before' -and (Test-Path -LiteralPath (Join-Path $output 'a.json'))) { throw 'Changed Compose input reached build.' }
    if ($scenario -in @('config-before','config-during')) { [IO.File]::Delete($configPath) }
    Write-Host "PASS canonical build scheduler: $scenario"
  }
  # Execute the shipped startup helper against a real Git checkout. A same-SHA
  # tracked Compose edit after build must not be admitted with --no-build.
  $tokens=$null; $parseErrors=$null
  $ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $repoRoot 'scripts/live/Start-LotusFrontOfficeCanonical.ps1'),[ref]$tokens,[ref]$parseErrors)
  if ($parseErrors.Count) { throw 'Startup helper parse failed.' }
  foreach ($name in @('Invoke-ComposeUp','Get-GitRepositoryIdentity','Invoke-WithProcessEnvironment')) {
    $helper=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
    . ([scriptblock]::Create($helper.Extent.Text))
  }
  function Invoke-CanonicalComposeCommand { param($RepoPath,$Command); $script:startupCommands += $Command }
  $testRepo=$repositories[0].RepoPath
  $prebuiltRepositories=@{}
  $composeUpCommand='docker compose up -d --build'; $runtimePhases=[Collections.ArrayList]::new(); $script:startupCommands=@()
  $workbenchRepo=$testRepo; $CanonicalEvidenceDirectory=''
  $defaultRoot=$ast.Find({param($node) $node -is [Management.Automation.Language.AssignmentStatementAst] -and
    $node.Left -is [Management.Automation.Language.VariableExpressionAst] -and $node.Left.VariablePath.UserPath -eq 'canonicalEvidenceRoot'},$true)
  . ([scriptblock]::Create($defaultRoot.Extent.Text))
  $defaultOutput=Join-Path $fixture 'default-build-output'
  New-Item -ItemType Directory -Path $defaultOutput | Out-Null
  $defaultPlan=[pscustomobject]@{Name='a'; RepoPath=$testRepo; CommitSha=(& git -C $testRepo rev-parse HEAD).Trim(); ComposeFingerprint=(Get-CanonicalComposeFingerprint -RepoPath $testRepo); Environment=@{
    LOTUS_BUILD_PROOF_FIXTURE=$fixture; LOTUS_BUILD_PROOF_OUTPUT=$defaultOutput; LOTUS_BUILD_PROOF_SCOPE='a'
  }}
  $defaultReceipt=Join-Path $canonicalEvidenceRoot 'build-plan-default-proof.json'
  Invoke-CanonicalBuildPlan -Plan @($defaultPlan) -Concurrency 1 -PollMilliseconds 100 -AssertAdmission { if (-not $fence.CanRead) { throw 'Parent fence lost.' } } -EvidencePath $defaultReceipt
  $prebuiltRepositories[$testRepo]=$defaultPlan
  if (-not (Test-Path -LiteralPath $defaultReceipt)) { throw 'Default receipt was not written.' }
  Invoke-ComposeUp $testRepo
  if ($script:startupCommands.Count -ne 1 -or $script:startupCommands[0] -notmatch '--no-build') { throw 'Clean prebuilt startup was refused.' }
  $ignoredEnv=Join-Path $testRepo '.env'
  [IO.File]::WriteAllText($ignoredEnv, 'WORKBENCH_DEPLOYMENT_ID=changed-after-build')
  $refused=$false
  try { Invoke-ComposeUp $testRepo }
  catch { if ($_.Exception.Message -ne 'Prebuilt canonical Compose configuration changed before startup.') { throw }; $refused=$true }
  if (-not $refused -or $script:startupCommands.Count -ne 1) { throw 'Ignored Compose input drift admitted at startup.' }
  [IO.File]::Delete($ignoredEnv)
  [IO.File]::WriteAllText($untrackedPath, 'export default function Page() { return null; }')
  $refused=$false
  try { Invoke-ComposeUp $testRepo }
  catch { if ($_.Exception.Message -ne 'Prebuilt canonical source is not clean before startup.') { throw }; $refused=$true }
  if (-not $refused -or $script:startupCommands.Count -ne 1) { throw 'Untracked prebuilt source admitted at startup.' }
  [IO.File]::Delete($untrackedPath)
  [IO.File]::WriteAllText((Join-Path $testRepo 'compose.yaml'), 'services: {changed: {image: unexpected}}')
  $refused=$false
  try { Invoke-ComposeUp $testRepo }
  catch { if ($_.Exception.Message -ne 'Prebuilt canonical source is not clean before startup.') { throw }; $refused=$true }
  if (-not $refused -or $script:startupCommands.Count -ne 1) { throw 'Dirty prebuilt source admitted at startup.' }
  Write-Host 'PASS prebuilt startup: ignored output accepted; untracked route and same-SHA tracked Compose mutation refused before execution'
  $phases = [Collections.ArrayList]::new()
  $value = Invoke-CanonicalRuntimePhase -Records $phases -Name 'valid' -Action { 'preserved-output' }
  if ($value -ne 'preserved-output') { throw 'Phase wrapper changed action output.' }
  try { Invoke-CanonicalRuntimePhase -Records $phases -Name 'refused' -Action { throw 'CONTROLLED_PHASE_FAILURE' } }
  catch { if ($_.Exception.Message -ne 'CONTROLLED_PHASE_FAILURE') { throw } }
  if ($phases.Count -ne 2 -or $phases[0].status -ne 'succeeded' -or $phases[1].status -ne 'failed' -or
      @($phases | Where-Object { -not $_.ended_at_utc -or $_.duration_ms -lt 0 }).Count) { throw 'Phase receipt lost actual outcome.' }
  Write-Host 'PASS canonical phase receipts: success, failure and unchanged output'
  # Real Compose configuration resolution is read-only and requires no running daemon.
  $env:PATH=$oldPath
  $configRepo=Join-Path $fixture 'real-compose-inputs'
  New-Item -ItemType Directory -Path $configRepo | Out-Null
  $configFile=Join-Path $configRepo 'compose.yaml'
  [IO.File]::WriteAllText($configFile, @'
services:
  app:
    image: busybox:latest
    env_file: runtime.env
    environment:
      DEPLOYMENT_ID: ${DEPLOYMENT_ID}
'@)
  $dotEnv=Join-Path $configRepo '.env'
  $runtimeEnv=Join-Path $configRepo 'runtime.env'
  [IO.File]::WriteAllText($dotEnv,'DEPLOYMENT_ID=build-a')
  [IO.File]::WriteAllText($runtimeEnv,'PRIVATE_VALUE=controlled-private-a')
  $configEnvironment=@{COMPOSE_FILE=$configFile; COMPOSE_PROJECT_NAME='canonical-config-proof'}
  $first=Get-CanonicalComposeFingerprint -RepoPath $configRepo -Environment $configEnvironment
  [IO.File]::WriteAllText($dotEnv,'DEPLOYMENT_ID=build-b')
  $second=Get-CanonicalComposeFingerprint -RepoPath $configRepo -Environment $configEnvironment
  [IO.File]::WriteAllText($runtimeEnv,'PRIVATE_VALUE=controlled-private-b')
  $third=Get-CanonicalComposeFingerprint -RepoPath $configRepo -Environment $configEnvironment
  if ($first -eq $second -or $second -eq $third -or "$first$second$third" -notmatch '^[a-f0-9]{192}$') { throw 'Real Compose inputs were not fingerprinted safely.' }
  $configEnvironment.DEPLOYMENT_ID='explicit-overlay'
  $overridden=Get-CanonicalComposeFingerprint -RepoPath $configRepo -Environment $configEnvironment
  [IO.File]::WriteAllText($dotEnv,'DEPLOYMENT_ID=irrelevant-under-explicit-overlay')
  if ((Get-CanonicalComposeFingerprint -RepoPath $configRepo -Environment $configEnvironment) -ne $overridden) { throw 'Effective explicit Compose overlay was not retained.' }
  [IO.File]::Delete($runtimeEnv)
  $refused=$false
  try { Get-CanonicalComposeFingerprint -RepoPath $configRepo -Environment $configEnvironment | Out-Null }
  catch { if ($_.Exception.Message -ne 'Canonical Compose configuration could not be resolved.') { throw }; $refused=$true }
  if (-not $refused) { throw 'Missing Compose input admitted.' }
  Write-Host 'PASS real Compose resolution: .env/env_file changes, explicit overlay, bounded missing-input failure; no container mutation'
} finally {
  if ($fence) { $fence.Dispose() }
  $env:PATH = $oldPath
  $env:LOTUS_BUILD_PROOF_SCOPE = $oldMarker
  $env:LOTUS_BUILD_PROOF_FIXTURE = $oldFixture
  $resolved = (Resolve-Path -LiteralPath $fixture).Path
  $temporary = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if (-not $resolved.StartsWith($temporary, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid fixture cleanup target.' }
  Remove-Item -LiteralPath $resolved -Recurse -Force
}
