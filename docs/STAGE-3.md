# Stage 3 report — My Syllabus (Microsoft Azure Blob Storage + Azure OpenAI)

**Change from the plan:** at your request, **Azure Blob Storage replaces AWS S3**, so no AWS account is needed. Syllabi are read by your **gpt-5-mini** deployment, so Azure Document Intelligence isn’t needed either. Mindora now runs on **two clouds: Google Firebase and Microsoft Azure.**

## Completed
- **My Syllabus** page: drag-and-drop or choose a **PDF, JPG or PNG** (max 15 MB). Type and size are checked in the browser, and the real file type is checked again on the server.
- **Azure Blob Storage:** the actual file is stored in a **private** container (created automatically) at `users/{uid}/syllabi/{id}/{file}`. The browser never gets storage keys; the original file is streamed through the API only to its owner.
- **Reading the syllabus:** PDFs with text are read on the server; photos are sent to gpt-5-mini as images. The AI returns **subjects → units → chapters → topics**, which is cleaned and saved to the user’s account.
- Clear messages for scanned PDFs (no text), password-protected or damaged PDFs, files that aren’t a syllabus, PDFs over 40 pages, and missing storage settings.
- Shows the syllabus as a collapsible tree. **Click any topic** to open AI Learning with that topic and subject filled in.
- View the original file, **Process again**, and **Delete** (removes the file from Azure and the record).
- Dashboard now shows Azure Blob Storage status; AWS has been removed everywhere.
- Fixes from your testing: an expired demo session now signs you out cleanly, and a missing Firebase key file no longer breaks sign-in in demo mode.

## Tested
| Test | Result |
|---|---|
| Server tests (Stages 1–3). Storage tests use **Azurite**, Microsoft’s official Azure Storage emulator, so uploads go through the real Blob Storage API; the AI is a stand-in that behaves like Azure OpenAI | 32 / 32 pass |
| End-to-end browser test (upload validation, upload, tree, open original file, topic → AI Learning → notes, process again, delete, mobile) | 13 / 13 pass |

While testing, I found that the first PDF library I used could return text from a **previous** file. I replaced it with `unpdf` (Mozilla PDF.js) and verified that each file returns only its own text.

**Not tested against your real Azure storage account** — confirm on your PC (below).

## How to check it on your PC
1. Unzip the new ZIP and copy your `server\.env` into the new `mindora\server` folder.
2. Make sure `server\.env` contains `AZURE_STORAGE_CONNECTION_STRING=` with your connection string.
3. `npm run dev` → register → the dashboard should show **Microsoft Azure — Blob Storage: Configured**.
4. Open **My Syllabus**, upload your syllabus PDF or a photo, and wait for the tree.
5. In the Azure portal → your storage account → **Containers → mindora-files**, you can see the uploaded file.

## Remaining
4 Quizzes and smart revision · 5 Exams, reminders and question papers · 6 Sunday challenges and reports · 7 Hardening and deployment.
No new cloud setup is needed for Stages 4–6.
