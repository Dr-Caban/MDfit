// Input validation for every public form and admin edit.

class ValidationError extends Error {}
const fail = (msg) => { throw new ValidationError(msg); };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GOALS = ["Lose weight", "Build muscle", "Get stronger", "Improve conditioning", "Sport performance", "General health", "Other"];
const SERVICES = ["Personal training", "Small group training", "Nutrition coaching", "Online coaching", "Not sure yet"];
const LEAD_STATUSES = ["new", "contacted", "booked", "client", "closed"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function defaultSettings() {
  return {
    business: {
      name: "MDFIT SRQ",
      tagline: "Personal training & coaching in Sarasota, FL",
      phone: "", email: "", address: "Sarasota, FL", hours: "",
      instagram: "", facebook: "", tiktok: "", bookingNote: ""
    },
    coach: { name: "", title: "Head Coach", bio: "", photoUrl: "" },
    packages: [
      { name: "1-on-1 Training", price: "", unit: "per session", features: ["Custom program", "Form coaching", "Progress tracking"] },
      { name: "Small Group", price: "", unit: "per month", features: ["2-6 people", "Coached classes", "Community accountability"] },
      { name: "Online Coaching", price: "", unit: "per month", features: ["App-based program", "Weekly check-ins", "Nutrition guidance"] }
    ],
    testimonials: []
  };
}

function str(v, field, { max = 200, min = 0 } = {}) {
  if (v === undefined || v === null) v = "";
  if (typeof v !== "string") fail(`${field} must be text.`);
  const s = v.trim();
  if (s.length < min) fail(`${field} is required.`);
  if (s.length > max) fail(`${field} is too long (max ${max} characters).`);
  return s;
}

function email(v, field = "Email", { required = true } = {}) {
  const e = str(v, field, { max: 254, min: required ? 1 : 0 }).toLowerCase();
  if (e && !EMAIL_RE.test(e)) fail(`${field} is not valid.`);
  return e;
}

function phone(v) {
  const p = str(v, "Phone", { max: 30 });
  if (p && !/^[0-9()+\-.\s]{7,30}$/.test(p)) fail("Phone number is not valid.");
  return p;
}

function url(v, field) {
  const s = str(v, field, { max: 600 });
  if (!s) return "";
  let u;
  try { u = new URL(s); } catch { fail(`${field} must be a full link starting with https://`); }
  if (u.protocol !== "https:") fail(`${field} must start with https://`);
  return u.toString();
}

function int(v, field, { min = 0, max = 1e6 } = {}) {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) fail(`${field} must be a whole number from ${min} to ${max}.`);
  return n;
}

function oneOf(v, list, field) {
  if (!list.includes(v)) fail(`Pick a ${field} from the list.`);
  return v;
}

function obj(v, field) {
  if (!v || typeof v !== "object" || Array.isArray(v)) fail(`${field} must be an object.`);
  return v;
}

// Free consultation request from the website
function leadInput(b) {
  obj(b, "Request");
  return {
    name: str(b.name, "Name", { min: 2, max: 100 }),
    email: email(b.email),
    phone: phone(b.phone),
    service: b.service ? oneOf(b.service, SERVICES, "service") : "Not sure yet",
    goal: b.goal ? oneOf(b.goal, GOALS, "goal") : "Other",
    preferredTime: str(b.preferredTime, "Preferred time", { max: 100 }),
    message: str(b.message, "Message", { max: 2000 })
  };
}

function bookingInput(b) {
  obj(b, "Booking");
  const date = str(b.date, "Date", { min: 1, max: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + "T00:00:00Z"))) fail("Date must look like 2026-11-02.");
  return {
    classId: str(b.classId, "Class", { min: 1, max: 40 }),
    date,
    name: str(b.name, "Name", { min: 2, max: 100 }),
    email: email(b.email),
    phone: phone(b.phone)
  };
}

