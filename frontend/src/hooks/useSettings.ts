import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiSettings } from '../types';
import { DEFAULT_AI_SETTINGS } from '../constants';
import { api } from '../api';

const KEY = 'aiSettings';
const SECRET_NAME = 'apiKey';

function loadFromLocalStorage(): AiSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_AI_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_AI_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

function persistNonSecret(settings: AiSettings) {
  try {
    const { apiKey: _ignored, ...rest } = settings;
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch (e) {
    console.error('persist settings failed', e);
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<AiSettings>(() => ({
    ...loadFromLocalStorage(),
    apiKey: '',
  }));
  const hydratedRef = useRef(false);
  const lastSavedKeyRef = useRef<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let secret = '';
      try {
        const r = await api.getSecret(SECRET_NAME);
        if (r.ok && typeof r.value === 'string') secret = r.value;
      } catch (e) {
        console.error('load apiKey from safeStorage failed', e);
      }

      // 迁移：若 localStorage 里还残留 apiKey（旧版），搬到 safeStorage 再清掉
      let migrated = '';
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.apiKey === 'string' && parsed.apiKey) {
            migrated = parsed.apiKey;
            delete parsed.apiKey;
            localStorage.setItem(KEY, JSON.stringify(parsed));
          }
        }
      } catch {
        /* ignore */
      }

      if (migrated && !secret) {
        try {
          await api.setSecret(SECRET_NAME, migrated);
          secret = migrated;
        } catch (e) {
          console.error('migrate apiKey failed', e);
        }
      }

      if (cancelled) return;
      lastSavedKeyRef.current = secret;
      setSettings((prev) => ({ ...prev, apiKey: secret }));
      hydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    persistNonSecret(settings);
  }, [settings]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (settings.apiKey === lastSavedKeyRef.current) return;
    const value = settings.apiKey;
    lastSavedKeyRef.current = value;
    const t = window.setTimeout(() => {
      api.setSecret(SECRET_NAME, value).catch((e) => {
        console.error('save apiKey failed', e);
      });
    }, 250);
    return () => window.clearTimeout(t);
  }, [settings.apiKey]);

  const update = useCallback(<K extends keyof AiSettings>(key: K, value: AiSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  return { settings, setSettings, update };
}
