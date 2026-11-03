# MD Fit: Full-Stack Blueprint for the iOS & Android Apps

**Last updated:** November 3, 2026 · Web app live at `mymdfit.com/account` · Branch `claude/lone-soulja-podcast-site-2ii8fj`

This is the complete picture of the MD Fit app as it runs today on the web (`mymdfit.com/account`), written so a native iOS and Android app can be built on the **same backend** with feature parity. Nothing in the backend needs to be rebuilt; the native apps are new clients of the existing API.

- Detailed request/response shapes: [`ios-api.md`](ios-api.md) and [`openapi.yaml`](openapi.yaml) (import into Postman or generate Swift/Kotlin models).
- Payments: [`stripe.md`](stripe.md). Security and calendars: [`security-and-calendars.md`](security-and-calendars.md). Privacy: [`hipaa-and-telehealth.md`](hipaa-and-telehealth.md).

---

## 1. Architecture

```
iOS app ─┐
Android ─┼──► mymdfit.com (Vercel edge) ──► /api/* proxied with secret header ──► Railway API (Node/Express 5)
Web app ─┘        │                                                                  │
                  └─ static: HTML/CSS/JS, /data/catalog.json, images                   └─ JSON file store on a Railway volume
                                                                                          (AES-256-GCM encrypted at rest)
Videos: Google Drive (direct MP4 stream)      Email: Resend      Payments: Stripe      Booking engine: built-in or Cal.com
Realtime: Socket.IO (namespaces /member, /admin, /public)
```

| Layer | Tech | Host | Notes |
|---|---|---|---|
| Web frontend | Plain HTML/CSS/JS, no framework, no build step | Vercel | Auto-deploys from the working branch. PWA (manifest + service worker). |
| Edge guard | Vercel Routing Middleware (`frontend/middleware.js`) | Vercel | US-only, blocks bots, proxies `/api/*` to Railway with a secret header. |
| API | Node 20+, Express 5, Socket.IO, Stripe SDK | Railway | Same branch auto-deploys. ~27 MB RAM, 2–15 ms responses. |
| Data | JSON documents on a Railway volume (`DATA_DIR`) | Railway | Message/intake/feedback bodies encrypted separately. |
| Video | Google Drive file IDs | Google Drive | `https://drive.usercontent.google.com/download?id=<ID>&export=download` streams MP4 with range requests. |

---

## 2. Rules every native client must follow

1. **Base URL:** `https://mymdfit.com` for everything (API is `https://mymdfit.com/api/...`). The Railway address refuses direct calls.
2. **User agent (critical on Android):** the edge guard blocks generic HTTP-library agents, including **`okhttp`** (Android's and React Native's default), `axios`, `node-fetch`, `curl`. Always send a custom one, e.g. `MDFit-Android/1.0 (Linux; Android 14)` and `MDFit-iOS/1.0 CFNetwork Darwin`. Without this every request returns 403.
3. **US only:** requests from outside the US/territories get 403. Test devices abroad or on non-US VPNs will fail.
4. **Auth:** `Authorization: Bearer <token>` on every `/api/me/*` call. Tokens last 30 days. Store in **Keychain** (iOS) / **EncryptedSharedPreferences or Keystore** (Android). On any `401`, clear the token and show sign-in.
5. **Errors:** non-2xx returns `{ "error": "Human-readable message" }`. Show it as-is; it's written for clients.
6. **Dates:** `YYYY-MM-DD` in the clinic time zone `America/New_York`; times `HH:MM` 24-hour; timestamps ISO-8601 UTC.
7. **Launch check:** `GET /api/app/config` → `{ apiVersion, minIosBuild, timeZone, features }`. If the build is below the minimum, show "please update". (Add `MIN_ANDROID_BUILD` alongside `MIN_IOS_BUILD` when Android ships.)
8. **Never put secrets in the app.** The only public key the app may hold is the Stripe publishable key, fetched from the API.

---

## 3. Design system

