$ErrorActionPreference = 'Stop'
$tokens = $null; $parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile(
  (Join-Path $PSScriptRoot '../live/Start-LotusFrontOfficeCanonical.ps1'),
  [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw 'Canonical launcher did not parse.' }
$helper = $ast.Find({
  param($node)
  $node -is [Management.Automation.Language.FunctionDefinitionAst] -and
  $node.Name -eq 'Get-GitRepositoryIdentity'
}, $true)
if (-not $helper) { throw 'Canonical Git identity helper is missing.' }
. ([scriptblock]::Create($helper.Extent.Text))

$script:gitExecutable = (Get-Command git -CommandType Application | Select-Object -First 1).Source
$script:fault = $null
# Forward to real Git except for deliberately unreachable empty/error stdout controls.
function git {
  $command = $args[2..($args.Count - 1)] -join ' '
  if ($script:fault -and $command -eq $script:fault.Command) {
    $global:LASTEXITCODE = $script:fault.ExitCode
    return $script:fault.Output
  }
  & $script:gitExecutable @args
  $global:LASTEXITCODE = $LASTEXITCODE
}
function Invoke-FixtureGit {
  & $script:gitExecutable -C $fixtureRoot @args
  if ($LASTEXITCODE -ne 0) { throw "Fixture Git failed: $args" }
}
$script:results = @()
function Test-Case {
  param([string]$Name, [scriptblock]$Body)
  try {
    & $Body
    $script:results += [ordered]@{ name = $Name; passed = $true }
  } catch {
    $script:results += [ordered]@{ name = $Name; passed = $false; error = $_.Exception.Message }
  } finally {
    $script:fault = $null
  }
}
function Assert-Identity {
  param([string]$ExpectedBranch)
  $identity = Get-GitRepositoryIdentity -RepoPath $fixtureRoot -RequireCleanPrebuiltSource
  if ($identity.CommitSha -cne $script:commit -or $identity.Branch -cne $ExpectedBranch) {
    throw 'Git identity did not preserve the exact commit and branch.'
  }
}
function Assert-Rejected {
  param([string]$ExpectedError)
  try {
    Get-GitRepositoryIdentity -RepoPath $fixtureRoot -RequireCleanPrebuiltSource | Out-Null
  } catch {
    if ($_.Exception.Message -notlike "*$ExpectedError*") { throw }
    return
  }
  throw "Invalid source was accepted: $ExpectedError"
}

$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ('lotus-git-identity-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
try {
  Invoke-FixtureGit init -q -b main
  Invoke-FixtureGit -c user.name=Fixture -c user.email=fixture@example.invalid -c commit.gpgsign=false commit --allow-empty -qm fixture
  $script:commit = (& $script:gitExecutable -C $fixtureRoot rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0) { throw 'Fixture identity resolution failed.' }
  Invoke-FixtureGit update-ref refs/remotes/origin/main $script:commit
  Test-Case 'clean main' { Assert-Identity 'main' }
  Invoke-FixtureGit checkout -q -b qa-control
  Test-Case 'named branch remains named for mainline preflight refusal' { Assert-Identity 'qa-control' }
  Invoke-FixtureGit checkout -q --detach $script:commit
  Test-Case 'clean exact detached main' { Assert-Identity 'main' }
  Invoke-FixtureGit -c user.name=Fixture -c user.email=fixture@example.invalid -c commit.gpgsign=false commit --allow-empty -qm divergent
  Test-Case 'detached mismatch rejected' { Assert-Rejected 'not exactly at origin/main' }
  Invoke-FixtureGit checkout -q --detach $script:commit
  $untracked = Join-Path $fixtureRoot 'untracked.txt'
  [IO.File]::WriteAllText($untracked, 'dirty')
  Test-Case 'untracked source rejected' { Assert-Rejected 'not clean before startup' }
  Invoke-FixtureGit add untracked.txt
  Test-Case 'staged source rejected' { Assert-Rejected 'not clean before startup' }
  Invoke-FixtureGit reset -q
  Remove-Item -LiteralPath $untracked

  foreach ($command in @('rev-parse HEAD', 'branch --show-current', 'rev-parse refs/remotes/origin/main', 'status --porcelain --untracked-files=all')) {
    $expectedError = switch ($command) {
      'rev-parse HEAD' { 'Unable to resolve Git commit' }
      'branch --show-current' { 'Unable to resolve Git branch' }
      'rev-parse refs/remotes/origin/main' { 'not exactly at origin/main' }
      default { 'not clean before startup' }
    }
    foreach ($output in @($null, 'misleading-success-output')) {
      Test-Case "failed $command with output [$output]" {
        $script:fault = @{ Command = $command; ExitCode = 128; Output = $output }
        Assert-Rejected $expectedError
      }
    }
  }
  foreach ($command in @('rev-parse HEAD', 'rev-parse refs/remotes/origin/main')) {
    $expectedError = if ($command -eq 'rev-parse HEAD') { 'Unable to resolve Git commit' } else { 'not exactly at origin/main' }
    foreach ($output in @($null, '   ')) {
      Test-Case "successful empty $command [$output] rejected" {
        $script:fault = @{ Command = $command; ExitCode = 0; Output = $output }
        Assert-Rejected $expectedError
      }
    }
  }
  Test-Case 'whitespace detached branch uses exact main fallback' {
    $script:fault = @{ Command = 'branch --show-current'; ExitCode = 0; Output = '   ' }
    Assert-Identity 'main'
  }
  Test-Case 'multiline identity output rejected' {
    $script:fault = @{ Command = 'rev-parse refs/remotes/origin/main'; ExitCode = 0; Output = @($script:commit, $script:commit) }
    Assert-Rejected 'not exactly at origin/main'
  }
} finally {
  $resolvedFixture = [IO.Path]::GetFullPath($fixtureRoot)
  $resolvedTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if (-not $resolvedFixture.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase) -or
      -not (Split-Path -Leaf $resolvedFixture).StartsWith('lotus-git-identity-')) {
    throw 'Refusing unexpected fixture cleanup path.'
  }
  Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
}
$failed = @($script:results | Where-Object { -not $_.passed })
[ordered]@{ passed = ($failed.Count -eq 0); powershell = $PSVersionTable.PSVersion.ToString(); cases = $script:results } | ConvertTo-Json -Depth 5 -Compress
if ($failed.Count) { exit 1 }
