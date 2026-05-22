import { useCallback, useEffect, useState } from 'react';
import type { AiSettings } from '../types';
import { DEFAULT_AI_SETTINGS } from '../constants';

const KEY = 'aiSettings';

function load(): AiSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_AI_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_AI_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<AiSettings>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('persist settings failed', e);
    }
  }, [settings]);

  const update = useCallback(<K extends keyof AiSettings>(key: K, value: AiSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  return { settings, setSettings, update };
}
