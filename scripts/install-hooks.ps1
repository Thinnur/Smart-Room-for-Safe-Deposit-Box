# ============================================================
# install-hooks.ps1
# Installs .githooks into the active .git/hooks directory
# Run once per clone: .\scripts\install-hooks.ps1
# ============================================================

$RepoRoot = Split-Path -Parent $PSScriptRoot
$HooksSrc = Join-Path $RepoRoot ".githooks"
$HooksDst = Join-Path $RepoRoot ".git\hooks"

Write-Host "Installing git hooks..." -ForegroundColor Cyan

if (-not (Test-Path $HooksSrc)) {
    Write-Host "ERROR: .githooks folder not found at $HooksSrc" -ForegroundColor Red
    exit 1
}

Get-ChildItem -Path $HooksSrc | ForEach-Object {
    $src = $_.FullName
    $dst = Join-Path $HooksDst $_.Name
    Copy-Item -Path $src -Destination $dst -Force
    Write-Host "  Installed: $($_.Name)" -ForegroundColor Green
}

Write-Host ""
Write-Host "All hooks installed successfully!" -ForegroundColor Green
Write-Host "Co-Authored-By (Claude/Anthropic) lines will now be stripped automatically from every commit." -ForegroundColor Yellow
