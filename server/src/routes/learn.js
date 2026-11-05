import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/errors.js';
import { store } from '../repos/store.js';
import { getUser } from '../repos/users.js';
import { chat, AIError, azureConfigured } from '../services/azureAI.js';
import { CONTENT_TYPES, MARKS, buildMessages } from '../prompts/learn.js';
import { allowAI as allow, AI_LIMIT as LIMIT } from '../services/limits.js';

export const learnRouter = Router();
learnRouter.use(requireAuth);

const topicKey = (topic, subject = '') => crypto.createHash('sha1').update(`${subject.trim().toLowerCase()}|${topic.trim().toLowerCase()}`).digest('hex').slice(0, 20);


const genSchema = z.object({
  topic: z.string().trim().min(2, 'Enter a topic (2–120 characters).').max(120),
  subject: z.string().trim().max(80).optional().default(''),
  type: z.enum(Object.keys(CONTENT_TYPES)),
  marks: z.number().int().refine((m) => MARKS.includes(m), 'Choose a valid mark value.').optional(),
}).strict().refine((d) => d.type !== 'exam-answer' || d.marks, { message: 'Choose how many marks.', path: ['marks'] });

learnRouter.get('/options', (req, res) => {
  res.json({ types: Object.entries(CONTENT_TYPES).map(([id, t]) => ({ id, label: t.label })), marks: MARKS, configured: azureConfigured() });
});

/** Tiny live call so the user can confirm their Azure keys work. */
learnRouter.post('/test', async (req, res, next) => {
  try {
    const t0 = Date.now();
    const r = await chat([{ role: 'user', content: 'Reply with the single word: ready' }], { maxTokens: 300, timeoutMs: 30000 });
    res.json({ ok: true, model: r.model, ms: Date.now() - t0, reply: r.text.slice(0, 40) });
  } catch (e) { next(e); }
});

learnRouter.post('/generate', validate(genSchema), async (req, res, next) => {
  const { uid } = req.user;
  const input = req.valid;
  try {
    if (!allow(uid)) return res.status(429).json({ error: `You’ve reached ${LIMIT} AI requests this hour. Please try again later.` });
    const profile = await getUser(uid);
    if (!profile) return res.status(404).json({ error: 'Complete onboarding first.' });
    const r = await chat(buildMessages(input, profile), { maxTokens: CONTENT_TYPES[input.type].tokens });
    if (/^NOT_ACADEMIC\b/.test(r.text)) {
      return res.status(422).json({ error: 'Mindora only covers educational and academic topics. Try a subject, concept or exam topic.' });
    }
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const key = topicKey(input.topic, input.subject);
    const content = {
      topic: input.topic, subject: input.subject, topicKey: key, type: input.type, marks: input.marks || null,
      body: r.text, truncated: r.truncated, aiGenerated: true, model: r.model, createdAt: now,
    };
    await store().set(`users/${uid}/content/${id}`, content);
    const prev = await store().get(`users/${uid}/history/${key}`);
    await store().set(`users/${uid}/history/${key}`, {
      topic: input.topic, subject: input.subject, lastType: input.type, lastContentId: id,
      types: [...new Set([...(prev?.types || []), input.type])],
      count: (prev?.count || 0) + 1, firstStudiedAt: prev?.firstStudiedAt || now, updatedAt: now,
    });
    return res.status(201).json({ content: { id, ...content } });
  } catch (e) {
    if (e instanceof AIError) return res.status(e.status).json({ error: e.message, code: e.code });
    return next(e);
  }
});

learnRouter.get('/content', async (req, res, next) => {
  try {
    const where = req.query.topicKey ? [['topicKey', '==', String(req.query.topicKey)]] : undefined;
    const items = await store().list(`users/${req.user.uid}/content`, { where, orderBy: where ? undefined : 'createdAt', limit: 100 });
    items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    res.json({ items: items.map(({ body, ...m }) => ({ ...m, preview: body.replace(/[#*`>\-_]/g, '').slice(0, 160) })) });
  } catch (e) { next(e); }
});

learnRouter.get('/content/:id', async (req, res, next) => {
  try {
    const c = await store().get(`users/${req.user.uid}/content/${req.params.id}`);
    if (!c) return res.status(404).json({ error: 'Not found.' });
    return res.json({ content: c });
  } catch (e) { return next(e); }
});

learnRouter.delete('/content/:id', async (req, res, next) => {
  try {
    const { uid } = req.user;
    const path = `users/${uid}/content/${req.params.id}`;
    const item = await store().get(path);
    if (!item) return res.status(404).json({ error: 'Not found.' });
    await store().delete(path);
    // Keep "Continue" in history pointing at content that still exists.
    const hPath = `users/${uid}/history/${item.topicKey}`;
    const hist = await store().get(hPath);
    if (hist?.lastContentId === req.params.id) {
      const rest = (await store().list(`users/${uid}/content`, { where: [['topicKey', '==', item.topicKey]], limit: 100 }))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      if (rest.length) await store().update(hPath, { lastContentId: rest[0].id, lastType: rest[0].type });
      else await store().delete(hPath);
    }
    return res.json({ ok: true });
  } catch (e) { return next(e); }
});

learnRouter.get('/history', async (req, res, next) => {
  try { res.json({ items: await store().list(`users/${req.user.uid}/history`, { orderBy: 'updatedAt', limit: 100 }) }); } catch (e) { next(e); }
});

learnRouter.delete('/history/:key', async (req, res, next) => {
  try { await store().delete(`users/${req.user.uid}/history/${req.params.key}`); res.json({ ok: true }); } catch (e) { next(e); }
});
