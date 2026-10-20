@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Apply-Theme.ps1" -Restore
if errorlevel 1 echo Restore failed. Read the message above.
pause
