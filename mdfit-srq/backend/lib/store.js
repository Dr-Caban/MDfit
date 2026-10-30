// Tiny JSON-file store. On Railway, DATA_DIR must be a mounted Volume (/data).
const fs = require("fs");
const path = require("path");

function createStore(dir) {
  const file = (name) => path.join(dir, name + ".json");
  const read = (name, fallback) => {
    try { return JSON.parse(fs.readFileSync(file(name), "utf8")); } catch { return fallback; }
  };
  const write = (name, data) => {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = file(name) + "." + process.pid + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file(name));
  };
  return { dir, read, write };
}

module.exports = { createStore };
