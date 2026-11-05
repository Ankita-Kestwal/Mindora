// Firebase Admin SDK: verifies ID tokens (Auth) and talks to Cloud Firestore.
import fs from 'node:fs';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { env } from '../config/env.js';

let state = null;

function credentialFromEnv() {
  if (env.firebase.authEmulatorHost) return null; // emulator needs no service account
  if (env.firebase.serviceAccountJson) return cert(JSON.parse(env.firebase.serviceAccountJson));
  if (env.firebase.serviceAccountPath) {
    if (!fs.existsSync(env.firebase.serviceAccountPath)) {
      throw Object.assign(new Error(`Firebase service-account file not found: ${env.firebase.serviceAccountPath}. Download it from Firebase console → Project settings → Service accounts, or remove FIREBASE_SERVICE_ACCOUNT_PATH from server/.env.`), { status: 503, code: 'firebase/no-credentials' });
    }
    return cert(JSON.parse(fs.readFileSync(env.firebase.serviceAccountPath, 'utf8')));
  }
  return null;
}

/** Returns { auth, db, mode } or throws a clear configuration error. */
export function firebase() {
  if (state) return state;
  const emulated = Boolean(env.firebase.authEmulatorHost);
  if (!env.firebase.projectId) {
    throw Object.assign(new Error('FIREBASE_PROJECT_ID is not set in server/.env'), { status: 503, code: 'firebase/not-configured' });
  }
  let credential = credentialFromEnv();
  if (!credential && !emulated) {
    try { credential = applicationDefault(); } catch { /* fall through */ }
    if (!credential) {
      throw Object.assign(new Error('Firebase service account is not configured (FIREBASE_SERVICE_ACCOUNT_PATH)'), { status: 503, code: 'firebase/no-credentials' });
    }
  }
  const app = getApps()[0] || initializeApp({ projectId: env.firebase.projectId, ...(credential ? { credential } : {}) });
  state = {
    auth: getAuth(app),
    db: env.store === 'firestore' ? getFirestore(app) : null,
    mode: emulated ? 'emulator' : 'live',
  };
  return state;
}

export function firebaseStatus() {
  try {
    const f = firebase();
    return { configured: true, mode: f.mode, projectId: env.firebase.projectId };
  } catch (e) {
    return { configured: false, reason: e.message };
  }
}
