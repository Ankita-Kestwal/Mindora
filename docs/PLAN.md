# Mindora — Development Plan

Mindora is a private, AI-powered personalised learning and academic assistance platform.
This plan covers the architecture, folder structure, database design, API, build stages
and the configuration you will need to provide.

---

## 1. Decisions taken from your answers

| Topic | Decision |
|---|---|
| Theme | Matte-black / charcoal dark theme and a matching light theme, accents royal blue and teal. **Automatic mode switches dark ↔ light every N minutes** (user sets N, default 5, can turn it off; manual toggle always available). Saved to the user's account and locally, applied before first paint (no flash). |
| Fonts | **Font family picker** (size fixed). Choices: Inter (default), Poppins, Sora, IBM Plex Sans, Lexend, Source Serif 4 (reading). Saved to the account. |
| Previous-year papers | Two clearly separated sources — never mixed, always labelled: <br>**① Official papers** – for Class 10/12 boards, JEE, NEET, UPSC and other competitive exams. An admin-maintained catalogue of papers from **official sources only** (e.g. CBSE, state boards, NTA, UPSC), each stored with its source URL, exam, subject and year. A backend job fetches files only from an allow-list of official domains into S3. Copying papers from commercial/coaching websites is not done: their content is copyrighted and their terms forbid scraping. <br>**② AI-generated papers and questions** – 10 to 30-mark (and shorter) questions for any topic, and full papers for semester/school exams built from **a format the user writes** (sections, number of questions, marks each, duration, difficulty). Always marked "AI-generated practice". |
| Delivery | ZIP after each stage, with Windows/VS Code setup instructions. |
| File storage (changed in Stage 3) | **Azure Blob Storage replaces AWS S3**, at your request, so no AWS account is needed. Mindora now uses two clouds: Google Firebase and Microsoft Azure. Syllabi are read by Azure OpenAI (gpt-5-mini), so Document Intelligence is not needed either. |

## 2. Architecture

```
 Browser (React + Vite SPA)
   │  Firebase Auth client SDK → gets ID token
   │  HTTPS + "Authorization: Bearer <ID token>"
   ▼
 Node.js + Express API  ─────────────────────────────────────────┐
   │ verifies ID token (Firebase Admin)                           │
   │ validates input (zod), rate-limits, role checks              │
   ├──► Google Firebase   Auth + Cloud Firestore (Admin SDK)      │
   ├──► AWS S3            private bucket, pre-signed URLs         │
   └──► Microsoft Azure   Azure OpenAI (chat completions)         │
                          Azure AI Document Intelligence (syllabus)│
 Scheduled jobs (node-cron in the API process):                  │
   reminders, Sunday challenge publishing, official-paper fetch ──┘
```

Key rules
- The browser only talks to Firebase **Auth**. All data goes through the API, which uses the Admin SDK. Firestore rules deny all direct client access (defence in depth).
- AWS and Azure keys, and the Firebase service account, live only in `server/.env`.
- Files never pass through the browser to S3 without a server-issued, short-lived pre-signed URL scoped to the user's own prefix.

## 3. Folder structure

```
mindora/
├─ client/                     React + Vite
│  ├─ index.html               theme/font boot script (no flash)
│  └─ src/
│     ├─ main.jsx, App.jsx, router.jsx
│     ├─ lib/                  firebase.js, api.js, theme.js, fonts.js
│     ├─ context/              AuthContext, PrefsContext
│     ├─ components/           layout (Sidebar, Topbar), ui (Button, Card, Modal, Toast…)
│     ├─ pages/                Landing, Auth (Login/Register/Forgot), Onboarding,
│     │                        Dashboard, Learn, Topic, Syllabus, Notes, Quizzes,
│     │                        Revision, Exams, Papers, Challenges, Reports,
│     │                        History, Settings, Admin
│     └─ styles/               tokens.css (dark + light), base.css
├─ server/                     Node.js + Express
│  ├─ src/
│  │  ├─ app.js, index.js
│  │  ├─ config/env.js
│  │  ├─ middleware/           auth, admin, validate, rateLimit, errors
│  │  ├─ services/             firebase.js, s3.js, azureAI.js, docIntel.js
│  │  ├─ repos/                users, topics, history, syllabi, quizzes, exams,
│  │  │                        reminders, papers, challenges, reports (Firestore)
│  │  ├─ routes/               one file per module
│  │  ├─ jobs/                 reminders, challenges, paperFetcher
│  │  └─ prompts/              AI prompt templates
│  └─ test/                    API + integration tests
├─ firebase/                   firestore.rules, firestore.indexes.json, firebase.json
├─ aws/                        s3-bucket-policy.json, cors.json, iam-policy.json
├─ docs/                       PLAN.md, SETUP.md, TESTING.md, stage reports
└─ package.json                workspace scripts
```

## 4. Database design (Cloud Firestore)