function classInput(b, { partial = false } = {}) {
  obj(b, "Class");
  const c = {};
  const has = (k) => b[k] !== undefined;
  if (!partial || has("title")) c.title = str(b.title, "Class name", { min: 1, max: 80 });
  if (!partial || has("day")) c.day = int(b.day, "Day", { min: 0, max: 6 });
  if (!partial || has("time")) {
    const t = str(b.time, "Start time", { min: 1, max: 5 });
    const m = t.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!m) fail("Start time must be 24-hour like 06:00 or 17:30.");
    c.time = t;
  }
  if (!partial || has("durationMin")) c.durationMin = int(b.durationMin ?? 60, "Length (minutes)", { min: 15, max: 240 });
  if (!partial || has("capacity")) c.capacity = int(b.capacity ?? 10, "Capacity", { min: 1, max: 100 });
  if (!partial || has("coach")) c.coach = str(b.coach, "Coach", { max: 80 });
  if (!partial || has("location")) c.location = str(b.location, "Location", { max: 120 });
  if (!partial || has("description")) c.description = str(b.description, "Description", { max: 500 });
  if (has("active")) { if (typeof b.active !== "boolean") fail("Active must be true or false."); c.active = b.active; }
  if (partial && !Object.keys(c).length) fail("Nothing to update.");
  return c;
}

// Partial settings update: only the sections/fields sent are changed.
function mergeSettings(current, body) {
  obj(body, "Settings");
  const known = ["business", "coach", "packages", "testimonials"];
  const unknown = Object.keys(body).filter((k) => !known.includes(k));
  if (unknown.length) fail(`Unknown setting: ${unknown[0]}`);
  if (!Object.keys(body).length) fail("Nothing to update.");
  const s = JSON.parse(JSON.stringify(current));

  if (body.business !== undefined) {
    const b = obj(body.business, "business");
    const text = { name: 60, tagline: 160, address: 200, hours: 300, bookingNote: 300 };
    for (const [k, max] of Object.entries(text)) if (b[k] !== undefined) s.business[k] = str(b[k], k, { max, min: k === "name" ? 1 : 0 });
    if (b.phone !== undefined) s.business.phone = phone(b.phone);
    if (b.email !== undefined) s.business.email = email(b.email, "Contact email", { required: false });
    for (const k of ["instagram", "facebook", "tiktok"]) if (b[k] !== undefined) s.business[k] = url(b[k], `${k} link`);
  }

  if (body.coach !== undefined) {
    const b = obj(body.coach, "coach");
    if (b.name !== undefined) s.coach.name = str(b.name, "Coach name", { max: 80 });
    if (b.title !== undefined) s.coach.title = str(b.title, "Coach title", { max: 80 });
    if (b.bio !== undefined) s.coach.bio = str(b.bio, "Coach bio", { max: 3000 });
    if (b.photoUrl !== undefined) s.coach.photoUrl = url(b.photoUrl, "Coach photo link");
  }

  if (body.packages !== undefined) {
    if (!Array.isArray(body.packages) || body.packages.length > 6) fail("Packages: up to 6.");
    s.packages = body.packages.map((p, i) => {
      obj(p, `Package ${i + 1}`);
      const features = Array.isArray(p.features) ? p.features.map((f) => str(f, "Feature", { max: 80 })).filter(Boolean) : [];
      if (features.length > 8) fail(`Package ${i + 1}: up to 8 features.`);
      return {
        name: str(p.name, `Package ${i + 1} name`, { min: 1, max: 60 }),
        price: str(p.price, `Package ${i + 1} price`, { max: 20 }),
        unit: str(p.unit, `Package ${i + 1} unit`, { max: 30 }),
        features
      };
    });
  }

  if (body.testimonials !== undefined) {
    if (!Array.isArray(body.testimonials) || body.testimonials.length > 20) fail("Testimonials: up to 20.");
    s.testimonials = body.testimonials.map((t, i) => {
      obj(t, `Testimonial ${i + 1}`);
      return { name: str(t.name, `Testimonial ${i + 1} name`, { min: 1, max: 60 }), quote: str(t.quote, `Testimonial ${i + 1} quote`, { min: 1, max: 600 }) };
    });
  }
  return s;
}

module.exports = {
  ValidationError, EMAIL_RE, GOALS, SERVICES, LEAD_STATUSES, DAYS,
  defaultSettings, leadInput, bookingInput, classInput, mergeSettings
};
