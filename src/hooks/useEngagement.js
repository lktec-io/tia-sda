import { useCallback, useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { logFirestoreError } from '../utils/logFirestoreError';

/** "2026-10" for a Date (local calendar month). */
export const monthId = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/**
 * Live monthly engagement records for one member: users/{uid}/engagement/{YYYY-MM}.
 * Returns `records` keyed by month id, plus `loadedAt` (ms) so charts can build
 * their month window without reading the clock during render.
 */
export default function useEngagement(uid) {
  const [reloadKey, setReloadKey] = useState(0);
  const key = `${uid ?? 'none'}:${reloadKey}`;
  const [state, setState] = useState({ records: {}, status: 'loading', error: null, loadedAt: null, key });

  if (state.key !== key) {
    setState({ records: {}, status: 'loading', error: null, loadedAt: null, key });
  }

  useEffect(() => {
    if (!uid) return undefined;
    const subKey = `${uid}:${reloadKey}`;

    const fail = (error) => {
      logFirestoreError('Engagement analytics', error, { query: `users/${uid}/engagement`, uid });
      setState({ records: {}, status: 'error', error, loadedAt: null, key: subKey });
    };

    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(
        collection(db, 'users', uid, 'engagement'),
        (snapshot) => {
          const records = Object.fromEntries(snapshot.docs.map((d) => [d.id, d.data()]));
          setState({ records, status: 'ready', error: null, loadedAt: Date.now(), key: subKey });
        },
        fail
      );
    } catch (error) {
      queueMicrotask(() => fail(error));
    }

    return () => unsubscribe();
  }, [uid, reloadKey]);

  const retry = useCallback(() => setReloadKey((n) => n + 1), []);

  return { ...state, retry };
}

/** Last `count` calendar months ending at `endMs`: [{ id: '2026-10', label: 'Oct' }]. */
export function recentMonths(endMs, count = 6) {
  if (!endMs) return [];
  const end = new Date(endMs);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(end.getFullYear(), end.getMonth() - (count - 1 - i), 1);
    return { id: monthId(date), label: date.toLocaleDateString('en-GB', { month: 'short' }) };
  });
}
