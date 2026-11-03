// Builds the media manifest: every video and image MD Fit uses, with its Cloudinary folder, file name, display name,
// tags and descriptive metadata. The API copies assets into Cloudinary from this list, and the inventory docs
// (docs/MEDIA_LIBRARY.md, docs/media-library.csv) are generated from it. Run after adding videos or images:
//   node scripts/build-media-manifest.js
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FE = path.join(ROOT, "frontend");
const SITE = "https://www.mymdfit.com";
const cat = JSON.parse(fs.readFileSync(path.join(FE, "data/catalog.json"), "utf8"));
const slug = (s) => String(s || "").toLowerCase().replace(/&/g, " and ").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
const folderName = (s) => String(s || "Other").replace(/&/g, "and").replace(/[^A-Za-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().replace(/ /g, "-");
const tagOf = (k, v) => `${k}:${slug(v)}`;
const LOC = { any: "Anywhere", gym: "Gym", home: "Home", outdoor: "Outdoor" };
const assets = [];
const seen = new Set();
function add(a) {
  if (seen.has(a.public_id)) { let n = 2; while (seen.has(`${a.public_id}-${n}`)) n++; a.public_id = `${a.public_id}-${n}`; }
  seen.add(a.public_id);
  a.folder = a.public_id.split("/").slice(0, -1).join("/");
  a.tags = [...new Set(["mdfit", `type:${a.type}`, ...a.tags])];
  assets.push(a);
}

// 1. Exercise library videos
const byId = new Map();
for (const e of cat.exercises) {
  const kind = e.kind || "Exercise";
  const pid = `mdfit/videos/exercise-library/${folderName(kind)}/${folderName(e.region)}/${folderName(e.cat)}/${slug(e.name)}`;
  const a = { key: e.id, source: "drive", drive_id: e.id, type: "video", purpose: "exercise-library", public_id: pid, display_name: e.name,
    tags: ["purpose:exercise-library", tagOf("kind", kind), tagOf("region", e.region), tagOf("category", e.cat), tagOf("library-category", e.category), `level:${e.level}`, tagOf("location", LOC[e.loc] || e.loc), tagOf("joint", e.joint), tagOf("muscle", e.muscle), ...(e.seated ? ["seated"] : [])],
    context: { name: e.name, purpose: "Exercise library", kind, region: e.region, category: e.cat, library_category: e.category, level: String(e.level), location: LOC[e.loc] || e.loc, joint: e.joint, muscle: e.muscle, seated: e.seated ? "yes" : "no", drive_id: e.id } };
  add(a); byId.set(e.id, a);
}

// 2. Pain-track videos (and the library videos they reuse get a pain-track tag) + pain-pattern images
for (const t of cat.tracks) {
  const tFolder = `${folderName(t.region)}/${slug(t.title.replace(/→/g, "to"))}`;
  (t.levels || []).forEach((lv, li) => (lv.videos || []).forEach((v, vi) => {
    const lvl = li + 1, lvTitle = String(lv.title || `Level ${lvl}`).replace(/^Level \d+\s*·\s*/, "");
    if (byId.has(v.id)) { const a = byId.get(v.id); a.tags.push("purpose:pain-track", tagOf("pain-track", t.id)); a.context.pain_tracks = [a.context.pain_tracks, t.title].filter(Boolean).join("; "); if (v.file) a.context.file_code = v.file; return; }
    const a = { key: v.id, source: "drive", drive_id: v.id, type: "video", purpose: "pain-track",
      public_id: `mdfit/videos/pain-tracks/${tFolder}/level-${lvl}-${String(vi + 1).padStart(2, "0")}-${slug(v.name)}`, display_name: `${v.name} (${t.title}, Level ${lvl})`,
      tags: ["purpose:pain-track", tagOf("pain-track", t.id), tagOf("region", t.region), `level:${lvl}`, tagOf("stage", lvTitle), ...(v.file ? [tagOf("file-code", v.file)] : [])],
      context: { name: v.name, purpose: "Pain track", pain_track: t.title, region: t.region, level: String(lvl), stage: lvTitle, order: String(vi + 1), file_code: v.file || "", drive_id: v.id } };
    add(a); byId.set(v.id, a);
  }));
  (t.img || []).forEach((id, i) => add({ key: id, source: "drive", drive_id: id, type: "image", purpose: "pain-pattern",
    public_id: `mdfit/images/pain-patterns/${tFolder}/pattern-${i + 1}`, display_name: `${t.title}: pain pattern ${i + 1}`,
    tags: ["purpose:pain-pattern", tagOf("pain-track", t.id), tagOf("region", t.region)],
    context: { name: `${t.title} pain pattern ${i + 1}`, purpose: "Pain pattern image", pain_track: t.title, region: t.region, drive_id: id } }));
}

// 3. App intro videos and lectures
const intros = (fs.readFileSync(path.join(FE, "app/exercises.js"), "utf8").match(/MDFIT_INTROS = (\{[^}]*\})/) || [])[1];
for (const [screen, id] of Object.entries(intros ? JSON.parse(intros) : {})) if (!byId.has(id)) add({ key: id, source: "drive", drive_id: id, type: "video", purpose: "app-intro",
  public_id: `mdfit/videos/app-intros/${slug(screen)}-intro`, display_name: `${screen[0].toUpperCase() + screen.slice(1)} intro`,
  tags: ["purpose:app-intro", tagOf("screen", screen)], context: { name: `${screen} intro`, purpose: "App intro video", screen, drive_id: id } });
const content = require(path.join(ROOT, "backend/lib/content.js")).defaultContent();
for (const l of content.lectures || []) { const m = String(l.url || "").match(/\/d\/([\w-]{20,})/); if (m) add({ key: m[1], source: "drive", drive_id: m[1], type: "video", purpose: "lecture",
  public_id: `mdfit/videos/lectures/${slug(l.title)}`, display_name: l.title, tags: ["purpose:lecture", ...(l.topic ? [tagOf("topic", l.topic)] : [])],
  context: { name: l.title, purpose: "Lecture", minutes: String(l.minutes || ""), topic: l.topic || "", drive_id: m[1] } }); }

// 4. Drive protocol images (week-by-week sheets)
const PROTOCOLS = [["golfers-elbow", "Golfer's elbow", ["1kesOEfU52_Fd0b-V3kR6FUO5pMXLg2_a", "1bnlCk7ieGzoGgUAzjYbbTo3UtKMzJgNj", "1Rd1LaMS35P55itlxJorIe-7ZVzObPX2n", "1PgaeS2Mcg38-a2MTrwIS_xQFbIs9StBg"]],
  ["tennis-elbow", "Tennis elbow", ["1dpzHCPtcB6WUoeptfm1N7RoyTv3Cy1Z-", "1Ia6fB7njW2bDOXALjKrgGQ21rvHd9uq_", "1OHrrDGSkM2gU2Kkjx3SipDiWyhmVs-BJ", "1DggFIeEsXbHUbLBzHdFgrucDcJ8mMDJ7"]]];
for (const [id, name, weeks] of PROTOCOLS) weeks.forEach((d, i) => add({ key: d, source: "drive", drive_id: d, type: "image", purpose: "protocol-sheet",
  public_id: `mdfit/images/protocols/${id}/week-${i + 1}`, display_name: `${name} protocol: week ${i + 1}`,
  tags: ["purpose:protocol-sheet", tagOf("protocol", id), `week:${i + 1}`], context: { name: `${name} protocol week ${i + 1}`, purpose: "Protocol sheet", protocol: name, week: String(i + 1), drive_id: d } }));

// 5. Website images
const IMG = /\.(png|jpe?g|webp)$/i;
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((f) => f.isDirectory() ? walk(path.join(dir, f.name)) : IMG.test(f.name) ? [path.join(dir, f.name)] : []);
for (const file of walk(path.join(FE, "assets"))) {
  const rel = path.relative(FE, file).split(path.sep).join("/"), base = path.basename(file).replace(IMG, ""), parts = rel.split("/");
  let folder, purpose, extra = {};
  if (parts[1] === "guides") { const m = base.match(/^(.*)-(anatomy|referral|thumb)$/); folder = `guides/${m ? m[1] : "misc"}`; purpose = "guide"; extra = { guide: m ? m[1] : "", view: m ? m[2] : "" }; }
  else if (parts[1] === "pain") { folder = parts[2] === "clean" ? "pain-map/clean-sources" : "pain-map"; purpose = "pain-map"; }
  else if (parts[1] === "programs") { folder = "programs"; purpose = "program-cover"; extra = { program: base.replace(/-new$/, ""), version: /-new$/.test(base) ? "new" : "original" }; }
  else { folder = "branding"; purpose = "branding"; }
  add({ key: rel, source: "site", url: `${SITE}/${rel}`, type: "image", purpose, public_id: `mdfit/images/${folder}/${slug(base)}`,
    display_name: base.replace(/[-_]+/g, " "), tags: [tagOf("purpose", purpose), ...Object.entries(extra).filter(([, v]) => v).map(([k, v]) => tagOf(k, v))],
    context: { name: base, purpose: purpose.replace(/-/g, " "), source_path: "/" + rel, ...extra } });
}

assets.forEach((a) => { a.tags = [...new Set(a.tags)]; });
const manifest = { version: new Date().toISOString().slice(0, 10), count: assets.length, assets };
fs.writeFileSync(path.join(FE, "data/media-manifest.json"), JSON.stringify(manifest));

// ---- docs
const by = (k) => assets.reduce((m, a) => ((m[a[k]] = (m[a[k]] || 0) + 1), m), {});
const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const cols = ["type", "purpose", "display_name", "folder", "public_id", "tags", "drive_id", "source_path", "name", "region", "kind", "category", "level", "location", "joint", "muscle", "pain_track", "stage", "file_code"];
fs.writeFileSync(path.join(ROOT, "docs/media-library.csv"), [cols.join(","), ...assets.map((a) => cols.map((c) => csvCell(
  c === "tags" ? a.tags.join(" ") : c in a ? a[c] : c === "source_path" ? a.context.source_path : (a.context || {})[c])).join(","))].join("\n") + "\n");
const tree = {};
for (const a of assets) { let n = tree; for (const p of a.folder.split("/")) n = n[p] = n[p] || {}; n.__n = (n.__n || 0) + 1; }
const lines = []; (function pr(n, d) { for (const [k, v] of Object.entries(n).filter(([k]) => k !== "__n").sort()) { const total = (function cnt(x) { return (x.__n || 0) + Object.entries(x).filter(([k]) => k !== "__n").reduce((s, [, y]) => s + cnt(y), 0); })(v); lines.push(`${"  ".repeat(d)}${k}/  (${total})`); pr(v, d + 1); } })(tree, 0);
const section = (title, list) => `### ${title} (${list.length})\n\n| Display name | Cloudinary path | Details |\n|---|---|---|\n${list.map((a) => `| ${a.display_name} | \`${a.public_id}\` | ${Object.entries(a.context).filter(([k, v]) => v && !["name", "purpose", "drive_id"].includes(k)).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(" · ")} |`).join("\n")}\n`;
const grp = (p) => assets.filter((a) => a.purpose === p);
fs.writeFileSync(path.join(ROOT, "docs/MEDIA_LIBRARY.md"), `# MD Fit Media Library (Cloudinary)

