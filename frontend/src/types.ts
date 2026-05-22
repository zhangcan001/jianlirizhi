export type DiaryFieldKey =
  | 'constructionStatus'
  | 'contractorPersonnel'
  | 'machinery'
  | 'inspectionWork'
  | 'materialAcceptance'
  | 'acceptanceWork'
  | 'standingWork'
  | 'meeting'
  | 'internalWork'
  | 'issuesAndActions'
  | 'otherMatters';

export interface Diary {
  date: string;
  weekday: string;
  writer: string;
  city: string;
  weatherMorning: string;
  weatherAfternoon: string;
  temperature: string;
  humidity: string;
  windDirection: string;
  windPower: string;
  constructionStatus: string;
  contractorPersonnel: string;
  machinery: string;
  inspectionWork: string;
  materialAcceptance: string;
  acceptanceWork: string;
  standingWork: string;
  meeting: string;
  internalWork: string;
  issuesAndActions: string;
  otherMatters: string;
  chiefEngineerComments: string;
  updatedAt?: string;
}

export interface DiarySummary {
  date: string;
  weekday: string;
  title: string;
  updatedAt: string;
}

export type AiProvider = 'ollama' | 'openai-compatible';

export interface AiSettings {
  provider: AiProvider;
  endpoint: string;
  apiKey: string;
  model: string;
}

export interface WeatherResult {
  city: string;
  country: string;
  date: string;
  weatherMorning: string;
  weatherAfternoon: string;
  temperature: string;
  humidity: string;
  windDirection: string;
  windPower: string;
}

export type AiMode = 'polish' | 'analyze';

export interface DiaryApi {
  exportDocx: (payload: Diary) => Promise<{ canceled: boolean; filePath?: string }>;
  exportDocxToDir: (payload: Diary & { exportDir: string }) => Promise<{ canceled: boolean; filePath?: string }>;
  selectExportDir: () => Promise<{ canceled: boolean; dir?: string }>;
  listDiaries: () => Promise<DiarySummary[]>;
  saveDiary: (payload: Diary) => Promise<{ ok: boolean; diary: Diary; list: DiarySummary[] }>;
  getDiary: (date: string) => Promise<Diary | null>;
  deleteDiary: (date: string) => Promise<{ ok: boolean }>;
  getDataPath: () => Promise<string>;
  fetchWeather: (payload: { city: string; date: string }) => Promise<WeatherResult>;
  runAi: (payload: { mode: AiMode; diary: Diary; settings: AiSettings }) => Promise<Partial<Diary>>;
}

declare global {
  interface Window {
    diaryApi: DiaryApi;
  }
}