```
users/{uid}
  displayName, email, category (student|teacher|professional|researcher|independent|other),
  education { level, board, institution, course, semester }, interests[], learningLevel
  (beginner|intermediate|advanced), role (user|admin), mindoraId (e.g. MND-7K3Q9X),
  prefs { theme: dark|light, autoTheme: bool, autoIntervalMin, font },
  createdAt, updatedAt

users/{uid}/history/{entryId}      topicId, title, subject, lastSection, progress %, updatedAt
users/{uid}/content/{contentId}    saved AI output: topic, type (explanation|notes|examples|
                                   diagram|code|exam-answer), marks?, body (markdown), model, createdAt
users/{uid}/syllabi/{syllabusId}   title, s3Key, status (uploaded|processing|ready|failed),
                                   tree [{ subject, units:[{ title, chapters:[{ title, topics[] }] }] }]
users/{uid}/quizAttempts/{id}      topic, source (ai|official), questions[], answers[], score,
                                   total, timeTakenSec, timed, createdAt
users/{uid}/weakTopics/{topicKey}  topic, mistakes, lastSeen, strength (0–1)   ← drives smart revision
users/{uid}/exams/{examId}         name, subject, date, time, venue?, syllabusRef?
users/{uid}/reminders/{id}         examId?, title, remindAt, channel (in-app|email), sent
users/{uid}/notifications/{id}     type, title, body, read, createdAt
users/{uid}/generatedPapers/{id}   format { sections[], duration, difficulty }, questions[], createdAt

officialPapers/{paperId}           exam (CBSE-10|CBSE-12|JEE-Main|NEET-UG|UPSC-CSE|…), subject, year,
                                   session, sourceUrl, sourceName, s3Key?, addedBy, verified
challenges/{weekId}                (e.g. 2026-W45) opensAt (Sunday), closesAt, topics[],
                                   questions[], durationMin
challenges/{weekId}/entries/{uid}  score, timeTakenSec, submittedAt     (private to user)
reports/{uid}/monthly/{yyyy-mm}    topicsStudied, quizzes, avgScore, weakTopics[], streak
```

There is no public data, no feeds, comments, likes or messaging. Challenge results are visible only to the user who took them.

## 5. AWS S3 layout

```
s3://<bucket>/users/{uid}/syllabi/{syllabusId}/{file}
s3://<bucket>/users/{uid}/uploads/{fileId}/{file}
s3://<bucket>/official-papers/{exam}/{year}/{paperId}.pdf
```
Block Public Access on; SSE-S3 encryption; pre-signed PUT (5 min) and GET (10 min); 15 MB limit; PDF/JPG/PNG only (type checked on the server after upload).

## 6. Azure

- **Azure OpenAI** (via Azure AI Foundry): explanations, notes, examples, diagrams (as Mermaid code rendered in the browser), programming solutions, quizzes, 10–30-mark exam answers, practice questions, full papers from a user-written format.
- **Azure AI Document Intelligence** (prebuilt-layout): reads uploaded syllabus PDFs/images. Azure OpenAI then structures the text into subject → unit → chapter → topic.
- Every AI response is saved with an "AI-generated" flag and shown with a "verify with your textbook" note.

## 7. API (all under `/api`, all require a Firebase ID token unless noted)

| Area | Endpoints |
|---|---|
| Health | `GET /health` (public) |
| Profile | `GET/PUT /me`, `PUT /me/prefs` |
| Learning | `POST /learn/generate` {topic, type, marks?, level}, `GET /content`, `GET/DELETE /content/:id` |
| History | `GET /history`, `PUT /history/:topicId` |
| Syllabus | `POST /syllabi/upload-url`, `POST /syllabi/:id/process`, `GET /syllabi`, `GET /syllabi/:id`, `DELETE /syllabi/:id` |
| Quizzes | `POST /quizzes/generate`, `POST /quizzes/:id/submit`, `GET /quizzes` |
| Revision | `GET /revision/plan`, `POST /revision/quiz` |
| Exams | CRUD `/exams`, CRUD `/reminders`, `GET /notifications`, `PUT /notifications/:id/read` |
| Papers | `GET /papers/official` (filters), `GET /papers/official/:id/download`, `POST /papers/generate` {format}, `GET /papers/generated` |
| Challenges | `GET /challenges/current`, `POST /challenges/current/start`, `POST /challenges/current/submit`, `GET /challenges/history` |
| Reports | `GET /reports/summary`, `GET /reports/monthly/:month` |
| Admin | `POST /admin/papers` (catalogue an official paper), `POST /admin/papers/:id/fetch` (allow-listed domains only) |

## 8. Stages

| Stage | Scope | Tested with |
|---|---|---|
| **1 Foundation** | Monorepo, Express API, Firebase Auth (register/login/forgot/logout, persistence), Mindora ID, onboarding (category, education, interests, level), profile, Firestore repos, dark/light theme + timed auto-switch, font picker, landing page, app shell, dashboard skeleton, settings | Firebase Auth emulator, API tests, browser tests |
| **2 AI Learning** | Azure OpenAI service, topic page (explanation/theory/notes/examples/diagram/code/exam-answers 2–30 marks), saved content, learning history + resume | Mock Azure endpoint + live once you add keys |
| **3 Syllabus** | S3 pre-signed upload, Document Intelligence extraction, AI structuring, syllabus tree, generate material per topic | Local S3 server, mock Azure |
| **4 Practice & Revision** | Quizzes (MCQ/short/long), timed assessments, scoring, weak-topic tracking, smart revision | API + browser tests |
| **5 Exams & Papers** | Timetable, reminders + notifications job, official-paper catalogue (admin), AI paper generator from user format | API + browser tests |
| **6 Challenges & Reports** | Sunday weekly challenges, private results, monthly reports, analytics charts | API + browser tests |
| **7 Hardening** | Security review, rate limits, Firestore rules, responsive and accessibility pass, docs, deployment guide | Full regression |

## 9. What you will need to provide

| Service | What | Cost note |
|---|---|---|
| Firebase | A project, a Web app config, Email/Password sign-in enabled, Firestore created, a service-account key | Spark (free) plan is enough — Storage is not used |
| AWS | An S3 bucket in `ap-south-1`, an IAM user limited to that bucket (policy provided) | Free tier for 12 months, then pay-per-use |
| Azure | An Azure OpenAI deployment (e.g. a GPT-4o-mini–class model) and a Document Intelligence resource — endpoint + key for each | Pay-per-use; student credit works |

Until these are set, the app runs against local emulators/mocks, and every screen says clearly which services are connected — nothing is faked as live.
