import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Fingerprint, User, Activity, RefreshCw, Settings, Copy, PlayCircle, Sparkles, Zap, CalendarClock, Repeat, Trophy, ListChecks, Upload } from 'lucide-react';
import { useHistory } from './History.jsx';
import { typeLabel } from './Learn.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { useToast } from '../components/ui.jsx';
import { CATEGORIES, EDUCATION, LEVELS } from './Onboarding.jsx';

const label = (list, id) => list.find((x) => x[0] === id)?.[1] || id;

function ServiceRow({ name, s, detail }) {
  const cls = s.ok ? 'badge-ok' : s.pending ? 'badge' : 'badge-warn';
  return (
    <div className="svc">
      <div><b>{name}</b><small>{detail}</small></div>
      <span className={`badge ${cls}`}><span className="dot" />{s.text}</span>
    </div>
  );
}

export function ServicesCard() {
  const [h, setH] = useState(null);
  const [err, setErr] = useState('');
  const load = () => { setErr(''); setH(null); api('/health', { auth: false }).then(setH).catch((e) => setErr(e.message)); };
  useEffect(load, []);
  const s = h?.services;
  const [test, setTest] = useState(null);
  const runTest = async () => {
    setTest({ busy: true });
    try { const r = await api('/learn/test', { method: 'POST' }); setTest({ ok: `Azure OpenAI replied in ${(r.ms / 1000).toFixed(1)} s (model ${r.model}).` }); } catch (e) { setTest({ err: e.message }); }
  };
  return (
    <section className="card">
      <div className="card-head"><h2 className="card-title"><Activity /> Cloud services</h2><button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw /> Re-check</button></div>
      {err && <p className="error-text">{err}</p>}
      {!h && !err && <div className="skeleton" style={{ height: 140 }} />}
      {s && (<div className="svc-list">
        <ServiceRow name="Google Firebase — Authentication" s={s.firebaseAuth.configured ? { ok: true, text: s.firebaseAuth.mode === 'emulator' ? 'Emulator' : 'Connected' } : { text: 'Not configured' }} detail={s.firebaseAuth.configured ? `Project ${s.firebaseAuth.projectId}` : s.firebaseAuth.reason} />
        <ServiceRow name="Google Firebase — Cloud Firestore" s={s.database.kind === 'firestore' ? (s.database.reachable ? { ok: true, text: 'Connected' } : { text: 'Unreachable' }) : { text: 'Test store' }} detail={s.database.kind === 'firestore' ? 'Profiles and learning records' : 'In-memory store — data is not saved. Set DATA_STORE=firestore.'} />
        <ServiceRow name="Microsoft Azure — OpenAI" s={s.azureOpenAI.configured ? (test?.ok ? { ok: true, text: 'Connected' } : test?.err ? { text: 'Error' } : { ok: true, text: 'Configured' }) : { text: 'Not configured' }} detail={s.azureOpenAI.configured ? `Deployment ${s.azureOpenAI.deployment}` : 'Add your keys to server/.env'} />
        {s.azureOpenAI.configured && (<div className="svc-test">
          <button className="btn btn-secondary btn-sm" onClick={runTest} disabled={test?.busy}>{test?.busy ? <span className="spinner" /> : <Zap />} Test Azure connection</button>
          {test?.ok && <span className="small" style={{ color: 'var(--teal)' }}>{test.ok}</span>}
          {test?.err && <span className="small error-text">{test.err}</span>}
        </div>)}
        <ServiceRow name="Microsoft Azure — Blob Storage" s={s.azureBlobStorage.configured ? { ok: true, text: 'Configured' } : { text: 'Not configured' }} detail={s.azureBlobStorage.configured ? `Private container ${s.azureBlobStorage.container}` : 'Add AZURE_STORAGE_CONNECTION_STRING to server/.env'} />
      </div>)}
    </section>
  );
}

function UpcomingExams() {
  const [items, setItems] = useState(null);
  useEffect(() => { api('/exams').then((r) => setItems(r.items.filter((e) => e.daysLeft >= 0).slice(0, 4))).catch(() => setItems([])); }, []);
  return (
    <section className="card">
      <div className="card-head"><h2 className="card-title"><CalendarClock /> Upcoming exams</h2><Link className="btn btn-ghost btn-sm" to="/app/exams">Manage</Link></div>
      {!items && <div className="skeleton" style={{ height: 70 }} />}
      {items?.length === 0 && <p className="muted small">No upcoming exams. <Link to="/app/exams">Add your timetable</Link> to get reminders.</p>}
      <ul className="rev-list">{items?.map((e) => <li key={e.id}><span className="grow"><b>{e.name}</b><small>{e.date}{e.time ? ` · ${e.time}` : ''}</small></span><span className={`badge ${e.daysLeft <= 3 ? 'badge-err' : e.daysLeft <= 7 ? 'badge-warn' : 'badge-primary'}`}>{e.daysLeft === 0 ? 'Today' : e.daysLeft === 1 ? 'Tomorrow' : `${e.daysLeft} days`}</span></li>)}</ul>
    </section>
  );
}

