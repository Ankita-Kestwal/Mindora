import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ListChecks, Wand2, History, Repeat, Target, TrendingDown, TrendingUp, Clock } from 'lucide-react';
import { api } from '../lib/api.js';
import QuizPlayer from '../components/QuizPlayer.jsx';
import { Alert, useToast } from '../components/ui.jsx';

const when = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export function useQuiz() {
  const [quiz, setQuiz] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const submit = useCallback(async (picks, path) => {
    setBusy(true);
    try { const r = await api(path || `/quizzes/${quiz.id}/submit`, { method: 'POST', body: { answers: picks } }); setQuiz(r.quiz); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { toast('Could not submit', e.message, 'error'); } finally { setBusy(false); }
  }, [quiz, toast]);
  return { quiz, setQuiz, busy, submit };
}

function QuizHistory({ items, open }) {
  if (!items) return <div className="skeleton" style={{ height: 120 }} />;
  if (!items.length) return <p className="small muted">No quizzes yet.</p>;
  return (
    <ul className="saved-list">
      {items.map((q) => (
        <li key={q.id}><button onClick={() => open(q.id)}>
          <span><b>{q.topics.join(', ')}</b><small style={{ display: 'block' }}>{q.kind !== 'practice' ? `${q.kind} · ` : ''}{q.count} Qs · {when(q.createdAt)}</small></span>
          {q.result ? <span className={`badge ${q.result.percent >= 70 ? 'badge-ok' : q.result.percent >= 40 ? 'badge-warn' : 'badge-err'}`}>{q.result.percent}%</span> : <span className="badge">Not submitted</span>}
        </button></li>
      ))}
    </ul>
  );
}

export default function QuizzesPage() {
  const [params] = useSearchParams();
  const [f, setF] = useState({ topic: params.get('topic') || '', subject: params.get('subject') || '', count: 10, difficulty: 'medium', timed: false, durationMin: 10 });
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState('');
  const [list, setList] = useState(null);
  const { quiz, setQuiz, busy, submit } = useQuiz();
  const load = () => api('/quizzes').then((r) => setList(r.items)).catch(() => setList([]));
  useEffect(() => { load(); }, [quiz?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async (e) => {
    e.preventDefault(); setErr('');
    if (f.topic.trim().length < 2) { setErr('Enter a topic.'); return; }
    setGen(true);
    try { const r = await api('/quizzes/generate', { method: 'POST', body: { ...f, topic: f.topic.trim(), subject: f.subject.trim(), ...(f.timed ? {} : { durationMin: undefined }) } }); setQuiz(r.quiz); load(); } catch (ex) { setErr(Object.values(ex.fields || {}).join(' ') || ex.message); } finally { setGen(false); }
  };
  const open = async (id) => { try { setQuiz((await api(`/quizzes/${id}`)).quiz); window.scrollTo({ top: 0 }); } catch (e) { setErr(e.message); } };

  return (
    <div className="page">
      {!quiz && (
        <form className="card form" onSubmit={generate}>
          <h2 className="card-title"><ListChecks /> New quiz</h2>
          <div className="learn-inputs">
            <div className="field"><label htmlFor="qt">Topic</label><input id="qt" className="input" value={f.topic} maxLength={120} onChange={(e) => setF({ ...f, topic: e.target.value })} placeholder="e.g. SQL joins, Thermodynamics" /></div>
            <div className="field"><label htmlFor="qs">Subject (optional)</label><input id="qs" className="input" value={f.subject} maxLength={80} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>
          </div>
          <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
            <label className="row" style={{ gap: 8 }}><span className="label">Questions</span><select className="input" style={{ width: 90 }} value={f.count} onChange={(e) => setF({ ...f, count: +e.target.value })}>{[5, 10, 15, 20].map((n) => <option key={n}>{n}</option>)}</select></label>
            <label className="row" style={{ gap: 8 }}><span className="label">Difficulty</span><select className="input" style={{ width: 130 }} value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
            <label className="check"><input type="checkbox" checked={f.timed} onChange={(e) => setF({ ...f, timed: e.target.checked })} /> Timed assessment</label>
            {f.timed && <label className="row" style={{ gap: 8 }}><span className="label">Minutes</span><input className="input" type="number" min={1} max={180} style={{ width: 90 }} value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: Math.max(1, Math.min(180, +e.target.value || 1)) })} /></label>}
            <span style={{ flex: 1 }} />
            <button className="btn btn-primary btn-lg" disabled={gen}>{gen ? <span className="spinner" /> : <Wand2 />}{gen ? 'Creating…' : 'Create quiz'}</button>
          </div>
          {gen && <p className="small muted">Azure OpenAI is writing your questions — usually 15–40 seconds.</p>}
          <Alert type="error">{err}</Alert>
        </form>
      )}
      <div className="learn-grid">
        <section className="card">
          {quiz ? (<>
            <header className="result-head"><div><h2>{quiz.topics.join(', ')}</h2><p className="small muted">{quiz.questions.length} questions · {quiz.difficulty}{quiz.timed ? ` · ${quiz.durationMin} min timed` : ''} · AI-generated practice</p></div>
              <button className="btn btn-secondary btn-sm" onClick={() => setQuiz(null)}>New quiz</button></header>
            <QuizPlayer key={quiz.id + quiz.status} quiz={quiz} onSubmit={(p) => submit(p)} busy={busy} />
          </>) : <div className="empty"><ListChecks /><h3>Practise any topic</h3><p className="muted">AI-generated multiple-choice questions with explanations. Your results feed Smart Revision.</p></div>}
        </section>
        <aside className="card saved"><h3 className="card-title"><History /> Past quizzes</h3><QuizHistory items={list} open={open} /></aside>
      </div>
    </div>
  );
}

