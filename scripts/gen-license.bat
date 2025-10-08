@echo off
setlocal
echo 🪶 Generating license file...
node scripts/generate-license.js %*
pause
