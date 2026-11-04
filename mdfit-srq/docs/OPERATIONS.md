# MD Fit — Operations Reference

Owner: Dr. Jared Caban (jaredcaban0nopills@gmail.com)

## Services at a glance

| Service | Platform | URL / Dashboard |
|---|---|---|
| Frontend | Vercel | Project: `mdfit-frontend`, Team: **MD Fit** (Hobby) |
| Backend API | Railway | `https://amiable-peace-production-e382.up.railway.app` |
| Source code | GitHub | `Dr-Caban/MDfit` (monorepo: `mdfit-srq/`) |
| Media uploads | Cloudinary | Configured via env vars on Railway |
| Payments | Stripe | See `docs/stripe.md` |
| Domain | Vercel | `mymdfit.com` → Vercel project `mdfit-frontend` |

---

## GitHub

- **Repo:** [github.com/Dr-Caban/MDfit](https://github.com/Dr-Caban/MDfit)
- **Structure:**
  - `mdfit-srq/frontend/` — static site deployed to Vercel
  - `mdfit-srq/backend/` — Node/Express API deployed to Railway
  - `mdfit-srq/docs/` — documentation
- **Production branch:** `main`

## Vercel (Frontend)

- **Team:** MD Fit (Hobby plan)
- **Project:** `mdfit-frontend`
- **Root directory:** `mdfit-srq/frontend`
- **Dashboard:** [vercel.com](https://vercel.com) → MD Fit team → mdfit-frontend
- **Environment variables:**
  - `EDGE_SECRET` — shared secret the middleware sends to Railway so the API rejects direct access

The frontend is a static site with edge middleware (`middleware.js`) that:
1. Blocks non-US traffic
2. Blocks bots/scrapers
3. Proxies `/api/*` requests to Railway with the `EDGE_SECRET` header

Pushes to `main` auto-deploy.

## Railway (Backend API)

- **Public URL:** `https://amiable-peace-production-e382.up.railway.app`
- **Dashboard:** [railway.com](https://railway.com) → Dr. Caban's account
- **Environment variables required:**
  - `EDGE_SECRET` — must match Vercel's value
  - `JWT_SECRET` — signs auth tokens
  - `MONGODB_URI` — MongoDB Atlas connection string
  - `GOOGLE_CLIENT_ID` — `220848435517-22mrm92t01gkisnns8tu1t3e8np4km5j.apps.googleusercontent.com`
  - `STRIPE_SECRET_KEY` — Stripe restricted key (`rk_…`)
  - `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret (`whsec_…`)
  - `RESEND_API_KEY` — Resend email API key
  - `NOTIFY_EMAIL` — `jaredcaban0nopills@gmail.com`
  - `NOTIFY_FROM` — sender address for notifications
  - `CLOUDINARY_CLOUD_NAME` — Cloudinary cloud name
  - `CLOUDINARY_API_KEY` — Cloudinary API key
  - `CLOUDINARY_API_SECRET` — Cloudinary API secret

Pushes to `main` auto-deploy (if Railway is connected to the GitHub repo).

## Cloudinary (Media)

- **Used for:** Video and image uploads in the media library
- **Backend file:** `backend/lib/videos.js`
- **Dashboard:** [cloudinary.com/console](https://cloudinary.com/console)
- **Env vars:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (all on Railway)
- If not configured, upload endpoints return a 400 error explaining which vars are missing.

## Stripe (Payments)

Full setup instructions: `docs/stripe.md`

- **Webhook URL:** `https://amiable-peace-production-e382.up.railway.app/api/stripe/webhook`
- **Env vars:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (on Railway)

## Domain (mymdfit.com)

- DNS should point to Vercel (add in Vercel → Project → Settings → Domains)
- If migrating from another Vercel project, remove the domain there first
- SSL is automatic on Vercel

## Quick checklist for a new session

1. Confirm Railway is healthy: `curl https://amiable-peace-production-e382.up.railway.app/api/site`
2. Confirm Vercel is healthy: visit `mymdfit.com` (or the Vercel preview URL)
3. GitHub repo: `Dr-Caban/MDfit`
4. All secrets live in Railway and Vercel env vars — never in code
