'use strict';
// Preserve the original MenuItem callbacks; unsupported menu types use Electron's native menu.
exports.install = function install(electron = require('electron')) {
  if (process.platform !== 'win32') return;
  const {Tray, BrowserWindow, ipcMain, nativeTheme, screen, app} = electron;
  const path = require('path');
  const original = Tray.prototype.setContextMenu;
  const menus = new WeakMap();
  const windows = new Set();
  let active = null;
  const supported = menu => menu && menu.items.length > 0 && menu.items.every(item =>
    !item.role && !item.submenu && ['normal', 'separator'].includes(item.type));
  const close = () => { if (active && !active.isDestroyed()) active.close(); active = null; };
  function popup(tray, state, point) {
    close();
    if (tray.isDestroyed()) return;
    if (nativeTheme.shouldUseHighContrastColors) { tray.popUpContextMenu(state.menu); return; }
    const items = state.menu.items.filter(item => item.visible !== false);
    const height = items.reduce((sum, item) => sum + (item.type === 'separator' ? 9 : 36), 18);
    const area = screen.getDisplayNearestPoint(point).workArea;
    const width = Math.min(390, Math.max(270, ...items.map(item => [...(item.label || '')].length * 9 + 78)), area.width);
    const fitHeight = Math.min(height, area.height);
    const win = new BrowserWindow({
      width, height: fitHeight,
      x: Math.round(Math.max(area.x, Math.min(point.x - width / 2, area.x + area.width - width))),
      y: Math.round(Math.max(area.y, Math.min(point.y - fitHeight - 6, area.y + area.height - fitHeight))),
      show: false, frame: false, transparent: true, backgroundColor: '#00000000',
      roundedCorners: true, hasShadow: true, resizable: false, skipTaskbar: true, alwaysOnTop: true,
      webPreferences: {preload: path.join(__dirname, 'local-tray-preload.js'),
        nodeIntegration: false, contextIsolation: true, sandbox: true}
    });
    win.__localRazerTrayMenu = true;
    active = win; windows.add(win);
    const selectedWindow = BrowserWindow.getFocusedWindow();
    let used = false;
    const model = () => ({dark: nativeTheme.shouldUseDarkColors, items: items.map((item, index) => ({
      index, label: (item.label || '').replace(/&&/g, '\0').replace(/&/g, '').replace(/\0/g, '&'),
      separator: item.type === 'separator', enabled: item.enabled !== false,
      icon: item.icon && !item.icon.isEmpty() ? item.icon.toDataURL() : null
    }))});
    const send = () => {if (!win.isDestroyed()) win.webContents.send('local-tray-model', model());};
    const activate = (event, index) => {
      if (event.sender !== win.webContents || used || !Number.isInteger(index)) return;
      const item = items[index];
      if (!item || item.visible === false || item.enabled === false || item.type !== 'normal') return;
      used = true;
      win.close();
      try {
        const result = item.click(item, selectedWindow && !selectedWindow.isDestroyed() ? selectedWindow : undefined,
          {shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, triggeredByAccelerator: false});
        Promise.resolve(result).catch(error => console.warn('Tray action failed:', error));
      } catch (error) { console.warn('Tray action failed:', error); }
    };
    const dismiss = event => {if (event.sender === win.webContents) win.close();};
    ipcMain.on('local-tray-activate', activate); ipcMain.on('local-tray-dismiss', dismiss);
    nativeTheme.on('updated', send);
    win.once('closed', () => {
      ipcMain.removeListener('local-tray-activate', activate); ipcMain.removeListener('local-tray-dismiss', dismiss);
      nativeTheme.removeListener('updated', send); windows.delete(win); if (active === win) active = null;
    });
    win.on('blur', () => win.close());
    win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.webContents.once('did-finish-load', send);
    win.once('ready-to-show', () => {win.show(); win.focus();});
    win.loadFile(path.join(__dirname, 'local-tray-menu.html')).catch(() => {
      if (!win.isDestroyed()) win.close();
      if (!tray.isDestroyed()) tray.popUpContextMenu(state.menu);
    });
  }
  Tray.prototype.setContextMenu = function(menu) {
    let state = menus.get(this);
    if (!supported(menu)) {
      if (state) {this.removeListener('right-click', state.listener); menus.delete(this); close();}
      return original.call(this, menu);
    }
    if (!state) {
      state = {menu};
      state.listener = () => {
        try {popup(this, state, screen.getCursorScreenPoint());}
        catch (error) {console.warn('Rounded tray menu unavailable:', error); this.popUpContextMenu(state.menu);}
      };
      menus.set(this, state); this.on('right-click', state.listener);
    } else {state.menu = menu; close();}
    return original.call(this, null);
  };
  app.once('before-quit', close);
  return {isMenu: win => windows.has(win)};
};
