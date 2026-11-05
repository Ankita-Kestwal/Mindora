import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileText, Image as ImageIcon, RefreshCw, Trash2, ExternalLink, ChevronRight, BookMarked, Sparkles } from 'lucide-react';
import { api, apiUpload, apiBlobUrl } from '../lib/api.js';
import { Alert, useToast } from '../components/ui.jsx';

const MAX = 15 * 1024 * 1024;
const size = (b) => (b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`);
const OK_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

function Status({ s }) {
  if (s.status === 'processing') return <span className="badge badge-primary"><span className="spinner" style={{ width: 10, height: 10 }} />Reading…</span>;
  if (s.status === 'ready') return <span className="badge badge-ok"><span className="dot" />{s.topicCount} topics</span>;
  return <span className="badge badge-err"><span className="dot" />Failed</span>;
}

export default function SyllabusPage() {
  const toast = useToast();
  const nav = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const input = useRef(null);

  const load = useCallback(async () => {
    try { const r = await api('/syllabi'); setItems(r.items); return r.items; } catch (e) { setError(e.message); return []; }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Poll while anything is being read.
  useEffect(() => {
    if (!items?.some((i) => i.status === 'processing')) return undefined;
    const t = setInterval(async () => {
      const list = await load();
      if (openId && list.find((i) => i.id === openId)?.status !== 'processing') openDetail(openId);
    }, 3000);
    return () => clearInterval(t);
  }, [items, load, openId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = async (id) => {
    setOpenId(id);
    try {
      const { syllabus } = await api(`/syllabi/${id}`);
      setDetail(syllabus);
      const { subjects, ...meta } = syllabus;
      setItems((list) => list?.map((i) => (i.id === id ? { ...i, ...meta, subjectCount: subjects?.length || 0 } : i)));
    } catch (e) { toast('Could not open', e.message, 'error'); }
  };

  const pick = (f) => {
    setError('');
    if (!f) return;
    if (!OK_TYPES.includes(f.type)) { setError('Only PDF, JPG and PNG files are allowed.'); return; }
    if (f.size > MAX) { setError(`File is too large (${(f.size / 1048576).toFixed(1)} MB). Maximum is 15 MB.`); return; }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) { setError('Choose a file first.'); return; }
    setBusy(true); setError('');
    const fd = new FormData(); fd.append('file', file); fd.append('title', title.trim());
    try {
      const { syllabus } = await apiUpload('/syllabi', fd);
      toast('Uploaded to Azure Blob Storage', 'Mindora is reading your syllabus…', 'success');
      setFile(null); setTitle(''); if (input.current) input.current.value = '';
      await load(); openDetail(syllabus.id);
    } catch (ex) { setError(ex.message); } finally { setBusy(false); }
  };

  const viewFile = async (s) => {
    try { const url = await apiBlobUrl(`/syllabi/${s.id}/file`); window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 60000); } catch (e) { toast('Could not open file', e.message, 'error'); }
  };
  const reprocess = async (s) => {
    try { await api(`/syllabi/${s.id}/process`, { method: 'POST' }); await load(); setDetail({ ...s, status: 'processing' }); } catch (e) { toast('Could not re-process', e.message, 'error'); }
  };
  const remove = async (s) => {
    if (!window.confirm(`Delete “${s.title}”? The file is removed from Azure storage too.`)) return;
    try { await api(`/syllabi/${s.id}`, { method: 'DELETE' }); toast('Syllabus deleted', '', 'success'); setOpenId(null); setDetail(null); load(); } catch (e) { toast('Delete failed', e.message, 'error'); }
  };
  const learn = (topic, subject) => nav(`/app/learn?${new URLSearchParams({ topic, subject })}`);

  return (
    <div className="page">
      <form className="card form" onSubmit={submit}>
        <h2 className="card-title"><UploadCloud /> Upload your syllabus</h2>
        <label className={`drop ${drag ? 'drag' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}>
          <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => pick(e.target.files[0])} className="sr-only" />
          <UploadCloud />
          {file ? <><b>{file.name}</b><span>{size(file.size)} · ready to upload</span></> : <><b>Drop a PDF or photo here, or click to choose</b><span>PDF, JPG or PNG · up to 15 MB · stored privately in Azure Blob Storage</span></>}
        </label>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <input className="input" style={{ flex: '1 1 260px' }} placeholder="Name (e.g. B.Tech DS – Semester 3)" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} aria-label="Syllabus name" />
          <button className="btn btn-primary" type="submit" disabled={busy || !file}>{busy ? <span className="spinner" /> : <UploadCloud />}{busy ? 'Uploading…' : 'Upload'}</button>
        </div>
        <Alert type="error">{error}</Alert>
        <p className="hint">Tip: for a printed syllabus, take clear photos of each page in good light. Scanned PDFs without text can’t be read — upload photos instead.</p>
      </form>

      <div className="syl-grid">
        <section className="card">
          <h2 className="card-title"><BookMarked /> My syllabi</h2>
          {!items && <div className="skeleton" style={{ height: 120 }} />}
          {items?.length === 0 && <p className="muted small">No syllabus uploaded yet.</p>}
          <ul className="syl-list">
            {items?.map((s) => (
              <li key={s.id}><button className={openId === s.id ? 'on' : ''} onClick={() => openDetail(s.id)}>
                {s.mimeType === 'application/pdf' ? <FileText /> : <ImageIcon />}
                <span className="grow"><b>{s.title}</b><small>{new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {size(s.size)}</small></span>
                <Status s={s} />
              </button></li>
            ))}
          </ul>
        </section>

        <section className="card syl-detail">
          {!detail && <div className="empty"><Sparkles /><h3>Your syllabus, organised</h3><p className="muted">Upload a syllabus and Mindora arranges it into subjects, units, chapters and topics. Click any topic to study it.</p></div>}
          {detail && (<>
            <header className="result-head">
              <div><h2>{detail.title}</h2><p className="small muted">{detail.fileName}{detail.status === 'ready' ? ` · ${detail.subjects.length} subject${detail.subjects.length === 1 ? '' : 's'} · ${detail.topicCount} topics` : ''}</p></div>
              <div className="row" style={{ gap: 6 }}>
                <button className="icon-btn" onClick={() => viewFile(detail)} title="View original file" aria-label="View original file"><ExternalLink /></button>
                <button className="icon-btn" onClick={() => reprocess(detail)} disabled={detail.status === 'processing'} title="Process again" aria-label="Process again"><RefreshCw /></button>
                <button className="icon-btn" onClick={() => remove(detail)} title="Delete" aria-label="Delete"><Trash2 /></button>
              </div>
            </header>
            {detail.status === 'processing' && <div className="gen-wait" style={{ marginTop: 16 }}><span className="spinner" /><div><b>Reading your syllabus with Azure OpenAI…</b><span>This can take up to a minute. You can leave this page.</span></div></div>}
            {detail.status === 'failed' && <div style={{ marginTop: 16 }}><Alert type="error">{detail.error}</Alert></div>}
            {detail.status === 'ready' && (<div className="tree">
              <p className="ai-note" style={{ marginTop: 14 }}>Extracted by AI — check it against your official syllabus. Click a topic to study it.</p>
              {detail.subjects.map((sub, si) => (
                <details key={si} open className="t-subject">
                  <summary><ChevronRight />{sub.name}</summary>
                  {sub.units.map((u, ui) => (
                    <details key={ui} open={detail.subjects.length === 1 || ui === 0} className="t-unit">
                      <summary><ChevronRight />{u.title}</summary>
                      {u.chapters.map((c, ci) => (
                        <div key={ci} className="t-chapter">
                          {c.title !== u.title && <b>{c.title}</b>}
                          <div className="chip-row">{c.topics.map((t) => <button key={t} className="chip" onClick={() => learn(t, sub.name)} title={`Study “${t}”`}>{t}</button>)}</div>
                        </div>
                      ))}
                    </details>
                  ))}
                </details>
              ))}
              {detail.truncated && <Alert type="warning">This syllabus is very long; the last part may be missing. Try uploading it in smaller parts.</Alert>}
            </div>)}
          </>)}
        </section>
      </div>
    </div>
  );
}
