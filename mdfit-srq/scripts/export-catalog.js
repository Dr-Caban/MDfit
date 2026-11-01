// Builds frontend/data/catalog.json: every exercise, muscle, pain spot, body-map point, muscle report and pain track,
// in plain JSON for the iOS app (and anything else that isn't a browser). Run after editing any of the source files:
//   node scripts/export-catalog.js
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");

const FE = path.join(__dirname, "..", "frontend");
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of ["app/exercises.js", "app/library.js", "app/generator.js", "painmuscles.js", "musclereports.js", "paintracks.js"]) {
  vm.runInContext(fs.readFileSync(path.join(FE, f), "utf8"), ctx, { filename: f });
}
const W = ctx.window, L = W.MDFitLib, G = W.MDFitGen, M = W.MDFitMuscles, T = W.MDFitTracks;
const exercises = W.MDFIT_EXERCISES.map((e) => ({
  ...e, kind: L.kind(e), category: L.category(e), joint: L.joint(e), muscle: L.muscle(e),
  video: { preview: `https://drive.google.com/file/d/${e.id}/preview`, mp4: `https://drive.usercontent.google.com/download?id=${e.id}&export=download`, thumbnail: `https://drive.google.com/thumbnail?id=${e.id}&sz=w640` }
}));
const body = {
  exercises,
  library: { kinds: L.KINDS, categoriesByKind: L.CAT_BY_KIND, categories: L.CATEGORIES, joints: L.JOINTS, muscles: L.MUSCLES, locations: G.LOCATIONS.map((l) => ({ ...l, exerciseIds: G.byLocation(l.id).map((e) => e.id) })) },
  generator: { goals: G.GOALS, locations: G.LOCATIONS, levels: G.LEVELS, lengths: G.LENGTHS, perRound: G.PER_ROUND, rounds: G.ROUNDS, restEx: G.REST_EX, restRound: G.REST_ROUND, addons: G.ADDONS, defaults: G.DEFAULTS, source: "/app/generator.js" },
  pain: { muscles: M.MUSCLES, aggravators: M.AGGRAVATORS, spots: M.SPOTS, maps: M.MAPS, bodyImage: { url: "/assets/pain/body-figures.webp", width: 1182, height: 1073 } },
  reports: W.MDFIT_MUSCLE_REPORTS,
  tracks: T.TRACKS.map((t) => ({ ...t, images: t.img.map((id) => T.img(id)) }))
};
const json = JSON.stringify(body);
const version = crypto.createHash("sha1").update(json).digest("hex").slice(0, 12);
fs.mkdirSync(path.join(FE, "data"), { recursive: true });
fs.writeFileSync(path.join(FE, "data", "catalog.json"), JSON.stringify({ version, generatedAt: new Date().toISOString(), ...body }));
fs.writeFileSync(path.join(FE, "data", "catalog-version.json"), JSON.stringify({ version }));
console.log(`catalog ${version}: ${exercises.length} exercises, ${Object.keys(M.MUSCLES).length} muscles, ${Object.keys(body.reports).length} reports, ${body.tracks.length} tracks, ${(json.length / 1024).toFixed(0)} KB`);
