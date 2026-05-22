import { useCallback, useMemo, useState } from 'react';
import { useDiaryStore } from './hooks/useDiaryStore';
import { useSettings } from './hooks/useSettings';
import { useProject } from './hooks/useProject';
import { HistoryList } from './components/HistoryList';
import { DiaryForm } from './components/DiaryForm';
import { DiaryPreview } from './components/DiaryPreview';
import { SettingsDrawer } from './components/SettingsDrawer';
import { Notice } from './components/Notice';
import { api } from './api';

export type NoticeState =
  | { kind: 'idle' }
  | { kind: 'busy'; message: string }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

export function App() {
  const { project, update: updateProject } = useProject();
  const store = useDiaryStore({ writer: project.writer });
  const { settings, update: updateSetting } = useSettings();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notice, setNotice] = useState<NoticeState>({ kind: 'idle' });

  const mergedSettings = useMemo(() => {
    const projectLines: string[] = [];
    if (project.projectName) projectLines.push(`工程名称：${project.projectName}`);
    if (project.buildUnit) projectLines.push(`建设单位：${project.buildUnit}`);
    if (project.contractorUnit) projectLines.push(`总承包：${project.contractorUnit}`);
    if (project.supervisorUnit) projectLines.push(`监理单位：${project.supervisorUnit}`);
    if (project.chiefSupervisor) projectLines.push(`总监理工程师：${project.chiefSupervisor}`);
    if (projectLines.length === 0) return settings;
    const preamble = `【项目档案】\n${projectLines.join('\n')}\n`;
    return { ...settings, glossary: settings.glossary ? `${preamble}\n${settings.glossary}` : preamble };
  }, [settings, project]);

  const flash = useCallback((next: NoticeState, ms = 2400) => {
    setNotice(next);
    if (next.kind !== 'idle' && next.kind !== 'busy') {
      window.setTimeout(() => {
        setNotice((cur) => (cur === next ? { kind: 'idle' } : cur));
      }, ms);
    }
  }, []);

  const onBusy = useCallback(
    (busy: boolean, msg?: string) => {
      if (busy) setNotice({ kind: 'busy', message: msg || '处理中…' });
      else setNotice({ kind: 'idle' });
    },
    [],
  );

  const onError = useCallback((msg: string) => flash({ kind: 'error', message: msg }, 4000), [flash]);
  const onSuccess = useCallback((msg: string) => flash({ kind: 'success', message: msg }), [flash]);

  const handleSave = async () => {
    onBusy(true, '保存中…');
    try {
      await store.save();
      onSuccess('已保存');
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      if (notice.kind === 'busy') setNotice({ kind: 'idle' });
    }
  };

  const handleExport = async () => {
    onBusy(true, '导出 docx…');
    try {
      const res = await api.exportDocx(store.diary);
      if (res.canceled) {
        setNotice({ kind: 'idle' });
      } else {
        onSuccess(`已导出：${res.filePath}`);
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleExportToDir = async () => {
    let dir = localStorage.getItem('exportDir') || '';
    if (!dir) {
      const pick = await api.selectExportDir();
      if (pick.canceled || !pick.dir) return;
      dir = pick.dir;
      localStorage.setItem('exportDir', dir);
    }
    onBusy(true, '导出 docx 到目录…');
    try {
      const res = await api.exportDocxToDir({ ...store.diary, exportDir: dir });
      if (res.canceled) {
        setNotice({ kind: 'idle' });
      } else {
        onSuccess(`已导出：${res.filePath}`);
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleChangeExportDir = async () => {
    const pick = await api.selectExportDir();
    if (!pick.canceled && pick.dir) {
      localStorage.setItem('exportDir', pick.dir);
      onSuccess(`导出目录：${pick.dir}`);
    }
  };

  const handleExportMonth = async () => {
    const defaultMonth = (store.diary.date || new Date().toISOString().slice(0, 10)).slice(0, 7);
    const input = window.prompt('输入要导出的月份（YYYY-MM）', defaultMonth);
    if (!input) return;
    const month = input.trim();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      onError('月份格式应为 YYYY-MM');
      return;
    }
    let dir = localStorage.getItem('exportDir') || undefined;
    onBusy(true, `批量导出 ${month}…`);
    try {
      const res = await api.exportMonth({ month, exportDir: dir });
      if (res.canceled) {
        setNotice({ kind: 'idle' });
        return;
      }
      if (res.dir) localStorage.setItem('exportDir', res.dir);
      if ((res.count ?? 0) === 0) {
        onError(`${month} 没有日志记录`);
        return;
      }
      const errs = res.errors?.length ? `，${res.errors.length} 条失败` : '';
      onSuccess(`已导出 ${res.count} 篇到 ${res.dir}${errs}`);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">监</div>
          <div>
            <p className="eyebrow">个人监理日记</p>
            <h1>监理日记生成器</h1>
          </div>
        </div>
        <div className="actions">
          {store.aiSnapshot && store.aiSnapshot.date === store.diary.date && (
            <button
              className="ghost"
              type="button"
              title="撤销最近一次 AI 覆写"
              onClick={() => {
                store.undoAi();
                onSuccess('已撤销 AI 覆写');
              }}
            >
              ↺ 撤销 AI
            </button>
          )}
          <button className="ghost" type="button" onClick={handleChangeExportDir}>
            导出目录…
          </button>
          <button className="ghost" type="button" onClick={handleExportToDir}>
            导出到目录
          </button>
          <button className="ghost" type="button" onClick={handleExportMonth} title="按月批量导出">
            导出本月
          </button>
          <button className="ghost" type="button" onClick={handleExport}>
            导出 docx
          </button>
          <button className="primary" type="button" onClick={handleSave}>
            {store.dirty ? '保存 *' : '保存'}
          </button>
          <button className="ghost" type="button" title="AI 设置" onClick={() => setDrawerOpen(true)}>
            ⚙ 设置
          </button>
        </div>
      </header>

      <Notice state={notice} />

      {store.pendingDraft && (
        <div className="draft-banner">
          <div>
            <strong>检测到未保存草稿</strong>
            <span className="draft-time">
              草稿时间 {store.pendingDraft.updatedAt.replace('T', ' ').slice(0, 19)}
              {store.pendingDraft.savedUpdatedAt
                ? `，已保存版本 ${store.pendingDraft.savedUpdatedAt.replace('T', ' ').slice(0, 19)}`
                : '，尚未保存过'}
            </span>
          </div>
          <div className="draft-actions">
            <button
              className="primary"
              type="button"
              onClick={() => {
                void store.acceptDraft();
                onSuccess('已恢复草稿（仍需点保存才会写入）');
              }}
            >
              恢复草稿
            </button>
            <button
              className="ghost"
              type="button"
              onClick={() => {
                void store.discardDraft();
                onSuccess('已丢弃草稿');
              }}
            >
              丢弃
            </button>
          </div>
        </div>
      )}

      <div className="workspace">
        <HistoryList
          list={store.list}
          currentDate={store.currentDate}
          onPick={(d) => store.setCurrentDate(d)}
          onDelete={(d) => void store.remove(d)}
        />
        <DiaryForm
          diary={store.diary}
          settings={mergedSettings}
          onUpdate={store.updateField}
          replaceDiary={store.replaceDiary}
          snapshotAiFields={store.snapshotAiFields}
          onBusy={onBusy}
          onError={onError}
          onSuccess={onSuccess}
        />
        <DiaryPreview diary={store.diary} />
      </div>

      <SettingsDrawer
        open={drawerOpen}
        settings={settings}
        update={updateSetting}
        project={project}
        updateProject={updateProject}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
