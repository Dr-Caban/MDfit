// Pain map: front/back anatomy with gold-glowing regions. Works on homepage (#pain-map) and account page ([data-painmap="app"]).
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

  const MUS = window.MDFitMuscles, TK = window.MDFitTracks;
  const W = 1182, H = 1073;
  const REGIONS = MUS.BODY_REGIONS;
  const smooth = (p) => p.map((pt, i) => {
    const p0 = p[(i - 1 + p.length) % p.length], p1 = pt, p2 = p[(i + 1) % p.length], p3 = p[(i + 2) % p.length];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    return `${i ? "" : `M${p1[0]} ${p1[1]}`}C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
  }).join("") + "Z";
  const PATH = Object.fromEntries(REGIONS.map((r) => [r.id, smooth(r.pts)]));
  const deepOf = (id) => ["body-front", "body-back"].some((v) => (MUS.MAPS[v].pts[id] || [])[2]);

  const PP = window.MDFitPatterns;
  const where = (t) => { const d = (t.title.split("→")[1] || t.title).trim(); return d.charAt(0).toUpperCase() + d.slice(1); };
  const nVideos = (t) => TK.steps(t).length;
  const sideWord = (r) => (r.side === "center" ? "" : ` (${r.side} side)`);

  const svgMarkup = (filterId) => `<svg class="pm-regions" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Body regions">
    <defs><filter id="${filterId}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="9" result="b"/><feFlood flood-color="#F2CF7A" flood-opacity=".95"/><feComposite in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter><mask id="${filterId}-body" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><image href="assets/pain/body-mask.png" width="${W}" height="${H}"/></mask></defs>
    <g mask="url(#${filterId}-body)">${REGIONS.map((r, i) => `<path class="pm-region" d="${PATH[r.id]}" data-region="${r.id}" tabindex="0" role="button" aria-pressed="false" aria-label="Region ${i + 1}, ${r.view} of body${sideWord(r)}"/>`).join("")}</g></svg>`;

  function muscleInfo(m) {
    return `<details class="pm-mus">
      <summary><b>${esc(m.name)}</b>${deepOf(m.id) ? "<i>deep</i>" : ""}</summary>
      <dl>
        <dt>Where it sends pain</dt><dd>${esc(m.refers)}</dd>
        <dt>What it does</dt><dd>${esc(m.does)}</dd>
        ${m.attach ? `<dt>Attachments</dt><dd>${esc(m.attach)}</dd>` : ""}
        <dt>Often worse with</dt><dd>${m.worse.map((w) => esc(MUS.AGGRAVATORS[w])).join(" · ")}</dd>
      </dl>
      <p class="pm-mus-links"><a href="/account#pain/muscle/${m.id}">Take the self-check →</a>${m.guide && GUIDES[m.guide] ? `<button type="button" class="link" data-guide="${m.guide}">Read the guide: ${esc(GUIDES[m.guide].title)}</button>` : ""}</p>
    </details>`;
  }

  function regionThumb(r) {
    const xs = r.pts.map((q) => q[0]), ys = r.pts.map((q) => q[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const w = Math.max(320, (Math.max(...xs) - Math.min(...xs)) * 2.2, ((Math.max(...ys) - Math.min(...ys)) * 2.2) * 0.8), h = w * 1.25;
    const x = Math.min(Math.max(cx - w / 2, 0), W - w), y = Math.min(Math.max(cy - h / 2, 0), H - h);
    return `<svg class="pm-thumb" viewBox="${x} ${y} ${w} ${h}" aria-hidden="true"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/>
      <image href="assets/pain/body-figures-gray.webp" width="${W}" height="${H}"/><path d="${PATH[r.id]}" fill="rgba(122,175,215,.55)" stroke="#2F6E9E" stroke-width="${w / 110}"/></svg>`;
  }

  function initMap(root, ctx) {
    const isApp = ctx === "app";
    const filterId = isApp ? "pm-glow-app" : "pm-glow";

    const hotspot = $(".hotspots", root);
    if (hotspot) hotspot.outerHTML = svgMarkup(filterId);
    else if (!$(".pm-regions", root)) {
      const wrap = document.createElement("div");
      wrap.innerHTML = svgMarkup(filterId);
      $(".pm-stage", root).appendChild(wrap.firstElementChild);
    }

    const stage = $(".pm-stage", root);
    function setView(v) {
      stage.dataset.view = v;
      $$(".pm-toggle [data-pmview]", root).forEach((b) => b.setAttribute("aria-pressed", b.dataset.pmview === v));
    }
    $$(".pm-toggle [data-pmview]", root).forEach((b) => b.addEventListener("click", () => setView(b.dataset.pmview)));
    setView("front");

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
        if (c) {
          if (isApp) { sheet.close(); location.hash = "pain/track/" + c.dataset.track; }
          else TK.open(c.dataset.track, { startLabel: "Do this track in the free MD Fit app →", onStart: (t) => { location.href = `/account#pain/track/${t.id}`; } });
        }
        if (e.target.closest("a[href^='#']")) sheet.close();
      });
      sheet.addEventListener("close", () => $$(".pm-region", root).forEach((b) => b.setAttribute("aria-pressed", "false")));
      return sheet;
    }

    function showArea(areaId) {
      const p = REGIONS.find((x) => x.id === areaId);
      if (!p) return;
      $$(".pm-region", root).forEach((b) => b.setAttribute("aria-pressed", b.dataset.region === areaId));
      let tracks = (p.tracks || []).map((id) => TK.TRACKS.find((t) => t.id === id)).filter(Boolean);
      if (!tracks.length) tracks = [...new Set(MUS.rank(p.spots).slice(0, 6).flatMap((m) => TK.forPoint(m.id)))].slice(0, 6);
      const ranked = MUS.rank(p.spots).slice(0, 8);
      const d = ensureSheet();
      $(".pm-sheet-body", d).innerHTML = `
        <header class="pm-sheet-head">
          ${regionThumb(p)}
          <div><p class="eyebrow">Your selected area</p>
          <h2>Which most resembles your pain?</h2>
          <p>Tap the picture closest to where you feel it. Red shows where the pain is felt.</p></div>
        </header>
        ${tracks.length ? `<div class="pm-choices">${tracks.map((t) => `<button type="button" class="pm-choice ${PP && PP.has(t.id) && PP.PATTERNS[t.id].length > 1 ? "two" : ""}" data-track="${t.id}">
            ${PP && PP.has(t.id) ? PP.html(t.id, where(t)) : `<div class="pp"><img src="${TK.img(t.img[0], 800)}" alt="" referrerpolicy="no-referrer"></div>`}
            <span class="pm-choice-cap"><b>${esc(where(t))}</b><small>${nVideos(t)} videos</small></span>
          </button>`).join("")}</div>` : `<p class="muted">We don't have a self-guided track for this area yet. Dr. Jared can find the source in one visit.</p>`}
        <div class="pm-none"><span>None of these look right?</span><a href="${isApp ? "#book" : "/book"}" class="btn btn-sm">Book an evaluation</a></div>
        <details class="pm-more">
          <summary>Want to know more about your pain?</summary>
          <p class="muted">These muscles most often cause pain in this area, most common first. Open one for where it sends pain, what it does, where it attaches and what makes it worse.</p>
          <div class="pm-mus-list">${ranked.map(muscleInfo).join("")}</div>
        </details>
        <p class="fine">Educational only, not a diagnosis. In an emergency, call 911.</p>`;
      if (!d.open) d.showModal();
      $(".pm-sheet-body", d).scrollTop = 0;
    }

    const regions = $(".pm-regions", root);
    regions.addEventListener("click", (e) => {
      const r = e.target.closest("[data-region]");
      if (r) showArea(r.dataset.region);
    });
    regions.addEventListener("keydown", (e) => {
      const r = e.target.closest("[data-region]");
      if (r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); showArea(r.dataset.region); }
    });
  }

  // Homepage: auto-init if #pain-map exists
  const homeRoot = $("#pain-map");
  if (homeRoot) {
    initMap(homeRoot, "home");
    document.addEventListener("click", (e) => {
      const c = e.target.closest("[data-guide]");
      if (c) window.MDFitGuides.open(c.dataset.guide);
    });
    window.MDFitGuides.mountLibrary($(".guide-library", homeRoot));
  }

  // Expose for account page lazy init
  window.MDFitPainMap = { init: (root) => initMap(root, "app") };
})();
