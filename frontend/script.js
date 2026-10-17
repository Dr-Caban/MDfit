(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // State: starts from config.js fallbacks, replaced by live data from the backend
  let settings = { show: {}, links: {}, donate: { venmoHandle: SITE.venmoHandle, amounts: [1, 5, 10], goal: 0, raised: 0 }, quotes: SITE.quotes || [], clips: [] };
  let episodes = [];
  let feedUrl = "";

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  const fmtDur = (s) => (s ? (s >= 3600 ? `${Math.floor(s / 3600)} hr ${Math.round((s % 3600) / 60)} min` : `${Math.max(1, Math.round(s / 60))} min`) : "");
  const meta = (ep) => [ep.number ? `EP ${ep.number}` : "", fmtDate(ep.publishedAt), fmtDur(ep.duration)].filter(Boolean).join(" · ");
  const badge = (ep) => (ep.explicit ? '<span class="ep-badge" title="Explicit">E</span>' : "");

  // ---- Episodes
  function renderEpisodes(filter = "") {
    const status = $("#ep-status");
    const has = episodes.length > 0;
    $("#latest").hidden = !has;
    $("#hero-play").hidden = !has;
    $("#search").hidden = episodes.length < 4;
    if (!has) {
      status.hidden = false;
      status.textContent = "The first episode is dropping soon. Join the list below to hear it first.";
      $("#episode-list").innerHTML = "";
      return;
    }
    status.hidden = true;

    const ep0 = episodes[0];
    $("#latest-card").innerHTML = `
      <div class="latest__num">${esc(ep0.number || "")}</div>
      <div class="latest__body">
        <p class="eyebrow">${esc(meta(ep0))}</p>
        <h3>${esc(ep0.title)}${badge(ep0)}</h3>
        <p>${esc(ep0.description)}</p>
        <button class="btn btn--gold" data-play="0"><svg class="icn" aria-hidden="true"><use href="assets/icons.svg#i-play"/></svg> Play</button>
      </div>`;

    const q = filter.trim().toLowerCase();
    const items = episodes.map((ep, i) => ({ ep, i }))
      .filter(({ ep }) => !q || `${ep.title} ${ep.description} ${ep.number}`.toLowerCase().includes(q));
    $("#episode-list").innerHTML = items.map(({ ep, i }) => `
      <article class="card" id="ep-${esc(ep.id)}">
        <p class="eyebrow">${esc(meta(ep))}</p>
        <h3>${esc(ep.title)}${badge(ep)}</h3>
        <p>${esc(ep.description)}</p>
        <button class="btn btn--aqua btn--sm" data-play="${i}"><svg class="icn" aria-hidden="true"><use href="assets/icons.svg#i-play"/></svg> Play</button>
      </article>`).join("");
    $("#no-results").hidden = items.length > 0;
  }

  // ---- Links: listen platforms + socials + email
  const PLATFORMS = [["spotify", "Spotify"], ["apple", "Apple Podcasts"], ["youtube", "YouTube"], ["amazon", "Amazon Music"]];
  const SOCIALS = [["tiktok", "TikTok"], ["instagram", "Instagram"], ["facebook", "Facebook"], ["x", "X"]];
  const linkHtml = (url, name, cls) => `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener">${esc(name)}</a>`;

  function renderLinks() {
    const L = settings.links || {};
    const plats = PLATFORMS.filter(([k]) => L[k]).map(([k, n]) => linkHtml(L[k], n, "platform"));
    if (feedUrl && plats.length) plats.push(linkHtml(feedUrl, "RSS", "platform"));
    $("#platforms").innerHTML = plats.join("");
    $("#platforms-empty").hidden = plats.length > 0;
    $("#socials").innerHTML = SOCIALS.filter(([k]) => L[k]).map(([k, n]) => linkHtml(L[k], n, "social")).join("");

    const email = settings.show && settings.show.email;
    $("#contact-email").hidden = !email;
    $("#sponsor").hidden = !email;
    if (email) {
      $("#contact-email").href = "mailto:" + email;
      $("#sponsor-email").href = "mailto:" + email + "?subject=" + encodeURIComponent("Sponsoring the Lone Soulja Studio");
    }
  }

  // ---- Donate: goal bar, Venmo quick give, other links
  function renderDonate() {
    const d = settings.donate || {};
    const money = (n) => "$" + Number(n || 0).toLocaleString("en-US");
    $("#goal").hidden = !(d.goal > 0);
    if (d.goal > 0) {
      const pct = Math.max(0, Math.min(100, (d.raised / d.goal) * 100));
      $("#goal-raised").textContent = money(d.raised);
      $("#goal-target").textContent = money(d.goal);
      $("#goal-bar").setAttribute("aria-valuemax", "100");
      $("#goal-bar").setAttribute("aria-valuenow", String(Math.round(pct)));
      requestAnimationFrame(() => ($("#goal-fill").style.width = pct + "%"));
    }

    const tag = d.venmoHandle || "";
    const base = SiteAPI.venmoUrl(tag);
    $("#give").hidden = !base;
    if (base) {
      $("#venmo-label").textContent = "@" + tag;
      const amounts = (d.amounts && d.amounts.length ? d.amounts : [1, 5, 10]).map(SiteAPI.parseAmount).filter(Boolean);
      $("#give-amounts").innerHTML = amounts.map((a) =>
        `<a class="btn btn--dark" href="${esc(SiteAPI.venmoUrl(tag, a, "Lone Soulja Studio"))}" target="_blank" rel="noopener">$${esc(SiteAPI.amountText(a))}</a>`).join("");
    }

    const others = [["paypal", "PayPal"], ["stripe", "Card"], ["gofundme", "GoFundMe"]].filter(([k]) => d[k]);
    $("#donate-links").innerHTML = others.map(([k, n]) =>
      `<a class="btn btn--outline" href="${esc(d[k])}" target="_blank" rel="noopener">Donate via ${esc(n)}</a>`).join("");
  }

  $("#give-custom").addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = SiteAPI.parseAmount($("#give-amount").value);
    const msg = $("#give-msg");
    if (!amount) { msg.textContent = "Enter an amount between $0.01 and $10,000."; return; }
    msg.textContent = "";
    window.open(SiteAPI.venmoUrl(settings.donate.venmoHandle, amount, "Lone Soulja Studio"), "_blank", "noopener");
  });

  // ---- Clips: TikTok / YouTube Shorts / Instagram Reels / Facebook embeds
  function embedUrl(url) {
    let m;
    if ((m = url.match(/tiktok\.com\/.*\/video\/(\d+)/))) return `https://www.tiktok.com/embed/v2/${m[1]}`;
    if ((m = url.match(/(?:youtube\.com\/(?:shorts\/|watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/))) return `https://www.youtube.com/embed/${m[1]}`;
    if ((m = url.match(/instagram\.com\/(?:reel|reels|p)\/([\w-]+)/))) return `https://www.instagram.com/reel/${m[1]}/embed`;
    if (/facebook\.com|fb\.watch/.test(url)) return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
    return "";
  }
  function renderClips() {
    const urls = (settings.clips || []).map(embedUrl).filter(Boolean);
    $("#clips").hidden = $("#nav-clips").hidden = urls.length === 0;
    $("#clip-list").innerHTML = urls.map((u) =>
      `<div class="clip"><iframe src="${esc(u)}" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; clipboard-write" allowfullscreen title="Lone Soulja clip"></iframe></div>`).join("");
  }

  // ---- Thought of the Day
  let quotes = [], qi = -1;
  function setQuotes(list) {
    quotes = (list || []).filter(Boolean);
    qi = quotes.length ? Math.floor(Math.random() * quotes.length) : -1;
    $("#thoughts").hidden = qi < 0;
    showQuote();
  }
  function showQuote() { if (qi >= 0) $("#quote-text").textContent = "“" + Brand.censor(quotes[qi]) + "”"; }
  $("#quote-next").addEventListener("click", () => {
    if (quotes.length < 2) return;
    let n; do { n = Math.floor(Math.random() * quotes.length); } while (n === qi);
    qi = n; showQuote();
  });
  $("#quote-share").addEventListener("click", async () => {
    if (qi < 0) return;
    const c = document.createElement("canvas");
    await Brand.loadFonts();
    Brand.drawQuoteCard(c, {
      quote: quotes[qi], label: "Random Thought of the Day", author: "Geno “Smurf” Collie",
      tags: "#SavageButBlessed #ISaidWhatISaid #LoneSoulja", handle: (settings.show && settings.show.handle) || "",
      theme: "midnight", font: "bebas", format: "story", censor: true
    });
    await Brand.shareOrDownload(await Brand.toBlob(c), "lone-soulja-quote.png", Brand.censor(quotes[qi]));
  });

  // ---- Player
  const player = $("#player");
  const audio = $("#audio");
  function play(i) {
    const ep = episodes[i];
    if (!ep || !ep.audioUrl) return;
    $("#player-title").textContent = ep.title;
    $("#player-sub").textContent = meta(ep);
    if (audio.getAttribute("src") !== ep.audioUrl) audio.src = ep.audioUrl;
    player.hidden = false;
    document.body.classList.add("has-player");
    audio.play().catch(() => {});
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-play]");
    if (b) play(Number(b.dataset.play));
  });
  $("#player-close").addEventListener("click", () => {
    audio.pause();
    player.hidden = true;
    document.body.classList.remove("has-player");
  });

  // ---- Mobile nav
  const toggle = $(".nav__toggle");
  const links = $("#nav-links");
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  links.addEventListener("click", (e) => {
    if (e.target.tagName === "A") { links.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
  });

  // ---- Newsletter
  $("#newsletter").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#email");
    const msg = $("#form-msg");
    const say = (t, ok) => { msg.textContent = t; msg.className = "form__msg " + (ok ? "ok" : "err"); };
    if (!email.checkValidity() || !email.value) return say("Please enter a valid email.", false);
    if (!SiteAPI.API) return say("Sign-ups open soon!", false);
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      const r = await fetch(SiteAPI.API + "/api/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.value })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return say(d.error || "Something went wrong. Try again.", false);
      say("You're locked in!", true);
      e.target.reset();
    } catch (err) {
      say("Couldn't connect. Try again in a minute.", false);
    } finally { btn.disabled = false; }
  });

  $("#search").addEventListener("input", (e) => renderEpisodes(e.target.value));
  $("#year").textContent = new Date().getFullYear();

  function renderAll() {
    renderEpisodes(); renderLinks(); renderDonate(); renderClips();
  }

  // ---- Start: render fallbacks immediately, then live data from the backend
  setQuotes(settings.quotes);
  renderLinks(); renderDonate(); renderClips();
  SiteAPI.getSite().then((data) => {
    if (data) {
      settings = { ...settings, ...data.settings };
      episodes = data.episodes || [];
      feedUrl = data.feedUrl || "";
      if (data.settings.quotes && data.settings.quotes.length) setQuotes(data.settings.quotes);
    }
    renderAll();
    // Deep links from Facebook / RSS: /#ep-<id>
    if (/^#ep-/.test(location.hash)) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) el.scrollIntoView({ block: "center", behavior: "instant" });
    }
  });
})();
