# Mindora

An AI-powered personalised learning and academic assistance platform, built on two clouds: **Google Firebase** (authentication and Cloud Firestore) and **Microsoft Azure** (Azure OpenAI for AI features and Azure Blob Storage for private documents).

- `client/` — React + Vite website
- `server/` — Node.js + Express API (holds every secret; the browser never sees cloud keys)
- `firebase/` — Firestore security rules
- `docs/PLAN.md` — architecture, database design, API and the build stages
- `docs/SETUP.md` — how to run it in VS Code on Windows
- `docs/STAGE-1.md`, `STAGE-2.md`, `STAGE-3.md`, `STAGES-4-7.md` — what each stage delivered and how it was tested
- `docs/DEPLOY.md` — putting Mindora online (optional)

**Start:** open this folder in VS Code and run `npm run dev`.
