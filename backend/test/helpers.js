// Shared test setup. Tests NEVER touch production: they refuse to run when the environment looks
// like production, and every test uses a fresh temp DATA_DIR plus fake Facebook / media servers on localhost.
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { productionReason } = require("../scripts/seed");
const { logger } = require("../lib/logger");
const { hashPassword } = require("../lib/auth");

const reason = productionReason({ ...process.env, DATA_DIR: "" });
if (reason) throw new Error(`Refusing to run tests: ${reason}.`);

// Capture every log line for assertions
const logs = [];
logger.level = 0;
logger.sink = (line) => logs.push(JSON.parse(line));

const ADMIN = { email: "host@example.com", password: "test-password-123" };
const ADMIN_HASH = hashPassword(ADMIN.password);
const SECRET = "x".repeat(40);

function listen(server) {
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r(`http://127.0.0.1:${server.address().port}`)));
}

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
      if (req.url.endsWith("/photos")) return res.end(JSON.stringify({ id: "1", post_id: "page_1" }));
      if (req.url.endsWith("/feed")) return res.end(JSON.stringify({ id: "page_feed_1" }));
      res.end(JSON.stringify({ id: "vid_1" }));
    });
  });
  return { calls, server, setMode: (m) => (mode = m), start: () => listen(server), stop: () => new Promise((r) => server.close(r)) };
}

// Fake audio/image host covering the ways real hosts behave
function fakeMedia() {
  const server = http.createServer((req, res) => {
    const u = req.url;
    if (u === "/ep.mp3") { res.writeHead(200, { "Content-Type": "audio/mpeg", "Content-Length": "123456" }); return res.end(req.method === "HEAD" ? undefined : Buffer.alloc(123456)); }
    if (u === "/redirect.mp3") { res.writeHead(302, { Location: "/ep.mp3" }); return res.end(); }
    if (u === "/nohead.mp3") {
      if (req.method === "HEAD") { res.writeHead(405); return res.end(); }
      if (req.headers.range === "bytes=0-0") { res.writeHead(206, { "Content-Type": "audio/mpeg", "Content-Range": "bytes 0-0/987654", "Content-Length": "1" }); return res.end("x"); }
      res.writeHead(400); return res.end();
    }
    if (u === "/octet.mp3") { res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": "5555" }); return res.end(); }
    if (u === "/octet.bin") { res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": "5555" }); return res.end(); }
    if (u === "/page.html") { res.writeHead(200, { "Content-Type": "text/html", "Content-Length": "10" }); return res.end(); }
    if (u === "/cover.png") { res.writeHead(200, { "Content-Type": "image/png", "Content-Length": "999" }); return res.end(); }
    res.writeHead(404); res.end();
  });
  return { server, start: () => listen(server), stop: () => new Promise((r) => server.close(r)) };
}

// Start an API instance with its own temp data dir.
async function startApi(overrides = {}) {
  delete require.cache[require.resolve("../server")];
  const { createApp } = require("../server");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ls-test-"));
  const cfg = {
    adminEmail: ADMIN.email, adminPasswordHash: ADMIN_HASH, sessionSecret: SECRET,
    siteUrl: "https://lonesoulja.example.com",
    fbPageId: "123", fbToken: "SECRET_FB_TOKEN", fbVersion: "v26.0",
    fbGraphUrl: "http://127.0.0.1:9", fbVideoUrl: "http://127.0.0.1:9",
    dataDir: dir, origins: ["https://site.vercel.app"], production: false, allowHttpMedia: true, maxUpload: "100mb",
    ...overrides
  };
  const server = createApp(cfg).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const req = (p, opts = {}) => fetch(base + p, opts);
  let token = "";
  const login = async (email = ADMIN.email, password = ADMIN.password) =>
    fetch(base + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const admin = async (p, opts = {}) => {
    if (!token) token = (await (await login()).json()).token;
    return fetch(base + p, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
  };
  const stop = () => new Promise((r) => server.close(() => { fs.rmSync(dir, { recursive: true, force: true }); r(); }));
  return { base, dir, cfg, req, admin, login, stop };
}

const json = (body, method = "POST") => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const readData = (dir, name) => JSON.parse(fs.readFileSync(path.join(dir, name + ".json"), "utf8"));

module.exports = { logs, fakeFacebook, fakeMedia, startApi, json, readData, ADMIN, SECRET };
