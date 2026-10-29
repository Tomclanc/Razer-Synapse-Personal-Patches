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
    // The tray flyout is an opaque, frameless BrowserWindow. CSS radius alone
    // cannot remove its square native corners. Shape only this exact surface.
    let shaped=false,lastSize='';
    const roundTray=()=>{
      if(win.isDestroyed()||typeof win.setShape!=='function')return;
      let tray=false;
      try {
        const url=new URL(win.webContents.getURL());
        tray=url.protocol==='https:'&&url.hostname==='apps.razer.com'&&
          /^\/systray\/systrayv2\/?$/.test(url.pathname);
      } catch {}
      if(!tray){if(shaped){win.setShape([]);shaped=false;lastSize='';}return;}
      const {width,height}=win.getBounds();
      if(width<2||height<2)return;
      const size=width+':'+height;
      if(shaped&&lastSize===size)return;
      const radius=Math.min(12,Math.floor(width/2),Math.floor(height/2));
      const rects=[];
      for(let y=0;y<radius;y++) {
        const dy=radius-y-.5;
        const inset=Math.ceil(radius-Math.sqrt(radius*radius-dy*dy));
        rects.push({x:inset,y,width:width-2*inset,height:1},
          {x:inset,y:height-y-1,width:width-2*inset,height:1});
      }
      if(height>2*radius)rects.push({x:0,y:radius,width,height:height-2*radius});
      win.setShape(rects);shaped=true;lastSize=size;
    };
    win.on('resize',roundTray);
    win.on('show',roundTray);
    win.webContents.on('did-finish-load',roundTray);
    win.webContents.on('did-navigate',roundTray);
    const paint=()=>{if(!win.isDestroyed())win.setBackgroundColor(nativeTheme.shouldUseDarkColors?'#222222':'#f2f5f8');};
    paint();
    win.webContents.on('did-start-loading',paint);
  });
  return mode;
})()
