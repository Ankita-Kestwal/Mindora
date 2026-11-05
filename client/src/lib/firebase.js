// Firebase client SDK — Authentication only. All data goes through the Mindora API.
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const useAuthEmulator = import.meta.env.VITE_USE_AUTH_EMULATOR === 'true';
export const firebaseConfigured = Boolean(cfg.apiKey && cfg.projectId);

let auth = null;
if (firebaseConfigured) {
  const app = initializeApp(cfg);
  auth = getAuth(app);
  if (useAuthEmulator) connectAuthEmulator(auth, import.meta.env.VITE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099', { disableWarnings: true });
}
export { auth };

const MESSAGES = {
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Password is too weak — use at least 8 characters.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error — check your internet connection.',
  'auth/operation-not-allowed': 'Email/password sign-in is not enabled in the Firebase console.',
  'auth/user-disabled': 'This account has been disabled.',
};
export const authMessage = (e) => MESSAGES[e?.code] || e?.message?.replace(/^Firebase:\s*/, '') || 'Something went wrong.';