| Token | Value | Use |
|---|---|---|
| Navy | `#0A1A2E` (also `#10233b`, `#1d3352`) | Headers, tab bar, dark cards, primary buttons |
| Background | `#F6F4EE` | App background (warm off-white) |
| Card | `#FFFFFF`, alt `#F3EFE6`, border `#e4ded1` | Cards and inputs |
| Accent blue | `#7AAFD7` (text `#2F6E9E`, soft `#EAF3FA`) | Buttons, links, highlights |
| Gold | `#C8A763` (celebration gold `#e8c25e`) | Labels, rewards, Olympic League, milestones |
| Text | `#424244`, muted `#6b6a6e` | Body copy |
| Fonts | Montserrat (UI), Libre Baskerville (display numbers/headings) | |

Cards have 14–22 px radius. The tab bar is navy with the active tab in accent blue. Assets: `frontend/assets/` (logo, app icons 192/512, pain charts).

---

## 4. Navigation

Bottom tab bar: **Home · Workout · Videos · Pain · Progress · Profile · More**.
"More" opens: Programs, Learn (lectures & live Q&A), Premium, Messages, Tips.

Web routes are hash-based (`/account#progress`, `#pain/muscle/<id>`). Mirror them as native deep links: `mdfit://progress`, `https://mymdfit.com/account#messages` (Universal Links / App Links).

---

## 5. Features, screen by screen

### 5.1 Sign-in & accounts
- Email + password (8+ chars, scrypt-hashed server-side), Google sign-in (`POST /api/clients/google`).
- **Passwords via emailed 6-digit codes (Resend only):** `POST /api/clients/forgot` `{ identifier }` (account email) → `POST /api/clients/verify-code` `{ identifier, code }` → `POST /api/clients/reset` `{ token, password }`. Signed in: `POST /api/me/password/code` emails a code; `PUT /api/me/password` accepts `{ current, password }` or `{ code, password }`. Google sign-ups (`client.hasPassword === false`) set their first password with a code. Codes: 10 min, 5 tries, 6 requests/hour.
- **Referral:** signup accepts `referralCode`. Share link is `https://mymdfit.com/login?ref=CODE&signup`, which opens the signup tab prefilled. The referrer gets 1 free month of credit.
- Changing the password signs out all other devices.
- **Required for iOS:** Apple requires **Sign in with Apple** when any other social login is offered. Add `POST /api/clients/apple` (verify Apple identity token, return the same `{ token, expiresAt, client }`).

### 5.2 Home
- Header: logo + **bell** (notification center with red count badge).
- "Welcome back <name>", **Lv / XP chip** (taps to Progress).
- **Day streak** card with Mon–Sun dots; Best streak / Workouts / Hours tiles.
- **Today's workout** (generated daily from preferences, seeded per user per day) with one-tap **Start Workout** and "Change workout".
- **Quick actions:** Generate Workout, Pain Tool, Video Library (count), Book a Visit.
- **Upcoming events**, **Recent activity**, **Get the app** card (web only; hide in native).

### 5.3 Workout generator & player
- Choose goal (5 goals), location (home/gym), level, length → warm-up, circuit × rounds, cool-down built from the exercise catalog (`frontend/app/generator.js`, prescriptions in `PRESCRIBE`). Shuffle regenerates.
- **Player:** auto-plays each exercise video in sequence, loops for the set, counts down rest between exercises/rounds, warm-up once → circuit rounds → cool-down. Optional Bluetooth heart-rate strap. On finish: logs the workout (`POST /api/me/workouts`), shows streak/minutes/workouts and "How hard was that?" (RPE).
- Programs with a fixed `circuit` (e.g. Mobility Ladder) skip the random warm-up/cool-down.
- Save to **My Programs** (`POST /api/me/programs`); free tier has a generation allowance (`/api/me/access`, `POST /api/me/generations`).

### 5.4 Video library
- 155 exercises from `/data/catalog.json` (version check: `/data/catalog-version.json`; cache on disk and re-download only on change).
- Search, category and body-area filters; favorites (`PUT/DELETE /api/me/favorites/:id`).
- Playback: stream the Drive MP4 URL above with a native player (AVPlayer / ExoPlayer).
- **Preloading (web, replicate natively):** cards on screen fetch video metadata 3 at a time; touching a card starts buffering the opening seconds; up to 8 warmed videos are kept in memory; skipped in data-saver/2G. The Drive web player is the fallback if the MP4 fails. Natively: prefetch the first few seconds of visible items (AVAssetResourceLoader / ExoPlayer CacheDataSource).

