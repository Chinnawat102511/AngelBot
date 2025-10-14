@echo off
setlocal enabledelayedexpansion
REM --- AngelBot: Auto Action Log + PR creator ---

REM ไปที่โฟลเดอร์ของสคริปต์ (root repo)
cd /d "%~dp0"

REM ตรวจ Git
git --version >nul 2>&1 || (echo [X] Git is not installed/found & exit /b 1)

REM รับข้อความจาก args (ข้อความบันทึก)
set "MSG=%*"
if "%MSG%"=="" set "MSG=log"

REM วันที่/เวลาแบบ ISO (ใช้ PowerShell เพื่อให้ชัวร์ทุก locale)
for /f %%a in ('powershell -NoProfile -Command "(Get-Date).ToString('yyyy-MM-dd')"') do set DATE=%%a
for /f %%a in ('powershell -NoProfile -Command "(Get-Date).ToString('HH:mm')"') do set TIME=%%a

REM ชื่อไฟล์ log + slug ของข้อความ
set "FILE=ACTION_LOG_%DATE%.md"
for /f %%a in ('powershell -NoProfile -Command "$s='%MSG%'; $s=$s -replace '[^a-zA-Z0-9\- ]',''; $s=$s.Trim(); $s=$s -replace '\s+','-'; $s.ToLower()"') do set SLUG=%%a
if "%SLUG%"=="" set SLUG=note

REM สาขาปัจจุบัน (เพื่อเขียนลงหัว log)
for /f %%a in ('git rev-parse --abbrev-ref HEAD') do set CURRBR=%%a

REM เขียน/ต่อท้ายเทมเพลตลงไฟล์ log
set "ENV_FILE=%FILE%"
powershell -NoProfile -Command ^
  "$d=Get-Date; $date=$d.ToString('yyyy-MM-dd'); $time=$d.ToString('HH:mm');" ^
  "$user=(git config user.name); $email=(git config user.email);" ^
  "$branch=(git rev-parse --abbrev-ref HEAD);" ^
  "$last=(git log -1 --pretty='format:%h %s (%an, %cr)') 2>$null;" ^
  "$sep='`n---`n';" ^
  "if(-not (Test-Path $env:ENV_FILE)) {" ^
  "  @('# AngelBot Action Log — License Auto-Refresh System','', '**Date:** '+$date, '**Time:** '+$time, '**Author:** '+$user+' <'+$email+'>', '**Branch at start:** '+$branch, '**Last commit:** '+($last -as [string]), $sep) -join '`n' | Out-File -FilePath $env:ENV_FILE -Encoding utf8 -NoNewline" ^
  "} else { Add-Content -Path $env:ENV_FILE -Value $sep }" ^
  "Add-Content -Path $env:ENV_FILE -Value ('## '+$date+' '+$time+' — ' + '%MSG%');" ^
  "Add-Content -Path $env:ENV_FILE -Value ('- Current branch: ' + $branch);" ^
  "Add-Content -Path $env:ENV_FILE -Value ('- Untracked/modified summary:');" ^
  "Add-Content -Path $env:ENV_FILE -Value ('```');" ^
  "Add-Content -Path $env:ENV_FILE -Value ((git status --short) 2>$null);" ^
  "Add-Content -Path $env:ENV_FILE -Value ('```');"

if errorlevel 1 (echo [X] Failed to build log file & exit /b 1)

REM สร้างชื่อ branch สำหรับ PR (ไม่ดันตรงเข้า main เผื่อมีกฎป้องกัน)
set "BR=chore/log-%DATE%-%SLUG%"

REM สร้าง/สลับ branch แล้ว commit
git checkout -b "%BR%" 2>nul || git checkout "%BR%"
git add "%FILE%"
git commit -m "docs(log): add/update %FILE% (%DATE% %TIME% - %MSG%)" >nul 2>&1 || echo [i] Nothing to commit (log unchanged).

REM push branch ใหม่ขึ้น origin
git push -u origin "%BR%"
if errorlevel 1 (echo [X] Push failed. Please check your access/connection. & exit /b 1)

REM สร้างลิงก์เปิด PR อัตโนมัติ
for /f "usebackq tokens=*" %%u in (`git config --get remote.origin.url`) do set REMURL=%%u
for /f %%o in ('powershell -NoProfile -Command "$u='%REMURL%'; if($u -match '[:/](?<own>[^/]+)/(?<repo>[^/.]+)(?:\.git)?$'){Write-Output ($Matches['own']+'/'+$Matches['repo'])}"') do set OR=%%o
set "TITLE=docs(log): %DATE% %TIME% — %SLUG%"
for /f %%q in ('powershell -NoProfile -Command "[uri]::EscapeDataString('%TITLE%')"') do set QTITLE=%%q
set "PR=https://github.com/%OR%/compare/main...%BR%?expand=1&title=%QTITLE%"

start "" "%PR%"
echo [OK] Created branch %BR% and opened PR:
echo %PR%
exit /b 0
