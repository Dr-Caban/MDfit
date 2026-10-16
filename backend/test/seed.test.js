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
const runSeed = (env, args = []) => spawnSync(process.execPath, [SEED, ...args], { env: { PATH: process.env.PATH, ...env }, encoding: "utf8" });

test("productionReason detects production", () => {
  assert.match(productionReason({ NODE_ENV: "production" }), /NODE_ENV/);
  assert.match(productionReason({ RAILWAY_ENVIRONMENT_NAME: "production" }), /Railway/);
  assert.match(productionReason({ DATA_DIR: "/data" }), /\/data/);
  assert.match(productionReason({ DATA_DIR: "/data/" }), /\/data/);
  assert.strictEqual(productionReason({ NODE_ENV: "development", DATA_DIR: "/tmp/x" }), "");
  assert.strictEqual(productionReason({ RAILWAY_ENVIRONMENT_NAME: "staging", DATA_DIR: "/tmp/x" }), "");
});

for (const [name, env] of [["NODE_ENV=production", { NODE_ENV: "production" }], ["Railway production", { RAILWAY_ENVIRONMENT_NAME: "production" }], ["DATA_DIR=/data", { DATA_DIR: "/data" }]]) {
  test(`seed refuses with ${name} and writes nothing`, () => {
    const dir = tmp();
    const r = runSeed({ DATA_DIR: dir, ...env });
    assert.strictEqual(r.status, 1);
    assert.match(r.stderr, /Refusing to seed/);
    if (env.DATA_DIR !== "/data") assert.deepStrictEqual(fs.readdirSync(dir), []);
    fs.rmSync(dir, { recursive: true, force: true });
  });
}

test("seed writes local data, no episodes, reserved domains only; no overwrite without --reset", () => {
  const dir = tmp();
  try {
    assert.strictEqual(runSeed({ DATA_DIR: dir }).status, 0);
    const subs = JSON.parse(fs.readFileSync(path.join(dir, "subscribers.json"), "utf8"));
    assert.strictEqual(subs.length, 48);
    assert.strictEqual(new Set(subs.map((s) => s.email)).size, 48);
    for (const s of subs) assert.match(s.email, /^[a-z0-9.]+@example\.(com|net|org)$/);
    const settings = JSON.parse(fs.readFileSync(path.join(dir, "settings.json"), "utf8"));
    assert.strictEqual(settings.meta.seeded, true);
    assert.ok(!fs.existsSync(path.join(dir, "episodes.json")), "no fake episodes");
    assert.strictEqual(runSeed({ DATA_DIR: dir }).status, 1);
    assert.strictEqual(runSeed({ DATA_DIR: dir }, ["--reset"]).status, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("seed is deterministic and recent-heavy over 60 days", () => {
  const now = Date.parse("2026-10-16T12:00:00Z");
  const a = buildSeed(now);
  assert.deepStrictEqual(a, buildSeed(now));
  const ages = a.subscribers.map((s) => (now - Date.parse(s.date)) / 864e5);
  assert.ok(ages.every((d) => d >= 0 && d <= 61));
  assert.ok(ages.filter((d) => d <= 15).length > ages.filter((d) => d > 45).length);
});

test("API serves seeded data and flags it", async () => {
  const api = await startApi();
  try {
    assert.strictEqual(runSeed({ DATA_DIR: api.dir }).status, 0);
    const s = await (await api.admin("/api/admin/stats")).json();
    assert.strictEqual(s.subscribers, 48);
    assert.strictEqual(s.seeded, true);
    const site = await (await api.req("/api/site")).json();
    assert.strictEqual(site.settings.quotes.length, 6);
    assert.strictEqual(site.settings.meta, undefined);
  } finally { await api.stop(); }
});
