@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Build.ps1"
if errorlevel 1 echo Build failed. Read the message above.
pause
