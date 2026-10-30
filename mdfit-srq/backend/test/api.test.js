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
  assert.equal(site.body.settings.business.name, "MD Fit");
  assert.equal(site.body.settings.business.address, "3214 Clark Road, Sarasota, FL 34231");
  assert.ok(site.body.options.areas.includes("Knee"));
  assert.equal(site.body.settings.scheduling, undefined);
  assert.equal(site.headers.get("access-control-allow-origin"), "https://mdfit.example.com");
  const other = await s.call("GET", "/api/site", undefined, { origin: "https://evil.example.com" });
  assert.equal(other.headers.get("access-control-allow-origin"), null);
  assert.equal((await s.call("GET", "/nope")).status, 404);
});

test("class schedule uses starter classes and skips past sessions", async (t) => {
  const s = await start(); t.after(s.close);
  const r = await s.call("GET", "/api/schedule?days=7");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.sessions.map((x) => x.date), ["2026-11-03", "2026-11-05"]);
  const late = await start({ now: () => new Date("2026-11-03T15:00:00Z") }); t.after(late.close); // Tue 10:00 local
  assert.equal((await late.call("GET", "/api/schedule")).body.sessions[0].date, "2026-11-05");
});

test("consultation leads: validation, honeypot, admin workflow, CSV", async (t) => {
  const s = await start(); t.after(s.close);
  assert.equal((await s.call("POST", "/api/leads", { name: "A", email: "x" })).status, 400);
  assert.equal((await s.call("POST", "/api/leads", { name: "Sam Lee", email: "sam@example.com", service: "Yoga" })).status, 400);
  assert.equal((await s.call("POST", "/api/leads", { name: "Sam Lee", email: "sam@example.com", areas: ["Spleen"] })).status, 400);
  assert.equal((await s.call("POST", "/api/leads", { name: "Sam Lee", email: "sam@example.com", painLevel: 11 })).status, 400);
  assert.equal((await s.call("POST", "/api/leads", "not json")).status, 400);
  const ok = await s.call("POST", "/api/leads", { name: "Sam Lee", email: "Sam@Example.com", phone: "(941) 555-0100", service: "Injury rehabilitation", goal: "Get out of pain", areas: ["Knee", "Lower back"], painLevel: "6", duration: "More than 6 months", surgery: "No", message: "=cmd" });
  assert.equal(ok.status, 201);
  const bot = await s.call("POST", "/api/leads", { name: "Bot", email: "bot@example.com", company: "spam inc" });
  assert.equal(bot.status, 201);

  assert.equal((await s.call("GET", "/api/admin/leads")).status, 401);
  await s.login();
  const list = (await s.call("GET", "/api/admin/leads")).body;
  assert.equal(list.length, 1);
  assert.equal(list[0].email, "sam@example.com");
  assert.equal(list[0].status, "new");
  assert.deepEqual(list[0].areas, ["Knee", "Lower back"]);
  assert.equal(list[0].painLevel, 6);
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
  assert.equal(pub.business.name, "MD Fit");
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

test("appointments: availability, notice window, overlap, cancel, admin status", async (t) => {
  const s = await start(); t.after(s.close);
  const av = (await s.call("GET", "/api/availability?type=eval&days=3")).body;
  assert.equal(av.type.id, "eval");
  const byDate = Object.fromEntries(av.days.map((d) => [d.date, d.slots]));
  assert.deepEqual(byDate["2026-11-02"], []); // Monday 05:00 + 12h notice: nothing left today
  assert.equal(byDate["2026-11-03"][0], "09:00");
  assert.equal(byDate["2026-11-03"].at(-1), "16:00"); // 60-min eval must end by 17:00
  assert.equal(byDate["2026-11-03"].length, 15);

  const book = (body) => s.call("POST", "/api/appointments", { typeId: "eval", date: "2026-11-03", time: "10:00", name: "Pat Doe", email: "pat@example.com", phone: "941-555-0100", ...body });
  assert.equal((await book({ phone: "" })).status, 400);
  assert.equal((await book({ typeId: "nope" })).status, 400);
  assert.equal((await book({ time: "08:00" })).status, 409); // before opening
  assert.equal((await book({ date: "2026-11-02", time: "18:00" })).status, 409);
  const ok = await book({});
  assert.equal(ok.status, 201);
  assert.equal(ok.body.message, "You're booked: Initial Evaluation, Tue, Nov 3 at 10:00 AM.");
  assert.equal((await book({ email: "b@example.com", time: "10:30" })).status, 409); // overlaps 10:00-11:00
  assert.equal((await book({ email: "b@example.com", typeId: "call", time: "10:30" })).status, 409); // inside the eval
  const call = await book({ email: "b@example.com", typeId: "call", time: "09:30" }); // 09:30-09:45 fits before it
  assert.equal(call.status, 201);
  const slots = (await s.call("GET", "/api/availability?type=call&from=2026-11-03&days=1")).body.days[0].slots;
  assert.ok(!slots.includes("09:30") && !slots.includes("10:00") && !slots.includes("10:30") && slots.includes("11:00"));

  const { id, cancelToken } = ok.body.appointment;
  assert.equal((await s.call("POST", `/api/appointments/${id}/cancel`, { token: "x" })).status, 404);
  assert.equal((await s.call("POST", `/api/appointments/${id}/cancel`, { token: cancelToken })).status, 200);
  assert.equal((await s.call("POST", `/api/appointments/${id}/cancel`, { token: cancelToken })).status, 404);
  assert.equal((await book({ email: "c@example.com" })).status, 201); // slot freed

  await s.login();
  const list = (await s.call("GET", "/api/admin/appointments")).body;
  assert.equal(list.length, 2);
  assert.equal(list[0].cancelToken, undefined);
  assert.equal(list[0].time, "09:30");
  const upd = await s.call("PATCH", `/api/admin/appointments/${list[0].id}`, { status: "completed", adminNotes: "Left knee, VMO weak" });
  assert.equal(upd.body.status, "completed");
  assert.equal((await s.call("PATCH", `/api/admin/appointments/${list[0].id}`, { status: "maybe" })).status, 400);
  assert.equal((await s.call("GET", "/api/admin/appointments?all=1")).body.length, 3);
  assert.match((await s.call("GET", "/api/admin/appointments.csv")).text, /c@example\.com/);
  const stats = (await s.call("GET", "/api/admin/stats")).body;
  assert.equal(stats.appointmentsWeek, 1); // the call was marked completed, the eval is still booked
});

test("scheduling settings: hours, blocked dates, validation", async (t) => {
  const s = await start(); t.after(s.close);
  await s.login();
  const hours = [[], [], [["08:00", "12:00"], ["13:00", "15:00"]], [], [], [], []];
  assert.equal((await s.call("PUT", "/api/admin/settings", { scheduling: { hours: [[]] } })).status, 400);
  assert.equal((await s.call("PUT", "/api/admin/settings", { scheduling: { hours: [[], [], [["12:00", "09:00"]], [], [], [], []] } })).status, 400);
  assert.equal((await s.call("PUT", "/api/admin/settings", { scheduling: { blockedDates: ["2026-02-30"] } })).status, 400);
  assert.equal((await s.call("PUT", "/api/admin/settings", { appointmentTypes: [{ id: "a", name: "A", minutes: 30 }, { id: "a", name: "B", minutes: 30 }] })).status, 400);
  const r = await s.call("PUT", "/api/admin/settings", {
    scheduling: { hours, slotStepMin: 60, blockedDates: ["2026-11-10"] },
    appointmentTypes: [{ id: "eval", name: "Evaluation", minutes: 60, description: "" }]
  });
  assert.equal(r.status, 200);
  const days = (await s.call("GET", "/api/availability?type=eval&days=10")).body.days;
  const d = Object.fromEntries(days.map((x) => [x.date, x.slots]));
  assert.deepEqual(d["2026-11-03"], ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00"]);
  assert.deepEqual(d["2026-11-10"], []); // blocked
  assert.deepEqual(d["2026-11-04"], []); // closed
});

test("email notifications go to owner and client when configured", async (t) => {
  const http = require("node:http");
  const sent = [];
  const fake = http.createServer((req, res) => {
    let body = ""; req.on("data", (c) => (body += c));
    req.on("end", () => { sent.push({ auth: req.headers.authorization, ...JSON.parse(body) }); res.end("{}"); });
  }).listen(0);
  await new Promise((r) => fake.once("listening", r));
  t.after(() => fake.close());
  const s = await start({
    resendKey: "re_test", resendUrl: `http://127.0.0.1:${fake.address().port}`, notifyFrom: "MD Fit <hello@example.com>",
    notifyEmail: "owner@example.com", siteUrl: "https://mdfit.example.com"
  }); t.after(s.close);
  await s.call("POST", "/api/appointments", { typeId: "eval", date: "2026-11-03", time: "09:00", name: "Pat Doe", email: "pat@example.com", phone: "941-555-0100" });
  await s.call("POST", "/api/leads", { name: "Sam Lee", email: "sam@example.com", areas: ["Neck"], painLevel: 4 });
  for (let i = 0; i < 50 && sent.length < 3; i++) await new Promise((r) => setTimeout(r, 20));
  assert.equal(sent.length, 3);
  assert.equal(sent[0].auth, "Bearer re_test");
  const owner = sent.filter((m) => m.to[0] === "owner@example.com");
  const client = sent.find((m) => m.to[0] === "pat@example.com");
  assert.equal(owner.length, 2);
  assert.match(client.subject, /Initial Evaluation/);
  assert.match(client.text, /https:\/\/mdfit\.example\.com\/cancel\?kind=appointment&id=/);
  assert.ok(owner.some((m) => /Pain: 4\/10/.test(m.text)));
});
