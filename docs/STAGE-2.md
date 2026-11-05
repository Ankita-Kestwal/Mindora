# Stage 2 report — AI Learning (Microsoft Azure OpenAI)

## Completed
- **Azure OpenAI integration** (server-side only — the key never reaches the browser). It works with gpt-5-mini and other reasoning models (correct API version, `max_completion_tokens`, low reasoning effort to save credit). It accepts every endpoint format the Azure portal shows, and removes any “thinking” text from answers.
- **AI Learning page:** enter any topic (and optional subject) and generate an **Explanation, Theory, Notes, Examples, Diagram, Programming solution** or an **Exam answer for 2, 3, 5, 8, 10, 12, 15, 20, 25 or 30 marks**.
- Answers are personalised to the learner’s level, education and account type, and limited to educational topics (non-academic requests are refused).
- Rich rendering: headings, tables, code blocks, quotes and **Mermaid diagrams**. All AI output is sanitised against script injection.
- Every answer is clearly labelled **AI-generated**, with a reminder to verify important facts.
- **Saved content:** everything generated is saved to the user’s account (`users/{uid}/content`). Copy or delete any item.
- **Learning history and resume:** each topic is tracked (`users/{uid}/history`) with sessions, the types studied and the last item. **Continue** opens exactly where you stopped; the dashboard shows a *Continue learning* card.
- **Test Azure connection** button on the dashboard makes one tiny real call to confirm your keys work.
- Protection for your Azure credit: 40 AI requests per user per hour (change with `AI_REQUESTS_PER_HOUR` in `server/.env`).
- Clear messages for a wrong key, wrong deployment name, rate limits, content-safety blocks, timeouts and missing configuration.

## Tested
| Test | Result |
|---|---|
| Server tests (Stage 1 + Stage 2) using the Firebase Auth emulator and a stand-in that behaves like the Azure OpenAI API | 24 / 24 pass |
| End-to-end browser test (connection test, validation, exam answer with diagram/table/code, XSS blocked, saved items, history, resume from history and dashboard, delete, mobile layout) | 17 / 17 pass |

**Not tested against your real Azure deployment** — I can’t reach it from my environment. Confirm it on your PC: dashboard → **Test Azure connection**, then generate a topic.

## How to check it on your PC
1. Download the new ZIP and unzip it, **then copy your `server\.env` from the old folder into the new `mindora\server` folder.**
2. `npm run dev` in the `mindora` folder.
3. Register → Dashboard → **Test Azure connection**. You should see “Azure OpenAI replied in … s”.
4. Open **AI Learning**, type a topic, choose a type, click **Generate**.

If the test shows an error, the message says what is wrong (key, deployment name or endpoint). Send me that message — never the key.

## Remaining
3 Syllabus upload (AWS S3 + Azure Document Intelligence) · 4 Quizzes and smart revision · 5 Exams, reminders and question papers · 6 Sunday challenges and reports · 7 Hardening and deployment.

## Configuration needed for Stage 3
- **AWS:** an S3 bucket in `ap-south-1` and an IAM user’s access key (I’ll give you a policy that only allows that bucket).
- **Azure:** an **Azure AI Document Intelligence** resource (endpoint + key) in an allowed region of your student subscription.
