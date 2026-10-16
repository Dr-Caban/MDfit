# Lone Soulja Podcast

Podcast site for **Lone Soulja** with Geno "Smurf" Collie, in Bahamian colours (aquamarine, gold, black).

| Folder | What it is | Host (free) |
|---|---|---|
| `frontend/` | Website + **Studio** (plain HTML/CSS/JS, no build) | Vercel |
| `backend/` | Small API: newsletter sign-ups + posting to Facebook | Railway |

## The Studio (`/studio`)
Private page (not linked, hidden from Google) for making branded content:

- **Quote cards:** pick a saved quote or type one. Choose the format (9:16 Reels/TikTok/Shorts, 4:5 feed, 1:1), theme (Midnight / Gold / Aqua) and typography (Bebas, Anton, Montserrat, Inter, Playfair). Export as PNG, or all 3 sizes at once.
- **Video clips:** upload a clip, then add the branded header, headline, progress bar and captions. Paste a transcript as **SRT/VTT** (exact timing) or **plain text** (auto-timed). Caption styles: **Pop** (3 words, current word highlighted), **Line**, **Boxed**. Captions can sit at the top, middle or bottom.
  - Export runs in the browser in real time (a 60s clip takes about 60s).
  - Recent Chrome or Safari saves **MP4** (best for TikTok/Reels). Other browsers save WebM.
- **Censor profanity** is on by default (f***, a**). It applies to cards, captions and the post caption.
- **Share / Download:** on a phone this opens the share sheet (Facebook, Instagram, TikTok…). On a computer it downloads the file.
- **Post to Facebook:** posts the card or video straight to the show's **Facebook Page**. You need the admin key to use it.

> Facebook only allows apps to post to **Pages**, not personal profiles. For Geno's own profile, use Share/Download.

## Edit content
Everything is in **`frontend/episodes.js`**: episodes, quotes, clips (TikTok/Shorts/Reels links), platform links, email, handle, and `apiUrl`.

## Deploy

### 1. Backend → Railway
1. railway.com → New Project → Deploy from GitHub repo → this repo.
2. Service **Settings → Root Directory: `backend`**.
3. **Variables:**
   - `ADMIN_KEY`: a long random password (this is your Studio admin key)
   - `ALLOWED_ORIGINS`: your Vercel URL, e.g. `https://lone-soulja.vercel.app`
   - `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`: see *Facebook setup* below
   - `DATA_DIR`: `/data`
4. **Add a Volume** mounted at `/data` so newsletter emails survive redeploys.
5. **Settings → Networking → Generate Domain.** Copy the URL.

Railway's free plan includes about $1/month of usage, which is enough for this small API. Check railway.com/pricing for the current terms.

### 2. Frontend → Vercel
1. In `frontend/episodes.js`, set `apiUrl` to the Railway URL (no trailing slash). Commit.
2. vercel.com → Add New Project → import this repo → **Root Directory: `frontend`**, Framework: **Other**. Deploy.
3. In `frontend/index.html`, change `og:image` to the full URL (`https://<your-site>.vercel.app/assets/og-image.png`) so Facebook link previews show the banner.

### Facebook setup (one time)
1. Create a Facebook **Page** for the show if there isn't one.
2. developers.facebook.com → Create App (type **Business**).
3. Graph API Explorer → choose the app. Request `pages_show_list`, `pages_read_engagement` and `pages_manage_posts`. Generate a token, then pick your Page to get a **Page access token**.
4. Make it long-lived with the Access Token Debugger → "Extend Access Token". Then get the Page token from `GET /me/accounts`; it won't expire.
5. Put the Page ID and Page token into Railway's Variables.

## Admin extras
- Download subscribers: `GET <railway-url>/api/subscribers.csv` with header `X-Admin-Key: <ADMIN_KEY>`.

## Local dev
```
cd backend && npm install && ADMIN_KEY=test npm start   # API on :3000
cd frontend && python3 -m http.server 8080             # site on :8080
cd backend && npm test                                 # API tests
```
