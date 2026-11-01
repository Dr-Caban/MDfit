# MD Fit iOS API (draft v1)

The iOS app uses the **same backend as the website**. Every feature in the web app (`/account`) is available over JSON, so the iPhone app and the website always show the same account, workouts, rewards, pain log, programs and membership.

- **Base URL:** `https://mdfit-api-production.up.railway.app`
- **Catalog (static):** `https://mdfit-srq.vercel.app/data/catalog.json`
- **Machine-readable spec:** [`openapi.yaml`](openapi.yaml). Import it into Postman, or generate Swift models with `swift-openapi-generator`.

---

## 1. Conventions

| | |
|---|---|
| Format | JSON in, JSON out. Send `Content-Type: application/json`. |
| Auth | `Authorization: Bearer <token>` on every `/api/me/*` call. |
| Dates | `YYYY-MM-DD` in the clinic time zone (`America/New_York`, also returned by `/api/app/config`). Times are `HH:MM`, 24-hour. Timestamps are ISO-8601 UTC. |
| Errors | Non-2xx responses return `{ "error": "Human-readable message" }`. Show the message as is; it's written for clients. |
| Status codes | `400` bad input · `401` not signed in or token expired · `403` needs a membership · `404` not found · `409` conflict (slot taken, monthly limit reached) · `429` too many attempts |
| Rate limits | Sign-up and password reset: 10 an hour per IP. Login locks for 15 minutes after 10 failures. Public forms: 20 an hour per IP. |

### Launch check
`GET /api/app/config` → `{ apiVersion, minIosBuild, timeZone, features }`
If the app's build number is below `minIosBuild`, show a "please update" screen. Set `MIN_IOS_BUILD` in Railway to force an update. `features` tells the app which optional features are switched on (payments, Google Calendar, and so on).

---

## 2. Authentication

| Call | Body | Returns |
|---|---|---|
| `POST /api/clients/signup` | `{ name, email, phone?, password }` (password 8+ chars) | `{ token, expiresAt, client }` |
| `POST /api/clients/login` | `{ email, password }` | `{ token, expiresAt, client }` |
| `POST /api/clients/forgot` | `{ email }` | `{ ok }`. Emails a reset link. |
| `POST /api/clients/reset` | `{ token, password }` | `{ token, expiresAt, client }` |
| `GET /api/me` | | `{ client }` |
| `PUT /api/me` | `{ name?, phone? }` | `{ client }` |
| `PUT /api/me/password` | `{ current, password }` | `{ token, expiresAt, client }` |

- Tokens last **30 days**. Store the token in the **Keychain**, never in UserDefaults.
- On any `401`, clear the token and show the sign-in screen.
- Changing the password signs out every other device: their tokens stop working.
- **Sign in with Apple (next step):** add `POST /api/clients/apple` that verifies Apple's identity token and returns the same session shape. Apple requires this if any other social login is offered.

`client`:
```json
{ "id": "a1b2c3", "email": "pat@example.com", "name": "Pat Doe", "phone": "941-555-0100",
  "createdAt": "2026-11-01T14:00:00.000Z",
  "plan": { "guides": ["rotator-cuff"], "exercises": [{ "name": "Wall slides", "detail": "2 x 10 daily" }], "notes": "", "updatedAt": null },
  "membership": { "tier": "premium", "since": "2026-11-01", "until": "2026-12-31" } }
```

---

## 3. Catalog: exercises, muscles, pain tracks (static JSON)

`GET https://mdfit-srq.vercel.app/data/catalog-version.json` → `{ "version": "af801cbe1448" }`

Download `catalog.json` (about 450 KB) only when the version changes, then cache it on disk. It contains:

| Key | What |
|---|---|
| `exercises[]` | 153 exercises: `id` (Drive file id), `name`, `region`, `cat`, `level` 1-9, `loc`, `category` (Strength training / Stretching / Rehabilitation / Specialty movements / Mobility), `joint`, `muscle`, and `video.{mp4, preview, thumbnail}` |
| `library` | Category, joint and muscle lists, plus which exercise ids fit each location (home, gym, outdoor, office) |
| `generator` | Goals, locations, levels, lengths, rest options, add-ons and defaults for the workout generator |
| `pain.muscles` | 67 muscles: `{ name, does, refers, worse[], videos[], guide? }` |
| `pain.spots` / `pain.maps` | Pain areas and tap points on the body figure (`[x, y, deep]` in pixels of `bodyImage`) |
| `reports` | Full muscle reports: anatomy, symptoms, self-tests, red flags, a 3-phase protocol with videos and doses |
| `tracks[]` | 26 pain tracks from Dr. Jared's Drive: `{ id, title, region, images[], pts[] (muscle ids), note, levels[{ title, videos[{ id, name }] }] }`. `id: null` means the video is coming soon. |

