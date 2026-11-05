import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Palette, KeyRound, Timer, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { usePrefs } from '../context/PrefsContext.jsx';
import { api } from '../lib/api.js';
import { authMessage } from '../lib/firebase.js';
import { FONTS } from '../lib/theme.js';
import { Field, TextInput, Alert, Submit, Switch, useToast } from '../components/ui.jsx';
import { CATEGORIES, EDUCATION, LEVELS } from './Onboarding.jsx';

function ProfileForm() {
  const { profile, setProfile } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({
    displayName: profile.displayName, category: profile.category, learningLevel: profile.learningLevel,
    education: { ...profile.education }, interests: profile.interests.join(', '),
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    const interests = [...new Set(f.interests.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, 12);
    try {
      const r = await api('/me', { method: 'PUT', body: { ...f, displayName: f.displayName.trim(), interests } });
      setProfile(r.profile);
      toast('Profile saved', '', 'success');
    } catch (ex) { setErr(Object.values(ex.fields || {}).join(' ') || ex.message); } finally { setBusy(false); }
  };
  const edu = (k) => (e) => setF({ ...f, education: { ...f.education, [k]: e.target.value } });
  return (
    <form className="card form" onSubmit={save} noValidate id="profile">
      <h2 className="card-title"><User /> Profile</h2>
      <div className="grid-2">
        <Field id="s-name" label="Name"><TextInput id="s-name" value={f.displayName} maxLength={80} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></Field>
        <Field id="s-cat" label="Account type"><select id="s-cat" className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field id="s-edu" label="Education level"><select id="s-edu" className="input" value={f.education.level} onChange={edu('level')}>{EDUCATION.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field id="s-lvl" label="Learning level"><select id="s-lvl" className="input" value={f.learningLevel} onChange={(e) => setF({ ...f, learningLevel: e.target.value })}>{LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field id="s-board" label="Board / university"><TextInput id="s-board" value={f.education.board} maxLength={80} onChange={edu('board')} /></Field>
        <Field id="s-inst" label="Institution"><TextInput id="s-inst" value={f.education.institution} maxLength={120} onChange={edu('institution')} /></Field>
        <Field id="s-course" label="Course / class"><TextInput id="s-course" value={f.education.course} maxLength={120} onChange={edu('course')} /></Field>
        <Field id="s-sem" label="Semester / year"><TextInput id="s-sem" value={f.education.semester} maxLength={20} onChange={edu('semester')} /></Field>
      </div>
      <Field id="s-int" label="Interests" hint="Separate with commas — up to 12."><TextInput id="s-int" value={f.interests} onChange={(e) => setF({ ...f, interests: e.target.value })} /></Field>
      <Alert type="error">{err}</Alert>
      <div className="row-end"><Submit busy={busy} className="btn btn-primary">Save profile</Submit></div>
    </form>
  );
}

function Appearance() {
  const { prefs, update, secondsLeft } = usePrefs();
  const [interval, setIntervalVal] = useState(String(prefs.autoIntervalMin));
  const intervalErr = /^\d+$/.test(interval) && +interval >= 1 && +interval <= 240 ? '' : 'Enter 1–240 minutes.';
  const mm = secondsLeft === null ? '' : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
  return (
    <section className="card form" id="appearance">
      <h2 className="card-title"><Palette /> Appearance</h2>
      <span className="label">Theme</span>
      <div className="theme-cards" role="radiogroup" aria-label="Theme">
        {['dark', 'light'].map((t) => (
          <button key={t} type="button" role="radio" aria-checked={prefs.theme === t} className="theme-card" onClick={() => update({ theme: t }, { restartTimer: true })}>
            <span className={`pv ${t}`}><i /><b /></span>{t === 'dark' ? 'Matte black' : 'Light'}{prefs.theme === t && <Check size={16} />}
          </button>
        ))}
      </div>
      <div className="set-row">
        <div><b>Automatic theme switching</b><span>Alternates dark and light every few minutes. Turn off to keep your chosen theme.</span></div>
        <Switch id="auto" label="Automatic theme switching" checked={prefs.autoTheme} onChange={(v) => update({ autoTheme: v }, { restartTimer: true })} />
      </div>
      <div className="set-row">
        <div><b>Switch every</b><span>Minutes between automatic switches (1–240).</span></div>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" style={{ width: 90 }} inputMode="numeric" aria-label="Interval in minutes" value={interval} aria-invalid={intervalErr ? 'true' : 'false'} onChange={(e) => setIntervalVal(e.target.value.trim())} />
          <button type="button" className="btn btn-secondary" disabled={!!intervalErr || +interval === prefs.autoIntervalMin} onClick={() => update({ autoIntervalMin: +interval }, { restartTimer: true })}>Apply</button>
        </div>
      </div>
      {intervalErr && <p className="error-text">{intervalErr}</p>}
      <Alert type="info">
        <span data-testid="auto-status">{prefs.autoTheme
          ? <>Automatic switching is <b>on</b>: every <b>{prefs.autoIntervalMin} min</b>. Next switch to <b>{prefs.theme === 'dark' ? 'light' : 'dark'}</b> in <b>{mm}</b>. The toggle in the top bar switches now and restarts the timer.</>
          : <>Automatic switching is <b>off</b>. The theme only changes when you choose it.</>}</span>
      </Alert>

      <span className="label" style={{ marginTop: 8 }}>Font</span>
      <div className="font-grid" role="radiogroup" aria-label="Font">
        {FONTS.map((f) => (
          <button key={f.id} type="button" role="radio" aria-checked={prefs.font === f.id} className="font-card" data-font-preview={f.id} onClick={() => update({ font: f.id })}>
            <span className="fc-sample">Aa</span><b>{f.label}</b><small>{f.note}</small>
          </button>
        ))}
      </div>
      <p className="hint"><Timer size={13} style={{ verticalAlign: -2 }} /> Theme and font are saved to your account and apply on every device you sign in on.</p>
    </section>
  );
}

function Account() {
  const { profile, user, resetPassword, logout } = useAuth();
  const nav = useNavigate();
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState(false);
  const sendReset = async () => {
    setBusy(true); setMsg({});
    try { await resetPassword(user.email); setMsg({ ok: `Password reset link sent to ${user.email}.` }); } catch (e) { setMsg({ err: authMessage(e) }); } finally { setBusy(false); }
  };
  return (
    <section className="card form" id="account">
      <h2 className="card-title"><KeyRound /> Account</h2>
      <dl className="dl"><div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Mindora ID</dt><dd>{profile.mindoraId}</dd></div><div><dt>Role</dt><dd style={{ textTransform: 'capitalize' }}>{profile.role}</dd></div></dl>
      <div className="set-row"><div><b>Change password</b><span>We’ll email you a secure link to set a new password.</span></div><button type="button" className="btn btn-secondary" onClick={sendReset} disabled={busy}>{busy && <span className="spinner" />}Send reset link</button></div>
      <Alert type="success">{msg.ok}</Alert><Alert type="error">{msg.err}</Alert>
      <div className="set-row"><div><b>Sign out</b><span>Sign out of Mindora on this device.</span></div><button type="button" className="btn btn-danger" onClick={async () => { await logout(); nav('/login', { replace: true }); }}>Sign out</button></div>
    </section>
  );
}

export default function SettingsPage() {
  return <div className="page narrow"><Appearance /><ProfileForm /><Account /></div>;
}
