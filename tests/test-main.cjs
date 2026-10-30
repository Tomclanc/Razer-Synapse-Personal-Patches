const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('src/theme-main.js','utf8');
function create(saved='system') {
  const handlers={},events={},files={'/test/local-appearance.json':JSON.stringify({mode:saved})};
  const nativeTheme={shouldUseDarkColors:false,on:(name,fn)=>events[name]=fn};
  const appEvents={};
  const electron={app:{getPath:()=>'/test',on:(name,fn)=>appEvents[name]=fn},nativeTheme,
    ipcMain:{on:(name,fn)=>handlers[name]=fn,handle:(name,fn)=>handlers[name]=fn},
    webContents:{getAllWebContents:()=>[]},BrowserWindow:{getAllWindows:()=>[]}};
  const fakeFS={readFileSync:p=>files[p],mkdirSync(){},writeFileSync:(p,s)=>files[p]=s,renameSync:(a,b)=>{files[b]=files[a];delete files[a]}};
  const result=vm.runInNewContext(code,{URL,require:n=>n==='electron'?electron:n==='fs'?fakeFS:require('path').posix});
  return {handlers,files,result,nativeTheme,appEvents};
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
const windowEvents={},webEvents={},shapes=[];
let url='https://apps.razer.com/systray/systrayv2/',bounds={width:360,height:400},destroyed=false;
const win={isDestroyed:()=>destroyed,setBackgroundColor(){},getBounds:()=>bounds,
  setShape:rects=>shapes.push(rects),on:(name,fn)=>windowEvents[name]=fn,
  webContents:{getURL:()=>url,on:(name,fn)=>webEvents[name]=fn}};
a.appEvents['browser-window-created']({},win);
webEvents['did-finish-load']();assert.equal(shapes.length,1);
function contains(rects,x,y){return rects.some(r=>x>=r.x&&y>=r.y&&x<r.x+r.width&&y<r.y+r.height);}
assert(!contains(shapes[0],0,0));assert(!contains(shapes[0],359,399));
assert(contains(shapes[0],180,0));assert(contains(shapes[0],0,200));
assert(contains(shapes[0],180,399));
windowEvents.show();assert.equal(shapes.length,1);
bounds={width:420,height:500};windowEvents.resize();assert.equal(shapes.length,2);
assert(contains(shapes[1],210,499));assert(!contains(shapes[1],419,499));
url='https://apps.razer.com/settings/';webEvents['did-navigate']();assert.equal(shapes[2].length,0);
url='https://example.com/systray/systrayv2/';webEvents['did-finish-load']();assert.equal(shapes.length,3);
url='https://apps.razer.com/systray/systrayv2/';windowEvents.show();assert.equal(shapes.length,4);
destroyed=true;windowEvents.resize();assert.equal(shapes.length,4);
console.log('PASS: tray native corners, resize, repeat opening, navigation isolation and destroyed-window guard.');
