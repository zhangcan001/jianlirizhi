import { useEffect, useRef, useState } from 'react';
import type { DiaryFieldKey, FieldHistoryItem } from '../types';
import { api } from '../api';

interface Props {
  field: DiaryFieldKey;
  onPick: (value: string) => void;
}

export function FieldHistoryButton({ field, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<FieldHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    api
      .getFieldHistory({ field, limit: 8 })
      .then((res) => {
        if (res.ok) setItems(res.items);
        else {
          setError(res.error || '加载失败');
          setItems([]);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [open, field]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (popoverRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className="field-history">
      <button
        ref={btnRef}
        type="button"
        className="field-history-trigger"
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        title="使用历史记录填入"
      >
        📋 历史
      </button>
      {open && (
        <div ref={popoverRef} className="field-history-popover">
          {loading && <div className="field-history-empty">加载中…</div>}
          {!loading && error && <div className="field-history-empty">{error}</div>}
          {!loading && !error && items.length === 0 && (
            <div className="field-history-empty">还没有历史记录</div>
          )}
          {!loading && !error && items.length > 0 && (
            <ul className="field-history-list">
              {items.map((it) => (
                <li key={it.date}>
                  <button
                    type="button"
                    className="field-history-item"
                    onClick={() => {
                      onPick(it.value);
                      setOpen(false);
                    }}
                  >
                    <span className="field-history-date">{it.date}</span>
                    <span className="field-history-preview">
                      {it.value.split(/\r?\n/).slice(0, 4).join(' / ').slice(0, 120)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </span>
  );
}
