const test = require("node:test");
const assert = require("node:assert");
const { createMongoStore } = require("../lib/store");
const { createApp } = require("../server");
const { hashPassword } = require("../lib/auth");

// In-memory stand-in for the MongoDB collection operations the store uses
function fakeCollection() {
  const docs = new Map();
  let clock = Date.parse("2026-11-04T12:00:00Z");
  const match = (d, f) => Object.entries(f).every(([k, v]) => {
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if ("$in" in v) return v.$in.includes(d[k]);
      if ("$gte" in v) return d[k] >= v.$gte;
      throw new Error("unsupported filter " + JSON.stringify(v));
    }
    return d[k] === v;
  });
  return {
    docs, fail: null,
    find(f) { return { toArray: async () => [...docs.values()].filter((d) => match(d, f)).map((d) => ({ ...d })) }; },
    async insertMany(list) {
      if (this.fail) throw this.fail;
      for (const d of list) { if (docs.has(d._id)) throw new Error("duplicate key " + d._id); docs.set(d._id, { ...d }); }
    },
    async updateOne(f, u, o) {
      if (this.fail) throw this.fail;
      const cur = docs.get(f._id) || (o && o.upsert ? { _id: f._id } : null);
      Object.assign(cur, u.$set);
      for (const k of Object.keys(u.$currentDate || {})) cur[k] = new Date(clock += 1000);
      docs.set(f._id, cur);
    },
    async deleteMany(f) { for (const [id, d] of docs) if (match(d, f)) docs.delete(id); },
  };
}
const chunks = (col, name) => [...col.docs.values()].filter((d) => d.k === "c" && d.name === name);
const KEY = "k".repeat(40);

test("mongo store: reads back writes, encrypts at rest and survives a restart", async () => {
  const col = fakeCollection();
  const a = await createMongoStore({ collection: col, key: KEY, pollMs: 0 });
  a.write("clients", [{ id: 1, name: "Pat" }]);
  const got = a.read("clients", []);
  assert.deepStrictEqual(got, [{ id: 1, name: "Pat" }]);
  got[0].name = "changed";
  assert.strictEqual(a.read("clients", [])[0].name, "Pat", "reads return a fresh copy");
  assert.strictEqual(a.read("missing", "fallback"), "fallback");
  await a.flush();
  assert.ok(chunks(col, "clients")[0].v.startsWith("enc:v1:"), "stored encrypted");
  assert.ok(!JSON.stringify([...col.docs.values()]).includes("Pat"));

  const b = await createMongoStore({ collection: col, key: KEY, pollMs: 0 });
  assert.deepStrictEqual(b.read("clients", []), [{ id: 1, name: "Pat" }]);
});

test("mongo store: large records are split into chunks and replaced versions are removed", async () => {
  const col = fakeCollection();
  const s = await createMongoStore({ collection: col, key: KEY, pollMs: 0, chunkSize: 64 });
  const big = Array.from({ length: 200 }, (_, i) => ({ i, q: "search " + i }));
  s.write("search-events", big);
  s.write("search-events", big.slice(0, 150));
  await s.flush();
  assert.ok(chunks(col, "search-events").length > 1, "split into several chunks");
  const vers = new Set(chunks(col, "search-events").map((c) => c.ver));
  assert.strictEqual(vers.size, 1, "only the current version is kept");
  const again = await createMongoStore({ collection: col, key: KEY, pollMs: 0 });
  assert.deepStrictEqual(again.read("search-events", []), big.slice(0, 150));
});

test("mongo store: a wrong key fails loudly instead of looking empty", async () => {
  const col = fakeCollection();
  const a = await createMongoStore({ collection: col, key: KEY, pollMs: 0 });
  a.write("bookings", [{ id: 7 }]);
  await a.flush();
  const b = await createMongoStore({ collection: col, key: "w".repeat(40), pollMs: 0 });
  assert.throws(() => b.read("bookings", []));
  const c = await createMongoStore({ collection: col, pollMs: 0 });
  assert.throws(() => c.read("bookings", []), /DATA_ENC_KEY is not set/);
});

test("mongo store: an incomplete record stops startup", async () => {
  const col = fakeCollection();
  col.docs.set("h:clients", { _id: "h:clients", k: "h", name: "clients", ver: "v1", n: 2, at: new Date() });
  col.docs.set("c:clients:v1:0", { _id: "c:clients:v1:0", k: "c", name: "clients", ver: "v1", i: 0, v: "[", at: new Date() });
  await assert.rejects(createMongoStore({ collection: col, pollMs: 0 }), /incomplete/);
});

test("mongo store: picks up another instance's saves without overwriting its own unsaved write", async () => {
  const col = fakeCollection();
  let release;
  const held = new Promise((r) => (release = r));
  const slow = { find: (f) => col.find(f), updateOne: (...a) => col.updateOne(...a), deleteMany: (f) => col.deleteMany(f),
    insertMany: async (list) => { await held; return col.insertMany(list); } };
  const oldDeploy = await createMongoStore({ collection: col, key: KEY, pollMs: 0 });
  const newDeploy = await createMongoStore({ collection: slow, key: KEY, pollMs: 0 });
  oldDeploy.write("bookings", [{ id: 1 }]);
  await oldDeploy.flush();
  await newDeploy.sync();
  assert.deepStrictEqual(newDeploy.read("bookings", []), [{ id: 1 }]);

  newDeploy.write("leads", [{ id: "mine" }]);
  oldDeploy.write("leads", [{ id: "theirs" }]);
  await oldDeploy.flush();
  await newDeploy.sync();
  assert.deepStrictEqual(newDeploy.read("leads", []), [{ id: "mine" }], "a save in progress is not replaced");
  release();
  await newDeploy.flush();
  await oldDeploy.sync();
  assert.deepStrictEqual(oldDeploy.read("leads", []), [{ id: "mine" }]);
});

test("mongo store: a failed save is retried", async () => {
  const col = fakeCollection();
  col.fail = new Error("database unavailable");
  const s = await createMongoStore({ collection: col, key: KEY, pollMs: 0 });
  s.write("subscribers", ["a@example.com"]);
  assert.deepStrictEqual(s.read("subscribers", []), ["a@example.com"], "served from memory meanwhile");
  await new Promise((r) => setTimeout(r, 50));
  col.fail = null;
  await s.flush();
  const again = await createMongoStore({ collection: col, key: KEY, pollMs: 0 });
  assert.deepStrictEqual(again.read("subscribers", []), ["a@example.com"]);
});

test("the API runs on the mongo store", async () => {
  const col = fakeCollection();
  const store = await createMongoStore({ collection: col, key: KEY, pollMs: 0 });
  const app = createApp({ adminEmail: "coach@example.com", adminPasswordHash: hashPassword("admin-pass-123"), sessionSecret: "s".repeat(40),
    dataDir: "/nonexistent", origins: ["*"], tz: "America/New_York", siteUrl: "https://mdfit.example.com" }, { store });
  const server = app.listen(0); await new Promise((r) => server.once("listening", r));
  try {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api/site`, { headers: { "user-agent": "Mozilla/5.0 (iPhone) Safari" } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await r.json()).settings.business.name, "MD Fit");
  } finally { server.close(); }
});
