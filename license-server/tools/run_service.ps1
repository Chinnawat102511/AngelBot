$ErrorActionPreference = 'Stop'
$env:PORT = '9082'
Set-Location "C:\AngelBot\license-server"
$startParams = @{
  FilePath               = "C:\nvm4w\nodejs\node.exe"
  ArgumentList           = 'server.js'
  WorkingDirectory       = "C:\AngelBot\license-server"
  RedirectStandardOutput = (Join-Path "C:\AngelBot\license-server\logs" 'out.log')
  RedirectStandardError  = (Join-Path "C:\AngelBot\license-server\logs" 'err.log')
  NoNewWindow            = $true
  PassThru               = $true
}
$p = Start-Process @startParams
Wait-Process -Id $p.Id
