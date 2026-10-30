// End-to-end API tests against a real server on a random port, with a temp data folder and a fixed clock.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp, addDays, weekday, toCsv } = require("../server");
const { hashPassword } = require("../lib/auth");
const { logger } = require("../lib/logger");

if (process.env.NODE_ENV === "production") throw new Error("Refusing to run tests in production.");
logger.level = 99;

const PASSWORD = "test-pass-123";
// Monday 2026-11-02, 05:00 in Sarasota (10:00 UTC)
const NOW = new Date("2026-11-02T10:00:00Z");

async function start(extra = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mdfit-"));
  const cfg = {
    adminEmail: "coach@example.com", adminPasswordHash: hashPassword(PASSWORD), sessionSecret: "s".repeat(40),
    dataDir, origins: ["https://mdfit.example.com"], tz: "America/New_York", now: () => NOW, ...extra
  };
  const server = createApp(cfg).listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let token = "";
  const call = async (method, url, body, headers = {}) => {
    const res = await fetch(base + url, {
      method, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = undefined; }
    return { status: res.status, body: json, text, headers: res.headers };
  };
  const login = async () => {
    const r = await call("POST", "/api/admin/login", { email: "coach@example.com", password: PASSWORD });
    token = r.body.token;
    return r;
  };
  const close = () => { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); };
  return { call, login, close, dataDir, setToken: (t) => { token = t; } };
}

test("date helpers", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(weekday("2026-11-02"), 1);
  assert.equal(toCsv([{ a: "=SUM(1)", b: 'say "hi"' }], ["a", "b"]), "a,b\r\n'=SUM(1),\"say \"\"hi\"\"\"\r\n");
});

test("health, site and CORS", async (t) => {
  const s = await start(); t.after(s.close);
  assert.equal((await s.call("GET", "/api/health")).body.ok, true);
  const site = await s.call("GET", "/api/site", undefined, { origin: "https://mdfit.example.com" });
  assert.equal(site.body.settings.business.name, "MDFIT SRQ");
  assert.ok(site.body.services.includes("Personal training"));
  assert.equal(site.headers.get("access-control-allow-origin"), "https://mdfit.example.com");
  const other = await s.call("GET", "/api/site", undefined, { origin: "https://evil.example.com" });
  assert.equal(other.headers.get("access-control-allow-origin"), null);
  assert.equal((await s.call("GET", "/nope")).status, 404);
});

test("schedule uses starter classes and skips past sessions", async (t) => {
  const s = await start(); t.after(s.close);
  const r = await s.call("GET", "/api/schedule?days=7");
  assert.equal(r.status, 200);
  // Monday 06:00 is still ahead at 05:00, so it's included
  assert.equal(r.body.sessions[0].date, "2026-11-02");
  assert.equal(r.body.sessions[0].time, "06:00");
  assert.equal(r.body.sessions.length, 4);
  const late = await start({ now: () => new Date("2026-11-02T12:00:00Z") }); t.after(late.close); // 07:00 local
  assert.equal((await late.call("GET", "/api/schedule")).body.sessions[0].date, "2026-11-04");
});

