# Independent image construction only. The caller retains its original runtime fence.
function Get-CanonicalComposeFingerprint {
  param([Parameter(Mandatory)][string]$RepoPath, [hashtable]$Environment = @{})
  $overlay=$Environment.Clone()
  $overlay.PWD=$RepoPath
  $overlay.COMPOSE_PARALLEL_LIMIT='1'
  $previous=@{}
  foreach ($key in $overlay.Keys) {
    $previous[$key]=[Environment]::GetEnvironmentVariable($key,'Process')
    [Environment]::SetEnvironmentVariable($key,[string]$overlay[$key],'Process')
  }
  $pushed=$false
  try {
    Push-Location -LiteralPath $RepoPath -ErrorAction Stop
    $pushed=$true
    # Compose resolves .env, env_file and interpolation here. Never emit or persist
    # that potentially secret-bearing document, including parser/native diagnostics.
    $priorPreference=$ErrorActionPreference
    $ErrorActionPreference='Continue'
    try {
      $global:LASTEXITCODE=$null
      $lines=@(& docker compose config --format json 2>$null)
      $configExit=$LASTEXITCODE
    } finally { $ErrorActionPreference=$priorPreference }
    if ($null -eq $configExit -or $configExit -ne 0) { throw 'Canonical Compose configuration could not be resolved.' }
    $document=($lines -join "`n").Trim()
    try { $parsed=$document | ConvertFrom-Json -ErrorAction Stop }
    catch { throw 'Canonical Compose configuration is invalid.' }
    if (-not $document.StartsWith('{') -or -not $parsed.name -or -not $parsed.services) {
      throw 'Canonical Compose configuration is incomplete.'
    }
    $hasher=[Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($document)))).Replace('-','').ToLowerInvariant() }
    finally { $hasher.Dispose() }
  } finally {
    if ($pushed) { Pop-Location }
    foreach ($key in $previous.Keys) {
      if ($null -eq $previous[$key]) {
        [Environment]::SetEnvironmentVariable($key,[NullString]::Value,'Process')
      } else { [Environment]::SetEnvironmentVariable($key,$previous[$key],'Process') }
    }
  }
}

function Complete-CanonicalBuildJob {
  param([Parameter(Mandatory)]$Item)
  $Item.Finished = $true
  $Item.Record.ended_at_utc = [DateTime]::UtcNow.ToString('o')
  $Item.Record.duration_ms = $Item.Timer.ElapsedMilliseconds
  $Item.Record.status = 'failed'
  if ($Item.Job.State -eq 'Completed') {
    try {
      Receive-Job -Job $Item.Job -ErrorAction Stop | Out-Host
      $Item.Record.status = 'succeeded'
    } catch {
      # Preserve a failed child outcome without masking the caller's admission failure.
    }
  } elseif ($Item.Job.State -eq 'Stopped') {
    $Item.Record.status = 'cancelled'
  }
}