export function RevisionPage() {
  const [plan, setPlan] = useState(null);
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState('');
  const { quiz, setQuiz, busy, submit } = useQuiz();
  useEffect(() => { api('/revision/plan').then(setPlan).catch((e) => setErr(e.message)); }, [quiz?.status]);
  const start = async (topics) => {
    setGen(true); setErr('');
    try { setQuiz((await api('/revision/quiz', { method: 'POST', body: topics ? { topics } : {} })).quiz); } catch (e) { setErr(e.message); } finally { setGen(false); }
  };
  const pct = (s) => `${Math.round(s * 100)}%`;
  if (quiz) {
    return (<div className="page narrow"><section className="card">
      <header className="result-head"><div><h2>Revision quiz</h2><p className="small muted">{quiz.topics.join(', ')}</p></div><button className="btn btn-secondary btn-sm" onClick={() => setQuiz(null)}>Back to plan</button></header>
      <QuizPlayer key={quiz.id + quiz.status} quiz={quiz} onSubmit={(p) => submit(p)} busy={busy} />
    </section></div>);
  }
  const empty = plan && !plan.needsWork.length && !plan.due.length && !plan.notTested.length && !plan.strong.length;
  return (
    <div className="page">
      <section className="card">
        <div className="card-head"><h2 className="card-title"><Repeat /> Smart revision</h2>
          <button className="btn btn-primary" onClick={() => start()} disabled={gen || empty || !plan}>{gen ? <span className="spinner" /> : <Wand2 />} Start revision quiz</button></div>
        <p className="muted small">Built from the topics you studied, the mistakes you made and your quiz scores. Strength is your recent accuracy on a topic.</p>
        <Alert type="error">{err}</Alert>
        {!plan && !err && <div className="skeleton" style={{ height: 160, marginTop: 14 }} />}
        {empty && <div className="empty"><Repeat /><h3>Nothing to revise yet</h3><p className="muted">Study topics in <Link to="/app/learn">AI Learning</Link> and take <Link to="/app/quizzes">quizzes</Link> — your revision plan appears here.</p></div>}
      </section>
      {plan && !empty && (<div className="grid-2 gap-lg">
        <section className="card"><h3 className="card-title"><TrendingDown /> Needs work</h3>
          {plan.needsWork.length ? <ul className="rev-list">{plan.needsWork.map((w) => <li key={w.id}><span className="grow"><b>{w.topic}</b><small>{w.mistakes} mistakes · last practised {when(w.lastSeen)}</small></span><span className="bar"><i style={{ width: pct(w.strength) }} /></span><span className="small">{pct(w.strength)}</span><button className="btn btn-ghost btn-sm" onClick={() => start([w.topic])}>Revise</button></li>)}</ul> : <p className="small muted">No weak topics — well done.</p>}
        </section>
        <section className="card"><h3 className="card-title"><Clock /> Due for review</h3>
          {plan.due.length ? <ul className="rev-list">{plan.due.map((w) => <li key={w.id}><span className="grow"><b>{w.topic}</b><small>Last practised {when(w.lastSeen)}</small></span><button className="btn btn-ghost btn-sm" onClick={() => start([w.topic])}>Revise</button></li>)}</ul> : <p className="small muted">Nothing is overdue.</p>}
          <h3 className="card-title" style={{ marginTop: 18 }}><Target /> Studied but not tested</h3>
          {plan.notTested.length ? <ul className="rev-list">{plan.notTested.slice(0, 8).map((t) => <li key={t.topic}><span className="grow"><b>{t.topic}</b><small>{t.subject || 'General'}</small></span><button className="btn btn-ghost btn-sm" onClick={() => start([t.topic])}>Test me</button></li>)}</ul> : <p className="small muted">Every studied topic has been tested.</p>}
        </section>
        {plan.strong.length > 0 && <section className="card"><h3 className="card-title"><TrendingUp /> Strong topics</h3><div className="chip-row">{plan.strong.map((w) => <span key={w.id} className="badge badge-ok">{w.topic} · {pct(w.strength)}</span>)}</div></section>}
      </div>)}
    </div>
  );
}
