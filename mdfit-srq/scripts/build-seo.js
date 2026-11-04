// Builds the search-engine pages: condition landing pages (/conditions/*), pre-rendered guide pages
// (content in the HTML, not drawn by JavaScript) and sitemap.xml. Run after editing the data below or guides.js:
//   node scripts/build-seo.js && node scripts/version-assets.js
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const FE = path.join(__dirname, "..", "frontend");
const SITE = "https://www.mymdfit.com";
const RATING = { value: "5.0", count: 89 };
const MAPS = "https://maps.google.com/?cid=18426672193642042879";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Review strip baked into every topical page: real client voice, boosts trust and local pack ranking
const REVIEW_HTML = (() => {
  try {
    const f = JSON.parse(fs.readFileSync(path.join(FE, "data/google-reviews.json"), "utf8"));
    return (f.reviews || []).slice(0, 2).map((r) => `<blockquote class="cd-review"><p>&ldquo;${esc(r.text).slice(0, 280)}&rdquo;</p><cite>&mdash; ${esc(r.author)}, Google review</cite></blockquote>`).join("");
  } catch { return ""; }
})();
const today = new Date().toISOString().slice(0, 10);

// Real Google reviews snapshot (refreshed by scripts/fetch-reviews.js). Baked into every page as Review schema so
// Google can surface the reviews themselves, not just the aggregate rating. The author link stays as attribution.
let REVIEWS_FILE = { rating: RATING.value, count: RATING.count, reviews: [] };
try { REVIEWS_FILE = JSON.parse(fs.readFileSync(path.join(FE, "data/google-reviews.json"), "utf8")); } catch {}
const REVIEW_SCHEMA = (REVIEWS_FILE.reviews || []).slice(0, 5).map((r) => ({
  "@type": "Review", reviewRating: { "@type": "Rating", ratingValue: String(r.rating || 5), bestRating: "5" },
  author: { "@type": "Person", name: r.author || "MD Fit client" }, reviewBody: r.text || "",
  itemReviewed: { "@id": SITE + "/#clinic" }, publisher: { "@type": "Organization", name: "Google" }
}));

const DR_JARED = {
  "@type": "Physician", "@id": SITE + "/#dr-jared",
  name: "Dr. Jared Caban",
  honorificSuffix: "MD, MSc, CEP, CCEP, LMT",
  jobTitle: "Clinical Exercise Physiologist and Licensed Massage Therapist",
  worksFor: { "@id": SITE + "/#clinic" },
  medicalSpecialty: ["PhysicalMedicine", "SportsMedicine", "Rehabilitation"],
  knowsAbout: ["Rehabilitation", "Post-surgical rehabilitation", "Chronic pain", "Medical massage", "Clinical exercise physiology", "Functional mobility", "Strength training", "Balance and fall prevention"],
  url: SITE + "/#dr", image: SITE + "/assets/dr-jared.jpg", telephone: "+1-941-313-0562",
  address: { "@type": "PostalAddress", streetAddress: "3214 Clark Road", addressLocality: "Sarasota", addressRegion: "FL", postalCode: "34231", addressCountry: "US" }
};

const BUSINESS = {
  "@type": ["MedicalClinic", "HealthAndBeautyBusiness"],
  "@id": SITE + "/#clinic",
  name: "MD Fit",
  alternateName: "MD Fit Sarasota",
  url: SITE + "/",
  telephone: "+1-941-313-0562",
  image: SITE + "/assets/logo.webp",
  logo: SITE + "/assets/logo.webp",
  priceRange: "$$",
  address: { "@type": "PostalAddress", streetAddress: "3214 Clark Road", addressLocality: "Sarasota", addressRegion: "FL", postalCode: "34231", addressCountry: "US" },
  geo: { "@type": "GeoCoordinates", latitude: 27.2824, longitude: -82.5111 },
  hasMap: MAPS,
  openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "16:00" }],
  medicalSpecialty: ["PhysicalMedicine", "SportsMedicine", "Rehabilitation"],
  availableService: [],
  areaServed: ["Sarasota", "Bradenton", "Lakewood Ranch", "Venice", "Siesta Key", "Osprey"].map((n) => ({ "@type": "City", name: n })),
  founder: { "@id": SITE + "/#dr-jared" },
  employee: { "@id": SITE + "/#dr-jared" },
  aggregateRating: { "@type": "AggregateRating", ratingValue: String(REVIEWS_FILE.rating || RATING.value), reviewCount: Number(REVIEWS_FILE.count || RATING.count), bestRating: "5" },
  review: REVIEW_SCHEMA
};

