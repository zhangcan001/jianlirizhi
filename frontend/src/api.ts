import type { DiaryApi } from './types';

export const api: DiaryApi = (() => {
  if (typeof window !== 'undefined' && window.diaryApi) {
    return window.diaryApi;
  }
  const missing = () => {
    throw new Error('diaryApi 未注入：当前环境可能不是 Electron 渲染进程。');
  };
  return {
    exportDocx: missing,
    exportDocxToDir: missing,
    exportMonth: missing,
    selectExportDir: missing,
    listDiaries: missing,
    searchDiaries: missing,
    saveDiary: missing,
    getDiary: missing,
    deleteDiary: missing,
    getDataPath: missing,
    fetchWeather: missing,
    saveDraft: missing,
    getDraft: missing,
    clearDraft: missing,
    startAi: missing,
    abortAi: missing,
    listOllamaModels: missing,
    getSecret: missing,
    setSecret: missing,
    clearSecret: missing,
    getFieldHistory: missing,
    exportBackup: missing,
    importBackup: missing,
    onAiEvent: () => () => {},
  } as DiaryApi;
})();
