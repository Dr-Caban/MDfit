// MDFIT SRQ API: site content, free consultation requests, class schedule + booking, newsletter, admin.
// Deploy on Railway with Root Directory = mdfit-srq/backend.
const express = require("express");
const crypto = require("crypto");
const path = require("path");
const { logger, mask, requestLogger } = require("./lib/logger");
const { createStore } = require("./lib/store");
const { verifyPassword, isValidHash, signToken, verifyToken } = require("./lib/auth");
const {
  ValidationError, LEAD_STATUSES, GOALS, SERVICES, DAYS,
  defaultSettings, leadInput, bookingInput, classInput, mergeSettings, EMAIL_RE
} = require("./lib/validate");

const env = (k, d = "") => (process.env[k] || d).trim();

function loadConfig() {
  return {
    adminEmail: env("ADMIN_EMAIL").toLowerCase(),
    adminPasswordHash: env("ADMIN_PASSWORD_HASH"),
    sessionSecret: env("SESSION_SECRET"),
    dataDir: env("DATA_DIR", path.join(__dirname, "data")),
    origins: env("ALLOWED_ORIGINS", "*").split(",").map((s) => s.trim()).filter(Boolean),
    tz: env("TZ_NAME", "America/New_York"),
    now: () => new Date()
  };
}

const SESSION_HOURS = 12;
const BOOK_AHEAD_DAYS = 14;
const ACTIVITY_MAX = 500;

// Starter schedule, written on first boot only. Edit or delete in the admin portal.
const STARTER_CLASSES = [
  { title: "Strength & Conditioning", day: 1, time: "06:00", durationMin: 60, capacity: 8, coach: "", location: "", description: "Full-body strength work followed by a conditioning finisher." },
  { title: "HIIT Bootcamp", day: 3, time: "06:00", durationMin: 45, capacity: 10, coach: "", location: "", description: "High-intensity intervals. All levels, every move can be scaled." },
  { title: "Strength & Conditioning", day: 5, time: "06:00", durationMin: 60, capacity: 8, coach: "", location: "", description: "Full-body strength work followed by a conditioning finisher." },
  { title: "Saturday Sweat", day: 6, time: "08:00", durationMin: 60, capacity: 12, coach: "", location: "", description: "Partner workout to finish the week strong." }
];

