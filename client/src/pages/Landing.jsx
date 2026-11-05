import { Link } from 'react-router-dom';
import { Sparkles, BookOpen, Upload, ListChecks, CalendarClock, LineChart, Repeat, Trophy, ShieldCheck, KeyRound, Database, Cloud, ArrowRight } from 'lucide-react';
import { Logo, ThemeToggle } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const FEATURES = [
  [Sparkles, 'AI learning', 'Explanations, theory, notes, examples, diagrams and programming solutions for any supported topic.'],
  [Upload, 'Your syllabus', 'Upload your syllabus and get material organised by subject, unit, chapter and topic.'],
  [ListChecks, 'Exam answers', '2 to 30-mark exam-oriented answers and AI practice questions, clearly labelled.'],
  [Repeat, 'Smart revision', 'Revision built from what you studied, the mistakes you made and your quiz results.'],
  [CalendarClock, 'Exam planner', 'Timetables, personalised reminders and official previous-year papers.'],
  [Trophy, 'Sunday challenges', 'A weekly timed challenge every Sunday, with private results only you can see.'],
  [LineChart, 'Private analytics', 'Monthly reports on topics studied, scores and weak areas.'],
  [BookOpen, 'Resume anywhere', 'Mindora remembers where you stopped, so you can continue in one click.'],
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="landing">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="l-nav">
        <div className="l-wrap l-nav-in">
          <Link to="/" aria-label="Mindora home"><Logo /></Link>
          <nav className="l-links" aria-label="Sections"><a href="#features">Features</a><a href="#cloud">Cloud</a><a href="#privacy">Privacy</a></nav>
          <div className="l-actions">
            <ThemeToggle />
            {user ? <Link className="btn btn-primary" to="/app">Open dashboard</Link> : (<>
              <Link className="btn btn-ghost hide-sm" to="/login">Sign in</Link>
              <Link className="btn btn-primary" to="/register">Get started</Link>
            </>)}
          </div>
        </div>
      </header>

      <main id="main">
        <section className="l-hero">
          <div className="l-wrap l-hero-in">
            <span className="eyebrow"><Sparkles /> AI-powered personalised learning</span>
            <h1>All your learning, revision and exam preparation <span className="grad">in one place.</span></h1>
            <p className="lead">Mindora replaces a dozen separate apps with one private study space — shaped by your syllabus, your level and your goals.</p>
            <div className="l-cta">
              <Link className="btn btn-primary btn-lg" to={user ? '/app' : '/register'}>{user ? 'Go to dashboard' : 'Create your free account'} <ArrowRight /></Link>
              <a className="btn btn-secondary btn-lg" href="#features">Explore features</a>
            </div>
            <p className="small muted">For students, teachers, working professionals, researchers and independent learners.</p>
          </div>
        </section>

        <section className="l-section" id="features">
          <div className="l-wrap">
            <h2 className="l-h2">Everything you need to learn — nothing you don’t</h2>
            <div className="l-grid">
              {FEATURES.map(([Icon, t, d]) => (
                <article className="l-card" key={t}><span className="l-ic"><Icon /></span><h3>{t}</h3><p>{d}</p></article>
              ))}
            </div>
          </div>
        </section>

        <section className="l-section alt" id="cloud">
          <div className="l-wrap">
            <h2 className="l-h2">Built on two clouds, each with a clear job</h2>
            <div className="l-grid three">
              <article className="l-card"><span className="l-ic"><KeyRound /></span><h3>Google Firebase</h3><p>Secure sign-in and your account data in Cloud Firestore.</p></article>
              <article className="l-card"><span className="l-ic teal"><Cloud /></span><h3>Microsoft Azure AI</h3><p>Azure OpenAI generates study content and reads your syllabus.</p></article>
              <article className="l-card"><span className="l-ic teal"><Database /></span><h3>Microsoft Azure Storage</h3><p>Your uploaded documents in a private Azure Blob Storage container.</p></article>
            </div>
          </div>
        </section>

        <section className="l-section" id="privacy">
          <div className="l-wrap l-privacy">
            <ShieldCheck />
            <div>
              <h2 className="l-h2" style={{ textAlign: 'left', marginBottom: 8 }}>Private by design</h2>
              <p className="muted">Mindora is not a social network. There are no public posts, feeds, likes or messages — only your own learning space. AI-generated content is always labelled, and official previous-year papers are kept separate from AI practice questions.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="l-foot"><div className="l-wrap l-foot-in"><Logo size={26} /><span className="small muted">© {new Date().getFullYear()} Mindora · Cloud Fundamentals project</span></div></footer>
    </div>
  );
}
