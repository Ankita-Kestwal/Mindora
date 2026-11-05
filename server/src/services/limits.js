// Per-user AI request limit (protects the Azure credit). Shared by every AI feature.
const WINDOW_MS = 60 * 60 * 1000;
export const AI_LIMIT = Number(process.env.AI_REQUESTS_PER_HOUR || 40);
const usage = new Map();

export function allowAI(uid) {
  const now = Date.now();
  const list = (usage.get(uid) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= AI_LIMIT) { usage.set(uid, list); return false; }
  list.push(now); usage.set(uid, list); return true;
}
