// Client accounts + dashboard API.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../server");
const { workoutStats } = require("../lib/clients");
const { hashPassword } = require("../lib/auth");
const { logger } = require("../lib/logger");

if (process.env.NODE_ENV === "production") throw new Error("Refusing to run tests in production.");
logger.level = 99;

async function start(extra = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mdfit-c-"));
  const app = createApp({
    adminEmail: "coach@example.com", adminPasswordHash: hashPassword("admin-pass-123"), sessionSecret: "s".repeat(40),
    dataDir, origins: ["*"], tz: "America/New_York", now: () => new Date("2026-11-02T10:00:00Z"), siteUrl: "https://mdfit.example.com", ...extra
  });
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, body, token) => {
    const res = await fetch(base + url, {
      method, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: res.status, body: await res.json().catch(() => undefined) };
  };
  const adminToken = async () => (await call("POST", "/api/admin/login", { email: "coach@example.com", password: "admin-pass-123" })).body.token;
  return { call, adminToken, dataDir, close: () => { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); } };
}

const signup = (s, over = {}) => s.call("POST", "/api/clients/signup", { name: "Pat Doe", email: "Pat@Example.com", phone: "941-555-0100", password: "pat-pass-123", ...over });

test("sign up, duplicate email, log in, wrong password, profile", async (t) => {
  const s = await start(); t.after(s.close);
  assert.equal((await signup(s, { password: "short" })).status, 400);
  assert.equal((await signup(s, { email: "nope" })).status, 400);
  const r = await signup(s);
  assert.equal(r.status, 201);
  assert.ok(r.body.token);
  assert.equal(r.body.client.email, "pat@example.com");
  assert.equal(r.body.client.passwordHash, undefined, "hash never leaves the server");
  assert.equal((await signup(s)).status, 409);

  assert.equal((await s.call("POST", "/api/clients/login", { email: "pat@example.com", password: "wrong-pass" })).status, 401);
  const login = await s.call("POST", "/api/clients/login", { email: "PAT@example.com", password: "pat-pass-123" });
  assert.equal(login.status, 200);
  const tok = login.body.token;

  assert.equal((await s.call("GET", "/api/me")).status, 401);
  assert.equal((await s.call("GET", "/api/me", undefined, tok)).body.client.name, "Pat Doe");
  const upd = await s.call("PUT", "/api/me", { name: "Pat D.", phone: "941-555-0199" }, tok);
  assert.equal(upd.body.client.name, "Pat D.");
  assert.equal(upd.body.client.phone, "941-555-0199");
  assert.equal((await s.call("PUT", "/api/me", { phone: "abc" }, tok)).status, 400);
});

test("client and admin tokens can't be swapped", async (t) => {
  const s = await start(); t.after(s.close);
  const client = (await signup(s)).body.token;
  const admin = await s.adminToken();
  assert.equal((await s.call("GET", "/api/admin/clients", undefined, client)).status, 401);
  assert.equal((await s.call("GET", "/api/admin/stats", undefined, client)).status, 401);
  assert.equal((await s.call("GET", "/api/me", undefined, admin)).status, 401);
});

test("dashboard shows only my appointments; I can cancel mine, not others'", async (t) => {
  const s = await start(); t.after(s.close);
  const tok = (await signup(s)).body.token;
  const book = (email, time) => s.call("POST", "/api/appointments", { typeId: "eval", date: "2026-11-03", time, name: "X Y", email, phone: "941-555-0100" });
  const mine = (await book("pat@example.com", "09:00")).body.appointment;
  const other = (await book("someone@example.com", "11:00")).body.appointment;

  const list = (await s.call("GET", "/api/me/appointments", undefined, tok)).body;
  assert.deepEqual(list.upcoming.map((a) => a.id), [mine.id]);
  assert.equal(list.upcoming[0].cancelToken, undefined);
  assert.equal(list.upcoming[0].adminNotes, undefined, "private session notes stay private");

  assert.equal((await s.call("POST", `/api/me/appointments/${other.id}/cancel`, {}, tok)).status, 404);
  assert.equal((await s.call("POST", `/api/me/appointments/${mine.id}/cancel`, {}, tok)).status, 200);
  assert.equal((await s.call("POST", `/api/me/appointments/${mine.id}/cancel`, {}, tok)).status, 400);
  const after = (await s.call("GET", "/api/me/appointments", undefined, tok)).body;
  assert.equal(after.upcoming.length, 0);
  assert.equal(after.past[0].status, "cancelled");
});

