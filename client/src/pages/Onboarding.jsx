import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GraduationCap, Presentation, Briefcase, FlaskConical, Compass, User, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { Logo, ThemeToggle, Field, TextInput, Alert, Submit } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';

export const CATEGORIES = [
  ['student', 'Student', 'School or college', GraduationCap],
  ['teacher', 'Teacher', 'Plan and explain topics', Presentation],
  ['professional', 'Working professional', 'Upskill alongside work', Briefcase],
  ['researcher', 'Researcher', 'Explore new areas fast', FlaskConical],
  ['independent', 'Independent learner', 'Learn what you love', Compass],
  ['other', 'Other', 'Anyone who wants to learn', User],
];
export const EDUCATION = [
  ['school', 'School (up to Class 10)'], ['higher-secondary', 'Higher secondary (Class 11–12)'], ['undergraduate', 'Undergraduate'],
  ['postgraduate', 'Postgraduate'], ['doctorate', 'Doctorate'], ['professional', 'Professional / working'], ['other', 'Other'],
];
export const LEVELS = [['beginner', 'Beginner', 'New to most topics'], ['intermediate', 'Intermediate', 'Comfortable with basics'], ['advanced', 'Advanced', 'Ready for depth']];
const SUGGESTED = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Programming', 'Data Science', 'DBMS', 'Cloud Computing', 'Economics', 'History', 'English', 'JEE', 'NEET', 'UPSC'];

export default function Onboarding() {
  const { user, setProfile } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    displayName: loc.state?.name || user?.displayName || '',
    category: '', education: { level: '', board: '', institution: '', course: '', semester: '' },
    interests: [], learningLevel: '',
  });
  const [custom, setCustom] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const steps = ['About you', 'Education', 'Interests', 'Level'];
  const canNext = [
    f.displayName.trim().length >= 2 && f.category,
    f.education.level,
    f.interests.length > 0,
    f.learningLevel,
  ][step];

  const toggleInterest = (i) => setF((s) => ({ ...s, interests: s.interests.includes(i) ? s.interests.filter((x) => x !== i) : s.interests.length >= 12 ? s.interests : [...s.interests, i] }));
  const addCustom = () => { const v = custom.trim().slice(0, 40); if (v && !f.interests.includes(v)) toggleInterest(v); setCustom(''); };

  const finish = async (e) => {
    e.preventDefault();
    if (step < 3) { if (canNext) setStep(step + 1); return; }
    setBusy(true); setErr('');
    try {
      const r = await api('/me', { method: 'POST', body: { ...f, displayName: f.displayName.trim() } });
      setProfile(r.profile);
      nav('/app', { replace: true });
    } catch (ex) {
      setErr(ex.fields && Object.keys(ex.fields).length ? `${ex.message} (${Object.values(ex.fields).join(' ')})` : ex.message);
      setBusy(false);
    }
  };

  const edu = (k) => (e) => setF({ ...f, education: { ...f.education, [k]: e.target.value } });

  return (
    <div className="onb">
      <header className="onb-top"><Logo /><ThemeToggle /></header>
      <form className="onb-card card" onSubmit={finish} noValidate>
        <ol className="stepper" aria-label="Onboarding progress">
          {steps.map((s, i) => <li key={s} className={i < step ? 'done' : i === step ? 'on' : ''} aria-current={i === step ? 'step' : undefined}><span>{i < step ? <Check /> : i + 1}</span>{s}</li>)}
        </ol>

        {step === 0 && (<div className="onb-body">
          <h1>Let’s personalise Mindora</h1>
          <Field id="dn" label="Your name"><TextInput id="dn" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} autoComplete="name" /></Field>
          <span className="label">I am a…</span>
          <div className="choice-grid" role="radiogroup" aria-label="Account category">
            {CATEGORIES.map(([id, t, d, Icon]) => (
              <button type="button" key={id} className="choice" role="radio" aria-checked={f.category === id} onClick={() => setF({ ...f, category: id })}><Icon /><b>{t}</b><span>{d}</span></button>
            ))}
          </div>
        </div>)}

        {step === 1 && (<div className="onb-body">
          <h1>Your educational background</h1>
          <Field id="lvl" label="Current level">
            <select id="lvl" className="input" value={f.education.level} onChange={edu('level')}>
              <option value="">Choose…</option>{EDUCATION.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <div className="grid-2">
            <Field id="board" label="Board / university (optional)"><TextInput id="board" value={f.education.board} onChange={edu('board')} placeholder="e.g. CBSE, SVVV" maxLength={80} /></Field>
            <Field id="inst" label="Institution (optional)"><TextInput id="inst" value={f.education.institution} onChange={edu('institution')} maxLength={120} /></Field>
            <Field id="course" label="Course / class (optional)"><TextInput id="course" value={f.education.course} onChange={edu('course')} placeholder="e.g. B.Tech CSE, Class 12" maxLength={120} /></Field>
            <Field id="sem" label="Semester / year (optional)"><TextInput id="sem" value={f.education.semester} onChange={edu('semester')} maxLength={20} /></Field>
          </div>
        </div>)}

        {step === 2 && (<div className="onb-body">
          <h1>What do you want to learn?</h1>
          <p className="muted">Pick up to 12. You can change these later.</p>
          <div className="chip-row">
            {[...new Set([...SUGGESTED, ...f.interests])].map((i) => <button type="button" key={i} className="chip" aria-pressed={f.interests.includes(i)} onClick={() => toggleInterest(i)}>{f.interests.includes(i) && <Check size={14} />}{i}</button>)}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <TextInput id="custom" placeholder="Add your own (e.g. Organic Chemistry)" value={custom} maxLength={40} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} aria-label="Add a custom interest" />
            <button type="button" className="btn btn-secondary" onClick={addCustom}>Add</button>
          </div>
        </div>)}

        {step === 3 && (<div className="onb-body">
          <h1>Choose your learning level</h1>
          <p className="muted">Mindora adjusts the depth of explanations to this.</p>
          <div className="choice-grid" role="radiogroup" aria-label="Learning level">
            {LEVELS.map(([id, t, d]) => <button type="button" key={id} className="choice" role="radio" aria-checked={f.learningLevel === id} onClick={() => setF({ ...f, learningLevel: id })}><b>{t}</b><span>{d}</span></button>)}
          </div>
        </div>)}

        <Alert type="error">{err}</Alert>
        <div className="onb-foot">
          {step > 0 ? <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)}><ArrowLeft /> Back</button> : <span />}
          {step < 3
            ? <button type="submit" className="btn btn-primary" disabled={!canNext}>Continue <ArrowRight /></button>
            : <Submit busy={busy} className="btn btn-primary" disabled={!canNext || busy}>Finish setup</Submit>}
        </div>
      </form>
    </div>
  );
}
