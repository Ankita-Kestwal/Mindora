import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { meRouter } from './routes/me.js';
import { learnRouter } from './routes/learn.js';
import { syllabiRouter } from './routes/syllabi.js';
import { quizzesRouter, revisionRouter } from './routes/quizzes.js';
import { examsRouter, notificationsRouter } from './routes/exams.js';
import { papersRouter } from './routes/papers.js';
import { challengesRouter } from './routes/challenges.js';
import { reportsRouter } from './routes/reports.js';
import { notFound, errorHandler } from './middleware/errors.js';

export function createApp() {
  const app = express();
  if (env.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, allowedHeaders: ['Content-Type', 'Authorization'], methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
  app.use(express.json({ limit: '200kb' }));
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));

  app.use('/api/health', healthRouter);
  app.use('/api/me', meRouter);
  app.use('/api/learn', learnRouter);
  app.use('/api/syllabi', syllabiRouter);
  app.use('/api/quizzes', quizzesRouter);
  app.use('/api/revision', revisionRouter);
  app.use('/api/exams', examsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/papers', papersRouter);
  app.use('/api/challenges', challengesRouter);
  app.use('/api/reports', reportsRouter);

  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
