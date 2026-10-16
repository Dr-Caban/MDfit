// Lone Soulja API: site content, episodes + podcast RSS feed, newsletter, admin portal, Facebook Page posting.
// Deploy on Railway with Root Directory = backend.
const express = require("express");
const crypto = require("crypto");
const path = require("path");
const { logger, mask, requestLogger } = require("./lib/logger");
const { createStore } = require("./lib/store");
const { verifyPassword, isValidHash, signToken, verifyToken } = require("./lib/auth");
const { defaultSettings, mergeSettings, episodeInput, ValidationError, EMAIL_RE } = require("./lib/validate");
const { probe } = require("./lib/probe");
const { buildFeed, feedIssues } = require("./lib/rss");

const env = (k, d = "") => (process.env[k] || d).trim();

function loadConfig() {
  const production = env("NODE_ENV") === "production" || env("RAILWAY_ENVIRONMENT_NAME") === "production";
  return {
    adminEmail: env("ADMIN_EMAIL").toLowerCase(),
    adminPasswordHash: env("ADMIN_PASSWORD_HASH"),
    sessionSecret: env("SESSION_SECRET"),
    siteUrl: env("SITE_URL").replace(/\/+$/, ""),
    fbPageId: env("FB_PAGE_ID"),
    fbToken: env("FB_PAGE_ACCESS_TOKEN"),
    fbVersion: env("FB_GRAPH_VERSION", "v26.0"),
    fbGraphUrl: env("FB_GRAPH_URL", "https://graph.facebook.com"),
    fbVideoUrl: env("FB_VIDEO_URL", "https://graph-video.facebook.com"),
    dataDir: env("DATA_DIR", path.join(__dirname, "data")),
    origins: env("ALLOWED_ORIGINS", "*").split(",").map((s) => s.trim()).filter(Boolean),
    production,
    allowHttpMedia: !production,
    maxUpload: "100mb"
  };
}

const ACTIVITY_MAX = 500;
const SESSION_HOURS = 12;

