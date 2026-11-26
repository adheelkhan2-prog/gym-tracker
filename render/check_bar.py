"""Check held bars against the body: does the bar between the hands pass through the figure?

  python render/check_bar.py bb_curl ez_curl bb_shrug ...

For each frame, samples the bar line between the two grips (ignoring 7 cm round each hand, where
the fists are) and reports the deepest point inside the body (negative = clearance in metres).
Exits 1 when any bar is inside the body by more than 5 mm. No rendering: takes a few seconds.
"""
import json
import os
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'lib'))
sys.path.insert(0, HERE)
import makehuman  # noqa: E402
from render import mirrored, pose  # noqa: E402


def bar_depth(body, gl, gr):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    tree = BVHTree.FromObject(ev, dg)
    mw = body.matrix_world
    inv = mw.inverted()
    worst = -1.0
    n = 60
    span = (gr - gl).length
    for i in range(n + 1):
        p = gl.lerp(gr, i / n)
        if (p - gl).length < 0.07 or (p - gr).length < 0.07:
            continue
        loc, normal, _, dist = tree.find_nearest(inv @ p)
        if loc is None:
            continue
        inside = (inv @ p - loc).dot(normal) < 0
        worst = max(worst, dist if inside else -dist)
    return worst, span


def main():
    ids = [a for a in sys.argv[1:] if not a.startswith('-')]
    bad = []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    body, rig = makehuman.build()
    rest_pelvis = makehuman.rest_hips(rig)
    for ex_id in ids:
        spec = json.load(open(os.path.join(HERE, 'poses', f'{ex_id}.json')))
        hips = Vector(spec.get('hips', list(rest_pelvis)))
        for frame in ('start', 'end'):
            fr = dict(spec['frames'][frame])
            fh = fr.pop('hips', None)
            rig.location = (Vector(fh) if fh else hips) - rest_pelvis
            pose(rig, mirrored({**spec.get('base', {}), **fr}))
            bpy.context.view_layer.update()
            gl = makehuman.hand_basis(rig, 'L')[4]
            gr = makehuman.hand_basis(rig, 'R')[4]
            depth, span = bar_depth(body, gl, gr)
            flag = 'INSIDE' if depth > 0.005 else 'ok'
            print(f'{ex_id:22s} {frame:5s} bar {"inside body by" if depth > 0 else "clear by"} {abs(depth) * 100:5.1f} cm  '
                  f'hands {span * 100:4.0f} cm apart, {(gl.y + gr.y) / 2 * 100:+5.1f} cm fwd(-)/back(+)  {flag}')
            if depth > 0.005:
                bad.append(f'{ex_id}-{frame}')
    if bad:
        print('Bar through the body:', ', '.join(bad))
        sys.exit(1)


if __name__ == '__main__':
    main()
