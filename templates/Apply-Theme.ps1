param([switch]$Restore,[string]$LogPath)
$ErrorActionPreference = 'Stop'
if ($LogPath) { Start-Transcript -Path $LogPath -Force | Out-Null }
$installRoot = 'C:\Program Files\Razer\RazerAppEngine\app-4.0.896'
$target = Join-Path $installRoot 'resources\app.asar'
$backup = Join-Path $installRoot 'resources\app.asar.before-system-theme'
$pending = Join-Path $installRoot 'resources\app.asar.theme-pending'
$exe = Join-Path $installRoot 'RazerAppEngine.exe'
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Administrator access required. Right-click INSTALL.cmd or RESTORE.cmd and select Run as administrator.'
}
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
function Assert-Hash([string]$Path, [string]$Expected) {
    if ((Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash -ne $Expected) {
        throw "File verification failed: $Path. No replacement was performed."
    }
}
$currentHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
$knownPatches = @($manifest.patchedSha256) + @($manifest.previousPatchedSha256)
if ($Restore) {
    if ($currentHash -eq $manifest.originalSha256) { Write-Host 'Original version is already installed.'; exit 0 }
    if ($currentHash -notin $knownPatches) { throw 'Unknown installed file. Restore cancelled.' }
    Assert-Hash $backup $manifest.originalSha256
    $source = $backup
    $expected = $manifest.originalSha256
} else {
    if ($currentHash -eq $manifest.patchedSha256) { Write-Host 'Theme patch is already installed.'; exit 0 }
    if ($currentHash -ne $manifest.originalSha256 -and $currentHash -notin $knownPatches) {
        throw 'Unknown installed file. Installation cancelled.'
    }
    $source = Join-Path $PSScriptRoot 'app.asar'
    $expected = $manifest.patchedSha256
    Assert-Hash $source $expected
    if (Test-Path -LiteralPath $backup) { Assert-Hash $backup $manifest.originalSha256 }
    elseif ($currentHash -eq $manifest.originalSha256) { Copy-Item -LiteralPath $target -Destination $backup; Assert-Hash $backup $manifest.originalSha256 }
    else { throw 'Original backup is missing. Upgrade cancelled to preserve recovery.' }
}
Write-Host 'Verified. Closing only RazerAppEngine for this installed version...'
$engineProcesses = @(Get-Process -Name RazerAppEngine -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe })
foreach ($engineProcess in $engineProcesses) { [void]$engineProcess.CloseMainWindow() }
Start-Sleep -Seconds 2
Get-Process -Name RazerAppEngine -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe } | Stop-Process -Force
Start-Sleep -Seconds 1
try {
    Copy-Item -LiteralPath $source -Destination $pending -Force
    Assert-Hash $pending $expected
    # Windows PowerShell can coerce $null to an empty string for this overload.
    # Supply a real, unique backup path instead; retain both backups for recovery.
    $replacementBackup = Join-Path $installRoot ('resources\app.asar.replaced-' + [guid]::NewGuid().ToString('N'))
    [System.IO.File]::Replace($pending, $target, $replacementBackup)
    Assert-Hash $target $expected
} catch {
    Write-Host 'Installation did not complete. Original backup remains at:' $backup
    throw
}
Write-Host 'Done. Open Razer Synapse normally from the Start menu.'
Write-Host 'If the app does not start or a page looks wrong, run RESTORE.cmd as administrator.'
