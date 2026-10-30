param([Parameter(Mandatory=$true)][Guid]$Receiver)
$ErrorActionPreference='Stop'
$destination=Join-Path $env:LOCALAPPDATA 'RazerPersonalPatches\RuntimeAutoLoader'
if(Test-Path -LiteralPath (Join-Path $destination 'disabled')) { throw 'Loader is disabled. Remove the disabled marker explicitly before enabling.' }
foreach($name in @('RuntimeAutoLoader','KeyboardTextFix','MouseRuntimeFix')) {
    & dotnet build (Join-Path $PSScriptRoot $name) -c Release
    if($LASTEXITCODE -ne 0){throw "Build failed: $name"}
}
$exe=Join-Path $destination 'RuntimeAutoLoader.exe'
Get-Process RuntimeAutoLoader -ErrorAction SilentlyContinue | Where-Object {$_.Path -eq $exe} | Stop-Process
foreach($name in @('RuntimeAutoLoader','KeyboardTextFix','MouseRuntimeFix')) {
    $target=if($name -eq 'RuntimeAutoLoader'){$destination}else{Join-Path $destination $name}
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    Copy-Item -Path (Join-Path $PSScriptRoot "$name\bin\Release\net8.0\*") -Destination $target -Force
}
@{receiver='{'+$Receiver.ToString().ToUpperInvariant()+'}'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $destination 'config.json') -Encoding Ascii
$linkPath=Join-Path ([Environment]::GetFolderPath('Startup')) 'Razer Personal Runtime Fixes.lnk'
$shell=New-Object -ComObject WScript.Shell
$link=$shell.CreateShortcut($linkPath)
$link.TargetPath=$exe
$link.WorkingDirectory=$destination
$link.WindowStyle=7
$link.Description='Restore local Razer mouse and keyboard runtime fixes after Synapse starts'
$link.Save()
Start-Process -FilePath $exe -WindowStyle Hidden
Write-Host "Installed user sign-in startup entry. Log: $destination\loader.log"
