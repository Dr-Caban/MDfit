const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), os = require("os"), path = require("path");
const { createStore } = require("../lib/store");
const { createAudit } = require("../lib/audit");
const { createApp } = require("../server");
const { hashPassword } = require("../lib/auth");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "mdfit-audit-"));

test("ledger: hash chain + Ed25519 signatures verify; tampering, deletion and truncation are caught", () => {
  const dir = tmp(), store = createStore(dir, { key: "k".repeat(32) });
  let t = Date.parse("2026-10-31T23:58:00Z");
  const a = createAudit({ store, now: () => new Date((t += 30000)) });
  for (let i = 0; i < 5; i++) a.record({ actor: "admin:coach@example.com", action: "admin.view /clients/:id", subject: "c" + i, ip: "203.0.113.9" });
  let v = a.verify();
  assert.equal(v.ok, true); assert.equal(v.entries, 5);
  const months = JSON.parse(JSON.stringify(createStore(dir, { key: "k".repeat(32) }).read("audit-state", {}))).months;
  assert.deepEqual(months, ["2026-10", "2026-11"], "spans months");
  assert.ok(!fs.readFileSync(path.join(dir, "audit-2026-11.json"), "utf8").includes("coach@example.com"), "encrypted at rest");
  // a fresh instance (same store) keeps the same key and chain
  const a2 = createAudit({ store });
  assert.equal(a2.fingerprint, a.fingerprint);
  a2.record({ actor: "client:c1", action: "client./pain", subject: "c1" });
  assert.equal(a2.verify().ok, true);
  // tamper: change who viewed a record
  const nov = store.read("audit-2026-11", []);
  const orig = JSON.parse(JSON.stringify(nov));
  nov[0].subject = "someone-else"; store.write("audit-2026-11", nov);
  v = a2.verify(); assert.equal(v.ok, false); assert.match(v.error, /altered/);
  // tamper with hash too (re-hash without the key): signature fails
  const { hashOf } = require("../lib/audit"); nov[0].hash = hashOf(nov[0]); store.write("audit-2026-11", nov);
  v = a2.verify(); assert.equal(v.ok, false);
  // delete an entry
  store.write("audit-2026-11", orig.filter((_, i) => i !== 1));
  v = a2.verify(); assert.equal(v.ok, false); assert.match(v.error, /missing or out of order/);
  // truncate the newest entry
  store.write("audit-2026-11", orig.slice(0, -1));
  v = a2.verify(); assert.equal(v.ok, false); assert.match(v.error, /truncated/);
  store.write("audit-2026-11", orig);
  assert.equal(a2.verify().ok, true, "restored copy verifies again");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("server records logins, failed logins and every admin look at a patient", async (t) => {
  const dataDir = tmp();
  const app = createApp({ adminEmail: "coach@example.com", adminPasswordHash: hashPassword("admin-pass-123"), sessionSecret: "s".repeat(40),
    dataDir, origins: ["*"], tz: "America/New_York", now: () => new Date("2026-11-02T10:00:00Z"), siteUrl: "https://x" });
  const server = app.listen(0); await new Promise((r) => server.once("listening", r));
  t.after(() => { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (m, u, b, tok) => { const r = await fetch(base + u, { method: m, headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) }, body: b && JSON.stringify(b) }); return { status: r.status, body: await r.json().catch(() => undefined) }; };
  await call("POST", "/api/admin/login", { email: "coach@example.com", password: "wrong-password" });
  const adm = (await call("POST", "/api/admin/login", { email: "coach@example.com", password: "admin-pass-123" })).body.token;
  const ctok = (await call("POST", "/api/clients/signup", { name: "Pat Doe", email: "pat@example.com", password: "pat-pass-123" })).body.token;
  await call("POST", "/api/me/pain", { area: "Neck", level: 4 }, ctok);
  const me = (await call("GET", "/api/me", undefined, ctok)).body.client;
  await call("GET", `/api/admin/clients/${me.id}`, undefined, adm);
  await new Promise((r) => setTimeout(r, 50));
  const log = (await call("GET", "/api/admin/audit", undefined, adm)).body;
  const acts = log.entries.map((e) => e.action);
  for (const a of ["auth.admin.login_failed", "auth.admin.login", "auth.client.signup", "client./pain", "admin.view /clients/:id"]) assert.ok(acts.includes(a), a);
  const view = log.entries.find((e) => e.action === "admin.view /clients/:id");
  assert.equal(view.actor, "admin:coach@example.com"); assert.equal(view.subject, me.id);
  assert.ok(!JSON.stringify(log.entries).includes("127.0.0.1"), "IPs are stored hashed");
  assert.match(log.publicKey, /BEGIN PUBLIC KEY/);
  const v = (await call("GET", "/api/admin/audit/verify", undefined, adm)).body;
  assert.equal(v.ok, true); assert.ok(v.entries >= 5);
});

test("admin MFA: code required after enabling, replay blocked, recovery codes work once, disable needs both", async (t) => {
  const totp = require("../lib/totp");
  const dataDir = tmp(); let nowMs = Date.parse("2026-11-02T10:00:00Z");
  const app = createApp({ adminEmail: "coach@example.com", adminPasswordHash: hashPassword("admin-pass-123"), sessionSecret: "s".repeat(40),
    dataDir, origins: ["*"], tz: "America/New_York", now: () => new Date(nowMs), siteUrl: "https://x" });
  const server = app.listen(0); await new Promise((r) => server.once("listening", r));
  t.after(() => { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (m, u, b, tok) => { const r = await fetch(base + u, { method: m, headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) }, body: b && JSON.stringify(b) }); return { status: r.status, body: await r.json().catch(() => undefined) }; };
  const login = (code) => call("POST", "/api/admin/login", { email: "coach@example.com", password: "admin-pass-123", ...(code ? { code } : {}) });
  const tok = (await login()).body.token;
  const setup = (await call("POST", "/api/admin/mfa/setup", {}, tok)).body;
  assert.match(setup.uri, /^otpauth:\/\/totp\/MD%20Fit:coach%40example\.com\?secret=/);
  const secret = setup.secret.replace(/\s/g, "");
  assert.equal((await call("POST", "/api/admin/mfa/enable", { code: "000000" }, tok)).status, 400);
  const en = await call("POST", "/api/admin/mfa/enable", { code: totp.codeAt(secret, Math.floor(nowMs / 30000)) }, tok);
  assert.equal(en.body.enabled, true); assert.equal(en.body.recovery.length, 8);
  let r = await login(); assert.equal(r.status, 401); assert.equal(r.body.mfaRequired, true);
  nowMs += 60000;
  const code = totp.codeAt(secret, Math.floor(nowMs / 30000));
  assert.equal((await login(code)).status, 200);
  assert.equal((await login(code)).status, 401, "the same code can't be used twice");
  const rc = en.body.recovery[0];
  assert.equal((await login(rc)).status, 200, "recovery code works");
  assert.equal((await login(rc)).status, 401, "recovery code is single-use");
  assert.equal((await call("GET", "/api/admin/mfa", undefined, tok)).body.recoveryLeft, 7);
  assert.equal((await call("POST", "/api/admin/mfa/disable", { password: "wrong", code: en.body.recovery[1] }, tok)).status, 401);
  assert.equal((await call("POST", "/api/admin/mfa/disable", { password: "admin-pass-123", code: en.body.recovery[1] }, tok)).status, 200);
  assert.equal((await login()).status, 200, "back to password only");
});

test("audit anchors detect a fully rebuilt chain; key rotation keeps old entries verifiable", () => {
  const crypto = require("crypto");
  const dir = tmp(), store = createStore(dir, { key: "k".repeat(32) });
  const a = createAudit({ store });
  for (let i = 0; i < 3; i++) a.record({ actor: "admin:coach@example.com", action: "admin.view /clients/:id", subject: "c" + i });
  const anchor = a.anchor();
  assert.equal(anchor.seq, 3);
  assert.equal(a.anchor(), null, "no duplicate anchor when nothing changed");
  assert.equal(a.checkAnchor(3, anchor.head).ok, true);
  // Attacker with full server access rebuilds the chain from scratch (new key, different history): it verifies on its own...
  const dir2 = tmp(), store2 = createStore(dir2, { key: "k".repeat(32) });
  const forged = createAudit({ store: store2 });
  for (let i = 0; i < 3; i++) forged.record({ actor: "admin:coach@example.com", action: "admin.view /clients/:id", subject: "nobody" });
  assert.equal(forged.verify().ok, true);
  // ...but the anchor emailed to the owner exposes it
  assert.equal(forged.checkAnchor(3, anchor.head).ok, false);
  // Rotate to a key held outside the store: old entries still verify, new ones use the new key id
  const newKey = crypto.generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" });
  const b = createAudit({ store, signingKey: Buffer.from(newKey).toString("base64") });
  assert.notEqual(b.fingerprint, a.fingerprint);
  const e = b.record({ actor: "system", action: "audit.key_rotated", meta: { from: a.fingerprint, to: "new" } });
  assert.equal(e.kid, b.fingerprint);
  assert.equal(b.verify().ok, true);
  fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(dir2, { recursive: true, force: true });
});
