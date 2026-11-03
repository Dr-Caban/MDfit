// Video hosting on Cloudinary. Admin starts a copy job; Cloudinary fetches each video straight from Google Drive
// (confirm=t skips Drive's large-file virus-scan page) and stores it as mdfit/<driveId>. The app then streams
// every exercise video and thumbnail from Cloudinary. The API secret stays in Railway; uploads are signed here.
"use strict";
const crypto = require("crypto");

function mountVideos({ app, admin, store, cfg, logger }) {
  const CLOUD = process.env.CLOUDINARY_CLOUD_NAME || "", KEY = process.env.CLOUDINARY_API_KEY || "", SECRET = process.env.CLOUDINARY_API_SECRET || "";
  const ready = () => !!(CLOUD && KEY && SECRET);
  const read = () => store.read("videos", { done: {}, failed: {} });
  const write = (d) => store.write("videos", d);
  let job = null;

  const driveUrl = (id) => `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`;
  const sign = (params) => crypto.createHash("sha1").update(Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&") + SECRET).digest("hex");

  async function upload(id) {
    const params = { public_id: `mdfit/${id}`, overwrite: "false", timestamp: Math.floor(Date.now() / 1000) };
    const body = new URLSearchParams({ ...params, file: driveUrl(id), api_key: KEY, signature: sign(params) });
    const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/video/upload`, { method: "POST", body });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || `HTTP ${r.status}`);
    return { bytes: j.bytes, duration: j.duration, format: j.format, version: j.version };
  }

  async function idsFromSite() {
    const site = (cfg.siteUrl || "https://www.mymdfit.com").replace(/\/+$/, "");
    const get = (p) => fetch(site + p, { headers: { "user-agent": "MDFit-API/1.0" } }).then((r) => r.text());
    const ids = new Set();
    const cat = JSON.parse(await get("/data/catalog.json"));
    (cat.exercises || []).forEach((e) => ids.add(e.id));
    for (const p of ["/paintracks.js", "/app/exercises.js"]) for (const m of (await get(p)).match(/["'`]1[\w-]{24,40}["'`]/g) || []) ids.add(m.slice(1, -1));
    const content = store.read("content", null);
    for (const l of (content && content.lectures) || []) { const m = String(l.url || "").match(/\/d\/([\w-]{20,})/); if (m) ids.add(m[1]); }
    return [...ids];
  }

  async function run(ids, retryFailed) {
    const d = read();
    const todo = ids.filter((id) => !d.done[id] && (retryFailed || !d.failed[id]));
    job = { total: todo.length, ok: 0, failed: 0, current: "", startedAt: new Date().toISOString() };
    for (const id of todo) {
      job.current = id;
      try { const info = await upload(id); d.done[id] = info; delete d.failed[id]; job.ok++; }
      catch (e) {
        if (/already exists/i.test(e.message)) { d.done[id] = { existed: true }; delete d.failed[id]; job.ok++; }
        else { d.failed[id] = e.message.slice(0, 200); job.failed++; logger && logger.warn && logger.warn("video upload failed", { id, error: e.message }); }
      }
      write(d);
    }
    job.current = ""; job.finishedAt = new Date().toISOString();
  }

  // Keep Cloudinary in sync on its own: shortly after start-up, then every 6 hours (only copies what's missing)
  const autoSync = () => { if (!ready() || (job && !job.finishedAt) || cfg.noVideoSync) return; idsFromSite().then((ids) => run(ids, false)).catch((e) => { job = { error: e.message, finishedAt: new Date().toISOString() }; }); };
  if (ready() && !cfg.noVideoSync) { setTimeout(autoSync, 30000).unref(); setInterval(autoSync, 6 * 3600 * 1000).unref(); }

  admin.post("/videos/migrate", async (req, res) => {
    if (!ready()) return res.status(400).json({ error: "Cloudinary isn't configured on the API (CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET)." });
    if (job && !job.finishedAt) return res.json({ running: true, job });
    let ids; try { ids = await idsFromSite(); } catch (e) { return res.status(502).json({ error: "Couldn't read the video list from the site: " + e.message }); }
    run(ids, !!(req.body && req.body.retryFailed)).catch((e) => { job.error = e.message; job.finishedAt = new Date().toISOString(); });
    res.json({ started: true, total: ids.length });
  });
  admin.get("/videos/status", (req, res) => {
    const d = read();
    res.json({ configured: ready(), cloud: CLOUD, job, done: Object.keys(d.done).length, failed: d.failed });
  });

  // Public: which videos are on Cloudinary, so the app streams them from there
  app.get("/api/videos", (req, res) => {
    res.set("Cache-Control", "public, max-age=300");
    res.json({ cloud: ready() ? CLOUD : "", ids: ready() ? Object.keys(read().done) : [] });
  });
}

module.exports = { mountVideos };
