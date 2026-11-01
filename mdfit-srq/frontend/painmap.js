// "Find the source" pain map: Dr. Jared's front/back anatomy figures with a point on every muscle.
// Tapping one shows where that muscle sends pain and links to its full self-check and protocol in the app.
(() => {
  const { $, $$, esc } = window.MDFit;

  const GUIDES = {
    "posterior-neck": { title: "The Posterior Neck Power Grid", sub: "Occipitals · Suboccipitals · Levator scapulae" },
    "scalenes": { title: "The Scalenes & Intercostals", sub: "Neck, shoulder, arm and rib pain" },
    "rotator-cuff": { title: "The Rotator Cuff", sub: "Four muscles, four pain patterns" },
    "iliopsoas": { title: "The Iliopsoas Complex", sub: "Hip flexors, low back and groin" },
    "lateral-hip": { title: "Lateral Hip Powerhouse", sub: "Glute minimus · Piriformis · TFL" },
    "quads": { title: "Tight Quads: Referred Pain", sub: "Front of hip, kneecap and shin" },
    "calf": { title: "The Calf Complex", sub: "Gastrocnemius · Soleus · Tibialis posterior" }
  };

  // One point per muscle (66), from painmuscles.js MAPS: [x, y, deep] in px of the 1182×1073 figure image
  const MUS = window.MDFitMuscles, TK = window.MDFitTracks;
  const W = 1182, H = 1073;
  const POINTS = ["body-front", "body-back"].flatMap((view) => Object.entries(MUS.MAPS[view].pts).map(([id, [x, y, deep]]) => ({ id, view: view.split("-")[1], x, y, deep })));

  const root = $("#pain-map");
  if (!root) return;
  const panel = $(".painmap-panel", root);
  $(".hotspots", root).innerHTML = POINTS.map((p) =>
    `<button type="button" class="hotspot ${p.deep ? "deep" : ""}" data-spot="${p.id}" data-view="${p.view}" style="left:${(p.x / W) * 100}%;top:${(p.y / H) * 100}%" aria-label="${esc(MUS.MUSCLES[p.id].name)} (${p.view}${p.deep ? ", deep" : ""})"><span></span></button>`).join("");

  // Phones: show one figure at a time, big enough to tap the right muscle
  const stage = $(".pm-stage", root);
  function setView(v) {
    stage.dataset.view = v;
    $$(".pm-toggle [data-pmview]", root).forEach((b) => b.setAttribute("aria-pressed", b.dataset.pmview === v));
  }
  $$(".pm-toggle [data-pmview]", root).forEach((b) => b.addEventListener("click", () => setView(b.dataset.pmview)));
  setView("front");

  const guideCard = (g) => `<button type="button" class="guide-card" data-guide="${g}">
      <img src="assets/guides/${g}-thumb.webp" alt="" width="120" height="120" loading="lazy">
      <span><b>${esc(GUIDES[g].title)}</b><small>${esc(GUIDES[g].sub)}</small><i>Open guide →</i></span>
    </button>`;

  function show(id, view) {
    const m = MUS.MUSCLES[id], p = POINTS.find((x) => x.id === id && (!view || x.view === view));
    if (!m) return;
    const tracks = TK ? TK.forPoint(id) : [];
    $$(".hotspot", root).forEach((b) => b.setAttribute("aria-pressed", b.dataset.spot === id));
    panel.innerHTML = `
      <p class="eyebrow">${p.view === "front" ? "Front" : "Back"} view${p.deep ? " · deep muscle" : ""}</p>
      <h3>${esc(m.name)}</h3>
      ${tracks.length ? `<div class="pm-tracks"><b>Choose your pain pattern${tracks.length > 1 ? ` (${tracks.length})` : ""}</b><div class="track-list">${tracks.map(TK.card).join("")}</div></div>` : ""}
      <ul class="sources muscle-facts">
        <li><b>Where it sends pain</b><span>${esc(m.refers)}</span></li>
        <li><b>What it does</b><span>${esc(m.does)}</span></li>
      </ul>
      <div class="pm-tags"><b>Often worse with</b>${m.worse.map((w) => `<span>${esc(MUS.AGGRAVATORS[w])}</span>`).join("")}</div>
      ${m.guide && GUIDES[m.guide] ? `<div class="guide-cards">${guideCard(m.guide)}</div>` : ""}
      <a class="btn pm-report" href="/account#pain/muscle/${id}">Take the self-check &amp; get the protocol →</a>
      <div class="painmap-cta">
        <a href="#book" class="btn btn-line">Book an evaluation</a>
        <a href="#intake" class="btn btn-line" data-area="${esc(MUS.areaOf(id))}">Tell us about it</a>
      </div>
      <p class="fine">Free in the MD Fit app: a 5-question self-check, look-alike conditions, red flags and a 3-phase protocol with Dr. Jared's videos. Educational only, not a diagnosis.</p>`;
    if (matchMedia("(max-width: 960px)").matches) panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $(".hotspots", root).addEventListener("click", (e) => {
    const b = e.target.closest(".hotspot");
    if (b) show(b.dataset.spot, b.dataset.view);
  });
  // A pain track goes straight to its videos; the app version tracks progress and plays them in order
  panel.addEventListener("click", (e) => {
    const c = e.target.closest("[data-track]");
    if (c) TK.open(c.dataset.track, { startLabel: "Do this track in the free MD Fit app →", onStart: (t) => { location.href = `/account#pain/track/${t.id}`; } });
  });

  // Pre-select the matching body area in the intake form
  panel.addEventListener("click", (e) => {
    const a = e.target.closest("[data-area]");
    if (a) $$("#lead-form [name=areas]").forEach((i) => { if (i.value === a.dataset.area) i.checked = true; });
  });

  // Guide viewer: native MD Fit guide pages (guides.js)
  document.addEventListener("click", (e) => {
    const c = e.target.closest("[data-guide]");
    if (c) window.MDFitGuides.open(c.dataset.guide);
  });

  // Guide library under the map
  $(".guide-library", root).innerHTML = Object.keys(GUIDES).map(guideCard).join("");
})();
