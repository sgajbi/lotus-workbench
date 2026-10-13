$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot '../live/CanonicalEvidencePublication.psm1') -Force
$root = Join-Path ([IO.Path]::GetTempPath()) ('lotus-evidence-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $root | Out-Null
$cases = [Collections.Generic.List[string]]::new()
function Assert-Refusal {
  param([string]$Name, [scriptblock]$Action, [string]$Pattern)
  $caught = ''
  try { & $Action | Out-Null } catch { $caught = $_.Exception.Message }
  if ($caught -notmatch $Pattern) { throw "Case $Name expected '$Pattern'; observed '$caught'." }
  $cases.Add($Name)
}
try {
  # Reproduce the running wrapper staging the destination, followed by the full
  # validator staging that already-created directory on a realistic deep path.
  $parent = Join-Path $root ('p' * (145 - $root.Length - 1))
  $published = Join-Path $parent 'live-canonical'
  New-Item -ItemType Directory -Path $published -Force | Out-Null
  [IO.File]::WriteAllText((Join-Path $published 'proof.txt'), 'original')
  $outer = New-CanonicalEvidencePublicationWorkspace -PublishedDirectory $published -Stage
  [IO.File]::WriteAllText((Join-Path $outer 'proof.txt'), 'outer-prior')
  $inner = New-CanonicalEvidencePublicationWorkspace -PublishedDirectory $outer -Stage
  if ($inner.Length -ne $outer.Length -or (Split-Path -Leaf $inner).Length -gt 54) { throw 'Nested generated names grew.' }
  if ((Test-Path -LiteralPath $published) -or (Test-Path -LiteralPath $outer)) { throw 'Premature publication.' }
  [IO.File]::WriteAllText((Join-Path $inner 'proof.txt'), 'accepted')
  Publish-CanonicalBrowserEvidence -StagedDirectory $inner -PublishedDirectory $outer
  if (Test-Path -LiteralPath $published) { throw 'Nested publication escaped outer admission.' }
  Publish-CanonicalBrowserEvidence -StagedDirectory $outer -PublishedDirectory $published
  if ([IO.File]::ReadAllText((Join-Path $published 'proof.txt')) -cne 'accepted') { throw 'Final evidence missing.' }
  $retained = @(Get-ChildItem -LiteralPath $parent -Directory | Where-Object { $_.Name -like 'diagnostic-*-superseded-*' -or $_.Name -like 'diagnostic-superseded-*' })
  $prior = @($retained | ForEach-Object { [IO.File]::ReadAllText((Join-Path $_.FullName 'proof.txt')) })
  if ($prior.Count -ne 2 -or 'original' -cnotin $prior -or 'outer-prior' -cnotin $prior) { throw 'Earlier evidence lost.' }
  if ((Test-Path -LiteralPath $inner) -or (Test-Path -LiteralPath $outer)) { throw 'Staging was not moved.' }
  $cases.Add('nested-publication-retains-both-earlier-directories')
  $diagnostic = New-CanonicalEvidencePublicationWorkspace -PublishedDirectory $published -Diagnostic
  if ($diagnostic -eq $published -or (Split-Path -Leaf $diagnostic) -notlike 'diagnostic-client-demo-*' -or
      [IO.File]::ReadAllText((Join-Path $published 'proof.txt')) -cne 'accepted') { throw 'Diagnostic isolation lost.' }
  $cases.Add('client-demo-isolation')
  Assert-Refusal 'incompatible-modes' { New-CanonicalEvidencePublicationWorkspace -PublishedDirectory $published -Stage -Diagnostic } 'both staged and diagnostic'
  Assert-Refusal 'root-destination' { New-CanonicalEvidencePublicationWorkspace -PublishedDirectory ([IO.Path]::GetPathRoot($root)) -Stage } 'must name a directory'
  $filesystemRoot = [IO.Path]::GetPathRoot($root)
  $normalizedRoot = Join-Path $filesystemRoot '.'
  Assert-Refusal 'diagnostic-root-destination' { New-CanonicalEvidencePublicationWorkspace -PublishedDirectory $filesystemRoot -Diagnostic } 'must name a directory'
  foreach ($mode in @('Stage', 'Diagnostic')) {
    $options = @{ PublishedDirectory = $normalizedRoot }; $options[$mode] = $true
    Assert-Refusal "normalized-root-$mode" { New-CanonicalEvidencePublicationWorkspace @options } 'must name a directory'
  }
  if ((New-CanonicalEvidencePublicationWorkspace -PublishedDirectory $filesystemRoot) -ne $filesystemRoot) { throw 'Plain path normalization changed.' }
  $cases.Add('plain-root-normalization')
  Assert-Refusal 'missing-stage' { Publish-CanonicalBrowserEvidence -StagedDirectory $inner -PublishedDirectory (Join-Path $parent 'missing') } 'is missing'
  $collision = Join-Path $parent 'collision-stage'
  New-Item -ItemType Directory -Path $collision | Out-Null
  Assert-Refusal 'recreated-destination' { Publish-CanonicalBrowserEvidence -StagedDirectory $collision -PublishedDirectory $published } 'was recreated'
  if (-not (Test-Path -LiteralPath $collision)) { throw 'Failed publication lost stage.' }
  Assert-Refusal 'native-rename-failure' { Publish-CanonicalBrowserEvidence -StagedDirectory $collision -PublishedDirectory (Join-Path $root 'absent-parent/target') } '.+'
  if (-not (Test-Path -LiteralPath $collision)) { throw 'Native rename failure lost stage.' }
  $fileTarget = Join-Path $parent 'file-target'
  [IO.File]::WriteAllText($fileTarget, 'file')
  Assert-Refusal 'file-destination' { New-CanonicalEvidencePublicationWorkspace -PublishedDirectory $fileTarget -Stage } 'must be a directory'
  if ([IO.File]::ReadAllText($fileTarget) -cne 'file') { throw 'File target changed.' }
  if ($env:OS -eq 'Windows_NT') {
    $boundaryParent = Join-Path $root 'boundary'
    $boundaryStage = Join-Path $boundaryParent 's'
    $boundaryDestination = Join-Path $boundaryParent ('b' * 30)
    New-Item -ItemType Directory -Path $boundaryStage -Force | Out-Null
    $boundaryName = 'f' * (259 - $boundaryDestination.Length - 1)
    [IO.File]::WriteAllText((Join-Path $boundaryStage $boundaryName), 'boundary')
    Publish-CanonicalBrowserEvidence -StagedDirectory $boundaryStage -PublishedDirectory $boundaryDestination
    if ([IO.File]::ReadAllText((Join-Path $boundaryDestination $boundaryName)) -cne 'boundary') { throw 'Valid boundary refused.' }
    $cases.Add('supported-259-character-file')
    Assert-Refusal 'unsupported-260-character-file' { Publish-CanonicalBrowserEvidence -StagedDirectory $boundaryDestination -PublishedDirectory ($boundaryDestination + 'x') } 'supported Windows limit'
    if (-not (Test-Path -LiteralPath $boundaryDestination)) { throw 'Boundary refusal lost source.' }
    $deepParent = Join-Path $root ('d' * (205 - $root.Length - 1))
    $deepTarget = Join-Path $deepParent 'x'
    New-Item -ItemType Directory -Path $deepTarget -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $deepTarget 'old.txt'), 'deep-original')
    foreach ($mode in @('Stage', 'Diagnostic')) {
      $options = @{ PublishedDirectory = $deepTarget }; $options[$mode] = $true
      Assert-Refusal "unsupported-generated-$mode" { New-CanonicalEvidencePublicationWorkspace @options } 'supported Windows limit'
    }
    if (@(Get-ChildItem -LiteralPath $deepParent).Count -ne 1 -or
        [IO.File]::ReadAllText((Join-Path $deepTarget 'old.txt')) -cne 'deep-original') { throw 'Rejected admission moved prior evidence.' }
    $longContent = Join-Path $parent 'long-content'
    New-Item -ItemType Directory -Path $longContent | Out-Null
    $longFile = Join-Path $longContent ('f' * 90)
    [IO.File]::WriteAllText($longFile, 'long-original')
    Assert-Refusal 'unsupported-retained-descendant' { New-CanonicalEvidencePublicationWorkspace -PublishedDirectory $longContent -Stage } 'supported Windows limit'
    if ([IO.File]::ReadAllText($longFile) -cne 'long-original') { throw 'Rejected subtree move lost data.' }
    $longDestination = Join-Path $deepParent ('z' * 30)
    Assert-Refusal 'unsupported-published-descendant' { Publish-CanonicalBrowserEvidence -StagedDirectory $longContent -PublishedDirectory $longDestination } 'supported Windows limit'
    if (-not (Test-Path -LiteralPath $longContent) -or (Test-Path -LiteralPath $longDestination)) { throw 'Rejected publication changed directories.' }
  }
  @{ contract = 'nested-evidence-publication'; passed = $true; cases = @($cases); parentLength = $parent.Length; outerLength = $outer.Length; innerLength = $inner.Length } | ConvertTo-Json -Compress
} finally {
  $resolved = [IO.Path]::GetFullPath($root)
  $temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if (-not $resolved.StartsWith($temp, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $resolved) -notlike 'lotus-evidence-*') { throw 'Unexpected cleanup path.' }
  Remove-Item -LiteralPath $resolved -Recurse -Force
}
