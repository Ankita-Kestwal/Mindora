import { useEffect, useState } from 'react';
import { FileText, ShieldCheck, Wand2, ExternalLink, Download, Trash2, Plus, X, AlertTriangle } from 'lucide-react';
import { api, apiUpload, apiBlobUrl } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Markdown from '../components/Markdown.jsx';
import { Alert, useToast } from '../components/ui.jsx';

const TYPES = [['mcq', 'MCQ'], ['short', 'Short answer'], ['long', 'Long answer'], ['numerical', 'Numerical'], ['case', 'Case study']];

function Official() {
  const { profile } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState({ exam: '', subject: '', year: '' });
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ exam: 'CBSE Class 12', subject: '', year: new Date().getFullYear() - 1, session: '', sourceName: '', sourceUrl: '' });
  const [file, setFile] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api(`/papers/official?${new URLSearchParams(Object.fromEntries(Object.entries(filter).filter(([, v]) => v)))}`).then(setData).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const add = async (e) => {
    e.preventDefault(); setErr('');
    const fd = new FormData(); Object.entries(f).forEach(([k, v]) => fd.append(k, v)); if (file) fd.append('file', file);
    try { await apiUpload('/papers/official', fd); toast('Paper added', '', 'success'); setAdding(false); setFile(null); load(); } catch (ex) { setErr(Object.values(ex.fields || {}).join(' ') || ex.message); }
  };
  const open = async (p) => { try { const u = await apiBlobUrl(`/papers/official/${p.id}/file`); window.open(u, '_blank', 'noopener'); } catch (e) { toast('Could not open', e.message, 'error'); } };
  const remove = async (p) => { if (!window.confirm('Remove this paper from the catalogue?')) return; await api(`/papers/official/${p.id}`, { method: 'DELETE' }); load(); };
  const isAdmin = profile.role === 'admin';
  return (
    <section className="card">
      <div className="card-head"><h2 className="card-title"><ShieldCheck /> Official previous-year papers</h2>{isAdmin && <button className="btn btn-secondary btn-sm" onClick={() => setAdding((a) => !a)}>{adding ? <X /> : <Plus />}{adding ? 'Close' : 'Add paper'}</button>}</div>
      <p className="small muted">Authentic papers from official sources only (CBSE, state boards, NTA, UPSC, universities). Each shows where it comes from. These are never AI-generated.</p>
      {adding && (
        <form className="admin-form" onSubmit={add}>
          <select className="input" value={f.exam} onChange={(e) => setF({ ...f, exam: e.target.value })} aria-label="Exam">{data?.exams.map((x) => <option key={x}>{x}</option>)}</select>
          <input className="input" placeholder="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} aria-label="Subject" />
          <input className="input" type="number" placeholder="Year" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} aria-label="Year" />
          <input className="input" placeholder="Session (optional, e.g. January)" value={f.session} onChange={(e) => setF({ ...f, session: e.target.value })} aria-label="Session" />
          <input className="input" placeholder="Official source name (e.g. CBSE Academic)" value={f.sourceName} onChange={(e) => setF({ ...f, sourceName: e.target.value })} aria-label="Source name" />
          <input className="input" placeholder="Official page URL (https://…gov.in / nic.in / ac.in)" value={f.sourceUrl} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} aria-label="Source URL" />
          <label className="check"><input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} /> PDF copy (optional, from the official site)</label>
          <button className="btn btn-primary">Add to catalogue</button>
        </form>
      )}
      <Alert type="error">{err}</Alert>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', margin: '14px 0' }}>
        <select className="input" style={{ width: 200 }} value={filter.exam} onChange={(e) => setFilter({ ...filter, exam: e.target.value })} aria-label="Filter by exam"><option value="">All exams</option>{data?.exams.map((x) => <option key={x}>{x}</option>)}</select>
        <input className="input" style={{ width: 180 }} placeholder="Subject" value={filter.subject} onChange={(e) => setFilter({ ...filter, subject: e.target.value })} aria-label="Filter by subject" />
        <input className="input" style={{ width: 110 }} placeholder="Year" value={filter.year} onChange={(e) => setFilter({ ...filter, year: e.target.value })} aria-label="Filter by year" />
      </div>
      {!data && <div className="skeleton" style={{ height: 80 }} />}
      {data?.items.length === 0 && <div className="empty"><ShieldCheck /><h3>No official papers yet</h3><p className="muted">{isAdmin ? 'Use “Add paper” to catalogue papers from official websites.' : 'Your administrator adds papers from official sources. Meanwhile, use the AI paper generator below for practice.'}</p></div>}
      <ul className="paper-list">{data?.items.map((p) => (
        <li key={p.id}><FileText /><div className="grow"><b>{p.exam} · {p.subject} · {p.year}{p.session ? ` (${p.session})` : ''}</b><small>Source: {p.sourceName}</small></div>
          <span className="badge badge-ok">Official</span>
          {p.hasFile && <button className="btn btn-secondary btn-sm" onClick={() => open(p)}><Download /> PDF</button>}
          <a className="btn btn-ghost btn-sm" href={p.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink /> Source</a>
          {isAdmin && <button className="icon-btn" onClick={() => remove(p)} aria-label="Remove"><Trash2 /></button>}
        </li>
      ))}</ul>
    </section>
  );
}

