import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import { BlobServiceClient } from '@azure/storage-blob';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { setStoreForTests, memoryStore } from '../src/repos/store.js';
import { resetBlobForTests } from '../src/services/blob.js';
import { normaliseTree } from '../src/routes/syllabi.js';
import { emulatorUp, clearUsers, signUp, validProfile } from './helpers.js';

// Azurite = Microsoft's official Azure Storage emulator (npx azurite-blob, port 10000).
const AZURITE = 'UseDevelopmentStorage=true';

/** Minimal valid PDF with a text layer. */
function pdf(lines) {
  const content = `BT /F1 11 Tf 50 780 Td 14 TL ${lines.map((l) => `(${l}) Tj T*`).join(' ')} ET`;
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}
function png() { // 1x1 PNG
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
}

const TREE = { title: 'B.Tech DS Sem 3', subjects: [{ name: 'DBMS', units: [{ title: 'Unit 1: Relational Model', chapters: [{ title: 'Normalisation', topics: ['1NF', '2NF', '3NF', 'BCNF'] }] }, { title: 'Unit 2: SQL', chapters: [{ title: 'Queries', topics: ['Joins', 'Subqueries'] }] }] }] };
let mock; let mockUrl; let reply = null; const seen = [];
beforeAll(async () => {
  if (!(await emulatorUp())) throw new Error('Firebase Auth emulator is not running.');
  mock = http.createServer((req, res) => {
    let raw = ''; req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      seen.push(JSON.parse(raw));
      const content = reply ?? `\`\`\`json\n${JSON.stringify(TREE)}\n\`\`\``;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ model: 'gpt-5-mini', choices: [{ finish_reason: 'stop', message: { content } }] }));
    });
  }).listen(0);
  mockUrl = `http://127.0.0.1:${mock.address().port}/`;
});
afterAll(() => mock?.close());

const app = createApp();
const auth = (t) => ({ Authorization: `Bearer ${t}` });
async function user(email) { const u = await signUp(email); await request(app).post('/api/me').set(auth(u.token)).send(validProfile); return u; }
async function waitDone(token, id) {
  for (let i = 0; i < 50; i++) {
    const r = await request(app).get(`/api/syllabi/${id}`).set(auth(token));
    if (r.body.syllabus.status !== 'processing') return r.body.syllabus;
    await new Promise((x) => setTimeout(x, 100));
  }
  throw new Error('timeout');
}

beforeEach(async () => {
  await clearUsers(); setStoreForTests(memoryStore()); resetBlobForTests(); seen.length = 0; reply = null;
  Object.assign(env.azure, { openaiEndpoint: mockUrl, openaiKey: 'k', openaiDeployment: 'gpt-5-mini', storageConnectionString: AZURITE, storageContainer: `t${Date.now()}` });
});

