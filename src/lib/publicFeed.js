// Public (reader) announcements for the Home page. Loaded with a dynamic import()
// so the landing page renders before the Firestore SDK has downloaded.
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { effectiveMillis } from '../utils/announcements';

/**
 * Every public ('reader') post, newest first (sorted client-side, so no composite index).
 * Includes scheduled/expired posts — run the result through selectLivePublic() with
 * the current clock before showing it (see Home.jsx).
 */
export async function fetchPublicAnnouncements() {
  const publicQuery = query(collection(db, 'announcements'), where('visibleTo', 'array-contains', 'reader'));
  const snapshot = await getDocs(publicQuery);
  return snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .sort((a, b) => effectiveMillis(b) - effectiveMillis(a));
}
