// Lone Soulja API: newsletter, site content, admin portal and Facebook Page posting.
// Deploy on Railway with Root Directory = backend.
const express = require("express");
const crypto = require("crypto");
const path = require("path");
const { logger, mask, requestLogger } = require("./lib/logger");
const { createStore } = require("./lib/store");

const env = (k, d = "") => (process.env[k] || d).trim();

function loadConfig() {
  return {
    adminKey: env("ADMIN_KEY"),
    fbPageId: env("FB_PAGE_ID"),
    fbToken: env("FB_PAGE_ACCESS_TOKEN"),
    fbVersion: env("FB_GRAPH_VERSION", "v26.0"),
    fbGraphUrl: env("FB_GRAPH_URL", "https://graph.facebook.com"),
    fbVideoUrl: env("FB_VIDEO_URL", "https://graph-video.facebook.com"),
    dataDir: env("DATA_DIR", path.join(__dirname, "data")),
    origins: env("ALLOWED_ORIGINS", "*").split(",").map((s) => s.trim()).filter(Boolean),
    production: env("NODE_ENV") === "production" || env("RAILWAY_ENVIRONMENT_NAME") === "production",
    maxUpload: "100mb"
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ACTIVITY_MAX = 500;
const MAX_QUOTES = 200;

function createApp(cfg = loadConfig()) {
  const store = createStore(cfg.dataDir);
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  // ---- Activity log (shown in the admin portal) + structured log line
  function activity(type, detail = {}) {
    const list = store.read("activity", []);
    list.unshift({ time: new Date().toISOString(), type, ...detail });
    store.write("activity", list.slice(0, ACTIVITY_MAX));
    logger.info("activity", { type, ...detail, email: detail.email ? mask(detail.email) : undefined });
  }

  // ---- Headers, CORS (frontend lives on Vercel), request log
  app.use(requestLogger);
  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    const origin = req.get("origin");
    if (origin && (cfg.origins.includes("*") || cfg.origins.includes(origin))) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Vary", "Origin");
      res.set("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
      res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  // ---- Rate limiting (in memory, per IP)
  function rateLimit(max, windowMs, { failuresOnly = false } = {}) {
    const hits = new Map();
    const bump = (ip) => {
      const now = Date.now();
      const rec = hits.get(ip) || { n: 0, reset: now + windowMs };
      if (now > rec.reset) { rec.n = 0; rec.reset = now + windowMs; }
      rec.n++; hits.set(ip, rec);
      return rec.n;
    };
    const blocked = (ip) => { const r = hits.get(ip); return r && Date.now() <= r.reset && r.n >= max; };
    const mw = (req, res, next) => {
      if (failuresOnly) return blocked(req.ip) ? res.status(429).json({ error: "Too many attempts. Try again later." }) : next();
      if (bump(req.ip) > max) return res.status(429).json({ error: "Too many requests. Try again later." });
      next();
    };
    mw.fail = bump;
    return mw;
  }

  // ---- Admin auth: X-Admin-Key header, constant-time compare, lockout after repeated failures
  const adminLimiter = rateLimit(10, 15 * 60 * 1000, { failuresOnly: true });
  function requireAdmin(req, res, next) {
    adminLimiter(req, res, () => {
      if (!cfg.adminKey) return res.status(503).json({ error: "ADMIN_KEY is not set on the server." });
      const key = Buffer.from(req.get("x-admin-key") || "");
      const real = Buffer.from(cfg.adminKey);
      if (key.length === real.length && crypto.timingSafeEqual(key, real)) return next();
      adminLimiter.fail(req.ip);
      logger.warn("admin auth failed", { path: req.path });
      res.status(401).json({ error: "Wrong admin key." });
    });
  }

  const readContent = () => store.read("content", {});

  // ================= Public =================
  app.get("/", (req, res) => res.json({ name: "Lone Soulja API", ok: true }));
  app.get("/api/health", (req, res) => res.json({ ok: true }));

  // Content the admin portal manages (overrides frontend defaults)
  app.get("/api/content", (req, res) => {
    const c = readContent();
    const out = {};
    if (c.donate) out.donate = c.donate;
    if (Array.isArray(c.quotes) && c.quotes.length) out.quotes = c.quotes;
    res.json(out);
  });

  app.post("/api/subscribe", rateLimit(10, 60 * 60 * 1000), express.json({ limit: "2kb" }), (req, res) => {
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: "Please enter a valid email." });
    const subs = store.read("subscribers", []);
    if (!subs.some((s) => s.email === email)) {
      subs.push({ email, date: new Date().toISOString() });
      store.write("subscribers", subs);
      activity("subscribe", { email });
    }
    res.json({ ok: true });
  });

  app.get("/api/facebook/status", (req, res) => {
    res.json({ configured: Boolean(cfg.fbPageId && cfg.fbToken), adminKeySet: Boolean(cfg.adminKey) });
  });

  // ================= Admin =================
  app.get("/api/admin/me", requireAdmin, (req, res) => res.json({ ok: true, production: cfg.production }));

  app.get("/api/admin/stats", requireAdmin, (req, res) => {
    const subs = store.read("subscribers", []);
    const acts = store.read("activity", []);
    const c = readContent();
    const weekAgo = Date.now() - 7 * 864e5;
    const posts = acts.filter((a) => a.type === "facebook_post");
    res.json({
      subscribers: subs.length,
      subscribersLast7Days: subs.filter((s) => Date.parse(s.date) >= weekAgo).length,
      facebookPosts: posts.length,
      lastFacebookPost: posts[0] ? posts[0].time : null,
      donate: c.donate || { goal: 0, raised: 0 },
      quotes: Array.isArray(c.quotes) ? c.quotes.length : 0,
      seeded: Boolean(c.meta && c.meta.seeded),
      facebookConfigured: Boolean(cfg.fbPageId && cfg.fbToken)
    });
  });

  app.get("/api/admin/subscribers", requireAdmin, (req, res) => {
    const subs = store.read("subscribers", []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    res.json({ subscribers: subs });
  });

  app.delete("/api/admin/subscribers/:email", requireAdmin, (req, res) => {
    const email = String(req.params.email).toLowerCase();
    const subs = store.read("subscribers", []);
    const left = subs.filter((s) => s.email !== email);
    if (left.length === subs.length) return res.status(404).json({ error: "Subscriber not found." });
    store.write("subscribers", left);
    activity("unsubscribe", { email, by: "admin" });
    res.json({ ok: true });
  });

  // CSV (cells that could run as spreadsheet formulas are escaped)
  const csvCell = (v) => { const s = String(v); return /^[=+\-@]/.test(s) ? "'" + s : s; };
  app.get("/api/subscribers.csv", requireAdmin, (req, res) => {
    const rows = ["email,date", ...store.read("subscribers", []).map((s) => `${csvCell(s.email)},${csvCell(s.date)}`)];
    res.type("text/csv").attachment("subscribers.csv").send(rows.join("\n"));
  });

  app.get("/api/admin/content", requireAdmin, (req, res) => res.json(readContent()));

  app.put("/api/admin/content", requireAdmin, express.json({ limit: "200kb" }), (req, res) => {
    const body = req.body || {};
    const c = readContent();
    const changed = [];
    if (body.donate !== undefined) {
      const d = body.donate;
      const num = (v) => (typeof v === "number" || (typeof v === "string" && v.trim() !== "") ? Number(v) : NaN);
      const goal = d && typeof d === "object" ? num(d.goal) : NaN, raised = d && typeof d === "object" ? num(d.raised) : NaN;
      if (!Number.isFinite(goal) || !Number.isFinite(raised) || goal < 0 || raised < 0 || goal > 1e9 || raised > 1e9) {
        return res.status(400).json({ error: "Goal and raised must be numbers of 0 or more." });
      }
      c.donate = { goal: Math.round(goal), raised: Math.round(raised) };
      changed.push("donate");
    }
    if (body.quotes !== undefined) {
      if (!Array.isArray(body.quotes)) return res.status(400).json({ error: "Quotes must be a list." });
      const quotes = body.quotes.map((q) => String(q).trim()).filter(Boolean);
      if (quotes.length > MAX_QUOTES || quotes.some((q) => q.length > 600)) {
        return res.status(400).json({ error: `Max ${MAX_QUOTES} quotes, 600 characters each.` });
      }
      c.quotes = quotes;
      changed.push("quotes");
    }
    if (!changed.length) return res.status(400).json({ error: "Nothing to update." });
    store.write("content", c);
    activity("content_update", { fields: changed.join(",") });
    res.json({ ok: true, content: c });
  });

  app.get("/api/admin/activity", requireAdmin, (req, res) => {
    const limit = Math.max(1, Math.min(ACTIVITY_MAX, Number(req.query.limit) || 100));
    res.json({ activity: store.read("activity", []).slice(0, limit) });
  });

  // Post an image (PNG/JPG) or video (MP4/WebM) to the Facebook Page.
  // Body = raw file bytes, Content-Type = file type, ?caption=...
  app.post("/api/facebook/post", requireAdmin, express.raw({ type: ["image/*", "video/*"], limit: cfg.maxUpload || "100mb" }), async (req, res) => {
    if (!cfg.fbPageId || !cfg.fbToken) return res.status(503).json({ error: "Facebook Page is not connected on the server." });
    const type = (req.get("content-type") || "").split(";")[0];
    const isVideo = type.startsWith("video/");
    if (!Buffer.isBuffer(req.body) || !req.body.length || !(isVideo || type.startsWith("image/"))) {
      return res.status(400).json({ error: "Send an image or video file." });
    }
    const caption = String(req.query.caption || "").slice(0, 5000);
    const ext = isVideo ? (type.includes("mp4") ? "mp4" : "webm") : (type.includes("png") ? "png" : "jpg");

    const form = new FormData();
    form.append("access_token", cfg.fbToken);
    form.append(isVideo ? "description" : "message", caption);
    form.append("source", new Blob([req.body], { type }), `lone-soulja.${ext}`);

    const base = isVideo ? cfg.fbVideoUrl : cfg.fbGraphUrl;
    const url = `${base}/${cfg.fbVersion}/${encodeURIComponent(cfg.fbPageId)}/${isVideo ? "videos" : "photos"}`;
    const kind = isVideo ? "video" : "image";
    try {
      const fb = await fetch(url, { method: "POST", body: form });
      const data = await fb.json().catch(() => ({}));
      if (!fb.ok || data.error) {
        const error = (data.error && data.error.message) || `Facebook error ${fb.status}`;
        activity("facebook_post_failed", { kind, error });
        return res.status(502).json({ error });
      }
      const id = data.post_id || data.id;
      activity("facebook_post", { kind, id, bytes: req.body.length });
      res.json({ ok: true, id });
    } catch (e) {
      activity("facebook_post_failed", { kind, error: "Could not reach Facebook" });
      res.status(502).json({ error: "Could not reach Facebook." });
    }
  });

  app.use((req, res) => res.status(404).json({ error: "Not found" }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) logger.error("unhandled error", { path: req.path, error: err.message });
    res.status(status).json({ error: status === 413 ? "File too large." : status < 500 ? "Bad request." : "Server error" });
  });

  return app;
}

if (require.main === module) {
  const cfg = loadConfig();
  if (!cfg.adminKey) logger.warn("ADMIN_KEY is not set: admin portal and Facebook posting are disabled");
  else if (cfg.adminKey.length < 16) logger.warn("ADMIN_KEY is short: use at least 16 random characters");
  const content = createStore(cfg.dataDir).read("content", {});
  if (cfg.production && content.meta && content.meta.seeded) logger.error("SEED DATA FOUND IN PRODUCTION DATA_DIR: wipe it");
  const port = Number(env("PORT", "3000"));
  createApp(cfg).listen(port, () => logger.info("server started", { port, production: cfg.production, facebook: Boolean(cfg.fbPageId && cfg.fbToken) }));
}

module.exports = { createApp, loadConfig };
