// Stage 6b: private performance analytics and monthly reports, computed from the user's own data.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { store } from '../repos/store.js';

const istDay = (iso) => new Date(new Date(iso).getTime() + 5.5 * 3600000).toISOString().slice(0, 10);

export async function buildReport(uid, month /* YYYY-MM */) {
  const [content, quizzes, weak, challenges] = await Promise.all([
    store().list(`users/${uid}/content`, { limit: 2000 }),
    store().list(`users/${uid}/quizzes`, { limit: 2000 }),
    store().list(`users/${uid}/weakTopics`, { limit: 500 }),
    store().list(`users/${uid}/challenges`, { limit: 200 }),
  ]);
  const inMonth = (iso) => iso && istDay(iso).startsWith(month);
  const c = content.filter((x) => inMonth(x.createdAt));
  const done = quizzes.filter((q) => q.status === 'submitted' && inMonth(q.result?.submittedAt));

  const days = {};
  const bump = (iso, k) => { const d = istDay(iso); days[d] ||= { date: d, sessions: 0, quizzes: 0 }; days[d][k] += 1; };
  c.forEach((x) => bump(x.createdAt, 'sessions'));
  done.forEach((q) => bump(q.result.submittedAt, 'quizzes'));

  const topics = new Set(c.map((x) => x.topic.toLowerCase()));
  done.forEach((q) => q.topics.forEach((t) => topics.add(t.toLowerCase())));

  const totalQ = done.reduce((n, q) => n + q.result.total, 0);
  const correctQ = done.reduce((n, q) => n + q.result.score, 0);
  const byType = {};
  c.forEach((x) => { byType[x.type] = (byType[x.type] || 0) + 1; });

  // Streak = consecutive active days ending today (all-time activity).
  const active = new Set([...content.map((x) => istDay(x.createdAt)), ...quizzes.filter((q) => q.result).map((q) => istDay(q.result.submittedAt))]);
  let streak = 0;
  for (let d = new Date(`${istDay(new Date().toISOString())}T00:00:00Z`); active.has(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() - 1)) streak += 1;

  return {
    month,
    topicsStudied: topics.size,
    sessions: c.length,
    quizzesTaken: done.length,
    questionsAnswered: totalQ,
    accuracy: totalQ ? Math.round((correctQ / totalQ) * 100) : null,
    activeDays: Object.keys(days).length,
    streak,
    byType,
    daily: Object.values(days).sort((a, b) => (a.date > b.date ? 1 : -1)),
    quizScores: done.sort((a, b) => (a.result.submittedAt > b.result.submittedAt ? 1 : -1)).map((q) => ({ date: istDay(q.result.submittedAt), topic: q.topics.join(', '), percent: q.result.percent, kind: q.kind })),
    weakTopics: weak.filter((w) => w.strength < 0.7).sort((a, b) => a.strength - b.strength).slice(0, 8),
    strongTopics: weak.filter((w) => w.strength >= 0.7).sort((a, b) => b.strength - a.strength).slice(0, 8),
    challenges: challenges.filter((x) => x.status === 'submitted' && inMonth(x.submittedAt)).map((x) => ({ weekId: x.id, percent: x.percent, score: x.score, total: x.total })),
  };
}

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

reportsRouter.get('/monthly/:month', async (req, res, next) => {
  try {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(req.params.month)) return res.status(400).json({ error: 'Month must be YYYY-MM.' });
    res.json({ report: await buildReport(req.user.uid, req.params.month) });
  } catch (e) { next(e); }
});
