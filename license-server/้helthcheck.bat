@echo off
setlocal
set "PORT=3001"

echo [*] Checking port %PORT% ...
netstat -ano | findstr LISTENING | findstr :%PORT% >nul && (echo [+] Port %PORT% is listening) || (echo [!] Port %PORT% not listening)

echo [*] Old endpoints ...
powershell -NoProfile -Command ^
"try{ (Invoke-WebRequest -UseBasicParsing http://localhost:%PORT%/api/ping).StatusCode }catch{'[x] /api/ping FAIL'}; ^
 try{ (Invoke-WebRequest -UseBasicParsing -Method POST -Uri http://localhost:%PORT%/license/verify -Body @{} -ContentType 'application/x-www-form-urlencoded').StatusCode }catch{'[x] /license/verify FAIL'}"

echo [*] New endpoints (compat layer) ...
powershell -NoProfile -Command ^
"try{ (Invoke-WebRequest -UseBasicParsing http://localhost:%PORT%/status).StatusCode }catch{'[x] /status FAIL'}; ^
 try{ (Invoke-WebRequest -UseBasicParsing -Method POST -Uri http://localhost:%PORT%/license/check -Body @{} -ContentType 'application/json').StatusCode }catch{'[x] /license/check FAIL'}; ^
 try{ (Invoke-WebRequest -UseBasicParsing -Method POST -Uri http://localhost:%PORT%/connect -Body (@{email='x';password='y';account_type='demo'} | ConvertTo-Json) -ContentType 'application/json').StatusCode }catch{'[x] /connect FAIL'}; ^
 try{ (Invoke-WebRequest -UseBasicParsing -Method POST -Uri http://localhost:%PORT%/bot/start -Body (@{} | ConvertTo-Json) -ContentType 'application/json').StatusCode }catch{'[x] /bot/start FAIL'}; ^
 try{ (Invoke-WebRequest -UseBasicParsing -Method POST -Uri http://localhost:%PORT%/bot/stop -Body (@{} | ConvertTo-Json) -ContentType 'application/json').StatusCode }catch{'[x] /bot/stop FAIL'}"

echo [+] Healthcheck done.
endlocal
