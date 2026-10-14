param(
  [Parameter(Mandatory)][string]$GatewayBaseUrl,
  [ValidateSet('valid', 'missing-role', 'wrong-role', 'missing-tenant')][string]$Case = 'valid'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$uri = [uri]$GatewayBaseUrl
if (-not $uri.IsLoopback -or $uri.Scheme -ne 'http') { throw 'Fixture requires loopback HTTP.' }
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile(
  (Join-Path $PSScriptRoot '../live/Validate-LotusFrontOfficeCanonical.ps1'), [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'Canonical validator did not parse.' }
$headers = @($ast.FindAll({param($node)
  $node -is [Management.Automation.Language.AssignmentStatementAst] -and
  $node.Left.Extent.Text -eq '$canonicalCallerContextHeaders'
}, $true))
$helper = @($ast.FindAll({param($node)
  $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Test-Endpoint'
}, $true))
$request = @($ast.FindAll({param($node)
  $node -is [Management.Automation.Language.CommandAst] -and $node.GetCommandName() -eq 'Test-Endpoint' -and
  $node.Extent.Text.Contains('"Gateway workbench overview"')
}, $true))
if ($headers.Count -ne 1 -or $helper.Count -ne 1 -or $request.Count -ne 1) { throw 'Expected exactly one canonical caller, helper and overview request.' }
. ([scriptblock]::Create($headers[0].Extent.Text))
. ([scriptblock]::Create($helper[0].Extent.Text))
switch ($Case) {
  'missing-role' { $canonicalCallerContextHeaders.Remove('X-Role') }
  'wrong-role' { $canonicalCallerContextHeaders['X-Role'] = 'VIEWER' }
  'missing-tenant' { $canonicalCallerContextHeaders.Remove('X-Tenant-Id') }
}
$PortfolioId = 'PB_SG_GLOBAL_BAL_001'
# Execute the real outbound call and helper; only bound its retry budget for the fixture.
. ([scriptblock]::Create($request[0].Extent.Text + ' -Attempts 1 -DelaySeconds 0'))
