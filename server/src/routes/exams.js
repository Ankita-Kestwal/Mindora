// Stage 5a: exam timetable, reminders and in-app notifications.
import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/errors.js';
import { store } from '../repos/store.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const examSchema = z.object({
  name: z.string().trim().min(2, 'Enter the exam name.').max(120),
  subject: z.string().trim().max(80).optional().default(''),
  date: z.string().regex(DATE, 'Choose a date.'),
  time: z.string().regex(TIME).optional().or(z.literal('')).default(''),
  venue: z.string().trim().max(120).optional().default(''),
  notes: z.string().trim().max(500).optional().default(''),
  remindDaysBefore: z.array(z.number().int().min(0).max(60)).max(5).default([7, 1]),
}).strict();

// Calendar maths in India time (the app's audience); dates are stored as YYYY-MM-DD.
export function todayIST(now = Date.now()) {
  const d = new Date(now + 5.5 * 3600000);
  return d.toISOString().slice(0, 10);
}
export const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

/** Creates any due reminder notifications for this user (idempotent: deterministic ids). */
export async function syncReminders(uid, now = Date.now()) {
  const today = todayIST(now);
  const exams = await store().list(`users/${uid}/exams`, { limit: 200 });
  let created = 0;
  for (const ex of exams) {
    const left = daysBetween(today, ex.date);
    if (left < 0) continue;
    const reached = [...(ex.remindDaysBefore || [])].sort((a, b) => a - b).find((d) => left <= d);
    if (reached === undefined) continue;
    const id = `exam_${ex.id}_${reached}`;
    const when = left === 0 ? 'today' : left === 1 ? 'tomorrow' : `in ${left} days`;
    const ok = await store().create(`users/${uid}/notifications/${id}`, {
      type: 'exam', title: `${ex.name} is ${when}`, body: `${ex.subject ? `${ex.subject} · ` : ''}${ex.date}${ex.time ? ` at ${ex.time}` : ''}${ex.venue ? ` · ${ex.venue}` : ''}`,
      examId: ex.id, read: false, createdAt: new Date(now).toISOString(),
    });
    if (ok) created += 1;
  }
  return created;
}

export const examsRouter = Router();
examsRouter.use(requireAuth);

examsRouter.get('/', async (req, res, next) => {
  try {
    const items = (await store().list(`users/${req.user.uid}/exams`, { limit: 200 })).sort((a, b) => (a.date + a.time > b.date + b.time ? 1 : -1));
    const today = todayIST();
    res.json({ items: items.map((e) => ({ ...e, daysLeft: daysBetween(today, e.date) })), today });
  } catch (e) { next(e); }
});

examsRouter.post('/', validate(examSchema), async (req, res, next) => {
  try {
    const id = crypto.randomUUID();
    const exam = { ...req.valid, createdAt: new Date().toISOString() };
    await store().set(`users/${req.user.uid}/exams/${id}`, exam);
    await syncReminders(req.user.uid);
    res.status(201).json({ exam: { id, ...exam } });
  } catch (e) { next(e); }
});

examsRouter.put('/:id', validate(examSchema), async (req, res, next) => {
  try {
    const path = `users/${req.user.uid}/exams/${req.params.id}`;
    if (!(await store().get(path))) return res.status(404).json({ error: 'Exam not found.' });
    await store().update(path, req.valid);
    await syncReminders(req.user.uid);
    return res.json({ exam: { id: req.params.id, ...(await store().get(path)) } });
  } catch (e) { return next(e); }
});

examsRouter.delete('/:id', async (req, res, next) => {
  try { await store().delete(`users/${req.user.uid}/exams/${req.params.id}`); res.json({ ok: true }); } catch (e) { next(e); }
});

/* ---------- Notifications ---------- */
export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req, res, next) => {
  try {
    await syncReminders(req.user.uid);
    const items = await store().list(`users/${req.user.uid}/notifications`, { orderBy: 'createdAt', limit: 50 });
    res.json({ items, unread: items.filter((n) => !n.read).length });
  } catch (e) { next(e); }
});

notificationsRouter.put('/:id/read', async (req, res, next) => {
  try {
    const path = `users/${req.user.uid}/notifications/${req.params.id}`;
    if (!(await store().get(path))) return res.status(404).json({ error: 'Not found.' });
    await store().update(path, { read: true });
    return res.json({ ok: true });
  } catch (e) { return next(e); }
});

notificationsRouter.put('/read-all', async (req, res, next) => {
  try {
    const items = await store().list(`users/${req.user.uid}/notifications`, { limit: 200 });
    for (const n of items.filter((x) => !x.read)) await store().update(`users/${req.user.uid}/notifications/${n.id}`, { read: true });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
