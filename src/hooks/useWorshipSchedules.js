import { useCallback, useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { WORSHIP_COLLECTION } from '../lib/worship';
import { logFirestoreError } from '../utils/logFirestoreError';

const RECHECK_MS = 10 * 60 * 1000; // roll "this week" over at midnight Saturday→Sunday

/**
 * Live worship rosters from `worshipSchedules`, sorted by sabatoDate (newest first).
 * `now` is the device clock at the last snapshot / periodic re-check, so views can
 * work out the current week without reading the clock during render.
 */
export default function useWorshipSchedules() {
  const { currentUser } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ rosters: [], status: 'loading', error: null, now: null, key: reloadKey });

  if (state.key !== reloadKey) {
    setState({ rosters: [], status: 'loading', error: null, now: null, key: reloadKey });
  }

  useEffect(() => {
    const timer = setInterval(() => setState((prev) => ({ ...prev, now: Date.now() })), RECHECK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const key = reloadKey;
    const fail = (error) => {
      logFirestoreError('Worship roster', error, { query: WORSHIP_COLLECTION, uid: currentUser?.uid ?? null });
      setState({ rosters: [], status: 'error', error, now: Date.now(), key });
    };

    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(
        query(collection(db, WORSHIP_COLLECTION), orderBy('sabatoDate', 'desc')),
        (snapshot) => {
          const rosters = snapshot.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
          setState({ rosters, status: 'ready', error: null, now: Date.now(), key });
        },
        fail
      );
    } catch (error) {
      queueMicrotask(() => fail(error));
    }

    return () => unsubscribe();
  }, [reloadKey, currentUser?.uid]);

  const retry = useCallback(() => setReloadKey((n) => n + 1), []);

  return { rosters: state.rosters, status: state.status, error: state.error, now: state.now, retry };
}
