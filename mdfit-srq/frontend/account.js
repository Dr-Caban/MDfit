// MD Fit client dashboard: appointments, plan from Dr. Jared, pain tracker, history, profile.
(() => {
  const { $, $$, esc, auth, apiAuth, wire, fmtDate, fmtTime, zonedToUtc, icsStamp, AREAS, loadSite } = window.MDFit;
  if (!auth.get()) { location.replace("/login?next=/account"); return; }

  const GUIDES = {
    "posterior-neck": "The Posterior Neck Power Grid", "scalenes": "The Scalenes & Intercostals", "rotator-cuff": "The Rotator Cuff",
    "iliopsoas": "The Iliopsoas Complex", "lateral-hip": "Lateral Hip Powerhouse", "quads": "Tight Quads: Referred Pain", "calf": "The Calf Complex"
  };
  const ADDRESS = "3214 Clark Road, Sarasota, FL 34231";
  const longDate = (d) => fmtDate(d, { weekday: "long", month: "long", day: "numeric" });
  const shortDate = (d) => fmtDate(d, { month: "short", day: "numeric" });
  let client = auth.client(), painLog = [];

  $("#logout").addEventListener("click", () => { auth.clear(); location.href = "/"; });

  // ---------- Profile
  function renderProfile() {
    $("#first-name").textContent = (client.name || "there").split(" ")[0];
    const f = $("#profile-form");
    f.name.value = client.name; f.email.value = client.email; f.phone.value = client.phone || "";
  }
  wire($("#profile-form"), async (d) => {
    const r = await apiAuth("PUT", "/api/me", { name: d.name, phone: d.phone });
    client = r.client; auth.set({ ...auth.get(), client }); renderProfile();
    return { message: "Saved." };
  }, { reset: false });
  wire($("#password-form"), async (d) => {
    const sess = await apiAuth("PUT", "/api/me/password", d);
    auth.set(sess);
    return { message: "Password changed. Other devices were signed out." };
  });

  // ---------- Appointments
  function ics(a) {
    const start = zonedToUtc(a.date, a.time), end = new Date(start.getTime() + a.minutes * 60e3);
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MD Fit//Account//EN", "BEGIN:VEVENT", `UID:${a.id}@mdfit`,
      `DTSTAMP:${icsStamp(new Date())}`, `DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`, `SUMMARY:${a.typeName} · MD Fit`,
      `LOCATION:${ADDRESS.replace(/,/g, "\\,")}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    return URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
  }
  const apptRow = (a, actions) => `
    <li class="appt-row" data-id="${a.id}">
      <div class="appt-date"><b>${fmtDate(a.date, { day: "numeric" })}</b><small>${fmtDate(a.date, { month: "short" })}</small></div>
      <div class="appt-info"><b>${esc(a.typeName)}</b><span>${fmtDate(a.date, { weekday: "long" })} · ${fmtTime(a.time)} · ${a.minutes} min</span>
        ${actions ? `<span class="appt-actions"><a href="${ics(a)}" download="mdfit-${a.date}.ics">Add to calendar</a><button type="button" class="link-btn danger" data-cancel>Cancel</button></span>`
                  : `<span class="status ${esc(a.status)}">${esc(a.status === "booked" ? "upcoming" : a.status)}</span>`}
      </div>
    </li>`;

  async function loadAppointments() {
    const { upcoming, past } = await apiAuth("GET", "/api/me/appointments");
    const next = upcoming[0];
    $("#next-card").innerHTML = next
      ? `<p class="next-label">Your next visit</p><p class="next-when">${longDate(next.date)} at ${fmtTime(next.time)}</p>
         <p class="next-what">${esc(next.typeName)} · ${next.minutes} min · ${ADDRESS}</p>
         <div class="next-actions"><a class="btn btn-sm" href="${ics(next)}" download="mdfit-${next.date}.ics">Add to calendar</a>
         <a class="btn btn-ghost btn-sm" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("MD Fit " + ADDRESS)}" target="_blank" rel="noopener">Directions</a></div>`
      : `<p class="next-label">No visits booked</p><p class="next-when">Ready for your next session?</p>
         <div class="next-actions"><a class="btn btn-sm" href="/book">Book an appointment</a></div>`;
    $("#upcoming").innerHTML = upcoming.length
      ? `<ul class="appt-list">${upcoming.map((a) => apptRow(a, true)).join("")}</ul>`
      : `<p class="empty">Nothing booked yet.</p><a class="btn btn-sm" href="/book">Book an appointment</a>`;
    $("#history").innerHTML = past.length
      ? `<ul class="appt-list">${past.slice(0, 20).map((a) => apptRow(a, false)).join("")}</ul>`
      : `<p class="empty">Your past visits will show up here.</p>`;
  }
  $("#upcoming").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-cancel]");
    if (!b) return;
    const row = b.closest("[data-id]");
    if (!confirm("Cancel this appointment? The time opens up for someone else.")) return;
    b.disabled = true;
    try { await apiAuth("POST", `/api/me/appointments/${row.dataset.id}/cancel`, {}); await loadAppointments(); }
    catch (err) { alert(err.message); b.disabled = false; }
  });

  // ---------- Plan
  function renderPlan() {
    const p = client.plan || { guides: [], exercises: [], notes: "" };
    const empty = !p.notes && !p.exercises.length && !p.guides.length;
    $("#plan").innerHTML = empty
      ? `<p class="empty">After your evaluation, Dr. Jared adds your home program, notes and guides here.</p>`
      : `${p.notes ? `<div class="plan-notes"><b>From Dr. Jared</b><p>${esc(p.notes).replace(/\n/g, "<br>")}</p></div>` : ""}
         ${p.exercises.length ? `<h3>Home exercises</h3><ol class="exercises">${p.exercises.map((x) => `<li><b>${esc(x.name)}</b>${x.detail ? `<span>${esc(x.detail)}</span>` : ""}</li>`).join("")}</ol>` : ""}
         ${p.guides.length ? `<h3>Your guides</h3><div class="guide-cards">${p.guides.filter((g) => GUIDES[g]).map((g) => `
            <button type="button" class="guide-card" data-guide="${g}"><img src="assets/pain/guide-${g}-thumb.webp" alt="" width="120" height="180" loading="lazy">
            <span><b>${esc(GUIDES[g])}</b><i>Open guide →</i></span></button>`).join("")}</div>` : ""}
         ${p.updatedAt ? `<p class="fine">Updated ${shortDate(p.updatedAt.slice(0, 10))}</p>` : ""}`;
  }
  const dlg = $("#guide-dialog");
  document.addEventListener("click", (e) => {
    const c = e.target.closest("[data-guide]");
    if (!c) return;
    $("img", dlg).src = `assets/pain/guide-${c.dataset.guide}.webp`;
    $("img", dlg).alt = GUIDES[c.dataset.guide];
    $("h3", dlg).textContent = GUIDES[c.dataset.guide];
    $(".guide-full", dlg).href = `assets/pain/guide-${c.dataset.guide}.webp`;
    dlg.showModal();
  });
  $(".close", dlg).addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  // ---------- Pain tracker
  const pf = $("#pain-form"), out = $("output", pf);
  pf.area.innerHTML = AREAS.map((a) => `<option>${esc(a)}</option>`).join("");
  pf.level.addEventListener("input", () => (out.textContent = pf.level.value));
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
      painLog.length ? painLog.slice().reverse().map((e) => `<tr data-id="${e.id}"><td>${shortDate(e.date)}</td><td>${esc(e.area)}</td><td>${e.level}/10</td><td>${esc(e.note)}</td><td><button type="button" class="link-btn danger" data-del>Delete</button></td></tr>`).join("")
      : `<tr><td colspan="5" class="empty">No entries yet.</td></tr>`}</tbody>`;
    renderChart();
  }
  $("#entries").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-del]");
    if (!b) return;
    await apiAuth("DELETE", `/api/me/pain/${b.closest("tr").dataset.id}`);
    loadPain();
  });

  // Single-series line chart: pain level (0-10) over time for one area.
  function renderChart() {
    const area = $("#chart-area").value;
    const pts = painLog.filter((e) => e.area === area);
    $("#chart-title").textContent = pts.length ? `${area} pain over time` : "Pain over time";
    const box = $("#chart");
    if (pts.length < 2) {
      box.innerHTML = `<p class="empty chart-empty">${pts.length ? "Log one more day to see your trend." : "Log your pain a few times a week to see your trend here."}</p>`;
      return;
    }
    const W = 640, H = 220, L = 34, R = 16, T = 14, B = 30;
    const t = (d) => Date.parse(d + "T12:00:00Z");
    const x0 = t(pts[0].date), x1 = Math.max(t(pts[pts.length - 1].date), x0 + 864e5);
    const X = (d, i) => L + (x1 === x0 ? i / (pts.length - 1) : (t(d) - x0) / (x1 - x0)) * (W - L - R);
    const Y = (v) => T + (1 - v / 10) * (H - T - B);
    const xy = pts.map((p, i) => [X(p.date, i), Y(p.level)]);
    const grid = [0, 5, 10].map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${L - 8}" y="${Y(v) + 4}" class="axis" text-anchor="end">${v}</text>`).join("");
    const first = pts[0].date, last = pts[pts.length - 1].date;
    const lastPt = xy[xy.length - 1];
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
      el.addEventListener("mouseenter", () => showTip(el));
      el.addEventListener("focus", () => showTip(el));
      el.addEventListener("click", () => showTip(el));
      el.addEventListener("mouseleave", () => (tip.hidden = true));
      el.addEventListener("blur", () => (tip.hidden = true));
    });
  }

  // ---------- Load everything
  (async () => {
    renderProfile();
    try {
      const r = await apiAuth("GET", "/api/me");
      client = r.client; auth.set({ ...auth.get(), client });
      renderProfile(); renderPlan();
      await Promise.all([loadAppointments(), loadPain()]);
    } catch (err) {
      $("#next-card").innerHTML = `<p class="muted">Couldn't load your account right now. Call 941-313-0562 if you need help.</p>`;
    }
    loadSite().catch(() => {});
  })();
})();
