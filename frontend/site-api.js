/* Shared helpers: backend API, admin session, Cash App links. Used by every page. */
const SiteAPI = (() => {
  "use strict";
  const API = String((typeof SITE !== "undefined" && SITE.apiUrl) || "").replace(/\/+$/, "");

  function withTimeout(ms) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    return { signal: c.signal, done: () => clearTimeout(t) };
  }

  // Public site data: { settings, episodes, feedUrl } or null if the API isn't reachable
  async function getSite(timeoutMs = 8000) {
    if (!API) return null;
    const t = withTimeout(timeoutMs);
    try {
      const r = await fetch(API + "/api/site", { signal: t.signal });
      return r.ok ? await r.json() : null;
    } catch (e) { return null; } finally { t.done(); }
  }

  // ---- Cash App (minimum payment is $1)
  const TAG = /^[A-Za-z][A-Za-z0-9]{0,19}$/;
  function parseAmount(v) {
    const n = Number(String(v ?? "").replace(/[$,\s]/g, ""));
    if (!Number.isFinite(n) || n < 1 || n > 10000) return null;
    return Math.round(n * 100) / 100;
  }
  const amountText = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
  function cashAppUrl(tag, amount) {
    tag = String(tag || "").replace(/^\$/, "");
    if (!TAG.test(tag)) return "";
    const a = amount === undefined || amount === null || amount === "" ? null : parseAmount(amount);
    return `https://cash.app/$${tag}` + (a ? "/" + amountText(a) : "");
  }

  // ---- Admin session (shared by /admin and /studio; expires after 12 hours)
  const KEY = "ls-admin-session";
  const session = {
    get() {
      try {
        const s = JSON.parse(localStorage.getItem(KEY) || "null");
        if (s && s.token && Date.parse(s.expires) > Date.now()) return s;
      } catch (e) {}
      session.clear();
      return null;
    },
    set(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} },
    clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  };

  async function login(email, password) {
    if (!API) throw new Error("Backend not connected: set apiUrl in config.js.");
    let r;
    try {
      r = await fetch(API + "/api/admin/login", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password })
      });
    } catch (e) { throw new Error("Can't reach the backend. Check apiUrl and that Railway is running."); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
    session.set(d);
    return d;
  }

  // Authenticated fetch. Throws Error with the server's message; status 401 clears the session.
  async function admin(path, opts = {}) {
    const s = session.get();
    if (!s) { const e = new Error("Please log in."); e.status = 401; throw e; }
    let r;
    try {
      r = await fetch(API + path, { ...opts, headers: { Authorization: "Bearer " + s.token, ...(opts.headers || {}) } });
    } catch (e) { throw new Error("Can't reach the backend."); }
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) session.clear();
      const e = new Error(d.error || `Error ${r.status}`); e.status = r.status; throw e;
    }
    return r;
  }

  return { API, getSite, parseAmount, amountText, cashAppUrl, session, login, admin };
})();
