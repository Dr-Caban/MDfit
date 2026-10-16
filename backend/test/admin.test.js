const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { startApi, json, readData } = require("./helpers");

let api;
before(async () => {
  api = await startApi();
  for (const email of ["a@test.com", "b@test.com", "=cmd@evil.com"]) await api.req("/api/subscribe", json({ email }));
});
after(() => api.stop());

const ADMIN_ROUTES = [
  ["GET", "/api/admin/me"], ["GET", "/api/admin/stats"], ["GET", "/api/admin/subscribers"],
  ["DELETE", "/api/admin/subscribers/a%40test.com"], ["GET", "/api/subscribers.csv"],
  ["GET", "/api/admin/content"], ["PUT", "/api/admin/content"], ["GET", "/api/admin/activity"], ["POST", "/api/facebook/post"]
];

test("every admin route rejects missing and wrong keys", async () => {
  // fresh server per route so the 10-failure lockout doesn't kick in mid-test
  for (const [method, p] of ADMIN_ROUTES) {
    const s = await startApi();
    try {
      await s.req("/api/subscribe", json({ email: "a@test.com" }));
      assert.strictEqual((await s.req(p, { method })).status, 401, `${method} ${p} no key`);
      assert.strictEqual((await s.req(p, { method, headers: { "X-Admin-Key": "wrong" } })).status, 401, `${method} ${p} wrong key`);
      assert.strictEqual((await s.req(p, { method, headers: { "X-Admin-Key": s.cfg.adminKey + "x" } })).status, 401, `${method} ${p} longer key`);
      assert.strictEqual(readData(s.dir, "subscribers").length, 1, "rejected request changed nothing");
    } finally { await s.stop(); }
  }
});

test("admin routes return 503 when ADMIN_KEY is not set", async () => {
  const noKey = await startApi({ adminKey: "" });
  try {
    for (const [method, p] of ADMIN_ROUTES) {
      assert.strictEqual((await noKey.req(p, { method, headers: { "X-Admin-Key": "" } })).status, 503, `${method} ${p}`);
    }
  } finally { await noKey.stop(); }
});

test("admin lockout after 10 wrong keys, even with the right key", async () => {
  const lock = await startApi();
  try {
    for (let i = 0; i < 10; i++) assert.strictEqual((await lock.req("/api/admin/me", { headers: { "X-Admin-Key": "bad" } })).status, 401);
    assert.strictEqual((await lock.admin("/api/admin/me")).status, 429);
  } finally { await lock.stop(); }
});

test("GET /api/admin/me", async () => {
  const r = await api.admin("/api/admin/me");
  assert.deepStrictEqual(await r.json(), { ok: true, production: false });
});

test("GET /api/admin/stats", async () => {
  const s = await (await api.admin("/api/admin/stats")).json();
  assert.strictEqual(s.subscribers, 3);
  assert.strictEqual(s.subscribersLast7Days, 3);
  assert.strictEqual(s.facebookPosts, 0);
  assert.strictEqual(s.lastFacebookPost, null);
  assert.deepStrictEqual(s.donate, { goal: 0, raised: 0 });
  assert.strictEqual(s.quotes, 0);
  assert.strictEqual(s.seeded, false);
  assert.strictEqual(s.facebookConfigured, true);
});

test("GET /api/admin/subscribers is newest first", async () => {
  const { subscribers } = await (await api.admin("/api/admin/subscribers")).json();
  assert.strictEqual(subscribers.length, 3);
  for (let i = 1; i < subscribers.length; i++) assert.ok(subscribers[i - 1].date >= subscribers[i].date);
});

