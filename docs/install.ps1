# StayUp installer for Windows.
# Usage: irm https://stayup-app.github.io/stayup-desktop/install.ps1 | iex

$ErrorActionPreference = "Stop"

$repo = "stayup-app/stayup-desktop"
$apiUrl = "https://api.github.com/repos/$repo/releases/latest"

Write-Host "==> Fetching latest release..." -ForegroundColor Cyan
$release = Invoke-RestMethod -Uri $apiUrl -Headers @{ "User-Agent" = "stayup-installer" }

$asset = $release.assets | Where-Object { $_.name -like "*_x64-setup.exe" } | Select-Object -First 1
if (-not $asset) {
    Write-Error "Could not find a Windows installer (.exe) in the latest release."
    exit 1
}

$installer = Join-Path $env:TEMP $asset.name
Write-Host "==> Downloading $($asset.name)..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $installer -UseBasicParsing

Write-Host "==> Installing StayUp silently..." -ForegroundColor Cyan
Start-Process -FilePath $installer -ArgumentList "/S" -Wait

Remove-Item $installer -ErrorAction SilentlyContinue

Write-Host "==> StayUp installed 🎉 Launch it from the Start menu." -ForegroundColor Cyan
