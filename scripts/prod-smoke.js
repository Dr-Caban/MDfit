// Hits every public + admin endpoint on the live API and reports pass/fail.
// Credentials come from the workflow inputs; nothing secret is ever printed.
const API = process.env.API.replace(/\/+$/, "");
const ORIGIN = process.env.ORIGIN || "*";
const EMAIL = process.env.ADMIN_EMAIL;
const PASS = process.env.ADMIN_PASSWORD;
const results = [];
const ok = (c, msg) => { results.push([c, msg]); console.log((c ? "PASS" : "FAIL") + " " + msg); };
const j = async (path, opts = {}) => {
  const r = await fetch(API + path, { ...opts, headers: { Origin: ORIGIN, ...(opts.headers || {}) } });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { r, data };
};

(async () => {
  let x = await j("/api/health");
  ok(x.r.status === 200 && x.data && x.data.ok === true, "health: " + JSON.stringify(x.data));
  ok(x.r.headers.get("x-content-type-options") === "nosniff", "security header");
  ok(x.r.headers.get("x-powered-by") === null, "no x-powered-by leak");
  ok(x.r.headers.get("access-control-allow-origin") === ORIGIN, "CORS allows the frontend origin");
  const bad = await fetch(API + "/api/health", { headers: { Origin: "https://evil.example" } });
  ok(bad.headers.get("access-control-allow-origin") === null, "CORS blocks other origins");

  x = await j("/api/site");
  ok(x.r.status === 200 && Array.isArray(x.data.episodes), `/api/site: ${x.data.episodes.length} episodes, feed=${x.data.feedUrl}`);
  ok(x.data.settings && x.data.settings.show.title === "Lone Soulja" && x.data.settings.donate.cashtag === "genocollie", "defaults served");
  ok(x.data.settings.meta === undefined, "meta hidden from public");

  const rss = await fetch(API + "/rss.xml");
  const xml = await rss.text();
  ok(rss.status === 200 && /application\/rss\+xml/.test(rss.headers.get("content-type")), `rss.xml: 200 ${rss.headers.get("content-type")}`);
  ok(/<rss[\s\S]*<\/rss>/.test(xml) && /<title>Lone Soulja<\/title>/.test(xml), "RSS XML well-formed");

  x = await j("/api/facebook/status");
  ok(x.r.status === 200 && typeof x.data.configured === "boolean", "facebook status: " + JSON.stringify(x.data));

  // Admin routes require auth
  for (const [m, p] of [["GET", "/api/admin/me"], ["GET", "/api/admin/stats"], ["GET", "/api/admin/settings"],
                        ["GET", "/api/admin/subscribers"], ["GET", "/api/admin/episodes"], ["POST", "/api/admin/episodes"]]) {
    x = await j(p, { method: m });
    ok(x.r.status === 401, `${m} ${p} needs login`);
  }

  // Wrong password
  x = await j("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: "wrong-" + Date.now() }) });
  ok(x.r.status === 401, "wrong password rejected");

  // Real login
  x = await j("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASS }) });
  ok(x.r.status === 200 && x.data.token, "login works, token issued");
  const auth = { Authorization: "Bearer " + x.data.token };

  // Admin reads
  x = await j("/api/admin/me", { headers: auth });
  ok(x.r.status === 200 && x.data.email === EMAIL && x.data.production === true, "me: " + x.data.email + " production=" + x.data.production);
  x = await j("/api/admin/stats", { headers: auth });
  ok(x.r.status === 200 && x.data.seeded === false, `stats: ${x.data.subscribers} subs, ${x.data.episodes} episodes, feedIssues=${x.data.feedIssues.length}`);
  x = await j("/api/admin/settings", { headers: auth });
  ok(x.r.status === 200 && x.data.show.title === "Lone Soulja", "settings read");
  x = await j("/api/admin/activity?limit=5", { headers: auth });
  ok(x.r.status === 200 && Array.isArray(x.data.activity), `activity: ${x.data.activity.length} entries`);
  x = await j("/api/admin/subscribers.csv", { headers: auth });
  ok(x.r.status === 200 && /text\/csv/.test(x.r.headers.get("content-type")) && x.data.startsWith("email,date"), "CSV export");

  // Save a quote
  x = await j("/api/admin/settings", { method: "PUT", headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ quotes: ["Prod smoke test quote " + new Date().toISOString()] }) });
  ok(x.r.status === 200 && x.data.quotes.length >= 1, "quote saved");

  // Validation: bad settings rejected
  x = await j("/api/admin/settings", { method: "PUT", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ donate: { amounts: [0.5] } }) });
  ok(x.r.status === 400, "0.50 quick-give amount rejected (" + x.r.status + "): " + (x.data.error || "").slice(0, 60));
  x = await j("/api/admin/settings", { method: "PUT", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ show: { email: "not-an-email" } }) });
  ok(x.r.status === 400, "bad email rejected");
  x = await j("/api/admin/settings", { method: "PUT", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ links: { myspace: "https://x" } }) });
  ok(x.r.status === 400, "unknown link rejected");

  // Episode audio probe
  x = await j("/api/admin/episodes", { method: "POST", headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Bad", description: "x", audioUrl: "https://example.com/not-audio.html", platforms: ["website"] }) });
  ok(x.r.status === 400 && /audio/i.test(x.data.error || ""), "bad audio link rejected (" + x.r.status + "): " + (x.data.error || "").slice(0, 80));

  // Public signup
  const testEmail = "smoke+" + Date.now() + "@example.com";
  x = await j("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: testEmail }) });
  ok(x.r.status === 200, "newsletter signup");
  x = await j("/api/admin/subscribers", { headers: auth });
  ok(x.data.subscribers.some((s) => s.email === testEmail), "signup visible to admin");
  x = await j("/api/admin/subscribers/" + encodeURIComponent(testEmail), { method: "DELETE", headers: auth });
  ok(x.r.status === 200, "admin can remove the test subscriber");

  // 404
  x = await j("/api/nope");
  ok(x.r.status === 404 && x.data.error === "Not found", "404 JSON");

  const pass = results.filter((r) => r[0]).length;
  console.log("\n" + pass + "/" + results.length + " passed");
  if (pass !== results.length) process.exit(1);
})().catch((e) => { console.error("FATAL", e); process.exit(2); });
