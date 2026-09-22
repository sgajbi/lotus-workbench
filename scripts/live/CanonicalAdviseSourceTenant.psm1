function Get-CanonicalAdviseEnvironment {
  param([Parameter(Mandatory = $true)][string]$ContractPath)

  if (-not (Test-Path -LiteralPath $ContractPath -PathType Leaf)) {
    throw "Canonical front-office demo data contract not found: $ContractPath"
  }
  $contract = Get-Content -Raw -LiteralPath $ContractPath | ConvertFrom-Json
  $sourceTenant = $contract.portfolio.source_tenant_id
  if ($sourceTenant -isnot [string] -or
      [string]::IsNullOrWhiteSpace($sourceTenant) -or
      $sourceTenant -cne $sourceTenant.Trim()) {
    throw 'Canonical portfolio.source_tenant_id must be an exact non-blank source tenant.'
  }
  return @{ LOTUS_ADVISE_TENANT_ID = $sourceTenant }
}

Export-ModuleMember -Function Get-CanonicalAdviseEnvironment
