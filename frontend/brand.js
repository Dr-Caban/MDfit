/*
 * Lone Soulja brand kit: shared drawing helpers for quote cards and video exports.
 * All sizes are designed on a 1080px-wide canvas and scaled by `u`.
 */
const Brand = (() => {
  "use strict";

  const C = { aqua: "#00A3AD", aquaDark: "#00778B", gold: "#FFC72C", black: "#0B0B0B", white: "#FFFFFF" };

  const THEMES = {
    midnight: { label: "Midnight (black)", bg: C.black, glow: "rgba(0,163,173,.45)", text: C.white, accent: C.gold, sub: "#A9BDBF" },
    gold:     { label: "Gold",            bg: C.gold,  glow: "rgba(255,255,255,.45)", text: C.black, accent: C.aquaDark, sub: "#4A3B00" },
    aqua:     { label: "Aquamarine",      bg: C.aquaDark, glow: "rgba(0,163,173,.95)", text: C.white, accent: C.gold, sub: "#D5F2F4" }
  };

  // pre = CSS font style/weight prefix; upper = force uppercase
  const FONTS = {
    bebas:      { label: "Bebas Neue (tall & bold)", family: '"Bebas Neue", Impact, "Arial Narrow", sans-serif', pre: "400",        upper: true,  lh: 1.0 },
    anton:      { label: "Anton (heavy)",            family: 'Anton, Impact, "Arial Black", sans-serif',          pre: "400",        upper: true,  lh: 1.12 },
    montserrat: { label: "Montserrat Black",         family: 'Montserrat, "Arial Black", sans-serif',             pre: "900",        upper: false, lh: 1.15 },
    inter:      { label: "Inter (clean)",            family: "Inter, Arial, sans-serif",                          pre: "800",        upper: false, lh: 1.2 },
    playfair:   { label: "Playfair (classy)",        family: '"Playfair Display", Georgia, serif',                pre: "italic 900", upper: false, lh: 1.15 }
  };

  // safe = top/bottom margins that stay clear of TikTok / Reels / Shorts buttons
  const FORMATS = {
    story:    { label: "9:16 · Reels / TikTok / Shorts / Stories", w: 1080, h: 1920, safeTop: 250, safeBottom: 430 },
    portrait: { label: "4:5 · Facebook / Instagram feed",          w: 1080, h: 1350, safeTop: 110, safeBottom: 120 },
    square:   { label: "1:1 · Square post",                       w: 1080, h: 1080, safeTop: 90,  safeBottom: 100 }
  };

  // ---- Profanity filter: keeps first letter, masks the rest (f***, a**)
  const BAD = /\b(motherf\w*|f+u+c+k\w*|bullshit\w*|shit\w*|asshole\w*|ass|bitch\w*|dick\w*|puss(?:y|ies)|cunt\w*|n[i1]gg\w*)\b/gi;
  const censor = (s) => String(s).replace(BAD, (w) => w[0] + "*".repeat(w.length - 1));

  const font = (f, size) => `${f.pre} ${Math.round(size)}px ${f.family}`;

  async function loadFonts() {
    if (!document.fonts) return;
    await Promise.all(Object.values(FONTS).map((f) => document.fonts.load(font(f, 80), "AaZz").catch(() => {})));
  }

  function spacing(ctx, px) { if ("letterSpacing" in ctx) ctx.letterSpacing = px + "px"; }

  // Word-wrap text into lines that fit maxW
  function wrap(ctx, text, maxW) {
    const lines = [];
    for (const para of String(text).split(/\n/)) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const test = line ? line + " " + word : word;
        if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
        else line = test;
      }
      lines.push(line);
    }
    return lines;
  }

  // Largest font size (step 2px) where wrapped text fits the box
  function fit(ctx, text, f, maxW, maxH, maxSize, minSize) {
    for (let size = maxSize; size >= minSize; size -= 2) {
      ctx.font = font(f, size);
      const lines = wrap(ctx, text, maxW);
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
      if (lines.length * size * f.lh <= maxH && widest <= maxW) return { size, lines };
    }
    ctx.font = font(f, minSize);
    return { size: minSize, lines: wrap(ctx, text, maxW) };
  }

  // Bahamas flag roundel + microphone
  function drawLogo(ctx, cx, cy, r) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    const x = cx - r, y = cy - r, d = r * 2;
    ctx.fillStyle = C.aqua; ctx.fillRect(x, y, d, d);
    ctx.fillStyle = C.gold; ctx.fillRect(x, y + d / 3, d, d / 3);
    ctx.fillStyle = C.black;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + d * 0.52, cy); ctx.lineTo(x, y + d); ctx.fill();
    // mic
    const m = r / 56;
    const mx = cx + 18 * m, my = cy - 22 * m;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(mx - 8 * m, my, 16 * m, 30 * m, 8 * m) : ctx.rect(mx - 8 * m, my, 16 * m, 30 * m); ctx.fill();
    ctx.lineWidth = 4 * m; ctx.strokeStyle = C.black; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(mx, cy, 14 * m, 0, Math.PI); ctx.stroke();
    ctx.fillRect(mx - 2 * m, cy + 14 * m, 4 * m, 10 * m);
    ctx.fillRect(mx - 8 * m, cy + 24 * m, 16 * m, 4 * m);
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(2, r * 0.07); ctx.strokeStyle = C.gold; ctx.stroke();
  }

  // Flag band: black | aqua | gold | aqua
  function drawFlagBand(ctx, y, w, h) {
    const segs = [[0, 0.1, C.black], [0.1, 0.4, C.aqua], [0.4, 0.7, C.gold], [0.7, 1, C.aqua]];
    for (const [a, b, col] of segs) { ctx.fillStyle = col; ctx.fillRect(w * a, y, w * (b - a) + 1, h); }
  }

  // Junkanoo diagonal stripes
  function drawJunkanoo(ctx, y, w, h) {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y, w, h); ctx.clip();
    const cols = [C.aqua, C.gold, C.black], step = h * 0.9;
    for (let i = -2, x = -h; x < w + h; i++, x += step) {
      ctx.fillStyle = cols[((i % 3) + 3) % 3];
      ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + step, y + h); ctx.lineTo(x + step + h, y); ctx.lineTo(x + h, y); ctx.fill();
    }
    ctx.restore();
  }

  // Logo + "LONE SOULJA" lockup; returns its height
  function drawLockup(ctx, x, y, u, theme, sub) {
    const r = 46 * u;
    drawLogo(ctx, x + r, y + r, r);
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    ctx.fillStyle = theme.text; ctx.font = font(FONTS.bebas, 66 * u); spacing(ctx, 3 * u);
    ctx.fillText("LONE SOULJA", x + r * 2 + 22 * u, y + (sub ? 52 : 70) * u);
    if (sub) {
      ctx.fillStyle = theme.accent; ctx.font = font(FONTS.inter, 26 * u); spacing(ctx, 4 * u);
      ctx.fillText(sub.toUpperCase(), x + r * 2 + 24 * u, y + 88 * u);
    }
    spacing(ctx, 0);
    return r * 2;
  }

  /*
   * Quote card.
   * opts: { quote, author, label, tags, handle, theme, font, format, censor }
   */
  function drawQuoteCard(canvas, opts) {
    const fmt = FORMATS[opts.format] || FORMATS.story;
    const th = THEMES[opts.theme] || THEMES.midnight;
    const f = FONTS[opts.font] || FONTS.bebas;
    canvas.width = fmt.w; canvas.height = fmt.h;
    const ctx = canvas.getContext("2d");
    const W = fmt.w, H = fmt.h, u = W / 1080, pad = 90 * u;
    const clean = (s) => (opts.censor === false ? String(s || "") : censor(s || ""));

    // background
    ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, H * 0.75);
    g.addColorStop(0, th.glow); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    drawFlagBand(ctx, 0, W, 18 * u);
    drawJunkanoo(ctx, H - 30 * u, W, 30 * u);

    const top = fmt.safeTop * u, bottom = H - fmt.safeBottom * u;

    // header
    const head = drawLockup(ctx, pad, top, u, th, opts.label);

    // footer: author, tags, handle (laid out upward from the bottom of the safe zone)
    let y = bottom;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    const lines = [];
    if (opts.handle) lines.push({ t: clean(opts.handle), font: font(FONTS.inter, 30 * u), col: th.sub, h: 44 * u });
    if (opts.tags) {
      ctx.font = font(FONTS.inter, 32 * u);
      const tagLines = wrap(ctx, clean(opts.tags), W - pad * 2).slice(0, 2).reverse();
      for (const t of tagLines) lines.push({ t, font: font(FONTS.inter, 32 * u), col: th.accent, h: 46 * u });
    }
    if (opts.author) lines.push({ t: "— " + clean(opts.author), font: font(FONTS.montserrat, 44 * u), col: th.text, h: 72 * u, gap: 14 * u });
    for (const l of lines) { ctx.font = l.font; ctx.fillStyle = l.col; ctx.fillText(l.t, pad, y); y -= l.h + (l.gap || 0); }
    const footTop = y;

    // accent rule above footer
    ctx.fillStyle = th.accent; ctx.fillRect(pad, footTop + 10 * u, 120 * u, 8 * u);

    // quote mark + quote text in the remaining box
    const boxTop = top + head + 70 * u, boxBottom = footTop - 30 * u;
    ctx.fillStyle = th.accent; ctx.font = font(FONTS.playfair, 200 * u);
    ctx.fillText("“", pad - 10 * u, boxTop + 120 * u);
    const qTop = boxTop + 110 * u;
    let text = clean(opts.quote || "");
    if (f.upper) text = text.toUpperCase();
    const { size, lines: ql } = fit(ctx, text, f, W - pad * 2, boxBottom - qTop, 150 * u, 40 * u);
    ctx.font = font(f, size); ctx.fillStyle = th.text;
    const lh = size * f.lh, blockH = ql.length * lh;
    let qy = qTop + Math.max(0, (boxBottom - qTop - blockH) / 2) + size * 0.85;
    for (const l of ql) { ctx.fillText(l, pad, qy); qy += lh; }
    return canvas;
  }

  // ---- Transcript parsing: SRT / VTT, or plain text auto-timed over `duration`
  function toSec(ts) {
    const p = ts.replace(",", ".").split(":").map(Number);
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
  }

  function parseTranscript(raw, duration) {
    const text = String(raw || "").replace(/\r/g, "").trim();
    if (!text) return [];
    const TIME = /((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})/;
    if (TIME.test(text)) {
      const cues = [];
      for (const block of text.split(/\n\s*\n/)) {
        const ls = block.split("\n");
        const i = ls.findIndex((l) => TIME.test(l));
        if (i < 0) continue;
        const m = ls[i].match(TIME);
        const body = ls.slice(i + 1).join(" ").replace(/<[^>]+>/g, "").trim();
        if (body) cues.push({ start: toSec(m[1]), end: toSec(m[2]), text: body });
      }
      return cues.sort((a, b) => a.start - b.start);
    }
    // Plain text: split into 6-word cues, timed by word count across the clip
    const words = text.split(/\s+/).filter(Boolean);
    const per = (duration || words.length * 0.4) / words.length;
    const cues = [];
    for (let i = 0; i < words.length; i += 6) {
      const chunk = words.slice(i, i + 6);
      cues.push({ start: i * per, end: (i + chunk.length) * per, text: chunk.join(" ") });
    }
    return cues;
  }

  /*
   * One video frame.
   * opts: { video, cues, time, duration, title, handle, theme, font, format, capStyle, capPos, fit, censor, progress }
   */
  function drawVideoFrame(canvas, opts) {
    const ctx = canvas.getContext("2d");
    const fmt = FORMATS[opts.format] || FORMATS.story;
    const th = THEMES[opts.theme] || THEMES.midnight;
    const f = FONTS[opts.font] || FONTS.bebas;
    const W = canvas.width, H = canvas.height, u = W / 1080, pad = 70 * u;
    const clean = (s) => (opts.censor === false ? String(s || "") : censor(s || ""));
    const v = opts.video;

    ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
    if (v && v.videoWidth) {
      const vw = v.videoWidth, vh = v.videoHeight;
      const cover = Math.max(W / vw, H / vh);
      const cw = vw * cover, ch = vh * cover;
      if (opts.fit === "fit") {
        // blurred fill behind, full video in the middle
        ctx.save();
        if ("filter" in ctx) ctx.filter = `blur(${Math.round(40 * u)}px)`;
        ctx.drawImage(v, (W - cw) / 2, (H - ch) / 2, cw, ch);
        ctx.restore();
        ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(0, 0, W, H);
        const s = Math.min(W / vw, H / vh);
        ctx.drawImage(v, (W - vw * s) / 2, (H - vh * s) / 2, vw * s, vh * s);
      } else {
        ctx.drawImage(v, (W - cw) / 2, (H - ch) / 2, cw, ch);
      }
    }

    // top shade + brand header inside safe zone
    const sh = ctx.createLinearGradient(0, 0, 0, H * 0.3);
    sh.addColorStop(0, "rgba(0,0,0,.7)"); sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh; ctx.fillRect(0, 0, W, H * 0.3);
    drawFlagBand(ctx, 0, W, 14 * u);
    const top = Math.max(60 * u, fmt.safeTop * u * 0.55);
    const light = { ...th, text: C.white };
    drawLockup(ctx, pad, top, u, light, opts.handle || "");

    // headline banner
    if (opts.title) {
      let t = clean(opts.title); if (f.upper) t = t.toUpperCase();
      const r = fit(ctx, t, f, W - pad * 2 - 40 * u, 200 * u, 76 * u, 36 * u);
      ctx.font = font(f, r.size);
      const lh = r.size * f.lh, bh = r.lines.length * lh + 36 * u, by = top + 120 * u;
      ctx.fillStyle = th.accent; ctx.fillRect(pad, by, 10 * u, bh);
      ctx.fillStyle = "rgba(11,11,11,.78)"; ctx.fillRect(pad + 10 * u, by, W - pad * 2 - 10 * u, bh);
      ctx.fillStyle = C.white; ctx.textAlign = "left";
      let ly = by + 18 * u + r.size * 0.85;
      for (const l of r.lines) { ctx.fillText(l, pad + 32 * u, ly); ly += lh; }
    }

    // captions
    const cue = (opts.cues || []).find((c) => opts.time >= c.start && opts.time < c.end);
    if (cue) drawCaption(ctx, cue, opts, f, th, u, W, H, fmt, clean);

    // progress bar
    if (opts.progress !== false && opts.duration) {
      ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.fillRect(0, H - 10 * u, W, 10 * u);
      ctx.fillStyle = C.gold; ctx.fillRect(0, H - 10 * u, W * Math.min(1, opts.time / opts.duration), 10 * u);
    }
  }

  function drawCaption(ctx, cue, opts, f, th, u, W, H, fmt, clean) {
    const safeBottom = H - fmt.safeBottom * u;
    const cy = opts.capPos === "top" ? H * 0.34 : opts.capPos === "middle" ? H * 0.5 : Math.min(H * 0.7, safeBottom - 60 * u);
    const maxW = W - 140 * u;
    let words = clean(cue.text).split(/\s+/).filter(Boolean);
    if (f.upper || opts.capStyle === "pop") words = words.map((w) => w.toUpperCase());
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";

    if (opts.capStyle === "pop") {
      // 3 words at a time, current word highlighted
      const per = (cue.end - cue.start) / words.length;
      const idx = Math.min(words.length - 1, Math.floor((opts.time - cue.start) / per));
      const start = Math.floor(idx / 3) * 3, group = words.slice(start, start + 3);
      const r = fit(ctx, group.join(" "), f, maxW, 360 * u, 120 * u, 50 * u);
      ctx.font = font(f, r.size);
      const lh = r.size * f.lh;
      let y = cy - ((r.lines.length - 1) * lh) / 2, wi = start;
      for (const line of r.lines) {
        const ws = line.split(" ");
        const space = ctx.measureText(" ").width;
        const total = ws.reduce((a, w) => a + ctx.measureText(w).width, 0) + space * (ws.length - 1);
        let x = W / 2 - total / 2;
        for (const w of ws) {
          const ww = ctx.measureText(w).width, active = wi === idx;
          ctx.save();
          ctx.translate(x + ww / 2, y);
          if (active) ctx.scale(1.08, 1.08);
          ctx.lineWidth = 14 * u; ctx.strokeStyle = C.black; ctx.strokeText(w, 0, 0);
          ctx.fillStyle = active ? C.gold : C.white; ctx.fillText(w, 0, 0);
          ctx.restore();
          x += ww + space; wi++;
        }
        y += lh;
      }
      return;
    }

    const r = fit(ctx, words.join(" "), f, maxW, 300 * u, 72 * u, 36 * u);
    ctx.font = font(f, r.size);
    const lh = r.size * f.lh * (opts.capStyle === "boxed" ? 1.3 : 1);
    let y = cy - ((r.lines.length - 1) * lh) / 2;
    for (const line of r.lines) {
      if (opts.capStyle === "boxed") {
        const w = ctx.measureText(line).width + 40 * u, h = r.size * 1.25;
        ctx.fillStyle = "rgba(11,11,11,.85)"; ctx.fillRect(W / 2 - w / 2, y - h / 2, w, h);
        ctx.fillStyle = th.accent === C.aquaDark ? C.gold : th.accent; ctx.fillRect(W / 2 - w / 2, y - h / 2, 8 * u, h);
        ctx.fillStyle = C.white; ctx.fillText(line, W / 2, y);
      } else {
        ctx.lineWidth = 10 * u; ctx.strokeStyle = C.black; ctx.strokeText(line, W / 2, y);
        ctx.fillStyle = C.white; ctx.fillText(line, W / 2, y);
      }
      y += lh;
    }
  }

  // Share a file via the phone's share sheet, or download it on desktop
  async function shareOrDownload(blob, filename, text) {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); return "shared"; }
      catch (e) { if (e.name === "AbortError") return "cancelled"; }
    }
    download(blob, filename);
    return "downloaded";
  }

  function download(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  const toBlob = (canvas, type = "image/png") => new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not create image"))), type));

  return { C, THEMES, FONTS, FORMATS, censor, loadFonts, drawLogo, drawQuoteCard, parseTranscript, drawVideoFrame, shareOrDownload, download, toBlob };
})();
