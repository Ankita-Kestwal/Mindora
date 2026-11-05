import { useEffect, useState } from 'react';
import { Trophy, Play, Lock, History } from 'lucide-react';
import { api } from '../lib/api.js';
import QuizPlayer from '../components/QuizPlayer.jsx';
import { Alert, useToast } from '../components/ui.jsx';

export default function ChallengePage() {
  const toast = useToast();
  const [c, setC] = useState(null);
  const [hist, setHist] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const load = () => { api('/challenges/current').then(setC).catch((e) => setErr(e.message)); api('/challenges/history').then((r) => setHist(r.items)).catch(() => {}); };
  useEffect(load, []);
  const start = async () => {
    setBusy(true); setErr('');
    try { const r = await api('/challenges/current/start', { method: 'POST' }); setC((x) => ({ ...x, quiz: r.quiz, entry: { status: 'in-progress' } })); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const submit = async (picks) => {
    setBusy(true);
    try { const r = await api('/challenges/current/submit', { method: 'POST', body: { answers: picks } }); setC((x) => ({ ...x, quiz: r.quiz, entry: { status: 'submitted' } })); load(); window.scrollTo({ top: 0 }); } catch (e) { toast('Could not submit', e.message, 'error'); } finally { setBusy(false); }
  };
  const fmt = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="page narrow">
      <section className="card">
        <h2 className="card-title"><Trophy /> Sunday challenge</h2>
        {!c && !err && <div className="skeleton" style={{ height: 120 }} />}
        <Alert type="error">{err}</Alert>
        {c && !c.quiz && (
          <div className="challenge-hero">
            <Trophy />
            <div>
              <h3>{c.questions} questions · {c.durationMin} minutes</h3>
              <p className="muted">A personal weekly challenge built from your interests and weak topics. One attempt per week; your results are private.</p>
              {c.anyDayMode && <p className="small" style={{ color: 'var(--warning)', marginTop: 6 }}>Demo mode: the challenge is open every day. Normally it opens only on Sundays.</p>}
            </div>
            {c.open
              ? <button className="btn btn-primary btn-lg" onClick={start} disabled={busy}>{busy ? <span className="spinner" /> : <Play />}{busy ? 'Preparing…' : 'Start challenge'}</button>
              : <span className="badge"><Lock size={14} /> Opens {fmt(c.nextSunday)}</span>}
          </div>
        )}
        {c?.quiz && <QuizPlayer key={c.quiz.id + c.quiz.status} quiz={c.quiz} onSubmit={submit} busy={busy} />}
      </section>
      <section className="card">
        <h2 className="card-title"><History /> Your past challenges</h2>
        {hist.length === 0 ? <p className="small muted">No completed challenges yet.</p> : (
          <ul className="rev-list">{hist.map((h) => <li key={h.id}><span className="grow"><b>Week {h.id}</b><small>{h.topics?.join(', ')}</small></span><span className="bar"><i style={{ width: `${h.percent}%` }} /></span><b>{h.score}/{h.total}</b></li>)}</ul>
        )}
      </section>
    </div>
  );
}
