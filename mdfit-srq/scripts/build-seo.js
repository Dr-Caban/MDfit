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
const today = new Date().toISOString().slice(0, 10);

const BUSINESS = {
  "@type": ["MedicalClinic", "HealthAndBeautyBusiness"],
  "@id": SITE + "/#clinic",
  name: "MD Fit",
  url: SITE + "/",
  telephone: "+1-941-313-0562",
  image: SITE + "/assets/logo.webp",
  priceRange: "$$",
  address: { "@type": "PostalAddress", streetAddress: "3214 Clark Road", addressLocality: "Sarasota", addressRegion: "FL", postalCode: "34231", addressCountry: "US" },
  hasMap: MAPS,
  aggregateRating: { "@type": "AggregateRating", ratingValue: RATING.value, reviewCount: RATING.count, bestRating: "5" }
};

// Condition pages. Plain-language, educational; Dr. Jared should review before relying on any wording.
const CONDITIONS = [
  { slug: "low-back-pain", name: "Low Back Pain", kw: "low back pain treatment", guides: ["iliopsoas", "lateral-hip"],
    intro: "Low back pain is one of the most common reasons people walk into MD Fit. Very often the spine itself is not the source: tight or weak muscles around the hips, glutes and core pull on the low back and refer pain into it.",
    causes: ["Hip flexors (iliopsoas) that stay short from sitting", "Weak or inhibited glutes that make the back do their job", "Muscle strains from lifting, twisting or sports", "Old injuries that changed how you move", "Posture and desk habits"],
    faqs: [["Do I need imaging before my first visit?", "Usually not. Dr. Jared starts with a hands-on evaluation of how you move and which muscles reproduce your pain. If anything suggests a problem that needs imaging or a specialist, he will tell you."],
      ["How many visits does low back pain take?", "It depends on how long it has been going on and what is driving it. Many people feel a difference in the first few sessions, then build strength so it stays gone. You leave every visit with homework videos in the MD Fit app."],
      ["Can I keep working out?", "In most cases, yes, with changes. Your plan tells you what to keep, what to modify and what to pause while the source muscle recovers."]] },
  { slug: "sciatica", name: "Sciatica-Type Pain", kw: "sciatica treatment", guides: ["lateral-hip", "iliopsoas"],
    intro: "Pain that shoots down the buttock or leg is often called sciatica. Muscles in the hip and pelvis, especially the deep rotators and glutes, can refer pain down the leg in a very similar pattern.",
    causes: ["Tight deep hip rotators (including piriformis)", "Glute muscles referring pain down the leg", "Long hours sitting", "Lifting and twisting injuries", "Hip stiffness changing how you walk"],
    faqs: [["Is all leg pain sciatica?", "No. True nerve irritation and muscle-referred pain can feel alike. The evaluation separates them, and anything that needs a medical referral is flagged."],
      ["When should I see a doctor urgently?", "Numbness in the groin, loss of bladder or bowel control, or rapidly worsening leg weakness need emergency care right away. Call 911."],
      ["What does treatment involve?", "Release of the muscles that reproduce your pain, mobility work for the hips and spine, and progressive strengthening so the pain does not return."]] },
  { slug: "neck-pain", name: "Neck Pain & Tension Headaches", kw: "neck pain treatment", guides: ["posterior-neck", "scalenes"],
    intro: "Neck pain, stiffness and tension headaches commonly come from the muscles at the back and sides of the neck and upper shoulders, often from desk work, phones and stress.",
    causes: ["Tight upper trapezius and levator scapulae", "Scalene muscles referring pain into the shoulder and arm", "Forward-head posture at a desk or phone", "Whiplash and past accidents", "Poor sleep position"],
    faqs: [["Can neck muscles cause headaches?", "Yes. Muscles at the base of the skull and along the neck commonly refer pain into the head and behind the eyes."],
      ["Will you crack my neck?", "No. Treatment uses hands-on soft-tissue work, gentle mobility and strengthening."],
      ["What can I do at home?", "You get a short daily routine in the MD Fit app, including posture resets and stretches you can do at your desk."]] },
  { slug: "shoulder-pain", name: "Shoulder Pain & Rotator Cuff", kw: "shoulder pain treatment", guides: ["rotator-cuff", "scalenes"],
    intro: "Shoulder pain, clicking and pain lifting the arm often involve the rotator cuff and the muscles that control the shoulder blade. MD Fit runs a structured 6-week shoulder and rotator cuff protocol.",
    causes: ["Rotator cuff strain or overuse", "Shoulder blade muscles that are weak or out of sync", "Neck muscles referring pain to the shoulder", "Recovery after shoulder surgery", "Sports and overhead work"],
    faqs: [["Do you treat shoulders after surgery?", "Yes. Post-surgical shoulder rehab follows your surgeon's precautions and progresses you back to full strength."],
      ["How long is the shoulder protocol?", "The core program runs 6 weeks with daily home exercises and in-clinic sessions, adjusted to how you respond."],
      ["Is a frozen shoulder treatable?", "Many stiff, painful shoulders improve with consistent mobility and soft-tissue work. Your evaluation sets realistic expectations."]] },
  { slug: "knee-pain", name: "Knee Pain & Knee Surgery Recovery", kw: "knee pain treatment", guides: ["quads", "calf"],
    intro: "Knee pain is frequently driven by the muscles above and below the knee: the quadriceps, hip muscles and calves. MD Fit treats everyday knee pain and recovery after knee surgery and replacement.",
    causes: ["Tight or weak quadriceps", "Hip weakness letting the knee cave in", "Calf tightness changing how you load the knee", "Recovery after ACL, meniscus or knee replacement surgery", "Running and sports overuse"],
    faqs: [["Do you help after knee replacement?", "Yes. Rehab rebuilds range of motion, strength and confidence walking, stairs and daily activities."],
      ["Can I avoid surgery?", "Some knee pain improves fully with the right strengthening. Your evaluation tells you what to expect; surgical questions stay with your surgeon."],
      ["What should I bring?", "Comfortable clothes and any surgical notes or imaging reports you have."]] },
  { slug: "hip-pain", name: "Hip Pain", kw: "hip pain treatment", guides: ["lateral-hip", "iliopsoas"],
    intro: "Pain on the outside of the hip, in the groin or deep in the buttock usually involves the glutes, hip flexors and the muscles that stabilize the pelvis. MD Fit runs a 6-week hip protocol.",
    causes: ["Glute medius weakness (outer hip pain)", "Tight hip flexors from sitting", "Hip stiffness and lost rotation", "Recovery after hip replacement", "Running, golf and pickleball strain"],
    faqs: [["Is outer hip pain bursitis?", "Often the muscles and tendons on the outside of the hip are involved. The evaluation finds which tissue reproduces your pain."],
      ["Can you help after hip replacement?", "Yes, within your surgeon's precautions, rebuilding walking, stairs and strength."],
      ["How quickly will I improve?", "Many people notice changes within a few weeks of consistent home exercise plus in-clinic sessions."]] },
  { slug: "post-surgical-rehab", name: "Post-Surgical Rehabilitation", kw: "post-surgical rehab", guides: ["rotator-cuff", "quads"],
    intro: "After knee, shoulder, spine or joint replacement surgery, structured rehab rebuilds range of motion and strength safely. MD Fit follows your surgeon's precautions and progresses you step by step.",
    causes: ["Knee surgery (ACL, meniscus, replacement)", "Shoulder surgery (rotator cuff, labrum)", "Back and spine procedures", "Hip replacement", "Fracture recovery"],
    faqs: [["When can I start after surgery?", "As soon as your surgeon clears you. Bring your post-op instructions to the first visit."],
      ["Do you coordinate with my surgeon?", "Your plan follows your surgeon's precautions and timelines."],
      ["What happens after rehab ends?", "Many patients continue with strength and performance training so the joint keeps getting stronger."]] },
  { slug: "sports-injury-rehab", name: "Sports Injury Rehabilitation", kw: "sports injury rehab", guides: ["calf", "quads"],
    intro: "Muscle strains, tears and overuse injuries from running, lifting, golf, pickleball and team sports. MD Fit takes you from injured back to full performance.",
    causes: ["Muscle strains and tears", "Tendon overuse (shoulder, knee, Achilles)", "Ankle sprains", "Return-to-sport after time off", "Golf and pickleball injuries"],
    faqs: [["Do you work with athletes?", "Yes, from weekend players to competitive athletes, with sport-specific programs including golf and pickleball."],
      ["When can I return to sport?", "When strength and movement tests show you are ready, not just when pain fades."],
      ["Can I train while injured?", "Usually yes. Your plan keeps you training around the injury."]] },
  { slug: "chronic-pain", name: "Chronic Pain", kw: "chronic pain treatment", guides: ["iliopsoas", "posterior-neck"],
    intro: "Pain that has lasted months or years, especially after old injuries or accidents, often comes from muscles that never fully recovered. MD Fit looks for the muscle at the source.",
    causes: ["Old injuries that never fully healed", "Post-accident muscle pain", "Compensation patterns from years of guarding", "Stress, poor sleep and inflammation", "Posture and work habits"],
    faqs: [["I've tried everything. Why would this be different?", "Treatment starts by finding the muscles that reproduce your exact pain, then combines hands-on release with progressive strengthening and daily home work."],
      ["Is this a replacement for my doctor?", "No. MD Fit works alongside your medical care and refers out when something needs a specialist."],
      ["What about stress and sleep?", "Your plan can include breathing, sleep and recovery habits, which play a big role in chronic pain."]] },
  { slug: "medical-massage", name: "Medical Massage", kw: "medical massage", guides: ["posterior-neck", "lateral-hip"],
    intro: "Targeted soft-tissue treatment on the exact muscles driving your pain, delivered by Dr. Jared Caban, LMT. Sessions are 60 or 90 minutes; no evaluation is needed, just a short intake form.",
    causes: ["Neck and shoulder tension", "Low back and hip tightness", "Sports recovery", "Post-injury muscle guarding", "Stress-related muscle pain"],
    faqs: [["How is medical massage different from a spa massage?", "It targets the specific muscles reproducing your pain, guided by a clinical intake, rather than general relaxation."],
      ["How long are sessions?", "60 or 90 minutes."],
      ["Do I need an evaluation first?", "No. Book directly and complete the short intake form."]] },
  { slug: "balance-fall-prevention", name: "Balance & Fall Prevention", kw: "balance training", guides: ["calf", "quads"],
    intro: "Better balance comes from stronger legs and hips, better ankle mobility and practice. MD Fit builds programs for older adults and anyone who feels unsteady.",
    causes: ["Leg and hip weakness", "Stiff ankles", "Gait changes after injury or surgery", "Inactivity", "Fear of falling"],
    faqs: [["Is it safe if I've already fallen?", "Yes. Programs start where you are, in a supervised setting, and progress gradually."],
      ["Can I do this at home?", "You get simple daily balance and strength exercises in the MD Fit app."],
      ["How often should I train?", "Most people do short sessions most days plus regular in-clinic visits."]] }
];

function page({ url, title, desc, body, ld }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
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
  <nav class="gd-nav"><a href="/"><img src="/assets/logo.webp" alt="MD Fit" width="44" height="44"> MD Fit</a><a href="/conditions/">Conditions</a><a href="/book">Book</a></nav>
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
const hubLd = { "@context": "https://schema.org", "@graph": [BUSINESS, { "@type": "CollectionPage", url: SITE + "/conditions/", name: "Conditions we treat" }] };
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

// ---- sitemap
const urls = [["/", "1.0"], ["/book", "0.9"], ["/conditions/", "0.9"], ...CONDITIONS.map((c) => [`/conditions/${c.slug}`, "0.8"]), ...guideIds.map((g) => [`/guides/${g}`, "0.6"]), ["/events", "0.5"], ["/privacy-policy", "0.2"], ["/terms", "0.2"]];
fs.writeFileSync(path.join(FE, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, p]) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod><priority>${p}</priority></url>`).join("\n")}
</urlset>
`);
console.log(`conditions: ${CONDITIONS.length + 1} pages, guides pre-rendered: ${guideIds.length}, sitemap: ${urls.length} urls`);
