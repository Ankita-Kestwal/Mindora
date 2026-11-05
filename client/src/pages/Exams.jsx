import { useEffect, useState } from 'react';
import { CalendarClock, Plus, Trash2, Pencil, Bell, CheckCheck } from 'lucide-react';
import { api } from '../lib/api.js';
import { Alert, useToast } from '../components/ui.jsx';

const blank = { name: '', subject: '', date: '', time: '', venue: '', notes: '', remindDaysBefore: [7, 1] };
const REMIND = [14, 7, 3, 1, 0];

export default function ExamsPage() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [f, setF] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => api('/exams').then((r) => setItems(r.items)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const body = { ...f, name: f.name.trim(), subject: f.subject.trim(), venue: f.venue.trim(), notes: f.notes.trim() };
      if (editing) await api(`/exams/${editing}`, { method: 'PUT', body }); else await api('/exams', { method: 'POST', body });
      toast(editing ? 'Exam updated' : 'Exam added', 'Reminders are set.', 'success');
      setF(blank); setEditing(null); load(); window.dispatchEvent(new Event('mindora:notifications'));
    } catch (ex) { setErr(Object.values(ex.fields || {}).join(' ') || ex.message); } finally { setBusy(false); }
  };
  const edit = (x) => { setEditing(x.id); setF({ name: x.name, subject: x.subject, date: x.date, time: x.time, venue: x.venue, notes: x.notes, remindDaysBefore: x.remindDaysBefore }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const remove = async (x) => { if (!window.confirm(`Delete “${x.name}”?`)) return; await api(`/exams/${x.id}`, { method: 'DELETE' }); load(); };
  const toggle = (d) => setF((s) => ({ ...s, remindDaysBefore: s.remindDaysBefore.includes(d) ? s.remindDaysBefore.filter((x) => x !== d) : [...s.remindDaysBefore, d].sort((a, b) => b - a) }));
  const upcoming = items?.filter((x) => x.daysLeft >= 0) || [];
  const past = items?.filter((x) => x.daysLeft < 0) || [];

  return (
    <div className="page">
      <form className="card form" onSubmit={save}>
        <h2 className="card-title"><CalendarClock /> {editing ? 'Edit exam' : 'Add an exam'}</h2>
        <div className="exam-grid">
          <div className="field"><label htmlFor="en">Exam name</label><input id="en" className="input" value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. DBMS Mid-semester" /></div>
          <div className="field"><label htmlFor="es">Subject</label><input id="es" className="input" value={f.subject} maxLength={80} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>
          <div className="field"><label htmlFor="ed">Date</label><input id="ed" className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div className="field"><label htmlFor="et">Time (optional)</label><input id="et" className="input" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></div>
          <div className="field"><label htmlFor="ev">Venue (optional)</label><input id="ev" className="input" value={f.venue} maxLength={120} onChange={(e) => setF({ ...f, venue: e.target.value })} /></div>
          <div className="field"><label htmlFor="eo">Notes (optional)</label><input id="eo" className="input" value={f.notes} maxLength={500} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <div><span className="label">Remind me</span><div className="chip-row" style={{ marginTop: 8 }}>{REMIND.map((d) => <button type="button" key={d} className="chip" aria-pressed={f.remindDaysBefore.includes(d)} onClick={() => toggle(d)}>{d === 0 ? 'On the day' : `${d} day${d > 1 ? 's' : ''} before`}</button>)}</div></div>
        <Alert type="error">{err}</Alert>
        <div className="row-end" style={{ gap: 10 }}>
          {editing && <button type="button" className="btn btn-ghost" onClick={() => { setEditing(null); setF(blank); }}>Cancel</button>}
          <button className="btn btn-primary" disabled={busy}>{busy ? <span className="spinner" /> : <Plus />}{editing ? 'Save changes' : 'Add exam'}</button>
        </div>
        <p className="hint">Reminders appear in Mindora (bell icon and dashboard) when you open the app. Mindora doesn’t send emails or SMS.</p>
      </form>

      <section className="card">
        <h2 className="card-title"><CalendarClock /> Timetable</h2>
        {!items && <div className="skeleton" style={{ height: 100 }} />}
        {items?.length === 0 && <p className="muted small">No exams yet.</p>}
        <ul className="exam-list">
          {upcoming.map((x) => (
            <li key={x.id} className={x.daysLeft <= 3 ? 'soon' : ''}>
              <div className="exam-date"><b>{new Date(`${x.date}T00:00:00`).getDate()}</b><small>{new Date(`${x.date}T00:00:00`).toLocaleDateString('en-IN', { month: 'short' })}</small></div>
              <div className="grow"><b>{x.name}</b><small>{[x.subject, x.time, x.venue].filter(Boolean).join(' · ')}</small></div>
              <span className={`badge ${x.daysLeft <= 3 ? 'badge-err' : x.daysLeft <= 7 ? 'badge-warn' : 'badge-primary'}`}>{x.daysLeft === 0 ? 'Today' : x.daysLeft === 1 ? 'Tomorrow' : `${x.daysLeft} days`}</span>
              <button className="icon-btn" onClick={() => edit(x)} aria-label={`Edit ${x.name}`}><Pencil /></button>
              <button className="icon-btn" onClick={() => remove(x)} aria-label={`Delete ${x.name}`}><Trash2 /></button>
            </li>
          ))}
        </ul>
        {past.length > 0 && <details style={{ marginTop: 12 }}><summary className="small muted" style={{ cursor: 'pointer' }}>{past.length} past exam(s)</summary><ul className="exam-list past">{past.map((x) => <li key={x.id}><div className="grow"><b>{x.name}</b><small>{x.date}</small></div><button className="icon-btn" onClick={() => remove(x)} aria-label={`Delete ${x.name}`}><Trash2 /></button></li>)}</ul></details>}
      </section>
    </div>
  );
}

export function NotificationsPage() {
  const [data, setData] = useState(null);
  const load = () => api('/notifications').then(setData).catch(() => setData({ items: [], unread: 0 }));
  useEffect(() => { load(); }, []);
  const read = async (n) => { await api(`/notifications/${n.id}/read`, { method: 'PUT' }); load(); window.dispatchEvent(new Event('mindora:notifications')); };
  const readAll = async () => { await api('/notifications/read-all', { method: 'PUT' }); load(); window.dispatchEvent(new Event('mindora:notifications')); };
  return (
    <div className="page narrow"><section className="card">
      <div className="card-head"><h2 className="card-title"><Bell /> Notifications</h2>{data?.unread > 0 && <button className="btn btn-ghost btn-sm" onClick={readAll}><CheckCheck /> Mark all read</button>}</div>
      {!data && <div className="skeleton" style={{ height: 100 }} />}
      {data?.items.length === 0 && <p className="muted small">No notifications. Exam reminders appear here.</p>}
      <ul className="notif-list">{data?.items.map((n) => (
        <li key={n.id} className={n.read ? '' : 'unread'}><Bell /><div className="grow"><b>{n.title}</b><small>{n.body}</small></div>{!n.read && <button className="btn btn-ghost btn-sm" onClick={() => read(n)}>Mark read</button>}</li>
      ))}</ul>
    </section></div>
  );
}