### 5.5 Pain tool
- Front/back body map → tap a region → pain patterns → **starts a relief video track immediately** (no intermediate dialog).
- Muscle reports (`#pain/muscle/<id>`) with referred-pain explanations, Dr. Jared's guides, relief videos, booking CTA.
- Pain log 0–10 per area with optional note (`POST /api/me/pain`, `GET /api/me/pain`, delete own entries). Chart on Progress.
- Data sources: `painmap.js`, `painmuscles.js`, `painpatterns.js`, `paintracks.js`, `musclereports.js` (bundle these as JSON in the app or fetch from the site).

### 5.6 Progress
- **Calendar** of the month with dots: workout (blue), visit (navy), pain log (gold); tap a day for details.
- **Today check-in** (casual wording, not clinical): "Weigh-in" with −/+ 0.5 lb stepper prefilled from the last value, "How'd you sleep?" chips ≤5h/6h/7h/8h/9h+, **Done**. Collapses to "✓ Nice, you're logged for today" with an Edit link. `POST /api/me/vitals` (`weight`, `sleep`; optional `restingHr`, `hrv`, `vo2max` shown only when a watch/ring is connected). One record per day, merged.
- **Performance:** body-weight tile with sparkline and change; **Compare workouts** (two sessions side by side: time, HR, HRV, VO2 max, effort, calories, lift weights).
- **Pain tracker** chart by area.
- **Leaderboard** (see §6) and **Badges** grid.
- Native bonus: read weight/sleep/HR/HRV/VO2 from **HealthKit** / **Health Connect** and send via `POST /api/me/vitals/batch`.

### 5.7 Messages (Messenger with Dr. Jared)
- One private thread per member. `GET /api/me/messages`, `POST /api/me/messages` `{ body }` (≤2000 chars, 40/hour), `POST /api/me/messages/read`, `GET /api/me/messages/unread-count`.
- **Emoji reactions:** 👍 ❤️ 😂 🙏 💪 😮, one per side per message, tap again to remove. `POST /api/me/messages/:id/react` `{ emoji }`. Each message returns `reactions: { client?, doctor? }`.
- "Seen" receipts, day separators, emergency disclaimer.
- Bodies are encrypted at rest; email notifications never contain message content.
- Realtime events on the `/member` Socket.IO namespace: `new_message`, `message_reaction`.

### 5.8 Learn, Programs, Premium, Tips
- `GET /api/content` → programs (multi-day, some with fixed circuits), lectures (e.g. "Hormones, anti-cortisol & longevity", 58 min), live Q&A, tips, membership tiers. Content is versioned server-side (`contentVersion`, currently 5).
- Membership tiers and protocol purchases via Stripe Checkout (`/api/me/checkout/*`, billing portal `/api/me/billing-portal`). **See §8 on app-store payment rules.**

### 5.9 Profile
- Appointments (cancel, add to calendar), visit history, name/phone, password.
- **Refer a friend:** code, Copy, **Share link** (native share sheet with the full signup URL).
- Leaderboard visibility toggle lives on the Leaderboard card.
- Links: website, call 941-313-0562, Privacy, Terms, Log out.

### 5.10 Booking
- Web `/book` page (built-in engine or Cal.com). Types: Initial Evaluation, Rehab Session, medical massage 60/90, free phone consult. Hours 8 AM–4 PM, 24 h notice.
- API: `GET /api/availability`, `POST /api/appointments`, cancel via `/api/me/appointments/:id/cancel`. Intake form `POST /api/appointments/:id/intake` (encrypted).
- Native: either call the API directly or open `/book` in an in-app browser (SFSafariViewController / Custom Tabs) with the user signed in.

---

## 6. Gamification (XP, badges, leagues)

XP is **recomputed from each member's real history** on every `GET /api/me/rewards`, so it can't be lost or faked by editing a counter. Logic: `backend/lib/rewards.js`.

