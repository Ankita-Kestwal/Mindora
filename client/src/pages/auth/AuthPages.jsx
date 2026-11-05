import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, ArrowLeft } from 'lucide-react';
import { Logo, ThemeToggle, Field, TextInput, PasswordInput, Alert, Submit, validators } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { authMessage } from '../../lib/firebase.js';

function AuthLayout({ title, subtitle, children }) {
  const { firebaseConfigured } = useAuth();
  return (
    <div className="auth">
      <aside className="auth-side" aria-hidden="true">
        <Logo />
        <div>
          <h2>Learn smarter, not scattered.</h2>
          <p>AI explanations, your own syllabus, smart revision and exam planning — in one private space.</p>
        </div>
        <span className="small">Google Firebase · Microsoft Azure</span>
      </aside>
      <main className="auth-main">
        <div className="auth-top"><Link to="/" className="back"><ArrowLeft /> Home</Link><ThemeToggle /></div>
        <div className="auth-card">
          {!firebaseConfigured && <Alert type="warning"><b>Firebase isn’t configured.</b> Add your Firebase web config to <code>client/.env</code> (see docs/SETUP.md).</Alert>}
          <h1>{title}</h1>
          <p className="muted" style={{ margin: '6px 0 24px' }}>{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}

export function Login() {
  const { login, firebaseConfigured } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [f, setF] = useState({ email: '', password: '', remember: true });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const v = { email: validators.email(f.email), password: f.password ? '' : 'Enter your password.' };
    setErr(v);
    if (v.email || v.password || !firebaseConfigured) return;
    setBusy(true);
    try {
      await login(f.email.trim(), f.password, f.remember);
      const next = params.get('next');
      nav(next && next.startsWith('/app') ? next : '/app', { replace: true });
    } catch (ex) { setErr({ form: authMessage(ex) }); setBusy(false); }
  };
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue learning.">
      <form className="form" onSubmit={submit} noValidate>
        <Field id="email" label="Email" error={err.email}><TextInput id="email" type="email" autoComplete="email" value={f.email} error={err.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field id="password" label="Password" error={err.password}><PasswordInput id="password" autoComplete="current-password" value={f.password} error={err.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <div className="row-between">
          <label className="check"><input type="checkbox" checked={f.remember} onChange={(e) => setF({ ...f, remember: e.target.checked })} /> Keep me signed in</label>
          <Link to="/forgot" className="small">Forgot password?</Link>
        </div>
        <Alert type="error">{err.form}</Alert>
        <Submit busy={busy}>Sign in</Submit>
      </form>
      <p className="switch-text">New to Mindora? <Link to="/register">Create an account</Link></p>
    </AuthLayout>
  );
}

export function Register() {
  const { register, firebaseConfigured } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '', confirm: '' });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const v = { name: validators.name(f.name), email: validators.email(f.email), password: validators.password(f.password), confirm: f.confirm === f.password ? '' : 'Passwords do not match.' };
    setErr(v);
    if (Object.values(v).some(Boolean) || !firebaseConfigured) return;
    setBusy(true);
    try {
      await register(f.name.trim(), f.email.trim(), f.password);
      nav('/onboarding', { replace: true, state: { name: f.name.trim() } });
    } catch (ex) { setErr({ form: authMessage(ex) }); setBusy(false); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <AuthLayout title="Create your account" subtitle="It takes less than a minute.">
      <form className="form" onSubmit={submit} noValidate>
        <Field id="name" label="Full name" error={err.name}><TextInput id="name" autoComplete="name" value={f.name} error={err.name} onChange={set('name')} /></Field>
        <Field id="email" label="Email" error={err.email}><TextInput id="email" type="email" autoComplete="email" value={f.email} error={err.email} onChange={set('email')} /></Field>
        <Field id="password" label="Password" error={err.password} hint="At least 8 characters, with a letter and a number."><PasswordInput id="password" autoComplete="new-password" value={f.password} error={err.password} onChange={set('password')} /></Field>
        <Field id="confirm" label="Confirm password" error={err.confirm}><PasswordInput id="confirm" autoComplete="new-password" value={f.confirm} error={err.confirm} onChange={set('confirm')} /></Field>
        <Alert type="error">{err.form}</Alert>
        <Submit busy={busy}>Create account</Submit>
      </form>
      <p className="switch-text">Already have an account? <Link to="/login">Sign in</Link></p>
    </AuthLayout>
  );
}

export function Forgot() {
  const { resetPassword, firebaseConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const v = validators.email(email);
    setErr(v); setDone('');
    if (v || !firebaseConfigured) return;
    setBusy(true);
    try { await resetPassword(email.trim()); setDone(email.trim()); } catch (ex) {
      if (ex.code === 'auth/user-not-found') setDone(email.trim()); else setErr(authMessage(ex));
    } finally { setBusy(false); }
  };
  return (
    <AuthLayout title="Reset your password" subtitle="We’ll email you a secure reset link.">
      <form className="form" onSubmit={submit} noValidate>
        <div className="auth-icon"><KeyRound /></div>
        <Field id="email" label="Email" error={err}><TextInput id="email" type="email" autoComplete="email" value={email} error={err} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Alert type="success">{done && `If an account exists for ${done}, a reset link is on its way. Check your inbox and spam folder.`}</Alert>
        <Submit busy={busy}>Send reset link</Submit>
      </form>
      <p className="switch-text"><Link to="/login">Back to sign in</Link></p>
    </AuthLayout>
  );
}
