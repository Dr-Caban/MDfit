// "Find the source" pain map: Dr. Jared's front/back anatomy figures with a point on each general pain area.
// Tapping an area lists the muscles most likely behind it; tapping a muscle shows where it sends pain
// and links to its full self-check and protocol in the app.
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

  // One point per general area (painmuscles.js AREA_POINTS), in px of the 1182×1073 figure image
  const MUS = window.MDFitMuscles, TK = window.MDFitTracks;
  const W = 1182, H = 1073;
  const POINTS = MUS.AREA_POINTS;
  const deepOf = (id) => ["body-front", "body-back"].some((v) => (MUS.MAPS[v].pts[id] || [])[2]);

  const root = $("#pain-map");
  if (!root) return;
  const panel = $(".painmap-panel", root);
  $(".hotspots", root).innerHTML = POINTS.map((p) =>
    `<button type="button" class="hotspot" data-spot="${p.id}" data-view="${p.view}" style="left:${(p.x / W) * 100}%;top:${(p.y / H) * 100}%" aria-label="${esc(p.label)} (${p.view})"><span></span></button>`).join("");

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

  const scrollPanel = () => { if (matchMedia("(max-width: 960px)").matches) panel.scrollIntoView({ behavior: "smooth", block: "start" }); };
  let current = null;

  // Area: the muscles most likely behind pain there, most common first
  function showArea(areaId) {
    const p = POINTS.find((x) => x.id === areaId);
    if (!p) return;
    current = p;
    $$(".hotspot", root).forEach((b) => b.setAttribute("aria-pressed", b.dataset.spot === areaId));
    const ranked = MUS.rank(p.spots).slice(0, 8);
    panel.innerHTML = `
      <p class="eyebrow">${p.view === "front" ? "Front" : "Back"} view</p>
      <h3>${esc(p.label)}</h3>
      <p class="muted">Pain here usually comes from one of these muscles, most common first. Tap one to see where it sends pain.</p>
      <div class="pm-muscles">${ranked.map((m) => `<button type="button" class="pm-muscle" data-muscle="${m.id}"><b>${esc(m.name)}${deepOf(m.id) ? ' <i>deep</i>' : ""}</b><small>${esc(m.refers)}</small></button>`).join("")}</div>
      <div class="painmap-cta">
        <a href="/account#pain" class="btn">Narrow it down in the free app →</a>
        <a href="#book" class="btn btn-line">Book an evaluation</a>
      </div>
      <p class="fine">Educational only, not a diagnosis.</p>`;
    scrollPanel();
  }

  function show(id) {
    const m = MUS.MUSCLES[id], p = current, deep = deepOf(id);
    if (!m) return;
    const tracks = TK ? TK.forPoint(id) : [];
    panel.innerHTML = `
      ${p ? `<button type="button" class="pm-back" data-backarea="${p.id}">← ${esc(p.label)}</button>` : ""}
      <p class="eyebrow">${deep ? "Deep muscle" : "Muscle"}</p>
      <h3>${esc(m.name)}</h3>
      ${tracks.length ? `<div class="pm-tracks"><b>Choose your pain pattern${tracks.length > 1 ? ` (${tracks.length})` : ""}</b><div class="track-list">${tracks.map(TK.card).join("")}</div></div>` : ""}
      <ul class="sources muscle-facts">
        <li><b>Where it sends pain</b><span>${esc(m.refers)}</span></li>
        <li><b>What it does</b><span>${esc(m.does)}</span></li>
      </ul>
      <div class="pm-tags"><b>Often worse with</b>${m.worse.map((w) => `<span>${esc(MUS.AGGRAVATORS[w])}</span>`).join("")}</div>
      ${m.guide && GUIDES[m.guide] ? `<div class="guide-cards">${guideCard(m.guide)}</div>` : ""}
      ${tracks.length ? `<div class="pm-guide-links"><b>Protocol guides</b>${tracks.map((t) => `<button type="button" class="pm-glink" data-tguide="${esc(t.id)}">${esc(t.title)} <span>Read →</span></button>`).join("")}</div>` : ""}
      <a class="btn pm-report" href="/account#pain/muscle/${id}">Take the self-check &amp; get the protocol →</a>
      <div class="painmap-cta">
        <a href="#book" class="btn btn-line">Book an evaluation</a>
        <a href="#intake" class="btn btn-line" data-area="${esc(MUS.areaOf(id))}">Tell us about it</a>
      </div>
      <p class="fine">Free in the MD Fit app: a 5-question self-check, look-alike conditions, red flags and a 3-phase protocol with Dr. Jared's videos. Educational only, not a diagnosis.</p>`;
    scrollPanel();
  }

  $(".hotspots", root).addEventListener("click", (e) => {
    const b = e.target.closest(".hotspot");
    if (b) showArea(b.dataset.spot);
  });
  panel.addEventListener("click", (e) => {
    const m = e.target.closest("[data-muscle]"), back = e.target.closest("[data-backarea]");
    if (m) show(m.dataset.muscle);
    else if (back) showArea(back.dataset.backarea);
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
  window.MDFitGuides.mountLibrary($(".guide-library", root));
})();
