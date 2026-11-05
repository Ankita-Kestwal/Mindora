import { useEffect, useState } from 'react';
import { LineChart, BookOpen, ListChecks, Target, Flame, CalendarDays, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { api } from '../lib/api.js';
import { typeLabel } from './Learn.jsx';

const monthNow = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 7);
const shift = (m, d) => { const [y, mo] = m.split('-').map(Number); const t = new Date(Date.UTC(y, mo - 1 + d, 1)); return t.toISOString().slice(0, 7); };

function Stat({ icon: Icon, label, value }) {
  return <div className="stat"><Icon /><div><b>{value}</b><small>{label}</small></div></div>;
}

export default function ReportsPage() {
  const [month, setMonth] = useState(monthNow());
  const [r, setR] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { setR(null); api(`/reports/monthly/${month}`).then((x) => setR(x.report)).catch((e) => setErr(e.message)); }, [month]);
  const label = new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const [y, mo] = month.split('-').map(Number);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const daily = Object.fromEntries((r?.daily || []).map((d) => [d.date, d]));
  const maxDay = Math.max(1, ...(r?.daily || []).map((d) => d.sessions + d.quizzes));

  return (
    <div className="page">
      <section className="card">
        <div className="card-head">
          <h2 className="card-title"><LineChart /> Monthly report · {label}</h2>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setMonth((m) => shift(m, -1))}>← Previous</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setMonth((m) => shift(m, 1))} disabled={month >= monthNow()}>Next →</button>
          </div>
        </div>
        <p className="small muted">Private to you — calculated from your own learning sessions, quizzes and challenges.</p>
        {err && <p className="error-text">{err}</p>}
        {!r && !err && <div className="skeleton" style={{ height: 100, marginTop: 14 }} />}
        {r && (<div className="stats">
          <Stat icon={BookOpen} label="Topics studied" value={r.topicsStudied} />
          <Stat icon={CalendarDays} label="Learning sessions" value={r.sessions} />
          <Stat icon={ListChecks} label="Quizzes taken" value={r.quizzesTaken} />
          <Stat icon={Target} label="Quiz accuracy" value={r.accuracy === null ? '—' : `${r.accuracy}%`} />
          <Stat icon={CalendarDays} label="Active days" value={r.activeDays} />
          <Stat icon={Flame} label="Current streak" value={`${r.streak} day${r.streak === 1 ? '' : 's'}`} />
        </div>)}
      </section>

      {r && (<>
        <section className="card">
          <h3 className="card-title"><CalendarDays /> Daily activity</h3>
          <div className="day-chart" role="img" aria-label={`Activity per day in ${label}`}>
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = `${month}-${String(i + 1).padStart(2, '0')}`; const v = daily[d];
              const n = v ? v.sessions + v.quizzes : 0;
              return <div key={d} className="day" title={`${i + 1}: ${v?.sessions || 0} sessions, ${v?.quizzes || 0} quizzes`}><i style={{ height: `${(n / maxDay) * 100}%` }} className={n ? 'on' : ''} /><small>{(i + 1) % 5 === 1 ? i + 1 : ''}</small></div>;
            })}
          </div>
        </section>
        <div className="grid-2 gap-lg">
          <section className="card">
            <h3 className="card-title"><ListChecks /> Quiz scores</h3>
            {r.quizScores.length === 0 ? <p className="small muted">No quizzes this month.</p> : (
              <ul className="rev-list">{r.quizScores.slice(-12).map((q, i) => <li key={i}><span className="grow"><b>{q.topic}</b><small>{q.date}{q.kind !== 'practice' ? ` · ${q.kind}` : ''}</small></span><span className="bar"><i style={{ width: `${q.percent}%` }} /></span><b>{q.percent}%</b></li>)}</ul>
            )}
            {Object.keys(r.byType).length > 0 && <><h3 className="card-title" style={{ marginTop: 18 }}><BookOpen /> What you generated</h3><div className="chip-row">{Object.entries(r.byType).map(([t, n]) => <span key={t} className="badge badge-primary">{typeLabel(t)} · {n}</span>)}</div></>}
          </section>
          <section className="card">
            <h3 className="card-title"><TrendingDown /> Weak topics</h3>
            {r.weakTopics.length === 0 ? <p className="small muted">None — keep it up.</p> : <div className="chip-row">{r.weakTopics.map((w) => <span key={w.id} className="badge badge-err">{w.topic} · {Math.round(w.strength * 100)}%</span>)}</div>}
            <h3 className="card-title" style={{ marginTop: 18 }}><TrendingUp /> Strong topics</h3>
            {r.strongTopics.length === 0 ? <p className="small muted">Take quizzes to find your strengths.</p> : <div className="chip-row">{r.strongTopics.map((w) => <span key={w.id} className="badge badge-ok">{w.topic} · {Math.round(w.strength * 100)}%</span>)}</div>}
            <h3 className="card-title" style={{ marginTop: 18 }}><Trophy /> Sunday challenges</h3>
            {r.challenges.length === 0 ? <p className="small muted">No challenges this month.</p> : <div className="chip-row">{r.challenges.map((c) => <span key={c.weekId} className="badge badge-primary">{c.weekId} · {c.score}/{c.total}</span>)}</div>}
          </section>
        </div>
      </>)}
    </div>
  );
}
