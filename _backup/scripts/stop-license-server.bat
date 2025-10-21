@echo off
setlocal
echo [🛑] Stopping AngelBot license server...

REM Kill node process listening on port 4000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4000') do taskkill /PID %%a /F >nul 2>&1

echo [✔] AngelBot license server stopped successfully.
endlocal
