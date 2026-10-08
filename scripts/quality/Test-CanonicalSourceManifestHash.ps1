$ErrorActionPreference = 'Stop'
$tokens=$null; $errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '../live/Start-LotusFrontOfficeCanonical.ps1'),[ref]$tokens,[ref]$errors)
if ($errors.Count) { throw 'Startup did not parse.' }
$helper=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Get-CanonicalSourceManifestHash'},$true)
if ($helper) { . ([scriptblock]::Create($helper.Extent.Text)) }
else {
  # Exercise the shipped old expression before the helper exists.
  function Get-CanonicalSourceManifestHash { param([string]$Path) (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant() }
}
$gate=$ast.Find({param($n) $n -is [Management.Automation.Language.IfStatementAst] -and $n.Extent.Text -match '\$runtimeHash' -and $n.Extent.Text -match 'mainlineSourceRuntimePath'},$true)
if (-not $gate) { throw 'Actual late source gate is missing.' }
$gateBody=[scriptblock]::Create($gate.Extent.Text)
$fixtureRoot=Join-Path ([IO.Path]::GetTempPath()) ('canonical-hash-'+[guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($fixtureRoot) | Out-Null
$mainlineSourcePreflightPath=Join-Path $fixtureRoot 'before.json'
$mainlineSourceRuntimePath=Join-Path $fixtureRoot 'after.json'
$script:results=@(); $script:nativeFault=0
$RequireMainlineSources=$true
$provenanceScript='fixture-generator'; $ProjectsRoot=$fixtureRoot; $workbenchRepo=$fixtureRoot
function node { $global:LASTEXITCODE=$script:nativeFault }
function Set-Fixtures {
  [IO.File]::WriteAllText($mainlineSourcePreflightPath,'{}',[Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText($mainlineSourceRuntimePath,'{}',[Text.UTF8Encoding]::new($false))
}
function Case { param([string]$Name,[scriptblock]$Action)
  Set-Fixtures
  try { & $Action; $script:results+=@{name=$Name;passed=$true} }
  catch { $script:results+=@{name=$Name;passed=$false;error=$_.Exception.Message} }
  finally { $script:nativeFault=0 }
}
function Reject { param([scriptblock]$Action,[string]$Message)
  try { & $Action } catch { if ($_.Exception.Message -notlike "*$Message*") { throw }; return }
  throw "Expected refusal: $Message"
}
try {
  Case 'known raw-byte SHA256 oracle' {
    if ((Get-CanonicalSourceManifestHash $mainlineSourcePreflightPath) -cne '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a') { throw 'Wrong SHA256.' }
  }
  Case 'actual late gate matches' { & $gateBody }
  Case 'actual late gate refuses byte drift' {
    [IO.File]::WriteAllText($mainlineSourceRuntimePath,'{ }')
    Reject { & $gateBody } 'sources changed during Docker startup'
  }
  Case 'native provenance failure remains terminating' {
    $script:nativeFault=19
    Reject { & $gateBody } 'provenance changed during Docker startup'
  }
  Case 'nested lifecycle retains hashing without ambient Get-FileHash' {
    & {
      # Fault injection reproduces the recorded missing-command condition, not its unknown trigger.
      function Get-FileHash { throw "The term 'Get-FileHash' is not recognized" }
      & { & $gateBody }
    }
  }
  Case 'missing manifest refuses precisely' {
    [IO.File]::Delete($mainlineSourcePreflightPath)
    Reject { Get-CanonicalSourceManifestHash $mainlineSourcePreflightPath } 'Cannot read canonical mainline source manifest'
  }
  Case 'corrupt identical manifests cannot certify' {
    [IO.File]::WriteAllText($mainlineSourcePreflightPath,'not JSON')
    [IO.File]::WriteAllText($mainlineSourceRuntimePath,'not JSON')
    Reject { & $gateBody } 'Invalid canonical mainline source manifest'
  }
  Case 'empty manifest cannot certify' {
    [IO.File]::WriteAllText($mainlineSourcePreflightPath,'')
    Reject { & $gateBody } 'Invalid canonical mainline source manifest'
  }
  Case 'unreadable manifest refuses and releases resources' {
    $lock=[IO.File]::Open($mainlineSourcePreflightPath,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    try { Reject { Get-CanonicalSourceManifestHash $mainlineSourcePreflightPath } 'Cannot read canonical mainline source manifest' }
    finally { $lock.Dispose() }
    Get-CanonicalSourceManifestHash $mainlineSourcePreflightPath | Out-Null
  }
  Case 'stream resources disposed after success' {
    Get-CanonicalSourceManifestHash $mainlineSourcePreflightPath | Out-Null
    $exclusive=[IO.File]::Open($mainlineSourcePreflightPath,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    $exclusive.Dispose()
  }
  Case 'actual preflight refuses an unavailable hash prerequisite before returning startup admission' {
    $preflight=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Invoke-MainlineSourceProvenancePreflight'},$true)
    if (-not $preflight) { throw 'Actual preflight is missing.' }
    & {
      . ([scriptblock]::Create($preflight.Extent.Text))
      function New-Item { }
      function Join-Path { param($Path,$ChildPath)
        if ($ChildPath -eq 'mainline-source-provenance.json') { return $mainlineSourcePreflightPath }
        if ($ChildPath -eq 'mainline-source-provenance-runtime.json') { return $mainlineSourceRuntimePath }
        return $fixtureRoot
      }
      function Get-CanonicalSourceManifestHash { throw 'Controlled unavailable SHA256 prerequisite' }
      Reject { Invoke-MainlineSourceProvenancePreflight } 'Controlled unavailable SHA256 prerequisite'
    }
  }
  $script:results | ConvertTo-Json -Depth 4
  if (@($script:results | Where-Object { -not $_.passed }).Count) { exit 1 }
  exit 0
} finally {
  # Only the exact two generated fixtures and empty owned directory are removed.
  [IO.File]::Delete($mainlineSourcePreflightPath); [IO.File]::Delete($mainlineSourceRuntimePath)
  [IO.Directory]::Delete($fixtureRoot)
}