// Condition pages, treatment pages, service areas and blog articles are in scripts/seo-data.js
const { CONDITIONS, TREATMENTS, SERVICE_AREAS, BLOG, LANDING = [] } = require("./seo-data");

function page({ url, title, desc, body, ld }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <script src="/nozoom.js"></script>
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${SITE}${url}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${SITE}${url}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${SITE}/assets/logo.webp">
  <meta name="theme-color" content="#0A1A2E">
  <link rel="icon" href="/assets/icon-64.png" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/guides.css">
  <link rel="stylesheet" href="/conditions.css">
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body class="gd-page cd-page">
  <nav class="gd-nav"><a href="/"><img src="/assets/logo.webp" alt="MD Fit" width="44" height="44"> MD Fit</a><a href="/conditions/">Conditions</a><a href="/treatments/">Treatments</a><a href="/areas/">Areas</a><a href="/blog/">Blog</a><a href="/book">Book</a></nav>
${body}
  <footer class="cd-foot"><p><b>MD Fit</b> · 3214 Clark Road, Sarasota, FL 34231 · <a href="tel:+19413130562">941-313-0562</a> · Mon–Fri 8 AM–4 PM</p>
  <p><a href="${MAPS}" rel="noopener">★ ${RATING.value} on Google (${RATING.count} reviews)</a> · <a href="/privacy-policy">Privacy</a> · <a href="/terms">Terms</a></p>
  <p class="cd-fine">Educational information, not a diagnosis. In an emergency, call 911.</p></footer>
  <script src="/config.js"></script>
  <script src="/analytics.js" defer></script>
  <script defer src="/_vercel/insights/script.js"></script>
</body>
</html>
`;
}

// ---- guides: pre-render their content into the HTML
const ctx = { window: { addEventListener() {}, location: { hash: "" } }, location: { hash: "" }, setTimeout() {}, document: { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, createElement() { return { style: {}, classList: { add() {} }, addEventListener() {}, setAttribute() {} }; }, body: { appendChild() {} } }, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(FE, "guides.js"), "utf8"), ctx, { filename: "guides.js" });
const G = ctx.window.MDFitGuides;
const guideIds = fs.readdirSync(path.join(FE, "guides")).filter((f) => f.endsWith(".html")).map((f) => f.replace(".html", ""));
const guideTitle = {};
for (const id of guideIds) {
  const file = path.join(FE, "guides", id + ".html");
  let s = fs.readFileSync(file, "utf8");
  const html = G.render(id);
  const t = (s.match(/<title>([^<]*)/) || [])[1] || id;
  guideTitle[id] = t.split(" · ")[0];
  s = s.replace(/<main class="gd-body" id="guide" data-guide="[^"]*">[\s\S]*?<\/main>/, `<main class="gd-body" id="guide" data-guide="${id}">${html}</main>`);
  s = s.replace(/\s*<script>document\.getElementById\("guide"\)\.innerHTML = [^<]*<\/script>/, "");
  if (!/rel="canonical"/.test(s)) s = s.replace(/(<meta name="description"[^>]*>)/, `$1\n  <link rel="canonical" href="${SITE}/guides/${id}">`);
  if (!/_vercel\/insights/.test(s)) s = s.replace("</body>", `  <script defer src="/_vercel/insights/script.js"></script>\n</body>`);
  if (!/cd-guide-cta/.test(s)) s = s.replace("</main>", `</main>\n  <p class="cd-guide-cta"><a class="cd-btn" href="/book">Book an evaluation with Dr. Jared</a> <a href="/conditions/">Conditions we treat</a></p>`);
  fs.writeFileSync(file, s);
}

// ---- condition pages
fs.mkdirSync(path.join(FE, "conditions"), { recursive: true });
for (const c of CONDITIONS) {
  const url = `/conditions/${c.slug}`;
  const title = `${c.name} Treatment in Sarasota, FL | MD Fit`;
  const desc = `${c.name} in Sarasota: Dr. Jared Caban, MD, MSc, CEP finds the muscle at the source and builds your recovery plan. ★ ${RATING.value} from ${RATING.count} Google reviews. Book online.`;
  const ld = { "@context": "https://schema.org", "@graph": [
    BUSINESS,
    { "@type": "MedicalWebPage", url: SITE + url, name: title, description: desc, lastReviewed: today, about: { "@type": "MedicalCondition", name: c.name }, provider: { "@id": SITE + "/#clinic" } },
    { "@type": "FAQPage", mainEntity: c.faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" }, { "@type": "ListItem", position: 2, name: "Conditions", item: SITE + "/conditions/" }, { "@type": "ListItem", position: 3, name: c.name, item: SITE + url }] }
  ] };
  const body = `  <main class="cd-main">
    <p class="cd-crumbs"><a href="/">Home</a> › <a href="/conditions/">Conditions</a> › ${esc(c.name)}</p>
    <h1>${esc(c.name)} Treatment in Sarasota, FL</h1>
    <p class="cd-rating"><a href="${MAPS}" rel="noopener">★★★★★ ${RATING.value} · ${RATING.count} Google reviews</a></p>
    <p class="cd-lead">${esc(c.intro)}</p>
    ${REVIEW_HTML}
    <p><a class="cd-btn" href="/book?type=eval">Book an evaluation</a> <a class="cd-btn ghost" href="tel:+19413130562">Call 941-313-0562</a></p>
    <h2>Common causes we see</h2>
    <ul>${c.causes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    <h2>How MD Fit treats ${esc(c.name.toLowerCase())}</h2>
    <ol class="cd-steps">
      <li><b>Assess.</b> A hands-on evaluation of how you move and which muscles reproduce your pain.</li>
      <li><b>Release.</b> Targeted soft-tissue work on the muscle at the source.</li>
      <li><b>Correct.</b> Mobility and movement fixes so the problem stops coming back.</li>
      <li><b>Assign homework.</b> Short daily video routines in the free MD Fit app.</li>
      <li><b>Strengthen.</b> Progressive strength work so you stay pain-free and keep doing what you love.</li>
    </ol>
    <h2>About Dr. Jared Caban</h2>
    <p>Dr. Jared Caban, MD, MSc, CEP, CCEP, LMT, leads every plan at MD Fit on Clark Road in Sarasota, combining medical training, clinical exercise physiology and hands-on medical massage.</p>
    ${c.guides.length ? `<h2>Free guides from Dr. Jared</h2><ul>${c.guides.filter((g) => guideTitle[g]).map((g) => `<li><a href="/guides/${g}">${esc(guideTitle[g])}</a></li>`).join("")}</ul>` : ""}
    <h2>Frequently asked questions</h2>
    ${c.faqs.map(([q, a]) => `<details class="cd-faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n    ")}
    <div class="cd-cta"><h2>Ready to get out of pain?</h2><p>Serving Sarasota, Bradenton, Lakewood Ranch, Venice, Siesta Key and Osprey.</p><a class="cd-btn" href="/book?type=eval">Book an evaluation</a> <a class="cd-btn ghost" href="/book?type=call">Free phone consult</a></div>
    <h2>Other conditions we treat</h2>
    <ul class="cd-links">${CONDITIONS.filter((x) => x !== c).map((x) => `<li><a href="/conditions/${x.slug}">${esc(x.name)}</a></li>`).join("")}</ul>
  </main>`;
  fs.writeFileSync(path.join(FE, "conditions", c.slug + ".html"), page({ url, title, desc, body, ld }));
}
const hubLd = { "@context": "https://schema.org", "@graph": [BUSINESS, DR_JARED, { "@type": "CollectionPage", url: SITE + "/conditions/", name: "Conditions we treat" }] };
fs.writeFileSync(path.join(FE, "conditions", "index.html"), page({
  url: "/conditions/", title: "Pain & Rehabilitation Conditions We Treat in Sarasota, FL | MD Fit",
  desc: `Back pain, sciatica, neck, shoulder, knee and hip pain, post-surgical and sports injury rehab, chronic pain and medical massage in Sarasota. ★ ${RATING.value} from ${RATING.count} Google reviews.`,
  ld: hubLd,
  body: `  <main class="cd-main">
    <h1>Pain &amp; Rehabilitation in Sarasota, FL</h1>
    <p class="cd-rating"><a href="${MAPS}" rel="noopener">★★★★★ ${RATING.value} · ${RATING.count} Google reviews</a></p>
    <p class="cd-lead">If it hurts to move, start here. Dr. Jared Caban finds the muscle at the source and builds a plan to fix it.</p>
    <ul class="cd-grid">${CONDITIONS.map((c) => `<li><a href="/conditions/${c.slug}"><b>${esc(c.name)}</b><span>${esc(c.intro.split(". ")[0])}.</span></a></li>`).join("")}</ul>
    <h2>Free pain guides</h2>
    <ul class="cd-links">${guideIds.map((g) => `<li><a href="/guides/${g}">${esc(guideTitle[g])}</a></li>`).join("")}</ul>
    <div class="cd-cta"><h2>Not sure where your pain comes from?</h2><a class="cd-btn" href="/book?type=eval">Book an evaluation</a> <a class="cd-btn ghost" href="/book?type=call">Free phone consult</a></div>
  </main>`
}));



// ---- treatment pages
fs.mkdirSync(path.join(FE, "treatments"), { recursive: true });
for (const t of TREATMENTS) {
  const url = `/treatments/${t.slug}`;
  const title = `${t.name} in Sarasota, FL | MD Fit`;
  const desc = `${t.name} with Dr. Jared Caban, MD, MSc, CEP in Sarasota. ★ ${RATING.value} from ${RATING.count} Google reviews. Book an evaluation online.`;
  const ld = { "@context": "https://schema.org", "@graph": [BUSINESS, DR_JARED,
    { "@type": "MedicalWebPage", url: SITE + url, name: title, description: desc, lastReviewed: today, provider: { "@id": SITE + "/#clinic" } },
    { "@type": "Service", name: t.name, serviceType: t.name, provider: { "@id": SITE + "/#clinic" }, areaServed: { "@type": "City", name: "Sarasota" }, description: t.intro, offers: { "@type": "Offer", url: SITE + "/book", availability: "https://schema.org/InStock" } },
    (t.faqs && t.faqs.length ? { "@type": "FAQPage", mainEntity: t.faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) } : null),
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" }, { "@type": "ListItem", position: 2, name: "Treatments", item: SITE + "/treatments/" }, { "@type": "ListItem", position: 3, name: t.name, item: SITE + url }] }
  ].filter(Boolean) };
  const body = `  <main class="cd-main">
    <p class="cd-crumbs"><a href="/">Home</a> › <a href="/treatments/">Treatments</a> › ${esc(t.name)}</p>
    <h1>${esc(t.name)} in Sarasota, FL</h1>
    <p class="cd-rating"><a href="${MAPS}" rel="noopener">★★★★★ ${RATING.value} · ${RATING.count} Google reviews</a></p>
    <p class="cd-lead">${esc(t.intro)}</p>
    ${REVIEW_HTML}
    <p><a class="cd-btn" href="/book?type=eval">Book an evaluation</a> <a class="cd-btn ghost" href="tel:+19413130562">Call 941-313-0562</a></p>
    ${(t.sections || []).map((sec) => `<h2>${esc(sec.h2)}</h2><p>${esc(sec.body)}</p>`).join("\n    ")}
    ${(t.faqs || []).length ? `<h2>Frequently asked questions</h2>${t.faqs.map(([q, a]) => `<details class="cd-faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}` : ""}
    <div class="cd-cta"><h2>Ready to feel like you again?</h2><p>Serving Sarasota, Bradenton, Lakewood Ranch, Venice, Siesta Key and Osprey.</p><a class="cd-btn" href="/book?type=eval">Book an evaluation</a> <a class="cd-btn ghost" href="/book?type=call">Free phone consult</a></div>
    <h2>Related conditions</h2>
    <ul class="cd-links">${CONDITIONS.slice(0, 10).map((c) => `<li><a href="/conditions/${c.slug}">${esc(c.name)}</a></li>`).join("")}</ul>
  </main>`;
  fs.writeFileSync(path.join(FE, "treatments", t.slug + ".html"), page({ url, title, desc, body, ld }));
}
fs.writeFileSync(path.join(FE, "treatments", "index.html"), page({
  url: "/treatments/", title: "Treatments at MD Fit: Rehab, Medical Massage & Strength in Sarasota, FL",
  desc: `What MD Fit treats: medical massage, functional mobility, rehabilitation, clinical exercise physiology and strength training in Sarasota. ★ ${RATING.value} from ${RATING.count} Google reviews.`,
  ld: { "@context": "https://schema.org", "@graph": [BUSINESS, DR_JARED, { "@type": "CollectionPage", url: SITE + "/treatments/", name: "Treatments" }] },
  body: `  <main class="cd-main">
    <h1>Treatments at MD Fit</h1>
    <p class="cd-rating"><a href="${MAPS}" rel="noopener">★★★★★ ${RATING.value} · ${RATING.count} Google reviews</a></p>
    <p class="cd-lead">Every plan is built by Dr. Jared Caban, MD, MSc, CEP, around finding the muscle at the source of your pain.</p>
    <ul class="cd-grid">${TREATMENTS.map((t) => `<li><a href="/treatments/${t.slug}"><b>${esc(t.name)}</b><span>${esc((t.intro || "").split(". ")[0])}.</span></a></li>`).join("")}</ul>
  </main>`
}));

// ---- city / service-area pages
fs.mkdirSync(path.join(FE, "areas"), { recursive: true });
for (const a of SERVICE_AREAS) {
  const url = `/areas/${a.slug}`;
  const title = `Physical Rehabilitation & Pain Treatment for ${a.name} | MD Fit Sarasota`;
  const desc = `MD Fit serves ${a.name} with pain treatment and rehabilitation by Dr. Jared Caban, MD, MSc, CEP. ★ ${RATING.value} from ${RATING.count} Google reviews. Book online.`;
  const ld = { "@context": "https://schema.org", "@graph": [BUSINESS, DR_JARED,
    { "@type": "MedicalWebPage", url: SITE + url, name: title, description: desc, lastReviewed: today, areaServed: { "@type": "City", name: a.name }, provider: { "@id": SITE + "/#clinic" } },
    (a.faqs && a.faqs.length ? { "@type": "FAQPage", mainEntity: a.faqs.map(([q, aa]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: aa } })) } : null),
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" }, { "@type": "ListItem", position: 2, name: "Service areas", item: SITE + "/areas/" }, { "@type": "ListItem", position: 3, name: a.name, item: SITE + url }] }
  ].filter(Boolean) };
  const body = `  <main class="cd-main">
    <p class="cd-crumbs"><a href="/">Home</a> › <a href="/areas/">Service areas</a> › ${esc(a.name)}</p>
    <h1>Pain Treatment & Rehabilitation for ${esc(a.name)}</h1>
    <p class="cd-rating"><a href="${MAPS}" rel="noopener">★★★★★ ${RATING.value} · ${RATING.count} Google reviews</a></p>
    <p class="cd-lead">${esc(a.intro)}</p>
    ${REVIEW_HTML}
    <p><a class="cd-btn" href="/book?type=eval">Book an evaluation</a> <a class="cd-btn ghost" href="tel:+19413130562">Call 941-313-0562</a></p>
    ${(a.sections || []).map((sec) => `<h2>${esc(sec.h2)}</h2><p>${esc(sec.body)}</p>`).join("\n    ")}
    ${(a.faqs || []).length ? `<h2>Frequently asked questions</h2>${a.faqs.map(([q, aa]) => `<details class="cd-faq"><summary>${esc(q)}</summary><p>${esc(aa)}</p></details>`).join("")}` : ""}
    <h2>What we treat for ${esc(a.name)} patients</h2>
    <ul class="cd-links">${CONDITIONS.slice(0, 16).map((c) => `<li><a href="/conditions/${c.slug}">${esc(c.name)}</a></li>`).join("")}</ul>
    <div class="cd-cta"><h2>Book from ${esc(a.name)}</h2><a class="cd-btn" href="/book?type=eval">Book an evaluation</a> <a class="cd-btn ghost" href="/book?type=call">Free phone consult</a></div>
  </main>`;
  fs.writeFileSync(path.join(FE, "areas", a.slug + ".html"), page({ url, title, desc, body, ld }));
}
fs.writeFileSync(path.join(FE, "areas", "index.html"), page({
  url: "/areas/", title: "Service Areas: Sarasota, Bradenton, Lakewood Ranch, Venice, Osprey | MD Fit",
  desc: `MD Fit serves Sarasota and the surrounding Suncoast: Bradenton, Lakewood Ranch, Venice, Siesta Key and Osprey. Book pain treatment with Dr. Jared Caban online.`,
  ld: { "@context": "https://schema.org", "@graph": [BUSINESS, DR_JARED, { "@type": "CollectionPage", url: SITE + "/areas/", name: "Service areas" }] },
  body: `  <main class="cd-main">
    <h1>Where We Serve</h1>
    <p class="cd-lead">MD Fit is on Clark Road in Sarasota, serving the whole Suncoast.</p>
    <ul class="cd-grid">${SERVICE_AREAS.map((a) => `<li><a href="/areas/${a.slug}"><b>${esc(a.name)}</b><span>${esc((a.intro || "").split(". ")[0])}.</span></a></li>`).join("")}</ul>
  </main>`
}));

// ---- blog
fs.mkdirSync(path.join(FE, "blog"), { recursive: true });
for (const b of BLOG) {
  const url = `/blog/${b.slug}`;
  const title = `${b.title} | MD Fit Sarasota`;
  const desc = b.excerpt;
  const ld = { "@context": "https://schema.org", "@graph": [BUSINESS, DR_JARED,
    { "@type": "Article", headline: b.title, author: { "@type": "Person", name: "Dr. Jared Caban", honorificSuffix: "MD, MSc, CEP, CCEP, LMT" },
      publisher: { "@id": SITE + "/#clinic" }, datePublished: b.published, dateModified: b.published, mainEntityOfPage: SITE + url,
      image: SITE + "/assets/logo.webp", description: desc },
    (b.faqs && b.faqs.length ? { "@type": "FAQPage", mainEntity: b.faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) } : null),
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" }, { "@type": "ListItem", position: 2, name: "Blog", item: SITE + "/blog/" }, { "@type": "ListItem", position: 3, name: b.title, item: SITE + url }] }
  ].filter(Boolean) };
  const body = `  <main class="cd-main">
    <p class="cd-crumbs"><a href="/">Home</a> › <a href="/blog/">Blog</a> › ${esc(b.title)}</p>
    <h1>${esc(b.h1 || b.title)}</h1>
    <p class="muted small">By Dr. Jared Caban, MD, MSc, CEP · Published ${esc(b.published)}</p>
    ${(b.sections || []).map((sec) => `<h2>${esc(sec.h2)}</h2><p>${esc(sec.body)}</p>`).join("\n    ")}
    ${(b.faqs || []).length ? `<h2>Common questions</h2>${b.faqs.map(([q, a]) => `<details class="cd-faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}` : ""}
    <div class="cd-cta"><h2>Want this handled in person?</h2><a class="cd-btn" href="/book?type=eval">Book an evaluation</a> <a class="cd-btn ghost" href="/book?type=call">Free phone consult</a></div>
    <h2>More from the blog</h2>
    <ul class="cd-links">${BLOG.filter((x) => x.slug !== b.slug).slice(0, 8).map((x) => `<li><a href="/blog/${x.slug}">${esc(x.title)}</a></li>`).join("")}</ul>
  </main>`;
  fs.writeFileSync(path.join(FE, "blog", b.slug + ".html"), page({ url, title, desc, body, ld }));
}
fs.writeFileSync(path.join(FE, "blog", "index.html"), page({
  url: "/blog/", title: "MD Fit Blog: Pain, Rehab & Movement by Dr. Jared Caban",
  desc: `Articles from Dr. Jared Caban at MD Fit Sarasota: pain explained, recovery, and getting back to what you love.`,
  ld: { "@context": "https://schema.org", "@graph": [BUSINESS, DR_JARED, { "@type": "Blog", url: SITE + "/blog/", name: "MD Fit Blog", publisher: { "@id": SITE + "/#clinic" } }] },
  body: `  <main class="cd-main">
    <h1>MD Fit Blog</h1>
    <p class="cd-lead">Plain-language articles from Dr. Jared on where your pain really comes from and how to fix it.</p>
    <ul class="cd-grid">${BLOG.map((b) => `<li><a href="/blog/${b.slug}"><b>${esc(b.title)}</b><span>${esc(b.excerpt)}</span></a></li>`).join("")}</ul>
  </main>`
}));

// ---- high-intent landing pages (deep long-tail queries)
for (const l of LANDING) {
  const url = `/${l.slug}`;
  const title = `${l.name} | MD Fit Sarasota`;
  const desc = l.intro.length > 160 ? l.intro.slice(0, 157) + "..." : l.intro;
  const ld = { "@context": "https://schema.org", "@graph": [BUSINESS, DR_JARED,
    { "@type": "MedicalWebPage", url: SITE + url, name: title, description: desc, lastReviewed: today, provider: { "@id": SITE + "/#clinic" } },
    (l.faqs && l.faqs.length ? { "@type": "FAQPage", mainEntity: l.faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) } : null),
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" }, { "@type": "ListItem", position: 2, name: l.name, item: SITE + url }] }
  ].filter(Boolean) };
  const body = `  <main class="cd-main">
    <p class="cd-crumbs"><a href="/">Home</a> &rsaquo; ${esc(l.name)}</p>
    <h1>${esc(l.name)}</h1>
    <p class="cd-rating"><a href="${MAPS}" rel="noopener">&#9733;&#9733;&#9733;&#9733;&#9733; ${RATING.value} &middot; ${RATING.count} Google reviews</a></p>
    <p class="cd-lead">${esc(l.intro)}</p>
    ${REVIEW_HTML}
    <p><a class="cd-btn" href="/book?type=eval">Book an evaluation</a> <a class="cd-btn ghost" href="tel:+19413130562">Call 941-313-0562</a></p>
    ${(l.sections || []).map((sec) => `<h2>${esc(sec.h2)}</h2><p>${esc(sec.body)}</p>`).join("\n    ")}
    ${(l.faqs || []).length ? `<h2>Frequently asked questions</h2>${l.faqs.map(([q, a]) => `<details class="cd-faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}` : ""}
    <div class="cd-cta"><h2>Ready to feel like you again?</h2><p>Serving Sarasota, Bradenton, Lakewood Ranch, Venice, Siesta Key and Osprey.</p><a class="cd-btn" href="/book?type=eval">Book an evaluation</a> <a class="cd-btn ghost" href="/book?type=call">Free phone consult</a></div>
    <h2>Related</h2>
    <ul class="cd-links">${CONDITIONS.slice(0, 10).map((c) => `<li><a href="/conditions/${c.slug}">${esc(c.name)}</a></li>`).join("")}</ul>
  </main>`;
  fs.writeFileSync(path.join(FE, l.slug + ".html"), page({ url, title, desc, body, ld }));
}

// ---- expanded sitemap
const allUrls = [["/", "1.0"], ["/book", "0.9"], ["/conditions/", "0.9"], ["/treatments/", "0.9"], ["/areas/", "0.9"], ["/blog/", "0.8"],
  ...CONDITIONS.map((c) => [`/conditions/${c.slug}`, "0.8"]),
  ...TREATMENTS.map((t) => [`/treatments/${t.slug}`, "0.8"]),
  ...SERVICE_AREAS.map((a) => [`/areas/${a.slug}`, "0.8"]),
  ...BLOG.map((b) => [`/blog/${b.slug}`, "0.7"]),
  ...LANDING.map((l) => [`/${l.slug}`, "0.85"]),
  ...guideIds.map((g) => [`/guides/${g}`, "0.6"]),
  ["/events", "0.5"], ["/privacy-policy", "0.2"], ["/terms", "0.2"]];
fs.writeFileSync(path.join(FE, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(([u, p]) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod><priority>${p}</priority></url>`).join("\n")}
</urlset>
`);
console.log(`SEO: ${CONDITIONS.length} conditions, ${TREATMENTS.length} treatments, ${SERVICE_AREAS.length} areas, ${BLOG.length} blog, ${LANDING.length} landing, ${guideIds.length} guides, sitemap ${allUrls.length} urls`);
