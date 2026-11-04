const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), os = require("os"), path = require("path"), zlib = require("zlib");
const { createApp } = require("../server");
const { hashPassword } = require("../lib/auth");
const { createStore } = require("../lib/store");

const KEY = "k".repeat(40);
const pack = (list) => zlib.gzipSync(JSON.stringify(list)).toString("base64");
const exported = [
  { id: "aaaaaaaaaaaa", name: "Pat Example", email: "Pat@Example.com", phone: "(941) 555-0100", createdAt: "2026-11-02T10:00:00.000Z", lastLoginAt: "2026-11-03T10:00:00.000Z" },
  { id: "bbbbbbbbbbbb", name: "Sam Example", email: "sam@example.com", phone: "not a phone", createdAt: "2026-11-02T11:00:00.000Z" },
  { id: "cccccccccccc", name: "Bad", email: "not-an-email" },
];

async function start(dataDir, clientImport) {
  const app = createApp({ adminEmail: "coach@example.com", adminPasswordHash: hashPassword("admin-pass-123"), sessionSecret: "s".repeat(40),
    dataDir, dataKey: KEY, origins: ["*"], tz: "America/New_York", siteUrl: "https://mdfit.example.com", clientImport });
  const server = app.listen(0); await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (url, body) => {
    const r = await fetch(base + url, { method: "POST", headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0 (iPhone) Safari" }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => undefined) };
  };
  return { call, close: () => server.close() };
}

test("CLIENT_IMPORT adds exported clients once, without passwords", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mdfit-import-"));
  const store = createStore(dataDir, { key: KEY });
  store.write("clients", [{ id: "dddddddddddd", email: "sam@example.com", name: "Sam Already", passwordHash: null, pwv: 0, painLog: [] }]);
  try {
    const a = await start(dataDir, pack(exported));
    let list = store.read("clients", []);
    assert.strictEqual(list.length, 2, "one added, existing email and bad email skipped");
    const pat = list.find((c) => c.email === "pat@example.com");
    assert.strictEqual(pat.id, "aaaaaaaaaaaa");
    assert.strictEqual(pat.phone, "(941) 555-0100");
    assert.strictEqual(pat.passwordHash, null);
    assert.strictEqual(pat.createdAt, "2026-11-02T10:00:00.000Z");
    assert.match(pat.referralCode, /^MDFIT-[0-9A-F]{6}$/);
    assert.strictEqual(list.find((c) => c.email === "sam@example.com").name, "Sam Already");

    assert.strictEqual((await a.call("/api/clients/login", { email: "pat@example.com", password: "whatever123" })).status, 401);
    assert.strictEqual((await a.call("/api/clients/forgot", { email: "pat@example.com" })).status, 200);
    a.close();

    store.write("clients", store.read("clients", []).filter((c) => c.email !== "pat@example.com"));
    const b = await start(dataDir, pack(exported));
    assert.ok(!store.read("clients", []).some((c) => c.email === "pat@example.com"), "the same payload is not applied twice");
    b.close();
  } finally { fs.rmSync(dataDir, { recursive: true, force: true }); }
});

test("a broken CLIENT_IMPORT is logged and the API still starts", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mdfit-import-"));
  try {
    const a = await start(dataDir, "not base64 gzip");
    try { assert.strictEqual((await a.call("/api/clients/forgot", { email: "x@example.com" })).status, 200); } finally { a.close(); }
  } finally { fs.rmSync(dataDir, { recursive: true, force: true }); }
});
