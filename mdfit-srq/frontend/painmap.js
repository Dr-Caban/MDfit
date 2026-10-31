// "Find the source" pain map: Dr. Jared's front/back anatomy figures with clickable hotspots.
// Each hotspot lists the muscles that most often refer pain there (painmuscles.js)
// and links to Dr. Jared's matching guides. Coordinates are percentages of assets/pain/body-figures.webp.
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

  // area = the matching body-area chip in the intake form
  const SPOTS = [
    { id: "forehead", label: "Forehead", view: "front", x: 23.7, y: 4.2, area: "Neck",
      guides: ["posterior-neck"] },
    { id: "neck-front", label: "Neck / trap junction", view: "front", x: 20.1, y: 15.2, area: "Neck",
      guides: ["posterior-neck", "scalenes"] },
    { id: "shoulder-front", label: "Outside shoulder", view: "front", x: 12.0, y: 18.7, area: "Shoulder",
      guides: ["rotator-cuff", "scalenes"] },
    { id: "elbow", label: "Elbow", view: "front", x: 9.1, y: 35.6, area: "Elbow / wrist / hand",
      guides: ["rotator-cuff", "scalenes"] },
    { id: "wrist", label: "Wrist", view: "front", x: 6.7, y: 45.3, area: "Elbow / wrist / hand",
      guides: ["scalenes", "rotator-cuff"] },
    { id: "lateral-hip", label: "Lateral hip", view: "front", x: 15.6, y: 47.9, area: "Hip",
      guides: ["lateral-hip", "quads", "iliopsoas"] },
    { id: "groin", label: "Groin area", view: "front", x: 24.6, y: 50.2, area: "Hip",
      guides: ["iliopsoas"] },
    { id: "knee", label: "Knee", view: "front", x: 17.6, y: 69.8, area: "Knee",
      guides: ["quads", "calf"] },
    { id: "ankle", label: "Ankle", view: "front", x: 16.6, y: 90.6, area: "Ankle / foot",
      guides: ["calf"] },
    { id: "occipital", label: "Occipital ridge", view: "back", x: 77.3, y: 9.2, area: "Neck",
      guides: ["posterior-neck"] },
    { id: "neck-back", label: "Neck / trap junction", view: "back", x: 80.1, y: 14.4, area: "Neck",
      guides: ["posterior-neck", "scalenes"] },
    { id: "shoulder-back", label: "Outside shoulder", view: "back", x: 89.9, y: 20.3, area: "Shoulder",
      guides: ["rotator-cuff"] },
    { id: "low-back", label: "Low back", view: "back", x: 77.3, y: 38.5, area: "Lower back",
      guides: ["iliopsoas"] },
    { id: "glute", label: "Glute region", view: "back", x: 82.0, y: 50.2, area: "Hip",
      guides: ["lateral-hip", "iliopsoas"] },
    { id: "hamstring", label: "Hamstring", view: "back", x: 83.1, y: 64.7, area: "Hip",
      guides: ["lateral-hip"] },
    { id: "calf", label: "Calf", view: "back", x: 84.0, y: 77.5, area: "Ankle / foot",
      guides: ["calf", "lateral-hip"] }
  ];

  // Each map point → the matching precise spots in painmuscles.js (shared with the app's Pain Tool)
  const SPOT_MUSCLES = {
    "forehead": ["head|Forehead", "head|Behind or around the eye"], "neck-front": ["neck|Where neck meets shoulder", "neck|Side of the neck"],
    "shoulder-front": ["shoulder|Outside of the shoulder or arm", "shoulder|Front of the shoulder"], "elbow": ["elbow|Outside of the elbow", "elbow|Inside of the elbow"],
    "wrist": ["wrist|Back of the hand or wrist", "wrist|Palm side", "wrist|Thumb and index finger"], "lateral-hip": ["hip|Outside of the hip", "hip|Front of the hip bone"],
    "groin": ["hip|Groin"], "knee": ["knee|Kneecap or just below", "knee|Inside of the knee", "knee|Outside of the knee"], "ankle": ["ankle|Inner ankle and arch", "ankle|Outer ankle"],
    "occipital": ["head-b|Base of the skull", "head-b|Back of the head"], "neck-back": ["neck-b|Back of the neck", "neck-b|Top of the shoulder"],
    "shoulder-back": ["shoulder-b|Back of the shoulder"], "low-back": ["low-back|Across the low back", "low-back|Right beside the spine"],
    "glute": ["glute|Middle of the buttock", "glute|Upper buttock, belt line"], "hamstring": ["hamstring|Back of the thigh"], "calf": ["calf|Upper calf", "calf|Lower calf"]
  };

  const root = $("#pain-map");
  if (!root) return;
  const panel = $(".painmap-panel", root);

  $(".hotspots", root).innerHTML = SPOTS.map((s) =>
    `<button type="button" class="hotspot" data-spot="${s.id}" style="left:${s.x}%;top:${s.y}%" aria-label="${esc(s.label)} (${s.view} view)"><span></span></button>`).join("");

  const guideCard = (g) => `<button type="button" class="guide-card" data-guide="${g}">
      <img src="assets/guides/${g}-thumb.webp" alt="" width="120" height="120" loading="lazy">
      <span><b>${esc(GUIDES[g].title)}</b><small>${esc(GUIDES[g].sub)}</small><i>Open guide →</i></span>
    </button>`;

  function show(id) {
    const s = SPOTS.find((x) => x.id === id);
    if (!s) return;
    $$(".hotspot", root).forEach((b) => b.setAttribute("aria-pressed", b.dataset.spot === id));
    const muscles = window.MDFitMuscles ? window.MDFitMuscles.rank(SPOT_MUSCLES[id] || []) : [];
    const guides = [...new Set([...s.guides, ...muscles.slice(0, 5).map((m) => m.guide).filter(Boolean)])].slice(0, 3);
    panel.innerHTML = `
      <p class="eyebrow">${s.view === "front" ? "Front" : "Back"} view</p>
      <h3>${esc(s.label)} pain</h3>
      <p class="muted">Pain here doesn't always start here. The muscles that most often send pain to this spot, most likely first:</p>
      <ol class="sources muscles">${muscles.slice(0, 5).map((m) => `<li><b>${esc(m.name)}</b><span>${esc(m.refers)}</span></li>`).join("")}</ol>
      <div class="guide-cards">${guides.map(guideCard).join("")}</div>
      <p class="fine"><a href="/account#pain">Narrow it down to your exact muscle in the free MD Fit app →</a></p>
      <div class="painmap-cta">
        <a href="#book" class="btn">Book an evaluation</a>
        <a href="#intake" class="btn btn-line" data-area="${esc(s.area)}">Tell us about it</a>
      </div>
      <p class="fine">Educational only, not a diagnosis. Persistent or severe pain should be assessed in person.</p>`;
    if (matchMedia("(max-width: 960px)").matches) panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $(".hotspots", root).addEventListener("click", (e) => {
    const b = e.target.closest(".hotspot");
    if (b) show(b.dataset.spot);
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
