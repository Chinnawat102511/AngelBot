@echo off
setlocal
title AngelBot - Generate License
cd /d "%~dp0"

REM Usage examples:
REM   gen_license.bat                  (ใช้ค่าเริ่มต้น)
REM   gen_license.bat --owner "AngelTeam" --days 30 --plan pro
REM   gen_license.bat --owner Trader007 --days 60 --plan pro

if "%~1"=="" (
  set "OWNER=AngelTeam"
  set "PLAN=pro"
  set "DAYS=30"
  echo [i] No args detected -> using defaults
  echo     --owner="%OWNER%" --plan=%PLAN% --days=%DAYS%
  set "ARGS=--owner=%OWNER% --plan=%PLAN% --days=%DAYS%"
) else (
  set "ARGS=%*"
)

echo [*] node scripts/generate-license.js %ARGS%
node scripts/generate-license.js %ARGS%
if errorlevel 1 (
  echo [X] License generate failed.
  exit /b 1
)

echo [OK] License generated.
exit /b 0
