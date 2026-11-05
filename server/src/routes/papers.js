// Stage 5b: question papers.
//  ① Official previous-year papers — an admin-curated catalogue. Each paper links to an
//     OFFICIAL source (allow-listed government/board domains) or is a PDF the admin uploads.
//     Mindora never scrapes or copies papers from other websites.
//  ② AI-generated practice papers — built from a format the user writes; always labelled.
import { Router } from 'express';
import crypto from 'node:crypto';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/errors.js';
import { store } from '../repos/store.js';
import { getUser } from '../repos/users.js';
import { uploadBlob, downloadBlob, deleteBlob } from '../services/blob.js';
import { chat, AIError } from '../services/azureAI.js';
import { allowAI, AI_LIMIT } from '../services/limits.js';

export const EXAMS = ['CBSE Class 10', 'CBSE Class 12', 'State Board Class 10', 'State Board Class 12', 'JEE Main', 'JEE Advanced', 'NEET UG', 'UPSC CSE Prelims', 'UPSC CSE Mains', 'GATE', 'CUET', 'University', 'Other'];

// Official sources only (subdomains allowed). Extend in server/.env with OFFICIAL_PAPER_DOMAINS.
export const OFFICIAL_DOMAINS = [
  // Indian government (gov.in, nic.in — includes CBSE, NTA, UPSC, state boards) and academic domains (ac.in, edu.in — IITs, universities).
  'gov.in', 'nic.in', 'ac.in', 'edu.in', 'cisce.org',
  ...(process.env.OFFICIAL_PAPER_DOMAINS || '').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean),
];
export function isOfficialUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    return OFFICIAL_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch { return false; }
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } });

export const papersRouter = Router();
papersRouter.use(requireAuth);

/* ---------- ① Official papers ---------- */
papersRouter.get('/official', async (req, res, next) => {
  try {
    let items = await store().list('officialPapers', { limit: 500 });
    const { exam, subject, year } = req.query;
    if (exam) items = items.filter((p) => p.exam === exam);
    if (subject) items = items.filter((p) => p.subject.toLowerCase().includes(String(subject).toLowerCase()));
    if (year) items = items.filter((p) => String(p.year) === String(year));
    items.sort((a, b) => b.year - a.year || a.exam.localeCompare(b.exam) || a.subject.localeCompare(b.subject));
    res.json({ items: items.map(({ blobPath, ...p }) => ({ ...p, hasFile: Boolean(blobPath) })), exams: EXAMS });
  } catch (e) { next(e); }
});

papersRouter.get('/official/:id/file', async (req, res, next) => {
  try {
    const p = await store().get(`officialPapers/${req.params.id}`);
    if (!p?.blobPath) return res.status(404).json({ error: 'No stored file for this paper.' });
    const buf = await downloadBlob(p.blobPath);
    const name = `${p.exam}-${p.subject}-${p.year}`.replace(/[^\w.-]+/g, '_');
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${name}.pdf"`, 'Cache-Control': 'private, max-age=3600' });
    return res.send(buf);
  } catch (e) { return next(e); }
});

const paperFields = z.object({
  exam: z.enum(EXAMS),
  subject: z.string().trim().min(2).max(80),
  year: z.coerce.number().int().min(1990).max(new Date().getFullYear()),
  session: z.string().trim().max(60).optional().default(''),
  sourceName: z.string().trim().min(2, 'Name the official source.').max(120),
  sourceUrl: z.string().trim().url('Enter the official page URL.').refine(isOfficialUrl, 'Use an https link on an official government, board or university website.'),
});

papersRouter.post('/official', requireAdmin, (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'PDF is too large (max 25 MB).' : 'Upload failed.' });
    try {
      const r = paperFields.safeParse(req.body || {});
      if (!r.success) return res.status(400).json({ error: 'Please check the highlighted fields.', fields: Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message])) });
      const id = crypto.randomUUID();
      let blobPath = null;
      if (req.file) {
        if (req.file.buffer.subarray(0, 4).toString() !== '%PDF') return res.status(415).json({ error: 'Only PDF files can be uploaded for papers.' });
        blobPath = `official-papers/${id}.pdf`;
        await uploadBlob(blobPath, req.file.buffer, 'application/pdf');
      }
      const paper = { ...r.data, blobPath, verified: true, addedBy: req.user.email, createdAt: new Date().toISOString() };
      await store().set(`officialPapers/${id}`, paper);
      return res.status(201).json({ paper: { id, ...paper, blobPath: undefined, hasFile: Boolean(blobPath) } });
    } catch (e) { return next(e); }
  });
});

papersRouter.delete('/official/:id', requireAdmin, async (req, res, next) => {
  try {
    const p = await store().get(`officialPapers/${req.params.id}`);
    if (!p) return res.status(404).json({ error: 'Not found.' });
    if (p.blobPath) await deleteBlob(p.blobPath);
    await store().delete(`officialPapers/${req.params.id}`);
    return res.json({ ok: true });
  } catch (e) { return next(e); }
});

