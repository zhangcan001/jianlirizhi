import { useState } from 'react';
import type { AiMode, AiSettings, Diary } from '../types';
import { useAiJob } from '../hooks/useAiJob';

interface Props {
  diary: Diary;
  settings: AiSettings;
  replaceDiary: (next: Partial<Diary>) => void;
  snapshotAiFields: () => void;
  onBusy: (busy: boolean, msg?: string) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

const ALLOWED_KEYS: (keyof Diary)[] = [
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

export function AiBar({ diary, settings, replaceDiary, snapshotAiFields, onBusy, onError, onSuccess }: Props) {
  const { state, run, abort } = useAiJob();
  const [failure, setFailure] = useState<{ message: string; raw: string } | null>(null);

  const start = (mode: AiMode) => {
    setFailure(null);
    snapshotAiFields();
    onBusy(true, mode === 'polish' ? 'AI 正在润色…' : 'AI 正在分析全部字段…');
    run(
      { mode, diary, settings },
      {
        onPartial: (field, value) => {
          if ((ALLOWED_KEYS as string[]).includes(field)) {
            replaceDiary({ [field]: value } as Partial<Diary>);
          }
        },
        onDone: (result) => {
          const patch: Partial<Diary> = {};
          for (const [k, v] of Object.entries(result)) {
            if ((ALLOWED_KEYS as string[]).includes(k) && typeof v === 'string') {
              (patch as Record<string, string>)[k] = v;
            }
          }
          replaceDiary(patch);
          onBusy(false);
          onSuccess(mode === 'polish' ? '已润色 constructionStatus / inspectionWork' : '已生成全部字段');
        },
        onError: (msg, raw) => {
          onBusy(false);
          onError(msg);
          if (raw) setFailure({ message: msg, raw });
        },
        onAborted: () => {
          onBusy(false);
          onError('已取消 AI 处理');
        },
      },
    );
  };

  const copyRaw = async () => {
    if (!failure) return;
    try {
      await navigator.clipboard.writeText(failure.raw);
      onSuccess('原始返回已复制到剪贴板');
    } catch (e) {
      onError(`复制失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const running = state.running;
  const progressLen = state.progress.length;

  return (
    <>
      <div className="ai-bar">
        <button className="primary" type="button" disabled={running} onClick={() => start('polish')}>
          AI 润色
        </button>
        <button className="primary" type="button" disabled={running} onClick={() => start('analyze')}>
          AI 分析全部
        </button>
        {running && (
          <button className="ghost" type="button" onClick={abort}>
            取消
          </button>
        )}
        <span className="ai-hint">
          {running
            ? `已接收 ${progressLen} 字…`
            : `模型：${settings.provider === 'ollama' ? 'Ollama' : 'OpenAI 兼容'} · ${settings.model}`}
        </span>
      </div>
      {failure && (
        <div className="ai-failure">
          <div className="ai-failure-head">
            <strong>AI 返回无法解析</strong>
            <div className="ai-failure-actions">
              <button className="ghost" type="button" onClick={copyRaw}>
                复制原文
              </button>
              <button className="ghost" type="button" onClick={() => setFailure(null)}>
                关闭
              </button>
            </div>
          </div>
          <pre className="ai-failure-raw">{failure.raw}</pre>
        </div>
      )}
    </>
  );
}
