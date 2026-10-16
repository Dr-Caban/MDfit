#!/usr/bin/env node
/*
 * Seeds realistic sample data for LOCAL DEVELOPMENT ONLY.
 * Usage:  npm run seed            (writes to ./data or $DATA_DIR)
 *         npm run seed -- --reset (wipes existing local data first)
 *
 * Refuses to run in production: NODE_ENV=production, Railway's production
 * environment, or DATA_DIR=/data (the production volume).
 */
const path = require("path");
const fs = require("fs");
const { createStore } = require("../lib/store");

function productionReason(env = process.env) {
  if ((env.NODE_ENV || "").trim() === "production") return "NODE_ENV is production";
  if ((env.RAILWAY_ENVIRONMENT_NAME || "").trim() === "production") return "running in Railway's production environment";
  if (path.resolve((env.DATA_DIR || "").trim() || ".") === "/data") return "DATA_DIR is /data (the production volume)";
  return "";
}

// Deterministic random numbers so every seed run looks the same
function rng(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

function buildSeed(now = Date.now()) {
  const rand = rng(242);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const first = ["kendra", "marcus", "tamika", "dwayne", "shanice", "andre", "latoya", "rashad", "keisha", "jamal",
    "brianna", "tyrone", "aaliyah", "devon", "monique", "terrance", "jasmine", "corey", "nadia", "quincy"];
  const last = ["rolle", "ferguson", "johnson", "knowles", "smith", "pinder", "moss", "cartwright", "bethel", "sands",
    "mackey", "thompson", "darville", "munnings", "storr"];
  // Reserved test domains (RFC 2606): these addresses can never reach a real person
  const domains = ["example.com", "example.com", "example.net", "example.org"];
  const styles = [(f, l) => `${f}.${l}`, (f, l) => `${f}${l}`, (f, l) => `${f}${Math.floor(rand() * 90 + 10)}`, (f, l) => `${f[0]}${l}242`];

  const subscribers = [], seen = new Set();
  while (subscribers.length < 48) {
    const email = `${pick(styles)(pick(first), pick(last))}@${pick(domains)}`;
    if (seen.has(email)) continue;
    seen.add(email);
    // more sign-ups recently, like a growing show
    const daysAgo = Math.floor(Math.pow(rand(), 1.8) * 60);
    subscribers.push({ email, date: new Date(now - daysAgo * 864e5 - Math.floor(rand() * 864e5)).toISOString() });
  }
  subscribers.sort((a, b) => (a.date < b.date ? -1 : 1));

  const quotes = [
    "Leggings with no a** are technically just long-sleeve panties. I said what I said, and I will NOT be taking questions at this time!",
    "You can't build an empire while arguing with people who still need instructions on shampoo bottles.",
    "Stay humble, stay blessed, and keep your middle finger spiritually available!",
    "Jesus loves you, but even He had to flip a few tables when people started acting stupid. 🙏🏾",
    "Just because somebody smiles at you doesn't mean they like you.",
    "Have a blessed Friday, and try not to become the reason somebody needs a drink tonight!"
  ];

  const activity = subscribers.map((s) => ({ time: s.date, type: "subscribe", email: s.email }));
  for (let i = 0; i < 9; i++) {
    const t = new Date(now - Math.floor(rand() * 45) * 864e5 - Math.floor(rand() * 864e5)).toISOString();
    activity.push(rand() < 0.85
      ? { time: t, type: "facebook_post", kind: rand() < 0.6 ? "image" : "video", id: `seed_${100 + i}`, bytes: Math.floor(rand() * 9e6) + 4e5 }
      : { time: t, type: "facebook_post_failed", kind: "video", error: "(#100) Video upload timed out" });
  }
  activity.push({ time: new Date(now - 20 * 864e5).toISOString(), type: "settings_update", fields: "donate,quotes" });
  activity.sort((a, b) => (a.time < b.time ? 1 : -1));

  // No episodes are seeded: publishing needs a real, reachable audio file.
  const settings = {
    donate: { goal: 25000, raised: 6250, cashtag: "genocollie", amounts: [1, 5, 10] },
    quotes,
    meta: { seeded: true, seededAt: new Date(now).toISOString() }
  };
  return { subscribers, activity, settings };
}

function run(argv = process.argv.slice(2), env = process.env) {
  const reason = productionReason(env);
  if (reason) {
    console.error(`Refusing to seed: ${reason}. Seed data is for local development only.`);
    return 1;
  }
  const dir = (env.DATA_DIR || "").trim() || path.join(__dirname, "..", "data");
  const store = createStore(dir);
  if (argv.includes("--reset")) for (const n of ["subscribers", "activity", "settings", "episodes"]) fs.rmSync(path.join(dir, n + ".json"), { force: true });
  const existing = store.read("subscribers", []);
  if (existing.length && !argv.includes("--reset")) {
    console.error(`${dir} already has data. Run with --reset to replace it.`);
    return 1;
  }
  const seed = buildSeed();
  store.write("subscribers", seed.subscribers);
  store.write("activity", seed.activity);
  store.write("settings", seed.settings);
  console.log(`Seeded ${seed.subscribers.length} subscribers, ${seed.activity.length} activity entries, ${seed.settings.quotes.length} quotes into ${dir}`);
  return 0;
}

if (require.main === module) process.exit(run());

module.exports = { run, buildSeed, productionReason };
