#!/usr/bin/env python3
"""Convert render/out/*.png (transparent) to assets/exercises-3d/<id>-<start|end>.webp at 1024px,
composited on the app's black (#0A0A0A) so they sit seamlessly on its cards."""
import os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets', 'exercises-3d')
os.makedirs(OUT, exist_ok=True)
names = sys.argv[1:] or sorted(f[:-4] for f in os.listdir(os.path.join(HERE, 'out')) if f.endswith('.png'))
for n in names:
    im = Image.open(os.path.join(HERE, 'out', n + '.png')).convert('RGBA')
    if im.width != 1024:
        im = im.resize((1024, 1024), Image.LANCZOS)
    bg = Image.new('RGBA', im.size, (10, 10, 10, 255))
    im = Image.alpha_composite(bg, im).convert('RGB')
    im.save(os.path.join(OUT, n + '.webp'), 'WEBP', quality=82, method=6)
    print(n, os.path.getsize(os.path.join(OUT, n + '.webp')) // 1024, 'KB')
