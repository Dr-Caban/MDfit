const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { startApi, json, readData, ADMIN, SECRET } = require("./helpers");
const { hashPassword, verifyPassword, signToken, verifyToken, isValidHash } = require("../lib/auth");

let api;
before(async () => { api = await startApi(); });
after(() => api.stop());

const ADMIN_ROUTES = [
  ["GET", "/api/admin/me"], ["GET", "/api/admin/stats"], ["GET", "/api/admin/settings"], ["PUT", "/api/admin/settings"],
  ["GET", "/api/admin/subscribers"], ["DELETE", "/api/admin/subscribers/a%40test.com"], ["GET", "/api/admin/subscribers.csv"],
  ["GET", "/api/admin/activity"], ["GET", "/api/admin/episodes"], ["POST", "/api/admin/episodes"],
  ["PUT", "/api/admin/episodes/x"], ["DELETE", "/api/admin/episodes/x"], ["POST", "/api/facebook/post"]
];

test("hashPassword / verifyPassword", () => {
  const h = hashPassword("Correct Horse 1!");
  assert.ok(isValidHash(h));
  assert.ok(verifyPassword("Correct Horse 1!", h));
  assert.ok(!verifyPassword("correct horse 1!", h));
  assert.ok(!verifyPassword("", h));
  assert.ok(!verifyPassword("x", "not-a-hash"));
  assert.notStrictEqual(hashPassword("same"), hashPassword("same"), "random salt");
});

test("signToken / verifyToken: tamper, wrong secret, expiry", () => {
  const t = signToken({ sub: "a@b.com", exp: Date.now() + 60000 }, SECRET);
  assert.strictEqual(verifyToken(t, SECRET).sub, "a@b.com");
  assert.strictEqual(verifyToken(t, "y".repeat(40)), null);
  const [body, sig] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ sub: "a@b.com", exp: Date.now() + 9e9 })).toString("base64url");
  assert.strictEqual(verifyToken(`${forged}.${sig}`, SECRET), null);
  assert.strictEqual(verifyToken(`${body}.`, SECRET), null);
  assert.strictEqual(verifyToken("garbage", SECRET), null);
  assert.strictEqual(verifyToken(signToken({ sub: "a@b.com", exp: Date.now() - 1 }, SECRET), SECRET), null);
});

test("login succeeds (email is case-insensitive) and returns a 12h token", async () => {
  const r = await api.login(" HOST@Example.com ", ADMIN.password);
  assert.strictEqual(r.status, 200);
  const d = await r.json();
  assert.ok(d.token.includes("."));
  const hours = (Date.parse(d.expires) - Date.now()) / 3600000;
  assert.ok(hours > 11.9 && hours <= 12);
  const me = await api.req("/api/admin/me", { headers: { Authorization: "Bearer " + d.token } });
  assert.deepStrictEqual(await me.json(), { ok: true, email: ADMIN.email, production: false });
  assert.strictEqual(readData(api.dir, "activity")[0].type, "login");
});

test("login rejects wrong password, wrong email, empty and malformed bodies", async () => {
  for (const [e, p] of [[ADMIN.email, "wrong"], ["other@example.com", ADMIN.password], ["", ""], [ADMIN.email, ""]]) {
    const r = await api.login(e, p);
    assert.strictEqual(r.status, 401, `${e}/${p}`);
    assert.deepStrictEqual(await r.json(), { error: "Wrong email or password." });
  }
  assert.strictEqual((await api.req("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" })).status, 400);
});

test("login locks out after 10 failures, even with the right password", async () => {
  const s = await startApi();
  try {
    for (let i = 0; i < 10; i++) assert.strictEqual((await s.login(ADMIN.email, "bad")).status, 401);
    const r = await s.login();
    assert.strictEqual(r.status, 429);
    assert.match((await r.json()).error, /15 minutes/);
  } finally { await s.stop(); }
});

test("a successful login resets the failure count", async () => {
  const s = await startApi();
  try {
    for (let i = 0; i < 9; i++) await s.login(ADMIN.email, "bad");
    assert.strictEqual((await s.login()).status, 200);
    for (let i = 0; i < 9; i++) assert.strictEqual((await s.login(ADMIN.email, "bad")).status, 401);
  } finally { await s.stop(); }
});

test("every admin route rejects missing, malformed, forged and foreign tokens", async () => {
  const foreign = signToken({ sub: ADMIN.email, exp: Date.now() + 60000 }, "z".repeat(40));
  const otherUser = signToken({ sub: "intruder@example.com", exp: Date.now() + 60000 }, SECRET);
  const expired = signToken({ sub: ADMIN.email, exp: Date.now() - 1000 }, SECRET);
  for (const [method, p] of ADMIN_ROUTES) {
    for (const auth of [undefined, "Bearer", "Bearer junk", "Basic abc", `Bearer ${foreign}`, `Bearer ${otherUser}`, `Bearer ${expired}`]) {
      const r = await api.req(p, { method, headers: auth ? { Authorization: auth } : {} });
      assert.strictEqual(r.status, 401, `${method} ${p} with ${auth}`);
    }
  }
});

test("changing SESSION_SECRET logs everyone out", async () => {
  const t = (await (await api.login()).json()).token;
  const s = await startApi({ sessionSecret: "q".repeat(40) });
  try { assert.strictEqual((await s.req("/api/admin/me", { headers: { Authorization: "Bearer " + t } })).status, 401); }
  finally { await s.stop(); }
});

for (const [name, cfg] of [
  ["no ADMIN_EMAIL", { adminEmail: "" }],
  ["bad ADMIN_PASSWORD_HASH", { adminPasswordHash: "plaintext" }],
  ["short SESSION_SECRET", { sessionSecret: "short" }]
]) {
  test(`admin is disabled (503) with ${name}`, async () => {
    const s = await startApi(cfg);
    try {
      assert.strictEqual((await s.login()).status, 503);
      for (const [method, p] of ADMIN_ROUTES) assert.strictEqual((await s.req(p, { method })).status, 503, `${method} ${p}`);
    } finally { await s.stop(); }
  });
}
