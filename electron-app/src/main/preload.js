const { contextBridge, ipcRenderer } = require('electron');

// Polyfill per require nel renderer
window.require = require;

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Add IPC methods here as needed
  platform: process.platform,
  require: require
});

