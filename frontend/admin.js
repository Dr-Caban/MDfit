(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const API = SiteAPI.API;
  const CATEGORIES = ["Comedy", "Society & Culture", "Religion & Spirituality", "Music", "News", "Business",
    "Arts", "Education", "Health & Fitness", "Leisure", "Sports", "True Crime", "TV & Film"];

  let settings = null, episodes = [], subscribers = [], stats = null, editingId = null, isProd = false;

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  };
  const money = (n) => "$" + Number(n || 0).toLocaleString("en-US");
  const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  const getJSON = async (p) => (await SiteAPI.admin(p)).json();
  const sendJSON = async (p, method, body) =>
    (await SiteAPI.admin(p, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

  let toastTimer;
  function toast(text, ok = true) {
    const t = $("toast");
    t.textContent = text; t.className = "toast " + (ok ? "ok" : "bad"); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 4000);
  }

  // Every failed call goes through here: 401 logs out, anything else is shown
  function handle(err, where) {
    if (err.status === 401) return logout("Your session expired. Please log in again.");
    if (where) { where.textContent = "✖ " + err.message; where.className = "hint err msg"; }
    else toast("✖ " + err.message, false);
  }

  // ---- Login / logout
  function showDash(on) { $("login-view").hidden = on; $("dash").hidden = !on; $("admin-nav").hidden = !on; }
  function logout(msg) { SiteAPI.session.clear(); showDash(false); $("login-msg").textContent = msg || ""; }

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.disabled = true; $("login-msg").textContent = "";
    try {
      await SiteAPI.login($("login-email").value.trim(), $("login-password").value);
      $("login-password").value = "";
      await start();
    } catch (err) { $("login-msg").textContent = err.message; }
    finally { btn.disabled = false; }
  });
  $("logout").addEventListener("click", () => logout("Logged out."));

  // ---- Tabs
  function showView(name) {
    document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
    document.querySelectorAll("[data-view-panel]").forEach((p) => (p.hidden = p.dataset.viewPanel !== name));
    try { sessionStorage.setItem("ls-admin-view", name); } catch (e) {}
  }
  document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));

  // ---- Load
  async function start() {
    let me;
    try { me = await getJSON("/api/admin/me"); } catch (err) { return handle(err); }
    showDash(true);
    let view = "overview";
    try { view = sessionStorage.getItem("ls-admin-view") || view; } catch (e) {}
    showView(view);
    try {
      isProd = !!me.production;
      await Promise.all([loadStats(), loadSettings(), loadEpisodes(), loadSubs(), loadActivity()]);
    } catch (err) { handle(err); }
  }

  async function loadStats() {
    stats = await getJSON("/api/admin/stats");
    $("st-subs").textContent = stats.subscribers;
    $("st-week").textContent = `+${stats.subscribersLast7Days} this week`;
    $("st-eps").textContent = stats.episodes;
    $("st-fb").textContent = stats.facebookPosts;
    $("st-fb-last").textContent = stats.lastFacebookPost ? "Last: " + fmtDate(stats.lastFacebookPost)
      : stats.facebookConfigured ? "No posts yet" : "Facebook Page not connected";
    const d = stats.donate;
    const pct = d.goal > 0 ? Math.min(100, Math.round((d.raised / d.goal) * 100)) : 0;
    $("st-fund").textContent = d.goal > 0 ? `${money(d.raised)} · ${pct}%` : "No goal set";
    $("st-fund-bar").style.width = pct + "%";
    $("feed-url").value = stats.feedUrl;
    $("feed-issues").replaceChildren(...(stats.feedIssues.length
      ? stats.feedIssues.map((i) => el("li", { className: "todo", textContent: i }))
      : [el("li", { className: "done", textContent: "Feed is ready to submit." })]));

    const b = $("seed-banner");
    const prod = isProd;
    b.hidden = !stats.seeded;
    b.className = "banner" + (prod ? " danger" : "");
    b.textContent = prod
      ? "WARNING: Sample (seed) data is in production. Clear the Railway volume's data files now."
      : "Sample data loaded for local testing. This is not real subscriber data.";

    const fbOpt = $("fb-option").querySelector("input");
    fbOpt.disabled = !stats.facebookConfigured;
    if (!stats.facebookConfigured) fbOpt.checked = false;
    $("fb-note").textContent = stats.facebookConfigured ? "" : "(connect a Facebook Page on Railway first)";
  }

  $("copy-feed").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("feed-url").value); toast("Feed link copied."); }
    catch (e) { $("feed-url").select(); toast("Press Ctrl/Cmd+C to copy.", false); }
  });

  // ---- Settings
  $("category").append(...CATEGORIES.map((c) => el("option", { value: c, textContent: c })));

  function fillSettings() {
    const s = settings;
    const f = (sec) => document.querySelector(`form[data-section="${sec}"]`).elements;
    const show = f("show");
    for (const k of ["title", "author", "description", "email", "handle", "category", "coverUrl"]) show[k].value = s.show[k] || "";
    show.explicit.checked = !!s.show.explicit;
    const links = f("links");
    for (const k of Object.keys(s.links)) if (links[k]) links[k].value = s.links[k] || "";
    const don = f("donate");
    for (const k of ["goal", "raised", "cashtag", "paypal", "stripe", "gofundme"]) don[k].value = s.donate[k] ?? "";
    don.amounts.value = (s.donate.amounts || []).join(", ");
    f("quotes").quotes.value = (s.quotes || []).join("\n");
    f("clips").clips.value = (s.clips || []).join("\n");
    $("quote-count").textContent = `(${(s.quotes || []).length})`;
    updateCashLink();
    $("ep-explicit").checked = !!s.show.explicit;
    renderDirStatus();
  }

  function updateCashLink() {
    const tag = document.querySelector('form[data-section="donate"]').elements.cashtag.value.trim().replace(/^\$/, "");
    const base = location.origin + "/cashapp";
    $("cash-link").textContent = tag ? `${base}  ·  ${base}/5  (opens $${tag} on Cash App)` : "Set a cashtag to get a share link.";
  }
  document.querySelector('form[data-section="donate"]').elements.cashtag.addEventListener("input", updateCashLink);

  function renderDirStatus() {
    const L = settings.links;
    const dirs = [["spotify", "Spotify"], ["apple", "Apple Podcasts"], ["amazon", "Amazon Music"], ["youtube", "YouTube Music"]];
    $("dir-status").replaceChildren(...dirs.flatMap(([k, n], i) => [
      el("span", { className: L[k] ? "pill on" : "pill", textContent: (L[k] ? "✓ " : "") + n, title: L[k] ? "Listed: link saved in Settings" : "Submit your feed once (Dashboard)" }),
      i < dirs.length - 1 ? " " : ""
    ]), el("small", { className: "hint", textContent: " via your RSS feed" }));
  }

  async function loadSettings() { settings = await getJSON("/api/admin/settings"); fillSettings(); }

  function collect(section, form) {
    const f = form.elements;
    if (section === "show") {
      const o = {};
      for (const k of ["title", "author", "description", "email", "handle", "category", "coverUrl"]) o[k] = f[k].value;
      o.explicit = f.explicit.checked;
      return { show: o };
    }
    if (section === "links") return { links: Object.fromEntries([...form.querySelectorAll("input")].map((i) => [i.name, i.value])) };
    if (section === "donate") {
      const amounts = f.amounts.value.split(",").map((x) => x.trim().replace(/^\$/, "")).filter(Boolean).map(Number);
      const o = { goal: f.goal.value === "" ? 0 : Number(f.goal.value), raised: f.raised.value === "" ? 0 : Number(f.raised.value), cashtag: f.cashtag.value, amounts };
      for (const k of ["paypal", "stripe", "gofundme"]) o[k] = f[k].value;
      return { donate: o };
    }
    if (section === "quotes") return { quotes: f.quotes.value.split("\n") };
    if (section === "clips") return { clips: f.clips.value.split("\n") };
  }

  document.querySelectorAll("form[data-section]").forEach((form) => form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = form.querySelector(".msg");
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; msg.textContent = "Saving…"; msg.className = "hint msg";
    try {
      settings = await sendJSON("/api/admin/settings", "PUT", collect(form.dataset.section, form));
      fillSettings();
      msg.textContent = "Saved. Live on the site now."; msg.className = "hint ok msg";
      loadStats().catch(() => {}); loadActivity().catch(() => {});
    } catch (err) { handle(err, msg); }
    finally { btn.disabled = false; }
  }));

  // ---- Publish / edit episodes
  const platformBoxes = () => [...$("ep-platforms").querySelectorAll("input[type=checkbox]")];
  $("fb-option").querySelector("input").addEventListener("change", (e) => ($("fb-msg-wrap").hidden = !e.target.checked));

  function resetForm() {
    editingId = null;
    $("ep-form").reset();
    $("ep-explicit").checked = !!(settings && settings.show.explicit);
    $("ep-form-title").textContent = "Publish an Episode";
    $("ep-submit").textContent = "Publish";
    $("ep-cancel").hidden = true;
    $("fb-option").hidden = false;
    $("fb-msg-wrap").hidden = true;
  }
  $("ep-cancel").addEventListener("click", () => { resetForm(); $("ep-results").replaceChildren(); });

  const hms = (s) => { if (!s) return ""; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };

  function editEpisode(ep) {
    editingId = ep.id;
    $("ep-title").value = ep.title; $("ep-desc").value = ep.description; $("ep-audio").value = ep.audioUrl;
    $("ep-duration").value = hms(ep.duration); $("ep-number").value = ep.number || ""; $("ep-season").value = ep.season || "";
    $("ep-image").value = ep.imageUrl || ""; $("ep-explicit").checked = !!ep.explicit;
    platformBoxes().forEach((b) => (b.checked = ep.platforms.includes(b.value)));
    $("fb-option").hidden = true; $("fb-msg-wrap").hidden = true;
    $("ep-form-title").textContent = `Edit: ${ep.title}`;
    $("ep-submit").textContent = "Save changes";
    $("ep-cancel").hidden = false;
    $("ep-results").replaceChildren();
    showView("publish");
  }

  $("ep-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const out = $("ep-results");
    const platforms = platformBoxes().filter((b) => b.checked && !b.closest("[hidden]")).map((b) => b.value);
    const body = {
      title: $("ep-title").value, description: $("ep-desc").value, audioUrl: $("ep-audio").value.trim(),
      duration: $("ep-duration").value.trim(), explicit: $("ep-explicit").checked, imageUrl: $("ep-image").value.trim(), platforms
    };
    if ($("ep-number").value) body.number = Number($("ep-number").value);
    if ($("ep-season").value) body.season = Number($("ep-season").value);
    if (!editingId && platforms.includes("facebook") && $("ep-fb-msg").value.trim()) body.facebookMessage = $("ep-fb-msg").value;

    const btn = $("ep-submit");
    btn.disabled = true;
    out.replaceChildren(el("p", { className: "hint", textContent: editingId ? "Saving…" : "Checking the audio link and publishing…" }));
    try {
      if (editingId) {
        await sendJSON(`/api/admin/episodes/${encodeURIComponent(editingId)}`, "PUT", body);
        out.replaceChildren(el("p", { className: "ok", textContent: "Saved. The site and feed are updated." }));
        resetForm();
      } else {
        const { episode, results } = await sendJSON("/api/admin/episodes", "POST", body);
        const rows = [];
        if (results.website) rows.push(["Website", true, "Live on the site now."]);
        if (results.podcast) rows.push(["Podcast apps", true, "Added to your RSS feed. Spotify, Apple, Amazon and YouTube pick it up automatically (usually within a few hours)."]);
        if (results.facebook) rows.push(["Facebook Page", results.facebook.ok, results.facebook.ok ? "Announcement posted." : results.facebook.error]);
        out.replaceChildren(el("p", { className: "ok", textContent: `Published Episode ${episode.number}: ${episode.title}` }),
          el("ul", { className: "checklist" }, ...rows.map(([n, ok, t]) => el("li", { className: ok ? "done" : "todo", textContent: `${n}: ${t}` }))));
        resetForm();
      }
      await Promise.all([loadEpisodes(), loadStats(), loadActivity()]);
    } catch (err) {
      if (err.status === 401) return handle(err);
      out.replaceChildren(el("p", { className: "err", textContent: "✖ " + err.message }));
    } finally { btn.disabled = false; }
  });

  async function loadEpisodes() {
    episodes = (await getJSON("/api/admin/episodes")).episodes;
    $("ep-empty").hidden = episodes.length > 0;
    $("ep-rows").replaceChildren(...episodes.map((ep) => {
      const on = [ep.platforms.includes("website") ? "Website" : "", ep.platforms.includes("podcast") ? "Podcast apps" : ""].filter(Boolean).join(" + ");
      const edit = el("button", { className: "mini", type: "button", textContent: "Edit" });
      edit.addEventListener("click", () => editEpisode(ep));
      const del = el("button", { className: "del", type: "button", textContent: "Unpublish" });
      del.addEventListener("click", () => unpublish(ep));
      const listen = el("a", { href: ep.audioUrl, target: "_blank", rel: "noopener", textContent: "▶" , title: "Open audio" });
      return el("tr", {},
        el("td", { textContent: ep.number || "" }),
        el("td", { className: "wrap" }, ep.title, " ", listen),
        el("td", { textContent: fmtDate(ep.publishedAt) }),
        el("td", { textContent: on }),
        el("td", {}, edit, " ", del));
    }));
  }

  async function unpublish(ep) {
    if (!confirm(`Unpublish "${ep.title}"? It will be removed from the website and the podcast feed.`)) return;
    try {
      await SiteAPI.admin(`/api/admin/episodes/${encodeURIComponent(ep.id)}`, { method: "DELETE" });
      toast("Unpublished.");
      await Promise.all([loadEpisodes(), loadStats(), loadActivity()]);
    } catch (err) { handle(err); }
  }

  // ---- Subscribers
  async function loadSubs() { subscribers = (await getJSON("/api/admin/subscribers")).subscribers; renderSubs(); }
  function renderSubs() {
    const q = $("sub-search").value.trim().toLowerCase();
    const rows = subscribers.filter((s) => !q || s.email.includes(q));
    $("subs").replaceChildren(...rows.map((s) => {
      const del = el("button", { className: "del", type: "button", textContent: "Remove" });
      del.addEventListener("click", () => removeSub(s.email));
      return el("tr", {}, el("td", { textContent: s.email }), el("td", { textContent: fmtDate(s.date) }), el("td", {}, del));
    }));
    $("subs-msg").className = "hint";
    $("subs-msg").textContent = q ? `${rows.length} of ${subscribers.length} shown` : `${subscribers.length} total`;
  }
  $("sub-search").addEventListener("input", renderSubs);

  async function removeSub(email) {
    if (!confirm(`Remove ${email} from the newsletter list?`)) return;
    try {
      await SiteAPI.admin("/api/admin/subscribers/" + encodeURIComponent(email), { method: "DELETE" });
      subscribers = subscribers.filter((s) => s.email !== email);
      renderSubs(); loadStats().catch(() => {}); loadActivity().catch(() => {});
    } catch (err) { handle(err); }
  }

  $("csv").addEventListener("click", async () => {
    try {
      const blob = await (await SiteAPI.admin("/api/admin/subscribers.csv")).blob();
      const a = el("a", { href: URL.createObjectURL(blob), download: "lone-soulja-subscribers.csv" });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch (err) { handle(err); }
  });

  // ---- Activity
  const LABELS = {
    subscribe: "New subscriber", unsubscribe: "Removed subscriber", login: "Admin login",
    facebook_post: "Facebook post", facebook_post_failed: "Facebook post failed", settings_update: "Settings updated",
    episode_published: "Episode published", episode_updated: "Episode edited", episode_unpublished: "Episode unpublished"
  };
  function details(a) {
    switch (a.type) {
      case "subscribe": case "login": return a.email || "";
      case "unsubscribe": return (a.email || "") + (a.by ? ` (by ${a.by})` : "");
      case "facebook_post": return `${a.kind || ""} · id ${a.id || "?"}` + (a.bytes ? ` · ${(a.bytes / 1048576).toFixed(1)} MB` : "");
      case "facebook_post_failed": return `${a.kind || ""} · ${a.error || ""}`;
      case "settings_update": return a.fields || "";
      case "episode_published": return `${a.title || ""} → ${a.platforms || ""}`;
      case "episode_updated": case "episode_unpublished": return a.title || "";
      default: return "";
    }
  }
  async function loadActivity() {
    const list = (await getJSON("/api/admin/activity?limit=100")).activity;
    $("activity").replaceChildren(...list.map((a) => el("tr", {},
      el("td", { textContent: fmtDate(a.time) }),
      el("td", {}, el("span", { className: "tag " + a.type, textContent: LABELS[a.type] || a.type })),
      el("td", { className: "wrap", textContent: details(a) }))));
  }
  $("refresh").addEventListener("click", () => loadActivity().catch(handle));

  // ---- Start
  $("api-info").textContent = API ? "Backend: " + API : "Backend not connected: set apiUrl in config.js.";
  if (SiteAPI.session.get()) start(); else showDash(false);
})();
