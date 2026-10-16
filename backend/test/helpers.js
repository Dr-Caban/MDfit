// Shared test setup. Tests NEVER touch production: they refuse to run when the
// environment looks like production, and every test uses a fresh temp DATA_DIR
// and a fake Facebook server on localhost.
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { productionReason } = require("../scripts/seed");
const { logger } = require("../lib/logger");

const reason = productionReason({ ...process.env, DATA_DIR: "" });
if (reason) throw new Error(`Refusing to run tests: ${reason}.`);

// Capture every log line for assertions
const logs = [];
logger.level = 0;
logger.sink = (line) => logs.push(JSON.parse(line));

// Fake Facebook Graph API. mode: "ok" | "error"
function fakeFacebook() {
  const calls = [];
  let mode = "ok";
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      calls.push({ url: req.url, body: Buffer.concat(chunks).toString("latin1") });
      res.setHeader("Content-Type", "application/json");
      if (mode === "error") { res.statusCode = 400; return res.end(JSON.stringify({ error: { message: "(#200) Permissions error" } })); }
      res.end(JSON.stringify(req.url.endsWith("/photos") ? { id: "1", post_id: "page_1" } : { id: "vid_1" }));
    });
  });
  return {
    calls, server,
    setMode: (m) => (mode = m),
    start: () => new Promise((r) => server.listen(0, "127.0.0.1", () => r(`http://127.0.0.1:${server.address().port}`))),
    stop: () => new Promise((r) => server.close(r))
  };
}

// Start an API instance with its own temp data dir. Returns { base, dir, stop, req }.
async function startApi(overrides = {}) {
  delete require.cache[require.resolve("../server")];
  const { createApp } = require("../server");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ls-test-"));
  const cfg = {
    adminKey: "test-admin-key-123456", fbPageId: "123", fbToken: "SECRET_FB_TOKEN",
    fbVersion: "v26.0", fbGraphUrl: "http://127.0.0.1:9", fbVideoUrl: "http://127.0.0.1:9",
    dataDir: dir, origins: ["https://site.vercel.app"], production: false, maxUpload: "100mb",
    ...overrides
  };
  const server = createApp(cfg).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const req = (p, opts = {}) => fetch(base + p, opts);
  const admin = (p, opts = {}) => fetch(base + p, { ...opts, headers: { "X-Admin-Key": cfg.adminKey, ...(opts.headers || {}) } });
  const stop = () => new Promise((r) => server.close(() => { fs.rmSync(dir, { recursive: true, force: true }); r(); }));
  return { base, dir, cfg, req, admin, stop };
}

const json = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const readData = (dir, name) => JSON.parse(fs.readFileSync(path.join(dir, name + ".json"), "utf8"));

module.exports = { logs, fakeFacebook, startApi, json, readData };