Regenerate the catalog with `node scripts/export-catalog.js` after editing any exercise, muscle or track file.

### Video playback
Use **AVPlayer** with `video.mp4`. It streams the MP4 straight from Google Drive with range requests, so it autoplays, loops and fires an end event, exactly like the web player. If playback fails, fall back to a `WKWebView` on `video.preview`.

### Workout generator
The generator is deterministic: the same inputs and `seed` always give the same workout. To keep iOS and web identical, run the site's `/app/generator.js` together with the exercises in **JavaScriptCore** (`JSContext`) and call `MDFitGen.generate({...})`, `MDFitGen.swap(...)` and `MDFitGen.stepSecs(...)`. Porting it to Swift also works, but every change would then have to be made twice.

---

## 4. Workouts, tracking and comparisons

| Call | Body / query | Returns |
|---|---|---|
| `POST /api/me/workouts` | `{ title, goal, minutes, exercises, key?, seconds?, hrAvg?, hrMax?, hrv?, vo2max?, rpe?, calories?, source?, lifts?[{ name, weight?, reps? }] }` | `201 { workout, stats }` |
| `PATCH /api/me/workouts/:id` | Any of the metric fields | The updated workout |
| `GET /api/me/workouts` | | Every workout, oldest first (for the calendar and comparisons) |
| `GET /api/me/stats` | | `{ streak, bestStreak, workouts, hours, week[7], todayIndex, recent[10] }` |
| `GET /api/me/rewards` | | `{ xp, level, title, levelStart, nextLevel, todayXp, dailyGoal, week[7], badges[] }` |
| `GET /api/me/participation` | | `{ score, earnedPct, creditPct, attendance, attendTarget, homePerWeek, homeTarget, thisWeek, leftThisWeek, tiers }` |

- `key` groups repeat sessions so they can be compared. Program days use `prog-<programId>-d<day>`; saved programs use `program-<id>`.
- Ranges: `hrAvg` 30–230, `hrMax` 30–240, `hrv` 5–300 ms, `vo2max` 10–95, `rpe` 1–10, `seconds` up to 18000.
- **Comparing:** pick two workouts with the same `key` and show `seconds`, heart rate, effort and each lift's weight side by side, as the web Progress tab does.

### Daily vitals (Apple Health / HealthKit)
| Call | Body | Returns |
|---|---|---|
| `GET /api/me/vitals` | | `[{ date, restingHr?, hrv?, vo2max?, weight?, sleep?, source }]` |
| `POST /api/me/vitals` | `{ date?, restingHr?, hrv?, vo2max?, weight?, sleep?, source? }` | All vitals |
| `POST /api/me/vitals/batch` | `{ source: "Apple Health", readings: [{ date, ... }] }` (1–400 days) | `{ saved, total }` |

Same-day readings merge, so re-sending a day is safe. **HealthKit mapping** (one row per day):

| Field | HealthKit type | How |
|---|---|---|
| `restingHr` | `HKQuantityTypeIdentifier.restingHeartRate` | Daily average, count/min |
| `hrv` | `.heartRateVariabilitySDNN` | Daily average, ms |
| `vo2max` | `.vo2Max` | Latest that day, ml/kg/min |
| `weight` | `.bodyMass` | Latest that day, lb |
| `sleep` | `HKCategoryTypeIdentifier.sleepAnalysis` | Hours asleep the night before |
| Workout `hrAvg` / `hrMax` | `.heartRate` samples between workout start and end | Average and max, then `PATCH` the workout |

Ask for read permission only. Sync on launch and with `HKObserverQuery` plus background delivery, sending the last 7 days each time (and up to 400 days on first sync).

**Live heart rate during a workout:** Apple Watch heart rate arrives through HealthKit (`HKAnchoredObjectQuery`). For chest straps, use **CoreBluetooth** with service `0x180D` and characteristic `0x2A37`; the first byte's bit 0 says whether the reading is 8-bit or 16-bit. The web app already does this with Web Bluetooth.

---

## 5. Pain log, library, appointments

