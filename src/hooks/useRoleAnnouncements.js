import { useCallback, useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { logFirestoreError } from '../utils/logFirestoreError';
import { effectiveMillis, isAnnouncementLive, isRecentAnnouncement } from '../utils/announcements';

const RECHECK_MS = 60 * 1000; // re-evaluate schedule/expiry once a minute

/**
 * Derives what the user sees from the raw snapshot at time `now`:
 * leaders see every post (incl. scheduled/expired, flagged in the UI);
 * everyone else only sees posts that are live (past scheduledAt, before expiresAt).
 */
function derive(raw, isLeaderFeed, now) {
  const items = isLeaderFeed ? raw : raw.filter((item) => isAnnouncementLive(item, now));
  const recentCount = items.filter((item) => isRecentAnnouncement(item, now)).length;
  return { items, recentCount, now };
}

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

  const [state, setState] = useState({ raw: [], items: [], status: 'loading', error: null, key: subscriptionKey });

  // Reset to loading when the audience changes or a retry is requested
  // (derived during render, not inside the effect).
  if (state.key !== subscriptionKey) {
    setState({ raw: [], items: [], status: 'loading', error: null, key: subscriptionKey });
  }

  // Scheduled posts appear and expired posts disappear on time while the page is open.
  useEffect(() => {
    const isLeaderFeed = feedRole === 'leader';
    const timer = setInterval(() => {
      setState((prev) => (prev.status === 'ready' ? { ...prev, ...derive(prev.raw, isLeaderFeed, Date.now()) } : prev));
    }, RECHECK_MS);
    return () => clearInterval(timer);
  }, [feedRole]);

  useEffect(() => {
    if (!feedRole) return undefined;

    const key = `${feedRole}:${reloadKey}`;
    const debug = { query: 'announcements', feedRole, uid: currentUser?.uid ?? null };

    const fail = (error) => {
      logFirestoreError('Announcement feed', error, debug);
      setState({ raw: [], items: [], status: 'error', error, key });
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
            const raw = snapshot.docs
              .map((docSnap) => ({
                id: docSnap.id,
                // 'estimate' gives freshly published posts a local time until the server confirms.
                ...docSnap.data({ serverTimestamps: 'estimate' })
              }))
              .sort((a, b) => effectiveMillis(b) - effectiveMillis(a));
            // Visibility + "new in 48 h" are evaluated when data arrives, not during render.
            setState({ raw, ...derive(raw, feedRole === 'leader', Date.now()), status: 'ready', error: null, key });
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

  return {
    announcements: state.items,
    recentCount: state.recentCount ?? 0,
    // Time the visible list was last evaluated (ms) — lets views show schedule state
    // without reading the clock during render.
    now: state.now ?? null,
    status: state.status,
    error: state.error,
    retry
  };
}
