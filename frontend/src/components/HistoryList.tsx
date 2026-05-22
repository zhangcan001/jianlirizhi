import { useEffect, useMemo, useState } from 'react';
import type { DiarySummary } from '../types';
import { api } from '../api';

interface Props {
  list: DiarySummary[];
  currentDate: string;
  onPick: (date: string) => void;
  onDelete: (date: string) => void;
}

export function HistoryList({ list, currentDate, onPick, onDelete }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DiarySummary[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = window.setTimeout(() => {
      api
        .searchDiaries({ query: q, limit: 100 })
        .then((rows) => setResults(rows))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 220);
    return () => window.clearTimeout(t);
  }, [query]);

  const displayed = useMemo(() => results ?? list, [results, list]);
  const header = results === null ? `${list.length} 篇` : `${displayed.length} 条匹配`;

  return (
    <aside className="history">
      <div className="history-head">
        <p className="eyebrow">历史日记</p>
        <h2>{header}</h2>
      </div>
      <div className="history-search">
        <input
          type="search"
          value={query}
          placeholder="搜索内容/工种/单位…"
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button className="history-search-clear" type="button" title="清除" onClick={() => setQuery('')}>
            ×
          </button>
        )}
      </div>
      <ul className="history-list">
        {displayed.length === 0 && (
          <li className="history-empty">{searching ? '搜索中…' : results === null ? '暂无记录' : '无匹配'}</li>
        )}
        {displayed.map((item) => (
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
