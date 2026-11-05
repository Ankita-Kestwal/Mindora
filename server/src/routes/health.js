import { Router } from 'express';
import { env } from '../config/env.js';
import { firebaseStatus } from '../services/firebase.js';
import { store } from '../repos/store.js';

const started = Date.now();
export const healthRouter = Router();

// Reports what is actually configured. Nothing here pretends a service is live.
healthRouter.get('/', async (req, res) => {
  const fb = firebaseStatus();
  let db = { kind: env.store, reachable: false };
  try { const s = store(); db = { kind: s.kind, reachable: await s.ping() }; } catch (e) { db.reason = e.message; }
  res.json({
    status: 'ok',
    uptimeSec: Math.round((Date.now() - started) / 1000),
    services: {
      firebaseAuth: fb,
      database: db,
      azureOpenAI: { configured: Boolean(env.azure.openaiEndpoint && env.azure.openaiKey && env.azure.openaiDeployment), deployment: env.azure.openaiDeployment || null, },
      azureBlobStorage: { configured: Boolean(env.azure.storageConnectionString && !env.azure.storageConnectionString.startsWith('paste')), container: env.azure.storageContainer },
    },
  });
});
