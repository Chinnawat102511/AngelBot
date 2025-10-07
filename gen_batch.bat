@echo off
setlocal enabledelayedexpansion

set CSV=licenses.csv
if not exist "%CSV%" (
  echo [AngelBot] "%CSV%" not found.
  exit /b 1
)

echo [AngelBot] Batch generating from %CSV% ...
for /f "usebackq tokens=1,2,3 delims=," %%A in ("%CSV%") do (
  set OWNER=%%~A
  set DAYS=%%~B
  set PLAN=%%~C
  echo.
  echo [AngelBot] -> %%~A %%~B %%~C
  call gen_license.bat "%%~A" "%%~B" "%%~C"
)

echo.
echo [AngelBot] Batch done.
