// Public (reader) announcements for the Home page. Loaded with a dynamic import()
// so the landing page renders before the Firestore SDK has downloaded.
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { toMillis } from '../utils/format';

export async function fetchPublicAnnouncements(max) {
  // Sorted client-side so no composite Firestore index is required.
  const publicQuery = query(collection(db, 'announcements'), where('visibleTo', 'array-contains', 'reader'));
  const snapshot = await getDocs(publicQuery);

  return snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .sort((a, b) => toMillis(b.publishedAt || b.createdAt) - toMillis(a.publishedAt || a.createdAt))
    .slice(0, max);
}
