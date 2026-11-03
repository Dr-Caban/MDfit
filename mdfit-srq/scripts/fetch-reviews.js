// Snapshots the live Google reviews into frontend/data/google-reviews.json so build-seo.js can bake them
// into every page as Review schema (real reviews, not fabricated). Run before build-seo.js when you want fresh:
//   node scripts/fetch-reviews.js && node scripts/build-seo.js
"use strict";
const fs = require("fs");
const path = require("path");
const https = require("https");

const URL = process.env.REVIEWS_URL || "https://www.mymdfit.com/api/reviews";
https.get(URL, { headers: { "user-agent": "MDFit-Build/1.0" } }, (res) => {
  let body = ""; res.on("data", (c) => (body += c));
  res.on("end", () => {
    let data; try { data = JSON.parse(body); } catch { data = null; }
    if (!data || !data.reviews) { console.log("reviews fetch: no data (keeping previous snapshot)"); process.exit(0); }
    const out = { fetchedAt: new Date().toISOString(), source: data.source, name: data.name, rating: data.rating, count: data.count, url: data.url,
      reviews: data.reviews.slice(0, 10).map((r) => ({ author: r.author, authorUrl: r.authorUrl, rating: r.rating, text: r.text, when: r.when || r.time })) };
    const file = path.join(__dirname, "..", "frontend", "data", "google-reviews.json");
    fs.writeFileSync(file, JSON.stringify(out, null, 2));
    console.log(`google reviews snapshot: ${out.reviews.length} reviews · ${out.rating}★ · ${out.count} total`);
  });
}).on("error", (e) => { console.log("reviews fetch failed:", e.message, "(keeping previous snapshot)"); process.exit(0); });
