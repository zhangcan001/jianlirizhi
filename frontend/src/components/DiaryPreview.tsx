import type { Diary } from '../types';
import { FIELD_DEFS } from '../constants';

export function DiaryPreview({ diary }: { diary: Diary }) {
  const lines: string[] = [];
  lines.push(`日期：${diary.date}  ${diary.weekday}`);
  lines.push(`填写人：${diary.writer || '（未填）'}`);
  lines.push('');
  lines.push(
    `天气：上午 ${diary.weatherMorning || '—'}  下午 ${diary.weatherAfternoon || '—'}` +
      `  气温 ${diary.temperature || '—'}  湿度 ${diary.humidity || '—'}` +
      `  ${diary.windDirection || '—'}风 ${diary.windPower || '—'} 级`,
  );
  lines.push('');
  for (const f of FIELD_DEFS) {
    lines.push(`【${f.label}】`);
    lines.push(diary[f.key] || '（空）');
    lines.push('');
  }
  if (diary.specialistSupervisorComments) {
    lines.push('【专业监理工程师评语】');
    lines.push(diary.specialistSupervisorComments);
    lines.push('');
  }
  if (diary.chiefEngineerComments) {
    lines.push('【总监理工程师评语】');
    lines.push(diary.chiefEngineerComments);
  }

  return (
    <aside className="preview">
      <div className="preview-head">
        <p className="eyebrow">实时预览</p>
        <h2>{diary.date}</h2>
      </div>
      <pre>{lines.join('\n')}</pre>
    </aside>
  );
}
