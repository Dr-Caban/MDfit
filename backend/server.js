// Lone Soulja API: newsletter sign-ups and posting to a Facebook Page.
// Deploy on Railway with Root Directory = backend.
const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const env = (k, d = "") => (process.env[k] || d).trim();

const ADMIN_KEY = env("ADMIN_KEY");
const FB_PAGE_ID = env("FB_PAGE_ID");
const FB_TOKEN = env("FB_PAGE_ACCESS_TOKEN");
const FB_VERSION = env("FB_GRAPH_VERSION", "v26.0");
const FB_GRAPH_URL = env("FB_GRAPH_URL", "https://graph.facebook.com");
const FB_VIDEO_URL = env("FB_VIDEO_URL", "https://graph-video.facebook.com");
const DATA_DIR = env("DATA_DIR", path.join(__dirname, "data"));
const ORIGINS = env("ALLOWED_ORIGINS", "*").split(",").map((s) => s.trim()).filter(Boolean);
const MAX_UPLOAD = "100mb";

const SUBS_FILE = path.join(DATA_DIR, "subscribers.json");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

// ---- Basic headers + CORS (frontend lives on Vercel)
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  const origin = req.get("origin");
  if (origin && (ORIGINS.includes("*") || ORIGINS.includes(origin))) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ---- Helpers
function isAdmin(req) {
  const key = req.get("x-admin-key") || "";
  if (!ADMIN_KEY || !key) return false;
  const a = Buffer.from(key), b = Buffer.from(ADMIN_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) return res.status(503).json({ error: "ADMIN_KEY is not set on the server." });
  if (!isAdmin(req)) return res.status(401).json({ error: "Wrong admin key." });
  next();
}

// Simple in-memory rate limit: max hits per IP per window.
function rateLimit(max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const rec = hits.get(req.ip) || { n: 0, reset: now + windowMs };
    if (now > rec.reset) { rec.n = 0; rec.reset = now + windowMs; }
    rec.n++;
    hits.set(req.ip, rec);
    if (rec.n > max) return res.status(429).json({ error: "Too many requests. Try again later." });
    next();
  };
}

function readSubs() {
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, "utf8")); } catch { return []; }
}
function writeSubs(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = SUBS_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, SUBS_FILE);
}

// ---- Routes
app.get("/", (req, res) => res.json({ name: "Lone Soulja API", ok: true }));
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/subscribe", rateLimit(10, 60 * 60 * 1000), express.json({ limit: "2kb" }), (req, res) => {
  const email = String((req.body && req.body.email) || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: "Please enter a valid email." });
  const subs = readSubs();
  if (!subs.some((s) => s.email === email)) {
    subs.push({ email, date: new Date().toISOString() });
    writeSubs(subs);
  }
  res.json({ ok: true });
});

// Admin: download subscribers as CSV
app.get("/api/subscribers.csv", requireAdmin, (req, res) => {
  const rows = ["email,date", ...readSubs().map((s) => `${s.email},${s.date}`)];
  res.type("text/csv").attachment("subscribers.csv").send(rows.join("\n"));
});

app.get("/api/facebook/status", (req, res) => {
  res.json({ configured: Boolean(FB_PAGE_ID && FB_TOKEN), adminKeySet: Boolean(ADMIN_KEY) });
});

// Admin: post an image (PNG/JPG) or video (MP4/WebM) to the Facebook Page.
// Body = raw file bytes, Content-Type = file type, ?caption=...
app.post(
  "/api/facebook/post",
  requireAdmin,
  express.raw({ type: ["image/*", "video/*"], limit: MAX_UPLOAD }),
  async (req, res) => {
    if (!FB_PAGE_ID || !FB_TOKEN) return res.status(503).json({ error: "Facebook Page is not connected on the server." });
    const type = (req.get("content-type") || "").split(";")[0];
    const isVideo = type.startsWith("video/");
    if (!Buffer.isBuffer(req.body) || !req.body.length || !(isVideo || type.startsWith("image/"))) {
      return res.status(400).json({ error: "Send an image or video file." });
    }
    const caption = String(req.query.caption || "").slice(0, 5000);
    const ext = isVideo ? (type.includes("mp4") ? "mp4" : "webm") : (type.includes("png") ? "png" : "jpg");

    const form = new FormData();
    form.append("access_token", FB_TOKEN);
    form.append(isVideo ? "description" : "message", caption);
    form.append("source", new Blob([req.body], { type }), `lone-soulja.${ext}`);

    const base = isVideo ? FB_VIDEO_URL : FB_GRAPH_URL;
    const url = `${base}/${FB_VERSION}/${encodeURIComponent(FB_PAGE_ID)}/${isVideo ? "videos" : "photos"}`;
    try {
      const fb = await fetch(url, { method: "POST", body: form });
      const data = await fb.json().catch(() => ({}));
      if (!fb.ok || data.error) {
        return res.status(502).json({ error: (data.error && data.error.message) || `Facebook error ${fb.status}` });
      }
      res.json({ ok: true, id: data.post_id || data.id });
    } catch (e) {
      res.status(502).json({ error: "Could not reach Facebook." });
    }
  }
);

app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: status === 413 ? "File too large (max 100 MB)." : status < 500 ? err.message : "Server error" });
});

if (require.main === module) {
  const port = Number(env("PORT", "3000"));
  app.listen(port, () => console.log(`Lone Soulja API listening on ${port}`));
}

module.exports = app;
