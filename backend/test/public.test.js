const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { startApi, json, readData } = require("./helpers");

let api;
before(async () => { api = await startApi(); });
after(() => api.stop());

test("GET / returns API name", async () => {
  const r = await api.req("/");
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(await r.json(), { name: "Lone Soulja API", ok: true });
});

test("GET /api/health", async () => {
  const r = await api.req("/api/health");
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(await r.json(), { ok: true });
  assert.strictEqual(r.headers.get("x-content-type-options"), "nosniff");
  assert.strictEqual(r.headers.get("x-powered-by"), null);
});

test("GET /api/content is empty before the admin sets anything", async () => {
  assert.deepStrictEqual(await (await api.req("/api/content")).json(), {});
});

test("GET /api/facebook/status", async () => {
  assert.deepStrictEqual(await (await api.req("/api/facebook/status")).json(), { configured: true, adminKeySet: true });
});

test("POST /api/subscribe validates input", async () => {
  for (const email of ["", "nope", "a@b", "a b@c.com", "x".repeat(250) + "@a.com"]) {
    const r = await api.req("/api/subscribe", json({ email }));
    assert.strictEqual(r.status, 400, email);
    assert.strictEqual((await r.json()).error, "Please enter a valid email.");
  }
  assert.strictEqual((await api.req("/api/subscribe", json({}))).status, 400);
});

test("POST /api/subscribe rejects malformed JSON without leaking details", async () => {
  const r = await api.req("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{bad" });
  assert.strictEqual(r.status, 400);
  assert.deepStrictEqual(await r.json(), { error: "Bad request." });
});

test("POST /api/subscribe saves, lowercases and dedupes", async () => {
  assert.strictEqual((await api.req("/api/subscribe", json({ email: "  Fan@Example.com " }))).status, 200);
  assert.strictEqual((await api.req("/api/subscribe", json({ email: "fan@example.com" }))).status, 200);
  const subs = readData(api.dir, "subscribers");
  assert.strictEqual(subs.length, 1);
  assert.strictEqual(subs[0].email, "fan@example.com");
  assert.ok(!isNaN(Date.parse(subs[0].date)));
  const acts = readData(api.dir, "activity");
  assert.strictEqual(acts.filter((a) => a.type === "subscribe").length, 1, "duplicate sign-up is not logged twice");
});

test("POST /api/subscribe is rate limited per IP (10/hour)", async () => {
  // earlier tests in this file used 9 requests; fresh instance to count precisely
  const fresh = await startApi();
  try {
    for (let i = 0; i < 10; i++) assert.strictEqual((await fresh.req("/api/subscribe", json({ email: `u${i}@test.com` }))).status, 200);
    const r = await fresh.req("/api/subscribe", json({ email: "u11@test.com" }));
    assert.strictEqual(r.status, 429);
  } finally { await fresh.stop(); }
});

test("CORS: allowed origin gets headers, others do not", async () => {
  const ok = await api.req("/api/health", { headers: { Origin: "https://site.vercel.app" } });
  assert.strictEqual(ok.headers.get("access-control-allow-origin"), "https://site.vercel.app");
  assert.match(ok.headers.get("access-control-allow-methods"), /PUT/);
  assert.match(ok.headers.get("access-control-allow-methods"), /DELETE/);
  assert.match(ok.headers.get("access-control-allow-headers"), /X-Admin-Key/);
  const bad = await api.req("/api/health", { headers: { Origin: "https://evil.example" } });
  assert.strictEqual(bad.headers.get("access-control-allow-origin"), null);
});

test("CORS preflight returns 204", async () => {
  const r = await api.req("/api/admin/content", { method: "OPTIONS", headers: { Origin: "https://site.vercel.app" } });
  assert.strictEqual(r.status, 204);
});

test("unknown route returns JSON 404", async () => {
  const r = await api.req("/api/nope");
  assert.strictEqual(r.status, 404);
  assert.deepStrictEqual(await r.json(), { error: "Not found" });
});
