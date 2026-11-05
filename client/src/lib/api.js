// Calls the Mindora API with the signed-in user's Firebase ID token.
import { auth } from './firebase.js';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, fields) { super(message); this.status = status; this.fields = fields || {}; }
}

export async function api(path, { method = 'GET', body, auth: needsAuth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (needsAuth) {
    const user = auth?.currentUser;
    if (!user) throw new ApiError('Please sign in again.', 401);
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError('Can’t reach the Mindora server. Is it running?', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status}).`, res.status, data.fields);
  return data;
}

/** Multipart upload with the user's token. */
export async function apiUpload(path, formData) {
  const user = auth?.currentUser;
  if (!user) throw new ApiError('Please sign in again.', 401);
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}` }, body: formData });
  } catch { throw new ApiError('Can’t reach the Mindora server. Is it running?', 0); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Upload failed (${res.status}).`, res.status, data.fields);
  return data;
}

/** Downloads a protected file and returns an object URL. */
export async function apiBlobUrl(path) {
  const user = auth?.currentUser;
  if (!user) throw new ApiError('Please sign in again.', 401);
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new ApiError(d.error || 'Could not open the file.', res.status); }
  return URL.createObjectURL(await res.blob());
}
