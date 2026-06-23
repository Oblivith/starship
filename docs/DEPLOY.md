# STARSHIP — Deployment Guide

Stack: **Python/FastAPI backend on Render (free tier) + React/Vite frontend on Vercel + PostgreSQL on Supabase.**

---

## Step 1 — Supabase (database)

1. Go to [supabase.com](https://supabase.com) → **New project** → choose a region close to India (Singapore).
2. Once the project is ready, go to **Project Settings → Database → Connection string → URI**.
   Copy the string — it looks like:
   ```
   postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
3. In a local terminal, run all migrations in order against the Supabase DB:
   ```bash
   psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
     -f schema.sql \
     -f migrations/001_*.sql \
     -f migrations/002_*.sql \
     -f migrations/003_*.sql \
     -f migrations/004_career_profiles_expansion.sql \
     -f migrations/004b_career_profiles_data.sql \
     -f migrations/005_programs_expansion.sql \
     -f migrations/006_country_salaries.sql
   ```
   > If `psql` is at `/opt/homebrew/bin/psql`, prefix every command with that path.
4. Keep the connection string — you'll need it as `DATABASE_URL` in Step 2.

---

## Step 2 — Render (backend)

1. Push this repo to GitHub if not already there.
2. Go to [render.com](https://render.com) → **New → Web Service** → connect your GitHub repo.
3. Render will detect `render.yaml` automatically. Confirm:
   - **Runtime:** Python
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `gunicorn api:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`
4. Under **Environment → Environment Variables**, add every key from `render.yaml`. Values:

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | Supabase connection string from Step 1 |
   | `COHERE_API_KEY` | Your Cohere API key |
   | `JWT_SECRET` | A long random string (e.g. `openssl rand -hex 32`) |
   | `ADMIN_KEY` | Any secret string you'll use for `/admin/*` routes |
   | `MSG91_AUTH_KEY` | MSG91 auth key (leave blank to skip SMS) |
   | `MSG91_SENDER_ID` | `STRSHP` (or your approved sender ID) |
   | `MSG91_TEMPLATE_ID` | Your MSG91 OTP flow template ID |
   | `RESEND_API_KEY` | Resend.com API key (leave blank to skip email) |
   | `FROM_EMAIL` | `noreply@projectstarship.in` |
   | `GOOGLE_CLIENT_ID` | Google OAuth client ID |
   | `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
   | `GOOGLE_REDIRECT_URI` | `https://starship-api.onrender.com/auth/google/callback` |
   | `FRONTEND_ORIGINS` | `https://projectstarship.vercel.app` (or your custom domain) |

5. Click **Deploy**. The first deploy takes ~2–3 minutes.
6. Note your service URL: `https://starship-api.onrender.com` (or similar). Test it:
   ```
   curl https://starship-api.onrender.com/
   ```

> **Free tier note:** Render free services spin down after 15 minutes of inactivity. The first request after idle takes ~30s to cold-start. Upgrade to the $7/month tier to prevent this.

---

## Step 3 — Vercel (frontend)

1. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import your GitHub repo.
2. Set the **Root Directory** to `frontend`.
3. Vercel will detect Vite automatically.
4. Under **Environment Variables**, add:

   | Key | Value |
   |-----|-------|
   | `VITE_API_BASE_URL` | `https://starship-api.onrender.com` |

   > Update this to your actual Render URL from Step 2.

5. Click **Deploy**. The build runs `npm run build` inside `frontend/`.
6. `frontend/vercel.json` is already in place — it rewrites all paths to `index.html` so React Router's client-side routing works.

---

## Step 4 — Post-deploy checklist

Run each check after both services are live:

- [ ] `GET https://starship-api.onrender.com/` → `{"message": "Career Counseling API is running"}`
- [ ] Open your Vercel URL in a browser → Landing page loads, no console errors
- [ ] Register a new student (email flow) → OTP arrives (or check DB `otp_hash` directly)
- [ ] Complete the OTP step → redirected to Onboarding
- [ ] Fill Onboarding → Assessment starts, 155 questions load
- [ ] Complete a few answers → progress saves, ProgressBar advances
- [ ] Submit assessment → Results page renders with real RIASEC radar + career cards
- [ ] Click a career → Roadmap shows salary, education path, recruiters
- [ ] Open the counselor orb → chat reply arrives from Cohere

---

## Step 5 — Custom domain (brief)

- **Render:** Dashboard → your service → **Settings → Custom Domains** → add your domain → update DNS.
- **Vercel:** Dashboard → your project → **Settings → Domains** → add your domain → update DNS.

Full instructions: [Render custom domains](https://render.com/docs/custom-domains) · [Vercel custom domains](https://vercel.com/docs/projects/domains).

---

## Step 6 — Update OAuth + CORS for production URLs

After you know your final domain(s), update two env vars in Render and one in Google Console:

1. **`GOOGLE_REDIRECT_URI`** — change to `https://your-api-domain.com/auth/google/callback`
2. **`FRONTEND_ORIGINS`** — change to `https://your-frontend-domain.com` (comma-separate multiple origins)
3. In [Google Cloud Console](https://console.cloud.google.com/) → your OAuth app → **Authorized redirect URIs** — add the same `GOOGLE_REDIRECT_URI` value.

Trigger a Render redeploy after updating env vars (Settings → Manual Deploy).

---

## Local dev (unchanged)

The `DATABASE_URL` env var is only set in production. Locally, `database.py` falls back to the `DB_CONFIG` dict (host/port/dbname/user/password from `.env`), so nothing about local development changes.

```bash
# Backend
python3 -m uvicorn api:app --host 127.0.0.1 --port 8000

# Frontend
cd frontend && PATH=/opt/homebrew/bin:$PATH npm run dev
```
