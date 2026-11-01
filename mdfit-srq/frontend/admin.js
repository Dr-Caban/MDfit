// MD Fit admin portal: appointments, booking hours, leads, classes, bookings, subscribers, site settings.
(() => {
  const API = window.MDFIT_CONFIG.apiUrl.replace(/\/+$/, "");
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const STATUSES = ["new", "contacted", "booked", "client", "closed"];
  const APPT_STATUSES = ["booked", "completed", "no-show", "cancelled"];
  const when = (iso) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const fmtTime = (t) => { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
  const fmtDate = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });

  const session = {
    get: () => { try { return sessionStorage.getItem("mdfit_token") || ""; } catch { return ""; } },
    set: (t) => { try { t ? sessionStorage.setItem("mdfit_token", t) : sessionStorage.removeItem("mdfit_token"); } catch {} }
  };
  let token = session.get();

  async function api(method, path, body) {
    const res = await fetch(API + path, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (res.status === 401 && path !== "/api/admin/login") { logout(); throw new Error("Session expired. Log in again."); }
    const data = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.blob();
    if (!res.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  let toastTimer;
  function toast(text, err = false) {
    const t = $("#toast");
    t.textContent = text; t.className = "toast" + (err ? " err" : ""); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3500);
  }
  const run = (fn) => (...a) => Promise.resolve(fn(...a)).catch((e) => toast(e.message, true));

  // ---- Login
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, msg = $(".form-msg", f);
    msg.className = "form-msg"; msg.textContent = "";
    try {
      const out = await api("POST", "/api/admin/login", Object.fromEntries(new FormData(f)));
      token = out.token; session.set(token); f.reset(); show();
    } catch (err) { msg.className = "form-msg err"; msg.textContent = err.message; }
  });
  function logout() { token = ""; session.set(""); $("#app").hidden = true; $("#login").hidden = false; }
  $("#logout").addEventListener("click", logout);

  // ---- Tabs
  const loaders = { dash: loadDash, clients: loadClients, appts: loadAppts, hours: loadHours, leads: loadLeads, classes: loadClasses, bookings: loadBookings, subs: loadSubs, reviews: loadReviews, settings: loadSettings };
  let current = "dash";
  $$(".tabs [data-tab]").forEach((b) => b.addEventListener("click", () => openTab(b.dataset.tab)));
  function openTab(name) {
    current = name;
    $$(".tabs [data-tab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === name));
    $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== name));
    run(loaders[name])();
  }
  function show() { $("#login").hidden = true; $("#app").hidden = false; openTab(current); }

  const table = (el, head, rows, empty) => {
    el.innerHTML = `<thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${
      rows.length ? rows.join("") : `<tr><td class="empty" colspan="${head.length}">${empty}</td></tr>`}</tbody>`;
  };

  // ---- Dashboard
  async function loadDash() {
    const [s, me] = await Promise.all([api("GET", "/api/admin/stats"), api("GET", "/api/admin/me")]);
    $("#email-banner").hidden = me.emailNotifications;
    $(".stats").innerHTML = [
      [s.appointmentsToday, "Appointments today"], [s.appointmentsWeek, "Appointments next 7 days"], [s.leadsNew, "New requests"],
      [s.leads30d, "Requests last 30 days"], [s.bookingsThisWeek, "Class spots booked"], [s.subscribers, "Subscribers"]
    ].map(([n, l]) => `<div class="stat"><strong>${n}</strong><span>${l}</span></div>`).join("");
    const apptRow = (a, withDate) => `<tr><td>${withDate ? fmtDate(a.date) + " · " : ""}${fmtTime(a.time)}</td><td>${esc(a.typeName)} · ${a.minutes}m</td>
      <td>${esc(a.name)}</td><td><a href="tel:${esc(a.phone)}">${esc(a.phone)}</a></td>
      <td>${esc([(a.areas || []).join(", "), a.painLevel != null ? `pain ${a.painLevel}/10` : "", a.notes].filter(Boolean).join(" · "))}</td></tr>`;
    table($("#today"), ["Time", "Type", "Client", "Phone", "Notes"], s.today.map((a) => apptRow(a, false)), "Nothing booked today.");
    table($("#next-appts"), ["When", "Type", "Client", "Phone", "Notes"], s.nextAppointments.map((a) => apptRow(a, true)), "No upcoming appointments.");
    table($("#upcoming"), ["When", "Class", "Booked"], s.upcoming.map((x) =>
      `<tr><td>${fmtDate(x.date)} · ${fmtTime(x.time)}</td><td>${esc(x.title)}</td><td>${x.capacity - x.spotsLeft} / ${x.capacity}</td></tr>`),
      "No classes in the next 7 days. Add some under Classes.");
  }

  // ---- Share link (the public site is where this admin page is served from)
  const bookUrl = location.origin + "/book";
  $("#book-link").value = bookUrl;
  $("#call-link").textContent = bookUrl + "?type=call";
  $("#copy-link").addEventListener("click", run(async () => {
    try { await navigator.clipboard.writeText(bookUrl); } catch { $("#book-link").select(); document.execCommand("copy"); }
    toast("Booking link copied.");
  }));

  // ---- Appointments
  async function loadAppts() {
    const list = await api("GET", "/api/admin/appointments" + ($("#appts-all").checked ? "?all=1" : ""));
    $("#appts-list").innerHTML = list.length ? list.map((a) => `
      <article class="lead appt ${a.status}" data-id="${a.id}">
        <header>
          <div><h3>${fmtDate(a.date)} · ${fmtTime(a.time)} <span class="badge ${a.status}">${a.status}</span>${a.source === "cal" ? ` <span class="badge cal">Cal.com</span>` : ""}</h3>
            <div class="meta">${esc(a.typeName)} · ${a.minutes} min</div></div>
          <div class="meta">Booked ${when(a.createdAt)}</div>
        </header>
        <div><strong>${esc(a.name)}</strong> · <a href="tel:${esc(a.phone)}">${esc(a.phone)}</a> · <a href="mailto:${esc(a.email)}">${esc(a.email)}</a></div>
        <div class="intake">${[...(a.areas || []), a.painLevel != null && `Pain ${a.painLevel}/10`].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join("")}</div>
        ${a.notes ? `<p class="msg">${esc(a.notes)}</p>` : ""}
        <textarea rows="2" placeholder="Session notes (private)" data-notes>${esc(a.adminNotes)}</textarea>
        <div class="actions">
          <select data-status>${APPT_STATUSES.map((x) => `<option ${x === a.status ? "selected" : ""}>${x}</option>`).join("")}</select>
          <button class="mini" data-save>Save</button>
        </div>
      </article>`).join("") : `<p class="muted">No upcoming appointments.</p>`;
  }
  $("#appts-all").addEventListener("change", run(loadAppts));
  $("#appts-list").addEventListener("click", run(async (e) => {
    const card = e.target.closest(".appt");
    if (!card || !e.target.matches("[data-save]")) return;
    const status = $("[data-status]", card).value;
    if (status === "cancelled" && !confirm("Cancel this appointment? The time opens up for booking again.")) return;
    await api("PATCH", `/api/admin/appointments/${card.dataset.id}`, { status, adminNotes: $("[data-notes]", card).value });
    toast("Appointment saved."); loadAppts();
  }));

  // ---- Booking system (built-in or Cal.com)
  const cf = $("#cal-form");
  $("#cal-hook").textContent = API + "/api/cal/webhook";
  const calFields = () => ($(".cal-fields", cf).hidden = cf.provider.value !== "cal");
  cf.addEventListener("change", calFields);
  async function loadCalStatus() {
    const box = $("#cal-status");
    box.className = "cal-status"; box.innerHTML = `<span class="muted">Checking Cal.com…</span>`;
    const st = await api("GET", "/api/admin/cal/status");
    if (st.connected) {
      box.className = "cal-status ok";
      box.innerHTML = `<b>Connected</b> as <code>${esc(st.username)}</code>${st.timeZone ? ` · ${esc(st.timeZone)}` : ""}${st.webhookSecretSet ? " · webhook secret set" : " · <b>webhook secret not set</b> (bookings arrive on sync only)"}
        <ul>${st.eventTypes.map((t) => `<li><code>${esc(t.slug)}</code> ${esc(t.title)}${t.minutes ? ` (${t.minutes} min)` : ""}</li>`).join("") || "<li>No visible event types. Create one in Cal.com.</li>"}</ul>`;
    } else {
      box.className = "cal-status bad";
      box.innerHTML = `<b>Not connected.</b> ${esc(st.message || "")}`;
    }
  }
  $("#cal-test").addEventListener("click", run(loadCalStatus));
  $("#cal-sync").addEventListener("click", run(async () => {
    const r = await api("POST", "/api/admin/cal/sync");
    toast(`Synced ${r.synced} upcoming Cal.com booking${r.synced === 1 ? "" : "s"}.`);
  }));
  cf.addEventListener("submit", run(async (e) => {
    e.preventDefault();
    const msg = $(".form-msg", cf);
    msg.className = "form-msg"; msg.textContent = "";
    try {
      await api("PUT", "/api/admin/settings", { booking: {
        provider: cf.provider.value, calUsername: cf.calUsername.value,
        calEventSlugs: cf.calEventSlugs.value.split(",").map((x) => x.trim()).filter(Boolean)
      } });
      msg.className = "form-msg ok";
      msg.textContent = cf.provider.value === "cal" ? "Saved. The website now books through Cal.com." : "Saved. The website uses the built-in scheduler.";
      if (cf.provider.value === "cal") loadCalStatus().catch(() => {});
    } catch (err) { msg.className = "form-msg err"; msg.textContent = err.message; }
  }));

  // ---- Booking hours
  const hf = $("#hours-form");
  $("#hours-days").innerHTML = DAYS.map((d, i) => `<label class="day-hours">${d}<input data-day="${i}" placeholder="Closed"></label>`).join("");
  async function loadHours() {
    const s = await api("GET", "/api/admin/settings");
    cf.provider.value = s.booking.provider;
    cf.calUsername.value = s.booking.calUsername;
    cf.calEventSlugs.value = s.booking.calEventSlugs.join(", ");
    calFields();
    if (s.booking.provider === "cal") loadCalStatus().catch(() => {});
    const sch = s.scheduling;
    $$("[data-day]", hf).forEach((el) => (el.value = (sch.hours[el.dataset.day] || []).map((w) => w.join("-")).join(", ")));
    hf.slotStepMin.value = String(sch.slotStepMin);
    hf.minNoticeHours.value = sch.minNoticeHours;
    hf.daysAhead.value = sch.daysAhead;
    hf.blockedDates.value = sch.blockedDates.join("\n");
    hf.appointmentTypes.value = s.appointmentTypes.map((t) => [t.id, t.name, t.minutes, t.description].join(" | ")).join("\n");
  }
  hf.addEventListener("submit", run(async (e) => {
    e.preventDefault();
    const msg = $(".form-msg", hf);
    msg.className = "form-msg"; msg.textContent = "";
    try {
      const hours = $$("[data-day]", hf).map((el) => el.value.split(",").map((x) => x.trim()).filter(Boolean).map((w) => {
        const m = w.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
        if (!m) throw new Error(`${DAYS[el.dataset.day]}: write hours like 09:00-17:00`);
        return [m[1].padStart(5, "0"), m[2].padStart(5, "0")];
      }));
      const appointmentTypes = hf.appointmentTypes.value.split("\n").map((x) => x.trim()).filter(Boolean).map((line) => {
        const [id = "", name = "", minutes = "", description = ""] = line.split("|").map((x) => x.trim());
        return { id, name, minutes: Number(minutes), description };
      });
      await api("PUT", "/api/admin/settings", {
        scheduling: {
          hours, slotStepMin: Number(hf.slotStepMin.value), minNoticeHours: Number(hf.minNoticeHours.value), daysAhead: Number(hf.daysAhead.value),
          blockedDates: hf.blockedDates.value.split(/[\s,]+/).filter(Boolean)
        },
        appointmentTypes
      });
      msg.className = "form-msg ok"; msg.textContent = "Saved. Online booking uses the new hours right away.";
    } catch (err) { msg.className = "form-msg err"; msg.textContent = err.message; }
  }));

  // ---- Clients (accounts created at /login)
  const GUIDES = { "posterior-neck": "Posterior Neck Power Grid", "scalenes": "Scalenes & Intercostals", "rotator-cuff": "Rotator Cuff",
    "iliopsoas": "Iliopsoas Complex", "lateral-hip": "Lateral Hip Powerhouse", "quads": "Tight Quads", "calf": "Calf Complex" };
  let clientList = [];
  async function loadClients() {
    $("#client-detail").hidden = true; $("#clients-list").hidden = false;
    clientList = await api("GET", "/api/admin/clients");
    renderClients();
  }
  function renderClients() {
    const q = $("#client-search").value.trim().toLowerCase();
    const rows = clientList.filter((c) => !q || [c.name, c.email, c.phone].join(" ").toLowerCase().includes(q));
    table($("#clients-table"), ["Client", "Phone", "Next visit", "Last pain log", "Plan", "Joined"], rows.map((c) => `
      <tr data-id="${c.id}" class="click-row"><td><b>${esc(c.name)}</b><br><span class="muted">${esc(c.email)}</span></td><td>${esc(c.phone)}</td>
        <td>${c.next ? `${fmtDate(c.next.date)} · ${fmtTime(c.next.time)}` : "—"}</td>
        <td>${c.lastPain ? `${esc(c.lastPain.area)} ${c.lastPain.level}/10 · ${fmtDate(c.lastPain.date)}` : "—"}</td>
        <td>${c.hasPlan ? "✓" : "—"}</td><td>${when(c.createdAt)}</td></tr>`),
      "No client accounts yet. Clients sign up at /login.");
  }
  $("#client-search").addEventListener("input", renderClients);
  $("#clients-table").addEventListener("click", run(async (e) => {
    const row = e.target.closest("tr[data-id]");
    if (row) openClient(row.dataset.id);
  }));

  async function openClient(id) {
    const c = await api("GET", `/api/admin/clients/${id}`);
    const box = $("#client-detail");
    const p = c.plan;
    box.innerHTML = `
      <button type="button" class="mini" data-back>← All clients</button>
      <div class="client-head"><div><h2>${esc(c.name)}</h2>
        <p class="muted"><a href="mailto:${esc(c.email)}">${esc(c.email)}</a>${c.phone ? ` · <a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : ""} · joined ${when(c.createdAt)}${c.lastLoginAt ? ` · last login ${when(c.lastLoginAt)}` : ""}</p></div>
        <div class="client-actions"><button type="button" class="mini" data-reset>Copy password-reset link</button><button type="button" class="mini danger" data-delete>Delete account</button></div></div>
      <div class="client-grid">
        <form class="form" id="plan-form" novalidate>
          <h2>Plan</h2>
          <label>Notes for ${esc(c.name.split(" ")[0])}<textarea name="notes" rows="4" maxlength="3000">${esc(p.notes)}</textarea></label>
          <label>Home exercises, one per line: <code>Name | sets, reps, cues</code><textarea name="exercises" rows="6">${esc(p.exercises.map((x) => x.detail ? `${x.name} | ${x.detail}` : x.name).join("\n"))}</textarea></label>
          <fieldset><legend>Guides to share</legend><div class="guide-picks">${Object.entries(GUIDES).map(([k, v]) =>
            `<label class="check"><input type="checkbox" name="guides" value="${k}" ${p.guides.includes(k) ? "checked" : ""}> ${esc(v)}</label>`).join("")}</div></fieldset>
          <button class="btn btn-sm" type="submit">Save plan</button>
          <p class="form-msg" role="status"></p>
        </form>
        <div>
          <h2>Appointments</h2>
          <div class="table-wrap"><table id="client-appts"></table></div>
          <h2>Pain log</h2>
          <div class="table-wrap"><table id="client-pain"></table></div>
        </div>
      </div>`;
    table($("#client-appts"), ["When", "Type", "Status"], c.appointments.map((a) => `<tr><td>${fmtDate(a.date)} · ${fmtTime(a.time)}</td><td>${esc(a.typeName)}</td><td><span class="badge ${a.status}">${a.status}</span></td></tr>`), "No appointments under this email yet.");
    table($("#client-pain"), ["Date", "Area", "Pain", "Note"], c.painLog.slice().reverse().slice(0, 50).map((e) => `<tr><td>${fmtDate(e.date)}</td><td>${esc(e.area)}</td><td>${e.level}/10</td><td>${esc(e.note)}</td></tr>`), "No entries yet.");
    $("#clients-list").hidden = true; box.hidden = false;

    $("[data-back]", box).addEventListener("click", run(loadClients));
    $("[data-reset]", box).addEventListener("click", run(async () => {
      const r = await api("POST", `/api/admin/clients/${id}/reset-link`);
      try { await navigator.clipboard.writeText(r.url); toast(`Reset link copied (works for ${r.hours} hours). Text it to the client.`); }
      catch { prompt("Send this link to the client:", r.url); }
    }));
    $("[data-delete]", box).addEventListener("click", run(async () => {
      if (!confirm(`Delete ${c.name}'s account? Their appointments stay; their plan and pain log are removed.`)) return;
      await api("DELETE", `/api/admin/clients/${id}`); toast("Account deleted."); loadClients();
    }));
    const pfm = $("#plan-form", box);
    pfm.addEventListener("submit", run(async (e) => {
      e.preventDefault();
      const msg = $(".form-msg", pfm);
      msg.className = "form-msg"; msg.textContent = "";
      try {
        await api("PUT", `/api/admin/clients/${id}/plan`, {
          notes: pfm.notes.value,
          exercises: pfm.exercises.value.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf("|"); return i < 0 ? { name: l, detail: "" } : { name: l.slice(0, i).trim(), detail: l.slice(i + 1).trim() }; }),
          guides: $$("[name=guides]:checked", pfm).map((x) => x.value)
        });
        msg.className = "form-msg ok"; msg.textContent = "Saved. It's on their dashboard now.";
      } catch (err) { msg.className = "form-msg err"; msg.textContent = err.message; }
    }));
  }

  // ---- Leads
  async function loadLeads() {
    const status = $("#lead-filter").value;
    const list = await api("GET", "/api/admin/leads" + (status ? "?status=" + status : ""));
    $("#leads-list").innerHTML = list.length ? list.map((l) => `
      <article class="lead" data-id="${l.id}">
        <header>
          <div><h3>${esc(l.name)} <span class="badge ${l.status}">${l.status}</span></h3>
            <div class="meta"><a href="mailto:${esc(l.email)}">${esc(l.email)}</a>${l.phone ? ` · <a href="tel:${esc(l.phone)}">${esc(l.phone)}</a>` : ""}</div></div>
          <div class="meta">${when(l.createdAt)}</div>
        </header>
        <div class="meta">${esc(l.service)} · ${esc(l.goal)}${l.preferredTime ? " · Best time: " + esc(l.preferredTime) : ""}${l.referral ? " · Heard via: " + esc(l.referral) : ""}</div>
        <div class="intake">${[...(l.areas || []), l.painLevel != null && `Pain ${l.painLevel}/10`, l.duration, l.surgery && l.surgery !== "No" && l.surgery]
          .filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join("")}</div>
        ${l.message ? `<p class="msg">${esc(l.message)}</p>` : ""}
        <textarea rows="2" placeholder="Notes" data-notes>${esc(l.notes)}</textarea>
        <div class="actions">
          <select data-status>${STATUSES.map((s) => `<option ${s === l.status ? "selected" : ""}>${s}</option>`).join("")}</select>
          <button class="mini" data-save>Save</button>
          <button class="mini danger" data-del>Delete</button>
        </div>
      </article>`).join("") : `<p class="muted">No leads yet.</p>`;
  }
  $("#lead-filter").addEventListener("change", run(loadLeads));
  $("#leads-list").addEventListener("click", run(async (e) => {
    const card = e.target.closest(".lead");
    if (!card) return;
    const id = card.dataset.id;
    if (e.target.matches("[data-save]")) {
      await api("PATCH", `/api/admin/leads/${id}`, { status: $("[data-status]", card).value, notes: $("[data-notes]", card).value });
      toast("Lead saved."); loadLeads();
    }
    if (e.target.matches("[data-del]") && confirm("Delete this lead for good?")) {
      await api("DELETE", `/api/admin/leads/${id}`); toast("Lead deleted."); loadLeads();
    }
  }));

  // ---- Classes
  $("[name=day]", $("#class-form")).innerHTML = DAYS.map((d, i) => `<option value="${i}" ${i === 1 ? "selected" : ""}>${d}</option>`).join("");
  let classList = [];
  async function loadClasses() {
    classList = await api("GET", "/api/admin/classes");
    const sorted = [...classList].sort((a, b) => a.day - b.day || (a.time < b.time ? -1 : 1));
    table($("#classes-table"), ["Day", "Time", "Class", "Cap.", "Coach", ""], sorted.map((c) => `
      <tr class="${c.active === false ? "off" : ""}" data-id="${c.id}">
        <td>${DAYS[c.day]}</td><td>${fmtTime(c.time)} · ${c.durationMin}m</td><td>${esc(c.title)}</td><td>${c.capacity}</td><td>${esc(c.coach)}</td>
        <td><button class="mini" data-toggle>${c.active === false ? "Turn on" : "Pause"}</button>
            <button class="mini" data-cap>Capacity</button>
            <button class="mini danger" data-del>Delete</button></td>
      </tr>`), "No classes yet.");
  }
  $("#class-form").addEventListener("submit", run(async (e) => {
    e.preventDefault();
    const f = e.target, d = Object.fromEntries(new FormData(f)), msg = $(".form-msg", f);
    msg.textContent = "";
    try {
      await api("POST", "/api/admin/classes", { ...d, day: Number(d.day), durationMin: Number(d.durationMin), capacity: Number(d.capacity) });
      f.reset(); toast("Class added."); loadClasses();
    } catch (err) { msg.className = "form-msg err"; msg.textContent = err.message; }
  }));
  $("#classes-table").addEventListener("click", run(async (e) => {
    const row = e.target.closest("tr[data-id]");
    if (!row) return;
    const c = classList.find((x) => x.id === row.dataset.id);
    if (e.target.matches("[data-toggle]")) await api("PUT", `/api/admin/classes/${c.id}`, { active: c.active === false });
    else if (e.target.matches("[data-cap]")) {
      const n = prompt("New capacity:", c.capacity);
      if (n === null) return;
      await api("PUT", `/api/admin/classes/${c.id}`, { capacity: Number(n) });
    } else if (e.target.matches("[data-del]")) {
      if (!confirm(`Delete "${c.title}" and all its bookings?`)) return;
      await api("DELETE", `/api/admin/classes/${c.id}`);
    } else return;
    toast("Saved."); loadClasses();
  }));

  // ---- Bookings
  async function loadBookings() {
    const list = await api("GET", "/api/admin/bookings" + ($("#bookings-all").checked ? "?all=1" : ""));
    table($("#bookings-table"), ["When", "Class", "Name", "Contact", ""], list.map((b) => `
      <tr data-id="${b.id}"><td>${fmtDate(b.date)} · ${fmtTime(b.time)}</td><td>${esc(b.title)}</td><td>${esc(b.name)}</td>
        <td><a href="mailto:${esc(b.email)}">${esc(b.email)}</a>${b.phone ? "<br>" + esc(b.phone) : ""}</td>
        <td><button class="mini danger" data-del>Cancel</button></td></tr>`), "No upcoming bookings.");
  }
  $("#bookings-all").addEventListener("change", run(loadBookings));
  $("#bookings-table").addEventListener("click", run(async (e) => {
    const row = e.target.closest("tr[data-id]");
    if (!row || !e.target.matches("[data-del]") || !confirm("Cancel this booking?")) return;
    await api("DELETE", `/api/admin/bookings/${row.dataset.id}`); toast("Booking cancelled."); loadBookings();
  }));

  // ---- Subscribers
  async function loadSubs() {
    const list = await api("GET", "/api/admin/subscribers");
    table($("#subs-table"), ["Email", "Joined", ""], list.map((s) => `
      <tr data-email="${esc(s.email)}"><td>${esc(s.email)}</td><td>${when(s.createdAt)}</td><td><button class="mini danger" data-del>Remove</button></td></tr>`),
      "No subscribers yet.");
  }
  $("#subs-table").addEventListener("click", run(async (e) => {
    const row = e.target.closest("tr[data-email]");
    if (!row || !e.target.matches("[data-del]") || !confirm("Remove this subscriber?")) return;
    await api("DELETE", `/api/admin/subscribers/${encodeURIComponent(row.dataset.email)}`); toast("Removed."); loadSubs();
  }));

  // ---- Reviews from the website
  async function loadReviews() {
    const list = await api("GET", "/api/admin/feedback");
    $("#reviews-list").innerHTML = list.length ? list.map((f) => `
      <article class="item" data-id="${f.id}">
        <div class="item-head"><b>${esc(f.name)}</b> <span class="stars">${"★".repeat(f.rating)}${"☆".repeat(5 - f.rating)}</span>
          <span class="pill ${f.status}">${f.status}</span> <span class="muted">${when(f.createdAt)}</span></div>
        <p>${esc(f.text)}</p>
        <p class="muted small">${esc(f.email)} · ${f.publish ? "OK to publish" : "Private, do not publish"} · Reward ${esc(f.rewardCode)} ${f.rewardUsedAt ? `(booked ${when(f.rewardUsedAt)})` : "(not used yet)"}</p>
        <div class="row-actions">${f.publish && f.status !== "approved" ? `<button class="mini" data-st="approved">Show on website</button>` : ""}
          ${f.status !== "hidden" ? `<button class="mini danger" data-st="hidden">Hide</button>` : `<button class="mini" data-st="pending">Restore</button>`}</div>
      </article>`).join("") : `<p class="muted">No reviews yet. The form is in the Reviews section of the homepage.</p>`;
  }
  $("#reviews-list").addEventListener("click", run(async (e) => {
    const b = e.target.closest("[data-st]"); if (!b) return;
    await api("PATCH", `/api/admin/feedback/${b.closest("[data-id]").dataset.id}`, { status: b.dataset.st }); toast("Updated."); loadReviews();
  }));

  // ---- CSV downloads (need the auth header, so fetch then save)
  $$("[data-csv]").forEach((b) => b.addEventListener("click", run(async () => {
    const blob = await api("GET", b.dataset.csv);
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: b.dataset.csv.split("/").pop() });
    a.click(); URL.revokeObjectURL(a.href);
  })));

  // ---- Settings
  const sf = $("#settings-form");
  async function loadSettings() {
    const s = await api("GET", "/api/admin/settings");
    $$("input[name*='.'], textarea[name*='.']", sf).forEach((el) => {
      const [sec, key] = el.name.split(".");
      el.value = s[sec][key] ?? "";
    });
    $("#svc-rows").innerHTML = ""; s.services.forEach(addSvc);
    const P = s.plans;
    ["gold", "silver", "silverPayments", "ext12", "ext24", "guaranteeMin"].forEach((k) => (sf["plan_" + k].value = P[k]));
    ["creditPct", "attendPct", "homePerWeek"].forEach((k) => (sf["plan_" + k].value = P.participation[k]));
    sf.plan_packageSizes.value = P.packageSizes.join(", ");
    sf.testimonials.value = s.testimonials.map((t) => `${t.name} | ${t.quote}`).join("\n");
  }
  function addSvc(v = { id: "", name: "", rate: 0, protocol: true, description: "" }) {
    const row = document.createElement("div");
    row.className = "svc-row";
    row.innerHTML = `
      <label>Name<input data-f="name" maxlength="60" required></label>
      <label>Rate ($/hr)<input data-f="rate" type="number" min="0" max="10000"></label>
      <label class="check"><input type="checkbox" data-f="protocol"> Protocol</label>
      <label class="svc-desc">Description<input data-f="description" maxlength="300"></label>
      <button type="button" class="link svc-del" aria-label="Remove service">Remove</button>`;
    row.dataset.id = v.id;
    $("[data-f=name]", row).value = v.name; $("[data-f=rate]", row).value = v.rate;
    $("[data-f=protocol]", row).checked = v.protocol; $("[data-f=description]", row).value = v.description;
    $(".svc-del", row).addEventListener("click", () => row.remove());
    $("#svc-rows").append(row);
  }
  $("#svc-add").addEventListener("click", () => addSvc());
  const slug = (x) => x.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "service";
  sf.addEventListener("submit", run(async (e) => {
    e.preventDefault();
    const msg = $(".form-msg", sf);
    msg.className = "form-msg"; msg.textContent = "";
    const body = { business: {}, coach: {}, rating: {} };
    $$("input[name*='.'], textarea[name*='.']", sf).forEach((el) => { const [sec, key] = el.name.split("."); body[sec][key] = el.value; });
    body.rating.count = Number(body.rating.count || 0);
    const used = new Set();
    body.services = $$(".svc-row", sf).map((r) => {
      const name = $("[data-f=name]", r).value.trim();
      let id = r.dataset.id || slug(name), n = 2; while (used.has(id)) id = slug(name) + "-" + n++; used.add(id);
      return { id, name, rate: Number($("[data-f=rate]", r).value || 0), unit: "hour", protocol: $("[data-f=protocol]", r).checked, description: $("[data-f=description]", r).value.trim() };
    });
    const num = (k) => Number(sf["plan_" + k].value);
    body.plans = {
      gold: num("gold"), silver: num("silver"), silverPayments: num("silverPayments"), ext12: num("ext12"), ext24: num("ext24"), guaranteeMin: num("guaranteeMin"),
      packageSizes: sf.plan_packageSizes.value.split(/[,\s]+/).filter(Boolean).map(Number),
      participation: { creditPct: num("creditPct"), attendPct: num("attendPct"), homePerWeek: num("homePerWeek") }
    };
    body.testimonials = sf.testimonials.value.split("\n").map((x) => x.trim()).filter(Boolean)
      .map((line) => { const i = line.indexOf("|"); return i < 0 ? { name: "", quote: line } : { name: line.slice(0, i).trim(), quote: line.slice(i + 1).trim() }; });
    try {
      await api("PUT", "/api/admin/settings", body);
      msg.className = "form-msg ok"; msg.textContent = "Saved. The website updates immediately.";
    } catch (err) { msg.className = "form-msg err"; msg.textContent = err.message; }
  }));

  if (token) api("GET", "/api/admin/me").then(show).catch(() => {});
})();
