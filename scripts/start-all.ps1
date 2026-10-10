# Mercy Community Hospital — Master Local Startup Script
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Mercy Community Hospital — Offline Desktop HMS" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir

# 1. Start PostgreSQL if not already active
Write-Host "`n[1/3] Checking PostgreSQL service..." -ForegroundColor Yellow
& "$scriptDir\manage-db.ps1" -Action start

# 2. Start Backend API in a separate background window
Write-Host "`n[2/3] Launching ASP.NET Core API on http://127.0.0.1:5000..." -ForegroundColor Yellow
$dotnetPath = "$env:LOCALAPPDATA\Microsoft\dotnet\dotnet.exe"
if (-not (Test-Path $dotnetPath)) { $dotnetPath = "dotnet" }
Start-Process -FilePath $dotnetPath -ArgumentList "run --project `"$rootDir\src\backend\HospitalApp.Api`"" -WorkingDirectory "$rootDir\src\backend\HospitalApp.Api"

# 3. Start Frontend Dev Server
Write-Host "`n[3/3] Launching Frontend UI on http://localhost:5173..." -ForegroundColor Yellow
Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory "$rootDir\src\frontend"

Write-Host "`nAll services have been started!" -ForegroundColor Green
Write-Host " - Frontend Workstation: http://localhost:5173" -ForegroundColor Cyan
Write-Host " - Backend Swagger API:  http://127.0.0.1:5000/swagger" -ForegroundColor Cyan
Write-Host " - Database Port:        127.0.0.1:5432 (hospital_db)" -ForegroundColor Cyan
Write-Host "`nDefault Admin Account:  admin / Admin@123" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan

# Open default browser
Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"
