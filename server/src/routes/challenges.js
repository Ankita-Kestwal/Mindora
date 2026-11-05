// Stage 6a: weekly Sunday challenge — personal, timed, one attempt per week, results private.
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/errors.js';
import { store } from '../repos/store.js';
import { getUser } from '../repos/users.js';
import { AIError } from '../services/azureAI.js';
import { createQuiz, submitQuiz, publicQuiz, revisionPlan } from './quizzes.js';

export const CHALLENGE = { questions: 15, durationMin: 20 };

/** India-time helpers. weekId = ISO year-week of the Sunday, e.g. 2026-W45. */
const ist = (now) => new Date(now + 5.5 * 3600000);
export function isSundayIST(now = Date.now()) { return ist(now).getUTCDay() === 0; }
export function weekIdIST(now = Date.now()) {
  const d = ist(now); d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7)); // Thursday of this ISO week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - yearStart) / 86400000 - 3 + ((yearStart.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
export function nextSundayIST(now = Date.now()) {
  const d = ist(now); const add = (7 - d.getUTCDay()) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}
const anyDay = () => String(process.env.CHALLENGE_ANY_DAY || '').toLowerCase() === 'true';

export const challengesRouter = Router();
challengesRouter.use(requireAuth);

async function current(uid) {
  const weekId = weekIdIST();
  const entry = await store().get(`users/${uid}/challenges/${weekId}`);
  const open = anyDay() || isSundayIST();
  return { weekId, open, anyDayMode: anyDay(), nextSunday: nextSundayIST(), entry, ...CHALLENGE };
}

challengesRouter.get('/current', async (req, res, next) => {
  try {
    const c = await current(req.user.uid);
    let quiz = null;
    if (c.entry?.quizId) {
      const q = await store().get(`users/${req.user.uid}/quizzes/${c.entry.quizId}`);
      if (q) quiz = publicQuiz({ ...q, id: c.entry.quizId });
    }
    res.json({ ...c, quiz });
  } catch (e) { next(e); }
});

challengesRouter.post('/current/start', async (req, res, next) => {
  try {
    const { uid } = req.user;
    const c = await current(uid);
    if (!c.open) return res.status(403).json({ error: `The weekly challenge opens on Sunday (${c.nextSunday}).` });
    if (c.entry) return res.status(409).json({ error: c.entry.status === 'submitted' ? 'You’ve already taken this week’s challenge.' : 'Your challenge is already in progress.' });
    const profile = await getUser(uid);
    const plan = await revisionPlan(uid);
    const topics = [...new Set([...plan.needsWork.slice(0, 2).map((w) => w.topic), ...(profile?.interests || [])])].slice(0, 5);
    if (!topics.length) topics.push('General knowledge for students');
    // Reserve the week first so it can only be started once.
    if (!(await store().create(`users/${uid}/challenges/${c.weekId}`, { status: 'starting', topics, createdAt: new Date().toISOString() }))) {
      return res.status(409).json({ error: 'Your challenge is already in progress.' });
    }
    try {
      const q = await createQuiz(uid, { topics, count: CHALLENGE.questions, difficulty: 'medium', timed: true, durationMin: CHALLENGE.durationMin, kind: 'challenge', meta: { weekId: c.weekId }, focus: 'Mix easy, medium and hard questions across the topics.' });
      await store().update(`users/${uid}/challenges/${c.weekId}`, { status: 'in-progress', quizId: q.id, startedAt: q.startedAt });
      return res.status(201).json({ quiz: publicQuiz(q) });
    } catch (e) {
      await store().delete(`users/${uid}/challenges/${c.weekId}`); // let them try again
      if (e instanceof AIError) return res.status(e.status).json({ error: e.message });
      throw e;
    }
  } catch (e) { return next(e); }
});

challengesRouter.post('/current/submit', validate(z.object({ answers: z.array(z.number().int().min(-1).max(3).nullable()).max(30) }).strict()), async (req, res, next) => {
  try {
    const { uid } = req.user;
    const weekId = weekIdIST();
    const entry = await store().get(`users/${uid}/challenges/${weekId}`);
    if (!entry?.quizId) return res.status(404).json({ error: 'Start the challenge first.' });
    if (entry.status === 'submitted') return res.status(409).json({ error: 'Already submitted.' });
    const q = await submitQuiz(uid, entry.quizId, req.valid.answers, { graceSec: 30 });
    await store().update(`users/${uid}/challenges/${weekId}`, { status: 'submitted', score: q.result.score, total: q.result.total, percent: q.result.percent, timeTakenSec: q.result.timeTakenSec, late: q.result.late, submittedAt: q.result.submittedAt });
    return res.json({ quiz: publicQuiz(q) });
  } catch (e) { return next(e); }
});

challengesRouter.get('/history', async (req, res, next) => {
  try {
    const items = (await store().list(`users/${req.user.uid}/challenges`, { limit: 104 })).filter((c) => c.status === 'submitted').sort((a, b) => (a.id < b.id ? 1 : -1));
    res.json({ items });
  } catch (e) { next(e); }
});
