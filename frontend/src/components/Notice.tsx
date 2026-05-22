import type { NoticeState } from '../App';

export function Notice({ state }: { state: NoticeState }) {
  if (state.kind === 'idle') return null;
  const cls = `notice ${state.kind === 'busy' ? 'busy' : state.kind === 'success' ? 'success' : 'error'}`;
  return (
    <div className={cls} role="status">
      {state.kind === 'busy' ? <span className="spinner" /> : <span className="notice-dot" />}
      <strong>{state.message}</strong>
    </div>
  );
}
