// Public (reader) announcements for the Home page. Loaded with a dynamic import()
// so the landing page renders before the Firestore SDK has downloaded.
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { effectiveMillis, isAnnouncementLive } from '../utils/announcements';

/**
 * Live public posts only: scheduled posts are hidden until their publish time and
 * expired posts after their expiry. Sorted client-side (no composite index needed).
 */
export async function fetchPublicAnnouncements(max) {
  const publicQuery = query(collection(db, 'announcements'), where('visibleTo', 'array-contains', 'reader'));
  const snapshot = await getDocs(publicQuery);
  const now = Date.now();

  return snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((item) => isAnnouncementLive(item, now))
    .sort((a, b) => effectiveMillis(b) - effectiveMillis(a))
    .slice(0, max);
}