Generated ${manifest.version} by \`node scripts/build-media-manifest.js\`. Cloud: **rvrfmvmm**. Every asset lives under \`mdfit/\`.
Spreadsheet version: [media-library.csv](media-library.csv). Machine version: \`frontend/data/media-manifest.json\`.

**Totals:** ${assets.length} assets · ${Object.entries(by("type")).map(([k, v]) => `${v} ${k}s`).join(" · ")}
**By purpose:** ${Object.entries(by("purpose")).map(([k, v]) => `${k} ${v}`).join(" · ")}

## How it's organized

- **Folders** go purpose → region → category, so editors can open one folder and see everything of one kind.
- **File names** are the exercise or image name in plain words (\`rotator-cuff-external-rotation\`); pain-track videos are prefixed with level and order (\`level-1-02-...\`) so they sort in workout order.
- **Display name** in the Media Library is the human title.
- **Tags** (filter in Cloudinary search): \`type:video|image\`, \`purpose:*\`, \`region:*\`, \`kind:*\`, \`category:*\`, \`library-category:*\`, \`level:1–9\`, \`location:*\`, \`joint:*\`, \`muscle:*\`, \`pain-track:*\`, \`stage:*\`, \`file-code:*\`, \`protocol:*\`, \`week:*\`, \`guide:*\`, \`view:*\`, \`program:*\`, \`seated\`.
- **Contextual metadata** on each asset: name, purpose, region, category, level, location, joint, muscle, pain track, stage, order, original file code, original Google Drive ID, minutes/topic for lectures.
- Videos over 100 MB are stored as a 720p H.264 copy (plays on every phone); the original stays in Google Drive (see Drive ID).

## Folder tree

\`\`\`
${lines.join("\n")}
\`\`\`

## Assets

${section("Exercise library videos", grp("exercise-library"))}
${section("Pain-track videos", grp("pain-track"))}
${section("App intro videos", grp("app-intro"))}
${section("Lectures", grp("lecture"))}
${section("Pain-pattern images", grp("pain-pattern"))}
${section("Protocol sheets", grp("protocol-sheet"))}
${section("Guide images", grp("guide"))}
${section("Pain-map images", grp("pain-map"))}
${section("Program covers", grp("program-cover"))}
${section("Branding", grp("branding"))}
`);
console.log(`media manifest: ${assets.length} assets`, by("purpose"));
