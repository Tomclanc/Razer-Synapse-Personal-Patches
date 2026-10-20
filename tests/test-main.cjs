const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('src/theme-main.js','utf8');
function create(saved='system') {
  const handlers={},events={},files={'/test/local-appearance.json':JSON.stringify({mode:saved})};
  const nativeTheme={shouldUseDarkColors:false,on:(name,fn)=>events[name]=fn};
  const electron={app:{getPath:()=>'/test',on(){}},nativeTheme,
    ipcMain:{on:(name,fn)=>handlers[name]=fn,handle:(name,fn)=>handlers[name]=fn},
    webContents:{getAllWebContents:()=>[]},BrowserWindow:{getAllWindows:()=>[]}};
  const fakeFS={readFileSync:p=>files[p],mkdirSync(){},writeFileSync:(p,s)=>files[p]=s,renameSync:(a,b)=>{files[b]=files[a];delete files[a]}};
  const result=vm.runInNewContext(code,{URL,require:n=>n==='electron'?electron:n==='fs'?fakeFS:require('path').posix});
  return {handlers,files,result,nativeTheme};
}
const a=create('dark');assert.equal(a.result,'dark');
const valid={senderFrame:{url:'https://apps.razer.com/settings/'}};
for(const mode of ['light','dark','system']) {
  assert.equal(a.handlers['local-razer-theme-set'](valid,mode),mode);
  assert.equal(JSON.parse(a.files['/test/local-appearance.json']).mode,mode);
  assert.equal(a.nativeTheme.themeSource,mode);
}
assert.throws(()=>a.handlers['local-razer-theme-set'](valid,'invalid'));
assert.throws(()=>a.handlers['local-razer-theme-set']({senderFrame:{url:'https://example.com/settings/'}},'dark'));
assert.equal(create('invalid').result,'system');
console.log('PASS: main process saved mode, all modes, invalid values and unrelated origins rejected.');
