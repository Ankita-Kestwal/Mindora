import { Navigate, Route, Routes, useLocation, Link } from 'react-router-dom';
import { ServerCrash } from 'lucide-react';
import { useAuth } from './context/AuthContext.jsx';
import Landing from './pages/Landing.jsx';
import { Login, Register, Forgot } from './pages/auth/AuthPages.jsx';
import Onboarding from './pages/Onboarding.jsx';
import AppLayout from './components/AppLayout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SettingsPage from './pages/Settings.jsx';
import Learn from './pages/Learn.jsx';
import HistoryPage from './pages/History.jsx';
import SyllabusPage from './pages/Syllabus.jsx';
import QuizzesPage, { RevisionPage } from './pages/Quizzes.jsx';
import ExamsPage, { NotificationsPage } from './pages/Exams.jsx';
import PapersPage from './pages/Papers.jsx';
import ChallengePage from './pages/Challenge.jsx';
import ReportsPage from './pages/Reports.jsx';

function Loader() { return <div className="page-loader" role="status" aria-label="Loading"><span className="spinner" style={{ width: 28, height: 28 }} /></div>; }

function ProfileError() {
  const { profileError, reloadProfile, logout } = useAuth();
  return (
    <div className="page-loader"><div className="card" style={{ maxWidth: 460, textAlign: 'center' }}>
      <ServerCrash size={36} style={{ color: 'var(--danger)', marginBottom: 12 }} />
      <h2 style={{ marginBottom: 8 }}>Can’t load your account</h2>
      <p className="muted" style={{ marginBottom: 18 }}>{profileError}</p>
      <div className="row" style={{ justifyContent: 'center', gap: 10 }}><button className="btn btn-primary" onClick={() => reloadProfile().catch(() => {})}>Try again</button><button className="btn btn-ghost" onClick={logout}>Sign out</button></div>
    </div></div>
  );
}

/** Signed in + onboarded. */
function RequireProfile({ children }) {
  const { loading, user, profile, needsOnboarding, profileError } = useAuth();
  const loc = useLocation();
  if (loading) return <Loader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (profileError && !profile) return <ProfileError />;
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;
  if (!profile) return <Loader />;
  return children;
}

function RequireUser({ children }) {
  const { loading, user, profile, profileError } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  if (profileError && !profile) return <ProfileError />;
  if (profile) return <Navigate to="/app" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { loading, user } = useAuth();
  if (loading) return <Loader />;
  if (user) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/onboarding" element={<RequireUser><Onboarding /></RequireUser>} />
      <Route path="/app" element={<RequireProfile><AppLayout /></RequireProfile>}>
        <Route index element={<Dashboard />} />
        <Route path="learn" element={<Learn />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="syllabus" element={<SyllabusPage />} />
        <Route path="quizzes" element={<QuizzesPage />} />
        <Route path="revision" element={<RevisionPage />} />
        <Route path="challenge" element={<ChallengePage />} />
        <Route path="exams" element={<ExamsPage />} />
        <Route path="papers" element={<PapersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<div className="page-loader"><div style={{ textAlign: 'center' }}><h1 style={{ fontSize: 64 }}>404</h1><p className="muted" style={{ margin: '8px 0 18px' }}>This page doesn’t exist.</p><Link className="btn btn-primary" to="/">Go home</Link></div></div>} />
    </Routes>
  );
}
