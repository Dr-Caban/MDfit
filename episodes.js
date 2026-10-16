/*
 * ============================================================
 *  LONE SOULJA — SITE CONTENT
 *  Edit this file to add episodes and update links.
 *  Newest episode goes FIRST in the EPISODES list.
 * ============================================================
 */

const SITE = {
  email: "booking@lonesoulja.com", // TODO: replace with real email

  // Leave a url as "" to hide that button.
  platforms: [
    { name: "Spotify",         url: "https://open.spotify.com/" },
    { name: "Apple Podcasts",  url: "https://podcasts.apple.com/" },
    { name: "YouTube",         url: "https://youtube.com/" },
    { name: "Amazon Music",    url: "https://music.amazon.com/podcasts" },
    { name: "RSS",             url: "" }
  ],

  socials: [
    { name: "Instagram", url: "https://instagram.com/" },
    { name: "TikTok",    url: "https://tiktok.com/" },
    { name: "X",         url: "https://x.com/" }
  ]
};

/*
 * audio: path or URL to an .mp3 (e.g. "audio/ep3.mp3" or a hosting link).
 *        Leave "" if not uploaded yet — the site will show "Coming soon".
 * date:  YYYY-MM-DD
 */
const EPISODES = [
  {
    number: 3,
    title: "Standing On My Own",
    date: "2026-10-10",
    duration: "52 min",
    description: "What it really takes to go solo in the 242 — the lonely nights, the come-up, and staying true to yourself.",
    audio: ""
  },
  {
    number: 2,
    title: "Junkanoo In The Blood",
    date: "2026-09-26",
    duration: "47 min",
    description: "Cowbells, goatskin drums and Boxing Day mornings. We break down why Junkanoo is more than a parade.",
    audio: ""
  },
  {
    number: 1,
    title: "Welcome To The Front Line",
    date: "2026-09-12",
    duration: "38 min",
    description: "The first episode. Who is Lone Soulja, why this podcast, and what's coming next for the show.",
    audio: ""
  }
];
