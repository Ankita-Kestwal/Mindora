import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { setStoreForTests, memoryStore } from '../src/repos/store.js';
import { resetBlobForTests } from '../src/services/blob.js';
import { isOfficialUrl } from '../src/routes/papers.js';
import { weekIdIST, isSundayIST } from '../src/routes/challenges.js';
import { syncReminders, todayIST } from '../src/routes/exams.js';
import { emulatorUp, clearUsers, signUp, validProfile } from './helpers.js';

// Stand-in for Azure OpenAI: MCQ JSON when JSON mode is requested, Markdown otherwise.
let mock; let mockUrl; const seen = [];
const mcqs = (n, topic) => ({ questions: Array.from({ length: n }, (_, i) => ({ question: `Q${i + 1} about ${topic}?`, options: ['A', 'B', 'C', 'D'], answer: i % 4, explanation: `Because ${i % 4}`, topic })) });
beforeAll(async () => {
  if (!(await emulatorUp())) throw new Error('Firebase Auth emulator is not running.');
  mock = http.createServer((req, res) => {
    let raw = ''; req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const b = JSON.parse(raw); seen.push(b);
      const u = b.messages.at(-1).content;
      const n = Number((/Write (\d+)/.exec(u) || [])[1] || 5);
      const topic = (/on: ([^;(.]+)/.exec(u) || [])[1]?.trim() || 'x';
      const content = b.response_format ? JSON.stringify(mcqs(n, topic)) : '# Practice paper\n\n1. Question (5 marks)\n\n## Answer key and marking scheme\n\n1. Key points';
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

beforeEach(async () => {
  await clearUsers(); setStoreForTests(memoryStore()); resetBlobForTests(); seen.length = 0;
  Object.assign(env.azure, { openaiEndpoint: mockUrl, openaiKey: 'k', openaiDeployment: 'gpt-5-mini', storageConnectionString: 'UseDevelopmentStorage=true', storageContainer: `t${Date.now()}` });
  delete process.env.CHALLENGE_ANY_DAY;
});

describe('Stage 4 — quizzes and smart revision', () => {
  it('hides answers until submit, scores, and tracks weak topics', async () => {
    const { token } = await user('q@example.com');
    let r = await request(app).post('/api/quizzes/generate').set(auth(token)).send({ topic: 'Normalisation', subject: 'DBMS', count: 8, difficulty: 'medium' });
    expect(r.status).toBe(201);
    const quiz = r.body.quiz;
    expect(quiz.questions).toHaveLength(8);
    expect(quiz.questions[0].answer).toBeUndefined();
    expect(quiz.answers).toBeUndefined();
    // answer index i%4 is correct; pick 0 for all → questions 0 and 4 right
    r = await request(app).post(`/api/quizzes/${quiz.id}/submit`).set(auth(token)).send({ answers: Array(8).fill(0) });
    expect(r.body.quiz.result).toMatchObject({ score: 2, total: 8, percent: 25 });
    expect(r.body.quiz.answers).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
    expect(r.body.quiz.explanations[1]).toBe('Because 1');
    expect((await request(app).post(`/api/quizzes/${quiz.id}/submit`).set(auth(token)).send({ answers: [] })).status).toBe(409);

    r = await request(app).get('/api/revision/plan').set(auth(token));
    expect(r.body.needsWork[0]).toMatchObject({ topic: 'Normalisation', strength: 0.25, mistakes: 6 });
    r = await request(app).post('/api/revision/quiz').set(auth(token)).send({});
    expect(r.status).toBe(201);
    expect(r.body.quiz.kind).toBe('revision');
    expect(seen.at(-1).messages[1].content).toContain('Normalisation');
    r = await request(app).get('/api/quizzes').set(auth(token));
    expect(r.body.items).toHaveLength(2);
  });

  it('marks timed quizzes submitted after the time limit as late', async () => {
    const { token, uid } = await user('t@example.com');
    const q = (await request(app).post('/api/quizzes/generate').set(auth(token)).send({ topic: 'Stacks', count: 3, timed: true, durationMin: 1 })).body.quiz;
    const { store } = await import('../src/repos/store.js');
    await store().update(`users/${uid}/quizzes/${q.id}`, { startedAt: new Date(Date.now() - 5 * 60000).toISOString() });
    const r = await request(app).post(`/api/quizzes/${q.id}/submit`).set(auth(token)).send({ answers: [0, 1, 2] });
    expect(r.body.quiz.result.late).toBe(true);
  });

  it('revision needs some history first', async () => {
    const { token } = await user('r@example.com');
    expect((await request(app).post('/api/revision/quiz').set(auth(token)).send({})).status).toBe(400);
  });
});

describe('Stage 5 — exams, reminders, papers', () => {
  it('creates exams and due reminders exactly once', async () => {
    const { token, uid } = await user('e@example.com');
    const inDays = (n) => new Date(Date.now() + 5.5 * 3600000 + n * 86400000).toISOString().slice(0, 10);
    await request(app).post('/api/exams').set(auth(token)).send({ name: 'DBMS Mid-sem', subject: 'DBMS', date: inDays(5), time: '10:00', remindDaysBefore: [7, 1] });
    await request(app).post('/api/exams').set(auth(token)).send({ name: 'Physics Final', date: inDays(30) });
    expect((await request(app).post('/api/exams').set(auth(token)).send({ name: 'X', date: '5th Jan' })).status).toBe(400);
    let r = await request(app).get('/api/exams').set(auth(token));
    expect(r.body.items.map((e) => e.daysLeft)).toEqual([5, 30]);
    r = await request(app).get('/api/notifications').set(auth(token));
    expect(r.body.unread).toBe(1);
    expect(r.body.items[0].title).toBe('DBMS Mid-sem is in 5 days');
    expect(await syncReminders(uid)).toBe(0); // idempotent
    await request(app).put(`/api/notifications/${r.body.items[0].id}/read`).set(auth(token));
    expect((await request(app).get('/api/notifications').set(auth(token))).body.unread).toBe(0);
  });

  it('only admins can add official papers, only from official domains', async () => {
    const admin = await user('admin@example.com');
    const normal = await user('n@example.com');
    const fields = { exam: 'CBSE Class 12', subject: 'Physics', year: '2025', sourceName: 'CBSE Academic', sourceUrl: 'https://cbseacademic.nic.in/SQP_CLASSXII_2024-25.html' };
    let r = await request(app).post('/api/papers/official').set(auth(normal.token)).field(fields);
    expect(r.status).toBe(403);
    r = await request(app).post('/api/papers/official').set(auth(admin.token)).field({ ...fields, sourceUrl: 'https://somecoachingsite.com/papers' });
    expect(r.status).toBe(400);
    expect(r.body.fields.sourceUrl).toContain('official');
    r = await request(app).post('/api/papers/official').set(auth(admin.token)).field(fields).attach('file', Buffer.from('%PDF-1.4\n%fake but valid header'), 'p.pdf');
    expect(r.status).toBe(201);
    r = await request(app).get('/api/papers/official?exam=CBSE%20Class%2012').set(auth(normal.token));
    expect(r.body.items).toHaveLength(1);
    expect(r.body.items[0]).toMatchObject({ hasFile: true, sourceName: 'CBSE Academic' });
    const f = await request(app).get(`/api/papers/official/${r.body.items[0].id}/file`).set(auth(normal.token));
    expect(f.headers['content-type']).toContain('application/pdf');
  });

  it('official-domain check', () => {
    expect(isOfficialUrl('https://jeemain.nta.ac.in/x')).toBe(true);
    expect(isOfficialUrl('https://upsc.gov.in/examinations/previous-question-papers')).toBe(true);
    expect(isOfficialUrl('http://upsc.gov.in/')).toBe(false);
    expect(isOfficialUrl('https://upsc.gov.in.evil.com/')).toBe(false);
    expect(isOfficialUrl('https://example.com/')).toBe(false);
  });

  it('generates an AI paper from a user-written format', async () => {
    const { token } = await user('p@example.com');
    const body = { title: 'DBMS Sem 3 practice', examStyle: 'University', subject: 'DBMS', topics: 'Normalisation, SQL joins', durationMin: 180, difficulty: 'mixed', sections: [{ name: 'A', type: 'short', count: 5, marksEach: 2 }, { name: 'B', type: 'long', count: 3, marksEach: 10 }], includeAnswers: true };
    let r = await request(app).post('/api/papers/generate').set(auth(token)).send(body);
    expect(r.status).toBe(201);
    expect(r.body.paper).toMatchObject({ totalMarks: 40, aiGenerated: true });
    const prompt = seen.at(-1).messages[1].content;
    expect(prompt).toContain('Maximum marks: 40');
    expect(prompt).toContain('3 long-answer / descriptive question(s), 10 mark(s) each');
    expect(seen.at(-1).messages[0].content).toContain('Never copy');
    r = await request(app).get('/api/papers/generated').set(auth(token));
    expect(r.body.items[0].body).toBeUndefined();
    expect((await request(app).post('/api/papers/generate').set(auth(token)).send({ ...body, sections: [] })).status).toBe(400);
  });
});

describe('Stage 6 — Sunday challenge and reports', () => {
  it('opens only on Sunday unless demo mode, one attempt per week', async () => {
    const { token } = await user('c@example.com');
    let r = await request(app).get('/api/challenges/current').set(auth(token));
    expect(r.body.weekId).toBe(weekIdIST());
    if (!isSundayIST()) {
      expect(r.body.open).toBe(false);
      expect((await request(app).post('/api/challenges/current/start').set(auth(token))).status).toBe(403);
    }
    process.env.CHALLENGE_ANY_DAY = 'true';
    r = await request(app).post('/api/challenges/current/start').set(auth(token));
    expect(r.status).toBe(201);
    expect(r.body.quiz).toMatchObject({ kind: 'challenge', timed: true, durationMin: 20 });
    expect(r.body.quiz.questions).toHaveLength(15);
    expect((await request(app).post('/api/challenges/current/start').set(auth(token))).status).toBe(409);
    expect((await request(app).post(`/api/quizzes/${r.body.quiz.id}/submit`).set(auth(token)).send({ answers: [] })).status).toBe(400);
    r = await request(app).post('/api/challenges/current/submit').set(auth(token)).send({ answers: Array(15).fill(1) });
    expect(r.body.quiz.result.total).toBe(15);
    r = await request(app).get('/api/challenges/history').set(auth(token));
    expect(r.body.items).toHaveLength(1);
  });

  it('builds a monthly report from the user’s own activity', async () => {
    const { token } = await user('rep@example.com');
    await request(app).post('/api/learn/generate').set(auth(token)).send({ topic: 'Graphs', type: 'notes' });
    const q = (await request(app).post('/api/quizzes/generate').set(auth(token)).send({ topic: 'Graphs', count: 4 })).body.quiz;
    await request(app).post(`/api/quizzes/${q.id}/submit`).set(auth(token)).send({ answers: [0, 1, 2, 3] });
    const month = todayIST().slice(0, 7);
    const r = await request(app).get(`/api/reports/monthly/${month}`).set(auth(token));
    expect(r.body.report).toMatchObject({ sessions: 1, quizzesTaken: 1, questionsAnswered: 4, accuracy: 100, activeDays: 1, streak: 1, byType: { notes: 1 } });
    expect(r.body.report.strongTopics[0].topic).toBe('Graphs');
    expect((await request(app).get('/api/reports/monthly/2026-13').set(auth(token))).status).toBe(400);
  });

  it('weekId format', () => {
    expect(weekIdIST(Date.parse('2026-11-08T06:00:00Z'))).toBe('2026-W45'); // Sunday 8 Nov 2026
    expect(isSundayIST(Date.parse('2026-11-08T06:00:00Z'))).toBe(true);
    expect(isSundayIST(Date.parse('2026-11-07T20:00:00Z'))).toBe(true); // 01:30 Sunday IST
  });
});
