import { useCallback, useEffect, useState } from 'react';
import type { Diary, DiarySummary } from '../types';
import { emptyDiary, todayIso, weekdayOf } from '../constants';
import { api } from '../api';

export function useDiaryStore() {
  const [currentDate, setCurrentDate] = useState<string>(todayIso());
  const [diary, setDiary] = useState<Diary>(() => emptyDiary(todayIso()));
  const [list, setList] = useState<DiarySummary[]>([]);
  const [dirty, setDirty] = useState(false);

  const refreshList = useCallback(async () => {
    try {
      const next = await api.listDiaries();
      setList(next);
    } catch (e) {
      console.error('list diaries failed', e);
    }
  }, []);

  const loadDate = useCallback(async (date: string) => {
    const existing = await api.getDiary(date);
    if (existing) {
      setDiary({ ...emptyDiary(date), ...existing, date, weekday: existing.weekday || weekdayOf(date) });
    } else {
      setDiary(emptyDiary(date));
    }
    setDirty(false);
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    void loadDate(currentDate);
  }, [currentDate, loadDate]);

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
    return res.diary;
  }, [diary]);

  const remove = useCallback(
    async (date: string) => {
      await api.deleteDiary(date);
      await refreshList();
      if (date === currentDate) {
        setCurrentDate(todayIso());
      }
    },
    [currentDate, refreshList],
  );

  return {
    currentDate,
    setCurrentDate,
    diary,
    setDiary,
    updateField,
    replaceDiary,
    list,
    refreshList,
    save,
    remove,
    dirty,
  };
}
