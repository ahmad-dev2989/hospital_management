param(
    [string]$Action = "status"
)

$ErrorActionPreference = "Stop"

$pgBin = "$env:LOCALAPPDATA\PostgreSQL\pgsql\bin"
$pgData = "$env:LOCALAPPDATA\HospitalApp\pgdata"
$pgLog = "$env:LOCALAPPDATA\HospitalApp\postgres.log"

if (-not (Test-Path "$pgBin\postgres.exe")) {
    Write-Error "PostgreSQL binaries not found at $pgBin"
    exit 1
}

# Ensure parent folder exists
$parentDir = Split-Path $pgData
if (-not (Test-Path $parentDir)) {
    New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
}

switch ($Action) {
    "start" {
        $statusOutput = & "$pgBin\pg_ctl.exe" -D $pgData status 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Output "Starting PostgreSQL service on 127.0.0.1:5432..."
            & "$pgBin\pg_ctl.exe" -D $pgData -l $pgLog -o "-p 5432 -h 127.0.0.1" start
            Start-Sleep -Seconds 2
        } else {
            Write-Output "PostgreSQL is already running."
        }
    }
    "stop" {
        & "$pgBin\pg_ctl.exe" -D $pgData stop
        Write-Output "PostgreSQL stopped."
    }
    "status" {
        & "$pgBin\pg_ctl.exe" -D $pgData status
    }
}
