// Auth/session helpers. Loaded with a dynamic import() from AuthContext so the
// Firebase SDK downloads in the background instead of blocking the first paint.
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

export const watchAuth = (callback) => onAuthStateChanged(auth, callback);

export const watchProfile = (uid, onNext, onError) =>
  onSnapshot(doc(db, 'users', uid), onNext, onError);

export const signOutUser = () => signOut(auth);
