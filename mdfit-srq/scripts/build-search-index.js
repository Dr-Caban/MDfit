// Builds frontend/data/search-index.json: every searchable thing on MD Fit (exercises, pain tracks, condition
// pages, treatment pages, guides, blog, programs), tokenized once at build time with per-field weights
// baked in. The client loads this file once and runs BM25-style ranking against it. No per-query indexing cost.
// Run after editing catalog, scripts/seo-data.js, backend/lib/content.js, or guides.js:
//   node scripts/build-search-index.js
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const FE = path.join(ROOT, "frontend");

// Synonyms expand on both sides so "knee pain" matches "painful knee" and so on.
const SYNONYMS = {
  pain: ["hurt", "hurts", "hurting", "ache", "aching", "sore", "soreness", "painful"],
  knee: ["kneecap", "patella", "patellar", "knees"],
  back: ["spine", "spinal", "lumbar", "lower-back"],
  shoulder: ["shoulders", "rotator", "cuff", "scapula", "scapular"],
  hip: ["hips", "pelvis", "glute", "gluteal"],
  neck: ["cervical", "nape"],
  foot: ["feet", "arch", "plantar", "heel"],
  elbow: ["elbows", "epicondyle"],
  wrist: ["wrists", "carpal"],
  ankle: ["ankles"],
  calf: ["calves", "gastroc", "soleus", "achilles"],
  rehab: ["rehabilitation", "recovery", "therapy"],
  strength: ["strong", "strengthening", "resistance", "lifting"],
  mobility: ["flexibility", "stretch", "stretching", "range"],
  massage: ["bodywork", "soft-tissue", "myofascial"],
  posture: ["postural", "alignment"],
  stretch: ["stretches", "stretching"],
  core: ["abs", "abdominal", "trunk"],
  sciatica: ["sciatic"],
  arthritis: ["arthritic", "osteoarthritis"],
  surgery: ["postoperative", "post-surgical", "post-op", "surgical"],
  golf: ["golfing", "golfer"],
  tennis: ["racquet"],
  pickleball: ["paddle"],
  running: ["runner", "jogging"],
  tight: ["tightness", "tense"],
  weak: ["weakness"],
  fall: ["falling", "balance"]
};
const STOPWORDS = new Set("a an the of to for in on at by with from and or but is are be being been it this that these those my your our you we i me if then as can could should would do does did have has had will any no not more most much very same other".split(" "));
const synIndex = {};
for (const [k, vs] of Object.entries(SYNONYMS)) { synIndex[k] = synIndex[k] || new Set(); for (const v of vs) { synIndex[k].add(v); synIndex[v] = synIndex[v] || new Set(); synIndex[v].add(k); for (const u of vs) if (u !== v) synIndex[v].add(u); } }

function tokenize(text) {
  if (!text) return [];
  const words = String(text).toLowerCase().replace(/[^a-z0-9'\- ]+/g, " ").split(/\s+/).filter(Boolean);
  const out = [];
  for (const w of words) if (!STOPWORDS.has(w) && w.length > 1) { out.push(w); if (synIndex[w]) for (const s of synIndex[w]) out.push(s); }
  return out;
}
function termFreq(tokens) { const m = Object.create(null); for (const t of tokens) m[t] = (m[t] || 0) + 1; return m; }

// Each doc has fielded text with weights: title heaviest, keywords next, body light.
const docs = [];
function add(doc) {
  const title = doc.title || "";
  const kw = (doc.keywords || []).join(" ");
  const body = doc.body || "";
  // Repeat high-weight fields in the token stream so BM25 naturally scores them higher.
  const stream = `${title} ${title} ${title} ${kw} ${kw} ${body}`;
  const tf = termFreq(tokenize(stream));
  const len = Object.values(tf).reduce((s, n) => s + n, 0) || 1;
  docs.push({ id: doc.id, kind: doc.kind, title, url: doc.url, snippet: doc.snippet || "", keywords: doc.keywords || [], tf, len, boost: doc.boost || 1 });
}

// 1. Exercises
const cat = JSON.parse(fs.readFileSync(path.join(FE, "data/catalog.json"), "utf8"));
for (const e of cat.exercises) add({ id: "ex:" + e.id, kind: "exercise", title: e.name, url: `/account#videos`, boost: 1.0,
  keywords: [e.region, e.cat, e.kind, e.category, e.joint, e.muscle, e.libCat].filter(Boolean), snippet: `${e.cat || ""} · ${e.region || ""}${e.level ? " · Level " + e.level : ""}` });

// 2. Pain tracks
for (const t of cat.tracks) add({ id: "track:" + t.id, kind: "pain-track", title: t.title, url: `/account#pain/track/${t.id}`, boost: 1.1,
  keywords: [t.region, ...((t.pts || []).slice(0, 6))], snippet: `Pain track · ${t.region || ""}` });

// 3. Guides
const ctx = { window: { addEventListener() {}, location: { hash: "" } }, location: { hash: "" }, setTimeout() {}, document: { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, createElement() { return { style: {}, classList: { add() {} }, addEventListener() {}, setAttribute() {} }; }, body: { appendChild() {} } }, console };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(FE, "guides.js"), "utf8"), ctx, { filename: "guides.js" });
const G = ctx.window.MDFitGuides;
for (const f of fs.readdirSync(path.join(FE, "guides")).filter((f) => f.endsWith(".html"))) {
  const id = f.replace(".html", ""), meta = G.meta ? G.meta(id) : null;
  const title = meta ? meta.title : id, sub = meta ? meta.subtitle : "";
  add({ id: "guide:" + id, kind: "guide", title, url: `/guides/${id}`, boost: 1.2, keywords: [sub], snippet: sub });
}

