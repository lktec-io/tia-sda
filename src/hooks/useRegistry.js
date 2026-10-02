import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { enrichMember } from '../lib/registry';
import { logFirestoreError } from '../utils/logFirestoreError';

/**
 * Live leader view of the whole `users` collection (plain onSnapshot, no filters).
 * Returns enriched members plus load status; errors are logged and returned, never
 * thrown, and `retry()` re-subscribes.
 */
export default function useRegistry() {
  const { currentUser, userRole } = useAuth();
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadedAt, setLoadedAt] = useState(null); // ms timestamp of the latest snapshot

  useEffect(() => {
    const debug = { query: 'users (full registry)', uid: currentUser?.uid ?? null, role: userRole };

    const fail = (err) => {
      logFirestoreError('Member registry', err, debug);
      setError(err);
      setStatus('error');
    };

    let unsubscribe = () => {};

    try {
      unsubscribe = onSnapshot(
        collection(db, 'users'),
        (snapshot) => {
          try {
            setUsers(snapshot.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })));
            setLoadedAt(Date.now());
            setError(null);
            setStatus('ready');
          } catch (err) {
            fail(err);
          }
        },
        fail
      );
    } catch (err) {
      queueMicrotask(() => fail(err));
    }

    return () => unsubscribe();
  }, [reloadKey, currentUser?.uid, userRole]);

  const retry = useCallback(() => {
    setError(null);
    setStatus('loading');
    setReloadKey((n) => n + 1);
  }, []);

  const members = useMemo(() => users.map(enrichMember), [users]);

  return { members, status, error, retry, loadedAt };
}
