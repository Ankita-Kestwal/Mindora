import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { setStoreForTests, memoryStore } from '../src/repos/store.js';
import { cleanOutput } from '../src/services/azureAI.js';
import { emulatorUp, clearUsers, signUp, validProfile } from './helpers.js';

// A local stand-in that behaves like the Azure OpenAI chat-completions API.
let mock; let mockUrl; let next = null; const seen = [];
beforeAll(async () => {
  if (!(await emulatorUp())) throw new Error('Firebase Auth emulator is not running on 127.0.0.1:9099.');
  mock = http.createServer((req, res) => {
    let raw = ''; req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = JSON.parse(raw || '{}');
      seen.push({ url: req.url, key: req.headers['api-key'], body });
      const reply = next || { status: 200, json: { model: 'gpt-5-mini', choices: [{ finish_reason: 'stop', message: { content: `<think>planning…</think>## ${body.messages.at(-1).content.split('\n')[0]}\n\nAnswer body.` } }] } };
      next = null;
      res.writeHead(reply.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(reply.json));
    });
  }).listen(0);
  mockUrl = `http://127.0.0.1:${mock.address().port}/`;
});
afterAll(() => mock?.close());

const app = createApp();
const auth = (t) => ({ Authorization: `Bearer ${t}` });
async function onboarded(email) {
  const u = await signUp(email);
  await request(app).post('/api/me').set(auth(u.token)).send(validProfile);
  return u;
}

beforeEach(async () => {
  await clearUsers(); setStoreForTests(memoryStore()); seen.length = 0; next = null;
  Object.assign(env.azure, { openaiEndpoint: mockUrl, openaiKey: 'test-key', openaiDeployment: 'gpt-5-mini', openaiApiVersion: '2024-10-21' });
});

describe('Azure OpenAI request format', () => {
  it('uses the deployment URL, a reasoning-capable API version and the api-key header', async () => {
    const { token } = await onboarded('a@example.com');
    const r = await request(app).post('/api/learn/generate').set(auth(token)).send({ topic: 'Normalisation', subject: 'DBMS', type: 'notes' });
    expect(r.status).toBe(201);
    expect(seen[0].url).toBe('/openai/deployments/gpt-5-mini/chat/completions?api-version=2025-04-01-preview');
    expect(seen[0].key).toBe('test-key');
    expect(seen[0].body.max_completion_tokens).toBeGreaterThan(0);
    expect(seen[0].body.temperature).toBeUndefined();
    expect(seen[0].body.reasoning_effort).toBe('low');
    expect(seen[0].body.messages[0].content).toContain('Learner level: intermediate');
    expect(seen[0].body.messages[1].content).toContain('Subject: DBMS');
  });

  it('accepts the /openai/v1 endpoint style and a full pasted Target URI', async () => {
    const { token } = await onboarded('b@example.com');
    env.azure.openaiEndpoint = `${mockUrl}openai/v1/`;
    await request(app).post('/api/learn/generate').set(auth(token)).send({ topic: 'Stacks', type: 'explanation' });
    expect(seen[0].url).toBe('/openai/v1/chat/completions');
    expect(seen[0].body.model).toBe('gpt-5-mini');
    env.azure.openaiEndpoint = `${mockUrl}openai/deployments/gpt-5-mini/chat/completions?api-version=2025-04-01-preview`;
    await request(app).post('/api/learn/generate').set(auth(token)).send({ topic: 'Queues', type: 'explanation' });
    expect(seen[1].url).toBe('/openai/deployments/gpt-5-mini/chat/completions?api-version=2025-04-01-preview');
  });
});

