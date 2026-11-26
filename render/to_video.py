#!/usr/bin/env python3
"""Encode render/out/video/<id>/v*.png (transparent, from `render.py --video N`) into
assets/exercises-video/<id>.mp4: composited on the app's stage black (#0A0A0A), 1024 px, played
as a seamless loop (the frames already run start -> end -> start).

  python render/to_video.py incline_db_press lat_pulldown lateral_raise [--fps 12]

Full resolution, H.264 High at CRF 10 (visually lossless; true lossless H.264 won't play with
Android's hardware decoders), yuv420p, +faststart. Every frame first passes check_renders (against
the body mask render.py writes next to it); a video with any failing frame is not written.
"""
import argparse
import os
import subprocess
import sys
import tempfile

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from check_renders import check  # noqa: E402
OUT = os.path.join(HERE, '..', 'assets', 'exercises-video')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('ids', nargs='+')
    ap.add_argument('--fps', type=int, default=12)
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    rejected = []
    for ex_id in args.ids:
        src = os.path.join(HERE, 'out', 'video', ex_id)
        frames = sorted(f for f in os.listdir(src) if f.startswith('v') and f.endswith('.png') and not f.endswith('.mask.png'))
        if not frames:
            sys.exit(f'{ex_id}: no frames in {src}')
        # Never ship a broken frame: each is checked against its body mask (equipment excluded).
        bad = [f for f in frames if check(os.path.join(src, f))]
        if bad:
            rejected.append(ex_id)
            print(ex_id, 'REJECTED: dark holes/streaks on the body in', ', '.join(bad))
            continue
        with tempfile.TemporaryDirectory() as tmp:
            for i, f in enumerate(frames):
                im = Image.open(os.path.join(src, f)).convert('RGBA')
                bg = Image.new('RGBA', im.size, (10, 10, 10, 255))
                Image.alpha_composite(bg, im).convert('RGB').save(os.path.join(tmp, f'{i:03d}.png'))
            dst = os.path.join(OUT, f'{ex_id}.mp4')
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(args.fps), '-i', os.path.join(tmp, '%03d.png'),
                            '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'veryslow', '-crf', '10', '-pix_fmt', 'yuv420p',
                            '-movflags', '+faststart', '-an', dst], check=True)
        print(ex_id, len(frames), 'frames,', f'{len(frames) / args.fps:.1f} s,', os.path.getsize(dst) // 1024, 'KB')
    if rejected:
        print('rejected:', ', '.join(rejected))
        sys.exit(1)


if __name__ == '__main__':
    main()
