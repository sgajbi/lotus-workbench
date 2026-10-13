Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-CanonicalEvidencePath {
  param([string]$Path, [switch]$File)
  # Use the portable Windows boundary in both PowerShell 5 and 7.
  $limit = if ($File) { 259 } else { 247 }
  if ($env:OS -eq 'Windows_NT' -and $Path.Length -gt $limit) {
    throw "Canonical evidence path exceeds the supported Windows limit ($limit characters). Choose a shorter evidence destination."
  }
}

function Assert-CanonicalEvidenceMove {
  param([string]$Source, [string]$Destination)
  Assert-CanonicalEvidencePath -Path $Source
  Assert-CanonicalEvidencePath -Path $Destination
  foreach ($entry in Get-ChildItem -LiteralPath $Source -Recurse -Force -ErrorAction Stop) {
    $relative = $entry.FullName.Substring($Source.TrimEnd([IO.Path]::DirectorySeparatorChar).Length + 1)
    Assert-CanonicalEvidencePath -Path $entry.FullName -File:(-not $entry.PSIsContainer)
    Assert-CanonicalEvidencePath -Path (Join-Path $Destination $relative) -File:(-not $entry.PSIsContainer)
  }
}

function New-CanonicalEvidencePublicationWorkspace {
  param(
    [Parameter(Mandatory)][string]$PublishedDirectory,
    [switch]$Stage,
    [switch]$Diagnostic
  )

  $published = [System.IO.Path]::GetFullPath($PublishedDirectory)
  if ($Stage -and $Diagnostic) {
    throw 'Canonical evidence workspace cannot be both staged and diagnostic.'
  }
  if (-not $Stage -and -not $Diagnostic) { return $published }

  if ($published -eq [IO.Path]::GetPathRoot($published)) {
    throw 'Canonical browser evidence destination must name a directory.'
  }
  $parent = Split-Path -Parent $published
  $leaf = Split-Path -Leaf $published
  if ([string]::IsNullOrWhiteSpace($leaf) -or [string]::IsNullOrWhiteSpace($parent)) {
    throw 'Canonical browser evidence destination must name a directory.'
  }
  # Nested validators receive the outer pending path. Never embed its leaf.
  $kind = if ($Diagnostic) { 'client-demo' } else { 'pending' }
  $staged = Join-Path $parent "diagnostic-$kind-$([guid]::NewGuid().ToString('N'))"
  $superseded = Join-Path $parent "diagnostic-superseded-$([guid]::NewGuid().ToString('N'))"
  Assert-CanonicalEvidencePath -Path $published
  Assert-CanonicalEvidencePath -Path $staged
  Assert-CanonicalEvidencePath -Path $superseded
  if ($Stage -and (Test-Path -LiteralPath $published)) {
    if (-not (Test-Path -LiteralPath $published -PathType Container)) { throw 'Canonical browser evidence destination must be a directory.' }
    Assert-CanonicalEvidenceMove -Source $published -Destination $superseded
  }
  New-Item -ItemType Directory -Force -Path $parent -ErrorAction Stop | Out-Null
  if ($Diagnostic) { return $staged }
  if (Test-Path -LiteralPath $published) {
    [IO.Directory]::Move($published, $superseded)
  }
  New-Item -ItemType Directory -Path $staged -ErrorAction Stop | Out-Null
  return $staged
}

function Publish-CanonicalBrowserEvidence {
  param(
    [Parameter(Mandatory)][string]$StagedDirectory,
    [Parameter(Mandatory)][string]$PublishedDirectory
  )

  $staged = [System.IO.Path]::GetFullPath($StagedDirectory)
  $published = [System.IO.Path]::GetFullPath($PublishedDirectory)
  if ($staged -eq $published) { return }
  if (-not (Test-Path -LiteralPath $staged -PathType Container)) {
    throw "Canonical staged browser evidence is missing: $staged"
  }
  if (Test-Path -LiteralPath $published) {
    throw "Canonical browser evidence destination was recreated before full-profile publication: $published"
  }
  Assert-CanonicalEvidenceMove -Source $staged -Destination $published
  [IO.Directory]::Move($staged, $published)
}

Export-ModuleMember -Function @(
  'New-CanonicalEvidencePublicationWorkspace',
  'Publish-CanonicalBrowserEvidence'
)
