# Lone Soulja Podcast

Podcast site for **Lone Soulja** with Geno "Smurf" Collie, in Bahamian colours (aquamarine, gold, black).

| Folder | What it is | Host |
|---|---|---|
| `frontend/` | Website, **Admin** (`/admin`), **Studio** (`/studio`), Cash App link (`/cashapp`). Plain HTML/CSS/JS, no build step | Vercel |
| `backend/` | API: episodes, podcast RSS feed, settings, newsletter, login, Facebook posting | Railway |

Everything on the site (episodes, platform links, donation goal, quotes, clips) comes **live from the backend** and is managed in the admin portal. Nothing is hard-coded except two fallbacks in `frontend/config.js`: Geno's Cash App tag and his quotes, used only if the backend is unreachable.

---

## Deploy (one time)

### 1. Backend → Railway
1. railway.com → **New Project → Deploy from GitHub repo** → this repo.
2. Service **Settings → Root Directory: `backend`**.
3. **Add a Volume** mounted at **`/data`** so episodes, settings and sign-ups survive redeploys.
4. **Variables** (see `backend/.env.example`):

   | Variable | Value |
   |---|---|
   | `ADMIN_EMAIL` | the admin login email |
   | `ADMIN_PASSWORD_HASH` | output of `npm run hash-password -- 'the password'` (never the password itself) |
   | `SESSION_SECRET` | 64 random characters: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `SITE_URL` | your Vercel address, e.g. `https://lone-soulja.vercel.app` |
   | `ALLOWED_ORIGINS` | same Vercel address |
   | `DATA_DIR` | `/data` |
   | `NODE_ENV` | `production` |
   | `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN` | optional, see *Facebook* below |

5. **Settings → Networking → Generate Domain**. That's your API address.

### 2. Frontend → Vercel
1. In `frontend/config.js` set `apiUrl` to the Railway address (no trailing slash) and push.
2. vercel.com → **Add New → Project** → import this repo → **Root Directory: `frontend`**, Framework **Other** → Deploy.
3. Put the Vercel address into Railway's `SITE_URL` and `ALLOWED_ORIGINS` (step 1.4) if you didn't know it yet.
4. In `frontend/index.html`, change `og:image` to the full URL (`https://<your-site>.vercel.app/assets/og-image.png`) so Facebook link previews show the banner.

---

## Admin portal (`/admin`)
Log in with the admin email and password. Sessions last 12 hours, and 10 wrong attempts lock that IP out for 15 minutes.

- **Dashboard:** subscribers, episodes, Facebook posts, studio fund, your **RSS feed link**, and a checklist of anything still missing before submitting to podcast apps.
- **Publish:** title, description, the **direct link to the MP3**, duration, artwork. Pick where it goes:
  - **Website:** appears on the site immediately.
  - **Podcast apps (Spotify, Apple Podcasts, Amazon Music, YouTube Music):** added to your RSS feed. These apps don't take uploads by API; they read your feed. **Submit the feed link once** to each (links on the Dashboard), and every episode after that appears automatically within a few hours.
  - **Facebook Page:** posts an announcement linking to the episode.

  The server checks the audio link is real audio and reads its exact size before publishing.
- **Episodes:** edit or unpublish (removes it from the site and the feed).
- **Settings:** show info (the contact email is required by Spotify/Apple to verify ownership), platform and social links, studio fund goal / raised, Cash App tag, quick-give amounts, PayPal / Stripe / GoFundMe links, quotes, clips.
- **Subscribers:** search, remove, download CSV.
- **Activity:** logins, sign-ups, publishes, edits, Facebook posts and failures.

**Where to host MP3s:** any host that gives a direct `https://…/file.mp3` link, e.g. archive.org (free), Cloudflare R2 or Amazon S3. Spotify's limit is about 200 MB per episode.

## Donations: Cash App
- Quick-give buttons ($1, $5, $10 by default; editable in Settings) and a custom amount open Cash App to `$genocollie` with the amount filled in.
- Cash App's minimum payment is **$1**, so smaller amounts are rejected with a clear message.
- **Share link** for bios and posts: `https://<your-site>/cashapp` (or `/cashapp/5` to pre-fill $5). `/donate` jumps to the donation section.

## Studio (`/studio`)
Branded quote cards (9:16 / 4:5 / 1:1, PNG or PDF), captioned vertical videos, PDF quote book, and **Post to Facebook Page** (uses the same admin login).

## Facebook (optional)
Facebook only lets apps post to **Pages**, not personal profiles.
1. Create a Facebook Page for the show.
2. developers.facebook.com → Create App (Business) → Graph API Explorer. Request `pages_show_list`, `pages_read_engagement` and `pages_manage_posts`, and get a Page access token.
3. Extend it (Access Token Debugger), then `GET /me/accounts` for a long-lived Page token.
4. Put `FB_PAGE_ID` and `FB_PAGE_ACCESS_TOKEN` into Railway.

## API
Public: `GET /api/health`, `GET /api/site`, `GET /rss.xml`, `POST /api/subscribe`, `GET /api/facebook/status`.
Admin (Bearer token from `POST /api/admin/login`): `/api/admin/me`, `stats`, `settings` (GET/PUT), `episodes` (GET/POST, PUT/DELETE `:id`), `subscribers` (GET, DELETE `:email`), `subscribers.csv`, `activity`, `POST /api/facebook/post`.

## Logging
One JSON line per event in **Railway → Deployments → Logs**: every request (method, path, status, ms; query strings never logged), activity (emails masked like `f**@example.com`), failed logins, server errors. Passwords, tokens and captions are never logged. `LOG_LEVEL` = `debug` | `info` | `warn` | `error`.

## Testing (never in production)
```
cd backend
npm install
npm test                     # 70 tests: every endpoint, login, feed XML, publishing, logging, scripts
npm run seed                 # sample subscribers/settings for local testing (no fake episodes)
npm run seed -- --reset
npm run hash-password        # prompts for a password, prints ADMIN_PASSWORD_HASH
```
- Tests use temporary folders, a fake Facebook and a fake audio host, so they never touch real data or post anything.
- Tests and the seed script **refuse to run** with `NODE_ENV=production`, in Railway's production environment, or with `DATA_DIR=/data`.
- Sample emails use only reserved `example.com/.net/.org` domains, and the admin portal shows a banner when sample data is loaded.
- **GitHub Actions** runs the tests on every push. Railway only runs `npm start`.

## Local dev
```
cd backend && npm install && npm run seed
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD_HASH="$(npm run -s hash-password -- 'local-pass-123')" \
  SESSION_SECRET=$(node -e "console.log('x'.repeat(40))") ALLOWED_ORIGINS=http://localhost:8080 npm start   # :3000
cd frontend && python3 -m http.server 8080      # set apiUrl in config.js to http://localhost:3000
```