test("pain log: add, validate, list in order, delete", async (t) => {
  const s = await start(); t.after(s.close);
  const tok = (await signup(s)).body.token;
  assert.equal((await s.call("POST", "/api/me/pain", { area: "Spleen", level: 3 }, tok)).status, 400);
  assert.equal((await s.call("POST", "/api/me/pain", { area: "Knee", level: 11 }, tok)).status, 400);
  assert.equal((await s.call("POST", "/api/me/pain", { area: "Knee", level: 3, date: "2030-01-01" }, tok)).status, 400, "no future dates");
  await s.call("POST", "/api/me/pain", { area: "Knee", level: 7, date: "2026-10-20", note: "stairs" }, tok);
  const e = (await s.call("POST", "/api/me/pain", { area: "Knee", level: 4 }, tok)).body;
  assert.equal(e.date, "2026-11-02");
  const log = (await s.call("GET", "/api/me/pain", undefined, tok)).body;
  assert.deepEqual(log.map((x) => x.level), [7, 4]);
  assert.equal((await s.call("DELETE", `/api/me/pain/${e.id}`, undefined, tok)).status, 200);
  assert.equal((await s.call("GET", "/api/me/pain", undefined, tok)).body.length, 1);
});

test("admin: client list, detail, assign plan, client sees plan", async (t) => {
  const s = await start(); t.after(s.close);
  const tok = (await signup(s)).body.token;
  await s.call("POST", "/api/me/pain", { area: "Lower back", level: 6 }, tok);
  await s.call("POST", "/api/appointments", { typeId: "eval", date: "2026-11-03", time: "09:00", name: "Pat", email: "pat@example.com", phone: "941-555-0100" });
  const admin = await s.adminToken();
  const list = (await s.call("GET", "/api/admin/clients", undefined, admin)).body;
  assert.equal(list.length, 1);
  assert.equal(list[0].next.date, "2026-11-03");
  assert.equal(list[0].lastPain.level, 6);
  const detail = (await s.call("GET", `/api/admin/clients/${list[0].id}`, undefined, admin)).body;
  assert.equal(detail.painLog.length, 1);
  assert.equal(detail.appointments.length, 1);
  assert.equal(detail.passwordHash, undefined);

  assert.equal((await s.call("PUT", `/api/admin/clients/${list[0].id}/plan`, { guides: ["made-up"] }, admin)).status, 400);
  const plan = { guides: ["iliopsoas", "iliopsoas"], exercises: [{ name: "Dead bug", detail: "3 x 10, slow" }], notes: "Walk 10 min after sitting." };
  const saved = (await s.call("PUT", `/api/admin/clients/${list[0].id}/plan`, plan, admin)).body;
  assert.deepEqual(saved.guides, ["iliopsoas"]);
  const mine = (await s.call("GET", "/api/me", undefined, tok)).body.client.plan;
  assert.equal(mine.exercises[0].name, "Dead bug");
  assert.equal(mine.notes, "Walk 10 min after sitting.");
});