function createApp(cfg = loadConfig()) {
  const store = createStore(cfg.dataDir);
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  const authReady = Boolean(cfg.adminEmail && isValidHash(cfg.adminPasswordHash) && cfg.sessionSecret.length >= 32);
  const fbReady = () => Boolean(cfg.fbPageId && cfg.fbToken);
  const settings = () => {
    const d = defaultSettings(), s = store.read("settings", {});
    return { ...d, ...s, show: { ...d.show, ...s.show }, links: { ...d.links, ...s.links }, donate: { ...d.donate, ...s.donate } };
  };
  const episodes = () => store.read("episodes", []);
  const publicSettings = () => { const { meta, ...s } = settings(); return s; };

  function activity(type, detail = {}) {
    const list = store.read("activity", []);
    list.unshift({ time: new Date().toISOString(), type, ...detail });
    store.write("activity", list.slice(0, ACTIVITY_MAX));
    logger.info("activity", { type, ...detail, email: detail.email ? mask(detail.email) : undefined });
  }

  // ---- Headers, CORS, request log
  app.use(requestLogger);
  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    const origin = req.get("origin");
    if (origin && (cfg.origins.includes("*") || cfg.origins.includes(origin))) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Vary", "Origin");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  // ---- Rate limiting (in memory, per IP)
  function limiter(max, windowMs) {
    const hits = new Map();
    const get = (ip) => {
      const now = Date.now();
      let r = hits.get(ip);
      if (!r || now > r.reset) { r = { n: 0, reset: now + windowMs }; hits.set(ip, r); }
      return r;
    };
    return {
      hit: (ip) => ++get(ip).n,
      blocked: (ip) => get(ip).n >= max,
      reset: (ip) => hits.delete(ip),
      mw: (req, res, next) => (get(req.ip).n++ >= max ? res.status(429).json({ error: "Too many requests. Try again later." }) : next())
    };
  }
  const loginFails = limiter(10, 15 * 60 * 1000);

  // ---- Auth: "Authorization: Bearer <token>" from /api/admin/login
  const NOT_SET_UP = "Admin login isn't set up on the server (ADMIN_EMAIL, ADMIN_PASSWORD_HASH, SESSION_SECRET).";
  function requireAdmin(req, res, next) {
    if (!authReady) return res.status(503).json({ error: NOT_SET_UP });
    const m = (req.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
    const payload = m && verifyToken(m[1], cfg.sessionSecret);
    if (!payload || payload.sub !== cfg.adminEmail) return res.status(401).json({ error: "Please log in again." });
    req.admin = payload.sub;
    next();
  }

  const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const feedUrlFor = (req) => `${req.protocol}://${req.get("host")}/rss.xml`;

  // ================= Public =================
  app.get("/", (req, res) => res.json({ name: "Lone Soulja API", ok: true }));
  app.get("/api/health", (req, res) => res.json({ ok: true }));

  // Everything the website needs in one call
  app.get("/api/site", (req, res) => {
    const eps = episodes().filter((e) => e.platforms.includes("website"))
      .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
      .map(({ id, number, season, title, description, audioUrl, duration, explicit, imageUrl, publishedAt }) =>
        ({ id, number, season, title, description, audioUrl, duration, explicit, imageUrl, publishedAt }));
    res.set("Cache-Control", "no-cache");
    res.json({ settings: publicSettings(), episodes: eps, feedUrl: feedUrlFor(req) });
  });

  const sendFeed = (req, res) => {
    res.type("application/rss+xml; charset=utf-8").set("Cache-Control", "public, max-age=300");
    res.send(buildFeed({ settings: settings(), episodes: episodes(), siteUrl: cfg.siteUrl, feedUrl: feedUrlFor(req) }));
  };
  app.get("/rss.xml", sendFeed);
  app.get("/feed.xml", sendFeed);

  app.post("/api/subscribe", limiter(10, 60 * 60 * 1000).mw, express.json({ limit: "2kb" }), (req, res) => {
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

  app.get("/api/facebook/status", (req, res) => res.json({ configured: fbReady() }));

  // ================= Admin =================
  app.post("/api/admin/login", express.json({ limit: "2kb" }), (req, res) => {
    if (!authReady) return res.status(503).json({ error: NOT_SET_UP });
    if (loginFails.blocked(req.ip)) return res.status(429).json({ error: "Too many failed logins. Try again in 15 minutes." });
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    const password = String((req.body && req.body.password) || "");
    const passOk = verifyPassword(password, cfg.adminPasswordHash); // always runs, so a wrong email takes the same time
    const emailOk = email.length === cfg.adminEmail.length && crypto.timingSafeEqual(Buffer.from(email), Buffer.from(cfg.adminEmail));
    if (!passOk || !emailOk) {
      loginFails.hit(req.ip);
      logger.warn("admin login failed", { ip: req.ip });
      return res.status(401).json({ error: "Wrong email or password." });
    }
    loginFails.reset(req.ip);
    const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
    activity("login", { email });
    res.json({ token: signToken({ sub: cfg.adminEmail, exp }, cfg.sessionSecret), expires: new Date(exp).toISOString() });
  });

  app.get("/api/admin/me", requireAdmin, (req, res) => res.json({ ok: true, email: req.admin, production: cfg.production }));

  app.get("/api/admin/stats", requireAdmin, (req, res) => {
    const subs = store.read("subscribers", []);
    const acts = store.read("activity", []);
    const s = settings(), eps = episodes();
    const weekAgo = Date.now() - 7 * 864e5;
    const posts = acts.filter((a) => a.type === "facebook_post");
    res.json({
      subscribers: subs.length,
      subscribersLast7Days: subs.filter((x) => Date.parse(x.date) >= weekAgo).length,
      episodes: eps.length,
      facebookPosts: posts.length,
      lastFacebookPost: posts[0] ? posts[0].time : null,
      donate: { goal: s.donate.goal, raised: s.donate.raised },
      quotes: s.quotes.length,
      seeded: Boolean(s.meta && s.meta.seeded),
      facebookConfigured: fbReady(),
      feedUrl: feedUrlFor(req),
      feedIssues: feedIssues({ settings: s, episodes: eps, siteUrl: cfg.siteUrl })
    });
  });

  // ---- Settings (show info, platform links, donations, quotes, clips)
  app.get("/api/admin/settings", requireAdmin, (req, res) => res.json(settings()));
  app.put("/api/admin/settings", requireAdmin, express.json({ limit: "300kb" }), (req, res) => {
    const merged = mergeSettings(settings(), req.body);
    store.write("settings", merged);
    activity("settings_update", { fields: Object.keys(req.body).join(",") });
    res.json(merged);
  });

  // ---- Subscribers
  app.get("/api/admin/subscribers", requireAdmin, (req, res) => {
    res.json({ subscribers: store.read("subscribers", []).slice().sort((a, b) => (a.date < b.date ? 1 : -1)) });
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
  const csvCell = (v) => { const s = String(v); return /^[=+\-@]/.test(s) ? "'" + s : s; };
  app.get("/api/admin/subscribers.csv", requireAdmin, (req, res) => {
    const rows = ["email,date", ...store.read("subscribers", []).map((s) => `${csvCell(s.email)},${csvCell(s.date)}`)];
    res.type("text/csv").attachment("subscribers.csv").send(rows.join("\n"));
  });

  app.get("/api/admin/activity", requireAdmin, (req, res) => {
    const limit = Math.max(1, Math.min(ACTIVITY_MAX, Number(req.query.limit) || 100));
    res.json({ activity: store.read("activity", []).slice(0, limit) });
  });

  // ---- Facebook helpers
  async function graphPost(url, form) {
    form.append("access_token", cfg.fbToken);
    let fb;
    try { fb = await fetch(url, { method: "POST", body: form, signal: AbortSignal.timeout(120000) }); }
    catch { return { ok: false, error: "Could not reach Facebook." }; }
    const data = await fb.json().catch(() => ({}));
    if (!fb.ok || data.error) return { ok: false, error: (data.error && data.error.message) || `Facebook error ${fb.status}` };
    return { ok: true, id: data.post_id || data.id };
  }

  async function announceOnFacebook(ep, message) {
    if (!fbReady()) return { ok: false, error: "Facebook Page isn't connected on the server." };
    const form = new FormData();
    form.append("message", (message || `New episode: ${ep.title}\n\n${ep.description}`).slice(0, 5000));
    if (cfg.siteUrl) form.append("link", `${cfg.siteUrl}/#ep-${ep.id}`);
    const r = await graphPost(`${cfg.fbGraphUrl}/${cfg.fbVersion}/${encodeURIComponent(cfg.fbPageId)}/feed`, form);
    activity(r.ok ? "facebook_post" : "facebook_post_failed", r.ok ? { kind: "episode", id: r.id } : { kind: "episode", error: r.error });
    return r;
  }

  // ---- Episodes: publish to the website, podcast apps (RSS feed) and/or Facebook
  app.get("/api/admin/episodes", requireAdmin, (req, res) => {
    res.json({ episodes: episodes().sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1)) });
  });

  async function checkMedia(input, current = {}) {
    const out = {};
    if (input.audioUrl && input.audioUrl !== current.audioUrl) {
      try { const m = await probe(input.audioUrl, { kind: "audio" }); out.audioBytes = m.bytes; out.audioType = m.type; }
      catch (e) { throw new ValidationError("Audio link: " + e.message); }
    }
    if (input.imageUrl && input.imageUrl !== current.imageUrl) {
      try { await probe(input.imageUrl, { kind: "image" }); }
      catch (e) { throw new ValidationError("Episode image: " + e.message); }
    }
    return out;
  }

  app.post("/api/admin/episodes", requireAdmin, express.json({ limit: "50kb" }), asyncRoute(async (req, res) => {
    const input = episodeInput(req.body, { allowHttp: cfg.allowHttpMedia });
    const media = await checkMedia(input);
    const list = episodes();
    const ep = {
      id: crypto.randomUUID(),
      number: input.number || list.reduce((m, e) => Math.max(m, e.number || 0), 0) + 1,
      ...(input.season ? { season: input.season } : {}),
      title: input.title, description: input.description,
      audioUrl: input.audioUrl, audioBytes: media.audioBytes, audioType: media.audioType,
      duration: input.duration || 0,
      explicit: input.explicit ?? settings().show.explicit,
      imageUrl: input.imageUrl || "",
      platforms: input.platforms.filter((p) => p !== "facebook"),
      publishedAt: new Date().toISOString()
    };
    list.push(ep);
    store.write("episodes", list);
    activity("episode_published", { id: ep.id, title: ep.title, platforms: input.platforms.join(",") });

    const results = {};
    if (ep.platforms.includes("website")) results.website = { ok: true };
    if (ep.platforms.includes("podcast")) results.podcast = { ok: true, feedUrl: feedUrlFor(req) };
    if (input.platforms.includes("facebook")) results.facebook = await announceOnFacebook(ep, input.facebookMessage);
    res.status(201).json({ episode: ep, results });
  }));

  app.put("/api/admin/episodes/:id", requireAdmin, express.json({ limit: "50kb" }), asyncRoute(async (req, res) => {
    const list = episodes();
    const ep = list.find((e) => e.id === req.params.id);
    if (!ep) return res.status(404).json({ error: "Episode not found." });
    const input = episodeInput(req.body, { allowHttp: cfg.allowHttpMedia, partial: true });
    Object.assign(ep, await checkMedia(input, ep));
    for (const k of ["title", "description", "audioUrl", "imageUrl", "duration", "explicit", "number", "season"]) if (input[k] !== undefined) ep[k] = input[k];
    if (input.platforms) ep.platforms = input.platforms.filter((p) => p !== "facebook");
    ep.updatedAt = new Date().toISOString();
    store.write("episodes", list);
    activity("episode_updated", { id: ep.id, title: ep.title });
    res.json({ episode: ep });
  }));

  app.delete("/api/admin/episodes/:id", requireAdmin, (req, res) => {
    const list = episodes();
    const ep = list.find((e) => e.id === req.params.id);
    if (!ep) return res.status(404).json({ error: "Episode not found." });
    store.write("episodes", list.filter((e) => e !== ep));
    activity("episode_unpublished", { id: ep.id, title: ep.title });
    res.json({ ok: true });
  });

  // ---- Studio: post an image or video file to the Facebook Page (raw body, ?caption=)
  app.post("/api/facebook/post", requireAdmin, express.raw({ type: ["image/*", "video/*"], limit: cfg.maxUpload || "100mb" }), asyncRoute(async (req, res) => {
    if (!fbReady()) return res.status(503).json({ error: "Facebook Page is not connected on the server." });
    const type = (req.get("content-type") || "").split(";")[0];
    const isVideo = type.startsWith("video/");
    if (!Buffer.isBuffer(req.body) || !req.body.length || !(isVideo || type.startsWith("image/"))) {
      return res.status(400).json({ error: "Send an image or video file." });
    }
    const ext = isVideo ? (type.includes("mp4") ? "mp4" : "webm") : (type.includes("png") ? "png" : "jpg");
    const form = new FormData();
    form.append(isVideo ? "description" : "message", String(req.query.caption || "").slice(0, 5000));
    form.append("source", new Blob([req.body], { type }), `lone-soulja.${ext}`);
    const base = isVideo ? cfg.fbVideoUrl : cfg.fbGraphUrl;
    const r = await graphPost(`${base}/${cfg.fbVersion}/${encodeURIComponent(cfg.fbPageId)}/${isVideo ? "videos" : "photos"}`, form);
    const kind = isVideo ? "video" : "image";
    if (!r.ok) { activity("facebook_post_failed", { kind, error: r.error }); return res.status(502).json({ error: r.error }); }
    activity("facebook_post", { kind, id: r.id, bytes: req.body.length });
    res.json({ ok: true, id: r.id });
  }));

  // ---- Errors
  app.use((req, res) => res.status(404).json({ error: "Not found" }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    const status = err.status || err.statusCode || 500;
    if (status >= 500) logger.error("unhandled error", { path: req.path, error: err.message });
    res.status(status).json({ error: status === 413 ? "File too large." : status < 500 ? "Bad request." : "Server error" });
  });

  return app;
}

if (require.main === module) {
  const cfg = loadConfig();
  if (!cfg.adminEmail || !isValidHash(cfg.adminPasswordHash) || cfg.sessionSecret.length < 32) {
    logger.warn("Admin login disabled: set ADMIN_EMAIL, ADMIN_PASSWORD_HASH and SESSION_SECRET (32+ characters)");
  }
  if (!cfg.siteUrl) logger.warn("SITE_URL is not set: the podcast feed has no website link or cover art");
  const s = createStore(cfg.dataDir).read("settings", {});
  if (cfg.production && s.meta && s.meta.seeded) logger.error("SEED DATA FOUND IN PRODUCTION DATA_DIR: wipe it");
  const port = Number(env("PORT", "3000"));
  createApp(cfg).listen(port, () => logger.info("server started", { port, production: cfg.production, facebook: Boolean(cfg.fbPageId && cfg.fbToken) }));
}

module.exports = { createApp, loadConfig };
