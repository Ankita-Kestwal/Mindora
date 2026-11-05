import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setStoreForTests, memoryStore } from '../src/repos/store.js';
import { emulatorUp, clearUsers, signUp, validProfile } from './helpers.js';

const app = createApp();
const auth = (t) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  if (!(await emulatorUp())) throw new Error('Firebase Auth emulator is not running on 127.0.0.1:9099 (run `npm run emulators`).');
});
beforeEach(async () => { await clearUsers(); setStoreForTests(memoryStore()); });

describe('health', () => {
  it('reports services honestly', async () => {
    const r = await request(app).get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body.services.firebaseAuth).toMatchObject({ configured: true, mode: 'emulator' });
    expect(r.body.services.database.kind).toBe('memory');
    expect(r.body.services.azureBlobStorage.configured).toBe(false);
    expect(r.body.services.azureOpenAI.configured).toBe(false);
  });
});

describe('authentication', () => {
  it('rejects requests without a token', async () => {
    expect((await request(app).get('/api/me')).status).toBe(401);
  });
  it('rejects a forged token', async () => {
    expect((await request(app).get('/api/me').set(auth('eyJhbGciOiJub25lIn0.e30.'))).status).toBe(401);
  });
});

describe('profile + onboarding', () => {
  it('new user needs onboarding, then gets a Mindora ID', async () => {
    const { token } = await signUp('ankita@example.com');
    let r = await request(app).get('/api/me').set(auth(token));
    expect(r.status).toBe(200);
    expect(r.body.needsOnboarding).toBe(true);

    r = await request(app).post('/api/me').set(auth(token)).send(validProfile);
    expect(r.status).toBe(201);
    expect(r.body.profile.mindoraId).toMatch(/^MND-[A-Z2-9]{6}$/);
    expect(r.body.profile.role).toBe('user');
    expect(r.body.profile.prefs).toEqual({ theme: 'dark', autoTheme: false, autoIntervalMin: 5, font: 'inter' });

    r = await request(app).get('/api/me').set(auth(token));
    expect(r.body.needsOnboarding).toBe(false);
    expect(r.body.profile.email).toBe('ankita@example.com');
  });

  it('validates onboarding fields', async () => {
    const { token } = await signUp('v@example.com');
    const r = await request(app).post('/api/me').set(auth(token)).send({ ...validProfile, category: 'hacker', interests: [] });
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.fields)).toEqual(expect.arrayContaining(['category', 'interests']));
  });

  it('rejects unknown fields such as role escalation', async () => {
    const { token } = await signUp('esc@example.com');
    const r = await request(app).post('/api/me').set(auth(token)).send({ ...validProfile, role: 'admin' });
    expect(r.status).toBe(400);
  });

  it('cannot onboard twice', async () => {
    const { token } = await signUp('twice@example.com');
    await request(app).post('/api/me').set(auth(token)).send(validProfile);
    expect((await request(app).post('/api/me').set(auth(token)).send(validProfile)).status).toBe(409);
  });

  it('grants admin only to configured emails', async () => {
    const { token } = await signUp('admin@example.com');
    const r = await request(app).post('/api/me').set(auth(token)).send(validProfile);
    expect(r.body.profile.role).toBe('admin');
  });

  it('updates profile and preferences', async () => {
    const { token } = await signUp('prefs@example.com');
    await request(app).post('/api/me').set(auth(token)).send(validProfile);
    let r = await request(app).put('/api/me').set(auth(token)).send({ learningLevel: 'advanced', interests: ['Physics'] });
    expect(r.body.profile.learningLevel).toBe('advanced');
    r = await request(app).put('/api/me/prefs').set(auth(token)).send({ theme: 'light', autoTheme: true, autoIntervalMin: 10, font: 'sora' });
    expect(r.body.profile.prefs).toEqual({ theme: 'light', autoTheme: true, autoIntervalMin: 10, font: 'sora' });
    expect((await request(app).put('/api/me/prefs').set(auth(token)).send({ font: 'comic-sans' })).status).toBe(400);
    expect((await request(app).put('/api/me/prefs').set(auth(token)).send({ autoIntervalMin: 0 })).status).toBe(400);
  });

  it('keeps users isolated', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    await request(app).post('/api/me').set(auth(a.token)).send(validProfile);
    const r = await request(app).get('/api/me').set(auth(b.token));
    expect(r.body.needsOnboarding).toBe(true);
  });
});
