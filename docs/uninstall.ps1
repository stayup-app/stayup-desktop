# StayUp uninstaller for Windows.
# Usage: irm https://stayup-app.github.io/stayup-desktop/uninstall.ps1 | iex
#   To also delete your StayUp user data, download the script first and run:
#     .\uninstall.ps1 -Purge

param(
    [switch]$Purge
)

$ErrorActionPreference = "Stop"

$uninstallKey = @(
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
) | ForEach-Object { Get-ItemProperty $_ -ErrorAction SilentlyContinue } |
    Where-Object { $_.DisplayName -eq "StayUp" } |
    Select-Object -First 1

if (-not $uninstallKey) {
    Write-Error "StayUp installation was not found."
    exit 1
}

$uninstallString = $uninstallKey.UninstallString -replace '"', ''

Write-Host "==> Uninstalling StayUp..." -ForegroundColor Cyan
Start-Process -FilePath $uninstallString -ArgumentList "/S" -Wait

if ($Purge) {
    Write-Host "==> Removing user data..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force "$env:APPDATA\dev.r-sik.stayup-desktop" -ErrorAction SilentlyContinue
}

Write-Host "==> StayUp uninstalled 🎉" -ForegroundColor Cyan
if (-not $Purge) {
    Write-Host "User data was kept. Re-run with -Purge to remove it too." -ForegroundColor Cyan
}
