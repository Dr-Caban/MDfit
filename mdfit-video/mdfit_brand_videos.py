#!/usr/bin/env python3
"""MD Fit exercise video branding pipeline.

Takes raw exercise demo videos, frames them to 1080x1920, and burns in:
  - exercise title + muscle-group tag (fade in, fade out at 4.5-5.5s)
  - MD Fit logo watermark on a grey circle (top-left, 80% opacity)
  - 4-word dynamic captions from Groq Whisper, training cues highlighted blue

Usage:
  python3 mdfit_brand_videos.py --local mdfit_videos/raw --output mdfit_videos/output
  python3 mdfit_brand_videos.py --drive-folder 1RUFBgRzVg_06Z0_IsWxOoCWMYz9CeKe7 ...

Needs GROQ_API_KEY in the environment (or in a .env file next to this script)
for captions; pass --no-captions to skip them. See MDFIT_PIPELINE_RUNBOOK.md.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_LOGO = HERE.parent / "mdfit-srq" / "frontend" / "assets" / "logo.webp"

OUT_W, OUT_H = 1080, 1920

# Brand palette
WHITE = "0xFFFFFF"
SILVER = "0xC0C0C0@0.9"
ASS_BLUE = "&H00D9BD4A&"   # #4A9BD9 in ASS &HAABBGGRR order
ASS_WHITE = "&H00FFFFFF&"

TITLE_SIZE = 52
TAG_SIZE = 28
CAPTION_SIZE = 48
CAPTION_MARGIN_V = 620     # at 1920px tall, puts captions at ~65% of frame
WORDS_PER_CAPTION = 4

TITLE_FONTS = ["Montserrat:style=Bold", "Liberation Sans:style=Bold",
               "Inter:style=Bold", "DejaVu Sans:style=Bold"]
CAPTION_FONTS = ["Helvetica Neue:style=Bold", "Helvetica:style=Bold",
                 "Liberation Sans:style=Bold", "Carlito:style=Bold"]

KEYWORDS = {
    "squeeze", "hold", "slow", "control", "stretch", "push", "pull", "drive",
    "extend", "flex", "contract", "engage", "brace", "core", "neutral",
    "explosive", "pause", "rep", "reps", "sets", "seconds", "tempo",
    "eccentric", "concentric", "isometric", "lock", "tight", "full", "range",
    "motion", "hip", "knee", "ankle", "shoulder", "spine",
}

EXERCISE_MAP = {
    "HP_LN_LUNGES_STR":           ("LUNGES",                "LEGS"),
    "HP_LN_STEP_UP_STR":          ("STEP UPS",              "LEGS"),
    "SP_CO_GHD_SIT_UP_MOB":       ("GHD SIT UPS",           "CORE"),
    "PEGBOARD_CLIMB":             ("PEGBOARD CLIMB",        "UPPER BODY"),
    "CO_RT_LANDMINE_PRESS_TWIST": ("LANDMINE PRESS TWIST",  "CORE / SHOULDERS"),
    "FB_MOB_SPIDER_KICK":         ("SPIDER KICKS",          "FULL BODY"),
    "LB_DR_SLED_PUSH_PULL":       ("SLED PUSH & PULL",      "LEGS / CONDITIONING"),
    "HP_HN_HIP_THRUST_MOB":       ("HIP THRUSTS",           "GLUTES"),
    "SH_PU_PIKE_PUSH_UP_STR":     ("PIKE PUSH UPS",         "SHOULDERS"),
    "SH_RA_LAT_TO_FRONT_RAISE":   ("LAT TO FRONT RAISE",    "SHOULDERS"),
    "SH_ST_LATERAL_RAISE_STR":    ("LATERAL RAISES",        "SHOULDERS"),
    "SP_GT_PIKE_BEAR_WALK_MOB":   ("PIKE BEAR WALK",        "FULL BODY"),
    "SP_MOB_PIKE_FORWARD_FOLD":   ("PIKE FORWARD FOLD",     "HAMSTRINGS / MOBILITY"),
    "Wkot_generator_intro":       ("WORKOUT GENERATOR",     "INTRO"),
}

VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".mkv"}


def log(msg):
    print(msg, flush=True)


def load_dotenv():
    env_file = HERE / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, val = line.split("=", 1)
            os.environ.setdefault(key.strip(), val.strip().strip('"\''))


def find_font(candidates):
    """Return (family, path) of the first candidate fontconfig actually has."""
    for pattern in candidates:
        want = pattern.split(":")[0].lower()
        r = subprocess.run(["fc-match", "-f", "%{family}|%{file}", pattern],
                           capture_output=True, text=True)
        family, _, path = r.stdout.partition("|")
        if path and want in family.lower():
            return family.split(",")[0], path
    r = subprocess.run(["fc-match", "-f", "%{family}|%{file}", "sans:bold"],
                       capture_output=True, text=True)
    family, _, path = r.stdout.partition("|")
    return family.split(",")[0], path


def lookup_exercise(stem):
    for prefix in sorted(EXERCISE_MAP, key=len, reverse=True):
        if stem.upper().startswith(prefix.upper()):
            return EXERCISE_MAP[prefix]
    return stem.replace("_", " ").upper(), ""


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format",
                        "-of", "json", str(path)], capture_output=True, text=True, check=True)
    info = json.loads(r.stdout)
    video = next(s for s in info["streams"] if s["codec_type"] == "video")
    has_audio = any(s["codec_type"] == "audio" for s in info["streams"])
    w, h = int(video["width"]), int(video["height"])
    rotation = 0
    for sd in video.get("side_data_list", []):
        rotation = int(sd.get("rotation", 0) or 0)
    rotation = rotation or int(video.get("tags", {}).get("rotate", 0) or 0)
    if abs(rotation) in (90, 270):
        w, h = h, w
    return w, h, has_audio


# ---------------------------------------------------------------- logo

def ensure_logo(logo_dir):
    """Build mdfit_logo_circle.png (logo on a grey circle) if it's missing."""
    logo_dir.mkdir(parents=True, exist_ok=True)
    circle_path = logo_dir / "mdfit_logo_circle.png"
    if circle_path.exists():
        return circle_path

    from PIL import Image, ImageDraw

    raw_path = logo_dir / "mdfit_logo_180.png"
    if not raw_path.exists():
        if not REPO_LOGO.exists():
            sys.exit(f"No logo: put mdfit_logo_180.png in {logo_dir}")
        Image.open(REPO_LOGO).convert("RGBA").resize((180, 180), Image.LANCZOS).save(raw_path)
        log(f"  made {raw_path} from {REPO_LOGO}")

    logo = Image.open(raw_path).convert("RGBA")
    circle = Image.new("RGBA", (200, 200), (0, 0, 0, 0))
    ImageDraw.Draw(circle).ellipse([0, 0, 199, 199], fill=(60, 60, 60, 180))
    circle.paste(logo, ((200 - logo.width) // 2, (200 - logo.height) // 2), logo)
    circle.save(circle_path)
    log(f"  made {circle_path}")
    return circle_path


# ---------------------------------------------------------------- captions

def transcribe(video, workdir, api_key):
    """Return Groq Whisper word list [{word, start, end}, ...]."""
    audio = workdir / "audio.flac"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(video), "-vn",
                    "-ac", "1", "-ar", "16000", str(audio)], check=True)
    r = subprocess.run([
        "curl", "-sS", "--fail-with-body", "--retry", "3",
        "https://api.groq.com/openai/v1/audio/transcriptions",
        "-H", f"Authorization: Bearer {api_key}",
        "-F", f"file=@{audio}",
        "-F", "model=whisper-large-v3",
        "-F", "response_format=verbose_json",
        "-F", "timestamp_granularities[]=word",
    ], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"Groq transcription failed: {r.stderr.strip()} {r.stdout[:300]}")
    return json.loads(r.stdout).get("words", [])


