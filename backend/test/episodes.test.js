const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { startApi, fakeFacebook, fakeMedia, json, readData } = require("./helpers");

let api, fb, media, M;
before(async () => {
  fb = fakeFacebook(); media = fakeMedia();
  const fbUrl = await fb.start();
  M = await media.start();
  api = await startApi({ fbGraphUrl: fbUrl, fbVideoUrl: fbUrl });
});
after(async () => { await api.stop(); await fb.stop(); await media.stop(); });

const publish = (body, a = api) => a.admin("/api/admin/episodes", json(body));
const base = () => ({ title: "Savage But Blessed", description: "Episode one.", audioUrl: `${M}/ep.mp3`, platforms: ["website", "podcast"] });

test("publish to website + podcast apps: probes the audio for size and type", async () => {
  const r = await publish({ ...base(), duration: "52:10" });
  assert.strictEqual(r.status, 201);
  const { episode, results } = await r.json();
  assert.strictEqual(episode.number, 1);
  assert.strictEqual(episode.audioBytes, 123456);
  assert.strictEqual(episode.audioType, "audio/mpeg");
  assert.strictEqual(episode.duration, 3130);
  assert.strictEqual(episode.explicit, true, "defaults to the show setting");
  assert.deepStrictEqual(episode.platforms, ["website", "podcast"]);
  assert.deepStrictEqual(results.website, { ok: true });
  assert.ok(results.podcast.ok && /\/rss\.xml$/.test(results.podcast.feedUrl));
  assert.strictEqual(results.facebook, undefined);
  assert.strictEqual(readData(api.dir, "activity")[0].type, "episode_published");
});

test("episode numbers auto-increment; explicit number and season are kept", async () => {
  const a = await (await publish(base())).json();
  assert.strictEqual(a.episode.number, 2);
  const b = await (await publish({ ...base(), number: 10, season: 2 })).json();
  assert.strictEqual(b.episode.number, 10);
  assert.strictEqual(b.episode.season, 2);
  assert.strictEqual((await (await publish(base())).json()).episode.number, 11);
});

test("audio hosts: redirects, no-HEAD (Range fallback), octet-stream .mp3", async () => {
  assert.strictEqual((await (await publish({ ...base(), audioUrl: `${M}/redirect.mp3` })).json()).episode.audioBytes, 123456);
  const nohead = (await (await publish({ ...base(), audioUrl: `${M}/nohead.mp3` })).json()).episode;
  assert.strictEqual(nohead.audioBytes, 987654);
  const octet = (await (await publish({ ...base(), audioUrl: `${M}/octet.mp3` })).json()).episode;
  assert.strictEqual(octet.audioType, "audio/mpeg");
  assert.strictEqual(octet.audioBytes, 5555);
});