// 4. Conditions, treatments, areas, blog (from seo-data.js)
const seo = require(path.join(ROOT, "scripts/seo-data.js"));
for (const c of seo.CONDITIONS) add({ id: "cond:" + c.slug, kind: "condition", title: c.name, url: `/conditions/${c.slug}`, boost: 1.3,
  keywords: [c.kw, ...(c.causes || []).slice(0, 6)], snippet: (c.intro || "").slice(0, 160) });
for (const t of seo.TREATMENTS) add({ id: "treat:" + t.slug, kind: "treatment", title: t.name, url: `/treatments/${t.slug}`, boost: 1.3,
  keywords: (t.sections || []).slice(0, 4).map((s) => s.h2), snippet: (t.intro || "").slice(0, 160) });
for (const a of seo.SERVICE_AREAS) add({ id: "area:" + a.slug, kind: "area", title: a.name, url: `/areas/${a.slug}`, boost: 1.0,
  keywords: ["Sarasota", "rehab", "pain"], snippet: (a.intro || "").slice(0, 160) });
for (const b of seo.BLOG) add({ id: "blog:" + b.slug, kind: "blog", title: b.title, url: `/blog/${b.slug}`, boost: 0.9,
  keywords: (b.sections || []).slice(0, 3).map((s) => s.h2), snippet: b.excerpt || "" });
for (const l of seo.LANDING || []) {
  // Boost landing pages whose slug signals a "best/near me" query — they are the whole point of these pages.
  const boost = /^best-/.test(l.slug) ? 1.9 : /sarasota/.test(l.slug) ? 1.5 : 1.4;
  // Extra keywords from the slug make high-intent searches hit the right page even when the body lexicon differs.
  const kwExtra = l.slug.split("-").filter((w) => w.length > 2);
  add({ id: "landing:" + l.slug, kind: "landing", title: l.name, url: `/${l.slug}`, boost,
    keywords: [...kwExtra, ...(l.sections || []).slice(0, 3).map((s) => s.h2)], snippet: (l.intro || "").slice(0, 160) });
}

// 5. Programs
const content = require(path.join(ROOT, "backend/lib/content.js")).defaultContent();
for (const p of content.programs || []) add({ id: "prog:" + p.id, kind: "program", title: p.title, url: `/account#programs/${p.id}`, boost: 1.1,
  keywords: [p.category, p.level, p.sport].filter(Boolean), snippet: (p.summary || "").slice(0, 160) });

// Precompute document frequency for BM25
const df = Object.create(null);
for (const d of docs) for (const t of Object.keys(d.tf)) df[t] = (df[t] || 0) + 1;
const avgLen = docs.reduce((s, d) => s + d.len, 0) / docs.length;

const index = { version: new Date().toISOString().slice(0, 10), docs: docs.length, avgLen, df, synonyms: SYNONYMS, stopwords: [...STOPWORDS],
  items: docs.map((d) => ({ id: d.id, kind: d.kind, title: d.title, url: d.url, snippet: d.snippet, kw: d.keywords.slice(0, 10), tf: d.tf, len: d.len, boost: d.boost })) };

fs.writeFileSync(path.join(FE, "data/search-index.json"), JSON.stringify(index));
const by = (k) => docs.reduce((m, d) => ((m[d[k]] = (m[d[k]] || 0) + 1), m), {});
console.log(`search index: ${docs.length} docs ·`, by("kind"), `· ${(fs.statSync(path.join(FE, "data/search-index.json")).size / 1024).toFixed(1)} KB`);
