// Shared helpers for every MD Fit page: API calls, dates in the clinic's time zone, form wiring.
(() => {
  const API = window.MDFIT_CONFIG.apiUrl.replace(/\/+$/, "");
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const get = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
  let TZ = "America/New_York";

  async function api(path, body) {
    const res = await fetch(API + path, body
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : undefined);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong. Try again."), { status: res.status });
    return data;
  }

  // Dates are YYYY-MM-DD in the clinic's time zone, times HH:MM
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
  const telHref = (p) => { const d = p.replace(/[^\d+]/g, ""); return "tel:" + (d.length === 10 ? "+1" : "") + d; };

  function formData(form) {
    const out = {};
    for (const [k, v] of new FormData(form)) {
      if (k === "areas") (out.areas ||= []).push(v);
      else out[k] = v;
    }
    return out;
  }

  // Validates, disables the button while sending, shows the server's message or error.
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

  const AREAS = ["Neck", "Shoulder", "Upper back", "Lower back", "Hip", "Knee", "Ankle / foot", "Elbow / wrist / hand", "Other"];
  let n = 0;
  const areaChips = (areas = AREAS) => areas.map((a) => `<label class="chip"><input type="checkbox" name="areas" value="${esc(a)}" id="area-${n++}"><span>${esc(a)}</span></label>`).join("");

  let sitePromise;
  const loadSite = () => (sitePromise ||= api("/api/site").then((d) => { if (d.timeZone) TZ = d.timeZone; return d; }));

  window.MDFit = { API, $, $$, esc, get, api, fmtTime, fmtDate, todayInTz, addDays, zonedToUtc, icsStamp, telHref, formData, wire, AREAS, areaChips, loadSite };
})();
