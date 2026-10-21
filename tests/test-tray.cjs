const fs=require('fs'),vm=require('vm'),assert=require('assert'),{EventEmitter}=require('events');
const ipcMain=new EventEmitter(),nativeTheme=new EventEmitter(),app=new EventEmitter();
const created=[];
class Tray extends EventEmitter {
  setContextMenu(menu){this.nativeMenu=menu;}
  isDestroyed(){return false;}
  popUpContextMenu(menu){this.fallback=menu;}
}
class BrowserWindow extends EventEmitter {
  static getFocusedWindow(){return undefined;}
  constructor(options){super();this.options=options;this.webContents=new EventEmitter();this.webContents.send=()=>{};
    this.webContents.setWindowOpenHandler=fn=>this.openHandler=fn;created.push(this);}
  isDestroyed(){return !!this.destroyed;}
  close(){if(!this.destroyed){this.destroyed=true;this.emit('closed');}}
  show(){} focus(){} loadFile(){return Promise.resolve();}
}
const electron={Tray,BrowserWindow,ipcMain,nativeTheme,app,screen:{
  getDisplayNearestPoint:()=>({workArea:{x:-1920,y:0,width:1920,height:1080}}),
  getCursorScreenPoint:()=>({x:-1,y:1080})}};
const context={exports:{},require:n=>n==='electron'?electron:require(n),process:{platform:'win32'},__dirname:'/test',console};
vm.runInNewContext(fs.readFileSync('src/tray-menu.cjs','utf8'),context);
context.exports.install();
let clicked=0;
const menu={items:[{label:'Settings',type:'normal',click:()=>clicked++},
  {label:'Disabled',type:'normal',enabled:false,click:()=>clicked+=100},
  {type:'separator'},{label:'Exit',type:'normal',click:()=>{}}]};
const tray=new Tray();tray.setContextMenu(menu);tray.setContextMenu(menu);
assert.equal(tray.listenerCount('right-click'),1);
assert.equal(tray.nativeMenu,null);
tray.emit('right-click');const win=created.at(-1);
assert.equal(win.options.transparent,true);assert.equal(win.options.roundedCorners,true);
assert(win.options.x>=-1920&&win.options.x+win.options.width<=0);
assert(win.options.y>=0&&win.options.y+win.options.height<=1080);
assert.equal(win.options.webPreferences.nodeIntegration,false);
assert.equal(win.options.webPreferences.contextIsolation,true);
assert.equal(win.options.webPreferences.sandbox,true);
assert.equal(win.openHandler().action,'deny');
ipcMain.emit('local-tray-activate',{sender:{}},0);assert.equal(clicked,0);
ipcMain.emit('local-tray-activate',{sender:win.webContents},1);assert.equal(clicked,0);
ipcMain.emit('local-tray-activate',{sender:win.webContents},999);assert.equal(clicked,0);
ipcMain.emit('local-tray-activate',{sender:win.webContents},0);assert.equal(clicked,1);
assert.equal(ipcMain.listenerCount('local-tray-activate'),0);
assert.equal(ipcMain.listenerCount('local-tray-dismiss'),0);
assert.equal(nativeTheme.listenerCount('updated'),0);
tray.emit('right-click');created.at(-1).emit('blur');assert(created.at(-1).destroyed);
nativeTheme.shouldUseHighContrastColors=true;tray.emit('right-click');assert.equal(tray.fallback,menu);
const unsupported={items:[{type:'normal',role:'quit'}]};tray.setContextMenu(unsupported);
assert.equal(tray.nativeMenu,unsupported);assert.equal(tray.listenerCount('right-click'),0);
console.log('PASS: tray callback dispatch, sender validation, disabled/invalid rejection, single listener, cleanup, high contrast/native fallback, screen bounds.');
