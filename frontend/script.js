(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  const fmtDate = (iso) => {
    const d = new Date(iso + "T12:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const meta = (ep) => `EP ${ep.number} · ${fmtDate(ep.date)} · ${ep.duration}`;

  const playBtn = (ep, i, cls) =>
    ep.audio
      ? `<button class="btn ${cls}" data-play="${i}">▶ Play</button>`
      : `<span class="badge">Coming soon</span>`;

  // ---- Latest episode
  function renderLatest() {
    const ep = EPISODES[0];
    const el = $("#latest-card");
    if (!ep) { el.innerHTML = `<p class="muted">First episode dropping soon.</p>`; return; }
    el.innerHTML = `
      <div class="latest__num">${esc(ep.number)}</div>
      <div class="latest__body">
        <p class="eyebrow">${esc(meta(ep))}</p>
        <h3>${esc(ep.title)}</h3>
        <p>${esc(ep.description)}</p>
        ${playBtn(ep, 0, "btn--gold")}
      </div>`;
  }

  // ---- Episode grid
  function renderList(filter = "") {
    const q = filter.trim().toLowerCase();
    const list = $("#episode-list");
    const items = EPISODES.map((ep, i) => ({ ep, i })).filter(({ ep }) =>
      !q || `${ep.title} ${ep.description} ${ep.number}`.toLowerCase().includes(q)
    );
    list.innerHTML = items.map(({ ep, i }) => `
      <article class="card">
        <p class="eyebrow">${esc(meta(ep))}</p>
        <h3>${esc(ep.title)}</h3>
        <p>${esc(ep.description)}</p>
        ${playBtn(ep, i, "btn--aqua btn--sm")}
      </article>`).join("");
    $("#no-results").hidden = items.length > 0;
  }

  // ---- Links
  function renderLinks() {
    const link = (p, cls) =>
      `<a class="${cls}" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>`;
    $("#platforms").innerHTML = SITE.platforms.filter((p) => p.url).map((p) => link(p, "platform")).join("");
    $("#socials").innerHTML = SITE.socials.filter((p) => p.url).map((p) => link(p, "social")).join("");
    $("#contact-email").href = "mailto:" + SITE.email;
  }

  // ---- Player
  const player = $("#player");
  const audio = $("#audio");

  function play(i) {
    const ep = EPISODES[i];
    if (!ep || !ep.audio) return;
    $("#player-title").textContent = ep.title;
    $("#player-sub").textContent = meta(ep);
    if (audio.getAttribute("src") !== ep.audio) audio.src = ep.audio;
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
    if (e.target.tagName === "A") {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  // ---- Donate / Build the Studio
  function renderDonate() {
    const d = SITE.donate || {};
    const money = (n) => "$" + Number(n || 0).toLocaleString("en-US");
    if (d.goal > 0) {
      const pct = Math.max(0, Math.min(100, (d.raised / d.goal) * 100));
      $("#goal").hidden = false;
      $("#goal-raised").textContent = money(d.raised);
      $("#goal-target").textContent = money(d.goal);
      $("#goal-bar").setAttribute("aria-valuemax", "100");
      $("#goal-bar").setAttribute("aria-valuenow", String(Math.round(pct)));
      requestAnimationFrame(() => ($("#goal-fill").style.width = pct + "%"));
    }
    const links = (d.links || []).filter((l) => l.url);
    $("#donate-links").innerHTML = links.length
      ? links.map((l, i) => `<a class="btn ${i === 0 ? "btn--dark" : "btn--outline"}" href="${esc(l.url)}" target="_blank" rel="noopener">Donate via ${esc(l.name)}</a>`).join("")
      : `<a class="btn btn--dark" href="mailto:${esc(SITE.email)}?subject=${encodeURIComponent("Donating to the Lone Soulja Studio")}">Email to Donate</a>`;
    $("#builds").innerHTML = (d.builds || []).map((b) => `<li>${esc(b)}</li>`).join("");
    $("#sponsor-email").href = "mailto:" + SITE.email + "?subject=" + encodeURIComponent("Sponsoring the Lone Soulja Studio");
  }

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
    const urls = (SITE.clips || []).map(embedUrl).filter(Boolean);
    $("#clip-list").innerHTML = urls.length
      ? urls.map((u) => `<div class="clip"><iframe src="${esc(u)}" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; clipboard-write" allowfullscreen title="Lone Soulja clip"></iframe></div>`).join("")
      : ["TikTok", "Reels", "Shorts"].map((p) => `<div class="clip clip--empty"><div><strong>${p}</strong>Clips dropping soon</div></div>`).join("");
  }

  // ---- Newsletter -> Railway backend
  const API = String(SITE.apiUrl || "").replace(/\/+$/, "");
  $("#newsletter").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#email");
    const msg = $("#form-msg");
    const say = (t, ok) => { msg.textContent = t; msg.className = "form__msg " + (ok ? "ok" : "err"); };
    if (!email.checkValidity() || !email.value) return say("Please enter a valid email.", false);
    if (!API) return say("Sign-ups open soon!", false);
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      const r = await fetch(API + "/api/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.value })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return say(d.error || "Something went wrong. Try again.", false);
      say("You're locked in! 🇧🇸", true);
      e.target.reset();
    } catch (err) {
      say("Couldn't connect. Try again in a minute.", false);
    } finally { btn.disabled = false; }
  });

  // ---- Thought of the Day
  const quotes = (SITE.quotes || []).slice();
  let qi = quotes.length ? Math.floor(Math.random() * quotes.length) : -1;
  const showQuote = () => { if (qi >= 0) $("#quote-text").textContent = "“" + Brand.censor(quotes[qi]) + "”"; };
  if (qi < 0) $("#thoughts").hidden = true;
  $("#quote-next").addEventListener("click", () => {
    if (quotes.length < 2) return;
    let n; do { n = Math.floor(Math.random() * quotes.length); } while (n === qi);
    qi = n; showQuote();
  });
  showQuote();

  $("#quote-share").addEventListener("click", async () => {
    if (qi < 0) return;
    const c = document.createElement("canvas");
    await Brand.loadFonts();
    Brand.drawQuoteCard(c, {
      quote: quotes[qi], label: "Random Thought of the Day", author: "Geno “Smurf” Collie",
      tags: "#SavageButBlessed #ISaidWhatISaid #LoneSoulja", handle: SITE.handle || "",
      theme: "midnight", font: "bebas", format: "story", censor: true
    });
    await Brand.shareOrDownload(await Brand.toBlob(c), "lone-soulja-quote.png", Brand.censor(quotes[qi]));
  });

  $("#search").addEventListener("input", (e) => renderList(e.target.value));
  $("#year").textContent = new Date().getFullYear();

  renderLatest();
  renderList();
  renderLinks();
  renderClips();
  renderDonate();

  // ---- Live content from the admin portal (falls back to episodes.js if the API is down)
  if (API) {
    fetch(API + "/api/content").then((r) => (r.ok ? r.json() : {})).then((c) => {
      if (c.donate) { SITE.donate = { ...(SITE.donate || {}), goal: c.donate.goal, raised: c.donate.raised }; renderDonate(); }
      if (Array.isArray(c.quotes) && c.quotes.length) {
        quotes.splice(0, quotes.length, ...c.quotes);
        qi = Math.floor(Math.random() * quotes.length);
        $("#thoughts").hidden = false;
        showQuote();
      }
    }).catch(() => {});
  }
})();
