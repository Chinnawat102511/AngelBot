@echo off
setlocal
set BASE=C:\AngelBot\license-server
set PORT=9802
set LOG_DIR=%BASE%\logs
set PID_FILE=%BASE%\server.pid
echo === License Server Status ===
echo Port  : %PORT%
powershell -NoProfile -Command "$c=Get-NetTCPConnection -State Listen -LocalPort %PORT% -ErrorAction SilentlyContinue | Select-Object -First 1; if($c){$p=$c.OwningProcess; $n=(Get-Process -Id $p -ErrorAction SilentlyContinue).ProcessName; Write-Host ('State : LISTENING  PID=' + $p + '  Name=' + $n)} else {Write-Host 'State : NOT LISTENING'}"
if exist "%PID_FILE%" ( set /p PID=<"%PID_FILE%" & echo PID file: %PID% ) else ( echo PID file: none )
echo.
echo --- Tail server.log (last 15) ---
if exist "%LOG_DIR%\server.log" ( powershell -NoProfile -Command "Get-Content -Path '%LOG_DIR%\server.log' -Tail 15" ) else ( echo no server.log yet )
echo.
echo --- Tail guard.log (last 15) ---
if exist "%LOG_DIR%\guard.log" ( powershell -NoProfile -Command "Get-Content -Path '%LOG_DIR%\guard.log' -Tail 15" ) else ( echo no guard.log yet )