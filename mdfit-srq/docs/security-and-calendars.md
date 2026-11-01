# Security and calendar sync

## How MD Fit is protected

| Layer | What it does |
|---|---|
| Edge guard (`frontend/middleware.js`, runs on Vercel before every request) | Only US visitors (and US territories) can load the site or the API. Scrapers, scripts and AI crawlers (GPTBot, ClaudeBot, CCBot, Bytespider and others) are refused. Search engines can read the public homepage only. |
| Locked API | The Railway API answers only requests that come through the edge guard, which adds a secret (`EDGE_SECRET`). Calling the Railway address directly, from abroad or from a script returns 403. Stripe and Cal.com webhooks are the only exceptions, and both are verified by their signatures. |
| Rate limits | Per visitor: 120 API requests per 10 seconds and 1,500 per 10 minutes. Logins lock after 10 wrong passwords in 15 minutes. Sign-ups and resets: 10 per hour. Public forms: 20 per hour. Messages: 40 per hour. |
| Passwords | Never stored. Each one is hashed with scrypt and a random salt. |
| Messages | Encrypted with AES-256-GCM before they're saved. |
| All stored data | Every data file on the server (clients, pain logs, workouts, vitals, messages, bookings) is encrypted at rest with AES-256-GCM using `DATA_ENC_KEY`. A copy of the disk or a backup can't be read without the key. |
| Browser protections | HTTPS forced (HSTS), no framing by other sites (stops clickjacking), strict referrer, locked-down camera/mic/location permissions, no search indexing of the app. |
| robots.txt | Tells AI crawlers to stay out, and keeps the app, admin and API out of search engines. |

**Keep `DATA_ENC_KEY` safe.** It's in Railway → digitalapple-backend → mdfit-api → Variables. Copy it into a password manager. If it's lost, the stored data can't be decrypted. Never change it without a migration.

**A note on "wrapping the site in Tauri":** Tauri packages a website as a desktop app. It doesn't add encryption. Everything between a visitor and MD Fit is already encrypted (HTTPS with HSTS), and the data is encrypted at rest. If you want a downloadable desktop app later, Tauri is a good way to make one.

## Google Calendar (two-way)

1. In Google Cloud Console, create a project, enable the **Google Calendar API**, then go to **IAM → Service accounts → Create**. Open the new account → **Keys → Add key → JSON** and download the file.
2. In Google Calendar, open your calendar's settings → **Share with specific people** → add the service account's email (it ends in `iam.gserviceaccount.com`) with **Make changes to events**.
3. In Railway (digitalapple-backend → mdfit-api → Variables), add:
   - `GOOGLE_SERVICE_ACCOUNT`: the whole JSON file, pasted as is
   - `GOOGLE_CALENDAR_ID`: your calendar's ID (your Gmail address for the main calendar)
4. Go to Admin → Booking → **Calendar sync** → **Test sync now**.

After that:
- Anything busy on your Google Calendar can't be booked on the site.
- Every website booking appears on your calendar as "MD Fit: Initial Evaluation · Pat D.". Only the visit type and first name with last initial are sent, never pain details.
- Cancelling a booking removes the event.

**HIPAA:** Google Calendar is covered only on Google Workspace with Google's Business Associate Agreement signed.

## SimplePractice

SimplePractice has no public API. Its supported way to share a calendar is the private calendar-sync link.

1. In SimplePractice: **Settings → Calendar → Calendar sync**. Turn it on and copy the subscribe link.
2. In MD Fit Admin → Booking → **Calendar sync**, paste the link and click **Save link**, then **Test sync now**.

MD Fit reads that feed every few minutes, and those times can't be booked on the site. Keep SimplePractice's default of hiding client names in the feed. The link is kept on the server, encrypted, and never shown to the public.

To get website bookings into SimplePractice too: SimplePractice can't import events. Turn on SimplePractice's own Google Calendar sync so both calendars show in one place, or book the client in SimplePractice from the confirmation email.
