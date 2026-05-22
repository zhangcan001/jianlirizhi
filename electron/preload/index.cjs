const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('diaryApi', {
  exportDocx: (payload) => ipcRenderer.invoke('diary:export-docx', payload),
  exportDocxToDir: (payload) => ipcRenderer.invoke('diary:export-docx-to-dir', payload),
  selectExportDir: () => ipcRenderer.invoke('diary:select-export-dir'),
  listDiaries: () => ipcRenderer.invoke('diary:list'),
  saveDiary: (payload) => ipcRenderer.invoke('diary:save', payload),
  getDiary: (date) => ipcRenderer.invoke('diary:get', date),
  deleteDiary: (date) => ipcRenderer.invoke('diary:delete', date),
  getDataPath: () => ipcRenderer.invoke('diary:data-path'),
  fetchWeather: (payload) => ipcRenderer.invoke('weather:fetch', payload),
  startAi: (payload) => ipcRenderer.invoke('ai:start', payload),
  abortAi: (jobId) => ipcRenderer.invoke('ai:abort', jobId),
  onAiEvent: (handler) => {
    const listener = (_e, evt) => handler(evt);
    ipcRenderer.on('ai:event', listener);
    return () => ipcRenderer.removeListener('ai:event', listener);
  }
});
