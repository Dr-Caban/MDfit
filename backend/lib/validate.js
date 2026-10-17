// Settings + episode validation. Every value saved through the admin portal passes through here.

const CATEGORIES = ["Comedy", "Society & Culture", "Religion & Spirituality", "Music", "News", "Business",
  "Arts", "Education", "Health & Fitness", "Leisure", "Sports", "True Crime", "TV & Film"];

const LINK_KEYS = ["spotify", "apple", "youtube", "amazon", "tiktok", "instagram", "facebook", "x"];
const CLIP_HOSTS = /^(www\.|m\.|vm\.)?(tiktok\.com|youtube\.com|youtu\.be|instagram\.com|facebook\.com|fb\.watch)$/;

function defaultSettings() {
  return {
    show: {
      title: "Lone Soulja",
      author: "Geno \"Smurf\" Collie",
      description: "Savage but blessed. Unfiltered talk straight out of The Bahamas with Geno \"Smurf\" Collie.",
      email: "", handle: "", category: "Comedy", explicit: true, language: "en", coverUrl: ""
    },
    links: Object.fromEntries(LINK_KEYS.map((k) => [k, ""])),
    donate: { goal: 0, raised: 0, venmoHandle: "", amounts: [1, 5, 10], paypal: "", stripe: "", gofundme: "" },
    quotes: [],
    clips: []
  };
}

class ValidationError extends Error {}
const fail = (msg) => { throw new ValidationError(msg); };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function str(v, field, { max = 200, min = 0 } = {}) {
  if (typeof v !== "string") fail(`${field} must be text.`);
  const s = v.trim();
  if (s.length < min) fail(`${field} is required.`);
  if (s.length > max) fail(`${field} is too long (max ${max} characters).`);
  return s;
}

function url(v, field, { allowHttp = false, empty = true } = {}) {
  const s = str(v, field, { max: 600 });
  if (!s) { if (empty) return ""; fail(`${field} is required.`); }
  let u;
  try { u = new URL(s); } catch { fail(`${field} must be a full link starting with https://`); }
  if (!(u.protocol === "https:" || (allowHttp && u.protocol === "http:"))) fail(`${field} must start with https://`);
  return u.toString();
}

function num(v, field, { min = 0, max = 1e9 } = {}) {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) fail(`${field} must be a number from ${min} to ${max}.`);
  return n;
}

function bool(v, field) {
  if (typeof v !== "boolean") fail(`${field} must be true or false.`);
  return v;
}

function obj(v, field) {
  if (!v || typeof v !== "object" || Array.isArray(v)) fail(`${field} must be an object.`);
  return v;
}

