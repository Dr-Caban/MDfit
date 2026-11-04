# MD Fit — Operations Reference

Owner: Dr. Jared Caban (jaredcaban0nopills@gmail.com)

Last verified in GitHub, Vercel and Railway: 2026-11-04.

## Services at a glance

| Service | Platform | Where |
|---|---|---|
| Source code | GitHub | `Dr-Caban/MDfit`, branch `claude/lone-soulja-podcast-site-2ii8fj` |
| Frontend | Vercel | Team **MD Fit** (`md-fit`) → project `mdfit-frontend` |
| Backend API | Railway | Workspace **Jared Caban's Projects** → project `serene-reprieve` → service `-` |
| Backend URL | Railway | `https://amiable-peace-production-e382.up.railway.app` |
| Media uploads | Cloudinary | Env vars on Railway |
| Payments | Stripe | See `docs/stripe.md` |
| Domain | Vercel | `mymdfit.com` (see Open items) |

## Deploy workflow

Push to `claude/lone-soulja-podcast-site-2ii8fj` on GitHub. Both services deploy automatically:
- Vercel `mdfit-frontend` builds `mdfit-srq/frontend` as a production deployment.
- Railway `serene-reprieve` builds `mdfit-srq/backend`.

No manual deploy step. There is **no `main` branch**; the branch above is the repo's default and production branch.

---

## GitHub

