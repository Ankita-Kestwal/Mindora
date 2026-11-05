import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Sparkles, BookOpen, ScrollText, NotebookPen, Lightbulb, Network, Code2, Award, Copy, Trash2, Clock, AlertTriangle, Wand2 } from 'lucide-react';
import { api } from '../lib/api.js';
import Markdown from '../components/Markdown.jsx';
import { Alert, useToast } from '../components/ui.jsx';

export const TYPES = [
  ['explanation', 'Explanation', BookOpen], ['theory', 'Theory', ScrollText], ['notes', 'Notes', NotebookPen],
  ['examples', 'Examples', Lightbulb], ['diagram', 'Diagram', Network], ['code', 'Programming', Code2], ['exam-answer', 'Exam answer', Award],
];
export const typeLabel = (t) => TYPES.find((x) => x[0] === t)?.[1] || t;
const MARKS = [2, 3, 5, 8, 10, 12, 15, 20, 25, 30];

function when(iso) {
  const d = new Date(iso); const s = (Date.now() - d) / 1000;
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.round(s / 60)} min ago`; if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function Learn() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [topic, setTopic] = useState(params.get('topic') || '');
  const [subject, setSubject] = useState(params.get('subject') || '');
  const [type, setType] = useState(params.get('type') || 'explanation');
  const [marks, setMarks] = useState(10);
  const [configured, setConfigured] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState(null);
  const [saved, setSaved] = useState([]);
  const resultRef = useRef(null);

  useEffect(() => { api('/learn/options').then((o) => setConfigured(o.configured)).catch(() => {}); }, []);

  const loadSaved = useCallback(async (key) => {
    if (!key) { setSaved([]); return; }
    try { setSaved((await api(`/learn/content?topicKey=${key}`)).items); } catch { /* non-critical */ }
  }, []);

  const open = useCallback(async (id) => {
    setError('');
    try {
      const { content } = await api(`/learn/content/${id}`);
      setCurrent({ id, ...content });
      setTopic(content.topic); setSubject(content.subject || ''); setType(content.type);
      if (content.marks) setMarks(content.marks);
      loadSaved(content.topicKey);
    } catch (e) { setError(e.message); }
  }, [loadSaved]);

  // Resume from history: /app/learn?id=…
  useEffect(() => { const id = params.get('id'); if (id) open(id); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async (e) => {
    e?.preventDefault();
    if (topic.trim().length < 2) { setError('Enter a topic (at least 2 characters).'); return; }
    setBusy(true); setError('');
    try {
      const body = { topic: topic.trim(), subject: subject.trim(), type, ...(type === 'exam-answer' ? { marks } : {}) };
      const { content } = await api('/learn/generate', { method: 'POST', body });
      setCurrent(content);
      setParams({ id: content.id }, { replace: true });
      loadSaved(content.topicKey);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (ex) { setError(Object.values(ex.fields || {}).join(' ') || ex.message); } finally { setBusy(false); }
  };

  const copy = async () => { try { await navigator.clipboard.writeText(current.body); toast('Copied to clipboard', '', 'success'); } catch { toast('Could not copy', '', 'error'); } };
  const remove = async () => {
    if (!window.confirm('Delete this saved content?')) return;
    try { await api(`/learn/content/${current.id}`, { method: 'DELETE' }); toast('Deleted', '', 'success'); loadSaved(current.topicKey); setCurrent(null); setParams({}, { replace: true }); } catch (e) { toast('Delete failed', e.message, 'error'); }
  };

  return (
    <div className="page">
      {!configured && <Alert type="warning"><b>Azure OpenAI isn’t configured on the server.</b> Add your endpoint, key and deployment to <code>server/.env</code> and restart <code>npm run dev</code>.</Alert>}
      <form className="card learn-form" onSubmit={generate}>
        <div className="learn-inputs">
          <div className="field grow"><label htmlFor="topic">Topic</label><input id="topic" className="input" placeholder="e.g. Normalisation, Newton’s laws, Binary search" value={topic} maxLength={120} onChange={(e) => setTopic(e.target.value)} /></div>
          <div className="field"><label htmlFor="subject">Subject (optional)</label><input id="subject" className="input" placeholder="e.g. DBMS" value={subject} maxLength={80} onChange={(e) => setSubject(e.target.value)} /></div>
        </div>
        <div className="type-row" role="radiogroup" aria-label="What to generate">
          {TYPES.map(([id, label, Icon]) => <button key={id} type="button" role="radio" aria-checked={type === id} className="type-chip" onClick={() => setType(id)}><Icon />{label}</button>)}
        </div>
        <div className="learn-actions">
          {type === 'exam-answer' && (
            <label className="row" style={{ gap: 10 }}><span className="label">Marks</span>
              <select className="input" style={{ width: 140 }} value={marks} onChange={(e) => setMarks(Number(e.target.value))} aria-label="Marks">{MARKS.map((m) => <option key={m} value={m}>{m} marks</option>)}</select>
            </label>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy || !configured}>{busy ? <span className="spinner" /> : <Wand2 />}{busy ? 'Generating…' : 'Generate'}</button>
        </div>
        <Alert type="error">{error}</Alert>
      </form>

      <div className="learn-grid" ref={resultRef}>
        <section className="card result" aria-live="polite" aria-busy={busy}>
          {busy && (<div className="gen-wait"><span className="spinner" /><div><b>Generating with Azure OpenAI…</b><span>This usually takes 10–40 seconds.</span></div></div>)}
          {busy && <div className="skeleton" style={{ height: 18, width: '60%' }} />}
          {busy && <div className="skeleton" style={{ height: 220, marginTop: 12 }} />}
          {!busy && !current && (
            <div className="empty"><Sparkles /><h3>Learn any topic</h3><p className="muted">Pick a topic and what you need — explanation, notes, examples, a diagram, code or an exam answer from 2 to 30 marks.</p></div>
          )}
          {!busy && current && (<>
            <header className="result-head">
              <div><h2>{current.topic}</h2><p className="small muted">{current.subject && `${current.subject} · `}{typeLabel(current.type)}{current.marks ? ` · ${current.marks} marks` : ''} · {when(current.createdAt)}</p></div>
              <div className="row" style={{ gap: 6 }}>
                <button className="icon-btn" onClick={copy} aria-label="Copy" title="Copy"><Copy /></button>
                <button className="icon-btn" onClick={remove} aria-label="Delete" title="Delete"><Trash2 /></button>
              </div>
            </header>
            <p className="ai-note"><AlertTriangle /> AI-generated with Azure OpenAI ({current.model}). Check important facts against your textbook or notes.</p>
            {current.truncated && <Alert type="warning">This answer hit the length limit and may end abruptly. Try a narrower topic.</Alert>}
            <Markdown text={current.body} />
          </>)}
        </section>

        <aside className="card saved">
          <h3 className="card-title"><Clock /> Saved for this topic</h3>
          {saved.length === 0 && <p className="small muted">Everything you generate is saved here and in <Link to="/app/history">Learning history</Link>.</p>}
          <ul className="saved-list">
            {saved.map((s) => (
              <li key={s.id}><button className={current?.id === s.id ? 'on' : ''} onClick={() => { open(s.id); setParams({ id: s.id }, { replace: true }); }}>
                <b>{typeLabel(s.type)}{s.marks ? ` · ${s.marks} marks` : ''}</b><small>{when(s.createdAt)}</small>
              </button></li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
