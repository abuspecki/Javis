import { useEffect, useState } from 'react';

const PREFIX = 'jarvis.';

/** useState that persists to localStorage. Silently degrades if storage is unavailable. */
export function usePersistentState<T>(key: string, initial: T | (() => T), enabled = true) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw != null) return JSON.parse(raw) as T;
    } catch { /* ignore corrupt or unavailable storage */ }
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });
  useEffect(() => {
    if (!enabled) return;
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* quota */ }
  }, [key, value, enabled]);
  return [value, setValue] as const;
}