// Partial update: only the fields sent are changed. Returns the merged settings.
function mergeSettings(current, body) {
  obj(body, "Settings");
  const known = ["show", "links", "donate", "quotes", "clips"];
  const unknown = Object.keys(body).filter((k) => !known.includes(k));
  if (unknown.length) fail(`Unknown setting: ${unknown[0]}`);
  if (!Object.keys(body).length) fail("Nothing to update.");
  const s = JSON.parse(JSON.stringify(current));

  if (body.show !== undefined) {
    const b = obj(body.show, "show");
    if (b.title !== undefined) s.show.title = str(b.title, "Show title", { min: 1, max: 120 });
    if (b.author !== undefined) s.show.author = str(b.author, "Host name", { min: 1, max: 120 });
    if (b.description !== undefined) s.show.description = str(b.description, "Show description", { min: 1, max: 4000 });
    if (b.email !== undefined) {
      const e = str(b.email, "Contact email", { max: 254 }).toLowerCase();
      if (e && !EMAIL_RE.test(e)) fail("Contact email is not valid.");
      s.show.email = e;
    }
    if (b.handle !== undefined) {
      const h = str(b.handle, "Social handle", { max: 31 }).replace(/^@/, "");
      if (h && !/^[A-Za-z0-9._]{1,30}$/.test(h)) fail("Social handle can only use letters, numbers, dots and underscores.");
      s.show.handle = h ? "@" + h : "";
    }
    if (b.category !== undefined) {
      if (!CATEGORIES.includes(b.category)) fail("Pick a category from the list.");
      s.show.category = b.category;
    }
    if (b.explicit !== undefined) s.show.explicit = bool(b.explicit, "Explicit");
    if (b.coverUrl !== undefined) s.show.coverUrl = url(b.coverUrl, "Cover art link");
  }

  if (body.links !== undefined) {
    const b = obj(body.links, "links");
    for (const k of Object.keys(b)) {
      if (!LINK_KEYS.includes(k)) fail(`Unknown link: ${k}`);
      s.links[k] = url(b[k], `${k} link`);
    }
  }

  if (body.donate !== undefined) {
    const b = obj(body.donate, "donate");
    if (b.goal !== undefined) s.donate.goal = Math.round(num(b.goal, "Goal"));
    if (b.raised !== undefined) s.donate.raised = Math.round(num(b.raised, "Raised"));
    if (b.venmoHandle !== undefined) {
      const t = str(b.venmoHandle, "Venmo handle", { max: 31 }).replace(/^@/, "");
      if (t && !/^[A-Za-z0-9._-]{5,30}$/.test(t)) fail("Venmo handle must be 5-30 characters: letters, numbers, dots, underscores, hyphens.");
      s.donate.venmoHandle = t;
    }
    if (b.amounts !== undefined) {
      if (!Array.isArray(b.amounts) || b.amounts.length < 1 || b.amounts.length > 6) fail("Quick amounts: between 1 and 6 amounts.");
      // Venmo: no fixed minimum, allow /bin/bash.01+
      s.donate.amounts = b.amounts.map((a) => Math.round(num(a, "Quick amount", { min: 0.01, max: 10000 }) * 100) / 100);
    }
    for (const k of ["paypal", "stripe", "gofundme"]) if (b[k] !== undefined) s.donate[k] = url(b[k], `${k} link`);
  }

  if (body.quotes !== undefined) {
    if (!Array.isArray(body.quotes)) fail("Quotes must be a list.");
    const q = body.quotes.map((x) => String(x).trim()).filter(Boolean);
    if (q.length > 200 || q.some((x) => x.length > 600)) fail("Max 200 quotes, 600 characters each.");
    s.quotes = q;
  }

  if (body.clips !== undefined) {
    if (!Array.isArray(body.clips)) fail("Clips must be a list.");
    const c = body.clips.map((x) => String(x).trim()).filter(Boolean);
    if (c.length > 30) fail("Max 30 clips.");
    s.clips = c.map((x, i) => {
      const u = url(x, `Clip ${i + 1}`);
      if (!CLIP_HOSTS.test(new URL(u).hostname)) fail(`Clip ${i + 1} must be a TikTok, YouTube, Instagram or Facebook link.`);
      return u;
    });
  }
  return s;
}

// "1:02:03", "42:10", "2530" -> seconds
function duration(v) {
  if (v === undefined || v === null || v === "") return 0;
  const s = String(v).trim();
  if (/^\d+$/.test(s)) return num(s, "Duration", { max: 86400 });
  const m = s.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/);
  if (!m || Number(m[3]) > 59 || (m[1] && Number(m[2]) > 59)) fail("Duration must look like 45:30 or 1:02:03.");
  return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

const PLATFORMS = ["website", "podcast", "facebook"];

function episodeInput(b, { allowHttp = false, partial = false } = {}) {
  obj(b, "Episode");
  const e = {};
  const has = (k) => b[k] !== undefined;
  if (!partial || has("title")) e.title = str(b.title ?? "", "Title", { min: 1, max: 200 });
  if (!partial || has("description")) e.description = str(b.description ?? "", "Description", { min: 1, max: 4000 });
  if (!partial || has("audioUrl")) e.audioUrl = url(b.audioUrl ?? "", "Audio link", { allowHttp, empty: false });
  if (has("imageUrl")) e.imageUrl = url(b.imageUrl, "Episode image link", { allowHttp });
  if (has("duration")) e.duration = duration(b.duration);
  if (has("explicit")) e.explicit = bool(b.explicit, "Explicit");
  if (has("number") && b.number !== "" && b.number !== null) e.number = num(b.number, "Episode number", { min: 1, max: 100000 });
  if (has("season") && b.season !== "" && b.season !== null) e.season = num(b.season, "Season", { min: 1, max: 1000 });
  if (!partial || has("platforms")) {
    const p = b.platforms ?? [];
    if (!Array.isArray(p) || p.some((x) => !PLATFORMS.includes(x))) fail("Unknown platform.");
    if (!p.includes("website") && !p.includes("podcast")) fail("Pick the website, podcast apps, or both.");
    e.platforms = [...new Set(p)];
  }
  if (has("facebookMessage")) e.facebookMessage = str(b.facebookMessage, "Facebook message", { max: 5000 });
  return e;
}

module.exports = { defaultSettings, mergeSettings, episodeInput, duration, ValidationError, CATEGORIES, LINK_KEYS, PLATFORMS, EMAIL_RE };
