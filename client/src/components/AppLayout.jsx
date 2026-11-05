import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, Settings, Sparkles, History, Upload, ListChecks, Repeat, CalendarClock, FileText, Trophy, LineChart, LogOut, Menu, Bell } from 'lucide-react';
import { Logo, ThemeToggle } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';

export const NAV = [
  ['Learn', [['/app', 'Dashboard', LayoutDashboard, true], ['/app/learn', 'AI Learning', Sparkles], ['/app/syllabus', 'My Syllabus', Upload], ['/app/history', 'Learning History', History]]],
  ['Practise', [['/app/quizzes', 'Quizzes', ListChecks], ['/app/revision', 'Smart Revision', Repeat], ['/app/challenge', 'Sunday Challenge', Trophy]]],
  ['Exams', [['/app/exams', 'Exams & Reminders', CalendarClock], ['/app/papers', 'Question Papers', FileText], ['/app/reports', 'Reports', LineChart]]],
  ['Account', [['/app/notifications', 'Notifications', Bell], ['/app/settings', 'Settings', Settings]]],
];
const TITLES = Object.fromEntries(NAV.flatMap(([, items]) => items.map(([to, label]) => [to, label])));

export default function AppLayout() {
  const { profile, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, []);
  useEffect(() => {
    const refresh = () => api('/notifications').then((r) => setUnread(r.unread)).catch(() => {});
    refresh();
    addEventListener('mindora:notifications', refresh);
    return () => removeEventListener('mindora:notifications', refresh);
  }, [loc.pathname]);
  const initials = (profile?.displayName || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className={`shell ${open ? 'nav-open' : ''}`}>
      <a className="skip-link" href="#content">Skip to content</a>
      <aside className="sidebar" id="sidebar" aria-label="Main navigation">
        <NavLink to="/app" className="sb-brand"><Logo /></NavLink>
        <nav className="sb-nav">
          {NAV.map(([group, items]) => (
            <div key={group}>
              <p className="sb-label">{group}</p>
              {items.map(([to, label, Icon, end]) => (
                <NavLink key={to} end={end} to={to} className="sb-link"><Icon /> {label}{to === '/app/notifications' && unread > 0 && <em className="count">{unread}</em>}</NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sb-user">
          <span className="avatar">{initials}</span>
          <div className="meta"><b>{profile?.displayName}</b><small>{profile?.mindoraId}</small></div>
          <button className="icon-btn" onClick={async () => { await logout(); nav('/login', { replace: true }); }} aria-label="Sign out" title="Sign out"><LogOut /></button>
        </div>
      </aside>
      <div className="scrim" onClick={() => setOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open navigation" aria-controls="sidebar" aria-expanded={open}><Menu /></button>
          <h1>{TITLES[loc.pathname] || 'Mindora'}</h1>
          <div className="tb-actions">
            <Link to="/app/notifications" className="icon-btn bell" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}><Bell />{unread > 0 && <span className="bell-dot">{unread > 9 ? '9+' : unread}</span>}</Link>
            <ThemeToggle />
          </div>
        </header>
        <main id="content" className="content" tabIndex={-1}><Outlet /></main>
      </div>
    </div>
  );
}
