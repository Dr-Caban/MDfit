(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const API = String(SITE.apiUrl || "").replace(/\/+$/, "");
  let key = "";
  let subscribers = [];

  const store = {
    get: () => { try { return sessionStorage.getItem("ls-admin-key") || ""; } catch (e) { return ""; } },
    set: (v) => { try { v ? sessionStorage.setItem("ls-admin-key", v) : sessionStorage.removeItem("ls-admin-key"); } catch (e) {} }
  };

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  };
  const money = (n) => "$" + Number(n || 0).toLocaleString("en-US");
  const say = (el, text, ok) => { el.textContent = text; el.className = "hint " + (ok ? "ok" : "err"); };

  // fetch wrapper: admin key header, JSON errors, logs out on 401
  async function api(path, opts = {}) {
    const r = await fetch(API + path, { ...opts, headers: { "X-Admin-Key": key, ...(opts.headers || {}) } });
    if (r.status === 401) { logout("Session expired or wrong key. Log in again."); throw new Error("Unauthorized"); }
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || `Error ${r.status}`);
    }
    return r;
  }
  const getJSON = async (p) => (await api(p)).json();
  const putJSON = (p, body) => api(p, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  // ---- Login / logout
  function showDash(on) {
    $("login-view").hidden = on;
    $("dash").hidden = !on;
    $("admin-nav").hidden = !on;
  }

  function logout(msg) {
    key = ""; store.set("");
    showDash(false);
    $("login-msg").textContent = msg || "";
  }

  async function login(k) {
    if (!API) { $("login-msg").textContent = "Set apiUrl in episodes.js to your Railway URL first."; return; }
    key = k;
    try {
      const r = await fetch(API + "/api/admin/me", { headers: { "X-Admin-Key": k } });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { key = ""; $("login-msg").textContent = d.error || `Error ${r.status}`; return; }
      store.set(k);
      $("login-msg").textContent = "";
      showDash(true);
      await loadAll(d.production);
    } catch (e) {
      key = "";
      $("login-msg").textContent = "Can't reach the backend. Check apiUrl and that Railway is running.";
    }
  }

  $("login-form").addEventListener("submit", (e) => { e.preventDefault(); login($("login-key").value.trim()); });
  $("logout").addEventListener("click", () => logout("Logged out."));
  $("refresh").addEventListener("click", () => loadAll());

  // ---- Load everything
  let isProd = false;
  async function loadAll(production) {
    if (typeof production === "boolean") isProd = production;
    try {
      await Promise.all([loadStats(), loadContent(), loadSubs(), loadActivity()]);
    } catch (e) { if (e.message !== "Unauthorized") say($("subs-msg"), "Couldn't load: " + e.message, false); }
  }

  async function loadStats() {
    const s = await getJSON("/api/admin/stats");
    $("st-subs").textContent = s.subscribers;
    $("st-week").textContent = "+" + s.subscribersLast7Days;
    $("st-fb").textContent = s.facebookPosts;
    $("st-fb-last").textContent = s.lastFacebookPost ? "Last: " + fmtDate(s.lastFacebookPost)
      : s.facebookConfigured ? "No posts yet" : "Facebook Page not connected";
    const pct = s.donate.goal > 0 ? Math.min(100, Math.round((s.donate.raised / s.donate.goal) * 100)) : 0;
    $("st-fund").textContent = s.donate.goal > 0 ? `${money(s.donate.raised)} · ${pct}%` : "No goal set";
    $("st-fund-bar").style.width = pct + "%";

    const b = $("seed-banner");
    b.hidden = !s.seeded;
    b.className = "banner" + (isProd ? " danger" : "");
    b.textContent = isProd
      ? "⚠️ SAMPLE (SEED) DATA IS IN PRODUCTION. Clear the Railway volume's data files now."
      : "Sample data loaded for local testing. This is not real subscriber data.";
  }

  async function loadContent() {
    const c = await getJSON("/api/admin/content");
    const d = c.donate || (SITE.donate || {});
    $("goal").value = d.goal || 0;
    $("raised").value = d.raised || 0;
    const quotes = Array.isArray(c.quotes) && c.quotes.length ? c.quotes : (SITE.quotes || []);
    $("quotes").value = quotes.join("\n");
    countQuotes();
  }

  const quoteLines = () => $("quotes").value.split("\n").map((q) => q.trim()).filter(Boolean);
  const countQuotes = () => { const n = quoteLines().length; $("quote-count").textContent = `(${n})`; };
  $("quotes").addEventListener("input", countQuotes);

  $("donate-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await putJSON("/api/admin/content", { donate: { goal: Number($("goal").value), raised: Number($("raised").value) } });
      say($("donate-msg"), "✅ Saved. The site shows the new numbers now.", true);
      loadStats(); loadActivity();
    } catch (err) { if (err.message !== "Unauthorized") say($("donate-msg"), "❌ " + err.message, false); }
  });

  $("save-quotes").addEventListener("click", async () => {
    try {
      await putJSON("/api/admin/content", { quotes: quoteLines() });
      say($("quotes-msg"), `✅ Saved ${quoteLines().length} quotes.`, true);
      loadActivity();
    } catch (err) { if (err.message !== "Unauthorized") say($("quotes-msg"), "❌ " + err.message, false); }
  });

  // ---- Subscribers
  async function loadSubs() {
    subscribers = (await getJSON("/api/admin/subscribers")).subscribers;
    renderSubs();
  }

  function renderSubs() {
    const q = $("sub-search").value.trim().toLowerCase();
    const rows = subscribers.filter((s) => !q || s.email.includes(q));
    const tbody = $("subs");
    tbody.replaceChildren(...rows.map((s) => {
      const tr = document.createElement("tr");
      const td = (t) => { const c = document.createElement("td"); c.textContent = t; return c; };
      const del = document.createElement("button");
      del.className = "del"; del.textContent = "Remove"; del.type = "button";
      del.addEventListener("click", () => removeSub(s.email));
      const act = document.createElement("td"); act.append(del);
      tr.append(td(s.email), td(fmtDate(s.date)), act);
      return tr;
    }));
    $("subs-msg").className = "hint";
    $("subs-msg").textContent = q ? `${rows.length} of ${subscribers.length} shown` : `${subscribers.length} total`;
  }
  $("sub-search").addEventListener("input", renderSubs);

  async function removeSub(email) {
    if (!confirm(`Remove ${email} from the newsletter list?`)) return;
    try {
      await api("/api/admin/subscribers/" + encodeURIComponent(email), { method: "DELETE" });
      subscribers = subscribers.filter((s) => s.email !== email);
      renderSubs(); loadStats(); loadActivity();
    } catch (e) { if (e.message !== "Unauthorized") say($("subs-msg"), "❌ " + e.message, false); }
  }

  $("csv").addEventListener("click", async () => {
    try {
      const blob = await (await api("/api/subscribers.csv")).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "lone-soulja-subscribers.csv";
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch (e) { if (e.message !== "Unauthorized") say($("subs-msg"), "❌ " + e.message, false); }
  });

  // ---- Activity
  const LABELS = { subscribe: "New subscriber", unsubscribe: "Removed subscriber", facebook_post: "Facebook post",
    facebook_post_failed: "Facebook post failed", content_update: "Content updated" };

  function details(a) {
    switch (a.type) {
      case "subscribe": return a.email || "";
      case "unsubscribe": return (a.email || "") + (a.by ? ` (by ${a.by})` : "");
      case "facebook_post": return `${a.kind || ""} · id ${a.id || "?"}` + (a.bytes ? ` · ${(a.bytes / 1048576).toFixed(1)} MB` : "");
      case "facebook_post_failed": return `${a.kind || ""} · ${a.error || ""}`;
      case "content_update": return a.fields || "";
      default: return "";
    }
  }

  async function loadActivity() {
    const list = (await getJSON("/api/admin/activity?limit=100")).activity;
    $("activity").replaceChildren(...list.map((a) => {
      const tr = document.createElement("tr");
      const when = document.createElement("td"); when.textContent = fmtDate(a.time);
      const ev = document.createElement("td");
      const tag = document.createElement("span"); tag.className = "tag " + a.type; tag.textContent = LABELS[a.type] || a.type;
      ev.append(tag);
      const det = document.createElement("td"); det.className = "wrap"; det.textContent = details(a);
      tr.append(when, ev, det);
      return tr;
    }));
  }

  // ---- Start
  $("api-info").textContent = API ? "Backend: " + API : "⚠️ Backend not connected: set apiUrl in episodes.js.";
  const saved = store.get();
  if (saved) login(saved); else showDash(false);
})();
