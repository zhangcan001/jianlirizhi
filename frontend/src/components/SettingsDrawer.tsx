import { useCallback, useEffect, useState } from 'react';
import type { AiSettings, ProjectProfile } from '../types';
import { api } from '../api';

interface Props {
  open: boolean;
  settings: AiSettings;
  update: <K extends keyof AiSettings>(key: K, value: AiSettings[K]) => void;
  project: ProjectProfile;
  updateProject: <K extends keyof ProjectProfile>(key: K, value: ProjectProfile[K]) => void;
  onClose: () => void;
}

export function SettingsDrawer({ open, settings, update, project, updateProject, onClose }: Props) {
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string>('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const refreshModels = useCallback(async () => {
    if (settings.provider !== 'ollama') return;
    setModelsLoading(true);
    setModelsError('');
    try {
      const res = await api.listOllamaModels(settings.endpoint);
      if (res.ok) {
        setModels(res.models);
        if (!res.models.includes(settings.model) && res.models.length > 0) {
          // 不自动改 model,让用户自己选
        }
      } else {
        setModels([]);
        setModelsError(res.error || '无法连接 Ollama');
      }
    } catch (e) {
      setModelsError(e instanceof Error ? e.message : String(e));
    } finally {
      setModelsLoading(false);
    }
  }, [settings.endpoint, settings.provider, settings.model]);

  useEffect(() => {
    if (open && settings.provider === 'ollama') {
      refreshModels();
    }
  }, [open, settings.provider, refreshModels]);

  return (
    <>
      {open && <div className="drawer-mask" onClick={onClose} />}
      <div className={`drawer${open ? ' open' : ''}`}>
        <div className="drawer-head">
          <h2>设置</h2>
          <button className="ghost" type="button" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="drawer-body">
          <section className="drawer-section">
            <h3 className="drawer-section-title">项目档案</h3>
            <label className="field block">
              <span>工程名称</span>
              <input
                type="text"
                value={project.projectName}
                onChange={(e) => updateProject('projectName', e.target.value)}
                placeholder="例如：XX综合楼机电安装工程"
              />
            </label>
            <label className="field block">
              <span>建设单位</span>
              <input
                type="text"
                value={project.buildUnit}
                onChange={(e) => updateProject('buildUnit', e.target.value)}
              />
            </label>
            <label className="field block">
              <span>承包单位（总承包）</span>
              <input
                type="text"
                value={project.contractorUnit}
                onChange={(e) => updateProject('contractorUnit', e.target.value)}
              />
            </label>
            <label className="field block">
              <span>监理单位</span>
              <input
                type="text"
                value={project.supervisorUnit}
                onChange={(e) => updateProject('supervisorUnit', e.target.value)}
              />
            </label>
            <label className="field block">
              <span>总监理工程师</span>
              <input
                type="text"
                value={project.chiefSupervisor}
                onChange={(e) => updateProject('chiefSupervisor', e.target.value)}
              />
            </label>
            <label className="field block">
              <span>默认记录人（新建日记自动填入）</span>
              <input
                type="text"
                value={project.writer}
                onChange={(e) => updateProject('writer', e.target.value)}
              />
            </label>
          </section>

          <section className="drawer-section">
            <h3 className="drawer-section-title">AI 设置</h3>
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
            <span>
              Model
              {settings.provider === 'ollama' && (
                <button
                  type="button"
                  className="ghost"
                  style={{ height: 22, padding: '0 8px', fontSize: 11, marginLeft: 8 }}
                  onClick={refreshModels}
                  disabled={modelsLoading}
                >
                  {modelsLoading ? '加载中…' : '刷新'}
                </button>
              )}
            </span>
            {settings.provider === 'ollama' && models.length > 0 ? (
              <select
                value={models.includes(settings.model) ? settings.model : ''}
                onChange={(e) => update('model', e.target.value)}
              >
                {!models.includes(settings.model) && (
                  <option value="">（当前 {settings.model} 未安装）</option>
                )}
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={settings.model}
                onChange={(e) => update('model', e.target.value)}
                placeholder={settings.provider === 'ollama' ? 'qwen2.5:7b' : 'openrouter/auto'}
              />
            )}
            {settings.provider === 'ollama' && modelsError && (
              <span style={{ color: '#9b3f35', fontSize: 12, marginTop: 4 }}>
                {modelsError}（请确认 ollama serve 已运行）
              </span>
            )}
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
          <label className="field block">
            <span>本项目术语（单位 / 班组 / 机械 / 工种，AI 优先采用）</span>
            <textarea
              rows={8}
              value={settings.glossary}
              onChange={(e) => update('glossary', e.target.value)}
              placeholder={`例如：\n总承包：中铁X局机电分公司\n分包单位：XX水暖工程公司、XX消防工程公司\n班组：水暖班、消防班、桥架班、电缆班\n常用机械：套丝机、桥架弯排机、液压钳、台钻、电焊机\n常用工种：电工、焊工、管工、消防员`}
            />
          </label>
          <p className="drawer-hint">
            术语会自动拼到 AI prompt 头部，模型优先选用你这里写的单位/班组名，不再自己编。<br />
            设置自动保存在本地。本地 Ollama 用法：先 <code>ollama serve</code>，再 <code>ollama pull qwen2.5:7b</code>。
          </p>
          </section>
        </div>
      </div>
    </>
  );
}
