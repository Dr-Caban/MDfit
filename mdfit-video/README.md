# MD Fit video branding pipeline

Turns raw exercise demo videos into branded 1080×1920 Reels/TikTok clips with a title,
a muscle-group tag, a logo watermark and burned-in captions with keyword highlights.

## Setup

```bash
apt-get install -y ffmpeg fontconfig fonts-liberation   # ffmpeg needs libfreetype + libass
pip install Pillow gdown
echo 'GROQ_API_KEY=gsk_...' > mdfit-video/.env           # git-ignored; never commit the key
```

The cloud environment's network policy must allow `drive.google.com`,
`drive.usercontent.google.com` and `api.groq.com`.

## Run

```bash
cd mdfit-video
# download the Drive source folder, then brand everything
python3 mdfit_brand_videos.py --drive-folder 1RUFBgRzVg_06Z0_IsWxOoCWMYz9CeKe7
# or brand videos that are already local
python3 mdfit_brand_videos.py --local mdfit_videos/raw --output mdfit_videos/output
```

Options: `--only HIP_THRUST` (filter by filename), `--no-captions`, `--force` (re-render existing outputs).
Outputs are written as `mdfit_videos/output/MDFIT_<name>.mp4`. Upload them to the Drive output folder
`1GFQ4I3E3xrEXtA3w3HAGBtsN-zc-LRr_` by hand; the Drive connector can't take files this large.

## Notes

- Logo: `mdfit_videos/mdfit_logo_180.png` comes from `mdfit-srq/frontend/assets/logo.webp`, and
  `mdfit_logo_circle.png` (the same logo on a grey circle) is built automatically if it's missing.
- Clips that aren't 1080×1920 are scaled to fit, and the empty space is filled with a blurred copy of the clip.
- The exercise names and muscle groups come from `EXERCISE_MAP`. Unknown files fall back to the filename in capitals.
- Layout, colours and timings follow the MD Fit runbook: the title at 15.5% height, captions at MarginV 620,
  the title fading out at 4.5–5.5s, and keywords in blue `#4A9BD9`.
