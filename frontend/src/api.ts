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
    selectExportDir: missing,
    listDiaries: missing,
    saveDiary: missing,
    getDiary: missing,
    deleteDiary: missing,
    getDataPath: missing,
    fetchWeather: missing,
    startAi: missing,
    abortAi: missing,
    listOllamaModels: missing,
    onAiEvent: () => () => {},
  } as DiaryApi;
})();