- **Repo:** [github.com/Dr-Caban/MDfit](https://github.com/Dr-Caban/MDfit)
- **Production branch:** `claude/lone-soulja-podcast-site-2ii8fj`
- **Structure:**
  - `mdfit-srq/frontend/` — MD Fit static site (Vercel)
  - `mdfit-srq/backend/` — MD Fit Node/Express API (Railway)
  - `mdfit-srq/docs/` — documentation
  - `frontend/` and `backend/` at the repo root are the **Lone Soulja podcast site**, a separate project. Not MD Fit.

## Vercel (Frontend)

- **Team:** MD Fit (`md-fit`, Hobby plan)
- **Project:** `mdfit-frontend`
- **Root directory:** `mdfit-srq/frontend`
- **Production branch:** `claude/lone-soulja-podcast-site-2ii8fj`
- **Vercel URL:** `mdfit-frontend.vercel.app` — behind Vercel login (deployment protection covers everything except custom domains), so the public only reaches the site through `mymdfit.com`.
- **Environment variables:**
  - `EDGE_SECRET` — shared secret the middleware sends to Railway so the API rejects direct access

The frontend is a static site with edge middleware (`middleware.js`) that:
1. Blocks non-US traffic
2. Blocks bots/scrapers, including `curl`
3. Proxies `/api/*` requests to Railway with the `EDGE_SECRET` header

The Railway URL appears in two places: the `API` constant in `middleware.js` and `connect-src` in the `Content-Security-Policy` header in `vercel.json`. Update both if the backend moves.

## Railway (Backend API)

- **Workspace:** Jared Caban's Projects
- **Project:** `serene-reprieve`, environment `production`
- **Services:**
  - `-` — the MD Fit API (unnamed in Railway)
  - `MongoDB` — not used by the code
- **API service source:** `Dr-Caban/MDfit`, branch `claude/lone-soulja-podcast-site-2ii8fj`, root directory `/mdfit-srq/backend`
- **Public URL:** `https://amiable-peace-production-e382.up.railway.app` (port 8080)
- **Health check path:** `/api/health` (set in `railway.json`)
- **Volume:** must be mounted at `/data` (matches `DATA_DIR`). Without it, every redeploy — so every push — wipes all data: clients, bookings, pain logs, intake forms, messages.

Data is stored as encrypted JSON files under `DATA_DIR`. There is no database server: `MONGODB_URI` and the `MongoDB` service are not used, and neither is `JWT_SECRET`.

### Previous setup (Josh Lerner's accounts)

- Railway: project `digitalapple-backend` → service `mdfit-api` (`mdfit-api-production.up.railway.app`). It holds the original data volume and encryption keys. Do not delete it until that data is copied to `serene-reprieve` and the keys match.
- Vercel: project `mdfit-srq` in team `josh-lerners-projects` also builds `mdfit-srq/frontend` from this repo.

### Environment variables (API service)

**Core:**
- `EDGE_SECRET` — must match Vercel's value
- `SESSION_SECRET` — signs login sessions for client accounts and admin
- `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` — admin login (`npm run hash-password -- 'your password'`). Admin two-factor is on by default; `ADMIN_MFA=off` is an emergency switch (e.g. if email is down).
- `DATA_DIR` — `/data`
- `ALLOWED_ORIGINS` — site addresses allowed to call the API, comma-separated (e.g. `https://mymdfit.com`)
- `SITE_URL` — main site address, used for cancel links in emails
- `NODE_ENV` — `production`
- `TZ_NAME` — `America/New_York`

**Encryption keys — must be identical to the previous service's values, or migrated data can't be read:**
- `DATA_ENC_KEY` — encrypts every stored data file. If it is lost, the data can't be recovered. Keep a copy in a password manager.
- `MESSAGE_ENC_KEY` — message bodies; also used for intake and feedback unless `INTAKE_ENC_KEY` / `FEEDBACK_ENC_KEY` are set
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
- `GOOGLE_PLACES_API_KEY` (reviews); optional `GOOGLE_PLACE_ID`, `GOOGLE_SERVICE_ACCOUNT`, `GOOGLE_CALENDAR_ID` (calendar sync)

**Cloudinary:**
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

**Cal.com:** `CAL_API_KEY`, `CAL_WEBHOOK_SECRET`

**Optional:** `SIMPLEPRACTICE_ICS_URL`, `MIN_IOS_BUILD`, `LEADERBOARD_PACERS`, `LOG_LEVEL`, `BOT_FILTER` (default `on`)

## Cloudinary (Media)

- **Used for:** Video and image uploads in the media library
- **Backend file:** `mdfit-srq/backend/lib/videos.js`
- **Dashboard:** [cloudinary.com/console](https://cloudinary.com/console)
- If not configured, upload endpoints return a 400 error explaining which vars are missing.
- Exercise-library videos are imported from Google Drive. A Drive file that isn't shared publicly logs `media upload failed … Resource not found` and is skipped.

## Stripe (Payments)

Full setup instructions: `docs/stripe.md`

- **Webhook URL:** `https://amiable-peace-production-e382.up.railway.app/api/stripe/webhook`
- **Env vars:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` (on Railway)

## Domain (mymdfit.com)

- Attach in Vercel → MD Fit → `mdfit-frontend` → Settings → Domains
- If the domain is on another Vercel project or account, remove it there first
- SSL is automatic on Vercel

## Health checks

1. **Backend:** `curl https://amiable-peace-production-e382.up.railway.app/api/health` returns `{"ok":true}`.
   Every other route on the Railway URL returns **403** when called directly — it only answers requests that come through the site's middleware. That is expected.
2. **Site + API end to end:** in a browser, open `https://mymdfit.com/api/site`. A JSON page with MD Fit's settings means Vercel, the edge secret and Railway are all working. (`curl` is blocked by the middleware's bot filter, so use a browser.)
3. **Data and keys:** log in at `mymdfit.com/admin` and confirm existing clients and bookings appear.

## Open items (2026-11-04)

- **Railway volume:** the API service has no volume. Attach one mounted at `/data`, then migrate data from `digitalapple-backend` → `mdfit-api`.
- **Domain:** `mymdfit.com` is not attached to `mdfit-frontend`; it's held by a different Vercel account.
- **Staged Railway change:** a pending, unapplied change would switch the API service's branch to `claude/modest-goldberg-ujh0kt`. That branch has diverged from production (45 commits not in production, 51 production commits missing). Applying it would stop pushes to the production branch from updating the backend.

All secrets live in Railway and Vercel env vars — never in code.
