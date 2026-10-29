$ErrorActionPreference = 'Stop'
$resourceDirectory = [IO.Path]::GetFullPath('C:\Program Files\Razer\RazerAppEngine\app-4.0.896\resources')
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
$known = @($manifest.originalSha256, $manifest.patchedSha256) + @($manifest.previousPatchedSha256)
$targetHash = (Get-FileHash -LiteralPath (Join-Path $resourceDirectory 'app.asar')).Hash
$backupHash = (Get-FileHash -LiteralPath (Join-Path $resourceDirectory 'app.asar.before-system-theme')).Hash
if ($targetHash -notin $known -or $backupHash -ne $manifest.originalSha256) {
    throw 'Current file or original backup verification failed. Nothing was deleted.'
}
$candidates = Get-ChildItem -LiteralPath $resourceDirectory -File | Where-Object {
    $_.Name -like 'app.asar.replaced-*' -or $_.Name -eq 'app.asar.theme-pending'
}
foreach ($candidate in $candidates) {
    $resolved = [IO.Path]::GetFullPath($candidate.FullName)
    if ([IO.Path]::GetDirectoryName($resolved) -ne $resourceDirectory) { throw 'Unexpected cleanup path.' }
    if ($candidate.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
    if ((Get-FileHash -LiteralPath $resolved).Hash -in $known) {
        Remove-Item -LiteralPath $resolved
        Write-Host 'Removed:' $candidate.Name
    } else { Write-Host 'Skipped unknown file:' $candidate.Name }
}
Write-Host 'Finished. Current app.asar and original backup were preserved.'