/* ---------- ② AI-generated papers ---------- */
export const PRESETS = {
  'CBSE Class 10': { duration: 180, sections: [['A – MCQ', 'mcq', 20, 1], ['B – Very short answer', 'short', 5, 2], ['C – Short answer', 'short', 6, 3], ['D – Long answer', 'long', 4, 5], ['E – Case study', 'case', 3, 4]] },
  'CBSE Class 12': { duration: 180, sections: [['A – MCQ', 'mcq', 16, 1], ['B – Very short answer', 'short', 5, 2], ['C – Short answer', 'short', 7, 3], ['D – Case study', 'case', 2, 4], ['E – Long answer', 'long', 3, 5]] },
  'JEE Main': { duration: 180, sections: [['MCQ (single correct)', 'mcq', 20, 4], ['Numerical value', 'numerical', 5, 4]] },
  'NEET UG': { duration: 200, sections: [['Section A – MCQ', 'mcq', 35, 4], ['Section B – MCQ', 'mcq', 10, 4]] },
  'UPSC CSE Mains': { duration: 180, sections: [['10-mark questions (150 words)', 'long', 10, 10], ['15-mark questions (250 words)', 'long', 10, 15]] },
  University: { duration: 180, sections: [['A – Short answer', 'short', 5, 2], ['B – Medium answer', 'long', 5, 5], ['C – Long answer', 'long', 3, 10]] },
};

const sectionSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(['mcq', 'short', 'long', 'numerical', 'case']),
  count: z.number().int().min(1).max(50),
  marksEach: z.number().int().min(1).max(30),
});
const genSchema = z.object({
  title: z.string().trim().min(2).max(120),
  examStyle: z.string().trim().max(60).optional().default('University'),
  subject: z.string().trim().min(2, 'Enter the subject.').max(80),
  topics: z.string().trim().max(1500).optional().default(''),
  durationMin: z.number().int().min(10).max(300),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
  sections: z.array(sectionSchema).min(1).max(8),
  instructions: z.string().trim().max(800).optional().default(''),
  includeAnswers: z.boolean().default(true),
}).strict().refine((d) => d.sections.reduce((n, s) => n + s.count, 0) <= 80, { message: 'At most 80 questions per paper.', path: ['sections'] });

const TYPE_TEXT = { mcq: 'multiple-choice (4 options, label a–d)', short: 'short-answer', long: 'long-answer / descriptive', numerical: 'numerical-answer', case: 'case-study / source-based (a short passage followed by sub-questions)' };

papersRouter.get('/presets', (req, res) => res.json({ presets: PRESETS, exams: EXAMS }));

papersRouter.post('/generate', validate(genSchema), async (req, res, next) => {
  const v = req.valid;
  try {
    if (!allowAI(req.user.uid)) return res.status(429).json({ error: `You’ve reached ${AI_LIMIT} AI requests this hour. Please try again later.` });
    const profile = await getUser(req.user.uid);
    const total = v.sections.reduce((n, s) => n + s.count * s.marksEach, 0);
    const spec = v.sections.map((s, i) => `${i + 1}. Section "${s.name}": ${s.count} ${TYPE_TEXT[s.type]} question(s), ${s.marksEach} mark(s) each`).join('\n');
    const messages = [
      { role: 'system', content: `You are an experienced paper-setter. Write ORIGINAL practice questions in the style of ${v.examStyle}. Never copy or claim to reproduce real past-paper questions. Only academic subjects; otherwise reply exactly NOT_ACADEMIC. Learner level: ${profile?.learningLevel || 'intermediate'}. Format in Markdown.` },
      { role: 'user', content: `Create a question paper.\nTitle: ${v.title}\nSubject: ${v.subject}\n${v.topics ? `Cover these topics/syllabus:\n${v.topics}\n` : ''}Time allowed: ${v.durationMin} minutes · Maximum marks: ${total}\nDifficulty: ${v.difficulty}\nSections:\n${spec}\n${v.instructions ? `Extra instructions from the learner: ${v.instructions}\n` : ''}\nStart with the title, time, maximum marks and general instructions. Number questions continuously and show the marks for each in brackets.${v.includeAnswers ? ' After the paper, add a heading "## Answer key and marking scheme" with answers (MCQ letter + one-line reason; key points for descriptive answers with mark split).' : ''}` },
    ];
    const r = await chat(messages, { maxTokens: 16000, timeoutMs: 240000 });
    if (/^NOT_ACADEMIC\b/.test(r.text)) return res.status(422).json({ error: 'Mindora only creates papers for academic subjects.' });
    const id = crypto.randomUUID();
    const paper = { ...v, totalMarks: total, body: r.text, truncated: r.truncated, aiGenerated: true, model: r.model, createdAt: new Date().toISOString() };
    await store().set(`users/${req.user.uid}/generatedPapers/${id}`, paper);
    return res.status(201).json({ paper: { id, ...paper } });
  } catch (e) {
    if (e instanceof AIError) return res.status(e.status).json({ error: e.message });
    return next(e);
  }
});

papersRouter.get('/generated', async (req, res, next) => {
  try {
    const items = await store().list(`users/${req.user.uid}/generatedPapers`, { orderBy: 'createdAt', limit: 100 });
    res.json({ items: items.map(({ body, ...p }) => p) });
  } catch (e) { next(e); }
});

papersRouter.get('/generated/:id', async (req, res, next) => {
  try {
    const p = await store().get(`users/${req.user.uid}/generatedPapers/${req.params.id}`);
    if (!p) return res.status(404).json({ error: 'Not found.' });
    return res.json({ paper: p });
  } catch (e) { return next(e); }
});

papersRouter.delete('/generated/:id', async (req, res, next) => {
  try { await store().delete(`users/${req.user.uid}/generatedPapers/${req.params.id}`); res.json({ ok: true }); } catch (e) { next(e); }
});