test("password reset link works once and signs out old sessions; password change too", async (t) => {
  const s = await start(); t.after(s.close);
  const old = (await signup(s)).body.token;
  const admin = await s.adminToken();
  const cid = (await s.call("GET", "/api/admin/clients", undefined, admin)).body[0].id;
  const link = (await s.call("POST", `/api/admin/clients/${cid}/reset-link`, {}, admin)).body.url;
  assert.match(link, /^https:\/\/mdfit\.example\.com\/login\?reset=/);
  const token = decodeURIComponent(link.split("reset=")[1]);

  assert.equal((await s.call("POST", "/api/clients/reset", { token, password: "short" })).status, 400);
  const r = await s.call("POST", "/api/clients/reset", { token, password: "new-pass-456" });
  assert.equal(r.status, 200);
  assert.equal((await s.call("POST", "/api/clients/reset", { token, password: "again-pass-789" })).status, 400, "link is single-use");
  assert.equal((await s.call("GET", "/api/me", undefined, old)).status, 401, "old session signed out");
  assert.equal((await s.call("POST", "/api/clients/login", { email: "pat@example.com", password: "new-pass-456" })).status, 200);

  // reset tokens can't be used as sessions
  assert.equal((await s.call("GET", "/api/me", undefined, token)).status, 401);

  const cur = r.body.token;
  assert.equal((await s.call("PUT", "/api/me/password", { current: "wrong", password: "x-pass-0000" }, cur)).status, 400);
  const ch = await s.call("PUT", "/api/me/password", { current: "new-pass-456", password: "x-pass-0000" }, cur);
  assert.equal(ch.status, 200);
  assert.equal((await s.call("GET", "/api/me", undefined, cur)).status, 401, "other sessions signed out");
  assert.equal((await s.call("GET", "/api/me", undefined, ch.body.token)).status, 200);

  const f = (await s.call("POST", "/api/clients/forgot", { email: "pat@example.com" })).body;
  assert.equal(f.emailed, false);
  assert.match(f.message, /Call or text us/);
});

test("login lockout after 10 wrong passwords", async (t) => {
  const s = await start(); t.after(s.close);
  await signup(s);
  for (let i = 0; i < 10; i++) await s.call("POST", "/api/clients/login", { email: "pat@example.com", password: "nope-nope" });
  assert.equal((await s.call("POST", "/api/clients/login", { email: "pat@example.com", password: "pat-pass-123" })).status, 429);
});

test("streak math: consecutive days, yesterday counts, best streak, this week", () => {
  const log = ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-01"].map((date) => ({ date, minutes: 30 }));
  const s = workoutStats(log, "2026-11-02"); // Monday; nothing logged today yet
  assert.equal(s.streak, 3, "Oct 30, 31, Nov 1 (today not done yet still counts)");
  assert.equal(s.bestStreak, 3);
  assert.equal(s.workouts, 7);
  assert.equal(s.hours, 3.5);
  assert.equal(s.todayIndex, 0);
  assert.deepEqual(s.week, [false, false, false, false, false, false, false]);
  assert.equal(workoutStats(log, "2026-11-03").streak, 0, "a missed day resets it");
  assert.deepEqual(workoutStats([{ date: "2026-11-04", minutes: 10 }], "2026-11-04").week, [false, false, true, false, false, false, false]);
});

test("log workouts and read stats", async (t) => {
  const s = await start(); t.after(s.close);
  const tok = (await signup(s)).body.token;
  assert.equal((await s.call("POST", "/api/me/workouts", { title: "Full Body Power", minutes: 0 }, tok)).status, 400);
  const r = await s.call("POST", "/api/me/workouts", { title: "Full Body Power", goal: "Full Body", minutes: 42, exercises: 8 }, tok);
  assert.equal(r.status, 201);
  assert.equal(r.body.stats.streak, 1);
  assert.equal(r.body.stats.workouts, 1);
  const st = (await s.call("GET", "/api/me/stats", undefined, tok)).body;
  assert.equal(st.hours, 0.7);
  assert.equal(st.recent[0].title, "Full Body Power");
  const admin = await s.adminToken();
  const cid = (await s.call("GET", "/api/admin/clients", undefined, admin)).body[0].id;
  const d = (await s.call("GET", `/api/admin/clients/${cid}`, undefined, admin)).body;
  assert.equal(d.workouts.length, 1);
  assert.equal(d.stats.streak, 1);
});

