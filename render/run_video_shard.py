"""Render one shard of the looping exercise videos (used by .github/workflows/render-videos.yml).

  python render/run_video_shard.py --phase split --shard 3 --of 16 [--frames 30 --samples 64]

Phases: `split` = the Upper Body 5-Day exercises (render/review-order.json "first"), `rest` = every
other exercise that has approved clay stills (assets/exercises-3d). Exercises that already have a
video in assets/exercises-video are skipped unless --force. Exercises without clay stills are never
rendered (they keep their photos).

Each exercise: render.py --video (frames + body masks) -> to_video.py (every frame must pass the
body-mask check, else no video is written). Writes render/out/video-report-<phase>-<shard>.json:
  {"ok": [ids], "failed": {id: reason}}
"""
import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')


def plan(phase, force=False):
    clay = sorted(f[:-len('-start.webp')] for f in os.listdir(os.path.join(ROOT, 'assets', 'exercises-3d')) if f.endswith('-start.webp'))
    vdir = os.path.join(ROOT, 'assets', 'exercises-video')
    done = set() if force or not os.path.isdir(vdir) else {f[:-4] for f in os.listdir(vdir) if f.endswith('.mp4')}
    first = json.load(open(os.path.join(HERE, 'review-order.json')))['first']
    split = [i for i in first if i in clay]
    ids = split if phase == 'split' else [i for i in clay if i not in split] if phase == 'rest' else clay
    return [i for i in ids if i not in done]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--phase', choices=('split', 'rest', 'all'), required=True)
    ap.add_argument('--shard', type=int, default=0)
    ap.add_argument('--of', type=int, default=1)
    ap.add_argument('--frames', type=int, default=30)
    ap.add_argument('--samples', type=int, default=64)
    ap.add_argument('--size', type=int, default=1024)
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--list', action='store_true', help='just print this shard\'s exercises')
    a = ap.parse_args()
    mine = plan(a.phase, a.force)[a.shard::a.of]
    if a.list:
        print('\n'.join(mine))
        return
    report = {'ok': [], 'failed': {}}
    os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
    for ex in mine:
        print(f'== {ex}', flush=True)
        r = subprocess.run([sys.executable, os.path.join(HERE, 'render.py'), ex, '--video', str(a.frames), '--samples', str(a.samples), '--size', str(a.size)],
                           capture_output=True, text=True)
        if r.returncode != 0:
            report['failed'][ex] = 'render error: ' + (r.stderr.strip().splitlines() or ['unknown'])[-1][:300]
            print('RENDER ERROR', ex, report['failed'][ex], flush=True)
            continue
        v = subprocess.run([sys.executable, os.path.join(HERE, 'to_video.py'), ex], capture_output=True, text=True)
        print(v.stdout.strip(), flush=True)
        if v.returncode != 0:
            report['failed'][ex] = (v.stdout.strip().splitlines() or ['encode failed'])[0][:300]
            continue
        report['ok'].append(ex)
    out = os.path.join(HERE, 'out', f'video-report-{a.phase}-{a.shard}.json')
    json.dump(report, open(out, 'w'), indent=1)
    print(len(report['ok']), 'ok,', len(report['failed']), 'failed')


if __name__ == '__main__':
    main()
