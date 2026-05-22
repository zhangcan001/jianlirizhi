const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('diaryApi', {
  exportDocx: (payload) => ipcRenderer.invoke('diary:export-docx', payload),
  exportDocxToDir: (payload) => ipcRenderer.invoke('diary:export-docx-to-dir', payload),
  exportMonth: (payload) => ipcRenderer.invoke('diary:export-month', payload),
  selectExportDir: () => ipcRenderer.invoke('diary:select-export-dir'),
  listDiaries: () => ipcRenderer.invoke('diary:list'),
  searchDiaries: (payload) => ipcRenderer.invoke('diary:search', payload),
  saveDiary: (payload) => ipcRenderer.invoke('diary:save', payload),
  getDiary: (date) => ipcRenderer.invoke('diary:get', date),
  deleteDiary: (date) => ipcRenderer.invoke('diary:delete', date),
  getDataPath: () => ipcRenderer.invoke('diary:data-path'),
  fetchWeather: (payload) => ipcRenderer.invoke('weather:fetch', payload),
  saveDraft: (payload) => ipcRenderer.invoke('draft:save', payload),
  getDraft: (date) => ipcRenderer.invoke('draft:get', date),
  clearDraft: (date) => ipcRenderer.invoke('draft:clear', date),
  startAi: (payload) => ipcRenderer.invoke('ai:start', payload),
  abortAi: (jobId) => ipcRenderer.invoke('ai:abort', jobId),
  listOllamaModels: (endpoint) => ipcRenderer.invoke('ai:list-ollama-models', endpoint),
  getSecret: (name) => ipcRenderer.invoke('secret:get', name),
  setSecret: (name, value) => ipcRenderer.invoke('secret:set', { name, value }),
  clearSecret: (name) => ipcRenderer.invoke('secret:clear', name),
  getFieldHistory: (payload) => ipcRenderer.invoke('diary:field-history', payload),
  exportBackup: (payload) => ipcRenderer.invoke('backup:export', payload),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  onAiEvent: (handler) => {
    const listener = (_e, evt) => handler(evt);
    ipcRenderer.on('ai:event', listener);
    return () => ipcRenderer.removeListener('ai:event', listener);
  }
});
