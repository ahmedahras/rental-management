# Render + Netlify Deployment Checklist (Free Demo)

This guide deploys:
- Backend API + PostgreSQL on Render
- Flutter web app on Netlify

## 1) Prerequisites
- Push this repo to GitHub.
- Have Render and Netlify accounts.
- Keep backend and frontend URLs ready.

## 2) Deploy PostgreSQL on Render
1. In Render dashboard, create a new PostgreSQL service (Free).
2. After creation, copy the `Internal Database URL` (or standard `DATABASE_URL` shown by Render).

## 3) Deploy Backend on Render
1. Create a new `Web Service` from your GitHub repo.
2. Use these settings:
- Runtime: `Node`
- Build Command: `npm ci && npm run build -w backend`
- Start Command: `npm run start -w backend`

3. Add environment variables:
- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `PORT=10000` (Render may override automatically)
- `DATABASE_URL=<render-postgres-url>`
- `JWT_SECRET=<long-random-64+chars>`
- `JWT_EXPIRES_IN=12h`
- `PUBLIC_BASE_URL=https://<your-backend-service>.onrender.com`
- `INVOICE_STORAGE_ROOT=storage/invoices`
- `DEFAULT_COUNTRY_CODE=91`
- `ADMIN_USERNAME=admin`
- `ADMIN_PASSWORD=<your-strong-password>`

4. After first successful deploy, open Render Shell and run:
```bash
npm run migrate -w backend
npm run seed:admin -w backend
```

5. Verify backend health:
- Open: `https://<your-backend-service>.onrender.com/health`

## 4) Build Flutter Web for Production
From repo root:
```bash
cd mobile_flutter
flutter pub get
flutter build web --release --dart-define=API_BASE_URL=https://<your-backend-service>.onrender.com
```

Build output folder:
- `mobile_flutter/build/web`

## 5) Deploy Flutter Web on Netlify
Option A: Drag-and-drop
1. Open Netlify -> Add new site -> Deploy manually.
2. Drag `mobile_flutter/build/web` folder.

Option B: Netlify CLI
```bash
cd mobile_flutter
npm i -g netlify-cli
netlify login
netlify deploy --prod --dir=build/web
```

## 6) Final Verification
1. Open Netlify URL.
2. Login with admin credentials.
3. Create a shop and tenant.
4. Confirm dashboard/report APIs load without CORS errors.

## 7) Important Free-Tier Notes
- Render free web service may sleep on inactivity; first request can be slow.
- Free tiers are for demo/testing, not production SLA.

## 8) Quick Redeploy Workflow
- Backend change: push to GitHub -> Render auto-deploys.
- Flutter UI change:
```bash
cd mobile_flutter
flutter build web --release --dart-define=API_BASE_URL=https://<your-backend-service>.onrender.com
netlify deploy --prod --dir=build/web
```
