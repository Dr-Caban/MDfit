// Record store: named JSON documents. Two backends with the same read/write interface:
// - File: DATA_DIR on a Railway Volume (/data). Used when MONGODB_URI is not set (local dev, tests).
// - MongoDB: MONGODB_URI. Records are held in memory, so reads stay synchronous, and saved in the background.
// With DATA_ENC_KEY set, every record is encrypted at rest (AES-256-GCM, authenticated) in either backend: a copy of
// the volume, the database or a backup is unreadable without the key. Older plain records are read as-is and
// encrypted on their next write.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PREFIX = "enc:v1:";

function sealer(key) {
  const K = key ? crypto.scryptSync(String(key), "mdfit-store-v1", 32) : null;
  const seal = (text) => {
    if (!K) return text;
    const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", K, iv);
    const out = Buffer.concat([c.update(text, "utf8"), c.final()]);
    return PREFIX + Buffer.concat([iv, c.getAuthTag(), out]).toString("base64");
  };
  const open = (raw) => {
    if (!K) throw new Error("Data is encrypted but DATA_ENC_KEY is not set.");
    const b = Buffer.from(raw.slice(PREFIX.length), "base64");
    const d = crypto.createDecipheriv("aes-256-gcm", K, b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
  };
  // A wrong or missing key must fail loudly, never look like an empty store (which could then be overwritten)
  const decode = (raw, fallback) => {
    if (raw.startsWith(PREFIX)) return JSON.parse(open(raw));
    try { return JSON.parse(raw); } catch { return fallback; }
  };
  const encode = (data) => seal(JSON.stringify(data, null, K ? 0 : 2));
  return { encode, decode, encrypted: !!K };
}

function createStore(dir, { key = "" } = {}) {
  const { encode, decode, encrypted } = sealer(key);
  const file = (name) => path.join(dir, name + ".json");
  const read = (name, fallback) => {
    let raw;
    try { raw = fs.readFileSync(file(name), "utf8"); } catch { return fallback; }
    return decode(raw, fallback);
  };
  const write = (name, data) => {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = file(name) + "." + process.pid + ".tmp";
    fs.writeFileSync(tmp, encode(data), { mode: 0o600 });
    fs.renameSync(tmp, file(name));
  };
  return { dir, read, write, encrypted };
}

// MongoDB layout, one collection: a head doc per record ({ _id: "h:<name>", k: "h", name, ver, n, at }) pointing at
// the version's n chunk docs ({ _id: "c:<name>:<ver>:<i>", k: "c", name, ver, i, v }). Chunks keep each doc under
// MongoDB's 16 MB limit. A save writes the new chunks first and moves the head last, so a crash mid-save leaves the
// previous version intact. Other instances (e.g. the old deployment during a redeploy) are picked up by polling heads.
const CHUNK = 4 * 1024 * 1024;
const ORPHAN_AGE_MS = 10 * 60 * 1000;

async function createMongoStore({ uri, key = "", logger, collection, pollMs = 2000, chunkSize = CHUNK } = {}) {
  const { encode, decode, encrypted } = sealer(key);
  let client = null, col = collection;
  if (!col) {
    const { MongoClient } = require("mongodb");
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
    await client.connect();
    col = client.db("mdfit").collection("store");
    await col.createIndex({ k: 1, at: 1 });
    await col.createIndex({ k: 1, name: 1, ver: 1 });
  }

  const records = new Map(); // name -> raw (sealed) JSON; what reads return
  const heads = new Map(); // name -> version this instance last saw as the head
  const pending = new Map(); // name -> raw waiting to be saved (latest write wins)
  const id = crypto.randomBytes(4).toString("hex");
  let seq = 0, inflight = null, worker = null, lastAt = new Date(0), timer = null, polling = false;

  const join = (parts, n, name) => {
    if (!parts || parts.length !== n || parts.some((p) => p === undefined)) throw new Error(`Stored record "${name}" is incomplete.`);
    return parts.join("");
  };
  const seen = (at) => { if (at > lastAt) lastAt = at; };

  // Load everything once at startup
  const headDocs = await col.find({ k: "h" }).toArray();
  const groups = new Map();
  const chunkDocs = await col.find({ k: "c" }).toArray();
  for (const c of chunkDocs) {
    const g = c.name + "\0" + c.ver;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)[c.i] = c.v;
  }
  for (const h of headDocs) {
    records.set(h.name, join(groups.get(h.name + "\0" + h.ver), h.n, h.name));
    heads.set(h.name, h.ver);
    seen(h.at);
  }
  const live = new Set(headDocs.map((h) => h.name + "\0" + h.ver));
  const orphans = chunkDocs.filter((c) => !live.has(c.name + "\0" + c.ver) && Date.now() - new Date(c.at) > ORPHAN_AGE_MS).map((c) => c._id);
  if (orphans.length) await col.deleteMany({ _id: { $in: orphans } });

  async function save(name, raw) {
    const ver = Date.now().toString(36) + "-" + id + "-" + (seq++);
    const n = Math.max(1, Math.ceil(raw.length / chunkSize)), at = new Date();
    const docs = [];
    for (let i = 0; i < n; i++) docs.push({ _id: `c:${name}:${ver}:${i}`, k: "c", name, ver, i, v: raw.slice(i * chunkSize, (i + 1) * chunkSize), at });
    await col.insertMany(docs);
    await col.updateOne({ _id: "h:" + name }, { $set: { k: "h", name, ver, n }, $currentDate: { at: true } }, { upsert: true });
    const prev = heads.get(name);
    heads.set(name, ver);
    if (prev) await col.deleteMany({ k: "c", name, ver: prev });
  }

  async function drain() {
    let failures = 0;
    while (pending.size) {
      const [name, raw] = pending.entries().next().value;
      pending.delete(name);
      inflight = name;
      try {
        await save(name, raw);
        failures = 0;
      } catch (err) {
        if (!pending.has(name)) pending.set(name, raw);
        failures++;
        logger && logger.error("store_save_failed", { name, error: err.message, retryInSec: Math.min(30, 2 ** failures) });
        await new Promise((r) => setTimeout(r, 1000 * Math.min(30, 2 ** failures)));
      } finally { inflight = null; }
    }
  }
  const kick = () => {
    if (worker) return;
    worker = drain().finally(() => { worker = null; if (pending.size) kick(); });
  };

  // Pick up records saved by another instance since the last look
  async function sync() {
    if (polling) return;
    polling = true;
    try {
      const changed = await col.find({ k: "h", at: { $gte: new Date(lastAt.getTime() - 5000) } }).toArray();
      for (const h of changed) {
        seen(h.at);
        if (heads.get(h.name) === h.ver || pending.has(h.name) || inflight === h.name) continue;
        const parts = [];
        for (const c of await col.find({ k: "c", name: h.name, ver: h.ver }).toArray()) parts[c.i] = c.v;
        if (parts.length !== h.n || heads.get(h.name) === h.ver || pending.has(h.name) || inflight === h.name) continue;
        records.set(h.name, join(parts, h.n, h.name));
        heads.set(h.name, h.ver);
      }
    } catch (err) {
      logger && logger.warn("store_sync_failed", { error: err.message });
    } finally { polling = false; }
  }
  if (pollMs > 0) { timer = setInterval(sync, pollMs); timer.unref(); }

  const read = (name, fallback) => {
    const raw = records.get(name);
    return raw === undefined ? fallback : decode(raw, fallback);
  };
  const write = (name, data) => {
    const raw = encode(data);
    records.set(name, raw);
    pending.set(name, raw);
    kick();
  };
  const flush = async () => { while (worker) await worker; };
  const close = async () => {
    if (timer) clearInterval(timer);
    await flush();
    if (client) await client.close();
  };
  return { read, write, flush, sync, close, encrypted, backend: "mongodb" };
}

module.exports = { createStore, createMongoStore };
