# Running Mindora in VS Code on Windows

## 1. Install once
- **Node.js 22 LTS** (minimum 20.19) — https://nodejs.org. Check in a terminal with `node -v`.
- **VS Code** — https://code.visualstudio.com

## 2. Start it (one command)

1. Unzip `mindora-complete.zip`.
2. In VS Code: **File → Open Folder…** and choose the **`mindora`** folder (the one that contains `package.json`, not the folder above it).
3. Open a terminal: **Terminal → New Terminal** (or Ctrl + `).
4. Run:
   ```powershell
   npm run dev
   ```
   The first run installs everything (a few minutes). Then the browser opens **http://localhost:5173** by itself.

Keep that terminal open while you use the site. Press **Ctrl + C** to stop.

This is **local demo mode**: sign-in uses the Firebase Auth emulator and data is kept in memory, so accounts disappear when you stop it (register again after each restart). The Sunday Challenge is open every day in this mode.

**Your `server\.env`** must contain your Azure values (AI and storage) — see `server/.env.example`. To see the admin features (adding official papers), put your email in `ADMIN_EMAILS=` *before* you register.

### Don’t
- Don’t double-click `client/index.html` or use **Live Server** — the site must be served by `npm run dev`.
- Don’t close the terminal while using the site.

## 3. If it doesn’t open

| You see | Fix |
|---|---|
| `Mindora needs Node.js 20.19+ or 22.12+` | Install Node 22 LTS, close and reopen VS Code, run again. |
| `'npm' is not recognized` | Node isn’t installed or VS Code was open during install — reinstall Node, restart VS Code. |
| `Missing script: "dev"` | You opened the wrong folder. Open the folder that contains `package.json`. |
| `running scripts is disabled on this system` | Run once in PowerShell: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then try again. Or switch the VS Code terminal to **Command Prompt** (the ⌄ next to + in the terminal panel). |
| `Port 5173 / 4000 / 9099 is already in use` | Another copy is still running — close other terminals, or restart VS Code. |
| A Windows Firewall pop-up | Click **Allow** (it’s the local emulator). |
| Page opens but says “Can’t reach the Mindora server” | The `[api]` part of the terminal stopped — scroll up for the red error and send it to me. |

Still stuck? Copy the red text from the terminal and send it to me.

## 4. Connect your real Firebase project (when ready)

1. https://console.firebase.google.com → **Add project** (the free Spark plan is enough — Mindora stores files in Azure Blob Storage).
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** → production mode → region `asia-south1` (Mumbai).
4. **Project settings → General → Your apps → Web (</>)** → register → copy `client/.env.example` to `client/.env.local` and fill in the config values.
5. **Project settings → Service accounts → Generate new private key** → save it as `server/firebase-service-account.json` (never share or upload it).
6. Copy `server/.env.example` to `server/.env`, set `FIREBASE_PROJECT_ID`, keep `DATA_STORE=firestore`, and put your email in `ADMIN_EMAILS`.
7. Deploy the security rules:
   ```powershell
   npx firebase login
   npx firebase deploy --only firestore:rules --project your-project-id
   ```
8. Start with your real project:
   ```powershell
   npm run dev:real
   ```

## 5. Run the tests
```powershell
npm run test:server
```
