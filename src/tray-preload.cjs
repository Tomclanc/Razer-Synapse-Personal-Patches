'use strict';
const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('localTray', {
  onModel: callback => ipcRenderer.on('local-tray-model', (_event, model) => callback(model)),
  activate: index => ipcRenderer.send('local-tray-activate', index),
  dismiss: () => ipcRenderer.send('local-tray-dismiss')
});