test("GET /api/subscribers.csv escapes formula cells", async () => {
  const r = await api.admin("/api/subscribers.csv");
  assert.strictEqual(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/csv/);
  assert.match(r.headers.get("content-disposition"), /subscribers\.csv/);
  const text = await r.text();
  assert.match(text, /^email,date\n/);
  assert.match(text, /\n'=cmd@evil\.com,/);
  assert.match(text, /\na@test\.com,/);
});

test("DELETE /api/admin/subscribers/:email", async () => {
  assert.strictEqual((await api.admin("/api/admin/subscribers/" + encodeURIComponent("B@Test.com"), { method: "DELETE" })).status, 200);
  assert.strictEqual((await api.admin("/api/admin/subscribers/" + encodeURIComponent("b@test.com"), { method: "DELETE" })).status, 404);
  assert.deepStrictEqual(readData(api.dir, "subscribers").map((s) => s.email).sort(), ["=cmd@evil.com", "a@test.com"]);
  assert.strictEqual(readData(api.dir, "activity")[0].type, "unsubscribe");
});

const put = (body) => ({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("PUT /api/admin/content validates", async () => {
  const bad = [
    {}, { donate: { goal: -1, raised: 0 } }, { donate: { goal: "abc", raised: 0 } }, { donate: null }, { donate: { goal: 100 } }, { donate: { goal: "", raised: "" } }, { donate: [] },
    { donate: { goal: 2e9, raised: 0 } }, { quotes: "not a list" }, { quotes: ["x".repeat(601)] },
    { quotes: Array.from({ length: 201 }, (_, i) => "q" + i) }
  ];
  for (const b of bad) assert.strictEqual((await api.admin("/api/admin/content", put(b))).status, 400, JSON.stringify(b).slice(0, 60));
  assert.deepStrictEqual(await (await api.req("/api/content")).json(), {}, "nothing saved by bad requests");
});

test("PUT /api/admin/content saves donate + quotes; public /api/content reflects it", async () => {
  const r = await api.admin("/api/admin/content", put({ donate: { goal: 25000, raised: 6250.4 }, quotes: [" One ", "", "Two"] }));
  assert.strictEqual(r.status, 200);
  const pub = await (await api.req("/api/content")).json();
  assert.deepStrictEqual(pub, { donate: { goal: 25000, raised: 6250 }, quotes: ["One", "Two"] });
  // partial update keeps the other field
  await api.admin("/api/admin/content", put({ donate: { goal: 30000, raised: 7000 } }));
  const c = await (await api.admin("/api/admin/content")).json();
  assert.deepStrictEqual(c, { donate: { goal: 30000, raised: 7000 }, quotes: ["One", "Two"] });
  const s = await (await api.admin("/api/admin/stats")).json();
  assert.strictEqual(s.quotes, 2);
});

test("GET /api/admin/activity is newest first and honours limit", async () => {
  const all = (await (await api.admin("/api/admin/activity")).json()).activity;
  assert.ok(all.length >= 5);
  assert.strictEqual(all[0].type, "content_update");
  for (let i = 1; i < all.length; i++) assert.ok(all[i - 1].time >= all[i].time);
  assert.strictEqual((await (await api.admin("/api/admin/activity?limit=2")).json()).activity.length, 2);
  assert.ok((await (await api.admin("/api/admin/activity?limit=abc")).json()).activity.length >= 5);
});

test("activity log is capped at 500 entries", async () => {
  const cap = await startApi();
  try {
    const big = Array.from({ length: 500 }, (_, i) => ({ time: new Date(0).toISOString(), type: "old", n: i }));
    fs.writeFileSync(path.join(cap.dir, "activity.json"), JSON.stringify(big));
    await cap.req("/api/subscribe", json({ email: "new@test.com" }));
    const acts = readData(cap.dir, "activity");
    assert.strictEqual(acts.length, 500);
    assert.strictEqual(acts[0].type, "subscribe");
  } finally { await cap.stop(); }
});

test("stats flag seeded data", async () => {
  const s = await startApi();
  try {
    fs.writeFileSync(path.join(s.dir, "content.json"), JSON.stringify({ meta: { seeded: true } }));
    assert.strictEqual((await (await s.admin("/api/admin/stats")).json()).seeded, true);
  } finally { await s.stop(); }
});
