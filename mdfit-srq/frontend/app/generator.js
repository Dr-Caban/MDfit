// Workout generator: builds a session from Dr. Jared's exercise library.
// Structure: warm-up (mobility/activation) → main block (goal regions, level band) → cool-down (mobility/rehab).
// Sets/reps live in PRESCRIBE so they can be tuned in one place.
(() => {
  const EX = window.MDFIT_EXERCISES || [];

  const GOALS = [
    { id: "upper", label: "Upper Body", icon: "upper", regions: ["SH", "UB", "EL", "WR", "NK"] },
    { id: "lower", label: "Lower Body", icon: "lower", regions: ["HP", "LB", "KN", "AN"] },
    { id: "full", label: "Full Body", icon: "full", regions: null },
    { id: "core", label: "Core & Spine", icon: "core", regions: ["CO", "SP"] },
    { id: "mobility", label: "Mobility & Recovery", icon: "mobility", regions: null, mobility: true }
  ];
  const LOCATIONS = [
    { id: "home", label: "Home", icon: "home" },
    { id: "gym", label: "Gym", icon: "gym" },
    { id: "outdoor", label: "Outdoor", icon: "outdoor" },
    { id: "office", label: "Office / Desk", icon: "office" }
  ];
  const LEVELS = [
    { id: "beginner", label: "Beginner", min: 1, max: 3, bars: 1 },
    { id: "intermediate", label: "Intermediate", min: 2, max: 6, bars: 2 },
    { id: "advanced", label: "Advanced", min: 4, max: 8, bars: 3 },
    { id: "elite", label: "Elite", min: 6, max: 9, bars: 4 }
  ];
  const LENGTHS = [
    { id: 15, label: "15 min", count: 5 },
    { id: 30, label: "30 min", count: 6 },
    { id: 45, label: "45 min", count: 8 },
    { id: 60, label: "60 min", count: 10 }
  ];
  const TITLES = { beginner: "Foundations", intermediate: "Strength", advanced: "Power", elite: "Performance" };

  const PRESCRIBE = {
    Strength: { beginner: "2 × 10", intermediate: "3 × 10", advanced: "4 × 8", elite: "5 × 6" },
    Power: { beginner: "2 × 6", intermediate: "3 × 6", advanced: "4 × 5", elite: "5 × 4" },
    Activation: { beginner: "2 × 10", intermediate: "2 × 12", advanced: "3 × 12", elite: "3 × 15" },
    Mobility: { beginner: "2 × 30 sec", intermediate: "2 × 45 sec", advanced: "2 × 60 sec", elite: "3 × 45 sec" },
    Rehab: { beginner: "2 × 8 slow", intermediate: "3 × 8 slow", advanced: "3 × 10 slow", elite: "3 × 12 slow" },
    Neuroglide: { beginner: "2 × 6 gentle", intermediate: "2 × 8 gentle", advanced: "2 × 10 gentle", elite: "2 × 10 gentle" },
    Posture: { beginner: "2 min", intermediate: "2 min", advanced: "3 min", elite: "3 min" },
    Lifestyle: { beginner: "Daily habit", intermediate: "Daily habit", advanced: "Daily habit", elite: "Daily habit" },
    "Desk & posture": { beginner: "Set up once", intermediate: "Set up once", advanced: "Set up once", elite: "Set up once" }
  };
  const prescription = (ex, level) => (PRESCRIBE[ex.cat] || PRESCRIBE.Mobility)[level] || "2 × 10";

  // Exercises that need gym equipment (when the filename doesn't say home/gym)
  const EQUIP = /\b(DB|KB|Cable|Bench|Barbell|Sled|Erg|Bike|Pulldown|Landmine|GHD|TRX|Rack|Med Ball|Heavy Bag|Pole|Box|Pull Up|Muscle Up|Deadlift|Swing|Wall Ball|Farmer|Clean|Thruster|Strict Press|Push Press|Kettlebell|Dumbbell|Row|Fly|Curl To Press|Lat)\b/i;
  const needsGym = (e) => e.loc === "gym" || (e.loc === "any" && EQUIP.test(e.name));
  const WARM = ["Mobility", "Activation", "Neuroglide"];
  const COOL = ["Mobility", "Rehab", "Neuroglide"];
  const MAIN = ["Strength", "Power", "Activation"];

  function byLocation(loc) {
    if (loc === "gym") return EX.slice();
    if (loc === "outdoor") return EX.filter((e) => e.loc === "outdoor" || (!needsGym(e) && !e.seated));
    if (loc === "office") return EX.filter((e) => !needsGym(e) && (e.seated || ["NK", "ERG", "SP", "SH", "WR"].includes(e.rc)) && e.cat !== "Power");
    return EX.filter((e) => !needsGym(e) && e.loc !== "outdoor"); // home
  }

  // Small seeded RNG so "Shuffle" gives a new mix but a given seed is repeatable
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function pick(pool, n, rand, taken) {
    const out = [], avail = pool.filter((e) => !taken.has(e.id)).sort(() => rand() - 0.5);
    for (const e of avail) {
      if (out.length >= n) break;
      if (out.some((o) => o.name === e.name)) continue;
      out.push(e); taken.add(e.id);
    }
    return out;
  }

  function generate({ goal = "full", location = "home", level = "intermediate", length = 45, seed = Date.now() } = {}) {
    const G = GOALS.find((g) => g.id === goal) || GOALS[2];
    const L = LEVELS.find((l) => l.id === level) || LEVELS[1];
    const N = (LENGTHS.find((x) => x.id === Number(length)) || LENGTHS[2]).count;
    const rand = rng(seed), taken = new Set();
    let pool = byLocation(location);
    if (pool.length < N) pool = EX.filter((e) => !needsGym(e));
    const inRegion = (e) => !G.regions || G.regions.includes(e.rc) || (G.id === "full" && e.rc === "FB");
    const inBand = (e, lo = L.min, hi = L.max) => e.level >= lo && e.level <= hi;

    let warm, main, cool;
    if (G.mobility) {
      // Recovery stays gentle: level 5 max (some "mobility" videos are athletic drills), easy warm-up and cool-down
      const mob = pool.filter((e) => [...COOL, "Activation", "Posture"].includes(e.cat) && e.level <= Math.min(L.max, 5));
      const gentle = (e) => e.level <= 4;
      warm = pick(mob.filter((e) => WARM.includes(e.cat) && gentle(e)), Math.max(1, Math.round(N * 0.3)), rand, taken);
      cool = pick(mob.filter((e) => COOL.includes(e.cat) && gentle(e)), 1, rand, taken);
      main = pick(mob, N - warm.length - cool.length, rand, taken);
      if (warm.length + main.length + cool.length < N) main.push(...pick(pool.filter((e) => [...COOL, "Activation", "Posture"].includes(e.cat) && gentle(e)), N - warm.length - main.length - cool.length, rand, taken));
    } else {
      const nWarm = N >= 8 ? 2 : 1;
      // Warm-ups and cool-downs stay easy (level 4 or below) whatever the session level
      const easy = (e) => e.level <= Math.min(L.max, 4);
      warm = pick(pool.filter((e) => WARM.includes(e.cat) && inRegion(e) && easy(e)), nWarm, rand, taken);
      if (warm.length < nWarm) warm.push(...pick(pool.filter((e) => WARM.includes(e.cat) && easy(e)), nWarm - warm.length, rand, taken));
      const nMain = N - warm.length - 1;
      // Full body: mix upper and lower so it isn't all one area
      let mainPool = pool.filter((e) => MAIN.includes(e.cat) && inRegion(e) && inBand(e));
      if (G.id === "full") {
        const up = mainPool.filter((e) => ["SH", "UB", "EL"].includes(e.rc)), low = mainPool.filter((e) => ["HP", "LB", "KN"].includes(e.rc)), fb = mainPool.filter((e) => ["FB", "CO"].includes(e.rc));
        main = [...pick(fb, Math.ceil(nMain / 3), rand, taken), ...pick(low, Math.ceil(nMain / 3), rand, taken), ...pick(up, nMain, rand, taken)].slice(0, nMain);
      } else main = pick(mainPool, nMain, rand, taken);
      // Not enough at this level/location: widen the level band, then any region
      if (main.length < nMain) main.push(...pick(pool.filter((e) => MAIN.includes(e.cat) && inRegion(e) && inBand(e, 1, 9)), nMain - main.length, rand, taken));
      if (main.length < nMain) main.push(...pick(pool.filter((e) => MAIN.includes(e.cat) && inBand(e, 1, L.max)), nMain - main.length, rand, taken));
      cool = pick(pool.filter((e) => COOL.includes(e.cat) && inRegion(e) && easy(e)), 1, rand, taken);
      if (!cool.length) cool = pick(pool.filter((e) => COOL.includes(e.cat) && easy(e)), 1, rand, taken);
    }
    const tag = (arr, block) => arr.map((e) => ({ ...e, block, sets: prescription(e, L.id) }));
    const exercises = [...tag(warm, "Warm-up"), ...tag(main, G.mobility ? "Flow" : "Main"), ...tag(cool, "Cool-down")];
    return {
      title: G.mobility ? "Mobility & Recovery Flow" : `${G.label} ${TITLES[L.id]}`,
      goal: G.label, goalId: G.id, location, level: L.id, levelLabel: L.label, minutes: Number(length),
      exercises, seed, createdAt: new Date().toISOString()
    };
  }

  window.MDFitGen = { GOALS, LOCATIONS, LEVELS, LENGTHS, generate, prescription, needsGym };
})();