describe('learning content', () => {
  it('saves AI content, strips thinking text and builds history', async () => {
    const { token } = await onboarded('c@example.com');
    let r = await request(app).post('/api/learn/generate').set(auth(token)).send({ topic: 'Normalisation', subject: 'DBMS', type: 'notes' });
    expect(r.body.content.body).not.toContain('<think>');
    expect(r.body.content.aiGenerated).toBe(true);
    const first = r.body.content;
    r = await request(app).post('/api/learn/generate').set(auth(token)).send({ topic: 'normalisation', subject: 'dbms', type: 'exam-answer', marks: 10 });
    expect(r.status).toBe(201);
    expect(seen[1].body.messages[1].content).toContain('worth 10 marks');

    r = await request(app).get('/api/learn/history').set(auth(token));
    expect(r.body.items).toHaveLength(1); // same topic, case-insensitive
    expect(r.body.items[0]).toMatchObject({ count: 2, lastType: 'exam-answer', types: ['notes', 'exam-answer'] });

    r = await request(app).get(`/api/learn/content?topicKey=${first.topicKey}`).set(auth(token));
    expect(r.body.items).toHaveLength(2);
    expect(r.body.items[0].body).toBeUndefined(); // list returns previews only

    r = await request(app).get(`/api/learn/content/${first.id}`).set(auth(token));
    expect(r.body.content.body).toContain('Answer body');
    expect((await request(app).delete(`/api/learn/content/${first.id}`).set(auth(token))).status).toBe(200);
    expect((await request(app).get(`/api/learn/content/${first.id}`).set(auth(token))).status).toBe(404);

    // Deleting the latest item repoints history; deleting the last one removes the topic.
    const h1 = (await request(app).get('/api/learn/history').set(auth(token))).body.items[0];
    await request(app).delete(`/api/learn/content/${h1.lastContentId}`).set(auth(token));
    expect((await request(app).get('/api/learn/history').set(auth(token))).body.items).toHaveLength(0);
  });

  it('history points to the newest remaining item after a delete', async () => {
    const { token } = await onboarded('h@example.com');
    const a = (await request(app).post('/api/learn/generate').set(auth(token)).send({ topic: 'Trees', type: 'notes' })).body.content;
    await new Promise((r) => setTimeout(r, 5));
    const b = (await request(app).post('/api/learn/generate').set(auth(token)).send({ topic: 'Trees', type: 'examples' })).body.content;
    await request(app).delete(`/api/learn/content/${b.id}`).set(auth(token));
    const h = (await request(app).get('/api/learn/history').set(auth(token))).body.items[0];
    expect(h).toMatchObject({ lastContentId: a.id, lastType: 'notes' });
  });

  it('keeps content private to its owner', async () => {
    const a = await onboarded('owner@example.com');
    const b = await onboarded('other@example.com');
    const r = await request(app).post('/api/learn/generate').set(auth(a.token)).send({ topic: 'Graphs', type: 'notes' });
    expect((await request(app).get(`/api/learn/content/${r.body.content.id}`).set(auth(b.token))).status).toBe(404);
    expect((await request(app).get('/api/learn/history').set(auth(b.token))).body.items).toHaveLength(0);
  });

  it('validates input', async () => {
    const { token } = await onboarded('v@example.com');
    expect((await request(app).post('/api/learn/generate').set(auth(token)).send({ topic: 'x', type: 'notes' })).status).toBe(400);
    expect((await request(app).post('/api/learn/generate').set(auth(token)).send({ topic: 'Sorting', type: 'poem' })).status).toBe(400);
    expect((await request(app).post('/api/learn/generate').set(auth(token)).send({ topic: 'Sorting', type: 'exam-answer' })).status).toBe(400);
    expect((await request(app).post('/api/learn/generate').set(auth(token)).send({ topic: 'Sorting', type: 'exam-answer', marks: 7 })).status).toBe(400);
    expect(seen).toHaveLength(0);
  });

  it('refuses non-academic topics', async () => {
    const { token } = await onboarded('na@example.com');
    next = { status: 200, json: { choices: [{ finish_reason: 'stop', message: { content: 'NOT_ACADEMIC' } }] } };
    const r = await request(app).post('/api/learn/generate').set(auth(token)).send({ topic: 'Celebrity gossip', type: 'notes' });
    expect(r.status).toBe(422);
    expect((await request(app).get('/api/learn/history').set(auth(token))).body.items).toHaveLength(0);
  });
});

describe('Azure errors become clear messages', () => {
  const cases = [
    [{ status: 401, json: { error: { code: '401', message: 'Access denied' } } }, 'API key'],
    [{ status: 404, json: { error: { code: 'DeploymentNotFound', message: 'nope' } } }, 'deployment not found'],
    [{ status: 429, json: { error: { code: '429', message: 'Too many' } } }, 'rate limit'],
    [{ status: 400, json: { error: { code: 'content_filter', message: 'filtered' } } }, 'content safety'],
  ];
  for (const [reply, text] of cases) {
    it(`${reply.status} → "${text}"`, async () => {
      const { token } = await onboarded(`e${reply.status}@example.com`);
      next = reply;
      const r = await request(app).post('/api/learn/generate').set(auth(token)).send({ topic: 'Sorting', type: 'notes' });
      expect(r.body.error.toLowerCase()).toContain(text.toLowerCase());
    });
  }

  it('reports when Azure is not configured', async () => {
    const { token } = await onboarded('nc@example.com');
    env.azure.openaiKey = '';
    const r = await request(app).post('/api/learn/generate').set(auth(token)).send({ topic: 'Sorting', type: 'notes' });
    expect(r.status).toBe(503);
    expect(r.body.error).toContain('not configured');
  });

  it('connection test endpoint', async () => {
    const { token } = await onboarded('t@example.com');
    next = { status: 200, json: { model: 'gpt-5-mini', choices: [{ finish_reason: 'stop', message: { content: 'ready' } }] } };
    const r = await request(app).post('/api/learn/test').set(auth(token));
    expect(r.body).toMatchObject({ ok: true, model: 'gpt-5-mini', reply: 'ready' });
  });
});

it('cleanOutput removes thinking blocks', () => {
  expect(cleanOutput('<think>a\nb</think>\n\nHello')).toBe('Hello');
  expect(cleanOutput('Plain')).toBe('Plain');
});
