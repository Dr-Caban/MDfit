// MDFIT SRQ website: loads content + schedule from the Railway API and handles the three public forms.
(() => {
  const API = window.MDFIT_CONFIG.apiUrl.replace(/\/+$/, "");
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const get = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);

  async function api(path, body) {
    const res = await fetch(API + path, body
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : undefined);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
    return data;
  }

  const fmtTime = (t) => {
    const [h, m] = t.split(":").map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  };
  const fmtDate = (d, opts) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", ...opts });

  $("#year").textContent = new Date().getFullYear();

  // ---- Mobile menu
  const menuBtn = $(".menu-btn"), menu = $("#menu");
  menuBtn.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", open);
  });
  $$("#menu a").forEach((a) => a.addEventListener("click", () => { menu.classList.remove("open"); menuBtn.setAttribute("aria-expanded", false); }));

  // ---- Form helper
  function wire(form, submit) {
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
        const out = await submit(Object.fromEntries(new FormData(form)));
        msg.className = "form-msg ok"; msg.textContent = out.message || "Done!";
        form.reset();
      } catch (err) {
        msg.className = "form-msg err"; msg.textContent = err.message;
      } finally { btn.disabled = false; }
    });
  }

  // ---- Site content
  const SOCIAL_ICONS = {
    instagram: '<path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zM17.3 5.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM12 2c-2.7 0-3 0-4.1.1C4.3 2.3 2.3 4.3 2.1 7.9 2 9 2 9.3 2 12s0 3 .1 4.1c.2 3.6 2.2 5.6 5.8 5.8 1.1.1 1.4.1 4.1.1s3 0 4.1-.1c3.6-.2 5.6-2.2 5.8-5.8.1-1.1.1-1.4.1-4.1s0-3-.1-4.1c-.2-3.6-2.2-5.6-5.8-5.8C15 2 14.7 2 12 2z"/>',
    facebook: '<path d="M14 8h3V4h-3c-2.8 0-5 2.2-5 5v2H7v4h2v7h4v-7h3l1-4h-4V9c0-.6.4-1 1-1z"/>',
    tiktok: '<path d="M16.5 3c.4 2.3 1.9 3.8 4.2 4v3.4c-1.5 0-3-.4-4.2-1.2v6.3a6 6 0 1 1-6-6h.6v3.5a2.6 2.6 0 1 0 2 2.5V3z"/>'
  };

  function renderSite({ settings: s, services, goals }) {
    $$("[data-bind]").forEach((el) => { const v = get(s, el.dataset.bind); if (v) el.textContent = v; });
    if (s.business.name) document.title = `${s.business.name} | Personal Training in Sarasota, FL`;

    $("[name=service]").innerHTML = services.map((x) => `<option>${esc(x)}</option>`).join("");
    $("[name=goal]").innerHTML = goals.map((x) => `<option>${esc(x)}</option>`).join("");

    $(".pricing").innerHTML = s.packages.map((p, i) => `
      <article class="plan">
        <h3>${esc(p.name)}</h3>
        <div><span class="price">${esc(p.price || "Ask")}</span> <span class="unit">${p.price ? esc(p.unit) : "for pricing"}</span></div>
        <ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
        <a href="#consult" class="btn${i === 1 ? "" : " btn-line"}">Start with a free consult</a>
      </article>`).join("");
    if (s.business.bookingNote) $("#pricing-sub").textContent = s.business.bookingNote;

    if (s.coach.name || s.coach.bio) {
      $("#coach").hidden = false;
      $(".coach-bio").innerHTML = s.coach.bio.split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join("");
      if (s.coach.photoUrl) Object.assign($(".coach-photo"), { src: s.coach.photoUrl, alt: s.coach.name, hidden: false });
    }

    if (s.testimonials.length) {
      $("#results").hidden = false;
      $(".quotes").innerHTML = s.testimonials.map((t) => `<blockquote class="quote"><p>&ldquo;${esc(t.quote)}&rdquo;</p><cite>${esc(t.name)}</cite></blockquote>`).join("");
    }

    const b = s.business;
    $(".contact").innerHTML = [
      b.address && `<li>${esc(b.address)}</li>`,
      b.phone && `<li><a href="tel:${esc(b.phone.replace(/[^\d+]/g, ""))}">${esc(b.phone)}</a></li>`,
      b.email && `<li><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></li>`,
      b.hours && `<li>${esc(b.hours)}</li>`
    ].filter(Boolean).join("");
    $(".socials").innerHTML = Object.keys(SOCIAL_ICONS).filter((k) => b[k])
      .map((k) => `<a href="${esc(b[k])}" target="_blank" rel="noopener" aria-label="${k}"><svg viewBox="0 0 24 24">${SOCIAL_ICONS[k]}</svg></a>`).join("");
  }

  // ---- Schedule
  let sessions = [], activeDay = null;
  function renderSchedule() {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getTime() + i * 864e5);
      days.push(new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d));
    }
    if (!activeDay) activeDay = days.find((d) => sessions.some((s) => s.date === d)) || days[0];
    $(".day-tabs").innerHTML = days.map((d) => {
      return `<button class="day-tab" role="tab" aria-selected="${d === activeDay}" data-day="${d}">
        ${fmtDate(d, { weekday: "short" })}<small>${fmtDate(d, { month: "short", day: "numeric" })}</small></button>`;
    }).join("");
    const list = sessions.filter((s) => s.date === activeDay);
    $(".sessions").innerHTML = list.length ? list.map((s) => {
      const cls = s.spotsLeft === 0 ? "full" : s.spotsLeft <= 3 ? "low" : "";
      const spots = s.spotsLeft === 0 ? "Full" : `${s.spotsLeft} spot${s.spotsLeft === 1 ? "" : "s"} left`;
      return `<article class="session">
        <div class="time">${fmtTime(s.time)}<small>${s.durationMin} min</small></div>
        <div><h3>${esc(s.title)}</h3><p>${esc(s.description)}</p>
          <p>${[s.coach && "Coach " + esc(s.coach), esc(s.location)].filter(Boolean).join(" · ")}</p>
          <span class="spots ${cls}">${spots}</span></div>
        <button class="btn btn-sm" data-i="${sessions.indexOf(s)}" ${s.spotsLeft ? "" : "disabled"}>${s.spotsLeft ? "Book" : "Full"}</button>
      </article>`;
    }).join("") : `<p class="muted">No classes this day. <a href="#consult">Book a 1-on-1 instead.</a></p>`;
  }
  $(".day-tabs").addEventListener("click", (e) => {
    const t = e.target.closest(".day-tab");
    if (t) { activeDay = t.dataset.day; renderSchedule(); }
  });

  const loadSchedule = () => api("/api/schedule?days=7")
    .then((d) => { sessions = d.sessions; renderSchedule(); })
    .catch(() => { $(".sessions").innerHTML = `<p class="muted">Schedule is unavailable right now. <a href="#consult">Request a consultation</a> and we'll get you in.</p>`; });

  // ---- Booking dialog
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

  wire($("#lead-form"), (data) => api("/api/leads", data));
  wire($("#news-form"), (data) => api("/api/subscribe", data));

  api("/api/site").then(renderSite).catch(() => {
    // Backend unreachable: keep the static page usable
    $("[name=service]").innerHTML = "<option>Not sure yet</option>";
    $("[name=goal]").innerHTML = "<option>Other</option>";
    $(".pricing").innerHTML = `<p class="muted">Pricing is shared at your free consultation.</p>`;
  });
  loadSchedule();
})();
