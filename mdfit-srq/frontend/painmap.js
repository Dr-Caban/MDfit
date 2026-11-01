// "Find the source" pain map: Dr. Jared's front/back anatomy figures with a point on each general pain area.
// Tapping an area opens "Which most resembles your pain?": one large picture per pain track (painpatterns.js).
// Picking one opens that track's videos. Muscle details stay folded under "Want to know more about your pain?".
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
  $(".hotspots", root).innerHTML = POINTS.map((p) =>
    `<button type="button" class="hotspot" data-spot="${p.id}" data-view="${p.view}" style="left:${(p.x / W) * 100}%;top:${(p.y / H) * 100}%" aria-label="${esc(p.label)} (${p.view})"><span></span></button>`).join("");

  // Phones: show one figure at a time, big enough to tap the right area
  const stage = $(".pm-stage", root);
  function setView(v) {
    stage.dataset.view = v;
    $$(".pm-toggle [data-pmview]", root).forEach((b) => b.setAttribute("aria-pressed", b.dataset.pmview === v));
  }
  $$(".pm-toggle [data-pmview]", root).forEach((b) => b.addEventListener("click", () => setView(b.dataset.pmview)));
  setView("front");

  const PP = window.MDFitPatterns;
  // "Scalenes → neck, shoulder blade & deltoid" -> "Neck, shoulder blade & deltoid" (where it hurts, not the muscle)
  const where = (t) => { const d = (t.title.split("→")[1] || t.title).trim(); return d.charAt(0).toUpperCase() + d.slice(1); };
  const nVideos = (t) => TK.steps(t).length;

  // Region picker: a large sheet with one picture per pain track, plus the muscle details folded away
  let sheet;
  function ensureSheet() {
    if (sheet) return sheet;
    sheet = document.createElement("dialog");
    sheet.className = "pm-sheet";
    sheet.innerHTML = `<button type="button" class="pm-sheet-close" aria-label="Close">&times;</button><div class="pm-sheet-body"></div>`;
    document.body.appendChild(sheet);
    sheet.addEventListener("click", (e) => {
      if (e.target === sheet || e.target.closest(".pm-sheet-close")) return sheet.close();
      const c = e.target.closest("[data-track]");
      if (c) TK.open(c.dataset.track, { startLabel: "Do this track in the free MD Fit app →", onStart: (t) => { location.href = `/account#pain/track/${t.id}`; } });
      if (e.target.closest("a[href^='#']")) sheet.close();
    });
    sheet.addEventListener("close", () => $$(".hotspot", root).forEach((b) => b.setAttribute("aria-pressed", "false")));
    return sheet;
  }

  const muscleInfo = (m) => `<details class="pm-mus">
      <summary><b>${esc(m.name)}</b>${deepOf(m.id) ? "<i>deep</i>" : ""}</summary>
      <dl>
        <dt>Where it sends pain</dt><dd>${esc(m.refers)}</dd>
        <dt>What it does</dt><dd>${esc(m.does)}</dd>
        ${m.attach ? `<dt>Attachments</dt><dd>${esc(m.attach)}</dd>` : ""}
        <dt>Often worse with</dt><dd>${m.worse.map((w) => esc(MUS.AGGRAVATORS[w])).join(" · ")}</dd>
      </dl>
      <p class="pm-mus-links"><a href="/account#pain/muscle/${m.id}">Take the self-check →</a>${m.guide && GUIDES[m.guide] ? `<button type="button" class="link" data-guide="${m.guide}">Read the guide: ${esc(GUIDES[m.guide].title)}</button>` : ""}</p>
    </details>`;

  function showArea(areaId) {
    const p = POINTS.find((x) => x.id === areaId);
    if (!p) return;
    $$(".hotspot", root).forEach((b) => b.setAttribute("aria-pressed", b.dataset.spot === areaId));
    let tracks = (p.tracks || []).map((id) => TK.TRACKS.find((t) => t.id === id)).filter(Boolean);
    if (!tracks.length) tracks = [...new Set(MUS.rank(p.spots).slice(0, 6).flatMap((m) => TK.forPoint(m.id)))].slice(0, 6);
    const ranked = MUS.rank(p.spots).slice(0, 8);
    const d = ensureSheet();
    $(".pm-sheet-body", d).innerHTML = `
      <header class="pm-sheet-head">
        <p class="eyebrow">${esc(p.label)}</p>
        <h2>Which most resembles your pain?</h2>
        <p>Tap the picture closest to where you feel it. Red shows where the pain is felt.</p>
      </header>
      ${tracks.length ? `<div class="pm-choices">${tracks.map((t) => `<button type="button" class="pm-choice ${PP && PP.has(t.id) && PP.PATTERNS[t.id].length > 1 ? "two" : ""}" data-track="${t.id}">
          ${PP && PP.has(t.id) ? PP.html(t.id, where(t)) : `<div class="pp"><img src="${TK.img(t.img[0], 800)}" alt="" referrerpolicy="no-referrer"></div>`}
          <span class="pm-choice-cap"><b>${esc(where(t))}</b><small>${nVideos(t)} videos</small></span>
        </button>`).join("")}</div>` : `<p class="muted">We don't have a self-guided track for this area yet. Dr. Jared can find the source in one visit.</p>`}
      <div class="pm-none"><span>None of these look right?</span><a href="#book" class="btn btn-sm">Book an evaluation</a></div>
      <details class="pm-more">
        <summary>Want to know more about your pain?</summary>
        <p class="muted">These muscles most often cause pain in this area, most common first. Open one for where it sends pain, what it does, where it attaches and what makes it worse.</p>
        <div class="pm-mus-list">${ranked.map(muscleInfo).join("")}</div>
      </details>
      <p class="fine">Educational only, not a diagnosis. In an emergency, call 911.</p>`;
    if (!d.open) d.showModal();
    $(".pm-sheet-body", d).scrollTop = 0;
  }

  $(".hotspots", root).addEventListener("click", (e) => {
    const b = e.target.closest(".hotspot");
    if (b) showArea(b.dataset.spot);
  });

  // Guide viewer: native MD Fit guide pages (guides.js)
  document.addEventListener("click", (e) => {
    const c = e.target.closest("[data-guide]");
    if (c) window.MDFitGuides.open(c.dataset.guide);
  });

  // Guide library under the map
  window.MDFitGuides.mountLibrary($(".guide-library", root));
})();
