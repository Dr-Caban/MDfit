"use strict";

const KEEP_DAYS = 90;

function mountAnalytics({ app, admin, store, limiter }) {
  const hit = limiter(60, 60 * 1000);
  const today = () => new Date().toISOString().slice(0, 10);

  function data() {
    const d = store.read("analytics", { days: {}, pages: {}, referrers: {} });
    if (!d.days) d.days = {};
    if (!d.pages) d.pages = {};
    if (!d.referrers) d.referrers = {};
    return d;
  }
  function save(d) {
    const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString().slice(0, 10);
    for (const k of Object.keys(d.days)) { if (k < cutoff) delete d.days[k]; }
    store.write("analytics", d);
  }

  app.post("/api/hit", hit.mw, (req, res) => {
    const b = req.body || {};
    const page = String(b.page || "/").slice(0, 200).replace(/[?#].*/, "");
    const ref = String(b.referrer || "").slice(0, 200);
    const day = today();
    const d = data();

    if (!d.days[day]) d.days[day] = { views: 0, visitors: new Set() };
    const dd = d.days[day];
    if (dd.visitors instanceof Set) {
      // noop
    } else if (Array.isArray(dd._visitors)) {
      dd.visitors = new Set(dd._visitors);
    } else {
      dd.visitors = new Set();
    }

    dd.views++;
    const ip = (req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
    const vid = ip ? require("crypto").createHash("sha256").update(ip + day).digest("hex").slice(0, 12) : "";
    if (vid) dd.visitors.add(vid);

    dd._visitors = [...dd.visitors];
    dd.unique = dd.visitors.size;
    delete dd.visitors;

    d.pages[page] = (d.pages[page] || 0) + 1;

    if (ref && !ref.includes("mymdfit.com") && !ref.includes("mdfitsrq")) {
      const host = ref.replace(/https?:\/\//, "").split("/")[0];
      if (host) d.referrers[host] = (d.referrers[host] || 0) + 1;
    }

    save(d);
    res.json({ ok: true });
  });

  admin.get("/analytics", (req, res) => {
    const d = data();
    const days = Object.entries(d.days)
      .map(([date, v]) => ({ date, views: v.views || 0, unique: v.unique || (v._visitors || []).length || 0 }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);

    const pages = Object.entries(d.pages)
      .map(([page, views]) => ({ page, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 30);

    const referrers = Object.entries(d.referrers)
      .map(([source, views]) => ({ source, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 20);

    const totalViews = days.reduce((s, d) => s + d.views, 0);
    const totalUnique = days.reduce((s, d) => s + d.unique, 0);
    const todayData = d.days[today()];

    res.json({
      summary: {
        totalViews,
        totalUnique,
        todayViews: todayData ? todayData.views || 0 : 0,
        todayUnique: todayData ? todayData.unique || (todayData._visitors || []).length || 0 : 0
      },
      days,
      pages,
      referrers
    });
  });
}

module.exports = { mountAnalytics };
