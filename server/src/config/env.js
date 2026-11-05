// Loads server/.env. Secrets live ONLY here — never in /client.
import 'dotenv/config';

const bool = (v, d = false) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));
const list = (v, d = []) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : d);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  corsOrigins: list(process.env.CORS_ORIGINS, ['http://localhost:5173', 'http://127.0.0.1:5173']),

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    // Path to the service-account JSON, or the JSON itself (for hosts like Render)
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '',
    authEmulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST || '',
    firestoreEmulatorHost: process.env.FIRESTORE_EMULATOR_HOST || '',
  },

  // "firestore" (default) or "memory". Memory is for automated tests / offline demo only
  // and is reported as such by /api/health — it is never presented as Firestore.
  store: process.env.DATA_STORE || 'firestore',

  // Comma-separated emails that get the admin role on first sign-in
  adminEmails: list(process.env.ADMIN_EMAILS).map((e) => e.toLowerCase()),

  azure: {
    openaiEndpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
    openaiKey: process.env.AZURE_OPENAI_API_KEY || '',
    openaiDeployment: process.env.AZURE_OPENAI_DEPLOYMENT || '',
    openaiApiVersion: process.env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview',
    storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
    storageContainer: process.env.AZURE_STORAGE_CONTAINER || 'mindora-files',
  },

  trustProxy: bool(process.env.TRUST_PROXY, false),
};

export const isTest = env.nodeEnv === 'test';
