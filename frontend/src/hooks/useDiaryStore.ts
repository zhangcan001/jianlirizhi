import { useCallback, useEffect, useRef, useState } from 'react';
import type { Diary, DiaryFieldKey, DiarySummary } from '../types';
import { emptyDiary, todayIso, weekdayOf } from '../constants';
import { api } from '../api';

export interface PendingDraft {
  payload: Diary;
  updatedAt: string;
  savedUpdatedAt?: string;
}

const DRAFT_DEBOUNCE_MS = 600;

const AI_FIELDS: DiaryFieldKey[] = [
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

export function useDiaryStore(defaults?: { writer?: string }) {
  const [currentDate, setCurrentDate] = useState<string>(todayIso());
  const [diary, setDiary] = useState<Diary>(() => ({ ...emptyDiary(todayIso()), writer: defaults?.writer || '' }));
  const [list, setList] = useState<DiarySummary[]>([]);
  const [dirty, setDirty] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);
  const [aiSnapshot, setAiSnapshot] = useState<{ date: string; fields: Partial<Diary>; at: string } | null>(null);
  const draftTimer = useRef<number | null>(null);
  const ignoreNextChange = useRef(true);

  const refreshList = useCallback(async () => {
    try {
      const next = await api.listDiaries();
      setList(next);
    } catch (e) {
      console.error('list diaries failed', e);
    }
  }, []);

  const loadDate = useCallback(async (date: string) => {
    ignoreNextChange.current = true;
    setAiSnapshot(null);
    const [existing, draft] = await Promise.all([api.getDiary(date), api.getDraft(date)]);
    const base = existing
      ? { ...emptyDiary(date), ...existing, date, weekday: existing.weekday || weekdayOf(date) }
      : { ...emptyDiary(date), writer: defaults?.writer || '' };
    setDiary(base);
    setDirty(false);

    if (draft) {
      const savedAt = existing?.updatedAt || '';
      const draftAt = draft.updatedAt || '';
      const draftHasContent = JSON.stringify(draft.payload) !== JSON.stringify(base);
      if (draftHasContent && (!savedAt || draftAt > savedAt)) {
        setPendingDraft({ payload: draft.payload, updatedAt: draftAt, savedUpdatedAt: savedAt });
      } else {
        setPendingDraft(null);
        await api.clearDraft(date);
      }
    } else {
      setPendingDraft(null);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    void loadDate(currentDate);
  }, [currentDate, loadDate]);

  useEffect(() => {
    if (ignoreNextChange.current) {
      ignoreNextChange.current = false;
      return;
    }
    if (!dirty) return;
    if (draftTimer.current) window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      api.saveDraft({ date: diary.date, payload: diary }).catch((e) => {
        console.error('save draft failed', e);
      });
    }, DRAFT_DEBOUNCE_MS);
    return () => {
      if (draftTimer.current) window.clearTimeout(draftTimer.current);
    };
  }, [diary, dirty]);

  const writerDefault = defaults?.writer || '';
  useEffect(() => {
    if (!writerDefault) return;
    setDiary((prev) => (prev.writer ? prev : { ...prev, writer: writerDefault }));
  }, [writerDefault]);

  const updateField = useCallback(<K extends keyof Diary>(key: K, value: Diary[K]) => {
    setDiary((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const replaceDiary = useCallback((next: Partial<Diary>) => {
    setDiary((prev) => ({ ...prev, ...next }));
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    const payload = { ...diary, weekday: diary.weekday || weekdayOf(diary.date) };
    const res = await api.saveDiary(payload);
    setList(res.list);
    setDirty(false);
    await api.clearDraft(diary.date);
    setPendingDraft(null);
    return res.diary;
  }, [diary]);

  const remove = useCallback(
    async (date: string) => {
      await api.deleteDiary(date);
      await api.clearDraft(date);
      await refreshList();
      if (date === currentDate) {
        setCurrentDate(todayIso());
      }
    },
    [currentDate, refreshList],
  );

  const acceptDraft = useCallback(async () => {
    if (!pendingDraft) return;
    ignoreNextChange.current = true;
    setDiary({
      ...emptyDiary(currentDate),
      ...pendingDraft.payload,
      date: currentDate,
      weekday: pendingDraft.payload.weekday || weekdayOf(currentDate),
    });
    setDirty(true);
    setPendingDraft(null);
  }, [pendingDraft, currentDate]);

  const discardDraft = useCallback(async () => {
    if (!pendingDraft) return;
    await api.clearDraft(currentDate);
    setPendingDraft(null);
  }, [pendingDraft, currentDate]);

  const snapshotAiFields = useCallback(() => {
    const snap: Partial<Diary> = {};
    for (const k of AI_FIELDS) {
      snap[k] = diary[k];
    }
    setAiSnapshot({ date: diary.date, fields: snap, at: new Date().toISOString() });
  }, [diary]);

  const undoAi = useCallback(() => {
    if (!aiSnapshot) return;
    if (aiSnapshot.date !== diary.date) {
      setAiSnapshot(null);
      return;
    }
    setDiary((prev) => ({ ...prev, ...aiSnapshot.fields }));
    setDirty(true);
    setAiSnapshot(null);
  }, [aiSnapshot, diary.date]);

  return {
    currentDate,
    setCurrentDate,
    diary,
    setDiary,
    updateField,
    replaceDiary,
    list,
    refreshList,
    reload: () => loadDate(currentDate),
    save,
    remove,
    dirty,
    pendingDraft,
    acceptDraft,
    discardDraft,
    aiSnapshot,
    snapshotAiFields,
    undoAi,
  };
}