| Call | Body | Returns |
|---|---|---|
| `GET /api/me/pain` | | `[{ id, date, area, level 0-10, note, createdAt }]` |
| `POST /api/me/pain` | `{ area, level, note?, date? }`. `area` is one of: Neck, Shoulder, Upper back, Lower back, Hip, Knee, Ankle / foot, Elbow / wrist / hand, Other | `201` entry |
| `DELETE /api/me/pain/:id` | | `{ ok }` |
| `GET /api/me/library` | | `{ favorites: [exerciseId], programs: [{ id, name, workout, createdAt }] }` |
| `PUT` / `DELETE /api/me/favorites/:exerciseId` | | Library |
| `POST /api/me/programs` | `{ name, workout: { title, goal, goalId, location, level, levelLabel, rounds, restEx, restRound, minutes, warmup[{id, sets}], circuit[...], cooldown[...] } }` | Library |
| `DELETE /api/me/programs/:id` | | Library |
| `GET /api/me/appointments` | | `{ upcoming[], past[] }` |
| `POST /api/me/appointments/:id/cancel` | | `{ ok }` |
| `GET /api/availability?type=eval&from=YYYY-MM-DD&days=14` | | `{ timeZone, type, lastDate, days[{ date, slots["09:00", ...] }] }` |
| `POST /api/appointments` | `{ typeId, date, time, name, email, phone, notes?, areas?[], painLevel?, rewardCode? }` | `201 { appointment, message }` |

Appointment types and prices come from `GET /api/site` (`settings.appointmentTypes`, `settings.services`, `settings.plans`).

---

## 6. Member content, membership and 1-on-1 sessions

| Call | Body | Returns |
|---|---|---|
| `GET /api/me/content` | | `{ access: "free"\|"member"\|"premium", membership, programs[], lectures[], live, tiers[], recommendations[], categories[], topics[] }` |
| `GET /api/content` | | Same without sign-in. Members-only links are blank. |
| `POST /api/me/membership/request` | `{ tier, note? }` | `201`. Dr. Jared confirms and turns it on (until payments are live). |
| `GET /api/me/meetings` | | `{ meetings[], allowance, minutes, usedThisMonth }` |
| `POST /api/me/meetings` | `{ topic, times }` | `201` meeting · `403` without Premium · `409` when the month's sessions are used up |

- `tracks`: pain tracks edited in Admin. **An empty list means "use the tracks in `catalog.json`".** When it isn't empty, it replaces them.
- Locked items have `locked: true`, with `url`, `joinUrl` and recording links blanked. Show a lock and link to the membership screen.
- **Programs:** each day is a generator session: `generate({ goal, location, level, length, rounds?, restEx?, restRound?, seed: program.seed + (day.seedOffset || 0) + dayIndex * 101 })`. Save the finished workout with `key: "prog-<id>-d<dayIndex>"`.
- **Lectures:** YouTube, Vimeo and Drive links play in a `WKWebView` embed. `downloadUrl`, when set, can be saved for offline viewing.
- **Live Q&A:** `live.joinUrl` opens in Google Meet, Zoom or YouTube (universal links). Add it to the calendar with EventKit using `live.date`, `live.time` and `live.minutes`.

---

## 7. Reviews

| Call | Body | Returns |
|---|---|---|
| `POST /api/feedback` | `{ name, email, rating 1-5, text, publish }` | `201 { rewardCode, bookUrl }` |
| `GET /api/feedback` | | Approved public reviews, average and count |
| `GET /api/feedback/reward/:code` | | `{ valid, used, type }` |

Every review earns a free 30-minute plan review, whatever the rating. Book it with `POST /api/appointments` using `typeId: "plan-review"` and the `rewardCode`. **App Store rule:** never offer a reward for an App Store rating. The in-app review prompt must be Apple's own `SKStoreReviewController` (`requestReview`), with no incentive attached.

---

## 8. Not built yet (needs accounts or decisions)

| Feature | What's needed | API plan |
|---|---|---|
| Payments | A Stripe account | `POST /api/me/checkout` → Stripe Checkout or PaymentSheet; a webhook sets `membership.until`. Memberships bought inside the iOS app must use **Apple In-App Purchase**. 1-on-1 clinical services and in-person protocols can use Stripe. |
| Push notifications | An Apple Developer account and an APNs key | `POST /api/me/devices { apnsToken }`. Reminders: streak at risk, live Q&A starting, session scheduled. |
| Google Calendar | A Google Cloud OAuth client | Two-way sync of the clinic calendar on the server. The app keeps using `/api/availability`. |
| SimplePractice | SimplePractice has no public API | Keep SimplePractice as the clinical record. MD Fit only shows availability and sends booking requests. |
| Sign in with Apple | An Apple Developer account | `POST /api/clients/apple` |

### Privacy and HIPAA
Pain logs, vitals and session notes are health information. The API runs on Railway, which does **not** sign a HIPAA Business Associate Agreement. Before the clinic stores protected health information for patients, move the API and data to a host that signs a BAA (for example AWS, Google Cloud or Aptible), and keep clinical records in SimplePractice. Until then, describe the app as fitness and wellness tracking, and don't collect diagnoses or treatment notes in it.
