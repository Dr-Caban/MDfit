// Podcast RSS feed (Apple Podcasts / Spotify / Amazon Music / YouTube Music compatible).
const esc = (s) => String(s ?? "")
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const hms = (sec) => {
  sec = Math.round(sec || 0);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(s).padStart(2, "0");
};

function coverUrl(settings, siteUrl) {
  return settings.show.coverUrl || (siteUrl ? `${siteUrl}/assets/cover-3000.jpg` : "");
}

function buildFeed({ settings, episodes, siteUrl, feedUrl }) {
  const s = settings.show;
  const cover = coverUrl(settings, siteUrl);
  const link = siteUrl || feedUrl;
  const items = episodes.filter((e) => e.platforms.includes("podcast"))
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
    .map((e) => `    <item>
      <title>${esc(e.title)}</title>
      <description>${esc(e.description)}</description>
      <itunes:summary>${esc(e.description)}</itunes:summary>
      <enclosure url="${esc(e.audioUrl)}" length="${e.audioBytes}" type="${esc(e.audioType)}"/>
      <guid isPermaLink="false">${esc(e.id)}</guid>
      <pubDate>${new Date(e.publishedAt).toUTCString()}</pubDate>
      <link>${esc(siteUrl ? `${siteUrl}/#ep-${e.id}` : link)}</link>
${e.duration ? `      <itunes:duration>${hms(e.duration)}</itunes:duration>\n` : ""}      <itunes:explicit>${e.explicit ? "true" : "false"}</itunes:explicit>
      <itunes:episodeType>full</itunes:episodeType>
${e.number ? `      <itunes:episode>${e.number}</itunes:episode>\n` : ""}${e.season ? `      <itunes:season>${e.season}</itunes:season>\n` : ""}${e.imageUrl ? `      <itunes:image href="${esc(e.imageUrl)}"/>\n` : ""}    </item>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${esc(s.title)}</title>
    <link>${esc(link)}</link>
    <atom:link href="${esc(feedUrl)}" rel="self" type="application/rss+xml"/>
    <language>${esc(s.language || "en")}</language>
    <description>${esc(s.description)}</description>
    <itunes:summary>${esc(s.description)}</itunes:summary>
    <itunes:author>${esc(s.author)}</itunes:author>
    <itunes:owner>
      <itunes:name>${esc(s.author)}</itunes:name>
${s.email ? `      <itunes:email>${esc(s.email)}</itunes:email>\n` : ""}    </itunes:owner>
${cover ? `    <itunes:image href="${esc(cover)}"/>\n    <image><url>${esc(cover)}</url><title>${esc(s.title)}</title><link>${esc(link)}</link></image>\n` : ""}    <itunes:category text="${esc(s.category)}"/>
    <itunes:explicit>${s.explicit ? "true" : "false"}</itunes:explicit>
    <itunes:type>episodic</itunes:type>
${items}
  </channel>
</rss>
`;
}

// What still needs doing before submitting the feed to Spotify / Apple
function feedIssues({ settings, episodes, siteUrl }) {
  const issues = [];
  if (!settings.show.email) issues.push("Add a contact email (Settings → Show). Spotify and Apple email it to verify you own the show.");
  if (!coverUrl(settings, siteUrl)) issues.push("Set SITE_URL on Railway (or a cover art link) so the feed has cover art.");
  if (!siteUrl) issues.push("Set SITE_URL on Railway to your Vercel address.");
  if (!episodes.some((e) => e.platforms.includes("podcast"))) issues.push("Publish at least one episode to podcast apps. Spotify and Apple need one before you can submit.");
  return issues;
}

module.exports = { buildFeed, feedIssues, coverUrl, esc, hms };
