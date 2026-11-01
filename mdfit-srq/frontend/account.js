// MD Fit client app (/account): Home, Generate, Videos, Pain Tool, Profile, plus the workout player.
(() => {
  const { $, $$, esc, auth, apiAuth, api, wire, fmtDate, fmtTime, todayInTz, addDays, zonedToUtc, icsStamp, AREAS, loadSite } = window.MDFit;
  if (!auth.get()) { location.replace("/login?next=" + encodeURIComponent("/account" + location.hash)); return; }
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
  let client = auth.client(), stats = null, appts = { upcoming: [], past: [] }, painLog = [], classes = [], allWorkouts = [], reward = null;
  let lib = { favorites: [], programs: [] };

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false; t.classList.remove("celebrate");
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 3200);
  }

  // ================= Tabs (hash routing so the back button and refresh work)
  const TABS = ["home", "generate", "programs", "videos", "pain", "learn", "progress", "premium", "tips", "profile"];
  // Hash is "#tab" or "#pain/muscle/<id>" (deep link to a muscle report)
  function show(hash) {
    let [tab, sub, arg] = String(hash).split("/");
    if (!TABS.includes(tab)) tab = "home";
    if (tab === "pain" && sub === "muscle" && arg) setTimeout(() => openReport(arg, false), 0);
    else if (tab === "pain" && sub === "track" && arg) setTimeout(() => openTrack(arg), 0);
    else if (tab === "pain" && !$("#muscle-report").hidden) setMode(reportFrom);
    $$("[data-view]").forEach((v) => (v.hidden = v.dataset.view !== tab));
    $$(".tabbar [data-tab]").forEach((b) => (b.dataset.tab === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
    if (tab === "videos") renderVideos();
    if (tab === "progress") renderCalendar();
    if (["programs", "learn", "premium", "tips"].includes(tab)) renderContent(tab, sub);
    $("#more-btn").classList.toggle("on", $$(".tabbar .ov").some((b) => b.dataset.tab === tab));
    const ms = $("#more-sheet"); if (ms.open) ms.close();
    window.scrollTo(0, 0);
  }
  const go = (tab) => { if (location.hash !== "#" + tab) history.pushState(null, "", "#" + tab); show(tab); };
  window.addEventListener("hashchange", () => show(location.hash.slice(1)));
  $$(".tabbar [data-tab]").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
  document.addEventListener("click", (e) => { const g = e.target.closest("[data-goto]"); if (g) go(g.dataset.goto); });
  // Phones show five tabs plus "More"; the rest live in a sheet
  $("#more-list").innerHTML = $$(".tabbar .ov").map((b) => `<button type="button" data-goto="${b.dataset.tab}">${b.querySelector("svg").outerHTML}<span>${b.querySelector(".long").innerHTML}</span></button>`).join("");
  $("#more-btn").addEventListener("click", () => $("#more-sheet").showModal());

  // ================= Dialogs: exercise videos, guides, intros
  const vd = $("#video-dialog");
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
    if (g) window.MDFitGuides.open(g.dataset.guide);
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
  const PREFS_KEY = "mdfit_prefs2", TODAY_KEY = "mdfit_today2";
  const saved = store.get(PREFS_KEY, {});
  const prefs = { ...Gen.DEFAULTS, ...saved, addons: { ...Gen.DEFAULTS.addons, ...(saved.addons || {}) } };
  const daySeed = (d) => [...d].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  function todaysWorkout() {
    const t = todayInTz(), s = store.get(TODAY_KEY, null);
    if (s && s.date === t && s.workout && s.workout.circuit) return s.workout;
    const w = Gen.generate({ ...prefs, seed: daySeed(t + (client?.id || "")) });
    store.set(TODAY_KEY, { date: t, workout: w });
    return w;
  }
  const planLine = (w) => `${w.circuit.length} exercises × ${w.rounds} round${w.rounds === 1 ? "" : "s"}`;
  function renderToday() {
    const w = todaysWorkout();
    $("#today-title").textContent = w.title;
    $("#today-meta").textContent = `About ${w.minutes} min · ${planLine(w)} · ${w.levelLabel}`;
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
        <button type="button" class="guide" data-guide="${g}"><img src="assets/guides/${g}-thumb.webp" alt="" width="52" height="52" loading="lazy">
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

  // ================= Generate: numbered steps, summary and add-ons (MD Fit generator design)
  const ICONS = {
    upper: '<path d="M12 2a3 3 0 1 1-3 3 3 3 0 0 1 3-3zM3 9h18v2h-6v11h-2v-6h-2v6H9V11H3z"/>',
    lower: '<path d="M9 2h6l1 9-1.5 11h-2L12 14l-.5 8h-2L8 11z"/>',
    full: '<path d="M12 2a2.5 2.5 0 1 1-2.5 2.5A2.5 2.5 0 0 1 12 2zM21 9h-6v13h-2v-6h-2v6H9V9H3V7h18z"/>',
    core: '<path d="M8 3h8v18H8zm2 2v3h4V5zm0 5v3h4v-3zm0 5v4h4v-4z"/>',
    mobility: '<path d="M13.5 5.5a2 2 0 1 0-2-2 2 2 0 0 0 2 2zM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2a5.2 5.2 0 0 1-4.5-2.5l-1-1.6a2 2 0 0 0-1.7-1 2 2 0 0 0-.8.2L6 8.3V13h2V9.6z"/>',
    home: '<path d="M12 3 2 12h3v8h5v-6h4v6h5v-8h3z"/>',
    gym: '<path d="M20.6 14.9 22 13.4 20.6 12l-3.6 3.6L8.4 7l3.6-3.6L10.6 2 9.1 3.4 7.7 2 5.6 4.1 4.1 2.6 2.7 4.1l1.4 1.4L2 7.7l1.4 1.4L2 10.6 3.4 12 7 8.4l8.6 8.6-3.6 3.6 1.4 1.4 1.4-1.4 1.4 1.4 2.1-2.1 1.5 1.4 1.4-1.4-1.4-1.4 2.1-2.1z"/>',
    outdoor: '<path d="M14 6 10.3 11l2.8 3.8-1.6 1.2C9.8 13.8 7 10 7 10l-6 8h22z"/>',
    office: '<path d="M20 18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2H0v2h24v-2zM4 6h16v10H4z"/>'
  };
  const svgIc = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;
  const bars = (n) => `<span class="bars-ic" aria-hidden="true">${[1, 2, 3, 4].map((i) => `<i class="${i <= n ? "on" : ""}" style="height:${6 + i * 6}px"></i>`).join("")}</span>`;
  const secs = (v) => (v ? `${v} sec` : "None");
  const choice = { ...prefs, addons: { ...prefs.addons } };
  // type "cards" = big tiles, "pills" = number chips. Each step reads/writes choice[key].
  const STEPS = [
    { key: "goal", title: "Workout goal / type", sub: "Choose the primary focus.", type: "cards", items: Gen.GOALS.map((g) => ({ v: g.id, html: `${svgIc(g.icon)}<b>${esc(g.label)}</b>` })) },
    { key: "location", title: "Location", sub: "Where will you be working out?", type: "cards", items: Gen.LOCATIONS.map((l) => ({ v: l.id, html: `${svgIc(l.icon)}<b>${esc(l.label)}</b>` })) },
    { key: "level", title: "Difficulty level", sub: "Match the workout to your current ability.", type: "cards", items: Gen.LEVELS.map((l) => ({ v: l.id, html: `${bars(l.bars)}<b>${l.label}</b><small>${l.hint}</small>` })) },
    { key: "length", title: "Workout length", sub: "Sets exercises, rounds and rest to fit. Fine-tune below.", type: "pills", items: Gen.LENGTHS.map((n) => ({ v: n, html: `<b>${n}</b><small>min</small>` })) },
    { key: "perRound", title: "Exercises per round", sub: "How many different exercises in each round?", type: "pills", items: Gen.PER_ROUND.map((n) => ({ v: n, html: `<b>${n}</b>` })) },
    { key: "rounds", title: "Rounds", sub: "How many total rounds of the workout?", type: "pills", items: Gen.ROUNDS.map((n) => ({ v: n, html: `<b>${n}</b>` })) },
    { key: "restEx", title: "Rest between exercises", sub: "How much rest between each exercise?", type: "pills", items: Gen.REST_EX.map((n) => ({ v: n, html: n ? `<b>${n}</b><small>sec</small>` : `<b>None</b><small>0 sec</small>` })) },
    { key: "restRound", title: "Rest between rounds", sub: "How much rest between each round?", type: "pills", items: Gen.REST_ROUND.map((n) => ({ v: n, html: n ? `<b>${n}</b><small>sec</small>` : `<b>None</b><small>0 sec</small>` })) }
  ];
  const stepHtml = (st, i) => `
    <section class="step" data-key="${st.key}">
      <div class="step-head"><span class="step-num">${i + 1}</span><div><h3>${st.title}</h3><p>${st.sub}</p></div></div>
      <div class="${st.type === "cards" ? "opt-cards" : "pills"}" role="radiogroup" aria-label="${esc(st.title)}">
        ${st.items.map((it) => `<button type="button" class="${st.type === "cards" ? "opt" : "pill"}" role="radio" data-v="${it.v}">${it.html}</button>`).join("")}
      </div>
    </section>`;
  // Steps 1, 4 full width; 2+3, 5+6, 7+8 pair up on wider screens
  $("#steps").innerHTML = [stepHtml(STEPS[0], 0), `<div class="step-pair">${stepHtml(STEPS[1], 1)}${stepHtml(STEPS[2], 2)}</div>`, stepHtml(STEPS[3], 3),
    `<div class="step-pair">${stepHtml(STEPS[4], 4)}${stepHtml(STEPS[5], 5)}</div>`, `<div class="step-pair">${stepHtml(STEPS[6], 6)}${stepHtml(STEPS[7], 7)}</div>`].join("");
  $("#addons").innerHTML = Gen.ADDONS.map((a) => `<li><button type="button" class="toggle" role="switch" data-addon="${a.id}"><span>${esc(a.label)}</span><i aria-hidden="true"></i></button></li>`).join("");

  function renderChoices() {
    $$("#steps .step").forEach((el) => $$("[data-v]", el).forEach((b) => b.setAttribute("aria-checked", String(b.dataset.v) === String(choice[el.dataset.key]))));
    $$("#addons [data-addon]").forEach((b) => b.setAttribute("aria-checked", String(!!choice.addons[b.dataset.addon])));
    const G = Gen.GOALS.find((g) => g.id === choice.goal), Lo = Gen.LOCATIONS.find((l) => l.id === choice.location), Lv = Gen.LEVELS.find((l) => l.id === choice.level);
    const est = Gen.estimate({ warm: choice.addons.warmup ? (choice.length <= 15 ? 1 : 2) : 0, cool: choice.addons.cooldown ? (choice.length <= 20 ? 1 : 2) : 0, ...choice });
    const rows = [["Type", G.label], ["Location", Lo.label], ["Difficulty", Lv.label], ["Estimated time", `${est} min`, "est"],
      ["Exercises per round", choice.perRound], ["Total rounds", choice.rounds], ["Rest between exercises", secs(choice.restEx)], ["Rest between rounds", secs(choice.restRound)]];
    $("#summary").innerHTML = rows.map(([k, v, c]) => `<dt>${k}</dt><dd${c ? ` class="${c}"` : ""}>${esc(v)}</dd>`).join("");
  }
  $("#steps").addEventListener("click", (e) => {
    const b = e.target.closest("[data-v]");
    if (!b) return;
    const key = b.closest(".step").dataset.key, num = ["length", "perRound", "rounds", "restEx", "restRound"].includes(key);
    choice[key] = num ? Number(b.dataset.v) : b.dataset.v;
    if (key === "length") Object.assign(choice, Gen.presetFor(choice.length));
    renderChoices();
  });
  $("#addons").addEventListener("click", (e) => {
    const b = e.target.closest("[data-addon]");
    if (!b) return;
    choice.addons[b.dataset.addon] = !choice.addons[b.dataset.addon];
    renderChoices();
  });
  $("#randomize").addEventListener("click", () => {
    const any = (arr) => arr[Math.floor(Math.random() * arr.length)];
    choice.goal = any(Gen.GOALS).id; choice.location = any(Gen.LOCATIONS).id; choice.level = any(Gen.LEVELS).id;
    choice.length = any(Gen.LENGTHS); Object.assign(choice, Gen.presetFor(choice.length));
    renderChoices();
  });

  let current = null;
  const exLi = (e) => `<li><button type="button" class="ex" data-video="${e.id}">${thumbImg(e.id)}
    <span><b>${esc(e.name)}</b><span><span class="sets">${esc(e.sets)}</span> · ${esc(e.region)} · ${esc(e.cat)}</span></span></button></li>`;
  function renderGenerated() {
    const w = current, loc = Gen.LOCATIONS.find((l) => l.id === w.location);
    $("#generated").hidden = false;
    $("#gen-title").textContent = w.title;
    $("#gen-meta").textContent = `About ${w.minutes} min · ${planLine(w)} · ${w.levelLabel} · ${loc ? loc.label : ""}. Tap any exercise to watch Dr. Jared demo it.`;
    const swapLi = (block) => (e, i) => `<li class="ex-swap">${exLi(e).slice(4, -5)}<button type="button" class="swap-btn" data-swap="${block}" data-i="${i}" aria-label="Swap ${esc(e.name)} for another movement" title="Swap for another movement"><svg viewBox="0 0 24 24"><path d="M7 7h11l-3-3 1.4-1.4L22 8l-5.6 5.4L15 12l3-3H7zm10 10H6l3 3-1.4 1.4L2 16l5.6-5.4L9 12l-3 3h11z"/></svg></button></li>`;
    const group = (label, list, block, note = "") => list.length ? `<li class="block-tag">${label}${note ? `<span>${note}</span>` : ""}</li>${list.map(swapLi(block)).join("")}` : "";
    $("#gen-list").innerHTML = group("Warm-up · plays once", w.warmup, "Warm-up")
      + group(`Circuit × ${w.rounds} round${w.rounds === 1 ? "" : "s"}`, w.circuit, "Circuit", [w.restEx && `${w.restEx}s between exercises`, w.restRound && w.rounds > 1 && `${w.restRound}s between rounds`].filter(Boolean).join(" · "))
      + group("Cool-down · starts automatically", w.cooldown, "Cool-down");
  }
  function generateNow(seed = Date.now()) {
    current = Gen.generate({ ...choice, seed });
    Object.assign(prefs, choice, { addons: { ...choice.addons } });
    store.set(PREFS_KEY, prefs);
    // This becomes today's workout on Home too
    store.set(TODAY_KEY, { date: todayInTz(), workout: current });
    renderToday();
    renderGenerated();
  }
  $("#generate").addEventListener("click", () => { generateNow(); $("#generated").scrollIntoView({ behavior: "smooth", block: "start" }); });
  $("#shuffle").addEventListener("click", () => generateNow());
  // Swap one movement for a random alternative that fits the same slot
  $("#gen-list").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-swap]"); if (!b || !current) return;
    ev.stopPropagation();
    const before = current;
    current = Gen.swap(current, b.dataset.swap, Number(b.dataset.i), Date.now());
    if (current === before) return toast("No other movement fits that slot.");
    store.set(TODAY_KEY, { date: todayInTz(), workout: current });
    renderToday(); renderGenerated();
    const li = $$(`#gen-list [data-swap="${b.dataset.swap}"]`)[Number(b.dataset.i)];
    if (li) li.closest("li").classList.add("swapped");
  });
  $("#start-gen").addEventListener("click", () => current && startPlayer(current));
  renderChoices();

  // ---- My programs: saved workouts, kept on the account
  const compact = (arr) => arr.map((e) => ({ id: e.id, sets: e.sets }));
  const expand = (arr, block) => arr.map((x) => byId.get(x.id) && { ...byId.get(x.id), sets: x.sets, block }).filter(Boolean);
  function programWorkout(p) {
    const w = p.workout, warmup = expand(w.warmup, "Warm-up"), circuit = expand(w.circuit, "Circuit"), cooldown = expand(w.cooldown, "Cool-down");
    return { ...w, key: "program-" + p.id, title: p.name, warmup, circuit, cooldown, exercises: [...warmup, ...circuit, ...cooldown], perRound: circuit.length };
  }
  const programLi = (p, del) => {
    const w = p.workout;
    return `<li class="program" data-program="${p.id}"><span class="pg-ic"><svg viewBox="0 0 24 24"><path d="M15 6H3v2h12zm0 4H3v2h12zM3 16h8v-2H3zM17 6v8.2A3 3 0 1 0 19 17V8h3V6z"/></svg></span>
      <div><b>${esc(p.name)}</b><span>${esc(w.goal)} · ${w.circuit.length} × ${w.rounds} rounds · about ${w.minutes} min</span></div>
      <button type="button" class="ev-act" data-play>Start</button>${del ? `<button type="button" class="icon-btn pg-del" data-del-program aria-label="Delete ${esc(p.name)}"><svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"/></svg></button>` : ""}</li>`;
  };
  function renderPrograms() {
    const ps = lib.programs;
    $("#my-programs").hidden = !ps.length;
    $("#program-count").textContent = ps.length ? `${ps.length} saved` : "";
    $("#program-list").innerHTML = ps.map((p) => programLi(p, true)).join("");
    $("#home-programs").hidden = !ps.length;
    $("#home-program-list").innerHTML = ps.slice(0, 3).map((p) => programLi(p, false)).join("");
  }
  document.addEventListener("click", async (e) => {
    const li = e.target.closest("[data-program]");
    if (!li) return;
    const p = lib.programs.find((x) => x.id === li.dataset.program);
    if (!p) return;
    if (e.target.closest("[data-play]")) return startPlayer(programWorkout(p));
    if (e.target.closest("[data-del-program]") && confirm(`Delete "${p.name}" from My Programs?`)) {
      try { lib = await apiAuth("DELETE", `/api/me/programs/${p.id}`); renderPrograms(); } catch (err) { toast(err.message); }
    }
  });
  $("#save-program").addEventListener("click", async () => {
    if (!current) return;
    const name = prompt("Name this program", current.title);
    if (!name || !name.trim()) return;
    const w = current;
    try {
      lib = await apiAuth("POST", "/api/me/programs", { name: name.trim().slice(0, 60), workout: {
        title: w.title, goal: w.goal, goalId: w.goalId, location: w.location, level: w.level, levelLabel: w.levelLabel,
        rounds: w.rounds, restEx: w.restEx, restRound: w.restRound, minutes: w.minutes,
        warmup: compact(w.warmup), circuit: compact(w.circuit), cooldown: compact(w.cooldown) } });
      renderPrograms(); toast(`Saved "${name.trim()}" to My Programs.`);
    } catch (err) { toast(err.message); }
  });

  // ================= Videos: by location first, then Dr. Jared's categories, grouped by primary joint or muscle
  const LIB = window.MDFitLib;
  const CATS = ["All", "♥ Favorites", ...LIB.CATEGORIES];
  EX.forEach((e) => { e.libCat = LIB.category(e); e.joint = LIB.joint(e); e.muscle = LIB.muscle(e); });
  const LOCS = [{ id: "", label: "Everywhere" }, ...Gen.LOCATIONS.map((l) => ({ id: l.id, label: l.label }))];
  const locIds = Object.fromEntries(Gen.LOCATIONS.map((l) => [l.id, new Set(Gen.byLocation(l.id).map((e) => e.id))]));
  const vf = { q: "", cat: "All", region: "", loc: "", by: "joint" };
  $("#vid-locs").innerHTML = LOCS.map((l) => `<button type="button" role="tab" data-loc="${l.id}" aria-selected="${l.id === ""}">${esc(l.label)}</button>`).join("");
  $("#vid-locs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-loc]"); if (!b) return;
    vf.loc = b.dataset.loc; $$("#vid-locs button").forEach((x) => x.setAttribute("aria-selected", x === b)); renderVideos();
  });
  const groupsFor = () => (vf.by === "joint" ? LIB.JOINTS : LIB.MUSCLES);
  function fillJump() { $("#vid-region").innerHTML = `<option value="">All ${vf.by === "joint" ? "joints" : "muscles"}</option>` + groupsFor().map((r) => `<option>${esc(r)}</option>`).join(""); }
  fillJump();
  $("#vid-by").addEventListener("click", (e) => {
    const b = e.target.closest("[data-by]"); if (!b) return;
    vf.by = b.dataset.by; vf.region = ""; $$("#vid-by button").forEach((x) => x.setAttribute("aria-selected", x === b)); fillJump(); renderVideos();
  });
  $("#vid-count").textContent = EX.length;
  $("#lib-count").textContent = `${EX.length} exercises`;
  $("#vid-cats").innerHTML = CATS.map((c) => `<button type="button" class="chip" role="tab" data-cat="${esc(c)}" aria-selected="${c === "All"}">${esc(c)}</button>`).join("");
  $("#vid-cats").addEventListener("click", (e) => {
    const c = e.target.closest("[data-cat]");
    if (!c) return;
    vf.cat = c.dataset.cat;
    $$("#vid-cats .chip").forEach((x) => x.setAttribute("aria-selected", x === c));
    renderVideos();
  });
  $("#vid-region").addEventListener("change", (e) => { vf.region = e.target.value; renderVideos(); });
  $("#vid-search").addEventListener("input", (e) => { vf.q = e.target.value.trim().toLowerCase(); renderVideos(); });
  const isFav = (id) => lib.favorites.includes(id);
  const heart = (id) => `<button type="button" class="heart" data-fav="${id}" aria-pressed="${isFav(id)}" aria-label="${isFav(id) ? "Remove from" : "Add to"} favorites"><svg viewBox="0 0 24 24"><path d="M12 21 10.6 19.7C5.4 15 2 11.9 2 8.1 2 5 4.4 2.6 7.5 2.6c1.7 0 3.4.8 4.5 2.1 1.1-1.3 2.8-2.1 4.5-2.1C19.6 2.6 22 5 22 8.1c0 3.8-3.4 6.9-8.6 11.6z"/></svg></button>`;
  const vcard = (e) => `<div class="vwrap"><button type="button" class="vcard" data-video="${e.id}">${thumbImg(e.id)}<div><b>${esc(e.name)}</b><span>${esc(e.libCat)} · L${e.level}</span></div></button>${heart(e.id)}</div>`;
  // Favorites live on the account (not the phone), so they follow the client to any device
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-fav]");
    if (!b) return;
    const id = b.dataset.fav, on = !isFav(id);
    lib.favorites = on ? [id, ...lib.favorites] : lib.favorites.filter((x) => x !== id);
    $$(`[data-fav="${id}"]`).forEach((x) => { x.setAttribute("aria-pressed", on); x.setAttribute("aria-label", `${on ? "Remove from" : "Add to"} favorites`); });
    if (vf.cat === "♥ Favorites") renderVideos();
    try { lib = await apiAuth(on ? "PUT" : "DELETE", `/api/me/favorites/${encodeURIComponent(id)}`); if (on) toast("Saved to your favorites."); }
    catch (err) { toast(err.message); }
  });
  function renderVideos() {
    const key = vf.by;
    const list = EX.filter((e) => (vf.cat === "All" || (vf.cat === "♥ Favorites" ? isFav(e.id) : e.libCat === vf.cat)) && (!vf.region || e[key] === vf.region)
      && (!vf.loc || locIds[vf.loc].has(e.id))
      && (!vf.q || [e.name, e.region, e.cat, e.libCat, e.joint, e.muscle].join(" ").toLowerCase().includes(vf.q)))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    $("#vgrid").innerHTML = groupsFor().map((g) => {
      const xs = list.filter((e) => e[key] === g);
      return xs.length ? `<section class="vgroup"><h3>${esc(g)} <span>${xs.length}</span></h3><div class="vgrid-in">${xs.map(vcard).join("")}</div></section>` : "";
    }).join("");
    $("#vid-empty").hidden = list.length > 0;
    $("#vid-empty").textContent = vf.cat === "♥ Favorites" && !lib.favorites.length ? "Tap the heart on any video to save it here." : "No exercises match. Try another filter.";
  }

  // ================= Pain tool
  // Body areas; painmuscles.js holds the precise spots and the muscles for each area id.
  const PAIN = {
    front: [
      { id: "head", label: "Head", sub: "Forehead, temples", area: "Neck" },
      { id: "neck", label: "Neck", sub: "Front and sides", area: "Neck" },
      { id: "shoulder", label: "Shoulder", sub: "Front and outside", area: "Shoulder" },
      { id: "chest", label: "Chest & ribs", sub: "Front of rib cage", area: "Other" },
      { id: "elbow", label: "Elbow", sub: "Forearm", area: "Elbow / wrist / hand" },
      { id: "wrist", label: "Wrist & hand", sub: "Fingers, thumb", area: "Elbow / wrist / hand" },
      { id: "hip", label: "Hip & groin", sub: "Front of hip", area: "Hip" },
      { id: "thigh", label: "Thigh", sub: "Quads", area: "Hip" },
      { id: "knee", label: "Knee", sub: "Kneecap, shin", area: "Knee" },
      { id: "ankle", label: "Ankle & foot", sub: "Arch, inner ankle", area: "Ankle / foot" }
    ],
    back: [
      { id: "head-b", label: "Back of head", sub: "Base of skull", area: "Neck" },
      { id: "neck-b", label: "Neck & traps", sub: "Upper traps", area: "Neck" },
      { id: "upper-back", label: "Upper back", sub: "Between shoulder blades", area: "Upper back" },
      { id: "shoulder-b", label: "Shoulder blade", sub: "Back of shoulder", area: "Shoulder" },
      { id: "low-back", label: "Low back", sub: "Lumbar spine", area: "Lower back" },
      { id: "glute", label: "Glutes", sub: "Buttock, outer hip", area: "Hip" },
      { id: "hamstring", label: "Hamstring", sub: "Back of thigh", area: "Hip" },
      { id: "calf", label: "Calf", sub: "Lower leg", area: "Ankle / foot" },
      { id: "heel", label: "Heel & Achilles", sub: "Back of ankle", area: "Ankle / foot" }
    ]
  };
  const ALL_PAIN = [...PAIN.front, ...PAIN.back];
  let side = "front";
  const picked = new Set();
  const personSvg = '<svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 1 1-2 2 2 2 0 0 1 2-2zm-3 20v-7H7.5V9a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v6H15v7z"/></svg>';
  // Step 1: areas. Step 2: where exactly + what makes it worse. Step 3: ranked muscles (painmuscles.js).
  const MUS = window.MDFitMuscles;
  const spotsPicked = new Set(), aggrPicked = new Set();
  function renderAreas() {
    $("#areas").innerHTML = PAIN[side].map((a) => `<button type="button" class="area" data-area="${a.id}" aria-pressed="${picked.has(a.id)}">
      <span class="aic">${personSvg}</span><span><b>${esc(a.label)}</b><small>${esc(a.sub)}</small></span><span class="radio" aria-hidden="true"></span></button>`).join("");
    const n = picked.size;
    $("#pain-go").disabled = !n;
    $("#pain-go").textContent = n ? "Find the muscles" : "Select an area";
    renderRefine();
  }
  const spotKeys = () => ALL_PAIN.filter((a) => picked.has(a.id)).flatMap((a) => {
    const mine = [...spotsPicked].filter((k) => k.startsWith(a.id + "|"));
    return mine.length ? mine : (MUS.SPOTS[a.id] || []).map((s) => `${a.id}|${s[0]}`);
  });
  function renderRefine() {
    const areas = ALL_PAIN.filter((a) => picked.has(a.id));
    if (!areas.length) { $("#pain-refine").innerHTML = ""; return; }
    // Only offer aggravators that matter for the muscles in play
    const tags = [...new Set(MUS.rank(spotKeys()).flatMap((m) => m.worse))];
    $("#pain-refine").innerHTML = `<div class="card refine">
      <p class="label accent">Narrow it down</p>
      ${areas.map((a) => `<div class="refine-row"><b>${esc(a.label)}: where exactly?</b><div class="pills">${(MUS.SPOTS[a.id] || []).map(([l]) => {
        const k = `${a.id}|${l}`;
        return `<button type="button" class="pill" role="checkbox" data-spot="${esc(k)}" aria-checked="${spotsPicked.has(k)}"><b>${esc(l)}</b></button>`;
      }).join("")}</div></div>`).join("")}
      <div class="refine-row"><b>What makes it worse?</b><div class="pills">${tags.map((t) => `<button type="button" class="pill" role="checkbox" data-aggr="${t}" aria-checked="${aggrPicked.has(t)}"><b>${esc(MUS.AGGRAVATORS[t])}</b></button>`).join("")}</div></div>
      <p class="muted tiny">Optional. Pick any that fit and the list sorts the most likely muscles first.</p></div>`;
  }
  $$(".seg [data-side]").forEach((b) => b.addEventListener("click", () => {
    side = b.dataset.side;
    $$(".seg [data-side]").forEach((x) => x.setAttribute("aria-selected", x === b));
    renderAreas();
  }));
  $("#areas").addEventListener("click", (e) => {
    const b = e.target.closest("[data-area]");
    if (!b) return;
    const id = b.dataset.area;
    if (picked.has(id)) { picked.delete(id); [...spotsPicked].forEach((k) => k.startsWith(id + "|") && spotsPicked.delete(k)); } else picked.add(id);
    renderAreas();
  });
  $("#pain-refine").addEventListener("click", (e) => {
    const s = e.target.closest("[data-spot]"), g = e.target.closest("[data-aggr]");
    if (s) spotsPicked.has(s.dataset.spot) ? spotsPicked.delete(s.dataset.spot) : spotsPicked.add(s.dataset.spot);
    else if (g) aggrPicked.has(g.dataset.aggr) ? aggrPicked.delete(g.dataset.aggr) : aggrPicked.add(g.dataset.aggr);
    else return;
    renderRefine();
  });
  const byName = new Map(EX.map((e) => [e.name, e]));
  const muscleCard = (m, i) => `
    <article class="card muscle ${i ? "" : "top"}" data-muscle="${m.id}">
      <div class="mc-head"><span class="mc-rank">${i + 1}</span><div><span class="label accent">${i === 0 ? "Most likely" : i < 3 ? "Also likely" : "Also check"}</span><h3>${esc(m.name)}</h3></div></div>
      <p class="mc-why">Matches ${esc(m.spots.join(", ").toLowerCase())}${m.matches.length ? ` · worse with ${esc(m.matches.map((t) => MUS.AGGRAVATORS[t].toLowerCase()).join(", "))}` : ""}</p>
      <p class="mc-ref"><b>Where it sends pain</b>${esc(m.refers)}</p>
      <p class="mc-does"><b>What it does</b>${esc(m.does)}</p>
      <button type="button" class="btn-blue sm mc-report" data-report="${m.id}">Full muscle report &amp; protocol</button>
      <p class="label">Relief videos from Dr. Jared</p>
      <div class="mini-vids">${m.videos.map((n) => byName.get(n)).filter(Boolean).map(vcard).join("")}</div>
      ${m.guide && GUIDES[m.guide] ? `<div class="guides"><button type="button" class="guide" data-guide="${m.guide}"><img src="assets/guides/${m.guide}-thumb.webp" alt="" width="52" height="52" loading="lazy"><span><b>${esc(GUIDES[m.guide])}</b><span>Open Dr. Jared's guide</span></span></button></div>` : ""}
    </article>`;
  $("#pain-go").addEventListener("click", () => {
    const areas = ALL_PAIN.filter((a) => picked.has(a.id));
    const list = MUS.rank(spotKeys(), [...aggrPicked]);
    const chosen = [...spotsPicked].map((k) => k.split("|")[1]);
    const logAreas = [...new Set(areas.map((a) => a.area))];
    $("#pain-results").innerHTML = `
      <div class="card result-sum">
        <span class="label accent">Your muscle map</span>
        <h3>${list.length} muscles can send pain to ${esc(areas.map((a) => a.label.toLowerCase()).join(" and "))}</h3>
        <p class="muted small">${chosen.length ? `You picked: ${esc(chosen.join(", "))}. ` : ""}Most likely first. Try the relief videos for the top one or two for a week and log how it feels.</p>
        <div class="log-row"><label>Pain now: <output>5</output>/10<input type="range" min="0" max="10" value="5" aria-label="Pain level"></label>
          ${logAreas.length > 1 ? `<select class="select sm" aria-label="Area">${logAreas.map((x) => `<option>${esc(x)}</option>`).join("")}</select>` : ""}
          <button type="button" class="btn-gold sm" data-log="${esc(logAreas[0])}">Log it</button></div>
      </div>
      ${list.slice(0, 5).map(muscleCard).join("")}
      ${list.length > 5 ? `<details class="more-muscles"><summary>Show ${list.length - 5} more muscles</summary>${list.slice(5).map((m, i) => muscleCard(m, i + 5)).join("")}</details>` : ""}
      <div class="card"><div class="row"><a class="btn-blue sm" href="/book">Book an evaluation</a><button type="button" class="btn-ghost sm" data-goto="videos">More videos</button></div>
      <p class="muted tiny center" style="margin:12px 0 0">Educational only, not a diagnosis. Sudden, severe or worsening pain, chest pain, numbness or weakness needs prompt medical care.</p></div>`;
    $("#pain-results").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#pain-results").addEventListener("input", (e) => { if (e.target.type === "range") e.target.closest(".log-row").querySelector("output").textContent = e.target.value; });
  $("#pain-results").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-log]");
    if (!b) return;
    const row = b.closest(".log-row"), sel = $("select", row);
    const top = $(".muscle h3", $("#pain-results"));
    b.disabled = true;
    try {
      await apiAuth("POST", "/api/me/pain", { area: sel ? sel.value : b.dataset.log, level: Number($("input", row).value),
        note: [...spotsPicked].map((k) => k.split("|")[1]).join(", ").slice(0, 300) || (top ? `Top match: ${top.textContent}` : "") });
      await loadPain();
      b.textContent = "Logged"; toast("Saved to your pain tracker.");
      loadRewards(true);
    } catch (err) { toast(err.message); b.disabled = false; }
  });

  // ---- Pick a muscle: full report (anatomy, self-check, look-alikes, red flags, 3-phase protocol) from musclereports.js
  const REPORTS = window.MDFIT_MUSCLE_REPORTS || {};
  const TK = window.MDFitTracks;
  // Pain tracks (Dr. Jared's mapping documents): open goes straight to the videos; Start runs them in order in the player
  const trackWorkout = (t) => {
    const ex = TK.steps(t).filter((v) => v.id).map((v) => ({ ...(byId.get(v.id) || { id: v.id, region: t.region, cat: "Rehab", level: 1, loc: "any" }), name: v.name, sets: "Follow the video", block: v.level.split(" · ")[0] }));
    return { title: `${t.title.split(" →")[0]} pain track`.slice(0, 80), goal: "Mobility & Recovery", goalId: "mobility", location: "home", level: "beginner", levelLabel: "Pain track",
      rounds: 1, restEx: 15, restRound: 0, minutes: Math.max(5, ex.length * 3), warmup: [], circuit: ex, cooldown: [], exercises: ex, perRound: ex.length };
  };
  function openTrack(id) { TK.ready.then(() => TK.open(id, { startLabel: "Start this track", onStart: (t) => startPlayer(trackWorkout(t)) })); }
  document.addEventListener("click", (e) => { const c = e.target.closest("[data-track]"); if (c) openTrack(c.dataset.track); });
  const GROUPS = [
    ["Head & jaw", ["suboccipitals", "occipitalis", "splenius", "temporalis", "masseter", "scm"]],
    ["Neck", ["upper-trap", "levator", "scalenes"]],
    ["Shoulder: deltoid & rotator cuff", ["ant-delt", "lat-delt", "post-delt", "supraspinatus", "infraspinatus", "teres-minor", "subscapularis", "teres-major"]],
    ["Shoulder: chest side", ["pec-major-clav", "pec-major-stern", "pec-minor", "subclavius", "coracobrachialis", "serratus"]],
    ["Shoulder: blade & upper back", ["middle-trap", "lower-trap", "rhomboid-minor", "rhomboid-major", "lats"]],
    ["Upper arm", ["biceps-long", "biceps-short", "triceps-long", "triceps-lateral", "triceps-medial"]],
    ["Elbow, wrist & hand", ["wrist-ext", "finger-ext", "wrist-flex", "finger-flex", "brachioradialis", "supinator"]],
    ["Ribs & abdomen", ["intercostals", "ext-oblique"]],
    ["Low back & core", ["ql", "iliocostalis", "longissimus", "multifidus", "psoas"]],
    ["Hip & glutes", ["iliacus", "glute-med", "glute-min", "piriformis", "glute-max", "tfl", "adductor-longus", "adductor-magnus"]],
    ["Thigh & knee", ["rectus-femoris", "vastus-intermedius", "vmo", "vastus-lateralis", "biceps-femoris", "medial-hamstrings", "popliteus"]],
    ["Lower leg & foot", ["gastroc", "soleus", "tib-post", "tib-ant", "peroneals", "foot-intrinsics"]]
  ];

  function setMode(mode) {
    $$(".mode-seg [data-mode]").forEach((b) => b.setAttribute("aria-selected", b.dataset.mode === mode));
    $("#mode-area").hidden = mode !== "area";
    $("#mode-muscle").hidden = mode !== "muscle";
    $("#muscle-report").hidden = true;
    if (mode === "muscle") { renderMap(); renderMuscleList(); }
  }
  $$(".mode-seg [data-mode]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  // Tap the muscle on Dr. Jared's anatomy figure (zoomed crops from painmuscles.js MAPS)
  let mapView = "body-front", mapPick = null;
  function renderMap() {
    const mp = MUS.MAPS[mapView], [x, y, w, h] = mp.box;
    $("#muscle-map").innerHTML = `
      <div class="map-tabs">${Object.entries(MUS.MAPS).map(([k, v]) => `<button type="button" class="chip" data-map="${k}" aria-selected="${k === mapView}">${esc(v.label)}</button>`).join("")}</div>
      <div class="map-stage ${mapView.startsWith("body") ? "dense" : ""}" style="aspect-ratio:${w}/${h}">
        <img src="assets/pain/body-figures.webp" alt="" style="width:${(1182 / w) * 100}%;left:${(-x / w) * 100}%;top:${(-y / h) * 100}%">
        ${Object.entries(mp.pts).map(([id, [px, py, deep]]) => `<button type="button" class="mdot ${deep ? "deep" : ""} ${id === mapPick ? "on" : ""}" data-pick="${id}" style="left:${((px - x) / w) * 100}%;top:${((py - y) / h) * 100}%" aria-label="${esc(MUS.MUSCLES[id].name)}${deep ? " (deep)" : ""}"></button>`).join("")}
      </div>
      <div class="map-pick">${mapPick ? `<div><b>${esc(MUS.MUSCLES[mapPick].name)}</b><span>${esc(MUS.MUSCLES[mapPick].refers.split(/[.;]/)[0])}</span></div><button type="button" class="btn-gold sm" data-report="${mapPick}">Open report</button>
          ${TK.forPoint(mapPick).length ? `<div class="pm-tracks"><b>Choose your pain pattern</b><div class="track-list">${TK.forPoint(mapPick).map(TK.card).join("")}</div></div>` : ""}`
        : `<p class="muted small">Tap a point on the muscle that hurts. Navy points are deep muscles under the surface.${mapView.startsWith("body") ? " Use the Shoulder views to zoom in." : ""}</p>`}</div>`;
  }
  $("#muscle-map").addEventListener("click", (e) => {
    const t = e.target.closest("[data-map]"), d = e.target.closest("[data-pick]");
    if (t) { mapView = t.dataset.map; mapPick = null; renderMap(); }
    else if (d) { mapPick = d.dataset.pick; renderMap(); }
  });

  function renderMuscleList() {
    const q = $("#muscle-search").value.trim().toLowerCase();
    const hit = (id) => { const m = MUS.MUSCLES[id]; return !q || (m.name + " " + m.refers + " " + m.does).toLowerCase().includes(q); };
    $("#muscle-list").innerHTML = GROUPS.map(([g, ids]) => {
      const list = ids.filter(hit);
      return list.length ? `<div class="mgroup"><p class="label">${esc(g)}</p><div class="mchips">${list.map((id) =>
        `<button type="button" class="mchip" data-report="${id}"><b>${esc(MUS.MUSCLES[id].name)}</b><span>${esc(MUS.MUSCLES[id].refers.split(/[.;]/)[0])}</span></button>`).join("")}</div></div>` : "";
    }).join("") || `<p class="muted small center">No muscle matches "${esc(q)}".</p>`;
  }
  $("#muscle-search").addEventListener("input", renderMuscleList);
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-report]"); if (b) openReport(b.dataset.report); });

  let report = null, reportFrom = "muscle"; // report = { id, answers: Map(index -> bool) }; reportFrom = mode to go back to
  function openReport(id, push = true) {
    if (!MUS.MUSCLES[id]) return;
    if (!$("#mode-area").hidden) reportFrom = "area"; else if (!$("#mode-muscle").hidden) reportFrom = "muscle";
    if (location.hash.slice(1).split("/")[0] !== "pain") show("pain");
    if (push) history.pushState(null, "", `#pain/muscle/${id}`);
    report = { id, answers: new Map() };
    $("#mode-area").hidden = true; $("#mode-muscle").hidden = true;
    $("#muscle-report").hidden = false;
    renderReport();
    window.scrollTo(0, 0);
  }
  const checkScore = () => {
    const r = REPORTS[report.id], qs = (r && r.questions) || [];
    const total = qs.reduce((n, q) => n + q.w, 0), yes = qs.reduce((n, q, i) => n + (report.answers.get(i) ? q.w : 0), 0);
    return { total, yes, answered: report.answers.size, pct: total ? yes / total : 0, n: qs.length };
  };
  function verdict() {
    const s = checkScore(), name = MUS.MUSCLES[report.id].name;
    if (!s.answered) return `<p class="muted small">Answer the questions above to see how well your pain fits ${esc(name)}.</p>`;
    const level = s.pct >= 0.6 ? ["strong", "Strong match"] : s.pct >= 0.3 ? ["possible", "Possible match"] : ["low", "Less likely"];
    const msg = level[0] === "strong" ? `Your answers fit the classic ${esc(name)} pattern. Start the protocol below and track your pain for 1 to 2 weeks.`
      : level[0] === "possible" ? `Some of your answers fit ${esc(name)}. It may be involved alongside another muscle. Try the Calm phase and compare with the other muscles from your area.`
      : `Your answers don't fit ${esc(name)} well. Check the other muscles for your area, or have Dr. Jared assess it in person.`;
    return `<div class="verdict ${level[0]}"><span class="label">Your self-check result</span><b>${level[1]}</b><div class="vbar"><i style="width:${Math.round(s.pct * 100)}%"></i></div>
      <p>${msg}</p><small>${s.answered} of ${s.n} answered · educational self-check, not a medical diagnosis</small></div>`;
  }
  const stepLi = (st) => {
    const ex = st.video && byName.get(st.video);
    return `<li class="pstep">${ex ? `<button type="button" class="pthumb" data-video="${ex.id}" aria-label="Watch ${esc(ex.name)}">${thumbImg(ex.id)}</button>` : `<span class="pthumb none"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-6h2zm0-8h-2V7h2z"/></svg></span>`}
      <div><b>${esc(st.name)}</b><span class="dose">${esc(st.dose)}</span><p>${esc(st.how)}</p></div></li>`;
  };
  const PHASES = [["calm", "Phase 1 · Calm it down", "Days 1 to 7"], ["restore", "Phase 2 · Restore", "Weeks 2 to 3"], ["strengthen", "Phase 3 · Strengthen", "Weeks 3 to 6"]];
  function renderReport() {
    const id = report.id, m = MUS.MUSCLES[id], r = REPORTS[id] || {};
    const list = (arr) => `<ul class="rlist">${(arr || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    $("#muscle-report").innerHTML = `
      <button type="button" class="link-sm back-link" data-back>← Back to the Pain Tool</button>
      <header class="hero report-hero"><div><p class="gd-eyebrow">Muscle report</p><h1>${esc(m.name)}</h1><p>${esc(m.does)}</p></div>
        ${m.guide ? `<img src="assets/guides/${m.guide}-thumb.webp" alt="" width="110" height="110">` : ""}</header>
      <div class="report-grid">
        <div class="col-main">
          ${TK.forPoint(id).length ? `<section class="card"><span class="label accent">Dr. Jared's pain tracks for this muscle</span><div class="track-list">${TK.forPoint(id).map(TK.card).join("")}</div></section>` : ""}
          <section class="card"><span class="label accent">Where it sends pain</span><p class="rlead">${esc(m.refers)}</p>
            ${r.symptoms ? `<p class="label">What people usually feel</p>${list(r.symptoms)}` : ""}</section>
          ${r.questions ? `<section class="card"><span class="label accent">Self-check: is it this muscle?</span>
            <ol class="qlist">${r.questions.map((q, i) => `<li><p>${esc(q.q)}</p><div class="yn" data-q="${i}"><button type="button" data-a="1" aria-pressed="${report.answers.get(i) === true}">Yes</button><button type="button" data-a="0" aria-pressed="${report.answers.get(i) === false}">No</button></div></li>`).join("")}</ol>
            <div id="verdict">${verdict()}</div></section>` : ""}
          ${r.tests && r.tests.length ? `<section class="card"><span class="label accent">Quick self-tests</span>${r.tests.map((t) => `<div class="rtest"><b>${esc(t.name)}</b><p>${esc(t.how)}</p><p class="pos"><b>Positive if:</b> ${esc(t.positive)}</p></div>`).join("")}</section>` : ""}
          ${r.protocol ? `<section class="card protocol"><span class="label accent">Dr. Jared's protocol</span>
            ${PHASES.map(([k, t, when]) => (r.protocol[k] || []).length ? `<div class="phase"><div class="phase-head"><b>${t}</b><span>${when}</span><button type="button" class="ev-act" data-phase="${k}">Start</button></div><ol class="psteps">${r.protocol[k].map(stepLi).join("")}</ol></div>` : "").join("")}
            <div class="row"><button type="button" class="btn-gold sm" data-save-protocol>Save to My Programs</button><a class="btn-blue sm" href="/book">Book with Dr. Jared</a></div>
            ${r.expect ? `<p class="expect"><b>What to expect:</b> ${esc(r.expect)}</p>` : ""}</section>` : ""}
        </div>
        <div class="col-side">
          ${r.origin ? `<section class="card"><span class="label accent">Anatomy</span><dl class="anat"><dt>Origin</dt><dd>${esc(r.origin)}</dd><dt>Insertion</dt><dd>${esc(r.insertion)}</dd><dt>Action</dt><dd>${esc(r.action)}</dd><dt>Nerve</dt><dd>${esc(r.nerve)}</dd></dl></section>` : ""}
          <section class="card"><span class="label accent">Often worse with</span><div class="tags">${m.worse.map((w) => `<span>${esc(MUS.AGGRAVATORS[w])}</span>`).join("")}</div>
            ${r.causes ? `<p class="label">What keeps it irritated</p>${list(r.causes)}` : ""}</section>
          ${r.mimics ? `<section class="card"><span class="label accent">Often mistaken for</span>${list(r.mimics)}</section>` : ""}
          ${r.habits ? `<section class="card"><span class="label accent">Daily habits that help</span>${list(r.habits)}</section>` : ""}
          ${r.redFlags ? `<section class="card redflags"><span class="label">Get seen promptly if</span>${list(r.redFlags)}${r.seePro ? `<p class="small">${esc(r.seePro)}</p>` : ""}</section>` : ""}
          ${m.guide && GUIDES[m.guide] ? `<div class="guides"><button type="button" class="guide" data-guide="${m.guide}"><img src="assets/guides/${m.guide}-thumb.webp" alt="" width="52" height="52" loading="lazy"><span><b>${esc(GUIDES[m.guide])}</b><span>Open Dr. Jared's guide</span></span></button></div>` : ""}
          <section class="card"><span class="label accent">Log it</span>
            <div class="log-row"><label>Pain now: <output>5</output>/10<input type="range" min="0" max="10" value="5" aria-label="Pain level"></label><button type="button" class="btn-gold sm" data-report-log>Log it</button></div></section>
        </div>
      </div>
      <p class="muted tiny center">Educational only, not a medical diagnosis. Written for MD Fit patients; your in-person evaluation always comes first.</p>`;
  }
  // Muscle id -> pain-log area (first Pain Tool area whose spots list the muscle)
  const logAreaFor = (id) => {
    for (const a of ALL_PAIN) if ((MUS.SPOTS[a.id] || []).some((s) => s[1].includes(id))) return a.area;
    return "Other";
  };
  function protocolWorkout(phases) {
    const id = report.id, r = REPORTS[id], name = MUS.MUSCLES[id].name;
    const steps = (k) => (r.protocol[k] || []).map((st) => st.video && byName.get(st.video) && { ...byName.get(st.video), sets: st.dose, block: PHASES.find((p) => p[0] === k)[1].split(" · ")[1] }).filter(Boolean);
    const all = phases.flatMap(steps);
    return { title: `${name.split(" (")[0]} protocol`.slice(0, 80), goal: "Mobility & Recovery", goalId: "mobility", location: "home", level: "beginner", levelLabel: "Protocol",
      rounds: 1, restEx: 15, restRound: 0, minutes: Math.max(5, all.length * 3), warmup: [], circuit: all, cooldown: [], exercises: all, perRound: all.length };
  }
  $("#muscle-report").addEventListener("click", async (e) => {
    if (e.target.closest("[data-back]")) { history.pushState(null, "", "#pain"); setMode(reportFrom); return; }
    const yn = e.target.closest(".yn [data-a]");
    if (yn) {
      report.answers.set(Number(yn.parentElement.dataset.q), yn.dataset.a === "1");
      $$("button", yn.parentElement).forEach((b) => b.setAttribute("aria-pressed", b === yn));
      $("#verdict").innerHTML = verdict();
      return;
    }
    const ph = e.target.closest("[data-phase]");
    if (ph) {
      const w = protocolWorkout([ph.dataset.phase]);
      if (!w.exercises.length) return toast("This phase is done without videos: follow the written steps.");
      return startPlayer(w);
    }
    if (e.target.closest("[data-save-protocol]")) {
      const w = protocolWorkout(["calm", "restore", "strengthen"]);
      if (!w.circuit.length) return toast("No video steps to save for this protocol.");
      try {
        lib = await apiAuth("POST", "/api/me/programs", { name: w.title.slice(0, 60), workout: { ...w, warmup: [], cooldown: [], circuit: w.circuit.slice(0, 20).map((x) => ({ id: x.id, sets: String(x.sets).slice(0, 30) })) } });
        renderPrograms(); toast(`Saved "${w.title}" to My Programs.`);
      } catch (err) { toast(err.message); }
      return;
    }
    const lg = e.target.closest("[data-report-log]");
    if (lg) {
      const row = lg.closest(".log-row"), s = checkScore();
      lg.disabled = true;
      try {
        await apiAuth("POST", "/api/me/pain", { area: logAreaFor(report.id), level: Number($("input", row).value),
          note: `${MUS.MUSCLES[report.id].name}${s.answered ? ` · self-check ${Math.round(s.pct * 100)}%` : ""}`.slice(0, 300) });
        await loadPain(); lg.textContent = "Logged"; loadRewards(true);
      } catch (err) { toast(err.message); lg.disabled = false; }
    }
  });
  $("#muscle-report").addEventListener("input", (e) => { if (e.target.type === "range") e.target.closest(".log-row").querySelector("output").textContent = e.target.value; });

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
    loadRewards(true);
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
    renderCalendar();
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

  // ================= Workout player: warm-up (once) → circuit rounds (optional rests) → cool-down, auto-advancing
  // Drive serves the raw MP4 (CORS + range requests), so a real <video> can autoplay, loop through the set and move on by itself.
  const driveMp4 = (id) => `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download`;
  const PLAY_KEY = "mdfit.player";
  const P = { w: null, steps: [], i: 0, start: 0, tick: null, rest: null, done: false, left: 0, paused: false,
    opt: { auto: true, breaks: true, sound: false, ...(store.get(PLAY_KEY) || {}) } };
  const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  function buildSteps(w) {
    const out = [];
    w.warmup.forEach((e) => out.push({ e, label: "Warm-up" }));
    for (let r = 1; r <= w.rounds; r++) {
      w.circuit.forEach((e, i) => {
        out.push({ e, label: w.rounds === 1 && e.block !== "Circuit" ? e.block : `Round ${r} of ${w.rounds}` });
        if (w.restEx && i < w.circuit.length - 1) out.push({ rest: w.restEx, label: "Rest" });
      });
      if (r < w.rounds && w.restRound) out.push({ rest: w.restRound, label: `Rest before round ${r + 1}` });
    }
    w.cooldown.forEach((e) => out.push({ e, label: "Cool-down" }));
    return out;
  }
  const saveOpt = () => store.set(PLAY_KEY, P.opt);
  function renderOpts() {
    $$("#p-opts [data-opt]").forEach((b) => { const on = !!P.opt[b.dataset.opt]; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
  }
  function startPlayer(w) {
    P.w = w; P.steps = buildSteps(w); P.i = 0; P.start = Date.now(); P.done = false; P.paused = false; P.log = {};
    $("#player").hidden = false;
    document.body.style.overflow = "hidden";
    clearInterval(P.tick);
    P.tick = setInterval(onTick, 1000);
    $("#p-timer").textContent = "0:00";
    renderOpts();
    renderStep();
  }
  function closePlayer() {
    clearInterval(P.tick);
    const v = $("#p-video"); if (v) { v.pause(); v.removeAttribute("src"); v.load(); }
    $("#player").hidden = true;
    $("#p-body").innerHTML = "";
    document.body.style.overflow = "";
  }
  // One clock drives everything: the session timer, the rest countdown and the per-move countdown
  function onTick() {
    if (P.done) return;
    $("#p-timer").textContent = fmtClock(Math.floor((Date.now() - P.start) / 1000));
    if (P.paused) return;
    const st = P.steps[P.i]; if (!st) return;
    if (st.rest || P.opt.auto) {
      P.left = Math.max(0, P.left - 1);
      const c = $("#p-count"); if (c) c.textContent = st.rest ? P.left : fmtClock(P.left);
      const ring = $("#p-ring"); if (ring) ring.style.setProperty("--pct", `${100 - (P.left / P.total) * 100}%`);
      if (P.left <= 0) advance();
    }
  }
  function advance() { P.i++; skipRests(); renderStep(); }
  function skipRests() { if (!P.opt.breaks) while (P.steps[P.i] && P.steps[P.i].rest) P.i++; }
  function renderStep() {
    const n = P.steps.length;
    if (P.i >= n) return finish();
    const st = P.steps[P.i], next = P.steps.slice(P.i + 1).find((x) => x.e);
    const exNum = P.steps.slice(0, P.i + 1).filter((x) => x.e).length, exTotal = P.steps.filter((x) => x.e).length;
    $("#p-step").textContent = st.e ? `${st.label} · ${exNum} of ${exTotal}` : st.label;
    $("#p-bar").style.width = `${(P.i / n) * 100}%`;
    $("#p-prev").disabled = P.i === 0;
    $("#p-next").textContent = P.i === n - 1 ? "Finish" : st.rest ? "Skip rest" : "Next";
    P.paused = false; $("#p-pause").textContent = "Pause";
    const upNext = next ? `<div class="p-next">Up next: <b>${esc(next.e.name)}</b> · ${esc(next.e.sets)}${next.label !== st.label && next.label === "Cool-down" ? " · cool-down starts" : ""}</div>` : `<div class="p-next">Last one. Finish strong.</div>`;
    if (st.rest) {
      P.left = P.total = st.rest;
      $("#p-body").innerHTML = `<div class="p-rest"><p class="p-block">${esc(st.label)}</p><div class="count" id="p-count">${P.left}</div><p>Breathe. Get set for the next move.</p>${upNext}</div>`;
      return;
    }
    const e = st.e;
    P.left = P.total = Gen.stepSecs(e.sets);
    $("#p-body").innerHTML = `
      <div class="frame p-frame">
        <video id="p-video" playsinline loop ${P.opt.sound ? "" : "muted"} autoplay preload="auto" poster="https://drive.google.com/thumbnail?id=${encodeURIComponent(e.id)}&sz=w800"></video>
      </div>
      <div class="p-info">
        <p class="p-block">${esc(st.label)}</p>
        <h2 class="p-name">${esc(e.name)}</h2>
        <div class="p-setrow">
          <div class="p-ring" id="p-ring" style="--pct:0%"><span id="p-count">${fmtClock(P.left)}</span></div>
          <div><p class="p-sets">${esc(e.sets)}</p><p class="p-meta">${esc(exMeta(e))}</p></div>
        </div>
        ${st.label.startsWith("Round") || st.label === "Circuit" ? `<label class="p-load">Weight used <input id="p-weight" inputmode="decimal" placeholder="lb" value="${esc((P.log[e.id] || {}).weight || "")}"></label>` : ""}
        ${upNext}
      </div>`;
    const v = $("#p-video");
    // Fall back to Drive's own player if the direct stream is refused
    v.addEventListener("error", () => { v.parentElement.innerHTML = `<iframe src="https://drive.google.com/file/d/${encodeURIComponent(e.id)}/preview" title="${esc(e.name)} demo" allow="autoplay; fullscreen" allowfullscreen></iframe>`; }, { once: true });
    v.src = driveMp4(e.id);
    const pr = v.play(); if (pr) pr.catch(() => { v.muted = true; v.play().catch(() => {}); });
    const wt = $("#p-weight");
    if (wt) wt.addEventListener("input", () => { P.log[e.id] = { name: e.name, weight: wt.value.trim().slice(0, 12) }; });
  }
  $("#p-pause").addEventListener("click", () => {
    if (P.done) return;
    P.paused = !P.paused;
    $("#p-pause").textContent = P.paused ? "Resume" : "Pause";
    const v = $("#p-video"); if (v) P.paused ? v.pause() : v.play().catch(() => {});
  });
  $("#p-opts").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-opt]"); if (!b) return;
    const k = b.dataset.opt; P.opt[k] = !P.opt[k]; saveOpt(); renderOpts();
    if (k === "sound") { const v = $("#p-video"); if (v) { v.muted = !P.opt.sound; v.play().catch(() => {}); } }
    if (k === "breaks" && !P.opt.breaks && P.steps[P.i] && P.steps[P.i].rest) { skipRests(); renderStep(); }
  });
  const workoutKey = (w) => w.key || w.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80);
  async function finish() {
    clearInterval(P.tick);
    const pv = $("#p-video"); if (pv) pv.pause();
    P.done = true;
    const secsUsed = Math.floor((Date.now() - P.start) / 1000), minutes = Math.min(300, Math.max(1, Math.round(secsUsed / 60)));
    $("#p-bar").style.width = "100%";
    $("#p-step").textContent = "Complete";
    $("#p-prev").disabled = true;
    $("#p-next").textContent = "Done";
    $("#p-body").innerHTML = `<div class="p-done"><div class="big-check"><svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg></div>
      <h2>Workout complete</h2><p class="muted">${esc(P.w.title)}</p><p class="muted small" id="done-msg">Saving…</p><div id="done-form"></div></div>`;
    const hr = HR.summary(P.start);
    const lifts = Object.values(P.log || {}).filter((l) => l.weight && !isNaN(Number(l.weight))).map((l) => ({ name: l.name, weight: Number(l.weight) }));
    try {
      const r = await apiAuth("POST", "/api/me/workouts", { title: P.w.title.slice(0, 80), goal: P.w.goal, minutes, exercises: Math.min(50, P.w.exercises.length),
        key: workoutKey(P.w), seconds: Math.max(1, Math.min(18000, secsUsed)), lifts, ...(hr ? { hrAvg: hr.avg, hrMax: hr.max, source: HR.name || "Heart-rate strap" } : {}) });
      stats = { ...r.stats, recent: [r.workout, ...((stats && stats.recent) || [])].slice(0, 10) };
      $("#done-msg").outerHTML = `<div class="stats3"><div><b>${r.stats.streak}</b><span>Day streak</span></div><div><b>${minutes}</b><span>Minutes</span></div><div><b>${hr ? hr.avg : r.stats.workouts}</b><span>${hr ? "Avg bpm" : "Workouts"}</span></div></div>`;
      allWorkouts.push(r.workout);
      numbersForm($("#done-form"), r.workout, "Add your numbers so you can compare this session later. Copy them from your watch if you wore one.");
      renderStats(); renderActivity(); renderNotes(); renderCalendar(); renderPerf(); loadParticipation();
      loadRewards(true);
    } catch (err) { $("#done-msg").textContent = "Couldn't save this workout: " + err.message; }
  }

  // ---- Participation credit: score, what it's worth, and what's left this week
  async function loadParticipation() {
    const p = await apiAuth("GET", "/api/me/participation").catch(() => null); if (!p) return;
    const bar = (v, t) => `<span class="pbar"><i style="width:${Math.min(100, Math.round((v / t) * 100))}%"></i></span>`;
    $("#part-card").hidden = false;
    $("#part-card").innerHTML = `<div class="card-head"><span class="label accent">Participation credit</span><b class="part-score">${p.score}<small>/100</small></b></div>
      <p class="part-earn">${p.earnedPct ? `You're on track to earn <b>${p.earnedPct}% back</b> on your protocol.` : `Reach 80 to earn ${p.creditPct / 2}% back, 100 to earn ${p.creditPct}%.`}</p>
      <div class="part-rows">
        <div><span>Visits attended</span><b>${p.attendance === null ? "No visits yet" : `${p.attendance}%`} <small>goal ${p.attendTarget}%</small></b>${bar(p.attendance === null ? p.attendTarget : p.attendance, p.attendTarget)}</div>
        <div><span>Home workouts a week</span><b>${p.homePerWeek} <small>goal ${p.homeTarget}</small></b>${bar(p.homePerWeek, p.homeTarget)}</div>
      </div>
      <p class="part-week">${p.leftThisWeek ? `<b>${p.leftThisWeek} more workout${p.leftThisWeek === 1 ? "" : "s"}</b> this week keeps you on track.` : `This week's home workouts are done. Nice work.`}</p>`;
  }

  // ---- Performance: daily vitals + side-by-side comparison of saved workouts
  let vitals = [];
  const VITALS = [["restingHr", "Resting HR", "bpm", -1], ["hrv", "HRV", "ms", 1], ["vo2max", "VO2 max", "", 1], ["weight", "Body weight", "lb", 0]];
  const latestOf = (k) => [...vitals].reverse().find((v) => v[k] !== undefined);
  function spark(k) {
    const pts = vitals.filter((v) => v[k] !== undefined).slice(-30);
    if (pts.length < 2) return "";
    const ys = pts.map((v) => v[k]), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
    const d = ys.map((y, i) => `${i ? "L" : "M"}${(i / (ys.length - 1)) * 100},${28 - ((y - lo) / span) * 24}`).join(" ");
    return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;
  }
  function renderPerf() {
    if (!$("#perf-card")) return;
    $("#vitals").innerHTML = VITALS.map(([k, label, unit, good]) => {
      const last = latestOf(k), first = vitals.find((v) => v[k] !== undefined);
      const diff = last && first && last !== first ? Math.round((last[k] - first[k]) * 10) / 10 : null;
      const cls = diff === null || !good || !diff ? "" : diff * good > 0 ? "up-good" : "up-bad";
      return `<div class="vital"><span>${label}</span><b>${last ? last[k] : "--"}<small> ${unit}</small></b>${diff !== null ? `<em class="${cls}">${diff > 0 ? "+" : ""}${diff} since ${first.date.slice(5)}</em>` : `<em>${last ? `Logged ${last.date.slice(5)}` : "No readings yet"}</em>`}${spark(k)}</div>`;
    }).join("");
    const ws = [...allWorkouts].reverse();
    const opt = (w) => `<option value="${w.id}">${w.date.slice(5)} · ${esc(w.title)}${w.hrAvg ? ` · ${w.hrAvg} bpm` : ""}</option>`;
    const A = $("#cmp-a"), B = $("#cmp-b"), fresh = renderPerf.n !== ws.length, keepA = fresh ? "" : A.value, keepB = fresh ? "" : B.value;
    renderPerf.n = ws.length;
    A.innerHTML = ws.map(opt).join(""); B.innerHTML = ws.map(opt).join("");
    if (ws.length < 1) { $("#cmp-table").innerHTML = `<p class="muted small">Finish a workout to start comparing sessions.</p>`; $("#cmp-edit-wrap").hidden = true; return; }
    A.value = ws.some((w) => w.id === keepA) ? keepA : ws[0].id;
    const a = ws.find((w) => w.id === A.value);
    const same = ws.find((w) => w.id !== a.id && (w.key ? w.key === a.key : w.title === a.title));
    B.value = ws.some((w) => w.id === keepB) && keepB !== a.id ? keepB : (same || ws.find((w) => w.id !== a.id) || a).id;
    const b = ws.find((w) => w.id === B.value);
    const dur = (w) => w.seconds ? `${Math.floor(w.seconds / 60)}:${String(w.seconds % 60).padStart(2, "0")}` : `${w.minutes} min`;
    const val = (w) => (w.seconds || w.minutes * 60);
    const rows = [["Time", dur, val, -1], ["Avg heart rate", (w) => w.hrAvg && `${w.hrAvg} bpm`, (w) => w.hrAvg, 0], ["Max heart rate", (w) => w.hrMax && `${w.hrMax} bpm`, (w) => w.hrMax, 0],
      ["HRV", (w) => w.hrv && `${w.hrv} ms`, (w) => w.hrv, 1], ["VO2 max", (w) => w.vo2max, (w) => w.vo2max, 1], ["Effort", (w) => w.rpe && `${w.rpe}/10`, (w) => w.rpe, 0], ["Calories", (w) => w.calories, (w) => w.calories, 0]];
    const names = [...new Set([...(a.lifts || []), ...(b.lifts || [])].map((l) => l.name))];
    const liftW = (w, n) => ((w.lifts || []).find((l) => l.name === n) || {}).weight;
    const delta = (x, y, good, fmt = (d) => d) => {
      if (x === undefined || y === undefined || a === b) return "";
      const d = Math.round((x - y) * 10) / 10; if (!d) return `<span class="dz">same</span>`;
      return `<span class="${good ? (d * good > 0 ? "up-good" : "up-bad") : ""}">${d > 0 ? "+" : ""}${fmt(d)}</span>`;
    };
    $("#cmp-table").innerHTML = `<table><thead><tr><th></th><th>${a.date.slice(5)}</th><th>${b.date.slice(5)}</th><th>Change</th></tr></thead><tbody>
      ${rows.map(([label, show, num, good]) => `<tr><th>${label}</th><td>${show(a) ?? "--"}</td><td>${show(b) ?? "--"}</td><td>${delta(num(a), num(b), good, label === "Time" ? (d) => `${Math.round(d)}s` : undefined)}</td></tr>`).join("")}
      ${names.map((n) => `<tr class="lift"><th>${esc(n)}</th><td>${liftW(a, n) ?? "--"}</td><td>${liftW(b, n) ?? "--"}</td><td>${delta(liftW(a, n), liftW(b, n), 1, (d) => `${d} lb`)}</td></tr>`).join("")}
      </tbody></table>${a === b ? `<p class="muted small">Only one session so far. Do this workout again (or save it to My Programs) to compare.</p>` : ""}`;
    $("#cmp-edit-wrap").hidden = false;
    numbersForm($("#cmp-edit"), a, `${a.title} on ${a.date}`);
  }
  $("#cmp-a").addEventListener("change", () => { $("#cmp-b").value = ""; renderPerf(); });
  $("#cmp-b").addEventListener("change", renderPerf);
  $("#vitals-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, body = {};
    ["restingHr", "hrv", "vo2max", "weight", "sleep"].forEach((k) => { const v = f[k].value.trim(); if (v) body[k] = Number(v); });
    try { vitals = await apiAuth("POST", "/api/me/vitals", body); f.reset(); $(".nums-msg", f).textContent = "Saved."; renderPerf(); }
    catch (err) { $(".nums-msg", f).textContent = err.message; }
  });

  // Heart rate, HRV, VO2 max and effort for one saved workout (fills in or corrects later)
  function numbersForm(host, w, intro) {
    const f = (k, label, ph, step = 1) => `<label>${label}<input name="${k}" type="number" inputmode="decimal" step="${step}" placeholder="${ph}" value="${w[k] ?? ""}"></label>`;
    host.innerHTML = `<form class="nums-form" novalidate>
      <p class="small">${esc(intro)}</p>
      <div class="nums-grid">${f("hrAvg", "Avg heart rate", "bpm")}${f("hrMax", "Max heart rate", "bpm")}${f("hrv", "HRV", "ms")}${f("vo2max", "VO2 max", "ml/kg/min", 0.1)}${f("calories", "Calories", "kcal")}</div>
      <div class="rpe" role="radiogroup" aria-label="Effort, 1 easy to 10 max">${Array.from({ length: 10 }, (_, i) => `<button type="button" role="radio" data-rpe="${i + 1}" class="${w.rpe === i + 1 ? "on" : ""}">${i + 1}</button>`).join("")}</div>
      <p class="rpe-cap small muted">Effort: 1 = easy, 10 = all-out</p>
      <button class="btn-gold sm" type="submit">Save numbers</button><span class="nums-msg small"></span></form>`;
    const form = $("form", host); let rpe = w.rpe;
    form.addEventListener("click", (e) => { const b = e.target.closest("[data-rpe]"); if (!b) return; rpe = Number(b.dataset.rpe); $$("[data-rpe]", form).forEach((x) => x.classList.toggle("on", x === b)); });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {}; ["hrAvg", "hrMax", "hrv", "vo2max", "calories"].forEach((k) => { const v = form[k].value.trim(); if (v) body[k] = Number(v); });
      if (rpe) body.rpe = rpe;
      try {
        const up = await apiAuth("PATCH", `/api/me/workouts/${w.id}`, body);
        Object.assign(w, up); const i = allWorkouts.findIndex((x) => x.id === w.id); if (i >= 0) allWorkouts[i] = up;
        $(".nums-msg", form).textContent = "Saved."; renderPerf();
      } catch (err) { $(".nums-msg", form).textContent = err.message; }
    });
  }

  // Bluetooth heart-rate straps and watches that broadcast HR (Chrome on Android, Mac, Windows; not iPhone Safari)
  const HR = {
    dev: null, name: "", bpm: 0, samples: [],
    supported: () => !!(navigator.bluetooth && navigator.bluetooth.requestDevice),
    async connect() {
      const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: ["heart_rate"] }] });
      const ch = await (await (await dev.gatt.connect()).getPrimaryService("heart_rate")).getCharacteristic("heart_rate_measurement");
      ch.addEventListener("characteristicvaluechanged", (e) => {
        const d = e.target.value, bpm = d.getUint8(0) & 1 ? d.getUint16(1, true) : d.getUint8(1);
        HR.bpm = bpm; HR.samples.push([Date.now(), bpm]); if (HR.samples.length > 20000) HR.samples.shift();
        const el = $("#p-hr b"); if (el) el.textContent = bpm;
      });
      await ch.startNotifications();
      dev.addEventListener("gattserverdisconnected", () => { HR.dev = null; HR.bpm = 0; renderHrBtn(); });
      HR.dev = dev; HR.name = dev.name || "Heart-rate strap"; renderHrBtn();
    },
    summary(since) {
      const xs = HR.samples.filter(([t]) => t >= since).map(([, b]) => b).filter((b) => b >= 30 && b <= 230);
      return xs.length < 5 ? null : { avg: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length), max: Math.max(...xs) };
    }
  };
  function renderHrBtn() {
    const b = $("#p-hr"); if (!b) return;
    b.hidden = !HR.supported();
    b.classList.toggle("on", !!HR.dev);
    b.innerHTML = HR.dev ? `♥ <b>${HR.bpm || "--"}</b> bpm` : "♥ Connect heart rate";
  }
  $("#p-hr").addEventListener("click", () => { if (!HR.dev) HR.connect().catch((err) => { if (err.name !== "NotFoundError") toast("Couldn't connect: " + err.message); }); });
  renderHrBtn();

  $("#p-next").addEventListener("click", () => { if (P.done) return closePlayer(); advance(); });
  $("#p-prev").addEventListener("click", () => {
    if (P.done || P.i === 0) return;
    P.i--;
    while (P.i > 0 && P.steps[P.i].rest) P.i--; // back skips over rest screens
    renderStep();
  });
  $("#p-close").addEventListener("click", () => { if (P.done || confirm("End this workout? It won't be saved.")) closePlayer(); });

  // ================= Member content: programs, lectures + live Q&A, membership & 1-on-1, health tips
  let C = null, contentLoading = null;
  const loadContent = () => (contentLoading = apiAuth("GET", "/api/me/content").then((d) => (C = d)).catch(() => api("/api/content").then((d) => (C = { ...d, access: "free" }))));
  const money = (n) => "$" + Number(n).toLocaleString("en-US");
  const lockBadge = `<span class="lock" title="Members"><svg viewBox="0 0 24 24"><path d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zm-7-2a2 2 0 0 1 4 0v2h-4z"/></svg> Members</span>`;
  const unlockBtn = (what) => `<button type="button" class="btn-gold sm" data-goto="premium">Unlock ${what} with a membership</button>`;
  async function renderContent(tab, sub) {
    if (!C) { await (contentLoading || loadContent()); }
    if (!C) return;
    ({ programs: renderProgramsView, learn: renderLearn, premium: renderPremium, tips: renderTips })[tab](sub);
  }

  // ---- Programs: each day is a generator session with a fixed seed, so the same session repeats each week and can be compared
  let progCat = "All";
  const progDayWorkout = (p, i) => {
    const d = p.days[i];
    const w = Gen.generate({ goal: d.goal, location: p.location, level: p.level, length: d.length, ...Gen.presetFor(d.length),
      ...(d.rounds ? { rounds: d.rounds } : {}), ...(d.restEx !== undefined ? { restEx: d.restEx } : {}), ...(d.restRound !== undefined ? { restRound: d.restRound } : {}),
      addons: { warmup: true, cooldown: true }, seed: p.seed + (d.seedOffset || 0) + i * 101 });
    return { ...w, title: `${p.title}: ${d.name}`, key: `prog-${p.id}-d${i}` };
  };
  const doneCount = (p, i) => allWorkouts.filter((w) => w.key === `prog-${p.id}-d${i}`).length;
  function renderProgramsView(sub) {
    const cats = ["All", ...C.categories.filter((c) => C.programs.some((p) => p.category === c))];
    $("#prog-cats").innerHTML = cats.map((c) => `<button type="button" class="chip" data-pcat="${esc(c)}" aria-selected="${c === progCat}">${esc(c)}</button>`).join("");
    const list = C.programs.filter((p) => progCat === "All" || p.category === progCat);
    $("#prog-grid").innerHTML = list.map((p) => {
      const sessions = p.weeks * p.days.length, done = p.days.reduce((n, _, i) => n + doneCount(p, i), 0);
      return `<button type="button" class="prog-card" data-prog="${p.id}">
        <span class="pc-cat">${esc(p.category)}</span>${p.locked ? lockBadge : ""}
        <b>${esc(p.title)}</b><p>${esc(p.summary)}</p>
        <span class="pc-meta">${p.weeks} weeks · ${p.days.length} days/week · ${esc(p.level[0].toUpperCase() + p.level.slice(1))} · ${esc((Gen.LOCATIONS.find((l) => l.id === p.location) || {}).label || "")}</span>
        ${done ? `<span class="pc-bar"><i style="width:${Math.min(100, Math.round((done / sessions) * 100))}%"></i></span><span class="pc-done">${done} of ${sessions} sessions done</span>` : ""}
      </button>`;
    }).join("");
    const open = sub && C.programs.find((p) => p.id === sub);
    $("#prog-grid").hidden = !!open; $("#prog-cats").hidden = !!open; $("#prog-detail").hidden = !open;
    if (open) renderProgram(open);
  }
  function renderProgram(p) {
    const wk = (i) => Math.min(p.weeks, doneCount(p, i) + 1);
    $("#prog-detail").innerHTML = `<button type="button" class="link-sm back-link" data-goto="programs">‹ All programs</button>
      <div class="card prog-head"><span class="pc-cat">${esc(p.category)}</span>${p.locked ? lockBadge : ""}<h2>${esc(p.title)}</h2><p>${esc(p.summary)}</p>
        <p class="muted small">${p.weeks} weeks · ${p.days.length} sessions a week · ${esc(p.level)} · ${esc((Gen.LOCATIONS.find((l) => l.id === p.location) || {}).label || "")}</p>
        ${p.notes ? `<p class="prog-notes">${esc(p.notes)}</p>` : ""}</div>
      ${p.days.map((d, i) => { const w = progDayWorkout(p, i); return `<div class="card prog-day">
        <div class="pd-top"><div><span class="label accent">Day ${i + 1} · Week ${wk(i)} of ${p.weeks}</span><h3>${esc(d.name)}</h3>
          <p class="muted small">About ${w.minutes} min · ${w.circuit.length} exercises × ${w.rounds} rounds · warm-up and cool-down included</p></div>
          ${p.locked ? "" : `<button type="button" class="btn-blue sm" data-prog-start="${i}"><svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg> Start</button>`}</div>
        <ol class="pd-ex">${w.circuit.map((e) => `<li>${esc(e.name)} <span>${esc(e.sets)}</span></li>`).join("")}</ol></div>`; }).join("")}
      ${p.locked ? `<div class="locked-note">${unlockBtn("this program")}</div>` : ""}`;
    $("#prog-detail").dataset.id = p.id;
  }
  $("#prog-cats").addEventListener("click", (e) => { const b = e.target.closest("[data-pcat]"); if (!b) return; progCat = b.dataset.pcat; renderProgramsView(); });
  $("#prog-grid").addEventListener("click", (e) => { const b = e.target.closest("[data-prog]"); if (b) go("programs/" + b.dataset.prog); });
  $("#prog-detail").addEventListener("click", (e) => {
    const b = e.target.closest("[data-prog-start]"); if (!b) return;
    const p = C.programs.find((x) => x.id === $("#prog-detail").dataset.id);
    if (p && !p.locked) startPlayer(progDayWorkout(p, Number(b.dataset.progStart)));
  });

  // ---- Learn: live Q&A + lectures
  let lectTopic = "All";
  const embedUrl = (u) => {
    const y = u.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
    if (y) return `https://www.youtube-nocookie.com/embed/${y[1]}?autoplay=1&rel=0`;
    const d = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
    if (d) return `https://drive.google.com/file/d/${d[1]}/preview`;
    const v = u.match(/vimeo\.com\/(\d+)/);
    if (v) return `https://player.vimeo.com/video/${v[1]}?autoplay=1`;
    return "";
  };
  function liveIcs(L) {
    const start = zonedToUtc(L.date, L.time), end = new Date(start.getTime() + L.minutes * 60000), st = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MD Fit//Live//EN", "BEGIN:VEVENT", `UID:live-${L.date}@mdfit`, `DTSTAMP:${st(new Date())}`, `DTSTART:${st(start)}`, `DTEND:${st(end)}`, `SUMMARY:${L.title}`, `DESCRIPTION:${L.joinUrl || "Join from the Learn tab in the MD Fit app."}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    return "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
  }
  function renderLearn() {
    const L = C.live, has = L.date && L.date >= todayInTz();
    $("#live-card").innerHTML = `<div class="live-top"><span class="live-dot"></span><span class="label accent">Monthly live Q&amp;A</span>${L.locked ? lockBadge : ""}</div>
      <h2>${esc(L.title)}</h2>
      ${has ? `<p class="live-when">${esc(fmtDate(L.date))} at ${esc(fmtTime(L.time))} · ${L.minutes} min</p>` : `<p class="live-when">Next date coming soon</p>`}
      <p class="muted small">${esc(L.notes)}</p>
      <div class="live-actions">${L.locked ? unlockBtn("live Q&amp;A") : `${L.joinUrl && has ? `<a class="btn-gold sm" href="${esc(L.joinUrl)}" target="_blank" rel="noopener">Join live</a>` : ""}${has ? `<a class="btn-ghost sm" href="${liveIcs(L)}" download="mdfit-live-qa.ics">Add to calendar</a>` : ""}`}</div>
      ${!L.locked && L.recordings.length ? `<details class="recs"><summary>Past sessions (${L.recordings.length})</summary><ul>${L.recordings.map((r) => `<li><button type="button" class="link-sm" data-lec-url="${esc(r.url)}" data-lec-title="${esc(r.title)}">${esc(r.title)}</button> <span class="muted small">${esc(r.date)}</span></li>`).join("")}</ul></details>` : ""}`;
    const topics = ["All", ...C.topics.filter((t) => C.lectures.some((l) => l.topic === t))];
    $("#lect-topics").innerHTML = topics.map((t) => `<button type="button" class="chip" data-ltopic="${esc(t)}" aria-selected="${t === lectTopic}">${esc(t)}</button>`).join("");
    $("#lect-grid").innerHTML = C.lectures.filter((l) => lectTopic === "All" || l.topic === lectTopic).map((l) => {
      const ready = l.url || l.hasVideo;
      return `<article class="lect">
        <span class="pc-cat">${esc(l.topic)}</span>${l.locked ? lockBadge : ""}
        <h3>${esc(l.title)}</h3><p>${esc(l.summary)}</p>
        <div class="lect-actions">${!ready ? `<span class="soon">Coming soon</span>` : l.locked ? unlockBtn("this lecture") :
          `<button type="button" class="btn-blue sm" data-lec-url="${esc(l.url)}" data-lec-title="${esc(l.title)}"><svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg> Watch${l.minutes ? ` · ${l.minutes} min` : ""}</button>`}
          ${!l.locked && l.downloadUrl ? `<a class="btn-ghost sm" href="${esc(l.downloadUrl)}" target="_blank" rel="noopener">Download</a>` : ""}</div>
      </article>`;
    }).join("");
  }
  $("#lect-topics").addEventListener("click", (e) => { const b = e.target.closest("[data-ltopic]"); if (!b) return; lectTopic = b.dataset.ltopic; renderLearn(); });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-lec-url]"); if (!b) return;
    const u = b.dataset.lecUrl, em = embedUrl(u);
    if (!em) return window.open(u, "_blank", "noopener");
    $("#lec-title").textContent = b.dataset.lecTitle; $("#lec-frame").src = em;
    $("#lec-meta").innerHTML = `<a href="${esc(u)}" target="_blank" rel="noopener">Open in a new tab</a>`;
    $("#lecture-dialog").showModal();
  });
  $("#lecture-dialog").addEventListener("close", () => ($("#lec-frame").src = "about:blank"));

  // ---- Membership & 1-on-1
  async function renderPremium() {
    const m = C.membership, cur = m && C.tiers.find((t) => t.id === m.tier);
    const req = client && client.membershipRequest;
    $("#my-membership").innerHTML = cur && C.access !== "free"
      ? `<div class="card mem-on"><span class="label accent">Your membership</span><h2>${esc(cur.name)}</h2><p class="muted small">Member since ${esc(m.since)}${m.until ? ` · paid through ${esc(m.until)}` : ""}</p></div>`
      : `<p class="muted mem-pitch">Pick a membership below and tap <b>Request</b>. Dr. Jared confirms it and sends payment details. Online checkout is coming soon.</p>`;
    $("#tier-grid").innerHTML = C.tiers.map((t, i) => `<article class="tier${i === 1 ? " featured" : ""}${cur && cur.id === t.id ? " current" : ""}">
      ${i === 1 ? `<span class="tag">Most popular</span>` : ""}
      <h3>${esc(t.name)}</h3><p class="tier-price"><b>${money(t.price)}</b>/month</p>
      ${t.meetings ? `<p class="tier-meet">${t.meetings} remote 1-on-1 sessions a month · ${t.meetingMinutes} min each</p>` : ""}
      <ul>${t.perks.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      ${cur && cur.id === t.id ? `<span class="tier-cur">Your plan</span>` : `<button type="button" class="${i === 1 ? "btn-gold" : "btn-ghost"} sm" data-tier="${t.id}">Request ${esc(t.name)}</button>`}
    </article>`).join("");
    const mc = $("#meetings-card");
    mc.hidden = C.access !== "premium";
    if (mc.hidden) return;
    const d = await apiAuth("GET", "/api/me/meetings").catch(() => null); if (!d) return;
    $("#meet-left").textContent = `${Math.max(0, d.allowance - d.usedThisMonth)} of ${d.allowance} left this month · ${d.minutes} min each`;
    $("#meet-form button").disabled = d.usedThisMonth >= d.allowance;
    $("#meet-list").innerHTML = d.meetings.map((x) => `<li><b>${esc(x.topic)}</b><span class="pill ${x.status}">${x.status}</span>
      <span class="muted small">${x.when ? esc(x.when) : `Asked for: ${esc(x.times)}`}</span>${x.link && x.status === "scheduled" ? `<a class="btn-gold sm" href="${esc(x.link)}" target="_blank" rel="noopener">Join</a>` : ""}</li>`).join("");
  }
  $("#tier-grid").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-tier]"); if (!b) return;
    const t = C.tiers.find((x) => x.id === b.dataset.tier);
    const note = prompt(`Request ${t.name} (${money(t.price)}/month)?\nAdd a note for Dr. Jared (optional):`, "");
    if (note === null) return;
    try { await apiAuth("POST", "/api/me/membership/request", { tier: t.id, note }); b.outerHTML = `<span class="tier-cur">Requested. Dr. Jared will be in touch.</span>`; toast("Request sent to Dr. Jared."); }
    catch (err) { toast(err.message); }
  });
  $("#meet-form").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target;
    try { await apiAuth("POST", "/api/me/meetings", { topic: f.topic.value, times: f.times.value }); f.reset(); $(".nums-msg", f).textContent = "Requested. You'll get an email when it's scheduled."; renderPremium(); }
    catch (err) { $(".nums-msg", f).textContent = err.message; }
  });

  // ---- Health tips
  let tipArea = "All";
  function renderTips() {
    const areas = ["All", ...new Set(C.recommendations.map((r) => r.area))];
    $("#tip-areas").innerHTML = areas.map((a) => `<button type="button" class="chip" data-tarea="${esc(a)}" aria-selected="${a === tipArea}">${esc(a)}</button>`).join("");
    const list = C.recommendations.filter((r) => tipArea === "All" || r.area === tipArea);
    $("#tips").innerHTML = [...new Set(list.map((r) => r.area))].map((a) => `<section class="tip-group"><h3>${esc(a)}</h3>
      ${list.filter((r) => r.area === a).map((r) => `<details class="tip"><summary>${esc(r.title)}</summary><p>${esc(r.body)}</p>${r.link ? `<a href="${esc(r.link)}" target="_blank" rel="noopener">Learn more</a>` : ""}</details>`).join("")}</section>`).join("");
  }
  $("#tip-areas").addEventListener("click", (e) => { const b = e.target.closest("[data-tarea]"); if (!b) return; tipArea = b.dataset.tarea; renderTips(); });

  // ================= Progress: rewards (XP, levels, badges), calendar, pain tracker
  const BADGE_IC = {
    bolt: '<path d="M7 2v11h3v9l7-12h-4l4-8z"/>', dumbbell: '<path d="M20.6 14.9 22 13.4 20.6 12l-3.6 3.6L8.4 7l3.6-3.6L10.6 2 9.1 3.4 7.7 2 5.6 4.1 4.1 2.6 2.7 4.1l1.4 1.4L2 7.7l1.4 1.4L2 10.6 3.4 12 7 8.4l8.6 8.6-3.6 3.6 1.4 1.4 1.4-1.4 1.4 1.4 2.1-2.1 1.5 1.4 1.4-1.4-1.4-1.4 2.1-2.1z"/>',
    trophy: '<path d="M19 4h-2V2H7v2H5a2 2 0 0 0-2 2v1a5 5 0 0 0 4.4 4.96A5 5 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5 5 0 0 0 3.6-3.94A5 5 0 0 0 21 7V6a2 2 0 0 0-2-2zM5 7V6h2v3.8A3 3 0 0 1 5 7zm14 0a3 3 0 0 1-2 2.8V6h2z"/>',
    flame: '<path d="M13.5 1.5s.8 2.7.8 4.6c0 1.9-1.2 3.4-3.1 3.4-1.9 0-3.3-1.5-3.3-3.4l.03-.33C5.9 8 4.7 11.1 4.7 14.4 4.7 18.6 8 22 12 22s7.3-3.4 7.3-7.6c0-5.1-2.4-9.6-5.8-12.9z"/>',
    calendar: '<path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14z"/>',
    clock: '<path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7z"/>',
    compass: '<path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm2.2 12.2L6.5 17.5l3.3-7.7 7.7-3.3z"/>',
    pulse: '<path d="M3 13h4l2-6 4 12 2-6h6v-2h-4.6L14 5l-4 12-2-6H3z"/>',
    heart: '<path d="M12 21 10.6 19.7C5.4 15 2 11.9 2 8.1 2 5 4.4 2.6 7.5 2.6c1.7 0 3.4.8 4.5 2.1 1.1-1.3 2.8-2.1 4.5-2.1C19.6 2.6 22 5 22 8.1c0 3.8-3.4 6.9-8.6 11.6z"/>',
    star: '<path d="m12 17.3 6.2 3.7-1.6-7 5.4-4.7-7.2-.6L12 2 9.2 8.7 2 9.3l5.4 4.7-1.6 7z"/>'
  };
  function renderRewards() {
    const r = reward;
    if (!r) return;
    $("#chip-lv").textContent = `Lv ${r.level}`;
    $("#chip-xp").textContent = `${r.xp.toLocaleString()} XP`;
    $("#lv-n").textContent = r.level;
    $("#lv-title").textContent = r.title;
    $("#lv-xp").textContent = `${r.xp.toLocaleString()} XP total`;
    const pct = Math.round(((r.xp - r.levelStart) / (r.nextLevel - r.levelStart)) * 100);
    $("#lv-bar").style.width = pct + "%";
    $("#lv-bar-wrap").setAttribute("aria-valuenow", pct);
    $("#lv-next").textContent = `${(r.nextLevel - r.xp).toLocaleString()} XP to level ${r.level + 1}`;
    // Daily goal ring
    const g = Math.min(1, r.todayXp / r.dailyGoal), C = 2 * Math.PI * 26;
    $("#goal-ring").innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" class="ring-bg"/><circle cx="32" cy="32" r="26" class="ring-fg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - g)}" transform="rotate(-90 32 32)"/></svg>
      <span><b>${r.todayXp}</b>/${r.dailyGoal}</span><small>${g >= 1 ? "Goal met!" : "Today's goal"}</small>`;
    $("#goal-ring").setAttribute("aria-label", `Today's goal: ${r.todayXp} of ${r.dailyGoal} XP`);
    // This week's XP: single-series bars, today highlighted, values on hover/focus via title
    const max = Math.max(r.dailyGoal, ...r.week.map((d) => d.xp)), t = todayInTz();
    $("#xp-week").innerHTML = r.week.map((d) => `<div class="xw ${d.date === t ? "today" : ""} ${d.date > t ? "future" : ""}" title="${fmtDate(d.date, { weekday: "long" })}: ${d.xp} XP" tabindex="0">
      <span class="xw-val">${d.xp || ""}</span><i style="height:${Math.max(4, (d.xp / max) * 100)}%"></i><small>${fmtDate(d.date, { weekday: "narrow" })}</small></div>`).join("");
    const earned = r.badges.filter((b) => b.earned).length;
    $("#badge-count").textContent = `${earned} of ${r.badges.length}`;
    $("#badges").innerHTML = r.badges.slice().sort((a, b) => Number(b.earned) - Number(a.earned)).map((b) => `
      <li class="badge ${b.earned ? "earned" : ""}" title="${esc(b.desc)}">
        <span class="b-ic"><svg viewBox="0 0 24 24">${BADGE_IC[b.icon] || BADGE_IC.star}</svg></span>
        <b>${esc(b.title)}</b><small>${b.earned ? `Earned ${shortDate(b.earnedOn)}` : esc(b.desc)}</small>
        ${b.earned ? "" : `<span class="b-prog"><i style="width:${Math.round((b.progress / b.target) * 100)}%"></i></span>`}
      </li>`).join("");
  }
  // celebrate = compare with the previous totals and announce XP and new badges
  async function loadRewards(celebrate = false) {
    try {
      const prev = reward, next = await apiAuth("GET", "/api/me/rewards");
      reward = next; renderRewards();
      if (!celebrate || !prev) return;
      const gained = next.xp - prev.xp, newBadges = next.badges.filter((b) => b.earned && !prev.badges.find((x) => x.id === b.id).earned);
      const msgs = [];
      if (gained > 0) msgs.push(`+${gained} XP`);
      if (next.level > prev.level) msgs.push(`Level up! You're now level ${next.level}: ${next.title}`);
      newBadges.forEach((b) => msgs.push(`Badge unlocked: ${b.title}`));
      if (prev.todayXp < prev.dailyGoal && next.todayXp >= next.dailyGoal) msgs.push("Daily goal reached!");
      if (msgs.length) celebrateToast(msgs);
    } catch {}
  }
  function celebrateToast(msgs) {
    const t = $("#toast");
    t.innerHTML = msgs.map((m, i) => `<div class="${i ? "" : "xp-gain"}">${esc(m)}</div>`).join("");
    t.hidden = false; t.classList.add("celebrate");
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; t.classList.remove("celebrate"); }, 4200);
  }

  // Calendar: workouts, visits and pain logs by day, Monday first
  let calMonth = todayInTz().slice(0, 7), calPick = null;
  const monthAdd = (m, n) => { const [y, mo] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return d.toISOString().slice(0, 7); };
  function dayItems(d) {
    return [
      ...allWorkouts.filter((w) => w.date === d).map((w) => ({ k: "workout", t: w.title, s: `${w.minutes} min · ${w.exercises} exercises` })),
      ...[...appts.upcoming, ...appts.past].filter((a) => a.date === d && a.status !== "cancelled").map((a) => ({ k: "visit", t: a.typeName, s: `${fmtTime(a.time)} · ${a.minutes} min${a.status === "booked" && d >= todayInTz() ? " · upcoming" : ""}` })),
      ...painLog.filter((p) => p.date === d).map((p) => ({ k: "pain", t: `${p.area} pain ${p.level}/10`, s: p.note || "Pain log" }))
    ];
  }
  function renderCalendar() {
    const [y, m] = calMonth.split("-").map(Number), first = `${calMonth}-01`, t = todayInTz();
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate(), lead = (new Date(first + "T12:00:00Z").getUTCDay() + 6) % 7;
    $("#cal-title").textContent = fmtDate(first, { month: "long", year: "numeric" });
    const cells = ["M", "T", "W", "T", "F", "S", "S"].map((d) => `<span class="cal-h">${d}</span>`);
    for (let i = 0; i < lead; i++) cells.push("<span></span>");
    for (let n = 1; n <= days; n++) {
      const d = `${calMonth}-${String(n).padStart(2, "0")}`, kinds = [...new Set(dayItems(d).map((x) => x.k))];
      cells.push(`<button type="button" class="cal-d ${d === t ? "today" : ""} ${d === calPick ? "picked" : ""} ${kinds.includes("workout") ? "has-workout" : ""}" data-day="${d}" aria-label="${fmtDate(d, { weekday: "long", month: "long", day: "numeric" })}${kinds.length ? ": " + kinds.join(", ") : ""}">
        <span>${n}</span><em>${kinds.map((k) => `<i class="k-${k}"></i>`).join("")}</em></button>`);
    }
    $("#cal").innerHTML = cells.join("");
    renderCalDay();
  }
  function renderCalDay() {
    const d = calPick || todayInTz(), items = dayItems(d);
    $("#cal-day").innerHTML = `<p class="label">${d === todayInTz() ? "Today" : fmtDate(d, { weekday: "long", month: "short", day: "numeric" })}</p>` + (items.length
      ? `<ul class="activity">${items.map((x) => `<li class="act"><span class="check k-bg-${x.k}"></span><div><b>${esc(x.t)}</b><span>${esc(x.s)}</span></div></li>`).join("")}</ul>`
      : `<p class="muted small">Nothing logged. ${d === todayInTz() ? "A quick workout keeps your streak alive." : ""}</p>`);
  }
  $("#cal").addEventListener("click", (e) => { const b = e.target.closest("[data-day]"); if (b) { calPick = b.dataset.day; renderCalendar(); } });
  $("#cal-prev").addEventListener("click", () => { calMonth = monthAdd(calMonth, -1); renderCalendar(); });
  $("#cal-next").addEventListener("click", () => { calMonth = monthAdd(calMonth, 1); renderCalendar(); });

  // ================= Load
  show(location.hash.slice(1) || "home");
  renderProfile(); renderStats(); renderToday(); renderAreas(); renderPlan();
  (async () => {
    try {
      const r = await apiAuth("GET", "/api/me");
      client = r.client; auth.set({ ...auth.get(), client });
      renderProfile(); renderPlan();
    } catch (err) { toast("Couldn't reach MD Fit right now. Call 941-313-0562 if you need help."); return; }
    const [s, , , sched, wl, lb] = await Promise.allSettled([
      apiAuth("GET", "/api/me/stats"), loadAppointments(), loadPain(), api("/api/schedule?days=14"), apiAuth("GET", "/api/me/workouts"), apiAuth("GET", "/api/me/library")
    ]);
    if (s.status === "fulfilled") stats = s.value;
    if (sched.status === "fulfilled") classes = sched.value.sessions || [];
    if (wl.status === "fulfilled") allWorkouts = wl.value;
    apiAuth("GET", "/api/me/vitals").then((v) => { vitals = v; renderPerf(); }).catch(() => renderPerf());
    loadParticipation();
    loadContent().then(() => { const t = location.hash.slice(1).split("/"); if (["programs", "learn", "premium", "tips"].includes(t[0])) renderContent(t[0], t[1]); });
    if (lb.status === "fulfilled") { lib = lb.value; renderPrograms(); if (!$("#view-videos").hidden) renderVideos(); }
    renderStats(); renderEvents(); renderActivity(); renderNotes(); renderCalendar();
    loadRewards();
    loadSite().catch(() => {});
  })();
})();
