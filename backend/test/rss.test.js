const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { XMLParser, XMLValidator } = require("fast-xml-parser");
const { startApi, fakeMedia, json } = require("./helpers");
const { buildFeed, feedIssues, hms } = require("../lib/rss");
const { defaultSettings } = require("../lib/validate");

let api, media, M;
before(async () => { media = fakeMedia(); M = await media.start(); api = await startApi(); });
after(async () => { await api.stop(); await media.stop(); });

const parse = (xml) => {
  assert.strictEqual(XMLValidator.validate(xml), true, "well-formed XML");
  return new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", parseTagValue: false }).parse(xml);
};

test("empty feed is valid with all required channel tags", async () => {
  const r = await api.req("/rss.xml");
  assert.strictEqual(r.status, 200);
  assert.match(r.headers.get("content-type"), /application\/rss\+xml; charset=utf-8/);
  assert.match(r.headers.get("cache-control"), /max-age=300/);
  const ch = parse(await r.text()).rss.channel;
  assert.strictEqual(ch.title, "Lone Soulja");
  assert.strictEqual(ch.link, "https://lonesoulja.example.com");
  assert.strictEqual(ch["itunes:author"], 'Geno "Smurf" Collie');
  assert.strictEqual(ch["itunes:image"]["@href"], "https://lonesoulja.example.com/assets/cover-3000.jpg");
  assert.strictEqual(ch["itunes:category"]["@text"], "Comedy");
  assert.strictEqual(ch["itunes:explicit"], "true");
  assert.strictEqual(ch.language, "en");
  assert.match(ch["atom:link"]["@href"], /\/rss\.xml$/);
  assert.strictEqual(ch.item, undefined);
  assert.strictEqual(ch["itunes:owner"]["itunes:email"], undefined, "no fake email");
  assert.strictEqual((await (await api.req("/feed.xml")).text()).length > 0, true);
});

test("published episodes appear with enclosure, guid, duration; special characters escaped", async () => {
  await api.admin("/api/admin/settings", json({ show: { email: "host@example.com", category: "Society & Culture" } }, "PUT"));
  const ep = (await (await api.admin("/api/admin/episodes", json({
    title: `Tom & Jerry's "Big" <Night>`, description: "Line one & two < three", audioUrl: `${M}/ep.mp3`,
    duration: "1:02:03", explicit: false, season: 2, imageUrl: `${M}/cover.png`, platforms: ["podcast"]
  }))).json()).episode;
  const xml = await (await api.req("/rss.xml")).text();
  const ch = parse(xml).rss.channel;
  assert.strictEqual(ch["itunes:owner"]["itunes:email"], "host@example.com");
  assert.strictEqual(ch["itunes:category"]["@text"], "Society & Culture");
  const item = ch.item;
  assert.strictEqual(item.title, `Tom & Jerry's "Big" <Night>`);
  assert.strictEqual(item.description, "Line one & two < three");
  assert.strictEqual(item.enclosure["@url"], `${M}/ep.mp3`);
  assert.strictEqual(item.enclosure["@length"], "123456");
  assert.strictEqual(item.enclosure["@type"], "audio/mpeg");
  assert.strictEqual(item.guid["#text"], ep.id);
  assert.strictEqual(item.guid["@isPermaLink"], "false");
  assert.strictEqual(item["itunes:duration"], "1:02:03");
  assert.strictEqual(item["itunes:explicit"], "false");
  assert.strictEqual(item["itunes:episode"], "1");
  assert.strictEqual(item["itunes:season"], "2");
  assert.strictEqual(item["itunes:image"]["@href"], `${M}/cover.png`);
  assert.ok(!isNaN(Date.parse(item.pubDate)));
  assert.strictEqual(item.link, `https://lonesoulja.example.com/#ep-${ep.id}`);
});

test("feed issues list what's missing before submitting to Spotify / Apple", () => {
  const s = defaultSettings();
  const all = feedIssues({ settings: s, episodes: [], siteUrl: "" });
  assert.strictEqual(all.length, 4);
  s.show.email = "a@b.com";
  const ok = feedIssues({ settings: s, episodes: [{ platforms: ["podcast"] }], siteUrl: "https://x.com" });
  assert.deepStrictEqual(ok, []);
});

test("custom cover art overrides the site cover; no SITE_URL means no cover", () => {
  const s = defaultSettings();
  assert.ok(!buildFeed({ settings: s, episodes: [], siteUrl: "", feedUrl: "https://api/rss.xml" }).includes("itunes:image"));
  s.show.coverUrl = "https://cdn.example.com/c.jpg";
  assert.ok(buildFeed({ settings: s, episodes: [], siteUrl: "", feedUrl: "https://api/rss.xml" }).includes('href="https://cdn.example.com/c.jpg"'));
});

test("control characters are stripped so the XML stays valid", () => {
  const s = defaultSettings();
  s.show.description = "bad\u0001chars\u0008here";
  parse(buildFeed({ settings: s, episodes: [], siteUrl: "https://x.com", feedUrl: "https://x.com/rss.xml" }));
});

test("hms formatting", () => {
  assert.strictEqual(hms(59), "0:59");
  assert.strictEqual(hms(3130), "52:10");
  assert.strictEqual(hms(3723), "1:02:03");
});
