import crypto from 'node:crypto';
import { store } from './store.js';
import { env } from '../config/env.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

function randomMindoraId() {
  const bytes = crypto.randomBytes(6);
  return `MND-${[...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')}`;
}

/** Reserves a unique Mindora ID (mindoraIds/{id} → uid). */
async function reserveMindoraId(uid) {
  for (let i = 0; i < 8; i++) {
    const id = randomMindoraId();
    if (await store().create(`mindoraIds/${id}`, { uid, createdAt: new Date().toISOString() })) return id;
  }
  throw new Error('Could not allocate a Mindora ID');
}

export const DEFAULT_PREFS = { theme: 'dark', autoTheme: false, autoIntervalMin: 5, font: 'inter' };

export async function getUser(uid) {
  return store().get(`users/${uid}`);
}

export async function createUser({ uid, email }, data) {
  if (await getUser(uid)) {
    throw Object.assign(new Error('Your profile already exists.'), { status: 409 });
  }
  const now = new Date().toISOString();
  const mindoraId = await reserveMindoraId(uid);
  const profile = {
    ...data,
    email,
    mindoraId,
    role: env.adminEmails.includes(email) ? 'admin' : 'user',
    prefs: { ...DEFAULT_PREFS, ...(data.prefs || {}) },
    createdAt: now,
    updatedAt: now,
  };
  const ok = await store().create(`users/${uid}`, profile);
  if (!ok) throw Object.assign(new Error('Your profile already exists.'), { status: 409 });
  return { id: uid, ...profile };
}

export async function updateUser(uid, patch) {
  if (!(await getUser(uid))) throw Object.assign(new Error('Complete onboarding first.'), { status: 404 });
  await store().update(`users/${uid}`, { ...patch, updatedAt: new Date().toISOString() });
  return getUser(uid);
}
