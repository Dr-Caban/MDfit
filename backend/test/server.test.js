const { test, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Fake Facebook Graph API
let fbCalls = [];
const fake = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    fbCalls.push({ url: req.url, body: Buffer.concat(chunks).toString("latin1") });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(req.url.endsWith("/photos") ? { id: "1", post_id: "page_1" } : { id: "vid_1" }));
  });
});

let server, base;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ls-"));

before(async () => {
  await new Promise((r) => fake.listen(0, r));
  const fb = `http://127.0.0.1:${fake.address().port}`;
  Object.assign(process.env, {
    ADMIN_KEY: "secret-key", FB_PAGE_ID: "123", FB_PAGE_ACCESS_TOKEN: "tok",
    FB_GRAPH_URL: fb, FB_VIDEO_URL: fb, DATA_DIR: tmp, ALLOWED_ORIGINS: "https://site.vercel.app",
  });
  const app = require("../server");
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => { server.close(); fake.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

test("health", async () => {
  const r = await fetch(base + "/api/health");
  assert.deepStrictEqual(await r.json(), { ok: true });
});

test("CORS allows only configured origin", async () => {
  const ok = await fetch(base + "/api/health", { headers: { Origin: "https://site.vercel.app" } });
  assert.strictEqual(ok.headers.get("access-control-allow-origin"), "https://site.vercel.app");
  const bad = await fetch(base + "/api/health", { headers: { Origin: "https://evil.com" } });
  assert.strictEqual(bad.headers.get("access-control-allow-origin"), null);
  const pre = await fetch(base + "/api/facebook/post", { method: "OPTIONS", headers: { Origin: "https://site.vercel.app" } });
  assert.strictEqual(pre.status, 204);
});

test("subscribe validates, saves, dedupes", async () => {
  const post = (email) => fetch(base + "/api/subscribe", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
  });
  assert.strictEqual((await post("nope")).status, 400);
  assert.strictEqual((await post("Fan@Example.com")).status, 200);
  assert.strictEqual((await post("fan@example.com")).status, 200);
  const saved = JSON.parse(fs.readFileSync(path.join(tmp, "subscribers.json"), "utf8"));
  assert.strictEqual(saved.length, 1);
  assert.strictEqual(saved[0].email, "fan@example.com");
});

test("subscriber CSV needs admin key", async () => {
  assert.strictEqual((await fetch(base + "/api/subscribers.csv")).status, 401);
  const r = await fetch(base + "/api/subscribers.csv", { headers: { "X-Admin-Key": "secret-key" } });
  assert.strictEqual(r.status, 200);
  assert.match(await r.text(), /fan@example\.com/);
});

test("facebook status", async () => {
  const r = await fetch(base + "/api/facebook/status");
  assert.deepStrictEqual(await r.json(), { configured: true, adminKeySet: true });
});

test("facebook post rejects wrong key", async () => {
  const r = await fetch(base + "/api/facebook/post", {
    method: "POST", headers: { "X-Admin-Key": "wrong", "Content-Type": "image/png" }, body: Buffer.from("x"),
  });
  assert.strictEqual(r.status, 401);
  assert.strictEqual(fbCalls.length, 0);
});

test("facebook post rejects non-media", async () => {
  const r = await fetch(base + "/api/facebook/post", {
    method: "POST", headers: { "X-Admin-Key": "secret-key", "Content-Type": "text/plain" }, body: "hi",
  });
  assert.strictEqual(r.status, 400);
});

test("facebook photo post", async () => {
  fbCalls = [];
  const r = await fetch(base + "/api/facebook/post?caption=" + encodeURIComponent("I said what I said"), {
    method: "POST", headers: { "X-Admin-Key": "secret-key", "Content-Type": "image/png" }, body: Buffer.from("PNGDATA"),
  });
  assert.deepStrictEqual(await r.json(), { ok: true, id: "page_1" });
  assert.strictEqual(fbCalls[0].url, "/v26.0/123/photos");
  assert.match(fbCalls[0].body, /name="message"\r\n\r\nI said what I said/);
  assert.match(fbCalls[0].body, /PNGDATA/);
  assert.match(fbCalls[0].body, /name="access_token"\r\n\r\ntok/);
});

test("facebook video post", async () => {
  fbCalls = [];
  const r = await fetch(base + "/api/facebook/post?caption=clip", {
    method: "POST", headers: { "X-Admin-Key": "secret-key", "Content-Type": "video/mp4" }, body: Buffer.from("MP4DATA"),
  });
  assert.deepStrictEqual(await r.json(), { ok: true, id: "vid_1" });
  assert.strictEqual(fbCalls[0].url, "/v26.0/123/videos");
  assert.match(fbCalls[0].body, /name="description"\r\n\r\nclip/);
  assert.match(fbCalls[0].body, /filename="lone-soulja\.mp4"/);
});
