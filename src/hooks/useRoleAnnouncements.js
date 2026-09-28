import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toMillis } from '../utils/format';

/**
 * Live announcement feed for the signed-in user.
 * - member / associate / reader: only posts whose visibleTo array contains their role.
 * - leaders: every post, so they can review what each audience sees.
 * Sorted newest-first on the client so no composite index is required.
 */
export default function useRoleAnnouncements() {
  const { feedRole } = useAuth();
  const [state, setState] = useState({ items: [], status: 'loading', error: null, role: feedRole });

  // Reset to loading when the audience changes (derived during render, not in the effect).
  if (state.role !== feedRole) {
    setState({ items: [], status: 'loading', error: null, role: feedRole });
  }

  useEffect(() => {
    if (!feedRole) return undefined;

    const announcementsRef = collection(db, 'announcements');
    const feedQuery =
      feedRole === 'leader'
        ? announcementsRef
        : query(announcementsRef, where('visibleTo', 'array-contains', feedRole));

    const unsubscribe = onSnapshot(
      feedQuery,
      (snapshot) => {
        const items = snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            // 'estimate' gives freshly published posts a local time until the server confirms.
            ...docSnap.data({ serverTimestamps: 'estimate' })
          }))
          .sort((a, b) => toMillis(b.publishedAt) - toMillis(a.publishedAt));
        setState({ items, status: 'ready', error: null, role: feedRole });
      },
      (error) => {
        console.error('Announcement feed error:', error);
        setState({ items: [], status: 'error', error, role: feedRole });
      }
    );

    return unsubscribe;
  }, [feedRole]);

  return { announcements: state.items, status: state.status, error: state.error };
}
