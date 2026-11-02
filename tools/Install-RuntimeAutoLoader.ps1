param([Parameter(Mandatory=$true)][Guid[]]$Receiver)
$ErrorActionPreference='Stop'
$destination=Join-Path $env:LOCALAPPDATA 'RazerPersonalPatches\RuntimeAutoLoader'
if(Test-Path -LiteralPath (Join-Path $destination 'disabled')) { throw 'Loader is disabled. Remove the disabled marker explicitly before enabling.' }
foreach($name in @('RuntimeAutoLoader','KeyboardTextFix','MouseRuntimeFix')) {
    & dotnet build (Join-Path $PSScriptRoot $name) -c Release
    if($LASTEXITCODE -ne 0){throw "Build failed: $name"}
}
$exe=Join-Path $destination 'RuntimeAutoLoader.exe'
# Login runs outside the installer's app container: use the physical path.
if (-not ('RazerLoaderPaths' -as [type])) {
    Add-Type @'
using System;
using System.IO;
using System.Text;
using System.Runtime.InteropServices;
public static class RazerLoaderPaths {
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern uint GetFinalPathNameByHandle(IntPtr h, StringBuilder path, uint size, uint flags);
    public static string Resolve(string path) {
        using(var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete)) {
            var buffer = new StringBuilder(32768);
            uint size = GetFinalPathNameByHandle(file.SafeFileHandle.DangerousGetHandle(), buffer, (uint)buffer.Capacity, 0);
            if(size == 0 || size >= buffer.Capacity) throw new System.ComponentModel.Win32Exception();
            string result = buffer.ToString();
            return result.StartsWith(@"\\?\") ? result.Substring(4) : result;
        }
    }
}
'@
}
if (Test-Path -LiteralPath $exe) {
    $exe=[RazerLoaderPaths]::Resolve($exe)
    $destination=Split-Path -Parent $exe
}
foreach ($loader in @(Get-Process RuntimeAutoLoader -ErrorAction SilentlyContinue)) {
    if ($loader.Path -and [RazerLoaderPaths]::Resolve($loader.Path) -eq $exe) {
        $loader | Stop-Process
        $loader.WaitForExit()
    }
}
foreach($name in @('RuntimeAutoLoader','KeyboardTextFix','MouseRuntimeFix')) {
    $target=if($name -eq 'RuntimeAutoLoader'){$destination}else{Join-Path $destination $name}
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    Copy-Item -Path (Join-Path $PSScriptRoot "$name\bin\Release\net8.0\*") -Destination $target -Force
}
$exe=[RazerLoaderPaths]::Resolve((Join-Path $destination 'RuntimeAutoLoader.exe'))
$destination=Split-Path -Parent $exe
@{receivers=@($Receiver | ForEach-Object {'{'+$_.ToString().ToUpperInvariant()+'}'} | Select-Object -Unique)} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $destination 'config.json') -Encoding Ascii
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
