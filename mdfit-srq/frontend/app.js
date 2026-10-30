// MD Fit website: content, 1-on-1 scheduler, class booking, intake and newsletter, all from the Railway API.
(() => {
  const API = window.MDFIT_CONFIG.apiUrl.replace(/\/+$/, "");
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const get = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
  let TZ = "America/New_York";
  let site = null;

  async function api(path, body) {
    const res = await fetch(API + path, body
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : undefined);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong. Try again."), { status: res.status });
    return data;
  }

  // ---- Date helpers (dates are YYYY-MM-DD in the clinic's time zone)
  const fmtTime = (t) => { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
  const fmtDate = (d, opts) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
  const todayInTz = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const addDays = (d, n) => new Date(Date.parse(d + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
  // Wall-clock time in TZ -> UTC Date
  function zonedToUtc(date, time) {
    const guess = Date.parse(`${date}T${time}:00Z`);
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
    const asTz = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
    return new Date(guess - (asTz - guess));
  }
  const icsStamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  $("#year").textContent = new Date().getFullYear();

  // ---- Mobile menu
  const menuBtn = $(".menu-btn"), menu = $("#menu");
  menuBtn.addEventListener("click", () => menuBtn.setAttribute("aria-expanded", menu.classList.toggle("open")));
  $$("#menu a").forEach((a) => a.addEventListener("click", () => { menu.classList.remove("open"); menuBtn.setAttribute("aria-expanded", false); }));

  // ---- Form helper
  function wire(form, submit, { reset = true } = {}) {
    const msg = $(".form-msg", form), btn = $("button[type=submit]", form);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg.className = "form-msg"; msg.textContent = "";
      if (!form.checkValidity()) {
        const bad = $(":invalid", form);
        msg.className = "form-msg err";
        msg.textContent = `Please check: ${bad.closest("label")?.firstChild?.textContent?.trim() || bad.name}.`;
        bad.focus();
        return;
      }
      btn.disabled = true;
      try {
        const out = await submit(formData(form));
        if (out && out.message) { msg.className = "form-msg ok"; msg.textContent = out.message; }
        if (reset) form.reset();
      } catch (err) {
        msg.className = "form-msg err"; msg.textContent = err.message;
      } finally { btn.disabled = false; }
    });
  }
  function formData(form) {
    const fd = new FormData(form), out = {};
    for (const [k, v] of fd) {
      if (k === "areas") (out.areas ||= []).push(v);
      else out[k] = v;
    }
    return out;
  }

  // ---- Body-area chips (hero quick start + intake form)
  const AREAS_FALLBACK = ["Neck", "Shoulder", "Upper back", "Lower back", "Hip", "Knee", "Ankle / foot", "Elbow / wrist / hand", "Other"];
  function renderAreas(areas) {
    $$("[data-areas]").forEach((box, n) => {
      box.innerHTML = areas.map((a, i) => `<label class="chip"><input type="checkbox" name="areas" value="${esc(a)}" id="area-${n}-${i}"><span>${esc(a)}</span></label>`).join("");
    });
  }
  renderAreas(AREAS_FALLBACK);
  $("#quick-start").addEventListener("submit", (e) => {
    e.preventDefault();
    const picked = $$("input:checked", e.target).map((i) => i.value);
    $$("#lead-form [name=areas]").forEach((i) => (i.checked = picked.includes(i.value)));
    $("#intake").scrollIntoView({ behavior: "smooth" });
    setTimeout(() => $("#lead-form [name=painLevel]").focus({ preventScroll: true }), 500);
  });

  // ---- Pain slider: "–" until touched, so we don't send a fake 0
  const pain = $("#lead-form [name=painLevel]"), painOut = $("#pain-out");
  pain.addEventListener("input", () => { delete pain.dataset.untouched; painOut.textContent = `${pain.value} / 10`; });
  $("#lead-form").addEventListener("reset", () => setTimeout(() => { pain.dataset.untouched = ""; painOut.textContent = "–"; }));

  // ---- Site content
  const SOCIAL_ICONS = {
    instagram: '<path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zM17.3 5.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM12 2c-2.7 0-3 0-4.1.1C4.3 2.3 2.3 4.3 2.1 7.9 2 9 2 9.3 2 12s0 3 .1 4.1c.2 3.6 2.2 5.6 5.8 5.8 1.1.1 1.4.1 4.1.1s3 0 4.1-.1c3.6-.2 5.6-2.2 5.8-5.8.1-1.1.1-1.4.1-4.1s0-3-.1-4.1c-.2-3.6-2.2-5.6-5.8-5.8C15 2 14.7 2 12 2z"/>',
    facebook: '<path d="M14 8h3V4h-3c-2.8 0-5 2.2-5 5v2H7v4h2v7h4v-7h3l1-4h-4V9c0-.6.4-1 1-1z"/>',
    tiktok: '<path d="M16.5 3c.4 2.3 1.9 3.8 4.2 4v3.4c-1.5 0-3-.4-4.2-1.2v6.3a6 6 0 1 1-6-6h.6v3.5a2.6 2.6 0 1 0 2 2.5V3z"/>'
  };
  const telHref = (p) => "tel:" + (p.replace(/[^\d+]/g, "").length === 10 ? "+1" : "") + p.replace(/[^\d+]/g, "");
  const options = (sel, list, keepFirst) => { sel.innerHTML = (keepFirst ? sel.options[0].outerHTML : "") + list.map((x) => `<option>${esc(x)}</option>`).join(""); };

  function renderSite(data) {
    site = data;
    const s = data.settings, b = s.business;
    TZ = data.timeZone || TZ;
    $$("[data-bind]").forEach((el) => { const v = get(s, el.dataset.bind); if (v !== undefined && v !== "") el.textContent = v; });
    if (b.phone) $$("[data-phone-link]").forEach((a) => (a.href = telHref(b.phone)));
    $$("[data-maps]").forEach((a) => (a.href = b.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`));
    if (b.email) { $(".email-row").hidden = false; Object.assign($("[data-email-link]"), { href: "mailto:" + b.email, textContent: b.email }); }

    const o = data.options || { areas: AREAS_FALLBACK, services: data.services, goals: data.goals, durations: [], surgery: [] };
    const checked = $$("[name=areas]:checked").map((i) => i.value);
    renderAreas(o.areas);
    $$("[name=areas]").forEach((i) => (i.checked = checked.includes(i.value)));
    options($("#lead-form [name=service]"), o.services);
    options($("#lead-form [name=goal]"), o.goals);
    options($("#lead-form [name=duration]"), o.durations, true);
    options($("#lead-form [name=surgery]"), o.surgery, true);

    $(".pricing").innerHTML = s.packages.map((p, i) => `
      <article class="plan${i === 0 ? " featured" : ""}">
        ${i === 0 ? `<span class="tag">Start here</span>` : ""}
        <h3>${esc(p.name)}</h3>
        <div><span class="price">${esc(p.price || "Call")}</span> <span class="unit">${esc(p.price ? p.unit : `for pricing · ${p.unit}`)}</span></div>
        <ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
        <a href="#book" class="btn${i === 0 ? "" : " btn-line"}">${i === 0 ? "Book an evaluation" : "Get started"}</a>
      </article>`).join("");
    if (b.bookingNote) $("#pricing-sub").textContent = b.bookingNote;

    $(".coach-bio").innerHTML = s.coach.bio.split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join("");
    if (s.coach.photoUrl) Object.assign($(".coach-photo"), { src: s.coach.photoUrl, alt: s.coach.name, hidden: false });

    const r = s.rating;
    $("#rating").hidden = !(r.score && r.count);
    $(".review-sum").innerHTML = r.score && r.count
      ? `<span class="stars" aria-hidden="true">★★★★★</span> <strong>${esc(r.score)} out of 5</strong> from ${esc(r.count)} reviews${r.url ? ` · <a href="${esc(r.url)}" target="_blank" rel="noopener">Read them on ${esc(r.source || "our review page")}</a>` : ""}`
      : "";
    $("#reviews").hidden = !s.testimonials.length;
    $(".quotes").innerHTML = s.testimonials.map((t) =>
      `<blockquote class="quote"><span class="stars" aria-hidden="true">★★★★★</span><p>&ldquo;${esc(t.quote)}&rdquo;</p><cite>${esc(t.name)}</cite></blockquote>`).join("");

    $(".contact").innerHTML = [
      b.address && `<li>${esc(b.address)}</li>`,
      b.phone && `<li><a href="${telHref(b.phone)}">${esc(b.phone)}</a></li>`,
      b.email && `<li><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></li>`,
      b.hours && `<li>${esc(b.hours)}</li>`
    ].filter(Boolean).join("");
    $(".socials").innerHTML = Object.keys(SOCIAL_ICONS).filter((k) => b[k])
      .map((k) => `<a href="${esc(b[k])}" target="_blank" rel="noopener" aria-label="${k}"><svg viewBox="0 0 24 24">${SOCIAL_ICONS[k]}</svg></a>`).join("");

    renderTypes(s.appointmentTypes);
  }

  // ================= 1-on-1 scheduler =================
  const booker = $(".booker"), apptForm = $("#appt-form"), bookedBox = $(".booked", booker);
  const state = { type: null, start: null, days: [], date: null, time: null, lastDate: null };

  function renderTypes(types) {
    if (!state.type || !types.some((t) => t.id === state.type.id)) state.type = types[0];
    $(".types").innerHTML = types.map((t) => `
      <button type="button" class="type" role="radio" aria-checked="${t.id === state.type.id}" data-type="${esc(t.id)}">
        <b>${esc(t.name)}</b><span class="mins">${t.minutes} min</span>${t.description ? `<small>${esc(t.description)}</small>` : ""}
      </button>`).join("");
    loadAvailability();
  }
  $(".types").addEventListener("click", (e) => {
    const b = e.target.closest("[data-type]");
    if (!b || !site) return;
    state.type = site.settings.appointmentTypes.find((t) => t.id === b.dataset.type);
    state.time = null;
    $$(".type").forEach((x) => x.setAttribute("aria-checked", x === b));
    loadAvailability();
  });

  async function loadAvailability() {
    const today = todayInTz();
    if (!state.start || state.start < today) state.start = today;
    $(".slots").innerHTML = `<p class="muted">Loading availability…</p>`;
    try {
      const d = await api(`/api/availability?type=${encodeURIComponent(state.type.id)}&from=${state.start}&days=7`);
      state.days = d.days; state.lastDate = d.lastDate;
      if (!state.date || !d.days.some((x) => x.date === state.date && x.slots.length)) state.date = (d.days.find((x) => x.slots.length) || {}).date || null;
      renderDates();
    } catch {
      $(".slots").innerHTML = `<p class="muted">Online booking is unavailable right now. Call <a href="${telHref(site?.settings.business.phone || "941-313-0562")}">${esc(site?.settings.business.phone || "941-313-0562")}</a> and we'll get you scheduled.</p>`;
    }
  }

  function renderDates() {
    const today = todayInTz();
    $("[data-week='-1']").disabled = state.start <= today;
    $("[data-week='1']").disabled = state.lastDate && addDays(state.start, 7) > state.lastDate;
    $(".dates").innerHTML = state.days.map((d) => `
      <button type="button" class="date" role="radio" data-date="${d.date}" aria-checked="${d.date === state.date}" ${d.slots.length ? "" : "disabled"}
        aria-label="${fmtDate(d.date, { weekday: "long", month: "long", day: "numeric" })}, ${d.slots.length ? d.slots.length + " times open" : "no times"}">
        <small>${fmtDate(d.date, { weekday: "short" })}</small><b>${fmtDate(d.date, { day: "numeric" })}</b><i>${d.slots.length ? d.slots.length + " open" : "—"}</i>
      </button>`).join("");
    renderSlots();
  }

  function renderSlots() {
    const day = state.days.find((d) => d.date === state.date);
    if (!day) {
      $(".slots").innerHTML = `<p class="muted">No openings this week. Try the next week →</p>`;
      apptForm.hidden = true;
      return;
    }
    $(".slots").innerHTML = day.slots.map((t) => `<button type="button" class="slot" role="radio" aria-checked="${t === state.time}" data-time="${t}">${fmtTime(t)}</button>`).join("");
    apptForm.hidden = !state.time || !day.slots.includes(state.time);
    if (!apptForm.hidden) $(".picked", apptForm).textContent = `${state.type.name} · ${fmtDate(state.date, { weekday: "long", month: "long", day: "numeric" })} at ${fmtTime(state.time)}`;
  }

  $(".date-nav").addEventListener("click", (e) => {
    const w = e.target.closest("[data-week]"), d = e.target.closest("[data-date]");
    if (w) { state.start = addDays(state.start, 7 * Number(w.dataset.week)); state.date = null; state.time = null; loadAvailability(); }
    if (d) { state.date = d.dataset.date; state.time = null; $$(".date").forEach((x) => x.setAttribute("aria-checked", x === d)); renderSlots(); }
  });
  $(".slots").addEventListener("click", (e) => {
    const s = e.target.closest("[data-time]");
    if (!s) return;
    state.time = s.dataset.time;
    renderSlots();
    apptForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
    $("[name=name]", apptForm).focus({ preventScroll: true });
  });

  wire(apptForm, async (data) => {
    try {
      const out = await api("/api/appointments", { ...data, typeId: state.type.id, date: state.date, time: state.time });
      showBooked(out.appointment);
      return null;
    } catch (err) {
      if (err.status === 409) { state.time = null; loadAvailability(); }
      throw err;
    }
  });

  function showBooked(a) {
    const b = site.settings.business;
    const start = zonedToUtc(a.date, a.time), end = new Date(start.getTime() + a.minutes * 60e3);
    const title = `${a.typeName} · ${b.name}`;
    const details = `${b.name} ${b.tagline}\n${b.phone}\nWear clothes you can move in.`;
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MD Fit//Booking//EN", "BEGIN:VEVENT",
      `UID:${a.id}@mdfit`, `DTSTAMP:${icsStamp(new Date())}`, `DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`,
      `SUMMARY:${title}`, `LOCATION:${b.address.replace(/,/g, "\\,")}`, `DESCRIPTION:${details.replace(/\n/g, "\\n").replace(/,/g, "\\,")}`,
      "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Appointment at MD Fit", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    $("[data-ics]", bookedBox).href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    $("[data-gcal]", bookedBox).href = "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      `&text=${encodeURIComponent(title)}&dates=${icsStamp(start)}/${icsStamp(end)}&location=${encodeURIComponent(b.address)}&details=${encodeURIComponent(details)}`;
    $(".booked-when", bookedBox).textContent = `${a.typeName} · ${fmtDate(a.date, { weekday: "long", month: "long", day: "numeric" })} at ${fmtTime(a.time)}`;
    $(".booked-where", bookedBox).textContent = `${b.address} · ${a.minutes} minutes`;
    $$(".booker-step", booker).forEach((x) => (x.hidden = true));
    bookedBox.hidden = false;
    bookedBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  $("[data-again]", bookedBox).addEventListener("click", () => {
    bookedBox.hidden = true;
    $$(".booker-step", booker).forEach((x) => (x.hidden = false));
    state.time = null; loadAvailability();
  });

  // ================= Group classes =================
  let sessions = [], activeDay = null;
  function renderSchedule() {
    const today = todayInTz();
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
    if (!activeDay) activeDay = days.find((d) => sessions.some((s) => s.date === d)) || days[0];
    $(".day-tabs").innerHTML = days.map((d) => `<button class="day-tab" role="tab" aria-selected="${d === activeDay}" data-day="${d}">
        ${fmtDate(d, { weekday: "short" })}<small>${fmtDate(d, { month: "short", day: "numeric" })}</small></button>`).join("");
    const list = sessions.filter((s) => s.date === activeDay);
    $(".sessions").innerHTML = list.length ? list.map((s) => {
      const cls = s.spotsLeft === 0 ? "full" : s.spotsLeft <= 3 ? "low" : "";
      const spots = s.spotsLeft === 0 ? "Full" : `${s.spotsLeft} spot${s.spotsLeft === 1 ? "" : "s"} left`;
      return `<article class="session">
        <div class="time">${fmtTime(s.time)}<small>${s.durationMin} min</small></div>
        <div><h3>${esc(s.title)}</h3><p>${esc(s.description)}</p>
          <p>${[s.coach && "With " + esc(s.coach), esc(s.location)].filter(Boolean).join(" · ")}</p>
          <span class="spots ${cls}">${spots}</span></div>
        <button class="btn btn-sm" data-i="${sessions.indexOf(s)}" ${s.spotsLeft ? "" : "disabled"}>${s.spotsLeft ? "Reserve" : "Full"}</button>
      </article>`;
    }).join("") : `<p class="muted">No classes this day. <a href="#book">Book a 1-on-1 instead.</a></p>`;
  }
  $(".day-tabs").addEventListener("click", (e) => {
    const t = e.target.closest(".day-tab");
    if (t) { activeDay = t.dataset.day; renderSchedule(); }
  });
  const loadSchedule = () => api("/api/schedule?days=7")
    .then((d) => { sessions = d.sessions; if (!sessions.length) $("#classes").hidden = true; else { $("#classes").hidden = false; renderSchedule(); } })
    .catch(() => { $(".sessions").innerHTML = `<p class="muted">Class schedule is unavailable right now.</p>`; });

  const dlg = $("#book-dialog"), bookForm = $("#book-form");
  let picked = null;
  $(".sessions").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]");
    if (!b) return;
    picked = sessions[b.dataset.i];
    $(".book-title", dlg).textContent = picked.title;
    $(".book-when", dlg).textContent = `${fmtDate(picked.date, { weekday: "long", month: "long", day: "numeric" })} · ${fmtTime(picked.time)} · ${picked.durationMin} min`;
    $(".form-msg", dlg).textContent = "";
    $("button[type=submit]", dlg).hidden = false;
    dlg.showModal();
  });
  $(".close", dlg).addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  wire(bookForm, async (data) => {
    const out = await api("/api/bookings", { ...data, classId: picked.classId, date: picked.date });
    $("button[type=submit]", dlg).hidden = true;
    loadSchedule();
    return out;
  });

  // ================= Intake + newsletter =================
  wire($("#lead-form"), (data) => {
    if (pain.dataset.untouched !== undefined) delete data.painLevel;
    return api("/api/leads", data);
  });
  wire($("#news-form"), (data) => api("/api/subscribe", data));

  api("/api/site").then(renderSite).catch(() => {
    // Backend unreachable: keep the static page usable and point people to the phone
    options($("#lead-form [name=service]"), ["Not sure yet"]);
    options($("#lead-form [name=goal]"), ["Other"]);
    $(".pricing").innerHTML = `<p class="muted">Call 941-313-0562 for pricing.</p>`;
    $(".slots").innerHTML = `<p class="muted">Online booking is unavailable right now. Call <a href="tel:+19413130562">941-313-0562</a> and we'll get you scheduled.</p>`;
    $("#reviews").hidden = true;
  });
  loadSchedule();
})();
