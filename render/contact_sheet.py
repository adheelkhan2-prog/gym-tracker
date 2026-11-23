"""Build review contact sheets (start + end for every exercise) and a failures list.

  python render/contact_sheet.py [report-*.json ...]

Writes render/review/contact-sheet-<n>.jpg (24 exercises per page) and render/review/RESULTS.md.
"""
import glob
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets', 'exercises-3d')
OUT = os.path.join(HERE, 'review')
THUMB = 220
COLS = 4          # exercises per row (each shows start + end)
PER_PAGE = 24


def main(reports):
    os.makedirs(OUT, exist_ok=True)
    names = {e['id']: e['name'] for e in json.load(open(os.path.join(HERE, 'exercises.json')))}
    ok, failed = [], {}
    for r in reports:
        d = json.load(open(r))
        ok += d['ok']
        failed.update(d['failed'])
    # The user's current split first (in workout order), then everything else by name.
    first = json.load(open(os.path.join(HERE, 'review-order.json')))['first'] if os.path.exists(os.path.join(HERE, 'review-order.json')) else []
    rank = {ex: i for i, ex in enumerate(first)}
    ok = sorted(set(ok), key=lambda i: (0, rank[i]) if i in rank else (1, names.get(i, i)))
    try:
        font = ImageFont.truetype('DejaVuSans.ttf', 15)
    except OSError:
        font = ImageFont.load_default()
    pages = [ok[i:i + PER_PAGE] for i in range(0, len(ok), PER_PAGE)]
    for pi, page in enumerate(pages, 1):
        rows = (len(page) + COLS - 1) // COLS
        cell_w, cell_h = THUMB * 2 + 16, THUMB + 30
        sheet = Image.new('RGB', (COLS * cell_w, rows * cell_h), (10, 10, 10))
        d = ImageDraw.Draw(sheet)
        for i, ex in enumerate(page):
            x, y = (i % COLS) * cell_w, (i // COLS) * cell_h
            for j, f in enumerate(('start', 'end')):
                p = os.path.join(ASSETS, f'{ex}-{f}.webp')
                if os.path.exists(p):
                    im = Image.open(p).convert('RGB').resize((THUMB, THUMB), Image.LANCZOS)
                    sheet.paste(im, (x + j * THUMB + 4, y + 26))
            tag = 'YOUR SPLIT · ' if ex in rank else ''
            d.text((x + 6, y + 5), f'{tag}{names.get(ex, ex)}  ({ex})', fill=(200, 255, 46) if ex in rank else (230, 230, 235), font=font)
        sheet.save(os.path.join(OUT, f'contact-sheet-{pi}.jpg'), quality=88)
    lines = ['# Clay render results', '', f'Rendered and passed the check: {len(ok)}', f'Failed or not rendered: {len(failed)}', '']
    if failed:
        lines += ['These keep their free-exercise-db photo:', '']
        lines += [f'- {names.get(k, k)} (`{k}`): {v}' for k, v in sorted(failed.items())]
    open(os.path.join(OUT, 'RESULTS.md'), 'w').write('\n'.join(lines) + '\n')
    print('\n'.join(lines))


if __name__ == '__main__':
    main(sys.argv[1:] or glob.glob(os.path.join(HERE, 'out', 'report-*.json')))
