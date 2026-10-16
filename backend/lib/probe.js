// Checks a real audio/image URL before it goes in the feed: reachable, right type, and its size
// (Apple/Spotify need the exact byte length in the RSS enclosure).
const AUDIO_EXT = { mp3: "audio/mpeg", m4a: "audio/x-m4a", mp4: "audio/mp4", aac: "audio/aac", wav: "audio/wav" };

async function probe(url, { timeoutMs = 15000, kind = "audio" } = {}) {
  const signal = AbortSignal.timeout(timeoutMs);
  let r;
  try {
    r = await fetch(url, { method: "HEAD", redirect: "follow", signal });
    if (!r.ok || !r.headers.get("content-length")) {
      // Some hosts don't support HEAD: ask for the first byte instead
      r = await fetch(url, { method: "GET", redirect: "follow", headers: { Range: "bytes=0-0" }, signal });
      if (r.body) r.body.cancel().catch(() => {});
    }
  } catch (e) {
    throw new Error(e.name === "TimeoutError" ? "The link took too long to respond." : "Couldn't reach that link.");
  }
  if (!r.ok) throw new Error(`The link returned an error (${r.status}).`);

  let bytes = 0;
  const range = r.headers.get("content-range");
  if (range && /\/(\d+)$/.test(range)) bytes = Number(range.match(/\/(\d+)$/)[1]);
  else if (r.status === 200) bytes = Number(r.headers.get("content-length") || 0);

  let type = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const ext = (new URL(r.url || url).pathname.split(".").pop() || "").toLowerCase();
  if (kind === "audio") {
    if (!type.startsWith("audio/") && type !== "video/mp4") {
      if ((type === "application/octet-stream" || type === "binary/octet-stream" || !type) && AUDIO_EXT[ext]) type = AUDIO_EXT[ext];
      else throw new Error(`That link isn't an audio file (it's ${type || "unknown"}). Use a direct link to the .mp3.`);
    }
    if (!bytes) throw new Error("Couldn't read the audio file's size from that link.");
  } else if (kind === "image" && !type.startsWith("image/")) {
    throw new Error(`That link isn't an image (it's ${type || "unknown"}).`);
  }
  return { bytes, type };
}

module.exports = { probe };
