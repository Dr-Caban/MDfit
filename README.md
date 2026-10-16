# Lone Soulja Podcast Website

Static site with Bahamian branding (aquamarine, gold, black). It has no build step.

## Run locally
Open `index.html` in a browser, or run `python3 -m http.server` and visit http://localhost:8000.

## Update content
Edit **`episodes.js`**:
- `EPISODES`: add new episodes at the top. Set `audio` to an `.mp3` path or URL. If it's empty, the episode shows "Coming soon".
- `SITE.platforms` / `SITE.socials`: paste your real show links. If a `url` is empty, that button is hidden.
- `SITE.email`: the booking/contact email.

## Files
- `index.html`: page structure
- `styles.css`: branding and layout
- `script.js`: episode rendering, search, sticky audio player, mobile menu, newsletter form
- `assets/logo.svg`: logo (Bahamas flag + mic)

## Deploy
Works as-is on GitHub Pages, Netlify or Vercel.
The newsletter form only works on the front end. Connect it to Mailchimp, ConvertKit or Formspree to collect emails.
