@echo off
setlocal enabledelayedexpansion
title AngelBot - License Server (Start)
cd /d "%~dp0"

REM ====== CONFIG ======
set "HEALTH_URL=http://localhost:3001/api/forecast/ping"
set "RETRY=25"
set "SLEEP=1"
REM =====================

echo [AngelBot] Checking health: %HEALTH_URL%
call :HTTP_OK
if %errorlevel%==0 (
  echo [OK] Server already ONLINE at %HEALTH_URL%
  exit /b 0
)

echo [*] Starting server via npm...
REM ใช้ /k เพื่อเปิดหน้าต่างแยกไว้ดู log ได้
start "AngelBot License Server" cmd /k "npm run server"

set /a tries=0
:WAIT_UP
set /a tries+=1
>nul ping -n %SLEEP% 127.0.0.1

call :HTTP_OK
if %errorlevel%==0 (
  echo [OK] Server ONLINE at %HEALTH_URL%
  exit /b 0
)

if !tries! lss %RETRY% (
  echo [..] waiting (%tries%/%RETRY%) ...
  goto :WAIT_UP
)

echo [X] Server did not respond on: %HEALTH_URL%
exit /b 1

:HTTP_OK
for /f %%C in ('curl -s -o nul -m 2 -w "%%{http_code}" "%HEALTH_URL%" 2^>nul') do set CODE=%%C
if "!CODE!"=="200" (exit /b 0) else (exit /b 1)