describe('syllabus upload (Azure Blob Storage) and processing', () => {
  it('stores the real file in a private blob container and builds the tree', async () => {
    const { token, uid } = await user('s@example.com');
    const file = pdf(['B.Tech Data Science - Semester 3', 'DBMS', 'Unit 1 Relational model: normalisation 1NF 2NF 3NF BCNF', 'Unit 2 SQL: joins, subqueries']);
    let r = await request(app).post('/api/syllabi').set(auth(token)).attach('file', file, 'sem3 syllabus.pdf');
    expect(r.status).toBe(202);
    expect(r.body.syllabus.status).toBe('processing');
    const { id } = r.body.syllabus;

    // The bytes really are in Azure Blob Storage (Azurite), at the user's own path, and the container is private.
    const cont = BlobServiceClient.fromConnectionString(AZURITE).getContainerClient(env.azure.storageContainer);
    const blob = cont.getBlockBlobClient(`users/${uid}/syllabi/${id}/sem3_syllabus.pdf`);
    expect((await blob.downloadToBuffer()).equals(file)).toBe(true);
    expect((await blob.getProperties()).contentType).toBe('application/pdf');
    expect((await cont.getAccessPolicy()).blobPublicAccess).toBeUndefined();

    const s = await waitDone(token, id);
    expect(s.status).toBe('ready');
    expect(s.topicCount).toBe(6);
    expect(s.subjects[0].units[0].chapters[0].topics).toEqual(['1NF', '2NF', '3NF', 'BCNF']);
    expect(seen[0].response_format).toEqual({ type: 'json_object' });
    expect(seen[0].messages[1].content).toContain('normalisation 1NF');

    r = await request(app).get('/api/syllabi').set(auth(token));
    expect(r.body.items[0]).toMatchObject({ id, status: 'ready', subjectCount: 1 });
    expect(r.body.items[0].subjects).toBeUndefined();

    r = await request(app).get(`/api/syllabi/${id}/file`).set(auth(token)).buffer(true).parse((res, cb) => { const b = []; res.on('data', (c) => b.push(c)); res.on('end', () => cb(null, Buffer.concat(b))); });
    expect(r.headers['content-type']).toContain('application/pdf');
    expect(r.body.equals(file)).toBe(true);

    expect((await request(app).delete(`/api/syllabi/${id}`).set(auth(token))).status).toBe(200);
    expect(await blob.exists()).toBe(false);
    expect((await request(app).get(`/api/syllabi/${id}`).set(auth(token))).status).toBe(404);
  });

  it('sends images to the model as vision input', async () => {
    const { token } = await user('img@example.com');
    const r = await request(app).post('/api/syllabi').set(auth(token)).attach('file', png(), 'page1.png');
    const s = await waitDone(token, r.body.syllabus.id);
    expect(s.status).toBe('ready');
    const part = seen[0].messages[1].content.find((c) => c.type === 'image_url');
    expect(part.image_url.url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('rejects files that are not really PDF/JPG/PNG', async () => {
    const { token } = await user('bad@example.com');
    const r = await request(app).post('/api/syllabi').set(auth(token)).attach('file', Buffer.from('MZ fake exe'), 'syllabus.pdf');
    expect(r.status).toBe(415);
    expect((await request(app).post('/api/syllabi').set(auth(token))).status).toBe(400);
  });

  it('rejects files over 15 MB', async () => {
    const { token } = await user('big@example.com');
    const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(15 * 1024 * 1024 + 10)]);
    const r = await request(app).post('/api/syllabi').set(auth(token)).attach('file', big, 'big.pdf');
    expect(r.status).toBe(400);
    expect(r.body.error).toContain('15 MB');
  });

  it('explains scanned PDFs and non-syllabus files, and can re-process', async () => {
    const { token } = await user('f@example.com');
    let r = await request(app).post('/api/syllabi').set(auth(token)).attach('file', pdf(['x']), 'scan.pdf');
    let s = await waitDone(token, r.body.syllabus.id);
    expect(s.status).toBe('failed');
    expect(s.error).toContain('scanned PDF');

    reply = '{"title":"","subjects":[],"error":"not_a_syllabus"}';
    r = await request(app).post('/api/syllabi').set(auth(token)).attach('file', pdf(['Grocery list: milk, bread, eggs, butter, rice, tea, sugar, apples and bananas for the week']), 'list.pdf');
    s = await waitDone(token, r.body.syllabus.id);
    expect(s.error).toContain('doesn’t look like a syllabus');

    reply = null;
    expect((await request(app).post(`/api/syllabi/${s.id}/process`).set(auth(token))).status).toBe(202);
    s = await waitDone(token, s.id);
    expect(s.status).toBe('ready');
  });

  it('keeps syllabi private to their owner', async () => {
    const a = await user('a@example.com'); const b = await user('b@example.com');
    const r = await request(app).post('/api/syllabi').set(auth(a.token)).attach('file', png(), 'p.png');
    const { id } = r.body.syllabus;
    expect((await request(app).get(`/api/syllabi/${id}`).set(auth(b.token))).status).toBe(404);
    expect((await request(app).get(`/api/syllabi/${id}/file`).set(auth(b.token))).status).toBe(404);
    expect((await request(app).delete(`/api/syllabi/${id}`).set(auth(b.token))).status).toBe(404);
    await waitDone(a.token, id);
  });

  it('reports missing storage configuration clearly', async () => {
    const { token } = await user('nc@example.com');
    env.azure.storageConnectionString = '';
    const r = await request(app).post('/api/syllabi').set(auth(token)).attach('file', png(), 'p.png');
    expect(r.status).toBe(503);
    expect(r.body.error).toContain('AZURE_STORAGE_CONNECTION_STRING');
  });
});

it('normaliseTree cleans and caps model output', () => {
  const t = normaliseTree({ title: 'X', subjects: [{ name: 'S', units: [{ title: 'U', chapters: [{ title: 'C', topics: ['a', '', 'b'.repeat(200)] }] }] }, { name: 'Empty', units: [] }] });
  expect(t.subjects).toHaveLength(1);
  expect(t.subjects[0].units[0].chapters[0].topics).toEqual(['a', 'b'.repeat(80)]);
  expect(t.topicCount).toBe(2);
});

