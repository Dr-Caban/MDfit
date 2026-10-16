(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const canvas = $("canvas");
  const API = SiteAPI.API;
  let handle = "";
  let tab = "quote";

  // ---- Fill selects
  const fill = (sel, obj) => { sel.innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join(""); };
  fill($("format"), Brand.FORMATS);
  fill($("theme"), Brand.THEMES);
  fill($("font"), Brand.FONTS);

  const quotes = (SITE.quotes || []).slice();
  function fillQuotes() {
    $("quote-pick").innerHTML = `<option value="">— Write your own —</option>` +
      quotes.map((q, i) => `<option value="${i}">${Brand.censor(q).slice(0, 60).replace(/&/g, "&amp;").replace(/</g, "&lt;")}${q.length > 60 ? "…" : ""}</option>`).join("");
    if (quotes.length) { $("quote-pick").value = "0"; $("quote-text").value = quotes[0]; }
  }
  fillQuotes();

  const look = () => ({ format: $("format").value, theme: $("theme").value, font: $("font").value, censor: $("censor").checked });

  // ---- Quote cards
  function quoteOpts(format) {
    return {
      ...look(), format: format || $("format").value,
      quote: $("quote-text").value, label: $("quote-label").value,
      author: $("quote-author").value, tags: $("quote-tags").value, handle
    };
  }
  const renderQuote = () => Brand.drawQuoteCard(canvas, quoteOpts());

  const fileName = (fmt) => `lone-soulja-quote-${fmt}.png`;

  $("quote-pick").addEventListener("change", (e) => {
    if (e.target.value !== "") $("quote-text").value = quotes[Number(e.target.value)];
    renderQuote(); syncCaption();
  });
  ["quote-text", "quote-label", "quote-author", "quote-tags"].forEach((id) =>
    $(id).addEventListener("input", () => { renderQuote(); syncCaption(); }));

  $("quote-share").addEventListener("click", async () => {
    renderQuote();
    await Brand.shareOrDownload(await Brand.toBlob(canvas), fileName($("format").value), $("fb-caption").value);
  });
  $("quote-download").addEventListener("click", async () => {
    renderQuote();
    Brand.download(await Brand.toBlob(canvas), fileName($("format").value));
  });
  $("quote-all").addEventListener("click", async () => {
    const off = document.createElement("canvas");
    for (const fmt of Object.keys(Brand.FORMATS)) {
      Brand.drawQuoteCard(off, quoteOpts(fmt));
      Brand.download(await Brand.toBlob(off), fileName(fmt));
      await new Promise((r) => setTimeout(r, 400)); // browsers block rapid multi-downloads
    }
  });

  // ---- PDF exports
  async function pdfFrom(list, name) {
    const msg = $("pdf-msg");
    msg.textContent = "Building PDF…";
    try {
      const canvases = list.map((opts) => Brand.drawQuoteCard(document.createElement("canvas"), opts));
      Brand.download(await Brand.toPdf(canvases), name);
      msg.textContent = `PDF ready: ${canvases.length} ${canvases.length === 1 ? "page" : "pages"}.`;
    } catch (e) { msg.textContent = "PDF failed: " + e.message; }
  }
  $("pdf-one").addEventListener("click", () => pdfFrom([quoteOpts()], `lone-soulja-quote-${$("format").value}.pdf`));
  $("pdf-sizes").addEventListener("click", () => pdfFrom(Object.keys(Brand.FORMATS).map((f) => quoteOpts(f)), "lone-soulja-quote-all-sizes.pdf"));
  $("pdf-book").addEventListener("click", () => {
    if (!quotes.length) { $("pdf-msg").textContent = "No saved quotes yet. Add them in the admin portal (Settings → Quotes)."; return; }
    pdfFrom(quotes.map((q) => ({ ...quoteOpts(), quote: q })), "lone-soulja-quote-book.pdf");
  });

  // ---- Video
  const video = $("video");
  let cues = [], audio = null, rafId = 0, recorder = null, exported = null, exporting = false;

  function sizeVideoCanvas() {
    const fmt = Brand.FORMATS[$("format").value];
    const w = Number($("video-quality").value) === 720 ? 720 : 1080;
    const h = Math.round((fmt.h / fmt.w) * w / 2) * 2; // even numbers for encoders
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }

  function videoOpts() {
    return {
      ...look(), video, cues: $("cap-style").value === "none" ? [] : cues,
      time: video.currentTime || 0, duration: video.duration || 0,
      title: $("video-title").value, handle,
      capStyle: $("cap-style").value, capPos: $("cap-pos").value,
      fit: $("video-fit").value, progress: $("video-progress").checked
    };
  }
  function renderVideo() { sizeVideoCanvas(); Brand.drawVideoFrame(canvas, videoOpts()); }

  function updateCues() {
    cues = Brand.parseTranscript($("transcript").value, video.duration || 0);
    const timed = /-->/.test($("transcript").value);
    $("cue-info").textContent = cues.length
      ? `${cues.length} caption ${cues.length === 1 ? "line" : "lines"} ${timed ? "with exact timing" : "auto-timed across the clip"}.`
      : "No transcript: the video will export without captions.";
    if (tab === "video") renderVideo();
  }

  $("video-file").addEventListener("change", () => {
    const file = $("video-file").files[0];
    if (!file) return;
    stopLoop(); video.pause();
    if (video.src) URL.revokeObjectURL(video.src);
    video.src = URL.createObjectURL(file);
    $("video-done").hidden = true; exported = null; updateFbButton();
    $("video-status").textContent = "Loading video…";
  });

  video.addEventListener("loadedmetadata", () => {
    video.currentTime = Math.min(0.5, video.duration / 2 || 0);
    $("video-preview").disabled = $("video-export").disabled = false;
    $("video-status").textContent = `Loaded: ${video.videoWidth}×${video.videoHeight}, ${video.duration.toFixed(1)}s. The export plays in real time, so keep this tab open.`;
    updateCues();
  });
  video.addEventListener("seeked", () => { if (!exporting && video.paused) renderVideo(); });
  video.addEventListener("error", () => { $("video-status").textContent = "This browser can't play that video file. Try an MP4."; });

  $("transcript").addEventListener("input", updateCues);
  $("transcript-file").addEventListener("change", async () => {
    const f = $("transcript-file").files[0];
    if (f) { $("transcript").value = await f.text(); updateCues(); }
  });
  ["video-title", "video-fit", "video-quality", "video-progress", "cap-style", "cap-pos"].forEach((id) =>
    $(id).addEventListener("input", () => { if (tab === "video") renderVideo(); }));

  // Route the video's audio through Web Audio so it can be recorded (works in Chrome, Safari, Firefox)
  function ensureAudio() {
    if (audio) return audio;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const src = ctx.createMediaElementSource(video);
    const dest = ctx.createMediaStreamDestination();
    src.connect(dest); src.connect(ctx.destination);
    return (audio = { ctx, dest });
  }

  function loop() { renderVideo(); rafId = requestAnimationFrame(loop); }
  function stopLoop() { cancelAnimationFrame(rafId); rafId = 0; }

  $("video-preview").addEventListener("click", async () => {
    if (exporting) return;
    if (!video.paused) { video.pause(); stopLoop(); $("video-preview").textContent = "▶ Preview"; return; }
    const a = ensureAudio(); await a.ctx.resume();
    if (video.ended) video.currentTime = 0;
    await video.play();
    $("video-preview").textContent = "❚❚ Pause";
    loop();
  });
  video.addEventListener("ended", () => { if (!exporting) { stopLoop(); $("video-preview").textContent = "▶ Preview"; } });

  // Prefer H.264 MP4 (what TikTok / Reels / Shorts want). Plain "video/mp4" is only trusted
  // when WebM recording isn't available (older Safari), since Chromium can put VP9 inside MP4.
  function pickMime() {
    if (!window.MediaRecorder) return "";
    const ok = (t) => MediaRecorder.isTypeSupported(t);
    const h264 = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4;codecs=avc1"];
    const webm = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    return h264.find(ok) || (!webm.some(ok) && ok("video/mp4") ? "video/mp4" : "") || webm.find(ok) || "";
  }

  const seek = (t) => new Promise((r) => { video.addEventListener("seeked", r, { once: true }); video.currentTime = t; });

  $("video-export").addEventListener("click", async () => {
    if (!window.MediaRecorder || !canvas.captureStream) {
      $("video-status").textContent = "This browser can't export video. Use Chrome or Safari (desktop or phone)."; return;
    }
    const mime = pickMime();
    exporting = true; exported = null; updateFbButton();
    $("video-done").hidden = true; $("video-export").disabled = true; $("video-preview").disabled = true; $("video-cancel").hidden = false;
    video.pause(); stopLoop();

    try {
      const a = ensureAudio(); await a.ctx.resume();
      sizeVideoCanvas();
      await seek(0);
      renderVideo();
      const stream = canvas.captureStream(30);
      a.dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      const chunks = [];
      recorder = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: canvas.width >= 1080 ? 10e6 : 6e6 });
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const done = new Promise((r) => (recorder.onstop = r));
      recorder.start(250);

      const tick = () => {
        renderVideo();
        $("video-status").textContent = `Exporting… ${Math.min(100, Math.round((video.currentTime / video.duration) * 100))}%. Keep this tab open.`;
        if (exporting) rafId = requestAnimationFrame(tick);
      };
      video.addEventListener("ended", () => { if (recorder && recorder.state !== "inactive") recorder.stop(); }, { once: true });
      await video.play();
      tick();
      await done;
      stopLoop();
      stream.getVideoTracks().forEach((t) => t.stop());

      if (recorder.cancelled) { $("video-status").textContent = "Export cancelled."; return; }
      const type = (recorder.mimeType || mime || "video/webm").split(";")[0];
      exported = new Blob(chunks, { type });
      const mb = (exported.size / 1048576).toFixed(1);
      $("video-status").textContent = `Done: ${type === "video/mp4" ? "MP4" : "WebM"}, ${mb} MB.` +
        (type === "video/mp4" ? "" : " Tip: TikTok/Reels prefer MP4. Export from Safari or a recent Chrome for MP4.");
      $("video-done").hidden = false;
    } catch (e) {
      $("video-status").textContent = "Export failed: " + e.message;
    } finally {
      exporting = false; recorder = null;
      $("video-export").disabled = false; $("video-preview").disabled = false; $("video-cancel").hidden = true;
      $("video-preview").textContent = "▶ Preview";
      updateFbButton();
    }
  });

  $("video-cancel").addEventListener("click", () => {
    if (recorder && recorder.state !== "inactive") { recorder.cancelled = true; video.pause(); recorder.stop(); }
  });

  const videoName = () => `lone-soulja-clip.${exported && exported.type === "video/mp4" ? "mp4" : "webm"}`;
  $("video-share").addEventListener("click", () => exported && Brand.shareOrDownload(exported, videoName(), $("fb-caption").value));
  $("video-download").addEventListener("click", () => exported && Brand.download(exported, videoName()));

  // ---- Tabs
  document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
    tab = b.dataset.tab;
    document.querySelectorAll(".tab").forEach((t) => { t.classList.toggle("active", t === b); t.setAttribute("aria-selected", String(t === b)); });
    document.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== tab));
    if (tab === "quote") { video.pause(); stopLoop(); renderQuote(); } else renderVideo();
    syncCaption(); updateFbButton();
  }));

  ["format", "theme", "font", "censor"].forEach((id) => $(id).addEventListener("input", () => {
    $("safe-note").hidden = $("format").value !== "story";
    tab === "quote" ? renderQuote() : renderVideo();
    syncCaption();
  }));

  // ---- Facebook
  let fbReady = false, captionEdited = false;
  function syncCaption() {
    if (captionEdited) return;
    const clean = (s) => ($("censor").checked ? Brand.censor(s) : s);
    $("fb-caption").value = tab === "quote"
      ? clean(`${$("quote-text").value}\n\n${$("quote-tags").value}`).trim()
      : clean(`${$("video-title").value || "New clip from Lone Soulja 🇧🇸"}\n\n#LoneSoulja #SavageButBlessed`).trim();
  }
  $("fb-caption").addEventListener("input", () => (captionEdited = true));

  function updateFbButton() {
    const has = tab === "quote" || !!exported;
    $("fb-post").disabled = !fbReady || !has || exporting;
    $("fb-post").textContent = tab === "quote" ? "Post this quote card to Facebook" : exported ? "Post exported video to Facebook" : "Export a video first";
  }

  // Posting needs the admin login (shared with /admin)
  async function checkFb() {
    const status = $("fb-status");
    fbReady = false;
    if (!API) { status.textContent = "Backend not connected yet. Set apiUrl in config.js. Share/Download still works."; return updateFbButton(); }
    let configured = false;
    try { configured = (await (await fetch(API + "/api/facebook/status")).json()).configured; }
    catch (e) { status.textContent = "Can't reach the backend. Check apiUrl and that Railway is running."; return updateFbButton(); }
    const loggedIn = !!SiteAPI.session.get();
    $("fb-login").hidden = loggedIn;
    if (!configured) status.textContent = "The Facebook Page isn't connected on Railway yet (FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN).";
    else if (!loggedIn) status.textContent = "Log in to post to the Facebook Page.";
    else { status.textContent = "✅ Connected to your Facebook Page."; fbReady = true; }
    updateFbButton();
  }

  $("fb-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("fb-msg");
    msg.textContent = "Logging in…";
    try {
      await SiteAPI.login($("fb-email").value.trim(), $("fb-password").value);
      $("fb-password").value = ""; msg.textContent = "";
    } catch (err) { msg.textContent = "❌ " + err.message; }
    checkFb();
  });

  $("fb-post").addEventListener("click", async () => {
    const msg = $("fb-msg");
    $("fb-post").disabled = true; msg.textContent = "Posting…";
    try {
      let blob;
      if (tab === "quote") { renderQuote(); blob = await Brand.toBlob(canvas); } else blob = exported;
      if (!blob) { msg.textContent = "Nothing to post yet."; return; }
      if (blob.size > 100 * 1048576) { msg.textContent = "File is over 100 MB. Use 720p or a shorter clip."; return; }
      await SiteAPI.admin(`/api/facebook/post?caption=${encodeURIComponent($("fb-caption").value)}`, {
        method: "POST", headers: { "Content-Type": blob.type }, body: blob
      });
      msg.textContent = "✅ Posted to Facebook!";
    } catch (e) {
      msg.textContent = "❌ " + e.message;
      if (e.status === 401) checkFb();
    } finally { updateFbButton(); }
  });

  // ---- Start
  Brand.loadFonts().then(() => (tab === "quote" ? renderQuote() : renderVideo()));
  renderQuote(); syncCaption(); updateFbButton(); checkFb();

  // Live quotes + social handle from the admin portal
  SiteAPI.getSite().then((data) => {
    if (!data) return;
    handle = data.settings.show.handle || "";
    if (data.settings.quotes && data.settings.quotes.length) {
      quotes.splice(0, quotes.length, ...data.settings.quotes);
      fillQuotes();
    }
    tab === "quote" ? renderQuote() : renderVideo();
    syncCaption();
  });
})();
