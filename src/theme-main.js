(() => {
  // Local preference shared by every Razer window; no remote service required.
  const {app,nativeTheme,ipcMain,webContents,BrowserWindow}=require('electron');
  const fs=require('fs'),path=require('path');
  const file=path.join(app.getPath('userData'),'local-appearance.json');
  const modes=new Set(['system','light','dark']);
  let mode='system';
  try {const saved=JSON.parse(fs.readFileSync(file,'utf8'));if(modes.has(saved.mode))mode=saved.mode;}catch{}
  function trusted(event,settingsOnly=false) {
    try {
      const url=new URL(event.senderFrame.url);
      if(url.protocol==='https:' && url.hostname==='apps.razer.com')
        return !settingsOnly || /^\/(?:synapse\/)?settings(?:\/|$)/.test(url.pathname);
      return !settingsOnly && url.protocol==='file:' && /\/electron\/index\.html$/.test(url.pathname);
    } catch {return false;}
  }
  function updateWindows() {
    const color=nativeTheme.shouldUseDarkColors?'#222222':'#f2f5f8';
    for(const win of BrowserWindow.getAllWindows()) {
      if(!win.isDestroyed())win.setBackgroundColor(color);
    }
    for(const content of webContents.getAllWebContents()) {
      if(!content.isDestroyed())content.send('local-razer-theme-changed',mode);
    }
  }
  ipcMain.on('local-razer-theme-get',(event)=>{
    event.returnValue=trusted(event)?mode:'system';
  });
  ipcMain.handle('local-razer-theme-set',(event,next)=>{
    if(!trusted(event,true)||!modes.has(next))throw Error('Invalid appearance setting');
    fs.mkdirSync(path.dirname(file),{recursive:true});
    const pending=file+'.tmp';
    fs.writeFileSync(pending,JSON.stringify({mode:next}),'utf8');
    fs.renameSync(pending,file);
    mode=next;
    nativeTheme.themeSource=mode;
    updateWindows();
    return mode;
  });
  nativeTheme.on('updated',updateWindows);
  app.on('browser-window-created',(_event,win)=>{
    const paint=()=>{if(!win.isDestroyed())win.setBackgroundColor(nativeTheme.shouldUseDarkColors?'#222222':'#f2f5f8');};
    paint();
    win.webContents.on('did-start-loading',paint);
  });
  return mode;
})()
