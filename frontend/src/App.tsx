import { useCallback, useState } from 'react';
import { useDiaryStore } from './hooks/useDiaryStore';
import { useSettings } from './hooks/useSettings';
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
  const store = useDiaryStore();
  const { settings, update: updateSetting } = useSettings();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notice, setNotice] = useState<NoticeState>({ kind: 'idle' });

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
          <button className="ghost" type="button" onClick={handleChangeExportDir}>
            导出目录…
          </button>
          <button className="ghost" type="button" onClick={handleExportToDir}>
            导出到目录
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

      <div className="workspace">
        <HistoryList
          list={store.list}
          currentDate={store.currentDate}
          onPick={(d) => store.setCurrentDate(d)}
          onDelete={(d) => void store.remove(d)}
        />
        <DiaryForm
          diary={store.diary}
          settings={settings}
          onUpdate={store.updateField}
          replaceDiary={store.replaceDiary}
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
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
