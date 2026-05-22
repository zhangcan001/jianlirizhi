import type { DiarySummary } from '../types';

interface Props {
  list: DiarySummary[];
  currentDate: string;
  onPick: (date: string) => void;
  onDelete: (date: string) => void;
}

export function HistoryList({ list, currentDate, onPick, onDelete }: Props) {
  return (
    <aside className="history">
      <div className="history-head">
        <p className="eyebrow">历史日记</p>
        <h2>{list.length} 篇</h2>
      </div>
      <ul className="history-list">
        {list.length === 0 && <li className="history-empty">暂无记录</li>}
        {list.map((item) => (
          <li
            key={item.date}
            className={`history-item${item.date === currentDate ? ' active' : ''}`}
            onClick={() => onPick(item.date)}
          >
            <div className="history-row">
              <span className="history-date">{item.date}</span>
              <span className="history-weekday">{item.weekday}</span>
            </div>
            <div className="history-title" title={item.title}>
              {item.title}
            </div>
            <button
              className="history-del"
              type="button"
              title="删除"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`确认删除 ${item.date} 的日记？`)) {
                  onDelete(item.date);
                }
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
