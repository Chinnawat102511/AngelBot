@echo off
setlocal enabledelayedexpansion
set BASE=C:\AngelBot\license-server
set PORT=9802
set LOG_DIR=%BASE%\logs
set PID_FILE=%BASE%\server.pid
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
cd /d "%BASE%"
where node >nul 2>&1 || (echo [ERROR] Node.js not found & exit /b 1)
if exist "%PID_FILE%" (set /p OLD=<"%PID_FILE%" & if not "%OLD%"=="" (taskkill /PID %OLD% /F >nul 2>&1 & del "%PID_FILE%" >nul 2>&1))
start "AngelLicenseServer" /min cmd /c "node server.js >> "%LOG_DIR%\server.log" 2>&1"
powershell -NoProfile -Command "Start-Sleep -Seconds 2; $p=(Get-NetTCPConnection -State Listen -LocalPort %PORT% -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess); if($p){Set-Content -Path '%PID_FILE%' -Value $p; Write-Host ('[OK] Listening on %PORT% with PID ' + $p)} else {Write-Host '[ERROR] Port not listening'; exit 1}"
if errorlevel 1 (echo [FAIL] start failed & exit /b 1)
echo [DONE] Server started. Logs: %LOG_DIR%\server.log
exit /b 0