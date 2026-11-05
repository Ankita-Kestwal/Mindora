// Stage 4: AI quizzes, timed assessments, weak-topic tracking and smart revision.
import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/errors.js';
import { store } from '../repos/store.js';
import { getUser } from '../repos/users.js';
import { AIError } from '../services/azureAI.js';
import { chatJson, cleanQuestions, MCQ_FORMAT } from '../services/aiJson.js';
import { allowAI, AI_LIMIT } from '../services/limits.js';

export const topicKeyOf = (t) => String(t).trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 120);

function quizMessages({ topics, subject, count, difficulty, focus }, profile) {
  return [
    { role: 'system', content: `You write accurate multiple-choice questions for learners. Learner level: ${profile?.learningLevel || 'intermediate'}; education: ${profile?.education?.level || 'unknown'}${profile?.education?.course ? `, ${profile.education.course}` : ''}. Only academic topics; if not academic return {"questions":[],"error":"not_academic"}. ${MCQ_FORMAT}` },
    { role: 'user', content: `Write ${count} ${difficulty} questions on: ${topics.join('; ')}${subject ? ` (subject: ${subject})` : ''}.${focus ? ` ${focus}` : ''} Set "topic" to whichever of these topics each question tests.` },
  ];
}

/** Creates and stores a quiz. The answers stay on the server until the quiz is submitted. */
export async function createQuiz(uid, { topics, subject = '', count, difficulty, timed = false, durationMin = null, kind = 'practice', focus = '', meta = {} }) {
  if (!allowAI(uid)) throw new AIError(`You’ve reached ${AI_LIMIT} AI requests this hour. Please try again later.`, 429, 'ai/user-limit');
  const profile = await getUser(uid);
  const { data, model } = await chatJson(quizMessages({ topics, subject, count, difficulty, focus }, profile), { maxTokens: 9000, timeoutMs: 150000 });
  if (data.error === 'not_academic') throw new AIError('Mindora only creates quizzes on educational topics.', 422, 'ai/not-academic');
  const questions = cleanQuestions(data, count);
  if (questions.length < Math.min(3, count)) throw new AIError('The AI didn’t return enough valid questions. Please try again.', 502, 'ai/too-few');
  const id = crypto.randomUUID();
  const quiz = {
    kind, topics, subject, difficulty, timed, durationMin: timed ? durationMin : null, questions, model,
    status: 'open', createdAt: new Date().toISOString(), startedAt: new Date().toISOString(), ...meta,
  };
  await store().set(`users/${uid}/quizzes/${id}`, quiz);
  return { id, ...quiz };
}

export const publicQuiz = (q) => ({
  id: q.id, kind: q.kind, topics: q.topics, subject: q.subject, difficulty: q.difficulty, timed: q.timed, durationMin: q.durationMin,
  status: q.status, createdAt: q.createdAt, startedAt: q.startedAt, weekId: q.weekId,
  questions: q.questions.map(({ question, options, topic }) => ({ question, options, topic })),
  ...(q.status === 'submitted' ? { result: q.result, answers: q.questions.map((x) => x.answer), explanations: q.questions.map((x) => x.explanation) } : {}),
});

/** Scores a quiz, stores the attempt and updates weak-topic strength. */
export async function submitQuiz(uid, id, answers, { graceSec = 60 } = {}) {
  const path = `users/${uid}/quizzes/${id}`;
  const q = await store().get(path);
  if (!q) throw Object.assign(new Error('Quiz not found.'), { status: 404 });
  if (q.status === 'submitted') throw Object.assign(new Error('This quiz was already submitted.'), { status: 409 });
  const now = Date.now();
  const elapsed = Math.round((now - new Date(q.startedAt).getTime()) / 1000);
  const late = q.timed && q.durationMin && elapsed > q.durationMin * 60 + graceSec;
  const picks = q.questions.map((_, i) => (Number.isInteger(answers?.[i]) && answers[i] >= 0 && answers[i] < 4 ? answers[i] : null));
  const correct = picks.map((p, i) => p === q.questions[i].answer);
  const score = correct.filter(Boolean).length;
  const result = { score, total: q.questions.length, percent: Math.round((score / q.questions.length) * 100), picks, correct, timeTakenSec: elapsed, late: Boolean(late), submittedAt: new Date(now).toISOString() };
  await store().update(path, { status: 'submitted', result });

  // Weak-topic tracking: exponential moving average of accuracy per topic.
  const byTopic = {};
  q.questions.forEach((x, i) => {
    const t = x.topic || q.topics[0];
    byTopic[t] ||= { right: 0, total: 0 };
    byTopic[t].total += 1; if (correct[i]) byTopic[t].right += 1;
  });
  for (const [topic, s] of Object.entries(byTopic)) {
    const key = crypto.createHash('sha1').update(topicKeyOf(topic)).digest('hex').slice(0, 20);
    const wPath = `users/${uid}/weakTopics/${key}`;
    const prev = await store().get(wPath);
    const acc = s.right / s.total;
    const strength = prev ? Math.round((prev.strength * 0.6 + acc * 0.4) * 100) / 100 : Math.round(acc * 100) / 100;
    await store().set(wPath, {
      topic, subject: q.subject || prev?.subject || '', strength,
      attempts: (prev?.attempts || 0) + s.total, mistakes: (prev?.mistakes || 0) + (s.total - s.right),
      lastSeen: new Date(now).toISOString(),
    });
  }
  return { ...q, id, status: 'submitted', result };
}