### XP table
| Source | XP | Limit |
|---|---|---|
| Workout | 20 + minutes/2 (20–50) | — |
| Streak bonus (first workout of a streak day) | 2 × streak day, max +20 | — |
| Completed visit with Dr. Jared | +50 | — |
| Badge unlocked (milestone) | +25 | per badge |
| Pain log | +5 | first 3 a day |
| Daily check-in | +5 per reading | max +10/day |
| Book a visit | +15 | 2/day (server-side) |
| Watch a lecture | +10 | 3/day |
| Save a program | +5 | 3/day |
| Share referral link | +5 | 1/day |
| Update profile | +5 | 1/day |
| Message Dr. Jared | +3 | 3/day |
| Watch an exercise video | +2 | 10/day |
| Generate a workout | +2 | 3/day |
| Favorite a video | +2 | 5/day |
| React to a message | +1 | 3/day |

Client-reported actions go to `POST /api/me/xp` `{ kind, ref }` with `kind` ∈ `video, lecture, message, reaction, favorite, program, generate, share, profile`. The same `ref` on the same day only counts once. Call it, then refresh `/api/me/rewards`.

### Levels
Level *n* starts at `50·n·(n−1)` XP (0, 100, 300, 600, 1000, 1500…). Titles: Starter, Mover, Builder, Strong, Athlete, Performer, Elite, Champion, Legend. Daily goal: 30 XP.

### Badges (14)
First Rep · Ten Strong · Half Century · Century Club · On a Roll (3-day streak) · Week Warrior (7) · Unbreakable (30) · Three-a-Week · Ten Hours In · Explorer (all 5 goals) · Check-in Habit (7 days) · Listening to Your Body (5 pain logs) · Feeling Better (pain down 3+) · Team MD Fit (first visit).

### Leagues & leaderboard
- **Pro League** (levels 1–4) and **Olympic League** (level 5+, i.e. 1,000 XP). Cutoff: `OLYMPIC_LEVEL` in `backend/lib/clients.js`.
- `GET /api/me/leaderboard?period=week|all&league=pro|olympic` → `{ league, myLeague, olympicLevel, period, total, top[10], me: { rank, score }, hidden }`. Weekly resets Monday (clinic time). Cached 60 s server-side.
- Shows first name + last initial, level and XP only. `PUT /api/me/leaderboard/visibility` `{ hidden }`.
- **Seeded competitors:** each league is topped up to 9 entries with generated competitors whose weekly XP climbs through the week; they drop out one-for-one as real members join. They are **not labeled**. Turn off with Railway variable `LEADERBOARD_PACERS=off` (do this before charging for memberships).

### Celebrations (replicate natively)
1. Any XP gain → gold toast "+N XP" (and "Level up!", "Badge unlocked", "Daily goal reached!").
2. **Milestone screen:** full-screen navy with rotating gold rays; a gold coin with the badge icon (or level number) spins in (3 turns, ~1.5 s), glows, then a highlighted "+25 XP" pill pops in; **Continue**. Haptic: light-medium-heavy pattern.
3. **Leaderboard pop-up** after every level-up and every 3rd badge: league name, "You're #3 this week", top 5 with the member's row outlined in gold.
4. Detect "new" badges/levels by comparing with the last seen set stored on device.

---

## 7. Notifications

**In-app (built):**
- Bottom pop-ups (max 3, auto-dismiss 8 s, swipe to dismiss) for: badge unlocked / level up (View → Progress), new message from Dr. Jared (Read → Messages), visit today/tomorrow (Details → Profile).
- **Bell** notification center: history of the last 25 pop-ups plus live items (upcoming visit, plan updated by Dr. Jared, streak at risk → Start). Red count of unseen items; opening clears it.

**Push (not built yet — needed for native):**
- Add `POST /api/me/devices` `{ platform: "ios"|"android", token }` and send via **APNs** and **FCM** for: new message, visit reminder (24 h / 2 h), streak at risk (evening), badge/level, weekly league result.
- Push text must never include health details (same rule as email).

---

## 8. Payments & app-store rules

