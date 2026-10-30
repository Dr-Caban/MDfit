// MD Fit 1-on-1 booking widget. Used on the homepage (#book) and the standalone /book page.
// MDFit.mountBooker(rootEl, siteData, { type: "eval" })
(() => {
  const { $, $$, esc, api, fmtTime, fmtDate, todayInTz, addDays, zonedToUtc, icsStamp, telHref, wire, areaChips } = window.MDFit;

  function mountBooker(root, site, opts = {}) {
    const types = site.settings.appointmentTypes;
    const biz = site.settings.business;
    const state = {
      type: types.find((t) => t.id === opts.type) || types[0],
      start: null, days: [], date: null, time: null, lastDate: null
    };

    root.innerHTML = `
      <div class="booker-step">
        <h3 class="step-title"><span>1</span> What do you need?</h3>
        <div class="types" role="radiogroup" aria-label="Appointment type"></div>
      </div>
      <div class="booker-step">
        <h3 class="step-title"><span>2</span> Choose a day</h3>
        <div class="date-nav">
          <button type="button" class="icon-btn" data-week="-1" aria-label="Earlier dates">‹</button>
          <div class="dates" role="radiogroup" aria-label="Date"></div>
          <button type="button" class="icon-btn" data-week="1" aria-label="Later dates">›</button>
        </div>
        <h3 class="step-title"><span>3</span> Choose a time</h3>
        <div class="slots"><p class="muted">Loading availability…</p></div>
      </div>
      <form class="booker-step booker-form form" novalidate hidden>
        <h3 class="step-title"><span>4</span> Your details</h3>
        <p class="picked"></p>
        <div class="row">
          <label>Full name<input name="name" required minlength="2" maxlength="100" autocomplete="name"></label>
          <label>Mobile phone<input name="phone" type="tel" required maxlength="30" autocomplete="tel"></label>
        </div>
        <label>Email<input name="email" type="email" required maxlength="254" autocomplete="email"></label>
        <details class="prep">
          <summary>Help Dr. Jared prepare <span class="muted">(optional, 20 seconds)</span></summary>
          <fieldset>
            <legend>Where do you feel it?</legend>
            <div class="chips">${areaChips(site.options?.areas)}</div>
          </fieldset>
          <label class="pain">
            <span>Pain level right now: <output>–</output></span>
            <input type="range" name="painLevel" min="0" max="10" step="1" value="0" data-untouched>
            <span class="pain-scale"><span>0 none</span><span>5</span><span>10 worst</span></span>
          </label>
        </details>
        <label>Anything else? (optional)<textarea name="notes" rows="2" maxlength="1000" placeholder="e.g. right knee, ACL repair in August"></textarea></label>
        <input name="company" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="btn btn-lg" type="submit">Confirm booking</button>
        <p class="fine">Free to cancel online. You'll get a confirmation right away.</p>
        <p class="form-msg" role="status"></p>
      </form>
      <div class="booked" hidden>
        <svg viewBox="0 0 24 24" class="booked-ico" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5"/></svg>
        <h3>You're booked!</h3>
        <p class="booked-when"></p>
        <p class="muted booked-where"></p>
        <div class="booked-actions">
          <a class="btn" data-ics download="mdfit-appointment.ics">Add to calendar</a>
          <a class="btn btn-line" data-gcal target="_blank" rel="noopener">Google Calendar</a>
          <a class="btn btn-line" data-directions target="_blank" rel="noopener">Directions</a>
        </div>
        <p class="fine">Arrive 10 minutes early and wear clothes you can move in. Need to change it? Call <a href="${telHref(biz.phone)}">${esc(biz.phone)}</a>.</p>
        <button class="btn btn-line btn-sm" type="button" data-again>Book another appointment</button>
      </div>`;

    const form = $(".booker-form", root), bookedBox = $(".booked", root);
    const pain = $("[name=painLevel]", form), painOut = $(".pain output", form);
    pain.addEventListener("input", () => { delete pain.dataset.untouched; painOut.textContent = `${pain.value} / 10`; });
    form.addEventListener("reset", () => setTimeout(() => { pain.dataset.untouched = ""; painOut.textContent = "–"; }));

    function renderTypes() {
      $(".types", root).innerHTML = types.map((t) => `
        <button type="button" class="type" role="radio" aria-checked="${t.id === state.type.id}" data-type="${esc(t.id)}">
          <b>${esc(t.name)}</b><span class="mins">${t.minutes} min</span>${t.description ? `<small>${esc(t.description)}</small>` : ""}
        </button>`).join("");
    }

    async function load() {
      const today = todayInTz();
      if (!state.start || state.start < today) state.start = today;
      $(".slots", root).innerHTML = `<p class="muted">Loading availability…</p>`;
      try {
        const d = await api(`/api/availability?type=${encodeURIComponent(state.type.id)}&from=${state.start}&days=7`);
        state.days = d.days; state.lastDate = d.lastDate;
        // Nothing open this week on first load: jump ahead to the first week that has something.
        if (!d.days.some((x) => x.slots.length) && !state.searched && addDays(state.start, 7) <= d.lastDate) {
          state.start = addDays(state.start, 7);
          return load();
        }
        state.searched = true;
        if (!state.date || !d.days.some((x) => x.date === state.date && x.slots.length)) state.date = (d.days.find((x) => x.slots.length) || {}).date || null;
        renderDates();
      } catch {
        $(".slots", root).innerHTML = `<p class="muted">Online booking is unavailable right now. Call <a href="${telHref(biz.phone)}">${esc(biz.phone)}</a> and we'll get you scheduled.</p>`;
      }
    }

    function renderDates() {
      const today = todayInTz();
      $("[data-week='-1']", root).disabled = state.start <= today;
      $("[data-week='1']", root).disabled = Boolean(state.lastDate) && addDays(state.start, 7) > state.lastDate;
      $(".dates", root).innerHTML = state.days.map((d) => `
        <button type="button" class="date" role="radio" data-date="${d.date}" aria-checked="${d.date === state.date}" ${d.slots.length ? "" : "disabled"}
          aria-label="${fmtDate(d.date, { weekday: "long", month: "long", day: "numeric" })}, ${d.slots.length ? d.slots.length + " times open" : "no times"}">
          <small>${fmtDate(d.date, { weekday: "short" })}</small><b>${fmtDate(d.date, { day: "numeric" })}</b><i>${d.slots.length ? `${d.slots.length}<span class="open-word"> open</span>` : "—"}</i>
        </button>`).join("");
      renderSlots();
    }

    function renderSlots() {
      const day = state.days.find((d) => d.date === state.date);
      if (!day) {
        $(".slots", root).innerHTML = `<p class="muted">No openings this week. Try the next week →</p>`;
        form.hidden = true;
        return;
      }
      $(".slots", root).innerHTML = day.slots.map((t) => `<button type="button" class="slot" role="radio" aria-checked="${t === state.time}" data-time="${t}">${fmtTime(t)}</button>`).join("");
      form.hidden = !state.time || !day.slots.includes(state.time);
      if (!form.hidden) $(".picked", form).textContent = `${state.type.name} · ${fmtDate(state.date, { weekday: "long", month: "long", day: "numeric" })} at ${fmtTime(state.time)}`;
    }

    $(".types", root).addEventListener("click", (e) => {
      const b = e.target.closest("[data-type]");
      if (!b) return;
      state.type = types.find((t) => t.id === b.dataset.type);
      state.time = null; state.searched = false;
      renderTypes(); load();
      if (opts.onTypeChange) opts.onTypeChange(state.type);
    });
    $(".date-nav", root).addEventListener("click", (e) => {
      const w = e.target.closest("[data-week]"), d = e.target.closest("[data-date]");
      if (w) { state.start = addDays(state.start, 7 * Number(w.dataset.week)); state.date = null; state.time = null; state.searched = true; load(); }
      if (d) { state.date = d.dataset.date; state.time = null; $$(".date", root).forEach((x) => x.setAttribute("aria-checked", x === d)); renderSlots(); }
    });
    $(".slots", root).addEventListener("click", (e) => {
      const s = e.target.closest("[data-time]");
      if (!s) return;
      state.time = s.dataset.time;
      renderSlots();
      form.scrollIntoView({ behavior: "smooth", block: "nearest" });
      $("[name=name]", form).focus({ preventScroll: true });
    });

    wire(form, async (data) => {
      if (pain.dataset.untouched !== undefined) delete data.painLevel;
      try {
        const out = await api("/api/appointments", { ...data, typeId: state.type.id, date: state.date, time: state.time });
        showBooked(out.appointment);
        return null;
      } catch (err) {
        if (err.status === 409) { state.time = null; load(); }
        throw err;
      }
    });

    function showBooked(a) {
      const start = zonedToUtc(a.date, a.time), end = new Date(start.getTime() + a.minutes * 60e3);
      const title = `${a.typeName} · ${biz.name}`;
      const details = `${biz.name} ${biz.tagline}\n${biz.phone}\nWear clothes you can move in.`;
      const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MD Fit//Booking//EN", "BEGIN:VEVENT",
        `UID:${a.id}@mdfit`, `DTSTAMP:${icsStamp(new Date())}`, `DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`,
        `SUMMARY:${title}`, `LOCATION:${biz.address.replace(/,/g, "\\,")}`, `DESCRIPTION:${details.replace(/\n/g, "\\n").replace(/,/g, "\\,")}`,
        "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", `DESCRIPTION:Appointment at ${biz.name}`, "END:VALARM",
        "END:VEVENT", "END:VCALENDAR"].join("\r\n");
      $("[data-ics]", bookedBox).href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
      $("[data-gcal]", bookedBox).href = "https://calendar.google.com/calendar/render?action=TEMPLATE" +
        `&text=${encodeURIComponent(title)}&dates=${icsStamp(start)}/${icsStamp(end)}&location=${encodeURIComponent(biz.address)}&details=${encodeURIComponent(details)}`;
      $("[data-directions]", bookedBox).href = biz.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.address)}`;
      $(".booked-when", bookedBox).textContent = `${a.typeName} · ${fmtDate(a.date, { weekday: "long", month: "long", day: "numeric" })} at ${fmtTime(a.time)}`;
      $(".booked-where", bookedBox).textContent = `${biz.address} · ${a.minutes} minutes`;
      $$(".booker-step", root).forEach((x) => (x.hidden = true));
      bookedBox.hidden = false;
      bookedBox.scrollIntoView({ behavior: "smooth", block: "center" });
      if (opts.onBooked) opts.onBooked(a);
    }
    $("[data-again]", bookedBox).addEventListener("click", () => {
      bookedBox.hidden = true;
      $$(".booker-step", root).forEach((x) => (x.hidden = false));
      form.hidden = true; state.time = null; load();
    });

    renderTypes();
    load();
  }

  window.MDFit.mountBooker = mountBooker;
})();
