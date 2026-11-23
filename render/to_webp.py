#!/usr/bin/env python3
"""Convert render/out/*.png (transparent) to assets/exercises-3d/<id>-<start|end>.webp at 1024px,
composited on the app's black (#0A0A0A) so they sit seamlessly on its cards."""
import os, sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check_renders import check  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets', 'exercises-3d')
os.makedirs(OUT, exist_ok=True)
names = sys.argv[1:] or sorted(f[:-4] for f in os.listdir(os.path.join(HERE, 'out')) if f.endswith('.png') and not f.endswith('.mask.png'))
rejected = []
for n in names:
    src = os.path.join(HERE, 'out', n + '.png')
    # Never ship a broken render: anything with dark holes or streaks on the body is skipped.
    blobs = check(src)
    if blobs:
        rejected.append(n)
        print(n, 'REJECTED: dark holes/streaks on the body', blobs[:3])
        continue
    im = Image.open(src).convert('RGBA')
    if im.width != 1024:
        im = im.resize((1024, 1024), Image.LANCZOS)
    bg = Image.new('RGBA', im.size, (10, 10, 10, 255))
    im = Image.alpha_composite(bg, im).convert('RGB')
    # Full quality: lossless WebP (no compression artefacts), at the full 1024 px.
    im.save(os.path.join(OUT, n + '.webp'), 'WEBP', lossless=True, quality=100, method=6)
    print(n, os.path.getsize(os.path.join(OUT, n + '.webp')) // 1024, 'KB')

if rejected:
    print('rejected:', ', '.join(rejected))
    sys.exit(1)