- Web uses **Stripe Checkout** for memberships (Gold/Silver/Bronze/Platinum, 12/24-month plans with 5%/10% off) and protocols. Webhook `POST /api/stripe/webhook` grants access.
- **Apple/Google rules:** digital content consumed in the app (memberships unlocking videos/programs) generally must use **In-App Purchase / Google Play Billing**. In-person services (visits, massage) can stay on Stripe. Options: (a) IAP for memberships plus server receipt validation that sets the same membership record, or (b) "reader app" approach with no in-app purchase buttons and sign-up on the web. Decide before submission.
- Keys live only in Railway variables (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`).

---

## 9. API index (all routes)

Public (`/api`): `GET health, app/config, site, content, schedule, availability, reviews, feedback, feedback/reward/:code` · `POST clients/signup, clients/login, clients/google, clients/forgot, clients/verify-code, clients/reset, appointments, appointments/:id/cancel, appointments/:id/intake, bookings, bookings/:id/cancel, leads, subscribe, feedback, hit` · webhooks `stripe/webhook`, `cal/webhook`.

Member (`/api/me`, Bearer token):
| Area | Routes |
|---|---|
| Account | `GET /` · `PUT /` · `PUT /password` · `GET /access` · `GET /referral` · `GET /accountability` |
| Workouts | `GET /stats` · `GET /workouts` · `POST /workouts` · `PATCH /workouts/:id` · `POST /generations` |
| Library | `GET /library` · `PUT/DELETE /favorites/:id` · `POST /programs` · `DELETE /programs/:id` · `GET /content` |
| Health logs | `GET/POST /pain` · `DELETE /pain/:id` · `GET/POST /vitals` · `POST /vitals/batch` |
| Rewards | `GET /rewards` · `POST /xp` · `GET /leaderboard` · `PUT /leaderboard/visibility` |
| Messages | `GET /messages` · `GET /messages/unread-count` · `POST /messages` · `POST /messages/read` · `POST /messages/:id/react` |
| Visits | `GET /appointments` · `POST /appointments/:id/cancel` · `GET/POST /meetings` |
| Billing | `POST /checkout/membership` · `POST /checkout/protocol` · `POST /checkout/service` · `GET /checkout/session/:id` · `POST /billing-portal` · `GET /payments` · `POST /membership/request` |
| Feedback | `GET/POST /feedback-reports` |

Admin (`/api/admin`, separate token + optional MFA): clients, plans, memberships, messages (+reactions), appointments, classes, bookings, leads, subscribers, content, settings, analytics, audit log, calendar sync, payments. Admin stays web-only.

---

## 10. Data model (per member, simplified)

```jsonc
client: {
  id, email, name, phone, passwordHash, createdAt, lastLoginAt,
  plan: { guides[], exercises[{name, detail}], notes, updatedAt },   // written by Dr. Jared
  membership: { tier, since, until },
  workouts: [{ id, date, title, goal, minutes, seconds, key, lifts[], hrAvg, hrMax, hrv, vo2max, rpe, calories, source, completedAt }],
  painLog:  [{ id, date, area, level, note }],
  vitals:   [{ date, weight, sleep, restingHr, hrv, vo2max, source }],   // one per day
  favorites: [videoId], programs: [{ id, name, workout }],
  xpLog:    [{ date, kind, ref }],                                       // action XP
  hideRank: bool
}
message: { id, clientId, from: "client"|"doctor", body (encrypted), at, readAt, reactions: { client?, doctor? } }
appointment: { id, email, type, date, time, minutes, status: booked|completed|cancelled, intake (encrypted) }
```

---

## 11. Realtime (Socket.IO)

The web client connects Socket.IO to the site origin with **path `/ws`**, namespace **`/member`**, auth `{ token }`, transports websocket then polling. Events: `new_message`, `message_reaction`. On an event, refetch the relevant endpoint.

**Caveat:** the Vercel edge guard only proxies `/api/*`, and Vercel can't relay WebSockets, so in production this connection most likely doesn't reach Railway today. The web app silently falls back to polling (`/api/me/messages/unread-count` every 60 s). For native apps, either expose a dedicated realtime hostname on Railway (e.g. `rt.mymdfit.com`, protected by the same token auth) or rely on **push notifications + polling on foreground**. Push is the recommended path.

---

## 12. Recommended native stack

| Option | When |
|---|---|
| **Swift/SwiftUI + Kotlin/Jetpack Compose** | Best feel, HealthKit/Health Connect and haptics are first-class. Two codebases. |
| **React Native (Expo)** or **Flutter** | One codebase for both. Set a custom user agent (RN uses okhttp on Android, see §2). |

Must-haves for parity: secure token storage, native video player with background prefetch of the next exercise, Socket.IO client, local cache of `catalog.json`, share sheet, haptics, deep links, push (APNs/FCM), Sign in with Apple, HealthKit/Health Connect import.

Store requirements: privacy nutrition labels (health & fitness data, contact info), account deletion in-app (add `DELETE /api/me` — admin delete exists today), medical disclaimer ("educational, not a substitute for an in-person evaluation; in an emergency call 911").

---

## 13. Environment variables (names only — values live in Railway/Vercel, never in code)

`SESSION_SECRET, DATA_DIR, DATA_ENC_KEY, MESSAGE_ENC_KEY, INTAKE_ENC_KEY, FEEDBACK_ENC_KEY, AUDIT_SIGNING_KEY, EDGE_SECRET, ALLOWED_ORIGINS, SITE_URL, BOT_FILTER, TZ_NAME, ADMIN_EMAIL, ADMIN_PASSWORD_HASH, ADMIN_MFA, RESEND_API_KEY, NOTIFY_FROM, NOTIFY_EMAIL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PUBLISHABLE_KEY, CAL_API_KEY, CAL_WEBHOOK_SECRET, GOOGLE_CLIENT_ID, GOOGLE_PLACES_API_KEY, GOOGLE_PLACE_ID, GOOGLE_SERVICE_ACCOUNT, GOOGLE_CALENDAR_ID, SIMPLEPRACTICE_ICS_URL, MIN_IOS_BUILD, LEADERBOARD_PACERS, LOG_LEVEL, PORT`

---

## 14. Backend additions needed for the native apps

| Item | Why |
|---|---|
| `POST /api/clients/apple` | Sign in with Apple (App Store requirement with Google sign-in). |
| `POST /api/me/devices` + APNs/FCM sender | Push notifications. |
| `DELETE /api/me` | In-app account deletion (App Store & Play requirement). |
| `MIN_ANDROID_BUILD` in `/api/app/config` | Force-update for Android. |
| IAP / Play Billing receipt validation → membership | If memberships are sold inside the apps. |
| Allow the app's user agents in `middleware.js` | Confirm they aren't matched by `BAD_UA`. |

## 15. Deploy & release notes

- Both Vercel (web) and Railway (API) auto-deploy from the working branch.
- After editing web CSS/JS run `node scripts/version-assets.js` (cache-busts files and bumps the service-worker cache so web users get updates automatically without losing their login).
- Backend tests: `cd backend && npm test`. Two tests (membership and Stripe checkout) currently fail independently of the app features above and should be fixed before launch.

---

## 16. Recent changes (web app, Nov 2–3, 2026)

| Change | Where |
|---|---|
| Milestone celebration (spinning gold coin, +25 XP per badge) and Duolingo-style leaderboard pop-up after level-ups and every 3rd badge | §6 |
| Pro League / Olympic League (level 5+) with weekly and all-time rankings, hide-me toggle, unlabeled seeded competitors (`LEADERBOARD_PACERS`) | §6 |
| XP for every action (`POST /api/me/xp`) plus daily check-ins, booking, and the Check-in Habit badge | §6 |
| Bell notification center and bottom pop-ups for badges, messages and visits | §7 |
| Emoji reactions in Messenger (member and admin, realtime events) | §5.7 |
| Casual daily check-in card on Progress (weigh-in stepper, sleep chips) replacing the clinical readings form | §5.6 |
| Install card on Home and Profile; guided iPhone "Add to Home Screen" overlay | web only |
| Auto cache clear per deploy (service-worker cache stamped by `scripts/version-assets.js`); logins kept | §15 |
| Referral share link opens signup with the code prefilled | §5.1 |
| Mobility Ladder plays its fixed circuit (no random warm-up); `contentVersion` 5 | §5.3, §5.8 |
| Lecture "Hormones, anti-cortisol & longevity" is 58 min | §5.8 |
| Video library preloading (native MP4 playback, warm on view/touch, Drive fallback) | §5.4 |
| Startup crash fixed (install guide markup placed before scripts) | — |
