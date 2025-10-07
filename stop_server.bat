@echo off
setlocal enabledelayedexpansion
title AngelBot - Stop License Server
cd /d "%~dp0"

REM ====== CONFIG ======
set "HEALTH_URL=http://localhost:3001/api/forecast/ping"
set "RETRY=15"
set "SLEEP=1"
REM =====================

echo [*] Stopping server via npm...
npm run license:stop

set /a tries=0
:WAIT_DOWN
set /a tries+=1
>nul ping -n %SLEEP% 127.0.0.1

call :HTTP_OK
if not "%errorlevel%"=="0" (
  echo [OK] Server OFFLINE.
  exit /b 0
)

if !tries! lss %RETRY% (
  echo [..] waiting shutdown (%tries%/%RETRY%) ...
  goto :WAIT_DOWN
)

echo [!] Server still responds on: %HEALTH_URL%  Please verify.
exit /b 1

:HTTP_OK
for /f %%C in ('curl -s -o nul -m 2 -w "%%{http_code}" "%HEALTH_URL%" 2^>nul') do set CODE=%%C
if "!CODE!"=="200" (exit /b 0) else (exit /b 1)
