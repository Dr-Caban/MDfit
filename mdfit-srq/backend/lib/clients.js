// Client accounts: sign up / log in, client dashboard API (appointments, plan, pain log), and admin client management.
// Client sessions are signed tokens with role "client"; they can never pass the admin check (which needs sub = ADMIN_EMAIL).
const express = require("express");
const crypto = require("crypto");
const { hashPassword, verifyPassword, signToken, verifyToken } = require("./auth");
const { ValidationError, EMAIL_RE, AREAS } = require("./validate");

const SESSION_DAYS = 30;
const RESET_HOURS = 24;
const GUIDE_IDS = ["posterior-neck", "scalenes", "rotator-cuff", "iliopsoas", "lateral-hip", "quads", "calf"];
const PAIN_LOG_MAX = 1000;
const WORKOUT_LOG_MAX = 2000;

const addDay = (date, n) => new Date(Date.parse(date + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
// Streaks count calendar days (clinic time zone) with at least one completed workout.
function workoutStats(log, today) {
  const days = new Set(log.map((w) => w.date));
  let streak = 0;
  for (let d = days.has(today) ? today : addDay(today, -1); days.has(d); d = addDay(d, -1)) streak++;
  let best = 0, run = 0, prev = null;
  for (const d of [...days].sort()) { run = prev && addDay(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  const dow = (new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7; // Monday = 0
  const monday = addDay(today, -dow);
  const week = Array.from({ length: 7 }, (_, i) => days.has(addDay(monday, i)));
  const minutes = log.reduce((n, w) => n + (w.minutes || 0), 0);
  return { streak, bestStreak: best, workouts: log.length, hours: Math.round(minutes / 6) / 10, week, todayIndex: dow };
}

const fail = (msg) => { throw new ValidationError(msg); };
function text(v, field, { max = 200, min = 0 } = {}) {
  if (v === undefined || v === null) v = "";
  if (typeof v !== "string") fail(`${field} must be text.`);
  const s = v.trim();
  if (s.length < min) fail(min === 1 ? `${field} is required.` : `${field} must be at least ${min} characters.`);
  if (s.length > max) fail(`${field} is too long (max ${max} characters).`);
  return s;
}
const emailOf = (v) => {
  const e = text(v, "Email", { min: 1, max: 254 }).toLowerCase();
  if (!EMAIL_RE.test(e)) fail("Email is not valid.");
  return e;
};
const phoneOf = (v) => {
  const p = text(v, "Phone", { max: 30 });
  if (p && !/^[0-9()+\-.\s]{7,30}$/.test(p)) fail("Phone number is not valid.");
  return p;
};
const passwordOf = (v, field = "Password") => {
  if (typeof v !== "string" || v.length < 8) fail(`${field} must be at least 8 characters.`);
  if (v.length > 200) fail(`${field} is too long.`);
  return v;
};
const emptyPlan = () => ({ guides: [], exercises: [], notes: "", updatedAt: null });
const id = () => crypto.randomBytes(6).toString("hex");

function mountClients(ctx) {
  const { app, admin, store, cfg, notify, cal, nowParts, activity, limiter, logger, mask, prettyDate, prettyTime } = ctx;
  const clients = () => store.read("clients", []);
  const save = (list) => store.write("clients", list);
  const appointments = () => store.read("appointments", []);
  const today = () => nowParts(cfg.tz, cfg.now()).date;
  const ready = cfg.sessionSecret.length >= 32;
  const signupLimit = limiter(10, 60 * 60 * 1000);
  const loginFails = limiter(10, 15 * 60 * 1000);

  const pub = (c) => ({ id: c.id, email: c.email, name: c.name, phone: c.phone, createdAt: c.createdAt, plan: c.plan || emptyPlan() });
  const session = (c) => {
    const exp = Date.now() + SESSION_DAYS * 864e5;
    return { token: signToken({ sub: c.id, role: "client", pwv: c.pwv || 0, exp }, cfg.sessionSecret), expiresAt: new Date(exp).toISOString(), client: pub(c) };
  };
  const resetToken = (c) => signToken({ sub: c.id, role: "reset", pwv: c.pwv || 0, exp: Date.now() + RESET_HOURS * 3600e3 }, cfg.sessionSecret);
  const resetUrl = (c) => `${cfg.siteUrl || ""}/login?reset=${encodeURIComponent(resetToken(c))}`;
  const myAppointments = (c) => appointments().filter((a) => a.email === c.email).map(({ cancelToken, adminNotes, ...a }) => a);
  const notReady = (res) => res.status(503).json({ error: "Accounts aren't set up on the server (SESSION_SECRET)." });

  function requireClient(req, res, next) {
    if (!ready) return notReady(res);
    const m = (req.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
    const payload = m && verifyToken(m[1], cfg.sessionSecret);
    const c = payload && payload.role === "client" && clients().find((x) => x.id === payload.sub);
    if (!c || (c.pwv || 0) !== payload.pwv) return res.status(401).json({ error: "Please log in again." });
    req.client = c;
    next();
  }

  // ================= Public: sign up, log in, password reset =================
  app.post("/api/clients/signup", signupLimit.mw, (req, res) => {
    if (!ready) return notReady(res);
    const b = req.body || {};
    if (b.company) return res.status(201).json({ ok: true });
    const email = emailOf(b.email);
    const c = {
      id: id(), email, name: text(b.name, "Name", { min: 2, max: 100 }), phone: phoneOf(b.phone),
      passwordHash: hashPassword(passwordOf(b.password)), pwv: 0, plan: emptyPlan(), painLog: [],
      createdAt: new Date().toISOString(), lastLoginAt: new Date().toISOString()
    };
    const list = clients();
    if (list.some((x) => x.email === email)) return res.status(409).json({ error: "There's already an account with that email. Log in instead." });
    list.push(c);
    save(list);
    activity("client_signup", { email });
    notify.owner(`New client account: ${c.name}`, `${c.name}\n${c.email}\n${c.phone || "(no phone)"}`);
    res.status(201).json(session(c));
  });

  app.post("/api/clients/login", (req, res) => {
    if (!ready) return notReady(res);
    if (loginFails.blocked(req.ip)) return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    const list = clients();
    const c = list.find((x) => x.email === email);
    if (!c || !verifyPassword(String((req.body && req.body.password) || ""), c.passwordHash)) {
      loginFails.hit(req.ip);
      logger.warn("client_login_failed", { email: mask(email || "-") });
      return res.status(401).json({ error: "Wrong email or password." });
    }
    loginFails.reset(req.ip);
    c.lastLoginAt = new Date().toISOString();
    save(list);
    res.json(session(c));
  });

  // Always answers the same way so it can't be used to find out who has an account.
  app.post("/api/clients/forgot", signupLimit.mw, (req, res) => {
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    const c = clients().find((x) => x.email === email);
    if (c && notify.enabled && cfg.siteUrl) {
      notify.client(c.email, "Reset your MD Fit password",
        `Hi ${c.name.split(" ")[0]},\n\nReset your password here (link works for ${RESET_HOURS} hours):\n${resetUrl(c)}\n\nIf you didn't ask for this, ignore this email.\n\nMD Fit`);
    }
    res.json({ ok: true, emailed: notify.enabled, message: notify.enabled
      ? "If that email has an account, a reset link is on its way."
      : "Call or text us and we'll send you a reset link." });
  });

  app.post("/api/clients/reset", (req, res) => {
    if (!ready) return notReady(res);
    const payload = verifyToken(String((req.body && req.body.token) || ""), cfg.sessionSecret);
    const list = clients();
    const c = payload && payload.role === "reset" && list.find((x) => x.id === payload.sub);
    if (!c || (c.pwv || 0) !== payload.pwv) return res.status(400).json({ error: "This reset link has expired or was already used. Ask for a new one." });
    c.passwordHash = hashPassword(passwordOf(req.body.password));
    c.pwv = (c.pwv || 0) + 1; // logs out old sessions and burns the link
    c.lastLoginAt = new Date().toISOString();
    save(list);
    activity("client_password_reset", { email: c.email });
    res.json(session(c));
  });

  // ================= Client dashboard =================
  const me = express.Router();
  me.use(requireClient);

  me.get("/", (req, res) => res.json({ client: pub(req.client) }));

  me.put("/", (req, res) => {
    const b = req.body || {};
    const list = clients();
    const c = list.find((x) => x.id === req.client.id);
    if (b.name !== undefined) c.name = text(b.name, "Name", { min: 2, max: 100 });
    if (b.phone !== undefined) c.phone = phoneOf(b.phone);
    save(list);
    res.json({ client: pub(c) });
  });

  me.put("/password", (req, res) => {
    const b = req.body || {};
    if (!verifyPassword(String(b.current || ""), req.client.passwordHash)) return res.status(400).json({ error: "Current password is wrong." });
    const list = clients();
    const c = list.find((x) => x.id === req.client.id);
    c.passwordHash = hashPassword(passwordOf(b.password, "New password"));
    c.pwv = (c.pwv || 0) + 1; // signs out other devices
    save(list);
    res.json(session(c));
  });

  me.get("/appointments", (req, res) => {
    const t = today();
    const mine = myAppointments(req.client).sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
    res.json({
      upcoming: mine.filter((a) => a.status === "booked" && a.date >= t),
      past: mine.filter((a) => !(a.status === "booked" && a.date >= t)).reverse()
    });
  });

  me.post("/appointments/:id/cancel", async (req, res) => {
    const list = appointments();
    const a = list.find((x) => x.id === req.params.id && x.email === req.client.email);
    if (!a) return res.status(404).json({ error: "Appointment not found." });
    if (a.status !== "booked" || a.date < today()) return res.status(400).json({ error: "This appointment can't be cancelled online." });
    if (a.source === "cal") {
      try { await cal.cancel(a.calUid, "Cancelled by client in MD Fit account"); }
      catch (err) { return res.status(502).json({ error: "Couldn't cancel right now. Please call us." }); }
    }
    a.status = "cancelled";
    a.cancelledAt = new Date().toISOString();
    store.write("appointments", list);
    activity("appointment_cancelled", { email: a.email, date: a.date, via: "account" });
    notify.owner(`Cancelled: ${a.typeName}, ${prettyDate(a.date)} at ${prettyTime(a.time)}`, `${a.name} (${a.email}) cancelled from their account.`);
    res.json({ ok: true });
  });

  me.get("/pain", (req, res) => res.json((req.client.painLog || []).slice().sort((a, b) => (a.date + a.createdAt < b.date + b.createdAt ? -1 : 1))));

  me.post("/pain", (req, res) => {
    const b = req.body || {};
    if (!AREAS.includes(b.area)) fail("Pick a body area from the list.");
    const level = Number(b.level);
    if (!Number.isInteger(level) || level < 0 || level > 10) fail("Pain level must be 0 to 10.");
    let date = b.date ? text(b.date, "Date", { max: 10 }) : today();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today()) fail("Date must be today or earlier.");
    const entry = { id: id(), date, area: b.area, level, note: text(b.note, "Note", { max: 500 }), createdAt: new Date().toISOString() };
    const list = clients();
    const c = list.find((x) => x.id === req.client.id);
    c.painLog = [...(c.painLog || []), entry].slice(-PAIN_LOG_MAX);
    save(list);
    res.status(201).json(entry);
  });

  me.delete("/pain/:id", (req, res) => {
    const list = clients();
    const c = list.find((x) => x.id === req.client.id);
    const before = (c.painLog || []).length;
    c.painLog = (c.painLog || []).filter((e) => e.id !== req.params.id);
    if (c.painLog.length === before) return res.status(404).json({ error: "Entry not found." });
    save(list);
    res.json({ ok: true });
  });

  // Completed workouts (from the app's workout generator)
  me.post("/workouts", (req, res) => {
    const b = req.body || {};
    const minutes = Number(b.minutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 300) fail("Minutes must be 1 to 300.");
    const exercises = Number(b.exercises || 0);
    if (!Number.isInteger(exercises) || exercises < 0 || exercises > 50) fail("Exercise count is off.");
    const entry = { id: id(), title: text(b.title, "Workout name", { min: 1, max: 80 }), goal: text(b.goal, "Goal", { max: 40 }),
      minutes, exercises, date: today(), completedAt: new Date().toISOString() };
    const list = clients();
    const c = list.find((x) => x.id === req.client.id);
    c.workouts = [...(c.workouts || []), entry].slice(-WORKOUT_LOG_MAX);
    save(list);
    res.status(201).json({ workout: entry, stats: workoutStats(c.workouts, today()) });
  });

  me.get("/stats", (req, res) => {
    const log = req.client.workouts || [];
    res.json({ ...workoutStats(log, today()), recent: log.slice(-10).reverse() });
  });

  app.use("/api/me", me);

  // ================= Admin: clients =================
  admin.get("/clients", (req, res) => {
    const t = today(), appts = appointments();
    res.json(clients().map((c) => {
      const mine = appts.filter((a) => a.email === c.email);
      const next = mine.filter((a) => a.status === "booked" && a.date >= t).sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1))[0];
      const last = (c.painLog || []).slice(-1)[0];
      return { id: c.id, name: c.name, email: c.email, phone: c.phone, createdAt: c.createdAt, lastLoginAt: c.lastLoginAt,
        visits: mine.filter((a) => a.status === "completed").length, next: next ? { date: next.date, time: next.time, typeName: next.typeName } : null,
        lastPain: last ? { date: last.date, area: last.area, level: last.level } : null, hasPlan: Boolean(c.plan && (c.plan.guides.length || c.plan.exercises.length || c.plan.notes)) };
    }).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
  });

  admin.get("/clients/:id", (req, res) => {
    const c = clients().find((x) => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: "Client not found." });
    res.json({ ...pub(c), lastLoginAt: c.lastLoginAt, painLog: c.painLog || [],
      workouts: (c.workouts || []).slice(-50).reverse(), stats: workoutStats(c.workouts || [], today()),
      appointments: appointments().filter((a) => a.email === c.email).map(({ cancelToken, ...a }) => a).sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1)) });
  });

  admin.put("/clients/:id/plan", (req, res) => {
    const list = clients();
    const c = list.find((x) => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: "Client not found." });
    const b = req.body || {};
    const guides = Array.isArray(b.guides) ? [...new Set(b.guides)] : [];
    if (guides.some((g) => !GUIDE_IDS.includes(g))) fail("Unknown guide.");
    if (!Array.isArray(b.exercises || []) || (b.exercises || []).length > 30) fail("Up to 30 exercises.");
    const exercises = (b.exercises || []).map((e, i) => ({
      name: text(e && e.name, `Exercise ${i + 1} name`, { min: 1, max: 80 }),
      detail: text(e && e.detail, `Exercise ${i + 1} details`, { max: 300 })
    }));
    c.plan = { guides, exercises, notes: text(b.notes, "Notes", { max: 3000 }), updatedAt: new Date().toISOString() };
    save(list);
    activity("client_plan", { email: c.email });
    if (notify.enabled && cfg.siteUrl) notify.client(c.email, "Your MD Fit plan was updated", `Hi ${c.name.split(" ")[0]},\n\nDr. Jared updated your plan. See it here:\n${cfg.siteUrl}/account\n\nMD Fit`);
    res.json(c.plan);
  });

  admin.post("/clients/:id/reset-link", (req, res) => {
    const c = clients().find((x) => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: "Client not found." });
    res.json({ url: resetUrl(c), hours: RESET_HOURS });
  });

  admin.delete("/clients/:id", (req, res) => {
    const list = clients();
    const next = list.filter((x) => x.id !== req.params.id);
    if (next.length === list.length) return res.status(404).json({ error: "Client not found." });
    save(next);
    activity("client_deleted", { id: req.params.id });
    res.json({ ok: true });
  });
}

module.exports = { mountClients, GUIDE_IDS, workoutStats };
