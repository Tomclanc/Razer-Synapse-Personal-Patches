@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Cleanup-History.ps1"
if errorlevel 1 echo Cleanup failed. Try running as administrator.
pause
