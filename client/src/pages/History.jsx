import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History as HistoryIcon, PlayCircle, Trash2, Sparkles } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../components/ui.jsx';
import { typeLabel } from './Learn.jsx';

export function useHistory() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const load = () => api('/learn/history').then((r) => setItems(r.items)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  return { items, error, setItems, reload: load };
}

export default function HistoryPage() {
  const { items, error, setItems } = useHistory();
  const toast = useToast();
  const remove = async (h) => {
    if (!window.confirm(`Remove “${h.topic}” from your history? Saved content stays available in AI Learning.`)) return;
    try { await api(`/learn/history/${h.id}`, { method: 'DELETE' }); setItems((x) => x.filter((i) => i.id !== h.id)); toast('Removed from history', '', 'success'); } catch (e) { toast('Could not remove', e.message, 'error'); }
  };
  return (
    <div className="page narrow">
      <section className="card">
        <h2 className="card-title"><HistoryIcon /> Learning history</h2>
        {error && <p className="error-text">{error}</p>}
        {!items && !error && <div className="skeleton" style={{ height: 160 }} />}
        {items?.length === 0 && <div className="empty"><Sparkles /><h3>No topics yet</h3><p className="muted">Topics you study in AI Learning appear here so you can continue where you stopped.</p><Link className="btn btn-primary" to="/app/learn">Start learning</Link></div>}
        <ul className="hist-list">
          {items?.map((h) => (
            <li key={h.id}>
              <div className="grow">
                <b>{h.topic}</b>
                <small>{h.subject && `${h.subject} · `}{h.count} session{h.count === 1 ? '' : 's'} · last: {typeLabel(h.lastType)} · {new Date(h.updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</small>
                <div className="chip-row" style={{ marginTop: 6 }}>{h.types.map((t) => <span key={t} className="badge">{typeLabel(t)}</span>)}</div>
              </div>
              <Link className="btn btn-secondary btn-sm" to={`/app/learn?id=${h.lastContentId}`}><PlayCircle /> Continue</Link>
              <button className="icon-btn" onClick={() => remove(h)} aria-label={`Remove ${h.topic} from history`}><Trash2 /></button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