test("rewards math: XP, streak bonus, levels and badge dates", () => {
  const { rewards } = require("../lib/rewards");
  const w = (date, minutes, goal = "Full Body") => ({ date, minutes, goal, completedAt: date + "T15:00:00Z" });
  const r = rewards({
    workouts: [w("2026-03-02", 30), w("2026-03-03", 60), w("2026-03-04", 20, "Upper Body")],
    painLog: [{ date: "2026-03-02", area: "Knee", level: 7 }, { date: "2026-03-04", area: "Knee", level: 3 }],
    visits: [{ date: "2026-03-05" }]
  }, "2026-03-05");
  // 35 + (50+4) + (30+6) workouts, 10 pain, 50 visit
  assert.equal(r.xp, 185);
  assert.equal(r.level, 2);
  assert.equal(r.todayXp, 50);
  const b = Object.fromEntries(r.badges.map((x) => [x.id, x]));
  assert.equal(b["first-workout"].earnedOn, "2026-03-02");
  assert.equal(b["streak-3"].earnedOn, "2026-03-04");
  assert.equal(b["pain-down"].earned, true);
  assert.equal(b["first-visit"].earnedOn, "2026-03-05");
  assert.equal(b["explorer"].progress, 2);
  assert.equal(b["streak-7"].earned, false);
});

test("library: favorites and programs persist on the account", async (t) => {
  const s = await start(); t.after(s.close);
  const tok = (await signup(s)).body.token;
  assert.equal((await s.call("PUT", "/api/me/favorites/bad%20id", undefined, tok)).status, 400);
  let lib = (await s.call("PUT", "/api/me/favorites/108rqCigYY-88hJo3QQTANQtb9qcalFYG", undefined, tok)).body;
  assert.deepEqual(lib.favorites, ["108rqCigYY-88hJo3QQTANQtb9qcalFYG"]);
  const workout = { title: "Core Strength", goal: "Core & Spine", goalId: "core", location: "home", level: "intermediate", levelLabel: "Intermediate",
    rounds: 3, restEx: 15, restRound: 30, minutes: 15, warmup: [{ id: "108rqCigYY-88hJo3QQTANQtb9qcalFYG", sets: "45 sec" }], circuit: [], cooldown: [] };
  assert.equal((await s.call("POST", "/api/me/programs", { name: "", workout }, tok)).status, 400);
  lib = (await s.call("POST", "/api/me/programs", { name: "Monday core", workout }, tok)).body;
  assert.equal(lib.programs[0].name, "Monday core");
  assert.equal(lib.programs[0].workout.warmup[0].sets, "45 sec");
  lib = (await s.call("GET", "/api/me/library", undefined, tok)).body;
  assert.equal(lib.favorites.length, 1);
  lib = (await s.call("DELETE", `/api/me/programs/${lib.programs[0].id}`, undefined, tok)).body;
  assert.equal(lib.programs.length, 0);
  lib = (await s.call("DELETE", "/api/me/favorites/108rqCigYY-88hJo3QQTANQtb9qcalFYG", undefined, tok)).body;
  assert.equal(lib.favorites.length, 0);
  // rewards endpoint
  await s.call("POST", "/api/me/workouts", { title: "Core", goal: "Core & Spine", minutes: 20, exercises: 6 }, tok);
  const r = (await s.call("GET", "/api/me/rewards", undefined, tok)).body;
  assert.equal(r.xp, 30);
  assert.equal(r.badges.find((b) => b.id === "first-workout").earned, true);
  assert.equal((await s.call("GET", "/api/me/workouts", undefined, tok)).body.length, 1);
});
