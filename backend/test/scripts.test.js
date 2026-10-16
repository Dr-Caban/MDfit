const { test } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { verifyPassword, isValidHash } = require("../lib/auth");

const SCRIPT = path.join(__dirname, "..", "scripts", "hash-password.js");

test("hash-password prints a hash that verifies", () => {
  const r = spawnSync(process.execPath, [SCRIPT, "Some-Long-Pass-1"], { encoding: "utf8" });
  assert.strictEqual(r.status, 0);
  const hash = r.stdout.trim();
  assert.ok(isValidHash(hash));
  assert.ok(verifyPassword("Some-Long-Pass-1", hash));
  assert.ok(!r.stdout.includes("Some-Long-Pass-1"));
});

test("hash-password rejects short passwords", () => {
  const r = spawnSync(process.execPath, [SCRIPT, "short"], { encoding: "utf8" });
  assert.strictEqual(r.status, 1);
});

test("hash-password reads from stdin when no argument is given", () => {
  const r = spawnSync(process.execPath, [SCRIPT], { input: "Typed-Password-9\n", encoding: "utf8" });
  assert.strictEqual(r.status, 0);
  assert.ok(verifyPassword("Typed-Password-9", r.stdout.split("\n").find((l) => l.startsWith("scrypt") || l.includes("scrypt$")).replace(/^Password: /, "").trim()));
});
