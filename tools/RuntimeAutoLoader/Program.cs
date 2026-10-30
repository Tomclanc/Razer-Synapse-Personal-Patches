using System.Diagnostics;
using System.Text.Json;

class Program {
 static readonly string Root=AppContext.BaseDirectory;
 static readonly string Logs=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Razer","RazerAppEngine","User Data","Logs");
 static readonly string LogFile=Path.Combine(Root,"loader.log");
 static void Log(string text){
  if(File.Exists(LogFile)&&new FileInfo(LogFile).Length>1024*1024)File.Move(LogFile,LogFile+".previous",true);
  File.AppendAllText(LogFile,$"{DateTimeOffset.Now:O} {text}\n");
 }
 static string ReadShared(string file){using var stream=new FileStream(file,FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete);using var reader=new StreamReader(stream);return reader.ReadToEnd();}
 static string ExportLatest(string receiver){
  string key="synapse_179_"+receiver,latest="",payload="";
  foreach(var file in Directory.EnumerateFiles(Logs,"products_179_mw "+receiver+"*.log"))
   foreach(var line in ReadShared(file).Split('\n')){
    int at=line.IndexOf("args: {\"action\":\"localStorageSetItem\"",StringComparison.Ordinal);if(at<0)continue;
    int end=line.LastIndexOf(" , r:",StringComparison.Ordinal);
    try{
     using var doc=JsonDocument.Parse(line.Substring(at+6,end>at?end-at-6:line.Length-at-6));
     var p=doc.RootElement.GetProperty("payload");
     if(!string.Equals(p.GetProperty("key").GetString(),key,StringComparison.OrdinalIgnoreCase))continue;
     string time=line[..26];if(string.CompareOrdinal(time,latest)<0)continue;
     latest=time;payload=p.GetRawText();
    }catch(JsonException){}catch(KeyNotFoundException){}
   }
  if(payload.Length==0)throw new Exception("No local receiver mapping found; mouse recovery skipped.");
  using(var p=JsonDocument.Parse(payload))using(var data=JsonDocument.Parse(p.RootElement.GetProperty("value").GetString()!)){
   var d=data.RootElement;string active=d.GetProperty("activeProfile").GetString()!;
   var profile=d.GetProperty("profiles").EnumerateArray().Single(p=>p.GetProperty("guid").GetString()==active);
   if(d.GetProperty("vendorId").GetInt32()!=5426||d.GetProperty("productId").GetInt32()!=179||profile.GetProperty("appEngine").GetProperty("mappings").GetArrayLength()==0)
    throw new Exception("Latest receiver mapping is empty or incompatible; not replaying older data.");
  }
  var snapshot=Path.Combine(Root,"mouse-runtime-snapshot.json");File.WriteAllText(snapshot,payload);
  Log("Selected latest local mapping "+latest);return snapshot;
 }
 static async Task<bool> Run(string folder,params string[] args){
  var info=new ProcessStartInfo(Path.Combine(Root,folder,folder+".exe")){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true,WorkingDirectory=Root};
  foreach(var arg in args)info.ArgumentList.Add(arg);
  using var child=Process.Start(info)??throw new Exception("Unable to start "+folder);
  var stdout=child.StandardOutput.ReadToEndAsync();var stderr=child.StandardError.ReadToEndAsync();
  using var timeout=new CancellationTokenSource(TimeSpan.FromSeconds(45));
  try{await child.WaitForExitAsync(timeout.Token);}catch(OperationCanceledException){child.Kill();throw new Exception(folder+" timed out; no automatic retry in this session.");}
  Log(folder+" exit="+child.ExitCode+" "+(await stdout).Trim()+" "+(await stderr).Trim());
  return child.ExitCode==0;
 }
 static async Task Main(){
  using var mutex=new Mutex(true,"Local\\RazerPersonalRuntimeAutoLoader",out bool first);if(!first)return;
  var handled=new HashSet<string>();
  try{
   using var config=JsonDocument.Parse(File.ReadAllText(Path.Combine(Root,"config.json")));
   string receiver=config.RootElement.GetProperty("receiver").GetString()!;
   if(!Guid.TryParse(receiver,out var id))throw new Exception("Invalid receiver GUID");
   receiver="{"+id.ToString().ToUpperInvariant()+"}";Log("Loader started.");
   while(!File.Exists(Path.Combine(Root,"disabled"))){
    foreach(var process in Process.GetProcessesByName("RazerAppEngine"))using(process){
     try{
      if(process.SessionId!=Process.GetCurrentProcess().SessionId)continue;
      var started=process.StartTime;string identity=process.Id+":"+started.Ticks;
      if(handled.Contains(identity))continue;
      // Restrict execution to the supported installed engine, not name alone.
      string expected=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Razer","RazerAppEngine","app-4.0.896","RazerAppEngine.exe");
      if(!string.Equals(process.MainModule?.FileName,expected,StringComparison.OrdinalIgnoreCase))continue;
      if(!process.Modules.Cast<ProcessModule>().Any(m=>m.ModuleName=="mapping_engine.dll"))continue;
      handled.Add(identity);Log("New mapping engine pid="+process.Id);
      await Run("KeyboardTextFix",Path.Combine(Root,"KeyboardTextFix","patch.json"),process.Id.ToString());
      bool ready=false;
      for(int attempt=0;attempt<120&&!process.HasExited;attempt++){
       try{
        var file=Path.Combine(Logs,"mapping_engine.log");var text=ReadShared(file);int init=text.LastIndexOf("MappingEngine::Initialize:",StringComparison.Ordinal);
        ready=File.GetLastWriteTime(file)>=started&&init>=0&&text[init..].Split('\n').Any(l=>l.Contains("MappingEngineUsbDevice::MappingEngineUsbDevice:")&&l.Contains(receiver,StringComparison.OrdinalIgnoreCase));
       }catch(IOException){}
       if(ready)break;await Task.Delay(1000);
      }
      if(!ready||process.HasExited){Log("Receiver not ready or engine exited; mouse recovery skipped.");continue;}
      await Task.Delay(3000);
      if(process.HasExited)continue;
      string snapshot=ExportLatest(receiver);
      await Run("MouseRuntimeFix",process.Id.ToString(),snapshot);
      Log("Startup recovery finished for pid="+process.Id);
     }catch(Exception e){Log("Skipped: "+e.Message);}
    }
    await Task.Delay(3000);
   }
  }catch(Exception e){Log("Loader stopped: "+e.Message);}
 }
}
