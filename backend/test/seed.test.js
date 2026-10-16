const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { buildSeed, productionReason } = require("../scripts/seed");
const { startApi } = require("./helpers");

const SEED = path.join(__dirname, "..", "scripts", "seed.js");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "ls-seed-"));
const runSeed = (env, args = []) => spawnSync(process.execPath, [SEED, ...args], {
  env: { PATH: process.env.PATH, ...env }, encoding: "utf8"
});

test("productionReason detects production", () => {
  assert.match(productionReason({ NODE_ENV: "production" }), /NODE_ENV/);
  assert.match(productionReason({ RAILWAY_ENVIRONMENT_NAME: "production" }), /Railway/);
  assert.match(productionReason({ DATA_DIR: "/data" }), /\/data/);
  assert.match(productionReason({ DATA_DIR: "/data/" }), /\/data/);
  assert.strictEqual(productionReason({ NODE_ENV: "development", DATA_DIR: "/tmp/x" }), "");
  assert.strictEqual(productionReason({ RAILWAY_ENVIRONMENT_NAME: "staging", DATA_DIR: "/tmp/x" }), "");
});

for (const [name, env] of [
  ["NODE_ENV=production", { NODE_ENV: "production" }],
  ["Railway production", { RAILWAY_ENVIRONMENT_NAME: "production" }],
  ["DATA_DIR=/data", { DATA_DIR: "/data" }]
]) {
  test(`seed refuses to run with ${name} and writes nothing`, () => {
    const dir = tmp();
    const r = runSeed({ DATA_DIR: dir, ...env });
    assert.strictEqual(r.status, 1);
    assert.match(r.stderr, /Refusing to seed/);
    if (env.DATA_DIR !== "/data") assert.deepStrictEqual(fs.readdirSync(dir), []);
    fs.rmSync(dir, { recursive: true, force: true });
  });
}

test("seed writes natural-looking local data and won't overwrite without --reset", () => {
  const dir = tmp();
  try {
    const r = runSeed({ DATA_DIR: dir });
    assert.strictEqual(r.status, 0, r.stderr);
    const subs = JSON.parse(fs.readFileSync(path.join(dir, "subscribers.json"), "utf8"));
    assert.strictEqual(subs.length, 48);
    assert.strictEqual(new Set(subs.map((s) => s.email)).size, 48, "unique emails");
    for (const s of subs) assert.match(s.email, /^[a-z0-9.]+@example\.(com|net|org)$/, "only reserved test domains");
    const content = JSON.parse(fs.readFileSync(path.join(dir, "content.json"), "utf8"));
    assert.strictEqual(content.meta.seeded, true);
    assert.deepStrictEqual(content.donate, { goal: 25000, raised: 6250 });

    const again = runSeed({ DATA_DIR: dir });
    assert.strictEqual(again.status, 1);
    assert.match(again.stderr, /--reset/);
    assert.strictEqual(runSeed({ DATA_DIR: dir }, ["--reset"]).status, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("seed is deterministic and spread over the last 60 days, recent-heavy", () => {
  const now = Date.parse("2026-10-16T12:00:00Z");
  const a = buildSeed(now), b = buildSeed(now);
  assert.deepStrictEqual(a, b);
  const ages = a.subscribers.map((s) => (now - Date.parse(s.date)) / 864e5);
  assert.ok(ages.every((d) => d >= 0 && d <= 61));
  assert.ok(ages.filter((d) => d <= 15).length > ages.filter((d) => d > 45).length);
  for (let i = 1; i < a.activity.length; i++) assert.ok(a.activity[i - 1].time >= a.activity[i].time);
});

test("API serves seeded data and flags it", async () => {
  const api = await startApi();
  try {
    assert.strictEqual(runSeed({ DATA_DIR: api.dir }).status, 0);
    const s = await (await api.admin("/api/admin/stats")).json();
    assert.strictEqual(s.subscribers, 48);
    assert.strictEqual(s.seeded, true);
    assert.ok(s.facebookPosts > 0);
    const pub = await (await api.req("/api/content")).json();
    assert.strictEqual(pub.quotes.length, 6);
    assert.strictEqual(pub.meta, undefined, "meta stays private");
  } finally { await api.stop(); }
});
