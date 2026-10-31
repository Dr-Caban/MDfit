// Adds ?v=<content hash> to every local .css/.js link in the frontend HTML so browsers
// (especially iPhone Safari) always fetch the current file after a deploy. Run after editing CSS/JS:
//   node scripts/version-assets.js
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const root = path.join(__dirname, "..", "frontend");
const htmls = [...fs.readdirSync(root).filter((f) => f.endsWith(".html")).map((f) => path.join(root, f)),
  ...fs.readdirSync(path.join(root, "guides")).filter((f) => f.endsWith(".html")).map((f) => path.join(root, "guides", f))];
const hash = (file) => crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 8);
for (const html of htmls) {
  let s = fs.readFileSync(html, "utf8");
  const out = s.replace(/(src|href)="(\/?)([\w./-]+\.(?:css|js))(?:\?v=[\w]+)?"/g, (m, attr, slash, rel) => {
    const file = slash ? path.join(root, rel) : path.join(path.dirname(html), rel);
    return fs.existsSync(file) ? `${attr}="${slash}${rel}?v=${hash(file)}"` : m;
  });
  if (out !== s) { fs.writeFileSync(html, out); console.log("versioned", path.relative(root, html)); }
}
