# Putting Mindora online (optional)

Local demo mode (`npm run dev`) is enough for your evaluation. To deploy:

1. **Connect real Firebase** (SETUP.md §4) so accounts and data are saved permanently.
2. **API → Azure App Service** (uses your Azure for Students credit):
   - Azure portal → *App Services → Create → Web App*, runtime **Node 22 LTS**, Linux, resource group `minora`, Free F1 plan.
   - Deploy the `server` folder (VS Code *Azure App Service* extension → *Deploy to Web App*).
   - *Configuration → Application settings*: add every line of `server/.env` (with `NODE_ENV=production`, `DATA_STORE=firestore`, `FIREBASE_SERVICE_ACCOUNT_JSON` = the key file’s contents on one line, `CORS_ORIGINS` = your website address).
3. **Website → Firebase Hosting:**
   - Set `VITE_API_URL=https://<your-app>.azurewebsites.net/api` in `client/.env.local`, then `npm run build`.
   - `npx firebase deploy --only hosting` (add `"hosting": {"public": "client/dist", "rewrites": [{"source": "**", "destination": "/index.html"}]}` to `firebase.json` first).
4. Firebase console → Authentication → Settings → **Authorized domains**: add your hosting domain.
