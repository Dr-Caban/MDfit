# MDFIT SRQ

Website + API for **MDFIT SRQ**, personal training in Sarasota, FL.

| Folder | What it is | Host |
|---|---|---|
| `frontend/` | Website (`/`) and admin portal (`/admin`). Plain HTML/CSS/JS, no build step | Vercel |
| `backend/` | Node/Express API: consultation requests, class schedule + booking, newsletter, admin | Railway |

**Website:** programs, live class schedule with online booking (next 7 days, capacity-limited), packages, coach bio, testimonials, free-consultation form, newsletter sign-up. Content comes from the API and is edited in the admin portal.

**Admin (`/admin`):** dashboard, leads (status + notes, CSV), weekly classes (add, pause, change capacity, delete), bookings, subscribers (CSV), and settings (business info, socials, coach, packages, testimonials).

---

## Deploy

### 1. Backend → Railway
1. railway.com → **New Project → Deploy from GitHub repo** → this repo.
2. Service **Settings → Root Directory: `mdfit-srq/backend`**.
3. **Add a Volume** mounted at **`/data`** (otherwise leads and bookings are lost on redeploy).
4. **Variables** (see `backend/.env.example`):

   | Variable | Value |
   |---|---|
   | `ADMIN_EMAIL` | admin login email |
   | `ADMIN_PASSWORD_HASH` | output of `npm run hash-password -- 'your password'` |
   | `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `ALLOWED_ORIGINS` | your Vercel address, e.g. `https://mdfit-srq.vercel.app` |
   | `DATA_DIR` | `/data` |
   | `TZ_NAME` | `America/New_York` |
   | `NODE_ENV` | `production` |
5. **Settings → Networking → Generate Domain**. That's your API address.

### 2. Frontend → Vercel
1. In `frontend/config.js` replace `https://YOUR-RAILWAY-APP.up.railway.app` with the Railway address and push.
2. vercel.com → **Add New → Project** → import this repo → **Root Directory: `mdfit-srq/frontend`**, Framework **Other** → Deploy.
3. Put the Vercel address in Railway's `ALLOWED_ORIGINS`.
4. Log in at `/admin` → **Settings**: fill in phone, email, address, hours, socials, coach bio/photo, package prices, testimonials. **Classes**: replace the starter schedule with your real one.

Short links: `/book` → schedule, `/consult` → consultation form.

## API
Public: `GET /api/health`, `GET /api/site`, `GET /api/schedule?days=7`, `POST /api/leads`, `POST /api/bookings`, `POST /api/bookings/:id/cancel` (with the `cancelToken` returned on booking), `POST /api/subscribe`.

Admin (Bearer token from `POST /api/admin/login`; 12h sessions; 10 bad logins lock the IP for 15 min): `me`, `stats`, `settings` (GET/PUT), `leads` (GET, PATCH/DELETE `:id`), `leads.csv`, `classes` (GET/POST, PUT/DELETE `:id`), `bookings` (GET, DELETE `:id`), `subscribers` (GET, DELETE `:email`), `subscribers.csv`, `activity`.

Spam protection: hidden honeypot field on every form and 20 submissions/hour per IP.

## Local dev
```
cd mdfit-srq/backend && npm install
npm test
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD_HASH="$(npm run -s hash-password -- 'local-pass-123')" \
  SESSION_SECRET=$(node -e "console.log('x'.repeat(40))") ALLOWED_ORIGINS=http://localhost:8080 npm start   # :3000
cd mdfit-srq/frontend && python3 -m http.server 8080   # config.js uses localhost:3000 automatically
```
Locally the admin page is `http://localhost:8080/admin.html`; on Vercel it's `/admin`.
