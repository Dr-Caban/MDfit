// MD Fit client app (/account): Home, Generate, Videos, Pain Tool, Profile, plus the workout player.
(() => {
  const { $, $$, esc, auth, apiAuth, api, wire, fmtDate, fmtTime, todayInTz, addDays, zonedToUtc, icsStamp, AREAS, loadSite } = window.MDFit;
  if (!auth.get()) { location.replace("/login?next=/account"); return; }
  const EX = window.MDFIT_EXERCISES || [], INTROS = window.MDFIT_INTROS || {}, Gen = window.MDFitGen;

  const ADDRESS = "3214 Clark Road, Sarasota, FL 34231";
  const GUIDES = {
    "posterior-neck": "The Posterior Neck Power Grid", "scalenes": "The Scalenes & Intercostals", "rotator-cuff": "The Rotator Cuff",
    "iliopsoas": "The Iliopsoas Complex", "lateral-hip": "Lateral Hip Powerhouse", "quads": "Tight Quads: Referred Pain", "calf": "The Calf Complex"
  };
  const shortDate = (d) => fmtDate(d, { month: "short", day: "numeric" });
  const thumb = (id) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w320`;
  const thumbImg = (id) => `<span class="thumb"><img src="${thumb(id)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()"></span>`;
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  let client = auth.client(), stats = null, appts = { upcoming: [], past: [] }, painLog = [], classes = [];

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 3200);
  }

  // ================= Tabs (hash routing so the back button and refresh work)
  const TABS = ["home", "generate", "videos", "pain", "profile"];
  function show(tab) {
    if (!TABS.includes(tab)) tab = "home";
    $$("[data-view]").forEach((v) => (v.hidden = v.dataset.view !== tab));
    $$(".tabbar [data-tab]").forEach((b) => (b.dataset.tab === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
    if (tab === "videos") renderVideos();
    window.scrollTo(0, 0);
  }
  const go = (tab) => { if (location.hash !== "#" + tab) history.pushState(null, "", "#" + tab); show(tab); };
  window.addEventListener("hashchange", () => show(location.hash.slice(1)));
  $$(".tabbar [data-tab]").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
  document.addEventListener("click", (e) => { const g = e.target.closest("[data-goto]"); if (g) go(g.dataset.goto); });

  // ================= Dialogs: exercise videos, guides, intros
  const vd = $("#video-dialog"), gd = $("#guide-dialog");
  $$("dialog [data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
  $$("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));
  vd.addEventListener("close", () => ($("#vd-frame").src = "about:blank"));
  function playVideo(id, title, meta = "") {
    $("#vd-title").textContent = title;
    $("#vd-meta").textContent = meta;
    $("#vd-frame").src = `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
    vd.showModal();
  }
  const exMeta = (e) => `${e.region} · ${e.cat} · Level ${e.level}${e.loc !== "any" ? " · " + e.loc[0].toUpperCase() + e.loc.slice(1) : ""}`;
  const byId = new Map(EX.map((e) => [e.id, e]));
  document.addEventListener("click", (e) => {
    const v = e.target.closest("[data-video]");
    if (v) { const x = byId.get(v.dataset.video); if (x) playVideo(x.id, x.name, exMeta(x)); return; }
    const i = e.target.closest("[data-intro]");
    if (i && INTROS[i.dataset.intro]) { playVideo(INTROS[i.dataset.intro], i.textContent.trim()); return; }
    const g = e.target.closest("[data-guide]");
    if (g && GUIDES[g.dataset.guide]) {
      $("#gd-title").textContent = GUIDES[g.dataset.guide];
      $("#gd-img").src = `assets/pain/guide-${g.dataset.guide}.webp`;
      $("#gd-img").alt = GUIDES[g.dataset.guide];
      gd.showModal();
    }
  });

  // ================= Home
  function renderStats() {
    const s = stats || { streak: 0, bestStreak: 0, workouts: 0, hours: 0, week: Array(7).fill(false), todayIndex: (new Date().getDay() + 6) % 7 };
    $("#streak-n").textContent = s.streak;
    $("#best-n").textContent = s.bestStreak;
    $("#workouts-n").textContent = s.workouts;
    $("#hours-n").textContent = Number(s.hours).toFixed(1);
    $("#week").innerHTML = ["M", "T", "W", "T", "F", "S", "S"].map((d, i) =>
      `<li class="${s.week[i] ? "done" : ""} ${i === s.todayIndex ? "today" : ""}"><i aria-hidden="true"></i><span aria-label="${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][i]}${s.week[i] ? ", worked out" : ""}">${d}</span></li>`).join("");
  }

  // Today's workout: one per day from the client's last generator settings, kept until they change it
  const PREFS_KEY = "mdfit_prefs", TODAY_KEY = "mdfit_today";
  const prefs = { goal: "full", location: "home", level: "intermediate", length: 45, ...store.get(PREFS_KEY, {}) };
  const daySeed = (d) => [...d].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  function todaysWorkout() {
    const t = todayInTz(), saved = store.get(TODAY_KEY, null);
    if (saved && saved.date === t && saved.workout) return saved.workout;
    const w = Gen.generate({ ...prefs, seed: daySeed(t + (client?.id || "")) });
    store.set(TODAY_KEY, { date: t, workout: w });
    return w;
  }
  function renderToday() {
    const w = todaysWorkout();
    $("#today-title").textContent = w.title;
    $("#today-meta").textContent = `${w.minutes} min · ${w.exercises.length} exercises · ${w.levelLabel}`;
  }
  $("#start-today").addEventListener("click", () => startPlayer(todaysWorkout()));

  function renderPlan() {
    const p = client.plan || { guides: [], exercises: [], notes: "" };
    const empty = !p.notes && !(p.exercises || []).length && !(p.guides || []).length;
    $("#plan-card").hidden = empty;
    if (empty) return;
    $("#plan-date").textContent = p.updatedAt ? "Updated " + shortDate(p.updatedAt.slice(0, 10)) : "";
    $("#plan").innerHTML = `
      ${p.notes ? `<p class="plan-notes">${esc(p.notes).replace(/\n/g, "<br>")}</p>` : ""}
      ${p.exercises.length ? `<ul class="plan-ex">${p.exercises.map((x) => `<li><b>${esc(x.name)}</b>${x.detail ? `<span>${esc(x.detail)}</span>` : ""}</li>`).join("")}</ul>` : ""}
      ${p.guides.length ? `<div class="guides">${p.guides.filter((g) => GUIDES[g]).map((g) => `
        <button type="button" class="guide" data-guide="${g}"><img src="assets/pain/guide-${g}-thumb.webp" alt="" width="52" height="78" loading="lazy">
        <span><b>${esc(GUIDES[g])}</b><span>Open guide</span></span></button>`).join("")}</div>` : ""}`;
  }

  function ics(a) {
    const start = zonedToUtc(a.date, a.time), end = new Date(start.getTime() + a.minutes * 60e3);
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MD Fit//App//EN", "BEGIN:VEVENT", `UID:${a.id}@mdfit`,
      `DTSTAMP:${icsStamp(new Date())}`, `DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`, `SUMMARY:${a.typeName} · MD Fit`,
      `LOCATION:${ADDRESS.replace(/,/g, "\\,")}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    return URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
  }
  const dateBox = (d, tone = "") => `<div class="ev-date ${tone}"><small>${fmtDate(d, { month: "short" })}</small><b>${fmtDate(d, { day: "numeric" })}</b></div>`;
  const apptLi = (a, { cancel = false, cal = false } = {}) => `
    <li class="ev" data-appt="${a.id}">${dateBox(a.date, "gold")}
      <div class="ev-info"><b>${esc(a.typeName)}</b><span>${fmtDate(a.date, { weekday: "short" })} · ${fmtTime(a.time)} · ${a.minutes} min</span>
        ${cal ? `<span><a class="link-sm" href="${ics(a)}" download="mdfit-${a.date}.ics">Add to calendar</a></span>` : ""}</div>
      ${cancel ? `<button type="button" class="ev-act danger" data-cancel>Cancel</button>` : `<span class="muted tiny">${esc(a.status === "booked" ? "done" : a.status)}</span>`}
    </li>`;
  function renderEvents() {
    const mine = appts.upcoming.slice(0, 3).map((a) => apptLi(a));
    const cls = classes.slice(0, 4).map((c) => `
      <li class="ev" data-class="${esc(c.classId)}" data-date="${c.date}">${dateBox(c.date, "purple")}
        <div class="ev-info"><b>${esc(c.title)}</b><span>${fmtDate(c.date, { weekday: "short" })} · ${fmtTime(c.time)} · ${c.durationMin} min</span>
          <span class="spots ${c.spotsLeft > 3 ? "ok" : ""}">${c.spotsLeft ? `${c.spotsLeft} spot${c.spotsLeft === 1 ? "" : "s"} left` : "Full"}</span></div>
        ${c.mine ? `<span class="muted tiny">Booked</span>` : c.spotsLeft ? `<button type="button" class="ev-act" data-reserve>Reserve</button>` : ""}
      </li>`);
    $("#events").innerHTML = [...mine, ...cls].join("") ||
      `<li class="muted small">Nothing scheduled. <a class="link-sm" href="/book">Book a visit</a></li>`;
  }
  $("#events").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-reserve]");
    if (!b) return;
    const li = b.closest("[data-class]");
    b.disabled = true;
    try {
      await api("/api/bookings", { classId: li.dataset.class, date: li.dataset.date, name: client.name, email: client.email, phone: client.phone || "", company: "" });
      const c = classes.find((x) => x.classId === li.dataset.class && x.date === li.dataset.date);
      if (c) { c.mine = true; c.spotsLeft = Math.max(0, c.spotsLeft - 1); }
      renderEvents(); toast("You're in. Check your email for details.");
    } catch (err) {
      if (err.status === 409 && /already/i.test(err.message)) {
        const c = classes.find((x) => x.classId === li.dataset.class && x.date === li.dataset.date);
        if (c) c.mine = true;
        renderEvents();
      }
      toast(err.message); b.disabled = false;
    }
  });

  function renderActivity() {
    const items = [
      ...((stats && stats.recent) || []).map((w) => ({ at: w.completedAt, title: w.title, sub: `${w.minutes} min · ${w.exercises} exercises`, icon: "check" })),
      ...painLog.slice(-5).map((p) => ({ at: p.date + "T12:00:00", title: `Logged ${p.area.toLowerCase()} pain`, sub: `${p.level}/10${p.note ? " · " + p.note : ""}`, icon: "pain" })),
      ...appts.past.filter((a) => a.status !== "cancelled").slice(0, 3).map((a) => ({ at: a.date + "T" + a.time, title: a.typeName, sub: "Visit with Dr. Jared", icon: "visit" }))
    ].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 5);
    const ICON = {
      check: '<path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>',
      pain: '<path d="M12 2a2 2 0 1 1-2 2 2 2 0 0 1 2-2zm-3 20v-7H7.5V9a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v6H15v7z"/>',
      visit: '<path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14z"/>'
    };
    const ago = (iso) => {
      const d = iso.slice(0, 10), t = todayInTz();
      return d === t ? "Today" : d === addDays(t, -1) ? "Yesterday" : shortDate(d);
    };
    const html = items.map((x) => `<li class="act"><span class="check"><svg viewBox="0 0 24 24">${ICON[x.icon]}</svg></span>
      <div><b>${esc(x.title)}</b><span>${esc(x.sub)}</span></div><em>${ago(x.at)}</em></li>`).join("");
    $("#activity").innerHTML = html || `<li class="muted small">Finish your first workout and it shows up here.</li>`;
    $("#p-workouts").innerHTML = ((stats && stats.recent) || []).map((w) => `<li class="act"><span class="check"><svg viewBox="0 0 24 24">${ICON.check}</svg></span>
      <div><b>${esc(w.title)}</b><span>${w.minutes} min · ${w.exercises} exercises</span></div><em>${ago(w.completedAt)}</em></li>`).join("")
      || `<li class="muted small">No workouts logged yet.</li>`;
  }

  function renderNotes() {
    const t = todayInTz(), notes = [];
    const soon = appts.upcoming.find((a) => a.date <= addDays(t, 2));
    if (soon) notes.push(`Visit ${soon.date === t ? "today" : soon.date === addDays(t, 1) ? "tomorrow" : fmtDate(soon.date, { weekday: "long" })} at ${fmtTime(soon.time)}: ${soon.typeName}.`);
    const p = client.plan;
    if (p && p.updatedAt && p.updatedAt.slice(0, 10) >= addDays(t, -7)) notes.push("Dr. Jared updated your plan. See “From Dr. Jared” below.");
    if (stats && stats.streak > 0 && !stats.week[stats.todayIndex]) notes.push(`Keep your ${stats.streak}-day streak going: do a workout today.`);
    $("#bell .dot").hidden = !notes.length;
    $("#notes").innerHTML = notes.length ? notes.map((n) => `<p>${esc(n)}</p>`).join("") : `<p class="muted">You're all caught up.</p>`;
  }
  $("#bell").addEventListener("click", () => { $("#notes").hidden = !$("#notes").hidden; $("#bell .dot").hidden = true; });

  // ================= Generate
  const ICONS = {
    upper: '<path d="M12 2a3 3 0 1 1-3 3 3 3 0 0 1 3-3zM3 9h18v2h-6v11h-2v-6h-2v6H9V11H3z"/>',
    lower: '<path d="M9 2h6l1 9-1.5 11h-2L12 14l-.5 8h-2L8 11z"/>',
    full: '<path d="M12 2a2.5 2.5 0 1 1-2.5 2.5A2.5 2.5 0 0 1 12 2zM21 9h-6v13h-2v-6h-2v6H9V9H3V7h18z"/>',
    core: '<path d="M8 3h8v18H8zm2 2v3h4V5zm0 5v3h4v-3zm0 5v4h4v-4z"/>',
    mobility: '<path d="M13.5 5.5a2 2 0 1 0-2-2 2 2 0 0 0 2 2zM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2a5.2 5.2 0 0 1-4.5-2.5l-1-1.6a2 2 0 0 0-1.7-1 2 2 0 0 0-.8.2L6 8.3V13h2V9.6z"/>',
    home: '<path d="M12 3 2 12h3v8h5v-6h4v6h5v-8h3z"/>',
    gym: '<path d="M20.6 14.9 22 13.4 20.6 12l-3.6 3.6L8.4 7l3.6-3.6L10.6 2 9.1 3.4 7.7 2 5.6 4.1 4.1 2.6 2.7 4.1l1.4 1.4L2 7.7l1.4 1.4L2 10.6 3.4 12 7 8.4l8.6 8.6-3.6 3.6 1.4 1.4 1.4-1.4 1.4 1.4 2.1-2.1 1.5 1.4 1.4-1.4-1.4-1.4 2.1-2.1z"/>',
    outdoor: '<path d="M14 6 10.3 11l2.8 3.8-1.6 1.2C9.8 13.8 7 10 7 10l-6 8h22z"/>',
    office: '<path d="M20 18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2H0v2h24v-2zM4 6h16v10H4z"/>',
    clock: '<path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7z"/>'
  };
  const bars = (n) => `<svg viewBox="0 0 24 24">${[0, 1, 2, 3].map((i) => `<rect x="${3 + i * 5}" y="${18 - i * 4}" width="3.5" height="${4 + i * 4}" rx="1" opacity="${i < n ? 1 : .25}"/>`).join("")}</svg>`;
  const PICKERS = [
    { key: "goal", title: "Workout goal", sub: "What do you want to focus on?", items: Gen.GOALS.map((g) => ({ id: g.id, label: g.label, svg: `<svg viewBox="0 0 24 24">${ICONS[g.icon]}</svg>` })) },
    { key: "location", title: "Location", sub: "Where are you training?", items: Gen.LOCATIONS.map((l) => ({ id: l.id, label: l.label, svg: `<svg viewBox="0 0 24 24">${ICONS[l.icon]}</svg>` })) },
    { key: "level", title: "Difficulty", sub: "Choose your level", items: Gen.LEVELS.map((l) => ({ id: l.id, label: l.label, svg: bars(l.bars) })) },
    { key: "length", title: "Workout length", sub: "How much time do you have?", items: Gen.LENGTHS.map((l) => ({ id: l.id, label: l.label, svg: `<svg viewBox="0 0 24 24">${ICONS.clock}</svg>` })) }
  ];
  const choice = { ...prefs };
  $("#pickers").innerHTML = PICKERS.map((p) => `
    <div class="picker" data-key="${p.key}">
      <h3>${p.title}</h3><p>${p.sub}</p>
      <div class="carousel">
        <button type="button" class="arrow" data-step="-1" aria-label="Previous ${p.title.toLowerCase()}"><svg viewBox="0 0 24 24"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6z"/></svg></button>
        <div class="choice" aria-live="polite"></div>
        <button type="button" class="arrow" data-step="1" aria-label="Next ${p.title.toLowerCase()}"><svg viewBox="0 0 24 24"><path d="M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z"/></svg></button>
      </div>
      <div class="dots" aria-hidden="true">${p.items.map(() => "<i></i>").join("")}</div>
    </div>`).join("");
  function renderPicker(el) {
    const p = PICKERS.find((x) => x.key === el.dataset.key);
    let i = p.items.findIndex((x) => String(x.id) === String(choice[p.key]));
    if (i < 0) { i = 0; choice[p.key] = p.items[0].id; }
    $(".choice", el).innerHTML = `${p.items[i].svg}<b>${esc(p.items[i].label)}</b>`;
    $$(".dots i", el).forEach((d, j) => d.classList.toggle("on", j === i));
    $$(".arrow", el).forEach((a) => (a.disabled = (a.dataset.step < 0 && i === 0) || (a.dataset.step > 0 && i === p.items.length - 1)));
  }
  function stepPicker(el, dir) {
    const p = PICKERS.find((x) => x.key === el.dataset.key);
    const i = p.items.findIndex((x) => String(x.id) === String(choice[p.key]));
    const n = Math.min(p.items.length - 1, Math.max(0, i + dir));
    choice[p.key] = p.items[n].id;
    renderPicker(el);
  }
  $$(".picker").forEach((el) => {
    renderPicker(el);
    $$(".arrow", el).forEach((a) => a.addEventListener("click", () => stepPicker(el, Number(a.dataset.step))));
    // Swipe the card left/right like the phone app
    let x0 = null;
    const c = $(".choice", el);
    c.addEventListener("pointerdown", (e) => (x0 = e.clientX));
    c.addEventListener("pointerup", (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 40) stepPicker(el, e.clientX < x0 ? 1 : -1); x0 = null; });
  });

  let current = null;
  const exLi = (e) => `<li><button type="button" class="ex" data-video="${e.id}">${thumbImg(e.id)}
    <span><b>${esc(e.name)}</b><span><span class="sets">${esc(e.sets)}</span> · ${esc(e.region)} · ${esc(e.cat)}</span></span></button></li>`;
  function renderGenerated() {
    $("#generated").hidden = false;
    $("#gen-title").textContent = current.title;
    const loc = Gen.LOCATIONS.find((l) => l.id === current.location);
    $("#gen-meta").textContent = `${current.minutes} min · ${current.exercises.length} exercises · ${current.levelLabel} · ${loc ? loc.label : ""}. Tap an exercise to watch Dr. Jared demo it.`;
    let last = "";
    $("#gen-list").innerHTML = current.exercises.map((e) => {
      const head = e.block !== last ? `<li class="block-tag">${esc(e.block)}</li>` : "";
      last = e.block;
      return head + exLi(e);
    }).join("");
  }
  function generateNow(seed = Date.now()) {
    current = Gen.generate({ ...choice, seed });
    Object.assign(prefs, choice);
    store.set(PREFS_KEY, prefs);
    // This becomes today's workout on Home too
    store.set(TODAY_KEY, { date: todayInTz(), workout: current });
    renderToday();
    renderGenerated();
  }
  $("#generate").addEventListener("click", () => { generateNow(); $("#generated").scrollIntoView({ behavior: "smooth", block: "start" }); });
  $("#shuffle").addEventListener("click", () => generateNow());
  $("#start-gen").addEventListener("click", () => current && startPlayer(current));

  // ================= Videos
  const CATS = ["All", ...["Strength", "Mobility", "Activation", "Rehab", "Power", "Neuroglide", "Posture", "Lifestyle", "Desk & posture"].filter((c) => EX.some((e) => e.cat === c))];
  const REGIONS = [...new Set(EX.map((e) => e.region))].sort();
  const vf = { q: "", cat: "All", region: "" };
  $("#vid-count").textContent = EX.length;
  $("#lib-count").textContent = `${EX.length} exercises`;
  $("#vid-cats").innerHTML = CATS.map((c) => `<button type="button" class="chip" role="tab" data-cat="${esc(c)}" aria-selected="${c === "All"}">${esc(c)}</button>`).join("");
  $("#vid-region").innerHTML = `<option value="">All body areas</option>` + REGIONS.map((r) => `<option>${esc(r)}</option>`).join("");
  $("#vid-cats").addEventListener("click", (e) => {
    const c = e.target.closest("[data-cat]");
    if (!c) return;
    vf.cat = c.dataset.cat;
    $$("#vid-cats .chip").forEach((x) => x.setAttribute("aria-selected", x === c));
    renderVideos();
  });
  $("#vid-region").addEventListener("change", (e) => { vf.region = e.target.value; renderVideos(); });
  $("#vid-search").addEventListener("input", (e) => { vf.q = e.target.value.trim().toLowerCase(); renderVideos(); });
  const vcard = (e) => `<button type="button" class="vcard" data-video="${e.id}">${thumbImg(e.id)}<div><b>${esc(e.name)}</b><span>${esc(e.region)} · L${e.level}</span></div></button>`;
  function renderVideos() {
    const list = EX.filter((e) => (vf.cat === "All" || e.cat === vf.cat) && (!vf.region || e.region === vf.region)
      && (!vf.q || (e.name + " " + e.region + " " + e.cat).toLowerCase().includes(vf.q)))
      .sort((a, b) => a.region.localeCompare(b.region) || a.level - b.level || a.name.localeCompare(b.name));
    $("#vgrid").innerHTML = list.map(vcard).join("");
    $("#vid-empty").hidden = list.length > 0;
  }

  // ================= Pain tool
  // Areas follow Dr. Jared's referred-pain guides; rc = exercise library regions to suggest videos from.
  const PAIN = {
    front: [
      { id: "head", label: "Head", sub: "Forehead, temples", area: "Neck", rc: ["NK"], guides: ["posterior-neck"],
        sources: [["Suboccipital muscles", "Tight muscles at the base of the skull can send pain to the forehead, behind the eye and the temple, often mistaken for migraine."]] },
      { id: "neck", label: "Neck", sub: "Front and sides", area: "Neck", rc: ["NK", "ERG"], guides: ["scalenes", "posterior-neck"],
        sources: [["Scalenes", "Neck pain and stiffness that can spread into the shoulder, upper back and arm."], ["Levator scapulae", "Pain at the side of the neck into the top of the shoulder."]] },
      { id: "shoulder", label: "Shoulder", sub: "Front and outside", area: "Shoulder", rc: ["SH"], guides: ["rotator-cuff", "scalenes"],
        sources: [["Supraspinatus (rotator cuff)", "Pain at the top of the shoulder that can run down the outside of the arm, worse overhead."], ["Scalenes", "Can refer to the front and side of the shoulder and down the arm."]] },
      { id: "chest", label: "Chest & ribs", sub: "Front of rib cage", area: "Other", rc: ["SP", "UB"], guides: ["scalenes"],
        sources: [["Scalenes & intercostals", "Tight neck and rib muscles can refer pain to the chest wall and ribs. Chest pain with shortness of breath needs emergency care: call 911."]] },
      { id: "elbow", label: "Elbow", sub: "Forearm", area: "Elbow / wrist / hand", rc: ["EL", "WR"], guides: ["rotator-cuff", "scalenes"],
        sources: [["Rotator cuff", "Infraspinatus and teres minor can refer down the outside of the arm toward the forearm."], ["Scalenes", "Tight scalenes can send pain down the arm and forearm."]] },
      { id: "wrist", label: "Wrist & hand", sub: "Fingers, thumb", area: "Elbow / wrist / hand", rc: ["WR", "EL"], guides: ["scalenes", "rotator-cuff"],
        sources: [["Scalenes", "Can refer into the hand, often the thumb, index and middle fingers, sometimes with tingling."], ["Subscapularis", "Can refer down the inner arm toward the ring and little fingers."]] },
      { id: "hip", label: "Hip & groin", sub: "Front of hip", area: "Hip", rc: ["HP"], guides: ["iliopsoas", "lateral-hip"],
        sources: [["Iliacus", "A common, often overlooked source of groin and inner-thigh pain and hip tightness."], ["TFL", "Pain down the front-outside of the thigh, usually stopping at the knee."]] },
      { id: "thigh", label: "Thigh", sub: "Quads", area: "Hip", rc: ["LB", "HP"], guides: ["quads"],
        sources: [["Rectus femoris (quads)", "A deep ache at the front of the hip and thigh, common after long sitting."]] },
      { id: "knee", label: "Knee", sub: "Kneecap, shin", area: "Knee", rc: ["KN", "LB"], guides: ["quads", "calf"],
        sources: [["Quadriceps", "Pain above, below or around the kneecap, worse on stairs, squatting or after sitting."], ["Calf (gastrocnemius)", "Can radiate to the back of the knee."]] },
      { id: "ankle", label: "Ankle & foot", sub: "Arch, inner ankle", area: "Ankle / foot", rc: ["AN", "LB"], guides: ["calf"],
        sources: [["Tibialis posterior", "Pain on the inside of the ankle and arch, often with flat feet or overpronation."], ["Soleus", "Can refer to the Achilles and heel, and contribute to plantar fasciitis."]] }
    ],
    back: [
      { id: "head-b", label: "Back of head", sub: "Base of skull", area: "Neck", rc: ["NK"], guides: ["posterior-neck"],
        sources: [["Suboccipitals", "A deep ache at the base of the skull, a common driver of tension headaches."], ["Occipitalis", "Headache at the back of the head with scalp tenderness."]] },
      { id: "neck-b", label: "Neck & traps", sub: "Upper traps", area: "Neck", rc: ["NK", "ERG"], guides: ["posterior-neck", "scalenes"],
        sources: [["Levator scapulae", "Neck pain into the top of the shoulder and inner edge of the shoulder blade."], ["Upper posture", "Long desk hours load the back of the neck."]] },
      { id: "upper-back", label: "Upper back", sub: "Between shoulder blades", area: "Upper back", rc: ["SP", "SH", "ERG"], guides: ["scalenes"],
        sources: [["Scalenes", "Pain or burning between the shoulder blades that mimics rhomboid pain."]] },
      { id: "shoulder-b", label: "Shoulder blade", sub: "Back of shoulder", area: "Shoulder", rc: ["SH"], guides: ["rotator-cuff"],
        sources: [["Infraspinatus & teres minor", "Pain behind the shoulder that runs down the back-outside of the arm."]] },
      { id: "low-back", label: "Low back", sub: "Lumbar spine", area: "Lower back", rc: ["SP", "CO", "HP"], guides: ["iliopsoas"],
        sources: [["Psoas", "A tight psoas pulls the lumbar spine forward, loading the low back, often from long sitting."], ["Iliacus", "Pain at the back of the pelvis and high in the glute."]] },
      { id: "glute", label: "Glutes", sub: "Buttock, outer hip", area: "Hip", rc: ["HP"], guides: ["lateral-hip", "iliopsoas"],
        sources: [["Piriformis", "Pain from the middle of the glute down the back-outside of the thigh and calf."], ["Glute minimus", "Pain on the outside of the hip that travels down the side of the leg."]] },
      { id: "hamstring", label: "Hamstring", sub: "Back of thigh", area: "Hip", rc: ["LB", "HP"], guides: ["lateral-hip"],
        sources: [["Piriformis", "Its referral line runs down the back-outside of the thigh toward the calf."]] },
      { id: "calf", label: "Calf", sub: "Lower leg", area: "Ankle / foot", rc: ["LB", "AN"], guides: ["calf"],
        sources: [["Gastrocnemius", "Upper calf pain that can reach the back of the knee, often a deep cramp-like tightness."], ["Soleus", "Deeper, lower calf pain with standing and walking."]] },
      { id: "heel", label: "Heel & Achilles", sub: "Back of ankle", area: "Ankle / foot", rc: ["AN", "LB"], guides: ["calf"],
        sources: [["Soleus", "Refers to the Achilles and heel, and can contribute to plantar fasciitis."]] }
    ]
  };
  const ALL_PAIN = [...PAIN.front, ...PAIN.back];
  let side = "front";
  const picked = new Set();
  const personSvg = '<svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 1 1-2 2 2 2 0 0 1 2-2zm-3 20v-7H7.5V9a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v6H15v7z"/></svg>';
  function renderAreas() {
    $("#areas").innerHTML = PAIN[side].map((a) => `<button type="button" class="area" data-area="${a.id}" aria-pressed="${picked.has(a.id)}">
      <span class="aic">${personSvg}</span><span><b>${esc(a.label)}</b><small>${esc(a.sub)}</small></span><span class="radio" aria-hidden="true"></span></button>`).join("");
    const n = picked.size;
    $("#pain-go").disabled = !n;
    $("#pain-go").textContent = n ? `Show what may be causing it (${n})` : "Select an area";
  }
  $$(".seg [data-side]").forEach((b) => b.addEventListener("click", () => {
    side = b.dataset.side;
    $$(".seg [data-side]").forEach((x) => x.setAttribute("aria-selected", x === b));
    renderAreas();
  }));
  $("#areas").addEventListener("click", (e) => {
    const b = e.target.closest("[data-area]");
    if (!b) return;
    picked.has(b.dataset.area) ? picked.delete(b.dataset.area) : picked.add(b.dataset.area);
    renderAreas();
  });
  const gentleFor = (rc, n) => EX.filter((e) => rc.includes(e.rc) && ["Mobility", "Rehab", "Neuroglide", "Posture", "Desk & posture"].includes(e.cat) && e.level <= 4)
    .sort((a, b) => rc.indexOf(a.rc) - rc.indexOf(b.rc) || a.level - b.level).slice(0, n);
  $("#pain-go").addEventListener("click", () => {
    const areas = ALL_PAIN.filter((a) => picked.has(a.id));
    $("#pain-results").innerHTML = areas.map((a) => `
      <div class="card result" data-result="${a.id}">
        <span class="label gold">Possible sources</span>
        <h3>${esc(a.label)}</h3>
        <ul class="src">${a.sources.map(([t, d]) => `<li><b>${esc(t)}</b>${esc(d)}</li>`).join("")}</ul>
        ${a.guides.length ? `<div class="guides">${a.guides.map((g) => `<button type="button" class="guide" data-guide="${g}"><img src="assets/pain/guide-${g}-thumb.webp" alt="" width="52" height="78" loading="lazy"><span><b>${esc(GUIDES[g])}</b><span>Open Dr. Jared's guide</span></span></button>`).join("")}</div>` : ""}
        <p class="label" style="margin-top:16px">Gentle relief videos</p>
        <div class="mini-vids">${gentleFor(a.rc, 3).map(vcard).join("")}</div>
        <div class="log-row"><label>Pain now: <output>5</output>/10<input type="range" min="0" max="10" value="5" aria-label="Pain level for ${esc(a.label)}"></label><button type="button" class="btn-gold sm" data-log="${esc(a.area)}">Log it</button></div>
        <div class="row"><a class="btn-blue sm" href="/book">Book an evaluation</a><button type="button" class="btn-ghost sm" data-goto="videos">More videos</button></div>
      </div>`).join("") + `<p class="muted tiny center">Educational only. Sudden, severe, or worsening pain, numbness, or weakness needs prompt medical care.</p>`;
    $("#pain-results").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#pain-results").addEventListener("input", (e) => { if (e.target.type === "range") e.target.closest(".log-row").querySelector("output").textContent = e.target.value; });
  $("#pain-results").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-log]");
    if (!b) return;
    const row = b.closest(".log-row"), a = ALL_PAIN.find((x) => x.id === b.closest("[data-result]").dataset.result);
    b.disabled = true;
    try {
      await apiAuth("POST", "/api/me/pain", { area: b.dataset.log, level: Number($("input", row).value), note: a.label });
      await loadPain();
      b.textContent = "Logged"; toast("Saved to your pain tracker.");
    } catch (err) { toast(err.message); b.disabled = false; }
  });

  // ================= Profile
  function renderProfile() {
    const first = (client.name || "there").split(" ")[0];
    $("#hello-name").textContent = first;
    $("#avatar").textContent = first[0].toUpperCase();
    $("#p-name").textContent = client.name;
    $("#p-email").textContent = client.email;
    const f = $("#profile-form");
    f.name.value = client.name; f.email.value = client.email; f.phone.value = client.phone || "";
  }
  wire($("#profile-form"), async (d) => {
    const r = await apiAuth("PUT", "/api/me", { name: d.name, phone: d.phone });
    client = r.client; auth.set({ ...auth.get(), client }); renderProfile();
    return { message: "Saved." };
  }, { reset: false });
  wire($("#password-form"), async (d) => {
    auth.set(await apiAuth("PUT", "/api/me/password", d));
    return { message: "Password changed. Other devices were signed out." };
  });
  $("#logout").addEventListener("click", () => { auth.clear(); location.href = "/"; });

  async function loadAppointments() {
    appts = await apiAuth("GET", "/api/me/appointments");
    $("#p-appts").innerHTML = appts.upcoming.map((a) => apptLi(a, { cancel: true, cal: true })).join("") ||
      `<li class="muted small">No visits booked. <a class="link-sm" href="/book">Book one</a></li>`;
    $("#p-history").innerHTML = appts.past.slice(0, 20).map((a) => apptLi(a)).join("") || `<li class="muted small">Past visits show up here.</li>`;
  }
  $("#p-appts").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-cancel]");
    if (!b || !confirm("Cancel this appointment? The time opens up for someone else.")) return;
    b.disabled = true;
    try { await apiAuth("POST", `/api/me/appointments/${b.closest("[data-appt]").dataset.appt}/cancel`, {}); await loadAppointments(); renderEvents(); renderNotes(); toast("Appointment cancelled."); }
    catch (err) { toast(err.message); b.disabled = false; }
  });

  // Pain tracker
  const pf = $("#pain-form"), pout = $("output", pf);
  pf.area.innerHTML = AREAS.map((a) => `<option>${esc(a)}</option>`).join("");
  pf.level.addEventListener("input", () => (pout.textContent = pf.level.value));
  wire(pf, async (d) => {
    await apiAuth("POST", "/api/me/pain", { area: d.area, level: Number(d.level), note: d.note });
    $("#chart-area").value = d.area;
    await loadPain();
    pf.note.value = "";
    return { message: "Logged." };
  }, { reset: false });
  $("#chart-area").addEventListener("change", renderChart);

  async function loadPain() {
    painLog = await apiAuth("GET", "/api/me/pain");
    const areas = [...new Set(painLog.map((e) => e.area))];
    const sel = $("#chart-area"), keep = sel.value;
    sel.innerHTML = areas.length ? areas.map((a) => `<option>${esc(a)}</option>`).join("") : `<option>${esc(pf.area.value)}</option>`;
    if (areas.includes(keep)) sel.value = keep;
    else if (areas.length) sel.value = painLog[painLog.length - 1].area;
    $("#entry-count").textContent = painLog.length;
    $("#entries").innerHTML = `<thead><tr><th>Date</th><th>Area</th><th>Pain</th><th>Note</th><th></th></tr></thead><tbody>${
      painLog.length ? painLog.slice().reverse().map((e) => `<tr data-id="${e.id}"><td>${shortDate(e.date)}</td><td>${esc(e.area)}</td><td>${e.level}/10</td><td>${esc(e.note)}</td><td><button type="button" data-del>Delete</button></td></tr>`).join("")
      : `<tr><td colspan="5" class="muted">No entries yet.</td></tr>`}</tbody>`;
    renderChart();
    renderActivity();
  }
  $("#entries").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-del]");
    if (!b) return;
    await apiAuth("DELETE", `/api/me/pain/${b.closest("tr").dataset.id}`);
    loadPain();
  });

  // Single-series line chart: pain level (0-10) over time for one area. The table under "All entries" is the data view.
  function renderChart() {
    const area = $("#chart-area").value, box = $("#chart");
    const pts = painLog.filter((e) => e.area === area);
    if (pts.length < 2) {
      box.innerHTML = `<p class="empty">${pts.length ? "Log one more day to see your trend." : "Log your pain a few times a week to see your trend here."}</p>`;
      return;
    }
    const W = 640, H = 220, L = 34, R = 16, T = 14, B = 30;
    const t = (d) => Date.parse(d + "T12:00:00Z");
    const x0 = t(pts[0].date), x1 = Math.max(t(pts[pts.length - 1].date), x0 + 864e5);
    const X = (d) => L + ((t(d) - x0) / (x1 - x0)) * (W - L - R);
    const Y = (v) => T + (1 - v / 10) * (H - T - B);
    const xy = pts.map((p) => [X(p.date), Y(p.level)]);
    const grid = [0, 5, 10].map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${L - 8}" y="${Y(v) + 4}" class="axis" text-anchor="end">${v}</text>`).join("");
    const first = pts[0].date, last = pts[pts.length - 1].date, lastPt = xy[xy.length - 1];
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(area)} pain from ${shortDate(first)} to ${shortDate(last)}: latest ${pts[pts.length - 1].level} out of 10">
      ${grid}
      <text x="${L}" y="${H - 8}" class="axis">${shortDate(first)}</text>
      <text x="${W - R}" y="${H - 8}" class="axis" text-anchor="end">${shortDate(last)}</text>
      <polyline points="${xy.map((p) => p.join(",")).join(" ")}" class="line"/>
      ${xy.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" class="dot"/>`).join("")}
      <text x="${Math.min(lastPt[0], W - R - 4)}" y="${lastPt[1] - 12}" class="last-label" text-anchor="end">${pts[pts.length - 1].level}/10</text>
      ${xy.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="14" class="hit" data-i="${i}" tabindex="0"/>`).join("")}
    </svg><div class="tip" hidden></div>`;
    const tip = $(".tip", box);
    const showTip = (el) => {
      const p = pts[el.dataset.i], r = el.getBoundingClientRect(), br = box.getBoundingClientRect();
      tip.innerHTML = `<b>${p.level}/10</b> · ${shortDate(p.date)}${p.note ? `<br><span>${esc(p.note)}</span>` : ""}`;
      tip.hidden = false;
      tip.style.left = Math.min(Math.max(r.left - br.left + r.width / 2, 70), br.width - 70) + "px";
      tip.style.top = (r.top - br.top) + "px";
    };
    $$(".hit", box).forEach((el) => {
      ["mouseenter", "focus", "click"].forEach((ev) => el.addEventListener(ev, () => showTip(el)));
      ["mouseleave", "blur"].forEach((ev) => el.addEventListener(ev, () => (tip.hidden = true)));
    });
  }

  // Install as an app: Android/desktop Chrome get a button; iPhone gets Share → Add to Home Screen
  let installEvt = null;
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone) $("#install-card").hidden = true;
  else if (/iphone|ipad|ipod/i.test(navigator.userAgent)) $("#install-text").textContent = "On iPhone: tap Share in Safari, then “Add to Home Screen”.";
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; $("#install-btn").hidden = false; });
  $("#install-btn").addEventListener("click", async () => {
    if (!installEvt) return;
    installEvt.prompt();
    await installEvt.userChoice.catch(() => {});
    installEvt = null; $("#install-btn").hidden = true;
  });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

  // ================= Workout player
  const P = { w: null, i: 0, start: 0, tick: null };
  const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  function startPlayer(w) {
    P.w = w; P.i = 0; P.start = Date.now();
    $("#player").hidden = false;
    document.body.style.overflow = "hidden";
    clearInterval(P.tick);
    P.tick = setInterval(() => ($("#p-timer").textContent = fmtClock(Math.floor((Date.now() - P.start) / 1000))), 1000);
    $("#p-timer").textContent = "0:00";
    renderStep();
  }
  function closePlayer() {
    clearInterval(P.tick);
    $("#player").hidden = true;
    $("#p-body").innerHTML = "";
    document.body.style.overflow = "";
  }
  function renderStep() {
    const list = P.w.exercises, n = list.length;
    if (P.i >= n) return finish();
    const e = list[P.i], next = list[P.i + 1];
    $("#p-step").textContent = `Exercise ${P.i + 1} of ${n}`;
    $("#p-bar").style.width = `${(P.i / n) * 100}%`;
    $("#p-body").innerHTML = `
      <div class="frame"><iframe src="https://drive.google.com/file/d/${encodeURIComponent(e.id)}/preview" title="${esc(e.name)} demo" allow="autoplay; fullscreen" allowfullscreen></iframe></div>
      <p class="p-block">${esc(e.block)}</p>
      <h2 class="p-name">${esc(e.name)}</h2>
      <p class="p-sets">${esc(e.sets)}</p>
      <p class="p-meta">${esc(exMeta(e))}</p>
      ${next ? `<div class="p-next">Up next: <b>${esc(next.name)}</b> · ${esc(next.sets)}</div>` : `<div class="p-next">Last one. Finish strong.</div>`}`;
    $("#p-prev").disabled = P.i === 0;
    $("#p-next").textContent = P.i === n - 1 ? "Finish" : "Next";
  }
  async function finish() {
    clearInterval(P.tick);
    const secs = Math.floor((Date.now() - P.start) / 1000), minutes = Math.min(300, Math.max(1, Math.round(secs / 60)));
    $("#p-bar").style.width = "100%";
    $("#p-step").textContent = "Complete";
    $("#p-prev").disabled = true;
    $("#p-next").textContent = "Done";
    $("#p-body").innerHTML = `<div class="done"><div class="big-check"><svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg></div>
      <h2>Workout complete</h2><p class="muted">${esc(P.w.title)}</p><p class="muted small" id="done-msg">Saving…</p></div>`;
    try {
      const r = await apiAuth("POST", "/api/me/workouts", { title: P.w.title.slice(0, 80), goal: P.w.goal, minutes, exercises: P.w.exercises.length });
      stats = { ...r.stats, recent: [r.workout, ...((stats && stats.recent) || [])].slice(0, 10) };
      $("#done-msg").outerHTML = `<div class="stats3"><div><b>${r.stats.streak}</b><span>Day streak</span></div><div><b>${minutes}</b><span>Minutes</span></div><div><b>${r.stats.workouts}</b><span>Workouts</span></div></div>`;
      renderStats(); renderActivity(); renderNotes();
    } catch (err) { $("#done-msg").textContent = "Couldn't save this workout: " + err.message; }
    P.i = P.w.exercises.length + 1;
  }
  $("#p-next").addEventListener("click", () => { if (P.i > P.w.exercises.length) return closePlayer(); P.i++; renderStep(); });
  $("#p-prev").addEventListener("click", () => { if (P.i > 0) { P.i--; renderStep(); } });
  $("#p-close").addEventListener("click", () => { if (P.i > P.w.exercises.length || confirm("End this workout? It won't be saved.")) closePlayer(); });

  // ================= Load
  show(location.hash.slice(1) || "home");
  renderProfile(); renderStats(); renderToday(); renderAreas(); renderPlan();
  (async () => {
    try {
      const r = await apiAuth("GET", "/api/me");
      client = r.client; auth.set({ ...auth.get(), client });
      renderProfile(); renderPlan();
    } catch (err) { toast("Couldn't reach MD Fit right now. Call 941-313-0562 if you need help."); return; }
    const [s, , , sched] = await Promise.allSettled([
      apiAuth("GET", "/api/me/stats"), loadAppointments(), loadPain(), api("/api/schedule?days=14")
    ]);
    if (s.status === "fulfilled") stats = s.value;
    if (sched.status === "fulfilled") classes = sched.value.sessions || [];
    renderStats(); renderEvents(); renderActivity(); renderNotes();
    loadSite().catch(() => {});
  })();
})();
