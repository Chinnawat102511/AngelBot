@echo off
setlocal enabledelayedexpansion
if "%~3"=="" ( echo Usage: make-license.bat USER LICENSE_KEY DAYS [FEATURES] & exit /b 1 )
set USER=%~1
set KEY=%~2
set DAYS=%~3
set FEATURES=%~4
set BASE=C:\AngelBot\license-server
set OUTDIR=%BASE%\licenses
if not exist "%OUTDIR%" mkdir "%OUTDIR%"
set OUTFILE=%OUTDIR%\%KEY%.json
powershell -NoProfile -Command "$ErrorActionPreference='Stop'; $u='%USER%'; $k='%KEY%'; $d=[int]'%DAYS%'; $now=Get-Date; $exp=$now.AddDays($d); $features=if([string]::IsNullOrWhiteSpace('%FEATURES%')){ @() } else { '%FEATURES%'.Split(',') | ForEach-Object { $_.Trim() } }; $obj=[ordered]@{ licenseKey=$k; user=$u; issuedAt=$now.ToString('yyyy-MM-ddTHH:mm:ssK'); expireAt=$exp.ToString('yyyy-MM-ddTHH:mm:ssK'); features=$features; status='active'}; $json=($obj | ConvertTo-Json -Depth 5); [IO.File]::WriteAllText('%OUTFILE%', $json, [System.Text.Encoding]::UTF8); Write-Host ('[OK] Wrote ' + '%OUTFILE%');"
if errorlevel 1 ( echo [ERROR] Failed to create license JSON & exit /b 1 )
type "%OUTFILE%"
echo.
echo [DONE]
exit /b 0