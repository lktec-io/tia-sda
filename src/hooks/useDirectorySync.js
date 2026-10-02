import { useEffect } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DIRECTORY_COLLECTION, directoryEntryFrom, isDirectoryEntryCurrent } from '../lib/directory';
import { logFirestoreError } from '../utils/logFirestoreError';

/**
 * Keeps the signed-in user's own Flock Directory card in step with their profile.
 * Runs once per profile change while the portal is open; writes only when the
 * stored card differs. New registrations and legacy accounts get their card on
 * their first portal visit. Failures are logged and never block the portal.
 */
export default function useDirectorySync(userProfile) {
  const entry = userProfile?.uid ? directoryEntryFrom(userProfile) : null;
  // Primitive signature so the effect only re-runs when a synced field changes.
  const signature = entry ? JSON.stringify(entry) : '';

  useEffect(() => {
    if (!signature) return undefined;
    const next = JSON.parse(signature);
    let cancelled = false;

    (async () => {
      try {
        const ref = doc(db, DIRECTORY_COLLECTION, next.uid);
        const snap = await getDoc(ref);
        if (cancelled || isDirectoryEntryCurrent(snap.data(), next)) return;
        await setDoc(ref, { ...next, updatedAt: serverTimestamp() });
      } catch (error) {
        logFirestoreError('Directory sync', error, { uid: next.uid });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signature]);
}
