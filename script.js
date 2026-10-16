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

  // ---- Newsletter (front-end only; connect to Mailchimp/ConvertKit/Formspree later)
  $("#newsletter").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = $("#email");
    const msg = $("#form-msg");
    if (!email.checkValidity() || !email.value) {
      msg.textContent = "Please enter a valid email.";
      msg.className = "form__msg err";
      return;
    }
    msg.textContent = "You're locked in! 🇧🇸";
    msg.className = "form__msg ok";
    e.target.reset();
  });

  $("#search").addEventListener("input", (e) => renderList(e.target.value));
  $("#year").textContent = new Date().getFullYear();

  renderLatest();
  renderList();
  renderLinks();
})();
