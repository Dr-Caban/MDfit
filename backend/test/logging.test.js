const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { startApi, fakeFacebook, json, logs, ADMIN } = require("./helpers");
const { mask, logger } = require("../lib/logger");

let api, fb;
before(async () => { fb = fakeFacebook(); const url = await fb.start(); api = await startApi({ fbGraphUrl: url, fbVideoUrl: url }); });
after(async () => { await api.stop(); await fb.stop(); });

const settle = () => new Promise((r) => setTimeout(r, 30)); // 'finish' fires after the response

test("mask() hides the local part of emails", () => {
  assert.strictEqual(mask("fan@example.com"), "f**@example.com");
  assert.strictEqual(mask("a@b.co"), "a**@b.co");
});

test("every request logs method, path, status and duration as JSON", async () => {
  logs.length = 0;
  await api.req("/api/health");
  await api.req("/api/nope");
  await settle();
  const reqs = logs.filter((l) => l.msg === "request");
  assert.strictEqual(reqs.length, 2);
  assert.deepStrictEqual({ ...reqs[0], time: 0, ms: 0 }, { time: 0, ms: 0, level: "info", msg: "request", method: "GET", path: "/api/health", status: 200 });
  assert.strictEqual(reqs[1].level, "warn");
  assert.strictEqual(typeof reqs[0].ms, "number");
  assert.ok(!isNaN(Date.parse(reqs[0].time)));
});

test("query strings are never logged", async () => {
  logs.length = 0;
  await api.admin("/api/admin/activity?limit=5&secret=abc");
  await settle();
  assert.ok(logs.some((l) => l.msg === "request" && l.path === "/api/admin/activity"));
  assert.ok(!JSON.stringify(logs).includes("secret=abc"));
});

test("sign-ups log a masked email", async () => {
  logs.length = 0;
  await api.req("/api/subscribe", json({ email: "privatefan@example.com" }));
  await settle();
  const a = logs.find((l) => l.msg === "activity");
  assert.strictEqual(a.type, "subscribe");
  assert.strictEqual(a.email, "p**@example.com");
  assert.ok(!JSON.stringify(logs).includes("privatefan@"));
});

test("failed logins warn without the password; successful logins never log password or token", async () => {
  logs.length = 0;
  await api.login(ADMIN.email, "Guessed-Pass-999");
  const ok = await (await api.login()).json();
  await settle();
  assert.strictEqual(logs.find((l) => l.msg === "admin login failed").level, "warn");
  const all = JSON.stringify(logs);
  for (const secret of ["Guessed-Pass-999", ADMIN.password, ok.token, ADMIN.email]) assert.ok(!all.includes(secret), secret);
  assert.ok(logs.some((l) => l.msg === "activity" && l.type === "login" && l.email === "h**@example.com"));
});

test("session token, Facebook token and captions never appear in logs", async () => {
  logs.length = 0;
  await api.admin("/api/admin/stats");
  await api.admin("/api/facebook/post?caption=" + encodeURIComponent("Top secret caption"), {
    method: "POST", headers: { "Content-Type": "image/png" }, body: Buffer.from("x")
  });
  await settle();
  const all = JSON.stringify(logs);
  assert.ok(logs.some((l) => l.msg === "activity" && l.type === "facebook_post"));
  for (const secret of ["SECRET_FB_TOKEN", "Top secret caption", "Bearer"]) assert.ok(!all.includes(secret), secret);
});

test("server errors are logged at error level with a generic response", async () => {
  logs.length = 0;
  const blocker = path.join(api.dir, "not-a-dir");
  fs.writeFileSync(blocker, "x");
  const { createApp } = require("../server");
  const srv = createApp({ ...api.cfg, dataDir: path.join(blocker, "data") }).listen(0, "127.0.0.1"); // writes fail: parent is a file
  await new Promise((r) => srv.once("listening", r));
  try {
    const r = await fetch(`http://127.0.0.1:${srv.address().port}/api/subscribe`, json({ email: "x@test.com" }));
    assert.strictEqual(r.status, 500);
    assert.deepStrictEqual(await r.json(), { error: "Server error" });
    await settle();
    assert.ok(logs.some((l) => l.level === "error" && l.msg === "unhandled error"));
    assert.ok(logs.some((l) => l.msg === "request" && l.status === 500 && l.level === "error"));
  } finally { srv.close(); }
});

test("LOG_LEVEL filtering", () => {
  const out = [], saved = { level: logger.level, sink: logger.sink };
  logger.sink = (l) => out.push(l);
  logger.level = 30;
  logger.info("hidden"); logger.warn("shown"); logger.error("shown too");
  Object.assign(logger, saved);
  assert.strictEqual(out.length, 2);
});
