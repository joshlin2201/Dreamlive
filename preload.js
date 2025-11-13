const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAudioFiles: () => ipcRenderer.invoke('get-audio-files'),
  selectAudioFolder: () => ipcRenderer.invoke('select-audio-folder'),
  getAudioFilesFromPath: (path) => ipcRenderer.invoke('get-audio-files-from-path', path)
});