function Generator({ onCreated }) {
  const [presets, setPresets] = useState(null);
  const [f, setF] = useState({ title: '', examStyle: 'University', subject: '', topics: '', durationMin: 180, difficulty: 'mixed', instructions: '', includeAnswers: true, sections: [{ name: 'A – Short answer', type: 'short', count: 5, marksEach: 2 }, { name: 'B – Long answer', type: 'long', count: 3, marksEach: 10 }] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { api('/papers/presets').then(setPresets).catch(() => {}); }, []);
  const applyPreset = (name) => {
    const p = presets?.presets[name];
    setF((s) => ({ ...s, examStyle: name, ...(p ? { durationMin: p.duration, sections: p.sections.map(([n, type, count, marksEach]) => ({ name: n, type, count, marksEach })) } : {}) }));
  };
  const setSec = (i, k, v) => setF((s) => ({ ...s, sections: s.sections.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));
  const total = f.sections.reduce((n, s) => n + s.count * s.marksEach, 0);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const r = await api('/papers/generate', { method: 'POST', body: { ...f, title: f.title.trim() || `${f.subject} practice paper`, sections: f.sections.map((s) => ({ ...s, count: +s.count, marksEach: +s.marksEach })), durationMin: +f.durationMin } }); onCreated(r.paper); } catch (ex) { setErr(Object.values(ex.fields || {}).join(' ') || ex.message); } finally { setBusy(false); }
  };
  return (
    <form className="card form" onSubmit={submit}>
      <h2 className="card-title"><Wand2 /> AI practice paper generator</h2>
      <p className="small muted">Describe the paper you want — Mindora writes original practice questions in that format. These are AI-generated, not real past papers.</p>
      <div className="exam-grid">
        <div className="field"><label htmlFor="ps">Exam style</label><select id="ps" className="input" value={f.examStyle} onChange={(e) => applyPreset(e.target.value)}>{(presets?.exams || ['University']).map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label htmlFor="psub">Subject</label><input id="psub" className="input" value={f.subject} maxLength={80} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="e.g. Physics, DBMS" /></div>
        <div className="field"><label htmlFor="pt">Title (optional)</label><input id="pt" className="input" value={f.title} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="field"><label htmlFor="pd">Duration (minutes)</label><input id="pd" className="input" type="number" min={10} max={300} value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: e.target.value })} /></div>
        <div className="field"><label htmlFor="pdf">Difficulty</label><select id="pdf" className="input" value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option><option value="mixed">Mixed</option></select></div>
      </div>
      <div className="field"><label htmlFor="ptop">Topics or syllabus to cover (optional)</label><textarea id="ptop" className="input" rows={3} style={{ height: 'auto', padding: 12 }} maxLength={1500} value={f.topics} onChange={(e) => setF({ ...f, topics: e.target.value })} placeholder="e.g. Unit 1: Normalisation; Unit 2: SQL joins and subqueries" /></div>
      <span className="label">Sections · total {total} marks</span>
      <div className="sec-list">{f.sections.map((s, i) => (
        <div key={i} className="sec-row">
          <input className="input" value={s.name} maxLength={60} onChange={(e) => setSec(i, 'name', e.target.value)} aria-label="Section name" />
          <select className="input" value={s.type} onChange={(e) => setSec(i, 'type', e.target.value)} aria-label="Question type">{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <input className="input" type="number" min={1} max={50} value={s.count} onChange={(e) => setSec(i, 'count', Math.max(1, +e.target.value || 1))} aria-label="Number of questions" />
          <span className="small muted">×</span>
          <input className="input" type="number" min={1} max={30} value={s.marksEach} onChange={(e) => setSec(i, 'marksEach', Math.max(1, Math.min(30, +e.target.value || 1)))} aria-label="Marks each" />
          <span className="small muted">marks</span>
          <button type="button" className="icon-btn" onClick={() => setF((x) => ({ ...x, sections: x.sections.filter((_, j) => j !== i) }))} disabled={f.sections.length === 1} aria-label="Remove section"><Trash2 /></button>
        </div>
      ))}</div>
      <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => setF((x) => ({ ...x, sections: [...x.sections, { name: `Section ${String.fromCharCode(65 + x.sections.length)}`, type: 'long', count: 2, marksEach: 10 }] }))} disabled={f.sections.length >= 8}><Plus /> Add section</button></div>
      <div className="field"><label htmlFor="pins">Extra instructions (optional)</label><input id="pins" className="input" maxLength={800} value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} placeholder="e.g. include one diagram-based question" /></div>
      <label className="check"><input type="checkbox" checked={f.includeAnswers} onChange={(e) => setF({ ...f, includeAnswers: e.target.checked })} /> Include answer key and marking scheme</label>
      <Alert type="error">{err}</Alert>
      <div className="row-end"><button className="btn btn-primary btn-lg" disabled={busy || f.subject.trim().length < 2}>{busy ? <span className="spinner" /> : <Wand2 />}{busy ? 'Writing paper… (up to 2 min)' : 'Generate paper'}</button></div>
    </form>
  );
}

