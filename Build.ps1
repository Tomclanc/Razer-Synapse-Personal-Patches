$ErrorActionPreference = 'Stop'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) { throw 'Node.js 18+ is required. Install Node.js and reopen this script.' }
$resourceDirectory = 'C:\Program Files\Razer\RazerAppEngine\app-4.0.827\resources'
$backup = Join-Path $resourceDirectory 'app.asar.before-system-theme'
$inputArchive = Join-Path $resourceDirectory 'app.asar'
if (Test-Path -LiteralPath $backup) { $inputArchive = $backup }
& $nodeCommand.Source (Join-Path $PSScriptRoot 'src\build-patch.cjs') $inputArchive
if ($LASTEXITCODE -ne 0) { throw 'Build failed. No installation was performed.' }
Write-Host 'Build complete. Run dist\INSTALL.cmd as administrator.'
