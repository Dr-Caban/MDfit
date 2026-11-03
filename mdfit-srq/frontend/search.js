// MD Fit search: BM25-style ranking over the pre-built index at /data/search-index.json.
// Loaded once per session, cached in memory. Queries are tokenized + synonym-expanded then scored.
// Everything runs on the main thread but is fast enough (< 2 ms per query for 245 docs).
(function () {
  "use strict";
  let IDX = null, loading = null;
  async function load() {
    if (IDX) return IDX;
    if (loading) return loading;
    loading = fetch("/data/search-index.json").then((r) => r.json()).then((j) => {
      j.stopwords = new Set(j.stopwords || []);
      j.syn = Object.create(null);
      for (const [k, vs] of Object.entries(j.synonyms || {})) { (j.syn[k] = j.syn[k] || new Set()); for (const v of vs) { j.syn[k].add(v); (j.syn[v] = j.syn[v] || new Set()).add(k); for (const u of vs) if (u !== v) j.syn[v].add(u); } }
      IDX = j; return j;
    });
    return loading;
  }
  function tokenize(q, I) {
    if (!q) return [];
    const words = q.toLowerCase().replace(/[^a-z0-9'\- ]+/g, " ").split(/\s+/).filter(Boolean);
    const out = [];
    for (const w of words) if (!I.stopwords.has(w) && w.length > 1) { out.push(w); if (I.syn[w]) for (const s of I.syn[w]) out.push(s); }
    return [...new Set(out)];
  }
  // BM25-lite: k1 = 1.4, b = 0.6 (tuned so short exercise names stay competitive with long blog pages).
  function score(doc, qTokens, I) {
    const N = I.docs, k1 = 1.4, b = 0.6;
    let s = 0;
    for (const q of qTokens) {
      const n = I.df[q]; if (!n) continue;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const f = doc.tf[q]; if (!f) continue;
      s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (doc.len / I.avgLen))));
    }
    return s * (doc.boost || 1);
  }
  async function search(q, opts = {}) {
    const I = await load();
    const qt = tokenize(q, I);
    if (!qt.length) return [];
    const kinds = opts.kinds ? new Set(opts.kinds) : null;
    const limit = opts.limit || 20;
    const results = [];
    for (const d of I.items) {
      if (kinds && !kinds.has(d.kind)) continue;
      const s = score(d, qt, I);
      if (s > 0) results.push({ ...d, score: s });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }
  function highlight(text, q) {
    if (!q || !text) return text || "";
    const words = [...new Set(q.toLowerCase().split(/\s+/).filter((w) => w.length > 1))];
    if (!words.length) return text;
    const re = new RegExp("(" + words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "ig");
    return String(text).replace(re, "<mark>$1</mark>");
  }
  window.MDFitSearch = { load, search, highlight };
})();
