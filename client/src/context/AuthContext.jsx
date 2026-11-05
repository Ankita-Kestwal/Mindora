import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  sendPasswordResetEmail, updateProfile, setPersistence, browserLocalPersistence, browserSessionPersistence,
  sendEmailVerification,
} from 'firebase/auth';
import { auth, firebaseConfigured } from '../lib/firebase.js';
import { api } from '../lib/api.js';
import { usePrefs } from './PrefsContext.jsx';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { adoptServerPrefs, detach } = usePrefs();
  const [user, setUser] = useState(undefined); // undefined = still resolving
  const [profile, setProfile] = useState(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [profileError, setProfileError] = useState('');

  const loadProfile = useCallback(async () => {
    setProfileError('');
    try {
      const r = await api('/me');
      setProfile(r.profile);
      setNeedsOnboarding(r.needsOnboarding);
      adoptServerPrefs(r.profile?.prefs);
      return r;
    } catch (e) {
      // Session no longer valid on the server (e.g. local emulator was restarted): sign out cleanly.
      if (e.status === 401) { await signOut(auth).catch(() => {}); return null; }
      setProfileError(e.message);
      throw e;
    }
  }, [adoptServerPrefs]);

  useEffect(() => {
    if (!firebaseConfigured) { setUser(null); return undefined; }
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        try { await loadProfile(); } catch { /* shown via profileError */ }
      } else {
        setProfile(null); setNeedsOnboarding(false); detach();
      }
      setUser(auth.currentUser); // may have been signed out while loading (expired session)
    });
  }, [loadProfile, detach]);

  const value = {
    user, profile, needsOnboarding, profileError, firebaseConfigured,
    loading: user === undefined,
    reloadProfile: loadProfile,
    setProfile: (p) => { setProfile(p); setNeedsOnboarding(false); },
    async login(email, password, remember = true) {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);
    },
    async register(name, email, password) {
      await setPersistence(auth, browserLocalPersistence);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      sendEmailVerification(cred.user).catch(() => {});
    },
    resetPassword: (email) => sendPasswordResetEmail(auth, email),
    logout: () => signOut(auth),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
