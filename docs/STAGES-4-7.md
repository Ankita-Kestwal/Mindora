# Stages 4–7 report

## Stage 4 — Quizzes and Smart Revision
- **Quizzes:** any topic, 5–20 multiple-choice questions, easy / medium / hard, optional **timed assessment** (countdown, auto-submit at time-up, late submissions marked).
- Answers stay on the server until you submit, so they can’t be seen in the browser. Results show the score, the correct answers and an explanation for each question.
- **Weak-topic tracking:** every quiz updates a per-topic strength score (recent accuracy) and mistake count.
- **Smart Revision:** lists topics that *need work*, topics *due for review* (not practised for 7+ days) and topics you *studied but never tested*. One click builds a revision quiz on them.

## Stage 5 — Exams, reminders and question papers
- **Exam timetable:** name, subject, date, time, venue and notes; countdown to each exam; edit and delete.
- **Reminders:** choose 14 / 7 / 3 / 1 days before or on the day. They appear in Mindora — bell icon with unread count, Notifications page and the dashboard. (No email/SMS: that would need another paid service.)
- **Official previous-year papers:** catalogue for CBSE, state boards, JEE, NEET, UPSC, GATE, CUET and universities. Only the **admin** (emails in `ADMIN_EMAILS`) can add papers, and each must link to an **official https website** (`gov.in`, `nic.in`, `ac.in`, `edu.in`, CISCE). An optional PDF copy is stored privately in Azure Blob Storage. Students can filter, open the source or the PDF. These are never AI-generated, and Mindora doesn’t copy papers from other sites.
- **AI practice paper generator:** you write the format — exam style, subject, topics, duration, difficulty and sections (MCQ, short, long, numerical, case study; number of questions; marks each, up to 30). Presets: CBSE 10 (80 marks), CBSE 12 (70), JEE Main and NEET (per subject), UPSC Mains GS (250), University. Optional answer key and marking scheme. Always labelled **AI-generated practice**. Printable (Ctrl + P).

## Stage 6 — Sunday Challenge and Reports
- **Sunday Challenge:** a personal 15-question, 20-minute timed challenge built from your weak topics and interests. Opens on **Sundays (India time)**, one attempt per week, results private. In local demo mode (`npm run dev`) it opens every day so you can test it.
- **Reports:** monthly report from your own data — topics studied, learning sessions, quizzes, accuracy, active days, streak, a daily activity chart, quiz scores, weak and strong topics, and challenge results.

## Stage 7 — Hardening
- Every API route checks the Firebase sign-in token; admin-only routes check the role on the server.
- All input is validated; uploads are checked by their real file type; AI output is sanitised before display.
- Files are in a private Azure container and are served only to their owner.
- Shared limit of 40 AI requests per user per hour (`AI_REQUESTS_PER_HOUR`) protects your Azure credit.
- The server refuses to start in production with the test data store or the Auth emulator.
- Firestore rules deny all direct browser access.

## Tested
| Test | Result |
|---|---|
| Server tests, Stages 1–6 (Firebase Auth emulator, Azurite storage, stand-in for Azure OpenAI) | 42 / 42 pass |
| Browser test for Stages 4–6 (quiz, timed quiz, revision, exam + reminder + bell, admin paper rules, AI paper, Sunday challenge, reports, student view, 7 pages on mobile) | 21 / 22 — the one failure was the test reading the dashboard before it finished loading; the screenshot confirms the cards are correct |
| Earlier stages | Stage 1: 27/27 · Stage 2: 17/17 · Stage 3: 13/13 |

**Not yet tested:** your real Azure OpenAI and Azure Storage accounts (I can’t reach them), and real Cloud Firestore (its emulator couldn’t be downloaded in my environment). Check them on your PC as described in SETUP.md.

## Things you might expect that are not included
- **Leaderboards** (mentioned in the synopsis): left out because Mindora is private with no social features — challenge results are visible only to you.
- **Email/SMS reminders:** in-app only.
- **Scraping papers from other websites:** not done for copyright reasons; papers come from official sources added by the admin.
