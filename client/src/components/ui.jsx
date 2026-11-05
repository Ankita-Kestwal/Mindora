import { createContext, useCallback, useContext, useState } from 'react';
import { Eye, EyeOff, CheckCircle2, AlertOctagon, Info, Moon, Sun } from 'lucide-react';
import { usePrefs } from '../context/PrefsContext.jsx';

export function Logo({ size = 34 }) {
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4C6FFF" /><stop offset="1" stopColor="#14B8A6" /></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#lg)" /><path d="M16 44V22l16 13 16-13v22" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <b>Mindora</b>
    </span>
  );
}

export function ThemeToggle() {
  const { prefs, toggleTheme } = usePrefs();
  const dark = prefs.theme === 'dark';
  return (
    <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title="Toggle theme">
      {dark ? <Moon /> : <Sun />}
    </button>
  );
}

export function Field({ id, label, error, hint, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="error-text" id={`${id}-err`}>{error}</span>}
    </div>
  );
}

export function TextInput({ id, error, ...props }) {
  return <input id={id} className="input" aria-invalid={error ? 'true' : 'false'} aria-describedby={error ? `${id}-err` : undefined} {...props} />;
}

export function PasswordInput({ id, error, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-group">
      <TextInput id={id} error={error} type={show ? 'text' : 'password'} {...props} />
      <button type="button" className="trailing" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

export function Alert({ type = 'info', children }) {
  if (!children) return null;
  const Icon = { error: AlertOctagon, success: CheckCircle2, info: Info, warning: AlertOctagon }[type];
  return <div className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'}><Icon /><div>{children}</div></div>;
}

export function Submit({ busy, children, className = 'btn btn-primary btn-lg btn-block', ...props }) {
  return <button type="submit" className={className} disabled={busy} {...props}>{busy ? <span className="spinner" /> : null}{children}</button>;
}

export function Switch({ id, checked, onChange, label }) {
  return (
    <span className="switch">
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span className="track" />
    </span>
  );
}

/* Toasts */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((title, message = '', type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, title, message, type }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => {
          const Icon = t.type === 'success' ? CheckCircle2 : t.type === 'error' ? AlertOctagon : Info;
          return <div key={t.id} className={`toast ${t.type}`}><Icon /><div><b>{t.title}</b>{t.message && <span>{t.message}</span>}</div></div>;
        })}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export const validators = {
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter a valid email address.'),
  password: (v) => (v.length < 8 ? 'Use at least 8 characters.' : !/[A-Za-z]/.test(v) || !/\d/.test(v) ? 'Include a letter and a number.' : ''),
  name: (v) => (v.trim().length >= 2 && v.trim().length <= 80 ? '' : 'Enter your name (2–80 characters).'),
};
