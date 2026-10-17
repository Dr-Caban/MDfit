const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { startApi, json, readData } = require("./helpers");

let api;
before(async () => { api = await startApi(); });
after(() => api.stop());

test("GET / and /api/health", async () => {
  assert.deepStrictEqual(await (await api.req("/")).json(), { name: "Lone Soulja API", ok: true });
  const r = await api.req("/api/health");
  assert.deepStrictEqual(await r.json(), { ok: true });
  assert.strictEqual(r.headers.get("x-content-type-options"), "nosniff");
  assert.strictEqual(r.headers.get("x-powered-by"), null);
});

test("GET /api/site returns real defaults: no placeholder episodes or links", async () => {
  const r = await api.req("/api/site");
  assert.strictEqual(r.headers.get("cache-control"), "no-cache");
  const d = await r.json();
  assert.deepStrictEqual(d.episodes, []);
  assert.strictEqual(d.settings.show.title, "Lone Soulja");
  assert.strictEqual(d.settings.donate.venmoHandle, "");
  assert.deepStrictEqual(d.settings.donate.amounts, [1, 5, 10]);
  assert.ok(Object.values(d.settings.links).every((v) => v === ""), "no fake platform links");
  assert.strictEqual(d.settings.show.email, "");
  assert.strictEqual(d.settings.meta, undefined);
  assert.match(d.feedUrl, /^http:\/\/127\.0\.0\.1:\d+\/rss\.xml$/);
});

test("GET /api/facebook/status", async () => {
  assert.deepStrictEqual(await (await api.req("/api/facebook/status")).json(), { configured: true });
  const nofb = await startApi({ fbPageId: "", fbToken: "" });
  try { assert.deepStrictEqual(await (await nofb.req("/api/facebook/status")).json(), { configured: false }); }
  finally { await nofb.stop(); }
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
  assert.deepStrictEqual(subs.map((s) => s.email), ["fan@example.com"]);
  assert.strictEqual(readData(api.dir, "activity").filter((a) => a.type === "subscribe").length, 1);
});

test("POST /api/subscribe is rate limited per IP (10/hour)", async () => {
  const fresh = await startApi();
  try {
    for (let i = 0; i < 10; i++) assert.strictEqual((await fresh.req("/api/subscribe", json({ email: `u${i}@test.com` }))).status, 200);
    assert.strictEqual((await fresh.req("/api/subscribe", json({ email: "u11@test.com" }))).status, 429);
  } finally { await fresh.stop(); }
});

test("CORS: allowed origin gets headers incl. Authorization; others don't", async () => {
  const ok = await api.req("/api/health", { headers: { Origin: "https://site.vercel.app" } });
  assert.strictEqual(ok.headers.get("access-control-allow-origin"), "https://site.vercel.app");
  assert.match(ok.headers.get("access-control-allow-methods"), /PUT.*DELETE/);
  assert.match(ok.headers.get("access-control-allow-headers"), /Authorization/);
  const bad = await api.req("/api/health", { headers: { Origin: "https://evil.example" } });
  assert.strictEqual(bad.headers.get("access-control-allow-origin"), null);
  assert.strictEqual((await api.req("/api/admin/settings", { method: "OPTIONS", headers: { Origin: "https://site.vercel.app" } })).status, 204);
});

test("unknown route returns JSON 404", async () => {
  const r = await api.req("/api/nope");
  assert.strictEqual(r.status, 404);
  assert.deepStrictEqual(await r.json(), { error: "Not found" });
});
