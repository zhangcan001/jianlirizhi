import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiEvent, AiMode, AiSettings, Diary, DiaryFieldKey } from '../types';
import { api } from '../api';

interface RunArgs {
  mode: AiMode;
  diary: Diary;
  settings: AiSettings;
}

interface RunCallbacks {
  onPartial?: (field: DiaryFieldKey, value: string) => void;
  onDone?: (result: Partial<Diary>, raw: string) => void;
  onError?: (message: string, raw?: string) => void;
  onAborted?: () => void;
}

export interface AiJobState {
  jobId: string | null;
  running: boolean;
  mode: AiMode | null;
  progress: string;
}

export function useAiJob() {
  const [state, setState] = useState<AiJobState>({
    jobId: null,
    running: false,
    mode: null,
    progress: '',
  });
  const cbsRef = useRef<RunCallbacks>({});
  const jobRef = useRef<string | null>(null);

  useEffect(() => {
    const off = api.onAiEvent((evt: AiEvent) => {
      if (!jobRef.current || evt.jobId !== jobRef.current) return;
      if (evt.type === 'chunk') {
        setState((s) => ({ ...s, progress: s.progress + evt.data }));
        return;
      }
      if (evt.type === 'partial') {
        cbsRef.current.onPartial?.(evt.data.field, evt.data.value);
        return;
      }
      const cbs = cbsRef.current;
      if (evt.type === 'done') {
        cbs.onDone?.(evt.data.result, evt.data.raw);
      } else if (evt.type === 'error') {
        cbs.onError?.(evt.data.message, evt.data.raw);
      } else if (evt.type === 'aborted') {
        cbs.onAborted?.();
      }
      jobRef.current = null;
      setState({ jobId: null, running: false, mode: null, progress: '' });
    });
    return off;
  }, []);

  const run = useCallback(async (args: RunArgs, callbacks: RunCallbacks) => {
    cbsRef.current = callbacks;
    setState({ jobId: null, running: true, mode: args.mode, progress: '' });
    try {
      const id = await api.startAi(args);
      jobRef.current = id;
      setState((s) => ({ ...s, jobId: id }));
    } catch (e) {
      cbsRef.current.onError?.(e instanceof Error ? e.message : String(e));
      setState({ jobId: null, running: false, mode: null, progress: '' });
    }
  }, []);

  const abort = useCallback(async () => {
    const id = jobRef.current;
    if (!id) return;
    await api.abortAi(id);
  }, []);

  return { state, run, abort };
}
