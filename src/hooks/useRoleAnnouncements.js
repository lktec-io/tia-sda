import { useCallback, useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toMillis } from '../utils/format';
import { logFirestoreError } from '../utils/logFirestoreError';

/**
 * Live announcement feed for the signed-in user.
 * - member / associate / reader: only posts whose visibleTo array contains their role.
 * - leaders: every post, so they can review what each audience sees.
 * Sorted newest-first on the client so no composite index is required.
 *
 * Errors never throw into the component tree: they are logged and returned as
 * `status: 'error'`, and `retry()` re-subscribes.
 */
export default function useRoleAnnouncements() {
  const { feedRole, currentUser } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const subscriptionKey = `${feedRole ?? 'none'}:${reloadKey}`;

  const [state, setState] = useState({ items: [], status: 'loading', error: null, key: subscriptionKey });

  // Reset to loading when the audience changes or a retry is requested
  // (derived during render, not inside the effect).
  if (state.key !== subscriptionKey) {
    setState({ items: [], status: 'loading', error: null, key: subscriptionKey });
  }

  useEffect(() => {
    if (!feedRole) return undefined;

    const key = `${feedRole}:${reloadKey}`;
    const debug = { query: 'announcements', feedRole, uid: currentUser?.uid ?? null };

    const fail = (error) => {
      logFirestoreError('Announcement feed', error, debug);
      setState({ items: [], status: 'error', error, key });
    };

    let unsubscribe = () => {};

    try {
      const announcementsRef = collection(db, 'announcements');
      const feedQuery =
        feedRole === 'leader'
          ? announcementsRef
          : query(announcementsRef, where('visibleTo', 'array-contains', feedRole));

      unsubscribe = onSnapshot(
        feedQuery,
        (snapshot) => {
          try {
            const items = snapshot.docs
              .map((docSnap) => ({
                id: docSnap.id,
                // 'estimate' gives freshly published posts a local time until the server confirms.
                ...docSnap.data({ serverTimestamps: 'estimate' })
              }))
              .sort((a, b) => toMillis(b.publishedAt) - toMillis(a.publishedAt));
            setState({ items, status: 'ready', error: null, key });
          } catch (error) {
            fail(error);
          }
        },
        fail
      );
    } catch (error) {
      // Synchronous setup failure (e.g. SDK not initialised) — report asynchronously
      // so the effect body itself never sets state.
      queueMicrotask(() => fail(error));
    }

    return () => unsubscribe();
  }, [feedRole, reloadKey, currentUser?.uid]);

  const retry = useCallback(() => setReloadKey((n) => n + 1), []);

  return { announcements: state.items, status: state.status, error: state.error, retry };
}
