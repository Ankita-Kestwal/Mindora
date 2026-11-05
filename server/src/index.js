import { createApp } from './app.js';
import { env } from './config/env.js';
import { firebaseStatus } from './services/firebase.js';

if (env.nodeEnv === 'production' && env.store === 'memory') {
  console.error('Refusing to start: DATA_STORE=memory is for testing only and loses all data. Use DATA_STORE=firestore in production.');
  process.exit(1);
}
if (env.nodeEnv === 'production' && env.firebase.authEmulatorHost) {
  console.error('Refusing to start: FIREBASE_AUTH_EMULATOR_HOST must not be set in production.');
  process.exit(1);
}
const app = createApp();
app.listen(env.port, () => {
  const fb = firebaseStatus();
  console.log(`Mindora API on http://localhost:${env.port}`);
  console.log(`  Firebase: ${fb.configured ? fb.mode : `NOT CONFIGURED — ${fb.reason}`}`);
  console.log(`  Data store: ${env.store}${env.store === 'memory' ? ' (in-memory: data is lost on restart — for testing only)' : ''}`);
});
