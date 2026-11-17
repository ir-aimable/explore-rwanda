#!/usr/bin/env python3
"""Builds the web images in client/public/images from the full-size originals in client/images-src.

Originals stay out of public/ (they are 1-3 MB each and would be deployed as-is). Each output is a
WebP at the width(s) the page actually needs; the UI picks the right one with srcset.

    python3 client/scripts/optimize-images.py        (needs Pillow: pip install Pillow)

Add a new photo: put the original in images-src/, add a line to JOBS, run the script.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / 'images-src', ROOT / 'public' / 'images'

# original file -> (output name, [widths]); the largest width is saved as <name>.webp, smaller ones as <name>-<w>.webp
JOBS = {
    'hero.jpg': ('hero', [1600, 800]),
    'hero3.jpg': ('hero3', [1600, 800]),
    'destinations-hero.jpg': ('destinations-hero', [1600, 800]),
    'trips-hero.jpg': ('trips-hero', [1600, 800]),
    'about.jpg': ('about', [1000, 600]),
    'auth.jpg': ('auth', [940, 600]),
    'logo.png': ('logo', [160]),                     # shown ~50px wide; 160px covers 3x screens
    'assistant.png': ('assistant', [400]),           # shown up to ~130px wide
    'assistant-icon.png': ('assistant-icon', [80]),  # small inline icon
}

def save(im: Image.Image, width: int, path: Path):
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    alpha = im.mode in ('RGBA', 'LA')
    im.save(path, 'WEBP', quality=80 if alpha else 72, method=6, **({'exact': False} if alpha else {}))
    return path.stat().st_size

for src, (name, widths) in JOBS.items():
    im = Image.open(SRC / src)
    im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
    for k, w in enumerate(sorted(widths, reverse=True)):
        out = OUT / (f'{name}.webp' if k == 0 else f'{name}-{w}.webp')
        print(f'{out.relative_to(ROOT)}: {save(im, w, out) // 1024} KB')
