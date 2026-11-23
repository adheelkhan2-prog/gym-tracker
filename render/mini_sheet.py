"""Mini contact sheet for a re-render round (start + end, large thumbnails).

  python render/mini_sheet.py render/review/report-fix1.json render/review/fix-1.jpg
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets', 'exercises-3d')
T = 360


def main(report, out):
    names = {e['id']: e['name'] for e in json.load(open(os.path.join(HERE, 'exercises.json')))}
    ids = json.load(open(report))['ok']
    try:
        font = ImageFont.truetype('DejaVuSans.ttf', 18)
    except OSError:
        font = ImageFont.load_default()
    cols = 2
    cw, ch = T * 2 + 24, T + 34
    sheet = Image.new('RGB', (cols * cw, ((len(ids) + cols - 1) // cols) * ch), (10, 10, 10))
    d = ImageDraw.Draw(sheet)
    for i, ex in enumerate(ids):
        x, y = (i % cols) * cw, (i // cols) * ch
        for j, f in enumerate(('start', 'end')):
            im = Image.open(os.path.join(ASSETS, f'{ex}-{f}.webp')).convert('RGB').resize((T, T), Image.LANCZOS)
            sheet.paste(im, (x + 8 + j * T, y + 30))
            d.text((x + 14 + j * T, y + T + 6), f.upper(), fill=(150, 150, 155), font=font)
        d.text((x + 8, y + 6), f'{names.get(ex, ex)}  ({ex})', fill=(200, 255, 46), font=font)
    sheet.save(out, quality=90)
    print('wrote', out, len(ids), 'exercises')


if __name__ == '__main__':
    main(*sys.argv[1:3])
