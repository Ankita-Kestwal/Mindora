// Verifies the Firebase ID token on every protected request.
import { firebase } from '../services/firebase.js';
import { store } from '../repos/store.js';

export async function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Sign in required.' });
  try {
    const decoded = await firebase().auth.verifyIdToken(token, true);
    req.user = { uid: decoded.uid, email: (decoded.email || '').toLowerCase(), emailVerified: !!decoded.email_verified, name: decoded.name || '' };
    return next();
  } catch (e) {
    if (e.status === 503) return next(e);
    const expired = e.code === 'auth/id-token-expired';
    return res.status(401).json({ error: expired ? 'Your session expired. Please sign in again.' : 'Invalid sign-in token.' });
  }
}

export async function requireAdmin(req, res, next) {
  try {
    const profile = await store().get(`users/${req.user.uid}`);
    if (profile?.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
    return next();
  } catch (e) { return next(e); }
}
