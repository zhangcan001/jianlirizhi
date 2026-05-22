import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DiarySummary } from '../types';
import { api } from '../api';

interface Props {
  list: DiarySummary[];
  currentDate: string;
  onPick: (date: string) => void;
  onDelete: (date: string) => void;
}

const FIELD_LABELS: Record<string, string> = {
  constructionStatus: '施工情况',
  inspectionWork: '巡视检查',
  contractorPersonnel: '人员投入',
  machinery: '机械投入',
  materialAcceptance: '材料验收',
  acceptanceWork: '验收工作',
  standingWork: '旁站工作',
  meeting: '会议',
  internalWork: '内业工作',
  issuesAndActions: '问题与措施',
  otherMatters: '其他事项',
  chiefEngineerComments: '总工评语',
  specialistSupervisorComments: '专监评语',
  writer: '填写人',
  city: '城市',
};

function renderHighlighted(text: string, query: string): ReactNode {
  if (!query) return text;
  const q = query.trim();
  if (!q) return text;
  const parts: ReactNode[] = [];
  const lower = text.toLowerCase();
  const lq = q.toLowerCase();
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const idx = lower.indexOf(lq, i);
    if (idx < 0) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(<mark key={key++}>{text.slice(idx, idx + q.length)}</mark>);
    i = idx + q.length;
  }
  return parts;
}

export function HistoryList({ list, currentDate, onPick, onDelete }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DiarySummary[] | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    const onFocusSearch = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('app:focus-search', onFocusSearch);
    return () => window.removeEventListener('app:focus-search', onFocusSearch);
  }, []);

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
          ref={inputRef}
          type="search"
          value={query}
          placeholder="搜索内容/工种/单位…（Ctrl+F）"
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
              {renderHighlighted(item.title, item.query || '')}
            </div>
            {item.snippet && (
              <div className="history-snippet">
                <span className="history-snippet-field">{FIELD_LABELS[item.snippetField || ''] || ''}</span>
                <span>{renderHighlighted(item.snippet, item.query || '')}</span>
              </div>
            )}
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