// ---- Dates in the gym's time zone. Dates are "YYYY-MM-DD" strings, times "HH:MM".
function nowParts(tz, d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
const addDays = (date, n) => new Date(Date.parse(date + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const weekday = (date) => new Date(date + "T12:00:00Z").getUTCDay();

const prettyDate = (date) => new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
const prettyTime = (t) => { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

const id = () => crypto.randomBytes(6).toString("hex");

function toCsv(rows, cols) {
  const cell = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n") + "\r\n";
}

function createApp(cfg = loadConfig()) {
  const store = createStore(cfg.dataDir);
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  const authReady = Boolean(cfg.adminEmail && isValidHash(cfg.adminPasswordHash) && cfg.sessionSecret.length >= 32);

  const settings = () => {
    const d = defaultSettings(), s = store.read("settings", {});
    return { ...d, ...s, business: { ...d.business, ...s.business }, coach: { ...d.coach, ...s.coach } };
  };
  const classes = () => {
    let list = store.read("classes", null);
    if (list === null) {
      list = STARTER_CLASSES.map((c) => ({ id: id(), active: true, ...c }));
      store.write("classes", list);
    }
    return list;
  };
  const bookings = () => store.read("bookings", []);
  const leads = () => store.read("leads", []);
  const subscribers = () => store.read("subscribers", []);

  function activity(type, detail = {}) {
    const list = store.read("activity", []);
    list.unshift({ time: new Date().toISOString(), type, ...detail });
    store.write("activity", list.slice(0, ACTIVITY_MAX));
    logger.info("activity", { type, ...detail, email: detail.email ? mask(detail.email) : undefined });
  }

  // Upcoming sessions for the next `days` days, with spots left.
  function schedule(days = 7) {
    const { date: today, time: nowTime } = nowParts(cfg.tz, cfg.now());
    const active = classes().filter((c) => c.active !== false);
    const counts = new Map();
    for (const b of bookings()) counts.set(b.classId + "|" + b.date, (counts.get(b.classId + "|" + b.date) || 0) + 1);
    const out = [];
    for (let i = 0; i < days; i++) {
      const date = addDays(today, i);
      for (const c of active.filter((x) => x.day === weekday(date))) {
        if (i === 0 && c.time <= nowTime) continue;
        const booked = counts.get(c.id + "|" + date) || 0;
        out.push({
          classId: c.id, date, dayName: DAYS[c.day], time: c.time, durationMin: c.durationMin, title: c.title,
          coach: c.coach, location: c.location, description: c.description, capacity: c.capacity,
          spotsLeft: Math.max(0, c.capacity - booked)
        });
      }
    }
    return out.sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
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
      res.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: "100kb" }));

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
  const formLimit = limiter(20, 60 * 60 * 1000);
  const loginFails = limiter(10, 15 * 60 * 1000);

  // Bots fill the hidden "company" field; pretend success and drop it.
  const honeypot = (req, res, next) => (req.body && req.body.company ? res.status(201).json({ ok: true }) : next());

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

  // ================= Public =================
  app.get("/", (req, res) => res.json({ name: "MDFIT SRQ API", ok: true }));
  app.get("/api/health", (req, res) => res.json({ ok: true }));

  app.get("/api/site", (req, res) => {
    res.set("Cache-Control", "no-cache");
    res.json({ settings: settings(), goals: GOALS, services: SERVICES });
  });

  app.get("/api/schedule", (req, res) => {
    const days = Math.min(BOOK_AHEAD_DAYS, Math.max(1, Number.parseInt(req.query.days, 10) || 7));
    res.set("Cache-Control", "no-cache");
    res.json({ timeZone: cfg.tz, sessions: schedule(days) });
  });

  app.post("/api/leads", formLimit.mw, honeypot, (req, res) => {
    const lead = { id: id(), ...leadInput(req.body), status: "new", notes: "", createdAt: new Date().toISOString() };
    const list = leads();
    list.unshift(lead);
    store.write("leads", list);
    activity("lead", { email: lead.email, service: lead.service });
    res.status(201).json({ ok: true, message: "Thanks! We'll reach out within one business day to set up your free consultation." });
  });

  app.post("/api/bookings", formLimit.mw, honeypot, (req, res) => {
    const b = bookingInput(req.body);
    const session = schedule(BOOK_AHEAD_DAYS).find((s) => s.classId === b.classId && s.date === b.date);
    if (!session) return res.status(404).json({ error: "That class isn't open for booking. Pick another time." });
    const list = bookings();
    if (list.some((x) => x.classId === b.classId && x.date === b.date && x.email === b.email))
      return res.status(409).json({ error: "You're already booked for this class." });
    if (session.spotsLeft <= 0) return res.status(409).json({ error: "This class is full. Pick another time." });
    const booking = { id: id(), ...b, title: session.title, time: session.time, cancelToken: crypto.randomBytes(16).toString("hex"), createdAt: new Date().toISOString() };
    list.push(booking);
    store.write("bookings", list);
    activity("booking", { email: b.email, classId: b.classId, date: b.date });
    res.status(201).json({
      ok: true,
      booking: { id: booking.id, title: booking.title, date: booking.date, time: booking.time, cancelToken: booking.cancelToken },
      message: `You're in: ${session.title}, ${prettyDate(b.date)} at ${prettyTime(session.time)}.`
    });
  });

  app.post("/api/bookings/:id/cancel", formLimit.mw, (req, res) => {
    const token = String((req.body && req.body.token) || "");
    const list = bookings();
    const i = list.findIndex((x) => x.id === req.params.id);
    const ok = i >= 0 && token.length === list[i].cancelToken.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(list[i].cancelToken));
    if (!ok) return res.status(404).json({ error: "Booking not found." });
    const [gone] = list.splice(i, 1);
    store.write("bookings", list);
    activity("booking_cancelled", { email: gone.email, classId: gone.classId, date: gone.date });
    res.json({ ok: true });
  });

  app.post("/api/subscribe", formLimit.mw, honeypot, (req, res) => {
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: "Enter a valid email." });
    const list = subscribers();
    if (!list.some((s) => s.email === email)) {
      list.push({ email, createdAt: new Date().toISOString() });
      store.write("subscribers", list);
      activity("subscribe", { email });
    }
    res.status(201).json({ ok: true, message: "You're on the list." });
  });

  // ================= Admin =================
  app.post("/api/admin/login", (req, res) => {
    if (!authReady) return res.status(503).json({ error: NOT_SET_UP });
    if (loginFails.blocked(req.ip)) return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    const password = String((req.body && req.body.password) || "");
    const ok = email === cfg.adminEmail && verifyPassword(password, cfg.adminPasswordHash);
    if (!ok) {
      loginFails.hit(req.ip);
      logger.warn("login_failed", { email: mask(email || "-") });
      return res.status(401).json({ error: "Wrong email or password." });
    }
    loginFails.reset(req.ip);
    const exp = Date.now() + SESSION_HOURS * 3600e3;
    activity("login", { email });
    res.json({ token: signToken({ sub: email, exp }, cfg.sessionSecret), expiresAt: new Date(exp).toISOString() });
  });

  const admin = express.Router();
  admin.use(requireAdmin);

  admin.get("/me", (req, res) => res.json({ email: req.admin }));

  admin.get("/stats", (req, res) => {
    const l = leads(), up = schedule(7);
    res.json({
      leadsNew: l.filter((x) => x.status === "new").length,
      leadsTotal: l.length,
      subscribers: subscribers().length,
      bookingsThisWeek: up.reduce((n, s) => n + (s.capacity - s.spotsLeft), 0),
      sessionsThisWeek: up.length,
      upcoming: up.slice(0, 10)
    });
  });

  admin.get("/settings", (req, res) => res.json(settings()));
  admin.put("/settings", (req, res) => {
    const s = mergeSettings(settings(), req.body);
    store.write("settings", s);
    activity("settings", { sections: Object.keys(req.body) });
    res.json(s);
  });

  // Leads
  admin.get("/leads", (req, res) => {
    const status = req.query.status;
    res.json(status ? leads().filter((x) => x.status === status) : leads());
  });
  admin.patch("/leads/:id", (req, res) => {
    const list = leads();
    const lead = list.find((x) => x.id === req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead not found." });
    const b = req.body || {};
    if (b.status !== undefined) {
      if (!LEAD_STATUSES.includes(b.status)) return res.status(400).json({ error: "Unknown status." });
      lead.status = b.status;
    }
    if (b.notes !== undefined) {
      if (typeof b.notes !== "string" || b.notes.length > 4000) return res.status(400).json({ error: "Notes must be text up to 4000 characters." });
      lead.notes = b.notes;
    }
    lead.updatedAt = new Date().toISOString();
    store.write("leads", list);
    res.json(lead);
  });
  admin.delete("/leads/:id", (req, res) => {
    const list = leads();
    const next = list.filter((x) => x.id !== req.params.id);
    if (next.length === list.length) return res.status(404).json({ error: "Lead not found." });
    store.write("leads", next);
    res.json({ ok: true });
  });
  admin.get("/leads.csv", (req, res) => {
    res.type("text/csv").attachment("mdfit-leads.csv")
      .send(toCsv(leads(), ["createdAt", "name", "email", "phone", "service", "goal", "preferredTime", "message", "status", "notes"]));
  });

  // Classes
  admin.get("/classes", (req, res) => res.json(classes()));
  admin.post("/classes", (req, res) => {
    const c = { id: id(), active: true, ...classInput(req.body) };
    const list = classes();
    list.push(c);
    store.write("classes", list);
    activity("class_created", { classId: c.id, title: c.title });
    res.status(201).json(c);
  });
  admin.put("/classes/:id", (req, res) => {
    const list = classes();
    const c = list.find((x) => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: "Class not found." });
    Object.assign(c, classInput(req.body, { partial: true }));
    store.write("classes", list);
    res.json(c);
  });
  admin.delete("/classes/:id", (req, res) => {
    const list = classes();
    const next = list.filter((x) => x.id !== req.params.id);
    if (next.length === list.length) return res.status(404).json({ error: "Class not found." });
    store.write("classes", next);
    store.write("bookings", bookings().filter((b) => b.classId !== req.params.id));
    activity("class_deleted", { classId: req.params.id });
    res.json({ ok: true });
  });

  // Bookings
  admin.get("/bookings", (req, res) => {
    const { date: today } = nowParts(cfg.tz, cfg.now());
    const all = req.query.all === "1";
    res.json(bookings().filter((b) => all || b.date >= today)
      .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1))
      .map(({ cancelToken, ...b }) => b));
  });
  admin.delete("/bookings/:id", (req, res) => {
    const list = bookings();
    const next = list.filter((x) => x.id !== req.params.id);
    if (next.length === list.length) return res.status(404).json({ error: "Booking not found." });
    store.write("bookings", next);
    res.json({ ok: true });
  });

  // Subscribers
  admin.get("/subscribers", (req, res) => res.json(subscribers()));
  admin.delete("/subscribers/:email", (req, res) => {
    const email = req.params.email.toLowerCase();
    const list = subscribers();
    const next = list.filter((s) => s.email !== email);
    if (next.length === list.length) return res.status(404).json({ error: "Subscriber not found." });
    store.write("subscribers", next);
    res.json({ ok: true });
  });
  admin.get("/subscribers.csv", (req, res) => {
    res.type("text/csv").attachment("mdfit-subscribers.csv").send(toCsv(subscribers(), ["email", "createdAt"]));
  });

  admin.get("/activity", (req, res) => res.json(store.read("activity", []).slice(0, 200)));

  app.use("/api/admin", admin);

  // ---- 404 + errors
  app.use((req, res) => res.status(404).json({ error: "Not found." }));
  app.use((err, req, res, next) => {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON." });
    if (err.type === "entity.too.large") return res.status(413).json({ error: "Request too large." });
    logger.error("server_error", { path: req.path, error: err.message });
    res.status(500).json({ error: "Something went wrong. Try again." });
  });

  return app;
}

if (require.main === module) {
  const cfg = loadConfig();
  const port = Number(process.env.PORT) || 3000;
  createApp(cfg).listen(port, () => logger.info("listening", { port, dataDir: cfg.dataDir, tz: cfg.tz, origins: cfg.origins }));
}

module.exports = { createApp, loadConfig, nowParts, addDays, weekday, toCsv };
