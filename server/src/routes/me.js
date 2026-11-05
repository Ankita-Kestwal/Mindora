import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/errors.js';
import { getUser, createUser, updateUser } from '../repos/users.js';

export const CATEGORIES = ['student', 'teacher', 'professional', 'researcher', 'independent', 'other'];
export const EDUCATION_LEVELS = ['school', 'higher-secondary', 'undergraduate', 'postgraduate', 'doctorate', 'professional', 'other'];
export const LEARNING_LEVELS = ['beginner', 'intermediate', 'advanced'];
export const FONTS = ['inter', 'poppins', 'sora', 'ibm-plex-sans', 'lexend', 'source-serif'];

const text = (max) => z.string().trim().max(max);

const education = z.object({
  level: z.enum(EDUCATION_LEVELS),
  board: text(80).optional().default(''),
  institution: text(120).optional().default(''),
  course: text(120).optional().default(''),
  semester: text(20).optional().default(''),
});

export const prefsSchema = z.object({
  theme: z.enum(['dark', 'light']),
  autoTheme: z.boolean(),
  autoIntervalMin: z.number().int().min(1).max(240),
  font: z.enum(FONTS),
}).partial();

const profileFields = {
  displayName: z.string().trim().min(2, 'Enter your name (2–80 characters).').max(80),
  category: z.enum(CATEGORIES),
  education,
  interests: z.array(text(40).min(1)).min(1, 'Pick at least one interest.').max(12),
  learningLevel: z.enum(LEARNING_LEVELS),
};

const createSchema = z.object({ ...profileFields, prefs: prefsSchema.optional() }).strict();
const updateSchema = z.object(profileFields).partial().strict();

const publicProfile = (p) => p && ({
  displayName: p.displayName, email: p.email, mindoraId: p.mindoraId, role: p.role,
  category: p.category, education: p.education, interests: p.interests, learningLevel: p.learningLevel,
  prefs: p.prefs, createdAt: p.createdAt, updatedAt: p.updatedAt,
});

export const meRouter = Router();
meRouter.use(requireAuth);

meRouter.get('/', async (req, res, next) => {
  try {
    const p = await getUser(req.user.uid);
    res.json({ profile: publicProfile(p), needsOnboarding: !p, account: { email: req.user.email, emailVerified: req.user.emailVerified } });
  } catch (e) { next(e); }
});

meRouter.post('/', validate(createSchema), async (req, res, next) => {
  try { res.status(201).json({ profile: publicProfile(await createUser(req.user, req.valid)) }); } catch (e) { next(e); }
});

meRouter.put('/', validate(updateSchema), async (req, res, next) => {
  try { res.json({ profile: publicProfile(await updateUser(req.user.uid, req.valid)) }); } catch (e) { next(e); }
});

meRouter.put('/prefs', validate(prefsSchema), async (req, res, next) => {
  try {
    const p = await getUser(req.user.uid);
    if (!p) return res.status(404).json({ error: 'Complete onboarding first.' });
    const prefs = { ...p.prefs, ...req.valid };
    res.json({ profile: publicProfile(await updateUser(req.user.uid, { prefs })) });
  } catch (e) { return next(e); }
});