test("bad audio links are rejected with a clear message and nothing is saved", async () => {
  const before = readData(api.dir, "episodes").length;
  for (const [audioUrl, msg] of [
    [`${M}/page.html`, /isn't an audio file/], [`${M}/octet.bin`, /isn't an audio file/],
    [`${M}/missing.mp3`, /error \(404\)/], ["http://127.0.0.1:9/x.mp3", /Couldn't reach/],
    ["ftp://x.com/a.mp3", /https/], ["not a link", /https/], ["", /required/]
  ]) {
    const r = await publish({ ...base(), audioUrl });
    assert.strictEqual(r.status, 400, audioUrl);
    assert.match((await r.json()).error, msg, audioUrl);
  }
  assert.strictEqual(readData(api.dir, "episodes").length, before);
});

test("production requires https audio", async () => {
  const prod = await startApi({ allowHttpMedia: false });
  try {
    const r = await publish(base(), prod);
    assert.strictEqual(r.status, 400);
    assert.match((await r.json()).error, /https/);
  } finally { await prod.stop(); }
});

test("episode image is checked to be an image", async () => {
  assert.strictEqual((await publish({ ...base(), imageUrl: `${M}/cover.png` })).status, 201);
  const r = await publish({ ...base(), imageUrl: `${M}/ep.mp3` });
  assert.strictEqual(r.status, 400);
  assert.match((await r.json()).error, /isn't an image/);
  // production: https only for the image too (checked directly, since the http audio would fail first)
  const { episodeInput } = require("../lib/validate");
  assert.throws(() => episodeInput({ ...base(), audioUrl: "https://cdn.example.com/a.mp3", imageUrl: "http://cdn.example.com/c.png" }), /Episode image link must start with https/);
  assert.doesNotThrow(() => episodeInput({ ...base(), audioUrl: "https://cdn.example.com/a.mp3", imageUrl: "https://cdn.example.com/c.png" }));
});

test("validation: title, description, duration, platforms, numbers", async () => {
  for (const [patch, msg] of [
    [{ title: "" }, /Title is required/], [{ title: "x".repeat(201) }, /too long/], [{ description: "" }, /Description/],
    [{ duration: "abc" }, /Duration/], [{ duration: "1:75:00" }, /Duration/], [{ duration: "10:61" }, /Duration/],
    [{ platforms: [] }, /website, podcast apps, or both/], [{ platforms: ["facebook"] }, /website, podcast apps, or both/],
    [{ platforms: ["spotify"] }, /Unknown platform/], [{ platforms: "website" }, /Unknown platform/],
    [{ number: 0 }, /Episode number/], [{ explicit: "no" }, /true or false/]
  ]) {
    const r = await publish({ ...base(), ...patch });
    assert.strictEqual(r.status, 400, JSON.stringify(patch));
    assert.match((await r.json()).error, msg, JSON.stringify(patch));
  }
  for (const [d, sec] of [["45:30", 2730], ["1:02:03", 3723], ["2530", 2530], ["", 0]]) {
    assert.strictEqual((await (await publish({ ...base(), duration: d })).json()).episode.duration, sec, d);
  }
});

test("website-only and podcast-only episodes go to the right places", async () => {
  const w = (await (await publish({ ...base(), title: "Website Bonus", platforms: ["website"] })).json()).episode;
  const p = (await (await publish({ ...base(), title: "Feed Only", platforms: ["podcast"] })).json()).episode;
  const site = await (await api.req("/api/site")).json();
  assert.ok(site.episodes.some((e) => e.id === w.id));
  assert.ok(!site.episodes.some((e) => e.id === p.id));
  assert.strictEqual(site.episodes[0].audioBytes, undefined, "internal fields hidden");
  for (let i = 1; i < site.episodes.length; i++) assert.ok(site.episodes[i - 1].publishedAt >= site.episodes[i].publishedAt);
  const feed = await (await api.req("/rss.xml")).text();
  assert.ok(feed.includes("Feed Only"));
  assert.ok(!feed.includes("Website Bonus"));
});

test("Facebook announcement: posts to the Page feed with a link to the episode", async () => {
  fb.calls.length = 0;
  const r = await publish({ ...base(), title: "Protect Your Peace", platforms: ["website", "podcast", "facebook"], facebookMessage: "New ep out now!" });
  const { episode, results } = await r.json();
  assert.deepStrictEqual(results.facebook, { ok: true, id: "page_feed_1" });
  assert.deepStrictEqual(episode.platforms, ["website", "podcast"], "facebook isn't stored as a platform");
  assert.strictEqual(fb.calls[0].url, "/v26.0/123/feed");
  assert.match(fb.calls[0].body, /name="message"\r\n\r\nNew ep out now!/);
  assert.ok(fb.calls[0].body.includes(`https://lonesoulja.example.com/#ep-${episode.id}`));
  assert.match(fb.calls[0].body, /name="access_token"\r\n\r\nSECRET_FB_TOKEN/);
});

test("Facebook failure or not connected: episode still publishes, result explains", async () => {
  fb.setMode("error");
  try {
    const r = await publish({ ...base(), platforms: ["website", "facebook"] });
    assert.strictEqual(r.status, 201);
    assert.deepStrictEqual((await r.json()).results.facebook, { ok: false, error: "(#200) Permissions error" });
    assert.strictEqual(readData(api.dir, "activity")[0].type, "facebook_post_failed");
  } finally { fb.setMode("ok"); }
  const nofb = await startApi({ fbPageId: "", fbToken: "" });
  const m = fakeMedia(); const mu = await m.start();
  try {
    const r = await publish({ ...base(), audioUrl: `${mu}/ep.mp3`, platforms: ["website", "facebook"] }, nofb);
    assert.strictEqual(r.status, 201);
    assert.match((await r.json()).results.facebook.error, /isn't connected/);
  } finally { await nofb.stop(); await m.stop(); }
});

test("edit an episode: partial update, re-probes a changed audio link", async () => {
  const ep = (await (await publish(base())).json()).episode;
  let r = await api.admin(`/api/admin/episodes/${ep.id}`, json({ title: "New Title", duration: "10:00" }, "PUT"));
  assert.strictEqual(r.status, 200);
  let e = (await r.json()).episode;
  assert.strictEqual(e.title, "New Title");
  assert.strictEqual(e.duration, 600);
  assert.strictEqual(e.description, "Episode one.");
  assert.ok(e.updatedAt);
  r = await api.admin(`/api/admin/episodes/${ep.id}`, json({ audioUrl: `${M}/nohead.mp3` }, "PUT"));
  assert.strictEqual((await r.json()).episode.audioBytes, 987654);
  r = await api.admin(`/api/admin/episodes/${ep.id}`, json({ audioUrl: `${M}/page.html` }, "PUT"));
  assert.strictEqual(r.status, 400);
  r = await api.admin(`/api/admin/episodes/${ep.id}`, json({ platforms: [] }, "PUT"));
  assert.strictEqual(r.status, 400);
  assert.strictEqual((await api.admin("/api/admin/episodes/nope", json({ title: "x" }, "PUT"))).status, 404);
});

test("unpublish removes it from the site and the feed", async () => {
  const ep = (await (await publish({ ...base(), title: "Delete Me Please" })).json()).episode;
  assert.ok((await (await api.req("/rss.xml")).text()).includes("Delete Me Please"));
  assert.strictEqual((await api.admin(`/api/admin/episodes/${ep.id}`, { method: "DELETE" })).status, 200);
  assert.strictEqual((await api.admin(`/api/admin/episodes/${ep.id}`, { method: "DELETE" })).status, 404);
  assert.ok(!(await (await api.req("/rss.xml")).text()).includes("Delete Me Please"));
  assert.ok(!(await (await api.req("/api/site")).json()).episodes.some((e) => e.id === ep.id));
  assert.strictEqual(readData(api.dir, "activity")[0].type, "episode_unpublished");
});

test("admin episode list is newest first and includes everything", async () => {
  const { episodes } = await (await api.admin("/api/admin/episodes")).json();
  assert.ok(episodes.length > 10);
  assert.ok(episodes.every((e) => e.audioBytes > 0));
  for (let i = 1; i < episodes.length; i++) assert.ok(episodes[i - 1].publishedAt >= episodes[i].publishedAt);
  const stats = await (await api.admin("/api/admin/stats")).json();
  assert.strictEqual(stats.episodes, episodes.length);
});
