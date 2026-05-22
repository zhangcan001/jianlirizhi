import type { Diary, DiaryFieldKey, AiSettings, ProjectProfile } from './types';

export const FIELD_DEFS: { key: DiaryFieldKey; label: string; placeholder: string; rows: number }[] = [
  {
    key: 'constructionStatus',
    label: '今日施工情况',
    placeholder: '记录施工部位、施工内容、工序、是否正常推进等。',
    rows: 6,
  },
  {
    key: 'contractorPersonnel',
    label: '承包单位人员投入',
    placeholder: '按单位/班组逐项写：1. XX单位：XX人 ... 合计：XX人',
    rows: 4,
  },
  {
    key: 'machinery',
    label: '承包单位机械投入',
    placeholder: '按机械逐项写：1. 塔吊：1台 2. 泵车：1台 ...',
    rows: 4,
  },
  {
    key: 'inspectionWork',
    label: '巡视检查工作',
    placeholder: '巡视部位/工序、人员到岗、机械使用、质量、安全文明、问题整改与复查。',
    rows: 6,
  },
  {
    key: 'materialAcceptance',
    label: '材料验收 / 见证取样工作',
    placeholder: '默认留空。如有材料验收/见证取样再填写。',
    rows: 3,
  },
  {
    key: 'acceptanceWork',
    label: '验收工作',
    placeholder: '本日实际进行的工序/分项/隐蔽验收情况。无则填"无。"',
    rows: 3,
  },
  {
    key: 'standingWork',
    label: '旁站工作',
    placeholder: '旁站部位、工序、起止时间、旁站结论。无则填"无。"',
    rows: 3,
  },
  {
    key: 'meeting',
    label: '会议',
    placeholder: '会议名称、主持人、参会单位、议题与决议。无则填"无。"',
    rows: 3,
  },
  {
    key: 'internalWork',
    label: '内业工作',
    placeholder: '资料整理、月报/周报、台账、签字盖章等。无则填"无。"',
    rows: 3,
  },
  {
    key: 'issuesAndActions',
    label: '问题与措施 / 建议补充',
    placeholder: '现场问题 → 措施 → 复查；以及当前记录中缺失的建议补充信息。',
    rows: 4,
  },
  {
    key: 'otherMatters',
    label: '其他事项',
    placeholder: '其他需要记录的内容。无则填"无。"',
    rows: 3,
  },
];

export const WEEKDAY_CHARS = ['日', '一', '二', '三', '四', '五', '六'];

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function weekdayOf(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return `星期${WEEKDAY_CHARS[d.getDay()]}`;
}

export function emptyDiary(date: string): Diary {
  return {
    date,
    weekday: weekdayOf(date),
    writer: '',
    city: '',
    weatherMorning: '',
    weatherAfternoon: '',
    temperature: '',
    humidity: '',
    windDirection: '',
    windPower: '',
    constructionStatus: '',
    contractorPersonnel: '',
    machinery: '',
    inspectionWork: '',
    materialAcceptance: '',
    acceptanceWork: '',
    standingWork: '',
    meeting: '',
    internalWork: '',
    issuesAndActions: '',
    otherMatters: '',
    chiefEngineerComments: '',
    specialistSupervisorComments: '',
  };
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'ollama',
  endpoint: 'http://127.0.0.1:11434',
  apiKey: '',
  model: 'qwen2.5:7b',
  glossary: '',
};

export const DEFAULT_PROJECT_PROFILE: ProjectProfile = {
  projectName: '',
  buildUnit: '',
  contractorUnit: '',
  supervisorUnit: '',
  chiefSupervisor: '',
  writer: '',
};
