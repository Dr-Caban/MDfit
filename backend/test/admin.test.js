const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { startApi, json, readData } = require("./helpers");

let api;
before(async () => {
  api = await startApi();
  for (const email of ["a@test.com", "b@test.com", "=cmd@evil.com"]) await api.req("/api/subscribe", json({ email }));
});
after(() => api.stop());

const put = (body) => json(body, "PUT");

test("GET /api/admin/stats", async () => {
  const s = await (await api.admin("/api/admin/stats")).json();
  assert.strictEqual(s.subscribers, 3);
  assert.strictEqual(s.subscribersLast7Days, 3);
  assert.strictEqual(s.episodes, 0);
  assert.strictEqual(s.facebookPosts, 0);
  assert.strictEqual(s.lastFacebookPost, null);
  assert.deepStrictEqual(s.donate, { goal: 0, raised: 0 });
  assert.strictEqual(s.seeded, false);
  assert.strictEqual(s.facebookConfigured, true);
  assert.match(s.feedUrl, /\/rss\.xml$/);
  assert.ok(s.feedIssues.some((i) => /contact email/.test(i)));
  assert.ok(s.feedIssues.some((i) => /at least one episode/.test(i)));
});

test("subscribers: list newest first, CSV with formula escaping, delete", async () => {
  const { subscribers } = await (await api.admin("/api/admin/subscribers")).json();
  assert.strictEqual(subscribers.length, 3);
  for (let i = 1; i < subscribers.length; i++) assert.ok(subscribers[i - 1].date >= subscribers[i].date);

  const csv = await api.admin("/api/admin/subscribers.csv");
  assert.match(csv.headers.get("content-type"), /text\/csv/);
  assert.match(csv.headers.get("content-disposition"), /subscribers\.csv/);
  const text = await csv.text();
  assert.match(text, /^email,date\n/);
  assert.match(text, /\n'=cmd@evil\.com,/);

  assert.strictEqual((await api.admin("/api/admin/subscribers/" + encodeURIComponent("B@Test.com"), { method: "DELETE" })).status, 200);
  assert.strictEqual((await api.admin("/api/admin/subscribers/" + encodeURIComponent("b@test.com"), { method: "DELETE" })).status, 404);
  assert.deepStrictEqual(readData(api.dir, "subscribers").map((s) => s.email).sort(), ["=cmd@evil.com", "a@test.com"]);
  assert.strictEqual(readData(api.dir, "activity")[0].type, "unsubscribe");
});

test("settings: GET returns defaults", async () => {
  const s = await (await api.admin("/api/admin/settings")).json();
  assert.strictEqual(s.show.category, "Comedy");
  assert.strictEqual(s.show.explicit, true);
  assert.strictEqual(s.donate.cashtag, "genocollie");
});

test("settings: invalid input is rejected and nothing is saved", async () => {
  const bad = [
    [{}, /Nothing to update/], [[], /object/], [{ nope: 1 }, /Unknown setting/],
    [{ show: { title: "" } }, /required/], [{ show: { email: "bad" } }, /email/], [{ show: { handle: "has space" } }, /handle/],
    [{ show: { category: "Cooking" } }, /category/], [{ show: { explicit: "yes" } }, /true or false/],
    [{ show: { coverUrl: "http://insecure.com/a.png" } }, /https/],
    [{ links: { spotify: "javascript:alert(1)" } }, /https/], [{ links: { spotify: "not a url" } }, /https/],
    [{ links: { myspace: "https://myspace.com" } }, /Unknown link/],
    [{ donate: null }, /object/], [{ donate: { goal: -1 } }, /number/], [{ donate: { goal: "" } }, /number/],
    [{ donate: { raised: 2e9 } }, /number/], [{ donate: { cashtag: "$1bad" } }, /Cashtag/], [{ donate: { cashtag: "has-dash" } }, /Cashtag/],
    [{ donate: { amounts: [] } }, /between 1 and 6/], [{ donate: { amounts: [0.5] } }, /from 1/],
    [{ donate: { amounts: [1, 2, 3, 4, 5, 6, 7] } }, /between 1 and 6/], [{ donate: { amounts: "5" } }, /between 1 and 6/],
    [{ donate: { paypal: "http://paypal.me/x" } }, /https/],
    [{ quotes: "x" }, /list/], [{ quotes: ["x".repeat(601)] }, /600/],
    [{ clips: ["https://evil.example/video"] }, /TikTok/], [{ clips: "x" }, /list/]
  ];
  for (const [body, msg] of bad) {
    const r = await api.admin("/api/admin/settings", put(body));
    assert.strictEqual(r.status, 400, JSON.stringify(body));
    assert.match((await r.json()).error, msg, JSON.stringify(body));
  }
  assert.throws(() => readData(api.dir, "settings"), "nothing written");
});

test("settings: valid partial updates merge, normalise and show on /api/site", async () => {
  let r = await api.admin("/api/admin/settings", put({
    show: { email: " Host@Example.COM ", handle: "@lonesoulja242", explicit: false },
    links: { spotify: "https://open.spotify.com/show/abc", tiktok: "https://www.tiktok.com/@lonesoulja242" },
    donate: { goal: "25000", raised: 6250.4, cashtag: "$GenoCollie", amounts: [1, 5, 10, 20.555] },
    quotes: [" One ", "", "Two"],
    clips: ["https://youtube.com/shorts/abc123XYZ", " https://www.tiktok.com/@x/video/7400000000000000001 "]
  }));
  assert.strictEqual(r.status, 200);
  const s = await r.json();
  assert.strictEqual(s.show.email, "host@example.com");
  assert.strictEqual(s.show.handle, "@lonesoulja242");
  assert.strictEqual(s.show.explicit, false);
  assert.strictEqual(s.show.title, "Lone Soulja", "untouched fields kept");
  assert.deepStrictEqual(s.donate, { goal: 25000, raised: 6250, cashtag: "GenoCollie", amounts: [1, 5, 10, 20.56], paypal: "", stripe: "", gofundme: "" });
  assert.deepStrictEqual(s.quotes, ["One", "Two"]);
  assert.strictEqual(s.clips.length, 2);

  r = await api.admin("/api/admin/settings", put({ donate: { raised: 7000 }, links: { spotify: "" } }));
  const s2 = await r.json();
  assert.strictEqual(s2.donate.raised, 7000);
  assert.strictEqual(s2.donate.goal, 25000);
  assert.strictEqual(s2.links.spotify, "");
  assert.strictEqual(s2.links.tiktok, "https://www.tiktok.com/@lonesoulja242");

  const site = await (await api.req("/api/site")).json();
  assert.strictEqual(site.settings.donate.raised, 7000);
  assert.deepStrictEqual(site.settings.quotes, ["One", "Two"]);
  assert.strictEqual(readData(api.dir, "activity")[0].type, "settings_update");
});

test("activity: newest first, limit works, capped at 500", async () => {
  const all = (await (await api.admin("/api/admin/activity")).json()).activity;
  assert.ok(all.length >= 5);
  for (let i = 1; i < all.length; i++) assert.ok(all[i - 1].time >= all[i].time);
  assert.strictEqual((await (await api.admin("/api/admin/activity?limit=2")).json()).activity.length, 2);

  const cap = await startApi();
  try {
    fs.writeFileSync(path.join(cap.dir, "activity.json"), JSON.stringify(Array.from({ length: 500 }, () => ({ time: "2000-01-01T00:00:00Z", type: "old" }))));
    await cap.req("/api/subscribe", json({ email: "new@test.com" }));
    const acts = readData(cap.dir, "activity");
    assert.strictEqual(acts.length, 500);
    assert.strictEqual(acts[0].type, "subscribe");
  } finally { await cap.stop(); }
});

test("stats flag seeded data", async () => {
  const s = await startApi();
  try {
    fs.writeFileSync(path.join(s.dir, "settings.json"), JSON.stringify({ meta: { seeded: true } }));
    assert.strictEqual((await (await s.admin("/api/admin/stats")).json()).seeded, true);
    assert.strictEqual((await (await s.req("/api/site")).json()).settings.meta, undefined, "meta never public");
  } finally { await s.stop(); }
});
