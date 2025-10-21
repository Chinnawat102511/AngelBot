@echo off
setlocal

REM ========== CONFIG ==========
set BASE=http://localhost:3001
set OWNER=AngelTeam
set PLAN=pro
set DAYS=30
REM ============================

echo.
echo [Admin] Generating & uploading license...
node scripts/issue-and-upload.js --base=%BASE% --owner=%OWNER% --plan=%PLAN% --days=%DAYS%
echo.
pause
