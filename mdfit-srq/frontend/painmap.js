// "Find the source" pain map: Dr. Jared's front/back anatomy figures with clickable hotspots.
// Each hotspot lists likely referral sources (taken from Dr. Jared's own referred-pain guides)
// and links to the matching guide. Coordinates are percentages of assets/pain/body-figures.webp.
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
      sources: [["Suboccipital muscles", "Tight muscles at the base of the skull can send pain to the forehead, behind the eye and the temple, often mistaken for migraine."]],
      guides: ["posterior-neck"] },
    { id: "neck-front", label: "Neck / trap junction", view: "front", x: 20.1, y: 15.2, area: "Neck",
      sources: [["Levator scapulae", "Pain at the side of the neck into the top of the shoulder and along the shoulder blade."],
                ["Scalenes", "Neck pain and stiffness that can spread into the shoulder, upper back and arm."]],
      guides: ["posterior-neck", "scalenes"] },
    { id: "shoulder-front", label: "Outside shoulder", view: "front", x: 12.0, y: 18.7, area: "Shoulder",
      sources: [["Supraspinatus (rotator cuff)", "Pain at the top of the shoulder that can run down the outside of the arm, worse overhead."],
                ["Scalenes", "Can refer to the front and side of the shoulder and down the arm."]],
      guides: ["rotator-cuff", "scalenes"] },
    { id: "elbow", label: "Elbow", view: "front", x: 9.1, y: 35.6, area: "Elbow / wrist / hand",
      sources: [["Rotator cuff", "Infraspinatus and teres minor can refer down the outside of the arm toward the forearm."],
                ["Scalenes", "Tight scalenes can send pain down the arm and forearm."]],
      guides: ["rotator-cuff", "scalenes"] },
    { id: "wrist", label: "Wrist", view: "front", x: 6.7, y: 45.3, area: "Elbow / wrist / hand",
      sources: [["Scalenes", "Can refer into the hand, often the thumb, index and middle fingers, sometimes with tingling."],
                ["Subscapularis (rotator cuff)", "Can refer down the inner arm toward the ring and little fingers."]],
      guides: ["scalenes", "rotator-cuff"] },
    { id: "lateral-hip", label: "Lateral hip", view: "front", x: 15.6, y: 47.9, area: "Hip",
      sources: [["TFL", "Pain down the front-outside of the thigh, usually stopping at the knee."],
                ["Rectus femoris (quads)", "A deep ache or pulling at the front of the hip bone, common after long sitting."],
                ["Iliopsoas", "Deep hip flexor tightness that can also pull on the low back."]],
      guides: ["lateral-hip", "quads", "iliopsoas"] },
    { id: "groin", label: "Groin area", view: "front", x: 24.6, y: 50.2, area: "Hip",
      sources: [["Iliacus", "A common, often overlooked source of groin and inner-thigh pain and hip tightness."]],
      guides: ["iliopsoas"] },
    { id: "knee", label: "Knee", view: "front", x: 17.6, y: 69.8, area: "Knee",
      sources: [["Quadriceps", "Pain above, below or around the kneecap, worse on stairs, squatting or after sitting."],
                ["Calf (gastrocnemius)", "Can radiate to the back of the knee."]],
      guides: ["quads", "calf"] },
    { id: "ankle", label: "Ankle", view: "front", x: 16.6, y: 90.6, area: "Ankle / foot",
      sources: [["Tibialis posterior", "Pain on the inside of the ankle and arch, often with flat feet or overpronation."],
                ["Soleus", "Can refer to the Achilles and heel, and contribute to plantar fasciitis."]],
      guides: ["calf"] },
    { id: "occipital", label: "Occipital ridge", view: "back", x: 77.3, y: 9.2, area: "Neck",
      sources: [["Suboccipitals", "A deep ache at the base of the skull, a common driver of tension headaches."],
                ["Occipitalis", "Headache at the back of the head with scalp tenderness."]],
      guides: ["posterior-neck"] },
    { id: "neck-back", label: "Neck / trap junction", view: "back", x: 80.1, y: 14.4, area: "Neck",
      sources: [["Levator scapulae", "Neck pain into the top of the shoulder and inner edge of the shoulder blade."],
                ["Scalenes", "Pain or burning between the shoulder blades that mimics rhomboid pain."]],
      guides: ["posterior-neck", "scalenes"] },
    { id: "shoulder-back", label: "Outside shoulder", view: "back", x: 89.9, y: 20.3, area: "Shoulder",
      sources: [["Infraspinatus & teres minor", "Pain behind the shoulder that runs down the back-outside of the arm."]],
      guides: ["rotator-cuff"] },
    { id: "low-back", label: "Low back", view: "back", x: 77.3, y: 38.5, area: "Lower back",
      sources: [["Psoas", "A tight psoas pulls the lumbar spine forward, loading the low back, often from long sitting."],
                ["Iliacus", "Pain at the back of the pelvis and high in the glute."]],
      guides: ["iliopsoas"] },
    { id: "glute", label: "Glute region", view: "back", x: 82.0, y: 50.2, area: "Hip",
      sources: [["Piriformis", "Pain from the middle of the glute down the back-outside of the thigh and calf."],
                ["Glute minimus", "Pain on the outside of the hip that travels down the side of the leg."],
                ["Iliacus", "Can refer high into the glute and the back of the hip bone."]],
      guides: ["lateral-hip", "iliopsoas"] },
    { id: "hamstring", label: "Hamstring", view: "back", x: 83.1, y: 64.7, area: "Hip",
      sources: [["Piriformis", "Its referral line runs down the back-outside of the thigh toward the calf."]],
      guides: ["lateral-hip"] },
    { id: "calf", label: "Calf", view: "back", x: 84.0, y: 77.5, area: "Ankle / foot",
      sources: [["Gastrocnemius", "Upper calf pain that can reach the back of the knee, often a deep cramp-like tightness."],
                ["Soleus", "Deeper, lower calf pain with standing and walking, referring to the Achilles."],
                ["Piriformis / glute minimus", "Hip muscles whose referral lines can reach the outer calf."]],
      guides: ["calf", "lateral-hip"] }
  ];

  const root = $("#pain-map");
  if (!root) return;
  const panel = $(".painmap-panel", root), dlg = $("#guide-dialog");

  $(".hotspots", root).innerHTML = SPOTS.map((s) =>
    `<button type="button" class="hotspot" data-spot="${s.id}" style="left:${s.x}%;top:${s.y}%" aria-label="${esc(s.label)} (${s.view} view)"><span></span></button>`).join("");

  const guideCard = (g) => `<button type="button" class="guide-card" data-guide="${g}">
      <img src="assets/pain/guide-${g}-thumb.webp" alt="" width="120" height="180" loading="lazy">
      <span><b>${esc(GUIDES[g].title)}</b><small>${esc(GUIDES[g].sub)}</small><i>Open guide →</i></span>
    </button>`;

  function show(id) {
    const s = SPOTS.find((x) => x.id === id);
    if (!s) return;
    $$(".hotspot", root).forEach((b) => b.setAttribute("aria-pressed", b.dataset.spot === id));
    panel.innerHTML = `
      <p class="eyebrow">${s.view === "front" ? "Front" : "Back"} view</p>
      <h3>${esc(s.label)} pain</h3>
      <p class="muted">Pain here doesn't always start here. Common sources Dr. Jared checks:</p>
      <ul class="sources">${s.sources.map(([m, t]) => `<li><b>${esc(m)}</b><span>${esc(t)}</span></li>`).join("")}</ul>
      <div class="guide-cards">${s.guides.map(guideCard).join("")}</div>
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

  // Guide viewer — opens HTML guide pages
  function openGuide(g) {
    window.open(`guides/${g}.html`, '_blank');
  }
  document.addEventListener("click", (e) => {
    const c = e.target.closest("[data-guide]");
    if (c) openGuide(c.dataset.guide);
  });
  $(".close", dlg).addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  // Guide library under the map
  $(".guide-library", root).innerHTML = Object.keys(GUIDES).map(guideCard).join("");
})();
