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
  const loaders = { dash: loadDash, appts: loadAppts, hours: loadHours, leads: loadLeads, classes: loadClasses, bookings: loadBookings, subs: loadSubs, settings: loadSettings };
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
      <td>${esc(a.name)}</td><td><a href="tel:${esc(a.phone)}">${esc(a.phone)}</a></td><td>${esc(a.notes)}</td></tr>`;
    table($("#today"), ["Time", "Type", "Client", "Phone", "Notes"], s.today.map((a) => apptRow(a, false)), "Nothing booked today.");
    table($("#next-appts"), ["When", "Type", "Client", "Phone", "Notes"], s.nextAppointments.map((a) => apptRow(a, true)), "No upcoming appointments.");
    table($("#upcoming"), ["When", "Class", "Booked"], s.upcoming.map((x) =>
      `<tr><td>${fmtDate(x.date)} · ${fmtTime(x.time)}</td><td>${esc(x.title)}</td><td>${x.capacity - x.spotsLeft} / ${x.capacity}</td></tr>`),
      "No classes in the next 7 days. Add some under Classes.");
  }

  // ---- Appointments
  async function loadAppts() {
    const list = await api("GET", "/api/admin/appointments" + ($("#appts-all").checked ? "?all=1" : ""));
    $("#appts-list").innerHTML = list.length ? list.map((a) => `
      <article class="lead appt ${a.status}" data-id="${a.id}">
        <header>
          <div><h3>${fmtDate(a.date)} · ${fmtTime(a.time)} <span class="badge ${a.status}">${a.status}</span></h3>
            <div class="meta">${esc(a.typeName)} · ${a.minutes} min</div></div>
          <div class="meta">Booked ${when(a.createdAt)}</div>
        </header>
        <div><strong>${esc(a.name)}</strong> · <a href="tel:${esc(a.phone)}">${esc(a.phone)}</a> · <a href="mailto:${esc(a.email)}">${esc(a.email)}</a></div>
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

  // ---- Booking hours
  const hf = $("#hours-form");
  $("#hours-days").innerHTML = DAYS.map((d, i) => `<label class="day-hours">${d}<input data-day="${i}" placeholder="Closed"></label>`).join("");
  async function loadHours() {
    const s = await api("GET", "/api/admin/settings");
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
    sf.packages.value = s.packages.map((p) => [`${p.name} | ${p.price} | ${p.unit}`, ...p.features].join("\n")).join("\n\n");
    sf.testimonials.value = s.testimonials.map((t) => `${t.name} | ${t.quote}`).join("\n");
  }
  sf.addEventListener("submit", run(async (e) => {
    e.preventDefault();
    const msg = $(".form-msg", sf);
    msg.className = "form-msg"; msg.textContent = "";
    const body = { business: {}, coach: {}, rating: {} };
    $$("input[name*='.'], textarea[name*='.']", sf).forEach((el) => { const [sec, key] = el.name.split("."); body[sec][key] = el.value; });
    body.rating.count = Number(body.rating.count || 0);
    body.packages = sf.packages.value.split(/\n\s*\n/).map((blk) => blk.split("\n").map((x) => x.trim()).filter(Boolean)).filter((l) => l.length)
      .map(([head, ...features]) => { const [name, price = "", unit = ""] = head.split("|").map((x) => x.trim()); return { name, price, unit, features }; });
    body.testimonials = sf.testimonials.value.split("\n").map((x) => x.trim()).filter(Boolean)
      .map((line) => { const i = line.indexOf("|"); return i < 0 ? { name: "", quote: line } : { name: line.slice(0, i).trim(), quote: line.slice(i + 1).trim() }; });
    try {
      await api("PUT", "/api/admin/settings", body);
      msg.className = "form-msg ok"; msg.textContent = "Saved. The website updates immediately.";
    } catch (err) { msg.className = "form-msg err"; msg.textContent = err.message; }
  }));

  if (token) api("GET", "/api/admin/me").then(show).catch(() => {});
})();
