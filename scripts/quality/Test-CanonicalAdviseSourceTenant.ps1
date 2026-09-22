$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '../live/CanonicalAdviseSourceTenant.psm1') -Force

$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ('lotus-advise-source-tenant-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
$fixturePath = Join-Path $fixtureRoot 'contract.json'
try {
  $contract = @{
    portfolio = @{ source_tenant_id = 'source-tenant-A' }
    dpm_command_center = @{ workbench_caller_tenant_id = 'caller-tenant-B' }
  }
  $contract | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $fixturePath -Encoding UTF8
  $environment = Get-CanonicalAdviseEnvironment -ContractPath $fixturePath
  if ($environment.Count -ne 1 -or $environment.LOTUS_ADVISE_TENANT_ID -cne 'source-tenant-A') {
    throw 'Advise Compose did not receive only the portfolio source tenant.'
  }

  $contract.dpm_command_center.workbench_caller_tenant_id = 'caller-tenant-C'
  $contract | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $fixturePath -Encoding UTF8
  if ((Get-CanonicalAdviseEnvironment -ContractPath $fixturePath).LOTUS_ADVISE_TENANT_ID -cne 'source-tenant-A') {
    throw 'Changing only caller admission changed Advise source ownership.'
  }

  $contract.portfolio.source_tenant_id = 'source-tenant-D'
  $contract | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $fixturePath -Encoding UTF8
  if ((Get-CanonicalAdviseEnvironment -ContractPath $fixturePath).LOTUS_ADVISE_TENANT_ID -cne 'source-tenant-D') {
    throw 'Changing portfolio source ownership did not change Advise Compose identity.'
  }

  foreach ($invalid in @($null, '', ' ', ' source-tenant-D ', 123, $true)) {
    $contract.portfolio.source_tenant_id = $invalid
    $contract | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $fixturePath -Encoding UTF8
    try {
      Get-CanonicalAdviseEnvironment -ContractPath $fixturePath | Out-Null
      throw 'Missing or malformed source tenant was accepted.'
    } catch {
      if ($_.Exception.Message -notlike '*portfolio.source_tenant_id must be an exact non-blank source tenant*') { throw }
    }
  }
  [ordered]@{ passed = $true; source = 'portfolio.source_tenant_id' } | ConvertTo-Json -Compress
} finally {
  $resolvedFixture = [IO.Path]::GetFullPath($fixtureRoot)
  $resolvedTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if (-not $resolvedFixture.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase) -or
      -not (Split-Path -Leaf $resolvedFixture).StartsWith('lotus-advise-source-tenant-')) {
    throw 'Refusing to remove an unexpected Advise fixture path.'
  }
  Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
}
