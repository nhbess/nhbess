# Render paper_social.mp4 from the canvas animation.
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies…"
  npm install
}

node record.mjs @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
