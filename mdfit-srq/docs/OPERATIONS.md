# MD Fit — Operations Reference

Owner: Dr. Jared Caban (jaredcaban0nopills@gmail.com)

Last checked against the code and Vercel's deploy reports: 2026-11-04.

## Services at a glance

| Service | Platform | Where |
|---|---|---|
| Frontend | Vercel | Project `mdfit-srq`, team `josh-lerners-projects` |
| Backend API | Railway | `https://amiable-peace-production-e382.up.railway.app` |
| Previous backend | Railway | Project `digitalapple-backend` → service `mdfit-api` (`mdfit-api-production.up.railway.app`) |
| Source code | GitHub | `Dr-Caban/MDfit` |
| Media uploads | Cloudinary | Env vars on Railway |
| Payments | Stripe | See `docs/stripe.md` |
| Domain | Vercel | `mymdfit.com` |

---

## GitHub

- **Repo:** [github.com/Dr-Caban/MDfit](https://github.com/Dr-Caban/MDfit)
- **Production branch:** `claude/lone-soulja-podcast-site-2ii8fj` (the default branch). There is **no `main` branch**.
- **Structure:**
  - `mdfit-srq/frontend/` — MD Fit static site, deployed to Vercel
  - `mdfit-srq/backend/` — MD Fit Node/Express API, deployed to Railway
  - `mdfit-srq/docs/` — documentation
  - `frontend/` and `backend/` at the repo root are the **Lone Soulja podcast site**, a separate project (Vercel project `lone-soulja`). Not MD Fit.

## Vercel (Frontend)

- **Project:** `mdfit-srq` in team `josh-lerners-projects` — the project Vercel reports deployments for on this repo
- **Root directory:** `mdfit-srq/frontend`
- **Production branch:** must be `claude/lone-soulja-podcast-site-2ii8fj` (Project → Settings → Git). If it is set to `main`, pushes only create preview deployments and never reach the live site.
- **Domain:** `mymdfit.com` (Project → Settings → Domains)
- **Environment variables:**
  - `EDGE_SECRET` — shared secret the middleware sends to Railway so the API rejects direct access

The frontend is a static site with edge middleware (`middleware.js`) that:
1. Blocks non-US traffic
2. Blocks bots/scrapers
3. Proxies `/api/*` requests to Railway with the `EDGE_SECRET` header

The Railway URL appears in two places: the `API` constant in `middleware.js` and `connect-src` in the `Content-Security-Policy` header in `vercel.json`. Update both if the backend moves.

## Railway (Backend API)

- **Public URL:** `https://amiable-peace-production-e382.up.railway.app` (in use since commit `7371cee`, 2026-11-04)
- **Root directory:** `mdfit-srq/backend`
- **Branch:** `claude/lone-soulja-podcast-site-2ii8fj`
- **Health check path:** `/api/health` (set in `railway.json`)
- **Volume:** must be mounted at `/data`. Without it, every redeploy wipes all data: clients, bookings, pain logs, intake forms, messages.
- **Previous backend:** `digitalapple-backend` → `mdfit-api`. It holds the existing data volume and the original encryption keys. Do not delete it until the data has been copied to the new service's volume and the keys below match.

There is no database server. Data is stored as encrypted JSON files on the Railway volume. `MONGODB_URI` and `JWT_SECRET` are not used by the code.

### Environment variables

**Core (required):**
- `EDGE_SECRET` — must match Vercel's value
- `SESSION_SECRET` — signs login sessions for client accounts and admin
- `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` — admin login (`npm run hash-password -- 'your password'`). Admin two-factor is on by default; `ADMIN_MFA=off` is an emergency switch (e.g. if email is down).
- `DATA_DIR` — `/data`
- `ALLOWED_ORIGINS` — site addresses allowed to call the API, comma-separated (e.g. `https://mymdfit.com`)
- `SITE_URL` — main site address, used for cancel links in emails
- `NODE_ENV` — `production`
- `TZ_NAME` — `America/New_York`

**Encryption keys — must be identical to the previous service's values, or existing data can't be read:**
- `DATA_ENC_KEY` — encrypts every stored data file. If it is lost, the data can't be recovered. Keep a copy in a password manager.
- `MESSAGE_ENC_KEY`, `INTAKE_ENC_KEY`, `FEEDBACK_ENC_KEY` — message, intake and feedback bodies
- `AUDIT_SIGNING_KEY` — audit log signatures

**Stripe:**
- `STRIPE_SECRET_KEY` — restricted key (`rk_…`)
- `STRIPE_WEBHOOK_SECRET` — webhook signing secret (`whsec_…`)
- `STRIPE_PUBLISHABLE_KEY`

**Email (Resend):**
- `RESEND_API_KEY`
- `NOTIFY_FROM` — sender address for notifications
- `NOTIFY_EMAIL` — `jaredcaban0nopills@gmail.com` (defaults to `ADMIN_EMAIL`)

**Google:**
- `GOOGLE_CLIENT_ID` — `220848435517-22mrm92t01gkisnns8tu1t3e8np4km5j.apps.googleusercontent.com`
- Optional: `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID` (reviews), `GOOGLE_SERVICE_ACCOUNT`, `GOOGLE_CALENDAR_ID` (calendar sync)

**Cloudinary:**
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

**Optional:** `CAL_API_KEY`, `CAL_WEBHOOK_SECRET` (Cal.com), `SIMPLEPRACTICE_ICS_URL`, `MIN_IOS_BUILD`, `LEADERBOARD_PACERS`, `LOG_LEVEL`, `BOT_FILTER` (default `on`)

## Cloudinary (Media)

- **Used for:** Video and image uploads in the media library
- **Backend file:** `mdfit-srq/backend/lib/videos.js`
- **Dashboard:** [cloudinary.com/console](https://cloudinary.com/console)
- If not configured, upload endpoints return a 400 error explaining which vars are missing.

## Stripe (Payments)

Full setup instructions: `docs/stripe.md`

- **Webhook URL:** `https://amiable-peace-production-e382.up.railway.app/api/stripe/webhook`
- **Env vars:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` (on Railway)

## Domain (mymdfit.com)

- DNS points to Vercel (Project → Settings → Domains)
- If moving the domain between Vercel projects, remove it from the old project first
- SSL is automatic on Vercel

## Health checks

1. **Backend:** `curl https://amiable-peace-production-e382.up.railway.app/api/health` should return `{"ok":true}`.
   `/api/site` and every other API route return **403** when called directly. They only answer requests that come through the site's edge middleware, and they block curl and other automated clients. That is expected, not an outage.
2. **Frontend:** open [mymdfit.com](https://mymdfit.com).
3. **Data and keys:** log in at `mymdfit.com/admin` and confirm existing clients and bookings appear. That confirms the volume and encryption keys are right.

All secrets live in Railway and Vercel env vars — never in code.
