import { useCallback, useEffect, useState } from 'react';
import type { ProjectProfile } from '../types';
import { DEFAULT_PROJECT_PROFILE } from '../constants';

const KEY = 'projectProfile';

function load(): ProjectProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PROJECT_PROFILE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PROJECT_PROFILE, ...parsed };
  } catch {
    return { ...DEFAULT_PROJECT_PROFILE };
  }
}

export function useProject() {
  const [project, setProject] = useState<ProjectProfile>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(project));
    } catch (e) {
      console.error('persist project profile failed', e);
    }
  }, [project]);

  const update = useCallback(<K extends keyof ProjectProfile>(key: K, value: ProjectProfile[K]) => {
    setProject((prev) => ({ ...prev, [key]: value }));
  }, []);

  return { project, setProject, update };
}