test("consultation leads: validation, honeypot, admin workflow, CSV", async (t) => {
  const s = await start(); t.after(s.close);
  assert.equal((await s.call("POST", "/api/leads", { name: "A", email: "x" })).status, 400);
  assert.equal((await s.call("POST", "/api/leads", { name: "Sam Lee", email: "sam@example.com", service: "Yoga" })).status, 400);
  assert.equal((await s.call("POST", "/api/leads", "not json")).status, 400);
  const ok = await s.call("POST", "/api/leads", { name: "Sam Lee", email: "Sam@Example.com", phone: "(941) 555-0100", service: "Personal training", goal: "Get stronger", message: "=cmd" });
  assert.equal(ok.status, 201);
  const bot = await s.call("POST", "/api/leads", { name: "Bot", email: "bot@example.com", company: "spam inc" });
  assert.equal(bot.status, 201);

  assert.equal((await s.call("GET", "/api/admin/leads")).status, 401);
  await s.login();
  const list = (await s.call("GET", "/api/admin/leads")).body;
  assert.equal(list.length, 1);
  assert.equal(list[0].email, "sam@example.com");
  assert.equal(list[0].status, "new");
  const upd = await s.call("PATCH", `/api/admin/leads/${list[0].id}`, { status: "contacted", notes: "Called Tue" });
  assert.equal(upd.body.status, "contacted");
  assert.equal((await s.call("PATCH", `/api/admin/leads/${list[0].id}`, { status: "weird" })).status, 400);
  const csv = await s.call("GET", "/api/admin/leads.csv");
  assert.match(csv.text, /sam@example\.com/);
  assert.match(csv.text, /'=cmd/);
  assert.equal((await s.call("GET", "/api/admin/stats")).body.leadsTotal, 1);
  assert.equal((await s.call("DELETE", `/api/admin/leads/${list[0].id}`)).status, 200);
  assert.equal((await s.call("DELETE", `/api/admin/leads/${list[0].id}`)).status, 404);
});

test("class booking: capacity, duplicates, wrong day, cancel", async (t) => {
  const s = await start(); t.after(s.close);
  await s.login();
  const cls = (await s.call("POST", "/api/admin/classes", { title: "Tiny Class", day: 2, time: "18:00", durationMin: 45, capacity: 2, coach: "", location: "", description: "" })).body;
  assert.equal(cls.capacity, 2);
  s.setToken("");

  const date = "2026-11-03"; // Tuesday
  const book = (email) => s.call("POST", "/api/bookings", { classId: cls.id, date, name: "Pat Doe", email });
  const first = await book("a@example.com");
  assert.equal(first.status, 201);
  assert.ok(first.body.booking.cancelToken);
  assert.equal(first.body.message, "You're in: Tiny Class, Tue, Nov 3 at 6:00 PM.");
  assert.equal((await book("a@example.com")).status, 409);
  assert.equal((await book("b@example.com")).status, 201);
  const full = await book("c@example.com");
  assert.equal(full.status, 409);
  assert.match(full.body.error, /full/);

  assert.equal((await s.call("POST", "/api/bookings", { classId: cls.id, date: "2026-11-04", name: "Pat", email: "d@example.com" })).status, 404);
  assert.equal((await s.call("POST", "/api/bookings", { classId: cls.id, date: "2026-12-29", name: "Pat", email: "d@example.com" })).status, 404); // too far ahead
  assert.equal((await s.call("POST", "/api/bookings", { classId: cls.id, date: "11/03/2026", name: "Pat", email: "d@example.com" })).status, 400);

  const sess = (await s.call("GET", "/api/schedule")).body.sessions.find((x) => x.classId === cls.id);
  assert.equal(sess.spotsLeft, 0);

  const { id: bid, cancelToken } = first.body.booking;
  assert.equal((await s.call("POST", `/api/bookings/${bid}/cancel`, { token: "wrong" })).status, 404);
  assert.equal((await s.call("POST", `/api/bookings/${bid}/cancel`, { token: cancelToken })).status, 200);
  assert.equal((await book("c@example.com")).status, 201);

  await s.login();
  const adminList = (await s.call("GET", "/api/admin/bookings")).body;
  assert.equal(adminList.length, 2);
  assert.equal(adminList[0].cancelToken, undefined);
  // Deactivated classes disappear from the schedule
  await s.call("PUT", `/api/admin/classes/${cls.id}`, { active: false });
  assert.equal((await s.call("GET", "/api/schedule")).body.sessions.some((x) => x.classId === cls.id), false);
  // Deleting a class removes its bookings
  await s.call("DELETE", `/api/admin/classes/${cls.id}`);
  assert.equal((await s.call("GET", "/api/admin/bookings")).body.length, 0);
});

test("class validation", async (t) => {
  const s = await start(); t.after(s.close);
  await s.login();
  assert.equal((await s.call("POST", "/api/admin/classes", { title: "X", day: 7, time: "06:00" })).status, 400);
  assert.equal((await s.call("POST", "/api/admin/classes", { title: "X", day: 1, time: "6am" })).status, 400);
  assert.equal((await s.call("PUT", "/api/admin/classes/nope", { title: "Y" })).status, 404);
  const list = (await s.call("GET", "/api/admin/classes")).body;
  assert.equal((await s.call("PUT", `/api/admin/classes/${list[0].id}`, {})).status, 400);
});

test("newsletter", async (t) => {
  const s = await start(); t.after(s.close);
  assert.equal((await s.call("POST", "/api/subscribe", { email: "bad" })).status, 400);
  assert.equal((await s.call("POST", "/api/subscribe", { email: "Fit@Example.com" })).status, 201);
  assert.equal((await s.call("POST", "/api/subscribe", { email: "fit@example.com" })).status, 201);
  await s.login();
  assert.equal((await s.call("GET", "/api/admin/subscribers")).body.length, 1);
  assert.match((await s.call("GET", "/api/admin/subscribers.csv")).text, /fit@example\.com/);
  assert.equal((await s.call("DELETE", "/api/admin/subscribers/fit@example.com")).status, 200);
});

test("settings update is validated and public", async (t) => {
  const s = await start(); t.after(s.close);
  await s.login();
  assert.equal((await s.call("PUT", "/api/admin/settings", { bogus: 1 })).status, 400);
  assert.equal((await s.call("PUT", "/api/admin/settings", { business: { instagram: "http://insecure" } })).status, 400);
  const r = await s.call("PUT", "/api/admin/settings", {
    business: { phone: "941-555-0100", instagram: "https://instagram.com/example" },
    coach: { name: "Coach Example", bio: "NASM certified." },
    testimonials: [{ name: "Jo", quote: "Down 20 lbs." }]
  });
  assert.equal(r.status, 200);
  const pub = (await s.call("GET", "/api/site")).body.settings;
  assert.equal(pub.business.phone, "941-555-0100");
  assert.equal(pub.business.name, "MDFIT SRQ");
  assert.equal(pub.coach.name, "Coach Example");
  assert.equal(pub.testimonials.length, 1);
  assert.equal(pub.packages.length, 3);
});

test("login: wrong password, lockout, bad token, not configured", async (t) => {
  const s = await start(); t.after(s.close);
  assert.equal((await s.call("POST", "/api/admin/login", { email: "coach@example.com", password: "nope" })).status, 401);
  s.setToken("forged.token");
  assert.equal((await s.call("GET", "/api/admin/me")).status, 401);
  s.setToken("");
  for (let i = 0; i < 10; i++) await s.call("POST", "/api/admin/login", { email: "x@example.com", password: "nope" });
  assert.equal((await s.call("POST", "/api/admin/login", { email: "coach@example.com", password: PASSWORD })).status, 429);

  const bare = await start({ adminEmail: "", adminPasswordHash: "" }); t.after(bare.close);
  assert.equal((await bare.call("POST", "/api/admin/login", { email: "a@example.com", password: "x" })).status, 503);
});
