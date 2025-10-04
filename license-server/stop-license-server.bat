@echo off
setlocal
set BASE=C:\AngelBot\license-server
set PORT=9802
set PID_FILE=%BASE%\server.pid
echo [STOP] Stopping license server...
if exist "%PID_FILE%" ( set /p PID=<"%PID_FILE%" & if not "%PID%"=="" ( taskkill /PID %PID% /F >nul 2>&1 & del "%PID_FILE%" >nul 2>&1 ) )
for /f "tokens=5" %%p in ('netstat -ano ^| find ":%PORT% " ^| find "LISTENING"') do ( taskkill /PID %%p /F >nul 2>&1 )
echo [DONE] Stopped.
exit /b 0