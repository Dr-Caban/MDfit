# MD Fit — Physical Rehabilitation & Fitness

Website + booking platform for **MD Fit** (Dr. Jared Caban, MD, MSc, CEP), 3214 Clark Road, Sarasota, FL.

| Folder | What it is | Host |
|---|---|---|
| `frontend/` | Website (`/`), **booking site (`/book`)**, admin portal (`/admin`), cancel page (`/cancel`). Plain HTML/CSS/JS, no build step | Vercel |
| `backend/` | Node/Express API | Railway |

## Booking site: `mdfitsrq.com/book`
A page with nothing but booking on it, made to share:
- **Instagram bio**, **Facebook "Book Now" button**, text messages and email signatures.
- **Google Business Profile** → Edit profile → **Appointment links** → paste `https://mdfitsrq.com/book`. Google then shows a "Book" button on your Maps/search listing.
- Deep links open a specific type: `/book?type=eval`, `/book?type=session`, `/book?type=call` (short versions: `/evaluation`, `/call`).
- The admin dashboard shows the link with a **Copy** button.

Clients can optionally tap where it hurts and their pain level while booking, so it's on the appointment (and in your email) before they walk in.

## Cal.com booking (optional)
Use Cal.com as the booking engine and embed its calendar on `/book` and the homepage, in MD Fit colors.

1. **Railway variables:**
   - `CAL_API_KEY`: Cal.com → Settings → Developer → API keys → create. Only ever paste it into Railway.
   - `CAL_WEBHOOK_SECRET`: any long random string, e.g. `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.
2. **Cal.com webhook:** Settings → Developer → Webhooks → New. Subscriber URL `https://<your-railway-api>/api/cal/webhook`, Secret = `CAL_WEBHOOK_SECRET`, events **Booking created, Booking rescheduled, Booking cancelled**.
3. **Admin → Booking:** choose **Cal.com**, click **Test connection** (shows your username and event types), optionally list which event types to show and in what order, Save.

What you get:
- Clients book in Cal's calendar on your site; Cal handles confirmations, reminders, reschedules and calendar sync (Google/Outlook).
- Every Cal booking also lands in **MD Fit admin → Appointments** (tagged Cal.com) via the webhook, or with **Sync Cal bookings now**. Duplicate webhook deliveries are ignored, and forged ones are rejected by signature.
- Cancelling a Cal booking in MD Fit admin cancels it in Cal too, so Cal emails the client.
- The API key stays on the server. The site only receives your username and event-type names.
- If Cal's API is briefly down, the booking page keeps using the last good event list; if the calendar can't load, clients see a direct link and your phone number.
- Deep links work with Cal slugs (`/book?type=phone-consult`) and the short links `/evaluation` and `/call` pick the matching Cal event.

Switch back to **MD Fit built-in** any time in the same place.

## What it does

**For clients (website)**
- **Online booking:** live availability for Initial Evaluation / Rehab Session / Free Phone Consult, built from your real hours. No double-booking, minimum notice, holidays blocked. Confirmation screen with **Add to calendar (.ics)** and **Google Calendar**.
- **"Where does it hurt?"** quick start in the hero → **intake form** with body areas, pain level 0–10, how long, surgery status, goal, and how they heard about you.
- The MD Fit Method (Assess → Release → Correct → Strengthen), services, what we treat, programs, Dr. Jared, reviews with rating badge, small-group class booking, visit info, newsletter.
- Phone and mobile first: sticky Call / Book bar on phones, click-to-call everywhere.
- Local SEO: `LocalBusiness` structured data (address, phone, hours) so Google can show it in search and Maps.

**For you (admin at `/admin`)**
- **Dashboard:** today's appointments, the week ahead, new requests, class spots.
- **Appointments:** client details and notes, private session notes, mark completed / no-show / cancelled (cancelling reopens the slot). CSV export.
- **Hours:** weekly hours (split shifts OK), slot spacing, minimum notice, how far ahead people can book, closed dates, appointment types and lengths.
- **Leads:** every intake with body areas, pain level etc. as tags; status pipeline (new → contacted → booked → client); notes; CSV.
- **Classes / Bookings / Subscribers**, and **Settings** for every piece of text on the site (phone, hours, bio, photo, packages and prices, reviews, rating badge, socials).

**Email (optional):** with Resend set up, you get an email for every booking, cancellation and intake; clients get a confirmation with a one-click cancel link.

## Deploy

### 1. Backend → Railway
1. railway.com → **New Project → Deploy from GitHub repo** → this repo.
2. Service **Settings → Root Directory: `mdfit-srq/backend`**.
3. **Add a Volume** mounted at **`/data`** (otherwise bookings are lost on redeploy).
4. **Variables** (see `backend/.env.example`):

   | Variable | Value |
   |---|---|
   | `ADMIN_EMAIL` | admin login email |
   | `ADMIN_PASSWORD_HASH` | output of `npm run hash-password -- 'your password'` |
   | `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `ALLOWED_ORIGINS` | your site address(es), comma-separated, e.g. `https://mdfitsrq.com,https://mdfit-srq.vercel.app` |
   | `SITE_URL` | the main site address (for cancel links) |
   | `DATA_DIR` | `/data` |
   | `TZ_NAME` | `America/New_York` |
   | `NODE_ENV` | `production` |
   | `RESEND_API_KEY`, `NOTIFY_FROM`, `NOTIFY_EMAIL` | optional email, see below |
5. **Settings → Networking → Generate Domain**. That's your API address.

### 2. Frontend → Vercel
1. In `frontend/config.js` replace `https://YOUR-RAILWAY-APP.up.railway.app` with the Railway address and push.
2. vercel.com → **Add New → Project** → import this repo → **Root Directory: `mdfit-srq/frontend`**, Framework **Other** → Deploy.
3. To use **mdfitsrq.com**: Vercel → Project → Settings → Domains → add it and follow the DNS steps.
4. Log in at `/admin` and check **Settings** (add Dr. Jared's photo link and package prices) and **Hours**.

### 3. Email (optional, recommended)
1. resend.com → sign up → **Domains** → add `mdfitsrq.com` and add the DNS records it shows.
2. **API Keys** → create one → Railway `RESEND_API_KEY`.
3. Railway `NOTIFY_FROM` = `MD Fit <bookings@mdfitsrq.com>`, `NOTIFY_EMAIL` = where you want alerts.

Short links: `/book` booking site, `/evaluation` and `/call` → booking with that type picked, `/consult` → intake form, `/classes` → classes.

## Brand
Colors are tokens at the top of `frontend/styles.css` (`--ink` navy, `--accent` teal). Change them there to match an official palette. Logo: `frontend/assets/logo.svg`.

## API
Public: `GET /api/health`, `GET /api/site`, `GET /api/availability?type=eval&from=YYYY-MM-DD&days=7`, `POST /api/appointments`, `POST /api/appointments/:id/cancel`, `GET /api/schedule`, `POST /api/bookings`, `POST /api/bookings/:id/cancel`, `POST /api/leads`, `POST /api/subscribe`.

Admin (Bearer token from `POST /api/admin/login`; 12h sessions; 10 bad logins lock the IP for 15 min): `me`, `stats`, `settings` (GET/PUT), `appointments` (GET, PATCH `:id`), `appointments.csv`, `leads` (GET, PATCH/DELETE `:id`), `leads.csv`, `classes` (GET/POST, PUT/DELETE `:id`), `bookings` (GET, DELETE `:id`), `subscribers` (GET, DELETE `:email`), `subscribers.csv`, `activity`.

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
