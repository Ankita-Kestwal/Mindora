import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Timer, Send } from 'lucide-react';
import { Alert } from './ui.jsx';

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Takes a quiz (answers hidden) or shows results (after submit). */
export default function QuizPlayer({ quiz, onSubmit, busy }) {
  const [picks, setPicks] = useState(() => quiz.result?.picks || quiz.questions.map(() => null));
  const [left, setLeft] = useState(null);
  const submitted = quiz.status === 'submitted';
  const sent = useRef(false);

  useEffect(() => {
    if (submitted || !quiz.timed || !quiz.durationMin) return undefined;
    const end = new Date(quiz.startedAt).getTime() + quiz.durationMin * 60000;
    const tick = () => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0 && !sent.current) { sent.current = true; onSubmit(picks); } // auto-submit at time-up
    };
    tick(); const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [quiz, submitted, picks, onSubmit]);

  const answered = picks.filter((p) => p !== null).length;
  return (
    <div className="quiz">
      {!submitted && (
        <div className="quiz-bar">
          <span>{answered} / {quiz.questions.length} answered</span>
          {left !== null && <span className={`quiz-timer ${left < 60 ? 'low' : ''}`} role="timer" aria-live="off"><Timer /> {fmt(left)}</span>}
        </div>
      )}
      {submitted && (
        <div className={`quiz-score ${quiz.result.percent >= 70 ? 'good' : quiz.result.percent >= 40 ? 'ok' : 'low'}`}>
          <b>{quiz.result.score} / {quiz.result.total}</b><span>{quiz.result.percent}% · {fmt(quiz.result.timeTakenSec)} taken{quiz.result.late ? ' · submitted after the time limit' : ''}</span>
        </div>
      )}
      <ol className="q-list">
        {quiz.questions.map((q, i) => (
          <li key={i} className="q-item">
            <p className="q-text">{q.question}</p>
            <div className="q-opts" role="radiogroup" aria-label={`Question ${i + 1}`}>
              {q.options.map((o, j) => {
                const chosen = picks[i] === j;
                const right = submitted && quiz.answers[i] === j;
                const wrong = submitted && chosen && !right;
                return (
                  <button key={j} type="button" role="radio" aria-checked={chosen} disabled={submitted}
                    className={`q-opt ${chosen ? 'on' : ''} ${right ? 'right' : ''} ${wrong ? 'wrong' : ''}`}
                    onClick={() => setPicks((p) => p.map((x, k) => (k === i ? j : x)))}>
                    <span className="q-letter">{'ABCD'[j]}</span>{o}
                    {right && <CheckCircle2 aria-label="Correct answer" />}{wrong && <XCircle aria-label="Your answer (wrong)" />}
                  </button>
                );
              })}
            </div>
            {submitted && <p className={`q-exp ${quiz.result.correct[i] ? 'ok' : ''}`}>{quiz.result.correct[i] ? 'Correct. ' : quiz.result.picks[i] === null ? 'Not answered. ' : 'Incorrect. '}{quiz.explanations[i]}</p>}
          </li>
        ))}
      </ol>
      {!submitted && (<>
        {answered < quiz.questions.length && <Alert type="info">{quiz.questions.length - answered} question(s) unanswered — they’ll count as wrong.</Alert>}
        <div className="row-end" style={{ marginTop: 12 }}>
          <button className="btn btn-primary btn-lg" onClick={() => { sent.current = true; onSubmit(picks); }} disabled={busy}>{busy ? <span className="spinner" /> : <Send />} Submit answers</button>
        </div>
      </>)}
    </div>
  );
}
