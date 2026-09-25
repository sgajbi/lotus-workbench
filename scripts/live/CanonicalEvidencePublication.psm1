Set-StrictMode -Version Latest

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
  if ($Diagnostic) {
    $parent = Split-Path -Parent $published
    $leaf = Split-Path -Leaf $published
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    return Join-Path $parent "diagnostic-$leaf-client-demo-$([guid]::NewGuid().ToString('N'))"
  }
  if (-not $Stage) { return $published }

  $parent = Split-Path -Parent $published
  $leaf = Split-Path -Leaf $published
  if ([string]::IsNullOrWhiteSpace($leaf)) {
    throw 'Canonical browser evidence destination must name a directory.'
  }
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  if (Test-Path -LiteralPath $published) {
    $superseded = Join-Path $parent (
      "diagnostic-$leaf-superseded-$((Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ'))-$([guid]::NewGuid().ToString('N'))"
    )
    Move-Item -LiteralPath $published -Destination $superseded
  }
  $staged = Join-Path $parent "diagnostic-$leaf-pending-$([guid]::NewGuid().ToString('N'))"
  New-Item -ItemType Directory -Path $staged | Out-Null
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
  Move-Item -LiteralPath $staged -Destination $published
}

Export-ModuleMember -Function @(
  'New-CanonicalEvidencePublicationWorkspace',
  'Publish-CanonicalBrowserEvidence'
)
