// Member content: premade programs, lectures, monthly live Q&A, membership tiers with 1-on-1 meetings, health recommendations.
// Everything is admin-editable; links to members-only content are only sent to members.
"use strict";
const crypto = require("crypto");
const { ValidationError } = require("./validate");

const fail = (msg) => { throw new ValidationError(msg); };
const str = (v, label, { min = 0, max = 200 } = {}) => {
  if (v === undefined || v === null) v = "";
  if (typeof v !== "string") fail(`${label} must be text.`);
  const s = v.trim();
  if (s.length < min) fail(min === 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`);
  if (s.length > max) fail(`${label} is too long (max ${max} characters).`);
  return s;
};
const int = (v, label, { min, max }) => { const n = Number(v); if (!Number.isInteger(n) || n < min || n > max) fail(`${label} must be a whole number from ${min} to ${max}.`); return n; };
const url = (v, label) => { const s = str(v, label, { max: 500 }); if (s && !/^https:\/\/[^\s]+$/i.test(s)) fail(`${label} must be an https:// link.`); return s; };
const slug = (v, label) => { const s = str(v, label, { min: 1, max: 40 }); if (!/^[a-z0-9-]+$/.test(s)) fail(`${label} "${s}": lowercase letters, numbers and dashes only.`); return s; };
const oneOf = (v, list, label) => { if (!list.includes(v)) fail(`${label} must be one of: ${list.join(", ")}.`); return v; };
const list = (v, label, max, fn) => { if (!Array.isArray(v) || v.length > max) fail(`${label}: up to ${max}.`); const out = v.map(fn); const ids = out.map((x) => x.id).filter(Boolean); if (new Set(ids).size !== ids.length) fail(`${label}: ids must be unique.`); return out; };

const GOALS = ["upper", "lower", "full", "core", "mobility"];
const LOCS = ["home", "gym", "outdoor", "office"];
const LEVELS = ["beginner", "intermediate", "advanced", "elite"];
const PROGRAM_CATS = ["Hypertrophy", "Strength", "Anti-inflammatory", "Weight loss", "Mobility", "Rehabilitation", "Desk & posture", "Performance", "Sport Performance"];
const LECTURE_TOPICS = ["Health", "Wellness", "Hormones", "Inflammation", "Pain science", "Nutrition", "Sleep & recovery"];
const ACCESS = ["free", "member", "premium"];

const day = (name, goal, length, extra = {}) => ({ name, goal, length, ...extra });
function defaultContent() {
  return {
    programs: [
      // ----- Dr. Jared's programs. Covered on the homepage and in the client app's Programs tab.
      { id: "hypertrophy-12", title: "12-Week Hypertrophy", category: "Hypertrophy", level: "intermediate", location: "gym", weeks: 12, seed: 1001, access: "member",
        summary: "Build muscle with an upper/lower split, 4 days a week for 12 weeks. The same four sessions each week so you can watch your weights climb.",
        notes: "Add weight when every round feels like 2 reps left in the tank. Protein with every meal, 7-9 hours of sleep.",
        image: "assets/programs/hypertrophy.webp",
        days: [day("Upper A", "upper", 45, { rounds: 4, restEx: 30, restRound: 90 }), day("Lower A", "lower", 45, { rounds: 4, restEx: 30, restRound: 90 }), day("Upper B", "upper", 45, { rounds: 4, restEx: 30, restRound: 90 }), day("Lower B", "lower", 45, { rounds: 4, restEx: 30, restRound: 90 })] },
      { id: "dream-lean-12", title: "12-Week Dream Lean", category: "Weight loss", level: "intermediate", location: "home", weeks: 12, seed: 1002, access: "member",
        summary: "Full-body circuits with short rests to drop body fat and keep every ounce of muscle. 3 strength circuits plus mobility, every week for 12 weeks.",
        notes: "Pair with a daily step goal and protein at every meal. Rest days are walking days (20-30 min).",
        image: "assets/programs/dream-lean.webp",
        days: [day("Full-body circuit A", "full", 30, { rounds: 4, restEx: 15, restRound: 45 }), day("Lower circuit", "lower", 30, { rounds: 4, restEx: 15, restRound: 45 }), day("Upper circuit", "upper", 30, { rounds: 4, restEx: 15, restRound: 45 }), day("Mobility & core", "mobility", 20)] },
      { id: "shoulder-6", title: "6-Week Shoulder Program", category: "Rehabilitation", level: "beginner", location: "home", weeks: 6, seed: 1003, access: "member",
        summary: "A protocol for cranky shoulders: rotator-cuff control, scapular mobility and graded loading. 3 sessions a week for 6 weeks.",
        notes: "Pair with your shoulder pain track. Stop and book a visit if you get numbness or tingling down the arm.",
        image: "assets/programs/shoulder.webp",
        days: [day("Cuff & posture", "upper", 20, { rounds: 2, restEx: 20, restRound: 60 }), day("Scapular control", "upper", 20, { rounds: 2, restEx: 20, restRound: 60 }), day("Mobility flow", "mobility", 15)] },
      { id: "hip-6", title: "6-Week Hip Program", category: "Rehabilitation", level: "beginner", location: "home", weeks: 6, seed: 1004, access: "member",
        summary: "Hip range, glute activation and core control. 3 sessions a week for 6 weeks to clear up stiff hips, lateral hip pain and low-back aches that start at the hip.",
        notes: "Walk 20-30 min a day. Stop and book a visit if pain shoots down the leg past the knee.",
        image: "assets/programs/hip.webp",
        days: [day("Hip mobility & glutes", "lower", 25, { rounds: 2, restEx: 20, restRound: 60 }), day("Core & spine", "core", 20, { rounds: 2 }), day("Lower-body strength", "lower", 25, { rounds: 3, restEx: 30, restRound: 60 })] },
      { id: "low-back-6", title: "6-Week Low Back Mobility", category: "Mobility", level: "beginner", location: "home", weeks: 6, seed: 1005, access: "member",
        summary: "Core control, hip mobility and graded loading for a cranky low back. Three short sessions a week; keep every effort at 5/10 or less.",
        notes: "Pair with the low back pain track. Walk after meals. Stop and call us if pain spreads down the leg.",
        image: "assets/programs/low-back.webp",
        days: [day("Core control", "core", 20, { rounds: 2, restEx: 20 }), day("Hips & glutes", "lower", 20, { rounds: 2, restEx: 20 }), day("Mobility & breath", "mobility", 15)] },
      { id: "mobility-ladder", title: "5-Round Mobility Ladder", category: "Mobility", level: "intermediate", location: "home", weeks: 5, seed: 1006, access: "member",
        summary: "Dr. Jared's 5-round progression. Same six movements each round; rounds grow from 1 to 25 reps as you take the assistance away.",
        notes: "Each week, add 5 reps per movement and drop one layer of assistance (e.g., deeper on the Cossack, less wall help on the burpee). Stop any round that gets ugly; form before reps.",
        image: "assets/programs/mobility-ladder.webp",
        days: [day("Mobility Ladder", "full", 30, {
          rounds: 5, restEx: 15, restRound: 60,
          circuit: [
            { ex: "TRX Squat", sets: "5 reps · deeper each week" },
            { ex: "Cossack Squat", sets: "5 reps / side" },
            { ex: "Burpee", sets: "5 reps" },
            { ex: "Pistol Squat", sets: "5 reps / side (assisted)" },
            { ex: "Bear Crawl", sets: "20 ft / 6 m" },
            { ex: "Wall Burpee", sets: "5 reps (wall climb substitute)" }
          ]
        })] },
      { id: "anti-inflammatory", title: "Anti-Inflammatory Reset", category: "Anti-inflammatory", level: "beginner", location: "home", weeks: 4, seed: 1007, access: "member",
        summary: "Gentle full-body strength, mobility and daily walking to calm things down without flaring them up. 3 sessions a week for 4 weeks.",
        notes: "Walk 20-30 min a day at a pace you can still talk at. Keep every session at an effort of 5/10 or less. Omega-3s, protein, 7-9 hours of sleep.",
        image: "assets/programs/anti-inflammatory.webp",
        days: [day("Strength & breath", "full", 30, { rounds: 2, restEx: 20, restRound: 60 }), day("Mobility flow", "mobility", 20), day("Core & spine", "core", 20, { rounds: 2 })] },
      { id: "golf", title: "Golf Performance", category: "Sport Performance", level: "intermediate", location: "home", weeks: 4, seed: 1008, access: "member",
        summary: "Rotational power, hip mobility and anti-rotation core for a longer, more consistent swing. 2 sessions a week for 4 weeks.",
        notes: "Do this twice a week on non-golf days. Warm up before every round with the day's mobility flow.",
        image: "assets/programs/golf.webp",
        days: [day("Rotational power & core", "core", 30, { rounds: 3, restEx: 20, restRound: 60 }), day("Hip & T-spine mobility", "mobility", 20)] },
      { id: "tennis", title: "Tennis Performance", category: "Sport Performance", level: "intermediate", location: "home", weeks: 4, seed: 1009, access: "member",
        summary: "Lateral agility, shoulder stability and single-leg strength for the court. 2 sessions a week for 4 weeks.",
        notes: "Do this twice a week on non-match days. Warm up before every match with the mobility flow.",
        image: "assets/programs/tennis.webp",
        days: [day("Lateral agility & cuff", "upper", 30, { rounds: 3, restEx: 20, restRound: 60 }), day("Single-leg & core", "lower", 25, { rounds: 3, restEx: 20, restRound: 60 })] },
      { id: "running", title: "Running Performance", category: "Sport Performance", level: "intermediate", location: "home", weeks: 6, seed: 1010, access: "member",
        summary: "Hip strength, calf and foot work, and single-leg stability to run faster with fewer injuries. 3 sessions a week to pair with your runs.",
        notes: "These are the strength and mobility days: do them on your easy-run days or on rest days. Your long run is your long run.",
        image: "assets/programs/running.webp",
        days: [day("Hip & glute strength", "lower", 30, { rounds: 3, restEx: 20, restRound: 60 }), day("Calf, foot & ankle", "lower", 20, { rounds: 2 }), day("Mobility & core", "mobility", 20)] },
      { id: "marathon", title: "Marathon Prep", category: "Sport Performance", level: "advanced", location: "home", weeks: 12, seed: 1011, access: "member",
        summary: "A 12-week strength-and-mobility block to carry you through marathon training without breaking down. 4 sessions a week built around your run calendar.",
        notes: "Pair with your running plan. Deload every 4 weeks: cut rounds in half the week before a long effort.",
        image: "assets/programs/marathon.webp",
        days: [day("Hip & glute strength", "lower", 30, { rounds: 3, restEx: 20, restRound: 60 }), day("Core & spine", "core", 25, { rounds: 3 }), day("Calf, foot & ankle", "lower", 20, { rounds: 2 }), day("Mobility & recovery", "mobility", 25)] }
    ],

    lectures: [
      { id: "inflammation-101", title: "Inflammation: friend and foe", topic: "Inflammation", minutes: 0, url: "", downloadUrl: "", access: "member", summary: "What inflammation is for, why it lingers, and the daily habits that calm it." },
      { id: "hormones-training", title: "Hormones and training", topic: "Hormones", minutes: 0, url: "", downloadUrl: "", access: "member", summary: "How sleep, stress and training shape your hormones, and what you can control." },
      { id: "pain-science", title: "Why it still hurts: referred pain explained", topic: "Pain science", minutes: 0, url: "", downloadUrl: "", access: "free", summary: "Why the pain you feel is often far from the muscle causing it." },
      { id: "wellness-basics", title: "The five wellness basics", topic: "Wellness", minutes: 0, url: "", downloadUrl: "", access: "free", summary: "Sleep, movement, food, stress and connection: where to start." }
    ],
    live: { title: "Monthly live Q&A with Dr. Jared", date: "", time: "18:00", minutes: 60, joinUrl: "", access: "member",
      notes: "Bring your questions: pain, programs, what to do next. Camera on or off, your choice. Please don't share private medical details in the group session.", recordings: [] },
    tiers: [
      { id: "member", name: "MD Fit Member", price: 29, meetings: 0, meetingMinutes: 0, perks: ["Every premade program", "Full lecture library", "Monthly live Q&A with Dr. Jared", "Progress tracking and workout comparisons"] },
      { id: "premium", name: "Premium 1-on-1", price: 349, meetings: 2, meetingMinutes: 45, perks: ["Everything in Member", "2 remote 1-on-1 sessions with Dr. Jared every month", "Programming built for you", "Help with your specific issues"] },
      { id: "premium-plus", name: "Premium Plus", price: 699, meetings: 4, meetingMinutes: 45, perks: ["Everything in Premium", "4 remote 1-on-1 sessions every month", "Priority scheduling", "Direct access between sessions"] }
    ],
    // Pain tracks: empty = use the built-in tracks transcribed from Dr. Jared's Drive (frontend/paintracks.js)
    tracks: [],
    recommendations: [
      { id: "zero-drop", area: "Feet", title: "Switch to zero-drop shoes, gradually", body: "Zero-drop shoes keep your heel and forefoot level, so your calves, arches and toes do their job again. Start with 1 to 2 hours a day and add time each week. If your calves or arches get sore, hold at that amount for a few days.", link: "" },
      { id: "toes", area: "Feet", title: "Let your toes spread", body: "Choose shoes with a wide toe box. Spend some time barefoot at home on safe surfaces to rebuild foot strength.", link: "" },
      { id: "pillow-progression", area: "Low back", title: "Reduce the pillows under you, a little at a time", body: "If lying flat on your back hurts, start by rolling onto your back with pillows under your hips and knees. Every few nights remove one pillow. Over a few weeks your hip flexors slowly unfold and relax, and lying flat stops hurting.", link: "" },
      { id: "walk-after-meals", area: "Low back", title: "Walk after meals", body: "A 10-minute easy walk after meals keeps your hips and spine moving and is one of the simplest things you can do for your back.", link: "" },
      { id: "desk-breaks", area: "Desk & posture", title: "Move every 30 to 45 minutes", body: "Set a timer. Stand, walk, or do one desk reset from the Desk Worker Reset program. The best posture is the next one.", link: "" },
      { id: "sleep-position", area: "Neck & shoulders", title: "Pick a pillow that keeps your neck level", body: "On your side, your pillow should fill the gap between ear and shoulder so your neck stays straight. On your back, use a thinner pillow.", link: "" },
      { id: "sleep-hours", area: "Recovery", title: "Protect 7 to 9 hours of sleep", body: "Tissue repairs while you sleep. Keep the same bed and wake time, and keep screens out of the last 30 minutes.", link: "" }
    ]
  };
}

function programIn(p, i) {
  const L = `Program ${i + 1}`;
  if (!p || typeof p !== "object") fail(`${L} is missing.`);
  if (!Array.isArray(p.days) || !p.days.length || p.days.length > 7) fail(`${L}: 1 to 7 training days.`);
  return {
    id: slug(p.id, `${L} id`), title: str(p.title, `${L} title`, { min: 1, max: 80 }), category: oneOf(p.category, PROGRAM_CATS, `${L} category`),
    level: oneOf(p.level, LEVELS, `${L} level`), location: oneOf(p.location, LOCS, `${L} location`), weeks: int(p.weeks, `${L} weeks`, { min: 1, max: 52 }),
    seed: int(p.seed ?? 1, `${L} seed`, { min: 1, max: 999999 }), access: oneOf(p.access || "free", ACCESS, `${L} access`),
    summary: str(p.summary, `${L} summary`, { max: 400 }), notes: str(p.notes, `${L} notes`, { max: 1000 }),
    image: str(p.image || "", `${L} image`, { max: 500 }),
    days: p.days.map((d, j) => ({
      name: str(d.name, `${L} day ${j + 1} name`, { min: 1, max: 40 }), goal: oneOf(d.goal, GOALS, `${L} day ${j + 1} focus`),
      length: oneOf(Number(d.length), [15, 20, 30, 45, 60, 90], `${L} day ${j + 1} length`),
      ...(d.rounds !== undefined ? { rounds: int(d.rounds, "Rounds", { min: 1, max: 10 }) } : {}),
      ...(d.restEx !== undefined ? { restEx: int(d.restEx, "Rest between exercises", { min: 0, max: 180 }) } : {}),
      ...(d.restRound !== undefined ? { restRound: int(d.restRound, "Rest between rounds", { min: 0, max: 300 }) } : {}),
      ...(d.seedOffset !== undefined ? { seedOffset: int(d.seedOffset, "Seed offset", { min: 0, max: 9999 }) } : {}),
      ...(Array.isArray(d.circuit) ? { circuit: d.circuit.slice(0, 20).map((x, k) => ({
        ex: str(x.ex, `Day ${j + 1} exercise ${k + 1}`, { min: 1, max: 80 }),
        sets: str(x.sets || "", `Day ${j + 1} exercise ${k + 1} sets`, { max: 40 })
      })) } : {})
    }))
  };
}
const lectureIn = (l, i) => ({
  id: slug(l.id, `Lecture ${i + 1} id`), title: str(l.title, `Lecture ${i + 1} title`, { min: 1, max: 120 }), topic: oneOf(l.topic, LECTURE_TOPICS, `Lecture ${i + 1} topic`),
  minutes: int(l.minutes ?? 0, `Lecture ${i + 1} minutes`, { min: 0, max: 600 }), url: url(l.url, `Lecture ${i + 1} video link`),
  downloadUrl: url(l.downloadUrl, `Lecture ${i + 1} download link`), access: oneOf(l.access || "free", ACCESS, `Lecture ${i + 1} access`),
  summary: str(l.summary, `Lecture ${i + 1} summary`, { max: 500 })
});
const tierIn = (t, i) => ({
  id: slug(t.id, `Tier ${i + 1} id`), name: str(t.name, `Tier ${i + 1} name`, { min: 1, max: 60 }), price: int(t.price, `Tier ${i + 1} price`, { min: 0, max: 20000 }),
  meetings: int(t.meetings ?? 0, `Tier ${i + 1} meetings per month`, { min: 0, max: 31 }), meetingMinutes: int(t.meetingMinutes ?? 0, `Tier ${i + 1} meeting length`, { min: 0, max: 180 }),
  perks: list(t.perks || [], `Tier ${i + 1} perks`, 10, (x, j) => str(x, `Perk ${j + 1}`, { min: 1, max: 120 }))
});
const recIn = (r, i) => ({
  id: slug(r.id, `Recommendation ${i + 1} id`), area: str(r.area, `Recommendation ${i + 1} area`, { min: 1, max: 40 }),
  title: str(r.title, `Recommendation ${i + 1} title`, { min: 1, max: 120 }), body: str(r.body, `Recommendation ${i + 1} text`, { min: 1, max: 2000 }),
  link: url(r.link, `Recommendation ${i + 1} link`)
});
const driveId = (v, label) => {
  const s = str(v, label, { max: 300 });
  if (!s) return null;
  const m = s.match(/[-\w]{20,}/);
  if (!m) fail(`${label}: paste a Google Drive link or file id.`);
  return m[0];
};
const trackIn = (t, i) => {
  const L = `Track ${i + 1}`;
  if (!t || typeof t !== "object") fail(`${L} is missing.`);
  if (!Array.isArray(t.levels) || !t.levels.length || t.levels.length > 8) fail(`${L}: 1 to 8 levels.`);
  if (!Array.isArray(t.pts) || !t.pts.length || t.pts.length > 25) fail(`${L}: pick 1 to 25 muscles on the body map.`);
  return {
    id: slug(t.id, `${L} id`), title: str(t.title, `${L} title`, { min: 1, max: 120 }), region: str(t.region, `${L} region`, { min: 1, max: 40 }),
    img: list(t.img || [], `${L} images`, 6, (x, j) => driveId(x, `${L} image ${j + 1}`)).filter(Boolean),
    pts: t.pts.map((x) => slug(x, `${L} muscle`)), note: str(t.note, `${L} note`, { max: 300 }),
    levels: t.levels.map((l, j) => {
      if (!Array.isArray(l.videos) || !l.videos.length || l.videos.length > 15) fail(`${L} level ${j + 1}: 1 to 15 videos.`);
      return { title: str(l.title, `${L} level ${j + 1} title`, { min: 1, max: 100 }),
        videos: l.videos.map((v, k) => ({ name: str(v.name, `${L} video ${k + 1} name`, { min: 1, max: 100 }), id: driveId(v.id || "", `${L} video ${k + 1} link`), file: str(v.file || "", "File", { max: 100 }) })) };
    })
  };
};

function liveIn(b, prev) {
  const o = { ...prev };
  if (b.title !== undefined) o.title = str(b.title, "Live title", { min: 1, max: 120 });
  if (b.date !== undefined) { o.date = str(b.date, "Live date", { max: 10 }); if (o.date && !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) fail("Live date must be YYYY-MM-DD."); }
  if (b.time !== undefined) { o.time = str(b.time, "Live time", { max: 5 }); if (!/^\d{2}:\d{2}$/.test(o.time)) fail("Live time must be HH:MM."); }
  if (b.minutes !== undefined) o.minutes = int(b.minutes, "Live length", { min: 15, max: 240 });
  if (b.joinUrl !== undefined) o.joinUrl = url(b.joinUrl, "Join link");
  if (b.access !== undefined) o.access = oneOf(b.access, ACCESS, "Live access");
  if (b.notes !== undefined) o.notes = str(b.notes, "Live notes", { max: 1000 });
  if (b.recordings !== undefined) o.recordings = list(b.recordings, "Recordings", 60, (r, i) => ({ title: str(r.title, `Recording ${i + 1} title`, { min: 1, max: 120 }), date: str(r.date, "Date", { max: 10 }), url: url(r.url, `Recording ${i + 1} link`) }));
  return o;
}

function mountContent({ app, admin, store, me, clients, save, today, notify, activity }) {
  // One-time refresh: when the admin hasn't customized programs yet, use the current defaults so the new
  // Dr. Jared programs ship live. Admin edits set contentVersion to opt out.
  const content = () => {
    const saved = store.read("content", {});
    const d = defaultContent();
    if (!saved.contentVersion || saved.contentVersion < 2) {
      if (!saved.programs || !saved.programs.length) saved.programs = d.programs;
    }
    return { ...d, ...saved };
  };
  const rank = { free: 0, member: 1, premium: 2 };
  // What a viewer may open: free for everyone, member for any tier, premium for tiers with 1-on-1 meetings
  const levelOf = (c, tiers) => {
    const m = c && c.membership && (!c.membership.until || c.membership.until >= today()) ? c.membership : null;
    if (!m) return 0;
    const t = tiers.find((x) => x.id === m.tier);
    return t && t.meetings > 0 ? 2 : 1;
  };
  const view = (c) => ({
    programs: c.programs.map((p) => ({ ...p, locked: false })),
    lectures: c.lectures.map((l) => ({ ...l, locked: false })),
    live: { ...c.live, locked: false },
    tiers: c.tiers, recommendations: c.recommendations, tracks: c.tracks, categories: PROGRAM_CATS, topics: LECTURE_TOPICS
  });

  app.get("/api/content", (req, res) => { res.set("Cache-Control", "no-cache"); res.json(view(content())); });
  me.get("/content", (req, res) => {
    const c = content(), lvl = levelOf(req.client, c.tiers);
    res.json({ ...view(c), access: ["free", "member", "premium"][lvl], membership: req.client.membership || null });
  });

  // Ask to join a tier (payments come later; Dr. Jared confirms and turns it on)
  me.post("/membership/request", (req, res) => {
    const c = content();
    const tier = c.tiers.find((t) => t.id === (req.body && req.body.tier));
    if (!tier) fail("Pick a membership.");
    const note = str(req.body.note, "Note", { max: 500 });
    const list = clients(); const cl = list.find((x) => x.id === req.client.id);
    // Review reward: a percentage off the first month
    let discount = null;
    const code = String(req.body.rewardCode || cl.reviewCode || "").trim().toUpperCase();
    if (code) {
      const fb = store.read("feedback", []).find((f) => f.rewardCode === code);
      if (!fb) { if (req.body.rewardCode) fail("That review code isn't valid."); }
      else if (fb.rewardUsedAt) { if (req.body.rewardCode) fail("That review code has already been used."); }
      else discount = { code, pct: fb.rewardPct ?? 30 };
    }
    cl.membershipRequest = { tier: tier.id, note, at: new Date().toISOString(), ...(discount ? { rewardCode: discount.code, discountPct: discount.pct } : {}) };
    save(list);
    activity("membership_request", { email: cl.email, tier: tier.id });
    notify.owner(`Membership request: ${tier.name} ($${tier.price}/mo)`, `${cl.name} <${cl.email}> ${cl.phone || ""}\nwants ${tier.name}.${discount ? `\nReview reward: ${discount.pct}% off the first month (code ${discount.code}), first month $${Math.round(tier.price * (100 - discount.pct)) / 100}.` : ""}\n${note || ""}\n\nTurn it on in Admin → Members.`);
    res.status(201).json({ ok: true, request: cl.membershipRequest });
  });

  // 1-on-1 remote meetings for premium tiers, limited per calendar month
  const month = () => today().slice(0, 7);
  const allowance = (cl, c) => { const t = c.tiers.find((x) => x.id === (cl.membership && cl.membership.tier)); return levelOf(cl, c.tiers) === 2 ? t : null; };
  me.get("/meetings", (req, res) => {
    const c = content(), t = allowance(req.client, c);
    const mine = req.client.meetings || [];
    res.json({ meetings: [...mine].reverse(), allowance: t ? t.meetings : 0, minutes: t ? t.meetingMinutes : 0, usedThisMonth: mine.filter((m) => m.month === month() && m.status !== "cancelled").length });
  });
  me.post("/meetings", (req, res) => {
    const c = content(), list = clients(), cl = list.find((x) => x.id === req.client.id), t = allowance(cl, c);
    if (!t) return res.status(403).json({ error: "1-on-1 meetings come with a Premium membership." });
    const used = (cl.meetings || []).filter((m) => m.month === month() && m.status !== "cancelled").length;
    if (used >= t.meetings) return res.status(409).json({ error: `You've used all ${t.meetings} of this month's sessions. They reset on the 1st.` });
    const b = req.body || {};
    const m = { id: crypto.randomBytes(6).toString("hex"), month: month(), topic: str(b.topic, "What you want to work on", { min: 3, max: 500 }),
      times: str(b.times, "Times that work for you", { min: 3, max: 300 }), status: "requested", when: "", link: "", minutes: t.meetingMinutes, createdAt: new Date().toISOString() };
    cl.meetings = [...(cl.meetings || []), m].slice(-200);
    save(list);
    activity("meeting_request", { email: cl.email });
    notify.owner(`1-on-1 request from ${cl.name}`, `${cl.name} <${cl.email}> (${t.name})\n\nTopic: ${m.topic}\nTimes: ${m.times}\n\nSchedule it in Admin → Members.`);
    res.status(201).json(m);
  });

  // ---- Admin
  admin.get("/content", (req, res) => res.json(content()));
  admin.put("/content", (req, res) => {
    const b = req.body || {}, c = content(), next = store.read("content", {});
    if (b.programs !== undefined) next.programs = list(b.programs, "Programs", 40, programIn);
    if (b.lectures !== undefined) next.lectures = list(b.lectures, "Lectures", 200, lectureIn);
    if (b.tiers !== undefined) next.tiers = list(b.tiers, "Membership tiers", 6, tierIn);
    if (b.recommendations !== undefined) next.recommendations = list(b.recommendations, "Recommendations", 100, recIn);
    if (b.live !== undefined) next.live = liveIn(b.live || {}, c.live);
    if (b.tracks !== undefined) next.tracks = list(b.tracks, "Pain tracks", 80, trackIn);
    store.write("content", { ...next, contentVersion: 2 });
    res.json(content());
  });
  admin.get("/members", (req, res) => {
    const c = content();
    res.json(clients().filter((x) => x.membership || x.membershipRequest || (x.meetings || []).length).map((x) => ({
      id: x.id, name: x.name, email: x.email, phone: x.phone, membership: x.membership || null, request: x.membershipRequest || null,
      tier: (c.tiers.find((t) => x.membership && t.id === x.membership.tier) || {}).name || "", meetings: [...(x.meetings || [])].reverse()
    })));
  });
  admin.put("/clients/:id/membership", (req, res) => {
    const list = clients(), cl = list.find((x) => x.id === req.params.id);
    if (!cl) return res.status(404).json({ error: "Client not found." });
    const b = req.body || {};
    if (!b.tier) { cl.membership = null; }
    else {
      if (!content().tiers.some((t) => t.id === b.tier)) fail("Unknown membership tier.");
      const until = str(b.until, "Paid through", { max: 10 });
      if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) fail("Paid through must be YYYY-MM-DD.");
      cl.membership = { tier: b.tier, since: (cl.membership && cl.membership.since) || today(), until };
      const rq = cl.membershipRequest;
      if (rq && rq.rewardCode) {
        const fbl = store.read("feedback", []), fb = fbl.find((f) => f.rewardCode === rq.rewardCode);
        if (fb && !fb.rewardUsedAt) { fb.rewardUsedAt = new Date().toISOString(); store.write("feedback", fbl); }
        cl.membership.firstMonthDiscountPct = rq.discountPct;
      }
      if (rq && rq.tier === b.tier) delete cl.membershipRequest;
    }
    save(list);
    res.json({ membership: cl.membership });
  });
  admin.patch("/clients/:id/meetings/:mid", (req, res) => {
    const list = clients(), cl = list.find((x) => x.id === req.params.id);
    const m = cl && (cl.meetings || []).find((x) => x.id === req.params.mid);
    if (!m) return res.status(404).json({ error: "Meeting not found." });
    const b = req.body || {};
    if (b.status !== undefined) m.status = oneOf(b.status, ["requested", "scheduled", "done", "cancelled"], "Status");
    if (b.when !== undefined) m.when = str(b.when, "When", { max: 80 });
    if (b.link !== undefined) m.link = url(b.link, "Meeting link");
    save(list);
    if (m.status === "scheduled" && m.when) notify.client(cl.email, "Your 1-on-1 with Dr. Jared is scheduled", `Hi ${cl.name.split(" ")[0]},\n\nYour session is set for ${m.when}.${m.link ? `\nJoin here: ${m.link}` : ""}\n\nMD Fit`);
    res.json(m);
  });
}

module.exports = { mountContent, defaultContent, PROGRAM_CATS, LECTURE_TOPICS };
