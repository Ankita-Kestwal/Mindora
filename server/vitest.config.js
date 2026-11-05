import { defineConfig } from 'vitest/config';

// Tests use the real Firebase Auth emulator (start it with `npm run emulators` in the repo root)
// and the in-memory data store.
export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATA_STORE: 'memory',
      FIREBASE_PROJECT_ID: 'demo-mindora',
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      ADMIN_EMAILS: 'admin@example.com',
    },
    testTimeout: 20000,
    fileParallelism: false,
  },
});
