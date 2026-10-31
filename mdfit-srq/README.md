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

## Client accounts & dashboard
- **`/login`**: clients create an account or log in (email + password, scrypt-hashed). Forgot password emails a reset link when email is set up; otherwise admin → Clients → **Copy password-reset link** and text it to them. 10 wrong passwords lock that device out for 15 minutes.
- **`/account`** is the MD Fit app (installable to the home screen; dark theme with bottom tabs, matching the iOS app):
  - **Home**: day streak with week dots, best streak / workouts / hours, today's workout with one-tap start, Dr. Jared's plan, upcoming visits and classes (one-tap class reserve), recent activity, notifications.
  - **Generate**: goal, location, difficulty and length carousels → a warm-up / main / cool-down session built from the 153-video Drive library (`app/generator.js`, sets and reps in `PRESCRIBE`). The workout player steps through each video with a timer and logs the session.
  - **Videos**: the full exercise library with search, category and body-area filters (`app/exercises.js`, Drive previews).
  - **Pain Tool**: front/back areas → likely referral sources, Dr. Jared's guides, gentle relief videos, a quick pain log and booking.
  - **Profile**: appointments (cancel, add to calendar), visit history, pain tracker chart, workout history, profile, password, install.
- Appointments match by email, so bookings made before signing up appear automatically. Logged-in clients get their details pre-filled on `/book`.
- **Admin → Clients**: every account with next visit and latest pain entry; open one to see appointments and the pain log, write their plan (notes, exercises, guides), copy a reset link or delete the account.
- Sessions last 30 days; changing or resetting a password signs out other devices. Client tokens can't open admin routes and vice versa.

## Pain map ("Find the source")
Homepage section built from Dr. Jared's own materials (MDFIT IMAGES Drive folder): his front/back body chart with 16 tappable points, each listing the muscles that commonly refer pain there and linking to his referred-pain guides (iliopsoas, lateral hip, quads, calf, rotator cuff, scalenes, posterior neck). Images are in `frontend/assets/pain/` (converted to WebP); hotspot text and guide links live in `frontend/painmap.js`.

## Google reviews
With `GOOGLE_PLACES_API_KEY` set on Railway (Places API (New) enabled on that key), the site shows MD Fit's live Google rating, review count and up to 5 recent Google reviews with names, photos and a "See all on Google" link. They refresh every 6 hours; the last good copy is kept if Google is unreachable, and the hand-entered testimonials in Settings are shown only when Google isn't available. The place is found by name and address; set `GOOGLE_PLACE_ID` to pin it.

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
Brand taken from mdfitsrq.com: navy `#0A1A2E`, cream `#F6F4EE`, orange `#FF7A00`, gold `#C8A763`, Libre Baskerville headings and Montserrat body text. Colors are tokens at the top of `frontend/styles.css`. Logo: `frontend/assets/logo.webp` (their caduceus + barbell mark), favicon `assets/icon-64.png`.

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
