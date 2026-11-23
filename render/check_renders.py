"""Flag renders with dark holes, cracks or streaks on the body, so broken images never reach the app.

  python render/check_renders.py render/out/*.png      # exit code 1 if any image fails

Works on the transparent PNGs from render.py. Inside the figure (alpha, eroded so the outline
doesn't count), a pixel is "suspicious" when it is much darker than its neighbourhood
(< 45% of the local median brightness) and dark in absolute terms. A connected suspicious blob
bigger than MIN_AREA pixels (scaled to 1024 px) fails when it is either see-through (reaches
near-background black: a hole or crack) or a thick dark patch. Thin, not-quite-black lines where
the body presses on a seat are contact shadows and pass.
"""
import sys

import numpy as np
from PIL import Image, ImageFilter

MIN_AREA = 40          # pixels at 1024 px
RATIO = 0.45
ABS_DARK = 70          # 0-255 luminance
SEE_THROUGH = 24       # this dark = background showing through (app black is 10)


def _components(mask):
    """Sizes and boxes of 8-connected True regions (small masks only, pure Python)."""
    h, w = mask.shape
    seen = np.zeros_like(mask)
    out = []
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if seen[y0, x0]:
            continue
        stack = [(y0, x0)]
        seen[y0, x0] = True
        pts = []
        while stack:
            y, x = stack.pop()
            pts.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        a = np.array(pts)
        out.append((len(pts), a[:, 1].min(), a[:, 0].min(), a[:, 1].max(), a[:, 0].max()))
    return out


def check(path):
    im = Image.open(path).convert('RGBA')
    scale = im.width / 1024
    alpha = im.getchannel('A')
    mask_path = path[:-4] + '.mask.png' if path.endswith('.png') else None
    import os
    if mask_path and os.path.exists(mask_path):
        # Body-only visibility from render.py: equipment and contact edges are excluded.
        alpha = Image.open(mask_path).convert('RGBA').getchannel('A').point(lambda v: 255 if v > 128 else 0)
        alpha = alpha.filter(ImageFilter.MinFilter(5))
    elif np.array(alpha).min() == 255:
        # Already composited on black (the app's WebPs): the figure is whatever isn't background.
        alpha = im.convert('L').point(lambda v: 255 if v > 30 else 0)
        alpha = alpha.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))  # close small holes in the mask itself
    inside = np.array(alpha.filter(ImageFilter.MinFilter(9))) > 250
    lum_img = im.convert('L')
    lum = np.array(lum_img).astype(np.float32)
    med = np.array(lum_img.filter(ImageFilter.MedianFilter(21))).astype(np.float32)
    sus = inside & (lum < RATIO * med) & (lum < ABS_DARK)
    blobs = []
    for area, x0, y0, x1, y1 in _components(sus):
        if area < MIN_AREA * scale * scale:
            continue
        w, h = x1 - x0 + 1, y1 - y0 + 1
        darkest = lum[y0:y1 + 1, x0:x1 + 1][sus[y0:y1 + 1, x0:x1 + 1]].min()
        see_through = darkest < SEE_THROUGH
        thick = min(w, h) >= 6 * scale and area / (w * h) > 0.35
        if see_through or thick:
            blobs.append((area, x0, y0, x1, y1))
    return blobs


def main(paths):
    paths = [p for p in paths if not p.endswith('.mask.png')]
    failed = 0
    for p in paths:
        blobs = check(p)
        if blobs:
            failed += 1
            worst = max(blobs)
            print(f'FAIL {p}: {len(blobs)} dark hole/streak area(s), largest {worst[0]} px at x={worst[1]}-{worst[3]}, y={worst[2]}-{worst[4]}')
        else:
            print(f'ok   {p}')
    print(f'{len(paths) - failed}/{len(paths)} passed')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