export default function PapersPage() {
  const toast = useToast();
  const [mine, setMine] = useState(null);
  const [open, setOpen] = useState(null);
  const load = () => api('/papers/generated').then((r) => setMine(r.items)).catch(() => setMine([]));
  useEffect(() => { load(); }, []);
  const show = async (id) => { try { setOpen((await api(`/papers/generated/${id}`)).paper); setTimeout(() => document.getElementById('paper-view')?.scrollIntoView({ behavior: 'smooth' }), 50); } catch (e) { toast('Could not open', e.message, 'error'); } };
  const del = async (p) => { if (!window.confirm('Delete this paper?')) return; await api(`/papers/generated/${p.id}`, { method: 'DELETE' }); setOpen(null); load(); };
  return (
    <div className="page">
      <Official />
      <Generator onCreated={(p) => { setOpen(p); load(); setTimeout(() => document.getElementById('paper-view')?.scrollIntoView({ behavior: 'smooth' }), 50); }} />
      <div className="learn-grid">
        <section className="card result" id="paper-view">
          {!open ? <div className="empty"><FileText /><h3>Your generated papers</h3><p className="muted">Generated papers open here. Print with Ctrl + P.</p></div> : (<>
            <header className="result-head"><div><h2>{open.title}</h2><p className="small muted">{open.examStyle} · {open.subject} · {open.durationMin} min · {open.totalMarks} marks</p></div>
              <div className="row" style={{ gap: 6 }}><button className="btn btn-secondary btn-sm" onClick={() => window.print()}>Print</button><button className="icon-btn" onClick={() => del(open)} aria-label="Delete"><Trash2 /></button></div></header>
            <p className="ai-note"><AlertTriangle /> AI-generated practice paper — not an official past paper. Check answers against your textbook.</p>
            <Markdown text={open.body} />
          </>)}
        </section>
        <aside className="card saved"><h3 className="card-title"><FileText /> My papers</h3>
          {mine?.length === 0 && <p className="small muted">None yet.</p>}
          <ul className="saved-list">{mine?.map((p) => <li key={p.id}><button className={open?.id === p.id ? 'on' : ''} onClick={() => show(p.id)}><b>{p.title}</b><small>{p.totalMarks} marks</small></button></li>)}</ul>
        </aside>
      </div>
    </div>
  );
}
