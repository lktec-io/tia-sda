import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getFeeStatus, isLeaderProfile } from '../data/constants';

const AuthContext = createContext(null);

// Firebase is pulled in lazily (see src/lib/session.js) so it is split out of the
// initial bundle; the promise is cached so every caller shares one download.
let sessionModule;
const loadSession = () => {
  sessionModule ??= import('../lib/session');
  return sessionModule;
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  // Stays true until Firebase has restored the session AND the profile has loaded,
  // so guarded pages never flash the wrong screen on reload.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let unsubscribeAuth = null;
    let unsubscribeProfile = null;

    const stopProfile = () => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }
    };

    loadSession()
      .then(({ watchAuth, watchProfile }) => {
        if (cancelled) return;

        unsubscribeAuth = watchAuth((user) => {
          stopProfile();
          setCurrentUser(user);
          setProfileError(null);

          if (!user) {
            setUserProfile(null);
            setLoading(false);
            return;
          }

          setLoading(true);

          // Live listener: a freshly registered user's profile appears as soon as it is
          // written, and leader changes (role, membership fee) show up instantly.
          unsubscribeProfile = watchProfile(
            user.uid,
            (snapshot) => {
              setUserProfile(snapshot.exists() ? snapshot.data() : null);
              setLoading(false);
            },
            (error) => {
              console.error('Failed to load user profile:', error);
              setUserProfile(null);
              setProfileError(error);
              setLoading(false);
            }
          );
        });
      })
      .catch((error) => {
        // Chunk failed to download (offline, or a stale tab after a new deploy).
        console.error('Failed to load authentication module:', error);
        if (!cancelled) {
          setProfileError(error);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (unsubscribeAuth) unsubscribeAuth();
      stopProfile();
    };
  }, []);

  const logout = useCallback(async () => {
    const { signOutUser } = await loadSession();
    return signOutUser();
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      userProfile,
      userRole: userProfile?.role ?? null,
      isLeader: isLeaderProfile(userProfile),
      // Announcement audience: leaders read every post, everyone else their own role's posts.
      feedRole: userProfile?.role ?? null,
      // 'unpaid' | 'semester1_paid' | 'fully_paid' (older profiles derive it from membershipFeePaid)
      feeStatus: getFeeStatus(userProfile),
      membershipFeePaid: getFeeStatus(userProfile) === 'fully_paid',
      profileError,
      loading,
      logout
    }),
    [currentUser, userProfile, profileError, loading, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return context;
}
