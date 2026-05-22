import type { Diary } from '../types';
import { FIELD_DEFS, weekdayOf } from '../constants';
import { WeatherBar } from './WeatherBar';
import { AiBar } from './AiBar';
import type { AiSettings } from '../types';

interface Props {
  diary: Diary;
  settings: AiSettings;
  onUpdate: <K extends keyof Diary>(key: K, value: Diary[K]) => void;
  replaceDiary: (next: Partial<Diary>) => void;
  onBusy: (busy: boolean, msg?: string) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export function DiaryForm({ diary, settings, onUpdate, replaceDiary, onBusy, onError, onSuccess }: Props) {
  return (
    <section className="form">
      <div className="panel">
        <div className="form-head">
          <label className="field">
            <span>日期</span>
            <input
              type="date"
              value={diary.date}
              onChange={(e) => {
                const next = e.target.value;
                onUpdate('date', next);
                onUpdate('weekday', weekdayOf(next));
              }}
            />
          </label>
          <label className="field">
            <span>星期</span>
            <input type="text" value={diary.weekday} readOnly />
          </label>
          <label className="field">
            <span>填写人</span>
            <input
              type="text"
              value={diary.writer}
              onChange={(e) => onUpdate('writer', e.target.value)}
            />
          </label>
        </div>

        <WeatherBar
          diary={diary}
          onUpdate={onUpdate}
          onBusy={onBusy}
          onError={onError}
          onSuccess={onSuccess}
        />

        <AiBar
          diary={diary}
          settings={settings}
          replaceDiary={replaceDiary}
          onBusy={onBusy}
          onError={onError}
          onSuccess={onSuccess}
        />
      </div>

      <div className="panel">
        {FIELD_DEFS.map((f) => (
          <label key={f.key} className="field block">
            <span>{f.label}</span>
            <textarea
              rows={f.rows}
              placeholder={f.placeholder}
              value={diary[f.key]}
              onChange={(e) => onUpdate(f.key, e.target.value)}
            />
          </label>
        ))}

        <label className="field block">
          <span>总监理工程师评语</span>
          <textarea
            rows={3}
            placeholder="可留空。由总监审阅时填写。"
            value={diary.chiefEngineerComments}
            onChange={(e) => onUpdate('chiefEngineerComments', e.target.value)}
          />
        </label>
      </div>
    </section>
  );
}
