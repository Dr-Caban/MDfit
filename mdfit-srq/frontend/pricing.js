// MD Fit pricing math + homepage pricing section. window.MDFitPricing
(function () {
  "use strict";
  const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
  const money2 = (n) => "$" + (Math.round(n * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // Every plan option for `sessions` one-hour visits of `svc`.
  function quote(svc, sessions, p) {
    const base = svc.rate * sessions;
    const gold = base * (1 - p.gold / 100);
    const silver = base * (1 - p.silver / 100);
    const e12 = base * (1 + p.ext12 / 100), e24 = base * (1 + p.ext24 / 100);
    return {
      base, sessions,
      guarantee: sessions >= p.guaranteeMin,
      credit: (amt) => amt * (p.participation.creditPct / 100),
      options: [
        { id: "gold", name: "Gold", tag: `Save ${p.gold}%`, total: gold, pay: money(gold), per: "paid in full upfront", save: base - gold },
        { id: "silver", name: "Silver", tag: `Save ${p.silver}%`, total: silver, pay: `${p.silverPayments} × ${money2(silver / p.silverPayments)}`, per: `monthly payments · ${money(silver)} total`, save: base - silver },
        { id: "payg", name: "Pay as you go", tag: "No commitment", total: base, pay: money(svc.rate), per: `per visit · ${money(base)} total`, save: 0 },
        { id: "ext12", name: "12-month plan", tag: `+${p.ext12}%`, total: e12, pay: `${money2(e12 / 12)}/mo`, per: `12 payments · ${money(e12)} total`, save: base - e12 },
        { id: "ext24", name: "24-month plan", tag: `+${p.ext24}%`, total: e24, pay: `${money2(e24 / 24)}/mo`, per: `24 payments · ${money(e24)} total`, save: base - e24 }
      ]
    };
  }

  function mount(root, settings) {
    const services = settings.services || [], p = settings.plans;
    if (!root || !services.length || !p) return;
    const proto = services.filter((s) => s.protocol);
    const state = { svc: (proto[0] || services[0]).id, n: p.packageSizes.includes(12) ? 12 : p.packageSizes[0] };
    const minMonthly = Math.min(...proto.map((s) => s.rate * Math.min(...p.packageSizes) * (1 + p.ext24 / 100) / 24));

    root.innerHTML = `
      <div class="rates">${services.map((s) => `
        <article class="rate-card">
          <h3>${esc(s.name)}</h3>
          <div><span class="price">${money(s.rate)}</span> <span class="unit">/ ${esc(s.unit || "hour")}</span></div>
          <p>${esc(s.description)}</p>
          ${s.protocol ? `<span class="rate-tag">Available as a protocol plan</span>` : `<span class="rate-tag first">Where every plan starts</span>`}
        </article>`).join("")}
      </div>

      <div class="ext-banner" role="note">
        <div>
          <p class="ext-kicker">Extended payment plans</p>
          <p class="ext-big">Start your protocol today from <strong>${money2(minMonthly)}/mo</strong></p>
          <p class="ext-small">Spread any protocol over <b>12 months for just +${p.ext12}%</b> or <b>24 months for +${p.ext24}%</b>. Paid directly to MD Fit, no outside financing.</p>
        </div>
        <a href="#calc" class="btn">Build my plan</a>
      </div>

      <div class="calc" id="calc">
        <div class="calc-head">
          <h3>Protocol plan calculator</h3>
          <p class="muted">Pick the service and how many visits Dr. Jared recommends. Every price updates live.</p>
        </div>
        <div class="calc-controls">
          <div class="chips" role="radiogroup" aria-label="Service" data-k="svc">${proto.map((s) => `<button type="button" role="radio" data-v="${esc(s.id)}">${esc(s.name)}</button>`).join("")}</div>
          <div class="chips" role="radiogroup" aria-label="Number of visits" data-k="n">${p.packageSizes.map((n) => `<button type="button" role="radio" data-v="${n}">${n} visits</button>`).join("")}</div>
        </div>
        <div class="calc-out" aria-live="polite"></div>
      </div>

      <div class="price-extras">
        <article class="guarantee">
          <div class="seal" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 3l5 4 6-1 2 6 6 3-2 6 2 6-6 3-2 6-6-1-5 4-5-4-6 1-2-6-6-3 2-6-2-6 6-3 2-6 6 1z"/><path d="M16 24l6 6 11-12" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <div>
            <h3>Money-back guarantee</h3>
            <p>On every plan of <strong>${p.guaranteeMin} or more visits</strong>. If all three are true, ask for a full refund, no questions asked:</p>
            <ol>
              <li>You followed the entire protocol to your provider's satisfaction.</li>
              <li>You completed every visit in the protocol.</li>
              <li>You did not see a significant change in your pain.</li>
            </ol>
          </div>
        </article>
        <article class="credit">
          <h3>Show up, get paid back</h3>
          <p>Your <strong>participation score</strong> is half visits attended (goal ${p.participation.attendPct}%) and half home workouts logged in the MD Fit app (goal ${p.participation.homePerWeek} a week).</p>
          <ul class="credit-tiers"><li><b>Score 100</b> <span>${p.participation.creditPct}% of what you paid comes back</span></li><li><b>Score 80+</b> <span>${p.participation.creditPct / 2}% comes back</span></li></ul>
          <p class="muted">Credit goes toward your next protocol, massage or membership. Watch your score live in the app's Progress tab.</p>
        </article>
      </div>`;

    const draw = () => {
      $$(".chips", root).forEach((g) => $$("button", g).forEach((b) => { const on = String(state[g.dataset.k]) === b.dataset.v; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); }));
      const svc = services.find((s) => s.id === state.svc), q = quote(svc, state.n, p);
      $(".calc-out", root).innerHTML = `
        <div class="opts">${q.options.map((o) => `
          <div class="opt opt-${o.id}">
            <span class="opt-tag">${esc(o.tag)}</span>
            <h4>${esc(o.name)}</h4>
            <p class="opt-pay">${esc(o.pay)}</p>
            <p class="opt-per">${esc(o.per)}</p>
            ${o.save > 0 ? `<p class="opt-save">You save ${money(o.save)}</p>` : ""}
            ${q.guarantee ? `<p class="opt-g">✓ Money-back guarantee</p>` : ""}
            <p class="opt-credit">Earn up to ${money(q.credit(o.total))} back</p>
          </div>`).join("")}
        </div>
        <p class="calc-note">${state.n} × ${money(svc.rate)} ${esc(svc.name)} visits = ${money(q.base)} at the standard rate.${q.guarantee ? "" : ` Choose ${p.guaranteeMin}+ visits to add the money-back guarantee.`} Your evaluation (${money((services.find((s) => !s.protocol) || svc).rate)}) is booked first and is not part of the protocol price.</p>`;
    };
    root.addEventListener("click", (e) => {
      const b = e.target.closest(".chips button"); if (!b) return;
      const k = b.parentElement.dataset.k; state[k] = k === "n" ? Number(b.dataset.v) : b.dataset.v; draw();
    });
    draw();
  }
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  window.MDFitPricing = { quote, mount, money };
})();
