// Executed immediately after a tab's native view is constructed, before attachment.
(() => {
  const theme=require('electron').nativeTheme;
  const view=this.tab;
  const paint=()=>{
    if(!m.transparent&&!view.webContents.isDestroyed())
      view.setBackgroundColor(theme.shouldUseDarkColors?'#222222':'#f2f5f8');
  };
  paint();
  theme.on('updated',paint);
  view.webContents.on('did-start-loading',paint);
  view.webContents.once('destroyed',()=>theme.removeListener('updated',paint));
})()
