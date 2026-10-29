// See https://aka.ms/new-console-template for more information
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
class Program {
 [DllImport("kernel32.dll",SetLastError=true)]static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
 [DllImport("kernel32.dll",SetLastError=true)]static extern IntPtr VirtualAllocEx(IntPtr p,IntPtr a,nuint size,uint allocation,uint protect);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool WriteProcessMemory(IntPtr p,IntPtr a,byte[] data,nuint n,out nuint written);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool ReadProcessMemory(IntPtr p,IntPtr a,byte[] data,nuint n,out nuint read);
 [DllImport("kernel32.dll",SetLastError=true)]static extern IntPtr CreateRemoteThread(IntPtr p,IntPtr attrs,nuint stack,IntPtr entry,IntPtr param,uint flags,out uint tid);
 [DllImport("kernel32.dll")]static extern uint WaitForSingleObject(IntPtr h,uint ms);
 [DllImport("kernel32.dll")]static extern bool VirtualFreeEx(IntPtr p,IntPtr a,nuint n,uint type);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr h);
 static void Check(bool ok,string op){if(!ok)throw new Exception(op+": "+Marshal.GetLastWin32Error());}
 static int Main(string[] args){try{Run(args);return 0;}catch(Exception e){Console.Error.WriteLine("FAILED: "+e.Message);return 1;}}
 static void Run(string[] args){
  if(!OperatingSystem.IsWindows()||RuntimeInformation.ProcessArchitecture!=Architecture.X64)throw new Exception("Only Windows x64 is supported");
  bool validate=args.Length==2&&args[0]=="--validate";
  bool automatic=args.Length==0||args.Length==2&&args[0]=="--snapshot";
  if(!automatic&&!validate&&args.Length!=2)throw new Exception("Usage: MouseRuntimeFix [--snapshot FILE | --validate FILE | PID FILE]");
  string payloadPath=args.Length==0?Path.Combine(AppContext.BaseDirectory,"mouse-runtime-snapshot.json"):args[1];
  using var doc=JsonDocument.Parse(File.ReadAllText(payloadPath));var payload=doc.RootElement;string key=payload.GetProperty("key").GetString()!;
  const string prefix="synapse_179_";
  if(!key.StartsWith(prefix,StringComparison.Ordinal)||!Guid.TryParse(key[prefix.Length..],out _))throw new Exception("Expected a HyperPolling receiver key and container GUID");
  string receiver=key[prefix.Length..];
  using var data=JsonDocument.Parse(payload.GetProperty("value").GetString()!);
  if(data.RootElement.GetProperty("vendorId").GetInt32()!=5426||data.RootElement.GetProperty("productId").GetInt32()!=179)throw new Exception("Snapshot does not match this receiver family");
  string active=data.RootElement.GetProperty("activeProfile").GetString()!;
  var profiles=data.RootElement.GetProperty("profiles").EnumerateArray().Where(p=>p.GetProperty("guid").GetString()==active).ToArray();
  if(profiles.Length!=1||!profiles[0].TryGetProperty("appEngine",out var engine)||!engine.TryGetProperty("mappings",out var mappings)||mappings.GetArrayLength()==0)throw new Exception("Snapshot has no active runtime mappings");
  byte[] k=Encoding.UTF8.GetBytes(key+"\0"),v=Encoding.UTF8.GetBytes(payload.GetProperty("value").GetString()+"\0");
  if(512+v.Length>16384)throw new Exception("Payload too large");
  if(validate){Console.WriteLine("Snapshot structure validated; no process was opened or modified.");return;}
  int pid=automatic?FindTarget():int.Parse(args[0]);
  if(pid==0)throw new Exception("Start Synapse first, then run this tool");
  using var process=Process.GetProcessById(pid);
  if(automatic){
   string log=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Razer","RazerAppEngine","User Data","Logs","mapping_engine.log");
   bool ready=false;
   Console.WriteLine("Waiting for the Basilisk receiver in the current engine session...");
   for(int attempt=0;attempt<60;attempt++){
    try{using var stream=new FileStream(log,FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete);using var reader=new StreamReader(stream);string text=reader.ReadToEnd();int init=text.LastIndexOf("MappingEngine::Initialize:",StringComparison.Ordinal);if(init>=0){string recent=text[init..];ready=recent.Split('\n').Any(line=>line.Contains("MappingEngineUsbDevice::MappingEngineUsbDevice:")&&line.Contains(receiver,StringComparison.OrdinalIgnoreCase));}}catch(IOException){}
    if(ready)break;Thread.Sleep(1000);
   }
   if(!ready)throw new Exception("The expected Basilisk receiver was not initialized. Nothing applied.");
  }
  var module=process.Modules.Cast<ProcessModule>().Single(m=>m.ModuleName=="mapping_engine.dll");
  if(Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(module.FileName)))!="C64E539437B50DA2B1F2E4155D8CBB0FB1C3E1EBAAD894CAF509BAD97E9857F9")throw new Exception("Unexpected DLL version");
  IntPtr handle=OpenProcess(0x43A,false,process.Id);Check(handle!=IntPtr.Zero,"OpenProcess");
  IntPtr memory=VirtualAllocEx(handle,IntPtr.Zero,16384,0x3000,0x40);Check(memory!=IntPtr.Zero,"VirtualAllocEx");
  bool completed=false;
  try{
   long start=memory.ToInt64();var code=new List<byte>();void Bytes(params byte[] b)=>code.AddRange(b);void Imm(long x)=>code.AddRange(BitConverter.GetBytes(x));
   Bytes(0x48,0x83,0xEC,0x28,0x48,0xB9);Imm(start+256);Bytes(0x48,0xBA);Imm(start+512);Bytes(0x49,0xB8);Imm(start+128);Bytes(0x48,0xB8);Imm(module.BaseAddress.ToInt64()+0x20920);Bytes(0xFF,0xD0,0x48,0x83,0xC4,0x28,0x31,0xC0,0xC3);
   byte[] buffer=new byte[16384];code.ToArray().CopyTo(buffer,0);var cb=new List<byte>{0x48,0xB8};cb.AddRange(BitConverter.GetBytes(start+224));cb.AddRange(new byte[]{0x88,0x08,0xC3});cb.ToArray().CopyTo(buffer,128);buffer[224]=0xFF;k.CopyTo(buffer,256);if(512+v.Length>buffer.Length)throw new Exception("Payload too large");v.CopyTo(buffer,512);
   Check(WriteProcessMemory(handle,memory,buffer,(nuint)buffer.Length,out var written)&&written==(nuint)buffer.Length,"WriteProcessMemory");
   IntPtr thread=CreateRemoteThread(handle,IntPtr.Zero,0,memory,IntPtr.Zero,0,out _);Check(thread!=IntPtr.Zero,"CreateRemoteThread");
   try{Check(WaitForSingleObject(thread,15000)==0,"WaitForThread");}finally{CloseHandle(thread);}
   byte[] result={0xFF};for(int i=0;i<100;i++){Check(ReadProcessMemory(handle,memory+224,result,1,out _),"Read callback");if(result[0]!=0xFF)break;Thread.Sleep(100);}
   if(result[0]==0xFF)throw new Exception("Callback timeout; scratch memory retained until app exit");
   Thread.Sleep(250);completed=true;if(result[0]==0)throw new Exception("Mapping engine rejected original runtime data");
   Console.WriteLine("Original runtime mapping loaded through native API. Saved mouse bindings were not edited.");
  }finally{if(completed)VirtualFreeEx(handle,memory,0,0x8000);CloseHandle(handle);}
 }
 static int FindTarget(){foreach(var p in Process.GetProcessesByName("RazerAppEngine")){using(p)try{if(p.Modules.Cast<ProcessModule>().Any(m=>m.ModuleName=="mapping_engine.dll"))return p.Id;}catch(System.ComponentModel.Win32Exception){}catch(InvalidOperationException){}}return 0;}
}
