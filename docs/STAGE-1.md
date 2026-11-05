# Stage 1 report — Foundation

## Completed
- **Project structure:** React + Vite client, Node.js + Express API, Firestore rules, setup docs.
- **Firebase Authentication:** register, login, "keep me signed in", logout, forgot password, password visibility toggle, form validation, friendly error messages, protected routes, session persistence.
- **API security:** every protected request verifies the Firebase ID token on the server; unknown fields are rejected (so users can’t give themselves the admin role); rate limiting; Helmet security headers; CORS allow-list.
- **Onboarding:** 4 steps — name and account category, education, interests, learning level. Each user gets a unique **Mindora ID** (e.g. `MND-KV587X`).
- **Cloud Firestore data layer:** profile stored at `users/{uid}`; the browser has no direct database access (rules deny all; the API uses the Admin SDK).
- **Design:** matte-black/charcoal dark theme and matching light theme, royal-blue and teal accents, responsive layout with a mobile menu.
- **Automatic theme switching:** dark ↔ light every N minutes (1–240, default 5), on/off switch, live countdown, manual toggle switches immediately and restarts the timer, keeps counting across reloads, no flash of the wrong theme.
- **Font customisation:** Inter, Poppins, Sora, IBM Plex Sans, Lexend, Source Serif 4.
- Theme and font are saved to the user’s account and follow them to other devices.
- **Dashboard:** greeting, Mindora ID (copy), learning profile, live cloud-service status, build roadmap.
- **Settings:** appearance, profile editing, password reset link, sign out.

## Tested
| Test | Result |
|---|---|
| API tests against the real Firebase Auth emulator (tokens, forged tokens, onboarding, validation, role escalation, duplicate onboarding, admin emails, prefs, user isolation) | 10 / 10 pass |
| Automatic-theme logic unit checks | 5 / 5 pass |
| End-to-end browser test (register → onboarding → dashboard → settings → auto theme → font → mobile → logout → login → reset password → 404) | 27 / 27 pass |

**Not yet tested against your real Firebase project.** The Firestore emulator couldn’t be downloaded in my build environment, so database tests used an in-memory store with the same behaviour. The Firestore code path runs for the first time when you connect your project (docs/SETUP.md, step 2b).

## Remaining (next stages)
2 AI Learning (Azure OpenAI) · 3 Syllabus upload (AWS S3 + Azure Document Intelligence) · 4 Quizzes and smart revision · 5 Exams, reminders and question papers · 6 Sunday challenges and reports · 7 Hardening and deployment.

## Configuration needed from you
- **Now (to use real Firebase):** create a Firebase project, enable Email/Password sign-in, create Firestore, and add the web config and service-account key (docs/SETUP.md, step 2b).
- **Before Stage 2:** an Azure OpenAI resource with a deployed chat model (endpoint, key and deployment name).
- **Before Stage 3:** an AWS S3 bucket plus IAM keys, and an Azure Document Intelligence resource.