function RevisionCard() {
  const [p, setP] = useState(null);
  useEffect(() => { api('/revision/plan').then(setP).catch(() => setP({ needsWork: [], due: [], notTested: [] })); }, []);
  const list = p ? [...p.needsWork, ...p.due].slice(0, 4) : null;
  return (
    <section className="card">
      <div className="card-head"><h2 className="card-title"><Repeat /> Revise next</h2><Link className="btn btn-ghost btn-sm" to="/app/revision">Open plan</Link></div>
      {!list && <div className="skeleton" style={{ height: 70 }} />}
      {list?.length === 0 && <p className="muted small">{p.notTested.length ? `${p.notTested.length} studied topic(s) not tested yet — try Smart Revision.` : 'Take a quiz to start tracking weak topics.'}</p>}
      <ul className="rev-list">{list?.map((w) => <li key={w.id}><span className="grow"><b>{w.topic}</b><small>{w.mistakes} mistakes</small></span><span className="bar"><i style={{ width: `${Math.round(w.strength * 100)}%` }} /></span><span className="small">{Math.round(w.strength * 100)}%</span></li>)}</ul>
    </section>
  );
}

function ContinueLearning() {
  const { items } = useHistory();
  return (
    <section className="card">
      <div className="card-head"><h2 className="card-title"><PlayCircle /> Continue learning</h2><Link className="btn btn-primary btn-sm" to="/app/learn"><Sparkles /> New topic</Link></div>
      {!items && <div className="skeleton" style={{ height: 70 }} />}
      {items?.length === 0 && <p className="muted small">Nothing yet — open <Link to="/app/learn">AI Learning</Link> and study your first topic.</p>}
      {items?.length > 0 && (<div className="continue-row">
        {items.slice(0, 4).map((h) => (
          <Link key={h.id} className="continue-card" to={`/app/learn?id=${h.lastContentId}`}>
            <b>{h.topic}</b><small>{h.subject || 'General'} · last: {typeLabel(h.lastType)}</small><span className="small" style={{ color: 'var(--primary)' }}>Resume →</span>
          </Link>
        ))}
      </div>)}
    </section>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  const toast = useToast();
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const copyId = async () => { try { await navigator.clipboard.writeText(profile.mindoraId); toast('Mindora ID copied', profile.mindoraId, 'success'); } catch { toast('Could not copy', 'Select the ID and copy it manually.', 'error'); } };

  return (
    <div className="page">
      <section className="welcome">
        <div>
          <h2>{greet}, {profile.displayName.split(' ')[0]}</h2>
          <p>What would you like to learn today?</p>
        </div>
        <button className="id-pill" onClick={copyId} title="Copy Mindora ID"><Fingerprint /> {profile.mindoraId} <Copy size={14} /></button>
      </section>

      <ContinueLearning />

      <div className="grid-2 gap-lg">
        <section className="card">
          <div className="card-head"><h2 className="card-title"><User /> Your learning profile</h2><Link className="btn btn-ghost btn-sm" to="/app/settings"><Settings /> Edit</Link></div>
          <dl className="dl">
            <div><dt>Account type</dt><dd>{label(CATEGORIES, profile.category)}</dd></div>
            <div><dt>Education</dt><dd>{label(EDUCATION, profile.education?.level)}{profile.education?.course ? ` · ${profile.education.course}` : ''}</dd></div>
            {profile.education?.institution && <div><dt>Institution</dt><dd>{profile.education.institution}</dd></div>}
            <div><dt>Learning level</dt><dd>{label(LEVELS, profile.learningLevel)}</dd></div>
            <div className="full"><dt>Interests</dt><dd className="chip-row">{profile.interests.map((i) => <span key={i} className="badge badge-primary">{i}</span>)}</dd></div>
          </dl>
        </section>
        <ServicesCard />
      </div>

      <div className="grid-2 gap-lg">
        <UpcomingExams />
        <RevisionCard />
      </div>
      <section className="card quick">
        <Link to="/app/quizzes"><ListChecks /> Take a quiz</Link>
        <Link to="/app/syllabus"><Upload /> Upload syllabus</Link>
        <Link to="/app/papers"><Sparkles /> Practice paper</Link>
        <Link to="/app/challenge"><Trophy /> Sunday challenge</Link>
      </section>
    </div>
  );
}