function Invoke-CanonicalBuildPlan {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][object[]]$Plan,
    [ValidateRange(1, 2)][int]$Concurrency = 1,
    [ValidateRange(100, 5000)][int]$PollMilliseconds = 5000,
    [Parameter(Mandatory)][scriptblock]$AssertAdmission,
    [Parameter(Mandatory)][string]$EvidencePath
  )
  $ErrorActionPreference = 'Stop'
  $pending = [System.Collections.Queue]::new()
  $jobs = [System.Collections.ArrayList]::new()
  $records = [System.Collections.ArrayList]::new()
  $names = @{}
  foreach ($entry in $Plan) {
    if (-not $entry.Name -or $names.ContainsKey($entry.Name) -or
        $entry.CommitSha -notmatch '^[a-f0-9]{40}$' -or $entry.ComposeFingerprint -notmatch '^[a-f0-9]{64}$' -or
        -not (Test-Path -LiteralPath $entry.RepoPath)) {
      throw 'Invalid canonical image build plan.'
    }
    $names[$entry.Name] = $true
    $pending.Enqueue($entry)
  }
  if ($pending.Count -eq 0) { throw 'Canonical image build plan is empty.' }
  $run = [ordered]@{
    schema = 'lotus-workbench.canonical-build-plan.v1'
    started_at_utc = [DateTime]::UtcNow.ToString('o')
    concurrency = $Concurrency
    status = 'failed'
    evidence_class = 'test_execution'
    scope = 'local image construction; not runtime or financial acceptance'
    builds = $records
  }
  $timer = [Diagnostics.Stopwatch]::StartNew()
  try {
    while ($pending.Count -or @($jobs | Where-Object { -not $_.Finished }).Count) {
      # Recheck source/expiry while jobs run, without reacquiring or publishing the lease.
      & $AssertAdmission
      foreach ($item in @($jobs | Where-Object { -not $_.Finished })) {
        if ($item.Job.State -in @('Completed', 'Failed', 'Stopped')) {
          Complete-CanonicalBuildJob -Item $item
          if ($item.Record.status -ne 'succeeded') {
            throw "Canonical image build failed: $($item.Record.repository)"
          }
        }
      }
      while ($pending.Count -and @($jobs | Where-Object { -not $_.Finished }).Count -lt $Concurrency) {
        & $AssertAdmission
        $entry = $pending.Dequeue()
        $record = [ordered]@{
          repository = $entry.Name
          source_sha = $entry.CommitSha
          compose_configuration_sha256 = $entry.ComposeFingerprint
          started_at_utc = [DateTime]::UtcNow.ToString('o')
          ended_at_utc = $null
          duration_ms = $null
          status = 'running'
        }
        [void]$records.Add($record)
        try {
          $job = Start-Job -ArgumentList $entry,(Join-Path $PSScriptRoot 'CanonicalBuildPlan.psm1') -ScriptBlock {
            param($Entry,$ModulePath)
            $ErrorActionPreference = 'Stop'
            Import-Module $ModulePath -Function Get-CanonicalComposeFingerprint
            Set-Location -LiteralPath $Entry.RepoPath
            foreach ($key in $Entry.Environment.Keys) {
              [Environment]::SetEnvironmentVariable($key, [string]$Entry.Environment[$key], 'Process')
            }
            $env:PWD = $Entry.RepoPath
            # Bound cross-project AND Compose service build concurrency. No ambient parent mutation.
            $env:COMPOSE_PARALLEL_LIMIT = '1'
            $before = (& git rev-parse HEAD).Trim()
            if ($LASTEXITCODE -ne 0 -or $before -cne $Entry.CommitSha) { throw 'Build source changed before execution.' }
            $changes = @(& git status --porcelain --untracked-files=all)
            if ($LASTEXITCODE -ne 0 -or $changes.Count) { throw 'Build source is not clean.' }
            if ((Get-CanonicalComposeFingerprint -RepoPath $Entry.RepoPath) -cne $Entry.ComposeFingerprint) {
              throw 'Build Compose configuration changed before execution.'
            }
            # Native progress uses stderr. Windows PowerShell 5 must not promote that
            # stream to a terminating error; the native exit code remains authoritative.
            $ErrorActionPreference = 'Continue'
            try {
              $global:LASTEXITCODE = $null
              & docker compose build 2>&1 | ForEach-Object { [string]$_ }
              $buildExit = $LASTEXITCODE
            } finally { $ErrorActionPreference = 'Stop' }
            if ($null -eq $buildExit -or $buildExit -ne 0) { throw 'Compose image construction failed.' }
            $after = (& git rev-parse HEAD).Trim()
            if ($LASTEXITCODE -ne 0 -or $after -cne $Entry.CommitSha) { throw 'Build source changed during execution.' }
            $changes = @(& git status --porcelain --untracked-files=all)
            if ($LASTEXITCODE -ne 0 -or $changes.Count) { throw 'Build source changed during execution.' }
            if ((Get-CanonicalComposeFingerprint -RepoPath $Entry.RepoPath) -cne $Entry.ComposeFingerprint) {
              throw 'Build Compose configuration changed during execution.'
            }
          }
        } catch {
          $record.status = 'failed'
          $record.ended_at_utc = [DateTime]::UtcNow.ToString('o')
          throw
        }
        [void]$jobs.Add([pscustomobject]@{Job=$job; Record=$record; Timer=[Diagnostics.Stopwatch]::StartNew(); Finished=$false})
      }
      if (@($jobs | Where-Object { -not $_.Finished }).Count) { Start-Sleep -Milliseconds $PollMilliseconds }
    }
    & $AssertAdmission
    $run.status = 'succeeded'
  } finally {
    # Stop and join children before the caller can publish an outcome or release its fence.
    foreach ($item in $jobs) {
      if (-not $item.Finished) {
        if ($item.Job.State -notin @('Completed', 'Failed', 'Stopped')) {
          Stop-Job -Job $item.Job
          Wait-Job -Job $item.Job | Out-Null
        }
        Complete-CanonicalBuildJob -Item $item
      }
      Remove-Job -Job $item.Job -Force
    }
    $run.ended_at_utc = [DateTime]::UtcNow.ToString('o')
    $run.duration_ms = $timer.ElapsedMilliseconds
    $run.not_started = @($pending.ToArray() | ForEach-Object { $_.Name })
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $EvidencePath) | Out-Null
    $run | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $EvidencePath -Encoding UTF8
  }
}

function Invoke-CanonicalRuntimePhase {
  param(
    [Parameter(Mandatory)][AllowEmptyCollection()][System.Collections.IList]$Records,
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][scriptblock]$Action
  )
  $record = [ordered]@{phase=$Name; started_at_utc=[DateTime]::UtcNow.ToString('o'); status='failed'}
  [void]$Records.Add($record)
  $timer = [Diagnostics.Stopwatch]::StartNew()
  try { & $Action; $record.status = 'succeeded' }
  finally {
    $record.ended_at_utc = [DateTime]::UtcNow.ToString('o')
    $record.duration_ms = $timer.ElapsedMilliseconds
  }
}

Export-ModuleMember -Function Invoke-CanonicalBuildPlan,Invoke-CanonicalRuntimePhase,Get-CanonicalComposeFingerprint
