import { useCallback, useState } from 'react';

const STORAGE_PREFIX = 'tucasa:view:';
const MODES = ['grid', 'list'];

const readStored = (key, fallback) => {
  try {
    const value = window.localStorage.getItem(STORAGE_PREFIX + key);
    return MODES.includes(value) ? value : fallback;
  } catch {
    return fallback; // private mode / blocked storage
  }
};

/**
 * 'grid' | 'list' layout preference for one listing (e.g. 'home-feed', 'directory').
 * Remembered per browser as a convenience; works normally when storage is unavailable.
 */
export default function useViewMode(key, fallback = 'grid') {
  const [mode, setMode] = useState(() => readStored(key, fallback));

  const changeMode = useCallback(
    (next) => {
      if (!MODES.includes(next)) return;
      setMode(next);
      try {
        window.localStorage.setItem(STORAGE_PREFIX + key, next);
      } catch {
        // Preference just won't persist.
      }
    },
    [key]
  );

  return [mode, changeMode];
}
