import { useCallback, useEffect, useRef, useState } from 'react';
import type { Diary } from '../types';
import { api } from '../api';

interface Props {
  diary: Diary;
  onUpdate: <K extends keyof Diary>(key: K, value: Diary[K]) => void;
  onBusy: (busy: boolean, msg?: string) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

const AUTO_KEY = 'autoFetchWeather';

export function WeatherBar({ diary, onUpdate, onBusy, onError, onSuccess }: Props) {
  const [city, setCity] = useState<string>(() => diary.city || localStorage.getItem('lastCity') || '');
  const [autoFetch, setAutoFetch] = useState<boolean>(() => localStorage.getItem(AUTO_KEY) === '1');
  const lastFetchedRef = useRef<string>('');
  const fetchingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(AUTO_KEY, autoFetch ? '1' : '0');
  }, [autoFetch]);

  const doFetch = useCallback(
    async (silent = false) => {
      const keyword = city.trim();
      if (!keyword) {
        if (!silent) onError('请先输入城市');
        return;
      }
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      if (!silent) onBusy(true, '正在拉取天气…');
      try {
        const w = await api.fetchWeather({ city: keyword, date: diary.date });
        onUpdate('city', keyword);
        onUpdate('weatherMorning', w.weatherMorning);
        onUpdate('weatherAfternoon', w.weatherAfternoon);
        onUpdate('temperature', w.temperature);
        onUpdate('humidity', w.humidity);
        onUpdate('windDirection', w.windDirection);
        onUpdate('windPower', w.windPower);
        localStorage.setItem('lastCity', keyword);
        if (!silent) onSuccess(`已获取 ${w.city} ${w.date} 天气`);
      } catch (e) {
        if (!silent) onError(e instanceof Error ? e.message : String(e));
        else console.warn('自动拉取天气失败：', e);
      } finally {
        fetchingRef.current = false;
        if (!silent) onBusy(false);
      }
    },
    [city, diary.date, onUpdate, onBusy, onError, onSuccess],
  );

  useEffect(() => {
    if (!autoFetch) return;
    if (!diary.date) return;
    if (!city.trim()) return;
    if (lastFetchedRef.current === diary.date) return;
    if (diary.weatherMorning || diary.weatherAfternoon) {
      lastFetchedRef.current = diary.date;
      return;
    }
    lastFetchedRef.current = diary.date;
    void doFetch(true);
  }, [autoFetch, diary.date, diary.weatherMorning, diary.weatherAfternoon, city, doFetch]);

  return (
    <div className="weather-bar">
      <input
        className="weather-city"
        type="text"
        placeholder="城市（如：上海）"
        value={city}
        onChange={(e) => setCity(e.target.value)}
      />
      <button className="ghost" type="button" onClick={() => doFetch(false)}>
        拉取天气
      </button>
      <label className="weather-auto" title="切日期时若该天无天气则自动拉取">
        <input type="checkbox" checked={autoFetch} onChange={(e) => setAutoFetch(e.target.checked)} />
        <span>自动</span>
      </label>
      <div className="weather-preview">
        <span>上午 {diary.weatherMorning || '—'}</span>
        <span>下午 {diary.weatherAfternoon || '—'}</span>
        <span>温 {diary.temperature || '—'}</span>
        <span>湿 {diary.humidity || '—'}</span>
        <span>{diary.windDirection || '—'}风</span>
        <span>{diary.windPower || '—'} 级</span>
      </div>
    </div>
  );
}
