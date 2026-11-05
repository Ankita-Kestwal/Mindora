// Minimal document-store interface used by every repository.
// Production: Cloud Firestore (Admin SDK). Tests / offline demo: in-memory store
// with the same semantics (create fails if the doc exists, merge on set, etc.).
import { env } from '../config/env.js';
import { firebase } from '../services/firebase.js';

/* ---------------- Firestore ---------------- */
function firestoreStore(db) {
  const clean = (d) => (d ? JSON.parse(JSON.stringify(d, (k, v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v))) : d);
  return {
    kind: 'firestore',
    async get(path) { const s = await db.doc(path).get(); return s.exists ? { id: s.id, ...clean(s.data()) } : null; },
    async create(path, data) {
      try { await db.doc(path).create(data); return true; } catch (e) { if (e.code === 6 || /ALREADY_EXISTS/.test(e.message)) return false; throw e; }
    },
    async set(path, data, { merge = false } = {}) { await db.doc(path).set(data, { merge }); },
    async update(path, data) { await db.doc(path).update(data); },
    async delete(path) { await db.doc(path).delete(); },
    async list(collection, { orderBy, direction = 'desc', limit = 50, where } = {}) {
      let q = db.collection(collection);
      if (where) for (const [f, op, v] of where) q = q.where(f, op, v);
      if (orderBy) q = q.orderBy(orderBy, direction);
      const snap = await q.limit(limit).get();
      return snap.docs.map((d) => ({ id: d.id, ...clean(d.data()) }));
    },
    async ping() { await db.collection('_health').limit(1).get(); return true; },
  };
}

/* ---------------- In-memory ---------------- */
export function memoryStore() {
  const docs = new Map();
  const copy = (v) => (v === undefined ? v : structuredClone(v));
  const ops = { '==': (a, b) => a === b, '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '<': (a, b) => a < b };
  return {
    kind: 'memory',
    _docs: docs,
    async get(path) { const d = docs.get(path); return d ? { id: path.split('/').pop(), ...copy(d) } : null; },
    async create(path, data) { if (docs.has(path)) return false; docs.set(path, copy(data)); return true; },
    async set(path, data, { merge = false } = {}) { docs.set(path, merge ? deepMerge(docs.get(path) || {}, copy(data)) : copy(data)); },
    async update(path, data) {
      if (!docs.has(path)) throw Object.assign(new Error(`No document to update: ${path}`), { code: 5 });
      docs.set(path, deepMerge(docs.get(path), copy(data)));
    },
    async delete(path) { docs.delete(path); },
    async list(collection, { orderBy, direction = 'desc', limit = 50, where } = {}) {
      const depth = collection.split('/').length + 1;
      let out = [...docs.entries()]
        .filter(([p]) => p.startsWith(`${collection}/`) && p.split('/').length === depth)
        .map(([p, d]) => ({ id: p.split('/').pop(), ...copy(d) }));
      if (where) for (const [f, op, v] of where) out = out.filter((d) => ops[op](d[f], v));
      if (orderBy) out.sort((a, b) => (a[orderBy] > b[orderBy] ? 1 : -1) * (direction === 'desc' ? -1 : 1));
      return out.slice(0, limit);
    },
    async ping() { return true; },
  };
}

function deepMerge(target, src) {
  const out = { ...target };
  for (const [k, v] of Object.entries(src)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])
      ? deepMerge(out[k], v) : v;
  }
  return out;
}

let instance = null;
export function store() {
  if (instance) return instance;
  instance = env.store === 'memory' ? memoryStore() : firestoreStore(firebase().db);
  return instance;
}
export function setStoreForTests(s) { instance = s; }
