// Syllabus upload → Azure Blob Storage → read with Azure OpenAI (gpt-5-mini) → subject/unit/chapter/topic tree.
import { Router } from 'express';
import crypto from 'node:crypto';
import multer from 'multer';
import { extractText, getDocumentProxy } from 'unpdf';
import { requireAuth } from '../middleware/auth.js';
import { store } from '../repos/store.js';
import { uploadBlob, downloadBlob, deleteBlob } from '../services/blob.js';
import { chat, AIError } from '../services/azureAI.js';

export const MAX_BYTES = 15 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } });

function sniff(buf) {
  if (buf.subarray(0, 4).toString() === '%PDF') return 'application/pdf';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return 'image/png';
  return null;
}
const safeName = (n) => (n.normalize('NFKD').replace(/[^\w.\- ]+/g, '').trim().replace(/\s+/g, '_') || 'syllabus').slice(0, 100);

const SYSTEM = `You extract the structure of an academic syllabus.
Return ONLY a JSON object of this shape:
{"title": string, "subjects": [{"name": string, "units": [{"title": string, "chapters": [{"title": string, "topics": [string]}]}]}]}
Rules: copy names from the syllabus (fix only obvious OCR typos); if a level is missing, use one chapter named like its unit; topics are short (max 80 chars);
ignore marks schemes, reference books, course outcomes and admin text; do not invent content that is not in the syllabus.
If the document is not a syllabus or course outline, return {"title":"","subjects":[],"error":"not_a_syllabus"}.`;

const clip = (s, n) => String(s || '').trim().slice(0, n);
export function normaliseTree(raw) {
  const subjects = (Array.isArray(raw?.subjects) ? raw.subjects : []).slice(0, 20).map((s) => ({
    name: clip(s?.name, 120) || 'Subject',
    units: (Array.isArray(s?.units) ? s.units : []).slice(0, 30).map((u) => ({
      title: clip(u?.title, 140) || 'Unit',
      chapters: (Array.isArray(u?.chapters) ? u.chapters : []).slice(0, 40).map((c) => ({
        title: clip(c?.title, 140) || 'Chapter',
        topics: (Array.isArray(c?.topics) ? c.topics : []).map((t) => clip(t, 80)).filter(Boolean).slice(0, 60),
      })),
    })),
  })).filter((s) => s.units.length);
  const topicCount = subjects.reduce((n, s) => n + s.units.reduce((m, u) => m + u.chapters.reduce((k, c) => k + c.topics.length, 0), 0), 0);
  return { title: clip(raw?.title, 140), subjects, topicCount };
}

function parseJson(text) {
  const t = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(t); } catch { /* fallthrough */ }
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fallthrough */ } }
  return null;
}

/** Reads the file and builds the tree. Exported for tests. */
export async function processSyllabus(uid, id) {
  const path = `users/${uid}/syllabi/${id}`;
  const rec = await store().get(path);
  if (!rec) return;
  await store().update(path, { status: 'processing', error: null, updatedAt: new Date().toISOString() });
  try {
    const buf = await downloadBlob(rec.blobPath);
    let messages;
    if (rec.mimeType === 'application/pdf') {
      let text = '';
      try {
        const doc = await getDocumentProxy(new Uint8Array(buf));
        if (doc.numPages > 40) throw Object.assign(new Error('This PDF has more than 40 pages. Upload only the syllabus pages.'), { user: true });
        text = (await extractText(doc, { mergePages: true })).text || '';
        await doc.destroy?.();
      } catch (e) {
        if (e.user) throw e;
        console.warn('[syllabus] PDF read failed:', e.message);
        throw Object.assign(new Error(/password/i.test(e.message) ? 'This PDF is password-protected. Remove the password and upload it again.' : 'This PDF could not be read. It may be damaged.'), { user: true });
      }
      text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      if (text.length < 80) throw Object.assign(new Error('This looks like a scanned PDF with no readable text. Upload clear photos (JPG/PNG) of the pages instead.'), { user: true });
      messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: `Syllabus text:\n\n${text.slice(0, 60000)}` }];
    } else {
      messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: [
        { type: 'text', text: 'Read this syllabus image and extract its structure.' },
        { type: 'image_url', image_url: { url: `data:${rec.mimeType};base64,${buf.toString('base64')}` } },
      ] }];
    }
    const r = await chat(messages, { maxTokens: 12000, timeoutMs: 180000, json: true });
    const raw = parseJson(r.text);
    if (!raw) throw Object.assign(new Error('The AI response could not be understood. Click “Process again”.'), { user: true });
    if (raw.error === 'not_a_syllabus') throw Object.assign(new Error('This file doesn’t look like a syllabus or course outline.'), { user: true });
    const tree = normaliseTree(raw);
    if (!tree.topicCount) throw Object.assign(new Error('No subjects or topics were found in this file.'), { user: true });
    await store().update(path, {
      status: 'ready', title: tree.title || rec.title, subjects: tree.subjects, topicCount: tree.topicCount,
      truncated: r.truncated, model: r.model, processedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e.user || e instanceof AIError ? e.message : 'Processing failed. Click “Process again”.';
    if (!e.user && !(e instanceof AIError)) console.error('[syllabus]', e);
    await store().update(path, { status: 'failed', error: msg, updatedAt: new Date().toISOString() }).catch(() => {});
  }
}

