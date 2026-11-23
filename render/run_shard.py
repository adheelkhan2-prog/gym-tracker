"""Render one shard of the exercise list (used by .github/workflows/render-clay.yml).

  python render/run_shard.py --shard 3 --of 12 [--size 1024 --samples 96]

Renders exercises i, i+N, i+2N, ... (sorted by id), runs the dark-hole check, converts the passing
images to WebP (on black) and writes render/out/report-<shard>.json:
  {"ok": [ids], "failed": {id: reason}}
An exercise passes only when BOTH its start and end images pass.
"""
import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--shard', type=int, required=True)
    ap.add_argument('--of', type=int, required=True)
    ap.add_argument('--size', type=int, default=1024)
    ap.add_argument('--samples', type=int, default=96)
    a = ap.parse_args()
    ids = sorted(e['id'] for e in json.load(open(os.path.join(HERE, 'exercises.json'))))
    mine = ids[a.shard::a.of]
    os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
    report = {'ok': [], 'failed': {}}
    sys.path.insert(0, HERE)
    from check_renders import check

    for ex in mine:
        if not os.path.exists(os.path.join(HERE, 'poses', f'{ex}.json')):
            report['failed'][ex] = 'no pose file'
            continue
        r = subprocess.run([sys.executable, os.path.join(HERE, 'render.py'), ex, '--size', str(a.size), '--samples', str(a.samples)],
                           capture_output=True, text=True)
        imgs = [os.path.join(HERE, 'out', f'{ex}-{f}.png') for f in ('start', 'end')]
        if r.returncode != 0 or not all(os.path.exists(p) for p in imgs):
            report['failed'][ex] = 'render error: ' + (r.stderr.strip().splitlines() or ['unknown'])[-1][:300]
            print('RENDER ERROR', ex, report['failed'][ex], flush=True)
            continue
        bad = [(os.path.basename(p), check(p)) for p in imgs]
        bad = [(n, b) for n, b in bad if b]
        if bad:
            report['failed'][ex] = 'dark holes/streaks: ' + ', '.join(f'{n} ({len(b)} area(s))' for n, b in bad)
            print('CHECK FAIL', ex, report['failed'][ex], flush=True)
            continue
        subprocess.run([sys.executable, os.path.join(HERE, 'to_webp.py'), f'{ex}-start', f'{ex}-end'], check=True)
        report['ok'].append(ex)
        print('OK', ex, flush=True)

    with open(os.path.join(HERE, 'out', f'report-{a.shard}.json'), 'w') as f:
        json.dump(report, f, indent=1)
    print(f'shard {a.shard}: {len(report["ok"])} ok, {len(report["failed"])} failed')


if __name__ == '__main__':
    main()
