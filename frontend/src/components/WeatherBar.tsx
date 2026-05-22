import { useState } from 'react';
import type { Diary } from '../types';
import { api } from '../api';

interface Props {
  diary: Diary;
  onUpdate: <K extends keyof Diary>(key: K, value: Diary[K]) => void;
  onBusy: (busy: boolean, msg?: string) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export function WeatherBar({ diary, onUpdate, onBusy, onError, onSuccess }: Props) {
  const [city, setCity] = useState<string>(() => diary.city || localStorage.getItem('lastCity') || '');

  const fetchWeather = async () => {
    const keyword = city.trim();
    if (!keyword) {
      onError('请先输入城市');
      return;
    }
    onBusy(true, '正在拉取天气…');
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
      onSuccess(`已获取 ${w.city} ${w.date} 天气`);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onBusy(false);
    }
  };

  return (
    <div className="weather-bar">
      <input
        className="weather-city"
        type="text"
        placeholder="城市（如：上海）"
        value={city}
        onChange={(e) => setCity(e.target.value)}
      />
      <button className="ghost" type="button" onClick={fetchWeather}>
        拉取天气
      </button>
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
