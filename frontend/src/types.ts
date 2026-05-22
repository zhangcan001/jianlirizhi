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
  specialistSupervisorComments: string;
  updatedAt?: string;
}

export interface DiarySummary {
  date: string;
  weekday: string;
  title: string;
  updatedAt: string;
  snippet?: string;
  snippetField?: string;
  query?: string;
}

export type AiProvider = 'ollama' | 'openai-compatible';

export interface AiSettings {
  provider: AiProvider;
  endpoint: string;
  apiKey: string;
  model: string;
  glossary: string;
}

export interface ProjectProfile {
  projectName: string;
  buildUnit: string;
  contractorUnit: string;
  supervisorUnit: string;
  chiefSupervisor: string;
  writer: string;
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

export type AiEvent =
  | { jobId: string; type: 'chunk'; data: string }
  | { jobId: string; type: 'partial'; data: { field: DiaryFieldKey; value: string } }
  | { jobId: string; type: 'done'; data: { result: Partial<Diary>; raw: string } }
  | { jobId: string; type: 'error'; data: { message: string; raw?: string; code?: string } }
  | { jobId: string; type: 'aborted'; data: { message: string } };

export interface FieldHistoryItem {
  date: string;
  value: string;
}

export interface BackupSettings {
  lastCity?: string;
  exportDir?: string;
  autoFetchWeather?: string;
  aiSettings?: string;
  projectProfile?: string;
}

export interface DiaryApi {
  exportDocx: (payload: Diary) => Promise<{ canceled: boolean; filePath?: string }>;
  exportDocxToDir: (payload: Diary & { exportDir: string }) => Promise<{ canceled: boolean; filePath?: string }>;
  exportMonth: (payload: { month: string; exportDir?: string }) => Promise<{
    canceled: boolean;
    dir?: string;
    count?: number;
    files?: string[];
    errors?: { date: string; message: string }[];
  }>;
  selectExportDir: () => Promise<{ canceled: boolean; dir?: string }>;
  listDiaries: () => Promise<DiarySummary[]>;
  searchDiaries: (payload: { query: string; limit?: number }) => Promise<DiarySummary[]>;
  saveDiary: (payload: Diary) => Promise<{ ok: boolean; diary: Diary; list: DiarySummary[] }>;
  getDiary: (date: string) => Promise<Diary | null>;
  deleteDiary: (date: string) => Promise<{ ok: boolean }>;
  getDataPath: () => Promise<string>;
  fetchWeather: (payload: { city: string; date: string }) => Promise<WeatherResult>;
  saveDraft: (payload: { date: string; payload: Diary }) => Promise<{ ok: boolean }>;
  getDraft: (date: string) => Promise<{ payload: Diary; updatedAt: string } | null>;
  clearDraft: (date: string) => Promise<{ ok: boolean; error?: string }>;
  startAi: (payload: { mode: AiMode; diary: Diary; settings: AiSettings }) => Promise<string>;
  abortAi: (jobId: string) => Promise<{ ok: boolean }>;
  listOllamaModels: (endpoint: string) => Promise<{ ok: boolean; models: string[]; error?: string }>;
  getSecret: (name: string) => Promise<{ ok: boolean; value?: string; error?: string }>;
  setSecret: (name: string, value: string) => Promise<{ ok: boolean; encrypted?: boolean; error?: string }>;
  clearSecret: (name: string) => Promise<{ ok: boolean; error?: string }>;
  getFieldHistory: (payload: { field: DiaryFieldKey; limit?: number }) => Promise<{
    ok: boolean;
    items: FieldHistoryItem[];
    error?: string;
  }>;
  exportBackup: (payload: { settings: BackupSettings }) => Promise<{
    canceled: boolean;
    filePath?: string;
    count?: number;
  }>;
  importBackup: () => Promise<{
    canceled: boolean;
    ok?: boolean;
    filePath?: string;
    imported?: number;
    settings?: BackupSettings;
    list?: DiarySummary[];
    error?: string;
  }>;
  onAiEvent: (handler: (evt: AiEvent) => void) => () => void;
}

declare global {
  interface Window {
    diaryApi: DiaryApi;
  }
}
