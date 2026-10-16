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

  // "Random Thought of the Day" lines from Geno (keep them censored).
  quotes: [
    "Leggings with no a** are technically just long-sleeve panties. I said what I said, and I will NOT be taking questions at this time!",
    "You can't build an empire while arguing with people who still need instructions on shampoo bottles.",
    "Stay humble, stay blessed, and keep your middle finger spiritually available!",
    "Jesus loves you, but even He had to flip a few tables when people started acting stupid. 🙏🏾",
    "I've decided to be the bigger person today, but my inner a**hole has already filed an appeal, the judge is drunk, and the jury is fresh out of f***s to give!",
    "Just because somebody smiles at you doesn't mean they like you.",
    "It's Friday, which means we're officially one bad decision away from another story we won't be able to tell at Thanksgiving!",
    "Have a blessed Friday, and try not to become the reason somebody needs a drink tonight!"
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
    title: "Savage But Blessed",
    date: "2026-10-10",
    duration: "52 min",
    description: "Stay humble, stay blessed, and keep your middle finger spiritually available. Geno on faith, hustle and flipping tables.",
    audio: ""
  },
  {
    number: 2,
    title: "Protect Your Peace",
    date: "2026-09-26",
    duration: "47 min",
    description: "You can't build an empire while arguing with people who need instructions on shampoo bottles. Chasing money and cutting off the noise.",
    audio: ""
  },
  {
    number: 1,
    title: "I Said What I Said",
    date: "2026-09-12",
    duration: "38 min",
    description: "The first episode. Geno \"Smurf\" Collie introduces Lone Soulja: random thoughts, zero filter, and no questions at this time.",
    audio: ""
  }
];