def ass_time(t):
    cs = int(round(max(t, 0) * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def caption_text(words):
    out = []
    for w in words:
        word = w["word"].strip().upper()
        word = word.replace("\\", "").replace("{", "(").replace("}", ")")
        if re.sub(r"[^a-z]", "", word.lower()) in KEYWORDS:
            word = f"{{\\c{ASS_BLUE}}}{word}{{\\c{ASS_WHITE}}}"
        out.append(word)
    return " ".join(out)


def write_ass(words, path, font_family, height):
    margin_v = round(CAPTION_MARGIN_V * height / OUT_H)
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {OUT_W}
PlayResY: {OUT_H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,{font_family},{CAPTION_SIZE},&H00FFFFFF&,&H000000FF&,&H00000000&,&H80000000&,-1,0,0,0,100,100,1,0,1,3,1.5,2,40,40,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    groups = [words[i:i + WORDS_PER_CAPTION] for i in range(0, len(words), WORDS_PER_CAPTION)]
    lines = []
    for i, g in enumerate(groups):
        start, end = g[0]["start"], g[-1]["end"]
        # Bridge short gaps so captions don't flicker between groups
        if i + 1 < len(groups) and groups[i + 1][0]["start"] - end < 0.3:
            end = groups[i + 1][0]["start"]
        lines.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Caption,,0,0,0,,{caption_text(g)}")
    path.write_text(header + "\n".join(lines) + "\n", encoding="utf-8")
    return len(lines)


# ---------------------------------------------------------------- ffmpeg

def ff_escape_text(s):
    """Escape a string for a single-quoted drawtext text= value."""
    return (s.replace("\\", "\\\\\\\\").replace("'", "’")
             .replace(":", "\\:").replace("%", "\\%"))


def ff_escape_path(p):
    return str(p).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")


FADE = "if(lt(t,{d}+0.5),max(0,(t-{d})/0.5),if(lt(t,4.5),1,if(lt(t,5.5),1-(t-4.5)/1.0,0)))"


def build_filter(src_w, src_h, title, tag, title_font, ass_path):
    # Frame to 1080x1920: fit the clip, fill any bars with a blurred copy of itself
    if (src_w, src_h) == (OUT_W, OUT_H):
        frame = "[0:v]setsar=1[framed]"
    else:
        frame = (
            "[0:v]split[bgsrc][fgsrc];"
            f"[bgsrc]scale={OUT_W}:{OUT_H}:force_original_aspect_ratio=increase,"
            f"crop={OUT_W}:{OUT_H},boxblur=30:2[bg];"
            f"[fgsrc]scale={OUT_W}:{OUT_H}:force_original_aspect_ratio=decrease[fg];"
            "[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[framed]"
        )

    font = ff_escape_path(title_font)
    tag_y = f"h*0.155+{TITLE_SIZE}+18"
    chain = [
        "drawbox=x=0:y=ih*0.145:w=iw:h=ih*0.065:color=black@0.20:t=fill:enable='lt(t,5.5)'",
        f"drawtext=fontfile='{font}':text='{ff_escape_text(title)}':fontsize={TITLE_SIZE}"
        f":fontcolor={WHITE}:shadowcolor=black:shadowx=3:shadowy=3"
        f":x=(w-text_w)/2:y=h*0.155:alpha='{FADE.format(d=0)}'",
    ]
    if tag:
        chain.append(
            f"drawtext=fontfile='{font}':text='{ff_escape_text(f'──  {tag}  ──')}':fontsize={TAG_SIZE}"
            f":fontcolor={SILVER}:x=(w-text_w)/2:y={tag_y}:alpha='{FADE.format(d=0.2)}'"
        )

    graph = [
        frame,
        "[framed]" + ",".join(chain) + "[branded]",
        "[1:v]format=rgba,colorchannelmixer=aa=0.8[logo]",
        "[branded][logo]overlay=30:H*0.16" + ("[pre]" if ass_path else "[out]"),
    ]
    if ass_path:
        graph.append(f"[pre]ass='{ff_escape_path(ass_path)}'[out]")
    return ";".join(graph)


def brand_video(src, dst, logo, title_font, caption_family, api_key, captions, workdir):
    stem = src.stem
    title, tag = lookup_exercise(stem)
    src_w, src_h, has_audio = probe(src)
    log(f"\n▶ {src.name}  ({src_w}x{src_h})  →  {title} / {tag or '-'}")

    ass_path = None
    caption_note = "off"
    if captions and has_audio:
        words = transcribe(src, workdir, api_key)
        if words:
            ass_path = workdir / "captions.ass"
            n = write_ass(words, ass_path, caption_family, OUT_H)
            caption_note = f"{n} captions from {len(words)} words"
        else:
            caption_note = "no speech detected"
    elif captions:
        caption_note = "no audio track"
    log(f"  captions: {caption_note}")

    tmp = dst.with_suffix(".part.mp4")
    cmd = [
        "ffmpeg", "-y", "-v", "error", "-stats",
        "-i", str(src), "-i", str(logo),
        "-filter_complex", build_filter(src_w, src_h, title, tag, title_font, ass_path),
        "-map", "[out]", "-map", "0:a?",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        str(tmp),
    ]
    subprocess.run(cmd, check=True)
    tmp.rename(dst)
    log(f"  ✓ {dst}  ({dst.stat().st_size / 1e6:.1f} MB)")
    return caption_note


def download_drive_folder(folder_id, dest):
    dest.mkdir(parents=True, exist_ok=True)
    subprocess.run(["gdown", "--folder", "--id", folder_id, "-O", str(dest), "--remaining-ok"],
                   check=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--local", type=Path, help="folder of raw videos")
    src.add_argument("--drive-folder", help="Google Drive folder ID to download with gdown first")
    ap.add_argument("--raw", type=Path, default=HERE / "mdfit_videos" / "raw",
                    help="where --drive-folder downloads go")
    ap.add_argument("--output", type=Path, default=HERE / "mdfit_videos" / "output")
    ap.add_argument("--logo-dir", type=Path, default=HERE / "mdfit_videos")
    ap.add_argument("--only", help="only process files whose name contains this text")
    ap.add_argument("--no-captions", action="store_true")
    ap.add_argument("--force", action="store_true", help="re-render outputs that already exist")
    args = ap.parse_args()

    load_dotenv()
    api_key = os.environ.get("GROQ_API_KEY", "")
    captions = not args.no_captions
    if captions and not api_key:
        sys.exit("GROQ_API_KEY is not set (env or mdfit-video/.env). Use --no-captions to skip captions.")

    raw_dir = args.local
    if args.drive_folder:
        download_drive_folder(args.drive_folder, args.raw)
        raw_dir = args.raw

    videos = sorted(p for p in raw_dir.rglob("*") if p.suffix.lower() in VIDEO_EXTS
                    and not p.name.startswith("MDFIT_") and ".part" not in p.name)
    if args.only:
        videos = [v for v in videos if args.only.lower() in v.name.lower()]
    if not videos:
        sys.exit(f"No videos found in {raw_dir}")

    args.output.mkdir(parents=True, exist_ok=True)
    logo = ensure_logo(args.logo_dir)
    title_family, title_font = find_font(TITLE_FONTS)
    caption_family, caption_font = find_font(CAPTION_FONTS)
    log(f"Title font:   {title_family}  ({title_font})")
    log(f"Caption font: {caption_family}  ({caption_font})")
    log(f"{len(videos)} video(s) to process")

    results = []
    for v in videos:
        dst = args.output / f"MDFIT_{v.stem}.mp4"
        if dst.exists() and not args.force:
            log(f"\n- skip {v.name} (exists: {dst.name})")
            results.append((v.name, "skipped (exists)"))
            continue
        with tempfile.TemporaryDirectory() as td:
            try:
                note = brand_video(v, dst, logo, title_font, caption_family, api_key, captions, Path(td))
                results.append((v.name, f"ok, captions {note}"))
            except Exception as e:  # keep going; report at the end
                log(f"  ✗ {e}")
                results.append((v.name, f"FAILED: {e}"))

    log("\nSummary")
    for name, status in results:
        log(f"  {name}: {status}")
    if any(s.startswith("FAILED") for _, s in results):
        sys.exit(1)


if __name__ == "__main__":
    main()