export const quizzesRouter = Router();
quizzesRouter.use(requireAuth);

const genSchema = z.object({
  topic: z.string().trim().min(2, 'Enter a topic.').max(120),
  subject: z.string().trim().max(80).optional().default(''),
  count: z.number().int().min(3).max(20).default(10),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  timed: z.boolean().default(false),
  durationMin: z.number().int().min(1).max(180).optional(),
}).strict();

const aiErr = (res, e, next) => (e instanceof AIError ? res.status(e.status).json({ error: e.message, code: e.code }) : next(e));

quizzesRouter.post('/generate', validate(genSchema), async (req, res, next) => {
  const v = req.valid;
  try {
    const q = await createQuiz(req.user.uid, { topics: [v.topic], subject: v.subject, count: v.count, difficulty: v.difficulty, timed: v.timed, durationMin: v.timed ? (v.durationMin || v.count) : null });
    res.status(201).json({ quiz: publicQuiz(q) });
  } catch (e) { aiErr(res, e, next); }
});

quizzesRouter.get('/', async (req, res, next) => {
  try {
    const items = await store().list(`users/${req.user.uid}/quizzes`, { orderBy: 'createdAt', limit: 100 });
    res.json({ items: items.map((q) => ({ id: q.id, kind: q.kind, topics: q.topics, subject: q.subject, difficulty: q.difficulty, timed: q.timed, status: q.status, createdAt: q.createdAt, count: q.questions.length, result: q.result ? { score: q.result.score, total: q.result.total, percent: q.result.percent } : null })) });
  } catch (e) { next(e); }
});

quizzesRouter.get('/:id', async (req, res, next) => {
  try {
    const q = await store().get(`users/${req.user.uid}/quizzes/${req.params.id}`);
    if (!q) return res.status(404).json({ error: 'Quiz not found.' });
    return res.json({ quiz: publicQuiz({ ...q, id: req.params.id }) });
  } catch (e) { return next(e); }
});

quizzesRouter.post('/:id/submit', validate(z.object({ answers: z.array(z.number().int().min(-1).max(3).nullable()).max(30) }).strict()), async (req, res, next) => {
  try {
    const existing = await store().get(`users/${req.user.uid}/quizzes/${req.params.id}`);
    if (existing?.kind === 'challenge') return res.status(400).json({ error: 'Submit challenges from the Sunday Challenge page.' });
    const q = await submitQuiz(req.user.uid, req.params.id, req.valid.answers);
    return res.json({ quiz: publicQuiz(q) });
  } catch (e) { return next(e); }
});

quizzesRouter.delete('/:id', async (req, res, next) => {
  try { await store().delete(`users/${req.user.uid}/quizzes/${req.params.id}`); res.json({ ok: true }); } catch (e) { next(e); }
});

/* ---------- Smart revision ---------- */
export const revisionRouter = Router();
revisionRouter.use(requireAuth);

export async function revisionPlan(uid) {
  const weak = await store().list(`users/${uid}/weakTopics`, { limit: 200 });
  const history = await store().list(`users/${uid}/history`, { orderBy: 'updatedAt', limit: 100 });
  const quizzed = new Set(weak.map((w) => topicKeyOf(w.topic)));
  const now = Date.now();
  const needsWork = weak.filter((w) => w.strength < 0.7).sort((a, b) => a.strength - b.strength || (a.lastSeen > b.lastSeen ? 1 : -1));
  const strong = weak.filter((w) => w.strength >= 0.7).sort((a, b) => b.strength - a.strength);
  const due = weak.filter((w) => w.strength >= 0.7 && now - new Date(w.lastSeen) > 7 * 86400000);
  const notTested = history.filter((h) => !quizzed.has(topicKeyOf(h.topic))).slice(0, 20).map((h) => ({ topic: h.topic, subject: h.subject, studiedAt: h.updatedAt }));
  return { needsWork, strong, due, notTested };
}

revisionRouter.get('/plan', async (req, res, next) => {
  try { res.json(await revisionPlan(req.user.uid)); } catch (e) { next(e); }
});

revisionRouter.post('/quiz', validate(z.object({ topics: z.array(z.string().trim().min(2).max(120)).max(5).optional() }).strict()), async (req, res, next) => {
  try {
    let topics = req.valid.topics;
    if (!topics?.length) {
      const p = await revisionPlan(req.user.uid);
      topics = [...p.needsWork, ...p.due].slice(0, 4).map((w) => w.topic);
      if (!topics.length) topics = p.notTested.slice(0, 3).map((t) => t.topic);
    }
    if (!topics.length) return res.status(400).json({ error: 'Study a topic or take a quiz first — revision is built from your own history.' });
    const q = await createQuiz(req.user.uid, { topics, count: Math.min(12, topics.length * 3), difficulty: 'medium', kind: 'revision', focus: 'Focus on the ideas learners most often get wrong.' });
    return res.status(201).json({ quiz: publicQuiz(q) });
  } catch (e) { return aiErr(res, e, next); }
});
