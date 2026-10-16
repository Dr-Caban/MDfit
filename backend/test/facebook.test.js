const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { startApi, fakeFacebook, readData } = require("./helpers");

let api, fb;
before(async () => {
  fb = fakeFacebook();
  const url = await fb.start();
  api = await startApi({ fbGraphUrl: url, fbVideoUrl: url });
});
after(async () => { await api.stop(); await fb.stop(); });

const post = (type, body, caption = "") => api.admin("/api/facebook/post?caption=" + encodeURIComponent(caption), {
  method: "POST", headers: { "Content-Type": type }, body
});

test("image posts to /photos with message, token and file", async () => {
  fb.calls.length = 0;
  const r = await post("image/png", Buffer.from("PNGDATA"), "I said what I said");
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(await r.json(), { ok: true, id: "page_1" });
  assert.strictEqual(fb.calls[0].url, "/v26.0/123/photos");
  assert.match(fb.calls[0].body, /name="message"\r\n\r\nI said what I said/);
  assert.match(fb.calls[0].body, /name="access_token"\r\n\r\nSECRET_FB_TOKEN/);
  assert.match(fb.calls[0].body, /filename="lone-soulja\.png"/);
  assert.match(fb.calls[0].body, /PNGDATA/);
});

test("jpeg gets .jpg filename", async () => {
  fb.calls.length = 0;
  await post("image/jpeg", Buffer.from("JPG"));
  assert.match(fb.calls[0].body, /filename="lone-soulja\.jpg"/);
});

test("mp4 video posts to /videos with description", async () => {
  fb.calls.length = 0;
  const r = await post("video/mp4;codecs=avc1", Buffer.from("MP4DATA"), "clip");
  assert.deepStrictEqual(await r.json(), { ok: true, id: "vid_1" });
  assert.strictEqual(fb.calls[0].url, "/v26.0/123/videos");
  assert.match(fb.calls[0].body, /name="description"\r\n\r\nclip/);
  assert.match(fb.calls[0].body, /filename="lone-soulja\.mp4"/);
});

test("webm video gets .webm filename", async () => {
  fb.calls.length = 0;
  await post("video/webm", Buffer.from("WEBM"));
  assert.match(fb.calls[0].body, /filename="lone-soulja\.webm"/);
});

test("rejects non-media and empty bodies without calling Facebook", async () => {
  fb.calls.length = 0;
  assert.strictEqual((await post("text/plain", "hi")).status, 400);
  assert.strictEqual((await post("application/json", "{}")).status, 400);
  assert.strictEqual((await post("image/png", Buffer.alloc(0))).status, 400);
  assert.strictEqual(fb.calls.length, 0);
});

test("Facebook error becomes 502 with Facebook's message and is logged as failed", async () => {
  fb.setMode("error");
  try {
    const r = await post("image/png", Buffer.from("x"));
    assert.strictEqual(r.status, 502);
    assert.deepStrictEqual(await r.json(), { error: "(#200) Permissions error" });
    const last = readData(api.dir, "activity")[0];
    assert.strictEqual(last.type, "facebook_post_failed");
    assert.strictEqual(last.kind, "image");
  } finally { fb.setMode("ok"); }
});

test("successful posts are recorded in activity and stats", async () => {
  const acts = readData(api.dir, "activity").filter((a) => a.type === "facebook_post");
  assert.strictEqual(acts.length, 4);
  assert.deepStrictEqual(acts.map((a) => a.kind).sort(), ["image", "image", "video", "video"]);
  const s = await (await api.admin("/api/admin/stats")).json();
  assert.strictEqual(s.facebookPosts, 4);
  assert.ok(s.lastFacebookPost);
});

test("Facebook unreachable becomes 502", async () => {
  const down = await startApi({ fbGraphUrl: "http://127.0.0.1:9", fbVideoUrl: "http://127.0.0.1:9" });
  try {
    const r = await down.admin("/api/facebook/post", { method: "POST", headers: { "Content-Type": "image/png" }, body: Buffer.from("x") });
    assert.strictEqual(r.status, 502);
    assert.deepStrictEqual(await r.json(), { error: "Could not reach Facebook." });
  } finally { await down.stop(); }
});

test("503 when the Facebook Page is not configured", async () => {
  const nofb = await startApi({ fbPageId: "", fbToken: "" });
  try {
    assert.deepStrictEqual(await (await nofb.req("/api/facebook/status")).json(), { configured: false, adminKeySet: true });
    const r = await nofb.admin("/api/facebook/post", { method: "POST", headers: { "Content-Type": "image/png" }, body: Buffer.from("x") });
    assert.strictEqual(r.status, 503);
  } finally { await nofb.stop(); }
});

test("413 when the upload is over the limit", async () => {
  const small = await startApi({ maxUpload: "1kb" });
  try {
    const r = await small.admin("/api/facebook/post", { method: "POST", headers: { "Content-Type": "image/png" }, body: Buffer.alloc(5000) });
    assert.strictEqual(r.status, 413);
    assert.deepStrictEqual(await r.json(), { error: "File too large." });
  } finally { await small.stop(); }
});
