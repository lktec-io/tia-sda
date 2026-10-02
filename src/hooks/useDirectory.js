import { useCallback, useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { DIRECTORY_COLLECTION, byName } from '../lib/directory';
import { logFirestoreError } from '../utils/logFirestoreError';

/**
 * Live Flock Directory for non-leaders: reads the `directory` collection, which only
 * ever contains photo, name, course and ministry wing. Sorted A–Z.
 */
export default function useDirectory({ enabled = true } = {}) {
  const { currentUser } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const key = `${enabled}:${reloadKey}`;
  const [state, setState] = useState({ entries: [], status: 'loading', error: null, key });

  if (state.key !== key) {
    setState({ entries: [], status: 'loading', error: null, key });
  }

  useEffect(() => {
    if (!enabled) return undefined;
    const subKey = `${enabled}:${reloadKey}`;

    const fail = (error) => {
      logFirestoreError('Flock directory', error, { query: DIRECTORY_COLLECTION, uid: currentUser?.uid ?? null });
      setState({ entries: [], status: 'error', error, key: subKey });
    };

    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(
        collection(db, DIRECTORY_COLLECTION),
        (snapshot) => {
          const entries = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byName);
          setState({ entries, status: 'ready', error: null, key: subKey });
        },
        fail
      );
    } catch (error) {
      queueMicrotask(() => fail(error));
    }

    return () => unsubscribe();
  }, [enabled, reloadKey, currentUser?.uid]);

  const retry = useCallback(() => setReloadKey((n) => n + 1), []);

  return { entries: state.entries, status: state.status, error: state.error, retry };
}
