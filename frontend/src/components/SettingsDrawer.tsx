import { useEffect } from 'react';
import type { AiSettings } from '../types';

interface Props {
  open: boolean;
  settings: AiSettings;
  update: <K extends keyof AiSettings>(key: K, value: AiSettings[K]) => void;
  onClose: () => void;
}

export function SettingsDrawer({ open, settings, update, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {open && <div className="drawer-mask" onClick={onClose} />}
      <div className={`drawer${open ? ' open' : ''}`}>
        <div className="drawer-head">
          <h2>AI 设置</h2>
          <button className="ghost" type="button" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="drawer-body">
          <label className="field block">
            <span>Provider</span>
            <select
              value={settings.provider}
              onChange={(e) => update('provider', e.target.value as AiSettings['provider'])}
            >
              <option value="ollama">本地 Ollama</option>
              <option value="openai-compatible">OpenAI 兼容（OpenRouter 等）</option>
            </select>
          </label>
          <label className="field block">
            <span>Endpoint</span>
            <input
              type="text"
              value={settings.endpoint}
              onChange={(e) => update('endpoint', e.target.value)}
              placeholder={settings.provider === 'ollama' ? 'http://127.0.0.1:11434' : 'https://openrouter.ai/api/v1'}
            />
          </label>
          <label className="field block">
            <span>Model</span>
            <input
              type="text"
              value={settings.model}
              onChange={(e) => update('model', e.target.value)}
              placeholder={settings.provider === 'ollama' ? 'qwen2.5:7b' : 'openrouter/auto'}
            />
          </label>
          <label className="field block">
            <span>API Key（仅 OpenAI 兼容时需要）</span>
            <input
              type="password"
              value={settings.apiKey}
              onChange={(e) => update('apiKey', e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
            />
          </label>
          <p className="drawer-hint">
            设置自动保存在本地 localStorage。本地 Ollama 用法：先 <code>ollama serve</code>，再 <code>ollama pull qwen2.5:7b</code>。
          </p>
        </div>
      </div>
    </>
  );
}