export const syllabiRouter = Router();
syllabiRouter.use(requireAuth);

const summary = ({ subjects, ...s }) => ({ ...s, subjectCount: subjects?.length || 0 });

syllabiRouter.post('/', (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 15 MB).' : 'Upload failed.' });
    try {
      const f = req.file;
      if (!f) return res.status(400).json({ error: 'Choose a PDF, JPG or PNG file.' });
      const mime = sniff(f.buffer);
      if (!mime) return res.status(415).json({ error: 'Only PDF, JPG and PNG files are allowed.' });
      const { uid } = req.user;
      const id = crypto.randomUUID();
      const fileName = safeName(f.originalname);
      const blobPath = `users/${uid}/syllabi/${id}/${fileName}`;
      await uploadBlob(blobPath, f.buffer, mime);
      const now = new Date().toISOString();
      const title = String(req.body?.title || '').trim().slice(0, 140) || f.originalname.replace(/\.[^.]+$/, '').slice(0, 140);
      const rec = { title, fileName, blobPath, mimeType: mime, size: f.size, status: 'processing', error: null, subjects: [], topicCount: 0, createdAt: now, updatedAt: now };
      await store().set(`users/${uid}/syllabi/${id}`, rec);
      res.status(202).json({ syllabus: summary({ id, ...rec }) });
      processSyllabus(uid, id); // runs in the background; the client polls
    } catch (e) { next(e); }
  });
});

syllabiRouter.get('/', async (req, res, next) => {
  try {
    const items = await store().list(`users/${req.user.uid}/syllabi`, { orderBy: 'createdAt', limit: 50 });
    res.json({ items: items.map(summary) });
  } catch (e) { next(e); }
});

syllabiRouter.get('/:id', async (req, res, next) => {
  try {
    const s = await store().get(`users/${req.user.uid}/syllabi/${req.params.id}`);
    if (!s) return res.status(404).json({ error: 'Not found.' });
    return res.json({ syllabus: s });
  } catch (e) { return next(e); }
});

syllabiRouter.get('/:id/file', async (req, res, next) => {
  try {
    const s = await store().get(`users/${req.user.uid}/syllabi/${req.params.id}`);
    if (!s) return res.status(404).json({ error: 'Not found.' });
    const buf = await downloadBlob(s.blobPath);
    res.set({ 'Content-Type': s.mimeType, 'Content-Disposition': `inline; filename="${s.fileName}"`, 'Cache-Control': 'private, no-store' });
    return res.send(buf);
  } catch (e) { return next(e); }
});

syllabiRouter.post('/:id/process', async (req, res, next) => {
  try {
    const { uid } = req.user;
    const s = await store().get(`users/${uid}/syllabi/${req.params.id}`);
    if (!s) return res.status(404).json({ error: 'Not found.' });
    if (s.status === 'processing' && Date.now() - new Date(s.updatedAt) < 4 * 60000) return res.status(409).json({ error: 'Already processing.' });
    await store().update(`users/${uid}/syllabi/${req.params.id}`, { status: 'processing', updatedAt: new Date().toISOString() });
    res.status(202).json({ ok: true });
    processSyllabus(uid, req.params.id);
    return undefined;
  } catch (e) { return next(e); }
});

syllabiRouter.delete('/:id', async (req, res, next) => {
  try {
    const path = `users/${req.user.uid}/syllabi/${req.params.id}`;
    const s = await store().get(path);
    if (!s) return res.status(404).json({ error: 'Not found.' });
    await deleteBlob(s.blobPath);
    await store().delete(path);
    return res.json({ ok: true });
  } catch (e) { return next(e); }
});
