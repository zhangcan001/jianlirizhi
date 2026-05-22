import type { AiMode, AiSettings, Diary } from '../types';
import { api } from '../api';

interface Props {
  diary: Diary;
  settings: AiSettings;
  replaceDiary: (next: Partial<Diary>) => void;
  onBusy: (busy: boolean, msg?: string) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export function AiBar({ diary, settings, replaceDiary, onBusy, onError, onSuccess }: Props) {
  const run = async (mode: AiMode) => {
    onBusy(true, mode === 'polish' ? 'AI 正在润色…' : 'AI 正在分析全部字段…');
    try {
      const result = await api.runAi({ mode, diary, settings });
      const allowed: (keyof Diary)[] = [
        'constructionStatus',
        'contractorPersonnel',
        'machinery',
        'inspectionWork',
        'materialAcceptance',
        'acceptanceWork',
        'standingWork',
        'meeting',
        'internalWork',
        'issuesAndActions',
        'otherMatters',
      ];
      const patch: Partial<Diary> = {};
      for (const [k, v] of Object.entries(result)) {
        if ((allowed as string[]).includes(k) && typeof v === 'string') {
          (patch as Record<string, string>)[k] = v;
        }
      }
      replaceDiary(patch);
      onSuccess(mode === 'polish' ? '已润色 constructionStatus / inspectionWork' : '已生成全部字段');
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onBusy(false);
    }
  };

  return (
    <div className="ai-bar">
      <button className="primary" type="button" onClick={() => run('polish')}>
        AI 润色
      </button>
      <button className="primary" type="button" onClick={() => run('analyze')}>
        AI 分析全部
      </button>
      <span className="ai-hint">模型：{settings.provider === 'ollama' ? 'Ollama' : 'OpenAI 兼容'} · {settings.model}</span>
    </div>
  );
}
