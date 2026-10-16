const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { startApi, fakeFacebook, readData } = require("./helpers");

let api, fb;
before(async () => { fb = fakeFacebook(); const url = await fb.start(); api = await startApi({ fbGraphUrl: url, fbVideoUrl: url }); });
after(async () => { await api.stop(); await fb.stop(); });

const post = (type, body, caption = "", a = api) => a.admin("/api/facebook/post?caption=" + encodeURIComponent(caption), {
  method: "POST", headers: { "Content-Type": type }, body
});

test("image posts to /photos with message, token and file", async () => {
  fb.calls.length = 0;
  const r = await post("image/png", Buffer.from("PNGDATA"), "I said what I said");
  assert.deepStrictEqual(await r.json(), { ok: true, id: "page_1" });
  assert.strictEqual(fb.calls[0].url, "/v26.0/123/photos");
  assert.match(fb.calls[0].body, /name="message"\r\n\r\nI said what I said/);
  assert.match(fb.calls[0].body, /name="access_token"\r\n\r\nSECRET_FB_TOKEN/);
  assert.match(fb.calls[0].body, /filename="lone-soulja\.png"/);
  assert.match(fb.calls[0].body, /PNGDATA/);
});

test("jpeg, mp4 and webm get the right endpoint and filename", async () => {
  fb.calls.length = 0;
  await post("image/jpeg", Buffer.from("J"));
  assert.match(fb.calls[0].body, /filename="lone-soulja\.jpg"/);
  const v = await post("video/mp4;codecs=avc1", Buffer.from("MP4"), "clip");
  assert.deepStrictEqual(await v.json(), { ok: true, id: "vid_1" });
  assert.strictEqual(fb.calls[1].url, "/v26.0/123/videos");
  assert.match(fb.calls[1].body, /name="description"\r\n\r\nclip/);
  assert.match(fb.calls[1].body, /filename="lone-soulja\.mp4"/);
  await post("video/webm", Buffer.from("W"));
  assert.match(fb.calls[2].body, /filename="lone-soulja\.webm"/);
});

test("rejects non-media and empty bodies without calling Facebook", async () => {
  fb.calls.length = 0;
  assert.strictEqual((await post("text/plain", "hi")).status, 400);
  assert.strictEqual((await post("application/json", "{}")).status, 400);
  assert.strictEqual((await post("image/png", Buffer.alloc(0))).status, 400);
  assert.strictEqual(fb.calls.length, 0);
});

test("Facebook error -> 502 with Facebook's message, logged as failed", async () => {
  fb.setMode("error");
  try {
    const r = await post("image/png", Buffer.from("x"));
    assert.strictEqual(r.status, 502);
    assert.deepStrictEqual(await r.json(), { error: "(#200) Permissions error" });
    assert.strictEqual(readData(api.dir, "activity")[0].type, "facebook_post_failed");
  } finally { fb.setMode("ok"); }
});

test("successful posts count in stats", async () => {
  const s = await (await api.admin("/api/admin/stats")).json();
  assert.strictEqual(s.facebookPosts, 4);
  assert.ok(s.lastFacebookPost);
});

test("unreachable -> 502, not configured -> 503, too large -> 413", async () => {
  const down = await startApi();
  try { assert.deepStrictEqual(await (await post("image/png", Buffer.from("x"), "", down)).json(), { error: "Could not reach Facebook." }); }
  finally { await down.stop(); }
  const nofb = await startApi({ fbPageId: "", fbToken: "" });
  try { assert.strictEqual((await post("image/png", Buffer.from("x"), "", nofb)).status, 503); }
  finally { await nofb.stop(); }
  const small = await startApi({ maxUpload: "1kb" });
  try {
    const r = await post("image/png", Buffer.alloc(5000), "", small);
    assert.strictEqual(r.status, 413);
    assert.deepStrictEqual(await r.json(), { error: "File too large." });
  } finally { await small.stop(); }
});
