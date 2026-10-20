@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Apply-Theme.ps1"
if errorlevel 1 echo Installation failed. Read the message above.
pause
