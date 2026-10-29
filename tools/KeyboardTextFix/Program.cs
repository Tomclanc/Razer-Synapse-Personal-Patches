// See https://aka.ms/new-console-template for more information
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Security.Cryptography;
class Program {
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool ReadProcessMemory(IntPtr p,IntPtr a,byte[] b,nuint n,out nuint read);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool WriteProcessMemory(IntPtr p,IntPtr a,byte[] b,nuint n,out nuint written);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool VirtualProtectEx(IntPtr p,IntPtr a,nuint n,uint protection,out uint old);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool FlushInstructionCache(IntPtr p,IntPtr a,nuint n);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr p);
 static void Check(bool ok,string op){if(!ok)throw new Exception(op+": "+Marshal.GetLastWin32Error());}
 static int Main(string[] args){
  try { Run(args); return 0; } catch(Exception e){Console.Error.WriteLine("FAILED: "+e.Message);return 1;}
 }
 static void Run(string[] args){
  if(!OperatingSystem.IsWindows()||RuntimeInformation.ProcessArchitecture!=Architecture.X64)throw new Exception("Only Windows x64 is supported");
  bool automatic=args.Length==0||args[0]=="--restore";
  bool undo=automatic?args.Contains("--restore"):args.Length>2&&args[2]=="restore";
  string spec=automatic?Path.Combine(AppContext.BaseDirectory,"patch.json"):args[0];
  using var doc=JsonDocument.Parse(File.ReadAllText(spec));var s=doc.RootElement;
  int pid;
  if(automatic){
   pid=FindTarget();
   if(pid==0&&!undo){
    string launcher=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Razer","RazerAppEngine","RazerAppEngine.exe");
    if(!File.Exists(launcher))throw new Exception("RazerAppEngine launcher not found");
    Process.Start(new ProcessStartInfo(launcher,"--url-params=apps=synapse"){UseShellExecute=false,CreateNoWindow=true});
    Console.WriteLine("Waiting for Razer mapping engine...");
    for(int i=0;i<60&&pid==0;i++){Thread.Sleep(1000);pid=FindTarget();}
   }
   if(pid==0)throw new Exception("No running Razer mapping engine found");
  }else pid=int.Parse(args[1]);
  using var process=Process.GetProcessById(pid);
  var module=process.Modules.Cast<ProcessModule>().Single(m=>m.ModuleName==s.GetProperty("module").GetString());
  var hash=Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(module.FileName)));
  if(!hash.Equals(s.GetProperty("sha256").GetString(),StringComparison.OrdinalIgnoreCase))throw new Exception("DLL hash mismatch; refusing patch");
  var expected=Convert.FromHexString(s.GetProperty(undo?"patched":"original").GetString()!);
  var replacement=Convert.FromHexString(s.GetProperty(undo?"original":"patched").GetString()!);
  var address=module.BaseAddress+s.GetProperty("rva").GetInt32();
  var handle=OpenProcess(0x438,false,pid);Check(handle!=IntPtr.Zero,"OpenProcess");
  try{
   byte[] current=new byte[expected.Length];Check(ReadProcessMemory(handle,address,current,(nuint)current.Length,out var read)&&read==(nuint)current.Length,"ReadProcessMemory");
   if(current.SequenceEqual(replacement)){Console.WriteLine("Already in requested state");return;}
   if(!current.SequenceEqual(expected))throw new Exception("Memory bytes mismatch; refusing patch");
   Check(VirtualProtectEx(handle,address,(nuint)replacement.Length,0x40,out var old),"VirtualProtectEx");
   try {Check(WriteProcessMemory(handle,address,replacement,(nuint)replacement.Length,out var written)&&written==(nuint)replacement.Length,"WriteProcessMemory");Check(FlushInstructionCache(handle,address,(nuint)replacement.Length),"FlushInstructionCache");}
   finally {Check(VirtualProtectEx(handle,address,(nuint)replacement.Length,old,out _),"Restore protection");}
   Check(ReadProcessMemory(handle,address,current,(nuint)current.Length,out read)&&read==(nuint)current.Length&&current.SequenceEqual(replacement),"Verify memory");
   Console.WriteLine($"{(undo?"RESTORED":"APPLIED")} pid={pid} module={module.ModuleName} address=0x{address.ToInt64():X} bytes={replacement.Length}; installed file unchanged.");
   Console.WriteLine("Memory-only patch. Restarting Synapse restores the original code. No key bindings are changed.");
  }finally{CloseHandle(handle);}
 }
 static int FindTarget(){
  foreach(var p in Process.GetProcessesByName("RazerAppEngine")){
   using(p)try{if(p.Modules.Cast<ProcessModule>().Any(m=>m.ModuleName=="mapping_engine.dll"))return p.Id;}catch(System.ComponentModel.Win32Exception){}catch(InvalidOperationException){}
  }
  return 0;
 }
}
