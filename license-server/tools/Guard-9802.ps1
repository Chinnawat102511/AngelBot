param(
  [int]$Port = 9802,
  [string]$Service = "AngelLicenseServer",
  [int]$Loops = 6,          # 6 รอบ
  [int]$GapSeconds = 10     # ห่างกัน 10 วินาที
)
$log = "C:\AngelBot\license-server\logs\guard.log"
$logDir = Split-Path $log
if(-not (Test-Path $logDir)){ New-Item -ItemType Directory -Path $logDir | Out-Null }
function Invoke-GuardOneShot {
  param([int]$Port,[string]$Service)
  $svc = Get-CimInstance Win32_Service -Filter "Name='$Service'" -ErrorAction SilentlyContinue
  if(-not $svc){ return }
  $own = (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue).OwningProcess
  if(-not $own){ return }
  $par = (Get-CimInstance Win32_Process -Filter "ProcessId=$own" -ErrorAction SilentlyContinue).ParentProcessId
  if($svc.ProcessId -ne $own -and $svc.ProcessId -ne $par){
    try{
      Stop-Process -Id $own -Force -ErrorAction Stop
      "[{0:s}] killed {1} node on {2}" -f (Get-Date), $own, $Port | Out-File $log -Append -Encoding utf8
    } catch {}
  }
}
for($i=1; $i -le $Loops; $i++){
  Invoke-GuardOneShot -Port $Port -Service $Service
  Start-Sleep -Seconds $GapSeconds
}
# เขียนสถานะท้ายรอบ
$svc = Get-CimInstance Win32_Service -Filter "Name='$Service'" -ErrorAction SilentlyContinue
$owned = $false
if($svc){
  $own = (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue).OwningProcess
  $par = (Get-CimInstance Win32_Process -Filter "ProcessId=$own" -ErrorAction SilentlyContinue).ParentProcessId
  $owned = ($svc.ProcessId -eq $own -or $svc.ProcessId -eq $par)
}
"[{0:s}] OwnedByService= Health={1}" -f (Get-Date), ($(if($owned){"ok"}else{"bad"})) | Out-File $log -Append -Encoding utf8
